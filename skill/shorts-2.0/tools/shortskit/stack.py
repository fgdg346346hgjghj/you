"""Panel-stack compositor: one short = [top video] + [speaker-tracked main video] + captions + floating ad card.

`python tools/shorts.py stack spec.json [--out FILE]`

spec = {
  "out": "01-interview.mp4", "fps": 25,
  "main": {"pieces": [{"src": "a.mp4", "start": 0.8, "end": 8.2}, ...], "y": 520, "h": 1080, "zoom": 1.0, "track": true},
  "top": {"src": "game.mp4", "start": 10, "h": 540},                      # optional, muted, loops
  "captions": {"srt": "x.srt", "y": 1040, "accent": "#FFD84D", "size": 66, "words": 3},   # optional
  "hook": {"text": "ОДИН НЕИЗВЕСТНЫЙ…", "y": 700, "start": 0.0, "end": 2.6},              # optional
  "banner": { ...cardbanner spec..., "start": 3.0, "y": 330, "end": null },                # optional
  "loudnorm": true
}
Layout rules the code enforces: the banner card and captions stay inside the Shorts safe zone
(top 288 px, bottom 672 px free of important content, right 192 px), the speaker is tracked with YuNet so the
crop follows the face and snaps on cuts, the background is a blurred copy of the main picture (no black voids).
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .cardbanner import CardBanner, MARGIN
from .config import asset
from .util import ShortsError, hex_to_rgb, log

W, H = 1080, 1920
SAFE_TOP, SAFE_BOTTOM = 288, 1920 - 672


# ------------------------------------------------------------------ io helpers

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
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True).stdout.strip().split(",")
    return int(out[0]), int(out[1])


# ------------------------------------------------------------------ face tracking

class FaceTracker:
    def __init__(self):
        model = asset("models") / "face_detection_yunet_2023mar.onnx"
        self.det = cv2.FaceDetectorYN.create(str(model), "", (320, 320), 0.55, 0.3, 5000) if model.exists() else None
        self.x = self.y = None
        self.n = 0

    def update(self, frame: np.ndarray) -> tuple[float, float]:
        h, w = frame.shape[:2]
        if self.det is not None and self.n % 3 == 0:
            sc = 640 / w
            small = cv2.resize(frame, (640, int(h * sc)))
            self.det.setInputSize((small.shape[1], small.shape[0]))
            _, faces = self.det.detect(small)
            if faces is not None and len(faces):
                f = max(faces, key=lambda r: r[2] * r[3])
                tx, ty = (f[0] + f[2] / 2) / sc, (f[1] + f[3] / 2) / sc
                if self.x is None or abs(tx - self.x) > 0.18 * w:    # cut: snap
                    self.x, self.y = tx, ty
                else:
                    self.x += 0.12 * (tx - self.x)
                    self.y += 0.12 * (ty - self.y)
        self.n += 1
        if self.x is None:
            return w / 2, h / 2
        return self.x, self.y


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

def render_stack(spec: dict, base: Path, out: Path | None = None) -> dict:
    fps = int(spec.get("fps", 25))
    main = spec["main"]
    pieces = main["pieces"]
    durs = [float(p["end"]) - float(p["start"]) for p in pieces]
    total = sum(durs)
    py, ph = int(main.get("y", 520)), int(main.get("h", 1080))
    zoom = float(main.get("zoom", 1.0))
    base = Path(base)
    out = Path(out or base / spec.get("out", "short.mp4"))
    out.parent.mkdir(parents=True, exist_ok=True)

    def res(p):
        p = Path(p)
        return p if p.is_absolute() else base / p

    # audio: concatenated pieces
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

    def main_frames():
        for i, p in enumerate(pieces):
            sw, sh = _probe_wh(res(p["src"]))
            args = ["-ss", str(p["start"]), "-t", f"{durs[i]:.3f}", "-i", str(res(p["src"]))]
            for fr in _read_raw(args, f"fps={fps}", sw, sh):
                yield fr

    top_iter = None
    topcfg = spec.get("top")
    th = int(topcfg["h"]) if topcfg else 0
    if topcfg:
        args = ["-stream_loop", "-1", "-ss", str(topcfg.get("start", 0)), "-i", str(res(topcfg["src"])), "-t", f"{total:.3f}"]
        z = float(topcfg.get("zoom", 1.0))   # >1 crops in from the top-left: hides channel watermarks
        vf = f"fps={fps},scale={int(W * z)}:{int(th * z)}:force_original_aspect_ratio=increase,crop={W}:{th}:x=iw-ow:y=ih-oh"
        top_iter = _read_raw(args, vf, W, th)
    caps = Captions(spec["captions"], base) if spec.get("captions") and spec["captions"].get("srt") else None
    banner = None
    bcfg = spec.get("banner")
    if bcfg:
        banner = CardBanner(bcfg, base)
        b_start, b_end = float(bcfg.get("start", 2.0)), bcfg.get("end")
        b_y = int(bcfg.get("y", 330)) - MARGIN
        bw, bh = banner.size()
        b_x = (W - bw) // 2 - 48 if bcfg.get("x") is None else int(bcfg["x"])   # centred in the safe width (right 192 px reserved)
    hook = spec.get("hook")
    tracker = FaceTracker() if main.get("track", True) else None

    enc = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
           "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", str(out)]
    proc = subprocess.Popen(enc, stdin=subprocess.PIPE)
    n_total = int(round(total * fps))
    seam_shadow = np.linspace(0.55, 0.0, 28, dtype=np.float32)[:, None, None]
    n = 0
    try:
        for fr in main_frames():
            if n >= n_total:
                break
            t = n / fps
            sh_, sw_ = fr.shape[:2]
            fx, fy = tracker.update(fr) if tracker else (sw_ / 2, sh_ / 2)
            ch = sh_ / zoom
            cw = ch * W / ph
            if cw > sw_:
                cw, ch = sw_, sw_ * ph / W
            x0 = int(min(max(fx - cw / 2, 0), sw_ - cw))
            y0 = int(min(max(fy - ch * 0.36, 0), sh_ - ch)) if zoom > 1.01 else int((sh_ - ch) / 2)
            panel = cv2.resize(fr[y0:y0 + int(ch), x0:x0 + int(cw)], (W, ph), interpolation=cv2.INTER_AREA)
            # background: blurred, darkened, cover-fit copy
            small = cv2.resize(panel, (54, 96), interpolation=cv2.INTER_AREA)
            small = cv2.GaussianBlur(small, (0, 0), 2)
            bg = cv2.resize(small, (W, H), interpolation=cv2.INTER_CUBIC)
            canvas = (bg.astype(np.float32) * float(spec.get("bg_light", 0.55))).astype(np.uint8)
            canvas[py:py + ph] = panel[: H - py] if py + ph > H else panel
            if top_iter is not None:
                tf = next(top_iter, None)
                if tf is not None:
                    canvas[0:th] = tf
                    if py <= th + 2:
                        pass
                    seg = canvas[th:th + 28].astype(np.float32)
                    canvas[th:th + 28] = (seg * (1 - seam_shadow)).astype(np.uint8)
            if hook and hook.get("start", 0) <= t < hook.get("end", 2.6) + 0.3:
                k = min(1.0, (t - hook.get("start", 0)) / 0.12)
                if t > hook.get("end", 2.6):
                    k *= max(0.0, 1 - (t - hook["end"]) / 0.3)
                _blend(canvas, _hook_layer(hook["text"], hook.get("size", 78)), 0, int(hook.get("y", 700)) + int((1 - k) * 18), k)
            if caps:
                lay, a = caps.layer_at(t)
                if lay is not None:
                    _blend(canvas, lay, (W - lay.width) // 2, caps.y, a)
            if banner and t >= b_start and (b_end is None or t < float(b_end)):
                bt = t - b_start
                _blend(canvas, banner.frame(bt, None if b_end is None else float(b_end) - b_start), b_x, b_y)
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
    return {"out": str(out), "frames": n, "duration": round(n / fps, 2)}


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
