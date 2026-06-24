(function () {
  "use strict";

  const shared = window.SevenLMConnectImoveis;

  const ENDPOINT_CRIAR = shared.meta("sevenlm-connect-endpoint-imoveis-criar", "/api/imoveis");
  const ENDPOINT_DETALHE = shared.meta("sevenlm-connect-endpoint-imoveis-detalhe", "/api/imoveis/{id}");
  const ENDPOINT_ATUALIZAR = shared.meta("sevenlm-connect-endpoint-imoveis-atualizar", "/api/imoveis/{id}");
  const ENDPOINT_EVOLUCAO_OBRA = shared.meta("sevenlm-connect-endpoint-imoveis-evolucao-obra", "/api/imoveis/{id}/evolucao-obra");
  const ENDPOINT_EVOLUCAO_OBRA_LOTE_ENDERECO = shared.meta("sevenlm-connect-endpoint-imoveis-evolucao-obra-lote-endereco", "/api/imoveis/{id}/evolucao-obra/lote-endereco");
  const ENDPOINT_UPLOAD = shared.meta("sevenlm-connect-endpoint-imoveis-upload", "/api/imoveis/{id}/midias");
  const ENDPOINT_REMOVER_MIDIA = shared.meta("sevenlm-connect-endpoint-imoveis-remover-midia", "/api/imoveis/{id}/midias/{midia_id}");
  const PATH_LISTAGEM = shared.meta("sevenlm-connect-path-imoveis-listagem", "/comercial/imoveis");
  const PATH_CADASTRO = shared.meta("sevenlm-connect-path-imoveis-cadastro", "/comercial/imoveis/cadastro");

  const state = {
    user: null,
    id: "",
    isEdit: false,
    canCreate: false,
    canEdit: false,
    canMedia: false,
    readOnlyData: false,
    evolucaoObra: [],
    pendingMidias: [],
  };

  const el = {
    feedback: document.getElementById("imoveisFeedback"),
    tituloPagina: document.getElementById("tituloPaginaImovel"),
    subtituloPagina: document.getElementById("subtituloPaginaImovel"),
    btnVoltar: document.getElementById("btnVoltarImoveis"),
    form: document.getElementById("formImovel"),
    fieldsDados: document.getElementById("imovelDadosFieldset"),
    titulo: document.getElementById("imovelTitulo"),
    descricao: document.getElementById("imovelDescricao"),
    tipo: document.getElementById("imovelTipo"),
    endereco: document.getElementById("imovelEndereco"),
    cidade: document.getElementById("imovelCidade"),
    bairro: document.getElementById("imovelBairro"),
    estado: document.getElementById("imovelEstado"),
    cep: document.getElementById("imovelCep"),
    valor: document.getElementById("imovelValor"),
    quartos: document.getElementById("imovelQuartos"),
    banheiros: document.getElementById("imovelBanheiros"),
    vagas: document.getElementById("imovelVagas"),
    tipoGaragem: document.getElementById("imovelTipoGaragem"),
    area: document.getElementById("imovelArea"),
    dataEntrega: document.getElementById("imovelDataEntrega"),
    mesesPreEntrega: document.getElementById("imovelMesesPreEntrega"),
    mesesPosEntrega: document.getElementById("imovelMesesPosEntrega"),
    percentualConclusaoObra: document.getElementById("imovelPercentualConclusaoObra"),
    percentualFechamentoMinimo: document.getElementById("imovelPercentualFechamentoMinimo"),
    valorGarantido: document.getElementById("imovelValorGarantido"),
    valorGarantidoPreObraPlanejado: document.getElementById("imovelValorGarantidoPreObraPlanejado"),
    percentualCaptacaoAteEntrega: document.getElementById("imovelPercentualCaptacaoAteEntrega"),
    valorParcelaMinimaPreObra: document.getElementById("imovelValorParcelaMinimaPreObra"),
    valorDescontoMinimo: document.getElementById("imovelValorDescontoMinimo"),
    valorDescontoMaximo: document.getElementById("imovelValorDescontoMaximo"),
    status: document.getElementById("imovelStatus"),
    btnSalvar: document.getElementById("btnSalvarImovel"),
    notaReadOnly: document.getElementById("imovelReadOnlyNote"),
    evolucaoSection: document.getElementById("imovelEvolucaoObraSection"),
    evolucaoAtual: document.getElementById("imovelEvolucaoAtual"),
    evolucaoForm: document.getElementById("formEvolucaoObra"),
    evolucaoData: document.getElementById("imovelEvolucaoData"),
    evolucaoPercentual: document.getElementById("imovelEvolucaoPercentual"),
    evolucaoObservacoes: document.getElementById("imovelEvolucaoObservacoes"),
    evolucaoLista: document.getElementById("imovelEvolucaoObraLista"),
    btnRegistrarEvolucao: document.getElementById("btnRegistrarEvolucaoObra"),
    btnRegistrarEvolucaoLoteEndereco: document.getElementById("btnRegistrarEvolucaoObraLoteEndereco"),
    uploadInput: document.getElementById("imovelMidias"),
    uploadHint: document.getElementById("imovelUploadHint"),
    arquivosSelecionados: document.getElementById("imovelArquivosSelecionados"),
    midiasExistentes: document.getElementById("imovelMidiasExistentes"),
    uploadSection: document.getElementById("imovelUploadSection"),
  };

  function buildListPath() {
    return shared.buildPortalPath(PATH_LISTAGEM);
  }

  function releaseGate() {
    document.documentElement.classList.remove("tl-imoveis-form-gated");
  }

  function currentId() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("id") || "").trim();
  }

  function syncHeader() {
    if (el.btnVoltar) {
      el.btnVoltar.href = buildListPath();
    }

    if (state.isEdit) {
      if (el.tituloPagina) el.tituloPagina.textContent = state.readOnlyData ? "Mídias do imóvel" : "Editar imóvel";
      if (el.subtituloPagina) {
        el.subtituloPagina.textContent = state.readOnlyData
          ? "Você possui acesso para gerenciar apenas as mídias deste imóvel."
          : "Atualize os dados do imóvel e gerencie fotos e vídeos no mesmo fluxo.";
      }
      if (el.btnSalvar) el.btnSalvar.textContent = "Salvar alterações";
      return;
    }

    if (el.tituloPagina) el.tituloPagina.textContent = "Cadastrar imóvel";
    if (el.subtituloPagina) {
      el.subtituloPagina.textContent = "Preencha os dados do imóvel e, se permitido, envie as fotos e vídeos na mesma tela.";
    }
    if (el.btnSalvar) el.btnSalvar.textContent = "Salvar imóvel";
  }

  function syncPermissionState() {
    const canManageRegistration = shared.canManagePropertyRegistration(state.user);
    state.canCreate = canManageRegistration;
    state.canEdit = canManageRegistration;
    state.canMedia = canManageRegistration;
    state.readOnlyData = state.isEdit && !state.canEdit && state.canMedia;

    shared.toggleHidden(el.notaReadOnly, !state.readOnlyData);
    shared.toggleHidden(
      el.btnSalvar,
      state.readOnlyData || (state.isEdit ? !state.canEdit : !state.canCreate)
    );
    shared.toggleHidden(el.uploadSection, !state.canMedia);
    shared.toggleHidden(el.evolucaoSection, !state.isEdit);
    shared.toggleHidden(el.evolucaoForm, !state.isEdit || !state.canEdit);

    if (el.fieldsDados) {
      el.fieldsDados.disabled = Boolean(state.readOnlyData);
    }

    [el.evolucaoData, el.evolucaoPercentual, el.evolucaoObservacoes, el.btnRegistrarEvolucao, el.btnRegistrarEvolucaoLoteEndereco].forEach((input) => {
      if (input) input.disabled = !state.canEdit;
    });

    if (el.uploadInput && !state.canMedia) {
      el.uploadInput.value = "";
      state.pendingMidias = [];
    }

    if (el.uploadHint) {
      el.uploadHint.textContent = state.canMedia
        ? "Aceite de imagens: jpg, jpeg, png, webp. Vídeos: mp4, mov e webm."
        : "Seu perfil atual não possui permissão para enviar ou remover mídias.";
    }

    syncHeader();
  }

  function parseDateOnly(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function dateInputValue(value) {
    const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
  }

  function todayInputValue() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function calculateMonthsUntilDelivery(value) {
    const delivery = parseDateOnly(value);
    if (!delivery) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let months = (delivery.getFullYear() - today.getFullYear()) * 12 + (delivery.getMonth() - today.getMonth());
    if (delivery.getDate() > today.getDate()) months += 1;
    return Math.max(1, Math.min(240, months));
  }

  function toHumanPercent(value, fallback = 70) {
    const number = parseLocaleNumber(value);
    if (!Number.isFinite(number)) return fallback;
    return number <= 1.5 ? number * 100 : number;
  }

  function syncDeliveryMonths() {
    const months = calculateMonthsUntilDelivery(el.dataEntrega?.value);
    if (months && el.mesesPreEntrega) {
      el.mesesPreEntrega.value = String(months);
    }
  }

  function roundTo(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round(Number(value || 0) * factor) / factor;
  }

  function parseLocaleNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    const text = String(value)
      .trim()
      .replace(/\s+/g, "")
      .replace(/R\$/gi, "")
      .replace(/%/g, "");

    if (!text) return null;

    let normalized = text;
    if (normalized.includes(",")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      const pieces = normalized.split(".");
      if (pieces.length > 2) normalized = pieces.join("");
    }

    normalized = normalized.replace(/[^\d.-]/g, "");
    if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") return null;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatLocaleNumber(value, { minimumFractionDigits = 0, maximumFractionDigits = 2 } = {}) {
    const number = parseLocaleNumber(value);
    if (!Number.isFinite(number)) return "";
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(number);
  }

  function toEditableNumberString(value, { maximumFractionDigits = 2, trimTrailingZeros = false } = {}) {
    const number = parseLocaleNumber(value);
    if (!Number.isFinite(number)) return "";

    const factor = 10 ** maximumFractionDigits;
    const normalized = Math.round(number * factor) / factor;
    const fixed = normalized.toFixed(maximumFractionDigits);
    let [integerPart, decimalPart] = fixed.split(".");
    integerPart = String(Number(integerPart));

    if (trimTrailingZeros && decimalPart) {
      decimalPart = decimalPart.replace(/0+$/, "");
    }

    return decimalPart ? `${integerPart},${decimalPart}` : integerPart;
  }

  function formatFieldDisplayValue(value, config = {}) {
    const number = parseLocaleNumber(value);
    if (!Number.isFinite(number)) return "";
    if (config.kind === "currency") {
      return shared.formatCurrency(number);
    }
    return formatLocaleNumber(number, config);
  }

  function writeFormattedValue(input, value, config = {}, options = {}) {
    if (!input) return;

    const number = parseLocaleNumber(value);
    if (!Number.isFinite(number)) {
      input.value = "";
      input.dataset.numericValue = "";
      return;
    }

    input.dataset.numericValue = String(number);
    const isFocused = document.activeElement === input;
    if (isFocused && !options.forceDisplay) {
      input.value = toEditableNumberString(number, {
        maximumFractionDigits: config.maximumFractionDigits ?? 2,
        trimTrailingZeros: false,
      });
      return;
    }

    input.value = formatFieldDisplayValue(number, config);
  }

  function formatConfiguredField(input, config = {}) {
    if (!input) return;
    writeFormattedValue(input, input.value || input.dataset.numericValue || "", config, { forceDisplay: true });
  }

  function formattedFieldConfigs() {
    return [
      { input: el.valor, kind: "currency", maximumFractionDigits: 2 },
      { input: el.valorGarantido, kind: "currency", maximumFractionDigits: 2 },
      { input: el.valorGarantidoPreObraPlanejado, kind: "currency", maximumFractionDigits: 2 },
      { input: el.valorParcelaMinimaPreObra, kind: "currency", maximumFractionDigits: 2 },
      { input: el.valorDescontoMinimo, kind: "currency", maximumFractionDigits: 2 },
      { input: el.valorDescontoMaximo, kind: "currency", maximumFractionDigits: 2 },
      { input: el.area, kind: "decimal", maximumFractionDigits: 2 },
      { input: el.percentualConclusaoObra, kind: "decimal", maximumFractionDigits: 2 },
      { input: el.percentualFechamentoMinimo, kind: "decimal", maximumFractionDigits: 2 },
      { input: el.percentualCaptacaoAteEntrega, kind: "decimal", maximumFractionDigits: 2 },
      { input: el.evolucaoPercentual, kind: "decimal", maximumFractionDigits: 2 },
    ];
  }

  function applyFormattedFieldDisplays() {
    formattedFieldConfigs().forEach(({ input, ...config }) => formatConfiguredField(input, config));
  }

  function bindFormattedField(input, config = {}) {
    if (!input) return;

    input.addEventListener("focus", () => {
      const number = parseLocaleNumber(input.dataset.numericValue || input.value);
      if (!Number.isFinite(number)) {
        input.value = "";
        return;
      }
      input.value = toEditableNumberString(number, {
        maximumFractionDigits: config.maximumFractionDigits ?? 2,
        trimTrailingZeros: false,
      });
      window.requestAnimationFrame(() => {
        if (document.activeElement === input && typeof input.select === "function") {
          input.select();
        }
      });
    });

    input.addEventListener("blur", () => {
      formatConfiguredField(input, config);
    });
  }

  function bindFieldMasks() {
    bindFormattedField(el.valor, { kind: "currency", maximumFractionDigits: 2 });
    bindFormattedField(el.valorGarantido, { kind: "currency", maximumFractionDigits: 2 });
    bindFormattedField(el.valorGarantidoPreObraPlanejado, { kind: "currency", maximumFractionDigits: 2 });
    bindFormattedField(el.valorParcelaMinimaPreObra, { kind: "currency", maximumFractionDigits: 2 });
    bindFormattedField(el.valorDescontoMinimo, { kind: "currency", maximumFractionDigits: 2 });
    bindFormattedField(el.valorDescontoMaximo, { kind: "currency", maximumFractionDigits: 2 });
    bindFormattedField(el.area, { kind: "decimal", maximumFractionDigits: 2 });
    bindFormattedField(el.percentualConclusaoObra, { kind: "decimal", maximumFractionDigits: 2 });
    bindFormattedField(el.percentualFechamentoMinimo, { kind: "decimal", maximumFractionDigits: 2 });
    bindFormattedField(el.percentualCaptacaoAteEntrega, { kind: "decimal", maximumFractionDigits: 2 });
    bindFormattedField(el.evolucaoPercentual, { kind: "decimal", maximumFractionDigits: 2 });
  }

  function formatCep(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  function bindFieldNormalizers() {
    el.cep?.addEventListener("input", () => {
      el.cep.value = formatCep(el.cep.value);
    });

    el.estado?.addEventListener("input", () => {
      el.estado.value = String(el.estado.value || "").toUpperCase();
    });
  }

  function syncGuaranteedValue({ preferExistingGuarantee = false } = {}) {
    if (!el.valor || !el.percentualFechamentoMinimo || !el.valorGarantido) return;

    const valor = parseLocaleNumber(el.valor.value);
    if (!Number.isFinite(valor) || valor <= 0) return;

    const percentual = parseLocaleNumber(el.percentualFechamentoMinimo.value) ?? 70;
    const garantidoAtual = parseLocaleNumber(el.valorGarantido.value);

    if (preferExistingGuarantee && Number.isFinite(garantidoAtual) && garantidoAtual > 0) {
      writeFormattedValue(el.percentualFechamentoMinimo, roundTo((garantidoAtual / valor) * 100, 2), {
        kind: "decimal",
        maximumFractionDigits: 2,
      });
      return;
    }

    const percentualNormalizado = Number.isFinite(percentual) && percentual > 0 ? percentual : 70;
    writeFormattedValue(el.percentualFechamentoMinimo, roundTo(percentualNormalizado, 2), {
      kind: "decimal",
      maximumFractionDigits: 2,
    });
    writeFormattedValue(el.valorGarantido, roundTo(valor * (percentualNormalizado / 100), 2), {
      kind: "currency",
      maximumFractionDigits: 2,
    });
  }

  function syncGuaranteedPercent() {
    if (!el.valor || !el.percentualFechamentoMinimo || !el.valorGarantido) return;

    const valor = parseLocaleNumber(el.valor.value);
    const garantido = parseLocaleNumber(el.valorGarantido.value);
    if (!Number.isFinite(valor) || valor <= 0 || !Number.isFinite(garantido) || garantido <= 0) return;

    writeFormattedValue(el.percentualFechamentoMinimo, roundTo((garantido / valor) * 100, 2), {
      kind: "decimal",
      maximumFractionDigits: 2,
    });
  }

  function syncDeliveryCapturePlanned({ preferExistingValue = false } = {}) {
    if (!el.valor || !el.percentualCaptacaoAteEntrega || !el.valorGarantidoPreObraPlanejado) return;

    const valor = parseLocaleNumber(el.valor.value);
    if (!Number.isFinite(valor) || valor <= 0) return;

    const percentual = parseLocaleNumber(el.percentualCaptacaoAteEntrega.value);
    const valorPlanejadoAtual = parseLocaleNumber(el.valorGarantidoPreObraPlanejado.value);

    if (preferExistingValue && Number.isFinite(valorPlanejadoAtual) && valorPlanejadoAtual > 0) {
      writeFormattedValue(el.percentualCaptacaoAteEntrega, roundTo((valorPlanejadoAtual / valor) * 100, 2), {
        kind: "decimal",
        maximumFractionDigits: 2,
      });
      return;
    }

    if (!Number.isFinite(percentual) || percentual <= 0) {
      if (!Number.isFinite(valorPlanejadoAtual) || valorPlanejadoAtual <= 0) return;
      writeFormattedValue(el.percentualCaptacaoAteEntrega, roundTo((valorPlanejadoAtual / valor) * 100, 2), {
        kind: "decimal",
        maximumFractionDigits: 2,
      });
      return;
    }

    const percentualNormalizado = percentual > 100 ? 100 : percentual;
    writeFormattedValue(el.percentualCaptacaoAteEntrega, roundTo(percentualNormalizado, 2), {
      kind: "decimal",
      maximumFractionDigits: 2,
    });
    writeFormattedValue(el.valorGarantidoPreObraPlanejado, roundTo(valor * (percentualNormalizado / 100), 2), {
      kind: "currency",
      maximumFractionDigits: 2,
    });
  }

  function syncDeliveryCapturePercent() {
    if (!el.valor || !el.percentualCaptacaoAteEntrega || !el.valorGarantidoPreObraPlanejado) return;

    const valor = parseLocaleNumber(el.valor.value);
    const valorPlanejado = parseLocaleNumber(el.valorGarantidoPreObraPlanejado.value);
    if (!Number.isFinite(valor) || valor <= 0 || !Number.isFinite(valorPlanejado) || valorPlanejado <= 0) return;

    writeFormattedValue(el.percentualCaptacaoAteEntrega, roundTo((valorPlanejado / valor) * 100, 2), {
      kind: "decimal",
      maximumFractionDigits: 2,
    });
  }

  function collectPayload() {
    const mesesPreCalculado = calculateMonthsUntilDelivery(el.dataEntrega?.value);
    return {
      titulo: el.titulo?.value || "",
      descricao: el.descricao?.value || null,
      tipo_imovel: el.tipo?.value || null,
      endereco: el.endereco?.value || null,
      cidade: el.cidade?.value || "",
      bairro: el.bairro?.value || "",
      estado: el.estado?.value || null,
      cep: el.cep?.value || null,
      valor: parseLocaleNumber(el.valor?.value),
      quartos: el.quartos?.value ? Number(el.quartos.value) : null,
      banheiros: el.banheiros?.value ? Number(el.banheiros.value) : null,
      vagas_garagem: el.vagas?.value ? Number(el.vagas.value) : null,
      tipo_garagem: el.tipoGaragem?.value || "carro",
      area_m2: parseLocaleNumber(el.area?.value),
      data_entrega: el.dataEntrega?.value || null,
      meses_pre_entrega: mesesPreCalculado || (el.mesesPreEntrega?.value ? Number(el.mesesPreEntrega.value) : 36),
      meses_pos_entrega: el.mesesPosEntrega?.value ? Number(el.mesesPosEntrega.value) : 24,
      percentual_conclusao_obra: parseLocaleNumber(el.percentualConclusaoObra?.value) ?? 0,
      percentual_fechamento_minimo: parseLocaleNumber(el.percentualFechamentoMinimo?.value) ?? 70,
      valor_garantido: parseLocaleNumber(el.valorGarantido?.value),
      valor_garantido_pre_obra_planejado: parseLocaleNumber(el.valorGarantidoPreObraPlanejado?.value),
      percentual_captacao_ate_entrega: parseLocaleNumber(el.percentualCaptacaoAteEntrega?.value),
      valor_parcela_minima_pre_obra: parseLocaleNumber(el.valorParcelaMinimaPreObra?.value) ?? 0,
      valor_desconto_minimo: parseLocaleNumber(el.valorDescontoMinimo?.value) ?? 0,
      valor_desconto_maximo: parseLocaleNumber(el.valorDescontoMaximo?.value) ?? 50000,
      status: el.status?.value || "Disponivel",
    };
  }

  function fillForm(item) {
    if (!item) return;
    if (el.titulo) el.titulo.value = item.titulo || "";
    if (el.descricao) el.descricao.value = item.descricao || "";
    if (el.tipo) el.tipo.value = item.tipo_imovel || "";
    if (el.endereco) el.endereco.value = item.endereco || "";
    if (el.cidade) el.cidade.value = item.cidade || "";
    if (el.bairro) el.bairro.value = item.bairro || "";
    if (el.estado) el.estado.value = item.estado || "";
    if (el.cep) el.cep.value = item.cep || "";
    if (el.valor) writeFormattedValue(el.valor, item.valor, { kind: "currency", maximumFractionDigits: 2 }, { forceDisplay: true });
    if (el.quartos) el.quartos.value = item.quartos ?? "";
    if (el.banheiros) el.banheiros.value = item.banheiros ?? "";
    if (el.vagas) el.vagas.value = item.vagas_garagem ?? "";
    if (el.tipoGaragem) el.tipoGaragem.value = item.tipo_garagem || "carro";
    if (el.area) writeFormattedValue(el.area, item.area_m2, { kind: "decimal", maximumFractionDigits: 2 }, { forceDisplay: true });
    if (el.dataEntrega) el.dataEntrega.value = dateInputValue(item.data_entrega);
    if (el.mesesPreEntrega) el.mesesPreEntrega.value = item.meses_pre_entrega ?? 36;
    if (el.mesesPosEntrega) el.mesesPosEntrega.value = item.meses_pos_entrega ?? 24;
    if (el.percentualConclusaoObra) {
      writeFormattedValue(el.percentualConclusaoObra, item.percentual_conclusao_obra ?? 0, {
        kind: "decimal",
        maximumFractionDigits: 2,
      }, { forceDisplay: true });
    }
    if (el.percentualFechamentoMinimo) {
      writeFormattedValue(el.percentualFechamentoMinimo, toHumanPercent(item.percentual_fechamento_minimo, 70), {
        kind: "decimal",
        maximumFractionDigits: 2,
      }, { forceDisplay: true });
    }
    if (el.valorGarantido) {
      const valor = Number(item.valor ?? 0);
      const percentual = toHumanPercent(item.percentual_fechamento_minimo, 70);
      const valorGarantido = Number(item.valor_garantido ?? 0);
      writeFormattedValue(
        el.valorGarantido,
        valorGarantido > 0
          ? valorGarantido
          : (valor > 0 ? roundTo(valor * (percentual / 100), 2) : ""),
        { kind: "currency", maximumFractionDigits: 2 },
        { forceDisplay: true }
      );
    }
    if (el.valorGarantidoPreObraPlanejado) {
      writeFormattedValue(el.valorGarantidoPreObraPlanejado, item.valor_garantido_pre_obra_planejado ?? "", {
        kind: "currency",
        maximumFractionDigits: 2,
      }, { forceDisplay: true });
    }
    if (el.percentualCaptacaoAteEntrega) {
      writeFormattedValue(el.percentualCaptacaoAteEntrega, toHumanPercent(item.percentual_captacao_ate_entrega, null), {
        kind: "decimal",
        maximumFractionDigits: 2,
      }, { forceDisplay: true });
    }
    if (el.valorParcelaMinimaPreObra) {
      writeFormattedValue(el.valorParcelaMinimaPreObra, item.valor_parcela_minima_pre_obra ?? 0, {
        kind: "currency",
        maximumFractionDigits: 2,
      }, { forceDisplay: true });
    }
    if (el.valorDescontoMinimo) {
      writeFormattedValue(el.valorDescontoMinimo, item.valor_desconto_minimo ?? 0, {
        kind: "currency",
        maximumFractionDigits: 2,
      }, { forceDisplay: true });
    }
    if (el.valorDescontoMaximo) {
      writeFormattedValue(el.valorDescontoMaximo, item.valor_desconto_maximo ?? 50000, {
        kind: "currency",
        maximumFractionDigits: 2,
      }, { forceDisplay: true });
    }
    if (el.status) el.status.value = item.status || "Disponivel";
    state.evolucaoObra = Array.isArray(item.evolucao_obra) ? item.evolucao_obra : [];
    renderEvolucaoObra(state.evolucaoObra, item.percentual_conclusao_obra ?? 0);
    prepararNovoRegistroEvolucao(item.percentual_conclusao_obra ?? 0);
  }

  function formatPercent(value) {
    const number = parseLocaleNumber(value);
    if (!Number.isFinite(number)) return "0,00%";
    return `${formatLocaleNumber(number, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }

  function prepararNovoRegistroEvolucao(percentualAtual) {
    if (el.evolucaoData && !el.evolucaoData.value) {
      el.evolucaoData.value = todayInputValue();
    }
    if (el.evolucaoPercentual && !el.evolucaoPercentual.value) {
      writeFormattedValue(el.evolucaoPercentual, percentualAtual ?? 0, {
        kind: "decimal",
        maximumFractionDigits: 2,
      }, { forceDisplay: true });
    }
  }

  function renderEvolucaoObra(itens, percentualAtual = 0) {
    if (el.evolucaoAtual) {
      el.evolucaoAtual.textContent = formatPercent(percentualAtual);
    }
    if (!el.evolucaoLista) return;

    const historico = Array.isArray(itens) ? itens : [];
    if (!historico.length) {
      el.evolucaoLista.innerHTML = `
        <div class="tl-imoveis-empty">
          <strong>Nenhuma evolução registrada</strong>
          <p>Ao salvar novos marcos da obra, eles aparecerão aqui em ordem de data.</p>
        </div>
      `;
      return;
    }

    el.evolucaoLista.innerHTML = historico.map((item, index) => {
      const principal = index === 0 ? " is-current" : "";
      const data = shared.formatDate(item.data_referência || item.data_hora_criacao);
      const criado = item.data_hora_criacao ? shared.formatDateTime(item.data_hora_criacao) : "";
      const observacoes = String(item.observacoes || "").trim();
      return `
        <article class="tl-imoveis-evolucao-item${principal}">
          <div class="tl-imoveis-evolucao-item__marker"></div>
          <div class="tl-imoveis-evolucao-item__body">
            <div>
              <span>${shared.escapeHtml(data || "-")}</span>
              <strong>${shared.escapeHtml(formatPercent(item.percentual_conclusao_obra))}</strong>
            </div>
            ${observacoes ? `<p>${shared.escapeHtml(observacoes)}</p>` : ""}
            ${criado ? `<small>Registrado em ${shared.escapeHtml(criado)}</small>` : ""}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderSelectedFiles() {
    if (!el.arquivosSelecionados) return;
    const files = Array.from(state.pendingMidias || []);
    if (!files.length) {
      el.arquivosSelecionados.innerHTML = `
        <div class="tl-imoveis-empty">
          <strong>Nenhum arquivo selecionado</strong>
          <p>Você pode adicionar várias fotos e vídeos, inclusive em seleções separadas, antes de salvar o imóvel.</p>
        </div>
      `;
      return;
    }

    el.arquivosSelecionados.innerHTML = `
      <div class="tl-imoveis-file-queue__summary">
        <strong>${shared.escapeHtml(String(files.length))} arquivo(s) pronto(s) para envio</strong>
        <button class="tl-imoveis-btn tl-imoveis-btn--ghost" type="button" data-action="clear-selected-midias">
          Limpar fila
        </button>
      </div>
      <div class="tl-imoveis-file-list">
        ${files.map((file) => `
          <div class="tl-imoveis-file-list__item">
            <div class="tl-imoveis-file-list__meta">
              <span class="tl-imoveis-badge">${shared.escapeHtml(classifyPendingMidia(file))}</span>
              <strong title="${shared.escapeHtml(file.name)}">${shared.escapeHtml(file.name)}</strong>
            </div>
            <div class="tl-imoveis-file-list__actions">
              <span>${shared.escapeHtml(shared.formatSize(file.size))}</span>
              <button class="tl-imoveis-btn tl-imoveis-btn--ghost" type="button" data-action="remove-selected-midia" data-file-key="${shared.escapeHtml(buildPendingMidiaKey(file))}">
                Remover
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function buildPendingMidiaKey(file) {
    return [
      String(file?.name || "").trim().toLowerCase(),
      String(file?.size || 0),
      String(file?.lastModified || 0),
      String(file?.type || "").trim().toLowerCase(),
    ].join("::");
  }

  function classifyPendingMidia(file) {
    const mime = String(file?.type || "").trim().toLowerCase();
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("image/")) return "foto";
    const ext = String(file?.name || "").split(".").pop()?.toLowerCase() || "";
    return ["mp4", "mov", "webm"].includes(ext) ? "video" : "foto";
  }

  function handleUploadSelection() {
    const incomingFiles = Array.from(el.uploadInput?.files || []);
    if (!incomingFiles.length) {
      renderSelectedFiles();
      return;
    }

    const existingKeys = new Set((state.pendingMidias || []).map((file) => buildPendingMidiaKey(file)));
    incomingFiles.forEach((file) => {
      const key = buildPendingMidiaKey(file);
      if (existingKeys.has(key)) return;
      state.pendingMidias.push(file);
      existingKeys.add(key);
    });

    if (el.uploadInput) {
      el.uploadInput.value = "";
    }
    renderSelectedFiles();
  }

  function removePendingMidia(fileKey) {
    if (!fileKey) return;
    state.pendingMidias = (state.pendingMidias || []).filter((file) => buildPendingMidiaKey(file) !== fileKey);
    renderSelectedFiles();
  }

  function clearPendingMidias() {
    state.pendingMidias = [];
    if (el.uploadInput) {
      el.uploadInput.value = "";
    }
    renderSelectedFiles();
  }

  function renderMidias(midias) {
    if (!el.midiasExistentes) return;
    if (!midias || !midias.length) {
      el.midiasExistentes.innerHTML = `
        <div class="tl-imoveis-empty">
          <strong>Nenhuma mídia vinculada</strong>
          <p>Fotos e vídeos enviados para o imóvel aparecerão aqui.</p>
        </div>
      `;
      return;
    }

    el.midiasExistentes.innerHTML = `
      <div class="tl-imoveis-media-grid">
        ${midias.map((midia) => {
          const preview = midia.tipo_arquivo === "foto"
            ? `<img src="${shared.escapeHtml(midia.caminho_arquivo)}" alt="${shared.escapeHtml(midia.nome_arquivo)}" loading="lazy" />`
            : `<video src="${shared.escapeHtml(midia.caminho_arquivo)}" controls preload="metadata"></video>`;

          return `
            <article class="tl-imoveis-media-card">
              ${preview}
              <div class="tl-imoveis-media-card__body">
                <span class="tl-imoveis-badge">${shared.escapeHtml(midia.tipo_arquivo)}</span>
                <strong title="${shared.escapeHtml(midia.nome_arquivo)}">${shared.escapeHtml(midia.nome_arquivo)}</strong>
                <span>${shared.escapeHtml(shared.formatSize(midia.tamanho_bytes))}</span>
                <span>${shared.escapeHtml(shared.formatDateTime(midia.data_hora_criacao))}</span>
                ${state.canMedia ? `
                  <button
                    class="tl-imoveis-btn tl-imoveis-btn--ghost"
                    type="button"
                    data-action="remove-midia"
                    data-id="${shared.escapeHtml(midia.id)}"
                  >
                    Remover
                  </button>
                ` : ""}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  async function carregarImovel() {
    if (!state.id) return;
    const payload = await shared.apiRequest(shared.buildEndpoint(ENDPOINT_DETALHE, { id: state.id }), { method: "GET" });
    const item = payload.item;
    fillForm(item);
    renderMidias(item?.midias || []);
  }

  async function enviarMidias(imovelId) {
    const files = Array.from(state.pendingMidias || []);
    if (!files.length || !state.canMedia) return null;

    const formData = new FormData();
    files.forEach((file) => formData.append("arquivos", file));

    const payload = await shared.apiRequest(shared.buildEndpoint(ENDPOINT_UPLOAD, { id: imovelId }), {
      method: "POST",
      body: formData,
    });

    if (el.uploadInput) {
      el.uploadInput.value = "";
    }
    state.pendingMidias = [];
    renderSelectedFiles();

    return payload;
  }

  function montarPayloadEvolucaoObra() {
    const percentual = parseLocaleNumber(el.evolucaoPercentual?.value);
    if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
      shared.showInlineMessage(el.feedback, "error", "Informe um percentual de evolução entre 0 e 100.");
      return null;
    }

    return {
      percentual_conclusao_obra: percentual,
      data_referência: el.evolucaoData?.value || todayInputValue(),
      observacoes: el.evolucaoObservacoes?.value || null,
    };
  }

  function alternarBotoesEvolucao(processando) {
    [el.btnRegistrarEvolucao, el.btnRegistrarEvolucaoLoteEndereco].forEach((botao) => {
      if (botao) botao.disabled = Boolean(processando);
    });
  }

  async function registrarEvolucaoObra(event) {
    event.preventDefault();
    if (!state.id || !state.canEdit) return;

    const payload = montarPayloadEvolucaoObra();
    if (!payload) return;

    shared.showInlineMessage(el.feedback, "", "");
    alternarBotoesEvolucao(true);

    try {
      const resposta = await shared.apiRequest(shared.buildEndpoint(ENDPOINT_EVOLUCAO_OBRA, { id: state.id }), {
        method: "POST",
        body: payload,
      });

      if (el.evolucaoObservacoes) el.evolucaoObservacoes.value = "";
      if (el.evolucaoPercentual) el.evolucaoPercentual.value = "";
      await carregarImovel();
      shared.showInlineMessage(el.feedback, "success", resposta.mensagem || "Evolução da obra registrada com sucesso.");
    } catch (error) {
      shared.showInlineMessage(el.feedback, "error", error.message || "Não foi possível registrar a evolução da obra.");
    } finally {
      alternarBotoesEvolucao(false);
    }
  }

  async function registrarEvolucaoObraLoteEndereco() {
    if (!state.id || !state.canEdit) return;

    const payload = montarPayloadEvolucaoObra();
    if (!payload) return;

    const confirmado = window.confirm(
      "Aplicar esta evolução em todos os imóveis com o mesmo endereço deste cadastro? O registro individual continuará disponível."
    );
    if (!confirmado) return;

    shared.showInlineMessage(el.feedback, "", "");
    alternarBotoesEvolucao(true);

    try {
      const resposta = await shared.apiRequest(shared.buildEndpoint(ENDPOINT_EVOLUCAO_OBRA_LOTE_ENDERECO, { id: state.id }), {
        method: "POST",
        body: payload,
      });

      if (el.evolucaoObservacoes) el.evolucaoObservacoes.value = "";
      if (el.evolucaoPercentual) el.evolucaoPercentual.value = "";
      await carregarImovel();
      shared.showInlineMessage(el.feedback, "success", resposta.mensagem || "Evolução aplicada aos imóveis do mesmo endereço.");
    } catch (error) {
      shared.showInlineMessage(el.feedback, "error", error.message || "Não foi possível aplicar a evolução em lote.");
    } finally {
      alternarBotoesEvolucao(false);
    }
  }

  async function salvarImovel(event) {
    event.preventDefault();

    const possuiArquivos = Array.from(state.pendingMidias || []).length > 0;
    const payload = collectPayload();

    shared.showInlineMessage(el.feedback, "", "");
    if ((payload.valor_desconto_maximo ?? 0) < (payload.valor_desconto_minimo ?? 0)) {
      shared.showInlineMessage(el.feedback, "error", "O incentivo 7LM máximo não pode ser menor que o incentivo 7LM mínimo.");
      return;
    }
    if (el.btnSalvar) el.btnSalvar.disabled = true;

    try {
      if (state.isEdit) {
        if (!state.canEdit) {
          throw new Error("Seu perfil não possui permissão para editar os dados do imóvel.");
        }

        await shared.apiRequest(shared.buildEndpoint(ENDPOINT_ATUALIZAR, { id: state.id }), {
          method: "PUT",
          body: payload,
        });
      } else {
        if (!state.canCreate) {
          throw new Error("Seu perfil não possui permissão para cadastrar imóveis.");
        }

        const response = await shared.apiRequest(ENDPOINT_CRIAR, {
          method: "POST",
          body: payload,
        });
        state.id = response.item.id;
        state.isEdit = true;
        history.replaceState({}, "", `${shared.buildPortalPath(PATH_CADASTRO)}?id=${encodeURIComponent(state.id)}`);
        syncPermissionState();
      }

      let message = "Imóvel salvo com sucesso.";

      if (possuiArquivos && state.canMedia) {
        await enviarMidias(state.id);
        message = `${message} Mídias sincronizadas.`;
      } else if (possuiArquivos && !state.canMedia) {
        message = `${message} As mídias selecionadas não foram enviadas porque seu perfil não possui permissão para isso.`;
      }

      await carregarImovel();
      shared.showInlineMessage(el.feedback, "success", message);
    } catch (error) {
      shared.showInlineMessage(el.feedback, "error", error.message || "Não foi possível salvar o imóvel.");
    } finally {
      if (el.btnSalvar) el.btnSalvar.disabled = false;
      releaseGate();
    }
  }

  async function removerMidia(identificadorMidia) {
    if (!identificadorMidia || !state.canMedia || !state.id) return;
    const confirmar = window.confirm("Deseja remover esta mídia do imóvel?");
    if (!confirmar) return;

    try {
      await shared.apiRequest(
        shared.buildEndpoint(ENDPOINT_REMOVER_MIDIA, { id: state.id, midia_id: identificadorMidia }),
        { method: "DELETE" }
      );
      await carregarImovel();
      shared.showInlineMessage(el.feedback, "success", "Mídia removida com sucesso.");
    } catch (error) {
      shared.showInlineMessage(el.feedback, "error", error.message || "Não foi possível remover a mídia.");
    }
  }

  function bindEvents() {
    el.form?.addEventListener("submit", salvarImovel);
    el.evolucaoForm?.addEventListener("submit", registrarEvolucaoObra);
    el.btnRegistrarEvolucaoLoteEndereco?.addEventListener("click", registrarEvolucaoObraLoteEndereco);
    el.dataEntrega?.addEventListener("change", syncDeliveryMonths);
    el.dataEntrega?.addEventListener("input", syncDeliveryMonths);
    el.valor?.addEventListener("input", () => {
      syncGuaranteedValue({ preferExistingGuarantee: true });
      syncDeliveryCapturePlanned({ preferExistingValue: true });
    });
    el.valor?.addEventListener("change", () => {
      syncGuaranteedValue({ preferExistingGuarantee: true });
      syncDeliveryCapturePlanned({ preferExistingValue: true });
    });
    el.percentualFechamentoMinimo?.addEventListener("input", () => syncGuaranteedValue());
    el.percentualFechamentoMinimo?.addEventListener("change", () => syncGuaranteedValue());
    el.valorGarantido?.addEventListener("input", syncGuaranteedPercent);
    el.valorGarantido?.addEventListener("change", syncGuaranteedPercent);
    el.percentualCaptacaoAteEntrega?.addEventListener("input", () => syncDeliveryCapturePlanned());
    el.percentualCaptacaoAteEntrega?.addEventListener("change", () => syncDeliveryCapturePlanned());
    el.valorGarantidoPreObraPlanejado?.addEventListener("input", syncDeliveryCapturePercent);
    el.valorGarantidoPreObraPlanejado?.addEventListener("change", syncDeliveryCapturePercent);
    el.uploadInput?.addEventListener("change", handleUploadSelection);
    el.arquivosSelecionados?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const action = button.getAttribute("data-action") || "";
      if (action === "remove-selected-midia") {
        removePendingMidia(button.getAttribute("data-file-key") || "");
        return;
      }
      if (action === "clear-selected-midias") {
        clearPendingMidias();
      }
    });
    el.midiasExistentes?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action='remove-midia']");
      if (!button) return;
      void removerMidia(button.getAttribute("data-id") || "");
    });
  }

  async function guardPage() {
    state.user = await shared.ensureUser(true);
    state.id = currentId();
    state.isEdit = Boolean(state.id);
    syncPermissionState();

    const podeSeguir = state.isEdit
      ? (state.canEdit || state.canMedia)
      : state.canCreate;

    if (!podeSeguir) {
      shared.queueAccessNotice(
        state.isEdit
          ? "Você não tem permissão para editar este imóvel ou gerenciar as mídias dele."
          : "Você não tem permissão para cadastrar imóveis."
      );
      window.location.replace(buildListPath());
      return false;
    }

    return true;
  }

  async function boot() {
    shared.initChrome();
    bindFieldMasks();
    bindFieldNormalizers();
    bindEvents();
    renderSelectedFiles();

    const allowed = await guardPage();
    if (!allowed) return;

    try {
      if (state.isEdit) {
        await carregarImovel();
      } else {
        if (el.tipoGaragem) el.tipoGaragem.value = "carro";
        writeFormattedValue(el.percentualFechamentoMinimo, 70, {
          kind: "decimal",
          maximumFractionDigits: 2,
        }, { forceDisplay: true });
        writeFormattedValue(el.valorParcelaMinimaPreObra, 0, {
          kind: "currency",
          maximumFractionDigits: 2,
        }, { forceDisplay: true });
        writeFormattedValue(el.valorDescontoMinimo, 0, {
          kind: "currency",
          maximumFractionDigits: 2,
        }, { forceDisplay: true });
        writeFormattedValue(el.valorDescontoMaximo, 50000, {
          kind: "currency",
          maximumFractionDigits: 2,
        }, { forceDisplay: true });
        renderMidias([]);
      }
      applyFormattedFieldDisplays();
      releaseGate();
    } catch (error) {
      releaseGate();
      shared.showInlineMessage(el.feedback, "error", error.message || "Não foi possível carregar o imóvel.");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    void boot();
  });
})();
