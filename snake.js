/* GameArena 0.5 — Snake Rush: movimiento fluido, niveles, muros y orbes dorados. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const canvas=$("snake-canvas");if(!canvas)return;
const ctx=canvas.getContext("2d"),SIZE=400,CELL=20,COUNT=SIZE/CELL,TAU=Math.PI*2;
const DPR=Math.min(window.devicePixelRatio||1,2);canvas.width=SIZE*DPR;canvas.height=SIZE*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);
const scoreEl=$("snake-score"),bestEl=$("snake-best"),levelEl=$("snake-level"),stateEl=$("snake-state");
const overlay=$("snake-overlay"),overlayTitle=$("overlay-title"),overlayText=$("overlay-text");
const startBtn=$("snake-start"),pauseBtn=$("snake-pause"),restartBtn=$("snake-restart");
const LEVEL_COLORS=["#8b5cf6","#4f8cff","#c05cff","#38c6ff","#ff5ca8","#6be0b0"];
const FOOD_PER_LEVEL=5,MAX_WALLS=30;
const dirs={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};

let snake,prev,food,gold,walls,direction,queue,score,best,games,status="ready",level,eaten,interval,acc=0,lastT=0,
    particles=[],popups=[],banner=null,deathT=0,shake=0,frame=0;
try{best=Number(localStorage.getItem("ga_snake_best")||0);games=Number(localStorage.getItem("ga_snake_games")||0);}catch{best=0;games=0;}

const setState=t=>{if(stateEl)stateEl.textContent=t;};
const hud=()=>{scoreEl.textContent=score;bestEl.textContent=best;if(levelEl)levelEl.textContent=level;};
const speedFor=lv=>Math.max(58,130-(lv-1)*8);   // ms por paso: más rápido en cada nivel
const pageActive=()=>$("page-snake")?.classList.contains("active");
const same=(a,b)=>a.x===b.x&&a.y===b.y;
const occupied=c=>snake.some(p=>same(p,c))||walls.some(w=>same(w,c))||(food&&same(food,c))||(gold&&same(gold,c));

function reset(){
 snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];prev=snake.map(p=>({...p}));
 direction=dirs.right;queue=[];score=0;level=1;eaten=0;walls=[];gold=null;food=null;
 interval=speedFor(1);acc=0;particles=[];popups=[];banner=null;deathT=0;
 food=freeCell();hud();setState("Listo");
}
// Celda libre; con "safe" se aleja de la cabeza y de su trayectoria inmediata.
function freeCell(safe=false){
 for(let i=0;i<600;i++){
  const c={x:Math.floor(Math.random()*COUNT),y:Math.floor(Math.random()*COUNT)};
  if(occupied(c))continue;
  if(safe){const h=snake[0];if(Math.abs(h.x-c.x)+Math.abs(h.y-c.y)<5)continue;
   let ahead=false;for(let k=1;k<=6;k++)if(h.x+direction.x*k===c.x&&h.y+direction.y*k===c.y)ahead=true;if(ahead)continue;}
  return c;}
 return null;
}
function addWalls(n){
 // Muros cortos (2–3 bloques). Aparecen parpadeando y no hacen daño durante 12 pasos.
 for(let s=0;s<n&&walls.length<MAX_WALLS;s++){
  for(let t=0;t<60;t++){const st=freeCell(true);if(!st)break;const hor=Math.random()<.5,len=2+Math.floor(Math.random()*2),cells=[];
   for(let k=0;k<len;k++)cells.push({x:st.x+(hor?k:0),y:st.y+(hor?0:k)});
   if(cells.every(c=>c.x>=0&&c.x<COUNT&&c.y>=0&&c.y<COUNT&&!occupied(c)&&Math.abs(c.x-snake[0].x)+Math.abs(c.y-snake[0].y)>=5)){cells.forEach(c=>walls.push({...c,blink:12}));break;}}
 }
}
function levelUp(){
 level++;interval=speedFor(level);
 const nuevos=level>=3?(level>=6?3:2):0;if(nuevos)addWalls(nuevos);
 banner={title:`NIVEL ${level}`,sub:nuevos?"Más velocidad · nuevos muros":"Más velocidad",t:0};
 hud();try{navigator.vibrate?.(25);}catch{}
}
function start(){
 if(status==="running")return;
 if(status==="ready"||status==="over"){reset();banner={title:"NIVEL 1",sub:"Come 5 orbes para subir de nivel",t:0};}
 status="running";setState("Jugando");overlay.classList.add("hidden");pauseBtn.disabled=false;pauseBtn.textContent="Pausar";acc=0;
}
function step(){
 if(queue.length)direction=queue.shift();
 prev=snake.map(p=>({...p}));
 const head={x:snake[0].x+direction.x,y:snake[0].y+direction.y};
 const eatFood=food&&same(head,food),eatGold=gold&&same(head,gold);
 const body=(eatFood||eatGold)?snake:snake.slice(0,-1);
 if(head.x<0||head.x>=COUNT||head.y<0||head.y>=COUNT||body.some(p=>same(p,head))||walls.some(w=>w.blink<=0&&same(w,head))){die(head);return;}
 snake.unshift(head);
 const cx=head.x*CELL+CELL/2,cy=head.y*CELL+CELL/2;
 if(eatFood){const pts=10+(level-1)*2;score+=pts;eaten++;burst(cx,cy,12,["#ff7aa8","#ffc2d6","#ffffff"]);popups.push({x:cx,y:cy,text:`+${pts}`,t:0,color:"#ff9cc0"});
  food=freeCell();if(eaten%FOOD_PER_LEVEL===0)levelUp();if(eaten%7===0&&!gold){gold=freeCell(true);if(gold)gold.ttl=Math.round(5200/interval);}}
 else if(eatGold){score+=50;gold=null;burst(cx,cy,22,["#ffd36b","#fff3c4","#ff9f43"]);popups.push({x:cx,y:cy,text:"+50 ★",t:0,color:"#ffd36b"});}
 else snake.pop();
 if(gold&&--gold.ttl<=0)gold=null;
 walls.forEach(w=>{if(w.blink>0)w.blink--;});
 if(score>best){best=score;try{localStorage.setItem("ga_snake_best",String(best));}catch{}}
 hud();
}
function die(head){
 status="dying";deathT=0;shake=10;prev=snake.map(p=>({...p}));
 snake.forEach((p,i)=>{if(i%2===0)burst(p.x*CELL+CELL/2,p.y*CELL+CELL/2,4,["#b69aff","#7256d9","#ff6b86"]);});
 burst(clampC(head.x)*CELL+CELL/2,clampC(head.y)*CELL+CELL/2,14,["#ff4d6d","#ffd0d8"]);
 try{navigator.vibrate?.(140);}catch{}
}
const clampC=v=>Math.max(0,Math.min(COUNT-1,v));
function end(){
 status="over";setState("Finalizada");pauseBtn.disabled=true;
 try{games++;localStorage.setItem("ga_snake_games",String(games));if(!window.GameArena?.user){$("profile-games").textContent=games;$("profile-xp").textContent=`${best} XP`;}}catch{}
 overlayTitle.textContent="¡Fin de la partida!";
 overlayText.textContent=`Puntuación: ${score} · Nivel ${level}. ${score>=best&&score>0?"¡Nuevo récord!":"Inténtalo otra vez y supera tu marca."}`;
 startBtn.innerHTML='Jugar otra vez <span>→</span>';overlay.classList.remove("hidden");
 saveOnline(score);
}
async function saveOnline(finalScore){
 const GA=window.GameArena;if(!GA||!GA.cloudReady)return;
 const r=await GA.saveScore("snake",finalScore);
 if(r==="guardada"&&finalScore>0)overlayText.textContent+=" Guardada en tu cuenta ✓";
 else if(r==="invitado")overlayText.textContent+=" Inicia sesión para guardar tus partidas.";
 else if(r==="error")overlayText.textContent+=" No pudimos guardarla en línea.";
}
function pause(){
 if(status==="running"){status="paused";setState("Pausada");pauseBtn.textContent="Continuar";overlayTitle.textContent="Partida pausada";overlayText.textContent="Tómate un respiro y vuelve a jugar cuando quieras.";startBtn.innerHTML='Continuar <span>→</span>';overlay.classList.remove("hidden");}
 else if(status==="paused")start();
}
function setDirection(name){
 const d=dirs[name];if(!d||status!=="running")return;
 const lastDir=queue.length?queue[queue.length-1]:direction;
 if((d.x===-lastDir.x&&d.y===-lastDir.y)||(d.x===lastDir.x&&d.y===lastDir.y))return;
 if(queue.length<2)queue.push(d);   // permite girar dos veces rápido sin perder teclas
}
function burst(x,y,n,colors){for(let i=0;i<n;i++){const t=Math.random()*TAU,v=1+Math.random()*3;particles.push({x,y,vx:Math.cos(t)*v,vy:Math.sin(t)*v,life:0,max:24+Math.random()*20,color:colors[i%colors.length],size:2+Math.random()*2.5});}}

// ---------- Dibujo ----------
function lerpColor(a,b,t){const pa=a.match(/\w\w/g).map(h=>parseInt(h,16)),pb=b.match(/\w\w/g).map(h=>parseInt(h,16));return`rgb(${pa.map((v,i)=>Math.round(v+(pb[i]-v)*t)).join(",")})`;}
function draw(k){
 const glow=LEVEL_COLORS[(level-1)%LEVEL_COLORS.length];
 ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
 const bg=ctx.createRadialGradient(SIZE/2,SIZE/2,40,SIZE/2,SIZE/2,300);bg.addColorStop(0,"#121b33");bg.addColorStop(1,"#070b16");
 ctx.fillStyle=bg;ctx.fillRect(-12,-12,SIZE+24,SIZE+24);
 ctx.fillStyle="rgba(140,160,220,.16)";for(let x=1;x<COUNT;x++)for(let y=1;y<COUNT;y++)ctx.fillRect(x*CELL-1,y*CELL-1,2,2);
 ctx.strokeStyle=glow;ctx.globalAlpha=.55;ctx.lineWidth=2;ctx.shadowColor=glow;ctx.shadowBlur=14;ctx.strokeRect(1,1,SIZE-2,SIZE-2);ctx.shadowBlur=0;ctx.globalAlpha=1;
 // Muros
 for(const w of walls){if(w.blink>0&&Math.floor(frame/6)%2)continue;const x=w.x*CELL,y=w.y*CELL;
  const g=ctx.createLinearGradient(x,y,x,y+CELL);g.addColorStop(0,"#3b3f6e");g.addColorStop(1,"#22264a");
  ctx.globalAlpha=w.blink>0?.55:1;ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(x+1.5,y+1.5,CELL-3,CELL-3,4);ctx.fill();
  ctx.strokeStyle=w.blink>0?"#ff6b86":glow;ctx.lineWidth=1.2;ctx.stroke();ctx.globalAlpha=1;}
 // Orbe
 if(food){const fx=food.x*CELL+CELL/2,fy=food.y*CELL+CELL/2,pulse=1+Math.sin(frame/8)*.12;
  ctx.strokeStyle="rgba(255,114,158,.35)";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(fx,fy,9+Math.sin(frame/8)*2,0,TAU);ctx.stroke();
  const g=ctx.createRadialGradient(fx-2,fy-2,1,fx,fy,8);g.addColorStop(0,"#ffd0e0");g.addColorStop(1,"#ff4e91");
  ctx.fillStyle=g;ctx.shadowColor="#ff4e91";ctx.shadowBlur=14;ctx.beginPath();ctx.arc(fx,fy,6.5*pulse,0,TAU);ctx.fill();ctx.shadowBlur=0;}
 // Orbe dorado (temporal)
 if(gold){const gx=gold.x*CELL+CELL/2,gy=gold.y*CELL+CELL/2,max=Math.round(5200/interval);
  ctx.save();ctx.translate(gx,gy);ctx.rotate(frame/20);ctx.fillStyle="#ffd36b";ctx.shadowColor="#ffb703";ctx.shadowBlur=16;ctx.beginPath();
  for(let i=0;i<10;i++){const r=i%2?3.5:8,t=i*Math.PI/5-Math.PI/2;ctx.lineTo(Math.cos(t)*r,Math.sin(t)*r);}ctx.closePath();ctx.fill();ctx.restore();ctx.shadowBlur=0;
  ctx.strokeStyle="#ffd36b";ctx.lineWidth=2;ctx.beginPath();ctx.arc(gx,gy,11,-Math.PI/2,-Math.PI/2+TAU*(gold.ttl/max));ctx.stroke();}
 // Serpiente con movimiento interpolado
 const pts=snake.map((p,i)=>{const q=prev[i]||p;return{x:(q.x+(p.x-q.x)*k)*CELL+CELL/2,y:(q.y+(p.y-q.y)*k)*CELL+CELL/2};});
 const dead=status==="dying"||status==="over";const n=pts.length;
 ctx.lineCap="round";ctx.lineJoin="round";
 for(let i=n-1;i>0;i--){const t=i/(n-1);ctx.strokeStyle=dead&&Math.floor(deathT/5)%2?"#ff6b86":lerpColor("#b69aff","#3d2f9e",t);
  ctx.lineWidth=15-t*6;ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[i-1].x,pts[i-1].y);ctx.stroke();}
 const h=pts[0];ctx.fillStyle=dead?"#ff6b86":"#c8b2ff";ctx.shadowColor=dead?"#ff4d6d":"#a68aff";ctx.shadowBlur=14;ctx.beginPath();ctx.arc(h.x,h.y,8.5,0,TAU);ctx.fill();ctx.shadowBlur=0;
 const d=direction,ex=-d.y,ey=d.x;
 for(const s of[-1,1]){const x=h.x+d.x*3+ex*4*s,y=h.y+d.y*3+ey*4*s;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(x,y,2.6,0,TAU);ctx.fill();ctx.fillStyle="#140f2e";ctx.beginPath();ctx.arc(x+d.x*1,y+d.y*1,1.3,0,TAU);ctx.fill();}
 // Partículas y textos
 for(const p of particles){ctx.globalAlpha=1-p.life/p.max;ctx.fillStyle=p.color;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);}ctx.globalAlpha=1;
 ctx.textAlign="center";
 for(const p of popups){ctx.globalAlpha=Math.max(0,1-p.t/50);ctx.font="800 13px system-ui";ctx.fillStyle=p.color;ctx.fillText(p.text,p.x,p.y-10-p.t*.5);}ctx.globalAlpha=1;
 if(status==="dying"){ctx.fillStyle=`rgba(255,60,90,${Math.max(0,.22-deathT/180)})`;ctx.fillRect(-12,-12,SIZE+24,SIZE+24);}
 ctx.restore();
 if(banner&&banner.t<100){const a=Math.max(0,Math.min(1,banner.t<12?banner.t/12:1-(banner.t-70)/30));ctx.globalAlpha=a;ctx.textAlign="center";
  ctx.font="900 30px system-ui";ctx.fillStyle="#fff";ctx.shadowColor=glow;ctx.shadowBlur=20;ctx.fillText(banner.title,SIZE/2,SIZE/2-6);ctx.shadowBlur=0;
  ctx.font="600 12px system-ui";ctx.fillStyle="#cbc3f0";ctx.fillText(banner.sub.toUpperCase(),SIZE/2,SIZE/2+16);ctx.globalAlpha=1;}
}

// ---------- Bucle ----------
function loop(t){
 requestAnimationFrame(loop);
 const ms=Math.min(t-lastT||16.7,100),dt=ms/16.67;lastT=t;
 if(!pageActive()){if(status==="running")pause();return;}
 frame+=dt;
 if(status==="running"){acc+=ms;while(acc>=interval&&status==="running"){acc-=interval;step();}}
 else if(status==="dying"){deathT+=dt;if(deathT>=42)end();}
 for(const p of particles){p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;}particles=particles.filter(p=>p.life<p.max);
 for(const p of popups)p.t+=dt;popups=popups.filter(p=>p.t<50);
 if(banner)banner.t+=dt;shake=Math.max(0,shake-.7*dt);
 draw(status==="running"?Math.min(acc/interval,1):1);
}

// ---------- Controles ----------
document.addEventListener("keydown",e=>{
 if(!pageActive())return;
 if(e.target instanceof Element&&e.target.closest("input, textarea, select, [contenteditable]"))return;
 if(document.querySelector("dialog[open]"))return;
 const map={ArrowUp:"up",w:"up",W:"up",ArrowDown:"down",s:"down",S:"down",ArrowLeft:"left",a:"left",A:"left",ArrowRight:"right",d:"right",D:"right"};
 if(map[e.key]){e.preventDefault();setDirection(map[e.key]);}
 if(e.code==="Space"){e.preventDefault();if(status==="running"||status==="paused")pause();else if(status!=="dying")start();}
});
document.querySelectorAll("[data-dir]").forEach(btn=>{
 btn.addEventListener("click",()=>setDirection(btn.dataset.dir));
 btn.addEventListener("touchstart",e=>{e.preventDefault();setDirection(btn.dataset.dir);},{passive:false});
});
// Deslizar el dedo sobre el tablero también mueve la serpiente.
let touch0=null;
canvas.addEventListener("pointerdown",e=>{touch0={x:e.clientX,y:e.clientY};});
canvas.addEventListener("pointermove",e=>{if(!touch0)return;const dx=e.clientX-touch0.x,dy=e.clientY-touch0.y;if(Math.hypot(dx,dy)<22)return;
 setDirection(Math.abs(dx)>Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up"));touch0={x:e.clientX,y:e.clientY};});
canvas.addEventListener("pointerup",()=>{touch0=null;});
canvas.style.touchAction="none";
startBtn.addEventListener("click",start);pauseBtn.addEventListener("click",pause);
restartBtn.addEventListener("click",()=>{status="ready";reset();overlayTitle.textContent="¿Listo para jugar?";overlayText.textContent="Usa las flechas, WASD o desliza el dedo sobre el tablero.";startBtn.innerHTML='Comenzar partida <span>→</span>';overlay.classList.remove("hidden");pauseBtn.disabled=true;});
function onOpen(){bestEl.textContent=best;}
function setBest(n){if(n>best){best=n;bestEl.textContent=best;try{localStorage.setItem("ga_snake_best",String(best));}catch{}}}
function syncMode(){const el=$("snake-mode"),GA=window.GameArena;if(el)el.textContent=GA&&GA.user?"PARTIDA ONLINE":"PARTIDA LOCAL";}
reset();draw(1);requestAnimationFrame(loop);
window.SnakeRush={onOpen,setBest,syncMode};
})();
