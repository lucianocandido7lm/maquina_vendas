(function () {
  "use strict";

  const root = document.documentElement;
  const TOKEN_KEY = ["sevenlm_connect_token_de_acesso", "sevenlm_connect_token_de_acesso"];
  const REFRESH_KEY = ["sevenlm_connect_token_de_renovacao", "sevenlm_connect_token_de_renovacao"];
  const USER_KEY = ["sevenlm_connect_usuario", "sevenlm_connect_usuario"];
  const LOGIN_AT_KEY = ["sevenlm_connect_login_at", "sevenlm_connect_login_at"];
  const LOGIN_PROVIDER_KEY = ["sevenlm_connect_provedor_login", "sevenlm_connect_provedor_login"];
  const USER_VALIDATED_AT_KEY = ["sevenlm_connect_usuario_validado_em", "sevenlm_connect_usuario_validado_em"];
  const USER_CACHE_MAX_AGE_MS = 120000;
  const ACCESS_NOTICE_ID = "tl-access-feedback";
  const ACCESS_NOTICE_STORAGE_KEY = ["sevenlm_connect_pending_access_notice", "sevenlm_connect_pending_access_notice"];
  const SIDEBAR_ANIMATION_CLASS = "sidebar-is-animating";
  const SIDEBAR_COLLAPSED_CLASS = "sidebar-is-collapsed";
  const SIDEBAR_STORAGE_KEY = "tl.sidebar";
  const LITE_EFFECTS_CLASS = "tl-lite-effects";
  let sidebarAnimationTimer = null;

  function meta(name, fallback) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return (el && el.getAttribute("content")) ? el.getAttribute("content") : fallback;
  }

  const ENDPOINT_ME = meta("sevenlm-connect-endpoint-me", "/api/me");
  const REQUIRED_PERMISSION = String(meta("sevenlm-connect-required-permission", "") || "").trim();
  const ACCESS_FALLBACK_PATH = String(meta("sevenlm-connect-access-fallback", "/inicio") || "/inicio").trim();

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
  }

  const savedTheme = readStorage(window.localStorage, "tl.theme") || readCookie("tl.theme") || "dark";
  root.setAttribute("data-theme", persistTheme(savedTheme));

  function shouldUseLiteEffects() {
    try {
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

  if (shouldUseLiteEffects()) {
    root.classList.add(LITE_EFFECTS_CLASS);
  }

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

  function initPortalSidebar() {
    bindSidebarToggle();
    bindSidebarMagneticItems();
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
  }

  function redirectToLogin() {
    clearAuthSession();
    window.location.replace(getLoginPath());
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
    return payload?.usuario || payload?.user || payload?.data || payload || null;
  }

  function hasAccessMap(user) {
    return Boolean(user && typeof user === "object" && user.acessos_portal && typeof user.acessos_portal === "object");
  }

  function resolvePortalPermission(user, permission) {
    if (!user || typeof user !== "object") return null;

    const accessMap = hasAccessMap(user) ? user.acessos_portal : null;
    if (accessMap && Object.prototype.hasOwnProperty.call(accessMap, permission)) {
      return Boolean(accessMap[permission]);
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
        const response = await fetch(ENDPOINT_ME, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${tokenAtual}`,
          },
        });

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
    if (!revalidate && allowed !== null) {
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

    if (permission === "imoveis.view") {
      return "Voce nao tem acesso ao modulo de Imoveis.";
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

    if (permission === "imoveis.view") {
      return "Voce nao tem acesso ao modulo de Imoveis.";
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

  async function guardProtectedPage() {
    if (!REQUIRED_PERMISSION || isPublicEntryPath(window.location.pathname)) {
      root.classList.remove("tl-page-access-checking");
      return;
    }

    try {
      const allowed = await canAccessPermission(REQUIRED_PERMISSION, { revalidate: true });

      if (allowed === true) {
        root.classList.remove("tl-page-access-checking");
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

        root.classList.remove("tl-page-access-checking");
        showAccessNotice(message);
        return;
      }

      root.classList.remove("tl-page-access-checking");
      showAccessNotice("Não foi possível validar seu acesso agora. Tente novamente em instantes.");
    } catch {
      root.classList.remove("tl-page-access-checking");
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
  if (!token && !isPublicEntryPath(window.location.pathname)) {
    window.location.replace(getLoginPath());
  }

  window.SevenLMConnectPortalPreload = {
    hasLiteEffectsMode: () => root.classList.contains(LITE_EFFECTS_CLASS)
  };

  document.addEventListener("DOMContentLoaded", initPortalSidebar, { once: true });
  flushPendingAccessNotice();
  bindProtectedNavigation();
  void guardProtectedPage();
})();
