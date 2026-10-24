"""Hand-off pack: per video -> video + title variants + ready description + generated cover.

`python tools/shorts.py pack pack.json --out ГОТОВО [--zip]`

pack.json = {"items": [{
   "slug": "gaidulyan-neizvestny", "video": "01-interview.mp4",
   "titles": [{"t": "Один неизвестный…", "why": "интрига"}, ... 3-8 variants], "recommended": 2,
   "description": "ready to paste, hashtags inside",     # one text (old format), or give `descriptions` below
   "descriptions": [{"tone": "loud", "psychology": "FOMO", "text": "..."}, {"tone": "medium", ...}, {"tone": "calm", ...}],   # exactly 3
   "recommended_description": "loud|medium|calm", "tiktok_caption": "optional", "pinned_comment": "optional",
   "credits": "Источник: ...", "notes": ["что проверить"], "ad": {"name": "Quattro VPN", "url": "https://t.me/..."},       # ad items need «Реклама» + URL
   "covers": [{"src": "frames.mp4", "t0": 1.0, "t1": 30.0, "text": "ОДИН *НЕИЗВЕСТНЫЙ*", "accent": "#FFD84D", "tag": "ИНТЕРВЬЮ",
               "tone": "loud"}, ... 3 covers loud -> calm]
}]}
With `descriptions` the item needs exactly 3 non-empty variants (loud, medium, calm); every variant of an ad item carries
«Реклама» and the exact link. A pack.json with only `description` still works (variants then give a warning).

Cover = best frame (face size x sharpness x exposure) cut around the face, blurred full-bleed background, big
text of at most four words in the top safe zone (`*word*` is highlighted). Text is drawn by code, never by a model.
Output tree contains only what the user publishes: <NN-slug>/{video, cover.png, НАЗВАНИЕ-И-ОПИСАНИЕ.txt} and
ВСЕ-ОПИСАНИЯ.txt. The text file lists titles, three description variants by tone, the recommended pick, the pinned
comment and the TikTok caption. Service data (frame scores, checks) goes to _служебное/ and is not zipped.
"""
from __future__ import annotations

import json
import re
import shutil
import zipfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .config import asset
from .meta.tones import TONES, loudness_of, tone_name, tone_of
from .util import ShortsError, ffprobe, hex_to_rgb, log
from . import variants as V

W, H = 1080, 1920
RIGHTS = "Права на исходные фильмы, интервью, стендап и музыку остаются у правообладателей; ответственность за публикацию лежит на публикующем."


# ------------------------------------------------------------------ frames

def _detector():
    model = asset("models") / "face_detection_yunet_2023mar.onnx"
    return cv2.FaceDetectorYN.create(str(model), "", (320, 320), 0.7, 0.3, 5000) if model.exists() else None


def detect_face(det, frame: np.ndarray):
    """Largest face as (x, y, w, h) in frame pixels, or None."""
    if det is None:
        return None
    h, w = frame.shape[:2]
    sc = 640 / w
    small = cv2.resize(frame, (640, int(h * sc)))
    det.setInputSize((small.shape[1], small.shape[0]))
    _, faces = det.detect(small)
    if faces is None or not len(faces):
        return None
    f = max(faces, key=lambda r: r[2] * r[3])
    return (f[0] / sc, f[1] / sc, f[2] / sc, f[3] / sc)


def pick_frame(src: Path, t0: float, t1: float, n: int = 28):
    """Best cover candidate in [t0, t1]: big sharp face, good exposure. Returns (frame, t, score table)."""
    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        raise ShortsError(f"cannot open {src}")
    det = _detector()
    table, best = [], None
    for i in range(n):
        t = t0 + (t1 - t0) * (i + 0.5) / n
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, fr = cap.read()
        if not ok:
            continue
        gray = cv2.cvtColor(cv2.resize(fr, (480, int(480 * fr.shape[0] / fr.shape[1]))), cv2.COLOR_BGR2GRAY)
        sharp = min(1.0, cv2.Laplacian(gray, cv2.CV_64F).var() / 250.0)
        mean = gray.mean()
        expo = 1.0 - min(1.0, abs(mean - 115) / 115)
        face = detect_face(det, fr)
        fa = min(0.12, (face[2] * face[3]) / (fr.shape[0] * fr.shape[1])) / 0.12 if face else 0.0
        if face and (face[0] < 0.03 * fr.shape[1] or face[0] + face[2] > 0.97 * fr.shape[1] or face[1] < 0.02 * fr.shape[0]):
            fa *= 0.25      # face cut by the frame edge makes a bad cover
        score = 3.0 * fa + 1.2 * sharp + 0.8 * expo
        table.append({"t": round(t, 2), "score": round(score, 3), "face": bool(face)})
        if best is None or score > best[0]:
            best = (score, fr.copy(), t, face)
    cap.release()
    if best is None:
        raise ShortsError(f"no readable frames in {src} between {t0} and {t1}")
    return best[1], best[2], best[3], table


