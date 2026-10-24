"""Smooth motion toolkit (v2.1): fps policy, camera path, sub-pixel crop, motion QA.

Why: previews "lagged" for three measurable reasons.
  1. Resampling 60 fps (or 24/30) sources to a fixed 25 fps with the plain `fps` filter drops/duplicates frames unevenly.
  2. The face tracker moved the crop every 3rd frame and truncated it to integer pixels: the picture stepped at 8 Hz.
  3. Nothing measured it. `motion_report` now counts duplicate frames and freezes per panel and blocks delivery.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import cv2
import numpy as np

from .config import asset

COMMON = (24, 25, 30)


def probe(path) -> dict:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height,avg_frame_rate,r_frame_rate:format=duration", "-of", "json", str(path)],
                         capture_output=True, text=True).stdout
    j = json.loads(out or "{}")
    s = (j.get("streams") or [{}])[0]

    def fr(x):
        try:
            a, b = str(x).split("/")
            return float(a) / float(b) if float(b) else 0.0
        except Exception:
            return 0.0
    fps = fr(s.get("avg_frame_rate")) or fr(s.get("r_frame_rate")) or 30.0
    return {"w": int(s.get("width", 0)), "h": int(s.get("height", 0)), "fps": fps,
            "duration": float((j.get("format") or {}).get("duration") or 0)}


def pick_fps(main_fps: float) -> int:
    """Output fps that keeps the main picture untouched: 24/25/30 stay, 48/50/60 halve, anything else -> 30."""
    f = int(round(main_fps))
    if f in COMMON:
        return f
    if f in (48, 50, 60):
        return f // 2
    return 30


def resample_filter(src_fps: float, out_fps: int) -> str:
    """Plain `fps` when the ratio is an integer (exact drop/keep), blending `framerate` otherwise (no uneven judder)."""
    ratio = src_fps / out_fps
    if abs(ratio - round(ratio)) < 0.02 and round(ratio) >= 1:
        return f"fps={out_fps}"
    return f"framerate=fps={out_fps}:interp_start=0:interp_end=255:scene=100"


def slow_filter(factor: float, out_fps: int) -> str:
    """Slow motion with optical flow (24 fps film at 0.5x without it looks like a slideshow)."""
    return f"setpts={factor:.4f}*PTS,minterpolate=fps={out_fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"


# ------------------------------------------------------------------ camera path

def _hysteresis(raw: np.ndarray, dead: float) -> np.ndarray:
    out = raw.copy()
    cur = raw[0]
    for i, v in enumerate(raw):
        if abs(v - cur) > dead:
            cur = v - np.sign(v - cur) * dead
        out[i] = cur
    return out


def _gauss(a: np.ndarray, sigma: float) -> np.ndarray:
    if len(a) < 3 or sigma <= 0:
        return a
    r = int(sigma * 3) + 1
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    p = np.pad(a, (r, r), mode="edge")
    return np.convolve(p, k, mode="valid")


def smooth_segment(raw: np.ndarray, dead: float, sigma: float) -> np.ndarray:
    return _gauss(_hysteresis(raw, dead), sigma)


class CameraPath:
    """Per-output-frame crop centre. Built once from a 6 fps pre-pass, so every output frame has its own sub-pixel value."""

    def __init__(self, xs: np.ndarray, ys: np.ndarray, fps: int):
        self.xs, self.ys, self.fps = xs, ys, fps

    def at(self, n: int) -> tuple[float, float]:
        i = min(max(n, 0), len(self.xs) - 1)
        return float(self.xs[i]), float(self.ys[i])


def build_path(src: Path, start: float, dur: float, out_fps: int, mode: str = "group", crop_w_frac: float = 0.56,
               pre_fps: int = 6, dead_frac: float = 0.035, sigma_s: float = 0.55) -> CameraPath:
    """Face-follow path. mode: group (centre of all faces if they fit the crop, else biggest), biggest, center.
    Cuts (histogram jumps) split the path: smoothing never glides across a cut, the crop snaps instead."""
    info = probe(src)
    sw, sh = info["w"], info["h"]
    n_out = max(1, int(round(dur * out_fps)))
    if mode == "center":
        return CameraPath(np.full(n_out, sw / 2.0), np.full(n_out, sh / 2.0), out_fps)
    model = asset("models") / "face_detection_yunet_2023mar.onnx"
    det = cv2.FaceDetectorYN.create(str(model), "", (320, 320), 0.6, 0.3, 5000) if model.exists() else None
    dw = 480
    dh = int(round(sh * dw / sw / 2) * 2)
    cmd = ["ffmpeg", "-v", "quiet", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", str(src),
           "-vf", f"fps={pre_fps},scale={dw}:{dh}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    sc = sw / dw
    pts, cuts, prev_h = [], [], None
    last = (sw / 2.0, sh * 0.4)
    nbytes = dw * dh * 3
    crop_w = sw * crop_w_frac
    try:
        while True:
            buf = p.stdout.read(nbytes)
            if len(buf) < nbytes:
                break
            fr = np.frombuffer(buf, np.uint8).reshape(dh, dw, 3)
            h = cv2.calcHist([cv2.cvtColor(fr, cv2.COLOR_BGR2HSV)], [0, 1], None, [16, 8], [0, 180, 0, 256])
            cv2.normalize(h, h)
            if prev_h is not None and cv2.compareHist(prev_h, h, cv2.HISTCMP_CORREL) < 0.55:
                cuts.append(len(pts))
            prev_h = h
            c = last
            if det is not None:
                det.setInputSize((dw, dh))
                _, faces = det.detect(fr)
                if faces is not None and len(faces):
                    fs = sorted(faces, key=lambda r: -r[2] * r[3])
                    big = fs[0]
                    use = [big]
                    if mode == "group":
                        use = [f for f in fs if f[2] * f[3] > 0.25 * big[2] * big[3]]
                        x0 = min(f[0] for f in use) * sc
                        x1 = max(f[0] + f[2] for f in use) * sc
                        if x1 - x0 > crop_w * 0.92:
                            use = [big]
                    x0 = min(f[0] for f in use) * sc
                    x1 = max(f[0] + f[2] for f in use) * sc
                    y0 = min(f[1] for f in use) * sc
                    y1 = max(f[1] + f[3] for f in use) * sc
                    c = ((x0 + x1) / 2, (y0 + y1) / 2)
            last = c
            pts.append(c)
    finally:
        p.stdout.close()
        p.terminate()
        p.wait()
    if not pts:
        pts = [last]
    a = np.array(pts, dtype=np.float64)
    bounds = [0] + [c for c in cuts if 0 < c < len(a)] + [len(a)]
    xs = np.empty(len(a))
    ys = np.empty(len(a))
    for i in range(len(bounds) - 1):
        s_, e_ = bounds[i], bounds[i + 1]
        xs[s_:e_] = smooth_segment(a[s_:e_, 0], dead_frac * sw, sigma_s * pre_fps)
        ys[s_:e_] = smooth_segment(a[s_:e_, 1], dead_frac * sh, sigma_s * pre_fps * 1.6)
    t_pre = (np.arange(len(a)) + 0.5) / pre_fps
    t_out = (np.arange(n_out) + 0.5) / out_fps
    cut_t = [bounds[i] / pre_fps for i in range(1, len(bounds) - 1)]
    fx = np.interp(t_out, t_pre, xs)
    fy = np.interp(t_out, t_pre, ys)
    for ct in cut_t:                      # hard step exactly at the cut instead of a glide across it
        k = int(round(ct * out_fps))
        if 0 < k < n_out:
            j0 = int(np.searchsorted(t_pre, ct)) - 1
            j1 = min(j0 + 1, len(xs) - 1)
            fx[max(0, k - 3):k] = xs[max(0, j0)]
            fx[k:k + 3] = xs[j1]
            fy[max(0, k - 3):k] = ys[max(0, j0)]
            fy[k:k + 3] = ys[j1]
    return CameraPath(fx, fy, out_fps)


def crop_resize(frame: np.ndarray, cx: float, cy_top: float, cw: float, ch: float, out_w: int, out_h: int) -> np.ndarray:
    """Sub-pixel crop (cx centre, cy_top top edge) -> out_w x out_h through one affine warp. No integer snapping, no steps."""
    sh, sw = frame.shape[:2]
    x0 = min(max(cx - cw / 2, 0.0), sw - cw)
    y0 = min(max(cy_top, 0.0), sh - ch)
    s = out_w / cw
    m = np.array([[s, 0, -x0 * s], [0, out_h / ch, -y0 * out_h / ch]], dtype=np.float32)
    interp = cv2.INTER_AREA if s < 0.7 else (cv2.INTER_LINEAR if s < 1.0 else cv2.INTER_CUBIC)
    if s < 0.7:                              # warpAffine has no area filter: pre-shrink, then warp
        k = 0.5 / s
        frame = cv2.resize(frame, None, fx=1 / max(k, 1), fy=1 / max(k, 1), interpolation=cv2.INTER_AREA)
        sc = frame.shape[1] / sw
        m = np.array([[s / sc, 0, -x0 * s], [0, out_h / ch / sc, -y0 * out_h / ch]], dtype=np.float32)
        m[:, 2] = [-x0 * sc * (s / sc), -y0 * sc * (out_h / ch / sc)]
    return cv2.warpAffine(frame, m, (out_w, out_h), flags=interp, borderMode=cv2.BORDER_REPLICATE)


# ------------------------------------------------------------------ QA

def motion_report(video: Path, regions: dict | None = None, max_dup: float = 0.12, max_freeze: float = 0.5,
                  sample: int = 2000) -> dict:
    """Duplicate-frame and freeze statistics per panel.
    regions = {"name": [x, y, w, h]} in output pixels; default: the whole frame without the bottom 16% (ad bar).
    A frame is a duplicate when it differs from the previous one by < 0.03 mean grey levels (encoder noise floor).
    PASS when dup ratio <= max_dup and no run of identical frames longer than max_freeze seconds.
    Natural dups: 24 fps film in a 25 fps file = 1/25 = 4%."""
    info = probe(video)
    fps = info["fps"] or 30.0
    cap = cv2.VideoCapture(str(video))
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    regions = regions or {"frame": [0, 0, W, int(H * 0.84)]}
    prev: dict = {}
    dup = {k: [] for k in regions}
    n = 0
    while n < sample:
        ok, fr = cap.read()
        if not ok:
            break
        g = cv2.cvtColor(cv2.resize(fr, (W // 4, H // 4), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
        for k, (x, y, w, h) in regions.items():
            r = g[y // 4:(y + h) // 4, x // 4:(x + w) // 4]
            if k in prev:
                dup[k].append(float(np.mean(cv2.absdiff(r, prev[k]))) < 0.03)
            prev[k] = r
        n += 1
    cap.release()
    out = {"fps": round(fps, 3), "frames": n, "panels": {}, "ok": True, "problems": []}
    for k, flags in dup.items():
        if not flags:
            continue
        run = best = 0
        for f in flags:
            run = run + 1 if f else 0
            best = max(best, run)
        ratio = sum(flags) / len(flags)
        out["panels"][k] = {"dup_ratio": round(ratio, 3), "longest_freeze_s": round(best / fps, 2)}
        if ratio > max_dup:
            out["problems"].append(f"{k}: {ratio:.0%} repeated frames (max {max_dup:.0%}): fps mismatch or stills")
        if best / fps > max_freeze:
            out["problems"].append(f"{k}: frozen picture for {best / fps:.1f}s (max {max_freeze}s)")
    out["ok"] = not out["problems"]
    return out
