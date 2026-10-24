# Модули страницы v2 — контракт

Страница собирается `python3 tools/build.py` из `src/` в `dist/brigada41-post1a-3d-v2.html` (один офлайн-файл, без сети, ≤1,5 МБ).

## Файлы модуля
- `src/mod-<имя>.js` — обычный (не module) скрипт, вставляется ПОСЛЕ основного бандла, `roi.js`, `linenav.js`, `hook.js`. Оборачивайте в IIFE, не создавайте глобальных имён (кроме явно оговорённых `window.__...`), ловите ошибки (`try/catch`) — ошибка модуля не должна ломать страницу.
- `src/mod-<имя>.css` — добавляется в общий `<style>`. Префиксуйте классы именем модуля.
- `src/mod-<имя>.html` (необязательно) — вставляется в конец `<main>`.
- Сборка только с нужными модулями: `MODS=mod-analysis OUT=/tmp/x.html python3 tools/build.py`.
- Проверка: `node tools/check.js /tmp/x.html [ширина высота]` → печатает `{"k":true,"nav":true,"check":"Проверка данных: 37/37 ОК"}` и `ERRS 0`. Скриншоты: `node tools/shots.js /tmp/x.html /tmp/verify/name` (кадры каждые 1500 px). Playwright лежит в `/tmp/k/node_modules` (`require('/tmp/k/node_modules/playwright')`, Chrome: `/usr/local/bin/google-chrome`, флаги `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`). Картинки для просмотра сохраняйте в `/tmp/verify/`.

## Контейнеры в `src/body.html` (пустые, их заполняет модуль)
`#sqctp` (после «Проблема и решение»), `#losses` (после Yamazumi), `#ergo` (после матрицы переноса), `#plan` (в разделе «Проверка после ответов куратора», перед п. 7), `#sverka`, `#questions` (после раздела проверки), `#ideas-body` (внутри `section#ideas`), `#lab` (перед источниками).

## Данные: `window.__krause.kd` (= JSON из `script#krause-data`, файл `src/krause-data.json`)
- `const` {takt 79, pace 100, sminSec 0.6}; `sheetDATA` {orderPerShift 565, availMin 460, ro 0.98, fundSec 27048, src, check}
- `brigades[]` {id '51'|'31'|'41', title, sub, color, posts:[id…]}
- `posts[id]` {n, name, brig, desc (может содержать `{{…}}`), summary{oe,md,vo} (сводка/диаграмма), ops:[{t, v (21179), k 'ОЭ'|'МД'|'ВО', v29? (значение для 21129, 0 = нет), ch? (кусок 41-1(а)), note?}], norm{'21179','21129'}, offline? (31-12 вне линии), chunked? (41-1(а))}
- `chunks[]` — куски 41-1(а): disc 19, plugs 28, turn 8, misc 5; dest{before,varA,after}; disc.needsAfter '51-7'
- `recog` {v 2, posts ['51-9','51-11']} — допущение «модель определяют вручную»
- `variants[]` A (основной), B, V; `economy` {salary, social, shifts, orderPerShift, pacePerShift, days, capex[{t,lo,hi,why,opt?}] (тыс. ₽), cobot}
- `video31`, `discrepancies[]` {where, src, el, diff, why, ask}, `idea2`, `idea3` {title, problem, goal, measures[{post,t,lo,hi,capex[lo,hi] тыс. ₽|null,capexNote?,eff?,to?,toV?}], effects|money}, `sqctp[]` {k,t,v}, `lossRules[]` [[вид, [подстроки…]]…], `lossTable` {note,total,rows[[вид, смин, 51, 31, 41]]}, `ergo`, `plan[]`, `pilotKpi[]`, `questions[]` (по приоритету).

## API: `window.__krause`
- `kx` — текущее {src:'el'|'sum', model:'21179'|'21129'|'mix', mix:0..1, recog:0|2}; `setData(patch)` — сменить и перерисовать всё; событие `document` `'krause:data'`.
- `calc.load(id, mode, model, src='el', recog=0)` — загрузка поста, смин (mode: 'before'|'varA'|'after'); `calc.worst(id, mode)`, `calc.alt(id, mode)`; `calc.vals()` — словарь ключевых чисел (p41a, r519 '71–73', r5111 '53–55', tot 2571, totA 2558, totA2 2562, tot29 2425, b31 999, b31eff '97 %', free41 44, maxFree41 '13 (41-7)', fund '27 048', cap100 451, cap79 571, cap106 425, order 565, short 114, stavki 2, rate '208 000 ₽', rateK '208 тыс. ₽', year '2,5 млн ₽', capex '360–710 тыс. ₽', capexM, payback '1,7–3,4', over31, max31, …); `calc.tpl(str)` — подставляет `{{L:id}}`, `{{P:id}}`, `{{ключ}}`; `calc.opV(op, model)`, `calc.cat(id, model)` → {oe,md,vo}; `calc.check()`.
- 3D/навигация: `state` {mode, sel, …}, `setMode('before'|'varA'|'after')`, `setSel(id, fly)`, `flyTo(view)`, `VIEWS` (all(), b51(), b31(), b41(), move()), `focusPost(id)`, `camera`, `controls`, `renderer`, `scene`, `redraw()`, `stations`, `posts`, `brigades`, `fps()`, `dbg()`. Не ломать и не переопределять `window.__krause`, `window.__lineNav`, `__navCam`, `__navCtl`, `__navRenderer`, `__navSel`, `__navTweens`, `__navBounds`.
- Режим страницы также виден как `document.body.dataset.mode`. Кнопки режима: `button[data-mode]`, видов: `button[data-view]`.

## Правила содержания (из ТЗ)
- Русский язык, короткие простые фразы. Единица — смин (в подсказке — секунды ×0,6). Проценты — от такта 79.
- Не выдумывать данные. У каждой цифры метка: `<span class="tg tz">данные завода</span>`, `<span class="tg tr">расчёт из таблицы</span>`, `<span class="tg tv">видео</span>`, `<span class="tg ta">допущение команды</span>`. Новые оценки — диапазоном и с меткой «допущение команды». Цены — только редактируемые поля с диапазоном по умолчанию.
- Цифры в тексте — из `kd`/`calc`, а не руками. Если источники расходятся — показывать оба значения и причину.
- Людей не «сокращаем»: переводим или не замещаем вакансии. Экономию перевода и экономию ФОТ не складывать.
- Тёмная тема и стиль страницы (см. `src/head.html`: переменные `--bg --card --line --text --muted --strong --good --bad --mono`, классы `.mto .notes .two .scroll table .rh .hint .b .grp .bar-row .nums .tg`). Заголовки разделов — `h2`, подразделов — `h3` как на странице.
