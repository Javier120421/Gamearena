// ============================================================
// PARTE 2 · USUARIOS Y PERFIL
// Registro, inicio/cierre de sesión y perfil del jugador.
// ============================================================
(() => {
  const GA = window.GameArena;
  const $ = id => document.getElementById(id);
  const db = GA.db;
  let modo = "login";              // "login" | "registro"
  GA.user = null;                  // usuario con sesión iniciada
  GA.profile = null;               // su perfil (username, country)

  const modal = $("auth-modal"), form = $("auth-form"), msg = $("auth-msg");

  // ---------- Modal ----------
  function setModo(m) {
    modo = m;
    $("auth-title").textContent = m === "login" ? "Inicia sesión" : "Crea tu cuenta";
    $("auth-submit").textContent = m === "login" ? "Entrar" : "Registrarme";
    $("auth-username-wrap").hidden = m === "login";
    $("auth-password").autocomplete = m === "login" ? "current-password" : "new-password";
    document.querySelectorAll("[data-auth-mode]").forEach(b => b.classList.toggle("active", b.dataset.authMode === m));
    setMsg("");
  }
  function setMsg(text, error = false) { msg.textContent = text; msg.classList.toggle("error", error); }
  GA.openAuth = (m = "login") => {
    if (!GA.cloudReady) { window.showToast?.("Falta configurar Supabase en supabase-config.js"); return; }
    setModo(m); modal.showModal(); $("auth-email").focus();
  };
  $("auth-close").addEventListener("click", () => modal.close());
  modal.addEventListener("click", e => { if (e.target === modal) modal.close(); });
  document.querySelectorAll("[data-auth-mode]").forEach(b => b.addEventListener("click", () => setModo(b.dataset.authMode)));
  document.querySelectorAll("[data-open-auth]").forEach(b => b.addEventListener("click", () => GA.openAuth(b.dataset.openAuth)));
  document.querySelectorAll("[data-logout]").forEach(b => b.addEventListener("click", () => GA.logout()));

  // ---------- Traducción de errores comunes ----------
  function errorLegible(e) {
    const t = (e?.message || "").toLowerCase();
    if (t.includes("invalid login")) return "Correo o contraseña incorrectos.";
    if (t.includes("already registered")) return "Ese correo ya tiene una cuenta. Prueba iniciando sesión.";
    if (t.includes("email not confirmed")) return "Confirma tu correo antes de entrar (revisa tu bandeja).";
    if (t.includes("password")) return "La contraseña debe tener al menos 6 caracteres.";
    if (t.includes("rate limit")) return "Demasiados intentos. Espera un momento.";
    return "No se pudo completar la acción. Intenta de nuevo.";
  }

  // ---------- Registro / Login ----------
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("auth-email").value.trim(), password = $("auth-password").value;
    const username = $("auth-username").value.trim();
    $("auth-submit").disabled = true; setMsg("Un momento…");
    try {
      if (modo === "registro") {
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw { message: "x", custom: "El nombre de jugador debe tener 3–20 letras, números o _." };
        const { data: libre } = await db.from("profiles").select("id").ilike("username", username).limit(1);
        if (libre && libre.length) throw { message: "x", custom: "Ese nombre de jugador ya está en uso." };
        const { data, error } = await db.auth.signUp({ email, password, options: { data: { username } } });
        if (error) throw error;
        if (!data.session) { setMsg("¡Cuenta creada! Revisa tu correo para confirmarla y luego inicia sesión."); return; }
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      form.reset(); modal.close();
    } catch (err) { setMsg(err.custom || errorLegible(err), true); }
    finally { $("auth-submit").disabled = false; }
  });

  GA.logout = async () => { await db.auth.signOut(); window.showToast?.("Sesión cerrada"); };

  // ---------- Perfil ----------
  async function cargarPerfil() {
    const { data } = await db.from("profiles").select("username,country").eq("id", GA.user.id).maybeSingle();
    GA.profile = data || { username: GA.user.email.split("@")[0], country: "Colombia" };
  }

  $("profile-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const username = $("profile-username").value.trim(), country = $("profile-country").value.trim() || "Colombia";
    const pm = $("profile-msg");
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) { pm.textContent = "Nombre: 3–20 letras, números o _."; return; }
    const { error } = await db.from("profiles").update({ username, country }).eq("id", GA.user.id);
    if (error) { pm.textContent = /duplicate|unique/i.test(error.message) ? "Ese nombre ya está en uso." : "No se pudo guardar."; return; }
    GA.profile = { username, country }; pm.textContent = "Perfil guardado ✓"; pintarUsuario(); GA.refreshRanking?.();
  });

  // ---------- Pintar la interfaz según el estado ----------
  function pintarUsuario() {
    const logged = !!GA.user, nombre = logged ? GA.profile.username : "Invitado", ini = nombre[0].toUpperCase();
    document.querySelectorAll("[data-user-initial]").forEach(el => el.textContent = ini);
    document.querySelectorAll("[data-user-name]").forEach(el => el.textContent = nombre);
    $("user-sub").textContent = logged ? GA.user.email : "Inicia sesión para guardar tus marcas";
    document.querySelectorAll("[data-show-logged]").forEach(el => el.hidden = !logged);
    document.querySelectorAll("[data-show-guest]").forEach(el => el.hidden = logged);
    $("profile-title").textContent = nombre;
    $("profile-sub").textContent = logged ? `${GA.profile.country} · Miembro` : "Entra para ver tu perfil y guardar tus puntuaciones";
    if (logged) { $("profile-username").value = GA.profile.username; $("profile-country").value = GA.profile.country; }
  }

  async function alCambiarSesion(session) {
    GA.user = session?.user || null;
    if (GA.user) await cargarPerfil(); else GA.profile = null;
    pintarUsuario();
    GA.onSessionChange?.();        // scores.js se entera aquí
  }

  if (db) {
    db.auth.onAuthStateChange((_evento, session) => { setTimeout(() => alCambiarSesion(session), 0); });
    db.auth.getSession().then(({ data }) => alCambiarSesion(data.session));
  } else {
    pintarUsuario();
  }
})();
