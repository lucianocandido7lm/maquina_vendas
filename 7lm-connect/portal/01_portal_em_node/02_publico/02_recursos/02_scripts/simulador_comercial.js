(function () {
  "use strict";

  const shared = window.SevenLMConnectOperacoes;
  const API_BASE = shared?.buildPortalPath ? shared.buildPortalPath("/api") : "/api";
  const PRESELECTED_PROPERTY_STORAGE_KEY = "7lm-connect-simulador-imovel";
  const ESTIMATIVA_TAXA_FINANCIAMENTO_MENSAL = 0.006;
  const LIMITE_SUGESTOES_IMOVEIS = 500;
  const LIMITE_SUGESTOES_ESCOLHA_INICIAL = 20;
  const DEFAULT_PROPERTY_DELIVERY_MONTHS = 20;
  const DEFAULT_PROPERTY_DELIVERY_DATE = "2027-12-15";
  const MAX_TOTAL_TIMELINE_MONTHS = 80;
  const MIN_CLIENT_INSTALLMENT = 120;
  const PARTNER_STANDARD = "7lm";
  const PARTNER_CREDITUR = "creditur";
  const PARTNER_CREDITUR_GERAL = "creditur_geral";
  const CREDITUR_PHASE_PRE = "pre";
  const CREDITUR_PHASE_POST = "pos";
  const CREDITUR_PRE_DEFAULT_MONTHS = 60;
  const CREDITUR_POST_DEFAULT_MONTHS = 20;
  const CREDITUR_PRE_MAX_MONTHS = 60;
  const CREDITUR_POST_MAX_MONTHS = 80;
  const CREDITUR_TOTAL_MAX_MONTHS = 80;
  const CREDITU_GERAL_MIN_VALUE = 1000;
  const CREDITU_GERAL_MAX_VALUE = 150000;
  const CREDITU_GERAL_MIN_MONTHS = 36;
  const CREDITU_GERAL_MAX_MONTHS = 60;
  const CREDITU_GERAL_DEFAULT_MONTHS = 60;
  const CREDITU_GERAL_ANNUAL_RATE = 0.12;
  const CREDITU_GERAL_MONTHLY_RATE = Math.pow(1 + CREDITU_GERAL_ANNUAL_RATE, 1 / 12) - 1;
  const CREDITU_GERAL_BANK_COST_RATE = 0.006753;
  const CREDITU_GERAL_ADMIN_COST_RATE = 0.011255;
  const CREDITU_GERAL_STRUCTURE_COST_RATE = 0.010000;
  const CREDITU_GERAL_INSURANCE_RATE_PER_MONTH = 0.5682 / 1000;
  const CREDITU_GERAL_COMMITMENT_LIMIT = 0.55;
  const CREDITU_GERAL_DOWNPAYMENT_PROPERTY_LIMIT = 0.20;
  const CREDITU_GERAL_SCORE_LIMIT = 450;
  const CREDITU_GERAL_YOUNG_SCORE_LIMIT = 400;
  const CREDITU_GERAL_YOUNG_SCORE_MAX_AGE = 30;
  const CREDITU_GERAL_SITE_URL = "https://creditu.com/br/7lm/";
  const APPROVAL_EXCEPTION_GAP_PERCENT = 0.05;
  const APPROVAL_EXCEPTION_GAP_ABSOLUTE = 15000;
  const PROPERTY_DISCOUNT_LIMIT = 50000;
  const PROPERTY_DISCOUNT_DEFAULT_MIN = 0;
  const PROPERTY_DISCOUNT_STEP_UNITS = 6000;
  const PROPERTY_DISCOUNT_STEP_VALUE = 5000;
  const DISCOUNT_WITHOUT_APPROVAL_LIMIT = 40000;
  const CLIENTS_RENDER_BATCH = 12;
  const SUGGESTIONS_RENDER_BATCH = 12;
  const AUTO_RECALCULATION_IDLE_MS = 900;
  const AUTO_SAVE_IDLE_MS = 1800;
  const BROKER_OVERPRICE_RULE_STORAGE_KEY = "7lm-connect-simulador-sobrepreco-corretor-regra";
  const DEFAULT_BROKER_OVERPRICE_SUGGESTIONS = [5000, 10000, 15000];
  const DEFAULT_BROKER_OVERPRICE_TIERS = [
    { operation: 1, rate: 0.05, cap: 500, label: "1ª Reserva Ou Venda" },
    { operation: 2, rate: 0.1, cap: 1000, label: "2ª Reserva Ou Venda" },
    { operation: 3, rate: 0.1, cap: null, label: "3ª Reserva/Venda Em Diante" },
  ];

  const ENDPOINTS = {
    me: `${API_BASE}/me`,
    clientesAprovados: `${API_BASE}/connect-comercial/simulador/clientes-aprovados`,
    clienteContexto: `${API_BASE}/connect-comercial/simulador/clientes/{id}/contexto`,
    complementos: `${API_BASE}/connect-comercial/clientes/{id}/complementos-renda`,
    complementoPorId: `${API_BASE}/connect-comercial/clientes/{id}/complementos-renda/{complementoId}`,
    imovelDetalhe: `${API_BASE}/connect-comercial/simulador/imoveis/{id}`,
    simulacaoPorId: `${API_BASE}/connect-comercial/simulador/{id}`,
    sugerir: `${API_BASE}/connect-comercial/simulador/sugerir-imoveis`,
    calcular: `${API_BASE}/connect-comercial/simulador/calcular`,
    salvar: `${API_BASE}/connect-comercial/simulador/salvar`,
    autosalvar: `${API_BASE}/connect-comercial/simulador/autosalvar`,
    credituPdf: `${API_BASE}/connect-comercial/simulador/creditu-pdf`,
    credituAnexo: `${API_BASE}/connect-comercial/simulador/creditu-anexos`,
    remuneracaoSobrepreco: `${API_BASE}/admin/configuracoes/remuneracao-sobrepreco`,
    reservar: `${API_BASE}/connect-comercial/imoveis/{id}/reservar`,
    submeterAprovação: `${API_BASE}/connect-comercial/imoveis/{id}/submeter-aprovacao`,
    vender: `${API_BASE}/connect-comercial/imoveis/{id}/vender`,
    liberar: `${API_BASE}/connect-comercial/imoveis/{id}/liberar-reserva`,
  };

  const el = {
    feedback: document.getElementById("simFeedback"),
    actionsHint: document.getElementById("simActionsHint"),
    actionFeedback: document.getElementById("simActionsFeedback"),
    heroResumo: document.getElementById("simHeroResumo"),
    buscaCliente: document.getElementById("simBuscaCliente"),
    clienteSelector: document.getElementById("simClienteSelector"),
    clienteSelectorPainel: document.getElementById("simClienteSelectorPainel"),
    clienteSelectorToggle: document.getElementById("btnAlternarClienteSelector"),
    clienteSelectorLabel: document.getElementById("simClienteSelectorLabel"),
    clienteSelectorTitulo: document.getElementById("simClienteSelectorTitulo"),
    clienteSelectorHint: document.getElementById("simClienteSelectorHint"),
    clientesLista: document.getElementById("simClientesLista"),
    clienteSelecionado: document.getElementById("simClienteSelecionado"),
    clienteStatus: document.getElementById("simClienteStatus"),
    complementosLista: document.getElementById("simComplementosLista"),
    modoSugestoes: document.getElementById("simModoSugestoes"),
    buscaImovel: document.getElementById("simBuscaImovel"),
    sugestõesResumo: document.getElementById("simSugestoesResumo"),
    sugestõesLista: document.getElementById("simSugestoesLista"),
    sugestoesScrollHint: document.getElementById("simSugestoesScrollHint"),
    comparador: document.getElementById("simComparador"),
    imovelPreview: document.getElementById("simImovelPreview"),
    imovelStatus: document.getElementById("simImovelStatus"),
    resumoKpis: document.getElementById("simResumoKpis"),
    statusBadge: document.getElementById("simStatusBadge"),
    btnAbrirAlertas: document.getElementById("btnAbrirAlertas"),
    sugestõesAjuste: document.getElementById("simSugestoesAjuste"),
    parcelasResumo: document.getElementById("simParcelasResumo"),
    parcelasGrafico: document.getElementById("simParcelasGrafico"),
    demonstrativoBody: document.getElementById("simDemonstrativoBody"),
    modalDemonstrativo: document.getElementById("simDemonstrativoModal"),
    btnAbrirDemonstrativo: document.getElementById("btnAbrirDemonstrativo"),
    btnFecharDemonstrativo: document.getElementById("btnFecharDemonstrativo"),
    modalAlertas: document.getElementById("simAlertasModal"),
    alertasResumo: document.getElementById("simAlertasResumo"),
    alertasStats: document.getElementById("simAlertasStats"),
    alertasLista: document.getElementById("simAlertasLista"),
    btnFecharAlertas: document.getElementById("btnFecharAlertas"),
    btnSugerir: document.getElementById("btnSugerirImoveis"),
    btnCalcular: document.getElementById("btnCalcularSimulacao"),
    btnSalvar: document.getElementById("btnSalvarSimulacao"),
    btnPdf: document.getElementById("btnEmitirPdf"),
    btnReservar: document.getElementById("btnReservarImovel"),
    btnVender: document.getElementById("btnVenderImovel"),
    btnSolicitarAprovação: document.getElementById("btnSolicitarAprovaçãoVenda"),
    btnLiberar: document.getElementById("btnLiberarReserva"),
    btnNova: document.getElementById("btnNovaSimulacao"),
    btnNovoComplemento: document.getElementById("btnNovoComplemento"),
    modalComplemento: document.getElementById("simComplementoModal"),
    formComplemento: document.getElementById("simComplementoForm"),
    complementoTitulo: document.getElementById("simComplementoTitulo"),
    complementoFeedback: document.getElementById("simComplementoFeedback"),
    btnFecharComplemento: document.getElementById("btnFecharComplemento"),
    inputComplementoNome: document.getElementById("simComplementoNome"),
    inputComplementoCpf: document.getElementById("simComplementoCpf"),
    inputComplementoParentesco: document.getElementById("simComplementoParentesco"),
    inputComplementoRenda: document.getElementById("simComplementoRenda"),
    inputComplementoAtivo: document.getElementById("simComplementoAtivo"),
    modalMapa: document.getElementById("simMapaModal"),
    mapaFrame: document.getElementById("simMapaFrame"),
    mapaTitulo: document.getElementById("simMapaTitulo"),
    mapaEndereco: document.getElementById("simMapaEndereco"),
    mapaResumo: document.getElementById("simMapaResumo"),
    mapaCoordenadas: document.getElementById("simMapaCoordenadas"),
    btnFecharMapa: document.getElementById("btnFecharMapa"),
    btnMapaAbrir: document.getElementById("btnAbrirGoogleMaps"),
    btnMapaRota: document.getElementById("btnVerRota"),
    btnMapaCopiar: document.getElementById("btnCopiarEnderecoMapa"),
    modalGaleria: document.getElementById("simGaleriaModal"),
    galeriaTitulo: document.getElementById("simGaleriaTitulo"),
    galeriaResumo: document.getElementById("simGaleriaResumo"),
    galeriaCounter: document.getElementById("simGaleriaCounter"),
    galeriaStage: document.getElementById("simGaleriaStage"),
    galeriaThumbs: document.getElementById("simGaleriaThumbs"),
    galeriaInfo: document.getElementById("simGaleriaInfo"),
    btnFecharGaleria: document.getElementById("btnFecharGaleria"),
    modalEscolhaImovel: document.getElementById("simEscolhaImovelModal"),
    escolhaImovelResumo: document.getElementById("simEscolhaImovelResumo"),
    escolhaImovelOpcoes: document.getElementById("simEscolhaImovelOpcoes"),
    btnFecharEscolhaImovel: document.getElementById("btnFecharEscolhaImovel"),
    modalSobrepreco: document.getElementById("simSobreprecoModal"),
    sobreprecoResumo: document.getElementById("simSobreprecoResumo"),
    sobreprecoOpcoes: document.getElementById("simSobreprecoOpcoes"),
    sobreprecoManual: document.getElementById("simSobreprecoManual"),
    sobreprecoOperacoes: document.getElementById("simSobreprecoOperacoes"),
    sobreprecoComissaoPct: document.getElementById("simSobreprecoComissaoPct"),
    sobreprecoTetoComissao: document.getElementById("simSobreprecoTetoComissao"),
    btnFecharSobrepreco: document.getElementById("btnFecharSobrepreco"),
    btnAplicarSobreprecoManual: document.getElementById("btnAplicarSobreprecoManual"),
    btnAtualizarSobreprecoRegra: document.getElementById("btnAtualizarSobreprecoRegra"),
    btnRestaurarSobreprecoRegra: document.getElementById("btnRestaurarSobreprecoRegra"),
    btnZerarSobrepreco: document.getElementById("btnZerarSobrepreco"),
    btnDecidirSobreprecoDepois: document.getElementById("btnDecidirSobreprecoDepois"),
    parceiroHint: document.getElementById("simParceiroHint"),
    prazoFluxoGroup: document.getElementById("simPrazoFluxoGroup"),
    parcelasMensaisGroup: document.getElementById("simParcelasMensaisGroup"),
    crediturScheduleGroup: document.getElementById("simCrediturScheduleGroup"),
    crediturSemestres: document.getElementById("simCrediturSemestres"),
    btnAdicionarCrediturSemestre: document.getElementById("btnAdicionarCrediturSemestre"),
    credituGeralResumo: document.getElementById("simCredituGeralResumo"),
    credituGeralActions: document.getElementById("simCredituGeralActions"),
    btnAbrirSiteCredituGeral: document.getElementById("btnAbrirSiteCredituGeral"),
    btnAbrirCredituGeral: document.getElementById("btnAbrirCredituGeral"),
    modalCredituGeral: document.getElementById("simCredituGeralModal"),
    formCredituGeral: document.getElementById("simCredituGeralForm"),
    credituGeralFeedback: document.getElementById("simCredituGeralFeedback"),
    btnFecharCredituGeral: document.getElementById("btnFecharCredituGeral"),
    btnSimularCredituGeral: document.getElementById("btnSimularCredituGeral"),
    btnAplicarCredituGeral: document.getElementById("btnAplicarCredituGeral"),
    credituGeralPdf: document.getElementById("simCredituGeralPdf"),
    credituGeralPdfStatus: document.getElementById("simCredituGeralPdfStatus"),
    btnSelecionarCredituGeralPdf: document.getElementById("btnSelecionarCredituGeralPdf"),
    btnImportarCredituGeralPdf: document.getElementById("btnImportarCredituGeralPdf"),
    credituGeralSerasa: document.getElementById("simCredituGeralSerasa"),
    credituGeralSerasaStatus: document.getElementById("simCredituGeralSerasaStatus"),
    btnSelecionarCredituGeralSerasa: document.getElementById("btnSelecionarCredituGeralSerasa"),
    btnLimparCredituGeralSerasa: document.getElementById("btnLimparCredituGeralSerasa"),
    credituGeralSicaq: document.getElementById("simCredituGeralSicaq"),
    credituGeralSicaqStatus: document.getElementById("simCredituGeralSicaqStatus"),
    btnSelecionarCredituGeralSicaq: document.getElementById("btnSelecionarCredituGeralSicaq"),
    btnLimparCredituGeralSicaq: document.getElementById("btnLimparCredituGeralSicaq"),
    credituGeralCliente: document.getElementById("simCredituGeralCliente"),
    credituGeralValor: document.getElementById("simCredituGeralValor"),
    credituGeralValorSlider: document.getElementById("simCredituGeralValorSlider"),
    credituGeralValorLabel: document.getElementById("simCredituGeralValorLabel"),
    credituGeralValorMin: document.getElementById("simCredituGeralValorMin"),
    credituGeralValorMax: document.getElementById("simCredituGeralValorMax"),
    credituGeralPrazo: document.getElementById("simCredituGeralPrazo"),
    credituGeralPrazoLabel: document.getElementById("simCredituGeralPrazoLabel"),
    credituGeralSistema: document.getElementById("simCredituGeralSistema"),
    credituGeralSeguro: document.getElementById("simCredituGeralSeguro"),
    credituGeralRenda: document.getElementById("simCredituGeralRenda"),
    credituGeralParcelaCaixa: document.getElementById("simCredituGeralParcelaCaixa"),
    credituGeralValorImovel: document.getElementById("simCredituGeralValorImovel"),
    credituGeralIdade: document.getElementById("simCredituGeralIdade"),
    credituGeralScore: document.getElementById("simCredituGeralScore"),
    credituGeralRestricoes: document.getElementById("simCredituGeralRestricoes"),
    credituGeralParcelaInicial: document.getElementById("simCredituGeralParcelaInicial"),
    credituGeralParcelaFinal: document.getElementById("simCredituGeralParcelaFinal"),
    credituGeralDetalhes: document.getElementById("simCredituGeralDetalhes"),
    credituGeralAvaliacao: document.getElementById("simCredituGeralAvaliacao"),
  };

  const state = {
    user: null,
    clientes: [],
    clienteSelecionado: null,
    clienteContextoCarregando: false,
    clienteContextoPromise: null,
    consolidacaoCliente: null,
    complementos: [],
    reservasCliente: [],
    sugestões: [],
    sugestõesAvaliadas: 0,
    melhorSugestaoId: "",
    imovelSelecionado: null,
    comparador: [],
    modoSugestoes: "all",
    buscaImovel: "",
    fotoAtivaIndice: 0,
    simulacaoAtual: null,
    simulacaoSalvaId: "",
    simulacaoAutosaveId: "",
    simulacaoAutosaveTimer: null,
    simulacaoAutosaveEmAndamento: false,
    simulacaoAutosavePendente: false,
    simulacaoAutosaveAssinaturaSalva: "",
    simulacaoAutosaveAssinaturaEmAndamento: "",
    acaoEmAndamento: "",
    complementoEdicaoId: "",
    buscaClienteTimer: null,
    buscaSugestoesTimer: null,
    sugestoesUiTimer: null,
    simulacaoRecalculoTimer: null,
    simulacaoRecalculoEmAndamento: false,
    simulacaoRecalculoPendente: false,
    simulacaoEntradaVersao: 0,
    simulacaoRecalculoVersaoEmAndamento: null,
    simulacaoRecalculoVersaoAplicada: -1,
    simulacaoRecalculoAssinaturaEmAndamento: "",
    simulacaoRecalculoAssinaturaAplicada: "",
    preselectedContext: null,
    clienteSelectorAberto: true,
    galeriaImovel: null,
    galeriaFotos: [],
    galeriaIndex: 0,
    escolhaImovelInicialMostrada: false,
    escolhaImovelInicialOpcoes: [],
    sobreprecoRegra: null,
    sobreprecoRegraPromise: null,
    sobreprecoContexto: null,
    simulacaoNotificacoes: [],
    clientesRenderLimit: CLIENTS_RENDER_BATCH,
    sugestoesRenderLimit: SUGGESTIONS_RENDER_BATCH,
    credituGeral: null,
    credituGeralPdfPendente: false,
    crediturSemestres: [{ fase: CREDITUR_PHASE_PRE, parcela_inicio: 1, parcela_fim: CREDITUR_PRE_DEFAULT_MONTHS, valor: "" }],
  };

  const ids = {
    filtroEmpreendimento: "simFiltroEmpreendimento",
    filtroCidade: "simFiltroCidade",
    filtroBairro: "simFiltroBairro",
    filtroBloco: "simFiltroBloco",
    filtroApartamento: "simFiltroApartamento",
    filtroFaixaPreco: "simFiltroFaixaPreco",
    filtroPrecoMin: "simFiltroPrecoMin",
    filtroPrecoMax: "simFiltroPrecoMax",
    valorImovel: "simValorImovel",
    financiamento: "simFinanciamento",
    parcelaBanco: "simParcelaBanco",
    fgts: "simFgts",
    subsidio: "simSubsidio",
    chequeMoradia: "simChequeMoradia",
    entrada: "simEntrada",
    parceiroSimulacao: "simParceiroSimulacao",
    sobrepreco: "simSobrepreco",
    descontoImovel: "simDescontoImovel",
    valorNegociado: "simValorNegociado",
    mesesPre: "simMesesPre",
    mesesPos: "simMesesPos",
    preObraValor: "simPreObraValor",
    posObraValor: "simPosObraValor",
    intermediariaValor: "simIntermediariaValor",
    intermediariaQtd: "simIntermediariaQtd",
    intermediariaDatas: "simIntermediariaDatas",
    intermediariaAdicionar: "btnAdicionarIntermediaria",
    anualValor: "simAnualValor",
    anualQtd: "simAnualQtd",
    anualPrimeiraData: "simAnualPrimeiraData",
    semestralValor: "simSemestralValor",
    semestralQtd: "simSemestralQtd",
    semestralPrimeiraData: "simSemestralPrimeiraData",
    reforcoValor: "simReforcoValor",
    reforcoQtd: "simReforcoQtd",
    observacoes: "simObservacoes",
  };

  const simulationRecalcFieldIds = new Set([
    ids.financiamento,
    ids.parcelaBanco,
    ids.fgts,
    ids.subsidio,
    ids.chequeMoradia,
    ids.entrada,
    ids.parceiroSimulacao,
    ids.sobrepreco,
    ids.descontoImovel,
    ids.mesesPos,
    ids.preObraValor,
    ids.posObraValor,
    ids.intermediariaValor,
    ids.intermediariaQtd,
    ids.anualValor,
    ids.anualQtd,
    ids.anualPrimeiraData,
    ids.semestralValor,
    ids.semestralQtd,
    ids.semestralPrimeiraData,
    ids.reforcoValor,
    ids.reforcoQtd,
  ]);

  const minimumInstallmentFieldIds = new Set([
    ids.intermediariaValor,
    ids.anualValor,
    ids.semestralValor,
    ids.reforcoValor,
  ]);

  function endpoint(template, values = {}) {
    return String(template || "").replace(/\{([^}]+)\}/g, (_, key) => encodeURIComponent(values[key] || ""));
  }

  function escapeHtml(value) {
    if (shared?.escapeHtml) return shared.escapeHtml(String(value ?? ""));
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  const SIM_TITLE_CASE_ACRONYMS = new Set([
    "7LM",
    "AGL",
    "API",
    "CAT",
    "CNPJ",
    "CPF",
    "DF",
    "FGTS",
    "FSA",
    "GO",
    "IPCA",
    "PDF",
    "PRICE",
    "RG",
    "SAC",
    "SLA",
  ]);
  const SIM_TITLE_CASE_ATTRIBUTES = ["title", "aria-label", "placeholder", "alt"];
  const SIM_ROMAN_NUMERAL_PATTERN = /^(?:[IVXLCDM]+)$/i;

  function titleCaseWordSegment(segment) {
    const text = String(segment || "");
    if (!text) return text;
    const upper = text.toLocaleUpperCase("pt-BR");
    if (SIM_TITLE_CASE_ACRONYMS.has(upper)) return upper;
    if (SIM_ROMAN_NUMERAL_PATTERN.test(text)) return upper;
    if (upper === "EMAIL" || upper === "E-MAIL") return "E-mail";
    if (text === upper && upper.length > 1 && upper.length <= 4) return upper;
    const lower = text.toLocaleLowerCase("pt-BR");
    return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
  }

  function shouldKeepTokenCase(token) {
    const text = String(token || "");
    if (!text || !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(text)) return true;
    return /@|https?:\/\/|www\.|[A-Za-z0-9._%+-]+\.[A-Za-z]{2,}/.test(text);
  }

  function titleCaseToken(token) {
    if (shouldKeepTokenCase(token)) return token;
    const titled = String(token).replace(/\p{L}[\p{L}\p{M}]*(?:-[\p{L}\p{M}]+)*/gu, (word) =>
      word.split("-").map(titleCaseWordSegment).join("-")
    );
    return titled.replace(/\((S|Ões|Oes)\)/gu, (suffix) => suffix.toLocaleLowerCase("pt-BR"));
  }

  function titleCaseDisplay(value) {
    const text = String(value ?? "");
    if (!text.trim()) return text;
    return text.split(/(\s+)/).map((part) => (/\s+/.test(part) ? part : titleCaseToken(part))).join("");
  }

  function shouldSkipTitleCaseElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return true;
    return ["SCRIPT", "STYLE", "NOSCRIPT", "INPUT", "TEXTAREA", "SELECT", "OPTION"].includes(element.tagName);
  }

  function shouldSkipTitleCaseAttributes(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return true;
    return ["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName);
  }

  function titleCaseElementAttributes(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE || shouldSkipTitleCaseAttributes(element)) return;
    SIM_TITLE_CASE_ATTRIBUTES.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      const current = element.getAttribute(attribute);
      const next = titleCaseDisplay(current);
      if (next !== current) element.setAttribute(attribute, next);
    });
  }

  function titleCaseTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    if (shouldSkipTitleCaseElement(node.parentElement)) return;
    const current = node.nodeValue || "";
    if (!current.trim()) return;
    const next = titleCaseDisplay(current);
    if (next !== current) node.nodeValue = next;
  }

  function titleCaseNodeTree(rootNode) {
    if (!rootNode) return;
    if (rootNode.nodeType === Node.TEXT_NODE) {
      titleCaseTextNode(rootNode);
      return;
    }
    if (rootNode.nodeType !== Node.ELEMENT_NODE && rootNode.nodeType !== Node.DOCUMENT_NODE) return;

    const rootElement = rootNode.nodeType === Node.DOCUMENT_NODE ? rootNode.documentElement : rootNode;
    if (!rootElement) return;
    titleCaseElementAttributes(rootElement);

    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let current = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        titleCaseElementAttributes(current);
      } else if (current.nodeType === Node.TEXT_NODE) {
        titleCaseTextNode(current);
      }
      current = walker.nextNode();
    }
  }

  let simulatorTitleCaseObserver = null;

  function installSimulatorTitleCaseObserver() {
    if (simulatorTitleCaseObserver) return;
    simulatorTitleCaseObserver = true;
    window.setTimeout(() => {
      const target = document.querySelector(".tl-main") || document.querySelector(".tl-sim-page") || document.body;
      titleCaseNodeTree(target);
    }, 120);
  }

  function renderFeedback(target, variant, text) {
    if (!target) return;
    if (!text) {
      target.innerHTML = "";
      return;
    }
    target.innerHTML = `<div class="tl-imoveis-feedback__item" data-variant="${escapeHtml(variant || "info")}">${escapeHtml(titleCaseDisplay(text))}</div>`;
  }

  function showFeedback(variant, text) {
    renderFeedback(el.feedback, variant, text);
  }

  function showActionFeedback(variant, text) {
    renderFeedback(el.actionFeedback, variant, text);
  }

  function showActionMessage(variant, text) {
    showFeedback(variant, text);
    showActionFeedback(variant, text);
  }

  function showComplementoFeedback(variant, text) {
    if (!el.complementoFeedback) return;
    el.complementoFeedback.textContent = titleCaseDisplay(text || "");
    el.complementoFeedback.dataset.variant = variant || "info";
  }

  function readValue(id) {
    return document.getElementById(id)?.value || "";
  }

  function setValue(id, value) {
    const node = document.getElementById(id);
    if (!node) return;
    node.value = value ?? "";
    if (node.tagName === "SELECT") {
      node.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function readonlySimulationFields() {
    return [
      [ids.valorImovel, "Valor automático do imóvel selecionado"],
      [ids.financiamento, "Valor vindo do cadastro do cliente"],
      [ids.parcelaBanco, "Parcela vinda do cadastro do cliente"],
      [ids.fgts, "Valor vindo do cadastro do cliente"],
      [ids.mesesPre, "Prazo automático conforme o cadastro do imóvel"],
    ];
  }

  function editableSimulationFields() {
    return [
      [ids.subsidio, "Entra no valor pago pelo cliente e no garantido real"],
      [ids.chequeMoradia, "Informe o valor de cheque moradia usado nesta proposta"],
    ];
  }

  function syncReadonlySimulationFields() {
    readonlySimulationFields().forEach(([id, title]) => {
      const field = document.getElementById(id);
      if (!(field instanceof HTMLInputElement)) return;
      field.readOnly = true;
      field.setAttribute("aria-readonly", "true");
      field.title = title;
    });

    editableSimulationFields().forEach(([id, title]) => {
      const field = document.getElementById(id);
      if (!(field instanceof HTMLInputElement)) return;
      field.readOnly = false;
      field.removeAttribute("readonly");
      field.setAttribute("aria-readonly", "false");
      field.title = title;
    });

    const mesesPosField = document.getElementById(ids.mesesPos);
    if (mesesPosField instanceof HTMLInputElement) {
      mesesPosField.readOnly = true;
      mesesPosField.setAttribute("readonly", "true");
      mesesPosField.setAttribute("aria-readonly", "true");
      mesesPosField.min = "0";
      syncPostDeliveryFieldConstraints();
    }
  }

  function normalizePartnerText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function normalizeSimulationPartner(value) {
    const normalized = normalizePartnerText(value);
    const compact = normalized.replace(/[\s-]+/g, "_");
    const isCrediturText = normalized.includes("creditur")
      || normalized.includes("creditu")
      || normalized.includes("credtur")
      || normalized.includes("credi tur");
    if ((isCrediturText && normalized.includes("geral")) || compact === PARTNER_CREDITUR_GERAL) {
      return PARTNER_CREDITUR_GERAL;
    }
    if (isCrediturText || compact === PARTNER_CREDITUR) return PARTNER_CREDITUR;
    return PARTNER_STANDARD;
  }

  function isCrediturPartner(value) {
    const normalized = normalizeSimulationPartner(value);
    return normalized === PARTNER_CREDITUR || normalized === PARTNER_CREDITUR_GERAL;
  }

  function getSimulationPartnerLabel(value) {
    const raw = normalizePartnerText(value);
    const compact = raw.replace(/[\s-]+/g, "_");
    const normalized = normalizeSimulationPartner(value);
    if (normalized === PARTNER_CREDITUR_GERAL) return "Creditú Geral";
    if (normalized === PARTNER_CREDITUR) return "Creditú CAT";
    if (normalized === PARTNER_STANDARD && ["7lm", "7lm_padrao", "padrao", "padrão"].includes(compact)) return "7LM";
    return "";
  }

  function getSelectedSimulationPartner() {
    return normalizeSimulationPartner(readValue(ids.parceiroSimulacao));
  }

  function isCrediturSelected() {
    return isCrediturPartner(getSelectedSimulationPartner());
  }

  function isCrediturGeralSelected() {
    return getSelectedSimulationPartner() === PARTNER_CREDITUR_GERAL;
  }

  function normalizePreDeliveryMonths(value, fallback = resolvePropertyDelivery(state.imovelSelecionado).mesesPreEntrega) {
    const maximo = isCrediturSelected()
      ? CREDITUR_PRE_MAX_MONTHS
      : resolvePropertyDelivery(state.imovelSelecionado).mesesPreEntrega;
    return clamp(toNumber(value, fallback || DEFAULT_PROPERTY_DELIVERY_MONTHS), 1, maximo);
  }

  function getAvailablePostDeliveryMonths(mesesPre = resolvePropertyDelivery(state.imovelSelecionado).mesesPreEntrega) {
    if (isCrediturSelected()) {
      const mesesPreNormalizados = clamp(toNumber(mesesPre, DEFAULT_PROPERTY_DELIVERY_MONTHS), 0, CREDITUR_PRE_MAX_MONTHS);
      return clamp(CREDITUR_TOTAL_MAX_MONTHS - mesesPreNormalizados, 0, CREDITUR_POST_MAX_MONTHS);
    }
    const mesesPreNormalizados = clamp(toNumber(mesesPre, DEFAULT_PROPERTY_DELIVERY_MONTHS), 0, MAX_TOTAL_TIMELINE_MONTHS);
    return clamp(MAX_TOTAL_TIMELINE_MONTHS - mesesPreNormalizados, 0, MAX_TOTAL_TIMELINE_MONTHS);
  }

  function getPreferredPostDeliveryMonths(mesesPre = resolvePropertyDelivery(state.imovelSelecionado).mesesPreEntrega) {
    if (isCrediturSelected()) {
      return getAvailablePostDeliveryMonths(mesesPre);
    }
    return getAvailablePostDeliveryMonths(mesesPre);
  }

  function applyCrediturDefaultTerms({ force = false } = {}) {
    if (!isCrediturSelected()) return;
    const mesesPreField = document.getElementById(ids.mesesPre);
    const mesesPosField = document.getElementById(ids.mesesPos);
    if (mesesPreField instanceof HTMLInputElement && (force || !String(mesesPreField.value || "").trim())) {
      mesesPreField.value = String(CREDITUR_PRE_DEFAULT_MONTHS);
    }
    if (mesesPosField instanceof HTMLInputElement && (force || !String(mesesPosField.value || "").trim())) {
      mesesPosField.value = String(CREDITUR_POST_DEFAULT_MONTHS);
    }
  }

  function syncPostDeliveryFieldConstraints() {
    const mesesPreField = document.getElementById(ids.mesesPre);
    const mesesPosField = document.getElementById(ids.mesesPos);
    const entrega = resolvePropertyDelivery(state.imovelSelecionado);
    const creditur = isCrediturSelected();
    const credituGeral = isCrediturGeralSelected();
    if (creditur) applyCrediturDefaultTerms({ force: false });
    const fallbackPre = creditur ? CREDITUR_PRE_DEFAULT_MONTHS : entrega.mesesPreEntrega;
    const maxMesesPre = creditur ? CREDITUR_PRE_MAX_MONTHS : entrega.mesesPreEntrega;
    const mesesPreEntrega = normalizePreDeliveryMonths(readValue(ids.mesesPre), fallbackPre);
    const limite = getAvailablePostDeliveryMonths(mesesPreEntrega);
    const preferido = getPreferredPostDeliveryMonths(mesesPreEntrega);

    if (mesesPreField instanceof HTMLInputElement) {
      mesesPreField.max = String(maxMesesPre);
      mesesPreField.readOnly = false;
      mesesPreField.removeAttribute("readonly");
      mesesPreField.setAttribute("aria-readonly", "false");
      mesesPreField.value = String(mesesPreEntrega);
      mesesPreField.title = creditur
        ? `Creditú: parcelas 1 a ${mesesPreEntrega} com valor fixo.`
        : `Prazo 7LM ajustável de 1 a ${maxMesesPre} mês(es), conforme a entrega do imóvel.`;
    }

    if (!(mesesPosField instanceof HTMLInputElement)) return limite;

    mesesPosField.max = String(limite);
    mesesPosField.readOnly = false;
    mesesPosField.removeAttribute("readonly");
    mesesPosField.setAttribute("aria-readonly", "false");
    mesesPosField.title = creditur
      ? `7LM: parcelas ${mesesPreEntrega + 1} a ${CREDITUR_TOTAL_MAX_MONTHS}.`
      : `Quantidade de parcelas pós-entrega 7LM, limitada ao prazo total máximo de ${MAX_TOTAL_TIMELINE_MONTHS} meses.`;
    mesesPosField.value = String(creditur ? limite : normalizePostDeliveryMonths(mesesPosField.value, preferido, mesesPreEntrega));
    if (el.parceiroHint) {
      el.parceiroHint.hidden = !creditur;
      el.parceiroHint.textContent = creditur
        ? `Creditú: parcela fixa de 1 a ${mesesPreEntrega}; níveis 7LM de ${mesesPreEntrega + 1} a ${CREDITUR_TOTAL_MAX_MONTHS}.`
        : "";
      if (credituGeral) {
        el.parceiroHint.textContent = "Creditú Geral: Simule, Aprove E Aplique O Valor Liberado Pela Creditú; O Valor Entra No Pré-Chaves E Mantém 20 Parcelas 7LM No Pós-Creditú.";
      }
    }
    if (el.prazoFluxoGroup) {
      el.prazoFluxoGroup.hidden = creditur;
    }
    if (el.parcelasMensaisGroup) {
      el.parcelasMensaisGroup.hidden = creditur;
    }
    if (el.crediturScheduleGroup) {
      el.crediturScheduleGroup.hidden = !creditur;
    }
    if (el.crediturSemestres) {
      el.crediturSemestres.hidden = !creditur;
    }
    if (el.btnAdicionarCrediturSemestre) {
      el.btnAdicionarCrediturSemestre.hidden = credituGeral;
    }
    if (el.credituGeralActions) {
      el.credituGeralActions.hidden = !credituGeral;
      el.credituGeralActions.setAttribute("aria-hidden", credituGeral ? "false" : "true");
    }
    if (el.btnAbrirSiteCredituGeral) {
      el.btnAbrirSiteCredituGeral.hidden = !credituGeral;
      el.btnAbrirSiteCredituGeral.setAttribute("aria-hidden", credituGeral ? "false" : "true");
    }
    if (el.btnAbrirCredituGeral) {
      el.btnAbrirCredituGeral.hidden = !credituGeral;
      el.btnAbrirCredituGeral.setAttribute("aria-hidden", credituGeral ? "false" : "true");
    }
    renderCredituGeralResumo();
    if (state.imovelSelecionado) {
      state.imovelSelecionado.meses_pre_entrega = mesesPreEntrega;
      state.imovelSelecionado.meses_pos_entrega = toNumber(mesesPosField.value, preferido);
      state.imovelSelecionado.meses_pos_entrega_configurado = toNumber(mesesPosField.value, preferido);
    }
    return limite;
  }

  function normalizePostDeliveryMonths(value, fallback = null, mesesPre = resolvePropertyDelivery(state.imovelSelecionado).mesesPreEntrega) {
    const fallbackResolvido = fallback === null || fallback === undefined || fallback === ""
      ? getPreferredPostDeliveryMonths(mesesPre)
      : fallback;
    return clamp(toNumber(value, fallbackResolvido), 0, getAvailablePostDeliveryMonths(mesesPre));
  }

  function hasSimulationParam(parametros, key) {
    return !!parametros && Object.prototype.hasOwnProperty.call(parametros, key);
  }

  function syncClientLockedMoneyFields() {
    const parametros = state.clienteSelecionado?.parametros_simulacao || {};
    [
      [ids.financiamento, "financiamento_caixa"],
      [ids.parcelaBanco, "parcela_financiamento_banco"],
      [ids.fgts, "fgts"],
    ].forEach(([id, key]) => {
      if (!hasSimulationParam(parametros, key)) {
        setValue(id, "");
        return;
      }
      const valor = parametros[key];
      setValue(id, valor === null || valor === undefined || valor === "" ? "" : formatMoney(parseMoney(valor)));
    });
    syncClientInstallmentField();
    syncCashflowInstallmentFields();
    clampEntryToOperationLimit();
  }

  function getClientSimulationMoney(key) {
    const parametros = state.clienteSelecionado?.parametros_simulacao || {};
    if (!hasSimulationParam(parametros, key)) return 0;
    return parametros[key] === null || parametros[key] === undefined || parametros[key] === "" ? 0 : parseMoney(parametros[key]);
  }

  function getClientInstallmentBounds() {
    const limiteComprometimento = roundMoneyNumber(parseMoney(state.consolidacaoCliente?.limite_comprometimento || 0));
    const maximo = limiteComprometimento > 0 ? limiteComprometimento : 0;
    const minimo = maximo > 0 ? Math.min(MIN_CLIENT_INSTALLMENT, maximo) : MIN_CLIENT_INSTALLMENT;
    return { minimo, maximo };
  }

  function syncClientInstallmentField() {
    const field = document.getElementById(ids.parcelaBanco);
    if (!(field instanceof HTMLInputElement)) return;

    const parcelaBanco = getClientSimulationMoney("parcela_financiamento_banco");
    field.placeholder = "R$ 0,00";
    field.dataset.bankInstallment = String(parcelaBanco);

    if (!state.clienteSelecionado?.id) {
      field.title = "Selecione um cliente para carregar a parcela do banco.";
      return;
    }

    field.title = parcelaBanco > 0
      ? `Parcela do banco cadastrada para este cliente: ${formatMoney(parcelaBanco)}.`
      : "Cliente sem parcela do banco cadastrada.";
  }

  function normalizeClientInstallment({ required = false, notify = false } = {}) {
    const { minimo, maximo } = getClientInstallmentBounds();

    if (maximo <= 0) {
      if (required && notify) {
        showFeedback("warning", "O cliente precisa ter renda válida para definir a parcela máxima.");
      }
      return { valido: false, valor: 0, minimo, maximo };
    }

    return {
      valido: true,
      valor: maximo,
      minimo,
      maximo,
      ajustado: false,
    };
  }

  function getSelectedPropertyWorkFactor() {
    return clamp(percentToFactor(state.imovelSelecionado?.percentual_conclusao_obra || 0), 0, 1);
  }

  function getCashflowBankInstallment(id = "") {
    const parcelaBanco = getClientSimulationMoney("parcela_financiamento_banco");
    if (id === ids.preObraValor) {
      return roundMoneyNumber(parcelaBanco * getSelectedPropertyWorkFactor());
    }
    return parcelaBanco;
  }

  function getCashflowInstallmentLimit(id = "") {
    const { maximo } = getClientInstallmentBounds();
    const parcelaBanco = getCashflowBankInstallment(id);
    return roundMoneyNumber(Math.max(maximo - parcelaBanco, 0));
  }

  function normalizeCashflowInstallment(id, { notify = false } = {}) {
    const field = document.getElementById(id);
    if (!(field instanceof HTMLInputElement)) return 0;

    const current = parseMoney(field.value);
    const shouldMutateField = notify || !isFieldBeingEdited(field);
    const limit = getCashflowInstallmentLimit(id);
    const fase = id === ids.preObraValor ? "pré-obra" : "pós-obra";
    const regraBanco = id === ids.preObraValor ? "banco proporcional à obra" : "parcela cheia do banco";
    if (current <= 0) return 0;

    if (limit < MIN_CLIENT_INSTALLMENT) {
      if (shouldMutateField) {
        field.value = "";
      }
      if (notify) {
        showFeedback("warning", `Este cliente não tem margem mínima de ${formatMoney(MIN_CLIENT_INSTALLMENT)} no ${fase} depois de descontar ${regraBanco}.`);
      }
      return 0;
    }

    const adjusted = roundMoneyNumber(Math.max(current, MIN_CLIENT_INSTALLMENT));
    const capped = roundMoneyNumber(Math.min(adjusted, limit));
    if (capped !== current) {
      if (shouldMutateField) {
        field.value = formatMoney(capped);
      }
      if (notify) {
        const message = current < MIN_CLIENT_INSTALLMENT
          ? `Parcela 7LM ${fase} ajustada para o mínimo de ${formatMoney(MIN_CLIENT_INSTALLMENT)}.`
          : `Parcela 7LM ${fase} limitada a ${formatMoney(capped)}: 45% da renda menos ${regraBanco}.`;
        showFeedback("warning", message);
      }
    }
    return capped;
  }

  function normalizeMinimumInstallmentField(id, { notify = false } = {}) {
    const field = document.getElementById(id);
    if (!(field instanceof HTMLInputElement)) return parseMoney(readValue(id));

    const current = parseMoney(field.value);
    const shouldMutateField = notify || !isFieldBeingEdited(field);
    if (current <= 0) return 0;
    if (current >= MIN_CLIENT_INSTALLMENT) return current;

    if (shouldMutateField) {
      field.value = formatMoney(MIN_CLIENT_INSTALLMENT);
    }
    if (notify) {
      showFeedback("warning", `Parcela ajustada para o mínimo de ${formatMoney(MIN_CLIENT_INSTALLMENT)}.`);
    }
    return MIN_CLIENT_INSTALLMENT;
  }

  function syncCashflowInstallmentFields() {
    const percentualObra = formatPercent(state.imovelSelecionado?.percentual_conclusao_obra || 0);
    const configs = [
      {
        id: ids.preObraValor,
        limit: getCashflowInstallmentLimit(ids.preObraValor),
        titleAvailable: (limit) => `Teto 7LM pré-obra: ${formatMoney(limit)} (45% da renda menos banco proporcional à obra atual: ${percentualObra}).`,
        titleUnavailable: "Sem margem mínima de R$ 120,00 no pré-obra depois de descontar o banco proporcional à obra.",
      },
      {
        id: ids.posObraValor,
        limit: getCashflowInstallmentLimit(ids.posObraValor),
        titleAvailable: (limit) => `Teto 7LM pós-obra: ${formatMoney(limit)} (45% da renda menos a parcela cheia do banco).`,
        titleUnavailable: "Sem margem mínima de R$ 120,00 no pós-obra depois de descontar a parcela cheia do banco.",
      },
    ];
    configs.forEach(({ id, limit, titleAvailable, titleUnavailable }) => {
      const field = document.getElementById(id);
      if (!(field instanceof HTMLInputElement)) return;
      field.dataset.maxInstallment = String(limit);
      field.placeholder = limit >= MIN_CLIENT_INSTALLMENT
        ? `Min. ${formatMoney(MIN_CLIENT_INSTALLMENT)} / Max. ${formatMoney(limit)}`
        : "Sem margem mínima";
      field.title = limit >= MIN_CLIENT_INSTALLMENT ? titleAvailable(limit) : titleUnavailable;
      normalizeCashflowInstallment(id);
    });
  }

  function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalizeStatus(value) {
    return normalizeSearch(value).replace(/[_-]+/g, " ");
  }

  function sanitizeMoneyInput(value) {
    const text = String(value ?? "");
    if (!text) return "";
    const negative = text.trim().startsWith("-");
    const sanitized = text.replace(/[^\d,.\-]/g, "").replace(/-/g, "");
    return `${negative ? "-" : ""}${sanitized}`;
  }

  function moneyToNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    const sanitized = sanitizeMoneyInput(value);
    if (!sanitized) return null;

    const negative = sanitized.startsWith("-");
    const text = sanitized.replace(/-/g, "");
    const lastSeparator = Math.max(text.lastIndexOf(","), text.lastIndexOf("."));

    let integer = text;
    let decimal = "";

    if (lastSeparator >= 0) {
      const decimalDigits = text.length - lastSeparator - 1;
      if (decimalDigits > 0 && decimalDigits <= 2) {
        integer = text.slice(0, lastSeparator);
        decimal = text.slice(lastSeparator + 1);
      }
    }

    integer = integer.replace(/[.,]/g, "");
    decimal = decimal.replace(/[^\d]/g, "").slice(0, 2);

    if (!integer && !decimal) return null;

    const normalized = `${negative ? "-" : ""}${integer || "0"}${decimal ? `.${decimal}` : ""}`;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function parseMoney(value) {
    return moneyToNumber(value) ?? 0;
  }

  function roundMoneyNumber(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return 0;
    return Math.round(number * 100) / 100;
  }

  function formatMoney(value) {
    const number = moneyToNumber(value);
    if (number === null) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number);
  }

  function formatMoneyOrBlank(value) {
    const number = moneyToNumber(value);
    if (number === null) return "";
    return formatMoney(number);
  }

  function formatMoneyEditingValue(value) {
    return sanitizeMoneyEditingValue(value);
  }

  function hasMoneyDigits(value) {
    return /\d/.test(String(value || ""));
  }

  function placeMoneyCaret(input) {
    if (!(input instanceof HTMLInputElement)) return;
    if (document.activeElement !== input) return;

    const text = String(input.value || "");
    if (!text) return;

    const commaIndex = text.lastIndexOf(",");
    const caretPosition = commaIndex >= 0 ? commaIndex : text.length;

    window.requestAnimationFrame(() => {
      if (document.activeElement !== input) return;
      try {
        input.setSelectionRange(caretPosition, caretPosition);
      } catch (_) {
        // Alguns tipos/input states não aceitam selectionRange; neste caso, mantemos o valor formatado.
      }
    });
  }

  function sanitizeMoneyEditingValue(value) {
    const text = String(value ?? "");
    if (!text) return "";

    const negative = text.trim().startsWith("-");
    const stripped = text.replace(/[^\d,.\-]/g, "").replace(/-/g, "");
    if (!stripped) return "";

    const lastSeparator = Math.max(stripped.lastIndexOf(","), stripped.lastIndexOf("."));
    let integer = stripped;
    let decimal = "";

    if (lastSeparator >= 0) {
      integer = stripped.slice(0, lastSeparator);
      decimal = stripped.slice(lastSeparator + 1);
    }

    integer = integer.replace(/[.,]/g, "");
    decimal = decimal.replace(/[^\d]/g, "").slice(0, 2);

    if (!integer && !decimal) return "";
    if (lastSeparator >= 0) {
      return `${negative ? "-" : ""}${integer || "0"},${decimal}`;
    }
    return `${negative ? "-" : ""}${integer}`;
  }

  function toEditableMoneyValue(value) {
    const number = moneyToNumber(value);
    if (number === null) return "";
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    }).format(number);
  }

  function placeCaretAtEnd(input) {
    if (!(input instanceof HTMLInputElement)) return;
    window.requestAnimationFrame(() => {
      if (document.activeElement !== input) return;
      const end = String(input.value || "").length;
      try {
        input.setSelectionRange(end, end);
      } catch (_) {
        // Alguns estados do Android/WebView não aceitam selectionRange.
      }
    });
  }

  function selectAllText(input) {
    if (!(input instanceof HTMLInputElement)) return;
    window.requestAnimationFrame(() => {
      if (document.activeElement !== input) return;
      try {
        input.setSelectionRange(0, String(input.value || "").length);
      } catch (_) {
        placeCaretAtEnd(input);
      }
    });
  }

  function isFieldBeingEdited(field) {
    return field instanceof HTMLInputElement && document.activeElement === field;
  }

  function formatMoneyTypingValue(input) {
    if (!(input instanceof HTMLInputElement)) return;

    const rawValue = String(input.value || "");
    if (!rawValue.trim() || !hasMoneyDigits(rawValue)) {
      input.value = "";
      return;
    }

    input.value = sanitizeMoneyEditingValue(rawValue);
    placeCaretAtEnd(input);
  }

  function resolvePropertyDiscountPolicy(imovel = state.imovelSelecionado || {}) {
    const minimo = roundMoneyNumber(Math.max(parseMoney(firstFilled(imovel.valor_incentivo_minimo, imovel.valor_desconto_minimo, PROPERTY_DISCOUNT_DEFAULT_MIN)), 0));
    const maximoConfigurado = roundMoneyNumber(Math.max(parseMoney(firstFilled(imovel.valor_incentivo_maximo, imovel.valor_desconto_maximo, PROPERTY_DISCOUNT_LIMIT)), 0));
    const quantidade = Math.max(Math.floor(toNumber(firstFilled(
      imovel.quantidade_incentivo_reservas_vendas,
      imovel.quantidade_desconto_reservas_vendas,
      imovel.incentivo_7lm_quantidade_reservas_vendas,
      imovel.desconto_imovel_quantidade_reservas_vendas,
      imovel.quantidade_reservas_vendas,
      0
    ), 0)), 0);
    const reducaoCalculada = Math.floor(quantidade / PROPERTY_DISCOUNT_STEP_UNITS) * PROPERTY_DISCOUNT_STEP_VALUE;
    const reducao = roundMoneyNumber(Math.max(parseMoney(firstFilled(
      imovel.incentivo_7lm_reducao_por_reservas_vendas,
      imovel.desconto_imovel_reducao_por_reservas_vendas,
      reducaoCalculada
    )), 0));
    const maximoBackend = imovel.incentivo_7lm_maximo_efetivo ?? imovel.desconto_imovel_maximo_efetivo ?? imovel.desconto_maximo_efetivo;
    const maximoEfetivo = maximoBackend !== undefined && maximoBackend !== null && maximoBackend !== ""
      ? roundMoneyNumber(Math.max(parseMoney(maximoBackend), 0))
      : roundMoneyNumber(Math.max(0, maximoConfigurado - reducao));

    return {
      minimo,
      maximoConfigurado,
      maximoEfetivo,
      reducao,
      quantidade,
    };
  }

  function getPropertyDiscountLimit(imovel = state.imovelSelecionado || {}) {
    return resolvePropertyDiscountPolicy(imovel).maximoEfetivo;
  }

  function syncPropertyDiscountHint(imovel = state.imovelSelecionado || {}) {
    const hint = document.getElementById("simDescontoImovelHint");
    if (!hint) return;

    const policy = resolvePropertyDiscountPolicy(imovel);
    const partes = [`Até ${formatMoney(DISCOUNT_WITHOUT_APPROVAL_LIMIT)} sem aprovação`, `teto atual ${formatMoney(policy.maximoEfetivo)}`];
    if (policy.reducao > 0.01) {
      partes.push(`redução de ${formatMoney(policy.reducao)} por ${policy.quantidade} vendido(s), reservado(s) ou pendente(s) de aprovação`);
    }
    hint.textContent = partes.join("; ");
  }

  function getOperationValueLimit() {
    const valorImovel = parseMoney(state.imovelSelecionado?.valor || readValue(ids.valorImovel));
    const sobrepreco = parseMoney(readValue(ids.sobrepreco));
    const descontoImovel = Math.min(parseMoney(readValue(ids.descontoImovel)), getPropertyDiscountLimit());
    const total = roundMoneyNumber(valorImovel + sobrepreco - descontoImovel);
    return total > 0 ? total : 0;
  }

  function getEntryValueLimit() {
    const total = getOperationValueLimit();
    if (total <= 0) return null;

    const composicaoSemEntrada =
      getClientSimulationMoney("financiamento_caixa") +
      getClientSimulationMoney("fgts");

    return roundMoneyNumber(Math.max(total - composicaoSemEntrada, 0));
  }

  function getOverpriceField() {
    const field = document.getElementById(ids.sobrepreco);
    return field instanceof HTMLInputElement ? field : null;
  }

  function getPropertyDiscountField() {
    const field = document.getElementById(ids.descontoImovel);
    return field instanceof HTMLInputElement ? field : null;
  }

  function normalizePropertyDiscount({ notify = false, preserveCaret = false } = {}) {
    const field = getPropertyDiscountField();
    const rawValue = parseMoney(field ? field.value : readValue(ids.descontoImovel));
    const discountLimit = getPropertyDiscountLimit();
    const cappedValue = roundMoneyNumber(Math.min(Math.max(rawValue, 0), discountLimit));

    if (field && rawValue !== cappedValue) {
      field.value = cappedValue > 0 ? formatMoney(cappedValue) : "";
      if (preserveCaret) {
        placeCaretAtEnd(field);
      }
      if (notify && rawValue > discountLimit) {
        showFeedback("warning", `Incentivo 7LM limitado a ${formatMoney(discountLimit)}.`);
      }
    }

    syncPropertyDiscountHint();
    syncNegotiatedValueField();
    return cappedValue;
  }

  function resolveOperationValues(resumo = {}, imovel = state.imovelSelecionado || {}) {
    const imovelValorCadastrado = parseMoney(imovel?.valor);
    const valorImovel = roundMoneyNumber(parseMoney(firstFilled(
      imovelValorCadastrado > 0 ? imovelValorCadastrado : "",
      resumo.valor_imovel,
      readValue(ids.valorImovel),
      0
    )));
    const sobreprecoCampo = readValue(ids.sobrepreco);
    const descontoCampo = readValue(ids.descontoImovel);
    const sobrepreco = roundMoneyNumber(Math.max(parseMoney(
      hasMoneyDigits(sobreprecoCampo) ? sobreprecoCampo : firstFilled(resumo.sobrepreco, 0)
    ), 0));
    const valorBruto = roundMoneyNumber(Math.max(valorImovel + sobrepreco, 0));
    const descontoBase = parseMoney(
      hasMoneyDigits(descontoCampo) ? descontoCampo : firstFilled(resumo.incentivo_7lm, resumo.desconto_imovel, 0)
    );
    const desconto = roundMoneyNumber(Math.min(
      Math.max(descontoBase, 0),
      getPropertyDiscountLimit(imovel),
      valorBruto
    ));
    const valorNegociado = roundMoneyNumber(Math.max(valorBruto - desconto, 0));
    const campoComercialPreenchido = hasMoneyDigits(sobreprecoCampo) || hasMoneyDigits(descontoCampo);
    const valorTotalClienteResumo = roundMoneyNumber(parseMoney(firstFilled(
      resumo.total_considerado,
      resumo.valor_total_pago_cliente_exclui_incentivo,
      resumo.valor_total_pago_cliente,
      resumo.valor_total_cliente,
      ""
    )));
    const valorTotalCliente = valorTotalClienteResumo > 0
      ? valorTotalClienteResumo
      : (campoComercialPreenchido
        ? valorNegociado
        : roundMoneyNumber(parseMoney(firstFilled(
          resumo.valor_total_cliente,
          resumo.valor_total_operacao,
          valorNegociado
        ))));
    const valorLiquidoNegociacao = roundMoneyNumber(parseMoney(firstFilled(
      resumo.valor_liquido_negociacao,
      valorNegociado
    )));
    const crediturRetencao = roundMoneyNumber(parseMoney(firstFilled(resumo.creditur_retencao, 0)));

    return {
      valorImovel,
      sobrepreco,
      desconto,
      valorBruto,
      valorNegociado,
      valorTotalCliente,
      valorLiquidoNegociacao,
      crediturRetencao,
    };
  }

  function resolveComputedTotalPaidByClient(resumo = {}) {
    const captacaoInicialInformada = roundMoneyNumber(parseMoney(firstFilled(
      resumo.valor_fechamento_inicial,
      resumo.valor_garantido_real,
      resumo.garantido_real,
      0
    )));
    const captacaoInicial = captacaoInicialInformada > 0.01
      ? captacaoInicialInformada
      : roundMoneyNumber(
        parseMoney(resumo.financiamento_caixa || 0)
        + parseMoney(resumo.fgts || 0)
        + parseMoney(resumo.subsidio || 0)
        + parseMoney(resumo.entrada || 0)
      );
    const crediturAtivo = Boolean(
      resumo.creditur_ativo
      || parseMoney(resumo.creditur_retencao || 0) > 0.01
      || parseMoney(resumo.creditur_valor_financiado_pre_pos || 0) > 0.01
      || parseMoney(resumo.financiamento_7lm_pos_chaves || 0) > 0.01
    );

    if (crediturAtivo) {
      return roundMoneyNumber(
        captacaoInicial
        + parseMoney(resumo.creditur_valor_repassado_7lm || 0)
        + parseMoney(resumo.financiamento_7lm_pos_chaves || 0)
      );
    }

    if (captacaoInicial > 0.01 || parseMoney(resumo.pro_soluto_total || 0) > 0.01) {
      return roundMoneyNumber(captacaoInicial + parseMoney(resumo.pro_soluto_total || 0));
    }

    return 0;
  }

  function resolveTotalPaidByClient(resumo = {}, operacao = {}) {
    const totalPagoExplicito = firstFilled(
      resumo.total_considerado,
      resumo.valor_total_pago_cliente_exclui_incentivo,
      resumo.valor_total_pago_cliente,
      resumo.valor_total_cliente
    );
    const computedTotal = resolveComputedTotalPaidByClient(resumo);
    const explicitTotalNumber = totalPagoExplicito ? roundMoneyNumber(parseMoney(totalPagoExplicito)) : 0;
    const incentivo = parseMoney(firstFilled(resumo.incentivo_7lm, resumo.desconto_imovel, operacao.desconto, 0));

    if (
      computedTotal > 0.01
      && (
        !explicitTotalNumber
        || Math.abs(explicitTotalNumber - computedTotal) <= 0.01
        || Math.abs(explicitTotalNumber - (computedTotal + incentivo)) <= 0.01
      )
    ) {
      return computedTotal;
    }

    if (totalPagoExplicito) {
      return explicitTotalNumber;
    }

    const totalLegadoSemIncentivo = firstFilled(
      resumo.valor_total_pago_cliente_sem_incentivo,
      resumo.valor_total_pago_cliente_sem_desconto
    );
    if (totalLegadoSemIncentivo) {
      return roundMoneyNumber(parseMoney(totalLegadoSemIncentivo));
    }

    const totalClienteResumo = roundMoneyNumber(parseMoney(firstFilled(
      resumo.valor_total_cliente,
      operacao.valorTotalCliente,
      ""
    )));
    const valorOperacao = roundMoneyNumber(parseMoney(firstFilled(
      resumo.valor_total_operacao,
      operacao.valorNegociado,
      ""
    )));

    if (computedTotal > 0.01 && (!totalClienteResumo || Math.abs(totalClienteResumo - valorOperacao) <= 0.01)) {
      return computedTotal;
    }

    return roundMoneyNumber(parseMoney(firstFilled(
      resumo.valor_total_cliente,
      operacao.valorTotalCliente,
      operacao.valorNegociado,
      resumo.valor_total_cliente,
      resumo.valor_total_operacao,
      operacao.valorImovel,
      0
    )));
  }

  function resolvePropertyPaymentBalance(operacao = {}, totalPagoCliente = 0) {
    const valorReferencia = roundMoneyNumber(parseMoney(firstFilled(
      operacao.valorNegociado,
      operacao.valorImovel,
      0
    )));
    const totalPago = roundMoneyNumber(parseMoney(totalPagoCliente || 0));
    const diferenca = roundMoneyNumber(valorReferencia - totalPago);
    const valorAbsoluto = roundMoneyNumber(Math.abs(diferenca));

    if (diferenca > 0.01) {
      return {
        label: "Falta para o imóvel",
        value: formatMoney(valorAbsoluto),
        help: "diferença entre valor negociado e total considerado",
        direction: "faltante",
        amount: valorAbsoluto,
      };
    }

    if (diferenca < -0.01) {
      return {
        label: "Excesso",
        value: formatMoney(valorAbsoluto),
        help: "total considerado acima do valor negociado",
        direction: "acima",
        amount: valorAbsoluto,
      };
    }

    return {
      label: "Falta para o imóvel",
      value: formatMoney(0),
      help: "total considerado cobre o valor negociado",
      direction: "quitado",
      amount: 0,
    };
  }

  function resolveNegotiatedPaymentBalance(resumo = {}, operacao = {}, totalPagoCliente = 0) {
    const valorReferencia = roundMoneyNumber(parseMoney(firstFilled(
      resumo.valor_total_operacao,
      operacao.valorNegociado,
      0
    )));
    const totalPago = roundMoneyNumber(parseMoney(totalPagoCliente || 0));
    const diferencaCalculada = roundMoneyNumber(valorReferencia - totalPago);
    const diferencaExplicita = roundMoneyNumber(parseMoney(firstFilled(
      resumo.falta_para_valor_negociado,
      ""
    )));
    const excessoExplicito = roundMoneyNumber(parseMoney(firstFilled(
      resumo.excesso_valor_negociado,
      ""
    )));
    const diferenca = diferencaExplicita > 0.01
      ? diferencaExplicita
      : (excessoExplicito > 0.01 ? -excessoExplicito : diferencaCalculada);
    const valorAbsoluto = roundMoneyNumber(Math.abs(diferenca));

    if (diferenca > 0.01) {
      return {
        label: "Falta para valor negociado",
        value: formatMoney(valorAbsoluto),
        help: "diferença entre valor negociado e total considerado",
        direction: "faltante",
        amount: valorAbsoluto,
      };
    }

    if (diferenca < -0.01) {
      return {
        label: "Excesso",
        value: formatMoney(valorAbsoluto),
        help: "total considerado acima do valor negociado",
        direction: "acima",
        amount: valorAbsoluto,
      };
    }

    return {
      label: "Falta para valor negociado",
      value: formatMoney(0),
      help: "total considerado cobre o valor negociado",
      direction: "quitado",
      amount: 0,
    };
  }

  function resolveSuggestionCommercialValues(item = {}) {
    const imovel = item.imovel || item || {};
    const resumo = item.resumo_operacao || {};
    const valorImovel = roundMoneyNumber(parseMoney(firstFilled(
      resumo.valor_imovel,
      imovel.valor_original,
      imovel.valor,
      0
    )));
    const valorNegociado = roundMoneyNumber(parseMoney(firstFilled(
      resumo.valor_total_operacao,
      imovel.valor_total_operacao,
      imovel.valor_negociado,
      valorImovel
    )));
    const valorLiquidoNegociacao = roundMoneyNumber(parseMoney(firstFilled(
      resumo.valor_liquido_negociacao,
      imovel.valor_liquido_negociacao,
      valorNegociado
    )));
    const desconto = roundMoneyNumber(parseMoney(firstFilled(
      resumo.incentivo_7lm,
      resumo.desconto_imovel,
      imovel.incentivo_7lm,
      imovel.desconto_imovel,
      0
    )));
    const sobrepreco = roundMoneyNumber(parseMoney(firstFilled(
      resumo.sobrepreco,
      imovel.sobrepreco,
      0
    )));

    return {
      valorImovel,
      valorNegociado: valorNegociado > 0 ? valorNegociado : valorImovel,
      valorLiquidoNegociacao: valorLiquidoNegociacao > 0 ? valorLiquidoNegociacao : valorNegociado,
      desconto,
      sobrepreco,
      hasDiscount: desconto > 0.01,
      hasCommercialAdjustment: desconto > 0.01 || sobrepreco > 0.01 || Math.abs(valorNegociado - valorImovel) > 0.01,
    };
  }

  function getSuggestionRankingValue(item = {}) {
    return resolveSuggestionCommercialValues(item).valorNegociado;
  }

  function syncNegotiatedValueField(resumo = {}) {
    const field = document.getElementById(ids.valorNegociado);
    syncPropertyDiscountHint();
    if (!(field instanceof HTMLInputElement)) return;

    const { valorNegociado } = resolveOperationValues(resumo);
    field.value = valorNegociado > 0 ? formatMoney(valorNegociado) : "";
  }

  function setOverpriceFieldState(valor, { autoOverflow = 0, preserveCaret = false } = {}) {
    const field = getOverpriceField();
    if (!field) return;

    const normalizedValue = roundMoneyNumber(Math.max(parseMoney(valor), 0));
    const normalizedOverflow = roundMoneyNumber(Math.max(parseMoney(autoOverflow), 0));
    field.value = normalizedValue > 0 ? formatMoney(normalizedValue) : "";
    field.dataset.autoOverflow = String(normalizedOverflow);

    if (preserveCaret) {
      placeCaretAtEnd(field);
    }
    syncNegotiatedValueField();
  }

  function syncEntryOverflowToOverprice({ notify = false } = {}) {
    const entryField = document.getElementById(ids.entrada);
    if (!(entryField instanceof HTMLInputElement)) return parseMoney(readValue(ids.entrada));

    const entryValue = roundMoneyNumber(Math.max(parseMoney(entryField.value), 0));
    if (parseMoney(entryField.value) !== entryValue) {
      entryField.value = entryValue > 0 ? formatMoney(entryValue) : "";
      placeCaretAtEnd(entryField);
    }

    const overpriceField = getOverpriceField();
    if (overpriceField) {
      overpriceField.dataset.autoOverflow = "0";
    }

    syncNegotiatedValueField();
    return entryValue;
  }

  function normalizeBrokerRate(value, fallback = 0.05) {
    const number = Number(String(value ?? "").replace("%", "").replace(",", "."));
    if (!Number.isFinite(number) || number < 0) return fallback;
    return number > 1 ? number / 100 : number;
  }

  function parseBrokerRateInput(value, fallback = 0.05) {
    const number = Number(String(value ?? "").replace("%", "").replace(",", "."));
    if (!Number.isFinite(number) || number < 0) return fallback;
    return number / 100;
  }

  function formatBrokerRate(rate) {
    const percentage = Math.max(Number(rate || 0) * 100, 0);
    return `${percentage.toLocaleString("pt-BR", { minimumFractionDigits: percentage % 1 ? 1 : 0, maximumFractionDigits: 2 })}%`;
  }

  function normalizeBrokerOverpriceRule(raw = {}) {
    const sourceSuggestions = Array.isArray(raw.suggestions) ? raw.suggestions : DEFAULT_BROKER_OVERPRICE_SUGGESTIONS;
    const suggestions = DEFAULT_BROKER_OVERPRICE_SUGGESTIONS.map((fallback, index) => {
      const value = roundMoneyNumber(Math.max(parseMoney(sourceSuggestions[index]), 0));
      return value > 0 ? value : fallback;
    });

    const customTiers = Array.isArray(raw.tiers) ? raw.tiers : [];
    const tiers = DEFAULT_BROKER_OVERPRICE_TIERS.map((defaultTier) => {
      const customTier = customTiers.find((item) => Number(item?.operation) === defaultTier.operation) || {};
      const capRaw = customTier.cap ?? defaultTier.cap;
      const cap = capRaw === null || String(capRaw ?? "").trim() === ""
        ? null
        : roundMoneyNumber(Math.max(parseMoney(capRaw), 0));
      return {
        operation: defaultTier.operation,
        rate: normalizeBrokerRate(customTier.rate ?? defaultTier.rate, defaultTier.rate),
        cap: cap && cap > 0 ? cap : null,
        label: firstFilled(customTier.label, defaultTier.label),
      };
    });

    const overrideRaw = raw.operationCountOverride;
    const overrideNumber = Number(overrideRaw);
    const operationCountOverride = Number.isFinite(overrideNumber) && overrideNumber >= 0
      ? String(Math.floor(overrideNumber))
      : "";

    return { suggestions, tiers, operationCountOverride };
  }

  function loadBrokerOverpriceRule() {
    try {
      const parsed = JSON.parse(window.localStorage?.getItem(BROKER_OVERPRICE_RULE_STORAGE_KEY) || "{}");
      return normalizeBrokerOverpriceRule(parsed);
    } catch {
      return normalizeBrokerOverpriceRule();
    }
  }

  function saveBrokerOverpriceRule(rule) {
    state.sobreprecoRegra = normalizeBrokerOverpriceRule(rule);
    try {
      window.localStorage?.setItem(BROKER_OVERPRICE_RULE_STORAGE_KEY, JSON.stringify(state.sobreprecoRegra));
    } catch {
      // Persistência local é conveniência; a simulação segue funcionando sem ela.
    }
    return state.sobreprecoRegra;
  }

  function resetBrokerOverpriceRule() {
    state.sobreprecoRegra = normalizeBrokerOverpriceRule();
    try {
      window.localStorage?.removeItem(BROKER_OVERPRICE_RULE_STORAGE_KEY);
    } catch {
      // Sem ação necessária.
    }
    return state.sobreprecoRegra;
  }

  function getBrokerOverpriceRule() {
    if (!state.sobreprecoRegra) {
      state.sobreprecoRegra = loadBrokerOverpriceRule();
    }
    return state.sobreprecoRegra;
  }

  async function refreshBrokerOverpriceRuleFromServer({ render = false } = {}) {
    if (state.sobreprecoRegraPromise) return state.sobreprecoRegraPromise;
    state.sobreprecoRegraPromise = api(ENDPOINTS.remuneracaoSobrepreco, "GET")
      .then((payload) => {
        const rule = saveBrokerOverpriceRule(payload?.regra || payload || {});
        if (render) {
          renderSobreprecoOptions();
          renderSobreprecoRuleFields();
        }
        return rule;
      })
      .catch((error) => {
        console.warn("[SIMULADOR] Regra de remuneração usando cache local:", error);
        return getBrokerOverpriceRule();
      })
      .finally(() => {
        state.sobreprecoRegraPromise = null;
      });
    return state.sobreprecoRegraPromise;
  }

  function resolveBrokerOperationCount() {
    const rule = getBrokerOverpriceRule();
    if (String(rule.operationCountOverride || "").trim() !== "") {
      return Math.max(Math.floor(toNumber(rule.operationCountOverride, 0)), 0);
    }

    const user = state.user || {};
    return Math.max(Math.floor(toNumber(firstFilled(
      user.quantidade_reservas_vendas,
      user.reservas_vendas,
      user.reservas_vendas_corretor,
      user.reservas_ano_vigente,
      user.vendas_ano_vigente,
      user.total_reservas,
      user.total_vendas,
      user.metricas?.quantidade_reservas_vendas,
      user.metricas?.reservas_vendas,
      user.metricas?.reservas,
      user.metricas?.vendas,
      0
    ), 0)), 0);
  }

  function resolveBrokerOperationNumber() {
    return Math.min(resolveBrokerOperationCount() + 1, 3);
  }

  function resolveBrokerCommissionTier() {
    const operationNumber = resolveBrokerOperationNumber();
    const rule = getBrokerOverpriceRule();
    return rule.tiers.find((tier) => Number(tier.operation) === operationNumber)
      || rule.tiers[rule.tiers.length - 1]
      || DEFAULT_BROKER_OVERPRICE_TIERS[0];
  }

  function calculateBrokerOverpriceCommission(overprice, tier = resolveBrokerCommissionTier()) {
    const base = roundMoneyNumber(Math.max(parseMoney(overprice), 0));
    const calculated = roundMoneyNumber(base * Math.max(Number(tier.rate || 0), 0));
    const cap = tier.cap === null ? null : roundMoneyNumber(Math.max(parseMoney(tier.cap), 0));
    if (cap && cap > 0) return Math.min(calculated, cap);
    return calculated;
  }

  function renderSobreprecoRuleFields() {
    const rule = getBrokerOverpriceRule();
    const tier = resolveBrokerCommissionTier();
    document.querySelectorAll(".tl-sim-sobrepreco-suggestion-input").forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      const index = Number(input.dataset.sobreprecoSuggestion || "0");
      input.value = formatMoney(rule.suggestions[index] || DEFAULT_BROKER_OVERPRICE_SUGGESTIONS[index] || 0);
    });
    if (el.sobreprecoOperacoes) el.sobreprecoOperacoes.value = String(resolveBrokerOperationCount());
    if (el.sobreprecoComissaoPct) el.sobreprecoComissaoPct.value = String(Math.round((Number(tier.rate || 0) * 100) * 100) / 100);
    if (el.sobreprecoTetoComissao) el.sobreprecoTetoComissao.value = tier.cap ? formatMoney(tier.cap) : "";
  }

  function renderSobreprecoOptions() {
    if (!el.sobreprecoOpcoes) return;
    const rule = getBrokerOverpriceRule();
    const operationNumber = resolveBrokerOperationNumber();
    const tier = resolveBrokerCommissionTier();
    const capText = tier.cap ? `limitada a ${formatMoney(tier.cap)}` : "sem limite de teto";
    const imovel = state.sobreprecoContexto?.imovel || state.imovelSelecionado || {};
    const title = firstFilled(imovel.titulo, imovel.unidade, "unidade selecionada");

    if (el.sobreprecoResumo) {
      el.sobreprecoResumo.textContent = `${tier.label}: comissão de ${formatBrokerRate(tier.rate)} sobre o sobrepreço, ${capText}. Regra administrada no Cadastro > Remuneração.`;
    }

    el.sobreprecoOpcoes.innerHTML = rule.suggestions
      .map((value, index) => {
        const commission = calculateBrokerOverpriceCommission(value, tier);
        return `
          <button class="tl-sim-sobrepreco-option" type="button" data-sobrepreco-value="${escapeHtml(String(value))}">
            <span>Opção ${escapeHtml(String(index + 1))}</span>
            <strong>${escapeHtml(formatMoney(value))}</strong>
            <small>${escapeHtml(title)}</small>
            <em>Comissão estimada ${escapeHtml(formatMoney(commission))}</em>
          </button>`;
      })
      .join("");

    const operationLabel = operationNumber >= 3 ? "3ª Em Diante" : `${operationNumber}ª`;
    el.sobreprecoOpcoes.insertAdjacentHTML("beforeend", `
      <article class="tl-sim-sobrepreco-rule-card">
        <span>Regra Aplicada</span>
        <strong>${escapeHtml(operationLabel)} Operação</strong>
        <small>${escapeHtml(formatBrokerRate(tier.rate))} ${escapeHtml(capText)}</small>
      </article>`);
  }

  function openSobreprecoModal({ imovel = state.imovelSelecionado, suggestion = null } = {}) {
    if (!el.modalSobrepreco) return;
    state.sobreprecoContexto = {
      imovel: normalizePropertyForUi(imovel || {}),
      suggestion: suggestion || null,
    };
    if (el.sobreprecoManual) {
      const currentValue = getOverpriceField()?.value || "";
      el.sobreprecoManual.value = currentValue;
    }
    renderSobreprecoOptions();
    renderSobreprecoRuleFields();
    refreshBrokerOverpriceRuleFromServer({ render: true });
    el.modalSobrepreco.hidden = false;
    el.modalSobrepreco.setAttribute("aria-hidden", "false");
    syncModalLock();
    window.requestAnimationFrame(() => {
      el.sobreprecoOpcoes?.querySelector("button[data-sobrepreco-value]")?.focus?.();
    });
  }

  function closeSobreprecoModal() {
    if (!el.modalSobrepreco) return;
    el.modalSobrepreco.hidden = true;
    el.modalSobrepreco.setAttribute("aria-hidden", "true");
    state.sobreprecoContexto = null;
    syncModalLock();
  }

  function getInitialChoiceSourceSuggestions() {
    const visible = getVisibleSuggestions();
    const base = visible.length ? visible : state.sugestões;
    const unique = [];
    const seen = new Set();

    base.forEach((item) => {
      const id = String(item?.imovel?.id || item?.id || "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      unique.push(item);
    });

    const available = unique.filter((item) => normalizeStatus(item?.imovel?.status) === "disponivel");
    return available.length >= 3 ? available : (available.length ? available : unique);
  }

  function buildInitialPropertyChoiceOptions(items = getInitialChoiceSourceSuggestions()) {
    const ordered = items
      .map((item) => {
        const id = String(item?.imovel?.id || item?.id || "");
        const imovel = item?.imovel || item || {};
        const values = resolveSuggestionCommercialValues(item);
        const price = roundMoneyNumber(Math.max(
          parseMoney(values.valorNegociado || 0),
          parseMoney(values.valorImovel || 0),
          getPropertyPriceForFilter(imovel),
          parseMoney(imovel.valor_total_operacao || 0),
          parseMoney(imovel.valor_tabela || 0),
          parseMoney(imovel.preco || 0),
          parseMoney(item?.valor || 0)
        ));
        return { id, item, price };
      })
      .filter((entry) => entry.id)
      .sort((left, right) => right.price - left.price);

    if (!ordered.length) return [];
    if (ordered.length === 1) {
      return [{ role: "Sugestão Principal", tone: "balanced", item: ordered[0].item, price: ordered[0].price }];
    }

    const middleIndex = Math.floor((ordered.length - 1) / 2);
    const selected = [
      { role: "Mais Caro", tone: "premium", item: ordered[0].item, price: ordered[0].price },
      { role: "Intermediário", tone: "balanced", item: ordered[middleIndex].item, price: ordered[middleIndex].price },
      { role: "Mais Barato", tone: "economy", item: ordered[ordered.length - 1].item, price: ordered[ordered.length - 1].price },
    ];

    const deduped = [];
    const seen = new Set();
    selected.forEach((option) => {
      const id = String(option.item?.imovel?.id || option.item?.id || "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      deduped.push(option);
    });

    if (deduped.length === 2) {
      deduped[0].role = "Mais Caro";
      deduped[1].role = "Mais Barato";
    }

    return deduped.slice(0, 3);
  }

  function renderInitialPropertyChoiceOptions(options = state.escolhaImovelInicialOpcoes) {
    if (!el.escolhaImovelOpcoes) return;
    const count = options.length;
    if (el.escolhaImovelResumo) {
      el.escolhaImovelResumo.textContent = count >= 3
        ? "Escolha entre a opção mais cara, intermediária ou mais barata para iniciar a simulação."
        : "Escolha uma das opções encontradas para iniciar a simulação deste cliente.";
    }

    el.escolhaImovelOpcoes.innerHTML = options
      .map((option) => {
        const item = option.item || {};
        const imovel = item.imovel || item || {};
        const id = String(imovel.id || item.id || "");
        const { resumo } = resolveSuggestionSimulationContext({ suggestion: item, resumo: item.resumo_operacao || {} });
        const values = resolveSuggestionCommercialValues({ ...item, resumo_operacao: resumo });
        const photo = normalizeMediaPath(imovel.foto_principal);
        const localizacao = [imovel.cidade, imovel.bairro].filter(Boolean).join(" • ");
        const resumoImovel = [
          imovel.agrupamento?.unidade ? `Unidade ${imovel.agrupamento.unidade}` : "",
          imovel.agrupamento?.bloco ? `Bloco ${imovel.agrupamento.bloco}` : "",
          firstFilled(imovel.tipologia, imovel.tipo_imovel),
          imovel.area_m2 ? formatArea(imovel.area_m2) : "",
          toNumber(imovel.dormitorios || imovel.quartos, 0) > 0 ? `${toNumber(imovel.dormitorios || imovel.quartos, 0)} dorm.` : "",
        ].filter(Boolean).join(" • ");
        const entrega = imovel.data_entrega
          ? `Entrega ${formatDateLabel(imovel.data_entrega)}`
          : `Entrega ${toNumber(imovel.meses_pre_entrega ?? resumo.meses_pre_entrega ?? 36, 36)}m`;

        return `
          <button class="tl-sim-escolha-imovel-option" type="button" data-tone="${escapeHtml(option.tone)}" data-escolha-imovel-id="${escapeHtml(id)}">
            <span class="tl-sim-escolha-imovel-option__role">${escapeHtml(option.role)}</span>
            <span class="tl-sim-escolha-imovel-option__media">
              ${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(imovel.titulo || "Imóvel")}" />` : '<i>Sem foto cadastrada</i>'}
            </span>
            <span class="tl-sim-badge-row">
              ${buildClassificacaoBadge(getSuggestionBadgeValue(item))}
              ${buildAvailabilityBadge(imovel.status)}
            </span>
            <strong class="tl-sim-escolha-imovel-option__title">${escapeHtml(imovel.titulo || "Imóvel")}</strong>
            <small>${escapeHtml(firstFilled(localizacao, "Localização não informada"))}</small>
            <small>${escapeHtml(firstFilled(resumoImovel, "Dados do imóvel não informados"))}</small>
            <span class="tl-sim-escolha-imovel-option__price">${escapeHtml(formatMoney(values.valorNegociado || option.price))}</span>
            <span class="tl-sim-escolha-imovel-option__meta">
              <em>${escapeHtml(entrega)}</em>
              <em>Comp. ${escapeHtml(formatPercent(resumo.percentual_comprometimento || 0))}</em>
            </span>
            <span class="tl-sim-escolha-imovel-option__cta">Selecionar</span>
          </button>`;
      })
      .join("");
  }

  function openInitialPropertyChoiceModal(options = []) {
    if (!el.modalEscolhaImovel || !options.length) return false;
    state.escolhaImovelInicialMostrada = true;
    state.escolhaImovelInicialOpcoes = options;
    renderInitialPropertyChoiceOptions(options);
    el.modalEscolhaImovel.hidden = false;
    el.modalEscolhaImovel.setAttribute("aria-hidden", "false");
    syncModalLock();
    window.requestAnimationFrame(() => {
      el.escolhaImovelOpcoes?.querySelector("button[data-escolha-imovel-id]")?.focus?.();
    });
    return true;
  }

  function closeEscolhaImovelModal() {
    if (!el.modalEscolhaImovel) return;
    el.modalEscolhaImovel.hidden = true;
    el.modalEscolhaImovel.setAttribute("aria-hidden", "true");
    syncModalLock();
  }

  async function applyInitialPropertyChoice(id) {
    const targetId = String(id || "");
    const option = state.escolhaImovelInicialOpcoes.find((entry) => String(entry.item?.imovel?.id || entry.item?.id || "") === targetId);
    const suggestion = option?.item || findSuggestionById(targetId);
    if (!suggestion) {
      closeEscolhaImovelModal();
      showFeedback("warning", "Não foi possível localizar o imóvel escolhido. Atualize a vitrine e tente novamente.");
      return;
    }

    closeEscolhaImovelModal();
    await focusPropertyCandidate(suggestion, {
      silentFeedback: true,
      message: "Unidade escolhida no comparativo inicial.",
      promptSobrepreco: false,
    });

    if (state.clienteSelecionado?.id && state.imovelSelecionado?.id) {
      openSobreprecoModal({ imovel: state.imovelSelecionado, suggestion });
      showFeedback("info", `${option?.role || "Opção"} selecionada. Escolha uma sugestão de sobrepreço para calcular.`);
    }
  }

  async function applyBrokerOverprice(value) {
    const normalized = roundMoneyNumber(Math.max(parseMoney(value), 0));
    setOverpriceFieldState(normalized);
    syncNegotiatedValueField();
    closeSobreprecoModal();
    const baseMessage = normalized > 0 ? `Sobrepreço de ${formatMoney(normalized)} aplicado.` : "Simulação mantida sem sobrepreço.";
    if (!state.clienteSelecionado?.id || !state.imovelSelecionado?.id) {
      showFeedback(normalized > 0 ? "success" : "info", baseMessage);
      return;
    }

    try {
      const calculated = await runCalculation({ silent: true });
      if (calculated === false || !state.simulacaoAtual) {
        showFeedback(
          normalized > 0 ? "success" : "info",
          isCrediturGeralSelected()
            ? `${baseMessage} Importe o PDF da Creditú para calcular a proposta.`
            : baseMessage
        );
        return;
      }
      showFeedback(normalized > 0 ? "success" : "info", `${baseMessage} Simulação calculada.`);
    } catch (error) {
      showFeedback("warning", messageFromError(error, `${baseMessage} Revise os parâmetros antes de recalcular.`));
    }
  }

  function applyBrokerOverpriceSafely(value) {
    applyBrokerOverprice(value).catch((error) => {
      showFeedback("warning", messageFromError(error, "Não foi possível aplicar o sobrepreço."));
    });
  }

  function updateBrokerOverpriceRuleFromForm() {
    const currentRule = getBrokerOverpriceRule();
    const suggestions = DEFAULT_BROKER_OVERPRICE_SUGGESTIONS.map((fallback, index) => {
      const input = document.querySelector(`.tl-sim-sobrepreco-suggestion-input[data-sobrepreco-suggestion="${index}"]`);
      const value = input instanceof HTMLInputElement ? roundMoneyNumber(Math.max(parseMoney(input.value), 0)) : 0;
      return value > 0 ? value : fallback;
    });
    const operationCountOverride = el.sobreprecoOperacoes
      ? String(Math.max(Math.floor(toNumber(el.sobreprecoOperacoes.value, 0)), 0))
      : currentRule.operationCountOverride;
    const operationNumber = Math.min(Math.max(Math.floor(toNumber(operationCountOverride, 0)) + 1, 1), 3);
    const activeTier = currentRule.tiers.find((tier) => Number(tier.operation) === operationNumber) || resolveBrokerCommissionTier();
    const rate = el.sobreprecoComissaoPct
      ? parseBrokerRateInput(el.sobreprecoComissaoPct.value, activeTier.rate)
      : activeTier.rate;
    const capValue = el.sobreprecoTetoComissao && String(el.sobreprecoTetoComissao.value || "").trim()
      ? roundMoneyNumber(Math.max(parseMoney(el.sobreprecoTetoComissao.value), 0))
      : null;
    const tiers = currentRule.tiers.map((tier) => Number(tier.operation) === operationNumber
      ? { ...tier, rate, cap: capValue && capValue > 0 ? capValue : null }
      : tier);

    saveBrokerOverpriceRule({ suggestions, tiers, operationCountOverride });
    renderSobreprecoOptions();
    renderSobreprecoRuleFields();
    showFeedback("success", "Regra de sobrepreço atualizada para esta estação.");
  }

  function clampEntryToOperationLimit({ notify = false } = {}) {
    return syncEntryOverflowToOverprice({ notify });
  }

  function resolveEntryOverflowWarning(resumo = {}) {
    const resumoOverflow = roundMoneyNumber(Math.max(parseMoney(resumo.entrada_excedente_valor_negociado || 0), 0));
    const autoOverflow = roundMoneyNumber(Math.max(parseMoney(getOverpriceField()?.dataset.autoOverflow || 0), 0));
    const overflow = Math.max(resumoOverflow, autoOverflow);
    if (overflow <= 0.01) return "";

    const limiteEntrada = parseMoney(resumo.entrada_limite_valor_negociado || 0);
    const complemento = limiteEntrada > 0.01
      ? ` Entrada considerada no cálculo: ${formatMoney(limiteEntrada)}.`
      : "";
    return `Entrada/sinal informado excede o valor negociado em ${formatMoney(overflow)}.${complemento} Ajuste a entrada para vender sem divergência.`;
  }

  function formatCpf(value) {
    const digits = digitsOnly(value).slice(0, 11);
    return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function formatPercent(value) {
    const raw = Number(value || 0);
    if (!Number.isFinite(raw)) return "0,00%";
    const percentage = Math.abs(raw) <= 1.5 ? raw * 100 : raw;
    return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(percentage)}%`;
  }

  function percentToFactor(value) {
    const raw = Number(value || 0);
    if (!Number.isFinite(raw)) return 0;
    return Math.abs(raw) <= 1.5 ? raw : raw / 100;
  }

  function resolveValorFechamento(resumo = {}) {
    const direto = firstFilled(resumo.valor_fechamento_inicial, resumo.valor_fechamento, resumo.estrutura_inicial);
    if (direto) return parseMoney(direto);

    const composicaoInicial = ["entrada", "financiamento_caixa", "fgts"]
      .reduce((total, key) => total + parseMoney(resumo[key] || 0), 0);
    if (composicaoInicial > 0) return composicaoInicial;

    const valorTotal = parseMoney(resumo.valor_total_operacao || 0);
    if (firstFilled(resumo.pro_soluto_total) && valorTotal > 0) {
      return Math.max(valorTotal - parseMoney(resumo.pro_soluto_total), 0);
    }
    return valorTotal * percentToFactor(resumo.percentual_fechamento_inicial);
  }

  function resolveValorEntregaChaves(resumo = {}) {
    const direto = firstFilled(resumo.valor_projetado_entrega, resumo.valor_entrega_chaves, resumo.total_projetado_entrega);
    if (direto) return parseMoney(direto);

    const valorTotal = parseMoney(resumo.valor_total_operacao || 0);
    if (firstFilled(resumo.saldo_pos_entrega) && valorTotal > 0) {
      return Math.max(valorTotal - parseMoney(resumo.saldo_pos_entrega), 0);
    }
    return valorTotal * percentToFactor(resumo.percentual_projetado_entrega);
  }

  function resolveGuaranteedValue(data = {}, fallbackValue = null) {
    const direto = firstFilled(data.valor_garantido_planejado, data.valor_garantido, fallbackValue);
    const valorDireto = parseMoney(direto || 0);
    if (valorDireto > 0) return valorDireto;

    const valorBase = parseMoney(firstFilled(data.valor_imovel, data.valor, 0));
    const percentual = firstFilled(data.percentual_fechamento_minimo, 0.7);
    if (valorBase > 0) {
      return parseMoney(valorBase * percentToFactor(percentual));
    }

    return 0;
  }

  function resolvePlannedDeliveryCaptureValue(data = {}, fallbackValue = null) {
    const direto = firstFilled(data.valor_garantido_pre_obra_planejado, fallbackValue);
    const valorDireto = parseMoney(direto || 0);
    if (valorDireto > 0) return valorDireto;

    const valorBase = parseMoney(firstFilled(data.valor_imovel, data.valor, 0));
    const percentual = firstFilled(data.percentual_captacao_ate_entrega, 0);
    if (valorBase > 0) {
      return parseMoney(valorBase * percentToFactor(percentual));
    }

    return 0;
  }

  function resolveDeliveryCapturePercent(data = {}, fallbackValue = null) {
    const direto = firstFilled(data.percentual_captacao_ate_entrega, fallbackValue);
    const percentualDireto = decimalInputToNumber(direto);
    if (Number.isFinite(percentualDireto) && percentualDireto > 0) {
      return percentToFactor(percentualDireto);
    }

    const valorBase = parseMoney(firstFilled(data.valor_imovel, data.valor, 0));
    const valorPlanejado = resolvePlannedDeliveryCaptureValue(data);
    if (valorBase > 0 && valorPlanejado > 0) {
      return valorPlanejado / valorBase;
    }

    return 0;
  }

  function resolveMinimumPreWorkValue(data = {}, fallbackValue = null) {
    const direto = firstFilled(data.valor_parcela_minima_pre_obra, fallbackValue);
    return parseMoney(direto || 0);
  }

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function formatIsoDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseIsoDate(value) {
    const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (Number.isNaN(date.getTime())) return null;
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
    return date;
  }

  function parseManualDate(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const iso = parseIsoDate(text);
    if (iso) return iso;

    const compact = text.replace(/\D/g, "");
    const match = compact.length === 8
      ? compact.match(/^(\d{2})(\d{2})(\d{4})$/)
      : text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (!match) return null;

    const [, day, month, year] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (Number.isNaN(date.getTime())) return null;
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
    return date;
  }

  function maskManualDateValue(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  function addMonthsDate(baseDate, months) {
    const base = baseDate instanceof Date && !Number.isNaN(baseDate.getTime()) ? baseDate : new Date();
    const target = new Date(base.getFullYear(), base.getMonth() + Math.max(0, Number(months) || 0), 1);
    const day = Math.min(base.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate());
    target.setDate(day);
    target.setHours(0, 0, 0, 0);
    return target;
  }

  function contractDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  function timelineMinDate() {
    return formatIsoDate(contractDate());
  }

  function timelineMaxDate() {
    return formatIsoDate(addMonthsDate(contractDate(), MAX_TOTAL_TIMELINE_MONTHS));
  }

  function clampTimelineDate(value, fallbackMonth = 1, maxOverride = "") {
    const min = timelineMinDate();
    const max = maxOverride || timelineMaxDate();
    const fallback = formatIsoDate(addMonthsDate(contractDate(), clamp(fallbackMonth, 0, MAX_TOTAL_TIMELINE_MONTHS)));
    const raw = String(value || "").trim() || fallback;
    if (!parseIsoDate(raw)) return fallback;
    if (raw < min) return min;
    if (raw > max) return max;
    return raw;
  }

  function clampDateFromToday(value, fallbackMonth = 1) {
    const min = timelineMinDate();
    const fallback = formatIsoDate(addMonthsDate(contractDate(), Math.max(0, Number(fallbackMonth) || 0)));
    const raw = String(value || "").trim() || fallback;
    if (!parseIsoDate(raw)) return fallback;
    if (raw < min) return min;
    return raw;
  }

  function getIntermediaryDefaultDate(index, total) {
    const entrega = resolvePropertyDelivery(state.imovelSelecionado);
    const mesesReferencia = clamp(entrega.mesesPreEntrega || DEFAULT_PROPERTY_DELIVERY_MONTHS, 1, MAX_TOTAL_TIMELINE_MONTHS);
    const mesPadrao = Math.max(1, Math.round(((index + 1) * mesesReferencia) / (Math.max(total, 1) + 1)));
    return {
      mesPadrao,
      data: clampDateFromToday("", mesPadrao),
    };
  }

  function collectIntermediaryItems({ normalize = true } = {}) {
    const container = document.getElementById(ids.intermediariaDatas);
    if (!container) return [];
    const rows = Array.from(container.querySelectorAll("[data-intermediaria-row]"));
    const baseValue = roundMoneyNumber(parseMoney(readValue(ids.intermediariaValor)));
    return rows.map((row, index) => {
      const valueInput = row.querySelector("input[data-intermediaria-value]");
      const dateInput = row.querySelector("input[data-intermediaria-date]");
      const defaultDate = getIntermediaryDefaultDate(index, Math.max(rows.length, 1));
      const valorInformado = roundMoneyNumber(parseMoney(valueInput?.value || 0));
      const valor = valorInformado > 0 ? valorInformado : baseValue;
      const data = normalize
        ? clampDateFromToday(dateInput?.value, defaultDate.mesPadrao)
        : String(dateInput?.value || "").trim();
      return { valor, data };
    }).filter((item) => item.valor > 0);
  }

  function collectIntermediaryDates() {
    return collectIntermediaryItems().map((item) => item.data).filter(Boolean);
  }

  function syncIntermediaryQuantityFromRows() {
    const container = document.getElementById(ids.intermediariaDatas);
    const qtyField = document.getElementById(ids.intermediariaQtd);
    if (!container || !(qtyField instanceof HTMLInputElement)) return;
    qtyField.value = String(container.querySelectorAll("[data-intermediaria-row]").length);
  }

  function renumberIntermediaryRows() {
    const container = document.getElementById(ids.intermediariaDatas);
    if (!container) return;
    const rows = Array.from(container.querySelectorAll("[data-intermediaria-row]"));
    rows.forEach((row, index) => {
      row.dataset.intermediariaRow = String(index + 1);
      const caption = row.querySelector("[data-intermediaria-caption]");
      if (caption) caption.textContent = String(index + 1);
      const dateInput = row.querySelector("input[data-intermediaria-date]");
      if (dateInput) dateInput.dataset.intermediariaDate = String(index + 1);
      const valueInput = row.querySelector("input[data-intermediaria-value]");
      if (valueInput) valueInput.dataset.intermediariaValue = String(index + 1);
    });
    syncIntermediaryQuantityFromRows();
  }

  function renderIntermediaryDateFields({ preserve = true } = {}) {
    const container = document.getElementById(ids.intermediariaDatas);
    const qtyField = document.getElementById(ids.intermediariaQtd);
    if (!container || !(qtyField instanceof HTMLInputElement)) return;

    const previous = preserve ? collectIntermediaryItems({ normalize: false }) : [];
    const baseValue = normalizeMinimumInstallmentField(ids.intermediariaValor);
    const qtd = clamp(toNumber(qtyField.value, 0), 0, 24);
    qtyField.value = String(qtd);
    container.innerHTML = "";
    if (qtd <= 0) return;

    const min = timelineMinDate();
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < qtd; index += 1) {
      const previousItem = previous[index] || {};
      const defaultDate = getIntermediaryDefaultDate(index, qtd);
      const wrapper = document.createElement("div");
      wrapper.className = "tl-sim-date-item tl-sim-intermediary-item";
      wrapper.dataset.intermediariaRow = String(index + 1);

      const caption = document.createElement("span");
      caption.dataset.intermediariaCaption = "true";
      caption.textContent = String(index + 1);

      const valueInput = document.createElement("input");
      valueInput.type = "text";
      valueInput.placeholder = "R$ 0,00";
      valueInput.inputMode = "decimal";
      valueInput.autocomplete = "off";
      valueInput.dataset.intermediariaValue = String(index + 1);
      const valor = roundMoneyNumber(parseMoney(firstFilled(previousItem.valor, baseValue, 0)));
      valueInput.value = valor > 0 ? formatMoney(valor) : "";
      valueInput.addEventListener("input", () => {
        formatMoneyTypingValue(valueInput);
        scheduleSimulationRecalculation();
      });
      valueInput.addEventListener("blur", () => {
        const valorAtual = parseMoney(valueInput.value);
        valueInput.value = valorAtual > 0 ? formatMoney(valorAtual) : "";
        scheduleSimulationRecalculation(120);
      });
      valueInput.addEventListener("focus", () => {
        valueInput.value = formatMoneyEditingValue(valueInput.value);
        selectAllText(valueInput);
      });

      const dateInput = document.createElement("input");
      dateInput.type = "date";
      dateInput.min = min;
      dateInput.max = "";
      dateInput.dataset.intermediariaDate = String(index + 1);
      dateInput.value = clampDateFromToday(previousItem.data, defaultDate.mesPadrao);
      dateInput.addEventListener("change", () => {
        dateInput.value = clampDateFromToday(dateInput.value, defaultDate.mesPadrao);
        scheduleSimulationRecalculation(120);
      });

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "tl-imoveis-btn tl-imoveis-btn--ghost tl-sim-intermediary-remove";
      removeButton.textContent = "Remover";
      removeButton.addEventListener("click", () => {
        wrapper.remove();
        renumberIntermediaryRows();
        scheduleSimulationRecalculation(120);
      });

      wrapper.append(caption, valueInput, dateInput, removeButton);
      fragment.append(wrapper);
    }

    container.append(fragment);
    enableCustomDatePickers(container);
  }

  function normalizeCrediturSemestreValue(value) {
    const semestre = clamp(toNumber(value, 1), 1, 17);
    return semestre;
  }

  function getCrediturTotalConfiguredMonths() {
    return CREDITUR_TOTAL_MAX_MONTHS;
  }

  function getCrediturConfiguredPreMonths() {
    return normalizePreDeliveryMonths(readValue(ids.mesesPre), CREDITUR_PRE_DEFAULT_MONTHS);
  }

  function getCrediturConfiguredPostMonths() {
    return getAvailablePostDeliveryMonths(getCrediturConfiguredPreMonths());
  }

  function setCrediturConfiguredPreMonths(value) {
    const mesesPre = normalizePreDeliveryMonths(value, CREDITUR_PRE_DEFAULT_MONTHS);
    const mesesPos = getAvailablePostDeliveryMonths(mesesPre);
    setValue(ids.mesesPre, String(mesesPre));
    setValue(ids.mesesPos, String(mesesPos));
    if (state.imovelSelecionado) {
      state.imovelSelecionado.meses_pre_entrega = mesesPre;
      state.imovelSelecionado.meses_pos_entrega = mesesPos;
      state.imovelSelecionado.meses_pos_entrega_configurado = mesesPos;
    }
    return { mesesPre, mesesPos };
  }

  function normalizeCrediturPhase(value) {
    const text = normalizeSearch(value);
    return text.includes("pos") ? CREDITUR_PHASE_POST : CREDITUR_PHASE_PRE;
  }

  function getCrediturPhaseMax(phase) {
    return normalizeCrediturPhase(phase) === CREDITUR_PHASE_POST
      ? Math.max(getCrediturConfiguredPostMonths(), 0)
      : getCrediturConfiguredPreMonths();
  }

  function crediturPhaseLabel(phase) {
    return normalizeCrediturPhase(phase) === CREDITUR_PHASE_POST ? "7LM" : "Creditú";
  }

  function getCrediturDefaultInterval() {
    return {
      fase: CREDITUR_PHASE_PRE,
      parcela_inicio: 1,
      parcela_fim: getCrediturConfiguredPreMonths(),
      valor: "",
    };
  }

  function buildCrediturIntervalsFromMonthlyFields() {
    const total = getCrediturTotalConfiguredMonths();
    const mesesPre = getCrediturConfiguredPreMonths();
    const preValue = parseMoney(readValue(ids.preObraValor));
    const posValue = parseMoney(readValue(ids.posObraValor));
    const intervals = [
      {
        fase: CREDITUR_PHASE_PRE,
        parcela_inicio: 1,
        parcela_fim: mesesPre,
        valor: preValue > 0 ? formatMoney(Math.max(preValue, MIN_CLIENT_INSTALLMENT)) : "",
      },
    ];

    if (total > mesesPre) {
      intervals.push({
        fase: CREDITUR_PHASE_POST,
        parcela_inicio: 1,
        parcela_fim: total - mesesPre,
        valor: posValue > 0 ? formatMoney(Math.max(posValue, MIN_CLIENT_INSTALLMENT)) : "",
      });
    }

    return intervals;
  }

  function normalizeCrediturParcelNumber(value, fallback = 1, maximo = getCrediturTotalConfiguredMonths()) {
    return clamp(toNumber(value, fallback), 1, Math.max(1, maximo));
  }

  function splitCrediturGlobalInterval(inicioGlobal, fimGlobal, valor) {
    const mesesPre = getCrediturConfiguredPreMonths();
    const mesesPos = getCrediturConfiguredPostMonths();
    const output = [];
    const inicio = normalizeCrediturParcelNumber(inicioGlobal, 1, getCrediturTotalConfiguredMonths());
    const fim = normalizeCrediturParcelNumber(fimGlobal, inicio, getCrediturTotalConfiguredMonths());
    const start = Math.min(inicio, fim);
    const end = Math.max(inicio, fim);

    if (start <= mesesPre) {
      output.push({
        fase: CREDITUR_PHASE_PRE,
        parcela_inicio: start,
        parcela_fim: Math.min(end, mesesPre),
        valor,
      });
    }

    if (end > mesesPre && mesesPos > 0) {
      output.push({
        fase: CREDITUR_PHASE_POST,
        parcela_inicio: Math.max(start, mesesPre + 1) - mesesPre,
        parcela_fim: Math.min(end, mesesPre + mesesPos) - mesesPre,
        valor,
      });
    }

    return output.length ? output : [getCrediturDefaultInterval()];
  }

  function normalizeCrediturIntervalItems(item = {}, index = 0, total = getCrediturTotalConfiguredMonths()) {
    const fallback = getCrediturDefaultInterval();
    const hasPhase = item.fase !== undefined || item.phase !== undefined || item.etapa !== undefined || item.tipo_fase !== undefined;
    const fase = normalizeCrediturPhase(firstFilled(item.fase, item.phase, item.etapa, item.tipo_fase, fallback.fase));
    const phaseMax = getCrediturPhaseMax(fase);
    const hasIntervalStart = item.parcela_inicio !== undefined || item.inicio !== undefined || item.de !== undefined || item.parcela_de !== undefined;
    const hasIntervalEnd = item.parcela_fim !== undefined || item.fim !== undefined || item.ate !== undefined || item.parcela_ate !== undefined;
    const legacyStart = item.semestre !== undefined
      ? ((normalizeCrediturSemestreValue(item.semestre) - 1) * 6) + 1
      : null;
    const valor = parseMoney(item.valor);

    if (hasPhase) {
      let inicio = normalizeCrediturParcelNumber(
        hasIntervalStart
          ? firstFilled(item.parcela_inicio, item.inicio, item.de, item.parcela_de)
          : fallback.parcela_inicio,
        fallback.parcela_inicio,
        phaseMax
      );
      let fim = normalizeCrediturParcelNumber(
        hasIntervalEnd
          ? firstFilled(item.parcela_fim, item.fim, item.ate, item.parcela_ate)
          : fallback.parcela_fim,
        fallback.parcela_fim,
        phaseMax
      );
      if (fim < inicio) {
        [inicio, fim] = [fim, inicio];
      }
      return [{
        fase,
        parcela_inicio: inicio,
        parcela_fim: fim,
        valor: valor > 0 ? formatMoney(valor) : "",
      }];
    }

    let inicioGlobal = normalizeCrediturParcelNumber(
      hasIntervalStart
        ? firstFilled(item.parcela_inicio, item.inicio, item.de, item.parcela_de)
        : firstFilled(legacyStart, index === 0 ? fallback.parcela_inicio : fallback.parcela_fim + 1),
      index === 0 ? fallback.parcela_inicio : fallback.parcela_fim + 1,
      total
    );
    let fimGlobal = normalizeCrediturParcelNumber(
      hasIntervalEnd
        ? firstFilled(item.parcela_fim, item.fim, item.ate, item.parcela_ate)
        : firstFilled(legacyStart ? total : null, item.parcela_fim, fallback.parcela_fim),
      fallback.parcela_fim,
      total
    );
    const valorFormatado = valor > 0 ? formatMoney(valor) : "";
    return splitCrediturGlobalInterval(inicioGlobal, fimGlobal, valorFormatado);
  }

  function normalizeCrediturIntervalList(items = []) {
    const rawItems = Array.isArray(items) ? items.filter((item) => item && typeof item === "object") : [];
    if (!rawItems.length) return [getCrediturDefaultInterval()];

    const total = getCrediturTotalConfiguredMonths();
    const hasOnlyLegacySteps = rawItems.every((item) => (
      item.semestre !== undefined
      && item.parcela_inicio === undefined
      && item.inicio === undefined
      && item.de === undefined
      && item.parcela_de === undefined
      && item.parcela_fim === undefined
      && item.fim === undefined
      && item.ate === undefined
      && item.parcela_ate === undefined
    ));

    if (hasOnlyLegacySteps) {
      const steps = rawItems
        .map((item) => ({
          parcela_inicio: normalizeCrediturParcelNumber(((normalizeCrediturSemestreValue(item.semestre) - 1) * 6) + 1, 1, total),
          valor: parseMoney(item.valor),
        }))
        .filter((item) => item.valor > 0)
        .sort((a, b) => a.parcela_inicio - b.parcela_inicio);

      const legacyItems = steps.length
        ? steps.flatMap((item, index) => normalizeCrediturIntervalItems({
          parcela_inicio: item.parcela_inicio,
          parcela_fim: index + 1 < steps.length ? Math.max(item.parcela_inicio, steps[index + 1].parcela_inicio - 1) : total,
          valor: formatMoney(item.valor),
        }, index, total))
        : [getCrediturDefaultInterval()];
      return consolidateCrediturIntervalList(legacyItems);
    }

    return consolidateCrediturIntervalList(rawItems
      .flatMap((item, index) => normalizeCrediturIntervalItems(item, index, total))
      .sort((a, b) => (
        (normalizeCrediturPhase(a.fase) === CREDITUR_PHASE_POST ? 1 : 0)
        - (normalizeCrediturPhase(b.fase) === CREDITUR_PHASE_POST ? 1 : 0)
        || a.parcela_inicio - b.parcela_inicio
        || a.parcela_fim - b.parcela_fim
      )));
  }

  function getCrediturAdjustedIntervalsFromResult(resultado = {}) {
    const resumo = resultado?.resumo_operacao || {};
    const adjusted = Array.isArray(resumo.creditur_intervalos_parcelas_ajustados)
      ? resumo.creditur_intervalos_parcelas_ajustados
      : [];
    if (adjusted.length) return adjusted;
    return Array.isArray(resumo.creditur_intervalos_parcelas) ? resumo.creditur_intervalos_parcelas : [];
  }

  function buildCrediturDisplayIntervalsFromAdjusted(intervals = []) {
    const mesesPre = getCrediturConfiguredPreMonths();
    const total = getCrediturTotalConfiguredMonths();
    let totalPre = 0;
    const postRows = [];

    (Array.isArray(intervals) ? intervals : []).forEach((item) => {
      const inicio = normalizeCrediturParcelNumber(item?.parcela_inicio, 1, total);
      const fim = normalizeCrediturParcelNumber(item?.parcela_fim, inicio, total);
      const start = Math.min(inicio, fim);
      const end = Math.max(inicio, fim);
      const valor = parseMoney(item?.valor || 0);
      if (valor <= 0) return;

      const preStart = Math.max(start, 1);
      const preEnd = Math.min(end, mesesPre);
      if (preEnd >= preStart) {
        totalPre = roundMoneyNumber(totalPre + ((preEnd - preStart + 1) * valor));
      }

      const postStart = Math.max(start, mesesPre + 1);
      const postEnd = Math.min(end, total);
      if (postEnd >= postStart) {
        postRows.push({
          parcela_inicio: postStart,
          parcela_fim: postEnd,
          valor: formatMoney(valor),
        });
      }
    });

    return [
      {
        fase: CREDITUR_PHASE_PRE,
        parcela_inicio: 1,
        parcela_fim: mesesPre,
        valor: totalPre > 0 ? formatMoney(totalPre / mesesPre) : "",
      },
      ...postRows,
    ];
  }

  function applyCrediturAdjustedIntervalsFromResult(resultado = {}) {
    if (!isCrediturSelected()) return;
    const adjusted = getCrediturAdjustedIntervalsFromResult(resultado);
    if (!adjusted.length) return;
    const currentEmptyPostRows = collectCrediturSemestres({ includeEmpty: true })
      .filter((item) => normalizeCrediturPhase(item.fase) === CREDITUR_PHASE_POST && parseMoney(item.valor) <= 0);
    state.crediturSemestres = normalizeCrediturIntervalList([
      ...buildCrediturDisplayIntervalsFromAdjusted(adjusted),
      ...currentEmptyPostRows,
    ]);
    renderCrediturSemestres({ preserve: false });
  }

  function consolidateCrediturIntervalList(items = []) {
    const mesesPre = getCrediturConfiguredPreMonths();
    const mesesPos = getCrediturConfiguredPostMonths();
    const preCandidate = items.find((item) => normalizeCrediturPhase(item.fase) === CREDITUR_PHASE_PRE && parseMoney(item.valor) > 0)
      || items.find((item) => normalizeCrediturPhase(item.fase) === CREDITUR_PHASE_PRE)
      || getCrediturDefaultInterval();
    const preRow = {
      fase: CREDITUR_PHASE_PRE,
      parcela_inicio: 1,
      parcela_fim: mesesPre,
      valor: preCandidate?.valor ? formatMoney(parseMoney(preCandidate.valor)) : "",
    };

    const postRows = items
      .filter((item) => normalizeCrediturPhase(item.fase) === CREDITUR_PHASE_POST)
      .filter(() => mesesPos > 0)
      .map((item) => {
        let inicio = normalizeCrediturParcelNumber(item.parcela_inicio, 1, mesesPos);
        let fim = normalizeCrediturParcelNumber(item.parcela_fim, inicio, mesesPos);
        if (fim < inicio) {
          [inicio, fim] = [fim, inicio];
        }
        return {
          fase: CREDITUR_PHASE_POST,
          parcela_inicio: inicio,
          parcela_fim: fim,
          valor: parseMoney(item.valor) > 0 ? formatMoney(parseMoney(item.valor)) : "",
        };
      })
      .sort((a, b) => a.parcela_inicio - b.parcela_inicio || a.parcela_fim - b.parcela_fim);

    return [preRow, ...postRows];
  }

  function normalizeCrediturIntervalCoverage(items = []) {
    const normalizedItems = normalizeCrediturIntervalList(items)
      .filter((item) => parseMoney(item.valor) > 0)
      .sort((a, b) => (
        (normalizeCrediturPhase(a.fase) === CREDITUR_PHASE_POST ? 1 : 0)
        - (normalizeCrediturPhase(b.fase) === CREDITUR_PHASE_POST ? 1 : 0)
        || a.parcela_inicio - b.parcela_inicio
        || a.parcela_fim - b.parcela_fim
      ));

    const used = new Set();
    const output = [];
    normalizedItems.forEach((item) => {
      const fase = normalizeCrediturPhase(item.fase);
      const phaseMax = getCrediturPhaseMax(fase);
      if (fase === CREDITUR_PHASE_POST && phaseMax <= 0) return;
      const inicio = normalizeCrediturParcelNumber(item.parcela_inicio, 1, phaseMax);
      const fim = normalizeCrediturParcelNumber(item.parcela_fim, inicio, phaseMax);
      const start = Math.min(inicio, fim);
      const end = Math.max(inicio, fim);
      const valor = formatMoney(parseMoney(item.valor));
      let sequence = [];
      const flushSequence = () => {
        if (!sequence.length) return;
        output.push({
          fase,
          parcela_inicio: sequence[0],
          parcela_fim: sequence[sequence.length - 1],
          valor,
        });
        sequence = [];
      };

      for (let parcela = start; parcela <= end; parcela += 1) {
        const key = `${fase}:${parcela}`;
        if (used.has(key)) {
          flushSequence();
          continue;
        }
        used.add(key);
        sequence.push(parcela);
      }
      flushSequence();
    });

    return output;
  }

  function collectCrediturSemestres({ normalize = false, includeEmpty = false } = {}) {
    if (!isCrediturSelected() || !el.crediturSemestres) return [];
    const rows = Array.from(el.crediturSemestres.querySelectorAll("[data-creditur-row]"));
    return rows
      .map((row) => {
        const faseInput = row.querySelector("[data-creditur-field='fase']");
        const inicioInput = row.querySelector("[data-creditur-field='inicio']");
        const fimInput = row.querySelector("[data-creditur-field='fim']");
        const valorInput = row.querySelector("[data-creditur-field='valor']");
        const fase = normalizeCrediturPhase(faseInput?.value);
        const phaseMax = getCrediturPhaseMax(fase);
        if (fase === CREDITUR_PHASE_POST && phaseMax <= 0) return null;
        let parcelaInicio = normalizeCrediturParcelNumber(inicioInput?.value, 1, phaseMax);
        let parcelaFim = normalizeCrediturParcelNumber(fimInput?.value, parcelaInicio, phaseMax);
        if (fase === CREDITUR_PHASE_PRE) {
          parcelaInicio = 1;
          parcelaFim = normalizeCrediturParcelNumber(fimInput?.value, getCrediturConfiguredPreMonths(), CREDITUR_PRE_MAX_MONTHS);
        }
        if (parcelaFim < parcelaInicio) {
          [parcelaInicio, parcelaFim] = [parcelaFim, parcelaInicio];
        }
        let valor = parseMoney(valorInput?.value || "");
        if (valor > 0 && valor < MIN_CLIENT_INSTALLMENT) {
          valor = MIN_CLIENT_INSTALLMENT;
          if (normalize && valorInput instanceof HTMLInputElement && !isFieldBeingEdited(valorInput)) {
            valorInput.value = formatMoney(valor);
          }
        }
        if (normalize && !isFieldBeingEdited(inicioInput)) {
          if (inicioInput instanceof HTMLInputElement || inicioInput instanceof HTMLSelectElement) inicioInput.value = String(parcelaInicio);
        }
        if (normalize && !isFieldBeingEdited(fimInput)) {
          if (fimInput instanceof HTMLInputElement || fimInput instanceof HTMLSelectElement) fimInput.value = String(parcelaFim);
        }
        if (normalize && faseInput instanceof HTMLSelectElement) {
          faseInput.value = fase;
        }
        return { fase, parcela_inicio: parcelaInicio, parcela_fim: parcelaFim, valor };
      })
      .filter(Boolean)
      .filter((item) => includeEmpty || item.valor > 0)
      .sort((a, b) => (
        (normalizeCrediturPhase(a.fase) === CREDITUR_PHASE_POST ? 1 : 0)
        - (normalizeCrediturPhase(b.fase) === CREDITUR_PHASE_POST ? 1 : 0)
        || a.parcela_inicio - b.parcela_inicio
        || a.parcela_fim - b.parcela_fim
      ));
  }

  function buildCrediturPayloadIntervals(items = collectCrediturSemestres({ normalize: true })) {
    if (isCrediturGeralSelected()) {
      return buildCredituGeralPayloadIntervals();
    }
    const mesesPre = getCrediturConfiguredPreMonths();
    return normalizeCrediturIntervalCoverage(items)
      .map((item) => {
        const fase = normalizeCrediturPhase(item.fase);
        const phaseMax = getCrediturPhaseMax(fase);
        if (fase === CREDITUR_PHASE_POST && phaseMax <= 0) return null;
        const offset = fase === CREDITUR_PHASE_POST ? mesesPre : 0;
        let inicio = normalizeCrediturParcelNumber(item.parcela_inicio, 1, phaseMax);
        let fim = normalizeCrediturParcelNumber(item.parcela_fim, inicio, phaseMax);
        if (fim < inicio) {
          [inicio, fim] = [fim, inicio];
        }
        return {
          parcela_inicio: offset + inicio,
          parcela_fim: offset + fim,
          valor: parseMoney(item.valor),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.parcela_inicio - b.parcela_inicio || a.parcela_fim - b.parcela_fim);
  }

  function getCredituGeralApplied() {
    return state.credituGeral && state.credituGeral.aplicado && isCredituGeralPdfResult(state.credituGeral)
      ? state.credituGeral
      : null;
  }

  function getCredituGeralParcela7lm(result = {}) {
    const valorInformado = parseMoney(firstFilled(
      result?.parcela_7lm_20,
      result?.parcela_7lm,
      result?.parcela_7lm_pos,
      0
    ));
    return valorInformado > 0 ? roundMoneyNumber(valorInformado) : 0;
  }

  function buildCredituGeralPayloadIntervals(result = getCredituGeralApplied()) {
    const valorLiberado = roundMoneyNumber(parseMoney(result?.valor_liberado || 0));
    if (!isCrediturGeralSelected() || !isCredituGeralPdfResult(result) || valorLiberado <= 0) return [];
    if (Array.isArray(result?.parcelas_creditur_intervalos) && result.parcelas_creditur_intervalos.length) {
      return result.parcelas_creditur_intervalos
        .map((item) => ({
          parcela_inicio: clamp(toNumber(item?.parcela_inicio, 1), 1, CREDITUR_TOTAL_MAX_MONTHS),
          parcela_fim: clamp(toNumber(item?.parcela_fim, item?.parcela_inicio || 1), 1, CREDITUR_TOTAL_MAX_MONTHS),
          valor: roundMoneyNumber(parseMoney(item?.valor || 0)),
        }))
        .filter((item) => item.valor > 0)
        .map((item) => item.parcela_fim < item.parcela_inicio
          ? { ...item, parcela_inicio: item.parcela_fim, parcela_fim: item.parcela_inicio }
          : item)
        .sort((a, b) => a.parcela_inicio - b.parcela_inicio || a.parcela_fim - b.parcela_fim);
    }
    const parcelas = CREDITUR_PRE_DEFAULT_MONTHS;
    const parcelaBase = Math.floor((valorLiberado * 100) / parcelas) / 100;
    const ultimaParcela = roundMoneyNumber(valorLiberado - (parcelaBase * (parcelas - 1)));
    const intervalos = [];
    if (Math.abs(ultimaParcela - parcelaBase) <= 0.01) {
      intervalos.push({ parcela_inicio: 1, parcela_fim: parcelas, valor: parcelaBase });
    } else {
      intervalos.push(
        { parcela_inicio: 1, parcela_fim: parcelas - 1, valor: parcelaBase },
        { parcela_inicio: parcelas, parcela_fim: parcelas, valor: ultimaParcela }
      );
    }

    const parcela7lm = getCredituGeralParcela7lm(result);
    if (parcela7lm > 0) {
      intervalos.push({
        parcela_inicio: CREDITUR_PRE_DEFAULT_MONTHS + 1,
        parcela_fim: CREDITUR_TOTAL_MAX_MONTHS,
        valor: parcela7lm,
      });
    }
    return intervalos;
  }

  function hasCredituGeralLockedResult(result = state.credituGeral) {
    return Boolean(result && isCredituGeralPdfResult(result));
  }

  function buildCredituGeralDisplayIntervals(result = state.credituGeral) {
    if (!isCrediturGeralSelected()) return [];
    const base = result || {};
    const hasLockedResult = hasCredituGeralLockedResult(base);
    if (!hasLockedResult) return [];
    const parcela7lm = hasLockedResult ? getCredituGeralParcela7lm(base) : 0;
    const intervals = buildCredituGeralPayloadIntervals({
      ...base,
      aplicado: true,
      valor_liberado: parseMoney(base.valor_liberado || 0),
      parcela_7lm_20: parcela7lm,
    });
    return normalizeCrediturIntervalList(intervals);
  }

  function syncCredituGeralDisplayIntervals(result = state.credituGeral) {
    if (!isCrediturGeralSelected()) return;
    state.crediturSemestres = buildCredituGeralDisplayIntervals(result);
    renderCrediturSemestres({ preserve: false });
  }

  function getCredituGeralDefaultValue() {
    const resumo = state.simulacaoAtual?.resumo_operacao || {};
    const atual = parseMoney(state.credituGeral?.valor_liberado || 0);
    const falta = parseMoney(firstFilled(resumo.falta_para_valor_negociado, resumo.falta_para_imovel, 0));
    const entradaAtual = parseMoney(readValue(ids.entrada));
    const base = atual > 0 ? atual : (falta > 0 ? falta : entradaAtual);
    return clamp(roundMoneyNumber(base || CREDITU_GERAL_MIN_VALUE), CREDITU_GERAL_MIN_VALUE, CREDITU_GERAL_MAX_VALUE);
  }

  function syncCredituGeralValorControls(value, { updateInput = true } = {}) {
    const parsed = roundMoneyNumber(parseMoney(value));
    const normalized = clamp(parsed > 0 ? parsed : CREDITU_GERAL_MIN_VALUE, CREDITU_GERAL_MIN_VALUE, CREDITU_GERAL_MAX_VALUE);

    if (el.credituGeralValorSlider instanceof HTMLInputElement) {
      el.credituGeralValorSlider.min = String(CREDITU_GERAL_MIN_VALUE);
      el.credituGeralValorSlider.max = String(CREDITU_GERAL_MAX_VALUE);
      el.credituGeralValorSlider.step = "500";
      el.credituGeralValorSlider.value = String(normalized);
    }
    if (el.credituGeralValorLabel) {
      el.credituGeralValorLabel.textContent = formatMoney(normalized);
    }
    if (el.credituGeralValorMin) {
      el.credituGeralValorMin.textContent = formatMoney(CREDITU_GERAL_MIN_VALUE);
    }
    if (el.credituGeralValorMax) {
      el.credituGeralValorMax.textContent = formatMoney(CREDITU_GERAL_MAX_VALUE);
    }
    if (updateInput && el.credituGeralValor instanceof HTMLInputElement) {
      el.credituGeralValor.value = formatMoney(normalized);
    }

    return normalized;
  }

  function getCredituGeralClienteNome() {
    return firstFilled(
      state.clienteSelecionado?.nome_completo,
      state.clienteSelecionado?.nome,
      state.consolidacaoCliente?.cliente?.nome_completo,
      ""
    );
  }

  function getCredituGeralRendaTotal() {
    return parseMoney(firstFilled(
      state.consolidacaoCliente?.renda_total,
      state.clienteSelecionado?.renda_total,
      state.clienteSelecionado?.renda_principal,
      0
    ));
  }

  function getCredituGeralValorImovel() {
    return parseMoney(firstFilled(
      state.imovelSelecionado?.valor,
      readValue(ids.valorImovel),
      state.simulacaoAtual?.resumo_operacao?.valor_imovel,
      0
    ));
  }

  function isCredituGeralPdfResult(result = state.credituGeral) {
    const origem = String(result?.origem || "").trim().toLowerCase();
    return origem === "pdf_creditu"
      || Boolean(result?.arquivo_pdf?.id || result?.id_simulacao_creditu);
  }

  function getCredituGeralEmptyResult() {
    return {
      valor_liberado: 0,
      total_financiado: 0,
      prazo: CREDITU_GERAL_DEFAULT_MONTHS,
      sistema: "SAC",
      parcela_inicial: 0,
      parcela_final: 0,
      parcela_7lm_20: 0,
      aprovado: false,
      motivos: ["Envie O PDF Oficial Da Creditú"],
      vencimento_primeira_parcela: "",
      origem: "aguardando_creditu_pdf",
      parcelas_creditur_intervalos: [],
    };
  }

  function setCredituGeralPdfStatus(text, variant = "") {
    if (!el.credituGeralPdfStatus) return;
    el.credituGeralPdfStatus.textContent = text || "Nenhum PDF carregado.";
    el.credituGeralPdfStatus.classList.toggle("is-success", variant === "success");
    el.credituGeralPdfStatus.classList.toggle("is-error", variant === "error");
    el.credituGeralPdfStatus.classList.toggle("is-warning", variant === "warning");
  }

  function setCredituGeralUploadStatus(node, text, variant = "", fallback = "Nenhum anexo selecionado.") {
    if (!node) return;
    node.textContent = text || fallback;
    node.classList.toggle("is-success", variant === "success");
    node.classList.toggle("is-error", variant === "error");
    node.classList.toggle("is-warning", variant === "warning");
  }

  function setCredituGeralSerasaStatus(text, variant = "") {
    setCredituGeralUploadStatus(el.credituGeralSerasaStatus, text, variant, "Nenhum score anexado.");
  }

  function setCredituGeralSicaqStatus(text, variant = "") {
    setCredituGeralUploadStatus(el.credituGeralSicaqStatus, text, variant, "Nenhum SICAQ anexado.");
  }

  function validateCredituGeralOptionalAttachment(file, label) {
    if (!file) return true;
    const fileName = String(file.name || "");
    const contentType = String(file.type || "");
    const isAllowedType = /\.(pdf|png|jpe?g|webp)$/i.test(fileName)
      || /^application\/pdf$/i.test(contentType)
      || /^image\//i.test(contentType);
    if (!isAllowedType) {
      showCredituGeralFeedback("warning", `${label} precisa ser PDF ou imagem.`);
      return false;
    }
    if (Number(file.size || 0) > 8 * 1024 * 1024) {
      showCredituGeralFeedback("warning", `${label} precisa ter até 8 MB.`);
      return false;
    }
    return true;
  }

  function setCredituGeralReadOnlyFromPdf(enabled = true) {
    const locked = Boolean(enabled);
    [
      el.credituGeralCliente,
      el.credituGeralValor,
      el.credituGeralPrazo,
      el.credituGeralSistema,
      el.credituGeralSeguro,
      el.credituGeralRenda,
      el.credituGeralParcelaCaixa,
      el.credituGeralValorImovel,
      el.credituGeralIdade,
      el.credituGeralScore,
      el.credituGeralRestricoes,
    ].forEach((node) => {
      if (!(node instanceof HTMLInputElement || node instanceof HTMLSelectElement)) return;
      if (node === el.credituGeralValorImovel) {
        node.readOnly = true;
        node.setAttribute("aria-readonly", "true");
        return;
      }
      if (node instanceof HTMLSelectElement || node.type === "checkbox" || node.type === "range") {
        node.disabled = locked;
      } else {
        node.readOnly = locked;
        node.setAttribute("aria-readonly", locked ? "true" : "false");
      }
    });
  }

  function isCredituGeralReadyToApply() {
    return isCredituGeralPdfResult(state.credituGeral) && !state.credituGeralPdfPendente;
  }

  function syncCredituGeralApplyState() {
    if (!el.btnAplicarCredituGeral) return;
    const ready = isCredituGeralReadyToApply();
    el.btnAplicarCredituGeral.disabled = !ready;
    el.btnAplicarCredituGeral.setAttribute("aria-disabled", ready ? "false" : "true");
    el.btnAplicarCredituGeral.title = ready
      ? "Aplicar os valores lidos do PDF na proposta."
      : "Envie e leia o PDF oficial da Creditú para aplicar.";
  }

  function refreshCredituGeralPdfOnlyPreview({ warn = false } = {}) {
    const hasPdf = isCredituGeralPdfResult(state.credituGeral);
    renderCredituGeralResult(hasPdf ? state.credituGeral : getCredituGeralEmptyResult());
    syncCredituGeralApplyState();
    if (!hasPdf && warn) {
      showCredituGeralFeedback("warning", "Envie e leia o PDF oficial da Creditú para carregar os valores.");
      setCredituGeralPdfStatus("PDF da Creditú obrigatório para aplicar.", "warning");
    }
    return hasPdf;
  }

  function fillCredituGeralFieldsFromResult(result = {}) {
    if (el.credituGeralCliente instanceof HTMLInputElement) {
      el.credituGeralCliente.value = firstFilled(result.cliente_nome, getCredituGeralClienteNome());
    }
    if (el.credituGeralValor instanceof HTMLInputElement) {
      syncCredituGeralValorControls(parseMoney(result.valor_liberado || getCredituGeralDefaultValue()));
    }
    if (el.credituGeralPrazo instanceof HTMLInputElement) {
      el.credituGeralPrazo.value = String(toNumber(result.prazo, CREDITU_GERAL_DEFAULT_MONTHS));
    }
    if (el.credituGeralPrazoLabel) {
      el.credituGeralPrazoLabel.textContent = `${toNumber(result.prazo, CREDITU_GERAL_DEFAULT_MONTHS)} Meses`;
    }
    if (el.credituGeralSistema instanceof HTMLSelectElement) {
      el.credituGeralSistema.value = String(result.sistema || "SAC").toUpperCase() === "PRICE" ? "PRICE" : "SAC";
    }
    if (el.credituGeralSeguro instanceof HTMLInputElement) {
      el.credituGeralSeguro.checked = result.seguro_prestamista !== false;
    }
    if (el.credituGeralRenda instanceof HTMLInputElement) {
      el.credituGeralRenda.value = parseMoney(result.renda_total || getCredituGeralRendaTotal()) > 0
        ? formatMoney(parseMoney(result.renda_total || getCredituGeralRendaTotal()))
        : "";
    }
    if (el.credituGeralParcelaCaixa instanceof HTMLInputElement) {
      el.credituGeralParcelaCaixa.value = parseMoney(result.parcela_caixa || getClientSimulationMoney("parcela_financiamento_banco")) > 0
        ? formatMoney(parseMoney(result.parcela_caixa || getClientSimulationMoney("parcela_financiamento_banco")))
        : "";
    }
    if (el.credituGeralValorImovel instanceof HTMLInputElement) {
      el.credituGeralValorImovel.value = formatMoney(parseMoney(result.valor_imovel || getCredituGeralValorImovel()));
    }
    if (el.credituGeralIdade instanceof HTMLInputElement) {
      el.credituGeralIdade.value = result.idade ? String(result.idade) : "";
    }
    if (el.credituGeralScore instanceof HTMLInputElement) {
      el.credituGeralScore.value = result.score ? String(result.score) : "";
    }
    if (el.credituGeralRestricoes instanceof HTMLInputElement) {
      el.credituGeralRestricoes.value = result.restricoes ? formatMoney(result.restricoes) : "";
    }
    setCredituGeralReadOnlyFromPdf(true);
  }

  function normalizeCredituGeralPdfResult(payload = {}) {
    const campos = payload.campos || payload;
    const anexos = payload.anexos || campos.anexos_creditu || {};
    const valorLiberado = parseMoney(campos.valor_liberado || campos.valor_entrada || 0);
    const totalFinanciado = parseMoney(campos.total_financiado || 0);
    const parcelaInicial = parseMoney(campos.parcela_inicial || 0);
    const parcelaFinal = parseMoney(campos.parcela_final || 0);
    const prazo = clamp(toNumber(campos.prazo, CREDITU_GERAL_DEFAULT_MONTHS), CREDITU_GERAL_MIN_MONTHS, CREDITU_GERAL_MAX_MONTHS);
    const taxaMensal = Number(campos.taxa_mensal || 0) || (Number(campos.taxa_mensal_percentual || 0) / 100);
    const taxaAnual = Number(campos.taxa_anual || 0) || (Number(campos.taxa_anual_percentual || 0) / 100);
    const rendaTotal = getCredituGeralRendaTotal();
    const parcelaCaixa = getClientSimulationMoney("parcela_financiamento_banco");
    const comprometimento = rendaTotal > 0 ? (parcelaCaixa + parcelaInicial) / rendaTotal : 0;
    const valorImovel = getCredituGeralValorImovel();
    const percentualEntradaImovel = valorImovel > 0 ? valorLiberado / valorImovel : 0;

    return {
      ...campos,
      aplicado: false,
      aprovado: true,
      motivos: [],
      origem: "pdf_creditu",
      cliente_nome: firstFilled(campos.cliente_nome, getCredituGeralClienteNome()),
      valor_liberado: valorLiberado,
      valor_entrada: valorLiberado,
      total_financiado: totalFinanciado,
      parcela_inicial: parcelaInicial,
      parcela_final: parcelaFinal || parcelaInicial,
      parcela_7lm_20: parseMoney(firstFilled(campos.parcela_7lm_20, campos.parcela_7lm, campos.parcela_7lm_pos, 0)),
      prazo,
      sistema: String(campos.sistema || "SAC").toUpperCase() === "PRICE" ? "PRICE" : "SAC",
      seguro_prestamista: campos.seguro_prestamista !== false,
      renda_total: rendaTotal,
      parcela_caixa: parcelaCaixa,
      valor_imovel: valorImovel,
      comprometimento: roundMoneyNumber(comprometimento),
      percentual_entrada_imovel: roundMoneyNumber(percentualEntradaImovel),
      taxa_mensal: taxaMensal || CREDITU_GERAL_MONTHLY_RATE,
      taxa_anual: taxaAnual || CREDITU_GERAL_ANNUAL_RATE,
      arquivo_pdf: campos.arquivo_pdf || payload.arquivo || null,
      anexo_serasa: campos.anexo_serasa || anexos.serasa || null,
      anexo_sicaq: campos.anexo_sicaq || anexos.sicaq || null,
      anexos_creditu: {
        serasa: campos.anexo_serasa || anexos.serasa || null,
        sicaq: campos.anexo_sicaq || anexos.sicaq || null,
      },
      parcelas_creditur_intervalos: Array.isArray(campos.parcelas_creditur_intervalos)
        ? campos.parcelas_creditur_intervalos
        : [],
    };
  }

  async function importCredituGeralPdf() {
    if (!isCrediturGeralSelected()) {
      showFeedback("warning", "Selecione a modalidade Creditú Geral para importar o PDF.");
      return null;
    }
    if (!ensureSelections(true)) return null;
    const file = el.credituGeralPdf?.files?.[0];
    if (!file) {
      setCredituGeralPdfStatus("Selecione o PDF oficial da Creditú.", "warning");
      showCredituGeralFeedback("warning", "Selecione o PDF oficial da Creditú para continuar.");
      return null;
    }
    if (!/\.pdf$/i.test(file.name || "") && !/application\/pdf/i.test(file.type || "")) {
      setCredituGeralPdfStatus("O arquivo precisa ser um PDF.", "error");
      return null;
    }
    const serasaFile = el.credituGeralSerasa?.files?.[0] || null;
    const sicaqFile = el.credituGeralSicaq?.files?.[0] || null;
    if (!validateCredituGeralOptionalAttachment(serasaFile, "Score Serasa")) {
      setCredituGeralSerasaStatus("Score Serasa precisa ser PDF ou imagem de até 8 MB.", "error");
      return null;
    }
    if (!validateCredituGeralOptionalAttachment(sicaqFile, "SICAQ")) {
      setCredituGeralSicaqStatus("SICAQ precisa ser PDF ou imagem de até 8 MB.", "error");
      return null;
    }

    const form = new FormData();
    form.append("arquivo", file);
    if (serasaFile) form.append("score_serasa", serasaFile);
    if (sicaqFile) form.append("sicaq", sicaqFile);
    form.append("cliente_id", state.clienteSelecionado?.id || "");
    form.append("imovel_id", state.imovelSelecionado?.id || "");

    try {
      el.btnImportarCredituGeralPdf.disabled = true;
      state.credituGeralPdfPendente = true;
      syncCredituGeralApplyState();
      setCredituGeralPdfStatus("Lendo PDF da Creditú...");
      const payload = await apiMultipart(ENDPOINTS.credituPdf, form);
      const result = normalizeCredituGeralPdfResult(payload);
      state.credituGeral = result;
      state.credituGeralPdfPendente = false;
      fillCredituGeralFieldsFromResult(result);
      renderCredituGeralResult(result);
      syncCredituGeralApplyState();
      setCredituGeralPdfStatus(
        `${payload.arquivo?.nome_original || file.name} carregado. Valor Creditú ${formatMoney(result.valor_liberado)}.`,
        "success"
      );
      setCredituGeralSerasaStatus(
        result.anexo_serasa?.nome_original
          ? `${result.anexo_serasa.nome_original} anexado.`
          : "Score Serasa não anexado.",
        result.anexo_serasa?.nome_original ? "success" : ""
      );
      setCredituGeralSicaqStatus(
        result.anexo_sicaq?.nome_original
          ? `${result.anexo_sicaq.nome_original} anexado.`
          : "SICAQ não anexado.",
        result.anexo_sicaq?.nome_original ? "success" : ""
      );
      showCredituGeralFeedback("success", "PDF Da Creditú Lido Com Sucesso. Revise O Resumo E Aplique Na Proposta.");
      return result;
    } catch (error) {
      setCredituGeralPdfStatus(messageFromError(error, "Não foi possível ler o PDF da Creditú."), "error");
      showCredituGeralFeedback("error", messageFromError(error, "Não foi possível ler o PDF da Creditú."));
      syncCredituGeralApplyState();
      return null;
    } finally {
      el.btnImportarCredituGeralPdf.disabled = false;
    }
  }

  function getCredituGeralFormValues({ normalize = false } = {}) {
    const valorInformado = parseMoney(el.credituGeralValor?.value || 0);
    const valorLiberado = clamp(
      valorInformado > 0 ? valorInformado : getCredituGeralDefaultValue(),
      CREDITU_GERAL_MIN_VALUE,
      CREDITU_GERAL_MAX_VALUE
    );
    const prazo = clamp(toNumber(el.credituGeralPrazo?.value, CREDITU_GERAL_DEFAULT_MONTHS), CREDITU_GERAL_MIN_MONTHS, CREDITU_GERAL_MAX_MONTHS);
    const sistema = String(el.credituGeralSistema?.value || "SAC").toUpperCase() === "PRICE" ? "PRICE" : "SAC";
    const seguroPrestamista = Boolean(el.credituGeralSeguro?.checked);
    const rendaTotal = parseMoney(el.credituGeralRenda?.value || 0);
    const parcelaCaixa = parseMoney(el.credituGeralParcelaCaixa?.value || 0);
    const valorImovel = parseMoney(el.credituGeralValorImovel?.value || 0);
    const idade = toNumber(el.credituGeralIdade?.value, 0);
    const score = toNumber(el.credituGeralScore?.value, 0);
    const restricoes = parseMoney(el.credituGeralRestricoes?.value || 0);

    if (normalize) {
      syncCredituGeralValorControls(valorLiberado);
      if (el.credituGeralPrazo instanceof HTMLInputElement) el.credituGeralPrazo.value = String(prazo);
      if (el.credituGeralPrazoLabel) el.credituGeralPrazoLabel.textContent = `${prazo} Meses`;
      if (el.credituGeralRenda instanceof HTMLInputElement) el.credituGeralRenda.value = rendaTotal > 0 ? formatMoney(rendaTotal) : "";
      if (el.credituGeralParcelaCaixa instanceof HTMLInputElement) el.credituGeralParcelaCaixa.value = parcelaCaixa > 0 ? formatMoney(parcelaCaixa) : "";
      if (el.credituGeralValorImovel instanceof HTMLInputElement) el.credituGeralValorImovel.value = valorImovel > 0 ? formatMoney(valorImovel) : "";
      if (el.credituGeralRestricoes instanceof HTMLInputElement) el.credituGeralRestricoes.value = restricoes > 0 ? formatMoney(restricoes) : "";
    }

    return {
      cliente_nome: String(el.credituGeralCliente?.value || getCredituGeralClienteNome() || "").trim(),
      valor_liberado: valorLiberado,
      prazo,
      sistema,
      seguro_prestamista: seguroPrestamista,
      renda_total: rendaTotal,
      parcela_caixa: parcelaCaixa,
      valor_imovel: valorImovel,
      idade,
      score,
      restricoes,
    };
  }

  function calcularCredituGeral({ normalize = false } = {}) {
    if (isCredituGeralPdfResult(state.credituGeral)) {
      if (normalize) fillCredituGeralFieldsFromResult(state.credituGeral);
      return state.credituGeral;
    }
    const values = getCredituGeralFormValues({ normalize });
    const custosFixos = CREDITU_GERAL_BANK_COST_RATE + CREDITU_GERAL_ADMIN_COST_RATE + CREDITU_GERAL_STRUCTURE_COST_RATE;
    const custoSeguro = values.seguro_prestamista ? CREDITU_GERAL_INSURANCE_RATE_PER_MONTH * Math.max(values.prazo, 1) : 0;
    const divisorLiquido = Math.max(1 - custosFixos - custoSeguro, 0.01);
    const totalFinanciado = roundMoneyNumber(values.valor_liberado / divisorLiquido);
    const amortizacao = totalFinanciado / Math.max(values.prazo, 1);
    const parcelaPrice = totalFinanciado * (CREDITU_GERAL_MONTHLY_RATE / (1 - Math.pow(1 + CREDITU_GERAL_MONTHLY_RATE, -values.prazo)));
    const parcelaInicial = values.sistema === "PRICE"
      ? parcelaPrice
      : amortizacao + (totalFinanciado * CREDITU_GERAL_MONTHLY_RATE);
    const parcelaFinal = values.sistema === "PRICE"
      ? parcelaPrice
      : amortizacao + (amortizacao * CREDITU_GERAL_MONTHLY_RATE);
    const comprometimento = values.renda_total > 0
      ? (values.parcela_caixa + parcelaInicial) / values.renda_total
      : 1;
    const percentualEntradaImovel = values.valor_imovel > 0
      ? values.valor_liberado / values.valor_imovel
      : 0;
    const scoreOk = values.score > CREDITU_GERAL_SCORE_LIMIT
      || (values.idade > 0 && values.idade <= CREDITU_GERAL_YOUNG_SCORE_MAX_AGE && values.score > CREDITU_GERAL_YOUNG_SCORE_LIMIT);
    const restricoesOk = values.restricoes <= 0.01;
    const valorOk = values.valor_liberado >= CREDITU_GERAL_MIN_VALUE && values.valor_liberado <= CREDITU_GERAL_MAX_VALUE;
    const compromissoOk = comprometimento < CREDITU_GERAL_COMMITMENT_LIMIT;
    const percentualOk = !values.valor_imovel || percentualEntradaImovel <= CREDITU_GERAL_DOWNPAYMENT_PROPERTY_LIMIT;
    const aprovado = valorOk && compromissoOk && percentualOk && scoreOk && restricoesOk;
    const vencimento = formatIsoDate(addMonthsDate(contractDate(), 2));
    const motivos = [];
    if (!valorOk) motivos.push(`Valor Liberado Fora Da Faixa ${formatMoney(CREDITU_GERAL_MIN_VALUE)} A ${formatMoney(CREDITU_GERAL_MAX_VALUE)}`);
    if (!compromissoOk) motivos.push(`Comprometimento Acima De ${formatPercent(CREDITU_GERAL_COMMITMENT_LIMIT)}`);
    if (!percentualOk) motivos.push(`Valor Liberado Acima De ${formatPercent(CREDITU_GERAL_DOWNPAYMENT_PROPERTY_LIMIT)} Do Imóvel`);
    if (!scoreOk) motivos.push("Score Insuficiente Pela Regra Creditú");
    if (!restricoesOk) motivos.push("Há Restrição Financeira Informada");

    const resultado = {
      ...values,
      aplicado: false,
      aprovado,
      motivos,
      taxa_mensal: CREDITU_GERAL_MONTHLY_RATE,
      taxa_anual: CREDITU_GERAL_ANNUAL_RATE,
      total_financiado: totalFinanciado,
      parcela_inicial: roundMoneyNumber(parcelaInicial),
      parcela_final: roundMoneyNumber(parcelaFinal),
      comprometimento: roundMoneyNumber(comprometimento),
      percentual_entrada_imovel: roundMoneyNumber(percentualEntradaImovel),
      vencimento_primeira_parcela: vencimento,
      parcela_7lm_20: 0,
      parcelas_creditur_intervalos: [],
      origem: "simulador_creditu_geral",
    };
    resultado.parcela_7lm_20 = getCredituGeralParcela7lm(resultado);
    resultado.parcelas_creditur_intervalos = buildCredituGeralPayloadIntervals({ ...resultado, aplicado: true });
    return resultado;
  }

  function renderCredituGeralResult(result = state.credituGeral || getCredituGeralEmptyResult()) {
    const isPdfResult = isCredituGeralPdfResult(result);
    if (el.credituGeralParcelaInicial) el.credituGeralParcelaInicial.textContent = formatMoney(result.parcela_inicial || 0);
    if (el.credituGeralParcelaFinal) {
      el.credituGeralParcelaFinal.textContent = result.sistema === "PRICE"
        ? "Parcela Fixa Durante Todo O Prazo"
        : `Última Parcela: ${formatMoney(result.parcela_final || 0)}`;
    }
    if (el.credituGeralDetalhes) {
      const taxaLabel = result.taxa_mensal
        ? `${formatPercent(result.taxa_anual || 0)} a.a. | ${formatPercent(result.taxa_mensal || 0)} a.m. (+IPCA)`
        : "0,95% a.m. (+IPCA)";
      const rows = [
        ["Valor Liberado", formatMoney(result.valor_liberado || 0)],
        ["Total Financiado", formatMoney(result.total_financiado || 0)],
        ["Prazo Escolhido", `${result.prazo || CREDITU_GERAL_DEFAULT_MONTHS} Meses`],
        ["20 Parcelas 7LM", formatMoney(getCredituGeralParcela7lm(result))],
        ["Vencimento 1ª Parcela", formatDateLabel(result.vencimento_primeira_parcela)],
        ["Taxa De Juros", taxaLabel],
        ["Sistema", result.sistema || "SAC"],
        ["Fonte", isPdfResult ? "PDF Creditú" : "PDF Pendente"],
      ];
      if (!isPdfResult) {
        rows.push(["Comprometimento", formatPercent(result.comprometimento || 0)]);
      }
      el.credituGeralDetalhes.innerHTML = rows.map(([label, value]) => `
        <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>
      `).join("");
    }
    if (el.credituGeralAvaliacao) {
      el.credituGeralAvaliacao.classList.toggle("is-approved", Boolean(result.aprovado));
      el.credituGeralAvaliacao.classList.toggle("is-rejected", Boolean(!result.aprovado && result.motivos?.length));
      el.credituGeralAvaliacao.textContent = isPdfResult
        ? "PDF Creditú Lido E Pronto Para Aplicar No Pré-Chaves Da Proposta."
        : result.aprovado
        ? "Pré-Aprovação Operacional Aprovada. O Valor Liberado Pode Ser Aplicado No Pré-Chaves."
        : `Pré-Aprovação Pendente: ${(result.motivos || ["Simule Para Avaliar"]).join("; ")}.`;
    }
    syncCredituGeralDisplayIntervals(isPdfResult ? result : null);
  }

  function renderCredituGeralResumo() {
    if (!el.credituGeralResumo) return;
    const result = getCredituGeralApplied();
    const visible = isCrediturGeralSelected() && Boolean(result);
    el.credituGeralResumo.hidden = !visible;
    if (!visible) {
      el.credituGeralResumo.innerHTML = "";
      return;
    }
    const rows = [
      ["Liberado", formatMoney(result.valor_liberado)],
      ["Parcela Inicial", formatMoney(result.parcela_inicial)],
      ["20 Parcelas 7LM", formatMoney(getCredituGeralParcela7lm(result))],
      ["Prazo", `${result.prazo} Meses`],
      ["Sistema", result.sistema],
    ];
    el.credituGeralResumo.innerHTML = rows.map(([label, value]) => `
      <div class="tl-sim-creditu-geral-summary__item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
    `).join("");
  }

  function showCredituGeralFeedback(variant, text) {
    renderFeedback(el.credituGeralFeedback, variant, text);
  }

  function prefillCredituGeralModal() {
    if (state.credituGeral && !isCredituGeralPdfResult(state.credituGeral)) {
      state.credituGeral = null;
    }
    const result = state.credituGeral || {};
    if (isCredituGeralPdfResult(result)) {
      state.credituGeralPdfPendente = false;
      fillCredituGeralFieldsFromResult(result);
      renderCredituGeralResult(result);
      syncCredituGeralApplyState();
      setCredituGeralPdfStatus(
        `${result.arquivo_pdf?.nome_original || "PDF Creditú"} carregado. Valor Creditú ${formatMoney(result.valor_liberado)}.`,
        "success"
      );
      setCredituGeralSerasaStatus(
        result.anexo_serasa?.nome_original
          ? `${result.anexo_serasa.nome_original} anexado.`
          : "Score Serasa não anexado.",
        result.anexo_serasa?.nome_original ? "success" : ""
      );
      setCredituGeralSicaqStatus(
        result.anexo_sicaq?.nome_original
          ? `${result.anexo_sicaq.nome_original} anexado.`
          : "SICAQ não anexado.",
        result.anexo_sicaq?.nome_original ? "success" : ""
      );
      showCredituGeralFeedback("", "");
      return;
    }
    state.credituGeralPdfPendente = false;
    setCredituGeralReadOnlyFromPdf(true);
    syncCredituGeralApplyState();
    setCredituGeralPdfStatus("Anexe o PDF oficial da Creditú para liberar a aplicação.", "warning");
    setCredituGeralSerasaStatus("Nenhum score anexado.");
    setCredituGeralSicaqStatus("Nenhum SICAQ anexado.");
    if (el.credituGeralCliente instanceof HTMLInputElement) {
      el.credituGeralCliente.value = result.cliente_nome || getCredituGeralClienteNome();
    }
    if (el.credituGeralValor instanceof HTMLInputElement) {
      el.credituGeralValor.value = formatMoney(0);
    }
    if (el.credituGeralValorSlider instanceof HTMLInputElement) {
      el.credituGeralValorSlider.min = String(CREDITU_GERAL_MIN_VALUE);
      el.credituGeralValorSlider.max = String(CREDITU_GERAL_MAX_VALUE);
      el.credituGeralValorSlider.step = "500";
      el.credituGeralValorSlider.value = String(CREDITU_GERAL_MIN_VALUE);
    }
    if (el.credituGeralValorLabel) {
      el.credituGeralValorLabel.textContent = formatMoney(0);
    }
    if (el.credituGeralValorMin) {
      el.credituGeralValorMin.textContent = formatMoney(CREDITU_GERAL_MIN_VALUE);
    }
    if (el.credituGeralValorMax) {
      el.credituGeralValorMax.textContent = formatMoney(CREDITU_GERAL_MAX_VALUE);
    }
    if (el.credituGeralPrazo instanceof HTMLInputElement) {
      el.credituGeralPrazo.value = String(toNumber(result.prazo, CREDITU_GERAL_DEFAULT_MONTHS));
    }
    if (el.credituGeralPrazoLabel) {
      el.credituGeralPrazoLabel.textContent = `${toNumber(result.prazo, CREDITU_GERAL_DEFAULT_MONTHS)} Meses`;
    }
    if (el.credituGeralSistema instanceof HTMLSelectElement) {
      el.credituGeralSistema.value = result.sistema || "SAC";
    }
    if (el.credituGeralSeguro instanceof HTMLInputElement) {
      el.credituGeralSeguro.checked = result.seguro_prestamista !== false;
    }
    if (el.credituGeralRenda instanceof HTMLInputElement) {
      el.credituGeralRenda.value = formatMoney(parseMoney(result.renda_total || getCredituGeralRendaTotal()));
    }
    if (el.credituGeralParcelaCaixa instanceof HTMLInputElement) {
      el.credituGeralParcelaCaixa.value = formatMoney(parseMoney(result.parcela_caixa || getClientSimulationMoney("parcela_financiamento_banco")));
    }
    if (el.credituGeralValorImovel instanceof HTMLInputElement) {
      el.credituGeralValorImovel.value = formatMoney(parseMoney(result.valor_imovel || getCredituGeralValorImovel()));
    }
    if (el.credituGeralIdade instanceof HTMLInputElement) {
      el.credituGeralIdade.value = result.idade ? String(result.idade) : "";
    }
    if (el.credituGeralScore instanceof HTMLInputElement) {
      el.credituGeralScore.value = result.score ? String(result.score) : "";
    }
    if (el.credituGeralRestricoes instanceof HTMLInputElement) {
      el.credituGeralRestricoes.value = result.restricoes ? formatMoney(result.restricoes) : "";
    }
    renderCredituGeralResult(getCredituGeralEmptyResult());
    showCredituGeralFeedback("warning", "Envie e leia o PDF oficial da Creditú. Os valores abaixo são somente leitura.");
  }

  function openCredituGeralModal() {
    if (!isCrediturGeralSelected()) {
      showFeedback("warning", "Selecione a modalidade Creditú Geral para abrir esta simulação.");
      return;
    }
    if (!ensureSelections(true)) return;
    prefillCredituGeralModal();
    if (!el.modalCredituGeral) return;
    el.modalCredituGeral.hidden = false;
    el.modalCredituGeral.setAttribute("aria-hidden", "false");
    el.btnSelecionarCredituGeralPdf?.focus();
  }

  function openCredituGeralSite() {
    if (!isCrediturGeralSelected()) {
      showFeedback("warning", "Selecione a modalidade Creditú Geral para simular na Creditú.");
      return;
    }
    if (!ensureSelections(true)) return;
    showFeedback(
      "info",
      "Faça a simulação no site da Creditú. Depois volte para esta tela e use Importar proposta Creditú para anexar o PDF oficial."
    );
    const newWindow = window.open(CREDITU_GERAL_SITE_URL, "_blank");
    if (newWindow) {
      newWindow.opener = null;
      return;
    }
    showFeedback("warning", "O navegador bloqueou a nova aba. Libere pop-ups ou acesse: https://creditu.com/br/7lm/");
  }

  function closeCredituGeralModal() {
    if (!el.modalCredituGeral) return;
    el.modalCredituGeral.hidden = true;
    el.modalCredituGeral.setAttribute("aria-hidden", "true");
  }

  function simulateCredituGeral() {
    if (isCredituGeralPdfResult(state.credituGeral)) {
      const result = { ...state.credituGeral, aplicado: false, aprovado: true, motivos: [] };
      state.credituGeral = result;
      fillCredituGeralFieldsFromResult(result);
      renderCredituGeralResult(result);
      syncCredituGeralApplyState();
      return result;
    }
    showCredituGeralFeedback("warning", "Envie E Leia O PDF Oficial Da Creditú Antes De Aplicar Na Proposta.");
    setCredituGeralPdfStatus("PDF da Creditú obrigatório para aplicar.", "warning");
    syncCredituGeralApplyState();
    return null;
  }

  function simulateCredituGeralInternoLegado() {
    const result = calcularCredituGeral({ normalize: true });
    state.credituGeral = { ...result, aplicado: false };
    renderCredituGeralResult(state.credituGeral);
    showCredituGeralFeedback(
      result.aprovado ? "success" : "warning",
      result.aprovado ? "Pré-Aprovação Operacional Aprovada." : `Ajuste Antes De Aplicar: ${result.motivos.join("; ")}.`
    );
    return state.credituGeral;
  }

  function applyCredituGeralSimulation() {
    const result = simulateCredituGeral();
    if (!result) return;
    if (!result.aprovado) {
      showCredituGeralFeedback("warning", "A Pré-Aprovação Precisa Estar Aprovada Para Aplicar No Pré-Chaves.");
      return;
    }
    state.credituGeral = {
      ...result,
      aplicado: true,
      aplicado_em: new Date().toISOString(),
      modalidade: PARTNER_CREDITUR_GERAL,
      parcelas_creditur_intervalos: buildCredituGeralPayloadIntervals({ ...result, aplicado: true }),
    };
    renderCredituGeralResumo();
    closeCredituGeralModal();
    showFeedback("success", `PDF Creditú Aplicado: ${formatMoney(state.credituGeral.valor_liberado)} No Pré-Chaves + 20 Parcelas 7LM.`);
    scheduleSimulationRecalculation(80);
  }

  function findCrediturIntervalOverlap(items = collectCrediturSemestres({ includeEmpty: false })) {
    const used = new Map();
    for (const item of items) {
      const fase = normalizeCrediturPhase(item.fase);
      const phaseMax = getCrediturPhaseMax(fase);
      const inicio = normalizeCrediturParcelNumber(item.parcela_inicio, 1, phaseMax);
      const fim = normalizeCrediturParcelNumber(item.parcela_fim, inicio, phaseMax);
      const start = Math.min(inicio, fim);
      const end = Math.max(inicio, fim);
      for (let parcela = start; parcela <= end; parcela += 1) {
        const key = `${fase}:${parcela}`;
        if (used.has(key)) {
          return {
            fase,
            parcela,
            label: crediturPhaseLabel(fase),
            max: phaseMax,
          };
        }
        used.set(key, true);
      }
    }
    return null;
  }

  function validateCrediturIntervals({ notify = true } = {}) {
    if (!isCrediturSelected()) return true;
    const overlap = findCrediturIntervalOverlap();
    if (!overlap) return true;
    if (notify) {
      showFeedback("info", `A parcela ${overlap.parcela} repetida será considerada apenas uma vez no cálculo.`);
    }
    return true;
  }

  function ajustarNiveis7lmAoPrazoCreditur(items = [], oldPreMonths = getCrediturConfiguredPreMonths(), newPreMonths = getCrediturConfiguredPreMonths()) {
    const oldPostMax = Math.max(CREDITUR_TOTAL_MAX_MONTHS - normalizePreDeliveryMonths(oldPreMonths, CREDITUR_PRE_DEFAULT_MONTHS), 0);
    const newPostMax = Math.max(CREDITUR_TOTAL_MAX_MONTHS - normalizePreDeliveryMonths(newPreMonths, CREDITUR_PRE_DEFAULT_MONTHS), 0);
    return (Array.isArray(items) ? items : [])
      .map((item) => {
        const fase = normalizeCrediturPhase(item.fase);
        if (fase !== CREDITUR_PHASE_POST) {
          return {
            ...item,
            parcela_inicio: 1,
            parcela_fim: newPreMonths,
          };
        }
        if (newPostMax <= 0) return null;
        const oldReachedEnd = oldPostMax > 0 && toNumber(item.parcela_fim, oldPostMax) >= oldPostMax;
        const inicio = clamp(toNumber(item.parcela_inicio, 1), 1, newPostMax);
        const fimBase = oldReachedEnd ? newPostMax : toNumber(item.parcela_fim, inicio);
        const fim = clamp(fimBase, inicio, newPostMax);
        return {
          ...item,
          parcela_inicio: inicio,
          parcela_fim: fim,
        };
      })
      .filter(Boolean);
  }

  function renderCrediturSemestres({ preserve = true } = {}) {
    if (!el.crediturSemestres) return;
    const credituGeral = isCrediturGeralSelected();
    if (credituGeral && !hasCredituGeralLockedResult(state.credituGeral)) {
      state.crediturSemestres = [];
      el.crediturSemestres.innerHTML = "";
      return;
    }
    const previous = preserve ? collectCrediturSemestres({ includeEmpty: true }) : state.crediturSemestres;
    const items = previous.length ? previous : state.crediturSemestres;
    state.crediturSemestres = credituGeral && !items.length
      ? []
      : normalizeCrediturIntervalList(items);

    const fragment = document.createDocumentFragment();
    const criarSelectParcelas = ({ value, start, end, offset = 0, field }) => {
      const select = document.createElement("select");
      select.dataset.crediturField = field;
      for (let parcela = start; parcela <= end; parcela += 1) {
        const option = document.createElement("option");
        option.value = String(parcela);
        option.textContent = String(offset + parcela);
        select.append(option);
      }
      select.value = String(clamp(value, start, end));
      return select;
    };

    let ultimoFim7lm = 0;
    state.crediturSemestres.forEach((item, index) => {
      const fase = normalizeCrediturPhase(item.fase);
      if (credituGeral && fase === CREDITUR_PHASE_PRE) return;
      const phaseMax = getCrediturPhaseMax(fase);
      const isCrediturRow = fase === CREDITUR_PHASE_PRE;
      if (!isCrediturRow && phaseMax <= 0) return;
      const minInicio7lm = isCrediturRow ? 1 : Math.min(Math.max(ultimoFim7lm + 1, 1), phaseMax);
      const inicioNormalizado = isCrediturRow ? 1 : clamp(toNumber(item.parcela_inicio, minInicio7lm), minInicio7lm, phaseMax);
      const fimNormalizado = isCrediturRow
        ? getCrediturConfiguredPreMonths()
        : clamp(toNumber(item.parcela_fim, inicioNormalizado), inicioNormalizado, phaseMax);
      if (!isCrediturRow) {
        ultimoFim7lm = Math.max(ultimoFim7lm, fimNormalizado);
      }
      const row = document.createElement("div");
      row.className = "tl-sim-creditur-row";
      row.dataset.crediturRow = String(index);

      const faseField = document.createElement("label");
      faseField.className = "tl-imoveis-field";
      const faseLabel = document.createElement("span");
      faseLabel.textContent = "Fase";
      const faseSelect = document.createElement("select");
      faseSelect.dataset.crediturField = "fase";
      const option = document.createElement("option");
      option.value = fase;
      option.textContent = crediturPhaseLabel(fase);
      faseSelect.append(option);
      faseSelect.value = fase;
      faseSelect.disabled = true;
      faseField.append(faseLabel, faseSelect);

      const inicioField = document.createElement("label");
      inicioField.className = "tl-imoveis-field";
      const inicioLabel = document.createElement("span");
      inicioLabel.textContent = "Parcela Inicial";
      const inicioInput = isCrediturRow
        ? document.createElement("input")
        : criarSelectParcelas({
          value: inicioNormalizado,
          start: minInicio7lm,
          end: phaseMax,
          offset: getCrediturConfiguredPreMonths(),
          field: "inicio",
        });
      if (inicioInput instanceof HTMLInputElement) {
        inicioInput.type = "number";
        inicioInput.min = "1";
        inicioInput.max = String(phaseMax);
        inicioInput.step = "1";
        inicioInput.value = String(inicioNormalizado);
        inicioInput.readOnly = true;
        inicioInput.dataset.crediturField = "inicio";
      }
      inicioInput.disabled = credituGeral;
      inicioField.append(inicioLabel, inicioInput);

      const fimField = document.createElement("label");
      fimField.className = "tl-imoveis-field";
      const fimLabel = document.createElement("span");
      fimLabel.textContent = "Parcela final";
      const fimInput = isCrediturRow
        ? criarSelectParcelas({
          value: fimNormalizado,
          start: 1,
          end: CREDITUR_PRE_MAX_MONTHS,
          offset: 0,
          field: "fim",
        })
        : criarSelectParcelas({
          value: fimNormalizado,
          start: inicioNormalizado,
          end: phaseMax,
          offset: getCrediturConfiguredPreMonths(),
          field: "fim",
        });
      if (fimInput instanceof HTMLInputElement) {
        fimInput.type = "number";
        fimInput.min = "1";
        fimInput.max = String(phaseMax);
        fimInput.step = "1";
        fimInput.value = String(fimNormalizado);
        fimInput.readOnly = true;
        fimInput.dataset.crediturField = "fim";
      }
      fimInput.disabled = credituGeral;
      fimField.append(fimLabel, fimInput);

      const valorField = document.createElement("label");
      valorField.className = "tl-imoveis-field";
      const valorLabel = document.createElement("span");
      valorLabel.textContent = isCrediturRow ? "Parcela mensal Creditú" : "Parcela mensal 7LM";
      const valorInput = document.createElement("input");
      valorInput.type = "text";
      valorInput.placeholder = formatMoney(MIN_CLIENT_INSTALLMENT);
      valorInput.value = item.valor ? formatMoney(parseMoney(item.valor)) : "";
      valorInput.dataset.crediturField = "valor";
      valorInput.readOnly = credituGeral;
      valorInput.setAttribute("aria-readonly", credituGeral ? "true" : "false");
      valorField.append(valorLabel, valorInput);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "tl-imoveis-btn tl-imoveis-btn--secondary";
      removeButton.textContent = "Remover";
      removeButton.dataset.action = "remover-creditur-semestre";
      removeButton.disabled = isCrediturRow || credituGeral;

      row.append(faseField, inicioField, fimField, valorField, removeButton);
      fragment.append(row);
    });

    el.crediturSemestres.innerHTML = "";
    el.crediturSemestres.append(fragment);
    enableCustomSelects(el.crediturSemestres);
  }

  function addCrediturSemestreRow() {
    const current = collectCrediturSemestres({ includeEmpty: true });
    const phaseMax = getCrediturPhaseMax(CREDITUR_PHASE_POST);
    const postRows = current.filter((item) => normalizeCrediturPhase(item.fase) === CREDITUR_PHASE_POST);
    const ultimoFim = postRows.reduce((max, item) => Math.max(max, toNumber(item.parcela_fim, 0)), 0);
    const inicio = ultimoFim + 1;
    if (inicio > phaseMax) {
      showFeedback("info", `Os níveis 7LM já chegaram até a parcela ${CREDITUR_TOTAL_MAX_MONTHS}.`);
      return;
    }
    state.crediturSemestres = [
      ...current,
      { fase: CREDITUR_PHASE_POST, parcela_inicio: inicio, parcela_fim: phaseMax, valor: "" },
    ];
    renderCrediturSemestres({ preserve: false });
  }

  function syncRecurringDateFields() {
    [
      [ids.anualPrimeiraData, ids.anualQtd, 12],
      [ids.semestralPrimeiraData, ids.semestralQtd, 6],
    ].forEach(([dateId, qtyId, fallbackMonth]) => {
      const dateField = document.getElementById(dateId);
      const qty = toNumber(readValue(qtyId), 0);
      if (!(dateField instanceof HTMLInputElement)) return;
      dateField.min = timelineMinDate();
      dateField.max = "";
      if (qty > 0 && !dateField.value) {
        dateField.value = clampDateFromToday("", fallbackMonth);
      }
      if (dateField.value) {
        dateField.value = clampDateFromToday(dateField.value, fallbackMonth);
      }
      refreshDatePickerUi(dateField);
    });
  }

  function resolveDynamicPropertyDelivery(referenceDate = new Date()) {
    const today = referenceDate instanceof Date ? new Date(referenceDate.getTime()) : new Date();
    const deliveryDate = parseIsoDate(DEFAULT_PROPERTY_DELIVERY_DATE) || new Date(2027, 11, 15);
    let monthsUntilDelivery = (deliveryDate.getFullYear() - today.getFullYear()) * 12 + (deliveryDate.getMonth() - today.getMonth());
    if (deliveryDate.getDate() > today.getDate()) monthsUntilDelivery += 1;

    return {
      dataEntrega: formatIsoDate(deliveryDate),
      mesesPreEntrega: clamp(monthsUntilDelivery || DEFAULT_PROPERTY_DELIVERY_MONTHS, 1, MAX_TOTAL_TIMELINE_MONTHS),
    };
  }

  function resolvePropertyDelivery(item = null, referenceDate = new Date()) {
    const fallback = resolveDynamicPropertyDelivery(referenceDate);
    const rawDate = firstFilled(item?.data_entrega, item?.dataEntrega, "");
    const parsedDate = parseDateOnly(rawDate);
    let mesesPreEntrega = 0;

    if (parsedDate) {
      const today = referenceDate instanceof Date ? new Date(referenceDate.getTime()) : new Date();
      mesesPreEntrega = (parsedDate.getFullYear() - today.getFullYear()) * 12 + (parsedDate.getMonth() - today.getMonth());
      if (parsedDate.getDate() > today.getDate()) mesesPreEntrega += 1;
    } else {
      mesesPreEntrega = toNumber(item?.meses_pre_entrega, 0);
    }

    return {
      dataEntrega: parsedDate ? formatIsoDate(parsedDate) : fallback.dataEntrega,
      mesesPreEntrega: clamp(mesesPreEntrega || fallback.mesesPreEntrega, 1, MAX_TOTAL_TIMELINE_MONTHS),
    };
  }

  function firstFilled(...values) {
    for (const value of values) {
      const text = String(value ?? "").trim();
      if (text) return text;
    }
    return "";
  }

  function decimalInputToNumber(value) {
    const raw = String(value ?? "").trim().replace(",", ".");
    if (!raw) return null;
    const number = Number(raw);
    return Number.isFinite(number) ? number : null;
  }

  function initialsFromName(value) {
    const parts = String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "CL";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  function formatPhone(value) {
    const digits = digitsOnly(value).slice(0, 11);
    if (!digits) return "";
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
    }
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
  }

  function formatArea(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) return "-";
    return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number)} m2`;
  }

  function parseDateOnly(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const raw = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(raw.getTime()) ? null : raw;
  }

  function parseCalendarDate(value) {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const dateOnly = parseDateOnly(value);
    if (dateOnly) return dateOnly;
    const raw = value ? new Date(value) : null;
    return raw && !Number.isNaN(raw.getTime()) ? raw : null;
  }

  function calendarDateTime(value) {
    const raw = parseCalendarDate(value);
    return raw ? raw.getTime() : 0;
  }

  function formatDateLabel(value) {
    const raw = parseCalendarDate(value);
    if (!raw || Number.isNaN(raw.getTime())) return "-";
    return raw.toLocaleDateString("pt-BR");
  }

  function formatMonthLabel(value) {
    const raw = parseCalendarDate(value);
    if (!raw || Number.isNaN(raw.getTime())) return "-";
    return raw.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
  }

  function formatDateTimeLabel(value) {
    const raw = value ? new Date(value) : null;
    if (!raw || Number.isNaN(raw.getTime())) return "-";
    return raw.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function truncateText(value, maxLength = 180) {
    const text = String(value || "").trim();
    if (!text || text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
  }

  function normalizeMediaPath(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^https?:\/\//i.test(text)) return text;
    return `/${text.replace(/^\/+/, "")}`;
  }

  function normalizeMediaItem(item) {
    const record = { ...(item || {}) };
    return {
      ...record,
      caminho_arquivo: normalizeMediaPath(record.caminho_arquivo),
    };
  }

  function buildGoogleMapsLinks(query) {
    const text = String(query || "").trim();
    if (!text) {
      return {
        searchUrl: "",
        embedUrl: "",
        routeUrl: "",
      };
    }

    const encoded = encodeURIComponent(text);
    return {
      searchUrl: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
      embedUrl: `https://www.google.com/maps?q=${encoded}&output=embed`,
      routeUrl: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
    };
  }

  function buildPropertyMapData(imovel) {
    const localizacao = imovel?.localizacao || {};
    const query = firstFilled(
      localizacao.consulta,
      imovel?.map_query,
      localizacao.endereco_formatado,
      imovel?.endereco_formatado,
      [imovel?.endereco, imovel?.bairro, imovel?.cidade, imovel?.estado].filter(Boolean).join(", ")
    );
    const links = buildGoogleMapsLinks(query);
    const latitude = localizacao.latitude;
    const longitude = localizacao.longitude;
    const coordenadas = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
      ? `${String(latitude).replace(".", ",")}, ${String(longitude).replace(".", ",")}`
      : "";

    return {
      query,
      address: firstFilled(localizacao.endereco_formatado, imovel?.endereco_formatado, imovel?.endereco),
      summary: firstFilled(
        imovel?.empreendimento,
        [imovel?.bairro, imovel?.cidade, imovel?.estado].filter(Boolean).join(" • "),
        imovel?.tipologia
      ),
      coordinates: coordenadas,
      searchUrl: firstFilled(localizacao.google_maps_url, imovel?.map_url, links.searchUrl),
      embedUrl: firstFilled(localizacao.google_maps_embed_url, imovel?.map_embed_url, links.embedUrl),
      routeUrl: firstFilled(localizacao.google_maps_rota_url, imovel?.map_route_url, links.routeUrl),
    };
  }

  function normalizeReservationForUi(raw) {
    const reserva = raw || {};
    const cliente = reserva.cliente || {};
    const imovel = reserva.imovel || {};
    const negociacao = reserva.negociacao || {};

    return {
      ...reserva,
      id: String(reserva.id || ""),
      cliente_id: String(reserva.cliente_id || cliente.id || ""),
      imovel_id: String(reserva.imovel_id || imovel.id || ""),
      simulacao_id: String(reserva.simulacao_id || ""),
      cliente: {
        ...cliente,
        id: String(cliente.id || reserva.cliente_id || ""),
        telefone: firstFilled(cliente.telefone),
      },
      imovel: {
        ...imovel,
        id: String(imovel.id || reserva.imovel_id || ""),
        foto_principal: normalizeMediaPath(imovel.foto_principal),
      },
      negociacao: {
        ...negociacao,
        valor_imovel: parseMoney(negociacao.valor_imovel || 0),
        valor_total_operacao: parseMoney(negociacao.valor_total_operacao || 0),
        financiamento_caixa: parseMoney(negociacao.financiamento_caixa || 0),
        fgts: parseMoney(negociacao.fgts || 0),
        subsidio: parseMoney(negociacao.subsidio || 0),
        cheque_moradia: parseMoney(negociacao.cheque_moradia || 0),
        entrada: parseMoney(negociacao.entrada || 0),
        pro_soluto_total: parseMoney(negociacao.pro_soluto_total || 0),
        sobrepreco: parseMoney(negociacao.sobrepreco || 0),
        desconto_imovel: parseMoney(negociacao.desconto_imovel || 0),
        incentivo_7lm: parseMoney(firstFilled(negociacao.incentivo_7lm, negociacao.desconto_imovel, 0)),
        saldo_pos_entrega: parseMoney(negociacao.saldo_pos_entrega || 0),
      },
    };
  }

  function isPendingApprovalStatus(value) {
    const status = normalizeStatus(value);
    return [
      "pendente aprovacao",
      "pendente de aprovacao",
      "pendente aprovação",
      "pendente de aprovação",
    ].includes(status);
  }

  function isPendingApprovalReservation(reserva) {
    return isPendingApprovalStatus(reserva?.status);
  }

  function isPendingApprovalProperty(imovel) {
    return isPendingApprovalStatus(imovel?.status) || isPendingApprovalReservation(getReservationForProperty(imovel));
  }

  function getCurrentApprovalException() {
    const analise = state.simulacaoAtual?.aprovacao_excecao;
    return analise && typeof analise === "object" ? analise : null;
  }

  function needsApprovalException(analise = getCurrentApprovalException()) {
    return Boolean(analise?.necessaria);
  }

  function canSubmitApprovalException(analise = getCurrentApprovalException()) {
    return Boolean(analise?.necessaria && analise?.permitida);
  }

  function reservationEyebrow(reserva, { fallbackPending = false } = {}) {
    if (reserva && isPendingApprovalReservation(reserva)) return "Aprovação pendente";
    if (!reserva && fallbackPending) return "Aprovação pendente";
    return "Reserva ativa";
  }

  function getReservationForProperty(imovel) {
    if (!imovel?.reserva_ativa) return null;
    return normalizeReservationForUi(imovel.reserva_ativa);
  }

  function isReservationForSelectedClient(reserva) {
    if (!reserva?.cliente_id || !state.clienteSelecionado?.id) return false;
    return String(reserva.cliente_id) === String(state.clienteSelecionado.id);
  }

  function reservationTitle(reserva, { fallbackManual = false } = {}) {
    if (!reserva) {
      return fallbackManual ? "Reserva sem cliente vinculado" : "";
    }
    if (isPendingApprovalReservation(reserva)) {
      if (isReservationForSelectedClient(reserva)) return "Aguardando aprovação para este cliente";
      return `Aguardando aprovação para ${firstFilled(reserva?.cliente?.nome_completo, "cliente não informado")}`;
    }
    if (isReservationForSelectedClient(reserva)) return "Reservado para este cliente";
    return `Reservado para ${firstFilled(reserva?.cliente?.nome_completo, "cliente não informado")}`;
  }

  function reservationUserName(reserva) {
    const usuario = reserva?.reservado_por_usuario || {};
    const reservadoPorId = String(reserva?.reservado_por || "").trim();
    const usuarioAtualId = String(state.user?.identificador_usuario || state.user?.id || "").trim();
    return firstFilled(
      usuario.nome_completo,
      reserva?.reservado_por_nome,
      usuario.email,
      reserva?.reservado_por_email,
      reservadoPorId && usuarioAtualId && reservadoPorId === usuarioAtualId
        ? firstFilled(
            state.user?.nome_completo,
            state.user?.nome,
            state.user?.displayName,
            state.user?.correio_eletronico,
            state.user?.email
          )
        : "",
      "responsável não identificado"
    );
  }

  function reservationAuditText(reserva) {
    if (!reserva) return "";
    const responsavel = reservationUserName(reserva);
    const data = reserva.reservado_em ? formatDateTimeLabel(reserva.reservado_em) : "";
    const verbo = isPendingApprovalReservation(reserva) ? "Solicitado" : "Reservado";
    if (responsavel && data) return `${verbo} por ${responsavel} em ${data}`;
    if (responsavel) return `${verbo} por ${responsavel}`;
    if (data) return `${verbo} em ${data}`;
    return "";
  }

  function reservationSummary(reserva) {
    if (!reserva) return "";
    const partes = [];
    const auditoria = reservationAuditText(reserva);
    if (auditoria) partes.push(auditoria);
    if (isPendingApprovalReservation(reserva)) partes.push("Aguardando decisão do gestor");
    if (parseMoney(reserva.negociacao?.entrada || 0) > 0) partes.push(`Entrada ${formatMoney(reserva.negociacao.entrada)}`);
    if (parseMoney(reserva.negociacao?.valor_total_operacao || 0) > 0) partes.push(`Operação ${formatMoney(reserva.negociacao.valor_total_operacao)}`);
    return partes.join(" • ");
  }

  function getReservationByPropertyId(propertyId) {
    const targetId = String(propertyId || "");
    if (!targetId) return null;
    return (Array.isArray(state.reservasCliente) ? state.reservasCliente : []).find(
      (reserva) => String(reserva?.imovel_id || reserva?.imovel?.id || "") === targetId
    ) || null;
  }

  function capturePreselectedContext() {
    let raw = "";
    try {
      raw = window.sessionStorage.getItem(PRESELECTED_PROPERTY_STORAGE_KEY) || "";
    } catch {
      raw = "";
    }
    if (!raw) return null;

    try {
      const payload = JSON.parse(raw);
      if (!payload || !payload.id) return null;
      state.preselectedContext = payload;
      return payload;
    } catch {
      state.preselectedContext = null;
      return null;
    } finally {
      try {
        window.sessionStorage.removeItem(PRESELECTED_PROPERTY_STORAGE_KEY);
      } catch {
        // no-op
      }
    }
  }

  function resetSimulationFormFields() {
    const entrega = resolvePropertyDelivery(state.imovelSelecionado);
    setValue(ids.financiamento, "");
    setValue(ids.parcelaBanco, "");
    setValue(ids.fgts, "");
    setValue(ids.subsidio, "");
    setValue(ids.chequeMoradia, "");
    setValue(ids.entrada, "");
    setOverpriceFieldState(0);
    setValue(ids.descontoImovel, "");
    setValue(ids.parceiroSimulacao, PARTNER_CREDITUR);
    refreshSelectUi(document.getElementById(ids.parceiroSimulacao));
    applyCrediturDefaultTerms({ force: true });
    state.crediturSemestres = [getCrediturDefaultInterval()];
    renderCrediturSemestres({ preserve: false });
    syncNegotiatedValueField();
    setValue(ids.preObraValor, "");
    setValue(ids.posObraValor, "");
    setValue(ids.intermediariaValor, "");
    setValue(ids.intermediariaQtd, "0");
    setValue(ids.anualValor, "");
    setValue(ids.anualQtd, "0");
    setValue(ids.anualPrimeiraData, "");
    setValue(ids.semestralValor, "");
    setValue(ids.semestralQtd, "0");
    setValue(ids.semestralPrimeiraData, "");
    setValue(ids.reforcoValor, "");
    setValue(ids.reforcoQtd, "0");
    setValue(ids.observacoes, "");
    setValue(ids.mesesPre, String(CREDITUR_PRE_DEFAULT_MONTHS));
    setValue(ids.mesesPos, String(CREDITUR_POST_DEFAULT_MONTHS));
    syncPostDeliveryFieldConstraints();
    syncCashflowInstallmentFields();
    renderIntermediaryDateFields({ preserve: false });
    syncRecurringDateFields();
  }

  function applyClientSimulationDefaults() {
    const parametros = state.clienteSelecionado?.parametros_simulacao || {};
    if (!parametros || typeof parametros !== "object") return;

    const moneyDefaults = [
      [ids.financiamento, parametros.financiamento_caixa],
      [ids.fgts, parametros.fgts],
      [ids.subsidio, parametros.subsidio],
      [ids.chequeMoradia, parametros.cheque_moradia],
      [ids.preObraValor, parametros.parcela_pre_obra_valor],
      [ids.posObraValor, parametros.parcela_pos_obra_valor],
      [ids.intermediariaValor, parametros.parcela_intermediaria_valor],
      [ids.anualValor, parametros.parcela_anual_valor],
      [ids.semestralValor, parametros.parcela_semestral_valor],
      [ids.reforcoValor, parametros.parcela_reforco_valor],
    ];

    moneyDefaults.forEach(([id, valor]) => {
      const numero = parseMoney(valor);
      if (numero > 0) setValue(id, formatMoney(numero));
    });
    syncClientLockedMoneyFields();
    syncClientInstallmentField();

    const numericDefaults = [
      [ids.intermediariaQtd, parametros.parcelas_intermediarias_quantidade],
      [ids.anualQtd, parametros.parcelas_anuais_quantidade],
      [ids.semestralQtd, parametros.parcelas_semestrais_quantidade],
      [ids.reforcoQtd, parametros.parcelas_reforco_quantidade],
    ];

    numericDefaults.forEach(([id, valor]) => {
      if (valor === null || valor === undefined || valor === "") return;
      setValue(id, String(toNumber(valor, 0)));
    });

    if (parametros.observacoes_comerciais) {
      setValue(ids.observacoes, parametros.observacoes_comerciais);
    }
    renderIntermediaryDateFields({ preserve: false });
    syncRecurringDateFields();
  }

  function extractSavedParcelPreset(parcelas, tipo) {
    const list = Array.isArray(parcelas)
      ? parcelas.filter((parcela) => normalizeSearch(parcela?.tipo) === normalizeSearch(tipo))
      : [];
    if (!list.length) return { quantidade: 0, valor: 0 };
    return {
      quantidade: list.length,
      valor: parseMoney(list[0]?.valor || 0),
    };
  }

  function normalizeSavedDateValue(value) {
    const raw = String(value || "").trim().slice(0, 10);
    return parseIsoDate(raw) ? raw : "";
  }

  function extractSavedIntermediaryItems(parcelas) {
    const list = Array.isArray(parcelas)
      ? parcelas.filter((parcela) => normalizeSearch(parcela?.tipo) === normalizeSearch("intermediaria"))
      : [];
    return list.map((item) => ({
      valor: parseMoney(firstFilled(item?.valor_total_cliente, item?.valor, 0)),
      data: normalizeSavedDateValue(item?.vencimento),
    })).filter((item) => item.valor > 0);
  }

  function applyIntermediaryItemsToRows(items) {
    const list = Array.isArray(items) ? items.filter((item) => parseMoney(item?.valor) > 0).slice(0, 24) : [];
    setValue(ids.intermediariaQtd, String(list.length));
    renderIntermediaryDateFields({ preserve: false });
    const container = document.getElementById(ids.intermediariaDatas);
    if (!container) return;

    Array.from(container.querySelectorAll("[data-intermediaria-row]")).forEach((row, index) => {
      const item = list[index] || {};
      const valueInput = row.querySelector("input[data-intermediaria-value]");
      const dateInput = row.querySelector("input[data-intermediaria-date]");
      if (valueInput instanceof HTMLInputElement) {
        const valor = parseMoney(item.valor);
        valueInput.value = valor > 0 ? formatMoney(valor) : "";
      }
      if (dateInput instanceof HTMLInputElement && item.data) {
        dateInput.value = clampDateFromToday(item.data, getIntermediaryDefaultDate(index, list.length).mesPadrao);
        refreshDatePickerUi(dateInput);
      }
    });
  }

  function buildSavedSimulationResult(simulacao, propertyOverride = null) {
    const item = simulacao || {};
    const snapshot = item.payload_snapshot || {};
    const calculo = snapshot.calculo || {};
    const resumo = calculo.resumo_operacao || {};
    const clienteSnapshot = calculo.cliente || {};
    const imovelNormalizado = normalizePropertyForUi(propertyOverride || calculo.imovel || state.imovelSelecionado || null);
    const entregaDinamica = resolvePropertyDelivery(imovelNormalizado);
    const demonstrativo = Array.isArray(calculo.demonstrativo) && calculo.demonstrativo.length
      ? calculo.demonstrativo
      : Array.isArray(item.demonstrativo) ? item.demonstrativo : [];

    return {
      ...calculo,
      aprovacao_excecao: calculo.aprovacao_excecao || item.aprovacao_excecao || null,
      cliente: {
        ...clienteSnapshot,
        cliente: clienteSnapshot.cliente || state.clienteSelecionado || {},
        renda_total: firstFilled(clienteSnapshot.renda_total, item.renda_total, state.consolidacaoCliente?.renda_total),
        limite_comprometimento: firstFilled(
          clienteSnapshot.limite_comprometimento,
          item.limite_comprometimento,
          state.consolidacaoCliente?.limite_comprometimento
        ),
      },
      imovel: imovelNormalizado,
      resumo_operacao: {
        ...resumo,
        renda_total: firstFilled(resumo.renda_total, item.renda_total, state.consolidacaoCliente?.renda_total),
        limite_comprometimento: firstFilled(
          resumo.limite_comprometimento,
          item.limite_comprometimento,
          state.consolidacaoCliente?.limite_comprometimento
        ),
        parcela_cliente_maxima: firstFilled(
          resumo.parcela_cliente_maxima,
          item.parcela_cliente_maxima,
          item.limite_comprometimento,
          state.consolidacaoCliente?.limite_comprometimento
        ),
        parcela_cliente_informada: firstFilled(
          resumo.parcela_cliente_informada,
          item.parcela_cliente_informada,
          item.parcela_cliente_maxima
        ),
        percentual_comprometimento: firstFilled(resumo.percentual_comprometimento, item.percentual_comprometimento),
        valor_imovel: firstFilled(resumo.valor_imovel, item.valor_imovel, propertyOverride?.valor),
        valor_total_operacao_bruto: firstFilled(resumo.valor_total_operacao_bruto, item.valor_total_operacao_bruto),
        valor_total_operacao: firstFilled(resumo.valor_total_operacao, item.valor_total_operacao),
        valor_total_pago_cliente: firstFilled(resumo.valor_total_pago_cliente, item.valor_total_pago_cliente),
        valor_total_pago_cliente_exclui_incentivo: firstFilled(
          resumo.valor_total_pago_cliente_exclui_incentivo,
          item.valor_total_pago_cliente_exclui_incentivo,
          resumo.valor_total_pago_cliente,
          item.valor_total_pago_cliente
        ),
        valor_total_coberto_cliente_incentivo: firstFilled(
          resumo.valor_total_coberto_cliente_incentivo,
          item.valor_total_coberto_cliente_incentivo,
          resumo.valor_total_pago_cliente_com_incentivo
        ),
        financiamento_caixa: firstFilled(resumo.financiamento_caixa, item.financiamento_caixa),
        parcela_financiamento_banco: firstFilled(resumo.parcela_financiamento_banco, item.parcela_financiamento_banco),
        parcela_banco_obra_atual: firstFilled(resumo.parcela_banco_obra_atual, item.parcela_banco_obra_atual),
        parcela_banco_obra_entrega: firstFilled(resumo.parcela_banco_obra_entrega, item.parcela_banco_obra_entrega),
        parcela_7lm_media_pre: firstFilled(resumo.parcela_7lm_media_pre, item.parcela_7lm_media_pre),
        parcela_7lm_primeira_pre: firstFilled(resumo.parcela_7lm_primeira_pre, item.parcela_7lm_primeira_pre),
        parcela_7lm_ultima_pre: firstFilled(resumo.parcela_7lm_ultima_pre, item.parcela_7lm_ultima_pre),
        parcela_7lm_pos: firstFilled(resumo.parcela_7lm_pos, item.parcela_7lm_pos),
        capacidade_pre_obra_7lm_atual: firstFilled(resumo.capacidade_pre_obra_7lm_atual, item.capacidade_pre_obra_7lm_atual),
        capacidade_pos_obra_7lm: firstFilled(resumo.capacidade_pos_obra_7lm, item.capacidade_pos_obra_7lm),
        capacidade_pos_obra_total_7lm: firstFilled(resumo.capacidade_pos_obra_total_7lm, item.capacidade_pos_obra_total_7lm),
        percentual_conclusao_obra: firstFilled(resumo.percentual_conclusao_obra, item.percentual_conclusao_obra),
        fgts: firstFilled(resumo.fgts, item.fgts),
        subsidio: firstFilled(resumo.subsidio, item.subsidio),
        cheque_moradia: firstFilled(resumo.cheque_moradia, item.cheque_moradia),
        entrada: firstFilled(resumo.entrada, item.entrada),
        pro_soluto_total: firstFilled(resumo.pro_soluto_total, item.pro_soluto_total),
        sobrepreco: firstFilled(resumo.sobrepreco, item.sobrepreco),
        desconto_imovel: firstFilled(resumo.desconto_imovel, item.desconto_imovel),
        incentivo_7lm: firstFilled(resumo.incentivo_7lm, item.incentivo_7lm, resumo.desconto_imovel, item.desconto_imovel),
        valor_fechamento_inicial: firstFilled(
          resumo.valor_fechamento_inicial,
          item.valor_fechamento_inicial
        ),
        valor_garantido: firstFilled(
          resumo.valor_garantido,
          item.valor_garantido,
          imovelNormalizado?.valor_garantido
        ),
        valor_garantido_real: firstFilled(
          resumo.valor_garantido_real,
          item.valor_garantido_real,
          resumo.valor_fechamento_inicial,
          item.valor_fechamento_inicial
        ),
        valor_garantido_planejado: firstFilled(
          resumo.valor_garantido_planejado,
          item.valor_garantido_planejado,
          resumo.valor_garantido,
          item.valor_garantido,
          imovelNormalizado?.valor_garantido_planejado,
          imovelNormalizado?.valor_garantido
        ),
        valor_garantido_pre_obra_planejado: firstFilled(
          resumo.valor_garantido_pre_obra_planejado,
          item.valor_garantido_pre_obra_planejado,
          imovelNormalizado?.valor_garantido_pre_obra_planejado
        ),
        valor_garantido_pre_obra_real: firstFilled(
          resumo.valor_garantido_pre_obra_real,
          item.valor_garantido_pre_obra_real,
          resumo.valor_projetado_entrega,
          item.valor_projetado_entrega
        ),
        percentual_captacao_ate_entrega: firstFilled(
          resumo.percentual_captacao_ate_entrega,
          item.percentual_captacao_ate_entrega,
          imovelNormalizado?.percentual_captacao_ate_entrega
        ),
        valor_parcela_minima_pre_obra: firstFilled(
          resumo.valor_parcela_minima_pre_obra,
          item.valor_parcela_minima_pre_obra,
          imovelNormalizado?.valor_parcela_minima_pre_obra,
          0
        ),
        percentual_fechamento_inicial: firstFilled(
          resumo.percentual_fechamento_inicial,
          item.percentual_fechamento_inicial
        ),
        percentual_fechamento_minimo: firstFilled(
          resumo.percentual_fechamento_minimo,
          item.percentual_fechamento_minimo,
          imovelNormalizado?.percentual_fechamento_minimo,
          0.7
        ),
        classificacao_fechamento_inicial: firstFilled(
          resumo.classificacao_fechamento_inicial,
          item.classificacao_fechamento_inicial
        ),
        percentual_projetado_entrega: firstFilled(
          resumo.percentual_projetado_entrega,
          item.percentual_projetado_entrega
        ),
        valor_projetado_entrega: firstFilled(
          resumo.valor_projetado_entrega,
          item.valor_projetado_entrega
        ),
        classificacao_projecao_entrega: firstFilled(
          resumo.classificacao_projecao_entrega,
          item.classificacao_projecao_entrega
        ),
        saldo_pos_entrega: firstFilled(resumo.saldo_pos_entrega, item.saldo_pos_entrega),
        meses_pre_entrega: entregaDinamica.mesesPreEntrega,
        meses_pos_entrega: normalizePostDeliveryMonths(
          firstFilled(resumo.meses_pos_entrega_configurado, resumo.meses_pos_entrega, item.meses_pos_entrega_configurado, item.meses_pos_entrega, getPreferredPostDeliveryMonths(entregaDinamica.mesesPreEntrega)),
          getPreferredPostDeliveryMonths(entregaDinamica.mesesPreEntrega),
          entregaDinamica.mesesPreEntrega
        ),
        meses_pos_entrega_configurado: normalizePostDeliveryMonths(
          firstFilled(resumo.meses_pos_entrega_configurado, item.meses_pos_entrega_configurado, item.meses_pos_entrega, getPreferredPostDeliveryMonths(entregaDinamica.mesesPreEntrega)),
          getPreferredPostDeliveryMonths(entregaDinamica.mesesPreEntrega),
          entregaDinamica.mesesPreEntrega
        ),
        status_comercial: firstFilled(resumo.status_comercial, item.status_comercial),
        status_simulacao: firstFilled(resumo.status_simulacao, item.status_simulacao),
        bloqueios: Array.isArray(resumo.bloqueios) ? resumo.bloqueios : [],
        atenções: Array.isArray(resumo.atenções) ? resumo.atenções : [],
        sugestões: Array.isArray(resumo.sugestões) ? resumo.sugestões : [],
      },
      demonstrativo,
    };
  }

  function applySavedSimulationToForm(simulacao) {
    const item = simulacao || {};
    const calculoSnapshot = item.payload_snapshot?.calculo || {};
    const resumoSnapshot = calculoSnapshot.resumo_operacao || {};
    const parceiroSalvo = normalizeSimulationPartner(firstFilled(
      resumoSnapshot.parceiro_simulacao,
      calculoSnapshot.imovel?.parceiro_simulacao,
      item.parceiro_simulacao,
      PARTNER_STANDARD
    ));
    setValue(ids.parceiroSimulacao, parceiroSalvo);
    const mesesPreSalvo = normalizePreDeliveryMonths(
      firstFilled(
        resumoSnapshot.meses_pre_entrega,
        calculoSnapshot.imovel?.meses_pre_entrega,
        item.meses_pre_entrega,
        state.imovelSelecionado?.meses_pre_entrega,
        resolvePropertyDelivery(state.imovelSelecionado).mesesPreEntrega
      )
    );
    const mesesPosConfigurado = normalizePostDeliveryMonths(
      resumoSnapshot.meses_pos_entrega_configurado
        ?? resumoSnapshot.meses_pos_entrega
        ?? calculoSnapshot.imovel?.meses_pos_entrega_configurado
        ?? calculoSnapshot.imovel?.meses_pos_entrega
        ?? item.meses_pos_entrega
        ?? item.meses_pos_entrega_configurado
        ?? state.imovelSelecionado?.meses_pos_entrega_configurado
        ?? state.imovelSelecionado?.meses_pos_entrega
        ?? getPreferredPostDeliveryMonths(mesesPreSalvo),
      getPreferredPostDeliveryMonths(mesesPreSalvo),
      mesesPreSalvo
    );
    const demonstrativoSnapshot = item.payload_snapshot?.calculo?.demonstrativo;
    const demonstrativo = Array.isArray(demonstrativoSnapshot) && demonstrativoSnapshot.length
      ? demonstrativoSnapshot
      : Array.isArray(item.demonstrativo) ? item.demonstrativo : [];
    const intermediaria = extractSavedParcelPreset(demonstrativo, "intermediaria");
    const intermediariaItens = extractSavedIntermediaryItems(demonstrativo);
    const anual = extractSavedParcelPreset(demonstrativo, "anual");
    const semestral = extractSavedParcelPreset(demonstrativo, "semestral");
    const reforco = extractSavedParcelPreset(demonstrativo, "reforco");
    const snapshotExtra = item.payload_snapshot?.extra || {};

    setValue(ids.financiamento, formatMoney(parseMoney(item.financiamento_caixa || 0)));
    setValue(ids.parcelaBanco, formatMoney(parseMoney(
      item.parcela_financiamento_banco
      || item.payload_snapshot?.calculo?.resumo_operacao?.parcela_financiamento_banco
      || 0
    )));
    setValue(ids.fgts, formatMoney(parseMoney(item.fgts || 0)));
    setValue(ids.subsidio, formatMoney(parseMoney(item.subsidio || 0)));
    setValue(ids.chequeMoradia, formatMoney(parseMoney(item.cheque_moradia || item.payload_snapshot?.calculo?.resumo_operacao?.cheque_moradia || 0)));
    setValue(ids.entrada, formatMoney(parseMoney(item.entrada || 0)));
    setOverpriceFieldState(parseMoney(item.sobrepreco || 0));
    setValue(ids.descontoImovel, formatMoney(parseMoney(firstFilled(
      item.incentivo_7lm,
      item.desconto_imovel,
      item.payload_snapshot?.calculo?.resumo_operacao?.incentivo_7lm,
      item.payload_snapshot?.calculo?.resumo_operacao?.desconto_imovel,
      0
    ))));
    syncNegotiatedValueField(item.payload_snapshot?.calculo?.resumo_operacao || {});
    setValue(ids.preObraValor, item.parcela_pre_obra_valor ? formatMoney(parseMoney(item.parcela_pre_obra_valor)) : "");
    setValue(ids.posObraValor, item.parcela_pos_obra_valor ? formatMoney(parseMoney(item.parcela_pos_obra_valor)) : "");
    setValue(ids.mesesPre, String(mesesPreSalvo));
    setValue(ids.mesesPos, String(mesesPosConfigurado));
    syncPostDeliveryFieldConstraints();
    const crediturIntervalsSnapshot = Array.isArray(resumoSnapshot.creditur_intervalos_parcelas_ajustados) && resumoSnapshot.creditur_intervalos_parcelas_ajustados.length
      ? resumoSnapshot.creditur_intervalos_parcelas_ajustados
      : Array.isArray(resumoSnapshot.creditur_intervalos_parcelas) && resumoSnapshot.creditur_intervalos_parcelas.length
      ? resumoSnapshot.creditur_intervalos_parcelas
      : Array.isArray(resumoSnapshot.creditur_degraus_semestrais) ? resumoSnapshot.creditur_degraus_semestrais : [];
    state.crediturSemestres = normalizeCrediturIntervalList(
      crediturIntervalsSnapshot.length
        ? buildCrediturDisplayIntervalsFromAdjusted(crediturIntervalsSnapshot)
        : isCrediturPartner(parceiroSalvo) ? buildCrediturIntervalsFromMonthlyFields() : []
    );
    renderCrediturSemestres({ preserve: false });
    setValue(ids.intermediariaValor, intermediaria.valor > 0 ? formatMoney(intermediaria.valor) : "");
    setValue(ids.anualValor, anual.valor > 0 ? formatMoney(anual.valor) : "");
    setValue(ids.anualQtd, String(anual.quantidade || 0));
    setValue(ids.semestralValor, semestral.valor > 0 ? formatMoney(semestral.valor) : "");
    setValue(ids.semestralQtd, String(semestral.quantidade || 0));
    setValue(ids.reforcoValor, reforco.valor > 0 ? formatMoney(reforco.valor) : "");
    setValue(ids.reforcoQtd, String(reforco.quantidade || 0));
    setValue(ids.observacoes, firstFilled(snapshotExtra.observacoes_comerciais, ""));
    syncClientLockedMoneyFields();
    applyIntermediaryItemsToRows(intermediariaItens);
    syncRecurringDateFields();
  }

  function applyPropertyTimelineDefaults() {
    const imovel = state.imovelSelecionado;
    if (!imovel) return;
    const entrega = resolvePropertyDelivery(imovel);
    const mesesPre = isCrediturSelected()
      ? normalizePreDeliveryMonths(readValue(ids.mesesPre), Math.min(entrega.mesesPreEntrega, CREDITUR_PRE_MAX_MONTHS))
      : normalizePreDeliveryMonths(readValue(ids.mesesPre), entrega.mesesPreEntrega);
    const mesesPosPreferidos = getPreferredPostDeliveryMonths(mesesPre);
    imovel.meses_pos_entrega = mesesPosPreferidos;
    imovel.meses_pos_entrega_configurado = mesesPosPreferidos;
    setValue(ids.mesesPre, String(mesesPre));
    setValue(ids.mesesPos, String(mesesPosPreferidos));
    syncPostDeliveryFieldConstraints();
    syncEntryOverflowToOverprice();
    renderIntermediaryDateFields();
    syncRecurringDateFields();
  }

  async function loadSavedSimulationById(simulationId, { silentFeedback = false } = {}) {
    const targetId = String(simulationId || "");
    if (!targetId) return null;

    const payload = await api(endpoint(ENDPOINTS.simulacaoPorId, { id: targetId }), "GET");
    const item = payload?.item;
    if (!item?.id) throw new Error("Simulação não encontrada para continuar o atendimento.");

    if (item.cliente_id && String(state.clienteSelecionado?.id || "") !== String(item.cliente_id)) {
      await selectClientById(item.cliente_id);
    }

    const targetPropertyId = String(item.imovel?.id || item.imovel_id || "");
    if (targetPropertyId) {
      const normalized = await loadPropertyById(targetPropertyId);
      state.imovelSelecionado = normalizePropertyForUi(normalized);
      state.fotoAtivaIndice = 0;
      setValue(ids.valorImovel, formatMoney(parseMoney(state.imovelSelecionado.valor || 0)));
      applyPropertyTimelineDefaults();
    }

    resetSimulationFormFields();
    applySavedSimulationToForm(item);
    state.simulacaoSalvaId = item.id;
    state.simulacaoAutosaveId = item.id;
    state.simulacaoAtual = buildSavedSimulationResult(item, state.imovelSelecionado);

    renderSummaryFromResult(state.simulacaoAtual, { autoOpenNotifications: false });
    renderSuggestions();
    renderCompareTray();
    renderPropertyPreview();
    updateActionButtons();

    if (!silentFeedback) {
      showFeedback("success", "Reserva recuperada. A simulação salva foi carregada para continuar o atendimento.");
    }

    return item;
  }

  async function releaseReservationByPropertyId(propertyId, { silentFeedback = false } = {}) {
    const targetId = String(propertyId || "");
    if (!targetId) return;

    const resposta = await api(endpoint(ENDPOINTS.liberar, { id: targetId }), "POST", {
      observacoes: readValue(ids.observacoes) || null,
    });

    if (String(state.imovelSelecionado?.id || "") === targetId) {
      await refreshPropertyAfterOperation(targetId);
      setPropertyStatus("Reserva liberada");
    }

    await refreshClientContext();
    if (state.clienteSelecionado?.id) {
      await runSuggestions({ silent: true, preserveSelection: true, source: "acao" });
    }
    renderSuggestions();
    renderPropertyPreview();
    updateActionButtons();

    if (!silentFeedback) {
      showActionMessage(
        "success",
        firstFilled(resposta?.mensagem, "Reserva liberada e simulação reservada do cliente atualizada.")
      );
    }
  }

  async function openReservationFlow(reserva, { continueSimulation = false, silentFeedback = false } = {}) {
    if (!reserva?.imovel_id) {
      throw new Error("Não foi possível localizar o imóvel dessa reserva.");
    }

    await focusPropertyCandidate(
      {
        id: reserva.imovel_id,
        imovel: normalizePropertyForUi(reserva.imovel || {
          id: reserva.imovel_id,
          status: isPendingApprovalReservation(reserva) ? "Pendente de aprovação" : "Reservado",
        }),
        resumo_operacao: {},
        classificacao: reserva.negociacao?.status_simulacao || "",
      },
      {
        silentFeedback: true,
        message: "Imóvel reservado selecionado.",
      }
    );

    if (continueSimulation && reserva.simulacao_id) {
      await loadSavedSimulationById(reserva.simulacao_id, { silentFeedback: true });
      if (!silentFeedback) {
        showFeedback("success", "Reserva carregada com o fluxo salvo para você seguir até a venda.");
      }
      return;
    }

    if (!silentFeedback) {
      showFeedback(
        "info",
        isPendingApprovalReservation(reserva)
          ? "Solicitação pendente carregada. Você pode acompanhar a operação ou cancelar o envio ao gestor."
          : "Imóvel reservado carregado. Escolha se deseja recalcular, vender ou liberar a reserva."
      );
    }
  }

  function normalizePropertyForUi(raw) {
    const item = raw || {};
    const entrega = resolvePropertyDelivery(item);
    const detalhes = item.detalhes_comerciais || {};
    const localizacao = item.localizacao || {};
    const agrupamento = item.agrupamento || {};
    const midias = Array.isArray(item.midias) ? item.midias.map(normalizeMediaItem) : [];
    const midiasFotos = Array.isArray(item.midias_fotos)
      ? item.midias_fotos.map(normalizeMediaItem)
      : midias.filter((media) => normalizeSearch(media.tipo_arquivo) === "foto");
    const midiasVideos = Array.isArray(item.midias_videos)
      ? item.midias_videos.map(normalizeMediaItem)
      : midias.filter((media) => normalizeSearch(media.tipo_arquivo) === "video");
    const fotoMidia = midiasFotos.find((media) => media.eh_principal)?.caminho_arquivo || midiasFotos[0]?.caminho_arquivo || "";
    const fotoPrincipal = firstFilled(normalizeMediaPath(item.foto_principal), fotoMidia);
    const empreendimento = firstFilled(item.empreendimento, detalhes.empreendimento, agrupamento.nome, agrupamento.localidade, item.bairro, item.cidade);
    const enderecoFormatado = firstFilled(
      item.endereco_formatado,
      localizacao.endereco_formatado,
      [item.endereco, item.bairro, item.cidade, item.estado].filter(Boolean).join(", ")
    );
    const mapQuery = firstFilled(
      localizacao.consulta,
      item.map_query,
      enderecoFormatado,
      [item.endereco, item.bairro, item.cidade, item.estado].filter(Boolean).join(", ")
    );
    const mapLinks = buildGoogleMapsLinks(mapQuery);
    const unidade = firstFilled(item.unidade, detalhes.unidade, agrupamento.unidade);
    const bloco = firstFilled(item.bloco, detalhes.bloco, agrupamento.bloco);
    const tipoImovel = firstFilled(item.tipologia, item.tipo_imovel, detalhes.tipologia_principal, "Imóvel");
    const tituloComercial = unidade && bloco
      ? `${tipoImovel} ${unidade} - Bloco ${bloco}`
      : firstFilled(item.titulo, unidade ? `${tipoImovel} ${unidade}` : "", "Unidade");
    const mesesPosConfigurado = normalizePostDeliveryMonths(
      firstFilled(item.meses_pos_entrega_configurado, item.meses_pos_entrega, getPreferredPostDeliveryMonths(item.meses_pre_entrega)),
      getPreferredPostDeliveryMonths(item.meses_pre_entrega),
      item.meses_pre_entrega
    );
    const descontoPolicy = resolvePropertyDiscountPolicy(item);

    return {
      ...item,
      id: String(item.id || item.identificador_imovel || ""),
      titulo: tituloComercial,
      titulo_original: firstFilled(item.titulo_original, item.titulo),
      descricao: firstFilled(item.descricao, detalhes.descricao_comercial),
      empreendimento,
      tipologia: firstFilled(item.tipologia, item.tipo_imovel, detalhes.tipologia_principal),
      tipo_imovel: firstFilled(item.tipo_imovel, item.tipologia),
      cidade: firstFilled(item.cidade, localizacao.cidade),
      bairro: firstFilled(item.bairro, localizacao.bairro),
      estado: firstFilled(item.estado, localizacao.estado),
      endereco: firstFilled(item.endereco, localizacao.endereco, enderecoFormatado),
      endereco_formatado: enderecoFormatado,
      quartos: toNumber(item.quartos ?? item.dormitorios ?? 0, 0),
      dormitorios: toNumber(item.dormitorios ?? item.quartos ?? 0, 0),
      banheiros: toNumber(item.banheiros ?? 0, 0),
      vagas: toNumber(item.vagas ?? item.vagas_garagem ?? 0, 0),
      vagas_garagem: toNumber(item.vagas_garagem ?? item.vagas ?? 0, 0),
      tipo_garagem: firstFilled(item.tipo_garagem, "carro"),
      area_m2: toNumber(item.area_m2 ?? 0, 0),
      valor: parseMoney(item.valor || 0),
      valor_original: parseMoney(firstFilled(item.valor_original, item.valor, 0)),
      valor_negociado: parseMoney(firstFilled(item.valor_total_operacao, item.valor_negociado, item.valor, 0)),
      valor_total_operacao: parseMoney(firstFilled(item.valor_total_operacao, item.valor_negociado, 0)),
      valor_liquido_negociacao: parseMoney(firstFilled(item.valor_liquido_negociacao, item.valor_total_operacao, item.valor_negociado, item.valor, 0)),
      desconto_imovel: parseMoney(item.desconto_imovel || 0),
      incentivo_7lm: parseMoney(firstFilled(item.incentivo_7lm, item.desconto_imovel, 0)),
      foto_principal: fotoPrincipal,
      status: firstFilled(item.status, "Disponível"),
      data_entrega: entrega.dataEntrega,
      meses_pre_entrega: entrega.mesesPreEntrega,
      meses_pos_entrega: normalizePostDeliveryMonths(item.meses_pos_entrega, mesesPosConfigurado),
      meses_pos_entrega_configurado: mesesPosConfigurado,
      percentual_conclusao_obra: toNumber(item.percentual_conclusao_obra ?? 0, 0),
      percentual_fechamento_minimo: toNumber(item.percentual_fechamento_minimo ?? 0.7, 0.7),
      valor_garantido: resolveGuaranteedValue(item),
      valor_garantido_planejado: resolveGuaranteedValue(item),
      valor_garantido_pre_obra_planejado: resolvePlannedDeliveryCaptureValue(item),
      percentual_captacao_ate_entrega: resolveDeliveryCapturePercent(item),
      valor_parcela_minima_pre_obra: resolveMinimumPreWorkValue(item),
      valor_desconto_minimo: descontoPolicy.minimo,
      valor_incentivo_minimo: descontoPolicy.minimo,
      valor_desconto_maximo: descontoPolicy.maximoConfigurado,
      valor_incentivo_maximo: descontoPolicy.maximoConfigurado,
      desconto_imovel_maximo_efetivo: descontoPolicy.maximoEfetivo,
      incentivo_7lm_maximo_efetivo: descontoPolicy.maximoEfetivo,
      desconto_imovel_reducao_por_reservas_vendas: descontoPolicy.reducao,
      incentivo_7lm_reducao_por_reservas_vendas: descontoPolicy.reducao,
      quantidade_desconto_reservas_vendas: descontoPolicy.quantidade,
      quantidade_incentivo_reservas_vendas: descontoPolicy.quantidade,
      localizacao,
      agrupamento,
      detalhes_comerciais: detalhes,
      map_query: mapQuery,
      map_url: firstFilled(localizacao.google_maps_url, item.map_url, mapLinks.searchUrl),
      map_embed_url: firstFilled(localizacao.google_maps_embed_url, item.map_embed_url, mapLinks.embedUrl),
      map_route_url: firstFilled(localizacao.google_maps_rota_url, item.map_route_url, mapLinks.routeUrl),
      midias,
      midias_fotos: midiasFotos,
      midias_videos: midiasVideos,
      quantidade_fotos: toNumber(item.quantidade_fotos ?? midiasFotos.length, midiasFotos.length),
      quantidade_videos: toNumber(item.quantidade_videos ?? midiasVideos.length, midiasVideos.length),
      diferenciais_comerciais: Array.isArray(item.diferenciais_comerciais) ? item.diferenciais_comerciais.filter(Boolean) : [],
      reserva_ativa: item.reserva_ativa ? normalizeReservationForUi(item.reserva_ativa) : null,
    };
  }

  async function api(url, method = "GET", body = null) {
    const options = { method };
    if (body !== null && body !== undefined) {
      options.body = JSON.stringify(body);
      options.headers = { "Content-Type": "application/json" };
    }
    const canRetry = String(method || "GET").toUpperCase() === "GET";
    const attempts = canRetry ? 2 : 1;
    let lastError = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await shared.fetchJson(url, options);
      } catch (error) {
        lastError = error;
        const message = String(error?.message || "").toLowerCase();
        const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
        const transient = status >= 500 || message.includes("internal server error") || message.includes("failed to fetch");
        if (!canRetry || !transient || attempt >= attempts - 1) break;
        await new Promise((resolve) => window.setTimeout(resolve, 550));
      }
    }

    throw lastError;
  }

  async function apiMultipart(url, formData) {
    const headers = { Accept: "application/json" };
    const token = typeof shared?.getAccessToken === "function" ? shared.getAccessToken() : "";
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers,
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && typeof shared?.redirectToLogin === "function") {
      shared.redirectToLogin();
    }
    if (!response.ok) {
      throw new Error(payload?.mensagem || payload?.detail || "Não foi possível enviar o PDF.");
    }
    return payload;
  }

  function messageFromError(error, fallback) {
    const detail = error?.detail;
    if (detail && typeof detail === "object") {
      const msg = String(detail.mensagem || "").trim();
      if (msg) return msg;
    }
    const text = String(error?.message || "").trim();
    if (!text) return fallback;
    if (text === "[object Object]") return fallback;
    if (text.toLowerCase() === "not found") return "Recurso não encontrado. Atualize a página e tente novamente.";
    return text;
  }

  function normalizeSearch(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function closeSelectPanels(exceptWrap = null) {
    document.querySelectorAll(".tl-clientes-select-wrap").forEach((wrap) => {
      if (exceptWrap && wrap === exceptWrap) return;
      wrap.classList.remove("is-open");
      wrap.querySelector(".tl-clientes-select-options")?.classList.remove("is-open");
      wrap.querySelector(".tl-clientes-select-trigger")?.setAttribute("aria-expanded", "false");
      wrap.querySelector(".tl-clientes-select-options")?.style.removeProperty("transform");
    });
  }

  function clampFloatingPanelToViewport(panel) {
    if (!(panel instanceof HTMLElement)) return;
    panel.style.removeProperty("transform");
    window.requestAnimationFrame(() => {
      const margin = window.innerWidth <= 480 ? 12 : 16;
      const rect = panel.getBoundingClientRect();
      let shift = 0;

      if (rect.right > window.innerWidth - margin) {
        shift = (window.innerWidth - margin) - rect.right;
      }

      if (rect.left + shift < margin) {
        shift += margin - (rect.left + shift);
      }

      if (Math.abs(shift) > 0.5) {
        panel.style.transform = `translateX(${Math.round(shift)}px)`;
      }
    });
  }

  function clampOpenFloatingPanels() {
    document
      .querySelectorAll(".tl-clientes-select-options.is-open, .tl-sim-datepicker")
      .forEach((panel) => clampFloatingPanelToViewport(panel));
  }

  function bindFloatingPanelViewportGuards() {
    if (document.body.dataset.simFloatingPanelBind === "true") return;
    document.body.dataset.simFloatingPanelBind = "true";
    window.addEventListener("resize", clampOpenFloatingPanels, { passive: true });
  }

  function getSelectOptionDisplayText(option) {
    if (!option) return "";
    const parceiroLabel = getSimulationPartnerLabel(option.value);
    if (parceiroLabel) return parceiroLabel;
    return option.textContent?.trim() || "";
  }

  function normalizeSelectDisplayLabels(select) {
    if (!(select instanceof HTMLSelectElement)) return;
    Array.from(select.options).forEach((option) => {
      const parceiroLabel = getSimulationPartnerLabel(option.value);
      if (parceiroLabel) option.textContent = parceiroLabel;
    });
  }

  function refreshSelectUi(select) {
    normalizeSelectDisplayLabels(select);
    const ui = select?._customUi;
    if (!ui) return;
    const selected = select.options[select.selectedIndex] || null;
    const selectedText = getSelectOptionDisplayText(selected) || "Selecione";
    ui.trigger.textContent = selectedText;
    ui.trigger.title = selectedText;
    ui.trigger.dataset.value = String(select.value || "");
    ui.options.querySelectorAll(".tl-clientes-select-option").forEach((button) => {
      const isSelected = button.dataset.value === String(select.value || "");
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  }

  function createSelectOptionButton(select, option) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tl-clientes-select-option";
    button.dataset.value = option.value;
    const label = document.createElement("span");
    label.textContent = getSelectOptionDisplayText(option);
    const state = document.createElement("strong");
    state.className = "tl-clientes-select-option__state";
    state.textContent = "Ativo";
    button.append(label, state);
    button.setAttribute("role", "option");
    if (option.disabled) button.disabled = true;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (option.disabled) return;
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      closeSelectPanels();
    });
    return button;
  }

  function rebuildSelectUi(select) {
    normalizeSelectDisplayLabels(select);
    const ui = select?._customUi;
    if (!ui) return;
    ui.options.innerHTML = "";
    Array.from(select.options).forEach((option) => {
      ui.options.appendChild(createSelectOptionButton(select, option));
    });
    refreshSelectUi(select);
  }

  function setupSelect(select) {
    if (!select) return;
    normalizeSelectDisplayLabels(select);
    if (select.dataset.customizado === "true") {
      rebuildSelectUi(select);
      return;
    }
    const parent = select.parentElement;
    if (!parent) return;

    const wrap = document.createElement("div");
    wrap.className = "tl-clientes-select-wrap";
    parent.insertBefore(wrap, select);
    wrap.appendChild(select);

    select.classList.add("tl-clientes-select--native");
    select.dataset.customizado = "true";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "tl-clientes-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const options = document.createElement("div");
    options.className = "tl-clientes-select-options";
    options.setAttribute("role", "listbox");

    wrap.appendChild(trigger);
    wrap.appendChild(options);

    select._customUi = { wrap, trigger, options };
    rebuildSelectUi(select);

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      const isOpen = options.classList.contains("is-open");
      closeSelectPanels(isOpen ? null : wrap);
      if (!isOpen) {
        wrap.classList.add("is-open");
        options.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        clampFloatingPanelToViewport(options);
      }
    });

    select.addEventListener("change", () => refreshSelectUi(select));
  }

  function enableCustomSelects(root = document) {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    scope.querySelectorAll(".tl-sim-shell select, select.tl-clientes-select").forEach(setupSelect);

    if (document.body.dataset.simSelectBind === "true") return;
    document.body.dataset.simSelectBind = "true";

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".tl-clientes-select-wrap")) return;
      closeSelectPanels();
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeSelectPanels();
    });

    bindFloatingPanelViewportGuards();
  }

  function formatDatePickerDisplay(value) {
    const date = parseIsoDate(value);
    if (!date) return "dd/mm/aaaa";
    return new Intl.DateTimeFormat("pt-BR").format(date);
  }

  function datePickerMonthLabel(date) {
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
  }

  function refreshDatePickerUi(input) {
    const ui = input?._datePickerUi;
    if (!ui) return;
    const hasValue = Boolean(parseIsoDate(input.value));
    const display = hasValue ? formatDatePickerDisplay(input.value) : "";
    if (ui.manual && document.activeElement !== ui.manual) {
      ui.manual.value = display;
    }
    if (ui.manual) {
      ui.manual.classList.toggle("has-value", hasValue);
      ui.manual.title = hasValue ? formatDateLabel(input.value) : "";
    }
    ui.trigger.classList.toggle("has-value", hasValue);
    ui.trigger.title = hasValue ? formatDateLabel(input.value) : "Selecionar data";
  }

  function closeDatePickers(exceptWrap = null) {
    document.querySelectorAll(".tl-sim-date-picker-wrap.is-open").forEach((wrap) => {
      if (exceptWrap && wrap === exceptWrap) return;
      wrap.classList.remove("is-open");
      const input = wrap.querySelector('input[type="date"]');
      if (input instanceof HTMLInputElement) {
        delete input.dataset.datepickerMonth;
      }
      wrap.querySelector(".tl-sim-datepicker")?.remove();
    });
  }

  function getDatePickerBaseMonth(input) {
    const selected = parseIsoDate(input?.value);
    const stored = parseIsoDate(input?.dataset.datepickerMonth);
    const min = parseIsoDate(input?.min);
    const today = contractDate();
    const base = stored || selected || min || today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }

  function clampDateToInputRange(input, date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const min = parseIsoDate(input?.min);
    const max = parseIsoDate(input?.max);
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (min && current < min) return min;
    if (max && current > max) return max;
    return current;
  }

  function setDatePickerValue(input, date) {
    const next = clampDateToInputRange(input, date);
    input.value = next ? formatIsoDate(next) : "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    refreshDatePickerUi(input);
  }

  function commitManualDateInput(input) {
    const ui = input?._datePickerUi;
    const manual = ui?.manual;
    if (!(manual instanceof HTMLInputElement)) return;

    const text = manual.value.trim();
    if (!text) {
      if (input.value) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      refreshDatePickerUi(input);
      return;
    }

    const parsed = parseManualDate(text);
    if (!parsed) {
      refreshDatePickerUi(input);
      return;
    }

    setDatePickerValue(input, parsed);
  }

  function renderDatePickerPanel(input) {
    const ui = input?._datePickerUi;
    if (!ui) return;

    ui.panel?.remove();
    const panel = document.createElement("div");
    panel.className = "tl-sim-datepicker";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Selecionar data");

    const month = getDatePickerBaseMonth(input);
    input.dataset.datepickerMonth = formatIsoDate(month);
    const selectedIso = String(input.value || "");
    const todayIso = formatIsoDate(contractDate());
    const minIso = input.min || "";
    const maxIso = input.max || "";
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - firstDay.getDay());
    const weekdays = ["D", "S", "T", "Q", "Q", "S", "S"];

    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const iso = formatIsoDate(date);
      const outside = date.getMonth() !== month.getMonth();
      const disabled = (minIso && iso < minIso) || (maxIso && iso > maxIso);
      cells.push(`
        <button class="tl-sim-datepicker__cell ${outside ? "is-outside" : ""} ${iso === todayIso ? "is-today" : ""} ${iso === selectedIso ? "is-selected" : ""}" type="button" data-date="${escapeHtml(iso)}" ${disabled ? "disabled" : ""}>
          ${escapeHtml(String(date.getDate()))}
        </button>`);
    }

    panel.innerHTML = `
      <div class="tl-sim-datepicker__header">
        <button class="tl-sim-datepicker__nav" type="button" data-datepicker-action="prev" aria-label="Mês anterior"></button>
        <strong>${escapeHtml(datePickerMonthLabel(month))}</strong>
        <button class="tl-sim-datepicker__nav tl-sim-datepicker__nav--next" type="button" data-datepicker-action="next" aria-label="Próximo mês"></button>
      </div>
      <div class="tl-sim-datepicker__weekdays">${weekdays.map((day) => `<span>${escapeHtml(day)}</span>`).join("")}</div>
      <div class="tl-sim-datepicker__grid">${cells.join("")}</div>
      <div class="tl-sim-datepicker__footer">
        <button type="button" data-datepicker-action="clear">Limpar</button>
        <button type="button" data-datepicker-action="today">Hoje</button>
      </div>`;

    panel.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = event.target;
      if (!(target instanceof Element)) return;
      const actionButton = target.closest("[data-datepicker-action]");
      if (actionButton) {
        const action = actionButton.getAttribute("data-datepicker-action");
        const current = getDatePickerBaseMonth(input);
        if (action === "prev" || action === "next") {
          current.setMonth(current.getMonth() + (action === "next" ? 1 : -1));
          input.dataset.datepickerMonth = formatIsoDate(current);
          renderDatePickerPanel(input);
          return;
        }
        if (action === "clear") {
          input.value = "";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          refreshDatePickerUi(input);
          closeDatePickers();
          return;
        }
        if (action === "today") {
          setDatePickerValue(input, contractDate());
          closeDatePickers();
        }
        return;
      }

      const dayButton = target.closest("[data-date]");
      if (!dayButton || dayButton.hasAttribute("disabled")) return;
      const date = parseIsoDate(dayButton.getAttribute("data-date"));
      setDatePickerValue(input, date);
      closeDatePickers();
    });

    ui.panel = panel;
    ui.wrap.appendChild(panel);
    clampFloatingPanelToViewport(panel);
  }

  function setupDatePicker(input) {
    if (!(input instanceof HTMLInputElement) || input.dataset.simDateCustom === "true") return;
    const parent = input.parentElement;
    if (!parent) return;

    const wrap = document.createElement("div");
    wrap.className = "tl-sim-date-picker-wrap";
    parent.insertBefore(wrap, input);
    wrap.appendChild(input);

    input.classList.add("tl-sim-date-native");
    input.dataset.simDateCustom = "true";
    input.tabIndex = -1;

    const manualInput = document.createElement("input");
    manualInput.type = "text";
    manualInput.className = "tl-sim-date-manual";
    manualInput.placeholder = "dd/mm/aaaa";
    manualInput.inputMode = "numeric";
    manualInput.autocomplete = "off";
    manualInput.maxLength = 10;
    if (input.id) {
      manualInput.id = `${input.id}Manual`;
      document.querySelectorAll(`label[for="${input.id}"]`).forEach((label) => {
        label.setAttribute("for", manualInput.id);
      });
    }
    wrap.appendChild(manualInput);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "tl-sim-date-trigger";
    trigger.setAttribute("aria-label", "Abrir calendario");
    trigger.innerHTML = '<span class="tl-sim-date-trigger__icon" aria-hidden="true"></span>';
    wrap.appendChild(trigger);

    input._datePickerUi = {
      wrap,
      trigger,
      manual: manualInput,
      panel: null,
    };
    refreshDatePickerUi(input);

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      const isOpen = wrap.classList.contains("is-open");
      closeDatePickers(isOpen ? null : wrap);
      if (!isOpen) {
        delete input.dataset.datepickerMonth;
        wrap.classList.add("is-open");
        renderDatePickerPanel(input);
      }
    });
    manualInput.addEventListener("input", () => {
      const masked = maskManualDateValue(manualInput.value);
      if (manualInput.value !== masked) manualInput.value = masked;
      const parsed = parseManualDate(masked);
      if (parsed) {
        const next = clampDateToInputRange(input, parsed);
        input.value = next ? formatIsoDate(next) : "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        refreshDatePickerUi(input);
        if (wrap.classList.contains("is-open")) renderDatePickerPanel(input);
      } else if (!masked && input.value) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        refreshDatePickerUi(input);
      }
    });
    manualInput.addEventListener("change", () => commitManualDateInput(input));
    manualInput.addEventListener("blur", () => commitManualDateInput(input));
    input.addEventListener("change", () => refreshDatePickerUi(input));
    input.addEventListener("input", () => refreshDatePickerUi(input));
  }

  function enableCustomDatePickers(root = document) {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    scope.querySelectorAll('input[type="date"]').forEach(setupDatePicker);

    if (document.body.dataset.simDatePickerBind === "true") return;
    document.body.dataset.simDatePickerBind = "true";

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".tl-sim-date-picker-wrap")) return;
      closeDatePickers();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDatePickers();
    });

    bindFloatingPanelViewportGuards();
  }

  function collectUniqueFilterOptions(values, { numeric = false } = {}) {
    const map = new Map();
    values.forEach((value) => {
      const text = String(value ?? "").trim();
      if (!text) return;
      const key = numeric ? String(toNumber(text, NaN)) : normalizeSearch(text);
      if (!key || key === "NaN") return;
      if (!map.has(key)) map.set(key, numeric ? String(toNumber(text, 0)) : text);
    });
    return Array.from(map.values()).sort((a, b) => (
      numeric
        ? toNumber(a, 0) - toNumber(b, 0)
        : String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" })
    ));
  }

  function replaceFilterSelectOptions(id, values, emptyLabel, { numeric = false, labelForValue = null, fallbackValues = [] } = {}) {
    const select = document.getElementById(id);
    if (!(select instanceof HTMLSelectElement)) return;

    const previousValue = String(select.value || "");
    const options = collectUniqueFilterOptions([...fallbackValues, ...values], { numeric });
    select.innerHTML = "";

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = emptyLabel;
    select.appendChild(emptyOption);

    options.forEach((value) => {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = labelForValue ? labelForValue(value) : String(value);
      select.appendChild(option);
    });

    const hasPrevious = Array.from(select.options).some((option) => option.value === previousValue);
    if (previousValue && !hasPrevious) {
      const preservedOption = document.createElement("option");
      preservedOption.value = previousValue;
      preservedOption.textContent = labelForValue ? labelForValue(previousValue) : previousValue;
      select.appendChild(preservedOption);
    }

    select.value = previousValue && (hasPrevious || select.options.length > 1) ? previousValue : "";
    rebuildSelectUi(select);
  }

  function dormitoriosFilterLabel(value) {
    const total = toNumber(value, 0);
    if (!total) return String(value || "");
    return total === 1 ? "1 dormitório" : `${total} dormitórios`;
  }

  function getPropertyUnitForFilter(imovel) {
    return firstFilled(
      imovel?.unidade,
      imovel?.detalhes_comerciais?.unidade,
      imovel?.agrupamento?.unidade
    );
  }

  function getPropertyBlockForFilter(imovel) {
    return firstFilled(
      imovel?.bloco,
      imovel?.detalhes_comerciais?.bloco,
      imovel?.agrupamento?.bloco
    );
  }

  function getPropertyPriceForFilter(imovel) {
    const value = parseMoney(firstFilled(imovel?.valor, imovel?.valor_original, imovel?.valor_negociado));
    return value > 0 ? roundMoneyNumber(value) : 0;
  }

  function formatPriceRangeFilter(value) {
    const [minValue, maxValue] = String(value || "").split("|").map((item) => Number(item));
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return String(value || "");
    if (Math.abs(minValue - maxValue) < 0.01) return formatMoney(minValue);
    return `${formatMoney(minValue)} a ${formatMoney(maxValue)}`;
  }

  function buildPriceRangeOptions(imoveis) {
    const prices = collectUniqueFilterOptions(
      imoveis.map(getPropertyPriceForFilter).filter((value) => value > 0),
      { numeric: true }
    ).map((value) => roundMoneyNumber(value));

    if (prices.length <= 12) {
      return prices.map((price) => ({
        value: `${price}|${price}`,
        label: formatMoney(price),
      }));
    }

    const buckets = new Map();
    const bucketSize = 50000;
    prices.forEach((price) => {
      const start = Math.floor(price / bucketSize) * bucketSize;
      const key = String(start);
      const current = buckets.get(key) || { min: start, max: start + bucketSize - 0.01 };
      current.min = Math.min(current.min, price);
      current.max = Math.max(current.max, price);
      buckets.set(key, current);
    });

    return Array.from(buckets.values())
      .sort((left, right) => left.min - right.min)
      .map((range) => ({
        value: `${roundMoneyNumber(range.min)}|${roundMoneyNumber(range.max)}`,
        label: formatPriceRangeFilter(`${range.min}|${range.max}`),
      }));
  }

  function replaceFilterSelectOptionItems(id, items, emptyLabel, { labelForValue = null } = {}) {
    const select = document.getElementById(id);
    if (!(select instanceof HTMLSelectElement)) return;

    const previousValue = String(select.value || "");
    const seen = new Set();
    const options = [];
    items.forEach((item) => {
      const value = String(item?.value ?? item ?? "").trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      options.push({
        value,
        label: String(item?.label ?? (labelForValue ? labelForValue(value) : value)),
      });
    });

    select.innerHTML = "";

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = emptyLabel;
    select.appendChild(emptyOption);

    options.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    });

    const hasPrevious = Array.from(select.options).some((option) => option.value === previousValue);
    if (previousValue && !hasPrevious) {
      const preservedOption = document.createElement("option");
      preservedOption.value = previousValue;
      preservedOption.textContent = labelForValue ? labelForValue(previousValue) : previousValue;
      select.appendChild(preservedOption);
    }

    select.value = previousValue && (hasPrevious || select.options.length > 1) ? previousValue : "";
    rebuildSelectUi(select);
  }

  function parsePriceRangeFilter(value) {
    const [minValue, maxValue] = String(value || "").split("|").map((item) => Number(item));
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      return { min: null, max: null };
    }
    return {
      min: minValue > 0 ? minValue : null,
      max: maxValue > 0 ? maxValue : null,
    };
  }

  function syncFilterListsFromSuggestions() {
    if (!state.sugestões.length) return;
    const imoveis = state.sugestões.map((suggestion) => suggestion.imovel || {}).filter(Boolean);

    replaceFilterSelectOptions(
      ids.filtroEmpreendimento,
      imoveis.map((imovel) => firstFilled(imovel.empreendimento, imovel.agrupamento?.nome, imovel.titulo_original, imovel.titulo)),
      "Todos empreend."
    );
    replaceFilterSelectOptions(ids.filtroCidade, imoveis.map((imovel) => imovel.cidade), "Todas as cidades");
    replaceFilterSelectOptions(ids.filtroBairro, imoveis.map((imovel) => imovel.bairro), "Todos os bairros");
    replaceFilterSelectOptions(ids.filtroBloco, imoveis.map(getPropertyBlockForFilter), "Todos os blocos");
    replaceFilterSelectOptions(ids.filtroApartamento, imoveis.map(getPropertyUnitForFilter), "Todos os aptos");
    replaceFilterSelectOptionItems(
      ids.filtroFaixaPreco,
      buildPriceRangeOptions(imoveis),
      "Todas as faixas",
      { labelForValue: formatPriceRangeFilter }
    );
  }

  function setStatusBadge(status) {
    if (!el.statusBadge) return;
    const value = normalizeSearch(status);
    el.statusBadge.classList.remove("tl-sim-status--ideal", "tl-sim-status--compativel", "tl-sim-status--atencao", "tl-sim-status--invalida", "tl-sim-status--neutro");
    if (value === "ideal") {
      el.statusBadge.classList.add("tl-sim-status--ideal");
      el.statusBadge.textContent = "Operação ideal";
      return;
    }
    if (value === "compativel") {
      el.statusBadge.classList.add("tl-sim-status--compativel");
      el.statusBadge.textContent = "Operação compatível";
      return;
    }
    if (value === "atencao") {
      el.statusBadge.classList.add("tl-sim-status--atencao");
      el.statusBadge.textContent = "Operação em ajuste";
      return;
    }
    if (value === "invalida") {
      el.statusBadge.classList.add("tl-sim-status--invalida");
      el.statusBadge.textContent = "Operação bloqueada";
      return;
    }
    el.statusBadge.classList.add("tl-sim-status--neutro");
    el.statusBadge.textContent = "Aguardando calculo";
  }

  function getClassificacaoLabel(value) {
    const status = normalizeSearch(value);
    if (status === "ideal") return "Ideal";
    if (status === "compativel") return "Compatível";
    if (status === "atencao") return "Em ajuste";
    if (status === "invalida") return "Fora da faixa";
    return "Em análise";
  }

  function resolveDisplayStatus({ resumo = {}, suggestion = null, status = "" } = {}) {
    return normalizeSearch(firstFilled(
      status,
      resumo.status_comercial,
      suggestion?.status_comercial,
      suggestion?.resumo_operacao?.status_comercial,
      resumo.status_simulacao,
      suggestion?.classificacao,
      suggestion?.resumo_operacao?.status_simulacao,
      ""
    ));
  }

  function buildClassificacaoBadge(value) {
    const status = normalizeSearch(value);
    if (status === "ideal") return '<span class="tl-sim-badge tl-sim-badge--ideal">Ideal</span>';
    if (status === "compativel") return '<span class="tl-sim-badge tl-sim-badge--compativel">Compatível</span>';
    if (status === "atencao") return '<span class="tl-sim-badge tl-sim-badge--atencao">Em Ajuste</span>';
    if (status === "invalida") return '<span class="tl-sim-badge tl-sim-badge--invalida">Fora da Faixa</span>';
    return '<span class="tl-sim-badge tl-sim-badge--atencao">Em Análise</span>';
  }

  function toneFromCommitment(value) {
    const factor = percentToFactor(value);
    if (!Number.isFinite(factor) || factor <= 0) return "neutral";
    if (factor <= 0.38) return "good";
    if (factor <= 0.45) return "warning";
    return "danger";
  }

  function approvalGapLimit(value, fallbackValue) {
    const explicitLimit = parseMoney(value || 0);
    if (explicitLimit > 0) return explicitLimit;
    const reference = parseMoney(fallbackValue || 0);
    if (reference <= 0) return APPROVAL_EXCEPTION_GAP_ABSOLUTE;
    return Math.min(APPROVAL_EXCEPTION_GAP_ABSOLUTE, reference * APPROVAL_EXCEPTION_GAP_PERCENT);
  }

  function approvalAnalysisForTone({ resumo = {}, suggestion = null } = {}) {
    const candidates = [
      state.simulacaoAtual?.aprovacao_excecao,
      suggestion?.aprovacao_excecao,
      suggestion?.analise_comercial,
      suggestion?.resumo_operacao?.aprovacao_excecao,
      resumo.aprovacao_excecao,
    ];
    return candidates.find((analise) => analise && typeof analise === "object") || null;
  }

  function triggerToneFromGaps({ resumo = {}, suggestion = null } = {}) {
    const resumoSugestao = suggestion?.resumo_operacao || {};
    const analiseSugestao = suggestion?.analise_comercial || {};
    const valorGarantidoPlanejado = parseMoney(firstFilled(
      resumo.valor_garantido_planejado,
      resumo.valor_garantido,
      resumoSugestao.valor_garantido_planejado,
      resumoSugestao.valor_garantido,
      analiseSugestao.valor_garantido_planejado
    ));
    const valorGarantidoReal = parseMoney(firstFilled(
      resumo.valor_garantido_real,
      resumo.valor_fechamento_inicial,
      resumoSugestao.valor_garantido_real,
      resumoSugestao.valor_fechamento_inicial,
      analiseSugestao.valor_garantido_real
    ));
    const valorPreObraPlanejado = parseMoney(firstFilled(
      resumo.valor_garantido_pre_obra_planejado,
      resumoSugestao.valor_garantido_pre_obra_planejado,
      analiseSugestao.valor_garantido_pre_obra_planejado
    ));
    const valorPreObraReal = parseMoney(firstFilled(
      resumo.valor_garantido_pre_obra_real,
      resumo.valor_projetado_entrega,
      resumoSugestao.valor_garantido_pre_obra_real,
      resumoSugestao.valor_projetado_entrega,
      analiseSugestao.valor_garantido_pre_obra_real
    ));
    const hasGuaranteedReference = valorGarantidoPlanejado > 0 || valorGarantidoReal > 0;
    const hasPreWorkReference = valorPreObraPlanejado > 0 || valorPreObraReal > 0;
    if (!hasGuaranteedReference && !hasPreWorkReference) return null;

    const gapGarantido = analiseSugestao.gap_garantia !== undefined
      ? parseMoney(analiseSugestao.gap_garantia)
      : Math.max(valorGarantidoPlanejado - valorGarantidoReal, 0);
    const gapPreObra = analiseSugestao.gap_pre_obra !== undefined
      ? parseMoney(analiseSugestao.gap_pre_obra)
      : Math.max(valorPreObraPlanejado - valorPreObraReal, 0);
    if (gapGarantido <= 0.01 && gapPreObra <= 0.01) return "good";

    const analise = approvalAnalysisForTone({ resumo, suggestion });
    if (analise?.necessaria && analise?.permitida) return "warning";

    const limiteGarantido = approvalGapLimit(analise?.limite_gap_garantia, valorGarantidoPlanejado);
    const limitePreObra = approvalGapLimit(analise?.limite_gap_pre_obra, valorPreObraPlanejado);
    if (gapGarantido > limiteGarantido + 0.01 || gapPreObra > limitePreObra + 0.01) return "danger";
    return "warning";
  }

  function resolveFinancialTone({ resumo = {}, suggestion = null, status = "", commitment = null } = {}) {
    const context = resolveSuggestionSimulationContext({ resumo, suggestion });
    const explicitStatus = firstFilled(
      status,
      context.resumo.status_comercial,
      context.suggestion?.status_comercial,
      context.suggestion?.resumo_operacao?.status_comercial,
      context.resumo.status_simulacao,
      context.suggestion?.classificacao,
      context.suggestion?.resumo_operacao?.status_simulacao
    );
    const statusValue = resolveDisplayStatus({
      resumo: context.resumo,
      suggestion: context.suggestion,
      status: firstFilled(explicitStatus, isSuggestionNaturalFit(context.suggestion) ? "ideal" : "")
    });

    const negotiatedGap = parseMoney(firstFilled(
      context.resumo.falta_para_valor_negociado,
      context.resumo.falta_para_imovel,
      context.suggestion?.resumo_operacao?.falta_para_valor_negociado,
      context.suggestion?.resumo_operacao?.falta_para_imovel,
      0
    ));
    if (negotiatedGap > 0.01) {
      const analise = approvalAnalysisForTone({ resumo: context.resumo, suggestion: context.suggestion });
      return analise?.permitida ? "warning" : "danger";
    }
    const negotiatedExcess = parseMoney(firstFilled(
      context.resumo.excesso_valor_negociado,
      context.suggestion?.resumo_operacao?.excesso_valor_negociado,
      0
    ));
    if (negotiatedExcess > 0.01) return "danger";

    const triggerTone = triggerToneFromGaps({ resumo: context.resumo, suggestion: context.suggestion });
    if (triggerTone) return triggerTone;

    if (statusValue === "invalida") return "danger";
    if (statusValue === "atencao") return "warning";
    if (statusValue === "ideal") return "good";

    return toneFromCommitment(firstFilled(
      commitment,
      context.resumo.percentual_comprometimento,
      context.suggestion?.resumo_operacao?.percentual_comprometimento
    ));
  }

  function toneLabel(tone) {
    if (tone === "good") return "Dentro da faixa";
    if (tone === "warning") return "Próximo do limite";
    if (tone === "danger") return "Fora da faixa";
    return "Aguardando calculo";
  }

  function displayStatusFromTone(tone, fallbackStatus = "") {
    const normalizedFallback = normalizeSearch(fallbackStatus);
    if (tone === "good") return "ideal";
    if (tone === "warning") return normalizedFallback === "invalida" ? "atencao" : (normalizedFallback || "atencao");
    if (tone === "danger") return "invalida";
    return normalizedFallback;
  }

  function resolveSuggestionSimulationContext({ suggestion = null, resumo = {} } = {}) {
    const safeResumo = resumo && typeof resumo === "object" ? resumo : {};
    const suggestionId = String(suggestion?.imovel?.id || suggestion?.id || "");
    const selectedId = String(state.imovelSelecionado?.id || "");

    if (!suggestion || !suggestionId || !selectedId || suggestionId !== selectedId || !state.simulacaoAtual?.resumo_operacao) {
      return { suggestion, resumo: safeResumo };
    }

    const mergedResumo = {
      ...(suggestion?.resumo_operacao || {}),
      ...safeResumo,
      ...(state.simulacaoAtual?.resumo_operacao || {}),
    };

    return {
      suggestion: {
        ...suggestion,
        resumo_operacao: mergedResumo,
        classificacao: firstFilled(
          state.simulacaoAtual?.resumo_operacao?.status_comercial,
          state.simulacaoAtual?.resumo_operacao?.status_simulacao,
          suggestion?.classificacao
        ),
      },
      resumo: mergedResumo,
    };
  }

  function resolveUserFacingStatus({ resumo = {}, suggestion = null, status = "" } = {}) {
    const context = resolveSuggestionSimulationContext({ resumo, suggestion });
    const fallbackStatus = resolveDisplayStatus({ resumo: context.resumo, suggestion: context.suggestion, status });
    const tone = resolveFinancialTone({ resumo: context.resumo, suggestion: context.suggestion, status: fallbackStatus });
    return displayStatusFromTone(tone, fallbackStatus);
  }

  function applyFinancialTone(tone = "neutral") {
    const safeTone = ["good", "warning", "danger"].includes(tone) ? tone : "neutral";
    const toneClasses = ["is-finance-good", "is-finance-warning", "is-finance-danger", "is-finance-neutral"];

    document.querySelectorAll(".tl-sim-card--imovel, .tl-sim-card--proposta").forEach((card) => {
      card.classList.remove(...toneClasses);
      card.classList.add(`is-finance-${safeTone}`);
      card.dataset.financeTone = safeTone;
    });

    const fieldClasses = ["tl-sim-field-tone--good", "tl-sim-field-tone--warning", "tl-sim-field-tone--danger", "tl-sim-field-tone--neutral"];
    document.querySelectorAll(".tl-sim-field-tone--good, .tl-sim-field-tone--warning, .tl-sim-field-tone--danger, .tl-sim-field-tone--neutral").forEach((field) => {
      field.classList.remove(...fieldClasses);
    });

    [ids.valorImovel, ids.financiamento, ids.parcelaBanco, ids.entrada, ids.fgts, ids.subsidio, ids.chequeMoradia, ids.sobrepreco, ids.descontoImovel, ids.valorNegociado].forEach((id) => {
      const field = document.getElementById(id)?.closest(".tl-imoveis-field");
      if (field) field.classList.add(`tl-sim-field-tone--${safeTone}`);
    });
  }

  function isSuggestionNaturalFit(item) {
    return Boolean(item?.faixa_natural);
  }

  function isSuggestionIdeal(item) {
    const explicitStatus = normalizeSearch(firstFilled(
      item?.classificacao_sugestao,
      item?.status_exibicao_sugestao,
      item?.classificacao,
      item?.resumo_operacao?.status_comercial,
      item?.resumo_operacao?.status_simulacao,
      ""
    ));
    if (explicitStatus === "ideal") return true;
    return normalizeSearch(getSuggestionBadgeValue(item)) === "ideal";
  }

  function getSuggestionBadgeValue(item) {
    const explicitStatus = normalizeSearch(firstFilled(
      item?.classificacao_sugestao,
      item?.status_exibicao_sugestao,
      ""
    ));
    if (explicitStatus) return explicitStatus;

    const status = resolveUserFacingStatus({ resumo: item?.resumo_operacao || {}, suggestion: item });
    if (status) return status;
    return isSuggestionNaturalFit(item) ? "ideal" : "";
  }

  function buildAvailabilityBadge(value) {
    const label = firstFilled(value, "Disponível");
    const status = normalizeStatus(label);
    const className = status === "disponivel"
      ? "tl-sim-fact tl-sim-fact--disponivel"
      : status === "reservado"
        ? "tl-sim-fact tl-sim-fact--reservado"
        : isPendingApprovalStatus(label)
          ? "tl-sim-fact tl-sim-fact--pendente"
        : status === "vendido"
          ? "tl-sim-fact tl-sim-fact--vendido"
          : "tl-sim-fact";
    return `<span class="${className}">${escapeHtml(label)}</span>`;
  }

  function getSuggestionModeLabel(mode) {
    if (mode === "ideal") return "Ideais";
    if (mode === "ajuste") return "Com ajuste";
    if (mode === "stretch") return "Fora do perfil";
    return "Todas";
  }

  function findSuggestionById(id) {
    return state.sugestões.find((item) => String(item.imovel?.id || item.id || "") === String(id || ""));
  }

  function getBestIdealSuggestion(items = state.sugestões) {
    const melhorSugestao = findSuggestionById(state.melhorSugestaoId);
    if (melhorSugestao && isSuggestionIdeal(melhorSugestao)) {
      return melhorSugestao;
    }

    return items
      .filter((item) => isSuggestionIdeal(item))
      .sort((left, right) => getSuggestionRankingValue(right) - getSuggestionRankingValue(left))[0] || null;
  }

  function getSelectedSuggestion() {
    return findSuggestionById(state.imovelSelecionado?.id || "");
  }

  function cloneSuggestionForCompare(item) {
    if (!item) return null;
    const imovel = normalizePropertyForUi(item.imovel || item);
    if (!imovel.id) return null;
    return {
      id: String(imovel.id),
      imovel,
      resumo_operacao: item.resumo_operacao || {},
      analise_comercial: item.analise_comercial || null,
      classificacao: item.classificacao || item.resumo_operacao?.status_comercial || item.resumo_operacao?.status_simulacao || "",
      faixa_natural: Boolean(item.faixa_natural),
      ajuste_entrada: item.ajuste_entrada || null,
      ajuste_fluxo_pre_obra: item.ajuste_fluxo_pre_obra || item.resumo_operacao?.sugestao_reforco_pre_obra || null,
      justificativa: item.justificativa || "",
    };
  }

  function syncComparadorWithSuggestions() {
    const next = [];
    state.comparador.forEach((entry) => {
      const fresh = findSuggestionById(entry.id) || entry;
      const normalized = cloneSuggestionForCompare(fresh);
      if (!normalized?.id) return;
      if (next.some((item) => item.id === normalized.id)) return;
      next.push(normalized);
    });
    state.comparador = next.slice(0, 3);
  }

  function toggleCompareById(id) {
    const targetId = String(id || "");
    if (!targetId) return;
    const existingIndex = state.comparador.findIndex((item) => item.id === targetId);
    if (existingIndex >= 0) {
      state.comparador.splice(existingIndex, 1);
    } else {
      const source = findSuggestionById(targetId);
      const normalized = cloneSuggestionForCompare(source);
      if (!normalized) return;
      if (state.comparador.length >= 3) {
        state.comparador.shift();
      }
      state.comparador.push(normalized);
    }
    renderSuggestions();
    renderCompareTray();
  }

  function getVisibleSuggestions() {
    const term = normalizeSearch(state.buscaImovel);
    const selectedBlock = normalizeSearch(readValue(ids.filtroBloco));
    const selectedUnit = normalizeSearch(readValue(ids.filtroApartamento));
    const selectedPriceRange = parsePriceRangeFilter(readValue(ids.filtroFaixaPreco));
    return state.sugestões.filter((item) => {
      const badgeStatus = normalizeSearch(getSuggestionBadgeValue(item));
      const availability = normalizeStatus(item.imovel?.status);
      const hasAdjustment = badgeStatus === "atencao" || !!item.ajuste_entrada || !!item.ajuste_fluxo_pre_obra;
      const isNaturalFit = isSuggestionNaturalFit(item);

      let modeMatches = true;
      if (state.modoSugestoes === "ideal") modeMatches = badgeStatus === "ideal";
      if (state.modoSugestoes === "ajuste") modeMatches = hasAdjustment;
      if (state.modoSugestoes === "stretch") {
        modeMatches = !isNaturalFit
      || badgeStatus === "invalida"
          || availability === "reservado"
          || isPendingApprovalStatus(availability)
          || availability === "vendido"
          || availability === "inativo";
      }
      if (!modeMatches) return false;

      if (selectedBlock && normalizeSearch(getPropertyBlockForFilter(item.imovel)) !== selectedBlock) return false;
      if (selectedUnit && normalizeSearch(getPropertyUnitForFilter(item.imovel)) !== selectedUnit) return false;
      const propertyPrice = getPropertyPriceForFilter(item.imovel);
      if (selectedPriceRange.min !== null && propertyPrice < selectedPriceRange.min) return false;
      if (selectedPriceRange.max !== null && propertyPrice > selectedPriceRange.max) return false;

      if (!term) return true;
      const searchable = normalizeSearch(
        [
          item.imovel?.titulo,
          item.imovel?.empreendimento,
          item.imovel?.cidade,
          item.imovel?.bairro,
          item.imovel?.tipologia,
          item.imovel?.tipo_imovel,
          item.imovel?.endereco,
          item.imovel?.reserva_ativa?.cliente?.nome_completo,
        ]
          .filter(Boolean)
          .join(" ")
      );
      return searchable.includes(term);
    }).sort((left, right) => {
      const rank = (entry) => {
        const reservaAtual = getReservationForProperty(entry?.imovel);
        if (isReservationForSelectedClient(reservaAtual)) return 0;
        if (normalizeStatus(entry?.imovel?.status) === "disponivel") return 1;
        if (reservaAtual) return 2;
        if (normalizeStatus(entry?.imovel?.status) === "reservado") return 3;
        return 4;
      };

        const difference = rank(left) - rank(right);
        if (difference !== 0) return difference;
        const leftIdeal = normalizeSearch(getSuggestionBadgeValue(left)) === "ideal";
        const rightIdeal = normalizeSearch(getSuggestionBadgeValue(right)) === "ideal";
        if (leftIdeal && rightIdeal) {
          return getSuggestionRankingValue(right) - getSuggestionRankingValue(left);
        }
        return getSuggestionRankingValue(left) - getSuggestionRankingValue(right);
      });
    }

  function renderHeroSummary() {
    if (!el.heroResumo) return;

    const cliente = state.clienteSelecionado;
    const consolidacao = state.consolidacaoCliente || {};
    const rendaTotal = parseMoney(consolidacao.renda_total ?? cliente?.renda_total ?? 0);
    const limite = parseMoney(consolidacao.limite_comprometimento ?? state.simulacaoAtual?.resumo_operacao?.limite_comprometimento ?? 0);
    const visibleCount = getVisibleSuggestions().length || state.sugestões.length;
    const currentStatus = resolveUserFacingStatus({ resumo: state.simulacaoAtual?.resumo_operacao || {} });
    const cidadeCliente = firstFilled(cliente?.cidade, "Cidade não informada");

    const cards = cliente
      ? [
          ["Cidade do cliente", cidadeCliente],
          ["Renda total do núcleo", formatMoney(rendaTotal)],
          ["Capacidade mensal", formatMoney(limite)],
          [currentStatus ? "Operação atual" : "Sugestões", currentStatus ? getClassificacaoLabel(currentStatus) : `${visibleCount} opções`],
        ]
      : [
          ["Cidade do cliente", "-"],
          ["Renda total do núcleo", "R$ 0,00"],
          ["Capacidade mensal", "R$ 0,00"],
          ["Sugestões", "Aguardando seleção"],
        ];

    el.heroResumo.innerHTML = cards
      .map(
        ([label, value]) =>
          `<article class="tl-sim-hero-kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`
      )
      .join("");

    updateActionButtons();
  }

  async function copyTextToClipboard(text) {
    const value = String(text || "").trim();
    if (!value) return false;

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return Boolean(success);
  }

  function syncModalLock() {
    const hasOpenModal = [el.modalComplemento, el.modalMapa, el.modalDemonstrativo, el.modalGaleria, el.modalEscolhaImovel, el.modalSobrepreco, el.modalAlertas].some((modal) => modal && !modal.hidden);
    document.body.classList.toggle("tl-modal-open", hasOpenModal);
  }

  function closeGaleriaModal() {
    if (!el.modalGaleria) return;
    el.modalGaleria.hidden = true;
    el.modalGaleria.setAttribute("aria-hidden", "true");
    state.galeriaImovel = null;
    state.galeriaFotos = [];
    state.galeriaIndex = 0;
    syncModalLock();
  }

  function renderGaleriaModal() {
    if (!el.galeriaStage) return;
    const imovel = state.galeriaImovel || {};
    const fotos = state.galeriaFotos || [];
    const total = fotos.length;
    const index = total ? clamp(state.galeriaIndex, 0, total - 1) : 0;
    state.galeriaIndex = index;
    const foto = fotos[index];
    const localizacao = [imovel.empreendimento, imovel.cidade, imovel.bairro].filter(Boolean).join(" • ");

    if (el.galeriaTitulo) el.galeriaTitulo.textContent = "Visualização premium do imóvel";
    if (el.galeriaResumo) el.galeriaResumo.textContent = firstFilled([imovel.titulo, localizacao].filter(Boolean).join(" - "), "Fotos ampliadas da unidade selecionada.");
    if (el.galeriaCounter) el.galeriaCounter.textContent = total ? `${index + 1} / ${total}` : "0 / 0";
    if (el.galeriaInfo) {
      const area = formatArea(imovel.area_m2);
      const entrega = imovel.data_entrega ? formatDateLabel(imovel.data_entrega) : `${toNumber(imovel.meses_pre_entrega ?? 36, 36)} meses`;
      const infoCards = [
        ["área", area],
        ["Quartos", String(toNumber(imovel.quartos ?? imovel.dormitorios ?? 0, 0))],
        ["Vagas", String(toNumber(imovel.vagas ?? imovel.vagas_garagem ?? 0, 0))],
        ["Entrega", entrega],
        ["Pós-entrega", `${toNumber(firstFilled(imovel.meses_pos_entrega_configurado, imovel.meses_pos_entrega, getPreferredPostDeliveryMonths(imovel.meses_pre_entrega)), getPreferredPostDeliveryMonths(imovel.meses_pre_entrega))} meses`],
        ["Obra", formatPercent(imovel.percentual_conclusao_obra || 0)],
      ];
      el.galeriaInfo.innerHTML = `
        <article class="tl-sim-galeria__info-card">
          <span class="tl-imoveis-eyebrow mono-font">${escapeHtml(imovel.tipo_imovel || imovel.tipologia || "IMÓVEL")}</span>
          <h4>${escapeHtml(imovel.titulo || "Unidade selecionada")}</h4>
          <p title="${escapeHtml(imovel.empreendimento || localização || "")}">${escapeHtml(firstFilled(imovel.empreendimento, localizacao, "Empreendimento não informado"))}</p>
          <div class="tl-sim-galeria__status-row">
            <strong>${escapeHtml(formatMoney(parseMoney(imovel.valor || 0)))}</strong>
            ${buildAvailabilityBadge(imovel.status)}
          </div>
          <div class="tl-sim-galeria__info-grid">
            ${infoCards.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
          </div>
          <small>${escapeHtml(firstFilled(imovel.endereco_formatado, imovel.endereco, "Clique nas miniaturas para navegar pelas fotos cadastradas."))}</small>
        </article>`;
    }

    if (!total) {
      el.galeriaStage.innerHTML = `
        <div class="tl-sim-galeria__empty">
          <strong>Sem fotos disponíveis</strong>
          <span>Essa unidade ainda não tem imagens cadastradas para ampliar.</span>
        </div>`;
      if (el.galeriaThumbs) el.galeriaThumbs.innerHTML = "";
      return;
    }

    el.galeriaStage.innerHTML = `
      <button class="tl-sim-galeria__nav tl-sim-galeria__nav--prev" type="button" data-action="galeria-prev" aria-label="Foto anterior">‹</button>
      <img class="tl-sim-galeria__image" src="${escapeHtml(foto.caminho_arquivo)}" alt="${escapeHtml(foto.nome_arquivo || imovel.titulo || `Foto ${index + 1}`)}" />
      <button class="tl-sim-galeria__nav tl-sim-galeria__nav--next" type="button" data-action="galeria-next" aria-label="Próxima foto">›</button>`;

    if (el.galeriaThumbs) {
      el.galeriaThumbs.innerHTML = fotos
        .map((item, idx) => `
          <button class="tl-sim-galeria__thumb ${idx === index ? "is-active" : ""}" type="button" data-action="galeria-go" data-index="${idx}" aria-label="Abrir foto ${idx + 1}">
            <img src="${escapeHtml(item.caminho_arquivo)}" alt="${escapeHtml(item.nome_arquivo || `Foto ${idx + 1}`)}" />
          </button>`)
        .join("");
    }
  }

  function moveGaleria(delta) {
    const total = state.galeriaFotos.length;
    if (!total) return;
    state.galeriaIndex = (state.galeriaIndex + delta + total) % total;
    renderGaleriaModal();
  }

  async function openGaleriaImovel(id, initialIndex = 0) {
    const propertyId = String(id || state.imovelSelecionado?.id || "");
    if (!propertyId) return;

    const suggestion = findSuggestionById(propertyId) || state.comparador.find((item) => item.id === propertyId);
    let imovel = normalizePropertyForUi(
      propertyId === String(state.imovelSelecionado?.id || "")
        ? state.imovelSelecionado
        : suggestion?.imovel || { id: propertyId },
    );

    try {
      const detalhado = await loadPropertyById(propertyId);
      imovel = normalizePropertyForUi({ ...imovel, ...detalhado });
    } catch (error) {
      if (!collectPropertyPhotos(imovel).length) {
        showFeedback("warning", messageFromError(error, "Não foi possível carregar as fotos desse imóvel."));
      }
    }

    state.galeriaImovel = imovel;
    state.galeriaFotos = collectPropertyPhotos(imovel);
    state.galeriaIndex = clamp(Number(initialIndex) || 0, 0, Math.max(state.galeriaFotos.length - 1, 0));
    renderGaleriaModal();

    if (!el.modalGaleria) return;
    el.modalGaleria.hidden = false;
    el.modalGaleria.setAttribute("aria-hidden", "false");
    syncModalLock();
  }

  function closeDemonstrativoModal() {
    if (!el.modalDemonstrativo) return;
    el.modalDemonstrativo.hidden = true;
    el.modalDemonstrativo.setAttribute("aria-hidden", "true");
    syncModalLock();
  }

  function openDemonstrativoModal() {
    if (!state.simulacaoAtual?.demonstrativo?.length) {
      showFeedback("warning", "Calcule a simulação para abrir o demonstrativo completo.");
      return;
    }
    if (!el.modalDemonstrativo) return;
    el.modalDemonstrativo.hidden = false;
    el.modalDemonstrativo.setAttribute("aria-hidden", "false");
    syncModalLock();
  }

  function closeAlertasModal() {
    if (!el.modalAlertas) return;
    el.modalAlertas.hidden = true;
    el.modalAlertas.setAttribute("aria-hidden", "true");
    syncModalLock();
  }

  function openAlertasModal() {
    if (!state.simulacaoNotificacoes.length) {
      showFeedback("info", "Essa simulação não tem alertas relevantes no momento.");
      return;
    }
    if (!el.modalAlertas) return;
    el.modalAlertas.hidden = false;
    el.modalAlertas.setAttribute("aria-hidden", "false");
    syncModalLock();
  }

  function collectSimulationNotifications(resultado) {
    const resumo = resultado?.resumo_operacao || {};
    const aprovacaoExcecao = resultado?.aprovacao_excecao || null;
    const items = [];
    const pushItem = (variant, label, title, text) => {
      const content = String(text || "").trim();
      if (!content) return;
      items.push({
        id: `${variant}-${items.length}`,
        variant,
        label,
        title,
        text: content,
      });
    };

    (Array.isArray(resumo.bloqueios) ? resumo.bloqueios : []).forEach((item) => {
      pushItem("error", "Bloqueio", "Ajuste obrigatório", item);
    });
    (Array.isArray(resumo.atenções) ? resumo.atenções : []).forEach((item) => {
      pushItem("warning", "Atenção", "Ponto de atenção", item);
    });
    (Array.isArray(resumo.sugestões) ? resumo.sugestões : []).forEach((item) => {
      pushItem("info", "Sugestão", "Orientação comercial", item);
    });

    const ajusteSelecionado = getSelectedSuggestion()?.ajuste_entrada;
    if (ajusteSelecionado) {
      pushItem(
        "success",
        "Entrada guiada",
        "Entrada mínima sugerida",
        `Aplique ${formatMoney(ajusteSelecionado.entrada_sugerida || 0)} para levar a operação para ${formatPercent(ajusteSelecionado.fechamento_inicial_ajustado || 0)} de fechamento com comprometimento em ${formatPercent(ajusteSelecionado.percentual_comprometimento_ajustado || 0)}.`
      );
    }

    if (aprovacaoExcecao?.necessaria) {
      const motivos = Array.isArray(aprovacaoExcecao?.motivos_aprovacao)
        ? aprovacaoExcecao.motivos_aprovacao.filter(Boolean)
        : [];
      const checklist = Array.isArray(aprovacaoExcecao?.checklist_aprovacao)
        ? aprovacaoExcecao.checklist_aprovacao.filter(Boolean)
        : [];
      pushItem(
        aprovacaoExcecao?.permitida ? "warning" : "error",
        "Gestão",
        aprovacaoExcecao?.permitida ? "Fluxo elegível para aprovação" : "Fluxo ainda bloqueado",
        firstFilled(
          motivos.slice(0, 3).join(" "),
          aprovacaoExcecao?.mensagem,
          aprovacaoExcecao?.permitida
            ? "A operação ficou próxima dos gatilhos e pode ser enviada para decisão do gestor."
            : "A operação ainda precisa de ajuste antes de seguir para aprovação gerencial."
        )
      );
      if (checklist.length) {
        pushItem(
          "info",
          "Checklist",
          "Pontos para decisão do gestor",
          checklist
            .slice(0, 4)
            .map((item) => firstFilled(item?.titulo, item?.categoria, item))
            .filter(Boolean)
            .join(" • ")
        );
      }
    }

    return items;
  }

  function renderAlertasModal(items) {
    const list = Array.isArray(items) ? items : [];
    const counts = {
      error: list.filter((item) => item.variant === "error").length,
      warning: list.filter((item) => item.variant === "warning").length,
      info: list.filter((item) => item.variant === "info").length,
      success: list.filter((item) => item.variant === "success").length,
    };

    if (el.alertasResumo) {
      el.alertasResumo.textContent = list.length
        ? "Revise os alertas abaixo antes de seguir com a proposta ou reserva."
        : "A simulação atual não trouxe bloqueios, atenções ou sugestões extras.";
    }

    if (el.alertasStats) {
      const chips = [];
      if (counts.error) chips.push(`<span class="tl-sim-chip">${escapeHtml(String(counts.error))} bloqueio(s)</span>`);
      if (counts.warning) chips.push(`<span class="tl-sim-chip">${escapeHtml(String(counts.warning))} atenção(ões)</span>`);
      if (counts.info) chips.push(`<span class="tl-sim-chip">${escapeHtml(String(counts.info))} sugestão(ões)</span>`);
      if (counts.success) chips.push(`<span class="tl-sim-chip">${escapeHtml(String(counts.success))} entrada(s) guiada(s)</span>`);
      el.alertasStats.innerHTML = chips.join("");
      el.alertasStats.hidden = !chips.length;
    }

    if (!el.alertasLista) return;
    if (!list.length) {
      el.alertasLista.innerHTML = '<div class="tl-sim-alertas-modal__empty">Cenário calculado sem alertas relevantes.</div>';
      return;
    }

    el.alertasLista.innerHTML = list
      .map((item) => `
        <article class="tl-sim-alertas-modal__item" data-variant="${escapeHtml(item.variant)}">
          <div class="tl-sim-alertas-modal__item-head">
            <div class="tl-sim-alertas-modal__item-title">
              <span class="tl-sim-alertas-modal__item-badge">${escapeHtml(item.label)}</span>
              <h4>${escapeHtml(item.title)}</h4>
            </div>
          </div>
          <p>${escapeHtml(item.text)}</p>
        </article>`)
      .join("");
  }

  function syncSimulationNotifications(resultado, { autoOpen = false } = {}) {
    const items = collectSimulationNotifications(resultado);
    state.simulacaoNotificacoes = items;
    renderAlertasModal(items);

    if (el.sugestõesAjuste) {
      el.sugestõesAjuste.innerHTML = "";
      el.sugestõesAjuste.hidden = true;
    }

    if (el.btnAbrirAlertas) {
      el.btnAbrirAlertas.hidden = !items.length;
      el.btnAbrirAlertas.textContent = items.length === 1 ? "Ver alerta" : `Ver alertas (${items.length})`;
    }

    if (!items.length) {
      closeAlertasModal();
      return;
    }

    if (autoOpen) {
      openAlertasModal();
    }
  }

  function closeMapModal() {
    if (!el.modalMapa) return;
    el.modalMapa.hidden = true;
    el.modalMapa.setAttribute("aria-hidden", "true");
    if (el.mapaFrame) {
      el.mapaFrame.src = "about:blank";
    }
    syncModalLock();
  }

  function openMapModal() {
    const imovel = state.imovelSelecionado;
    if (!imovel) {
      showFeedback("warning", "Selecione um imóvel antes de abrir o mapa.");
      return;
    }

    const mapData = buildPropertyMapData(imovel);
    if (!mapData.embedUrl && !mapData.searchUrl) {
      showFeedback("warning", "Esse imóvel ainda não tem localização suficiente para abrir o mapa.");
      return;
    }

    if (el.mapaTitulo) {
      el.mapaTitulo.textContent = imovel.titulo || "Ver no mapa";
    }
    if (el.mapaEndereco) {
      el.mapaEndereco.textContent = mapData.address || "Endereço não informado.";
    }
    if (el.mapaResumo) {
      el.mapaResumo.textContent = mapData.summary || "Localização da unidade para apoiar a apresentação comercial.";
    }
    if (el.mapaCoordenadas) {
      el.mapaCoordenadas.textContent = mapData.coordinates ? `Coordenadas: ${mapData.coordinates}` : "";
      el.mapaCoordenadas.hidden = !mapData.coordinates;
    }
    if (el.mapaFrame) {
      el.mapaFrame.src = mapData.embedUrl || mapData.searchUrl;
      el.mapaFrame.title = `Mapa de ${imovel.titulo || "unidade selecionada"}`;
    }
    if (el.btnMapaAbrir) {
      el.btnMapaAbrir.href = mapData.searchUrl || mapData.embedUrl || "#";
      el.btnMapaAbrir.setAttribute("aria-disabled", mapData.searchUrl ? "false" : "true");
      el.btnMapaAbrir.classList.toggle("is-disabled", !mapData.searchUrl);
      el.btnMapaAbrir.tabIndex = mapData.searchUrl ? 0 : -1;
    }
    if (el.btnMapaRota) {
      const routeUrl = mapData.routeUrl || mapData.searchUrl || "#";
      el.btnMapaRota.href = routeUrl;
      el.btnMapaRota.setAttribute("aria-disabled", mapData.routeUrl || mapData.searchUrl ? "false" : "true");
      el.btnMapaRota.classList.toggle("is-disabled", !(mapData.routeUrl || mapData.searchUrl));
      el.btnMapaRota.tabIndex = mapData.routeUrl || mapData.searchUrl ? 0 : -1;
    }
    if (el.btnMapaCopiar) {
      el.btnMapaCopiar.dataset.address = mapData.address || mapData.query || "";
    }
    if (!el.modalMapa) return;
    el.modalMapa.hidden = false;
    el.modalMapa.setAttribute("aria-hidden", "false");
    syncModalLock();
  }

  function resetSimulationAutosaveState() {
    clearTimeout(state.simulacaoAutosaveTimer);
    state.simulacaoAutosaveId = "";
    state.simulacaoAutosaveTimer = null;
    state.simulacaoAutosaveEmAndamento = false;
    state.simulacaoAutosavePendente = false;
    state.simulacaoAutosaveAssinaturaSalva = "";
    state.simulacaoAutosaveAssinaturaEmAndamento = "";
  }

  function clearSimulationPanels() {
    closeGaleriaModal();
    closeEscolhaImovelModal();
    closeDemonstrativoModal();
    closeAlertasModal();
    closeMapModal();
    state.simulacaoAtual = null;
    state.simulacaoSalvaId = "";
    resetSimulationAutosaveState();
    state.simulacaoNotificacoes = [];
    setStatusBadge("");
    if (el.resumoKpis) el.resumoKpis.innerHTML = "";
    renderParcelasGrafico([]);
    if (el.sugestõesAjuste) {
      el.sugestõesAjuste.innerHTML = "";
      el.sugestõesAjuste.hidden = true;
    }
    if (el.btnAbrirAlertas) {
      el.btnAbrirAlertas.hidden = true;
      el.btnAbrirAlertas.textContent = "Ver alertas";
    }
    if (el.alertasStats) {
      el.alertasStats.innerHTML = "";
      el.alertasStats.hidden = true;
    }
    if (el.alertasLista) {
      el.alertasLista.innerHTML = '<div class="tl-sim-alertas-modal__empty">Calcule a simulação para ver os avisos e ajustes desta operação.</div>';
    }
    if (el.demonstrativoBody) el.demonstrativoBody.innerHTML = '<tr><td colspan="6" class="tl-sim-empty">Aguardando simulação para gerar o demonstrativo.</td></tr>';
    renderHeroSummary();
    updateActionButtons();
  }

  function setClientStatus(text) {
    if (!el.clienteStatus) return;
    el.clienteStatus.textContent = text || "Nenhum cliente selecionado";
  }

  function setPropertyStatus(text) {
    if (!el.imovelStatus) return;
    el.imovelStatus.textContent = text || "Sem unidade selecionada";
  }

  function pulseSection(node) {
    const target = node?.closest(".tl-sim-card") || node;
    if (!(target instanceof HTMLElement)) return;
    target.classList.remove("is-attention");
    void target.offsetWidth;
    target.classList.add("is-attention");
    window.setTimeout(() => target.classList.remove("is-attention"), 1400);
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function ensureActionSelections(requireProperty = false) {
    if (!state.clienteSelecionado) {
      showActionMessage("warning", "Selecione um cliente antes de usar essas ações.");
      pulseSection(el.buscaCliente || el.clientesLista);
      el.buscaCliente?.focus();
      return false;
    }

    if (requireProperty && !state.imovelSelecionado) {
      showActionMessage("warning", "Escolha uma unidade na vitrine antes de continuar.");
      pulseSection(el.sugestõesLista);
      return false;
    }

    return true;
  }

  function setButtonState(button, config) {
    if (!button || !config) return;
    const isBusy = state.acaoEmAndamento === config.key;
    const busySomeone = Boolean(state.acaoEmAndamento);
    button.dataset.busy = isBusy ? "true" : "false";
    button.textContent = isBusy ? config.busyLabel : config.label;
    button.disabled = isBusy ? true : busySomeone || !config.enabled;
    button.title = config.title || "";
  }

  function updateActionButtons() {
    const hasClient = Boolean(state.clienteSelecionado?.id);
    const clientContextLoading = Boolean(state.clienteContextoCarregando);
    const hasProperty = Boolean(state.imovelSelecionado?.id);
    const hasSimulation = Boolean(state.simulacaoAtual);
    const hasSavedSimulation = Boolean(state.simulacaoSalvaId);
    const status = normalizeStatus(state.imovelSelecionado?.status);
    const reserva = getReservationForProperty(state.imovelSelecionado);
    const aprovacaoExcecao = getCurrentApprovalException();
    const precisaAprovação = needsApprovalException(aprovacaoExcecao);
    const podeSubmeterAprovação = canSubmitApprovalException(aprovacaoExcecao);
    const pendenteAprovação = isPendingApprovalProperty(state.imovelSelecionado);
    const reservadoParaClienteAtual = isReservationForSelectedClient(reserva);
    const reservadoParaOutroCliente = Boolean(reserva?.cliente_id && hasClient && !reservadoParaClienteAtual);
    const bloqueadoParaClienteAtual = status === "reservado" && reservadoParaClienteAtual;
    const resumoAtual = state.simulacaoAtual?.resumo_operacao || {};
    const operacaoAtual = resolveOperationValues(resumoAtual, state.imovelSelecionado || {});
    const totalPagoAtual = resolveTotalPaidByClient(resumoAtual, operacaoAtual);
    const saldoNegociadoAtual = resolveNegotiatedPaymentBalance(resumoAtual, operacaoAtual, totalPagoAtual);
    const valorNegociadoDesajustado = hasSimulation
      && ["faltante", "acima"].includes(saldoNegociadoAtual.direction)
      && parseMoney(saldoNegociadoAtual.amount) > 0.01;
    const textoSaldoValorNegociado = valorNegociadoDesajustado ? formatMoney(saldoNegociadoAtual.amount) : "";
    const canSave = hasClient && hasProperty;
    const canReserve = hasClient && hasProperty && !pendenteAprovação && !precisaAprovação && !["reservado", "vendido", "inativo"].includes(status);
    const canSubmitApproval = hasClient
      && hasProperty
      && !pendenteAprovação
      && (status === "disponivel" || bloqueadoParaClienteAtual)
      && podeSubmeterAprovação;
    const canSell = hasClient
      && hasProperty
      && !pendenteAprovação
      && !precisaAprovação
      && !valorNegociadoDesajustado
      && !["vendido", "inativo"].includes(status)
      && !reservadoParaOutroCliente;
    const canRelease = hasProperty && (status === "reservado" || pendenteAprovação);
    const canReset = hasClient || hasProperty || hasSimulation || hasSavedSimulation;
    const calculateLabel = hasSimulation ? "Recalcular" : "Calcular";
    const calculateBusyLabel = hasProperty ? (hasSimulation ? "Recalculando..." : "Calculando...") : "Atualizando...";
    const calculateTitle = !hasClient
      ? "Selecione um cliente para continuar."
      : clientContextLoading
        ? "Aguarde o carregamento completo do cliente."
      : !hasProperty
        ? "Clique em Calcular para atualizar os imóveis sugeridos."
        : hasSimulation
          ? "Recalcular a operação atual e atualizar as sugestões."
          : "Calcular a operação atual e atualizar as sugestões.";

    setButtonState(el.btnCalcular, {
      key: "calcular",
      label: calculateLabel,
      busyLabel: calculateBusyLabel,
      enabled: hasClient && !clientContextLoading,
      title: calculateTitle,
    });
    setButtonState(el.btnSugerir, {
      key: "sugerir",
      label: "Atualizar sugestões",
      busyLabel: "Atualizando...",
      enabled: hasClient && !clientContextLoading,
      title: hasClient ? "Atualizar a vitrine com base nos parâmetros atuais." : "Selecione um cliente para atualizar a vitrine.",
    });

    setButtonState(el.btnSalvar, {
      key: "salvar",
      label: hasSavedSimulation ? "Salvar novamente" : "Salvar simulação",
      busyLabel: "Salvando...",
      enabled: canSave,
      title: canSave ? "Salvar a simulação atual." : "Selecione cliente e imóvel para salvar.",
    });
    setButtonState(el.btnPdf, {
      key: "pdf",
      label: "Emitir PDF",
      busyLabel: "Gerando PDF...",
      enabled: hasClient && hasProperty && hasSimulation,
      title: hasSimulation ? "Abrir relatório pronto para salvar como PDF." : "Calcule ou carregue uma simulação antes de emitir o PDF.",
    });
    setButtonState(el.btnAbrirDemonstrativo, {
      key: "demonstrativo",
      label: "Demonstrativo",
      busyLabel: "Abrindo...",
      enabled: hasSimulation && Array.isArray(state.simulacaoAtual?.demonstrativo) && state.simulacaoAtual.demonstrativo.length > 0,
      title: hasSimulation ? "Abrir a tabela completa de parcelas." : "Calcule a simulação para abrir o demonstrativo.",
    });
    setButtonState(el.btnReservar, {
      key: "reservar",
      label: pendenteAprovação
        ? "Aguardando aprovação"
        : status === "reservado"
          ? "Imóvel reservado"
          : "Reservar imóvel",
      busyLabel: "Reservando...",
      enabled: canReserve,
      title: canReserve
        ? "Reservar o imóvel atual."
        : canSubmitApproval
          ? "Esta operação precisa ser enviada para aprovação de venda antes de qualquer reserva."
          : pendenteAprovação
            ? "A unidade está aguardando decisão do gestor."
            : "Disponível apenas para imóveis selecionados e disponíveis.",
    });
    setButtonState(el.btnVender, {
      key: "vender",
      label: status === "vendido" ? "Imóvel vendido" : "Vender imóvel",
      busyLabel: "Vendendo...",
      enabled: canSell,
      title: canSell
        ? "Concluir a venda do imóvel atual."
        : precisaAprovação
          ? "Solicite aprovação de venda ao gestor antes de vender esta operação."
          : valorNegociadoDesajustado
          ? (saldoNegociadoAtual.direction === "acima"
            ? `Venda bloqueada: o total considerado excede o valor negociado em ${textoSaldoValorNegociado}.`
            : `Venda bloqueada: faltam ${textoSaldoValorNegociado} para atingir o valor negociado.`)
          : canSubmitApproval
          ? "Solicite aprovação de venda ao gestor antes de vender esta operação."
          : "Disponível apenas para imóveis selecionados e aptos para venda.",
    });
    if (el.btnSolicitarAprovação) {
      el.btnSolicitarAprovação.hidden = !canSubmitApproval;
      setButtonState(el.btnSolicitarAprovação, {
        key: "aprovar",
        label: "Solicitar aprovação de venda",
        busyLabel: "Enviando...",
        enabled: canSubmitApproval,
        title: canSubmitApproval
          ? "Enviar a operação bloqueada para o gestor aprovar a venda."
          : "Disponível apenas para operações bloqueadas e elegíveis para aprovação.",
      });
    }
    setButtonState(el.btnLiberar, {
      key: "liberar",
      label: pendenteAprovação ? "Cancelar solicitação" : "Liberar reserva",
      busyLabel: "Liberando...",
      enabled: canRelease,
      title: canRelease
        ? (pendenteAprovação ? "Cancelar a solicitação de aprovação do imóvel atual." : "Liberar a reserva do imóvel atual.")
        : "Selecione um imóvel reservado para liberar a reserva.",
    });
    setButtonState(el.btnNova, {
      key: "nova",
      label: "Nova simulação",
      busyLabel: "Limpando...",
      enabled: canReset,
      title: canReset ? "Limpar a simulação atual." : "Nada para limpar no momento.",
    });

    if (!el.actionsHint) return;
    if (state.acaoEmAndamento) {
      el.actionsHint.textContent = "Processando a ação selecionada...";
      return;
    }
    if (!hasClient) {
      el.actionsHint.textContent = "Selecione um cliente para habilitar salvar, reservar e vender.";
      return;
    }
    if (clientContextLoading) {
      el.actionsHint.textContent = "Carregando dados do cliente para liberar cálculo, sugestões e ações.";
      return;
    }
    if (!hasProperty) {
      el.actionsHint.textContent = "Agora escolha uma unidade na vitrine para seguir com a operação.";
      return;
    }
    if (pendenteAprovação) {
      if (reserva && reservadoParaClienteAtual) {
        el.actionsHint.textContent = "Operação enviada para aprovação do gestor. Enquanto isso, você pode apenas acompanhar ou cancelar a solicitação.";
        return;
      }
      if (reserva && reservadoParaOutroCliente) {
        el.actionsHint.textContent = `Essa unidade está aguardando aprovação para ${firstFilled(reserva?.cliente?.nome_completo, "outro cliente")}.`;
        return;
      }
      el.actionsHint.textContent = "Essa unidade está aguardando a decisão do gestor antes de voltar ao fluxo comercial.";
      return;
    }
    if (valorNegociadoDesajustado) {
      if (saldoNegociadoAtual.direction === "acima") {
        el.actionsHint.textContent = `Venda bloqueada: o total considerado excede o valor negociado em ${textoSaldoValorNegociado}. Reduza entrada, balões/reforços ou parcelas antes de vender.`;
      } else {
        el.actionsHint.textContent = podeSubmeterAprovação
          ? `Venda bloqueada: faltam ${textoSaldoValorNegociado} para fechar o valor negociado. Ajuste entrada, balões/reforços ou envie para aprovação de Incentivo 7LM adicional.`
          : `Venda bloqueada: faltam ${textoSaldoValorNegociado} para fechar o valor negociado. Ajuste entrada, balões/reforços ou parcelas antes de vender.`;
      }
      return;
    }
    if (precisaAprovação && podeSubmeterAprovação) {
      el.actionsHint.textContent = firstFilled(
        aprovacaoExcecao?.mensagem,
        "A operação está bloqueada e pode ser enviada para aprovação do gestor. O corretor não pode reservar nem vender até a decisão."
      );
      return;
    }
    if (precisaAprovação) {
      el.actionsHint.textContent = firstFilled(
        aprovacaoExcecao?.mensagem,
        "A operação ainda não bateu os gatilhos e também não pode seguir para aprovação gerencial."
      );
      return;
    }
    if (status === "reservado") {
      if (reserva && reservadoParaClienteAtual) {
        el.actionsHint.textContent = "Unidade reservada para este cliente. Você pode concluir a venda ou liberar a reserva.";
        return;
      }
      if (reserva && reservadoParaOutroCliente) {
        el.actionsHint.textContent = `Unidade reservada para ${firstFilled(reserva?.cliente?.nome_completo, "outro cliente")}. Troque o cliente ou libere a reserva antes de vender.`;
        return;
      }
      el.actionsHint.textContent = "Unidade reservada. Você pode concluir a venda ou liberar a reserva.";
      return;
    }
    if (status === "vendido") {
      el.actionsHint.textContent = "Unidade já vendida. Use Nova simulação para trabalhar outra opção.";
      return;
    }
    if (hasSavedSimulation) {
      el.actionsHint.textContent = "Simulação salva. Agora você pode reservar ou vender esse imóvel.";
      return;
    }
    el.actionsHint.textContent = "A simulação é salva automaticamente conforme você preenche.";
  }

  async function runAction(key, fn) {
    if (state.acaoEmAndamento) {
      return;
    }
    state.acaoEmAndamento = key;
    updateActionButtons();
    try {
      return await fn();
    } finally {
      state.acaoEmAndamento = "";
      updateActionButtons();
    }
  }

  function buildClientAvatarMarkup(cliente, baseClass = "tl-sim-seat__avatar") {
    const photo = normalizeMediaPath(cliente?.foto_principal);
    if (photo) {
      const alt = firstFilled(cliente?.nome_completo, "cliente");
      return `
        <div class="${baseClass} ${baseClass}--photo">
          <img src="${escapeHtml(photo)}" alt="${escapeHtml(`Foto de ${alt}`)}" loading="lazy" />
        </div>`;
    }
    return `<div class="${baseClass}">${escapeHtml(initialsFromName(cliente?.nome_completo || "CL"))}</div>`;
  }

  function buildSummaryBlockMarkup(baseClass, label, value, modifier = "") {
    const text = firstFilled(value, "Não informado");
    return `
      <article class="${baseClass}${modifier ? ` ${modifier}` : ""}">
        <small>${escapeHtml(label)}</small>
        <strong>${escapeHtml(text)}</strong>
      </article>`;
  }

  function buildClientFactMarkup(label, value, modifier = "") {
    return buildSummaryBlockMarkup("tl-sim-seat__fact", label, value, modifier);
  }

  function buildClientMetricMarkup(label, value, modifier = "", baseClass = "tl-sim-seat__metric") {
    return buildSummaryBlockMarkup(baseClass, label, value, modifier);
  }

  function buildDefinitionItemMarkup(baseClass, label, value, modifier = "") {
    const text = firstFilled(value, "Não informado");
    return `
      <div class="${baseClass}${modifier ? ` ${modifier}` : ""}">
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(text)}</dd>
      </div>`;
  }

  function syncClientSelectorState() {
    if (!el.clienteSelector) return;

    const hasClient = Boolean(state.clienteSelecionado?.id);
    const isOpen = !hasClient || state.clienteSelectorAberto;
    const cliente = state.clienteSelecionado || {};
    const clientHub = el.clienteSelector.closest(".tl-sim-client-hub");
    const resumo = [
      firstFilled(cliente.cidade, ""),
      firstFilled(formatCpf(cliente.cpf), ""),
      firstFilled(formatPhone(cliente.telefone), ""),
    ].filter(Boolean);

    clientHub?.classList.toggle("has-client", hasClient);
    clientHub?.classList.toggle("is-selector-open", hasClient && isOpen);
    el.clienteSelector.classList.toggle("is-collapsed", !isOpen);
    el.clienteSelector.classList.toggle("has-client", hasClient);
    el.clienteSelectorToggle?.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (el.clienteSelectorPainel) {
      el.clienteSelectorPainel.hidden = !isOpen;
    }
    if (el.clienteSelectorLabel) {
      el.clienteSelectorLabel.textContent = hasClient ? "Trocar cliente" : "Seleção de cliente";
    }
    if (el.clienteSelectorTitulo) {
      el.clienteSelectorTitulo.textContent = hasClient ? firstFilled(cliente.nome_completo, "Cliente selecionado") : "Buscar cliente";
    }
    if (el.clienteSelectorHint) {
      el.clienteSelectorHint.textContent = hasClient
        ? firstFilled(resumo.join(" • "), "Clique para trocar o cliente")
        : "Busque por nome, CPF, cidade ou e-mail para iniciar a simulação.";
    }
  }

  function renderClientSelected() {
    if (!el.clienteSelecionado) return;
    if (!state.clienteSelecionado) {
      el.clienteSelecionado.innerHTML = '<div class="tl-sim-seat__empty">Selecione um cliente para carregar os dados da simulação.</div>';
      setClientStatus("Nenhum cliente selecionado");
      syncClientSelectorState();
      updateActionButtons();
      return;
    }

    const cliente = state.clienteSelecionado;
    const consolidacao = state.consolidacaoCliente || {};
    const nucleo = consolidacao.nucleo_familiar || {};
    const rendaPrincipal = parseMoney(consolidacao.renda_principal ?? cliente.renda_principal ?? 0);
    const rendaComplementar = parseMoney(consolidacao.renda_complementar || 0);
    const rendaTotal = parseMoney(consolidacao.renda_total ?? cliente.renda_total ?? 0);
    const capacidadeMensal = parseMoney(consolidacao.limite_comprometimento || 0);
    const localizacao = [cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(" • ");
    const cadastroPor = firstFilled(cliente.usuario_cadastro_nome, cliente.usuario_cadastro_email, "");
    const statusDocumental = firstFilled(cliente.status_documental, "Sem status");
    const cidadeBase = firstFilled([cliente.cidade, cliente.estado].filter(Boolean).join(" • "), "Não informada");
    const metaPrimaria = [
      firstFilled(formatCpf(cliente.cpf), "CPF não informado"),
      firstFilled(formatPhone(cliente.telefone), "Sem telefone"),
      firstFilled(cliente.email, "Sem e-mail"),
    ];
    const metaSecundaria = [localizacao, cadastroPor ? `Cadastrado por ${cadastroPor}` : ""].filter(Boolean);

    const quickSignals = [
      `${toNumber(cliente.dependentes ?? 0, 0)} dependente(s)`,
      `${toNumber(cliente.filhos ?? 0, 0)} filho(s)`,
      `${toNumber(nucleo.membros_compoem_renda ?? 0, 0)} compondo renda`,
      `${toNumber(cliente.quantidade_documentos ?? 0, 0)} documento(s)`,
    ];

    const heroMetrics = [
      buildClientMetricMarkup("Renda total", formatMoney(rendaTotal), "tl-sim-client-compact__metric--accent", "tl-sim-client-compact__metric"),
      buildClientMetricMarkup("Capacidade", formatMoney(capacidadeMensal), "", "tl-sim-client-compact__metric"),
      buildClientMetricMarkup("Renda extra", formatMoney(rendaComplementar), "", "tl-sim-client-compact__metric"),
    ];

    const quickFacts = [
      buildSummaryBlockMarkup("tl-sim-client-compact__fact", "Cidade", cidadeBase),
      buildSummaryBlockMarkup("tl-sim-client-compact__fact", "Estado civil", firstFilled(cliente.estado_civil, "Não informado")),
      buildSummaryBlockMarkup(
        "tl-sim-client-compact__fact",
        "Documento",
        statusDocumental,
        cliente.documentacao_pendente ? "tl-sim-client-compact__fact--accent" : ""
      ),
      buildSummaryBlockMarkup("tl-sim-client-compact__fact", "Núcleo", `${toNumber(nucleo.total_membros ?? 0, 0)} pessoa(s)`),
      buildSummaryBlockMarkup("tl-sim-client-compact__fact", "Moradores", `${toNumber(cliente.moradores ?? 0, 0)} pessoa(s)`),
      buildSummaryBlockMarkup("tl-sim-client-compact__fact", "Renda principal", formatMoney(rendaPrincipal)),
    ];

    const reservas = Array.isArray(state.reservasCliente) ? state.reservasCliente : [];
    const reservaPrincipal = reservas[0] || null;
    const reservasHtml = reservaPrincipal
      ? (() => {
          const titulo = firstFilled(reservaPrincipal?.imovel?.titulo, "Imóvel reservado");
          const local = [reservaPrincipal?.imovel?.bairro, reservaPrincipal?.imovel?.cidade, reservaPrincipal?.imovel?.estado].filter(Boolean).join(" • ");
          const auditoria = reservationAuditText(reservaPrincipal);
          const negociacao = reservaPrincipal?.negociacao || {};
          const metricas = [
            parseMoney(negociacao.valor_total_operacao || 0) > 0 ? `Operação ${formatMoney(negociacao.valor_total_operacao)}` : "",
            parseMoney(negociacao.entrada || 0) > 0 ? `Entrada ${formatMoney(negociacao.entrada)}` : "",
            parseMoney(negociacao.financiamento_caixa || 0) > 0 ? `Financiamento ${formatMoney(negociacao.financiamento_caixa)}` : "",
            parseMoney(negociacao.parcela_financiamento_banco || 0) > 0 ? `Banco ${formatMoney(negociacao.parcela_financiamento_banco)}/mês` : "",
          ].filter(Boolean).slice(0, 3);
          const pendenteAprovação = isPendingApprovalReservation(reservaPrincipal);
          const acaoPrincipal = reservaPrincipal.simulacao_id
            ? (pendenteAprovação ? "Abrir solicitação" : "Continuar simulação")
            : (pendenteAprovação ? "Abrir solicitação" : "Assumir no simulador");
          return `
            <div class="tl-sim-client-compact__reserve">
              <div class="tl-sim-client-compact__reserve-head">
                <div>
                  <span class="tl-sim-seat__eyebrow">${escapeHtml(reservationEyebrow(reservaPrincipal))}</span>
                  <strong>${escapeHtml(titulo)}</strong>
                </div>
                <span class="tl-sim-chip">${escapeHtml(reservas.length === 1 ? "1 reserva" : `${reservas.length} reservas`)}</span>
              </div>
              <div class="tl-sim-client-compact__reserve-body">
                <div class="tl-sim-client-compact__reserve-copy">
                  <p>${escapeHtml(firstFilled(local, "Localização não informada"))}</p>
                  ${auditoria ? `<p>${escapeHtml(auditoria)}</p>` : ""}
                  <div class="tl-sim-seat__tags">
                    ${metricas.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
                    ${negociacao.status_simulacao ? `<span>${escapeHtml(`Status ${negociacao.status_simulacao}`)}</span>` : ""}
                    ${pendenteAprovação ? "<span>Aguardando gestor</span>" : ""}
                    ${reservas.length > 1 ? `<span>${escapeHtml(`+${reservas.length - 1} outra(s)`)}</span>` : ""}
                  </div>
                </div>
                <div class="tl-sim-item__actions tl-sim-client-compact__reserve-actions">
                  <button class="tl-imoveis-btn" type="button" data-action="continuar-reserva" data-id="${escapeHtml(reservaPrincipal.imovel_id)}">${escapeHtml(acaoPrincipal)}</button>
                  <button class="tl-imoveis-btn tl-imoveis-btn--secondary" type="button" data-action="selecionar-reserva" data-id="${escapeHtml(reservaPrincipal.imovel_id)}">Abrir imóvel</button>
                  <button class="tl-imoveis-btn tl-imoveis-btn--ghost" type="button" data-action="liberar-reserva" data-id="${escapeHtml(reservaPrincipal.imovel_id)}">${pendenteAprovação ? "Cancelar solicitação" : "Cancelar"}</button>
                </div>
              </div>
            </div>`;
        })()
      : `
        <div class="tl-sim-client-compact__reserve tl-sim-client-compact__reserve--empty">
          <span class="tl-sim-seat__eyebrow">Reserva ativa</span>
          <strong>Sem reserva no momento</strong>
          <p>Cliente pronto para seguir direto na escolha do imóvel e na simulação.</p>
        </div>`;

    el.clienteSelecionado.innerHTML = `
      <div class="tl-sim-client-compact">
        <div class="tl-sim-client-compact__header">
          <div class="tl-sim-client-compact__identity">
            ${buildClientAvatarMarkup(cliente)}
            <div class="tl-sim-client-compact__identity-copy">
              <span class="tl-sim-seat__eyebrow">Cliente selecionado</span>
              <h4 class="tl-sim-client-compact__title">${escapeHtml(cliente.nome_completo || "Cliente")}</h4>
              <p class="tl-sim-client-compact__meta">${escapeHtml(metaPrimaria.join(" • "))}</p>
              ${metaSecundaria.length ? `<p class="tl-sim-client-compact__meta tl-sim-client-compact__meta--soft">${escapeHtml(metaSecundaria.join(" • "))}</p>` : ""}
            </div>
          </div>
          <div class="tl-sim-client-compact__metrics">
            ${heroMetrics.join("")}
          </div>
        </div>
        <div class="tl-sim-client-compact__body">
          <div class="tl-sim-client-compact__facts">
            ${quickFacts.join("")}
          </div>
          <div class="tl-sim-client-compact__signals">
            <span class="tl-sim-client-compact__signal tl-sim-client-compact__signal--accent">${escapeHtml(`Documento ${statusDocumental}`)}</span>
            ${quickSignals.map((item) => `<span class="tl-sim-client-compact__signal">${escapeHtml(item)}</span>`).join("")}
          </div>
        </div>
        ${reservasHtml}
      </div>`;

    setClientStatus(reservas.length ? `${reservas.length} reserva(s) ativa(s)` : "Perfil carregado");
    syncClientSelectorState();
    updateActionButtons();
  }

  function renderClientsList() {
    if (!el.clientesLista) return;
    syncClientSelectorState();

    if (!state.clientes.length) {
      el.clientesLista.innerHTML = '<div class="tl-sim-empty">Nenhum cliente encontrado com esse filtro.</div>';
      return;
    }

    const visibleClients = state.clienteSelecionado
      ? state.clientes.filter((cliente) => String(cliente.id || "") !== String(state.clienteSelecionado?.id || ""))
      : state.clientes;

    if (!visibleClients.length) {
      el.clientesLista.innerHTML = '<div class="tl-sim-empty">Cliente atual carregado. Busque outro nome para trocar a simulação.</div>';
      return;
    }

    const useCompactOptions = Boolean(state.clienteSelecionado?.id);
    const renderLimit = Math.max(toNumber(state.clientesRenderLimit, CLIENTS_RENDER_BATCH), CLIENTS_RENDER_BATCH);
    const renderedClients = visibleClients.slice(0, renderLimit);
    const hasMoreClients = visibleClients.length > renderedClients.length;

    const clientsHtml = renderedClients
      .map((cliente) => {
        const isActive = String(state.clienteSelecionado?.id || "") === String(cliente.id || "");
        const statusLabel = firstFilled(cliente.status_documental, cliente.aprovado ? "Aprovado" : "Sem status");
        const cityLabel = firstFilled(cliente.cidade, "Cidade não informada");
        const cpfLabel = firstFilled(formatCpf(cliente.cpf), "CPF não informado");
        const meta = [cityLabel, cpfLabel].filter(Boolean);
        const contato = firstFilled(formatPhone(cliente.telefone || cliente.celular || ""), cliente.email, "");

        if (useCompactOptions) {
          return `
            <button class="tl-sim-client-option ${isActive ? "is-active" : ""}" type="button" data-action="selecionar-cliente" data-id="${escapeHtml(cliente.id)}">
              <div class="tl-sim-client-option__person">
                ${buildClientAvatarMarkup(cliente, "tl-sim-client-option__avatar")}
                <div class="tl-sim-client-option__body">
                  <strong class="tl-sim-client-option__title">${escapeHtml(cliente.nome_completo || "Cliente")}</strong>
                  <div class="tl-sim-client-option__sub">${escapeHtml(contato || "Contato não informado")}</div>
                  <div class="tl-sim-client-option__row">
                    <span class="tl-sim-client-option__meta-item">${escapeHtml(cityLabel)}</span>
                    <span class="tl-sim-chip tl-sim-client-option__status">${escapeHtml(statusLabel)}</span>
                  </div>
                  <div class="tl-sim-client-option__cpf">${escapeHtml(cpfLabel)}</div>
                </div>
              </div>
              <span class="tl-sim-client-option__cta">Selecionar</span>
            </button>`;
        }

        return `
          <article class="tl-sim-client-card ${isActive ? "is-active" : ""}">
            <div class="tl-sim-client-card__main">
              <div class="tl-sim-client-card__top">
                <div class="tl-sim-client-card__person">
                  ${buildClientAvatarMarkup(cliente, "tl-sim-client-card__avatar")}
                  <div class="tl-sim-client-card__person-body">
                    <h4 class="tl-sim-client-card__title">${escapeHtml(cliente.nome_completo || "Cliente")}</h4>
                    <div class="tl-sim-client-card__sub">${escapeHtml(contato || "Contato não informado")}</div>
                  </div>
                </div>
                ${isActive ? '<span class="tl-sim-badge tl-sim-badge--ideal">Selecionado</span>' : `<span class="tl-sim-chip">${escapeHtml(statusLabel)}</span>`}
              </div>
              <div class="tl-sim-client-card__meta">
                ${meta.map((item) => `<span class="tl-sim-client-card__pill">${escapeHtml(item)}</span>`).join("")}
              </div>
            </div>
            <div class="tl-sim-client-card__actions">
              <button class="tl-imoveis-btn ${isActive ? "tl-imoveis-btn--secondary" : ""}" type="button" data-action="selecionar-cliente" data-id="${escapeHtml(cliente.id)}">${isActive ? "Selecionado" : "Selecionar"}</button>
            </div>
          </article>`;
      })
      .join("");

    el.clientesLista.innerHTML = `${clientsHtml}${hasMoreClients ? `
      <div class="tl-sim-list-more">
        <span>${escapeHtml(`Mostrando ${renderedClients.length} de ${visibleClients.length}`)}</span>
        <button class="tl-imoveis-btn tl-imoveis-btn--secondary" type="button" data-action="mostrar-mais-clientes">Mostrar mais</button>
      </div>` : ""}`;
  }

  function renderComplementos() {
    if (!el.complementosLista) return;

    if (!state.clienteSelecionado) {
      el.complementosLista.innerHTML = '<div class="tl-sim-empty">Os complementos de renda do cliente aparecerão aqui.</div>';
      return;
    }

    const cliente = state.clienteSelecionado;
    const nucleo = state.consolidacaoCliente?.nucleo_familiar || {};
    const rendaComplementarAtiva = parseMoney(nucleo.renda_complementar_ativa ?? state.consolidacaoCliente?.renda_complementar ?? 0);
    const summary = [
      buildClientMetricMarkup("Núcleo", String(toNumber(nucleo.total_membros ?? 0, 0)), "", "tl-sim-household-strip__metric"),
      buildClientMetricMarkup("Em análise", String(toNumber(nucleo.membros_em_analise ?? 0, 0)), "", "tl-sim-household-strip__metric"),
      buildClientMetricMarkup("Compondo renda", String(toNumber(nucleo.membros_compoem_renda ?? 0, 0)), "", "tl-sim-household-strip__metric"),
      buildClientMetricMarkup("Renda extra", formatMoney(rendaComplementarAtiva), "tl-sim-household-strip__metric--accent", "tl-sim-household-strip__metric"),
    ];

    const snapshot = [
      buildSummaryBlockMarkup("tl-sim-household-strip__fact", "Dependentes", `${toNumber(cliente.dependentes ?? 0, 0)}`),
      buildSummaryBlockMarkup("tl-sim-household-strip__fact", "Filhos", `${toNumber(cliente.filhos ?? 0, 0)}`),
      buildSummaryBlockMarkup("tl-sim-household-strip__fact", "Moradores", `${toNumber(cliente.moradores ?? 0, 0)}`),
      buildSummaryBlockMarkup("tl-sim-household-strip__fact", "Documentos", `${toNumber(cliente.quantidade_documentos ?? 0, 0)}`),
    ];

    const content = state.complementos.length
      ? state.complementos
          .map((item) => {
            const renda = formatMoney(parseMoney(item.renda || 0));
            const emAnalise = item.incluir_na_analise !== false;
            const compoeRenda = item.compoe_renda !== false;
            const compFinanceira = item.incluir_na_composicao_financeira !== false;

            return `
              <details class="tl-sim-household-strip__item">
                <summary>
                  <div class="tl-sim-household-strip__item-copy">
                    <strong>${escapeHtml(item.nome || "Complemento")}</strong>
                    <small>${escapeHtml(firstFilled(item.parentesco, "Parentesco não informado"))}</small>
                  </div>
                  <div class="tl-sim-household-strip__item-meta">
                    <span class="tl-sim-chip">${escapeHtml(renda)}</span>
                    <span class="tl-sim-chip">${escapeHtml(emAnalise ? "Em análise" : "Pausado")}</span>
                  </div>
                </summary>
                <div class="tl-sim-household-strip__item-body">
                  <div class="tl-sim-client-compact__signals">
                    <span class="tl-sim-client-compact__signal">${escapeHtml(compoeRenda ? "Compõe renda" : "Não compõe renda")}</span>
                    <span class="tl-sim-client-compact__signal">${escapeHtml(compFinanceira ? "Na composição financeira" : "Fora da composição financeira")}</span>
                  </div>
                  <div class="tl-sim-item__actions">
                    <button class="tl-imoveis-btn tl-imoveis-btn--secondary" type="button" data-action="editar-complemento" data-id="${escapeHtml(item.id)}">Editar</button>
                    <button class="tl-imoveis-btn tl-imoveis-btn--ghost" type="button" data-action="toggle-complemento" data-id="${escapeHtml(item.id)}">${emAnalise ? "Pausar" : "Retomar"}</button>
                    <button class="tl-imoveis-btn tl-imoveis-btn--ghost" type="button" data-action="toggle-renda-complemento" data-id="${escapeHtml(item.id)}">${compoeRenda ? "Tirar renda" : "Compor Renda"}</button>
                    <button class="tl-imoveis-btn tl-imoveis-btn--ghost" type="button" data-action="toggle-financeira-complemento" data-id="${escapeHtml(item.id)}">${compFinanceira ? "Fora comp." : "Na comp."}</button>
                    <button class="tl-imoveis-btn tl-imoveis-btn--danger" type="button" data-action="excluir-complemento" data-id="${escapeHtml(item.id)}">Excluir</button>
                  </div>
                </div>
              </details>`;
          })
          .join("")
      : '<p class="tl-sim-household-strip__empty">Sem complemento ativo. Use o botão ao lado apenas quando precisar compor renda.</p>';

    el.complementosLista.innerHTML = `
      <div class="tl-sim-household-strip ${state.complementos.length ? "has-items" : "is-empty"}">
        <div class="tl-sim-household-strip__head">
          <div>
            <span class="tl-sim-seat__eyebrow">Núcleo familiar</span>
            <strong>Resumo rápido para apoiar a simulação</strong>
          </div>
          <span class="tl-sim-chip">${escapeHtml(state.complementos.length ? `${state.complementos.length} complemento(s)` : "Sem complemento")}</span>
        </div>
        <div class="tl-sim-household-strip__summary">
          ${summary.join("")}
        </div>
        <div class="tl-sim-household-strip__facts">
          ${snapshot.join("")}
        </div>
        <div class="tl-sim-household-strip__content">
          ${content}
        </div>
      </div>
    `;
  }

  function renderSuggestionsSummary(visibleSuggestions) {
    if (!el.sugestõesResumo) return;

    if (!state.clienteSelecionado) {
      el.sugestõesResumo.innerHTML = "Selecione um cliente para carregar as sugestões.";
      return;
    }

    const parcelaCliente = normalizeClientInstallment();
    if (!parcelaCliente.valido) {
      el.sugestõesResumo.innerHTML = "Cliente sem renda válida para calcular a capacidade e liberar a vitrine.";
      return;
    }

    const total = state.sugestões.length;
    const avaliadas = state.sugestõesAvaliadas || total;
    const ideais = state.sugestões.filter((item) => normalizeSearch(getSuggestionBadgeValue(item)) === "ideal").length;
    const comAjuste = state.sugestões.filter((item) => {
      const status = normalizeSearch(getSuggestionBadgeValue(item));
    return status === "atencao" || !!item.ajuste_entrada || !!item.ajuste_fluxo_pre_obra;
    }).length;
    const stretch = state.sugestões.filter((item) => {
      const status = normalizeSearch(getSuggestionBadgeValue(item));
      const availability = normalizeStatus(item.imovel?.status);
    return status === "invalida"
        || availability === "reservado"
        || isPendingApprovalStatus(availability)
        || availability === "vendido"
        || availability === "inativo";
    }).length;

    el.sugestõesResumo.innerHTML = `
      <strong>${escapeHtml(String(visibleSuggestions.length))} opção(ões)</strong> no modo ${escapeHtml(getSuggestionModeLabel(state.modoSugestoes).toLowerCase())}
      <span class="tl-sim-chip">${escapeHtml(String(ideais))} ideais</span>
      <span class="tl-sim-chip">${escapeHtml(String(comAjuste))} com entrada guiada</span>
      <span class="tl-sim-chip">${escapeHtml(String(stretch))} fora da faixa</span>
      <span class="tl-sim-chip">${escapeHtml(String(avaliadas))} unidades avaliadas</span>
    `;
  }

  function renderSuggestionsLoading(message) {
    if (el.sugestõesResumo) {
      el.sugestõesResumo.innerHTML = `
        <strong>Carregando...</strong>
        <span class="tl-sim-chip">buscando imóveis</span>
        <span class="tl-sim-chip">calculando perfil</span>
      `;
    }
    if (el.sugestõesLista) {
      el.sugestõesLista.innerHTML = `<div class="tl-sim-empty">${escapeHtml(message || "Carregando imóveis sugeridos...")}</div>`;
    }
    updateSuggestionsScrollHint(false);
  }

  function updateSuggestionsScrollHint(hasMoreSuggestions = false) {
    if (!el.sugestoesScrollHint || !el.sugestõesLista) return;
    window.requestAnimationFrame(() => {
      const hasScrollableContent = el.sugestõesLista.scrollHeight > el.sugestõesLista.clientHeight + 8;
      el.sugestoesScrollHint.hidden = !(hasMoreSuggestions || hasScrollableContent);
    });
  }

  function renderSuggestions() {
    if (!el.sugestõesLista) return;

    const visibleSuggestions = getVisibleSuggestions();
    renderSuggestionsSummary(visibleSuggestions);

    if (!state.clienteSelecionado) {
      el.sugestõesLista.innerHTML = '<div class="tl-sim-empty">Selecione um cliente para ver os imóveis sugeridos.</div>';
      updateSuggestionsScrollHint(false);
      return;
    }

    const parcelaCliente = normalizeClientInstallment();
    if (!parcelaCliente.valido) {
      el.sugestõesLista.innerHTML = '<div class="tl-sim-empty">O cliente precisa ter renda válida no cadastro para carregar a vitrine.</div>';
      updateSuggestionsScrollHint(false);
      return;
    }

    if (!state.sugestões.length) {
      el.sugestõesLista.innerHTML = '<div class="tl-sim-empty">Nenhuma sugestão foi carregada para esse perfil. Clique em "Calcular" para atualizar a vitrine novamente.</div>';
      updateSuggestionsScrollHint(false);
      return;
    }

    if (!visibleSuggestions.length) {
      el.sugestõesLista.innerHTML = '<div class="tl-sim-empty">Nenhum imóvel encontrado nesse filtro. Limpe a busca ou troque o modo para ver outras opções.</div>';
      updateSuggestionsScrollHint(false);
      return;
    }

    const renderLimit = Math.max(toNumber(state.sugestoesRenderLimit, SUGGESTIONS_RENDER_BATCH), SUGGESTIONS_RENDER_BATCH);
    const renderedSuggestions = visibleSuggestions.slice(0, renderLimit);
    const hasMoreSuggestions = visibleSuggestions.length > renderedSuggestions.length;

    const suggestionsHtml = renderedSuggestions
      .map((item) => {
        const imovel = item.imovel || {};
        const { resumo } = resolveSuggestionSimulationContext({ suggestion: item, resumo: item.resumo_operacao || {} });
        const valoresComerciais = resolveSuggestionCommercialValues({ ...item, resumo_operacao: resumo });
        const ajuste = item.ajuste_entrada;
        const photo = normalizeMediaPath(imovel.foto_principal);
        const isSelected = String(state.imovelSelecionado?.id || "") === String(imovel.id || "");
        const isCompared = state.comparador.some((entry) => entry.id === String(imovel.id || ""));
        const localizacao = [imovel.cidade, imovel.bairro].filter(Boolean).join(" • ");
        const reserva = getReservationForProperty(imovel);
        const resumoImovel = [
          imovel.agrupamento?.unidade ? `Unidade ${imovel.agrupamento.unidade}` : "",
          imovel.agrupamento?.bloco ? `Bloco ${imovel.agrupamento.bloco}` : "",
          firstFilled(imovel.tipologia, imovel.tipo_imovel),
          imovel.area_m2 ? formatArea(imovel.area_m2) : "",
          toNumber(imovel.dormitorios || imovel.quartos, 0) > 0 ? `${toNumber(imovel.dormitorios || imovel.quartos, 0)} dorm.` : "",
        ].filter(Boolean).join(" • ");
        const metrics = [
          valoresComerciais.hasCommercialAdjustment
            ? `Negoc ${formatMoney(valoresComerciais.valorNegociado)}`
            : formatMoney(valoresComerciais.valorImovel),
          ...(valoresComerciais.hasDiscount ? [`Cheio ${formatMoney(valoresComerciais.valorImovel)}`] : []),
          ...(valoresComerciais.desconto > 0.01 ? [`Incentivo 7LM -${formatMoney(valoresComerciais.desconto)}`] : []),
          `Obra ${formatPercent(imovel.percentual_conclusao_obra || resumo.percentual_conclusao_obra || 0)}`,
        imovel.data_entrega ? `Entrega ${formatDateLabel(imovel.data_entrega)}` : `Entrega ${toNumber(imovel.meses_pre_entrega ?? resumo.meses_pre_entrega ?? 36, 36)}m`,
          `Comp ${formatPercent(resumo.percentual_comprometimento || 0)}`,
          `Fecha ${formatPercent(resumo.percentual_fechamento_inicial || 0)}`,
        ];
        const ajusteFluxo = item.ajuste_fluxo_pre_obra || resumo.sugestao_reforco_pre_obra || null;
        const ajusteHtml = ajuste
          ? `
            <div class="tl-sim-sugestao-card__entry">
              <span>Entrada sugerida</span>
              <strong>${escapeHtml(formatMoney(ajuste.entrada_sugerida || 0))}</strong>
            </div>`
          : "";
        const ajusteFluxoHtml = ajusteFluxo
          ? `
            <div class="tl-sim-sugestao-card__entry">
              <span>Reforco até as chaves</span>
              <strong>${escapeHtml(`${toNumber(ajusteFluxo.quantidade, 0)}x ${firstFilled(ajusteFluxo.tipo, "reforco")}`)}</strong>
              <small>${escapeHtml(formatMoney(ajusteFluxo.valor_unitario || 0))}</small>
            </div>`
          : "";
        const reservaHtml = reserva
          ? `
            <div class="tl-sim-reserva-strip ${isReservationForSelectedClient(reserva) ? "is-own" : "is-other"}">
              <strong>${escapeHtml(reservationTitle(reserva))}</strong>
              <span>${escapeHtml(firstFilled(reservationSummary(reserva), isPendingApprovalReservation(reserva) ? "Solicitação enviada para avaliação do gestor." : "Negociação vinculada a reserva ativa."))}</span>
            </div>`
          : (normalizeStatus(imovel.status) === "reservado" || isPendingApprovalStatus(imovel.status)
              ? `
                <div class="tl-sim-reserva-strip is-manual">
                  <strong>${escapeHtml(isPendingApprovalStatus(imovel.status) ? "Solicitação pendente sem cliente vinculado" : "Reserva sem cliente vinculado")}</strong>
                  <span>${escapeHtml(isPendingApprovalStatus(imovel.status) ? "Essa unidade está travada aguardando avaliação gerencial." : "Essa unidade foi marcada como reservada sem negociação salva.")}</span>
                </div>`
              : "");

        return `
          <article class="tl-sim-sugestao-card ${isSelected ? "is-selected" : ""}">
            <div class="tl-sim-sugestao-card__media">
              <button class="tl-sim-sugestao-card__media-trigger" type="button" data-action="abrir-galeria-imovel" data-id="${escapeHtml(imovel.id)}" aria-label="Abrir galeria de ${escapeHtml(imovel.titulo || "imóvel")}">
              ${photo ? `<img class="tl-sim-sugestao-card__image" src="${escapeHtml(photo)}" alt="${escapeHtml(imovel.titulo || "Imóvel")}" />` : '<span class="tl-sim-sugestao-card__placeholder">Sem foto cadastrada</span>'}
              </button>
              <div class="tl-sim-sugestao-card__body">
                <div class="tl-sim-badge-row">
                  ${buildClassificacaoBadge(getSuggestionBadgeValue(item))}
                  ${buildAvailabilityBadge(imovel.status)}
                </div>
                <div>
                  <h4 class="tl-sim-sugestao-card__title" title="${escapeHtml(imovel.titulo || "Imóvel")}">${escapeHtml(imovel.titulo || "Imóvel")}</h4>
                  <div class="tl-sim-sugestao-card__subtitle">${escapeHtml(firstFilled(localizacao, "Localização não informada"))}</div>
                  <div class="tl-sim-sugestao-card__summary">${escapeHtml(firstFilled(resumoImovel, "Dados do imóvel não informados"))}</div>
                </div>
              </div>
            </div>
            ${reservaHtml}
            <div class="tl-sim-metrics">${metrics.map((metric) => `<span class="tl-sim-metric">${escapeHtml(metric)}</span>`).join("")}</div>
            ${ajusteHtml}
            ${ajusteFluxoHtml}
            <div class="tl-sim-sugestao-card__actions">
              <button class="tl-imoveis-btn" type="button" data-action="${reserva?.simulacao_id && isReservationForSelectedClient(reserva) ? "continuar-sugestao-reserva" : "selecionar-sugestao"}" data-id="${escapeHtml(imovel.id)}">${reserva?.simulacao_id && isReservationForSelectedClient(reserva) ? "Continuar reserva" : (isSelected ? "Selecionado" : "Selecionar")}</button>
              <button class="tl-imoveis-btn tl-imoveis-btn--compare" type="button" data-action="comparar-sugestao" data-id="${escapeHtml(imovel.id)}">${isCompared ? "Comparando" : "Comparar"}</button>
              ${ajuste ? `<button class="tl-imoveis-btn tl-imoveis-btn--entry" type="button" data-action="aplicar-entrada" data-id="${escapeHtml(imovel.id)}">Aplicar entrada sugerida</button>` : ""}
            </div>
          </article>`;
      })
      .join("");

    el.sugestõesLista.innerHTML = `${suggestionsHtml}${hasMoreSuggestions ? `
      <div class="tl-sim-list-more">
        <span>${escapeHtml(`Mostrando ${renderedSuggestions.length} de ${visibleSuggestions.length}`)}</span>
        <button class="tl-imoveis-btn tl-imoveis-btn--secondary" type="button" data-action="mostrar-mais-sugestoes">Mostrar mais</button>
      </div>` : ""}`;
    updateSuggestionsScrollHint(hasMoreSuggestions);
  }

  function renderCompareTray() {
    if (!el.comparador) return;
    syncComparadorWithSuggestions();

    if (!state.comparador.length) {
      el.comparador.innerHTML = "";
      return;
    }

    el.comparador.innerHTML = state.comparador
      .map((item) => {
        const { resumo } = resolveSuggestionSimulationContext({ suggestion: item, resumo: item.resumo_operacao || {} });
        const valoresComerciais = resolveSuggestionCommercialValues({ ...item, resumo_operacao: resumo });
        const isActive = String(state.imovelSelecionado?.id || "") === String(item.id || "");
        const ajuste = item.ajuste_entrada;
        return `
          <article class="tl-sim-compare-card">
            <div class="tl-sim-badge-row">
              ${buildClassificacaoBadge(getSuggestionBadgeValue(item))}
              ${isActive ? '<span class="tl-sim-fact">em destaque</span>' : ""}
            </div>
            <h4 class="tl-sim-compare-card__title">${escapeHtml(item.imovel?.titulo || "Unidade")}</h4>
            <div class="tl-sim-facts">
              <span class="tl-sim-fact">${escapeHtml(formatMoney(valoresComerciais.valorNegociado))}</span>
              ${valoresComerciais.hasDiscount ? `<span class="tl-sim-fact">Incentivo 7LM ${escapeHtml(formatMoney(valoresComerciais.desconto))}</span>` : ""}
              <span class="tl-sim-fact">${escapeHtml(formatPercent(resumo.percentual_comprometimento || 0))}</span>
              ${ajuste ? `<span class="tl-sim-fact">entrada ${escapeHtml(formatMoney(ajuste.entrada_sugerida || 0))}</span>` : ""}
            </div>
            <div class="tl-sim-item__actions">
              <button class="tl-imoveis-btn tl-imoveis-btn--secondary" type="button" data-action="destacar-comparador" data-id="${escapeHtml(item.id)}">Destacar</button>
              <button class="tl-imoveis-btn tl-imoveis-btn--ghost" type="button" data-action="remover-comparador" data-id="${escapeHtml(item.id)}">Remover</button>
            </div>
          </article>`;
      })
      .join("");
  }

  function collectPropertyPhotos(imovel) {
    const photos = Array.isArray(imovel.midias_fotos) ? imovel.midias_fotos.map(normalizeMediaItem).filter((item) => item.caminho_arquivo) : [];
    const fallback = normalizeMediaPath(imovel.foto_principal);
    if (fallback && !photos.some((item) => item.caminho_arquivo === fallback)) {
      photos.unshift({
        id: "principal",
        nome_arquivo: imovel.titulo || "Foto principal",
        caminho_arquivo: fallback,
        eh_principal: true,
      });
    }
    return photos;
  }

  function renderPropertyPreview() {
    if (!el.imovelPreview) return;
    if (!state.imovelSelecionado) {
      el.imovelPreview.innerHTML = '<div class="tl-sim-empty">Selecione um imóvel para visualizar fotos e dados da unidade.</div>';
      setPropertyStatus("Sem unidade selecionada");
      applyFinancialTone("neutral");
      updateActionButtons();
      return;
    }

    const imovel = state.imovelSelecionado;
    const suggestion = getSelectedSuggestion();
    const { resumo, suggestion: previewSuggestion } = resolveSuggestionSimulationContext({
      suggestion,
      resumo: state.simulacaoAtual?.resumo_operacao || suggestion?.resumo_operacao || {},
    });
    const ajuste = suggestion?.ajuste_entrada || null;
    const mapData = buildPropertyMapData(imovel);
    const reserva = getReservationForProperty(imovel);
    const photos = collectPropertyPhotos(imovel);
    const videos = Array.isArray(imovel.midias_videos) ? imovel.midias_videos.map(normalizeMediaItem).filter((item) => item.caminho_arquivo) : [];
    const activeIndex = photos.length ? clamp(state.fotoAtivaIndice, 0, photos.length - 1) : 0;
    state.fotoAtivaIndice = activeIndex;
    const activePhoto = photos[activeIndex]?.caminho_arquivo || "";
    const hasMediaGallery = Boolean(activePhoto || photos.length);
    const addressLine = firstFilled(
      imovel.endereco_formatado,
      [imovel.endereco, imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(", ")
    );
    const locationLine = firstFilled(
      [imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(" • "),
      [imovel.cidade, imovel.estado].filter(Boolean).join(" • "),
      imovel.cidade,
      imovel.bairro
    );
    const hasResumo = Object.keys(resumo).length > 0;
    const valorFechamento = resolveValorFechamento(resumo);
    const valorEntregaChaves = resolveValorEntregaChaves(resumo);
    const valorGarantidoPlanejado = resolveGuaranteedValue(
      {
        valor_garantido_planejado: firstFilled(
          resumo.valor_garantido_planejado,
          resumo.valor_garantido,
          imovel.valor_garantido_planejado,
          imovel.valor_garantido
        ),
        valor_imovel: firstFilled(resumo.valor_imovel, imovel.valor),
        percentual_fechamento_minimo: firstFilled(resumo.percentual_fechamento_minimo, imovel.percentual_fechamento_minimo, 0.7),
      },
      firstFilled(imovel.valor_garantido_planejado, imovel.valor_garantido)
    );
    const valorGarantidoReal = parseMoney(firstFilled(resumo.valor_garantido_real, hasResumo ? valorFechamento : 0));
    const valorGarantidoPreObraPlanejado = resolvePlannedDeliveryCaptureValue(
      {
        valor_garantido_pre_obra_planejado: firstFilled(
          resumo.valor_garantido_pre_obra_planejado,
          imovel.valor_garantido_pre_obra_planejado
        ),
        percentual_captacao_ate_entrega: firstFilled(
          resumo.percentual_captacao_ate_entrega,
          imovel.percentual_captacao_ate_entrega
        ),
        valor_imovel: firstFilled(resumo.valor_imovel, imovel.valor),
      },
      imovel.valor_garantido_pre_obra_planejado
    );
    const valorGarantidoPreObraReal = parseMoney(firstFilled(
      resumo.valor_garantido_pre_obra_real,
      resumo.valor_projetado_entrega,
      hasResumo ? valorEntregaChaves : 0
    ));
    const percentualCaptacaoAteEntrega = resolveDeliveryCapturePercent(
      {
        percentual_captacao_ate_entrega: firstFilled(
          resumo.percentual_captacao_ate_entrega,
          imovel.percentual_captacao_ate_entrega
        ),
        valor_garantido_pre_obra_planejado: firstFilled(
          resumo.valor_garantido_pre_obra_planejado,
          imovel.valor_garantido_pre_obra_planejado
        ),
        valor_imovel: firstFilled(resumo.valor_imovel, imovel.valor),
      },
      imovel.percentual_captacao_ate_entrega
    );
    const valorParcelaMinimaPreObra = resolveMinimumPreWorkValue(
      {
        valor_parcela_minima_pre_obra: firstFilled(resumo.valor_parcela_minima_pre_obra, imovel.valor_parcela_minima_pre_obra),
      },
      imovel.valor_parcela_minima_pre_obra
    );
    const capacidadeCliente = parseMoney(state.consolidacaoCliente?.limite_comprometimento || resumo.limite_comprometimento || 0);
    const parcelaIdeal = parseMoney(resumo.parcela_7lm_pos_ideal || resumo.parcela_7lm_pos || resumo.mensal_pos || 0);
    const entradaOrientada = parseMoney(ajuste?.entrada_sugerida || resumo.entrada || 0);
    const operacao = resolveOperationValues(resumo, imovel);
    const hasCommercialAdjustment = operacao.sobrepreco > 0.01 || operacao.desconto > 0.01;
    const crediturAtivo = Boolean(resumo.creditur_ativo || operacao.crediturRetencao > 0.01);
    const totalPagoCliente = resolveTotalPaidByClient(resumo, operacao);
    const saldoClienteImovel = resolvePropertyPaymentBalance(operacao, totalPagoCliente);
    const saldoClienteNegociado = resolveNegotiatedPaymentBalance(resumo, operacao, totalPagoCliente);
    const analiseAprovaçãoAtual = state.simulacaoAtual?.aprovacao_excecao || resumo.aprovacao_excecao || null;
    syncNegotiatedValueField(resumo);
    const gapGarantido = Math.max(valorGarantidoPlanejado - valorGarantidoReal, 0);
    const gapEntrega = Math.max(valorGarantidoPreObraPlanejado - valorGarantidoPreObraReal, 0);
    const facts = [
      firstFilled(imovel.empreendimento, "Empreendimento não informado"),
      firstFilled(imovel.tipologia, imovel.tipo_imovel),
      imovel.area_m2 ? formatArea(imovel.area_m2) : "",
      toNumber(imovel.dormitorios || imovel.quartos, 0) > 0 ? `${toNumber(imovel.dormitorios || imovel.quartos, 0)} dormitório(s)` : "",
      toNumber(imovel.vagas || imovel.vagas_garagem || 0, 0) > 0 ? `${toNumber(imovel.vagas || imovel.vagas_garagem || 0, 0)} vaga(s)` : "",
      locationLine,
    ].filter(Boolean).slice(0, 5);
    const summaryCopy = hasResumo
      ? gapGarantido > 0.01
        ? `Faltam ${formatMoney(gapGarantido)} para esta unidade encaixar no garantido planejado.`
        : gapEntrega > 0.01
          ? `Garantido encaixado. Ainda faltam ${formatMoney(gapEntrega)} para chegar forte até as chaves.`
          : "Unidade bem encaixada para este cliente. Agora acompanhe entrada, parcela ideal e prazo."
      : truncateText(firstFilled(imovel.descricao, "Confira valor, prazo e leitura comercial desta unidade."), 150);
    const entryOverflowMessage = resolveEntryOverflowWarning(resumo);
    const idealGapMessage = hasResumo && !entryOverflowMessage
      ? (gapGarantido > 0.01 && gapEntrega > 0.01
        ? `Para ficar ideal: faltam ${formatMoney(gapGarantido)} no garantido e ${formatMoney(gapEntrega)} até as chaves. Reforce entrada, FGTS ou parcelas.`
        : (gapGarantido > 0.01
          ? `Para ficar ideal: faltam ${formatMoney(gapGarantido)} no garantido. Reforce entrada ou FGTS.`
          : (gapEntrega > 0.01
            ? `Para ficar ideal: faltam ${formatMoney(gapEntrega)} até as chaves. Reforce parcelas ou intermediárias.`
            : "Operação ideal: garantido e chaves encaixados.")))
      : "";
    const idealGapTone = gapGarantido > 0.01 || gapEntrega > 0.01 ? "warning" : "good";
    const negotiatedGapMessage = hasResumo && saldoClienteNegociado.direction === "faltante"
      ? (analiseAprovaçãoAtual?.permitida
        ? `Venda bloqueada: faltam ${formatMoney(saldoClienteNegociado.amount)} para chegar no valor negociado. Ajuste entrada, balões/reforços ou solicite aprovação de Incentivo 7LM adicional.`
        : `Venda bloqueada: faltam ${formatMoney(saldoClienteNegociado.amount)} para chegar no valor negociado. Ajuste entrada, balões/reforços ou parcelas antes de vender.`)
      : (hasResumo && saldoClienteNegociado.direction === "acima"
        ? `Venda bloqueada: o total considerado excede o valor negociado em ${formatMoney(saldoClienteNegociado.amount)}. Reduza entrada, balões/reforços ou parcelas.`
        : "");
    const primaryMetrics = [
      ["Valor total do imóvel", formatMoney(operacao.valorImovel)],
      ["Valor total pago pelo cliente", formatMoney(totalPagoCliente)],
      [saldoClienteImovel.label, saldoClienteImovel.value],
      ...(crediturAtivo || hasCommercialAdjustment
        ? [["Valor negociado", formatMoney(operacao.valorNegociado)]]
        : []),
      [ajuste ? "Entrada sugerida" : "Entrada atual", hasResumo || ajuste ? formatMoney(entradaOrientada) : "Calcule para ver"],
      ["Parcela ideal", hasResumo ? formatMoney(parcelaIdeal) : "Calcule para ver"],
      [
        gapGarantido > 0.01 ? "Falta para encaixar" : "Meta da unidade",
        hasResumo ? (gapGarantido > 0.01 ? formatMoney(gapGarantido) : "Encaixada") : "Calcule para ver",
      ],
      [
        gapEntrega > 0.01 ? "Falta até as chaves" : "Até as chaves",
        hasResumo ? (gapEntrega > 0.01 ? formatMoney(gapEntrega) : "Encaixado") : (imovel.data_entrega ? formatDateLabel(imovel.data_entrega) : "Não informado"),
      ],
    ];
    const secondaryMetrics = [
      ["Valor total do imóvel", formatMoney(operacao.valorImovel)],
      ["Valor total pago pelo cliente", formatMoney(totalPagoCliente)],
      [saldoClienteImovel.label, saldoClienteImovel.value],
      ...(operacao.sobrepreco > 0.01 ? [["Sobrepreço", formatMoney(operacao.sobrepreco)]] : []),
      ...(operacao.desconto > 0.01 ? [["Incentivo 7LM", `- ${formatMoney(operacao.desconto)}`]] : []),
      ...(hasCommercialAdjustment ? [["Valor negociado", formatMoney(operacao.valorNegociado)]] : []),
      ["Garantido Planejado", valorGarantidoPlanejado > 0 ? formatMoney(valorGarantidoPlanejado) : "Não informado"],
      ["Garantido Real", hasResumo ? formatMoney(valorGarantidoReal) : "Calcule para ver"],
      ["Garantido + Pré Obra Planejado", valorGarantidoPreObraPlanejado > 0 ? formatMoney(valorGarantidoPreObraPlanejado) : "Não informado"],
      ["Garantido + Pré Obra Real", hasResumo ? formatMoney(valorGarantidoPreObraReal) : "Calcule para ver"],
      ...(valorParcelaMinimaPreObra > 0 ? [["Pré-obra mínima", formatMoney(valorParcelaMinimaPreObra)]] : []),
    ];
    const financeTone = resolveFinancialTone({ resumo, suggestion: previewSuggestion });
    const previewStatus = hasResumo
      ? resolveUserFacingStatus({ resumo, suggestion: previewSuggestion })
      : (previewSuggestion ? getSuggestionBadgeValue(previewSuggestion) : "");
    applyFinancialTone(financeTone);
    const buildShowcaseMetricMarkup = ([label, value]) =>
      `<article class="tl-sim-showcase__metric tl-sim-showcase__metric--${financeTone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
    const videosHtml = videos.length
      ? `
        <div class="tl-sim-showcase__video-list">
          ${videos.map((item, index) => `<a href="${escapeHtml(item.caminho_arquivo)}" target="_blank" rel="noopener">Video ${escapeHtml(String(index + 1))}</a>`).join("")}
        </div>`
      : "";
    const thumbsHtml = photos.length > 1
      ? `<div class="tl-sim-showcase__thumbs" aria-label="Miniaturas das fotos do imóvel">${photos.map((item, index) => `<button class="tl-sim-showcase__thumb ${index === activeIndex ? "is-active" : ""}" type="button" data-action="thumb-imovel" data-index="${index}" aria-label="Selecionar foto ${index + 1}"><img src="${escapeHtml(item.caminho_arquivo)}" alt="${escapeHtml(item.nome_arquivo || `Foto ${index + 1}`)}" /></button>`).join("")}</div>`
      : "";
    const mediaHtml = hasMediaGallery
      ? `
        <div class="tl-sim-showcase__media">
          <div class="tl-sim-showcase__stage ${thumbsHtml ? "has-thumbs" : ""}">
            <button class="tl-sim-showcase__main-trigger" type="button" data-action="abrir-galeria-imovel" data-id="${escapeHtml(imovel.id)}" data-index="${activeIndex}" aria-label="Abrir galeria de ${escapeHtml(imovel.titulo || "unidade")}">
              ${activePhoto ? `<img class="tl-sim-showcase__main" src="${escapeHtml(activePhoto)}" alt="${escapeHtml(imovel.titulo || "Imóvel")}" />` : '<span class="tl-sim-showcase__main--empty">Sem foto principal para esta unidade.</span>'}
            </button>
            ${thumbsHtml}
          </div>
        </div>`
      : "";
    const reservaMetricas = reserva
      ? [
          ["Valor negociado", formatMoney(parseMoney(reserva.negociacao?.valor_total_operacao || 0))],
          ["Entrada", formatMoney(parseMoney(reserva.negociacao?.entrada || 0))],
          ["Financiamento", formatMoney(parseMoney(reserva.negociacao?.financiamento_caixa || 0))],
          ["Parcela banco", formatMoney(parseMoney(reserva.negociacao?.parcela_financiamento_banco || 0))],
          ["Saldo pós-entrega", formatMoney(parseMoney(reserva.negociacao?.saldo_pos_entrega || 0))],
        ]
      : [];
    const reservaHtml = reserva
      ? `
        <div class="tl-sim-reserva-panel ${isReservationForSelectedClient(reserva) ? "is-own" : "is-other"}">
          <div class="tl-sim-reserva-panel__head">
            <div>
              <span class="tl-sim-seat__eyebrow">${escapeHtml(reservationEyebrow(reserva))}</span>
              <strong>${escapeHtml(reservationTitle(reserva))}</strong>
            </div>
            <span class="tl-sim-chip">${escapeHtml(formatDateTimeLabel(reserva.reservado_em))}</span>
          </div>
          <p>${escapeHtml(firstFilled(reservationSummary(reserva), isPendingApprovalReservation(reserva) ? "Solicitação enviada para avaliação do gestor." : "Negociação salva no momento da reserva."))}</p>
          <div class="tl-sim-reserva-panel__metrics">
            ${reservaMetricas.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}
          </div>
          ${reserva.observacoes ? `<small class="tl-sim-reserva-panel__note">${escapeHtml(reserva.observacoes)}</small>` : ""}
        </div>`
      : (normalizeStatus(imovel.status) === "reservado" || isPendingApprovalStatus(imovel.status)
          ? `
            <div class="tl-sim-reserva-panel is-manual">
              <div class="tl-sim-reserva-panel__head">
                <div>
                  <span class="tl-sim-seat__eyebrow">${escapeHtml(reservationEyebrow(null, { fallbackPending: isPendingApprovalStatus(imovel.status) }))}</span>
                  <strong>${escapeHtml(isPendingApprovalStatus(imovel.status) ? "Solicitação pendente sem cliente vinculado" : "Reserva sem cliente vinculado")}</strong>
                </div>
              </div>
              <p>${escapeHtml(isPendingApprovalStatus(imovel.status) ? "Essa unidade foi travada para avaliação gerencial e ainda não tem uma negociação detalhada visível aqui." : "Essa unidade foi marcada como reservada fora do fluxo completo do simulador, por isso os detalhes da negociação não estão disponíveis.")}</p>
            </div>`
          : "");
    const isCompared = state.comparador.some((item) => item.id === String(imovel.id || ""));

    el.imovelPreview.innerHTML = `
      <div class="tl-sim-showcase">
        <div class="tl-sim-showcase__hero ${hasMediaGallery ? "" : "tl-sim-showcase__hero--compact"}">
          ${mediaHtml}
          <div class="tl-sim-showcase__content ${hasMediaGallery ? "" : "tl-sim-showcase__content--full"}">
            <div class="tl-sim-badge-row">
              ${previewStatus ? buildClassificacaoBadge(previewStatus) : ""}
              ${buildAvailabilityBadge(imovel.status)}
            </div>
            ${hasMediaGallery ? "" : '<div class="tl-sim-showcase__no-media">Sem foto principal cadastrada</div>'}
            <div class="tl-sim-showcase__summary">
              <h4 class="tl-sim-showcase__title">${escapeHtml(imovel.titulo || "Unidade")}</h4>
              ${addressLine ? `<p class="tl-sim-showcase__address">${escapeHtml(truncateText(addressLine, 120))}</p>` : ""}
              <p class="tl-sim-showcase__description">${escapeHtml(summaryCopy)}</p>
            </div>
            ${facts.length ? `<div class="tl-sim-facts">${facts.map((fact) => `<span class="tl-sim-fact">${escapeHtml(fact)}</span>`).join("")}</div>` : ""}
            ${videosHtml}
          </div>
        </div>
        <div class="tl-sim-showcase__metrics tl-sim-showcase__metrics--primary">${primaryMetrics.map(buildShowcaseMetricMarkup).join("")}</div>
        ${entryOverflowMessage ? `<div class="tl-sim-showcase__ideal-note tl-sim-showcase__ideal-note--danger">${escapeHtml(entryOverflowMessage)}</div>` : ""}
        ${idealGapMessage ? `<div class="tl-sim-showcase__ideal-note tl-sim-showcase__ideal-note--${idealGapTone}">${escapeHtml(idealGapMessage)}</div>` : ""}
        ${negotiatedGapMessage ? `<div class="tl-sim-showcase__ideal-note tl-sim-showcase__ideal-note--danger">${escapeHtml(negotiatedGapMessage)}</div>` : ""}
          ${secondaryMetrics.length ? `
          <details class="tl-sim-advanced tl-sim-advanced--property tl-sim-advanced--locked-open" open data-locked-open="true">
            <summary>Ver prazos e regras da unidade</summary>
            <div class="tl-sim-showcase__metrics tl-sim-showcase__metrics--secondary">
              ${secondaryMetrics.map(buildShowcaseMetricMarkup).join("")}
            </div>
          </details>` : ""}
        ${reservaHtml}
        <div class="tl-sim-showcase__actions">
          <button class="tl-imoveis-btn tl-imoveis-btn--entry ${ajuste ? "" : "tl-imoveis-btn--ghost"}" type="button" data-action="aplicar-entrada" data-id="${escapeHtml(imovel.id)}">Aplicar entrada sugerida</button>
          ${(mapData.embedUrl || mapData.searchUrl) ? '<button class="tl-imoveis-btn tl-imoveis-btn--map" type="button" data-action="abrir-mapa">Ver no mapa</button>' : ""}
          ${suggestion ? `<button class="tl-imoveis-btn tl-imoveis-btn--compare" type="button" data-action="comparar-sugestao" data-id="${escapeHtml(imovel.id)}">${isCompared ? "Comparando" : "Comparar"}</button>` : ""}
        </div>
      </div>`;

    setPropertyStatus(`Em destaque: ${imovel.titulo || "Unidade selecionada"}`);
    updateActionButtons();
  }

  async function applyPreselectedPropertyFromShowroom() {
    const payload = state.preselectedContext || capturePreselectedContext();
    if (!payload?.id) return false;

    try {
      state.imovelSelecionado = normalizePropertyForUi({
        id: String(payload.id),
        titulo: payload.titulo || "Imóvel",
        tipologia: payload.tipologia || payload.tipo_imovel || "",
        cidade: payload.cidade || "",
        bairro: payload.bairro || "",
        valor: parseMoney(payload.valor || 0),
        status: payload.status || "Disponível",
        percentual_conclusao_obra: toNumber(payload.percentual_conclusao_obra ?? 0, 0),
        foto_principal: payload.foto_principal || "",
        reserva_ativa: payload.reserva_ativa || null,
      });

      try {
        const imovelCompleto = await loadPropertyById(state.imovelSelecionado.id);
        if (imovelCompleto?.id) {
          state.imovelSelecionado = imovelCompleto;
        }
      } catch {
        // Mantem dados minimos recebidos do showroom.
      }

      state.fotoAtivaIndice = 0;
      setValue(ids.valorImovel, formatMoney(parseMoney(state.imovelSelecionado.valor || 0)));
      applyPropertyTimelineDefaults();
      renderPropertyPreview();
      renderHeroSummary();

      if (payload.cliente_id) {
        await selectClientById(payload.cliente_id);
      }

      if (payload.simulacao_id) {
        await loadSavedSimulationById(payload.simulacao_id, { silentFeedback: true });
        if (payload.emitir_pdf) {
          setTimeout(() => {
            emitirPdfSimulacaoNaJanelaAtual().catch((error) => {
              renderDirectPdfLoading(messageFromError(error, "Não foi possível gerar o PDF da simulação."));
            });
          }, 250);
          state.preselectedContext = null;
          return true;
        }
        showFeedback(
          "success",
          `Atendimento recuperado para ${firstFilled(payload.cliente_nome, "o cliente selecionado")}. A reserva e a simulação salvas ja estao carregadas.`
        );
      } else if (payload.cliente_id) {
        showFeedback(
          "info",
          `Unidade recebida do showroom e vinculada a ${firstFilled(payload.cliente_nome, "este cliente")}.`
        );
      } else {
        showFeedback("info", "Unidade recebida do showroom. Agora escolha o cliente e a vitrine se adapta automaticamente.");
      }

      state.preselectedContext = null;
      return true;
    } catch {
      state.preselectedContext = null;
      return false;
    }
  }

  function buildFiltersPayload() {
    const faixaPreco = parsePriceRangeFilter(readValue(ids.filtroFaixaPreco));
    const precoMin = faixaPreco.min ?? moneyToNumber(readValue(ids.filtroPrecoMin));
    const precoMax = faixaPreco.max ?? moneyToNumber(readValue(ids.filtroPrecoMax));

    return {
      empreendimento: readValue(ids.filtroEmpreendimento).trim() || null,
      cidade: readValue(ids.filtroCidade).trim() || null,
      bairro: readValue(ids.filtroBairro).trim() || null,
      faixa_preco_min: precoMin !== null && precoMin > 0 ? precoMin : null,
      faixa_preco_max: precoMax !== null && precoMax > 0 ? precoMax : null,
    };
  }

  function buildSimulationPayload() {
    const entrega = resolvePropertyDelivery(state.imovelSelecionado);
    const parceiroSimulacao = getSelectedSimulationPartner();
    const mesesPreEntrega = normalizePreDeliveryMonths(
      readValue(ids.mesesPre),
      entrega.mesesPreEntrega
    );
    const entrada = syncEntryOverflowToOverprice();
    const sobrepreco = parseMoney(readValue(ids.sobrepreco));
    const descontoImovel = normalizePropertyDiscount();
    const parcelaClienteMaxima = normalizeClientInstallment().valor;
    const isCreditur = isCrediturPartner(parceiroSimulacao);
    const parcelaPreObra = isCreditur ? 0 : normalizeCashflowInstallment(ids.preObraValor);
    const parcelaPosObra = isCreditur ? 0 : normalizeCashflowInstallment(ids.posObraValor);
    const parcelaIntermediaria = normalizeMinimumInstallmentField(ids.intermediariaValor);
    const parcelasIntermediarias = collectIntermediaryItems();
    const parcelaAnual = normalizeMinimumInstallmentField(ids.anualValor);
    const parcelaSemestral = normalizeMinimumInstallmentField(ids.semestralValor);
    const parcelaReforco = normalizeMinimumInstallmentField(ids.reforcoValor);
    const qtdIntermediaria = parcelasIntermediarias.length;
    const qtdAnual = parcelaAnual > 0 ? toNumber(readValue(ids.anualQtd), 0) : 0;
    const qtdSemestral = parcelaSemestral > 0 ? toNumber(readValue(ids.semestralQtd), 0) : 0;
    const qtdReforco = parcelaReforco > 0 ? toNumber(readValue(ids.reforcoQtd), 0) : 0;
    const credituGeralAplicado = parceiroSimulacao === PARTNER_CREDITUR_GERAL
      ? getCredituGeralApplied()
      : null;
    syncRecurringDateFields();
    return {
      cliente_id: state.clienteSelecionado?.id || "",
      imovel_id: state.imovelSelecionado?.id || "",
      valor_imovel: parseMoney(state.imovelSelecionado?.valor || readValue(ids.valorImovel)),
      financiamento_caixa: getClientSimulationMoney("financiamento_caixa"),
      parcela_cliente_maxima: parcelaClienteMaxima,
      parcela_financiamento_banco: getClientSimulationMoney("parcela_financiamento_banco"),
      fgts: getClientSimulationMoney("fgts"),
      subsidio: parseMoney(readValue(ids.subsidio)),
      cheque_moradia: parseMoney(readValue(ids.chequeMoradia)),
      entrada,
      usar_entrada_padrao: false,
      sobrepreco,
      desconto_imovel: descontoImovel,
      incentivo_7lm: descontoImovel,
      parceiro_simulacao: parceiroSimulacao,
      meses_pre_entrega: mesesPreEntrega,
      meses_pos_entrega: normalizePostDeliveryMonths(
        readValue(ids.mesesPos),
        getPreferredPostDeliveryMonths(mesesPreEntrega),
        mesesPreEntrega
      ),
      parcela_pre_obra_valor: parcelaPreObra,
      parcela_pos_obra_valor: parcelaPosObra,
      parcelas_creditur_intervalos: isCreditur ? buildCrediturPayloadIntervals() : [],
      creditu_geral: credituGeralAplicado,
      parcela_intermediaria_valor: parcelaIntermediaria,
      parcelas_intermediarias_quantidade: qtdIntermediaria,
      parcelas_intermediarias_datas: parcelasIntermediarias.map((item) => item.data).filter(Boolean),
      parcelas_intermediarias_personalizadas: parcelasIntermediarias,
      parcela_anual_valor: parcelaAnual,
      parcelas_anuais_quantidade: qtdAnual,
      parcela_anual_primeira_data: readValue(ids.anualPrimeiraData) || null,
      parcela_semestral_valor: parcelaSemestral,
      parcelas_semestrais_quantidade: qtdSemestral,
      parcela_semestral_primeira_data: readValue(ids.semestralPrimeiraData) || null,
      parcela_reforco_valor: parcelaReforco,
      parcelas_reforco_quantidade: qtdReforco,
      observacoes_comerciais: readValue(ids.observacoes).trim() || null,
      filtros: buildFiltersPayload(),
    };
  }

  function ensureSelections(requireProperty = false) {
    if (!state.clienteSelecionado) {
      showFeedback("warning", "Selecione um cliente para continuar.");
      return false;
    }

    if (requireProperty && !state.imovelSelecionado) {
      showFeedback("warning", "Escolha uma unidade na vitrine para continuar.");
      return false;
    }

    return true;
  }

  function renderSummaryFromResult(resultado, { autoOpenNotifications = false } = {}) {
    const resumo = resultado?.resumo_operacao || {};
    if (normalizeSimulationPartner(resumo.parceiro_simulacao) === PARTNER_CREDITUR_GERAL && resumo.creditu_geral) {
      const credituGeralResumo = {
        ...resumo.creditu_geral,
        aplicado: true,
        modalidade: PARTNER_CREDITUR_GERAL,
      };
      state.credituGeral = isCredituGeralPdfResult(credituGeralResumo) ? credituGeralResumo : null;
    }
    const imovel = normalizePropertyForUi({ ...(resultado?.imovel || {}), ...(state.imovelSelecionado || {}) });
    const valorFechamento = resolveValorFechamento(resumo);
    const valorEntregaChaves = resolveValorEntregaChaves(resumo);
    const valorGarantidoPlanejado = resolveGuaranteedValue(
      {
        valor_garantido_planejado: firstFilled(
          resumo.valor_garantido_planejado,
          resumo.valor_garantido,
          imovel.valor_garantido_planejado,
          imovel.valor_garantido
        ),
        valor_imovel: firstFilled(resumo.valor_imovel, imovel.valor),
        percentual_fechamento_minimo: firstFilled(
          resumo.percentual_fechamento_minimo,
          imovel.percentual_fechamento_minimo,
          0.7
        ),
      },
      firstFilled(imovel.valor_garantido_planejado, imovel.valor_garantido)
    );
    const valorGarantidoReal = parseMoney(firstFilled(resumo.valor_garantido_real, valorFechamento, 0));
    const valorGarantidoPreObraPlanejado = resolvePlannedDeliveryCaptureValue(
      {
        valor_garantido_pre_obra_planejado: firstFilled(
          resumo.valor_garantido_pre_obra_planejado,
          imovel.valor_garantido_pre_obra_planejado
        ),
        percentual_captacao_ate_entrega: firstFilled(
          resumo.percentual_captacao_ate_entrega,
          imovel.percentual_captacao_ate_entrega
        ),
        valor_imovel: firstFilled(resumo.valor_imovel, imovel.valor),
      },
      imovel.valor_garantido_pre_obra_planejado
    );
    const valorGarantidoPreObraReal = parseMoney(firstFilled(
      resumo.valor_garantido_pre_obra_real,
      resumo.valor_projetado_entrega,
      valorEntregaChaves,
      0
    ));
    const capacidadeMensal = parseMoney(resumo.limite_comprometimento || 0);
    const parcelaOperacao = parseMoney(resumo.parcela_referência || resumo.parcela_maxima_segura || 0);
    const entradaAtual = parseMoney(resumo.entrada || 0);
    const proSolutoTotal = parseMoney(resumo.pro_soluto_total || 0);
    const parcelaIdeal = parseMoney(resumo.parcela_7lm_pos_ideal || resumo.parcela_7lm_pos || resumo.mensal_pos || 0);
    const operacao = resolveOperationValues(resumo, imovel);
    const hasCommercialAdjustment = operacao.sobrepreco > 0.01 || operacao.desconto > 0.01;
    const crediturAtivo = Boolean(resumo.creditur_ativo || operacao.crediturRetencao > 0.01);
    const totalPagoCliente = resolveTotalPaidByClient(resumo, operacao);
    const saldoClienteImovel = resolvePropertyPaymentBalance(operacao, totalPagoCliente);
    const gapGarantido = Math.max(valorGarantidoPlanejado - valorGarantidoReal, 0);
    const gapEntrega = Math.max(valorGarantidoPreObraPlanejado - valorGarantidoPreObraReal, 0);
    const entregaProjetada = firstFilled(resumo.percentual_projetado_entrega, 0);
    const statusExibicao = resolveUserFacingStatus({ resumo });
    syncNegotiatedValueField(resumo);
    const cards = [
      {
        label: "Valor total do imóvel",
        value: formatMoney(operacao.valorImovel),
        help: "valor cadastrado da unidade",
      },
      {
        label: "Valor total pago pelo cliente",
        value: formatMoney(totalPagoCliente),
        help: crediturAtivo ? "valor considerado na modalidade Creditú" : "valor total considerado",
      },
      {
        label: saldoClienteImovel.label,
        value: saldoClienteImovel.value,
        help: saldoClienteImovel.help,
      },
      {
        label: (crediturAtivo || hasCommercialAdjustment) ? "Valor negociado" : "Valor da unidade",
        value: formatMoney((crediturAtivo || hasCommercialAdjustment) ? operacao.valorNegociado : operacao.valorImovel),
        help: crediturAtivo
          ? "base da proposta Creditú"
          : (operacao.desconto > 0.01 ? `incentivo 7LM de ${formatMoney(operacao.desconto)}` : "base da operação"),
      },
      {
        label: "Parcela da operação",
        value: formatMoney(parcelaOperacao),
        help: "maior valor do fluxo",
      },
      {
        label: "Entrada agora",
        value: formatMoney(entradaAtual),
        help: "valor usado no fechamento",
      },
      {
        label: "Pro-soluto 7LM",
        value: formatMoney(proSolutoTotal),
        help: "saldo direto com a 7LM",
      },
      {
        label: "Parcela ideal",
        value: formatMoney(parcelaIdeal),
        help: "referência para quitar no prazo",
      },
      gapGarantido > 0.01
        ? {
          label: "Falta para a meta",
          value: formatMoney(gapGarantido),
          help: `meta da unidade em ${formatMoney(valorGarantidoPlanejado)}`,
        }
        : {
          label: "Meta da unidade",
          value: "Encaixada",
          help: `garantido atual em ${formatMoney(valorGarantidoReal)}`,
        },
      gapEntrega > 0.01
        ? {
          label: "Falta até as chaves",
          value: formatMoney(gapEntrega),
          help: `entrega projetada em ${formatPercent(entregaProjetada)}`,
        }
        : {
          label: "Até as chaves",
          value: "Encaixado",
          help: `entrega projetada em ${formatPercent(entregaProjetada)}`,
        },
    ];

    const financeTone = resolveFinancialTone({ resumo, status: statusExibicao });
    const statusComercialExibicao = displayStatusFromTone(financeTone, statusExibicao);
    setStatusBadge(statusComercialExibicao);
    applyFinancialTone(financeTone);

    if (el.resumoKpis) {
      el.resumoKpis.innerHTML = cards
        .map(({ label, value, help }) => `
          <article class="tl-sim-kpi tl-sim-kpi--${financeTone}">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <small>${escapeHtml(help || "")}</small>
          </article>`)
        .join("");
    }

    syncSimulationNotifications(resultado, { autoOpen: autoOpenNotifications });
    renderCredituGeralResumo();

    renderDemonstrativo(resultado?.demonstrativo || []);
  }

  function normalizeParcelaTipo(parcela) {
    return String(parcela?.tipo || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", " ");
  }

  function isEntradaParcela(parcela) {
    const tipo = normalizeParcelaTipo(parcela);
    return tipo.includes("entrada") || tipo.includes("sinal");
  }

  function getEntradaDemonstrativo(parcelas, fallback = 0) {
    if (!Array.isArray(parcelas)) return parseMoney(fallback || 0);
    const total = parcelas
      .filter(isEntradaParcela)
      .reduce((sum, parcela) => sum + parseMoney(parcela.valor_total_cliente ?? parcela.valor ?? 0), 0);
    return total > 0 ? total : parseMoney(fallback || 0);
  }

  function buildParcelasTimeline(parcelas, options = {}) {
    if (!Array.isArray(parcelas)) return [];
    const buckets = new Map();
    const entradaInicial = getEntradaDemonstrativo(parcelas, options.entradaInicial || 0);

    parcelas.forEach((parcela, index) => {
      if (!options.incluirEntrada && isEntradaParcela(parcela)) return;

      const data = parseCalendarDate(parcela.vencimento);
      const dataValida = data && !Number.isNaN(data.getTime());
      const key = dataValida
        ? `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
        : `sem-data-${index}`;
      const item = buckets.get(key) || {
        key,
        data: dataValida ? new Date(data.getFullYear(), data.getMonth(), 1) : null,
        label: dataValida ? formatMonthLabel(data) : "Sem data",
        totalCliente: 0,
        parcelaBanco: 0,
        valor7lm: 0,
        parcelaAcumulada: 0,
        proSolutoPago: 0,
        proSolutoRestante: 0,
        percentualRenda: 0,
        percentualObra: 0,
        percentualRecebimento: 0,
        recebidoAcumulado: 0,
        quantidade: 0,
        tipos: [],
        fases: [],
      };

      item.totalCliente += parseMoney(parcela.valor_total_cliente ?? parcela.valor ?? 0);
      item.parcelaBanco += parseMoney(parcela.parcela_banco_obra || parcela.parcela_banco || 0);
      item.valor7lm += parseMoney(parcela.valor_7lm ?? parcela.valor ?? 0);
      item.percentualRenda = Math.max(item.percentualRenda, percentToFactor(parcela.percentual_renda || 0));
      item.percentualObra = Math.max(item.percentualObra, percentToFactor(parcela.percentual_conclusao_obra || 0));
      item.quantidade += 1;
      const tipoNormalizado = labelRelatório(parcela.tipo || "mensal");
      if (tipoNormalizado && !item.tipos.includes(tipoNormalizado)) {
        item.tipos.push(tipoNormalizado);
      }
      const faseNormalizada = formatParcelaPhaseLabel(parcela.fase);
      if (faseNormalizada && !item.fases.includes(faseNormalizada)) {
        item.fases.push(faseNormalizada);
      }
      buckets.set(key, item);
    });

    const timeline = Array.from(buckets.values()).sort((left, right) => {
      if (left.data && right.data) return left.data.getTime() - right.data.getTime();
      if (left.data) return -1;
      if (right.data) return 1;
      return left.key.localeCompare(right.key);
    });

    const totalParcelas = timeline.reduce((sum, item) => sum + item.totalCliente, 0);
    const baseProSoluto = Math.max(
      parseMoney(options.proSolutoBase || 0),
      timeline.reduce((sum, item) => sum + item.valor7lm, 0),
      0,
    );
    const baseRecebimento = parseMoney(options.baseRecebimento || 0) > 0
      ? parseMoney(options.baseRecebimento || 0)
      : Math.max(entradaInicial + totalParcelas, 1);
    let recebidoAcumulado = entradaInicial;
    let proSolutoPago = 0;

    timeline.forEach((item) => {
      recebidoAcumulado += item.totalCliente;
      proSolutoPago += item.valor7lm;
      item.recebidoAcumulado = recebidoAcumulado;
      item.proSolutoPago = proSolutoPago;
      item.parcelaAcumulada = proSolutoPago;
      item.proSolutoRestante = Math.max(baseProSoluto - proSolutoPago, 0);
      item.percentualRecebimento = recebidoAcumulado / baseRecebimento;
    });

    if (options.pararNaQuitacaoProSoluto && baseProSoluto > 0) {
      const indiceQuitacao = timeline.findIndex((item) => item.proSolutoRestante <= 0.01 || item.parcelaAcumulada >= baseProSoluto - 0.01);
      if (indiceQuitacao >= 0) {
        const visibleTimeline = timeline.slice(0, indiceQuitacao + 1);
        annotateTimelineParcelLabels(visibleTimeline);
        return visibleTimeline;
      }
    }

    annotateTimelineParcelLabels(timeline);
    return timeline;
  }

  function annotateTimelineParcelLabels(timeline) {
    if (!Array.isArray(timeline) || !timeline.length) return;
    const totalParcelasFluxo = timeline.reduce((sum, item) => sum + Math.max(item.quantidade, 1), 0);
    let parcelaCursor = 0;
    timeline.forEach((item) => {
      const parcelaInicial = parcelaCursor + 1;
      const parcelaFinal = parcelaInicial + Math.max(item.quantidade - 1, 0);
      parcelaCursor = parcelaFinal;
      item.parcelaInicial = parcelaInicial;
      item.parcelaFinal = parcelaFinal;
      item.totalParcelasFluxo = totalParcelasFluxo;
    });
  }

  function getTimelinePhaseLabel(item) {
    const fases = Array.isArray(item?.fases) ? item.fases.filter(Boolean) : [];
    if (!fases.length) return "Fluxo mensal";
    if (fases.length === 1) return fases[0];
    if (fases.includes("Pré-obra") && fases.includes("Pós-obra")) return "Transição pré/pós-obra";
    return fases.join(" • ");
  }

  function buildParcelasFocusHtml(item) {
    if (!item) return "";
    const parcelaLabel = getTimelineParcelLabel(item);
    const movimentos = item.quantidade > 1 ? `${item.quantidade} lançamentos no mês` : "1 lançamento no mês";
    const tipos = item.tipos?.length ? item.tipos.join(" • ") : "Fluxo mensal";
    const fase = getTimelinePhaseLabel(item);
    const folgaCapacidade = parseMoney(item.capacidadeCliente || 0) - parseMoney(item.totalCliente || 0);
    const folgaLabel = folgaCapacidade >= 0 ? "Folga na capacidade" : "Excesso sobre capacidade";
    return `
      <article class="tl-sim-chart__focus-main">
        <span>Mês em foco</span>
        <strong>${escapeHtml(item.label)}</strong>
        <small>${escapeHtml(`${parcelaLabel} • ${fase} • ${movimentos} • ${tipos}`)}</small>
      </article>
      <article>
        <span>Capacidade do cliente</span>
        <strong>${escapeHtml(formatMoney(item.capacidadeCliente || 0))}</strong>
        <small>limite mensal seguro para a operação</small>
      </article>
      <article>
        <span>Total do cliente</span>
        <strong>${escapeHtml(formatMoney(item.totalCliente))}</strong>
        <small>parcela mensal consolidada</small>
      </article>
      <article>
        <span>Banco obra</span>
        <strong>${escapeHtml(formatMoney(item.parcelaBanco))}</strong>
        <small>parcela vinculada ao banco</small>
      </article>
      <article>
        <span>Parcela 7LM</span>
        <strong>${escapeHtml(formatMoney(item.valor7lm))}</strong>
        <small>${escapeHtml(formatMoney(Math.max(item.totalCliente - item.parcelaBanco, 0)))} no comercial</small>
      </article>
      <article>
        <span>${escapeHtml(folgaLabel)}</span>
        <strong>${escapeHtml(formatMoney(Math.abs(folgaCapacidade)))}</strong>
        <small>capacidade do cliente menos total do mês</small>
      </article>`;
  }

  function getTimelineParcelLabel(item) {
    const total = toNumber(item?.totalParcelasFluxo || 0, 0);
    const start = toNumber(item?.parcelaInicial || 0, 0);
    const end = toNumber(item?.parcelaFinal || start, start);
    if (!start || !total) return item?.quantidade > 1 ? `${item.quantidade} parcelas` : "Parcela";
    if (end > start) return `Parcelas ${start}-${end} de ${total}`;
    return `Parcela ${start} de ${total}`;
  }

  function buildParcelasTooltipHtml(item) {
    if (!item) return "";
    const phaseLabel = getTimelinePhaseLabel(item);
    const folgaCapacidade = parseMoney(item.capacidadeCliente || 0) - parseMoney(item.totalCliente || 0);
    const folgaLabel = folgaCapacidade >= 0 ? "Folga" : "Excesso";
    return `
      <div class="tl-sim-chart__tooltip-head">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(getTimelineParcelLabel(item))}</span>
      </div>
      <div class="tl-sim-chart__tooltip-grid">
        <span>Fase</span><strong>${escapeHtml(phaseLabel)}</strong>
        <span>Capacidade do cliente</span><strong>${escapeHtml(formatMoney(item.capacidadeCliente || 0))}</strong>
        <span>Parcela 7LM</span><strong>${escapeHtml(formatMoney(item.valor7lm))}</strong>
        <span>${escapeHtml(folgaLabel)}</span><strong>${escapeHtml(formatMoney(Math.abs(folgaCapacidade)))}</strong>
        <span>% renda</span><strong>${escapeHtml(formatPercent(item.percentualRenda))}</strong>
        <span>% obra</span><strong>${escapeHtml(formatPercent(item.percentualObra))}</strong>
        <span>% recebido</span><strong>${escapeHtml(formatPercent(item.percentualRecebimento))}</strong>
      </div>`;
  }

  function buildTimelineTickIndexes(timeline, xFor) {
    if (!Array.isArray(timeline) || !timeline.length) return [];
    if (timeline.length === 1) return [0];

    const desiredTicks = 6;
    const step = Math.max(1, Math.ceil((timeline.length - 1) / (desiredTicks - 1)));
    const indexes = [0];

    for (let index = step; index < timeline.length - 1; index += step) {
      indexes.push(index);
    }
    indexes.push(timeline.length - 1);

    const minGapPx = 110;
    const filtered = [];
    indexes.forEach((index) => {
      if (!filtered.length) {
        filtered.push(index);
        return;
      }

      const previousIndex = filtered[filtered.length - 1];
      if ((xFor(index) - xFor(previousIndex)) < minGapPx) {
        if (index === timeline.length - 1) {
          filtered[filtered.length - 1] = index;
        }
        return;
      }

      filtered.push(index);
    });

    if (filtered.length >= 2) {
      const lastIndex = filtered[filtered.length - 1];
      const previousIndex = filtered[filtered.length - 2];
      if (
        lastIndex === timeline.length - 1 &&
        (xFor(lastIndex) - xFor(previousIndex)) < minGapPx
      ) {
        filtered.splice(filtered.length - 2, 1);
      }
    }

    if (filtered[filtered.length - 1] !== timeline.length - 1) {
      filtered.push(timeline.length - 1);
    }

    return [...new Set(filtered)];
  }

  function bindParcelasGraficoInteractions(timeline, geometry, defaultIndex = 0) {
    if (!el.parcelasGrafico || !timeline.length) return;

    const frame = el.parcelasGrafico.querySelector(".tl-sim-chart__frame");
    const tooltip = el.parcelasGrafico.querySelector(".tl-sim-chart__tooltip");
    const focus = el.parcelasGrafico.querySelector(".tl-sim-chart__focus");
    const focusBand = el.parcelasGrafico.querySelector(".tl-sim-chart__focus-band");
    const focusLine = el.parcelasGrafico.querySelector(".tl-sim-chart__focus-line");
    const hotspots = Array.from(el.parcelasGrafico.querySelectorAll(".tl-sim-chart__hotspot"));
    const pointCapacidade = el.parcelasGrafico.querySelector(".tl-sim-chart__focus-point.is-capacidade");
    const point7lm = el.parcelasGrafico.querySelector(".tl-sim-chart__focus-point.is-7lm");

    if (!frame || !tooltip || !focusLine || !hotspots.length) return;

    const safeIndex = clamp(defaultIndex, 0, timeline.length - 1);
    let activeIndex = safeIndex;

    function positionTooltip(x, y) {
      const frameRect = frame.getBoundingClientRect();
      const xPx = (x / geometry.width) * frameRect.width;
      const yPx = (y / geometry.height) * frameRect.height;
      const tooltipRect = tooltip.getBoundingClientRect();
      let left = xPx - (tooltipRect.width / 2);
      left = Math.max(12, Math.min(left, frameRect.width - tooltipRect.width - 12));
      let top = yPx - tooltipRect.height - 18;
      if (top < 12) top = yPx + 18;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function setActive(index, showTooltip = false) {
      activeIndex = clamp(index, 0, timeline.length - 1);
      const item = timeline[activeIndex];
      const x = geometry.xFor(activeIndex);
      const yAnchor = Math.min(
        geometry.yValor(item.capacidadeCliente || 0),
        geometry.yValor(item.valor7lm),
      );

      if (focus) focus.innerHTML = buildParcelasFocusHtml(item);
      focusLine.setAttribute("x1", x.toFixed(2));
      focusLine.setAttribute("x2", x.toFixed(2));
      const hotspot = hotspots[activeIndex];
      if (focusBand && hotspot) {
        const bandX = Number.parseFloat(hotspot.getAttribute("x") || "0");
        const bandWidth = Number.parseFloat(hotspot.getAttribute("width") || "0");
        focusBand.setAttribute("x", bandX.toFixed(2));
        focusBand.setAttribute("width", bandWidth.toFixed(2));
      }

      if (pointCapacidade) {
        pointCapacidade.setAttribute("cx", x.toFixed(2));
        pointCapacidade.setAttribute("cy", geometry.yValor(item.capacidadeCliente || 0).toFixed(2));
      }
      if (point7lm) {
        point7lm.setAttribute("cx", x.toFixed(2));
        point7lm.setAttribute("cy", geometry.yValor(item.valor7lm).toFixed(2));
      }

      hotspots.forEach((hotspot, hotspotIndex) => {
        hotspot.classList.toggle("is-active", hotspotIndex === activeIndex);
      });

      if (showTooltip) {
        tooltip.hidden = false;
        tooltip.innerHTML = buildParcelasTooltipHtml(item);
        requestAnimationFrame(() => positionTooltip(x, yAnchor));
      } else {
        tooltip.hidden = true;
      }
    }

    hotspots.forEach((hotspot, index) => {
      hotspot.addEventListener("mouseenter", () => setActive(index, true));
      hotspot.addEventListener("focus", () => setActive(index, true));
      hotspot.addEventListener("click", () => setActive(index, true));
    });

    frame.addEventListener("mouseleave", () => {
      tooltip.hidden = true;
      setActive(activeIndex, false);
    });

    setActive(safeIndex, false);
  }

  function renderParcelasGrafico(parcelas) {
    if (!el.parcelasGrafico) return;

    const resumo = state.simulacaoAtual?.resumo_operacao || {};
    const capacidadeCliente = parseMoney(resumo.limite_comprometimento || resumo.parcela_maxima_segura || 0);
    const entradaSeparada = getEntradaDemonstrativo(parcelas, resumo.entrada || 0);
    const proSolutoInicial = Math.max(
      parseMoney(resumo.pro_soluto_total || 0),
      (Array.isArray(parcelas) ? parcelas : [])
        .filter((parcela) => !isEntradaParcela(parcela))
        .reduce((sum, parcela) => sum + parseMoney(parcela.valor_7lm ?? parcela.valor ?? 0), 0),
      0,
    );
    const timeline = buildParcelasTimeline(parcelas, {
      entradaInicial: entradaSeparada,
      proSolutoBase: proSolutoInicial,
    });
    timeline.forEach((item) => {
      item.capacidadeCliente = capacidadeCliente;
    });
    if (!timeline.length) {
      if (el.parcelasResumo) {
        el.parcelasResumo.innerHTML = entradaSeparada > 0
          ? `<article><span>Entrada separada</span><strong>${escapeHtml(formatMoney(entradaSeparada))}</strong></article>`
          : "";
      }
      el.parcelasGrafico.innerHTML = `
        <div class="tl-sim-chart__empty">
          <strong>Aguardando simulação</strong>
          <span>Calcule uma proposta com parcelas mensais para gerar o fluxo financeiro.</span>
        </div>`;
      return;
    }

    const totalParcelas = timeline.reduce((sum, item) => sum + item.totalCliente, 0);
    const totalPagoFluxo = roundMoneyNumber(entradaSeparada + totalParcelas);
    const total7lm = timeline.reduce((sum, item) => sum + item.valor7lm, 0);
    const maiorParcela = Math.max(...timeline.map((item) => item.totalCliente), 0);
    const maior7lm = Math.max(...timeline.map((item) => item.valor7lm), 0);
    const ultimoMes = timeline[timeline.length - 1];
    const mesPicoParcela = timeline.find((item) => item.totalCliente === maiorParcela) || timeline[0];
    const mesPico7lm = timeline.find((item) => item.valor7lm === maior7lm) || mesPicoParcela;
    const defaultFocusIndex = Math.max(0, timeline.indexOf(mesPico7lm));

    if (el.parcelasResumo) {
      const resumoCards = [
        {
          label: "Valor total pago pelo cliente",
          value: formatMoney(totalPagoFluxo),
          help: "entrada + parcelas do fluxo",
        },
        {
          label: "Entrada",
          value: formatMoney(entradaSeparada),
          help: "valor fora do fluxo mensal",
        },
        {
          label: "Pro-soluto",
          value: formatMoney(proSolutoInicial),
          help: "saldo a distribuir no fluxo",
        },
        {
          label: "Parcela pós-obra",
          value: formatMoney(parseMoney(resumo.parcela_7lm_pos || resumo.mensal_pos || 0)),
          help: "valor usado no fluxo",
        },
        {
          label: "Maior mensal",
          value: formatMoney(maiorParcela),
          help: `pico em ${mesPicoParcela.label}`,
        },
        {
          label: "Quitação prevista",
          value: ultimoMes?.label || "-",
          help: "fim previsto do fluxo",
        },
      ];
      el.parcelasResumo.innerHTML = resumoCards
        .map(({ label, value, help }) => `
          <article>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <small>${escapeHtml(help || "")}</small>
          </article>`)
        .join("");
    }

    const width = 1120;
    const height = 430;
    const left = 104;
    const right = 1046;
    const top = 58;
    const bottom = 326;
    const plotWidth = right - left;
    const plotHeight = bottom - top;
    const maxValor = Math.max(maior7lm, capacidadeCliente, 1) * 1.18;
    const xFor = (index) => timeline.length === 1 ? left + (plotWidth / 2) : left + (plotWidth * index / (timeline.length - 1));
    const yValor = (value) => bottom - ((Math.max(0, value) / maxValor) * plotHeight);
    const smoothPath = (key, scale = yValor) => {
      const coords = timeline.map((item, index) => [xFor(index), scale(item[key])]);
      if (!coords.length) return "";
      if (coords.length === 1) return `M ${coords[0][0].toFixed(2)} ${coords[0][1].toFixed(2)}`;
      let path = `M ${coords[0][0].toFixed(2)} ${coords[0][1].toFixed(2)}`;
      for (let index = 0; index < coords.length - 1; index += 1) {
        const [x1, y1] = coords[index];
        const [x2, y2] = coords[index + 1];
        const controlOffset = (x2 - x1) * 0.34;
        path += ` C ${(x1 + controlOffset).toFixed(2)} ${y1.toFixed(2)}, ${(x2 - controlOffset).toFixed(2)} ${y2.toFixed(2)}, ${x2.toFixed(2)} ${y2.toFixed(2)}`;
      }
      return path;
    };
    const tickIndexes = buildTimelineTickIndexes(timeline, xFor);
    const grid = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      const y = bottom - (ratio * plotHeight);
      const value = maxValor * ratio;
      return `
        <line x1="${left}" y1="${y.toFixed(2)}" x2="${right}" y2="${y.toFixed(2)}" class="tl-sim-chart__grid-line" />
        <text x="${left - 12}" y="${(y + 4).toFixed(2)}" class="tl-sim-chart__axis-label" text-anchor="end">${escapeHtml(formatMoney(value))}</text>`;
    }).join("");
    const labels = tickIndexes.map((index) => {
      const anchor = index === 0 ? "start" : index === timeline.length - 1 ? "end" : "middle";
      return `
      <text x="${xFor(index).toFixed(2)}" y="372" class="tl-sim-chart__axis-label is-bottom" text-anchor="${anchor}">${escapeHtml(timeline[index].label)}</text>
    `;
    }).join("");
    const hotzones = timeline.map((item, index) => {
      const currentX = xFor(index);
      const prevX = index > 0 ? xFor(index - 1) : left;
      const nextX = index < timeline.length - 1 ? xFor(index + 1) : right;
      const startX = index === 0 ? left : ((prevX + currentX) / 2);
      const endX = index === timeline.length - 1 ? right : ((currentX + nextX) / 2);
      return `
        <rect
          x="${startX.toFixed(2)}"
          y="${top}"
          width="${Math.max(24, endX - startX).toFixed(2)}"
          height="${plotHeight}"
          class="tl-sim-chart__hotspot"
          tabindex="0"
          role="button"
          aria-label="${escapeHtml(`Ver detalhes de ${item.label}`)}"
          data-chart-index="${index}"
        ></rect>`;
    }).join("");
    el.parcelasGrafico.innerHTML = `
      <div class="tl-sim-chart__legend" aria-label="Legenda do gráfico">
        <span><i class="is-capacidade"></i>Capacidade do cliente</span>
        <span><i class="is-7lm"></i>Parcela 7LM</span>
      </div>
      <div class="tl-sim-chart__frame">
        <div class="tl-sim-chart__tooltip" hidden></div>
        <svg class="tl-sim-chart__svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico mensal da capacidade do cliente e da parcela 7LM">
          <rect x="0" y="0" width="${width}" height="${height}" rx="24" class="tl-sim-chart__bg" />
          ${grid}
          <text x="${left}" y="32" class="tl-sim-chart__axis-title">Parcelas mensais</text>
          <rect x="${left}" y="${top}" width="${Math.max(24, right - left)}" height="${plotHeight}" rx="22" class="tl-sim-chart__focus-band"></rect>
          <path d="${smoothPath("capacidadeCliente")}" class="tl-sim-chart__line is-capacidade" />
          <path d="${smoothPath("valor7lm")}" class="tl-sim-chart__line is-7lm" />
          <line x1="${xFor(defaultFocusIndex).toFixed(2)}" y1="${top}" x2="${xFor(defaultFocusIndex).toFixed(2)}" y2="${bottom}" class="tl-sim-chart__focus-line" />
          <circle class="tl-sim-chart__focus-point is-capacidade" r="6.5"></circle>
          <circle class="tl-sim-chart__focus-point is-7lm" r="6.5"></circle>
          ${labels}
          ${hotzones}
        </svg>
      </div>
      <p class="tl-sim-chart__note">O gráfico compara a capacidade mensal do cliente com a parcela 7LM.</p>
    `;

    bindParcelasGraficoInteractions(
      timeline,
      { width, xFor, yValor },
      defaultFocusIndex,
    );
  }

  function renderDemonstrativo(parcelas) {
    if (!el.demonstrativoBody) return;
    renderParcelasGrafico(parcelas);

    if (!Array.isArray(parcelas) || !parcelas.length) {
      el.demonstrativoBody.innerHTML = '<tr><td colspan="6" class="tl-sim-empty">Nenhuma parcela gerada para o cenário atual.</td></tr>';
      return;
    }

    el.demonstrativoBody.innerHTML = parcelas
      .map((parcela) => {
        const fase = String(parcela.fase || "").replaceAll("_", " ");
        const tipo = String(parcela.tipo || "").replaceAll("_", " ");
        const vencimento = parcela.vencimento ? formatDateLabel(parcela.vencimento) : "-";
        const valor7lm = parseMoney(parcela.valor_7lm ?? parcela.valor ?? 0);
        return `
          <tr>
            <td>${escapeHtml(fase)}</td>
            <td>${escapeHtml(tipo)}</td>
            <td>${escapeHtml(String(parcela.parcela || "-"))}</td>
            <td>${escapeHtml(vencimento)}</td>
            <td>${escapeHtml(formatMoney(valor7lm))}</td>
            <td>${escapeHtml(formatPercent(parcela.percentual_conclusao_obra || 0))}</td>
          </tr>`;
      })
      .join("");
  }

  function valorRelatório(value, fallback = "-") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function tituloRelatórioOperacao() {
    const status = normalizeStatus(state.imovelSelecionado?.status);
    if (status === "vendido") return "Relatório de venda";
    if (status === "reservado") return "Relatório de reserva";
    return "Relatório de simulação";
  }

  function labelRelatório(value) {
    return String(value || "-").replaceAll("_", " ");
  }

  function normalizeParcelaPhase(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\s+/g, " ");
  }

  function formatParcelaPhaseLabel(value) {
    const phase = normalizeParcelaPhase(value);
    if (!phase) return "Fluxo mensal";
    if (phase.includes("pre entrega")) return "Pré-obra";
    if (phase.includes("pos entrega")) return "Pós-obra";
    if (phase.includes("entrega")) return "Entrega";
    return labelRelatório(value);
  }

  function renderCamposRelatório(items, options = {}) {
    const className = options.className ? ` ${options.className}` : "";
    return items
      .map(([label, value]) => `
        <article class="report-metric${className}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(valorRelatório(value))}</strong>
        </article>`)
      .join("");
  }

  function compactReportLabel(value) {
    const text = labelRelatório(value).trim();
    if (!text || text === "-") return "-";
    return text
      .replace(/^pre entrega$/i, "Pré-obra")
      .replace(/^pos entrega$/i, "Pós-chave")
      .replace(/^entrada sinal$/i, "Sinal")
      .replace(/^mensal pre$/i, "Mensal pré")
      .replace(/^mensal pos$/i, "Mensal pós");
  }

  function renderAlertasRelatório(resumo) {
    const itens = [
      ...(Array.isArray(resumo.bloqueios) ? resumo.bloqueios.map((item) => ["Bloqueio", item]) : []),
      ...(Array.isArray(resumo.atenções) ? resumo.atenções.map((item) => ["Atenção", item]) : []),
      ...(Array.isArray(resumo.sugestões) ? resumo.sugestões.map((item) => ["Sugestão", item]) : []),
    ];

    if (!itens.length) {
      return '<p class="report-note">Cenário calculado sem alertas relevantes.</p>';
    }

    return itens.map(([tipo, texto]) => `<p class="report-note"><strong>${escapeHtml(tipo)}:</strong> ${escapeHtml(texto)}</p>`).join("");
  }

  function renderParcelasRelatório(parcelas) {
    if (!Array.isArray(parcelas) || !parcelas.length) {
      return '<tr><td colspan="6">Nenhuma parcela gerada para este cenario.</td></tr>';
    }

    return parcelas
      .map((parcela) => {
        const vencimento = parcela.vencimento ? formatDateLabel(parcela.vencimento) : "-";
        const valor7lm = parseMoney(parcela.valor_7lm ?? parcela.valor ?? 0);
        return `
          <tr>
            <td>${escapeHtml(compactReportLabel(parcela.fase))}</td>
            <td>${escapeHtml(compactReportLabel(parcela.tipo))}</td>
            <td>${escapeHtml(String(parcela.parcela || "-"))}</td>
            <td>${escapeHtml(vencimento)}</td>
            <td>${escapeHtml(formatMoney(valor7lm))}</td>
            <td>${escapeHtml(formatPercent(parcela.percentual_conclusao_obra || 0))}</td>
          </tr>`;
      })
      .join("");
  }

  function joinReportParts(parts, fallback = "Não informado") {
    const value = (Array.isArray(parts) ? parts : [])
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .join(", ");
    return value || fallback;
  }

  function enderecoClienteRelatório(cliente) {
    return firstFilled(
      cliente.endereco_formatado,
      cliente.endereco,
      cliente["endereço"],
      joinReportParts([
        cliente.logradouro,
        cliente.numero,
        cliente.complemento,
        cliente.bairro,
        cliente.cidade,
        cliente.estado,
        cliente.cep,
      ]),
    );
  }

  function bairroMunicipioCepRelatório(cliente) {
    return joinReportParts([cliente.bairro, cliente.cidade, cliente.estado, cliente.cep]);
  }

  function enderecoImovelRelatório(imovel) {
    return firstFilled(
      imovel.endereco_formatado,
      imovel.endereco,
      imovel["endereço"],
      joinReportParts([
        imovel.logradouro,
        imovel.numero,
        imovel.complemento,
        imovel.bairro,
        imovel.cidade,
        imovel.estado,
        imovel.cep,
      ]),
    );
  }

  function renderLegalRows(rows) {
    return rows
      .map(([label, value]) => `
        <tr>
          <th>${escapeHtml(label)}</th>
          <td>${escapeHtml(valorRelatório(value))}</td>
        </tr>`)
      .join("");
  }

  function parcelaVencimentoMaisAntigo(parcelas, predicate) {
    const datas = (Array.isArray(parcelas) ? parcelas : [])
      .filter(predicate)
      .map((parcela) => parseCalendarDate(parcela.vencimento))
      .filter((data) => data instanceof Date && !Number.isNaN(data.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    return datas.length ? formatDateLabel(datas[0]) : "-";
  }

  function somaParcelasRelatório(parcelas, predicate, key = "valor_7lm") {
    return (Array.isArray(parcelas) ? parcelas : [])
      .filter(predicate)
      .reduce((sum, parcela) => sum + parseMoney(parcela[key] ?? parcela.valor ?? 0), 0);
  }

  function contarParcelasRelatório(parcelas, predicate) {
    return (Array.isArray(parcelas) ? parcelas : []).filter(predicate).length;
  }

  function porcentagemPrecoRelatório(valor, total) {
    const base = parseMoney(total || 0);
    if (base <= 0) return "0,00%";
    return formatPercent(parseMoney(valor || 0) / base);
  }

  function isCrediturReport(resumo = {}) {
    const parceiro = String(resumo.parceiro_simulacao || "").toLowerCase();
    return Boolean(resumo.creditur_ativo) || parceiro.includes("creditur") || parseMoney(resumo.creditur_valor_financiado_pre_chaves || 0) > 0;
  }

  function isCrediturGeralReport(resumo = {}) {
    return normalizeSimulationPartner(resumo.parceiro_simulacao) === PARTNER_CREDITUR_GERAL;
  }

  function nomeAnexoCreditu(anexo, fallback) {
    return firstFilled(anexo?.nome_original, anexo?.nome_armazenado, fallback);
  }

  function caminhoAnexoCreditu(anexo) {
    return String(anexo?.caminho_relativo || "").trim();
  }

  function tipoAnexoCreditu(anexo, contentType = "") {
    const tipo = String(contentType || anexo?.content_type || "").toLowerCase();
    const nome = String(firstFilled(anexo?.nome_original, anexo?.nome_armazenado, anexo?.caminho_relativo, "")).toLowerCase();
    if (tipo.includes("pdf") || nome.endsWith(".pdf")) return "pdf";
    if (tipo.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(nome)) return "imagem";
    return "";
  }

  function blobParaDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Nao foi possivel preparar o anexo."));
      reader.readAsDataURL(blob);
    });
  }

  async function baixarAnexoCredituParaRelatorio(anexo, label, fallbackName) {
    const caminho = caminhoAnexoCreditu(anexo);
    if (!caminho) return null;

    const nome = nomeAnexoCreditu(anexo, fallbackName);
    const token = typeof shared?.getAccessToken === "function" ? shared.getAccessToken() : "";
    const headers = { Accept: "application/octet-stream" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const url = `${ENDPOINTS.credituAnexo}?caminho=${encodeURIComponent(caminho)}&nome=${encodeURIComponent(nome)}`;
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers,
    });
    if (response.status === 401 && typeof shared?.redirectToLogin === "function") {
      shared.redirectToLogin();
    }
    if (!response.ok) {
      throw new Error(`Nao foi possivel carregar ${label}.`);
    }

    const blob = await response.blob();
    const dataUrl = await blobParaDataUrl(blob);
    return {
      label,
      nome,
      dataUrl,
      tipo: tipoAnexoCreditu(anexo, blob.type),
    };
  }

  async function prepararAnexosCredituGeralRelatorio(resumo = {}) {
    if (!isCrediturGeralReport(resumo)) {
      return { anexos: [], falhas: [] };
    }

    const credituGeral = resumo.creditu_geral || {};
    const anexosCreditur = credituGeral.anexos_creditu || {};
    const candidatos = [
      {
        label: "PDF Da Simulação Creditú",
        fallbackName: "simulacao-creditu.pdf",
        anexo: credituGeral.arquivo_pdf,
      },
      {
        label: "Score Serasa",
        fallbackName: "score-serasa.pdf",
        anexo: credituGeral.anexo_serasa || anexosCreditur.serasa,
      },
    ].filter((item) => caminhoAnexoCreditu(item.anexo));

    const anexos = [];
    const falhas = [];
    for (const item of candidatos) {
      try {
        const baixado = await baixarAnexoCredituParaRelatorio(item.anexo, item.label, item.fallbackName);
        if (baixado) anexos.push(baixado);
      } catch (error) {
        falhas.push(messageFromError(error, `Nao foi possivel carregar ${item.label}.`));
      }
    }
    return { anexos, falhas };
  }

  function renderAnexosCredituGeralRelatorio(anexos = []) {
    if (!Array.isArray(anexos) || !anexos.length) return "";
    return `
      <section class="section section--break report-attachments">
        <span class="section-kicker">Anexos Creditú Geral</span>
        <h2>Documentos anexados</h2>
        <p class="report-note">Os documentos abaixo foram anexados à simulação Creditú Geral e entram no final deste PDF quando disponíveis.</p>
        ${anexos.map((anexo, index) => {
          const titulo = `${index + 1}. ${anexo.label}`;
          if (anexo.tipo === "imagem") {
            return `
              <article class="report-attachment">
                <h3>${escapeHtml(titulo)}</h3>
                <p>${escapeHtml(anexo.nome)}</p>
                <img class="report-attachment-image" src="${escapeHtml(anexo.dataUrl)}" alt="${escapeHtml(titulo)}" />
              </article>`;
          }
          return `
            <article class="report-attachment report-attachment--pdf">
              <h3>${escapeHtml(titulo)}</h3>
              <p>${escapeHtml(anexo.nome)}</p>
              <iframe class="report-attachment-frame" src="${escapeHtml(anexo.dataUrl)}" title="${escapeHtml(titulo)}"></iframe>
              <a class="report-attachment-link" href="${escapeHtml(anexo.dataUrl)}" target="_blank" rel="noopener">Abrir anexo</a>
            </article>`;
        }).join("")}
      </section>`;
  }

  function isParcelaFase(parcela, faseEsperada) {
    return normalizeParcelaPhase(parcela?.fase).includes(faseEsperada);
  }

  function isParcelaMensalProposta(parcela) {
    const tipo = normalizeParcelaTipo(parcela);
    return (tipo.includes("mensal") || tipo.includes("saldo pos")) && parseMoney(parcela?.valor_7lm ?? parcela?.valor ?? 0) > 0;
  }

  function isParcelaMensal7lmInformadaRelatório(parcela, resumo = {}) {
    if (!isParcelaMensalProposta(parcela)) return false;
    if (parcela?.parcela_personalizada === true) return true;

    const tipo = normalizeParcelaTipo(parcela);
    const fase = normalizeParcelaPhase(parcela?.fase);
    const valor = roundMoneyNumber(parseMoney(parcela?.valor_7lm ?? parcela?.valor ?? 0));
    const parcelaPreResumo = roundMoneyNumber(parseMoney(resumo.parcela_pre_obra_manual || 0));
    const parcelaPosResumo = roundMoneyNumber(parseMoney(resumo.parcela_pos_obra_manual || 0));
    const parcelaPreInformada = parcelaPreResumo > 0.01 ? parcelaPreResumo : roundMoneyNumber(parseMoney(readValue(ids.preObraValor) || 0));
    const parcelaPosInformada = parcelaPosResumo > 0.01 ? parcelaPosResumo : roundMoneyNumber(parseMoney(readValue(ids.posObraValor) || 0));
    const isPre = fase.includes("pre entrega") || tipo.includes("mensal pre");
    const isPos = fase.includes("pos entrega") || tipo.includes("mensal pos") || tipo.includes("saldo pos");

    if (isPre) return parcelaPreInformada > 0.01 && Math.abs(valor - parcelaPreInformada) <= 0.01;
    if (isPos) return parcelaPosInformada > 0.01 && Math.abs(valor - parcelaPosInformada) <= 0.01;
    return false;
  }

  function isParcelaExtraProposta(parcela) {
    const tipo = normalizeParcelaTipo(parcela);
    return ["intermediaria", "semestral", "anual", "reforco"].some((key) => tipo.includes(key))
      && parseMoney(parcela?.valor_7lm ?? parcela?.valor ?? 0) > 0;
  }

  function ordenarParcelasPagamentoRelatório(parcelas) {
    return (Array.isArray(parcelas) ? parcelas : [])
      .filter((parcela) => parseMoney(parcela?.valor_7lm ?? parcela?.valor ?? 0) > 0)
      .slice()
      .sort((left, right) => {
        const leftDate = left?.vencimento ? calendarDateTime(left.vencimento) : 0;
        const rightDate = right?.vencimento ? calendarDateTime(right.vencimento) : 0;
        if (leftDate !== rightDate) return leftDate - rightDate;
        return numeroParcelaQuadroProposta(left) - numeroParcelaQuadroProposta(right);
      });
  }

  function limiteParcelasCrediturRelatório(resumo = {}) {
    if (isCrediturGeralReport(resumo)) {
      return CREDITUR_PRE_DEFAULT_MONTHS;
    }
    const intervalos = Array.isArray(resumo.creditur_intervalos_parcelas)
      ? resumo.creditur_intervalos_parcelas
      : [];
    const limitesInformados = intervalos
      .map((item) => ({
        inicio: toNumber(item?.parcela_inicio, 0),
        fim: toNumber(item?.parcela_fim, 0),
        valor: parseMoney(item?.valor || 0),
      }))
      .filter((item) => item.valor > 0 && item.inicio === 1 && item.fim >= item.inicio)
      .map((item) => item.fim);
    if (limitesInformados.length) {
      return clamp(Math.max(...limitesInformados), 1, CREDITUR_PRE_MAX_MONTHS);
    }
    return clamp(toNumber(resumo.meses_pre_entrega, CREDITUR_PRE_DEFAULT_MONTHS), 1, CREDITUR_PRE_MAX_MONTHS);
  }

  function normalizarIntervalosCrediturRelatório(resumo = {}) {
    const crediturFim = limiteParcelasCrediturRelatório(resumo);
    const intervalos = Array.isArray(resumo.creditur_intervalos_parcelas)
      ? resumo.creditur_intervalos_parcelas
      : [];
    return intervalos
      .map((item) => {
        const inicio = clamp(toNumber(item?.parcela_inicio, 0), 1, CREDITUR_TOTAL_MAX_MONTHS);
        const fim = clamp(toNumber(item?.parcela_fim, inicio), inicio, CREDITUR_TOTAL_MAX_MONTHS);
        const valor = roundMoneyNumber(parseMoney(item?.valor || 0));
        if (valor <= 0) return null;
        return {
          parcela_inicio: inicio,
          parcela_fim: fim,
          valor,
          origem: inicio <= crediturFim ? "creditur" : "7lm",
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.parcela_inicio - right.parcela_inicio || left.parcela_fim - right.parcela_fim);
  }

  function montarParcelasMensaisCrediturRelatório(resumo = {}) {
    const crediturFim = limiteParcelasCrediturRelatório(resumo);
    const parcelas = [];
    normalizarIntervalosCrediturRelatório(resumo).forEach((intervalo) => {
      for (let numero = intervalo.parcela_inicio; numero <= intervalo.parcela_fim; numero += 1) {
        const origem = numero <= crediturFim ? "creditur" : "7lm";
        parcelas.push({
          fase: origem === "creditur" ? "pre_entrega" : "pos_entrega",
          tipo: origem === "creditur" ? "mensal_creditur" : "mensal_pos_7lm",
          parcela: numero,
          vencimento: formatIsoDate(addMonthsDate(contractDate(), numero)),
          valor: intervalo.valor,
          valor_7lm: intervalo.valor,
          valor_total_cliente: intervalo.valor,
          __parcela_relatorio: numero,
          __origem_relatorio: origem,
          __creditur_intervalo_relatorio: true,
        });
      }
    });
    return parcelas;
  }

  function prepararParcelasRelatórioCreditur(resumo = {}, parcelas = []) {
    if (!isCrediturReport(resumo)) return Array.isArray(parcelas) ? parcelas : [];
    const parcelasNaoMensais = (Array.isArray(parcelas) ? parcelas : []).filter((parcela) => !isParcelaMensalProposta(parcela));
    return [
      ...parcelasNaoMensais,
      ...montarParcelasMensaisCrediturRelatório(resumo),
    ];
  }

  function isParcelaMensalCrediturRelatório(parcela) {
    return isParcelaMensalProposta(parcela) && parcela?.__origem_relatorio === "creditur";
  }

  function isParcelaMensal7lmRelatório(parcela) {
    if (!isParcelaMensalProposta(parcela)) return false;
    if (parcela?.__origem_relatorio) return parcela.__origem_relatorio === "7lm";
    return false;
  }

  function faixaParcelasOrigemRelatório(parcelas, origem) {
    const numeros = ordenarParcelasPagamentoRelatório(parcelas)
      .filter((parcela) => isParcelaMensalProposta(parcela) && parcela?.__origem_relatorio === origem)
      .map((parcela) => Number(parcela.__parcela_relatorio || 0))
      .filter((numero) => Number.isFinite(numero) && numero > 0);
    if (!numeros.length) return "";
    const inicio = Math.min(...numeros);
    const fim = Math.max(...numeros);
    return inicio === fim ? String(inicio) : `${inicio} A ${fim}`;
  }

  function numeroParcelaQuadroProposta(parcela, fallback = 0) {
    const numero = Number(firstFilled(
      parcela?.__parcela_relatorio,
      parcela?.parcela_relatorio,
      parcela?.parcela,
      parcela?.numero,
      parcela?.numero_parcela,
      fallback
    ));
    return Number.isFinite(numero) && numero > 0 ? Math.round(numero) : 0;
  }

  function baseLabelLinhaQuadroProposta(grupo, prefixo = "") {
    const tipo = normalizeParcelaTipo(grupo.primeira);
    if (prefixo) return prefixo;
    if (tipo.includes("intermediaria")) return "Intermediária";
    if (tipo.includes("semestral")) return "Semestral";
    if (tipo.includes("anual")) return "Anual";
    if (tipo.includes("reforco")) return "Reforço";
    if (tipo.includes("saldo pos")) return "Saldo Pós-Chaves";
    return "Mensal";
  }

  function faixaParcelasQuadroProposta(grupo) {
    const primeira = Number(grupo.primeiraParcela || 0);
    const ultima = Number(grupo.ultimaParcela || 0);
    if (!primeira || !ultima) return "";
    return primeira === ultima ? String(primeira) : `${primeira} A ${ultima}`;
  }

  function labelLinhaQuadroProposta(grupo, prefixo = "") {
    const base = baseLabelLinhaQuadroProposta(grupo, prefixo).replace(/\s+\(\d+X\)$/i, "");
    const faixa = faixaParcelasQuadroProposta(grupo);
    return faixa ? `${base} ${faixa}` : `${base} (${grupo.qtd || 1}X)`;
  }

  function dataInicialGrupoProposta(itens) {
    const datas = (Array.isArray(itens) ? itens : [])
      .map((parcela) => parseCalendarDate(parcela?.vencimento))
      .filter((data) => data instanceof Date && !Number.isNaN(data.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    return datas.length ? formatDateLabel(datas[0]) : "-";
  }

  function dataFinalGrupoProposta(itens) {
    const datas = (Array.isArray(itens) ? itens : [])
      .map((parcela) => parseCalendarDate(parcela?.vencimento))
      .filter((data) => data instanceof Date && !Number.isNaN(data.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());
    return datas.length ? formatDateLabel(datas[0]) : "-";
  }

  function periodoGrupoProposta(itens) {
    const inicio = dataInicialGrupoProposta(itens);
    const fim = dataFinalGrupoProposta(itens);
    if (!inicio || inicio === "-" || fim === "-" || inicio === fim) return inicio || "-";
    return `${inicio} a ${fim}`;
  }

  function agruparParcelasQuadroProposta(parcelas, predicate, options = {}) {
    const grupos = [];
    (Array.isArray(parcelas) ? parcelas : [])
      .filter(predicate)
      .slice()
      .sort((left, right) => {
        const leftDate = left?.vencimento ? calendarDateTime(left.vencimento) : 0;
        const rightDate = right?.vencimento ? calendarDateTime(right.vencimento) : 0;
        if (leftDate !== rightDate) return leftDate - rightDate;
        return numeroParcelaQuadroProposta(left) - numeroParcelaQuadroProposta(right);
      })
      .forEach((parcela) => {
        const valor = roundMoneyNumber(parseMoney(parcela.valor_7lm ?? parcela.valor ?? 0));
        if (valor <= 0) return;
        const tipo = options.tipoAgrupamento || normalizeParcelaTipo(parcela);
        const fase = options.ignorarFase ? "" : normalizeParcelaPhase(parcela?.fase);
        const numero = numeroParcelaQuadroProposta(parcela, grupos.reduce((sum, grupoAtual) => sum + grupoAtual.qtd, 0) + 1);
        const itemizarLinha = Boolean(options.itemizarIntermediarias && tipo.includes("intermediaria"));
        let grupo = grupos[grupos.length - 1];
        const mesmaSequencia = Boolean(
          !itemizarLinha
          && grupo
          && grupo.prefixo === (options.prefixo || "")
          && grupo.tipo === tipo
          && grupo.fase === fase
          && Math.abs(grupo.valor - valor) <= 0.001
          && (!grupo.ultimaParcela || !numero || numero === grupo.ultimaParcela + 1)
        );
        if (!mesmaSequencia) {
          grupo = {
            primeira: parcela,
            prefixo: options.prefixo || "",
            tipo,
            fase,
            valor,
            total: 0,
            qtd: 0,
            itens: [],
            primeiraParcela: numero,
            ultimaParcela: numero,
          };
          grupos.push(grupo);
        }
        grupo.qtd += 1;
        grupo.total = roundMoneyNumber(grupo.total + valor);
        grupo.ultimaParcela = numero || grupo.ultimaParcela;
        grupo.itens.push(parcela);
      });

    return grupos.map((grupo) => ({
      label: labelLinhaQuadroProposta(grupo, options.prefixo),
      qtd: grupo.qtd,
      valorUnitario: grupo.valor,
      total: grupo.total,
      vencimento: periodoGrupoProposta(grupo.itens),
    }));
  }

  function linhaEntradaQuadroProposta(resumo, parcelas) {
    const entradaValor = Math.max(
      parseMoney(resumo.entrada || 0),
      somaParcelasRelatório(parcelas, isEntradaParcela, "valor_total_cliente"),
    );
    if (entradaValor <= 0) return null;
    return {
      label: "Entrada / Sinal",
      qtd: 1,
      valorUnitario: entradaValor,
      total: entradaValor,
      vencimento: parcelaVencimentoMaisAntigo(parcelas, isEntradaParcela),
    };
  }

  function renderLinhasQuadroProposta(rows, emptyText) {
    if (!rows.length) {
      return `<tr><td colspan="5">${escapeHtml(emptyText)}</td></tr>`;
    }
    return rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.label)}</td>
        <td>${escapeHtml(String(row.qtd || "-"))}</td>
        <td>${escapeHtml(formatMoney(row.valorUnitario || 0))}</td>
        <td>${escapeHtml(formatMoney(row.total || 0))}</td>
        <td>${escapeHtml(row.vencimento || "-")}</td>
      </tr>`).join("");
  }

  function renderTabelaQuadroProposta(titulo, rows, options = {}) {
    const total = rows.reduce((sum, row) => sum + parseMoney(row.total || 0), 0);
    const note = options.note
      ? `<p class="proposal-note">${escapeHtml(options.note)}</p>`
      : "";
    return `
      <div class="proposal-table-wrap">
        <table class="legal-table proposal-table proposal-table--schedule">
          <thead>
            <tr class="proposal-title-row"><th colspan="5">${escapeHtml(titulo)}</th></tr>
            <tr>
              <th>Descrição</th>
              <th>Qtd</th>
              <th>Valor</th>
              <th>Total</th>
              <th>Período</th>
            </tr>
          </thead>
          <tbody>
            ${renderLinhasQuadroProposta(rows, options.emptyText || "Sem parcelas para este bloco.")}
            <tr class="legal-total-row">
              <td colspan="3">TOTAL</td>
              <td>${escapeHtml(formatMoney(total))}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        ${note}
      </div>`;
  }

  function renderFinanciamentoQuadroProposta(resumo) {
    const financiamento = parseMoney(resumo.financiamento_caixa || 0);
    const fgts = parseMoney(resumo.fgts || 0);
    const subsidio = parseMoney(resumo.subsidio || 0);
    const cheque = parseMoney(resumo.cheque_moradia || 0);
    const parcelaBanco = parseMoney(resumo.parcela_financiamento_banco || 0);
    const total = roundMoneyNumber(financiamento + fgts + subsidio);
    const rows = [
      ["Parcela Caixa", formatMoney(parcelaBanco), "parcela mensal estimada"],
      ["Financiamento Caixa", formatMoney(financiamento), "contrato com agente financeiro"],
      ["FGTS", formatMoney(fgts), "recurso do comprador"],
      ["Subsídio MCMV", formatMoney(subsidio), "entra no valor pago e no garantido real"],
      ...(cheque > 0.01 ? [["Cheque Moradia", formatMoney(cheque), "informativo, fora do garantido real"]] : []),
      ["Total", formatMoney(total), ""],
    ];

    return `
      <table class="legal-table proposal-table proposal-table--bank">
        <thead>
          <tr class="proposal-title-row proposal-title-row--bank"><th colspan="3">Financiamento / Garantido</th></tr>
          <tr><th>Item</th><th>Valor</th><th>Observação</th></tr>
        </thead>
        <tbody>
          ${rows.map(([label, value, note]) => `
            <tr>
              <td>${escapeHtml(label)}</td>
              <td>${escapeHtml(value)}</td>
              <td>${escapeHtml(note)}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  }

  function renderConsolidacaoPagamentoRelatório(resumo, operacao, totalPagoCliente, saldoClienteImovel, saldoClienteNegociado, parcelas = []) {
    const financiamento = parseMoney(resumo.financiamento_caixa || 0);
    const fgts = parseMoney(resumo.fgts || 0);
    const subsidio = parseMoney(resumo.subsidio || 0);
    const cheque = parseMoney(resumo.cheque_moradia || 0);
    const entrada = parseMoney(resumo.entrada || 0);
    const desconto = parseMoney(firstFilled(resumo.incentivo_7lm, resumo.desconto_imovel, operacao.desconto, 0));
    const valorNegociado = parseMoney(firstFilled(resumo.valor_total_operacao, operacao.valorNegociado, 0));
    const credituGeralRelatório = isCrediturGeralReport(resumo);
    const credituGeral = credituGeralRelatório && resumo.creditu_geral ? resumo.creditu_geral : null;
    const captacaoInicialInformada = roundMoneyNumber(parseMoney(firstFilled(
      resumo.valor_fechamento_inicial,
      resumo.valor_garantido_real,
      resumo.garantido_real,
      0
    )));
    const captacaoInicial = captacaoInicialInformada > 0.01
      ? captacaoInicialInformada
      : roundMoneyNumber(financiamento + fgts + subsidio + entrada);
    const crediturAtivo = isCrediturReport(resumo);
    const crediturFim = limiteParcelasCrediturRelatório(resumo);
    const parcelasRelatório = prepararParcelasRelatórioCreditur(resumo, parcelas);
    const faixaCreditur = faixaParcelasOrigemRelatório(parcelasRelatório, "creditur") || `1 A ${crediturFim}`;
    const faixa7lm = faixaParcelasOrigemRelatório(parcelasRelatório, "7lm");
    const totalMensalCrediturRelatório = somaParcelasRelatório(parcelasRelatório, isParcelaMensalCrediturRelatório);
    const totalMensal7lmRelatório = somaParcelasRelatório(parcelasRelatório, isParcelaMensal7lmRelatório);
    const totalMensal7lmInformadoRelatório = somaParcelasRelatório(
      parcelasRelatório,
      (parcela) => isParcelaMensal7lmInformadaRelatório(parcela, resumo),
    );
    const totalExtrasRelatório = somaParcelasRelatório(parcelasRelatório, isParcelaExtraProposta);
    const fluxoDireto7lm = crediturAtivo
      ? totalExtrasRelatório
      : roundMoneyNumber(totalMensal7lmInformadoRelatório + totalExtrasRelatório);
    const totalConsideradoRelatório = crediturAtivo
      ? totalPagoCliente
      : roundMoneyNumber(captacaoInicial + fluxoDireto7lm);
    const saldoClienteNegociadoRelatório = crediturAtivo
      ? saldoClienteNegociado
      : resolveNegotiatedPaymentBalance({ valor_total_operacao: valorNegociado }, { valorNegociado }, totalConsideradoRelatório);
    const rows = [
      ["Valor total do imóvel", formatMoney(operacao.valorImovel), "preço de tabela da unidade"],
      ...(operacao.sobrepreco > 0.01 ? [["Sobrepreço", formatMoney(operacao.sobrepreco), "acréscimo comercial aplicado antes do fechamento"]] : []),
      ...(desconto > 0.01 ? [["Incentivo 7LM", `- ${formatMoney(desconto)}`, "abatimento comercial já aplicado no valor negociado"]] : []),
      ["Valor negociado", formatMoney(valorNegociado), "valor final após sobrepreço e Incentivo 7LM"],
      ["Garantido real", formatMoney(captacaoInicial), "financiamento aprovado + entrada + FGTS + subsídio"],
      ...(credituGeralRelatório && parseMoney(credituGeral?.valor_liberado || totalMensalCrediturRelatório) > 0.01
        ? [["Creditú Geral liberado", formatMoney(parseMoney(credituGeral?.valor_liberado || totalMensalCrediturRelatório)), "valor aprovado pela Creditú Geral e alocado integralmente no pré-chaves"]]
        : []),
      ...(credituGeralRelatório && parseMoney(credituGeral?.total_financiado || 0) > 0.01
        ? [["Total Financiado Creditú", formatMoney(credituGeral.total_financiado), `${credituGeral.prazo || CREDITUR_PRE_DEFAULT_MONTHS} Meses, Sistema ${credituGeral.sistema || "SAC"}`]]
        : []),
      ...(credituGeralRelatório && parseMoney(credituGeral?.parcela_inicial || 0) > 0.01
        ? [["Parcela Inicial Creditú", formatMoney(credituGeral.parcela_inicial), "Referência Da Simulação Creditú Geral"]]
        : []),
      ...(crediturAtivo && !credituGeralRelatório && totalMensalCrediturRelatório > 0.01
        ? [[`Creditú ${faixaCreditur}`, formatMoney(totalMensalCrediturRelatório), "parcelas mensais Creditú conforme curva informada"]]
        : []),
      ...(crediturAtivo && totalMensal7lmRelatório > 0.01
        ? [[`7LM ${faixa7lm || `${crediturFim + 1} A ${CREDITUR_TOTAL_MAX_MONTHS}`}`, formatMoney(totalMensal7lmRelatório), "parcelas mensais 7LM conforme curva informada"]]
        : []),
      ...(fluxoDireto7lm > 0.01
        ? [[crediturAtivo ? "Fluxo direto 7LM / reforços" : "Parcelas 7LM informadas", formatMoney(fluxoDireto7lm), crediturAtivo ? "demais parcelas programadas no simulador" : "soma das parcelas preenchidas no simulador"]]
        : []),
      ["Total considerado", formatMoney(totalConsideradoRelatório), "soma considerada no relatório", "is-total"],
      [saldoClienteNegociadoRelatório.label, saldoClienteNegociadoRelatório.value, saldoClienteNegociadoRelatório.help, ["faltante", "acima"].includes(saldoClienteNegociadoRelatório.direction) ? "is-danger" : ""],
      ["Financiamento Caixa", formatMoney(financiamento), "composição do garantido"],
      ["FGTS", formatMoney(fgts), "recurso do comprador"],
      ["Subsídio", formatMoney(subsidio), "entra no valor pago e no garantido real"],
      ...(cheque > 0.01 ? [["Cheque moradia", formatMoney(cheque), "informativo, fora do garantido real"]] : []),
      ["Entrada / sinal", formatMoney(entrada), "pagamento inicial"],
    ];

    return `
      <div class="proposal-consolidation-wrap">
      <table class="legal-table proposal-table proposal-table--bank proposal-consolidation">
        <thead>
          <tr class="proposal-title-row proposal-title-row--consolidation"><th colspan="3">Consolidação Financeira da Proposta</th></tr>
          <tr><th>Item</th><th>Valor</th><th>Observação</th></tr>
        </thead>
        <tbody>
          ${rows.map(([label, value, note, className]) => `
            <tr class="${escapeHtml(className || "")}">
              <td>${escapeHtml(label)}</td>
              <td>${escapeHtml(value)}</td>
              <td>${escapeHtml(note)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      </div>`;
  }

  function renderFormaPagamentoRelatório(resumo, parcelas, options = {}) {
    const crediturAtivo = isCrediturReport(resumo);
    const credituGeralRelatório = isCrediturGeralReport(resumo);
    const parcelasRelatório = crediturAtivo ? prepararParcelasRelatórioCreditur(resumo, parcelas) : (Array.isArray(parcelas) ? parcelas : []);
    const entradaRow = linhaEntradaQuadroProposta(resumo, parcelas);
    const entradaRows = entradaRow ? [entradaRow] : [];
    const consolidacaoHtml = options.consolidacaoHtml || "";
    const linhasExtrasPre = agruparParcelasQuadroProposta(
      parcelasRelatório,
      (parcela) => isParcelaFase(parcela, "pre entrega") && isParcelaExtraProposta(parcela),
      { itemizarIntermediarias: true },
    );
    const linhasExtrasPos = agruparParcelasQuadroProposta(
      parcelasRelatório,
      (parcela) => isParcelaFase(parcela, "pos entrega") && isParcelaExtraProposta(parcela),
      { itemizarIntermediarias: true },
    );

    if (crediturAtivo) {
      const crediturFim = limiteParcelasCrediturRelatório(resumo);
      const faixaCreditur = faixaParcelasOrigemRelatório(parcelasRelatório, "creditur") || `1 A ${crediturFim}`;
      const faixa7lm = faixaParcelasOrigemRelatório(parcelasRelatório, "7lm");
      let linhasCreditur = [
        ...agruparParcelasQuadroProposta(
          parcelasRelatório,
          isParcelaMensalCrediturRelatório,
          { prefixo: credituGeralRelatório ? "Creditú Geral" : "Mensal Creditú", ignorarFase: true, tipoAgrupamento: "mensal_creditur" },
        ),
      ];
      if (credituGeralRelatório && !linhasCreditur.length) {
        const valorLiberado = parseMoney(firstFilled(
          resumo?.creditu_geral?.valor_liberado,
          resumo?.creditur_valor_financiado_pre_chaves,
          resumo?.creditur_valor_repassado_7lm,
          0,
        ));
        const prazoCrediturGeral = Math.max(
          toNumber(firstFilled(resumo?.creditu_geral?.prazo, resumo?.meses_pre_entrega, CREDITU_GERAL_DEFAULT_MONTHS), CREDITU_GERAL_DEFAULT_MONTHS),
          1,
        );
        if (valorLiberado > 0.01) {
          linhasCreditur = [{
            label: "Creditú Geral Liberado",
            qtd: prazoCrediturGeral,
            valorUnitario: roundMoneyNumber(valorLiberado / prazoCrediturGeral),
            total: roundMoneyNumber(valorLiberado),
            vencimento: "Pré-chaves",
          }];
        }
      }
      const linhasMensais7lm = agruparParcelasQuadroProposta(
        parcelasRelatório,
        isParcelaMensal7lmRelatório,
        { prefixo: "Mensal 7LM", ignorarFase: true, tipoAgrupamento: "mensal_7lm" },
      );
      const linhas7lm = [
        ...entradaRows,
        ...linhasMensais7lm,
        ...linhasExtrasPre,
        ...linhasExtrasPos,
      ];
      const tituloCreditur = credituGeralRelatório
        ? "Creditú Geral - Valor Liberado no Pré-Chaves"
        : (linhasCreditur.length
          ? `Creditú - Parcelas ${faixaCreditur}`
          : "Creditú - Sem Parcelas Informadas");
      const noteCreditur = credituGeralRelatório
        ? "Valor Liberado Pela Simulação Creditú Geral, Distribuído Até As Chaves Para Composição Da Proposta."
        : (linhasCreditur.length
          ? `Parcelas ${faixaCreditur} pela Creditú, conforme curva informada no simulador.`
          : "Nenhum valor mensal Creditú foi informado na curva da simulação.");
      const note7lm = linhasMensais7lm.length
        ? `Parcelas ${faixa7lm || `${crediturFim + 1} A ${CREDITUR_TOTAL_MAX_MONTHS}`} pela 7LM, conforme curva informada no simulador. Entrada, intermediárias, semestrais, anuais e reforços ficam na 7LM.`
        : "Entrada, intermediárias, semestrais, anuais e reforços ficam na 7LM quando houver programação no simulador.";
      const titulo7lm = linhasMensais7lm.length && faixa7lm
        ? `7LM - Parcelas ${faixa7lm}`
        : "7LM - Entradas e Reforços";

      return `
        <div class="proposal-payment proposal-payment--creditur">
          ${renderFinanciamentoQuadroProposta(resumo)}
          <div class="proposal-payment-grid">
            ${renderTabelaQuadroProposta(tituloCreditur, linhasCreditur, {
              note: noteCreditur,
              emptyText: credituGeralRelatório ? "Sem valor liberado na Creditú Geral." : "Sem parcelas Creditú informadas.",
            })}
            ${renderTabelaQuadroProposta(titulo7lm, linhas7lm, { note: note7lm })}
          </div>
          ${consolidacaoHtml}
        </div>`;
    }

    const linhasConstrutora = [
      ...entradaRows,
      ...agruparParcelasQuadroProposta(
        parcelasRelatório,
        (parcela) => isParcelaMensal7lmInformadaRelatório(parcela, resumo),
        { prefixo: "Mensal 7LM" },
      ),
      ...linhasExtrasPre,
      ...linhasExtrasPos,
    ];

    return `
      <div class="proposal-payment">
        ${renderFinanciamentoQuadroProposta(resumo)}
        <div class="proposal-payment-grid proposal-payment-grid--single">
          ${renderTabelaQuadroProposta("Parte Construtora 7LM", linhasConstrutora)}
        </div>
        ${consolidacaoHtml}
      </div>`;
  }

  function renderObservacoesParcelasRelatório(parcelas) {
    const observacoes = Array.from(new Set(
      (Array.isArray(parcelas) ? parcelas : [])
        .map((parcela) => String(parcela.observacao || "").trim())
        .filter(Boolean),
    ));
    if (!observacoes.length) return "";
    return `
      <div class="report-notes-grid">
        ${observacoes.slice(0, 4).map((item) => `<p class="report-note"><strong>Regra:</strong> ${escapeHtml(item)}</p>`).join("")}
      </div>`;
  }

  function renderFluxoRelatório(parcelas) {
    const timeline = buildParcelasTimeline(parcelas);
    if (!timeline.length) {
      return '<p class="report-note">Calcule a simulação para gerar a linha do tempo de pagamentos.</p>';
    }

    const totalGeral = timeline.reduce((sum, item) => sum + item.totalCliente, 0);
    const maiorParcela = Math.max(...timeline.map((item) => item.totalCliente), 0);
    const maiorRenda = Math.max(...timeline.map((item) => item.percentualRenda), 0);
    const maiorObra = Math.max(...timeline.map((item) => item.percentualObra), 0);
    const mesPico = timeline.find((item) => item.totalCliente === maiorParcela) || timeline[0];
    const ultimoMes = timeline[timeline.length - 1];
    const width = 980;
    const height = 300;
    const left = 72;
    const right = 920;
    const top = 28;
    const bottom = 226;
    const plotWidth = right - left;
    const plotHeight = bottom - top;
    const maxValor = Math.max(maiorParcela, ...timeline.map((item) => item.valor7lm), ...timeline.map((item) => item.parcelaBanco), 1) * 1.16;
    const maxPercentual = Math.max(0.45, maiorRenda, maiorObra, 0.01) * 1.16;
    const xFor = (index) => timeline.length === 1 ? left + plotWidth / 2 : left + (plotWidth * index / (timeline.length - 1));
    const yValor = (value) => bottom - ((Math.max(0, value) / maxValor) * plotHeight);
    const yPercentual = (value) => bottom - ((Math.max(0, value) / maxPercentual) * plotHeight);
    const line = (key, scale = yValor) => timeline.map((item, index) => `${xFor(index).toFixed(1)},${scale(item[key]).toFixed(1)}`).join(" ");
    const area = `M ${left},${bottom} L ${timeline.map((item, index) => `${xFor(index).toFixed(1)},${yValor(item.totalCliente).toFixed(1)}`).join(" L ")} L ${xFor(timeline.length - 1).toFixed(1)},${bottom} Z`;
    const step = Math.max(1, Math.ceil(timeline.length / 7));
    const labels = timeline
      .map((item, index) => ({ item, index }))
      .filter(({ index }) => index === 0 || index === timeline.length - 1 || index % step === 0)
      .map(({ item, index }) => `<text x="${xFor(index).toFixed(1)}" y="268" text-anchor="middle" class="chart-label">${escapeHtml(item.label)}</text>`)
      .join("");
    const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const y = bottom - (plotHeight * ratio);
      return `
        <line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" class="chart-grid" />
        <text x="${left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="chart-label">${escapeHtml(formatMoney(maxValor * ratio))}</text>`;
    }).join("");
    const kpis = [
      ["Total pago", formatMoney(totalGeral)],
      ["Maior mês", `${formatMoney(maiorParcela)} - ${mesPico.label}`],
      ["Pico renda", formatPercent(maiorRenda)],
      ["Fim previsto", ultimoMes.label],
    ];

    return `
      <div class="report-flow-kpis">${renderCamposRelatório(kpis, { className: "report-metric--dense" })}</div>
      <div class="report-chart">
        <div class="report-chart-legend">
          <span><i class="is-total"></i>Total cliente</span>
          <span><i class="is-7lm"></i>Parcela 7LM</span>
          <span><i class="is-banco"></i>Banco obra</span>
          <span><i class="is-renda"></i>% renda</span>
          <span><i class="is-obra"></i>% obra</span>
        </div>
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Linha do tempo de pagamentos">
          <defs>
            <linearGradient id="reportAreaTotal" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#0b73f6" stop-opacity="0.32" />
              <stop offset="100%" stop-color="#00b3de" stop-opacity="0.03" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" rx="22" class="chart-bg" />
          ${grid}
          <text x="${right + 14}" y="${top + 4}" class="chart-label chart-label-right">${escapeHtml(formatPercent(maxPercentual))}</text>
          <text x="${right + 14}" y="${bottom + 4}" class="chart-label chart-label-right">0%</text>
          <path d="${area}" class="chart-area" />
          <polyline points="${line("totalCliente")}" class="chart-line is-total" />
          <polyline points="${line("valor7lm")}" class="chart-line is-7lm" />
          <polyline points="${line("parcelaBanco")}" class="chart-line is-banco" />
          <polyline points="${line("percentualRenda", yPercentual)}" class="chart-line is-renda" />
          <polyline points="${line("percentualObra", yPercentual)}" class="chart-line is-obra" />
          ${labels}
        </svg>
      </div>`;
  }

  function montarHtmlRelatórioSimulacao(opcoes = {}) {
    const resultado = state.simulacaoAtual || {};
    const resumo = resultado.resumo_operacao || {};
    const clienteResumo = resultado.cliente || state.consolidacaoCliente || {};
    const cliente = clienteResumo.cliente || state.clienteSelecionado || {};
    const imovel = normalizePropertyForUi({ ...(resultado.imovel || {}), ...(state.imovelSelecionado || {}) });
    const corretor = state.user || {};
    const parcelas = Array.isArray(resultado.demonstrativo) ? resultado.demonstrativo : [];
    const valorFechamento = resolveValorFechamento(resumo);
    const valorEntregaChaves = resolveValorEntregaChaves(resumo);
    const valorGarantidoPlanejado = resolveGuaranteedValue({
      valor_garantido_planejado: firstFilled(
        resumo.valor_garantido_planejado,
        resumo.valor_garantido,
        imovel.valor_garantido_planejado,
        imovel.valor_garantido
      ),
      valor_imovel: firstFilled(resumo.valor_imovel, imovel.valor),
      percentual_fechamento_minimo: firstFilled(resumo.percentual_fechamento_minimo, imovel.percentual_fechamento_minimo, 0.7),
    });
    const valorGarantidoReal = parseMoney(firstFilled(resumo.valor_garantido_real, valorFechamento, 0));
    const valorGarantidoPreObraPlanejado = resolvePlannedDeliveryCaptureValue({
      valor_garantido_pre_obra_planejado: firstFilled(
        resumo.valor_garantido_pre_obra_planejado,
        imovel.valor_garantido_pre_obra_planejado
      ),
      percentual_captacao_ate_entrega: firstFilled(
        resumo.percentual_captacao_ate_entrega,
        imovel.percentual_captacao_ate_entrega
      ),
      valor_imovel: firstFilled(resumo.valor_imovel, imovel.valor),
    });
    const valorGarantidoPreObraReal = parseMoney(firstFilled(
      resumo.valor_garantido_pre_obra_real,
      resumo.valor_projetado_entrega,
      valorEntregaChaves,
      0
    ));
    const percentualCaptacaoAteEntrega = resolveDeliveryCapturePercent({
      percentual_captacao_ate_entrega: firstFilled(
        resumo.percentual_captacao_ate_entrega,
        imovel.percentual_captacao_ate_entrega
      ),
      valor_garantido_pre_obra_planejado: firstFilled(
        resumo.valor_garantido_pre_obra_planejado,
        imovel.valor_garantido_pre_obra_planejado
      ),
      valor_imovel: firstFilled(resumo.valor_imovel, imovel.valor),
    });
    const dataEmissao = formatDateTimeLabel(new Date());
    const logoUrl = new URL(shared?.buildPortalPath ? shared.buildPortalPath("/02_recursos/03_imagens/logo_7lm.svg") : "/02_recursos/03_imagens/logo_7lm.svg", window.location.origin).href;
    const fotoUrl = imovel.foto_principal ? new URL(normalizeMediaPath(imovel.foto_principal), window.location.origin).href : "";
    const titulo = tituloRelatórioOperacao();
    const observacoes = readValue(ids.observacoes).trim();
    const nomeCliente = firstFilled(cliente.nome_completo, cliente.nome, "Cliente não informado");
    const cpfCliente = firstFilled(formatCpf(cliente.cpf || ""), "CPF não informado");
    const enderecoImovel = enderecoImovelRelatório(imovel);
    const empreendimento = firstFilled(imovel.empreendimento, imovel.titulo, "Empreendimento não informado");
    const localizacaoEmpreendimento = joinReportParts([imovel.bairro, imovel.cidade, imovel.estado]);
    const operacao = resolveOperationValues(resumo, imovel);
    const hasCommercialAdjustment = operacao.sobrepreco > 0.01 || operacao.desconto > 0.01;
    const totalPagoCliente = resolveTotalPaidByClient(resumo, operacao);
    const saldoClienteImovel = resolvePropertyPaymentBalance(operacao, totalPagoCliente);
    const saldoClienteNegociado = resolveNegotiatedPaymentBalance(resumo, operacao, totalPagoCliente);
    const valorTotalOperacaoTexto = formatMoney(parseMoney(firstFilled(resumo.valor_total_operacao, operacao.valorNegociado, imovel.valor, 0)));
    const incentivoRelatório = parseMoney(firstFilled(resumo.incentivo_7lm, resumo.desconto_imovel, operacao.desconto, 0));
    const clausulaIncentivo7lm = incentivoRelatório > 0.01
      ? ` O Incentivo 7LM aplicado nesta proposta é de ${formatMoney(incentivoRelatório)} e já está abatido do preço total indicado.`
      : "";
    const chequeMoradiaRelatório = parseMoney(resumo.cheque_moradia || 0);
    const clausulaChequeMoradia = chequeMoradiaRelatório > 0.01
      ? " Cheque Moradia será registrado conforme regra comercial da proposta."
      : "";
    const compradorRows = [
      ["Promitente(s) comprador(a)(es)", nomeCliente],
      ["Nacionalidade", firstFilled(cliente.nacionalidade, "Brasileira")],
      ["Profissão", firstFilled(cliente.profissao, cliente["profissão"], "Não informada")],
      ["Carteira de Identidade/Órgão", joinReportParts([cliente.rg, cliente.orgao_emissor || cliente["órgão_emissor"]], "Não informado")],
      ["CPF", cpfCliente],
      ["Estado civil/Regime", joinReportParts([cliente.estado_civil, cliente.regime_casamento], "Não informado")],
      ["Endereço residencial", enderecoClienteRelatório(cliente)],
      ["Bairro/Município/CEP", bairroMunicipioCepRelatório(cliente)],
      ["Fone", firstFilled(formatPhone(cliente.telefone || cliente.celular || ""), "Não informado")],
    ];

    const clienteCampos = [
      ["Cliente", firstFilled(cliente.nome_completo, cliente.nome, "Cliente não informado")],
      ["CPF", firstFilled(formatCpf(cliente.cpf || ""), "CPF não informado")],
      ["Telefone", firstFilled(formatPhone(cliente.telefone || cliente.celular || ""), "Não informado")],
      ["E-mail", firstFilled(cliente.email, "Não informado")],
      ["Cidade", firstFilled(cliente.cidade, "Não informada")],
      ["Renda total", formatMoney(parseMoney(clienteResumo.renda_total || resumo.renda_total || 0))],
      ["Capacidade mensal", formatMoney(parseMoney(clienteResumo.limite_comprometimento || resumo.limite_comprometimento || 0))],
      ["Status documental", firstFilled(cliente.status_documental, cliente.aprovado ? "Aprovado" : "Não informado")],
    ];

    const imovelCampos = [
      ["Imóvel", firstFilled(imovel.titulo, "Unidade não informada")],
      ["Empreendimento", firstFilled(imovel.empreendimento, "Não informado")],
      ["Localização", [imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(" - ")],
      ["Endereço", firstFilled(imovel.endereco_formatado, imovel.endereco, "Não informado")],
      ["Valor total do imóvel", formatMoney(operacao.valorImovel)],
      ["Total considerado", formatMoney(totalPagoCliente)],
      ...(operacao.sobrepreco > 0.01 ? [["Sobrepreço", formatMoney(operacao.sobrepreco)]] : []),
      ...(operacao.desconto > 0.01 ? [["Incentivo 7LM", `- ${formatMoney(operacao.desconto)}`]] : []),
      ...(hasCommercialAdjustment ? [["Valor negociado", formatMoney(parseMoney(firstFilled(resumo.valor_total_operacao, operacao.valorNegociado)))]] : []),
      ["área", imovel.area_m2 ? formatArea(imovel.area_m2) : "Não informada"],
      ["Quartos", String(toNumber(imovel.quartos ?? imovel.dormitorios ?? 0, 0))],
      ["Vagas", String(toNumber(imovel.vagas ?? imovel.vagas_garagem ?? 0, 0))],
      ["Obra concluída", formatPercent(imovel.percentual_conclusao_obra || resumo.percentual_conclusao_obra || 0)],
      ["Garantido planejado", formatMoney(valorGarantidoPlanejado)],
      ["Garantido + pré-obra planejado", valorGarantidoPreObraPlanejado > 0 ? formatMoney(valorGarantidoPreObraPlanejado) : "Não informado"],
      ["Pré-obra mínima", formatMoney(resolveMinimumPreWorkValue({
        valor_parcela_minima_pre_obra: firstFilled(resumo.valor_parcela_minima_pre_obra, imovel.valor_parcela_minima_pre_obra, 0),
      }))],
      ["Meses até entrega", String(toNumber(resumo.meses_pre_entrega ?? imovel.meses_pre_entrega ?? 36, 36))],
      ["Pós", String(toNumber(
        firstFilled(
          resumo.meses_pos_entrega_configurado,
          resumo.meses_pos_entrega,
          imovel.meses_pos_entrega_configurado,
          imovel.meses_pos_entrega,
          getPreferredPostDeliveryMonths(resumo.meses_pre_entrega ?? imovel.meses_pre_entrega)
        ),
        getPreferredPostDeliveryMonths(resumo.meses_pre_entrega ?? imovel.meses_pre_entrega)
      ))],
    ];

    const financeiroCampos = [
      ["Status da operação", getClassificacaoLabel(resolveUserFacingStatus({ resumo }))],
      ["Comprometimento", formatPercent(resumo.percentual_comprometimento || 0)],
      ["Parcela referência", formatMoney(parseMoney(resumo.parcela_referência || resumo.parcela_maxima_segura || 0))],
      ["Valor total operação", formatMoney(parseMoney(resumo.valor_total_operacao || 0))],
      ["Valor total do imóvel", formatMoney(operacao.valorImovel)],
      ["Total considerado", formatMoney(totalPagoCliente)],
      ["Financiamento Caixa", formatMoney(parseMoney(resumo.financiamento_caixa || 0))],
      ["Parcela banco cheia", formatMoney(parseMoney(resumo.parcela_financiamento_banco || 0))],
      ["Banco pela obra", formatMoney(parseMoney(resumo.parcela_banco_obra_atual || 0))],
      ["Capacidade 7LM pré-obra", formatMoney(parseMoney(resumo.capacidade_pre_obra_7lm_atual || 0))],
      ["Capacidade 7LM pós-obra", formatMoney(parseMoney(resumo.capacidade_pos_obra_7lm || 0))],
      ["FGTS", formatMoney(parseMoney(resumo.fgts || 0))],
      ["Subsídio", formatMoney(parseMoney(resumo.subsidio || 0))],
      ...(parseMoney(resumo.cheque_moradia || 0) > 0.01 ? [["Cheque moradia", formatMoney(parseMoney(resumo.cheque_moradia || 0))]] : []),
      ["Entrada / sinal", formatMoney(parseMoney(resumo.entrada || 0))],
      ["Sobrepreço", formatMoney(parseMoney(resumo.sobrepreco || 0))],
      ["Incentivo 7LM", parseMoney(firstFilled(resumo.incentivo_7lm, resumo.desconto_imovel, 0)) > 0.01
        ? `- ${formatMoney(parseMoney(firstFilled(resumo.incentivo_7lm, resumo.desconto_imovel, 0)))}`
        : formatMoney(0)],
      ["Pro-soluto", formatMoney(parseMoney(resumo.pro_soluto_total || 0))],
      ["Valor fechamento", formatMoney(valorFechamento)],
      ["Fechamento agora", formatPercent(resumo.percentual_fechamento_inicial || 0)],
      ["Garantido planejado", formatMoney(valorGarantidoPlanejado)],
      ["Garantido real", formatMoney(valorGarantidoReal)],
      ["Garantido + pré-obra planejado", valorGarantidoPreObraPlanejado > 0 ? formatMoney(valorGarantidoPreObraPlanejado) : "Não informado"],
      ["Garantido + pré-obra real", formatMoney(valorGarantidoPreObraReal)],
      ["Pré-obra mínima", formatMoney(resolveMinimumPreWorkValue({
        valor_parcela_minima_pre_obra: firstFilled(resumo.valor_parcela_minima_pre_obra, imovel.valor_parcela_minima_pre_obra, 0),
      }))],
      ["Valor entrega chaves", formatMoney(valorEntregaChaves)],
      ["Entrega projetada", formatPercent(resumo.percentual_projetado_entrega || 0)],
      ["Saldo pós-entrega", formatMoney(parseMoney(resumo.saldo_pos_entrega || 0))],
      ["Parcela 7LM mídia", formatMoney(parseMoney(resumo.parcela_7lm_media_pre || 0))],
      ["Parcela 7LM pos", formatMoney(parseMoney(resumo.parcela_7lm_pos || resumo.mensal_pos || 0))],
      ["Parcela ideal pro-soluto", formatMoney(parseMoney(resumo.parcela_7lm_pos_ideal || 0))],
    ];

    const corretorCampos = [
      ["Corretor", firstFilled(corretor.nome_completo, corretor.nome, corretor.displayName, "Não informado")],
      ["E-mail corretor", firstFilled(corretor.email, corretor.mail, corretor.userPrincipalName, "Não informado")],
      ["Data de emissão", dataEmissao],
      ["Código da simulação", firstFilled(state.simulacaoSalvaId, "Não salva")],
    ];
    const anexosCredituGeralRelatorio = Array.isArray(opcoes.anexosCredituGeral) ? opcoes.anexosCredituGeral : [];

    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>7LM - ${escapeHtml(titulo)}</title>
  <style>
    @page { size: A4; margin: 9mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eaf8fb; color: #172033; font-family: Arial, Helvetica, sans-serif; line-height: 1.34; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-action { position: fixed; top: 18px; right: 18px; z-index: 20; border: 0; border-radius: 999px; padding: 12px 18px; background: #0669f8; color: #fff; font-weight: 900; box-shadow: 0 16px 30px rgba(6, 105, 248, .25); cursor: pointer; }
    .page { width: min(100%, 1060px); margin: 24px auto; padding: 28px; border-radius: 30px; background: #f8fbfd; box-shadow: 0 28px 70px rgba(18, 24, 38, .18); }
    .hero { position: relative; overflow: hidden; min-height: 332px; border-radius: 30px; padding: 28px; background: linear-gradient(135deg, #081222 0%, #102744 44%, #00b3de 140%); color: #fff; page-break-inside: avoid; }
    .hero:before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 78% 16%, rgba(0, 179, 222, .46), transparent 26%), radial-gradient(circle at 4% 110%, rgba(6, 105, 248, .45), transparent 30%); }
    .brand, .hero-grid, .hero h1, .subtitle, .hero-line { position: relative; z-index: 1; }
    .brand { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
    .brand img.logo { width: 108px; height: auto; padding: 9px 10px; border-radius: 18px; background: rgba(255, 255, 255, .94); }
    .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 8px 12px; background: rgba(255,255,255,.14); color: #dff8ff; border: 1px solid rgba(255,255,255,.22); font-size: 10px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 24px 0 8px; max-width: 760px; font-size: 36px; line-height: 1; letter-spacing: -.045em; }
    .subtitle { margin: 0; max-width: 780px; color: rgba(237, 247, 255, .78); font-size: 13px; }
    .hero-line { width: 84px; height: 4px; margin: 18px 0 0; border-radius: 999px; background: linear-gradient(90deg, #00b3de, #8eeeff); }
    .hero-grid { display: grid; grid-template-columns: 1fr; gap: 18px; margin-top: 24px; align-items: stretch; }
    .photo { min-height: 170px; border-radius: 24px; background: rgba(255,255,255,.1); overflow: hidden; border: 1px solid rgba(255,255,255,.18); }
    .photo img { width: 100%; height: 100%; min-height: 170px; object-fit: cover; display: block; }
    .photo-empty { display: grid; place-items: center; min-height: 170px; color: rgba(255,255,255,.72); font-weight: 900; }
    .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .summary article { border-radius: 20px; padding: 14px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); }
    .summary article.is-wide { grid-column: 1 / -1; }
    .summary span, .report-metric span { display: block; margin-bottom: 6px; color: #758298; font-size: 8px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
    .summary span { color: rgba(239, 249, 255, .66); }
    .summary strong { display: block; color: #fff; font-size: 16px; letter-spacing: -.02em; }
    .section { margin-top: 14px; padding: 16px; border: 1px solid rgba(18, 24, 38, .08); border-radius: 22px; background: #fff; page-break-inside: avoid; }
    .section--break { page-break-before: always; }
    .section h2 { margin: 0 0 12px; color: #111827; font-size: 16px; letter-spacing: -.025em; }
    .section-kicker { display: block; margin-bottom: 4px; color: #0669f8; font-size: 8px; font-weight: 900; letter-spacing: .2em; text-transform: uppercase; }
    .legal-section { padding: 14px; }
    .legal-section h2 { margin: 0 0 8px; color: #111; font-size: 13px; line-height: 1.2; letter-spacing: .04em; text-transform: uppercase; }
    .legal-box { border: 1.3px solid #222; background: #fff; }
    .legal-clause { padding: 6px 8px; border-bottom: 1px solid #222; color: #111; font-size: 10.4px; line-height: 1.28; }
    .legal-clause p { margin: 5px 0; }
    .legal-clause:last-child { border-bottom: 0; }
    .legal-label { font-weight: 800; text-transform: uppercase; }
    .legal-small-title { margin: 10px 0 5px; color: #111; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .grid.grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grid.grid-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .report-metric { min-height: 58px; border: 1px solid rgba(18, 24, 38, .07); border-radius: 15px; background: #f7fbfd; padding: 10px; overflow-wrap: anywhere; }
    .report-metric strong { display: block; color: #202838; font-size: 11.5px; line-height: 1.24; }
    .report-metric--hero strong { font-size: 13px; }
    .report-metric--dense { min-height: 52px; background: #f3f9fc; }
    .report-note { margin: 7px 0 0; padding: 10px 12px; border-radius: 14px; background: #f3f8fb; color: #465468; border: 1px solid rgba(18, 24, 38, .07); font-size: 11px; }
    .report-notes-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
    .report-flow-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
    .report-chart { padding: 10px; border: 1px solid rgba(18, 24, 38, .08); border-radius: 18px; background: linear-gradient(145deg, #f8fcff, #edf9fd); page-break-inside: avoid; }
    .report-chart svg { display: block; width: 100%; height: auto; }
    .report-chart-legend { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 7px; color: #536174; font-size: 9px; font-weight: 900; }
    .report-chart-legend span { display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; border: 1px solid rgba(18, 24, 38, .07); border-radius: 999px; background: #fff; }
    .report-chart-legend i { width: 8px; height: 8px; border-radius: 999px; background: #0669f8; }
    .report-chart-legend i.is-7lm { background: #10b981; }
    .report-chart-legend i.is-banco { background: #f59e0b; }
    .report-chart-legend i.is-renda { background: #7c3aed; }
    .report-chart-legend i.is-obra { background: #06b6d4; }
    .chart-bg { fill: rgba(255,255,255,.72); }
    .chart-grid { stroke: rgba(18,24,38,.1); stroke-width: 1; }
    .chart-label { fill: #677386; font-size: 11px; font-weight: 800; }
    .chart-label-right { fill: #7c3aed; }
    .chart-area { fill: url(#reportAreaTotal); }
    .chart-line { fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-width: 4; }
    .chart-line.is-total { stroke: #0669f8; }
    .chart-line.is-7lm { stroke: #10b981; stroke-width: 3; }
    .chart-line.is-banco { stroke: #f59e0b; stroke-width: 3; }
    .chart-line.is-renda { stroke: #7c3aed; stroke-width: 3; stroke-dasharray: 8 8; }
    .chart-line.is-obra { stroke: #06b6d4; stroke-width: 3; stroke-dasharray: 4 9; }
    table { width: 100%; border-collapse: collapse; font-size: 8.6px; table-layout: fixed; }
    th, td { padding: 6px 5px; border-bottom: 1px solid rgba(18, 24, 38, .08); text-align: left; vertical-align: top; }
    th { color: #627086; background: #eef8fb; font-size: 7.5px; letter-spacing: .11em; text-transform: uppercase; }
    tbody tr:nth-child(even) td { background: #fbfdfe; }
    tr { page-break-inside: avoid; }
    .legal-table { width: 100%; border-collapse: collapse; border: 1.2px solid #222; color: #111; font-size: 10px; table-layout: fixed; }
    .legal-table th, .legal-table td { border: 1px solid #222; padding: 5px 6px; background: #fff; color: #111; text-align: left; vertical-align: top; line-height: 1.2; }
    .legal-table th { font-size: 10px; font-weight: 800; letter-spacing: 0; text-transform: none; }
    .legal-table tbody tr:nth-child(even) td { background: #fff; }
    .legal-table .legal-total-row td { font-weight: 800; }
    .party-table th { width: 31%; }
    .proposal-payment { display: grid; gap: 8px; margin-top: 8px; }
    .proposal-payment-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; align-items: start; }
    .proposal-payment-grid--single { grid-template-columns: 1fr; }
    .proposal-table-wrap { page-break-inside: avoid; }
    .proposal-consolidation-wrap { break-inside: avoid; page-break-inside: avoid; }
    .proposal-payment--creditur .proposal-consolidation-wrap { break-before: page; page-break-before: always; }
    .proposal-table { font-size: 9.3px; }
    .proposal-table th, .proposal-table td { padding: 5px 6px; }
    .proposal-table--schedule { font-size: 8.1px; }
    .proposal-table--schedule th, .proposal-table--schedule td { padding: 4px 3px; line-height: 1.14; overflow: hidden; }
    .proposal-table--schedule thead tr:not(.proposal-title-row) th { font-size: 8px; line-height: 1.08; }
    .proposal-table--schedule .proposal-title-row th { font-size: 9.4px; padding: 4px 3px; }
    .proposal-title-row th { background: #dff4ec; color: #0f2a1f; font-size: 10px; text-align: center; text-transform: uppercase; }
    .proposal-title-row--bank th { background: #dce9ff; color: #12203f; }
    .proposal-title-row--consolidation th { background: #fee2e2; color: #7f1d1d; }
    .proposal-consolidation tr.is-total td { font-weight: 900; background: #f8fbff; }
    .proposal-consolidation tr.is-danger td { color: #991b1b; font-weight: 800; background: #fff5f5; }
    .proposal-table th:nth-child(1), .proposal-table td:nth-child(1) { width: 34%; }
    .proposal-table th:nth-child(2), .proposal-table td:nth-child(2) { width: 10%; text-align: center; }
    .proposal-table th:nth-child(3), .proposal-table td:nth-child(3), .proposal-table th:nth-child(4), .proposal-table td:nth-child(4) { width: 18%; }
    .proposal-table th:nth-child(5), .proposal-table td:nth-child(5) { width: 20%; }
    .proposal-table--schedule th:nth-child(1), .proposal-table--schedule td:nth-child(1) { width: 24%; }
    .proposal-table--schedule th:nth-child(2), .proposal-table--schedule td:nth-child(2) { width: 9%; text-align: center; }
    .proposal-table--schedule th:nth-child(3), .proposal-table--schedule td:nth-child(3) { width: 20%; }
    .proposal-table--schedule th:nth-child(4), .proposal-table--schedule td:nth-child(4) { width: 22%; }
    .proposal-table--schedule th:nth-child(5), .proposal-table--schedule td:nth-child(5) { width: 25%; }
    .proposal-table--schedule td:nth-child(3), .proposal-table--schedule td:nth-child(4) { white-space: nowrap; }
    .proposal-table--schedule td:nth-child(5) { white-space: normal; overflow-wrap: anywhere; }
    .proposal-table--bank th:nth-child(1), .proposal-table--bank td:nth-child(1) { width: 34%; }
    .proposal-table--bank th:nth-child(2), .proposal-table--bank td:nth-child(2) { width: 24%; text-align: left; }
    .proposal-table--bank th:nth-child(3), .proposal-table--bank td:nth-child(3) { width: 42%; }
    .proposal-note { margin: 5px 0 0; color: #303948; font-size: 9.4px; line-height: 1.25; }
    .report-attachments { page-break-before: always; break-before: page; }
    .report-attachment { margin-top: 12px; padding: 12px; border: 1px solid rgba(18, 24, 38, .1); border-radius: 18px; background: #f8fbff; page-break-inside: avoid; }
    .report-attachment h3 { margin: 0 0 4px; color: #0f172a; font-size: 13px; }
    .report-attachment p { margin: 0 0 10px; color: #627086; font-size: 10px; font-weight: 800; }
    .report-attachment-frame { width: 100%; min-height: 920px; border: 1px solid rgba(18, 24, 38, .16); border-radius: 12px; background: #fff; }
    .report-attachment-image { display: block; max-width: 100%; max-height: 940px; margin: 0 auto; border: 1px solid rgba(18, 24, 38, .12); border-radius: 12px; object-fit: contain; background: #fff; }
    .report-attachment-link { display: inline-flex; margin-top: 8px; color: #0669f8; font-size: 10px; font-weight: 900; text-decoration: none; }
    .footer { margin-top: 16px; color: #697487; font-size: 10px; text-align: center; }
    @media screen and (max-width: 760px) { .page { margin: 0; border-radius: 0; padding: 18px; } .hero-grid, .grid, .grid.grid-3, .grid.grid-5, .summary, .report-flow-kpis, .report-notes-grid { grid-template-columns: 1fr; } h1 { font-size: 28px; } }
    @media print { body { background: #fff; } .print-action { display: none; } .page { width: 100%; margin: 0; padding: 0; border-radius: 0; box-shadow: none; background: #fff; } .hero { min-height: 308px; } .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } .grid.grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } .grid.grid-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); } .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } .report-flow-kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); } .report-notes-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .proposal-payment-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .proposal-payment-grid--single { grid-template-columns: 1fr; } .section { page-break-inside: avoid; } thead { display: table-header-group; } }
  </style>
</head>
<body>
  <button class="print-action" type="button" onclick="window.print()">Salvar como PDF</button>
  <main class="page">
    <section class="hero">
      <div class="brand">
        <img class="logo" src="${escapeHtml(logoUrl)}" alt="7LM" />
                <span class="badge">${escapeHtml(getClassificacaoLabel(resolveUserFacingStatus({ resumo })) )}</span>
      </div>
      <h1>${escapeHtml(titulo)}</h1>
      <p class="subtitle">${escapeHtml(firstFilled(cliente.nome_completo, cliente.nome, "Cliente não informado"))} - ${escapeHtml(firstFilled(imovel.titulo, "Imóvel não informado"))} - Emitido em ${escapeHtml(dataEmissao)}</p>
      <div class="hero-line"></div>
      <div class="hero-grid">
        <div class="photo">${fotoUrl ? `<img src="${escapeHtml(fotoUrl)}" alt="${escapeHtml(imovel.titulo || "Imóvel")}" />` : '<div class="photo-empty">Sem foto principal</div>'}</div>
      </div>
    </section>

    <section class="section legal-section">
      <h2>1. Partes</h2>
      <div class="legal-box">
        <p class="legal-clause"><span class="legal-label">1.1. Promitente vendedora:</span> 7LM, pessoa jurídica de direito privado, doravante denominada simplesmente VENDEDORA.</p>
        <div class="legal-clause">
          <span class="legal-label">1.2. Promitente(s) comprador(a)(es), doravante denominado(a,s) simplesmente COMPRADORA:</span>
          <table class="legal-table party-table">
            <tbody>${renderLegalRows(compradorRows)}</tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="section legal-section">
      <h2>2. Do objeto do contrato e prazo de entrega</h2>
      <div class="legal-box">
        <p class="legal-clause"><span class="legal-label">2.1. Dados do empreendimento:</span> ${escapeHtml(empreendimento)}, situado em ${escapeHtml(localizacaoEmpreendimento)}, conforme dados comerciais cadastrados no simulador.</p>
        <p class="legal-clause"><span class="legal-label">2.2. Características básicas do imóvel adquirido:</span> ${escapeHtml(enderecoImovel)}</p>
      </div>
    </section>

    <section class="section legal-section">
      <h2>3. Preço e forma de pagamento</h2>
      <div class="legal-box">
        <p class="legal-clause"><span class="legal-label">3.1. Preço total:</span> ${escapeHtml(valorTotalOperacaoTexto)}.${escapeHtml(clausulaIncentivo7lm)} A despeito de o pagamento do ITBI, emolumentos e demais despesas cartorárias, bancárias e com despachante ser da COMPRADORA, no preço acima ajustado está incluído o valor de registro de imóvel com 50% (cinquenta por cento) de desconto, tendo em vista as regras do Programa Minha Casa Minha Vida. Contudo, caso a COMPRADORA, por qualquer razão, perca este desconto, deverá arcar com a diferença, sob pena de não se efetivar a contratação com o Agente Financeiro e não receber seu imóvel.</p>
        <div class="legal-clause">
          <span class="legal-label">3.2. Forma de pagamento do saldo de preço:</span>
          <p>a) Valor pago com recursos próprios e diretamente à construtora, conforme descrito na planilha abaixo como mensais/intermediárias/semestrais/anuais, conforme o caso, em que parte do valor é destinada ao pagamento do preço e o saldo refere-se à ITBI, emolumentos e demais despesas cartorárias, bancárias e com despachante.</p>
          <p>b) Valor a financiar diretamente com a Instituição Financeira, mediante obtenção de Financiamento Habitacional pela COMPRADORA, por meio de contrato a ser firmado diretamente com o Agente Financeiro, conforme valor descrito abaixo.</p>
          <p>c) FGTS: equivalente ao valor constante na planilha abaixo.</p>
          <p>d) Eventual obtenção de subsídio compõe o valor pago pelo cliente e o garantido real do simulador.${escapeHtml(clausulaChequeMoradia)}</p>
          ${renderFormaPagamentoRelatório(resumo, parcelas, {
            consolidacaoHtml: renderConsolidacaoPagamentoRelatório(
              resumo,
              operacao,
              totalPagoCliente,
              saldoClienteImovel,
              saldoClienteNegociado,
              parcelas
            ),
          })}
        </div>
        <p class="legal-clause"><span class="legal-label">3.3. Índice de correção monetária e juros:</span> As parcelas estão sujeitas às atualizações conforme os critérios de reajuste aplicáveis à contratação com a Caixa Econômica Federal ou, no valor financiado direto com a VENDEDORA, com taxa de juros pré-fixada de 1% (um por cento) ao mês. Nos juros simples, a correção é aplicada a cada mês, partindo do valor inicial e a partir da data da compra expressa em contrato.</p>
        <p class="legal-clause"><span class="legal-label">3.4. Encargos moratórios:</span> O atraso no pagamento de qualquer obrigação pecuniária prevista neste contrato acarretará a imposição de multa moratória de 2% (dois por cento) do valor devido, acrescido de juros de mora à razão de 1% (um por cento) ao mês, pro-rata-die, além de honorários advocatícios na hipótese de atuação de advogado em composição extrajudicial ou procedimento judicial.</p>
      </div>
    </section>
    ${renderAnexosCredituGeralRelatorio(anexosCredituGeralRelatorio)}
    <p class="footer">Documento gerado pelo 7LM Máquina de Vendas. Valores sujeitos a validação documental, bancária e comercial.</p>
  </main>
  <script>
    window.addEventListener("load", function () {
      var images = Array.prototype.slice.call(document.images || []);
      var imageReady = Promise.all(images.map(function (image) {
        if (image.complete) return Promise.resolve();
        return new Promise(function (resolve) {
          image.onload = resolve;
          image.onerror = resolve;
        });
      }));
      var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      Promise.all([imageReady, fontsReady]).finally(function () {
        setTimeout(function () { window.print(); }, 250);
      });
    });
  <\/script>
</body>
</html>`;
  }

  async function emitirPdfSimulacao() {
    if (!state.simulacaoAtual || !state.clienteSelecionado || !state.imovelSelecionado) {
      showActionMessage("warning", "Calcule ou carregue uma simulação antes de emitir o PDF.");
      return;
    }

    const resumo = state.simulacaoAtual?.resumo_operacao || {};
    const { anexos, falhas } = await prepararAnexosCredituGeralRelatorio(resumo);
    const reportWindow = window.open("", "_blank", "width=1100,height=900");
    if (!reportWindow) {
      showActionMessage("warning", "O navegador bloqueou a janela do PDF. Libere pop-ups para o portal e tente novamente.");
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(montarHtmlRelatórioSimulacao({ anexosCredituGeral: anexos }));
    reportWindow.document.close();
    reportWindow.focus();
    if (falhas.length) {
      showActionMessage("warning", `Relatório aberto, mas ${falhas.length} anexo(s) da Creditú não foram carregados.`);
    } else {
      showActionMessage("success", "Relatório aberto. Use a opção Salvar como PDF na janela de impressão.");
    }
  }

  async function emitirPdfSimulacaoNaJanelaAtual() {
    if (!state.simulacaoAtual || !state.clienteSelecionado || !state.imovelSelecionado) {
      showActionMessage("warning", "Não foi possível emitir o PDF porque a simulação salva não foi carregada.");
      return;
    }

    const resumo = state.simulacaoAtual?.resumo_operacao || {};
    const { anexos } = await prepararAnexosCredituGeralRelatorio(resumo);
    document.open();
    document.write(montarHtmlRelatórioSimulacao({ anexosCredituGeral: anexos }));
    document.close();
  }

  function getDirectPdfSimulationId() {
    try {
      return String(new URLSearchParams(window.location.search || "").get("pdf_simulacao") || "").trim();
    } catch {
      return "";
    }
  }

  function renderDirectPdfLoading(message = "Gerando PDF da simulação...") {
    document.body.innerHTML = `
      <main style="min-height:100vh;display:grid;place-items:center;background:#f5f7fb;font-family:Arial,sans-serif;color:#1f2937">
        <section style="width:min(520px,calc(100vw - 32px));padding:28px;border:1px solid #dce4ef;border-radius:18px;background:#fff;box-shadow:0 24px 80px rgba(15,23,42,.12)">
          <strong style="display:block;font-size:18px;margin-bottom:8px">7LM - Relatório de reserva</strong>
          <span>${escapeHtml(message)}</span>
        </section>
      </main>`;
  }

  async function initDirectPdf(simulationId) {
    renderDirectPdfLoading();
    try {
      const me = await api(ENDPOINTS.me, "GET");
      state.user = me?.usuario || me?.user || me || null;
      await loadSavedSimulationById(simulationId, { silentFeedback: true });
      setTimeout(() => {
        emitirPdfSimulacaoNaJanelaAtual().catch((error) => {
          renderDirectPdfLoading(messageFromError(error, "Não foi possível gerar o PDF da simulação."));
        });
      }, 250);
    } catch (error) {
      renderDirectPdfLoading(messageFromError(error, "Não foi possível gerar o PDF da simulação."));
    }
  }

  async function loadClients(search) {
    const query = encodeURIComponent(String(search || "").trim());
    const url = `${ENDPOINTS.clientesAprovados}?limite=24&q=${query}`;
    const payload = await api(url, "GET");
    state.clientes = Array.isArray(payload?.items) ? payload.items.map((item) => ({ ...item, id: String(item.id || "") })) : [];
    state.clientesRenderLimit = CLIENTS_RENDER_BATCH;
    renderClientsList();
  }

  async function loadPropertyById(id) {
    const payload = await api(endpoint(ENDPOINTS.imovelDetalhe, { id }), "GET");
    const item = payload?.item;
    if (!item?.id) throw new Error("Imóvel não encontrado.");
    return normalizePropertyForUi(item);
  }

  async function waitForSelectedClientContext() {
    if (!state.clienteContextoPromise) return true;
    await state.clienteContextoPromise;
    return true;
  }

  async function refreshClientContext(expectedClientId = "") {
    const clienteId = state.clienteSelecionado?.id;
    if (!clienteId) {
      state.consolidacaoCliente = null;
      state.complementos = [];
      state.reservasCliente = [];
      renderClientSelected();
      renderComplementos();
      renderHeroSummary();
      return true;
    }

    const payload = await api(endpoint(ENDPOINTS.clienteContexto, { id: clienteId }), "GET");
    const cliente = payload?.cliente;
    if (!cliente?.id) throw new Error("Cliente não encontrado.");
    if (expectedClientId && String(state.clienteSelecionado?.id || "") !== String(expectedClientId)) {
      return false;
    }

    state.clienteSelecionado = { ...cliente, id: String(cliente.id) };
    state.consolidacaoCliente = payload?.consolidacao || null;
    state.complementos = Array.isArray(payload?.complementos) ? payload.complementos : [];
    state.reservasCliente = Array.isArray(payload?.reservas_ativas) ? payload.reservas_ativas.map(normalizeReservationForUi) : [];
    syncClientInstallmentField();
    syncCashflowInstallmentFields();
    renderClientSelected();
    renderClientsList();
    renderComplementos();
    renderHeroSummary();
  }

  function applyClientContextPayload(payload) {
    if (!payload || typeof payload !== "object") return;

    const cliente = payload.cliente;
    if (cliente?.id) {
      state.clienteSelecionado = { ...state.clienteSelecionado, ...cliente, id: String(cliente.id) };
    }

    if (payload.consolidacao) {
      state.consolidacaoCliente = payload.consolidacao;
      syncClientInstallmentField();
      syncCashflowInstallmentFields();
    }

    if (Array.isArray(payload.complementos)) {
      state.complementos = payload.complementos;
    }

    if (Array.isArray(payload.reservas_ativas)) {
      state.reservasCliente = payload.reservas_ativas.map(normalizeReservationForUi);
    }

    renderClientSelected();
    renderComplementos();
    renderHeroSummary();
    return true;
  }

  async function loadComplementos() {
    await refreshClientContext();
  }

  async function focusPropertyCandidate(candidate, { silentFeedback = false, message = "", fetchDetails = true, promptSobrepreco = false } = {}) {
    const normalized = cloneSuggestionForCompare(candidate) || { id: "", imovel: normalizePropertyForUi(candidate) };
    const propertyId = normalized.id || normalized.imovel?.id;
    if (!propertyId) return;

    const previousId = String(state.imovelSelecionado?.id || "");
    const propertyChanged = previousId !== String(propertyId);
    if (fetchDetails) {
      try {
        const detalhado = await loadPropertyById(propertyId);
        state.imovelSelecionado = normalizePropertyForUi({ ...normalized.imovel, ...detalhado });
      } catch {
        state.imovelSelecionado = normalizePropertyForUi(normalized.imovel);
      }
    } else {
      state.imovelSelecionado = normalizePropertyForUi(normalized.imovel);
    }

      state.fotoAtivaIndice = 0;
      setValue(ids.valorImovel, formatMoney(parseMoney(state.imovelSelecionado.valor || 0)));
      applyPropertyTimelineDefaults();
      syncEntryOverflowToOverprice();

      if (propertyChanged) {
        clearSimulationPanels();
    }

    renderSuggestions();
    renderCompareTray();
    renderPropertyPreview();

    if (promptSobrepreco) {
      openSobreprecoModal({ imovel: state.imovelSelecionado, suggestion: normalized });
    }

    if (!silentFeedback) {
      showFeedback("info", message || "Unidade selecionada.");
    }
  }

  async function selectClientById(id) {
    const nextId = String(id || "");
    if (!nextId) return;

    const currentClientId = String(state.clienteSelecionado?.id || "");
    const cachedClient = state.clientes.find((cliente) => String(cliente.id || "") === nextId);

    state.clienteSelecionado = cachedClient ? { ...cachedClient, id: nextId } : { id: nextId };
    state.sugestões = [];
    state.sugestõesAvaliadas = 0;
    state.sugestoesRenderLimit = SUGGESTIONS_RENDER_BATCH;
    state.comparador = [];
    state.consolidacaoCliente = null;
    state.complementos = [];
    state.reservasCliente = [];
    state.clienteSelectorAberto = false;
    if (el.buscaCliente) el.buscaCliente.value = "";

    if (currentClientId && currentClientId !== nextId) {
      state.imovelSelecionado = null;
      state.fotoAtivaIndice = 0;
      setValue(ids.valorImovel, "");
    }
    if (currentClientId !== nextId) {
      state.escolhaImovelInicialMostrada = false;
      state.escolhaImovelInicialOpcoes = [];
    }

    renderCompareTray();
    clearSimulationPanels();
    if (currentClientId !== nextId) {
      resetSimulationFormFields();
      applyClientSimulationDefaults();
    }
    renderClientSelected();
    renderClientsList();
    renderComplementos();
    renderSuggestions();
    renderPropertyPreview();
    state.clienteContextoCarregando = true;
    const contextoPromise = (async () => {
      const applied = await refreshClientContext(nextId);
      if (!applied) return false;
      syncClientInstallmentField();
      renderSuggestions();
      renderPropertyPreview();
      return true;
    })();
    state.clienteContextoPromise = contextoPromise;
    updateActionButtons();
    try {
      const applied = await contextoPromise;
      if (applied) {
        showFeedback("success", "Cliente selecionado. Parcela do banco carregada do cadastro. Clique em Calcular.");
      }
    } finally {
      if (state.clienteContextoPromise === contextoPromise) {
        state.clienteContextoPromise = null;
        state.clienteContextoCarregando = false;
        updateActionButtons();
      }
    }
  }

  async function selectSuggestionById(id, { silentFeedback = false } = {}) {
    const suggestion = findSuggestionById(id);
    if (!suggestion) return;
    await focusPropertyCandidate(suggestion, {
      silentFeedback: true,
      message: "Unidade selecionada.",
      promptSobrepreco: true,
    });
    if (state.clienteSelecionado?.id && state.imovelSelecionado?.id) {
      await runCalculation({ silent: true });
      if (!silentFeedback) showFeedback("success", "Unidade selecionada e simulação recalculada automaticamente.");
      return;
    }
    if (!silentFeedback) showFeedback("info", "Unidade selecionada.");
  }

  async function focusComparedProperty(id) {
    const item = state.comparador.find((entry) => entry.id === String(id || ""));
    if (!item) return;
    await focusPropertyCandidate(item, {
      silentFeedback: true,
      message: "Unidade comparada selecionada.",
    });
    if (state.clienteSelecionado?.id && state.imovelSelecionado?.id) {
      await runCalculation({ silent: true });
      showFeedback("success", "Unidade comparada selecionada e simulação recalculada automaticamente.");
      return;
    }
    showFeedback("info", "Unidade comparada selecionada.");
  }

  async function applySuggestedEntryById(id) {
    const suggestion = findSuggestionById(id) || state.comparador.find((item) => item.id === String(id || ""));
    const ajuste = suggestion?.ajuste_entrada;
    if (!suggestion || !ajuste) {
      showFeedback("warning", "Essa unidade não tem entrada automática sugerida no momento.");
      return;
    }

    await focusPropertyCandidate(suggestion, { silentFeedback: true });
    setValue(ids.entrada, formatMoney(ajuste.entrada_sugerida || 0));
    const entradaAplicada = clampEntryToOperationLimit({ notify: true });
    await runCalculation({ silent: true });
    showFeedback("success", `Entrada ajustada para ${formatMoney(entradaAplicada)} e simulação recalculada.`);
  }

  async function runSuggestions({ silent = false, preserveSelection = true, source = "manual", limit = LIMITE_SUGESTOES_IMOVEIS } = {}) {
    await waitForSelectedClientContext();
    if (!ensureSelections(false)) return [];

    const parcelaCliente = normalizeClientInstallment({
      required: true,
      notify: !silent && source !== "filtro",
    });
    if (!parcelaCliente.valido) {
      state.sugestões = [];
      state.sugestõesAvaliadas = 0;
      state.melhorSugestaoId = "";
      state.sugestoesRenderLimit = SUGGESTIONS_RENDER_BATCH;
      renderSuggestions();
      renderHeroSummary();
      updateActionButtons();
      return [];
    }

    const previousId = preserveSelection ? String(state.imovelSelecionado?.id || "") : "";
    const requestLimit = Math.max(3, Math.min(LIMITE_SUGESTOES_IMOVEIS, Math.floor(toNumber(limit, LIMITE_SUGESTOES_IMOVEIS))));
    const loadingMessage = source === "cliente"
      ? "Carregando imóveis sugeridos para este cliente..."
      : source === "escolha-inicial"
        ? "Buscando três opções para iniciar a simulação..."
        : "Atualizando sugestões de imóveis...";
    renderSuggestionsLoading(loadingMessage);
    const body = {
      ...buildSimulationPayload(),
      cliente_id: state.clienteSelecionado.id,
      filtros: buildFiltersPayload(),
      incluir_indisponiveis: false,
      limite_sugestões: requestLimit,
    };

    delete body.imovel_id;

    const payload = await api(ENDPOINTS.sugerir, "POST", body);
    applyClientContextPayload(payload);
    const items = Array.isArray(payload?.sugestao?.items) ? payload.sugestao.items : [];
    state.melhorSugestaoId = String(payload?.sugestao?.melhor_match?.imovel?.id || payload?.sugestao?.melhor_match?.id || "");
    state.sugestões = items.map((item) => ({
      ...item,
      id: String(item?.imovel?.id || item?.id || ""),
      classificacao: item?.classificacao || item?.resumo_operacao?.status_comercial || item?.resumo_operacao?.status_simulacao || "",
      faixa_natural: Boolean(item?.faixa_natural),
      analise_comercial: item?.analise_comercial || null,
      imovel: normalizePropertyForUi(item?.imovel || {}),
      resumo_operacao: item?.resumo_operacao || {},
      ajuste_entrada: item?.ajuste_entrada || null,
      ajuste_fluxo_pre_obra: item?.ajuste_fluxo_pre_obra || item?.resumo_operacao?.sugestao_reforco_pre_obra || null,
    }));
    state.sugestõesAvaliadas = toNumber(payload?.sugestao?.quantidade_avaliada, state.sugestões.length);
    state.sugestoesRenderLimit = SUGGESTIONS_RENDER_BATCH;

    syncFilterListsFromSuggestions();
    syncComparadorWithSuggestions();
    renderSuggestions();
    renderCompareTray();
    renderHeroSummary();
    updateActionButtons();

    if (!state.sugestões.length) {
      state.melhorSugestaoId = "";
      if (!previousId) {
        state.imovelSelecionado = null;
        state.fotoAtivaIndice = 0;
        setValue(ids.valorImovel, "");
        renderPropertyPreview();
        clearSimulationPanels();
      } else {
        renderPropertyPreview();
      }

      if (!silent) {
        showFeedback("warning", "Nenhum imóvel apareceu nesse recorte. Ajuste os filtros ou os parâmetros da simulação.");
      }
      return [];
    }

    if (previousId) {
      const currentInSuggestions = state.sugestões.some((item) => String(item.imovel?.id || "") === previousId);
      if (currentInSuggestions) {
        renderSuggestions();
        renderPropertyPreview();
        if (!silent && source === "manual") {
          showFeedback("success", "Sugestões atualizadas.");
        }
        return state.sugestões;
      }

      if (preserveSelection && state.imovelSelecionado?.id) {
        renderSuggestions();
        renderPropertyPreview();
        if (!silent) {
          showFeedback("success", "Sugestões atualizadas. A unidade atual ficou fora do filtro, mas continua selecionada.");
        }
        return state.sugestões;
      }
    }

    if (!silent) {
      showFeedback("success", "Sugestões atualizadas. Escolha a unidade que deseja trabalhar.");
    }
    return state.sugestões;
  }

  function buildCalculationRequestBody() {
    return {
      ...buildSimulationPayload(),
      cliente_id: state.clienteSelecionado.id,
      imovel_id: state.imovelSelecionado.id,
      filtros: buildFiltersPayload(),
    };
  }

  function getCalculationRequestSignature(body) {
    try {
      return JSON.stringify(body);
    } catch (_) {
      return "";
    }
  }

  async function runCalculation({ silent = false, autoOpenNotifications = false } = {}) {
    if (!ensureSelections(true)) return;

    const hadSimulation = Boolean(state.simulacaoAtual);
    const inputVersionAtStart = state.simulacaoEntradaVersao;

    const parcelaCliente = normalizeClientInstallment({
      required: true,
      notify: !silent,
    });
    if (!parcelaCliente.valido) return;
    if (!validateCrediturIntervals({ notify: !silent })) return;

    const entregaAtual = resolvePropertyDelivery(state.imovelSelecionado);
    const mesesPreConfigurado = normalizePreDeliveryMonths(readValue(ids.mesesPre), entregaAtual.mesesPreEntrega);
    const mesesPosConfigurado = normalizePostDeliveryMonths(
      readValue(ids.mesesPos),
      getPreferredPostDeliveryMonths(mesesPreConfigurado),
      mesesPreConfigurado
    );
    const body = buildCalculationRequestBody();
    const requestSignatureAtStart = getCalculationRequestSignature(body);

    const payload = await api(ENDPOINTS.calcular, "POST", body);
    const currentRequestSignature = getCalculationRequestSignature(buildCalculationRequestBody());
    if (inputVersionAtStart !== state.simulacaoEntradaVersao && currentRequestSignature !== requestSignatureAtStart) {
      state.simulacaoRecalculoPendente = true;
      return false;
    }
    state.simulacaoRecalculoAssinaturaAplicada = requestSignatureAtStart;
    state.simulacaoAtual = payload?.resultado || null;
    state.simulacaoSalvaId = "";
    const resumoCalculado = state.simulacaoAtual?.resumo_operacao || {};
    const imovelCalculado = payload?.imovel?.id ? payload.imovel : state.simulacaoAtual?.imovel;
    const mesesPosEfetivo = normalizePostDeliveryMonths(
      firstFilled(
        resumoCalculado.meses_pos_entrega,
        imovelCalculado?.meses_pos_entrega,
        mesesPosConfigurado
      ),
      mesesPosConfigurado,
      firstFilled(resumoCalculado.meses_pre_entrega, imovelCalculado?.meses_pre_entrega, mesesPreConfigurado)
    );
    const mesesPosConfiguradoRetornado = normalizePostDeliveryMonths(
      firstFilled(
        resumoCalculado.meses_pos_entrega_configurado,
        imovelCalculado?.meses_pos_entrega_configurado,
        mesesPosConfigurado
      ),
      mesesPosConfigurado,
      firstFilled(resumoCalculado.meses_pre_entrega, imovelCalculado?.meses_pre_entrega, mesesPreConfigurado)
    );

    if (imovelCalculado?.id) {
      state.imovelSelecionado = normalizePropertyForUi({
        ...state.imovelSelecionado,
        ...imovelCalculado,
        meses_pos_entrega: mesesPosEfetivo,
        meses_pos_entrega_configurado: firstFilled(
          imovelCalculado?.meses_pos_entrega_configurado,
          resumoCalculado.meses_pos_entrega_configurado,
          mesesPosConfiguradoRetornado
        ),
      });
      setValue(ids.valorImovel, formatMoney(parseMoney(state.imovelSelecionado.valor || 0)));
      setValue(ids.financiamento, formatMoney(parseMoney(firstFilled(resumoCalculado.financiamento_caixa, body.financiamento_caixa, 0))));
      setValue(ids.parcelaBanco, formatMoney(parseMoney(firstFilled(resumoCalculado.parcela_financiamento_banco, body.parcela_financiamento_banco, 0))));
      setValue(ids.mesesPre, String(firstFilled(resumoCalculado.meses_pre_entrega, imovelCalculado?.meses_pre_entrega, mesesPreConfigurado)));
      setValue(ids.mesesPos, String(mesesPosConfiguradoRetornado));
      syncPostDeliveryFieldConstraints();
      renderPropertyPreview();
    }

    if (!state.simulacaoAtual) {
      throw new Error("Não foi possível calcular a simulação.");
    }

    // A resposta do calculo nao deve reescrever a curva manual Creditur/7LM.

    const currentSuggestion = getSelectedSuggestion();
    if (currentSuggestion) {
      currentSuggestion.resumo_operacao = { ...(currentSuggestion.resumo_operacao || {}), ...(state.simulacaoAtual.resumo_operacao || {}) };
      currentSuggestion.classificacao = state.simulacaoAtual.resumo_operacao?.status_comercial || state.simulacaoAtual.resumo_operacao?.status_simulacao || currentSuggestion.classificacao;
    }

    const compareItem = state.comparador.find((item) => item.id === String(state.imovelSelecionado?.id || ""));
    if (compareItem) {
      compareItem.resumo_operacao = { ...(compareItem.resumo_operacao || {}), ...(state.simulacaoAtual.resumo_operacao || {}) };
      compareItem.classificacao = state.simulacaoAtual.resumo_operacao?.status_comercial || state.simulacaoAtual.resumo_operacao?.status_simulacao || compareItem.classificacao;
    }

    renderSuggestions();
    renderCompareTray();
    renderPropertyPreview();
    renderSummaryFromResult(state.simulacaoAtual, { autoOpenNotifications });
    renderHeroSummary();
    updateActionButtons();
    scheduleSimulationAutosave();
    if (!silent) {
      const actionLabel = hadSimulation ? "Simulação recalculada." : "Simulação calculada.";
      showFeedback("success", actionLabel);
    }
    return true;
  }

  async function runPrimaryCalculation() {
      await waitForSelectedClientContext();
      if (!ensureSelections(false)) return;

      const shouldOfferInitialChoice = !state.escolhaImovelInicialMostrada;
      if (shouldOfferInitialChoice) {
        const initialSuggestions = await runSuggestions({
          silent: true,
          preserveSelection: false,
          source: "escolha-inicial",
          limit: LIMITE_SUGESTOES_ESCOLHA_INICIAL,
        });
        const initialOptions = buildInitialPropertyChoiceOptions(
          initialSuggestions.length ? initialSuggestions : getInitialChoiceSourceSuggestions()
        );
        if (openInitialPropertyChoiceModal(initialOptions)) {
          showFeedback("info", "Escolha uma das opções sugeridas para iniciar a simulação.");
          return;
        }
        showFeedback("warning", "Não foi possível montar as opções iniciais de imóvel. Ajuste os filtros ou atualize a vitrine.");
        return;
      }

      if (state.imovelSelecionado?.id) {
        await runCalculation();
        return;
      }

      await runSuggestions({ silent: true, preserveSelection: false, source: "manual" });

      const melhorIdeal = getBestIdealSuggestion();
      if (!melhorIdeal) {
        state.imovelSelecionado = null;
        state.fotoAtivaIndice = 0;
        setValue(ids.valorImovel, "");
        renderSuggestions();
        renderPropertyPreview();
        clearSimulationPanels();
        updateActionButtons();
        showFeedback("info", "Nenhum imóvel ideal apareceu para esse cliente. A vitrine foi atualizada sem seleção automática.");
        return;
      }

      await focusPropertyCandidate(melhorIdeal, { silentFeedback: true, message: "" });
      if (!state.imovelSelecionado?.id) {
        state.imovelSelecionado = normalizePropertyForUi(melhorIdeal.imovel || melhorIdeal);
        state.fotoAtivaIndice = 0;
        setValue(ids.valorImovel, formatMoney(parseMoney(state.imovelSelecionado?.valor || 0)));
        applyPropertyTimelineDefaults();
        renderSuggestions();
        renderPropertyPreview();
      }
      await runCalculation({ silent: true });
      if (!state.imovelSelecionado?.id) {
        await focusPropertyCandidate(melhorIdeal, { silentFeedback: true, message: "", fetchDetails: false });
      }
      showFeedback("success", `Maior imóvel ideal selecionado automaticamente: ${melhorIdeal.imovel?.titulo || "Unidade"}.`);
    }

  function canAutoSaveSimulation() {
    return Boolean(state.clienteSelecionado?.id && state.imovelSelecionado?.id && state.simulacaoAtual);
  }

  function buildAutosaveRequestBody() {
    const body = {
      ...buildSimulationPayload(),
      cliente_id: state.clienteSelecionado.id,
      imovel_id: state.imovelSelecionado.id,
      filtros: buildFiltersPayload(),
      payload_snapshot_extra: {
        cliente_nome: state.clienteSelecionado.nome_completo,
        imovel_titulo: state.imovelSelecionado.titulo,
        origem_salvamento: "automatico",
      },
    };
    const draftId = state.simulacaoAutosaveId || state.simulacaoSalvaId;
    if (draftId) body.simulacao_id = draftId;
    return body;
  }

  function getAutosaveRequestSignature(body) {
    try {
      return JSON.stringify(body);
    } catch (_) {
      return "";
    }
  }

  function scheduleSimulationAutosave(delay = AUTO_SAVE_IDLE_MS) {
    if (!canAutoSaveSimulation()) return;
    clearTimeout(state.simulacaoAutosaveTimer);
    state.simulacaoAutosaveTimer = setTimeout(() => {
      runSimulationAutosave().catch((error) => {
        console.warn("Não foi possível salvar automaticamente a simulação.", error);
      });
    }, delay);
  }

  async function runSimulationAutosave() {
    if (!canAutoSaveSimulation()) return;
    if (state.acaoEmAndamento || state.simulacaoRecalculoEmAndamento) {
      scheduleSimulationAutosave(AUTO_SAVE_IDLE_MS);
      return;
    }

    const body = buildAutosaveRequestBody();
    const requestSignature = getAutosaveRequestSignature(body);
    if (!requestSignature || requestSignature === state.simulacaoAutosaveAssinaturaSalva) return;

    if (state.simulacaoAutosaveEmAndamento) {
      if (state.simulacaoAutosaveAssinaturaEmAndamento !== requestSignature) {
        state.simulacaoAutosavePendente = true;
      }
      return;
    }

    state.simulacaoAutosaveEmAndamento = true;
    state.simulacaoAutosaveAssinaturaEmAndamento = requestSignature;
    try {
      const payload = await api(ENDPOINTS.autosalvar, "POST", body);
      const item = payload?.item;
      if (!item?.id) return;
      state.simulacaoAutosaveId = item.id;
      state.simulacaoSalvaId = item.id;
      state.simulacaoAutosaveAssinaturaSalva = getAutosaveRequestSignature(buildAutosaveRequestBody());
      updateActionButtons();
    } catch (error) {
      console.warn("Não foi possível salvar automaticamente a simulação.", error);
    } finally {
      state.simulacaoAutosaveEmAndamento = false;
      if (state.simulacaoAutosaveAssinaturaEmAndamento === requestSignature) {
        state.simulacaoAutosaveAssinaturaEmAndamento = "";
      }
      if (state.simulacaoAutosavePendente) {
        state.simulacaoAutosavePendente = false;
        scheduleSimulationAutosave(AUTO_SAVE_IDLE_MS);
      }
    }
  }

  async function saveSimulation(options = {}) {
    if (!ensureActionSelections(true)) return "";

    const body = {
      ...buildSimulationPayload(),
      cliente_id: state.clienteSelecionado.id,
      imovel_id: state.imovelSelecionado.id,
      filtros: buildFiltersPayload(),
      payload_snapshot_extra: {
        cliente_nome: state.clienteSelecionado.nome_completo,
        imovel_titulo: state.imovelSelecionado.titulo,
      },
    };

    const payload = await api(ENDPOINTS.salvar, "POST", body);
    const item = payload?.item;

    if (!item?.id) {
      throw new Error("Simulação salva sem identificador válido.");
    }

    state.simulacaoSalvaId = item.id;
    state.simulacaoAutosaveId = item.id;
    state.simulacaoAutosaveAssinaturaSalva = getAutosaveRequestSignature(buildAutosaveRequestBody());
    if (payload?.reserva || payload?.status_imovel) {
      state.imovelSelecionado = normalizePropertyForUi({
        ...state.imovelSelecionado,
        status: payload?.status_imovel || state.imovelSelecionado?.status,
        reserva_ativa: payload?.reserva || state.imovelSelecionado?.reserva_ativa,
      });
      const targetId = String(state.imovelSelecionado?.id || "");
      if (targetId) {
        state.sugestões = state.sugestões.map((sugestao) => {
          if (String(sugestao.imovel?.id || "") !== targetId) return sugestao;
          return {
            ...sugestao,
            imovel: normalizePropertyForUi({
              ...sugestao.imovel,
              status: state.imovelSelecionado.status,
              reserva_ativa: state.imovelSelecionado.reserva_ativa,
            }),
          };
        });
        state.comparador = state.comparador.map((itemComparado) => {
          if (String(itemComparado.id || "") !== targetId) return itemComparado;
          return {
            ...itemComparado,
            imovel: normalizePropertyForUi({
              ...(itemComparado.imovel || {}),
              status: state.imovelSelecionado.status,
              reserva_ativa: state.imovelSelecionado.reserva_ativa,
            }),
          };
        });
      }
      renderSuggestions();
      renderCompareTray();
      renderPropertyPreview();
      renderHeroSummary();
    }
    updateActionButtons();
    if (!options.silent) {
      showActionMessage("success", "Simulação salva com sucesso.");
    }
    return item.id;
  }

  function mergePropertyEverywhere(property) {
    const normalized = normalizePropertyForUi(property);
    const targetId = String(normalized.id || "");
    if (!targetId) return;

    state.sugestões = state.sugestões.map((item) => {
      if (String(item.imovel?.id || "") !== targetId) return item;
      return { ...item, imovel: normalizePropertyForUi({ ...item.imovel, ...normalized }) };
    });

    state.comparador = state.comparador.map((item) => {
      if (String(item.id || "") !== targetId) return item;
      return { ...item, imovel: normalizePropertyForUi({ ...item.imovel, ...normalized }) };
    });

    if (String(state.imovelSelecionado?.id || "") === targetId) {
      state.imovelSelecionado = normalizePropertyForUi({ ...state.imovelSelecionado, ...normalized });
      applyPropertyTimelineDefaults();
    }
  }

  async function refreshPropertyAfterOperation(propertyId) {
    const targetId = String(propertyId || "");
    if (!targetId) return;

    try {
      const detalhado = await loadPropertyById(targetId);
      mergePropertyEverywhere(detalhado);
    } catch {
      // Mantém o estado atual se o detalhe não puder ser recarregado.
    }

    if (state.clienteSelecionado?.id) {
      try {
        await refreshClientContext();
      } catch {
        // Não interrompe a experiência se o contexto falhar.
      }

      try {
        await runSuggestions({ silent: true, preserveSelection: true, source: "acao" });
      } catch {
        renderSuggestions();
      }
    } else {
      renderSuggestions();
    }

    renderCompareTray();
    renderPropertyPreview();
    renderHeroSummary();
  }

  async function ensureSimulationSaved(actionLabel) {
    if (state.simulacaoSalvaId) return state.simulacaoSalvaId;
    showActionMessage("info", `Salvando a simulação antes de ${actionLabel}.`);
    return saveSimulation({ silent: true });
  }

  async function reserveProperty() {
    if (!ensureActionSelections(true)) return;

    const statusAtual = normalizeStatus(state.imovelSelecionado?.status);
    const reserva = getReservationForProperty(state.imovelSelecionado);
    const analiseAprovação = getCurrentApprovalException();
    if (isPendingApprovalProperty(state.imovelSelecionado)) {
      showActionMessage(
        "info",
        reserva
          ? `${reservationTitle(reserva)}. ${reservationSummary(reserva) || "A solicitação já foi enviada para o gestor."}`
          : "Essa unidade já está aguardando decisão do gestor."
      );
      return;
    }
    if (statusAtual === "reservado") {
      showActionMessage(
        "info",
        reserva ? `${reservationTitle(reserva)}. ${reservationSummary(reserva) || "A reserva ativa já foi registrada para esta unidade."}` : "Essa unidade já está reservada."
      );
      return;
    }
    if (["vendido", "inativo"].includes(statusAtual)) {
      showActionMessage("warning", "Essa unidade não pode ser reservada no status atual.");
      return;
    }
    if (needsApprovalException(analiseAprovação)) {
      showActionMessage(
        "warning",
        firstFilled(
          analiseAprovação?.mensagem,
          "Esta operação precisa ser enviada para aprovação de venda antes de qualquer reserva."
        )
      );
      return;
    }

    await ensureSimulationSaved("reservar o imóvel");

    const body = {
      cliente_id: state.clienteSelecionado?.id || null,
      simulacao_id: state.simulacaoSalvaId,
      observacoes: readValue(ids.observacoes) || null,
    };

    const resposta = await api(endpoint(ENDPOINTS.reservar, { id: state.imovelSelecionado.id }), "POST", body);
    await refreshPropertyAfterOperation(state.imovelSelecionado.id);
    setPropertyStatus("Unidade reservada");
    updateActionButtons();
    showActionMessage("success", firstFilled(resposta?.mensagem, "Imóvel reservado."));
  }

  async function submitApprovalRequest() {
    if (!ensureActionSelections(true)) return;

    const statusAtual = normalizeStatus(state.imovelSelecionado?.status);
    const reserva = getReservationForProperty(state.imovelSelecionado);
    const analiseAprovação = getCurrentApprovalException();
    if (isPendingApprovalProperty(state.imovelSelecionado)) {
      showActionMessage(
        "info",
        reserva
          ? `${reservationTitle(reserva)}. ${reservationSummary(reserva) || "A solicitação já foi enviada para o gestor."}`
          : "Essa unidade já está aguardando decisão do gestor."
      );
      return;
    }
    const bloqueadoParaClienteAtual = statusAtual === "reservado" && isReservationForSelectedClient(reserva);
    if (statusAtual !== "disponivel" && !bloqueadoParaClienteAtual) {
      showActionMessage("warning", "A aprovação de venda só pode ser solicitada para imóvel disponível ou bloqueado para este cliente.");
      return;
    }
    if (!canSubmitApprovalException(analiseAprovação)) {
      showActionMessage(
        "warning",
        firstFilled(
          analiseAprovação?.mensagem,
          "A operação atual não está dentro da faixa permitida para aprovação gerencial."
        )
      );
      return;
    }

    await ensureSimulationSaved("solicitar aprovação de venda");

    const body = {
      cliente_id: state.clienteSelecionado?.id || null,
      simulacao_id: state.simulacaoSalvaId,
      observacoes: readValue(ids.observacoes) || null,
    };

    const resposta = await api(endpoint(ENDPOINTS.submeterAprovação, { id: state.imovelSelecionado.id }), "POST", body);
    state.imovelSelecionado.status = resposta?.status_imovel || "Pendente de aprovação";
    state.imovelSelecionado.reserva = resposta?.reserva || state.imovelSelecionado.reserva;
    await refreshPropertyAfterOperation(state.imovelSelecionado.id);
    setPropertyStatus("Solicitação enviada para aprovação");
    updateActionButtons();
    showActionMessage("success", firstFilled(resposta?.mensagem, "Solicitação enviada para aprovação do gestor."));
  }

  async function sellProperty() {
    if (!ensureActionSelections(true)) return;

    const statusAtual = normalizeStatus(state.imovelSelecionado?.status);
    const reserva = getReservationForProperty(state.imovelSelecionado);
    const analiseAprovação = getCurrentApprovalException();
    if (["vendido", "inativo"].includes(statusAtual)) {
      showActionMessage("warning", "Essa unidade não pode ser vendida no status atual.");
      return;
    }
    if (isPendingApprovalProperty(state.imovelSelecionado)) {
      showActionMessage("warning", "Essa unidade ainda depende da decisão do gestor antes da venda.");
      return;
    }
    if (needsApprovalException(analiseAprovação)) {
      showActionMessage(
        "warning",
        canSubmitApprovalException(analiseAprovação)
          ? "Essa operação precisa passar pela aprovação do gestor antes da venda. Use o envio para aprovação."
          : firstFilled(analiseAprovação?.mensagem, "A operação ainda não pode seguir para venda.")
      );
      return;
    }
    if (reserva?.cliente_id && !isReservationForSelectedClient(reserva)) {
      showActionMessage("warning", `Essa unidade está vinculada a ${firstFilled(reserva?.cliente?.nome_completo, "outro cliente")}.`);
      return;
    }

    await ensureSimulationSaved("vender o imóvel");

    const body = {
      cliente_id: state.clienteSelecionado?.id || null,
      simulacao_id: state.simulacaoSalvaId,
      observacoes: readValue(ids.observacoes) || null,
    };

    const resposta = await api(endpoint(ENDPOINTS.vender, { id: state.imovelSelecionado.id }), "POST", body);
    await refreshPropertyAfterOperation(state.imovelSelecionado.id);
    setPropertyStatus("Unidade vendida");
    updateActionButtons();
    showActionMessage("success", firstFilled(resposta?.mensagem, "Venda concluída."));
  }

  async function releaseReserve() {
    if (!ensureActionSelections(true)) return;

    const statusAtual = normalizeStatus(state.imovelSelecionado?.status);
    if (statusAtual !== "reservado" && !isPendingApprovalProperty(state.imovelSelecionado)) {
      showActionMessage("info", "Essa unidade não possui reserva ativa para ser liberada.");
      return;
    }

    const body = {
      observacoes: readValue(ids.observacoes) || null,
    };

    const resposta = await api(endpoint(ENDPOINTS.liberar, { id: state.imovelSelecionado.id }), "POST", body);
    await refreshPropertyAfterOperation(state.imovelSelecionado.id);
    setPropertyStatus("Reserva liberada");
    updateActionButtons();
    showActionMessage("success", firstFilled(resposta?.mensagem, "Reserva liberada."));
  }

  function resetSimulation() {
    state.imovelSelecionado = null;
    state.simulacaoAtual = null;
    state.simulacaoSalvaId = "";
    resetSimulationAutosaveState();
    state.comparador = [];
    state.fotoAtivaIndice = 0;
    state.escolhaImovelInicialMostrada = false;
    state.escolhaImovelInicialOpcoes = [];
    closeEscolhaImovelModal();

    renderCompareTray();
    renderSuggestions();
    renderPropertyPreview();
    clearSimulationPanels();

    setValue(ids.valorImovel, "");
    resetSimulationFormFields();
    syncClientLockedMoneyFields();
    syncClientInstallmentField();

    updateActionButtons();
    showActionMessage("info", state.clienteSelecionado ? "Simulação limpa. Selecione outro imóvel ou ajuste os filtros." : "Simulação reiniciada.");
  }

  function openComplementoModal(editId = "") {
    if (!state.clienteSelecionado) {
      showFeedback("warning", "Selecione o cliente antes de adicionar complemento de renda.");
      return;
    }

    state.complementoEdicaoId = editId;
    showComplementoFeedback("info", "");

    if (!editId) {
      el.formComplemento?.reset();
      if (el.complementoTitulo) el.complementoTitulo.textContent = "Novo complemento";
      setValue("simComplementoAtivo", "true");
    } else {
      const item = state.complementos.find((complemento) => String(complemento.id) === String(editId));
      if (!item) return;
      if (el.complementoTitulo) el.complementoTitulo.textContent = "Editar complemento";
      if (el.inputComplementoNome) el.inputComplementoNome.value = item.nome || "";
      if (el.inputComplementoCpf) el.inputComplementoCpf.value = formatCpf(item.cpf || "");
      if (el.inputComplementoParentesco) el.inputComplementoParentesco.value = item.parentesco || "";
      if (el.inputComplementoRenda) el.inputComplementoRenda.value = formatMoney(parseMoney(item.renda || 0));
      setValue("simComplementoAtivo", item.incluir_na_analise ? "true" : "false");
    }

    if (!el.modalComplemento) return;
    el.modalComplemento.hidden = false;
    el.modalComplemento.setAttribute("aria-hidden", "false");
    syncModalLock();
    setTimeout(() => el.inputComplementoNome?.focus(), 0);
  }

  function closeComplementoModal() {
    if (!el.modalComplemento) return;
    closeSelectPanels();
    el.modalComplemento.hidden = true;
    el.modalComplemento.setAttribute("aria-hidden", "true");
    syncModalLock();
    state.complementoEdicaoId = "";
  }

  function buildComplementoPayload(item, overrides = {}) {
    return {
      nome: item.nome,
      cpf: digitsOnly(item.cpf || ""),
      parentesco: item.parentesco || null,
      renda: parseMoney(item.renda || 0),
      incluir_na_analise: item.incluir_na_analise !== false,
      compoe_renda: item.compoe_renda !== false,
      incluir_na_composicao_financeira: item.incluir_na_composicao_financeira !== false,
      ativo: item.ativo !== false,
      ...overrides,
    };
  }

  async function syncAfterComplementUpdate(message) {
    await loadComplementos();
    await runSuggestions({ silent: true, preserveSelection: true, source: "complemento" });
    if (state.imovelSelecionado?.id) {
      try {
        await runCalculation({ silent: true });
      } catch {
        // Se a simulacao não recalcular, a vitrine continua atualizada.
      }
    }
    showFeedback("success", message);
  }

  async function saveComplemento(event) {
    event.preventDefault();

    if (!state.clienteSelecionado?.id) return;

    const nome = String(el.inputComplementoNome?.value || "").trim();
    const cpf = digitsOnly(el.inputComplementoCpf?.value || "");
    const renda = parseMoney(el.inputComplementoRenda?.value || "");

    if (nome.length < 3) {
      showComplementoFeedback("error", "Informe o nome completo do complemento.");
      return;
    }
    if (cpf.length !== 11) {
      showComplementoFeedback("error", "Informe um CPF válido com 11 dígitos.");
      return;
    }
    if (renda <= 0) {
      showComplementoFeedback("error", "Informe uma renda maior que zero.");
      return;
    }

    const complementoAtual = state.complementoEdicaoId
      ? state.complementos.find((item) => String(item.id) === String(state.complementoEdicaoId))
      : null;

    const body = {
      nome,
      cpf,
      parentesco: String(el.inputComplementoParentesco?.value || "").trim() || null,
      renda,
      incluir_na_analise: String(el.inputComplementoAtivo?.value || "true") === "true",
      compoe_renda: complementoAtual ? complementoAtual.compoe_renda !== false : true,
      incluir_na_composicao_financeira: complementoAtual ? complementoAtual.incluir_na_composicao_financeira !== false : true,
      ativo: complementoAtual ? complementoAtual.ativo !== false : true,
    };

    try {
      if (state.complementoEdicaoId) {
        await api(
          endpoint(ENDPOINTS.complementoPorId, {
            id: state.clienteSelecionado.id,
            complementoId: state.complementoEdicaoId,
          }),
          "PUT",
          body
        );
      } else {
        await api(endpoint(ENDPOINTS.complementos, { id: state.clienteSelecionado.id }), "POST", body);
      }

      closeComplementoModal();
      await syncAfterComplementUpdate("Complemento salvo com sucesso.");
    } catch (error) {
      showComplementoFeedback("error", messageFromError(error, "Não foi possível salvar o complemento."));
    }
  }

  async function toggleComplemento(id) {
    const item = state.complementos.find((complemento) => String(complemento.id) === String(id));
    if (!item) return;

    await api(
      endpoint(ENDPOINTS.complementoPorId, { id: state.clienteSelecionado.id, complementoId: id }),
      "PUT",
      buildComplementoPayload(item, { incluir_na_analise: !(item.incluir_na_analise !== false) })
    );
    await syncAfterComplementUpdate("Análise do complemento atualizada.");
  }

  async function toggleComplementoRenda(id) {
    const item = state.complementos.find((complemento) => String(complemento.id) === String(id));
    if (!item) return;

    await api(
      endpoint(ENDPOINTS.complementoPorId, { id: state.clienteSelecionado.id, complementoId: id }),
      "PUT",
      buildComplementoPayload(item, { compoe_renda: !(item.compoe_renda !== false) })
    );
    await syncAfterComplementUpdate("Complemento atualizado na composição de renda.");
  }

  async function toggleComplementoFinanceira(id) {
    const item = state.complementos.find((complemento) => String(complemento.id) === String(id));
    if (!item) return;

    await api(
      endpoint(ENDPOINTS.complementoPorId, { id: state.clienteSelecionado.id, complementoId: id }),
      "PUT",
      buildComplementoPayload(item, { incluir_na_composicao_financeira: !(item.incluir_na_composicao_financeira !== false) })
    );
    await syncAfterComplementUpdate("Complemento atualizado na composição financeira.");
  }

  async function deleteComplemento(id) {
    if (!window.confirm("Deseja excluir este complemento de renda?")) return;
    await api(endpoint(ENDPOINTS.complementoPorId, { id: state.clienteSelecionado.id, complementoId: id }), "DELETE");
    await syncAfterComplementUpdate("Complemento removido com sucesso.");
  }

  function applyInputMasks() {
    [ids.filtroPrecoMin, ids.filtroPrecoMax, ids.financiamento, ids.parcelaBanco, ids.fgts, ids.subsidio, ids.chequeMoradia, ids.entrada, ids.sobrepreco, ids.descontoImovel, ids.preObraValor, ids.posObraValor, ids.intermediariaValor, ids.anualValor, ids.semestralValor, ids.reforcoValor]
      .forEach((id) => {
        const field = document.getElementById(id);
        if (!field) return;

        field.setAttribute("inputmode", "decimal");
        field.setAttribute("autocomplete", "off");

        field.addEventListener("input", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLInputElement)) return;
          if (target.readOnly) return;
          formatMoneyTypingValue(target);
          if (id === ids.entrada) {
            clampEntryToOperationLimit({ notify: true });
          }
          if (id === ids.sobrepreco) {
            field.dataset.autoOverflow = "0";
            clampEntryToOperationLimit();
          }
          if (id === ids.descontoImovel) {
            normalizePropertyDiscount({ notify: true, preserveCaret: true });
          }
          if (id === ids.entrada || id === ids.sobrepreco || id === ids.descontoImovel) {
            syncNegotiatedValueField();
            renderPropertyPreview();
          }
          if (simulationRecalcFieldIds.has(id)) {
            scheduleSimulationRecalculation();
          }
        });

        field.addEventListener("blur", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLInputElement)) return;
          if (id === ids.parcelaBanco) {
            normalizeClientInstallment();
          }
          if (id === ids.entrada || id === ids.sobrepreco) {
            if (id === ids.sobrepreco) {
              target.dataset.autoOverflow = "0";
            }
            clampEntryToOperationLimit({ notify: id === ids.entrada });
          }
          if (id === ids.descontoImovel) {
            normalizePropertyDiscount({ notify: true });
          }
          if (id === ids.entrada || id === ids.sobrepreco || id === ids.descontoImovel) {
            syncNegotiatedValueField();
            renderPropertyPreview();
          }
          if (id === ids.preObraValor || id === ids.posObraValor) {
            normalizeCashflowInstallment(id, { notify: true });
          }
          if (minimumInstallmentFieldIds.has(id)) {
            normalizeMinimumInstallmentField(id, { notify: true });
          }
          target.value = formatMoneyOrBlank(target.value);
          if (simulationRecalcFieldIds.has(id)) {
            scheduleSimulationRecalculation(120);
          }
        });

        field.addEventListener("focus", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLInputElement)) return;
          if (target.readOnly) {
            placeMoneyCaret(target);
            return;
          }
          target.value = formatMoneyEditingValue(target.value);
          selectAllText(target);
        });
      });

    [
      ids.mesesPre,
      ids.mesesPos,
      ids.intermediariaQtd,
      ids.anualQtd,
      ids.semestralQtd,
      ids.reforcoQtd,
      ids.filtroAreaMin,
      ids.filtroAreaMax,
    ].forEach((id) => {
      const field = document.getElementById(id);
      if (!field) return;
      field.setAttribute("inputmode", "numeric");
      field.setAttribute("autocomplete", "off");
    });

    el.inputComplementoCpf?.setAttribute("inputmode", "numeric");
    el.inputComplementoCpf?.setAttribute("autocomplete", "off");

    el.inputComplementoRenda?.setAttribute("inputmode", "decimal");
    el.inputComplementoRenda?.setAttribute("autocomplete", "off");

    el.inputComplementoRenda?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      target.value = sanitizeMoneyEditingValue(target.value);
    });

    el.inputComplementoRenda?.addEventListener("blur", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      target.value = formatMoneyOrBlank(target.value);
    });

    el.inputComplementoRenda?.addEventListener("focus", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      target.setAttribute("inputmode", "decimal");
      target.value = toEditableMoneyValue(target.value);
      selectAllText(target);
    });

    el.inputComplementoCpf?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      target.value = formatCpf(target.value);
    });
  }

  function scheduleSuggestionsRefresh() {
    if (!state.clienteSelecionado?.id) return;
    clearTimeout(state.buscaSugestoesTimer);
    state.buscaSugestoesTimer = setTimeout(() => {
      runSuggestions({ silent: true, preserveSelection: true, source: "filtro" }).catch((error) => {
        showFeedback("error", messageFromError(error, "Não foi possível atualizar a vitrine."));
      });
    }, 380);
  }

  function scheduleSuggestionsUiRender(delay = 120) {
    clearTimeout(state.sugestoesUiTimer);
    state.sugestoesUiTimer = setTimeout(() => {
      renderSuggestions();
      renderHeroSummary();
    }, delay);
  }

  function refreshLocalSuggestionFilters() {
    state.sugestoesRenderLimit = SUGGESTIONS_RENDER_BATCH;
    renderSuggestions();
    renderHeroSummary();
  }

  function canAutoRecalculateSimulation() {
    return Boolean(state.clienteSelecionado?.id && state.imovelSelecionado?.id && state.simulacaoAtual);
  }

  function markSimulationInputChanged() {
    state.simulacaoEntradaVersao += 1;
    if (state.simulacaoAtual) {
      state.simulacaoSalvaId = "";
      state.simulacaoAutosaveAssinaturaSalva = "";
    }
  }

  function scheduleSimulationRecalculation(delay = AUTO_RECALCULATION_IDLE_MS, { markDirty = true } = {}) {
    if (markDirty) markSimulationInputChanged();
    if (!canAutoRecalculateSimulation()) return;
    clearTimeout(state.simulacaoRecalculoTimer);
    state.simulacaoRecalculoTimer = setTimeout(() => {
      runAutomaticSimulationRecalculation().catch((error) => {
        showFeedback("warning", messageFromError(error, "Não foi possível recalcular automaticamente. Clique em Recalcular."));
      });
    }, delay);
  }

  async function runAutomaticSimulationRecalculation() {
    if (!canAutoRecalculateSimulation()) return;
    if (state.acaoEmAndamento) {
      scheduleSimulationRecalculation(AUTO_RECALCULATION_IDLE_MS, { markDirty: false });
      return;
    }
    const currentRequestSignature = getCalculationRequestSignature(buildCalculationRequestBody());
    if (state.simulacaoRecalculoEmAndamento) {
      if (state.simulacaoRecalculoAssinaturaEmAndamento !== currentRequestSignature) {
        state.simulacaoRecalculoPendente = true;
      }
      return;
    }
    if (state.simulacaoRecalculoAssinaturaAplicada === currentRequestSignature) {
      return;
    }
    if (state.simulacaoRecalculoVersaoAplicada === state.simulacaoEntradaVersao) {
      return;
    }

    const inputVersionAtAutomaticStart = state.simulacaoEntradaVersao;
    state.simulacaoRecalculoEmAndamento = true;
    state.simulacaoRecalculoVersaoEmAndamento = inputVersionAtAutomaticStart;
    state.simulacaoRecalculoAssinaturaEmAndamento = currentRequestSignature;
    try {
      const calculationApplied = await runCalculation({ silent: true });
      if (calculationApplied !== false && state.simulacaoEntradaVersao === inputVersionAtAutomaticStart) {
        state.simulacaoRecalculoVersaoAplicada = inputVersionAtAutomaticStart;
        state.simulacaoRecalculoAssinaturaAplicada = currentRequestSignature;
      }
    } finally {
      state.simulacaoRecalculoEmAndamento = false;
      if (state.simulacaoRecalculoVersaoEmAndamento === inputVersionAtAutomaticStart) {
        state.simulacaoRecalculoVersaoEmAndamento = null;
      }
      if (state.simulacaoRecalculoAssinaturaEmAndamento === currentRequestSignature) {
        state.simulacaoRecalculoAssinaturaEmAndamento = "";
      }
      if (state.simulacaoRecalculoPendente) {
        state.simulacaoRecalculoPendente = false;
        if (state.simulacaoEntradaVersao !== inputVersionAtAutomaticStart) {
          scheduleSimulationRecalculation(AUTO_RECALCULATION_IDLE_MS, { markDirty: false });
        }
      }
    }
  }

  function bindEvents() {
    const handleSugerirClick = () => runAction("sugerir", async () => {
      try {
        await runSuggestions();
      } catch (error) {
        showFeedback("error", messageFromError(error, "Não foi possível atualizar a vitrine."));
      }
    });
    const handleCalcularClick = () => runAction("calcular", async () => {
      try {
        await runPrimaryCalculation();
      } catch (error) {
        showFeedback("error", messageFromError(error, "Não foi possível calcular a simulação."));
      }
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const calcularButton = target.closest("#btnCalcularSimulacao");
      if (calcularButton) {
        event.preventDefault();
        if (calcularButton instanceof HTMLButtonElement && calcularButton.disabled) return;
        handleCalcularClick();
        return;
      }

      const sugerirButton = target.closest("#btnSugerirImoveis");
      if (sugerirButton) {
        event.preventDefault();
        if (sugerirButton instanceof HTMLButtonElement && sugerirButton.disabled) return;
        handleSugerirClick();
      }
    });

    el.clienteSelectorToggle?.addEventListener("click", () => {
      state.clienteSelectorAberto = !state.clienteSelectorAberto || !state.clienteSelecionado?.id;
      syncClientSelectorState();
      renderClientsList();
      if (state.clienteSelectorAberto) {
        window.setTimeout(() => el.buscaCliente?.focus(), 80);
      }
    });

    el.buscaCliente?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      clearTimeout(state.buscaClienteTimer);
      state.clientesRenderLimit = CLIENTS_RENDER_BATCH;
      state.buscaClienteTimer = setTimeout(() => {
        loadClients(target.value || "").catch((error) => {
          showFeedback("error", messageFromError(error, "Não foi possível buscar clientes."));
        });
      }, 260);
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!state.clienteSelecionado?.id || !state.clienteSelectorAberto) return;
      if (target.closest("#simClienteSelector")) return;
      state.clienteSelectorAberto = false;
      syncClientSelectorState();
    });

    el.buscaImovel?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      state.buscaImovel = target.value || "";
      state.sugestoesRenderLimit = SUGGESTIONS_RENDER_BATCH;
      scheduleSuggestionsUiRender(120);
    });

    el.modoSugestoes?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-mode]");
      if (!button) return;
      state.modoSugestoes = String(button.getAttribute("data-mode") || "all");
      state.sugestoesRenderLimit = SUGGESTIONS_RENDER_BATCH;
      el.modoSugestoes.querySelectorAll("button[data-mode]").forEach((node) => {
        node.classList.toggle("is-active", node === button);
      });
      renderSuggestions();
      renderHeroSummary();
    });

    el.clientesLista?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button[data-action='selecionar-cliente']");
      const moreButton = target.closest("button[data-action='mostrar-mais-clientes']");
      if (moreButton) {
        state.clientesRenderLimit = Math.min(
          state.clientes.length,
          Math.max(toNumber(state.clientesRenderLimit, CLIENTS_RENDER_BATCH), CLIENTS_RENDER_BATCH) + CLIENTS_RENDER_BATCH
        );
        renderClientsList();
        return;
      }
      if (!button) return;
      const id = button.getAttribute("data-id");
      if (!id) return;
      selectClientById(id).catch((error) => showFeedback("error", messageFromError(error, "Não foi possível selecionar o cliente.")));
    });

    el.clienteSelecionado?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.getAttribute("data-action");
      const id = button.getAttribute("data-id");
      if (!id) return;

      if (action === "selecionar-reserva") {
        focusPropertyCandidate({ id, imovel: { id } }, {
          silentFeedback: false,
          message: "Reserva do cliente carregada no painel do imóvel.",
        }).catch((error) => showFeedback("error", messageFromError(error, "Não foi possível abrir o imóvel reservado.")));
        return;
      }

      if (action === "continuar-reserva") {
        const reservaAtual = getReservationByPropertyId(id);
        if (!reservaAtual) return;
        openReservationFlow(reservaAtual, {
          continueSimulation: true,
          silentFeedback: false,
        }).catch((error) => showFeedback("error", messageFromError(error, "Não foi possível recuperar a reserva salva.")));
        return;
      }

      if (action === "liberar-reserva") {
        const reservaAtual = getReservationByPropertyId(id);
        if (!reservaAtual) return;
        const titulo = firstFilled(reservaAtual?.imovel?.titulo, "esta unidade");
        if (!window.confirm(`Deseja cancelar a reserva de ${titulo}?`)) return;
        releaseReservationByPropertyId(id, { silentFeedback: false }).catch((error) => {
          showFeedback("error", messageFromError(error, "Não foi possível cancelar a reserva."));
        });
      }
    });

    el.sugestõesLista?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button[data-action]");
      if (!button) return;
      const action = button.getAttribute("data-action");
      const id = button.getAttribute("data-id");

      if (action === "mostrar-mais-sugestoes") {
        state.sugestoesRenderLimit = Math.min(
          Math.max(getVisibleSuggestions().length, SUGGESTIONS_RENDER_BATCH),
          Math.max(toNumber(state.sugestoesRenderLimit, SUGGESTIONS_RENDER_BATCH), SUGGESTIONS_RENDER_BATCH) + SUGGESTIONS_RENDER_BATCH
        );
        renderSuggestions();
        return;
      }
      if (action === "abrir-galeria-imovel" && id) {
        openGaleriaImovel(id).catch((error) => showFeedback("error", messageFromError(error, "Não foi possível abrir a galeria do imóvel.")));
        return;
      }
      if (action === "selecionar-sugestao" && id) {
        selectSuggestionById(id).catch((error) => showFeedback("error", messageFromError(error, "Não foi possível carregar essa unidade.")));
      }
      if (action === "continuar-sugestao-reserva" && id) {
        const reservaAtual = getReservationByPropertyId(id);
        if (!reservaAtual) return;
        openReservationFlow(reservaAtual, {
          continueSimulation: true,
          silentFeedback: false,
        }).catch((error) => showFeedback("error", messageFromError(error, "Não foi possível continuar a negociação reservada.")));
      }
      if (action === "comparar-sugestao" && id) {
        toggleCompareById(id);
      }
      if (action === "aplicar-entrada" && id) {
        applySuggestedEntryById(id).catch((error) => showFeedback("error", messageFromError(error, "Não foi possível aplicar a entrada sugerida.")));
      }
    });

    el.comparador?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.getAttribute("data-action");
      const id = button.getAttribute("data-id");
      if (!id) return;

      if (action === "destacar-comparador") {
        focusComparedProperty(id).catch((error) => showFeedback("error", messageFromError(error, "Não foi possível destacar a unidade comparada.")));
      }
      if (action === "remover-comparador") {
        toggleCompareById(id);
      }
    });

    el.imovelPreview?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const thumb = target.closest("button[data-action='thumb-imovel']");
      if (thumb) {
        state.fotoAtivaIndice = clamp(Number(thumb.getAttribute("data-index") || "0"), 0, 99);
        renderPropertyPreview();
        return;
      }

      const button = target.closest("button[data-action]");
      if (!button) return;
      const action = button.getAttribute("data-action");
      const id = button.getAttribute("data-id");

      if (action === "abrir-galeria-imovel" && id) {
        openGaleriaImovel(id, Number(button.getAttribute("data-index") || "0")).catch((error) => showFeedback("error", messageFromError(error, "Não foi possível abrir a galeria do imóvel.")));
        return;
      }
      if (action === "aplicar-entrada" && id) {
        applySuggestedEntryById(id).catch((error) => showFeedback("error", messageFromError(error, "Não foi possível aplicar a entrada sugerida.")));
      }
      if (action === "comparar-sugestao" && id) {
        toggleCompareById(id);
      }
      if (action === "abrir-mapa") {
        openMapModal();
      }
    });

    el.complementosLista?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.getAttribute("data-action");
      const id = button.getAttribute("data-id");
      if (!id) return;

      if (action === "editar-complemento") openComplementoModal(id);
      if (action === "toggle-complemento") {
        toggleComplemento(id).catch((error) => showFeedback("error", messageFromError(error, "Falha ao atualizar complemento.")));
      }
      if (action === "toggle-renda-complemento") {
        toggleComplementoRenda(id).catch((error) => showFeedback("error", messageFromError(error, "Falha ao atualizar composição de renda.")));
      }
      if (action === "toggle-financeira-complemento") {
        toggleComplementoFinanceira(id).catch((error) => showFeedback("error", messageFromError(error, "Falha ao atualizar composição financeira.")));
      }
      if (action === "excluir-complemento") {
        deleteComplemento(id).catch((error) => showFeedback("error", messageFromError(error, "Falha ao excluir complemento.")));
      }
    });

    [ids.filtroEmpreendimento, ids.filtroCidade, ids.filtroBairro, ids.filtroFaixaPreco, ids.filtroPrecoMin, ids.filtroPrecoMax]
      .forEach((id) => {
        const node = document.getElementById(id);
        if (!node) return;
        const eventName = node.tagName === "SELECT" ? "change" : "input";
        node.addEventListener(eventName, scheduleSuggestionsRefresh);
        if (node.tagName !== "SELECT") {
          node.addEventListener("change", scheduleSuggestionsRefresh);
        }
      });

    [ids.filtroBloco, ids.filtroApartamento].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", refreshLocalSuggestionFilters);
    });

    document.getElementById(ids.parceiroSimulacao)?.addEventListener("change", () => {
      const creditur = isCrediturSelected();
      const credituGeral = isCrediturGeralSelected();
      if (creditur) {
        applyCrediturDefaultTerms({ force: true });
        if (credituGeral && state.credituGeral && !isCredituGeralPdfResult(state.credituGeral)) {
          state.credituGeral = null;
        }
      } else {
        applyPropertyTimelineDefaults();
        state.credituGeral = null;
      }
      syncPostDeliveryFieldConstraints();
      if (credituGeral) {
        syncCredituGeralDisplayIntervals(state.credituGeral);
      } else if (creditur) {
        state.crediturSemestres = buildCrediturIntervalsFromMonthlyFields();
        renderCrediturSemestres({ preserve: false });
      } else {
        renderCrediturSemestres({ preserve: true });
      }
      renderCredituGeralResumo();
      syncCashflowInstallmentFields();
      scheduleSimulationRecalculation(120);
    });

    el.btnAbrirSiteCredituGeral?.addEventListener("click", openCredituGeralSite);
    el.btnAbrirCredituGeral?.addEventListener("click", openCredituGeralModal);
    el.btnFecharCredituGeral?.addEventListener("click", closeCredituGeralModal);
    el.btnSelecionarCredituGeralPdf?.addEventListener("click", () => {
      el.credituGeralPdf?.click();
    });
    el.credituGeralPdf?.addEventListener("change", () => {
      const file = el.credituGeralPdf?.files?.[0];
      if (file) {
        state.credituGeralPdfPendente = true;
        setCredituGeralPdfStatus(`${file.name} selecionado. Clique em Importar proposta.`, "warning");
        showCredituGeralFeedback("warning", "PDF selecionado. Clique em Importar proposta para carregar os valores e liberar a aplicação.");
      } else {
        state.credituGeralPdfPendente = false;
        setCredituGeralPdfStatus(
          isCredituGeralPdfResult(state.credituGeral)
            ? `${state.credituGeral.arquivo_pdf?.nome_original || "PDF Creditú"} carregado.`
            : "Anexe o PDF oficial da Creditú para liberar a aplicação.",
          isCredituGeralPdfResult(state.credituGeral) ? "success" : "warning"
        );
      }
      syncCredituGeralApplyState();
    });
    el.btnSelecionarCredituGeralSerasa?.addEventListener("click", () => {
      el.credituGeralSerasa?.click();
    });
    el.credituGeralSerasa?.addEventListener("change", () => {
      const file = el.credituGeralSerasa?.files?.[0];
      if (file) {
        setCredituGeralSerasaStatus(`${file.name} selecionado. Será enviado junto com o PDF.`, "warning");
      } else {
        setCredituGeralSerasaStatus("Nenhum score anexado.");
      }
    });
    el.btnLimparCredituGeralSerasa?.addEventListener("click", () => {
      if (el.credituGeralSerasa instanceof HTMLInputElement) el.credituGeralSerasa.value = "";
      setCredituGeralSerasaStatus("Nenhum score anexado.");
    });
    el.btnSelecionarCredituGeralSicaq?.addEventListener("click", () => {
      el.credituGeralSicaq?.click();
    });
    el.credituGeralSicaq?.addEventListener("change", () => {
      const file = el.credituGeralSicaq?.files?.[0];
      if (file) {
        setCredituGeralSicaqStatus(`${file.name} selecionado. Será enviado junto com o PDF.`, "warning");
      } else {
        setCredituGeralSicaqStatus("Nenhum SICAQ anexado.");
      }
    });
    el.btnLimparCredituGeralSicaq?.addEventListener("click", () => {
      if (el.credituGeralSicaq instanceof HTMLInputElement) el.credituGeralSicaq.value = "";
      setCredituGeralSicaqStatus("Nenhum SICAQ anexado.");
    });
    el.btnImportarCredituGeralPdf?.addEventListener("click", importCredituGeralPdf);
    el.modalCredituGeral?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-action='fechar-creditu-geral']")) {
        closeCredituGeralModal();
      }
    });
    el.formCredituGeral?.addEventListener("submit", (event) => {
      event.preventDefault();
      simulateCredituGeral();
    });
    el.btnSimularCredituGeral?.addEventListener("click", simulateCredituGeral);
    el.btnAplicarCredituGeral?.addEventListener("click", applyCredituGeralSimulation);
    el.credituGeralValorSlider?.addEventListener("input", () => {
      if (!refreshCredituGeralPdfOnlyPreview({ warn: true })) return;
      renderCredituGeralResult(state.credituGeral);
    });
    el.credituGeralValorSlider?.addEventListener("change", () => {
      if (!refreshCredituGeralPdfOnlyPreview({ warn: true })) return;
      renderCredituGeralResult(state.credituGeral);
    });
    [
      el.credituGeralValor,
      el.credituGeralRenda,
      el.credituGeralParcelaCaixa,
      el.credituGeralValorImovel,
      el.credituGeralRestricoes,
    ].forEach((node) => {
      if (!(node instanceof HTMLInputElement)) return;
      node.addEventListener("input", () => {
        if (!refreshCredituGeralPdfOnlyPreview({ warn: true })) return;
        formatMoneyTypingValue(node);
        renderCredituGeralResult(state.credituGeral);
      });
      node.addEventListener("change", () => {
        if (!refreshCredituGeralPdfOnlyPreview({ warn: true })) return;
        const valor = parseMoney(node.value);
        node.value = valor > 0 ? formatMoney(valor) : "";
        renderCredituGeralResult(state.credituGeral);
      });
    });
    [el.credituGeralPrazo, el.credituGeralSistema, el.credituGeralSeguro, el.credituGeralIdade, el.credituGeralScore]
      .forEach((node) => {
        if (!node) return;
        node.addEventListener("input", () => refreshCredituGeralPdfOnlyPreview({ warn: true }));
        node.addEventListener("change", () => refreshCredituGeralPdfOnlyPreview({ warn: true }));
      });

    document.getElementById(ids.mesesPre)?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.readOnly || target.value === "") return;
      target.value = String(normalizePreDeliveryMonths(target.value));
      if (!isCrediturSelected()) {
        setValue(ids.mesesPos, String(getPreferredPostDeliveryMonths(target.value)));
      }
      syncPostDeliveryFieldConstraints();
      renderCrediturSemestres();
      scheduleSimulationRecalculation();
    });

    document.getElementById(ids.mesesPos)?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.readOnly || target.value === "") return;
      const mesesPre = normalizePreDeliveryMonths(readValue(ids.mesesPre));
      target.value = String(normalizePostDeliveryMonths(target.value, 0, mesesPre));
      renderCrediturSemestres();
      scheduleSimulationRecalculation();
    });

    el.btnAdicionarCrediturSemestre?.addEventListener("click", () => {
      addCrediturSemestreRow();
    });

    el.crediturSemestres?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button[data-action='remover-creditur-semestre']");
      if (!button) return;
      const row = button.closest("[data-creditur-row]");
      const index = toNumber(row?.getAttribute("data-creditur-row"), -1);
      const current = collectCrediturSemestres({ includeEmpty: true });
      state.crediturSemestres = (current.length ? current : state.crediturSemestres).filter((_, itemIndex) => itemIndex !== index);
      if (!state.crediturSemestres.length) state.crediturSemestres = [getCrediturDefaultInterval()];
      renderCrediturSemestres({ preserve: false });
      scheduleSimulationRecalculation(120);
    });

    el.crediturSemestres?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.dataset.crediturField === "valor") {
        formatMoneyTypingValue(target);
      }
      scheduleSimulationRecalculation();
    });

    el.crediturSemestres?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
      const oldPreMonths = getCrediturConfiguredPreMonths();
      if (target.dataset.crediturField === "valor") {
        const valor = parseMoney(target.value);
        target.value = valor > 0 ? formatMoney(Math.max(valor, MIN_CLIENT_INSTALLMENT)) : "";
      }
      let current = collectCrediturSemestres({ normalize: true, includeEmpty: true });
      const crediturRow = current.find((item) => normalizeCrediturPhase(item.fase) === CREDITUR_PHASE_PRE);
      const newPreMonths = normalizePreDeliveryMonths(crediturRow?.parcela_fim, oldPreMonths);
      if (newPreMonths !== oldPreMonths) {
        setCrediturConfiguredPreMonths(newPreMonths);
        current = ajustarNiveis7lmAoPrazoCreditur(current, oldPreMonths, newPreMonths);
        syncPostDeliveryFieldConstraints();
      }
      state.crediturSemestres = current;
      renderCrediturSemestres({ preserve: false });
      validateCrediturIntervals({ notify: true });
      scheduleSimulationRecalculation(120);
    });

    document.getElementById(ids.intermediariaQtd)?.addEventListener("input", () => {
      renderIntermediaryDateFields();
      scheduleSimulationRecalculation();
    });

    document.getElementById(ids.intermediariaAdicionar)?.addEventListener("click", () => {
      const qtyField = document.getElementById(ids.intermediariaQtd);
      if (!(qtyField instanceof HTMLInputElement)) return;
      qtyField.value = String(clamp(toNumber(qtyField.value, 0) + 1, 0, 24));
      renderIntermediaryDateFields();
      scheduleSimulationRecalculation(120);
    });

    [ids.anualQtd, ids.semestralQtd].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", () => {
        syncRecurringDateFields();
        scheduleSimulationRecalculation();
      });
    });

    [ids.anualPrimeiraData, ids.semestralPrimeiraData].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        syncRecurringDateFields();
        scheduleSimulationRecalculation(120);
      });
    });

    [ids.reforcoQtd].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", () => scheduleSimulationRecalculation());
    });

    el.btnAbrirAlertas?.addEventListener("click", openAlertasModal);
    el.btnSalvar?.addEventListener("click", () => runAction("salvar", async () => {
      try {
        await saveSimulation();
      } catch (error) {
        showActionMessage("error", messageFromError(error, "Não foi possível salvar a simulação."));
      }
    }));
    el.btnPdf?.addEventListener("click", () => runAction("pdf", async () => {
      try {
        await emitirPdfSimulacao();
      } catch (error) {
        showActionMessage("error", messageFromError(error, "Não foi possível emitir o PDF."));
      }
    }));
    el.btnAbrirDemonstrativo?.addEventListener("click", () => runAction("demonstrativo", async () => {
      try {
        openDemonstrativoModal();
      } catch (error) {
        showActionMessage("error", messageFromError(error, "Não foi possível abrir o demonstrativo."));
      }
    }));
    el.btnReservar?.addEventListener("click", () => runAction("reservar", async () => {
      try {
        await reserveProperty();
      } catch (error) {
        showActionMessage("error", messageFromError(error, "Não foi possível reservar o imóvel."));
      }
    }));
    el.btnSolicitarAprovação?.addEventListener("click", () => runAction("aprovar", async () => {
      try {
        await submitApprovalRequest();
      } catch (error) {
        showActionMessage("error", messageFromError(error, "Não foi possível solicitar a aprovação de venda."));
      }
    }));
    el.btnVender?.addEventListener("click", () => runAction("vender", async () => {
      try {
        await sellProperty();
      } catch (error) {
        showActionMessage("error", messageFromError(error, "Não foi possível concluir a venda."));
      }
    }));
    el.btnLiberar?.addEventListener("click", () => runAction("liberar", async () => {
      try {
        await releaseReserve();
      } catch (error) {
        showActionMessage("error", messageFromError(error, "Não foi possível liberar a reserva."));
      }
    }));
    el.btnNova?.addEventListener("click", () => runAction("nova", async () => {
      resetSimulation();
    }));

    el.btnNovoComplemento?.addEventListener("click", () => openComplementoModal(""));
    el.btnFecharComplemento?.addEventListener("click", closeComplementoModal);
    el.btnFecharMapa?.addEventListener("click", closeMapModal);
    el.btnFecharDemonstrativo?.addEventListener("click", closeDemonstrativoModal);
    el.btnFecharGaleria?.addEventListener("click", closeGaleriaModal);
    el.btnFecharAlertas?.addEventListener("click", closeAlertasModal);
    el.btnMapaCopiar?.addEventListener("click", async () => {
      const address = String(el.btnMapaCopiar?.dataset.address || "").trim();
      if (!address) {
        showFeedback("warning", "Endereço indisponível para cópia.");
        return;
      }

      try {
        const copied = await copyTextToClipboard(address);
        showFeedback(copied ? "success" : "warning", copied ? "Endereço copiado." : "Não foi possível copiar o endereço.");
      } catch {
        showFeedback("warning", "Não foi possível copiar o endereço.");
      }
    });
    el.modalComplemento?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.action === "fechar-complemento" || target === el.modalComplemento) {
        closeComplementoModal();
      }
    });
    el.modalMapa?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.action === "fechar-mapa" || target === el.modalMapa) {
        closeMapModal();
      }
    });
    el.modalGaleria?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const actionButton = target.closest("button[data-action]");
      const action = actionButton?.getAttribute("data-action") || target.dataset.action || "";
      if (action === "fechar-galeria" || target === el.modalGaleria) {
        closeGaleriaModal();
        return;
      }
      if (action === "galeria-prev") {
        moveGaleria(-1);
        return;
      }
      if (action === "galeria-next") {
        moveGaleria(1);
        return;
      }
      if (action === "galeria-go" && actionButton) {
        state.galeriaIndex = clamp(Number(actionButton.getAttribute("data-index") || "0"), 0, Math.max(state.galeriaFotos.length - 1, 0));
        renderGaleriaModal();
      }
    });
    el.modalEscolhaImovel?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const optionButton = target.closest("button[data-escolha-imovel-id]");
      if (optionButton) {
        applyInitialPropertyChoice(optionButton.getAttribute("data-escolha-imovel-id") || "").catch((error) => {
          showFeedback("error", messageFromError(error, "Não foi possível selecionar o imóvel."));
        });
        return;
      }
      const actionButton = target.closest("button[data-action]");
      const action = actionButton?.getAttribute("data-action") || target.dataset.action || "";
      if (action === "fechar-escolha-imovel" || target === el.modalEscolhaImovel) {
        closeEscolhaImovelModal();
        return;
      }
      if (action === "ver-vitrine-escolha-imovel") {
        closeEscolhaImovelModal();
        el.sugestõesLista?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    el.modalSobrepreco?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const optionButton = target.closest("button[data-sobrepreco-value]");
      if (optionButton) {
        applyBrokerOverpriceSafely(optionButton.getAttribute("data-sobrepreco-value") || "0");
        return;
      }
      const action = target.dataset.action || "";
      if (action === "fechar-sobrepreco" || target === el.modalSobrepreco) {
        closeSobreprecoModal();
      }
    });
    el.modalDemonstrativo?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.action === "fechar-demonstrativo" || target === el.modalDemonstrativo) {
        closeDemonstrativoModal();
      }
    });
    el.modalAlertas?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.action === "fechar-alertas" || target === el.modalAlertas) {
        closeAlertasModal();
      }
    });
    el.btnFecharEscolhaImovel?.addEventListener("click", closeEscolhaImovelModal);
    el.btnFecharSobrepreco?.addEventListener("click", closeSobreprecoModal);
    el.btnDecidirSobreprecoDepois?.addEventListener("click", () => applyBrokerOverpriceSafely(0));
    el.btnZerarSobrepreco?.addEventListener("click", () => applyBrokerOverpriceSafely(0));
    el.btnAplicarSobreprecoManual?.addEventListener("click", () => applyBrokerOverpriceSafely(el.sobreprecoManual?.value || 0));
    el.btnAtualizarSobreprecoRegra?.addEventListener("click", updateBrokerOverpriceRuleFromForm);
    el.btnRestaurarSobreprecoRegra?.addEventListener("click", () => {
      resetBrokerOverpriceRule();
      renderSobreprecoOptions();
      renderSobreprecoRuleFields();
      showFeedback("info", "Regra padrão de sobrepreço restaurada.");
    });
    el.sobreprecoManual?.addEventListener("blur", () => {
      const value = roundMoneyNumber(Math.max(parseMoney(el.sobreprecoManual.value), 0));
      el.sobreprecoManual.value = value > 0 ? formatMoney(value) : "";
    });
    el.sobreprecoTetoComissao?.addEventListener("blur", () => {
      const value = roundMoneyNumber(Math.max(parseMoney(el.sobreprecoTetoComissao.value), 0));
      el.sobreprecoTetoComissao.value = value > 0 ? formatMoney(value) : "";
    });
    document.querySelectorAll(".tl-sim-sobrepreco-suggestion-input").forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      input.addEventListener("blur", () => {
        const value = roundMoneyNumber(Math.max(parseMoney(input.value), 0));
        input.value = value > 0 ? formatMoney(value) : "";
      });
    });

    document.addEventListener("toggle", (event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement)) return;
      if (details.dataset.lockedOpen !== "true") return;
      if (details.open) return;
      window.requestAnimationFrame(() => {
        details.open = true;
      });
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.clienteSelecionado?.id && state.clienteSelectorAberto) {
        state.clienteSelectorAberto = false;
        syncClientSelectorState();
        return;
      }
      if (event.key === "Escape" && el.modalComplemento && !el.modalComplemento.hidden) {
        closeComplementoModal();
      }
      if (event.key === "Escape" && el.modalMapa && !el.modalMapa.hidden) {
        closeMapModal();
      }
      if (event.key === "Escape" && el.modalGaleria && !el.modalGaleria.hidden) {
        closeGaleriaModal();
      }
      if (event.key === "Escape" && el.modalEscolhaImovel && !el.modalEscolhaImovel.hidden) {
        closeEscolhaImovelModal();
      }
      if (event.key === "Escape" && el.modalSobrepreco && !el.modalSobrepreco.hidden) {
        closeSobreprecoModal();
      }
      if (event.key === "ArrowLeft" && el.modalGaleria && !el.modalGaleria.hidden) {
        moveGaleria(-1);
      }
      if (event.key === "ArrowRight" && el.modalGaleria && !el.modalGaleria.hidden) {
        moveGaleria(1);
      }
      if (event.key === "Escape" && el.modalDemonstrativo && !el.modalDemonstrativo.hidden) {
        closeDemonstrativoModal();
      }
      if (event.key === "Escape" && el.modalAlertas && !el.modalAlertas.hidden) {
        closeAlertasModal();
      }
    });

    el.formComplemento?.addEventListener("submit", (event) => {
      saveComplemento(event).catch((error) => {
        showComplementoFeedback("error", messageFromError(error, "Não foi possível salvar o complemento."));
      });
    });
  }

  async function init() {
    if (!shared?.fetchJson) {
      showFeedback("error", "Serviço de API indisponível.");
      return;
    }

    const directPdfSimulationId = getDirectPdfSimulationId();
    if (directPdfSimulationId) {
      await initDirectPdf(directPdfSimulationId);
      return;
    }

    shared.initChrome?.();
    enableCustomSelects();
    setValue(ids.parceiroSimulacao, PARTNER_CREDITUR);
    refreshSelectUi(document.getElementById(ids.parceiroSimulacao));
    applyCrediturDefaultTerms({ force: true });
    applyInputMasks();
    syncReadonlySimulationFields();
    renderCrediturSemestres({ preserve: false });
    renderIntermediaryDateFields({ preserve: false });
    syncRecurringDateFields();
    enableCustomDatePickers();
    bindEvents();
    updateActionButtons();
    clearSimulationPanels();
    renderHeroSummary();
    renderClientsList();
    renderClientSelected();
    renderComplementos();
    renderSuggestions();
    renderCompareTray();
    renderPropertyPreview();
    installSimulatorTitleCaseObserver();
    refreshBrokerOverpriceRuleFromServer();

    try {
      const me = await api(ENDPOINTS.me, "GET");
      state.user = me?.usuario || me?.user || me || null;
      shared.fillUserbox?.(state.user);
      capturePreselectedContext();
      await loadClients("");
      const contextoAplicado = await applyPreselectedPropertyFromShowroom();
      if (!contextoAplicado) {
        showFeedback("info", "Selecione um cliente para iniciar a simulação.");
      }
    } catch (error) {
      showFeedback("error", messageFromError(error, "Não foi possível iniciar o simulador."));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => {
      showFeedback("error", messageFromError(error, "Falha ao carregar o simulador."));
    });
  });
})();
