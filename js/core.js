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
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
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
 // Explicit aliases ensure named bots with an existing portrait always use that portrait.
 // Exact name/id matches are also picked up automatically as the lists grow.
 const BOT_CHAR_MAP={'Jake Tomkins':'tomkins','Daniel Swain':'denialswan'};
 const normalise=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 for(let b=0;b<bots;b++){
  const name=names[b%names.length];
  const exact=CHARS.find(c=>normalise(c.name)===normalise(name)||normalise(c.id)===normalise(name));
  const preferred=charMeta(BOT_CHAR_MAP[name])||exact;
  let ch=preferred&&!used.has(preferred.id)?preferred:null;
  if(!ch){const free=CHARS.filter(c=>!used.has(c.id));ch=free.length?free[Math.floor(Math.random()*free.length)]:CHARS[Math.floor(Math.random()*CHARS.length)]}
  used.add(ch.id);
  all.push({name,char:ch.id,bot:true});
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
 if(!S.deck.length){S.deck=shuffle(S.discard.slice());S.discard=[];log('🎴 The rumor deck is reshuffled.')}
 const id=S.deck.pop();S.discard.push(id);
 if(!S.deck.length){S.deck=shuffle(S.discard.slice());S.discard=[]}
 S.nextId=S.deck[S.deck.length-1];
 const c=CARDBYID[id];log('🎴 EVENT — '+c.title);return c;
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
 NODES.forEach(nd=>{if(Math.hypot(nd.wx-z.cx,nd.wz-z.cz)>z.r-3&&S.owner[nd.id]!=null){delete S.owner[nd.id];delete S.bugs[nd.id];n++;fx(nd.x,nd.y-70,'🚔 SEIZED','#ff6b5e')}});
 if(n){log('🚔 THE DRAGNET closes — the regulators seize '+n+' exhibit'+(n>1?'s':'')+' outside the safe zone.');}
}
function zoneStep(dt){
 const z=S.zone;if(!z||z.done)return;
 if(z.st==='wait'&&S.t>=z.until){
  z.st='shrink';z.fr=z.r;z.fcx=z.cx;z.fcz=z.cz;z.t0=S.t;z.until=S.t+ZONE[z.ph].shrink;
  banner('THE DRAGNET IS CLOSING','Get inside the circle — outside it your Cortisol and health bleed out','#ff6b5e','🚨','zone');
 }else if(z.st==='shrink'){
  const k=Math.min(1,(S.t-z.t0)/ZONE[z.ph].shrink);
  z.r=lerp(z.fr,z.tr,k);z.cx=lerp(z.fcx,z.tcx,k);z.cz=lerp(z.fcz,z.tcz,k);
  if(k>=1){
   z.st='wait';z.ph++;seizeOutside();
   if(z.ph>=ZONE.length){z.done=true;z.until=1e9}
   else{z.until=S.t+ZONE[z.ph].wait;zonePick();banner('NEXT DRAGNET MARKED','The circle holds for '+ZONE[z.ph].wait+'s — then it closes again','#168388','🎯','zone');if(z.ph%2===1)airdrop(4,'SUPPLY DROP')}
   sync(true);
  }
 }
 // outside the circle: health bleeds, Cortisol climbs
 z.acc=(z.acc||0)+dt;
 if(z.acc>=.5){
  const step=z.acc;z.acc=0;const rate=1.6+z.ph*1.3;
  S.players.forEach((p,i)=>{
   if(!p.alive||!P[i]||(P[i].fl&16))return;
   if(Math.hypot(P[i].x-z.cx,P[i].z-z.cz)>z.r){
    applyDamage(i,rate*step,-1,'zone',false);
    p.zt=(p.zt||0)+step;if(p.zt>=3){p.zt=0;addCortisol(i,1,'outside the dragnet')}
   }
  });
 }
}

