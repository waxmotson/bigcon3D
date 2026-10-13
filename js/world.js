'use strict';
/* THE BIG CON 3D — the arena.
   The 2400x1560 evidence board becomes a 480x312 metre arena. Every exhibit is a
   giant pinned card on a post; the red threads are sprint lanes between them.
   Pure maths only (no THREE) so the host simulation, the bots and the renderer
   all share exactly the same collision world. */
const SC=0.2,HX=242,HZ=158,NODE_R=6.5,EYE=1.65,PR=0.42;
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

const WEAPONS={
 stapler:{n:'THE STAPLER',dmg:21,rof:.26,range:75,mag:12,res:48,auto:false,spread:.006,pel:1,rel:1.0,hm:1.8,col:'#d8d8d8',tr:'#ffe28a',snd:0},
 ticker:{n:'TICKER TAPE',dmg:11,rof:.075,range:58,mag:32,res:96,auto:true,spread:.022,pel:1,rel:1.5,hm:1.5,col:'#55c1ff',tr:'#9fe3ff',snd:1},
 cashrate:{n:'THE CASH RATE',dmg:17,rof:.105,range:95,mag:28,res:84,auto:true,spread:.012,pel:1,rel:1.7,hm:1.7,col:'#f5c542',tr:'#ffd97a',snd:2},
 yield:{n:'YIELD CURVE',dmg:10,rof:.85,range:30,mag:6,res:24,auto:false,spread:.07,pel:8,rel:2.2,hm:1.3,col:'#e19bff',tr:'#f0c4ff',snd:3},
 short:{n:'THE SHORT SELLER',dmg:88,rof:1.25,range:220,mag:4,res:12,auto:false,spread:.0004,pel:1,rel:2.3,hm:2.0,col:'#ff5e9c',tr:'#ff9cc2',snd:4,zoom:3.4}
};
const WORDER=['stapler','ticker','cashrate','yield','short'];
const GREN={dmg:78,rad:10,fuse:2.1};

