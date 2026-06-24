(function () {
  "use strict";

  const ENDPOINT = "/api/connect-comercial/dashboard-maquina-vendas";
  const TOKEN_KEYS = ["sevenlm_connect_token_de_acesso"];

  const state = {
    periodo: "mes",
    inicio: "",
    fim: "",
    corretor: "",
    loading: false,
  };

  const el = {
    scope: document.querySelector("[data-dashboard-scope]"),
    state: document.querySelector("[data-dashboard-state]"),
    form: document.querySelector("[data-dashboard-filters]"),
    periodo: document.querySelector("[data-filter-periodo]"),
    inicio: document.querySelector("[data-filter-inicio]"),
    fim: document.querySelector("[data-filter-fim]"),
    corretorWrap: document.querySelector("[data-corretor-filter]"),
    corretor: document.querySelector("[data-filter-corretor]"),
    chart: document.querySelector("[data-chart-series]"),
    totalOperacoes: document.querySelector("[data-total-operacoes]"),
    statusList: document.querySelector("[data-status-list]"),
    rankingList: document.querySelector("[data-ranking-list]"),
    empreendimentosList: document.querySelector("[data-empreendimentos-list]"),
    recentesList: document.querySelector("[data-recentes-list]"),
  };

  function token() {
    try {
      for (const key of TOKEN_KEYS) {
        const value = window.sessionStorage ? window.sessionStorage.getItem(key) : "";
        if (value) return value;
      }
    } catch (_) {
      return "";
    }
    return "";
  }

  function today() {
    const now = new Date();
    return toIsoDate(now);
  }

  function toIsoDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function setPreset(periodo) {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    if (periodo === "mes") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (periodo === "7dias") {
      start.setDate(now.getDate() - 6);
    } else if (periodo === "30dias") {
      start.setDate(now.getDate() - 29);
    } else if (periodo === "ano") {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    } else {
      start = new Date(now);
      end = new Date(now);
    }

    state.periodo = periodo;
    state.inicio = toIsoDate(start);
    state.fim = toIsoDate(end);
    el.inicio.value = state.inicio;
    el.fim.value = state.fim;
  }

  function formatMoney(value) {
    const number = Number(value || 0);
    return number.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });
  }

  function formatInt(value) {
    return Math.round(Number(value || 0)).toLocaleString("pt-BR");
  }

  function formatPercent(value) {
    return `${Number(value || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
  }

  function formatDate(value) {
    if (!value) return "-";
    const text = String(value).slice(0, 10);
    const parts = text.split("-");
    if (parts.length !== 3) return text;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function statusLabel(value) {
    const normalized = String(value || "").toUpperCase();
    const labels = {
      ATIVA: "Reserva ativa",
      PENDENTE_APROVACAO: "Pendente aprovação",
      CONVERTIDA: "Venda",
      LIBERADA: "Liberada",
    };
    return labels[normalized] || value || "Sem status";
  }

  function statusClass(value) {
    const normalized = String(value || "").toUpperCase();
    if (normalized === "CONVERTIDA") return "tl-mv-chip--green";
    if (normalized === "PENDENTE_APROVACAO") return "tl-mv-chip--amber";
    if (normalized === "LIBERADA") return "tl-mv-chip--red";
    return "";
  }

  function modalidadeLabel(value) {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "creditur_geral") return "Creditú Geral";
    if (normalized === "creditur") return "Creditú CAT";
    if (normalized === "7lm") return "7LM";
    if (normalized === "sem_modalidade") return "Sem modalidade";
    return value || "Sem modalidade";
  }

  function setMessage(message, type) {
    if (!el.state) return;
    if (!message) {
      el.state.hidden = true;
      el.state.textContent = "";
      return;
    }
    el.state.hidden = false;
    el.state.textContent = message;
    el.state.dataset.type = type || "info";
  }

  function setKpi(name, value, formatter) {
    const target = document.querySelector(`[data-kpi="${name}"]`);
    if (target) target.textContent = formatter ? formatter(value) : formatInt(value);
  }

  function setSub(name, value, formatter, suffix) {
    const target = document.querySelector(`[data-kpi-sub="${name}"]`);
    if (target) {
      const formatted = formatter ? formatter(value) : formatInt(value);
      target.textContent = suffix ? `${formatted} ${suffix}` : formatted;
    }
  }

  function renderKpis(kpis) {
    setKpi("reservas_ativas", kpis.reservas_ativas);
    setSub("pendentes_aprovacao", kpis.pendentes_aprovacao, formatInt, "pendentes");
    setKpi("vendas", kpis.vendas);
    setSub("taxa_conversao", kpis.taxa_conversao, formatPercent, "de conversão");
    setKpi("ticket_medio", kpis.ticket_medio, formatMoney);
    setSub("valor_negociado_total", kpis.valor_negociado_total, formatMoney, "negociado");
    setKpi("incentivo_medio", kpis.incentivo_medio, formatMoney);
    setSub("incentivo_total", kpis.incentivo_total, formatMoney, "total");
    setKpi("imoveis_movimentados", kpis.imoveis_movimentados);
    setSub("corretores_ativos", kpis.corretores_ativos, formatInt, "corretores");
    setKpi("simulacoes_total_simulacoes", kpis.simulacoes_total_simulacoes);
    setSub("simulacoes_simulacoes_ideais", kpis.simulacoes_simulacoes_ideais, formatInt, "ideais");
    if (el.totalOperacoes) {
      el.totalOperacoes.textContent = `${formatInt(kpis.total_operacoes)} operações`;
    }
  }

  function renderSeries(series) {
    if (!el.chart) return;
    if (!Array.isArray(series) || !series.length) {
      el.chart.innerHTML = '<div class="tl-mv-empty">Sem movimentações no período selecionado.</div>';
      return;
    }
    const max = Math.max(...series.map((item) => Number(item.operacoes || 0)), 1);
    el.chart.innerHTML = series
      .map((item) => {
        const operations = Number(item.operacoes || 0);
        const sales = Number(item.vendas || 0);
        const width = Math.max(operations / max * 100, 2);
        const salesWidth = Math.min(Math.max(sales / max * 100, sales ? 2 : 0), width);
        return `
          <div class="tl-mv-chart-row">
            <span class="tl-mv-chart-date">${escapeHtml(formatDate(item.data))}</span>
            <span class="tl-mv-bar-track" aria-hidden="true">
              <span class="tl-mv-bar-fill" style="width:${width.toFixed(2)}%"></span>
              <span class="tl-mv-bar-fill tl-mv-bar-fill--sales" style="width:${salesWidth.toFixed(2)}%"></span>
            </span>
            <span class="tl-mv-chart-value">${formatInt(operations)} / ${formatInt(sales)} vendas</span>
          </div>
        `;
      })
      .join("");
  }

  function renderStatus(items) {
    if (!el.statusList) return;
    if (!Array.isArray(items) || !items.length) {
      el.statusList.innerHTML = '<div class="tl-mv-empty">Nenhum status no período.</div>';
      return;
    }
    el.statusList.innerHTML = items
      .map((item) => `
        <div class="tl-mv-status-item">
          <div>
            <strong>${escapeHtml(statusLabel(item.label))}</strong>
            <span>${formatMoney(item.valor || 0)}</span>
          </div>
          <b class="tl-mv-status-value">${formatInt(item.quantidade)}</b>
        </div>
      `)
      .join("");
  }

  function renderRanking(items) {
    if (!el.rankingList) return;
    if (!Array.isArray(items) || !items.length) {
      el.rankingList.innerHTML = '<tr><td colspan="4">Sem corretores no período.</td></tr>';
      return;
    }
    el.rankingList.innerHTML = items
      .map((item) => `
        <tr>
          <td data-label="Corretor">${escapeHtml(item.corretor_nome || "Sem corretor")}</td>
          <td data-label="Reservas">${formatInt(item.reservas_ativas)} <span>+ ${formatInt(item.pendentes_aprovacao)} pend.</span></td>
          <td data-label="Vendas">${formatInt(item.vendas)}</td>
          <td data-label="Ticket">${formatMoney(item.ticket_medio)}</td>
        </tr>
      `)
      .join("");
  }

  function renderEmpreendimentos(items) {
    if (!el.empreendimentosList) return;
    if (!Array.isArray(items) || !items.length) {
      el.empreendimentosList.innerHTML = '<div class="tl-mv-empty">Sem empreendimentos no período.</div>';
      return;
    }
    el.empreendimentosList.innerHTML = items
      .map((item) => `
        <div class="tl-mv-list-item">
          <div>
            <strong>${escapeHtml(item.label || "Sem empreendimento")}</strong>
            <span>${formatInt(item.operacoes)} operações · ${formatInt(item.vendas)} vendas</span>
          </div>
          <b>${formatMoney(item.valor_negociado)}</b>
        </div>
      `)
      .join("");
  }

  function renderRecentes(items) {
    if (!el.recentesList) return;
    if (!Array.isArray(items) || !items.length) {
      el.recentesList.innerHTML = '<div class="tl-mv-empty">Nenhuma movimentação recente no período.</div>';
      return;
    }
    el.recentesList.innerHTML = items
      .map((item) => `
        <div class="tl-mv-recent-item">
          <div class="tl-mv-recent-title">
            <strong>${escapeHtml(item.imovel_titulo || "Imóvel")}</strong>
            <span>${escapeHtml(item.cliente_nome || "Cliente não informado")} · ${escapeHtml(item.corretor_nome || "Sem corretor")} · ${formatDate(item.data_operacao)}</span>
            <span>${escapeHtml(modalidadeLabel(item.modalidade))} · ${formatMoney(item.valor_negociado)} · incentivo ${formatMoney(item.incentivo_7lm)}</span>
          </div>
          <span class="tl-mv-chip ${statusClass(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
        </div>
      `)
      .join("");
  }

  function renderCorretores(payload) {
    if (!el.corretor || !el.corretorWrap) return;
    const canFilter = Boolean(payload.meta && payload.meta.escopo && payload.meta.escopo.pode_filtrar_corretor);
    el.corretorWrap.hidden = !canFilter;
    if (!canFilter) return;

    const current = state.corretor;
    const options = Array.isArray(payload.corretores) ? payload.corretores : [];
    el.corretor.innerHTML = [
      '<option value="">Todos</option>',
      ...options.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`),
    ].join("");
    el.corretor.value = current;
  }

  function render(payload) {
    const meta = payload.meta || {};
    const escopo = meta.escopo || {};
    const periodo = meta.periodo || {};
    if (el.scope) {
      el.scope.textContent = `${escopo.rotulo || "Meus dados"} · ${formatDate(periodo.inicio)} a ${formatDate(periodo.fim)}`;
    }

    renderCorretores(payload);
    renderKpis(payload.kpis || {});
    renderSeries(payload.series || []);
    renderStatus(payload.status || []);
    renderRanking(payload.ranking || []);
    renderEmpreendimentos(payload.empreendimentos || []);
    renderRecentes(payload.recentes || []);
  }

  async function loadDashboard() {
    if (state.loading) return;
    state.loading = true;
    setMessage("Atualizando dashboard...", "loading");

    const params = new URLSearchParams({
      startDate: state.inicio,
      endDate: state.fim,
    });
    if (state.corretor) params.set("corretor", state.corretor);

    const headers = new Headers();
    const accessToken = token();
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

    try {
      const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
        headers,
        credentials: "same-origin",
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || "Não foi possível carregar o dashboard.");
      }
      const payload = await response.json();
      render(payload);
      setMessage("", "ok");
    } catch (error) {
      setMessage(error.message || "Falha ao carregar o dashboard.", "error");
    } finally {
      state.loading = false;
    }
  }

  function bindEvents() {
    if (el.periodo) {
      el.periodo.addEventListener("change", () => {
        const value = el.periodo.value || "mes";
        if (value !== "manual") {
          setPreset(value);
          loadDashboard();
        } else {
          state.periodo = "manual";
        }
      });
    }

    if (el.inicio) {
      el.inicio.addEventListener("change", () => {
        state.inicio = el.inicio.value || today();
        state.periodo = "manual";
        el.periodo.value = "manual";
      });
    }

    if (el.fim) {
      el.fim.addEventListener("change", () => {
        state.fim = el.fim.value || today();
        state.periodo = "manual";
        el.periodo.value = "manual";
      });
    }

    if (el.corretor) {
      el.corretor.addEventListener("change", () => {
        state.corretor = el.corretor.value || "";
        loadDashboard();
      });
    }

    if (el.form) {
      el.form.addEventListener("submit", (event) => {
        event.preventDefault();
        state.inicio = el.inicio.value || today();
        state.fim = el.fim.value || state.inicio;
        state.corretor = el.corretor ? el.corretor.value || "" : "";
        loadDashboard();
      });
    }
  }

  function init() {
    if (!document.querySelector("[data-dashboard-root]")) return;
    setPreset("mes");
    if (el.periodo) el.periodo.value = "mes";
    bindEvents();
    loadDashboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