/* ================= GRENADES ================= */
function throwGrenade(pi,o,v){
 const g={id:++grSeq,pi,x:o[0],y:o[1],z:o[2],vx:v[0],vy:v[1],vz:v[2],t:0};GR.push(g);
 emit({t:'gren',id:g.id,i:pi,o:[g.x,g.y,g.z],v:[g.vx,g.vy,g.vz]});
}
function stepGrenade(g,dt){
 g.vy-=22*dt;
 const nx=g.x+g.vx*dt,ny=g.y+g.vy*dt,nz=g.z+g.vz*dt;
 const dx=nx-g.x,dy=ny-g.y,dz=nz-g.z,len=Math.hypot(dx,dy,dz)||1e-6;
 const hit=World.ray(g.x,g.y,g.z,dx/len,dy/len,dz/len,len+.15);
 if(hit<len+.1&&len>1e-5){g.vx*=-.35;g.vz*=-.35;g.vy*=-.3;g.x+=dx/len*Math.max(0,hit-.2);g.y+=dy/len*Math.max(0,hit-.2);g.z+=dz/len*Math.max(0,hit-.2)}
 else{g.x=nx;g.y=ny;g.z=nz}
 const gr=World.groundAt(g.x,g.z,g.y+1);
 if(g.y<gr+.2){g.y=gr+.2;g.vy=Math.abs(g.vy)*.4;g.vx*=.7;g.vz*=.7}
 g.x=Math.max(-HX,Math.min(HX,g.x));g.z=Math.max(-HZ,Math.min(HZ,g.z));
}
function grenadesStep(dt){
 for(let k=GR.length-1;k>=0;k--){
  const g=GR[k];g.t+=dt;stepGrenade(g,dt);
  if(g.t>=GREN.fuse){
   GR.splice(k,1);emit({t:'boom',id:g.id,x:g.x,y:g.y,z:g.z});
   S.players.forEach((p,i)=>{
    if(!p.alive||!P[i])return;
    const d=Math.hypot(P[i].x-g.x,(P[i].y+.9)-g.y,P[i].z-g.z);if(d>GREN.rad)return;
    if(World.ray(g.x,g.y+.3,g.z,(P[i].x-g.x)/d,(P[i].y+.9-g.y)/d,(P[i].z-g.z)/d,d)<d-.6)return; // cover blocks the blast
    let dmg=GREN.dmg*(1-d/GREN.rad)+8;if(i===g.pi)dmg*=.55;
    applyDamage(i,dmg,g.pi,'nade',false);
   });
  }
 }
}

/* ================= CLIENT CLAIMS (host validates) ================= */
function handleShot(pi,m){
 const p=S.players[pi],W=m&&WEAPONS[m.w];
 if(!p||!p.alive||S.over||!W||p.cuffs>S.t)return;
 if(P[pi]&&P[pi].fl&16)return;
 if(p.lastShot&&S.t-p.lastShot<W.rof*.5)return;p.lastShot=S.t;
 emit({t:'shot',i:pi,w:m.w,o:m.o,e:m.e});
 const hits=(m.h||[]).slice(0,W.pel);
 hits.forEach(h=>{
  const ti=h[0],head=!!h[1];if(ti===pi||!alive(ti))return;
  const a=P[pi],b=P[ti];if(!a||!b)return;
  const d=Math.hypot(a.x-b.x,a.z-b.z);if(d>W.range*1.2+3)return;
  const fall=d>W.range*.6?1-(d-W.range*.6)/(W.range*.4)*.35:1;
  applyDamage(ti,W.dmg*(head?W.hm:1)*fall,pi,m.w,head);
 });
}
function atNode(pi,nid,slack){const n=NMAP[nid],q=P[pi];return !!(n&&q&&Math.hypot(q.x-n.wx,q.z-n.wz)<=NODE_R+(slack||2.5)&&q.y<4)}
function ready(p,k,sec){if((p.cd[k]||0)>S.t)return false;p.cd[k]=S.t+sec;return true}
function toast(pi,msg){emitTo(pi,{t:'sys',msg})}

