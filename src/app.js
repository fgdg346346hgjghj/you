  // ===== Данные: единый JSON-блок script#krause-data =====
  var KRD = JSON.parse(document.getElementById("krause-data").textContent),
    // Состояние источника данных: el — элементы (по умолчанию), sum — сводка/диаграмма;
    // model: 21179 | 21129 | mix; mix — доля 21129; recog — смин на распознавание модели в 51 (0 или 2)
    KRX = { src: "el", model: "21179", mix: 0.5, recog: 0 },
    KR_TAKT = KRD.const.takt;
  // значение элемента для модели
  function krOpV(o, m) {
    return m === "21129" && "v29" in o ? o.v29 : o.v;
  }
  // разбивка ОЭ/МД/ВО по элементам для модели
  function krElCat(id, m) {
    let p = KRD.posts[id],
      r = { oe: 0, md: 0, vo: 0 };
    if (p.chunked) return r;
    for (let o of p.ops) r[{ ОЭ: "oe", МД: "md", ВО: "vo" }[o.k] || "oe"] += krOpV(o, m);
    return r;
  }
  function krBaseCat(id, m, src = KRX.src) {
    if (KRD.posts[id].chunked) return { oe: 0, md: 0, vo: 0 };
    return src === "sum" ? { ...KRD.posts[id].summary } : krElCat(id, m);
  }
  // множитель куска 41-1(а) для модели: для 21129 операции нет
  function krChF(m) {
    return m === "21129" ? 0 : 1;
  }
  function us(n, t) {
    let e = n.posts.filter((r) => !Pe(r.id, t) && !r.offline),
      i = e.reduce((r, o) => r + fe(o.id, t), 0),
      s = Math.max(...e.map((r) => krWorst(r.id, t)));
    return {
      n: e.length,
      off: n.posts.filter((r) => r.offline).length,
      sum: i,
      max: s,
      eff: i / (e.length * KR_TAKT),
      over: e.filter((r) => krWorst(r.id, t) > KR_TAKT).length,
      free: e.reduce((r, o) => r + Math.max(0, KR_TAKT - krWorst(o.id, t)), 0),
    };
  }
  var Wt,
    Re,
    Ce,
    Zt,
    nn,
    zi,
    cr,
    ki,
    hs,
    Pe,
    hr,
    fe,
    Mn,
    Nn,
    ds,
    fs,
    Ah,
    qr,
    Rh,
    ur,
    Ch,
    Ph,
    krLoad,
    krWorst,
    krAlt,
    krApply,
    krTpl,
    Ca = vi(() => {
      Re = KRD.brigades.map((b) => ({
        ...b,
        posts: b.posts.map((id) => {
          let p = KRD.posts[id];
          return { n: p.n, name: p.name, oe: 0, md: 0, vo: 0, offline: !!p.offline, summary: p.summary };
        }),
      }));
      Ce = {};
      for (let n of Re) for (let t of n.posts) ((t.id = `${n.id}-${t.n}`), (t.brig = n), (Ce[t.id] = t));
      ((Zt = "41-1(а)"),
        // sec — живое значение куска с учётом модели (для микса — средневзвешенное)
        (nn = KRD.chunks.map((c) => ({
          ...c,
          get sec() {
            return KRX.model === "mix" ? c.v * (1 - KRX.mix) : c.v * krChF(KRX.model);
          },
        }))),
        (zi = Object.fromEntries(nn.map((n) => [n.id, n]))),
        (cr = { [Zt]: KRD.posts[Zt].ops.map((o) => [o.t, o.v, o.k, o.ch]) }),
        (ki = {
          before: { label: "ДО", long: "ДО: как сейчас" },
          varA: { label: "Вариант: в 31-11", long: "Вариант команды: работу 41-1(а) перенести в 31-11" },
          after: { label: "ПОСЛЕ: в бригаду 51", long: "ПОСЛЕ: диск → 51-11, заглушки → 51-9, пост 41-1(а) убран" },
        }),
        (hs = (n) => n.oe + n.md + n.vo),
        (Pe = (n, t) => n === Zt && t !== "before"),
        (hr = (n, t) => nn.filter((e) => e.dest[t] === n)),
        // загрузка поста для одной модели, источника и допущения о распознавании
        (krLoad = (n, t, m, src = KRX.src, rec = KRX.recog) => {
          if (Pe(n, t)) return 0;
          let b = krBaseCat(n, m, src),
            s = b.oe + b.md + b.vo;
          for (let c of KRD.chunks) c.dest[t] === n && (s += c.v * krChF(m));
          return (t === "after" && KRD.recog.posts.includes(n) && (s += rec), s);
        }),
        (fe = (n, t, m = KRX.model) =>
          m === "mix" ? (1 - KRX.mix) * krLoad(n, t, "21179") + KRX.mix * krLoad(n, t, "21129") : krLoad(n, t, m)),
        // проверка такта — по худшей модели
        (krWorst = (n, t) => (KRX.model === "mix" ? Math.max(krLoad(n, t, "21179"), krLoad(n, t, "21129")) : fe(n, t))),
        // значение из другого источника (для пунктирного контура)
        (krAlt = (n, t) => {
          let src = KRX.src === "el" ? "sum" : "el",
            m = KRX.model;
          if (n === Zt && !Pe(n, t)) {
            let z = KRD.posts[Zt].summary,
              k = src === "sum" ? z.oe + z.md + z.vo : KRD.posts[Zt].norm["21179"];
            return m === "mix" ? k * (1 - KRX.mix) : k * krChF(m);
          }
          return m === "mix"
            ? (1 - KRX.mix) * krLoad(n, t, "21179", src) + KRX.mix * krLoad(n, t, "21129", src)
            : krLoad(n, t, m, src);
        }),
        (krApply = () => {
          for (let id in Ce) {
            let p = Ce[id],
              a = krBaseCat(id, "21179"),
              b = krBaseCat(id, "21129"),
              w = KRX.model === "mix" ? KRX.mix : KRX.model === "21129" ? 1 : 0;
            for (let k of ["oe", "md", "vo"]) p[k] = Math.round(((1 - w) * a[k] + w * b[k]) * 10) / 10;
          }
        }));
      krApply();
      ((Mn = [...Re[1].posts.filter((n) => n.id !== "31-12"), ...Re[2].posts].map((n) => n.id)),
        (Nn = Re[0].posts.map((n) => n.id)),
        (ds = Object.fromEntries(Object.entries(KRD.posts).map(([k, v]) => [k, v.desc]))));
      let E = KRD.economy;
      ((fs = {
        salary: E.salary,
        social: E.social,
        shifts: E.shifts,
        orders: E.orderPerShift,
        perShift: E.pacePerShift,
        days: E.days,
      }),
        // смен, нужных под заказ при текущем выпуске за смену
        (Ah = (n = fs) => Math.ceil((n.orders * n.shifts) / n.perShift - 1e-9)),
        // ставки поста = смены линии (1 оператор в смену)
        (qr = (n = fs) => Math.max(1, Math.min(3, Math.round(n.shifts)))),
        (Rh = (n = fs) => n.salary * (1 + n.social / 100)),
        (ur = (n = fs) => Rh(n) * qr(n)),
        (Ch = (n = fs) => ur(n) * 12),
        (Ph = E.capex));
      // подстановка чисел из данных в тексты: {{L:id}}, {{P:id}} — ДО, 21179, элементы; {{key}} — словарь krVals
      krTpl = (s) =>
        String(s ?? "").replace(/\{\{(\w+)(?::([^}]+))?\}\}/g, (q, k, a) => {
          if (k === "L") return String(krLoad(a, "before", "21179", "el", 0)).replace(".", ",");
          if (k === "P") return Math.round((krLoad(a, "before", "21179", "el", 0) / KR_TAKT) * 100) + " %";
          let v = krVals()[k];
          return v == null ? q : v;
        });
    });
  // Ключевые числа для текстов, плиток и автотура (все считаются из KRD; 21179, элементы)
  function krVals() {
    let L = (id, t, r = 0, m = "21179") => krLoad(id, t, m, "el", r),
      P = (v) => Math.round((v / KR_TAKT) * 100) + " %",
      lin = (b, t, m = "21179", r = 0) =>
        KRD.brigades
          .find((x) => x.id === b)
          .posts.filter((id) => !KRD.posts[id].offline && !Pe(id, t))
          .reduce((s, id) => s + L(id, t, r, m), 0),
      nLin = (b, t) => KRD.brigades.find((x) => x.id === b).posts.filter((id) => !KRD.posts[id].offline && !Pe(id, t)).length,
      tot = (t, m = "21179", r = 0) => ["51", "31", "41"].reduce((s, b) => s + lin(b, t, m, r), 0),
      over31 = KRD.brigades[1].posts.filter((id) => !KRD.posts[id].offline && L(id, "before") > KR_TAKT),
      free41 = (m) =>
        KRD.brigades[2].posts
          .filter((id) => id !== Zt)
          .reduce((s, id) => s + Math.max(0, KR_TAKT - L(id, "before", 0, m)), 0),
      mf = KRD.brigades[2].posts.filter((id) => id !== Zt).reduce((a, id) => (KR_TAKT - L(id, "before") > KR_TAKT - L(a, "before") ? id : a), "41-1"),
      ru = (x, d = 0) => x.toLocaleString("ru-RU", { maximumFractionDigits: d, minimumFractionDigits: d }),
      D = KRD.sheetDATA,
      fund = D.availMin * 60 * D.ro,
      e = typeof pe != "undefined" ? pe : fs,
      rate = ur(e),
      lo = Ph.filter((x) => !x.opt).reduce((s, x) => s + x.lo, 0),
      hi = Ph.filter((x) => !x.opt).reduce((s, x) => s + x.hi, 0),
      cap = (smin) => Math.round(fund / (smin * KRD.const.sminSec)),
      mx31 = over31.reduce((a, id) => (L(id, "before") > L(a, "before") ? id : a), over31[0]);
    return {
      takt: KR_TAKT,
      pace: KRD.const.pace,
      p41a: L(Zt, "before"),
      p519b: L("51-9", "before"),
      p519a: L("51-9", "after"),
      p519a2: L("51-9", "after", 2),
      p5111b: L("51-11", "before"),
      p5111a: L("51-11", "after"),
      p5111a2: L("51-11", "after", 2),
      pc519b: P(L("51-9", "before")),
      pc5111b: P(L("51-11", "before")),
      pc519a: P(L("51-9", "after")).replace(" %", "") + "–" + P(L("51-9", "after", 2)),
      pc5111a: P(L("51-11", "after")).replace(" %", "") + "–" + P(L("51-11", "after", 2)),
      r519: `${L("51-9", "after")}–${L("51-9", "after", 2)}`,
      r5111: `${L("51-11", "after")}–${L("51-11", "after", 2)}`,
      p3111: L("31-11", "before"),
      p3111v: L("31-11", "varA"),
      pc3111v: P(L("31-11", "varA")),
      b51b: lin("51", "before"),
      b51a: lin("51", "after"),
      b51a2: lin("51", "after", "21179", 2),
      b31: lin("31", "before"),
      b31n: nLin("31", "before"),
      b31eff: P(lin("31", "before") / nLin("31", "before")),
      b31_29: lin("31", "before", "21129"),
      b31eff29: P(lin("31", "before", "21129") / nLin("31", "before")),
      b31free: nLin("31", "before") * KR_TAKT - lin("31", "before"),
      b41b: lin("41", "before"),
      b41a: lin("41", "after"),
      b41_29: lin("41", "before", "21129"),
      n41b: nLin("41", "before"),
      n41a: nLin("41", "after"),
      free41: free41("21179"),
      free41_29: free41("21129"),
      maxFree41: `${KR_TAKT - L(mf, "before")} (${mf})`,
      over31: over31.map((id) => `${id} (${L(id, "before")})`).join(" и "),
      over31n: over31.length,
      max31: mx31,
      max31v: L(mx31, "before"),
      p3112: L("31-12", "before"),
      tot: tot("before"),
      totA: tot("after"),
      totA2: tot("after", "21179", 2),
      tot29: tot("before", "21129"),
      extra: KRD.chunks.filter((c) => !c.dest.after).reduce((s, c) => s + c.v, 0),
      extra2: KRD.chunks.filter((c) => !c.dest.after).reduce((s, c) => s + c.v, 0) - 2 * KRD.recog.v,
      fund: ru(fund),
      cap100: cap(KRD.const.pace),
      cap79: cap(KR_TAKT),
      cap106: cap(L("31-10(а)", "before")),
      order: D.orderPerShift,
      short: D.orderPerShift - cap(KRD.const.pace),
      shortPct: Math.round(((D.orderPerShift - cap(KRD.const.pace)) / D.orderPerShift) * 100) + " %",
      stavki: qr(e),
      rate: ru(Math.round(rate)) + " ₽",
      rateK: ru(Math.round(rate / 1e3)) + " тыс. ₽",
      year: ru((rate * 12) / 1e6, 1) + " млн ₽",
      capex: `${ru(lo)}–${ru(hi)} тыс. ₽`,
      capexM: `${ru(lo / 1e3, 2)}–${ru(hi / 1e3, 2)} млн ₽`,
      payback: `${ru((lo * 1e3) / rate, 1)}–${ru((hi * 1e3) / rate, 1)}`,
    };
  }
  function nf(n, t) {
    let e = new Nt(t),
      i = n.attributes.position.count,
      s = new Float32Array(i * 3);
    for (let r = 0; r < i; r++) ((s[r * 3] = e.r), (s[r * 3 + 1] = e.g), (s[r * 3 + 2] = e.b));
    n.setAttribute("color", new Xe(s, 3));
  }
  function fr(n, t, e, i, s, r, o, a, l = 0, c = 0, h = 0) {
    (jd.set(l, c, h), Jd.setFromEuler(jd), Kd.compose(Sy.set(e, i, s), Jd, Ey.set(r, o, a)));
    let d = n.clone();
    (d.clearGroups(), d.applyMatrix4(Kd), nf(d, t), dr.push(d));
  }
  function ps(n) {
    ((dr = []), n());
    let t = Ra(dr, !1);
    return (dr.forEach((e) => e.dispose()), (dr = null), t.computeBoundingSphere(), t.computeBoundingBox(), t);
  }
  function Ay(n, t, e = 0.02, i = 0.006) {
    let s = [];
    for (let [c, h, d] of t)
      for (let u = 0; u < 28; u++) {
        let f = (u / 28) * Math.PI * 2;
        s.push([c + Math.cos(f) * (d + 0.004), h + Math.sin(f) * (d + 0.004)]);
      }
    s.sort((c, h) => c[0] - h[0] || c[1] - h[1]);
    let r = (c, h, d) => (h[0] - c[0]) * (d[1] - c[1]) - (h[1] - c[1]) * (d[0] - c[0]),
      o = [],
      a = [];
    for (let c of s) {
      for (; o.length >= 2 && r(o[o.length - 2], o[o.length - 1], c) <= 0;) o.pop();
      o.push(c);
    }
    for (let c of s.slice().reverse()) {
      for (; a.length >= 2 && r(a[a.length - 2], a[a.length - 1], c) <= 0;) a.pop();
      a.push(c);
    }
    let l = o.slice(0, -1).concat(a.slice(0, -1));
    for (let c = 0; c < l.length; c++) {
      let h = l[c],
        d = l[(c + 1) % l.length],
        u = d[0] - h[0],
        f = d[1] - h[1],
        g = Math.hypot(u, f);
      yt(X.rubber, n, (h[1] + d[1]) / 2, (h[0] + d[0]) / 2, e, i, g + 0.003, Math.atan2(-f, u));
    }
  }
  function Qd(n) {
    for (let [t, e] of Hi)
      if (n(e)) {
        xt(X.steel2, t, 0.141, e, 0.0125, 0.036, "y", 10);
        for (let i = 0; i < 4; i++) Dh(X.steel, t, 0.127 + i * 0.0095, e, 0.0145, 0.0022, Math.PI / 2);
      }
  }
  function Nh() {
    if (!ef) {
      ef = !0;
      for (let n of Vi) n.geo = ps(n.build);
    }
  }
  function Oh(n) {
    Nh();
    let t = new tn(),
      e = {},
      i = new tn();
    n === "E" && ((i.position.y = pt), t.add(i));
    for (let s of Vi) {
      if (n === "H" && s.row !== "H") continue;
      let r = new Xt(s.geo, ui[s.kind]);
      ((r.castShadow = !!s.shadow),
        (r.receiveShadow = !!s.shadow),
        (r.userData = { type: "part", part: s.id }),
        (s.row === "H" && n === "E" ? i : t).add(r),
        (e[s.id] = r));
    }
    return { g: t, meshes: e, kind: n };
  }
  var pt,
    Xn,
    Hi,
    X,
    dr,
    Kd,
    Jd,
    jd,
    Sy,
    Ey,
    wy,
    Ih,
    Lh,
    Ty,
    yt,
    xt,
    Uh,
    On,
    Dh,
    Ie,
    zt,
    Ry,
    Vi,
    Fn,
    tf,
    bn,
    mr,
    pr,
    ui,
    ms,
    sf,
    ef,
    Pa = vi(() => {
      ar();
      Th();
      ((pt = 0.46), (Xn = [-0.21, -0.07, 0.07, 0.21]), (Hi = []));
      for (let n of Xn) for (let t of [-0.028, 0.028]) for (let e of [0.055, -0.055]) Hi.push([n + t, e]);
      ((X = {
        alu: "#c6ccd4",
        alu2: "#98a1ac",
        iron: "#6c7581",
        iron2: "#5c646f",
        steel: "#b8c0ca",
        steel2: "#8e98a5",
        dark: "#2b323c",
        black: "#15191f",
        plast: "#22272f",
        rust: "#8a5536",
        rust2: "#6e4630",
        gold: "#cfa43a",
        white: "#ebe8df",
        yellow: "#facc15",
        teal: "#14b8a6",
        red: "#a61b1b",
        orange: "#d4561c",
        blue: "#3b82f6",
        rubber: "#0e1116",
        brass: "#c09036",
        grey: "#7a828c",
        disc: "#38bdf8",
        plug: "#c084fc",
        green: "#22c55e",
      }),
        (dr = null),
        (Kd = new Qt()),
        (Jd = new en()),
        (jd = new Ze()),
        (Sy = new T()),
        (Ey = new T()),
        (wy = new hi(1, 1, 1)),
        (Ih = {}),
        (Lh = (n) => Ih[n] || (Ih[n] = new Ni(1, 1, 1, n))),
        (Ty = new _a(1, 14, 10)));
      ((yt = (n, t, e, i, s, r, o, a = 0, l = 0, c = 0) => fr(wy, n, t, e, i, s, r, o, a, l, c)),
        (xt = (n, t, e, i, s, r, o = "y", a = 16) =>
          o === "x"
            ? fr(Lh(a), n, t, e, i, s, r, s, 0, 0, Math.PI / 2)
            : o === "z"
              ? fr(Lh(a), n, t, e, i, s, r, s, Math.PI / 2, 0, 0)
              : fr(Lh(a), n, t, e, i, s, r, s)),
        (Uh = (n, t, e, i, s, r = s, o = s) => fr(Ty, n, t, e, i, s, r, o)),
        (On = (n, t, e, i = 24, s = 8) => {
          let r = new ya(new Gr(t.map((o) => new T(...o))), i, e, s, !1);
          (nf(r, n), dr.push(r));
        }),
        (Dh = (n, t, e, i, s, r, o = 0, a = 0) => fr(new xa(s, r, 6, 18), n, t, e, i, 1, 1, 1, o, a, 0)));
      ((Ie = (n, t, e, i, s, r = {}) => ({
        id: n,
        post: t,
        name: e,
        desc: i,
        build: s,
        row: "H",
        kind: "metal",
        ...r,
      })),
        (zt = (n, t, e, i, s, r = {}) => ({
          id: n,
          post: t,
          name: e,
          desc: i,
          build: s,
          row: "E",
          kind: "metal",
          ...r,
        })),
        (Ry = () => {
          (yt(X.alu, 0, 0.06, 0, 0.58, 0.12, 0.32), yt(X.alu2, 0, 0.004, 0, 0.6, 0.008, 0.33));
          for (let n of Xn)
            (yt(X.dark, n, 0.055, -0.1612, 0.07, 0.034, 0.003),
              yt(X.dark, n, 0.065, 0.1612, 0.06, 0.04, 0.003),
              xt(X.dark, n, 0.1205, 0, 0.017, 0.003, "y", 14));
        }),
        (Vi = [
          zt(
            "block",
            "21",
            "Блок цилиндров",
            "Основа двигателя: внутри 4 цилиндра, в которых ходят поршни. Бригада 21 уже поставила в него коленвал, поршни и шатуны.",
            () => {
              yt(X.iron, 0, 0.28, 0, 0.56, 0.36, 0.34);
              for (let n of Xn) for (let t of [-1, 1]) yt(X.iron2, n, 0.26, t * 0.172, 0.03, 0.3, 0.006);
              (yt(X.iron2, 0.283, 0.3, 0, 0.006, 0.3, 0.26),
                yt(X.iron2, -0.284, 0.26, 0, 0.008, 0.34, 0.36),
                yt(X.iron2, 0, 0.455, 0, 0.57, 0.01, 0.345));
            },
            { shadow: !0 },
          ),
          zt(
            "pan",
            "21",
            "Масляный картер (поддон)",
            "Ванна снизу двигателя: здесь хранится моторное масло, отсюда его забирает масляный насос.",
            () => {
              (yt(X.alu2, 0, 0.055, 0, 0.52, 0.09, 0.3),
                yt(X.alu2, 0, 0.104, 0, 0.55, 0.012, 0.33),
                xt(X.dark, 0.18, 0.04, -0.152, 0.012, 0.01, "z", 8));
            },
            { shadow: !0 },
          ),
          zt(
            "oilfilter",
            "21",
            "Масляный фильтр",
            "Очищает масло от стружки и грязи, прежде чем оно пойдёт к подшипникам.",
            () => {
              (xt(X.orange, 0.1, 0.2, 0.205, 0.042, 0.07, "z", 18), xt(X.dark, 0.1, 0.2, 0.243, 0.03, 0.006, "z", 14));
            },
            { kind: "matte" },
          ),
          zt(
            "flywheel",
            "21",
            "Маховик и сцепление",
            "Тяжёлый диск на конце коленвала сглаживает рывки поршней; сцепление на нём соединяет двигатель с коробкой передач.",
            () => {
              (xt(X.steel2, -0.3, 0.18, 0, 0.155, 0.022, "x", 32),
                xt(X.dark, -0.334, 0.18, 0, 0.13, 0.045, "x", 28),
                xt(X.steel, -0.358, 0.18, 0, 0.04, 0.006, "x", 16));
            },
          ),
          Ie(
            "head",
            "51-1",
            "Головка блока цилиндров (ГБЦ)",
            "Алюминиевая \xABкрышка\xBB цилиндров: в ней каналы для воздуха и выхлопа, сёдла клапанов, отверстия под свечи.",
            Ry,
            { shadow: !0 },
          ),
          Ie(
            "valves",
            "51-2",
            "Клапаны (16 шт.)",
            "Открывают вход воздуха (8 впускных) и выход выхлопа (8 выпускных) в нужный момент.",
            () => {
              for (let [n, t] of Hi) xt(X.steel, n, 0.146, t, 0.0045, 0.052, "y", 8);
            },
          ),
          Ie(
            "phasesensor",
            "51-2",
            "Датчик фаз",
            "Сообщает блоку управления положение распредвала, чтобы впрыск и искра были вовремя.",
            () => {
              (yt(X.black, -0.3, 0.17, -0.115, 0.03, 0.04, 0.03), xt(X.black, -0.3, 0.2, -0.115, 0.007, 0.03, "y", 8));
            },
            { kind: "matte" },
          ),
          Ie(
            "washers",
            "51-3",
            "Опорные шайбы (16 шт.)",
            "Подкладки под пружины: защищают мягкий алюминий головки от стальной пружины.",
            () => {
              for (let [n, t] of Hi) xt(X.steel2, n, 0.1225, t, 0.016, 0.003, "y", 12);
            },
          ),
          Ie(
            "checkvalve",
            "51-3",
            "Обратный клапан",
            "Шарик с пружиной в масляном канале: не даёт маслу стечь из головки, когда двигатель заглушен.",
            () => {
              xt(X.brass, 0.255, 0.122, 0, 0.009, 0.004, "y", 10);
            },
          ),
          Ie(
            "springs_in",
            "51-3",
            "Пружины впускных клапанов (8 шт.)",
            "Закрывают клапан обратно после того, как кулачок распредвала его нажал.",
            () => Qd((n) => n > 0),
          ),
          Ie(
            "springs_ex",
            "51-4",
            "Пружины выпускных клапанов (8 шт.)",
            "То же для выпускных клапанов: прижимают клапан к седлу.",
            () => Qd((n) => n < 0),
          ),
          Ie(
            "retainers",
            "51-4",
            "Тарелки пружин (16 шт.)",
            "Шайба сверху пружины: через неё пружина тянет клапан вверх.",
            () => {
              for (let [n, t] of Hi) xt(X.steel, n, 0.161, t, 0.013, 0.004, "y", 12);
            },
          ),
          Ie(
            "keepers",
            "51-5",
            "Сухари (32 полукольца)",
            "Крошечные полукольца, которые защёлкивают тарелку на стержне клапана. Потеря сухаря = тяжёлая поломка двигателя.",
            () => {
              for (let [n, t] of Hi) xt(X.dark, n, 0.166, t, 0.0065, 0.006, "y", 8);
            },
          ),
          Ie(
            "lifters",
            "51-6",
            "Гидротолкатели (16 шт.)",
            "Стаканчики между кулачком и клапаном. Маслом сами выбирают зазор — клапаны не надо регулировать.",
            () => {
              for (let [n, t] of Hi) xt(X.steel, n, 0.172, t, 0.0155, 0.022, "y", 14);
            },
          ),
          Ie(
            "camshafts",
            "51-7",
            "Распредвалы (впускной и выпускной)",
            "Валы с кулачками: по очереди нажимают на толкатели и открывают клапаны. Крутятся от коленвала через ремень ГРМ.",
            () => {
              for (let n of [0.055, -0.055]) {
                (xt(X.steel, 0, 0.205, n, 0.011, 0.6, "x", 12),
                  Hi.forEach(([t, e], i) => {
                    Math.sign(e) === Math.sign(n) && yt(X.steel2, t, 0.205, n, 0.012, 0.034, 0.024, i * 0.9);
                  }));
                for (let t of [-0.14, 0, 0.14, 0.28, -0.28]) xt(X.steel, t, 0.205, n, 0.015, 0.014, "x", 12);
              }
            },
          ),
          Ie(
            "camhousing",
            "51-7",
            "Корпус подшипников распредвалов",
            "Алюминиевая рамка с крышками-постелями: держит оба распредвала. Крепится 20 болтами.",
            () => {
              for (let n of [-1, 1]) yt(X.alu, 0, 0.175, n * 0.15, 0.6, 0.11, 0.03);
              for (let n of [-1, 1]) yt(X.alu, n * 0.29, 0.175, 0, 0.03, 0.11, 0.27);
              for (let n of [-0.14, 0, 0.14]) yt(X.alu2, n, 0.222, 0, 0.03, 0.016, 0.27);
              for (let n = -0.26; n <= 0.27; n += 0.075)
                for (let t of [-1, 1]) xt(X.dark, n, 0.232, t * 0.15, 0.006, 0.006, "y", 6);
              for (let n of [-0.14, 0, 0.14]) for (let t of [-0.1, 0.1]) xt(X.dark, n, 0.232, t, 0.006, 0.006, "y", 6);
            },
          ),
          Ie(
            "studs_ex",
            "51-8",
            "Шпильки катколлектора (8 шт.)",
            "Штыри с резьбой на стороне выпуска: на них потом наденут катколлектор и закрутят гайки.",
            () => {
              for (let n of Xn) for (let t of [-0.045, 0.045]) xt(X.steel, n + t, 0.06, -0.177, 0.005, 0.032, "z", 8);
            },
          ),
          Ie(
            "thermostuds",
            "51-8",
            "Шпильки термостата (2 шт.)",
            "Штыри на торце головки для крепления корпуса термостата.",
            () => {
              for (let n of [0.07, 0.13]) xt(X.steel, -0.305, 0.06, n, 0.005, 0.03, "x", 8);
            },
          ),
          Ie(
            "studs_in",
            "51-9",
            "Шпильки модуля впуска (3 шт.)",
            "Штыри на стороне впуска: на них бригада 41 посадит модуль впуска.",
            () => {
              for (let n of [-0.2, 0, 0.2]) xt(X.steel, n, 0.088, 0.177, 0.005, 0.032, "z", 8);
            },
          ),
          Ie(
            "sealant",
            "51-9",
            "Герметик в 2 отверстия",
            "Синий герметик кистью: закрывает технологические отверстия, чтобы не было течи масла.",
            () => {
              for (let n of [-0.1, 0.1]) xt(X.blue, 0.255, 0.1215, n, 0.009, 0.003, "y", 10);
            },
            { kind: "matte" },
          ),
          Ie(
            "thermostat",
            "51-10",
            "Термостат и датчик температуры",
            "Клапан охлаждающей жидкости: пока мотор холодный — держит жидкость в двигателе, чтобы он быстрее прогрелся; горячий — пускает в радиатор.",
            () => {
              (yt(X.white, -0.322, 0.06, 0.1, 0.04, 0.075, 0.075),
                xt(X.white, -0.352, 0.06, 0.1, 0.022, 0.04, "x", 14),
                xt(X.black, -0.322, 0.106, 0.1, 0.007, 0.02, "y", 8));
            },
            { kind: "matte" },
          ),
          Ie(
            "stamp",
            "51-11",
            "Клеймо контролёра",
            "Отметка, что головка проверена: сальники, прокладка, поверхности без сколов.",
            () => {
              yt(X.yellow, 0.2, 0.1212, -0.1, 0.026, 0.002, 0.026);
            },
            { kind: "matte" },
          ),
          Ie(
            "disc",
            "move",
            "Задающий диск",
            "Диск на выпускном распредвале: по его зубцам датчик фаз узнаёт положение вала. Работа поста 41-1(а), которую переносим.",
            () => {
              xt(X.disc, -0.312, 0.205, -0.055, 0.038, 0.01, "x", 24);
              for (let n = 0; n < 4; n++) {
                let t = (n / 4) * Math.PI * 2;
                yt(X.disc, -0.312, 0.205 + Math.sin(t) * 0.04, -0.055 + Math.cos(t) * 0.04, 0.01, 0.012, 0.012, t);
              }
              xt(X.steel, -0.305, 0.205, -0.055, 0.013, 0.012, "x", 12);
            },
          ),
          Ie(
            "plugs",
            "move",
            "Заглушки (2 шт.) на герметике",
            "Металлические заглушки технологических отверстий головки, запрессовываются молотком на герметик. Работа поста 41-1(а), которую переносим.",
            () => {
              (xt(X.plug, -0.293, 0.205, 0.055, 0.017, 0.007, "x", 16),
                xt(X.plug, -0.293, 0.09, -0.02, 0.013, 0.007, "x", 14));
            },
          ),
          zt(
            "headbolts",
            "31-1",
            "Болты ГБЦ (10 шт.)",
            "Длинные болты притягивают головку к блоку через прокладку — от них зависит герметичность цилиндров.",
            () => {
              for (let n of [-0.245, -0.14, 0, 0.14, 0.245])
                for (let t of [-0.1, 0.1]) xt(X.dark, n, pt + 0.125, t, 0.0085, 0.009, "y", 6);
            },
          ),
          zt(
            "waterpump",
            "31-1",
            "Водяной насос (помпа)",
            "Гоняет охлаждающую жидкость по двигателю и радиатору. Крутится от ремня ГРМ.",
            () => {
              (xt(X.alu2, 0.3, 0.3, 0.07, 0.05, 0.03, "x", 20), xt(X.steel, 0.325, 0.3, 0.07, 0.042, 0.018, "x", 20));
            },
          ),
          zt(
            "rearcover",
            "31-2",
            "Защитная (задняя) крышка ремня",
            "Пластина за ремнём ГРМ: не даёт грязи и маслу попасть на ремень со стороны двигателя.",
            () => {
              yt(X.dark, 0.3, 0.43, 0, 0.006, 0.56, 0.3);
              for (let [n, t] of [
                [0.2, 0.13],
                [0.2, -0.13],
                [0.68, 0.13],
                [0.68, -0.13],
              ])
                xt(X.steel, 0.305, n, t, 0.007, 0.006, "x", 6);
            },
            { kind: "matte" },
          ),
          zt(
            "pulleys",
            "31-3",
            "Шкивы ГРМ и шпонки",
            "Зубчатые колёса на распредвалах и коленвале. Через них ремень крутит распредвалы ровно в 2 раза медленнее коленвала.",
            () => {
              for (let n of [0.055, -0.055])
                (xt(X.steel, 0.335, pt + 0.205, n, 0.052, 0.022, "x", 30),
                  xt(X.dark, 0.348, pt + 0.205, n, 0.015, 0.006, "x", 12));
              xt(X.steel, 0.335, 0.18, 0, 0.034, 0.022, "x", 20);
            },
          ),
          zt("bracket31", "31-3", "Кронштейн на ГБЦ", "Опора для навесных деталей на передней части головки.", () => {
            yt(X.alu2, 0.31, pt + 0.08, -0.13, 0.04, 0.08, 0.05);
          }),
          zt(
            "tensioner",
            "31-4",
            "Натяжной ролик",
            "Ролик с пружиной: держит ремень ГРМ натянутым, чтобы он не проскочил по зубьям.",
            () => {
              (xt(X.steel, 0.335, 0.44, -0.075, 0.026, 0.02, "x", 18),
                yt(X.alu2, 0.318, 0.48, -0.09, 0.01, 0.07, 0.02));
            },
          ),
          zt(
            "belt",
            "31-5",
            "Ремень ГРМ",
            "Зубчатый ремень связывает коленвал и распредвалы: клапаны открываются точно в такт поршням. Ошибка на 1 зуб — мотор не заведётся.",
            () => {
              Ay(0.335, [
                [0, 0.18, 0.034],
                [0.07, 0.3, 0.042],
                [0.09, 0.4, 0.022],
                [0.055, pt + 0.205, 0.052],
                [-0.055, pt + 0.205, 0.052],
                [-0.075, 0.44, 0.026],
              ]);
            },
            { kind: "matte" },
          ),
          zt("idler", "31-5(а)", "Опорный ролик", "Направляет ремень ГРМ, чтобы он плотно охватывал шкивы.", () => {
            xt(X.steel, 0.335, 0.4, 0.09, 0.022, 0.02, "x", 18);
          }),
          zt(
            "damper",
            "31-6",
            "Демпфер (шкив коленвала)",
            "Шкив с резиновым слоем: гасит крутильные колебания коленвала, от него ремнём крутится генератор.",
            () => {
              (xt(X.dark, 0.375, 0.18, 0, 0.07, 0.03, "x", 30), xt(X.steel, 0.392, 0.18, 0, 0.02, 0.008, "x", 12));
            },
          ),
          zt(
            "lowercover",
            "31-6",
            "Нижняя передняя крышка",
            "Закрывает нижнюю часть ремня ГРМ спереди.",
            () => {
              yt(X.black, 0.352, 0.27, 0, 0.008, 0.2, 0.26);
            },
            { kind: "matte" },
          ),
          zt(
            "uppercover",
            "31-7",
            "Верхняя передняя крышка",
            "Закрывает шкивы распредвалов и ремень сверху. После неё ремня уже не видно.",
            () => {
              yt(X.black, 0.354, 0.55, 0, 0.012, 0.34, 0.28);
              for (let n of [-1, 1]) yt(X.black, 0.344, 0.55, n * 0.142, 0.026, 0.34, 0.008);
            },
            { kind: "matte" },
          ),
          zt(
            "waterpipe",
            "31-8",
            "Труба водяного насоса",
            "Металлическая труба, по которой охлаждающая жидкость идёт к насосу.",
            () => {
              On(
                X.steel,
                [
                  [0.27, 0.27, 0.15],
                  [0.2, 0.13, 0.19],
                  [-0.2, 0.13, 0.19],
                  [-0.29, 0.22, 0.17],
                ],
                0.011,
                30,
              );
            },
          ),
          zt(
            "cranksensor",
            "31-8",
            "Датчик положения коленвала",
            "Главный датчик двигателя: по нему блок управления знает, когда давать искру и впрыск.",
            () => {
              (xt(X.black, -0.2, 0.16, -0.185, 0.012, 0.03, "z", 10), yt(X.dark, -0.2, 0.18, -0.2, 0.02, 0.016, 0.014));
            },
            { kind: "matte" },
          ),
          zt(
            "exgasket",
            "31-8",
            "Прокладка выпускного коллектора",
            "Стальная прокладка между головкой и катколлектором — чтобы выхлоп не прорывался наружу.",
            () => {
              yt(X.steel2, 0, pt + 0.06, -0.1635, 0.5, 0.06, 0.003);
            },
          ),
          zt(
            "exhaust",
            "31-9",
            "Катколлектор (приёмная труба)",
            "Собирает выхлоп из 4 цилиндров в одну трубу и сразу чистит его в катализаторе.",
            () => {
              (Xn.forEach((n) =>
                On(
                  X.rust,
                  [
                    [n, pt + 0.055, -0.17],
                    [n * 0.9, pt + 0.03, -0.235],
                    [n * 0.45, pt - 0.06, -0.29],
                    [0.02, pt - 0.15, -0.3],
                  ],
                  0.017,
                  16,
                ),
              ),
                xt(X.rust2, 0.025, 0.2, -0.3, 0.06, 0.17, "y", 20),
                xt(X.rust, 0.025, 0.1, -0.3, 0.035, 0.04, "y", 14));
            },
            { shadow: !0 },
          ),
          zt(
            "bracket10",
            "31-10(а)",
            "Кронштейн и его крышка",
            "Опора на заднем торце двигателя под навесное оборудование.",
            () => {
              (yt(X.alu2, -0.31, 0.32, -0.1, 0.03, 0.14, 0.08), yt(X.alu, -0.328, 0.36, -0.1, 0.006, 0.08, 0.07));
            },
          ),
          zt(
            "eye",
            "31-10(а)",
            "Рым (подъёмная проушина)",
            "Кольцо, за которое двигатель поднимают краном — например, при установке в автомобиль.",
            () => {
              (yt(X.steel2, -0.3, pt + 0.24, -0.08, 0.012, 0.05, 0.04),
                Dh(X.steel, -0.3, pt + 0.285, -0.08, 0.028, 0.007, 0, Math.PI / 2));
            },
          ),
          zt(
            "fuelrail",
            "31-11",
            "Рампа форсунок",
            "Труба с топливом под давлением и 4 форсунки: они впрыскивают бензин в каждый цилиндр.",
            () => {
              xt(X.steel, 0, pt + 0.1, 0.22, 0.013, 0.5, "x", 12);
              for (let n of Xn)
                (xt(X.dark, n, pt + 0.075, 0.2, 0.009, 0.05, "y", 10),
                  xt(X.black, n, pt + 0.105, 0.205, 0.011, 0.012, "y", 10));
            },
          ),
          zt(
            "vvt",
            "31-11",
            "Клапан регулировки распредвала и датчик фаз",
            "Клапан меняет момент открытия клапанов под нагрузку (больше мощности, меньше расход); датчик следит за распредвалом.",
            () => {
              (xt(X.black, 0.26, pt + 0.24, 0.1, 0.012, 0.04, "y", 10),
                yt(X.grey, 0.26, pt + 0.27, 0.1, 0.02, 0.015, 0.02),
                yt(X.black, 0.26, pt + 0.23, -0.1, 0.025, 0.03, 0.02));
            },
            { kind: "matte" },
          ),
          zt(
            "harness31",
            "31-11(а)",
            "Жгут проводов (часть)",
            "Провода к датчикам и форсункам; бирюзовые клипсы держат жгут на головке (видно на видео поста 31-11(а)).",
            () => {
              On(
                X.black,
                [
                  [0.28, pt + 0.17, -0.2],
                  [0.1, pt + 0.18, -0.205],
                  [-0.1, pt + 0.18, -0.205],
                  [-0.28, pt + 0.16, -0.19],
                  [-0.32, pt + 0.06, -0.17],
                ],
                0.007,
                30,
              );
              for (let n of [0.2, 0.06, -0.08, -0.22]) yt(X.teal, n, pt + 0.18, -0.205, 0.02, 0.018, 0.018);
              yt(X.grey, -0.32, pt + 0.04, -0.17, 0.02, 0.025, 0.02);
            },
            { kind: "matte" },
          ),
          zt(
            "dipstick",
            "41-1",
            "Щуп и его трубка",
            "Палочка для проверки уровня масла; жёлтая ручка — чтобы её легко найти под капотом.",
            () => {
              (On(
                X.steel,
                [
                  [-0.05, 0.25, 0.185],
                  [-0.05, 0.45, 0.235],
                  [-0.06, pt + 0.2, 0.25],
                  [-0.06, pt + 0.33, 0.25],
                ],
                0.006,
                20,
              ),
                Dh(X.yellow, -0.06, pt + 0.35, 0.25, 0.016, 0.0045));
            },
          ),
          zt(
            "knock",
            "41-1",
            "Датчик детонации",
            "\xABСлушает\xBB блок: если топливо взрывается неправильно (детонация), блок управления сдвигает зажигание.",
            () => {
              (yt(X.black, 0.02, 0.3, 0.178, 0.026, 0.026, 0.016), xt(X.grey, 0.02, 0.3, 0.188, 0.008, 0.006, "z", 8));
            },
            { kind: "matte" },
          ),
          zt("fuelline", "41-1", "Топливная трубка", "Подводит бензин к рампе форсунок.", () => {
            On(
              X.steel,
              [
                [-0.25, pt + 0.1, 0.22],
                [-0.31, pt + 0.1, 0.24],
                [-0.36, pt + 0.05, 0.26],
                [-0.38, pt, 0.28],
              ],
              0.005,
              16,
            );
          }),
          zt(
            "valvecover",
            "41-2",
            "Клапанная крышка",
            "Закрывает распредвалы сверху, чтобы масло не разбрызгивалось. Крепится 15 болтами, их наживляют руками.",
            () => {
              (yt(X.dark, 0, pt + 0.262, 0, 0.6, 0.06, 0.31), yt(X.grey, 0, pt + 0.294, 0, 0.56, 0.006, 0.27));
              for (let n of Xn) xt(X.black, n, pt + 0.298, 0, 0.02, 0.004, "y", 14);
              for (let n = -0.27; n <= 0.28; n += 0.09)
                for (let t of [-1, 1]) xt(X.steel2, n, pt + 0.294, t * 0.148, 0.006, 0.008, "y", 6);
            },
            { kind: "matte", shadow: !0 },
          ),
          zt("sparkplugs", "41-3", "Свечи зажигания (4 шт.)", "Дают искру, которая поджигает смесь в цилиндре.", () => {
            for (let n of Xn)
              (xt(X.white, n, pt + 0.31, 0, 0.008, 0.03, "y", 10), xt(X.steel, n, pt + 0.3, 0, 0.012, 0.006, "y", 6));
          }),
          zt(
            "pcvhose",
            "41-3",
            "Шланг вентиляции картера",
            "Отводит картерные газы обратно во впуск, чтобы они сгорели, а не ушли в атмосферу.",
            () => {
              On(
                X.black,
                [
                  [0.2, pt + 0.29, -0.13],
                  [0.25, pt + 0.3, -0.18],
                  [0.3, pt + 0.2, -0.2],
                ],
                0.009,
                14,
              );
            },
            { kind: "matte" },
          ),
          zt(
            "intake",
            "41-4",
            "Модуль впуска",
            "Пластиковый коллектор: распределяет воздух поровну по 4 цилиндрам.",
            () => {
              xt(X.plast, 0, pt + 0.14, 0.34, 0.055, 0.52, "x", 18);
              for (let n of Xn)
                On(
                  X.plast,
                  [
                    [n, pt + 0.065, 0.165],
                    [n, pt + 0.12, 0.21],
                    [n, pt + 0.2, 0.27],
                    [n, pt + 0.17, 0.33],
                  ],
                  0.022,
                  16,
                );
            },
            { kind: "matte", shadow: !0 },
          ),
          zt(
            "coils",
            "41-5",
            "Катушки зажигания (4 шт.)",
            "Превращают 12 вольт в десятки тысяч вольт для искры на свече.",
            () => {
              for (let n of Xn)
                (yt(X.black, n, pt + 0.335, 0, 0.045, 0.05, 0.07),
                  yt(X.red, n, pt + 0.364, 0, 0.045, 0.01, 0.07),
                  yt(X.grey, n, pt + 0.345, -0.045, 0.02, 0.02, 0.02));
            },
            { kind: "matte" },
          ),
          zt(
            "harness41",
            "41-6",
            "Жгут к катушкам",
            "Провода от блока управления к каждой катушке.",
            () => {
              On(
                X.black,
                [
                  [0.3, pt + 0.33, -0.07],
                  [0.1, pt + 0.36, -0.065],
                  [-0.1, pt + 0.36, -0.065],
                  [-0.3, pt + 0.33, -0.07],
                ],
                0.007,
                24,
              );
            },
            { kind: "matte" },
          ),
          zt(
            "oilcap",
            "41-6",
            "Крышка маслозаливной горловины",
            "Через эту горловину заливают масло.",
            () => {
              xt(X.yellow, -0.12, pt + 0.31, 0.105, 0.02, 0.016, "y", 16);
            },
            { kind: "matte" },
          ),
          zt(
            "accbracket",
            "41-7",
            "Кронштейн вспомогательных агрегатов",
            "Литая опора, на которую в машине повесят генератор и компрессор кондиционера.",
            () => {
              (yt(X.alu2, 0.25, 0.3, 0.22, 0.1, 0.2, 0.05), yt(X.alu2, 0.27, 0.4, 0.2, 0.06, 0.06, 0.1));
              for (let n of [0.24, 0.36]) xt(X.steel, 0.25, n, 0.25, 0.008, 0.01, "z", 6);
            },
          ),
          zt(
            "throttle",
            "41-8",
            "Дроссельный патрубок",
            "Заслонка, которой педаль газа (через электронику) регулирует, сколько воздуха идёт в двигатель.",
            () => {
              (xt(X.alu, -0.29, pt + 0.14, 0.34, 0.042, 0.06, "x", 20),
                yt(X.black, -0.29, pt + 0.2, 0.34, 0.04, 0.03, 0.05));
            },
          ),
          zt(
            "mapsensor",
            "41-8",
            "Датчик температуры и давления воздуха",
            "Сообщает, сколько воздуха вошло, — по нему считается доза топлива.",
            () => {
              yt(X.black, 0.15, pt + 0.2, 0.34, 0.03, 0.02, 0.03);
            },
            { kind: "matte" },
          ),
          zt(
            "catplug",
            "41-8",
            "Заглушка катколлектора и кронштейн трубы",
            "Заглушка резьбового отверстия катколлектора и опора подводящей трубы.",
            () => {
              (xt(X.steel, 0.1, 0.26, -0.362, 0.008, 0.014, "z", 8), yt(X.steel2, -0.2, 0.4, 0.26, 0.02, 0.06, 0.02));
            },
          ),
          zt(
            "groundwire",
            "41-9",
            "Провод массы",
            "Соединяет двигатель с \xABминусом\xBB — без него не будут работать датчики и стартер.",
            () => {
              (On(
                X.black,
                [
                  [-0.28, pt + 0.2, -0.12],
                  [-0.3, pt + 0.05, -0.16],
                  [-0.3, 0.3, -0.18],
                ],
                0.004,
                14,
              ),
                yt(X.yellow, -0.3, 0.29, -0.18, 0.012, 0.01, 0.01));
            },
            { kind: "matte" },
          ),
          zt(
            "pcvtube",
            "41-9",
            "Трубка картерных газов",
            "Вторая трубка системы вентиляции картера.",
            () => {
              On(
                X.black,
                [
                  [0.2, 0.34, 0.18],
                  [0.22, pt + 0.1, 0.28],
                  [0.1, pt + 0.2, 0.3],
                ],
                0.008,
                14,
              );
            },
            { kind: "matte" },
          ),
          zt(
            "o2sensor",
            "41-10",
            "Датчик кислорода (+ маркировка)",
            "Меряет кислород в выхлопе — по нему блок управления держит правильную смесь. Контролёр затягивает его и ставит метку.",
            () => {
              (xt(X.gold, 0.03, 0.24, -0.37, 0.01, 0.04, "z", 10),
                xt(X.yellow, 0.03, 0.24, -0.392, 0.011, 0.003, "z", 10),
                On(
                  X.black,
                  [
                    [0.03, 0.24, -0.39],
                    [0.08, 0.3, -0.38],
                    [0.15, 0.36, -0.3],
                  ],
                  0.004,
                  10,
                ));
            },
          ),
          zt(
            "flange41",
            "41-11",
            "Фланец подвески",
            "Фланец, за который двигатель вешают на подвеску; дальше — участок испытаний.",
            () => {
              yt(X.steel2, -0.37, 0.3, 0, 0.01, 0.14, 0.14);
              for (let [n, t] of [
                [0.25, 0.05],
                [0.35, -0.05],
                [0.25, -0.05],
              ])
                xt(X.steel, -0.377, n, t, 0.007, 0.006, "x", 6);
            },
          ),
        ]));
      ((Fn = Object.fromEntries(Vi.map((n) => [n.id, n]))),
        (tf = {
          disc: { before: "41-1(а)", varA: "31-11", after: "51-11" },
          plugs: { before: "41-1(а)", varA: "31-11", after: "51-9" },
        }),
        (bn = (n, t) => (tf[n] ? tf[n][t] : Fn[n].post)),
        (mr = (n, t) => {
          let e = bn(n, t);
          return e.startsWith("51") ? "31-1" : e;
        }),
        (pr = (n, t) => {
          let e = new Wn({ vertexColors: !0, ...n });
          return (t && ((e.emissive = new Nt(t[0])), (e.emissiveIntensity = t[1])), e);
        }),
        (ui = { metal: pr({ metalness: 0.5, roughness: 0.42 }), matte: pr({ metalness: 0.06, roughness: 0.72 }) }),
        (ms = {
          metal: pr({ metalness: 0.5, roughness: 0.42 }, ["#ff8a00", 0.75]),
          matte: pr({ metalness: 0.06, roughness: 0.72 }, ["#ff8a00", 0.75]),
        }),
        (sf = {
          metal: pr({ metalness: 0.5, roughness: 0.42 }, ["#ffb347", 0.28]),
          matte: pr({ metalness: 0.06, roughness: 0.72 }, ["#ffb347", 0.28]),
        }),
        (ef = !1));
    });
  var Ia,
    rf = vi(() => {
      // совместимость: пооперационные элементы теперь в KRD.posts[id].ops
      Ia = Object.fromEntries(
        Object.entries(KRD.posts).map(([k, p]) => [k, { model: p.normModel, total: p.norm["21179"], ops: p.ops.map((o) => [o.t, o.v, o.k]) }]),
      );
    });
  function Zr(n, t) {
    // список шагов: для микса показываем 21179 (худший случай — с операциями 41-1(а))
    let sm = KRX.model === "21129" ? "21129" : "21179";
    if (n === Zt)
      return sm === "21129"
        ? []
        : cr[Zt].map(([r, o, a, l]) => {
            let c = zi[l].dest[t];
            return t === "before"
              ? { t: r, s: o, k: a, ch: l, active: !0, post: Zt }
              : { t: r, s: o, k: a, ch: l, active: !1, tag: c ? `→ ${c}` : "не нужно", cls: c ? "moved" : "gone", post: c };
          });
    let i = KRD.posts[n].ops
        .filter((o) => krOpV(o, sm) > 0)
        .map((o) => ({ t: o.t, s: krOpV(o, sm), k: o.k, active: !0, post: n, ...(o.note ? { tag: o.note, cls: "note" } : {}) })),
      s = krWorst(n, t) > KR_TAKT;
    if (sm !== "21129")
      for (let r of hr(n, t))
        for (let [o, a, l, c] of cr[Zt])
          c === r.id &&
            i.push({ t: o, s: a, k: l, ch: c, active: !0, tag: "из 41-1(а)", cls: s ? "add-bad" : "new", post: n });
    return (
      t === "after" &&
        KRX.recog &&
        KRD.recog.posts.includes(n) &&
        i.push({ t: KRD.recog.t, s: KRX.recog, k: KRD.recog.k, active: !0, tag: "допущение команды", cls: "new", post: n }),
      i
    );
  }
  function _r(n, t) {
    let e = Vi.filter((i) => bn(i.id, t) === n).map((i) => ({ id: i.id, name: i.name, desc: i.desc, post: n }));
    return (
      n === "31-1" &&
        e.unshift({
          id: "head",
          name: "ГБЦ в сборе (от бригады 51)",
          desc: "Головку, собранную бригадой 51 на 11 постах, ставят на блок цилиндров и притягивают болтами.",
          post: "31-1",
        }),
      e
    );
  }
  function gr(n = pe.scen, t = pe.opt) {
    return Ph.filter((e) => !e.opt || t).reduce((e, i) => e + i[n], 0) * 1e3;
  }
  function lf(n) {
    // постоянный итог «ДО → ПОСЛЕ» (21179, элементы): режим страницы его не меняет
    let V = krVals(),
      T = (c, t) => ` <span class="tg ${c}">${t}</span>`,
      h = (d, u, f = "") => `<div><b class="${f}">${d}</b><span>${u}</span></div>`,
      src = KRX.src === "el" ? "элементы" : "сводка/диаграмма",
      mdl = KRX.model === "mix" ? `микс, доля 21129 ${Math.round(KRX.mix * 100)} %` : KRX.model;
    return (
      `<div class="kpi-h">Итог переноса · ДО → ПОСЛЕ · модель 21179 · по элементам${T("tr", "расчёт из таблицы")}</div>` +
      [
        h(`${V.p41a} → 0 смин`, `Пост 41-1(а) убран. ${V.extra} смин лишних действий исчезают (${V.extra2} — если в бригаде 51 модель определяют вручную, +2 смин на пост)`, "good"),
        h(`${V.p519b} → ${V.r519} смин`, `51-9: заглушки на герметике · ${V.pc519a} такта`, "good"),
        h(`${V.p5111b} → ${V.r5111} смин`, `51-11: задающий диск · ${V.pc5111a} такта`, "good"),
        h(`${V.tot} → ${V.totA}–${V.totA2}`, `Трудоёмкость ДВС, смин: линейные посты 51 + 31 + 41`),
        h(`${V.stavki} ставки`, `1 оператор × ${V.stavki} смены — перевод или незамещение вакансий, не сокращение${T("tz", "данные завода")}`),
        h(`${V.rateK} / мес`, `ФОТ поста с взносами (${V.year} в год). Деньги — только если вакансии не замещают${T("ta", "допущение команды")}`),
        h(V.capexM, `Разовые затраты, без опций${T("ta", "допущение команды")}`),
        h(`${V.payback} мес`, `Окупаемость при незамещении вакансий`, "good"),
      ].join("") +
      `<div class="kpi-now">На 3D и графиках сейчас: <em>${ki[n].label}</em> · источник: <em>${src}</em> · модель: <em>${mdl}</em> · модель в бригаде 51: <em>${KRX.recog ? "+" + KRX.recog + " смин (определяют вручную)" : "на экране, 0 смин"}</em></div>`
    );
  }
  function Py(n) {
    let c = (x) => 276 - (x / 135) * 250,
      h = 44,
      d = [],
      u = {},
      g = 44 + Re.reduce((x, p) => x + p.posts.length, 0) * 30 + (Re.length - 1) * 34 + 70;
    for (let x = 0; x <= 120; x += 20)
      d.push(
        `<line x1="38" x2="${g - 70 + 6}" y1="${c(x)}" y2="${c(x)}" stroke="#1f2733"/><text x="34" y="${c(x) + 4}" text-anchor="end" class="ax">${x}</text>`,
      );
    if (
      (Re.forEach((x, p) => {
        let m = h;
        for (let E of x.posts) {
          let v = h + 4.5;
          ((u[E.id] = v + 21 / 2),
            d.push(cf(E, n, v, 21, c)),
            d.push(`<text x="${v + 21 / 2}" y="${c(0) + 14}" text-anchor="middle" class="pn">${E.n}</text>`),
            (h += 30));
        }
        (d.push(
          `<text x="${(m + h) / 2}" y="${c(0) + 34}" text-anchor="middle" class="bn" fill="${x.color}">${x.title} \xB7 ${x.sub}</text>`,
        ),
          p < Re.length - 1 &&
            d.push(`<text x="${h + 34 / 2}" y="${c(0) + 34}" text-anchor="middle" class="ax">→</text>`),
          (h += 34));
      }),
      d.push(
        `<line x1="38" x2="${g - 70 + 6}" y1="${c(79)}" y2="${c(79)}" stroke="#ff2400" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${g - 70 + 10}" y="${c(79) + 4}" class="vl bad">такт ${79}</text>`,
      ),
      n !== "before")
    )
      for (let x of new Set(nn.map((p) => p.dest[n]).filter(Boolean))) {
        let p = u[Zt],
          m = u[x],
          E = nn.find((I) => I.dest[n] === x),
          v = c(fe(x, n)) - 16,
          S = Math.min(28, v - 40);
        d.push(
          `<path d="M${p} ${c(60) - 18} Q ${(p + m) / 2} ${S - 30} ${m} ${v}" fill="none" stroke="${n === "varA" ? "#ef4444" : E.color}" stroke-width="1.6" marker-end="url(#ah-${n === "varA" ? "r" : E.id})" opacity=".9"/>`,
        );
      }
    return { html: Iy() + d.join(""), width: g, height: 322 };
  }
  function cf(n, t, e, i, s) {
    let r = fe(n.id, t),
      o = [];
    if (Pe(n.id, t)) {
      let z = fe(n.id, "before");
      return `<rect x="${e}" y="${s(z)}" width="${i}" height="${s(0) - s(z)}" fill="none" stroke="#ef4444" stroke-dasharray="3 3"/><text x="${e + i / 2}" y="${s(z) - 6}" text-anchor="middle" class="vl bad">убран</text>`;
    }
    let a = 0,
      l = (h, d) => {
        h &&
          (o.push(
            `<rect x="${e}" y="${s(a + h)}" width="${i}" height="${Math.max(0.5, s(a) - s(a + h) - 0.6)}" fill="${d}"/>`,
          ),
          (a += h));
      };
    (l(n.oe, fi.ОЭ), l(n.md, fi.МД), l(n.vo, fi.ВО));
    for (let h of hr(n.id, t)) l(h.sec, h.color);
    t === "after" && KRX.recog && KRD.recog.posts.includes(n.id) && l(KRX.recog, "#94a3b8");
    let c = r !== fe(n.id, "before"),
      w = krWorst(n.id, t),
      // пунктир — значение другого источника (сводка/диаграмма или элементы)
      alt = krAlt(n.id, t),
      an = KRX.src === "el" ? (n.brig.id === "31" ? "на диаграмме" : "в сводке") : "по элементам",
      as = KRX.src === "el" ? (n.brig.id === "31" ? "диагр." : "сводка") : "элем.";
    if (Math.abs(alt - r) >= 0.5) {
      o.push(
        `<rect class="alt-src" x="${e - 1.5}" y="${s(alt)}" width="${i + 3}" height="${s(0) - s(alt)}" fill="none" stroke="#e2e8f0" stroke-width="1.2" stroke-dasharray="3 2"><title>${n.id}: ${an} ${ue(alt)} смин, ${KRX.src === "el" ? "по элементам" : "в сводке/на диаграмме"} ${ue(r)} смин</title></rect>`,
      );
      Math.abs(alt - r) >= 8 &&
        o.push(
          `<text x="${e + i / 2}" y="${alt > r ? s(alt) - 3 : s(alt) + 9}" text-anchor="middle" class="alt-l">${as} ${ue(alt)}</text>`,
        );
    }
    return (
      n.offline &&
        o.push(`<text x="${e + i / 2}" y="${s(Math.max(r, alt)) - 16}" text-anchor="middle" class="alt-l">вне линии</text>`),
      o.push(
        `<text x="${e + i / 2}" y="${s(r) - 5}" text-anchor="middle" class="vl ${w > KR_TAKT && !n.offline ? "bad" : c ? "good" : ""}">${ue(r)}</text>`,
      ),
      o.join("")
    );
  }
  function af(n, t, e) {
    let h = (f) => 192 - (f / 135) * 170,
      d = 34 + n.posts.length * 34 + 12,
      u = [];
    for (let f = 0; f <= 120; f += 40)
      u.push(
        `<line x1="30" x2="${d - 12}" y1="${h(f)}" y2="${h(f)}" stroke="#1f2733"/><text x="27" y="${h(f) + 4}" text-anchor="end" class="ax">${f}</text>`,
      );
    return (
      n.posts.forEach((f, g) => {
        let x = 34 + g * 34 + 5;
        (u.push(cf(f, t, x, 24, h)),
          u.push(`<text x="${x + 24 / 2}" y="${h(0) + 14}" text-anchor="middle" class="pn">${f.n}</text>`));
      }),
      u.push(
        `<line x1="30" x2="${d - 12}" y1="${h(79)}" y2="${h(79)}" stroke="#ff2400" stroke-width="1.3" stroke-dasharray="5 4"/>`,
      ),
      u.push(`<text x="34" y="14" class="ct ${t === "before" ? "" : t === "varA" ? "bad" : "good"}">${e}</text>`),
      `<svg viewBox="0 0 ${d} 214" class="mini" role="img" aria-label="${n.title}: ${e}">${u.join("")}</svg>`
    );
  }
  function Ly(n) {
    return Re.map((t) => {
      let e = us(t, "before"),
        i = us(t, n),
        s = t.posts
          .filter((l) => !Pe(l.id, "before") && !l.offline)
          .reduce((l, c) => (krWorst(c.id, "before") > krWorst(l.id, "before") ? c : l)),
        r = t.posts.filter((l) => !Pe(l.id, n) && !l.offline).reduce((l, c) => (krWorst(c.id, n) > krWorst(l.id, n) ? c : l)),
        off = t.posts.filter((l) => l.offline),
        o = e.sum === i.sum && e.n === i.n && e.max === i.max,
        a = (l, c, h, d) =>
          `<tr><td>${l}</td><td class="n"><span class="v">${c}</span></td><td class="n ${d === !0 ? "chg" : d === !1 ? "bad" : ""}"><span class="v">${h}</span></td></tr>`;
      return `<div class="bc"><h3 style="color:${t.color}">${t.title} <span>\xB7 ${t.sub}</span>${o ? ' <em class="tag" style="--c:#64748b">без изменений</em>' : ""}</h3>
      <div class="bc-two">${af(t, "before", "ДО")}${af(t, n, n === "varA" ? "ВАРИАНТ: в 31-11" : "ПОСЛЕ: в бригаду 51")}</div>
      <table class="bc-t"><thead><tr><th></th><th>ДО</th><th>${n === "varA" ? "В 31-11" : "ПОСЛЕ"}</th></tr></thead><tbody>
      ${a("Постов на линии (людей в смену)", e.n + (e.off ? " + подсборка" : ""), i.n + (i.off ? " + подсборка" : ""), i.n < e.n ? !0 : null)}
      ${a("Сумма работы, смин", ue(e.sum), ue(i.sum), i.sum < e.sum ? !0 : (i.sum > e.sum, null))}
      ${a("Средняя загрузка поста", of(e.eff), of(i.eff), i.eff > e.eff + 0.005 ? !0 : null)}
      ${a("Самый загруженный", `${s.id}: ${ue(krWorst(s.id, "before"))} смин`, `${r.id}: ${ue(krWorst(r.id, n))} смин`, krWorst(r.id, n) > 79 && krWorst(r.id, n) > krWorst(s.id, "before") ? !1 : null)}
      ${a("Постов выше такта", e.over, i.over, i.over > e.over ? !1 : i.over < e.over ? !0 : null)}
      ${a("Свободно до такта, смин", ue(e.free) + (Math.abs(e.n * KR_TAKT - e.sum - e.free) > 0.5 ? ` (чистый запас ${ue(e.n * KR_TAKT - e.sum)})` : ""), ue(i.free) + (Math.abs(i.n * KR_TAKT - i.sum - i.free) > 0.5 ? ` (чистый запас ${ue(i.n * KR_TAKT - i.sum)})` : ""), null)}
      </tbody></table>${off.map((l) => `<p class="hint">Подсборка ${l.id} — вне линии: ${ue(fe(l.id, "before"))} смин на одну крышку${KRX.src === "el" ? " (на диаграмме 60,5 — вероятно, 2 оператора; уточнить)" : ""}. В суммы и среднюю загрузку не входит.</p>`).join("")}${KRX.model === "mix" ? '<p class="hint">Микс: сумма и средняя — взвешенные по доле моделей; «выше такта» и «самый загруженный» — по худшей модели.</p>' : ""}</div>`;
    }).join("");
  }
  function Dy(n) {
    let t =
        "<thead><tr><th>#</th><th>Операция поста 41-1(а)</th><th>Тип</th><th>смин</th><th>ДО</th><th>Вариант: в 31-11</th><th>ПОСЛЕ: в 51</th></tr></thead>",
      e = (r, o) => {
        let a = zi[r].dest[o];
        return a
          ? `<span class="tag" style="--c:${o === "varA" && a !== Zt ? "#ef4444" : zi[r].color}">${a}</span>`
          : '<span class="tag gone">не нужно</span>';
      },
      i = cr[Zt].map(
        ([r, o, a, l], c) =>
          `<tr class="${zi[l].dest[n] ? "" : "gone"}"><td class="p">${c + 1}</td><td>${r}</td><td><i class="kd" style="background:${fi[a]}"></i>${a}</td><td class="n"><span class="bar" style="width:${(o / 10) * 100}%"></span><span class="v">${o}</span></td><td>${e(l, "before")}</td><td class="${n === "varA" ? "cur" : ""}">${e(l, "varA")}</td><td class="${n === "after" ? "cur" : ""}">${e(l, "after")}</td></tr>`,
      ).join(""),
      s = (r) => {
        let o = {};
        for (let a of nn) {
          let l = a.dest[r] || "не нужно";
          o[l] = (o[l] || 0) + a.v;
        }
        return Object.entries(o)
          .map(([a, l]) => `${a}: ${l} смин`)
          .join(" \xB7 ");
      };
    return `${t}<tbody>${i}</tbody><tfoot><tr><td></td><td>Итого</td><td></td><td class="n"><span class="v">${cr[Zt].reduce((a, o) => a + o[1], 0)}</span></td><td>${s("before")}</td><td>${s("varA")}</td><td>${s("after")}</td></tr></tfoot>`;
  }
  function Uy(n) {
    let t = [Zt, "31-11", "51-9", "51-11"],
      e = (o, a) => {
        if (Pe(o, a)) return `<td class="n chg ${a === n ? "cur" : ""}"><span class="v">убран</span></td>`;
        let l = fe(o, a),
          c = l - fe(o, "before");
        return `<td class="n ${l > 79 ? "bad" : c ? "chg" : ""} ${a === n ? "cur" : ""}"><span class="bar" style="width:${Math.min(100, (l / 130) * 100)}%"></span><span class="v">${ue(l)}</span>${c && l <= 79 ? `<small>+${ue(c)}</small>` : ""}</td>`;
      },
      i = {
        [Zt]: krTpl("Вся работа — на головке; {{extra}} смин из {{p41a}} лишние — развороты двигателя, определение типа, кнопка"),
        "31-11": krTpl(
          "По нормам свободно 9 смин (21179). Видео (21129): пара 31-11/11(а) — не меньше 137 смин при норме 84, следующий ДВС ждёт",
        ),
        "51-9": "Уже наносит герметик кистью в отверстия ГБЦ — тот же материал и навык",
        "51-11": "Последний пост ГБЦ, контроль: диск сразу проверяет контролёр",
      },
      s = (o) => Re.map((a) => us(a, o)),
      r = (o, a, l) =>
        `<tr class="sum"><td></td><td>${o}</td>${Bh.map((c) => `<td class="n ${l ? l(c) : ""}"><span class="v">${a(c)}</span></td>`).join("")}<td></td></tr>`;
    return (
      `<thead><tr><th>Пост</th><th>Что делает</th><th>ДО, смин</th><th>В 31-11, смин</th><th>ПОСЛЕ, смин</th><th>Почему</th></tr></thead><tbody>${t.map((o) => `<tr class="${o === Zt && n !== "before" ? "gone" : ""}"><td class="p">${o}</td><td>${Ce[o].name}</td>${Bh.map((a) => e(o, a)).join("")}<td class="how">${i[o]}</td></tr>`).join("")}</tbody><tfoot>` +
      r(
        "Постов выше такта в 51 + 31 + 41",
        (o) => s(o).reduce((a, l) => a + l.over, 0),
        (o) => (o === "varA" ? "bad" : ""),
      ) +
      r("Линейных постов", (o) => s(o).reduce((a, l) => a + l.n, 0)) +
      r("Трудоёмкость ДВС (линейные посты), смин", (o) => ue(s(o).reduce((a, l) => a + l.sum, 0))) +
      "</tfoot>"
    );
  }
  function Ny() {
    return `<div class="cb">${Bh.map((t) => {
      let e = nn
        .map((i) => {
          let s = i.dest[t],
            r = t === "varA" && s;
          return `<div class="cb-s ${s ? "" : "gone"}" style="flex:${i.v};--c:${i.color}"><b>${i.short} \xB7 ${i.v} смин</b><span class="${r ? "bad" : s && t === "after" ? "good" : ""}">${t === "before" ? "пост 41-1(а)" : s ? "→ " + s : "✕ не нужно"}</span></div>`;
        })
        .join("");
      return `<div class="cb-row"><div class="cb-l">${ki[t].label}</div><div class="cb-bar">${e}</div></div>`;
    }).join(
      "",
    )}<p class="hint">${krTpl("Вся работа поста 41-1(а) — {{p41a}} смин (36 с) на один двигатель: 19 + 28 + {{extra}} лишних.")} Цветом — куски этой работы, справа от стрелки — куда они уходят.</p></div>`;
  }
  function Oy() {
    return `<thead><tr><th>#</th><th>Статья затрат</th><th>мин, тыс. ₽</th><th>макс, тыс. ₽</th><th>Зачем</th></tr></thead><tbody>${Ph.map((t, e) => `<tr class="${t.opt && !pe.opt ? "off" : ""}"><td class="p">${e + 1}</td><td>${Gi(t.t)}${t.opt ? ` <label class="optl"><input type="checkbox" id="optchk" ${pe.opt ? "checked" : ""}> включить</label>` : ""}</td><td class="n"><span class="v">${t.lo}</span></td><td class="n"><span class="v">${t.hi}</span></td><td class="how">${Gi(t.why)}</td></tr>`).join("")}</tbody><tfoot><tr><td></td><td>Итого разово</td><td class="n"><span class="v">${gs(gr("lo") / 1e3)}</span></td><td class="n"><span class="v">${gs(gr("hi") / 1e3)}</span></td><td class="how">Оценки команды по рыночным ценам; уточнить у куратора и технологов</td></tr></tfoot>`;
  }
  function Fy() {
    let n = qr(pe),
      t = Ah(pe),
      V = krVals(),
      e = Ch(pe),
      i = ur(pe),
      s = gr(),
      r = s / i,
      o = Object.keys(Ce).length * n,
      a = (Object.keys(Ce).length - 1) * n,
      l = (_, b, B = "") => `<div><b class="${B}">${_}</b><span>${b}</span></div>`;
    ((re("#in-shiftsout").innerHTML =
      pe.perShift < pe.orders
        ? `Выпуск <b>${pe.perShift}</b> из плана <b>${pe.orders}</b> в смену — не хватает <b>${pe.orders - pe.perShift} шт.</b> (${Math.round((1 - pe.perShift / pe.orders) * 100)} %). Добирают допсменами и сверхурочными или фактический заказ ниже — <b>вопрос куратору</b>. Ставки поста считаем по сменам: <b>${Da(n)}</b>.`
        : `Выпуска хватает на план. Ставки поста считаем по сменам: <b>${Da(n)}</b>.`),
      (re("#eco-kpi").innerHTML = [
        l(`${di(i)}`, `ФОТ с взносами поста 41-1(а) в месяц (допущение): ${n} ст. \xD7 ${di(Rh(pe))}`),
        l(gs(s / 1e3), `Разовые затраты (${pe.scen === "lo" ? "мин" : "макс"}${pe.opt ? " + дозатор" : ""})`),
        l(`${ue(r)} мес`, "Окупаемость (если вакансии не замещаются)", "good"),
        l(`+${di(i)}`, "Освобождённый ФОТ в месяц (если вакансии не замещаются)", "good"),
        l(Fh(e - s), "Эффект за 1-й год (за вычетом затрат)", "good"),
        l(Fh(e * 3 - s), "Эффект за 3 года", "good"),
        l(`−${ue(i / (Math.min(pe.orders, pe.perShift) * n * (pe.days / 12)))} ₽`, "ФОТ поста на один двигатель", "good"),
        l("0", "Дополнительных машин: под заказ выпуск не меняется"),
      ].join("")),
      (re("#res-nums").innerHTML =
        `<div><b>1 пост</b>41-1(а) освобождается</div><div><b>${n} ${n === 1 ? "ставка" : "ставки"}</b>1 оператор \xD7 ${Da(n)}: перевод, не сокращение</div><div><b>${di(i)}</b>ФОТ в месяц, если вакансии не замещаются</div><div><b>${V.payback} мес</b>окупаемость при затратах ${V.capexM} (допущение)</div>`));
    let c = 24,
      h = 640,
      d = 230,
      u = 64,
      f = 16,
      g = 30,
      x = 16,
      p = [
        ["lo", gr("lo", pe.opt), "#86efac"],
        ["hi", gr("hi", pe.opt), "#22c55e"],
      ],
      m = i * c - p[0][1],
      E = -p[1][1] * 1.15,
      v = (_) => u + (_ / c) * (h - u - x),
      S = (_) => f + ((m - _) / (m - E)) * (d - f - g),
      I = [];
    for (let _ = Math.ceil(E / 1e6) * 1e6; _ <= m; _ += 1e6)
      I.push(
        `<line x1="${u}" x2="${h - x}" y1="${S(_)}" y2="${S(_)}" stroke="${_ === 0 ? "#64748b" : "#1f2733"}"/><text x="${u - 8}" y="${S(_) + 4}" text-anchor="end" class="ax">${_ / 1e6} млн</text>`,
      );
    for (let _ = 0; _ < c; _ += 3)
      I.push(`<text x="${v(_)}" y="${d - 10}" text-anchor="middle" class="ax">${_}</text>`);
    I.push(`<text x="${h - x}" y="${d - 10}" text-anchor="end" class="ax">мес</text>`);
    for (let [_, b, B] of p) {
      I.push(
        `<polyline fill="none" stroke="${B}" stroke-width="${_ === pe.scen ? 2.4 : 1.2}" ${_ === pe.scen ? "" : 'stroke-dasharray="5 4"'} points="${Array.from({ length: c + 1 }, (V, K) => `${v(K)},${S(-b + i * K)}`).join(" ")}"/>`,
      );
      let O = b / i;
      I.push(
        `<circle cx="${v(O)}" cy="${S(0)}" r="4" fill="${B}"/><text x="${v(O) + (_ === "lo" ? -6 : 6)}" y="${S(0) + (_ === "lo" ? -9 : 17)}" text-anchor="${_ === "lo" ? "end" : "start"}" class="vl">${ue(O)} мес</text>`,
      );
    }
    (I.push(
      `<text x="${u + 4}" y="${S(-p[1][1]) + 16}" class="ax">старт: −${gs(p[1][1] / 1e3)} (макс) / −${gs(p[0][1] / 1e3)} (мин)</text>`,
    ),
      (re("#payback").innerHTML = I.join("")),
      re("#payback").setAttribute("viewBox", `0 0 ${h} ${d}`));
    let R = (_) => Re.map((b) => us(b, _)),
      A = (_) => R(_).reduce((b, B) => b + B.over, 0),
      N = (_) => ue(R(_).reduce((b, B) => b + B.sum, 0)),
      W = (_, b, B, O, V = "", K = "good") =>
        `<tr><td>${_}</td><td class="n"><span class="v">${b}</span></td><td class="n ${V}"><span class="v">${B}</span></td><td class="n ${K}"><span class="v">${O}</span></td></tr>`;
    re("#t-var").innerHTML =
      `<thead><tr><th></th><th>ДО</th><th>Вариант: в 31-11</th><th>ПОСЛЕ: в бригаду 51</th></tr></thead><tbody>
    ${W("Постов в 51 + 31 + 41 (с подсборкой 31-12)", o / n, o / n - 1, a / n)}
    ${W(`Операторов (${Da(n)})`, o, o + " (на 31-11 нужен 2-й)", a, "bad")}
    ${W("Постов выше такта", A("before"), A("varA") + ` (31-11: ${V.p3111v} смин)`, A("after"), "bad", "")}
    ${W("Трудоёмкость ДВС, смин", N("before"), N("varA"), N("after"), "", "good")}
    ${W("Разовые затраты", "—", "≈ те же переносы оснастки", gs(s / 1e3), "", "")}
    ${W("Потери в месяц", di(i), di(i) + " (2-й человек на 31-11)", "0 ₽", "bad")}
    ${W("Экономия в год", "—", "0 ₽", Fh(e), "bad")}
    ${W("Окупаемость", "—", "не окупается", V.payback + " мес", "bad")}
    ${W("Если 2-го человека не ставить", "—", `31-11 станет ${V.p3111v} смин: тот же заказ — на ${Math.round((V.p3111v / KR_TAKT - 1) * 100)} % дольше, сверхурочные всей линии`, "не нужно", "bad", "")}
    ${W("Главный риск", "—", "Линия встаёт на 31-11 или нужен человек", "Фиксатор распредвала, признак модели", "bad", "")}
  </tbody>`;
  }
  function By(n) {
    let t = n.mode,
      e = n.sel,
      i = Ce[e],
      s = fe(e, t),
      r = Ia[e],
      o = hs(i);
    (document
      .querySelectorAll(".side .tabs button")
      .forEach((u) => u.setAttribute("aria-pressed", u.dataset.tab === e)),
      (re("#postsel").value = e));
    let a =
      (() => {
        let p = KRD.posts[e],
          el = krLoad(e, "before", "21179", "el", 0),
          sm = krLoad(e, "before", "21179", "sum", 0),
          z = p.summary.oe + p.summary.md + p.summary.vo,
          sn = p.brig === "31" ? "на диаграмме организаторов" : "в сводке Excel";
        e === Zt && (sm = z);
        let d = Math.abs(el - sm) >= 0.5,
          d29 = p.norm["21129"] !== p.norm["21179"];
        return d || d29
          ? `<p class="hint">По элементам (нормы): <b>${ue(el)}</b> смин для 21179${d29 ? `, <b>${ue(p.norm["21129"])}</b> для 21129` : ""}${d ? `; ${sn} — <b>${ue(sm)}</b> смин` : ""}. Графики сейчас — ${KRX.src === "el" ? "по элементам" : "по сводке/диаграмме"}${d ? "; расхождение — в разделе «Сверка данных»" : ""}. <span class="tg tz">данные завода</span></p>`
          : "";
      })();
    re("#now").innerHTML =
      `<b><i class="kd" style="background:${i.brig.color}"></i>${e} \xB7 ${Gi(i.name)}</b><p>${Gi(ds[e])}</p>` +
      (Pe(e, t)
        ? `<p class="good">${ki[t].long}</p>`
        : `<p class="${s > 79 ? "bad" : "good"}">${ue(s)} смин \xB7 ${Math.round((s / 79) * 100)} % такта ${79} смин</p>`) +
      a;
    let l = _r(e, t);
    re("#adds").innerHTML =
      "<h4>Что добавляется на этом посту</h4>" +
      (l.length
        ? `<ul>${l.map((u) => `<li data-part="${u.id}" data-post="${u.post}" tabindex="0"><b>${Gi(u.name)}</b><span>${Gi(u.desc)}</span></li>`).join("")}</ul>`
        : `<p class="hint">${Pe(e, t) ? "Пост убран: диск и заглушки ставятся раньше, в бригаде 51." : e === "31-12" ? "На двигатель ничего не ставит: готовит защитные крышки для поста 31-2." : "—"}</p>`);
    let c = Zr(e, t),
      h = c.filter((u) => u.active),
      d = h.reduce((u, f) => u + f.s, 0);
    ((re("#steps").innerHTML = c
      .map(
        (u, f) =>
          `<li data-i="${f}" class="${u.cls || ""}"><button><span class="st-n">${f + 1}</span><span class="st-t"><i class="kd" style="background:${fi[u.k] || fi["?"]}"></i>${Gi(u.t)}${u.tag ? ` <span class="tag ${u.cls === "gone" ? "gone" : ""}" style="--c:${u.cls === "add-bad" ? "#ef4444" : u.ch ? zi[u.ch].color : "#64748b"}">${u.tag}</span>` : ""}</span><span class="st-s">${ue(u.s)} смин</span></button><span class="st-p"></span></li>`,
      )
      .join("")),
      (re("#steps-total").innerHTML = Pe(e, t)
        ? `<span class="good">Пост убран.</span> ${krTpl(t === "after" ? "Было {{p41a}} смин работы: 47 смин переехали в 51-9 и 51-11, {{extra}} смин лишних действий исчезли ({{extra2}} — если в 51 модель определяют вручную, +2 смин на 51-9 и 51-11)." : "Было {{p41a}} смин работы: 55 смин переехали в 31-11, 5 смин исчезли.")}`
        : e === Zt && KRX.model === "21129"
          ? `<span class="bad">Для 21129 операции нет</span> — пост простаивает весь цикл, а оператор занят на смене.`
          : `Операций ${h.length}, по хронометражу ${ue(d)} смин \xB7 ${s > 79 ? `<span class="bad">превышение такта ${ue(s - 79)} смин</span>` : `<span class="good">запас ${ue(79 - s)} смин</span>`}`));
  }
  function zh(n, t) {
    ((Yn = n), ($n = t));
    let e = [
      ["ОЭ — основная работа", fi.ОЭ],
      ["МД — взять/положить, развернуть", fi.МД],
      ["ВО — вспомогательное", fi.ВО],
      [`Такт ${79} смин`, "#ff2400"],
      ["Новое на посту (подсветка)", "#ffb347"],
      ...nn.map((r) => [r.label + ` \xB7 ${r.v} смин`, r.color, r.id]),
    ];
    ((re("#legend").innerHTML = e
      .map(
        ([r, o, a]) =>
          `<button class="lg" ${a ? `data-chunk="${a}"` : ""} style="color:${o}"><i style="background:${o}"></i><span style="color:var(--text)">${r}</span></button>`,
      )
      .join("")),
      re("#legend").addEventListener("click", (r) => {
        let o = r.target.closest("[data-chunk]");
        o && $n.focus(zi[o.dataset.chunk].dest[Yn.mode] || Zt);
      }),
      document
        .querySelectorAll(".side .tabs button")
        .forEach((r) => r.addEventListener("click", () => $n.setSel(r.dataset.tab))),
      (re("#postsel").innerHTML = Re.map(
        (r) =>
          `<optgroup label="${r.title} \xB7 ${r.sub}">${r.posts.map((o) => `<option value="${o.id}">${o.id} — ${Gi(o.name)}</option>`).join("")}</optgroup>`,
      ).join("")),
      re("#postsel").addEventListener("change", (r) => $n.setSel(r.target.value)));
    let i = re("#adds");
    (i.addEventListener("mouseover", (r) => {
      let o = r.target.closest("li[data-part]");
      o && $n.highlight(o.dataset.part, o.dataset.post);
    }),
      i.addEventListener("mouseleave", () => $n.unhighlight()),
      i.addEventListener("click", (r) => {
        let o = r.target.closest("li[data-part]");
        o && ($n.zoom(o.dataset.post), $n.highlight(o.dataset.part, o.dataset.post));
      }),
      re("#steps").addEventListener("click", (r) => {
        let o = r.target.closest("li");
        if (!o) return;
        let a = +o.dataset.i,
          l = Zr(Yn.sel, Yn.mode);
        if (!l[a].active) {
          l[a].post && $n.setSel(l[a].post);
          return;
        }
        let c = 0;
        for (let h = 0; h < a; h++) l[h].active && (c += l[h].s);
        ((Yn.playT = c + 0.01), Wi(Yn, !0), $n.mark());
      }),
      document.querySelectorAll("button[data-cmp]").forEach((r) =>
        r.addEventListener("click", () => {
          ((Yn.cmp = r.dataset.cmp), Wi(Yn));
        }),
      ));
    let s = (r, o, a = !0) => {
      let l = re(r);
      ((l.value = pe[o]),
        l.addEventListener("input", () => {
          let c = a ? +l.value : l.value;
          (a && !(c > 0)) || ((pe[o] = c), La());
        }));
    };
    (s("#in-salary", "salary"),
      s("#in-social", "social"),
      s("#in-pershift", "perShift"),
      s("#in-days", "days"),
      s("#in-orders", "orders"),
      s("#in-shifts", "shifts"),
      document.querySelectorAll('input[name="scen"]').forEach((r) => {
        ((r.checked = r.value === pe.scen),
          r.addEventListener("change", () => {
            ((pe.scen = r.value), La());
          }));
      }),
      re("#t-capex").addEventListener("change", (r) => {
        r.target.id === "optchk" && ((pe.opt = r.target.checked), La());
      }),
      (re("#chunkbar").innerHTML = Ny()),
      krInitUi((p) => $n.setData && $n.setData(p)),
      (re("#t-matrix").innerHTML = krMatrix()),
      La());
    let ck = krCheck(),
      bd = document.createElement("div");
    ((bd.id = "datacheck"),
      (bd.className = ck.ok === ck.n ? "good" : "bad"),
      (bd.textContent = `Проверка данных: ${ck.ok}/${ck.n} ${ck.ok === ck.n ? "ОК" : "ошибка"}`),
      (bd.title =
        "Сумма элементов каждого поста = итогу в нормах = показанному значению (21179 и 21129); разбивка ОЭ/МД/ВО — для исправленных постов.\n" +
        ck.rows.filter((r) => !r.ok).map((r) => r.id).join(", ")),
      document.body.appendChild(bd));
    (console.info(`[krause] Проверка данных: ${ck.ok}/${ck.n} ${ck.ok === ck.n ? "ОК" : "ошибка"}`),
      ck.ok !== ck.n && console.table(ck.rows.filter((r) => !r.ok)));
  }
  function La() {
    ((re("#t-capex").innerHTML = Oy()), Fy(), (re("#kpi").innerHTML = lf(Yn.mode)));
    let V = krVals();
    document.querySelectorAll("[data-v]").forEach((e) => {
      let v = V[e.dataset.v];
      v != null && (e.textContent = v);
    });
  }
  // переключатели «Источник / Модель / Распознавание» (их несколько копий на странице)
  function krSyncUi() {
    document.querySelectorAll("[data-src]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.src === KRX.src));
    document.querySelectorAll("[data-model]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.model === KRX.model));
    document.querySelectorAll("[data-recog]").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.recog === KRX.recog));
    document.querySelectorAll(".mixl").forEach((l) => {
      ((l.hidden = KRX.model !== "mix"), (l.querySelector("input").value = Math.round(KRX.mix * 100)));
      l.querySelector("output").textContent = Math.round(KRX.mix * 100) + " %";
    });
    let src = KRX.src === "el" ? "по элементам (сумма пооперационных норм)" : "по сводке Excel (51, 41) и диаграмме организаторов (31)",
      alt = KRX.src === "el" ? "значение сводки/диаграммы" : "значение по элементам",
      m =
        KRX.model === "mix"
          ? `микс: доля 21129 — ${Math.round(KRX.mix * 100)} % <span class="tg ta">допущение команды</span>; средние — взвешенные, проверка такта — по худшей модели`
          : KRX.model === "21129"
            ? "21129: операции 41-1(а) нет — пост простаивает весь цикл, переносить нечего"
            : "21179 (= 21172, 21122): операция 41-1(а) на каждом двигателе";
    document.querySelectorAll(".datanote").forEach(
      (p) =>
        (p.innerHTML = `Столбики, 3D-колонны и подписи — <b>${src}</b>; пунктирный контур — ${alt}, если отличается. Модель — ${m}.${KRX.src === "sum" ? " Сводка не делит время по моделям." : ""}`),
    );
  }
  function krInitUi(set) {
    document.addEventListener("click", (e) => {
      let b = e.target.closest("[data-src],[data-model],[data-recog]");
      if (!b) return;
      b.dataset.src
        ? set({ src: b.dataset.src })
        : b.dataset.model
          ? set({ model: b.dataset.model })
          : set({ recog: +b.dataset.recog });
    });
    document.addEventListener("input", (e) => {
      e.target.matches(".mixr") && set({ mix: +e.target.value / 100 });
    });
  }
  // матрица допустимости переноса «операция × пост бригады 51» (21179, элементы, без +2)
  function krMatrix() {
    let ids = KRD.brigades[0].posts,
      L = (id) => krLoad(id, "before", "21179", "el", 0),
      ops = KRD.chunks.filter((c) => c.dest.after),
      cell = (c, id) => {
        let i = ids.indexOf(id),
          v = L(id) + c.v;
        return c.needsAfter && i <= ids.indexOf(c.needsAfter)
          ? `<td class="na" title="${c.why}">нельзя</td>`
          : `<td class="${v <= KR_TAKT ? "ok" : "no"}">${L(id)} → ${v}</td>`;
      },
      vr = KRD.variants.map((x) => {
        let ld = (id) => L(id) + KRD.chunks.filter((c) => x.place[c.id] === id).reduce((a, c) => a + c.v, 0),
          ps = [...new Set(Object.values(x.place))];
        return `<tr><td>${x.label}</td>${ids.map((id) => (ps.includes(id) ? `<td class="${ld(id) <= KR_TAKT ? "ok" : "no"}">${ld(id)}</td>` : "<td></td>")).join("")}</tr>`;
      }).join("");
    return `<thead><tr><th>Операция</th>${ids.map((id) => `<th>${id}</th>`).join("")}</tr></thead><tbody>${ops
      .map((c) => `<tr><td>${c.label}, ${c.v} смин${c.needsAfter ? ` <span class="hint">(после ${c.needsAfter})</span>` : ""}</td>${ids.map((id) => cell(c, id)).join("")}</tr>`)
      .join("")}<tr><td colspan="${ids.length + 1}" class="hint">Варианты размещения — нагрузка постов после переноса, смин:</td></tr>${vr}</tbody>`;
  }
  function krCalc() {
    return { load: krLoad, worst: krWorst, alt: krAlt, vals: krVals, tpl: krTpl, opV: krOpV, cat: krElCat, brig: us, check: krCheck };
  }
  // автопроверка: сумма элементов = итог в нормах = показанное значение (обе модели) + разбивки ОЭ/МД/ВО
  function krCheck() {
    let rows = [],
      ok = 0;
    for (let [id, p] of Object.entries(KRD.posts)) {
      let r = { id };
      for (let m of ["21179", "21129"]) {
        let sum = p.ops.reduce((a, o) => a + krOpV(o, m), 0),
          shown = krLoad(id, "before", m, "el", 0);
        ((r[m] = sum), (r["ok" + m] = sum === p.norm[m] && shown === sum));
      }
      if (p.normCat) {
        let c = krElCat(id, "21179");
        r.okCat = c.oe === p.normCat.oe && c.md === p.normCat.md && c.vo === p.normCat.vo;
      } else r.okCat = !0;
      ((r.ok = r.ok21179 && r.ok21129 && r.okCat), r.ok && ok++, rows.push(r));
    }
    return { ok, n: rows.length, rows };
  }
  function Wi(n, t = !1) {
    Yn = n;
    let e = n.mode,
      i = n.sel,
      s = Zr(i, e),
      r = s.filter((u) => u.active),
      o = r.reduce((u, f) => u + f.s, 0),
      a = re("#time");
    ((a.max = o), (a.disabled = !o), (n.playT = Math.min(n.playT, o)), (a.value = n.playT));
    let l = 0,
      c = -1;
    (s.forEach((u, f) => {
      u.active && (n.playT > l && n.playT <= l + u.s + 1e-6 && (c = f), (l += u.s));
    }),
      n.playT > 0 && c < 0 && (c = s.findLastIndex((u) => u.active)));
    let h = c >= 0 ? s[c] : null;
    if (
      ((n.current = h ? { post: h.post, chunk: h.ch } : null),
      (re("#clock").textContent = o
        ? `${ue(n.playT)} смин из ${ue(o)} смин \xB7 такт ${79} смин`
        : "пост убран — цикла нет"),
      !t)
    ) {
      (By(n), (re("#kpi").innerHTML = lf(e)));
      let u = Py(e),
        f = re("#yama");
      (f.setAttribute("viewBox", `0 0 ${u.width} ${u.height}`),
        f.setAttribute("width", u.width),
        f.setAttribute("height", u.height),
        (f.innerHTML = u.html),
        document
          .querySelectorAll("button[data-cmp]")
          .forEach((g) => g.setAttribute("aria-pressed", g.dataset.cmp === n.cmp)),
        (re("#brig-charts").innerHTML = Ly(n.cmp)),
        (re("#t-ops").innerHTML = Dy(e)),
        (re("#t-posts").innerHTML = Uy(e)),
        (re("#cycle-note").textContent =
          e === "varA"
            ? krTpl("Вариант \xABв 31-11\xBB: {{p3111}} смин своей работы + 55 смин с поста 41-1(а) = {{p3111v}} смин ({{pc3111v}} такта). Пост не успевает в такт — линия встанет или понадобится второй человек, и экономии не будет.")
            : e === "after"
              ? "После: головка приходит на 31-1 уже с диском и заглушками. Двигатель не надо разворачивать — к головке на спутнике легко подойти с любой стороны."
              : "Сейчас: на 41-1(а) двигатель дважды разворачивают, чтобы поставить диск и заглушки на головку, которую собрали ещё в бригаде 51."));
    }
    let d = 0;
    if (
      (document.querySelectorAll("#steps li").forEach((u, f) => {
        let g = s[f];
        g &&
          (u.classList.toggle("on", f === c),
          (u.querySelector(".st-p").style.width =
            `${(g.active ? Math.max(0, Math.min(1, (n.playT - d) / g.s)) : 0) * 100}%`),
          g.active && (d += g.s));
      }),
      c >= 0 && n.playing)
    ) {
      let u = document.querySelector(`#steps li[data-i="${c}"]`),
        f = re("#steps");
      u &&
        (u.offsetTop < f.scrollTop || u.offsetTop + u.offsetHeight > f.scrollTop + f.clientHeight) &&
        (f.scrollTop = u.offsetTop - f.clientHeight / 2);
    }
  }
  var re,
    ue,
    of,
    di,
    Fh,
    Da,
    gs,
    Gi,
    fi,
    Bh,
    $n,
    Yn,
    pe,
    Iy,
    kh = vi(() => {
      Ca();
      Pa();
      rf();
      ((re = (n) => document.querySelector(n)),
        (ue = (n) => (Math.round(n * 10) / 10).toString().replace(".", ",")),
        (of = (n) => `${Math.round(n * 100)} %`),
        (di = (n) => Math.round(n).toLocaleString("ru-RU") + " ₽"),
        (Fh = (n) => (n / 1e6).toFixed(2).replace(".", ",") + " млн ₽"),
        (Da = (n) => `${n} ${n === 1 ? "смена" : "смены"}`),
        (gs = (n) => Math.round(n).toLocaleString("ru-RU") + " тыс. ₽"),
        (Gi = (n) =>
          String(n).replace(/[&<>"]/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[t])),
        (fi = { ОЭ: "#22a35a", МД: "#d8b10f", ВО: "#dc2f2f", "?": "#64748b" }),
        (Bh = ["before", "varA", "after"]),
        (pe = { ...fs, scen: "hi", opt: !1 }));
      Iy = () =>
        `<defs>${["r", ...nn.map((n) => n.id)].map((n) => `<marker id="ah-${n}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 8 4 0 8z" fill="${n === "r" ? "#ef4444" : zi[n].color}"/></marker>`).join("")}</defs>`;
    });
  function ff(n, t) {
    let e = Bn("#insp-view"),
      i = Bn("#insp-tip"),
      s = Bn("#i-step");
    ((s.max = qn.length - 1),
      (Bn("#i-strip").innerHTML = [
        ["51", "Бригада 51 \xB7 ГБЦ", Nn],
        ["21", "Бригада 21", ["21"]],
        ["31", "Бригада 31", Mn.filter((P) => P.startsWith("31"))],
        ["41", "Бригада 41", Mn.filter((P) => P.startsWith("41"))],
      ]
        .map(([P, $, H]) => {
          let st = Re.find((it) => it.id === P)?.color || "#94a3b8";
          return `<div class="is-g"><span style="color:${st}">${$}</span>${H.map((it) => `<button class="chip" data-step="${qn.indexOf(it)}" style="--c:${st}">${it === "21" ? "блок" : it.slice(3)}</button>`).join("")}</div>`;
        })
        .join("")));
    let r;
    try {
      r = new Qs({ antialias: !0 });
    } catch {
      return (
        e.insertAdjacentHTML("beforeend", '<p style="padding:16px">WebGL недоступен.</p>'),
        { update() {}, show() {} }
      );
    }
    (r.setPixelRatio(Math.min(devicePixelRatio, 1.5)),
      (r.toneMapping = $r),
      (r.shadowMap.enabled = !0),
      e.prepend(r.domElement));
    let o = new tr();
    o.background = new Nt("#0e131b");
    let a = new We(30, 1, 0.02, 50),
      l = new lr(a, r.domElement);
    ((l.enableDamping = !0),
      (l.autoRotate = !df),
      (l.autoRotateSpeed = 0.9),
      (l.minDistance = 0.4),
      (l.maxDistance = 6),
      o.add(new ir("#dfe8ff", "#1b2028", 1.3)));
    let c = new Oi("#fff", 2.6);
    (c.position.set(2, 3, 2.5),
      (c.castShadow = !0),
      c.shadow.mapSize.set(1024, 1024),
      Object.assign(c.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1 }),
      o.add(c));
    let h = new Oi("#9fb6ff", 0.8);
    (h.position.set(-2, 1.5, -2), o.add(h));
    let d = new Xt(new ma(1.1, 48), new Wn({ color: "#151b24", roughness: 0.95 }));
    ((d.rotation.x = -Math.PI / 2), (d.position.y = -0.031), (d.receiveShadow = !0), o.add(d));
    let u = new Xt(
      ps(() => yt("#56606d", 0, -0.015, 0, 1, 0.03, 0.78)),
      ui.metal,
    );
    ((u.receiveShadow = !0), o.add(u));
    let f = Oh("H"),
      g = Oh("E");
    o.add(f.g, g.g);
    for (let P of [f, g])
      P.g.traverse(($) => {
        $.isMesh && (($.castShadow = !0), ($.receiveShadow = !0));
      });
    let x = null,
      p = 0;
    function m(P) {
      P !== x &&
        ((x = P),
        P === "H"
          ? (l.target.set(0, 0.12, 0), a.position.set(0.62, 0.55, 0.95))
          : (l.target.set(0, 0.4, 0), a.position.set(1.35, 1.05, 1.75)));
    }
    function E() {
      let P = qn[n.istep],
        $ = n.mode,
        H = P.startsWith("51");
      (m(H ? "H" : "E"), (f.g.visible = H), (g.g.visible = !H));
      let st = 0,
        it = 0;
      p = 0;
      let ft = H ? f : g;
      for (let nt in ft.meshes) {
        let ot = ft.meshes[nt],
          At = H ? bn(nt, $) : mr(nt, $),
          Rt = H ? hf[At] : At === "21" ? -1 : uf[At],
          $t = H ? hf[P] : P === "21" ? -1 : uf[P];
        ot.visible = Rt !== void 0 && Rt <= $t;
        let ie = ot.visible && (H ? At === P : P === "21" ? At === "21" : At === P);
        ((ot.material = (ie ? ms : ui)[Fn[nt].kind]), ot.visible && (st++, ie ? p++ : it++));
      }
      ((s.value = n.istep),
        document.querySelectorAll("#i-strip .chip").forEach((nt) => {
          let ot = qn[+nt.dataset.step];
          (nt.classList.toggle("on", +nt.dataset.step === n.istep),
            nt.classList.toggle("gone", Ce[ot] ? Pe(ot, $) : !1));
        }));
      let Gt = Ce[P],
        Kt =
          P === "21"
            ? "<b>Блок цилиндров от бригады 21</b>"
            : `<b><i class="kd" style="background:${Gt.brig.color}"></i>После поста ${P} \xB7 ${_s(Gt.name)}</b>`,
        Y =
          P === "21"
            ? "Бригада 21 собрала \xABниз\xBB: блок, коленвал, поршни, масляный насос, картер, фильтр, маховик и сцепление. Головки ещё нет — её параллельно собирает бригада 51."
            : ds[P],
        Q =
          P === "21"
            ? ["block", "pan", "oilfilter", "flywheel"].map((nt) => ({ id: nt, name: Fn[nt].name, desc: Fn[nt].desc }))
            : _r(P, $);
      ((Bn("#i-now").innerHTML = `${Kt}<p>${_s(Y)}</p>`),
        (Bn("#i-added").innerHTML =
          `<h4>${P === "21" ? "Что уже есть" : "Что добавилось на этом посту"} <span class="hint">(подсвечено оранжевым)</span></h4>` +
          (Q.length
            ? `<ul>${Q.map((nt) => `<li><b>${_s(nt.name)}</b><span>${_s(nt.desc)}</span></li>`).join("")}</ul>`
            : `<p class="hint">${Pe(P, $) ? `Пост убран в режиме \xAB${ki[$].label}\xBB — на двигатель здесь ничего не добавляется.` : "Новых деталей нет."}</p>`)),
        (Bn("#i-count").innerHTML =
          `${H ? "ГБЦ" : "Двигатель"}: было ${it} деталей → стало <b>${st}</b>${p ? ` <span class="good">(+${p})</span>` : ""} \xB7 шаг ${n.istep + 1} из ${qn.length}`),
        O());
    }
    let v = null,
      S = Bn("#i-play");
    function I() {
      (clearInterval(v), (v = null), (S.textContent = "▶ Собрать по шагам"), S.setAttribute("aria-pressed", "false"));
    }
    function R(P, $ = !0) {
      ((n.istep = Math.max(0, Math.min(qn.length - 1, P))), E());
      let H = qn[n.istep];
      $ && Ce[H] && t.setSel(H);
    }
    (Bn("#i-prev").addEventListener("click", () => {
      (I(), R(n.istep - 1));
    }),
      Bn("#i-next").addEventListener("click", () => {
        (I(), R(n.istep + 1));
      }),
      s.addEventListener("input", () => {
        (I(), R(+s.value));
      }),
      Bn("#i-strip").addEventListener("click", (P) => {
        let $ = P.target.closest(".chip");
        $ && (I(), R(+$.dataset.step));
      }),
      S.addEventListener("click", () => {
        if (v) return I();
        (n.istep >= qn.length - 1 && R(0, !1),
          (S.textContent = "❚❚ Пауза"),
          S.setAttribute("aria-pressed", "true"),
          (v = setInterval(
            () => {
              if (n.istep >= qn.length - 1) return I();
              R(n.istep + 1, !1);
            },
            df ? 2200 : 1500,
          )));
      }),
      e.addEventListener("keydown", (P) => {
        (P.key === "ArrowRight" && (I(), R(n.istep + 1), P.preventDefault()),
          P.key === "ArrowLeft" && (I(), R(n.istep - 1), P.preventDefault()));
      }));
    let A = new sr(),
      N = new dt(),
      W = null;
    (r.domElement.addEventListener("pointermove", (P) => {
      if (P.buttons) return;
      let $ = r.domElement.getBoundingClientRect();
      (N.set(((P.clientX - $.left) / $.width) * 2 - 1, (-(P.clientY - $.top) / $.height) * 2 + 1),
        A.setFromCamera(N, a));
      let H = f.g.visible ? f : g,
        st = A.intersectObjects(
          Object.values(H.meshes).filter((Kt) => Kt.visible),
          !1,
        )[0];
      if ((W && W !== st?.object && (E(), (W = null)), !st)) {
        i.hidden = !0;
        return;
      }
      let it = st.object.userData.part,
        ft = Fn[it],
        Gt = bn(it, n.mode);
      ((W = st.object),
        (W.material = ms[ft.kind]),
        (i.innerHTML = `<b>${_s(ft.name)}</b><p>${_s(ft.desc)}</p><p class="tip-now">${Gt === "21" ? "приходит от бригады 21" : `пост ${Gt} \xB7 ${_s(Ce[Gt].name)}`}</p>`),
        (i.hidden = !1),
        (i.style.transform = `translate(${Math.min(P.clientX - $.left + 14, $.width - i.offsetWidth - 6)}px, ${Math.min(P.clientY - $.top + 14, $.height - i.offsetHeight - 6)}px)`),
        O());
    }),
      r.domElement.addEventListener("pointerleave", () => {
        ((i.hidden = !0), W && ((W = null), E()));
      }),
      l.addEventListener("start", () => {
        i.hidden = !0;
      }));
    let _ = !1,
      b = !0,
      B = 0;
    function O() {
      !_ && b && ((_ = !0), requestAnimationFrame(V));
    }
    l.addEventListener("change", O);
    function V(P) {
      let $ = l.update();
      (r.render(o, a), b && (l.autoRotate || $ || P < B) ? requestAnimationFrame(V) : (_ = !1));
    }
    function K() {
      let P = e.clientWidth,
        $ = e.clientHeight;
      !P || !$ || (r.setSize(P, $, !1), (a.aspect = P / $), a.updateProjectionMatrix(), O());
    }
    return (
      new ResizeObserver(K).observe(e),
      new IntersectionObserver(
        (P) => {
          ((b = P[P.length - 1].isIntersecting), b && O());
        },
        { rootMargin: "80px 0px" },
      ).observe(e),
      K(),
      {
        update: E,
        show(P) {
          let $ = qn.indexOf(P);
          $ >= 0 && (I(), (n.istep = $), E());
        },
      }
    );
  }
  var Bn,
    _s,
    qn,
    hf,
    uf,
    df,
    pf = vi(() => {
      ar();
      wh();
      Pa();
      Ca();
      kh();
      ((Bn = (n) => document.querySelector(n)),
        (_s = (n) => String(n).replace(/[&<>]/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[t])),
        (qn = [...Nn, "21", ...Mn]),
        (hf = Object.fromEntries(Nn.map((n, t) => [n, t]))),
        (uf = Object.fromEntries(Mn.map((n, t) => [n, t]))),
        (df = matchMedia("(prefers-reduced-motion: reduce)").matches));
    });
  var pv = Xf(() => {
    ar();
    wh();
    Th();
    Ca();
    Pa();
    kh();
    pf();
    var En = (n) => document.querySelector(n),
      Sf = matchMedia("(prefers-reduced-motion: reduce)").matches,
      xs = (n) => (Math.round(n * 10) / 10).toString().replace(".", ","),
      pi = (n) => String(n).replace(/[&<>]/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[t]),
      vt = {
        mode: "before",
        sel: Zt,
        flow: !Sf,
        allLabels: !1,
        accent: !0,
        playT: 0,
        playing: !1,
        hover: null,
        cmp: "after",
        istep: 0,
      },
      Ot = 2.8,
      oe = 0,
      Ve = -10,
      Sn = 0.036,
      [Oa, yr, Jr] = Re,
      jh = 13 * Ot + 0.7 * Ot,
      It = {};
    Mn.forEach((n, t) => {
      It[n] = { x: t < 13 ? t * Ot : jh + (t - 13) * Ot, z: oe };
    });
    Nn.forEach((n, t) => {
      It[n] = { x: (t - 11) * Ot - 0.6 * Ot, z: Ve };
    });
    It["31-12"] = { x: It["31-3"].x, z: oe - 5.2, side: !0 };
    var zy = Object.fromEntries(Mn.map((n, t) => [n, t])),
      ky = Object.fromEntries(Nn.map((n, t) => [n, t])),
      Jn = It["41-11"].x,
      bs = -0.8 * Ot,
      Zn = Jn + 2.2 * Ot,
      ys = (n) => (It[n].side ? It[n].z + 1.3 : It[n].z - 1.5),
      hn = En("#viewer"),
      Fe;
    try {
      let c = document.createElement("canvas");
      if (!(c.getContext("webgl2") || c.getContext("webgl"))) throw new Error("no webgl");
      Fe = new Qs({ antialias: !0, powerPreference: "high-performance" });
    } catch (n) {
      // без WebGL: заглушка вместо 3D, остальная страница и API данных работают
      hn.insertAdjacentHTML(
        "beforeend",
        '<div class="nogl"><b>3D недоступно в этом браузере</b><p>Браузер не дал WebGL (выключено аппаратное ускорение или старая видеокарта). Все таблицы, графики и расчёты ниже работают без него. Для 3D откройте файл в Chrome, Edge или Яндекс.Браузере с включённым аппаратным ускорением.</p></div>',
      );
      let st = {
        setMode: (m) => {
          ki[m] &&
            ((vt.mode = m),
            (document.body.dataset.mode = m),
            document.querySelectorAll("button[data-mode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === m)),
            Wi(vt));
        },
        setSel: (id) => {
          Ce[id] && ((vt.sel = id), (vt.playT = 0), Wi(vt));
        },
        focus: () => {},
        mark: () => {},
        zoom: () => {},
        highlight: () => {},
        unhighlight: () => {},
        setData: (p = {}) => {
          (Object.assign(KRX, p), krApply(), Wi(vt), La(), krSyncUi());
          document.dispatchEvent(new CustomEvent("krause:data", { detail: { ...KRX } }));
        },
      };
      (document.body.classList.add("no-webgl"), zh(vt, st), Wi(vt), krSyncUi());
      document.querySelectorAll("button[data-mode]").forEach((b) => b.addEventListener("click", () => st.setMode(b.dataset.mode)));
      window.__krause = {
        noWebGL: !0,
        kd: KRD,
        kx: KRX,
        setData: st.setData,
        dataSig: () => `${KRX.src}|${KRX.model}|${KRX.mix}|${KRX.recog}`,
        calc: krCalc(),
        state: vt,
        setMode: st.setMode,
        setSel: st.setSel,
        load: fe,
        brigades: Re,
      };
      console.info("[krause] WebGL недоступен — 3D отключено, расчёты и графики работают");
      return;
    }
    Fe.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    Fe.shadowMap.enabled = !0;
    Fe.shadowMap.type = lh;
    Fe.toneMapping = $r;
    Fe.toneMappingExposure = 1.05;
    hn.prepend(Fe.domElement);
    var ye = new tr();
    ye.background = new Nt("#0c0f14");
    ye.fog = new ca("#0c0f14", 170, 320);
    var we = new We(38, 1, 0.05, 600),
      Je = new lr(we, Fe.domElement);
    Je.enableDamping = !0;
    Je.dampingFactor = 0.09;
    Je.maxPolarAngle = Math.PI * 0.49;
    Je.minDistance = 1.2;
    Je.maxDistance = 220;
    ye.add(new ir("#d6e4ff", "#1b2028", 1.1));
    var xi = new Oi("#ffffff", 2.4);
    xi.position.set(35, 70, 45);
    xi.target.position.set(20, 0, -5);
    xi.castShadow = !0;
    xi.shadow.mapSize.set(2048, 2048);
    Object.assign(xi.shadow.camera, { left: -80, right: 80, top: 45, bottom: -45, near: 10, far: 200 });
    xi.shadow.bias = -4e-4;
    xi.shadow.normalBias = 0.02;
    ye.add(xi, xi.target);
    var Ef = new Oi("#9fb6ff", 0.5);
    Ef.position.set(-40, 30, -30);
    ye.add(Ef);
    var vs = {},
      Be = (n, t, e = {}) => vs[n] || (vs[n] = new Wn({ color: t, roughness: 0.62, metalness: 0.15, ...e }));
    Be("floor", "#171c24", { roughness: 0.95, metalness: 0 });
    Be("frame", "#4a5361", { metalness: 0.55, roughness: 0.45 });
    Be("leg", "#2b323d", { metalness: 0.4 });
    Be("rail", "#7b8594", { metalness: 0.7, roughness: 0.35 });
    Be("yellow", "#d4a017", { roughness: 0.8, emissive: "#3a2a00", emissiveIntensity: 0.6 });
    Be("rack", "#3d4757", { metalness: 0.5 });
    Be("bin", "#2563eb", { roughness: 0.7 });
    Be("bin2", "#475569", { roughness: 0.8 });
    Be("plinth", "#232a35");
    Be("cable", "#111827");
    Be("tool", "#9ca3af", { metalness: 0.7, roughness: 0.3 });
    Be("tool2", "#f97316");
    Be("arrow", "#2f3a4b", { roughness: 0.9 });
    Be("wall", "#202733", { roughness: 0.9 });
    Be("screen", "#0ea5e9", { emissive: "#0369a1", emissiveIntensity: 0.9 });
    Be("panel", "#334155");
    Be("hook", "#eab308", { metalness: 0.4 });
    Be("table", "#5b6472", { metalness: 0.4 });
    Be("cover", "#1c2129", { roughness: 0.7 });
    var $e = new hi(1, 1, 1),
      Xh = new Ni(1, 1, 1, 18),
      $h = new Ni(1, 1, 1, 8),
      Hy = new Ni(1, 1, 1, 3),
      Hh = new Qt(),
      Va = new en(),
      Yh = new Ze(),
      Vy = new T(),
      Gy = new T(),
      Fa = new Map();
    function wf(n) {
      return function (e, i, s, r, o, a, l, c, h = 0, d = 0, u = 0) {
        if ((Yh.set(h, d, u), Va.setFromEuler(Yh), Hh.compose(Vy.set(s, r, o), Va, Gy.set(a, l, c)), n)) {
          let g = vs[e].clone();
          g.transparent = !0;
          let x = new Xt(i, g);
          return (x.applyMatrix4(Hh), (x.castShadow = x.receiveShadow = !0), n.add(x), x);
        }
        let f = i.clone().applyMatrix4(Hh);
        (Fa.has(e) || Fa.set(e, []), Fa.get(e).push(f));
      };
    }
    var Ee = wf(null),
      Le = (n, t, e, i, s, r, o, a, l = 0) => n(t, $e, e, i, s, r, o, a, 0, l),
      Tf = [];
    function gi(n, t, e, i, s, r, o) {
      let a = new Xt($e, new gn({ visible: !1 }));
      return (a.position.set(n, t, e), a.scale.set(i, s, r), (a.userData = o), ye.add(a), Tf.push(a), a);
    }
    {
      let n = new Xt(new Ui(420, 170), vs.floor);
      ((n.rotation.x = -Math.PI / 2), n.position.set(20, 0, -5), (n.receiveShadow = !0), ye.add(n));
      let t = new ba(420, 210, "#222a36", "#1b212b");
      (t.position.set(20, 0.003, -5), ye.add(t));
      let e = (r, o, a, l, c = 5.6) => {
        let h = new Xt(new Ui(o - r, c), new gn({ color: l, transparent: !0, opacity: 0.07, depthWrite: !1 }));
        ((h.rotation.x = -Math.PI / 2), h.position.set((r + o) / 2, 0.006, a - 0.4), ye.add(h));
      };
      (e(It["51-1"].x - Ot / 2, It["51-11"].x + Ot / 2, Ve, Oa.color),
        e(-Ot / 2, It["31-11(а)"].x + Ot / 2, oe, yr.color),
        e(It["31-12"].x - 1.6, It["31-12"].x + 1.6, It["31-12"].z + 0.4, yr.color, 3.2),
        e(jh - Ot / 2, Jn + Ot / 2, oe, Jr.color));
      let i = (r, o, a) => Le(Ee, "yellow", (r + o) / 2, 0.008, a, o - r, 0.012, 0.09);
      (i(It["51-1"].x - Ot, It["51-11"].x + Ot, Ve + 3),
        i(It["51-1"].x - Ot, It["51-11"].x + Ot, Ve - 3.3),
        i(-6 * Ot, Zn - 1, oe + 3),
        i(It["31-4"].x, Zn - 1, oe - 3.3));
      let s = (r, o) => Ee("arrow", Hy, r, 0.01, o, 0.35, 0.01, 0.35, 0, -Math.PI / 2);
      for (let r = It["51-1"].x; r < It["51-11"].x; r += 2 * Ot) s(r + Ot / 2, Ve + 2.5);
      for (let r = 0; r < Jn; r += 2 * Ot) s(r + Ot / 2, oe + 2.5);
    }
    var qh = [];
    function Qh(n, t, e, i, s = 0.9) {
      let r = e - n,
        o = i - t,
        a = Math.hypot(r, o),
        l = Math.atan2(o, r),
        c = -Math.sin(l),
        h = Math.cos(l),
        d = (n + e) / 2,
        u = (t + i) / 2;
      for (let x of [-1, 1]) Ee("frame", $e, d + (c * x * s) / 2, 0.78, u + (h * x * s) / 2, a, 0.1, 0.06, 0, -l);
      let f = Math.max(2, Math.round(a / 1.8));
      for (let x = 0; x <= f; x++) {
        let p = x / f;
        for (let m of [-1, 1])
          Ee("leg", $e, n + r * p + (c * m * s) / 2, 0.37, t + o * p + (h * m * s) / 2, 0.06, 0.74, 0.06);
      }
      let g = Math.floor(a / 0.28);
      for (let x = 0; x < g; x++) {
        let p = (x + 0.5) / g;
        (Va.setFromEuler(Yh.set(Math.PI / 2, -l, 0, "YXZ")),
          qh.push(new Qt().compose(new T(n + r * p, 0.8, t + o * p), Va.clone(), new T(0.035, s - 0.04, 0.035))));
      }
      gi(d, 0.6, u, Math.abs(r) + s, 0.4, Math.abs(o) + s, { type: "conv" });
    }
    Qh(It["51-1"].x - Ot * 0.7, Ve, bs, Ve);
    Qh(bs, Ve, bs, oe - 0.45, 0.8);
    Qh(-6 * Ot, oe, Zn - 2, oe);
    Le(Ee, "frame", (It["51-1"].x + It["51-11"].x) / 2, 3.05, Ve + 0.75, It["51-11"].x - It["51-1"].x + Ot, 0.08, 0.1);
    Le(Ee, "frame", Jn / 2, 3.05, oe + 0.75, Jn + Ot, 0.08, 0.1);
    for (let n = It["51-1"].x - Ot / 2; n <= It["51-11"].x + Ot; n += 3 * Ot)
      Le(Ee, "leg", n, 1.53, Ve + 1.35, 0.08, 3.06, 0.08);
    for (let n = -Ot / 2; n <= Jn + Ot; n += 3 * Ot) Le(Ee, "leg", n, 1.53, oe + 1.35, 0.08, 3.06, 0.08);
    {
      (Le(Ee, "wall", Zn + 3.2, 1.6, oe - 0.2, 5.2, 3.2, 5.4),
        Le(Ee, "panel", Zn + 0.55, 1.6, oe - 0.2, 0.1, 2, 1.4),
        Le(Ee, "screen", Zn + 0.49, 1.9, oe + 1.2, 0.04, 0.5, 0.7),
        Le(Ee, "leg", Zn + 0.5, 1, oe + 1.2, 0.06, 2, 0.06),
        gi(Zn + 3.2, 1.6, oe - 0.2, 5.4, 3.3, 5.6, { type: "test" }),
        Le(Ee, "hook", Jn + Ot / 2, 3.4, oe, Ot * 1.6, 0.12, 0.12),
        Ee("cable", $h, Jn, 2.9, oe, 0.015, 1, 0.015),
        Le(Ee, "hook", Jn, 2.35, oe, 0.3, 0.06, 0.06));
      let n = It["51-1"].x;
      (Le(Ee, "hook", n, 3.3, Ve + 1.1, 0.12, 0.12, 3.2),
        Ee("cable", $h, n, 2.8, Ve + 0.4, 0.012, 1, 0.012),
        Le(Ee, "hook", n, 2.3, Ve + 0.4, 0.25, 0.05, 0.05),
        gi(n, 3, Ve + 1.1, 0.5, 1.4, 3.2, { type: "crane" }),
        gi(-4 * Ot, 1.2, oe, 4 * Ot, 1, 1.4, { type: "b21" }));
    }
    var Vh = {};
    function Wy(n) {
      return (
        Vh[n] ||
        (Vh[n] = {
          body: ps(() => {
            for (let t of [-1, 1])
              (yt("#1f2a3d", t * 0.1, 0.45, 0, 0.14, 0.8, 0.16), yt("#0b0d10", t * 0.1, 0.03, -0.03, 0.15, 0.06, 0.25));
            yt(n, 0, 1.12, 0, 0.44, 0.62, 0.26);
            for (let t of [-1, 1]) yt("#e5e7eb", 0, 1, t * 0.131, 0.445, 0.035, 0.004);
            (xt("#d9a77f", 0, 1.47, 0, 0.05, 0.08, "y", 10),
              Uh("#d9a77f", 0, 1.6, 0, 0.11, 0.13, 0.11),
              Uh("#e8edf3", 0, 1.665, 0, 0.122, 0.075, 0.122),
              yt("#e8edf3", 0, 1.645, -0.12, 0.16, 0.012, 0.08),
              yt("#0f172a", 0, 1.6, -0.108, 0.17, 0.035, 0.01));
          }),
          arm: ps(() => {
            (yt(n, 0, -0.19, 0, 0.1, 0.38, 0.12), yt("#1e293b", 0, -0.44, 0, 0.085, 0.12, 0.085));
          }),
        })
      );
    }
    var Af = [],
      Ss = {};
    function mf(n, t, e, i, s, r) {
      let o = Wy(t),
        a = new tn();
      (a.position.set(e, 0, i), (a.rotation.y = s));
      let l = r ? Object.assign(ui.matte.clone(), { transparent: !0 }) : ui.matte,
        c = new Xt(o.body, l),
        h = [-1, 1].map((d) => {
          let u = new tn();
          (u.position.set(d * 0.28, 1.38, 0), (u.rotation.x = 0.7));
          let f = new Xt(o.arm, l);
          return (u.add(f), a.add(u), { piv: u, a: f });
        });
      a.add(c);
      for (let d of [c, ...h.map((u) => u.a)])
        ((d.castShadow = !0), (d.userData = { type: "op", id: n, base: l }), Af.push(d));
      return (ye.add(a), (Ss[n] = { g: a, body: c, arms: h, mat: l, seed: Math.random() * 6 }), Ss[n]);
    }
    function Xy(n, t) {
      let e = document.createElement("canvas");
      ((e.width = 256), (e.height = 112));
      let i = e.getContext("2d");
      ((i.fillStyle = "#0f141c"),
        i.fillRect(0, 0, 256, 112),
        (i.fillStyle = t),
        i.fillRect(0, 0, 14, 112),
        (i.fillStyle = "#f1f5f9"),
        (i.font = '600 50px system-ui, "DejaVu Sans", sans-serif'),
        (i.textBaseline = "middle"),
        i.fillText(n, 28, 58));
      let s = new da(e);
      return ((s.colorSpace = vn), (s.anisotropy = 4), s);
    }
    var _n = {},
      jr = new tn();
    ye.add(jr);
    for (let n of Re)
      for (let t of n.posts) {
        let { x: e, z: i, side: s } = It[t.id],
          r = t.id === Zt,
          o = r ? wf(jr) : Ee;
        if (s) {
          (mf(t.id, n.vest, e, i - 0.85, Math.PI, !1), Le(o, "table", e, 0.82, i, 1.4, 0.05, 0.7));
          for (let l of [-0.62, 0.62]) for (let c of [-0.28, 0.28]) Le(o, "leg", e + l, 0.4, i + c, 0.05, 0.8, 0.05);
          for (let l = 0; l < 6; l++) Le(o, "cover", e - 0.35, 0.86 + l * 0.03, i, 0.4, 0.022, 0.3);
          for (let l = 0; l < 3; l++) Le(o, "cover", e + 0.35, 0.86 + l * 0.03, i, 0.4, 0.022, 0.3);
          (Le(o, "bin", e, 0.88, i + 0.22, 0.25, 0.08, 0.15),
            gi(e, 0.95, i, 1.5, 0.3, 0.8, { type: "table", id: t.id }));
        } else {
          mf(t.id, n.vest, e, i + 1.25, 0, r);
          for (let [l, c] of [
            [-0.4, -0.25],
            [0.4, -0.25],
            [-0.4, 0.25],
            [0.4, 0.25],
          ])
            o("rack", $e, e + 0.95 + l, 0.7, i + 2.15 + c, 0.04, 1.4, 0.04);
          for (let [l, c] of [
            [0.35, "bin2"],
            [0.78, "bin"],
            [1.2, "bin"],
          ])
            (o("rack", $e, e + 0.95, l - 0.06, i + 2.15, 0.84, 0.03, 0.54),
              o(c, $e, e + 0.75, l + 0.04, i + 2.12, 0.34, 0.16, 0.42),
              o(c, $e, e + 1.15, l + 0.04, i + 2.12, 0.34, 0.16, 0.42));
          (gi(e + 0.95, 0.75, i + 2.15, 0.9, 1.5, 0.6, { type: "rack", id: t.id }),
            o("cable", $h, e + 0.35, 2.55, i + 0.75, 0.012, 0.95, 0.012),
            o("tool", Xh, e + 0.35, 1.95, i + 0.75, 0.045, 0.26, 0.045),
            o("tool2", $e, e + 0.35, 2.12, i + 0.75, 0.07, 0.08, 0.07),
            gi(e + 0.35, 2.1, i + 0.75, 0.25, 0.7, 0.25, { type: "tool", id: t.id }),
            r &&
              (o("frame", $e, e - 0.9, 0.5, i + 1.3, 0.6, 0.06, 0.4),
              o("tool2", Xh, e - 1, 0.58, i + 1.3, 0.025, 0.12, 0.025),
              o("bin", $e, e - 0.75, 0.56, i + 1.3, 0.14, 0.06, 0.2)));
        }
        Le(Ee, "plinth", e, 0.03, ys(t.id), 1.1, 0.06, 0.7);
        let a = new Xt(new Ui(0.92, 0.4), new gn({ map: Xy(t.id, n.color), toneMapped: !1 }));
        (a.position.set(e - 1, 2.25, s ? i + 0.5 : i + 0.9),
          ye.add(a),
          Le(Ee, "leg", e - 1, 1.02, s ? i + 0.5 : i + 0.9, 0.04, 2.04, 0.04),
          gi(e - 1, 2.25, s ? i + 0.5 : i + 0.9, 0.95, 0.45, 0.06, { type: "sign", id: t.id }),
          (_n[t.id] = { p: t, b: n, x: e, z: i }));
      }
    var Ba = new tn();
    {
      let n = new gn({ color: "#ef4444", transparent: !0, opacity: 0 });
      for (let t of [Math.PI / 4, -Math.PI / 4]) {
        let e = new Xt($e, n);
        (e.scale.set(3.2, 0.02, 0.16), (e.rotation.y = t), Ba.add(e));
      }
      (Ba.position.set(It[Zt].x, 0.02, oe + 1.4), ye.add(Ba));
    }
    for (let [n, t] of Fa) {
      let e = new Xt(Ra(t, !1), vs[n]);
      ((e.castShadow = !["yellow", "arrow"].includes(n)), (e.receiveShadow = !0), ye.add(e));
    }
    {
      let n = new Hr(Xh, vs.rail, qh.length);
      (qh.forEach((t, e) => n.setMatrixAt(e, t)), (n.receiveShadow = !0), ye.add(n));
    }
    var krGhost = new ga($e),
      Rf = { oe: "#22a35a", md: "#d8b10f", vo: "#dc2f2f" },
      $y = (n) =>
        new Wn({ color: n, roughness: 0.5, metalness: 0.05, emissive: n, emissiveIntensity: 0.12, transparent: !0 });
    for (let n in _n) {
      let t = _n[n],
        e = t.p,
        i = ys(n);
      // столбик строится из текущего источника; krBars() перестраивает его при смене источника/модели
      t.bars = {};
      for (let o of ["oe", "md", "vo"]) {
        let l = new Xt($e, $y(Rf[o]));
        (l.position.set(t.x, 0.06, i), ye.add(l), (t.bars[o] = l));
      }
      let g = new Vr(krGhost, new er({ color: "#e2e8f0", transparent: !0, opacity: 0.75 }));
      (g.position.set(t.x, 0.06, i), (g.visible = !1), ye.add(g), (t.ghost = g));
      let r = new Xt($e, new gn({ color: "#ff2400", transparent: !0, opacity: 0, depthWrite: !1 }));
      (r.scale.set(0.98, 0.001, 0.6),
        r.position.set(t.x, 0, i),
        ye.add(r),
        (t.over = r),
        (t.overH = 0),
        (t.barHit = gi(t.x, 0.06 + (Math.max(hs(e), 20) * Sn) / 2, i, 0.9, Math.max(hs(e), 20) * Sn, 0.5, {
          type: "bar",
          id: n,
        })));
    }
    var Yy = new gn({ color: "#ff2400", toneMapped: !1 });
    for (let [n, t, e] of [
      [It["51-1"].x - Ot / 2, It["51-11"].x + Ot / 2, ys("51-1")],
      [-Ot / 2, Jn + Ot / 2, ys("31-1")],
      [It["31-12"].x - Ot / 2, It["31-12"].x + Ot / 2, ys("31-12")],
    ])
      for (let i of [-0.22, 0.22]) {
        let s = new Xt($e, Yy);
        (s.scale.set(t - n, 0.035, 0.035), s.position.set((n + t) / 2, 0.06 + 79 * Sn, e + i), ye.add(s));
      }
    var $a = {},
      qy = new ga($e);
    for (let n of nn) {
      let t = new Xt(
        $e,
        new Wn({ color: n.color, emissive: n.color, emissiveIntensity: 0.35, roughness: 0.4, transparent: !0 }),
      );
      ((t.userData = { h: n.sec * Sn, op: 1 }),
        t.add(new Vr(qy, new er({ color: "#f8fafc", transparent: !0, opacity: 0.55 }))),
        ye.add(t),
        ($a[n.id] = t));
    }
    function Cf(n, t) {
      let e = n.dest[t];
      if (!e || n.sec <= 0.001) return null;
      let i = _n[e],
        s = 0.06 + (e === Zt ? 0 : hs(i.p) * Sn);
      for (let r of nn) {
        if (r.id === n.id) break;
        r.dest[t] === e && (s += r.sec * Sn);
      }
      return new T(i.x, s + (n.sec * Sn) / 2, ys(e));
    }
    var Zy = ps(() => {
      yt("#56606d", 0, 0, 0, 1, 0.06, 0.78);
      for (let n of [-1, 1]) yt("#151b26", n * 0.42, 0.04, 0, 0.06, 0.03, 0.6);
      yt("#facc15", 0.47, 0, 0.3, 0.04, 0.062, 0.1);
    });
    function Pf(n) {
      let t = new tn(),
        e = new Xt(Zy, ui.metal);
      return (
        (e.receiveShadow = !0),
        (e.userData = { type: "pallet", kind: n }),
        t.add(e),
        (t.position.y = 0.87),
        ye.add(t),
        { g: t, kind: n, s: 0, pal: e }
      );
    }
    var oo = Mn.length,
      gf = (n) =>
        n < 0 ? new T(bs + (n + 1) * Ot, 0.87, oe) : n >= oo ? new T(Zn - 0.6, 0.87, oe) : new T(It[Mn[n]].x, 0.87, oe),
      _f = (n) => (n < 11 ? new T(It[Nn[n]].x, 0.87, Ve) : n === 11 ? new T(bs, 0.87, Ve) : new T(bs, 0.87, oe - 1.6)),
      Mr = [],
      br = [];
    for (let n = -2; n <= oo; n++) {
      let t = Pf("E");
      ((t.s = n), Mr.push(t));
    }
    for (let n = 0; n <= 12; n++) {
      let t = Pf("H");
      ((t.s = n), br.push(t));
    }
    var Xi = [...Mr, ...br];
    Xi.forEach((n, t) => {
      ((n.i = t), (n.pal.userData.idx = t));
    });
    Nh();
    var tu = [];
    for (let n of Vi) {
      let t = (e) => {
        let i = new Hr(n.geo, e, Xi.length);
        return (
          (i.frustumCulled = !1),
          (i.castShadow = i.receiveShadow = !!n.shadow),
          (i.userData = { type: "part", part: n.id, map: [] }),
          i.instanceMatrix.setUsage(Fd),
          ye.add(i),
          i
        );
      };
      tu.push({ P: n, a: t(ui[n.kind]), b: t(sf[n.kind]) });
    }
    var zn = new Xt(Vi[0].geo, ms.metal);
    zn.matrixAutoUpdate = !1;
    zn.visible = !1;
    ye.add(zn);
    var _i = null,
      Ky = 3.4,
      Zh = 0.3,
      Kn = 0.62,
      eu = (n) => (n < 0.5 ? 4 * n * n * n : 1 - Math.pow(-2 * n + 2, 3) / 2),
      xf = (n, t) => t > n || (t === n && Kn > 0.55),
      Gh = new Set(),
      Kr = new Qt(),
      Jy = (n, t, e) =>
        n.kind === "E"
          ? (() => {
              let i = mr(t, e);
              return i === "21" || xf(zy[i] ?? 999, n.s);
            })()
          : Fn[t].row === "H" && xf(ky[bn(t, e)] ?? 999, n.s);
    function nu(n) {
      return n.kind === "E" ? (n.s >= 0 && n.s < oo ? Mn[n.s] : null) : n.s < 11 ? Nn[n.s] : null;
    }
    function jy() {
      let n = vt.mode,
        t = Kn > 0.55;
      zn.visible = !1;
      for (let { P: e, a: i, b: s } of tu) {
        let r = 0,
          o = 0;
        for (let a of Xi) {
          let l = a.g.visible && Jy(a, e.id, n),
            c = !1;
          if (l) {
            let h = t ? nu(a) : null,
              d = a.kind === "E" ? mr(e.id, n) : bn(e.id, n);
            ((c = vt.accent && h && h === d),
              Kr.copy(a.g.matrix),
              (Kr.elements[13] += (0.03 + (a.kind === "E" && e.row === "H" ? pt : 0)) * a.g.scale.y),
              _i &&
                _i.part === e.id &&
                _i.idx === a.i &&
                ((zn.geometry = e.geo), (zn.material = ms[e.kind]), zn.matrix.copy(Kr), (zn.visible = !0), (l = !1)));
          }
          l &&
            (c
              ? (s.setMatrixAt(o, Kr), (s.userData.map[o++] = a.i))
              : (i.setMatrixAt(r, Kr), (i.userData.map[r++] = a.i)));
        }
        ((i.count = r), (s.count = o), (i.instanceMatrix.needsUpdate = s.instanceMatrix.needsUpdate = !0));
      }
    }
    function Qy() {
      let n = Kn < Zh ? eu(Kn / Zh) : 1;
      for (let t of Mr) (t.g.position.lerpVectors(gf(t.s - 1), gf(t.s), n), (t.g.visible = t.s >= -1 && t.s <= oo));
      for (let t of br)
        (t.g.position.lerpVectors(_f(Math.max(0, t.s - 1)), _f(t.s), t.s === 0 ? 1 : n),
          (t.g.visible = !(t.s === 12 && Kn > 0.6)),
          t.g.scale.setScalar(t.s === 0 ? Math.min(1, 0.2 + Kn * 3) : 1));
      for (let t of Xi) t.g.updateMatrix();
      jy();
    }
    function tv() {
      for (let n of Mr) (n.s++, n.s > oo && (n.s = -2));
      for (let n of br) (n.s++, n.s > 12 && (n.s = 0));
    }
    function ev(n) {
      for (let t in Ss) {
        let e = Ss[t],
          i = vt.flow && Kn > Zh && !(t === Zt && Pe(Zt, vt.mode)),
          s = i ? 0.75 + 0.35 * Math.sin(n * 5.2 + e.seed) : 0.7;
        ((e.arms[0].piv.rotation.x = s),
          (e.arms[1].piv.rotation.x = i ? 0.75 + 0.35 * Math.sin(n * 5.2 + e.seed + 2.1) : 0.7));
      }
    }
    var If = En("#labels-layer"),
      Lf = new Set([Zt, "31-11", "51-9", "51-11"]);
    for (let n in _n) {
      let t = document.createElement("div");
      ((t.className = "post-label"),
        (t.innerHTML = `<b>${n}</b><span class="pl-t"></span><span class="pl-bar"><i class="ok"></i><i class="over"></i><em></em></span>`),
        If.appendChild(t),
        (_n[n].label = t));
    }
    var nv = [
        [`<b style="color:${Oa.color}">${Oa.title}</b> \xB7 ${Oa.sub}`, new T(It["51-1"].x - 1, 5.2, Ve - 1.5)],
        [`<b style="color:${yr.color}">${yr.title}</b> \xB7 ${yr.sub}`, new T(-1, 5.2, oe - 1.5)],
        [`<b style="color:${Jr.color}">${Jr.title}</b> \xB7 ${Jr.sub}`, new T(jh - 1, 5.2, oe - 1.5)],
        ["<b>Блок цилиндров</b> ← от бригады 21", new T(-4.5 * Ot, 1.8, oe + 0.6)],
        ["ГБЦ → на пост 31-1", new T(bs, 1.6, (Ve + oe) / 2)],
        ["→ участок испытаний", new T(Zn + 3, 3.6, oe)],
        ["подсборка 31-12", new T(It["31-12"].x + 1.2, 1.5, It["31-12"].z)],
      ].map(([n, t, e]) => {
        let i = document.createElement("div");
        return (
          (i.className = "brig-label" + (e ? " " + e : "")),
          (i.innerHTML = n),
          If.appendChild(i),
          { el: i, pos: t }
        );
      }),
      xr = new T();
    function iv(n, t, e) {
      return (
        xr.copy(n).project(we),
        xr.z >= 1 || Math.abs(xr.x) > 1.05 || Math.abs(xr.y) > 1.05
          ? null
          : [((xr.x + 1) / 2) * t, ((1 - xr.y) / 2) * e]
      );
    }
    function sv() {
      let n = hn.clientWidth,
        t = hn.clientHeight,
        e = [];
      for (let s in _n) {
        let r = _n[s],
          o = fe(s, vt.mode),
          a = s === vt.hover ? 100 : s === vt.sel ? 95 : Lf.has(s) ? 80 : o > 79 ? 40 : vt.allLabels ? 10 : -1;
        if (a < 0 || (Tt.on && a < 90)) {
          r.label.style.display = "none";
          continue;
        }
        let l = 0.06 + Math.max(o, s === Zt ? fe(Zt, "before") : 0) * Sn;
        e.push({ el: r.label, pos: new T(r.x, l + 0.35, ys(s)), pri: a, dx: -40, dy: -46 });
      }
      for (let s of nv) e.push({ el: s.el, pos: s.pos, pri: Tt.on ? -1 : 85, dx: 0, dy: -12 });
      e.sort((s, r) => r.pri - s.pri);
      let i = [];
      for (let s of e) {
        let r = s.pri >= 0 && iv(s.pos, n, t);
        if (!r) {
          s.el.style.display = "none";
          continue;
        }
        s.el.style.display === "none" && (s.el.style.display = "");
        let o = [r[0] + s.dx, r[1] + s.dy, s.el.offsetWidth || 120, s.el.offsetHeight || 30];
        if (
          s.pri < 100 &&
          i.some(
            (a) => o[0] < a[0] + a[2] + 4 && o[0] + o[2] + 4 > a[0] && o[1] < a[1] + a[3] + 2 && o[1] + o[3] + 2 > a[1],
          )
        ) {
          s.el.style.display = "none";
          continue;
        }
        (i.push(o), (s.el.style.transform = `translate(${r[0].toFixed(1)}px, ${r[1].toFixed(1)}px)`));
      }
    }
    function rv() {
      for (let n in _n) {
        let t = _n[n],
          e = fe(n, vt.mode),
          i = Pe(n, vt.mode);
        (t.label.classList.toggle("is-over", e > 79),
          t.label.classList.toggle("is-gone", i),
          t.label.classList.toggle("is-key", Lf.has(n)));
        let s = e - fe(n, "before");
        t.label.querySelector(".pl-t").innerHTML = i
          ? "убран"
          : `${xs(e)} смин${s ? ` <small class="${s > 0 && e > 79 ? "bad" : "good"}">${s > 0 ? "+" : ""}${xs(s)}</small>` : ""}`;
        let r = 130,
          [o, a] = t.label.querySelectorAll(".pl-bar i");
        ((o.style.width = `${(Math.min(e, 79) / r) * 100}%`),
          (a.style.left = `${(79 / r) * 100}%`),
          (a.style.width = `${(Math.max(0, e - 79) / r) * 100}%`),
          (t.label.querySelector(".pl-bar em").style.left = `${(79 / r) * 100}%`));
      }
    }
    var Qr = [];
    function za(n, t, e) {
      if (Sf) {
        (t(1), e && e());
        return;
      }
      (Qr.push({ t: 0, dur: n, fn: t, done: e }), De());
    }
    function Ua(n, t = new T(0.12, 0.72, 1), e = 0.8) {
      let i = n.getCenter(new T()),
        s = n.getSize(new T()),
        r = Bi.degToRad(we.fov) / 2,
        o = Math.atan(Math.tan(r) * we.aspect),
        a = Math.max(s.x / 2 / Math.tan(o), s.z / 1.4 / Math.tan(r), 6) * e;
      return { target: i, pos: i.clone().add(t.normalize().multiplyScalar(a + s.y)) };
    }
    function Na(n, t = 1.5) {
      let e = new Ln();
      for (let i of n) {
        let s = It[i] || i;
        (e.expandByPoint(new T(s.x - t, 0, s.z - 3)), e.expandByPoint(new T(s.x + t, 4, s.z + 2.5)));
      }
      return e;
    }
    var vr = {
        all: () => {
          let n = Math.max(1, 1.45 / we.aspect);
          return { target: new T(12, 0, -6), pos: new T(12 - 50 * n, 36 * n, -6 + 30 * n) };
        },
        b51: () => Ua(Na(Nn)),
        b31: () => Ua(Na(yr.posts.map((n) => n.id))),
        b41: () => Ua(Na(Jr.posts.map((n) => n.id))),
        move: () => Ua(Na(["51-8", "51-11", Zt]), new T(0, 0.95, 0.75), 1.08),
      },
      Df = (n) => {
        let t = It[n],
          e = t.side ? -1 : 1;
        return { target: new T(t.x, 1.5, t.z - 0.3 * e), pos: new T(t.x + 0.6, 4.4, t.z + 7.2 * e) };
      };
    function ao(n) {
      Tt.on && co();
      let t = we.position.clone(),
        e = Je.target.clone(),
        g = (ao.ep = (ao.ep | 0) + 1);
      za(1.1, (i) => {
        if (g !== ao.ep) return;
        let s = eu(i);
        (we.position.lerpVectors(t, n.pos, s), Je.target.lerpVectors(e, n.target, s));
      });
    }
    var Ya = (n) => ao(Df(n));
    function Uf(n) {
      let t = It[n];
      if (!t) return Ya(n);
      let e = t.side ? -1 : 1;
      ao({ target: new T(t.x, 1.3, t.z), pos: new T(t.x + 0.9, 2.3, t.z + 2.2 * e) });
    }
    function krBars() {
      for (let n in _n) {
        let t = _n[n],
          e = t.p,
          s = 0.06;
        for (let o of ["oe", "md", "vo"]) {
          let a = e[o] * Sn,
            l = t.bars[o];
          ((l.visible = a > 0.001), l.scale.set(0.8, Math.max(0.001, a - 0.012), 0.42), (l.position.y = s + a / 2), (s += a));
        }
        let r = fe(n, vt.mode),
          a = krAlt(n, vt.mode),
          g = t.ghost;
        ((g.visible = !Pe(n, vt.mode) && Math.abs(a - r) >= 0.5),
          g.scale.set(0.9, Math.max(0.001, a * Sn), 0.5),
          (g.position.y = 0.06 + (a * Sn) / 2));
      }
    }
    function Nf(n) {
      let t = vt.mode;
      krBars();
      for (let a of nn) {
        let l = $a[a.id],
          c = l.userData,
          h = Cf(a, t),
          d = l.position.clone(),
          u = c.op,
          f = l.scale.y,
          g = h || d.clone().setY(0.06),
          x = h ? 1 : 0,
          p = h ? a.sec * Sn : 0.001,
          m = h && d.distanceTo(g) > 1 ? 5 + d.distanceTo(g) * 0.08 : 0,
          E = (v) => {
            let S = eu(v);
            (l.position.lerpVectors(d, g, S),
              (l.position.y += Math.sin(Math.PI * S) * m),
              l.scale.set(0.8, Bi.lerp(f, p, S), 0.42),
              (c.op = Bi.lerp(u, x, S)),
              (l.material.opacity = c.op),
              (l.children[0].material.opacity = 0.55 * c.op),
              (l.visible = c.op > 0.01));
          };
        n ? za(1.7, E) : E(1);
      }
      for (let a in _n) {
        let l = _n[a],
          c = fe(a, t),
          h = l.overH,
          d = Math.max(0, c - 79) * Sn;
        l.overH = d;
        let u = (g) => {
          let x = Bi.lerp(h, d, g);
          ((l.over.scale.y = Math.max(0.001, x)),
            (l.over.position.y = 0.06 + 79 * Sn + x / 2),
            (l.over.material.opacity = x > 0.01 ? 0.22 : 0));
        };
        n ? za(1.7, u) : u(1);
        let f = Math.max(c, 20) * Sn;
        ((l.barHit.scale.y = f), (l.barHit.position.y = 0.06 + f / 2));
      }
      let e = Pe(Zt, t),
        i = jr.userData.op ?? 1,
        s = e ? 0.12 : 1;
      jr.userData.op = s;
      let r = Ss[Zt],
        o = (a) => {
          let l = Bi.lerp(i, s, a);
          (jr.traverse((c) => {
            c.material && ((c.material.opacity = l), (c.material.depthWrite = l > 0.5), (c.castShadow = l > 0.5));
          }),
            (r.mat.opacity = l),
            (r.mat.depthWrite = l > 0.5),
            (r.g.visible = l > 0.05),
            (Ba.children[0].material.opacity = (1 - l) * 0.9));
        };
      (n ? za(1.2, o) : o(1), rv(), De());
    }
    function qa(n, t = !0) {
      !ki[n] ||
        (n === vt.mode && t) ||
        ((vt.mode = n),
        (document.body.dataset.mode = n),
        document
          .querySelectorAll("button[data-mode]")
          .forEach((e) => e.setAttribute("aria-pressed", e.dataset.mode === n)),
        Nf(t),
        Za(),
        Wi(vt),
        ou.update());
    }
    function Ms(n, t = !0, e = !1) {
      if (!Ce[n]) return;
      ((vt.sel = n), Za(), (vt.playT = 0));
      let i = It[n];
      (Ga.position.set(i.x, 0.03, i.side ? i.z - 0.85 : i.z + 1.25),
        (Ga.material.opacity = 0.9),
        Wi(vt),
        e || ou.show(n),
        t && Ya(n),
        De());
    }
    var no = En("#time"),
      to = En("#play");
    function Za() {
      ((vt.playing = !1), to.setAttribute("aria-pressed", "false"), (to.textContent = "▶ Цикл поста"));
    }
    to.addEventListener("click", () => {
      if (vt.playing) return Za();
      let n = +no.max;
      n &&
        (vt.playT >= n && (vt.playT = 0),
        (vt.playing = !0),
        to.setAttribute("aria-pressed", "true"),
        (to.textContent = "❚❚ Пауза"),
        De());
    });
    no.addEventListener("input", () => {
      ((vt.playT = +no.value), Wi(vt, !0), iu(), De());
    });
    var Ga = new Xt(new Wr(0.5, 0.62, 40), new gn({ color: "#f8fafc", transparent: !0, opacity: 0, toneMapped: !1 }));
    Ga.rotation.x = -Math.PI / 2;
    ye.add(Ga);
    var Ka = new Xt(new Wr(0.66, 0.78, 40), new gn({ color: "#ff2400", transparent: !0, opacity: 0, toneMapped: !1 }));
    Ka.rotation.x = -Math.PI / 2;
    ye.add(Ka);
    var ka = null;
    function iu() {
      let n = vt.current;
      if (((ka = n ? n.post : null), ka)) {
        let t = It[ka];
        Ka.position.set(t.x, 0.031, t.side ? t.z - 0.85 : t.z + 1.25);
      }
      for (let t of nn) $a[t.id].material.emissiveIntensity = n && n.chunk === t.id ? 1.1 : 0.35;
    }
    var yf = new sr(),
      vf = new dt(),
      mi = En("#tip");
    function ov() {
      let n = [...Af.filter((t) => Ss[t.userData.id].g.visible), ...Tf];
      for (let t of Xi) t.g.visible && n.push(t.pal);
      for (let { a: t, b: e } of tu) ((t.boundingSphere = e.boundingSphere = null), n.push(t, e));
      return (zn.visible && n.push(zn), n);
    }
    function io(n, t) {
      (vf.set(n, t), yf.setFromCamera(vf, we));
      let e = yf.intersectObjects(ov(), !1)[0];
      if (!e) return null;
      let i = e.object;
      return i === zn
        ? { o: i, d: { type: "part", part: _i.part }, pallet: Xi[_i.idx] }
        : i.isInstancedMesh
          ? { o: i, d: i.userData, pallet: Xi[i.userData.map[e.instanceId]] }
          : { o: i, d: i.userData, pallet: i.userData.type === "pallet" ? Xi[i.userData.idx] : null };
    }
    var Wh = (n) => {
        let t = fe(n, vt.mode);
        return Pe(n, vt.mode)
          ? '<p class="tip-x">Пост убран в этом режиме.</p>'
          : `<p class="${t > 79 ? "tip-x" : "tip-now"}">${xs(t)} смин \xB7 ${Math.round((t / 79) * 100)} % такта ${79} смин${t > 79 ? ` \xB7 не успевает на ${xs(t - 79)} смин` : ` \xB7 запас ${xs(79 - t)} смин`}</p>`;
      },
      av = (n) => Ce[n].brig;
    function lv(n) {
      let t = n.d,
        e = vt.mode;
      if (t.type === "part") {
        let i = Fn[t.part],
          s = n.pallet.kind === "E" ? mr(t.part, e) : bn(t.part, e),
          r = bn(t.part, e),
          o =
            r === "21"
              ? "приходит с блоком от бригады 21"
              : `ставится на посту ${r} \xB7 ${pi(Ce[r].name)}` +
                (s !== r ? " (на двигатель — вместе с ГБЦ на 31-1)" : ""),
          a =
            i.post === "move"
              ? `<p class="tip-x">ДО: пост 41-1(а) \xB7 Вариант: 31-11 \xB7 ПОСЛЕ: ${t.part === "disc" ? "51-11" : "51-9"}</p>`
              : "";
        return `<b><i style="background:${r === "21" ? "#94a3b8" : av(r).color}"></i>${pi(i.name)}</b><p>${pi(i.desc)}</p><p class="tip-now">${o}</p>${a}<p class="hint">Клик — открыть этот пост</p>`;
      }
      if (t.type === "op" || t.type === "table") {
        let i = t.id,
          s = Ce[i],
          r = Zr(i, e)
            .filter((a) => a.active)
            .sort((a, l) => l.s - a.s)
            .slice(0, 4),
          o = _r(i, e)
            .map((a) => a.name)
            .join(", ");
        return (
          `<b><i style="background:${s.brig.color}"></i>Оператор поста ${i} \xB7 ${s.brig.title}</b><p>${pi(ds[i])}</p>${o ? `<p class="tip-now">Добавляет: ${pi(o)}</p>` : ""}${Wh(i)}` +
          (r.length
            ? `<p class="hint">Дольше всего: ${r.map((a) => `${pi(a.t)} — ${xs(a.s)} смин`).join("; ")}</p>`
            : "") +
          '<p class="hint">Клик — все операции справа</p>'
        );
      }
      if (t.type === "rack") {
        let i = _r(t.id, vt.mode);
        return `<b>Стеллаж с деталями \xB7 пост ${t.id}</b><p>${i.length ? "Здесь лежат: " + pi(i.map((s) => s.name).join(", ")) + "." : "Детали и крепёж для поста."}</p><p class="hint">На фото участков часть тары стоит низко — оператору приходится наклоняться.</p>`;
      }
      if (t.type === "tool")
        return `<b>Гайковёрт на балансире \xB7 пост ${t.id}</b><p>Подвешен на пружинном балансире, чтобы не держать вес в руке. Затягивает болты и гайки с заданным моментом.</p>`;
      if (t.type === "sign") return `<b>${t.id} \xB7 ${pi(Ce[t.id].name)}</b><p>${pi(ds[t.id])}</p>${Wh(t.id)}`;
      if (t.type === "bar") {
        let i = Ce[t.id],
          s = hr(t.id, e);
        return `<b>Загрузка поста ${t.id}</b><p>Столбик = время одного цикла: <span style="color:${Rf.oe}">ОЭ ${xs(i.oe)} смин</span> (сама сборка) + <span style="color:#e3c02b">МД ${i.md} смин</span> (взять/положить, развернуть, нажать кнопку или педаль) + <span style="color:#f87171">ВО ${i.vo} смин</span>${s.map((r) => ` + <span style="color:${r.color}">${r.short} ${ue(r.sec)} смин</span>`).join("")}. Красная линия — такт ${79} смин.</p>${Wh(t.id)}`;
      }
      return t.type === "pallet"
        ? `<b>Спутник (паллета)</b><p>${t.kind === "E" ? "Плита, на которой двигатель едет от поста к посту." : "Плита, на которой головка едет по участку бригады 51."}</p>`
        : t.type === "test"
          ? "<b>Участок испытаний</b><p>После поста 41-11 двигатель на подвеске уходит на испытания. Отказы на испытаниях — главный показатель качества сборки.</p>"
          : t.type === "crane"
            ? "<b>Кран-балка поста 51-1</b><p>Ей оператор поднимает из контейнера корпус ГБЦ (обработанный, ещё без деталей) и ставит на спутник.</p>"
            : t.type === "b21"
              ? "<b>Блок цилиндров от бригады 21</b><p>Бригада 21 собирает \xABниз\xBB двигателя: блок, коленвал, поршни, масляный насос, картер, маховик, сцепление. Её посты в этом проекте не меняем.</p>"
              : t.type === "conv"
                ? "<b>Роликовый конвейер</b><p>Каждые 79 смин (такт) спутники сдвигаются на один пост.</p>"
                : "";
    }
    function cv(n) {
      for (let t of Gh) t.userData.type === "op" && (t.material = t.userData.base);
      if (
        ((Gh = new Set()),
        (_i = null),
        !!n && (n.d.type === "part" && n.pallet && (_i = { part: n.d.part, idx: n.pallet.i }), n.d.type === "op"))
      ) {
        let t = Ss[n.d.id];
        for (let e of [t.body, ...t.arms.map((i) => i.a)]) (Gh.add(e), (e.material = ms.matte));
      }
    }
    function hv(n, t, e) {
      let i = n && lv(n);
      if (!i) {
        mi.hidden = !0;
        return;
      }
      ((mi.innerHTML = i), (mi.hidden = !1));
      let s = hn.clientWidth,
        r = hn.clientHeight;
      mi.style.transform = `translate(${Math.max(4, Math.min(t + 16, s - mi.offsetWidth - 6))}px, ${Math.max(4, Math.min(e + 16, r - mi.offsetHeight - 6))}px)`;
    }
    var Wa = "";
    function lo(n, t, e) {
      let i = n ? `${n.d.type}:${n.d.id || n.d.part}:${n.pallet ? n.pallet.i : ""}` : "";
      i !== Wa && (cv(n), (Wa = i));
      let s = n && (n.d.id || (n.pallet && nu(n.pallet)));
      (s !== vt.hover && (vt.hover = s || null), hv(n, t, e), De());
    }
    function Mf(n) {
      if (!n) return;
      let t = n.d;
      if (t.type === "part") {
        let e = bn(t.part, vt.mode);
        if (Ce[e]) Ms(e, !1);
        else if (n.pallet) {
          let i = nu(n.pallet);
          i && Ms(i, !1);
        }
        return;
      }
      t.id && Ce[t.id] && Ms(t.id, !Tt.on);
    }
    var Ha = null,
      Of = (n) => {
        let t = Fe.domElement.getBoundingClientRect();
        return [
          ((n.clientX - t.left) / t.width) * 2 - 1,
          (-(n.clientY - t.top) / t.height) * 2 + 1,
          n.clientX - t.left,
          n.clientY - t.top,
        ];
      };
    Fe.domElement.addEventListener("pointermove", (n) => {
      if (Tt.on) {
        Tt.drag && (Ff(n.clientX - Tt.drag[0], n.clientY - Tt.drag[1]), (Tt.drag = [n.clientX, n.clientY]));
        return;
      }
      if (n.buttons) return;
      let [t, e, i, s] = Of(n);
      lo(io(t, e), i, s);
    });
    Fe.domElement.addEventListener("pointerleave", () => {
      Tt.on || lo(null);
    });
    Fe.domElement.addEventListener("pointerdown", (n) => {
      ((Ha = [n.clientX, n.clientY]), (mi.hidden = !0), Tt.on && !Tt.locked && (Tt.drag = [n.clientX, n.clientY]));
    });
    window.addEventListener("pointerup", () => {
      Tt.drag = null;
    });
    Fe.domElement.addEventListener("pointerup", (n) => {
      if (!Ha || Math.hypot(n.clientX - Ha[0], n.clientY - Ha[1]) > 5) return;
      if (Tt.on) {
        Tt.locked && Mf(io(0, 0));
        return;
      }
      let [t, e] = Of(n);
      Mf(io(t, e));
    });
    Je.addEventListener("change", () => De());
    var Tt = { on: !1, locked: !1, yaw: 0, pitch: 0, keys: new Set(), drag: null, lastPick: 0 },
      su = En("#fly");
    function ru() {
      ((Tt.on = !0), document.body.classList.add("flying"), (Je.enabled = !1));
      let n = new Ze().setFromQuaternion(we.quaternion, "YXZ");
      ((Tt.yaw = n.y), (Tt.pitch = n.x), su.setAttribute("aria-pressed", "true"), (mi.hidden = !0), lo(null));
      try {
        let t = Fe.domElement.requestPointerLock();
        t && t.catch && t.catch(() => {});
      } catch {}
      (hn.focus({ preventScroll: !0 }), De());
    }
    function co() {
      ((Tt.on = !1),
        Tt.keys.clear(),
        document.body.classList.remove("flying"),
        document.pointerLockElement && document.exitPointerLock());
      let n = new T(0, 0, -1).applyQuaternion(we.quaternion);
      (Je.target.copy(we.position).addScaledVector(n, 6),
        (Je.enabled = !0),
        Je.update(),
        su.setAttribute("aria-pressed", "false"),
        (mi.hidden = !0),
        De());
    }
    su.addEventListener("click", () => (Tt.on ? co() : ru()));
    document.addEventListener("pointerlockchange", () => {
      let n = Tt.locked;
      ((Tt.locked = document.pointerLockElement === Fe.domElement),
        document.body.classList.toggle("locked", Tt.locked),
        n && !Tt.locked && Tt.on && co());
    });
    function Ff(n, t) {
      ((Tt.yaw -= n * 0.0023),
        (Tt.pitch = Math.max(-1.45, Math.min(1.45, Tt.pitch - t * 0.0023))),
        we.quaternion.setFromEuler(new Ze(Tt.pitch, Tt.yaw, 0, "YXZ")),
        De());
    }
    document.addEventListener("mousemove", (n) => {
      Tt.on && Tt.locked && Ff(n.movementX, n.movementY);
    });
    var uv = new Set([
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyQ",
      "KeyE",
      "KeyR",
      "KeyF",
      "Space",
      "KeyC",
      "ShiftLeft",
      "ShiftRight",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ]);
    document.addEventListener("keydown", (n) => {
      if (Tt.on) {
        if (n.code === "Escape") {
          co();
          return;
        }
        uv.has(n.code) && (Tt.keys.add(n.code), n.preventDefault(), De());
      }
    });
    document.addEventListener("keyup", (n) => Tt.keys.delete(n.code));
    window.addEventListener("blur", () => Tt.keys.clear());
    function dv(n) {
      let t = Tt.keys,
        e = (t.has("ShiftLeft") || t.has("ShiftRight") ? 16 : 5) * n,
        i = new T(-Math.sin(Tt.yaw) * Math.cos(Tt.pitch), Math.sin(Tt.pitch), -Math.cos(Tt.yaw) * Math.cos(Tt.pitch)),
        s = new T(Math.cos(Tt.yaw), 0, -Math.sin(Tt.yaw)),
        r = new T();
      return (
        (t.has("KeyW") || t.has("ArrowUp")) && r.add(i),
        (t.has("KeyS") || t.has("ArrowDown")) && r.sub(i),
        (t.has("KeyD") || t.has("ArrowRight")) && r.add(s),
        (t.has("KeyA") || t.has("ArrowLeft")) && r.sub(s),
        (t.has("KeyE") || t.has("Space") || t.has("KeyR")) && (r.y += 1),
        (t.has("KeyQ") || t.has("KeyC") || t.has("KeyF")) && (r.y -= 1),
        r.lengthSq() &&
          (we.position.addScaledVector(r.normalize(), e),
          (we.position.y = Math.max(0.35, Math.min(70, we.position.y)))),
        r.lengthSq() > 0
      );
    }
    var eo = En("#stage-wrap"),
      Kh = En("#fs");
    Kh.addEventListener("click", () => {
      document.fullscreenElement
        ? document.exitFullscreen()
        : eo.requestFullscreen
          ? eo.requestFullscreen()
          : eo.webkitRequestFullscreen?.();
    });
    document.addEventListener("fullscreenchange", () => {
      let n = document.fullscreenElement === eo;
      (Kh.setAttribute("aria-pressed", n), (Kh.textContent = n ? "⤡ Выйти из полного экрана" : "⤢ Весь экран"), Ja());
    });
    En("#sidebtn").addEventListener("click", (n) => {
      let t = eo.classList.toggle("noside");
      (n.currentTarget.setAttribute("aria-pressed", !t), Ja());
    });
    document
      .querySelectorAll("button[data-mode]")
      .forEach((n) => n.addEventListener("click", () => qa(n.dataset.mode)));
    document.querySelectorAll("button[data-view]").forEach((n) =>
      n.addEventListener("click", () => {
        (document.querySelectorAll("button[data-view]").forEach((t) => t.setAttribute("aria-pressed", t === n)),
          ao(vr[n.dataset.view]()));
      }),
    );
    var so = En("#flow");
    function Bf() {
      ((vt.flow = !vt.flow),
        so.setAttribute("aria-pressed", vt.flow),
        (so.textContent = vt.flow ? "Конвейер ❚❚" : "Конвейер ▶"),
        De());
    }
    so.addEventListener("click", Bf);
    En("#labels").addEventListener("click", (n) => {
      ((vt.allLabels = !vt.allLabels), n.currentTarget.setAttribute("aria-pressed", vt.allLabels), De());
    });
    En("#accent").addEventListener("click", (n) => {
      ((vt.accent = !vt.accent), n.currentTarget.setAttribute("aria-pressed", vt.accent), De());
    });
    hn.addEventListener("keydown", (n) => {
      if (Tt.on) return;
      let t = { 1: "before", 2: "varA", 3: "after" }[n.key];
      t
        ? (qa(t), n.preventDefault())
        : n.code === "Space"
          ? (Bf(), n.preventDefault())
          : n.code === "KeyF"
            ? ao(vr.all())
            : n.code === "KeyG" && ru();
    });
    var ro = !1,
      Jh = 0,
      Xa = !0;
    function De() {
      !ro && Xa && ((ro = !0), (Jh = performance.now()), requestAnimationFrame(zf));
    }
    function Ja() {
      let n = hn.clientWidth,
        t = hn.clientHeight;
      !n || !t || (Fe.setSize(n, t, !1), (we.aspect = n / t), we.updateProjectionMatrix(), De());
    }
    new ResizeObserver(Ja).observe(hn);
    new IntersectionObserver(
      (n) => {
        ((Xa = n[n.length - 1].isIntersecting), Xa && De());
      },
      { rootMargin: "120px 0px" },
    ).observe(hn);
    function zf(n) {
      try {
        fv(n);
      } catch (t) {
        throw ((ro = !1), t);
      }
    }
    function fv(n) {
      let t = Math.min((n - Jh) / 1e3, 0.03333333333333333);
      Jh = n;
      let e = !1;
      for (let s = Qr.length - 1; s >= 0; s--) {
        let r = Qr[s];
        r.t += t;
        let o = Math.min(1, r.t / r.dur);
        (r.fn(o), o >= 1 ? (Qr.splice(s, 1), r.done && r.done()) : (e = !0));
      }
      if (
        (vt.flow && ((Kn += t / Ky), Kn >= 1 && ((Kn -= 1), tv()), (e = !0)),
        vt.playing &&
          ((vt.playT = Math.min(+no.max, vt.playT + t * 6)), Wi(vt, !0), iu(), vt.playT >= +no.max && Za(), (e = !0)),
        (Ka.material.opacity = ka && (vt.playing || vt.playT > 0) ? 0.45 + 0.4 * Math.sin(n / 160) : 0),
        Tt.on && (dv(t) && (e = !0), Tt.locked && n - Tt.lastPick > 120))
      ) {
        Tt.lastPick = n;
        let s = io(0, 0);
        lo(s, hn.clientWidth / 2, hn.clientHeight / 2);
      }
      let i = Tt.on ? !1 : Je.update();
      (ev(n / 1e3), Qy(), sv(), Fe.render(ye, we), (e || i) && Xa ? requestAnimationFrame(zf) : (ro = !1));
    }
    var kn = new URLSearchParams(location.hash.slice(1)),
      ou = ff(vt, { setSel: (n) => Ms(n, !1, !0) });
    zh(vt, {
      setMode: qa,
      setSel: Ms,
      focus: (n) => Ya(n),
      mark: iu,
      zoom: (n) => Uf(n),
      highlight: (n, t) => {
        let e = t.startsWith("51"),
          i = e ? br : Mr,
          s = e ? Nn : Mn,
          r = i.find((o) => s[o.s] === t);
        r && (!Fn[n] || (r.kind === "H" && Fn[n].row !== "H") || ((_i = { part: n, idx: r.i }), (Wa = "panel"), De()));
      },
      unhighlight: () => {
        ((_i = null), (Wa = ""), De());
      },
    });
    Ja();
    var bf = (kn.get("view") || "").startsWith("p:") && It[kn.get("view").slice(2)] && kn.get("view").slice(2),
      kf = bf ? Df(bf) : (vr[kn.get("view")] || vr.all)();
    we.position.copy(kf.pos);
    Je.target.copy(kf.target);
    vr[kn.get("view")] &&
      document
        .querySelectorAll("button[data-view]")
        .forEach((n) => n.setAttribute("aria-pressed", n.dataset.view === kn.get("view")));
    ki[kn.get("mode")] &&
      ((vt.mode = kn.get("mode")),
      (document.body.dataset.mode = vt.mode),
      document
        .querySelectorAll("button[data-mode]")
        .forEach((n) => n.setAttribute("aria-pressed", n.dataset.mode === vt.mode)));
    kn.get("flow") === "0" && (vt.flow = !1);
    so.setAttribute("aria-pressed", vt.flow);
    so.textContent = vt.flow ? "Конвейер ❚❚" : "Конвейер ▶";
    for (let n of nn) {
      let t = Cf(n, vt.mode);
      t && $a[n.id].position.copy(t);
    }
    Nf(!1);
    Ms(Ce[kn.get("sel")] ? kn.get("sel") : Zt, !1);
    function krSetData(p = {}) {
      (Object.assign(KRX, p), krApply(), Nf(!0), Wi(vt), ou.update(), La(), krSyncUi());
      document.dispatchEvent(new CustomEvent("krause:data", { detail: { ...KRX } }));
    }
    $n.setData = krSetData;
    krSyncUi();
    window.__krause = {
      kd: KRD,
      kx: KRX,
      setData: krSetData,
      dataSig: () => `${KRX.src}|${KRX.model}|${KRX.mix}|${KRX.recog}`,
      calc: krCalc(),
      dbg: () => ({ tw: Qr.length, running: ro, calls: Fe.info.render.calls, tris: Fe.info.render.triangles }),
      view: (n, t) => {
        (we.position.set(...n), Je.target.set(...t), Je.update(), De());
      },
      fps: () =>
        new Promise((n) => {
          let t = 0,
            e = performance.now(),
            i = () => {
              (t++, performance.now() - e < 2e3 ? requestAnimationFrame(i) : n(t / 2));
            };
          requestAnimationFrame(i);
        }),
      state: vt,
      setMode: qa,
      setSel: Ms,
      flyTo: ao,
      VIEWS: vr,
      focusPost: Ya,
      zoomPart: Uf,
      stations: _n,
      load: fe,
      camera: we,
      startFly: ru,
      stopFly: co,
      fly: Tt,
      pickAt: io,
      hover: lo,
      insp: ou,
      engines: Mr,
      heads: br,
      controls: Je,
      renderer: Fe,
      scene: ye,
      redraw: De,
      posts: It,
      brigades: Re,
      Raycaster: sr,
      cancelFly: () => {
        ao.ep = (ao.ep | 0) + 1;
      },
    };
    De();
  });
  pv();
