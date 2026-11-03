/* GameArena 0.5 — Knife Rush: niveles infinitos, patrones de giro, jefes y nuevo diseño. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const canvas = $('knife-canvas'); if (!canvas) return;
const ctx = canvas.getContext('2d');
const W=420,H=510,CX=210,CY=200,R=85,TAU=Math.PI*2;
const DPR=Math.min(window.devicePixelRatio||1,2);
canvas.width=W*DPR;canvas.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);

const IMPACT_Y=CY+R+12;   // La punta entra 10 px en la rueda.
const START_Y=458;        // Cuchillo listo para lanzar.
// Separación mínima entre cuchillos clavados, medida sobre la forma real del cuchillo
// (se tocan por debajo de 0,135 rad). Se pierde solo cuando se tocan de verdad.
const MIN_GAP=0.15;
const APPLE_HIT=0.13, OBSTACLE_GAP=0.42, CRASH_FRAMES=48, CLEAR_FRAMES=58, MAX_SPIN=0.11;
const PATTERNS=['steady','wave','reverse','stopgo','burst','chaos'];
const PATTERN_NAMES={steady:'Giro constante',wave:'Oleaje',reverse:'Reversa',stopgo:'Frenazo',burst:'Turbo',chaos:'Caos'};
const TIER_COLORS=['#8b5cf6','#4f8cff','#c05cff','#38c6ff','#ff5ca8','#6be0b0'];

// ---------- Utilidades ----------
const normalize=a=>Math.atan2(Math.sin(a),Math.cos(a));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Generador aleatorio con semilla: cada nivel es igual para todos los jugadores (ranking justo).
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function readNum(k){try{return Number(localStorage.getItem(k)||0);}catch{return 0;}}
function writeNum(k,v){try{localStorage.setItem(k,String(v));}catch{}}

// ---------- Estado ----------
let state='ready', level=1, score=0, best=readNum('ga_knife_best'), bestLevel=readNum('ga_knife_best_level'),
    cfg=null, remaining=0, total=0, blades=[], apples=[], angle=0, frame=0, flight=null, crash=null,
    clearT=0, debris=[], particles=[], popups=[], banner=null, shake=0, bump=0, last=0, stars=[];

const gameActive=()=> $('page-knife')?.classList.contains('active');
const update=()=>{$('knife-level').textContent=level;$('knife-score').textContent=score;$('knife-best').textContent=best;
 $('knife-mode').textContent=window.GameArena?.user?'PARTIDA ONLINE':'PARTIDA LOCAL';};
function storeBest(){if(score>best){best=score;writeNum('ga_knife_best',best);}if(level>bestLevel){bestLevel=level;writeNum('ga_knife_best_level',bestLevel);}}

// ---------- Niveles infinitos ----------
// Cada nivel se genera a partir de su número. La dificultad sube sin límite, pero la
// velocidad tiene techo para que siempre sea humanamente posible: a partir de ahí
// lo que crece son los obstáculos, los cuchillos y lo impredecible del giro.
function levelConfig(lv){
 const r=rng(lv*7919+13), boss=lv%5===0, tier=Math.floor((lv-1)/5);
 const unlocked=PATTERNS.slice(0,Math.min(PATTERNS.length,1+Math.floor((lv-1)/2)));
 let pattern;
 if(lv<=2)pattern='steady';
 else if(boss)pattern=lv>=10?'chaos':unlocked[unlocked.length-1];
 else if(lv<=12&&lv%2===1)pattern=unlocked[unlocked.length-1]; // estrena el patrón nuevo
 else pattern=unlocked[Math.floor(r()*unlocked.length)];
 return {lv,boss,tier,pattern,r,
  knives:Math.min(5+Math.floor(lv*0.4),12)+(boss?2:0),
  obstacles:lv<2?0:Math.min(1+Math.floor(lv/3),7)+(boss?1:0),
  apples:lv<2?0:(r()<0.65?1:0)+(lv>=8&&r()<0.45?1:0),
  speed:0.022+0.034*(1-Math.exp(-lv/12)),
  dir:r()<0.5?1:-1,
  period:Math.max(48,140-lv*2.5)};
}
function spin(c,t){
 const s=c.speed*c.dir;let v;
 switch(c.pattern){
  case 'wave':v=s*(1+0.65*Math.sin(t/38));break;
  // Reversa asimétrica: avanza más de lo que retrocede, así la rueda recorre toda la vuelta
  // y siempre quedan huecos alcanzables.
  case 'reverse':v=s*1.15*((t%(c.period*1.6))<c.period?1:-0.85);break;
  case 'stopgo':v=s*((t%110)<70?1.6:0.12);break;
  case 'burst':v=s*(0.7+2.2*Math.pow(Math.max(0,Math.sin(t/30)),6));break;
  case 'chaos':v=s*((t%(c.period*1.6))<c.period?1:-0.85)*(1+0.6*Math.sin(t/23)+0.35*Math.sin(t/7.3));break;
  default:v=s;
 }
 return clamp(v,-MAX_SPIN,MAX_SPIN);
}
function startLevel(lv){
 level=lv;cfg=levelConfig(lv);angle=0;frame=0;flight=null;crash=null;debris=[];
 remaining=total=cfg.knives;blades=[];apples=[];
 const impact=Math.PI/2; // con angle=0, el impacto cae en el ángulo local PI/2
 let tries=0;
 while(blades.length<cfg.obstacles&&tries++<800){const a=normalize(cfg.r()*TAU);
  if(Math.abs(normalize(a-impact))<0.6||blades.some(b=>Math.abs(normalize(b.a-a))<OBSTACLE_GAP))continue;
  blades.push({a,fixed:true});}
 tries=0;
 while(apples.length<cfg.apples&&tries++<800){const a=normalize(cfg.r()*TAU);
  if(Math.abs(normalize(a-impact))<0.5||blades.some(b=>Math.abs(normalize(b.a-a))<0.3)||apples.some(p=>Math.abs(normalize(p.a-a))<0.6))continue;
  apples.push({a});}
 banner={title:cfg.boss?`⚔ JEFE · NIVEL ${lv}`:`NIVEL ${lv}`,sub:PATTERN_NAMES[cfg.pattern]+(cfg.obstacles?` · ${cfg.obstacles} obstáculo${cfg.obstacles>1?'s':''}`:''),t:0,boss:cfg.boss};
 state='playing';storeBest();update();
}

// ---------- Flujo de partida ----------
function overlay(title,msg,button){$('knife-title').textContent=title;$('knife-message').textContent=msg;$('knife-start').textContent=button;$('knife-overlay').hidden=false;$('knife-overlay').style.display='flex';}
function hideOverlay(){$('knife-overlay').hidden=true;$('knife-overlay').style.display='none';}
function begin(){score=0;particles=[];popups=[];hideOverlay();startLevel(1);}
function launch(){if(!gameActive()||state!=='playing'||flight)return;flight={y:START_Y};}

function hit(){
 state='crash';shake=14;
 crash={x:CX,y:IMPACT_Y,vx:(Math.random()<.5?-1:1)*(2.5+Math.random()*1.5),vy:-6,rot:0,vr:(Math.random()<.5?-1:1)*.25,t:0};
 flight=null;burst(CX,IMPACT_Y-8,14,['#ff5c7a','#ffd0d8','#ffffff'],4);
 try{navigator.vibrate?.(140);}catch{}
}
function gameOver(){
 state='over';crash=null;storeBest();update();
 const record=score>0&&score>=best?' ¡Nuevo récord!':'';
 const base=`Llegaste al nivel ${level} con ${score} puntos.${record} Tu mejor nivel: ${bestLevel}.`;
 overlay('¡Fin de partida!',base,'Volver a jugar →');
 save().then(status=>{
  if(state!=='over')return;
  const extra=status==='guardada'?' Puntuación guardada en el ranking ✓'
   :status==='invitado'?' Inicia sesión para competir en el ranking.'
   :status==='error'?' No se pudo guardar la puntuación online.':'';
  $('knife-message').textContent=base+extra;
 });
}
async function save(){
 let status='';
 try{status=await window.GameArena?.saveScore?.('knife',score)||'';}catch(e){console.warn('Puntuación no enviada:',e);status='error';}
 refreshRanking();return status;
}
function levelClear(){
 state='clear';clearT=0;
 const bonus=15*level+(cfg.boss?100:0);score+=bonus;storeBest();update();
 popups.push({x:CX,y:CY-10,text:cfg.boss?`¡JEFE DERROTADO! +${bonus}`:`¡NIVEL SUPERADO! +${bonus}`,t:0,color:cfg.boss?'#ffd36b':'#b9a2ff',big:true});
 // Los cuchillos salen volando y la rueda estalla en astillas.
 for(const b of blades){const w=b.a+angle,d=R+12;
  debris.push({x:CX+Math.cos(w)*d,y:CY+Math.sin(w)*d,rot:w-Math.PI/2,vx:Math.cos(w)*(3+Math.random()*3),vy:Math.sin(w)*(3+Math.random()*3)-2,vr:(Math.random()-.5)*.4,fixed:b.fixed});}
 blades=[];apples=[];
 burst(CX,CY,34,cfg.boss?['#ffd36b','#ff9f43','#ffffff']:['#c99560','#8b5a33','#f0d2a8'],7);
 shake=6;try{navigator.vibrate?.([30,40,30]);}catch{}
}

// ---------- Impacto ----------
function attach(){
 // El lanzamiento llega desde ABAJO (ángulo +PI/2 en pantalla); se guarda el ángulo LOCAL.
 const a=normalize(Math.PI/2-angle);
 if(blades.some(b=>Math.abs(normalize(b.a-a))<MIN_GAP)){hit();return;}
 const ai=apples.findIndex(p=>Math.abs(normalize(p.a-a))<APPLE_HIT);
 if(ai>=0){apples.splice(ai,1);score+=25;burst(CX,CY+R+14,16,['#ff4d5e','#ffd166','#7ee081'],4.5);
  popups.push({x:CX+34,y:CY+R+6,text:'+25 🍎',t:0,color:'#ff8a8a'});}
 blades.push({a,fixed:false});score+=10;remaining--;flight=null;bump=5;
 burst(CX,CY+R,7,['#c99560','#f0d2a8','#8b5a33'],3);
 storeBest();update();
 if(remaining===0)levelClear();
}

// ---------- Partículas ----------
function burst(x,y,n,colors,force){for(let i=0;i<n;i++){const t=Math.random()*TAU,v=force*(.4+Math.random());
 particles.push({x,y,vx:Math.cos(t)*v,vy:Math.sin(t)*v-1,life:0,max:30+Math.random()*25,color:colors[i%colors.length],size:2+Math.random()*3});}}

// ---------- Texturas ----------
function makeTex(boss){
 const c=document.createElement('canvas');const s=Math.ceil(R*2*DPR);c.width=c.height=s;
 const g=c.getContext('2d');g.scale(s/(R*2),s/(R*2));g.translate(R,R);const r=rng(boss?99:42);
 g.beginPath();g.arc(0,0,R,0,TAU);g.clip();
 if(!boss){
  const rg=g.createRadialGradient(-22,-26,8,0,0,R);rg.addColorStop(0,'#d7a46b');rg.addColorStop(.65,'#a46d3d');rg.addColorStop(1,'#6b3f21');
  g.fillStyle=rg;g.fillRect(-R,-R,R*2,R*2);
  for(let i=0;i<10;i++){g.strokeStyle=`rgba(75,40,18,${.18+r()*.22})`;g.lineWidth=.8+r()*2.2;g.beginPath();g.arc((r()-.5)*5,(r()-.5)*5,8+i*8+r()*3,0,TAU);g.stroke();}
  for(let i=0;i<18;i++){const t=r()*TAU,l=25+r()*55;g.strokeStyle='rgba(55,28,10,.16)';g.lineWidth=1;g.beginPath();g.moveTo(Math.cos(t)*14,Math.sin(t)*14);g.lineTo(Math.cos(t+.04)*l,Math.sin(t+.04)*l);g.stroke();}
  g.strokeStyle='#4a2a14';g.lineWidth=5;g.beginPath();g.arc(0,0,R-2.5,0,TAU);g.stroke();
  g.strokeStyle='rgba(255,220,170,.25)';g.lineWidth=1.5;g.beginPath();g.arc(0,0,R-6,Math.PI*1.05,Math.PI*1.6);g.stroke();
  for(let i=0;i<12;i++){const t=i*TAU/12;g.fillStyle='#f0c78d';g.beginPath();g.arc(Math.cos(t)*72,Math.sin(t)*72,2.4,0,TAU);g.fill();}
 }else{
  const rg=g.createRadialGradient(-20,-24,6,0,0,R);rg.addColorStop(0,'#5b4a9a');rg.addColorStop(.6,'#2c2260');rg.addColorStop(1,'#140f30');
  g.fillStyle=rg;g.fillRect(-R,-R,R*2,R*2);
  for(let i=0;i<8;i++){g.fillStyle=i%2?'rgba(255,255,255,.05)':'rgba(0,0,0,.18)';g.beginPath();g.moveTo(0,0);g.arc(0,0,R,i*TAU/8,(i+1)*TAU/8);g.closePath();g.fill();}
  g.shadowColor='#c38bff';g.shadowBlur=10;g.strokeStyle='#c38bff';g.lineWidth=2.5;
  for(const rr of [34,62]){g.beginPath();g.arc(0,0,rr,0,TAU);g.stroke();}
  g.shadowBlur=0;g.strokeStyle='#0b0820';g.lineWidth=5;g.beginPath();g.arc(0,0,R-2.5,0,TAU);g.stroke();
  for(let i=0;i<16;i++){const t=i*TAU/16;g.fillStyle='#d9c8ff';g.beginPath();g.arc(Math.cos(t)*76,Math.sin(t)*76,2.2,0,TAU);g.fill();}
 }
 return c;
}
const woodTex=makeTex(false), bossTex=makeTex(true);
{const r=rng(7);for(let i=0;i<60;i++)stars.push({x:r()*W,y:r()*H,s:r()*1.4+.3,p:r()*TAU});}

// ---------- Dibujo ----------
function drawKnife(x,y,rotation=0,fixed=false,alpha=1,scale=1){
 ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(scale,scale);ctx.globalAlpha=alpha;
 const bl=ctx.createLinearGradient(-6,0,6,0);
 if(fixed){bl.addColorStop(0,'#5d6478');bl.addColorStop(.5,'#9aa3b8');bl.addColorStop(1,'#4c5266');}
 else{bl.addColorStop(0,'#9fb2c9');bl.addColorStop(.45,'#f4f9ff');bl.addColorStop(1,'#8295ad');}
 ctx.fillStyle=bl;ctx.beginPath();ctx.moveTo(0,-22);ctx.lineTo(-6,-7);ctx.lineTo(-5,11);ctx.lineTo(5,11);ctx.lineTo(6,-7);ctx.closePath();ctx.fill();
 ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-19);ctx.lineTo(0,9);ctx.stroke();
 ctx.fillStyle=fixed?'#3d3358':'#2b2350';ctx.fillRect(-7,9,14,4);
 const hd=ctx.createLinearGradient(-5,0,5,0);
 if(fixed){hd.addColorStop(0,'#4a3c6b');hd.addColorStop(.5,'#6d5a8f');hd.addColorStop(1,'#3a2e57');}
 else{hd.addColorStop(0,'#6f3cf0');hd.addColorStop(.5,'#a77bff');hd.addColorStop(1,'#5a2fd0');}
 ctx.fillStyle=hd;ctx.beginPath();ctx.roundRect(-5,13,10,18,3);ctx.fill();
 ctx.fillStyle='rgba(255,255,255,.18)';for(let i=0;i<3;i++)ctx.fillRect(-5,16+i*5,10,1.5);
 ctx.fillStyle=fixed?'#4f3f6e':'#4fd1ff';ctx.beginPath();ctx.roundRect(-6,29,12,5,2.5);ctx.fill();
 ctx.restore();
}
function drawApple(x,y){
 ctx.save();ctx.translate(x,y);ctx.shadowColor='#ff4d5e';ctx.shadowBlur=10;
 const g=ctx.createRadialGradient(-3,-3,1,0,0,10);g.addColorStop(0,'#ff8a8a');g.addColorStop(1,'#d61f3c');
 ctx.fillStyle=g;ctx.beginPath();ctx.arc(-3,0,7,0,TAU);ctx.arc(3,0,7,0,TAU);ctx.fill();ctx.shadowBlur=0;
 ctx.strokeStyle='#5a3a1a';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(1,-10);ctx.stroke();
 ctx.fillStyle='#5fd17a';ctx.beginPath();ctx.ellipse(4,-9,4,2,-.5,0,TAU);ctx.fill();ctx.restore();
}
function render(){
 ctx.save();
 if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
 // Fondo
 const glow=TIER_COLORS[(cfg?.tier||0)%TIER_COLORS.length];
 const bg=ctx.createRadialGradient(CX,CY,30,CX,CY,330);bg.addColorStop(0,cfg?.boss?'#2d1846':'#1d2350');bg.addColorStop(1,'#070b1c');
 ctx.fillStyle=bg;ctx.fillRect(-20,-20,W+40,H+40);
 for(const s of stars){ctx.globalAlpha=.25+.35*Math.sin(frame/40+s.p)**2;ctx.fillStyle='#cfd8ff';ctx.fillRect(s.x,s.y,s.s,s.s);}ctx.globalAlpha=1;
 // Halo
 const halo=ctx.createRadialGradient(CX,CY,R,CX,CY,R+70);halo.addColorStop(0,glow+'55');halo.addColorStop(1,glow+'00');
 ctx.fillStyle=halo;ctx.beginPath();ctx.arc(CX,CY,R+70,0,TAU);ctx.fill();

 const flash=crash?Math.max(0,1-crash.t/CRASH_FRAMES):0;
 const clearing=state==='clear'?clearT/CLEAR_FRAMES:0;
 const wy=CY+bump;
 if(state!=='clear'||clearing<.25){
  const sc=state==='clear'?1+clearing*1.6:1;
  ctx.save();ctx.translate(CX,wy);ctx.scale(sc,sc);ctx.globalAlpha=state==='clear'?1-clearing*4:1;
  ctx.save();ctx.rotate(angle);
  for(const b of blades){ctx.save();ctx.rotate(b.a-Math.PI/2);drawKnife(0,R+12,0,b.fixed);ctx.restore();} // la hoja queda bajo la madera
  ctx.restore();
  ctx.shadowColor=flash?'#ff4d6d':glow;ctx.shadowBlur=24+flash*24;ctx.fillStyle=flash?'#7a2a45':'#140f2e';
  ctx.beginPath();ctx.arc(0,0,R+5,0,TAU);ctx.fill();ctx.shadowBlur=0;
  ctx.save();ctx.rotate(angle);ctx.drawImage(cfg?.boss?bossTex:woodTex,-R,-R,R*2,R*2);
  for(const p of apples)drawApple(Math.cos(p.a)*(R+14),Math.sin(p.a)*(R+14));
  ctx.restore();
  ctx.strokeStyle=flash?'#ff6b86':glow;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,R+5,0,TAU);ctx.stroke();
  // Centro con el contador
  const hub=ctx.createRadialGradient(-5,-6,2,0,0,24);hub.addColorStop(0,'#3a3470');hub.addColorStop(1,'#120e2a');
  ctx.fillStyle=hub;ctx.beginPath();ctx.arc(0,0,24,0,TAU);ctx.fill();ctx.strokeStyle=glow;ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 20px system-ui';ctx.fillText(String(remaining),0,1);
  ctx.restore();
 }
 // Cuchillos que salen volando al superar un nivel
 for(const d of debris)drawKnife(d.x,d.y,d.rot,d.fixed,clamp(1-clearT/CLEAR_FRAMES,0,1));
 // Cuchillo en vuelo / listo / rebotando
 if(crash)drawKnife(crash.x,crash.y,crash.rot);
 else if(flight){for(let i=1;i<=3;i++)drawKnife(CX,flight.y+i*14,0,false,.14/i);drawKnife(CX,flight.y);}
 else if(state==='playing')drawKnife(CX,START_Y+Math.sin(frame/12)*1.5);
 // Partículas
 for(const p of particles){ctx.globalAlpha=1-p.life/p.max;ctx.fillStyle=p.color;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);}ctx.globalAlpha=1;
 if(flash){ctx.fillStyle=`rgba(255,60,90,${flash*.2})`;ctx.fillRect(-20,-20,W+40,H+40);}
 ctx.restore();
 drawHud();
}
function drawHud(){
 ctx.textBaseline='alphabetic';
 if(cfg){
  ctx.textAlign='left';ctx.fillStyle='#ffffff';ctx.font='800 16px system-ui';ctx.fillText(cfg.boss?`JEFE · NIVEL ${level}`:`NIVEL ${level}`,18,30);
  ctx.fillStyle='#a9a6d6';ctx.font='600 11px system-ui';ctx.fillText(PATTERN_NAMES[cfg.pattern].toUpperCase(),18,46);
  // Progreso de la etapa: 4 niveles + jefe
  const first=cfg.tier*5+1;
  for(let i=0;i<5;i++){const lv=first+i,x=W-104+i*20,y=32,done=lv<level||(lv===level&&state==='clear'),cur=lv===level;
   ctx.beginPath();if(i===4){ctx.moveTo(x,y-8);ctx.lineTo(x+8,y);ctx.lineTo(x,y+8);ctx.lineTo(x-8,y);ctx.closePath();}else ctx.arc(x,y,5.5,0,TAU);
   ctx.fillStyle=done?(i===4?'#ffd36b':'#8b5cf6'):cur?'#ffffff':'#2a2f55';ctx.fill();
   if(cur&&!done){ctx.strokeStyle='#b99fff';ctx.lineWidth=2;ctx.globalAlpha=.5+.5*Math.sin(frame/10)**2;ctx.stroke();ctx.globalAlpha=1;}}
  // Cuchillos de la ronda (los usados se apagan)
  for(let i=0;i<total;i++)drawKnife(24,H-26-i*24,0,false,i<remaining?.95:.18,.4);
 }
 if(banner&&banner.t<110){const a=clamp(banner.t<15?banner.t/15:1-(banner.t-80)/30,0,1);
  ctx.globalAlpha=a;ctx.textAlign='center';ctx.font='900 28px system-ui';ctx.fillStyle=banner.boss?'#ffd36b':'#ffffff';
  ctx.shadowColor=banner.boss?'#ff9f43':'#8b5cf6';ctx.shadowBlur=18;ctx.fillText(banner.title,CX,372);ctx.shadowBlur=0;
  ctx.font='600 12px system-ui';ctx.fillStyle='#cbc3f0';ctx.fillText(banner.sub.toUpperCase(),CX,394);ctx.globalAlpha=1;}
 for(const p of popups){const a=clamp(1-p.t/70,0,1);ctx.globalAlpha=a;ctx.textAlign='center';ctx.font=p.big?'900 20px system-ui':'800 15px system-ui';
  ctx.fillStyle=p.color;ctx.fillText(p.text,p.x,p.y-p.t*.6);}ctx.globalAlpha=1;
}

// ---------- Bucle ----------
function step(dt){
 if(state==='playing'){frame+=dt;angle+=spin(cfg,frame)*dt;
  if(flight){flight.y-=24*dt;if(flight.y<=IMPACT_Y){flight.y=IMPACT_Y;attach();}}}
 else if(state==='crash'){frame+=dt;crash.t+=dt;crash.vy+=.55*dt;crash.x+=crash.vx*dt;crash.y+=crash.vy*dt;crash.rot+=crash.vr*dt;if(crash.t>=CRASH_FRAMES)gameOver();}
 else if(state==='clear'){frame+=dt;clearT+=dt;for(const d of debris){d.vy+=.35*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.rot+=d.vr*dt;}if(clearT>=CLEAR_FRAMES)startLevel(level+1);}
 else frame+=dt;
 if(banner)banner.t+=dt;
 for(const p of particles){p.life+=dt;p.vy+=.18*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}particles=particles.filter(p=>p.life<p.max);
 for(const p of popups)p.t+=dt;popups=popups.filter(p=>p.t<70);
 shake=Math.max(0,shake-.8*dt);bump=Math.max(0,bump-.6*dt);
}
function tick(t){requestAnimationFrame(tick);if(!gameActive()){last=t;return;}const dt=Math.min((t-last)/16.67||1,2);last=t;step(dt);render();}

// ---------- Ranking ----------
async function refreshRanking(){const root=$('knife-ranking');if(!root)return;const GA=window.GameArena;
 if(!GA?.cloudReady){root.textContent='Ranking disponible al conectar Supabase.';return;}
 const {data,error}=await GA.db.from('leaderboard').select('username,best_score,user_id').eq('game','knife').order('best_score',{ascending:false}).limit(10);
 if(error){root.textContent='No se pudo cargar el ranking.';return;}
 if(!data?.length){root.textContent='Todavía no hay récords. ¡Sé el primero!';return;}
 root.replaceChildren();data.forEach((r,i)=>{const row=document.createElement('div');row.className='rank-row'+(GA.user&&r.user_id===GA.user.id?' me':'');const num=document.createElement('span');num.textContent=`#${i+1}`;const name=document.createElement('span');name.textContent=r.username;const pts=document.createElement('strong');pts.textContent=`${r.best_score} pts`;row.append(num,name,pts);root.append(row);});}
function setBest(n){n=Number(n)||0;if(n>best){best=n;writeNum('ga_knife_best',best);}update();}

// ---------- Controles ----------
$('knife-start').addEventListener('click',begin);
$('knife-restart').addEventListener('click',begin);
$('knife-throw').addEventListener('click',launch);
canvas.addEventListener('pointerdown',e=>{e.preventDefault();launch();});
document.addEventListener('keydown',e=>{if(!gameActive()||e.code!=='Space'||e.repeat)return;const el=document.activeElement;if(el?.matches('input,textarea,select,[contenteditable="true"]'))return;
 if(state!=='playing'&&el?.matches('button'))return;e.preventDefault();
 if(state==='playing')launch();else if(state==='ready'||state==='over')begin();});

window.KnifeRush={onOpen(){update();refreshRanking();if(state==='ready')overlay('Knife Rush','Clava todos los cuchillos sin tocar los demás. Niveles infinitos, un jefe cada 5 niveles. Toca la pantalla o pulsa Espacio.','Comenzar partida →');},refreshRanking,setBest,syncMode:update};
cfg=levelConfig(1);remaining=total=cfg.knives;update();render();requestAnimationFrame(tick);
})();
