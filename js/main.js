'use strict';
/* THE BIG CON 3D — the local player: input, movement, weapons, deals, and the frame loop. */
const Me={x:0,y:130,z:0,vx:0,vy:0,vz:0,yaw:0,pitch:0,mode:'jet',onGround:false,ads:false,recoil:0,flashT:0,bob:0,bobT:0,nextFire:0,cap:0,capLock:0,eye:EYE,lastPos:0,pkSkip:{},nextGren:0,landed:false,sprinting:false,firing:false,fl:0};
const Inv={slots:[{id:'stapler',mag:12,res:48}],cur:0,gren:0,reloading:false,reloadT:0};
const Keys={};
const Game={spec:-1,started:false,locked:false,lanes:[],space:false};
const SENS=.0022;

function hostStep(dt){
 if(typeof botsStep==='function')botsStep(dt);
 if(typeof gameStep==='function')gameStep(dt);
}

function curW(){return Inv.slots[Inv.cur]}
function selectWeapon(idx){
 const k=Inv.slots.findIndex(s=>s.id===WORDER[idx]);if(k<0||k===Inv.cur)return;
 Inv.cur=k;Inv.reloading=false;R.setWeapon(Inv.slots[k].id);SFX.play('pick');
}
function giveWeapon(id){
 const W=WEAPONS[id];let s=Inv.slots.find(x=>x.id===id);
 if(s){s.res+=W.mag;UI.toast('+ '+W.n+' ammo');return}
 Inv.slots.push({id,mag:W.mag,res:Math.floor(W.res/2)});Inv.slots.sort((a,b)=>WORDER.indexOf(a.id)-WORDER.indexOf(b.id));
 const cur=Inv.slots[Inv.cur];if(!cur||WORDER.indexOf(id)>WORDER.indexOf(cur.id)||Inv.slots.length===1){Inv.cur=Inv.slots.findIndex(x=>x.id===id);R.setWeapon(id)}
 UI.toast('🔫 picked up '+W.n);
}
function startReload(){
 const w=curW();if(!w||Inv.reloading)return;const W=WEAPONS[w.id];if(w.mag>=W.mag||w.res<=0)return;
 Inv.reloading=true;Inv.reloadT=W.rel;SFX.play('reload');
}
function laneNear(x,z){
 for(const l of Game.lanes){const a=l[0],b=l[1],dx=b.wx-a.wx,dz=b.wz-a.wz,L2=dx*dx+dz*dz||1;let t=((x-a.wx)*dx+(z-a.wz)*dz)/L2;t=Math.max(0,Math.min(1,t));if(Math.hypot(x-(a.wx+dx*t),z-(a.wz+dz*t))<1.4)return true}
 return false;
}
/* ---------- messages from the host ---------- */
Game.onMsg=function(m){
 const me=Net.myIdx;
 switch(m.t){
  case 'banner':UI.banner(m);SFX.play(m.kind==='raid'?'zone':m.kind==='zone'?'zone':'event');break;
  case 'feed':{
   const a=m.a>=0?S.players[m.a]:null,b=S.players[m.b];if(!b)break;
   UI.feed((a?'<b style=\"color:'+a.color+'\">'+esc(a.name)+'</b> ':'')+'<span style=\"color:#ff6b5e\">'+(a?'busted':'was busted —')+'</span> <b style=\"color:'+b.color+'\">'+esc(b.name)+'</b> <span style=\"color:#9ad\">'+esc(m.w)+(m.hs?' 🎯':'')+'</span>');
   break}
  case 'hurt':$('vig').classList.add('hurt');setTimeout(()=>$('vig').classList.remove('hurt'),160);SFX.play('hurt');R.shake=Math.max(R.shake,.12);break;
  case 'hitok':UI.hitmark(m.kill?'kill':m.hs?'hs':'');SFX.play(m.kill?'kill':m.hs?'hs':'hit');break;
  case 'busted':Game.spec=-1;UI.menuClose();UI.toast('💀 BUSTED'+(m.by>=0?' by '+S.players[m.by].name:' — '+m.w));if(document.exitPointerLock&&false)document.exitPointerLock();break;
  case 'raided':{const f=$('flash');f.classList.remove('on');void f.offsetWidth;f.classList.add('on');SFX.play('raid');R.shake=.5;break}
  case 'shot':{
   if(m.i===me)break;const col=WEAPONS[m.w]?WEAPONS[m.w].tr:'#ffe28a';
   (m.e||[]).forEach(e=>R.tracer(m.o,e,col));if(m.e&&m.e[0])R.spark(m.e[0][0],m.e[0][1],m.e[0][2],'#ffd27a',2,3);
   const d=Math.hypot(Me.x-m.o[0],Me.z-m.o[2]);const v=Math.max(0,1-d/120);if(v>0.05&&WEAPONS[m.w])SFX.play('w'+WEAPONS[m.w].snd,v*.8);break}
  case 'gren':R.mkGrenade(m);break;
  case 'boom':R.endGrenade(m.id);R.boom(m.x,m.y,m.z);{const d=Math.hypot(Me.x-m.x,Me.z-m.z);SFX.play('boom',Math.max(.15,1-d/150))}break;
  case 'grant':
   if(m.k==='wp')giveWeapon(m.w);
   else if(m.k==='ammo'){Inv.slots.forEach(s=>{const W=WEAPONS[s.id];s.res+=Math.ceil(W.mag*(m.v||1)*.75)});UI.toast('📦 ammo')}
   else if(m.k==='gren'){Inv.gren=Math.min(6,Inv.gren+(m.v||1));UI.toast('💣 MARGIN CALL +'+(m.v||1))}
   SFX.play('pick');break;
  case 'sys':UI.toast(m.msg);break;
  case 'tele':Me.x=m.x;Me.y=m.y;Me.z=m.z;Me.vx=Me.vz=Me.vy=0;R.shake=.2;SFX.play('jump');break;
  case 'tick':SFX.play('cash',.5);break;
  case 'drop':UI.toast('📦 '+m.why+' — check the map');break;
  case 'seized':{const n=NMAP[m.nid];if(n){R.spark(n.wx,6,n.wz,S.players[m.i]?S.players[m.i].color:'#fff',16,9);if(m.i===me){SFX.play('seize')}else{const d=Math.hypot(Me.x-n.wx,Me.z-n.wz);if(d<70)SFX.play('seize',.4)}}break}
  case 'over':UI.over(m);break;
 }
};
/* ---------- input ---------- */
function chatOpen(){const c=$('chatin');c.style.display='block';c.focus();Game.chatting=true}
function chatClose(send){
 const c=$('chatin'),t=c.value.trim();c.value='';c.style.display='none';c.blur();Game.chatting=false;
 if(send&&t){if(Net.role==='host')addChat(Net.myIdx,t);else sendHost({t:'chat',text:t})}
 if(!Game.locked&&!UI.map.open&&!S.over)$('pauseov').style.display='flex';
}
function nextSpec(from){
 const n=S.players.length;for(let k=1;k<=n;k++){const j=((from<0?-1:from)+k+n)%n;if(j!==Net.myIdx&&S.players[j].alive)return j}return -1;
}
function bindInput(){
 const gl=$('gl');
 gl.onclick=()=>{if(!Game.locked&&!UI.map.open)gl.requestPointerLock()};
 $('pauseov').onclick=()=>{SFX.init();gl.requestPointerLock()};
 document.addEventListener('pointerlockchange',()=>{
  Game.locked=document.pointerLockElement===gl;
  $('pauseov').style.display=(Game.locked||UI.map.open||(S&&S.over)||Game.chatting)?'none':'flex';
  if(!Game.locked){Keys.Mouse0=false;Me.ads=false}
 });
 document.addEventListener('mousemove',e=>{
  if(!Game.locked)return;const cw=curW(),zm=cw&&WEAPONS[cw.id].zoom,k=SENS*(Me.ads?(zm?1/zm:.7):1);
  Me.yaw+=e.movementX*k;Me.pitch=Math.max(-1.5,Math.min(1.5,Me.pitch-e.movementY*k));
 });
 document.addEventListener('mousedown',e=>{if(!Game.locked)return;if(e.button===0){Keys.Mouse0=true;if(!myP().alive)Game.spec=nextSpec(Game.spec)}if(e.button===2)Me.ads=true});
 document.addEventListener('mouseup',e=>{if(e.button===0)Keys.Mouse0=false;if(e.button===2)Me.ads=false});
 document.addEventListener('contextmenu',e=>e.preventDefault());
 document.addEventListener('wheel',e=>{if(!Game.locked||!Inv.slots.length)return;const d=e.deltaY>0?1:-1;const k=(Inv.cur+d+Inv.slots.length)%Inv.slots.length;Inv.cur=k;Inv.reloading=false;R.setWeapon(Inv.slots[k].id)},{passive:true});
 document.addEventListener('keydown',e=>{
  if(!S||!Game.started)return;
  if(Game.chatting){if(e.key==='Enter'){chatClose(true);e.preventDefault()}else if(e.key==='Escape'){chatClose(false);e.preventDefault()}return}
  if(e.target&&e.target.tagName==='INPUT')return;
  const c=e.code;
  if(e.key==='Tab'){e.preventDefault();return}
  if(c==='Enter'){chatOpen();e.preventDefault();if(document.exitPointerLock)document.exitPointerLock();return}
  if(c==='KeyM'){if(UI.map.open){UI.mapClose();if(!Game.locked)$('pauseov').style.display='flex'}else{UI.mapOpen()}return}
  if(c==='Escape'&&UI.map.open){UI.mapClose();$('pauseov').style.display='flex';return}
  if(c==='KeyN'){SFX.init();SFX.toggle();return}
  if(UI.map.open)return;
  Keys[c]=true;
  const dm=/^(Digit|Numpad)(\d)$/.exec(c);
  if(dm){const d=+dm[2];if(UI.promptState&&UI.promptKey(d))return;if(UI.menu.open){UI.menuKey(d);return}if(d>=1&&d<=5)selectWeapon(d-1);return}
  if(c==='KeyQ'||(c==='Escape'&&UI.menu.open)){if(UI.menu.open&&UI.menu.sub){UI.menu.sub=null;UI.menuRender()}else if(UI.menu.open)UI.menuClose();else if(myP().alive&&Me.mode==='ground')UI.menuOpen();return}
  if(c==='Space'){Game.space=true;e.preventDefault()}
  if(c==='KeyR')startReload();
  if(c==='KeyG')throwNade();
  if(c==='KeyB')plantBug();
 });
 document.addEventListener('keyup',e=>{Keys[e.code]=false});
}
function throwNade(){
 const p=myP();if(!p.alive||Me.mode!=='ground'||Inv.gren<=0||curT()<Me.nextGren||p.cuffs>curT())return;
 Inv.gren--;Me.nextGren=curT()+1.1;const d=dirFrom(Me.yaw,Me.pitch+.12);
 sendHost({t:'gren',o:[Me.x+d[0]*.7,Me.y+Me.eye,Me.z+d[2]*.7],v:[d[0]*19+Me.vx*.5,d[1]*19+4,d[2]*19+Me.vz*.5]});
}
function plantBug(){const n=nodeAt(Me.x,Me.z,NODE_R);if(n&&S.owner[n.id]!=null&&S.owner[n.id]!==Net.myIdx)act('bug',{nid:n.id})}
/* ---------- shooting ---------- */
function fire(T){
 const w=curW(),p=myP();if(!w||Inv.reloading||Me.mode!=='ground'||!p.alive)return;
 if(p.cuffs>T){if(T>Me.nextFire){UI.toast('⛓ you are in handcuffs');Me.nextFire=T+.8}return}
 const W=WEAPONS[w.id];if(T<Me.nextFire)return;
 if(w.mag<=0){SFX.play('empty');Me.nextFire=T+.3;if(w.res>0)startReload();return}
 w.mag--;Me.nextFire=T+W.rof;Me.firing=true;
 const o=[Me.x,Me.y+Me.eye,Me.z],base=dirFrom(Me.yaw,Me.pitch);
 let rx=-base[2],rz=base[0];const rl=Math.hypot(rx,rz)||1;rx/=rl;rz/=rl;const right=[rx,0,rz];
 // up = cross(right, base)
 const U=[right[1]*base[2]-right[2]*base[1],right[2]*base[0]-right[0]*base[2],right[0]*base[1]-right[1]*base[0]];
 const moving=Math.hypot(Me.vx,Me.vz)>2,sp=W.spread*(Me.ads?.3:1)*(moving?1.7:1)*(Keys.KeyC?.7:1)*(Me.onGround?1:2);
 const ends=[],hits=[],others=[];
 S.players.forEach((q,j)=>{if(j!==Net.myIdx&&q.alive&&P[j]&&!(P[j].fl&16)){const r=RP[j]||P[j];others.push([j,r,P[j]])}});
 for(let k=0;k<W.pel;k++){
  const a=Math.random()*6.283,r=Math.sqrt(Math.random())*sp;
  let dx=base[0]+right[0]*Math.cos(a)*r+U[0]*Math.sin(a)*r,dy=base[1]+right[1]*Math.cos(a)*r+U[1]*Math.sin(a)*r,dz=base[2]+right[2]*Math.cos(a)*r+U[2]*Math.sin(a)*r;
  const L=Math.hypot(dx,dy,dz);dx/=L;dy/=L;dz/=L;
  let best=World.ray(o[0],o[1],o[2],dx,dy,dz,W.range),hit=null;
  for(const [j,r2,p2] of others){const h=rayPlayer(o[0],o[1],o[2],dx,dy,dz,r2.x,r2.y,r2.z,p2.fl&1,best);if(h&&h.t<best){best=h.t;hit=[j,h.head?1:0]}}
  const e=[o[0]+dx*best,o[1]+dy*best,o[2]+dz*best];ends.push(e);if(hit)hits.push(hit);
  R.tracer([o[0]+base[0]*.9+right[0]*.22,o[1]-.16+base[1]*.9,o[2]+base[2]*.9+right[2]*.22],e,W.tr);
  R.spark(e[0],e[1],e[2],hit?'#ff6b5e':'#ffe9a8',hit?3:2,hit?4:3);
 }
 if(hits.length)UI.hitmark(hits.some(h=>h[1])?'hs':'');
 sendHost({t:'shot',w:w.id,o,e:ends,h:hits});
 SFX.play('w'+W.snd);
 Me.recoil=Math.min(2.5,Me.recoil+(W.dmg>50?2.2:W.pel>1?1.8:.55));Me.pitch+=.004+W.dmg*.00012+Math.random()*.003;Me.yaw+=(Math.random()-.5)*.004;Me.flashT=.05;R.shake=Math.max(R.shake,W.dmg>50?.1:.02);
 if(w.mag<=0&&w.res>0)setTimeout(startReload,200);
}
/* ---------- the per-frame player update ---------- */
function update(dt){
 const T=curT(),me=Net.myIdx,p=S.players[me];if(!p)return;
 const q=P[me]||(P[me]={x:0,y:0,z:0,yaw:0,pitch:0,w:'stapler',fl:0});
 Me.recoil=Math.max(0,Me.recoil-dt*9);Me.flashT=Math.max(0,Me.flashT-dt);
 if(!p.alive||S.over){
  if(!p.alive&&(Game.spec<0||!S.players[Game.spec]||!S.players[Game.spec].alive))Game.spec=nextSpec(Game.spec);
  if(Game.space&&!p.alive){Game.spec=nextSpec(Game.spec)}Game.space=false;UI.hint('');UI.cap(null);return;
 }
 const sprintK=Keys.ShiftLeft||Keys.ShiftRight;
 const fwd=(Keys.KeyW?1:0)-(Keys.KeyS?1:0),side=(Keys.KeyD?1:0)-(Keys.KeyA?1:0);
 const sy=Math.sin(Me.yaw),cy=Math.cos(Me.yaw);
 let wx=fwd*sy+side*cy,wz=-fwd*cy+side*sy;const wl=Math.hypot(wx,wz);if(wl>1){wx/=wl;wz/=wl}
 if(Me.mode==='jet'){
  const jp=jetPos(T);Me.x=jp.x;Me.y=jp.y;Me.z=jp.z;
  if(Game.space||(S.phase!=='jet'&&T>=S.jet.dur-.2)||T>=S.jet.dur-.3){if(T>JET_WAIT+.3||S.phase!=='jet'){Me.mode='air';Me.vy=-8;Me.vx=S.jet.dx*S.jet.spd*.6;Me.vz=S.jet.dz*S.jet.spd*.6;sendHost({t:'intent',act:'eject'});UI.toast('🪂 jumped — steer with WASD, aim for an exhibit')}}
  Game.space=false;
 }else if(Me.mode==='air'){
  const g=World.groundAt(Me.x,Me.z,Me.y),chute=Me.y>g+0&&Me.y<g+38;
  const term=chute?-9:-40;Me.vy=Math.max(term,Me.vy-(chute?60:30)*dt);if(chute&&Me.vy<-9)Me.vy=Math.min(-9,Me.vy+60*dt);
  const sp=chute?15:(fwd>0?26:13);
  Me.vx+=(wx*sp-Me.vx)*Math.min(1,dt*2.2);Me.vz+=(wz*sp-Me.vz)*Math.min(1,dt*2.2);
  Me.x+=Me.vx*dt;Me.z+=Me.vz*dt;Me.y+=Me.vy*dt;Me.x=Math.max(-HX,Math.min(HX,Me.x));Me.z=Math.max(-HZ,Math.min(HZ,Me.z));
  const gg=World.groundAt(Me.x,Me.z,Me.y+1.5);
  if(Me.y<=gg){Me.y=gg;Me.vy=0;Me.vx*=.2;Me.vz*=.2;Me.mode='ground';Me.onGround=true;SFX.play('jump');R.shake=.1;UI.toast('LANDED — loot up, find an exhibit')}
  Game.space=false;
 }else{
  const crouch=!!Keys.KeyC,sprint=!!sprintK&&fwd>0&&!crouch&&!Me.ads;Me.sprinting=sprint;
  let spd=(crouch?3.4:sprint?9.6:6.5)*speedMult(me,T);if(Me.ads)spd*=.72;
  if(Me.onGround&&laneNear(Me.x,Me.z))spd*=1.12;
  const k=Math.min(1,dt*(Me.onGround?13:3));
  Me.vx+=(wx*spd-Me.vx)*k;Me.vz+=(wz*spd-Me.vz)*k;
  if(Game.space&&Me.onGround){Me.vy=8.6;Me.onGround=false}Game.space=false;
  Me.vy-=24*dt;
  Me.x+=Me.vx*dt;Me.z+=Me.vz*dt;Me.y+=Me.vy*dt;
  const b={x:Me.x,y:Me.y,z:Me.z};World.pushOut(b);Me.x=b.x;Me.z=b.z;
  const g=World.groundAt(Me.x,Me.z,Me.y);
  if(Me.y<=g){Me.y=g;if(Me.vy<-14)R.shake=.08;Me.vy=0;Me.onGround=true}else if(Me.y>g+.08)Me.onGround=false;
  Me.eye+=((crouch?1.15:EYE)-Me.eye)*Math.min(1,dt*14);
  const mv=Math.hypot(Me.vx,Me.vz);Me.bobT+=dt*mv*1.5;Me.bob=Me.onGround?Math.sin(Me.bobT)*.035*Math.min(1,mv/6):0;
  // weapons
  if(Inv.reloading){Inv.reloadT-=dt;if(Inv.reloadT<=0){const w=curW(),W=WEAPONS[w.id],need=W.mag-w.mag,take=Math.min(need,w.res);w.mag+=take;w.res-=take;Inv.reloading=false}}
  const w=curW();Me.firing=false;
  if(Keys.Mouse0&&w&&(WEAPONS[w.id].auto||!Me._held)){fire(T);Me._held=true}
  if(!Keys.Mouse0)Me._held=false;
  interact(dt,p,T);
  // loot
  if(T>(Me.lootT||0)){Me.lootT=T+.12;const nowM=performance.now();
   for(const o of PK.values()){
    if(Math.abs(o.x-Me.x)>2.1||Math.abs(o.z-Me.z)>2.1||Math.abs(o.y-Me.y)>2.6)continue;
    if((Me.pkSkip[o.id]||0)>nowM)continue;
    if(o.k==='hp'&&p.hp>=100||o.k==='armor'&&p.armor>=100||o.k==='gren'&&Inv.gren>=6)continue;
    Me.pkSkip[o.id]=nowM+1500;act('pick',{id:o.id});if(o.k==='cash')SFX.play('cash');else SFX.play('pick');
   }}
 }
 if(Me.mode!=='ground'){UI.hint(Me.mode==='jet'?'<div class=\"hn\">PRESS <span class=\"hk\">SPACE</span> TO JUMP</div><div class=\"hs\">land near an exhibit — the jet covers the whole board</div>':'');UI.cap(null);Me.cap=0}
 // publish
 let fl=0;if(Keys.KeyC&&Me.mode==='ground')fl|=1;if(Me.sprinting)fl|=2;if(Me.firing||Me.flashT>0)fl|=4;if(Me.mode==='air')fl|=8|(Me.y<World.groundAt(Me.x,Me.z,Me.y)+38?32:0);if(Me.mode==='jet')fl|=16;
 q.x=Me.x;q.y=Me.y;q.z=Me.z;q.yaw=Me.yaw;q.pitch=Me.pitch;q.w=curW()?curW().id:'stapler';q.fl=fl;
 if(Net.role!=='host'&&performance.now()-Me.lastPos>66){Me.lastPos=performance.now();sendHost({t:'pos',x:+Me.x.toFixed(2),y:+Me.y.toFixed(2),z:+Me.z.toFixed(2),yaw:+Me.yaw.toFixed(2),pitch:+Me.pitch.toFixed(2),w:q.w,fl})}
}
function interact(dt,p,T){
 const me=Net.myIdx,n=nodeAt(Me.x,Me.z,NODE_R);
 if(!n||Me.y>3.5){UI.hint('');UI.cap(null);Me.cap=0;return}
 const ow=S.owner[n.id],live=zoneLive(n),mine=ow===me;
 let h='<div class=\"hn\" style=\"color:'+(TYPE_COLORS[n.type]||'#fff')+'\">'+(n.icon||'')+' '+esc(n.name.join(' '))+'</div><div class=\"hs\">'+esc(n.sub||'')+'</div>';
 h+='<div style=\"font-size:12px;color:#ccd\">'+esc(n.sp)+'</div>';
 let need=0;
 if(!live)h+='<div style=\"color:#ff6b5e;font-weight:800\">🚔 LOCKED DOWN — outside the dragnet</div>';
 else if(mine){h+='<div style=\"color:#7fe08d;font-weight:800\">YOURS · pays $'+n.income+' per tick</div>';
  if(n.id==='quik')h+='<div>press <span class=\"hk\">Q</span> for the shop</div>';if(n.id==='sisy'||n.id==='asics')h+='<div>press <span class=\"hk\">Q</span> to '+(n.id==='sisy'?'push':'jog')+'</div>'}
 else{
  const base=seizeListPrice(me,n),take=ow!=null,cost=take?takeoverCost(me,n.id,base):base;
  const back=S.owner.back===me?Math.min(3,p.intel):0,aff=p.money+back>=cost;
  h+='<div style=\"font-weight:800\">'+(ow!=null&&S.players[ow]?'held by <span style=\"color:'+S.players[ow].color+'\">'+esc(S.players[ow].name)+'</span> · ':'unowned · ')+'<span style=\"color:'+(aff?'#7fe08d':'#ff6b5e')+'\">'+(take?'TAKEOVER':'SEIZE')+' $'+cost+'</span>'+(back?' (+Intel via Backroom Deals)':'')+'</div>';
  if(n.id==='qantas'&&T<QANTAS_GROUND)h+='<div style=\"color:#ff6b5e\">grounded for '+Math.ceil(QANTAS_GROUND-T)+'s</div>';
  else if(p.cuffs>T)h+='<div style=\"color:#ff6b5e\">⛓ you are in handcuffs</div>';
  else if(!aff)h+='<div style=\"color:#ff6b5e\">you can\'t afford it</div>';
  else{h+='<div>hold <span class=\"hk\">E</span>'+(take?' · <span class=\"hk\">B</span> bug it':'')+'</div>';need=take?2:1.2}
  if(take&&!aff)h+='<div>press <span class=\"hk\">B</span> to bug it (1🛈)</div>';
 }
 UI.hint(h);
 if(need&&Keys.KeyE&&T>Me.capLock){Me.cap+=dt;UI.cap(Me.cap/need);if(Me.cap>=need){act('seize',{nid:n.id});Me.cap=0;Me.capLock=T+.8;UI.cap(null)}}
 else{Me.cap=Math.max(0,Me.cap-dt*2);UI.cap(Me.cap>0.02&&need?Me.cap/need:null)}
}
/* ---------- boot the match ---------- */
function enterGame(isGuest){
 if(Game.started){return}
 Game.started=true;
 if(isGuest){World.build(S.seed,S.quikSlot)}
 $('setup').style.display='none';$('game').style.display='block';
 try{if(typeof THREE==='undefined')throw new Error('three.js did not load from the CDN');R.init($('gl'));R.buildWorld();R.setWeapon('stapler')}catch(e){console.error(e);UI.fatal('Could not start the 3D view: '+e.message+' (WebGL needs to be enabled in your browser).');return}
 Game.lanes=EDGES.map(e=>[NMAP[e[0]],NMAP[e[1]]]).filter(l=>l[0]&&l[1]);
 bindInput();
 const jp=jetPos(curT());Me.x=jp.x;Me.y=jp.y;Me.z=jp.z;Me.yaw=Math.atan2(S.jet.dx,-S.jet.dz);Me.pitch=-.15;
 const q=P[Net.myIdx]||(P[Net.myIdx]={});Object.assign(q,{x:Me.x,y:Me.y,z:Me.z,yaw:Me.yaw,pitch:0,w:'stapler',fl:16});
 SFX.init();SFX.music=true;SFX.startMusic();
 // host simulation keeps ticking even if this tab loses focus (browsers throttle it, but never stop it)
 if(Net.role==='host'){let last=performance.now();setInterval(()=>{const now=performance.now();let rem=Math.min(3,(now-last)/1000);last=now;while(rem>1e-4){const dt=Math.min(.05,rem);rem-=dt;hostStep(dt)}netStep(.05)},50)}
 let lastF=performance.now(),hudT=0,miniT=0,mapT=0;
 const frame=now=>{
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-lastF)/1000);lastF=now;
  try{
   update(dt);
   const p=myP(),alive=p&&p.alive;
   const sp=!alive&&Game.spec>=0;
   const w=curW(),W=w?WEAPONS[w.id]:null,ads=Me.ads&&alive&&Me.mode==='ground';
   R.render(dt,{x:Me.x,y:Me.y,z:Me.z,yaw:Me.yaw,pitch:Me.pitch,eye:Me.eye,bob:Me.bob,recoil:Me.recoil,roll:(Keys.KeyD?-.012:Keys.KeyA?.012:0)*(Me.mode==='ground'?1:0),ads,wid:w&&w.id,fov:ads?(W&&W.zoom?78/W.zoom:60):(Me.sprinting?84:78),flashT:Me.flashT,
    third:sp||(!alive&&Game.spec<0&&false),follow:Game.spec,hideVm:!alive||Me.mode!=='ground',vmDip:Me.sprinting?.06:0});
   $('scope').style.display=ads&&W&&W.zoom?'block':'none';$('cross').className=ads?'ads':'';
   hudT+=dt;if(hudT>.1){hudT=0;UI.hud()}
   miniT+=dt;if(miniT>.066){miniT=0;UI.mini()}
   mapT+=dt;if(UI.map.open&&mapT>.25){mapT=0;UI.mapDraw()}
  }catch(e){console.error(e)}
 };
 requestAnimationFrame(frame);
 UI.hud();
}
UI.bindSetup();
