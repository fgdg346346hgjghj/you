// Интеграционная проверка полной сборки: тур, экспорт PNG, проекторная тема, скриншоты
const { chromium } = require(process.env.PW || '/tmp/k/node_modules/playwright');
const fs = require('fs');
(async () => {
  const f = process.argv[2], W = +(process.argv[3] || 1920), H = +(process.argv[4] || 1080), tag = process.argv[5] || 'full';
  const b = await chromium.launch({ executablePath: '/usr/local/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, acceptDownloads: true });
  p.setDefaultTimeout(180000);
  const errs = []; p.on('pageerror', e => errs.push('PE ' + e.message)); p.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()) });
  await p.goto('file://' + f, { timeout: 180000 }); await p.waitForTimeout(6000);
  await p.screenshot({ path: `/tmp/verify/${tag}-top.png` });
  // тур: пройти главы
  const tour = await p.evaluate(async () => {
    const T = __krauseShow.tour, out = [];
    T.start({ clean: false, speed: 1.5 });
    for (let i = 0; i < T.chapters().length; i++) { T.chapter(i); await new Promise(r => setTimeout(r, 1500)); out.push(i + ':' + document.body.dataset.mode + ':' + Math.round(scrollY)); }
    T.stop(); return out.join(' ');
  });
  // экспорт всех PNG
  const exp = await p.evaluate(async () => {
    const r = [];
    for (const k of __krauseShow.kinds) {
      const blob = await __krauseShow.exportPng(k); const bm = await createImageBitmap(blob); r.push(`${k}:${bm.width}x${bm.height}`);
      if (k === 'slide' || k === '3d-transfer') { const u8 = new Uint8Array(await blob.arrayBuffer()); window['__png_' + k.replace('-', '_')] = Array.from(u8); }
    }
    return r.join(' ');
  });
  for (const k of ['slide', '3d_transfer']) { const arr = await p.evaluate(k => window['__png_' + k], k); if (arr) fs.writeFileSync(`/tmp/verify/${tag}-export-${k}.png`, Buffer.from(arr)); }
  // проекторная тема + разделы модулей
  await p.evaluate(() => __krauseShow.setTheme(true)); await p.waitForTimeout(800);
  for (const s of ['#kpi', '#sqctp', '#sverka', '#lab']) {
    await p.evaluate(s => document.querySelector(s).scrollIntoView(), s); await p.waitForTimeout(800);
    await p.screenshot({ path: `/tmp/verify/${tag}-light-${s.slice(1)}.png` });
  }
  await p.evaluate(() => __krauseShow.setTheme(false));
  console.log('TOUR', tour); console.log('EXPORT', exp); console.log('ERRS', errs.length, errs.slice(0, 6).join(' | '));
  await b.close();
})();
