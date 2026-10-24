const { chromium } = require(process.env.PW || '/tmp/k/node_modules/playwright');
(async () => {
  const [f, W, H, ...sels] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/usr/local/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +W, height: +H } }); p.setDefaultTimeout(180000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()) });
  await p.goto('file://' + f, { timeout: 180000 }); await p.waitForTimeout(6000);
  for (const s of sels) { await p.evaluate(s => document.querySelector(s).scrollIntoView(), s); await p.waitForTimeout(1000); await p.screenshot({ path: `/tmp/verify/sec-${W}-${s.replace(/[^a-z0-9]/gi, '')}.png` }); }
  console.log('ERRS', errs.length, errs.slice(0, 3).join(' | ')); await b.close();
})();
