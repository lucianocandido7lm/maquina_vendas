"use strict";

function normalizarTexto(valor) {
  return String(valor || "").trim();
}

function normalizarBasePath(valor) {
  const texto = normalizarTexto(valor);
  if (!texto || texto === "/") return "";
  return `/${texto.replace(/^\/+|\/+$/g, "")}`;
}

function aplicarBasePath(basePath, caminho = "/") {
  const rota = normalizarTexto(caminho) || "/";
  const caminhoNormalizado = rota.startsWith("/") ? rota : `/${rota}`;
  if (!basePath) {
    return caminhoNormalizado;
  }

  return caminhoNormalizado === "/" ? basePath : `${basePath}${caminhoNormalizado}`;
}

function detectarItemAtivo(caminhoPublico = "/") {
  const caminho = normalizarTexto(caminhoPublico).toLowerCase();

  if (
    caminho.includes("/01_paginas/administracao/aprovacoes.html") ||
    caminho.includes("/administracao/aprovacoes")
  ) {
    return "aprovações";
  }

  if (
    caminho.includes("/01_paginas/administracao/funcionarios.html") ||
    caminho.includes("/administracao/funcionarios")
  ) {
    return "funcionarios";
  }

  if (
    caminho.includes("/maq-credito") ||
    caminho.includes("/01_paginas/maqcredito/")
  ) {
    return "maq_credito";
  }

  if (
    caminho.includes("/gente-cultura/") ||
    caminho.includes("/gente-cultura/dashboard") ||
    caminho.includes("/dashboard-gc") ||
    caminho.includes("/01_paginas/gentecultura/dashboard.html")
  ) {
    return "dashboard_gc";
  }

  if (
    caminho.includes("/01_paginas/metas/") ||
    caminho.includes("/metas")
  ) {
    return "metas";
  }

  if (
    caminho.includes("/01_paginas/administracao/") ||
    caminho.includes("/administracao/")
  ) {
    return "acessos";
  }

  if (
    caminho.includes("/comercial/maquina-vendas/dashboard") ||
    caminho.includes("/01_paginas/comercial/dashboard_maquina_vendas.html")
  ) {
    return "comercial";
  }

  if (
    caminho.includes("/comercial/comissionamento") ||
    caminho.includes("/01_paginas/comercial/comissionamento.html")
  ) {
    return "comissionamento";
  }

  if (
    caminho.includes("/comercial/dashboard") ||
    caminho.includes("/01_paginas/comercial/dashboard.html")
  ) {
    return "dashboard_comercial";
  }

  if (
    caminho.includes("/comercial") ||
    caminho.includes("/imoveis") ||
    caminho.includes("/01_paginas/imoveis/") ||
    caminho.includes("/clientes") ||
    caminho.includes("/01_paginas/clientes/") ||
    caminho.includes("/plataforma") ||
    caminho.includes("/01_paginas/operacoes/")
  ) {
    return "comercial";
  }

  return "inicio";
}

function classeItem(ativo) {
  return ativo ? "tl-nav__item js-magnetic is-active" : "tl-nav__item js-magnetic";
}

function renderizarLinkItem(config, itemAtivo) {
  const ativo = config.chave === itemAtivo;
  const href = config.href ? ` href="${config.href}"` : "";
  const ariaCurrent = ativo ? ' aria-current="page"' : "";
  const permission = config.permission ? ` data-permission="${config.permission}"` : "";
  const id = config.id ? ` id="${config.id}"` : "";

  return `          <a class="${classeItem(ativo)}"${href}${id} data-tooltip="${config.tooltip}"${permission}${ariaCurrent} style="--nav-color: ${config.color};">
            <div class="nav-icon">
              ${config.icone}
            </div>
            <span class="nav-text">${config.rotulo}</span>
          </a>`;
}