const World={obs:[],grid:new Map(),CS:12,seed:0};
World.build=function(seed,quikSlot){
 World.seed=seed;World.obs=[];World.grid=new Map();
 applyQuikSlot(QUIK_SLOTS[quikSlot|0]||QUIK_SLOTS[0]);
 NODES.forEach(n=>{n.wx=(n.x-1200)*SC;n.wz=(n.y-780)*SC;n.big=n.cost>=8});
 const rnd=mulberry(seed||1);
 NODES.forEach(n=>World.add({c:1,x:n.wx,z:n.wz,r:.75,h:9}));
 const nearNode=(x,z,m)=>NODES.some(n=>Math.hypot(n.wx-x,n.wz-z)<m);
 const rects=[];
 const tryBox=(hx,hz,h,minNode)=>{
  for(let k=0;k<30;k++){
   const x=(rnd()*2-1)*(HX-6),z=(rnd()*2-1)*(HZ-6);
   if(nearNode(x,z,minNode))continue;
   if(rects.some(r=>Math.abs(r.x-x)<r.hx+hx+1.4&&Math.abs(r.z-z)<r.hz+hz+1.4))continue;
   const o={c:0,x,z,hx,hz,h,k:(rnd()*5)|0};rects.push(o);World.add(o);return o;
  }
 };
 for(let i=0;i<170;i++)tryBox(.8+rnd()*1.6,.8+rnd()*1.6,1+rnd()*2.2,9);     // crates & newspaper bundles
 for(let i=0;i<46;i++){const along=rnd()<.5;tryBox(along?4+rnd()*5:.35,along?.35:4+rnd()*5,2.6+rnd()*.8,11)} // cork partitions
 for(let i=0;i<34;i++){                                                       // oil barrels
  const x=(rnd()*2-1)*(HX-6),z=(rnd()*2-1)*(HZ-6);
  if(nearNode(x,z,9))continue;World.add({c:1,x,z,r:.7,h:1.5,k:6});
 }
 World.nodeSet=NODES.slice();
};
World.add=function(o){
 o.id=World.obs.length;World.obs.push(o);
 const x0=o.c?o.x-o.r:o.x-o.hx,x1=o.c?o.x+o.r:o.x+o.hx,z0=o.c?o.z-o.r:o.z-o.hz,z1=o.c?o.z+o.r:o.z+o.hz;
 const CS=World.CS;
 for(let gx=Math.floor(x0/CS);gx<=Math.floor(x1/CS);gx++)for(let gz=Math.floor(z0/CS);gz<=Math.floor(z1/CS);gz++){
  const k=gx+','+gz;let a=World.grid.get(k);if(!a){a=[];World.grid.set(k,a)}a.push(o);
 }
};
World.near=function(x,z,r){
 const CS=World.CS,out=[],seen=new Set();
 for(let gx=Math.floor((x-r)/CS);gx<=Math.floor((x+r)/CS);gx++)for(let gz=Math.floor((z-r)/CS);gz<=Math.floor((z+r)/CS);gz++){
  const a=World.grid.get(gx+','+gz);if(!a)continue;
  for(const o of a)if(!seen.has(o.id)){seen.add(o.id);out.push(o)}
 }
 return out;
};
/* highest surface under (x,z) that the feet at height y can stand on */
World.groundAt=function(x,z,y){
 let g=0;
 for(const o of World.near(x,z,1.2)){
  if(y<o.h-.5)continue;
  const inside=o.c?Math.hypot(x-o.x,z-o.z)<o.r+.15:(Math.abs(x-o.x)<o.hx+.15&&Math.abs(z-o.z)<o.hz+.15);
  if(inside&&o.h>g)g=o.h;
 }
 return g;
};
/* push a body (radius pr, feet y, height ph) out of every solid it overlaps */
World.pushOut=function(p,pr,ph){
 pr=pr||PR;ph=ph||1.75;
 for(let it=0;it<2;it++)for(const o of World.near(p.x,p.z,pr+2)){
  if(p.y>=o.h-.45)continue;
  if(o.c){
   const dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz),m=o.r+pr;
   if(d<m){const k=d>1e-4?(m-d)/d:0;if(d>1e-4){p.x+=dx*k;p.z+=dz*k}else p.x+=m}
  }else{
   const cx=Math.max(o.x-o.hx,Math.min(p.x,o.x+o.hx)),cz=Math.max(o.z-o.hz,Math.min(p.z,o.z+o.hz));
   let dx=p.x-cx,dz=p.z-cz;const d2=dx*dx+dz*dz;
   if(d2<pr*pr){
    if(d2>1e-8){const d=Math.sqrt(d2),k=(pr-d)/d;p.x+=dx*k;p.z+=dz*k}
    else{ // centre inside the box: shove along the shallowest axis
     const px=o.hx+pr-Math.abs(p.x-o.x),pz=o.hz+pr-Math.abs(p.z-o.z);
     if(px<pz)p.x+=(p.x>=o.x?px:-px);else p.z+=(p.z>=o.z?pz:-pz);
    }
   }
  }
 }
 p.x=Math.max(-HX,Math.min(HX,p.x));p.z=Math.max(-HZ,Math.min(HZ,p.z));
};
/* first world hit along a ray: distance, or maxD */
World.ray=function(ox,oy,oz,dx,dy,dz,maxD){
 let best=maxD;
 if(dy<-1e-6){const t=-oy/dy;if(t>0&&t<best)best=t}
 const ex=ox+dx*maxD,ez=oz+dz*maxD,minx=Math.min(ox,ex)-1,maxx=Math.max(ox,ex)+1,minz=Math.min(oz,ez)-1,maxz=Math.max(oz,ez)+1;
 const CS=World.CS,seen=new Set();
 for(let gx=Math.floor(minx/CS);gx<=Math.floor(maxx/CS);gx++)for(let gz=Math.floor(minz/CS);gz<=Math.floor(maxz/CS);gz++){
  const a=World.grid.get(gx+','+gz);if(!a)continue;
  for(const o of a){
   if(seen.has(o.id))continue;seen.add(o.id);
   let t=-1;
   if(o.c){ // vertical cylinder
    const fx=ox-o.x,fz=oz-o.z,A=dx*dx+dz*dz;
    if(A<1e-9)continue;
    const B=2*(fx*dx+fz*dz),C=fx*fx+fz*fz-o.r*o.r,disc=B*B-4*A*C;
    if(disc<0)continue;
    const s=Math.sqrt(disc);let t0=(-B-s)/(2*A);if(t0<0)t0=(-B+s)/(2*A);
    if(t0>0){const y=oy+dy*t0;if(y>=0&&y<=o.h)t=t0}
   }else{
    let tmin=0,tmax=best;
    const sl=(p,d,lo,hi)=>{
     if(Math.abs(d)<1e-9)return p>=lo&&p<=hi;
     let a1=(lo-p)/d,a2=(hi-p)/d;if(a1>a2){const q=a1;a1=a2;a2=q}
     if(a1>tmin)tmin=a1;if(a2<tmax)tmax=a2;return tmin<=tmax;
    };
    if(sl(ox,dx,o.x-o.hx,o.x+o.hx)&&sl(oy,dy,0,o.h)&&sl(oz,dz,o.z-o.hz,o.z+o.hz))t=tmin;
   }
   if(t>0&&t<best)best=t;
  }
 }
 return best;
};
/* ray vs a standing player (feet at p.y): returns {t,head} or null */
function rayPlayer(ox,oy,oz,dx,dy,dz,px,py,pz,crouch,maxD){
 const h=crouch?1.25:1.75,hy=py+(crouch?1.05:1.5),hr=.26;
 let bestT=Infinity,head=false;
 // head sphere
 {const fx=ox-px,fy=oy-hy,fz=oz-pz,B=fx*dx+fy*dy+fz*dz,C=fx*fx+fy*fy+fz*fz-hr*hr,disc=B*B-C;
  if(disc>=0){const t=-B-Math.sqrt(disc);if(t>0&&t<maxD){bestT=t;head=true}}}
 // body cylinder
 {const fx=ox-px,fz=oz-pz,A=dx*dx+dz*dz;
  if(A>1e-9){const B=2*(fx*dx+fz*dz),C=fx*fx+fz*fz-.45*.45,disc=B*B-4*A*C;
   if(disc>=0){const s=Math.sqrt(disc),t=(-B-s)/(2*A);
    if(t>0&&t<maxD&&t<bestT){const y=oy+dy*t;if(y>=py&&y<=py+h){bestT=t;head=false}}}}}
 return bestT<Infinity?{t:bestT,head}:null;
}
function nodeAt(x,z,r){let b=null,bd=r||NODE_R;for(const n of NODES){const d=Math.hypot(n.wx-x,n.wz-z);if(d<bd){bd=d;b=n}}return b}
