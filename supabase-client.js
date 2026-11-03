// ============================================================
// PARTE 1 · CONEXIÓN
// Crea el "cliente" de Supabase: el objeto que usamos para hablar
// con la base de datos y con el sistema de usuarios.
// Si falta la configuración o la librería, GameArena sigue
// funcionando en modo local (como la versión 0.2).
// ============================================================
(() => {
  const cfg = window.GA_CONFIG || {};
  const configurado = cfg.SUPABASE_URL && cfg.SUPABASE_KEY &&
    !cfg.SUPABASE_URL.startsWith("PEGA_") && !cfg.SUPABASE_KEY.startsWith("PEGA_");

  window.GameArena = window.GameArena || {};
  window.GameArena.cloudReady = false;
  window.GameArena.db = null;

  if (!configurado) { console.info("GameArena: Supabase sin configurar, modo local."); return; }
  if (!window.supabase || !window.supabase.createClient) { console.warn("GameArena: no se cargó la librería de Supabase."); return; }

  window.GameArena.db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
  window.GameArena.cloudReady = true;
})();
