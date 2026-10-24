
/*
 * LineNav — навигация по 3D-линии «как по карте».
 *
 * Схема управления взята из устоявшихся решений:
 *  - ЛКМ тянет «пол» под курсором (Google Maps, three.js MapControls), точка под курсором не уплывает;
 *  - ПКМ / Shift+ЛКМ вращает вокруг точки под курсором (Autodesk APS, Google Earth);
 *  - колесо приближает к курсору, скорость колеса и тачпада разная (Mapbox/MapLibre scroll_zoom);
 *  - инерция после броска: 1400 px/с максимум, торможение 2500 px/с² (Mapbox), затухание как у Leaflet;
 *  - на телефоне в обычном режиме одним пальцем листается страница, картой управляют два пальца
 *    (Google Maps gestureHandling: "cooperative"); в полноэкранном режиме — один палец двигает;
 *  - два пальца: щипок — масштаб, поворот — вращение (порог 25 px по окружности), параллельный
 *    вертикальный свайп — наклон (MapLibre TwoFingersTouch*);
 *  - мягкая граница («резинка») вместо стены, как maxBoundsViscosity в Leaflet;
 *  - снижение разрешения только во время движения на слабом железе (Sketchfab, drei AdaptiveDpr).
 *
 * Модуль ничего не знает о конкретной сцене: всё нужное передаётся через api (см. attach).
 */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function wrapAngle(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }
  function now() { return performance.now(); }
  // Время самого ввода, а не обработки: на занятом потоке события приходят пачкой, а метки остаются точными.
  function evTime(e) { var t = e && e.timeStamp; return t > 0 && t < 1e12 ? t : now(); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function rub(v, lo, hi, L) {
    if (v < lo) { var d = lo - v; return lo - d * L / (d + L); }
    if (v > hi) { var u = v - hi; return hi + u * L / (u + L); }
    return v;
  }

  var DEFAULTS = {
    rMin: 1.6,              // ближе к центру вращения не подлетаем
    rMax: 220,
    phiMin: 0.04,           // почти вид сверху
    phiMax: Math.PI * 0.49, // не опускаемся под пол
    pivotY: 0.9,            // центр вращения держим на рабочей высоте поста
    camMinY: 0.35,
    nearAnchor: 0.6,        // не подлетать к точке под курсором ближе этого
    rubber: 6,              // длина «резинки» за границей, м
    wheelRate: 1 / 450,     // MapLibre: колесо мыши
    trackpadRate: 1 / 100,  // MapLibre: тачпад и щипок (ctrl+wheel)
    wheelSmooth: 0.07,      // с, сглаживание шага колеса
    inertiaMaxPx: 1400,
    inertiaDecelPx: 2500,
    inertiaMinPx: 80,
    keyPanPx: 700,          // скорость стрелок, px/с
    keyRotate: Math.PI / 2, // рад/с
    keyTilt: Math.PI / 4,
    keyZoom: 1.6,           // уровней (×2) в секунду
    keyMinHold: 150,        // мс: короткое нажатие всё равно сдвигает на ~100 px
    tapMove: 10,            // px: всё, что меньше, — касание, а не жест
    dblTapMs: 300,
    slowFrame: 1 / 38       // если кадр дольше — на время движения снижаем разрешение
  };

  function attach(api, options) {
    var cfg = Object.assign({}, DEFAULTS, options || {});
    var V3 = api.V3, Q = api.Quaternion;
    var cam = api.camera, ctl = api.controls, canvas = api.canvas, root = api.viewer;
    var target = ctl.target;
    var reduced = !!api.reducedMotion;
    var B = api.bounds; // {minX,maxX,minZ,maxZ} — где может находиться центр взгляда
    root.classList.add('ln-host');

    /* ---------- OrbitControls остаётся носителем состояния, ввод — наш ---------- */
    Object.defineProperty(ctl, 'enabled', { configurable: true, get: function () { return false; }, set: function () {} });
    ctl.minDistance = 0.01; ctl.maxDistance = 1e4;
    ctl.minPolarAngle = 0; ctl.maxPolarAngle = Math.PI / 2 - 1e-3;
    var origUpdate = ctl.update.bind(ctl);
    ctl.update = function (dt) { var busy = tick(); var changed = origUpdate(dt); return changed || busy; };

    /* ---------- временные векторы (без аллокаций в горячих путях) ---------- */
    var _d = new V3(), _o = new V3(), _p = new V3(), _a = new V3(), _b = new V3(), _q = new Q(), _axis = new V3();
    var written = { pos: cam.position.clone(), tgt: target.clone() };

    // Размеры кешируем: чтение clientWidth/getBoundingClientRect в каждом кадре заставляет браузер
    // синхронно пересчитывать раскладку — на слабых устройствах это самая дорогая часть кадра.
    var sz = { w: canvas.clientWidth || 1, h: canvas.clientHeight || 1 }, rectCache = null;
    function size() { return sz; }
    function rect() { return rectCache || (rectCache = canvas.getBoundingClientRect()); }
    window.addEventListener('scroll', function () { rectCache = null; }, { passive: true, capture: true });
    function toNdc(clientX, clientY, out) {
      var r = rect();
      out.x = (clientX - r.left) / r.width * 2 - 1;
      out.y = -(clientY - r.top) / r.height * 2 + 1;
      out.px = clientX - r.left; out.py = clientY - r.top;
      return out;
    }
    function syncCam() { cam.lookAt(target); cam.updateMatrixWorld(); }
    function rayDir(nx, ny, out) { return out.set(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize(); }
    function radius() { return cam.position.distanceTo(target); }
    function sph() {
      _o.copy(cam.position).sub(target);
      var r = _o.length() || 1e-6;
      return { r: r, phi: Math.acos(clamp(_o.y / r, -1, 1)), theta: Math.atan2(_o.x, _o.z) };
    }
    function worldPerPx() { return 2 * radius() * Math.tan(cam.fov * Math.PI / 360) / size().h; }

    // Пересечение луча с горизонтальной плоскостью y. У горизонта луч «прижимаем» к плоскости,
    // чтобы точка не улетала в бесконечность и перетаскивание оставалось горизонтальным.
    function planeHit(o, d, y, out) {
      var py = Math.min(y, o.y - 0.25), hy = o.y - py, hl = Math.hypot(d.x, d.z);
      if (hl < 1e-6) return out.set(o.x, py, o.z);
      var maxH = Math.max(40, 3 * radius()), slope = Math.max(-d.y / hl, hy / maxH), dist = hy / slope;
      return out.set(o.x + d.x / hl * dist, py, o.z + d.z / hl * dist);
    }
    function groundAt(nx, ny, y, out) { rayDir(nx, ny, _d); return planeHit(cam.position, _d, y, out); }

    // Точка реальной геометрии под курсором (для центра вращения и масштаба).
    var raycaster = api.Raycaster ? new api.Raycaster() : null;
    function visibleChain(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
    function pickPoint(nx, ny) {
      if (!raycaster || !api.pickables) return null;
      raycaster.setFromCamera({ x: nx, y: ny }, cam);
      raycaster.far = radius() * 3 + 20;
      var hits = raycaster.intersectObjects(api.pickables(), true);
      for (var i = 0; i < hits.length; i++) {
        var h = hits[i], m = h.object.material;
        if (!(h.object.isMesh) || !visibleChain(h.object)) continue;
        if (m && (m.visible === false || (m.transparent && m.opacity < 0.2))) continue;
        if (h.point.y > 4) continue; // крыши, подписи — не центр вращения
        return h.point.clone();
      }
      return null;
    }
    function anchorAt(nx, ny) {
      var p = pickPoint(nx, ny);
      var y = p ? clamp(p.y, 0, 2.2) : 0;
      return { y: y, point: p || groundAt(nx, ny, 0, new V3()) };
    }

    /* ---------- примитивы движения камеры ---------- */
    function translate(dx, dz) { cam.position.x += dx; cam.position.z += dz; target.x += dx; target.z += dz; }
    function clampHard() {
      var nx = clamp(target.x, B.minX, B.maxX), nz = clamp(target.z, B.minZ, B.maxZ);
      if (nx !== target.x || nz !== target.z) translate(nx - target.x, nz - target.z);
    }
    function normalizeTarget() {
      // Центр вращения переносим вдоль луча взгляда на рабочую высоту: вид не меняется.
      _d.copy(target).sub(cam.position).normalize();
      if (_d.y < -0.05) {
        var t = (cam.position.y - cfg.pivotY) / -_d.y;
        if (t > 0.3) target.copy(cam.position).addScaledVector(_d, t);
      }
    }
    function zoomAbout(C, s) {
      var r = radius(), r2 = r * s;
      // предел только ограничивает движение в ту же сторону и никогда не разворачивает его
      r2 = s < 1 ? Math.max(r2, Math.min(r, cfg.rMin)) : Math.min(r2, Math.max(r, cfg.rMax));
      s = r2 / r;
      if (s < 1) { var dc = cam.position.distanceTo(C); if (dc * s < cfg.nearAnchor) s = Math.min(1, cfg.nearAnchor / Math.max(dc, 1e-6)); }
      if (Math.abs(s - 1) < 1e-7) return false;
      cam.position.sub(C).multiplyScalar(s).add(C);
      target.sub(C).multiplyScalar(s).add(C);
      if (cam.position.y < cfg.camMinY) cam.position.y = cfg.camMinY;
      return true;
    }
    function rotY(v, P, a) {
      var x = v.x - P.x, z = v.z - P.z, c = Math.cos(a), s = Math.sin(a);
      v.x = P.x + x * c + z * s; v.z = P.z - x * s + z * c;
    }
    function orbit(P, dTheta, dPhi) {
      if (dTheta) { rotY(cam.position, P, dTheta); rotY(target, P, dTheta); }
      if (dPhi) {
        var s = sph(), phi2 = clamp(s.phi + dPhi, cfg.phiMin, cfg.phiMax), a = phi2 - s.phi;
        if (Math.abs(a) > 1e-7) {
          _a.copy(cam.position); _b.copy(target);
          _axis.set(Math.cos(s.theta), 0, -Math.sin(s.theta));
          _q.setFromAxisAngle(_axis, a);
          cam.position.sub(P).applyQuaternion(_q).add(P);
          target.sub(P).applyQuaternion(_q).add(P);
          if (cam.position.y < cfg.camMinY) { cam.position.copy(_a); target.copy(_b); }
        }
      }
    }
    function setSph(tgt, r, phi, theta) {
      target.copy(tgt);
      var sp = Math.sin(phi);
      cam.position.set(tgt.x + r * sp * Math.sin(theta), tgt.y + r * Math.cos(phi), tgt.z + r * sp * Math.cos(theta));
    }
    function commit(soft) {
      if (!soft) clampHard();
      syncCam();
      written.pos.copy(cam.position); written.tgt.copy(target);
      hudDirty = true;
      api.redraw();
    }

    /* ---------- анимации ---------- */
    var anim = null, wheel = { pending: 0, nx: 0, ny: 0, y: 0, last: 0 }, keys = new Map();

    function cancelMotion() { anim = null; wheel.pending = 0; if (api.cancelFly) api.cancelFly(); }
    function animateSph(to, dur, ease) {
      var s = sph();
      var from = { tgt: target.clone(), r: s.r, phi: s.phi, theta: s.theta };
      to = { tgt: to.tgt || from.tgt, r: to.r != null ? to.r : from.r, phi: to.phi != null ? to.phi : from.phi, theta: to.theta != null ? to.theta : from.theta };
      if (api.cancelFly) api.cancelFly();
      if (reduced || dur <= 0) { setSph(to.tgt, to.r, to.phi, to.theta); commit(); return; }
      var dTheta = wrapAngle(to.theta - from.theta);
      anim = { kind: 'sph', t0: now(), dur: dur * 1000, ease: ease || easeInOutCubic, from: from, to: to, dTheta: dTheta };
      api.redraw();
    }
    function animateZoom(C, factor, dur) {
      if (api.cancelFly) api.cancelFly();
      if (reduced) { zoomAbout(C, factor); normalizeTarget(); commit(); return; }
      anim = { kind: 'zoom', t0: now(), dur: dur * 1000, C: C.clone(), logS: Math.log(factor), done: 0 };
      api.redraw();
    }
    function glideTo(tx, tz, dur) {
      var dx = tx - target.x, dz = tz - target.z;
      animateSph({ tgt: new V3(target.x + dx, target.y, target.z + dz) }, dur == null ? 0.45 : dur, easeOutCubic);
    }
    function stepAnim() {
      if (!anim) return false;
      var t = clamp((now() - anim.t0) / anim.dur, 0, 1), k = anim.ease ? anim.ease(t) : t;
      if (anim.kind === 'sph') {
        var f = anim.from, to = anim.to;
        _p.copy(f.tgt).lerp(to.tgt, k);
        setSph(_p, Math.exp(Math.log(f.r) + (Math.log(to.r) - Math.log(f.r)) * k), f.phi + (to.phi - f.phi) * k, f.theta + anim.dTheta * k);
      } else if (anim.kind === 'zoom') {
        var e = easeOutCubic(t), want = anim.logS * e;
        zoomAbout(anim.C, Math.exp(want - anim.done)); anim.done = want;
        if (t >= 1) normalizeTarget();
      } else if (anim.kind === 'pan') {
        var dist = anim.dist * easeOutQuad(t), step = dist - anim.done; anim.done = dist;
        translate(anim.ux * step, anim.uz * step);
        if (anim.spring) { // вернуть из-за границы плавно
          var bx = clamp(target.x, B.minX, B.maxX) - target.x, bz = clamp(target.z, B.minZ, B.maxZ) - target.z;
          var g = Math.min(1, 0.18 + t * 0.5);
          translate(bx * g, bz * g);
        }
      }
      if (t >= 1) anim = null;
      return true;
    }

    /* ---------- мышь, перо, палец ---------- */
    var pointers = new Map();   // pointerId -> {x,y,x0,y0,t0,type}
    var drag = null;            // текущий жест
    var lastTap = null, lastType = 'mouse', ndc = {};
    var pivotEl = el('div', 'ln-pivot'); root.appendChild(pivotEl);
    var coopEl = el('div', 'ln-coop', '<span>Линию двигайте <b>двумя пальцами</b><br>или откройте <b>⤢ Весь экран</b></span>'); root.appendChild(coopEl);
    var coopTimer = 0;

    function isFs() {
      var fe = document.fullscreenElement || document.webkitFullscreenElement;
      return !!(api.fullscreenEl && (fe === api.fullscreenEl || api.fullscreenEl.classList.contains('ln-pseudo-fs')));
    }
    var coopNow = false;
    function cooperative() { return !isFs() && document.documentElement.scrollHeight > window.innerHeight + 4; }
    function applyTouchAction() { coopNow = cooperative(); canvas.style.touchAction = coopNow ? 'pan-y' : 'none'; }
    function showCoop() {
      coopEl.classList.add('ln-on'); clearTimeout(coopTimer);
      coopTimer = setTimeout(function () { coopEl.classList.remove('ln-on'); }, 1400);
    }

    function showPivot(P) {
      if (!P) { pivotEl.classList.remove('ln-on'); return; }
      _p.copy(P).project(cam);
      var s = size();
      pivotEl.style.transform = 'translate(' + ((_p.x + 1) / 2 * s.w) + 'px,' + ((1 - _p.y) / 2 * s.h) + 'px)';
      pivotEl.classList.add('ln-on');
    }

    function beginPan(clientX, clientY) {
      toNdc(clientX, clientY, ndc); syncCam();
      var an = anchorAt(ndc.x, ndc.y);
      drag = { mode: 'pan', y: an.y, A: groundAt(ndc.x, ndc.y, an.y, new V3()), pos0: cam.position.clone(), tgt0: target.clone(), samples: [] };
      setCursor('grabbing');
    }
    function movePan(clientX, clientY, ts) {
      toNdc(clientX, clientY, ndc);
      rayDir(ndc.x, ndc.y, _d);
      planeHit(drag.pos0, _d, drag.y, _p);
      var rawX = drag.tgt0.x + (drag.A.x - _p.x), rawZ = drag.tgt0.z + (drag.A.z - _p.z);
      var tx = rub(rawX, B.minX, B.maxX, cfg.rubber), tz = rub(rawZ, B.minZ, B.maxZ, cfg.rubber);
      cam.position.set(drag.pos0.x + tx - drag.tgt0.x, drag.pos0.y, drag.pos0.z + tz - drag.tgt0.z);
      target.set(tx, drag.tgt0.y, tz);
      var t = ts || now(); drag.samples.push(t, tx, tz);
      // на слабом устройстве события приходят раз в кадр — окно скорости растягиваем по длительности кадра
      var win = Math.max(120, frameMs() * 3);
      while (drag.samples.length > 6 && t - drag.samples[0] > win) drag.samples.splice(0, 3);
      commit(true);
    }
    function frameMs() { return perf.frame > 0 ? perf.frame * 1000 : 16; }
    function endPan(tUp) {
      var s = drag.samples, t = tUp || now(), n = s.length;
      var out = target.x < B.minX || target.x > B.maxX || target.z < B.minZ || target.z > B.maxZ;
      var vx = 0, vz = 0;
      if (!reduced && n >= 6 && t - s[n - 3] < Math.max(60, frameMs() * 1.5)) {
        var dt = (s[n - 3] - s[0]) / 1000;
        if (dt > 0.012) { vx = (s[n - 2] - s[1]) / dt; vz = (s[n - 1] - s[2]) / dt; }
      }
      var wpp = worldPerPx(), speed = Math.hypot(vx, vz), speedPx = speed / wpp;
      if (speedPx > cfg.inertiaMinPx) {
        var cap = Math.min(1, cfg.inertiaMaxPx / speedPx); speedPx *= cap; speed *= cap;
        var dur = speedPx / cfg.inertiaDecelPx, dist = speed * dur / 2;
        anim = { kind: 'pan', t0: now(), dur: dur * 1000, ux: vx / Math.hypot(vx, vz), uz: vz / Math.hypot(vx, vz), dist: dist, done: 0, spring: true };
        api.redraw();
      } else if (out) {
        anim = { kind: 'pan', t0: now(), dur: 380, ux: 0, uz: 0, dist: 0, done: 0, spring: true };
        api.redraw();
      }
    }

    function beginOrbit(clientX, clientY) {
      toNdc(clientX, clientY, ndc); syncCam();
      var P = pickPoint(ndc.x, ndc.y);
      // Далёкая точка у горизонта даёт резкие размахи — тогда вращаемся вокруг центра экрана.
      if (!P || P.distanceTo(cam.position) > radius() * 2.5) {
        P = groundAt(ndc.x, ndc.y, cfg.pivotY, new V3());
        if (P.distanceTo(cam.position) > radius() * 2.5) P = target.clone();
      }
      drag = { mode: 'orbit', P: P, lx: clientX, ly: clientY };
      setCursor('orbit'); showPivot(P);
    }
    function moveOrbit(clientX, clientY) {
      var h = size().h, dx = clientX - drag.lx, dy = clientY - drag.ly;
      drag.lx = clientX; drag.ly = clientY;
      orbit(drag.P, -TAU * dx / h * 0.8, -Math.PI * dy / h);
      normalizeTarget(); commit(); showPivot(drag.P);
    }

    // Два пальца: точка мира между пальцами остаётся между пальцами (pinned point).
    function twoInfo() {
      var arr = Array.from(pointers.values()), a = arr[0], b = arr[1];
      return { a: a, b: b, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, dist: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    function beginTwo() {
      var i = twoInfo();
      toNdc(i.mx, i.my, ndc); syncCam();
      var an = anchorAt(ndc.x, ndc.y);
      drag = {
        mode: 'two', W: groundAt(ndc.x, ndc.y, an.y, new V3()), y: an.y,
        d0: i.dist, a0: i.ang, ld: i.dist, la: i.ang, minD: i.dist, t0: now(),
        zooming: false, rotating: false, pitch: undefined, firstMove: undefined,
        sa: { x: i.a.x, y: i.a.y }, sb: { x: i.b.x, y: i.b.y }, moved: 0
      };
    }
    function moveTwo() {
      var i = twoInfo(), D = drag;
      D.moved = Math.max(D.moved, Math.hypot(i.a.x - D.sa.x, i.a.y - D.sa.y), Math.hypot(i.b.x - D.sb.x, i.b.y - D.sb.y));
      // Наклон: оба пальца двигаются вертикально в одну сторону (как в MapLibre).
      if (D.pitch === undefined) {
        var va = { x: i.a.x - D.sa.x, y: i.a.y - D.sa.y }, vb = { x: i.b.x - D.sb.x, y: i.b.y - D.sb.y };
        var ma = Math.hypot(va.x, va.y) >= 2, mb = Math.hypot(vb.x, vb.y) >= 2;
        if (ma || mb) {
          if (!ma || !mb) {
            if (D.firstMove === undefined) D.firstMove = now();
            if (now() - D.firstMove >= 100) D.pitch = false;
          } else {
            var vert = Math.abs(va.y) > Math.abs(va.x) && Math.abs(vb.y) > Math.abs(vb.x);
            var flat = Math.abs(D.sb.y - D.sa.y) < Math.abs(D.sb.x - D.sa.x) * 0.9;
            D.pitch = vert && flat && (va.y > 0) === (vb.y > 0) && Math.abs(Math.log(i.dist / D.d0)) < 0.08;
          }
        }
        if (D.pitch === undefined) { D.ld = i.dist; D.la = i.ang; D.lmy = i.my; return; }
      }
      if (D.pitch) {
        var dy = i.my - D.lmy; D.lmy = i.my;
        orbit(target, 0, -dy * 0.5 * Math.PI / 180 * 1.4);
        normalizeTarget(); commit();
        return;
      }
      D.minD = Math.min(D.minD, i.dist);
      if (!D.zooming && Math.abs(Math.log2(i.dist / D.d0)) > 0.1) D.zooming = true;
      var circ = Math.PI * D.minD, thr = 25 / Math.max(circ, 1) * TAU;
      if (!D.rotating && Math.abs(wrapAngle(i.ang - D.a0)) > thr) D.rotating = true;
      if (D.rotating) orbit(D.W, wrapAngle(i.ang - D.la), 0);
      if (D.zooming) zoomAbout(D.W, D.ld / i.dist);
      D.ld = i.dist; D.la = i.ang;
      syncCam();
      toNdc(i.mx, i.my, ndc);
      groundAt(ndc.x, ndc.y, D.y, _p);
      translate(D.W.x - _p.x, D.W.z - _p.z);
      normalizeTarget(); commit();
    }

    function setCursor(c) { c = c || ''; if (root.dataset.lnCursor !== c) root.dataset.lnCursor = c; }

    function onDown(e) {
      if (api.isFlying()) return;
      lastType = e.pointerType;
      if (!pointers.size) { rectCache = null; if (e.pointerType === 'touch') applyTouchAction(); }
      if (e.pointerType === 'mouse' && e.button > 2) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: evTime(e), type: e.pointerType });
      cancelMotion();
      if (e.pointerType === 'touch') {
        if (pointers.size === 2) { try { for (var id of pointers.keys()) canvas.setPointerCapture(id); } catch (_) {} beginTwo(); }
        else if (pointers.size === 1 && !coopNow) { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} beginPan(e.clientX, e.clientY); drag.touch = true; }
        else if (pointers.size > 2) drag = null;
        return;
      }
      if (pointers.size > 1) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      var rot = e.button === 2 || (e.button === 0 && (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey));
      if (rot) beginOrbit(e.clientX, e.clientY); else beginPan(e.clientX, e.clientY);
      drag.id = e.pointerId;
      seen();
    }
    function onMove(e) {
      var p = pointers.get(e.pointerId);
      if (!p) { if (e.pointerType === 'mouse' && !e.buttons && !api.isFlying()) setCursor(''); return; }
      if (e.pointerType === 'mouse' && !e.buttons) { onUp(e); return; }
      p.x = e.clientX; p.y = e.clientY;
      if (api.isFlying()) return;
      if (e.pointerType === 'touch' && pointers.size === 1 && coopNow) {
        if (Math.hypot(p.x - p.x0, p.y - p.y0) > cfg.tapMove) showCoop();
        return;
      }
      if (!drag) return;
      if (drag.mode === 'two') { if (pointers.size >= 2) moveTwo(); return; }
      if (drag.mode === 'pan') movePan(e.clientX, e.clientY, evTime(e));
      else if (drag.mode === 'orbit') moveOrbit(e.clientX, e.clientY);
    }
    function onUp(e) {
      var p = pointers.get(e.pointerId);
      if (!p) return;
      pointers.delete(e.pointerId);
      var cancelled = e.type === 'pointercancel', tUp = evTime(e);
      var tap = !cancelled && Math.hypot(p.x - p.x0, p.y - p.y0) < cfg.tapMove && tUp - p.t0 < 300;
      if (drag && drag.mode === 'two') {
        if (!cancelled && pointers.size === 1 && drag.moved < cfg.tapMove && now() - drag.t0 < 300) {
          var o = pointers.values().next().value;
          toNdc((o.x + p.x) / 2, (o.y + p.y) / 2, ndc); syncCam();
          animateZoom(groundAt(ndc.x, ndc.y, 0, new V3()), 2, 0.35); // касание двумя пальцами — отдалить
          drag = { mode: 'none' }; return;
        }
        if (pointers.size === 1) {
          var rest = pointers.values().next().value;
          if (!coopNow) { beginPan(rest.x, rest.y); drag.touch = true; } else drag = null;
        } else if (pointers.size === 0) drag = null;
        normalizeTarget(); commit();
        return;
      }
      if (drag && drag.mode === 'none') { if (!pointers.size) drag = null; return; }
      if (drag && pointers.size === 0) {
        normalizeTarget();
        if (drag.mode === 'pan') { if (cancelled) drag.samples.length = 0; endPan(tUp); }
        commit(!!anim);
        if (drag.mode === 'orbit') showPivot(null);
        drag = null; setCursor('');
      }
      if (tap && p.type === 'touch' && !cancelled) {
        var t = tUp;
        if (lastTap && t - lastTap.t < cfg.dblTapMs && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
          lastTap = null; dblZoom(p.x, p.y, false);
        } else lastTap = { t: t, x: p.x, y: p.y };
      }
    }
    function dblZoom(clientX, clientY, out) {
      toNdc(clientX, clientY, ndc); syncCam();
      if (!out && api.hitsInteractive && api.hitsInteractive(ndc.x, ndc.y)) return; // пост уже открылся кликом
      var an = anchorAt(ndc.x, ndc.y);
      animateZoom(groundAt(ndc.x, ndc.y, an.y, new V3()), out ? 2 : 0.5, 0.4);
      seen();
    }

    // Колесо и тачпад (логика классификации — по MapLibre scroll_zoom).
    function onWheel(e) {
      if (api.isFlying()) return;
      e.preventDefault();
      var v = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY;
      if (!v) return;
      var t = now();
      toNdc(e.clientX, e.clientY, ndc);
      if (t - wheel.last > 300) { rectCache = null; toNdc(e.clientX, e.clientY, ndc); }
      if (t - wheel.last > 300 || Math.abs(ndc.x - wheel.nx) + Math.abs(ndc.y - wheel.ny) > 0.08) {
        syncCam(); anim = null; if (api.cancelFly) api.cancelFly();
        wheel.y = anchorAt(ndc.x, ndc.y).y;
      }
      wheel.last = t; wheel.nx = ndc.x; wheel.ny = ndc.y;
      var isWheel = !e.ctrlKey && (Math.abs(v) >= 50 || v % 4.000244140625 === 0);
      var lv = clamp(-v * (isWheel ? cfg.wheelRate : cfg.trackpadRate), -1, 1);
      if (reduced || !isWheel) {
        syncCam(); zoomAbout(groundAt(ndc.x, ndc.y, wheel.y, _a), Math.pow(2, -lv)); normalizeTarget(); commit();
      } else { wheel.pending = clamp(wheel.pending + lv, -3, 3); api.redraw(); }
      seen();
    }
    function stepWheel(dt) {
      if (Math.abs(wheel.pending) < 1e-4) { wheel.pending = 0; return false; }
      var step = wheel.pending * (1 - Math.exp(-dt / cfg.wheelSmooth));
      if (Math.abs(wheel.pending) < 0.003) step = wheel.pending;
      wheel.pending -= step;
      syncCam();
      if (!zoomAbout(groundAt(wheel.nx, wheel.ny, wheel.y, _a), Math.pow(2, -step))) wheel.pending = 0;
      normalizeTarget();
      return true;
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('lostpointercapture', function (e) { if (pointers.has(e.pointerId) && e.pointerType !== 'mouse') onUp(e); });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { if (!api.isFlying()) e.preventDefault(); });
    canvas.addEventListener('dblclick', function (e) { if (api.isFlying() || lastType === 'touch') return; e.preventDefault(); dblZoom(e.clientX, e.clientY, e.shiftKey); });

    /* ---------- клавиатура ---------- */
    var KEYMAP = {
      ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r',
      KeyQ: 'rotL', KeyE: 'rotR', Equal: 'in', NumpadAdd: 'in', Minus: 'out', NumpadSubtract: 'out'
    };
    function keyAction(e) {
      var a = KEYMAP[e.code];
      if (!a && (e.key === '+' || e.key === '=')) a = 'in';
      if (!a && e.key === '-') a = 'out';
      if (e.shiftKey && a) a = { f: 'tiltUp', b: 'tiltDown', l: 'rotL', r: 'rotR' }[a] || a;
      return a;
    }
    root.addEventListener('keydown', function (e) {
      if (api.isFlying() || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target !== root && e.target !== canvas && e.target !== railTrack) return;
      var a = keyAction(e);
      if (a) {
        e.preventDefault();
        if (!e.repeat || !keys.has(a)) { keys.set(a, { t0: now(), up: 0 }); cancelMotion(); api.redraw(); }
        seen();
        return;
      }
      var handled = true;
      switch (e.code) {
        case 'BracketLeft': case 'Comma': case 'PageUp': stepPost(-1); break;
        case 'BracketRight': case 'Period': case 'PageDown': stepPost(1); break;
        case 'Home': case 'Digit0': case 'Numpad0': fitAll(); break;
        case 'KeyR': resetNorth(); break;
        case 'KeyT': toggle2D(); break;
        case 'KeyM': toggleMap(); break;
        case 'KeyH': case 'Slash': toggleHelp(); break;
        case 'Escape': if (help.hidden) handled = false; else toggleHelp(); break;
        default: handled = false;
      }
      if (handled) e.preventDefault();
    });
    root.addEventListener('keyup', function (e) {
      var a = keyAction(e), alt = KEYMAP[e.code];
      [a, alt, alt && { f: 'tiltUp', b: 'tiltDown', l: 'rotL', r: 'rotR' }[alt]].forEach(function (k) { var s = k && keys.get(k); if (s) s.up = now(); });
    });
    window.addEventListener('blur', function () { keys.clear(); });
    root.addEventListener('focusout', function () { keys.clear(); });

    function stepKeys(dt) {
      if (!keys.size) return false;
      var t = now(), s = sph(), wpp = worldPerPx(), d = cfg.keyPanPx * wpp * dt;
      var fx = -Math.sin(s.theta), fz = -Math.cos(s.theta), rx = Math.cos(s.theta), rz = -Math.sin(s.theta);
      var mx = 0, mz = 0, rot = 0, tilt = 0, zoom = 0, done = [];
      keys.forEach(function (st, a) {
        // сначала движение за прошедший кадр, потом снимаем отпущенную клавишу (важно при редких кадрах)
        if (st.up && t - st.t0 >= cfg.keyMinHold) done.push(a);
        if (a === 'f') { mx += fx; mz += fz; } else if (a === 'b') { mx -= fx; mz -= fz; }
        else if (a === 'l') { mx -= rx; mz -= rz; } else if (a === 'r') { mx += rx; mz += rz; }
        else if (a === 'rotL') rot -= 1; else if (a === 'rotR') rot += 1;
        else if (a === 'tiltUp') tilt -= 1; else if (a === 'tiltDown') tilt += 1;
        else if (a === 'in') zoom -= 1; else if (a === 'out') zoom += 1;
      });
      var m = Math.hypot(mx, mz);
      if (m) translate(mx / m * d, mz / m * d);
      if (rot || tilt) orbit(target, rot * cfg.keyRotate * dt, tilt * cfg.keyTilt * dt);
      if (zoom) zoomAbout(target, Math.pow(2, zoom * cfg.keyZoom * dt));
      if (rot || tilt || zoom) normalizeTarget();
      done.forEach(function (a) { keys.delete(a); });
      return keys.size > 0;
    }

    /* ---------- кадр ---------- */
    var lastTick = now(), hudDirty = true, hudSig = '';
    var perf = { ema: 0, n: 0, degraded: false, needLow: false, basePR: api.renderer.getPixelRatio(), timer: 0, frame: 0, skip: 0, emaFull: 0, useless: false, hudMs: 0, tickMs: 0, ticks: 0 };

    function tick() {
      var t = now(), raw = (t - lastTick) / 1000; lastTick = t;
      if (api.isFlying()) { anim = null; wheel.pending = 0; keys.clear(); drag = null; pointers.clear(); written.pos.copy(cam.position); written.tgt.copy(target); hudDirty = true; updateHud(); return false; }
      if (cam.position.distanceToSquared(written.pos) > 1e-10 || target.distanceToSquared(written.tgt) > 1e-10) {
        // Камеру сдвинул кто-то ещё (кнопки видов, клик по посту) — наши анимации уступают.
        if (!drag) { anim = null; wheel.pending = 0; }
        hudDirty = true;
      }
      var busy = false, dm = raw > 0.25 ? 1 / 60 : Math.min(raw, 0.1); // скорость не зависит от частоты кадров; после простоя — обычный шаг
      if (stepAnim()) busy = true;
      if (stepWheel(dm)) busy = true;
      if (stepKeys(dm)) busy = true;
      if (busy) { clampHard(); syncCam(); hudDirty = true; }
      written.pos.copy(cam.position); written.tgt.copy(target);
      adapt(raw, busy || !!drag);
      var th = now();
      updateHud(busy || !!drag);
      perf.hudMs += now() - th; perf.tickMs += now() - t; perf.ticks++;
      return busy;
    }

    // Адаптивное качество: на слабом железе во время движения рисуем в меньшем разрешении.
    // Регулятор проверяет, помогло ли понижение: если кадр не стал быстрее хотя бы на 15 %
    // (упор не в пиксели), возвращает полное разрешение и больше не переключает холст.
    function setLow(on) {
      perf.degraded = on;
      api.renderer.setPixelRatio(on ? Math.max(0.6, perf.basePR * 0.6) : perf.basePR);
      api.renderer.shadowMap.autoUpdate = !on;
      if (!on) api.renderer.shadowMap.needsUpdate = true;
      root.classList.toggle('ln-lowres', on);
    }
    function adapt(dt, moving) {
      if (moving && dt > 0.004 && dt < 0.5) perf.frame = perf.frame ? perf.frame * 0.7 + dt * 0.3 : dt; // для инерции
      if (perf.useless) return;
      if (moving) {
        clearTimeout(perf.timer); perf.timer = 0;
        if (perf.skip > 0) { perf.skip--; return; } // кадр сразу после смены разрешения не показателен
        if (dt > 0.004 && dt < 0.5) { perf.ema = perf.n ? perf.ema * 0.7 + dt * 0.3 : dt; perf.n++; }
        if (!perf.degraded && (perf.needLow || (perf.n > 4 && perf.ema > cfg.slowFrame))) {
          if (!perf.needLow) perf.emaFull = perf.ema;
          perf.needLow = true; perf.n = 0; perf.skip = 2;
          setLow(true);
        } else if (perf.degraded && perf.emaFull && perf.n >= 6) {
          if (perf.ema > perf.emaFull * 0.85) { perf.useless = true; setLow(false); api.redraw(); }
          perf.emaFull = 0;
        }
      } else if (perf.degraded && !perf.timer) {
        perf.timer = setTimeout(function () { perf.timer = 0; perf.n = 0; setLow(false); api.redraw(); }, 450);
      } else if (!perf.degraded) perf.n = 0;
    }

    /* ---------- станции и линия ---------- */
    var posts = api.posts(); // [{id,x,z,side,brig}] в порядке потока
    var flow = posts.filter(function (p) { return !p.side; }).sort(function (a, b) { return a.x - b.x; });
    var X0 = flow[0].x - 1.6, X1 = flow[flow.length - 1].x + 1.6;
    function pathZ(x) {
      if (x <= flow[0].x) return flow[0].z;
      for (var i = 1; i < flow.length; i++) {
        if (x <= flow[i].x) { var a = flow[i - 1], b = flow[i]; return a.z + (b.z - a.z) * (x - a.x) / (b.x - a.x || 1); }
      }
      return flow[flow.length - 1].z;
    }
    function loadColor(v) { return !(v > 0) ? '#475569' : v > api.takt ? '#ef4444' : '#22c55e'; }

    function moveAlongTo(x, dur) {
      x = clamp(x, X0, X1);
      var lateral = target.z - pathZ(target.x);
      lateral = clamp(lateral, -6, 6);
      if (dur === 0) { translate(x - target.x, pathZ(x) + lateral - target.z); commit(); }
      else glideTo(x, pathZ(x) + lateral, dur);
    }
    function nearestFlowIndex(x) {
      var best = 0;
      for (var i = 1; i < flow.length; i++) if (Math.abs(flow[i].x - x) < Math.abs(flow[best].x - x)) best = i;
      return best;
    }
    function stepPost(dir) {
      var x = target.x, i;
      if (dir > 0) { for (i = 0; i < flow.length && flow[i].x <= x + 0.8; i++); i = Math.min(i, flow.length - 1); }
      else { for (i = flow.length - 1; i >= 0 && flow[i].x >= x - 0.8; i--); i = Math.max(i, 0); }
      goPost(flow[i].id);
    }
    function goPost(id) {
      var p = posts.find(function (q) { return q.id === id; });
      if (!p) return;
      api.selectPost(id);
      var lateral = clamp(target.z - pathZ(target.x), -6, 6);
      glideTo(p.x, (p.side ? p.z : pathZ(p.x)) + (p.side ? 0 : lateral), 0.55);
      seen();
    }
    function fitAll() { api.fitAll(); seen(); }
    function resetNorth() { animateSph({ theta: 0 }, 0.6); seen(); }
    function toggle2D() { var s = sph(); animateSph(s.phi < 0.3 ? { phi: 0.95 } : { phi: cfg.phiMin + 0.01, theta: s.theta }, 0.6); seen(); }
    function zoomBtn(f) { syncCam(); animateZoom(target.clone(), f, 0.3); seen(); }

    /* ---------- интерфейс: полоса линии, мини-карта, кнопки ---------- */
    var ui = el('div', 'ln-ui'); root.appendChild(ui);

    // Полоса «по линии»: посты в порядке потока, видимая часть, центр взгляда.
    var rail = el('div', 'ln-rail');
    rail.innerHTML = '<button class="ln-rb" data-a="prev" title="Предыдущий пост ( [ )" aria-label="Предыдущий пост">‹</button>' +
      '<div class="ln-track" tabindex="0" role="slider" aria-label="Положение взгляда вдоль линии"><div class="ln-segs"></div><div class="ln-win"></div><div class="ln-ticks"></div><div class="ln-cur"></div><div class="ln-rtip" hidden></div></div>' +
      '<button class="ln-rb" data-a="next" title="Следующий пост ( ] )" aria-label="Следующий пост">›</button>';
    ui.appendChild(rail);
    var railTrack = rail.querySelector('.ln-track'), railWin = rail.querySelector('.ln-win'), railCur = rail.querySelector('.ln-cur'), railTip = rail.querySelector('.ln-rtip');
    function xToPct(x) { return (x - X0) / (X1 - X0) * 100; }
    var segHtml = '', tickHtml = '';
    api.brigades.forEach(function (b) {
      var ps = posts.filter(function (p) { return p.brig === b.id && !p.side; });
      if (!ps.length) return;
      var a = xToPct(ps[0].x - 1.2), w = xToPct(ps[ps.length - 1].x + 1.2) - a;
      segHtml += '<div class="ln-seg" style="left:' + a + '%;width:' + w + '%;--c:' + b.color + '"><span>' + b.label + '</span></div>';
    });
    posts.forEach(function (p) {
      tickHtml += '<i class="ln-tick' + (p.side ? ' ln-side' : '') + (p.accent ? ' ln-acc' : '') + '" data-id="' + p.id + '" style="left:' + xToPct(p.x) + '%"></i>';
    });
    rail.querySelector('.ln-segs').innerHTML = segHtml;
    rail.querySelector('.ln-ticks').innerHTML = tickHtml;
    var tickEls = {};
    rail.querySelectorAll('.ln-tick').forEach(function (t) { tickEls[t.dataset.id] = t; });
    rail.querySelector('[data-a=prev]').addEventListener('click', function () { stepPost(-1); });
    rail.querySelector('[data-a=next]').addEventListener('click', function () { stepPost(1); });

    function railX(clientX) { var r = railTrack.getBoundingClientRect(); return X0 + clamp((clientX - r.left) / r.width, 0, 1) * (X1 - X0); }
    function tickAt(clientX) {
      var r = railTrack.getBoundingClientRect(), best = null, bd = 1e9;
      posts.forEach(function (p) { if (p.side) return; var px = r.left + xToPct(p.x) / 100 * r.width, d = Math.abs(px - clientX); if (d < bd) { bd = d; best = p; } });
      return bd <= Math.max(7, r.width / flow.length / 2) ? best : null;
    }
    var railDrag = null;
    railTrack.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      e.preventDefault(); railTrack.focus({ preventScroll: true }); cancelMotion();
      railTrack.setPointerCapture(e.pointerId);
      var wr = railWin.getBoundingClientRect(), inWin = e.clientX >= wr.left - 2 && e.clientX <= wr.right + 2;
      railDrag = { x0: e.clientX, moved: false, off: inWin ? target.x - railX(e.clientX) : 0, inWin: inWin };
      railTrack.classList.add('ln-drag');
    });
    railTrack.addEventListener('pointermove', function (e) {
      if (!railDrag) { var p = tickAt(e.clientX); showRailTip(p, e.clientX); return; }
      if (!railDrag.moved && Math.abs(e.clientX - railDrag.x0) < 4) return;
      if (!railDrag.moved) { railDrag.moved = true; if (!railDrag.inWin) railDrag.off = 0; }
      showRailTip(null);
      moveAlongTo(railX(e.clientX) + railDrag.off, 0);
    });
    function railUp(e) {
      if (!railDrag) return;
      var d = railDrag; railDrag = null; railTrack.classList.remove('ln-drag');
      if (e.type === 'pointercancel' || d.moved) return;
      var p = tickAt(e.clientX);
      if (p) goPost(p.id); else moveAlongTo(railX(e.clientX), 0.45);
    }
    railTrack.addEventListener('pointerup', railUp);
    railTrack.addEventListener('pointercancel', railUp);
    railTrack.addEventListener('pointerleave', function () { if (!railDrag) showRailTip(null); });
    railTrack.addEventListener('dblclick', function (e) { var p = tickAt(e.clientX); if (p) api.focusPost(p.id); });
    railTrack.addEventListener('keydown', function (e) {
      var step = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1 }[e.code];
      if (step) { e.preventDefault(); e.stopPropagation(); moveAlongTo(target.x + step * (e.shiftKey ? 8.4 : 2.8), 0.3); }
      else if (e.code === 'Home') { e.preventDefault(); e.stopPropagation(); moveAlongTo(X0, 0.5); }
      else if (e.code === 'End') { e.preventDefault(); e.stopPropagation(); moveAlongTo(X1, 0.5); }
      else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); goPost(flow[nearestFlowIndex(target.x)].id); }
    });
    railTrack.addEventListener('wheel', function (e) {
      e.preventDefault();
      var v = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * (e.deltaMode === 1 ? 40 : 1);
      moveAlongTo(target.x + v * (X1 - X0) / 2400, 0);
    }, { passive: false });
    function showRailTip(p, clientX) {
      if (!p) { railTip.hidden = true; return; }
      var v = api.load(p.id), r = railTrack.getBoundingClientRect();
      railTip.innerHTML = '<b>' + p.id + '</b> ' + (v > 0 ? Math.round(v) + ' смин' : 'нет работы') + (v > api.takt ? ' · выше такта' : '');
      railTip.style.color = loadColor(v);
      railTip.hidden = false;
      railTip.style.left = clamp(xToPct(p.x) / 100 * r.width, 30, r.width - 30) + 'px';
    }

    // Мини-карта: вид сверху, посты по загрузке, трапеция поля зрения; клик/тяга — перейти.
    var map = el('div', 'ln-map'); map.innerHTML = '<canvas aria-label="Мини-карта линии: нажмите, чтобы перейти"></canvas>';
    ui.appendChild(map);
    var mapCv = map.firstChild, mapCtx = mapCv.getContext('2d');
    var MB = { minX: B.minX - 2, maxX: B.maxX + 2, minZ: B.minZ - 2, maxZ: B.maxZ + 2 };
    var mapView = { s: 1, ox: 0, oy: 0, w: 0, h: 0 };
    var mapOn = true, rootW = root.clientWidth;
    try { var st = localStorage.getItem('ln-map'); mapOn = st ? st === '1' : root.clientWidth >= 640; } catch (_) { mapOn = root.clientWidth >= 640; }
    function layoutMap() {
      var w = Math.round(clamp(rootW * 0.3, 150, 280)), h = Math.round(w * (MB.maxZ - MB.minZ) / (MB.maxX - MB.minX));
      h = clamp(h, 50, 120);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      mapCv.style.width = w + 'px'; mapCv.style.height = h + 'px';
      mapCv.width = Math.round(w * dpr); mapCv.height = Math.round(h * dpr);
      var s = Math.min(w / (MB.maxX - MB.minX), h / (MB.maxZ - MB.minZ));
      mapView = { s: s, ox: (w - (MB.maxX - MB.minX) * s) / 2, oy: (h - (MB.maxZ - MB.minZ) * s) / 2, w: w, h: h, dpr: dpr };
      map.classList.toggle('ln-off', !mapOn);
      hudDirty = true;
    }
    function mx(x) { return mapView.ox + (x - MB.minX) * mapView.s; }
    function my(z) { return mapView.oy + (z - MB.minZ) * mapView.s; }
    var corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]], fp = [new V3(), new V3(), new V3(), new V3()];
    function drawMap() {
      if (!mapOn) return;
      var c = mapCtx, v = mapView;
      c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      c.clearRect(0, 0, v.w, v.h);
      c.fillStyle = 'rgba(14,19,27,.88)'; c.fillRect(0, 0, v.w, v.h);
      c.strokeStyle = '#334155'; c.lineWidth = 1; c.strokeRect(mx(B.minX), my(B.minZ), (B.maxX - B.minX) * v.s, (B.maxZ - B.minZ) * v.s);
      // путь потока
      c.strokeStyle = '#64748b'; c.lineWidth = Math.max(1.5, v.s * 0.9); c.lineJoin = 'round';
      c.beginPath(); flow.forEach(function (p, i) { i ? c.lineTo(mx(p.x), my(p.z)) : c.moveTo(mx(p.x), my(p.z)); }); c.stroke();
      api.brigades.forEach(function (b) {
        var ps = flow.filter(function (p) { return p.brig === b.id; });
        if (!ps.length) return;
        c.strokeStyle = b.color; c.globalAlpha = 0.55; c.lineWidth = Math.max(3, v.s * 2.2);
        c.beginPath(); c.moveTo(mx(ps[0].x - 1), my(ps[0].z)); c.lineTo(mx(ps[ps.length - 1].x + 1), my(ps[ps.length - 1].z)); c.stroke();
        c.globalAlpha = 1;
        c.fillStyle = b.color; c.font = '600 10px system-ui,sans-serif'; c.textBaseline = 'bottom';
        c.fillText(b.id, mx(ps[0].x - 1), my(ps[0].z) - v.s * 1.6);
      });
      var sel = api.selected();
      posts.forEach(function (p) {
        var r = Math.max(1.6, v.s * 0.7);
        c.fillStyle = loadColor(api.load(p.id));
        c.beginPath(); c.arc(mx(p.x), my(p.z), r, 0, TAU); c.fill();
        if (p.id === sel) { c.strokeStyle = '#f8fafc'; c.lineWidth = 1.5; c.beginPath(); c.arc(mx(p.x), my(p.z), r + 2.5, 0, TAU); c.stroke(); }
      });
      // поле зрения
      syncCam();
      for (var i = 0; i < 4; i++) groundAt(corners[i][0], corners[i][1], 0, fp[i]);
      c.fillStyle = 'rgba(248,250,252,.13)'; c.strokeStyle = 'rgba(248,250,252,.85)'; c.lineWidth = 1.2;
      c.beginPath(); for (i = 0; i < 4; i++) { i ? c.lineTo(mx(fp[i].x), my(fp[i].z)) : c.moveTo(mx(fp[i].x), my(fp[i].z)); } c.closePath(); c.fill(); c.stroke();
      var cx = mx(cam.position.x), cy = my(cam.position.z);
      c.fillStyle = '#ff2400'; c.beginPath(); c.arc(cx, cy, 3, 0, TAU); c.fill();
      c.strokeStyle = '#ff2400'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(mx(target.x), my(target.z)); c.stroke();
    }
    function mapWorld(e) {
      var r = mapCv.getBoundingClientRect();
      return { x: MB.minX + (e.clientX - r.left - mapView.ox) / mapView.s, z: MB.minZ + (e.clientY - r.top - mapView.oy) / mapView.s };
    }
    var mapDrag = null;
    mapCv.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      e.preventDefault(); cancelMotion(); mapCv.setPointerCapture(e.pointerId);
      mapDrag = { x0: e.clientX, y0: e.clientY, moved: false };
    });
    mapCv.addEventListener('pointermove', function (e) {
      if (!mapDrag) return;
      if (!mapDrag.moved && Math.hypot(e.clientX - mapDrag.x0, e.clientY - mapDrag.y0) < 3) return;
      mapDrag.moved = true;
      var w = mapWorld(e); translate(clamp(w.x, B.minX, B.maxX) - target.x, clamp(w.z, B.minZ, B.maxZ) - target.z); commit();
    });
    function mapUp(e) {
      if (!mapDrag) return;
      var d = mapDrag; mapDrag = null;
      if (e.type === 'pointercancel' || d.moved) return;
      var w = mapWorld(e); glideTo(clamp(w.x, B.minX, B.maxX), clamp(w.z, B.minZ, B.maxZ), 0.45); seen();
    }
    mapCv.addEventListener('pointerup', mapUp);
    mapCv.addEventListener('pointercancel', mapUp);
    mapCv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var v = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      syncCam(); zoomAbout(target.clone(), Math.pow(2, clamp(v / 300, -1, 1))); normalizeTarget(); commit();
    }, { passive: false });

    // Кнопки справа: масштаб, компас, 2D/3D, вся линия, карта, справка.
    var tools = el('div', 'ln-tools');
    tools.innerHTML =
      '<button data-a="in" title="Приблизить (+)" aria-label="Приблизить">+</button>' +
      '<button data-a="out" title="Отдалить (−)" aria-label="Отдалить">−</button>' +
      '<button data-a="north" class="ln-compass" title="Развернуть: поток слева направо (R)" aria-label="Развернуть вид вдоль потока"><svg viewBox="0 0 24 24" width="22" height="22"><g class="ln-needle"><path d="M4 12h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M14 7l6 5-6 5z" fill="#ff2400"/></g></svg></button>' +
      '<button data-a="tilt" title="Вид сверху / 3D (T)" aria-label="Переключить вид сверху и 3D">2D</button>' +
      '<button data-a="home" title="Вся линия (Home)" aria-label="Показать всю линию">⌂</button>' +
      '<button data-a="map" title="Мини-карта (M)" aria-label="Мини-карта" aria-pressed="false">▦</button>' +
      '<button data-a="help" title="Управление (H)" aria-label="Справка по управлению" aria-pressed="false">?</button>';
    ui.appendChild(tools);
    var needle = tools.querySelector('.ln-needle'), tiltBtn = tools.querySelector('[data-a=tilt]'), mapBtn = tools.querySelector('[data-a=map]'), helpBtn = tools.querySelector('[data-a=help]');
    // Клавиши на собственных кнопках не должны доходить до горячих клавиш сцены (Пробел = конвейер).
    ui.addEventListener('keydown', function (e) { if (e.target !== railTrack) e.stopPropagation(); });
    tools.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.dataset.a;
      if (a !== 'help') root.focus({ preventScroll: true });
      if (a === 'in') zoomBtn(0.5); else if (a === 'out') zoomBtn(2);
      else if (a === 'north') resetNorth(); else if (a === 'tilt') toggle2D(); else if (a === 'home') fitAll();
      else if (a === 'map') toggleMap(); else if (a === 'help') toggleHelp();
    });
    function toggleMap() {
      mapOn = !mapOn; try { localStorage.setItem('ln-map', mapOn ? '1' : '0'); } catch (_) {}
      map.classList.toggle('ln-off', !mapOn); mapBtn.setAttribute('aria-pressed', mapOn); hudDirty = true; api.redraw();
    }

    var help = el('div', 'ln-help');
    help.hidden = true;
    help.innerHTML = '<button class="ln-x" aria-label="Закрыть">×</button><b>Управление</b>' +
      '<div class="ln-cols"><div><i>Мышь</i>' +
      '<p><kbd>ЛКМ</kbd> тянуть — двигать линию</p><p><kbd>ПКМ</kbd> или <kbd>Shift</kbd>+<kbd>ЛКМ</kbd> — вращать вокруг точки</p>' +
      '<p><kbd>Колесо</kbd> — масштаб к курсору</p><p><kbd>Двойной клик</kbd> — приблизить, <kbd>Shift</kbd> — отдалить</p>' +
      '<p>Клик по посту — открыть пост</p></div>' +
      '<div><i>Клавиши (курсор в окне модели)</i>' +
      '<p><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> / <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> — двигаться</p>' +
      '<p><kbd>Q</kbd><kbd>E</kbd> или <kbd>Shift</kbd>+<kbd>←</kbd><kbd>→</kbd> — вращать · <kbd>Shift</kbd>+<kbd>↑</kbd><kbd>↓</kbd> — наклон</p>' +
      '<p><kbd>+</kbd><kbd>−</kbd> — масштаб · <kbd>[</kbd><kbd>]</kbd> — пред./след. пост</p>' +
      '<p><kbd>Home</kbd> — вся линия · <kbd>R</kbd> — вдоль потока · <kbd>T</kbd> — 2D/3D · <kbd>M</kbd> — карта · <kbd>G</kbd> — полёт</p></div>' +
      '<div><i>Сенсорный экран</i>' +
      '<p>Два пальца: двигать, щипок — масштаб, поворот — вращать</p><p>Два пальца вверх/вниз — наклон</p>' +
      '<p>Двойное касание — приблизить, касание двумя — отдалить</p><p>В режиме «Весь экран» линию двигает один палец</p></div></div>' +
      '<p class="ln-foot">Полоса внизу — линия в порядке потока: тяните окно, нажмите на пост или используйте ‹ ›.</p>';
    ui.appendChild(help);
    help.querySelector('.ln-x').addEventListener('click', toggleHelp);
    function toggleHelp() { help.hidden = !help.hidden; helpBtn.setAttribute('aria-pressed', !help.hidden); }

    function seen() {
      if (root.classList.contains('ln-seen')) return;
      root.classList.add('ln-seen'); try { localStorage.setItem('ln-seen', '1'); } catch (_) {}
    }
    try { if (localStorage.getItem('ln-seen')) root.classList.add('ln-seen'); } catch (_) {}

    var _ndcP = new V3(), hudAt = 0, hudTimer = 0, tickState = {};
    function setTick(id, bg, vis, sel, gone) {
      var t = tickEls[id], k = bg + (vis ? 1 : 0) + (sel ? 1 : 0) + (gone ? 1 : 0), o = tickState[id];
      if (o === k) return;
      tickState[id] = k;
      t.style.background = bg; t.classList.toggle('ln-vis', vis); t.classList.toggle('ln-sel', sel); t.classList.toggle('ln-gone', gone);
    }
    function updateHud(moving) {
      var tn = now();
      // во время движения полосу и карту обновляем ~12 раз/с, в покое — сразу
      if (moving && tn - hudAt < 80) {
        if (!hudTimer) hudTimer = setTimeout(function () { hudTimer = 0; updateHud(false); }, 90);
        return;
      }
      var s = sph();
      var sig = cam.position.x.toFixed(3) + cam.position.y.toFixed(3) + cam.position.z.toFixed(3) + target.x.toFixed(3) + target.z.toFixed(3) + '|' + api.mode() + '|' + api.selected() + '|' + size().w + 'x' + size().h;
      if (!hudDirty && sig === hudSig) return;
      hudDirty = false; hudSig = sig; hudAt = tn;
      needle.setAttribute('transform', 'rotate(' + (s.theta * 180 / Math.PI) + ' 12 12)');
      tiltBtn.textContent = s.phi < 0.3 ? '3D' : '2D';
      // рельс: какие посты сейчас в кадре
      syncCam();
      var lo = Infinity, hi = -Infinity, sel = api.selected();
      posts.forEach(function (p) {
        _ndcP.set(p.x, 1, p.z).project(cam);
        var vis = _ndcP.z < 1 && Math.abs(_ndcP.x) <= 1 && Math.abs(_ndcP.y) <= 1;
        var v = api.load(p.id);
        setTick(p.id, loadColor(v), vis, p.id === sel, !(v > 0));
        if (vis && !p.side) { lo = Math.min(lo, p.x - 1.4); hi = Math.max(hi, p.x + 1.4); }
      });
      if (lo < hi) { railWin.style.display = ''; railWin.style.left = xToPct(Math.max(lo, X0)) + '%'; railWin.style.width = (xToPct(Math.min(hi, X1)) - xToPct(Math.max(lo, X0))) + '%'; }
      else railWin.style.display = 'none';
      var cx = clamp(target.x, X0, X1);
      railCur.style.left = xToPct(cx) + '%';
      var near = flow[nearestFlowIndex(target.x)];
      railTrack.setAttribute('aria-valuemin', X0.toFixed(1)); railTrack.setAttribute('aria-valuemax', X1.toFixed(1));
      railTrack.setAttribute('aria-valuenow', cx.toFixed(1)); railTrack.setAttribute('aria-valuetext', 'у поста ' + near.id);
      drawMap();
    }

    /* ---------- полноэкранный режим и размеры ---------- */
    if (api.fsButton && api.fullscreenEl) {
      // iPhone Safari не умеет Fullscreen API для блоков. Если после нажатия браузер так и не
      // перешёл в полноэкранный режим, разворачиваем окно модели на всю страницу сами.
      var fsEl = api.fullscreenEl, fsBtn = api.fsButton;
      var setPseudo = function (on) {
        fsEl.classList.toggle('ln-pseudo-fs', on);
        document.documentElement.classList.toggle('ln-noscroll', on);
        fsBtn.setAttribute('aria-pressed', on);
        fsBtn.textContent = on ? '⤡ Выйти из полного экрана' : '⤢ Весь экран';
        applyTouchAction(); api.redraw();
      };
      fsBtn.addEventListener('click', function () {
        if (fsEl.classList.contains('ln-pseudo-fs')) { setPseudo(false); return; }
        if (document.fullscreenElement || document.webkitFullscreenElement) return;
        var noApi = !(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
        if (noApi) { setPseudo(true); return; }
        setTimeout(function () { if (!document.fullscreenElement && !document.webkitFullscreenElement) setPseudo(true); }, 350);
      });
      document.addEventListener('keydown', function (e) { if (e.code === 'Escape' && fsEl.classList.contains('ln-pseudo-fs')) setPseudo(false); });
    }
    // touch-action должен смениться до следующего касания: перепроверяем и через кадр после смены режима
    var onFs = function () { applyTouchAction(); requestAnimationFrame(applyTouchAction); setTimeout(applyTouchAction, 300); };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    new ResizeObserver(function () { sz = { w: canvas.clientWidth || 1, h: canvas.clientHeight || 1 }; rectCache = null; rootW = root.clientWidth; layoutMap(); applyTouchAction(); api.redraw(); }).observe(root);
    window.addEventListener('resize', applyTouchAction);
    layoutMap(); applyTouchAction(); mapBtn.setAttribute('aria-pressed', mapOn);
    normalizeTarget(); syncCam(); written.pos.copy(cam.position); written.tgt.copy(target);
    api.redraw();

    var self = {
      cfg: cfg, glideTo: glideTo, moveAlongTo: moveAlongTo, stepPost: stepPost, goPost: goPost, fitAll: fitAll,
      resetNorth: resetNorth, toggle2D: toggle2D, toggleMap: toggleMap, toggleHelp: toggleHelp,
      sph: sph, groundAt: function (nx, ny, y) { syncCam(); return groundAt(nx, ny, y || 0, new V3()); },
      pathZ: pathZ, posts: posts, range: [X0, X1], perf: perf, isBusy: function () { return !!(anim || wheel.pending || keys.size || drag); },
      cooperative: cooperative, worldPerPx: worldPerPx,
      hits: function (nx, ny) { return !!(api.hitsInteractive && api.hitsInteractive(nx, ny)); },
      debug: function () { return { drag: drag, anim: anim, wheel: wheel, keys: keys.size }; }
    };
    return self;
  }

  window.LineNav = { attach: attach, version: '1.0.0' };
})();

