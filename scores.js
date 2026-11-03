// ============================================================
// PARTE 3 · PUNTUACIONES Y RANKING
// Guarda cada partida (Snake Rush, Knife Rush…) en Supabase y lee el ranking.
// ============================================================
(() => {
  const GA = window.GameArena, db = GA.db;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Guarda una partida. Devuelve "guardada", "invitado" o "error".
  GA.saveScore = async (game, score) => {
    if (!GA.cloudReady || !GA.user) return "invitado";
    if (score <= 0) return "guardada";               // no guardamos partidas de 0 puntos
    const { error } = await db.from("scores").insert({ game, score });
    if (error) { console.warn("No se guardó la puntuación:", error.message); return "error"; }
    GA.refreshRanking(); GA.refreshStats();
    return "guardada";
  };

  // Estadísticas del jugador (todas sus partidas y mejores marcas por juego).
  GA.refreshStats = async () => {
    if (!GA.cloudReady || !GA.user) return;
    const { data } = await db.from("leaderboard").select("game,best_score,games_played")
      .eq("user_id", GA.user.id);
    if (!data) return;
    const por = Object.fromEntries(data.map(r => [r.game, r]));
    $("profile-games").textContent = data.reduce((t, r) => t + r.games_played, 0);
    $("profile-xp").textContent = `${data.reduce((t, r) => t + r.best_score, 0)} XP`;
    if (por.snake) window.SnakeRush?.setBest(por.snake.best_score);   // si tu récord en la nube es mayor, lo mostramos
    if (por.knife) window.KnifeRush?.setBest(por.knife.best_score);
  };

  // Ranking online (top 10 de Snake Rush).
  GA.refreshRanking = async () => {
    const lista = $("ranking-live"), demo = $("ranking-demo");
    if (!lista || !GA.cloudReady) return;
    const { data, error } = await db.from("leaderboard").select("username,country,best_score,games_played,user_id")
      .eq("game", "snake").order("best_score", { ascending: false }).limit(10);
    if (error || !data || !data.length) { lista.hidden = true; demo.hidden = false; return; }
    const clases = ["gold", "silver", "bronze"];
    lista.innerHTML = data.map((r, i) => `
      <div class="rank-row${GA.user && r.user_id === GA.user.id ? " me" : ""}">
        <span class="rank-number ${clases[i] || ""}">${String(i + 1).padStart(2, "0")}</span>
        <div class="rank-avatar av${(i % 5) + 1}">${esc(r.username[0].toUpperCase())}</div>
        <div class="rank-user"><b>${esc(r.username)}</b><small>${esc(r.country)} · ${r.games_played} partidas</small></div>
        <strong>${r.best_score} <small>pts</small></strong>
      </div>`).join("");
    lista.hidden = false; demo.hidden = true;
  };

  GA.onSessionChange = () => {
    GA.refreshStats(); GA.refreshRanking(); window.SnakeRush?.syncMode();
    window.KnifeRush?.syncMode(); window.KnifeRush?.refreshRanking();
    if (!GA.user) { $("profile-games").textContent = localStorage.getItem("ga_snake_games") || 0; }
  };
  if (GA.cloudReady && !GA.user) GA.refreshRanking();
})();
