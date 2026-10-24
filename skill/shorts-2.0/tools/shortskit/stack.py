"""Panel-stack compositor (v2.1): [top loop video] + [speaker-follow main video] + captions + hook + bottom ad bar.

`python tools/shorts.py stack spec.json [--out FILE]`

spec = {
  "out": "01-interview.mp4",                      # fps is chosen from the MAIN source (24/25/30; 50/60 halve): no uneven resampling
  "main": {"pieces": [{"src": "a.mp4", "start": 0.8, "end": 8.2}, ...], "track": "group|biggest|center", "zoom": 1.0,
           "punch": 0.06},                       # y/h optional: default fills everything between top panel and ad bar
  "top": {"src": "car.mp4", "start": 10, "h": 540},                          # optional, muted, loops, any source fps
  "captions": {"srt": "x.srt", "accent": "#FFD84D", "size": 72, "words": 3},  # optional, y defaults to just above the bar
  "hook": {"text": "...", "start": 0.0, "end": 2.2},                          # optional
  "adbar": {"brand": "Quattro VPN", "url": "https://t.me/...", "tg": "QuattroVPN_BOT", "sub": "VPN в Telegram"},   # reference bar
  "banner": {...old floating card...},                                        # still supported
}
Smoothness rules enforced here: camera path is precomputed (6 fps detection, per-frame sub-pixel crop, deadband + Gaussian,
snap on cuts); the top video is resampled with the blending `framerate` filter when ratios are not integer; the result is
measured (`motion`) and the QR is decoded from a rendered frame (`adbar_qr`). Panels are written to `<out>.layout.json`.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from . import smooth
from .adbar import AdBar, qr_decodes
from .cardbanner import CardBanner, MARGIN
from .config import asset
from .util import ShortsError, hex_to_rgb, log

W, H = 1080, 1920
SAFE_TOP, SAFE_BOTTOM = 288, 1920 - 672


def _read_raw(args_in: list, vf: str, w: int, h: int):
    """Yield BGR frames from ffmpeg (exact trimming, constant fps)."""
    cmd = ["ffmpeg", "-v", "quiet", *args_in, "-vf", vf, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    n = w * h * 3
    try:
        while True:
            buf = p.stdout.read(n)
            if len(buf) < n:
                break
            yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)
    finally:
        p.stdout.close()
        p.terminate()
        p.wait()


def _probe_wh(path: Path) -> tuple[int, int]:
    i = smooth.probe(path)
    return i["w"], i["h"]


# ------------------------------------------------------------------ captions

def parse_srt(path: Path) -> list[tuple[float, float, str]]:
    def ts(s):
        h, m, r = s.replace(",", ".").split(":")
        return int(h) * 3600 + int(m) * 60 + float(r)
    cues = []
    for block in re.split(r"\n\s*\n", Path(path).read_text(encoding="utf-8").strip()):
        lines = block.strip().split("\n")
        if len(lines) >= 3 and "-->" in lines[1]:
            a, b = [x.strip() for x in lines[1].split("-->")]
            cues.append((ts(a), ts(b), " ".join(lines[2:]).strip()))
    return cues


def caption_chunks(cues, words_per_chunk=3, max_chars=22):
    """Cue -> short chunks with per-word timing proportional to word length (karaoke-style highlight)."""
    chunks = []
    for i, (t0, t1, text) in enumerate(cues):
        nxt = cues[i + 1][0] if i + 1 < len(cues) else t1 + 0.5
        t1 = min(max(t1, t0 + 0.4), nxt - 0.02) if nxt - t1 < 0.35 else t1
        words = text.split()
        groups, cur = [], []
        for w in words:
            if cur and (len(cur) >= words_per_chunk or len(" ".join(cur + [w])) > max_chars):
                groups.append(cur)
                cur = []
            cur.append(w)
        if cur:
            groups.append(cur)
        total = sum(len(w) + 1 for w in words) or 1
        t = t0
        for g in groups:
            share = sum(len(w) + 1 for w in g) / total * (t1 - t0)
            wt, acc = [], t
            gl = sum(len(w) + 1 for w in g)
            for w in g:
                d = share * (len(w) + 1) / gl
                wt.append((acc, acc + d))
                acc += d
            chunks.append({"t0": t, "t1": t + share, "words": g, "wt": wt})
            t += share
    return chunks


def _text_layer(words, active, size, accent, max_w=960):
    font = ImageFont.truetype(str(asset("fonts") / "Montserrat-ExtraBold.ttf"), size)
    sp = font.getlength(" ")
    widths = [font.getlength(w) for w in words]
    total = sum(widths) + sp * (len(words) - 1)
    scale = min(1.0, max_w / total)
    if scale < 1.0:
        font = ImageFont.truetype(str(asset("fonts") / "Montserrat-ExtraBold.ttf"), int(size * scale))
        sp = font.getlength(" ")
        widths = [font.getlength(w) for w in words]
        total = sum(widths) + sp * (len(words) - 1)
    pad = 16
    lay = Image.new("RGBA", (int(total) + pad * 2, int(size * 1.5)), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    x = pad
    for i, w in enumerate(words):
        col = accent if i == active else (255, 255, 255)
        d.text((x, size * 0.2), w, font=font, fill=col + (255,), stroke_width=max(5, size // 10), stroke_fill=(0, 0, 0, 255))
        x += widths[i] + sp
    return lay


class Captions:
    def __init__(self, cfg: dict, base: Path):
        srt = Path(cfg["srt"])
        srt = srt if srt.is_absolute() else base / srt
        self.chunks = caption_chunks(parse_srt(srt), int(cfg.get("words", 3)))
        self.y = int(cfg.get("y", 1040))
        self.size = int(cfg.get("size", 66))
        self.accent = hex_to_rgb(cfg.get("accent", "#FFD84D"))
        self.cache: dict = {}

    def layer_at(self, t: float):
        for c in self.chunks:
            if c["t0"] <= t < c["t1"] + 0.04:
                act = 0
                for i, (a, b) in enumerate(c["wt"]):
                    if t >= a:
                        act = i
                key = (id(c), act)
                if key not in self.cache:
                    self.cache[key] = _text_layer(c["words"], act, self.size, self.accent)
                fade = min(1.0, (t - c["t0"]) / 0.07)
                return self.cache[key], fade
        return None, 0.0


def _blend(canvas: np.ndarray, layer: Image.Image, x: int, y: int, alpha: float = 1.0):
    """Alpha-blend an RGBA PIL layer onto a BGR canvas at (x, y) with clipping."""
    lw, lh = layer.size
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + lw, canvas.shape[1]), min(y + lh, canvas.shape[0])
    if x1 <= x0 or y1 <= y0:
        return
    arr = np.asarray(layer.crop((x0 - x, y0 - y, x1 - x, y1 - y)))
    a = (arr[..., 3:4].astype(np.float32) / 255.0) * alpha
    roi = canvas[y0:y1, x0:x1].astype(np.float32)
    rgb = arr[..., 2::-1].astype(np.float32)
    canvas[y0:y1, x0:x1] = (roi * (1 - a) + rgb * a).astype(np.uint8)



# ------------------------------------------------------------------ main

def layout_for(spec: dict) -> dict:
    """Panel rectangles. Nothing is left empty: top video (if any) + main picture + ad bar fill 1080x1920."""
    bar_h = int((spec.get("adbar") or {}).get("height", 300)) if spec.get("adbar") else 0
    top = spec.get("top")
    th = int(top.get("h", 540)) if top else 0
    main = spec["main"]
    py = int(main["y"]) if main.get("y") is not None else th
    ph = int(main["h"]) if main.get("h") is not None else H - bar_h - py
    return {"top": [0, 0, W, th] if th else None, "main": [0, py, W, ph],
            "bar": [0, H - bar_h, W, bar_h] if bar_h else None}


def render_stack(spec: dict, base: Path, out: Path | None = None, check: bool = True) -> dict:
    main = spec["main"]
    pieces = main["pieces"]
    durs = [float(p["end"]) - float(p["start"]) for p in pieces]
    total = sum(durs)
    lay = layout_for(spec)
    _, py, _, ph = lay["main"]
    zoom = float(main.get("zoom", 1.0))
    punch = float(main.get("punch", 0.0))
    base = Path(base)
    out = Path(out or base / spec.get("out", "short.mp4"))
    out.parent.mkdir(parents=True, exist_ok=True)

    def res(p):
        p = Path(p)
        return p if p.is_absolute() else base / p

    infos = [smooth.probe(res(p["src"])) for p in pieces]
    fps = int(spec["fps"]) if spec.get("fps") else smooth.pick_fps(infos[0]["fps"])
    n_total = int(round(total * fps))

    work = out.with_suffix(".work")
    work.mkdir(exist_ok=True)
    wav = work / "audio.wav"
    ins, fc = [], []
    for i, p in enumerate(pieces):
        ins += ["-ss", str(p["start"]), "-t", f"{durs[i]:.3f}", "-i", str(res(p["src"]))]
        fc.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo[a{i}]")
    chain = "".join(f"[a{i}]" for i in range(len(pieces))) + f"concat=n={len(pieces)}:v=0:a=1[a]"
    af = "[a]loudnorm=I=-14:TP=-1.5:LRA=11[o]" if spec.get("loudnorm", True) else "[a]anull[o]"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", ";".join(fc) + ";" + chain + ";" + af, "-map", "[o]", "-ar", "48000", str(wav)], check=True)

    # camera paths (one per piece), then frames
    track = main.get("track", True)
    mode = "group" if track in (True, "group") else ("biggest" if track == "biggest" else "center")
    ratio = W / ph
    paths = []
    for i, p in enumerate(pieces):
        ch0 = infos[i]["h"] / zoom
        cwf = min(1.0, ch0 * ratio / max(infos[i]["w"], 1))
        paths.append(smooth.build_path(res(p["src"]), float(p["start"]), durs[i], fps, mode, crop_w_frac=cwf))

    def main_frames():
        for i, p in enumerate(pieces):
            sw, sh = infos[i]["w"], infos[i]["h"]
            args = ["-ss", str(p["start"]), "-t", f"{durs[i]:.3f}", "-i", str(res(p["src"]))]
            vf = smooth.resample_filter(infos[i]["fps"], fps)
            for k, fr in enumerate(_read_raw(args, vf, sw, sh)):
                yield i, k, fr

    top_iter = None
    topcfg = spec.get("top")
    th = lay["top"][3] if lay["top"] else 0
    if topcfg:
        ti = smooth.probe(res(topcfg["src"]))
        z = float(topcfg.get("zoom", 1.0))   # >1 crops in: hides channel watermarks
        vf = (smooth.resample_filter(ti["fps"], fps) + f",scale={int(W * z)}:{int(th * z)}:force_original_aspect_ratio=increase,"
              f"crop={W}:{th}:x=(iw-ow)/2:y=(ih-oh)/2")
        args = ["-stream_loop", "-1", "-ss", str(topcfg.get("start", 0)), "-i", str(res(topcfg["src"])), "-t", f"{total:.3f}"]
        top_iter = _read_raw(args, vf, W, th)
    caps = Captions(spec["captions"], base) if spec.get("captions") and spec["captions"].get("srt") else None
    if caps:
        caps.size = int(spec["captions"].get("size", 72))
        bar_top = lay["bar"][1] if lay["bar"] else H
        caps.y = int(spec["captions"]["y"]) if spec["captions"].get("y") is not None else bar_top - int(caps.size * 1.5) - 70
    bar = AdBar(spec["adbar"], base) if spec.get("adbar") else None
    banner = None
    bcfg = spec.get("banner")
    if bcfg:
        banner = CardBanner(bcfg, base)
        b_start, b_end = float(bcfg.get("start", 2.0)), bcfg.get("end")
        b_y = int(bcfg.get("y", 330)) - MARGIN
        bw, bh = banner.size()
        b_x = (W - bw) // 2 - 48 if bcfg.get("x") is None else int(bcfg["x"])
    hook = spec.get("hook")
    if hook:
        hook.setdefault("y", py + 70)

    enc = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
           "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", spec.get("preset", "medium"), "-crf", "17",
           "-maxrate", "14M", "-bufsize", "28M", "-g", str(fps * 2), "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-r", str(fps),
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", str(out)]
    proc = subprocess.Popen(enc, stdin=subprocess.PIPE)
    seam_shadow = np.linspace(0.55, 0.0, 28, dtype=np.float32)[:, None, None]
    n = 0
    piece_start = [0]
    for d in durs[:-1]:
        piece_start.append(piece_start[-1] + int(round(d * fps)))
    canvas = np.zeros((H, W, 3), np.uint8)
    try:
        for i, k, fr in main_frames():
            if n >= n_total:
                break
            t = n / fps
            sh_, sw_ = fr.shape[:2]
            fx, fy = paths[i].at(k)
            pz = 1.0 + punch * max(0.0, 1.0 - (k / fps) / 0.35) if punch else 1.0     # short push-in at the start of a piece
            ch = sh_ / (zoom * pz)
            cw = ch * W / ph
            if cw > sw_:
                cw, ch = sw_, sw_ * ph / W
            panel = smooth.crop_resize(fr, fx, fy - ch * 0.38 if (zoom * pz) > 1.01 or ch < sh_ - 1 else (sh_ - ch) / 2, cw, ch, W, ph)
            canvas[py:py + ph] = panel[: H - py] if py + ph > H else panel
            if py > 0 and not top_iter:                         # explicit layout with a gap above: blurred fill, never black
                small = cv2.GaussianBlur(cv2.resize(panel, (54, 96), interpolation=cv2.INTER_AREA), (0, 0), 2)
                bg = (cv2.resize(small, (W, py), interpolation=cv2.INTER_CUBIC).astype(np.float32) * 0.55).astype(np.uint8)
                canvas[0:py] = bg
            if top_iter is not None:
                tf = next(top_iter, None)
                if tf is not None:
                    canvas[0:th] = tf
                    seg = canvas[th:th + 28].astype(np.float32)
                    canvas[th:th + 28] = (seg * (1 - seam_shadow)).astype(np.uint8)
            if hook and hook.get("start", 0) <= t < hook.get("end", 2.2) + 0.3:
                kk = min(1.0, (t - hook.get("start", 0)) / 0.12)
                if t > hook.get("end", 2.2):
                    kk *= max(0.0, 1 - (t - hook["end"]) / 0.3)
                _blend(canvas, _hook_layer(hook["text"], hook.get("size", 84)), 0, int(hook["y"]) + int((1 - kk) * 18), kk)
            if caps:
                lay_, a = caps.layer_at(t)
                if lay_ is not None:
                    _blend(canvas, lay_, (W - lay_.width) // 2, caps.y, a)
            if bar is not None:
                off = bar.offset(t, total)
                if off is not None:
                    y0 = H - bar.h + off
                    canvas[y0:H] = bar.frame(t - bar.start)[: H - y0]
            if banner and t >= b_start and (b_end is None or t < float(b_end)):
                _blend(canvas, banner.frame(t - b_start, None if b_end is None else float(b_end) - b_start), b_x, b_y)
            proc.stdin.write(canvas.tobytes())
            n += 1
    finally:
        proc.stdin.close()
        rc = proc.wait()
    if rc != 0:
        raise ShortsError("ffmpeg failed while encoding the stack")
    for f in work.glob("*"):
        f.unlink()
    work.rmdir()
    result = {"out": str(out), "frames": n, "fps": fps, "duration": round(n / fps, 2), "layout": lay}
    out.with_suffix(".layout.json").write_text(json.dumps({"fps": fps, "panels": lay, "adbar": bool(bar), "url": (spec.get("adbar") or {}).get("url")}, ensure_ascii=False), encoding="utf-8")
    if check:
        result.update(check_stack(out, lay, (spec.get("adbar") or {}).get("url") if bar else None, bar.start if bar else 0.0))
    return result


def check_stack(video: Path, lay: dict, url: str | None, bar_t: float = 0.0) -> dict:
    """Measured, not assumed: duplicate frames per panel and a QR that really decodes from a rendered frame."""
    regions = {k: v for k, v in (("top", lay.get("top")), ("main", lay.get("main"))) if v}
    rep = smooth.motion_report(video, regions)
    out = {"motion": rep, "ok": rep["ok"]}
    if url and lay.get("bar"):
        cap = cv2.VideoCapture(str(video))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        nfr = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        ok = False
        for t in (bar_t + 1.2, bar_t + 2.4, bar_t + 0.8):
            cap.set(cv2.CAP_PROP_POS_FRAMES, min(int(t * fps), max(nfr - 2, 0)))
            good, fr = cap.read()
            if good and qr_decodes(fr[lay["bar"][1]:], url):
                ok = True
                break
        cap.release()
        out["adbar_qr"] = ok
        if not ok:
            out["ok"] = False
            rep["problems"].append("ad bar QR does not decode from the rendered video")
    return out


def _hook_layer(text: str, size: int) -> Image.Image:
    font = ImageFont.truetype(str(asset("fonts") / "Montserrat-ExtraBold.ttf"), size)
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if font.getlength(t) <= W - 160 or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    lay = Image.new("RGBA", (W, int(size * 1.25 * len(lines)) + 30), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    y = 6
    for l in lines:
        d.text((W / 2, y), l, font=font, fill=(255, 255, 255, 255), anchor="mt", stroke_width=9, stroke_fill=(0, 0, 0, 255))
        y += int(size * 1.25)
    return lay
