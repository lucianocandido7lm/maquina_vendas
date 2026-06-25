(function () {
  "use strict";

  const TOKEN_KEYS = ["sevenlm_connect_token_de_acesso", "sevenlm_connect_access_token"];
  const portalState = window.SevenLMConnectPortalState || null;

  function meta(name, fallback) {
    return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") || fallback;
  }

  function detectApiBaseUrl() {
    try {
      const { protocol, hostname, port, origin } = window.location;
      if ((hostname === "127.0.0.1" || hostname === "localhost") && port === "3000") {
        return `${protocol}//${hostname}:8000`;
      }
      return origin;
    } catch {
      return "http://127.0.0.1:8000";
    }
  }

  function resolveApiBaseUrl() {
    const configured = String(meta("sevenlm-connect-api-base-url", "") || "").trim();
    if (!configured) return detectApiBaseUrl();
    try {
      return new URL(configured, window.location.origin).origin;
    } catch {
      return detectApiBaseUrl();
    }
  }

  const API_BASE_URL = resolveApiBaseUrl();
  const ENDPOINTS = {
    me: meta("sevenlm-connect-endpoint-me", "/api/me"),
    referencias: meta("sevenlm-connect-endpoint-metas-referencias", "/api/metas/referencias"),
    dashboard: meta("sevenlm-connect-endpoint-metas-dashboard", "/api/metas/dashboard"),
    funcionarios: meta("sevenlm-connect-endpoint-admin-funcionarios", "/api/admin/funcionarios"),
    equipesFuncionarios: meta("sevenlm-connect-endpoint-admin-funcionario-equipes", "/api/admin/funcionarios/equipes"),
    vagasGc: meta("sevenlm-connect-endpoint-gc-vagas", "/api/gente-cultura/vagas"),
    forecastGc: meta("sevenlm-connect-endpoint-gc-forecast", "/api/gente-cultura/forecast"),
    forecastHistoricoGc: meta("sevenlm-connect-endpoint-gc-forecast-historico", "/api/gente-cultura/forecast/historico"),
    produtividadeGc: meta("sevenlm-connect-endpoint-gc-produtividade", "/api/gente-cultura/produtividade"),
  };

  const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const STATUS_COLORS = {
    completa: "#55c86a",
    abaixo: "#ffad2f",
    critica: "#ff4354",
    acima: "#2f83ff",
    sem_meta: "#9ca8b7",
    aberta: "#2f83ff",
    aguardando: "#ffad2f",
    encaminhamento: "#8b62f2",
    preenchida: "#55c86a",
    cancelada: "#9ca8b7",
    congelada: "#8b62f2",
    pendente: "#ffad2f",
    triagem: "#21b9d8",
    entrevistas: "#8b62f2",
    proposta: "#13b981",
    reprovada: "#ef4444",
  };
  const VAGA_STATUS = {
    PENDENTE_APROVACAO_REGIONAL: { label: "Pendente Regional", className: "is-pending", color: STATUS_COLORS.pendente },
    PENDENTE_APROVACAO: { label: "Pendente Diretoria", className: "is-pending", color: STATUS_COLORS.pendente },
    EM_ANDAMENTO: { label: "Em Andamento", className: "is-open", color: STATUS_COLORS.aberta },
    TRIAGEM: { label: "Triagem", className: "is-screening", color: STATUS_COLORS.triagem },
    ENTREVISTAS: { label: "Entrevistas", className: "is-interview", color: STATUS_COLORS.entrevistas },
    PROPOSTA: { label: "Proposta", className: "is-proposal", color: STATUS_COLORS.proposta },
    FECHADA: { label: "Fechada", className: "is-closed", color: STATUS_COLORS.preenchida },
    CANCELADA: { label: "Cancelada", className: "is-canceled", color: STATUS_COLORS.cancelada },
    CONGELADA: { label: "Congelada", className: "is-frozen", color: STATUS_COLORS.congelada },
    REPROVADA: { label: "Reprovada", className: "is-rejected", color: STATUS_COLORS.reprovada },
  };
  const VAGA_PRIORIDADE_NIVEIS = [
    { key: "NIVEL_MENOS_1", label: "-1" },
    { key: "NIVEL_0", label: "0" },
    { key: "NIVEL_1", label: "1" },
    { key: "NIVEL_2", label: "2" },
    { key: "NIVEL_3", label: "3" },
  ];
  const GC_TABS = {
    dashboard: { path: "/gente-cultura/dashboard", target: "dashboardGcRoot" },
    equipes: { path: "/gente-cultura/equipes", target: "visaoEquipesGc" },
    aprovacoes: { path: "/gente-cultura/aprovacoes", target: "visaoAprovacoesGc" },
    vagas: { path: "/gente-cultura/vagas", target: "visaoVagasGc" },
    pessoas: { path: "/gente-cultura/pessoas", target: "visaoPessoasGc" },
    produtividade: { path: "/gente-cultura/produtividade", target: "visaoProdutividadeGc" },
    comercial: { path: "/gente-cultura/comercial", target: "visaoComercialGc" },
    metricas: { path: "/gente-cultura/metricas", target: "visaoMetricasGc" },
    historico: { path: "/gente-cultura/historico", target: "historicoForecast" },
  };

  const state = {
    user: null,
    referencias: { usuarios: [], indicadores: [], equipes: [] },
    funcionarios: [],
    equipesCatalogo: [],
    vagasManuais: [],
    forecastsManuais: [],
    forecastHistorico: [],
    produtividade: { resumo: {}, coordenadores: [], gerentes: [], corretores: [], filtros: {}, status_sync: {} },
    produtividadeLoaded: false,
    comercial: { resumo: {}, coordenadores: [], gerentes: [], equipes: [], corretores: [], filtros: {}, status_sync: {} },
    comercialLoaded: false,
    dashboard: { resumo: {}, itens: [] },
    evolution: [],
    groups: [],
    tableGroups: [],
    filteredGroups: [],
    visibleGroups: [],
    tablePage: 1,
    tablePageSize: 10,
    activeTab: "dashboard",
    kpis: {},
  };

  let el = {};
  const customSelects = new Map();
  let activeCustomSelect = null;
  const datePickers = new Map();
  let activeDatePicker = null;
  let tableResizeTimer = null;
  let prioridadeVagaAtual = null;
  let produtividadeLoadingPromise = null;
  let comercialLoadingPromise = null;
  let comercialEquipeGroupsCache = null;
  let comercialCorretoresRankingCache = null;
  const COMERCIAL_CORRETORES_RENDER_LIMIT = 300;
  const COMERCIAL_CORRETORES_API_LIMIT = 300;
  const CUSTOM_SELECT_OPTION_RENDER_LIMIT = 400;

  function invalidateComercialRenderCache() {
    comercialEquipeGroupsCache = null;
    comercialCorretoresRankingCache = null;
  }

  function traceComercialStage(stage) {
    if (!window.__TL_GC_TRACE_COMERCIAL) return;
    const entry = { stage, time: Math.round(performance.now()) };
    window.__TL_GC_TRACE_LOG = [...(window.__TL_GC_TRACE_LOG || []), entry];
    console.debug(`[GC Comercial] ${stage}`);
  }

  function collectElements() {
    el = {
      nomeUsuario: document.getElementById("nomeUsuario"),
      metaUsuario: document.getElementById("metaUsuario"),
      userInitials: document.getElementById("userInitials"),
      btnTema: document.getElementById("btnTema"),
      dashboardRoot: document.getElementById("dashboardGcRoot"),
      gcTabs: [...document.querySelectorAll(".tl-gc-tab[data-gc-tab]")],
      btnToggleFiltros: document.getElementById("btnToggleFiltros"),
      filtrosAvancados: document.getElementById("filtrosAvancados"),
      filtroMes: document.getElementById("filtroMes"),
      filtroAno: document.getElementById("filtroAno"),
      filtroRegiao: document.getElementById("filtroRegiao"),
      filtroEquipe: document.getElementById("filtroEquipe"),
      filtroFoco: document.getElementById("filtroFoco"),
      filtroGestor: document.getElementById("filtroGestor"),
      filtroMetricaGap: document.getElementById("filtroMetricaGap"),
      gapCargoButtons: [...document.querySelectorAll("[data-gap-cargo]")],
      filtroRegiaoTabela: document.getElementById("filtroRegiaoTabela"),
      filtroTipoTabela: document.getElementById("filtroTipoTabela"),
      filtroGestorTabela: document.getElementById("filtroGestorTabela"),
      filtroEquipeTabela: document.getElementById("filtroEquipeTabela"),
      btnAtualizar: document.getElementById("btnAtualizar"),
      btnExportar: document.getElementById("btnExportar"),
      btnNovaVaga: document.getElementById("btnNovaVaga"),
      feedback: document.getElementById("feedbackGc"),
      buscaEquipe: document.getElementById("buscaEquipe"),
      kpiCorretores: document.getElementById("kpiCorretores"),
      kpiCorretoresDelta: document.getElementById("kpiCorretoresDelta"),
      kpiMetaCorretores: document.getElementById("kpiMetaCorretores"),
      kpiGapHeadcount: document.getElementById("kpiGapHeadcount"),
      kpiGapHeadcountInfo: document.getElementById("kpiGapHeadcountInfo"),
      kpiVagasAbertas: document.getElementById("kpiVagasAbertas"),
      kpiPendenciasCadastro: document.getElementById("kpiPendenciasCadastro"),
      gapRegiao: document.getElementById("gapRegiao"),
      donutEquipes: document.getElementById("donutEquipes"),
      statusEquipes: document.getElementById("statusEquipes"),
      donutVagas: document.getElementById("donutVagas"),
      statusVagas: document.getElementById("statusVagas"),
      listaVagasManuais: document.getElementById("listaVagasManuais"),
      tabelaEquipes: document.getElementById("tabelaEquipes"),
      totalEquipesTabela: document.getElementById("totalEquipesTabela"),
      paginacaoEquipes: document.getElementById("paginacaoEquipes"),
      listaAlertasRh: document.getElementById("listaAlertasRh"),
      listaPendenciasRecentes: document.getElementById("listaPendenciasRecentes"),
      equipeDestaque: document.getElementById("equipeDestaque"),
      modalVagaManual: document.getElementById("modalVagaManual"),
      formVagaManual: document.getElementById("formVagaManual"),
      tituloModalVaga: document.getElementById("tituloModalVaga"),
      formVagaEquipe: document.getElementById("formVagaEquipe"),
      formVagaCargo: document.getElementById("formVagaCargo"),
      formVagaStatus: document.getElementById("formVagaStatus"),
      vagaAndamentoPanel: document.getElementById("vagaAndamentoPanel"),
      vagaAndamentoResumo: document.getElementById("vagaAndamentoResumo"),
      vagaAndamentoTimeline: document.getElementById("vagaAndamentoTimeline"),
      vagaAndamentoTotal: document.getElementById("vagaAndamentoTotal"),
      btnSalvarVaga: document.getElementById("btnSalvarVaga"),
      modalExcluirVagaManual: document.getElementById("modalExcluirVagaManual"),
      formExcluirVagaManual: document.getElementById("formExcluirVagaManual"),
      subtituloModalExcluirVaga: document.getElementById("subtituloModalExcluirVaga"),
      btnExcluirVaga: document.getElementById("btnExcluirVaga"),
      modalAprovacaoVaga: document.getElementById("modalAprovacaoVaga"),
      formAprovacaoVaga: document.getElementById("formAprovacaoVaga"),
      subtituloModalAprovacaoVaga: document.getElementById("subtituloModalAprovacaoVaga"),
      btnAprovarVaga: document.getElementById("btnAprovarVaga"),
      btnReprovarVaga: document.getElementById("btnReprovarVaga"),
      modalPrioridadeVaga: document.getElementById("modalPrioridadeVaga"),
      formPrioridadeVaga: document.getElementById("formPrioridadeVaga"),
      tituloModalPrioridadeVaga: document.getElementById("tituloModalPrioridadeVaga"),
      subtituloModalPrioridadeVaga: document.getElementById("subtituloModalPrioridadeVaga"),
      prioridadeVagaResumo: document.getElementById("prioridadeVagaResumo"),
      prioridadeVagaRows: document.getElementById("prioridadeVagaRows"),
      prioridadeVagaFeedback: document.getElementById("prioridadeVagaFeedback"),
      btnAdicionarPrioridadeVaga: document.getElementById("btnAdicionarPrioridadeVaga"),
      btnSalvarPrioridadeVaga: document.getElementById("btnSalvarPrioridadeVaga"),
      modalVagasSla: document.getElementById("modalVagasSla"),
      tituloModalVagasSla: document.getElementById("tituloModalVagasSla"),
      subtituloModalVagasSla: document.getElementById("subtituloModalVagasSla"),
      listaSlaVagas: document.getElementById("listaSlaVagas"),
      modalProdutividadeCorretor: document.getElementById("modalProdutividadeCorretor"),
      detalheProdutividadeCorretor: document.getElementById("detalheProdutividadeCorretor"),
      modalForecastManual: document.getElementById("modalForecastManual"),
      formForecastManual: document.getElementById("formForecastManual"),
      tituloModalForecast: document.getElementById("tituloModalForecast"),
      subtituloModalForecast: document.getElementById("subtituloModalForecast"),
      btnSalvarForecast: document.getElementById("btnSalvarForecast"),
      tabelaForecastHistorico: document.getElementById("tabelaForecastHistorico"),
      totalForecastHistorico: document.getElementById("totalForecastHistorico"),
      metricasHistoricoGc: document.getElementById("metricasHistoricoGc"),
      insightsHistoricoGc: document.getElementById("insightsHistoricoGc"),
      filtroProdutividadeCoordenador: document.getElementById("filtroProdutividadeCoordenador"),
      filtroProdutividadeGerente: document.getElementById("filtroProdutividadeGerente"),
      filtroProdutividadeEquipe: document.getElementById("filtroProdutividadeEquipe"),
      filtroProdutividadeCorretor: document.getElementById("filtroProdutividadeCorretor"),
      filtroComercialCoordenador: document.getElementById("filtroComercialCoordenador"),
      filtroComercialGerente: document.getElementById("filtroComercialGerente"),
      filtroComercialEquipe: document.getElementById("filtroComercialEquipe"),
      filtroComercialCorretor: document.getElementById("filtroComercialCorretor"),
      produtividadeUltimaSync: document.getElementById("produtividadeUltimaSync"),
      comercialUltimaSync: document.getElementById("comercialUltimaSync"),
      metricasProdutividadeGc: document.getElementById("metricasProdutividadeGc"),
      insightsProdutividadeGc: document.getElementById("insightsProdutividadeGc"),
      produtividadeCoordenadores: document.getElementById("produtividadeCoordenadores"),
      totalProdutividadeCoordenadores: document.getElementById("totalProdutividadeCoordenadores"),
      tabelaProdutividadeGerentes: document.getElementById("tabelaProdutividadeGerentes"),
      totalProdutividadeGerentes: document.getElementById("totalProdutividadeGerentes"),
      metricasComercialGc: document.getElementById("metricasComercialGc"),
      comercialEquipesCards: document.getElementById("comercialEquipesCards"),
      totalComercialEquipes: document.getElementById("totalComercialEquipes"),
      comercialFunilGc: document.getElementById("comercialFunilGc"),
      totalComercialFunil: document.getElementById("totalComercialFunil"),
      tabelaComercialRankingEquipes: document.getElementById("tabelaComercialRankingEquipes"),
      totalComercialRankingEquipes: document.getElementById("totalComercialRankingEquipes"),
      comercialAcoesGestao: document.getElementById("comercialAcoesGestao"),
      tabelaComercialRankingCorretores: document.getElementById("tabelaComercialRankingCorretores"),
      totalComercialRankingCorretores: document.getElementById("totalComercialRankingCorretores"),
      metricasEquipesGc: document.getElementById("metricasEquipesGc"),
      insightsEquipesGc: document.getElementById("insightsEquipesGc"),
      totalEquipesAtivasGc: document.getElementById("totalEquipesAtivasGc"),
      tabelaEquipesAtivasGc: document.getElementById("tabelaEquipesAtivasGc"),
      totalEquipesInativasGc: document.getElementById("totalEquipesInativasGc"),
      tabelaEquipesInativasGc: document.getElementById("tabelaEquipesInativasGc"),
      metricasAprovacoesGc: document.getElementById("metricasAprovacoesGc"),
      insightsAprovacoesGc: document.getElementById("insightsAprovacoesGc"),
      totalAprovacoesGc: document.getElementById("totalAprovacoesGc"),
      tabelaAprovacoesGc: document.getElementById("tabelaAprovacoesGc"),
      metricasVagasGc: document.getElementById("metricasVagasGc"),
      insightsVagasGc: document.getElementById("insightsVagasGc"),
      totalVagasGc: document.getElementById("totalVagasGc"),
      tabelaVagasGc: document.getElementById("tabelaVagasGc"),
      metricasPessoasGc: document.getElementById("metricasPessoasGc"),
      insightsPessoasGc: document.getElementById("insightsPessoasGc"),
      totalPessoasGc: document.getElementById("totalPessoasGc"),
      tabelaPessoasGc: document.getElementById("tabelaPessoasGc"),
      pessoasFiltroNome: document.getElementById("pessoasFiltroNome"),
      pessoasFiltroEquipe: document.getElementById("pessoasFiltroEquipe"),
      pessoasFiltroGerente: document.getElementById("pessoasFiltroGerente"),
      pessoasFiltroStatus: document.getElementById("pessoasFiltroStatus"),
      pessoasFiltroTempo: document.getElementById("pessoasFiltroTempo"),
      pessoasFiltroPendencia: document.getElementById("pessoasFiltroPendencia"),
      listaPessoasPorEquipeGc: document.getElementById("listaPessoasPorEquipeGc"),
    };
  }

  function setSelectLabelText(select, text) {
    const label = select?.closest("label");
    if (!label) return;
    const firstTextNode = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (firstTextNode) {
      firstTextNode.textContent = `${text} `;
    } else {
      label.insertBefore(document.createTextNode(`${text} `), select);
    }
    select.setAttribute("aria-label", text);
  }

  function normalizeFilterLabels() {
    setSelectLabelText(el.filtroFoco, "Foco");
    setSelectLabelText(el.filtroGestor, "Gerente De Vendas");
  }

  function readSession(keys) {
    try {
      for (const key of keys) {
        const value = window.sessionStorage.getItem(key);
        if (value) return value;
      }
    } catch {}
    return "";
  }

  function trimTrailingSlash(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function ensureLeadingSlash(value) {
    const text = String(value || "");
    return text.startsWith("/") ? text : `/${text}`;
  }

  function endpoint(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${trimTrailingSlash(API_BASE_URL)}${ensureLeadingSlash(path)}`;
  }

  function withQuery(path, params = {}) {
    const url = new URL(endpoint(path), window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  function tabFromLocation() {
    const path = String(window.location.pathname || "").toLowerCase().replace(/\/+$/, "");
    if (path.includes("/gente-cultura/equipes")) return "equipes";
    if (path.includes("/gente-cultura/aprovacoes")) return "aprovacoes";
    if (path.includes("/gente-cultura/vagas")) return "vagas";
    if (path.includes("/gente-cultura/pessoas")) return "pessoas";
    if (path.includes("/gente-cultura/produtividade")) return "produtividade";
    if (path.includes("/gente-cultura/comercial")) return "comercial";
    if (path.includes("/gente-cultura/metricas")) return "metricas";
    if (path.includes("/gente-cultura/historico")) return "historico";
    const hash = String(window.location.hash || "").replace(/^#/, "");
    const hashMatch = Object.entries(GC_TABS).find(([, config]) => config.target === hash);
    return hashMatch?.[0] || "dashboard";
  }

  function tabUrl(tabKey) {
    const config = GC_TABS[tabKey] || GC_TABS.dashboard;
    return `${window.location.origin}${config.path}`;
  }

  function scrollToGcTab(tabKey, behavior = "smooth") {
    const config = GC_TABS[tabKey] || GC_TABS.dashboard;
    const target = document.getElementById(config.target) || el.dashboardRoot;
    if (!target) return;
    const scroller = target.closest(".tl-main") || document.scrollingElement || document.documentElement;
    if (tabKey === "dashboard") {
      scroller.scrollTo({ top: 0, behavior });
      if (scroller !== document.scrollingElement) window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    const scrollerBox = scroller.getBoundingClientRect ? scroller.getBoundingClientRect() : { top: 0 };
    const targetBox = target.getBoundingClientRect();
    const top = Math.max(0, scroller.scrollTop + targetBox.top - scrollerBox.top - 12);
    scroller.scrollTo({ top, behavior });
  }

  function activeGcTabRoot() {
    const config = GC_TABS[state.activeTab] || GC_TABS.dashboard;
    return document.getElementById(config.target) || el.dashboardRoot || document;
  }

  function activateGcTab(tabKey, options = {}) {
    const selected = GC_TABS[tabKey] ? tabKey : "dashboard";
    state.activeTab = selected;
    document.body.dataset.gcActiveTab = selected;
    document.querySelector(".tl-gc-period")?.toggleAttribute("hidden", selected === "metricas");
    el.gcTabs?.forEach((tab) => {
      const active = tab.dataset.gcTab === selected;
      tab.classList.toggle("is-active", active);
      if (active) {
        tab.setAttribute("aria-current", "page");
      } else {
        tab.removeAttribute("aria-current");
      }
    });
    if (options.updateHistory !== false) {
      const nextUrl = tabUrl(selected);
      if (window.location.href !== nextUrl) {
        window.history.pushState({ gcTab: selected }, "", nextUrl);
      }
    }
    if (options.scroll) {
      requestAnimationFrame(() => scrollToGcTab(selected, options.behavior || "smooth"));
    }
    if (selected === "produtividade" && options.load !== false) {
      window.setTimeout(() => ensureProdutividadeLoaded(), 0);
    }
    if (selected === "comercial" && options.load !== false) {
      window.setTimeout(() => ensureComercialLoaded(), 0);
    }
    if (selected !== "comercial") {
      requestAnimationFrame(() => applyTitleCaseStaticContent(activeGcTabRoot()));
      window.setTimeout(() => applyTitleCaseStaticContent(activeGcTabRoot()), 250);
    }
  }

  function activateGcTabFromLocation(options = {}) {
    activateGcTab(tabFromLocation(), { updateHistory: false, ...options });
  }

  async function api(path, options = {}) {
    const token = readSession(TOKEN_KEYS);
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    const traceProdutividadeApi = String(path || "").includes("/gente-cultura/produtividade");
    if (traceProdutividadeApi) traceComercialStage("api:fetch-start");
    const requestUrl = /^https?:\/\//i.test(path) ? path : endpoint(path);
    if (traceProdutividadeApi) traceComercialStage(`api:url:${String(requestUrl).slice(0, 180)}`);

    const fetchRequest = fetch(requestUrl, {
      cache: "no-store",
      credentials: "same-origin",
      ...options,
      headers,
      body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
    });
    if (traceProdutividadeApi) traceComercialStage("api:fetch-created");
    const response = await fetchRequest;
    if (traceProdutividadeApi) traceComercialStage("api:fetch-ok");
    const text = await response.text();
    if (traceProdutividadeApi) traceComercialStage(`api:text-ok:${text.length}`);
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
      if (traceProdutividadeApi) traceComercialStage("api:parse-ok");
    } catch {
      payload = { detalhe: text };
      if (traceProdutividadeApi) traceComercialStage("api:parse-error");
    }
    if (response.status === 401) {
      if (portalState?.logout) {
        portalState.logout();
      } else {
        window.location.replace("/acesso");
      }
    }
    if (!response.ok) {
      const error = new Error(payload?.detail || payload?.mensagem || payload?.detalhe || "Falha na API.");
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeKey(value) {
    return normalizeText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function slugKey(value) {
    return normalizeKey(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function compactKey(value) {
    return normalizeKey(value).replace(/[^a-z0-9@._-]+/g, "");
  }

  function funcionarioTipo(item) {
    return normalizeText(item?.tipo_funcionario).toUpperCase();
  }

  function isCommercialFuncionario(item) {
    return ["CORRETOR", "SDR"].includes(funcionarioTipo(item));
  }

  function isSalesManagerFuncionario(item) {
    if (funcionarioTipo(item) !== "FUNCIONARIO") return false;
    const cargo = normalizeKey(funcionarioCargo(item));
    return cargo.includes("gerente de vendas") || cargo.includes("gerente vendas");
  }

  function parseActiveFlag(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value !== 0 : null;
    const key = normalizeKey(value);
    if (!key) return null;
    if (["true", "1", "sim", "s", "yes", "y", "ativo", "active"].includes(key)) return true;
    if (["false", "0", "nao", "n", "no", "inativo", "inactive", "desativado", "desligado"].includes(key)) return false;
    return null;
  }

  function funcionarioStatusCv(item) {
    const direct = normalizeText(item?.status_cv || item?.status_planilha || item?.status_corretor_cv);
    if (direct) return normalizeKey(direct);
    const observacao = normalizeText(item?.observacao || item?.observacoes || item?.descricao_status || "");
    const match = observacao.match(/status\s*cv\s*:\s*([^|]+)/i);
    return match ? normalizeKey(match[1]) : "";
  }

  function funcionarioStatusCadastro(item) {
    const activeFlag = [
      item?.ativo,
      item?.indicador_ativo,
      item?.ativo_no_negocio,
      item?.ativo_negocio,
      item?.ativo_cadastro,
    ].map(parseActiveFlag).filter((flag) => flag !== null);
    if (activeFlag.some((flag) => flag === false)) return "INATIVO";

    const statusCv = funcionarioStatusCv(item);
    if (statusCv) {
      if (statusCv === "ativo" || statusCv === "active") return "ATIVO";
      if (statusCv.includes("afastado") || statusCv.includes("ausente") || statusCv.includes("licenca")) return "AFASTADO";
      return "INATIVO";
    }

    const statusKeys = [
      item?.status_operacional,
      item?.no_status_operacional,
      item?.status_negocio,
      item?.status_cadastro,
      item?.status,
      item?.situacao,
      item?.situacao_negocio,
      item?.situacao_no_negocio,
      item?.situacao_cadastro,
      item?.situacao_funcionario,
      item?.status_funcionario,
      item?.status_colaborador,
    ].map(normalizeKey).filter(Boolean);
    if (statusKeys.some((key) => key.includes("inativo") || key.includes("desligado") || key.includes("desligamento") || key.includes("demitido") || key.includes("rescindido"))) {
      return "INATIVO";
    }
    if (statusKeys.some((key) => key.includes("afastado") || key.includes("ausente") || key.includes("ferias") || key.includes("licenca"))) {
      return "AFASTADO";
    }
    return "ATIVO";
  }

  function isActiveFuncionario(item) {
    return funcionarioStatusCadastro(item) === "ATIVO";
  }

  function activeCommercialFuncionarios() {
    return (state.funcionarios || []).filter((item) => isActiveFuncionario(item) && isCommercialFuncionario(item));
  }

  function afastadoCommercialFuncionarios() {
    return (state.funcionarios || []).filter((item) => funcionarioStatusCadastro(item) === "AFASTADO" && isCommercialFuncionario(item));
  }

  function pessoaKey(item) {
    return compactKey(item?.identificador_funcionario || item?.identificador_usuario || item?.email || item?.documento || item?.nome);
  }

  function funcionarioIdentityKeys(item) {
    return [
      item?.identificador_usuario,
      item?.identificador_usuario_vinculado,
      item?.email,
      item?.documento,
    ].map(compactKey).filter(Boolean);
  }

  function metaIdentityKeys(item) {
    return [
      item?.usuario_id,
      item?.usuario_email,
    ].map(compactKey).filter(Boolean);
  }

  function funcionarioNome(item) {
    return normalizeText(item?.nome || item?.nome_completo || item?.usuario_nome) || "Pessoa sem nome";
  }

  function funcionarioRegiao(item) {
    return normalizeText(item?.equipe_vigencia_regiao || item?.regiao || item?.regional) || "Sem região";
  }

  function funcionarioEquipe(item) {
    return normalizeText(item?.equipe_vigencia_nome || item?.imobiliaria || item?.regional || item?.regiao) || "Sem equipe";
  }

  function funcionarioFoco(item) {
    return normalizeText(item?.foco || item?.regiao_foco || item?.foco_regiao);
  }

  function funcionarioGestor(item) {
    return normalizeText(
      item?.equipe_gerente_vendas
        || item?.gestor
        || item?.coordenador
        || item?.gerente
        || item?.diretor
    ) || "Sem gestor";
  }

  function funcionarioGerenteVendas(item) {
    return normalizeText(
      item?.equipe_gerente_vendas
        || item?.gerente_vendas
        || item?.gestor
        || item?.coordenador
        || item?.gerente
    ) || "Sem gerente de vendas";
  }

  function funcionarioCargo(item) {
    return normalizeText(item?.cargo || item?.funcao || item?.funcao_cargo) || "";
  }

  function funcionarioGestorKey(item) {
    return slugKey(funcionarioGestor(item)) || "sem_gestor";
  }

  function funcionarioEquipeKey(item) {
    return slugKey(funcionarioEquipe(item)) || "sem_equipe";
  }

  function isPlaceholderValue(value) {
    return ["", "a definir", "sem valor", "sem gestor", "vago"].includes(normalizeKey(value));
  }

  function isValidGestorValue(value) {
    const key = normalizeKey(value);
    if (!key || isPlaceholderValue(value)) return false;
    if (key.includes("equipe inativa") || key.includes("antiga")) return false;
    return true;
  }

  const LEADERSHIP_VACANCY_ROLES = [
    { field: "gerente_vendas", label: "Gerente De Vendas" },
    { field: "gerente_comercial", label: "Gerente Comercial" },
    { field: "gerente_regional", label: "Gerente Regional" },
  ];
  const FORECAST_LEADERSHIP_FIELDS = new Set(["gerente_vendas"]);
  const GAP_CARGO_OPTIONS = {
    consultor: { label: "Consultor", field: "" },
    gerente_vendas: { label: "Gerente De Vendas", field: "gerente_vendas" },
    gerente_comercial: { label: "Gerente Comercial", field: "gerente_comercial" },
    gerente_regional: { label: "Gerente Regional", field: "gerente_regional" },
  };
  const GAP_CARGO_ORDER = ["consultor", "gerente_vendas", "gerente_comercial", "gerente_regional"];
  const SHARED_LEADERSHIP_GAP_FIELDS = new Set(["gerente_comercial", "gerente_regional"]);

  function isOpenLeadershipValue(value) {
    const key = slugKey(value);
    return ["vago", "vaga_aberta", "em_aberto", "cargo_vago"].includes(key)
      || key.includes("em_aberto")
      || key.includes("vaga_aberta")
      || key.endsWith("_aberto")
      || key.endsWith("_aberta");
  }

  function leadershipVacanciesForRawTeam(item, fallbackTeam = "") {
    const raw = item?.raw || item || {};
    const teamName = normalizeText(raw.equipe || raw.imobiliaria || raw.time || raw.nome_equipe || fallbackTeam) || "Sem equipe";
    return LEADERSHIP_VACANCY_ROLES
      .filter((role) => isOpenLeadershipValue(raw[role.field]))
      .map((role) => ({
        ...role,
        equipe: teamName,
        key: `${slugKey(teamName)}::${role.field}`,
      }));
  }

  function leadershipVacanciesForTeams(teams) {
    const vacancies = new Map();
    [...(teams || [])].forEach((teamName) => {
      const rawTeam = catalogTeamByName(teamName);
      if (!rawTeam) return;
      leadershipVacanciesForRawTeam(rawTeam, teamName).forEach((vacancy) => {
        vacancies.set(vacancy.key, vacancy);
      });
    });
    return [...vacancies.values()];
  }

  function forecastableLeadershipVacancies(vacancies = []) {
    return (vacancies || []).filter((vacancy) => FORECAST_LEADERSHIP_FIELDS.has(vacancy?.field));
  }

  function leadershipVacancyCountForTeams(teams) {
    return forecastableLeadershipVacancies(leadershipVacanciesForTeams(teams)).length;
  }

  function commercialManagerDirectValue(raw) {
    return normalizeText(raw?.equipe_gerente_comercial || raw?.gerente_comercial || raw?.coordenador);
  }

  function commercialManagerDisplayValue(raw) {
    return commercialManagerDirectValue(raw)
      || normalizeText(raw?.gerente_regional || raw?.equipe_gerente_regional || raw?.diretor_comercial || raw?.diretor);
  }

  function addCommercialManagerEntry(entries, value, teamName, options = {}) {
    const equipe = normalizeText(teamName) || "Sem equipe";
    const label = options.vacant ? "Gerente Comercial em Aberto" : normalizeText(value);
    if (!label) return;
    if (!options.vacant && (isPlaceholderValue(label) || isOpenLeadershipValue(label))) return;
    const key = options.vacant ? `${slugKey(equipe)}::gerente_comercial` : slugKey(label);
    if (!key || entries.has(key)) return;
    entries.set(key, {
      key,
      label,
      equipe,
      vacant: Boolean(options.vacant),
    });
  }

  function commercialManagerEntriesForGroup(group) {
    const entries = new Map();
    const openTeamKeys = new Set();
    [...(group?.equipes || [])].forEach((teamName) => {
      const rawTeam = catalogTeamByName(teamName);
      if (!rawTeam) return;
      const equipe = normalizeText(rawTeam.equipe || rawTeam.imobiliaria || rawTeam.time || rawTeam.nome_equipe || teamName) || "Sem equipe";
      const directValue = commercialManagerDirectValue(rawTeam);
      const isVacant = isOpenLeadershipValue(rawTeam.gerente_comercial)
        || isOpenLeadershipValue(rawTeam.equipe_gerente_comercial)
        || isOpenLeadershipValue(directValue);
      if (isVacant) {
        openTeamKeys.add(slugKey(equipe));
        addCommercialManagerEntry(entries, "", equipe, { vacant: true });
        return;
      }
      addCommercialManagerEntry(entries, commercialManagerDisplayValue(rawTeam), equipe);
    });

    (group?.items || []).forEach((item) => {
      const equipe = funcionarioEquipe(item);
      if (openTeamKeys.has(slugKey(equipe))) return;
      const directValue = commercialManagerDirectValue(item);
      if (isOpenLeadershipValue(directValue)) {
        openTeamKeys.add(slugKey(equipe));
        addCommercialManagerEntry(entries, "", equipe, { vacant: true });
        return;
      }
      addCommercialManagerEntry(entries, commercialManagerDisplayValue(item), equipe);
    });

    return [...entries.values()].sort((a, b) => Number(b.vacant) - Number(a.vacant) || a.label.localeCompare(b.label, "pt-BR"));
  }

  function commercialManagerEntriesText(entries) {
    const list = entries || [];
    if (!list.length) return "-";
    if (list.length === 1) return list[0].label;
    return summarizeDetails(list.map((entry) => entry.label), 3);
  }

  function managerIdentityForTeamGroup(teamGroup) {
    const teamVacancies = leadershipVacanciesForTeams(new Set([teamGroup.equipe]));
    const salesManagerVacant = teamVacancies.some((vacancy) => vacancy.field === "gerente_vendas");
    if (salesManagerVacant || isOpenLeadershipValue(teamGroup.gestorLabel)) {
      const teamKey = slugKey(teamGroup.equipe) || "sem_equipe";
      return {
        key: `vaga_gerente_vendas_${teamKey}`,
        label: "Gerente De Vendas Em Aberto",
        vacant: true,
      };
    }
    if (!isValidGestorValue(teamGroup.gestorLabel)) return null;
    return {
      key: slugKey(teamGroup.gestorLabel),
      label: teamGroup.gestorLabel,
      vacant: false,
    };
  }

  function funcionarioHierarquiaComercial(item) {
    const entries = [
      ["Gerente comercial", item?.equipe_gerente_comercial || item?.gerente_comercial || item?.coordenador],
      ["Gerente regional", item?.equipe_gerente_regional || item?.gerente_regional || item?.gerente],
      ["Head comercial", item?.equipe_head_comercial || item?.head_comercial],
      ["Diretor comercial", item?.equipe_diretor_comercial || item?.diretor_comercial || item?.diretor],
    ];
    const seen = new Set();
    return entries.reduce((acc, [label, value]) => {
      const text = normalizeText(value);
      const key = normalizeKey(`${label}:${text}`);
      if (!text || isPlaceholderValue(text) || seen.has(key)) return acc;
      seen.add(key);
      acc.push({ label, value: text });
      return acc;
    }, []);
  }

  function funcionarioHasCadastroPendente(item) {
    return (
      isPlaceholderValue(funcionarioGestor(item)) ||
      isPlaceholderValue(funcionarioEquipe(item)) ||
      !normalizeText(item?.email) ||
      !normalizeText(item?.documento)
    );
  }

  function filteredFuncionarios() {
    const regiao = el.filtroRegiao?.value || "";
    const equipe = el.filtroEquipe?.value || "";
    const foco = el.filtroFoco?.value || "";
    const gestor = el.filtroGestor?.value || "";
    return activeCommercialFuncionarios().filter((item) => {
      if (regiao && slugKey(funcionarioRegiao(item)) !== slugKey(regiao)) return false;
      if (equipe && funcionarioEquipeKey(item) !== equipe) return false;
      if (foco && !funcionarioMatchesFoco(item, foco)) return false;
      if (gestor && funcionarioGestorKey(item) !== gestor) return false;
      return true;
    });
  }

  function isCatalaoLabel(value) {
    const key = normalizeKey(value);
    const slug = slugKey(value);
    return key.includes("catalao") || slug === "cat" || slug.endsWith("_cat") || slug.includes("_cat_");
  }

  function managerTableRule(group) {
    const equipe = normalizeKey(group?.equipe);
    const isAutonomos = equipe.includes("autonom");
    const isEquipePropria = equipe.includes("equipe propria");
    const isCanalVirtual = equipe.includes("canal virtual");
    const isCatalao = isCatalaoLabel(group?.equipe) || isCatalaoLabel(group?.regiao);

    if (isAutonomos) {
      return { key: "autonomos", label: "Autônomos", tipoLabel: "Autônomos", meta: 10 };
    }
    if (isEquipePropria && isCatalao) {
      return { key: "equipe_propria_catalao", label: "Equipe Própria de Catalão", tipoLabel: "Interna", meta: 8 };
    }
    if (isEquipePropria) {
      return { key: "equipe_propria", label: "Equipe Própria", tipoLabel: "Interna", meta: 8 };
    }
    if (isCanalVirtual) {
      return { key: "canal_virtual", label: "Canal Virtual", tipoLabel: "Interna", meta: 8 };
    }
    return null;
  }

  function summarizeSet(values, pluralLabel) {
    const unique = [...values].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
    if (!unique.length) return "-";
    if (unique.length === 1) return unique[0];
    return `${formatNumber(unique.length)} ${pluralLabel}`;
  }

  function summarizeDetails(values, limit = 3) {
    const unique = [...values].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
    if (!unique.length) return "-";
    const visible = unique.slice(0, limit).join(", ");
    const hidden = unique.length - limit;
    return hidden > 0 ? `${visible} +${formatNumber(hidden)}` : visible;
  }

  function summarizeRuleCounts(ruleCounts) {
    return [...ruleCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([label, count]) => count > 1 ? `${label} (${formatNumber(count)})` : label)
      .join(", ");
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function formatNumber(value, digits = 0) {
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(toNumber(value));
  }

  function formatPercent(value) {
    return `${formatNumber(value, 1)}%`;
  }

  function formatSigned(value, digits = 0) {
    const number = toNumber(value);
    const prefix = number > 0 ? "+" : "";
    return `${prefix}${formatNumber(number, digits)}`;
  }

  function todayIsoDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  function formatDatePt(value) {
    if (!value) return "-";
    const text = String(value).slice(0, 10);
    const [year, month, day] = text.split("-");
    if (!year || !month || !day) return text;
    return `${day}/${month}/${year}`;
  }

  function datePickerLabel(value) {
    return value ? formatDatePt(value) : "dd/mm/aaaa";
  }

  function parseIsoDate(value) {
    const text = String(value || "").slice(0, 10);
    const [year, month, day] = text.split("-").map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function isoFromDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function monthStart(date) {
    const base = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }

  function addCalendarMonths(date, amount) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
  }

  function isSameCalendarDay(a, b) {
    return a instanceof Date && b instanceof Date &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function closeDatePicker(input = activeDatePicker) {
    if (!input) return;
    const control = datePickers.get(input);
    if (!control) return;
    control.wrapper.classList.remove("is-open");
    control.button.setAttribute("aria-expanded", "false");
    control.menu.hidden = true;
    control.menu.classList.remove("is-open");
    if (activeDatePicker === input) activeDatePicker = null;
  }

  function syncDatePicker(input) {
    const control = datePickers.get(input);
    if (!control) return;
    const value = String(input.value || "").slice(0, 10);
    const required = input.dataset.gcDateRequired === "true";
    control.value.textContent = datePickerLabel(value);
    control.button.title = value ? datePickerLabel(value) : "Selecionar data";
    control.button.disabled = Boolean(input.disabled || input.readOnly);
    control.button.classList.toggle("is-empty", !value);
    control.wrapper.classList.toggle("is-invalid", required && !value && input.dataset.gcDateTouched === "true");
    if (control.menu.classList.contains("is-open")) renderDatePicker(input);
  }

  function setDatePickerValue(input, value, options = {}) {
    if (!input) return;
    const next = String(value || "").slice(0, 10);
    const previous = input.value;
    input.value = next;
    input.dataset.gcDateTouched = "true";
    syncDatePicker(input);
    if (options.close !== false) closeDatePicker(input);
    if (previous !== next || options.forceEvent) {
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function placeDatePicker(input) {
    const control = datePickers.get(input);
    if (!control) return;
    const rect = control.button.getBoundingClientRect();
    const gap = 8;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const width = Math.min(320, Math.max(284, viewportWidth - 24));
    const left = Math.min(Math.max(12, rect.left), Math.max(12, viewportWidth - width - 12));
    const estimatedHeight = Math.min(392, Math.max(318, control.menu.scrollHeight || 338));
    const spaceBelow = viewportHeight - rect.bottom - gap - 12;
    const spaceAbove = rect.top - gap - 12;
    const openAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
    const top = openAbove
      ? Math.max(12, rect.top - gap - estimatedHeight)
      : Math.min(Math.max(12, rect.bottom + gap), Math.max(12, viewportHeight - estimatedHeight - 12));
    control.menu.style.width = `${Math.round(width)}px`;
    control.menu.style.left = `${Math.round(left)}px`;
    control.menu.style.top = `${Math.round(top)}px`;
  }

  function renderDatePicker(input) {
    const control = datePickers.get(input);
    if (!control) return;
    const selected = parseIsoDate(input.value);
    const today = parseIsoDate(todayIsoDate()) || new Date();
    const currentMonth = monthStart(parseIsoDate(input.dataset.gcDatePickerMonth) || selected || today);
    input.dataset.gcDatePickerMonth = isoFromDate(currentMonth);
    const rawMonthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(currentMonth);
    const monthLabel = rawMonthLabel ? `${rawMonthLabel.charAt(0).toUpperCase()}${rawMonthLabel.slice(1)}` : "";
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());
    control.menu.innerHTML = "";

    const header = document.createElement("div");
    header.className = "tl-gc-calendar__header";

    const title = document.createElement("strong");
    title.textContent = monthLabel;

    const nav = document.createElement("div");
    nav.className = "tl-gc-calendar__nav";

    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "tl-gc-calendar__icon";
    previous.setAttribute("aria-label", "Mes anterior");
    previous.textContent = "?";
    previous.addEventListener("click", () => {
      input.dataset.gcDatePickerMonth = isoFromDate(addCalendarMonths(currentMonth, -1));
      renderDatePicker(input);
    });

    const next = document.createElement("button");
    next.type = "button";
    next.className = "tl-gc-calendar__icon";
    next.setAttribute("aria-label", "Proximo mes");
    next.textContent = "?";
    next.addEventListener("click", () => {
      input.dataset.gcDatePickerMonth = isoFromDate(addCalendarMonths(currentMonth, 1));
      renderDatePicker(input);
    });

    nav.append(previous, next);
    header.append(title, nav);
    control.menu.appendChild(header);

    const week = document.createElement("div");
    week.className = "tl-gc-calendar__week";
    ["D", "S", "T", "Q", "Q", "S", "S"].forEach((label) => {
      const item = document.createElement("span");
      item.textContent = label;
      week.appendChild(item);
    });
    control.menu.appendChild(week);

    const grid = document.createElement("div");
    grid.className = "tl-gc-calendar__grid";
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = isoFromDate(date);
      const day = document.createElement("button");
      day.type = "button";
      day.className = "tl-gc-calendar__day";
      day.textContent = String(date.getDate());
      day.dataset.date = iso;
      day.setAttribute("aria-label", new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(date));
      day.classList.toggle("is-outside", date.getMonth() !== currentMonth.getMonth());
      day.classList.toggle("is-today", isSameCalendarDay(date, today));
      day.classList.toggle("is-selected", Boolean(selected && isSameCalendarDay(date, selected)));
      day.addEventListener("click", () => setDatePickerValue(input, iso));
      day.addEventListener("keydown", (event) => handleDatePickerDayKeydown(event, input));
      grid.appendChild(day);
    }
    control.menu.appendChild(grid);

    const footer = document.createElement("div");
    footer.className = "tl-gc-calendar__footer";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "tl-gc-calendar__text-btn";
    clear.textContent = "Limpar";
    clear.disabled = input.dataset.gcDateRequired === "true";
    clear.addEventListener("click", () => setDatePickerValue(input, ""));
    const todayButton = document.createElement("button");
    todayButton.type = "button";
    todayButton.className = "tl-gc-calendar__text-btn";
    todayButton.textContent = "Hoje";
    todayButton.addEventListener("click", () => setDatePickerValue(input, todayIsoDate()));
    footer.append(clear, todayButton);
    control.menu.appendChild(footer);
    requestAnimationFrame(() => placeDatePicker(input));
  }

  function handleDatePickerDayKeydown(event, input) {
    const control = datePickers.get(input);
    if (!control) return;
    const days = [...control.menu.querySelectorAll(".tl-gc-calendar__day")];
    const index = days.indexOf(event.currentTarget);
    const move = (amount) => {
      event.preventDefault();
      days[Math.min(days.length - 1, Math.max(0, index + amount))]?.focus({ preventScroll: true });
    };
    if (event.key === "ArrowRight") move(1);
    else if (event.key === "ArrowLeft") move(-1);
    else if (event.key === "ArrowDown") move(7);
    else if (event.key === "ArrowUp") move(-7);
    else if (event.key === "Home") {
      event.preventDefault();
      days[0]?.focus({ preventScroll: true });
    } else if (event.key === "End") {
      event.preventDefault();
      days[days.length - 1]?.focus({ preventScroll: true });
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeDatePicker(input);
      datePickers.get(input)?.button.focus({ preventScroll: true });
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.currentTarget.click();
    }
  }

  function openDatePicker(input) {
    const control = datePickers.get(input);
    if (!control || input.disabled || input.readOnly) return;
    if (activeCustomSelect) closeCustomSelect(activeCustomSelect);
    if (activeDatePicker && activeDatePicker !== input) closeDatePicker(activeDatePicker);
    activeDatePicker = input;
    input.dataset.gcDatePickerMonth = isoFromDate(monthStart(parseIsoDate(input.value) || parseIsoDate(todayIsoDate()) || new Date()));
    renderDatePicker(input);
    control.wrapper.classList.add("is-open");
    control.button.setAttribute("aria-expanded", "true");
    control.menu.hidden = false;
    control.menu.classList.add("is-open");
    placeDatePicker(input);
    requestAnimationFrame(() => {
      placeDatePicker(input);
      const selected = control.menu.querySelector(".tl-gc-calendar__day.is-selected") || control.menu.querySelector(".tl-gc-calendar__day.is-today") || control.menu.querySelector(".tl-gc-calendar__day");
      selected?.focus({ preventScroll: true });
    });
  }

  function enhanceDateInput(input) {
    if (!input || datePickers.has(input)) {
      if (input) syncDatePicker(input);
      return;
    }
    const required = input.required;
    input.dataset.gcDateRequired = required ? "true" : "false";
    input.required = false;
    input.type = "hidden";
    input.classList.add("tl-gc-date-native");

    const wrapper = document.createElement("span");
    wrapper.className = "tl-gc-date-picker";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tl-gc-date-picker__button";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Selecionar data");
    const value = document.createElement("span");
    value.className = "tl-gc-date-picker__value";
    const icon = document.createElement("span");
    icon.className = "tl-gc-date-picker__icon";
    icon.setAttribute("aria-hidden", "true");
    button.append(value, icon);
    wrapper.appendChild(button);

    const menu = document.createElement("div");
    menu.className = "tl-gc-calendar";
    menu.hidden = true;
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-label", "Calendario");
    document.body.appendChild(menu);
    input.insertAdjacentElement("afterend", wrapper);
    datePickers.set(input, { wrapper, button, menu, value });

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (activeDatePicker === input) closeDatePicker(input);
      else openDatePicker(input);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        openDatePicker(input);
      } else if (event.key === "Escape") {
        closeDatePicker(input);
      }
    });
    input.addEventListener("change", () => syncDatePicker(input));
    syncDatePicker(input);
  }

  function enhanceDatePickers(scope = document) {
    scope.querySelectorAll('.tl-gc-vacancy-form input[type="date"], .tl-gc-vacancy-form input.tl-gc-date-native').forEach(enhanceDateInput);
  }

  function formatDateTimePt(value) {
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

  function periodLabel(period = currentPeriodKey()) {
    const month = MONTHS[(Number(period.mes) || 1) - 1] || "-";
    return `${month}/${Number(period.ano) || ""}`;
  }

  function utcDay(value) {
    const text = String(value || "").slice(0, 10);
    const [year, month, day] = text.split("-").map(Number);
    if (!year || !month || !day) return null;
    return Date.UTC(year, month - 1, day);
  }

  function utcDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
    const day = utcDay(value);
    return day === null ? null : day;
  }

  function vagaSlaDias(vaga) {
    const start = utcDay(vaga?.data_abertura);
    const running = isVagaManualAberta(vaga) || isVagaPendenteAprovacao(vaga);
    const end = utcDay(running ? todayIsoDate() : vaga?.data_fechamento || todayIsoDate());
    if (start === null || end === null) return 0;
    return Math.max(0, Math.floor((end - start) / 86400000));
  }

  function vagaApprovalSlaDias(vaga) {
    const start = utcDateTime(vaga?.data_hora_solicitacao || vaga?.data_abertura);
    const end = utcDateTime(vaga?.data_aprovacao || (isVagaPendenteAprovacao(vaga) ? new Date().toISOString() : null));
    if (start === null || end === null) return 0;
    return Math.max(0, Math.floor((end - start) / 86400000));
  }

  function vagaStageSlaDias(vaga) {
    const status = vagaStatusKey(vaga);
    let startValue = vaga?.data_inicio_andamento || vaga?.data_aprovacao || vaga?.data_hora_solicitacao || vaga?.data_abertura;
    if (["PENDENTE_APROVACAO_REGIONAL", "PENDENTE_APROVACAO"].includes(status)) startValue = vaga?.data_hora_solicitacao || vaga?.data_abertura;
    const start = utcDateTime(startValue);
    const end = utcDateTime(["FECHADA", "CANCELADA", "CONGELADA", "REPROVADA"].includes(status) ? (vaga?.data_fechamento || vaga?.data_aprovacao || new Date().toISOString()) : new Date().toISOString());
    if (start === null || end === null) return 0;
    return Math.max(0, Math.floor((end - start) / 86400000));
  }

  function formatDiasLabel(dias) {
    const value = Math.max(0, Math.trunc(toNumber(dias)));
    return `${formatNumber(value)} dia${value === 1 ? "" : "s"}`;
  }

  function vagaSlaClass(dias) {
    if (dias <= 7) return { label: "No prazo", key: "ok" };
    if (dias <= 15) return { label: "Atenção", key: "warn" };
    return { label: "Crítica", key: "danger" };
  }

  function normalizeVagaStatus(value) {
    const text = normalizeKey(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if ([
      "pendente_regional",
      "pendente_aprovacao_regional",
      "pendente_de_aprovacao_regional",
      "aguardando_regional",
      "aguardando_gerente_regional",
    ].includes(text)) return "PENDENTE_APROVACAO_REGIONAL";
    if (["pendente", "pendente_aprovacao", "pendente_de_aprovacao", "aguardando_aprovacao", "solicitada", "solicitacao"].includes(text)) return "PENDENTE_APROVACAO";
    if (!text || text === "aberta" || text === "aberto" || text === "andamento" || text === "em_andamento" || text === "emandamento") return "EM_ANDAMENTO";
    if (text === "triagem" || text === "em_triagem") return "TRIAGEM";
    if (text === "entrevista" || text === "entrevistas" || text === "em_entrevista" || text === "em_entrevistas") return "ENTREVISTAS";
    if (text === "proposta" || text === "em_proposta") return "PROPOSTA";
    if (text === "fechada" || text === "fechado" || text === "finalizada" || text === "finalizado") return "FECHADA";
    if (text === "cancelada" || text === "cancelado" || text === "cancelamento") return "CANCELADA";
    if (text === "congelada" || text === "congelado") return "CONGELADA";
    if (text === "reprovada" || text === "reprovado" || text === "recusada" || text === "recusado") return "REPROVADA";
    return "EM_ANDAMENTO";
  }

  function vagaStatusKey(item) {
    if (normalizeText(item?.status_vaga)) return normalizeVagaStatus(item.status_vaga);
    const fechamento = utcDay(item?.data_fechamento);
    const hoje = utcDay(todayIsoDate());
    return fechamento !== null && hoje !== null && fechamento <= hoje ? "FECHADA" : "EM_ANDAMENTO";
  }

  function vagaStatusInfo(item) {
    return VAGA_STATUS[vagaStatusKey(item)] || VAGA_STATUS.EM_ANDAMENTO;
  }

  function isVagaManualAberta(item) {
    return ["EM_ANDAMENTO", "TRIAGEM", "ENTREVISTAS", "PROPOSTA"].includes(vagaStatusKey(item));
  }

  function isVagaPendenteAprovacao(item) {
    return ["PENDENTE_APROVACAO_REGIONAL", "PENDENTE_APROVACAO"].includes(vagaStatusKey(item));
  }

  function isVagaNecessidadeAtiva(item) {
    return isVagaManualAberta(item) || isVagaPendenteAprovacao(item);
  }

  function vagaQuantidade(item) {
    const value = toNumber(item?.quantidade_vagas ?? item?.quantidade ?? 1);
    if (!Number.isFinite(value) || value < 1) return 1;
    return Math.min(999, Math.trunc(value));
  }

  function sumVagaQuantidade(vagas) {
    return (vagas || []).reduce((sum, vaga) => sum + vagaQuantidade(vaga), 0);
  }

  function normalizePrioridadeVagaNivel(value) {
    const text = normalizeText(value);
    if (/^-?\d+$/.test(text) && ["-1", "0", "1", "2", "3"].includes(text)) return text;
    const nivelMatch = text.match(/\b(?:n[ií]vel|prioridade)\s*(-1|0|1|2|3)\b/i) || text.match(/^\s*(-1|0|1|2|3)\b/i);
    if (nivelMatch) return nivelMatch[1];
    const key = slugKey(value);
    const keySemQuantidade = key.replace(/_\d+$/, "");
    const aliases = {
      critica: "-1",
      critico: "-1",
      alta: "0",
      alto: "0",
      media: "1",
      medio: "1",
      baixa: "2",
      baixo: "2",
      normal: "3",
      tranquila: "3",
      tranquilo: "3",
      sem_prioridade: "3",
      sem_prioridade_definida: "3",
      despriorizada: "3",
      despriorizado: "3",
    };
    return aliases[key] || aliases[keySemQuantidade] || "";
  }

  function vagaPrioridadeNivelLabel(nivel) {
    const normalized = normalizePrioridadeVagaNivel(nivel);
    return normalized ? `Nível ${normalized}` : "Nível";
  }

  function parsePrioridadeNiveis(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function ordenarPrioridadeVagaRows(rows, total) {
    const merged = rows.reduce((map, item) => {
      map.set(item.nivel, (map.get(item.nivel) || 0) + item.quantidade);
      return map;
    }, new Map());
    return VAGA_PRIORIDADE_NIVEIS
      .map((option) => ({ nivel: option.label, quantidade: Math.min(total, merged.get(option.label) || 0) }))
      .filter((item) => item.quantidade > 0);
  }

  function parsePrioridadeLegadaNiveis(raw, total) {
    const text = normalizeText(raw);
    if (!text || !total) return [];
    const segmentos = text.split(/[;,•]+/).map((item) => item.trim()).filter(Boolean);
    const rows = [];
    segmentos.forEach((segmento) => {
      const nivel = normalizePrioridadeVagaNivel(segmento);
      if (!nivel) return;
      let textoQuantidade = segmento;
      const marcador = textoQuantidade.match(/\b(?:n[ií]vel|prioridade)\s*(-1|0|1|2|3)\b/i) || textoQuantidade.match(/^\s*(-1|0|1|2|3)\b/i);
      if (marcador) {
        textoQuantidade = `${textoQuantidade.slice(0, marcador.index)} ${textoQuantidade.slice((marcador.index || 0) + marcador[0].length)}`;
      }
      const numeros = [...textoQuantidade.matchAll(/\b\d+\b/g)].map((match) => toNumber(match[0])).filter((numero) => Number.isFinite(numero));
      const quantidade = numeros.length ? Math.trunc(numeros[numeros.length - 1]) : total;
      if (quantidade > 0) rows.push({ nivel, quantidade: Math.min(total, quantidade) });
    });
    if (!rows.length) {
      const nivel = normalizePrioridadeVagaNivel(text);
      if (nivel) rows.push({ nivel, quantidade: total });
    }
    return ordenarPrioridadeVagaRows(rows, total);
  }

  function vagaPrioridadeManualNiveis(vaga) {
    const total = vagaQuantidade(vaga);
    const rows = parsePrioridadeNiveis(vaga?.prioridade_niveis || vaga?.prioridades)
      .map((item) => {
        const nivel = normalizePrioridadeVagaNivel(item?.nivel || item?.prioridade || item?.label);
        const quantidadeRaw = toNumber(item?.quantidade || item?.qtd || item?.total || 0);
        const quantidade = Number.isFinite(quantidadeRaw) ? Math.trunc(quantidadeRaw) : 0;
        return nivel && quantidade > 0 ? { nivel, quantidade: Math.min(total, quantidade) } : null;
      })
      .filter(Boolean);
    if (rows.length) {
      return ordenarPrioridadeVagaRows(rows, total);
    }
    return parsePrioridadeLegadaNiveis(vaga?.prioridade, total);
  }

  function vagaPrioridadeNiveis(vaga) {
    const manual = vagaPrioridadeManualNiveis(vaga);
    if (manual.length) return manual;
    const total = vagaQuantidade(vaga);
    const legacy = normalizePrioridadeVagaNivel(vaga?.prioridade);
    return legacy ? [{ nivel: legacy, quantidade: total }] : [];
  }

  function vagaPrioridadeRank(nivel) {
    const normalized = normalizePrioridadeVagaNivel(nivel);
    const index = VAGA_PRIORIDADE_NIVEIS.findIndex((option) => option.label === normalized);
    return index >= 0 ? index : VAGA_PRIORIDADE_NIVEIS.length;
  }

  function vagaPrioridadeColor(nivel) {
    const normalized = normalizePrioridadeVagaNivel(nivel);
    if (normalized === "-1") return STATUS_COLORS.critica;
    if (normalized === "0") return STATUS_COLORS.aguardando;
    if (normalized === "1") return STATUS_COLORS.encaminhamento;
    if (normalized === "2") return STATUS_COLORS.aberta;
    return STATUS_COLORS.sem_meta;
  }

  function vagaPrioridadeIntent(nivel) {
    const normalized = normalizePrioridadeVagaNivel(nivel);
    if (normalized === "-1") return "danger";
    if (normalized === "0" || normalized === "1") return "warn";
    return "success";
  }

  function vagaPrioridadeTotal(vaga) {
    return vagaPrioridadeNiveis(vaga).reduce((sum, item) => sum + item.quantidade, 0);
  }

  function vagaPrioridadeResumoText(vaga, { incluirRestante = true } = {}) {
    const total = vagaQuantidade(vaga);
    const niveis = vagaPrioridadeNiveis(vaga);
    const partes = niveis.map((item) => `${vagaPrioridadeNivelLabel(item.nivel)} ${formatNumber(item.quantidade)}`);
    const restante = Math.max(0, total - vagaPrioridadeTotal(vaga));
    if (incluirRestante && restante > 0) {
      partes.push(`${formatNumber(restante)} sem nível`);
    }
    return partes.length ? partes.join(" • ") : "Nível não definido";
  }

  function vagaQuantidadePrioridade(vaga, niveisPermitidos = ["-1", "0"]) {
    const niveis = vagaPrioridadeNiveis(vaga);
    if (niveis.length) {
      return niveis
        .filter((item) => niveisPermitidos.includes(item.nivel))
        .reduce((sum, item) => sum + item.quantidade, 0);
    }
    const legacy = normalizePrioridadeVagaNivel(vaga?.prioridade);
    return niveisPermitidos.includes(legacy) ? vagaQuantidade(vaga) : 0;
  }

  function vagaCargo(item) {
    return normalizeText(item?.cargo) || "Cargo não informado";
  }

  function vagaCargoField(item) {
    const key = slugKey(vagaCargo(item));
    if (!key) return "";
    if (key.includes("gerente_regional")) return "gerente_regional";
    if (key.includes("gerente_comercial")) return "gerente_comercial";
    if (key.includes("gerente_de_vendas") || (key.includes("gerente") && key.includes("vendas"))) return "gerente_vendas";
    if (key.includes("consultor") || key.includes("corretor")) return "consultor";
    return "";
  }

  function vagaAndamentos(item) {
    return Array.isArray(item?.andamentos)
      ? [...item.andamentos].sort((a, b) => new Date(b?.data_hora_criacao || 0) - new Date(a?.data_hora_criacao || 0))
      : [];
  }

  function vagaUltimoAndamento(item) {
    const latest = vagaAndamentos(item)[0];
    if (!latest) return "";
    const autor = normalizeText(latest.usuario_nome || latest.criado_por_nome) || "Sistema";
    const descricao = normalizeText(latest.descricao);
    if (!descricao) return "";
    return `${titleCaseDisplay(autor)}: ${titleCaseDisplay(descricao)}`;
  }

  function vagaProgressSummary(item) {
    const status = vagaStatusInfo(item);
    const dias = isVagaPendenteAprovacao(item) ? vagaApprovalSlaDias(item) : vagaStageSlaDias(item);
    const timeline = vagaAndamentos(item);
    return [
      { label: "Status", value: titleCaseDisplay(status.label) },
      { label: isVagaPendenteAprovacao(item) ? "SLA de Aprovação" : "SLA da Etapa", value: `${formatNumber(dias)} dia${dias === 1 ? "" : "s"}` },
      { label: "Atualizações", value: formatNumber(timeline.length) },
      { label: "Última Atualização", value: timeline[0] ? formatDateTimePt(timeline[0].data_hora_criacao) : "Sem registro" },
    ];
  }

  function normalizeVagaCargoOption(value, fallback = "") {
    const cargo = normalizeText(value);
    if (!el.formVagaCargo || !cargo) return fallback;
    return [...el.formVagaCargo.options].some((option) => option.value === cargo) ? cargo : fallback;
  }

  function currentUserIsAdmin() {
    const access = state.user?.acessos_portal || {};
    return Boolean(
      state.user?.pode_gerenciar ||
      access["ACESSO_TOTAL"] ||
      access["GERENCIAR_ACESSO"] ||
      access["administracao.manage"] ||
      access["rh.admin.acessos.manage"]
    );
  }

  function canDeleteVaga() {
    return currentUserIsAdmin();
  }

  function currentUserApprovalKeys() {
    const user = state.user || {};
    const keys = [
      user.identificador_usuario,
      user.id,
      user.nome_completo,
      user.name,
      user.nome,
      user.correio_eletronico,
      user.email,
    ];
    return new Set(keys.map((item) => slugKey(item)).filter(Boolean));
  }

  function canApproveVaga(vaga) {
    const userKeys = currentUserApprovalKeys();
    if (!userKeys.size || !isVagaPendenteAprovacao(vaga)) return false;
    if (currentUserIsAdmin()) return true;
    const regional = vagaStatusKey(vaga) === "PENDENTE_APROVACAO_REGIONAL";
    const approvalKeys = regional
      ? [
        vaga?.aprovador_regional_usuario,
        vaga?.gerente_regional_aprovador,
        vaga?.gerente_regional_aprovador_email,
      ].map((item) => slugKey(item)).filter(Boolean)
      : [
        vaga?.aprovador_usuario,
        vaga?.diretor_aprovador,
        vaga?.diretor_aprovador_email,
      ].map((item) => slugKey(item)).filter(Boolean);
    return approvalKeys.some((key) => userKeys.has(key));
  }

  function vagaApprovalStageInfo(vaga) {
    if (vagaStatusKey(vaga) === "PENDENTE_APROVACAO_REGIONAL") {
      return {
        label: "Aprovação Regional",
        aguardando: vaga?.gerente_regional_aprovador || "gerente regional",
        rejected: "Vaga reprovada pelo gerente regional.",
        approved: "Vaga aprovada e enviada para diretoria.",
      };
    }
    return {
      label: "Aprovação Diretoria",
      aguardando: vaga?.diretor_aprovador || "diretor comercial",
      rejected: "Vaga reprovada pela diretoria.",
      approved: "Vaga aprovada e enviada para o RH.",
    };
  }

  function upperLeadershipValuesForTeam(teamName, group = null) {
    const teamKey = slugKey(teamName);
    const rawTeam = catalogTeamByName(teamName) || {};
    const values = [
      rawTeam.gerente_regional,
      rawTeam.equipe_gerente_regional,
      rawTeam.head_comercial,
      rawTeam.equipe_head_comercial,
      rawTeam.diretor_comercial,
      rawTeam.equipe_diretor_comercial,
      rawTeam.diretor,
    ];
    (group?.items || [])
      .filter((item) => !teamKey || funcionarioEquipeKey(item) === teamKey)
      .forEach((item) => {
        values.push(
          item?.equipe_gerente_regional,
          item?.gerente_regional,
          item?.equipe_head_comercial,
          item?.head_comercial,
          item?.equipe_diretor_comercial,
          item?.diretor_comercial,
          item?.diretor
        );
      });
    return values.map(normalizeText).filter((value) => value && !isPlaceholderValue(value) && !isOpenLeadershipValue(value));
  }

  function canEditForecastGroup(group) {
    if (!group) return false;
    if (currentUserIsAdmin()) return true;
    const userKeys = currentUserApprovalKeys();
    if (!userKeys.size) return false;
    const teams = [...(group.equipes || [])].map(normalizeText).filter(Boolean);
    if (!teams.length) return false;
    return teams.every((teamName) => (
      upperLeadershipValuesForTeam(teamName, group)
        .map((item) => slugKey(item))
        .some((key) => key && userKeys.has(key))
    ));
  }

  function approvalQueueVagas() {
    const pendentes = scopedVagasManuais()
      .filter(isVagaPendenteAprovacao)
      .sort((a, b) => vagaApprovalSlaDias(b) - vagaApprovalSlaDias(a) || String(a.protocolo || "").localeCompare(String(b.protocolo || ""), "pt-BR"));
    const minhas = pendentes.filter(canApproveVaga);
    return minhas.length ? minhas : pendentes;
  }

  function vagaEquipeKey(item) {
    return slugKey(item?.equipe);
  }

  function vagaRegionScopeKey(item) {
    return slugKey(item?.regiao || item?.regional || item?.localidade || item?.equipe);
  }

  function manualOpenVacanciesForTeams(teams) {
    return sumVagaQuantidade(openVacanciesForTeams(teams));
  }

  function openVacanciesForTeams(teams) {
    const keys = new Set([...teams].map(slugKey).filter(Boolean));
    if (!keys.size) return [];
    return (state.vagasManuais || [])
      .filter((item) => isVagaManualAberta(item) && keys.has(vagaEquipeKey(item)))
      .sort((a, b) => vagaSlaDias(b) - vagaSlaDias(a) || String(a.protocolo || "").localeCompare(String(b.protocolo || ""), "pt-BR"));
  }

  function manualForecastForManager(manager) {
    const key = slugKey(manager?.key || manager?.gestorLabel);
    if (!key) return null;
    return (state.forecastsManuais || []).find((item) => slugKey(item?.chave_gestor || item?.gestor) === key) || null;
  }

  function forecastManualTeams(item) {
    const teams = Array.isArray(item?.equipes) ? item.equipes : [];
    const candidates = teams.length ? teams : [item?.equipe_resumo];
    const seen = new Set();
    return candidates.map(normalizeText).filter(Boolean).filter((team) => {
      const key = slugKey(team);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function manualForecastForTeam(team) {
    const teamKey = slugKey(team?.equipe);
    const managerKey = slugKey(team?.gerente);
    if (!teamKey && !managerKey) return null;
    return (state.forecastsManuais || []).find((item) => {
      const forecastManagerKey = slugKey(item?.chave_gestor || item?.gestor);
      const forecastTeamKeys = forecastManualTeams(item).map(slugKey).filter(Boolean);
      const managerMatches = managerKey && forecastManagerKey === managerKey;
      const teamMatches = teamKey && forecastTeamKeys.includes(teamKey);
      return teamMatches || (managerMatches && (!forecastTeamKeys.length || forecastTeamKeys.includes(teamKey)));
    }) || null;
  }

  function catalogTeamByName(teamName) {
    const key = slugKey(teamName);
    if (!key) return null;
    return (state.equipesCatalogo || []).find((team) => slugKey(team?.equipe) === key) || null;
  }

  function groupShapeFromTeam(teamName, fallbackRegion = "") {
    const catalogTeam = catalogTeamByName(teamName);
    return {
      equipe: catalogTeam?.equipe || normalizeText(teamName),
      regiao: catalogTeam?.regiao || fallbackRegion || "",
    };
  }

  function afastadosForManager(manager) {
    const teamKeys = new Set([...(manager.equipes || [])].map(slugKey).filter(Boolean));
    if (!teamKeys.size) return 0;
    return afastadoCommercialFuncionarios().filter((item) => (
      funcionarioGestorKey(item) === manager.key &&
      teamKeys.has(funcionarioEquipeKey(item))
    )).length;
  }

  function initialsFromName(value) {
    const parts = normalizeText(value).split(/\s+/).filter(Boolean);
    if (!parts.length) return "7L";
    return `${parts[0][0] || ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
  }

  function itemMeta(item) {
    return toNumber(item.meta_oficial ?? item.meta_valor);
  }

  function itemRealizado(item) {
    return toNumber(item.valor_realizado);
  }

  function itemHasResult(item) {
    return Boolean(item.resultado_existe) || itemRealizado(item) > 0;
  }

  function itemGap(item) {
    return itemRealizado(item) - itemMeta(item);
  }

  function setFeedback(type, message) {
    if (!el.feedback) return;
    el.feedback.textContent = message || "";
    el.feedback.classList.toggle("is-visible", Boolean(message));
    el.feedback.dataset.type = type || "info";
  }

  function selectedOption(select) {
    return select?.options?.[select.selectedIndex] || select?.options?.[0] || null;
  }

  function closeCustomSelect(select = activeCustomSelect) {
    if (!select) return;
    const control = customSelects.get(select);
    if (!control) return;
    control.wrapper.classList.remove("is-open");
    control.button.setAttribute("aria-expanded", "false");
    control.menu.classList.remove("is-open");
    control.menu.hidden = true;
    if (activeCustomSelect === select) activeCustomSelect = null;
  }

  function placeCustomSelectMenu(select) {
    const control = customSelects.get(select);
    if (!control) return;
    const rect = control.button.getBoundingClientRect();
    const gap = 6;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const minWidth = Math.max(rect.width, 150);
    const width = Math.min(Math.max(minWidth, control.menu.scrollWidth || minWidth), viewportWidth - 24);
    const left = Math.min(Math.max(12, rect.left), Math.max(12, viewportWidth - width - 12));
    const spaceBelow = viewportHeight - rect.bottom - gap - 12;
    const spaceAbove = rect.top - gap - 12;
    const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(148, Math.min(320, openAbove ? spaceAbove : spaceBelow));
    control.menu.style.minWidth = `${Math.round(minWidth)}px`;
    control.menu.style.width = `${Math.round(width)}px`;
    control.menu.style.maxHeight = `${Math.round(maxHeight)}px`;
    control.menu.style.left = `${Math.round(left)}px`;
    control.menu.style.top = openAbove
      ? `${Math.round(Math.max(12, rect.top - gap - maxHeight))}px`
      : `${Math.round(Math.min(viewportHeight - 12, rect.bottom + gap))}px`;
  }

  function focusSelectedCustomOption(select) {
    const control = customSelects.get(select);
    if (!control) return;
    const selected = control.menu.querySelector('[aria-selected="true"]');
    const target = selected || control.menu.querySelector(".tl-gc-select__option");
    target?.focus({ preventScroll: true });
  }

  function openCustomSelect(select) {
    const control = customSelects.get(select);
    if (!control || select.disabled) return;
    if (activeCustomSelect && activeCustomSelect !== select) closeCustomSelect(activeCustomSelect);
    syncCustomSelect(select);
    renderCustomSelectMenu(select);
    activeCustomSelect = select;
    control.wrapper.classList.add("is-open");
    control.button.setAttribute("aria-expanded", "true");
    control.menu.hidden = false;
    control.menu.classList.add("is-open");
    placeCustomSelectMenu(select);
    requestAnimationFrame(() => placeCustomSelectMenu(select));
  }

  function selectCustomOption(select, value) {
    const previous = select.value;
    select.value = value;
    syncCustomSelect(select);
    closeCustomSelect(select);
    customSelects.get(select)?.button.focus({ preventScroll: true });
    if (select.value !== previous) {
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function syncCustomSelect(select) {
    const control = customSelects.get(select);
    if (!control) return;
    const option = selectedOption(select);
    const label = normalizeText(option?.textContent || option?.label || select.value || "");
    control.value.textContent = label;
    control.button.title = label;
    control.button.disabled = Boolean(select.disabled);
    if (activeCustomSelect === select && !control.menu.hidden) {
      renderCustomSelectMenu(select);
    }
  }

  function renderCustomSelectMenu(select) {
    const control = customSelects.get(select);
    if (!control) return;
    control.menu.innerHTML = "";
    const options = [...select.options];
    const visibleOptions = options.slice(0, CUSTOM_SELECT_OPTION_RENDER_LIMIT);
    const selected = options.find((item) => item.value === select.value);
    if (selected && !visibleOptions.some((item) => item.value === selected.value)) {
      visibleOptions.push(selected);
    }
    const fragment = document.createDocumentFragment();
    visibleOptions.forEach((item) => {
      const optionButton = document.createElement("button");
      optionButton.type = "button";
      optionButton.className = "tl-gc-select__option";
      optionButton.setAttribute("role", "option");
      optionButton.setAttribute("aria-selected", item.value === select.value ? "true" : "false");
      optionButton.dataset.value = item.value;
      optionButton.textContent = item.textContent || item.value;
      optionButton.addEventListener("click", () => selectCustomOption(select, item.value));
      optionButton.addEventListener("keydown", (event) => {
        const options = [...control.menu.querySelectorAll(".tl-gc-select__option")];
        const index = options.indexOf(optionButton);
        if (event.key === "ArrowDown") {
          event.preventDefault();
          options[Math.min(options.length - 1, index + 1)]?.focus({ preventScroll: true });
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          options[Math.max(0, index - 1)]?.focus({ preventScroll: true });
        } else if (event.key === "Home") {
          event.preventDefault();
          options[0]?.focus({ preventScroll: true });
        } else if (event.key === "End") {
          event.preventDefault();
          options[options.length - 1]?.focus({ preventScroll: true });
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          optionButton.click();
        } else if (event.key === "Escape") {
          event.preventDefault();
          closeCustomSelect(select);
          control.button.focus({ preventScroll: true });
        }
      });
      fragment.appendChild(optionButton);
    });
    if (options.length > visibleOptions.length) {
      const message = document.createElement("div");
      message.className = "tl-gc-select__option tl-gc-select__option--notice";
      message.textContent = `Mostrando ${formatNumber(visibleOptions.length)} De ${formatNumber(options.length)} Opções. Use Os Filtros Para Refinar A Lista.`;
      fragment.appendChild(message);
    }
    control.menu.appendChild(fragment);
    if (activeCustomSelect === select) placeCustomSelectMenu(select);
  }

  function enhanceCustomSelect(select) {
    if (!select || customSelects.has(select)) {
      if (select) syncCustomSelect(select);
      return;
    }
    const wrapper = document.createElement("span");
    const isStandalone = select.classList.contains("tl-gc-mini-select");
    const isTable = Boolean(select.closest(".tl-gc-table-tools"));
    wrapper.className = [
      "tl-gc-select",
      isStandalone ? "tl-gc-select--standalone tl-gc-select--mini" : "",
      isTable ? "tl-gc-select--table" : "",
    ].filter(Boolean).join(" ");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tl-gc-select__button";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", select.getAttribute("aria-label") || "Selecionar filtro");
    const value = document.createElement("span");
    value.className = "tl-gc-select__value";
    const chevron = document.createElement("span");
    chevron.className = "tl-gc-select__chevron";
    chevron.setAttribute("aria-hidden", "true");
    button.append(value, chevron);
    wrapper.appendChild(button);
    const menu = document.createElement("div");
    menu.className = "tl-gc-select__menu";
    menu.hidden = true;
    menu.setAttribute("role", "listbox");
    menu.id = `${select.id || `gc-select-${customSelects.size + 1}`}-menu`;
    button.setAttribute("aria-controls", menu.id);
    document.body.appendChild(menu);
    select.classList.add("tl-gc-select-native");
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;
    select.insertAdjacentElement("afterend", wrapper);
    customSelects.set(select, { wrapper, button, menu, value });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (activeCustomSelect === select) closeCustomSelect(select);
      else openCustomSelect(select);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCustomSelect(select);
        focusSelectedCustomOption(select);
      } else if (event.key === "Escape") {
        closeCustomSelect(select);
      }
    });
    select.addEventListener("change", () => syncCustomSelect(select));
    syncCustomSelect(select);
  }

  function enhanceCustomSelects() {
    document.querySelectorAll(".tl-dashboard-gc-page select").forEach(enhanceCustomSelect);
  }

  document.addEventListener("click", (event) => {
    if (!activeCustomSelect) return;
    const control = customSelects.get(activeCustomSelect);
    if (!control) return;
    if (control.wrapper.contains(event.target) || control.menu.contains(event.target)) return;
    closeCustomSelect(activeCustomSelect);
  });

  document.addEventListener("click", (event) => {
    if (!activeDatePicker) return;
    const control = datePickers.get(activeDatePicker);
    if (!control) return;
    if (control.wrapper.contains(event.target) || control.menu.contains(event.target)) return;
    closeDatePicker(activeDatePicker);
  });

  window.addEventListener("resize", () => {
    closeCustomSelect();
    closeDatePicker();
    scheduleResponsiveTableRender();
  });
  window.addEventListener("scroll", (event) => {
    if (activeCustomSelect) {
      const control = customSelects.get(activeCustomSelect);
      if (!control?.menu.contains(event.target)) closeCustomSelect(activeCustomSelect);
    }
    if (activeDatePicker) {
      const control = datePickers.get(activeDatePicker);
      if (!control?.menu.contains(event.target)) closeDatePicker(activeDatePicker);
    }
  }, true);

  function fillSelect(select, items, valueKey, labelGetter, placeholder, limit = Infinity) {
    if (!select) return;
    const current = select.value;
    const normalizedItems = (Array.isArray(items) ? items : []).map((item) => {
      const value = normalizeText(item?.[valueKey]);
      if (!value) return null;
      const label = typeof labelGetter === "function" ? labelGetter(item) : item?.[labelGetter];
      return { value, label: label || value };
    }).filter(Boolean);
    const limitedItems = Number.isFinite(limit)
      ? normalizedItems.slice(0, Math.max(0, limit))
      : normalizedItems;
    if (current && !limitedItems.some((item) => item.value === current)) {
      const selectedItem = normalizedItems.find((item) => item.value === current);
      if (selectedItem) limitedItems.push(selectedItem);
    }
    const options = [`<option value="">${escapeHtml(placeholder)}</option>`];
    limitedItems.forEach((item) => {
      options.push(`<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`);
    });
    select.innerHTML = options.join("");
    if (current && limitedItems.some((item) => item.value === current)) {
      select.value = current;
    }
    syncCustomSelect(select);
  }

  function currentSaoPauloPeriod() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "numeric",
    }).formatToParts(new Date());
    const mes = Number(parts.find((part) => part.type === "month")?.value || new Date().getMonth() + 1);
    const ano = Number(parts.find((part) => part.type === "year")?.value || new Date().getFullYear());
    return { mes, ano };
  }

  function normalizePeriod(period = {}) {
    const fallback = currentSaoPauloPeriod();
    const mes = Number(period.mes);
    const ano = Number(period.ano);
    return {
      mes: Number.isInteger(mes) && mes >= 1 && mes <= 12 ? mes : fallback.mes,
      ano: Number.isInteger(ano) && ano >= 2020 && ano <= 2100 ? ano : fallback.ano,
    };
  }

  function populatePeriod() {
    const current = currentSaoPauloPeriod();
    let createdMonthOptions = false;
    if (el.filtroMes && !el.filtroMes.options.length) {
      MONTHS.forEach((name, index) => {
        el.filtroMes.insertAdjacentHTML("beforeend", `<option value="${index + 1}">${name}</option>`);
      });
      createdMonthOptions = true;
    }
    if (el.filtroMes && (createdMonthOptions || !Number(el.filtroMes.value))) {
      el.filtroMes.value = String(current.mes);
      syncCustomSelect(el.filtroMes);
    }
    if (el.filtroAno && !el.filtroAno.value) {
      el.filtroAno.value = String(current.ano);
    }
  }

  function populateReferenceFilters() {
    const colaboradores = activeCommercialFuncionarios();
    const regioes = [...new Map([
      ...colaboradores.map((item) => funcionarioRegiao(item)),
      ...(state.equipesCatalogo || []).map((item) => catalogTeamRegion(item)),
    ].map((label) => [slugKey(label), { key: normalizeText(label), label: normalizeText(label) }])).values()]
      .filter((item) => item.key)
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    const equipes = [...new Map([
      ...colaboradores.map((item) => [
        funcionarioEquipeKey(item),
        { key: funcionarioEquipeKey(item), label: funcionarioEquipe(item) },
      ]),
      ...(state.equipesCatalogo || []).map((item) => {
        const label = catalogTeamName(item);
        return [slugKey(label), { key: slugKey(label), label }];
      }),
    ]).values()].filter((item) => item.key).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    const gestores = [...new Map(colaboradores.map((item) => [
      funcionarioGestorKey(item),
      { key: funcionarioGestorKey(item), label: funcionarioGestor(item) },
    ])).values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    const focos = dashboardFocusOptions(colaboradores);
    fillSelect(el.filtroRegiao, regioes, "key", "label", "Todas");
    fillSelect(el.filtroEquipe, equipes, "key", "label", "Todas");
    fillSelect(el.filtroFoco, focos, "key", "label", "Todos");
    fillSelect(el.filtroGestor, gestores, "key", "label", "Todos");
  }

  function getFilters(overrides = {}) {
    return {
      mes: el.filtroMes?.value || "",
      ano: el.filtroAno?.value || "",
      regiao: el.filtroRegiao?.value || "",
      equipe: el.filtroEquipe?.value || "",
      gestor: el.filtroGestor?.value || "",
      ...overrides,
    };
  }

  function getMetaFilters(overrides = {}) {
    return {
      mes: el.filtroMes?.value || "",
      ano: el.filtroAno?.value || "",
      ...overrides,
    };
  }

  function currentPeriodKey() {
    return normalizePeriod({
      mes: el.filtroMes?.value,
      ano: el.filtroAno?.value,
    });
  }

  function monthShift(mes, ano, offset) {
    const date = new Date(Number(ano), Number(mes) - 1 + Number(offset || 0), 1);
    return { mes: date.getMonth() + 1, ano: date.getFullYear() };
  }

  function teamType(group) {
    const equipe = normalizeKey(group.equipe);
    const vinculos = [...(group.vinculos || [])].map(normalizeKey);
    if (equipe.includes("autonom") || vinculos.includes("autonomo")) return "Autônomos";
    if (equipe.includes("imobili") || equipe.includes("beiramar") || equipe.includes("parceir")) return "Parceiros";
    return "Interna";
  }

  function classifyTeam(group) {
    if (group.objetivos <= 0) return { label: "Imobiliária", key: "sem_meta" };
    if (group.atingimento >= 105) return { label: "Acima do Alvo", key: "acima" };
    if (group.atingimento >= 100) return { label: "Completa", key: "completa" };
    if (group.headcountGap < -Math.max(2, Math.ceil(group.pessoasTotal * .35))) return { label: "Crítica", key: "critica" };
    if (group.atingimento >= 85) return { label: "Abaixo Do Alvo", key: "abaixo" };
    return { label: "Crítica", key: "critica" };
  }

  function classifyManagerSummary(group) {
    if (group.meta <= 0) return { label: "Imobiliária", key: "sem_meta" };
    if (group.pessoasTotal > group.meta) return { label: "Acima do Alvo", key: "acima" };
    if (group.pessoasTotal === group.meta) return { label: "Completa", key: "completa" };
    if (group.pessoasTotal >= Math.ceil(group.meta * .85)) return { label: "Abaixo Do Alvo", key: "abaixo" };
    return { label: "Crítica", key: "critica" };
  }

  function createdDate(item) {
    const raw = item.data_admissao || item.data_inicio_vigencia || item.data_hora_criacao || item.created_at || item.data_inicio || item.updated_at;
    const text = String(raw || "").trim();
    let date = null;
    const brDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brDate) {
      date = new Date(Number(brDate[3]), Number(brDate[2]) - 1, Number(brDate[1]));
    } else {
      date = text ? new Date(text) : null;
    }
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function averageTenureLabelFromMonths(totalMonths) {
    const months = Math.max(0, Math.round(toNumber(totalMonths)));
    if (months <= 0) return "Menos de 1 mês";
    if (months < 12) return months === 1 ? "1 mês" : `${formatNumber(months)} meses`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    const yearLabel = years === 1 ? "1 ano" : `${formatNumber(years)} anos`;
    if (!remainingMonths) return yearLabel;
    const monthLabel = remainingMonths === 1 ? "1 mês" : `${formatNumber(remainingMonths)} meses`;
    return `${yearLabel} e ${monthLabel}`;
  }

  function tenureLabel(group) {
    const dates = group.createdDates || [];
    if (!dates.length) return "-";
    const now = Date.now();
    const avgMs = dates.reduce((sum, date) => sum + Math.max(now - date.getTime(), 0), 0) / dates.length;
    const months = avgMs / (365.25 * 24 * 60 * 60 * 1000) * 12;
    return averageTenureLabelFromMonths(months);
  }

  const TITLE_CASE_ACRONYMS = new Set(["AD", "AGL", "API", "CAT", "CPF", "CNPJ", "CLT", "DF", "FGTS", "FSA", "GC", "HC", "ID", "IPC", "PJ", "QLP", "RH", "SLA", "URL"]);

  function titleCaseDisplay(value) {
    const text = String(value ?? "").trim();
    if (!text || text === "-") return text || "-";
    return text.replace(/\p{L}[\p{L}\p{M}]*(?:-[\p{L}\p{M}]+)*/gu, (word) => {
      const upper = word.toLocaleUpperCase("pt-BR");
      if (TITLE_CASE_ACRONYMS.has(upper) || (word === upper && upper.length > 1)) return upper;
      const lower = word.toLocaleLowerCase("pt-BR");
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    });
  }

  const TITLE_CASE_STATIC_SELECTORS = [
    ".tl-gc-heading .tl-gc-eyebrow",
    ".tl-gc-heading h1",
    ".tl-gc-heading p",
    ".tl-gc-filter",
    ".tl-gc-kpi > span",
    ".tl-gc-kpi > small",
    ".tl-gc-panel__head h2",
    ".tl-gc-side-head h2",
    ".tl-gc-table-head h2",
    ".tl-gc-table-head p",
    ".tl-gc-table th",
    ".tl-gc-table-tools label",
    ".tl-gc-view-head h2",
    ".tl-gc-view-head p",
    ".tl-gc-view-metric",
    ".tl-gc-insight-card",
    ".tl-gc-insight-metric",
    ".tl-gc-insight-list__item",
    ".tl-gc-insight-progress__labels",
    ".tl-gc-tab-view .tl-gc-table-head",
    ".tl-gc-tab-view--produtividade",
    ".tl-gc-corretor-modal",
    ".tl-gc-th-label",
    ".tl-gc-productivity-toolbar label",
    ".tl-gc-rule-hero span",
    ".tl-gc-rule-hero h3",
    ".tl-gc-rule-hero p",
    ".tl-gc-rule-hero li",
    ".tl-gc-rule-card span",
    ".tl-gc-rule-card h3",
    ".tl-gc-rule-card p",
    ".tl-gc-rule-card li",
    ".tl-gc-modal__head span",
    ".tl-gc-modal__head h2",
    ".tl-gc-modal__head p",
    ".tl-gc-form-grid label",
    ".tl-gc-form-field",
    ".tl-gc-form-field--wide",
    ".tl-gc-vaga-timeline-head strong",
    ".tl-gc-vaga-timeline-head span",
    ".tl-gc-sync-status",
    ".tl-gc-empty",
  ].join(",");

  function titleCaseElementText(root) {
    if (!root) return;
    root.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const value = node.nodeValue || "";
        const start = value.match(/^\s*/)?.[0] || "";
        const end = value.match(/\s*$/)?.[0] || "";
        const content = value.trim();
        if (content) node.nodeValue = `${start}${titleCaseDisplay(content)}${end}`;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (["SCRIPT", "STYLE", "INPUT", "TEXTAREA"].includes(node.tagName)) return;
      titleCaseElementText(node);
    });
  }

  function applyTitleCaseStaticContent(scope = document) {
    const root = scope || document;
    const targets = new Set([...root.querySelectorAll(TITLE_CASE_STATIC_SELECTORS)]);
    if (root.matches?.(TITLE_CASE_STATIC_SELECTORS)) targets.add(root);
    targets.forEach(titleCaseElementText);
    root.querySelectorAll(".tl-gc-main input[placeholder], .tl-gc-main textarea[placeholder]").forEach((field) => {
      const placeholder = field.getAttribute("placeholder");
      if (placeholder) field.setAttribute("placeholder", titleCaseDisplay(placeholder));
    });
    applyHeadingTitleCaseOverrides();
  }

  function applyHeadingTitleCaseOverrides() {
    const heading = document.querySelector(".tl-gc-heading");
    if (!heading) return;
    const eyebrow = heading.querySelector(".tl-gc-eyebrow");
    const title = heading.querySelector("h1");
    const description = heading.querySelector("p");
    if (eyebrow) eyebrow.textContent = "Base Gente E Cultura";
    if (title) title.textContent = "Gestão De Pessoas & Cultura";
    if (description) description.textContent = "Visão Integrada De Equipes, Headcount, Vagas E Senioridade Para Apoiar Decisões Estruturais E Operacionais.";
  }

  function tenureMonthsFromDate(date) {
    if (!date) return null;
    const months = Math.max(0, (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000) * 12);
    return Number.isFinite(months) ? months : null;
  }

  function managerTenureStage(months) {
    if (months === null || months === undefined || !Number.isFinite(months)) {
      return { key: "unknown", label: "Sem data", shortLabel: "Sem data", percent: 0 };
    }
    if (months <= 3) {
      return { key: "rookie", label: "Novato", shortLabel: "0-3 meses", percent: Math.max(10, Math.min(33, (months / 3) * 33)) };
    }
    if (months <= 8) {
      return { key: "veteran", label: "Veterano", shortLabel: "4-8 meses", percent: 33 + Math.min(34, ((months - 3) / 5) * 34) };
    }
    return { key: "plus", label: "Veterano Plus", shortLabel: "9+ meses", percent: Math.min(100, 67 + Math.min(33, ((months - 8) / 16) * 33)) };
  }

  function managerTenureInfo(managerName) {
    const key = slugKey(managerName);
    if (!key) return { label: "-", months: null, stage: managerTenureStage(null), found: false };
    const manager = (state.funcionarios || []).find((item) => slugKey(funcionarioNome(item)) === key) || null;
    const months = tenureMonthsFromDate(createdDate(manager || {}));
    return {
      label: months === null ? "-" : averageTenureLabelFromMonths(months),
      months,
      stage: managerTenureStage(months),
      found: Boolean(manager),
      cargo: manager ? funcionarioCargo(manager) : "",
    };
  }

  function managerTenureHtml(group) {
    const info = group.gestorTempo || managerTenureInfo(group.gestorLabel);
    const stage = info.stage || managerTenureStage(info.months);
    const vacant = Boolean(group?.gestorVago || isOpenLeadershipValue(group?.gestorLabel));
    const percent = Math.max(0, Math.min(100, toNumber(stage.percent)));
    const stageShort = stage.key === "rookie" ? "0-3m" : stage.key === "veteran" ? "4-8m" : stage.key === "plus" ? "9m+" : "-";
    const footLabel = vacant ? "Vaga Aberta" : stage.label;
    return `
      <div class="tl-gc-manager-tenure ${vacant ? "is-vacant" : ""}" title="${escapeHtml(vacant ? "Gerente de vendas em aberto: vaga aberta" : `Tempo de casa do gestor: ${info.label || "-"} | ${stage.label}`)}">
        <div class="tl-gc-manager-tenure__head">
          <strong>${escapeHtml(group.gestorLabel || "-")}</strong>
          <span class="tl-gc-manager-tenure__time">${escapeHtml(stageShort)}</span>
        </div>
        <div class="tl-gc-manager-thermo is-${escapeHtml(stage.key)}" style="--thermo:${percent}%;">
          <span></span>
        </div>
        <div class="tl-gc-manager-tenure__foot">
          <span>${escapeHtml(footLabel)}</span>
        </div>
      </div>
    `;
  }

  function normalizePlannedFocus(value = []) {
    let source = value;
    if (typeof source === "string") {
      try {
        source = JSON.parse(source);
      } catch {
        source = [];
      }
    }
    if (!Array.isArray(source)) return [];
    return source.map((item) => {
      const label = normalizeText(item?.foco || item?.nivel || item?.nome || item?.regiao);
      const count = toNumber(item?.quantidade ?? item?.hc ?? item?.vagas);
      return label ? { label, count } : null;
    }).filter(Boolean);
  }

  function focusDisplayLabel(label) {
    const text = normalizeText(label);
    return slugKey(text) === "df" ? "DF" : text;
  }

  function focusLabelsFromValue(value) {
    const text = normalizeText(value);
    if (!text) return [];
    return text
      .split(/[;,/]+/)
      .map(normalizeText)
      .filter(Boolean)
      .map((label) => ({ key: slugKey(label), label: focusDisplayLabel(label) }))
      .filter((item) => item.key && item.key !== "sem_foco");
  }

  function addFocusKeys(target, value) {
    focusLabelsFromValue(value).forEach((item) => target.add(item.key));
  }

  function addFocusOption(target, value) {
    focusLabelsFromValue(value).forEach((item) => {
      if (!target.has(item.key)) target.set(item.key, item);
    });
  }

  function catalogTeamFocusKeys(team) {
    const keys = new Set();
    catalogTeamPlannedFocus(team).forEach((item) => addFocusKeys(keys, item.label || item.foco || item.nome || item.regiao));
    return keys;
  }

  function funcionarioFocusKeys(item) {
    const keys = new Set();
    addFocusKeys(keys, funcionarioFoco(item));
    catalogTeamFocusKeys(catalogTeamByName(funcionarioEquipe(item))).forEach((key) => keys.add(key));
    return keys;
  }

  function funcionarioMatchesFoco(item, focoKey) {
    if (!focoKey) return true;
    return funcionarioFocusKeys(item).has(focoKey);
  }

  function catalogTeamMatchesFoco(team, focoKey) {
    if (!focoKey) return true;
    return catalogTeamFocusKeys(team).has(focoKey);
  }

  function groupFocoKeys(group) {
    const keys = new Set();
    (group.focosPlanejados || []).forEach((item) => addFocusKeys(keys, item.label || item.foco || item.nome || item.regiao));
    (group.items || []).forEach((item) => funcionarioFocusKeys(item).forEach((key) => keys.add(key)));
    [...(group.equipes || [])].forEach((teamName) => {
      catalogTeamFocusKeys(catalogTeamByName(teamName)).forEach((key) => keys.add(key));
    });
    return keys;
  }

  function dashboardFocusOptions(colaboradores = activeCommercialFuncionarios()) {
    const focos = new Map();
    colaboradores.forEach((item) => addFocusOption(focos, funcionarioFoco(item)));
    (state.equipesCatalogo || []).forEach((team) => {
      catalogTeamPlannedFocus(team).forEach((item) => addFocusOption(focos, item.label || item.foco || item.nome || item.regiao));
    });
    return [...focos.values()]
      .filter((item) => item.key !== "sede")
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }

  function plannedFocusSummaryEntries(group) {
    const rows = Array.isArray(group?.focosPlanejados) ? group.focosPlanejados : [];
    if (!rows.length) return [];
    const counts = new Map();
    rows.forEach((item) => {
      const label = focusDisplayLabel(item.label || item.foco || item.nome || item.regiao);
      const count = toNumber(item.count ?? item.quantidade ?? item.hc ?? item.vagas);
      if (!label) return;
      const key = slugKey(label) || "sem_foco";
      const current = counts.get(key) || { label, count: 0 };
      current.count += count;
      counts.set(key, current);
    });
    return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  }

  function focusSummaryEntries(group) {
    const planned = plannedFocusSummaryEntries(group);
    if (planned.length) return planned;
    const counts = new Map();
    (group.items || [])
      .filter(isActiveFuncionario)
      .forEach((item) => {
        const label = focusDisplayLabel(funcionarioFoco(item)) || "Sem foco";
        const key = slugKey(label) || "sem_foco";
        const current = counts.get(key) || { label, count: 0 };
        current.count += 1;
        counts.set(key, current);
      });
    return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  }

  function focusSummaryText(group, includeCounts = true) {
    const entries = focusSummaryEntries(group);
    if (!entries.length) return "-";
    return entries.map((entry) => `${entry.label}${includeCounts && entry.count > 1 ? ` (${formatNumber(entry.count)})` : ""}`).join(", ");
  }

  function focusSummaryHtml(group) {
    const planned = plannedFocusSummaryEntries(group);
    const text = planned.length
      ? planned.map((entry) => entry.label).join(", ")
      : focusSummaryText(group, false);
    return `<span class="tl-gc-focus-summary" title="${escapeHtml(text)}">${escapeHtml(text)}</span>`;
  }

  function commercialManagerText(group) {
    return commercialManagerEntriesText(group?.gerentesComerciaisDetalhados || []);
  }

  function commercialManagerHtml(group) {
    const entries = group?.gerentesComerciaisDetalhados || [];
    if (!entries.length) {
      return `<span class="tl-gc-commercial-manager is-empty">-</span>`;
    }
    const title = entries.map((entry) => `${entry.equipe}: ${entry.label}`).join(" | ");
    if (entries.length === 1) {
      const entry = entries[0];
      return `
        <span class="tl-gc-commercial-manager${entry.vacant ? " is-vacant" : ""}" title="${escapeHtml(title)}">
          <strong>${escapeHtml(entry.label)}</strong>
          <small>${escapeHtml(entry.vacant ? "Vaga aberta" : entry.equipe)}</small>
        </span>
      `;
    }
    const visible = entries.slice(0, 2).map((entry) => entry.label).join(", ");
    const hidden = entries.length - 2;
    return `
      <span class="tl-gc-commercial-manager" title="${escapeHtml(title)}">
        <strong>${escapeHtml(`${formatNumber(entries.length)} gerentes comerciais`)}</strong>
        <small>${escapeHtml(hidden > 0 ? `${visible} +${formatNumber(hidden)}` : visible)}</small>
      </span>
    `;
  }

  function compareActivePeople() {
    const currentPeople = filteredFuncionarios().length;
    const totalPeople = activeCommercialFuncionarios().length;
    if (currentPeople !== totalPeople) {
      return { currentPeople, deltaText: `Filtro: ${formatNumber(currentPeople)} de ${formatNumber(totalPeople)}` };
    }
    return {
      currentPeople,
      deltaText: "Headcount",
    };
  }

  function classifyVagaStatus(item) {
    const meta = itemMeta(item);
    const realizado = itemRealizado(item);
    const status = normalizeKey(item.status_resultado);
    if (status.includes("cancel")) return { label: "Canceladas", key: "cancelada" };
    if (!itemHasResult(item) && meta <= 0) return { label: "Abertas", key: "aberta" };
    if (!itemHasResult(item)) return { label: "Aguardando Solicitação De Vaga", key: "aguardando" };
    if (meta > 0 && realizado >= meta) return { label: "Preenchidas", key: "preenchida" };
    return { label: "Em encaminhamento", key: "encaminhamento" };
  }

  function objetivosIndex() {
    const map = new Map();
    (state.dashboard.itens || []).forEach((item) => {
      metaIdentityKeys(item).forEach((key) => {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
      });
    });
    return map;
  }

  function objetivosDoFuncionario(funcionario, index = objetivosIndex()) {
    const matched = new Map();
    funcionarioIdentityKeys(funcionario).forEach((key) => {
      (index.get(key) || []).forEach((item, itemIndex) => {
        matched.set(String(item.id || `${key}-${item.indicador_codigo || ""}-${itemIndex}`), item);
      });
    });
    return [...matched.values()];
  }

  function renderUser(user) {
    const name = user?.nome_completo || user?.name || user?.nome || "7LM";
    const email = user?.correio_eletronico || user?.email || "Sessão ativa";
    if (el.nomeUsuario) el.nomeUsuario.textContent = name;
    if (el.metaUsuario) el.metaUsuario.textContent = email;
    if (el.userInitials) el.userInitials.textContent = initialsFromName(name);
  }

  async function loadUser() {
    const cached = portalState?.getFreshUser?.();
    if (cached) {
      state.user = cached;
      renderUser(cached);
      return;
    }
    const payload = await api(ENDPOINTS.me);
    const user = payload?.usuario || payload?.user || payload?.data || payload;
    state.user = user;
    portalState?.cacheUser?.(user);
    renderUser(user);
  }

  async function loadReferences() {
    const payload = await api(ENDPOINTS.referencias);
    state.referencias = payload?.referencias || state.referencias;
    populateReferenceFilters();
  }

  async function loadFuncionarios() {
    const payload = await api(withQuery(ENDPOINTS.funcionarios, { limite: 1000 }));
    state.funcionarios = Array.isArray(payload?.items) ? payload.items : [];
    populateReferenceFilters();
  }

  async function loadEquipesCatalogo() {
    try {
      const payload = await api(withQuery(ENDPOINTS.equipesFuncionarios, { limite: 2000 }));
      state.equipesCatalogo = Array.isArray(payload?.items) ? payload.items : [];
    } catch {
      state.equipesCatalogo = [];
    }
    populateReferenceFilters();
  }

  async function loadVagasManuais() {
    const payload = await api(withQuery(ENDPOINTS.vagasGc, { limite: 1000 }));
    state.vagasManuais = Array.isArray(payload?.items) ? payload.items : [];
  }

  async function loadForecastsManuais() {
    const { mes, ano } = currentPeriodKey();
    const payload = await api(withQuery(ENDPOINTS.forecastGc, { mes, ano, limite: 1000 }));
    state.forecastsManuais = Array.isArray(payload?.items) ? payload.items : [];
  }

  async function loadForecastHistorico() {
    const { mes, ano } = currentPeriodKey();
    const payload = await api(withQuery(ENDPOINTS.forecastHistoricoGc, { mes, ano, limite: 200 }));
    state.forecastHistorico = Array.isArray(payload?.items) ? payload.items : [];
  }

  function produtividadeQueryFilters() {
    const { mes, ano } = currentPeriodKey();
    return {
      mes,
      ano,
      coordenador: el.filtroProdutividadeCoordenador?.value || "",
      gerente: el.filtroProdutividadeGerente?.value || "",
      equipe: el.filtroProdutividadeEquipe?.value || "",
      corretor: el.filtroProdutividadeCorretor?.value || "",
    };
  }

  function fillProdutividadeFilters(payload) {
    const filtros = payload?.filtros || {};
    fillSelect(el.filtroProdutividadeCoordenador, filtros.coordenadores || [], "key", "label", "Todos");
    fillSelect(el.filtroProdutividadeGerente, filtros.gerentes || [], "key", "label", "Todos");
    fillSelect(el.filtroProdutividadeEquipe, filtros.equipes || [], "key", "label", "Todas");
    fillSelect(el.filtroProdutividadeCorretor, filtros.corretores || [], "key", "label", "Todos", CUSTOM_SELECT_OPTION_RENDER_LIMIT);
  }

  async function loadProdutividade() {
    try {
      const payload = await api(withQuery(ENDPOINTS.produtividadeGc, produtividadeQueryFilters()));
      state.produtividade = {
        resumo: payload?.resumo || {},
        coordenadores: Array.isArray(payload?.coordenadores) ? payload.coordenadores : [],
        gerentes: Array.isArray(payload?.gerentes) ? payload.gerentes : [],
        corretores: Array.isArray(payload?.corretores) ? payload.corretores : [],
        filtros: payload?.filtros || {},
        status_sync: payload?.status_sync || {},
        ultima_sincronizacao: payload?.ultima_sincronizacao || null,
      };
      state.produtividadeLoaded = true;
      fillProdutividadeFilters(payload);
    } catch (error) {
      state.produtividade = { resumo: {}, coordenadores: [], gerentes: [], corretores: [], filtros: {}, status_sync: { status: "error", message: error?.message || "" } };
      state.produtividadeLoaded = true;
      fillProdutividadeFilters({});
    }
  }

  async function ensureProdutividadeLoaded(options = {}) {
    if (state.activeTab !== "produtividade") return;
    if (!options.force && state.produtividadeLoaded) {
      renderProdutividadeView();
      updateDebugSnapshot();
      return;
    }
    if (produtividadeLoadingPromise) return produtividadeLoadingPromise;
    setFeedback("info", "Carregando Produtividade...");
    produtividadeLoadingPromise = (async () => {
      await loadProdutividade();
      renderProdutividadeView();
      updateDebugSnapshot();
      setFeedback("", "");
    })().finally(() => {
      produtividadeLoadingPromise = null;
    });
    return produtividadeLoadingPromise;
  }

  function comercialQueryFilters() {
    const { mes, ano } = currentPeriodKey();
    return {
      mes,
      ano,
      coordenador: el.filtroComercialCoordenador?.value || "",
      gerente: el.filtroComercialGerente?.value || "",
      equipe: el.filtroComercialEquipe?.value || "",
      corretor: el.filtroComercialCorretor?.value || "",
      visao: "comercial",
      limite_corretores: COMERCIAL_CORRETORES_API_LIMIT,
    };
  }

  function fillComercialFilters(payload) {
    const filtros = payload?.filtros || {};
    fillSelect(el.filtroComercialCoordenador, filtros.coordenadores || [], "key", "label", "Todos");
    fillSelect(el.filtroComercialGerente, filtros.gerentes || [], "key", "label", "Todos");
    fillSelect(el.filtroComercialEquipe, filtros.equipes || [], "key", "label", "Todas");
    fillSelect(el.filtroComercialCorretor, filtros.corretores || [], "key", "label", "Todos", CUSTOM_SELECT_OPTION_RENDER_LIMIT);
  }

  async function loadComercial() {
    invalidateComercialRenderCache();
    try {
      traceComercialStage("load:start");
      const payload = await api(withQuery(ENDPOINTS.produtividadeGc, comercialQueryFilters()));
      traceComercialStage("load:api-ok");
      state.comercial = {
        resumo: payload?.resumo || {},
        coordenadores: Array.isArray(payload?.coordenadores) ? payload.coordenadores : [],
        gerentes: Array.isArray(payload?.gerentes) ? payload.gerentes : [],
        equipes: Array.isArray(payload?.equipes) ? payload.equipes : [],
        corretores: Array.isArray(payload?.corretores) ? payload.corretores : [],
        corretores_total: toNumber(payload?.corretores_total) || (Array.isArray(payload?.corretores) ? payload.corretores.length : 0),
        corretores_renderizados: toNumber(payload?.corretores_renderizados) || (Array.isArray(payload?.corretores) ? payload.corretores.length : 0),
        corretores_limitados: Boolean(payload?.corretores_limitados),
        filtros: payload?.filtros || {},
        status_sync: payload?.status_sync || {},
        ultima_sincronizacao: payload?.ultima_sincronizacao || null,
      };
      state.comercialLoaded = true;
      traceComercialStage("load:state-ok");
      fillComercialFilters(payload);
      traceComercialStage("load:filters-ok");
    } catch (error) {
      state.comercial = { resumo: {}, coordenadores: [], gerentes: [], equipes: [], corretores: [], corretores_total: 0, corretores_renderizados: 0, corretores_limitados: false, filtros: {}, status_sync: { status: "error", message: error?.message || "" } };
      state.comercialLoaded = true;
      fillComercialFilters({});
    }
  }

  function renderComercialLoading() {
    if (el.comercialUltimaSync) {
      el.comercialUltimaSync.classList.remove("is-error");
      el.comercialUltimaSync.textContent = "Carregando Databricks";
    }
    if (el.metricasComercialGc) {
      el.metricasComercialGc.innerHTML = `<div class="tl-gc-empty">Carregando Dashboard Comercial...</div>`;
    }
    if (el.comercialEquipesCards) {
      el.comercialEquipesCards.innerHTML = `<div class="tl-gc-empty">Carregando equipes comerciais...</div>`;
    }
    if (el.comercialFunilGc) {
      el.comercialFunilGc.innerHTML = `<div class="tl-gc-empty">Carregando funil comercial...</div>`;
    }
    if (el.tabelaComercialRankingEquipes) {
      el.tabelaComercialRankingEquipes.innerHTML = `<tr><td colspan="7"><div class="tl-gc-empty">Carregando ranking das equipes...</div></td></tr>`;
    }
    if (el.comercialAcoesGestao) {
      el.comercialAcoesGestao.innerHTML = `<div class="tl-gc-empty">Carregando prioridades comerciais...</div>`;
    }
    if (el.tabelaComercialRankingCorretores) {
      el.tabelaComercialRankingCorretores.innerHTML = `<tr><td colspan="9"><div class="tl-gc-empty">Carregando ranking individual...</div></td></tr>`;
    }
  }

  async function ensureComercialLoaded(options = {}) {
    if (state.activeTab !== "comercial") return;
    if (!options.force && state.comercialLoaded) {
      renderComercialView();
      updateDebugSnapshot();
      return;
    }
    if (comercialLoadingPromise) return comercialLoadingPromise;
    renderComercialLoading();
    setFeedback("info", "Carregando Dashboard Comercial...");
    comercialLoadingPromise = (async () => {
      await loadComercial();
      renderComercialView();
      updateDebugSnapshot();
      setFeedback("", "");
    })().finally(() => {
      comercialLoadingPromise = null;
    });
    return comercialLoadingPromise;
  }

  async function loadDashboard() {
    const filters = getMetaFilters();
    const current = await api(withQuery(ENDPOINTS.dashboard, filters));
    state.dashboard = {
      resumo: current?.resumo || {},
      itens: current?.itens || [],
    };

    const currentMonth = Number(filters.mes || new Date().getMonth() + 1);
    const currentYear = Number(filters.ano || new Date().getFullYear());
    const periods = [-5, -4, -3, -2, -1, 0].map((offset) => monthShift(currentMonth, currentYear, offset));
    state.evolution = await Promise.all(periods.map(async (period) => {
      const payload = await api(withQuery(ENDPOINTS.dashboard, { ...filters, mes: period.mes, ano: period.ano }));
      const resumo = payload?.resumo || {};
      const itens = Array.isArray(payload?.itens) ? payload.itens : [];
      return {
        mes: period.mes,
        ano: period.ano,
        label: `${MONTHS[period.mes - 1]}/${String(period.ano).slice(-2)}`,
        meta: toNumber(resumo.meta_total),
        realizado: toNumber(resumo.realizado),
        gap: toNumber(resumo.realizado) - toNumber(resumo.meta_total),
        itemCount: itens.length,
        peopleCount: new Set(itens.map((item) => item.usuario_id).filter(Boolean)).size,
      };
    }));
  }

  function buildTeamGroups() {
    const index = objetivosIndex();
    const groups = new Map();
    filteredFuncionarios().forEach((funcionario) => {
      if (!isActiveFuncionario(funcionario)) return;
      const equipe = funcionarioEquipe(funcionario);
      const regiao = funcionarioRegiao(funcionario);
      const gestorLabel = funcionarioGestor(funcionario);
      const key = `${funcionarioEquipeKey(funcionario)}::${funcionarioGestorKey(funcionario)}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          regiao,
          equipe,
          gestorLabel,
          pessoas: new Set(),
          pessoasComObjetivo: new Set(),
          objetivos: 0,
          meta: 0,
          realizado: 0,
          semObjetivo: 0,
          objetivosPendentes: 0,
          emEncaminhamento: 0,
          preenchidas: 0,
          canceladas: 0,
          pendentes: 0,
          tipos: new Set(),
          vinculos: new Set(),
          createdDates: [],
          items: [],
        });
      }
      const group = groups.get(key);
      const personKey = pessoaKey(funcionario);
      const objetivos = objetivosDoFuncionario(funcionario, index);
      group.items.push(funcionario);
      group.pessoas.add(personKey);
      group.tipos.add(funcionarioTipo(funcionario));
      group.vinculos.add(funcionario.tipo_vinculo || "");
      if (objetivos.length) group.pessoasComObjetivo.add(personKey);
      group.objetivos += objetivos.length;
      group.meta += objetivos.reduce((sum, item) => sum + itemMeta(item), 0);
      group.realizado += objetivos.reduce((sum, item) => sum + itemRealizado(item), 0);
      if (!objetivos.length) group.semObjetivo += 1;
      objetivos.forEach((item) => {
        const status = classifyVagaStatus(item);
        if (status.key === "aguardando") group.objetivosPendentes += 1;
        if (status.key === "encaminhamento") group.emEncaminhamento += 1;
        if (status.key === "preenchida") group.preenchidas += 1;
        if (status.key === "cancelada") group.canceladas += 1;
      });
      const date = createdDate(funcionario);
      if (date) group.createdDates.push(date);
    });
    state.groups = [...groups.values()].map((group) => {
      const mapped = {
        ...group,
        pessoasTotal: group.pessoas.size,
        pessoasObjetivoTotal: group.pessoasComObjetivo.size,
        gestorVago: isOpenLeadershipValue(group.gestorLabel),
        gap: group.realizado - group.meta,
        headcountGap: group.pessoasComObjetivo.size - group.pessoas.size,
        pendentes: group.semObjetivo + group.objetivosPendentes,
        atingimento: group.meta > 0 ? (group.realizado / group.meta) * 100 : 0,
      };
      mapped.tipoLabel = teamType(mapped);
      mapped.situacao = classifyTeam(mapped);
      mapped.tempoLabel = tenureLabel(mapped);
      return mapped;
    }).sort((a, b) => a.headcountGap - b.headcountGap || a.gap - b.gap);
  }

  function noForecastCatalogSummaryGroups(existingGroups = []) {
    const representedTeamKeys = new Set(existingGroups.flatMap((group) => (
      [...(group.equipes || [])].map(slugKey)
    )).filter(Boolean));

    return catalogTeams()
      .filter((team) => !team.inactive && team.key && !representedTeamKeys.has(team.key))
      .map((team) => {
        const activePeople = peopleForTeamKey(team.key);
        const awayPeople = peopleForTeamKey(team.key, (item) => funcionarioStatusCadastro(item) === "AFASTADO");
        const equipes = new Set([team.equipe].filter(Boolean));
        const regioes = new Set([team.regiao || "Sem região"]);
        const tipos = new Set([teamType({ equipe: team.equipe, vinculos: new Set() })]);
        const pessoas = new Set(activePeople.map(pessoaKey).filter(Boolean));
        const pessoasAfastadas = new Set(awayPeople.map(pessoaKey).filter(Boolean)).size;
        const createdDates = activePeople.map(createdDate).filter(Boolean);
        const gerentesComerciaisDetalhados = commercialManagerEntriesForGroup({ equipes });
        const metaBase = toNumber(team.hcPlanejado);
        const meta = metaBase;
        const pessoasTotal = pessoas.size;
        const gestorLabel = isOpenLeadershipValue(team.gerente)
          ? "Gerente De Vendas Em Aberto"
          : (team.gerente || "A definir");
        const mapped = {
          key: `sem_meta_${team.key}`,
          gestorLabel,
          gestorVago: isOpenLeadershipValue(team.gerente),
          regioes,
          equipes,
          tipos,
          pessoas,
          pessoasComObjetivo: new Set(),
          ruleKeys: new Set(),
          ruleCounts: new Map(),
          metasEquipes: [metaBase],
          objetivos: 0,
          meta,
          realizado: 0,
          semObjetivo: 0,
          objetivosPendentes: 0,
          emEncaminhamento: 0,
          preenchidas: 0,
          canceladas: 0,
          pendentes: 0,
          createdDates,
          items: activePeople,
          liderancaVagas: new Map(),
          regiao: team.regiao,
          equipe: team.equipe,
          equipeDetalhe: team.equipe,
          gerenteComercial: commercialManagerEntriesText(gerentesComerciaisDetalhados),
          gerentesComerciaisDetalhados,
          tipoLabel: summarizeSet(tipos, "tipos"),
          regraResumo: metaBase ? "Cadastro De Equipe" : "Imobiliária",
          regioesDetalhadas: [...regioes],
          equipesDetalhadas: [...equipes],
          tiposDetalhados: [...tipos],
          equipesTotal: equipes.size,
          pessoasTotal,
          pessoasAfastadas,
          pessoasObjetivoTotal: 0,
          metaBase,
          forecastPadrao: metaBase,
          forecastPadraoBase: metaBase,
          forecastManual: null,
          forecastOrigem: metaBase ? "Cadastro" : "Imobiliária",
          focosPlanejados: team.focosPlanejados || [],
          headcountGap: pessoasTotal - meta,
          vagasAbertas: manualOpenVacanciesForTeams(equipes),
          vagasLideranca: 0,
          vagasLiderancaDetalhes: [],
          vagasLiderancaForecastDetalhes: [],
          pendentes: Math.max(meta - pessoasTotal, 0),
          atingimento: meta > 0 ? (pessoasTotal / meta) * 100 : 0,
          gestorTempo: managerTenureInfo(gestorLabel),
        };
        mapped.situacao = classifyManagerSummary(mapped);
        mapped.tempoLabel = tenureLabel(mapped);
        return mapped;
      });
  }

  function buildManagerTableGroups() {
    const managers = new Map();
    state.groups.forEach((teamGroup) => {
      const rule = managerTableRule(teamGroup);
      const managerIdentity = managerIdentityForTeamGroup(teamGroup);
      if (!rule || !managerIdentity) return;
      const key = managerIdentity.key;
      if (!managers.has(key)) {
        managers.set(key, {
          key,
          gestorLabel: managerIdentity.label,
          gestorVago: managerIdentity.vacant,
          regioes: new Set(),
          equipes: new Set(),
          tipos: new Set(),
          pessoas: new Set(),
          pessoasComObjetivo: new Set(),
          ruleKeys: new Set(),
          ruleCounts: new Map(),
          metasEquipes: [],
          objetivos: 0,
          meta: 0,
          realizado: 0,
          semObjetivo: 0,
          objetivosPendentes: 0,
          emEncaminhamento: 0,
          preenchidas: 0,
          canceladas: 0,
          pendentes: 0,
          createdDates: [],
          items: [],
          liderancaVagas: new Map(),
          forecastPlanejado: 0,
          focosPlanejados: [],
          forecastPlanejadoEquipes: new Set(),
        });
      }

      const manager = managers.get(key);
      const catalogTeam = catalogTeamByName(teamGroup.equipe);
      const plannedMeta = catalogTeamPlannedHc(catalogTeam);
      const plannedFocusEntries = catalogTeamPlannedFocus(catalogTeam);
      const teamMeta = plannedMeta > 0 ? plannedMeta : rule.meta;
      manager.regioes.add(teamGroup.regiao);
      manager.equipes.add(teamGroup.equipe);
      manager.tipos.add(rule.tipoLabel);
      manager.ruleKeys.add(rule.key);
      manager.ruleCounts.set(rule.label, (manager.ruleCounts.get(rule.label) || 0) + 1);
      manager.metasEquipes.push(teamMeta);
      (teamGroup.pessoas || new Set()).forEach((personKey) => manager.pessoas.add(personKey));
      (teamGroup.pessoasComObjetivo || new Set()).forEach((personKey) => manager.pessoasComObjetivo.add(personKey));
      manager.objetivos += teamGroup.objetivos;
      manager.meta += teamMeta;
      manager.realizado += teamGroup.realizado;
      manager.semObjetivo += teamGroup.semObjetivo;
      manager.objetivosPendentes += teamGroup.objetivosPendentes;
      manager.emEncaminhamento += teamGroup.emEncaminhamento;
      manager.preenchidas += teamGroup.preenchidas;
      manager.canceladas += teamGroup.canceladas;
      manager.createdDates.push(...(teamGroup.createdDates || []));
      manager.items.push(...(teamGroup.items || []).filter(isActiveFuncionario));
      if (plannedMeta > 0) {
        manager.forecastPlanejado += plannedMeta;
        manager.forecastPlanejadoEquipes.add(teamGroup.equipe);
      }
      if (plannedFocusEntries.length) {
        manager.focosPlanejados.push(...plannedFocusEntries);
      }
      leadershipVacanciesForTeams(new Set([teamGroup.equipe])).forEach((vacancy) => {
        manager.liderancaVagas.set(vacancy.key, vacancy);
      });
    });

    const mappedManagers = [...managers.values()].map((manager) => {
      const equipesTotal = manager.equipes.size;
      const pessoasTotal = manager.pessoas.size;
      const forecastManual = manualForecastForManager(manager);
      const forecastPadrao = manager.meta;
      const vagasLiderancaDetalhes = manager.liderancaVagas.size
        ? [...manager.liderancaVagas.values()]
        : leadershipVacanciesForTeams(manager.equipes);
      const vagasLiderancaForecastDetalhes = forecastableLeadershipVacancies(vagasLiderancaDetalhes);
      const vagasLideranca = vagasLiderancaForecastDetalhes.length;
      const gerentesComerciaisDetalhados = commercialManagerEntriesForGroup(manager);
      const metaBase = manager.forecastPlanejado ? forecastPadrao : (forecastManual ? toNumber(forecastManual.forecast) : forecastPadrao);
      const meta = metaBase;
      const headcountGap = pessoasTotal - meta;
      const gestorTempo = managerTenureInfo(manager.gestorLabel);
      const mapped = {
        ...manager,
        regiao: summarizeSet(manager.regioes, "regioes"),
        equipe: summarizeSet(manager.equipes, "equipes"),
        equipeDetalhe: summarizeDetails(manager.equipes, 3),
        gerenteComercial: commercialManagerEntriesText(gerentesComerciaisDetalhados),
        gerentesComerciaisDetalhados,
        tipoLabel: summarizeSet(manager.tipos, "tipos"),
        regraResumo: summarizeRuleCounts(manager.ruleCounts),
        regioesDetalhadas: [...manager.regioes],
        equipesDetalhadas: [...manager.equipes],
        tiposDetalhados: [...manager.tipos],
        equipesTotal,
        pessoasTotal,
        pessoasAfastadas: afastadosForManager(manager),
        pessoasObjetivoTotal: manager.pessoasComObjetivo.size,
        metaBase,
        meta,
        gap: manager.realizado - meta,
        forecastPadrao,
        forecastPadraoBase: forecastPadrao,
        forecastManual,
        forecastOrigem: manager.forecastPlanejado ? "Cadastro" : (forecastManual ? "Manual" : "Sistema"),
        forecastPlanejado: manager.forecastPlanejado,
        focosPlanejados: manager.focosPlanejados,
        headcountGap,
        vagasAbertas: manualOpenVacanciesForTeams(manager.equipes),
        vagasLideranca,
        vagasLiderancaDetalhes,
        vagasLiderancaForecastDetalhes,
        pendentes: Math.max(meta - pessoasTotal, 0),
        atingimento: meta > 0 ? (pessoasTotal / meta) * 100 : 0,
        gestorTempo,
      };
      mapped.situacao = classifyManagerSummary(mapped);
      mapped.tempoLabel = tenureLabel(mapped);
      return mapped;
    });

    const representedManagers = new Set(mappedManagers.map((manager) => manager.key).filter(Boolean));
    const forecastOnlyManagers = (state.forecastsManuais || []).map((forecast) => {
      const key = slugKey(forecast?.chave_gestor || forecast?.gestor);
      if (!key || representedManagers.has(key)) return null;
      const equipes = forecastManualTeams(forecast);
      const catalogTeams = equipes.map(catalogTeamByName).filter(Boolean);
      const plannedForecast = catalogTeams.reduce((sum, team) => sum + catalogTeamPlannedHc(team), 0);
      const plannedFocus = catalogTeams.flatMap(catalogTeamPlannedFocus);
      const manualForecast = toNumber(forecast?.forecast);
      if (!plannedForecast && !manualForecast) return null;
      const regioes = new Set(catalogTeams.map((team) => team.regiao).filter(Boolean));
      const ruleCounts = new Map();
      const ruleKeys = new Set();
      const tipos = new Set();
      equipes.forEach((teamName) => {
        const shape = groupShapeFromTeam(teamName, [...regioes][0] || "");
        const rule = managerTableRule(shape);
        if (!rule) return;
        tipos.add(rule.tipoLabel);
        ruleKeys.add(rule.key);
        ruleCounts.set(rule.label, (ruleCounts.get(rule.label) || 0) + 1);
      });
      const vagasLiderancaDetalhes = leadershipVacanciesForTeams(new Set(equipes));
      const vagasLiderancaForecastDetalhes = forecastableLeadershipVacancies(vagasLiderancaDetalhes);
      const vagasLideranca = vagasLiderancaForecastDetalhes.length;
      const metaBase = plannedForecast || manualForecast;
      const meta = metaBase;
      const manager = {
        key,
        gestorLabel: normalizeText(forecast.gestor) || normalizeText(forecast.chave_gestor),
        regioes,
        equipes: new Set(equipes),
        tipos,
        pessoas: new Set(),
        pessoasComObjetivo: new Set(),
        ruleKeys,
        ruleCounts,
        metasEquipes: [metaBase],
        objetivos: 0,
        meta,
        realizado: 0,
        semObjetivo: 0,
        objetivosPendentes: 0,
        emEncaminhamento: 0,
        preenchidas: 0,
        canceladas: 0,
        pendentes: meta,
        createdDates: [],
        items: [],
        liderancaVagas: new Map(vagasLiderancaDetalhes.map((vacancy) => [vacancy.key, vacancy])),
      };
      const gerentesComerciaisDetalhados = commercialManagerEntriesForGroup(manager);
      const gestorTempo = managerTenureInfo(manager.gestorLabel);
      const mapped = {
        ...manager,
        regiao: summarizeSet(manager.regioes, "regioes"),
        equipe: summarizeSet(manager.equipes, "equipes"),
        equipeDetalhe: summarizeDetails(manager.equipes, 3),
        gerenteComercial: commercialManagerEntriesText(gerentesComerciaisDetalhados),
        gerentesComerciaisDetalhados,
        tipoLabel: summarizeSet(manager.tipos, "tipos"),
        regraResumo: summarizeRuleCounts(manager.ruleCounts),
        regioesDetalhadas: [...manager.regioes],
        equipesDetalhadas: [...manager.equipes],
        tiposDetalhados: [...manager.tipos],
        equipesTotal: manager.equipes.size,
        pessoasTotal: 0,
        pessoasAfastadas: 0,
        pessoasObjetivoTotal: 0,
        metaBase,
        forecastPadrao: plannedForecast,
        forecastPadraoBase: plannedForecast,
        forecastManual: plannedForecast ? null : forecast,
        forecastOrigem: plannedForecast ? "Cadastro" : "Manual",
        forecastPlanejado: plannedForecast,
        focosPlanejados: plannedFocus,
        headcountGap: -meta,
        vagasAbertas: manualOpenVacanciesForTeams(manager.equipes),
        vagasLideranca,
        vagasLiderancaDetalhes,
        vagasLiderancaForecastDetalhes,
        atingimento: 0,
        gestorTempo,
      };
      mapped.situacao = classifyManagerSummary(mapped);
      mapped.tempoLabel = tenureLabel(mapped);
      return mapped;
    }).filter(Boolean);

    const forecastOnlyKeys = new Set(forecastOnlyManagers.map((manager) => manager.key).filter(Boolean));
    const catalogSalesManagerKeys = new Set(catalogTeams()
      .filter((team) => (
        !team.inactive &&
        team.gerente &&
        !isPlaceholderValue(team.gerente) &&
        !isOpenLeadershipValue(team.gerente)
      ))
      .map((team) => slugKey(team.gerente))
      .filter(Boolean));
    const employeeOnlyManagers = (state.funcionarios || []).map((funcionario) => {
      if (!isActiveFuncionario(funcionario) || !isSalesManagerFuncionario(funcionario)) return null;
      const gestorLabel = funcionarioNome(funcionario);
      const key = slugKey(gestorLabel);
      if (!key || representedManagers.has(key) || forecastOnlyKeys.has(key) || catalogSalesManagerKeys.has(key)) return null;
      const regiao = funcionarioRegiao(funcionario);
      const gestorTempo = managerTenureInfo(gestorLabel);
      const manager = {
        key,
        gestorLabel,
        regioes: new Set(regiao && regiao !== "Sem região" ? [regiao] : []),
        equipes: new Set(),
        tipos: new Set(),
        pessoas: new Set(),
        pessoasComObjetivo: new Set(),
        ruleKeys: new Set(),
        ruleCounts: new Map(),
        metasEquipes: [],
        objetivos: 0,
        meta: 0,
        realizado: 0,
        semObjetivo: 0,
        objetivosPendentes: 0,
        emEncaminhamento: 0,
        preenchidas: 0,
        canceladas: 0,
        pendentes: 0,
        createdDates: [],
        items: [],
      };
      const mapped = {
        ...manager,
        regiao: summarizeSet(manager.regioes, "regioes"),
        equipe: "-",
        equipeDetalhe: "-",
        gerenteComercial: "-",
        gerentesComerciaisDetalhados: [],
        tipoLabel: "-",
        regraResumo: "-",
        regioesDetalhadas: [...manager.regioes],
        equipesDetalhadas: [],
        tiposDetalhados: [],
        equipesTotal: 0,
        pessoasTotal: 0,
        pessoasAfastadas: 0,
        pessoasObjetivoTotal: 0,
        metaBase: 0,
        forecastPadrao: 0,
        forecastPadraoBase: 0,
        forecastManual: null,
        forecastOrigem: "Cadastro",
        headcountGap: 0,
        vagasAbertas: 0,
        vagasLideranca: 0,
        vagasLiderancaDetalhes: [],
        vagasLiderancaForecastDetalhes: [],
        atingimento: 0,
        gestorTempo,
      };
      mapped.situacao = classifyManagerSummary(mapped);
      mapped.tempoLabel = "-";
      return mapped;
    }).filter(Boolean);

    const noForecastCatalogManagers = noForecastCatalogSummaryGroups([...mappedManagers, ...forecastOnlyManagers, ...employeeOnlyManagers]);

    state.tableGroups = [...mappedManagers, ...forecastOnlyManagers, ...employeeOnlyManagers, ...noForecastCatalogManagers]
      .sort((a, b) => a.headcountGap - b.headcountGap || b.pessoasTotal - a.pessoasTotal || a.gestorLabel.localeCompare(b.gestorLabel, "pt-BR"));
  }

  function fillTableFilters() {
    const baseGroups = globallyFilteredTableGroups();
    if (el.filtroRegiaoTabela) {
      const current = el.filtroRegiaoTabela.value;
      const regions = [...new Set(baseGroups.flatMap((group) => [...(group.regioes || [])]).filter(Boolean))].sort();
      el.filtroRegiaoTabela.innerHTML = '<option value="">Todas</option>';
      regions.forEach((region) => {
        el.filtroRegiaoTabela.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`);
      });
      if (regions.includes(current)) el.filtroRegiaoTabela.value = current;
      syncCustomSelect(el.filtroRegiaoTabela);
    }
    if (el.filtroTipoTabela) {
      const current = el.filtroTipoTabela.value;
      const types = [...new Set(baseGroups.flatMap((group) => [...(group.tipos || [])]).filter(Boolean))].sort();
      el.filtroTipoTabela.innerHTML = '<option value="">Todos</option>';
      types.forEach((type) => {
        el.filtroTipoTabela.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`);
      });
      if (types.includes(current)) el.filtroTipoTabela.value = current;
      syncCustomSelect(el.filtroTipoTabela);
    }
    if (el.filtroGestorTabela) {
      const current = el.filtroGestorTabela.value;
      const gestores = baseGroups
        .map((group) => ({ key: group.key, label: group.gestorLabel }))
        .filter((item, index, list) => item.key && list.findIndex((candidate) => candidate.key === item.key) === index)
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
      el.filtroGestorTabela.innerHTML = '<option value="">Todos</option>';
      gestores.forEach((gestor) => {
        el.filtroGestorTabela.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(gestor.key)}">${escapeHtml(gestor.label)}</option>`);
      });
      if (gestores.some((gestor) => gestor.key === current)) el.filtroGestorTabela.value = current;
      syncCustomSelect(el.filtroGestorTabela);
    }
    if (el.filtroEquipeTabela) {
      const current = el.filtroEquipeTabela.value;
      const equipes = [...new Map(baseGroups.flatMap((group) => (
        [...(group.equipes || [])].map((equipe) => [slugKey(equipe), { key: slugKey(equipe), label: equipe }])
      ))).values()]
        .filter((item) => item.key)
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
      el.filtroEquipeTabela.innerHTML = '<option value="">Todas</option>';
      equipes.forEach((equipe) => {
        el.filtroEquipeTabela.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(equipe.key)}">${escapeHtml(equipe.label)}</option>`);
      });
      if (equipes.some((equipe) => equipe.key === current)) el.filtroEquipeTabela.value = current;
      syncCustomSelect(el.filtroEquipeTabela);
    }
  }

  function fillVagaEquipeOptions() {
    if (!el.formVagaEquipe) return;
    const current = el.formVagaEquipe.value;
    const equipes = [...new Map(globallyFilteredTableGroups().flatMap((group) => (
      [...(group.equipes || [])].map((equipe) => [slugKey(equipe), { key: slugKey(equipe), label: equipe, value: equipe }])
    ))).values()]
      .filter((item) => item.key)
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    fillSelect(el.formVagaEquipe, equipes, "value", "label", "Selecione");
    if (equipes.some((equipe) => equipe.value === current)) el.formVagaEquipe.value = current;
    syncCustomSelect(el.formVagaEquipe);
  }

  function tableFilterValues() {
    return {
      search: normalizeKey(el.buscaEquipe?.value || ""),
      region: el.filtroRegiaoTabela?.value || "",
      type: el.filtroTipoTabela?.value || "",
      gestor: el.filtroGestorTabela?.value || "",
      equipe: el.filtroEquipeTabela?.value || "",
    };
  }

  function topFilterValues() {
    return {
      region: el.filtroRegiao?.value || "",
      equipe: el.filtroEquipe?.value || "",
      foco: el.filtroFoco?.value || "",
      gestor: el.filtroGestor?.value || "",
    };
  }

  function groupMatchesTopFilters(group, filters = topFilterValues()) {
    if (filters.region && !(group.regioes || new Set()).has(filters.region)) return false;
    if (filters.equipe) {
      const groupTeams = [...(group.equipes || [])].map(slugKey).filter(Boolean);
      if (!groupTeams.includes(filters.equipe) && slugKey(group.equipe) !== filters.equipe) return false;
    }
    if (filters.gestor) {
      if ((group.key || slugKey(group.gestorLabel)) !== filters.gestor && slugKey(group.gestorLabel) !== filters.gestor) return false;
    }
    if (filters.foco && !groupFocoKeys(group).has(filters.foco)) return false;
    return true;
  }

  function globallyFilteredTableGroups() {
    const filters = topFilterValues();
    return state.tableGroups.filter((group) => groupMatchesTopFilters(group, filters));
  }

  function matchesTableFilters(group, filters = tableFilterValues()) {
    if (filters.region && !(group.regioes || new Set()).has(filters.region)) return false;
    if (filters.type && !(group.tipos || new Set()).has(filters.type)) return false;
    if (filters.gestor && group.key !== filters.gestor) return false;
    if (filters.equipe && ![...(group.equipes || [])].some((item) => slugKey(item) === filters.equipe)) return false;
    if (!filters.search) return true;
    return normalizeKey(`${group.regiao} ${group.equipe} ${group.equipeDetalhe} ${focusSummaryText(group)} ${commercialManagerText(group)} ${group.tipoLabel} ${group.gestorLabel} ${group.regraResumo}`).includes(filters.search);
  }

  function dashboardSummaryGroups() {
    const filters = tableFilterValues();
    return globallyFilteredTableGroups()
      .filter((group) => matchesTableFilters(group, filters))
      .sort((a, b) => (
        String(a.regiao || "").localeCompare(String(b.regiao || ""), "pt-BR")
        || String(a.equipe || "").localeCompare(String(b.equipe || ""), "pt-BR")
        || String(a.gestorLabel || "").localeCompare(String(b.gestorLabel || ""), "pt-BR")
      ));
  }

  function hasActiveTableFilters(filters = tableFilterValues()) {
    return Boolean(filters.search || filters.region || filters.type || filters.gestor || filters.equipe);
  }

  function hasActiveTopFilters(filters = topFilterValues()) {
    return Boolean(filters.region || filters.equipe || filters.foco || filters.gestor);
  }

  function hasActiveDashboardFilters() {
    return hasActiveTopFilters() || hasActiveTableFilters();
  }

  function uniquePeopleFromGroups(groups) {
    return [...new Map(groups.flatMap((group) => group.items || []).filter(isActiveFuncionario).map((item) => [pessoaKey(item), item])).values()];
  }

  function teamKeysFromGroups(groups) {
    return new Set(groups.flatMap((group) => [...(group.equipes || [])].map(slugKey)).filter(Boolean));
  }

  function vacanciesForSummaryGroups(groups, options = {}) {
    const teamKeys = teamKeysFromGroups(groups);
    if (!teamKeys.size) return [];
    return (state.vagasManuais || [])
      .filter((item) => teamKeys.has(vagaEquipeKey(item)))
      .filter((item) => !options.openOnly || isVagaManualAberta(item))
      .sort((a, b) => vagaSlaDias(b) - vagaSlaDias(a) || String(a.protocolo || "").localeCompare(String(b.protocolo || ""), "pt-BR"));
  }

  function scopedVagasManuais(options = {}) {
    const base = state.vagasManuais || [];
    if (!hasActiveDashboardFilters()) {
      return options.openOnly ? base.filter(isVagaManualAberta) : base;
    }
    return vacanciesForSummaryGroups(dashboardSummaryGroups(), options);
  }

  function peopleForSummaryGroups(groups, { includeAfastados = false } = {}) {
    const peopleByKey = new Map();
    groups.forEach((group) => {
      (group.items || []).forEach((person) => {
        if (isActiveFuncionario(person)) peopleByKey.set(pessoaKey(person), person);
      });
    });
    if (includeAfastados) {
      const teamKeys = teamKeysFromGroups(groups);
      const managerKeys = new Set(groups.map((group) => group.key).filter(Boolean));
      afastadoCommercialFuncionarios().forEach((person) => {
        if (!teamKeys.has(funcionarioEquipeKey(person))) return;
        if (!managerKeys.has(funcionarioGestorKey(person))) return;
        peopleByKey.set(pessoaKey(person), person);
      });
    }
    return [...peopleByKey.values()];
  }

  function renderKpis() {
    const groups = dashboardSummaryGroups();
    const funcionarios = peopleForSummaryGroups(groups);
    const currentPeople = groups.reduce((sum, group) => sum + group.pessoasTotal, 0);
    const metaCorretores = groups.reduce((sum, group) => sum + group.meta, 0);
    const vagasAbertasBase = scopedVagasManuais({ openOnly: true });
    const vagasAbertasManuais = sumVagaQuantidade(vagasAbertasBase);
    const pendenciasCadastro = funcionarios.filter(funcionarioHasCadastroPendente).length;
    const headcountGap = groups.reduce((sum, group) => sum + group.headcountGap, 0);
    const abaixoForecast = groups.filter((group) => group.headcountGap < 0).length;
    const semForecast = groups.filter((group) => group.meta <= 0).length;
    state.kpis = {
      corretoresAtivos: currentPeople,
      metaCorretores,
      headcountGap,
      vagasAbertas: vagasAbertasManuais,
      pendenciasCadastro,
    };

    el.kpiCorretores.textContent = formatNumber(currentPeople);
    el.kpiCorretoresDelta.textContent = "Headcount";
    el.kpiMetaCorretores.textContent = formatNumber(metaCorretores);
    el.kpiGapHeadcount.textContent = formatSigned(headcountGap);
    el.kpiGapHeadcount.classList.toggle("tl-gc-gap-pos", headcountGap >= 0);
    el.kpiGapHeadcount.classList.toggle("tl-gc-gap-neg", headcountGap < 0);
    el.kpiGapHeadcountInfo.textContent = titleCaseDisplay(semForecast
      ? `${formatNumber(semForecast)} equipe${semForecast === 1 ? "" : "s"} sem forecast`
      : (abaixoForecast ? `${formatNumber(abaixoForecast)} equipe${abaixoForecast === 1 ? "" : "s"} abaixo do forecast` : "Resumo alinhado ao forecast"));
    el.kpiVagasAbertas.textContent = formatNumber(vagasAbertasManuais);
    el.kpiPendenciasCadastro.textContent = formatNumber(pendenciasCadastro);
  }

  function buildTeamSituationCounts(groups = dashboardSummaryGroups()) {
    const order = [
      { label: "Completa", key: "completa", color: STATUS_COLORS.completa },
      { label: "Abaixo Do Alvo", key: "abaixo", color: STATUS_COLORS.abaixo },
      { label: "Crítica", key: "critica", color: STATUS_COLORS.critica },
      { label: "Acima do Alvo", key: "acima", color: STATUS_COLORS.acima },
      { label: "Imobiliária", key: "sem_meta", color: STATUS_COLORS.sem_meta },
    ];
    return order.map((item) => ({
      ...item,
      value: groups
        .filter((group) => group.situacao.key === item.key)
        .reduce((sum, group) => sum + Math.max(0, toNumber(group.equipesTotal || (group.equipe && group.equipe !== "-" ? 1 : 0))), 0),
    }));
  }

  function buildBrokerSituationCounts(groups = dashboardSummaryGroups()) {
    const order = [
      { label: "Completa", key: "completa", color: STATUS_COLORS.completa },
      { label: "Abaixo Do Alvo", key: "abaixo", color: STATUS_COLORS.abaixo },
      { label: "Crítica", key: "critica", color: STATUS_COLORS.critica },
      { label: "Acima do Alvo", key: "acima", color: STATUS_COLORS.acima },
    ];
    return order.map((item) => ({
      ...item,
      value: groups
        .filter((group) => group.situacao.key === item.key)
        .reduce((sum, group) => sum + toNumber(group.pessoasTotal), 0),
    }));
  }

  function buildVagaStatusCounts(groups = dashboardSummaryGroups()) {
    const order = [
      { label: "Pend. Regional", key: "PENDENTE_APROVACAO_REGIONAL", color: STATUS_COLORS.pendente },
      { label: "Pend. Diretoria", key: "PENDENTE_APROVACAO", color: STATUS_COLORS.pendente },
      { label: "Em Andamento", key: "EM_ANDAMENTO", color: STATUS_COLORS.aberta },
      { label: "Triagem", key: "TRIAGEM", color: STATUS_COLORS.triagem },
      { label: "Entrevistas", key: "ENTREVISTAS", color: STATUS_COLORS.entrevistas },
      { label: "Proposta", key: "PROPOSTA", color: STATUS_COLORS.proposta },
      { label: "Fechadas", key: "FECHADA", color: STATUS_COLORS.preenchida },
      { label: "Canceladas", key: "CANCELADA", color: STATUS_COLORS.cancelada },
      { label: "Congeladas", key: "CONGELADA", color: STATUS_COLORS.congelada },
      { label: "Reprovadas", key: "REPROVADA", color: STATUS_COLORS.reprovada },
    ];
    const counts = new Map(order.map((item) => [item.key, { value: 0, maxDias: 0, totalDias: 0, protocolos: 0 }]));
    vacanciesForSummaryGroups(groups).forEach((item) => {
      const key = vagaStatusKey(item);
      const bucket = counts.get(key);
      if (!bucket) return;
      const quantidade = vagaQuantidade(item);
      const dias = vagaStageSlaDias(item);
      bucket.value += quantidade;
      bucket.totalDias += dias * quantidade;
      bucket.maxDias = Math.max(bucket.maxDias, dias);
      bucket.protocolos += 1;
    });
    return order.map((item) => {
      const bucket = counts.get(item.key) || { value: 0, maxDias: 0, totalDias: 0, protocolos: 0 };
      return {
        ...item,
        value: bucket.value,
        maxDias: bucket.maxDias,
        mediaDias: bucket.value ? Math.round(bucket.totalDias / bucket.value) : 0,
        protocolos: bucket.protocolos,
      };
    });
  }

  function renderDonut(donut, list, counts, label, listCounts = counts) {
    const total = counts.reduce((sum, item) => sum + item.value, 0);
    if (donut) {
      donut.querySelector("strong").textContent = formatNumber(total);
      donut.querySelector("span").textContent = titleCaseDisplay(label);
      let start = 0;
      const segments = counts.filter((item) => item.value > 0).map((item) => {
        const end = start + (total ? item.value / total * 100 : 0);
        const segment = `${item.color} ${start}% ${end}%`;
        start = end;
        return segment;
      });
      donut.style.background = segments.length ? `conic-gradient(${segments.join(",")})` : `conic-gradient(${STATUS_COLORS.sem_meta} 0 100%)`;
    }
    if (list) {
      list.innerHTML = listCounts.map((item) => `
        <div class="tl-gc-status-item ${item.value ? "" : "is-zero"}" style="--status-color:${item.color};">
          <i></i><strong>${escapeHtml(titleCaseDisplay(item.label))}</strong><span>${formatNumber(item.value)}</span>
        </div>
      `).join("");
    }
  }

  function renderTeamSituation(hero, list, counts) {
    const total = counts.reduce((sum, item) => sum + toNumber(item.value), 0);
    const dominant = counts.reduce((best, item) => (
      toNumber(item.value) > toNumber(best?.value) ? item : best
    ), counts[0] || { label: "Sem Dados", value: 0, color: STATUS_COLORS.sem_meta });
    const dominantPercent = total ? toNumber(dominant.value) / total * 100 : 0;
    const dominantValue = toNumber(dominant.value);

    if (hero) {
      hero.style.setProperty("--situation-color", dominant.color || STATUS_COLORS.sem_meta);
      hero.innerHTML = `
        <small>Total</small>
        <strong>${formatNumber(total)}</strong>
        <span>${titleCaseDisplay(`equipe${total === 1 ? "" : "s"}`)}</span>
        <em>${escapeHtml(titleCaseDisplay(dominant.label))} ${formatNumber(dominantValue)} • ${formatPercent(dominantPercent)}</em>
      `;
    }

    if (!list) return;

    const segments = counts.map((item) => {
      const value = toNumber(item.value);
      const percent = total ? value / total * 100 : 0;
      return `
        <span
          style="--segment-color:${item.color};--segment-width:${Math.max(percent, value ? 4 : 0)}%;"
          title="${escapeHtml(item.label)}: ${formatNumber(value)} (${formatPercent(percent)})"
        ></span>
      `;
    }).join("");

    const rows = counts.map((item) => {
      const value = toNumber(item.value);
      const percent = total ? value / total * 100 : 0;
      return `
        <div class="tl-gc-situation-item ${value ? "" : "is-zero"}" style="--status-color:${item.color};">
          <i></i>
          <div>
            <strong>${escapeHtml(titleCaseDisplay(item.label))}</strong>
            <small>${formatNumber(value)} • ${formatPercent(percent)}</small>
          </div>
        </div>
      `;
    }).join("");

    list.innerHTML = `
      <div class="tl-gc-situation-bar" aria-hidden="true">${segments}</div>
      <div class="tl-gc-situation-items">${rows}</div>
    `;
  }

  function renderVacancyStatusSummary(totalEl, list, counts, listCounts = counts) {
    const total = counts.reduce((sum, item) => sum + toNumber(item.value), 0);
    const displayCounts = (listCounts.length ? listCounts : counts).filter((item) => item.value || listCounts.length <= 3);
    const dominant = displayCounts.find((item) => toNumber(item.value) > 0) || counts.find((item) => toNumber(item.value) > 0) || displayCounts[0] || {
      label: "Sem Vagas",
      value: 0,
      color: STATUS_COLORS.sem_meta,
    };

    if (totalEl) {
      totalEl.style.setProperty("--vacancy-status-color", dominant.color || STATUS_COLORS.pendente);
      totalEl.innerHTML = `
        <small>Total</small>
        <strong>${formatNumber(total)}</strong>
        <span>${titleCaseDisplay(`vaga${total === 1 ? "" : "s"}`)}</span>
      `;
    }

    if (!list) return;

    list.innerHTML = displayCounts.map((item) => {
      const value = toNumber(item.value);
      const percent = total ? value / total * 100 : 0;
      const tempoResumo = value ? ` • maior ${formatDiasLabel(item.maxDias)}` : "";
      return `
        <div class="tl-gc-vacancy-status-item ${value ? "" : "is-zero"}" style="--status-color:${item.color};">
          <i></i>
          <div>
            <strong>${escapeHtml(titleCaseDisplay(item.label))}</strong>
            <small>${escapeHtml(titleCaseDisplay(`${formatPercent(percent)}${tempoResumo}`))}</small>
          </div>
          <span>${formatNumber(value)}</span>
        </div>
      `;
    }).join("");
  }

  function renderVagasManuais() {
    if (!el.listaVagasManuais) return;
    const groups = dashboardSummaryGroups();
    const vagas = vacanciesForSummaryGroups(groups);
    el.listaVagasManuais.classList.add("tl-gc-vacancy-list--summary");
    if (!vagas.length) {
      el.listaVagasManuais.innerHTML = `<div class="tl-gc-empty">Nenhuma Solicitação De Vaga Cadastrada.</div>`;
      return;
    }

    const totalVagas = vagas.reduce((sum, vaga) => sum + vagaQuantidade(vaga), 0);
    const protocolos = vagas.length;
    const equipes = new Set(vagas.map((vaga) => normalizeText(vaga.equipe)).filter(Boolean)).size;
    const maiorDias = vagas.reduce((max, vaga) => Math.max(max, vagaStageSlaDias(vaga)), 0);
    const prazoLimiteDias = 10;
    const vencendoPrazo = vagas.reduce((sum, vaga) => {
      const dias = vagaStageSlaDias(vaga);
      return dias >= prazoLimiteDias - 2 && dias <= prazoLimiteDias ? sum + vagaQuantidade(vaga) : sum;
    }, 0);
    const vencidasPrazo = vagas.reduce((sum, vaga) => {
      const dias = vagaStageSlaDias(vaga);
      return dias > prazoLimiteDias ? sum + vagaQuantidade(vaga) : sum;
    }, 0);
    const plural = (value, singular, pluralLabel) => `${formatNumber(value)} ${value === 1 ? singular : pluralLabel}`;
    const statusRows = buildVagaStatusCounts(groups)
      .filter((item) => toNumber(item.value) > 0)
      .map((item) => {
        const value = toNumber(item.value);
        const protocolosStatus = toNumber(item.protocolos);
        const mediaLabel = titleCaseDisplay(formatDiasLabel(item.mediaDias || 0));
        const maiorLabel = titleCaseDisplay(formatDiasLabel(item.maxDias || 0));
        return `
          <div class="tl-gc-vacancy-summary-row" style="--status-color:${item.color};">
            <i></i>
            <div>
              <strong>${escapeHtml(titleCaseDisplay(item.label))}</strong>
              <small>${escapeHtml(`${plural(protocolosStatus, "Protocolo", "Protocolos")} • Maior ${maiorLabel} • Média ${mediaLabel}`)}</small>
            </div>
            <span>${escapeHtml(plural(value, "Vaga", "Vagas"))}</span>
          </div>
        `;
      }).join("");

    el.listaVagasManuais.innerHTML = `
      <section class="tl-gc-vacancy-summary-only" aria-label="Resumo Das Vagas Por Status">
        <div class="tl-gc-vacancy-summary-metrics">
          <div class="tl-gc-vacancy-summary-metric">
            <small>Total</small>
            <strong>${escapeHtml(plural(totalVagas, "Vaga", "Vagas"))}</strong>
          </div>
          <div class="tl-gc-vacancy-summary-metric">
            <small>Protocolos</small>
            <strong>${escapeHtml(formatNumber(protocolos))}</strong>
          </div>
          <div class="tl-gc-vacancy-summary-metric">
            <small>Equipes</small>
            <strong>${escapeHtml(formatNumber(equipes))}</strong>
          </div>
          <div class="tl-gc-vacancy-summary-metric">
            <small>Maior Tempo</small>
            <strong>${escapeHtml(titleCaseDisplay(formatDiasLabel(maiorDias)))}</strong>
          </div>
          <div class="tl-gc-vacancy-summary-metric is-warning">
            <small>Vencendo 10D</small>
            <strong>${escapeHtml(plural(vencendoPrazo, "Vaga", "Vagas"))}</strong>
          </div>
          <div class="tl-gc-vacancy-summary-metric is-danger">
            <small>Vencidas</small>
            <strong>${escapeHtml(plural(vencidasPrazo, "Vaga", "Vagas"))}</strong>
          </div>
        </div>
        <div class="tl-gc-vacancy-summary-rows">
          ${statusRows || `<div class="tl-gc-empty">Nenhum Status Com Vaga No Filtro Atual.</div>`}
        </div>
      </section>
    `;
  }

  function selectedGapCargo() {
    const active = (el.gapCargoButtons || []).find((button) => button.classList.contains("is-active"));
    const key = active?.dataset.gapCargo || "consultor";
    return GAP_CARGO_OPTIONS[key] ? key : "consultor";
  }

  function setGapCargo(cargo) {
    const key = GAP_CARGO_OPTIONS[cargo] ? cargo : "consultor";
    (el.gapCargoButtons || []).forEach((button) => {
      const active = button.dataset.gapCargo === key;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function gapBucketEntries(group, view) {
    if (view === "foco") {
      const entries = focusSummaryEntries(group).map((item) => ({ label: item.label, weight: item.count || 1 }));
      return entries.length ? entries : [{ label: "Sem foco", weight: 1 }];
    }
    const regions = group.regioesDetalhadas?.length ? group.regioesDetalhadas : [group.regiao || "Sem região"];
    return regions.map((label) => ({ label, weight: 1 }));
  }

  function leadershipVacanciesForGap(group, field) {
    if (!field) return [];
    const vacancies = new Map();
    (group.vagasLiderancaDetalhes || [])
      .filter((vacancy) => vacancy.field === field)
      .forEach((vacancy) => {
        vacancies.set(vacancy.key || `${field}:${slugKey(vacancy.equipe)}`, vacancy);
      });
    const teamKeys = new Set([...(group.equipes || []), group.equipe].map(slugKey).filter(Boolean));
    const regionKeys = new Set([...(group.regioes || []), ...(group.regioesDetalhadas || []), group.regiao].map(slugKey).filter(Boolean));
    if (teamKeys.size || regionKeys.size) {
      (state.vagasManuais || [])
        .filter((vaga) => vagaCargoField(vaga) === field)
        .filter((vaga) => {
          const teamMatch = teamKeys.has(vagaEquipeKey(vaga));
          const regionalMatch = field === "gerente_regional" && regionKeys.has(vagaRegionScopeKey(vaga));
          return isVagaNecessidadeAtiva(vaga) && (teamMatch || regionalMatch);
        })
        .forEach((vaga) => {
          const quantidade = vagaQuantidade(vaga);
          const equipe = normalizeText(vaga.equipe) || group.equipe || "Sem equipe";
          vacancies.delete(`${slugKey(equipe)}::${field}`);
          const baseKey = `${field}:vaga:${slugKey(vaga.protocolo || vaga.identificador_vaga || vaga.equipe)}`;
          for (let index = 0; index < quantidade; index += 1) {
            vacancies.set(`${baseKey}:${index}`, {
              field,
              equipe,
              key: `${baseKey}:${index}`,
              protocolo: vaga.protocolo,
              origem: "vaga",
            });
          }
        });
    }
    if (field === "gerente_vendas" && group.gestorVago && !vacancies.size) {
      vacancies.set(`fallback:${group.key}`, { field, equipe: group.equipe });
    }
    return [...vacancies.values()];
  }

  function sharedLeadershipGapValuesByBucket(view, field) {
    if (!SHARED_LEADERSHIP_GAP_FIELDS.has(field)) return new Map();
    const buckets = new Map();
    dashboardSummaryGroups().forEach((group) => {
      const vacancies = leadershipVacanciesForGap(group, field);
      if (!vacancies.length) return;
      const entries = view === "regiao"
        ? vacancies.map((vacancy) => {
          const rawTeam = catalogTeamByName(vacancy.equipe);
          const label = rawTeam ? catalogTeamRegion(rawTeam) : (group.regiao || "Sem região");
          return { label: label || "Sem região" };
        })
        : gapBucketEntries(group, view);
      entries.forEach((entry) => {
        const label = entry.label || (view === "foco" ? "Sem foco" : "Sem região");
        const key = slugKey(label) || (view === "foco" ? "sem_foco" : "sem_regiao");
        if (!buckets.has(key)) {
          buckets.set(key, { label, value: 0 });
        }
        buckets.get(key).value = -1;
      });
    });
    return buckets;
  }

  function gapValueByCargo(group, cargo) {
    if (cargo === "consultor") {
      const metaConsultores = toNumber(group.metaBase ?? group.forecastPadraoBase ?? group.forecastPadrao ?? group.meta);
      if (metaConsultores <= 0) return 0;
      return toNumber(group.pessoasTotal) - metaConsultores;
    }
    const option = GAP_CARGO_OPTIONS[cargo] || GAP_CARGO_OPTIONS.consultor;
    return -leadershipVacanciesForGap(group, option.field).length;
  }

  function renderRegionGap() {
    const view = el.filtroMetricaGap?.value || "regiao";
    const selectedCargo = selectedGapCargo();
    const selectedCargoInfo = GAP_CARGO_OPTIONS[selectedCargo] || GAP_CARGO_OPTIONS.consultor;
    const bucketsMap = new Map();
    dashboardSummaryGroups().forEach((group) => {
      const entries = gapBucketEntries(group, view);
      const totalWeight = entries.reduce((sum, item) => sum + toNumber(item.weight), 0) || entries.length || 1;
      const gapValues = GAP_CARGO_ORDER.reduce((acc, cargoKey) => {
        acc[cargoKey] = gapValueByCargo(group, cargoKey);
        return acc;
      }, {});
      entries.forEach((entry) => {
        const label = entry.label || (view === "foco" ? "Sem foco" : "Sem região");
        const key = slugKey(label) || (view === "foco" ? "sem_foco" : "sem_regiao");
        if (!bucketsMap.has(key)) {
          bucketsMap.set(key, {
            label,
            values: GAP_CARGO_ORDER.reduce((acc, cargoKey) => {
              acc[cargoKey] = 0;
              return acc;
            }, {}),
            total: 0,
          });
        }
        const bucket = bucketsMap.get(key);
        const weight = toNumber(entry.weight) / totalWeight;
        GAP_CARGO_ORDER.forEach((cargoKey) => {
          bucket.values[cargoKey] += gapValues[cargoKey] * weight;
        });
      });
    });
    const sharedLeadershipGapByCargo = GAP_CARGO_ORDER.reduce((acc, cargoKey) => {
      const field = GAP_CARGO_OPTIONS[cargoKey]?.field;
      if (field && SHARED_LEADERSHIP_GAP_FIELDS.has(field)) {
        acc[cargoKey] = sharedLeadershipGapValuesByBucket(view, field);
      }
      return acc;
    }, {});
    const allBuckets = [...bucketsMap.values()]
      .map((bucket) => {
        const bucketKey = slugKey(bucket.label) || (view === "foco" ? "sem_foco" : "sem_regiao");
        const values = { ...bucket.values };
        Object.entries(sharedLeadershipGapByCargo).forEach(([cargoKey, sharedGap]) => {
          if (sharedGap.has(bucketKey)) {
            values[cargoKey] = sharedGap.get(bucketKey).value;
          }
        });
        return {
          ...bucket,
          values,
          total: GAP_CARGO_ORDER.reduce((sum, cargoKey) => sum + toNumber(values[cargoKey]), 0),
        };
      })
      .sort((a, b) => {
        const selectedDiff = toNumber(a.values[selectedCargo]) - toNumber(b.values[selectedCargo]);
        if (selectedDiff) return selectedDiff;
        return a.label.localeCompare(b.label, "pt-BR");
      });
    if (!allBuckets.length) {
      el.gapRegiao.innerHTML = `<div class="tl-gc-empty">Sem gap para ${escapeHtml(selectedCargoInfo.label)} no período.</div>`;
      return;
    }
    const totalBucket = {
      label: "Total",
      values: GAP_CARGO_ORDER.reduce((acc, cargoKey) => {
        acc[cargoKey] = allBuckets.reduce((sum, bucket) => sum + toNumber(bucket.values[cargoKey]), 0);
        return acc;
      }, {}),
      total: allBuckets.reduce((sum, bucket) => sum + toNumber(bucket.total), 0),
    };
    const selectedTotal = totalBucket.values[selectedCargo];
    const mostRelevant = [...allBuckets]
      .sort((a, b) => Math.abs(toNumber(b.values[selectedCargo])) - Math.abs(toNumber(a.values[selectedCargo])))[0];
    const mostRelevantValue = mostRelevant ? mostRelevant.values[selectedCargo] : 0;
    const columnHeaders = GAP_CARGO_ORDER.map((cargoKey) => {
      const cargoInfo = GAP_CARGO_OPTIONS[cargoKey] || GAP_CARGO_OPTIONS.consultor;
      return `<th class="${cargoKey === selectedCargo ? "is-selected" : ""}" scope="col">${escapeHtml(cargoInfo.label)}</th>`;
    }).join("");
    const gapCellHtml = (value, { selected = false } = {}) => {
      const number = toNumber(value);
      const positive = number > 0;
      const negative = number < 0;
      const trendLabel = positive ? "Alta" : negative ? "Baixa" : "Estável";
      return `
        <td class="tl-gc-gap-table__value ${positive ? "is-positive tl-gc-gap-pos" : negative ? "is-negative tl-gc-gap-neg" : "is-neutral"} ${selected ? "is-selected" : ""}" title="${trendLabel}: ${formatSigned(number)}">
          <span class="tl-gc-gap-table__trend" aria-hidden="true"></span>
          <strong>${formatSigned(number)}</strong>
        </td>
      `;
    };
    const rows = allBuckets.map((bucket) => {
      const cells = GAP_CARGO_ORDER.map((cargoKey) => gapCellHtml(bucket.values[cargoKey], { selected: cargoKey === selectedCargo })).join("");
      return `
        <tr>
          <th scope="row" title="${escapeHtml(bucket.label)}">${escapeHtml(bucket.label)}</th>
          ${cells}
          ${gapCellHtml(bucket.total)}
        </tr>
      `;
    }).join("");
    const totalCells = GAP_CARGO_ORDER.map((cargoKey) => gapCellHtml(totalBucket.values[cargoKey], { selected: cargoKey === selectedCargo })).join("");
    const totalRow = `
      <tr class="tl-gc-gap-table__total-row">
        <th scope="row">${escapeHtml(totalBucket.label)}</th>
        ${totalCells}
        ${gapCellHtml(totalBucket.total)}
      </tr>
    `;
    el.gapRegiao.innerHTML = `
      <div class="tl-gc-gap-table-summary">
        <span><small>Visão</small><strong>${view === "foco" ? "Foco" : "Região"}</strong></span>
        <span><small>Gap ${escapeHtml(selectedCargoInfo.label)}</small><b class="${selectedTotal >= 0 ? "tl-gc-gap-pos" : "tl-gc-gap-neg"}">${formatSigned(selectedTotal)}</b></span>
        <span><small>Maior desvio</small><b class="${mostRelevantValue >= 0 ? "tl-gc-gap-pos" : "tl-gc-gap-neg"}">${escapeHtml(mostRelevant?.label || "-")} ${formatSigned(mostRelevantValue)}</b></span>
      </div>
      <div class="tl-gc-gap-table-wrap">
        <table class="tl-gc-gap-table">
          <thead>
            <tr>
              <th scope="col">${view === "foco" ? "Foco" : "Região"}</th>
              ${columnHeaders}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>${totalRow}</tfoot>
        </table>
      </div>
    `;
  }

  function renderTable() {
    const groups = dashboardSummaryGroups();
    state.filteredGroups = groups;
    state.tablePage = 1;
    const visibleGroups = groups;
    state.visibleGroups = visibleGroups;

    el.tabelaEquipes.innerHTML = visibleGroups.map((group) => {
      const badge = badgeStyle(group.situacao.key);
      const vagasClass = group.vagasAbertas > 0 ? "tl-gc-vagas-btn" : "tl-gc-vagas-btn is-empty";
      const forecastClass = `${group.forecastOrigem === "Cadastro" ? "tl-gc-forecast-btn is-planned" : group.forecastManual ? "tl-gc-forecast-btn is-manual" : "tl-gc-forecast-btn"} is-readonly`;
      const forecastTitle = group.forecastOrigem === "Cadastro"
        ? "Forecast definido no cadastro de equipe"
        : group.forecastManual
          ? "Forecast manual vigente"
          : "Forecast calculado pelo sistema";
      return `
        <tr>
          <td>${escapeHtml(group.regiao)}</td>
          <td>${escapeHtml(group.equipe)}</td>
          <td>${focusSummaryHtml(group)}</td>
          <td>${commercialManagerHtml(group)}</td>
          <td>${managerTenureHtml(group)}</td>
          <td>${formatNumber(group.pessoasTotal)}</td>
          <td>${formatNumber(group.pessoasAfastadas)}</td>
          <td>
            <span class="${forecastClass}" title="${escapeHtml(forecastTitle)}">
              <strong>${formatNumber(group.meta)}</strong>
            </span>
          </td>
          <td class="${group.headcountGap >= 0 ? "tl-gc-gap-pos" : "tl-gc-gap-neg"}">${formatSigned(group.headcountGap)}</td>
          <td>
            <button class="${vagasClass}" type="button" data-open-vagas-group="${escapeHtml(group.key)}" aria-label="Ver vagas abertas e SLA de ${escapeHtml(group.gestorLabel)}">
              ${formatNumber(group.vagasAbertas)}
            </button>
          </td>
          <td>${escapeHtml(titleCaseDisplay(group.tempoLabel))}</td>
          <td><span class="tl-gc-badge" style="${badge}">${escapeHtml(titleCaseDisplay(group.situacao.label))}</span></td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="12"><div class="tl-gc-empty">Nenhuma equipe encontrada no resumo de forecast.</div></td></tr>`;
    if (el.totalEquipesTabela) {
      const totalEquipes = groups.reduce((sum, group) => (
        sum + Math.max(0, toNumber(group.equipesTotal || (group.equipe && group.equipe !== "-" ? 1 : 0)))
      ), 0);
      el.totalEquipesTabela.textContent = `${formatNumber(totalEquipes)} equipe${totalEquipes === 1 ? "" : "s"} no resumo`;
    }
    renderTablePagination(1);
  }

  function renderTablePagination(totalPages) {
    if (!el.paginacaoEquipes) return;
    if (totalPages <= 1) {
      el.paginacaoEquipes.innerHTML = "";
      return;
    }
    const current = state.tablePage;
    const pageCount = Math.max(1, totalPages);
    const start = Math.max(1, Math.min(current - 2, Math.max(1, pageCount - 4)));
    const end = Math.min(pageCount, start + 4);
    const pages = [];
    for (let page = start; page <= end; page += 1) pages.push(page);
    const prev = Math.max(1, current - 1);
    const next = Math.min(pageCount, current + 1);
    el.paginacaoEquipes.innerHTML = `
      <button type="button" data-page="${prev}" aria-label="Página anterior" ${current <= 1 ? "disabled" : ""}>&lt;</button>
      ${pages.map((page) => `<button type="button" data-page="${page}" class="${page === current ? "is-active" : ""}" ${page === current ? 'aria-current="page"' : ""}>${formatNumber(page)}</button>`).join("")}
      <button type="button" data-page="${next}" aria-label="Próxima página" ${current >= pageCount ? "disabled" : ""}>&gt;</button>
    `;
  }

  function renderTableFromFirstPage() {
    state.tablePage = 1;
    renderDashboardSummaryVisuals();
    renderTable();
    renderAlerts();
    renderFeaturedTeam();
    renderEquipesView();
    renderAprovacoesView();
    renderVagasView();
    renderPessoasView();
    renderForecastHistorico();
    updateDebugSnapshot();
  }

  function getResponsiveTablePageSize() {
    const width = window.innerWidth || document.documentElement.clientWidth || 1366;
    const isMobile = width <= 560;
    const isTablet = width > 560 && width <= 980;
    const minRows = isMobile ? 5 : isTablet ? 6 : 7;
    const maxRows = isMobile ? 8 : isTablet ? 10 : 12;
    const rowHeight = isMobile ? 52 : isTablet ? 48 : 44;
    const fallback = width >= 1280 ? 8 : width >= 980 ? 7 : minRows;
    const panel = el.tabelaEquipes?.closest(".tl-gc-table-panel");
    if (!panel) return fallback;
    const panelHeight = panel.getBoundingClientRect().height || 0;
    if (!panelHeight) return fallback;
    const headHeight = panel.querySelector(".tl-gc-table-head")?.getBoundingClientRect().height || 0;
    const footerHeight = panel.querySelector(".tl-gc-table-footer")?.getBoundingClientRect().height || 0;
    const theadHeight = panel.querySelector("thead")?.getBoundingClientRect().height || 32;
    const available = panelHeight - headHeight - footerHeight - theadHeight - 6;
    if (available <= 0) return fallback;
    const measured = Math.floor(available / rowHeight);
    return Math.max(minRows, Math.min(maxRows, measured || fallback));
  }

  function updateResponsiveTablePageSize(totalRows = 0) {
    const previousSize = state.tablePageSize || 1;
    const nextSize = getResponsiveTablePageSize();
    if (nextSize === previousSize) return;
    const firstVisibleIndex = Math.max(0, (state.tablePage - 1) * previousSize);
    state.tablePageSize = nextSize;
    const totalPages = Math.max(1, Math.ceil(totalRows / nextSize));
    state.tablePage = Math.min(totalPages, Math.floor(firstVisibleIndex / nextSize) + 1);
  }

  function scheduleResponsiveTableRender() {
    window.clearTimeout(tableResizeTimer);
    tableResizeTimer = window.setTimeout(() => {
      if (!state.tableGroups.length) return;
      const previousSize = state.tablePageSize;
      updateResponsiveTablePageSize(state.filteredGroups.length || state.tableGroups.length);
      if (state.tablePageSize !== previousSize) renderTable();
    }, 120);
  }

  function badgeStyle(key) {
    const colors = {
      completa: ["rgba(85, 200, 106, .14)", STATUS_COLORS.completa],
      abaixo: ["rgba(255, 173, 47, .16)", STATUS_COLORS.abaixo],
      critica: ["rgba(255, 67, 84, .13)", STATUS_COLORS.critica],
      acima: ["rgba(47, 131, 255, .14)", STATUS_COLORS.acima],
      sem_meta: ["rgba(156, 168, 183, .16)", STATUS_COLORS.sem_meta],
    };
    const pair = colors[key] || colors.sem_meta;
    return `--badge-bg:${pair[0]};--badge-color:${pair[1]};`;
  }

  function forecastPriorityNumber(group) {
    const gap = toNumber(group?.headcountGap);
    if (gap >= 0) return -1;
    return Math.min(3, Math.max(1, Math.abs(Math.round(gap))));
  }

  function renderAlerts() {
    const groups = dashboardSummaryGroups();
    const alerts = scopedVagasManuais({ openOnly: true })
      .flatMap((vaga) => {
        const niveis = vagaPrioridadeManualNiveis(vaga)
          .sort((a, b) => vagaPrioridadeRank(a.nivel) - vagaPrioridadeRank(b.nivel));
        if (!niveis.length) return [];
        const group = managerGroupForVacancy(vaga, groups);
        const totalVagas = vagaQuantidade(vaga);
        const regiao = normalizeText(vaga.localidade) || group?.regiao || "";
        const equipe = normalizeText(vaga.equipe) || group?.equipe || "Sem equipe";
        const itens = [];
        let restante = totalVagas;
        niveis.forEach((item) => {
          const quantidade = Math.min(restante, Math.max(0, Math.trunc(item.quantidade || 0)));
          if (quantidade <= 0) return;
          itens.push({ ...item, quantidade, semNivel: false });
          restante -= quantidade;
        });
        if (restante > 0) {
          itens.push({ nivel: "", quantidade: restante, semNivel: true });
        }

        return itens.map((item) => {
          const labelNivel = item.semNivel ? "Sem Nível" : vagaPrioridadeNivelLabel(item.nivel);
          return {
            color: item.semNivel ? STATUS_COLORS.sem_meta : vagaPrioridadeColor(item.nivel),
            intent: item.semNivel ? "" : vagaPrioridadeIntent(item.nivel),
            title: titleCaseDisplay(regiao ? `${regiao} | ${equipe}` : equipe),
            detail: titleCaseDisplay(`${vaga.protocolo || "Sem protocolo"} | ${vagaCargo(vaga)} | ${formatNumber(item.quantidade)} de ${formatNumber(totalVagas)} vagas ${item.semNivel ? "sem prioridade manual" : `com prioridade ${labelNivel}`}`),
            whenLabel: "Prioridade",
            when: labelNivel,
            sortPriority: item.semNivel ? VAGA_PRIORIDADE_NIVEIS.length + 1 : vagaPrioridadeRank(item.nivel),
            sortManual: item.quantidade,
            sortSla: vagaSlaDias(vaga),
            sortTitle: `${regiao} ${equipe} ${vaga.protocolo || ""} ${labelNivel}`,
            metrics: [{
              label: labelNivel,
              value: formatNumber(item.quantidade),
              tone: item.semNivel ? "" : (item.nivel === "-1" || item.nivel === "0" ? "bad" : "good"),
            }],
          };
        });
      })
      .sort((a, b) => {
        const priorityDiff = a.sortPriority - b.sortPriority;
        return priorityDiff
          || b.sortManual - a.sortManual
          || b.sortSla - a.sortSla
          || a.sortTitle.localeCompare(b.sortTitle, "pt-BR");
      });

    el.listaAlertasRh.innerHTML = alerts.map(renderListItem).join("") || `<div class="tl-gc-empty">Nenhuma prioridade manual preenchida nas vagas do filtro atual.</div>`;
  }

  function managerGroupForVacancy(vaga, groups = dashboardSummaryGroups()) {
    const key = vagaEquipeKey(vaga);
    if (!key) return null;
    return groups.find((group) => [...(group.equipes || [])].some((equipe) => slugKey(equipe) === key)) || null;
  }

  function renderRecentPendencies() {
    const groups = dashboardSummaryGroups();
    const openVacancies = vacanciesForSummaryGroups(groups, { openOnly: true });

    function buildSlaBucket(title, detail, vagas) {
      const total = sumVagaQuantidade(vagas);
      const weightedSla = total
        ? Math.round(vagas.reduce((sum, vaga) => sum + vagaStageSlaDias(vaga) * vagaQuantidade(vaga), 0) / total)
        : 0;
      const maxSla = vagas.reduce((max, vaga) => Math.max(max, vagaStageSlaDias(vaga)), 0);
      const critical = sumVagaQuantidade(vagas.filter((vaga) => vagaStageSlaDias(vaga) > 15));
      const sla = vagaSlaClass(maxSla || weightedSla);
      const color = sla.key === "danger" ? STATUS_COLORS.critica : (sla.key === "warn" ? STATUS_COLORS.aguardando : STATUS_COLORS.completa);
      return {
        color,
        intent: sla.key === "danger" ? "danger" : (sla.key === "warn" ? "warn" : "success"),
        title,
        detail,
        when: sla.label,
        sortSla: maxSla,
        sortTotal: total,
        metrics: [
          { label: "Vagas", value: formatNumber(total) },
          { label: "SLA Médio", value: `${formatNumber(weightedSla)}d`, tone: sla.key === "danger" ? "bad" : "good" },
          { label: "Maior SLA", value: `${formatNumber(maxSla)}d`, tone: sla.key === "danger" ? "bad" : "good" },
          { label: "Críticas", value: formatNumber(critical), tone: critical ? "bad" : "good" },
        ],
      };
    }

    const totalItem = openVacancies.length
      ? [buildSlaBucket(
          "Total",
          `${formatNumber(sumVagaQuantidade(openVacancies))} vaga${sumVagaQuantidade(openVacancies) === 1 ? "" : "s"} aberta${sumVagaQuantidade(openVacancies) === 1 ? "" : "s"} em ${formatNumber(openVacancies.length)} protocolo${openVacancies.length === 1 ? "" : "s"}.`,
          openVacancies,
        )]
      : [];

    const byRegion = new Map();
    openVacancies.forEach((vaga) => {
      const group = managerGroupForVacancy(vaga, groups);
      const regiao = normalizeText(group?.regiao || vaga?.regiao || vaga?.localidade || "Sem região");
      if (!byRegion.has(regiao)) byRegion.set(regiao, []);
      byRegion.get(regiao).push(vaga);
    });
    const regionItems = [...byRegion.entries()]
      .map(([regiao, vagas]) => buildSlaBucket(`Região • ${regiao}`, `SLA Das Vagas Abertas Em ${regiao}.`, vagas))
      .sort((a, b) => b.sortSla - a.sortSla || b.sortTotal - a.sortTotal || a.title.localeCompare(b.title, "pt-BR"));

    const byTeam = new Map();
    openVacancies.forEach((vaga) => {
      const group = managerGroupForVacancy(vaga, groups);
      const equipe = normalizeText(vaga?.equipe || "Sem equipe");
      const regiao = normalizeText(group?.regiao || vaga?.regiao || vaga?.localidade || "Sem região");
      const key = `${regiao}::${equipe}`;
      if (!byTeam.has(key)) byTeam.set(key, { regiao, equipe, vagas: [] });
      byTeam.get(key).vagas.push(vaga);
    });
    const teamItems = [...byTeam.values()]
      .map((bucket) => buildSlaBucket(`${bucket.regiao} | ${bucket.equipe}`, "SLA Das Vagas Abertas Da Equipe.", bucket.vagas))
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR") || b.sortSla - a.sortSla);

    const pending = [...totalItem, ...regionItems, ...teamItems];
    el.listaPendenciasRecentes.innerHTML = pending.map(renderListItem).join("") || `<div class="tl-gc-empty">Nenhuma vaga aberta no filtro atual.</div>`;
  }

  function relativeDate(date) {
    if (!date) return "-";
    const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
    if (days <= 0) return "Hoje";
    if (days === 1) return "Ontem";
    return `${days} dias`;
  }

  function renderListItem(item) {
    const metrics = Array.isArray(item.metrics) && item.metrics.length
      ? `<div class="tl-gc-list-metrics">
          ${item.metrics.map((metric) => `
            <span class="tl-gc-list-metric ${metric.tone ? `is-${escapeHtml(metric.tone)}` : ""}">
              <small>${escapeHtml(metric.label)}</small>
              <b>${escapeHtml(metric.value ?? "-")}</b>
            </span>
          `).join("")}
        </div>`
      : "";
    const detail = normalizeText(item.detail);
    const side = item.whenLabel
      ? `<em class="tl-gc-list-side"><small>${escapeHtml(item.whenLabel)}</small><b>${escapeHtml(item.when ?? "-")}</b></em>`
      : `<em>${escapeHtml(item.when)}</em>`;
    return `
      <div class="tl-gc-list-item ${item.intent ? `is-${escapeHtml(item.intent)}` : ""}" style="--item-color:${item.color};">
        <i></i>
        <div class="tl-gc-list-content">
          <strong>${escapeHtml(item.title)}</strong>
          ${detail ? `<span>${escapeHtml(detail)}</span>` : ""}
          ${metrics}
        </div>
        ${side}
      </div>
    `;
  }

  function renderFeaturedTeam() {
    if (!el.equipeDestaque) return;
    const group = [...dashboardSummaryGroups()]
      .filter((item) => item.meta > 0)
      .sort((a, b) => b.headcountGap - a.headcountGap || b.atingimento - a.atingimento || b.pessoasTotal - a.pessoasTotal)[0]
      || [...dashboardSummaryGroups()].sort((a, b) => b.pessoasTotal - a.pessoasTotal)[0];
    if (!group) {
      el.equipeDestaque.innerHTML = `<div class="tl-gc-empty">Sem equipe em destaque.</div>`;
      return;
    }
    const people = [...new Map(group.items.filter(isActiveFuncionario).map((item) => [pessoaKey(item), item])).values()].slice(0, 5);
    const scoreTone = group.headcountGap < 0 ? "is-bad" : "is-good";
    el.equipeDestaque.innerHTML = `
      <strong>${escapeHtml(group.equipe)}</strong>
      <span class="tl-gc-featured-caption">${escapeHtml(group.regiao)} - Gestor: ${escapeHtml(group.gestorLabel || "-")}</span>
      <div class="tl-gc-featured-score">
        <span>${escapeHtml(group.situacao.label)}</span>
        <b class="${scoreTone}">${escapeHtml(formatSigned(group.headcountGap))}</b>
      </div>
      <div class="tl-gc-featured-metrics">
        <span><small>HC</small><b>${formatNumber(group.pessoasTotal)}</b></span>
        <span><small>Forecast</small><b>${formatNumber(group.meta)}</b></span>
        <span><small>Ating.</small><b>${formatPercent(group.atingimento)}</b></span>
        <span><small>Tempo</small><b>${escapeHtml(group.tempoLabel)}</b></span>
      </div>
      <div class="tl-gc-featured-people">
        ${people.map((item) => `
          <div class="tl-gc-person-chip">
            <i>${escapeHtml(initialsFromName(funcionarioNome(item)))}</i>
            <span>${escapeHtml(funcionarioNome(item))}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderViewMetrics(container, metrics) {
    if (!container) return;
    container.innerHTML = metrics.map((metric) => `
      <article class="tl-gc-view-metric">
        <span>${escapeHtml(titleCaseDisplay(metric.label))}</span>
        <strong>${escapeHtml(titleCaseDisplay(metric.value))}</strong>
        <small>${escapeHtml(titleCaseDisplay(metric.detail || ""))}</small>
      </article>
    `).join("");
  }

  function insightToneClass(tone) {
    return tone ? ` is-${escapeHtml(tone)}` : "";
  }

  function renderInsightMetric(metric) {
    return `
      <span class="tl-gc-insight-metric ${metric.tone ? `is-${escapeHtml(metric.tone)}` : ""}">
        <small>${escapeHtml(titleCaseDisplay(metric.label))}</small>
        <b>${escapeHtml(titleCaseDisplay(metric.value ?? "-"))}</b>
      </span>
    `;
  }

  function renderInsightList(items = []) {
    if (!items.length) return "";
    return `
      <div class="tl-gc-insight-list">
        ${items.map((item) => `
          <div class="tl-gc-insight-list__item ${item.tone ? `is-${escapeHtml(item.tone)}` : ""}">
            <div>
              <strong>${escapeHtml(titleCaseDisplay(item.title || "-"))}</strong>
              <small>${escapeHtml(titleCaseDisplay(item.detail || ""))}</small>
            </div>
            <span>${escapeHtml(titleCaseDisplay(item.value ?? ""))}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderInsightProgress(progress) {
    if (!progress) return "";
    const total = Math.max(1, toNumber(progress.total));
    const value = Math.max(0, toNumber(progress.value));
    const width = Math.max(4, Math.min(100, Math.round(value / total * 100)));
    return `
      <div class="tl-gc-insight-progress">
        <div class="tl-gc-insight-progress__labels">
          <span>${escapeHtml(titleCaseDisplay(progress.label || "Progresso"))}</span>
          <b>${escapeHtml(titleCaseDisplay(progress.valueLabel || `${formatNumber(value)} de ${formatNumber(total)}`))}</b>
        </div>
        <div class="tl-gc-insight-progress__track">
          <i style="--progress:${width}%"></i>
        </div>
      </div>
    `;
  }

  function renderInsightCards(container, cards) {
    if (!container) return;
    const visibleCards = (cards || []).filter(Boolean);
    container.innerHTML = visibleCards.map((card) => {
      const metrics = Array.isArray(card.metrics) && card.metrics.length
        ? `<div class="tl-gc-insight-metrics">${card.metrics.map(renderInsightMetric).join("")}</div>`
        : "";
      const badge = card.badge ? `<em>${escapeHtml(titleCaseDisplay(card.badge))}</em>` : "";
      return `
        <article class="tl-gc-insight-card${insightToneClass(card.tone)}">
          <div class="tl-gc-insight-card__head">
            <span>${escapeHtml(titleCaseDisplay(card.label || ""))}</span>
            ${badge}
          </div>
          <strong>${escapeHtml(titleCaseDisplay(card.value || ""))}</strong>
          <p>${escapeHtml(titleCaseDisplay(card.detail || ""))}</p>
          ${renderInsightProgress(card.progress)}
          ${metrics}
          ${renderInsightList(card.items)}
        </article>
      `;
    }).join("") || `<div class="tl-gc-empty">Sem indicadores para os filtros atuais.</div>`;
  }

  function topRows(rows, score, limit = 4) {
    return [...(rows || [])].sort(score).slice(0, limit);
  }

  function catalogTeamName(item) {
    return normalizeText(item?.equipe || item?.imobiliaria || item?.time || item?.nome_equipe) || "Sem equipe";
  }

  function catalogTeamRegion(item) {
    return normalizeText(item?.regiao || item?.regional) || "Sem região";
  }

  function catalogTeamManager(item) {
    return normalizeText(item?.gerente_vendas || item?.gestor || item?.gerente || item?.coordenador || item?.gerente_comercial) || "A definir";
  }

  function catalogTeamCoordinator(item) {
    return normalizeText(item?.coordenador || item?.gerente_comercial || item?.diretor_comercial || item?.diretor) || "";
  }

  function catalogTeamStatus(item) {
    if (item?.ativo === false) return "INATIVO";
    return normalizeText(item?.status_equipe || item?.status || item?.situacao) || "ATIVO";
  }

  function catalogTeamStart(item) {
    return normalizeText(item?.data_inicio_vigencia || item?.inicio_vigencia || item?.data_inicio);
  }

  function catalogTeamEnd(item) {
    return normalizeText(item?.data_fim_vigencia || item?.fim_vigencia || item?.data_fim);
  }

  function catalogTeamPlannedHc(item) {
    return toNumber(item?.hc_planejado ?? item?.hcPlanejado ?? item?.forecast_planejado ?? item?.meta_planejada);
  }

  function catalogTeamPlannedFocus(item) {
    return normalizePlannedFocus(item?.foco_planejado || item?.focoPlanejado || item?.focos_planejados || []);
  }

  function isCatalogTeamInactive(item) {
    const status = normalizeKey(catalogTeamStatus(item));
    const manager = normalizeKey(catalogTeamManager(item));
    const end = utcDay(catalogTeamEnd(item));
    const today = utcDay(todayIsoDate());
    return (
      item?.ativo === false ||
      status.includes("inativo") ||
      status.includes("encerr") ||
      status.includes("extint") ||
      manager.includes("equipe inativa") ||
      (end !== null && today !== null && end < today)
    );
  }

  function catalogTeams() {
    const source = Array.isArray(state.equipesCatalogo) && state.equipesCatalogo.length
      ? state.equipesCatalogo
      : [...new Map(state.groups.map((group) => [
        slugKey(group.equipe),
        {
          equipe: group.equipe,
          regiao: group.regiao,
          gerente_vendas: group.gestorLabel,
          status_equipe: "ATIVO",
          data_inicio_vigencia: "",
          data_fim_vigencia: "",
          ativo: true,
        },
      ])).values()];
    return source
      .map((item) => ({
        raw: item,
        key: slugKey(catalogTeamName(item)),
        equipe: catalogTeamName(item),
        regiao: catalogTeamRegion(item),
        gerente: catalogTeamManager(item),
        coordenador: catalogTeamCoordinator(item),
        status: catalogTeamStatus(item),
        inicio: catalogTeamStart(item),
        fim: catalogTeamEnd(item),
        inactive: isCatalogTeamInactive(item),
        hcPlanejado: catalogTeamPlannedHc(item),
        focosPlanejados: catalogTeamPlannedFocus(item),
        liderancaVagas: leadershipVacanciesForRawTeam(item),
      }))
      .filter((item) => item.key)
      .sort((a, b) => Number(a.inactive) - Number(b.inactive) || a.regiao.localeCompare(b.regiao, "pt-BR") || a.equipe.localeCompare(b.equipe, "pt-BR"));
  }

  function filteredCatalogTeams() {
    const regiao = el.filtroRegiao?.value || "";
    const equipe = el.filtroEquipe?.value || "";
    const foco = el.filtroFoco?.value || "";
    const gestor = el.filtroGestor?.value || "";
    return catalogTeams().filter((item) => {
      if (regiao && item.regiao !== regiao) return false;
      if (equipe && item.key !== equipe) return false;
      if (foco && !catalogTeamMatchesFoco(item.raw || item, foco)) return false;
      if (gestor && slugKey(item.gerente) !== gestor) return false;
      return true;
    });
  }

  function peopleForTeamKey(teamKey, statusGetter = isActiveFuncionario) {
    return (state.funcionarios || []).filter((item) => (
      isCommercialFuncionario(item) &&
      statusGetter(item) &&
      funcionarioEquipeKey(item) === teamKey
    ));
  }

  function groupForTeamKey(teamKey) {
    return state.groups.find((group) => slugKey(group.equipe) === teamKey) || null;
  }

  function tableGroupForTeamKey(teamKey) {
    return state.tableGroups.find((group) => [...(group.equipes || [])].some((equipe) => slugKey(equipe) === teamKey)) || null;
  }

  function statusForTeamValues(hc, forecast, inactive = false) {
    if (inactive) return { label: "Inativa", key: "sem_meta" };
    if (forecast <= 0) return { label: "Imobiliária", key: "sem_meta" };
    if (hc > forecast) return { label: "Acima do Alvo", key: "acima" };
    if (hc === forecast) return { label: "Completa", key: "completa" };
    if (hc >= Math.ceil(forecast * .85)) return { label: "Abaixo Do Alvo", key: "abaixo" };
    return { label: "Crítica", key: "critica" };
  }

  function teamViewRows() {
    return filteredCatalogTeams().map((team) => {
      const activePeople = peopleForTeamKey(team.key);
      const baseGroup = groupForTeamKey(team.key);
      const managerGroup = tableGroupForTeamKey(team.key);
      const manualForecast = manualForecastForTeam(team);
      const rule = baseGroup ? managerTableRule(baseGroup) : (manualForecast ? managerTableRule(team) : null);
      const vagasLiderancaForecastDetalhes = forecastableLeadershipVacancies(team.liderancaVagas);
      const vagasLideranca = vagasLiderancaForecastDetalhes.length;
      const plannedForecast = toNumber(team.hcPlanejado);
      const forecastEligible = Boolean(plannedForecast || rule || manualForecast);
      const managerSingleForecast = managerGroup && managerGroup.equipesTotal === 1 ? toNumber(managerGroup.metaBase ?? managerGroup.meta) : null;
      const forecastBase = forecastEligible
        ? (plannedForecast || (manualForecast ? toNumber(manualForecast.forecast) : (managerSingleForecast !== null ? managerSingleForecast : toNumber(rule?.meta))))
        : 0;
      const forecast = forecastBase;
      const hc = activePeople.length;
      const dates = activePeople.map(createdDate).filter(Boolean);
      const vagas = openVacanciesForTeams(new Set([team.equipe])).length;
      const status = statusForTeamValues(hc, forecast, team.inactive);
      return {
        ...team,
        statusLabel: team.status,
        hc,
        forecastBase,
        forecast,
        forecastEligible,
        forecastRule: rule?.label || "",
        gap: hc - forecast,
        vagas,
        vagasLideranca,
        vagasLiderancaDetalhes: team.liderancaVagas,
        vagasLiderancaForecastDetalhes,
        tempoLabel: tenureLabel({ createdDates: dates }),
        tipoLabel: baseGroup ? teamType(baseGroup) : (rule?.tipoLabel || "-"),
        forecastManual: manualForecast,
        forecastOrigem: plannedForecast ? "Cadastro" : (manualForecast ? "Manual" : (rule ? "Sistema" : "Liderança")),
        focosPlanejados: team.focosPlanejados || [],
        situacao: status,
      };
    }).sort((a, b) => (
      Number(a.inactive) - Number(b.inactive)
      || String(a.regiao || "").localeCompare(String(b.regiao || ""), "pt-BR")
      || String(a.equipe || "").localeCompare(String(b.equipe || ""), "pt-BR")
    ));
  }

  function renderEquipesInsights(activeRows, inactiveRows) {
    const forecastRows = activeRows.filter((row) => row.forecastEligible);
    const outsideForecastRows = activeRows
      .filter((row) => !row.forecastEligible && row.hc > 0)
      .sort((a, b) => b.hc - a.hc || a.equipe.localeCompare(b.equipe, "pt-BR"));
    const totalHc = forecastRows.reduce((sum, row) => sum + row.hc, 0);
    const totalForecast = forecastRows.reduce((sum, row) => sum + row.forecast, 0);
    const totalVagas = activeRows.reduce((sum, row) => sum + row.vagas, 0);
    const riskRows = activeRows
      .filter((row) => row.forecastEligible && row.forecast > 0 && row.gap < 0)
      .sort((a, b) => a.gap - b.gap || b.vagas - a.vagas);
    const aboveRows = activeRows
      .filter((row) => row.forecastEligible && row.forecast > 0 && row.gap > 0)
      .sort((a, b) => b.gap - a.gap || b.hc - a.hc);
    const withoutForecast = activeRows
      .filter((row) => row.forecastEligible && row.forecast <= 0 && row.hc > 0)
      .sort((a, b) => b.hc - a.hc || a.equipe.localeCompare(b.equipe, "pt-BR"));
    const vacancyRows = activeRows
      .filter((row) => row.vagas > 0)
      .sort((a, b) => b.vagas - a.vagas || a.equipe.localeCompare(b.equipe, "pt-BR"));
    const topRisk = riskRows[0];
    const topAbove = aboveRows[0];
    const maxRisk = Math.max(1, ...riskRows.map((row) => Math.abs(row.gap)));
    const coveredForecastRows = Math.max(0, forecastRows.length - withoutForecast.length);
    const coverageBadge = withoutForecast.length
      ? `${formatNumber(withoutForecast.length)} pendente${withoutForecast.length === 1 ? "" : "s"}`
      : "100% coberto";
    const coverageItems = withoutForecast.length
      ? withoutForecast.slice(0, 3).map((row) => ({
        title: row.equipe,
        detail: `${row.regiao} | ${row.gerente}`,
        value: "Cadastrar HC",
        tone: "warn",
      }))
      : outsideForecastRows.slice(0, 3).map((row) => ({
        title: row.equipe,
        detail: `${row.regiao} | ${row.gerente}`,
        value: "Fora da regra",
        tone: "neutral",
      }));

    renderInsightCards(el.insightsEquipesGc, [
      {
        tone: topRisk ? "danger" : "success",
        label: "Prioridade executiva",
        badge: topRisk ? topRisk.situacao.label : "Alinhado",
        value: topRisk ? topRisk.equipe : "Sem equipe critica",
        detail: topRisk
          ? `${topRisk.regiao} | ${topRisk.gerente} | ${formatNumber(Math.abs(topRisk.gap))} abaixo do forecast`
          : "Nenhuma equipe ativa abaixo do forecast nos filtros atuais.",
        progress: topRisk ? {
          label: "Maior gap negativo",
          value: Math.abs(topRisk.gap),
          total: maxRisk,
          valueLabel: formatSigned(topRisk.gap),
        } : null,
        metrics: [
          { label: "HC", value: formatNumber(totalHc) },
          { label: "Forecast", value: formatNumber(totalForecast) },
          { label: "Gap", value: formatSigned(totalHc - totalForecast), tone: totalHc - totalForecast < 0 ? "bad" : "good" },
        ],
      },
      {
        tone: "blue",
        label: "Equipes acima",
        badge: `${formatNumber(aboveRows.length)} equipe${aboveRows.length === 1 ? "" : "s"}`,
        value: topAbove ? topAbove.equipe : "Sem excedente",
        detail: topAbove
          ? `${topAbove.regiao} | ${formatNumber(topAbove.hc)} HC para ${formatNumber(topAbove.forecast)} de forecast`
          : "Não há equipes acima do alvo nos filtros atuais.",
        items: aboveRows.slice(0, 3).map((row) => ({
          title: row.equipe,
          detail: `${row.regiao} | ${row.gerente}`,
          value: formatSigned(row.gap),
          tone: "good",
        })),
      },
      {
        tone: withoutForecast.length ? "warn" : "success",
        label: "Forecast coberto",
        badge: coverageBadge,
        value: `${formatNumber(coveredForecastRows)}/${formatNumber(forecastRows.length)} equipes`,
        detail: withoutForecast.length
          ? "Somente equipes elegíveis ao forecast ficam pendentes neste card."
          : (outsideForecastRows.length
            ? `${formatNumber(outsideForecastRows.length)} equipe${outsideForecastRows.length === 1 ? "" : "s"} parceira${outsideForecastRows.length === 1 ? "" : "s"} fora da regra de forecast.`
            : "Todas as equipes elegíveis possuem forecast definido."),
        items: coverageItems,
      },
      {
        tone: totalVagas ? "purple" : "neutral",
        label: "Reposição Aberta",
        badge: `${formatNumber(totalVagas)} vaga${totalVagas === 1 ? "" : "s"}`,
        value: vacancyRows[0] ? vacancyRows[0].equipe : "Sem vagas abertas",
        detail: vacancyRows[0]
          ? `${vacancyRows[0].regiao} concentra ${formatNumber(vacancyRows[0].vagas)} vaga${vacancyRows[0].vagas === 1 ? "" : "s"} em andamento.`
          : `${formatNumber(inactiveRows.length)} equipe${inactiveRows.length === 1 ? "" : "s"} inativa${inactiveRows.length === 1 ? "" : "s"} preservada${inactiveRows.length === 1 ? "" : "s"} no histórico.`,
        items: vacancyRows.slice(0, 3).map((row) => ({
          title: row.equipe,
          detail: `${row.regiao} | ${row.gerente}`,
          value: `${formatNumber(row.vagas)} vaga${row.vagas === 1 ? "" : "s"}`,
          tone: row.gap < 0 ? "bad" : "good",
        })),
      },
    ]);
  }

  function renderEquipesView() {
    const rows = teamViewRows();
    const activeRows = rows.filter((row) => !row.inactive);
    const inactiveRows = rows.filter((row) => row.inactive);
    const forecastRows = activeRows.filter((row) => row.forecastEligible);
    const rowsOutsideForecast = activeRows.filter((row) => !row.forecastEligible);
    const regions = new Set(activeRows.map((row) => row.regiao).filter(Boolean));

    renderViewMetrics(el.metricasEquipesGc, [
      {
        label: "Equipes ativas",
        value: formatNumber(activeRows.length),
        detail: `${formatNumber(forecastRows.length)} no forecast | ${formatNumber(rowsOutsideForecast.length)} parceira${rowsOutsideForecast.length === 1 ? "" : "s"}`,
      },
      { label: "Equipes inativas", value: formatNumber(inactiveRows.length), detail: "Histórico preservado" },
      { label: "Regiões", value: formatNumber(regions.size), detail: "Com equipes ativas" },
      { label: "Equipes no forecast", value: formatNumber(forecastRows.length), detail: "Mesma base do Dashboard" },
    ]);
    renderEquipesInsights(activeRows, inactiveRows);

    if (el.totalEquipesAtivasGc) el.totalEquipesAtivasGc.textContent = `${formatNumber(activeRows.length)} equipe${activeRows.length === 1 ? "" : "s"} ativa${activeRows.length === 1 ? "" : "s"}`;
    if (el.tabelaEquipesAtivasGc) {
      el.tabelaEquipesAtivasGc.innerHTML = activeRows.map((row) => {
        const badge = badgeStyle(row.situacao.key);
        return `
          <tr>
            <td>${escapeHtml(row.regiao)}</td>
            <td>${escapeHtml(row.equipe)}</td>
            <td>${escapeHtml(row.gerente)}<small>${escapeHtml(row.coordenador || "-")}</small></td>
            <td>${formatNumber(row.hc)}</td>
            <td>${formatNumber(row.forecast)}</td>
            <td class="${row.gap >= 0 ? "tl-gc-gap-pos" : "tl-gc-gap-neg"}">${formatSigned(row.gap)}</td>
            <td><span class="tl-gc-view-pill">${formatNumber(row.vagas)}</span></td>
            <td>${escapeHtml(titleCaseDisplay(row.tempoLabel))}</td>
            <td><span class="tl-gc-badge" style="${badge}">${escapeHtml(titleCaseDisplay(row.situacao.label))}</span></td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="9"><div class="tl-gc-empty">Nenhuma equipe ativa encontrada.</div></td></tr>`;
    }

    if (el.totalEquipesInativasGc) el.totalEquipesInativasGc.textContent = `${formatNumber(inactiveRows.length)} registro${inactiveRows.length === 1 ? "" : "s"}`;
    if (el.tabelaEquipesInativasGc) {
      el.tabelaEquipesInativasGc.innerHTML = inactiveRows.map((row) => `
        <tr>
          <td>${escapeHtml(row.regiao)}</td>
          <td>${escapeHtml(row.equipe)}</td>
          <td>${escapeHtml(row.gerente)}<small>${escapeHtml(row.coordenador || "-")}</small></td>
          <td>${escapeHtml(formatDatePt(row.inicio))}</td>
          <td>${escapeHtml(formatDatePt(row.fim))}</td>
          <td><span class="tl-gc-badge" style="${badgeStyle("sem_meta")}">${escapeHtml(row.statusLabel || "INATIVO")}</span></td>
        </tr>
      `).join("") || `<tr><td colspan="6"><div class="tl-gc-empty">Nenhum historico de equipe inativa encontrado.</div></td></tr>`;
    }
  }

  function renderAprovacoesView() {
    const pendentes = scopedVagasManuais().filter(isVagaPendenteAprovacao);
    const minhas = pendentes.filter(canApproveVaga);
    const fila = approvalQueueVagas();
    const totalPendentes = sumVagaQuantidade(pendentes);
    const totalMinhas = sumVagaQuantidade(minhas);
    const semAprovador = pendentes.filter((vaga) => {
      if (vagaStatusKey(vaga) === "PENDENTE_APROVACAO_REGIONAL") return !normalizeText(vaga.gerente_regional_aprovador);
      return !normalizeText(vaga.diretor_aprovador);
    });
    const criticas = pendentes.filter((vaga) => vagaApprovalSlaDias(vaga) > 2);
    const slaMedio = totalPendentes
      ? Math.round(pendentes.reduce((sum, vaga) => sum + vagaApprovalSlaDias(vaga) * vagaQuantidade(vaga), 0) / totalPendentes)
      : 0;
    const oldest = [...pendentes].sort((a, b) => vagaApprovalSlaDias(b) - vagaApprovalSlaDias(a))[0];

    renderViewMetrics(el.metricasAprovacoesGc, [
      { label: "Pendentes", value: formatNumber(totalPendentes), detail: "Aguardando Aprovação" },
      { label: "Minha fila", value: formatNumber(totalMinhas), detail: minhas.length ? "Liderança logada" : "Sem item para este usuário" },
      { label: "SLA Médio", value: `${formatNumber(slaMedio)}d`, detail: "Tempo até Aprovação" },
      { label: "Sem aprovador", value: formatNumber(semAprovador.length), detail: "Equipe sem Vigência Definida" },
    ]);

    renderInsightCards(el.insightsAprovacoesGc, [
      {
        tone: oldest ? (vagaSlaClass(vagaApprovalSlaDias(oldest)).key === "danger" ? "danger" : "warn") : "success",
        label: "Fila de aprovação",
        badge: oldest ? vagaSlaClass(vagaApprovalSlaDias(oldest)).label : "Sem fila",
        value: oldest ? `${oldest.protocolo || "-"} | ${oldest.equipe || "-"}` : "Nada pendente",
        detail: oldest
          ? `${vagaApprovalStageInfo(oldest).aguardando} precisa decidir a solicitação.`
          : "Não existem solicitações pendentes para aprovação.",
        metrics: [
          { label: "Pendentes", value: formatNumber(totalPendentes), tone: totalPendentes ? "bad" : "good" },
          { label: "Críticas", value: formatNumber(criticas.length), tone: criticas.length ? "bad" : "good" },
          { label: "Maior SLA", value: oldest ? `${formatNumber(vagaApprovalSlaDias(oldest))}d` : "0d" },
        ],
      },
      {
        tone: minhas.length ? "green" : "neutral",
        label: "Ações do Usuário",
        badge: minhas.length === 1 ? "1 item" : `${formatNumber(minhas.length)} itens`,
        value: minhas.length ? "Aprovação Disponível" : "Sem Ação Direta",
        detail: minhas.length
          ? "O usuário logado corresponde ao aprovador vigente da etapa."
          : "A API libera aprovação apenas ao aprovador vigente da etapa.",
        items: minhas.slice(0, 4).map((vaga) => ({
          title: vaga.protocolo || "-",
          detail: `${vaga.equipe || "-"} | ${vagaCargo(vaga)}`,
          value: `${formatNumber(vagaApprovalSlaDias(vaga))}d`,
          tone: vagaApprovalSlaDias(vaga) > 2 ? "bad" : "good",
        })),
      },
      {
        tone: semAprovador.length ? "warn" : "blue",
        label: "Vigência de Liderança",
        badge: `${formatNumber(semAprovador.length)} ajuste${semAprovador.length === 1 ? "" : "s"}`,
        value: semAprovador.length ? "Revisar equipe" : "Aprovador definido",
        detail: semAprovador.length
          ? "Solicitações sem aprovador vigente precisam de revisão no cadastro de equipes."
          : "As solicitações pendentes possuem aprovador resolvido automaticamente.",
        items: semAprovador.slice(0, 4).map((vaga) => ({
          title: vaga.equipe || "-",
          detail: vaga.protocolo || "-",
          value: "sem aprovador",
          tone: "bad",
        })),
      },
      {
        tone: "purple",
        label: "Contexto RH",
        badge: "Campos completos",
        value: "Solicitação Estruturada",
        detail: "Cada vaga guarda cargo, quantidade, recrutadora, prioridade, prazo, motivo e timeline.",
        metrics: [
          { label: "Com recrutadora", value: formatNumber(pendentes.filter((vaga) => normalizeText(vaga.recrutadora)).length) },
          { label: "Prioridade -1/0", value: formatNumber(pendentes.reduce((sum, vaga) => sum + vagaQuantidadePrioridade(vaga), 0)) },
          { label: "Período", value: periodLabel() },
        ],
      },
    ]);

    if (el.totalAprovacoesGc) {
      const scope = minhas.length ? "minha fila" : "fila geral";
      const queueLabel = fila.length === 1 ? "solicitação pendente" : "solicitações pendentes";
      el.totalAprovacoesGc.textContent = `${formatNumber(fila.length)} ${queueLabel} na ${scope}`;
    }
    if (!el.tabelaAprovacoesGc) return;
    el.tabelaAprovacoesGc.innerHTML = fila.map((vaga) => {
      const quantidade = vagaQuantidade(vaga);
      const dias = vagaApprovalSlaDias(vaga);
      const sla = vagaSlaClass(dias);
      const statusInfo = vagaStatusInfo(vaga);
      const podeAprovar = canApproveVaga(vaga);
      const etapa = vagaApprovalStageInfo(vaga);
      const prioridadeResumo = vagaPrioridadeResumoText(vaga);
      return `
        <tr>
          <td>${escapeHtml(vaga.protocolo || "Gerando")}</td>
          <td>${escapeHtml(vaga.equipe || "-")}<small>${escapeHtml(vaga.recrutadora || "Recrutadora não definida")}</small></td>
          <td>${escapeHtml(vagaCargo(vaga))}<small>${formatNumber(quantidade)} vaga${quantidade === 1 ? "" : "s"} | ${escapeHtml(titleCaseDisplay(prioridadeResumo))}</small></td>
          <td>${escapeHtml(etapa.aguardando || "Não Definido")}<small>${escapeHtml(etapa.label)}</small></td>
          <td><em class="tl-gc-sla-chip is-${escapeHtml(sla.key)}">${formatNumber(dias)} dia${dias === 1 ? "" : "s"} - ${escapeHtml(sla.label)}</em></td>
          <td><span class="tl-gc-vacancy-state ${escapeHtml(statusInfo.className)}">${escapeHtml(titleCaseDisplay(statusInfo.label))}</span></td>
          <td>
            <div class="tl-gc-vacancy-actions">
              <button class="tl-gc-vacancy-close" type="button" data-view-vaga-id="${escapeHtml(vaga.identificador_vaga)}">Ver</button>
              ${podeAprovar ? `<button class="tl-gc-vacancy-close is-approve" type="button" data-approve-vaga-id="${escapeHtml(vaga.identificador_vaga)}">Aprovar</button>` : ""}
              ${podeAprovar ? `<button class="tl-gc-vacancy-close is-danger" type="button" data-reject-vaga-id="${escapeHtml(vaga.identificador_vaga)}">Reprovar</button>` : ""}
            </div>
          </td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="7"><div class="tl-gc-empty">Nenhuma solicitação pendente de aprovação.</div></td></tr>`;
    applyTitleCaseStaticContent();
  }

  function renderVagasInsights(vagas, pendentes, abertas, fechadas, canceladas, congeladas, reprovadas, criticas, slaMedio, slaAprovacaoMedio) {
    const groups = dashboardSummaryGroups();
    const totalVagas = sumVagaQuantidade(vagas);
    const pendentesTotal = sumVagaQuantidade(pendentes);
    const abertasTotal = sumVagaQuantidade(abertas);
    const oldest = [...abertas].sort((a, b) => vagaStageSlaDias(b) - vagaStageSlaDias(a))[0];
    const oldestApproval = [...pendentes].sort((a, b) => vagaApprovalSlaDias(b) - vagaApprovalSlaDias(a))[0];
    const openByTeam = [...abertas.reduce((map, vaga) => {
      const key = vagaEquipeKey(vaga) || "sem-equipe";
      if (!map.has(key)) map.set(key, { equipe: vaga.equipe || "Sem equipe", count: 0, maxSla: 0 });
      const item = map.get(key);
      item.count += vagaQuantidade(vaga);
      item.maxSla = Math.max(item.maxSla, vagaStageSlaDias(vaga));
      return map;
    }, new Map()).values()].sort((a, b) => b.count - a.count || b.maxSla - a.maxSla);
    const statusCounts = buildVagaStatusCounts(groups);
    const uncoveredGaps = groups
      .filter((group) => group.meta > 0 && group.headcountGap < 0 && !group.vagasAbertas)
      .sort((a, b) => a.headcountGap - b.headcountGap || b.pessoasTotal - a.pessoasTotal);

    renderInsightCards(el.insightsVagasGc, [
      {
        tone: oldestApproval ? (vagaSlaClass(vagaApprovalSlaDias(oldestApproval)).key === "danger" ? "danger" : "warn") : "success",
        label: oldestApproval ? vagaApprovalStageInfo(oldestApproval).label : "Aprovação",
        badge: oldestApproval ? vagaSlaClass(vagaApprovalSlaDias(oldestApproval)).label : "Sem fila",
        value: oldestApproval ? `Protocolo ${oldestApproval.protocolo || "-"}` : "Sem pendência de aprovação",
        detail: oldestApproval
          ? `${oldestApproval.equipe || "-"} | ${vagaApprovalStageInfo(oldestApproval).aguardando} | ${formatNumber(vagaApprovalSlaDias(oldestApproval))} dia${vagaApprovalSlaDias(oldestApproval) === 1 ? "" : "s"} aguardando`
          : "Não há vaga aguardando aprovação.",
        metrics: [
          { label: "Pendentes", value: formatNumber(pendentesTotal), tone: pendentesTotal ? "bad" : "good" },
          { label: "SLA Médio", value: `${formatNumber(slaAprovacaoMedio)}d`, tone: slaAprovacaoMedio > 2 ? "bad" : "good" },
          { label: "Aprovador", value: oldestApproval ? vagaApprovalStageInfo(oldestApproval).aguardando : "OK" },
        ],
      },
      {
        tone: oldest ? (vagaSlaClass(vagaStageSlaDias(oldest)).key === "danger" ? "danger" : "warn") : "success",
        label: "SLA da etapa",
        badge: oldest ? vagaSlaClass(vagaStageSlaDias(oldest)).label : "Sem fila",
        value: oldest ? `Protocolo ${oldest.protocolo || "-"}` : "Nenhuma vaga em andamento",
        detail: oldest
          ? `${oldest.equipe || "-"} | ${vagaCargo(oldest)} | ${vagaStatusInfo(oldest).label} | ${formatNumber(vagaStageSlaDias(oldest))} dia${vagaStageSlaDias(oldest) === 1 ? "" : "s"} na etapa`
          : "Não há vagas em andamento para o filtro atual.",
        progress: oldest ? {
          label: "SLA atual",
          value: vagaStageSlaDias(oldest),
          total: Math.max(30, vagaStageSlaDias(oldest)),
          valueLabel: `${formatNumber(vagaStageSlaDias(oldest))}d`,
        } : null,
        metrics: [
          { label: "Abertas", value: formatNumber(abertasTotal) },
          { label: "SLA Médio", value: `${formatNumber(slaMedio)}d`, tone: slaMedio > 15 ? "bad" : "good" },
          { label: "Críticas", value: formatNumber(criticas), tone: criticas ? "bad" : "good" },
        ],
      },
      {
        tone: "blue",
        label: "Pipeline por status",
        badge: `${formatNumber(totalVagas)} total`,
        value: `${formatNumber(abertasTotal)} liberadas`,
        detail: "Status de RH das vagas cadastradas no módulo G&C.",
        metrics: statusCounts.map((item) => ({
          label: item.label,
          value: formatNumber(item.value),
          tone: ["EM_ANDAMENTO", "TRIAGEM", "ENTREVISTAS", "PROPOSTA"].includes(item.key) ? "good" : (["PENDENTE_APROVACAO_REGIONAL", "PENDENTE_APROVACAO"].includes(item.key) ? "bad" : ""),
        })),
      },
      {
        tone: openByTeam.length ? "purple" : "neutral",
        label: "Equipes com vaga",
        badge: `${formatNumber(openByTeam.length)} equipe${openByTeam.length === 1 ? "" : "s"}`,
        value: openByTeam[0] ? openByTeam[0].equipe : "Sem equipe em fila",
        detail: openByTeam[0]
          ? `${formatNumber(openByTeam[0].count)} vaga${openByTeam[0].count === 1 ? "" : "s"} abertas | maior SLA ${formatNumber(openByTeam[0].maxSla)}d`
          : "Nenhuma equipe possui vaga em andamento neste filtro.",
        items: openByTeam.slice(0, 3).map((item) => ({
          title: item.equipe,
          detail: "Reposição em acompanhamento pelo RH",
          value: `${formatNumber(item.count)} | ${formatNumber(item.maxSla)}d`,
          tone: item.maxSla > 15 ? "bad" : "good",
        })),
      },
    ]);
  }

  function renderVagasView() {
    const vagas = [...scopedVagasManuais()].sort((a, b) => {
      const pendingDiff = Number(isVagaPendenteAprovacao(b)) - Number(isVagaPendenteAprovacao(a));
      const openDiff = Number(isVagaManualAberta(b)) - Number(isVagaManualAberta(a));
      return pendingDiff || openDiff || vagaStageSlaDias(b) - vagaStageSlaDias(a) || String(a.protocolo || "").localeCompare(String(b.protocolo || ""), "pt-BR");
    });
    const pendentes = vagas.filter(isVagaPendenteAprovacao);
    const abertas = vagas.filter(isVagaManualAberta);
    const triagem = vagas.filter((vaga) => vagaStatusKey(vaga) === "TRIAGEM");
    const entrevistas = vagas.filter((vaga) => vagaStatusKey(vaga) === "ENTREVISTAS");
    const proposta = vagas.filter((vaga) => vagaStatusKey(vaga) === "PROPOSTA");
    const fechadas = vagas.filter((vaga) => vagaStatusKey(vaga) === "FECHADA");
    const canceladas = vagas.filter((vaga) => vagaStatusKey(vaga) === "CANCELADA");
    const congeladas = vagas.filter((vaga) => vagaStatusKey(vaga) === "CONGELADA");
    const reprovadas = vagas.filter((vaga) => vagaStatusKey(vaga) === "REPROVADA");
    const vagasTotal = sumVagaQuantidade(vagas);
    const pendentesTotal = sumVagaQuantidade(pendentes);
    const abertasTotal = sumVagaQuantidade(abertas);
    const fechadasTotal = sumVagaQuantidade(fechadas);
    const canceladasTotal = sumVagaQuantidade(canceladas);
    const congeladasTotal = sumVagaQuantidade(congeladas);
    const reprovadasTotal = sumVagaQuantidade(reprovadas);
    const slaMedio = abertasTotal
      ? Math.round(abertas.reduce((sum, vaga) => sum + vagaStageSlaDias(vaga) * vagaQuantidade(vaga), 0) / abertasTotal)
      : 0;
    const slaAprovacaoMedio = pendentesTotal
      ? Math.round(pendentes.reduce((sum, vaga) => sum + vagaApprovalSlaDias(vaga) * vagaQuantidade(vaga), 0) / pendentesTotal)
      : 0;
    const criticas = sumVagaQuantidade(abertas.filter((vaga) => vagaStageSlaDias(vaga) > 15));

    renderViewMetrics(el.metricasVagasGc, [
      { label: "Pendentes", value: formatNumber(pendentesTotal), detail: "Aguardando aprovação" },
      { label: "Em RH", value: formatNumber(abertasTotal), detail: `${formatNumber(abertas.length)} protocolo${abertas.length === 1 ? "" : "s"} liberado${abertas.length === 1 ? "" : "s"}` },
      { label: "Etapas ativas", value: `${formatNumber(triagem.length + entrevistas.length + proposta.length)}`, detail: "Triagem, entrevista ou proposta" },
      { label: "Encerradas", value: formatNumber(fechadasTotal + canceladasTotal + congeladasTotal + reprovadasTotal), detail: `${formatNumber(criticas)} crítica${criticas === 1 ? "" : "s"} em SLA` },
    ]);
    renderVagasInsights(vagas, pendentes, abertas, fechadas, canceladas, congeladas, reprovadas, criticas, slaMedio, slaAprovacaoMedio);

    if (el.totalVagasGc) {
      el.totalVagasGc.textContent = titleCaseDisplay(`${formatNumber(vagasTotal)} vaga${vagasTotal === 1 ? "" : "s"} em ${formatNumber(vagas.length)} protocolo${vagas.length === 1 ? "" : "s"}`);
    }
    if (!el.tabelaVagasGc) return;
    el.tabelaVagasGc.innerHTML = vagas.map((vaga) => {
      const aberta = isVagaManualAberta(vaga);
      const pendente = isVagaPendenteAprovacao(vaga);
      const statusKey = vagaStatusKey(vaga);
      const statusInfo = vagaStatusInfo(vaga);
      const slaDias = pendente ? vagaApprovalSlaDias(vaga) : vagaStageSlaDias(vaga);
      const sla = vagaSlaClass(slaDias);
      const quantidade = vagaQuantidade(vaga);
      const ultimoAndamento = vagaUltimoAndamento(vaga);
      const prioridadeResumo = vagaPrioridadeResumoText(vaga);
      const excluir = canDeleteVaga()
        ? `<button class="tl-gc-vacancy-close is-danger" type="button" data-delete-vaga-id="${escapeHtml(vaga.identificador_vaga)}">Excluir</button>`
        : "";
      const aprovar = canApproveVaga(vaga)
        ? `<button class="tl-gc-vacancy-close is-approve" type="button" data-approve-vaga-id="${escapeHtml(vaga.identificador_vaga)}">Aprovar</button>`
        : "";
      return `
        <tr>
          <td>${escapeHtml(vaga.protocolo || "Sem protocolo")}</td>
          <td>${escapeHtml(vaga.equipe || "-")}</td>
          <td>${escapeHtml(vagaCargo(vaga))}<small class="tl-gc-vacancy-priority-summary">${escapeHtml(titleCaseDisplay(prioridadeResumo))}</small></td>
          <td><span class="tl-gc-quantity-chip">${formatNumber(quantidade)}</span></td>
          <td>${escapeHtml(vaga.recrutadora || "-")}</td>
          <td><span class="tl-gc-vacancy-state ${escapeHtml(statusInfo.className)}">${escapeHtml(titleCaseDisplay(statusInfo.label))}</span></td>
          <td>${escapeHtml(formatDatePt(vaga.data_abertura))}</td>
          <td>
            <em class="tl-gc-sla-chip is-${escapeHtml(sla.key)}">${escapeHtml(titleCaseDisplay(`${pendente ? "Aprovação" : "Etapa"} ${formatNumber(slaDias)} dia${slaDias === 1 ? "" : "s"} - ${sla.label}`))}</em>
            ${ultimoAndamento ? `<small class="tl-gc-vacancy-progress-inline">${escapeHtml(titleCaseDisplay(ultimoAndamento))}</small>` : ""}
          </td>
          <td>
            <div class="tl-gc-vacancy-actions">
              <button class="tl-gc-vacancy-close" type="button" data-view-vaga-id="${escapeHtml(vaga.identificador_vaga)}">Ver</button>
              <button class="tl-gc-vacancy-close" type="button" data-edit-vaga-id="${escapeHtml(vaga.identificador_vaga)}">Editar</button>
              <button class="tl-gc-vacancy-close is-priority" type="button" data-priority-vaga-id="${escapeHtml(vaga.identificador_vaga)}">Prioridade</button>
              ${aprovar}
              ${aberta ? `<button class="tl-gc-vacancy-close" type="button" data-close-vaga-id="${escapeHtml(vaga.identificador_vaga)}">Fechar</button>` : ""}
              ${excluir}
            </div>
          </td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="9"><div class="tl-gc-empty">Nenhuma vaga cadastrada.</div></td></tr>`;
    applyTitleCaseStaticContent();
  }

  function commercialFuncionariosForView() {
    return peopleForSummaryGroups(dashboardSummaryGroups(), { includeAfastados: true });
  }

  function peoplePendingLabel(item) {
    const missing = [];
    if (isPlaceholderValue(funcionarioEquipe(item))) missing.push("Equipe");
    if (isPlaceholderValue(funcionarioGestor(item))) missing.push("Gerente De Vendas");
    if (!normalizeText(item?.email)) missing.push("E-mail");
    if (!normalizeText(item?.documento)) missing.push("CPF");
    return missing.length ? `Pendente: ${missing.join(", ")}` : "Cadastro OK";
  }

  function pessoasColumnFilters() {
    return {
      nome: normalizeKey(el.pessoasFiltroNome?.value || ""),
      equipe: normalizeKey(el.pessoasFiltroEquipe?.value || ""),
      gerente: normalizeKey(el.pessoasFiltroGerente?.value || ""),
      status: normalizeKey(el.pessoasFiltroStatus?.value || ""),
      tempo: normalizeKey(el.pessoasFiltroTempo?.value || ""),
      pendencia: normalizeKey(el.pessoasFiltroPendencia?.value || ""),
    };
  }

  function pessoasColumnFiltersActive(filters) {
    return Object.values(filters || {}).some(Boolean);
  }

  function pessoasFilterMatch(value, filter) {
    if (!filter) return true;
    return normalizeKey(value).includes(filter);
  }

  function pessoaTempoCasaLabel(person) {
    const date = createdDate(person);
    return date ? tenureLabel({ createdDates: [date] }) : "-";
  }

  function pessoaStatusLabel(person) {
    return funcionarioStatusCadastro(person) === "AFASTADO" ? "Afastado" : "Ativo";
  }

  function pessoaHierarquiaText(person) {
    return funcionarioHierarquiaComercial(person)
      .map((item) => `${item.label}: ${item.value}`)
      .join(" ");
  }

  function pessoasFilteredForTable(people) {
    const filters = pessoasColumnFilters();
    return people.filter((person) => (
      pessoasFilterMatch(`${funcionarioNome(person)} ${person.email || ""}`, filters.nome)
      && pessoasFilterMatch(funcionarioEquipe(person), filters.equipe)
      && pessoasFilterMatch(`${funcionarioGerenteVendas(person)} ${pessoaHierarquiaText(person)}`, filters.gerente)
      && pessoasFilterMatch(pessoaStatusLabel(person), filters.status)
      && pessoasFilterMatch(pessoaTempoCasaLabel(person), filters.tempo)
      && pessoasFilterMatch(peoplePendingLabel(person), filters.pendencia)
    ));
  }

  function pessoaHierarquiaHtml(person) {
    const entries = funcionarioHierarquiaComercial(person);
    if (!entries.length) return "";
    const fullText = entries.map((item) => `${item.label}: ${item.value}`).join(" | ");
    const visible = entries.slice(0, 2);
    const hidden = entries.length - visible.length;
    return `
      <span class="tl-gc-person-hierarchy" title="${escapeHtml(titleCaseDisplay(fullText))}">
        ${visible.map((item) => `<span><b>${escapeHtml(titleCaseDisplay(item.label))}:</b> ${escapeHtml(titleCaseDisplay(item.value))}</span>`).join("")}
        ${hidden > 0 ? `<em>+${formatNumber(hidden)} ${titleCaseDisplay(`liderança${hidden === 1 ? "" : "s"}`)}</em>` : ""}
      </span>
    `;
  }

  function pessoaPendenciaHtml(person) {
    const label = peoplePendingLabel(person);
    if (label === "Cadastro OK") {
      return `<span class="tl-gc-person-pending is-ok">Cadastro OK</span>`;
    }
    const detail = label.replace(/^Pendente:\s*/i, "");
    return `
      <span class="tl-gc-person-pending is-warn" title="${escapeHtml(titleCaseDisplay(label))}">
        <strong>Pendente</strong>
        <small>${escapeHtml(titleCaseDisplay(detail))}</small>
      </span>
    `;
  }

  function renderPessoasInsights(people, active, afastados, pendentes) {
    const total = people.length;
    const byTeam = new Map();
    const byRegion = new Map();
    active.forEach((person) => {
      const teamKey = funcionarioEquipeKey(person) || "sem-equipe";
      if (!byTeam.has(teamKey)) byTeam.set(teamKey, { equipe: funcionarioEquipe(person), regiao: funcionarioRegiao(person), count: 0 });
      byTeam.get(teamKey).count += 1;
    });
    people.forEach((person) => {
      const region = funcionarioRegiao(person) || "Sem região";
      byRegion.set(region, (byRegion.get(region) || 0) + 1);
    });
    const teamRows = [...byTeam.values()].sort((a, b) => b.count - a.count || a.equipe.localeCompare(b.equipe, "pt-BR"));
    const regionRows = [...byRegion.entries()]
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region, "pt-BR"));
    const averageTenure = tenureLabel({ createdDates: people.map(createdDate).filter(Boolean) });

    renderInsightCards(el.insightsPessoasGc, [
      {
        tone: "blue",
        label: "Composição Da Base",
        badge: `${formatNumber(total)} pessoa${total === 1 ? "" : "s"}`,
        value: `${formatNumber(active.length)} HC Ativo`,
        detail: `${formatNumber(afastados.length)} afastado${afastados.length === 1 ? "" : "s"} no filtro atual.`,
        progress: {
          label: "Ativos na base filtrada",
          value: active.length,
          total: Math.max(total, 1),
          valueLabel: `${formatPercent(total ? active.length / total * 100 : 0)} Ativo`,
        },
        metrics: [
          { label: "Ativos", value: formatNumber(active.length), tone: "good" },
          { label: "Afastados", value: formatNumber(afastados.length), tone: afastados.length ? "warn" : "good" },
          { label: "Maturidade", value: averageTenure },
        ],
      },
      {
        tone: "green",
        label: "Equipes com mais HC",
        badge: `${formatNumber(teamRows.length)} equipe${teamRows.length === 1 ? "" : "s"}`,
        value: teamRows[0] ? teamRows[0].equipe : "Sem equipe",
        detail: teamRows[0]
          ? `${teamRows[0].regiao} | ${formatNumber(teamRows[0].count)} pessoa${teamRows[0].count === 1 ? "" : "s"} ativa${teamRows[0].count === 1 ? "" : "s"}`
          : "Nenhuma equipe encontrada para o filtro.",
        items: teamRows.slice(0, 4).map((item) => ({
          title: item.equipe,
          detail: item.regiao,
          value: `${formatNumber(item.count)} HC`,
          tone: "good",
        })),
      },
      {
        tone: pendentes.length ? "warn" : "success",
        label: "Qualidade cadastral",
        badge: `${formatNumber(pendentes.length)} pendente${pendentes.length === 1 ? "" : "s"}`,
        value: pendentes.length ? "Validar cadastro" : "Base consistente",
        detail: pendentes.length
          ? "Pessoas com gerente de vendas, equipe, CPF ou contato incompleto."
          : "Sem pendências cadastrais nos filtros atuais.",
        items: pendentes.slice(0, 4).map((person) => ({
          title: funcionarioNome(person),
          detail: funcionarioEquipe(person),
          value: peoplePendingLabel(person).replace("Pendente: ", ""),
          tone: "warn",
        })),
      },
      {
        tone: "purple",
        label: "Mapa Regional",
        badge: `${formatNumber(regionRows.length)} regi${regionRows.length === 1 ? "ão" : "ões"}`,
        value: regionRows[0] ? regionRows[0].region : "Sem região",
        detail: regionRows[0]
          ? `${formatNumber(regionRows[0].count)} pessoa${regionRows[0].count === 1 ? "" : "s"} vinculada${regionRows[0].count === 1 ? "" : "s"}`
          : "Nenhuma pessoa comercial no filtro atual.",
        items: regionRows.slice(0, 4).map((item) => ({
          title: item.region,
          detail: "Distribuição da base",
          value: formatNumber(item.count),
        })),
      },
    ]);
  }

  function renderPessoasView() {
    const people = commercialFuncionariosForView().sort((a, b) => {
      const statusDiff = funcionarioStatusCadastro(a).localeCompare(funcionarioStatusCadastro(b), "pt-BR");
      return statusDiff || funcionarioEquipe(a).localeCompare(funcionarioEquipe(b), "pt-BR") || funcionarioNome(a).localeCompare(funcionarioNome(b), "pt-BR");
    });
    const columnFilters = pessoasColumnFilters();
    const tablePeople = pessoasFilteredForTable(people);
    const active = people.filter((item) => funcionarioStatusCadastro(item) === "ATIVO");
    const afastados = people.filter((item) => funcionarioStatusCadastro(item) === "AFASTADO");
    const pendentes = people.filter(funcionarioHasCadastroPendente);
    const teams = new Set(people.map(funcionarioEquipeKey).filter(Boolean));

    renderViewMetrics(el.metricasPessoasGc, [
      { label: "HC Ativo", value: formatNumber(active.length), detail: "Pessoas no negócio" },
      { label: "Afastados", value: formatNumber(afastados.length), detail: "Fora da equipe ativa" },
      { label: "Pendências", value: formatNumber(pendentes.length), detail: "Cadastro incompleto" },
      { label: "Equipes", value: formatNumber(teams.size), detail: "Com pessoas vinculadas" },
    ]);
    renderPessoasInsights(people, active, afastados, pendentes);

    if (el.totalPessoasGc) {
      el.totalPessoasGc.textContent = pessoasColumnFiltersActive(columnFilters)
        ? titleCaseDisplay(`${formatNumber(tablePeople.length)} de ${formatNumber(people.length)} pessoa${people.length === 1 ? "" : "s"}`)
        : titleCaseDisplay(`${formatNumber(people.length)} pessoa${people.length === 1 ? "" : "s"}`);
    }
    if (el.tabelaPessoasGc) {
      el.tabelaPessoasGc.innerHTML = tablePeople.map((person) => {
        const status = funcionarioStatusCadastro(person);
        const tempo = pessoaTempoCasaLabel(person);
        const email = normalizeText(person.email);
        return `
          <tr class="tl-gc-person-row">
            <td>
              <span class="tl-gc-person-name">
                <strong>${escapeHtml(titleCaseDisplay(funcionarioNome(person)))}</strong>
                <small>${escapeHtml(email || titleCaseDisplay("E-mail não informado"))}</small>
              </span>
            </td>
            <td><span class="tl-gc-person-team">${escapeHtml(titleCaseDisplay(funcionarioEquipe(person)))}</span></td>
            <td>
              <span class="tl-gc-person-manager">
                <strong>${escapeHtml(titleCaseDisplay(funcionarioGerenteVendas(person)))}</strong>
                ${pessoaHierarquiaHtml(person)}
              </span>
            </td>
            <td><span class="tl-gc-vacancy-state tl-gc-person-status ${status === "AFASTADO" ? "is-away" : "is-open"}">${escapeHtml(status === "AFASTADO" ? "Afastado" : "Ativo")}</span></td>
            <td><span class="tl-gc-person-tenure">${escapeHtml(titleCaseDisplay(tempo))}</span></td>
            <td>${pessoaPendenciaHtml(person)}</td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="6"><div class="tl-gc-empty">Nenhum Colaborador Comercial Encontrado.</div></td></tr>`;
    }

    if (!el.listaPessoasPorEquipeGc) return;
    const byTeam = [...new Map(people.map((person) => [
      funcionarioEquipeKey(person),
      {
        equipe: funcionarioEquipe(person),
        regiao: funcionarioRegiao(person),
        active: 0,
        away: 0,
      },
    ])).values()];
    people.forEach((person) => {
      const row = byTeam.find((item) => slugKey(item.equipe) === funcionarioEquipeKey(person));
      if (!row) return;
      if (funcionarioStatusCadastro(person) === "AFASTADO") row.away += 1;
      else row.active += 1;
    });
    el.listaPessoasPorEquipeGc.innerHTML = byTeam
      .sort((a, b) => String(a.regiao || "").localeCompare(String(b.regiao || ""), "pt-BR") || String(a.equipe || "").localeCompare(String(b.equipe || ""), "pt-BR"))
      .map((item) => `
        <div class="tl-gc-view-list-item">
          <div>
            <strong>${escapeHtml(titleCaseDisplay(item.equipe))}</strong>
            <span>${escapeHtml(titleCaseDisplay(item.regiao))}</span>
          </div>
          <small>${titleCaseDisplay(`${formatNumber(item.active)} HC${item.away ? ` / ${formatNumber(item.away)} afastado${item.away === 1 ? "" : "s"}` : ""}`)}</small>
        </div>
      `).join("") || `<div class="tl-gc-empty">Nenhuma Equipe Com Pessoas No Filtro Atual.</div>`;
    applyTitleCaseStaticContent();
  }

  function produtividadeSparkHtml(serie = []) {
    const pontos = Array.isArray(serie) ? serie : [];
    if (!pontos.length) return `<div class="tl-gc-empty">Sem série no período.</div>`;
    const max = Math.max(1, ...pontos.map((item) => toNumber(item.repasses)));
    return `
      <div class="tl-gc-prod-spark" aria-label="Serie de produtividade">
        ${pontos.map((item) => {
          const height = Math.max(12, Math.round((toNumber(item.repasses) / max) * 100));
          return `
            <div class="tl-gc-prod-spark__item">
              <span style="--bar-height:${height}%"><b>${formatNumber(item.repasses)}</b></span>
              <small>${escapeHtml(item.label || "")}</small>
              <em>IPC ${formatNumber(item.ipc, 2)}</em>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function produtividadeKpiHtml(item, label, value, detail = "", tone = "") {
    return `
      <div class="tl-gc-prod-kpi ${tone ? `is-${tone}` : ""}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(detail)}</small>
      </div>
    `;
  }

  function produtividadeSerieRepassesTotal(item = {}) {
    return (Array.isArray(item?.serie_6_meses) ? item.serie_6_meses : [])
      .reduce((sum, point) => sum + toNumber(point?.repasses), 0);
  }

  function produtividadeRankingMetric(item = {}, basis = "mes") {
    if (basis === "ipc_ano") return toNumber(item?.ipc_ano_vigente);
    if (basis === "ano") return toNumber(item?.repasses_ano_vigente);
    if (basis === "serie") return produtividadeSerieRepassesTotal(item);
    return toNumber(item?.repasses_mes);
  }

  function produtividadePastaReal(item = {}, info = {}) {
    if (info?.basis === "ano" || info?.basis === "ipc_ano") return toNumber(item?.pastas_ano_vigente);
    if (info?.basis === "serie") {
      return (Array.isArray(item?.serie_6_meses) ? item.serie_6_meses : [])
        .reduce((sum, point) => sum + toNumber(point?.pastas), 0);
    }
    return toNumber(item?.pastas_mes);
  }

  function produtividadeRankingBasis(items = []) {
    const candidates = [
      { key: "ipc_ano", label: "IPC ano", shareLabel: "do IPC", repassesLabel: "IPC ano" },
      { key: "ano", label: "Ano", shareLabel: "do ano", repassesLabel: "repasses no ano" },
      { key: "mes", label: "Mês", shareLabel: "do mês", repassesLabel: "repasses no mês" },
      { key: "serie", label: "6 meses", shareLabel: "em 6 meses", repassesLabel: "repasses em 6 meses" },
    ];
    for (const candidate of candidates) {
      const total = items.reduce((sum, item) => sum + produtividadeRankingMetric(item, candidate.key), 0);
      if (total > 0) return { ...candidate, total };
    }
    return { key: "sem_base", label: "Sem base", shareLabel: "sem base", repassesLabel: "repasses", total: 0 };
  }

  function produtividadeQuartilMeta(quartil) {
    const metas = {
      1: { label: "Q1", detail: "Top 25%", tone: "good" },
      2: { label: "Q2", detail: "25%-50%", tone: "blue" },
      3: { label: "Q3", detail: "50%-75%", tone: "warn" },
      4: { label: "Q4", detail: "Atenção", tone: "bad" },
    };
    return metas[quartil] || metas[4];
  }

  function produtividadeQuartilMap(items = [], keyResolver = (item) => item?.key || slugKey(item?.nome || "")) {
    const basis = produtividadeRankingBasis(items);
    const ranking = [...items]
      .map((item, index) => ({
        item,
        index,
        key: String(keyResolver(item) || "").trim(),
        nome: String(item?.nome || ""),
        repasses: produtividadeRankingMetric(item, basis.key),
        repassesAno: toNumber(item?.repasses_ano_vigente),
      }))
      .filter((item) => item.key)
      .sort((a, b) => b.repasses - a.repasses || b.repassesAno - a.repassesAno || a.nome.localeCompare(b.nome, "pt-BR") || a.index - b.index);
    const positiveRanking = ranking.filter((row) => row.repasses > 0);
    const positiveTotal = positiveRanking.length || 1;
    const positiveRankByKey = new Map(positiveRanking.map((row, index) => [row.key, index + 1]));
    const map = new Map();
    ranking.forEach((row) => {
      const rank = positiveRankByKey.get(row.key) || 0;
      const semBase = basis.total <= 0 || row.repasses <= 0;
      const quartil = semBase ? 4 : Math.min(4, Math.max(1, Math.floor(((rank - 1) / positiveTotal) * 4) + 1));
      const meta = semBase ? { label: "Sem base", detail: "Sem repasse", tone: "bad" } : produtividadeQuartilMeta(quartil);
      map.set(row.key, {
        ...meta,
        quartil,
        rank,
        total: positiveRanking.length,
        repasses: row.repasses,
        share: basis.total > 0 ? (row.repasses / basis.total) * 100 : 0,
        basis: basis.key,
        basisLabel: basis.label,
        shareLabel: basis.shareLabel,
        repassesLabel: basis.repassesLabel,
      });
    });
    return map;
  }

  function produtividadeQuartilFallback(item = {}) {
    const meta = { label: "Sem base", detail: "Sem repasse", tone: "bad" };
    const repasses = produtividadeSerieRepassesTotal(item) || toNumber(item.repasses_ano_vigente) || toNumber(item.repasses_mes);
    return {
      ...meta,
      quartil: 4,
      rank: 0,
      total: 0,
      repasses,
      share: 0,
      basis: "sem_base",
      basisLabel: "Sem base",
      shareLabel: "sem base",
      repassesLabel: "repasses",
    };
  }

  function produtividadeQuartilChipHtml(info) {
    const data = info || produtividadeQuartilFallback();
    const rank = data.rank && data.total ? `#${data.rank}/${data.total}` : "-";
    return `
      <span class="tl-gc-quartil-chip is-q${data.quartil}">
        <b>${escapeHtml(data.label)}</b>
        <small>${escapeHtml(data.detail)} | ${escapeHtml(rank)}</small>
      </span>
    `;
  }

  function produtividadeShareChipHtml(info) {
    const data = info || produtividadeQuartilFallback();
    return `
      <span class="tl-gc-share-chip">
        <b>${formatNumber(data.share, 1)}%</b>
        <small>${escapeHtml(data.shareLabel || "do total")}</small>
      </span>
    `;
  }

  function produtividadeQuartilKpisHtml(info) {
    const data = info || produtividadeQuartilFallback();
    const rank = data.rank && data.total ? `#${data.rank}/${data.total}` : "-";
    return `
      ${produtividadeKpiHtml(null, "Quartil repasse", data.label, `${data.detail} | ${rank}`, `quartil-q${data.quartil}`)}
      ${produtividadeKpiHtml(null, "% do total", `${formatNumber(data.share, 1)}%`, `${formatNumber(data.repasses)} ${data.repassesLabel || "repasses"}`, "share")}
    `;
  }

  function produtividadeCorretorKey(corretorItem, gerenteItem = {}) {
    const gerenteKey = String(gerenteItem?.key || slugKey(gerenteItem?.nome || "")).trim();
    const corretorKey = String(corretorItem?.key || slugKey(corretorItem?.nome || "")).trim();
    return `${gerenteKey || "gerente"}::${corretorKey || "corretor"}`;
  }

  function produtividadeCorretorRecords() {
    return (state.produtividade?.gerentes || []).flatMap((gerenteItem) => (
      (gerenteItem.corretores || []).map((corretorItem) => ({
        ...corretorItem,
        _produtividadeKey: produtividadeCorretorKey(corretorItem, gerenteItem),
      }))
    ));
  }

  function findProdutividadeCorretorByKey(key) {
    const target = String(key || "");
    for (const gerenteItem of state.produtividade?.gerentes || []) {
      const corretorItem = (gerenteItem.corretores || []).find((item) => produtividadeCorretorKey(item, gerenteItem) === target);
      if (corretorItem) return { corretorItem, gerenteItem };
    }
    return { corretorItem: null, gerenteItem: null };
  }

  function produtividadeProgressHtml(label, value, detail = "", tone = "") {
    const normalized = Math.max(0, Math.min(100, toNumber(value)));
    return `
      <div class="tl-gc-corretor-progress ${tone ? `is-${tone}` : ""}">
        <div>
          <span>${escapeHtml(label)}</span>
          <strong>${formatNumber(normalized, 1)}%</strong>
        </div>
        <i style="--value:${normalized}%"></i>
        <small>${escapeHtml(detail)}</small>
      </div>
    `;
  }

  function produtividadeCorretorSerie(corretorItem) {
    const serie = Array.isArray(corretorItem?.serie_6_meses) ? corretorItem.serie_6_meses.filter(Boolean) : [];
    if (serie.length) return serie;
    return [
      {
        label: "Atual",
        repasses: toNumber(corretorItem?.repasses_mes),
        pastas: toNumber(corretorItem?.pastas_mes),
        ipc: toNumber(corretorItem?.ipc_ano_vigente),
      },
    ];
  }

  function produtividadeCorretorModalHtml(corretorItem, gerenteItem) {
    const repasseMeta = toNumber(corretorItem.meta_repasse_efetiva ?? corretorItem.meta_repasse_sugerida);
    const pastaMeta = toNumber(corretorItem.meta_pasta_efetiva ?? corretorItem.meta_pasta_sugerida);
    const repasseAtingimento = toNumber(corretorItem.atingimento_repasse);
    const pastaAtingimento = pastaMeta > 0 ? (toNumber(corretorItem.pastas_mes) / pastaMeta) * 100 : 0;
    const equipe = corretorItem.equipe || gerenteItem.equipe_resumo || "-";
    const serie = produtividadeCorretorSerie(corretorItem);
    const corretorStats = produtividadeQuartilMap(produtividadeCorretorRecords(), (item) => item._produtividadeKey);
    const corretorInfo = corretorStats.get(produtividadeCorretorKey(corretorItem, gerenteItem)) || produtividadeQuartilFallback(corretorItem);
    return `
      <div class="tl-gc-modal__head">
        <div>
          <span>Produtividade do corretor</span>
          <h2 id="tituloModalProdutividadeCorretor">${escapeHtml(corretorItem.nome || "Corretor")}</h2>
          <p>${escapeHtml(equipe)} | Gerente de vendas: ${escapeHtml(gerenteItem.nome || "-")} | ${periodLabel()}</p>
        </div>
        <button class="tl-gc-icon-btn" type="button" aria-label="Fechar" data-close-corretor-prod-modal>&times;</button>
      </div>

      <section class="tl-gc-corretor-hero">
        <div class="tl-gc-corretor-avatar">${escapeHtml(initialsFromName(corretorItem.nome))}</div>
        <div>
          <strong>${escapeHtml(corretorItem.nome || "Corretor")}</strong>
          <span>${escapeHtml(equipe)} | Gerente comercial ${escapeHtml(gerenteItem.coordenador || "-")}</span>
        </div>
        <small>${formatNumber(repasseAtingimento, 1)}% da meta de repasse</small>
      </section>

      <section class="tl-gc-corretor-kpis">
        ${produtividadeKpiHtml(corretorItem, "Maturidade", corretorItem.tempo_casa_label || "-", "Tempo de casa")}
        ${produtividadeKpiHtml(corretorItem, "IPC ano", formatNumber(corretorItem.ipc_ano_vigente, 2), `${formatNumber(corretorItem.repasses_ano_vigente)} repasses no ano`, "rep")}
        ${produtividadeKpiHtml(corretorItem, "IPC mês", formatNumber(corretorItem.ipc_mes, 2), `${formatNumber(corretorItem.repasses_mes)} repasses no mês`, "rep")}
        ${produtividadeKpiHtml(corretorItem, "Meta IPC", formatNumber(corretorItem.meta_ipc, 2), corretorItem.meta_faixa || "Meta por faixa", "rep")}
        ${produtividadeKpiHtml(corretorItem, "Repasses acum.", formatNumber(corretorItem.repasses_ano_vigente), `${formatNumber(corretorItem.repasses_mes)} no mês`, "rep")}
        ${produtividadeKpiHtml(corretorItem, "Pastas mês", formatNumber(corretorItem.pastas_mes), `${formatNumber(pastaMeta)} de meta`, "pasta")}
        ${produtividadeQuartilKpisHtml(corretorInfo)}
      </section>

      <section class="tl-gc-corretor-grid">
        <article class="tl-gc-corretor-chart">
          <div class="tl-gc-corretor-section-head">
            <strong>Evolu&ccedil;&atilde;o de produtividade</strong>
            <span>${formatNumber(serie.reduce((sum, item) => sum + toNumber(item.repasses), 0))} repasses no recorte</span>
          </div>
          ${produtividadeSparkHtml(serie)}
        </article>

        <article class="tl-gc-corretor-panel">
          <div class="tl-gc-corretor-section-head">
            <strong>Leitura do m&ecirc;s</strong>
            <span>Metas do m&ecirc;s</span>
          </div>
          ${produtividadeProgressHtml("Repasse", repasseAtingimento, `${formatNumber(corretorItem.repasses_mes)} no mês / ${formatNumber(corretorItem.repasses_ano_vigente)} no ano`, repasseAtingimento >= 100 ? "good" : "warn")}
          ${produtividadeProgressHtml("Pasta", pastaAtingimento, `${formatNumber(corretorItem.pastas_mes)} de ${formatNumber(pastaMeta)} pastas`, pastaAtingimento >= 100 ? "good" : "blue")}
          <div class="tl-gc-corretor-facts">
            <span><b>IPC anterior</b>${formatNumber(corretorItem.ipc_ano_anterior, 2)}</span>
            <span><b>Rep. ano ant.</b>${formatNumber(corretorItem.repasses_ano_anterior)}</span>
            <span><b>Pastas ano</b>${formatNumber(corretorItem.pastas_ano_vigente)}</span>
          </div>
        </article>
      </section>
    `;
  }

  function openProdutividadeCorretorModal(key) {
    const { corretorItem, gerenteItem } = findProdutividadeCorretorByKey(key);
    if (!corretorItem || !gerenteItem || !el.modalProdutividadeCorretor || !el.detalheProdutividadeCorretor) return;
    el.detalheProdutividadeCorretor.innerHTML = produtividadeCorretorModalHtml(corretorItem, gerenteItem);
    applyTitleCaseStaticContent();
    el.modalProdutividadeCorretor.hidden = false;
    el.modalProdutividadeCorretor.querySelector(".tl-gc-icon-btn[data-close-corretor-prod-modal]")?.focus();
  }

  function closeProdutividadeCorretorModal() {
    if (!el.modalProdutividadeCorretor) return;
    el.modalProdutividadeCorretor.hidden = true;
    if (el.detalheProdutividadeCorretor) el.detalheProdutividadeCorretor.innerHTML = "";
  }

  function renderProdutividadeSync() {
    if (!el.produtividadeUltimaSync) return;
    const status = normalizeText(state.produtividade?.status_sync?.status || "");
    const ultima = state.produtividade?.ultima_sincronizacao || state.produtividade?.status_sync?.finished_at;
    if (ultima) {
      el.produtividadeUltimaSync.textContent = `Atualizado em ${formatDateTimePt(ultima)}`;
      el.produtividadeUltimaSync.dataset.status = status === "success" ? "success" : "warn";
      return;
    }
    el.produtividadeUltimaSync.textContent = status === "error" ? "Falha ao carregar produtividade" : "Sincronização pendente";
    el.produtividadeUltimaSync.dataset.status = status === "error" ? "error" : "warn";
  }

  function renderProdutividadeMetrics() {
    const resumo = state.produtividade?.resumo || {};
    renderViewMetrics(el.metricasProdutividadeGc, [
      { label: "Corretores", value: formatNumber(resumo.pessoas), detail: `${formatNumber(resumo.gerentes_total)} gerente${toNumber(resumo.gerentes_total) === 1 ? "" : "s"} de vendas` },
      { label: "IPC ano", value: formatNumber(resumo.ipc_ano_vigente, 2), detail: `${formatNumber(resumo.repasses_ano_vigente)} repasses no ano` },
      { label: "IPC mês", value: formatNumber(resumo.ipc_mes, 2), detail: `${formatNumber(resumo.repasses_mes)} repasses no mês` },
      { label: "Meta IPC", value: formatNumber(resumo.meta_ipc, 2), detail: "Meta por HC" },
      { label: "Repasses mes", value: formatNumber(resumo.repasses_mes), detail: `${periodLabel()} selecionado` },
      { label: "Meta repasse", value: formatNumber(resumo.meta_repasse_sugerida), detail: `${formatNumber(resumo.atingimento_repasse, 1)}% atingido` },
    ]);
  }

  function renderProdutividadeInsights() {
    const resumo = state.produtividade?.resumo || {};
    const coordenadores = state.produtividade?.coordenadores || [];
    const gerentes = state.produtividade?.gerentes || [];
    const corretores = state.produtividade?.corretores || [];
    const coordStats = produtividadeQuartilMap(coordenadores, (item) => item.key || slugKey(item.nome || ""));
    const gerenteStats = produtividadeQuartilMap(gerentes, (item) => item.key || slugKey(item.nome || ""));
    const statFor = (map, item) => map.get(item?.key || slugKey(item?.nome || "")) || produtividadeQuartilFallback(item);
    const topCoord = [...coordenadores].sort((a, b) => statFor(coordStats, b).repasses - statFor(coordStats, a).repasses || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))[0];
    const lowCoord = [...coordenadores]
      .filter((item) => toNumber(item.meta_repasse_sugerida) > 0)
      .sort((a, b) => statFor(coordStats, a).repasses - statFor(coordStats, b).repasses || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))[0];
    const topGerentes = [...gerentes].sort((a, b) => statFor(gerenteStats, b).repasses - statFor(gerenteStats, a).repasses || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")).slice(0, 4);
    const lowerGerentes = [...gerentes]
      .filter((item) => toNumber(item.meta_repasse_sugerida) > 0)
      .sort((a, b) => statFor(gerenteStats, a).repasses - statFor(gerenteStats, b).repasses || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
      .slice(0, 4);
    const atingimento = toNumber(resumo.atingimento_repasse);
    const topCoordInfo = topCoord ? coordStats.get(topCoord.key || slugKey(topCoord.nome || "")) : null;
    const lowCoordInfo = lowCoord ? coordStats.get(lowCoord.key || slugKey(lowCoord.nome || "")) : null;
    const topGerenteInfo = topGerentes[0] ? gerenteStats.get(topGerentes[0].key || slugKey(topGerentes[0].nome || "")) : null;

    renderInsightCards(el.insightsProdutividadeGc, [
      {
        tone: topCoord ? "green" : "neutral",
        label: "Gerente comercial em destaque",
        badge: topCoordInfo ? `${topCoordInfo.label} | ${formatNumber(topCoordInfo.share, 1)}%` : "Sem Dados",
        value: topCoord ? topCoord.nome || "Sem gerente comercial" : "Aguardando sincronização",
        detail: topCoord
          ? `${formatNumber(topCoordInfo?.repasses)} ${topCoordInfo?.repassesLabel || "repasses"} | ${formatNumber(topCoord.pessoas)} corretores | ${formatNumber(topCoordInfo?.share, 1)}% ${topCoordInfo?.shareLabel || "do total"}`
          : "Nenhum consolidado de produtividade carregado para o período.",
        progress: topCoord ? {
          label: "Atingimento de repasse",
          value: Math.min(100, toNumber(topCoord.atingimento_repasse)),
          total: 100,
          valueLabel: `${formatNumber(topCoord.atingimento_repasse, 1)}%`,
        } : null,
      },
      {
        tone: lowCoord ? "warn" : "success",
        label: "Ponto de atenção",
        badge: lowCoordInfo ? `${lowCoordInfo.label} | ${formatNumber(lowCoordInfo.share, 1)}%` : "Sem alerta",
        value: lowCoord ? lowCoord.nome || "Sem gerente comercial" : "Performance estável",
        detail: lowCoord
          ? `${formatNumber(lowCoordInfo?.repasses)} ${lowCoordInfo?.repassesLabel || "repasses"} para ${formatNumber(lowCoord.meta_repasse_sugerida)} de meta sugerida.`
          : "Nenhuma gerência comercial com meta sugerida abaixo do esperado.",
        items: lowerGerentes.map((item) => ({
          title: item.nome || "Sem gerente de vendas",
          detail: item.equipe_resumo || item.coordenador || "-",
          value: `${gerenteStats.get(item.key || slugKey(item.nome || ""))?.label || "Q4"} | ${formatNumber(gerenteStats.get(item.key || slugKey(item.nome || ""))?.share, 1)}%`,
          tone: toNumber(item.atingimento_repasse) < 70 ? "bad" : "warn",
        })),
      },
      {
        tone: "blue",
        label: "Meta do Período",
        badge: periodLabel(),
        value: `${formatNumber(resumo.repasses_mes)} repasses`,
        detail: `${formatNumber(resumo.pastas_mes)} pastas no mês e ${formatNumber(resumo.ipc_ano_vigente, 2)} de IPC vigente.`,
        progress: {
          label: "Atingimento geral",
          value: Math.min(100, atingimento),
          total: 100,
          valueLabel: `${formatNumber(atingimento, 1)}%`,
        },
        metrics: [
          { label: "Meta rep.", value: formatNumber(resumo.meta_repasse_sugerida) },
          { label: "Meta pasta", value: formatNumber(resumo.meta_pasta_sugerida) },
          { label: "Corretores", value: formatNumber(corretores.length || resumo.pessoas) },
        ],
      },
      {
        tone: "purple",
        label: "Gerentes de vendas em leitura",
        badge: topGerenteInfo ? `${topGerenteInfo.label} | ${formatNumber(topGerenteInfo.share, 1)}%` : `${formatNumber(gerentes.length)} gerente${gerentes.length === 1 ? "" : "s"} de vendas`,
        value: topGerentes[0] ? topGerentes[0].nome || "Sem gerente de vendas" : "Sem ranking",
        detail: topGerentes[0]
          ? `${formatNumber(topGerenteInfo?.repasses)} ${topGerenteInfo?.repassesLabel || "repasses"} | ${formatNumber(topGerenteInfo?.share, 1)}% ${topGerenteInfo?.shareLabel || "do total"} | ${topGerentes[0].equipe_resumo || "-"}`
          : "Sem gerentes de vendas para os filtros atuais.",
        items: topGerentes.map((item) => ({
          title: item.nome || "Sem gerente de vendas",
          detail: item.equipe_resumo || item.coordenador || "-",
          value: `${gerenteStats.get(item.key || slugKey(item.nome || ""))?.label || "Q4"} | ${formatNumber(gerenteStats.get(item.key || slugKey(item.nome || ""))?.share, 1)}%`,
          tone: "good",
        })),
      },
    ]);
  }

  function renderProdutividadeCoordenadores() {
    const coordenadores = state.produtividade?.coordenadores || [];
    const coordStats = produtividadeQuartilMap(coordenadores, (item) => item.key || slugKey(item.nome || ""));
    if (el.totalProdutividadeCoordenadores) {
      el.totalProdutividadeCoordenadores.textContent = coordenadores.length === 1
        ? "1 gerente comercial"
        : `${formatNumber(coordenadores.length)} gerentes comerciais`;
    }
    if (!el.produtividadeCoordenadores) return;
    el.produtividadeCoordenadores.innerHTML = coordenadores.map((coord) => {
      const info = coordStats.get(coord.key || slugKey(coord.nome || "")) || produtividadeQuartilFallback(coord);
      return `
      <article class="tl-gc-prod-card">
        <div class="tl-gc-prod-card__head">
          <div>
            <span>Gerente Comercial</span>
            <h3>${escapeHtml(coord.nome || "Sem gerente comercial")}</h3>
            <p>${formatNumber(coord.gerentes_total)} gerente${toNumber(coord.gerentes_total) === 1 ? "" : "s"} de vendas / ${formatNumber(coord.pessoas)} corretor${toNumber(coord.pessoas) === 1 ? "" : "es"}</p>
          </div>
          <strong>${escapeHtml(info.label)} | ${formatNumber(info.share, 1)}%</strong>
        </div>
        <div class="tl-gc-prod-kpis">
          ${produtividadeKpiHtml(coord, "IPC ant.", formatNumber(coord.ipc_ano_anterior, 2), `${formatNumber(coord.repasses_ano_anterior)} repasses`)}
          ${produtividadeKpiHtml(coord, "IPC vig.", formatNumber(coord.ipc_ano_vigente, 2), `${formatNumber(coord.repasses_ano_vigente)} repasses`, "rep")}
          ${produtividadeKpiHtml(coord, "Rep. sug.", formatNumber(coord.meta_repasse_sugerida), "Meta sugerida", "rep")}
          ${produtividadeKpiHtml(coord, "Pasta sug.", formatNumber(coord.meta_pasta_sugerida), "Meta sugerida", "pasta")}
          ${produtividadeQuartilKpisHtml(info)}
        </div>
        ${produtividadeSparkHtml(coord.serie_6_meses)}
      </article>
    `;
    }).join("") || `<div class="tl-gc-empty">Nenhum gerente comercial encontrado para os filtros atuais.</div>`;
  }

  function produtividadeCorretoresRows(corretores = [], gerenteItem = {}) {
    const corretorStats = produtividadeQuartilMap(produtividadeCorretorRecords(), (item) => item._produtividadeKey);
    const getSortInfo = (item) => {
      const info = corretorStats.get(produtividadeCorretorKey(item, gerenteItem)) || produtividadeQuartilFallback(item);
      const semBase = String(info.label || "").toLowerCase().includes("sem base") || toNumber(info.repasses) <= 0;
      return {
        info,
        quartil: semBase ? 99 : toNumber(info.quartil) || 99,
        rank: toNumber(info.rank) || 999,
        share: toNumber(info.share),
        repasses: toNumber(info.repasses),
      };
    };
    const sorted = [...corretores].sort((a, b) => {
      const sortA = getSortInfo(a);
      const sortB = getSortInfo(b);
      return toNumber(b.ipc_ano_vigente) - toNumber(a.ipc_ano_vigente)
        || sortA.quartil - sortB.quartil
        || sortA.rank - sortB.rank
        || sortB.share - sortA.share
        || sortB.repasses - sortA.repasses
        || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });
    if (!sorted.length) return `<div class="tl-gc-empty">Nenhum corretor neste agrupamento.</div>`;
    return `
      <div class="tl-gc-prod-drill">
        <table>
          <thead>
            <tr>
              <th>Corretor</th>
              <th>Tempo</th>
              <th>IPC ano</th>
              <th>IPC mês</th>
              <th>Meta IPC</th>
              <th>Rep. ano</th>
              <th>Meta rep.</th>
              <th>Pasta</th>
              <th>Ating.</th>
              <th>Quartil</th>
              <th>% total</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((corretorItem) => {
              const rawCorretorKey = produtividadeCorretorKey(corretorItem, gerenteItem);
              const corretorKey = escapeHtml(rawCorretorKey);
              const corretorNome = corretorItem.nome || "Corretor";
              const info = corretorStats.get(rawCorretorKey) || produtividadeQuartilFallback(corretorItem);
              return `
              <tr class="tl-gc-prod-corretor-row" data-prod-corretor="${corretorKey}">
                <td>
                  <button class="tl-gc-prod-corretor-btn" type="button" data-prod-corretor="${corretorKey}" aria-label="Abrir detalhe de ${escapeHtml(corretorNome)}">
                    <strong>${escapeHtml(corretorNome)}</strong>
                    <small>${escapeHtml(corretorItem.equipe || "-")}</small>
                    <span>Ver detalhe</span>
                  </button>
                </td>
                <td>${escapeHtml(corretorItem.tempo_casa_label || "-")}</td>
                <td>${formatNumber(corretorItem.ipc_ano_vigente, 2)}</td>
                <td>${formatNumber(corretorItem.ipc_mes, 2)}</td>
                <td>${formatNumber(corretorItem.meta_ipc, 2)}</td>
                <td>${formatNumber(corretorItem.repasses_ano_vigente)}</td>
                <td>${formatNumber(corretorItem.meta_repasse_sugerida)}</td>
                <td>${formatNumber(corretorItem.meta_pasta_sugerida)}</td>
                <td>${formatNumber(corretorItem.atingimento_repasse, 1)}%</td>
                <td>${produtividadeQuartilChipHtml(info)}</td>
                <td>${produtividadeShareChipHtml(info)}</td>
              </tr>
            `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function produtividadeGerentesVendaRows(gerentes = [], gerenteStats = new Map()) {
    const sorted = [...gerentes].sort((a, b) => {
      const infoA = gerenteStats.get(a.key || slugKey(a.nome || "")) || produtividadeQuartilFallback(a);
      const infoB = gerenteStats.get(b.key || slugKey(b.nome || "")) || produtividadeQuartilFallback(b);
      return toNumber(b.ipc_ano_vigente) - toNumber(a.ipc_ano_vigente)
        || toNumber(infoA.quartil) - toNumber(infoB.quartil)
        || toNumber(infoA.rank) - toNumber(infoB.rank)
        || toNumber(b.repasses_ano_vigente) - toNumber(a.repasses_ano_vigente)
        || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });
    if (!sorted.length) return `<div class="tl-gc-empty">Nenhum gerente de vendas neste agrupamento.</div>`;
    return sorted.map((gerenteItem) => {
      const info = gerenteStats.get(gerenteItem.key || slugKey(gerenteItem.nome || "")) || produtividadeQuartilFallback(gerenteItem);
      const repasseReal = toNumber(info.repasses);
      const pastaReal = produtividadePastaReal(gerenteItem, info);
      return `
        <div class="tl-gc-prod-drill">
          <table>
            <thead>
              <tr>
                <th>Gerente de vendas</th>
                <th>Equipe</th>
                <th>HC</th>
                <th>IPC ano</th>
                <th>IPC mês</th>
                <th>Meta IPC</th>
                <th>Quartil</th>
                <th>% total</th>
                <th>Rep. sug.</th>
                <th>Rep. real</th>
                <th>Pasta sug.</th>
                <th>Pasta real</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>${escapeHtml(gerenteItem.nome || "Sem gerente de vendas")}</strong></td>
                <td>${escapeHtml(gerenteItem.equipe_resumo || "-")}</td>
                <td>${formatNumber(gerenteItem.pessoas)}</td>
                <td>${formatNumber(gerenteItem.ipc_ano_vigente, 2)}</td>
                <td>${formatNumber(gerenteItem.ipc_mes, 2)}</td>
                <td>${formatNumber(gerenteItem.meta_ipc, 2)}</td>
                <td>${produtividadeQuartilChipHtml(info)}</td>
                <td>${produtividadeShareChipHtml(info)}</td>
                <td>${formatNumber(gerenteItem.meta_repasse_sugerida)}</td>
                <td>${formatNumber(repasseReal)}</td>
                <td>${formatNumber(gerenteItem.meta_pasta_sugerida)}</td>
                <td>${formatNumber(pastaReal)}</td>
              </tr>
            </tbody>
          </table>
          ${produtividadeCorretoresRows(gerenteItem.corretores || [], gerenteItem)}
        </div>
      `;
    }).join("");
  }

  function renderProdutividadeGerentes() {
    const coordenadores = state.produtividade?.coordenadores || [];
    const gerentes = state.produtividade?.gerentes || [];
    const coordStats = produtividadeQuartilMap(coordenadores, (item) => item.key || slugKey(item.nome || ""));
    const gerenteStats = produtividadeQuartilMap(gerentes, (item) => item.key || slugKey(item.nome || ""));
    if (el.totalProdutividadeGerentes) {
      el.totalProdutividadeGerentes.textContent = coordenadores.length === 1
        ? "1 gerente comercial"
        : `${formatNumber(coordenadores.length)} gerentes comerciais`;
    }
    if (!el.tabelaProdutividadeGerentes) return;
    const sortedGerentes = [...coordenadores].sort((a, b) => {
      const infoA = coordStats.get(a.key || slugKey(a.nome || "")) || produtividadeQuartilFallback(a);
      const infoB = coordStats.get(b.key || slugKey(b.nome || "")) || produtividadeQuartilFallback(b);
      return toNumber(b.ipc_ano_vigente) - toNumber(a.ipc_ano_vigente)
        || toNumber(infoA.quartil) - toNumber(infoB.quartil)
        || toNumber(infoA.rank) - toNumber(infoB.rank)
        || toNumber(b.repasses_ano_vigente) - toNumber(a.repasses_ano_vigente)
        || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });
    el.tabelaProdutividadeGerentes.innerHTML = sortedGerentes.map((gerenteItem) => {
      const key = escapeHtml(gerenteItem.key || slugKey(gerenteItem.nome));
      const sixMonths = (gerenteItem.serie_6_meses || []).map((item) => formatNumber(item.repasses)).join(" / ");
      const coordGerentes = Array.isArray(gerenteItem.gerentes) ? gerenteItem.gerentes : gerentes.filter((item) => slugKey(item.coordenador) === slugKey(gerenteItem.nome));
      const info = coordStats.get(gerenteItem.key || slugKey(gerenteItem.nome || "")) || produtividadeQuartilFallback(gerenteItem);
      const repasseReal = toNumber(info.repasses);
      const pastaReal = produtividadePastaReal(gerenteItem, info);
      return `
        <tr class="tl-gc-prod-row" data-prod-drill="${key}">
          <td>
            <button class="tl-gc-prod-row-btn" type="button" aria-expanded="false" data-prod-button="${key}">
              <span class="tl-gc-prod-chevron">&rsaquo;</span>
              <strong>${escapeHtml(gerenteItem.nome || "Sem gerente comercial")}</strong>
              <small>${formatNumber(coordGerentes.length || gerenteItem.gerentes_total)} gerente${toNumber(coordGerentes.length || gerenteItem.gerentes_total) === 1 ? "" : "s"} de vendas</small>
            </button>
          </td>
          <td>${escapeHtml(coordGerentes.map((item) => item.nome).filter(Boolean).join(", ") || "-")}</td>
          <td>${formatNumber(gerenteItem.pessoas)}</td>
          <td>${formatNumber(gerenteItem.ipc_ano_anterior, 2)}</td>
          <td>${formatNumber(gerenteItem.ipc_ano_vigente, 2)}</td>
          <td>${formatNumber(gerenteItem.ipc_mes, 2)}</td>
          <td>${formatNumber(gerenteItem.meta_ipc, 2)}</td>
          <td><span class="tl-gc-prod-series-text">${escapeHtml(sixMonths || "-")}</span></td>
          <td>${produtividadeQuartilChipHtml(info)}</td>
          <td>${produtividadeShareChipHtml(info)}</td>
          <td>${formatNumber(gerenteItem.meta_repasse_sugerida)}</td>
          <td>${formatNumber(repasseReal)}</td>
          <td>${formatNumber(gerenteItem.meta_pasta_sugerida)}</td>
          <td>${formatNumber(pastaReal)}</td>
        </tr>
        <tr class="tl-gc-prod-drill-row" data-prod-detail="${key}" hidden>
          <td colspan="14">
            <div class="tl-gc-prod-detail">
              <div class="tl-gc-prod-detail__summary">
                ${produtividadeKpiHtml(gerenteItem, "Maturidade", gerenteItem.tempo_casa_label || "-", "Base consolidada")}
                ${produtividadeKpiHtml(gerenteItem, "Gerentes", formatNumber(coordGerentes.length || gerenteItem.gerentes_total), `${formatNumber(gerenteItem.pessoas)} HC`, "rep")}
                ${produtividadeKpiHtml(gerenteItem, "IPC ano", formatNumber(gerenteItem.ipc_ano_vigente, 2), `${formatNumber(gerenteItem.repasses_ano_vigente)} repasses / ${formatNumber(gerenteItem.pessoas)} HC`, "rep")}
                ${produtividadeKpiHtml(gerenteItem, "IPC mês", formatNumber(gerenteItem.ipc_mes, 2), `${formatNumber(gerenteItem.repasses_mes)} repasses / ${formatNumber(gerenteItem.pessoas)} HC`, "rep")}
                ${produtividadeKpiHtml(gerenteItem, "Meta IPC", formatNumber(gerenteItem.meta_ipc, 2), `${formatNumber(gerenteItem.meta_repasse_sugerida)} meta / ${formatNumber(gerenteItem.pessoas)} HC`, "rep")}
                ${produtividadeKpiHtml(gerenteItem, "Repasses acum.", formatNumber(gerenteItem.repasses_ano_vigente), `${formatNumber(gerenteItem.repasses_mes)} no mês`, "rep")}
                ${produtividadeKpiHtml(gerenteItem, "Pastas mês", formatNumber(gerenteItem.pastas_mes), `${formatNumber(gerenteItem.pastas_ano_vigente)} no ano`, "pasta")}
                ${produtividadeQuartilKpisHtml(info)}
              </div>
              ${produtividadeSparkHtml(gerenteItem.serie_6_meses)}
              ${produtividadeGerentesVendaRows(coordGerentes, gerenteStats)}
            </div>
          </td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="14"><div class="tl-gc-empty">Nenhum gerente comercial encontrado para os filtros atuais.</div></td></tr>`;
  }

  function renderProdutividadeView() {
    if (state.activeTab !== "produtividade" || !state.produtividadeLoaded) return;
    renderProdutividadeSync();
    renderProdutividadeMetrics();
    renderProdutividadeInsights();
    renderProdutividadeCoordenadores();
    renderProdutividadeGerentes();
    applyTitleCaseStaticContent(document.getElementById("visaoProdutividadeGc"));
  }

  const COMERCIAL_NUMERIC_FIELDS = [
    "pessoas",
    "repasses_mes",
    "reservas_mes",
    "pastas_mes",
    "leads_mes",
    "visitas_mes",
    "vendas_mes",
    "propostas_aprovadas_mes",
    "propostas_condicionadas_mes",
    "propostas_reprovadas_mes",
    "propostas_total_mes",
    "cancelamentos_mes",
    "distratos_mes",
    "repasses_ano_vigente",
    "reservas_ano_vigente",
    "pastas_ano_vigente",
    "leads_ano_vigente",
    "visitas_ano_vigente",
    "vendas_ano_vigente",
    "propostas_total_ano_vigente",
    "meta_repasse_sugerida",
    "meta_pasta_sugerida",
  ];

  function comercialEmptyState() {
    return {
      resumo: {},
      coordenadores: [],
      gerentes: [],
      equipes: [],
      corretores: [],
      corretores_total: 0,
      corretores_renderizados: 0,
      corretores_limitados: false,
      filtros: {},
      status_sync: {},
      ultima_sincronizacao: null,
    };
  }

  function comercialPayload() {
    return state.comercial || comercialEmptyState();
  }

  function comercialStatus(item = {}) {
    const meta = toNumber(item.meta_repasse_sugerida);
    const repasses = toNumber(item.repasses_mes);
    const atingimento = meta > 0 ? (repasses / meta) * 100 : 0;
    if (meta <= 0) return { label: "Sem meta", className: "is-muted", tone: "neutral", atingimento };
    if (atingimento >= 100) return { label: "Elite", className: "is-success", tone: "good", atingimento };
    if (atingimento >= 70) return { label: "Produtora", className: "is-info", tone: "blue", atingimento };
    if (repasses > 0) return { label: "Desenvolvimento", className: "is-warn", tone: "warn", atingimento };
    return { label: "Recuperação", className: "is-danger", tone: "bad", atingimento };
  }

  function comercialEquipeGroups() {
    if (comercialEquipeGroupsCache) return comercialEquipeGroupsCache;
    const payload = comercialPayload();
    if (Array.isArray(payload.equipes) && payload.equipes.length) {
      comercialEquipeGroupsCache = payload.equipes.map((item) => {
        const pessoas = Math.max(0, toNumber(item.pessoas));
        const meta = toNumber(item.meta_repasse_sugerida);
        return {
          ...item,
          equipe: normalizeText(item.equipe || item.nome) || "Sem equipe",
          gerente: normalizeText(item.gerente) || "Sem gerente de vendas",
          coordenador: normalizeText(item.coordenador) || "Sem gerente comercial",
          regiao: normalizeText(item.regiao) || "Sem região",
          pessoas,
          ipc_mes: toNumber(item.ipc_mes) || (pessoas > 0 ? toNumber(item.repasses_mes) / pessoas : 0),
          atingimento_repasse: toNumber(item.atingimento_repasse) || (meta > 0 ? toNumber(item.repasses_mes) / meta * 100 : 0),
          status: comercialStatus(item),
        };
      }).sort((a, b) => (
        toNumber(b.repasses_mes) - toNumber(a.repasses_mes)
        || toNumber(b.ipc_mes) - toNumber(a.ipc_mes)
        || a.equipe.localeCompare(b.equipe, "pt-BR")
      ));
      return comercialEquipeGroupsCache;
    }
    const map = new Map();
    (payload.corretores || []).forEach((corretor) => {
      const equipe = normalizeText(corretor.equipe) || "Sem equipe";
      const gerente = normalizeText(corretor.gerente) || "Sem gerente de vendas";
      const coordenador = normalizeText(corretor.coordenador) || "Sem gerente comercial";
      const regiao = normalizeText(corretor.regiao) || "Sem região";
      const key = [
        slugKey(regiao) || "sem_regiao",
        slugKey(coordenador) || "sem_comercial",
        slugKey(gerente) || "sem_gerente",
        slugKey(equipe) || "sem_equipe",
      ].join("::");
      if (!map.has(key)) {
        map.set(key, {
          key,
          equipe,
          gerente,
          coordenador,
          regiao,
          corretores: [],
          pessoas: 0,
        });
      }
      const row = map.get(key);
      row.corretores.push(corretor);
      COMERCIAL_NUMERIC_FIELDS.forEach((field) => {
        row[field] = toNumber(row[field]) + toNumber(corretor[field]);
      });
    });
    comercialEquipeGroupsCache = [...map.values()].map((item) => {
      const pessoas = Math.max(0, toNumber(item.pessoas) || item.corretores.length);
      const meta = toNumber(item.meta_repasse_sugerida);
      return {
        ...item,
        pessoas,
        ipc_mes: pessoas > 0 ? toNumber(item.repasses_mes) / pessoas : 0,
        atingimento_repasse: meta > 0 ? toNumber(item.repasses_mes) / meta * 100 : 0,
        status: comercialStatus({ ...item, pessoas }),
      };
    }).sort((a, b) => (
      toNumber(b.repasses_mes) - toNumber(a.repasses_mes)
      || toNumber(b.ipc_mes) - toNumber(a.ipc_mes)
      || a.equipe.localeCompare(b.equipe, "pt-BR")
    ));
    return comercialEquipeGroupsCache;
  }

  function comercialCorretoresRanking() {
    if (comercialCorretoresRankingCache) return comercialCorretoresRankingCache;
    comercialCorretoresRankingCache = [...(comercialPayload().corretores || [])].sort((a, b) => (
      toNumber(b.repasses_mes) - toNumber(a.repasses_mes)
      || toNumber(b.ipc_mes) - toNumber(a.ipc_mes)
      || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
    ));
    return comercialCorretoresRankingCache;
  }

  function renderComercialSync() {
    if (!el.comercialUltimaSync) return;
    const payload = comercialPayload();
    const sync = payload.status_sync || {};
    const updated = payload.ultima_sincronizacao || sync.finished_at || sync.updated_at || sync.started_at;
    const status = normalizeText(sync.status || "");
    const hasError = normalizeKey(status).includes("error") || normalizeKey(status).includes("falha");
    el.comercialUltimaSync.classList.toggle("is-error", hasError);
    el.comercialUltimaSync.textContent = hasError
      ? "Databricks Com Erro"
      : (updated ? `Databricks ${formatDateTimePt(updated)}` : "Databricks Pendente");
  }

  function renderComercialMetrics() {
    const resumo = comercialPayload().resumo || {};
    const pessoas = toNumber(resumo.pessoas) || (comercialPayload().corretores || []).length;
    const meta = toNumber(resumo.meta_repasse_sugerida);
    const repasses = toNumber(resumo.repasses_mes);
    const atingimento = meta > 0 ? repasses / meta * 100 : 0;
    renderViewMetrics(el.metricasComercialGc, [
      { label: "Repasse TT", value: formatNumber(repasses), detail: `${periodLabel()} selecionado` },
      { label: "Repasse Ano", value: formatNumber(resumo.repasses_ano_vigente), detail: "Base vigente Databricks" },
      { label: "QLP", value: formatNumber(pessoas), detail: "Corretores ativos na leitura" },
      { label: "IPC Médio", value: formatNumber(resumo.ipc_mes, 2), detail: `${formatNumber(resumo.pastas_mes)} pastas no mês` },
      { label: "Propostas", value: formatNumber(resumo.propostas_total_mes || resumo.pastas_mes), detail: `${formatNumber(resumo.propostas_aprovadas_mes)} aprovadas / ${formatNumber(resumo.propostas_condicionadas_mes)} condicionadas` },
      { label: "Meta Repasse", value: formatNumber(meta), detail: `${formatNumber(atingimento, 1)}% atingido` },
    ]);
  }

  function renderComercialTeamCards() {
    const equipes = comercialEquipeGroups();
    if (el.totalComercialEquipes) {
      el.totalComercialEquipes.textContent = `${formatNumber(equipes.length)} Equipe${equipes.length === 1 ? "" : "s"}`;
    }
    if (!el.comercialEquipesCards) return;
    const top = equipes.slice(0, 8);
    el.comercialEquipesCards.innerHTML = top.map((item) => {
      const status = item.status || comercialStatus(item);
      return `
        <article class="tl-gc-comercial-team-card ${escapeHtml(status.className)}">
          <div>
            <span>${escapeHtml(titleCaseDisplay(status.label))}</span>
            <strong>${escapeHtml(titleCaseDisplay(item.equipe))}</strong>
            <small>${escapeHtml(titleCaseDisplay(`${item.regiao} | ${item.gerente}`))}</small>
          </div>
          <dl>
            <div><dt>QLP</dt><dd>${formatNumber(item.pessoas)}</dd></div>
            <div><dt>Repasse</dt><dd>${formatNumber(item.repasses_mes)}</dd></div>
            <div><dt>IPC</dt><dd>${formatNumber(item.ipc_mes, 2)}</dd></div>
            <div><dt>Meta</dt><dd>${formatNumber(item.meta_repasse_sugerida)}</dd></div>
          </dl>
          <i style="--value:${Math.max(0, Math.min(100, toNumber(status.atingimento)))}%"></i>
        </article>
      `;
    }).join("") || `<div class="tl-gc-empty">Nenhuma equipe comercial encontrada para os filtros atuais.</div>`;
  }

  function comercialFunnelStages() {
    const resumo = comercialPayload().resumo || {};
    const cancelados = toNumber(resumo.cancelamentos_mes) + toNumber(resumo.distratos_mes);
    return [
      { label: "Leads", value: toNumber(resumo.leads_mes), detail: "Base de entrada" },
      { label: "Atendimentos", value: toNumber(resumo.visitas_mes), detail: "Visitas/atendimentos" },
      { label: "Propostas", value: toNumber(resumo.propostas_total_mes || resumo.pastas_mes), detail: "Pastas/propostas" },
      { label: "Aprovadas", value: toNumber(resumo.propostas_aprovadas_mes), detail: "Aprovadas no mês" },
      { label: "Condicionadas", value: toNumber(resumo.propostas_condicionadas_mes), detail: "Com condição" },
      { label: "Vendas", value: toNumber(resumo.vendas_mes || resumo.reservas_mes), detail: "Venda/reserva" },
      { label: "Repasses", value: toNumber(resumo.repasses_mes), detail: "Repasse concluído" },
      { label: "Canceladas", value: cancelados, detail: "Distrato/cancelamento" },
    ];
  }

  function renderComercialFunnel() {
    const stages = comercialFunnelStages();
    const max = Math.max(1, ...stages.map((stage) => stage.value));
    if (el.totalComercialFunil) {
      const leads = stages[0]?.value || 0;
      const repasses = stages.find((stage) => stage.label === "Repasses")?.value || 0;
      el.totalComercialFunil.textContent = `${formatNumber(leads)} Leads / ${formatNumber(repasses)} Repasses`;
    }
    if (!el.comercialFunilGc) return;
    el.comercialFunilGc.innerHTML = stages.map((stage, index) => {
      const previous = index > 0 ? stages[index - 1].value : stage.value;
      const conversion = previous > 0 ? stage.value / previous * 100 : 0;
      const stageClass = stage.label === "Canceladas"
        ? "is-danger"
        : (index >= 5 ? "is-success" : (index >= 2 ? "is-info" : "is-warn"));
      return `
        <div class="tl-gc-comercial-stage ${stageClass}">
          <div>
            <span>${escapeHtml(titleCaseDisplay(stage.label))}</span>
            <strong>${formatNumber(stage.value)}</strong>
            <small>${escapeHtml(titleCaseDisplay(stage.detail))}</small>
          </div>
          <em>${index === 0 ? "100,0%" : formatPercent(conversion)}</em>
          <i style="--value:${Math.max(4, Math.min(100, stage.value / max * 100))}%"></i>
        </div>
      `;
    }).join("");
  }

  function renderComercialRankingEquipes() {
    const equipes = comercialEquipeGroups();
    if (el.totalComercialRankingEquipes) {
      el.totalComercialRankingEquipes.textContent = `${formatNumber(equipes.length)} Equipe${equipes.length === 1 ? "" : "s"}`;
    }
    if (!el.tabelaComercialRankingEquipes) return;
    el.tabelaComercialRankingEquipes.innerHTML = equipes.map((item) => {
      const status = item.status || comercialStatus(item);
      return `
        <tr>
          <td><strong>${escapeHtml(titleCaseDisplay(item.equipe))}</strong><small>${escapeHtml(titleCaseDisplay(item.regiao))}</small></td>
          <td>${escapeHtml(titleCaseDisplay(item.gerente))}<small>${escapeHtml(titleCaseDisplay(item.coordenador))}</small></td>
          <td>${formatNumber(item.pessoas)}</td>
          <td>${formatNumber(item.repasses_mes)}</td>
          <td>${formatNumber(item.ipc_mes, 2)}</td>
          <td>${formatNumber(item.meta_repasse_sugerida)}</td>
          <td><span class="tl-gc-vacancy-state ${escapeHtml(status.className)}">${escapeHtml(titleCaseDisplay(status.label))}</span><small>${formatNumber(status.atingimento, 1)}%</small></td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="7"><div class="tl-gc-empty">Nenhuma equipe encontrada para os filtros atuais.</div></td></tr>`;
  }

  function renderComercialActions() {
    const equipes = comercialEquipeGroups();
    const actions = equipes
      .filter((item) => toNumber(item.meta_repasse_sugerida) > 0)
      .sort((a, b) => toNumber(a.atingimento_repasse) - toNumber(b.atingimento_repasse) || toNumber(b.meta_repasse_sugerida) - toNumber(a.meta_repasse_sugerida))
      .slice(0, 6);
    if (!el.comercialAcoesGestao) return;
    el.comercialAcoesGestao.innerHTML = actions.map((item, index) => {
      const gap = Math.max(0, toNumber(item.meta_repasse_sugerida) - toNumber(item.repasses_mes));
      return `
        <div class="tl-gc-comercial-action">
          <span>${formatNumber(index + 1)}</span>
          <div>
            <strong>${escapeHtml(titleCaseDisplay(item.equipe))}</strong>
            <small>${escapeHtml(titleCaseDisplay(`${item.regiao} | ${item.gerente}`))}</small>
          </div>
          <em>${formatNumber(gap)} Rep.</em>
        </div>
      `;
    }).join("") || `<div class="tl-gc-empty">Nenhuma ação crítica encontrada para os filtros atuais.</div>`;
  }

  function renderComercialRankingCorretores() {
    const corretores = comercialCorretoresRanking();
    const totalCorretores = toNumber(comercialPayload().corretores_total) || corretores.length;
    const corretoresVisiveis = corretores.slice(0, COMERCIAL_CORRETORES_RENDER_LIMIT);
    if (el.totalComercialRankingCorretores) {
      el.totalComercialRankingCorretores.textContent = totalCorretores > corretoresVisiveis.length
        ? `${formatNumber(corretoresVisiveis.length)} De ${formatNumber(totalCorretores)} Corretores`
        : `${formatNumber(totalCorretores)} Corretor${totalCorretores === 1 ? "" : "es"}`;
    }
    if (!el.tabelaComercialRankingCorretores) return;
    const linhas = corretoresVisiveis.map((item) => {
      const status = comercialStatus(item);
      return `
        <tr>
          <td><strong>${escapeHtml(titleCaseDisplay(item.nome || "Sem corretor"))}</strong><small>${escapeHtml(titleCaseDisplay(item.gerente || "-"))}</small></td>
          <td>${escapeHtml(titleCaseDisplay(item.equipe || "-"))}</td>
          <td>${escapeHtml(titleCaseDisplay(item.foco || "-"))}</td>
          <td>${escapeHtml(titleCaseDisplay(item.tempo_casa_label || "-"))}</td>
          <td>${formatNumber(item.repasses_mes)}</td>
          <td>${formatNumber(item.ipc_mes, 2)}</td>
          <td>${formatNumber(item.repasses_ano_vigente)}</td>
          <td>${formatNumber(item.meta_ipc, 2)}</td>
          <td><span class="tl-gc-vacancy-state ${escapeHtml(status.className)}">${escapeHtml(titleCaseDisplay(status.label))}</span></td>
        </tr>
      `;
    });
    if (totalCorretores > corretoresVisiveis.length) {
      linhas.push(`<tr><td colspan="9"><div class="tl-gc-empty">Mostrando ${formatNumber(corretoresVisiveis.length)} De ${formatNumber(totalCorretores)} Corretores Para Preservar A Performance. Use Os Filtros Para Refinar A Leitura.</div></td></tr>`);
    }
    el.tabelaComercialRankingCorretores.innerHTML = linhas.join("") || `<tr><td colspan="9"><div class="tl-gc-empty">Nenhum corretor encontrado para os filtros atuais.</div></td></tr>`;
  }

  function renderComercialView() {
    if (state.activeTab !== "comercial") return;
    if (!state.comercialLoaded && comercialLoadingPromise) {
      renderComercialLoading();
      return;
    }
    traceComercialStage("render:start");
    renderComercialSync();
    traceComercialStage("render:sync-ok");
    renderComercialMetrics();
    traceComercialStage("render:metrics-ok");
    renderComercialTeamCards();
    traceComercialStage("render:team-cards-ok");
    renderComercialFunnel();
    traceComercialStage("render:funnel-ok");
    renderComercialRankingEquipes();
    traceComercialStage("render:ranking-equipes-ok");
    renderComercialActions();
    traceComercialStage("render:actions-ok");
    renderComercialRankingCorretores();
    traceComercialStage("render:ranking-corretores-ok");
    applyTitleCaseStaticContent(document.getElementById("visaoComercialGc"));
    traceComercialStage("render:titlecase-ok");
  }

  function toggleProdutividadeDrill(key) {
    const detail = el.tabelaProdutividadeGerentes?.querySelector(`[data-prod-detail="${CSS.escape(key)}"]`);
    const row = el.tabelaProdutividadeGerentes?.querySelector(`[data-prod-drill="${CSS.escape(key)}"]`);
    const button = el.tabelaProdutividadeGerentes?.querySelector(`[data-prod-button="${CSS.escape(key)}"]`);
    if (!detail) return;
    const nextOpen = detail.hidden;
    detail.hidden = !nextOpen;
    row?.classList.toggle("is-open", nextOpen);
    button?.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  }

  function updateDebugSnapshot() {
    const comercialEquipesSnapshot = state.comercialLoaded ? comercialEquipeGroups() : [];
    const comercialCorretoresSnapshot = state.comercialLoaded ? comercialCorretoresRanking().slice(0, COMERCIAL_CORRETORES_RENDER_LIMIT) : [];
    window.__tlGcDashboardSnapshot = {
      period: currentPeriodKey(),
      activeTab: state.activeTab,
      sources: {
        funcionariosTotal: state.funcionarios.length,
        funcionariosComerciaisAtivos: activeCommercialFuncionarios().length,
        funcionariosComerciaisAfastados: afastadoCommercialFuncionarios().length,
        funcionariosFiltrados: filteredFuncionarios().length,
        vagasManuais: state.vagasManuais.length,
        vagasPendentesAprovacao: sumVagaQuantidade(state.vagasManuais.filter(isVagaPendenteAprovacao)),
        vagasManuaisAbertas: sumVagaQuantidade(state.vagasManuais.filter(isVagaManualAberta)),
        forecastsManuais: state.forecastsManuais.length,
        forecastHistorico: state.forecastHistorico.length,
        produtividadeCoordenadores: (state.produtividade?.coordenadores || []).length,
        produtividadeGerentes: (state.produtividade?.gerentes || []).length,
        produtividadeCorretores: (state.produtividade?.corretores || []).length,
        comercialCoordenadores: (state.comercial?.coordenadores || []).length,
        comercialGerentes: (state.comercial?.gerentes || []).length,
        comercialCorretores: (state.comercial?.corretores || []).length,
        equipesCatalogo: state.equipesCatalogo.length,
        objetivos: (state.dashboard.itens || []).length,
        equipes: state.groups.length,
        gestoresResumo: state.tableGroups.length,
      },
      kpis: { ...state.kpis },
      groups: state.groups.map((group) => ({
        key: group.key,
        regiao: group.regiao,
        equipe: group.equipe,
        gestor: group.gestorLabel,
        ativos: group.pessoasTotal,
        objetivos: group.objetivos,
        meta: group.meta,
        realizado: group.realizado,
        semObjetivo: group.semObjetivo,
        headcountGap: group.headcountGap,
      })),
      vagasManuais: state.vagasManuais.map((vaga) => ({
        identificador_vaga: vaga.identificador_vaga,
        protocolo: vaga.protocolo,
        equipe: vaga.equipe,
        status: vagaStatusKey(vaga),
        quantidade_vagas: vagaQuantidade(vaga),
        prioridade_niveis: vagaPrioridadeNiveis(vaga),
        andamentosTotal: vagaAndamentos(vaga).length,
        ultimoAndamento: vagaUltimoAndamento(vaga),
      })),
      tableGroups: state.tableGroups.map((group) => ({
        key: group.key,
        gestor: group.gestorLabel,
        regiao: group.regiao,
        regioesDetalhadas: group.regioesDetalhadas,
        equipe: group.equipe,
        equipeDetalhe: group.equipeDetalhe,
        equipesDetalhadas: group.equipesDetalhadas,
        gerenteComercial: commercialManagerText(group),
        gerentesComerciaisDetalhados: group.gerentesComerciaisDetalhados,
        tipo: group.tipoLabel,
        tiposDetalhados: group.tiposDetalhados,
        regraResumo: group.regraResumo,
        regras: [...(group.ruleCounts || new Map()).entries()].map(([label, count]) => ({ label, count })),
        equipesTotal: group.equipesTotal,
        metasEquipes: group.metasEquipes,
        ativos: group.pessoasTotal,
        afastados: group.pessoasAfastadas,
        meta: group.meta,
        forecastPadrao: group.forecastPadrao,
        forecastOrigem: group.forecastOrigem,
        headcountGap: group.headcountGap,
        vagasAbertas: group.vagasAbertas,
        vagasLideranca: group.vagasLideranca,
        vagasLiderancaDetalhes: group.vagasLiderancaDetalhes,
        vagasLiderancaForecastDetalhes: group.vagasLiderancaForecastDetalhes,
        vagasAbertasSla: openVacanciesForTeams(group.equipes || []).map((vaga) => ({
          protocolo: vaga.protocolo,
          equipe: vaga.equipe,
          cargo: vagaCargo(vaga),
          quantidade_vagas: vagaQuantidade(vaga),
          data_abertura: vaga.data_abertura,
          sla_dias: vagaSlaDias(vaga),
        })),
        situacao: group.situacao.key,
      })),
      comercial: {
        resumo: { ...(state.comercial?.resumo || {}) },
        funil: comercialFunnelStages().map((stage) => ({ label: stage.label, value: stage.value })),
        equipes: comercialEquipesSnapshot.map((item) => ({
          key: item.key,
          regiao: item.regiao,
          equipe: item.equipe,
          gerente: item.gerente,
          coordenador: item.coordenador,
          pessoas: item.pessoas,
          repasses_mes: item.repasses_mes,
          ipc_mes: item.ipc_mes,
          meta_repasse_sugerida: item.meta_repasse_sugerida,
          atingimento_repasse: item.atingimento_repasse,
          status: item.status?.label,
        })),
        corretores_total: toNumber(state.comercial?.corretores_total) || (state.comercial?.corretores || []).length,
        corretores_renderizados: comercialCorretoresSnapshot.length,
        corretores: comercialCorretoresSnapshot.map((item) => ({
          key: item.key,
          nome: item.nome,
          equipe: item.equipe,
          gerente: item.gerente,
          coordenador: item.coordenador,
          foco: item.foco,
          repasses_mes: item.repasses_mes,
          ipc_mes: item.ipc_mes,
          repasses_ano_vigente: item.repasses_ano_vigente,
          meta_ipc: item.meta_ipc,
        })),
      },
    };
  }

  function renderAll() {
    buildTeamGroups();
    buildManagerTableGroups();
    fillTableFilters();
    fillVagaEquipeOptions();
    renderDashboardSummaryVisuals();
    renderTable();
    renderAlerts();
    renderRecentPendencies();
    renderFeaturedTeam();
    renderForecastHistorico();
    renderEquipesView();
    renderAprovacoesView();
    renderVagasView();
    renderPessoasView();
    renderProdutividadeView();
    renderComercialView();
    applyTitleCaseStaticContent(activeGcTabRoot());
    updateDebugSnapshot();
  }

  function renderDashboardSummaryVisuals() {
    const groups = dashboardSummaryGroups();
    const vagaStatusCounts = buildVagaStatusCounts(groups);
    const visibleVagaStatusCounts = vagaStatusCounts.filter((item) => item.value > 0);
    const fallbackVagaStatusCounts = vagaStatusCounts.filter((item) => ["PENDENTE_APROVACAO_REGIONAL", "PENDENTE_APROVACAO", "EM_ANDAMENTO", "FECHADA"].includes(item.key));
    renderKpis();
    renderRegionGap();
    renderTeamSituation(el.donutEquipes, el.statusEquipes, buildTeamSituationCounts(groups));
    renderVacancyStatusSummary(el.donutVagas, el.statusVagas, vagaStatusCounts, visibleVagaStatusCounts.length ? visibleVagaStatusCounts : fallbackVagaStatusCounts);
    renderVagasManuais();
  }

  async function refresh() {
    setFeedback("info", "Atualizando colaboradores, metas e resultados...");
    try {
      const loaders = [loadFuncionarios(), loadEquipesCatalogo(), loadDashboard(), loadVagasManuais(), loadForecastsManuais(), loadForecastHistorico()];
      if (state.activeTab === "produtividade") {
        state.produtividadeLoaded = false;
        loaders.push(loadProdutividade());
      }
      if (state.activeTab === "comercial") {
        state.comercialLoaded = false;
        loaders.push(loadComercial());
      }
      await Promise.all(loaders);
      renderAll();
      setFeedback("", "");
    } catch (error) {
      setFeedback("error", error?.message || "Não foi possível carregar o Dashboard G&C.");
    }
  }

  async function refreshProdutividadeOnly() {
    setFeedback("info", "Atualizando produtividade...");
    try {
      state.produtividadeLoaded = false;
      await loadProdutividade();
      renderProdutividadeView();
      applyTitleCaseStaticContent();
      updateDebugSnapshot();
      setFeedback("", "");
    } catch (error) {
      renderProdutividadeView();
      setFeedback("error", error?.message || "Não foi possível carregar a produtividade.");
    }
  }

  async function refreshComercialOnly() {
    setFeedback("info", "Atualizando comercial...");
    try {
      state.comercialLoaded = false;
      await loadComercial();
      renderComercialView();
      updateDebugSnapshot();
      setFeedback("", "");
    } catch (error) {
      renderComercialView();
      setFeedback("error", error?.message || "Não foi possível carregar o Dashboard Comercial.");
    }
  }

  async function refreshPeriod() {
    const period = currentPeriodKey();
    if (el.filtroMes) el.filtroMes.value = String(period.mes);
    if (el.filtroAno) el.filtroAno.value = String(period.ano);
    syncCustomSelect(el.filtroMes);
    await refresh();
  }

  function exportCsv() {
    const rows = [
      ["Região", "Equipe", "Foco", "Gerente Comercial", "Gerente De Vendas", "Tempo Do Gerente De Vendas", "Faixa Do Gerente De Vendas", "HC", "Afastados", "Forecast", "Gap", "Vagas Abertas", "Maturidade", "Situação"],
      ...state.filteredGroups.map((group) => [
        group.regiao,
        group.equipeDetalhe || group.equipe,
        focusSummaryText(group, false),
        commercialManagerText(group),
        group.gestorLabel,
        group.gestorTempo?.label || "-",
        group.gestorTempo?.stage?.label || "-",
        group.pessoasTotal,
        group.pessoasAfastadas,
        group.meta,
        group.headcountGap,
        group.vagasAbertas,
        group.tempoLabel,
        group.situacao.label,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard_gc_${el.filtroAno?.value || ""}_${el.filtroMes?.value || ""}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function renderSlaVagas(vagas) {
    if (!el.listaSlaVagas) return;
    if (!vagas.length) {
      el.listaSlaVagas.innerHTML = `<div class="tl-gc-empty">Nenhuma vaga aberta para esta equipe.</div>`;
      return;
    }
    el.listaSlaVagas.innerHTML = vagas.map((vaga) => {
      const dias = vagaStageSlaDias(vaga);
      const sla = vagaSlaClass(dias);
      const quantidade = vagaQuantidade(vaga);
      const statusInfo = vagaStatusInfo(vaga);
      return `
        <article class="tl-gc-sla-item">
          <div>
            <strong>${escapeHtml(vaga.protocolo || "Sem protocolo")}</strong>
            <span>${escapeHtml(vaga.equipe || "-")} &bull; ${escapeHtml(vagaCargo(vaga))} &bull; ${escapeHtml(titleCaseDisplay(statusInfo.label))}</span>
          </div>
          <dl>
            <div><dt>Quantidade</dt><dd>${formatNumber(quantidade)} vaga${quantidade === 1 ? "" : "s"}</dd></div>
            <div><dt>Solicitada em</dt><dd>${escapeHtml(formatDatePt(vaga.data_abertura))}</dd></div>
            <div><dt>SLA da Etapa</dt><dd>${formatNumber(dias)} dia${dias === 1 ? "" : "s"}</dd></div>
          </dl>
          <em class="tl-gc-sla-chip is-${escapeHtml(sla.key)}">${escapeHtml(sla.label)}</em>
        </article>
      `;
    }).join("");
  }

  function openVagasSlaModal(groupKey) {
    const group = state.tableGroups.find((item) => item.key === groupKey);
    if (!group || !el.modalVagasSla) return;
    const vagas = openVacanciesForTeams(group.equipes || []);
    if (el.tituloModalVagasSla) el.tituloModalVagasSla.textContent = "SLA Das Vagas Abertas";
    if (el.subtituloModalVagasSla) {
      const totalVagas = sumVagaQuantidade(vagas);
      el.subtituloModalVagasSla.textContent = `${group.gestorLabel} • ${group.equipeDetalhe || group.equipe} • ${formatNumber(totalVagas)} vaga${totalVagas === 1 ? "" : "s"} em ${formatNumber(vagas.length)} protocolo${vagas.length === 1 ? "" : "s"}`;
    }
    renderSlaVagas(vagas);
    el.modalVagasSla.hidden = false;
    document.body.classList.add("tl-gc-modal-open");
  }

  function closeVagasSlaModal() {
    if (!el.modalVagasSla) return;
    el.modalVagasSla.hidden = true;
    document.body.classList.remove("tl-gc-modal-open");
  }

  function updateVagaDateRequirement() {
    if (!el.formVagaManual) return;
    const fechamento = el.formVagaManual.elements.data_fechamento;
    const statusValue = normalizeVagaStatus(el.formVagaStatus?.value || el.formVagaManual.elements.status_vaga?.value);
    const required = statusValue === "FECHADA" || el.formVagaManual.dataset.mode === "fechar";
    if (fechamento) fechamento.required = required;
    if (fechamento) fechamento.dataset.gcDateRequired = required ? "true" : "false";
    syncDatePicker(fechamento);
  }

  function setVagaFormMode(mode) {
    if (!el.formVagaManual) return;
    const readonly = mode === "fechar" || mode === "ver";
    const isNew = mode === "nova";
    const statusKey = normalizeVagaStatus(el.formVagaStatus?.value || el.formVagaManual.elements.status_vaga?.value);
    const protocolo = el.formVagaManual.elements.protocolo;
    const cargo = el.formVagaManual.elements.cargo;
    const quantidade = el.formVagaManual.elements.quantidade_vagas;
    const abertura = el.formVagaManual.elements.data_abertura;
    const fechamento = el.formVagaManual.elements.data_fechamento;
    const prazo = el.formVagaManual.elements.prazo_desejado;
    const andamento = el.formVagaManual.elements.andamento;
    if (protocolo) protocolo.readOnly = true;
    if (cargo) cargo.readOnly = Boolean(readonly);
    if (quantidade) quantidade.readOnly = Boolean(readonly);
    if (abertura) abertura.readOnly = Boolean(readonly);
    if (prazo) prazo.readOnly = Boolean(readonly);
    ["recrutadora", "solicitante", "localidade", "substituicao_de"].forEach((name) => {
      const input = el.formVagaManual.elements[name];
      if (input) input.readOnly = Boolean(readonly);
    });
    ["motivo_abertura", "observacao"].forEach((name) => {
      const input = el.formVagaManual.elements[name];
      if (input) input.readOnly = Boolean(readonly);
    });
    if (el.formVagaEquipe) {
      el.formVagaEquipe.disabled = Boolean(readonly);
      syncCustomSelect(el.formVagaEquipe);
    }
    if (el.formVagaCargo) {
      el.formVagaCargo.disabled = Boolean(readonly);
      syncCustomSelect(el.formVagaCargo);
    }
    ["tipo_solicitacao", "prioridade", "modalidade"].forEach((name) => {
      const select = el.formVagaManual.elements[name];
      if (select) {
        select.disabled = Boolean(readonly);
        syncCustomSelect(select);
      }
    });
    if (el.formVagaStatus) {
      el.formVagaStatus.disabled = Boolean(readonly || isNew || ["PENDENTE_APROVACAO_REGIONAL", "PENDENTE_APROVACAO"].includes(statusKey) || statusKey === "REPROVADA");
      syncCustomSelect(el.formVagaStatus);
    }
    if (andamento) {
      andamento.readOnly = mode === "ver";
      const andamentoLabel = andamento.closest("label");
      if (andamentoLabel) andamentoLabel.hidden = mode === "ver";
    }
    if (el.btnSalvarVaga) {
      el.btnSalvarVaga.hidden = mode === "ver";
      el.btnSalvarVaga.disabled = mode === "ver";
    }
    updateVagaDateRequirement();
    syncDatePicker(abertura);
    syncDatePicker(fechamento);
    syncDatePicker(prazo);
  }

  function renderVagaAndamentoPanel(mode, vaga) {
    if (!el.vagaAndamentoPanel || !el.formVagaManual) return;
    const showPanel = mode !== "nova";
    el.vagaAndamentoPanel.hidden = !showPanel;
    const andamentoField = el.formVagaManual.elements.andamento;
    if (andamentoField) andamentoField.value = "";
    if (!showPanel || !vaga) {
      if (el.vagaAndamentoResumo) el.vagaAndamentoResumo.innerHTML = "";
      if (el.vagaAndamentoTimeline) el.vagaAndamentoTimeline.innerHTML = "";
      if (el.vagaAndamentoTotal) el.vagaAndamentoTotal.textContent = "Sem Atualizacoes Registradas";
      return;
    }
    const resumo = vagaProgressSummary(vaga);
    if (el.vagaAndamentoResumo) {
      el.vagaAndamentoResumo.innerHTML = resumo.map((item) => `
        <div>
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `).join("");
    }
    const andamentos = vagaAndamentos(vaga);
    if (el.vagaAndamentoTotal) {
      el.vagaAndamentoTotal.textContent = andamentos.length
        ? `${formatNumber(andamentos.length)} atualização${andamentos.length === 1 ? "" : "es"} registradas`
        : "Sem Atualizacoes Registradas";
    }
    if (!el.vagaAndamentoTimeline) return;
    if (!andamentos.length) {
      el.vagaAndamentoTimeline.innerHTML = `<div class="tl-gc-vaga-timeline__empty">Ainda não há atualizações de andamento para esta vaga.</div>`;
      return;
    }
    el.vagaAndamentoTimeline.innerHTML = andamentos.map((item) => {
      const statusInfo = VAGA_STATUS[normalizeVagaStatus(item.status_vaga)] || VAGA_STATUS.EM_ANDAMENTO;
      const autor = normalizeText(item.usuario_nome || item.criado_por_nome) || "Sistema";
      const email = normalizeText(item.usuario_email);
      return `
        <article class="tl-gc-vaga-timeline__item">
          <i aria-hidden="true"></i>
          <div>
            <header>
              <strong>${escapeHtml(autor)}</strong>
              <time>${escapeHtml(formatDateTimePt(item.data_hora_criacao))}</time>
            </header>
            ${email ? `<small>${escapeHtml(email)}</small>` : ""}
            <p>${escapeHtml(titleCaseDisplay(item.descricao || ""))}</p>
            <em class="${escapeHtml(statusInfo.className)}">${escapeHtml(titleCaseDisplay(statusInfo.label))}</em>
          </div>
        </article>
      `;
    }).join("");
  }

  function openVagaModal(mode = "nova", vaga = null) {
    if (!el.modalVagaManual || !el.formVagaManual) return;
    el.formVagaManual.reset();
    el.formVagaManual.dataset.mode = mode;
    el.formVagaManual.elements.identificador_vaga.value = vaga?.identificador_vaga || "";
    el.formVagaManual.elements.protocolo.value = vaga?.protocolo || "";
    if (el.formVagaEquipe) {
      el.formVagaEquipe.value = vaga?.equipe || "";
      syncCustomSelect(el.formVagaEquipe);
    }
    if (el.formVagaStatus) {
      el.formVagaStatus.value = mode === "nova" ? "PENDENTE_APROVACAO_REGIONAL" : (mode === "fechar" ? "FECHADA" : vagaStatusKey(vaga));
      syncCustomSelect(el.formVagaStatus);
    }
    el.formVagaManual.elements.data_abertura.value = String(vaga?.data_abertura || todayIsoDate()).slice(0, 10);
    el.formVagaManual.elements.data_fechamento.value = mode === "fechar"
      ? todayIsoDate()
      : String(vaga?.data_fechamento || "").slice(0, 10);
    if (el.formVagaManual.elements.prazo_desejado) {
      el.formVagaManual.elements.prazo_desejado.value = String(vaga?.prazo_desejado || "").slice(0, 10);
    }
    if (el.formVagaCargo) {
      el.formVagaCargo.value = mode === "nova"
        ? "Corretor"
        : normalizeVagaCargoOption(vaga?.cargo, "");
      syncCustomSelect(el.formVagaCargo);
    }
    if (el.formVagaManual.elements.quantidade_vagas) el.formVagaManual.elements.quantidade_vagas.value = String(vagaQuantidade(vaga));
    if (el.formVagaManual.elements.tipo_solicitacao) el.formVagaManual.elements.tipo_solicitacao.value = vaga?.tipo_solicitacao || "Reposicao";
    if (el.formVagaManual.elements.prioridade) {
      el.formVagaManual.elements.prioridade.value = normalizePrioridadeVagaNivel(vaga?.prioridade) || "3";
    }
    if (el.formVagaManual.elements.modalidade) el.formVagaManual.elements.modalidade.value = vaga?.modalidade || "";
    if (el.formVagaManual.elements.recrutadora) el.formVagaManual.elements.recrutadora.value = vaga?.recrutadora || "";
    if (el.formVagaManual.elements.solicitante) el.formVagaManual.elements.solicitante.value = vaga?.solicitante || "";
    if (el.formVagaManual.elements.localidade) el.formVagaManual.elements.localidade.value = vaga?.localidade || "";
    if (el.formVagaManual.elements.substituicao_de) el.formVagaManual.elements.substituicao_de.value = vaga?.substituicao_de || "";
    if (el.formVagaManual.elements.motivo_abertura) el.formVagaManual.elements.motivo_abertura.value = vaga?.motivo_abertura || "";
    el.formVagaManual.elements.observacao.value = vaga?.observacao || "";
    renderVagaAndamentoPanel(mode, vaga);
    setVagaFormMode(mode);
    enhanceDatePickers(el.formVagaManual);
    syncDatePicker(el.formVagaManual.elements.data_abertura);
    syncDatePicker(el.formVagaManual.elements.data_fechamento);
    syncDatePicker(el.formVagaManual.elements.prazo_desejado);
    el.formVagaManual.querySelectorAll("select").forEach(syncCustomSelect);
    if (el.tituloModalVaga) {
      el.tituloModalVaga.textContent = mode === "ver"
        ? "Ver Vaga"
        : (mode === "fechar" ? "Fechar Vaga" : (mode === "editar" ? "Editar Vaga" : "Nova Solicitação"));
    }
    if (el.btnSalvarVaga) el.btnSalvarVaga.textContent = mode === "fechar" ? "Fechar Vaga" : (mode === "editar" ? "Salvar Alterações" : "Enviar Solicitação");
    el.modalVagaManual.hidden = false;
    el.modalVagaManual.querySelector(".tl-gc-modal__dialog")?.scrollTo?.({ top: 0 });
    document.body.classList.add("tl-gc-modal-open");
    setTimeout(() => {
      const target = mode === "ver" ? el.modalVagaManual.querySelector("[data-close-vaga-modal]") : (mode === "fechar" ? el.formVagaManual.elements.data_fechamento : el.formVagaEquipe);
      target?.focus?.({ preventScroll: true });
    }, 30);
  }

  function closeVagaModal() {
    if (!el.modalVagaManual || !el.formVagaManual) return;
    closeDatePicker();
    el.modalVagaManual.hidden = true;
    document.body.classList.remove("tl-gc-modal-open");
    setVagaFormMode("nova");
    el.formVagaManual.dataset.mode = "";
  }

  function validateVagaDates() {
    if (!el.formVagaManual) return true;
    const requiredDates = [el.formVagaManual.elements.data_abertura, el.formVagaManual.elements.data_fechamento]
      .filter((input) => input && input.dataset.gcDateRequired === "true");
    const invalid = requiredDates.find((input) => !String(input.value || "").slice(0, 10));
    requiredDates.forEach((input) => {
      input.dataset.gcDateTouched = "true";
      syncDatePicker(input);
    });
    if (!invalid) return true;
    const control = datePickers.get(invalid);
    control?.button.focus({ preventScroll: true });
    setFeedback("error", "Informe as datas obrigatorias da vaga.");
    return false;
  }

  function vagaPayloadFromForm() {
    const form = el.formVagaManual;
    const mode = form.dataset.mode || "nova";
    const payload = {
      protocolo: normalizeText(form.elements.protocolo.value),
      equipe: normalizeText(el.formVagaEquipe?.value || form.elements.equipe.value),
      data_abertura: form.elements.data_abertura.value,
      data_fechamento: form.elements.data_fechamento.value || null,
      prazo_desejado: form.elements.prazo_desejado?.value || null,
      status_vaga: mode === "nova" ? "PENDENTE_APROVACAO_REGIONAL" : normalizeVagaStatus(el.formVagaStatus?.value || form.elements.status_vaga?.value || "EM_ANDAMENTO"),
      cargo: normalizeText(form.elements.cargo?.value) || null,
      quantidade_vagas: vagaQuantidade({ quantidade_vagas: form.elements.quantidade_vagas?.value }),
      tipo_solicitacao: normalizeText(form.elements.tipo_solicitacao?.value) || null,
      prioridade: normalizeText(form.elements.prioridade?.value) || null,
      recrutadora: normalizeText(form.elements.recrutadora?.value) || null,
      solicitante: normalizeText(form.elements.solicitante?.value) || null,
      localidade: normalizeText(form.elements.localidade?.value) || null,
      modalidade: normalizeText(form.elements.modalidade?.value) || null,
      substituicao_de: normalizeText(form.elements.substituicao_de?.value) || null,
      motivo_abertura: normalizeText(form.elements.motivo_abertura?.value) || null,
      observacao: normalizeText(form.elements.observacao.value) || null,
    };
    const andamento = normalizeText(form.elements.andamento?.value);
    if (andamento) payload.andamento = andamento;
    return payload;
  }

  async function submitVagaManual(event) {
    event.preventDefault();
    if (!el.formVagaManual) return;
    const mode = el.formVagaManual.dataset.mode || "nova";
    if (mode === "ver") return;
    if (!validateVagaDates()) return;
    const id = normalizeText(el.formVagaManual.elements.identificador_vaga.value);
    const previousText = el.btnSalvarVaga?.textContent || "Salvar";
    if (el.btnSalvarVaga) {
      el.btnSalvarVaga.disabled = true;
      el.btnSalvarVaga.textContent = "Salvando...";
    }
    try {
      if (mode === "fechar") {
        await api(`${ENDPOINTS.vagasGc}/${encodeURIComponent(id)}/fechar`, {
          method: "POST",
          body: {
            data_fechamento: el.formVagaManual.elements.data_fechamento.value || todayIsoDate(),
            andamento: normalizeText(el.formVagaManual.elements.andamento?.value) || null,
          },
        });
        setFeedback("success", "Vaga fechada com sucesso.");
      } else {
        await api(mode === "editar" ? `${ENDPOINTS.vagasGc}/${encodeURIComponent(id)}` : ENDPOINTS.vagasGc, {
          method: mode === "editar" ? "PUT" : "POST",
          body: vagaPayloadFromForm(),
        });
        setFeedback("success", mode === "editar" ? "Vaga atualizada com sucesso." : "Solicitação enviada para aprovação.");
      }
      closeVagaModal();
      await loadVagasManuais();
      renderAll();
    } catch (error) {
      setFeedback("error", error?.message || "Não foi possível salvar a vaga.");
    } finally {
      if (el.btnSalvarVaga) {
        el.btnSalvarVaga.disabled = false;
        el.btnSalvarVaga.textContent = previousText;
      }
    }
  }

  function vagaManualById(id) {
    const key = String(id || "");
    return (state.vagasManuais || []).find((item) => String(item.identificador_vaga || "") === key);
  }

  function prioridadeVagaRowsFromModal() {
    if (!el.prioridadeVagaRows) return [];
    return [...el.prioridadeVagaRows.querySelectorAll("[data-priority-row]")].map((row) => {
      const nivel = normalizePrioridadeVagaNivel(row.querySelector("[data-priority-level]")?.value);
      const quantidadeRaw = toNumber(row.querySelector("[data-priority-quantity]")?.value || 0);
      const quantidade = Number.isFinite(quantidadeRaw) ? Math.trunc(quantidadeRaw) : 0;
      return nivel && quantidade > 0 ? { nivel, quantidade } : null;
    }).filter(Boolean);
  }

  function setPrioridadeVagaRows(rows = []) {
    if (!el.prioridadeVagaRows) return;
    el.prioridadeVagaRows.innerHTML = rows.length ? rows.map((row, index) => {
      const nivelAtual = normalizePrioridadeVagaNivel(row.nivel) || "3";
      return `
        <div class="tl-gc-priority-row" data-priority-row>
          <label>Nível
            <select data-priority-level aria-label="Nível De Prioridade">
              ${VAGA_PRIORIDADE_NIVEIS.map((option) => `
                <option value="${escapeHtml(option.label)}" ${option.label === nivelAtual ? "selected" : ""}>${escapeHtml(option.label)}</option>
              `).join("")}
            </select>
          </label>
          <label>Quantidade
            <input data-priority-quantity type="number" min="1" max="${escapeHtml(vagaQuantidade(prioridadeVagaAtual))}" step="1" value="${escapeHtml(row.quantidade || 1)}" />
          </label>
          <button class="tl-gc-priority-remove" type="button" data-remove-priority-row="${index}">Remover</button>
        </div>
      `;
    }).join("") : `<div class="tl-gc-priority-empty">Nenhum nível definido. As vagas ficam sem prioridade manual.</div>`;
    updatePrioridadeVagaResumo();
  }

  function updatePrioridadeVagaResumo() {
    if (!prioridadeVagaAtual) return;
    const total = vagaQuantidade(prioridadeVagaAtual);
    const rows = prioridadeVagaRowsFromModal();
    const alocado = rows.reduce((sum, row) => sum + row.quantidade, 0);
    const restante = Math.max(0, total - alocado);
    const excedente = alocado > total;
    if (el.prioridadeVagaResumo) {
      el.prioridadeVagaResumo.innerHTML = `
        <div><span>Total De Vagas</span><strong>${formatNumber(total)}</strong></div>
        <div><span>Com Prioridade Manual</span><strong>${formatNumber(Math.min(alocado, total))}</strong></div>
        <div><span>Sem Nível</span><strong>${formatNumber(restante)}</strong></div>
      `;
    }
    if (el.prioridadeVagaFeedback) {
      el.prioridadeVagaFeedback.textContent = excedente
        ? `A soma dos níveis está em ${formatNumber(alocado)} e não pode passar de ${formatNumber(total)}.`
        : (restante ? `${formatNumber(restante)} vaga${restante === 1 ? "" : "s"} ficará${restante === 1 ? "" : "ão"} sem prioridade manual.` : "Todas as vagas foram distribuídas em níveis.");
      el.prioridadeVagaFeedback.classList.toggle("is-error", excedente);
    }
    if (el.btnSalvarPrioridadeVaga) el.btnSalvarPrioridadeVaga.disabled = excedente;
    if (el.btnAdicionarPrioridadeVaga) {
      el.btnAdicionarPrioridadeVaga.disabled = alocado >= total || rows.length >= total;
    }
  }

  function addPrioridadeVagaRow() {
    if (!prioridadeVagaAtual) return;
    const total = vagaQuantidade(prioridadeVagaAtual);
    const rows = prioridadeVagaRowsFromModal();
    const alocado = rows.reduce((sum, row) => sum + row.quantidade, 0);
    if (alocado >= total) {
      updatePrioridadeVagaResumo();
      return;
    }
    const usados = new Set(rows.map((row) => row.nivel));
    const proximoNivel = !usados.size
      ? "-1"
      : (!usados.has("3")
        ? "3"
        : VAGA_PRIORIDADE_NIVEIS.find((option) => !usados.has(option.label))?.label || "3");
    const quantidadeRestante = Math.max(1, total - alocado);
    rows.push({ nivel: proximoNivel, quantidade: proximoNivel === "3" ? quantidadeRestante : 1 });
    setPrioridadeVagaRows(rows);
  }

  function openPrioridadeVagaModal(vaga) {
    if (!vaga || !el.modalPrioridadeVaga || !el.formPrioridadeVaga) return;
    closeVagaModal();
    prioridadeVagaAtual = vaga;
    el.formPrioridadeVaga.reset();
    el.formPrioridadeVaga.elements.identificador_vaga.value = vaga.identificador_vaga || "";
    const quantidade = vagaQuantidade(vaga);
    if (el.tituloModalPrioridadeVaga) el.tituloModalPrioridadeVaga.textContent = "Definir Prioridade";
    if (el.subtituloModalPrioridadeVaga) {
      el.subtituloModalPrioridadeVaga.textContent = `${vaga.protocolo || "Sem protocolo"} - ${vaga.equipe || "-"} - ${vagaCargo(vaga)} - ${formatNumber(quantidade)} vaga${quantidade === 1 ? "" : "s"}.`;
    }
    const rows = vagaPrioridadeNiveis(vaga);
    setPrioridadeVagaRows(rows.length ? rows : [{ nivel: "-1", quantidade: Math.min(1, quantidade) }]);
    el.modalPrioridadeVaga.hidden = false;
    document.body.classList.add("tl-gc-modal-open");
    setTimeout(() => {
      el.prioridadeVagaRows?.querySelector("select, input")?.focus?.({ preventScroll: true });
    }, 30);
  }

  function closePrioridadeVagaModal() {
    if (!el.modalPrioridadeVaga || !el.formPrioridadeVaga) return;
    el.modalPrioridadeVaga.hidden = true;
    document.body.classList.remove("tl-gc-modal-open");
    prioridadeVagaAtual = null;
    el.formPrioridadeVaga.reset();
    if (el.prioridadeVagaRows) el.prioridadeVagaRows.innerHTML = "";
  }

  async function submitPrioridadeVaga(event) {
    event.preventDefault();
    if (!el.formPrioridadeVaga || !prioridadeVagaAtual) return;
    const id = normalizeText(el.formPrioridadeVaga.elements.identificador_vaga.value);
    const total = vagaQuantidade(prioridadeVagaAtual);
    const niveis = prioridadeVagaRowsFromModal();
    const alocado = niveis.reduce((sum, row) => sum + row.quantidade, 0);
    if (alocado > total) {
      updatePrioridadeVagaResumo();
      setFeedback("error", "A soma dos níveis não pode passar da quantidade de vagas.");
      return;
    }
    const previousText = el.btnSalvarPrioridadeVaga?.textContent || "Salvar Prioridade";
    if (el.btnSalvarPrioridadeVaga) {
      el.btnSalvarPrioridadeVaga.disabled = true;
      el.btnSalvarPrioridadeVaga.textContent = "Salvando...";
    }
    try {
      await api(`${ENDPOINTS.vagasGc}/${encodeURIComponent(id)}/prioridade`, {
        method: "PATCH",
        body: { niveis },
      });
      setFeedback("success", "Prioridade da vaga atualizada com sucesso.");
      closePrioridadeVagaModal();
      await loadVagasManuais();
      renderAll();
    } catch (error) {
      setFeedback("error", error?.message || "Não foi possível salvar a prioridade da vaga.");
    } finally {
      if (el.btnSalvarPrioridadeVaga) {
        el.btnSalvarPrioridadeVaga.disabled = false;
        el.btnSalvarPrioridadeVaga.textContent = previousText;
      }
    }
  }

  function openExcluirVagaModal(vaga) {
    if (!vaga || !el.modalExcluirVagaManual || !el.formExcluirVagaManual) return;
    closeVagaModal();
    el.formExcluirVagaManual.reset();
    el.formExcluirVagaManual.elements.identificador_vaga.value = vaga.identificador_vaga || "";
    if (el.subtituloModalExcluirVaga) {
      const protocolo = normalizeText(vaga.protocolo) || "sem protocolo";
      const equipe = normalizeText(vaga.equipe) || "sem equipe";
      el.subtituloModalExcluirVaga.textContent = `Confirme a senha do administrador para excluir definitivamente a vaga ${protocolo} - ${equipe}.`;
    }
    el.modalExcluirVagaManual.hidden = false;
    document.body.classList.add("tl-gc-modal-open");
    setTimeout(() => {
      el.formExcluirVagaManual.elements.senha_administrador?.focus?.({ preventScroll: true });
    }, 30);
  }

  function closeExcluirVagaModal() {
    if (!el.modalExcluirVagaManual || !el.formExcluirVagaManual) return;
    el.modalExcluirVagaManual.hidden = true;
    document.body.classList.remove("tl-gc-modal-open");
    el.formExcluirVagaManual.reset();
  }

  async function submitExcluirVagaManual(event) {
    event.preventDefault();
    if (!el.formExcluirVagaManual) return;
    const id = normalizeText(el.formExcluirVagaManual.elements.identificador_vaga.value);
    const senha = el.formExcluirVagaManual.elements.senha_administrador.value;
    if (!id || !senha) {
      setFeedback("error", "Informe a senha do administrador para excluir a vaga.");
      return;
    }
    const previousText = el.btnExcluirVaga?.textContent || "Excluir definitivamente";
    if (el.btnExcluirVaga) {
      el.btnExcluirVaga.disabled = true;
      el.btnExcluirVaga.textContent = "Excluindo...";
    }
    try {
      await api(`${ENDPOINTS.vagasGc}/${encodeURIComponent(id)}`, {
        method: "DELETE",
        body: { senha_administrador: senha },
      });
      setFeedback("success", "Vaga excluida com sucesso.");
      closeExcluirVagaModal();
      await loadVagasManuais();
      renderAll();
    } catch (error) {
      setFeedback("error", error?.message || "Não foi possível excluir a vaga.");
    } finally {
      if (el.btnExcluirVaga) {
        el.btnExcluirVaga.disabled = false;
        el.btnExcluirVaga.textContent = previousText;
      }
    }
  }

  function openAprovacaoVagaModal(vaga, aprovado = true) {
    if (!vaga || !el.modalAprovacaoVaga || !el.formAprovacaoVaga) return;
    closeVagaModal();
    el.formAprovacaoVaga.reset();
    el.formAprovacaoVaga.elements.identificador_vaga.value = vaga.identificador_vaga || "";
    el.formAprovacaoVaga.elements.aprovado.value = aprovado ? "true" : "false";
    const etapa = vagaApprovalStageInfo(vaga);
    if (el.subtituloModalAprovacaoVaga) {
      const quantidade = vagaQuantidade(vaga);
      el.subtituloModalAprovacaoVaga.textContent = `${vaga.protocolo || "Sem protocolo"} - ${vaga.equipe || "-"} - ${vagaCargo(vaga)} - ${formatNumber(quantidade)} vaga${quantidade === 1 ? "" : "s"} aguardando ${etapa.aguardando}.`;
    }
    if (el.btnAprovarVaga) {
      el.btnAprovarVaga.textContent = vagaStatusKey(vaga) === "PENDENTE_APROVACAO_REGIONAL"
        ? "Aprovar E Enviar"
        : "Aprovar E Iniciar";
    }
    if (el.btnAprovarVaga) el.btnAprovarVaga.disabled = !canApproveVaga(vaga);
    if (el.btnReprovarVaga) el.btnReprovarVaga.disabled = !canApproveVaga(vaga);
    el.modalAprovacaoVaga.hidden = false;
    document.body.classList.add("tl-gc-modal-open");
    setTimeout(() => {
      el.formAprovacaoVaga.elements.observacao?.focus?.({ preventScroll: true });
    }, 30);
  }

  function closeAprovacaoVagaModal() {
    if (!el.modalAprovacaoVaga || !el.formAprovacaoVaga) return;
    el.modalAprovacaoVaga.hidden = true;
    document.body.classList.remove("tl-gc-modal-open");
    el.formAprovacaoVaga.reset();
  }

  async function submitAprovacaoVaga(event) {
    event.preventDefault();
    if (!el.formAprovacaoVaga) return;
    const clicked = event.submitter;
    const approvedValue = clicked?.dataset?.vagaAprovacao ?? el.formAprovacaoVaga.elements.aprovado.value;
    const aprovado = String(approvedValue) !== "false";
    el.formAprovacaoVaga.elements.aprovado.value = aprovado ? "true" : "false";
    const id = normalizeText(el.formAprovacaoVaga.elements.identificador_vaga.value);
    if (!id) {
      setFeedback("error", "Solicitação não identificada.");
      return;
    }
    const button = aprovado ? el.btnAprovarVaga : el.btnReprovarVaga;
    const vagaAtual = vagaManualById(id);
    const etapa = vagaApprovalStageInfo(vagaAtual);
    const previousText = button?.textContent || (aprovado ? "Aprovar" : "Reprovar");
    if (button) {
      button.disabled = true;
      button.textContent = aprovado ? "Aprovando..." : "Reprovando...";
    }
    try {
      await api(`${ENDPOINTS.vagasGc}/${encodeURIComponent(id)}/aprovar`, {
        method: "POST",
        body: {
          aprovado,
          observacao: normalizeText(el.formAprovacaoVaga.elements.observacao?.value) || null,
        },
      });
      setFeedback("success", aprovado ? etapa.approved : etapa.rejected);
      closeAprovacaoVagaModal();
      await loadVagasManuais();
      renderAll();
    } catch (error) {
      setFeedback("error", error?.message || "Não foi possível registrar a decisão.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = previousText;
      }
    }
  }

  function handleVagaManualAction(event) {
    const viewButton = event.target.closest("[data-view-vaga-id]");
    if (viewButton) {
      const vaga = vagaManualById(viewButton.dataset.viewVagaId);
      if (vaga) openVagaModal("ver", vaga);
      return;
    }
    const editButton = event.target.closest("[data-edit-vaga-id]");
    if (editButton) {
      const vaga = vagaManualById(editButton.dataset.editVagaId);
      if (vaga) openVagaModal("editar", vaga);
      return;
    }
    const closeButton = event.target.closest("[data-close-vaga-id]");
    if (closeButton) {
      const vaga = vagaManualById(closeButton.dataset.closeVagaId);
      if (vaga) openVagaModal("fechar", vaga);
      return;
    }
    const approveButton = event.target.closest("[data-approve-vaga-id]");
    if (approveButton) {
      const vaga = vagaManualById(approveButton.dataset.approveVagaId);
      if (vaga) openAprovacaoVagaModal(vaga, true);
      return;
    }
    const priorityButton = event.target.closest("[data-priority-vaga-id]");
    if (priorityButton) {
      const vaga = vagaManualById(priorityButton.dataset.priorityVagaId);
      if (vaga) openPrioridadeVagaModal(vaga);
      return;
    }
    const rejectButton = event.target.closest("[data-reject-vaga-id]");
    if (rejectButton) {
      const vaga = vagaManualById(rejectButton.dataset.rejectVagaId);
      if (vaga) openAprovacaoVagaModal(vaga, false);
      return;
    }
    const deleteButton = event.target.closest("[data-delete-vaga-id]");
    if (!deleteButton) return;
    const vaga = vagaManualById(deleteButton.dataset.deleteVagaId);
    if (vaga) openExcluirVagaModal(vaga);
  }

  function renderHistoricoVisuals(items) {
    const sorted = [...(items || [])].sort((a, b) => new Date(b.data_hora_evento || 0) - new Date(a.data_hora_evento || 0));
    const latest = sorted[0] || null;
    const managersChanged = new Set(sorted.map((item) => slugKey(item.chave_gestor || item.gestor)).filter(Boolean));
    const usersChanged = new Set(sorted.map((item) => normalizeText(item.usuario_nome) || "Sistema").filter(Boolean));
    const manualGroups = (state.tableGroups || []).filter((group) => group.forecastManual);
    const manualForecast = manualGroups.reduce((sum, group) => sum + group.meta, 0);
    const systemForecast = (state.tableGroups || []).filter((group) => !group.forecastManual).reduce((sum, group) => sum + group.meta, 0);
    const impact = sorted.reduce((sum, item) => {
      if (item.forecast_anterior === null || item.forecast_anterior === undefined) return sum;
      return sum + (toNumber(item.forecast_novo) - toNumber(item.forecast_anterior));
    }, 0);
    const lastWhen = latest ? formatDateTimePt(latest.data_hora_evento) : "-";

    renderViewMetrics(el.metricasHistoricoGc, [
      { label: "Ajustes No Mês", value: formatNumber(sorted.length), detail: periodLabel() },
      { label: "Gestores Alterados", value: formatNumber(managersChanged.size), detail: "Forecast Manual" },
      { label: "Forecast Manual", value: formatNumber(manualForecast), detail: `${formatNumber(manualGroups.length)} gestor${manualGroups.length === 1 ? "" : "es"}` },
      { label: "Última Alteração", value: latest ? lastWhen.slice(0, 10) : "-", detail: latest ? lastWhen.slice(12) || "Horário registrado" : "Sem registro" },
    ]);

    renderInsightCards(el.insightsHistoricoGc, [
      {
        tone: latest ? "blue" : "neutral",
        label: "Última Movimentação",
        badge: latest ? forecastHistoricoActionLabel(latest.acao) : "Sem Evento",
        value: latest ? latest.gestor || "Gestor não informado" : "Sem alteração no período",
        detail: latest
          ? `${formatDateTimePt(latest.data_hora_evento)} | ${normalizeText(latest.usuario_nome) || "Sistema"}`
          : "Ainda não há trilha de auditoria para o período selecionado.",
        metrics: latest ? [
          { label: "Antes", value: latest.forecast_anterior === null || latest.forecast_anterior === undefined ? "-" : formatNumber(latest.forecast_anterior) },
          { label: "Depois", value: formatNumber(latest.forecast_novo) },
          { label: "Impacto", value: latest.forecast_anterior === null || latest.forecast_anterior === undefined ? "-" : formatSigned(toNumber(latest.forecast_novo) - toNumber(latest.forecast_anterior)), tone: toNumber(latest.forecast_novo) - toNumber(latest.forecast_anterior) < 0 ? "bad" : "good" },
        ] : [],
      },
      {
        tone: manualGroups.length ? "green" : "neutral",
        label: "Forecast Vigente",
        badge: `${formatNumber(manualGroups.length)} manual`,
        value: `${formatNumber(manualForecast)} manual`,
        detail: `${formatNumber(systemForecast)} permanece calculado pelo sistema neste período.`,
        progress: {
          label: "Participação manual",
          value: manualForecast,
          total: Math.max(1, manualForecast + systemForecast),
          valueLabel: formatPercent((manualForecast + systemForecast) ? manualForecast / (manualForecast + systemForecast) * 100 : 0),
        },
        items: manualGroups.slice(0, 4).map((group) => ({
          title: group.gestorLabel,
          detail: group.equipeDetalhe || group.equipe,
          value: formatNumber(group.meta),
          tone: "good",
        })),
      },
      {
        tone: impact < 0 ? "danger" : "purple",
        label: "Impacto Dos Ajustes",
        badge: impact === 0 ? "Neutro" : (impact > 0 ? "Aumento" : "Redução"),
        value: formatSigned(impact),
        detail: "Soma Líquida Entre Valor Anterior E Novo Nos Eventos Do Período.",
        items: sorted.slice(0, 4).map((item) => {
          const before = item.forecast_anterior === null || item.forecast_anterior === undefined ? null : toNumber(item.forecast_anterior);
          const after = toNumber(item.forecast_novo);
          const delta = before === null ? 0 : after - before;
          return {
            title: item.gestor || "-",
            detail: item.equipe_resumo || (item.equipes || []).join(", ") || "-",
            value: before === null ? formatNumber(after) : formatSigned(delta),
            tone: delta < 0 ? "bad" : "good",
          };
        }),
      },
      {
        tone: "blue",
        label: "Auditoria",
        badge: `${formatNumber(usersChanged.size)} usuário${usersChanged.size === 1 ? "" : "s"}`,
        value: usersChanged.has("Sistema") ? "Sistema e usuários" : "Usuários registrados",
        detail: "Todo ajuste manual preserva data, hora, autor, antes, depois e observação.",
        metrics: [
          { label: "Eventos", value: formatNumber(sorted.length) },
          { label: "Gestores", value: formatNumber(managersChanged.size) },
          { label: "Período", value: periodLabel() },
        ],
      },
    ]);
  }

  function forecastHistoricoActionLabel(value) {
    const key = normalizeKey(value);
    if (!key) return "-";
    if (key.includes("alter")) return "Alteração";
    if (key.includes("cri")) return "Criação";
    if (key.includes("exclu")) return "Exclusão";
    if (key.includes("remov")) return "Remoção";
    return titleCaseDisplay(value);
  }

  function renderForecastHistorico() {
    if (!el.tabelaForecastHistorico) return;
    const items = state.forecastHistorico || [];
    renderHistoricoVisuals(items);
    if (!items.length) {
      el.tabelaForecastHistorico.innerHTML = `<tr><td colspan="8"><div class="tl-gc-empty">Nenhum ajuste manual de forecast neste período.</div></td></tr>`;
      if (el.totalForecastHistorico) el.totalForecastHistorico.textContent = `Histórico De ${periodLabel()}: 0 Registros`;
      applyTitleCaseStaticContent();
      return;
    }
    el.tabelaForecastHistorico.innerHTML = items.map((item) => {
      const anterior = item.forecast_anterior === null || item.forecast_anterior === undefined ? "-" : formatNumber(item.forecast_anterior);
      const novo = formatNumber(item.forecast_novo);
      const usuario = normalizeText(item.usuario_nome) || "Sistema";
      const usuarioEmail = normalizeText(item.usuario_email);
      const usuarioMeta = usuarioEmail || (normalizeKey(usuario) === "sistema" ? "Automático" : "");
      return `
        <tr>
          <td>${escapeHtml(formatDateTimePt(item.data_hora_evento))}</td>
          <td>${escapeHtml(titleCaseDisplay(usuario))}<small>${escapeHtml(usuarioEmail || titleCaseDisplay(usuarioMeta))}</small></td>
          <td>${escapeHtml(forecastHistoricoActionLabel(item.acao))}</td>
          <td>${escapeHtml(titleCaseDisplay(item.gestor || "-"))}</td>
          <td>${escapeHtml(titleCaseDisplay(item.equipe_resumo || (item.equipes || []).join(", ") || "-"))}</td>
          <td>${escapeHtml(anterior)}</td>
          <td>${escapeHtml(novo)}</td>
          <td>${escapeHtml(titleCaseDisplay(item.observacao || "-"))}</td>
        </tr>
      `;
    }).join("");
    if (el.totalForecastHistorico) {
      el.totalForecastHistorico.textContent = `Histórico De ${periodLabel()}: ${formatNumber(items.length)} Registro${items.length === 1 ? "" : "s"}`;
    }
    applyTitleCaseStaticContent();
  }

  function openForecastModal(groupKey) {
    const group = state.tableGroups.find((item) => item.key === groupKey);
    if (!group || !el.modalForecastManual || !el.formForecastManual) return;
    if (!canEditForecastGroup(group)) {
      setFeedback("error", "Somente gerente regional, head/diretor comercial ou administrador pode ajustar forecast.");
      return;
    }
    const period = currentPeriodKey();
    el.formForecastManual.reset();
    const equipeResumo = group.equipeDetalhe && group.equipeDetalhe !== "-"
      ? group.equipeDetalhe
      : (group.equipe && group.equipe !== "-" ? group.equipe : "Sem equipe");
    el.formForecastManual.elements.chave_gestor.value = group.key;
    el.formForecastManual.elements.gestor.value = group.gestorLabel;
    el.formForecastManual.elements.equipe_resumo.value = equipeResumo;
    el.formForecastManual.elements.equipes.value = JSON.stringify([...(group.equipes || [])]);
    el.formForecastManual.elements.mes_referencia.value = String(period.mes);
    el.formForecastManual.elements.ano_referencia.value = String(period.ano);
    el.formForecastManual.elements.forecast_padrao.value = String(group.forecastPadraoBase ?? group.forecastPadrao ?? group.metaBase ?? group.meta ?? 0);
    el.formForecastManual.elements.forecast.value = String(group.metaBase ?? group.meta ?? 0);
    el.formForecastManual.elements.observacao.value = group.forecastManual?.observacao || "";
    if (el.tituloModalForecast) el.tituloModalForecast.textContent = "Editar Forecast";
    if (el.subtituloModalForecast) {
      const origem = group.forecastManual ? "Ajuste manual vigente" : "Valor padrão do sistema";
      const lideranca = group.vagasLideranca ? ` • ${formatNumber(group.vagasLideranca)} gerente(s) de vendas em aberto fora do forecast de corretores` : "";
      el.subtituloModalForecast.textContent = `${group.gestorLabel} • ${equipeResumo} • ${periodLabel(period)} • ${origem}${lideranca}`;
    }
    el.modalForecastManual.hidden = false;
    document.body.classList.add("tl-gc-modal-open");
  }

  function closeForecastModal() {
    if (!el.modalForecastManual || !el.formForecastManual) return;
    el.modalForecastManual.hidden = true;
    document.body.classList.remove("tl-gc-modal-open");
    el.formForecastManual.reset();
  }

  function forecastPayloadFromForm() {
    const form = el.formForecastManual;
    let equipes = [];
    try {
      equipes = JSON.parse(form.elements.equipes.value || "[]");
    } catch {
      equipes = [];
    }
    return {
      mes_referencia: Number(form.elements.mes_referencia.value),
      ano_referencia: Number(form.elements.ano_referencia.value),
      chave_gestor: normalizeText(form.elements.chave_gestor.value),
      gestor: normalizeText(form.elements.gestor.value),
      equipes,
      equipe_resumo: normalizeText(form.elements.equipe_resumo.value),
      forecast: Number(form.elements.forecast.value),
      forecast_padrao: Number(form.elements.forecast_padrao.value || 0),
      observacao: normalizeText(form.elements.observacao.value) || null,
    };
  }

  async function submitForecastManual(event) {
    event.preventDefault();
    if (!el.formForecastManual) return;
    const previousText = el.btnSalvarForecast?.textContent || "Salvar Forecast";
    if (el.btnSalvarForecast) {
      el.btnSalvarForecast.disabled = true;
      el.btnSalvarForecast.textContent = "Salvando...";
    }
    try {
      const result = await api(ENDPOINTS.forecastGc, {
        method: "POST",
        body: forecastPayloadFromForm(),
      });
      const vagaAutomatica = result?.vaga_automatica;
      setFeedback(
        "success",
        vagaAutomatica
          ? `Forecast salvo. Vaga ${vagaAutomatica.protocolo || ""} criada para aprovação regional.`
          : "Forecast manual salvo para o mês selecionado."
      );
      closeForecastModal();
      await Promise.all([loadForecastsManuais(), loadForecastHistorico(), loadVagasManuais()]);
      renderAll();
    } catch (error) {
      setFeedback("error", error?.message || "Não foi possível salvar o forecast.");
    } finally {
      if (el.btnSalvarForecast) {
        el.btnSalvarForecast.disabled = false;
        el.btnSalvarForecast.textContent = previousText;
      }
    }
  }

  function bindEvents() {
    document.querySelectorAll("[data-gc-help-tab]").forEach((help) => {
      help.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        activateGcTab("metricas", { scroll: true, updateHistory: true });
      });
      help.addEventListener("keydown", (event) => {
        if (event.key !== " ") return;
        event.preventDefault();
        activateGcTab("metricas", { scroll: true, updateHistory: true });
      });
    });
    el.gcTabs?.forEach((tab) => {
      tab.addEventListener("click", (event) => {
        const tabKey = tab.dataset.gcTab;
        if (!GC_TABS[tabKey]) return;
        event.preventDefault();
        activateGcTab(tabKey, { scroll: false, updateHistory: true });
      });
    });
    window.addEventListener("popstate", () => {
      activateGcTabFromLocation({ scroll: false, behavior: "auto" });
    });
    el.btnAtualizar?.addEventListener("click", () => refresh());
    el.btnToggleFiltros?.addEventListener("click", () => {
      el.filtrosAvancados?.classList.toggle("is-open");
    });
    [el.filtroMes, el.filtroAno].forEach((input) => {
      input?.addEventListener("change", () => refreshPeriod());
    });
    [el.filtroRegiao, el.filtroEquipe, el.filtroFoco, el.filtroGestor].forEach((input) => {
      input?.addEventListener("change", () => refresh());
    });
    [el.filtroMetricaGap].forEach((input) => input?.addEventListener("change", renderRegionGap));
    (el.gapCargoButtons || []).forEach((button) => {
      button.addEventListener("click", () => {
        setGapCargo(button.dataset.gapCargo);
        renderRegionGap();
      });
    });
    [el.filtroRegiaoTabela, el.filtroTipoTabela, el.filtroGestorTabela, el.filtroEquipeTabela, el.buscaEquipe].forEach((input) => input?.addEventListener("input", renderTableFromFirstPage));
    [el.filtroRegiaoTabela, el.filtroTipoTabela, el.filtroGestorTabela, el.filtroEquipeTabela].forEach((input) => input?.addEventListener("change", renderTableFromFirstPage));
    [el.pessoasFiltroNome, el.pessoasFiltroEquipe, el.pessoasFiltroGerente, el.pessoasFiltroStatus, el.pessoasFiltroTempo, el.pessoasFiltroPendencia].forEach((input) => {
      input?.addEventListener("input", renderPessoasView);
    });
    [el.filtroProdutividadeCoordenador, el.filtroProdutividadeGerente, el.filtroProdutividadeEquipe, el.filtroProdutividadeCorretor].forEach((input) => {
      input?.addEventListener("change", refreshProdutividadeOnly);
    });
    [el.filtroComercialCoordenador, el.filtroComercialGerente, el.filtroComercialEquipe, el.filtroComercialCorretor].forEach((input) => {
      input?.addEventListener("change", refreshComercialOnly);
    });
    el.btnNovaVaga?.addEventListener("click", () => openVagaModal("nova"));
    document.querySelectorAll("[data-open-vaga-view]").forEach((button) => {
      button.addEventListener("click", () => openVagaModal("nova"));
    });
    el.formVagaManual?.addEventListener("submit", submitVagaManual);
    el.formVagaStatus?.addEventListener("change", updateVagaDateRequirement);
    el.formExcluirVagaManual?.addEventListener("submit", submitExcluirVagaManual);
    el.formAprovacaoVaga?.addEventListener("submit", submitAprovacaoVaga);
    el.formPrioridadeVaga?.addEventListener("submit", submitPrioridadeVaga);
    el.formForecastManual?.addEventListener("submit", submitForecastManual);
    el.modalVagaManual?.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-vaga-modal]")) closeVagaModal();
    });
    el.modalExcluirVagaManual?.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-delete-vaga-modal]")) closeExcluirVagaModal();
    });
    el.modalAprovacaoVaga?.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-approval-vaga-modal]")) closeAprovacaoVagaModal();
    });
    el.modalPrioridadeVaga?.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-priority-vaga-modal]")) closePrioridadeVagaModal();
    });
    el.btnAdicionarPrioridadeVaga?.addEventListener("click", addPrioridadeVagaRow);
    el.prioridadeVagaRows?.addEventListener("input", updatePrioridadeVagaResumo);
    el.prioridadeVagaRows?.addEventListener("change", updatePrioridadeVagaResumo);
    el.prioridadeVagaRows?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-priority-row]");
      if (!button) return;
      const index = Number(button.dataset.removePriorityRow);
      const rows = prioridadeVagaRowsFromModal().filter((_, rowIndex) => rowIndex !== index);
      setPrioridadeVagaRows(rows);
    });
    el.modalVagasSla?.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-sla-modal]")) closeVagasSlaModal();
    });
    el.modalProdutividadeCorretor?.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-corretor-prod-modal]")) closeProdutividadeCorretorModal();
    });
    el.modalForecastManual?.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-forecast-modal]")) closeForecastModal();
    });
    el.listaVagasManuais?.addEventListener("click", handleVagaManualAction);
    el.tabelaVagasGc?.addEventListener("click", handleVagaManualAction);
    el.tabelaAprovacoesGc?.addEventListener("click", handleVagaManualAction);
    el.tabelaProdutividadeGerentes?.addEventListener("click", (event) => {
      const corretorButton = event.target.closest("[data-prod-corretor]");
      if (corretorButton) {
        openProdutividadeCorretorModal(corretorButton.dataset.prodCorretor);
        return;
      }
      const button = event.target.closest("[data-prod-button]");
      if (!button) return;
      toggleProdutividadeDrill(button.dataset.prodButton);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && activeDatePicker) {
        event.preventDefault();
        closeDatePicker(activeDatePicker);
        return;
      }
      if (event.key === "Escape" && el.modalVagaManual && !el.modalVagaManual.hidden) {
        closeVagaModal();
      }
      if (event.key === "Escape" && el.modalExcluirVagaManual && !el.modalExcluirVagaManual.hidden) {
        closeExcluirVagaModal();
      }
      if (event.key === "Escape" && el.modalAprovacaoVaga && !el.modalAprovacaoVaga.hidden) {
        closeAprovacaoVagaModal();
      }
      if (event.key === "Escape" && el.modalPrioridadeVaga && !el.modalPrioridadeVaga.hidden) {
        closePrioridadeVagaModal();
      }
      if (event.key === "Escape" && el.modalVagasSla && !el.modalVagasSla.hidden) {
        closeVagasSlaModal();
      }
      if (event.key === "Escape" && el.modalProdutividadeCorretor && !el.modalProdutividadeCorretor.hidden) {
        closeProdutividadeCorretorModal();
      }
      if (event.key === "Escape" && el.modalForecastManual && !el.modalForecastManual.hidden) {
        closeForecastModal();
      }
    });
    el.tabelaEquipes?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-open-vagas-group]");
      if (!button || button.disabled) return;
      openVagasSlaModal(button.dataset.openVagasGroup);
    });
    el.paginacaoEquipes?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-page]");
      if (!button || button.disabled) return;
      const nextPage = Number(button.dataset.page);
      if (!Number.isFinite(nextPage)) return;
      state.tablePage = nextPage;
      renderTable();
    });
    el.btnExportar?.addEventListener("click", exportCsv);
    el.btnTema?.addEventListener("click", () => {
      const root = document.documentElement;
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      if (portalState?.persistTheme) {
        portalState.persistTheme(next);
      } else {
        root.setAttribute("data-theme", next);
        try { window.localStorage.setItem("tl.theme", next); } catch {}
      }
      root.setAttribute("data-theme", next);
    });
  }

  async function init() {
    collectElements();
    normalizeFilterLabels();
    activateGcTabFromLocation({ scroll: false, load: false });
    populatePeriod();
    enhanceCustomSelects();
    enhanceDatePickers();
    bindEvents();
    try {
      await loadUser();
      await loadReferences();
      await refresh();
      activateGcTabFromLocation({ scroll: false, behavior: "auto", load: false });
      if (state.activeTab === "produtividade") {
        await ensureProdutividadeLoaded();
      }
      if (state.activeTab === "comercial") {
        await ensureComercialLoaded();
      }
    } catch (error) {
      setFeedback("error", error?.message || "Não foi possível carregar o Dashboard G&C.");
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();

