#!/usr/bin/env python3
"""Собирает офлайн-страницу из src/ в dist/brigada41-post1a-3d-v2.html."""
import json, pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
S = ROOT / 'src'
rd = lambda n: (S / n).read_text(encoding='utf8')
def opt(n):
    p = S / n
    return p.read_text(encoding='utf8') if p.exists() else ''

data = json.loads(rd('krause-data.json')) if (S / 'krause-data.json').exists() else None
# '</' внутри JSON экранируем, чтобы не закрыть тег script
data_tag = ('<script type="application/json" id="krause-data">'
            + json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
            + '</script>\n') if data else ''
import os
mods = sorted(p.name for p in S.glob('mod-*.js'))
# MODS=mod-a,mod-b — собрать только с этими модулями (для параллельной отладки)
if os.environ.get('MODS') is not None:
    want = {m.strip() for m in os.environ['MODS'].split(',') if m.strip()}
    mods = [m for m in mods if m[:-3] in want]
head = rd('head.html').replace('</style></head>', opt('extra.css') + ''.join(opt(m[:-3] + '.css') for m in mods) + '</style></head>', 1)
body = rd('body.html')
html = (head + body + ''.join(opt(m[:-3] + '.html') for m in mods) + '</main>\n' + data_tag
        + '<script>' + rd('vendor-three.js') + rd('app.js') + '\n})();\n</script>'
        + '<script>' + rd('roi.js') + '</script>'
        + '<script>' + rd('linenav.js') + '</script>'
        + '<script>' + rd('hook.js') + '</script>'
        + ''.join('<script>' + rd(m) + '</script>' for m in mods)
        + '</body></html>')
out = pathlib.Path(os.environ['OUT']).resolve() if os.environ.get('OUT') else ROOT / 'dist' / 'brigada41-post1a-3d-v2.html'
out.write_text(html, encoding='utf8')
print(out, len(html.encode('utf8')), 'bytes', 'mods:', mods)
