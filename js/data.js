'use strict';
/* THE BIG CON 3D — game data.
   The exhibits, threads, moods and the 25-card market deck are carried over
   unchanged from THE BIG CON v1.5 (waxmotson/bigcon). */
const NODES=[
{id:'citi',image:'./static/citi tower.webp',name:['CITI TOWER'],icon:'🏦',type:'BANK',shape:'logo',band:'#1a5fa8',income:3,cost:8,x:210,y:150,rot:-2,sub:'too big to fail · 007 on payroll',sp:'+$1 income per CORPORATE node you own (James Bond is on the payroll).'},
{id:'commbank',image:'./static/cba.png',name:['COMMONWEALTH BANK'],icon:'🏦',type:'BANK',shape:'logo',band:'#d4a017',income:2,cost:6,x:400,y:95,rot:2,sub:'can’t be beat? we’ll see',sp:'+$2 income while you own any other BANK (the big four stick together).'},
{id:'nab',image:'./static/nab.png',name:['NAB'],icon:'🏦',type:'BANK',shape:'logo',band:'#c0392b',income:2,cost:6,x:590,y:165,rot:-1,sub:'more than money',sp:'Seizing CHART nodes costs you $1 less (their analysts share screens).'},
{id:'anz',image:'./static/anz.png',name:['ANZ'],icon:'🏦',type:'BANK',shape:'logo',band:'#2e7d64',income:2,cost:6,x:770,y:100,rot:2,sub:'the blue bank',sp:'+$1 income per CHART node you own (ANZ reads the data).'},
{id:'westpac',image:'./static/westpac.png',name:['WESTPAC'],icon:'🏦',type:'BANK',shape:'logo',band:'#d21e2b',income:2,cost:6,x:500,y:270,rot:1,sub:'the red bank · the other fourth',sp:'+$1 income per REGULATOR you own (they have sat through every inquiry).'},
{id:'bond',image:'./static/bond desk.png',name:['THE BOND DESK'],icon:'💼',type:'BANK',income:3,cost:8,x:1040,y:310,rot:1,sub:'“Government Bond: the collapse of the world’s safest investment.”',sp:'Gain 2 Intel when you seize it. Collects the tolls when BONDMAGEDDON.'},
{id:'hedge',image:'./static/hedge fund.png',name:['THE HEDGE FUND'],icon:'🕶️',type:'BANK',income:2,cost:6,x:1260,y:300,rot:-2,sub:'somebody’s shorting',sp:'+$3 whenever ANY player is raided — even you.'},
{id:'rba',image:'./static/rba.png',name:['RESERVE BANK','OF AUSTRALIA'],icon:'🏛️',type:'REGULATOR',shape:'logo',band:'#4a5a66',income:2,cost:10,x:960,y:145,rot:1,sub:'sets the price of money',sp:'−1 Cortisol at the start of each of your turns. The cash rate is whatever you say it is. Hostile takeovers stay at list price forever.'},
{id:'asic',image:'./static/asic.png',name:['ASIC'],icon:'⚖️',type:'REGULATOR',shape:'logo',band:'#1f3a5f',income:1,cost:5,x:1160,y:95,rot:-1,sub:'the corporate cop',sp:'Unlocks AUDIT ($4): any rival +1 Cortisol, once per turn.'},
{id:'accc',image:'./static/accc.png',name:['ACCC'],icon:'🧐',type:'REGULATOR',shape:'logo',band:'#233a8f',income:1,cost:5,x:1360,y:155,rot:1,sub:'reviews every merger',sp:'When a rival hostile-takes one of YOUR nodes, they pay you an extra $2 (ACCC review fee).'},
{id:'gov',image:'./static/coat of arms.png',name:['AUSTRALIAN GOVERNMENT','COAT OF ARMS'],icon:'🦘',type:'REGULATOR',shape:'logo',band:'#1b3a2a',income:2,cost:8,x:1540,y:100,rot:-1,sub:'documents, logos & ribbons',sp:'Unlocks BUDGET NIGHT ($3): every rival pays you $1 and you gain +1 Intel.'},
/* — charts pinned across the collage, not stacked in one corner — */
{id:'us',image:'./static/us treasury yeild.png',name:['US BOND','YIELDS'],type:'CHART',shape:'chart',spark:'up',income:0,cost:2,x:1980,y:95,rot:1,sub:'the safe haven',sp:'+$1 while you own the 10-YEAR MASTER CHART; +$1 on BONDMAGEDDON; +$2 on TRUMP TWEETS TARIFFS.'},
{id:'japan',image:'./static/debt japan.png',name:['JAPAN BOND','YIELDS'],type:'CHART',shape:'chart',spark:'up',income:0,cost:2,x:2260,y:455,rot:-1,sub:'largest foreign holder, allegedly',sp:'+$1 while you own the MASTER CHART; +$3 on BONDMAGEDDON (curve control fails).'},
{id:'uk',image:'./static/uk bond yield.png',name:['UK BOND','YIELDS'],type:'CHART',shape:'chart',spark:'up',income:0,cost:2,x:980,y:1165,rot:1,sub:'gilts gone wild',sp:'+$1 while you own the MASTER CHART; +$1 on BONDMAGEDDON.'},
{id:'aus',image:'./static/aus bond yield.png',name:['AUSTRALIAN','BOND YIELDS'],type:'CHART',shape:'chart',spark:'up',income:0,cost:2,x:1325,y:85,rot:1,sub:'home soil',sp:'+$1 while you own the MASTER CHART; +$1 on BONDMAGEDDON.'},
{id:'tenyear',image:'./static/government bond comparison.png',name:['10-YEAR GOVT','BOND YIELDS'],type:'CHART',shape:'chart',spark:'up',income:1,cost:4,x:1285,y:205,rot:1,sub:'the master chart — now in the middle of everything',sp:'THE MASTER CHART: +$3 income for every other CHART node you own.'},
{id:'infl',image:'./static/inflation data.png',name:['INFLATION','COMPENSATION'],type:'CHART',shape:'chart',spark:'up',income:1,cost:3,x:1085,y:675,rot:-1,sub:'the hidden tax',sp:'Your salary is $4, not $3 — indexed to CPI.'},
{id:'cash',image:'./static/cash rate graph.png',name:['CASH-RATE','CHART'],type:'CHART',shape:'chart',spark:'step',income:1,cost:3,x:880,y:210,rot:1,sub:'the RBA headline',sp:'+$2 whenever the RBA CASH-RATE DECISION is drawn (you set it).'},
{id:'stock',image:'./static/stock market graph.png',name:['STOCK-MARKET','CHARTS'],type:'CHART',shape:'chart',spark:'vola',income:1,cost:3,x:1365,y:365,rot:1,sub:'green days, red days',sp:'+$1 while you own THE TERMINAL or FOX BUSINESS (fast data).'},
/* — the commodities — */
{id:'oil',image:'./static/wti crude.png',name:['CRUDE OIL PIT','WTI · USD/BBL'],icon:'🛢️',type:'COMMODITY',income:8,cost:12,x:1500,y:470,rot:-2,sub:'the ticker that never sleeps',sp:'Pays $8 a turn. $6 windfall whenever OIL SPIKES is drawn.'},
{id:'oilgraph',image:'./static/oil price increease.png',name:['OIL PRICE','INCREASE'],type:'COMMODITY',shape:'chart',spark:'up',income:1,cost:3,x:1680,y:540,rot:2,sub:'the graph that called it',sp:'+$2 whenever OIL SPIKES (you drew the graph).'},
{id:'barrels',image:'./static/blue oil barrels.png',name:['BLUE OIL','BARRELS'],icon:'🛢️',type:'COMMODITY',income:2,cost:4,x:1320,y:480,rot:1,sub:'stacked and photographed',sp:'+$1 income while you own THE FORKLIFT.'},
{id:'tanker',image:'./static/tanker fleet.png',name:['THE TANKER FLEET'],icon:'🚢',type:'COMMODITY',income:2,cost:5,x:1850,y:430,rot:2,sub:'coal & crude by sea',sp:'+$3 on OIL SPIKES or COAL RUSH.'},
{id:'petronas',image:'./static/petronas.png',name:['PETRONAS'],icon:'🛢️',type:'COMMODITY',shape:'logo',band:'#00a19b',income:3,cost:7,x:2000,y:530,rot:-1,sub:'the national oil company',sp:'+$3 on OIL SPIKES.'},
{id:'gold',image:'./static/gold coloured coin.jpg',name:['GOLD-COLOURED','COINS'],icon:'🪙',type:'COMMODITY',income:2,cost:5,x:1330,y:620,rot:-2,sub:'shiny. suspiciously shiny.',sp:'+$5 whenever GOLD RUSH is drawn.'},
{id:'train',image:'./static/coal train.png',name:['THE COAL TRAIN'],icon:'🚃',type:'COMMODITY',income:2,cost:5,x:770,y:700,rot:-2,sub:'tonnage by rail',sp:'+1 movement step each turn while owned (the express). Does not stack with THE BULLET TRAIN.'},
{id:'port',image:'./static/coal terminal.png',name:['COAL TERMINAL','THE DOCKS'],icon:'⚓',type:'COMMODITY',income:3,cost:7,x:950,y:800,rot:2,sub:'ships in the night',sp:'+$5 on CEO PHOTO LEAKS if you also own COAL CORP HQ (shipped before the news).'},
{id:'bhp',image:'./static/bhp.png',name:['BHP','THE BIG AUSTRALIAN'],icon:'⛏️',type:'COMMODITY',shape:'logo',band:'#ee3a23',income:3,cost:7,x:560,y:820,rot:-2,sub:'pit to port · ore and more',sp:'+$3 on COAL RUSH or GOLD RUSH. +$1 income while you own THE COAL TRAIN.'},
{id:'forklift',image:'./static/forklift.png',name:['THE FORKLIFT'],icon:'🚜',type:'COMMODITY',income:1,cost:4,x:1520,y:650,rot:-1,sub:'it moves everything',sp:'+$1 income per COMMODITY node you own.'},
/* — the corporates — */
{id:'coal',image:'./static/coal corp hq.png',name:['COAL CORP HQ','CEO COAL'],icon:'🚂',type:'CORPORATE',shape:'logo',band:'#3f3f3f',income:3,cost:7,x:150,y:480,rot:-2,sub:'Mark Watson, Chief Executive',sp:'+1 movement step per turn. With THE COAL TRAIN too: 4 steps — the private express.'},
{id:'quik',image:'./static/quikstop.png',name:['QUIKSTOP'],icon:'⛽',type:'CORPORATE',shape:'logo',band:'#c05621',income:2,cost:5,x:350,y:430,rot:2,sub:'the storefront · fuel, snacks & shopping bags',sp:'Collects $1 from every rival on OIL SPIKES; +$4 on PROFIT WARNING.'},
{id:'market',image:'./static/marketplace.webp',name:['MARKETPLACE','LEICHARDT'],icon:'🛍️',type:'CORPORATE',shape:'logo',band:'#b0342e',income:2,cost:5,x:170,y:660,rot:1,sub:'shopping centre · interior & exterior',sp:'+$2 income while you also own QUIKSTOP (the anchor tenant).'},
{id:'f1',image:'./static/f1.png',name:['FORMULA 1','RACING CAR'],icon:'🏎️',type:'CORPORATE',shape:'photo',income:2,cost:6,x:380,y:760,rot:-3,sub:'sponsorship pays',sp:'Unlocks THE SLIPSTREAM ($2, during movement, once per turn): +2 steps and your next seizure this turn costs $2 less.'},
{id:'qantas',image:'./static/qantas.png',name:['QANTAS','THE FLYING KANGAROO'],icon:'✈️',type:'CORPORATE',shape:'logo',band:'#e0001b',income:2,cost:20,x:575,y:975,rot:2,sub:'the spirit of australia',sp:'Cannot be reached on turn 1. Unlocks FLY THE JET ($3, during movement): teleport to any node. Hostile takeovers stay at list price forever.'},
{id:'bullet',image:'./static/bullet train.png',name:['THE BULLET TRAIN'],icon:'🚄',type:'CORPORATE',income:2,cost:6,x:95,y:1240,rot:-1,sub:'fast enough to outrun a hearing',sp:'+1 movement step each turn. Does not stack with THE COAL TRAIN — pick the faster service.'},
/* — the media — */
{id:'press',image:'./static/jtportal quite frankly.png',name:['“QUITE FRANKLY,','JTPORTAL…” PRESS ROOM'],icon:'🗣️',type:'MEDIA',shape:'bubble',income:2,cost:6,x:760,y:900,rot:-1,sub:'narrative for sale',sp:'Unlocks SPIN ($3): −2 own Cortisol or +1 rival Cortisol.'},
{id:'fox',image:'./static/fox business.png',name:['FOX BUSINESS'],icon:'🦊',type:'MEDIA',shape:'logo',band:'#1a2f6b',income:2,cost:10,x:980,y:1000,rot:2,sub:'fair & furious',sp:'Unlocks FOX SPIN ($2): −3 own Cortisol or +1 rival’s. Deflects the CEO photo leak.'},
{id:'leak',image:'./static/bondmageddon 2.png',name:['“BOND MARKETS','REVOLT” — THE LEAK'],icon:'📰',type:'MEDIA',shape:'bubble',income:2,cost:6,x:1200,y:930,rot:2,sub:'someone talked',sp:'+1 Intel when you seize it; +$2 whenever BONDMAGEDDON runs.'},
{id:'jim',image:'./static/jim chalmers breaking news.jpg',name:['“THE JIM…”','TREASURY EXCLUSIVE'],icon:'🗞️',type:'MEDIA',shape:'news',income:1,cost:4,x:1420,y:880,rot:-2,sub:'bond-market news graphic',sp:'+$2 whenever a GOVERNMENT event runs (budgets & rate decisions).'},
{id:'herald',image:'./static/the jim reaper.png',name:['HERALD SUN','THE JIM REAPER'],icon:'📰',type:'MEDIA',shape:'news',income:1,cost:4,x:1725,y:265,rot:2,sub:'front page, every page',sp:'+$2 whenever a GOVERNMENT event runs. +1 Intel whenever any rival gains Cortisol from an event.'},
{id:'bess',image:'./static/big bessent breaking news.jpg',name:['“BIG BESSENT”','BREAKING'],icon:'📣',type:'MEDIA',shape:'bubble',income:1,cost:4,x:1630,y:930,rot:-1,sub:'the big man speaks',sp:'+$2 whenever BOND or RATE events run — he moves markets by talking.'},
{id:'insider',image:'./static/insider trading graphic.png',name:['“INSIDER TRADING”','THE GRAPHIC'],icon:'⚠️',type:'MEDIA',shape:'news',income:1,cost:4,x:1830,y:860,rot:2,sub:'circled in red marker',sp:'Your BUG actions cost 0 Intel (it’s only insider trading if you’re on the outside).'},
{id:'photo',image:'./static/the big con.png',name:['THE BIG CON'],icon:'📷',type:'MEDIA',income:1,cost:5,x:1220,y:1210,rot:-2,sub:'faces pinned to cork',sp:'+1 Intel whenever any rival seizes a node — the wall sees everything.'},
{id:'bigshort',image:'./static/the big short.png',name:['THE BIG SHORT','THE CINEMA'],icon:'🎬',type:'MEDIA',shape:'logo',band:'#8a1f11',income:1,cost:4,x:1420,y:1080,rot:1,sub:'they explained it with a Jenga tower',sp:'+$3 whenever a crash event runs (BONDMAGEDDON, CRACKDOWN).'},
{id:'news',image:'./static/all the newspapers.jpg',name:['THE NEWSPAPERS','ALL OF THEM'],icon:'🗞️',type:'MEDIA',shape:'news',income:1,cost:3,x:860,y:1250,rot:-1,sub:'interest-rate clippings & small headlines',sp:'+1 Intel at the start of your turn while you own 2+ MEDIA nodes.'},
{id:'wef',image:'./static/world economic forum.webp',name:['WORLD ECONOMIC','FORUM'],icon:'🏔️',type:'MEDIA',shape:'logo',band:'#0b3d91',income:2,cost:6,x:1750,y:1300,rot:-2,sub:'the conference stage',sp:'Your bugs skim $2 instead of $1 (global networks, ski trips).'},
/* — the backrooms — */
{id:'back',image:'./static/backroom deals.png',name:['BACKROOM DEALS'],icon:'🤝',type:'WILD',income:1,cost:4,x:960,y:430,rot:-3,sub:'cash · intel · favors',sp:'Pay up to $3 of any seizure shortfall with Intel (1 🛈 = $1). Unlocks LEAN ON THE TABLE: every other player gains +1 Cortisol.'},
{id:'term',image:'./static/bloomberg terminal.png',name:['THE TERMINAL'],icon:'📈',type:'WILD',income:1,cost:4,x:1440,y:255,rot:1,sub:'the screens never sleep',sp:'End movement here to PEEK at the top Event card — keep it or bury it.'},
{id:'golf',image:'./static/golf club.jpg',name:['THE GOLF CLUB'],icon:'⛳',type:'WILD',income:2,cost:6,x:170,y:960,rot:3,sub:'deals on the back nine',sp:'All your seizure costs are $1 cheaper.'},
{id:'whistle',image:'./static/whistelblower.png',name:['THE WHISTLEBLOWER','KNOWS TOO MUCH'],icon:'🕵️',type:'WILD',shape:'photo',income:0,cost:6,x:1980,y:640,rot:-2,sub:'half a confession ready',sp:'+1 Intel at the start of each of your turns.'},
{id:'iface',image:'./static/bloomberg terminal.png',name:['THE MARKET','INTERFACE'],icon:'🖥️',type:'WILD',income:1,cost:4,x:2060,y:1100,rot:2,sub:'computer & website screenshots',sp:'Your TERMINAL peek works wherever you end movement — everything is online.'},
/* — school & fate — */
{id:'school',image:'./static/st andrews cathedral school.png',name:['ST ANDREW’S','CATHEDRAL SCHOOL'],icon:'🏫',type:'WILD',shape:'logo',band:'#1b2a5e',income:1,cost:5,x:170,y:1080,rot:-1,sub:'the crest & the tower',sp:'+1 Intel at the start of your turn if you own 3+ CHART nodes (the research department).'},
{id:'ib',image:'./static/ibdp.png',name:['THE IB DIPLOMA','PROGRAMME'],icon:'📚',type:'WILD',income:1,cost:5,x:380,y:1050,rot:2,sub:'HL Economics, allegedly',sp:'Your CHART nodes pay DOUBLE income (Higher Level Economics).'},
{id:'mpc',image:'./static/monetary policy competition.png',name:['THE AUSTRALIAN','MONETARY POLICY','COMPETITION'],icon:'🏆',type:'WILD',shape:'mpc',income:1,cost:6,x:390,y:1200,rot:-2,sub:'the trophy of trophies',sp:'+$1 income per CHART node; +1 Intel each turn. +$2 more each turn while you also hold the SCHOOL and the IB DIPLOMA.'},
{id:'sisy',image:'./static/sisyphus.webp',name:['THE SISYPHUS','BOULDER'],icon:'🪨',type:'WILD',income:0,cost:4,x:600,y:1150,rot:2,sub:'it always rolls back down',sp:'Stand here (once owned) to PUSH: +$3 and +1 Cortisol. Repeatable. Forever.'},
{id:'group',image:'./static/the outdoors.png',name:['THE OUTDOOR','GROUP PHOTOGRAPH'],icon:'👥',type:'WILD',shape:'wide',income:1,cost:4,x:820,y:1120,rot:-1,sub:'everyone smiled',sp:'Whenever ANY player is raided, gain +1 Intel (you have photos of everyone).'},
{id:'sat',image:'./static/the outback.jpg',name:['SATELLITE IMAGE','THE OUTBACK'],icon:'🛰️',type:'WILD',shape:'sat',income:1,cost:4,x:610,y:1300,rot:1,sub:'landscape · the dry country',sp:'−1 Cortisol at the start of each of your turns (hiding out bush).'},
/* — the people (polaroids) — */
{id:'watson',image:'./static/ceo of coal.png',name:['MARK WATSON','CEO OF COAL'],icon:'🤵🏻',type:'WILD',shape:'photo',income:0,cost:6,x:330,y:590,rot:3,sub:'the face of the company',sp:'+$2/turn while you also own COAL CORP HQ. Personally deflects the CEO PHOTO LEAK.'},
{id:'bessent',image:'./static/scott bessent.png',name:['SCOTT BESSENT','“BIG BESSENT”'],icon:'👔',type:'WILD',shape:'photo',income:1,cost:7,x:1600,y:310,rot:-2,sub:'US Treasury · moves markets',sp:'+$1 income per BANK node you own.'},
{id:'chalmers',image:'./static/jim chalmers.png',name:['JIM CHALMERS','“THE JIM”'],icon:'👨‍💼',type:'WILD',shape:'photo',income:1,cost:8,x:1720,y:180,rot:2,sub:'the Treasurer',sp:'+$1 income per REGULATOR node you own (the Treasurer’s friends).'},
{id:'albo',image:'./static/albo.png',name:['ANTHONY ALBANESE','THE PM'],icon:'🫡',type:'WILD',shape:'photo',income:1,cost:8,x:1875,y:105,rot:-2,sub:'the motorcade',sp:'Tolls rivals pay to enter YOUR nodes are $2 (the PM closes the road).'},
{id:'trump',image:'./static/trump.png',name:['DONALD TRUMP','TARIFF MAN'],icon:'🦅',type:'WILD',shape:'photo',income:1,cost:7,x:2020,y:185,rot:2,sub:'the tweets move markets',sp:'Unlocks THE TWEET ($2): any rival +1 Cortisol.'},
{id:'bullock',image:'./static/michelle bullock.png',name:['MICHELE BULLOCK','RBA GOVERNOR'],icon:'👩‍💼',type:'WILD',shape:'photo',income:1,cost:7,x:880,y:265,rot:-3,sub:'she decides the cash rate',sp:'Rate events never charge you; +1 Intel each turn (the Governor briefs you).'},
{id:'bond007',image:'./static/james bond.png',name:['JAMES BOND','CITIBANK · 007'],icon:'🤵',type:'WILD',shape:'photo',income:1,cost:6,x:300,y:330,rot:-2,sub:'banker. sort of.',sp:'You pay NO tolls (he has… credentials).'},
{id:'rock',image:'./static/the rock.gif',name:['THE ROCK','CAN SMELL IT'],icon:'💪',type:'WILD',shape:'photo',income:1,cost:7,x:660,y:450,rot:2,sub:'final boss energy',sp:'Unlocks COOK THE BOOKS ($3): −3 Cortisol. +$1 income per DIFFERENT node type you own.'},
{id:'brad',image:'./static/brad pitt.png',name:['BRAD PITT','“THE BIG SHORT”'],icon:'😎',type:'WILD',shape:'photo',income:1,cost:5,x:1630,y:1120,rot:-2,sub:'explained it in the movie',sp:'+$2 whenever a BOND event runs (he had it explained to him).'},
{id:'jt',image:'./static/jt portal.png',name:['JTPORTAL','QUITE FRANKLY'],icon:'🌐',type:'WILD',shape:'photo',income:1,cost:9,x:1150,y:540,rot:-1,sub:'the legend of the board',sp:'+1 Intel each turn AND you are shown the next Market Event at the start of your turn. ONCE PER GAME: cancel a Market Event as it is revealed — “quite frankly, it never happened.”'},
{id:'made',image:'./static/made logo.png',name:['MADE','(???)'],type:'WILD',shape:'made',income:2,cost:7,x:1000,y:1380,rot:-2,sub:'the purple graphic',sp:'Start of every turn: 33% chance MADE pays out — +$10 and +1 Intel to its owner, and every other player pays $3 and gains +1 Cortisol. Hostile takeovers of MADE stay at list price forever. Nobody knows why. NOBODY.'},
{id:'asics',image:'./static/running shoe.jpg',name:['THE RUNNING SHOE','ASICS'],icon:'👟',type:'WILD',shape:'photo',income:1,cost:3,x:430,y:1360,rot:3,sub:'circled in red · why is this here',sp:'+1 movement step (you are always jogging). Stand here (once owned) to JOG: free −1 Cortisol.'},
{id:'toktimer',image:'./static/toktimer.png',name:['TOKTIMER'],icon:'⏱️',type:'WILD',shape:'photo',income:1,cost:5,x:1920,y:1020,rot:-2,sub:'the clock is running',sp:'+1 Intel whenever a Market Event is revealed. Time is information.'}
];
const NMAP={};NODES.forEach(n=>NMAP[n.id]=n);
const COUNTRY=['us','japan','uk','aus'];
const BASE_EDGES=[
 /* banks & the missing fourth */
 ['citi','commbank'],['commbank','nab'],['nab','anz'],['nab','westpac'],['westpac','commbank'],['westpac','citi'],['anz','rba'],['citi','bond007'],['citi','coal'],
 /* regulators row */
 ['rba','bullock'],['rba','asic'],['asic','accc'],['accc','gov'],['gov','chalmers'],['chalmers','albo'],['albo','trump'],['rba','bond'],['gov','herald'],
 /* the charts, now threaded through the middle of the board */
 ['tenyear','us'],['tenyear','aus'],['tenyear','stock'],['tenyear','cash'],['cash','rba'],['cash','infl'],['infl','japan'],['uk','aus'],['stock','fox'],['stock','term'],
 /* commodities & the oil corridor */
 ['oil','oilgraph'],['oil','tanker'],['oil','petronas'],['oil','barrels'],['barrels','forklift'],['oil','gold'],['gold','bhp'],['bhp','train'],['train','port'],['port','coal'],['coal','forklift'],['oil','quik'],['quik','market'],['market','coal'],['f1','market'],
 /* media & the leak */
 ['press','fox'],['press','leak'],['leak','jim'],['jim','herald'],['herald','bess'],['bess','insider'],['insider','photo'],['photo','bigshort'],['bigshort','news'],['news','wef'],['wef','term'],
 /* the people, pinned near their institutions */
 ['watson','coal'],['bessent','bess'],['chalmers','gov'],['albo','gov'],['trump','herald'],['bullock','rba'],['bond007','citi'],['rock','coal'],['brad','bigshort'],['jt','press'],
 /* school, fate, the backrooms */
 ['school','ib'],['ib','mpc'],['mpc','sisy'],['sisy','group'],['group','sat'],['sat','asics'],['asics','toktimer'],['toktimer','wef'],['back','term'],['back','golf'],['golf','whistle'],['whistle','iface'],['iface','term'],['made','group'],['made','sat']
];
const EDGES=BASE_EDGES;
const TYPE_COLORS={BANK:'#3d8fd1',REGULATOR:'#c0392b',CHART:'#e8a020',COMMODITY:'#d35400',CORPORATE:'#2e7d64',MEDIA:'#8e44ad',WILD:'#7f8c8d'};
const PCOLORS=['#f5c542','#55c1ff','#e19bff','#7fe08d','#ff5e9c','#ffffff','#00e5c0','#ffa94d'];
const MAXHUMANS=8,MAXENT=24;
const CHARURL='./characters/';
const CHARS=[
 {id:'markwatson',name:'Mark Watson',file:'markwatson.png'},
 {id:'tomkins',name:'Tomkins',file:'tomkins.png'},
 {id:'jimchalmers',name:'Jim Chalmers',file:'jimchalmers.png'},
 {id:'bessock',name:'Bessock',file:'bessock.png'},
 {id:'calvinathanasius',name:'Calvin Athanasius',file:'calvinathanasius.png'},
 {id:'denialswan',name:'Denial Swan',file:'denialswan.png'},
 {id:'japsnchen',name:'Japsn Chen',file:'japsnchen.png'},
 {id:'thousandyardwax',name:'Thousand Yard Wax',file:'thousandyardwax.png'}
];
function charMeta(id){return CHARS.find(c=>c.id===id)||null}
function charSrc(id){const c=charMeta(id);return c?CHARURL+c.file:''}
// Automatically load any new PNGs from the characters/ folder via the public GitHub API.
// Falls back to the bundled list if the API is unreachable (e.g. offline or rate-limited).
(function loadCharacters(){
 const fallback = CHARS.slice();
 fetch('https://api.github.com/repos/waxmotson/bigcon3D/contents/characters')
  .then(r=>r.ok?r.json():Promise.reject(r.status))
  .then(files=>{
   const pngs = files.filter(f=>f.name.toLowerCase().endsWith('.png'));
   if(!pngs.length)return;
   CHARS.length = 0;
   pngs.forEach(f=>{
    const base = f.name.replace(/\.png$/i,'');
    const id = base.toLowerCase().replace(/[^a-z0-9]/g,'');
    const name = base.replace(/[_-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    CHARS.push({id, name, file:f.name});
   });
   if(typeof renderCharGrid==='function')renderCharGrid();
  })
  .catch(()=>{/* keep fallback */});
})();
const MOODS={
 CALM:{label:'MARKET: CALM',color:'#8fbf7f',tint:'rgba(70,130,70,0.045)',rate:2,desc:'no modifiers · 1 🛈 = $2'},
 BOOM:{label:'MARKET: BOOM',color:'#f5c542',tint:'rgba(200,160,40,0.075)',rate:2,desc:'COMMODITIES +$1/turn · 1 🛈 = $2'},
 PANIC:{label:'MARKET: PANIC',color:'#ff6b5e',tint:'rgba(170,30,20,0.10)',rate:4,desc:'BANKS −$1/turn · 1 🛈 = $4'},
 FRENZY:{label:'MEDIA FRENZY',color:'#e19bff',tint:'rgba(150,60,170,0.075)',rate:3,desc:'MEDIA +$1/turn · 1 🛈 = $3'}
};
const CARDS=[
{id:'oilspike',icon:'🛢️',title:'OIL SPIKES — WTI +12%',text:'Crude goes vertical. The pit pays out, the tankers get rich, and everyone pays at the pump.',
 run(){setMood('BOOM','WTI +12% — crude goes vertical');[['oil',6,'crude windfall'],['oilgraph',2,'the graph called it'],['tanker',3,'tankers rechartered at panic rates'],['petronas',3,'the national oil company cashes in']].forEach(a=>payNode(a[0],a[1],a[2]));eachPlayer(p=>p.money=Math.max(0,p.money-2));log('Everyone pays $2 at the pump.')}},
{id:'goldrush',icon:'🪙',title:'GOLD RUSH',text:'The shiny stuff. Coins and the big Australian both pay out.',
 run(){setMood('BOOM','gold goes vertical');payNode('gold',5,'gold rush');payNode('bhp',3,'the big Australian')}},
{id:'coalrush',icon:'🚂',title:'COAL RUSH',text:'Tonnage by rail and by sea. The train, the docks, the barrels and BHP all get paid.',
 run(){setMood('BOOM','coal tonnage surges');[['train',3,'express tonnage'],['port',3,'the docks are full'],['barrels',2,'stacked and shipped'],['bhp',3,'pit to port']].forEach(a=>payNode(a[0],a[1],a[2]))}},
{id:'bondmageddon',icon:'📊',title:'BONDMAGEDDON',text:'The bond markets revolt. The charts pay their owners, the Bond Desk collects the tolls, and every bank takes a haircut.',
 run(){setMood('PANIC','the bond markets revolt');COUNTRY.forEach(id=>payNode(id,1,'yield spike'));payNode('tenyear',3,'the master chart');payNode('bond',4,'the desk collects the tolls');payNode('leak',2,'the leak was right');eachPlayer(p=>{if(ownsType(p.i,'BANK')){p.money=Math.max(0,p.money-3);log(p.name+' takes a $3 haircut (owns a bank).')}})}},
{id:'rbahike',icon:'🏛️',title:'RBA CASH-RATE DECISION',text:'The cash rate moves. The chart pays out. Anyone holding a bank or a regulator takes a point of Cortisol — unless the Governor is on their side.',
 run(){setMood('PANIC','the cash rate moves');payNode('cash',2,'you set the rate');eachPlayer(p=>{if(owns(p.i,'bullock')){log(p.name+' is briefed by the Governor — no Cortisol.');return}if(ownsType(p.i,'BANK')||ownsType(p.i,'REGULATOR'))addCort(p.i,1,'the rate decision')})}},
{id:'crackdown',icon:'🚔',title:'REGULATOR CRACKDOWN',text:'ASIC and the ACCC come knocking. Every player with 4 or more exhibits takes a point of Cortisol.',
 run(){setMood('PANIC','the regulators come knocking');eachPlayer(p=>{if(ownedBy(p.i).length>=4)addCort(p.i,1,'regulator crackdown')})}},
{id:'ceoleak',icon:'📸',title:'CEO PHOTO LEAKS',text:'A photo of the CEO surfaces. Coal Corp HQ pays out — unless the Press Room or Fox spins it, or Mark Watson personally deflects it.',
 run(){const owner=S.owner.coal;if(owner==null){log('The photo leaks. Nobody owns Coal Corp HQ — no one cares.');return}const p=S.players[owner];if(owns(owner,'press')||owns(owner,'fox')||owns(owner,'watson')){pay(owner,4,'the photo is spun');log(p.name+' owns the narrative — the leak is buried.');return}addCort(owner,2,'CEO photo leak');log(p.name+' is in the photo. +2 Cortisol.')}},
{id:'profitwarn',icon:'⚠️',title:'PROFIT WARNING',text:'Quikstop issues a warning. The storefront pays out. Every other corporate takes a point of Cortisol.',
 run(){payNode('quik',4,'profit warning');eachPlayer(p=>{if(ownsType(p.i,'CORPORATE')&&!owns(p.i,'quik'))addCort(p.i,1,'profit warning')})}},
{id:'insider',icon:'⚠️',title:'INSIDER TRADING GRAPHIC',text:'The graphic is circled in red. Every player with 3 or more Intel takes a point of Cortisol.',
 run(){eachPlayer(p=>{if(p.intel>=3)addCort(p.i,1,'insider trading graphic')})}},
{id:'budget',icon:'🏛️',title:'BUDGET NIGHT',text:'The Treasurer speaks. Every player with a regulator pays $1 to the Treasury and gains a point of Cortisol.',
 run(){eachPlayer(p=>{if(ownsType(p.i,'REGULATOR')){p.money=Math.max(0,p.money-1);addCort(p.i,1,'budget night');log(p.name+' pays $1 to the Treasury.')}})}},
{id:'tariffs',icon:'🦅',title:'TRUMP TWEETS TARIFFS',text:'The tweets move markets. US yields pay out. Every player with a bank takes a point of Cortisol.',
 run(){setMood('PANIC','tariffs tweeted');payNode('us',2,'tariff spike');eachPlayer(p=>{if(ownsType(p.i,'BANK'))addCort(p.i,1,'tariff tweet')})}},
{id:'mediafrenzy',icon:'📰',title:'MEDIA FRENZY',text:'The news cycle spins up. Media nodes pay double this turn.',
 run(){setMood('FRENZY','the news cycle spins up');eachPlayer(p=>{const n=ownedBy(p.i).filter(id=>NMAP[id].type==='MEDIA').length;if(n)pay(p.i,n*2,'media frenzy')})}},
{id:'quiet',icon:'😌',title:'A QUIET DAY',text:'Nothing happens. The market is calm. Cortisol ticks down.',
 run(){setMood('CALM','a quiet day');eachPlayer(p=>{if(p.cort>0){p.cort--;log(p.name+' loses a point of Cortisol.')}})}},
{id:'boom',icon:'📈',title:'COMMODITIES BOOM',text:'Everything that comes out of the ground pays an extra $1 this turn.',
 run(){setMood('BOOM','commodities boom');eachPlayer(p=>{const n=ownedBy(p.i).filter(id=>NMAP[id].type==='COMMODITY').length;if(n)pay(p.i,n,'commodities boom')})}},
{id:'panic',icon:'📉',title:'MARKET PANIC',text:'The banks take a haircut. Every bank pays $1 less this turn.',
 run(){setMood('PANIC','market panic');eachPlayer(p=>{const n=ownedBy(p.i).filter(id=>NMAP[id].type==='BANK').length;if(n){p.money=Math.max(0,p.money-n);log(p.name+' takes a $'+n+' haircut.')}})}},
{id:'intel',icon:'🔍',title:'INTEL DROP',text:'Someone talked. Every player gains a point of Intel.',
 run(){eachPlayer(p=>{p.intel++;log(p.name+' gains 1 Intel.')})}},
{id:'cort',icon:'😰',title:'CORTISOL SPIKE',text:'The stress is getting to everyone. Every player gains a point of Cortisol.',
 run(){eachPlayer(p=>addCort(p.i,1,'cortisol spike'))}},
{id:'salary',icon:'💰',title:'PAYDAY',text:'Everyone gets paid. $3 each, plus whatever the market is doing.',
 run(){eachPlayer(p=>pay(p.i,3,'payday'))}},
{id:'raid',icon:'🚔',title:'REGULATOR RAID',text:'The regulators raid the player with the highest Cortisol. Two of their best exhibits are seized, they are fined 30% of their cash, and they are cuffed for 7 seconds.',
 run(){const target=S.players.filter(p=>p.alive&&p.cort>=4).sort((a,b)=>b.cort-a.cort)[0];if(!target){log('The regulators look around. Nobody is stressed enough to raid.');return}raid(target.i)}},
{id:'made',icon:'🟣',title:'MADE PAYS OUT',text:'The purple graphic does its thing. Nobody knows why.',
 run(){const owner=S.owner.made;if(owner==null){log('🟣 MADE remains unexplained. Again.');return}const p=S.players[owner];pay(owner,10,'MADE pays out');p.intel++;eachPlayer(q=>{if(q.i!==owner){q.money=Math.max(0,q.money-3);addCort(q.i,1,'MADE');}});log('🟣 MADE pays out to '+p.name+'. Everyone else pays $3 and gains a point of Cortisol. Nobody knows why.')}},
{id:'whistle',icon:'🕵️',title:'THE WHISTLEBLOWER',text:'Half a confession. Every player gains a point of Intel.',
 run(){eachPlayer(p=>{p.intel++;log(p.name+' gains 1 Intel from the whistleblower.')})}},
{id:'golf',icon:'⛳',title:'THE GOLF CLUB',text:'Deals on the back nine. The owner of the Golf Club collects $1 from every other player.',
 run(){const owner=S.owner.golf;if(owner==null)return;eachPlayer(p=>{if(p.i!==owner){p.money=Math.max(0,p.money-1);pay(owner,1,'golf club toll')}})}},
{id:'sisy',icon:'🪨',title:'THE SISYPHUS BOULDER',text:'It rolls back down. The owner can push it again for +$3 and +1 Cortisol.',
 run(){const owner=S.owner.sisy;if(owner==null)return;log(S.players[owner].name+' can push the boulder again.')}},
{id:'asics',icon:'👟',title:'THE RUNNING SHOE',text:'You are always jogging. The owner gets a free −1 Cortisol.',
 run(){const owner=S.owner.asics;if(owner==null)return;const p=S.players[owner];if(p.cort>0){p.cort--;log(p.name+' jogs off a point of Cortisol.')}}},
{id:'toktimer',icon:'⏱️',title:'TOKTIMER',text:'The clock is running. Time is information. Every player gains a point of Intel.',
 run(){eachPlayer(p=>{p.intel++;log(p.name+' gains 1 Intel from the clock.')})}}
];
const CARDBYID={};CARDS.forEach(c=>CARDBYID[c.id]=c);
const BUZZWORDS=['WORLD ECONOMIC FORUM','NESA','JAKE TOMKINS','ELIJAH SON','SETH WEGRZYN','AIDAN NEWLING','DANIEL SWAIN','TOKTIMER','RBA','BIG BESSENT','NEW LAKEMBA','JTPORTAL','MCMETRO','CEO OF COAL','INKDIN','HORMUZ','PYONGYANG UNIVERSITY','LOW CORTISOL'];