function doSeize(pi,nid){
 const p=S.players[pi],n=NMAP[nid];if(!p||!p.alive||!n||S.over)return;
 const prev=S.owner[nid];if(prev===pi)return;
 if(!atNode(pi,nid)){toast(pi,'Get closer to '+n.name.join(' '));return}
 if(!zoneLive(n)){toast(pi,'The regulators have this one locked down — outside the dragnet.');return}
 if(nid==='qantas'&&S.t<QANTAS_GROUND){toast(pi,'Qantas is grounded for the first '+QANTAS_GROUND+'s — the jet is still at the gate.');return}
 if(p.cuffs>S.t){toast(pi,'You are in handcuffs.');return}
 let base=seizeListPrice(pi,n);
 let slipUsed=false;
 if(p.slipUntil>S.t&&!p.slipSpent&&S.owner.f1===pi){base=Math.max(1,base-2);slipUsed=true}
 const isTake=prev!=null;
 const cost=isTake?takeoverCost(pi,nid,base):base;
 const useBack=S.owner.back===pi?Math.min(3,p.intel):0;
 if(p.money+useBack<cost){toast(pi,"You can't afford that — $"+cost+' needed.');return}
 let cash=Math.min(p.money,cost),useInt=cost-cash;
 p.money-=cash;p.intel-=useInt;if(slipUsed)p.slipSpent=true;
 if(useInt>0)fxAt(pi,'🛈−'+useInt,'#55c1ff');if(cash>0)fxAt(pi,'−$'+cash,'#ff6b5e');
 if(isTake){
  if(alive(prev)){S.players[prev].money+=n.cost;fxAt(prev,'+$'+n.cost,'#7fe08d');emitTo(prev,{t:'sys',msg:'🚨 '+p.name+' muscled in on '+n.name.join(' ')})}
  if(S.owner.accc===prev&&p.money>=2){p.money-=2;if(alive(prev))S.players[prev].money+=2}
 }
 S.owner[nid]=pi;S.seizeCount[nid]=(S.seizeCount[nid]||0)+1;delete S.bugs[nid];
 log('📝 '+p.name+(isTake?' muscles in on ':' seizes ')+n.name.join(' ')+(isTake?' ('+pname(prev)+' loses it)':'')+'.');
 fx(n.x,n.y-64,'📝 SEIZED',p.color);
 emit({t:'seized',nid,i:pi,take:isTake?1:0});
 if(nid==='bond')giveIntel(pi,2,'desk gossip flows');
 if(nid==='leak')giveIntel(pi,1,'the leak pays');
 S.players.forEach((pl,j)=>{if(j!==pi&&S.owner.photo===j)giveIntel(j,1,'the Photo Wall catches it')});
 addCortisol(pi,isTake?2:1,isTake?'hostile takeover':'hands are getting dirty');
 sync(true);winCheck();
}
function doBug(pi,nid){
 const p=S.players[pi],n=NMAP[nid];
 if(!n||S.owner[nid]==null||S.owner[nid]===pi||S.bugs[nid]!=null||!atNode(pi,nid)){toast(pi,'Stand at a rival node that is not already bugged.');return}
 const cost=(S.owner.insider===pi)?0:1;if(p.intel<cost){toast(pi,'Not enough Intel.');return}
 p.intel-=cost;S.bugs[nid]=pi;fx(n.x,n.y-60,'🐛 PLANTED','#55c1ff');log('🐛 '+p.name+' plants a bug on '+n.name.join(' ')+'.');sync();
}
const QUIK_PRICES={hp:[3,'a bandage'],armor:[5,'a vest'],ammo:[2,'ammo'],gren:[4,'a MARGIN CALL']};
/* every ability a player can fire — cooldown stands in for "once per turn" */
function doAction(pi,act,m){
 const p=S.players[pi];if(!p||!p.alive||S.over)return;const own=id=>S.owner[id]===pi;m=m||{};
 const tgt=()=>{const t=m.target;if(t==null||t===pi||!alive(t)){toast(pi,'Pick a live rival.');return null}return t};
 const spend=n=>{if(p.money<n){toast(pi,'Costs $'+n+'.');return false}p.money-=n;fxAt(pi,'−$'+n,'#ff6b5e');return true};
 const needIntel=n=>{if(p.intel<n){toast(pi,'Needs '+n+' Intel.');return false}p.intel-=n;fxAt(pi,'🛈−'+n,'#55c1ff');return true};
 if(act==='seize')return doSeize(pi,m.nid);
 if(act==='bug')return doBug(pi,m.nid);
 if(act==='eject'){return}
 if(act==='pick')return collect(pi,m.id);
 if(act==='favor'){if(p.speedUntil>S.t||!needIntel(1))return;p.speedUntil=S.t+7;log('🤝 '+p.name+' cashes a favor — speed boost.');}
 else if(act==='slip'){if(!own('f1')||p.slipUntil>S.t||!spend(2))return;p.slipUntil=S.t+14;p.slipSpent=false;p.speedUntil=Math.max(p.speedUntil,S.t+4);log('🏎️ '+p.name+' takes the slipstream.');}
 else if(act==='fly'){
  if(!own('qantas'))return;const n=NMAP[m.nid];if(!n)return;
  if(n.id==='qantas'&&S.t<QANTAS_GROUND){toast(pi,'Qantas is grounded for now.');return}
  if(!zoneLive(n)){toast(pi,'That exhibit is outside the dragnet.');return}
  if(!ready(p,'fly',25)){toast(pi,'The jet is refuelling.');return}
  if(!spend(3)){p.cd.fly=0;return}
  const a=Math.random()*6.283;P[pi].x=n.wx+Math.cos(a)*3;P[pi].z=n.wz+Math.sin(a)*3;P[pi].y=World.groundAt(P[pi].x,P[pi].z,99);
  emitTo(pi,{t:'tele',x:P[pi].x,y:P[pi].y,z:P[pi].z});log('✈️ '+p.name+' takes the Qantas jet straight to '+n.name.join(' ')+'.');
 }
 else if(act==='leak'){const t=tgt();if(t==null||!needIntel(2))return;log('🗣️ '+p.name+' leaks dirt on '+pname(t)+'.');addCortisol(t,2,'dirt in the morning paper')}
 else if(act==='audit'){const t=tgt();if(t==null||!own('asic')||!ready(p,'audit',20)||!spend(4))return;log('⚖️ '+p.name+' sends the regulator after '+pname(t)+'.');addCortisol(t,1,'a very thorough audit')}
 else if(act==='tweet'){const t=tgt();if(t==null||!own('trump')||!ready(p,'tweet',12)||!spend(2))return;log('🦅 '+p.name+' tweets. Devastating.');addCortisol(t,1,'a single tweet')}
 else if(act==='spin'){
  const kind=m.kind==='fox'?'fox':'press';if(!own(kind))return;const cost=kind==='fox'?2:3,cool=kind==='fox'?3:2;
  if(!ready(p,'spin',15)){toast(pi,'The press room is between deadlines.');return}
  if(m.mode==='roast'){const t=tgt();if(t==null||!spend(cost)){p.cd.spin=0;return}log('🗞️ '+p.name+' roasts '+pname(t)+' in the press.');addCortisol(t,1,'unflattering coverage')}
  else{if(!spend(cost)){p.cd.spin=0;return}log('🗞️ '+p.name+' spins the story smooth.');addCortisol(pi,-cool,'friendly coverage')}
 }
 else if(act==='cook'){if(!own('rock')||!ready(p,'cook',20)||!spend(3))return;log('💪 '+p.name+' cooks the books. What numbers?');addCortisol(pi,-3,'a very warm kitchen')}
 else if(act==='pressure'){if(!own('back')||!ready(p,'pressure',40))return;log('🤝 '+p.name+' leans on the table.');S.players.forEach((pl,j)=>{if(j!==pi)addCortisol(j,1,'a backroom deal gone loud')})}
 else if(act==='budget'){if(!own('gov')||!ready(p,'budget',40)||!spend(3))return;log('🦘 BUDGET NIGHT! '+p.name+' reads the numbers.');S.players.forEach((pl,i)=>{if(i!==pi)payTo(i,1,pi,'the Treasurer collects')});giveIntel(pi,1,'you saw the budget first');banner('🦘 BUDGET NIGHT',p.name+' reads the numbers — everyone pays $1','#168388','🦘','event')}
 else if(act==='push'){if(!own('sisy')||!atNode(pi,'sisy')||!ready(p,'push',8))return;gain(pi,3,'pushed the boulder uphill');addCortisol(pi,1,'it rolls back down by morning')}
 else if(act==='jog'){if(!own('asics')||!atNode(pi,'asics')||!ready(p,'jog',6))return;log('👟 '+p.name+' jogs a lap in the circled shoe.');addCortisol(pi,-1,'a cooling lap')}
 else if(act==='spy'){if(!needIntel(2))return;p.spyUntil=S.t+30;log('🛈 '+p.name+' buys a look at tomorrow.')}
 else if(act==='bury'){if(!(p.spyUntil>S.t||own('jt')||own('iface')||(own('term')&&atNode(pi,'term'))))return;if(!ready(p,'bury',30))return;const c=S.deck.pop();S.deck.unshift(c);S.nextId=S.deck[S.deck.length-1];log('📈 '+p.name+' buries the story at the bottom of the deck.')}
 else if(act==='dossier'){if(p.dossierUntil>S.t||!needIntel(3))return;p.dossierUntil=S.t+30;fxAt(pi,'📂 THE DOSSIER','#e19bff');log('📂 '+p.name+' opens THE DOSSIER — takeovers cost list price for 30s.')}
 else if(act==='sweep'){if(!needIntel(2))return;const mine=Object.keys(S.bugs).filter(id=>S.owner[id]===pi);mine.forEach(id=>delete S.bugs[id]);log('🧹 '+p.name+' sweeps the office — '+(mine.length?mine.length+' bug(s) found.':'nothing found. Paranoia is free; the sweep cost 2 Intel.'))}
 else if(act==='masspanic'){if(!needIntel(5))return;log('🔥 '+p.name+' unleashes MASS PANIC — everyone gains +2 Cortisol.');banner('🔥 MASS PANIC',p.name+' lit the fuse — everyone +2 Cortisol','#ff6b5e','🔥','event');S.players.forEach((pl,j)=>addCortisol(j,2,'mass panic'))}
 else if(act==='sell'){const n=Math.min(Math.max(1,m.n|0),p.intel);if(n<=0){toast(pi,'No Intel to sell.');return}const rate=MOODS[S.mood].rate;p.intel-=n;fxAt(pi,'🛈−'+n,'#55c1ff');gain(pi,n*rate,'sold '+n+' Intel at the rumor exchange ($'+rate+'/🛈)')}
 else if(act==='buy'){
  const it=QUIK_PRICES[m.item];if(!it||!atNode(pi,'quik',4)){toast(pi,'Stand at the Quikstop.');return}
  if(p.money<it[0]){toast(pi,'Costs $'+it[0]+'.');return}
  if(m.item==='hp'&&p.hp>=100||m.item==='armor'&&p.armor>=100){toast(pi,'You are already topped up.');return}
  p.money-=it[0];fxAt(pi,'−$'+it[0],'#ff6b5e');
  if(m.item==='hp')p.hp=Math.min(100,p.hp+50);else if(m.item==='armor')p.armor=Math.min(100,p.armor+50);else emitTo(pi,{t:'grant',k:m.item,w:null,v:m.item==='gren'?1:2});
  const q=S.owner.quik;if(q!=null&&q!==pi)gain(q,1,'a sale at your Quikstop');
 }
 else return;
 sync();
}

