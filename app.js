const pageNames={inicio:"Inicio",juegos:"Juegos",snake:"Snake Rush",knife:"Knife Rush",torneos:"Torneos",ranking:"Ranking",perfil:"Mi perfil"};
const toast=document.getElementById("toast");let toastTimer;
function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2400);}
function navigate(page){
 if(!pageNames[page])return;
 document.querySelectorAll(".page").forEach(el=>el.classList.toggle("active",el.id===`page-${page}`));
 document.querySelectorAll("[data-page]").forEach(el=>el.classList.toggle("active",el.dataset.page===page));
 document.getElementById("page-title").textContent=pageNames[page];
 window.scrollTo({top:0,behavior:"smooth"});history.replaceState(null,"",`#${page}`);
 if(page==="snake"&&window.SnakeRush)window.SnakeRush.onOpen();
 if(page==="knife"&&window.KnifeRush)window.KnifeRush.onOpen();
}
document.addEventListener("click",event=>{
 const nav=event.target.closest("[data-page]");if(nav){event.preventDefault();navigate(nav.dataset.page);return;}
 const game=event.target.closest("[data-game]");if(game){navigate(game.dataset.game==="knife"?"knife":"snake");return;}
 const coming=event.target.closest("[data-coming]");if(coming){showToast(`${coming.dataset.coming} estará disponible próximamente.`);return;}
 const filter=event.target.closest("[data-filter]");if(filter){document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("active",x===filter));document.querySelectorAll("[data-category]").forEach(card=>card.hidden=filter.dataset.filter!=="todos"&&card.dataset.category!==filter.dataset.filter);}
});
const initial=location.hash.replace("#","");if(pageNames[initial])navigate(initial);
if("serviceWorker"in navigator&&location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
