"""Covers v2.1: three covers that really differ, built around ONE focal face, big 2-4 word text, no letterbox blur.

pick_distinct(src, t0, t1, k) -> k frames >= min_gap s apart, ranked by face size, sharpness, exposure, colour, open composition
render(frame, face, text, variant, accent, tag) -> PIL image 1080x1920
  A "close":  face ~40% of the height, text in the top third, yellow accent, warm contrast grade
  B "context": wider shot, face ~26%, text under the subject (above the UI zone), red/cyan accent
  C "poster":  tightest crop, duotone-ish grade with one accent word, short quote at the top
Every cover: cover-fit crop (never blurred bars), upscale limited to 2.6x (else sharpened + grain), subject pop (background
darker than the face), top/bottom scrim, text outline 7% of the size, text never on the face (checked), text outside the
bottom 25% (feed UI). `distinct(images)` rejects near-duplicate covers (dHash distance < 14 bits of 256).
Research: reference/cover-packaging.md (sources listed there).
"""
from __future__ import annotations

import colorsys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from .config import asset
from .util import ShortsError, hex_to_rgb

W, H = 1080, 1920
VARIANTS = {
    "A": {"face": 0.40, "cy": 0.50, "text": "top", "accent": "#FFD84D", "grade": "warm"},
    "B": {"face": 0.26, "cy": 0.40, "text": "low", "accent": "#FF4D4D", "grade": "neutral"},
    "C": {"face": 0.50, "cy": 0.52, "text": "top", "accent": "#35D0FF", "grade": "duo"},
}
MAX_UP = 2.6


def _detector():
    model = asset("models") / "face_detection_yunet_2023mar.onnx"
    return cv2.FaceDetectorYN.create(str(model), "", (320, 320), 0.7, 0.3, 5000) if model.exists() else None


def faces_in(det, frame: np.ndarray) -> list[tuple[float, float, float, float]]:
    if det is None:
        return []
    h, w = frame.shape[:2]
    sc = 640 / w
    small = cv2.resize(frame, (640, int(h * sc)))
    det.setInputSize((small.shape[1], small.shape[0]))
    _, f = det.detect(small)
    if f is None:
        return []
    return sorted([(r[0] / sc, r[1] / sc, r[2] / sc, r[3] / sc) for r in f], key=lambda r: -r[2] * r[3])


def score_frame(fr: np.ndarray, faces) -> float:
    h, w = fr.shape[:2]
    g = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY)
    face = faces[0] if faces else None
    if face:
        x, y, fw, fh = [int(v) for v in face]
        roi = g[max(y, 0):y + fh, max(x, 0):x + fw]
        sharp = min(1.0, cv2.Laplacian(roi, cv2.CV_64F).var() / 180.0) if roi.size else 0
        bright = float(roi.mean()) if roi.size else 0
        expo = 1.0 - min(1.0, abs(bright - 125) / 100)
        area = min(1.0, (fh / h) / 0.22)
        cut = face[0] < 0.02 * w or face[0] + face[2] > 0.98 * w or face[1] < 0.01 * h
        pen = 0.3 if cut else 1.0
        two = 0.7 if len(faces) > 1 and faces[1][2] * faces[1][3] > 0.6 * face[2] * face[3] else 1.0
        sat = float(cv2.cvtColor(fr, cv2.COLOR_BGR2HSV)[..., 1].mean()) / 255
        return (3.0 * area + 1.6 * sharp + 1.0 * expo + 0.6 * sat) * pen * two
    sharp = min(1.0, cv2.Laplacian(g, cv2.CV_64F).var() / 250.0)
    return 0.9 * sharp + 0.5 * min(1.0, float(g.std()) / 60)


def pick_distinct(src, t0: float, t1: float, k: int = 3, min_gap: float = 3.0, n: int = 72):
    """k best frames, at least min_gap seconds apart. Returns [(frame, t, faces, score)] best first."""
    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        raise ShortsError(f"cannot open {src}")
    det = _detector()
    cands = []
    for i in range(n):
        t = t0 + (t1 - t0) * (i + 0.5) / n
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, fr = cap.read()
        if not ok:
            continue
        fs = faces_in(det, fr)
        cands.append((score_frame(fr, fs), t, fr, fs))
    cap.release()
    if not cands:
        raise ShortsError(f"no readable frames in {src} between {t0} and {t1}")
    cands.sort(key=lambda c: -c[0])
    gap = min(min_gap, max(0.4, (t1 - t0) / (k * 2)))
    chosen = []
    for c in cands:
        if all(abs(c[1] - o[1]) >= gap for o in chosen):
            chosen.append(c)
        if len(chosen) == k:
            break
    for c in cands:                                   # short clips: fill up even when gaps are tight
        if len(chosen) == k:
            break
        if c not in chosen:
            chosen.append(c)
    return [(c[2], c[1], c[3], c[0]) for c in chosen]


