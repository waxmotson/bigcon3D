'use strict';
/* THE BIG CON 3D — economy rules carried over from v1.5: income, synergies, seizure pricing.
   A "turn" is now a 20-second market tick; every player collects on every tick. */
function income(i){
 const p=S.players[i];const ilog=t=>{if(!p.bot)log(t)};const own=id=>S.owner[id]===i;
 const owned=NODES.filter(n=>S.owner[n.id]===i);
 let salary=3;if(own('infl'))salary=4;
 let holdSum=0;owned.forEach(n=>{let v=n.income;if(n.type==='CHART'&&own('ib'))v*=2;holdSum+=v});
 const corp=owned.filter(n=>n.type==='CORPORATE').length,bank=owned.filter(n=>n.type==='BANK').length,chart=owned.filter(n=>n.type==='CHART').length,comm=owned.filter(n=>n.type==='COMMODITY').length,reg=owned.filter(n=>n.type==='REGULATOR').length,med=owned.filter(n=>n.type==='MEDIA').length;
 let syn=0;
 if(own('citi')&&corp)syn+=corp;
 if(own('commbank')&&bank>1)syn+=2;
 if(own('westpac')&&reg)syn+=reg;
 if(own('anz')&&chart)syn+=chart;
 if(own('bhp')&&own('train'))syn+=1;
 if(own('tenyear')&&chart>1)syn+=3*(chart-1);
 COUNTRY.forEach(c=>{if(own(c)&&own('tenyear'))syn+=1});
 if(own('mpc')&&own('school')&&own('ib'))syn+=2;
 if(own('stock')&&(own('term')||own('fox')))syn+=1;
 if(own('notes')&&bank)syn+=bank;
 if(own('barrels')&&own('forklift'))syn+=1;
 if(own('forklift')&&comm)syn+=comm;
 if(own('market')&&own('quik'))syn+=2;
 if(own('rock'))syn+=new Set(owned.map(n=>n.type)).size;
 if(own('bessent')&&bank)syn+=bank;
 if(own('chalmers')&&reg)syn+=reg;
 if(own('watson')&&own('coal'))syn+=2;
 if(own('mpc')&&chart)syn+=chart;
 /* the market mood pays — or takes */
 if(S.mood==='BOOM'&&comm>0){syn+=comm;ilog('📈 BOOM: commodities pay +$1 each (+'+comm+').')}
 if(S.mood==='FRENZY'&&med>0){syn+=med;ilog('🗣️ FRENZY: media pays +$1 each (+'+med+').')}
 if(S.mood==='PANIC'&&bank>0){syn-=bank;ilog('🚨 PANIC: banks bleed −$1 each (−'+bank+').')}
 const inc=salary+holdSum+syn;
 p.money+=inc;
 ilog('💵 '+pname(i)+' collects $'+inc+' (salary $'+salary+' + holdings $'+holdSum+' + synergies $'+syn+') — now $'+p.money+'.');
 fxAt(i,'+$'+inc,'#7fe08d');
 Object.keys(S.bugs).forEach(nid=>{if(S.bugs[nid]===i&&S.owner[nid]!==i){const amt=(S.owner.wef===i)?2:1;p.money+=amt;ilog('🐛 Skim from '+NMAP[nid].name.join(' ')+': +$'+amt+'.');fxAt(i,'+$'+amt,'#7fe08d')}});
}

function seizeListPrice(pi,n){
 let base=n.cost;
 if(S.owner.golf===pi)base=Math.max(1,base-1);
 if(n.type==='CHART'){if(S.owner.nab===pi)base=Math.max(1,base-1);if(S.owner.econ===pi)base=Math.max(1,base-1)}
 return base;
}
function flatSeize(nid){return nid==='made'||nid==='qantas'||nid==='rba'}
function takeoverCost(pi,nid,base){
 if(flatSeize(nid))return base;
 if((S.players[pi].dossierUntil||0)>S.t)return base;
 const prior=S.seizeCount[nid]||0;
 return base*Math.min(8,Math.pow(2,Math.max(1,prior)));
}
