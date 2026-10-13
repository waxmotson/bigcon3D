'use strict';
/* THE BIG CON 3D — the host-authoritative game. The host (a browser tab) owns every number that
   matters: money, intel, cortisol, node ownership, health, the dragnet, the event deck.
   Clients own their own movement and aim, and the host sanity-checks what they claim. */
const WIN_TYPES=['BANK','REGULATOR','CHART','WILD','CORPORATE','COMMODITY','MEDIA'];
const TICK_SEC=20,EVENT_SEC=38,QANTAS_GROUND=90,JET_WAIT=3,JET_SPD=36,JET_Y=130;
const ZONE=[{wait:70,shrink:40,r:215},{wait:55,shrink:38,r:150},{wait:45,shrink:34,r:95},{wait:38,shrink:28,r:55},{wait:30,shrink:24,r:28},{wait:20,shrink:20,r:7}];
const GOAL_MIN=40,GOAL_MAX=999,GOAL_DEF=250;
const BOT_NAMES=['Seth Wegrzyn','Aidan Newling','Daniel Swain','Elijah Son','Jake Tomkins','Inkdin Intern','McMetro Mike','Hormuz Harry','Low Cortisol Lou','Pyongyang Prof','New Lakemba Nick','NESA Inspector','Compliance Carl','Bondmageddon Bob','Toktimer Tim','Quikstop Quentin','Forklift Fred','Sisyphus Sam','Brad (not Pitt)','Leaked Larry','Hedge Hannah','Coal Corp Cathy','Short Seller Sal','Backroom Barry'];
let S=null;
const P=[];                 // per-player transforms {x,y,z,yaw,pitch,w,fl}
const PK=new Map();         // pickups
const GR=[];                // live grenades (host only)
let pkSeq=0,grSeq=0,fxSeq=0;
const Net={role:null,peer:null,conns:[],roster:[],myIdx:0,myName:'',playerId:null,roomCode:null,roomLabel:null,lobbyChat:[],started:false,promptSeq:0,pendingPrompts:new Map(),goal:GOAL_DEF,bots:10,hbTimer:null,lastSeen:0};
/* Hooks are filled in by net.js / ui.js; defaults keep the core runnable headless (tests, solo). */
const Hooks={ask:(pi,o)=>Promise.resolve(o.def),emit:()=>{},to:()=>{},sync:()=>{},flush:()=>{}};
const emit=m=>Hooks.emit(m),emitTo=(pi,m)=>Hooks.to(pi,m),sync=now=>Hooks.sync(now);
const askPlayer=(pi,o)=>Hooks.ask(pi,o);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const lerp=(a,b,k)=>a+(b-a)*k;
function clampGoal(v){const n=Math.round(Number(v)||0);if(!n)return GOAL_DEF;return Math.max(GOAL_MIN,Math.min(GOAL_MAX,n))}
function playerColor(i){return i<PCOLORS.length?PCOLORS[i]:'hsl('+((i*47)%360)+',80%,62%)'}
function pname(i){return S.players[i].name}
function alive(i){const p=S&&S.players[i];return !!(p&&p.alive)}
function esc(s){return String(s).replace(/[&<>\"']/g,m=>({'&':'&','<':'<','>':'>','\"':'"',"'":'&#39;'}[m]))}
function shuffle(a){const r=a.slice();for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=r[i];r[i]=r[j];r[j]=t}return r}
function log(t){if(!S)return;S.log.push(t);S.logN=(S.logN|0)+1;if(S.log.length>120)S.log.shift()}
function fx(x,y,t,c,big){if(!S||Net.role!=='host')return;S.fx.push({id:++fxSeq,x,y,t,c,b:big?1:0});if(S.fx.length>36)S.fx.shift()}
function fxAt(pi,t,c){if(!S||!S.players[pi]||Net.role!=='host')return;S.fx.push({id:++fxSeq,pi,t,c});if(S.fx.length>36)S.fx.shift()}
function banner(title,sub,color,icon,kind){emit({t:'banner',title,sub,color:color||'#168388',icon:icon||'',kind:kind||'info'})}
function setMood(k,headline){
 if(!S)return;const changed=S.mood!==k;S.mood=k;S.wire=headline;
 if(changed){log('🌡️ THE MOOD SHIFTS — '+MOODS[k].label+' ('+MOODS[k].desc+').');fx(1200,720,MOODS[k].label.split(': ')[1]||k,MOODS[k].color,true)}
}
function giveIntel(i,n,why){if(!alive(i)||n<=0)return;S.players[i].intel+=n;if(!S.players[i].bot)log('🛈 '+pname(i)+' +'+n+' Intel'+(why?' — '+why:'')+'.');fxAt(i,'🛈+'+n,'#55c1ff')}
function gain(i,amt,why){if(!alive(i)||!amt)return;S.players[i].money+=amt;if(!S.players[i].bot)log('💰 '+pname(i)+' gains $'+amt+(why?' — '+why:'')+'.');fxAt(i,'+$'+amt,'#7fe08d')}
function payVoid(i,amt,why){if(!alive(i))return;const p=S.players[i],real=Math.min(p.money,amt);if(real<=0)return;p.money-=real;if(!p.bot)log('💸 '+pname(i)+' loses $'+real+' — '+why+'.');fxAt(i,'−$'+real,'#ff6b5e')}
function payTo(i,amt,to,why){if(!alive(to)){payVoid(i,amt,why);return}if(!alive(i))return;const p=S.players[i],real=Math.min(p.money,amt);if(real<=0)return;p.money-=real;S.players[to].money+=real;log('💸 '+pname(i)+' pays $'+real+' to '+pname(to)+' — '+why+'.');fxAt(i,'−$'+real,'#ff6b5e');fxAt(to,'+$'+real,'#7fe08d')}
function payFee(i,amt,why){payVoid(i,amt,why)}
function rivalList(pi,n){return S.players.map((p,i)=>i).filter(i=>i!==pi&&S.players[i].alive).sort((a,b)=>S.players[b].money-S.players[a].money).slice(0,n||8)}
function addCortisol(i,n,why,ev){
 if(!n||!alive(i))return;
 if(ev&&n>0&&(S.owner.bess===i||S.owner.jim===i)){n-=1;if(n<=0){log('📺 Big Bessent / The Jim buries the story — '+pname(i)+' takes no Cortisol at all.');return}log('📺 Breaking news softens the story — '+pname(i)+' takes only +'+n+' Cortisol.')}
 if(ev&&n>0){const h=S.owner.herald;if(h!=null&&h!==i)giveIntel(h,1,'THE JIM REAPER files the cortisol')}
 const p=S.players[i];p.cortisol=Math.max(0,Math.min(10,p.cortisol+n));if(n>0)p.heatAt=S.t;
 if(!p.bot||n>=2)log('🔥 '+pname(i)+(n>0?' +'+n:' '+n)+' Cortisol (now '+p.cortisol+')'+(why?' — '+why:'')+'.');
 fxAt(i,(n>0?'🔥+'+n:'🔥'+n),'#ffa94d');
 if(p.cortisol>=8)raid(i);
}
const addCort=addCortisol; // alias used by event cards in data.js
/* The raid is the one thing that can end a run: two assets seized, the books fined, the intel network burned,
   and ten seconds in handcuffs — slowed to a crawl with your weapons locked. */
function raid(i){
 const p=S.players[i];
 const owned=NODES.filter(n=>S.owner[n.id]===i).sort((a,b)=>b.income-a.income||b.cost-a.cost);
 const seized=owned.slice(0,2);
 seized.forEach(n=>{delete S.owner[n.id];delete S.bugs[n.id];fx(n.x,n.y-70,'🚨 SEIZED','#ff6b5e')});
 Object.keys(S.bugs).forEach(id=>{if(S.bugs[id]===i)delete S.bugs[id]});
 const fine=Math.max(5,Math.floor(p.money*0.3));
 payVoid(i,fine,'the enforcement penalty');
 if(p.intel>1){p.intel=1;fxAt(i,'🛈 BURNED','#55c1ff')}
 p.raided=1;p.cuffs=S.t+7;p.cortisol=0;
 log('🚨 REGULATOR RAID! '+p.name+' is stripped of '+(seized.length?seized.map(n=>n.name.join(' ')).join(' and '):'nothing worth seizing')+', fined $'+fine+', and cuffed.');
 fxAt(i,'🚨 RAIDED','#ff6b5e');
 S.players.forEach((pl,j)=>{if(S.owner.hedge===j)gain(j,3,'somebody was short the whole time');if(S.owner.group===j)giveIntel(j,1,'the group photo pays')});
 banner('🚨 '+p.name.toUpperCase()+' IS RAIDED',seized.length?'Seized: '+seized.map(n=>n.name.join(' ')).join(' + ')+' · fined $'+fine:'Nothing worth seizing — the accounts took it instead','#ff6b5e','🚨','raid');
 emitTo(i,{t:'raided'});
}
const INDUSTRIES=[
 {id:'bank',name:'BANKING',pick:n=>n.type==='BANK'},{id:'regulator',name:'REGULATORS',pick:n=>n.type==='REGULATOR'},
 {id:'corporate',name:'CORPORATES',pick:n=>n.type==='CORPORATE'},{id:'commodity',name:'COMMODITIES',pick:n=>n.type==='COMMODITY'},
 {id:'media',name:'MEDIA',pick:n=>n.type==='MEDIA'},
 {id:'oil',name:'OIL',ids:['oil','oilgraph','barrels','tanker','petronas']},{id:'coal',name:'COAL',ids:['coal','train','port','bhp','watson']},
 {id:'jtportal',name:'JTPORTAL',ids:['jt','press','iface']},{id:'chalmers',name:'JIM CHALMERS',ids:['chalmers','jim','herald']},
 {id:'bessent',name:'BIG BESSENT',ids:['bessent','bess','bond']},{id:'monetary',name:'MONETARY POLICY',ids:['mpc','rba','cash','bullock','infl']}
];
function industryNodes(g){return g.ids?g.ids.map(id=>NMAP[id]).filter(Boolean):NODES.filter(g.pick)}
function concentratedIndustries(pi){return INDUSTRIES.map(g=>{const owned=industryNodes(g).filter(n=>S.owner[n.id]===pi);return{g,owned,n:owned.length}}).filter(x=>x.n>2)}
function acccInvestigate(pi){
 if(!S||S.over)return;
 const hits=concentratedIndustries(pi);if(!hits.length||Math.random()>=1/3)return;
 hits.sort((a,b)=>b.n-a.n||a.g.name.localeCompare(b.g.name));const hit=hits[0];
 hit.owned.forEach(n=>{delete S.owner[n.id];delete S.bugs[n.id];fx(n.x,n.y-70,'🧐 DIVESTED','#55c1ff')});
 log('🧐 MONOPOLY ALERT! '+pname(pi)+' is forced to dump the whole '+hit.g.name+' book.');
 fxAt(pi,'MONOPOLY ALERT','#55c1ff');
 banner('🧐 MONOPOLY ALERT',pname(pi)+' held more than two '+hit.g.name+' properties — the ACCC breaks up the book.','#55c1ff','🧐','raid');
}
function madePay(){
 const m=S.owner.made;if(m==null)return;
 gain(m,10,'MADE pays out — nobody knows why');giveIntel(m,1,'the purple graphic tells you something');
 S.players.forEach((pl,j)=>{if(j===m)return;payVoid(j,3,'the purple graphic takes its cut');addCortisol(j,1,'nobody can explain where the money went')});
}
function hasType(i,t){return NODES.some(n=>n.type===t&&S.owner[n.id]===i)}
function missingTypes(i){return WIN_TYPES.filter(t=>!hasType(i,t))}
function speedMult(i,t){
 const p=S.players[i],own=id=>S.owner[id]===i;let m=1;
 m+=.05*((own('coal')?1:0)+((own('train')||own('bullet'))?1:0)+(own('asics')?1:0));
 if(p.speedUntil>t)m+=.3;if(p.cuffs>t)m*=.45;return m;
}
function zoneLive(n){const z=S.zone;return !z||Math.hypot(n.wx-z.cx,n.wz-z.cz)<=z.r-3}

/* ================= SETUP ================= */
function newPlayer(d,i){return{name:d.name,color:playerColor(i),char:d.char||null,bot:!!d.bot,money:15,intel:2,cortisol:0,raided:0,hp:100,armor:0,alive:true,dc:false,kills:0,heatAt:0,cd:{},dossierUntil:0,slipUntil:0,slipSpent:false,speedUntil:0,cuffs:0,spyUntil:0,spawnProt:0,streak:0,lastKillT:-99}}
function initGame(defs,opts){
 const bots=Math.max(0,Math.min(MAXENT-defs.length,opts.bots|0));
 const used=new Set(defs.map(d=>d.char));const names=shuffle(BOT_NAMES);
 const all=defs.map(d=>({name:d.name,char:d.char,bot:false}));
 for(let b=0;b<bots;b++){
  const free=CHARS.filter(c=>!used.has(c.id));const ch=free.length?free[Math.floor(Math.random()*free.length)]:CHARS[Math.floor(Math.random()*CHARS.length)];used.add(ch.id);
  all.push({name:names[b%names.length],char:ch.id,bot:true});
 }
 const quikSlot=Math.floor(Math.random()*QUIK_SLOTS.length),seed=(Math.random()*1e9)|0;
 const a=Math.random()*Math.PI*2,half=270;
 S={players:all.map(newPlayer),owner:{},bugs:{},seizeCount:{},deck:shuffle(CARDS.map(c=>c.id)),discard:[],mood:'CALM',wire:'the board is pinned up — the jet is boarding',
  goal:clampGoal(opts.goal),t:0,phase:'jet',tick:0,tPlay:0,nextTick:1e9,nextEvent:1e9,zone:null,fx:[],log:[],chat:[],logN:0,chatN:0,over:false,winner:-1,quikSlot,seed,
  jet:{x0:-Math.cos(a)*half,z0:-Math.sin(a)*half,dx:Math.cos(a),dz:Math.sin(a),spd:JET_SPD,y:JET_Y,dur:JET_WAIT+2*half/JET_SPD},jtUsed:false,nextId:null,eventBusy:false,humans:defs.length};
 World.build(seed,quikSlot);
 PK.clear();GR.length=0;P.length=0;
 S.players.forEach((p,i)=>{const jp=jetPos(0);P[i]={x:jp.x,y:jp.y,z:jp.z,yaw:Math.atan2(S.jet.dx,-S.jet.dz),pitch:0,w:'stapler',fl:16}});
 S.nextId=S.deck[S.deck.length-1];
 log('🌅 The board is pinned up — '+NODES.length+' exhibits, '+EDGES.length+' threads, '+S.players.length+' cons on the jet ('+defs.length+' human).');
 log('⛽ Quikstop opened '+QUIK_SLOTS[quikSlot].label+' this game.');
 log('🏆 TWO WAYS TO WIN: be the last con standing — or bank $'+S.goal+' AND hold one of every node type ('+WIN_TYPES.join(', ')+').');
 spawnLoot();
 return S;
}
function jetPos(t){const j=S.jet,d=Math.max(0,t-JET_WAIT);return{x:j.x0+j.dx*j.spd*d,z:j.z0+j.dz*j.spd*d,y:j.y}}

/* ================= PICKUPS ================= */
function addPickup(k,x,z,v,w,quiet){
 const o={id:++pkSeq,k,v:v||0,w:w||null,x,z,y:World.groundAt(x,z,99)};PK.set(o.id,o);if(!quiet)emit({t:'pka',a:[o]});return o;
}
function removePickup(id){if(PK.delete(id))emit({t:'pkr',id})}
function spawnLoot(){
 const rnd=mulberry((S.seed^0x9e3779b1)|0),put=(k,v,w)=>{
  for(let tries=0;tries<20;tries++){
   let x,z;
   if(rnd()<.55){const n=NODES[Math.floor(rnd()*NODES.length)];const a=rnd()*6.283,d=7.5+rnd()*7;x=n.wx+Math.cos(a)*d;z=n.wz+Math.sin(a)*d}
   else{x=(rnd()*2-1)*(HX-8);z=(rnd()*2-1)*(HZ-8)}
   if(Math.abs(x)>HX-3||Math.abs(z)>HZ-3||World.groundAt(x,z,0)>0)continue;
   addPickup(k,x,z,v,w,true);return;
  }
 };
 const W=[['stapler',14],['ticker',20],['cashrate',9],['yield',14],['short',6]];
 W.forEach(([w,c])=>{for(let i=0;i<c;i++)put('wp',0,w)});
 for(let i=0;i<40;i++)put('ammo',1);
 for(let i=0;i<34;i++)put('hp',35);
 for(let i=0;i<22;i++)put('armor',40);
 for(let i=0;i<46;i++)put('cash',3+Math.floor(rnd()*5)*2);
 for(let i=0;i<26;i++)put('intel',1);
 for(let i=0;i<14;i++)put('gren',1);
 for(let i=0;i<8;i++)put('cash',18+Math.floor(rnd()*3)*6);
}
function airdrop(n,why){
 const z=S.zone||{cx:0,cz:0,r:200};
 for(let i=0;i<n;i++){
  const a=Math.random()*6.283,d=Math.random()*Math.max(8,z.r*.7),x=z.cx+Math.cos(a)*d,zz=z.cz+Math.sin(a)*d;
  if(Math.abs(x)>HX-6||Math.abs(zz)>HZ-6||World.groundAt(x,zz,0)>0){i--;if(Math.random()<.2)break;continue}
  const k=['cash','intel','wp','armor'][i%4];
  addPickup(k,x,zz,k==='cash'?25:k==='intel'?2:k==='armor'?60:0,k==='wp'?(Math.random()<.5?'cashrate':'short'):null).big=1;
  emit({t:'drop',x,z:zz,why:why||'AIRDROP'});
 }
}
function collect(pi,id){
 const o=PK.get(id),p=S.players[pi];if(!o||!p||!p.alive||S.over)return false;
 const q=P[pi];if(!q||Math.hypot(q.x-o.x,q.z-o.z)>4.5||Math.abs(q.y-o.y)>4)return false;
 if(o.k==='hp'&&p.hp>=100)return false;if(o.k==='armor'&&p.armor>=100)return false;
 if(o.k==='cash')gain(pi,o.v,'loot');
 else if(o.k==='intel')giveIntel(pi,o.v,'a brown envelope');
 else if(o.k==='hp'){p.hp=Math.min(100,p.hp+o.v);fxAt(pi,'❤️+'+o.v,'#ff8a9a')}
 else if(o.k==='armor'){p.armor=Math.min(100,p.armor+o.v);fxAt(pi,'🛡️+'+o.v,'#9ad')}
 else if(p.bot){if(o.k==='wp'&&WORDER.indexOf(o.w)>WORDER.indexOf(p.bw||'stapler'))p.bw=o.w}
 else emitTo(pi,{t:'grant',k:o.k,w:o.w,v:o.v});
 removePickup(id);sync();return true;
}

/* ================= DAMAGE & BUSTS ================= */
function applyDamage(vi,dmg,by,wid,head){
 const v=S.players[vi];if(!v||!v.alive||S.over||dmg<=0||v.spawnProt>S.t)return;
 if(by>=0&&by!==vi&&S.players[by]&&!S.players[by].alive)return;
 const a=Math.min(v.armor,dmg*.55);v.armor-=a;dmg-=a;v.hp-=dmg;
 emitTo(vi,{t:'hurt',from:by,dmg:Math.round(dmg+a),hs:head?1:0});
 if(by>=0&&by!==vi)emitTo(by,{t:'hitok',hs:head?1:0,kill:v.hp<=0?1:0,dmg:Math.round(dmg+a)});
 if(v.hp<=0)bust(vi,by,wid,head);
}
function bust(vi,by,wid,head){
 const v=S.players[vi];if(!v.alive)return;
 v.alive=false;v.hp=0;
 const q=P[vi]||{x:0,z:0,y:0},killer=(by>=0&&by!==vi)?S.players[by]:null;
 let steal=0;
 if(killer&&killer.alive){
  steal=Math.floor(v.money*.35);killer.money+=steal;v.money-=steal;killer.kills++;
  if(S.t-killer.lastKillT<12)killer.streak++;else killer.streak=1;killer.lastKillT=S.t;
  fxAt(by,'+$'+steal+' · BUSTED '+v.name.toUpperCase(),'#7fe08d');
  addCortisol(by,1,'blood on your hands');
  if(killer.hp<100){killer.hp=Math.min(100,killer.hp+15)}
  const st=killer.streak;if(st>=2)banner(['','','DOUBLE CON','TRIPLE CON','QUAD CON','MEGA CON'][Math.min(st,5)]||'CON SPREE',killer.name+' — '+st+' busts in a row','#f5c542','🔥','streak');
 }
 if(v.money>=3)addPickup('cash',q.x+(Math.random()-.5)*2,q.z+(Math.random()-.5)*2,Math.floor(v.money*.8)).big=1;
 if(v.intel>0)addPickup('intel',q.x+1,q.z,v.intel);
 addPickup('hp',q.x-1,q.z,40);
 v.money=0;v.intel=0;
 // the regulators strip every exhibit the dead con was holding
 let lost=0;Object.keys(S.owner).forEach(id=>{if(S.owner[id]===vi){delete S.owner[id];delete S.bugs[id];lost++}});
 Object.keys(S.bugs).forEach(id=>{if(S.bugs[id]===vi)delete S.bugs[id]});
 const wn=wid&&WEAPONS[wid]?WEAPONS[wid].n:(wid==='nade'?'MARGIN CALL':wid==='zone'?'THE DRAGNET':'the regulators');
 log('💀 '+(killer?killer.name+' busts '+v.name+' with '+wn+(head?' (headshot)':'')+'.':v.name+' was busted by '+wn+'.')+(lost?' '+lost+' exhibit'+(lost>1?'s':'')+' fall back to the regulators.':''));
 emit({t:'feed',a:killer?by:-1,b:vi,w:wn,hs:head?1:0});
 emitTo(vi,{t:'busted',by:killer?by:-1,w:wn});
 sync(true);winCheck();
}

/* ================= TICKS (the old "turn") ================= */
function tickPlayer(i){
 const p=S.players[i];if(!p.alive)return;const own=id=>S.owner[id]===i;
 if(p.raided)log('🚨 '+pname(i)+' spends the tick with the regulators — no income.');else income(i);
 p.raided=0;
 if(own('rba')&&p.cortisol>0){p.cortisol--;fxAt(i,'🔥−1','#8fbf7f')}
 if(own('sat')&&p.cortisol>0){p.cortisol--;fxAt(i,'🔥−1','#8fbf7f')}
 if(own('whistle'))giveIntel(i,1,'the dossier grows');
 if(own('bullock'))giveIntel(i,1,'the Governor briefs you');
 if(own('jt'))giveIntel(i,1,'JTPortal knows things');
 if(own('mpc'))giveIntel(i,1,'the Competition feeds you data');
 const charts=NODES.filter(n=>n.type==='CHART'&&S.owner[n.id]===i).length;
 if(own('school')&&charts>=3)giveIntel(i,1,'the research department delivers');
 const media=NODES.filter(n=>n.type==='MEDIA'&&S.owner[n.id]===i).length;
 if(own('news')&&media>=2)giveIntel(i,1,'you read everything');
 if(own('made')&&Math.random()<1/3)madePay();
 acccInvestigate(i);
 // natural cooling: one point of heat if you have kept your head down for 25 seconds
 if(p.cortisol>0&&S.t-(p.heatAt||0)>25){p.cortisol--;fxAt(i,'🔥−1','#8fbf7f')}
}
function tickStep(){
 if(S.t<S.nextTick)return;
 S.nextTick+=TICK_SEC;S.tick++;
 S.players.forEach((p,i)=>{if(p.alive)tickPlayer(i)});
 emit({t:'tick',n:S.tick});sync(true);winCheck();
}

/* ================= EVENTS ================= */
function drawCard(){
 if(!S.deck.length){S.deck=shuffle(S.discard.slice());S.discard=[];log('🃏 The rumor deck is reshuffled.')}
 const id=S.deck.pop();S.discard.push(id);
 if(!S.deck.length){S.deck=shuffle(S.discard.slice());S.discard=[]}
 S.nextId=S.deck[S.deck.length-1];
 const c=CARDBYID[id];log('🃏 EVENT — '+c.title);return c;
}
async function runEvent(){
 if(S.eventBusy||S.over)return;S.eventBusy=true;
 try{
  const jtO=S.owner.jt;
  if(jtO!=null&&!S.jtUsed&&alive(jtO)&&!S.players[jtO].bot){
   const v=await askPlayer(jtO,{title:'JTPORTAL INTERVENES?',body:'Once per game an event can be made to have never happened. Next up: '+CARDBYID[S.nextId].title,options:[{label:'Let it play out',v:0},{label:'“Quite frankly…” — cancel it',v:1}],def:0,timeout:7000});
   if(v){S.jtUsed=true;const c=drawCard();log('🌐 JTPortal: “Quite frankly, that never happened.” '+c.title+' vanishes.');banner('“NEVER HAPPENED.”',c.title+' — cancelled by JTPortal','#55c1ff','🌐','event');return}
  }
  const card=drawCard();
  emit({t:'banner',kind:'event',title:card.title,sub:card.text,icon:card.icon,color:'#168388',cid:card.id});
  await sleep(2200);
  if(S.over)return;
  const tk=S.owner.toktimer;if(tk!=null)giveIntel(tk,1,'Toktimer clocked the event');
  await card.run();
  if(card.id==='tip')airdrop(5,'ANONYMOUS TIP — a brown envelope drops');
  sync(true);winCheck();
 }catch(e){console.error(e)}finally{S.eventBusy=false}
}
function eventStep(){if(S.t<S.nextEvent)return;S.nextEvent+=EVENT_SEC;runEvent()}

/* ================= THE DRAGNET ================= */
function initZone(){S.zone={cx:0,cz:0,r:300,ph:0,st:'wait',fr:300,fcx:0,fcz:0,tcx:0,tcz:0,tr:ZONE[0].r,t0:S.t,until:S.t+ZONE[0].wait,done:false};zonePick()}
function zonePick(){
 const z=S.zone,d=ZONE[z.ph],room=Math.max(0,z.r-d.r),a=Math.random()*6.283,m=Math.sqrt(Math.random())*room*.9;
 z.tcx=Math.max(-HX+d.r*.4,Math.min(HX-d.r*.4,z.cx+Math.cos(a)*m));z.tcz=Math.max(-HZ+d.r*.4,Math.min(HZ-d.r*.4,z.cz+Math.sin(a)*m));z.tr=d.r;
}
function seizeOutside(){
 const z=S.zone;let n=0;
 NODES.forEach(nd=>{if(Math.hypot(nd.wx-z.cx,nd.wz-z.cz)>z.r){if(S.owner[nd.id]!=null){delete S.owner[nd.id];delete S.bugs[nd.id];n++}}});
 if(n)log('🚨 The dragnet seizes '+n+' exhibit'+(n>1?'s':'')+' outside the ring.');
}
function zoneStep(dt){
 if(!S.zone||S.over)return;
 const z=S.zone;
 if(S.t>=z.until){
  if(z.st==='wait'){z.st='shrink';z.t0=S.t;z.until=S.t+ZONE[z.ph].shrink;z.fr=z.r;z.fcx=z.cx;z.fcz=z.cz;zonePick();log('🚨 DRAGNET CLOSING — ring '+(z.ph+1)+'/'+ZONE.length);}
  else if(z.ph<ZONE.length-1){z.ph++;z.st='wait';z.t0=S.t;z.until=S.t+ZONE[z.ph].wait;seizeOutside();log('🎯 Dragnet settled — next close in '+ZONE[z.ph].wait+'s');}
  else{z.done=true;seizeOutside();}
 }
 if(z.st==='shrink'){
  const k=Math.min(1,(S.t-z.t0)/(z.until-z.t0));
  z.cx=lerp(z.fcx,z.tcx,k);z.cz=lerp(z.fcz,z.tcz,k);z.r=lerp(z.fr,z.tr,k);
 }
 // damage anyone outside
 S.players.forEach((p,i)=>{if(!p.alive)return;const q=P[i];if(!q)return;if(Math.hypot(q.x-z.cx,q.z-z.cz)>z.r){applyDamage(i,8*dt,-1,'zone',false)}});
}

/* ================= WIN ================= */
function winCheck(){
 if(S.over)return;
 const alive=S.players.filter(p=>p.alive);
 if(alive.length<=1){S.over=true;S.winner=alive.length?alive[0].i:-1;log('🏆 '+(alive.length?alive[0].name+' is the last con standing.':'Everyone is busted.'));return}
 for(const p of S.players){if(!p.alive)continue;if(p.money>=S.goal&&missingTypes(p.i).length===0){S.over=true;S.winner=p.i;log('🏆 '+p.name+' completes THE BIG CON — $'+p.money+' and every node type.');return}}
}
function gameStep(dt){
 if(!S||S.over||Net.role!=='host')return;
 S.t+=dt;
 if(S.phase==='jet'){
  const jp=jetPos(S.t);
  S.players.forEach((p,i)=>{if(!p.alive||p.landed)return;const q=P[i];q.x=jp.x;q.y=jp.y;q.z=jp.z});
  if(S.t>S.jet.dur){S.phase='play';S.nextTick=S.t+TICK_SEC;S.nextEvent=S.t+EVENT_SEC;initZone();log('🛫 The jet has landed — seize exhibits, bust cons, complete the Big Con.');}
 }
 tickStep();
 eventStep();
 zoneStep(dt);
 // grenades
 for(let i=GR.length-1;i>=0;i--){
  const g=GR[i];g.t+=dt;g.x+=g.vx*dt;g.z+=g.vz*dt;g.y+=g.vy*dt;g.vy-=18*dt;
  const gy=World.groundAt(g.x,g.z,g.y);
  if(g.y<=gy){g.y=gy;g.vy*=-.35;g.vx*=.6;g.vz*=.6}
  if(g.t>GREN.fuse){GR.splice(i,1);emit({t:'boom',x:g.x,y:g.y,z:g.z});S.players.forEach((p,j)=>{if(!p.alive)return;const q=P[j];if(!q)return;const d=Math.hypot(q.x-g.x,q.z-g.z);if(d<GREN.rad)applyDamage(j,GREN.dmg*(1-d/GREN.rad),g.by,'nade',false)})}
 }
 netStep(dt);
}
function throwGrenade(by,o,v){
 GR.push({x:o[0],y:o[1],z:o[2],vx:v[0],vy:v[1],vz:v[2],t:0,by});
}
function handleShot(pi,d){
 const p=S.players[pi];if(!p||!p.alive||S.over)return;
 const w=WEAPONS[d.w];if(!w)return;
 const q=P[pi];if(!q)return;
 // simple host-side validation
 const dx=d.dx,dy=d.dy,dz=d.dz;
 const hit=World.ray(q.x,q.y+1.6,q.z,dx,dy,dz,w.range);
 let best=null,bestT=hit;
 S.players.forEach((v,j)=>{if(j===pi||!v.alive)return;const tq=P[j];if(!tq)return;const r=rayPlayer(q.x,q.y+1.6,q.z,dx,dy,dz,tq.x,tq.y,tq.z,!!(v.fl&1),w.range);if(r&&r.t<bestT){bestT=r.t;best={j,head:r.head}}});
 if(best)applyDamage(best.j,w.dmg*(best.head?1.8:1),pi,d.w,best.head);
 emit({t:'shotfx',pi,w:d.w,x:q.x,y:q.y+1.6,z:q.z,dx,dy,dz,t:bestT});
}
function doAction(pi,act,d){
 const p=S.players[pi];if(!p||!p.alive||S.over)return;
 if(act==='seize'){
  const n=NMAP[d.id];if(!n)return;
  const q=P[pi];if(!q||Math.hypot(q.x-n.wx,q.z-n.wz)>NODE_R+3)return;
  if(S.owner[n.id]===pi)return;
  const cost=n.cost+(S.owner[n.id]!=null?4:0);
  if(p.money<cost)return;
  payVoid(pi,cost,'seizing '+n.name.join(' '));
  const prev=S.owner[n.id];if(prev!=null)addCortisol(prev,1,'your exhibit was taken');
  S.owner[n.id]=pi;S.seizeCount[n.id]=(S.seizeCount[n.id]||0)+1;
  addCortisol(pi,1,'you seized an exhibit');
  log('🏛️ '+p.name+' seizes '+n.name.join(' ')+'.');
  fx(n.x,n.y-40,'SEIZED','#7fe08d');
  sync(true);
 }
 else if(act==='buy'){
  const item=d.item,price={hp:3,armor:5,ammo:2,gren:4}[item];
  if(!price||p.money<price)return;
  payVoid(pi,price,'Quikstop');
  if(item==='hp')p.hp=Math.min(100,p.hp+50);
  else if(item==='armor')p.armor=Math.min(100,p.armor+50);
  else if(item==='ammo')emitTo(pi,{t:'grant',k:'ammo',v:1});
  else if(item==='gren')emitTo(pi,{t:'grant',k:'gren',v:1});
  fxAt(pi,'BOUGHT','#7fe08d');
  sync();
 }
 else if(act==='push'&&S.owner.sisy===pi){
  gain(pi,3,'pushing the boulder');
  addCortisol(pi,1,'the boulder rolls back');
 }
 else if(act==='jog'&&S.owner.asics===pi&&p.cortisol>0){
  p.cortisol--;
  fxAt(pi,'🔥−1','#8fbf7f');
 }
}
