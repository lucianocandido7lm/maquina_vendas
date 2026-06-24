(function () {
  "use strict";

  const shared = window.SevenLMConnectImoveis;
  if (!shared) return;

  const ENDPOINT_LISTAR = shared.meta("sevenlm-connect-endpoint-imoveis-listar", "/api/imoveis");
  const ENDPOINT_EXPORTAR = shared.meta("sevenlm-connect-endpoint-imoveis-exportar", "/api/imoveis/exportacao");
  const ENDPOINT_IMPORTAR = shared.meta("sevenlm-connect-endpoint-imoveis-importar", "/api/imoveis/importacao");
  const ENDPOINT_REMOVER = shared.meta("sevenlm-connect-endpoint-imoveis-remover", "/api/imoveis/{id}");
  const ENDPOINT_DETALHE = shared.meta("sevenlm-connect-endpoint-imoveis-detalhe", "/api/imoveis/{id}");
  const ENDPOINT_ATUALIZAR = shared.meta("sevenlm-connect-endpoint-imoveis-atualizar", "/api/imoveis/{id}");
  const ENDPOINT_LIBERAR_RESERVA = shared.meta("sevenlm-connect-endpoint-imoveis-liberar-reserva", "/api/connect-comercial/imoveis/{id}/liberar-reserva");
  const ENDPOINT_EVOLUCAO_LOTE = shared.meta("sevenlm-connect-endpoint-imoveis-evolucao-lote", "/api/imoveis/{id}/evolucao-obra/lote-endereco");
  const ENDPOINT_GEOCODIFICAR = shared.meta("sevenlm-connect-endpoint-imoveis-geocodificar", "/api/imoveis/geocodificar");
  const PATH_CADASTRO = shared.meta("sevenlm-connect-path-imoveis-cadastro", "/comercial/imoveis/cadastro");
  const PATH_SIMULADOR = shared.meta("sevenlm-connect-path-comercial-simulador", "/comercial/simulador");
  const VIEW_MODE_STORAGE_KEY = "7lm-imoveis-view-mode";
  const FAVORITOS_STORAGE_KEY = "7lm-imoveis-favoritos";
  const SIMULADOR_STORAGE_KEY = "7lm-connect-simulador-imovel";
  const LIMITE_COMPARACAO = 3;
  const BRAZIL_LABEL = "Brasil";
  const BRAZIL_COORD_BOUNDS = {
    latMin: -34,
    latMax: 6,
    lonMin: -74,
    lonMax: -28,
  };
  const BRAZIL_STATE_ALIASES = {
    AC: "Acre",
    AL: "Alagoas",
    AP: "Amapa",
    AM: "Amazonas",
    BA: "Bahia",
    CE: "Ceara",
    DF: "Distrito Federal",
    ES: "Espirito Santo",
    GO: "Goias",
    MA: "Maranhao",
    MT: "Mato Grosso",
    MS: "Mato Grosso do Sul",
    MG: "Minas Gerais",
    PA: "Para",
    PB: "Paraiba",
    PR: "Parana",
    PE: "Pernambuco",
    PI: "Piaui",
    RJ: "Rio de Janeiro",
    RN: "Rio Grande do Norte",
    RS: "Rio Grande do Sul",
    RO: "Rondonia",
    RR: "Roraima",
    SC: "Santa Catarina",
    SP: "Sao Paulo",
    SE: "Sergipe",
    TO: "Tocantins",
    ACRE: "Acre",
    ALAGOAS: "Alagoas",
    AMAPA: "Amapa",
    AMAZONAS: "Amazonas",
    BAHIA: "Bahia",
    CEARA: "Ceara",
    DISTRITOFEDERAL: "Distrito Federal",
    ESPIRITOSANTO: "Espirito Santo",
    GOIAS: "Goias",
    MARANHAO: "Maranhao",
    MATOGROSSO: "Mato Grosso",
    MATOGROSSODOSUL: "Mato Grosso do Sul",
    MINASGERAIS: "Minas Gerais",
    PARA: "Para",
    PARAIBA: "Paraiba",
    PARANA: "Parana",
    PERNAMBUCO: "Pernambuco",
    PIAUI: "Piaui",
    RIODEJANEIRO: "Rio de Janeiro",
    RIOGRANDEDONORTE: "Rio Grande do Norte",
    RIOGRANDEDOSUL: "Rio Grande do Sul",
    RONDONIA: "Rondonia",
    RORAIMA: "Roraima",
    SANTACATARINA: "Santa Catarina",
    SAOPAULO: "Sao Paulo",
    SERGIPE: "Sergipe",
    TOCANTINS: "Tocantins",
  };

  const state = {
    user: null,
    pagina: 1,
    paginacao: null,
    paginacaoBase: null,
    viewMode: "comercial",
    items: [],
    itemsBase: [],
    byId: new Map(),
    details: new Map(),
    favoritos: new Set(),
    comparacao: new Set(),
    showroomItem: null,
    showroomMidias: [],
    showroomIndex: 0,
    mapaAtual: null,
    mapaRequestId: 0,
    touchX: null,
    evolucaoSelecionados: new Set(),
  };

  const permissions = {
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canMedia: false,
  };

  const el = {
    feedback: document.getElementById("imoveisFeedback"),
    resumo: document.getElementById("imoveisResumo"),
    lista: document.getElementById("imoveisLista"),
    paginaInfo: document.getElementById("imoveisPaginacaoInfo"),
    paginationWrap: document.getElementById("imoveisPaginacao"),
    btnAnterior: document.getElementById("btnPaginaAnterior"),
    btnProxima: document.getElementById("btnPaginaProxima"),
    btnBuscar: document.getElementById("btnBuscarImoveis"),
    btnLimpar: document.getElementById("btnLimparFiltros"),
    inputBusca: document.getElementById("imoveisBusca"),
    inputRegiao: document.getElementById("imoveisRegiao"),
    inputCidade: document.getElementById("imoveisCidade"),
    inputBloco: document.getElementById("imoveisBloco"),
    inputApartamento: document.getElementById("imoveisApartamento"),
    inputStatus: document.getElementById("imoveisStatus"),
    btnNovo: document.getElementById("btnNovoImovel"),
    btnAbrirEvolucaoLote: document.getElementById("btnAbrirEvolucaoLoteImoveis"),
    btnAbrirExportacao: document.getElementById("btnAbrirExportacaoImoveis"),
    menuExportacao: document.getElementById("imoveisExportacaoMenu"),
    btnImportacao: document.getElementById("btnAbrirImportacaoImoveis"),
    btnViewComercial: document.getElementById("btnViewComercial"),
    btnViewTecnica: document.getElementById("btnViewTecnica"),
    importSection: document.getElementById("imoveisImportacaoSection"),
    btnFecharImportacao: document.getElementById("btnFecharImportacaoImoveis"),
    importForm: document.getElementById("formImportacaoImoveis"),
    importArquivo: document.getElementById("imoveisImportacaoArquivo"),
    importCidade: document.getElementById("imoveisImportacaoCidade"),
    importBairro: document.getElementById("imoveisImportacaoBairro"),
    importEstado: document.getElementById("imoveisImportacaoEstado"),
    importCep: document.getElementById("imoveisImportacaoCep"),
    importEndereco: document.getElementById("imoveisImportacaoEnderecoBase"),
    importTipo: document.getElementById("imoveisImportacaoTipo"),
    importStatus: document.getElementById("imoveisImportacaoStatus"),
    btnImportar: document.getElementById("btnImportarImoveis"),
    importResumo: document.getElementById("imoveisImportacaoResumo"),
    evolucaoSection: document.getElementById("imoveisEvolucaoSection"),
    btnFecharEvolucaoLote: document.getElementById("btnFecharEvolucaoLoteImoveis"),
    formEvolucaoLote: document.getElementById("formEvolucaoLoteImoveis"),
    evolucaoReferencia: document.getElementById("imoveisEvolucaoReferencia"),
    evolucaoPercentual: document.getElementById("imoveisEvolucaoPercentual"),
    evolucaoData: document.getElementById("imoveisEvolucaoData"),
    evolucaoObservacoes: document.getElementById("imoveisEvolucaoObservacoes"),
    evolucaoResumoLote: document.getElementById("imoveisEvolucaoResumoLote"),
    evolucaoResumoEndereco: document.getElementById("imoveisEvolucaoResumoEndereco"),
    evolucaoResumoContagem: document.getElementById("imoveisEvolucaoResumoContagem"),
    evolucaoLista: document.getElementById("imoveisEvolucaoLista"),
    evolucaoSelecaoResumo: document.getElementById("imoveisEvolucaoSelecaoResumo"),
    evolucaoSelecaoHint: document.getElementById("imoveisEvolucaoSelecaoHint"),
    btnEvolucaoSelecionarTodas: document.getElementById("btnImoveisEvolucaoSelecionarTodas"),
    btnEvolucaoLimparSelecao: document.getElementById("btnImoveisEvolucaoLimparSelecao"),
    btnAplicarEvolucaoLote: document.getElementById("btnAplicarEvolucaoLoteImoveis"),
    compareDock: document.getElementById("imoveisCompareDock"),
    compareItens: document.getElementById("imoveisCompareItens"),
    btnAbrirComparacao: document.getElementById("btnAbrirComparacao"),
    btnLimparComparacao: document.getElementById("btnLimparComparacao"),
    showroomSection: document.getElementById("imoveisShowroomSection"),
    showroomContent: document.getElementById("imoveisShowroomContent"),
    showroomSubtitle: document.getElementById("imoveisShowroomSubtitulo"),
    btnFecharShowroom: document.getElementById("btnFecharShowroom"),
    mapaSection: document.getElementById("imoveisMapaSection"),
    mapaFrame: document.getElementById("imoveisMapaFrame"),
    mapaEndereco: document.getElementById("imoveisMapaEndereco"),
    mapaCidade: document.getElementById("imoveisMapaCidade"),
    btnMapaCopiar: document.getElementById("btnMapaCopiarEndereco"),
    btnMapaGoogle: document.getElementById("btnMapaAbrirGoogle"),
    btnMapaRota: document.getElementById("btnMapaAbrirRota"),
    btnMapaFechar: document.getElementById("btnMapaFechar"),
    btnFecharMapa: document.getElementById("btnFecharMapa"),
    comparacaoSection: document.getElementById("imoveisComparacaoSection"),
    comparacaoContent: document.getElementById("imoveisComparacaoConteudo"),
    btnFecharComparacao: document.getElementById("btnFecharComparacao"),
  };

  const statusMap = { disponivel: "Disponível", reservado: "Reservado", vendido: "Vendido", inativo: "Inativo" };
  const text = (v) => String(v || "").trim();
  const esc = (v) => shared.escapeHtml(String(v || ""));
  const normalizeToken = (v) => text(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  const num = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };
  const descontoPolicy = (item = {}) => {
    const minimo = Math.max(num(item.valor_incentivo_minimo ?? item.valor_desconto_minimo) ?? 0, 0);
    const maximoConfigurado = Math.max(num(item.valor_incentivo_maximo ?? item.valor_desconto_maximo) ?? 50000, 0);
    const quantidade = Math.max(Math.floor(num(item.quantidade_incentivo_reservas_vendas ?? item.quantidade_desconto_reservas_vendas) ?? 0), 0);
    const reducaoCalculada = Math.floor(quantidade / 20) * 5000;
    const reducao = Math.max(num(item.incentivo_7lm_reducao_por_reservas_vendas ?? item.desconto_imovel_reducao_por_reservas_vendas) ?? reducaoCalculada, 0);
    const efetivoBackend = num(item.incentivo_7lm_maximo_efetivo ?? item.desconto_imovel_maximo_efetivo);
    const maximoEfetivo = Math.max(0, efetivoBackend ?? (maximoConfigurado - reducao));
    return { minimo, maximoConfigurado, quantidade, reducao, maximoEfetivo };
  };
  const pth = (v) => {
    const s = text(v);
    return s ? `/${s.replace(/^\/+/, "")}` : "";
  };
  const sKey = (v) => text(v).toLowerCase();
  const sLabel = (v) => statusMap[sKey(v)] || (text(v) || "Indefinido");
  const isSold = (item) => normalizeToken(item?.status) === "VENDIDO";
  const linkedSimulationId = (item) => text(reservation(item)?.simulacao_id || item?.simulacao_id || item?.identificador_simulacao);
  const area = (v) => (num(v) === null ? "-" : `${num(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m2`);
  const local = (item) => [item?.bairro, item?.cidade].map(text).filter(Boolean).join(" - ") || "Local não informado";
  const address = (item) => text(item?.endereco_formatado) || [item?.endereco, item?.bairro, item?.cidade, item?.estado, item?.cep].map(text).filter(Boolean).join(", ");
  const canOpenEditor = () => permissions.canEdit || permissions.canMedia;
  const filterKey = (value) => text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const itemBloco = (item) => text(item?.detalhes_comerciais?.bloco || item?.agrupamento?.bloco || item?.bloco);
  const itemApartamento = (item) => text(
    item?.detalhes_comerciais?.unidade
      || item?.agrupamento?.unidade
      || item?.apartamento
      || item?.unidade,
  );
  const itemRegiao = (item) => text(
    item?.bairro
      || item?.agrupamento?.localidade
      || item?.detalhes_comerciais?.empreendimento,
  );
  const itemCidade = (item) => text(item?.cidade);
  const normalizeBrazilState = (value, city = "") => {
    const raw = text(value);
    if (!raw) return "";
    const token = normalizeToken(raw);
    if (BRAZIL_STATE_ALIASES[token]) return BRAZIL_STATE_ALIASES[token];
    const cityToken = normalizeToken(city);
    if (token === "CAT" && cityToken === "CATALAO") return "Goias";
    return raw;
  };
  const joinQuery = (...parts) => parts.map(text).filter(Boolean).join(", ");
  const unique = (values) => [...new Set(values.filter(Boolean))];
  const extrairValorDiferencial = (item, prefixo) => {
    const difs = Array.isArray(item?.diferenciais_comerciais) ? item.diferenciais_comerciais : [];
    const prefixoNormalizado = normalizeToken(prefixo);
    const itemDiferencial = difs.find((valor) => normalizeToken(valor).startsWith(prefixoNormalizado));
    if (!itemDiferencial) return "";
    const partes = String(itemDiferencial).split(":");
    return text(partes.length > 1 ? partes.slice(1).join(":") : itemDiferencial);
  };
  const orientacao = (item) => text(item?.detalhes_comerciais?.orientacao) || extrairValorDiferencial(item, "Orientacao") || "-";
  const compact = (v, max = 180) => {
    const s = text(v);
    return s.length > max ? `${s.slice(0, Math.max(0, max - 1)).trimEnd()}...` : s;
  };
  const numLoose = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    let s = text(v);
    if (!s) return null;
    s = s.replace(/m2|m²/gi, "").replace(/\s+/g, "").replace(/[^\d,.\-]/g, "");
    if (!s) return null;
    if (s.includes(",") && s.includes(".")) {
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (s.includes(",")) {
      s = s.replace(",", ".");
    }
    const x = Number(s);
    return Number.isFinite(x) ? x : null;
  };
  const areaMetric = (v) => {
    const x = numLoose(v);
    return x === null ? "-" : `${x.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m2`;
  };
  const money = (v) => {
    const x = numLoose(v);
    return x === null ? "" : shared.formatCurrency(x);
  };
  const percent = (v) => {
    const x = numLoose(v);
    if (x === null) return "-";
    const percentual = Math.abs(x) <= 1.5 ? x * 100 : x;
    return `${percentual.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  };
  const dateLabel = (v) => {
    const match = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    const raw = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : (v ? new Date(v) : null);
    return raw && !Number.isNaN(raw.getTime()) ? raw.toLocaleDateString("pt-BR") : "";
  };
  const dateTimeLabel = (v) => {
    const raw = v ? new Date(v) : null;
    if (!raw || Number.isNaN(raw.getTime())) return "";
    return raw.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const dateInputValue = (value = new Date()) => {
    const current = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(current.getTime())) return "";
    const adjusted = new Date(current.getTime() - (current.getTimezoneOffset() * 60000));
    return adjusted.toISOString().slice(0, 10);
  };
  const normalizeLotText = (value) => text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  const normalizeCep = (value) => text(value).replace(/\D+/g, "");
  const lotBaseAddress = (value) => {
    const raw = text(value);
    if (!raw) return "";
    const parts = raw.split(/\s*,\s*/).map((part) => text(part)).filter(Boolean);
    const baseParts = [];
    parts.forEach((part) => {
      const normalized = normalizeLotText(part);
      if (/^(bloco|pavimento|unidade|apartamento|apto)\b/.test(normalized)) return;
      baseParts.push(part);
    });
    const safeParts = baseParts.length ? baseParts : parts.slice(0, 1);
    return normalizeLotText(safeParts.join(", "));
  };
  const lotAddressData = (item) => ({
    base: lotBaseAddress(item?.endereco),
    cidade: normalizeLotText(item?.cidade),
    bairro: normalizeLotText(item?.bairro),
    estado: normalizeLotText(item?.estado),
    cep: normalizeCep(item?.cep),
  });
  const isSameLotAddress = (reference, item) => {
    const candidate = lotAddressData(item);
    if (!reference.base || candidate.base !== reference.base) return false;
    for (const key of ["cidade", "bairro", "estado"]) {
      if (reference[key] && candidate[key] && reference[key] !== candidate[key]) return false;
    }
    if (reference.cep && candidate.cep && reference.cep !== candidate.cep) return false;
    return true;
  };
  const parsePercentInput = (value) => {
    const raw = text(value).replace("%", "").replace(/\s+/g, "").replace(",", ".");
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const itemLabel = (item) => {
    const title = text(item?.titulo) || "Imóvel sem título";
    const parts = [title];
    const place = local(item);
    if (place && place !== "Local não informado") parts.push(place);
    const status = sLabel(item?.status);
    if (status) parts.push(status);
    return parts.join(" • ");
  };
  const closeCustomSelects = (exceptWrap = null) => {
    document.querySelectorAll(".tl-clientes-select-wrap").forEach((wrap) => {
      if (exceptWrap && wrap === exceptWrap) return;
      wrap.classList.remove("is-open");
      wrap.querySelector(".tl-clientes-select-options")?.classList.remove("is-open");
      wrap.querySelector(".tl-clientes-select-trigger")?.setAttribute("aria-expanded", "false");
    });
  };
  const refreshCustomSelect = (select) => {
    const ui = select?._customUi;
    if (!ui) return;
    const selected = select.options[select.selectedIndex] || null;
    ui.trigger.textContent = selected?.textContent?.trim() || "Selecione";
    ui.trigger.disabled = Boolean(select.disabled);
    ui.wrap.classList.toggle("is-disabled", Boolean(select.disabled));
    ui.options.querySelectorAll(".tl-clientes-select-option").forEach((button) => {
      const isSelected = button.dataset.value === String(select.value || "");
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  };
  const rebuildCustomSelectOptions = (select) => {
    const ui = select?._customUi;
    if (!ui) return;
    ui.options.innerHTML = "";

    Array.from(select.options).forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tl-clientes-select-option";
      button.dataset.value = option.value;
      button.setAttribute("role", "option");
      button.setAttribute("aria-label", option.textContent?.trim() || "");
      if (option.disabled) button.disabled = true;

      const label = document.createElement("span");
      label.className = "tl-clientes-select-option-label";
      label.textContent = option.textContent?.trim() || "";

      const mark = document.createElement("span");
      mark.className = "tl-clientes-select-option-mark";
      mark.textContent = "Ativo";

      button.appendChild(label);
      button.appendChild(mark);

      button.addEventListener("click", () => {
        if (option.disabled || select.disabled) return;
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        closeCustomSelects();
      });
      ui.options.appendChild(button);
    });
  };
  const setupCustomSelect = (select) => {
    if (!select) return;
    if (select.dataset.customizado === "true") {
      rebuildCustomSelectOptions(select);
      refreshCustomSelect(select);
      return;
    }
    const parent = select.parentElement;
    if (!parent) return;
    const wrap = document.createElement("div");
    wrap.className = "tl-clientes-select-wrap";
    parent.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add("tl-clientes-select--native");
    select.hidden = true;
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
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
    rebuildCustomSelectOptions(select);

    trigger.addEventListener("click", () => {
      if (select.disabled) return;
      const isOpen = options.classList.contains("is-open");
      closeCustomSelects(isOpen ? null : wrap);
      if (!isOpen) {
        wrap.classList.add("is-open");
        options.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
    });

    select.addEventListener("change", () => refreshCustomSelect(select));
    refreshCustomSelect(select);
  };
  const enableCustomSelects = () => {
    document.querySelectorAll("select.tl-clientes-select").forEach(setupCustomSelect);
    if (document.body.dataset.imoveisSelectBind === "true") return;
    document.body.dataset.imoveisSelectBind = "true";
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".tl-clientes-select-wrap")) return;
      closeCustomSelects();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeCustomSelects();
    });
  };
  const reservation = (item) => item?.reserva_ativa || null;
  const canReleaseReservation = (item) => {
    if (reservation(item)) return true;
    const token = normalizeToken(item?.status);
    return ["RESERVADO", "PENDENTEDEAPROVACAO", "PENDENTEAPROVACAO"].includes(token);
  };
  const reservationClientName = (item) => text(reservation(item)?.cliente?.nome_completo) || "cliente não informado";
  const reservationUserName = (reserva) => {
    const usuario = reserva?.reservado_por_usuario || {};
    const usuarioAtualId = text(state.user?.identificador_usuario || state.user?.id);
    const reservadoPorId = text(reserva?.reservado_por);
    return text(usuario.nome_completo)
      || text(reserva?.reservado_por_nome)
      || text(usuario.email)
      || text(reserva?.reservado_por_email)
      || (reservadoPorId && usuarioAtualId && reservadoPorId === usuarioAtualId
        ? text(state.user?.nome_completo || state.user?.nome || state.user?.displayName || state.user?.correio_eletronico || state.user?.email)
        : "")
      || "responsável não identificado";
  };
  const reservationAuditDetails = (reserva) => {
    if (!reserva) return "";
    const responsavel = reservationUserName(reserva);
    const data = dateTimeLabel(reserva.reservado_em) || dateLabel(reserva.reservado_em);
    if (responsavel && data) return `Reservado por ${responsavel} em ${data}`;
    if (responsavel) return `Reservado por ${responsavel}`;
    if (data) return `Reservado em ${data}`;
    return "";
  };
  const reservationLabel = (item) => {
    if (reservation(item)) return `Reservado para ${reservationClientName(item)}`;
    if (sKey(item?.status) === "reservado") return "Reserva sem cliente vinculado";
    return "";
  };
  const reservationDetails = (item) => {
    const reserva = reservation(item);
    if (!reserva) {
      return sKey(item?.status) === "reservado"
        ? "Unidade marcada como reservada sem negociação vinculada."
        : "";
    }
    const partes = [];
    const auditoria = reservationAuditDetails(reserva);
    if (auditoria) partes.push(auditoria);
    if (money(reserva.negociacao?.entrada)) partes.push(`Entrada ${money(reserva.negociacao.entrada)}`);
    if (money(reserva.negociacao?.valor_total_operacao)) partes.push(`Operação ${money(reserva.negociacao.valor_total_operacao)}`);
    return partes.join(" • ");
  };
  const coord = (v) => {
    const raw = text(v).replace(",", ".");
    const x = Number(raw);
    return Number.isFinite(x) ? x : null;
  };
  const isBrazilCoordinate = (lat, lon) => lat !== null
    && lon !== null
    && lat >= BRAZIL_COORD_BOUNDS.latMin
    && lat <= BRAZIL_COORD_BOUNDS.latMax
    && lon >= BRAZIL_COORD_BOUNDS.lonMin
    && lon <= BRAZIL_COORD_BOUNDS.lonMax;
  const normalizeBrazilCoordinates = (latitude, longitude) => {
    const lat = coord(latitude);
    const lon = coord(longitude);
    if (isBrazilCoordinate(lat, lon)) return { lat, lon };
    if (isBrazilCoordinate(lon, lat)) return { lat: lon, lon: lat };
    return null;
  };
  const mapPreviewCache = new Map();

  function buildOsmEmbedUrl(latitude, longitude, zoom = 16) {
    const pair = normalizeBrazilCoordinates(latitude, longitude);
    if (!pair) return "";
    const { lat, lon } = pair;
    const latDelta = 0.0065;
    const lonDelta = 0.009;
    const bbox = [lon - lonDelta, lat - latDelta, lon + lonDelta, lat + latDelta]
      .map((value) => value.toFixed(6))
      .join("%2C");
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lon.toFixed(6)}&zoom=${zoom}`;
  }

  function buildGoogleEmbedUrl(query) {
    const q = text(query);
    return q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed` : "";
  }

  async function geocodeAddress(query) {
    const q = text(query);
    if (!q) return null;
    if (mapPreviewCache.has(q)) return mapPreviewCache.get(q);
    try {
      const url = new URL(ENDPOINT_GEOCODIFICAR, window.location.origin);
      url.searchParams.set("q", q);
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
      });
      if (!response.ok) throw new Error(`Falha ao geocodificar (${response.status})`);
      const data = await response.json();
      const geo = data?.resultado || data;
      const result = geo?.lat && geo?.lon ? { lat: geo.lat, lon: geo.lon } : null;
      mapPreviewCache.set(q, result);
      return result;
    } catch {
      mapPreviewCache.set(q, null);
      return null;
    }
  }

  function setMapFrameDoc(title, body, actionLabel, actionUrl) {
    if (!el.mapaFrame) return;
    const safeTitle = esc(title || "Mapa");
    const safeBody = esc(body || "");
    const safeActionLabel = esc(actionLabel || "");
    const safeActionUrl = actionUrl ? esc(actionUrl) : "";
    const actionHtml = safeActionUrl && safeActionLabel
      ? `<a href="${safeActionUrl}" target="_blank" rel="noopener noreferrer">${safeActionLabel}</a>`
      : "";
    el.mapaFrame.src = "about:blank";
    el.mapaFrame.srcdoc = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
      html,body{margin:0;height:100%;font-family:Inter,Arial,sans-serif;background:#eef3f8;color:#233248}
      body{display:grid;place-items:center;padding:24px;box-sizing:border-box}
      main{max-width:360px;text-align:center;display:grid;gap:12px}
      h1{margin:0;font-size:1.1rem;line-height:1.2}
      p{margin:0;font-size:.96rem;line-height:1.45;color:#516176}
      a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;border-radius:999px;background:#0f7bff;color:#fff;text-decoration:none;font-weight:700}
    </style></head><body><main><h1>${safeTitle}</h1><p>${safeBody}</p>${actionHtml}</main></body></html>`;
  }

  function setMapFrameEmbed(url, title) {
    if (!el.mapaFrame) return;
    el.mapaFrame.setAttribute("loading", "eager");
    el.mapaFrame.srcdoc = "";
    el.mapaFrame.removeAttribute("srcdoc");
    el.mapaFrame.src = url || "about:blank";
    el.mapaFrame.title = title || "Mapa do imóvel";
  }

  function toggleModal(section, open) {
    if (!section) return;
    shared.toggleHidden(section, !open);
    const hasOpen = [el.importSection, el.evolucaoSection, el.showroomSection, el.mapaSection, el.comparacaoSection].some((x) => x && !x.hidden);
    document.body.classList.toggle("tl-modal-open", hasOpen);
    document.documentElement.classList.toggle("tl-modal-open", hasOpen);
  }

  function queryAtual() {
    return {
      q: text(el.inputBusca?.value),
      regiao: text(el.inputRegiao?.value),
      bairro: text(el.inputRegiao?.value),
      cidade: text(el.inputCidade?.value),
      bloco: text(el.inputBloco?.value),
      apartamento: text(el.inputApartamento?.value),
      status: text(el.inputStatus?.value),
      pagina: String(state.pagina),
      limite: "80",
    };
  }

  function queryServidor() {
    const atual = queryAtual();
    return {
      q: atual.q,
      cidade: atual.cidade,
      bairro: atual.bairro,
      status: atual.status,
      pagina: atual.pagina,
      limite: atual.limite,
    };
  }

  function queryString(params) {
    const s = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (text(v)) s.set(k, String(v));
    });
    return s.toString();
  }

  function sortFilterValues(values) {
    return values.sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));
  }

  function uniqueFilterValues(items, getter) {
    const map = new Map();
    items.forEach((item) => {
      const label = text(getter(item));
      if (!label) return;
      const key = filterKey(label);
      if (!map.has(key)) map.set(key, label);
    });
    return sortFilterValues(Array.from(map.values()));
  }

  function updateSelectOptions(select, placeholder, values) {
    if (!select) return;
    const current = text(select.value);
    const currentKey = filterKey(current);
    select.replaceChildren();
    select.appendChild(new Option(placeholder, ""));
    values.forEach((value) => {
      select.appendChild(new Option(value, value));
    });
    const selected = values.find((value) => filterKey(value) === currentKey) || "";
    select.value = selected;
    setupCustomSelect(select);
  }

  function atualizarFiltrosLista(items) {
    const fonte = Array.isArray(items) ? items : [];
    updateSelectOptions(el.inputRegiao, "Todas as regiões", uniqueFilterValues(fonte, itemRegiao));
    updateSelectOptions(el.inputCidade, "Todas as cidades", uniqueFilterValues(fonte, itemCidade));
    updateSelectOptions(el.inputBloco, "Todos os blocos", uniqueFilterValues(fonte, itemBloco));
    updateSelectOptions(el.inputApartamento, "Todos os apartamentos", uniqueFilterValues(fonte, itemApartamento));
  }

  function filtrarItemsPorListas(items) {
    const regiao = filterKey(el.inputRegiao?.value);
    const cidade = filterKey(el.inputCidade?.value);
    const bloco = filterKey(el.inputBloco?.value);
    const apartamento = filterKey(el.inputApartamento?.value);
    if (!regiao && !cidade && !bloco && !apartamento) return items;
    return items.filter((item) => {
      if (regiao && filterKey(itemRegiao(item)) !== regiao) return false;
      if (cidade && filterKey(itemCidade(item)) !== cidade) return false;
      if (bloco && filterKey(itemBloco(item)) !== bloco) return false;
      if (apartamento && filterKey(itemApartamento(item)) !== apartamento) return false;
      return true;
    });
  }

  function temFiltroListaAtivo() {
    return Boolean(
      text(el.inputRegiao?.value)
        || text(el.inputCidade?.value)
        || text(el.inputBloco?.value)
        || text(el.inputApartamento?.value),
    );
  }

  function metaFiltradaLocalmente(total) {
    return {
      pagina: 1,
      total_paginas: 1,
      total,
      tem_anterior: false,
      tem_proxima: false,
    };
  }

  function aplicarFiltrosListaERenderizar() {
    const items = filtrarItemsPorListas(Array.isArray(state.itemsBase) ? state.itemsBase : []);
    const resumo = renderList(items);
    updatePagination(temFiltroListaAtivo() ? metaFiltradaLocalmente(items.length) : state.paginacaoBase || metaFiltradaLocalmente(items.length));
    if (el.evolucaoSection && !el.evolucaoSection.hidden) {
      renderEvolucaoLoteOptions(text(el.evolucaoReferencia?.value));
      refreshEvolucaoLoteSummary();
    }
    if (el.resumo) el.resumo.textContent = resumo;
  }

  function queryExportacao(formato) {
    const atual = queryAtual();
    return {
      formato,
      q: atual.q,
      regiao: atual.regiao,
      bairro: atual.bairro,
      cidade: atual.cidade,
      bloco: atual.bloco,
      apartamento: atual.apartamento,
      status: atual.status,
    };
  }

  function readNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "string" && !value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function formatMoneyReport(value) {
    const number = readNumber(value);
    return number === null ? "-" : new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    }).format(number);
  }

  function formatIntegerReport(value) {
    const number = readNumber(value);
    return number === null ? "-" : new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 0,
    }).format(number);
  }

  function formatAreaReport(value) {
    const number = readNumber(value);
    return number === null ? "-" : `${new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(number)} m2`;
  }

  function formatPercentReport(value) {
    const number = readNumber(value);
    return number === null ? "-" : `${new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number)}%`;
  }

  function formatDateReport(value) {
    const raw = text(value);
    if (!raw) return "-";
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(parsed);
  }

  function formatDateTimeReport(value = new Date()) {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  }

  function describeExportFilters() {
    const filtros = [];
    const atual = queryExportacao("pdf");
    if (text(atual.q)) filtros.push(`Busca: ${text(atual.q)}`);
    if (text(atual.regiao)) filtros.push(`Região: ${text(atual.regiao)}`);
    if (text(atual.cidade)) filtros.push(`Cidade: ${text(atual.cidade)}`);
    if (text(atual.bloco)) filtros.push(`Bloco: ${text(atual.bloco)}`);
    if (text(atual.apartamento)) filtros.push(`Apartamento: ${text(atual.apartamento)}`);
    if (text(atual.status)) filtros.push(`Status: ${sLabel(atual.status)}`);
    return filtros.length ? filtros.join(" | ") : "Sem filtros adicionais.";
  }

  function describeExportDetails(item) {
    const quartos = readNumber(item?.quartos);
    const vagas = readNumber(item?.vagas_garagem ?? item?.vagas);
    return [
      text(item?.tipo_imovel),
      formatAreaReport(item?.area_m2) !== "-" ? formatAreaReport(item?.area_m2) : "",
      quartos === null ? "" : `${formatIntegerReport(quartos)} qtos`,
      vagas === null ? "" : `${formatIntegerReport(vagas)} vaga${vagas === 1 ? "" : "s"}`,
    ].filter(Boolean).join(" | ") || "Sem detalhes adicionais.";
  }

  function describeExportLocation(item) {
    return [text(item?.bairro), text(item?.cidade), text(item?.estado)].filter(Boolean).join(" - ") || "Local não informado";
  }

  function describeExportEntrega(item) {
    const data = formatDateReport(item?.data_entrega);
    const meses = readNumber(item?.meses_pre_entrega);
    if (meses === null && data === "-") return "-";
    if (meses === null) return data;
    if (data === "-") return `${formatIntegerReport(meses)} meses`;
    return `${formatIntegerReport(meses)} m | ${data}`;
  }

  function normalizeExportMediaPath(value) {
    const caminho = pth(value);
    return caminho ? new URL(caminho, window.location.origin).href : "";
  }

  function computePortfolioMetrics(items) {
    const metricas = {
      totalItens: items.length,
      valorTotal: 0,
      valorGarantidoTotal: 0,
      valorGarantidoMedio: 0,
      preObraMedia: 0,
      conclusaoMedia: 0,
      ticketMedio: 0,
      disponiveis: 0,
      reservados: 0,
      vendidos: 0,
      inativos: 0,
      reservasAtivas: 0,
      totalMidias: 0,
      semMidias: 0,
      cidades: new Set(),
      proximaEntrega: "",
    };

    const preObras = [];
    const conclusoes = [];
    const entregas = [];

    items.forEach((item) => {
      const valor = readNumber(item?.valor) || 0;
      const garantido = readNumber(item?.valor_garantido) || 0;
      const preObra = readNumber(item?.valor_parcela_minima_pre_obra);
      const conclusao = readNumber(item?.percentual_conclusao_obra);
      const quantidadeMidias = Math.max(0, readNumber(item?.quantidade_midias) || 0);
      const status = sKey(item?.status);
      const cidade = text(item?.cidade);
      const dataEntrega = text(item?.data_entrega);
      const reserva = text(item?.reserva_cliente);

      metricas.valorTotal += valor;
      metricas.valorGarantidoTotal += garantido;
      metricas.totalMidias += quantidadeMidias;
      if (!quantidadeMidias) metricas.semMidias += 1;
      if (cidade) metricas.cidades.add(cidade);
      if (reserva && reserva !== "-") metricas.reservasAtivas += 1;

      if (preObra !== null) preObras.push(preObra);
      if (conclusao !== null) conclusoes.push(conclusao);
      if (dataEntrega) entregas.push(dataEntrega);

      if (status === "disponivel") metricas.disponiveis += 1;
      else if (status === "reservado") metricas.reservados += 1;
      else if (status === "vendido") metricas.vendidos += 1;
      else metricas.inativos += 1;
    });

    metricas.ticketMedio = metricas.totalItens ? metricas.valorTotal / metricas.totalItens : 0;
    metricas.valorGarantidoMedio = metricas.totalItens ? metricas.valorGarantidoTotal / metricas.totalItens : 0;
    metricas.preObraMedia = preObras.length ? preObras.reduce((sum, value) => sum + value, 0) / preObras.length : 0;
    metricas.conclusaoMedia = conclusoes.length ? conclusoes.reduce((sum, value) => sum + value, 0) / conclusoes.length : 0;
    metricas.proximaEntrega = entregas
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())[0] || null;

    return metricas;
  }

  function buildPortfolioAlerts(metricas) {
    const alertas = [];
    if (metricas.reservados > 0) {
      alertas.push(`${formatIntegerReport(metricas.reservados)} unidade(s) exigem acompanhamento comercial imediato.`);
    }
    if (metricas.semMidias > 0) {
      alertas.push(`${formatIntegerReport(metricas.semMidias)} unidade(s) ainda não possuem mídias publicadas.`);
    }
    if (metricas.inativos > 0) {
      alertas.push(`${formatIntegerReport(metricas.inativos)} unidade(s) estão marcadas como inativas e precisam de revisão.`);
    }
    if (metricas.disponiveis > 0) {
      alertas.push(`${formatIntegerReport(metricas.disponiveis)} unidade(s) estão livres para simulação e negociação.`);
    }
    if (!alertas.length) {
      alertas.push("Nenhum alerta crítico foi identificado para os filtros desta exportação.");
    }
    return alertas;
  }

  async function carregarImoveisExportacaoPdf() {
    const filtros = queryExportacao("pdf");
    const itens = [];
    let pagina = 1;
    let totalPaginas = 1;

    do {
      const payload = await shared.apiRequest(`${ENDPOINT_LISTAR}?${queryString({
        q: filtros.q,
        cidade: filtros.cidade,
        bairro: filtros.bairro,
        status: filtros.status,
        pagina: String(pagina),
        limite: "1000",
      })}`, { method: "GET" });

      const paginaItens = Array.isArray(payload?.items) ? payload.items : [];
      paginaItens.forEach((item) => {
        itens.push({
          ...item,
          foto_principal: pth(item?.foto_principal),
        });
      });

      totalPaginas = Math.max(1, Number(payload?.paginacao?.total_paginas || 1));
      pagina += 1;
    } while (pagina <= totalPaginas);

    return filtrarItemsPorListas(itens);
  }

  function renderMetricCards(items, extraClass = "") {
    return items.map(([label, value]) => `
      <article class="report-metric${extraClass ? ` ${extraClass}` : ""}">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
      </article>
    `).join("");
  }

  function renderReportAlerts(alertas) {
    if (!alertas.length) {
      return '<p class="report-note">Cenario calculado sem alertas relevantes.</p>';
    }
    return alertas.map((texto) => `<p class="report-note">${esc(texto)}</p>`).join("");
  }

  function renderPortfolioRows(items) {
    if (!items.length) {
      return '<tr><td colspan="8">Nenhum imóvel encontrado para os filtros informados.</td></tr>';
    }

    return items.map((item, index) => {
      const reserva = text(item?.reserva_cliente) || "-";
      const status = sLabel(item?.status);
      return `
        <tr>
          <td>
            <strong>${esc(`${index + 1}. ${text(item?.titulo) || "Imóvel não informado"}`)}</strong>
            <div class="table-muted">${esc(describeExportDetails(item))}</div>
          </td>
          <td>
            ${esc(describeExportLocation(item))}
            <div class="table-muted">${esc(address(item) || "Endereço não informado")}</div>
          </td>
          <td>${esc(status)}</td>
          <td>${esc(formatMoneyReport(item?.valor))}</td>
          <td>${esc(formatMoneyReport(item?.valor_garantido))}</td>
          <td>${esc(describeExportEntrega(item))}</td>
          <td>${esc(formatIntegerReport(item?.quantidade_midias))}</td>
          <td class="${reserva !== "-" ? "is-highlight" : ""}">${esc(reserva)}</td>
        </tr>
      `;
    }).join("");
  }

  function montarHtmlRelatórioCarteiraImoveis(items) {
    const metricas = computePortfolioMetrics(items);
    const destaque = items[0] || {};
    const dataEmissao = formatDateTimeReport(new Date());
    const filtrosDescricao = describeExportFilters();
    const distribuicao = `Disponíveis ${formatIntegerReport(metricas.disponiveis)} | Reservados ${formatIntegerReport(metricas.reservados)} | Vendidos ${formatIntegerReport(metricas.vendidos)} | Inativos ${formatIntegerReport(metricas.inativos)} | Cidades ${formatIntegerReport(metricas.cidades.size)}`;
    const detalhesDestaque = describeExportDetails(destaque);
    const localDestaque = describeExportLocation(destaque);
    const fotoUrl = normalizeExportMediaPath(destaque?.foto_principal);
    const logoUrl = new URL(shared.buildPortalPath("/02_recursos/03_imagens/logo_7lm.svg"), window.location.origin).href;
    const alertas = buildPortfolioAlerts(metricas);
    const badgeStatus = (metricas.reservados || metricas.vendidos || metricas.inativos || metricas.semMidias) ? "Em Ajuste" : "CARTEIRA Ativa";

    const resumoCarteiraCampos = [
      ["Filtros", filtrosDescricao],
      ["Distribuição", distribuicao],
      ["Total de unidades", formatIntegerReport(metricas.totalItens)],
      ["Emitido em", dataEmissao],
    ];
    const unidadeDestaqueCampos = [
      ["Unidade em destaque", text(destaque?.titulo) || "Nenhum imóvel encontrado"],
      ["Empreendimento", text(destaque?.empreendimento) || "Não informado"],
      ["Localização", localDestaque],
      ["Endereço", address(destaque) || "Não informado"],
      ["Valor do imóvel", formatMoneyReport(destaque?.valor)],
      ["Área", formatAreaReport(destaque?.area_m2)],
      ["Quartos", formatIntegerReport(destaque?.quartos)],
      ["Vagas", formatIntegerReport(destaque?.vagas_garagem ?? destaque?.vagas)],
      ["Garantido planejado", formatMoneyReport(destaque?.valor_garantido)],
      ["Pré-obra mínima", formatMoneyReport(destaque?.valor_parcela_minima_pre_obra)],
      ["Data de entrega", formatDateReport(destaque?.data_entrega)],
      ["Mídias publicadas", formatIntegerReport(destaque?.quantidade_midias)],
    ];
    const resumoFinanceiroCampos = [
      ["Valor total da carteira", formatMoneyReport(metricas.valorTotal)],
      ["Garantido total", formatMoneyReport(metricas.valorGarantidoTotal)],
      ["Ticket médio", formatMoneyReport(metricas.ticketMedio)],
      ["Garantido médio", formatMoneyReport(metricas.valorGarantidoMedio)],
      ["Pré-obra mídia", formatMoneyReport(metricas.preObraMedia)],
      ["Conclusão mídia", formatPercentReport(metricas.conclusaoMedia)],
      ["Mídias totais", formatIntegerReport(metricas.totalMidias)],
      ["Sem mídias", formatIntegerReport(metricas.semMidias)],
      ["Reservas ativas", formatIntegerReport(metricas.reservasAtivas)],
      ["Próxima entrega", metricas.proximaEntrega ? formatDateReport(metricas.proximaEntrega) : "-"],
    ];

    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>7LM - Relatório da carteira de imóveis</title>
  <style>
    @page { size: A4; margin: 9mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eaf8fb; color: #172033; font-family: Inter, Arial, sans-serif; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
    .hero-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 18px; margin-top: 24px; align-items: stretch; }
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
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .grid.grid-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .report-metric { min-height: 58px; border: 1px solid rgba(18, 24, 38, .07); border-radius: 15px; background: #f7fbfd; padding: 10px; overflow-wrap: anywhere; }
    .report-metric strong { display: block; color: #202838; font-size: 11.5px; line-height: 1.24; }
    .report-metric--dense { min-height: 52px; background: #f3f9fc; }
    .report-note { margin: 7px 0 0; padding: 10px 12px; border-radius: 14px; background: #f3f8fb; color: #465468; border: 1px solid rgba(18, 24, 38, .07); font-size: 11px; }
    table { width: 100%; border-collapse: collapse; font-size: 8.6px; table-layout: fixed; }
    th, td { padding: 6px 5px; border-bottom: 1px solid rgba(18, 24, 38, .08); text-align: left; vertical-align: top; }
    th { color: #627086; background: #eef8fb; font-size: 7.5px; letter-spacing: .11em; text-transform: uppercase; }
    tbody tr:nth-child(even) td { background: #fbfdfe; }
    tr { page-break-inside: avoid; }
    th:nth-child(1), td:nth-child(1) { width: 24%; }
    th:nth-child(2), td:nth-child(2) { width: 24%; }
    th:nth-child(3), td:nth-child(3) { width: 10%; }
    th:nth-child(4), td:nth-child(4), th:nth-child(5), td:nth-child(5) { width: 12%; }
    th:nth-child(6), td:nth-child(6) { width: 10%; }
    th:nth-child(7), td:nth-child(7) { width: 8%; }
    th:nth-child(8), td:nth-child(8) { width: 10%; }
    .table-muted { margin-top: 4px; color: #66758a; font-size: 7.7px; line-height: 1.35; }
    td.is-highlight { color: #9a6400; font-weight: 800; }
    .footer { margin-top: 16px; color: #697487; font-size: 10px; text-align: center; }
    @media screen and (max-width: 760px) { .page { margin: 0; border-radius: 0; padding: 18px; } .hero-grid, .grid, .grid.grid-5, .summary { grid-template-columns: 1fr; } h1 { font-size: 28px; } }
    @media print { body { background: #fff; } .print-action { display: none; } .page { width: 100%; margin: 0; padding: 0; border-radius: 0; box-shadow: none; background: #fff; } .hero { min-height: 308px; } .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } .grid.grid-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); } .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } .section { page-break-inside: avoid; } thead { display: table-header-group; } }
  </style>
</head>
<body>
  <button class="print-action" type="button" onclick="window.print()">Salvar como PDF</button>
  <main class="page">
    <section class="hero">
      <div class="brand">
        <img class="logo" src="${esc(logoUrl)}" alt="7LM" />
        <span class="badge">${esc(badgeStatus)}</span>
      </div>
      <h1>Relatório da carteira de imóveis</h1>
      <p class="subtitle">${esc(text(destaque?.titulo) || "Carteira comercial")} - Emitido em ${esc(dataEmissao)}</p>
      <p class="subtitle">Unidade em destaque | ${esc(localDestaque)} | ${esc(detalhesDestaque)}</p>
      <div class="hero-line"></div>
      <div class="hero-grid">
        <div class="photo">${fotoUrl ? `<img src="${esc(fotoUrl)}" alt="${esc(text(destaque?.titulo) || "Imóvel")}" />` : '<div class="photo-empty">Sem foto principal</div>'}</div>
        <div class="summary">
          <article class="is-wide"><span>Valor total da carteira</span><strong>${esc(formatMoneyReport(metricas.valorTotal))}</strong></article>
          <article><span>Garantido total</span><strong>${esc(formatMoneyReport(metricas.valorGarantidoTotal))}</strong></article>
          <article><span>Ticket médio</span><strong>${esc(formatMoneyReport(metricas.ticketMedio))}</strong></article>
          <article><span>Reservas ativas</span><strong>${esc(formatIntegerReport(metricas.reservasAtivas))}</strong></article>
          <article><span>Próxima entrega</span><strong>${esc(metricas.proximaEntrega ? formatDateReport(metricas.proximaEntrega) : "-")}</strong></article>
        </div>
      </div>
    </section>

    <section class="section">
      <span class="section-kicker">Resumo comercial</span>
      <h2>Carteira e unidade em destaque</h2>
      <div class="grid">${renderMetricCards(resumoCarteiraCampos)}</div>
      <div class="grid" style="margin-top: 8px;">${renderMetricCards(unidadeDestaqueCampos)}</div>
    </section>

    <section class="section">
      <span class="section-kicker">Indicadores da carteira</span>
      <h2>Resumo financeiro</h2>
      <div class="grid grid-5">${renderMetricCards(resumoFinanceiroCampos, "report-metric--dense")}</div>
    </section>

    <section class="section">
      <span class="section-kicker">Orientação</span>
      <h2>Alertas e recomendações</h2>
      ${renderReportAlerts(alertas)}
    </section>

    <section class="section section--break">
      <span class="section-kicker">Detalhamento da carteira</span>
      <h2>Lista de imóveis</h2>
      <table>
        <thead>
          <tr>
            <th>Imóvel</th>
            <th>Localização</th>
            <th>Status</th>
            <th>Valor</th>
            <th>Garantido</th>
            <th>Entrega</th>
            <th>Mídias</th>
            <th>Reserva</th>
          </tr>
        </thead>
        <tbody>${renderPortfolioRows(items)}</tbody>
      </table>
    </section>
    <p class="footer">Documento gerado pelo 7LM Connect. Valores sujeitos a validação comercial e documental.</p>
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

  function toggleExportMenu(open) {
    if (!el.menuExportacao || !el.btnAbrirExportacao) return;
    const aberto = Boolean(open);
    shared.toggleHidden(el.menuExportacao, !aberto);
    el.menuExportacao.toggleAttribute("inert", !aberto);
    el.menuExportacao.dataset.open = aberto ? "true" : "false";
    el.menuExportacao.setAttribute("aria-hidden", aberto ? "false" : "true");
    el.menuExportacao.style.display = aberto ? "" : "none";
    el.btnAbrirExportacao.classList.toggle("is-open", aberto);
    el.btnAbrirExportacao.setAttribute("aria-expanded", aberto ? "true" : "false");
  }

  async function exportarImoveis(formato, botao) {
    const format = text(formato).toLowerCase();
    if (!["csv", "xlsx", "pdf"].includes(format)) return;

    const labels = {
      csv: "CSV",
      xlsx: "Excel",
      pdf: "PDF",
    };

    toggleExportMenu(false);
    const exportButtons = Array.from(el.menuExportacao?.querySelectorAll("[data-export-format]") || []);
    if (botao instanceof HTMLButtonElement) botao.disabled = true;
    if (el.btnAbrirExportacao) el.btnAbrirExportacao.disabled = true;
    exportButtons.forEach((item) => {
      if (item instanceof HTMLButtonElement) item.disabled = true;
    });

    const reportWindow = format === "pdf"
      ? window.open("", "_blank", "width=1180,height=920")
      : null;

    if (format === "pdf" && !reportWindow) {
      shared.showInlineMessage(el.feedback, "warning", "O navegador bloqueou a janela do PDF. Libere pop-ups para o portal e tente novamente.");
      if (botao instanceof HTMLButtonElement) botao.disabled = false;
      if (el.btnAbrirExportacao) el.btnAbrirExportacao.disabled = false;
      exportButtons.forEach((item) => {
        if (item instanceof HTMLButtonElement) item.disabled = false;
      });
      return;
    }

    try {
      if (reportWindow) {
        reportWindow.document.open();
        reportWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Preparando relatório</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;font-family:Inter,Arial,sans-serif;background:#eef8fb;color:#172033}article{padding:24px 28px;border-radius:22px;background:#fff;box-shadow:0 18px 40px rgba(18,24,38,.12)}strong{display:block;margin-bottom:8px;font-size:18px}</style></head><body><article><strong>Preparando relatório da carteira...</strong><span>Carregando os imóveis filtrados e montando o PDF no padrão do simulador.</span></article></body></html>`);
        reportWindow.document.close();
      }

      if (format === "pdf") {
        const itens = await carregarImoveisExportacaoPdf();
        if (reportWindow) {
          reportWindow.document.open();
          reportWindow.document.write(montarHtmlRelatórioCarteiraImoveis(itens));
          reportWindow.document.close();
          reportWindow.focus();
        }
        shared.showInlineMessage(el.feedback, "success", "Relatório aberto. Use a opção Salvar como PDF na janela de impressão.");
        return;
      }

      const { blob, filename } = await shared.downloadFile(
        `${ENDPOINT_EXPORTAR}?${queryString(queryExportacao(format))}`,
        { method: "GET" },
      );
      const arquivo = filename || `imoveis-cadastrados.${format}`;
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = arquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 4000);
      shared.showInlineMessage(el.feedback, "success", `Exportação ${labels[format]} pronta. O download foi iniciado.`);
    } catch (error) {
      if (reportWindow) {
        reportWindow.close();
      }
      shared.showInlineMessage(el.feedback, "error", error.message || "Não foi possível exportar os imóveis.");
    } finally {
      if (botao instanceof HTMLButtonElement) botao.disabled = false;
      if (el.btnAbrirExportacao) el.btnAbrirExportacao.disabled = false;
      exportButtons.forEach((item) => {
        if (item instanceof HTMLButtonElement) item.disabled = false;
      });
    }
  }

  function syncPermissions() {
    const canManageRegistration = shared.canManagePropertyRegistration(state.user);
    permissions.canCreate = canManageRegistration;
    permissions.canEdit = canManageRegistration;
    permissions.canDelete = canManageRegistration;
    permissions.canMedia = canManageRegistration;
    shared.toggleHidden(el.btnNovo, !permissions.canCreate);
    shared.toggleHidden(el.btnAbrirEvolucaoLote, !permissions.canEdit);
    shared.toggleHidden(el.btnImportacao, !permissions.canCreate);
    if (el.btnNovo) el.btnNovo.href = shared.buildPortalPath(PATH_CADASTRO);
  }

  function loadFavoritos() {
    try {
      const raw = window.localStorage.getItem(FAVORITOS_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      state.favoritos = new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch {
      state.favoritos = new Set();
    }
  }

  function saveFavoritos() {
    try {
      window.localStorage.setItem(FAVORITOS_STORAGE_KEY, JSON.stringify(Array.from(state.favoritos)));
    } catch {}
  }

  function loadViewMode() {
    try {
      const v = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (v === "tecnica" || v === "comercial") state.viewMode = v;
    } catch {
      state.viewMode = "comercial";
    }
  }

  function setViewMode(mode) {
    state.viewMode = mode === "tecnica" ? "tecnica" : "comercial";
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, state.viewMode);
    } catch {}
    el.btnViewComercial?.classList.toggle("is-active", state.viewMode === "comercial");
    el.btnViewTecnica?.classList.toggle("is-active", state.viewMode === "tecnica");
    el.btnViewComercial?.setAttribute("aria-selected", state.viewMode === "comercial" ? "true" : "false");
    el.btnViewTecnica?.setAttribute("aria-selected", state.viewMode === "tecnica" ? "true" : "false");
    if (el.lista) el.lista.setAttribute("data-view-mode", state.viewMode);
  }

  function statusCounts(items) {
    const out = { disponivel: 0, reservado: 0, vendido: 0, inativo: 0, outros: 0 };
    items.forEach((item) => {
      const key = sKey(item.status);
      if (Object.prototype.hasOwnProperty.call(out, key)) out[key] += 1;
      else out.outros += 1;
    });
    return out;
  }

  function statusChips(c) {
    return Object.entries(c)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `<span class="tl-imoveis-chip tl-imoveis-chip--${esc(k)}">${esc(String(v))} ${esc(sLabel(k))}</span>`)
      .join("");
  }

  function groupItems(items) {
    const map = new Map();
    items.forEach((item) => {
      const a = item.agrupamento || {};
      const localNome = text(a.localidade || "Sem localidade");
      const blocoNome = text(a.bloco || "Sem bloco");
      const andarNome = text(a.andar || a.pavimento || "Andar não informado");
      if (!map.has(localNome)) map.set(localNome, { nome: localNome, blocos: new Map(), contexto: local(item), total: 0 });
      const locObj = map.get(localNome);
      locObj.total += 1;
      if (!locObj.blocos.has(blocoNome)) locObj.blocos.set(blocoNome, { nome: blocoNome, andares: new Map(), total: 0 });
      const blocoObj = locObj.blocos.get(blocoNome);
      blocoObj.total += 1;
      if (!blocoObj.andares.has(andarNome)) blocoObj.andares.set(andarNome, { nome: andarNome, itens: [] });
      blocoObj.andares.get(andarNome).itens.push(item);
    });
    return Array.from(map.values()).map((locObj) => {
      const blocos = Array.from(locObj.blocos.values()).map((b) => {
        const andares = Array.from(b.andares.values()).sort((a, z) => a.nome.localeCompare(z.nome));
        return { ...b, andares, itens: andares.flatMap((x) => x.itens) };
      }).sort((a, z) => a.nome.localeCompare(z.nome));
      return { ...locObj, blocos, itens: blocos.flatMap((b) => b.itens), totalAndares: blocos.reduce((s, b) => s + b.andares.length, 0) };
    });
  }

  function renderAcoes(id) {
    const btns = [`<button class="tl-imoveis-btn tl-imoveis-btn--secondary" data-action="ver-imovel" data-id="${esc(id)}">Ver imóvel</button>`];
    if (canOpenEditor()) btns.push(`<button class="tl-imoveis-btn" data-action="editar" data-id="${esc(id)}">${permissions.canEdit ? "Editar" : "Gerenciar mídias"}</button>`);
    if (permissions.canDelete) btns.push(`<button class="tl-imoveis-btn tl-imoveis-btn--danger" data-action="excluir" data-id="${esc(id)}">Excluir</button>`);
    return btns.join("");
  }

  function renderItemTecnico(item) {
    const reservaLabel = reservationLabel(item);
    const reservaMeta = reservationDetails(item);
    return `
      <article class="tl-imoveis-unit">
        <div class="tl-imoveis-unit__head">
          <div>
            <span class="tl-imoveis-eyebrow mono-font">${esc(item.tipo_imovel || "Imóvel")}</span>
            <div class="tl-imoveis-unit__title">${esc(item.titulo || "Imóvel")}</div>
          </div>
          <span class="tl-imoveis-badge tl-imoveis-badge--status tl-imoveis-badge--${esc(sKey(item.status))}">${esc(sLabel(item.status))}</span>
        </div>
        <div class="tl-imoveis-unit__stats">
          <span class="tl-imoveis-unit__stat">Valor: ${shared.formatCurrency(item.valor)}</span>
          <span class="tl-imoveis-unit__stat">Área: ${esc(area(item.area_m2))}</span>
          <span class="tl-imoveis-unit__stat">Mídias: ${esc(String(item.quantidade_midias || 0))}</span>
        </div>
        <div class="tl-imoveis-unit__meta"><strong>Local:</strong> <span>${esc(item.endereco || local(item))}</span></div>
        ${reservaLabel ? `<div class="tl-imoveis-unit__meta"><strong>Reserva:</strong> <span>${esc(reservaLabel)}</span>${reservaMeta ? `<small>${esc(reservaMeta)}</small>` : ""}</div>` : ""}
        <div class="tl-imoveis-unit__actions">${renderAcoes(item.id)}</div>
      </article>`;
  }

  function renderAndar(andar) {
    return `
      <article class="tl-imoveis-floor">
        <div class="tl-imoveis-floor__head">
          <span class="tl-imoveis-floor__title">${esc(andar.nome)}</span>
          <div class="tl-imoveis-floor__chips">
            <span class="tl-imoveis-chip">${esc(String(andar.itens.length))} unidade(s)</span>
            ${statusChips(statusCounts(andar.itens))}
          </div>
        </div>
        <div class="tl-imoveis-floor__rows">${andar.itens.map(renderItemTecnico).join("")}</div>
      </article>`;
  }

  function renderBloco(bloco) {
    return `
      <details class="tl-imoveis-bloco">
        <summary class="tl-imoveis-bloco__summary">
          <div><span class="tl-imoveis-eyebrow mono-font">BLOCO</span><strong>${esc(bloco.nome)}</strong></div>
          <div class="tl-imoveis-group__chips"><span class="tl-imoveis-chip">${esc(String(bloco.total))} imóvel(is)</span>${statusChips(statusCounts(bloco.itens))}</div>
          <span class="tl-imoveis-toggle">Ver andares</span>
        </summary>
        <div class="tl-imoveis-group__body">${bloco.andares.map(renderAndar).join("")}</div>
      </details>`;
  }

  function renderLocal(locObj) {
    return `
      <details class="tl-imoveis-local">
        <summary class="tl-imoveis-local__summary">
          <div><span class="tl-imoveis-eyebrow mono-font">LOCALIDADE</span><strong>${esc(locObj.nome)}</strong>${locObj.contexto ? `<small>${esc(locObj.contexto)}</small>` : ""}</div>
          <div class="tl-imoveis-local__chips"><span class="tl-imoveis-chip">${esc(String(locObj.total))} imóvel(is)</span><span class="tl-imoveis-chip">${esc(String(locObj.blocos.length))} bloco(s)</span><span class="tl-imoveis-chip">${esc(String(locObj.totalAndares))} andar(es)</span>${statusChips(statusCounts(locObj.itens))}</div>
        </summary>
        <div class="tl-imoveis-local__body">${locObj.blocos.map(renderBloco).join("")}</div>
      </details>`;
  }

  function commercialStats(items) {
    const valores = items.map((i) => num(i.valor)).filter((x) => x !== null).sort((a, b) => a - b);
    const p2 = items.map((i) => {
      const v = num(i.valor);
      const a = num(i.area_m2);
      return v !== null && a !== null && a > 0 ? v / a : null;
    }).filter((x) => x !== null).sort((a, b) => a - b);
    return {
      v1: valores.length ? valores[Math.floor((valores.length - 1) * 0.25)] : null,
      pm: p2.length ? p2[Math.floor((p2.length - 1) * 0.5)] : null,
    };
  }

  function badges(item, stats) {
    const out = [];
    const v = num(item.valor);
    const a = num(item.area_m2);
    const p2 = v !== null && a !== null && a > 0 ? v / a : null;
    const txt = `${text(item.titulo)} ${text(item.descricao)} ${text(item.tipo_imovel)}`.toLowerCase();
    if (sKey(item.status) === "disponivel" && stats.v1 !== null && v !== null && v <= stats.v1) out.push(["oportunidade", "Oportunidade"]);
    if (p2 !== null && stats.pm !== null && p2 <= stats.pm * 0.95) out.push(["custo", "Melhor custo-beneficio"]);
    if ((num(item.quartos) || 0) >= 3 && (num(item.banheiros) || 0) >= 2) out.push(["familia", "Ideal para familia"]);
    if (txt.includes("garden")) out.push(["garden", "Garden"]);
    if (txt.includes("cobertura")) out.push(["cobertura", "Cobertura"]);
    if (sKey(item.status) === "reservado") out.push(["procurado", "Mais procurado"]);
    return out.slice(0, 3);
  }

  function renderCard(item, stats) {
    const id = esc(item.id);
    const foto = pth(item.foto_principal);
    const fav = state.favoritos.has(String(item.id));
    const cmp = state.comparacao.has(String(item.id));
    const tags = badges(item, stats);
    const reservaLabel = reservationLabel(item);
    const reservaMeta = reservationDetails(item);
    const desconto = descontoPolicy(item);
    return `
      <article class="tl-imoveis-showcase-card" data-id="${id}" tabindex="0" role="button" aria-label="Abrir showroom de ${esc(item.titulo || "Imóvel")}">
        <div class="tl-imoveis-showcase-card__media">
          ${foto ? `<img src="${esc(foto)}" alt="${esc(item.titulo || "Imóvel")}" loading="lazy" class="tl-imoveis-showcase-card__hero" />` : `<div class="tl-imoveis-showcase-card__hero tl-imoveis-showcase-card__hero--empty"><span>Sem foto principal</span></div>`}
          <div class="tl-imoveis-showcase-card__top-actions">
            <button class="tl-imoveis-card-icon-btn ${fav ? "is-active" : ""}" type="button" data-action="favoritar" data-id="${id}" aria-label="Favoritar">${fav ? "&#9733;" : "&#9734;"}</button>
            <button class="tl-imoveis-card-icon-btn ${cmp ? "is-active" : ""}" type="button" data-action="comparar" data-id="${id}" aria-label="Comparar">&#8644;</button>
          </div>
          <span class="tl-imoveis-badge tl-imoveis-badge--status tl-imoveis-badge--${esc(sKey(item.status))}">${esc(sLabel(item.status))}</span>
          ${tags.length ? `<div class="tl-imoveis-showcase-card__badges">${tags.map(([k, l]) => `<span class="tl-imoveis-commercial-badge tl-imoveis-commercial-badge--${esc(k)}">${esc(l)}</span>`).join("")}</div>` : ""}
        </div>
        <div class="tl-imoveis-showcase-card__body">
          <div class="tl-imoveis-showcase-card__top">
            <span class="tl-imoveis-eyebrow mono-font">${esc(item.tipo_imovel || "Imóvel")}</span>
            <h3>${esc(item.titulo || "Imóvel")}</h3>
            <p>${esc(item?.detalhes_comerciais?.empreendimento || item?.agrupamento?.localidade || "Empreendimento não informado")}</p>
            <small>${esc(local(item))}</small>
          </div>
          <div class="tl-imoveis-showcase-card__price">${shared.formatCurrency(item.valor)}</div>
          <div class="tl-imoveis-showcase-card__reservation"><strong>Incentivo 7LM atual até ${esc(shared.formatCurrency(desconto.maximoEfetivo))}</strong><small>${esc(String(desconto.quantidade))} vendido(s)/pendente(s) de aprovação no agrupamento</small></div>
          ${reservaLabel ? `<div class="tl-imoveis-showcase-card__reservation"><strong>${esc(reservaLabel)}</strong>${reservaMeta ? `<small>${esc(reservaMeta)}</small>` : ""}</div>` : ""}
          <div class="tl-imoveis-showcase-card__meta">
            <span><b>${esc(String(num(item.quartos) ?? "-"))}</b><small>Quartos</small></span>
            <span><b>${esc(orientacao(item))}</b><small>Orientação</small></span>
            <span><b>${esc(String(num(item.vagas_garagem) ?? "-"))}</b><small>Vagas</small></span>
            <span><b>${esc(area(item.area_m2))}</b><small>Área</small></span>
            <span><b>${esc(percent(item.percentual_conclusao_obra || 0))}</b><small>Obra</small></span>
          </div>
          <div class="tl-imoveis-showcase-card__actions">${renderAcoes(item.id)}</div>
        </div>
      </article>`;
  }

  function renderCompareDock() {
    if (!el.compareDock || !el.compareItens) return;
    const ids = Array.from(state.comparacao);
    if (!ids.length) {
      shared.toggleHidden(el.compareDock, true);
      el.compareItens.innerHTML = "";
      return;
    }
    el.compareItens.innerHTML = ids.map((id) => {
      const item = state.byId.get(id) || state.details.get(id);
      return `<button class="tl-imoveis-compare-dock__item" type="button" data-action="remove-compare" data-id="${esc(id)}"><span>${esc(item?.titulo || id)}</span><strong>&times;</strong></button>`;
    }).join("");
    shared.toggleHidden(el.compareDock, false);
    if (el.btnAbrirComparacao) {
      el.btnAbrirComparacao.disabled = ids.length < 2;
      el.btnAbrirComparacao.textContent = `Comparar (${ids.length})`;
    }
  }

  function rerenderCurrentList() {
    if (!Array.isArray(state.items) || !state.items.length) return;
    const resumo = renderList(state.items);
    if (el.resumo) el.resumo.textContent = resumo;
  }

  function renderList(items) {
    state.items = items;
    state.byId = new Map(items.map((i) => [String(i.id), i]));
    state.comparacao = new Set(Array.from(state.comparacao).filter((id) => state.byId.has(id) || state.details.has(id)));
    if (!items.length) {
      el.lista.innerHTML = `<article class="tl-imoveis-empty"><strong>Nenhum imóvel encontrado</strong><p>Refine os filtros para continuar.</p></article>`;
      renderCompareDock();
      return "Nenhum imóvel encontrado.";
    }
    if (state.viewMode === "tecnica") {
      const locs = groupItems(items);
      el.lista.innerHTML = `<div class="tl-imoveis-group-list">${locs.map(renderLocal).join("")}</div>`;
      renderCompareDock();
      return `${items.length} imóvel(is) em ${locs.length} localidade(s).`;
    }
    const stats = commercialStats(items);
    el.lista.innerHTML = `<div class="tl-imoveis-showcase-grid">${items.map((i) => renderCard(i, stats)).join("")}</div>`;
    renderCompareDock();
    const c = statusCounts(items);
    return `${items.length} imóvel(is). Disponíveis: ${c.disponivel}, Reservados: ${c.reservado}, Vendidos: ${c.vendido}, Inativos: ${c.inativo}.`;
  }

  function renderLoading() {
    el.lista.innerHTML = `<article class="tl-imoveis-empty"><strong>Carregando imóveis...</strong><p>Aguarde enquanto consultamos a base.</p></article>`;
    if (el.resumo) el.resumo.textContent = "Carregando listagem de imóveis...";
  }

  function updatePagination(meta) {
    state.paginacao = meta;
    shared.toggleHidden(el.paginationWrap, meta.total_paginas <= 1);
    if (el.paginaInfo) el.paginaInfo.textContent = `Página ${meta.pagina} de ${meta.total_paginas} - ${meta.total} registro(s)`;
    if (el.btnAnterior) el.btnAnterior.disabled = !meta.tem_anterior;
    if (el.btnProxima) el.btnProxima.disabled = !meta.tem_proxima;
  }

  async function carregarImoveis() {
    shared.showInlineMessage(el.feedback, "", "");
    renderLoading();
    try {
      const payload = await shared.apiRequest(`${ENDPOINT_LISTAR}?${queryString(queryServidor())}`, { method: "GET" });
      const items = Array.isArray(payload.items) ? payload.items : [];
      const meta = payload.paginacao || { pagina: 1, total_paginas: 1, total: items.length, tem_anterior: false, tem_proxima: false };
      state.itemsBase = items;
      state.paginacaoBase = meta;
      atualizarFiltrosLista(items);
      aplicarFiltrosListaERenderizar();
    } catch (error) {
      shared.showInlineMessage(el.feedback, "error", error.message || "Não foi possível carregar os imóveis.");
      el.lista.innerHTML = `<article class="tl-imoveis-empty"><strong>Falha ao carregar</strong><p>${esc(error.message || "Tente novamente em instantes.")}</p></article>`;
      if (el.resumo) el.resumo.textContent = "Não foi possível carregar os imóveis.";
    }
  }

  function buildImportFormData() {
    const file = el.importArquivo?.files?.[0];
    const cidade = text(el.importCidade?.value);
    const bairro = text(el.importBairro?.value);
    if (!file) throw new Error("Selecione o arquivo da planilha.");
    if (!cidade || !bairro) throw new Error("Informe a cidade e o bairro padrao da importacao.");
    const fd = new FormData();
    fd.append("arquivo", file);
    fd.append("cidade_padrao", cidade);
    fd.append("bairro_padrao", bairro);
    fd.append("estado_padrao", text(el.importEstado?.value));
    fd.append("cep_padrao", text(el.importCep?.value));
    fd.append("endereco_base", text(el.importEndereco?.value));
    fd.append("tipo_imovel_padrao", text(el.importTipo?.value) || "Apartamento");
    fd.append("status_padrao", text(el.importStatus?.value) || "Disponivel");
    return fd;
  }

  function resetImportSummary() {
    if (!el.importResumo) return;
    el.importResumo.innerHTML = "";
    shared.toggleHidden(el.importResumo, true);
  }

  function renderImportSummary(summary) {
    if (!el.importResumo || !summary) return resetImportSummary();
    el.importResumo.innerHTML = `
      <div class="tl-imoveis-import-summary__stats">
        <article class="tl-imoveis-stat"><strong>Arquivo:</strong> ${esc(summary.arquivo || "-")}</article>
        <article class="tl-imoveis-stat"><strong>Linhas:</strong> ${esc(String(summary.total_linhas || 0))}</article>
        <article class="tl-imoveis-stat"><strong>Importados:</strong> ${esc(String(summary.total_importados || 0))}</article>
        <article class="tl-imoveis-stat"><strong>Atualizados:</strong> ${esc(String(summary.total_atualizados || 0))}</article>
        <article class="tl-imoveis-stat"><strong>Ignorados:</strong> ${esc(String(summary.total_ignorados || 0))}</article>
        <article class="tl-imoveis-stat"><strong>Erros:</strong> ${esc(String(summary.total_erros || 0))}</article>
      </div>`;
    shared.toggleHidden(el.importResumo, false);
  }

  async function importarPlanilha(event) {
    event.preventDefault();
    if (!permissions.canCreate) return;
    shared.showInlineMessage(el.feedback, "", "");
    resetImportSummary();
    if (el.btnImportar) el.btnImportar.disabled = true;
    try {
      const payload = await shared.apiRequest(ENDPOINT_IMPORTAR, { method: "POST", body: buildImportFormData() });
      renderImportSummary(payload.resumo || null);
      shared.showInlineMessage(el.feedback, "success", payload.mensagem || "Importacao concluida com sucesso.");
      if (el.importArquivo) el.importArquivo.value = "";
      state.pagina = 1;
      await carregarImoveis();
    } catch (error) {
      renderImportSummary(error?.payload?.resumo || null);
      shared.showInlineMessage(el.feedback, "error", error.message || "Não foi possível importar a planilha.");
    } finally {
      if (el.btnImportar) el.btnImportar.disabled = false;
    }
  }

  function sortedCurrentItems() {
    return [...(Array.isArray(state.items) ? state.items : [])].sort((a, b) => itemLabel(a).localeCompare(itemLabel(b), "pt-BR"));
  }

  function selectedEvolucaoReferenceItem() {
    const id = text(el.evolucaoReferencia?.value);
    if (!id) return null;
    return state.byId.get(id) || state.details.get(id) || state.items.find((item) => String(item?.id) === id) || null;
  }

  function renderEvolucaoLoteOptions(selectedId = "") {
    if (!el.evolucaoReferencia) return;
    const items = sortedCurrentItems();
    if (!items.length) {
      el.evolucaoReferencia.innerHTML = `<option value="">Nenhum imóvel carregado na tela</option>`;
      el.evolucaoReferencia.value = "";
      setupCustomSelect(el.evolucaoReferencia);
      return;
    }
    el.evolucaoReferencia.innerHTML = items.map((item) => `
      <option value="${esc(String(item.id || ""))}">${esc(itemLabel(item))}</option>
    `).join("");
    const preferred = items.find((item) => String(item.id) === String(selectedId)) || items[0];
    el.evolucaoReferencia.value = String(preferred?.id || "");
    setupCustomSelect(el.evolucaoReferencia);
  }

  function currentEvolucaoLoteMatches(item = selectedEvolucaoReferenceItem()) {
    if (!item) return [];
    const reference = lotAddressData(item);
    if (!reference.base) return [];
    return sortedCurrentItems().filter((candidate) => isSameLotAddress(reference, candidate));
  }

  function renderEvolucaoLoteList(matches, item) {
    if (!el.evolucaoLista) return;

    if (!matches.length) {
      el.evolucaoLista.innerHTML = `
        <article class="tl-imoveis-evolucao-lote__empty">
          <strong>Nenhuma unidade disponível para seleção</strong>
          <p>Escolha uma unidade de referência com endereço base válido para carregar o lote desta tela.</p>
        </article>`;
      if (el.evolucaoSelecaoResumo) el.evolucaoSelecaoResumo.textContent = "Nenhuma unidade selecionada";
      if (el.evolucaoSelecaoHint) el.evolucaoSelecaoHint.textContent = "Assim que o lote for identificado, você poderá marcar várias unidades e aplicar a mesma evolução.";
      if (el.btnEvolucaoSelecionarTodas) el.btnEvolucaoSelecionarTodas.disabled = true;
      if (el.btnEvolucaoLimparSelecao) el.btnEvolucaoLimparSelecao.disabled = true;
      return;
    }

    const selectedCount = state.evolucaoSelecionados.size;
    if (el.evolucaoSelecaoResumo) {
      el.evolucaoSelecaoResumo.textContent = `${selectedCount} de ${matches.length} unidade(s) selecionada(s)`;
    }
    if (el.evolucaoSelecaoHint) {
      const referencia = text(item?.titulo) || "Unidade de referência";
      el.evolucaoSelecaoHint.textContent = `Lote carregado a partir de ${referencia}. Clique nas unidades abaixo para incluir ou remover da atualização.`;
    }
    if (el.btnEvolucaoSelecionarTodas) el.btnEvolucaoSelecionarTodas.disabled = false;
    if (el.btnEvolucaoLimparSelecao) el.btnEvolucaoLimparSelecao.disabled = selectedCount === 0;

    el.evolucaoLista.innerHTML = matches.map((candidate) => {
      const candidateId = String(candidate?.id || "");
      const selected = state.evolucaoSelecionados.has(candidateId);
      const bloco = text(candidate?.agrupamento?.bloco || candidate?.detalhes_comerciais?.bloco);
      const pavimento = text(candidate?.agrupamento?.pavimento || candidate?.detalhes_comerciais?.pavimento);
      const meta = [
        bloco ? `Bloco ${bloco}` : "",
        pavimento ? `Pavimento ${pavimento}` : "",
        local(candidate) !== "Local não informado" ? local(candidate) : "",
      ].filter(Boolean).join(" • ");
      return `
        <button
          class="tl-imoveis-evolucao-lote__option ${selected ? "is-selected" : ""}"
          type="button"
          role="option"
          aria-selected="${selected ? "true" : "false"}"
          data-action="toggle-evolucao-item"
          data-id="${esc(candidateId)}"
        >
          <span class="tl-imoveis-evolucao-lote__check" aria-hidden="true"></span>
          <span class="tl-imoveis-evolucao-lote__copy">
            <strong>${esc(text(candidate?.titulo) || "Imóvel sem Título")}</strong>
            <span>${esc(meta || address(candidate) || "Endereço não informado")}</span>
          </span>
          <span class="tl-imoveis-evolucao-lote__stats">
            <small>${esc(sLabel(candidate?.status))}</small>
            <strong>${esc(percent(candidate?.percentual_conclusao_obra || 0))}</strong>
          </span>
        </button>`;
    }).join("");
  }

  function refreshEvolucaoLoteSummary({ resetSelection = false } = {}) {
    const item = selectedEvolucaoReferenceItem();
    if (!item) {
      state.evolucaoSelecionados.clear();
      if (el.evolucaoResumoLote) el.evolucaoResumoLote.textContent = "Selecione uma unidade para iniciar";
      if (el.evolucaoResumoEndereco) el.evolucaoResumoEndereco.textContent = "O sistema vai procurar todas as unidades com o mesmo endereço base da referência escolhida.";
      if (el.evolucaoResumoContagem) el.evolucaoResumoContagem.textContent = "Escolha uma unidade de referência para carregar o lote.";
      renderEvolucaoLoteList([], null);
      if (el.btnAplicarEvolucaoLote) el.btnAplicarEvolucaoLote.disabled = true;
      return;
    }

    const reference = lotAddressData(item);
    const matches = currentEvolucaoLoteMatches(item);
    const visibleCount = matches.length || 1;
    const allowedIds = new Set(matches.map((candidate) => String(candidate?.id || "")));

    if (resetSelection) {
      state.evolucaoSelecionados = new Set(matches.map((candidate) => String(candidate?.id || "")));
    } else {
      state.evolucaoSelecionados = new Set(
        Array.from(state.evolucaoSelecionados).filter((candidateId) => allowedIds.has(candidateId))
      );
    }

    if (el.evolucaoResumoLote) {
      el.evolucaoResumoLote.textContent = reference.base
        ? `${visibleCount} unidade(s) com o mesmo endereço nesta tela`
        : "Endereço base insuficiente para atualizar em lote";
    }
    if (el.evolucaoResumoEndereco) {
      el.evolucaoResumoEndereco.textContent = address(item) || "Endereço não informado para a unidade selecionada.";
    }
    if (el.evolucaoResumoContagem) {
      if (!reference.base) {
        el.evolucaoResumoContagem.textContent = "A unidade escolhida precisa ter endereço base suficiente para aplicar a evolução em lote.";
      } else {
        const selectedCount = state.evolucaoSelecionados.size;
        el.evolucaoResumoContagem.textContent = `Referência: ${text(item.titulo) || "Imóvel"} • ${selectedCount} de ${visibleCount} unidade(s) marcadas para esta atualização.`;
      }
    }
    renderEvolucaoLoteList(matches, item);
    if (el.btnAplicarEvolucaoLote) el.btnAplicarEvolucaoLote.disabled = !reference.base || state.evolucaoSelecionados.size === 0;
  }

  function toggleEvolucaoLoteSelection(id) {
    const key = String(id || "");
    if (!key) return;
    if (state.evolucaoSelecionados.has(key)) state.evolucaoSelecionados.delete(key);
    else state.evolucaoSelecionados.add(key);
    refreshEvolucaoLoteSummary();
  }

  function selectAllEvolucaoLoteItems() {
    const matches = currentEvolucaoLoteMatches();
    state.evolucaoSelecionados = new Set(matches.map((item) => String(item?.id || "")));
    refreshEvolucaoLoteSummary();
  }

  function clearEvolucaoLoteSelection() {
    state.evolucaoSelecionados.clear();
    refreshEvolucaoLoteSummary();
  }

  function openEvolucaoLoteModal(preferredId = "") {
    if (!permissions.canEdit) return;
    if (!Array.isArray(state.items) || !state.items.length) {
      shared.showInlineMessage(el.feedback, "warning", "Carregue a listagem de imóveis antes de atualizar a obra em lote.");
      return;
    }
    renderEvolucaoLoteOptions(preferredId);
    if (el.evolucaoPercentual) el.evolucaoPercentual.value = "";
    if (el.evolucaoObservacoes) el.evolucaoObservacoes.value = "";
    if (el.evolucaoData) el.evolucaoData.value = dateInputValue();
    refreshEvolucaoLoteSummary({ resetSelection: true });
    toggleModal(el.evolucaoSection, true);
    window.requestAnimationFrame(() => el.evolucaoPercentual?.focus());
  }

  async function aplicarEvolucaoLote(event) {
    event.preventDefault();
    if (!permissions.canEdit) return;

    const item = selectedEvolucaoReferenceItem();
    const identificadorImovel = text(item?.id || el.evolucaoReferencia?.value);
    const percentual = parsePercentInput(el.evolucaoPercentual?.value);
    const identificadoresSelecionados = Array.from(state.evolucaoSelecionados);
    if (!identificadorImovel || !item) {
      shared.showInlineMessage(el.feedback, "error", "Selecione uma unidade de referência para aplicar a evolução em lote.");
      return;
    }
    if (!identificadoresSelecionados.length) {
      shared.showInlineMessage(el.feedback, "error", "Selecione pelo menos uma unidade do lote para aplicar a evolução da obra.");
      return;
    }
    if (percentual === null || percentual < 0 || percentual > 100) {
      shared.showInlineMessage(el.feedback, "error", "Informe um percentual da obra válido entre 0 e 100.");
      el.evolucaoPercentual?.focus();
      return;
    }
    if (!lotAddressData(item).base) {
      shared.showInlineMessage(el.feedback, "error", "A unidade escolhida não possui endereço suficiente para atualizar o lote.");
      return;
    }

    const payload = {
      percentual_conclusao_obra: Number(percentual.toFixed(2)),
      data_referência: text(el.evolucaoData?.value) || dateInputValue(),
      observacoes: text(el.evolucaoObservacoes?.value) || undefined,
      identificadores_imoveis: identificadoresSelecionados,
    };

    if (el.btnAplicarEvolucaoLote) el.btnAplicarEvolucaoLote.disabled = true;
    if (el.btnEvolucaoSelecionarTodas) el.btnEvolucaoSelecionarTodas.disabled = true;
    if (el.btnEvolucaoLimparSelecao) el.btnEvolucaoLimparSelecao.disabled = true;
    if (el.evolucaoReferencia) el.evolucaoReferencia.disabled = true;
    if (el.evolucaoPercentual) el.evolucaoPercentual.disabled = true;
    if (el.evolucaoData) el.evolucaoData.disabled = true;
    if (el.evolucaoObservacoes) el.evolucaoObservacoes.disabled = true;
    if (el.evolucaoLista) el.evolucaoLista.setAttribute("aria-disabled", "true");
    refreshCustomSelect(el.evolucaoReferencia);

    try {
      const response = await shared.apiRequest(
        shared.buildEndpoint(ENDPOINT_EVOLUCAO_LOTE, { id: identificadorImovel }),
        { method: "POST", body: payload },
      );
      toggleModal(el.evolucaoSection, false);
      shared.showInlineMessage(el.feedback, "success", response?.mensagem || "Evolução da obra aplicada em lote com sucesso.");
      await carregarImoveis();
    } catch (error) {
      shared.showInlineMessage(el.feedback, "error", error.message || "Não foi possível aplicar a evolução da obra em lote.");
    } finally {
      if (el.btnAplicarEvolucaoLote) el.btnAplicarEvolucaoLote.disabled = false;
      if (el.btnEvolucaoSelecionarTodas) el.btnEvolucaoSelecionarTodas.disabled = false;
      if (el.btnEvolucaoLimparSelecao) el.btnEvolucaoLimparSelecao.disabled = false;
      if (el.evolucaoReferencia) el.evolucaoReferencia.disabled = false;
      if (el.evolucaoPercentual) el.evolucaoPercentual.disabled = false;
      if (el.evolucaoData) el.evolucaoData.disabled = false;
      if (el.evolucaoObservacoes) el.evolucaoObservacoes.disabled = false;
      if (el.evolucaoLista) el.evolucaoLista.removeAttribute("aria-disabled");
      refreshCustomSelect(el.evolucaoReferencia);
      refreshEvolucaoLoteSummary();
    }
  }

  async function detalhe(id, force) {
    const key = String(id || "");
    if (!key) return null;
    if (!force && state.details.has(key)) return state.details.get(key);
    const payload = await shared.apiRequest(shared.buildEndpoint(ENDPOINT_DETALHE, { id: key }), { method: "GET" });
    const item = payload?.item || null;
    if (item?.foto_principal) item.foto_principal = pth(item.foto_principal);
    if (item) state.details.set(key, item);
    return item;
  }

  function normalizeMidias(item) {
    const list = Array.isArray(item?.midias) ? item.midias : [];
    const parsed = list
      .map((m) => ({ ...m, caminho_arquivo: pth(m.caminho_arquivo), tipo_arquivo: text(m.tipo_arquivo).toLowerCase() }))
      .filter((m) => m.caminho_arquivo);
    if (!parsed.length && item?.foto_principal) {
      parsed.push({
        id: `principal-${item.id}`,
        tipo_arquivo: "foto",
        nome_arquivo: item.foto_principal_nome || item.titulo || "Foto",
        caminho_arquivo: pth(item.foto_principal),
      });
    }
    return parsed;
  }

  function openLightbox(midias, idx) {
    const fotos = (midias || []).filter((m) => m.tipo_arquivo !== "video");
    if (!fotos.length) return;
    const lb = document.getElementById("tl-imoveis-lightbox");
    if (!lb) return;
    lb.innerHTML = `
      <div class="tl-imoveis-lightbox__backdrop"></div>
      <div class="tl-imoveis-lightbox__ambient" aria-hidden="true"></div>
      <div class="tl-imoveis-lightbox__content">
        <div class="tl-imoveis-lightbox__panel" role="dialog" aria-modal="true" aria-label="Visualizador de imagens do imóvel">
          <div class="tl-imoveis-lightbox__toolbar">
            <div class="tl-imoveis-lightbox__headline">
              <span class="tl-imoveis-eyebrow mono-font">Galeria Premium</span>
              <strong class="tl-imoveis-lightbox__caption">Visualização ampliada</strong>
              <small class="tl-imoveis-lightbox__hint">Role para aproximar, dê duplo clique para destacar e arraste quando estiver em zoom.</small>
            </div>
            <div class="tl-imoveis-lightbox__zoom-actions">
              <button class="tl-imoveis-lightbox__zoom-btn" type="button" data-action="zoom-out" aria-label="Diminuir zoom">-</button>
              <button class="tl-imoveis-lightbox__zoom-btn" type="button" data-action="zoom-reset" aria-label="Resetar zoom">100%</button>
              <button class="tl-imoveis-lightbox__zoom-btn" type="button" data-action="zoom-in" aria-label="Aumentar zoom">+</button>
              <button class="tl-imoveis-lightbox__close" type="button" aria-label="Fechar">&times;</button>
            </div>
          </div>
          <div class="tl-imoveis-lightbox__stage">
            <button class="tl-imoveis-lightbox__nav tl-imoveis-lightbox__prev" type="button" aria-label="Imagem anterior">&lsaquo;</button>
            <div class="tl-imoveis-lightbox__image-wrap">
              <img class="tl-imoveis-lightbox__img" alt="Mídia" />
            </div>
            <button class="tl-imoveis-lightbox__nav tl-imoveis-lightbox__next" type="button" aria-label="Próxima imagem">&rsaquo;</button>
          </div>
          <div class="tl-imoveis-lightbox__footer">
            <span class="tl-imoveis-lightbox__counter">1 / ${fotos.length}</span>
            <div class="tl-imoveis-lightbox__progress"><span></span></div>
            <div class="tl-imoveis-lightbox__thumbs" aria-label="Miniaturas da galeria"></div>
          </div>
        </div>
      </div>`;
    let i = Math.max(0, Math.min(Number(idx) || 0, fotos.length - 1));
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartPanX = 0;
    let dragStartPanY = 0;
    const ZOOM_MIN = 1;
    const ZOOM_MAX = 3.4;
    const ZOOM_STEP = 0.22;
    const img = lb.querySelector(".tl-imoveis-lightbox__img");
    const caption = lb.querySelector(".tl-imoveis-lightbox__caption");
    const counter = lb.querySelector(".tl-imoveis-lightbox__counter");
    const thumbs = lb.querySelector(".tl-imoveis-lightbox__thumbs");
    const zoomReset = lb.querySelector("[data-action='zoom-reset']");
    const stage = lb.querySelector(".tl-imoveis-lightbox__stage");
    const progress = lb.querySelector(".tl-imoveis-lightbox__progress span");
    const clampZoom = (v) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v));
    const clampPan = () => {
      if (!stage) return;
      const maxX = zoom > 1 ? (stage.clientWidth * (zoom - 1)) / 2 : 0;
      const maxY = zoom > 1 ? (stage.clientHeight * (zoom - 1)) / 2 : 0;
      panX = Math.max(-maxX, Math.min(maxX, panX));
      panY = Math.max(-maxY, Math.min(maxY, panY));
    };
    const applyTransform = () => {
      clampPan();
      if (img) {
        img.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`;
        img.classList.toggle("is-zoomed", zoom > 1.01);
      }
      stage?.classList.toggle("is-zoomed", zoom > 1.01);
      if (zoomReset) zoomReset.textContent = `${Math.round(zoom * 100)}%`;
    };
    const applyZoom = (nextZoom) => {
      zoom = clampZoom(nextZoom);
      if (zoom <= 1.01) {
        zoom = 1;
        panX = 0;
        panY = 0;
      }
      applyTransform();
    };
    const resetZoom = () => applyZoom(1);
    const renderThumbs = () => {
      if (!thumbs) return;
      thumbs.innerHTML = fotos.map((foto, index) => `
        <button class="tl-imoveis-lightbox__thumb ${index === i ? "is-active" : ""}" type="button" data-index="${index}" aria-label="Abrir imagem ${index + 1}">
          <img src="${esc(pth(foto.caminho_arquivo))}" alt="${esc(foto.nome_arquivo || `Imagem ${index + 1}`)}" loading="lazy" />
        </button>`).join("");
    };
    const show = (x) => {
      i = (x + fotos.length) % fotos.length;
      const foto = fotos[i];
      const src = pth(foto.caminho_arquivo);
      if (img) {
        img.classList.add("is-loading");
        img.src = src;
        img.alt = foto.nome_arquivo || "Mídia";
        img.onload = () => img.classList.remove("is-loading");
      }
      if (caption) caption.textContent = foto.nome_arquivo || state.showroomItem?.titulo || "Visualização ampliada";
      const safeImageUrl = `url("${src.replace(/"/g, "%22")}")`;
      lb.style.setProperty("--tl-lightbox-image", safeImageUrl);
      stage?.style.setProperty("--tl-lightbox-image", safeImageUrl);
      if (counter) counter.textContent = `${i + 1} / ${fotos.length}`;
      if (progress) progress.style.width = `${((i + 1) / fotos.length) * 100}%`;
      renderThumbs();
      resetZoom();
    };
    const onKey = (event) => {
      if (!lb.classList.contains("is-open")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowLeft") return void show(i - 1);
      if (event.key === "ArrowRight") return void show(i + 1);
      if (event.key === "+" || event.key === "=") return void applyZoom(zoom + ZOOM_STEP);
      if (event.key === "-") return void applyZoom(zoom - ZOOM_STEP);
      if (event.key === "0") return void resetZoom();
    };
    const close = () => {
      lb.classList.remove("is-open");
      document.body.classList.remove("tl-imoveis-lightbox-open");
      document.removeEventListener("keydown", onKey);
    };
    lb.querySelector(".tl-imoveis-lightbox__close")?.addEventListener("click", close);
    lb.querySelector(".tl-imoveis-lightbox__backdrop")?.addEventListener("click", close);
    lb.querySelector(".tl-imoveis-lightbox__prev")?.addEventListener("click", () => show(i - 1));
    lb.querySelector(".tl-imoveis-lightbox__next")?.addEventListener("click", () => show(i + 1));
    lb.querySelector("[data-action='zoom-in']")?.addEventListener("click", () => applyZoom(zoom + ZOOM_STEP));
    lb.querySelector("[data-action='zoom-out']")?.addEventListener("click", () => applyZoom(zoom - ZOOM_STEP));
    lb.querySelector("[data-action='zoom-reset']")?.addEventListener("click", resetZoom);
    thumbs?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest(".tl-imoveis-lightbox__thumb");
      if (!(button instanceof HTMLElement)) return;
      const index = Number(button.getAttribute("data-index"));
      if (Number.isFinite(index)) show(index);
    });
    stage?.addEventListener("wheel", (event) => {
      event.preventDefault();
      applyZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    }, { passive: false });
    stage?.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (zoom <= 1.01 || !(target instanceof HTMLElement) || target.closest("button")) return;
      isDragging = true;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragStartPanX = panX;
      dragStartPanY = panY;
      stage.classList.add("is-dragging");
      stage.setPointerCapture?.(event.pointerId);
    });
    stage?.addEventListener("pointermove", (event) => {
      if (!isDragging) return;
      panX = dragStartPanX + event.clientX - dragStartX;
      panY = dragStartPanY + event.clientY - dragStartY;
      applyTransform();
    });
    const stopDrag = (event) => {
      if (!isDragging) return;
      isDragging = false;
      stage?.classList.remove("is-dragging");
      try {
        stage?.releasePointerCapture?.(event.pointerId);
      } catch {
        // Ignora navegadores que encerram a captura do ponteiro automaticamente.
      }
    };
    stage?.addEventListener("pointerup", stopDrag);
    stage?.addEventListener("pointercancel", stopDrag);
    stage?.addEventListener("pointerleave", stopDrag);
    img?.addEventListener("dblclick", () => {
      if (zoom > 1) resetZoom();
      else applyZoom(2);
    });
    lb.classList.add("is-open");
    document.body.classList.add("tl-imoveis-lightbox-open");
    document.addEventListener("keydown", onKey);
    show(i);
  }

  function renderCarousel() {
    const stage = document.getElementById("imoveisShowroomCarouselStage");
    const thumbs = document.getElementById("imoveisShowroomCarouselThumbs");
    const count = document.getElementById("imoveisShowroomCarouselCount");
    if (!stage || !thumbs || !count) return;
    const arr = state.showroomMidias;
    if (!arr.length) {
      stage.innerHTML = `<div class="tl-imoveis-showroom__media-empty"><strong>Sem fotos disponíveis</strong><p>Este imóvel ainda não possui imagens cadastradas.</p></div>`;
      thumbs.innerHTML = "";
      count.textContent = "0 / 0";
      return;
    }
    state.showroomIndex = Math.max(0, Math.min(state.showroomIndex, arr.length - 1));
    const m = arr[state.showroomIndex];
    stage.innerHTML = `
      <button class="tl-imoveis-showroom__nav tl-imoveis-showroom__nav--prev" type="button" data-action="show-prev">&lsaquo;</button>
      <div class="tl-imoveis-showroom__stage-inner" data-showroom-stage="1">
        ${m.tipo_arquivo === "video" ? `<video src="${esc(m.caminho_arquivo)}" controls preload="metadata" class="tl-imoveis-showroom__media-video"></video>` : `<img src="${esc(m.caminho_arquivo)}" alt="${esc(m.nome_arquivo || state.showroomItem?.titulo || "Mídia")}" class="tl-imoveis-showroom__media-img" loading="eager" />`}
        ${m.tipo_arquivo === "video" ? "" : `<button class="tl-imoveis-showroom__zoom" type="button" data-action="show-zoom">Ampliar</button>`}
      </div>
      <button class="tl-imoveis-showroom__nav tl-imoveis-showroom__nav--next" type="button" data-action="show-next">&rsaquo;</button>`;
    thumbs.innerHTML = arr.map((x, i) => `<button class="tl-imoveis-showroom__thumb ${i === state.showroomIndex ? "is-active" : ""}" type="button" data-action="show-go" data-index="${i}">${x.tipo_arquivo === "video" ? "<span class='tl-imoveis-showroom__thumb-video'>Vídeo</span>" : `<img src="${esc(x.caminho_arquivo)}" alt="${esc(x.nome_arquivo || "Miniatura")}" loading="lazy" />`}</button>`).join("");
    count.textContent = `${state.showroomIndex + 1} / ${arr.length}`;
  }

  function infoShowroom(item) {
    const d = item?.detalhes_comerciais || {};
    const locx = item?.localizacao || {};
    const difs = Array.isArray(item?.diferenciais_comerciais)
      ? item.diferenciais_comerciais
          .filter((x) => text(x))
          .map((x) => text(x))
          .slice(0, 10)
      : [];
    const empreendimento = d.empreendimento || item?.agrupamento?.localidade || item?.bairro || "Empreendimento não informado";
    const localCompacto = [locx.bairro || item?.bairro, locx.cidade || item?.cidade, locx.estado || item?.estado].filter(Boolean).join(" - ") || "Bairro e cidade não informados";
    const enderecoCompleto = address(item) || "Endereço não informado";
    const areaPrivativa = areaMetric(text(d.area_privativa) || item.area_m2);
    const areaTotal = areaMetric(text(d.area_total));
    const statusLabel = sLabel(item.status);
    const disponibilidadeLabel = statusLabel === "Disponível" ? "Pronto para proposta" : statusLabel;
    const reservaAtual = reservation(item);
    const vendido = isSold(item);
    const simulacaoPdfId = linkedSimulationId(item);
    const mostrarLiberarReserva = !vendido && permissions.canEdit && canReleaseReservation(item);
    const reservaLabel = reservationLabel(item);
    const reservaMeta = reservationDetails(item);
    const desconto = descontoPolicy(item);
    const showroomSimularLabel = reservaAtual?.simulacao_id
      ? "Continuar negociação"
      : (reservaAtual ? "Abrir reserva no simulador" : "Simular com este imóvel");
    const vistaInfo = text(d.vista) || extrairValorDiferencial(item, "Vista");
    const condicaoInfo = text(d.condicao_especial) || extrairValorDiferencial(item, "Condição especial");
    const possuiSuite = difs.some((valor) => ["SUITE", "SUITES"].includes(normalizeToken(valor)));
    const diferenciaisCompactos = unique(
      difs
        .filter((valor) => {
          const token = normalizeToken(valor);
          return token
            && !["SUITE", "SUITES"].includes(token)
            && !token.startsWith("ORIENTACAO")
            && !token.startsWith("POSICAO")
            && !token.startsWith("VISTA")
            && !token.startsWith("CONDICAOESPECIAL");
        })
        .map((valor) => compact(valor, 26))
    ).slice(0, 6);
    const infoCards = [
      { label: "Unidade", value: d.unidade || item?.agrupamento?.unidade || "-" },
      { label: "Bloco", value: d.bloco || item?.agrupamento?.bloco || "-" },
      { label: "Pavimento", value: d.pavimento || item?.agrupamento?.pavimento || "-" },
      { label: "Quartos", value: String(num(item.quartos) ?? "-") },
      { label: "Orientação", value: orientacao(item) },
      { label: "Vagas", value: String(num(item.vagas_garagem) ?? "-") },
      { label: "Área privativa", value: areaPrivativa },
      { label: "Área total", value: areaTotal },
      { label: "Incentivo 7LM atual", value: shared.formatCurrency(desconto.maximoEfetivo) },
      { label: "Incentivo 7LM mín./máx.", value: `${shared.formatCurrency(desconto.minimo)} / ${shared.formatCurrency(desconto.maximoConfigurado)}` },
      { label: "Reservas/vendas", value: String(desconto.quantidade) },
      { label: "Data entrega", value: dateLabel(item.data_entrega) || "-" },
      { label: "Entrega", value: `${num(item.meses_pre_entrega) ?? 36} meses` },
      { label: "Pós-entrega", value: `${num(item.meses_pos_entrega) ?? 24} meses` },
      { label: "Obra", value: percent(item.percentual_conclusao_obra || 0) },
      { label: "Posição", value: text(d.posicao) || "-" },
      possuiSuite ? { label: "Suíte", value: "Sim" } : null,
      vistaInfo ? { label: "Vista", value: vistaInfo } : null,
      condicaoInfo ? { label: "Condição", value: condicaoInfo } : null,
    ].filter(Boolean);
    return {
      left: `
      <div class="tl-imoveis-showroom__actions-wrap">
        <div class="tl-imoveis-showroom__actions-head">
          <span class="tl-imoveis-eyebrow mono-font">AÇÕES</span>
          <small>Atalhos da unidade</small>
        </div>
        <div class="tl-imoveis-showroom__actions tl-imoveis-showroom__actions--primary">
          <button class="tl-imoveis-btn tl-imoveis-showroom__action-btn--wide" type="button" data-action="show-simular" ${vendido ? 'disabled title="Imóvel vendido não pode abrir nova simulação."' : ""}>${esc(showroomSimularLabel)}</button>
          ${vendido ? `<button class="tl-imoveis-btn tl-imoveis-btn--secondary tl-imoveis-showroom__action-btn--wide" type="button" data-action="show-exportar-pdf">Exportar PDF</button>` : ""}
          <button class="tl-imoveis-btn tl-imoveis-btn--secondary" type="button" data-action="show-reservar" ${permissions.canEdit && !vendido ? "" : "disabled"}>Reservar</button>
          <button class="tl-imoveis-btn tl-imoveis-btn--secondary" type="button" data-action="show-vender" ${permissions.canEdit && !vendido ? "" : "disabled"}>Marcar como venda</button>
          ${mostrarLiberarReserva ? `<button class="tl-imoveis-btn tl-imoveis-btn--ghost" type="button" data-action="show-liberar-reserva">Liberar reserva</button>` : ""}
        </div>
        <div class="tl-imoveis-showroom__actions tl-imoveis-showroom__actions--secondary">
          <button class="tl-imoveis-btn tl-imoveis-btn--ghost" type="button" data-action="show-share">Compartilhar</button>
          <button class="tl-imoveis-btn tl-imoveis-btn--ghost" type="button" data-action="show-copy">Copiar localização</button>
          ${canOpenEditor() ? `<button class="tl-imoveis-btn tl-imoveis-btn--secondary" type="button" data-action="show-editar">Editar</button>` : ""}
          ${permissions.canDelete ? `<button class="tl-imoveis-btn tl-imoveis-btn--danger" type="button" data-action="show-excluir">Excluir</button>` : ""}
          <button class="tl-imoveis-btn tl-imoveis-btn--secondary tl-imoveis-showroom__action-btn--wide" type="button" data-action="show-close">Fechar showroom</button>
        </div>
      </div>`,
      right: `
      <div class="tl-imoveis-showroom__hero-card">
        <div class="tl-imoveis-showroom__summary">
          <span class="tl-imoveis-eyebrow mono-font">${esc(item.tipo_imovel || "Imóvel")}</span>
          <h3>${esc(item.titulo || "Imóvel")}</h3>
          <p title="${esc(empreendimento)}">${esc(compact(empreendimento, 72))}</p>
          <small title="${esc(local(item))}">${esc(compact(local(item), 44))}</small>
        </div>
        <div class="tl-imoveis-showroom__price-row"><strong>${shared.formatCurrency(item.valor)}</strong><span class="tl-imoveis-badge tl-imoveis-badge--status tl-imoveis-badge--${esc(sKey(item.status))}">${esc(statusLabel)}</span></div>
        <div class="tl-imoveis-showroom__quick-strip">
          <article><span>Área privativa</span><strong>${esc(areaPrivativa)}</strong></article>
          <article><span>Quartos</span><strong>${esc(String(num(item.quartos) ?? "-"))}</strong></article>
          <article><span>Vagas</span><strong>${esc(String(num(item.vagas_garagem) ?? "-"))}</strong></article>
        </div>
      </div>
      ${reservaLabel ? `
      <div class="tl-imoveis-showroom__reservation">
        <div class="tl-imoveis-showroom__section-head">
          <span class="tl-imoveis-eyebrow mono-font">RESERVA</span>
          <small>${esc(reservaAtual ? "Negociação vinculada" : "Marcação manual")}</small>
        </div>
        <strong>${esc(reservaLabel)}</strong>
        <p>${esc(reservaMeta || "Essa unidade está reservada, mas ainda não há detalhes extras disponíveis.")}</p>
        ${reservaAtual ? `
          <div class="tl-imoveis-showroom__reservation-metrics">
            <article><span>Valor negociado</span><strong>${esc(money(reservaAtual.negociacao?.valor_total_operacao) || "-")}</strong></article>
            <article><span>Entrada</span><strong>${esc(money(reservaAtual.negociacao?.entrada) || "-")}</strong></article>
            <article><span>Financiamento</span><strong>${esc(money(reservaAtual.negociacao?.financiamento_caixa) || "-")}</strong></article>
            <article><span>FGTS / Subsídio / Cheque moradia</span><strong>${esc([money(reservaAtual.negociacao?.fgts), money(reservaAtual.negociacao?.subsidio), money(reservaAtual.negociacao?.cheque_moradia)].filter(Boolean).join(" + ") || "-")}</strong></article>
          </div>` : ""}
      </div>` : ""}
      <div class="tl-imoveis-showroom__section-block">
        <div class="tl-imoveis-showroom__section-head">
          <span class="tl-imoveis-eyebrow mono-font">Informações da Unidade</span>
          <small title="${esc(localCompacto)}">${esc(compact(localCompacto, 52))}</small>
        </div>
        <div class="tl-imoveis-showroom__meta-grid">
          ${infoCards.map((card) => `<article><span>${esc(card.label)}</span><strong>${esc(card.value)}</strong></article>`).join("")}
        </div>
      ${diferenciaisCompactos.length ? `
          <div class="tl-imoveis-showroom__meta-inline">
            <small>Diferenciais compactos</small>
            <div class="tl-imoveis-showroom__tags">${diferenciaisCompactos.map((valor) => `<span class="tl-imoveis-chip">${esc(valor)}</span>`).join("")}</div>
          </div>` : ""}
      </div>
      <div class="tl-imoveis-showroom__footer-grid">
        <div class="tl-imoveis-showroom__location">
          <div class="tl-imoveis-showroom__location-head">
            <span class="tl-imoveis-eyebrow mono-font">Localização</span>
            <button class="tl-imoveis-btn tl-imoveis-btn--secondary" type="button" data-action="show-map">Ver no mapa</button>
          </div>
          <div class="tl-imoveis-showroom__location-text">
            <strong title="${esc(enderecoCompleto)}">${esc(enderecoCompleto)}</strong>
            <small title="${esc(localCompacto)}">${esc(localCompacto)}</small>
          </div>
        </div>
        <div class="tl-imoveis-showroom__timeline">
          <div class="tl-imoveis-showroom__section-head">
            <span class="tl-imoveis-eyebrow mono-font">Resumo Rápido</span>
            <small>Atualização comercial</small>
          </div>
          <ul>
            <li><span>Status</span><strong>${esc(statusLabel)}</strong></li>
            <li><span>Disponibilidade</span><strong>${esc(disponibilidadeLabel)}</strong></li>
            <li><span>Cadastro</span><strong>${esc(shared.formatDate(item.data_hora_criacao) || "-")}</strong></li>
            <li><span>Atualização</span><strong>${esc(shared.formatDate(item.data_hora_atualizado_em) || "-")}</strong></li>
          </ul>
        </div>
      </div>`,
    };
  }

  function renderShowroom(item) {
    state.showroomItem = item;
    state.showroomMidias = normalizeMidias(item);
    state.showroomIndex = 0;
    const showroomInfo = infoShowroom(item);
    if (el.showroomSubtitle) el.showroomSubtitle.textContent = `${local(item)} - ${item?.detalhes_comerciais?.empreendimento || item?.bairro || "Sem empreendimento"}`;
    if (el.showroomContent) {
      el.showroomContent.innerHTML = `
        <div class="tl-imoveis-showroom__layout">
          <div class="tl-imoveis-showroom__gallery-stack">
            <section class="tl-imoveis-showroom__gallery">
              <div class="tl-imoveis-showroom__gallery-head"><span class="tl-imoveis-eyebrow mono-font">GALERIA</span><strong id="imoveisShowroomCarouselCount">0 / 0</strong></div>
              <div id="imoveisShowroomCarouselStage" class="tl-imoveis-showroom__stage"></div>
              <div id="imoveisShowroomCarouselThumbs" class="tl-imoveis-showroom__thumbs"></div>
            </section>
            <section class="tl-imoveis-showroom__support">${showroomInfo.left}</section>
          </div>
          <section class="tl-imoveis-showroom__details"><div class="tl-imoveis-showroom__details-scroll">${showroomInfo.right}</div></section>
        </div>`;
    }
    renderCarousel();
  }

  async function openShowroom(id) {
    if (!id) return;
    toggleModal(el.showroomSection, true);
    if (el.showroomSubtitle) el.showroomSubtitle.textContent = "Carregando dados da unidade...";
    if (el.showroomContent) el.showroomContent.innerHTML = `<article class="tl-imoveis-empty"><strong>Carregando showroom...</strong><p>Estamos consultando as mídias e detalhes comerciais.</p></article>`;
    try {
      const item = await detalhe(id, false);
      if (!item) throw new Error("Imóvel não encontrado para showroom.");
      renderShowroom(item);
    } catch (error) {
      if (el.showroomContent) el.showroomContent.innerHTML = `<article class="tl-imoveis-empty"><strong>Falha ao abrir showroom</strong><p>${esc(error.message || "Não foi possível carregar o imóvel.")}</p></article>`;
    }
  }

  function mapLinks(item) {
    const d = item?.detalhes_comerciais || {};
    const locx = item?.localizacao || {};
    const addr = address(item);
    const city = text(locx.cidade || item?.cidade);
    const stateName = normalizeBrazilState(locx.estado || item?.estado, city);
    const bairro = text(locx.bairro || item?.bairro);
    const consulta = text(locx.consulta || d.empreendimento || item?.agrupamento?.localidade);
    const country = BRAZIL_LABEL;
    const latitude = locx.latitude ?? item?.latitude ?? "";
    const longitude = locx.longitude ?? item?.longitude ?? "";
    const cityLabel = [bairro, city, stateName].filter(Boolean).join(" - ");
    const cityQuery = joinQuery(bairro, city, stateName, country);
    const addressQuery = joinQuery(addr, city, stateName, country);
    const empreendimentoQuery = joinQuery(consulta, city, stateName, country);
    const fallbackQuery = joinQuery(city, stateName, country);
    const externalQuery = addressQuery || empreendimentoQuery || cityQuery || fallbackQuery;
    return {
      endereco: addr,
      cidade: cityLabel,
      embed: buildOsmEmbedUrl(latitude, longitude),
      embedGoogle: buildGoogleEmbedUrl(externalQuery),
      maps: externalQuery
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(externalQuery)}`
        : text(locx.google_maps_url),
      rota: externalQuery
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(externalQuery)}`
        : text(locx.google_maps_rota_url),
      latitude,
      longitude,
      lookupQueries: unique([addressQuery, empreendimentoQuery, cityQuery, fallbackQuery]),
    };
  }

  async function resolveMapEmbed(mapData) {
    if (mapData.embedGoogle) return mapData.embedGoogle;
    const direct = buildOsmEmbedUrl(mapData.latitude, mapData.longitude);
    if (direct) return direct;
    for (const query of mapData.lookupQueries || []) {
      const result = await geocodeAddress(query);
      if (result?.lat && result?.lon) {
        return buildOsmEmbedUrl(result.lat, result.lon);
      }
    }
    return "";
  }

  async function openMapModal(item) {
    const requestId = state.mapaRequestId + 1;
    state.mapaRequestId = requestId;
    state.mapaAtual = mapLinks(item);
    if (el.mapaEndereco) el.mapaEndereco.textContent = state.mapaAtual.endereco || "Endereço não informado.";
    if (el.mapaCidade) el.mapaCidade.textContent = state.mapaAtual.cidade || "Cidade e bairro não informados.";
    if (el.btnMapaGoogle) el.btnMapaGoogle.href = state.mapaAtual.maps || "#";
    if (el.btnMapaRota) el.btnMapaRota.href = state.mapaAtual.rota || "#";
    setMapFrameDoc("Carregando mapa", "Localizando a unidade para exibir o mapa aqui no modal.", "", "");
    toggleModal(el.mapaSection, true);

    const embedUrl = await resolveMapEmbed(state.mapaAtual);
    if (requestId !== state.mapaRequestId) return;
    if (embedUrl) {
      state.mapaAtual.embed = embedUrl;
      setMapFrameEmbed(embedUrl, `Mapa do imóvel ${item?.titulo || ""}`.trim());
      return;
    }
    setMapFrameDoc(
      "Não foi possível abrir o mapa aqui",
      "Os atalhos do Google Maps continuam disponíveis no card ao lado para seguir com a localização desta unidade.",
      state.mapaAtual.maps ? "Abrir no Google Maps" : "",
      state.mapaAtual.maps || ""
    );
  }

  async function copyText(value, success) {
    const v = text(value);
    if (!v) return shared.showInlineMessage(el.feedback, "warning", "Não há conteúdo para copiar.");
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(v);
      else {
        const t = document.createElement("textarea");
        t.value = v;
        t.style.position = "fixed";
        t.style.opacity = "0";
        document.body.appendChild(t);
        t.select();
        document.execCommand("copy");
        document.body.removeChild(t);
      }
      shared.showInlineMessage(el.feedback, "success", success || "Copiado com sucesso.");
    } catch {
      shared.showInlineMessage(el.feedback, "error", "Não foi possível copiar para a área de transferência.");
    }
  }

  function shareSummary(item) {
    return [
      `Unidade: ${item?.titulo || "Imóvel"}`,
      `Empreendimento: ${item?.detalhes_comerciais?.empreendimento || "-"}`,
      `Tipo: ${item?.tipo_imovel || "-"}`,
      `Valor: ${shared.formatCurrency(item?.valor)}`,
      `Status: ${item?.status || "-"}`,
      `Localizacao: ${address(item) || local(item)}`,
      `Quartos: ${num(item?.quartos) ?? "-"}`,
      `Banheiros: ${num(item?.banheiros) ?? "-"}`,
      `Vagas: ${num(item?.vagas_garagem) ?? "-"}`,
      `area: ${area(item?.area_m2)}`,
    ].join("\n");
  }

  async function share(item) {
    const resumo = shareSummary(item);
    const url = `${window.location.origin}${shared.buildPortalPath(`/comercial/imoveis/cadastro?id=${encodeURIComponent(item.id)}`)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.titulo || "Imóvel", text: resumo, url });
        shared.showInlineMessage(el.feedback, "success", "Resumo compartilhado com sucesso.");
        return;
      } catch {}
    }
    await copyText(`${resumo}\n\nLink interno: ${url}`, "Resumo comercial copiado para compartilhamento.");
  }

  function sendToSimulator(item, options = {}) {
    const reservaAtual = reservation(item);
    const payload = {
      id: item.id,
      titulo: item.titulo,
      tipologia: item.tipo_imovel,
      cidade: item.cidade,
      bairro: item.bairro,
      valor: item.valor,
      status: item.status,
      data_entrega: item.data_entrega || null,
      meses_pre_entrega: item.meses_pre_entrega || 36,
      meses_pos_entrega: item.meses_pos_entrega ?? 24,
      percentual_conclusao_obra: item.percentual_conclusao_obra || 0,
      valor_desconto_minimo: item.valor_desconto_minimo ?? 0,
      valor_incentivo_minimo: item.valor_incentivo_minimo ?? item.valor_desconto_minimo ?? 0,
      valor_desconto_maximo: item.valor_desconto_maximo ?? 50000,
      valor_incentivo_maximo: item.valor_incentivo_maximo ?? item.valor_desconto_maximo ?? 50000,
      desconto_imovel_maximo_efetivo: item.desconto_imovel_maximo_efetivo ?? null,
      incentivo_7lm_maximo_efetivo: item.incentivo_7lm_maximo_efetivo ?? item.desconto_imovel_maximo_efetivo ?? null,
      desconto_imovel_reducao_por_reservas_vendas: item.desconto_imovel_reducao_por_reservas_vendas ?? 0,
      incentivo_7lm_reducao_por_reservas_vendas: item.incentivo_7lm_reducao_por_reservas_vendas ?? item.desconto_imovel_reducao_por_reservas_vendas ?? 0,
      quantidade_desconto_reservas_vendas: item.quantidade_desconto_reservas_vendas ?? 0,
      quantidade_incentivo_reservas_vendas: item.quantidade_incentivo_reservas_vendas ?? item.quantidade_desconto_reservas_vendas ?? 0,
      foto_principal: pth(item.foto_principal),
      cliente_id: reservaAtual?.cliente?.id || reservaAtual?.cliente_id || "",
      cliente_nome: reservaAtual?.cliente?.nome_completo || "",
      simulacao_id: linkedSimulationId(item),
      reserva_ativa: reservaAtual || null,
      emitir_pdf: Boolean(options.emitPdf),
    };
    try {
      window.sessionStorage.setItem(SIMULADOR_STORAGE_KEY, JSON.stringify(payload));
    } catch {}
    if (options.emitPdf) {
      const reportUrl = `${shared.buildPortalPath(PATH_SIMULADOR)}?pdf_simulacao=${encodeURIComponent(linkedSimulationId(item))}`;
      const reportWindow = window.open(reportUrl, "_blank", "width=1100,height=900");
      if (!reportWindow) {
        shared.showInlineMessage(el.feedback, "warning", "O navegador bloqueou a janela do PDF. Libere pop-ups para o portal e tente novamente.");
        return;
      }
      return;
    }
    window.location.href = shared.buildPortalPath(PATH_SIMULADOR);
  }

  async function exportSimulationPdf(item) {
    let target = item;
    if (!linkedSimulationId(target)) {
      target = await detalhe(item.id, true);
      if (target) state.showroomItem = target;
    }
    if (!linkedSimulationId(target)) {
      shared.showInlineMessage(el.feedback, "warning", "Este imóvel vendido não possui simulação vinculada para emitir PDF.");
      return;
    }
    sendToSimulator(target, { emitPdf: true });
  }

  function payloadStatus(item, status) {
    return {
      titulo: item.titulo || "Imóvel sem título",
      descricao: item.descricao || null,
      tipo_imovel: item.tipo_imovel || null,
      endereco: item.endereco || null,
      cidade: item.cidade || "",
      bairro: item.bairro || "",
      estado: item.estado || null,
      cep: item.cep || null,
      valor: item.valor ?? null,
      quartos: item.quartos ?? null,
      banheiros: item.banheiros ?? null,
      vagas_garagem: item.vagas_garagem ?? null,
      tipo_garagem: item.tipo_garagem || "carro",
      area_m2: item.area_m2 ?? null,
      data_entrega: item.data_entrega || null,
      meses_pre_entrega: item.meses_pre_entrega ?? 36,
      meses_pos_entrega: item.meses_pos_entrega ?? 24,
      percentual_conclusao_obra: item.percentual_conclusao_obra ?? 0,
      percentual_fechamento_minimo: item.percentual_fechamento_minimo ?? 0.7,
      valor_garantido: item.valor_garantido ?? null,
      valor_garantido_pre_obra_planejado: item.valor_garantido_pre_obra_planejado ?? null,
      percentual_captacao_ate_entrega: item.percentual_captacao_ate_entrega ?? null,
      valor_parcela_minima_pre_obra: item.valor_parcela_minima_pre_obra ?? 0,
      valor_desconto_minimo: item.valor_desconto_minimo ?? 0,
      valor_incentivo_minimo: item.valor_incentivo_minimo ?? item.valor_desconto_minimo ?? 0,
      valor_desconto_maximo: item.valor_desconto_maximo ?? 50000,
      valor_incentivo_maximo: item.valor_incentivo_maximo ?? item.valor_desconto_maximo ?? 50000,
      status,
    };
  }

  async function updateStatus(id, status) {
    if (!permissions.canEdit) return shared.showInlineMessage(el.feedback, "warning", "Seu perfil não possui permissão para alterar status.");
    const item = await detalhe(id, true);
    if (!item) return shared.showInlineMessage(el.feedback, "error", "Não foi possível carregar o imóvel.");
    const resp = await shared.apiRequest(shared.buildEndpoint(ENDPOINT_ATUALIZAR, { id }), { method: "PUT", body: payloadStatus(item, status) });
    if (resp?.item) state.details.set(String(id), resp.item);
    shared.showInlineMessage(el.feedback, "success", `Status atualizado para ${status}.`);
    await carregarImoveis();
    if (state.showroomItem && String(state.showroomItem.id) === String(id)) {
      const atualizado = await detalhe(id, true);
      if (atualizado) renderShowroom(atualizado);
    }
  }

  async function releaseReservation(id) {
    if (!permissions.canEdit) return shared.showInlineMessage(el.feedback, "warning", "Seu perfil não possui permissão para liberar reservas.");
    const item = await detalhe(id, true);
    if (!item) return shared.showInlineMessage(el.feedback, "error", "Não foi possível carregar o imóvel.");
    if (!canReleaseReservation(item)) {
      return shared.showInlineMessage(el.feedback, "info", "Esse imóvel não possui reserva ativa para liberar.");
    }

    const reservaAtual = reservation(item);
    const titulo = item.titulo || "esta unidade";
    const cliente = text(reservaAtual?.cliente?.nome_completo);
    const complemento = cliente ? ` vinculada a ${cliente}` : "";
    if (!window.confirm(`Liberar a reserva de ${titulo}${complemento}?`)) return;

    const resposta = await shared.apiRequest(
      shared.buildEndpoint(ENDPOINT_LIBERAR_RESERVA, { id }),
      { method: "POST", body: { observacoes: reservaAtual?.observacoes || null } }
    );
    state.details.delete(String(id));
    shared.showInlineMessage(el.feedback, "success", resposta?.mensagem || "Reserva liberada com sucesso.");
    await carregarImoveis();
    if (state.showroomItem && String(state.showroomItem.id) === String(id)) {
      const atualizado = await detalhe(id, true);
      if (atualizado) renderShowroom(atualizado);
    }
  }

  async function removeItem(id) {
    if (!permissions.canDelete) return;
    if (!window.confirm("Deseja realmente excluir este imóvel? Esta ação remove também as mídias associadas.")) return;
    await shared.apiRequest(shared.buildEndpoint(ENDPOINT_REMOVER, { id }), { method: "DELETE" });
    state.details.delete(String(id));
    state.comparacao.delete(String(id));
    state.favoritos.delete(String(id));
    saveFavoritos();
    renderCompareDock();
    shared.showInlineMessage(el.feedback, "success", "Imóvel excluído com sucesso.");
    await carregarImoveis();
    toggleModal(el.showroomSection, false);
  }

  function openEditor(id) {
    if (!canOpenEditor()) return shared.showInlineMessage(el.feedback, "warning", "Seu perfil permite somente visualização.");
    window.location.href = shared.buildPortalPath(`${PATH_CADASTRO}?id=${encodeURIComponent(id)}`);
  }

  function toggleCompare(id) {
    const key = String(id || "");
    if (!key) return;
    const sizeBefore = state.comparacao.size;
    if (state.comparacao.has(key)) {
      state.comparacao.delete(key);
      shared.showInlineMessage(el.feedback, "info", "Imóvel removido da comparação.");
    } else {
      if (state.comparacao.size >= LIMITE_COMPARACAO) return shared.showInlineMessage(el.feedback, "warning", `Você pode comparar no máximo ${LIMITE_COMPARACAO} imóveis.`);
      state.comparacao.add(key);
      if (state.comparacao.size >= 2 && sizeBefore < 2) {
        shared.showInlineMessage(el.feedback, "success", "Comparação pronta. Abrindo painel comparativo.");
        void openComparacao();
      } else if (state.comparacao.size < 2) {
        shared.showInlineMessage(el.feedback, "info", "Selecione mais 1 imóvel para comparar.");
      }
    }
    renderCompareDock();
  }

  function toggleFavorito(id) {
    const key = String(id || "");
    if (!key) return;
    if (state.favoritos.has(key)) {
      state.favoritos.delete(key);
      shared.showInlineMessage(el.feedback, "info", "Imóvel removido dos favoritos.");
    } else {
      state.favoritos.add(key);
      shared.showInlineMessage(el.feedback, "success", "Imóvel marcado como favorito.");
    }
    saveFavoritos();
  }

  async function openComparacao() {
    if (state.comparacao.size < 2) return shared.showInlineMessage(el.feedback, "warning", "Selecione ao menos 2 imóveis para comparar.");
    toggleModal(el.comparacaoSection, true);
    if (!el.comparacaoContent) return;
    el.comparacaoContent.innerHTML = `<article class="tl-imoveis-empty"><strong>Montando comparação...</strong><p>Estamos carregando os detalhes das unidades.</p></article>`;
    const ids = Array.from(state.comparacao);
    const list = await Promise.all(ids.map(async (id) => {
      try {
        return await detalhe(id, false);
      } catch {
        return state.byId.get(id) || null;
      }
    }));
    const items = list.filter(Boolean);
    if (!items.length) {
      el.comparacaoContent.innerHTML = `<article class="tl-imoveis-empty"><strong>Não foi possível montar a comparação</strong><p>Tente novamente em instantes.</p></article>`;
      return;
    }
    const min = items.map((i) => num(i.valor)).filter((x) => x !== null).sort((a, b) => a - b)[0] ?? null;
    const maxA = items.map((i) => num(i.area_m2)).filter((x) => x !== null).sort((a, b) => b - a)[0] ?? null;
    el.comparacaoContent.innerHTML = `<div class="tl-imoveis-compare-grid">${items.map((i) => {
      const f = pth(i.foto_principal);
      const badge = num(i.valor) !== null && min !== null && num(i.valor) === min ? "Menor valor" : (num(i.area_m2) !== null && maxA !== null && num(i.area_m2) === maxA ? "Maior área" : "Comparação");
      const dif = Array.isArray(i.diferenciais_comerciais) ? i.diferenciais_comerciais.slice(0, 3) : [];
      return `<article class="tl-imoveis-compare-card"><div class="tl-imoveis-compare-card__media">${f ? `<img src="${esc(f)}" alt="${esc(i.titulo || "Imóvel")}" loading="lazy" />` : `<div class="tl-imoveis-showcase-card__hero tl-imoveis-showcase-card__hero--empty"><span>Sem foto</span></div>`}<span class="tl-imoveis-commercial-badge">${esc(badge)}</span></div><div class="tl-imoveis-compare-card__body"><h3>${esc(i.titulo || "Imóvel")}</h3><p>${esc(local(i))}</p><strong>${shared.formatCurrency(i.valor)}</strong><span class="tl-imoveis-badge tl-imoveis-badge--status tl-imoveis-badge--${esc(sKey(i.status))}">${esc(sLabel(i.status))}</span><ul><li><b>Tipo:</b> ${esc(i.tipo_imovel || "-")}</li><li><b>Quartos:</b> ${esc(String(num(i.quartos) ?? "-"))}</li><li><b>Orientação:</b> ${esc(orientacao(i))}</li><li><b>Vagas:</b> ${esc(String(num(i.vagas_garagem) ?? "-"))}</li><li><b>Área:</b> ${esc(area(i.area_m2))}</li></ul>${dif.length ? `<div class="tl-imoveis-compare-card__tags">${dif.map((d) => `<span class="tl-imoveis-chip">${esc(d)}</span>`).join("")}</div>` : ""}<div class="tl-imoveis-compare-card__actions"><button class="tl-imoveis-btn" type="button" data-action="open-showroom" data-id="${esc(i.id)}">Abrir showroom</button></div></div></article>`;
    }).join("")}</div>`;
  }

  function listAction(action, id) {
    if (!id) return;
    if (action === "ver-imovel") return void openShowroom(id);
    if (action === "editar") return openEditor(id);
    if (action === "excluir") return void removeItem(id).catch((e) => shared.showInlineMessage(el.feedback, "error", e.message || "Não foi possível excluir o imóvel."));
    if (action === "favoritar") {
      toggleFavorito(id);
      return void rerenderCurrentList();
    }
    if (action === "comparar") {
      toggleCompare(id);
      return void rerenderCurrentList();
    }
  }

  function showroomAction(action, data) {
    const item = state.showroomItem;
    if (!item) return;
    if (action === "show-prev") {
      state.showroomIndex = (state.showroomIndex - 1 + state.showroomMidias.length) % state.showroomMidias.length;
      return renderCarousel();
    }
    if (action === "show-next") {
      state.showroomIndex = (state.showroomIndex + 1) % state.showroomMidias.length;
      return renderCarousel();
    }
    if (action === "show-go") {
      const idx = Number(data.index);
      if (Number.isFinite(idx)) {
        state.showroomIndex = Math.max(0, Math.min(idx, state.showroomMidias.length - 1));
        renderCarousel();
      }
      return;
    }
    if (action === "show-zoom") return openLightbox(state.showroomMidias, state.showroomIndex);
    if (action === "show-map") {
      return void openMapModal(item);
    }
    if (action === "show-copy") return void copyText(address(item), "Endereço copiado com sucesso.");
    if (action === "show-share") return void share(item);
    if (action === "show-exportar-pdf") return void exportSimulationPdf(item).catch((e) => shared.showInlineMessage(el.feedback, "error", e.message || "Não foi possível emitir o PDF."));
    if (["show-simular", "show-reservar", "show-vender", "show-liberar-reserva"].includes(action) && isSold(item)) {
      return shared.showInlineMessage(el.feedback, "warning", "Imóvel vendido: use Exportar PDF para consultar a proposta salva.");
    }
    if (action === "show-simular") return sendToSimulator(item);
    if (action === "show-reservar") return void updateStatus(item.id, "Reservado").catch((e) => shared.showInlineMessage(el.feedback, "error", e.message || "Não foi possível atualizar para reservado."));
    if (action === "show-vender") return void updateStatus(item.id, "Vendido").catch((e) => shared.showInlineMessage(el.feedback, "error", e.message || "Não foi possível atualizar para vendido."));
    if (action === "show-liberar-reserva") return void releaseReservation(item.id).catch((e) => shared.showInlineMessage(el.feedback, "error", e.message || "Não foi possível liberar a reserva."));
    if (action === "show-editar") return openEditor(item.id);
    if (action === "show-excluir") return void removeItem(item.id).catch((e) => shared.showInlineMessage(el.feedback, "error", e.message || "Não foi possível excluir o imóvel."));
    if (action === "show-close") return toggleModal(el.showroomSection, false);
  }

  function bindEvents() {
    window.addEventListener("pageshow", () => {
      toggleExportMenu(false);
    });

    el.btnViewComercial?.addEventListener("click", () => {
      setViewMode("comercial");
      void carregarImoveis();
    });
    el.btnViewTecnica?.addEventListener("click", () => {
      setViewMode("tecnica");
      void carregarImoveis();
    });

    el.btnBuscar?.addEventListener("click", () => {
      state.pagina = 1;
      void carregarImoveis();
    });
    el.btnLimpar?.addEventListener("click", () => {
      if (el.inputBusca) el.inputBusca.value = "";
      if (el.inputRegiao) {
        el.inputRegiao.value = "";
        el.inputRegiao.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (el.inputCidade) {
        el.inputCidade.value = "";
        el.inputCidade.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (el.inputBloco) {
        el.inputBloco.value = "";
        el.inputBloco.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (el.inputApartamento) {
        el.inputApartamento.value = "";
        el.inputApartamento.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (el.inputStatus) {
        el.inputStatus.value = "";
        el.inputStatus.dispatchEvent(new Event("change", { bubbles: true }));
      }
      state.pagina = 1;
      void carregarImoveis();
    });
    [el.inputRegiao, el.inputCidade, el.inputBloco, el.inputApartamento].forEach((select) => {
      select?.addEventListener("change", () => {
        aplicarFiltrosListaERenderizar();
      });
    });
    el.btnAnterior?.addEventListener("click", () => {
      if (state.paginacao?.tem_anterior) {
        state.pagina = Math.max(1, Number(state.paginacao.pagina || 1) - 1);
        void carregarImoveis();
      }
    });
    el.btnProxima?.addEventListener("click", () => {
      if (state.paginacao?.tem_proxima) {
        state.pagina = Number(state.paginacao.pagina || 1) + 1;
        void carregarImoveis();
      }
    });

    el.btnAbrirExportacao?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const aberto = Boolean(el.menuExportacao && !el.menuExportacao.hidden);
      toggleExportMenu(!aberto);
    });
    el.menuExportacao?.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("[data-export-format]");
      if (!(button instanceof HTMLButtonElement)) return;
      const formato = button.getAttribute("data-export-format") || "";
      void exportarImoveis(formato, button);
    });
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest(".tl-imoveis-export-menu")) return;
      toggleExportMenu(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") toggleExportMenu(false);
    });
    toggleExportMenu(false);

    el.btnImportacao?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!permissions.canCreate) return;
      toggleModal(el.importSection, true);
      window.requestAnimationFrame(() => el.importArquivo?.focus());
    });
    el.btnFecharImportacao?.addEventListener("click", () => toggleModal(el.importSection, false));
    el.importSection?.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t === el.importSection || t.closest("[data-modal-close='importacao']")) toggleModal(el.importSection, false);
    });
    el.importForm?.addEventListener("submit", importarPlanilha);

    el.btnAbrirEvolucaoLote?.addEventListener("click", (e) => {
      e.preventDefault();
      openEvolucaoLoteModal();
    });
    el.btnFecharEvolucaoLote?.addEventListener("click", () => toggleModal(el.evolucaoSection, false));
    el.evolucaoSection?.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t === el.evolucaoSection || t.closest("[data-modal-close='evolucao-lote']")) toggleModal(el.evolucaoSection, false);
    });
    el.formEvolucaoLote?.addEventListener("submit", aplicarEvolucaoLote);
    el.evolucaoReferencia?.addEventListener("change", () => refreshEvolucaoLoteSummary({ resetSelection: true }));
    el.btnEvolucaoSelecionarTodas?.addEventListener("click", selectAllEvolucaoLoteItems);
    el.btnEvolucaoLimparSelecao?.addEventListener("click", clearEvolucaoLoteSelection);
    el.evolucaoLista?.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const action = t.closest("[data-action='toggle-evolucao-item']");
      if (!action) return;
      toggleEvolucaoLoteSelection(action.getAttribute("data-id") || "");
    });

    el.lista?.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const a = t.closest("[data-action]");
      if (a) {
        listAction(a.getAttribute("data-action") || "", a.getAttribute("data-id") || a.closest("[data-id]")?.getAttribute("data-id") || "");
        return;
      }
      const card = t.closest(".tl-imoveis-showcase-card");
      if (!card || state.viewMode === "tecnica") return;
      if (t.closest("button,a,input,select,textarea")) return;
      const id = card.getAttribute("data-id");
      if (id) void openShowroom(id);
    });

    el.lista?.addEventListener("keydown", (e) => {
      if (state.viewMode === "tecnica") return;
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const card = t.closest(".tl-imoveis-showcase-card");
      if (!card) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      const id = card.getAttribute("data-id");
      if (id) void openShowroom(id);
    });

    el.lista?.addEventListener("toggle", (e) => {
      const d = e.target;
      if (!(d instanceof HTMLElement) || d.tagName !== "DETAILS") return;
      if (d.classList.contains("tl-imoveis-local") && d.open) {
        el.lista.querySelectorAll("details.tl-imoveis-local").forEach((x) => {
          if (x !== d) x.open = false;
        });
      }
      if (d.classList.contains("tl-imoveis-bloco") && d.open) {
        d.closest(".tl-imoveis-local")?.querySelectorAll("details.tl-imoveis-bloco").forEach((x) => {
          if (x !== d) x.open = false;
        });
      }
    });

    el.btnFecharShowroom?.addEventListener("click", () => toggleModal(el.showroomSection, false));
    el.showroomSection?.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.closest("[data-modal-close='showroom']")) toggleModal(el.showroomSection, false);
    });
    el.showroomContent?.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const a = t.closest("[data-action]");
      if (!a) return;
      showroomAction(a.getAttribute("data-action") || "", a.dataset || {});
    });
    el.showroomContent?.addEventListener("touchstart", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (!t.closest("[data-showroom-stage='1']")) return;
      state.touchX = e.changedTouches?.[0]?.clientX ?? null;
    }, { passive: true });
    el.showroomContent?.addEventListener("touchend", (e) => {
      if (state.touchX === null) return;
      const x = e.changedTouches?.[0]?.clientX ?? null;
      const d = Number(x) - Number(state.touchX);
      if (Math.abs(d) > 42 && state.showroomMidias.length > 1) {
        state.showroomIndex = (state.showroomIndex + (d > 0 ? -1 : 1) + state.showroomMidias.length) % state.showroomMidias.length;
        renderCarousel();
      }
      state.touchX = null;
    }, { passive: true });

    el.btnMapaCopiar?.addEventListener("click", () => void copyText(state.mapaAtual?.endereco || "", "Endereço copiado com sucesso."));
    el.btnMapaFechar?.addEventListener("click", () => toggleModal(el.mapaSection, false));
    el.btnFecharMapa?.addEventListener("click", () => toggleModal(el.mapaSection, false));
    el.mapaSection?.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.closest("[data-modal-close='mapa']")) toggleModal(el.mapaSection, false);
    });

    el.btnAbrirComparacao?.addEventListener("click", () => void openComparacao());
    el.btnLimparComparacao?.addEventListener("click", () => {
      state.comparacao.clear();
      renderCompareDock();
      void carregarImoveis();
    });
    el.compareDock?.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const a = t.closest("[data-action='remove-compare']");
      if (!a) return;
      const id = a.getAttribute("data-id");
      if (!id) return;
      state.comparacao.delete(String(id));
      renderCompareDock();
      void carregarImoveis();
    });
    el.btnFecharComparacao?.addEventListener("click", () => toggleModal(el.comparacaoSection, false));
    el.comparacaoSection?.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.closest("[data-modal-close='comparacao']")) return toggleModal(el.comparacaoSection, false);
      const a = t.closest("[data-action='open-showroom']");
      if (!a) return;
      const id = a.getAttribute("data-id");
      if (!id) return;
      toggleModal(el.comparacaoSection, false);
      void openShowroom(id);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (el.menuExportacao && !el.menuExportacao.hidden) return toggleExportMenu(false);
        if (el.mapaSection && !el.mapaSection.hidden) return toggleModal(el.mapaSection, false);
        if (el.comparacaoSection && !el.comparacaoSection.hidden) return toggleModal(el.comparacaoSection, false);
        if (el.evolucaoSection && !el.evolucaoSection.hidden) return toggleModal(el.evolucaoSection, false);
        if (el.showroomSection && !el.showroomSection.hidden) return toggleModal(el.showroomSection, false);
        if (el.importSection && !el.importSection.hidden) return toggleModal(el.importSection, false);
      }
      if (el.showroomSection && !el.showroomSection.hidden) {
        if (e.key === "ArrowLeft" && state.showroomMidias.length > 1) {
          state.showroomIndex = (state.showroomIndex - 1 + state.showroomMidias.length) % state.showroomMidias.length;
          renderCarousel();
        }
        if (e.key === "ArrowRight" && state.showroomMidias.length > 1) {
          state.showroomIndex = (state.showroomIndex + 1) % state.showroomMidias.length;
          renderCarousel();
        }
      }
    });
  }

  async function init() {
    try {
      shared.initChrome?.();
      state.user = await shared.ensureUser(true);
      shared.fillUserbox?.(state.user);
      syncPermissions();
      loadFavoritos();
      loadViewMode();
      setViewMode(state.viewMode);
      enableCustomSelects();
      toggleExportMenu(false);
      bindEvents();
      await carregarImoveis();
    } catch (error) {
      shared.showInlineMessage(el.feedback, "error", error.message || "Não foi possível carregar a página de imóveis.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
