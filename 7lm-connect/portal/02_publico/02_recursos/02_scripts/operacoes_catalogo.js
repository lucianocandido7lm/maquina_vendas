(function () {
  "use strict";

  const shared = window.SevenLMConnectOperacoes;
  const LOGIN_AT_KEYS = ["sevenlm_connect_login_at", "sevenlm_connect_login_at"];

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

  const el = {
    catalogo: document.getElementById("operacoesCatalogo"),
    summaryPrimary: document.getElementById("opsSummaryPrimary"),
    summarySecondary: document.getElementById("opsSummarySecondary"),
    lastAccess: document.getElementById("opsLastAccess"),
    lastAccessMeta: document.getElementById("opsLastAccessMeta"),
    kpiClientes: document.getElementById("opsKpiClientes"),
    kpiDashboards: document.getElementById("opsKpiDashboards"),
    kpiScenes: document.getElementById("opsKpiScenes"),
    kpiEscopo: document.getElementById("opsKpiEscopo"),
    catalogIntro: document.getElementById("opsCatalogIntro"),
  };

  const Abas_COMERCIAIS = [
  {
    badge: "Clientes",
    titulo: "Gestão de Clientes",
    resumo:
      "Primeira etapa do fluxo comercial: cadastro, simulação reservada, responsável pelo cliente e dados para simulação.",
    destaque: "1ª Aba",
    estatisticas: ["Cadastro", "Simulação Reservada", "Responsável"],
    acento: "#00B3DE",
    prioridade: "Início do Fluxo",
    href: shared.buildPortalPath("/comercial/clientes"),
    cta: "Abrir Clientes",
    permission: "imoveis.view",
  },
  {
    badge: "Simulador",
    titulo: "Simulador Comercial",
    resumo:
      "Segunda etapa: selecionar o cliente, analisar sugestões, reservar unidades e seguir até a venda.",
    destaque: "2ª Aba",
    estatisticas: ["Sugestões", "Reserva", "Venda"],
    acento: "#10B981",
    prioridade: "Análise Comercial",
    href: shared.buildPortalPath("/comercial/simulador"),
    cta: "Abrir Simulador",
    permission: "imoveis.view",
  },
  {
    badge: "Imóveis",
    titulo: "Cadastro, listagem e mídias",
    resumo:
      "Terceira etapa: consulta da base ativa, importação em lote e gerenciamento de fotos e vídeos.",
    destaque: "3ª Aba",
    estatisticas: ["Cadastro", "Listagem", "Mídias"],
    acento: "#00B3DE",
    prioridade: "Base de Unidades",
    href: shared.buildPortalPath("/comercial/imoveis"),
    cta: "Abrir Imóveis",
    permission: "imoveis.view",
  },
  ];

  function setText(node, value) {
    if (node) node.textContent = value;
  }

  function formatDateTime(value) {
    if (!value) return "Agora há pouco";
    return shared.formatDateTime(value);
  }

  function mountItem(item) {
    const permissionAttr = item.permission
      ? ` data-permission="${shared.escapeHtml(item.permission)}"`
      : "";
    const tags = item.estatisticas
      .map((tag) => `<span class="tl-ops-access-card__chip">${shared.escapeHtml(tag)}</span>`)
      .join("");

    return `
      <article class="tl-ops-access-card" style="--access-accent:${shared.escapeHtml(item.acento)};">
        <div class="tl-ops-access-card__head">
          <span class="tl-ops-access-card__badge mono-font">${shared.escapeHtml(item.badge)}</span>
          <span class="tl-ops-access-card__meta mono-font">${shared.escapeHtml(item.prioridade)}</span>
        </div>

        <div class="tl-ops-access-card__logo tl-ops-access-card__logo--fallback">
          <span>COM</span>
        </div>

        <div class="tl-ops-access-card__copy">
          <h3>${shared.escapeHtml(item.titulo)}</h3>
          <p>${shared.escapeHtml(item.resumo)}</p>
        </div>

        <div class="tl-ops-access-card__stats">
          <div class="tl-ops-access-card__stat">
            <span>Status</span>
            <strong>${shared.escapeHtml(item.destaque)}</strong>
          </div>
          <div class="tl-ops-access-card__stat">
            <span>Módulo</span>
            <strong>Comercial</strong>
          </div>
          <div class="tl-ops-access-card__stat">
            <span>Escopo</span>
            <strong>Unificado</strong>
          </div>
        </div>

        <div class="tl-ops-access-card__chips">
          ${tags}
        </div>

        <a class="tl-ops-access-card__cta" href="${shared.escapeHtml(item.href)}"${permissionAttr}>
          <span>${shared.escapeHtml(item.cta)}</span>
          <strong>${shared.escapeHtml(item.titulo)}</strong>
        </a>
      </article>
    `;
  }

  function mountPlaceholder() {
    return `
      <article class="tl-ops-empty-state">
        <span class="tl-ops-empty-state__badge mono-font">Expansão</span>
        <h3>Fluxo pronto para novas entregas</h3>
        <p>
          Clientes, Simulador e Imóveis ficam em uma sequência única.
          As próximas entregas entram aqui sem criar outro módulo paralelo.
        </p>
      </article>
    `;
  }

  function renderCatalog() {
    if (!el.catalogo) return;
    el.catalogo.innerHTML = `${Abas_COMERCIAIS.map(mountItem).join("")}${mountPlaceholder()}`;
  }

  function updateHeader() {
    setText(el.summaryPrimary, "3 abas ativas no Connect Comercial");
    setText(
      el.summarySecondary,
      "Fluxo organizado em Clientes, Simulador e Imóveis."
    );
    setText(el.lastAccess, formatDateTime(readSession(LOGIN_AT_KEYS)));
    setText(el.lastAccessMeta, "Fluxo organizado em Dashboard Comercial e Máquina de Vendas.");
    setText(el.kpiClientes, "03");
    setText(el.kpiDashboards, "Clientes");
    setText(el.kpiScenes, "Simulador");
    setText(el.kpiEscopo, "Pronto");
    setText(
      el.catalogIntro,
      "As abas abaixo seguem a sequência operacional: cliente, simulação e imóveis."
    );
  }

  function boot() {
    shared.initChrome();
    updateHeader();
    renderCatalog();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