function renderizarSidebarPortal(caminhoPublico = "/", opcoes = {}) {
  const itemAtivo = detectarItemAtivo(caminhoPublico);
  const basePath = normalizarBasePath(opcoes.basePath);
  const logoSrcLight = aplicarBasePath(basePath, "/02_recursos/03_imagens/logo_7lm.svg");
  const logoSrcDark = aplicarBasePath(basePath, "/02_recursos/03_imagens/logo_7lm_dark.png");
  const itens = [
    {
      chave: "inicio",
      href: aplicarBasePath(basePath, "/inicio"),
      tooltip: "Início",
      rotulo: "Início",
      color: "#22C55E",
      icone:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
    },
    {
      chave: "dashboard_comercial",
      href: aplicarBasePath(basePath, "/comercial/dashboard"),
      tooltip: "Dashboard Comercial",
      rotulo: "Dashboard Comercial",
      permission: "dashboard.comercial.view",
      color: "#0EA5E9",
      icone:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5"></path><path d="M4 19h16"></path><rect x="7" y="10" width="3" height="6" rx="1"></rect><rect x="12" y="7" width="3" height="9" rx="1"></rect><rect x="17" y="4" width="3" height="12" rx="1"></rect></svg>',
    },
    {
      chave: "comercial",
      href: aplicarBasePath(basePath, "/comercial/clientes"),
      tooltip: "Aprovador de Vendas",
      rotulo: "Aprovador de Vendas",
      color: "#F59E0B",
      icone:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-6 9 6"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-5h6v5"></path><path d="M7.5 13h3"></path><path d="M13.5 13h3"></path></svg>',
    },
    {
      chave: "maq_credito",
      href: aplicarBasePath(basePath, "/maq-credito"),
      tooltip: "Gestão da Reserva",
      rotulo: "Gestão da Reserva",
      permission: "maq.credito.view",
      color: "#2563EB",
      icone:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 9h18"></path><path d="M7 14h4"></path><path d="M15 14h2"></path></svg>',
    },
    {
      chave: "dashboard_gc",
      href: aplicarBasePath(basePath, "/gente-cultura/dashboard"),
      tooltip: "Pessoas & Cultura",
      rotulo: "Pessoas & Cultura",
      permission: "metas.resultados.view",
      color: "#14B8A6",
      icone:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"></circle><circle cx="5" cy="18" r="3"></circle><circle cx="19" cy="18" r="3"></circle><path d="M10.6 7.7 6.4 15.3"></path><path d="M13.4 7.7l4.2 7.6"></path><path d="M8 18h8"></path></svg>',
    },
    {
      chave: "metas",
      href: aplicarBasePath(basePath, "/metas/dashboard"),
      tooltip: "Abertura e Objetivos",
      rotulo: "Abertura e Objetivos",
      permission: "metas.resultados.view",
      color: "#0EA5E9",
      icone:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"></path><path d="M3 12h18"></path><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle></svg>',
    },
    {
      chave: "comissionamento",
      href: aplicarBasePath(basePath, "/comercial/comissionamento"),
      tooltip: "Comissionamento",
      rotulo: "Comissionamento",
      permission: "comissionamento.view",
      color: "#16A34A",
      icone:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"></rect><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path><path d="M12 11v5"></path><path d="M9.5 13.5h5"></path></svg>',
    },
    {
      chave: "aprovações",
      secao: "sistema",
      href: aplicarBasePath(basePath, "/administracao/aprovacoes"),
      id: "menuAprovacoes",
      tooltip: "Aprovações",
      rotulo: "Aprovações",
      permission: "aprovacoes.excecao.view",
      color: "#2563EB",
      icone:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 12l2 2 4-4"></path><path d="M21 12c0 4.97-4.03 9-9 9S3 16.97 3 12 7.03 3 12 3c1.72 0 3.33.48 4.7 1.32"></path><path d="M21 5v6h-6"></path></svg>',
    },
    {
      chave: "acessos",
      secao: "sistema",
      href: aplicarBasePath(basePath, "/administracao/acessos"),
      id: "menuAcessos",
      tooltip: "Acessos",
      rotulo: "Acessos",
      permission: "administracao.view",
      color: "#8B5CF6",
      icone:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z"></path><path d="M9.5 12.5l1.8 1.8 3.7-4.3"></path></svg>',
    },
    {
      chave: "funcionarios",
      secao: "sistema",
      href: aplicarBasePath(basePath, "/administracao/funcionarios"),
      id: "menuFuncionarios",
      tooltip: "Cadastro Equipe",
      rotulo: "Cadastro Equipe",
      permission: "funcionarios.acesso.view",
      color: "#14B8A6",
      icone:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    },
  ];
  const itensPrincipais = itens.filter((item) => item.secao !== "sistema");
  const itensSistema = itens.filter((item) => item.secao === "sistema");

  return `    <aside class="tl-sidebar glass-panel hyper-glass" id="sidebar">
      <button
        id="btnToggleSidebar"
        class="tl-btn-toggle"
        type="button"
        aria-label="Recolher menu lateral"
        aria-controls="sidebar"
        aria-expanded="true"
        title="Recolher menu"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11.5 5.5L7.5 10l4 4.5"></path>
        </svg>
      </button>

      <div class="tl-brand tl-brand--logo-only" aria-label="7LM">
        <div class="tl-brand-icon">
          <img class="tl-brand-logo-image tl-brand-logo--light" src="${logoSrcLight}" alt="7LM" />
          <img class="tl-brand-logo-image tl-brand-logo--dark" src="${logoSrcDark}" alt="7LM" />
        </div>
      </div>

      <div class="tl-nav-scroll">
        <nav class="tl-nav">
          <span class="tl-nav__label mono-font">Principal</span>

${itensPrincipais.map((item) => renderizarLinkItem(item, itemAtivo)).join("\n")}

          <span class="tl-nav__label mono-font" style="margin-top: 24px;">Sistema</span>

${itensSistema.map((item) => renderizarLinkItem(item, itemAtivo)).join("\n")}

          <button class="tl-nav__item js-magnetic" type="button" id="btnLogout" data-action="portal-logout" data-tooltip="Sair" aria-label="Sair do portal" style="--nav-color: #FF453A;">
            <div class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </div>
            <span class="nav-text">Sair</span>
          </button>
        </nav>
      </div>
    </aside>`;
}

module.exports = {
  renderizarSidebarPortal,
};
