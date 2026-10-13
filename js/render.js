'use strict';
/* THE BIG CON 3D — the renderer (three.js r128). The evidence board, lifted off the wall and enlarged:
   every exhibit is a giant pinned card on a post, the red threads run across the cork floor. */
const R={};
const MOOD_SKY={CALM:0x142628,BOOM:0x3a2c0c,PANIC:0x3a1010,FRENZY:0x2d1238};
const RP=[];                 // smoothed render positions per player
const _c1=new THREE.Color(),_c2=new THREE.Color();
function leaderIdx(){let b=-1,m=60;if(!S)return -1;S.players.forEach((p,i)=>{if(p.alive&&p.money>m){m=p.money;b=i}});return b}
function dirFrom(yaw,pitch){const cp=Math.cos(pitch);return[Math.sin(yaw)*cp,Math.sin(pitch),-Math.cos(yaw)*cp]}
function textSprite(text,color,opts){
 opts=opts||{};const W=opts.w||256,H=opts.h||64,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
 g.font=opts.font||'bold 34px system-ui,Arial';g.textAlign='center';g.textBaseline='middle';g.lineWidth=7;g.strokeStyle='#000';g.lineJoin='round';
 g.strokeText(text,W/2,H/2);g.fillStyle=color;g.fillText(text,W/2,H/2);
 const t=new THREE.CanvasTexture(c);const m=new THREE.SpriteMaterial({map:t,transparent:true,depthTest:opts.depth!==false,fog:false});
 const s=new THREE.Sprite(m);s.scale.set(opts.sw||W/32,opts.sh||H/32,1);return s;
}
const emojiCache={};
function emojiTex(key,draw){
 if(emojiCache[key])return emojiCache[key];
 const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');draw(g);
 return emojiCache[key]=new THREE.CanvasTexture(c);
}
function pickupTex(o){
 const key=o.k+(o.w||'');
 return emojiTex(key,g=>{
  const em={cash:'💵',intel:'✉️',hp:'🩹',armor:'🛡️',ammo:'📦',gren:'💣',wp:'🔫'}[o.k]||'?';
  const col=o.k==='wp'?WEAPONS[o.w].col:{cash:'#7fe08d',intel:'#55c1ff',hp:'#ff8a9a',armor:'#9ad',ammo:'#f5c542',gren:'#ffa94d'}[o.k];
  g.fillStyle='rgba(0,0,0,.55)';g.beginPath();g.arc(64,64,58,0,7);g.fill();g.lineWidth=7;g.strokeStyle=col;g.stroke();
  g.font='64px serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#fff';g.fillText(em,64,o.k==='wp'?54:68);
  if(o.k==='wp'){g.font='bold 15px system-ui';g.fillStyle=col;g.fillText(WEAPONS[o.w].n.replace('THE ',''),64,100)}
 });
}
const faceTex={};
function getFace(charId){
 if(faceTex[charId])return faceTex[charId];
 const c=document.createElement('canvas');c.width=512;c.height=256;
 // Null character IDs deliberately keep this plain skin-tone canvas: no image is loaded.
 const g=c.getContext('2d');g.fillStyle='#d8ad87';g.fillRect(0,0,c.width,c.height);
 const t=new THREE.CanvasTexture(c);
 // Sphere UVs span the whole image; offset U so the image centre faces forward (-Z).
 t.wrapS=THREE.RepeatWrapping;t.offset.x=.75;
 if(THREE.sRGBEncoding!==undefined)t.encoding=THREE.sRGBEncoding;
 faceTex[charId]=t;
 if(charId){
  const im=new Image();
  im.onload=()=>{
   g.fillStyle='#d8ad87';g.fillRect(0,0,c.width,c.height);
   const scale=Math.max(c.width/im.width,c.height/im.height),w=im.width*scale,h=im.height*scale;
   g.drawImage(im,(c.width-w)/2,(c.height-h)/2,w,h);t.needsUpdate=true;
  };
  im.onerror=()=>{t.needsUpdate=true};
  im.src=charSrc(charId);
 }
 return t;
}
function corkTexture(){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
 g.fillStyle='#b88c58';g.fillRect(0,0,512,512);
 for(let i=0;i<5200;i++){const l=40+Math.random()*30;g.fillStyle='hsla('+(28+Math.random()*10)+',45%,'+l+'%,'+(.2+Math.random()*.4)+')';const r=.6+Math.random()*2.4;g.beginPath();g.arc(Math.random()*512,Math.random()*512,r,0,7);g.fill()}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;
}
function cardCanvas(n,img){
 const W=320,H=240,c=n._cv||(n._cv=document.createElement('canvas'));c.width=W;c.height=H;const g=c.getContext('2d');
 const dark=n.shape==='chart'||n.shape==='news';
 g.fillStyle=dark?'#0e1414':'#f3eee0';g.fillRect(0,0,W,H);
 g.fillStyle=n.band||TYPE_COLORS[n.type]||'#666';g.fillRect(0,0,W,32);
 g.fillStyle='#fff';g.font='bold 19px system-ui,Arial';g.textBaseline='middle';g.textAlign='left';g.fillText(n.icon?n.icon+' '+n.type:n.type,10,17);
 g.textAlign='right';g.fillText('$'+n.cost+'  ·  +$'+n.income,W-10,17);
 const ix=10,iy=40,iw=W-20,ih=140;
 g.fillStyle=dark?'#000':'#fff';g.fillRect(ix,iy,iw,ih);
 if(img&&img.width){
  const cover=n.shape==='photo'||n.shape==='news'||n.shape==='sat'||n.shape==='wide';
  const s=cover?Math.max(iw/img.width,ih/img.height):Math.min(iw/img.width,ih/img.height);
  g.save();g.beginPath();g.rect(ix,iy,iw,ih);g.clip();g.drawImage(img,ix+iw/2-img.width*s/2,iy+(cover?0:ih/2-img.height*s/2),img.width*s,img.height*s);g.restore();
 }else{g.fillStyle=dark?'#1f2c2c':'#ddd';g.font='64px serif';g.textAlign='center';g.fillText(n.icon||'📌',W/2,iy+ih/2)}
 g.fillStyle=dark?'#e8e8e8':'#1a1a1a';g.textAlign='center';g.textBaseline='alphabetic';
 const lines=n.name.length;g.font='bold '+(lines>2?15:lines>1?17:21)+'px "Times New Roman",serif';
 n.name.forEach((l,k)=>g.fillText(l.length>26?l.slice(0,25)+'…':l,W/2,196+k*(lines>2?15:18)+(lines>2?0:4)));
 return c;
}
R.init=function(canvas){
 const r=R.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 r.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));r.setSize(innerWidth,innerHeight,false);
 R.scene=new THREE.Scene();R.scene.background=new THREE.Color(MOOD_SKY.CALM);R.scene.fog=new THREE.Fog(MOOD_SKY.CALM,70,340);
 R.cam=new THREE.PerspectiveCamera(78,innerWidth/innerHeight,.08,800);R.cam.rotation.order='YXZ';R.scene.add(R.cam);
 const aspect=innerWidth/Math.max(1,innerHeight),mapW=Math.max(2*HX+28,(2*HZ+28)*aspect),mapH=mapW/aspect;
 R.mapCam=new THREE.OrthographicCamera(-mapW/2,mapW/2,mapH/2,-mapH/2,.1,1400);R.mapCam.up.set(0,0,-1);R.mapCam.position.set(0,560,0);R.mapCam.lookAt(0,0,0);
 R.scene.add(new THREE.HemisphereLight(0xdff6f0,0x4a3320,1.0));
 const sun=new THREE.DirectionalLight(0xfff0d0,.75);sun.position.set(90,140,50);R.scene.add(sun);
 addEventListener('resize',()=>{
  r.setSize(innerWidth,innerHeight,false);R.cam.aspect=innerWidth/innerHeight;R.cam.updateProjectionMatrix();
  const aspect=innerWidth/Math.max(1,innerHeight),mapW=Math.max(2*HX+28,(2*HZ+28)*aspect),mapH=mapW/aspect;
  R.mapCam.left=-mapW/2;R.mapCam.right=mapW/2;R.mapCam.top=mapH/2;R.mapCam.bottom=-mapH/2;R.mapCam.updateProjectionMatrix();
 });
 R.shake=0;R.t=0;R.tr=[];R.sp=[];R.ft=[];R.gr=new Map();R.pk=new Map();R.av=[];R.nd={};R.boomFx=[];
 R.fxSeen=0;R.moodC=new THREE.Color(MOOD_SKY.CALM);
 R.mkTracers();R.mkViewmodel();
};
R.mkTracers=function(){
 for(let i=0;i<40;i++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
  const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xffe28a,transparent:true,opacity:0,fog:false}));l.frustumCulled=false;l.visible=false;R.scene.add(l);R.tr.push({l,life:0})}
 const st=emojiTex('spark',g=>{const gr=g.createRadialGradient(64,64,0,64,64,60);gr.addColorStop(0,'#fff');gr.addColorStop(.35,'rgba(255,220,120,.9)');gr.addColorStop(1,'rgba(255,120,0,0)');g.fillStyle=gr;g.fillRect(0,0,128,128)});
 R.sparkTex=st;
 for(let i=0;i<70;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:st,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));s.visible=false;s.scale.set(.3,.3,1);R.scene.add(s);R.sp.push({s,life:0,vx:0,vy:0,vz:0})}
};
R.tracer=function(o,e,col){
 const t=R.tr.find(x=>x.life<=0);if(!t)return;
 const a=t.l.geometry.attributes.position.array;a[0]=o[0];a[1]=o[1];a[2]=o[2];a[3]=e[0];a[4]=e[1];a[5]=e[2];t.l.geometry.attributes.position.needsUpdate=true;
 t.l.material.color.set(col||'#ffe28a');t.l.material.opacity=1;t.l.visible=true;t.life=.09;
};
R.spark=function(x,y,z,col,n,spd){
 for(let k=0;k<n;k++){const p=R.sp.find(q=>q.life<=0);if(!p)return;p.s.position.set(x,y,z);p.s.material.color.set(col||'#ffd27a');
  const a=Math.random()*6.283,u=Math.random()*2-1,sp=(spd||4)*(.4+Math.random());p.vx=Math.cos(a)*Math.sqrt(1-u*u)*sp;p.vz=Math.sin(a)*Math.sqrt(1-u*u)*sp;p.vy=u*sp+1;p.life=.28+Math.random()*.25;p.s.visible=true;p.s.material.opacity=1}
};
R.boom=function(x,y,z){
 const m=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color:0xffa23a,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,fog:false,depthWrite:false}));
 m.position.set(x,y,z);R.scene.add(m);R.boomFx.push({m,t:0});R.spark(x,y,z,'#ffb347',26,14);R.shake=Math.max(R.shake,.35*Math.max(0,1-Math.hypot(R.cam.position.x-x,R.cam.position.z-z)/60));
};
R.float=function(x,y,z,text,col){
 const key=text+col;let tex=R._ft&&R._ft[key];
 const s=textSprite(text,col,{w:384,h:72,font:'bold 40px system-ui,Arial',sw:7.5,sh:1.4,depth:false});
 s.position.set(x,y,z);s.renderOrder=20;R.scene.add(s);R.ft.push({s,t:0,y0:y});
};
/* ---------- the world ---------- */
R.buildWorld=function(){
 const sc=R.scene;
 const old=R.worldGroup;if(old){sc.remove(old)}
 const W=R.worldGroup=new THREE.Group();sc.add(W);
 const cork=corkTexture();cork.repeat.set(70,46);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(2*HX+30,2*HZ+30),new THREE.MeshLambertMaterial({map:cork}));ground.rotation.x=-Math.PI/2;W.add(ground);
 const void_=new THREE.Mesh(new THREE.PlaneGeometry(3000,3000),new THREE.MeshBasicMaterial({color:0x0a1213}));void_.rotation.x=-Math.PI/2;void_.position.y=-.4;W.add(void_);
 // the frame of the board
 const fm=new THREE.MeshLambertMaterial({color:0x4a2f16});
 [[0,-HZ-8,2*HX+40,12,16],[0,HZ+8,2*HX+40,12,16],[-HX-8,0,16,12,2*HZ+16],[HX+8,0,16,12,2*HZ+16]].forEach(a=>{const b=new THREE.Mesh(new THREE.BoxGeometry(a[2],a[3],a[4]),fm);b.position.set(a[0],a[3]/2-1,a[1]);W.add(b)});
 // pinned scraps of paper across the floor
 const sheet=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshLambertMaterial({color:0xe9e2cf,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),90);
 const rnd=mulberry(World.seed||7),d=new THREE.Object3D();
 for(let i=0;i<90;i++){d.position.set((rnd()*2-1)*HX,.03,(rnd()*2-1)*HZ);d.rotation.set(-Math.PI/2,0,rnd()*6.28);const s=5+rnd()*9;d.scale.set(s,s*(.6+rnd()*.5),1);d.updateMatrix();sheet.setMatrixAt(i,d.matrix);sheet.setColorAt(i,_c1.setHSL(.1+rnd()*.05,.2+rnd()*.25,.78+rnd()*.15))}
 W.add(sheet);
 // red threads: sprint lanes
 const pos=[];let ec=0;
 EDGES.forEach(e=>{const a=NMAP[e[0]],b=NMAP[e[1]];if(!a||!b)return;const dx=b.wx-a.wx,dz=b.wz-a.wz,L=Math.hypot(dx,dz)||1,nx=-dz/L*.28,nz=dx/L*.28;
  pos.push(a.wx+nx,.07,a.wz+nz,a.wx-nx,.07,a.wz-nz,b.wx+nx,.07,b.wz+nz,b.wx+nx,.07,b.wz+nz,a.wx-nx,.07,a.wz-nz,b.wx-nx,.07,b.wz-nz);ec++});
 const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));
 const thr=new THREE.Mesh(tg,new THREE.MeshBasicMaterial({color:0xd0352a,side:THREE.DoubleSide}));W.add(thr);
 // obstacles (instanced)
 const boxes=World.obs.filter(o=>!o.c),cyls=World.obs.filter(o=>o.c&&o.h<5),posts=World.obs.filter(o=>o.c&&o.h>=5);
 const pal=[0xb9b2a0,0xa47c4b,0xe3c77a,0x3c8d92,0x7b3f3f];
 const bm=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xffffff}),Math.max(1,boxes.length));
 boxes.forEach((o,i)=>{d.position.set(o.x,o.h/2,o.z);d.rotation.set(0,0,0);d.scale.set(o.hx*2,o.h,o.hz*2);d.updateMatrix();bm.setMatrixAt(i,d.matrix);
  bm.setColorAt(i,_c1.set((o.hx<.5||o.hz<.5)?0xb48a52:pal[o.k%pal.length]))});
 W.add(bm);
 const cm=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,14),new THREE.MeshLambertMaterial({color:0x1b4a8f}),Math.max(1,cyls.length));
 cyls.forEach((o,i)=>{d.position.set(o.x,o.h/2,o.z);d.rotation.set(0,0,0);d.scale.set(o.r,o.h,o.r);d.updateMatrix();cm.setMatrixAt(i,d.matrix)});W.add(cm);
 // exhibits
 R.nd={};R.cards=[];
 const loadQueue=[];
 NODES.forEach(n=>{
  const g=new THREE.Group();g.position.set(n.wx,0,n.wz);W.add(g);
  const col=TYPE_COLORS[n.type]||'#666';
  const ped=new THREE.Mesh(new THREE.CylinderGeometry(3.3,3.7,.5,28),new THREE.MeshLambertMaterial({color:col}));ped.position.y=.25;g.add(ped);
  const ring=new THREE.Mesh(new THREE.RingGeometry(5.3,6.4,56),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.09;g.add(ring);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.6,.75,4.6,10),new THREE.MeshLambertMaterial({color:0x3b2a1a}));pole.position.y=2.3;g.add(pole);
  const w=n.big?13:10,h=w*.75;
  const card=new THREE.Group();card.position.y=4.6+h/2;card.rotation.y=Math.atan2(-n.wx,-n.wz);card.rotation.z=n.rot*.012;g.add(card);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(w+.7,h+.7,.35),new THREE.MeshLambertMaterial({color:col}));card.add(frame);
  const tex=new THREE.CanvasTexture(cardCanvas(n,null));tex.anisotropy=4;
  const fmat=new THREE.MeshBasicMaterial({map:tex,fog:false});
  const f1=new THREE.Mesh(new THREE.PlaneGeometry(w,h),fmat);f1.position.z=.19;card.add(f1);
  const f2=new THREE.Mesh(new THREE.PlaneGeometry(w,h),fmat);f2.position.z=-.19;f2.rotation.y=Math.PI;card.add(f2);
  const pin=new THREE.Mesh(new THREE.SphereGeometry(.38,10,8),new THREE.MeshBasicMaterial({color:0xd0352a}));pin.position.set(0,h/2-.15,.45);card.add(pin);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,90,8,1,true),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.28,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide}));beam.position.y=45;beam.visible=false;g.add(beam);
  R.nd[n.id]={g,ring,frame,beam,tex,fmat,owner:-2,live:true,label:null,col,top:4.6+h+1.2};
  loadQueue.push(n);
 });
 R.loadQ=loadQueue;R.loading=0;
 // zone wall + next circle
 R.zoneWall=new THREE.Mesh(new THREE.CylinderGeometry(1,1,200,72,1,true),new THREE.MeshBasicMaterial({color:0x2ad4dc,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));
 R.zoneWall.position.y=100;W.add(R.zoneWall);
 const cp=[];for(let i=0;i<=96;i++){const a=i/96*6.2832;cp.push(new THREE.Vector3(Math.cos(a),0,Math.sin(a)))}
 R.zoneNext=new THREE.Line(new THREE.BufferGeometry().setFromPoints(cp),new THREE.LineBasicMaterial({color:0xffffff,fog:false}));R.zoneNext.position.y=.4;W.add(R.zoneNext);
 // the Qantas jet
 const jet=R.jet=new THREE.Group();
 const body=new THREE.Mesh(new THREE.BoxGeometry(4,3,20),new THREE.MeshLambertMaterial({color:0xf2f2f2}));jet.add(body);
 const wing=new THREE.Mesh(new THREE.BoxGeometry(26,.5,5),new THREE.MeshLambertMaterial({color:0xe0001b}));wing.position.set(0,-.3,1);jet.add(wing);
 const tail=new THREE.Mesh(new THREE.BoxGeometry(.6,6,4),new THREE.MeshLambertMaterial({color:0xe0001b}));tail.position.set(0,3.8,8.5);jet.add(tail);
 const lab=textSprite('QANTAS · THE FLYING KANGAROO','#ff4a5a',{w:512,h:64,sw:20,sh:2.5,font:'bold 30px system-ui'});lab.position.y=5;jet.add(lab);
 jet.visible=false;W.add(jet);
};
R.pumpLoads=function(){
 while(R.loading<5&&R.loadQ&&R.loadQ.length){
  const n=R.loadQ.shift();R.loading++;
  const im=new Image();const done=()=>{R.loading--};
  im.onload=()=>{const nd=R.nd[n.id];cardCanvas(n,im);nd.tex.needsUpdate=true;done()};im.onerror=done;
  im.src=encodeURI(n.image);
 }
};
R.mkViewmodel=function(){
 const vm=R.vm=new THREE.Group();R.cam.add(vm);
 const mat=R.vmMat=new THREE.MeshLambertMaterial({color:0xcccccc}),dark=new THREE.MeshLambertMaterial({color:0x222222});
 R.vmBody=new THREE.Mesh(new THREE.BoxGeometry(.07,.1,.5),mat);R.vmBody.position.set(0,0,-.2);vm.add(R.vmBody);
 const bar=R.vmBar=new THREE.Mesh(new THREE.BoxGeometry(.035,.035,.3),dark);bar.position.set(0,.03,-.55);vm.add(bar);
 const grip=new THREE.Mesh(new THREE.BoxGeometry(.06,.14,.08),dark);grip.position.set(0,-.1,-.05);grip.rotation.x=.3;vm.add(grip);
 const fl=R.flash=new THREE.Sprite(new THREE.SpriteMaterial({map:R.sparkTex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));fl.scale.set(.5,.5,1);fl.position.set(0,.03,-.78);fl.visible=false;vm.add(fl);
 vm.position.set(.2,-.2,-.35);
};
R.setWeapon=function(wid){const W=WEAPONS[wid];R.vmMat.color.set(W.col);const L={stapler:.35,ticker:.55,cashrate:.7,yield:.65,short:1.0}[wid]||.5;R.vmBody.scale.z=L/.5;R.vmBody.position.z=-.05-L/2;R.vmBar.position.z=-.1-L;R.flash.position.z=-.18-L}
function getAvatar(i){
 if(R.av[i])return R.av[i];
 const p=S.players[i],g=new THREE.Group();
 const col=_c1.set(p.color).clone();
 const body=new THREE.Mesh(new THREE.CylinderGeometry(.3,.36,.95,10),new THREE.MeshLambertMaterial({color:col}));body.position.y=.92;g.add(body);
 const legs=new THREE.Mesh(new THREE.CylinderGeometry(.24,.2,.5,8),new THREE.MeshLambertMaterial({color:0x222a2a}));legs.position.y=.25;g.add(legs);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.22,24,16),new THREE.MeshBasicMaterial({map:getFace(p.char),color:0xffffff,fog:false}));head.position.y=1.6;g.add(head);
 const gun=new THREE.Mesh(new THREE.BoxGeometry(.08,.1,.55),new THREE.MeshLambertMaterial({color:0xcccccc}));gun.position.set(.3,1.0,-.35);g.add(gun);
 const tag=textSprite(p.name,'#fff',{w:256,h:48,sw:5,sh:.95,font:'bold 26px system-ui'});tag.position.y=2.35;g.add(tag);
 const chute=new THREE.Mesh(new THREE.SphereGeometry(2.6,14,8,0,6.283,0,1.45),new THREE.MeshLambertMaterial({color:0xe0001b,side:THREE.DoubleSide,transparent:true,opacity:.92}));chute.position.y=4.4;chute.visible=false;g.add(chute);
 const wanted=textSprite('★ WANTED','#ff4a4a',{w:256,h:48,sw:5,sh:.95,font:'900 28px system-ui',depth:false});wanted.position.y=3.1;wanted.visible=false;g.add(wanted);
 R.worldGroup.add(g);
 return R.av[i]={g,body,gun,tag,chute,wanted,legs,lastW:'',ph:Math.random()*6};
}
R.mkGrenade=function(o){
 const m=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),new THREE.MeshLambertMaterial({color:0x2a7d3c}));R.scene.add(m);
 R.gr.set(o.id,{m,g:{x:o.o[0],y:o.o[1],z:o.o[2],vx:o.v[0],vy:o.v[1],vz:o.v[2],t:0}});
};
R.endGrenade=function(id){const o=R.gr.get(id);if(o){R.scene.remove(o.m);R.gr.delete(id)}};
/* ---------- per-frame ---------- */
R.render=function(dt,v){
 R.t+=dt;R.pumpLoads();
 const sc=R.scene,cam=v.mapView?R.mapCam:R.cam;
 // sky follows the market mood
 _c2.set(MOOD_SKY[S.mood]||MOOD_SKY.CALM);R.moodC.lerp(_c2,Math.min(1,dt*1.2));sc.background.copy(R.moodC);sc.fog.color.copy(R.moodC);
 // exhibits: owner colours, frozen state
 const T=curT();
 for(const n of NODES){
  const nd=R.nd[n.id],ow=S.owner[n.id]==null?-1:S.owner[n.id],live=zoneLive(n),key=ow*2+(live?1:0);
  if(nd.key!==key){
   nd.key=key;
   if(ow>=0&&S.players[ow]){const c=S.players[ow].color;nd.ring.material.color.set(c);nd.ring.material.opacity=.95;nd.frame.material.color.set(c);nd.beam.material.color.set(c);nd.beam.visible=live;
    if(nd.label){nd.g.remove(nd.label)}nd.label=textSprite(S.players[ow].name,c,{w:256,h:48,sw:7,sh:1.3,font:'bold 28px system-ui'});nd.label.position.y=nd.top+1.2;nd.g.add(nd.label)}
   else{const base=live?nd.col:'#555';nd.ring.material.color.set(base);nd.ring.material.opacity=live?.5:.25;nd.frame.material.color.set(live?nd.col:'#333');nd.beam.visible=false;if(nd.label){nd.g.remove(nd.label);nd.label=null}}
  }
  if(nd.beam.visible)nd.beam.material.opacity=.2+.12*Math.sin(R.t*3+n.wx);
 }
 // the dragnet
 const z=S.zone;
 if(z){
  R.zoneWall.visible=true;R.zoneWall.scale.set(z.r,1,z.r);R.zoneWall.position.x=z.cx;R.zoneWall.position.z=z.cz;
  const shrink=z.st==='shrink';R.zoneWall.material.color.set(shrink?0xff4a3a:0x2ad4dc);R.zoneWall.material.opacity=.16+.07*Math.sin(R.t*(shrink?7:2));
  R.zoneNext.visible=!shrink&&!z.done;R.zoneNext.scale.set(z.tr,1,z.tr);R.zoneNext.position.x=z.tcx;R.zoneNext.position.z=z.tcz;
 }else R.zoneWall.visible=false;
 // the jet
 if(S.phase==='jet'||(S.phase==='play'&&T<S.jet.dur+10)){
  const jp=jetPos(T);R.jet.visible=true;R.jet.position.set(jp.x,jp.y,jp.z);R.jet.rotation.y=-Math.atan2(S.jet.dx,-S.jet.dz);
 }else R.jet.visible=false;
 // players
 const L=leaderIdx();
 for(let i=0;i<S.players.length;i++){
  const p=S.players[i],q=P[i];
  const av=getAvatar(i);
  if(!p.alive||!q||(i===Net.myIdx&&!v.third)||(q.fl&16)){av.g.visible=false;continue}
  const rp=RP[i]||(RP[i]={x:q.x,y:q.y,z:q.z,yaw:q.yaw,mv:0});
  if(i===Net.myIdx){rp.x=q.x;rp.y=q.y;rp.z=q.z;rp.yaw=q.yaw}
  else{const k=Math.min(1,dt*13);const ox=rp.x,oz=rp.z;rp.x+=(q.x-rp.x)*k;rp.y+=(q.y-rp.y)*k;rp.z+=(q.z-rp.z)*k;let dy=q.yaw-rp.yaw;while(dy>Math.PI)dy-=6.283;while(dy<-Math.PI)dy+=6.283;rp.yaw+=dy*k;rp.mv=Math.hypot(rp.x-ox,rp.z-oz)/Math.max(dt,.001)}
  av.g.visible=true;av.g.position.set(rp.x,rp.y,rp.z);av.g.rotation.y=-rp.yaw;
  const crouch=q.fl&1;av.body.scale.y=crouch?.75:1;av.body.position.y=crouch?.8:.92;
  av.ph+=dt*Math.min(rp.mv,9)*1.3;av.legs.rotation.z=Math.sin(av.ph)*.12*Math.min(1,rp.mv/3);av.body.rotation.z=Math.sin(av.ph)*.05*Math.min(1,rp.mv/3);
  av.chute.visible=!!(q.fl&32);if(q.fl&8&&!(q.fl&32))av.g.rotation.x=0;
  if(av.lastW!==q.w){av.lastW=q.w;const W=WEAPONS[q.w];if(W)av.gun.material.color.set(W.col)}
  av.wanted.visible=(i===L);
  if(i!==Net.myIdx&&(q.fl&4)&&Math.random()<.5)R.spark(rp.x+Math.sin(rp.yaw)*.8,rp.y+1.2,rp.z-Math.cos(rp.yaw)*.8,'#ffd27a',1,2);
 }
 // pickups
 for(const [id,o] of PK){
  let e=R.pk.get(id);
  if(!e){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:pickupTex(o),transparent:true,fog:false}));const sz=o.big?2.6:1.3;s.scale.set(sz,sz,1);R.worldGroup.add(s);e={s,b:null,ph:Math.random()*6};
   if(o.big){const b=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,40,8,1,true),new THREE.MeshBasicMaterial({color:0xf5c542,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));b.position.set(o.x,o.y+20,o.z);R.worldGroup.add(b);e.b=b}
   R.pk.set(id,e)}
  e.s.position.set(o.x,o.y+(o.big?1.8:1)+Math.sin(R.t*2.4+e.ph)*.18,o.z);
  e.s.visible=Math.hypot(o.x-cam.position.x,o.z-cam.position.z)<150;
 }
 for(const [id,e] of R.pk){if(!PK.has(id)){R.worldGroup.remove(e.s);if(e.b)R.worldGroup.remove(e.b);R.pk.delete(id)}}
 // grenades
 for(const [id,o] of R.gr){stepGrenade(o.g,dt);o.m.position.set(o.g.x,o.g.y,o.g.z);o.g.t+=dt;if(o.g.t>8)R.endGrenade(id)}
 // effects
 for(const t of R.tr){if(t.life>0){t.life-=dt;t.l.material.opacity=Math.max(0,t.life/.09);if(t.life<=0)t.l.visible=false}}
 for(const p of R.sp){if(p.life>0){p.life-=dt;p.vy-=14*dt;p.s.position.x+=p.vx*dt;p.s.position.y+=p.vy*dt;p.s.position.z+=p.vz*dt;p.s.material.opacity=Math.max(0,p.life*3);if(p.life<=0)p.s.visible=false}}
 for(let k=R.boomFx.length-1;k>=0;k--){const b=R.boomFx[k];b.t+=dt;const s=1+b.t*18;b.m.scale.set(s,s,s);b.m.material.opacity=Math.max(0,.9-b.t*2.2);if(b.t>.45){sc.remove(b.m);R.boomFx.splice(k,1)}}
 for(let k=R.ft.length-1;k>=0;k--){const f=R.ft[k];f.t+=dt;f.s.position.y=f.y0+f.t*1.6;f.s.material.opacity=Math.min(1,(1.6-f.t)*2);if(f.t>1.6){sc.remove(f.s);f.s.material.map.dispose();f.s.material.dispose();R.ft.splice(k,1)}}
 // camera
 const bob=v.bob||0;
 if(v.mapView){cam.position.set(0,560,0);cam.up.set(0,0,-1);cam.lookAt(0,0,0);R.vm.visible=false}
 else if(v.third){const rp=RP[v.follow]||{x:v.x,y:v.y,z:v.z,yaw:v.yaw};const d=dirFrom(rp.yaw,0);cam.position.set(rp.x-d[0]*5,rp.y+3.2,rp.z-d[2]*5);cam.rotation.set(-.25,-rp.yaw,0);R.vm.visible=false}
 else{
  cam.position.set(v.x,v.y+(v.eye||EYE)+bob,v.z);
  cam.rotation.set(v.pitch+(v.recoil||0)*.03,-v.yaw,v.roll||0);
  R.vm.visible=!v.ads||v.wid!=='short'?!v.hideVm:false;
 }
 R.shake*=Math.pow(.02,dt);if(R.shake>.002){cam.position.x+=(Math.random()-.5)*R.shake;cam.position.y+=(Math.random()-.5)*R.shake;cam.rotation.z+=(Math.random()-.5)*R.shake*.05}
 const fov=v.fov||78;if(Math.abs(cam.fov-fov)>.05){cam.fov+=(fov-cam.fov)*Math.min(1,dt*14);cam.updateProjectionMatrix()}
 // viewmodel pose
 const k=v.ads?1:0;R.vk=(R.vk||0)+(k-(R.vk||0))*Math.min(1,dt*14);
 R.vm.position.set(.2-.2*R.vk,-.2+.075*R.vk-(v.vmDip||0),-.35+(v.recoil||0)*.06);R.vm.rotation.x=(v.recoil||0)*.08;
 R.flash.visible=(v.flashT||0)>0;
 R.renderer.render(sc,cam);
};
