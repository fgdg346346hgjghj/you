
/* Подключение LineNav к 3D-модели линии Krause (window.__krause отдаёт бандл). */
(function () {
  var k = window.__krause;
  if (!k || !k.controls || !window.LineNav) return;
  var cam = k.camera, ids = Object.keys(k.stations);
  var posts = ids.map(function (id) {
    var p = k.posts[id];
    return { id: id, x: p.x, z: p.z, side: !!p.side, brig: id.split('-')[0], accent: id === '41-1(а)' };
  });
  var xs = posts.map(function (p) { return p.x; }), zs = posts.map(function (p) { return p.z; });
  var bounds = { minX: Math.min.apply(null, xs) - 10, maxX: Math.max.apply(null, xs) + 10, minZ: Math.min.apply(null, zs) - 8, maxZ: Math.max.apply(null, zs) + 8 };
  var stage = document.getElementById('stage-wrap');
  var nav = LineNav.attach({
    V3: cam.position.constructor, Quaternion: cam.quaternion.constructor, Raycaster: k.Raycaster,
    camera: cam, controls: k.controls, renderer: k.renderer, canvas: k.renderer.domElement,
    viewer: document.getElementById('viewer'), redraw: k.redraw,
    pickables: function () { return k.scene.children; },
    bounds: bounds,
    posts: function () { return posts; },
    brigades: k.brigades.filter(function (b) { return b.id !== '21'; }).map(function (b) {
      return { id: b.id, label: b.id + ' · ' + (String(b.sub || '').split(':')[1] || b.sub || '').trim(), color: b.color };
    }),
    takt: 79,
    load: function (id) { return k.load(id, k.state.mode); },
    // подпись включает источник/модель — полоса-карта перерисуется при их смене
    mode: function () { return k.state.mode + (k.dataSig ? '|' + k.dataSig() : ''); },
    selected: function () { return k.state.sel; },
    selectPost: function (id) { k.setSel(id, false); },
    focusPost: function (id) { k.setSel(id, true); },
    fitAll: function () {
      k.flyTo(k.VIEWS.all());
      document.querySelectorAll('button[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === 'all'); });
    },
    cancelFly: k.cancelFly,
    isFlying: function () { return !!k.fly.on; },
    hitsInteractive: function (nx, ny) { return !!k.pickAt(nx, ny); },
    fullscreenEl: stage, fsButton: document.getElementById('fs'),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
  });
  k.nav = nav;
  // точки доступа для автотестов
  window.__lineNav = nav; window.__navCam = cam; window.__navCtl = k.controls; window.__navRenderer = k.renderer;
  window.__navSel = function () { return k.state.sel; }; window.__navTweens = function () { return k.dbg().tw; }; window.__navBounds = bounds;
})();

