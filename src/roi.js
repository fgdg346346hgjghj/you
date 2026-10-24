(function(){
var $=function(i){return document.getElementById(i)};
var KD=JSON.parse($("krause-data").textContent),D=KD.sheetDATA;
// фонд смены из листа DATA: 460 мин × 60 × 0,98 = 27 048 с
var F=D.availMin*60*D.ro,cx=KD.economy.capex.filter(function(c){return !c.opt});
var CAPEX={lo:cx.reduce(function(a,c){return a+c.lo},0),hi:cx.reduce(function(a,c){return a+c.hi},0),pilotLo:30,pilotHi:60};
cx.forEach(function(c){if(/^Пилот/.test(c.t)){CAPEX.pilotLo=c.lo;CAPEX.pilotHi=c.hi}});
function ru(x,d){return x.toLocaleString("ru-RU",{maximumFractionDigits:d==null?0:d,minimumFractionDigits:d==null?0:d})}
function mln(x){return ru(x/1e6,2).replace("-","−")+" млн ₽"}
function pay(c,m){return m>0?ru(c*1e3/m,1):"—"}
$("cap100").textContent=ru(Math.round(F/(KD.const.pace*KD.const.sminSec)));
$("cap79").textContent=ru(Math.round(F/(KD.const.takt*KD.const.sminSec)));
function render(){
 var sal=+$("rs-sal").value||0,soc=+$("rs-soc").value||0,rate=sal*(1+soc/100);
 var rows=[
  ["Базовый: 2 смены, 2 ставки",2,1,1,1,"Основной расчёт при незамещении вакансий"],
  ["Одна смена (1 ставка)",1,1,1,1,"Если линия работает в одну смену"],
  ["Зарплата −20 %",2,.8,1,1,"Допущение о зарплате заниженное"],
  ["Зарплата +20 %",2,1.2,1,1,"Допущение о зарплате завышенное"],
  ["Затраты ×1,5",2,1,1.5,1,"Оснастка и доработки дороже плана"],
  ["Хуже всего: 1 смена, зарплата −20 %, затраты ×1,5",1,.8,1.5,1,"Совмещение трёх неблагоприятных допущений"]
 ];
 var h="<thead><tr><th>Случай</th><th>Ставок</th><th>ФОТ с взносами, в месяц</th><th>Разово, тыс. ₽</th><th>Окупаемость, мес</th><th>За 1-й год минус затраты</th><th>Комментарий</th></tr></thead><tbody>";
 rows.forEach(function(r){
  var m=r[1]*rate*r[2],lo=CAPEX.lo*r[3],hi=CAPEX.hi*r[3];
  h+="<tr><td>"+r[0]+"</td><td class=\"n\">"+r[1]+"</td><td class=\"n\">"+ru(m)+" ₽</td><td class=\"n\">"+ru(lo)+"–"+ru(hi)+"</td><td class=\"n\">"+pay(lo,m)+"–"+pay(hi,m)+"</td><td class=\"n\">"+mln(m*12-hi*1e3)+" … "+mln(m*12-lo*1e3)+"</td><td>"+r[5]+"</td></tr>";
 });
 h+="<tr><td>Оператора переводят на 31-12</td><td class=\"n\">2</td><td class=\"n\">0 ₽</td><td class=\"n\">"+CAPEX.lo+"–"+CAPEX.hi+"</td><td class=\"n\">нет</td><td class=\"n\">минус затраты</td><td>ФОТ завода не меняется. Эффект — закрытая потребность 31-12; её нужно оценить отдельно и не складывать с экономией ФОТ</td></tr>";
 h+="<tr><td>Провал пилота</td><td class=\"n\">0</td><td class=\"n\">0 ₽</td><td class=\"n\">потеряно не больше затрат до пилота, минимум "+CAPEX.pilotLo+"–"+CAPEX.pilotHi+"</td><td class=\"n\">нет</td><td class=\"n\">—</td><td>Пост 41-1(а) остаётся; он сохранён как страховка на время пилота</td></tr></tbody>";
 $("rs-table").innerHTML=h;
 var k=window.__krause,L=function(id,m,r){return k&&k.calc?k.calc.load(id,"after",m,"el",r):NaN};
 var ex=KD.chunks.filter(function(c){return !c.dest.after}).reduce(function(a,c){return a+c.v},0),rv=KD.recog.v;
 var m="<thead><tr><th>Доля 21129</th><th>51-9, смин (худшая модель)</th><th>51-11, смин (худшая модель)</th><th>Лишних действий уходит, смин на ДВС в среднем</th></tr></thead><tbody>";
 [0,.5,1].forEach(function(p){
  var w9=p<1?L("51-9","21179",0)+"–"+L("51-9","21179",rv):L("51-9","21129",0)+"–"+L("51-9","21129",rv);
  var w11=p<1?L("51-11","21179",0)+"–"+L("51-11","21179",rv):L("51-11","21129",0)+"–"+L("51-11","21129",rv);
  // экран модели: уходят все лишние; ручное определение: +2 на 51-9 и 51-11 у каждой головки
  var lo=ex*(1-p)-2*rv,hi=ex*(1-p);
  m+="<tr><td>"+ru(p*100)+" %"+(p===.5?" <span class=\"tg ta\">допущение</span>":"")+"</td><td class=\"n\">"+w9+(p>0&&p<1?" (для 21129 — "+L("51-9","21129",0)+"–"+L("51-9","21129",rv)+")":"")+"</td><td class=\"n\">"+w11+(p>0&&p<1?" (для 21129 — "+L("51-11","21129",0)+"–"+L("51-11","21129",rv)+")":"")+"</td><td class=\"n\">"+ru(lo,1)+" … "+ru(hi,1)+"</td></tr>";
 });
 $("rs-mix").innerHTML=m+"</tbody>";
}
$("rs-sal").addEventListener("input",render);$("rs-soc").addEventListener("input",render);render();
})();
