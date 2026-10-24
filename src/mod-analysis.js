/* Модуль «анализ»: SQCTP, идеи 2–3, карта потерь, эргономика, план, сверка данных, вопросы куратору.
   Все числа — из window.__krause.kd и calc. Контейнеры: #sqctp #ideas-body #losses #ergo #plan #sverka #questions. */
(function () {
  'use strict';
  var K, KD, C, TAKT;
  var TAGS = { tz: 'данные завода', tr: 'расчёт из таблицы', tv: 'видео', ta: 'допущение команды' };
  var S = { open: null, costs: { 2: {}, 3: {} }, ev: { 2: '', 3: '' } };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(n, d) {
    d = d == null ? 1 : d;
    var m = Math.pow(10, d);
    return (Math.round(n * m) / m).toString().replace('.', ',').replace('-', '−');
  }
  function sgn(n) { return n > 0 ? '+' + fmt(n) : fmt(n); }
  function ru(n) { return Math.round(n).toLocaleString('ru-RU'); }
  function pct(v) { return Math.round(v / TAKT * 100); }
  function tag(k, txt) { return '<span class="tg ' + k + '">' + esc(txt || TAGS[k]) + '</span>'; }
  function tpl(s) { return esc(C.tpl(s)); }
  function L(id, m) { return C.load(id, 'before', m || '21179', 'el', 0); }
  function $(id) { return document.getElementById(id); }
  function put(id, html) { var el = $(id); if (el) el.innerHTML = html; }
  function guard(name, fn) {
    try { fn(); } catch (e) { console.error('mod-analysis: ' + name, e); }
  }
  function postIds() { return Object.keys(KD.posts); }
  function chunk(id) { return KD.chunks.filter(function (c) { return c.id === id; })[0]; }
  function range(a, b, u) { return a === b ? fmt(a) + (u || '') : fmt(a) + '…' + fmt(b) + (u || ''); }

  /* ===== 1. SQCTP ===== */
  function sqctp() {
    var turn = chunk('turn'), cs = KD.chunks.reduce(function (s, c) { return s + c.v; }, 0), E = KD.economy;
    var md41 = KD.posts['41-1(а)'].ops.filter(function (o) { return o.k === 'МД'; })
      .reduce(function (s, o) { return s + o.v; }, 0);
    var month = E.salary * (1 + E.social / 100) * E.shifts;
    var lt = lossCalc().rows.filter(function (r) { return r.name === 'тип ДВС, выбор варианта'; })[0];
    var chips = {
      S: ['развороты паллеты на 41-1(а): ' + fmt(turn.v) + ' смин', 'tr'],
      Q: ['51-5: ' + fmt(L('51-5')) + ' смин (' + pct(L('51-5')) + ' %)' + (lt ? ' · «тип ДВС» на ДВС: ' + fmt(lt.t) + ' смин' : ''), 'tr'],
      C: ['41-1(а): ' + fmt(cs) + ' смин, ' + E.shifts + ' ставки ≈ ' + ru(month / 1000) + ' тыс. ₽/мес', 'ta'],
      T: ['31-10(а): ' + fmt(L('31-10(а)')) + ' (' + pct(L('31-10(а)')) + ' %) · 31-1: ' + fmt(L('31-1')) + ' (' + pct(L('31-1')) + ' %) · такт ' + TAKT, 'tr'],
      P: ['41-1(а): МД ' + fmt(md41) + ' из ' + fmt(cs) + ' смин', 'tr']
    };
    var src = { S: ['ta'], Q: ['tr', 'ta'], C: ['ta'], T: ['tr', 'tv'], P: ['tr'] };
    var h = '<h2>Проблемы — SQCTP</h2><p class="hint">Пять групп проблем линии: безопасность, качество, затраты, время, люди.</p><div class="an-sq">';
    KD.sqctp.forEach(function (c) {
      var ch = chips[c.k];
      h += '<div class="an-card an-k' + c.k + '"><div class="an-card-h"><span class="an-badge">' + esc(c.k) + '</span><b>' + esc(c.t) + '</b></div>'
        + '<p>' + tpl(c.v) + '</p>'
        + (ch ? '<div class="an-chip">' + esc(ch[0]) + ' ' + tag(ch[1]) + '</div>' : '')
        + '<div class="an-src">' + (src[c.k] || []).map(function (k) { return tag(k); }).join('') + '</div></div>';
    });
    put('sqctp', h + '</div>');
  }

  /* ===== 2. Идеи 2–3 ===== */
  function costOf(idea, i, m) {
    var st = S.costs[idea][i];
    if (st) return st;
    return m.capex ? [m.capex[0], m.capex[1]] : [null, null];
  }
  function num(v) { return v === '' || v == null || isNaN(+v) ? null : +v; }

  function idea2Calc() {
    var I = KD.idea2, res = {}, posts = ['31-10(а)', '31-1', '31-9'];
    posts.forEach(function (p) {
      var b = L(p), lo = 0, hi = 0, loSafe = 0, add = 0;
      I.measures.forEach(function (m) {
        if (m.post === p) {
          hi += m.hi; lo += m.lo;
          if (!/Идея 3/.test(m.t)) loSafe += m.lo;
        }
        if (m.to === p) add += m.toV || m.hi;
      });
      res[p] = { before: b, lo: b - hi + add, hi: b - loSafe + add };
    });
    return res;
  }

  function idea2Svg(R) {
    var rows = ['31-10(а)', '31-1', '31-9'], x0 = 62, sc = 250 / 115, y = 22, h = '';
    h += '<svg viewBox="0 0 340 196" role="img" aria-label="Загрузка постов 31-10(а), 31-1 и 31-9 до и после, линия такта ' + TAKT + '">';
    rows.forEach(function (p, i) {
      var r = R[p], y0 = y + i * 52, b = x0 + r.before * sc, a1 = x0 + r.lo * sc, a2 = x0 + r.hi * sc;
      h += '<text x="0" y="' + (y0 + 12) + '" class="an-t">' + esc(p) + '</text>';
      h += '<rect x="' + x0 + '" y="' + y0 + '" width="' + (r.before * sc) + '" height="15" class="' + (r.before > TAKT ? 'an-b-bad' : 'an-b-old') + '"/>';
      h += '<text x="' + (b + 4) + '" y="' + (y0 + 12) + '" class="an-t an-tv">' + fmt(r.before) + '</text>';
      h += '<rect x="' + x0 + '" y="' + (y0 + 19) + '" width="' + (r.lo * sc - 0) + '" height="15" class="an-b-new"/>';
      if (r.hi > r.lo) h += '<rect x="' + a1 + '" y="' + (y0 + 19) + '" width="' + ((r.hi - r.lo) * sc) + '" height="15" class="an-b-rng"/>';
      h += '<text x="' + (a2 + 4) + '" y="' + (y0 + 31) + '" class="an-t an-tv an-g">' + range(r.lo, r.hi) + '</text>';
    });
    var tx = x0 + TAKT * sc;
    h += '<line x1="' + tx + '" x2="' + tx + '" y1="10" y2="170" class="an-takt"/><text x="' + tx + '" y="8" text-anchor="middle" class="an-t an-ty">такт ' + TAKT + '</text>';
    h += '<text x="0" y="188" class="an-t an-tm">серый/красный — сейчас · зелёный — после (светлый — диапазон)</text></svg>';
    return h;
  }

  function idea3Svg() {
    var m = /(\d+)\s+сухар/.exec(KD.idea3.problem), n = m ? m[1] + ' сухарей' : 'сухари';
    function box(x, y, w, t, t2, cls) {
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="34" rx="4" class="an-bx ' + (cls || '') + '"/>'
        + '<text x="' + (x + w / 2) + '" y="' + (y + 15) + '" text-anchor="middle" class="an-t">' + esc(t) + '</text>'
        + '<text x="' + (x + w / 2) + '" y="' + (y + 28) + '" text-anchor="middle" class="an-t an-tm">' + esc(t2 || '') + '</text>';
    }
    function row(y, a, a2, b2) {
      return box(0, y, 82, a, a2) + box(102, y, 62, 'Камера', 'снимок', 'an-cam')
        + '<polygon points="204,' + (y + 17) + ' 222,' + (y + 2) + ' 240,' + (y + 17) + ' 222,' + (y + 32) + '" class="an-bx an-gate"/>'
        + '<text x="222" y="' + (y + 21) + '" text-anchor="middle" class="an-t an-tg">OK?</text>'
        + box(262, y, 78, b2[0], b2[1], 'an-ok')
        + '<path d="M82 ' + (y + 17) + 'H102M164 ' + (y + 17) + 'H204M240 ' + (y + 17) + 'H262" class="an-arr"/>'
        + '<text x="251" y="' + (y + 11) + '" text-anchor="middle" class="an-t an-tg">да</text>'
        + '<path d="M222 ' + (y + 32) + 'V' + (y + 46) + '" class="an-arr an-nok"/>'
        + '<text x="226" y="' + (y + 57) + '" class="an-t an-tr2">нет → стоп, ДВС не идёт дальше</text>';
    }
    return '<svg viewBox="0 0 340 196" role="img" aria-label="Схема: камера и ворота OK или NOK на постах 51-5 и 51-11">'
      + '<g>' + row(8, '51-5', n, ['дальше', '51-6']) + '</g>'
      + '<g>' + row(100, '51-11', 'диск, заглушки', ['клеймение', 'дальше']) + '</g>'
      + '<text x="0" y="86" class="an-t an-tm">без ручного сброса ошибки</text></svg>';
  }

  function costCell(idea, i, m) {
    var c = costOf(idea, i, m);
    var v0 = c[0] == null ? '' : c[0], v1 = c[1] == null ? '' : c[1];
    return '<div class="an-in"><input type="number" min="0" step="10" inputmode="numeric" data-an-cost="' + idea + '" data-i="' + i + '" data-b="0" value="' + v0 + '" placeholder="уточнить" aria-label="Затраты от, тыс. ₽">'
      + '<span>…</span><input type="number" min="0" step="10" inputmode="numeric" data-an-cost="' + idea + '" data-i="' + i + '" data-b="1" value="' + v1 + '" placeholder="уточнить" aria-label="Затраты до, тыс. ₽"><span>тыс. ₽</span></div>'
      + (m.capexNote ? '<div class="an-note">' + esc(m.capexNote) + '</div>' : '');
  }

  function ideaTable(idea, I) {
    var h = '<div class="scroll"><table class="an-tb"><thead><tr><th>Мероприятия</th><th>Затраты</th><th>Эффект</th></tr></thead><tbody>';
    I.measures.forEach(function (m, i) {
      var eff = [];
      if (m.lo || m.hi) eff.push('−' + range(m.lo, m.hi) + ' смин на ' + m.post + (m.to ? '; +' + fmt(m.toV || m.hi) + ' на ' + m.to : ''));
      if (m.eff) eff.push(m.eff);
      h += '<tr><td><span class="an-post">' + esc(m.post) + '</span> ' + tpl(m.t) + '</td><td>' + costCell(idea, i, m) + '</td><td class="an-eff">'
        + (eff.length ? eff.map(esc).join('<br>') : '—') + '</td></tr>';
    });
    h += '</tbody><tfoot><tr><td>Итого затраты <span class="an-note">оценка команды, уточнить</span></td><td><b id="an-tot' + idea + '"></b></td><td id="an-tote' + idea + '" class="an-eff"></td></tr></tfoot></table></div>';
    return h;
  }

  function totals(idea) {
    var I = idea === 2 ? KD.idea2 : KD.idea3, lo = 0, hi = 0, mlo = 0, mhi = 0, unk = 0;
    I.measures.forEach(function (m, i) {
      var c = costOf(idea, i, m);
      if (c[0] == null && c[1] == null) unk++;
      lo += c[0] || 0; hi += c[1] || 0;
      mlo += m.lo; mhi += m.hi;
    });
    return { lo: lo, hi: hi, mlo: mlo, mhi: mhi, unk: unk };
  }

  function evalMoney(idea) {
    var el = $('an-ev' + idea), T = totals(idea), v = num(S.ev[idea]), E = KD.economy, D = KD.sheetDATA;
    if (!el) return;
    if (!(v > 0)) { el.innerHTML = '<span class="an-ask">вводит куратор</span>'; return; }
    var h;
    if (idea === 2) {
      var gap = Math.max(0, E.orderPerShift - E.pacePerShift), year = gap * v * E.shifts * E.days;
      h = 'До плана недостаёт ' + gap + ' ДВС за смену; верхняя оценка: ' + ru(gap * v) + ' ₽ за смену, ' + ru(year / 1e6 * 10) / 10 + ' млн ₽ в год ('
        + E.shifts + ' смены, ' + E.days + ' дн.). Затраты окупятся не быстрее чем за '
        + fmt(T.lo * 1000 / year * 12) + '…' + fmt(T.hi * 1000 / year * 12) + ' мес. Это максимум: темп ' + E.pacePerShift + ' зависит и от других причин.';
    } else {
      h = 'Затраты ' + ru(T.lo) + '…' + ru(T.hi) + ' тыс. ₽ окупятся, если предотвратить ' + Math.ceil(T.lo * 1000 / v) + '…' + Math.ceil(T.hi * 1000 / v) + ' дефектов за срок службы системы.';
    }
    el.innerHTML = '<span class="an-calc">' + esc(h) + '</span> ' + tag('ta');
  }

  function refreshTotals() {
    [2, 3].forEach(function (idea) {
      var T = totals(idea), a = $('an-tot' + idea), b = $('an-tote' + idea);
      if (a) a.textContent = ru(T.lo) + '…' + ru(T.hi) + ' тыс. ₽' + (T.unk ? ' (без ' + T.unk + ' ст. «уточнить»)' : '');
      if (b) b.textContent = 'Σ −' + range(T.mlo, T.mhi) + ' смин по мероприятиям';
      evalMoney(idea);
    });
  }

  function btn3d(ids) {
    return ids.map(function (p) {
      return '<button type="button" class="an-btn" data-an-3d="' + esc(p) + '">Показать в 3D: ' + esc(p) + '</button>';
    }).join('');
  }

  function ideas() {
    var I2 = KD.idea2, I3 = KD.idea3, R = idea2Calc(), h = '';
    var r1 = R['31-10(а)'], r2 = R['31-1'], r3 = R['31-9'];
    h += '<article class="an-idea"><h3>' + esc(I2.title) + ' ' + tag('ta') + '</h3><div class="an-g3">'
      + '<div><h4>Проблема и цель</h4><p>' + tpl(I2.problem) + '</p><p><b>Цель:</b> ' + esc(I2.goal) + '</p></div>'
      + '<div><h4>Решение</h4><ul class="an-ul">'
      + '<li><b>31-10(а):</b> ' + fmt(r1.before) + ' → <b>' + range(r1.lo, r1.hi) + '</b> смин (' + pct(r1.lo) + '–' + pct(r1.hi) + ' % такта)</li>'
      + '<li><b>31-1:</b> ' + fmt(r2.before) + ' → <b>' + range(r2.lo, r2.hi) + '</b> смин (' + pct(r2.lo) + '–' + pct(r2.hi) + ' %)</li>'
      + '<li><b>31-9:</b> ' + fmt(r3.before) + ' → <b>' + fmt(r3.lo) + '</b> смин (' + pct(r3.lo) + ' %), если рым переносим и позволяет доступ</li></ul>'
      + '<p class="an-note">Диапазон — расчёт из мероприятий ниже. Нижний край — все меры, верхний — без экрана модели из Идеи 3. В расчёте команды: ' + esc(I2.result) + ' ' + tag('ta') + '</p></div>'
      + '<div class="an-fig">' + idea2Svg(R) + '</div></div>'
      + ideaTable(2, I2)
      + '<div class="an-eff4"><h4>Эффект</h4>'
      + ['T', 'C', 'Q', 'S'].map(function (k) {
        return '<div><b>' + k + '</b><span>' + esc(I2.effects[k]) + '</span>'
          + (k === 'C' ? '<label class="an-lab">Стоимость одного недостающего ДВС или доп. смены, ₽ <input type="number" min="0" step="1000" data-an-ev="2" placeholder="вводит куратор" value="' + esc(S.ev[2]) + '"></label><div id="an-ev2" class="an-evr"></div>' : '')
          + '</div>';
      }).join('') + '</div>'
      + '<div class="an-bar">' + btn3d(['31-10(а)', '31-9', '31-1']) + '</div></article>';

    var t3 = totals(3), m51 = I3.measures[0], b5 = L('51-5');
    h += '<article class="an-idea"><h3>' + esc(I3.title) + ' ' + tag('ta') + '</h3><div class="an-g3">'
      + '<div><h4>Проблема и цель</h4><p>' + tpl(I3.problem) + '</p><p><b>Цель:</b> ' + esc(I3.goal) + '</p></div>'
      + '<div><h4>Решение</h4><ul class="an-ul">'
      + '<li><b>51-5:</b> ' + fmt(b5) + ' → <b>' + range(b5 - m51.hi, b5 - m51.lo) + '</b> смин (' + pct(b5 - m51.hi) + '–' + pct(b5 - m51.lo) + ' % такта), контроль 100 %</li>'
      + I3.measures.slice(1).map(function (m) { return '<li><b>' + esc(m.post) + ':</b> ' + esc(m.eff || '') + '</li>'; }).join('')
      + '</ul></div><div class="an-fig">' + idea3Svg() + '</div></div>'
      + ideaTable(3, I3)
      + '<div class="an-eff4"><h4>Эффект</h4>'
      + '<div><b>Q</b><span>Контроль 100 % без ручного сброса; модель видна на каждом посту; диск и заглушки подтверждены до клеймения.</span></div>'
      + '<div><b>T</b><span>Σ −' + range(t3.mlo, t3.mhi) + ' смин по мероприятиям (на 51-5 — ' + range(m51.lo, m51.hi) + ').</span></div>'
      + '<div><b>C</b><span>' + esc(I3.money) + '<label class="an-lab">Стоимость одного дефекта, ₽ <input type="number" min="0" step="1000" data-an-ev="3" placeholder="вводит куратор" value="' + esc(S.ev[3]) + '"></label><div id="an-ev3" class="an-evr"></div></span></div></div>'
      + '<div class="an-bar">' + btn3d(['51-5', '51-11']) + '</div></article>';
    put('ideas-body', h);
    refreshTotals();
  }

  /* ===== 3. Карта потерь ===== */
  var LC = null;
  function lossCalc() {
    var rules = KD.lossRules, rows = {}, order = [], total = 0;
    var br = { '51': 0, '31': 0, '41': 0 };
    function kindOf(t) {
      var s = String(t).toLowerCase();
      for (var i = 0; i < rules.length; i++) {
        for (var j = 0; j < rules[i][1].length; j++) if (s.indexOf(rules[i][1][j]) >= 0) return rules[i][0];
      }
      return 'основная сборка';
    }
    postIds().forEach(function (id) {
      var p = KD.posts[id];
      if (p.offline) return;
      var b = id.slice(0, 2);
      p.ops.forEach(function (o) {
        var v = C.opV(o, '21179');
        if (!(v > 0)) return;
        var k = kindOf(o.t);
        if (!rows[k]) { rows[k] = { name: k, t: 0, b: { '51': 0, '31': 0, '41': 0 }, items: [] }; order.push(k); }
        rows[k].t += v; rows[k].b[b] += v; rows[k].items.push({ post: id, t: o.t, v: v });
        total += v; br[b] += v;
      });
    });
    var list = order.map(function (k) { return rows[k]; }).sort(function (a, b) { return b.t - a.t; });
    var cum = 0;
    list.forEach(function (r) { cum += r.t; r.cum = cum / total * 100; r.share = r.t / total * 100; });
    var ref = {};
    KD.lossTable.rows.forEach(function (r) { ref[r[0]] = r; });
    return { rows: list, total: total, br: br, ref: ref };
  }

  function lossSvg(D) {
    var rows = D.rows, rh = 24, top = 24, W = 820, x0 = 215, bw = 330, cx0 = 640, cw = 140, max = rows[0].t;
    var h = '<svg viewBox="0 0 ' + W + ' ' + (top + rows.length * rh + 6) + '" class="an-pareto" role="img" aria-label="Парето потерь по видам работы">';
    h += '<text x="' + x0 + '" y="14" class="an-t an-tm">смин на один ДВС 21179</text><text x="' + cx0 + '" y="14" class="an-t an-tm">накопленная доля, %</text>';
    var pts = [];
    rows.forEach(function (r, i) {
      var y = top + i * rh, w = Math.max(1, r.t / max * bw), cxp = cx0 + r.cum / 100 * cw;
      pts.push(cxp + ',' + (y + rh / 2 - 1));
      h += '<g class="an-row' + (S.open === r.name ? ' on' : '') + '" data-an-kind="' + esc(r.name) + '" tabindex="0" role="button" aria-label="' + esc(r.name) + ': ' + fmt(r.t) + ' смин">'
        + '<rect x="0" y="' + y + '" width="' + W + '" height="' + rh + '" class="an-hit"/>'
        + '<text x="' + (x0 - 8) + '" y="' + (y + 16) + '" text-anchor="end" class="an-t">' + esc(r.name) + '</text>'
        + '<rect x="' + x0 + '" y="' + (y + 4) + '" width="' + w + '" height="' + (rh - 8) + '" class="' + (r.name === 'основная сборка' ? 'an-lb-main' : 'an-lb') + '"/>'
        + '<text x="' + (x0 + w + 6) + '" y="' + (y + 16) + '" class="an-t an-tv">' + fmt(r.t) + ' · ' + fmt(r.share) + ' %</text>'
        + '<circle cx="' + cxp + '" cy="' + (y + rh / 2 - 1) + '" r="2.6" class="an-dot"/>'
        + '<text x="' + (cx0 + cw + 8) + '" y="' + (y + 16) + '" class="an-t an-tm">' + Math.round(r.cum) + '</text></g>';
    });
    h += '<line x1="' + cx0 + '" x2="' + cx0 + '" y1="' + top + '" y2="' + (top + rows.length * rh) + '" class="an-ax"/><line x1="' + (cx0 + cw) + '" x2="' + (cx0 + cw) + '" y1="' + top + '" y2="' + (top + rows.length * rh) + '" class="an-ax"/>';
    h += '<polyline points="' + pts.join(' ') + '" class="an-cumline"/></svg>';
    return h;
  }

  function lossCell(a, b) {
    return Math.abs(a - b) < 0.05 ? '<td class="an-n">' + fmt(a) + '</td>'
      : '<td class="an-n an-df">' + fmt(a) + '<small>в табл.: ' + fmt(b) + '</small></td>';
  }

  function losses() {
    LC = lossCalc();
    var D = LC, rt = KD.lossTable, nd = 0, h = '';
    h += '<h2>Карта потерь трёх бригад</h2>'
      + '<p class="hint">Расчёт команды: вид работы определён по названию элемента, это не коды ОЭ/МД/ВО ' + tag('tr') + ' ' + tag('ta', 'правила команды') + '</p>'
      + '<p class="hint">Линейные посты бригад 51, 31 и 41 для 21179 (посты вне линии не считаются, 41-1(а) — в «ДО»); карта не меняется при выборе модели вверху. Итого по элементам: <b>' + fmt(D.total, 0) + ' смин</b> на ДВС; в таблице команды: <b>' + fmt(rt.total, 0) + ' смин</b>. Нажмите на строку — увидите посты и элементы.</p>'
      + '<div class="scroll"><div class="an-wide">' + lossSvg(D) + '</div></div>';
    var diff = [];
    D.rows.forEach(function (r) {
      var f = D.ref[r.name];
      if (!f || Math.abs(f[1] - r.t) > 0.05 || Math.abs(f[2] - r.b['51']) > .05 || Math.abs(f[3] - r.b['31']) > .05 || Math.abs(f[4] - r.b['41']) > .05) diff.push(r.name);
    });
    nd = diff.length;
    h += '<h3>Таблица по бригадам: правило и таблица команды</h3>'
      + '<p class="hint">Где расчёт по правилам не совпал с таблицей команды, показаны оба числа: «по правилу: X · в таблице команды: Y». Строк с различиями: <b>' + nd + '</b> из ' + D.rows.length + '. Это не ошибка завода: нужно уточнить, как команда относила отдельные элементы (например, «Освободить ДВС от захватов станция 660» правило «захват станции» не ловит).</p>'
      + '<div class="scroll"><table class="an-tb an-loss"><thead><tr><th rowspan="2">Вид работы</th><th colspan="4">по правилу, смин</th><th rowspan="2">в таблице команды, итого</th><th rowspan="2">доля</th></tr><tr><th>всего</th><th>51</th><th>31</th><th>41</th></tr></thead><tbody>';
    D.rows.forEach(function (r) {
      var f = D.ref[r.name], open = S.open === r.name, same = f && diff.indexOf(r.name) < 0;
      h += '<tr class="an-lr' + (open ? ' on' : '') + '" data-an-kind="' + esc(r.name) + '" tabindex="0"><td><span class="an-caret">' + (open ? '▾' : '▸') + '</span> ' + esc(r.name) + '</td>'
        + (f ? lossCell(r.t, f[1]) + lossCell(r.b['51'], f[2]) + lossCell(r.b['31'], f[3]) + lossCell(r.b['41'], f[4])
          : '<td class="an-n">' + fmt(r.t) + '</td><td class="an-n">' + fmt(r.b['51']) + '</td><td class="an-n">' + fmt(r.b['31']) + '</td><td class="an-n">' + fmt(r.b['41']) + '</td>')
        + '<td class="an-n">' + (f ? fmt(f[1]) : 'нет в таблице') + '</td><td class="an-n">' + fmt(r.share) + ' %</td></tr>';
      if (open) {
        h += '<tr class="an-ex"><td colspan="7"><div class="an-exb"><b>' + esc(r.name) + ': ' + r.items.length + ' элем., ' + fmt(r.t) + ' смин'
          + (f && !same ? ' · по правилу: ' + fmt(r.t) + ' · в таблице команды: ' + fmt(f[1]) : '') + '</b>'
          + '<table class="an-tb an-mini"><thead><tr><th>Пост</th><th>Элемент</th><th>смин</th></tr></thead><tbody>'
          + r.items.map(function (it) { return '<tr><td class="an-post">' + esc(it.post) + '</td><td>' + esc(it.t) + '</td><td class="an-n">' + fmt(it.v) + '</td></tr>'; }).join('')
          + '</tbody></table></div></td></tr>';
      }
    });
    h += '</tbody><tfoot><tr><td>Итого</td><td class="an-n">' + fmt(D.total, 0) + '</td><td class="an-n">' + fmt(D.br['51'], 0) + '</td><td class="an-n">' + fmt(D.br['31'], 0) + '</td><td class="an-n">' + fmt(D.br['41'], 0)
      + '</td><td class="an-n">' + fmt(rt.total, 0) + '</td><td class="an-n">100 %</td></tr></tfoot></table></div>';
    put('losses', h);
  }

  /* ===== 4. Эргономика ===== */
  function ergo() {
    var E = KD.ergo, opt = KD.economy.capex.filter(function (x) { return x.opt && /оправк|пресс/i.test(x.t); })[0];
    var zone = { red: 'красная', yellow: 'жёлтая', green: 'зелёная' };
    function col(title, rows) {
      return '<div class="an-ec"><h3>' + esc(title) + '</h3>' + rows.map(function (r) {
        return '<div class="an-er"><span class="an-z an-z-' + esc(r[2]) + '">' + (zone[r[2]] || '') + ' зона</span><div><b>' + esc(r[0]) + '</b><br><span>' + esc(r[1]) + '</span></div></div>';
      }).join('') + '</div>';
    }
    put('ergo', '<h2>Эргономика 41-1(а): ДО и ПОСЛЕ</h2>'
      + '<div class="an-two">' + col('ДО: пост 41-1(а)', E.before) + col('ПОСЛЕ: посты 51-9 и 51-11', E.after) + '</div>'
      + '<p class="an-meth"><b>Методика:</b> ' + esc(E.method) + '</p>'
      + '<p class="hint">' + esc(E.note) + ' ' + tag('ta') + '</p>'
      + (opt ? '<p class="hint">' + esc(opt.t) + ' — в затратах как опция: ' + range(opt.lo, opt.hi) + ' тыс. ₽ ' + tag('ta') + '</p>' : ''));
  }

  /* ===== 5. План ===== */
  function plan() {
    var P = KD.plan, h = '<h2>План внедрения на 4 недели</h2><div class="an-tl">';
    P.forEach(function (s, i) {
      h += '<div class="an-step"><div class="an-sw"><span>' + (i + 1) + '</span>' + esc(s.w) + '</div><p>' + tpl(s.t) + '</p>'
        + '<div class="an-who">' + String(s.who).split(',').map(function (w) { return '<span>' + esc(w.trim()) + '</span>'; }).join('') + '</div></div>';
    });
    h += '</div><div class="an-kp"><h3>KPI пилота</h3><ul>' + KD.pilotKpi.map(function (k) { return '<li>' + esc(k) + '</li>'; }).join('') + '</ul>'
      + '<p class="hint">Пост 41-1(а) остаётся страховкой на время пилота; снимаем его только после выполнения KPI. Люди не сокращаются: перевод на другой пост или незамещение вакансий. ' + tag('ta') + '</p></div>';
    put('plan', h);
  }

  /* ===== 6. Сверка ===== */
  function sverka() {
    var D = KD.discrepancies, rows = [], fixed = D.filter(function (d) { return /исправлено/.test(d.ask); }).length;
    postIds().forEach(function (id) {
      var p = KD.posts[id], sm = p.summary.oe + p.summary.md + p.summary.vo, a = L(id, '21179'), b = L(id, '21129');
      if (Math.abs(a - sm) > 0.001) rows.push({ id: id, sm: sm, a: a, b: id === '41-1(а)' ? null : b, off: p.offline });
    });
    var h = '<h2>Сверка данных: что мы нашли в исходных таблицах</h2>'
      + '<div class="an-cnt"><b>' + D.length + '</b><span>Найдено расхождений: ' + D.length + '</span></div>'
      + '<p class="hint">Сверка помогает заводу принимать решения по верным цифрам. Это не упрёк авторам таблиц: сводки и диаграммы собирались вручную и по формулам, поэтому часть цифр разошлась. Исправлено: ' + fixed + '; остальное — вопросы к технологам.</p>'
      + '<div class="scroll"><table class="an-tb an-sv"><thead><tr><th>Где</th><th>В источнике</th><th>По элементам</th><th>Разница</th><th>Вероятная причина</th><th>Что спросить</th></tr></thead><tbody>'
      + D.map(function (d) {
        return '<tr><td class="an-post">' + esc(d.where) + '</td><td>' + esc(d.src) + '</td><td>' + esc(d.el) + '</td><td class="an-n">' + esc(d.diff) + '</td><td>' + esc(d.why) + '</td><td>' + esc(d.ask) + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      + '<h3>Автосверка: сводка и элементы по постам ' + tag('tr') + '</h3>'
      + '<p class="hint">Считается страницей на лету по данным: сумма сводки (ОЭ + МД + ВО) против суммы пооперационных элементов. Постов с разницей: <b>' + rows.length + '</b> из ' + postIds().length + '. Значок внизу экрана «Проверка данных: 37/37 ОК» проверяет суммы элементов по постам, а не сводки.</p>'
      + '<div class="scroll"><table class="an-tb an-sv"><thead><tr><th>Пост</th><th>Сводка / диаграмма</th><th>Элементы 21179</th><th>Элементы 21129</th><th>Разница (элементы − сводка)</th></tr></thead><tbody>'
      + rows.map(function (r) {
        var d = r.a - r.sm;
        return '<tr><td class="an-post">' + esc(r.id) + (r.off ? ' <span class="an-note">вне линии</span>' : '') + '</td><td class="an-n">' + fmt(r.sm) + '</td><td class="an-n">' + fmt(r.a) + '</td><td class="an-n'
          + (r.b != null && Math.abs(r.b - r.a) > 0.001 ? ' an-df' : '') + '">' + (r.b == null ? 'операции нет' : fmt(r.b)) + '</td><td class="an-n an-df">' + sgn(d) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    put('sverka', h);
  }

  /* ===== 7. Вопросы ===== */
  function questions() {
    var Q = KD.questions;
    put('questions', '<h2>Вопросы куратору</h2><p class="hint">По приоритету: сначала то, от чего зависит перенос. ' + tag('ta') + '</p>'
      + '<div class="an-qh"><button type="button" class="an-btn" data-an-copy="1">Скопировать список</button><span id="an-cpst" class="hint" role="status" aria-live="polite"></span></div>'
      + '<ol class="an-q">' + Q.map(function (q, i) {
        return '<li><span class="an-pr ' + (i < 6 ? 'hi' : 'mid') + '">' + (i < 6 ? 'высокий приоритет' : 'средний') + '</span> ' + esc(q) + '</li>';
      }).join('') + '</ol>');
  }

  function copyList() {
    var Q = KD.questions, txt = 'Вопросы куратору\n' + Q.map(function (q, i) {
      return (i + 1) + '. [' + (i < 6 ? 'высокий приоритет' : 'средний') + '] ' + q;
    }).join('\n');
    var st = $('an-cpst');
    function ok() { if (st) st.textContent = 'Список скопирован'; }
    function fb() {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select();
      var done = false;
      try { done = document.execCommand('copy'); } catch (e) { done = false; }
      document.body.removeChild(ta);
      if (st) st.textContent = done ? 'Список скопирован' : 'Не удалось скопировать: выделите текст вручную';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(ok, fb);
    } else fb();
  }

  /* ===== события ===== */
  function onClick(e) {
    var t = e.target.closest ? e.target.closest('[data-an-3d],[data-an-copy],[data-an-kind]') : null;
    if (!t) return;
    guard('click', function () {
      if (t.hasAttribute('data-an-3d')) {
        K.setSel(t.getAttribute('data-an-3d'), true);
        var sc = $('scene');
        if (sc && sc.scrollIntoView) sc.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (t.hasAttribute('data-an-copy')) copyList();
      else {
        var k = t.getAttribute('data-an-kind');
        S.open = S.open === k ? null : k;
        var y = window.scrollY, tb = t.tagName === 'tr' || t.tagName === 'TR';
        losses();
        if (!tb) {
          var row = document.querySelector('#losses tr.an-lr.on');
          if (row && row.scrollIntoView) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } else window.scrollTo(0, y);
      }
    });
  }
  function onKey(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute && e.target.getAttribute('data-an-kind')) {
      e.preventDefault(); onClick({ target: e.target });
    }
  }
  function onInput(e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    guard('input', function () {
      if (t.hasAttribute('data-an-cost')) {
        var idea = +t.getAttribute('data-an-cost'), i = +t.getAttribute('data-i'), b = +t.getAttribute('data-b');
        var m = (idea === 2 ? KD.idea2 : KD.idea3).measures[i], cur = costOf(idea, i, m).slice();
        cur[b] = num(t.value);
        S.costs[idea][i] = cur;
        refreshTotals();
      } else if (t.hasAttribute('data-an-ev')) {
        S.ev[+t.getAttribute('data-an-ev')] = t.value;
        evalMoney(+t.getAttribute('data-an-ev'));
      }
    });
  }

  function renderAll() {
    guard('sqctp', sqctp); guard('ideas', ideas); guard('losses', losses); guard('ergo', ergo);
    guard('plan', plan); guard('sverka', sverka); guard('questions', questions);
  }

  function init() {
    try {
      K = window.__krause;
      if (!K || !K.kd || !K.calc) return;
      KD = K.kd; C = K.calc; TAKT = KD.const.takt;
      renderAll();
      document.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
      document.addEventListener('input', onInput);
      document.addEventListener('krause:data', function () { guard('data', renderAll); });
    } catch (e) { console.error('mod-analysis', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
