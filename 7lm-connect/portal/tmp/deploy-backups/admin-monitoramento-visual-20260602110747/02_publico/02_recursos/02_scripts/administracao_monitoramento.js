(function () {
  "use strict";

  const ACCESS_TOKEN_KEYS = ["sevenlm_connect_token_de_acesso", "sevenlm_connect_token_de_acesso"];
  const POLL_INTERVAL_MS = 15000;

  const state = {
    activeTab: "acessos",
    timer: null,
    loading: false,
    lastPayload: null
  };

  const el = {};

  function $(id) {
    return document.getElementById(id);
  }

  function meta(name, fallback) {
    const item = document.querySelector(`meta[name="${name}"]`);
    return item && item.getAttribute("content") ? item.getAttribute("content") : fallback;
  }

  function getAccessToken() {
    for (const key of ACCESS_TOKEN_KEYS) {
      try {
        const value = window.sessionStorage.getItem(key);
        if (value) return value;
      } catch {}
    }
    return "";
  }

  function ensureLeadingSlash(value) {
    const text = String(value || "");
    return text.startsWith("/") ? text : `/${text}`;
  }

  function endpointUrl() {
    const endpoint = meta("sevenlm-connect-endpoint-admin-monitoramento", "/api/admin/monitoramento-portal");
    const url = new URL(ensureLeadingSlash(endpoint), window.location.origin);
    const janela = Number(el.janela?.value || 30) || 30;
    url.searchParams.set("janela_minutos", String(janela));
    url.searchParams.set("limite", "80");
    return url.toString();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function number(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(number(value));
  }

  function formatMoney(value) {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed)) return "R$ 0";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0
    }).format(parsed);
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function timeAgo(value) {
    if (!value) return "sem atividade registrada";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "sem atividade registrada";
    const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (diffSeconds < 60) return "agora";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} min atrás`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} h atrás`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} d atrás`;
  }

  function compactPath(path) {
    const value = String(path || "").trim();
    if (!value) return "sem rota registrada";
    return value.length > 74 ? `${value.slice(0, 71)}...` : value;
  }

  function setText(target, value) {
    if (target) target.textContent = value;
  }

  function renderEmpty(target, title, text) {
    if (!target) return;
    target.innerHTML = `
      <div class="tl-monitor-empty">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(text)}</span>
      </div>
    `;
  }

  function renderError(message) {
    const text = message || "Não foi possível consultar o monitoramento agora.";
    [el.pessoas, el.simulacoes, el.atividades].forEach((target) => {
      if (!target) return;
      target.innerHTML = `
        <div class="tl-monitor-error">
          <strong>Monitoramento indisponível</strong>
          <span>${escapeHtml(text)}</span>
        </div>
      `;
    });
  }

  function describeUser(item) {
    return (
      item.nome_completo ||
      item.correio_eletronico ||
      item.matricula ||
      item.identificador_usuario ||
      "Usuário sem identificação"
    );
  }

  function renderMetrics(payload) {
    const metrics = payload?.metricas || {};
    setText(el.usuariosLogados, formatNumber(metrics.usuarios_logados));
    setText(el.sessoesAtivas, `${formatNumber(metrics.sessoes_ativas)} sessões ativas`);
    setText(el.usuariosSimulando, formatNumber(metrics.usuarios_simulando));
    setText(el.simulacoesJanela, `${formatNumber(metrics.simulacoes_janela)} simulações na janela`);
    setText(el.reservasJanela, formatNumber(metrics.reservas_janela));
    setText(el.reservasAtivas, `${formatNumber(metrics.reservas_ativas)} reservas ativas`);
    setText(el.entradasJanela, formatNumber(metrics.entradas_janela));
    setText(el.sessoesEncerradas, `${formatNumber(metrics.sessoes_encerradas_janela)} encerradas`);
  }

  function renderPessoas(payload) {
    const items = Array.isArray(payload?.pessoas_ativas) ? payload.pessoas_ativas : [];
    setText(el.totalPessoas, `${items.length} ativos`);

    if (!items.length) {
      renderEmpty(el.pessoas, "Nenhum usuário ativo", "Não há sessões ativas nesta janela de acompanhamento.");
      return;
    }

    el.pessoas.innerHTML = items.map((item) => {
      const nome = describeUser(item);
      const meta = [item.correio_eletronico, item.matricula ? `Matrícula ${item.matricula}` : ""].filter(Boolean).join(" • ");
      const ultimaAtividade = item.data_hora_ultima_atividade || item.data_hora_entrada;
      const route = compactPath(item.ultimo_caminho);
      return `
        <section class="tl-monitor-person">
          <div class="tl-monitor-person__main">
            <div class="tl-monitor-person__name">${escapeHtml(nome)}</div>
            <div class="tl-monitor-person__meta">${escapeHtml(meta || "Sem e-mail/matrícula no cadastro")} • ${escapeHtml(timeAgo(ultimaAtividade))}</div>
            <div class="tl-monitor-person__route">
              Última rota: <strong>${escapeHtml(route)}</strong>
            </div>
          </div>
          <div class="tl-monitor-person__stats">
            <div class="tl-monitor-stat">
              <strong>${formatNumber(item.simulacoes_janela)}</strong>
              <span>simulações</span>
            </div>
            <div class="tl-monitor-stat">
              <strong>${formatNumber(item.reservas_janela)}</strong>
              <span>reservas</span>
            </div>
          </div>
        </section>
      `;
    }).join("");
  }

  function renderSimulacoes(payload) {
    const simulations = Array.isArray(payload?.simulacoes_recentes) ? payload.simulacoes_recentes : [];
    const reservations = Array.isArray(payload?.reservas_recentes) ? payload.reservas_recentes : [];
    const items = [
      ...simulations.map((item) => ({ ...item, monitor_tipo: "simulacao" })),
      ...reservations.map((item) => ({ ...item, monitor_tipo: "reserva" }))
    ].sort((a, b) => {
      const aDate = new Date(a.data_hora_atualizado_em || a.reservado_em || a.data_hora_criacao || 0).getTime();
      const bDate = new Date(b.data_hora_atualizado_em || b.reservado_em || b.data_hora_criacao || 0).getTime();
      return bDate - aDate;
    }).slice(0, 24);

    if (!items.length) {
      renderEmpty(el.simulacoes, "Nenhuma simulação recente", "A aba vai preencher quando houver simulação ou reserva na janela selecionada.");
      return;
    }

    el.simulacoes.innerHTML = items.map((item) => {
      const isReserva = item.monitor_tipo === "reserva";
      const title = isReserva
        ? `Reserva ${item.status || ""}`.trim()
        : item.status_simulacao || "Simulação";
      const usuario = item.usuario_nome || item.usuario_email || "Usuário não identificado";
      const cliente = item.cliente_nome || "Cliente não informado";
      const imovel = item.imovel_titulo || item.empreendimento || "Imóvel não informado";
      const when = item.data_hora_atualizado_em || item.reservado_em || item.data_hora_criacao;
      const value = isReserva ? formatDateTime(item.expiracao_em) : formatMoney(item.valor_total_operacao);
      const valueLabel = isReserva ? `Expira ${value}` : value;

      return `
        <section class="tl-monitor-row">
          <div class="tl-monitor-row__line">
            <div class="tl-monitor-row__title">${escapeHtml(title)}</div>
            <div class="tl-monitor-row__value">${escapeHtml(valueLabel)}</div>
          </div>
          <div class="tl-monitor-row__meta">
            ${escapeHtml(usuario)} • ${escapeHtml(cliente)} • ${escapeHtml(imovel)} • ${escapeHtml(timeAgo(when))}
          </div>
        </section>
      `;
    }).join("");
  }

  function renderAtividades(payload) {
    const items = Array.isArray(payload?.atividades_recentes) ? payload.atividades_recentes : [];

    if (!items.length) {
      renderEmpty(el.atividades, "Sem movimentação recente", "Nenhuma requisição ou evento de auditoria foi registrado na janela selecionada.");
      return;
    }

    el.atividades.innerHTML = items.slice(0, 40).map((item) => {
      const usuario = item.usuario_nome || item.usuario_email || "Sistema";
      const titulo = item.origem === "http"
        ? `${item.tipo || "GET"} ${compactPath(item.titulo)}`
        : String(item.titulo || item.tipo || "Evento").replace(/_/g, " ");
      const descricao = item.descricao || "";
      return `
        <section class="tl-monitor-event">
          <span class="tl-monitor-event__kind">${escapeHtml(item.origem || "evento")}</span>
          <div class="tl-monitor-event__title">${escapeHtml(titulo)}</div>
          <div class="tl-monitor-event__meta">${escapeHtml(usuario)} • ${escapeHtml(timeAgo(item.data_hora_evento))}</div>
          ${descricao ? `<div class="tl-monitor-event__meta">${escapeHtml(descricao)}</div>` : ""}
        </section>
      `;
    }).join("");
  }

  function renderPayload(payload) {
    state.lastPayload = payload;
    renderMetrics(payload);
    renderPessoas(payload);
    renderSimulacoes(payload);
    renderAtividades(payload);

    const generatedAt = payload?.gerado_em || new Date().toISOString();
    setText(
      el.status,
      `Atualizado ${timeAgo(generatedAt)} • janela de ${payload?.janela_minutos || el.janela?.value || 30} min • polling a cada 15s`
    );
  }

  async function loadMonitoramento() {
    if (state.loading) return;
    state.loading = true;
    setText(el.status, "Atualizando monitoramento...");

    const token = getAccessToken();
    if (!token) {
      state.loading = false;
      renderError("Sessão local sem token. Faça login novamente para consultar o monitoramento.");
      setText(el.status, "Sem token de sessão para consultar.");
      return;
    }

    try {
      const response = await fetch(endpointUrl(), {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = payload?.detail || payload?.mensagem || `HTTP ${response.status}`;
        throw new Error(detail);
      }

      renderPayload(payload);
    } catch (error) {
      console.warn("[ADMIN MONITORAMENTO] falha ao consultar:", error);
      renderError(error?.message || "Falha ao consultar a API.");
      setText(el.status, `Falha na atualização: ${error?.message || "erro desconhecido"}`);
    } finally {
      state.loading = false;
    }
  }

  function stopPolling() {
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
  }

  function startPolling() {
    stopPolling();
    state.timer = window.setInterval(() => {
      if (state.activeTab === "monitoramento" && !document.hidden) {
        loadMonitoramento();
      }
    }, POLL_INTERVAL_MS);
  }

  function setActiveTab(tab) {
    state.activeTab = tab === "monitoramento" ? "monitoramento" : "acessos";

    document.querySelectorAll("[data-admin-tab]").forEach((button) => {
      const selected = button.getAttribute("data-admin-tab") === state.activeTab;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });

    document.querySelectorAll("[data-admin-tab-panel]").forEach((panel) => {
      const selected = panel.getAttribute("data-admin-tab-panel") === state.activeTab;
      panel.hidden = !selected;
      panel.setAttribute("aria-hidden", selected ? "false" : "true");
    });

    if (state.activeTab === "monitoramento") {
      loadMonitoramento();
      startPolling();
    } else {
      stopPolling();
    }
  }

  function bindTabs() {
    document.querySelectorAll("[data-admin-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        setActiveTab(button.getAttribute("data-admin-tab") || "acessos");
      });
    });
  }

  function bindControls() {
    if (el.refresh) {
      el.refresh.addEventListener("click", loadMonitoramento);
    }

    if (el.janela) {
      el.janela.addEventListener("change", loadMonitoramento);
    }

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && state.activeTab === "monitoramento") {
        loadMonitoramento();
        startPolling();
      }
      if (document.hidden) {
        stopPolling();
      }
    });
  }

  function cacheElements() {
    el.janela = $("monitorJanelaMinutos");
    el.refresh = $("btnAtualizarMonitoramento");
    el.status = $("monitorStatusAtualizacao");
    el.usuariosLogados = $("monitorUsuariosLogados");
    el.sessoesAtivas = $("monitorSessoesAtivas");
    el.usuariosSimulando = $("monitorUsuariosSimulando");
    el.simulacoesJanela = $("monitorSimulacoesJanela");
    el.reservasJanela = $("monitorReservasJanela");
    el.reservasAtivas = $("monitorReservasAtivas");
    el.entradasJanela = $("monitorEntradasJanela");
    el.sessoesEncerradas = $("monitorSessoesEncerradas");
    el.totalPessoas = $("monitorTotalPessoas");
    el.pessoas = $("monitorPessoasAtivas");
    el.simulacoes = $("monitorSimulacoesRecentes");
    el.atividades = $("monitorAtividadesRecentes");
  }

  function boot() {
    if (!$("painelAdminMonitoramento")) return;
    cacheElements();
    bindTabs();
    bindControls();

    renderEmpty(el.pessoas, "Monitoramento em espera", "Abra esta aba para consultar os usuários ativos.");
    renderEmpty(el.simulacoes, "Monitoramento em espera", "Simulações e reservas recentes aparecerão aqui.");
    renderEmpty(el.atividades, "Monitoramento em espera", "As atividades recentes aparecerão aqui.");

    const requestedTab = String(new URLSearchParams(window.location.search).get("aba") || window.location.hash.replace("#", "") || "").toLowerCase();
    if (requestedTab === "monitoramento") {
      setActiveTab("monitoramento");
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
