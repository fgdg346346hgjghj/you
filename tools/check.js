const { chromium } = require(process.env.PW || '/tmp/k/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:+(process.argv[3]||1366),height:+(process.argv[4]||768)}});
 const errs=[];p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.type()+': '+m.text().slice(0,300))});p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n')[1]));
 p.on('requestfailed',r=>errs.push('REQFAIL '+r.url().slice(0,100)));
 await p.goto('file://'+process.argv[2]);await p.waitForTimeout(3500);
 const r=await p.evaluate(()=>({k:!!window.__krause, nav:!!window.__lineNav, check:(document.getElementById('datacheck')||{}).textContent||null}));
 console.log(JSON.stringify(r)); console.log('ERRS',errs.length); console.log(errs.slice(0,15).join('\n'));
 await b.close();
})();
