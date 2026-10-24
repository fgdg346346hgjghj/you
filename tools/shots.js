const { chromium } = require(process.env.PW || '/tmp/k/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1366,height:768}});
 await p.goto('file://'+process.argv[2]);await p.waitForTimeout(4000);
 const H=await p.evaluate(()=>document.body.scrollHeight);
 for(let y=0,i=0;y<H && i<20;y+=1500,i++){await p.evaluate(y=>window.scrollTo(0,y),y);await p.waitForTimeout(300);await p.screenshot({path:`${process.argv[3]}-${String(i).padStart(2,'0')}.png`});}
 await b.close();
})();
