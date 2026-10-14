'use strict';
/* THE BIG CON 3D — HUD, menus, maps, sound and the lobby wiring. */
const UI={menu:{open:false,page:0,sub:null},map:{open:false,mode:null},promptState:null,chatSeen:0,fxSeen:0,solo:false,logSeen:0};
const myP=()=>S&&S.players[Net.myIdx];
const act=(a,extra)=>sendHost(Object.assign({t:'intent',act:a},extra||{}));
const fmt=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

/* ---------------- sound ---------------- */
const SFX={ctx:null,on:true,music:false,step:0,tm:null};
SFX.init=function(){if(SFX.ctx)return;try{const C=window.AudioContext||window.webkitAudioContext;SFX.ctx=new C();SFX.master=SFX.ctx.createGain();SFX.master.gain.value=.5;SFX.master.connect(SFX.ctx.destination);
 const len=SFX.ctx.sampleRate*.5,b=SFX.ctx.createBuffer(1,len,SFX.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;SFX.nb=b}catch(e){SFX.ctx=null}};
SFX.tone=function(f,dur,type,vol,slide,delay){
 if(!SFX.ctx||!SFX.on)return;const c=SFX.ctx,t=c.currentTime+(delay||0),o=c.createOscillator(),g=c.createGain();
 o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+dur);
 g.gain.setValueAtTime(vol||.2,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(SFX.master);o.start(t);o.stop(t+dur+.02);
};
SFX.noise=function(dur,vol,freq,delay){
 if(!SFX.ctx||!SFX.on)return;const c=SFX.ctx,t=c.currentTime+(delay||0),s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
 s.buffer=SFX.nb;f.type='bandpass';f.frequency.value=freq||1800;g.gain.setValueAtTime(vol||.2,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(SFX.master);s.start(t);s.stop(t+dur+.02);
};
SFX.play=function(n,vol){
 vol=vol==null?1:vol;
 switch(n){
  case 'w0':SFX.noise(.09,.28*vol,2400);SFX.tone(420,.08,'square',.1*vol,120);break;
  case 'w1':SFX.noise(.06,.22*vol,3000);SFX.tone(300,.05,'sawtooth',.08*vol,150);break;
  case 'w2':SFX.noise(.08,.26*vol,1800);SFX.tone(220,.09,'sawtooth',.12*vol,90);break;
  case 'w3':SFX.noise(.22,.45*vol,900);SFX.tone(110,.2,'square',.2*vol,40);break;
  case 'w4':SFX.noise(.35,.5*vol,700);SFX.tone(160,.4,'sawtooth',.25*vol,30);break;
  case 'hit':SFX.tone(1200,.05,'square',.14);break;
  case 'hs':SFX.tone(1800,.07,'square',.18);SFX.tone(2400,.07,'square',.12,0,.05);break;
  case 'kill':SFX.tone(500,.1,'square',.18);SFX.tone(750,.1,'square',.18,0,.09);SFX.tone(1100,.18,'square',.2,0,.18);break;
  case 'hurt':SFX.noise(.12,.35,400);SFX.tone(90,.15,'sine',.3);break;
  case 'pick':SFX.tone(700,.05,'triangle',.14);SFX.tone(1000,.07,'triangle',.14,0,.05);break;
  case 'cash':SFX.tone(1300,.06,'triangle',.16);SFX.tone(1700,.12,'triangle',.16,0,.06);break;
  case 'seize':SFX.tone(220,.12,'square',.2);SFX.tone(330,.12,'square',.2,0,.1);SFX.tone(440,.25,'square',.22,0,.2);break;
  case 'raid':for(let k=0;k<6;k++)SFX.tone(k%2?620:880,.2,'sawtooth',.18,0,k*.2);break;
  case 'event':SFX.tone(330,.15,'triangle',.2);SFX.tone(440,.15,'triangle',.2,0,.14);SFX.tone(660,.3,'triangle',.22,0,.28);break;
  case 'zone':for(let k=0;k<3;k++)SFX.tone(240,.25,'square',.16,0,k*.4);break;
  case 'boom':SFX.noise(.6,.7*vol,260);SFX.tone(70,.5,'sine',.5*vol,25);break;
  case 'reload':SFX.noise(.05,.15,1500);SFX.noise(.05,.18,2200,.35);break;
  case 'empty':SFX.tone(160,.04,'square',.1);break;
  case 'jump':SFX.noise(.15,.1,500);break;
 }
};
SFX.startMusic=function(){
 if(!SFX.ctx||SFX.tm)return;
 const root=[55,55,65.4,49];
 SFX.tm=setInterval(()=>{
  if(!SFX.on||!SFX.music||!S)return;const s=SFX.step++%16,bar=(SFX.step>>4)%4,hot=S.zone&&S.zone.st==='shrink';
  if(s%4===0){SFX.tone(130,.14,'sine',.22,45)}
  if(s%2===1)SFX.noise(.03,.05,7000);
  if([0,3,6,8,11,14].includes(s))SFX.tone(root[bar]*(s===6||s===14?1.5:1),.2,'sawtooth',.075,0);
  if(hot&&s%2===0)SFX.tone(root[bar]*4*(1+((s>>1)%3)*.25),.1,'square',.04);
 },135);
};
SFX.toggle=function(){SFX.music=!SFX.music;UI.toast(SFX.music?'🎵 music on':'🎵 music off');if(SFX.music)SFX.startMusic()};

/* ---------------- toasts, banners, feed ---------------- */
UI.toast=function(msg){
 if(!Game.started){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(UI._tt);UI._tt=setTimeout(()=>t.classList.remove('show'),2600);return}
 const box=$('toasts'),d=document.createElement('div');d.textContent=msg;box.appendChild(d);
 while(box.children.length>3)box.removeChild(box.firstChild);setTimeout(()=>{if(d.parentNode)d.parentNode.removeChild(d)},3200);
};
UI.banner=function(m){
 const box=$('banner'),d=document.createElement('div');d.className='bn';d.style.borderColor=m.color||'#168388';
 d.innerHTML='<div class="bt" style="color:'+(m.kind==='raid'||m.kind==='zone'?'#ff6b5e':m.kind==='streak'?'#f5c542':'#8ff')+'">'+(m.icon?m.icon+' ':'')+esc(m.title)+'</div>'+(m.sub?'<div class="bs">'+esc(m.sub)+'</div>':'');
 box.appendChild(d);while(box.children.length>3)box.removeChild(box.firstChild);
 setTimeout(()=>d.classList.add('out'),m.kind==='event'?6500:4200);setTimeout(()=>{if(d.parentNode)d.parentNode.removeChild(d)},7200);
};
UI.bigfx=function(text,color){const b=$('bigfx'),d=document.createElement('div');d.textContent=text;d.style.color=color||'#fff';b.appendChild(d);setTimeout(()=>{if(d.parentNode)d.parentNode.removeChild(d)},3100)};
UI.feed=function(html){const f=$('feed'),d=document.createElement('div');d.innerHTML=html;f.appendChild(d);while(f.children.length>6)f.removeChild(f.firstChild);setTimeout(()=>{if(d.parentNode)d.parentNode.removeChild(d)},9000)};
UI.fatal=function(msg){
 const ov=document.createElement('div');ov.className='overlay';
 ov.innerHTML='<div class="mcard"><div class="mtitle">CONNECTION LOST</div><div class="mbody"><p>'+esc(msg)+'</p></div><div class="mopts"><button onclick="location.reload()">Reload</button></div></div>';document.body.appendChild(ov);
};
UI.hint=function(html){const h=$('hint');if(h._last!==html){h._last=html;h.innerHTML=html}};
UI.cap=function(f){const c=$('capbar');if(f==null){c.style.display='none';return}c.style.display='block';c.firstChild.style.width=Math.round(f*100)+'%'};
UI.hitmark=function(kind){const h=$('hitm');h.className='on'+(kind?' '+kind:'');clearTimeout(UI._hm);UI._hm=setTimeout(()=>{h.className=''},90)};
UI.vig=function(cls,ms){const v=$('vig');v.classList.add(cls);setTimeout(()=>v.classList.remove(cls),ms)};

/* ---------------- non-blocking prompts (digits answer) ---------------- */
UI.prompt=function(opt){
 return new Promise(res=>{
  const ov=$('promptov');const opts=(opt.options||[{label:'OK',v:1}]).slice(0,9);
  const done=v=>{if(UI.promptState!==st)return;UI.promptState=null;ov.style.display='none';clearTimeout(st.t);res(v)};
  const st=UI.promptState={opts,done,def:opt.def,t:setTimeout(()=>done(opt.def!==undefined?opt.def:opts[0].v),opt.timeout||20000)};
  ov.innerHTML='<div class="ph">'+esc(opt.title||'')+'</div>'+(opt.body?'<div class="pb">'+esc(opt.body)+'</div>':'')+opts.map((o,i)=>'<div class="po" data-i="'+i+'"><b>'+(i+1)+'</b>'+esc(o.label)+'</div>').join('');
  ov.style.display='block';ov.querySelectorAll('.po').forEach(el=>el.onclick=()=>done(opts[+el.dataset.i].v));
 });
};
UI.promptKey=function(d){const st=UI.promptState;if(!st)return false;const o=st.opts[d-1];if(!o)return false;st.done(o.v);return true};

/* ---------------- the Con Menu ---------------- */
function menuItems(){
 const me=Net.myIdx,p=myP(),own=id=>S.owner[id]===me,T=curT(),it=[];
 const q=P[me]||{x:0,z:0},atN=id=>{const n=NMAP[id];return n&&Math.hypot(q.x-n.wx,q.z-n.wz)<=NODE_R+2.5};
 const tgt=(l,sub,a,extra,en)=>it.push({l,sub,en:en!==false,run:()=>UI.menuTarget(l,a,extra)});
 const now=(l,sub,a,extra,en)=>it.push({l,sub,en:en!==false,run:()=>{act(a,extra);UI.menuClose()}});
 if(atN('quik')){
  [['hp','BANDAGE +50 HP','$3'],['armor','VEST +50 ARMOR','$5'],['ammo','AMMO RESUPPLY','$2'],['gren','MARGIN CALL (grenade)','$4']].forEach(a=>now('QUIKSTOP: '+a[1],a[2],'buy',{item:a[0]},p.money>=+a[2].slice(1)));
 }
 if(own('sisy')&&atN('sisy'))now('PUSH THE BOULDER','+$3 · +1 🔥','push');
 if(own('asics')&&atN('asics'))now('JOG A LAP','−1 🔥','jog');
 const peek=p.spyUntil>T||own('jt')||own('iface')||(own('term')&&atN('term'));
 if(peek)now('BURY THE NEXT EVENT','free · 30s cd','bury');
 now('CASH A FAVOR','1🛈 · speed boost 7s','favor',null,p.intel>=1);
 if(own('f1'))now('THE SLIPSTREAM','$2 · speed + $2 off a seizure','slip',null,p.money>=2);
 if(own('qantas'))it.push({l:'FLY THE JET',sub:'$3 · teleport anywhere',en:p.money>=3,run:()=>{UI.menuClose();UI.mapOpen('fly')}});
 if(own('rock'))now('COOK THE BOOKS','$3 · −3 🔥','cook',null,p.money>=3);
 if(own('press'))now('SPIN THE PRESS','$3 · −2 🔥 on you','spin',{kind:'press',mode:'cool'},p.money>=3);
 if(own('fox'))now('FOX SPIN','$2 · −3 🔥 on you','spin',{kind:'fox',mode:'cool'},p.money>=2);
 if(own('press'))tgt('ROAST A RIVAL','$3 · +1 🔥','spin',{kind:'press',mode:'roast'},p.money>=3);
 if(own('fox'))tgt('FOX ROAST','$2 · +1 🔥','spin',{kind:'fox',mode:'roast'},p.money>=2);
 if(own('asic'))tgt('AUDIT','$4 · +1 🔥 · 20s','audit',null,p.money>=4);
 if(own('trump'))tgt('THE TWEET','$2 · +1 🔥 · 12s','tweet',null,p.money>=2);
 tgt('LEAK DIRT','2🛈 · +2 🔥 on a rival','leak',null,p.intel>=2);
 if(own('back'))now('LEAN ON THE TABLE','everyone else +1 🔥 · 40s','pressure');
 if(own('gov'))now('BUDGET NIGHT','$3 · all rivals pay $1','budget',null,p.money>=3);
 now('SPY ON THE DECK','2🛈 · see the next event 30s','spy',null,p.intel>=2);
 now('OPEN THE DOSSIER','3🛈 · takeovers at list price 30s','dossier',null,p.intel>=3);
 now('SWEEP FOR BUGS','2🛈 · clear bugs on your exhibits','sweep',null,p.intel>=2);
 now('MASS PANIC','5🛈 · EVERYONE +2 🔥 (you too)','masspanic',null,p.intel>=5);
 now('SELL INTEL','1🛈 = $'+MOODS[S.mood].rate+' (all of it)','sell',{n:p.intel},p.intel>0);
 return it;
}
UI.menuOpen=function(){UI.menu.open=true;UI.menu.page=0;UI.menu.sub=null;UI.menuRender();$('menu').style.display='block'};
UI.menuClose=function(){UI.menu.open=false;UI.menu.sub=null;$('menu').style.display='none'};
UI.menuTarget=function(label,a,extra){UI.menu.sub={label,a,extra};UI.menu.page=0;UI.menuRender()};
UI.menuRender=function(){
 const m=$('menu');if(!UI.menu.open||!S)return;let h='<div class="mh">THE CON MENU</div>';
 if(UI.menu.sub){
  const rv=rivalList(Net.myIdx,9);UI.menu.subList=rv;
  h+='<div class="mf">'+esc(UI.menu.sub.label)+' — WHO?</div>';
  h+=rv.map((i,k)=>'<div class="mi" data-t="'+i+'"><b>'+(k+1)+'</b>'+esc(S.players[i].name)+'<small>🔥'+S.players[i].cortisol+' · $'+Math.round(S.players[i].money)+'</small></div>').join('')||'<div class="mi dis">nobody left</div>';
  h+='<div class="mf">Q / ESC — back</div>';
 }else{
  const items=menuItems();UI.menu.items=items;const pages=Math.max(1,Math.ceil(items.length/8)),pg=UI.menu.page%pages;UI.menu.pg=pg;
  h+=items.slice(pg*8,pg*8+8).map((x,k)=>'<div class="mi'+(x.en?'':' dis')+'" data-k="'+(pg*8+k)+'"><b>'+(k+1)+'</b>'+esc(x.l)+'<small>'+esc(x.sub)+'</small></div>').join('');
  h+='<div class="mf">'+(pages>1?'0 — more ('+(pg+1)+'/'+pages+') · ':'')+'Q — close</div>';
 }
 m.innerHTML=h;
 m.querySelectorAll('.mi[data-k]').forEach(el=>el.onclick=()=>UI.menuPick(+el.dataset.k));
 m.querySelectorAll('.mi[data-t]').forEach(el=>el.onclick=()=>UI.menuTargetPick(+el.dataset.t));
};
UI.menuPick=function(k){const x=UI.menu.items[k];if(x&&x.en)x.run();else if(x)UI.toast('Not available right now.')};
UI.menuTargetPick=function(t){const s=UI.menu.sub;if(!s)return;act(s.a,Object.assign({target:t},s.extra||{}));UI.menuClose()};
UI.menuKey=function(d){
 if(d===0){UI.menu.page++;UI.menuRender();return}
 if(UI.menu.sub){const t=UI.menu.subList&&UI.menu.subList[d-1];if(t!=null)UI.menuTargetPick(t);return}
 UI.menuPick(UI.menu.pg*8+d-1);
};

/* ---------------- maps ---------------- */
const B2C=(wx,wz)=>[wx*2.5+600,wz*2.5+390];
UI.mapOpen=function(mode){UI.map.open=true;UI.map.mode=mode||null;$('bigmap').style.display='block';$('maphelp').textContent=mode==='fly'?'✈️ FLY THE JET — CLICK AN EXHIBIT ($3) · M or ESC to cancel':'THE EVIDENCE BOARD — M to close';if(document.exitPointerLock)document.exitPointerLock();UI.mapDraw()};
UI.mapClose=function(){UI.map.open=false;$('bigmap').style.display='none'};
UI.mapDraw=function(){
 const c=$('mapc'),g=c.getContext('2d');g.fillStyle='#111413';g.fillRect(0,0,1200,780);
 g.strokeStyle='rgba(208,53,42,.7)';g.lineWidth=1.5;g.beginPath();EDGES.forEach(e=>{const a=NMAP[e[0]],b=NMAP[e[1]];if(!a||!b)return;const A=B2C(a.wx,a.wz),Bc=B2C(b.wx,b.wz);g.moveTo(A[0],A[1]);g.lineTo(Bc[0],Bc[1])});g.stroke();
 const z=S.zone;
 if(z){g.lineWidth=3;g.strokeStyle=z.st==='shrink'?'#ff4a3a':'#2ad4dc';const C=B2C(z.cx,z.cz);g.beginPath();g.arc(C[0],C[1],z.r*2.5,0,7);g.stroke();
  if(z.st!=='shrink'&&!z.done){g.strokeStyle='#fff';g.setLineDash([8,6]);const N=B2C(z.tcx,z.tcz);g.beginPath();g.arc(N[0],N[1],z.tr*2.5,0,7);g.stroke();g.setLineDash([])}}
 g.font='10px system-ui';g.textAlign='center';
 for(const n of NODES){
  const C=B2C(n.wx,n.wz),ow=S.owner[n.id],live=zoneLive(n);
  g.fillStyle=ow!=null&&S.players[ow]?S.players[ow].color:(live?'#2a3333':'#171a1a');g.fillRect(C[0]-11,C[1]-8,22,16);
  g.lineWidth=2;g.strokeStyle=TYPE_COLORS[n.type]||'#666';g.strokeRect(C[0]-11,C[1]-8,22,16);
  g.fillStyle=live?'#cfe':'#566';g.fillText((n.icon||'')+n.name[0].slice(0,16),C[0],C[1]+21);
 }
 const me=P[Net.myIdx],L=leaderIdx();
 if(L>=0&&P[L]&&L!==Net.myIdx){const C=B2C(P[L].x,P[L].z);g.fillStyle='#ff4a4a';g.font='bold 16px system-ui';g.fillText('★ WANTED',C[0],C[1]-6)}
 if(me){const C=B2C(me.x,me.z);g.save();g.translate(C[0],C[1]);g.rotate(me.yaw);g.fillStyle='#f5c542';g.strokeStyle='#000';g.lineWidth=2;g.beginPath();g.moveTo(0,-11);g.lineTo(8,8);g.lineTo(-8,8);g.closePath();g.fill();g.stroke();g.restore()}
};
UI.mapClick=function(e){
 if(UI.map.mode!=='fly')return;const c=$('mapc'),r=c.getBoundingClientRect(),x=(e.clientX-r.left)*1200/r.width,y=(e.clientY-r.top)*780/r.height;
 let b=null,bd=34;for(const n of NODES){const C=B2C(n.wx,n.wz),d=Math.hypot(C[0]-x,C[1]-y);if(d<bd){bd=d;b=n}}
 if(b){act('fly',{nid:b.id});UI.mapClose()}
};
UI.nodeImg=function(n){
 // Cache the request once per node. Resolve from the page URL (not the current
 // route) and let URL encode spaces in asset filenames consistently.
 if(n._mm===undefined){
  n._mm=null;
  if(!n.image){n._mm=false}
  else{
   const im=new Image();
   n._mm=im;
   im.onload=()=>{if(UI.mini)UI.mini()};
   im.onerror=()=>{
    console.warn('[minimap] image failed to load:',n.id,n.image,im.src);
    n._mm=false;
    if(UI.mini)UI.mini();
   };
   try{im.src=new URL(n.image,document.baseURI).href}
   catch(e){console.warn('[minimap] invalid image URL:',n.id,n.image,e);n._mm=false}
  }
 }
 return n._mm&&n._mm.complete&&n._mm.naturalWidth>0?n._mm:null;
};

UI.mini=function(){
 const c=$('mini'),g=c.getContext('2d'),me=P[Net.myIdx];if(!me||!S)return;
 const R_=70,k=380/(2*R_),cx=190,cy=190;
 g.save();g.clearRect(0,0,380,380);g.beginPath();g.arc(cx,cy,190,0,7);g.clip();g.fillStyle='#0b1010';g.fillRect(0,0,380,380);
 g.translate(cx,cy);g.rotate(-me.yaw);
 const tx=wx=>(wx-me.x)*k,tz=wz=>(wz-me.z)*k;
 g.strokeStyle='rgba(208,53,42,.55)';g.lineWidth=2;g.beginPath();EDGES.forEach(e=>{const a=NMAP[e[0]],b=NMAP[e[1]];if(!a||!b)return;g.moveTo(tx(a.wx),tz(a.wz));g.lineTo(tx(b.wx),tz(b.wz))});g.stroke();
 const z=S.zone;
 if(z){g.lineWidth=5;g.strokeStyle=z.st==='shrink'?'#ff4a3a':'#2ad4dc';g.beginPath();g.arc(tx(z.cx),tz(z.cz),z.r*k,0,7);g.stroke();
  if(z.st!=='shrink'&&!z.done){g.lineWidth=3;g.strokeStyle='#fff';g.beginPath();g.arc(tx(z.tcx),tz(z.tcz),z.tr*k,0,7);g.stroke()}}
const TW=46,TH=34;
for(const n of NODES){
 const x=tx(n.wx),y=tz(n.wz);if(Math.abs(x)>260||Math.abs(y)>260)continue;
 const ow=S.owner[n.id],own=ow!=null&&S.players[ow],col=own?S.players[ow].color:(TYPE_COLORS[n.type]||'#888'),live=zoneLive(n),im=UI.nodeImg(n);
 g.save();g.translate(x,y);g.rotate(me.yaw);if(!live)g.globalAlpha=.5;
 const bw=own?4:3;
 g.fillStyle=col;g.fillRect(-TW/2-bw,-TH/2-bw,TW+bw*2,TH+bw*2);
 const dark=n.shape==='chart'||n.shape==='news';
 g.fillStyle=dark?'#0e1414':'#f3eee0';g.fillRect(-TW/2,-TH/2,TW,TH);
 if(im&&im.width){
  const cover=n.shape==='photo'||n.shape==='news'||n.shape==='sat'||n.shape==='wide';
  const s=cover?Math.max(TW/im.width,TH/im.height):Math.min(TW/im.width,TH/im.height);
  g.save();g.beginPath();g.rect(-TW/2,-TH/2,TW,TH);g.clip();g.drawImage(im,-im.width*s/2,-im.height*s/2,im.width*s,im.height*s);g.restore();
 }else{g.fillStyle=dark?'#1f2c2c':'#999';g.font='20px serif';g.textAlign='center';g.textBaseline='middle';g.fillText(n.icon||'📌',0,1)}
 g.strokeStyle='#000';g.lineWidth=2;g.strokeRect(-TW/2-bw,-TH/2-bw,TW+bw*2,TH+bw*2);
 g.restore();}
};

/* ---------------- the HUD (10 Hz) ---------------- */
UI.hud=function(){
 if(!S)return;const me=Net.myIdx,p=S.players[me];if(!p)return;const T=curT(),own=id=>S.owner[id]===me;
 // wire
 const mood=MOODS[S.mood];$('wireMood').textContent=mood.label;$('wireMood').style.background=mood.color;$('wireMood').style.color='#000';
 let peek='';if(S.nextId&&(own('jt')||own('iface')||p.spyUntil>T||(own('term')&&P[me]&&Math.hypot(P[me].x-NMAP.term.wx,P[me].z-NMAP.term.wz)<NODE_R+2.5)))peek='   ·   🔮 NEXT EVENT: '+CARDBYID[S.nextId].title;
 $('wireText').textContent=(S.wire||'')+peek;
 // top-left
 const alive=S.players.filter(x=>x.alive).length,miss=missingTypes(me);
 let l1;
 if(S.phase==='jet')l1='🛫 THE JET '+(T<JET_WAIT?'DEPARTS IN '+Math.ceil(JET_WAIT-T)+'s':'IS OVER THE BOARD — SPACE TO JUMP');
 else{const z=S.zone;l1='💵 income in '+fmt(S.nextTick-T)+' · 🎴 event in '+fmt(S.nextEvent-T);
  if(z)l1+='<br>'+(z.done?'<span style="color:#ff6b5e">FINAL CIRCLE</span>':z.st==='shrink'?'<span style="color:#ff6b5e">🚨 DRAGNET CLOSING — '+fmt(z.until-T)+'</span>':'🎯 dragnet closes in '+fmt(z.until-T)+' · ring '+(z.ph+1)+'/'+ZONE.length)}
 $('topl').innerHTML='<div class="big">'+alive+' <small style="font-size:12px;color:#9ad">ALIVE / '+S.players.length+'</small> &nbsp; <span style="font-size:13px;color:#ff8">'+p.kills+' BUSTS</span></div>'
  +'<div>'+l1+'</div><div class="goal">THE BIG CON: $'+Math.floor(p.money)+' / $'+S.goal+(p.money>=S.goal?' ✔':'')+'</div>'
  +'<div class="chips">'+WIN_TYPES.map(t=>'<span class="chip'+(miss.indexOf(t)<0?' on':'')+'" style="color:'+(TYPE_COLORS[t]||'#fff')+'">'+t.slice(0,4)+'</span>').join('')+'</div>';
 // bars
 const hp=Math.max(0,p.hp);$('hpb').firstChild.style.width=hp+'%';$('hpb').lastChild.textContent='HEALTH '+Math.ceil(hp);
 $('arb').firstChild.style.width=p.armor+'%';$('arb').lastChild.textContent='ARMOR '+Math.ceil(p.armor);
 const cl=$('cortlab');cl.textContent='CORTISOL '+p.cortisol+'/10'+(p.cortisol>=6?' — RAID AT 8!':'');cl.className='cortlab'+(p.cortisol>=6?' hot':'');
 let cs='';for(let i=0;i<10;i++){cs+='<b class="'+(i<p.cortisol?'on':'')+'" style="'+(i<p.cortisol?'background:'+(i<4?'#7fe08d':i<7?'#f5c542':'#ff5e4a'):'')+'"></b>'}$('cortrow').innerHTML=cs;
 $('cash').innerHTML='$'+Math.floor(p.money)+'<small>🛈 '+p.intel+'</small>'+(p.cuffs>T?'<small style="color:#ff6b5e">⛓ CUFFED '+Math.ceil(p.cuffs-T)+'s</small>':'')+(p.dossierUntil>T?'<small style="color:#e19bff">📂</small>':'');
 // weapon
 const w=Inv.slots[Inv.cur];
 if(w){$('wname').textContent=WEAPONS[w.id].n+(Inv.reloading?'  ·  RELOADING':'');$('ammo').innerHTML=w.mag+'<small> / '+w.res+'</small>'}
 $('slots').innerHTML=WORDER.map((id,i)=>{const h=Inv.slots.findIndex(s=>s.id===id);return '<span class="slot'+(h>=0?' has':'')+(h===Inv.cur?' cur':'')+'">'+(i+1)+'</span>'}).join('')+'<span class="slot'+(Inv.gren?' has':'')+'">💣'+Inv.gren+'</span>';
 // chat + log
 if(S.chatN!==UI.chatSeen){const fresh=S.chat.slice(-(S.chatN-UI.chatSeen));UI.chatSeen=S.chatN;fresh.forEach(m=>{const d=document.createElement('div');d.innerHTML='<b>'+esc(S.players[m.n]?S.players[m.n].name:'?')+':</b> '+esc(m.t);$('chatlog').appendChild(d);setTimeout(()=>{if(d.parentNode)d.parentNode.removeChild(d)},12000)});}
 // floating FX from state
 const maxFx=(S.fx||[]).reduce((a,f)=>Math.max(a,f.id),0);
 (S.fx||[]).forEach(f=>{
  if(f.id<=UI.fxSeen)return;
  if(f.b){UI.bigfx(f.t,f.c)}
  else if(f.pi!=null){const q=P[f.pi];if(q&&S.players[f.pi]&&S.players[f.pi].alive){if(f.pi===Net.myIdx){UI.feed('<span style="color:'+f.c+'">'+esc(f.t)+'</span>')}R.float(q.x,q.y+2.7,q.z,f.t,f.c)}}
  else if(f.x!=null&&f.t){const wx=(f.x-1200)*SC,wz=(f.y-780)*SC;R.float(wx,12,wz,f.t,f.c)}
 });
 if(maxFx>UI.fxSeen)UI.fxSeen=maxFx;
 if(UI.menu.open&&!UI.menu.sub)UI.menuRender();
 // vignettes
 const z=S.zone,q=P[me];
 if(z&&q&&p.alive&&Math.hypot(q.x-z.cx,q.z-z.cz)>z.r)$('vig').classList.add('zone');else $('vig').classList.remove('zone');
 if(p.cortisol>=6)$('vig').classList.add('heat');else $('vig').classList.remove('heat');
 // spectate label
 const sp=$('spec');if(!p.alive&&!S.over){sp.style.display='block';$('specinfo').innerHTML=Game.spec>=0&&S.players[Game.spec]?'👁 watching <b>'+esc(S.players[Game.spec].name)+'</b> — click / SPACE for next · M map':'no one left to watch'}else sp.style.display='none';
};
UI.over=function(m){
 const w=m.win>=0?S.players[m.win]:null;
 const why=m.how==='con'?'completes THE BIG CON — $'+m.goal+' and one of every node type.':m.how==='last'?'is the last con standing.':'picks the field clean.';
 const rows=m.board.map((b,k)=>'<div><span>'+(k+1)+'.</span><img src="'+charSrc(b.char)+'" alt=""><span class="wn" style="color:'+b.color+'">'+esc(b.name)+'</span><span>'+b.nodes+' ex · '+b.kills+' busts · $'+Math.floor(b.money)+'</span></div>').join('');
 const me=S.players[Net.myIdx];
 const eliminated=UI.solo&&me&&!me.alive&&me.eliminatedBy ? '<p style="text-align:center;margin:12px 0;color:#ff8b7b;font-weight:800">YOU WERE ELIMINATED BY '+esc(me.eliminatedBy).toUpperCase()+'</p>' : '';
 const ov=document.createElement('div');ov.className='overlay';ov.style.zIndex=300;
 ov.innerHTML='<div class="mcard"><div class="mtitle">🏆 THE BIG CON PAYS OUT</div><div class="mbody"><div class="winname" style="color:'+(w?w.color:'#fff')+'">'+esc(w?w.name:'NOBODY')+'</div><p style="text-align:center">'+(w?'<b>'+esc(w.name)+'</b> '+why:'Nobody walks away.')+' The market was rigged. It was rigged by <b>them</b>.</p>'+eliminated+'<div class="winlist">'+rows+'</div></div><div class="mopts"><button onclick="location.reload()">PLAY AGAIN</button></div></div>';
 document.body.appendChild(ov);if(document.exitPointerLock)document.exitPointerLock();SFX.play('kill');
};

/* ---------------- lobby wiring ---------------- */
UI.rules=function(){
 const ov=document.createElement('div');ov.className='overlay';
 ov.innerHTML='<div class="mcard"><div class="mtitle">HOW TO PLAY — THE BIG CON 3D</div><div class="mbody">'
 +'<h4>The idea</h4><p>Up to 24 cons drop from the Qantas jet onto the evidence board. The old rules still run the show: <b>money</b> seizes exhibits, every deal adds <b>Cortisol</b>, and the <b>Market Event deck</b> shakes the whole table.</p>'
 +'<h4>Two ways to win</h4><ul><li><b>Last con standing.</b> The dragnet shrinks — outside it you bleed health and Cortisol, and exhibits out there fall to the regulators.</li><li><b>Complete the Big Con.</b> Bank the target <i>and</i> hold one of every node type.</li></ul>'
 +'<h4>Seizing</h4><p>Stand at an exhibit and <b>hold E</b>. Unowned: list price. A rival\'s: <b>double</b> (and it keeps doubling), they get a buyout, and you take +2 Cortisol. Every exhibit you own pays income each 20-second tick, plus its special power.</p>'
 +'<h4>Cortisol & raids</h4><p>Seizing, takeovers, kills and the dragnet raise Cortisol. At 8 you are <b>raided</b>: your two best exhibits are seized, you are fined 30%, your Intel burns, and you are cuffed — slow, and unable to shoot — for 7 seconds.</p>'
 +'<h4>Busting</h4><p>Kill a con and you take 35% of their cash; the rest drops with a briefcase. Their exhibits go back to the regulators. The richest con is <b>WANTED</b> — everyone can see them.</p>'
 +'<h4>The Con Menu (Q)</h4><p>Intel and your exhibits unlock abilities: Spy, Dossier, Leak, Audit, Tweet, Spin, Cook the Books, Fly the Jet… and at the Quikstop you can buy health, armor, ammo and grenades.</p>'
 +'</div><div class="mopts"><button id="rulesOk">GOT IT</button></div></div>';
 document.body.appendChild(ov);ov.querySelector('#rulesOk').onclick=()=>document.body.removeChild(ov);
};
UI.bindSetup=function(){
 const dl=$('buzzwords');BUZZWORDS.forEach(b=>{const o=document.createElement('option');o.value=b;dl.appendChild(o)});

 const show=f=>{$('hostForm').classList.remove('show');$('joinForm').classList.remove('show');$(f).classList.add('show');setNetStatus(f==='hostForm'?(UI.solo?'Solo: type your name, then start the lobby.':'Type your name, then create the room.'):'Type your name and the room buzzword.');setTimeout(()=>{const e=$(f);if(e.scrollIntoView)e.scrollIntoView({behavior:'smooth',block:'center'})},30)};
 try{const n=localStorage.getItem('bigcon3d-name');if(n){$('hostName').value=n;$('joinName').value=n}}catch(e){}
 $('btnHost').onclick=()=>{UI.solo=false;show('hostForm');$('btnCreate').textContent='CREATE ROOM';$('hostName').focus()};
 $('btnSolo').onclick=()=>{UI.solo=true;show('hostForm');$('btnCreate').textContent='START SOLO LOBBY';$('hostName').focus()};
 $('btnJoin').onclick=()=>{show('joinForm');$('joinName').focus()};
 $('btnCreate').onclick=()=>{const n=cleanName($('hostName').value)||'Con Artist';try{localStorage.setItem('bigcon3d-name',n)}catch(e){}SFX.init();hostCreate(n,UI.solo||typeof Peer==='undefined')};
 $('btnJoinGo').onclick=()=>{const n=cleanName($('joinName').value)||'Con Artist',c=$('joinCode').value;if(!c.trim()){setNetStatus('Type the buzzword the host read out.',true);return}try{localStorage.setItem('bigcon3d-name',n)}catch(e){}SFX.init();guestJoin(n,c)};
 $('btnCopy').onclick=()=>{try{navigator.clipboard.writeText(Net.roomLabel||'')}catch(e){}UI.toast('code copied')};
 $('lobbyChatSend').onclick=sendLobbyChat;$('lobbyChatInput').onkeydown=e=>{if(e.key==='Enter')sendLobbyChat()};
 const ch=()=>{if(Net.role!=='host')return;Net.goal=clampGoal($('goalInput').value);Net.bots=Math.max(0,Math.min(MAXENT-Net.roster.length,parseInt($('botsInput').value||'0',10)||0));setGoalUI();broadcastLobby()};
 $('goalInput').onchange=ch;$('botsInput').onchange=ch;
 $('btnStart').onclick=()=>{SFX.init();startMatch()};
 $('btnRules').onclick=UI.rules;
 $('joinCode').onkeydown=e=>{if(e.key==='Enter')$('btnJoinGo').click()};
 $('hostName').onkeydown=e=>{if(e.key==='Enter')$('btnCreate').click()};
 $('mapc').onclick=UI.mapClick;
};
