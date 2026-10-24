#!/usr/bin/env python3
"""SHORTS: one entry point for the agent.

  python3 tools/shorts.py ad-init DIR                 create ad draft and templates (no overwrite)
  python3 tools/shorts.py ad-check DIR --stage launch   check declared evidence and final file hash
  python3 tools/shorts.py ad-render DIR [--ratios 9x16 1x1] [--platforms youtube_shorts]   static banners + layout report
  python3 tools/shorts.py ad-overlay overlay.json --out DIR [--mov]      transparent ad overlay (WebM alpha / ProRes 4444)
  python3 tools/shorts.py deliver deliver.json --out ГОТОВО [--zip]      clean hand-off: NN-name.mp4 + ОПИСАНИЯ.txt
  python3 tools/shorts.py ad-seal DIR --artifact banners/banner-9x16.png   record final file path + sha256 (approves nothing)
  python3 tools/shorts.py ad-links DIR --ids a,b,c [--signed]            one tagged link per creative (links.csv / links.md)
  python3 tools/shorts.py ad-metrics FILE.json [--log DIR]               money and funnel arithmetic + decision hint
  python3 tools/shorts.py paid status|reset                              paid-API budget ledger (estimates, not billing)
  python3 tools/shorts.py doctor                       what is installed, which TTS / image generator works
  python3 tools/shorts.py prefs show|set k=v|skip k|done k|reset|remind|history
  python3 tools/shorts.py intake [--lang ru]           the first-run questions (only what is missing in prefs)
  python3 tools/shorts.py validate plan.json           schema + rule lint
  python3 tools/shorts.py plan --from prefs --source site --ref URL ... -o plan.json   plan skeleton
  python3 tools/shorts.py render plan.json --out DIR   build the video (public interface)
  python3 tools/shorts.py qa DIR                       QA gate, writes qa.json / qa.md / contact sheet (public interface)
  python3 tools/shorts.py meta DIR [--topic ...]       titles x5-7, one description, pinned comment, TikTok caption
  python3 tools/shorts.py cover DIR [--image file]     cover: 3 variants or a ready prompt
  python3 tools/shorts.py site-probe URL               check a site (protection, screenshot, clickable elements)
  python3 tools/shorts.py yt-search "query" | yt-meta URL | moments URL | beats FILE|URL
  python3 tools/shorts.py film-lines URL [--grep WORD]                    dialogue lines of a film (pick the opening line)
  python3 tools/shorts.py edit --video URL --line "phrase" --link t.me/NAME -o DIR/plan.json
                                                       film edit: line -> drop -> hero shots (records media to DIR/media)
  python3 tools/shorts.py edit --classic --video URL ...  old beat-cut edit without a line (1.1)
  python3 tools/shorts.py edit ... --bars --bw-drop --layer thesis:"idea" --layer sound_design:"drop"
                                                       1.3: cinema bars + b/w line, both open on the drop
  python3 tools/shorts.py clips --video FILE|URL -o plan.json            cut a long video into shorts plans
  python3 tools/shorts.py package DIR                 plain-text handoff: ПАКЕТ.txt
  python3 tools/shorts.py all plan.json --out DIR      render + meta + cover + qa (exit code = QA result)
  python3 tools/shorts.py review DIR --saw "..."       record what the agent saw on the contact sheet (QA item 13)
  python3 tools/shorts.py bg list | fetch ID | add ID FILE --credit "..."   background motion (gameplay) for bg:<id>
  python3 tools/shorts.py anim-init NAME [--root DIR]   animation episode skeleton episodes/NAME/ (no overwrite)
  python3 tools/shorts.py anim-pick [--seed N] [--n 3]   suggest disaster + place pairs from the 50 + 50 lists
  python3 tools/shorts.py anim-check DIR [--stage script|full]   offline episode check (pace, shotlist, schemes, 3D share, words.json)
Exit codes: 0 ok, 1 QA failed / plan errors, 2 usage or runtime error.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from shortskit.util import ShortsError, read_json, write_json  # noqa: E402


def _print(obj) -> None:
    print(json.dumps(obj, ensure_ascii=False, indent=2) if not isinstance(obj, str) else obj)


def cmd_bg(a) -> int:
    """Background motion library: list | fetch ID [--force] | add ID FILE [--credit TEXT]."""
    from shortskit import bglib as BG

    if a.action == "list":
        _print(BG.describe())
        return 0
    if not a.id:
        raise ShortsError(f"bg {a.action} needs an id (shorts.py bg list)")
    if a.action == "fetch":
        p = BG.fetch(a.id, force=a.force)
    else:
        if not a.file:
            raise ShortsError("bg add ID FILE: the file is missing")
        BG.add(a.id, a.file, credit=a.credit or "")
        p = BG.cache_path(a.id)
    side = p.with_suffix(".json")
    meta = json.loads(side.read_text(encoding="utf-8")) if side.exists() else {}
    print(f"bg:{a.id} -> {p}")
    print(f"motion: {meta.get('motion')}  credit: {meta.get('credit') or '-'}")
    return 0


def cmd_validate(a) -> int:
    from shortskit import plan as P

    raw, d = P.load(a.plan)
    issues = P.check(raw, d, allow_missing_media=getattr(a, "allow_missing_media", False))
    for i in issues:
        print(i)
    n = len(P.errors(issues))
    print(f"{'OK' if n == 0 else 'FAIL'}: {n} errors, {len(issues) - n} warnings")
    return 1 if n else 0


def cmd_render(a) -> int:
    from shortskit.engine.render import render

    m = render(a.plan, a.out, force=a.force, keep_work=a.keep_work)
    skipped = [f"{s['id']}: {s['skipped']}" for s in m["scenes"] if s["skipped"]]
    print(f"video: {Path(a.out) / m['video']}  ({m['duration']}s, render {m['render_seconds']}s)")
    for s in skipped:
        print(f"skipped scene {s}")
    for s in m["scenes"]:
        for n in s["notes"]:
            print(f"note [{s['id']}]: {n}")
    return 0


def cmd_qa(a) -> int:
    from shortskit.qa.gate import run_gate

    rep = run_gate(Path(a.dir), strict=a.strict)
    print(Path(a.dir) / "qa.md")
    print(rep["summary"])
    _refresh_package(Path(a.dir))
    return 0 if rep["passed"] else 1


def cmd_meta(a) -> int:
    from shortskit.meta.packaging import package_dir

    res = package_dir(Path(a.dir), topic=a.topic, hashtags=a.hashtags, cta=a.cta)
    print((Path(a.dir) / "metadata.md").read_text(encoding="utf-8"))
    return 0 if res["ok"] else 1


def cmd_cover(a) -> int:
    from shortskit.meta.cover import cover_dir

    res = cover_dir(Path(a.dir), image=a.image, text=a.text, generate=not a.no_generate)
    _print(res)
    return 0


def _refresh_package(d: Path) -> None:
    from shortskit.meta.user_package import refresh_if_exists
    refresh_if_exists(d)


def cmd_package(a) -> int:
    from shortskit.meta.user_package import write_package

    print(write_package(Path(a.dir), lang=getattr(a, "lang", None)))
    return 0


def cmd_all(a) -> int:
    """render + meta + cover + qa. Exit code = QA result (0 = QA PASSED), as for `qa`.
    Problems in meta or cover (e.g. "weak silhouette") are printed as WARN and saved in DIR/all.json:
    they are packaging advice, not a broken video."""
    rc = cmd_render(a)
    if rc:
        return rc
    warns: list[str] = []
    try:
        if cmd_meta(argparse.Namespace(dir=a.out, topic=None, hashtags=None, cta=None)):
            warns.append("meta: metadata has problems, see metadata.md")
    except Exception as e:  # packaging must not hide the QA result
        warns.append(f"meta: {e}")
    try:
        from shortskit.meta.cover import cover_dir

        res = cover_dir(Path(a.out), image=None, text=None, generate=True)
        _print(res)
        warns += [f"cover: {e}" for e in res.get("errors", [])]
    except Exception as e:
        warns.append(f"cover: {e}")
    a.dir, a.strict = a.out, False
    rc = cmd_qa(a)
    try:
        cmd_package(argparse.Namespace(dir=a.out, lang=None))
    except Exception as e:
        warns.append(f"package: {e}")
    for w in warns:
        print(f"WARN {w}")
    write_json(Path(a.out) / "all.json", {"exit_code": rc, "qa_passed": rc == 0, "warnings": warns})
    print(f"all: {'QA PASSED' if rc == 0 else 'QA FAILED'}, {len(warns)} warnings (exit {rc})")
    return rc


def cmd_review(a) -> int:
    from shortskit.qa.review import record_review

    res = record_review(Path(a.dir), a.saw, silent=a.silent)
    print(res["file"])
    _refresh_package(Path(a.dir))
    return 0


def cmd_prefs(a) -> int:
    from shortskit import memory as M

    if a.action == "show":
        _print(M.load())
    elif a.action == "set":
        for kv in a.items:
            k, _, v = kv.partition("=")
            M.set_value(k, M.parse_value(v))
        _print(M.load())
    elif a.action == "remember":
        for kv in a.items:
            k, sep, v = kv.partition("=")
            if not sep or k not in ("chosen_title", "rejected"):
                raise ValueError("use prefs remember chosen_title=... or rejected=...")
            M.remember_choice(k, M.parse_value(v))
        print("Выбор сохранён.")
    elif a.action == "skip":
        for k in a.items:
            M.skip(k)
        _print(M.load()["pending"])
    elif a.action == "done":
        for k in a.items:
            M.close_pending(k)
        _print(M.load()["pending"])
    elif a.action == "reset":
        M.reset()
        print("prefs cleared")
    elif a.action == "remind":
        print(M.reminder_line(M.load()) or "")
    elif a.action == "history":
        _print(M.history())
    elif a.action == "summary":
        print(M.summary_line(M.load()))
    return 0


def cmd_intake(a) -> int:
    from shortskit import memory as M

    print(M.intake_message(M.load(), a.lang))
    return 0


def cmd_plan(a) -> int:
    from shortskit.planner import skeleton

    p = skeleton(source=a.source, refs=a.ref or [], name=a.name, topic=a.topic or "")
    Path(a.output).write_text(json.dumps(p, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(a.output)
    return 0


def cmd_doctor(a) -> int:
    from shortskit.doctor import doctor

    rep = doctor(deep=getattr(a, "deep", False))
    _print(rep)
    return 0 if rep["ok"] else 2


def cmd_site_probe(a) -> int:
    import asyncio

    from shortskit.adapters.site import probe

    _print(asyncio.run(probe(a.url, Path(a.out))))
    return 0


def cmd_yt_search(a) -> int:
    from shortskit.adapters.media import search

    _print(search(a.query, a.n))
    return 0


def cmd_yt_meta(a) -> int:
    from shortskit.adapters.media import video_meta

    m = video_meta(a.url)
    m.pop("heatmap", None) if not a.heatmap else None
    _print(m)
    return 0


def _heatmap(path: str | None) -> list[dict] | None:
    if not path:
        return None
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return data.get("heatmap") if isinstance(data, dict) else data


def cmd_moments(a) -> int:
    from shortskit.adapters.film import find_moments

    _print(find_moments(a.url, n=a.n, min_len=a.min_len, max_len=a.max_len, deep=a.deep, heatmap=_heatmap(a.heatmap)))
    return 0


def cmd_beats(a) -> int:
    from shortskit.adapters.film import music_beats

    b = music_beats(a.src)
    b.pop("energy", None)
    _print(b)
    return 0


def cmd_edit(a) -> int:
    out = Path(a.output)
    if a.classic or not (a.line or a.line_at):
        if not a.classic:
            print("note: no --line/--line-at: the classic beat-cut edit (1.1). An edit with a line from the film "
                  "is stronger: see `film-lines URL`", file=sys.stderr)
        from shortskit.adapters.film import edit_plan

        p = edit_plan(video=a.video, music=a.music, length=a.length or 24.0, name=a.name, title=a.title, lang=a.lang,
                      n=a.n, query=a.query, links=a.link or None, handle=a.handle or "", brand=a.brand,
                      platforms=a.platforms, heatmap=_heatmap(a.heatmap))
    else:
        from shortskit.adapters import edit2

        if not a.video:
            raise ShortsError("give --video URL or file")
        at = None
        if a.line_at:
            x, y = a.line_at.replace(",", ".").split("-", 1)
            at = (float(x), float(y))
        link = (a.link or [None])[0]
        p = edit2.edit_plan(a.video, out.parent.resolve(), line=a.line, line_at=at, line_text=a.line_text,
                            music=a.music, length=a.length or 18.0, link=link, handle=a.handle, name=a.name,
                            lang=a.lang, platforms=a.platforms, brand=a.brand, look=a.look, title=a.title,
                            whisper=a.whisper)
    if a.bars or a.bw_drop or a.layer:
        from shortskit.engine import vfx as VX

        try:
            for n in VX.edit_cinema(p, bars=a.bars, bw=a.bw_drop, layers=VX.parse_layers(a.layer)):
                print(f"note: {n}", file=sys.stderr)
        except ValueError as e:
            raise ShortsError(str(e)) from e
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(p, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(out)
    return 0


def cmd_film_lines(a) -> int:
    import re as _re

    from shortskit.adapters import edit2

    lines = edit2.film_lines(a.url, a.lang)
    for x in lines:
        if a.grep and not _re.search(a.grep, x["text"], _re.I):
            continue
        if a.around is not None and abs(x["start"] - a.around) > 30:
            continue
        print(f"{x['start']:8.1f}  {x['text']}")
    return 0


def cmd_clips(a) -> int:
    from shortskit.adapters.film import clips_plans

    files = clips_plans(video=a.video, out_dir=Path(a.output), n=a.n, length=a.length, lang=a.lang,
                        transcript=a.transcript, brand=a.brand, platforms=a.platforms)
    _print([str(f) for f in files])
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="shorts", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-v", "--verbose", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("validate"); s.add_argument("plan")
    s.add_argument("--allow-missing-media", action="store_true",
                   help="missing local media files are warnings, not errors (example plans: media is not in git)")
    s.set_defaults(fn=cmd_validate)
    for name, fn in (("render", cmd_render), ("all", cmd_all)):
        s = sub.add_parser(name); s.add_argument("plan"); s.add_argument("--out", required=True)
        s.add_argument("--force", action="store_true", help="render even if the plan has errors (QA will fail)")
        s.add_argument("--keep-work", action="store_true"); s.set_defaults(fn=fn)
    s = sub.add_parser("qa"); s.add_argument("dir"); s.add_argument("--strict", action="store_true"); s.set_defaults(fn=cmd_qa)
    s = sub.add_parser("bg", help="background motion library for the top banner / split (bg:<id>)")
    s.add_argument("action", choices=["list", "fetch", "add"]); s.add_argument("id", nargs="?"); s.add_argument("file", nargs="?")
    s.add_argument("--force", action="store_true", help="fetch again"); s.add_argument("--credit", help="author for the description")
    s.set_defaults(fn=cmd_bg)
    s = sub.add_parser("meta"); s.add_argument("dir"); s.add_argument("--topic"); s.add_argument("--hashtags", nargs="*")
    s.add_argument("--cta"); s.set_defaults(fn=cmd_meta)
    s = sub.add_parser("cover"); s.add_argument("dir"); s.add_argument("--image"); s.add_argument("--text")
    s.add_argument("--no-generate", action="store_true"); s.set_defaults(fn=cmd_cover)
    s = sub.add_parser("package", help="write one plain-text publishing handoff")
    s.add_argument("dir"); s.add_argument("--lang", choices=["ru", "en"]); s.set_defaults(fn=cmd_package)
    s = sub.add_parser("review"); s.add_argument("dir"); s.add_argument("--saw", required=True,
                                                                  help="what you saw on contact-*.png and qa-frames/, in your words")
    s.add_argument("--silent", default="", help="retell without sound (QA item 14)"); s.set_defaults(fn=cmd_review)
    s = sub.add_parser("prefs"); s.add_argument("action", choices=["show", "set", "skip", "done", "reset", "remind", "history", "summary", "remember"])
    s.add_argument("items", nargs="*"); s.set_defaults(fn=cmd_prefs)
    s = sub.add_parser("intake"); s.add_argument("--lang", default=None); s.set_defaults(fn=cmd_intake)
    s = sub.add_parser("plan"); s.add_argument("--source", required=True, choices=["site", "html", "video", "film", "text", "images"])
    s.add_argument("--ref", nargs="*"); s.add_argument("--name", default="short"); s.add_argument("--topic")
    s.add_argument("-o", "--output", default="plan.json"); s.set_defaults(fn=cmd_plan)
    s = sub.add_parser("doctor"); s.add_argument("--deep", action="store_true", help="run piper + faster-whisper now")
    s.set_defaults(fn=cmd_doctor)
    s = sub.add_parser("site-probe"); s.add_argument("url"); s.add_argument("--out", default="out/probe"); s.set_defaults(fn=cmd_site_probe)
    s = sub.add_parser("yt-search"); s.add_argument("query"); s.add_argument("-n", type=int, default=10); s.set_defaults(fn=cmd_yt_search)
    s = sub.add_parser("yt-meta"); s.add_argument("url"); s.add_argument("--heatmap", action="store_true"); s.set_defaults(fn=cmd_yt_meta)
    s = sub.add_parser("moments"); s.add_argument("url"); s.add_argument("-n", type=int, default=10)
    s.add_argument("--min-len", type=float, default=2.5); s.add_argument("--max-len", type=float, default=6.0)
    s.add_argument("--deep", action="store_true", help="also download a low-res copy for loudness and scene cuts")
    s.add_argument("--heatmap", help="heatmap json ([{start_time,end_time,value}] or yt-dlp info json) for a local file")
    s.set_defaults(fn=cmd_moments)
    s = sub.add_parser("beats"); s.add_argument("src"); s.set_defaults(fn=cmd_beats)
    s = sub.add_parser("edit"); s.add_argument("--video"); s.add_argument("--query"); s.add_argument("--music", help="file or URL (default: assets/audio/edit.mp3, own CC0 track with a drop; classic: bed.mp3)")
    s.add_argument("--line", help="opening dialogue line (a phrase from the film, found in the transcript)")
    s.add_argument("--line-at", help="opening line by time: A-B seconds of the film")
    s.add_argument("--line-text", help="subtitle text of the line (if the recognised text is wrong)")
    s.add_argument("--look", default="film", choices=["film", "cold", "punchy", "bw", "none"])
    s.add_argument("--whisper", default="small", help="faster-whisper model for the line (tiny/base/small/medium)")
    s.add_argument("--classic", action="store_true", help="1.1 beat-cut edit without a line")
    s.add_argument("--length", type=float, default=None, help="seconds (default 18; classic 24)"); s.add_argument("--name", default="film-edit")
    s.add_argument("--title", default=""); s.add_argument("--lang", default="ru"); s.add_argument("-n", type=int, default=10)
    s.add_argument("--handle"); s.add_argument("--link", nargs="*"); s.add_argument("--brand", default="mono")
    s.add_argument("--platforms", nargs="*", default=["youtube_shorts"])
    s.add_argument("--heatmap", help="heatmap json for a local file (YouTube heatmap is read automatically for URLs)")
    s.add_argument("--bars", action="store_true", help="1.3: cinema bars on the line, they open on the drop (research 14.4)")
    s.add_argument("--bw-drop", action="store_true", help="1.3: the line in black and white, colour comes back on the drop (14.6)")
    s.add_argument("--layer", action="append", metavar="KIND:NOTE",
                   help="1.3 author layer (repeat): voice|thesis|own_footage|compare|text_point|sound_design|interactive")
    s.add_argument("-o", "--output", default="plan.json"); s.set_defaults(fn=cmd_edit)
    s = sub.add_parser("film-lines"); s.add_argument("url"); s.add_argument("--grep"); s.add_argument("--around", type=float)
    s.add_argument("--lang", default="ru"); s.set_defaults(fn=cmd_film_lines)
    s = sub.add_parser("clips"); s.add_argument("--video", required=True); s.add_argument("-n", type=int, default=3)
    s.add_argument("--length", type=float, default=30.0); s.add_argument("--lang", default="ru")
    s.add_argument("--transcript", help="words json [{w,s,e}] (from whisper); without it moments come from loudness and cuts")
    s.add_argument("--brand", default="mono"); s.add_argument("--platforms", nargs="*", default=["youtube_shorts"])
    s.add_argument("-o", "--output", default="out/clips"); s.set_defaults(fn=cmd_clips)

    s = sub.add_parser("ad-init", help="create advertising draft and templates; never overwrite")
    s.add_argument("dir")
    def ad_init(a):
        from shortskit.advertising import initialize
        _print(initialize(a.dir))
        return 0
    s.set_defaults(fn=ad_init)
    s = sub.add_parser("ad-check", help="offline advertising evidence gate; not external verification")
    s.add_argument("dir")
    s.add_argument("--stage", choices=["draft", "launch"], default="draft")
    s.add_argument("--today", help="YYYY-MM-DD for freshness checks (default: system date)")
    def ad_check(a):
        from shortskit.advertising import audit
        rep = audit(a.dir, a.stage, a.today)
        if Path(a.dir).is_dir():
            write_json(Path(a.dir) / ("ad-qa-" + a.stage + ".json"), rep)
            write_json(Path(a.dir) / "ad-qa.json", rep)  # latest, retained for compatibility
        _print(rep)
        return 0 if rep["valid"] else 1
    s.set_defaults(fn=ad_check)

    s = sub.add_parser("ad-render", help="render static banners from campaign.json (layout checks only)")
    s.add_argument("dir")
    s.add_argument("--ratios", nargs="*", default=["9x16"])
    s.add_argument("--platforms", nargs="*", default=["youtube_shorts"])
    s.add_argument("--out")
    def ad_render(a):
        from shortskit.adrender import render
        rep = render(a.dir, tuple(a.ratios), tuple(a.platforms), a.out)
        _print(rep)
        return 0 if rep["ok"] else 1
    s.set_defaults(fn=ad_render)
    s = sub.add_parser("ad-overlay", help="transparent 1080x1920 ad overlay (webm alpha, --mov ProRes 4444) for CapCut/Premiere")
    s.add_argument("spec"); s.add_argument("--out", required=True); s.add_argument("--mov", action="store_true")
    def ad_overlay(a):
        from shortskit.adoverlay import render
        _print(render(a.spec, a.out, a.mov))
        return 0
    s.set_defaults(fn=ad_overlay)
    s = sub.add_parser("deliver", help="clean hand-off folder: NN-title.mp4 + ОПИСАНИЯ.txt, service files hidden")
    s.add_argument("spec"); s.add_argument("--out", default="ГОТОВО"); s.add_argument("--zip", action="store_true")
    s.add_argument("--with-service", action="store_true")
    def deliver_cmd(a):
        from shortskit.deliver import deliver
        rep = deliver(a.spec, a.out, a.zip, a.with_service)
        _print(rep)
        return 0 if rep["ok"] else 1
    s.set_defaults(fn=deliver_cmd)
    s = sub.add_parser("ad-seal", help="record final_artifact path and sha256 in campaign.json; approves nothing")
    s.add_argument("dir")
    s.add_argument("--artifact", required=True)
    def ad_seal(a):
        from shortskit.adrender import seal
        _print(seal(a.dir, a.artifact))
        return 0
    s.set_defaults(fn=ad_seal)
    s = sub.add_parser("ad-links", help="build one tagged link per creative id")
    s.add_argument("dir")
    s.add_argument("--ids", required=True, help="comma separated creative ids")
    s.add_argument("--source", default="youtube_shorts")
    s.add_argument("--medium", default="organic_video")
    s.add_argument("--campaign")
    s.add_argument("--signed", action="store_true", help="destination is a signed or partner link: do not modify it")
    s.add_argument("--subid-param", help="partner tracking parameter name from the offer terms")
    s.add_argument("--shared-profile-link", action="store_true", help="one link in the profile for all creatives")
    def ad_links(a):
        from shortskit import adlinks
        cp = Path(a.dir) / "campaign.json"
        try:
            c = json.loads(cp.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise ShortsError("campaign.json missing or invalid: " + str(exc)) from exc
        ids = [x.strip() for x in a.ids.split(",") if x.strip()]
        plan = adlinks.build(c.get("destination"), ids, a.campaign or c.get("concept") or "campaign", a.source, a.medium,
                             a.signed, a.subid_param, a.shared_profile_link)
        plan["files"] = adlinks.write(a.dir, plan)
        _print(plan)
        return 0
    s.set_defaults(fn=ad_links)
    s = sub.add_parser("ad-metrics", help="money and funnel metrics from numbers you supply")
    s.add_argument("file")
    s.add_argument("--log", help="directory: append the result to experiments.jsonl")
    def ad_metrics(a):
        from shortskit import admetrics
        try:
            data = json.loads(Path(a.file).read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise ShortsError("metrics file missing or invalid: " + str(exc)) from exc
        res = admetrics.run(data)
        if a.log:
            res["logged_to"] = admetrics.append_log(a.log, {"input": data, "result": res})
        _print(res)
        return 0
    s.set_defaults(fn=ad_metrics)
    s = sub.add_parser("paid", help="paid-API budget ledger")
    s.add_argument("action", choices=["status", "reset"])
    def paid(a):
        from shortskit import costs
        _print(costs.status() if a.action == "status" else costs.reset_ledger())
        return 0
    s.set_defaults(fn=paid)

    s = sub.add_parser("release-check", help="honest publication gate; requires release.json")
    s.add_argument("dir")
    def release_check(a):
        from shortskit.release import audit
        rep = audit(a.dir)
        write_json(Path(a.dir) / "release-qa.json", rep)
        _print(rep)
        return 0 if rep["ready"] else 1
    s.set_defaults(fn=release_check)
    s = sub.add_parser("fetch", help="get source videos/music: yt-dlp ladder, never stops at the first error")
    s.add_argument("url", nargs="*"); s.add_argument("--section", help="START-END, seconds or H:MM:SS (only this piece is downloaded)")
    s.add_argument("--audio", action="store_true"); s.add_argument("--out", default="sources"); s.add_argument("--name")
    s.add_argument("--max-height", type=int, default=1080); s.add_argument("--list", help="JSON list of {url,name,section,audio}")
    s.add_argument("--probe", action="store_true", help="only print title/channel/duration of each URL")
    def fetch_cmd(a):
        from shortskit import fetch as F
        if a.probe:
            for u in a.url:
                _print(F.probe(u))
            return 0
        items = json.loads(Path(a.list).read_text(encoding="utf-8")) if a.list else [
            {"url": u, "name": (a.name if len(a.url) == 1 and a.name else None), "section": a.section, "audio": a.audio, "max_height": a.max_height} for u in a.url]
        if not items:
            raise ShortsError("give URLs or --list")
        st = F.fetch_many(items, Path(a.out))
        for r in st["results"]:
            if r["ok"]:
                print(f"OK   {r['name']}: {r['path']}")
            else:
                print(f"FAIL {r['name']}: {r['url']}\n     tried: " + ", ".join(x["step"] for x in r["attempts"]) + f"\n     on your own computer run:\n     {r['local_command']}")
        return 0 if st["ok"] else 1
    s.set_defaults(fn=fetch_cmd)

    s = sub.add_parser("ad-card", help="floating ad card (rounded, rotating headlines, logo, QR): preview PNG + transparent webm")
    s.add_argument("spec"); s.add_argument("--out", default="ad-card"); s.add_argument("--duration", type=float, default=0)
    s.add_argument("--y", type=int, default=380)
    def adcard(a):
        from shortskit import cardbanner as C
        spec = read_json(a.spec); base = Path(a.spec).resolve().parent; out = Path(a.out)
        png = C.preview(spec, out / "card-preview.png", base)
        res = {"preview": str(png)}
        if a.duration:
            res["webm"] = str(C.render_webm(spec, out / "card.webm", a.duration, base_dir=base, xy=(None, a.y)))
        _print(res)
        return 0
    s.set_defaults(fn=adcard)

    s = sub.add_parser("stack", help="render a short: [top video] + speaker-tracked main video + captions + floating ad card")
    s.add_argument("spec"); s.add_argument("--out")
    def stack_cmd(a):
        from shortskit.stack import render_stack
        _print(render_stack(read_json(a.spec), Path(a.spec).resolve().parent, Path(a.out) if a.out else None))
        return 0
    s.set_defaults(fn=stack_cmd)

    s = sub.add_parser("pack", help="FINAL HAND-OFF: per video -> video + title variants + description + generated cover")
    s.add_argument("spec"); s.add_argument("--out", default="ГОТОВО"); s.add_argument("--zip", action="store_true")
    def pack_cmd(a):
        from shortskit.pack import pack
        _print(pack(Path(a.spec), Path(a.out), a.zip))
        return 0
    s.set_defaults(fn=pack_cmd)

    s = sub.add_parser("anim-init", help="animation episode skeleton: episodes/NAME/ with script, shotlist, brief, words stub; never overwrites")
    s.add_argument("name"); s.add_argument("--root", default=".", help="studio folder that holds episodes/ (default: current)")
    def anim_init(a):
        from shortskit.anim import init_episode
        _print(init_episode(a.name, a.root))
        return 0
    s.set_defaults(fn=anim_init)
    s = sub.add_parser("anim-pick", help="suggest disaster + place pairs for an animation episode")
    s.add_argument("--seed", type=int); s.add_argument("--n", "-n", type=int, default=3)
    def anim_pick(a):
        from shortskit.anim import pick
        _print(pick(a.n, a.seed))
        return 0
    s.set_defaults(fn=anim_pick)
    s = sub.add_parser("anim-check", help="offline check of an animation episode folder (exit 1 on errors)")
    s.add_argument("dir"); s.add_argument("--stage", choices=["script", "full"], default="full",
                   help="script: brief + script only (after stage 2); full: also shotlist and words.json")
    def anim_check(a):
        from shortskit.anim import check_episode
        rep = check_episode(a.dir, a.stage)
        _print(rep)
        return 0 if rep["ok"] else 1
    s.set_defaults(fn=anim_check)

    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if a.verbose else logging.INFO, format="%(levelname)s %(message)s")
    try:
        return a.fn(a)
    except ShortsError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