# ------------------------------------------------------------------ grading

def _curve(x: np.ndarray, strength: float) -> np.ndarray:
    return np.clip(x + strength * np.sin(2 * np.pi * (x - 0.5)) * 0.5 * (1 - np.abs(2 * x - 1)) ** 0.0, 0, 1)


def _grade(img: np.ndarray, kind: str) -> np.ndarray:
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    lab[..., 0] = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(6, 6)).apply(lab[..., 0])
    img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR).astype(np.float32) / 255
    img = _curve(img, 0.22)
    hsv = cv2.cvtColor((img * 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    if kind == "duo":
        hsv[..., 1] *= 0.35
    else:
        hsv[..., 1] = np.clip(hsv[..., 1] * 1.22, 0, 255)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
    if kind == "warm":
        out[..., 2] *= 1.05
        out[..., 0] *= 0.94
    elif kind == "duo":
        out[..., 0] *= 1.08
        out[..., 2] *= 0.95
    return np.clip(out, 0, 255).astype(np.uint8)


def _sharpen(img: np.ndarray, amount: float = 0.7) -> np.ndarray:
    blur = cv2.GaussianBlur(img, (0, 0), 1.4)
    return cv2.addWeighted(img, 1 + amount, blur, -amount, 0)


# ------------------------------------------------------------------ text

def _font(size: int):
    return ImageFont.truetype(str(asset("fonts") / "Montserrat-ExtraBold.ttf"), size)


def parse_marked(text: str) -> list[tuple[str, bool]]:
    """'ОДИН *НЕИЗВЕСТНЫЙ* ДВОР' -> [(word, accent)]. No marker: the last word is the accent."""
    out, marked = [], False
    for w in text.split():
        a = w.startswith("*") and w.endswith("*") and len(w) > 2
        marked |= a
        out.append((w.strip("*").upper(), a))
    if out and not marked:
        out[-1] = (out[-1][0], True)
    return out


def _lines(words: list[tuple[str, bool]], font, max_w: int) -> list[list[tuple[str, bool]]]:
    """Greedy wrap, then balance: never a single short word under a long line."""
    lines, cur = [], []
    for w in words:
        t = " ".join(x[0] for x in cur + [w])
        if cur and font.getlength(t) > max_w:
            lines.append(cur)
            cur = [w]
        else:
            cur.append(w)
    lines.append(cur)
    return lines


def _fit(words, max_w: int, max_h: int, start: int = 230, floor: int = 120):
    size = start
    while size >= floor:
        f = _font(size)
        ls = _lines(words, f, max_w)
        if len(ls) <= 3 and len(ls) * size * 1.0 <= max_h and all(f.getlength(" ".join(x[0] for x in l)) <= max_w for l in ls):
            return f, ls, size
        size -= 6
    raise ShortsError("cover text does not fit: use at most 4 short words")


def draw_text(base: Image.Image, words, accent, zone: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    """Draw the headline inside zone (x0, y0, x1, y1), centred. Returns the text bbox."""
    x0, y0, x1, y1 = zone
    f, ls, size = _fit(words, x1 - x0, y1 - y0)
    stroke = max(6, int(size * 0.07))
    lh = int(size * 1.0)
    total = len(ls) * lh
    y = y0 + (y1 - y0 - total) // 2
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sd, d = ImageDraw.Draw(shadow), ImageDraw.Draw(layer)
    bx0, by0, bx1, by1 = W, H, 0, 0
    for l in ls:
        text = " ".join(w[0] for w in l)
        lw = f.getlength(text)
        x = (x0 + x1 - lw) / 2
        for wd, acc in l:
            sd.text((x + 0, y + 8), wd, font=f, fill=(0, 0, 0, 200), stroke_width=stroke, stroke_fill=(0, 0, 0, 200))
            d.text((x, y), wd, font=f, fill=(accent if acc else (255, 255, 255)) + (255,), stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
            x += f.getlength(wd + " ")
        bx0, bx1 = min(bx0, int((x0 + x1 - lw) / 2)), max(bx1, int((x0 + x1 + lw) / 2))
        by0 = min(by0, y)
        by1 = max(by1, y + lh)
        y += lh
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    base.alpha_composite(shadow)
    base.alpha_composite(layer)
    return bx0, by0, bx1, by1


# ------------------------------------------------------------------ compose

def _crop_for(frame: np.ndarray, face, face_frac: float, cy_frac: float):
    sh, sw = frame.shape[:2]
    if face:
        fx, fy, fw, fh = face
        fcx, fcy = fx + fw / 2, fy + fh / 2
        s = min(max((face_frac * H) / fh, max(W / sw, H / sh)), max(MAX_UP, max(W / sw, H / sh)))
    else:
        fcx, fcy = sw / 2, sh * 0.42
        s = max(W / sw, H / sh)
        fh = sh * 0.3
    cw, ch = W / s, H / s
    x0 = min(max(fcx - cw / 2, 0), sw - cw)
    y0 = min(max(fcy - ch * cy_frac, 0), sh - ch)
    return x0, y0, cw, ch, s


def render(frame: np.ndarray, faces, text: str, variant: str = "A", accent: str | None = None, tag: str | None = None) -> tuple[Image.Image, dict]:
    v = VARIANTS[variant]
    acc = hex_to_rgb(accent) if accent else hex_to_rgb(v["accent"])
    words = parse_marked(text)
    if not 1 <= len(words) <= 5:
        raise ShortsError(f"cover text has {len(words)} words: 2-4 read on a phone, 5 is the limit")
    face = faces[0] if faces else None
    x0, y0, cw, ch, s = _crop_for(frame, face, v["face"], v["cy"])
    m = np.array([[s, 0, -x0 * s], [0, s, -y0 * s]], dtype=np.float32)
    img = cv2.warpAffine(frame, m, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    img = _grade(img, v["grade"])
    if s > 1.6:
        img = _sharpen(img, min(1.0, 0.35 * s))
        noise = np.random.default_rng(7).normal(0, 3.0, img.shape).astype(np.float32)
        img = np.clip(img.astype(np.float32) + noise, 0, 255).astype(np.uint8)
    fx_ = fy_ = None
    frect = None
    if face:
        fx_, fy_ = (face[0] + face[2] / 2 - x0) * s, (face[1] + face[3] / 2 - y0) * s
        frect = (int(fx_ - face[2] * s / 2), int(fy_ - face[3] * s / 2), int(fx_ + face[2] * s / 2), int(fy_ + face[3] * s / 2))
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        d = ((xx - fx_) / (face[2] * s * 1.9)) ** 2 + ((yy - fy_) / (face[3] * s * 2.6)) ** 2
        pop = np.clip(1.0 - d, 0, 1) ** 0.6
        k = 0.55 + 0.45 * pop                           # background darker than the subject
        img = (img.astype(np.float32) * k[..., None]).astype(np.uint8)
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    vign = 1 - 0.35 * np.clip((np.abs(np.linspace(-1, 1, W, dtype=np.float32))[None, :]) ** 2.2, 0, 1)
    img = (img.astype(np.float32) * vign[..., None]).astype(np.uint8)
    top_a = np.clip(1 - yy / 0.42, 0, 1) ** 1.3 * (0.62 if v["text"] == "top" else 0.30)
    low_a = np.clip((yy - 0.52) / 0.40, 0, 1) ** 1.2 * (0.70 if v["text"] == "low" else 0.45)
    img = (img.astype(np.float32) * (1 - np.maximum(top_a, low_a))[..., None]).astype(np.uint8)
    pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).convert("RGBA")
    zone = (60, 150, 1020, 150 + 620) if v["text"] == "top" else (60, 930, 1020, 1330)
    if frect and v["text"] == "top":                         # keep the headline off the face: shrink the zone above it
        zone = (60, 150, 1020, max(380, min(zone[3], frect[1] - 25)))
    if frect and v["text"] == "low":
        zone = (60, max(zone[1], frect[3] + 25), 1020, 1330)
    bbox = draw_text(pil, words, acc, zone)
    d = ImageDraw.Draw(pil)
    if tag:
        tf = ImageFont.truetype(str(asset("fonts") / "Montserrat-ExtraBold.ttf"), 38)
        tw = int(tf.getlength(tag.upper())) + 56
        d.rounded_rectangle((60, 70, 60 + tw, 70 + 64), 32, fill=acc + (255,))
        d.text((60 + tw / 2, 70 + 33), tag.upper(), font=tf, fill=(10, 10, 14, 255), anchor="mm")
    info = {"variant": variant, "scale": round(s, 2), "face_h_frac": round((face[3] * s) / H, 2) if face else None,
            "text_bbox": bbox, "face_rect": frect, "upscale_soft": s > MAX_UP}
    info["text_on_face"] = bool(frect and not (bbox[2] < frect[0] or bbox[0] > frect[2] or bbox[3] < frect[1] or bbox[1] > frect[3]))
    return pil.convert("RGB"), info


def dhash(img: Image.Image, n: int = 16) -> np.ndarray:
    g = np.asarray(img.convert("L").resize((n + 1, n), Image.LANCZOS)).astype(np.int16)
    return (g[:, 1:] > g[:, :-1]).flatten()


def distinct(images: list[Image.Image], min_bits: int = 14) -> list[str]:
    """Problems when two covers look alike (dHash 16x16, hamming < min_bits)."""
    hs = [dhash(i) for i in images]
    out = []
    for i in range(len(hs)):
        for j in range(i + 1, len(hs)):
            b = int((hs[i] != hs[j]).sum())
            if b < min_bits:
                out.append(f"cover {i + 1} and {j + 1} look alike ({b} of 256 bits differ, need {min_bits})")
    return out