/* ================= WIN ================= */
function winCheck(){
 if(!S||S.over)return true;
 let win=-1;
 S.players.forEach((pl,i)=>{if(pl.alive&&pl.money>=S.goal&&!missingTypes(i).length&&(win<0||pl.money>S.players[win].money))win=i});
 if(win>=0){endGame(win,'con');return true}
 const al=S.players.map((p,i)=>i).filter(i=>S.players[i].alive);
 if(S.players.length>1&&al.length<=1){endGame(al.length?al[0]:-1,'last');return true}
 if(S.humans>0&&!al.some(i=>!S.players[i].bot)){endGame(al.sort((a,b)=>S.players[b].money-S.players[a].money)[0],'bots');return true}
 return false;
}
function endGame(win,how){
 if(S.over)return;S.over=true;S.winner=win;S.how=how;S.phase='over';
 const board=S.players.map((p,i)=>({i,name:p.name,money:p.money,kills:p.kills,alive:p.alive,nodes:NODES.filter(n=>S.owner[n.id]===i).length,char:p.char,color:p.color})).sort((a,b)=>(b.alive-a.alive)||b.money-a.money);
 log(win>=0?'🏆 '+pname(win)+' wins — '+(how==='con'?'the con is complete.':how==='last'?'last con standing.':'the field is picked clean.'):'🏆 Nobody walks away.');
 sync(true);emit({t:'over',win,how,board,goal:S.goal});
}

/* ================= HOST FRAME ================= */
function hostStep(dt){
 if(!S||S.over)return;
 S.t+=dt;
 if(S.phase==='jet'&&S.t>=S.jet.dur){
  S.phase='play';S.tPlay=S.t;S.nextTick=S.t+TICK_SEC;S.nextEvent=S.t+EVENT_SEC;initZone();
  banner('THE JET HAS LEFT','Seize exhibits, collect loot, stay inside the dragnet. Last con standing — or complete the Big Con.','#168388','🪂','info');sync(true);
 }
 if(typeof botsStep==='function')botsStep(dt);
 if(S.phase==='play'){zoneStep(dt);tickStep();eventStep()}
 grenadesStep(dt);
 if(S.phase==='play'&&!S.over)winCheck();
}
function addChat(pi,text){if(!S)return;S.chat.push({n:pi,t:text});S.chatN=(S.chatN|0)+1;if(S.chat.length>40)S.chat.shift();sync()}
