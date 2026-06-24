(function () {
  "use strict";

  const shared = window.SevenLMConnectOperacoes;
  const portalState = window.SevenLMConnectPortalState || null;
  const ACCESS_NOTICE_STORAGE_KEY = ["sevenlm_connect_pending_access_notice", "sevenlm_connect_pending_access_notice"];

  function meta(name, fallback) {
    const element = document.querySelector(`meta[name="${name}"]`);
    return (element && element.getAttribute("content")) ? element.getAttribute("content") : fallback;
  }

  function writeSession(key, value) {
    try {
      const keys = Array.isArray(key) ? key : [key];
      keys.forEach((item) => window.sessionStorage.setItem(item, value));
    } catch {}
  }

  function queueAccessNotice(message) {
    if (!message) return;
    writeSession(ACCESS_NOTICE_STORAGE_KEY, message);
  }

  async function safePayload(response) {
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const text = await response.text().catch(() => "");
    if (!text) return {};
    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(text);
      } catch {
        return { detail: "Resposta JSON inválida recebida da API." };
      }
    }
    return { detail: text };
  }

  function isFormData(value) {
    return typeof FormData !== "undefined" && value instanceof FormData;
  }

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  async function apiRequest(url, options = {}) {
    const token = shared.getAccessToken();
    const headers = {
      Accept: "application/json",
      ...(options.headers || {}),
    };

    let body = options.body;
    if (body !== undefined && body !== null && !isFormData(body) && isPlainObject(body)) {
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
      body = JSON.stringify(body);
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      ...options,
      headers,
      body,
    });

    const payload = await safePayload(response);

    if (response.status === 401) {
      shared.redirectToLogin();
      throw new Error(payload?.detail || "Sessão expirada.");
    }

    if (!response.ok) {
      const error = new Error(payload?.detail || payload?.mensagem || "Falha ao processar a requisição.");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async function downloadFile(url, options = {}) {
    const token = shared.getAccessToken();
    const headers = {
      Accept: "*/*",
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

    if (response.status === 401) {
      shared.redirectToLogin();
      throw new Error("Sessão expirada.");
    }

    if (!response.ok) {
      const payload = await safePayload(response);
      const error = new Error(payload?.detail || payload?.mensagem || "Falha ao preparar o arquivo para download.");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    let filename = "";
    const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const plainMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
    if (utfMatch?.[1]) {
      try {
        filename = decodeURIComponent(utfMatch[1]);
      } catch {
        filename = utfMatch[1];
      }
    } else if (plainMatch?.[1]) {
      filename = plainMatch[1];
    }

    return {
      blob,
      filename,
      mediaType: response.headers.get("content-type") || "",
    };
  }

  function extractUser(payload) {
    return payload?.usuario || payload?.user || payload?.data || payload || null;
  }

  async function ensureUser(force = false) {
    const cached = shared.getStoredUser();
    if (!force && cached?.acessos_portal) {
      return cached;
    }

    const payload = await apiRequest(meta("sevenlm-connect-endpoint-me", "/api/me"), { method: "GET" });
    const user = extractUser(payload) || cached;

    if (user && portalState?.cacheUser) {
      portalState.cacheUser(user);
    }

    return user;
  }

  function hasPermission(user, permission) {
    if (!user || !permission) return false;
    const accessMap = user.acessos_portal && typeof user.acessos_portal === "object"
      ? user.acessos_portal
      : null;

    if (accessMap && Object.prototype.hasOwnProperty.call(accessMap, permission)) {
      return Boolean(accessMap[permission]);
    }

    if (permission === "administracao.view") {
      return Boolean(user.pode_ver);
    }

    if (permission === "administracao.manage") {
      return Boolean(user.pode_gerenciar);
    }

    return false;
  }

  function canManagePropertyRegistration(user) {
    return [
      "imoveis.media.manage",
      "imoveis.delete",
      "administracao.manage",
      "administracao.view",
      "GERENCIAR_ACESSO",
      "ACESSO_TOTAL",
    ].some((permission) => hasPermission(user, permission));
  }

  function buildEndpoint(template, values = {}) {
    return String(template || "").replace(/\{([^}]+)\}/g, (_, key) => encodeURIComponent(values[key] ?? ""));
  }

  function toggleHidden(element, shouldHide) {
    if (!element) return;
    element.hidden = Boolean(shouldHide);
    if (shouldHide) {
      element.setAttribute("aria-hidden", "true");
      return;
    }
    element.removeAttribute("aria-hidden");
  }

  function formatCurrency(value) {
    if (value === null || value === undefined || value === "") return "-";
    const number = Number(value);
    if (Number.isNaN(number)) return String(value);
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    }).format(number);
  }

  function formatSize(bytes) {
    const total = Number(bytes || 0);
    if (!total) return "-";
    if (total >= 1024 * 1024 * 1024) return `${(total / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (total >= 1024 * 1024) return `${(total / (1024 * 1024)).toFixed(1)} MB`;
    if (total >= 1024) return `${(total / 1024).toFixed(1)} KB`;
    return `${total} B`;
  }

  function showInlineMessage(container, variant, message) {
    if (!container) return;
    if (!message) {
      container.innerHTML = "";
      return;
    }

    let texto = message;
    if (typeof message === "object") {
      texto = message?.detail || message?.mensagem || message?.message || JSON.stringify(message);
    }

    container.innerHTML = `
      <div class="tl-imoveis-feedback__item" data-variant="${shared.escapeHtml(variant || "info")}">
        ${shared.escapeHtml(String(texto))}
      </div>
    `;
  }

  window.SevenLMConnectImoveis = {
    apiRequest,
    buildEndpoint,
    buildPortalPath: shared.buildPortalPath,
    downloadFile,
    ensureUser,
    escapeHtml: shared.escapeHtml,
    fillUserbox: shared.fillUserbox,
    formatCurrency,
    formatDate: shared.formatDate,
    formatDateTime: shared.formatDateTime,
    formatSize,
    canManagePropertyRegistration,
    hasPermission,
    initChrome: shared.initChrome,
    meta,
    queueAccessNotice,
    showInlineMessage,
    toggleHidden,
  };
})();
