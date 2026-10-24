// Проверка чисел P0 по чек-листу раздела 9 ТЗ
const { chromium } = require(process.env.PW || '/tmp/k/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/local/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()) });
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(3000);
  const r = await p.evaluate(async () => {
    const k = __krause, c = k.calc, out = {}, B = id => k.brigades.find(x => x.id === id);
    const st = (id, mode) => { const s = c.brig(B(id), mode); return `${s.sum}/${s.n}п/over${s.over}/max${s.max}/eff${Math.round(s.eff*100)}/free${s.free}` };
    out.el21179 = { b51: [st('51', 'before'), st('51', 'after')], b31: st('31', 'before'), b41: [st('41', 'before'), st('41', 'after')] };
    k.setData({ recog: 2 }); out.recog2 = { b51a: st('51', 'after'), l519: k.load('51-9', 'after'), l5111: k.load('51-11', 'after') }; k.setData({ recog: 0 });
    k.setData({ model: '21129' }); out.m21129 = { b31: st('31', 'before'), b41: [st('41', 'before'), st('41', 'after')], a41: k.load('41-1(а)', 'before') };
    k.setData({ model: 'mix', mix: 0.5 }); out.mix = { b41: st('41', 'before'), l517: k.load('41-7', 'before'), w: c.worst('41-7', 'before') };
    k.setData({ model: '21179', src: 'sum' });
    out.sum = Object.fromEntries(['31-5', '31-5(а)', '31-12', '41-7', '41-1(а)', '31-7', '31-4', '41-9'].map(id => [id, k.load(id, 'before')]));
    out.sumLabels = [...document.querySelectorAll('#labels-layer .pl-t')].length;
    k.setData({ src: 'el' });
    const V = c.vals(); out.vals = ['p41a','r519','r5111','tot','totA','totA2','tot29','b31','b31eff','b31_29','b31eff29','b31free','b41b','b41a','b41_29','free41','free41_29','maxFree41','over31','max31','fund','cap100','cap79','cap106','short','rate','year','capexM','payback','extra','extra2'].map(x => x + '=' + V[x]).join(' | ');
    out.kpi = document.querySelector('#kpi').innerText.replace(/\s+/g, ' ').slice(0, 400);
    out.ecoKpi = document.querySelector('#eco-kpi').innerText.replace(/\s+/g, ' ').slice(0, 300);
    out.cap = [document.getElementById('cap100').textContent, document.getElementById('cap79').textContent];
    out.rsMix = document.querySelector('#rs-mix').innerText.replace(/\s+/g, ' ');
    out.check = document.getElementById('datacheck').textContent;
    for (const m of ['before', 'varA', 'after']) { k.setMode(m); await new Promise(r => setTimeout(r, 200)); out['kpi_' + m] = document.querySelector('#kpi b').textContent; }
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); console.log('ERRS', errs.length, errs.slice(0, 5).join(' | '));
  await b.close();
})();
