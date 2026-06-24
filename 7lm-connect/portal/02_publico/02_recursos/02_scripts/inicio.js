(function () {
  "use strict";

  const TOKEN_KEY = ["sevenlm_connect_token_de_acesso", "sevenlm_connect_token_de_acesso"];
  const REFRESH_KEY = ["sevenlm_connect_token_de_renovacao", "sevenlm_connect_token_de_renovacao"];
  const USER_KEY = ["sevenlm_connect_usuario", "sevenlm_connect_usuario"];
  const LOGIN_AT_KEY = ["sevenlm_connect_login_at", "sevenlm_connect_login_at"];
  const LOGIN_PROVIDER_KEY = ["sevenlm_connect_provedor_login", "sevenlm_connect_provedor_login"];
  const portalState = window.SevenLMConnectPortalState || null;

  function readSession(key) {
    const keys = Array.isArray(key) ? key : [key];
    try {
      for (const item of keys) {
        const value = sessionStorage.getItem(item) || "";
        if (value) return value;
      }
    } catch {}
    return "";
  }

  function removeSession(key) {
    const keys = Array.isArray(key) ? key : [key];
    try {
      keys.forEach((item) => {
        sessionStorage.removeItem(item);
      });
    } catch {}
  }

  function writeSession(key, value) {
    const keys = Array.isArray(key) ? key : [key];
    try {
      keys.forEach((item) => {
        sessionStorage.setItem(item, value);
      });
    } catch {}
  }

  function meta(name, fallback) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return (el && el.getAttribute("content")) ? el.getAttribute("content") : fallback;
  }

  const ENDPOINT_ME = meta("sevenlm-connect-endpoint-me", "/api/me");
  const ENDPOINT_REFRESH = meta("sevenlm-connect-endpoint-refresh", "/api/entrada/atualizar-credencial");

  // ==========================================
  // HELPERS DE AUTENTICAÇÃO
  // ==========================================
  function getAccessToken() {
    return readSession(TOKEN_KEY);
  }

  function getRefreshToken() {
    return readSession(REFRESH_KEY);
  }

  function getStoredUser() {
    if (portalState?.getStoredUser) {
      return portalState.getStoredUser();
    }

    try {
      const raw = readSession(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getLoginProvider() {
    return readSession(LOGIN_PROVIDER_KEY);
  }

  function clearAuthCache() {
    portalState?.clearUserCache?.();

    try {
      removeSession(TOKEN_KEY);
      removeSession(REFRESH_KEY);
      removeSession(USER_KEY);
      removeSession(LOGIN_AT_KEY);
      removeSession(LOGIN_PROVIDER_KEY);
    } catch {}
  }

  function getLoginPath() {
    return String(window.location.pathname || "/").startsWith("/live") ? "/live/acesso" : "/acesso";
  }

  function redirectToLogin() {
    clearAuthCache();
    window.location.replace(getLoginPath());
  }

  async function safeJson(response) {
    try {
      const ct = (response.headers.get("content-type") || "").toLowerCase();
      if (!ct.includes("application/json")) {
        const text = await response.text().catch(() => "");
        if (!text) return {};
        try { return JSON.parse(text); } catch { return {}; }
      }
      return await response.json().catch(() => ({}));
    } catch {
      return {};
    }
  }

  function persistAuthPayload(payload) {
    if (!payload || typeof payload !== "object") return;

    try {
      const accessToken = payload.token_de_acesso || payload.access_token || payload.token || "";
      const refreshToken = payload.token_de_renovacao || payload.refresh_token || "";
      const usuario = payload.usuario || payload["usuário"] || payload.user || null;

      if (accessToken) {
        writeSession(TOKEN_KEY, accessToken);
      }

      if (refreshToken) {
        writeSession(REFRESH_KEY, refreshToken);
      }

      if (usuario && typeof usuario === "object" && Object.keys(usuario).length > 0) {
        if (portalState?.cacheUser) {
          portalState.cacheUser(usuario, { markValidated: false });
        } else {
          writeSession(USER_KEY, JSON.stringify(usuario));
        }
      }

      writeSession(LOGIN_AT_KEY, new Date().toISOString());
    } catch {}
  }

  let refreshPromise = null;

  async function renewAccessToken() {
    if (refreshPromise) {
      return refreshPromise;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    refreshPromise = (async () => {
      try {
        const response = await fetch(ENDPOINT_REFRESH, {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            token_de_renovacao: refreshToken
          })
        });

        const payload = await safeJson(response);

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            clearAuthCache();
          }
          return null;
        }

        persistAuthPayload(payload);
        return getAccessToken();
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  async function fetchWithAuth(url, options = {}, allowRefresh = true) {
    const headers = new Headers(options.headers || {});
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    const token = getAccessToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      ...options,
      headers
    });

    if (response.status === 401 && allowRefresh) {
      const renewedToken = await renewAccessToken();

      if (renewedToken) {
        const retryHeaders = new Headers(options.headers || {});
        if (!retryHeaders.has("Accept")) {
          retryHeaders.set("Accept", "application/json");
        }
        retryHeaders.set("Authorization", `Bearer ${renewedToken}`);

        return fetch(url, {
          cache: "no-store",
          credentials: "same-origin",
          ...options,
          headers: retryHeaders
        });
      }
    }

    return response;
  }

  async function fetchJsonWithAuth(url, options = {}) {
    const response = await fetchWithAuth(url, options, true);

    function normalizarMensagemErro(payload, status) {
      if (payload === null || payload === undefined) {
        return status ? `Falha ${status}.` : "Não foi possível carregar os dados.";
      }

      if (typeof payload === "string") {
        return payload.trim() || (status ? `Falha ${status}.` : "Não foi possível carregar os dados.");
      }

      if (Array.isArray(payload)) {
        const itens = payload
          .map((item) => normalizarMensagemErro(item))
          .filter(Boolean);
        return itens[0] || (status ? `Falha ${status}.` : "Não foi possível carregar os dados.");
      }

      if (typeof payload === "object") {
        const candidatos = [
          payload.mensagem,
          payload.message,
          payload.detail,
          payload.erro,
          payload.error,
          payload.msg
        ];

        for (const candidato of candidatos) {
          if (candidato !== undefined && candidato !== null) {
            const texto = normalizarMensagemErro(candidato, status);
            if (texto && texto !== "[object Object]") return texto;
          }
        }

        if (Array.isArray(payload.errors) && payload.errors.length) {
          const primeiro = payload.errors[0];
          const campo = Array.isArray(primeiro?.loc) ? primeiro.loc.join(" > ") : "";
          const texto = primeiro?.msg || primeiro?.message || normalizarMensagemErro(primeiro);
          return campo ? `${campo}: ${texto}` : texto;
        }

        try {
          const serializado = JSON.stringify(payload);
          if (serializado && serializado !== "{}") return serializado;
        } catch (_) {}
      }

      return status ? `Falha ${status}.` : "Não foi possível carregar os dados.";
    }

    if (response.status === 401) {
      redirectToLogin();
      throw new Error("Sessão expirada.");
    }

    if (response.status === 403) {
      const payload = await safeJson(response);
      throw new Error(normalizarMensagemErro(payload, response.status) || "Acesso negado.");
    }

    if (!response.ok) {
      const payload = await safeJson(response);
      throw new Error(normalizarMensagemErro(payload, response.status));
    }

    return safeJson(response);
  }

  window.SevenLMConnectAuth = {
    getAccessToken,
    getRefreshToken,
    getStoredUser,
    getFreshStoredUser: (ttlMs) => portalState?.getFreshUser?.(ttlMs) || null,
    clearAuthCache,
    redirectToLogin,
    safeJson,
    renewAccessToken,
    fetchWithAuth,
    fetchJson: fetchJsonWithAuth,
    persistAuthPayload
  };

  // ==========================================
  // EFEITOS VISUAIS
  // ==========================================
  function initParticles() {
    const container = document.getElementById("tl-particles-container");
    if (!container) return;
    if (document.documentElement.classList.contains("tl-lite-effects")) {
      container.innerHTML = "";
      return;
    }

    const particleCount = 10;
    const colors = ["var(--c-teal)", "var(--c-purple)", "#FFFFFF"];

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div");
      particle.classList.add("particle");

      const size = Math.random() * 4 + 1 + "px";
      const color = colors[Math.floor(Math.random() * colors.length)];

      particle.style.width = size;
      particle.style.height = size;
      particle.style.background = color;
      particle.style.left = Math.random() * 100 + "%";
      particle.style.animationDelay = Math.random() * 5 + "s";
      particle.style.animationDuration = Math.random() * 10 + 10 + "s";
      particle.style.setProperty("--p-opacity", Math.random() * 0.4 + 0.1);
      particle.style.boxShadow = `0 0 ${parseInt(size, 10) * 2}px ${color}`;

      container.appendChild(particle);
    }
  }

  function initInteractivity() {
    if (document.documentElement.classList.contains("tl-lite-effects")) {
      return;
    }

    const spotlights = document.querySelectorAll(".js-spotlight, .js-tilt");

    spotlights.forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        el.style.setProperty("--mouse-x", `${x}px`);
        el.style.setProperty("--mouse-y", `${y}px`);

        if (el.classList.contains("js-tilt")) {
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const tiltX = ((y - centerY) / centerY) * -8;
          const tiltY = ((x - centerX) / centerX) * 8;

          el.style.setProperty("--tilt-x", `${tiltX}deg`);
          el.style.setProperty("--tilt-y", `${tiltY}deg`);
        }
      });

      el.addEventListener("mouseleave", () => {
        if (el.classList.contains("js-tilt")) {
          el.style.setProperty("--tilt-x", "0deg");
          el.style.setProperty("--tilt-y", "0deg");
        }
      });
    });

  }

  // ==========================================
  // TEMA
  // ==========================================
  function initTheme() {
    const btnTema = document.getElementById("btnTema");
    if (!btnTema) return;

    btnTema.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("tl.theme", next);
      document.cookie = `tl.theme=${encodeURIComponent(next)}; path=/; max-age=31536000; SameSite=Lax`;
    });
  }

  // ==========================================
  // USUÁRIO
  // ==========================================
  function getInitials(name) {
    if (!name) return "TL";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function extractUserData(user) {
    const nome =
      user?.nome ||
      user?.nome_completo ||
      user?.display_name ||
      user?.name ||
      user?.usuario ||
      "Usuário 7LM";

    const matricula =
      user?.matricula ||
      user?.id_funcional ||
      user?.id ||
      user?.user_id ||
      "";

    const metaUsuario = matricula
      ? `ID ${matricula}`
      : (user?.email || "Sessão autenticada");

    return { nome, metaUsuario };
  }

  function fillLastLogin() {
    const el = document.getElementById("ultimoLogin");
    if (!el) return;

    try {
      const raw = readSession(LOGIN_AT_KEY);
      if (!raw) {
        el.textContent = "Agora há pouco";
        return;
      }

      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        el.textContent = "Agora há pouco";
        return;
      }

      el.textContent = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    } catch {
      el.textContent = "Agora há pouco";
    }
  }

  function setSessionStatus(text) {
    const el = document.getElementById("statusSessao");
    if (!el) return;
    el.textContent = text;
  }

  function fillUser(user) {
    const { nome, metaUsuario } = extractUserData(user || {});

    const nomeEl = document.getElementById("nomeUsuario");
    const metaEl = document.getElementById("metaUsuario");
    const initialsEl = document.getElementById("userInitials");

    if (nomeEl) nomeEl.textContent = nome;
    if (metaEl) metaEl.textContent = metaUsuario;
    if (initialsEl) initialsEl.textContent = getInitials(nome);

    fillLastLogin();
  }

  function fillUserFromCache() {
    const cachedUser = getStoredUser();
    if (cachedUser) {
      fillUser(cachedUser);
      return;
    }

    fillUser({
      nome: "Usuário 7LM",
      matricula: ""
    });
  }

  // ==========================================
  // VALIDAÇÃO DE SESSÃO
  // ==========================================
  async function validateSession() {
    const token = getAccessToken();

    if (!token) {
      redirectToLogin();
      return false;
    }

    setSessionStatus("Validando...");
    fillUserFromCache();

    const usuarioRecente = portalState?.getFreshUser?.();
    if (usuarioRecente) {
      fillUser(usuarioRecente);
      setSessionStatus("Verificado");
      return true;
    }

    try {
      const response = await fetchWithAuth(ENDPOINT_ME, {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      });

      if (response.status === 401) {
        redirectToLogin();
        return false;
      }

      if (response.status === 403) {
        fillUserFromCache();
        setSessionStatus("Acesso restrito");
        return true;
      }

      if (!response.ok) {
        setSessionStatus("Sessão ativa");
        return true;
      }

      const payload = await safeJson(response);
      const user =
        payload?.usuario ||
        payload?.["usuário"] ||
        payload?.user ||
        payload?.data ||
        payload;

      if (user && typeof user === "object" && Object.keys(user).length > 0) {
        if (portalState?.cacheUser) {
          portalState.cacheUser(user);
        } else {
          writeSession(USER_KEY, JSON.stringify(user));
        }
        fillUser(user);
      } else {
        fillUserFromCache();
      }

      setSessionStatus("Verificado");
      return true;

    } catch {
      // em falha de rede, mantém a sessão local
      fillUserFromCache();
      setSessionStatus("Sessão ativa");
      return true;
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================
  function bindLogout() {
    const btnLogout = document.getElementById("btnLogout");
    if (!btnLogout) return;

    btnLogout.addEventListener("click", () => {
      const logoutUrl = getLoginProvider() === "entra_id" ? "/auth/entra/sair" : "/";
      clearAuthCache();
      window.location.replace(logoutUrl);
    });
  }

  // ==========================================
  // START
  // ==========================================
  document.addEventListener("DOMContentLoaded", async () => {
    initTheme();
    bindLogout();
    initParticles();
    initInteractivity();
    fillUserFromCache();
    await validateSession();
  });
})();
