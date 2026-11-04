'use strict';
/* THE BIG CON 3D — Cloudflare Durable Object room relay.
   The host remains authoritative; this layer only transports the existing game messages. */
const RELAY_BASE='wss://bigconhosting.wax-no-bones.workers.dev';
const HEARTBEAT_MS=4000,CONN_TIMEOUT_MS=16000,SNAP_HZ=15,STATE_GAP=.22;

class RelayConnection {
 constructor(peer,id,role){this.peer=peer;this.id=id;this.role=role;this.open=false;this.closed=false;this.handlers=Object.create(null)}
 on(type,fn){(this.handlers[type]||(this.handlers[type]=[])).push(fn);return this}
 _emit(type,value){(this.handlers[type]||[]).slice().forEach(fn=>{try{fn(value)}catch(e){console.error(e)}})}
 _setOpen(){if(this.closed||this.open)return;this.open=true;this._emit('open')}
 _finish(){if(this.closed)return;this.closed=true;this.open=false;this._emit('close');if(this.id)this.peer.connections.delete(this.id)}
 send(data){
  if(!this.open||this.closed)return;
  this.peer._send({type:'data',target:this.role==='host'?this.id:undefined,data});
 }
 close(){
  if(this.closed)return;
  if(this.role==='host'&&this.id)this.peer._send({type:'leave',target:this.id});
  this._finish();
 }
}

