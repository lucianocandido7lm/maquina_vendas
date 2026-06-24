(function () {
  "use strict";

  const ACCESS_TOKEN_KEYS = ["sevenlm_connect_token_de_acesso", "sevenlm_connect_token_de_acesso"];
  const POLL_INTERVAL_MS = 15000;

  const state = {
    activeTab: "acessos",
    monitorView: "geral",
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

  function plural(value, singular, pluralText) {
    return number(value) === 1 ? singular : pluralText;
  }

  function initials(value) {
    const parts = String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    const text = parts.map((part) => part.charAt(0)).join("").toUpperCase();
    return text || "7L";
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

  function maxValue(items, key) {
    return Math.max(1, ...items.map((item) => number(item?.[key])));
  }

  function percent(value, total) {
    const base = Math.max(1, number(total));
    return Math.max(0, Math.min(100, Math.round((number(value) / base) * 100)));
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
    [
      el.pessoas,
      el.pessoasDetalhe,
      el.simulacoes,
      el.atividades,
      el.modulosAtivos,
      el.statusHttp,
      el.atividadePeríodos,
      el.rotasMaisAcessadas,
      el.sessoesSemMovimento,
      el.funilSimulacoes,
      el.funilReservas,
      el.imoveisMovimentados
    ].forEach((target) => {
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
    setText(el.sessoesAtivas, `${formatNumber(metrics.sessoes_ativas)} sessões com movimento`);
    setText(el.usuariosSimulando, formatNumber(metrics.usuarios_simulando));
    setText(el.simulacoesJanela, `${formatNumber(metrics.simulacoes_janela)} simulações na janela`);
    setText(el.reservasJanela, formatNumber(metrics.reservas_janela));
    setText(el.reservasAtivas, `${formatNumber(metrics.reservas_ativas)} reservas ativas`);
    setText(el.entradasJanela, formatNumber(metrics.entradas_janela));
    setText(el.sessoesEncerradas, `${formatNumber(metrics.sessoes_encerradas_janela)} encerradas`);

    const online = number(metrics.usuarios_logados);
    const sessoesRecentes = number(metrics.sessoes_ativas);
    const sessoesAbertas = number(metrics.sessoes_abertas);
    const sessoesOciosas = Math.max(0, sessoesAbertas - sessoesRecentes);
    const janela = number(payload?.janela_minutos || el.janela?.value || 30);
    const pulseBase = Math.max(1, sessoesAbertas);
    const pulse = Math.max(0, Math.min(100, Math.round((sessoesRecentes / pulseBase) * 100)));

    setText(el.onlineDestaque, formatNumber(online));
    setText(el.sessoesAbertas, formatNumber(sessoesAbertas));
    setText(el.sessoesOciosas, formatNumber(sessoesOciosas));

    if (el.pulseRing) {
      el.pulseRing.style.setProperty("--monitor-pulse", `${pulse}%`);
    }

    setText(
      el.resumoOperacao,
      online > 0
        ? `${formatNumber(online)} ${plural(online, "pessoa online", "pessoas online")} agora`
        : "Sem pessoas online agora"
    );
    setText(
      el.resumoJanela,
      `Conta como online somente quem teve atividade nos últimos ${formatNumber(janela)} min. Sessões abertas sem movimento ficam separadas.`
    );
  }

  function renderPessoaCard(item, options = {}) {
    const nome = describeUser(item);
    const sessoesUsuario = number(item.sessoes_usuario_janela || item.sessoes_usuario);
    const meta = [
      item.correio_eletronico,
      item.matricula ? `Matrícula ${item.matricula}` : "",
      sessoesUsuario > 1 ? `${formatNumber(sessoesUsuario)} sessões ${options.ocioso ? "abertas" : "recentes"}` : ""
    ].filter(Boolean).join(" • ");
    const ultimaAtividade = item.data_hora_ultima_atividade || item.data_hora_entrada;
    const route = compactPath(item.ultimo_caminho);
    const avatarClass = options.ocioso ? "tl-monitor-avatar tl-monitor-avatar--idle" : "tl-monitor-avatar";

    return `
      <section class="tl-monitor-person">
        <div class="tl-monitor-person__identity">
          <div class="${avatarClass}">${escapeHtml(initials(nome))}</div>
          <div class="tl-monitor-person__main">
            <div class="tl-monitor-person__name">${escapeHtml(nome)}</div>
            <div class="tl-monitor-person__meta">${escapeHtml(meta || "Sem e-mail/matrícula no cadastro")} • ${escapeHtml(timeAgo(ultimaAtividade))}</div>
            <div class="tl-monitor-person__route">
              Última rota: <strong>${escapeHtml(route)}</strong>
            </div>
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
  }

  function renderPessoas(payload) {
    const items = Array.isArray(payload?.pessoas_ativas) ? payload.pessoas_ativas : [];
    const emptyHtml = `
      <div class="tl-monitor-empty">
        <strong>Nenhum usuário Online agora</strong>
        <span>Não houve atividade de usuários dentro da janela selecionada.</span>
      </div>
    `;

    setText(el.totalPessoas, `${items.length} online`);
    setText(el.totalPessoasDetalhe, `${items.length} online`);

    const html = items.length ? items.map((item) => renderPessoaCard(item)).join("") : emptyHtml;
    if (el.pessoas) el.pessoas.innerHTML = html;
    if (el.pessoasDetalhe) el.pessoasDetalhe.innerHTML = html;
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

  function renderBars(target, items, options) {
    if (!target) return;
    const data = Array.isArray(items) ? items : [];
    if (!data.length) {
      renderEmpty(target, options.emptyTitle, options.emptyText);
      return;
    }

    const max = maxValue(data, options.valueKey);
    target.innerHTML = data.map((item) => {
      const label = item[options.labelKey] || "Sem identificação";
      const value = number(item[options.valueKey]);
      const width = percent(value, max);
      const metaText = typeof options.meta === "function" ? options.meta(item) : "";
      return `
        <section class="tl-monitor-bar" style="--monitor-bar:${width}%">
          <div class="tl-monitor-bar__line">
            <strong>${escapeHtml(label)}</strong>
            <span>${formatNumber(value)}</span>
          </div>
          <div class="tl-monitor-bar__track"><i></i></div>
          ${metaText ? `<small>${escapeHtml(metaText)}</small>` : ""}
        </section>
      `;
    }).join("");
  }

  function renderOperacao(payload) {
    renderBars(el.modulosAtivos, payload?.modulos_ativos, {
      labelKey: "modulo",
      valueKey: "acessos",
      emptyTitle: "Sem uso de módulos",
      emptyText: "Nenhum módulo recebeu atividade na janela selecionada.",
      meta: (item) => `${formatNumber(item.usuarios)} usuários • média ${formatNumber(item.duracao_media_ms)}ms • ${timeAgo(item.ultima_atividade)}`
    });

    const statuses = Array.isArray(payload?.status_http) ? payload.status_http : [];
    if (el.statusHttp) {
      if (!statuses.length) {
        renderEmpty(el.statusHttp, "Sem respostas HTTP", "Nenhuma requisição foi registrada na janela selecionada.");
      } else {
        el.statusHttp.innerHTML = statuses.map((item) => `
          <section class="tl-monitor-http-status tl-monitor-http-status--${escapeHtml(String(item.faixa_status || "").replace(/[^a-z0-9]/gi, "").toLowerCase())}">
            <span>${escapeHtml(item.faixa_status || "sem status")}</span>
            <strong>${formatNumber(item.total)}</strong>
            <small>${formatNumber(item.duracao_media_ms)}ms média</small>
          </section>
        `).join("");
      }
    }

    const periods = Array.isArray(payload?.atividade_por_periodo) ? payload.atividade_por_periodo : [];
    if (el.atividadePeríodos) {
      if (!periods.length) {
        renderEmpty(el.atividadePeríodos, "Sem atividade por período", "O gráfico aparece quando houver movimentação na janela.");
      } else {
        const maxEventos = maxValue(periods, "eventos");
        el.atividadePeríodos.innerHTML = periods.map((item) => {
          const height = Math.max(8, percent(item.eventos, maxEventos));
          return `
            <div class="tl-monitor-chart__bar" title="${escapeHtml(item.rotulo)} • ${formatNumber(item.eventos)} eventos" style="--monitor-chart:${height}%">
              <i></i>
              <span>${escapeHtml(item.rotulo || "")}</span>
            </div>
          `;
        }).join("");
      }
    }

    const routes = Array.isArray(payload?.rotas_mais_acessadas) ? payload.rotas_mais_acessadas : [];
    if (el.rotasMaisAcessadas) {
      if (!routes.length) {
        renderEmpty(el.rotasMaisAcessadas, "Sem rotas recentes", "Nenhuma rota foi chamada na janela selecionada.");
      } else {
        el.rotasMaisAcessadas.innerHTML = routes.map((item) => `
          <section class="tl-monitor-route">
            <div>
              <span>${escapeHtml(item.metodo_http || "GET")}</span>
              <strong>${escapeHtml(compactPath(item.caminho_http))}</strong>
            </div>
            <small>${formatNumber(item.acessos)} acessos • ${formatNumber(item.usuarios)} usuários • ${formatNumber(item.duracao_media_ms)}ms média • ${escapeHtml(timeAgo(item.ultima_atividade))}</small>
          </section>
        `).join("");
      }
    }
  }

  function renderSessoesSemMovimento(payload) {
    const items = Array.isArray(payload?.sessoes_sem_movimento) ? payload.sessoes_sem_movimento : [];
    setText(el.totalOciosos, `${items.length} ${plural(items.length, "pessoa", "pessoas")}`);

    if (!el.sessoesSemMovimento) return;
    if (!items.length) {
      renderEmpty(el.sessoesSemMovimento, "Sem sessões ociosas", "Toda sessão aberta teve atividade dentro da janela selecionada.");
      return;
    }

    el.sessoesSemMovimento.innerHTML = items.map((item) => renderPessoaCard(item, { ocioso: true })).join("");
  }

  function renderComercial(payload) {
    renderBars(el.funilSimulacoes, payload?.funil_simulacoes, {
      labelKey: "status",
      valueKey: "total",
      emptyTitle: "Sem simulações na janela",
      emptyText: "O funil aparece quando houver simulações recentes.",
      meta: (item) => `${formatNumber(item.usuarios)} usuários • ${timeAgo(item.ultima_movimentacao)}`
    });

    renderBars(el.funilReservas, payload?.funil_reservas, {
      labelKey: "status",
      valueKey: "total",
      emptyTitle: "Sem reservas na janela",
      emptyText: "A visão aparece quando houver reservas recentes.",
      meta: (item) => `${formatNumber(item.usuarios)} usuários • ${timeAgo(item.ultima_movimentacao)}`
    });

    const items = Array.isArray(payload?.imoveis_movimentados) ? payload.imoveis_movimentados : [];
    if (!el.imoveisMovimentados) return;
    if (!items.length) {
      renderEmpty(el.imoveisMovimentados, "Sem imóveis movimentados", "Nenhum imóvel teve simulação ou reserva na janela selecionada.");
      return;
    }

    el.imoveisMovimentados.innerHTML = items.map((item) => `
      <section class="tl-monitor-row">
        <div class="tl-monitor-row__line">
          <div class="tl-monitor-row__title">${escapeHtml(item.imovel || "Imóvel não informado")}</div>
          <div class="tl-monitor-row__value">${formatNumber(item.movimentos)} mov.</div>
        </div>
        <div class="tl-monitor-row__meta">
          ${formatNumber(item.usuarios)} usuários • última movimentação ${escapeHtml(timeAgo(item.ultima_movimentacao))}
        </div>
      </section>
    `).join("");
  }

  function renderPayload(payload) {
    state.lastPayload = payload;
    renderMetrics(payload);
    renderPessoas(payload);
    renderSimulacoes(payload);
    renderAtividades(payload);
    renderOperacao(payload);
    renderSessoesSemMovimento(payload);
    renderComercial(payload);

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
    const allowed = new Set(["acessos", "monitoramento", "perfis"]);
    state.activeTab = allowed.has(tab) ? tab : "acessos";

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

  function setMonitorView(view) {
    const allowed = new Set(["geral", "operacao", "pessoas", "comercial"]);
    state.monitorView = allowed.has(view) ? view : "geral";

    document.querySelectorAll("[data-monitor-view]").forEach((button) => {
      const selected = button.getAttribute("data-monitor-view") === state.monitorView;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });

    document.querySelectorAll("[data-monitor-view-panel]").forEach((panel) => {
      const selected = panel.getAttribute("data-monitor-view-panel") === state.monitorView;
      panel.hidden = !selected;
      panel.classList.toggle("is-active", selected);
      panel.setAttribute("aria-hidden", selected ? "false" : "true");
    });
  }

  function bindTabs() {
    document.querySelectorAll("[data-admin-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        setActiveTab(button.getAttribute("data-admin-tab") || "acessos");
      });
    });

    document.querySelectorAll("[data-monitor-view]").forEach((button) => {
      button.addEventListener("click", () => {
        setMonitorView(button.getAttribute("data-monitor-view") || "geral");
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
    el.pulseRing = $("monitorPulseRing");
    el.onlineDestaque = $("monitorOnlineDestaque");
    el.resumoOperacao = $("monitorResumoOperacao");
    el.resumoJanela = $("monitorResumoJanela");
    el.sessoesAbertas = $("monitorSessoesAbertas");
    el.sessoesOciosas = $("monitorSessoesOciosas");
    el.usuariosLogados = $("monitorUsuariosLogados");
    el.sessoesAtivas = $("monitorSessoesAtivas");
    el.usuariosSimulando = $("monitorUsuariosSimulando");
    el.simulacoesJanela = $("monitorSimulacoesJanela");
    el.reservasJanela = $("monitorReservasJanela");
    el.reservasAtivas = $("monitorReservasAtivas");
    el.entradasJanela = $("monitorEntradasJanela");
    el.sessoesEncerradas = $("monitorSessoesEncerradas");
    el.totalPessoas = $("monitorTotalPessoas");
    el.totalPessoasDetalhe = $("monitorTotalPessoasPessoas");
    el.totalOciosos = $("monitorTotalOciosos");
    el.pessoas = $("monitorPessoasAtivas");
    el.pessoasDetalhe = $("monitorPessoasAtivasDetalhe");
    el.sessoesSemMovimento = $("monitorSessoesSemMovimento");
    el.simulacoes = $("monitorSimulacoesRecentes");
    el.atividades = $("monitorAtividadesRecentes");
    el.modulosAtivos = $("monitorModulosAtivos");
    el.statusHttp = $("monitorStatusHttp");
    el.atividadePeríodos = $("monitorAtividadePeríodos");
    el.rotasMaisAcessadas = $("monitorRotasMaisAcessadas");
    el.funilSimulacoes = $("monitorFunilSimulacoes");
    el.funilReservas = $("monitorFunilReservas");
    el.imoveisMovimentados = $("monitorImoveisMovimentados");
  }

  function boot() {
    if (!$("painelAdminMonitoramento")) return;
    cacheElements();
    bindTabs();
    bindControls();

    renderEmpty(el.pessoas, "Monitoramento em espera", "Abra esta aba para consultar as pessoas online agora.");
    renderEmpty(el.pessoasDetalhe, "Monitoramento em espera", "Abra esta aba para consultar as pessoas online agora.");
    renderEmpty(el.sessoesSemMovimento, "Monitoramento em espera", "Sessões sem movimento aparecerão aqui.");
    renderEmpty(el.simulacoes, "Monitoramento em espera", "Simulações e reservas recentes aparecerão aqui.");
    renderEmpty(el.atividades, "Monitoramento em espera", "As atividades recentes aparecerão aqui.");
    renderEmpty(el.modulosAtivos, "Monitoramento em espera", "Os módulos mais usados aparecerão aqui.");
    renderEmpty(el.statusHttp, "Monitoramento em espera", "A saúde HTTP aparecerá aqui.");
    renderEmpty(el.atividadePeríodos, "Monitoramento em espera", "O ritmo de atividade aparecerá aqui.");
    renderEmpty(el.rotasMaisAcessadas, "Monitoramento em espera", "As rotas mais acessadas aparecerão aqui.");
    renderEmpty(el.funilSimulacoes, "Monitoramento em espera", "O funil de simulações aparecerá aqui.");
    renderEmpty(el.funilReservas, "Monitoramento em espera", "O funil de reservas aparecerá aqui.");
    renderEmpty(el.imoveisMovimentados, "Monitoramento em espera", "Os imóveis movimentados aparecerão aqui.");

    const searchParams = new URLSearchParams(window.location.search);
    const requestedTab = String(searchParams.get("aba") || window.location.hash.replace("#", "") || "").toLowerCase();
    setMonitorView(String(searchParams.get("visao") || "geral").toLowerCase());
    if (requestedTab === "monitoramento" || requestedTab === "perfis") {
      setActiveTab(requestedTab);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
