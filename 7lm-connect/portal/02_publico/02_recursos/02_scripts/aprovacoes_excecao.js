(function () {
  "use strict";

  const TOKEN_KEY = ["sevenlm_connect_token_de_acesso", "sevenlm_connect_token_de_acesso"];
  const portalState = window.SevenLMConnectPortalState || null;

  function meta(name, fallback) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el?.getAttribute("content") || fallback;
  }

  function detectApiBaseUrl() {
    try {
      const { protocol, hostname, port, origin } = window.location;
      const isLocal = hostname === "127.0.0.1" || hostname === "localhost";
      if (isLocal && port === "3000") {
        return `${protocol}//${hostname}:8000`;
      }
      return origin;
    } catch {
      return "http://127.0.0.1:8000";
    }
  }

  function resolveApiBaseUrl() {
    const detected = detectApiBaseUrl();
    const configured = String(meta("sevenlm-connect-api-base-url", "") || "").trim();
    if (!configured) return detected;

    try {
      const url = new URL(configured, window.location.origin);
      const isLocalConfig = url.hostname === "127.0.0.1" || url.hostname === "localhost";
      const isLocalPage = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
      if (isLocalConfig && !isLocalPage) return detected;
    } catch {
      return detected;
    }

    return configured;
  }

  const API_BASE_URL = resolveApiBaseUrl();
  const ENDPOINT_ME = meta("sevenlm-connect-endpoint-me", "/api/me");
  const ENDPOINT_RESUMO = meta("sevenlm-connect-endpoint-aprovacoes-resumo", "/api/connect-comercial/aprovacoes-excecao/resumo");
  const ENDPOINT_LISTA = meta("sevenlm-connect-endpoint-aprovacoes-lista", "/api/connect-comercial/aprovacoes-excecao");
  const ENDPOINT_DETALHE = meta("sevenlm-connect-endpoint-aprovacoes-detalhe", "/api/connect-comercial/aprovacoes-excecao/{id}");
  const ENDPOINT_DECISAO = meta("sevenlm-connect-endpoint-aprovacoes-decisao", "/api/connect-comercial/aprovacoes-excecao/{id}/decisao");

  let el = {};

  function collectElements() {
    el = {
      nomeUsuario: document.getElementById("nomeUsuario"),
      metaUsuario: document.getElementById("metaUsuario"),
      userInitials: document.getElementById("userInitials"),
      btnTema: document.getElementById("btnTema"),
      kpiPendentes: document.getElementById("kpiPendentes"),
      kpiPerfil: document.getElementById("kpiPerfil"),
      kpiPerfilHint: document.getElementById("kpiPerfilHint"),
      kpiAtualizadoEm: document.getElementById("kpiAtualizadoEm"),
      feedback: document.getElementById("feedbackAprovacoes"),
      listaResumo: document.getElementById("listaResumo"),
      listaAprovacoes: document.getElementById("listaAprovacoes"),
      detalheAprovacao: document.getElementById("detalheAprovacao"),
      badgeStatusDetalhe: document.getElementById("badgeStatusDetalhe"),
      inputBusca: document.getElementById("inputBuscaAprovacao"),
      btnAtualizar: document.getElementById("btnAtualizarAprovacoes"),
      filtros: Array.from(document.querySelectorAll(".tl-aprovacoes-filtros button[data-filter]")),
    };
  }

  const state = {
    user: null,
    manage: false,
    totalPendentes: 0,
    itens: [],
    selecionadoId: "",
    filtro: "PENDENTE",
    busca: "",
    carregando: false,
  };

  function readSession(key) {
    const keys = Array.isArray(key) ? key : [key];
    try {
      for (const item of keys) {
        const value = window.sessionStorage.getItem(item);
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

  function endpoint(path, params = {}) {
    let url = /^https?:\/\//i.test(path)
      ? path
      : `${trimTrailingSlash(API_BASE_URL)}${ensureLeadingSlash(path)}`;

    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, encodeURIComponent(String(value ?? "")));
    });
    return url;
  }

  async function safeJson(response) {
    const text = await response.text().catch(() => "");
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  async function api(url, method = "GET", body = null) {
    const token = readSession(TOKEN_KEY);
    const headers = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== null) headers["Content-Type"] = "application/json";

    const response = await fetch(url, {
      method,
      cache: "no-store",
      credentials: "same-origin",
      headers,
      body: body !== null ? JSON.stringify(body) : undefined,
    });

    const payload = await safeJson(response);
    if (!response.ok) {
      const detail = payload?.detail;
      const message = typeof detail === "string"
        ? detail
        : detail?.mensagem || payload?.mensagem || "Não foi possível concluir a operação.";
      throw new Error(message);
    }

    return payload;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeSearch(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function firstFilled(...values) {
    for (const value of values) {
      if (value === null || value === undefined) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return "";
  }

  function formatMoney(value) {
    const number = Number(value || 0);
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number);
  }

  function formatPercent(value) {
    const number = Number(value || 0) * 100;
    return `${number.toFixed(2).replace(".", ",")}%`;
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  }

  function initialsFromName(value) {
    const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "7L";
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
  }

  function statusLabel(status) {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "PENDENTE") return "Pendente";
    if (normalized === "APROVADA") return "Aprovada";
    if (normalized === "REPROVADA") return "Reprovada";
    if (normalized === "CANCELADA") return "Cancelada";
    return firstFilled(status, "Sem status");
  }

  function statusClass(status) {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "PENDENTE") return "tl-aprovacoes-status tl-aprovacoes-status--pendente";
    if (normalized === "APROVADA") return "tl-aprovacoes-status tl-aprovacoes-status--aprovada";
    if (normalized === "REPROVADA") return "tl-aprovacoes-status tl-aprovacoes-status--reprovada";
    if (normalized === "CANCELADA") return "tl-aprovacoes-status tl-aprovacoes-status--cancelada";
    return "tl-aprovacoes-status";
  }

  function itemMatchesSearch(item) {
    if (!state.busca) return true;
    const texto = normalizeSearch([
      item?.cliente?.nome_completo,
      item?.cliente?.cpf,
      item?.imovel?.titulo,
      item?.motivo,
      item?.observacoes_solicitacao,
    ].filter(Boolean).join(" "));
    return texto.includes(state.busca);
  }

  function getFilteredItems() {
    return state.itens.filter(itemMatchesSearch);
  }

  function setFeedback(variant, message) {
    if (!el.feedback) return;
    el.feedback.textContent = message || "";
    if (variant) {
      el.feedback.dataset.variant = variant;
    } else {
      delete el.feedback.dataset.variant;
    }
  }

  function fillUserbox() {
    const user = state.user || {};
    const name = firstFilled(user.nome_completo, user.correio_eletronico, "Gestor 7LM");
    if (el.nomeUsuario) el.nomeUsuario.textContent = name;
    if (el.metaUsuario) {
      el.metaUsuario.textContent = state.manage
        ? "Gestão habilitada para aprovações"
        : "Acesso somente leitura";
    }
    if (el.userInitials) el.userInitials.textContent = initialsFromName(name);
    if (el.kpiPerfil) el.kpiPerfil.textContent = state.manage ? "Gestor" : "Consulta";
    if (el.kpiPerfilHint) {
      el.kpiPerfilHint.textContent = state.manage
        ? "Pode aprovar e reprovar operações pendentes."
        : "Pode apenas acompanhar o histórico das decisões.";
    }
  }

  async function loadCurrentUser() {
    const payload = await api(endpoint(ENDPOINT_ME));
    state.user = payload?.usuario || payload?.user || payload || null;
    const acessos = state.user?.acessos_portal || {};
    state.manage = Boolean(acessos["aprovacoes.excecao.manage"] || acessos["administracao.manage"]);
    fillUserbox();
  }

  async function loadItems({ keepSelection = true } = {}) {
    state.carregando = true;
    setFeedback("", "Atualizando fila de aprovações...");

    try {
      const query = new URLSearchParams();
      if (state.filtro && state.filtro !== "TODAS") query.set("status", state.filtro);
      query.set("limite", "300");

      const payload = await api(`${endpoint(ENDPOINT_LISTA)}?${query.toString()}`);
      state.itens = Array.isArray(payload?.itens) ? payload.itens : [];
      state.totalPendentes = Number(payload?.total_pendentes || 0);
      if (el.kpiPendentes) el.kpiPendentes.textContent = String(state.totalPendentes);
      if (el.kpiAtualizadoEm) el.kpiAtualizadoEm.textContent = formatDateTime(new Date().toISOString());

      const filteredItems = getFilteredItems();
      if (!keepSelection || !filteredItems.some((item) => String(item.id) === String(state.selecionadoId))) {
        state.selecionadoId = filteredItems[0]?.id || "";
      }

      renderList();
      await loadDetail(state.selecionadoId);
      setFeedback("", filteredItems.length ? "" : "Nenhuma solicitação encontrada para o filtro atual.");
    } finally {
      state.carregando = false;
    }
  }

  async function loadDetail(id) {
    if (!id) {
      renderDetail(null);
      return;
    }
    const payload = await api(endpoint(ENDPOINT_DETALHE, { id }));
    renderDetail(payload?.item || null);
  }

  function renderList() {
    const items = getFilteredItems();
    if (el.listaResumo) {
      el.listaResumo.textContent = `${items.length} ${items.length === 1 ? "item" : "itens"}`;
    }
    if (!el.listaAprovacoes) return;

    if (!items.length) {
      el.listaAprovacoes.innerHTML = '<div class="tl-aprovacoes-empty">Nenhuma solicitação encontrada.</div>';
      return;
    }

    el.listaAprovacoes.innerHTML = items.map((item) => {
      const active = String(item.id) === String(state.selecionadoId);
      const cliente = firstFilled(item?.cliente?.nome_completo, "Cliente não informado");
      const imovel = firstFilled(item?.imovel?.titulo, "Imóvel não informado");
      const gap = Math.max(Number(item?.gap_garantia || 0), Number(item?.gap_pre_obra || 0));
      return `
        <button class="tl-aprovacoes-item${active ? " is-active" : ""}" type="button" data-id="${escapeHtml(item.id)}">
          <div class="tl-aprovacoes-item__head">
            <strong class="tl-aprovacoes-item__title">${escapeHtml(cliente)}</strong>
            <span class="${statusClass(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
          </div>
          <div class="tl-aprovacoes-item__subtitle">${escapeHtml(imovel)}</div>
          <div class="tl-aprovacoes-item__meta">
            <span>Solicitada em ${escapeHtml(formatDateTime(item.solicitado_em))}</span>
            <span>Gap maximo ${escapeHtml(formatMoney(gap))}</span>
          </div>
        </button>`;
    }).join("");

    el.listaAprovacoes.querySelectorAll(".tl-aprovacoes-item[data-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        state.selecionadoId = button.dataset.id || "";
        renderList();
        await loadDetail(state.selecionadoId);
      });
    });
  }

  function renderMetric(label, value, helper = "") {
    return `
      <article>
        <small>${escapeHtml(label)}</small>
        <strong>${escapeHtml(value)}</strong>
        ${helper ? `<span>${escapeHtml(helper)}</span>` : ""}
      </article>`;
  }

  function asArray(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item !== null && item !== undefined && (typeof item !== "string" || item.trim()));
  }

  function firstNumber(...values) {
    for (const value of values) {
      if (value === null || value === undefined || value === "") continue;
      const number = Number(value);
      if (Number.isFinite(number) && Math.abs(number) > 0) return number;
      const normalized = String(value).trim().replace(/\./g, "").replace(",", ".");
      const fallbackNumber = Number(normalized);
      if (Number.isFinite(fallbackNumber) && Math.abs(fallbackNumber) > 0) return fallbackNumber;
    }
    for (const value of values) {
      if (value === null || value === undefined || value === "") continue;
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return 0;
  }

  function objectOrEmpty(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function firstObject(...values) {
    for (const value of values) {
      const object = objectOrEmpty(value);
      if (Object.keys(object).length) return object;
    }
    return {};
  }

  function getPayloadSnapshot(item) {
    return objectOrEmpty(item?.payload_snapshot);
  }

  function getCalculationSnapshot(item) {
    const snapshot = getPayloadSnapshot(item);
    const simulacao = objectOrEmpty(snapshot.simulacao);
    const simulacaoSnapshot = objectOrEmpty(simulacao.payload_snapshot);
    return firstObject(snapshot.calculo, simulacaoSnapshot.calculo, simulacao);
  }

  function getApprovalAnalysis(item) {
    const snapshot = getPayloadSnapshot(item);
    const simulacao = objectOrEmpty(snapshot.simulacao);
    const calculo = getCalculationSnapshot(item);
    return firstObject(snapshot.aprovacao_excecao, simulacao.aprovacao_excecao, calculo.aprovacao_excecao);
  }

  function getOperationSummary(item) {
    const snapshot = getPayloadSnapshot(item);
    const simulacao = objectOrEmpty(snapshot.simulacao);
    const calculo = getCalculationSnapshot(item);
    return firstObject(calculo.resumo_operacao, simulacao.resumo_operacao, item?.simulacao);
  }

  function getClientDecisionContext(item, analysis) {
    const snapshot = getPayloadSnapshot(item);
    const simulacao = objectOrEmpty(snapshot.simulacao);
    const calculo = getCalculationSnapshot(item);
    return firstObject(analysis?.composicao_familiar, calculo.cliente, simulacao.cliente);
  }

  function triggerLabel(value) {
    const key = normalizeSearch(value).replace(/\s+/g, "_");
    const labels = {
      garantido: "Garantido",
      garantido_pre_obra: "Garantido pré-obra",
      validacao_comercial: "Validação comercial",
      desconto_comercial: "Incentivo 7LM",
      composicao_familiar: "Composição familiar",
    };
    return labels[key] || firstFilled(value, "Gatilho");
  }

  function renderTagList(values, emptyText = "Nenhum item registrado") {
    const items = asArray(values);
    if (!items.length) return `<p class="tl-aprovacoes-muted">${escapeHtml(emptyText)}</p>`;
    return `<div class="tl-aprovacoes-tag-list">${items.map((item) => `
      <span class="tl-aprovacoes-mini-tag">${escapeHtml(triggerLabel(item))}</span>
    `).join("")}</div>`;
  }

  function renderInfoGrid(rows) {
    const items = rows.filter((row) => row && row.value !== null && row.value !== undefined && String(row.value).trim() !== "");
    if (!items.length) return "";
    return `
      <div class="tl-aprovacoes-info-grid">
        ${items.map((row) => `
          <article>
            <small>${escapeHtml(row.label)}</small>
            <strong>${escapeHtml(row.value)}</strong>
            ${row.helper ? `<span>${escapeHtml(row.helper)}</span>` : ""}
          </article>
        `).join("")}
      </div>`;
  }

  function renderSimpleList(items, emptyText) {
    const list = asArray(items);
    if (!list.length) return `<p class="tl-aprovacoes-muted">${escapeHtml(emptyText)}</p>`;
    return `
      <ul class="tl-aprovacoes-lista-simples tl-aprovacoes-lista-simples--rich">
        ${list.map((item) => {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            const titulo = firstFilled(item.titulo, item.title, item.categoria, "Item de validação");
            const descricao = firstFilled(item.descricao, item.description, item.status);
            return `
              <li>
                <strong>${escapeHtml(titulo)}</strong>
                ${descricao ? `<span>${escapeHtml(descricao)}</span>` : ""}
              </li>`;
          }
          return `<li>${escapeHtml(item)}</li>`;
        }).join("")}
      </ul>`;
  }

  function renderChecklist(items) {
    const list = asArray(items);
    if (!list.length) {
      return '<p class="tl-aprovacoes-muted">Nenhum checklist específico foi enviado no snapshot da simulação.</p>';
    }
    return `
      <div class="tl-aprovacoes-checklist">
        ${list.map((item) => {
          const data = objectOrEmpty(item);
          const categoria = firstFilled(data.categoria, "Validação");
          const titulo = firstFilled(data.titulo, data.title, "Item pendente");
          const descricao = firstFilled(data.descricao, data.description, "Conferir antes da decisão.");
          return `
            <article class="tl-aprovacoes-check">
              <span>${escapeHtml(categoria)}</span>
              <strong>${escapeHtml(titulo)}</strong>
              <p>${escapeHtml(descricao)}</p>
            </article>`;
        }).join("")}
      </div>`;
  }

  function renderMemberList(complementos) {
    const membros = asArray(complementos);
    if (!membros.length) {
      return '<p class="tl-aprovacoes-muted">Nenhum integrante de composição familiar foi registrado no snapshot.</p>';
    }
    return `
      <div class="tl-aprovacoes-member-list">
        ${membros.map((membro, index) => {
          const nome = firstFilled(membro?.nome, `Integrante ${index + 1}`);
          const cpf = firstFilled(membro?.cpf, "CPF não informado");
          const parentesco = firstFilled(membro?.parentesco, "Vínculo não informado");
          const ativo = membro?.ativo === false ? "Inativo" : "Ativo";
          const emAnalise = membro?.incluir_na_analise === false ? "Fora da análise" : "Em análise";
          const compoeRenda = membro?.compoe_renda === false || membro?.incluir_na_composicao_financeira === false
            ? "Não compõe renda"
            : "Compõe renda";
          return `
            <article class="tl-aprovacoes-member">
              <div>
                <strong>${escapeHtml(nome)}</strong>
                <span>${escapeHtml(parentesco)} • ${escapeHtml(cpf)}</span>
              </div>
              <div class="tl-aprovacoes-member__meta">
                <span>${escapeHtml(formatMoney(firstNumber(membro?.renda)))}</span>
                <small>${escapeHtml(ativo)} • ${escapeHtml(emAnalise)} • ${escapeHtml(compoeRenda)}</small>
              </div>
            </article>`;
        }).join("")}
      </div>`;
  }

  function renderDetailLegacy(item) {
    if (!el.detalheAprovacao || !el.badgeStatusDetalhe) return;

    if (!item) {
      el.badgeStatusDetalhe.className = "tl-aprovacoes-status";
      el.badgeStatusDetalhe.textContent = "Sem seleção";
      el.detalheAprovacao.className = "tl-aprovacoes-detail tl-aprovacoes-empty";
      el.detalheAprovacao.textContent = "Selecione uma solicitação à esquerda para revisar os gatilhos, os gaps e decidir a operação.";
      return;
    }

    el.badgeStatusDetalhe.className = statusClass(item.status);
    el.badgeStatusDetalhe.textContent = statusLabel(item.status);
    el.detalheAprovacao.className = "tl-aprovacoes-detail";

    const cliente = item?.cliente || {};
    const imovel = item?.imovel || {};
    const solicitante = item?.solicitante || {};
    const avaliador = item?.avaliador || {};
    const gatilhos = Array.isArray(item?.payload_snapshot?.aprovacao_excecao?.gatilhos_pendentes)
      ? item.payload_snapshot.aprovacao_excecao.gatilhos_pendentes
      : [];
    const bloqueios = Array.isArray(item?.payload_snapshot?.aprovacao_excecao?.bloqueios)
      ? item.payload_snapshot.aprovacao_excecao.bloqueios
      : [];
    const allowDecision = state.manage && String(item.status || "").toUpperCase() === "PENDENTE";

    el.detalheAprovacao.innerHTML = `
      <section class="tl-aprovacoes-block">
        <div class="tl-aprovacoes-detail__row">
          <div>
            <h3>${escapeHtml(firstFilled(cliente.nome_completo, "Cliente não informado"))}</h3>
            <p>${escapeHtml(firstFilled(cliente.cpf, "CPF não informado"))} • ${escapeHtml(firstFilled(cliente.cidade, "Cidade não informada"))}</p>
          </div>
          <div class="tl-aprovacoes-tag tl-aprovacoes-tag--${escapeHtml(String(item.status || "").toLowerCase())}">
            ${escapeHtml(statusLabel(item.status))}
          </div>
        </div>
        <p><strong>Imóvel:</strong> ${escapeHtml(firstFilled(imovel.titulo, "Não informado"))}</p>
        <p><strong>Motivo:</strong> ${escapeHtml(firstFilled(item.motivo, "Solicitação sem motivo registrado."))}</p>
        <p><strong>Observações do corretor:</strong> ${escapeHtml(firstFilled(item.observacoes_solicitacao, "Sem observações."))}</p>
      </section>

      <section class="tl-aprovacoes-block">
        <h3>Gatilhos e gaps</h3>
        <div class="tl-aprovacoes-metrics">
          ${renderMetric("Garantido planejado", formatMoney(item.valor_garantido_planejado))}
          ${renderMetric("Garantido real", formatMoney(item.valor_garantido_real))}
          ${renderMetric("Gap do garantido", formatMoney(item.gap_garantia), formatPercent(item.percentual_gap_garantia))}
          ${renderMetric("Pré-obra planejado", formatMoney(item.valor_garantido_pre_obra_planejado))}
          ${renderMetric("Pré-obra real", formatMoney(item.valor_garantido_pre_obra_real))}
          ${renderMetric("Gap do pré-obra", formatMoney(item.gap_pre_obra), formatPercent(item.percentual_gap_pre_obra))}
        </div>
      </section>

      <section class="tl-aprovacoes-block">
        <h3>Contexto da solicitação</h3>
        <ul class="tl-aprovacoes-lista-simples">
          <li><strong>Solicitante:</strong> ${escapeHtml(firstFilled(solicitante.nome_completo, solicitante.email, "Não informado"))}</li>
          <li><strong>Enviada em:</strong> ${escapeHtml(formatDateTime(item.solicitado_em))}</li>
          <li><strong>Status atual da unidade:</strong> ${escapeHtml(firstFilled(imovel.status, "Não informado"))}</li>
          <li><strong>Status da reserva:</strong> ${escapeHtml(firstFilled(item.reserva_status, "Não informado"))}</li>
          <li><strong>Gatilhos pendentes:</strong> ${escapeHtml(gatilhos.length ? gatilhos.join(", ") : "Sem gatilhos pendentes")}</li>
          <li><strong>Bloqueios técnicos:</strong> ${escapeHtml(bloqueios.length ? bloqueios.join(" | ") : "Nenhum bloqueio adicional registrado")}</li>
          <li><strong>Avaliado por:</strong> ${escapeHtml(firstFilled(avaliador.nome_completo, avaliador.email, "Ainda não avaliado"))}</li>
          <li><strong>Observações da decisão:</strong> ${escapeHtml(firstFilled(item.observacoes_avaliacao, "Sem parecer até o momento."))}</li>
        </ul>
      </section>

      ${allowDecision ? `
        <section class="tl-aprovacoes-block">
          <h3>Decisão do gestor</h3>
          <div class="tl-aprovacoes-decision">
            <textarea id="campoObservacoesDecisao" placeholder="Registrar o motivo da decisão para histórico interno."></textarea>
            <div class="tl-aprovacoes-decision__actions">
              <button class="tl-aprovacoes-btn tl-aprovacoes-btn--approve" type="button" data-action="aprovar">Aprovar operação</button>
              <button class="tl-aprovacoes-btn tl-aprovacoes-btn--reject" type="button" data-action="reprovar">Reprovar operação</button>
            </div>
          </div>
        </section>` : ""}
    `;

    if (allowDecision) {
      el.detalheAprovacao.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", async () => {
          const action = button.getAttribute("data-action");
          const textarea = document.getElementById("campoObservacoesDecisao");
          const observacoes = textarea?.value?.trim() || "";
          await decidir(item.id, action, observacoes);
        });
      });
    }
  }

  function renderDetail(item) {
    if (!el.detalheAprovacao || !el.badgeStatusDetalhe) return;

    if (!item) {
      el.badgeStatusDetalhe.className = "tl-aprovacoes-status";
      el.badgeStatusDetalhe.textContent = "Sem seleção";
      el.detalheAprovacao.className = "tl-aprovacoes-detail tl-aprovacoes-empty";
      el.detalheAprovacao.textContent = "Selecione uma solicitação à esquerda para revisar os gatilhos, os gaps e decidir a operação.";
      return;
    }

    el.badgeStatusDetalhe.className = statusClass(item.status);
    el.badgeStatusDetalhe.textContent = statusLabel(item.status);
    el.detalheAprovacao.className = "tl-aprovacoes-detail";

    const analysis = getApprovalAnalysis(item);
    const calculo = getCalculationSnapshot(item);
    const resumo = getOperationSummary(item);
    const clienteContext = getClientDecisionContext(item, analysis);
    const cliente = {
      ...objectOrEmpty(clienteContext.cliente),
      ...objectOrEmpty(item?.cliente),
    };
    const imovel = {
      ...objectOrEmpty(calculo.imovel),
      ...objectOrEmpty(item?.imovel),
    };
    const solicitante = item?.solicitante || {};
    const avaliador = item?.avaliador || {};
    const nucleo = firstObject(analysis.nucleo_familiar, clienteContext.nucleo_familiar);
    const complementosAnalise = asArray(objectOrEmpty(analysis.composicao_familiar).complementos);
    const complementos = complementosAnalise.length ? complementosAnalise : asArray(clienteContext.complementos);
    const motivos = asArray(analysis.motivos_aprovacao);
    const checklist = asArray(analysis.checklist_aprovacao);
    const gatilhos = asArray(analysis.gatilhos_pendentes);
    const bloqueios = asArray(analysis.bloqueios);
    const bloqueiosSimulacao = asArray(analysis.bloqueios_simulacao);
    const allowDecision = state.manage && String(item.status || "").toUpperCase() === "PENDENTE";
    const valorTotalOperacao = firstNumber(resumo.valor_total_operacao, item?.simulacao?.valor_total_operacao, imovel.valor_total_operacao);
    const valorTotalCliente = firstNumber(resumo.valor_total_cliente, resumo.valor_total_operacao, valorTotalOperacao);
    const valorImovel = firstNumber(resumo.valor_imovel, imovel.valor, imovel.valor_original);
    const parcelaBanco = firstNumber(resumo.parcela_financiamento_banco, item?.simulacao?.parcela_financiamento_banco);
    const parcelaPre = firstNumber(resumo.parcela_7lm_media_pre, resumo.mensal_pre);
    const parcelaPos = firstNumber(resumo.parcela_7lm_pos, resumo.parcela_7lm_pos_media, resumo.mensal_pos);

    el.detalheAprovacao.innerHTML = `
      <section class="tl-aprovacoes-block tl-aprovacoes-block--decision">
        <div class="tl-aprovacoes-detail__row">
          <div>
            <h3>${escapeHtml(firstFilled(cliente.nome_completo, "Cliente não informado"))}</h3>
            <p>${escapeHtml(firstFilled(cliente.cpf, "CPF não informado"))} • ${escapeHtml(firstFilled(cliente.cidade, "Cidade não informada"))}</p>
          </div>
          <div class="tl-aprovacoes-tag tl-aprovacoes-tag--${escapeHtml(String(item.status || "").toLowerCase())}">
            ${escapeHtml(statusLabel(item.status))}
          </div>
        </div>
        <p><strong>Imóvel:</strong> ${escapeHtml(firstFilled(imovel.titulo, "Não informado"))}</p>
        <p><strong>Motivo:</strong> ${escapeHtml(firstFilled(item.motivo, "Solicitação sem motivo registrado."))}</p>
        <p><strong>Observações do corretor:</strong> ${escapeHtml(firstFilled(item.observacoes_solicitacao, "Sem observações."))}</p>
        <div class="tl-aprovacoes-reasons">
          <h4>Por que precisa aprovar</h4>
          ${renderSimpleList(motivos, "Nenhum motivo detalhado foi registrado.")}
        </div>
      </section>

      <section class="tl-aprovacoes-block">
        <div class="tl-aprovacoes-section-head">
          <h3>Checklist do gestor</h3>
          <span>Antes da decisão</span>
        </div>
        ${renderChecklist(checklist)}
      </section>

      <section class="tl-aprovacoes-block">
        <div class="tl-aprovacoes-section-head">
          <h3>Cliente e composição familiar</h3>
          <span>${escapeHtml(`${Number(nucleo.total_membros || 0)} integrante(s)`)}</span>
        </div>
        ${renderInfoGrid([
          { label: "Renda principal", value: formatMoney(firstNumber(clienteContext.renda_principal, resumo.renda_principal)) },
          { label: "Renda complementar", value: formatMoney(firstNumber(clienteContext.renda_complementar, resumo.renda_complementar)) },
          { label: "Renda total", value: formatMoney(firstNumber(clienteContext.renda_total, resumo.renda_total)) },
          { label: "Limite de comprometimento", value: formatMoney(firstNumber(clienteContext.limite_comprometimento, resumo.limite_comprometimento)) },
          { label: "Parcela máxima informada", value: formatMoney(firstNumber(clienteContext.parcela_cliente_informada, resumo.parcela_cliente_informada)) },
          { label: "Status documental", value: firstFilled(cliente.status_documental, "Pendente de conferência") },
          { label: "Membros ativos", value: String(Number(nucleo.membros_ativos || 0)) },
          { label: "Membros em análise", value: String(Number(nucleo.membros_em_analise || 0)) },
          { label: "Membros compondo renda", value: String(Number(nucleo.membros_compoem_renda || 0)) },
          { label: "Renda complementar ativa", value: formatMoney(firstNumber(nucleo.renda_complementar_ativa)) },
        ])}
        ${renderMemberList(complementos)}
      </section>

      <section class="tl-aprovacoes-block">
        <div class="tl-aprovacoes-section-head">
          <h3>Operação financeira</h3>
          <span>Snapshot do simulador</span>
        </div>
        ${renderInfoGrid([
          { label: "Valor total do imóvel", value: formatMoney(valorTotalOperacao) },
          { label: "Valor base do imóvel", value: formatMoney(valorImovel) },
          { label: "Total pago pelo cliente", value: formatMoney(valorTotalCliente) },
          { label: "Financiamento / aprovado", value: formatMoney(firstNumber(resumo.financiamento_caixa, item?.simulacao?.financiamento_caixa)) },
          { label: "Parcela do banco", value: formatMoney(parcelaBanco) },
          { label: "Entrada / sinal", value: formatMoney(firstNumber(resumo.entrada, item?.simulacao?.entrada)) },
          { label: "FGTS", value: formatMoney(firstNumber(resumo.fgts)) },
          { label: "Subsídio", value: formatMoney(firstNumber(resumo.subsidio)) },
          { label: "Cheque moradia", value: formatMoney(firstNumber(resumo.cheque_moradia)) },
          { label: "Parcela pré-obra 7LM", value: formatMoney(parcelaPre) },
          { label: "Parcela pós-obra 7LM", value: formatMoney(parcelaPos) },
          { label: "Comprometimento", value: formatPercent(firstNumber(resumo.percentual_comprometimento, item?.simulacao?.percentual_comprometimento)) },
          { label: "Retenção Creditú", value: formatMoney(firstNumber(resumo.creditur_retencao, imovel.creditur_retencao)) },
          { label: "Repasse líquido 7LM", value: formatMoney(firstNumber(resumo.creditur_valor_repassado_7lm)) },
        ])}
      </section>

      <section class="tl-aprovacoes-block">
        <div class="tl-aprovacoes-section-head">
          <h3>Gatilhos e gaps</h3>
          <span>${escapeHtml(gatilhos.length ? `${gatilhos.length} gatilho(s)` : "Sem gatilhos")}</span>
        </div>
        ${renderTagList(gatilhos, "Sem gatilhos pendentes")}
        <div class="tl-aprovacoes-metrics">
          ${renderMetric("Garantido planejado", formatMoney(item.valor_garantido_planejado))}
          ${renderMetric("Garantido real", formatMoney(item.valor_garantido_real))}
          ${renderMetric("Gap do garantido", formatMoney(item.gap_garantia), formatPercent(item.percentual_gap_garantia))}
          ${renderMetric("Pré-obra planejado", formatMoney(item.valor_garantido_pre_obra_planejado))}
          ${renderMetric("Pré-obra real", formatMoney(item.valor_garantido_pre_obra_real))}
          ${renderMetric("Gap do pré-obra", formatMoney(item.gap_pre_obra), formatPercent(item.percentual_gap_pre_obra))}
        </div>
      </section>

      <section class="tl-aprovacoes-block">
        <div class="tl-aprovacoes-section-head">
          <h3>Imóvel e fluxo</h3>
          <span>${escapeHtml(firstFilled(imovel.status, "Status não informado"))}</span>
        </div>
        ${renderInfoGrid([
          { label: "Empreendimento", value: firstFilled(imovel.empreendimento, imovel.titulo_original, "Não informado") },
          { label: "Cidade", value: firstFilled(imovel.cidade, "Não informada") },
          { label: "Bairro", value: firstFilled(imovel.bairro, "Não informado") },
          { label: "Unidade", value: firstFilled(imovel.detalhes_comerciais?.unidade, imovel.titulo, "Não informada") },
          { label: "Bloco", value: firstFilled(imovel.detalhes_comerciais?.bloco, "Não informado") },
          { label: "Meses até entrega", value: String(Number(resumo.meses_pre_entrega || imovel.meses_pre_entrega || 0)) },
          { label: "Meses pós-entrega", value: String(Number(resumo.meses_pos_entrega || imovel.meses_pos_entrega || 0)) },
          { label: "Status da simulação", value: firstFilled(resumo.status_simulacao, item?.simulacao?.status_simulacao, "Não informado") },
        ])}
      </section>

      <section class="tl-aprovacoes-block">
        <h3>Contexto da solicitação</h3>
        <ul class="tl-aprovacoes-lista-simples">
          <li><strong>Solicitante:</strong> ${escapeHtml(firstFilled(solicitante.nome_completo, solicitante.email, "Não informado"))}</li>
          <li><strong>Enviada em:</strong> ${escapeHtml(formatDateTime(item.solicitado_em))}</li>
          <li><strong>Status atual da unidade:</strong> ${escapeHtml(firstFilled(imovel.status, "Não informado"))}</li>
          <li><strong>Status da reserva:</strong> ${escapeHtml(firstFilled(item.reserva_status, "Não informado"))}</li>
          <li><strong>Gatilhos pendentes:</strong> ${escapeHtml(gatilhos.length ? gatilhos.map(triggerLabel).join(", ") : "Sem gatilhos pendentes")}</li>
          <li><strong>Bloqueios técnicos:</strong> ${escapeHtml(bloqueios.length ? bloqueios.join(" | ") : "Nenhum bloqueio adicional registrado")}</li>
          <li><strong>Bloqueios da simulação:</strong> ${escapeHtml(bloqueiosSimulacao.length ? bloqueiosSimulacao.join(" | ") : "Nenhum bloqueio adicional registrado")}</li>
          <li><strong>Avaliado por:</strong> ${escapeHtml(firstFilled(avaliador.nome_completo, avaliador.email, "Ainda não avaliado"))}</li>
          <li><strong>Observações da decisão:</strong> ${escapeHtml(firstFilled(item.observacoes_avaliacao, "Sem parecer até o momento."))}</li>
        </ul>
      </section>

      ${allowDecision ? `
        <section class="tl-aprovacoes-block">
          <h3>Decisão do gestor</h3>
          <div class="tl-aprovacoes-decision">
            <textarea id="campoObservacoesDecisao" placeholder="Registrar o motivo da decisão para histórico interno."></textarea>
            <div class="tl-aprovacoes-decision__actions">
              <button class="tl-aprovacoes-btn tl-aprovacoes-btn--approve" type="button" data-action="aprovar">Aprovar operação</button>
              <button class="tl-aprovacoes-btn tl-aprovacoes-btn--reject" type="button" data-action="reprovar">Reprovar operação</button>
            </div>
          </div>
        </section>` : ""}
    `;

    if (allowDecision) {
      el.detalheAprovacao.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", async () => {
          const action = button.getAttribute("data-action");
          const textarea = document.getElementById("campoObservacoesDecisao");
          const observacoes = textarea?.value?.trim() || "";
          await decidir(item.id, action, observacoes);
        });
      });
    }
  }

  async function decidir(id, acao, observacoes) {
    const confirmacao = window.confirm(
      acao === "aprovar"
        ? "Confirmar a aprovação desta operação excepcional?"
        : "Confirmar a reprovação desta operação excepcional?"
    );
    if (!confirmacao) return;

    setFeedback("", "Registrando decisão...");
    await api(endpoint(ENDPOINT_DECISAO, { id }), "POST", {
      acao,
      observacoes: observacoes || null,
    });
    setFeedback("success", acao === "aprovar" ? "Solicitação aprovada com sucesso." : "Solicitação reprovada com sucesso.");
    await loadItems({ keepSelection: true });
  }

  function bindThemeToggle() {
    if (!el.btnTema) return;
    el.btnTema.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      portalState?.persistTheme?.(next);
    });
  }

  function bindEvents() {
    bindThemeToggle();

    el.filtros.forEach((button) => {
      button.addEventListener("click", async () => {
        el.filtros.forEach((item) => item.classList.toggle("is-active", item === button));
        state.filtro = button.dataset.filter || "PENDENTE";
        try {
          await loadItems({ keepSelection: false });
        } catch (error) {
          setFeedback("error", error?.message || "Não foi possível carregar este filtro.");
        }
      });
    });

    el.inputBusca?.addEventListener("input", async (event) => {
      state.busca = normalizeSearch(event.target.value);
      renderList();
      try {
        await loadDetail(state.selecionadoId);
      } catch (error) {
        setFeedback("error", error?.message || "Não foi possível atualizar o detalhe.");
      }
    });

    el.btnAtualizar?.addEventListener("click", async () => {
      try {
        await loadItems({ keepSelection: true });
      } catch (error) {
        setFeedback("error", error?.message || "Não foi possível atualizar a fila.");
      }
    });
  }

  async function init() {
    collectElements();
    bindEvents();
    await loadCurrentUser();
    await loadItems({ keepSelection: false });
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => {
      setFeedback("error", error?.message || "Não foi possível carregar a fila de aprovações.");
    });
  }, { once: true });
})();