class CloudflareRelayPeer {
 constructor(room,role){
  this.room=room;this.role=role;this.id=null;this.open=false;this.ready=false;this.destroyed=false;
  this.handlers=Object.create(null);this.connections=new Map();this.guestConnection=null;this.failed=false;
  const url=RELAY_BASE+'/ws/'+encodeURIComponent(room)+'?role='+role;
  try{
   this.ws=new WebSocket(url);
   this.ws.addEventListener('open',()=>this._send({type:'join'}));
   this.ws.addEventListener('message',e=>this._message(e.data));
   this.ws.addEventListener('error',()=>{if(!this.ready)this._fail(role==='host'?'unavailable-id':'peer-unavailable','Could not connect to the Cloudflare room relay')});
   this.ws.addEventListener('close',()=>this._closed());
  }catch(e){this._fail('network',e&&e.message||'Could not open the Cloudflare room relay')}
 }
 on(type,fn){(this.handlers[type]||(this.handlers[type]=[])).push(fn);return this}
 _emit(type,value){(this.handlers[type]||[]).slice().forEach(fn=>{try{fn(value)}catch(e){console.error(e)}})}
 _send(message){
  if(this.ws&&this.ws.readyState===WebSocket.OPEN){try{this.ws.send(JSON.stringify(message));return true}catch(e){}}
  return false;
 }
 _fail(type,message){
  if(this.failed||this.destroyed)return;this.failed=true;
  this._emit('error',{type,message});
 }
 _closed(){
  if(this.destroyed)return;
  if(!this.ready)this._fail(this.role==='host'?'unavailable-id':'peer-unavailable','The room relay rejected or closed the connection');
  this.open=false;
  for(const c of Array.from(this.connections.values()))c._finish();
  if(this.guestConnection)this.guestConnection._finish();
  this._emit('disconnected');
 }
 _message(raw){
  let msg;try{msg=JSON.parse(raw)}catch(e){return}
  if(msg.type==='ready'){
   this.ready=true;this.open=true;this.id=msg.id;this._emit('open',this.id);
   if(this.role==='guest'&&this.guestConnection)queueMicrotask(()=>this.guestConnection._setOpen());
   return;
  }
  if(msg.type==='incoming'&&this.role==='host'){
   if(this.connections.has(msg.id))return;
   const c=new RelayConnection(this,msg.id,'host');this.connections.set(msg.id,c);
   this._emit('connection',c);queueMicrotask(()=>c._setOpen());return;
  }
  if(msg.type==='data'){
   const c=this.role==='host'?this.connections.get(msg.source):this.guestConnection;
   if(c&&c.open)c._emit('data',msg.data);return;
  }
  if(msg.type==='left'&&this.role==='host'){
   const c=this.connections.get(msg.id);if(c)c._finish();return;
  }
  if(msg.type==='host_lost'&&this.role==='guest'){
   if(this.guestConnection)this.guestConnection._finish();return;
  }
  if(msg.type==='error')this._fail(msg.code||'network',msg.message||'Room relay error');
 }
 connect(){
  if(this.role!=='guest')throw new Error('Only guest relay connections can call connect()');
  if(this.guestConnection&&!this.guestConnection.closed)return this.guestConnection;
  const c=this.guestConnection=new RelayConnection(this,null,'guest');
  if(this.ready)queueMicrotask(()=>c._setOpen());
  return c;
 }
 destroy(){
  if(this.destroyed)return;this.destroyed=true;
  for(const c of Array.from(this.connections.values()))c._finish();
  if(this.guestConnection)this.guestConnection._finish();
  try{if(this.ws&&this.ws.readyState<2)this.ws.close(1000,'Client closed')}catch(e){}
  this.open=false;
 }
}
const HEARTBEAT_MS=4000,CONN_TIMEOUT_MS=16000,SNAP_HZ=15,STATE_GAP=.22;
const $=id=>document.getElementById(id);
function codeSlug(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
function codeLabel(slug){const hit=BUZZWORDS.find(b=>codeSlug(b)===slug);return hit||slug}
function matchBuzzword(input){const s=codeSlug(input);if(!s)return '';if(BUZZWORDS.some(b=>codeSlug(b)===s))return s;const hits=BUZZWORDS.filter(b=>codeSlug(b).startsWith(s));return hits.length===1?codeSlug(hits[0]):s}
function genCode(){return codeSlug(BUZZWORDS[Math.floor(Math.random()*BUZZWORDS.length)])+String(100+Math.floor(Math.random()*900))}
function setNetStatus(msg,err){const el=$('netStatus');el.textContent=msg||'';el.className=err?'err':''}
function cleanName(s){return String(s||'').replace(/[<>&"'`]/g,'').trim().slice(0,16)}
function getPlayerId(){const key='bigcon3d-player-id';let id=null;try{id=sessionStorage.getItem(key)}catch(e){}if(!id){id=(crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2));try{sessionStorage.setItem(key,id)}catch(e){}}return id}
function curT(){if(!S)return 0;return Net.role==='host'?S.t:(Net.gt||S.t)+(performance.now()-(Net.gtAt||performance.now()))/1000}

/* ---------- sending ---------- */
function sendConn(c,msg){if(c&&c.open){try{c.send(msg)}catch(e){}}}
function sendAll(msg){for(let i=0;i<Net.conns.length;i++){if(i===Net.myIdx)continue;sendConn(Net.conns[i],msg)}}
function sendTo(pi,msg){if(pi===Net.myIdx){onMsg(msg);return}sendConn(Net.conns[pi],msg)}
function sendHost(msg){if(Net.role==='host')hostRecv(Net.myIdx,msg);else sendConn(Net.conn,msg)}
Hooks.emit=m=>{sendAll(m);onMsg(m)};
Hooks.to=(pi,m)=>{if(S&&S.players[pi]&&!S.players[pi].bot)sendTo(pi,m)};
let stateDirty=false,stateLast=0;
Hooks.sync=now=>{stateDirty=true;if(now)flushState()};
Hooks.flush=flushState;
function pubState(full){
 const c={};for(const k in S){if(k==='deck'||k==='discard'||k==='log'||k==='chat'||k==='fx')continue;c[k]=S[k]}
 const out=JSON.parse(JSON.stringify(c));
 out.log=S.log.slice(full?-60:-14);out.logN=S.logN|0;out.chat=S.chat.slice(-20);out.chatN=S.chatN|0;out.fx=S.fx.slice(-14);
 return out;
}
function flushState(){
 if(!S||Net.role!=='host')return;stateDirty=false;stateLast=performance.now();
 if(Net.conns.length>1)sendAll({t:'state',s:pubState(false)});
}
function snapMsg(){
 const p=[];for(let i=0;i<S.players.length;i++){const q=P[i];if(!q||!S.players[i].alive)continue;p.push([i,+q.x.toFixed(2),+q.y.toFixed(2),+q.z.toFixed(2),+q.yaw.toFixed(2),+q.pitch.toFixed(2),q.w,q.fl|0])}
 const z=S.zone;return{t:'snap',gt:+S.t.toFixed(2),p,z:z?[+z.cx.toFixed(1),+z.cz.toFixed(1),+z.r.toFixed(1),+z.tcx.toFixed(1),+z.tcz.toFixed(1),+z.tr.toFixed(1),z.st==='shrink'?1:0,+z.until.toFixed(1)]:null};
}
let snapAcc=0,heartAcc=0;
/* called from the host's simulation interval */
function netStep(dt){
 if(Net.role!=='host'||!S||!Net.started)return;
 snapAcc+=dt;if(snapAcc>=1/SNAP_HZ){snapAcc=0;if(Net.conns.length>1)sendAll(snapMsg())}
 if(stateDirty&&performance.now()-stateLast>STATE_GAP*1000)flushState();
 else if(performance.now()-stateLast>900)flushState();
}
function adoptState(ns){
 if(S){ns.log=mergeTail(S.log,S.logN|0,ns.log||[],ns.logN|0);ns.chat=mergeTail(S.chat,S.chatN|0,ns.chat||[],ns.chatN|0)}
 S=ns;Net.gt=ns.t;Net.gtAt=performance.now();
 if(Net.zsnap&&S.zone)Object.assign(S.zone,Net.zsnap);
}
function mergeTail(prev,prevN,tail,totalN){
 if(!prev||prevN==null)return tail.slice();
 const start=totalN-tail.length,keep=prev.length-(prevN-start);
 if(!(keep>=0&&keep<=prev.length))return tail.slice();
 return prev.slice(0,keep).concat(tail).slice(-120);
}
/* a prompt only the owner of a node ever sees (JTPortal cancel, Trump's tariff chain, the Press Room's victim) */
Hooks.ask=(pi,opt)=>new Promise(res=>{
 const p=S.players[pi];
 const def=opt.def!==undefined?opt.def:(opt.options&&opt.options[0]?opt.options[0].v:undefined);
 if(!p||p.bot||p.dc||!p.alive){res(def);return}
 if(pi===Net.myIdx){UI.prompt(opt).then(res);return}
 const c=Net.conns[pi];if(!c||!c.open){res(def);return}
 const pid=++Net.promptSeq;Net.pendingPrompts.set(pid,{res,def,pi});
 sendConn(c,{t:'prompt',pid,title:opt.title,body:opt.body,options:opt.options,timeout:opt.timeout});
 setTimeout(()=>{const q=Net.pendingPrompts.get(pid);if(q){Net.pendingPrompts.delete(pid);res(q.def)}},(opt.timeout||20000)+500);
});

/* ---------- host: receiving ---------- */
function hostRecv(pi,d){
 if(!d||!d.t||!S||!Net.started)return;
 const p=S.players[pi];if(!p)return;
 if(d.t==='pos'){
  if(!p.alive||S.over)return;
  const q=P[pi]||(P[pi]={});
  const f=n=>Number.isFinite(n)?n:0;
  q.x=Math.max(-HX-4,Math.min(HX+4,f(d.x)));q.z=Math.max(-HZ-4,Math.min(HZ+4,f(d.z)));q.y=Math.max(-2,Math.min(220,f(d.y)));q.yaw=f(d.yaw);q.pitch=f(d.pitch);
  q.w=WEAPONS[d.w]?d.w:'stapler';q.fl=d.fl|0;
 }
 else if(d.t==='shot')handleShot(pi,d);
 else if(d.t==='gren'){
  if(!p.alive||p.cuffs>S.t||(p.lastGren&&S.t-p.lastGren<1)||!Array.isArray(d.o)||!Array.isArray(d.v))return;
  p.lastGren=S.t;const v=d.v.map(n=>Math.max(-40,Math.min(40,+n||0)));throwGrenade(pi,d.o.map(n=>+n||0),v);
 }
 else if(d.t==='intent')doAction(pi,d.act,d);
 else if(d.t==='chat')addChat(pi,String(d.text||'').slice(0,140));
}
function onHostData(c,d){
 if(!d||!d.t)return;c.__lastSeen=Date.now();
 if(d.t==='ping'){sendConn(c,{t:'pong'});return}
 if(d.t==='pong')return;
 if(d.t==='hello'){handleHello(c,cleanName(d.name)||'Player',String(d.playerId||''));return}
 const pi=Net.conns.indexOf(c);if(pi<0)return;
 if(d.t==='pick'){if(!Net.started)applyChar(pi,d.char);return}
 if(d.t==='lchat'){if(!Net.started)addLobbyChat(pi,String(d.text||'').slice(0,140));return}
 if(d.t==='answer'){const pr=Net.pendingPrompts.get(d.pid);if(pr&&pr.pi===pi){Net.pendingPrompts.delete(d.pid);pr.res(d.v)}return}
 hostRecv(pi,d);
}
function handleHello(c,name,playerId){
 const existing=playerId?Net.roster.findIndex(e=>e.playerId===playerId):-1;
 if(existing>=0){
  const old=Net.conns[existing];if(old===c)return;
  if(old&&old.open){sendConn(c,{t:'kick',reason:'This player is already connected in this room. Close the other tab before joining again.'});setTimeout(()=>{try{c.close()}catch(e){}},800);return}
  Net.roster[existing].conn=c;Net.conns[existing]=c;c.__lastSeen=Date.now();
  if(Net.started&&S){const p=S.players[existing];p.dc=false;if(p.wasHuman)p.bot=false;log('🔔 '+name+' reconnected to their seat.');sendConn(c,{t:'begin',idx:existing,s:pubState(true),pk:Array.from(PK.values())});flushState();return}
  sendConn(c,{t:'welcome',idx:existing,lobby:lobbyPlayers(),goal:Net.goal,bots:Net.bots,chat:Net.lobbyChat.slice(-40)});broadcastLobby();return;
 }
 if(Net.started&&S){
  const idx=S.players.findIndex((pl,i)=>i<S.humans&&(pl.dc||pl.wasHuman)&&pl.name.toLowerCase()===name.toLowerCase());
  if(idx>=0){const pl=S.players[idx];Net.conns[idx]=c;pl.dc=false;pl.bot=false;c.__lastSeen=Date.now();if(Net.roster[idx]){Net.roster[idx].conn=c;Net.roster[idx].playerId=playerId||Net.roster[idx].playerId}
   log('🔔 '+name+' is back at the table.');sendConn(c,{t:'begin',idx,s:pubState(true),pk:Array.from(PK.values())});flushState();return}
  sendConn(c,{t:'kick',reason:'Game already in progress — no empty seat named “'+name+'”.'});setTimeout(()=>{try{c.close()}catch(e){}},800);return;
 }
 if(Net.roster.length>=MAXHUMANS){sendConn(c,{t:'kick',reason:'Room is full ('+MAXHUMANS+' players).'});setTimeout(()=>{try{c.close()}catch(e){}},800);return}
 if(Net.roster.some(e=>e.name.toLowerCase()===name.toLowerCase()))name=name+' ★';
 Net.roster.push({name,playerId:playerId||String(Math.random()),conn:c,char:null});Net.conns=Net.roster.map(e=>e.conn);
 c.__lastSeen=Date.now();
 sendConn(c,{t:'welcome',idx:Net.roster.length-1,lobby:lobbyPlayers(),goal:Net.goal,bots:Net.bots,chat:Net.lobbyChat.slice(-40)});
 broadcastLobby();
}
function onHostClose(c){
 if(c.__closed)return;c.__closed=true;
 const i=Net.conns.indexOf(c);if(i<0)return;
 if(!Net.started){Net.roster.splice(i,1);Net.conns=Net.roster.map(e=>e.conn);broadcastLobby();return}
 Net.conns[i]=null;
 if(S&&S.players[i]){const p=S.players[i];p.dc=true;log('📴 '+p.name+' lost connection — a stand-in takes the controls.');
  setTimeout(()=>{if(S&&p.dc&&!S.over){p.bot=true;p.wasHuman=true;p.dc=false}},12000)}
}
function startHostHeartbeat(){
 clearInterval(Net.hbTimer);
 Net.hbTimer=setInterval(()=>{
  const now=Date.now();
  for(let i=1;i<Net.conns.length;i++){
   const c=Net.conns[i];if(!c)continue;
   if(!c.open){onHostClose(c);continue}
   if(now-(c.__lastSeen||now)>CONN_TIMEOUT_MS){try{c.close()}catch(_){}onHostClose(c);continue}
   sendConn(c,{t:'ping'});
  }
 },HEARTBEAT_MS);
}

/* ---------- lobby ---------- */
function lobbyPlayers(){return(Net.role==='host'?Net.roster:(Net.lobbyList||[])).map(e=>({name:e.name,char:e.char||null}))}
function broadcastLobby(){sendAll({t:'lobby',list:lobbyPlayers(),goal:Net.goal,bots:Net.bots});renderLobbyList();renderCharGrid();updateStartBtn()}
function applyChar(idx,id){
 const e=Net.roster[idx];if(!e)return;
 if(id&&!charMeta(id))return;
 if(id&&Net.roster.some((r,j)=>j!==idx&&r.char===id))return;
 e.char=id||null;broadcastLobby();
}
function pickFreeChar(used){const f=CHARS.filter(c=>!used.has(c.id));return f.length?f[0].id:CHARS[0].id}
function addLobbyChat(pi,text){
 const name=(Net.role==='host'?Net.roster[pi]:Net.lobbyList&&Net.lobbyList[pi]);if(!name||!text)return;
 const m={n:name.name,t:text};Net.lobbyChat.push(m);if(Net.lobbyChat.length>60)Net.lobbyChat.shift();
 sendAll({t:'lchat',m});renderLobbyChat();
}
function renderLobbyChat(){const el=$('lobbyChatList');el.innerHTML=Net.lobbyChat.map(m=>'<div><b>'+esc(m.n)+':</b> '+esc(m.t)+'</div>').join('');el.scrollTop=el.scrollHeight}
function sendLobbyChat(){
 const inp=$('lobbyChatInput'),t=inp.value.trim();if(!t)return;inp.value='';
 if(Net.role==='host')addLobbyChat(Net.myIdx,t);else sendConn(Net.conn,{t:'lchat',text:t});
}
function renderCharGrid(){
 const g=$('charGrid');if(!g)return;const list=lobbyPlayers(),me=list[Net.myIdx]||{};
 g.innerHTML=CHARS.map(c=>{const takenBy=list.findIndex(p=>p.char===c.id);const taken=takenBy>=0&&takenBy!==Net.myIdx;
  return '<div class="charpick'+(me.char===c.id?' on':'')+(taken?' taken':'')+'" data-c="'+c.id+'"><img src="'+charSrc(c.id)+'" alt=""><div class="cn">'+esc(c.name)+'</div></div>'}).join('');
 g.querySelectorAll('.charpick').forEach(el=>el.onclick=()=>{
  if(el.classList.contains('taken'))return;const id=el.dataset.c;const cur=lobbyPlayers()[Net.myIdx];const want=cur&&cur.char===id?null:id;
  if(Net.role==='host')applyChar(Net.myIdx,want);else sendConn(Net.conn,{t:'pick',char:want});
 });
}
function renderLobbyList(){
 const el=$('lobbyList');if(!el)return;const list=lobbyPlayers();
 el.innerHTML=list.map((p,i)=>{const col=playerColor(i);return '<div class="lrow"><span class="ld" style="background:'+col+'"></span><span class="ln">'+esc(p.name)+(i===Net.myIdx?' (you)':'')+'</span>'+(p.char?'<span class="gn">'+esc(charMeta(p.char)?charMeta(p.char).name:'')+'</span>':'')+(i===0?'<span class="lh">HOST</span>':'')+'</div>'}).join('')
  +(Net.bots>0?'<div class="lrow"><span class="ld" style="background:#555"></span><span class="ln">+ '+Net.bots+' CON BOTS</span><span class="lh">FILLER</span></div>':'');
}
function updateStartBtn(){
 const b=$('btnStart');if(!b)return;const n=lobbyPlayers().length;
 b.disabled=Net.role!=='host';
 b.textContent=Net.role==='host'?'🔥 BOARD THE JET ('+(n+Net.bots)+' cons — '+n+' human'+(n>1?'s':'')+')':'WAITING FOR THE HOST TO START…';
}
function showLobby(asHost){
 $('hostForm').classList.remove('show');$('joinForm').classList.remove('show');$('chooser').style.display='none';
 $('lobbyView').style.display='block';$('roomCodeBig').textContent=Net.roomLabel||Net.roomCode;
 setTimeout(()=>{const e=$('lobbyView');if(e.scrollIntoView)e.scrollIntoView({behavior:'smooth',block:'start'})},30);
 $('goalInput').disabled=!asHost;$('botsInput').disabled=!asHost;
 $('goalInput').value=Net.goal;$('botsInput').value=Net.bots;setGoalUI();
 renderLobbyChat();renderCharGrid();renderLobbyList();updateStartBtn();
}
function setGoalUI(){$('goalNote').textContent=Net.role==='host'?'you set the target':'the host sets the target';$('botsNote').textContent=Net.bots+' bots fill the jet'}

/* ---------- host / join ---------- */
const solo=()=>!Net.peer;
function hostCreate(name,offline){
 Net.role='host';Net.myName=name;Net.playerId=getPlayerId();Net.myIdx=0;Net.roster=[{name,playerId:Net.playerId,conn:null,char:null}];Net.conns=[null];
 if(offline){Net.roomCode='SOLO';Net.roomLabel='SOLO — YOU VS THE BOTS';showLobby(true);setNetStatus('Offline room — no friends can join. Hit BOARD THE JET.');return}
 setNetStatus('Contacting the matchmaker…');
 Net.roomCode=genCode();Net.roomLabel=codeLabel(Net.roomCode);Net.peerOpen=false;hostOpenPeer();startHostHeartbeat();
 clearTimeout(Net.openTimer);Net.openTimer=setTimeout(()=>{if(!Net.peerOpen)setNetStatus('Cannot reach the PeerJS matchmaker (network, firewall or ad-blocker?). You can still play SOLO vs bots.',true)},12000);
}
function hostOpenPeer(){
 const code=Net.roomCode,old=Net.peer;if(old&&!old.destroyed){try{old.destroy()}catch(_){}}
 const p=new CloudflareRelayPeer(code,'host');Net.peer=p;let opened=false;
 p.on('open',()=>{
  opened=true;Net.peerOpen=true;if(Net.peer!==p)return;
  showLobby(true);if(!Net.started)setNetStatus('Cloudflare room created — share '+Net.roomLabel+'. Waiting for co-conspirators…');
 });
 p.on('disconnected',()=>{
  if(Net.peer!==p||p.destroyed)return;
  setNetStatus('Relay connection interrupted — reconnecting the room…',true);
  setTimeout(()=>{if(Net.peer===p&&!p.destroyed)hostOpenPeer()},1800);
 });
 p.on('error',e=>{
  const ty=e&&e.type;if(Net.peer!==p)return;
  if(ty==='unavailable-id'&&!opened&&!Net.started){
   try{p.destroy()}catch(x){}
   Net.roomCode=genCode();Net.roomLabel=codeLabel(Net.roomCode);hostOpenPeer();return;
  }
  setNetStatus('Cloudflare relay error: '+(e&&e.message||ty||'unknown')+'. Check the relay service and try again.',true);
 });
 p.on('connection',c=>{
  c.on('open',()=>{c.__lastSeen=Date.now();c.on('data',d=>{try{onHostData(c,d)}catch(err){console.error(err)}})});
  c.on('close',()=>onHostClose(c));
  c.on('error',()=>onHostClose(c));
 });
}
let guestRetry=0,guestHb=null;
function guestJoin(name,code){
 Net.role='guest';Net.myName=name;Net.playerId=getPlayerId();Net.roomCode=matchBuzzword(code);Net.roomLabel=codeLabel(Net.roomCode);
 connectGuest();
}
function connectGuest(){
 setNetStatus('Connecting to Cloudflare room '+Net.roomLabel+'…');
 const old=Net.peer;if(old&&!old.destroyed){try{old.destroy()}catch(_){}}
 const p=new CloudflareRelayPeer(Net.roomCode,'guest');Net.peer=p;
 p.on('open',()=>{
  const c=p.connect();Net.conn=c;
  const to=setTimeout(()=>{
   if(!c.open){
    setNetStatus('Room connection timed out — retrying '+Net.roomLabel+'…',true);
    try{p.destroy()}catch(e){}
    if(!Net.started&&guestRetry<4){guestRetry++;setTimeout(connectGuest,700*guestRetry)}
    else if(!Net.started)setNetStatus('Could not reach room “'+Net.roomLabel+'”. Check the code and ask the host to keep the room open.',true);
   }
  },12000);
  c.on('open',()=>{clearTimeout(to);guestRetry=0;c.__lastSeen=Date.now();sendConn(c,{t:'hello',name:Net.myName,playerId:Net.playerId});setNetStatus('Connected to Cloudflare relay — waiting for the lobby…');startGuestHeartbeat(c)});
  c.on('data',d=>{c.__lastSeen=Date.now();try{onGuestData(d)}catch(e){console.error(e)}});
  c.on('close',()=>{if(c.__lost)return;c.__lost=true;guestLost()});
  c.on('error',()=>{if(c.__lost)return;c.__lost=true;guestLost()});
 });
 p.on('error',e=>{
  if(Net.peer!==p)return;
  const ty=e&&e.type;
  if(ty==='peer-unavailable'&&!Net.started&&guestRetry<4){
   guestRetry++;setNetStatus('Room not available yet — retrying '+Net.roomLabel+' ('+guestRetry+'/4)…',true);
   setTimeout(()=>{if(!Net.started&&Net.peer===p)connectGuest()},700*guestRetry);return;
  }
  if(ty==='peer-unavailable')setNetStatus('No room called “'+Net.roomLabel+'” right now. Check the code and that the host is connected.',true);
  else if(!Net.started)setNetStatus('Cloudflare relay error: '+(e&&e.message||ty||'unknown')+'. Check your connection and try again.',true);
 });
}
function onGuestData(d){
 if(!d||!d.t)return;
 if(d.t==='ping'){sendConn(Net.conn,{t:'pong'});return}
 if(d.t==='pong')return;
 if(d.t==='host_lost'){guestLost();return}
 if(d.t==='welcome'){Net.myIdx=d.idx;Net.lobbyList=d.lobby;Net.goal=d.goal;Net.bots=d.bots|0;Net.lobbyChat=d.chat||[];setNetStatus('In the lobby — pick a face and wait for the host.');showLobby(false);return}
 if(d.t==='lobby'){Net.lobbyList=d.list;Net.goal=d.goal;Net.bots=d.bots|0;$('goalInput').value=Net.goal;$('botsInput').value=Net.bots;setGoalUI();renderLobbyList();renderCharGrid();updateStartBtn();return}
 if(d.t==='lchat'){Net.lobbyChat.push(d.m);if(Net.lobbyChat.length>60)Net.lobbyChat.shift();renderLobbyChat();return}
 if(d.t==='kick'){Net.started=false;UI.fatal(d.reason||'Removed from the room.');return}
 if(d.t==='begin'){Net.myIdx=d.idx;adoptState(d.s);PK.clear();(d.pk||[]).forEach(o=>PK.set(o.id,o));Net.started=true;enterGame(true);return}
 if(d.t==='state'){if(Net.started)adoptState(d.s);return}
 if(d.t==='snap'){applySnap(d);return}
 if(d.t==='prompt'){UI.prompt({title:d.title,body:d.body,options:d.options,timeout:d.timeout}).then(v=>sendConn(Net.conn,{t:'answer',pid:d.pid,v}));return}
 onMsg(d);
}
function applySnap(d){
 if(!S)return;Net.gt=d.gt;Net.gtAt=performance.now();
 for(const a of d.p){const i=a[0];if(i===Net.myIdx)continue;const q=P[i]||(P[i]={});q.x=a[1];q.y=a[2];q.z=a[3];q.yaw=a[4];q.pitch=a[5];q.w=a[6];q.fl=a[7];q.seen=performance.now()}
 if(d.z){const zs=Net.zsnap={cx:d.z[0],cz:d.z[1],r:d.z[2],tcx:d.z[3],tcz:d.z[4],tr:d.z[5],st:d.z[6]?'shrink':'wait',until:d.z[7]};S.zone=Object.assign(S.zone||{},zs)}
}
/* messages that both guests and the host's own UI react to */
function onMsg(m){
 switch(m.t){
  case 'pka':m.a.forEach(o=>PK.set(o.id,o));break;
  case 'pkr':PK.delete(m.id);break;
  default:if(typeof Game!=='undefined'&&Game.onMsg)Game.onMsg(m);
 }
}
function startMatch(){
 if(Net.role!=='host'||Net.started)return;
 Net.goal=clampGoal($('goalInput').value);Net.bots=Math.max(0,Math.min(MAXENT-Net.roster.length,parseInt($('botsInput').value||'0',10)||0));
 const used=new Set(Net.roster.map(e=>e.char).filter(Boolean));
 const defs=Net.roster.map(e=>{let ch=e.char;if(!ch){ch=pickFreeChar(used);used.add(ch)}return{name:e.name,char:ch}});
 Net.started=true;Net.myIdx=0;
 initGame(defs,{goal:Net.goal,bots:Net.bots});
 for(let i=1;i<Net.conns.length;i++)sendConn(Net.conns[i],{t:'begin',idx:i,s:pubState(true),pk:Array.from(PK.values())});
 enterGame(false);
}
