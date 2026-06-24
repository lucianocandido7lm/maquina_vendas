(function () {
  "use strict";

  const root = document.documentElement;
  const TOKEN_KEY = ["sevenlm_connect_token_de_acesso", "sevenlm_connect_access_token"];
  const REFRESH_KEY = ["sevenlm_connect_token_de_renovacao", "sevenlm_connect_refresh_token"];
  const USER_KEY = ["sevenlm_connect_usuario", "sevenlm_connect_user"];
  const LOGIN_AT_KEY = ["sevenlm_connect_login_at", "sevenlm_connect_login_at"];
  const LOGIN_PROVIDER_KEY = ["sevenlm_connect_provedor_login", "sevenlm_connect_login_provider"];
  const USER_VALIDATED_AT_KEY = ["sevenlm_connect_usuario_validado_em", "sevenlm_connect_user_validated_at"];
  const AUTH_STORAGE_PREFIX = "sevenlm_connect_";
  const USER_CACHE_MAX_AGE_MS = 120000;
  const USER_FETCH_TIMEOUT_MS = 8000;
  const ACCESS_CHECK_FALLBACK_MS = 10000;
  const ACCESS_NOTICE_ID = "tl-access-feedback";
  const ACCESS_NOTICE_STORAGE_KEY = ["sevenlm_connect_pending_access_notice", "sevenlm_connect_pending_access_notice"];
  const APPROVAL_POPUP_ID = "tl-approval-popup";
  const APPROVAL_POPUP_STORAGE_KEY = "sevenlm_connect_pending_approval_popup";
  const SIDEBAR_ANIMATION_CLASS = "sidebar-is-animating";
  const SIDEBAR_COLLAPSED_CLASS = "sidebar-is-collapsed";
  const SIDEBAR_STORAGE_KEY = "tl.sidebar";
  const LITE_EFFECTS_CLASS = "tl-lite-effects";
  let sidebarAnimationTimer = null;
  let accessCheckFallbackTimer = null;

  function meta(name, fallback) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return (el && el.getAttribute("content")) ? el.getAttribute("content") : fallback;
  }

  const ENDPOINT_ME = meta("sevenlm-connect-endpoint-me", "/api/me");
  const REQUIRED_PERMISSION = String(meta("sevenlm-connect-required-permission", "") || "").trim();
  const ACCESS_FALLBACK_PATH = String(meta("sevenlm-connect-access-fallback", "/inicio") || "/inicio").trim();
  const LOCAL_FALLBACK_MODE = String(meta("sevenlm-connect-local-fallback", "off") || "off").toLowerCase();
  const ENDPOINT_APROVACOES_RESUMO = meta(
    "sevenlm-connect-endpoint-aprovacoes-resumo",
    "/api/connect-comercial/aprovacoes-excecao/resumo"
  );

  function readStorage(storage, key) {
    try {
      const keys = Array.isArray(key) ? key : [key];
      for (const item of keys) {
        const value = storage.getItem(item);
        if (value) return value;
      }
    } catch {
      return null;
    }
    return null;
  }

  function readStorageJson(storage, key) {
    try {
      const raw = readStorage(storage, key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function firstFilled(...values) {
    for (const value of values) {
      const text = String(value ?? "").trim();
      if (text) return text;
    }
    return "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function readCookie(name) {
    try {
      const alvo = `${String(name || "").trim()}=`;
      const cookies = String(document.cookie || "").split(";");
      for (const item of cookies) {
        const cookie = item.trim();
        if (cookie.startsWith(alvo)) {
          return decodeURIComponent(cookie.slice(alvo.length));
        }
      }
    } catch {}
    return "";
  }

  function persistTheme(theme) {
    const valor = String(theme || "dark").trim() || "dark";
    try {
      window.localStorage.setItem("tl.theme", valor);
    } catch {}
    try {
      document.cookie = `tl.theme=${encodeURIComponent(valor)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
    return valor;
  }

  function writeSession(key, value) {
    try {
      const keys = Array.isArray(key) ? key : [key];
      keys.forEach((item) => {
        window.sessionStorage.setItem(item, value);
      });
    } catch {}
  }

  function removeSession(key) {
    try {
      const keys = Array.isArray(key) ? key : [key];
      keys.forEach((item) => {
        window.sessionStorage.removeItem(item);
      });
    } catch {}
  }

  function removePortalAuthKeys(storage) {
    try {
      const keysToRemove = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && key.startsWith(AUTH_STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => storage.removeItem(key));
    } catch {}
  }

  function clearPortalAuthCookies() {
    try {
      String(document.cookie || "")
        .split(";")
        .map((item) => item.split("=")[0]?.trim())
        .filter((name) => name && name.startsWith(AUTH_STORAGE_PREFIX))
        .forEach((name) => {
          document.cookie = `${encodeURIComponent(name)}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
        });
    } catch {}
  }

  function queueAccessNotice(message) {
    if (!message) return;
    writeSession(ACCESS_NOTICE_STORAGE_KEY, message);
  }

  function consumeAccessNotice() {
    const message = readStorage(window.sessionStorage, ACCESS_NOTICE_STORAGE_KEY);
    if (message) {
      removeSession(ACCESS_NOTICE_STORAGE_KEY);
    }
    return message || "";
  }

  function getStoredUser() {
    return readStorageJson(window.sessionStorage, USER_KEY);
  }

  function readTimestamp(key) {
    const raw = readStorage(window.sessionStorage, key);
    if (!raw) return 0;
    const parsed = new Date(raw).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function getValidatedAt() {
    return readTimestamp(USER_VALIDATED_AT_KEY) || readTimestamp(LOGIN_AT_KEY);
  }

  function markUserValidatedNow() {
    writeSession(USER_VALIDATED_AT_KEY, new Date().toISOString());
  }

  function cacheUser(user, options = {}) {
    if (!user || typeof user !== "object") return;

    writeSession(USER_KEY, JSON.stringify(user));

    if (options.markValidated !== false) {
      markUserValidatedNow();
    }
  }

  function clearUserCache() {
    removeSession(USER_KEY);
    removeSession(USER_VALIDATED_AT_KEY);
  }

  function isUserFresh(ttlMs = USER_CACHE_MAX_AGE_MS) {
    if (!getStoredUser()) return false;
    const validatedAt = getValidatedAt();
    if (!validatedAt) return false;
    return (Date.now() - validatedAt) <= ttlMs;
  }

  function getFreshUser(ttlMs = USER_CACHE_MAX_AGE_MS) {
    return isUserFresh(ttlMs) ? getStoredUser() : null;
  }

  window.SevenLMConnectPortalState = {
    USER_CACHE_MAX_AGE_MS,
    getStoredUser,
    getValidatedAt,
    markUserValidatedNow,
    cacheUser,
    clearUserCache,
    isUserFresh,
    getFreshUser,
    persistTheme,
  };

  const rootClasses = (root.getAttribute("data-preload-root-classes") || "")
    .split(/\s+/)
    .filter(Boolean);

  rootClasses.forEach((className) => {
    root.classList.add(className);
  });

  if (REQUIRED_PERMISSION) {
    const style = document.createElement("style");
    style.textContent = `
      html.tl-page-access-checking body {
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);
    root.classList.add("tl-page-access-checking");
    accessCheckFallbackTimer = window.setTimeout(() => {
      finishAccessCheck();
    }, ACCESS_CHECK_FALLBACK_MS);
  }

  const savedTheme = readStorage(window.localStorage, "tl.theme") || readCookie("tl.theme") || "dark";
  root.setAttribute("data-theme", persistTheme(savedTheme));

  function shouldUseLiteEffects() {
    try {
      const effectPreference = String(readStorage(window.localStorage, "tl.effects") || "auto").trim().toLowerCase();
      if (effectPreference === "lite") return true;
      if (effectPreference === "full") return false;

      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const deviceMemory = Number(window.navigator?.deviceMemory || 0);
      const hardwareConcurrency = Number(window.navigator?.hardwareConcurrency || 0);
      const smallViewport = window.matchMedia?.("(max-width: 900px)")?.matches;

      if (reducedMotion) return true;

      const veryLowMemory = deviceMemory && deviceMemory <= 4;
      const veryLowCpu = hardwareConcurrency && hardwareConcurrency <= 4;
      if (veryLowMemory || veryLowCpu) return true;

      const lowMemoryOnMobile = smallViewport && deviceMemory && deviceMemory <= 8;
      const lowCpuOnMobile = smallViewport && hardwareConcurrency && hardwareConcurrency <= 6;
      if (lowMemoryOnMobile || lowCpuOnMobile) return true;
    } catch {}

    return false;
  }

  root.classList.add(LITE_EFFECTS_CLASS);

  if (readStorage(window.localStorage, "tl.sidebar") === "collapsed") {
    root.classList.add(SIDEBAR_COLLAPSED_CLASS);
  }

  function updateSidebarToggleState(btnToggle) {
    if (!btnToggle) return;

    const isCollapsed = root.classList.contains(SIDEBAR_COLLAPSED_CLASS);
    btnToggle.setAttribute("aria-expanded", String(!isCollapsed));
    btnToggle.setAttribute(
      "aria-label",
      isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"
    );
    btnToggle.setAttribute(
      "title",
      isCollapsed ? "Expandir menu" : "Recolher menu"
    );
  }

  function startSidebarAnimation() {
    root.classList.add(SIDEBAR_ANIMATION_CLASS);

    if (sidebarAnimationTimer) {
      window.clearTimeout(sidebarAnimationTimer);
    }

    sidebarAnimationTimer = window.setTimeout(() => {
      root.classList.remove(SIDEBAR_ANIMATION_CLASS);
    }, 460);
  }

  function bindSidebarToggle() {
    const btnToggle = document.getElementById("btnToggleSidebar");
    if (!btnToggle || btnToggle.dataset.sidebarBound === "true") return;

    btnToggle.dataset.sidebarBound = "true";
    updateSidebarToggleState(btnToggle);

    btnToggle.addEventListener("click", () => {
      startSidebarAnimation();
      root.classList.toggle(SIDEBAR_COLLAPSED_CLASS);
      const isCollapsed = root.classList.contains(SIDEBAR_COLLAPSED_CLASS);
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, isCollapsed ? "collapsed" : "expanded");
      updateSidebarToggleState(btnToggle);
    });
  }

  function bindSidebarMagneticItems() {
    if (root.classList.contains(LITE_EFFECTS_CLASS)) {
      return;
    }

    const buttons = document.querySelectorAll(".js-magnetic");
    buttons.forEach((btn) => {
      if (btn.dataset.magneticBound === "true") return;
      btn.dataset.magneticBound = "true";

      btn.addEventListener("mousemove", (event) => {
        const icon = btn.querySelector(".nav-icon");
        if (!icon) return;

        const rect = icon.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;

        icon.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px) scale(1.15) rotate(-5deg)`;
      });

      btn.addEventListener("mouseleave", () => {
        const icon = btn.querySelector(".nav-icon");
        if (icon) {
          icon.style.transform = "";
        }
      });
    });
  }

  function getProtectedPermissionElements() {
    return Array.from(document.querySelectorAll("[data-permission]"));
  }

  function setProtectedElementVisibility(element, allowed) {
    if (!(element instanceof HTMLElement)) return;

    const isAllowed = allowed === true;
    element.hidden = !isAllowed;
    element.setAttribute("aria-hidden", isAllowed ? "false" : "true");
  }

  function applyProtectedElementPermissions(user) {
    getProtectedPermissionElements().forEach((element) => {
      const permission = String(element.getAttribute("data-permission") || "").trim();
      if (!permission) return;
      setProtectedElementVisibility(element, resolvePortalPermission(user, permission));
    });
  }

  async function syncProtectedNavigationVisibility(force = false) {
    const elements = getProtectedPermissionElements();
    if (!elements.length) return;

    let user = force ? null : getStoredUser();
    if (!hasAccessMap(user)) {
      applyProtectedElementPermissions(null);
      user = await fetchCurrentUser(force);
    }

    applyProtectedElementPermissions(user);
  }

  function initPortalSidebar() {
    bindSidebarToggle();
    bindSidebarMagneticItems();
    void syncProtectedNavigationVisibility();
  }

  function normalizePath(pathname) {
    const path = String(pathname || "/").trim();
    if (!path || path === "/") return "/";
    return path.replace(/\/+$/, "") || "/";
  }

  function isPublicEntryPath(pathname) {
    const path = normalizePath(pathname);
    return (
      path === "/" ||
      path === "/acesso" ||
      path === "/apresentacao" ||
      path === "/live" ||
      path === "/live/acesso" ||
      path === "/entrada.html" ||
      path === "/live/entrada.html"
    );
  }

  function getPortalBasePath() {
    return normalizePath(window.location.pathname).startsWith("/live") ? "/live" : "";
  }

  function getLoginPath() {
    return getPortalBasePath() ? "/live/acesso" : "/acesso";
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

  function clearAuthSession() {
    removeSession(TOKEN_KEY);
    removeSession(REFRESH_KEY);
    removeSession(LOGIN_PROVIDER_KEY);
    clearUserCache();
    removeSession(LOGIN_AT_KEY);
    removeSession(ACCESS_NOTICE_STORAGE_KEY);
    removePortalAuthKeys(window.sessionStorage);
    removePortalAuthKeys(window.localStorage);
    clearPortalAuthCookies();
  }

  function getLoginProvider() {
    return readStorage(window.sessionStorage, LOGIN_PROVIDER_KEY);
  }

  function getLogoutPath() {
    return getLoginProvider() === "entra_id"
      ? buildPortalPath("/auth/entra/sair")
      : buildPortalPath("/auth/sair");
  }

  function forcePortalLogout() {
    const logoutPath = getLogoutPath();
    clearAuthSession();
    window.location.replace(logoutPath);
  }

  function redirectToLogin() {
    clearAuthSession();
    window.location.replace(getLoginPath());
  }

  function bindGlobalLogout() {
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      if (!(target instanceof Element)) return;

      const trigger = target.closest("#btnLogout, [data-action='portal-logout'], [data-portal-logout='true']");
      if (!trigger) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      forcePortalLogout();
    }, true);
  }

  function safeJsonResponse(response) {
    return response.text()
      .then((text) => {
        if (!text) return {};
        try {
          return JSON.parse(text);
        } catch {
          return {};
        }
      })
      .catch(() => ({}));
  }

  function extractUserPayload(payload) {
    return payload?.usuario || payload?.["usuário"] || payload?.user || payload?.data || payload || null;
  }

  function hasAccessMap(user) {
    return Boolean(user && typeof user === "object" && user.acessos_portal && typeof user.acessos_portal === "object");
  }

  function readAccessFlag(accessMap, permission) {
    if (!accessMap || !Object.prototype.hasOwnProperty.call(accessMap, permission)) {
      return null;
    }

    return Boolean(accessMap[permission]);
  }

  function anyAccessFlag(accessMap, permissions) {
    if (!accessMap) return null;

    let foundDenied = false;
    for (const permission of permissions) {
      const value = readAccessFlag(accessMap, permission);
      if (value === true) return true;
      if (value === false) foundDenied = true;
    }

    return foundDenied ? false : null;
  }

  function isApprovalPermission(permission) {
    return permission === "aprovacoes.excecao.view" || permission === "aprovacoes.excecao.manage";
  }

  function isMetasPermission(permission) {
    return String(permission || "").startsWith("metas.resultados.");
  }

  function isLocalLikeHost() {
    const host = String(window.location.hostname || "").toLowerCase();
    return !host || host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function shouldAllowLocalFallbackPage() {
    if (!isMetasPermission(REQUIRED_PERMISSION)) return false;
    if (LOCAL_FALLBACK_MODE === "on") return true;
    return LOCAL_FALLBACK_MODE === "auto" && isLocalLikeHost();
  }

  function finishAccessCheck() {
    root.classList.remove("tl-page-access-checking");
    if (accessCheckFallbackTimer) {
      window.clearTimeout(accessCheckFallbackTimer);
      accessCheckFallbackTimer = null;
    }
  }

  function isDashboardComercialPermission(permission) {
    return permission === "dashboard.comercial.view" || permission === "dashboard.comercial.manage";
  }

  function isMaquinaVendasDashboardPermission(permission) {
    return permission === "maquina.vendas.dashboard.view" || permission === "maquina.vendas.dashboard.manage";
  }

  function isMaqCreditoPermission(permission) {
    return permission === "maq.credito.view" || permission === "maq.credito.manage";
  }

  function isFuncionariosPermission(permission) {
    return [
      "funcionarios.acesso.view",
      "funcionarios.acesso.manage",
      "funcionarios.validacao.view",
      "funcionarios.validacao.manage",
    ].includes(permission);
  }

  function resolvePortalPermission(user, permission) {
    if (!user || typeof user !== "object") return null;

    const accessMap = hasAccessMap(user) ? user.acessos_portal : null;
    if (permission === "aprovacoes.excecao.view") {
      const approvalAccess = anyAccessFlag(accessMap, [
        "aprovacoes.excecao.view",
        "aprovacoes.excecao.manage",
        "administracao.view",
        "administracao.manage",
        "rh.admin.acessos.view",
        "rh.admin.acessos.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
      ]);
      if (approvalAccess !== null) return approvalAccess;
      return typeof user.pode_ver === "boolean" ? user.pode_ver : null;
    }

    if (permission === "aprovacoes.excecao.manage") {
      const approvalAccess = anyAccessFlag(accessMap, [
        "aprovacoes.excecao.manage",
        "administracao.manage",
        "rh.admin.acessos.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
      ]);
      if (approvalAccess !== null) return approvalAccess;
      return typeof user.pode_gerenciar === "boolean" ? user.pode_gerenciar : null;
    }

    if (isMetasPermission(permission)) {
      const equivalenciasMetas = {
        "metas.resultados.view": [
          "metas.resultados.view",
          "metas.resultados.manage",
          "metas.resultados.admin",
          "metas.resultados.gerenciais.manage",
          "metas.resultados.resultados.manage",
          "metas.resultados.import",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
        "metas.resultados.manage": [
          "metas.resultados.manage",
          "metas.resultados.admin",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
        "metas.resultados.admin": [
          "metas.resultados.admin",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
        "metas.resultados.gerenciais.manage": [
          "metas.resultados.gerenciais.manage",
          "metas.resultados.admin",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
        "metas.resultados.resultados.manage": [
          "metas.resultados.resultados.manage",
          "metas.resultados.admin",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
        "metas.resultados.import": [
          "metas.resultados.import",
          "metas.resultados.admin",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
      };
      const metasAccess = anyAccessFlag(accessMap, equivalenciasMetas[permission] || [permission]);
      if (metasAccess !== null) return metasAccess;
      if (permission === "metas.resultados.view" && typeof user.pode_ver === "boolean") return user.pode_ver;
      if (typeof user.pode_gerenciar === "boolean") return user.pode_gerenciar;
      return null;
    }

    if (isDashboardComercialPermission(permission)) {
      const equivalenciasDashboard = {
        "dashboard.comercial.view": [
          "dashboard.comercial.view",
          "dashboard.comercial.manage",
          "administracao.view",
          "administracao.manage",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
        "dashboard.comercial.manage": [
          "dashboard.comercial.manage",
          "administracao.manage",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
      };
      const dashboardAccess = anyAccessFlag(accessMap, equivalenciasDashboard[permission] || [permission]);
      if (dashboardAccess !== null) return dashboardAccess;
      if (permission === "dashboard.comercial.view" && typeof user.pode_ver === "boolean") return user.pode_ver;
      if (typeof user.pode_gerenciar === "boolean") return user.pode_gerenciar;
      return null;
    }

    if (isMaquinaVendasDashboardPermission(permission)) {
      const equivalenciasMaquinaVendas = {
        "maquina.vendas.dashboard.view": [
          "maquina.vendas.dashboard.view",
          "maquina.vendas.dashboard.manage",
          "dashboard.comercial.view",
          "dashboard.comercial.manage",
          "imoveis.view",
          "administracao.view",
          "administracao.manage",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
        "maquina.vendas.dashboard.manage": [
          "maquina.vendas.dashboard.manage",
          "dashboard.comercial.manage",
          "administracao.manage",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
      };
      const maquinaVendasAccess = anyAccessFlag(accessMap, equivalenciasMaquinaVendas[permission] || [permission]);
      if (maquinaVendasAccess !== null) return maquinaVendasAccess;
      return null;
    }

    if (isMaqCreditoPermission(permission)) {
      const equivalenciasMaqCredito = {
        "maq.credito.view": [
          "maq.credito.view",
          "maq.credito.manage",
          "maquina.vendas.dashboard.view",
          "maquina.vendas.dashboard.manage",
          "dashboard.comercial.view",
          "dashboard.comercial.manage",
          "imoveis.view",
          "imoveis.manage",
          "administracao.view",
          "administracao.manage",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
        "maq.credito.manage": [
          "maq.credito.manage",
          "maquina.vendas.dashboard.manage",
          "dashboard.comercial.manage",
          "administracao.manage",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
      };
      const maqCreditoAccess = anyAccessFlag(accessMap, equivalenciasMaqCredito[permission] || [permission]);
      if (maqCreditoAccess !== null) return maqCreditoAccess;
      return null;
    }

    if (isFuncionariosPermission(permission)) {
      const equivalenciasFuncionarios = {
        "funcionarios.acesso.view": [
          "funcionarios.acesso.view",
          "funcionarios.acesso.manage",
          "funcionarios.validacao.view",
          "funcionarios.validacao.manage",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
        "funcionarios.acesso.manage": [
          "funcionarios.acesso.manage",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
        "funcionarios.validacao.view": [
          "funcionarios.validacao.view",
          "funcionarios.validacao.manage",
          "funcionarios.acesso.manage",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
        "funcionarios.validacao.manage": [
          "funcionarios.validacao.manage",
          "ACESSO_TOTAL",
          "GERENCIAR_ACESSO",
        ],
      };
      const funcionariosAccess = anyAccessFlag(accessMap, equivalenciasFuncionarios[permission] || [permission]);
      if (funcionariosAccess !== null) return funcionariosAccess;
      return null;
    }

    const directAccess = readAccessFlag(accessMap, permission);
    if (directAccess !== null) {
      return directAccess;
    }

    if (permission === "rh.admin.acessos.view" || permission === "administracao.view") {
      return typeof user.pode_ver === "boolean" ? user.pode_ver : null;
    }

    if (permission === "administracao.manage") {
      return typeof user.pode_gerenciar === "boolean" ? user.pode_gerenciar : null;
    }

    return null;
  }

  let currentUserPromise = null;

  async function fetchCurrentUser(force = false) {
    const freshUser = getFreshUser(USER_CACHE_MAX_AGE_MS);
    const cachedUser = getStoredUser();
    if (!force && hasAccessMap(freshUser)) {
      return freshUser;
    }

    const tokenAtual = readStorage(window.sessionStorage, TOKEN_KEY);
    if (!tokenAtual) {
      return freshUser || cachedUser;
    }

    if (!force && currentUserPromise) {
      return currentUserPromise;
    }

    currentUserPromise = (async () => {
      try {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeoutId = controller
          ? window.setTimeout(() => controller.abort(), USER_FETCH_TIMEOUT_MS)
          : null;

        const response = await fetch(ENDPOINT_ME, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          signal: controller?.signal,
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${tokenAtual}`,
          },
        });
        if (timeoutId) window.clearTimeout(timeoutId);

        if (response.status === 401) {
          redirectToLogin();
          return null;
        }

        if (response.status === 403 || !response.ok) {
          return freshUser || cachedUser;
        }

        const payload = await safeJsonResponse(response);
        const user = extractUserPayload(payload);

        if (user && typeof user === "object") {
          cacheUser(user);
          applyProtectedElementPermissions(user);
          return user;
        }

        return freshUser || cachedUser;
      } catch {
        return freshUser || cachedUser;
      } finally {
        currentUserPromise = null;
      }
    })();

    return currentUserPromise;
  }

  async function canAccessPermission(permission, options = {}) {
    const revalidate = options.revalidate === true;
    let user = revalidate ? null : getStoredUser();
    let allowed = resolvePortalPermission(user, permission);
    if (!revalidate && allowed !== null && !(allowed === false && (isApprovalPermission(permission) || isMetasPermission(permission) || isDashboardComercialPermission(permission) || isFuncionariosPermission(permission)))) {
      return allowed;
    }

    user = await fetchCurrentUser(revalidate);
    allowed = resolvePortalPermission(user, permission);
    if (allowed !== null || revalidate) {
      return allowed;
    }

    user = await fetchCurrentUser(true);
    return resolvePortalPermission(user, permission);
  }

  let accessNoticeHost = null;
  let accessNoticeStyleInjected = false;
  let accessNoticeTimer = null;
  let approvalPopupHost = null;
  let approvalPopupStyleInjected = false;

  function ensureAccessNoticeStyles() {
    if (accessNoticeStyleInjected) return;

    const style = document.createElement("style");
    style.textContent = `
      #${ACCESS_NOTICE_ID} {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
      }

      .tl-access-feedback__toast {
        width: min(420px, calc(100vw - 32px));
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px 18px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.92);
        color: var(--txt-main, #1A1A1F);
        border: 1px solid rgba(26, 26, 31, 0.08);
        box-shadow: 0 22px 48px rgba(7, 10, 18, 0.16);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        opacity: 0;
        transform: translateY(12px);
        transition: opacity 0.22s ease, transform 0.22s ease;
      }

      html[data-theme="dark"] .tl-access-feedback__toast {
        background: rgba(12, 16, 24, 0.92);
        color: var(--txt-main, #FFFFFF);
        border-color: rgba(255, 255, 255, 0.08);
        box-shadow: 0 24px 56px rgba(0, 0, 0, 0.45);
      }

      .tl-access-feedback__toast.is-visible {
        opacity: 1;
        transform: translateY(0);
      }

      .tl-access-feedback__icon {
        width: 34px;
        height: 34px;
        border-radius: 12px;
        flex: 0 0 34px;
        display: grid;
        place-items: center;
        font: 800 0.95rem/1 "Inter", sans-serif;
        color: #FFFFFF;
        background: linear-gradient(135deg, #FF7A18, #FF375F);
        box-shadow: 0 12px 26px rgba(255, 55, 95, 0.28);
      }

      .tl-access-feedback__body {
        min-width: 0;
      }

      .tl-access-feedback__title {
        margin: 0 0 4px;
        font: 700 0.96rem/1.2 "Inter", sans-serif;
      }

      .tl-access-feedback__message {
        margin: 0;
        color: var(--txt-sec, #65656A);
        font: 500 0.92rem/1.45 "Inter", sans-serif;
      }

      html[data-theme="dark"] .tl-access-feedback__message {
        color: rgba(255, 255, 255, 0.72);
      }
    `;

    document.head.appendChild(style);
    accessNoticeStyleInjected = true;
  }

  function ensureAccessNoticeHost() {
    ensureAccessNoticeStyles();

    if (accessNoticeHost && accessNoticeHost.isConnected) {
      return accessNoticeHost;
    }

    accessNoticeHost = document.getElementById(ACCESS_NOTICE_ID);
    if (accessNoticeHost) {
      return accessNoticeHost;
    }

    accessNoticeHost = document.createElement("div");
    accessNoticeHost.id = ACCESS_NOTICE_ID;
    accessNoticeHost.setAttribute("aria-live", "polite");
    accessNoticeHost.setAttribute("aria-atomic", "true");
    document.body.appendChild(accessNoticeHost);
    return accessNoticeHost;
  }

  function showAccessNotice(message) {
    if (!document.body) return;

    const host = ensureAccessNoticeHost();
    host.textContent = "";

    const toast = document.createElement("div");
    toast.className = "tl-access-feedback__toast";

    const icon = document.createElement("div");
    icon.className = "tl-access-feedback__icon";
    icon.textContent = "!";

    const body = document.createElement("div");
    body.className = "tl-access-feedback__body";

    const title = document.createElement("p");
    title.className = "tl-access-feedback__title";
    title.textContent = "Sem acesso";

    const text = document.createElement("p");
    text.className = "tl-access-feedback__message";
    text.textContent = message;

    body.appendChild(title);
    body.appendChild(text);
    toast.appendChild(icon);
    toast.appendChild(body);
    host.appendChild(toast);

    window.requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    if (accessNoticeTimer) {
      window.clearTimeout(accessNoticeTimer);
    }

    accessNoticeTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => {
        if (toast.parentNode === host) {
          host.removeChild(toast);
        }
      }, 220);
    }, 3200);
  }

  function describeProtectedArea(link, permission) {
    const label = link.querySelector(".nav-text")?.textContent?.trim();
    if (label) {
      return `Você não tem acesso a ${label}.`;
    }

    if (permission === "rh.acesso") {
      return "Você não tem acesso a Gente e Gestão.";
    }

    if (permission === "rh.admin.acessos.view" || permission === "administracao.view") {
      return "Você não tem acesso à Administração.";
    }

    if (permission === "dashboard.comercial.view") {
      return "Você não tem acesso ao Dashboard Comercial.";
    }

    if (permission === "maquina.vendas.dashboard.view") {
      return "Você não tem acesso ao Aprovador de Vendas.";
    }

    if (isMetasPermission(permission)) {
      return "Você não tem acesso a Abertura e Objetivos.";
    }

    if (permission === "funcionarios.acesso.view") {
      return "Você não tem acesso a Funcionários.";
    }

    if (permission === "imoveis.view") {
      return "Você não tem acesso ao módulo de Imóveis.";
    }

    return "Você não tem acesso a esta função.";
  }

  function describeProtectedPermission(permission) {
    if (permission === "rh.acesso") {
      return "Você não tem acesso a Gente & Gestão.";
    }

    if (permission === "rh.admin.acessos.view" || permission === "administracao.view") {
      return "Você não tem acesso a Administração.";
    }

    if (permission === "dashboard.comercial.view") {
      return "Você não tem acesso ao Dashboard Comercial.";
    }

    if (permission === "maquina.vendas.dashboard.view") {
      return "Você não tem acesso ao Aprovador de Vendas.";
    }

    if (permission === "funcionarios.acesso.view") {
      return "Você não tem acesso a Funcionários.";
    }

    if (permission === "imoveis.view") {
      return "Você não tem acesso ao módulo de Imóveis.";
    }

    return "Você não tem acesso a esta função.";
  }

  function flushPendingAccessNotice() {
    const message = consumeAccessNotice();
    if (!message) return;

    const render = () => showAccessNotice(message);
    if (document.body) {
      render();
      return;
    }

    document.addEventListener("DOMContentLoaded", render, { once: true });
  }

  function getApprovalPopupStorageKey() {
    const loginAt = readStorage(window.sessionStorage, LOGIN_AT_KEY) || "sessão";
    return `${APPROVAL_POPUP_STORAGE_KEY}:${loginAt}`;
  }

  function ensureApprovalPopupStyles() {
    if (approvalPopupStyleInjected) return;

    const style = document.createElement("style");
    style.textContent = `
      #${APPROVAL_POPUP_ID} {
        position: fixed;
        inset: 0;
        z-index: 10010;
        display: none;
      }

      #${APPROVAL_POPUP_ID}.is-visible {
        display: block;
      }

      .tl-approval-popup__backdrop {
        position: absolute;
        inset: 0;
        background: rgba(7, 13, 24, 0.44);
        backdrop-filter: blur(4px);
      }

      .tl-approval-popup__panel {
        position: relative;
        width: min(560px, calc(100vw - 32px));
        margin: 8vh auto 0;
        border-radius: 28px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 28px 70px rgba(15, 23, 42, 0.2);
        color: #122033;
        overflow: hidden;
      }

      html[data-theme="dark"] .tl-approval-popup__panel {
        background: rgba(9, 18, 30, 0.96);
        border-color: rgba(255, 255, 255, 0.08);
        color: rgba(240, 246, 252, 0.96);
      }

      .tl-approval-popup__head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 22px 24px 14px;
      }

      .tl-approval-popup__eyebrow {
        margin: 0 0 8px;
        color: #0f7bff;
        font: 700 0.74rem/1 "JetBrains Mono", monospace;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .tl-approval-popup__title {
        margin: 0;
        font: 800 1.42rem/1.1 "Inter", sans-serif;
      }

      .tl-approval-popup__close {
        width: 40px;
        height: 40px;
        border: 0;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.06);
        color: inherit;
        cursor: pointer;
        font-size: 1.4rem;
        line-height: 1;
      }

      html[data-theme="dark"] .tl-approval-popup__close {
        background: rgba(255, 255, 255, 0.08);
      }

      .tl-approval-popup__body {
        padding: 0 24px 24px;
      }

      .tl-approval-popup__copy {
        margin: 0;
        color: rgba(17, 24, 39, 0.68);
        font: 500 0.98rem/1.55 "Inter", sans-serif;
      }

      html[data-theme="dark"] .tl-approval-popup__copy {
        color: rgba(233, 240, 250, 0.76);
      }

      .tl-approval-popup__count {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 14px;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(15, 123, 255, 0.12);
        color: #0f7bff;
        font: 800 0.9rem/1 "Inter", sans-serif;
      }

      .tl-approval-popup__list {
        display: grid;
        gap: 10px;
        margin: 18px 0 0;
      }

      .tl-approval-popup__item {
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: rgba(248, 250, 252, 0.94);
      }

      html[data-theme="dark"] .tl-approval-popup__item {
        border-color: rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.05);
      }

      .tl-approval-popup__item strong,
      .tl-approval-popup__item span {
        display: block;
      }

      .tl-approval-popup__item span {
        margin-top: 4px;
        color: rgba(17, 24, 39, 0.66);
        font-size: 0.9rem;
      }

      html[data-theme="dark"] .tl-approval-popup__item span {
        color: rgba(233, 240, 250, 0.7);
      }

      .tl-approval-popup__actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        flex-wrap: wrap;
        margin-top: 20px;
      }

      .tl-approval-popup__actions button {
        border: 0;
        border-radius: 16px;
        padding: 12px 18px;
        cursor: pointer;
        font: 700 0.95rem/1 "Inter", sans-serif;
      }

      .tl-approval-popup__actions .is-secondary {
        background: rgba(15, 23, 42, 0.08);
        color: inherit;
      }

      html[data-theme="dark"] .tl-approval-popup__actions .is-secondary {
        background: rgba(255, 255, 255, 0.08);
      }

      .tl-approval-popup__actions .is-primary {
        background: linear-gradient(135deg, #0f7bff, #2ac7e2);
        color: #fff;
      }
    `;
    document.head.appendChild(style);
    approvalPopupStyleInjected = true;
  }

  function ensureApprovalPopupHost() {
    ensureApprovalPopupStyles();

    if (approvalPopupHost && approvalPopupHost.isConnected) {
      return approvalPopupHost;
    }

    approvalPopupHost = document.getElementById(APPROVAL_POPUP_ID);
    if (approvalPopupHost) {
      return approvalPopupHost;
    }

    approvalPopupHost = document.createElement("div");
    approvalPopupHost.id = APPROVAL_POPUP_ID;
    document.body.appendChild(approvalPopupHost);
    return approvalPopupHost;
  }

  function closeApprovalPopup() {
    if (!approvalPopupHost) return;
    approvalPopupHost.classList.remove("is-visible");
    approvalPopupHost.innerHTML = "";
  }

  function showApprovalPopup(totalPendentes, itens) {
    if (!document.body || !totalPendentes) return;

    const host = ensureApprovalPopupHost();
    const itensHtml = (Array.isArray(itens) ? itens : []).slice(0, 3).map((item) => {
      const cliente = escapeHtml(firstFilled(item?.cliente?.nome_completo, "Cliente não informado"));
      const imovel = escapeHtml(firstFilled(item?.imovel?.titulo, "Imóvel não informado"));
      const solicitadoEm = item?.solicitado_em ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(item.solicitado_em)) : "Agora";
      return `
        <div class="tl-approval-popup__item">
          <strong>${cliente}</strong>
          <span>${imovel}</span>
          <span>Solicitada em ${escapeHtml(solicitadoEm)}</span>
        </div>`;
    }).join("");

    host.innerHTML = `
      <div class="tl-approval-popup__backdrop" data-action="close-approval-popup"></div>
      <section class="tl-approval-popup__panel" role="dialog" aria-modal="true" aria-labelledby="tlApprovalPopupTitle">
        <div class="tl-approval-popup__head">
          <div>
            <p class="tl-approval-popup__eyebrow">Fila de gestão</p>
            <h2 id="tlApprovalPopupTitle" class="tl-approval-popup__title">Você tem aprovações pendentes</h2>
          </div>
          <button class="tl-approval-popup__close" type="button" aria-label="Fechar" data-action="close-approval-popup">×</button>
        </div>
        <div class="tl-approval-popup__body">
          <p class="tl-approval-popup__copy">Há operações no simulador aguardando decisão do gestor. Enquanto isso, o corretor não consegue concluir nem reservar a unidade.</p>
          <div class="tl-approval-popup__count">${totalPendentes} pendência${totalPendentes > 1 ? "s" : ""} aguardando análise</div>
          ${itensHtml ? `<div class="tl-approval-popup__list">${itensHtml}</div>` : ""}
          <div class="tl-approval-popup__actions">
            <button class="is-secondary" type="button" data-action="close-approval-popup">Depois</button>
            <button class="is-primary" type="button" data-action="open-approval-queue">Avaliar agora</button>
          </div>
        </div>
      </section>
    `;
    host.classList.add("is-visible");

    host.querySelectorAll("[data-action='close-approval-popup']").forEach((button) => {
      button.addEventListener("click", closeApprovalPopup);
    });

    host.querySelector("[data-action='open-approval-queue']")?.addEventListener("click", () => {
      closeApprovalPopup();
      window.location.assign(buildPortalPath("/administracao/aprovacoes"));
    });
  }

  async function maybeShowPendingApprovalPopup() {
    if (isPublicEntryPath(window.location.pathname)) return;
    const currentPath = normalizePath(window.location.pathname);
    const approvalPopupBlockedPaths = [
      "/administracao/aprovacoes",
      "/administracao/acessos",
      "/administracao/funcionarios",
      "/comercial/clientes",
      "/comercial/imoveis",
      "/comercial/imoveis/cadastro",
      "/comercial/simulador",
    ];
    const metasPath = normalizePath(buildPortalPath("/metas"));
    if (
      approvalPopupBlockedPaths.some((path) => {
        const blockedPath = normalizePath(buildPortalPath(path));
        return currentPath === blockedPath || currentPath.startsWith(`${blockedPath}/`);
      })
      || currentPath === metasPath
      || currentPath.startsWith(`${metasPath}/`)
    ) {
      return;
    }

    const storageKey = getApprovalPopupStorageKey();
    if (readStorage(window.sessionStorage, storageKey) === "shown") {
      return;
    }

    const allowed = await canAccessPermission("aprovacoes.excecao.manage");
    if (allowed !== true) return;

    const tokenAtual = readStorage(window.sessionStorage, TOKEN_KEY);
    if (!tokenAtual) return;

    try {
      const response = await fetch(ENDPOINT_APROVACOES_RESUMO, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${tokenAtual}`,
        },
      });

      if (!response.ok) return;

      const payload = await safeJsonResponse(response);
      const totalPendentes = Number(payload?.total_pendentes || 0);
      if (totalPendentes <= 0) return;

      writeSession(storageKey, "shown");
      const render = () => showApprovalPopup(totalPendentes, payload?.itens || []);
      if (document.body) {
        render();
      } else {
        document.addEventListener("DOMContentLoaded", render, { once: true });
      }
    } catch {}
  }

  async function guardProtectedPage() {
    if (!REQUIRED_PERMISSION || isPublicEntryPath(window.location.pathname)) {
      finishAccessCheck();
      return;
    }

    if (shouldAllowLocalFallbackPage() && !readStorage(window.sessionStorage, TOKEN_KEY)) {
      finishAccessCheck();
      return;
    }

    try {
      const allowed = await canAccessPermission(REQUIRED_PERMISSION, { revalidate: true });

      if (allowed === true) {
        finishAccessCheck();
        return;
      }

      if (allowed === false) {
        const message = describeProtectedPermission(REQUIRED_PERMISSION);
        queueAccessNotice(message);
        const fallbackPath = buildPortalPath(ACCESS_FALLBACK_PATH || "/inicio");

        if (normalizePath(window.location.pathname) !== normalizePath(fallbackPath)) {
          window.location.replace(fallbackPath);
          return;
        }

        finishAccessCheck();
        showAccessNotice(message);
        return;
      }

      finishAccessCheck();
      showAccessNotice("Não foi possível validar seu acesso agora. Tente novamente em instantes.");
    } catch {
      finishAccessCheck();
      showAccessNotice("Não foi possível validar seu acesso agora. Tente novamente em instantes.");
    }
  }

  function bindProtectedNavigation() {
    document.addEventListener("click", async (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest("a[data-permission][href]");
      if (!link) return;
      if (link.target && link.target !== "_self") return;

      const permission = String(link.getAttribute("data-permission") || "").trim();
      if (!permission) return;

      event.preventDefault();

      const allowed = await canAccessPermission(permission, { revalidate: true });
      if (allowed === true) {
        window.location.assign(link.href);
        return;
      }

      if (allowed === false) {
        link.blur();
        showAccessNotice(describeProtectedArea(link, permission));
        return;
      }

      showAccessNotice("Não foi possível validar seu acesso agora. Tente novamente em instantes.");
    }, true);
  }

  const token = readStorage(window.sessionStorage, TOKEN_KEY);
  if (!token && !isPublicEntryPath(window.location.pathname) && !shouldAllowLocalFallbackPage()) {
    window.location.replace(getLoginPath());
  }

  window.SevenLMConnectPortalPreload = {
    hasLiteEffectsMode: () => root.classList.contains(LITE_EFFECTS_CLASS)
  };

  window.SevenLMConnectPortalState.clearAuthSession = clearAuthSession;
  window.SevenLMConnectPortalState.logout = forcePortalLogout;

  bindGlobalLogout();
  document.addEventListener("DOMContentLoaded", initPortalSidebar, { once: true });
  flushPendingAccessNotice();
  bindProtectedNavigation();
  void guardProtectedPage();
  void maybeShowPendingApprovalPopup();
})();
