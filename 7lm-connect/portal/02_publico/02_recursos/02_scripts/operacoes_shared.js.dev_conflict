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

  function normalizePath(pathname) {
    const path = String(pathname || "/").trim();
    if (!path || path === "/") return "/";
    return path.replace(/\/+$/, "") || "/";
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function getPortalBasePath() {
    const path = normalizePath(window.location.pathname);
    if (path === "/live" || path.startsWith("/live/")) {
      return "/live";
    }
    return "";
  }

  function buildPortalPath(pathname = "/") {
    const basePath = getPortalBasePath();
    const path = normalizePath(pathname);
    if (!basePath) return path;
    if (path === basePath || path.startsWith(`${basePath}/`)) {
      return path;
    }
    return path === "/" ? basePath : `${basePath}${path}`;
  }

  function buildOperacionalPath(slugCliente, slugDashboard) {
    return buildPortalPath(
      `/operacional/${encodeURIComponent(slugCliente || "")}/${encodeURIComponent(slugDashboard || "")}`
    );
  }

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

  function getLoginProvider() {
    return readSession(LOGIN_PROVIDER_KEY);
  }

  function redirectToLogin() {
    clearAuthCache();
    window.location.replace(buildPortalPath("/acesso"));
  }

  async function safeJson(response) {
    try {
      const ct = (response.headers.get("content-type") || "").toLowerCase();
      const text = await response.text().catch(() => "");
      if (!text) return {};
      if (ct.includes("application/json")) {
        try {
          return JSON.parse(text);
        } catch {
          return { detail: "Resposta JSON invalida recebida da API." };
        }
      }
      return { detail: text };
    } catch {
      return {};
    }
  }

  function extractErrorMessage(payload) {
    if (!payload || typeof payload !== "object") {
      return "Falha ao carregar dados da API.";
    }

    const detail = payload.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail.trim();
    }

    if (detail && typeof detail === "object") {
      if (typeof detail.mensagem === "string" && detail.mensagem.trim()) {
        return detail.mensagem.trim();
      }
      if (Array.isArray(detail.erros) && detail.erros.length) {
        const textoErros = detail.erros.map((item) => String(item || "").trim()).filter(Boolean).join(" ");
        if (textoErros) return textoErros;
      }
    }

    const mensagem = payload.mensagem;
    if (typeof mensagem === "string" && mensagem.trim()) {
      return mensagem.trim();
    }

    return "Falha ao carregar dados da API.";
  }

  async function fetchJson(url, options = {}) {
    const token = getAccessToken();
    const headers = {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      ...options,
      headers,
    });

    const payload = await safeJson(response);

    if (response.status === 401) {
      redirectToLogin();
      throw new Error(payload?.detail || "Sessao expirada.");
    }

    if (!response.ok) {
      throw new Error(extractErrorMessage(payload));
    }

    return payload;
  }

  function getInitials(name) {
    if (!name) return "TL";
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

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

  function bindLogout() {
    const btnLogout = document.getElementById("btnLogout");
    if (!btnLogout) return;

    btnLogout.addEventListener("click", () => {
      const logoutUrl = getLoginProvider() === "entra_id"
        ? buildPortalPath("/auth/entra/sair")
        : buildPortalPath("/");
      clearAuthCache();
      window.location.replace(logoutUrl);
    });
  }

  function fillUserbox(user) {
    const nome = user?.nome_completo || user?.nome || "Usuário 7LM";
    const matricula = user?.matricula || user?.id_funcional || "";
    const nomeEl = document.getElementById("nomeUsuario");
    const metaEl = document.getElementById("metaUsuario");
    const initialsEl = document.getElementById("userInitials");
    const lastLoginEl = document.getElementById("ultimoLogin");

    if (nomeEl) nomeEl.textContent = nome;
    if (metaEl) metaEl.textContent = matricula ? `ID ${matricula}` : "Sessao autenticada";
    if (initialsEl) initialsEl.textContent = getInitials(nome);

    try {
      const raw = readSession(LOGIN_AT_KEY);
      if (lastLoginEl) {
        lastLoginEl.textContent = raw ? formatDateTime(raw) : "Agora ha pouco";
      }
    } catch {}
  }

  function initChrome() {
    initTheme();
    bindLogout();
    fillUserbox(getStoredUser());
  }

  function getOperacionalSlugs() {
    const basePath = getPortalBasePath();
    const path = normalizePath(window.location.pathname);
    const withBase = basePath
      ? new RegExp(`^${escapeRegExp(basePath)}\\/operacional\\/([^/]+)\\/([^/]+)\\/?$`, "i")
      : null;
    const match =
      path.match(withBase) ||
      path.match(/^\/operacional\/([^/]+)\/([^/]+)\/?$/i);
    return {
      slugCliente: match?.[1] || "",
      slugDashboard: match?.[2] || "",
    };
  }

  window.SevenLMConnectOperacoes = {
    getAccessToken,
    getRefreshToken,
    getStoredUser,
    clearAuthCache,
    redirectToLogin,
    fetchJson,
    formatDate,
    formatDateTime,
    escapeHtml,
    getInitials,
    initChrome,
    fillUserbox,
    getPortalBasePath,
    buildPortalPath,
    buildOperacionalPath,
    getOperacionalSlugs,
  };
})();
