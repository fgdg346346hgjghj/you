/* P1-8 «Показ и материалы»: автотур, проектор, PNG-экспорт, печать. Данные — только из window.__krause. */
(function () {
  'use strict';
  try {
    var K = window.__krause;
    if (!K || !K.kd || !K.calc || window.__krauseShow) return;
    var D = document, H = D.documentElement, B = D.body, kd = K.kd, ZT = '41-1(а)';
    var $ = function (s) { return D.querySelector(s); };
    var mk = function (tag, cls, html) { var e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
    var vals = function () { try { return K.calc.vals(); } catch (e) { return {}; } };
    var num = function (s) { return parseInt(String(s).replace(/[^\d]/g, ''), 10) || 0; };
    var pl = function (n, f) { var a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2]; };
    var bd = function (x) { return '<b>' + x + '</b>'; };
    var mmss = function (s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };
    var LS = 'krause-theme';

    /* ---------- тема «Проектор» ---------- */
    var light = false;
    function setTheme(on) {
      light = !!on; H.classList.toggle('kz-light', light);
      try { localStorage.setItem(LS, light ? 'light' : 'dark'); } catch (e) { /* без хранилища */ }
      var b = $('#kz-theme'); if (b) b.setAttribute('aria-pressed', light);
      try { K.redraw && K.redraw(); } catch (e) { /* ignore */ }
    }
    try { light = localStorage.getItem(LS) === 'light'; } catch (e) { /* ignore */ }
    H.classList.toggle('kz-light', light);

    /* ---------- панель ---------- */
    var KINDS = [
      ['3d-transfer', '3D: перенос ДО → ПОСЛЕ'], ['yamazumi-51', 'Yamazumi · бригада 51'], ['yamazumi-31', 'Yamazumi · бригада 31'],
      ['yamazumi-41', 'Yamazumi · бригада 41'], ['payback', 'Окупаемость'], ['sqctp', 'SQCTP'],
      ['matrix', 'Матрица переноса'], ['slide', 'Слайд для отбора']
    ];
    var bar = mk('div', 'kz-ui', '<button type="button" id="kz-min" title="Свернуть / развернуть" aria-label="Свернуть панель показа">⋯</button><div class="kz-btns">' +
      '<button type="button" id="kz-tourbtn">▶ Автотур</button><button type="button" id="kz-rec" title="Автотур без интерфейса — для записи видео">● Запись</button>' +
      '<button type="button" id="kz-theme" aria-pressed="false">Проектор</button>' +
      '<span class="kz-menu"><button type="button" id="kz-png" aria-haspopup="true" aria-expanded="false">PNG ▾</button><span class="kz-pop" hidden>' +
      KINDS.map(function (k) { return '<button type="button" data-k="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</span></span>' +
      '<button type="button" id="kz-print">Печать/PDF</button></div>');
    bar.id = 'kz-bar';
    var tourUi = mk('div', 'kz-tour-ui', '<div id="kz-cap" role="status" aria-live="polite"><small></small><p></p></div>' +
      '<div id="kz-ctl"><button type="button" data-a="prev" title="Предыдущая глава (←)" aria-label="Назад">⏮</button><button type="button" data-a="pp" title="Пауза / продолжить (Пробел)" aria-label="Пауза">⏸</button>' +
      '<button type="button" data-a="next" title="Следующая глава (→)" aria-label="Вперёд">⏭</button><div id="kz-seek" role="slider" tabindex="0" aria-label="Положение в туре"><i id="kz-fill"></i></div>' +
      '<span id="kz-time">0:00 / 0:00</span><button type="button" data-a="speed" title="Скорость">×1</button><button type="button" data-a="clean" title="Без интерфейса (H — показать панель)">Без UI</button>' +
      '<button type="button" data-a="stop" title="Выход (Esc)" aria-label="Закрыть тур">✕</button></div>');
    tourUi.id = 'kz-tour'; tourUi.hidden = true;
    B.appendChild(bar); B.appendChild(tourUi);

    /* ---------- главы автотура ---------- */
    function T3(mode, view, sel, sc, focus) { return { mode: mode, view: view, sel: sel, sc: sc || 'viewer', focus: focus }; }
    function build() {
      var v = vals(), z = (kd.posts[ZT] || {}).summary || {}, ch = {};
      kd.chunks.forEach(function (c) { ch[c.id] = c; });
      var cv = function (id) { return ch[id] ? ch[id].v : '?'; };
      var free = function (x) { return Math.max(0, v.takt - x); };
      var st = num(v.stavki), idea3 = ((kd.idea3.measures || [])[0] || {}).eff || '';
      return [
        { t: 'Проблема', d: 50, b: [
          { t: 0, g: { sc: 'top' }, x: 'Пост ' + bd(ZT) + ': ' + bd(v.p41a + ' смин') + ' работы при такте ' + bd(v.takt) + '; на 21129 он простаивает весь цикл. В бригаде 31 выше такта: ' + bd(v.over31) + '.' },
          { t: 20, g: { sc: 'h2:Проблема и решение' }, x: 'Идея: заглушки — на ' + bd('51-9') + ', задающий диск — на ' + bd('51-11') + '. Пост и ' + bd(st + ' ' + pl(st, ['ставка', 'ставки', 'ставок'])) + ' освобождаются.' },
          { t: 36, g: { sc: 'top' }, x: 'Людей не сокращаем: переводим или не замещаем вакансии. План ' + bd(v.order + ' шт./смену') + ', по темпу ' + bd(v.pace + ' смин') + ' выходит ≈' + bd(v.cap100) + '.' }] },
        { t: '3D · ДО', d: 55, b: [
          { t: 0, g: T3('before', 'all', ZT), x: 'Три бригады по потоку ' + bd('51 → 31 → 41') + '. Каждый столбик — загрузка поста, красная черта — такт ' + v.takt + ' смин.' },
          { t: 18, g: T3('before', null, '31-10(а)', 'viewer', 1), x: bd('31-10(а)') + ': ' + bd(v.max31v + ' смин') + ' при такте ' + v.takt + ' — самый медленный пост линии.' },
          { t: 34, g: T3('before', null, ZT, 'viewer', 1), x: bd(ZT) + ': ' + bd(v.p41a + ' смин') + ', из них полезных (ОЭ) только ' + bd(z.oe) + '; ' + bd(z.md) + ' смин — развороты и перекладывания.' }] },
        { t: 'Перенос', d: 55, b: [
          { t: 0, g: T3('before', 'move', ZT), x: 'Работа поста: диск ' + bd(cv('disc') + ' смин') + ', заглушки ' + bd(cv('plugs') + ' смин') + ', развороты ' + bd(cv('turn')) + ', тип ДВС и кнопка ' + bd(cv('misc')) + '.' },
          { t: 14, g: T3('before', null, '51-9'), x: 'Заглушки → ' + bd('51-9') + ': сейчас ' + bd(v.p519b + ' смин') + ', будет ' + bd(v.r519) + '. Операции на головке — рядом с герметиком.' },
          { t: 28, g: T3('before', null, '51-11'), x: 'Диск → ' + bd('51-11') + ' только после 51-7 (нужен уложенный распредвал): было ' + bd(v.p5111b) + ', станет ' + bd(v.r5111) + '.' },
          { t: 42, g: T3('varA', null, '31-11'), x: 'Вариант «в 31-11» отвергаем: там ' + bd(v.p3111v + ' смин') + ' (' + v.pc3111v + ' такта).' }] },
        { t: 'ПОСЛЕ', d: 45, b: [
          { t: 0, g: T3('after', 'move', '51-9'), x: bd('51-9') + ': ' + bd(v.r519 + ' смин') + ' (' + v.pc519a + ' такта). Верхняя граница — допущение +2 смин на распознавание модели.' },
          { t: 14, g: T3('after', null, '51-11'), x: bd('51-11') + ': ' + bd(v.r5111 + ' смин') + ' (' + v.pc5111a + ' такта). Оба поста — в такте ' + v.takt + '.' },
          { t: 28, g: T3('after', 'all', '51-11'), x: 'Пост ' + bd(ZT) + ' убран из потока. Бригада 41: ' + bd(v.b41b + ' → ' + v.b41a + ' смин') + ', постов ' + v.n41b + ' → ' + v.n41a + '.' }] },
        { t: 'Yamazumi', d: 50, b: [
          { t: 0, g: { sc: 'h2:Загрузка трёх бригад' }, x: 'Работа переносится, а не теряется: ' + bd(v.tot + ' → ' + v.totA + '…' + v.totA2 + ' смин') + ' по трём бригадам. Лишние ' + bd(v.extra + ' смин') + ' (развороты, тип ДВС) уходят.' },
          { t: 25, g: { sc: '#brig-charts' }, x: 'Бригада 51: ' + bd(v.b51b + ' → ' + v.b51a + '…' + v.b51a2) + ', все посты в такте. Бригада 31 не меняется: ' + v.over31n + ' ' + pl(v.over31n, ['пост', 'поста', 'постов']) + ' выше такта — это идея 2.' }] },
        { t: 'Деньги', d: 50, b: [
          { t: 0, g: { sc: 'h2:Сколько стоит' }, x: 'Освобождаем ' + bd(st + ' ' + pl(st, ['ставку', 'ставки', 'ставок'])) + ' ≈ ' + bd(v.rateK) + ' в месяц (' + v.year + ' в год) — деньги есть только если вакансии не замещаются.' },
          { t: 24, g: { sc: '#payback' }, x: 'Единоразово ' + bd(v.capexM) + ', окупаемость ' + bd(v.payback + ' мес') + '. Если людей переводим — это не экономия ФОТ, а резерв рабочих рук.' }] },
        { t: 'Риски и пилот', d: 45, b: [
          { t: 0, g: { sc: 'h2:Куда уходит каждая операция' }, x: 'Диск ставим только после 51-7. Запас до такта после переноса: 51-9 — ' + bd(free(v.p519a2) + ' смин') + ', 51-11 — ' + bd(free(v.p5111a2) + ' смин') + '.' },
          { t: 16, g: { sc: '#plan|h2:Проверка после ответов' }, x: 'Пилот 2–3 смены, хронометраж. ' + bd(ZT) + ' остаётся страховкой, пока не подтверждено: 51-9 ≤ ' + bd(v.p519a2) + ', 51-11 ≤ ' + bd(v.p5111a2) + ' смин.' },
          { t: 30, g: { sc: 'h2:Куда уходит каждая операция' }, x: 'Риск — ошибка модели на 51-11: диск нужен для 21179, а для 21129 — нет. Закрываем световой подсказкой модели.' }] },
        { t: 'Идеи 2 и 3', d: 40, b: [
          { t: 0, g: { sc: '#ideas|h2:Ещё две идеи' }, x: bd('Идея 2') + ' — посты выше такта. ' + (kd.idea2.result || '') },
          { t: 20, g: { sc: '#ideas|h2:Ещё две идеи' }, x: bd('Идея 3') + ' — защита от ошибок вместо ручного сброса. ' + idea3 + '.' }] },
        { t: 'Итог', d: 30, b: [
          { t: 0, g: T3('after', 'all', null, 'top'), x: 'Пост ' + bd(ZT) + ' убираем. 51-9 — ' + bd(v.r519) + ', 51-11 — ' + bd(v.r5111) + ' смин при такте ' + v.takt + '. Людей сохраняем, ' + bd(v.capexM) + ' единоразово, окупаемость ' + bd(v.payback + ' мес') + ' при незамещении вакансий.' },
          { t: 16, g: { sc: 'top' }, x: 'Дальше — пилот на 2–3 смены. ' + bd(ZT) + ' остаётся страховкой, пока цифры не подтверждены на линии.' }] }
      ];
    }

    /* ---------- движок тура ---------- */
    var S = { on: false, paused: false, speed: 1, t: 0, ci: -1, bi: -1, iv: 0, last: 0, clean: false, chs: [], total: 0, starts: [] };
    function scrollTarget(spec) {
      if (spec === 'top') return 0;
      if (spec === 'viewer') spec = '#viewer';
      var parts = String(spec).split('|'), e = null;
      for (var i = 0; i < parts.length && !e; i++) {
        var p = parts[i];
        if (p.indexOf('h2:') === 0) {
          var hs = D.querySelectorAll('h2'), s = p.slice(3);
          for (var j = 0; j < hs.length; j++) if (hs[j].textContent.indexOf(s) >= 0) { e = hs[j]; break; }
        } else { e = $(p); if (e && e.getBoundingClientRect().height < 20) e = null; }
      }
      if (!e) return null;
      return Math.max(0, window.scrollY + e.getBoundingClientRect().top - (spec === '#viewer' ? 10 : 16));
    }
    function go(g) {
      if (!g) return;
      if (g.sc) { var y = scrollTarget(g.sc); if (y != null) window.scrollTo({ top: y, behavior: 'smooth' }); }
      if (g.mode) K.setMode(g.mode);
      if (g.view) K.flyTo(K.VIEWS[g.view]());
      if (g.sel) K.setSel(g.sel, !!g.focus, true);
    }
    function locate(t) {
      for (var i = 0; i < S.chs.length; i++) {
        var c = S.chs[i], off = t - S.starts[i];
        if (off < c.d || i === S.chs.length - 1) {
          var bi = 0; for (var j = 0; j < c.b.length; j++) if (off >= c.b[j].t) bi = j;
          return { ci: i, bi: bi, off: off };
        }
      }
      return { ci: 0, bi: 0, off: 0 };
    }
    var capEl, ctl = {};
    function sync() {
      var L = locate(S.t), c = S.chs[L.ci];
      if (L.ci !== S.ci || L.bi !== S.bi) {
        S.ci = L.ci; S.bi = L.bi;
        var b = c.b[L.bi], cap = $('#kz-cap');
        cap.classList.remove('in'); void cap.offsetWidth;
        cap.querySelector('small').textContent = (L.ci + 1) + ' / ' + S.chs.length + ' · ' + c.t;
        cap.querySelector('p').innerHTML = b.x; cap.classList.add('in');
        try { go(b.g); } catch (e) { /* ignore */ }
      }
      $('#kz-fill').style.width = (S.t / S.total * 100) + '%';
      $('#kz-time').textContent = mmss(S.t) + ' / ' + mmss(S.total);
      $('#kz-seek').setAttribute('aria-valuetext', (L.ci + 1) + '. ' + c.t);
    }
    function tick() {
      var n = performance.now();
      if (!S.paused) {
        S.t += (n - S.last) / 1000 * S.speed;
        if (S.t >= S.total) { S.t = S.total - 0.01; setPaused(true); }
      }
      S.last = n; sync();
    }
    function setPaused(p) { S.paused = p; var b = tourUi.querySelector('[data-a=pp]'); b.textContent = p ? '▶' : '⏸'; S.last = performance.now(); }
    function seek(t) { S.t = Math.max(0, Math.min(S.total - 0.01, t)); S.ci = -1; sync(); }
    function chapter(i) {
      if (!S.on) start();
      i = Math.max(0, Math.min(S.chs.length - 1, i | 0)); seek(S.starts[i]); return i;
    }
    function nav(d) {
      var L = locate(S.t);
      chapter(d > 0 ? L.ci + 1 : (L.off > 3 ? L.ci : L.ci - 1));
    }
    function setClean(on) {
      S.clean = !!on; B.classList.toggle('kz-clean', S.on && S.clean); B.classList.remove('kz-reveal');
      tourUi.querySelector('[data-a=clean]').setAttribute('aria-pressed', S.clean);
    }
    function start(o) {
      o = o || {}; if (S.on) stop();
      S.chs = build(); S.starts = []; S.total = 0;
      S.chs.forEach(function (c) { S.starts.push(S.total); S.total += c.d; });
      var seekEl = $('#kz-seek'); seekEl.querySelectorAll('u').forEach(function (u) { u.remove(); });
      S.chs.forEach(function (c, i) {
        var u = mk('u'); u.style.left = (S.starts[i] / S.total * 100) + '%'; u.title = (i + 1) + '. ' + c.t; u.dataset.n = i + 1; seekEl.appendChild(u);
      });
      S.on = true; S.speed = o.speed || 1; S.ci = -1; S.bi = -1; S.t = 0;
      tourUi.querySelector('[data-a=speed]').textContent = '×' + (S.speed === 1.5 ? '1,5' : S.speed);
      tourUi.hidden = false; B.classList.add('kz-touring'); setClean(!!o.clean); setPaused(false);
      sync(); clearInterval(S.iv); S.iv = setInterval(tick, 100);
      var kb = $('#kz-tourbtn'); kb.textContent = '■ Стоп';
    }
    function stop() {
      clearInterval(S.iv); S.on = false; tourUi.hidden = true;
      B.classList.remove('kz-touring', 'kz-clean', 'kz-reveal'); $('#kz-tourbtn').textContent = '▶ Автотур';
    }
    $('#kz-tourbtn').addEventListener('click', function () { S.on ? stop() : start(); });
    $('#kz-rec').addEventListener('click', function () { start({ clean: true }); });
    tourUi.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('button'); if (!a) return;
      var k = a.dataset.a;
      if (k === 'pp') { if (S.paused && S.t >= S.total - 0.5) seek(0); setPaused(!S.paused); }
      else if (k === 'prev') nav(-1); else if (k === 'next') nav(1); else if (k === 'stop') stop();
      else if (k === 'speed') { S.speed = S.speed === 1 ? 1.5 : 1; a.textContent = S.speed === 1 ? '×1' : '×1,5'; }
      else if (k === 'clean') setClean(!S.clean);
    });
    (function () {
      var sk = $('#kz-seek'), drag = false;
      var at = function (e) { var r = sk.getBoundingClientRect(); seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * S.total); };
      sk.addEventListener('pointerdown', function (e) { drag = true; try { sk.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } at(e); });
      sk.addEventListener('pointermove', function (e) { if (drag) at(e); });
      sk.addEventListener('pointerup', function () { drag = false; });
    })();
    window.addEventListener('keydown', function (e) {
      if (!S.on || e.ctrlKey || e.metaKey || e.altKey) return;
      var h = true;
      if (e.code === 'Escape') stop();
      else if (e.code === 'Space') { if (S.paused && S.t >= S.total - 0.5) seek(0); setPaused(!S.paused); }
      else if (e.code === 'ArrowRight') nav(1);
      else if (e.code === 'ArrowLeft') nav(-1);
      else if (e.code === 'KeyH') B.classList.toggle('kz-reveal');
      else h = false;
      if (h) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    var hideT = 0;
    window.addEventListener('mousemove', function (e) {
      if (!S.on || !S.clean) return;
      if (window.innerHeight - e.clientY < 80) { B.classList.add('kz-reveal'); clearTimeout(hideT); hideT = setTimeout(function () { B.classList.remove('kz-reveal'); }, 2500); }
    });

    /* ---------- холсты: общее ---------- */
    var W = 1920, HH = 1080, F = 'system-ui,"Segoe UI",Roboto,Arial,sans-serif';
    var P;
    function pal() {
      P = light ? { bg: '#ffffff', card: '#f1f4f9', line: '#c7cfdb', text: '#1c2430', muted: '#475569', strong: '#0b1220', good: '#0f7a36', bad: '#c42020', acc: '#d41f00', ok: '#bbf7d0', okt: '#14532d', no: '#fecaca', not: '#7f1d1d', na: '#e5e7eb', nat: '#6b7280' }
        : { bg: '#0b0e13', card: '#121721', line: '#2a3342', text: '#c9d3e0', muted: '#8a97a9', strong: '#f1f5f9', good: '#22c55e', bad: '#ef4444', acc: '#ff2400', ok: '#14532d', okt: '#bbf7d0', no: '#450a0a', not: '#fecaca', na: '#1f2937', nat: '#6b7280' };
    }
    var CAT = { oe: ['#22a35a', 'ОЭ'], md: ['#d8b10f', 'МД'], vo: ['#dc2f2f', 'ВО'] };
    function canvas(title, sub, foot) {
      pal();
      var cv = D.createElement('canvas'); cv.width = W; cv.height = HH;
      var c = cv.getContext('2d'); c.fillStyle = P.bg; c.fillRect(0, 0, W, HH);
      c.fillStyle = P.acc; c.fillRect(0, 0, 14, HH);
      txt(c, title, 60, 78, 46, P.strong, '700'); if (sub) txt(c, sub, 60, 124, 26, P.muted);
      txt(c, foot || 'Время — смин (1 смин = 0,6 с). Источник: расчёт из таблицы норм (tr), данные завода (tz).', 60, 1050, 21, P.muted);
      txt(c, 'Линия Krause · бригады 51 → 31 → 41', W - 60, 1050, 21, P.muted, '400', 'right');
      return { cv: cv, c: c };
    }
    function txt(c, s, x, y, size, color, w, al) {
      c.font = (w || '400') + ' ' + size + 'px ' + F; c.fillStyle = color; c.textAlign = al || 'left'; c.textBaseline = 'alphabetic'; c.fillText(String(s), x, y);
    }
    function wrap(c, s, x, y, w, lh, size, color, wt) {
      c.font = (wt || '400') + ' ' + size + 'px ' + F; c.fillStyle = color; c.textAlign = 'left';
      var words = String(s).split(' '), line = '';
      words.forEach(function (wd) {
        var t = line ? line + ' ' + wd : wd;
        if (c.measureText(t).width > w && line) { c.fillText(line, x, y); y += lh; line = wd; } else line = t;
      });
      if (line) { c.fillText(line, x, y); y += lh; }
      return y;
    }
    function rr(c, x, y, w, h, r, fill, stroke) {
      c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
      if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
    }
    function blob(cv) { return new Promise(function (res, rej) { cv.toBlob(function (b) { b ? res(b) : rej(new Error('toBlob')); }, 'image/png'); }); }
    var L = function (id, mode, rec) { return K.calc.load(id, mode, '21179', 'el', rec || 0); };

    /* ---------- Yamazumi ---------- */
    function segsOf(id, mode) {
      var cat = K.calc.cat(id, '21179'), s = [];
      ['oe', 'md', 'vo'].forEach(function (k) { if (cat[k]) s.push({ v: cat[k], c: CAT[k][0] }); });
      kd.chunks.forEach(function (ch) { if (ch.dest[mode] === id) s.push({ v: ch.v, c: ch.color }); });
      return s;
    }
    function yamazumi(bid) {
      var br = kd.brigades.filter(function (b) { return b.id === bid; })[0], v = vals();
      var ids = br.posts.filter(function (id) { return !kd.posts[id].offline; });
      var o = canvas('Бригада ' + bid + ' · загрузка постов ДО и ПОСЛЕ', br.sub + ' · модель 21179, такт ' + v.takt + ' смин');
      var c = o.c, takt = v.takt;
      var lg = [['oe', 'ОЭ'], ['md', 'МД'], ['vo', 'ВО']].map(function (k) { return [CAT[k[0]][0], CAT[k[0]][1] + ' — ' + { oe: 'основная работа', md: 'взять/положить', vo: 'вспомогательное' }[k[0]]]; });
      kd.chunks.forEach(function (ch) { lg.push([ch.color, ch.short + ' (' + ch.v + ')']); });
      var lx = 60; lg.forEach(function (l) { c.fillStyle = l[0]; c.fillRect(lx, 150, 20, 20); txt(c, l[1], lx + 28, 168, 20, P.text); lx += 28 + c.measureText(l[1]).width + 30; });
      var maxV = 100;
      ['before', 'after'].forEach(function (m) { ids.forEach(function (id) { maxV = Math.max(maxV, L(id, m) + (m === 'after' ? kd.recog.v : 0)); }); });
      maxV = Math.ceil((maxV + 6) / 10) * 10;
      [['before', 'ДО', 192], ['after', 'ПОСЛЕ', 620]].forEach(function (pn) {
        var m = pn[0], y0 = pn[2], h = 330, x0 = 130, pw = 1730, slot = pw / ids.length, bw = Math.min(90, slot * 0.62), base = y0 + h;
        var Y = function (val) { return base - val / maxV * h; };
        txt(c, pn[1], 60, y0 + 24, 30, P.strong, '700');
        for (var g = 0; g <= maxV; g += 20) { c.strokeStyle = P.line; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, Y(g)); c.lineTo(x0 + pw, Y(g)); c.stroke(); txt(c, g, x0 - 10, Y(g) + 6, 18, P.muted, '400', 'right'); }
        var sum = 0, sumR = 0;
        ids.forEach(function (id, i) {
          var cx = x0 + slot * (i + 0.5), bx = cx - bw / 2, tot = L(id, m), rec = m === 'after' && kd.recog.posts.indexOf(id) >= 0 ? kd.recog.v : 0;
          var gone = id === ZT && m !== 'before';
          txt(c, id, cx, base + 26, 19, gone ? P.muted : P.text, '400', 'center');
          if (gone) { c.setLineDash([6, 5]); c.strokeStyle = P.muted; c.lineWidth = 2; c.strokeRect(bx, Y(60), bw, base - Y(60)); c.setLineDash([]); txt(c, 'убран', cx, Y(60) + 34, 20, P.muted, '600', 'center'); return; }
          var acc = 0;
          segsOf(id, m).forEach(function (s) { c.fillStyle = s.c; c.fillRect(bx, Y(acc + s.v), bw, Y(acc) - Y(acc + s.v) - 1); acc += s.v; });
          if (rec) {
            c.setLineDash([5, 4]); c.strokeStyle = P.muted; c.lineWidth = 2; c.strokeRect(bx + 1, Y(acc + rec), bw - 2, Y(acc) - Y(acc + rec)); c.setLineDash([]);
          }
          var over = tot + rec > takt, top = Y(tot + rec);
          txt(c, rec ? tot + '–' + (tot + rec) : tot, cx, top - 8, 21, over ? P.bad : P.strong, '700', 'center');
          sum += tot; sumR += tot + rec;
        });
        c.strokeStyle = P.acc; c.lineWidth = 3; c.setLineDash([10, 6]); c.beginPath(); c.moveTo(x0, Y(takt)); c.lineTo(x0 + pw, Y(takt)); c.stroke(); c.setLineDash([]);
        txt(c, 'такт ' + takt, x0 + pw, Y(takt) - 8, 22, P.acc, '700', 'right');
        txt(c, 'Сумма: ' + (sumR !== sum ? sum + '–' + sumR : sum) + ' смин · постов ' + ids.filter(function (id) { return !(id === ZT && m !== 'before'); }).length, W - 60, y0 + 24, 26, P.strong, '700', 'right');
      });
      return blob(o.cv);
    }

    /* ---------- окупаемость ---------- */
    function payback() {
      var v = vals(), rate = num(v.rate), cp = String(v.capex).split('–'), lo = num(cp[0]) * 1e3, hi = num(cp[1]) * 1e3;
      var o = canvas('Окупаемость: накопленный эффект по месяцам', 'Освобождаем ' + v.stavki + ' ' + pl(num(v.stavki), ['ставку', 'ставки', 'ставок']) + ' ≈ ' + v.rateK + ' в месяц. Деньги — только при незамещении вакансий.',
        'Источник: допущение команды (ta): оклад, социальные отчисления, затраты по смете; ставки и окупаемость — расчёт страницы.');
      var c = o.c, x0 = 190, y0 = 200, w = 1180, h = 700, mo = 12, top = rate * mo - lo, bot = -hi * 1.15;
      var X = function (m) { return x0 + m / mo * w; }, Y = function (val) { return y0 + (top - val) / (top - bot) * h; };
      for (var g = Math.ceil(bot / 5e5) * 5e5; g <= top; g += 5e5) {
        c.strokeStyle = g === 0 ? P.muted : P.line; c.lineWidth = g === 0 ? 2 : 1; c.beginPath(); c.moveTo(x0, Y(g)); c.lineTo(x0 + w, Y(g)); c.stroke();
        txt(c, (g / 1e6).toLocaleString('ru-RU') + ' млн', x0 - 12, Y(g) + 7, 21, P.muted, '400', 'right');
      }
      for (var m = 0; m <= mo; m++) txt(c, m, X(m), y0 + h + 34, 21, P.muted, '400', 'center');
      txt(c, 'месяцы после запуска', x0 + w / 2, y0 + h + 70, 22, P.muted, '400', 'center');
      [['lo', lo, P.good, 'затраты ' + (lo / 1e3) + ' тыс. ₽'], ['hi', hi, '#16a34a', 'затраты ' + (hi / 1e3) + ' тыс. ₽']].forEach(function (s, i) {
        c.strokeStyle = s[2]; c.lineWidth = i ? 3 : 5; c.setLineDash(i ? [12, 8] : []); c.beginPath();
        for (var k = 0; k <= mo; k++) { var px = X(k), py = Y(-s[1] + rate * k); k ? c.lineTo(px, py) : c.moveTo(px, py); }
        c.stroke(); c.setLineDash([]);
        var pb = s[1] / rate; c.fillStyle = s[2]; c.beginPath(); c.arc(X(pb), Y(0), 9, 0, 7); c.fill();
        txt(c, (Math.round(pb * 10) / 10).toLocaleString('ru-RU') + ' мес', X(pb) + (i ? 16 : -16), Y(0) + (i ? 36 : -18), 28, P.strong, '700', i ? 'left' : 'right');
        txt(c, s[3], x0 + 16, Y(-s[1]) + (i ? 30 : -12), 20, P.muted);
      });
      var bx = 1440, by = 210;
      rr(c, bx, by, 420, 690, 14, P.card, P.line);
      [['Окупаемость', v.payback + ' мес', P.good], ['Единоразово', v.capexM, P.strong], ['Эффект в месяц', v.rateK, P.strong], ['Эффект в год', v.year, P.strong]].forEach(function (r, i) {
        txt(c, r[0], bx + 30, by + 56 + i * 112, 22, P.muted); txt(c, r[1], bx + 30, by + 100 + i * 112, 38, r[2], '700');
      });
      wrap(c, 'При переводе людей экономии ФОТ нет — это резерв рабочих рук. Экономию от перевода и ФОТ не складываем.', bx + 30, by + 520, 360, 29, 21, P.text);
      return blob(o.cv);
    }

    /* ---------- SQCTP ---------- */
    function sqctp() {
      var o = canvas('SQCTP: безопасность, качество, затраты, такт, люди', 'Где пост 41-1(а) и соседние посты теряют время и создают риски');
      var c = o.c, items = kd.sqctp, rowH = 168, y = 170;
      var cl = { S: '#ef4444', Q: '#a78bfa', C: '#22c55e', T: '#f59e0b', P: '#38bdf8' };
      items.forEach(function (it, i) {
        var yy = y + i * rowH;
        rr(c, 60, yy, 1800, rowH - 14, 12, P.card, P.line);
        rr(c, 60, yy, 110, rowH - 14, 12, cl[it.k] || P.muted);
        txt(c, it.k, 115, yy + 98, 70, '#fff', '700', 'center');
        txt(c, it.t, 200, yy + 42, 30, P.strong, '700');
        wrap(c, it.v, 200, yy + 80, 1630, 31, 23, P.text);
      });
      return blob(o.cv);
    }

    /* ---------- матрица переноса ---------- */
    function matrix() {
      var v = vals(), br = kd.brigades[0].posts, ops = kd.chunks.filter(function (ch) { return ch.dest.after; });
      var o = canvas('Куда можно перенести операции поста 41-1(а)', 'Нагрузка постов бригады 51 после переноса, смин · такт ' + v.takt, 'Зелёный — в такте, красный — выше такта, серый — нельзя (операция зависит от более позднего поста). Расчёт из таблицы норм (tr).');
      var c = o.c, x0 = 60, lw = 520, cw = (1800 - lw) / br.length, y = 175, rh = 74;
      br.forEach(function (id, i) { txt(c, id, x0 + lw + cw * (i + .5), y + 40, 24, P.strong, '700', 'center'); });
      txt(c, 'Операция → пост', x0 + 8, y + 40, 22, P.muted);
      var cell = function (xx, yy, cls, s) {
        rr(c, xx + 3, yy + 3, cw - 6, rh - 6, 8, cls === 'ok' ? P.ok : cls === 'no' ? P.no : P.na);
        txt(c, s, xx + cw / 2, yy + rh / 2 + 8, 22, cls === 'ok' ? P.okt : cls === 'no' ? P.not : P.nat, '600', 'center');
      };
      ops.forEach(function (ch, r) {
        var yy = y + 58 + r * rh;
        txt(c, ch.label + ', ' + ch.v, x0 + 8, yy + 32, 21, P.text, '600'); if (ch.needsAfter) txt(c, '(после ' + ch.needsAfter + ')', x0 + 8, yy + 58, 19, P.muted);
        br.forEach(function (id, i) {
          var base = L(id, 'before'), tot = base + ch.v;
          ch.needsAfter && i <= br.indexOf(ch.needsAfter) ? cell(x0 + lw + cw * i, yy, 'na', 'нельзя') : cell(x0 + lw + cw * i, yy, tot <= v.takt ? 'ok' : 'no', base + ' → ' + tot);
        });
      });
      var vy = y + 58 + ops.length * rh + 40;
      txt(c, 'Варианты размещения (нагрузка после переноса):', x0 + 8, vy, 24, P.strong, '700');
      kd.variants.forEach(function (va, r) {
        var yy = vy + 18 + r * rh, ps = Object.keys(va.place).map(function (k) { return va.place[k]; });
        txt(c, va.label, x0 + 8, yy + 44, 20, va.main ? P.strong : P.text, va.main ? '700' : '400');
        br.forEach(function (id, i) {
          if (ps.indexOf(id) < 0) return;
          var ld = L(id, 'before') + kd.chunks.filter(function (ch) { return va.place[ch.id] === id; }).reduce(function (a, ch) { return a + ch.v; }, 0);
          cell(x0 + lw + cw * i, yy, ld <= v.takt ? 'ok' : 'no', String(ld));
        });
      });
      return blob(o.cv);
    }

    /* ---------- 3D: перенос ДО → ПОСЛЕ ---------- */
    function shot3d() {
      var R = K.renderer, cam = K.camera, ctl = K.controls, V = cam.position.constructor, v = vals();
      var cw = 930, chh = 560, keep = { mode: K.state.mode, pos: cam.position.clone(), q: cam.quaternion.clone(), tg: ctl.target.clone(), asp: cam.aspect, pr: R.getPixelRatio(), sz: R.getSize({ set: function (a, b) { this.w = a; this.h = b; return this; } }) };
      var shots = [];
      try {
        R.setPixelRatio(1); R.setSize(cw, chh, false); cam.aspect = cw / chh; cam.updateProjectionMatrix();
        ['before', 'after'].forEach(function (m) {
          K.setMode(m, false);
          var vw = K.VIEWS.move(); cam.position.copy(vw.pos); ctl.target.copy(vw.target); cam.lookAt(vw.target); cam.updateMatrixWorld(true);
          R.render(K.scene, cam);
          var cv = D.createElement('canvas'); cv.width = cw; cv.height = chh; cv.getContext('2d').drawImage(R.domElement, 0, 0);
          var pts = {};
          [ZT, '51-9', '51-11'].forEach(function (id) { var p = K.posts[id]; if (!p) return; var q = new V(p.x, 2.1, p.z).project(cam); pts[id] = [(q.x * .5 + .5) * cw, (-q.y * .5 + .5) * chh]; });
          shots.push({ cv: cv, pts: pts, m: m });
        });
      } finally {
        K.setMode(keep.mode, false); R.setPixelRatio(keep.pr); R.setSize(keep.sz.w, keep.sz.h, false);
        cam.aspect = keep.asp; cam.updateProjectionMatrix(); cam.position.copy(keep.pos); cam.quaternion.copy(keep.q); ctl.target.copy(keep.tg); cam.updateMatrixWorld(true);
        try { K.redraw(); } catch (e) { /* ignore */ }
      }
      var o = canvas('Перенос двух операций: пост ' + ZT + ' убираем', 'Слева — как сейчас, справа — после переноса. Работа не пропадает: заглушки → 51-9, диск → 51-11.');
      var c = o.c;
      shots.forEach(function (s, i) {
        var x = i ? 1860 - cw : 60;
        c.drawImage(s.cv, x, 160, cw, chh); c.strokeStyle = P.line; c.lineWidth = 2; c.strokeRect(x, 160, cw, chh);
        rr(c, x + 14, 174, i ? 150 : 90, 46, 8, 'rgba(8,11,16,.85)'); txt(c, i ? 'ПОСЛЕ' : 'ДО', x + 28, 207, 28, '#fff', '700');
        var tag = function (id, s2, col) {
          var p = s.pts[id]; if (!p) return;
          c.font = '700 22px ' + F; var tw = c.measureText(s2).width + 24, bx = Math.max(x + 6, Math.min(x + cw - tw - 6, x + p[0] - tw / 2)), by = Math.max(230, Math.min(160 + chh - 90, 160 + p[1] - 70));
          rr(c, bx, by, tw, 38, 7, 'rgba(8,11,16,.9)', col); txt(c, s2, bx + 12, by + 27, 22, '#fff', '700');
          c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(bx + tw / 2, by + 38); c.lineTo(x + p[0], 160 + p[1]); c.stroke();
        };
        if (!i) tag(ZT, ZT + ' · ' + v.p41a + ' смин', P.bad);
        else { tag('51-9', '51-9 · ' + v.r519, P.good); tag('51-11', '51-11 · ' + v.r5111, P.good); }
      });
      var ty = 760, cards = [
        ['ДО', ZT + ': ' + v.p41a + ' смин', 'Работа поста: диск, заглушки, развороты и «тип ДВС». На 21129 пост простаивает.', P.bad],
        ['Перенос', '2 операции', 'Заглушки (' + kd.chunks[1].v + ' смин) → 51-9; диск (' + kd.chunks[0].v + ' смин) → 51-11, после 51-7. Развороты и «тип ДВС» (' + (kd.chunks[2].v + kd.chunks[3].v) + ') уходят.', P.acc],
        ['ПОСЛЕ', '51-9: ' + v.r519 + ' · 51-11: ' + v.r5111, 'Оба поста ниже такта ' + v.takt + '. Людей не сокращаем: переводим или не замещаем вакансии.', P.good]];
      cards.forEach(function (cd, i) {
        var x = 60 + i * 610; rr(c, x, ty, 580, 250, 14, P.card, P.line);
        txt(c, cd[0], x + 24, ty + 44, 22, cd[3], '700'); txt(c, cd[1], x + 24, ty + 92, 30, P.strong, '700');
        wrap(c, cd[2], x + 24, ty + 140, 532, 31, 23, P.text);
      });
      return blob(o.cv);
    }

    /* ---------- слайд для отбора ---------- */
    function slide() {
      var v = vals(), st = num(v.stavki), z = (kd.posts[ZT] || {}).summary || {};
      var o = canvas('Пост 41-1(а): убираем, людей сохраняем', 'Перенос заглушек на 51-9 и задающего диска на 51-11 · линия Krause, бригады 51 → 31 → 41', 'Время — смин (1 смин = 0,6 с). Деньги — только при незамещении вакансий; при переводе людей экономии ФОТ нет. Цены — допущение команды (ta).');
      var c = o.c, cw = 340, g = 25, y = 160, h = 470;
      var cards = [
        ['Проблема', P.bad, v.p41a + ' смин', 'работы на посту при такте ' + v.takt + '; полезных только ' + z.oe + '. На 21129 пост простаивает. В бригаде 31 выше такта: ' + v.over31 + '.'],
        ['Решение', P.acc, '2 операции', 'Заглушки (' + kd.chunks[1].v + ' смин) → 51-9, задающий диск (' + kd.chunks[0].v + ' смин) → 51-11. Пост ' + ZT + ' убираем.'],
        ['Эффект', P.good, st + ' ' + pl(st, ['ставка', 'ставки', 'ставок']) + ' + пост', 'освобождаются. 51-9: ' + v.r519 + ', 51-11: ' + v.r5111 + ' смин — оба в такте. Людей переводим или не замещаем вакансии.'],
        ['Окупаемость', '#38bdf8', v.payback + ' мес', 'при ' + v.capexM + ' единоразово и эффекте ≈ ' + v.rateK + '/мес. Только если вакансии не замещаются.'],
        ['Простота', '#a78bfa', (kd.plan || []).length + ' нед.', 'до снятия поста. Свой гайковёрт переезжает с ' + ZT + '; нужны фиксатор, тара, подсказка модели. Пилот 2–3 смены, ' + ZT + ' — страховка.']];
      cards.forEach(function (cd, i) {
        var x = 60 + i * (cw + g); rr(c, x, y, cw, h, 14, P.card, P.line); c.fillStyle = cd[1]; c.fillRect(x, y + 14, 6, 60);
        txt(c, cd[0].toUpperCase(), x + 24, y + 52, 22, cd[1], '700');
        c.font = '700 44px ' + F; var s = cd[2], sz = 44; while (c.measureText(s).width > cw - 40 && sz > 28) { sz -= 2; c.font = '700 ' + sz + 'px ' + F; }
        txt(c, s, x + 24, y + 130, sz, P.strong, '700');
        wrap(c, cd[3], x + 24, y + 190, cw - 48, 33, 24, P.text);
      });
      var by = 670, rows = [[ZT, L(ZT, 'before'), 0], ['51-9', L('51-9', 'before'), L('51-9', 'after', kd.recog.v)], ['51-11', L('51-11', 'before'), L('51-11', 'after', kd.recog.v)]];
      txt(c, 'Загрузка постов, смин (серым — ДО, цветом — ПОСЛЕ), такт ' + v.takt, 60, by, 26, P.strong, '700');
      var bx = 260, bw = 1300, sc = bw / 130;
      rows.forEach(function (r, i) {
        var yy = by + 30 + i * 100;
        txt(c, r[0], 60, yy + 40, 28, P.strong, '700');
        c.fillStyle = P.line; c.fillRect(bx, yy + 8, r[1] * sc, 28); txt(c, r[1] + ' смин ДО', bx + r[1] * sc + 14, yy + 32, 22, P.muted);
        c.fillStyle = r[2] ? P.good : P.bad; c.fillRect(bx, yy + 44, (r[2] || 0) * sc, 28);
        txt(c, r[2] ? (r[0] === ZT ? '' : L(r[0], 'after') + '–' + r[2]) + ' смин ПОСЛЕ' : 'пост убран', bx + (r[2] || 0) * sc + 14, yy + 68, 22, r[2] ? P.good : P.bad, '700');
      });
      c.strokeStyle = P.acc; c.lineWidth = 3; c.setLineDash([10, 6]); c.beginPath(); c.moveTo(bx + v.takt * sc, by + 24); c.lineTo(bx + v.takt * sc, by + 340); c.stroke(); c.setLineDash([]);
      txt(c, 'такт ' + v.takt, bx + v.takt * sc, by + 360, 22, P.acc, '700', 'center');
      return blob(o.cv);
    }

    /* ---------- экспорт ---------- */
    var MAKE = { '3d-transfer': shot3d, 'yamazumi-51': function () { return yamazumi('51'); }, 'yamazumi-31': function () { return yamazumi('31'); }, 'yamazumi-41': function () { return yamazumi('41'); }, payback: payback, sqctp: sqctp, matrix: matrix, slide: slide };
    function exportPng(kind) {
      try { var f = MAKE[kind]; if (!f) return Promise.reject(new Error('Неизвестный вид: ' + kind)); return f(); } catch (e) { return Promise.reject(e); }
    }
    function download(blobv, name) {
      var a = D.createElement('a'), u = URL.createObjectURL(blobv); a.href = u; a.download = name; D.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
    }
    var pop = bar.querySelector('.kz-pop'), pngBtn = $('#kz-png');
    function popShow(on) { pop.hidden = !on; pngBtn.setAttribute('aria-expanded', on); }
    pngBtn.addEventListener('click', function (e) { e.stopPropagation(); popShow(pop.hidden); });
    D.addEventListener('click', function () { popShow(false); });
    pop.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; var k = b.dataset.k; popShow(false);
      exportPng(k).then(function (bl) { download(bl, 'krause-' + k + '.png'); }, function (er) { try { console.error(er); } catch (x) { /* ignore */ } });
    });

    /* ---------- панель: свернуть, тема, печать ---------- */
    $('#kz-min').addEventListener('click', function () { var m = bar.classList.toggle('kz-min'); popShow(false); this.setAttribute('aria-expanded', !m); });
    $('#kz-theme').addEventListener('click', function () { setTheme(!light); });
    $('#kz-theme').setAttribute('aria-pressed', light);
    $('#kz-print').addEventListener('click', function () { window.print(); });
    var printing = false, pimg = null, wasLight = false;
    function prePrint() {
      if (printing) return; printing = true; wasLight = H.classList.contains('kz-light'); H.classList.add('kz-print', 'kz-light');
      try {
        var cv = K.renderer.domElement, vw = $('#viewer'); K.renderer.render(K.scene, K.camera);
        pimg = new Image(); pimg.id = 'kz-printimg'; pimg.alt = '3D-модель линии'; pimg.src = cv.toDataURL('image/png'); vw.appendChild(pimg);
      } catch (e) { /* без картинки */ }
    }
    function postPrint() {
      if (!printing) return; printing = false; H.classList.remove('kz-print'); H.classList.toggle('kz-light', wasLight); if (pimg) { pimg.remove(); pimg = null; }
    }
    window.addEventListener('beforeprint', prePrint); window.addEventListener('afterprint', postPrint);
    try { var mq = matchMedia('print'); var mh = function (e) { e.matches ? prePrint() : postPrint(); }; mq.addEventListener ? mq.addEventListener('change', mh) : mq.addListener(mh); } catch (e) { /* ignore */ }

    window.__krauseShow = {
      exportPng: exportPng,
      kinds: KINDS.map(function (k) { return k[0]; }),
      setTheme: setTheme,
      tour: { start: start, stop: stop, chapter: chapter, next: function () { nav(1); }, prev: function () { nav(-1); }, state: function () { return { on: S.on, paused: S.paused, t: S.t, ci: S.ci, bi: S.bi, total: S.total, clean: S.clean, speed: S.speed }; }, chapters: function () { return build().map(function (c) { return { title: c.t, dur: c.d, beats: c.b.length }; }); } }
    };
  } catch (err) {
    try { console.error('mod-show', err); } catch (e) { /* ignore */ }
  }
})();
