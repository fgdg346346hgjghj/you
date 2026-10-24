/* Лаборатория: цифровой двойник баланса (P2). Модель, не факт. */
(function () {
  'use strict';
  var root = document.getElementById('lab');
  if (!root) return;

  var CH = '41-1(а)', LIM = '31-10(а)', CAM = '51-7', MODEL = '21179';
  var LS_SC = 'krause-lab-scenario-v1', LS_WEAK = 'krause-lab-weak-v1';
  var PX = 2.8, FOOT = 58;
  var K, kd, TAKT = 79, SMIN_SEC = 0.6;
  var els = [], elById = {}, brigs = [], postBrig = {}, allPosts = [];
  var S = { pos: {}, init: {}, hist: [], sel: null, drag: null, bad: null, tab: 'combo', cand: [] };
  var P2 = { text: '', takt: 79 };
  var active = false, tipTimer = 0;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function q(sel, r) { return (r || root).querySelector(sel); }
  function fmt(x, d) { return String(+Number(x).toFixed(d == null ? 1 : d)).replace('.', ','); }
  function pct(v) { return Math.round(v / TAKT * 100); }
  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* нет доступа к хранилищу */ }
    return null;
  }
  function pidx(p) { var b = brigs.filter(function (x) { return x.id === postBrig[p]; })[0]; return b ? b.posts.indexOf(p) : -1; }

  /* ---------- модель данных ---------- */
  function build() {
    kd = K.kd; TAKT = (kd.const && kd.const.takt) || 79; SMIN_SEC = (kd.const && kd.const.sminSec) || 0.6;
    P2.takt = TAKT;
    var opV = (K.calc && K.calc.opV) || function (o) { return o.v; }, seq = 0;
    brigs = kd.brigades.map(function (b) {
      return { id: b.id, title: b.title, posts: b.posts.filter(function (p) { return kd.posts[p] && !kd.posts[p].offline; }) };
    });
    brigs.forEach(function (b) {
      b.posts.forEach(function (pid) {
        postBrig[pid] = b.id; allPosts.push(pid);
        (kd.posts[pid].ops || []).forEach(function (o, i) {
          var v = opV(o, MODEL);
          if (!(v > 0)) return;
          var e = { id: pid + '#' + i, name: o.t, v: v, k: o.k || 'ОЭ', home: pid, brig: b.id, seq: seq++, grp: o.ch || null, ix: i };
          if (!e.grp && /задающ|диск/i.test(e.name)) e.grp = 'diskname';
          els.push(e); elById[e.id] = e;
        });
      });
    });
    ['31-11', '31-11(а)'].forEach(function (pid) {
      var list = els.filter(function (e) { return e.home === pid; });
      var i0 = -1, a, e, ix;
      list.forEach(function (x, i) { if (i0 < 0 && /датчик фаз|клапан регулир/i.test(x.name)) i0 = i; });
      if (i0 < 0) return;
      a = i0;
      while (a > 0 && /^Взять\/положить/i.test(list[a - 1].name)) a--;
      e = list.length;
      for (ix = i0 + 1; ix < list.length; ix++) if (/рамп/i.test(list[ix].name)) { e = ix; break; }
      for (ix = a; ix < e; ix++) list[ix].grp = 'ph';
    });
    els.forEach(function (e) { S.pos[e.id] = e.home; S.init[e.id] = e.home; });
  }
  function needAfter(e) { return e.grp === 'disc' || e.grp === 'ph' || e.grp === 'diskname'; }

  function canMove(e, to) {
    var from = S.pos[e.id];
    if (from === to) return { ok: false, same: true, why: '' };
    var tb = postBrig[to], hb = e.brig, g = e.grp;
    if (tb === '51') {
      if (hb !== '51' && g !== 'disc' && g !== 'plugs' && g !== 'ph')
        return { ok: false, why: g === 'turn' || g === 'misc'
          ? 'Развороты паллеты и «тип ДВС/кнопка» нужны только посту 41-1(а): в бригаде 51 их нет, при пустом 41-1(а) они исчезают.'
          : 'Операция работает с блоком цилиндров: в бригаду 51 (до установки ГБЦ на блок) её перенести нельзя. В 51 можно только операции на ГБЦ: диск, заглушки 41-1(а), датчик фаз и клапан 31-11.' };
      if (needAfter(e) && pidx(to) <= pidx(CAM))
        return { ok: false, why: 'Распредвалы кладут на ' + CAM + ': задающий диск, датчик фаз и клапан регулировки можно ставить только после ' + CAM + ' (посты 51-8…51-11).' };
      return { ok: true };
    }
    if (hb === '51') return { ok: false, why: 'Операции на ГБЦ остаются в бригаде 51: после установки ГБЦ на блок доступ к ним другой.' };
    if (g === 'disc' && to !== CH && to !== '31-11')
      return { ok: false, why: 'Диск ставят на уже уложенный распредвал: только 41-1(а), 31-11 (вариант А) или бригада 51 после ' + CAM + '.' };
    if (tb === hb) return { ok: true };
    if (e.home === CH && to === '31-11' && (g === 'disc' || g === 'plugs' || g === 'turn')) return { ok: true };
    return { ok: false, why: 'Перенос между бригадами 31 и 41 в модели не рассматривается (другой этап сборки).' };
  }

  function compute(pos) {
    var loads = {}, lists = {}, voidIds = {}, voidSum = 0;
    allPosts.forEach(function (p) { lists[p] = []; loads[p] = 0; });
    els.forEach(function (e) { lists[pos[e.id]].push(e); });
    var core = lists[CH].some(function (e) { return e.grp === 'disc' || e.grp === 'plugs'; });
    allPosts.forEach(function (p) {
      lists[p].sort(function (a, b) { return a.seq - b.seq; });
      lists[p].forEach(function (e) {
        if (p === CH && !core && (e.grp === 'turn' || e.grp === 'misc')) { voidIds[e.id] = 1; voidSum += e.v; } else loads[p] += e.v;
      });
    });
    return { loads: loads, lists: lists, voidIds: voidIds, voidSum: voidSum };
  }
  function metrics(c, posts) {
    var m = { n: 0, sum: 0, over: 0, free: 0, max: 0, maxP: '' };
    posts.forEach(function (p) {
      var L = c.loads[p];
      if (!(L > 0)) return;
      m.n++; m.sum += L; if (L > TAKT) m.over++; else m.free += TAKT - L;
      if (L > m.max) { m.max = L; m.maxP = p; }
    });
    m.avg = m.n ? m.sum / (m.n * TAKT) * 100 : 0;
    return m;
  }

  /* ---------- общая отрисовка столбцов ---------- */
  function elHTML(e, c, interactive, opts) {
    var isVoid = c && c.voidIds[e.id], h = Math.max(2, Math.round(e.v * PX)), cls = 'lab-el lab-' + ({ 'ОЭ': 'oe', 'МД': 'md', 'ВО': 'vo' }[e.k] || 'oe');
    var tip = e.name + ' — ' + fmt(e.v) + ' смин, ' + e.k + (e.home && opts && opts.showHome ? ' (из ' + e.home + ')' : '');
    if (h < 15) cls += ' tiny';
    if (interactive && S.pos[e.id] !== e.home) cls += ' moved';
    if (interactive && S.sel === e.id) cls += ' sel';
    if (isVoid) { cls += ' void'; tip += ' — снимается вместе с постом'; }
    return '<div class="' + cls + '" style="height:' + h + 'px"' + (interactive && !isVoid ? ' role="button" tabindex="0" draggable="true" data-el="' + esc(e.id) + '"' : '') +
      ' title="' + esc(tip) + '"><span class="lab-t">' + esc(e.name) + '</span><b>' + fmt(e.v) + '</b></div>';
  }
  function chartHTML(cols, axis) {
    var H = Math.round(axis * PX);
    return '<div class="lab-chart" style="--lab-h:' + H + 'px;--lab-foot:' + FOOT + 'px"><div class="lab-takt" style="bottom:' + (FOOT + Math.round(TAKT * PX)) + 'px"><span>такт ' + TAKT + '</span></div>' +
      '<div class="lab-cols">' + cols + '</div></div>';
  }
  function footHTML(name, L, emptyNote) {
    var cl = L > TAKT ? ' bad' : '';
    return '<div class="lab-foot' + cl + '"><b>' + esc(name) + '</b>' + (emptyNote ? '<span>' + emptyNote + '</span>' : '<span>' + fmt(L) + '</span><i>' + pct(L) + ' %</i>') + '</div>';
  }
  function overHTML(L) {
    return L > TAKT ? '<div class="lab-over" style="bottom:' + Math.round(TAKT * PX) + 'px;height:' + Math.round((L - TAKT) * PX) + 'px"></div>' : '';
  }
  function kpiHTML(m, b, extra) {
    function d(v, base, lowGood, dec, neutral) {
      if (!b) return '';
      var x = v - base;
      if (Math.abs(x) < 0.05) return '';
      var good = lowGood ? x < 0 : x > 0;
      return ' <small class="' + (neutral ? '' : good ? 'good' : 'bad') + '">' + (x > 0 ? '+' : '−') + fmt(Math.abs(x), dec) + '</small>';
    }
    var items = [
      ['Σ нагрузки, смин', fmt(m.sum, 0) + d(m.sum, b && b.sum, true, 0), ''],
      ['средняя загрузка поста, % такта', fmt(m.avg, 0) + ' %' + d(m.avg, b && b.avg, false, 0), ''],
      ['постов выше такта ' + TAKT, m.over + d(m.over, b && b.over, true, 0), m.over ? 'bad' : 'good'],
      ['свободное время (в постах ниже такта), смин', fmt(m.free, 0) + d(m.free, b && b.free, false, 0, true), ''],
      ['самый нагруженный пост', (m.maxP || '—') + (m.maxP ? ' · ' + fmt(m.max, 0) : ''), m.max > TAKT ? 'bad' : '']
    ];
    return items.map(function (x) { return '<div><b class="' + x[2] + '">' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('') + (extra || '');
  }

  /* ---------- 1. песочница ---------- */
  var TABS = [['combo', '51 + 41-1(а): главный перенос'], ['51', 'Бригада 51'], ['31', 'Бригада 31'], ['41', 'Бригада 41']];
  function tabPosts(t) {
    if (t === 'combo') return [CH].concat(brigs[0].posts);
    return brigs.filter(function (b) { return b.id === t; })[0].posts;
  }
  function ensureSandbox() {
    var s = q('#lab-sb');
    s.innerHTML =
      '<div class="bar-row"><div class="grp lab-tabs" role="group" aria-label="Вид песочницы">' +
      TABS.map(function (t) { return '<button class="b" data-tab="' + t[0] + '" aria-pressed="false">' + t[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="bar-row lab-acts"><button class="b solo" data-act="undo">↶ Отменить (Ctrl+Z)</button><button class="b solo" data-act="reset">Сбросить</button>' +
      '<button class="b solo" data-act="save">Сохранить сценарий</button><button class="b solo" data-act="load">Загрузить сохранённый</button>' +
      '<button class="b solo" data-act="json">Экспорт JSON</button><button class="b solo" data-act="csv">Экспорт CSV</button>' +
      '<button class="b solo lab-acc" data-act="cand">Найти кандидатов</button></div>' +
      '<p class="hint lab-help">Перетащите блок элемента на другой пост или нажмите на блок (выбор) и затем на нужный пост. Esc — снять выбор. Высота блока пропорциональна смин; красная штриховка — выше такта.</p>' +
      '<div class="lab-legend"><i class="lab-oe"></i>ОЭ <i class="lab-md"></i>МД <i class="lab-vo"></i>ВО <i class="lab-mv"></i>перенесён <i class="lab-vd"></i>снимается</div>' +
      '<div class="lab-msg" id="lab-msg" role="status" aria-live="polite"></div>' +
      '<div class="lab-scroll"><div id="lab-chart"></div></div>' +
      '<div class="lab-info hint" id="lab-info">Наведите на блок, чтобы увидеть элемент.</div>' +
      '<div class="kpi lab-kpi" id="lab-kpi"></div><p class="hint" id="lab-line"></p>' +
      '<div id="lab-cand"></div>';
  }
  function renderSandbox() {
    var c = compute(S.pos), b = compute(S.init), posts = tabPosts(S.tab), mx = 0;
    posts.forEach(function (p) { mx = Math.max(mx, c.loads[p]); });
    var axis = Math.max(110, Math.ceil(mx / 10) * 10 + 10);
    var cols = posts.map(function (p, i) {
      var L = c.loads[p], list = c.lists[p], real = list.filter(function (e) { return !c.voidIds[e.id]; }), vd = list.filter(function (e) { return c.voidIds[e.id]; });
      var gone = L === 0, note = gone ? (p === CH && vd.length ? 'снят' : 'пусто') : '';
      var sep = S.tab === 'combo' && i === 1 ? ' lab-sep' : '';
      return '<div class="lab-col' + (gone ? ' gone' : '') + (L > TAKT ? ' over' : '') + sep + '" data-post="' + esc(p) + '" tabindex="0" role="group" aria-label="Пост ' + esc(p) + ', ' + fmt(L) + ' смин, ' + pct(L) + ' % такта">' +
        '<div class="lab-stack" style="height:var(--lab-h)">' + overHTML(L) +
        real.map(function (e) { return elHTML(e, c, true, { showHome: true }); }).join('') + vd.map(function (e) { return elHTML(e, c, true); }).join('') + '</div>' +
        footHTML(p, L, note) + '</div>';
    }).join('');
    q('#lab-chart').innerHTML = chartHTML(cols, axis);
    var m = metrics(c, posts), mb = metrics(b, posts), ml = metrics(c, allPosts), mlb = metrics(b, allPosts);
    var extra = c.voidSum ? '<div class="kpi-now" style="grid-column:1/-1">Снято: <b>' + fmt(c.voidSum, 0) + ' смин</b> дополнительных действий 41-1(а) (развороты паллеты, тип ДВС/кнопка) — пост 41-1(а) освобождён, как в основном анализе.</div>' : '';
    q('#lab-kpi').innerHTML = kpiHTML(m, mb, extra);
    q('#lab-line').innerHTML = 'Вся линия (3 бригады, ' + ml.n + ' постов): Σ ' + fmt(ml.sum, 0) + ' смин · средняя ' + fmt(ml.avg, 0) + ' % такта · выше такта: ' + ml.over + ' · свободно ' + fmt(ml.free, 0) + ' смин. Исходно: Σ ' + fmt(mlb.sum, 0) + ', выше такта ' + mlb.over + ', постов ' + mlb.n + '. <span class="tg ta">модель, не факт</span>';
    Array.prototype.forEach.call(root.querySelectorAll('[data-tab]'), function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-tab') === S.tab ? 'true' : 'false'); });
    q('[data-act="undo"]').disabled = !S.hist.length;
    q('[data-act="undo"]').style.opacity = S.hist.length ? '' : '.45';
    markTargets();
  }
  function markTargets() {
    var e = S.sel && elById[S.sel];
    Array.prototype.forEach.call(root.querySelectorAll('.lab-col'), function (col) {
      col.classList.remove('ok', 'no');
      if (e) { var r = canMove(e, col.getAttribute('data-post')); if (!r.same) col.classList.add(r.ok ? 'ok' : 'no'); }
    });
  }
  function msg(t, bad) {
    var m = q('#lab-msg'); if (!m) return;
    m.textContent = t; m.className = 'lab-msg' + (bad ? ' bad' : '');
  }
  function showTip(t, x, y) {
    var tip = q('#lab-tip'); if (!tip) return;
    tip.textContent = t; tip.hidden = false;
    var w = Math.min(320, window.innerWidth - 16);
    tip.style.maxWidth = w + 'px';
    tip.style.left = Math.max(8, Math.min(x + 14, window.innerWidth - w - 8)) + 'px';
    tip.style.top = Math.max(8, Math.min(y + 14, window.innerHeight - 90)) + 'px';
    clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 3500);
  }
  function hideTip() { var tip = q('#lab-tip'); if (tip) tip.hidden = true; }
  function pushHist() { S.hist.push(JSON.stringify(S.pos)); if (S.hist.length > 200) S.hist.shift(); }
  function undo() {
    if (!S.hist.length) { msg('Отменять нечего.'); return; }
    S.pos = JSON.parse(S.hist.pop()); S.sel = null; renderSandbox(); msg('Последнее действие отменено.');
  }
  function doMove(id, to) {
    var e = elById[id], r = canMove(e, to);
    if (!r.ok) { return false; }
    pushHist(); S.pos[id] = to; S.sel = null; renderSandbox();
    msg('Перенесено: «' + e.name + '» (' + fmt(e.v) + ' смин) → ' + to + '. Загрузка ' + to + ': ' + fmt(compute(S.pos).loads[to]) + ' смин.');
    return true;
  }
  function tryMove(id, to, x, y) {
    var e = elById[id], r = canMove(e, to);
    if (r.same) { S.sel = null; renderSandbox(); return; }
    if (!r.ok) { msg('Отказ: ' + r.why, true); showTip(r.why, x || 200, y || 200); return; }
    doMove(id, to);
  }
  function resetAll() { pushHist(); S.pos = JSON.parse(JSON.stringify(S.init)); S.sel = null; renderSandbox(); msg('Сценарий сброшен к исходному.'); }
  function save() {
    var mv = {};
    els.forEach(function (e) { if (S.pos[e.id] !== e.home) mv[e.id] = S.pos[e.id]; });
    ls(LS_SC, JSON.stringify({ v: 1, model: MODEL, saved: new Date().toISOString(), moves: mv }));
    msg('Сценарий сохранён в браузере (перенесено элементов: ' + Object.keys(mv).length + ').');
  }
  function load() {
    var raw = ls(LS_SC), d;
    if (!raw) { msg('Сохранённого сценария нет.', true); return; }
    try { d = JSON.parse(raw); } catch (e) { msg('Сохранённый сценарий повреждён.', true); return; }
    pushHist(); S.pos = JSON.parse(JSON.stringify(S.init));
    Object.keys(d.moves || {}).forEach(function (id) { if (elById[id] && allPosts.indexOf(d.moves[id]) >= 0) S.pos[id] = d.moves[id]; });
    S.sel = null; renderSandbox(); msg('Сценарий загружен.');
  }
  function dl(name, mime, text) {
    var blob = new Blob([text], { type: mime }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  function exportRows() {
    var c = compute(S.pos);
    return { c: c, moves: els.filter(function (e) { return S.pos[e.id] !== e.home; }) };
  }
  function exportJSON() {
    var x = exportRows(), m = metrics(x.c, allPosts);
    var out = {
      title: 'Цифровой двойник баланса: сценарий', label: 'модель, не факт; гипотеза — нужно подтверждение технолога',
      model: MODEL, takt: TAKT, unit: 'смин (секунды × ' + SMIN_SEC + ')', created: new Date().toISOString(),
      moves: x.moves.map(function (e) { return { element: e.name, smin: e.v, category: e.k, from: e.home, to: S.pos[e.id] }; }),
      posts: allPosts.map(function (p) {
        return { post: p, load: x.c.loads[p], pctTakt: pct(x.c.loads[p]), overTakt: x.c.loads[p] > TAKT,
          elements: x.c.lists[p].map(function (e) { return { name: e.name, smin: e.v, category: e.k, home: e.home, removed: !!x.c.voidIds[e.id] }; }) };
      }),
      totals: { posts: m.n, sum: m.sum, avgPctTakt: Math.round(m.avg * 10) / 10, postsOverTakt: m.over, freeTime: m.free, removedSmin: x.c.voidSum }
    };
    var t = JSON.stringify(out, null, 2);
    dl('krause-balance-scenario.json', 'application/json', t);
    msg('Экспорт JSON: ' + t.length + ' символов.');
    return t;
  }
  function exportCSV() {
    var x = exportRows(), rows = [['пост', 'элемент', 'смин', 'категория', 'исходный пост', 'снимается']];
    allPosts.forEach(function (p) {
      x.c.lists[p].forEach(function (e) { rows.push([p, e.name, String(e.v).replace('.', ','), e.k, e.home, x.c.voidIds[e.id] ? 'да' : '']); });
    });
    var t = '\ufeff' + rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
    dl('krause-balance-scenario.csv', 'text/csv;charset=utf-8', t);
    msg('Экспорт CSV: ' + (rows.length - 1) + ' строк.');
    return t;
  }

  /* ---------- кандидаты ---------- */
  var RISK = {
    disc: 'доступ к торцу распредвала на ГБЦ вне блока; задающий диск легко повредить при установке ГБЦ на блок; нужен гайковёрт на новом посту',
    plugs: 'герметик под заглушками: время до установки ГБЦ на блок; риск смещения или загрязнения заглушек при установке ГБЦ на блок; доступ к торцу ГБЦ',
    ph: 'датчик фаз и клапан регулировки выступают из ГБЦ: риск повреждения при установке ГБЦ на блок; доступ к местам крепления; смена насадок и инструмента'
  };
  var GNAME = { disc: 'Задающий диск', plugs: 'Заглушки + протирка', ph: 'Датчик фаз и клапан регулировки р/вала' };
  function gname(b) { return GNAME[b.grp] + (b.grp === 'ph' && b.els.some(function (e) { return /насадк/i.test(e.name); }) ? ' (с заменой насадок)' : ''); }
  function bundles(c) {
    var map = {}, out = [];
    els.forEach(function (e) {
      var p = S.pos[e.id];
      if (postBrig[p] === '51' || (e.grp !== 'disc' && e.grp !== 'plugs' && e.grp !== 'ph')) return;
      var k = e.home + '|' + e.grp;
      if (!map[k]) { map[k] = { key: k, grp: e.grp, home: e.home, els: [], v: 0 }; out.push(map[k]); }
      map[k].els.push(e); map[k].v += e.v;
    });
    return out;
  }
  function findCandidates() {
    var c = compute(S.pos), bs = bundles(c), rows = [], p51 = brigs[0].posts, camI = pidx(CAM);
    S.cand = [];
    function targets(b, loads) {
      return p51.filter(function (p) { return (b.grp === 'plugs' || pidx(p) > camI) && loads[p] + b.v <= TAKT; })
        .map(function (p) { return { p: p, free: TAKT - loads[p] }; }).sort(function (a, z) { return z.free - a.free; });
    }
    function add(h) { h.i = S.cand.length; S.cand.push(h.moves); rows.push(h); }
    bs.forEach(function (b) {
      var t = targets(b, c.loads).slice(0, 3), srcL = c.loads[b.home];
      if (!t.length) rows.push({ txt: gname(b) + ' (' + b.home + ', ' + fmt(b.v, 0) + ' смин)', to: 'нет поста в 51' + (b.grp === 'plugs' ? '' : ' после ' + CAM) + ', где поместится целиком', load: '—', risk: RISK[b.grp] });
      t.forEach(function (x) {
        add({ txt: gname(b) + ' (' + b.home + ', ' + fmt(b.v, 0) + ' смин)', to: x.p + ' (свободно ' + fmt(x.free, 0) + ')', load: x.p + ': ' + fmt(c.loads[x.p], 0) + ' → ' + fmt(c.loads[x.p] + b.v, 0) + ' (' + pct(c.loads[x.p] + b.v) + ' %); ' + b.home + ': ' + fmt(srcL, 0) + ' → ' + fmt(srcL - b.v, 0),
          risk: RISK[b.grp], moves: b.els.map(function (e) { return [e.id, x.p]; }) });
      });
    });
    var ph = bs.filter(function (b) { return b.grp === 'ph'; });
    if (ph.length > 1) {
      var tot = ph.reduce(function (s, b) { return s + b.v; }, 0), loads = JSON.parse(JSON.stringify(c.loads)), mv = [], parts = [], okAll = true;
      ph.slice().sort(function (a, z) { return z.v - a.v; }).forEach(function (b) {
        var t = targets(b, loads);
        if (!t.length) { okAll = false; return; }
        loads[t[0].p] += b.v; parts.push(b.home + ' (' + fmt(b.v, 0) + ') → ' + t[0].p + ': ' + fmt(loads[t[0].p], 0));
        b.els.forEach(function (e) { mv.push([e.id, t[0].p]); });
      });
      if (okAll) add({ txt: 'Комплект датчик фаз + клапан (31-11 и 31-11(а)): ' + fmt(tot, 0) + ' смин вместе с заменой инструмента, разнести на два поста', to: 'два разных поста 51 после ' + CAM, load: parts.join('; '), risk: RISK.ph, moves: mv });
      else rows.push({ txt: 'Комплект датчик фаз + клапан: ' + fmt(tot, 0) + ' смин', to: 'целиком в один пост 51 не помещается', load: '—', risk: RISK.ph });
    }
    var main = kd.chunks.filter(function (ch) { return ch.dest && ch.dest.after; }), mm = [], desc = [], free = true;
    main.forEach(function (ch) {
      els.forEach(function (e) { if (e.home === CH && e.grp === ch.id && S.pos[e.id] === CH) mm.push([e.id, ch.dest.after]); });
      desc.push(ch.short + ' → ' + ch.dest.after);
    });
    if (mm.length) {
      var s2 = JSON.parse(JSON.stringify(S.pos)); mm.forEach(function (x) { s2[x[0]] = x[1]; });
      var c2 = compute(s2), ok = mm.every(function (x) { return canMove(elById[x[0]], x[1]).ok; });
      if (ok) add({ txt: 'Как в основном анализе: ' + desc.join(', ') + '; 41-1(а) освобождается (−' + fmt(c2.voidSum, 0) + ' смин доп. действий)',
        to: main.map(function (ch) { return ch.dest.after; }).join(' и '), load: main.map(function (ch) { return ch.dest.after + ': ' + fmt(c.loads[ch.dest.after], 0) + ' → ' + fmt(c2.loads[ch.dest.after], 0); }).join('; '),
        risk: RISK.disc + '; ' + RISK.plugs, moves: mm });
    }
    var h = '<h4>Кандидаты на перенос <span class="tg tv">гипотеза — нужно подтверждение технолога</span> <span class="tg ta">модель, не факт</span></h4>';
    if (!rows.length) h += '<p class="hint">При текущем сценарии кандидатов на ГБЦ в бригадах 31 и 41 не осталось.</p>';
    else h += '<div class="scroll"><table class="lab-tbl"><thead><tr><th>Гипотеза</th><th>Куда</th><th>Новая загрузка, смин</th><th>Риски (доступ, повреждение при установке ГБЦ на блок)</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + esc(r.txt) + '</td><td>' + esc(r.to) + '</td><td class="lab-mono">' + esc(r.load) + '</td><td class="how">' + esc(r.risk) + '. <b>Нужно подтверждение технолога.</b></td><td>' +
          (r.moves ? '<button class="b solo" data-apply="' + r.i + '">Применить</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="hint">Свободное время считается от такта ' + TAKT + ' смин по текущему сценарию. Применить — перенос в песочнице (отменяется Ctrl+Z).</p>';
    q('#lab-cand').innerHTML = h;
  }
  function applyCand(i) {
    var mv = S.cand[i]; if (!mv) return;
    var okAll = mv.every(function (x) { return canMove(elById[x[0]], x[1]).ok || S.pos[x[0]] === x[1]; });
    if (!okAll) { msg('Отказ: перенос нарушает правила порядка.', true); return; }
    pushHist(); mv.forEach(function (x) { S.pos[x[0]] = x[1]; }); S.sel = null; renderSandbox(); findCandidates();
    msg('Применено переносов: ' + mv.length + '. Это гипотеза — нужно подтверждение технолога.');
  }

  /* ---------- события песочницы ---------- */
  function bindSandbox() {
    var s = q('#lab-sb');
    s.addEventListener('click', function (ev) {
      var t = ev.target, tab = t.closest('[data-tab]'), act = t.closest('[data-act]'), ap = t.closest('[data-apply]');
      if (tab) { S.tab = tab.getAttribute('data-tab'); renderSandbox(); return; }
      if (ap) { applyCand(+ap.getAttribute('data-apply')); return; }
      if (act) {
        var a = act.getAttribute('data-act');
        if (a === 'undo') undo(); else if (a === 'reset') resetAll(); else if (a === 'save') save(); else if (a === 'load') load();
        else if (a === 'json') exportJSON(); else if (a === 'csv') exportCSV(); else if (a === 'cand') findCandidates();
        return;
      }
      var col = t.closest('.lab-col'), el = t.closest('.lab-el');
      if (!col) return;
      if (S.sel && (!el || el.getAttribute('data-el') !== S.sel)) { tryMove(S.sel, col.getAttribute('data-post'), ev.clientX, ev.clientY); return; }
      if (el && el.getAttribute('data-el')) {
        var id = el.getAttribute('data-el'); S.sel = S.sel === id ? null : id; renderSandbox();
        var n = S.sel && q('[data-el="' + S.sel.replace(/"/g, '\\"') + '"]'); if (n) n.focus();
        if (S.sel) msg('Выбрано: «' + elById[id].name + '». Нажмите на пост назначения (подсвечены допустимые).');
      }
    });
    s.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if (ev.key === 'Escape' && S.sel) { S.sel = null; renderSandbox(); return; }
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      if (t.classList && t.classList.contains('lab-el')) { ev.preventDefault(); t.click(); }
      else if (t.classList && t.classList.contains('lab-col') && S.sel) {
        ev.preventDefault(); var r = t.getBoundingClientRect(); tryMove(S.sel, t.getAttribute('data-post'), r.left + 20, r.top + 20);
        var nc = q('.lab-col[data-post="' + t.getAttribute('data-post') + '"]'); if (nc) nc.focus();
      }
    });
    s.addEventListener('mouseover', function (ev) {
      var el = ev.target.closest && ev.target.closest('.lab-el'), i = q('#lab-info');
      if (el && el.getAttribute('data-el')) {
        var e = elById[el.getAttribute('data-el')];
        i.textContent = e.name + ' — ' + fmt(e.v) + ' смин, ' + e.k + '; исходный пост ' + e.home + ', сейчас ' + S.pos[e.id] + (e.grp === 'ph' || e.grp === 'disc' ? ' (ставить после ' + CAM + ')' : '');
      }
    });
    s.addEventListener('dragstart', function (ev) {
      var el = ev.target.closest && ev.target.closest('.lab-el');
      if (!el || !el.getAttribute('data-el')) { ev.preventDefault(); return; }
      S.drag = el.getAttribute('data-el'); S.bad = null;
      ev.dataTransfer.setData('text/plain', S.drag); ev.dataTransfer.effectAllowed = 'move';
      S.sel = S.drag; markTargets();
    });
    s.addEventListener('dragover', function (ev) {
      var col = ev.target.closest && ev.target.closest('.lab-col');
      if (!col || !S.drag) return;
      var r = canMove(elById[S.drag], col.getAttribute('data-post'));
      ev.preventDefault();
      ev.dataTransfer.dropEffect = r.ok ? 'move' : 'none';
      if (!r.ok && !r.same) { S.bad = r.why; showTip(r.why, ev.clientX, ev.clientY); } else { S.bad = null; hideTip(); }
    });
    s.addEventListener('drop', function (ev) {
      var col = ev.target.closest && ev.target.closest('.lab-col');
      if (!col || !S.drag) return;
      ev.preventDefault(); var id = S.drag; S.drag = null; S.bad = null;
      tryMove(id, col.getAttribute('data-post'), ev.clientX, ev.clientY);
    });
    s.addEventListener('dragend', function () {
      var bad = S.bad; S.drag = null; S.bad = null;
      if (bad) msg('Отказ: ' + bad, true);
      S.sel = null; renderSandbox();
    });
    document.addEventListener('pointerdown', function (ev) { active = root.contains(ev.target); }, true);
    root.addEventListener('focusin', function () { active = true; });
    document.addEventListener('keydown', function (ev) {
      if (!active || !(ev.ctrlKey || ev.metaKey) || ev.shiftKey || (ev.code !== 'KeyZ' && ev.key !== 'z' && ev.key !== 'я')) return;
      var t = ev.target; if (t && /^(TEXTAREA|INPUT|SELECT)$/.test(t.tagName)) return;
      ev.preventDefault(); undo();
    });
  }

  /* ---------- 2. вставка из Excel ---------- */
  function num(s) {
    s = String(s == null ? '' : s).replace(/[\s\u00a0%]/g, '').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    var n = +s; return n >= 0 ? n : null;
  }
  function normCat(s) {
    var u = String(s || '').trim().toUpperCase().replace(/O/g, 'О').replace(/[EЕ]/g, 'Э').replace(/M/g, 'М').replace(/D/g, 'Д').replace(/B/g, 'В');
    return u === 'ОЭ' || u === 'МД' || u === 'ВО' ? u : null;
  }
  function parseTable(text) {
    var lines = text.replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); }), errs = [], posts = [], map = {}, fmtB = false, hdr = false;
    var d = /\t/.test(text) ? '\t' : /;/.test(text) ? ';' : ',';
    var rows = lines.map(function (l) { return l.split(d).map(function (x) { return x.trim().replace(/^"|"$/g, ''); }); });
    if (rows.length) {
      var r0 = rows[0];
      if (r0.length >= 3 && num(r0[2]) === null) { hdr = true; fmtB = /^О[ЭE]|^OE/i.test(r0[1] || ''); }
    }
    rows.forEach(function (r, i) {
      if (hdr && i === 0) return;
      var post = r[0], items = [];
      if (!post || r.length < 3) { errs.push('строка ' + (i + 1) + ': меньше трёх столбцов'); return; }
      var n1 = num(r[1]), n2 = num(r[2]), n3 = r.length > 3 ? num(r[3]) : null;
      if (fmtB || (n1 !== null && n2 !== null && n3 !== null)) {
        if (n1 === null || n2 === null || n3 === null) { errs.push('строка ' + (i + 1) + ': ожидались числа ОЭ, МД, ВО'); return; }
        [['ОЭ', n1], ['МД', n2], ['ВО', n3]].forEach(function (x) { if (x[1] > 0) items.push({ name: x[0], v: x[1], k: x[0] }); });
      } else {
        var v = num(r[2]);
        if (v === null) { errs.push('строка ' + (i + 1) + ': «' + r[2] + '» — не число смин'); return; }
        var cat = r.length > 3 ? normCat(r[3]) : 'ОЭ';
        if (!cat) { errs.push('строка ' + (i + 1) + ': категория «' + r[3] + '» не ОЭ/МД/ВО'); return; }
        items.push({ name: r[1] || '—', v: v, k: cat });
      }
      if (!map[post]) { map[post] = { name: post, items: [], sum: 0 }; posts.push(map[post]); }
      items.forEach(function (it) { map[post].items.push(it); map[post].sum += it.v; });
    });
    return { posts: posts, errs: errs, fmtB: fmtB, hdr: hdr };
  }
  var SAMPLE = 'пост\tэлемент\tсмин\tкатегория\n' +
    'А-1\tВзять деталь\t6\tОЭ\nА-1\tУстановить деталь\t30\tОЭ\nА-1\tВзять/положить инструмент\t8\tМД\nА-1\tЗатянуть 4 болта\t22\tОЭ\n' +
    'А-2\tУстановить крышку\t28\tОЭ\nА-2\tПеремещение к стеллажу\t14\tМД\nА-2\tЗатянуть болты\t26\tОЭ\nА-2\tОжидание детали\t6\tВО\n' +
    'А-3\tНанести герметик\t20\tОЭ\nА-3\tСменить насадку\t10\tМД\nА-3\tУстановить заглушки\t30\tОЭ\nА-3\tУстановить жгут\t24\tОЭ\nА-3\tПротереть\t8\tМД\n' +
    'А-4\tПроверить момент\t18\tОЭ\nА-4\tПеремещение паллеты\t6\tМД\nА-4\tМаркировка\t12\tОЭ';
  function renderPaste() {
    var res = parseTable(P2.text), out = q('#lab-p2out'), tk = P2.takt > 0 ? P2.takt : TAKT, save = TAKT;
    if (!res.posts.length) {
      out.innerHTML = '<p class="hint">Вставьте таблицу: пост, элемент, смин, категория (ОЭ/МД/ВО) или пост, ОЭ, МД, ВО. Заголовок можно не вставлять, десятичная запятая допускается.</p>' + (res.errs.length ? '<ul class="notes">' + res.errs.slice(0, 6).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '');
      return;
    }
    TAKT = tk;
    var mx = 0, loads = {};
    res.posts.forEach(function (p) { loads[p.name] = p.sum; mx = Math.max(mx, p.sum); });
    var axis = Math.max(Math.ceil(tk * 1.1 / 10) * 10, Math.ceil(mx / 10) * 10 + 10);
    var cols = res.posts.map(function (p) {
      var blocks = p.items.map(function (it, i) { return elHTML({ id: p.name + i, name: it.name, v: it.v, k: it.k }, null, false); }).join('');
      return '<div class="lab-col static' + (p.sum > tk ? ' over' : '') + '"><div class="lab-stack" style="height:var(--lab-h)">' + overHTML(p.sum) + blocks + '</div>' + footHTML(p.name, p.sum) + '</div>';
    }).join('');
    var c = { loads: loads }, m = metrics(c, res.posts.map(function (p) { return p.name; }));
    var cat = { 'ОЭ': 0, 'МД': 0, 'ВО': 0 };
    res.posts.forEach(function (p) { p.items.forEach(function (it) { cat[it.k] += it.v; }); });
    var tbl = '<div class="scroll"><table class="lab-tbl"><thead><tr><th>Пост</th><th>ОЭ</th><th>МД</th><th>ВО</th><th>Σ</th><th>% такта</th></tr></thead><tbody>' +
      res.posts.map(function (p) {
        var a = { 'ОЭ': 0, 'МД': 0, 'ВО': 0 }; p.items.forEach(function (it) { a[it.k] += it.v; });
        return '<tr' + (p.sum > tk ? ' class="gone"' : '') + '><td class="p">' + esc(p.name) + '</td><td class="lab-mono">' + fmt(a['ОЭ']) + '</td><td class="lab-mono">' + fmt(a['МД']) + '</td><td class="lab-mono">' + fmt(a['ВО']) + '</td><td class="lab-mono"><b>' + fmt(p.sum) + '</b></td><td class="lab-mono">' + Math.round(p.sum / tk * 100) + ' %</td></tr>';
      }).join('') + '</tbody><tfoot><tr><td>Итого</td><td class="lab-mono">' + fmt(cat['ОЭ']) + '</td><td class="lab-mono">' + fmt(cat['МД']) + '</td><td class="lab-mono">' + fmt(cat['ВО']) + '</td><td class="lab-mono">' + fmt(m.sum) + '</td><td class="lab-mono">' + fmt(m.avg, 0) + ' %</td></tr></tfoot></table></div>';
    out.innerHTML = '<div class="lab-scroll">' + chartHTML(cols, axis)+ '</div>' +
      '<div class="kpi lab-kpi">' + kpiHTML(m, null) + '</div>' +
      '<p class="hint">Постов: ' + res.posts.length + ' · формат: ' + (res.fmtB ? 'пост, ОЭ, МД, ВО' : 'пост, элемент, смин, категория') + (res.errs.length ? ' · пропущено строк: ' + res.errs.length : '') + '.</p>' +
      (res.errs.length ? '<ul class="notes">' + res.errs.slice(0, 6).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '') + tbl;
    TAKT = save;
  }
  function bindPaste() {
    var ta = q('#lab-ta'), tk = q('#lab-takt-in'), t0 = 0;
    function upd() { P2.text = ta.value; P2.takt = num(tk.value) || TAKT; renderPaste(); }
    ta.addEventListener('input', function () { clearTimeout(t0); t0 = setTimeout(upd, 120); });
    ta.addEventListener('paste', function () { setTimeout(upd, 0); });
    tk.addEventListener('input', upd);
    q('#lab-sample').addEventListener('click', function () { ta.value = SAMPLE; upd(); });
    q('#lab-clear').addEventListener('click', function () { ta.value = ''; upd(); });
  }

  /* ---------- 3. очереди ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Линия с конечными буферами и блокировкой после операции. Время в смин.
  function simulate(norm, noise, buf, pace, T, U, qi) {
    var m = norm.length, J = Math.floor(T / pace) + 2, s = new Float64Array(J * m), c = new Float64Array(J * m), d = new Float64Array(J * m), j, i;
    for (j = 0; j < J; j++) {
      for (i = 0; i < m; i++) {
        var arr = i === 0 ? j * pace : d[j * m + i - 1], free = j > 0 ? d[(j - 1) * m + i] : 0, st = Math.max(arr, free);
        var cc = st + norm[i] * (1 + noise * (2 * U[j * m + i] - 1)), dep = cc, k = j - buf - 1;
        if (i < m - 1 && k >= 0) dep = Math.max(cc, s[k * m + i + 1]);
        s[j * m + i] = st; c[j * m + i] = cc; d[j * m + i] = dep;
      }
    }
    var out = 0, busy = new Float64Array(m), bins = 240, bw = T / bins, qs = new Float64Array(bins), sumQ = 0, maxQ = 0, blk = 0;
    for (j = 0; j < J; j++) {
      if (c[j * m + m - 1] <= T) out++;
      for (i = 0; i < m; i++) busy[i] += Math.max(0, Math.min(c[j * m + i], T) - Math.min(s[j * m + i], T));
      if (qi > 0) {
        var a0 = c[j * m + qi - 1], a1 = s[j * m + qi], b0, b1;
        if (a1 > a0 && a0 < T) {
          a1 = Math.min(a1, T); b0 = Math.floor(a0 / bw); b1 = Math.min(bins - 1, Math.floor(a1 / bw));
          for (var b = b0; b <= b1; b++) qs[b] += Math.max(0, Math.min(a1, (b + 1) * bw) - Math.max(a0, b * bw));
          blk += a1 - a0;
        }
      }
    }
    for (i = 0; i < bins; i++) { qs[i] /= bw; if (qs[i] > maxQ) maxQ = qs[i]; }
    sumQ = blk / T;
    return { out: out, util: Array.prototype.map.call(busy, function (x) { return x / T; }), q: qs, meanQ: sumQ, maxQ: maxQ };
  }
  function ensureQ() {
    var sd = kd.sheetDATA || {}, shiftMin = sd.availMin || 460;
    q('#lab-qsb').innerHTML =
      '<div class="lab-ctl">' +
      '<label>Линия <select id="lab-q-scope"><option value="2">бригады 31 и 41</option><option value="3">все три бригады</option></select></label>' +
      '<label>Разброс времени, ± % <input class="lab-in" id="lab-q-n" type="number" min="0" max="50" value="10"></label>' +
      '<label>Буфер между постами, шт. <input class="lab-in" id="lab-q-b" type="number" min="0" max="10" value="1"></label>' +
      '<label>Смена, мин <input class="lab-in" id="lab-q-t" type="number" min="60" max="1000" value="' + shiftMin + '"></label>' +
      '<label>Темп подачи <select id="lab-q-p"><option value="own">по самому медленному посту сценария</option><option value="same">одинаковый (максимум ДО)</option></select></label>' +
      '<label>Начальное число <input class="lab-in" id="lab-q-seed" type="number" min="1" value="41"></label>' +
      '<button class="b solo" id="lab-q-run">Перезапустить</button></div>' +
      '<div class="lab-ctl"><label>31-10(а) после «Идеи 2»: <output id="lab-q-vo">71</output> смин <input id="lab-q-i" type="range" min="66" max="76" value="71" step="1"></label>' +
      '<span class="hint">31-1: 81 → 75 смин. Нормы — суммы элементов, модель ' + MODEL + '.</span></div>' +
      '<div id="lab-q-out"></div>';
  }
  function renderQ() {
    var out = q('#lab-q-out'); if (!out) return;
    var nb = +q('#lab-q-scope').value, noise = Math.max(0, Math.min(50, +q('#lab-q-n').value || 0)) / 100, buf = Math.max(0, Math.min(10, Math.round(+q('#lab-q-b').value || 0)));
    var T = Math.max(60, +q('#lab-q-t').value || 460) * 60 / SMIN_SEC, seed = Math.max(1, Math.round(+q('#lab-q-seed').value || 1)), i2 = +q('#lab-q-i').value;
    q('#lab-q-vo').textContent = i2;
    var c0 = compute(S.init), ids = [];
    brigs.slice(nb === 2 ? 1 : 0).forEach(function (b) { ids = ids.concat(b.posts); });
    var norm0 = ids.map(function (p) { return c0.loads[p]; }), norm1 = ids.map(function (p) { return p === LIM ? i2 : p === '31-1' ? 75 : c0.loads[p]; });
    var qi = ids.indexOf(LIM);
    if (qi < 1) { out.innerHTML = '<p class="hint">Пост ' + LIM + ' не найден в линии.</p>'; return; }
    var mx0 = Math.max.apply(null, norm0), mx1 = Math.max.apply(null, norm1);
    var same = q('#lab-q-p').value === 'same', p0 = mx0, p1 = same ? mx0 : mx1;
    var t0 = performance.now(), rnd = rng(seed), J = Math.floor(T / Math.min(p0, p1)) + 3, U = new Float64Array(J * ids.length), k;
    for (k = 0; k < U.length; k++) U[k] = rnd();
    var A = simulate(norm0, noise, buf, p0, T, U, qi), B = simulate(norm1, noise, buf, p1, T, U, qi), ms = performance.now() - t0;
    function avg(x) { return x.reduce(function (s, v) { return s + v; }, 0) / x.length; }
    function row(n, a, b, f, good) { return '<tr><td>' + n + '</td><td class="lab-mono">' + f(a) + '</td><td class="lab-mono">' + f(b) + '</td><td class="lab-mono">' + (good ? good(a, b) : '') + '</td></tr>'; }
    function dlt(a, b, d, unit) { var x = b - a; return (x >= 0 ? '+' : '−') + fmt(Math.abs(x), d) + (unit || ''); }
    var f0 = function (x) { return fmt(x, 0); }, fp = function (x) { return fmt(x * 100, 0) + ' %'; }, f2 = function (x) { return fmt(x, 2); };
    var tbl = '<div class="scroll"><table class="lab-tbl"><thead><tr><th>Показатель за смену (' + fmt(T * SMIN_SEC / 60, 0) + ' мин)</th><th>ДО</th><th>ПОСЛЕ «Идея 2»</th><th>Разница</th></tr></thead><tbody>' +
      row('Темп подачи (интервал), смин', p0, p1, f0) +
      row('Выпуск за смену, шт.', A.out, B.out, f0, function (a, b) { return dlt(a, b, 0, ' шт.'); }) +
      row('Средняя загрузка постов', avg(A.util), avg(B.util), fp, function (a, b) { return dlt(a * 100, b * 100, 0, ' п.п.'); }) +
      row('Загрузка ' + LIM, A.util[qi], B.util[qi], fp, function (a, b) { return dlt(a * 100, b * 100, 0, ' п.п.'); }) +
      row('Ожидают перед ' + LIM + ': в среднем, шт.', A.meanQ, B.meanQ, f2, function (a, b) { return dlt(a, b, 2); }) +
      row('Ожидают перед ' + LIM + ': максимум по отрезкам смены, шт.', A.maxQ, B.maxQ, f2) + '</tbody></table></div>';
    out.innerHTML = tbl + queueSVG(A, B, T, buf, qi, ids) +
      '<p class="hint">Расчёт занял ' + fmt(ms, 0) + ' мс · начальное число ' + seed + ' (одни и те же случайные множители для ДО и ПОСЛЕ). Каждое время поста = норма × (1 ± до ' + fmt(noise * 100, 0) + ' %). <span class="tg ta">модель, не факт</span> — это не прогноз завода, а проверка идеи.</p>';
  }
  function queueSVG(A, B, T, buf, qi, ids) {
    var W = 720, H = 190, L = 40, R = 10, Tp = 12, Bt = 28, bins = A.q.length, top = Math.max(buf + 1, A.maxQ, B.maxQ, 1), pw = W - L - R, ph = H - Tp - Bt, g = '';
    function path(a, cls) {
      var d = '';
      for (var i = 0; i < bins; i++) d += (i ? 'L' : 'M') + (L + pw * i / (bins - 1)).toFixed(1) + ' ' + (Tp + ph - ph * a.q[i] / top).toFixed(1);
      return '<path class="' + cls + '" d="' + d + '" fill="none" stroke-width="1.6"/>';
    }
    for (var y = 0; y <= Math.ceil(top); y++) {
      var yy = Tp + ph - ph * y / top;
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="#232b38"/><text class="ax" x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + y + '</text>';
    }
    for (var t = 0; t <= 4; t++) g += '<text class="ax" x="' + (L + pw * t / 4) + '" y="' + (H - 10) + '" text-anchor="' + (t === 4 ? 'end' : 'middle') + '">' + fmt(T * SMIN_SEC / 60 * t / 4, 0) + ' мин</text>';
    return '<div class="lab-qchart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Очередь перед ' + LIM + ' в течение смены, ДО и ПОСЛЕ" style="width:100%;max-width:' + W + 'px;display:block;background:var(--card);border:1px solid var(--line)">' + g +
      path(A, 'lab-qa') + path(B, 'lab-qb') +
      '<text class="ax" x="' + (L + 6) + '" y="' + (Tp + 11) + '" fill="#f87171" style="fill:#f87171">— ДО</text><text class="ax" x="' + (L + 52) + '" y="' + (Tp + 11) + '" style="fill:#4ade80">— ПОСЛЕ</text></svg>' +
      '<p class="hint">Очередь перед ' + LIM + ' (между ' + esc(ids[qi - 1]) + ' и ' + LIM + '): детали в буфере и ожидающие на предыдущем посту, среднее по коротким отрезкам смены, шт. Предел: буфер ' + buf + ' + 1.</p></div>';
  }
  function bindQ() {
    var run = function () { try { renderQ(); } catch (e) { q('#lab-q-out').innerHTML = '<p class="hint">Не удалось посчитать модель очередей.</p>'; } };
    Array.prototype.forEach.call(root.querySelectorAll('#lab-qsb select, #lab-qsb input'), function (x) { x.addEventListener('input', run); x.addEventListener('change', run); });
    q('#lab-q-run').addEventListener('click', function () { var s = q('#lab-q-seed'); s.value = Math.floor(Math.random() * 9000) + 1000; run(); });
    run();
  }

  /* ---------- 4. слабый ноутбук ---------- */
  var W = { on: false, saved: null, timer: 0 };
  function eachMat(o, f) { var m = o.material; if (!m) return; (Array.isArray(m) ? m : [m]).forEach(f); }
  function applyWeak(on) {
    var r = window.__krause && window.__krause.renderer, sc = window.__krause && window.__krause.scene;
    if (!r || !sc) return false;
    if (on) {
      if (!W.saved) {
        W.saved = { pr: r.getPixelRatio(), sh: r.shadowMap.enabled, cast: [] };
        sc.traverse(function (o) { if (o.castShadow) W.saved.cast.push(o); });
      }
      r.setPixelRatio(1); r.shadowMap.enabled = false;
      sc.traverse(function (o) { if (o.castShadow) o.castShadow = false; eachMat(o, function (m) { m.needsUpdate = true; }); });
    } else if (W.saved) {
      r.setPixelRatio(W.saved.pr); r.shadowMap.enabled = W.saved.sh;
      W.saved.cast.forEach(function (o) { o.castShadow = true; });
      sc.traverse(function (o) { eachMat(o, function (m) { m.needsUpdate = true; }); });
      W.saved = null;
    }
    if (window.__krause.redraw) window.__krause.redraw();
    return true;
  }
  function syncWeak() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-lab-weak]'), function (b) {
      b.setAttribute('aria-pressed', W.on ? 'true' : 'false');
      if (b.getAttribute('data-lab-weak') === 'bar') b.textContent = W.on ? 'Слабый ноутбук: вкл' : 'Слабый ноутбук';
    });
    var st = q('#lab-weak-st');
    if (st) {
      var r = window.__krause && window.__krause.renderer;
      st.textContent = r ? 'Сейчас: плотность пикселей ' + fmt(r.getPixelRatio(), 2) + ', тени ' + (r.shadowMap.enabled ? 'включены' : 'выключены') + '.' : '3D ещё загружается.';
    }
  }
  function setWeak(on, store) {
    W.on = on;
    if (store !== false) ls(LS_WEAK, on ? '1' : '0');
    try { applyWeak(on); } catch (e) { /* 3D недоступно */ }
    syncWeak();
    clearInterval(W.timer);
    if (on) W.timer = setInterval(function () {
      var r = window.__krause && window.__krause.renderer;
      if (r && r.getPixelRatio() > 1) { r.setPixelRatio(1); if (window.__krause.redraw) window.__krause.redraw(); syncWeak(); }
    }, 2000);
  }
  function bindWeak() {
    function click() { setWeak(!W.on); }
    var b1 = q('#lab-weak'); b1.addEventListener('click', click);
    var host = document.getElementById('fs'); host = host && host.parentNode;
    if (!host) { var rows = document.querySelectorAll('#stage-wrap .bar-row'); host = rows[rows.length - 1]; }
    if (host && !document.getElementById('lab-weak-bar')) {
      var b2 = document.createElement('button');
      b2.className = 'b solo'; b2.id = 'lab-weak-bar'; b2.type = 'button'; b2.setAttribute('data-lab-weak', 'bar'); b2.setAttribute('aria-pressed', 'false');
      b2.title = 'Пиксели ×1, без теней — для слабых ноутбуков'; b2.textContent = 'Слабый ноутбук';
      b2.addEventListener('click', click); host.appendChild(b2);
    }
    syncWeak();
    if (ls(LS_WEAK) === '1') {
      var tries = 0, t = setInterval(function () {
        if ((window.__krause && window.__krause.renderer && window.__krause.scene) || ++tries > 100) { clearInterval(t); setWeak(true, false); }
      }, 100);
    }
  }

  /* ---------- каркас ---------- */
  function skeleton() {
    root.innerHTML =
      '<h2>Лаборатория: цифровой двойник баланса (P2)</h2>' +
      '<p class="lede">Здесь можно переставлять элементы операций между постами и сразу видеть загрузку. Данные — хронометраж завода, модель ' + MODEL + ', смин; такт ' + TAKT + '. ' +
      '<span class="tg ta">модель, не факт</span> <span class="tg tv">гипотеза — нужно подтверждение технолога</span> Любой перенос — идея для проверки, а не решение. Изменения не уходят в основной анализ и 3D-модель.</p>' +
      '<h3>1. Песочница балансировки</h3><div id="lab-sb"></div>' +
      '<h3>2. Вставка таблицы из Excel</h3>' +
      '<p class="hint">Тот же расчёт для другой линии: вставьте (Ctrl+V) столбцы <b>пост, элемент, смин, категория</b> (ОЭ/МД/ВО) или <b>пост, ОЭ, МД, ВО</b>. Заголовок не обязателен, запятая как десятичный разделитель допускается. Данные остаются в браузере.</p>' +
      '<div class="bar-row"><button class="b solo" id="lab-sample">Пример</button><button class="b solo" id="lab-clear">Очистить</button><label class="lab-lbl">Такт, смин <input class="lab-in" id="lab-takt-in" type="number" min="1" value="' + TAKT + '"></label></div>' +
      '<textarea id="lab-ta" class="lab-ta" rows="6" spellcheck="false" aria-label="Таблица из Excel: пост, элемент, смин, категория" placeholder="пост&#9;элемент&#9;смин&#9;категория&#10;А-1&#9;Установить деталь&#9;30&#9;ОЭ"></textarea>' +
      '<div id="lab-p2out"></div>' +
      '<h3>3. Простая модель очередей: одна смена</h3>' +
      '<p class="hint">Посты идут друг за другом, между ними буфер. Время поста = норма × (1 ± случайный разброс). Сравниваются ДО и ПОСЛЕ «Идеи 2» (31-10(а) и 31-1 в такт). <span class="tg ta">модель, не факт</span></p><div id="lab-qsb"></div>' +
      '<h3>4. Режим «слабый ноутбук»</h3>' +
      '<p class="hint">Для медленных компьютеров: плотность пикселей 3D ×1 и без теней. Выключение возвращает прежние значения; выбор запоминается в браузере. Такая же кнопка есть над 3D-сценой.</p>' +
      '<div class="bar-row"><button class="b solo" id="lab-weak" data-lab-weak="lab" aria-pressed="false">Режим «слабый ноутбук»</button><span class="hint" id="lab-weak-st"></span></div>' +
      '<div class="lab-tip" id="lab-tip" hidden role="status"></div>';
  }

  function init() {
    build();
    skeleton();
    ensureSandbox(); bindSandbox(); renderSandbox();
    bindPaste(); renderPaste();
    ensureQ(); bindQ();
    bindWeak();
  }
  var tries = 0, wait = setInterval(function () {
    if ((window.__krause && window.__krause.kd) || ++tries > 150) {
      clearInterval(wait);
      if (!(window.__krause && window.__krause.kd)) { root.innerHTML = '<p class="hint">Лаборатория недоступна: данные страницы не загрузились.</p>'; return; }
      K = window.__krause;
      try { init(); } catch (e) { root.innerHTML = '<h2>Лаборатория: цифровой двойник баланса (P2)</h2><p class="hint">Лабораторию не удалось запустить: ' + esc(e && e.message) + '</p>'; }
    }
  }, 50);
})();