# ------------------------------------------------------------------ cover

def _parse_marked(text: str):
    """'ОДИН *НЕИЗВЕСТНЫЙ*' -> [('ОДИН', False), ('НЕИЗВЕСТНЫЙ', True)]"""
    words = []
    for tok in text.split():
        words.append((tok.replace("*", ""), "*" in tok))
    return words


def _fit_text(words, accent, max_w=940, max_size=170, min_size=96, max_h=420):
    fp = str(asset("fonts") / "Montserrat-ExtraBold.ttf")
    for size in range(max_size, min_size - 1, -6):
        font = ImageFont.truetype(fp, size)
        lines, cur = [], []
        for w in words:
            trial = " ".join(x[0] for x in cur + [w])
            if cur and font.getlength(trial) > max_w:
                lines.append(cur)
                cur = []
            cur.append(w)
        lines.append(cur)
        if len(lines) <= 3 and len(lines) * size * 1.08 <= max_h and all(font.getlength(" ".join(x[0] for x in l)) <= max_w for l in lines):
            return font, lines, size
    raise ShortsError("cover text does not fit in three lines: shorten it to 4 words or fewer")


def make_cover(frame: np.ndarray, face, text: str, out: Path, accent="#FFD84D", tag: str | None = None) -> Path:
    words = _parse_marked(text)
    if len(words) > 5:
        raise ShortsError(f"cover text has {len(words)} words; 4 reads at 150 px, 5 is the limit")
    acc = hex_to_rgb(accent)
    sh, sw = frame.shape[:2]
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    # background: blurred cover-fit copy
    bg = cv2.resize(rgb, (54, 96), interpolation=cv2.INTER_AREA)
    bg = cv2.GaussianBlur(bg, (0, 0), 2)
    bg = cv2.resize(bg, (W, H), interpolation=cv2.INTER_CUBIC)
    canvas = (bg.astype(np.float32) * 0.45)
    # foreground crop around the face (4:5)
    fw, fh = W, 1250
    if face:
        fx, fy, bw, bh = face
        cx, cy = fx + bw / 2, fy + bh / 2
        ch = float(np.clip(bh * 3.6, 0.5 * sh, sh))
    else:
        cx, cy = sw / 2, sh * 0.45
        ch = float(sh)
    cw = ch * fw / fh
    if cw > sw:
        cw, ch = sw, sw * fh / fw
    x0 = int(min(max(cx - cw / 2, 0), sw - cw))
    y0 = int(min(max(cy - ch * 0.38, 0), sh - ch))
    fg = cv2.resize(rgb[y0:y0 + int(ch), x0:x0 + int(cw)], (fw, fh), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    top = 600
    mask = np.ones((fh, 1, 1), np.float32)
    mask[:170] = np.linspace(0, 1, 170, dtype=np.float32)[:, None, None] ** 1.5
    mask[-130:] = np.linspace(1, 0, 130, dtype=np.float32)[:, None, None]
    canvas[top:top + fh] = canvas[top:top + fh] * (1 - mask) + fg * mask
    # dark gradient under the text
    grad = np.clip(1 - np.arange(H, dtype=np.float32) / 760, 0, 1)[:, None, None] ** 1.2 * 0.72
    canvas = canvas * (1 - grad)
    img = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    d = ImageDraw.Draw(img)
    font, lines, size = _fit_text(words, acc)
    lh = int(size * 1.08)
    block = lh * len(lines)
    y = 250
    for line in lines:
        total = sum(font.getlength(w[0]) for w in line) + font.getlength(" ") * (len(line) - 1)
        x = (W - total) / 2
        for w, hl in line:
            d.text((x, y), w, font=font, fill=(acc if hl else (255, 255, 255)) + (255,), stroke_width=max(8, size // 11), stroke_fill=(0, 0, 0, 255))
            x += font.getlength(w) + font.getlength(" ")
        y += lh
    bar = y - lh + int(size * 1.14) + 10
    d.rounded_rectangle(((W - 240) / 2, bar, (W + 240) / 2, bar + 14), 7, fill=acc + (255,))
    if tag:
        ft = ImageFont.truetype(str(asset("fonts") / "Manrope-Bold.ttf"), 44)
        tw = int(ft.getlength(tag)) + 56
        d.rounded_rectangle(((W - tw) / 2, 120, (W + tw) / 2, 196), 38, fill=acc + (255,))
        d.text((W / 2, 158), tag, font=ft, fill=(10, 10, 14, 255), anchor="mm")
    out.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out, quality=95)
    return out


# ------------------------------------------------------------------ pack

def _check_video(p: Path) -> dict:
    info = ffprobe(p)
    v = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    a = any(s["codec_type"] == "audio" for s in info["streams"])
    dur = float(info["format"]["duration"])
    errs = []
    if not v or (int(v["width"]), int(v["height"])) != (W, H):
        errs.append(f"{p.name}: size must be 1080x1920")
    if not a:
        errs.append(f"{p.name}: no audio track")
    if dur > 180:
        errs.append(f"{p.name}: longer than 180 s")
    return {"errors": errs, "duration": round(dur, 2)}


def _title_tone(t: dict) -> str:
    return tone_name(t.get("tone")) or (tone_of(loudness_of(t["loudness"])) if t.get("loudness") else "")


def _validate_item(it: dict, vinfo: dict, warns: list[str] | None = None) -> list[str]:
    warns = warns if warns is not None else []
    errs = list(vinfo["errors"])
    slug = it.get("slug")
    titles = it.get("titles") or []
    if len(titles) < 3:
        errs.append(f"{slug}: need at least 3 title variants (5-7 recommended)")
    elif not 5 <= len(titles) <= 7:
        warns.append(f"{slug}: {len(titles)} titles, 5-7 recommended")
    for t in titles:
        if len(t["t"]) > 100:
            errs.append(f"{slug}: title over 100 chars: {t['t'][:40]}…")
    tones = {_title_tone(t) for t in titles}
    if "" not in tones and len(titles) >= 3 and tones != set(TONES):
        warns.append(f"{slug}: titles do not cover loud, medium and calm")
    variants, e, w = V.check_descriptions(it, f"{slug}", ru=False)
    errs += e
    warns += w
    desc = it.get("description") or ""
    if not desc.strip() and variants is None and it.get("descriptions") is None:
        errs.append(f"{slug}: description is empty")
    if len(desc) > 4900:
        errs.append(f"{slug}: description over 5000 chars")
    ad = it.get("ad")
    if ad and desc.strip():
        if "реклама" not in desc.lower():
            errs.append(f"{slug}: ad item: description must contain the word «Реклама»")
        if ad.get("url") and ad["url"] not in desc:
            errs.append(f"{slug}: ad item: description must contain the exact link {ad['url']}")
    if not it.get("covers"):
        errs.append(f"{slug}: no cover spec")
    elif variants is not None and len(it["covers"]) != 3:
        warns.append(f"{slug}: {len(it['covers'])} covers, 3 recommended (loud, medium, calm)")
    rec = int(it.get("recommended", 1))
    if not 1 <= rec <= max(len(titles), 1):
        errs.append(f"{slug}: 'recommended' must be a title number 1..{len(titles)}")
    return errs


def _card_text(it: dict, idx: int, cover_names: list[str], dur: float) -> str:
    rec = int(it.get("recommended", 1))
    variants, _, _ = V.check_descriptions(it, "")
    rec_tone = V.recommended_tone(it, variants) if variants else ""
    lines = [f"ВИДЕО {idx:02d}: {it.get('name') or it['slug']}", f"Длительность: {dur:.0f} с  |  Формат 1080×1920", ""]
    lines.append(f"НАЗВАНИЯ ({len(it['titles'])}): от громкого к спокойному, выбери одно (рекомендую №{rec})")
    for i, t in enumerate(it["titles"], 1):
        star = "  ★" if i == rec else ""
        why = f"  - {t['why']}" if t.get("why") else ""
        tone = _title_tone(t)
        lab = f"[{V.LABEL_RU[tone].lower()}] " if tone else ""
        lines.append(f"{i}. {lab}{t['t']}{star}{why}  [{len(t['t'])} зн.]")
    lines.append("")
    if variants:
        lines += [f"ОПИСАНИЯ: три варианта, от громкого к спокойному (рекомендую: {V.LABEL_RU[rec_tone].lower()}). Копируй один целиком", ""]
        lines += V.variant_lines(variants, rec_tone)
    else:
        lines += ["ОПИСАНИЕ - копируй целиком", "-" * 40, it["description"].strip(), "-" * 40]
    if it.get("pinned_comment"):
        lines += ["", "ЗАКРЕПЛЁННЫЙ КОММЕНТАРИЙ", it["pinned_comment"].strip()]
    rec_title = it["titles"][rec - 1]["t"] if 1 <= rec <= len(it["titles"]) else ""
    lines += ["", "TIKTOK (подпись)", V.tiktok_caption(it, rec_title, V.recommended_text(it, variants))]
    labelled = []
    for n, c in zip(cover_names, it["covers"]):
        tone = tone_name(c.get("tone"))
        labelled.append(f"{n} ({V.LABEL_RU[tone].lower()})" if tone else n)
    lines += ["", "ОБЛОЖКИ: " + ", ".join(labelled) + "  (Studio → Shorts → «Миниатюра» → загрузить файл)"]
    if it.get("credits"):
        lines += ["", it["credits"]]
    if it.get("notes"):
        lines += ["", "ПЕРЕД ПУБЛИКАЦИЕЙ"] + [f"- {n}" for n in it["notes"]]
    lines += ["", RIGHTS]
    return "\n".join(lines) + "\n"


def pack(spec_path: Path, out_dir: Path, make_zip: bool = False) -> dict:
    spec = json.loads(Path(spec_path).read_text(encoding="utf-8"))
    base = Path(spec_path).resolve().parent
    items = spec["items"]
    res = lambda p: (Path(p) if Path(p).is_absolute() else base / p)
    errors, infos, warnings = [], [], []
    for it in items:
        v = res(it["video"])
        if not v.exists():
            errors.append(f"{it.get('slug')}: video missing {v}")
            infos.append(None)
            continue
        vi = _check_video(v)
        infos.append(vi)
        errors += _validate_item(it, vi, warnings)
    if errors:
        raise ShortsError("pack blocked:\n- " + "\n- ".join(errors))
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    service = out_dir / "_служебное"
    service.mkdir()
    allt = []
    for n, (it, vi) in enumerate(zip(items, infos), 1):
        folder = out_dir / f"{n:02d}-{it['slug']}"
        folder.mkdir()
        shutil.copy2(res(it["video"]), folder / f"{it['slug']}.mp4")
        names, scores = [], []
        for ci, c in enumerate(it["covers"], 1):
            src = res(c.get("src") or it["video"])
            if "t" in c:
                cap = cv2.VideoCapture(str(src))
                cap.set(cv2.CAP_PROP_POS_MSEC, float(c["t"]) * 1000)
                ok, fr = cap.read()
                cap.release()
                if not ok:
                    raise ShortsError(f"cannot read frame {c['t']} s of {src}")
                face, t, table = detect_face(_detector(), fr), float(c["t"]), []
            else:
                fr, t, face, table = pick_frame(src, float(c.get("t0", 0.5)), float(c.get("t1", vi["duration"] - 0.5)))
            name = "cover.png" if ci == 1 else f"cover-{ci}.png"
            make_cover(fr, face, c["text"], folder / name, c.get("accent", "#FFD84D"), c.get("tag"))
            names.append(name)
            scores.append({"cover": name, "frame_t": round(t, 2), "face": bool(face), "table": table})
        (service / f"{n:02d}-{it['slug']}.json").write_text(json.dumps({"covers": scores, "video": vi}, ensure_ascii=False, indent=1), encoding="utf-8")
        txt = _card_text(it, n, names, vi["duration"])
        (folder / "НАЗВАНИЕ-И-ОПИСАНИЕ.txt").write_text(txt, encoding="utf-8")
        allt.append(txt)
    (out_dir / "ВСЕ-ОПИСАНИЯ.txt").write_text(("\n" + "=" * 60 + "\n\n").join(allt), encoding="utf-8")
    result = {"out": str(out_dir), "items": len(items), "warnings": warnings}
    if make_zip:
        zp = out_dir.with_suffix(".zip")
        with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
            for f in sorted(out_dir.rglob("*")):
                if f.is_file() and "_служебное" not in f.parts:
                    z.write(f, f.relative_to(out_dir.parent))
        result["zip"] = str(zp)
    return result
