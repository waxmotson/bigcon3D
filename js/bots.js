'use strict';
/* THE BIG CON 3D — the other cons. Bots play the same game as humans: they drop from the jet, loot,
   seize exhibits when they can afford them, keep out of the dragnet and shoot whoever they can see.
   They run on the host through the very same economy and damage rules as everyone else. */
const BR=[];
const BOT_WALK=7.0;
function botBrain(i){
 let b=BR[i];
 if(!b){
  // The first three bots in each lobby are tougher rivals; the rest keep the usual skill range.
  const elite=i>=S.humans&&i<S.humans+3;
  b=BR[i]={land:null,ejDist:70+Math.random()*45,vy:0,tgt:null,capT:0,foe:-1,foeT:0,nextShot:0,burst:0,mag:0,reload:0,strafe:Math.random()<.5?1:-1,strafeT:0,lx:0,lz:0,stuckT:0,unstick:0,uh:0,skill:elite ? .86+Math.random()*.12 : .35+Math.random()*.45,aimErr:elite ? .65 : 1,lootId:0,thinkT:Math.random()*.5,sellT:0,grenT:8+Math.random()*20,hold:0,elite};
 }
 return b;
}
const LANDED=[];
function botPickLand(b){
 const j=S.jet;
 const perp=n=>Math.abs((n.wx-j.x0)*j.dz-(n.wz-j.z0)*j.dx);
 let live=NODES.filter(n=>n.id!=='qantas'&&perp(n)<95);
 if(live.length<4)live=NODES.filter(n=>n.id!=='qantas');
 let best=null,bs=-1;
 for(let k=0;k<6;k++){ // prefer exhibits no other bot already claimed
  const n=live[Math.floor(Math.random()*live.length)];
  const near=LANDED.reduce((a,l)=>a+(Math.hypot(l.x-n.wx,l.z-n.wz)<35?1:0),0);
  const sc=1/(1+near);if(sc>bs){bs=sc;best=n}
 }
 b.land={x:best.wx+(Math.random()-.5)*10,z:best.wz+(Math.random()-.5)*10};LANDED.push(b.land);
}
function botsStep(dt){
 for(let i=0;i<S.players.length;i++){const p=S.players[i];if(p.bot&&p.alive)botThink(i,p,dt)}
}
function botHeading(q,dx,dz,speed,dt,b){
 const d=Math.hypot(dx,dz);if(d<.05)return;
 let hx=dx/d,hz=dz/d;
 if(b.unstick>0){b.unstick-=dt;const c=Math.cos(b.uh),s=Math.sin(b.uh);const nx=hx*c-hz*s,nz=hx*s+hz*c;hx=nx;hz=nz}
 q.x+=hx*speed*dt;q.z+=hz*speed*dt;
 World.pushOut(q);
 b.stuckT+=dt;
 if(b.stuckT>1.1){
  if(Math.hypot(q.x-b.lx,q.z-b.lz)<.9&&b.unstick<=0){b.unstick=.9;b.uh=(Math.random()<.5?1:-1)*(1.1+Math.random()*.9)}
  b.lx=q.x;b.lz=q.z;b.stuckT=0;
 }
}
function botThink(i,p,dt){
 const b=botBrain(i),q=P[i];if(!q)return;
 if(p.dc)return;
 if(!b.landedAt&&!(q.fl&(16|8)))b.landedAt=S.t;
 // ---------- the jet ----------
 if(q.fl&16){
  if(!b.land)botPickLand(b);
  if(S.phase==='jet'){
   const jp=jetPos(S.t);q.x=jp.x;q.z=jp.z;q.y=jp.y;q.yaw=Math.atan2(S.jet.dx,-S.jet.dz);
   const d=Math.hypot(b.land.x-jp.x,b.land.z-jp.z);
   if(S.t>JET_WAIT+1.5&&(d<=b.ejDist||S.t>=S.jet.dur-1)){q.fl=(q.fl&~16)|8;b.vy=-8}
  }else{q.fl=(q.fl&~16)|8;b.vy=-8}
  return;
 }
 if(q.fl&8){ // falling / under canopy
  const g=World.groundAt(q.x,q.z,q.y);
  b.vy=q.y>g+36?Math.max(-38,b.vy-30*dt):Math.min(b.vy+40*dt,-9);
  if(q.y>g+36)q.fl&=~32;else q.fl|=32;
  q.y+=b.vy*dt;
  const dx=b.land.x-q.x,dz=b.land.z-q.z,d=Math.hypot(dx,dz);
  if(d>1){const sp=Math.min(14,d/.5);q.x+=dx/d*sp*dt;q.z+=dz/d*sp*dt}
  q.yaw=Math.atan2(dx,-dz);
  if(q.y<=World.groundAt(q.x,q.z,q.y+2)){q.y=World.groundAt(q.x,q.z,q.y+2);q.fl&=~(8|32);b.vy=0}
  return;
 }
 if(p.cuffs>S.t){q.fl&=~4;return}
 if(S.phase!=='play')return;
 const z=S.zone,own=id=>S.owner[id]===i;
 b.thinkT-=dt;b.nextShot-=dt;b.grenT-=dt;b.strafeT-=dt;b.sellT-=dt;
 if(b.reload>0){b.reload-=dt;if(b.reload<=0)b.mag=WEAPONS[p.bw||'stapler'].mag}
 const wid=p.bw||'stapler',W=WEAPONS[wid];q.w=wid;
 // ---------- housekeeping ----------
 if(b.sellT<=0){b.sellT=6;
  if(p.intel>=6)doAction(i,'sell',{n:p.intel-3});
  if(p.cortisol>=6&&own('rock')&&p.money>=3)doAction(i,'cook');
  else if(p.cortisol>=6&&own('press')&&p.money>=3)doAction(i,'spin',{kind:'press',mode:'cool'});
  if(p.intel>=3&&p.dossierUntil<S.t&&Math.random()<.3)doAction(i,'dossier');
  if(own('trump')&&p.money>=6&&Math.random()<.35){const r=rivalList(i,3);if(r.length)doAction(i,'tweet',{target:r[0]})}
  if(own('asic')&&p.money>=8&&Math.random()<.3){const r=rivalList(i,3);if(r.length)doAction(i,'audit',{target:r[0]})}
 }
 // ---------- perception ----------
 if(b.thinkT<=0){
  b.thinkT=.22;
  let best=-1,bd=1e9;
  for(let j=0;j<S.players.length;j++){
   if(j===i||!S.players[j].alive||!P[j]||(P[j].fl&(16|8)))continue;
   const d=Math.hypot(P[j].x-q.x,P[j].z-q.z);if(d>Math.min(W.range*.8,44)||d>=bd)continue;
   const ex=q.x,ey=q.y+EYE,ez=q.z,tx=P[j].x,ty=P[j].y+1.2,tz=P[j].z,dd=Math.hypot(tx-ex,ty-ey,tz-ez);
   if(World.ray(ex,ey,ez,(tx-ex)/dd,(ty-ey)/dd,(tz-ez)/dd,dd)<dd-.6)continue;
   best=j;bd=d;
  }
  if(best!==b.foe){b.foe=best;b.aimErr=1.6}
 }
 const sp=BOT_WALK*speedMult(i,S.t);
 // ---------- survive the dragnet ----------
 const dz0=Math.hypot(q.x-z.cx,q.z-z.cz),outside=dz0>z.r-9;
 // ---------- combat ----------
 if(b.foe>=0&&S.players[b.foe]&&S.players[b.foe].alive&&P[b.foe]){
  const f=P[b.foe],dx=f.x-q.x,dz=f.z-q.z,d=Math.hypot(dx,dz);
  q.yaw=Math.atan2(dx,-dz);q.pitch=Math.atan2(f.y+1.1-(q.y+EYE),d);
  b.aimErr=Math.max(.0,b.aimErr-dt*(.5+b.skill));
  const want=wid==='yield'?9:wid==='short'?55:22;
  if(b.strafeT<=0){b.strafeT=.8+Math.random()*1.4;b.strafe=Math.random()<.5?-1:1}
  const rad=d>want+6?1:d<want-6?-1:0;
  if(!outside||true){
   const px=-dz/d*b.strafe,pz=dx/d*b.strafe;
   q.x+=(dx/d*rad*.9+px*.7)*sp*.8*dt;q.z+=(dz/d*rad*.9+pz*.7)*sp*.8*dt;World.pushOut(q);
  }
  q.fl=(q.fl|2)&~1;
  if(b.mag<=0&&b.reload<=0){b.mag=W.mag;b.reload=W.rel}
  if(b.reload<=0&&b.nextShot<=0&&d<=W.range&&S.t-(b.landedAt||0)>14){
   b.mag--;b.nextShot=W.rof*(W.auto?2.1:1.9)+(Math.random()*.2);q.fl|=4;
   const chance=Math.max(.03,Math.min(.5,(b.skill*(1-d/(W.range*1.05))+.1)/(1+b.aimErr)));
   const o=[q.x,q.y+EYE,q.z],tp=[f.x,f.y+1.15,f.z];
   emit({t:'shot',i,w:wid,o,e:[tp]});
   for(let k=0;k<W.pel;k++){
    if(Math.random()<chance){const head=Math.random()<.1;applyDamage(b.foe,W.dmg*(head?W.hm:1)*.38*(d>W.range*.6?.75:1),i,wid,head)}
    if(!S.players[b.foe]||!S.players[b.foe].alive)break;
   }
  }else if(b.nextShot>0)q.fl&=~4;
  if(b.grenT<=0&&d>9&&d<30&&Math.random()<.4){b.grenT=18+Math.random()*25;const dd=Math.max(d,1);throwGrenade(i,[q.x,q.y+1.5,q.z],[dx/dd*Math.min(d,24)*.8,6,dz/dd*Math.min(d,24)*.8])}
  if(!outside)return;
 }else q.fl&=~(4|2);
 // ---------- movement goals ----------
 let gx=null,gz=null,node=null;
 if(outside||(z.st==='shrink'&&dz0>z.tr-12)){gx=z.st==='shrink'?z.tcx:z.cx;gz=z.st==='shrink'?z.tcz:z.cz}
 else{
  if(p.hp<50){const h=nearestPickup(q,['hp'],90,p);if(h){gx=h.x;gz=h.z}}
  if(gx==null&&wid==='stapler'&&S.t-S.tPlay<120){const h=nearestPickup(q,['wp'],70,p);if(h){gx=h.x;gz=h.z}}
  if(gx==null){const h=nearestPickup(q,['cash','intel','armor','hp','wp'],26,p);if(h){gx=h.x;gz=h.z}}
  if(gx==null){
   if(!b.tgt||S.owner[b.tgt]===i||!zoneLive(NMAP[b.tgt])||b.hold>14){b.tgt=botPickNode(i,p);b.hold=0;b.capT=0}
   if(b.tgt){node=NMAP[b.tgt];gx=node.wx+Math.cos(i)*2;gz=node.wz+Math.sin(i)*2}
   else{gx=z.cx+Math.cos(i*1.7+S.t*.05)*z.r*.35;gz=z.cz+Math.sin(i*1.7+S.t*.05)*z.r*.35}
  }
 }
 if(gx!=null){
  const dx=gx-q.x,dz=gz-q.z,d=Math.hypot(dx,dz);
  if(node&&d<NODE_R-1.5){
   // at the exhibit: stand still and work the deal
   b.hold+=dt;b.capT+=dt;q.yaw=Math.atan2(dx,-dz);q.fl&=~2;
   const need=S.owner[node.id]!=null?2:1.2;
   if(b.capT>=need){b.capT=0;doSeize(i,node.id);if(S.owner[node.id]===i)b.tgt=null}
  }else{botHeading(q,dx,dz,sp,dt,b);q.yaw=Math.atan2(dx,-dz);q.fl|=2;q.fl&=~1;b.capT=0;if(node)b.hold+=dt*.25}
 }
 q.y=World.groundAt(q.x,q.z,q.y+1);
 // grab what we are standing on
 for(const o of PK.values()){if(Math.abs(o.x-q.x)<2.2&&Math.abs(o.z-q.z)<2.2){if(o.k==='wp'||o.k==='ammo'||o.k==='gren'||collectOK(p,o)){collect(i,o.id);break}}}
}
function collectOK(p,o){return !(o.k==='hp'&&p.hp>=100)&&!(o.k==='armor'&&p.armor>=100)}
function nearestPickup(q,kinds,maxD,p){
 let best=null,bd=maxD;
 PK.forEach(o=>{if(kinds.indexOf(o.k)<0)return;if(p&&!collectOK(p,o))return;const d=Math.hypot(o.x-q.x,o.z-q.z);if(d<bd){bd=d;best=o}});
 return best;
}
function botPickNode(i,p){
 const q=P[i];let best=null,bs=-1e9;
 const missing=missingTypes(i);
 for(const n of NODES){
  if(S.owner[n.id]===i||!zoneLive(n)||(n.id==='qantas'&&S.t<QANTAS_GROUND))continue;
  const prev=S.owner[n.id];let base=seizeListPrice(i,n);const cost=prev!=null?takeoverCost(i,n.id,base):base;
  if(p.money+(S.owner.back===i?Math.min(3,p.intel):0)<cost)continue;
  if(prev!=null&&p.cortisol>=5)continue;
  const d=Math.hypot(n.wx-q.x,n.wz-q.z);
  let s=(n.income+3+(missing.indexOf(n.type)>=0?5:0)+(prev==null?2:-1))/(d+25)-cost*.004+Math.random()*.01;
  if(s>bs){bs=s;best=n.id}
 }
 return best;
}
