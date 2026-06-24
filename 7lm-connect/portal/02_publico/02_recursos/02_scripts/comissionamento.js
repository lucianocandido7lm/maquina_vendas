const API_PREVIEW_URL = '/api/comissionamento/ciclos/2026-05/preview';
const API_SIMULATE_URL = '/api/comissionamento/ciclos/2026-05/simular';
const API_RULES_URL = '/api/comissionamento/regras?vigencia=2026-05';
const API_SAVE_RULE_URL = '/api/comissionamento/regras';
const TOKEN_KEYS = ['sevenlm_connect_token_de_acesso'];
const DRAFT_KEY = 'sevenlm_comissionamento_regras_rascunho_2026_05';
const HISTORY_KEY = 'sevenlm_comissionamento_regras_historico_2026_05';

const fallbackSeed = [
  { funcao: 'COORD. VENDAS', cidade: 'AGL', nome: 'ROBSON', bruto: 3400, distrato: 0 },
  { funcao: 'GER VENDAS', cidade: 'AGL', nome: 'FRANCISCO', bruto: 1250, distrato: 0 },
  { funcao: 'GER VENDAS', cidade: 'AGL', nome: 'JOSUE', bruto: 1000, distrato: 0 },
  { funcao: 'GER VENDAS', cidade: 'AGL', nome: 'ANA CLEIA', bruto: 2850, distrato: 0 },
  { funcao: 'COORD VENDAS FSA', cidade: 'FSA', nome: 'THOMAZ', bruto: 4500, distrato: 0 },
  { funcao: 'COORD VENDAS CANAL', cidade: 'FSA', nome: 'JORDAN', bruto: 9300, distrato: 0 },
  { funcao: 'GER VENDAS', cidade: 'FSA', nome: 'RAFAEL', bruto: 4400, distrato: 0 },
  { funcao: 'GER II VENDAS', cidade: 'FSA', nome: 'ALANA', bruto: 2750, distrato: 0 },
  { funcao: 'GER VENDAS', cidade: 'FSA', nome: 'DAIANA', bruto: 4250, distrato: 0 },
  { funcao: 'COORD GERAL', cidade: 'FSA', nome: 'TAVEIRA', bruto: 7300, distrato: 0 },
  { funcao: 'COORD. CANAL', cidade: 'AGL/FSA', nome: 'GEISI', bruto: 8500, distrato: 0 },
  { funcao: 'COORD. REPASSE', cidade: 'AGL/FSA', nome: 'BRUNO', bruto: 10600, distrato: 0 },
  { funcao: 'GER. IA', cidade: 'AGL/FSA', nome: 'LUIZ', bruto: 5342, distrato: 0 },
];

let state = {
  rows: [],
  ciclo: {
    ciclo_id: '2026-05',
    rotulo: 'Maio/2026',
    origem: 'excel_seed_local',
    status: 'calculado_seed',
    prazo_envio_financeiro: '2026-06-15',
    prazo_nf_dias: 2,
  },
  resumo: {},
  indicadores: ['vendas', 'repasses', 'ipc', 'sobrepreco_medio'],
  regras: [],
  selectedId: 'seed-1',
  secretariaMode: 'kanban',
  rulePersonId: 'seed-1',
};

const statusLabel = {
  calculado_seed: 'Calculado seed',
  calculado: 'Calculado',
  pendente_secretaria: 'Pendente Secretaria',
  aprovado_secretaria: 'Aprovado Secretaria',
  pendente_marcelo: 'Pendente Head',
  aprovado_marcelo: 'Aprovado Head',
  pendente_nf: 'NF pendente',
  nf_recebida: 'NF recebida',
  bloqueado_nf: 'NF pendente',
  pronto_financeiro: 'Pronto Financeiro',
  enviado_financeiro: 'Enviado Financeiro',
  nao_enviado: 'Não enviado',
  nao_pago: 'Não pago',
  pago: 'Pago',
  solicitar_nf: 'Solicitar NF',
  enviar_pacote_pagamento: 'Enviar para pagamento',
  aprovar_secretaria: 'Aprovar Secretaria',
  aprovar_marcelo: 'Aprovar Head',
  aguardar_pagamento: 'Aguardar pagamento',
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

const formatNumber = (value) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(value) || 0);

function makeIdempotencyKey() {
  return window.crypto?.randomUUID?.() || `comissionamento-${Date.now()}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function readToken() {
  try {
    for (const key of TOKEN_KEYS) {
      const token = window.sessionStorage?.getItem(key);
      if (token) return token;
    }
  } catch {}
  return '';
}

async function apiRequest(url, options = {}) {
  const token = readToken();
  if (!token) {
    throw new Error('Sem token do portal; usando seed local de desenvolvimento.');
  }
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}

function buildFallbackPayload() {
  const registros = fallbackSeed.map((item, index) => {
    const id = `seed-${index + 1}`;
    const nfRecebida = index % 4 === 0;
    const percentual = 82 + ((index * 7) % 58);
    const faixa = percentual >= 120 ? '120% a 129,99%' : percentual >= 95 ? '95% a 104,99%' : '80% a 94,99%';
    const ips = [
      {
        ip_id: `${id}-ip-1`,
        nome: 'IPC mínimo 1,20',
        indicador: 'ipc',
        operador: '>=',
        alvo: 1.2,
        realizado: 1.05 + ((index % 5) * 0.07),
        atingiu: index % 3 !== 0,
        valor_bonus: index % 3 !== 0 ? 450 : 0,
        periodo_corte: '2026-05',
      },
      {
        ip_id: `${id}-ip-2`,
        nome: 'Sobrepreço médio acima de R$ 3.500',
        indicador: 'sobrepreco_medio',
        operador: '>=',
        alvo: 3500,
        realizado: 3200 + ((index % 6) * 450),
        atingiu: index % 2 === 0,
        valor_bonus: index % 2 === 0 ? 550 : 0,
        periodo_corte: '2026-05',
      },
    ];
    return {
      id,
      funcao: item.funcao,
      cidade: item.cidade,
      nome: item.nome,
      tipo_comissionado: 'PJ_AUTONOMO',
      valor_bruto: item.bruto,
      desconto_distrato: item.distrato,
      valor_liquido: item.bruto - item.distrato,
      status: nfRecebida ? 'pronto_financeiro' : 'aprovado_marcelo',
      status_nf: nfRecebida ? 'nf_recebida' : 'pendente_nf',
      exige_nf: true,
      origem: 'excel_seed_local',
      comissionado: { id, nome: item.nome, tipo: 'PJ_AUTONOMO', funcao: item.funcao, cidade: item.cidade },
      valores: { bruto: item.bruto, distratos: item.distrato, bonus_ips: ips.reduce((sum, ip) => sum + ip.valor_bonus, 0), liquido: item.bruto - item.distrato },
      regra_01: [{
        meta_id: `${id}-r01-vendas`,
        nome: 'Vendas do ciclo',
        indicador: 'vendas',
        objetivo: 10,
        realizado: Number((10 * percentual / 100).toFixed(2)),
        peso: 1,
        percentual_atingimento: percentual,
        faixa_aplicada: faixa,
        valor_faixa: item.bruto,
        valor_calculado: item.bruto,
        proxima_faixa: percentual < 120 ? { rotulo: '120% a 129,99%', faltam_percentuais: Number((120 - percentual).toFixed(2)) } : null,
        faixas: [],
        fonte_realizado: 'seed_local',
      }],
      regra_02_ips: ips,
      fluxo: {
        status_aprovacao: nfRecebida ? 'pronto_financeiro' : 'aprovado_marcelo',
        status_nf: nfRecebida ? 'nf_recebida' : 'pendente_nf',
        status_financeiro: nfRecebida ? 'pronto_financeiro' : 'nao_enviado',
        status_pagamento: 'nao_pago',
        bloqueios: nfRecebida ? [] : ['nf_obrigatoria_pendente'],
        proxima_acao: nfRecebida ? 'enviar_pacote_pagamento' : 'solicitar_nf',
      },
      bloqueios: nfRecebida ? [] : ['nf_obrigatoria_pendente'],
      proxima_acao: nfRecebida ? 'enviar_pacote_pagamento' : 'solicitar_nf',
    };
  });
  const bruto = registros.reduce((sum, item) => sum + item.valores.bruto, 0);
  return {
    ciclo: state.ciclo,
    resumo: {
      quantidade_comissionados: registros.length,
      valor_bruto_total: bruto,
      desconto_distrato_total: 0,
      valor_liquido_total: bruto,
      pendentes_nf: registros.filter((item) => item.status_nf === 'pendente_nf').length,
      prontos_financeiro: registros.filter((item) => item.status === 'pronto_financeiro').length,
      etapa_nf: registros.filter((item) => item.status_nf === 'pendente_nf').length,
      pendentes_marcelo: 0,
      pagos: 0,
    },
    indicadores: ['leads', 'visitas', 'propostas_aprovadas', 'propostas_total', 'vendas', 'repasses', 'cancelamentos', 'distratos', 'ipc', 'sobrepreco_medio'],
    regras: [],
    registros,
  };
}

function normalizeRow(item) {
  const values = item.valores || {};
  const person = item.comissionado || {};
  const fluxo = item.fluxo || {};
  return {
    id: item.id,
    nome: person.nome || item.nome,
    funcao: person.funcao || item.funcao,
    cidade: person.cidade || item.cidade,
    tipo: person.tipo || item.tipo_comissionado || 'PJ_AUTONOMO',
    bruto: Number(values.bruto ?? item.valor_bruto) || 0,
    distrato: Number(values.distratos ?? item.desconto_distrato) || 0,
    bonusIps: Number(values.bonus_ips) || 0,
    liquido: Number(values.liquido ?? item.valor_liquido) || 0,
    status: fluxo.status_aprovacao || item.status || 'calculado_seed',
    nf: fluxo.status_nf || item.status_nf || 'pendente_nf',
    financeiro: fluxo.status_financeiro || 'nao_enviado',
    pagamento: fluxo.status_pagamento || 'nao_pago',
    bloqueios: Array.isArray(item.bloqueios) ? item.bloqueios : (fluxo.bloqueios || []),
    proximaAcao: item.proxima_acao || fluxo.proxima_acao || 'aprovar_secretaria',
    regra01: Array.isArray(item.regra_01) ? item.regra_01 : [],
    ips: Array.isArray(item.regra_02_ips) ? item.regra_02_ips : [],
    timeline: Array.isArray(item.timeline) ? item.timeline : [],
  };
}

function normalizePayload(payload) {
  state.rows = (payload?.registros || []).map(normalizeRow);
  state.ciclo = payload?.ciclo || state.ciclo;
  state.resumo = payload?.resumo || {};
  state.indicadores = payload?.indicadores?.length ? payload.indicadores : state.indicadores;
  state.regras = payload?.regras || [];
  state.selectedId = state.rows[0]?.id || state.selectedId;
}

function getSelectedRow() {
  return state.rows.find((item) => item.id === state.selectedId) || state.rows[0];
}

function getVisibleRows() {
  const query = document.querySelector('#searchInput')?.value.trim().toLowerCase() ?? '';
  const status = document.querySelector('#statusFilter')?.value ?? 'todos';
  const city = document.querySelector('#cityFilter')?.value ?? 'todos';
  const role = document.querySelector('#roleFilter')?.value ?? 'todos';

  return state.rows.filter((item) => {
    const text = [item.nome, item.funcao, item.cidade].join(' ').toLowerCase();
    const statusMatch =
      status === 'todos'
      || item.status === status
      || item.nf === status
      || item.financeiro === status;
    return text.includes(query)
      && statusMatch
      && (city === 'todos' || item.cidade === city)
      && (role === 'todos' || item.funcao === role);
  });
}

function renderSummary() {
  const resumo = state.resumo;
  document.querySelector('#totalBruto').textContent = formatCurrency(resumo.valor_bruto_total ?? state.rows.reduce((sum, item) => sum + item.bruto, 0));
  document.querySelector('#totalLiquido').textContent = formatCurrency(resumo.valor_liquido_total ?? state.rows.reduce((sum, item) => sum + item.liquido, 0));
  document.querySelector('#totalPessoas').textContent = String(resumo.quantidade_comissionados ?? state.rows.length);
  document.querySelector('#totalNf').textContent = String(resumo.pendentes_nf ?? state.rows.filter((item) => item.nf === 'pendente_nf').length);
  document.querySelector('#totalEtapaNf').textContent = String(resumo.etapa_nf ?? resumo.pendentes_nf ?? state.rows.filter((item) => item.nf === 'pendente_nf').length);
  document.querySelector('#totalProntos').textContent = String(resumo.prontos_financeiro ?? state.rows.filter((item) => item.financeiro === 'pronto_financeiro').length);
  document.querySelector('#totalMarcelo').textContent = String(resumo.pendentes_marcelo ?? state.rows.filter((item) => item.status === 'pendente_marcelo').length);
  document.querySelector('#prazoFinanceiro').textContent = formatDate(state.ciclo.prazo_envio_financeiro);
}

function formatDate(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).split('-');
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function renderWorkflow() {
  const counts = {
    calculado: state.rows.length,
    secretaria: state.rows.filter((item) => item.status === 'pendente_secretaria' || item.status === 'calculado_seed').length,
    marcelo: state.rows.filter((item) => item.status === 'pendente_marcelo').length,
    nf: state.rows.filter((item) => item.nf === 'pendente_nf').length,
    financeiro: state.rows.filter((item) => item.financeiro === 'pronto_financeiro').length,
    pagamento: state.rows.filter((item) => item.pagamento === 'pago').length,
  };
  const steps = [
    ['Calculado', counts.calculado, 'done'],
    ['Secretaria', counts.secretaria, counts.secretaria ? 'active' : 'done'],
    ['Head Comercial', counts.marcelo, counts.marcelo ? 'active' : 'done'],
    ['NF', counts.nf, counts.nf ? 'active' : 'done'],
    ['Financeiro', counts.financeiro, counts.financeiro ? 'active' : 'waiting'],
    ['Pagamento', counts.pagamento, counts.pagamento ? 'done' : 'waiting'],
  ];
  document.querySelector('#workflowBand').innerHTML = steps.map(([label, count, stateName]) => `
    <div class="step ${stateName}">
      <span>${escapeHtml(label)}</span>
      <strong>${count}</strong>
    </div>
  `).join('');
}

function renderSourceBanner(message, type = 'info') {
  const banner = document.querySelector('#sourceBanner');
  if (!banner) return;
  banner.className = `tl-imoveis-feedback source-banner ${type}`;
  banner.textContent = message;
}

function renderFilters() {
  const fillSelect = (selector, values, label) => {
    const select = document.querySelector(selector);
    const current = select.value || 'todos';
    select.innerHTML = `<option value="todos">${label}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
    select.value = values.includes(current) ? current : 'todos';
  };
  fillSelect('#cityFilter', [...new Set(state.rows.map((item) => item.cidade))].sort(), 'Todas cidades');
  fillSelect('#roleFilter', [...new Set(state.rows.map((item) => item.funcao))].sort(), 'Todas funções');
}

function statusPill(value, extra = '') {
  return `<span class="status ${escapeHtml(value)} ${extra}">${escapeHtml(statusLabel[value] || value || '-')}</span>`;
}

function getSelectedRuleType() {
  return document.querySelector('#ruleEditorSelect')?.value || 'regra_01';
}

function getPublishRuleId() {
  return getSelectedRuleType() === 'regra_02' ? 'regra-02-ips-mvp' : 'regra-01-escada-mvp';
}

function getRulePersonRow() {
  const id = document.querySelector('#rulePersonSelect')?.value || state.rulePersonId || state.selectedId;
  return state.rows.find((item) => item.id === id) || getSelectedRow();
}

function getDraftStorageKey() {
  return `${DRAFT_KEY}_${getRulePersonRow()?.id || 'geral'}`;
}

function getDefaultBands(regra = {}) {
  const bands = Array.isArray(regra.faixas) && regra.faixas.length ? regra.faixas : [
    { rotulo: '0% a 39,99%', minimo: 0, maximo: 39.99, valor: 0 },
    { rotulo: '40% a 59,99%', minimo: 40, maximo: 59.99, valor: 0 },
    { rotulo: '60% a 79,99%', minimo: 60, maximo: 79.99, valor: 0 },
    { rotulo: '80% a 94,99%', minimo: 80, maximo: 94.99, valor: 0 },
    { rotulo: '95% a 104,99%', minimo: 95, maximo: 104.99, valor: regra.valor_calculado || 0 },
    { rotulo: '120%+', minimo: 120, maximo: 140, valor: regra.valor_calculado || 0 },
  ];
  return bands.slice(0, 8).map((band) => ({
    rotulo: band.rotulo || `${band.minimo || 0}%`,
    minimo: Number(band.minimo) || 0,
    maximo: band.maximo === null || band.maximo === undefined ? '' : Number(band.maximo),
    valor: Number(band.valor ?? band.valor_faixa ?? 0) || 0,
  }));
}

function getStage(item) {
  if (item.pagamento === 'pago') return 'pagamento';
  if (item.financeiro === 'pronto_financeiro' || item.financeiro === 'enviado_financeiro') return 'financeiro';
  if (item.nf === 'pendente_nf') return 'nf';
  if (item.status === 'pendente_marcelo' || item.status === 'aprovado_secretaria') return 'head';
  if (item.status === 'calculado_seed' || item.status === 'calculado' || item.status === 'pendente_secretaria') return 'secretaria';
  return 'head';
}

function getPersonalStage(item) {
  if (item.pagamento === 'pago') return 'pagamento';
  if (item.financeiro === 'pronto_financeiro' || item.financeiro === 'enviado_financeiro') return 'financeiro';
  if (item.nf === 'pendente_nf') return 'nf';
  if (item.status === 'aprovado_secretaria' || item.status === 'pendente_marcelo') return 'head';
  if (item.status === 'pendente_secretaria') return 'secretaria';
  return 'calculado';
}

function getPersonalStepClass(stepKey, currentStage) {
  const order = ['calculado', 'secretaria', 'head', 'nf', 'financeiro', 'pagamento'];
  const stepIndex = order.indexOf(stepKey);
  const currentIndex = order.indexOf(currentStage);
  if (stepKey === currentStage) return 'active';
  if (stepIndex >= 0 && currentIndex >= 0 && stepIndex < currentIndex) return 'done';
  return 'waiting';
}

const stageLabel = {
  calculado: 'Calculado',
  secretaria: 'Secretaria',
  head: 'Head Comercial',
  nf: 'Nota fiscal',
  financeiro: 'Financeiro',
  pagamento: 'Pagamento',
};

function renderKanban() {
  const columns = [
    ['secretaria', 'Secretaria'],
    ['head', 'Head Comercial'],
    ['nf', 'Nota fiscal'],
    ['financeiro', 'Financeiro'],
    ['pagamento', 'Pagamento'],
  ];

  document.querySelector('#secretariaKanban').innerHTML = columns.map(([stage, label]) => {
    const rows = state.rows.filter((item) => getStage(item) === stage);
    const total = rows.reduce((sum, item) => sum + item.liquido, 0);
    return `
      <article class="kanban-column">
        <header>
          <span>${escapeHtml(label)}</span>
          <strong>${rows.length}</strong>
        </header>
        <small>${formatCurrency(total)}</small>
        <div class="kanban-cards">
          ${rows.slice(0, 5).map((item) => `
            <button type="button" class="kanban-card ${item.id === state.selectedId ? 'active' : ''}" data-id="${escapeHtml(item.id)}">
              <strong>${escapeHtml(item.nome)}</strong>
              <span>${formatCurrency(item.liquido)} · ${escapeHtml(statusLabel[item.proximaAcao] || item.proximaAcao)}</span>
              <em>Abrir detalhe</em>
            </button>
          `).join('') || '<p>Nenhuma comissão nesta etapa.</p>'}
        </div>
      </article>
    `;
  }).join('');

  document.querySelectorAll('.kanban-card').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedId = button.dataset.id;
      renderKanban();
      renderTable();
      renderSelectedDetail();
    });
  });
}

function renderSecretaryMode() {
  const showKanban = state.secretariaMode === 'kanban';
  document.querySelector('#secretariaKanban')?.classList.toggle('hidden-mode', !showKanban);
  document.querySelector('#secretariaTableWrap')?.classList.toggle('hidden-mode', showKanban);
  document.querySelector('#secretariaModeKanban')?.classList.toggle('active', showKanban);
  document.querySelector('#secretariaModeTable')?.classList.toggle('active', !showKanban);
}

function renderTable() {
  const tbody = document.querySelector('#commissionRows');
  const rows = getVisibleRows();
  tbody.innerHTML = rows.map((item) => `
    <tr class="${item.id === state.selectedId ? 'selected' : ''}" data-id="${escapeHtml(item.id)}">
      <td><button type="button" class="row-link" data-id="${escapeHtml(item.id)}">${escapeHtml(item.nome)}<span>Abrir detalhe</span></button></td>
      <td>${escapeHtml(item.funcao)}</td>
      <td>${escapeHtml(item.cidade)}</td>
      <td>${formatCurrency(item.bruto)}</td>
      <td>${formatCurrency(item.distrato)}</td>
      <td><strong>${formatCurrency(item.liquido)}</strong></td>
      <td>${statusPill(item.status)}</td>
      <td>${statusPill(item.nf)}</td>
      <td>${statusPill(item.financeiro)}</td>
      <td>${statusPill(item.proximaAcao)}</td>
    </tr>
  `).join('');

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-row">Nenhum comissionado encontrado.</td></tr>';
  }

  tbody.querySelectorAll('.row-link').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedId = button.dataset.id;
      state.rulePersonId = button.dataset.id;
      renderKanban();
      renderTable();
      renderSelectedDetail();
      renderRuleControls();
    });
  });
}

function renderQueue() {
  const pendingNf = state.rows.filter((item) => item.nf === 'pendente_nf');
  const ready = state.rows.filter((item) => item.financeiro === 'pronto_financeiro');
  const head = state.rows.filter((item) => getStage(item) === 'head');

  document.querySelector('#queueList').innerHTML = `
    <div class="queue-item"><span>NF pendente</span><strong>${pendingNf.length}</strong></div>
    <div class="queue-item"><span>Com Head Comercial</span><strong>${head.length}</strong></div>
    <div class="queue-item"><span>Prontos para Financeiro</span><strong>${ready.length}</strong></div>
    <div class="queue-item"><span>Prazo de NF</span><strong>${state.ciclo.prazo_nf_dias || 2} dias</strong></div>
    <div class="mini-list">${pendingNf.slice(0, 8).map((item) => `<span>${escapeHtml(item.nome)}</span>`).join('')}</div>
  `;
}

function renderSelectedDetail() {
  const item = getSelectedRow();
  if (!item) return;
  const regra = item.regra01[0] || {};
  const atingidos = item.ips.filter((ip) => ip.atingiu).length;
  document.querySelector('#selectedDetail').innerHTML = `
    <h3>${escapeHtml(item.nome)}</h3>
    <p>${escapeHtml(item.funcao)} - ${escapeHtml(item.cidade)}</p>
    <div class="calc-list calc-list--compact">
      <div><span>Etapa atual</span><strong>${escapeHtml(stageLabel[getStage(item)] || '-')}</strong></div>
      <div><span>Regra 01</span><strong>${formatNumber(regra.percentual_atingimento)}% / ${escapeHtml(regra.faixa_aplicada || '-')}</strong></div>
      <div><span>IPs atingidos</span><strong>${atingidos}/${item.ips.length}</strong></div>
      <div><span>Próxima ação</span><strong>${escapeHtml(statusLabel[item.proximaAcao] || item.proximaAcao)}</strong></div>
    </div>
  `;
}

function renderApprovals() {
  const needsApproval = (item) =>
    item.status === 'pendente_marcelo'
    || item.status === 'aprovado_secretaria'
    || item.proximaAcao === 'aprovar_marcelo';
  const pendingRows = state.rows.filter(needsApproval);
  const approvedRows = state.rows.filter((item) => !needsApproval(item));

  const renderHeadCard = (item, canApprove) => {
    const regra = item.regra01[0] || {};
    const ipsAtingidos = item.ips.filter((ip) => ip.atingiu);
    return `
      <article class="head-card">
        <div class="head-card-main">
          <div>
            <strong>${escapeHtml(item.nome)}</strong>
            <span>${escapeHtml(item.funcao)} - ${escapeHtml(item.cidade)}</span>
          </div>
          <div class="head-card-value">
            <strong>${formatCurrency(item.liquido)}</strong>
            ${statusPill(item.status)}
          </div>
        </div>
        <details class="head-details">
          <summary>Detalhar comissão</summary>
          <div class="approval-detail-grid">
            <span>Bruto <strong>${formatCurrency(item.bruto)}</strong></span>
            <span>Distrato <strong>${formatCurrency(item.distrato)}</strong></span>
            <span>Bônus IPs <strong>${formatCurrency(item.bonusIps)}</strong></span>
            <span>Líquido <strong>${formatCurrency(item.liquido)}</strong></span>
          </div>
          <div class="approval-calc">
            <span>Regra 01: ${formatNumber(regra.percentual_atingimento)}% · ${escapeHtml(regra.faixa_aplicada || '-')} · objetivo ${formatNumber(regra.objetivo)} / realizado ${formatNumber(regra.realizado)}</span>
            <span>IPs: ${ipsAtingidos.length}/${item.ips.length} atingidos${ipsAtingidos.length ? ` · ${ipsAtingidos.map((ip) => escapeHtml(ip.nome)).join(', ')}` : ''}</span>
            <span>Etapa atual: ${escapeHtml(stageLabel[getStage(item)] || '-')} · Próximo passo: ${escapeHtml(statusLabel[item.proximaAcao] || item.proximaAcao)}</span>
          </div>
        </details>
        ${canApprove ? '<button class="tl-imoveis-btn head-approve" type="button" disabled title="Aprovação será liberada com endpoint auditável">Aprovar</button>' : ''}
      </article>
    `;
  };

  document.querySelector('#approvalList').innerHTML = `
    <section class="head-kanban">
      <article class="head-section">
        <header><h3>Faltam aprovar</h3><strong>${pendingRows.length}</strong></header>
        <small>${formatCurrency(pendingRows.reduce((sum, item) => sum + item.liquido, 0))}</small>
        <div class="head-list">
          ${pendingRows.map((item) => renderHeadCard(item, true)).join('') || '<p class="empty-row">Nenhuma comissão aguardando aprovação do Head.</p>'}
        </div>
      </article>
      <article class="head-section">
        <header><h3>Já aprovadas ou etapa seguinte</h3><strong>${approvedRows.length}</strong></header>
        <small>${formatCurrency(approvedRows.reduce((sum, item) => sum + item.liquido, 0))}</small>
        <div class="head-list head-list--compact">
          ${approvedRows.map((item) => renderHeadCard(item, false)).join('') || '<p class="empty-row">Nenhuma comissão aprovada ainda.</p>'}
        </div>
      </article>
    </section>
  `;
}

function renderPersonOptions() {
  const select = document.querySelector('#personSelect');
  const current = select.value || state.selectedId;
  select.innerHTML = state.rows.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.nome)}</option>`).join('');
  select.value = state.rows.some((item) => item.id === current) ? current : state.rows[0]?.id;
  state.selectedId = select.value || state.selectedId;
}

function renderLadder(regra) {
  const faixas = regra?.faixas?.length ? regra.faixas : [
    { rotulo: '80% a 94,99%', ativa: false },
    { rotulo: '95% a 104,99%', ativa: false },
    { rotulo: '105% a 119,99%', ativa: false },
    { rotulo: '120%+', ativa: true },
  ];
  return `
    <div class="ladder">
      ${faixas.map((faixa) => `<span class="${faixa.ativa ? 'active' : ''}">${escapeHtml(faixa.rotulo)}</span>`).join('')}
    </div>
  `;
}

function renderPersonDetail() {
  const item = getSelectedRow();
  if (!item) return;
  const regra = item.regra01[0] || {};
  const progress = Math.max(0, Math.min(Number(regra.percentual_atingimento) || 0, 140));
  const progressWidth = (progress / 140) * 100;
  const currentStage = getPersonalStage(item);
  const flowSteps = [
    ['calculado', 'Calculado'],
    ['secretaria', 'Secretaria'],
    ['head', 'Head Comercial'],
    ['nf', 'Nota fiscal'],
    ['financeiro', 'Financeiro'],
    ['pagamento', 'Pagamento'],
  ];
  const ipsHtml = item.ips.map((ip) => `
    <article class="ip-card ${ip.atingiu ? 'ok' : 'pending'}">
      <div>
        <strong>${escapeHtml(ip.nome)}</strong>
        <span>${escapeHtml(ip.indicador)} ${escapeHtml(ip.operador)} ${formatNumber(ip.alvo)}</span>
      </div>
      <div>
        <strong>${formatNumber(ip.realizado)}</strong>
        <span>${ip.atingiu ? 'Atingiu' : 'Não atingiu'} · ${formatCurrency(ip.valor_bonus)}</span>
      </div>
    </article>
  `).join('');

  document.querySelector('#personDetail').innerHTML = `
    <div class="person-hero">
      <div>
        <span>${escapeHtml(item.funcao)}</span>
        <h3>${escapeHtml(item.nome)}</h3>
        <p>${escapeHtml(item.cidade)} - ${escapeHtml(state.ciclo.rotulo || 'Maio/2026')}</p>
      </div>
      <strong>${formatCurrency(item.liquido)}</strong>
    </div>
    <div class="value-grid">
      <div><span>Bruto</span><strong>${formatCurrency(item.bruto)}</strong></div>
      <div><span>Distratos</span><strong>${formatCurrency(item.distrato)}</strong></div>
      <div><span>Bônus IPs</span><strong>${formatCurrency(item.bonusIps)}</strong></div>
      <div><span>NF</span><strong>${escapeHtml(statusLabel[item.nf] || item.nf)}</strong></div>
    </div>
    <section class="personal-status">
      <div class="section-heading">
        <h3>Onde está minha comissão</h3>
        <span>${escapeHtml(stageLabel[currentStage] || '-')}</span>
      </div>
      <div class="personal-flow">
        ${flowSteps.map(([key, label]) => `
          <div class="${getPersonalStepClass(key, currentStage)}">
            <strong>${escapeHtml(label)}</strong>
            <span>${key === currentStage ? escapeHtml(statusLabel[item.proximaAcao] || item.proximaAcao) : key === 'calculado' ? 'Cálculo gerado' : ''}</span>
          </div>
        `).join('')}
      </div>
      <div class="calc-list calc-list--compact">
        <div><span>Etapa atual</span><strong>${escapeHtml(stageLabel[currentStage] || '-')}</strong></div>
        <div><span>Próximo passo</span><strong>${escapeHtml(statusLabel[item.proximaAcao] || item.proximaAcao)}</strong></div>
        <div><span>Financeiro</span><strong>${escapeHtml(statusLabel[item.financeiro] || item.financeiro)}</strong></div>
        <div><span>Pagamento</span><strong>${escapeHtml(statusLabel[item.pagamento] || item.pagamento)}</strong></div>
      </div>
    </section>
    <section class="calculation-section">
      <div class="section-heading">
        <h3>Escada da Regra 01</h3>
        <span>${formatNumber(regra.percentual_atingimento)}% atingido</span>
      </div>
      <div class="progress-ladder">
        <div class="progress-ladder-track">
          <span style="width: ${progressWidth}%"></span>
        </div>
        <div class="progress-ladder-labels">
          <span>0%</span>
          <span>95%</span>
          <span>120%</span>
          <span>140%+</span>
        </div>
      </div>
      ${renderLadder(regra)}
      <div class="calc-list">
        <div><span>Indicador</span><strong>${escapeHtml(regra.indicador || '-')}</strong></div>
        <div><span>Objetivo x Realizado</span><strong>${formatNumber(regra.objetivo)} x ${formatNumber(regra.realizado)}</strong></div>
        <div><span>Faixa aplicada</span><strong>${escapeHtml(regra.faixa_aplicada || '-')}</strong></div>
        <div><span>Valor calculado</span><strong>${formatCurrency(regra.valor_calculado)}</strong></div>
        <div><span>Próxima faixa</span><strong>${regra.proxima_faixa ? `${escapeHtml(regra.proxima_faixa.rotulo)} (${formatNumber(regra.proxima_faixa.faltam_percentuais)} p.p.)` : 'Faixa máxima'}</strong></div>
      </div>
    </section>
    <section class="calculation-section">
      <div class="section-heading">
        <h3>IPs vinculados da Regra 02</h3>
        <span>${item.ips.filter((ip) => ip.atingiu).length}/${item.ips.length} atingidos</span>
      </div>
      <div class="ip-grid">${ipsHtml}</div>
    </section>
  `;
}

function renderRuleControls() {
  const options = state.indicadores.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
  const personSelect = document.querySelector('#rulePersonSelect');
  const currentPerson = state.rulePersonId || state.selectedId || state.rows[0]?.id;

  personSelect.innerHTML = state.rows.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.nome)} - ${escapeHtml(item.funcao)}</option>`).join('');
  personSelect.value = state.rows.some((item) => item.id === currentPerson) ? currentPerson : state.rows[0]?.id;
  state.rulePersonId = personSelect.value;

  document.querySelector('#rule01Indicator').innerHTML = options;
  document.querySelector('#rule02Indicator').innerHTML = options;
  populateRuleEditorFromPerson();
  renderRuleEditorMode();
}

function populateRuleEditorFromPerson() {
  const person = getRulePersonRow();
  if (!person) return;
  const regra = person.regra01?.[0] || {};
  const ipSelect = document.querySelector('#rule02IpSelect');
  const currentIp = ipSelect?.value;
  const ips = person.ips || [];
  ipSelect.innerHTML = ips.map((ip) => `<option value="${escapeHtml(ip.ip_id)}">${escapeHtml(ip.nome)}</option>`).join('');
  ipSelect.value = ips.some((ip) => ip.ip_id === currentIp) ? currentIp : ips[0]?.ip_id || '';
  const selectedIp = ips.find((ip) => ip.ip_id === ipSelect.value) || ips[0] || {};

  document.querySelector('#rule01Indicator').value = regra.indicador || 'vendas';
  document.querySelector('#rule01Goal').value = regra.objetivo ?? 10;
  document.querySelector('#rule01Weight').value = regra.peso ?? 1;
  document.querySelector('#rule02Name').value = selectedIp.nome || 'IPC mínimo';
  document.querySelector('#rule02Indicator').value = selectedIp.indicador || 'ipc';
  document.querySelector('#rule02CommissionType').value = selectedIp.tipo_comissao || 'numero';
  document.querySelector('#rule02Operator').value = selectedIp.operador || '>=';
  document.querySelector('#rule02Target').value = selectedIp.alvo ?? 1.2;
  document.querySelector('#rule02Bonus').value = selectedIp.valor_bonus || 0;
  document.querySelector('#rule02StartDate').value = selectedIp.data_inicial || '2026-05-01';
  document.querySelector('#rule02EndDate').value = selectedIp.data_fim || '2026-05-20';
  renderRule01Bands(getDefaultBands(regra));

  try {
    const draft = JSON.parse(window.localStorage.getItem(getDraftStorageKey()) || '{}');
    if (draft.rule01Indicator) document.querySelector('#rule01Indicator').value = draft.rule01Indicator;
    if (draft.rule01Goal) document.querySelector('#rule01Goal').value = draft.rule01Goal;
    if (draft.rule01Weight) document.querySelector('#rule01Weight').value = draft.rule01Weight;
    if (draft.rule02Name) document.querySelector('#rule02Name').value = draft.rule02Name;
    if (draft.rule02Indicator) document.querySelector('#rule02Indicator').value = draft.rule02Indicator;
    if (draft.rule02CommissionType) document.querySelector('#rule02CommissionType').value = draft.rule02CommissionType;
    if (draft.rule02Operator) document.querySelector('#rule02Operator').value = draft.rule02Operator;
    if (draft.rule02Target) document.querySelector('#rule02Target').value = draft.rule02Target;
    if (draft.rule02Bonus !== undefined) document.querySelector('#rule02Bonus').value = draft.rule02Bonus;
    if (draft.rule02StartDate) document.querySelector('#rule02StartDate').value = draft.rule02StartDate;
    if (draft.rule02EndDate) document.querySelector('#rule02EndDate').value = draft.rule02EndDate;
    if (Array.isArray(draft.rule01Bands)) renderRule01Bands(draft.rule01Bands);
  } catch {}

  renderRulesHistory();
  const feedback = document.querySelector('#rulesFeedback');
  if (feedback && !feedback.dataset.lockedMessage) {
    feedback.textContent = `Editando regras de ${person.nome}. Salve como rascunho antes de preparar publicação.`;
  }
}

function renderRule01Bands(bands) {
  document.querySelector('#rule01Bands').innerHTML = bands.map((band, index) => `
    <div class="band-row" data-band-index="${index}">
      <label>Nome
        <input data-band-field="rotulo" type="text" value="${escapeHtml(band.rotulo)}" />
      </label>
      <label>De %
        <input data-band-field="minimo" type="number" min="0" step="0.01" value="${escapeHtml(band.minimo)}" />
      </label>
      <label>Até %
        <input data-band-field="maximo" type="number" min="0" step="0.01" value="${escapeHtml(band.maximo)}" />
      </label>
      <label>Valor
        <input data-band-field="valor" type="number" min="0" step="50" value="${escapeHtml(band.valor)}" />
      </label>
    </div>
  `).join('') || '<p class="empty-row">Nenhuma faixa configurada.</p>';
}

function collectRule01Bands() {
  return [...document.querySelectorAll('#rule01Bands .band-row')].map((row) => {
    const getField = (field) => row.querySelector(`[data-band-field="${field}"]`)?.value;
    return {
      rotulo: getField('rotulo'),
      minimo: Number(getField('minimo')),
      maximo: getField('maximo') === '' ? null : Number(getField('maximo')),
      valor: Number(getField('valor')),
    };
  });
}

function readRulesHistory() {
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function appendRulesHistory(draft, action) {
  const history = readRulesHistory();
  history.unshift({
    action,
    comissionadoId: draft.comissionadoId,
    comissionadoNome: draft.comissionadoNome,
    regra: getSelectedRuleType(),
    ipId: draft.rule02IpId,
    when: new Date().toISOString(),
  });
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  renderRulesHistory();
}

function renderRulesHistory() {
  const person = getRulePersonRow();
  const history = readRulesHistory().filter((item) => item.comissionadoId === person?.id).slice(0, 6);
  document.querySelector('#rulesHistoryList').innerHTML = history.map((item) => `
    <div class="history-row">
      <strong>${escapeHtml(item.action)}</strong>
      <span>${escapeHtml(item.regra)} · ${new Date(item.when).toLocaleString('pt-BR')}</span>
    </div>
  `).join('') || '<p class="empty-row">Nenhuma alteração registrada para este comissionado.</p>';
}

function renderRuleEditorMode() {
  const selected = getSelectedRuleType();
  document.querySelectorAll('[data-rule-panel]').forEach((panel) => {
    panel.classList.toggle('hidden-mode', panel.dataset.rulePanel !== selected);
  });
}

function collectDraft() {
  const person = getRulePersonRow();
  return {
    comissionadoId: person?.id,
    comissionadoNome: person?.nome,
    rule01Indicator: document.querySelector('#rule01Indicator').value,
    rule01Goal: document.querySelector('#rule01Goal').value,
    rule01Weight: document.querySelector('#rule01Weight').value,
    rule01Bands: collectRule01Bands(),
    rule02Name: document.querySelector('#rule02Name').value,
    rule02Indicator: document.querySelector('#rule02Indicator').value,
    rule02CommissionType: document.querySelector('#rule02CommissionType').value,
    rule02Operator: document.querySelector('#rule02Operator').value,
    rule02Target: document.querySelector('#rule02Target').value,
    rule02Bonus: document.querySelector('#rule02Bonus').value,
    rule02IpId: document.querySelector('#rule02IpSelect').value,
    rule02StartDate: document.querySelector('#rule02StartDate').value,
    rule02EndDate: document.querySelector('#rule02EndDate').value,
    savedAt: new Date().toISOString(),
  };
}

function renderAll() {
  renderSummary();
  renderWorkflow();
  renderFilters();
  renderKanban();
  renderSecretaryMode();
  renderTable();
  renderQueue();
  renderSelectedDetail();
  renderApprovals();
  renderPersonOptions();
  renderPersonDetail();
  renderRuleControls();
}

function setActiveView(view) {
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === view);
  });
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.panel !== view);
  });
  document.querySelector('.summary-grid')?.classList.toggle('hidden-mode', view === 'comissionado');
  document.querySelector('#workflowBand')?.classList.toggle('hidden-mode', view === 'comissionado');
}

function wireEvents() {
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => setActiveView(button.dataset.view));
  });
  ['#searchInput', '#statusFilter', '#cityFilter', '#roleFilter'].forEach((selector) => {
    document.querySelector(selector)?.addEventListener('input', renderTable);
    document.querySelector(selector)?.addEventListener('change', renderTable);
  });
  document.querySelector('#secretariaModeKanban').addEventListener('click', () => {
    state.secretariaMode = 'kanban';
    renderSecretaryMode();
  });
  document.querySelector('#secretariaModeTable').addEventListener('click', () => {
    state.secretariaMode = 'table';
    renderSecretaryMode();
  });
  document.querySelector('#ruleEditorSelect').addEventListener('change', renderRuleEditorMode);
  document.querySelector('#rulePersonSelect').addEventListener('change', (event) => {
    state.rulePersonId = event.target.value;
    state.selectedId = event.target.value;
    delete document.querySelector('#rulesFeedback').dataset.lockedMessage;
    populateRuleEditorFromPerson();
    renderRuleEditorMode();
    renderKanban();
    renderTable();
    renderSelectedDetail();
  });
  document.querySelector('#rule02IpSelect').addEventListener('change', () => {
    delete document.querySelector('#rulesFeedback').dataset.lockedMessage;
    populateRuleEditorFromPerson();
  });
  document.querySelector('#personSelect').addEventListener('change', (event) => {
    state.selectedId = event.target.value;
    state.rulePersonId = event.target.value;
    renderPersonDetail();
    renderTable();
    renderSelectedDetail();
  });
  document.querySelector('#saveDraftButton').addEventListener('click', () => {
    const draft = collectDraft();
    window.localStorage.setItem(getDraftStorageKey(), JSON.stringify(draft));
    const feedback = document.querySelector('#rulesFeedback');
    feedback.dataset.lockedMessage = 'true';
    apiRequest(API_SAVE_RULE_URL, {
      method: 'POST',
      body: JSON.stringify({
        regra_01: {
          comissionado_id: draft.comissionadoId,
          indicador: draft.rule01Indicator,
          objetivo: Number(draft.rule01Goal),
          peso: Number(draft.rule01Weight),
          faixas: draft.rule01Bands,
        },
        regra_02: {
          comissionado_id: draft.comissionadoId,
          ip_id: draft.rule02IpId,
          nome: draft.rule02Name,
          indicador: draft.rule02Indicator,
          tipo_comissao: draft.rule02CommissionType,
          operador: draft.rule02Operator,
          alvo: Number(draft.rule02Target),
          valor_bonus: Number(draft.rule02Bonus),
          data_inicial: draft.rule02StartDate,
          data_fim: draft.rule02EndDate,
        },
        observacao: 'Rascunho salvo pela tela de Comissionamento',
        idempotency_key: makeIdempotencyKey(),
      }),
    }).then((payload) => {
      feedback.className = 'tl-imoveis-feedback source-banner success';
      feedback.textContent = payload.mensagem || `Rascunho de ${draft.comissionadoNome} validado pela API.`;
      appendRulesHistory(draft, 'Rascunho salvo');
    }).catch((error) => {
      feedback.className = 'tl-imoveis-feedback source-banner warning';
      feedback.textContent = `${error.message}. Rascunho de ${draft.comissionadoNome} salvo localmente no navegador.`;
      appendRulesHistory(draft, 'Rascunho local');
    });
  });
  document.querySelector('#simulateButton').addEventListener('click', async () => {
    try {
      const payload = await apiRequest(API_SIMULATE_URL, {
        method: 'POST',
        body: JSON.stringify({ observacao: 'Simulação solicitada pela tela de Comissionamento', idempotency_key: makeIdempotencyKey() }),
      });
      renderSourceBanner(payload.mensagem || 'Simulação concluída pela API.', 'success');
    } catch (error) {
      renderSourceBanner(`${error.message}. Simulação visual mantida sem gravar dados definitivos.`, 'warning');
    }
  });
  document.querySelector('#sendButton').addEventListener('click', () => {
    renderSourceBanner('Envio ao Financeiro ainda aguarda o endpoint auditável de envio e validação de NF.', 'warning');
  });
  document.querySelector('#publishRuleButton').addEventListener('click', async () => {
    const feedback = document.querySelector('#rulesFeedback');
    const draft = collectDraft();
    feedback.dataset.lockedMessage = 'true';
    try {
      const payload = await apiRequest(`/api/comissionamento/regras/${getPublishRuleId()}/publicar`, {
        method: 'POST',
        body: JSON.stringify({ motivo: `Preparação de publicação do rascunho de ${draft.comissionadoNome}`, observacao: JSON.stringify(draft), idempotency_key: makeIdempotencyKey() }),
      });
      feedback.className = 'tl-imoveis-feedback source-banner warning';
      feedback.textContent = payload.mensagem || 'Publicação preparada.';
      appendRulesHistory(draft, 'Publicação preparada');
    } catch (error) {
      feedback.className = 'tl-imoveis-feedback source-banner warning';
      feedback.textContent = `${error.message}. Rascunho preservado sem publicação definitiva.`;
      appendRulesHistory(draft, 'Tentativa de publicação');
    }
  });
}

async function init() {
  try {
    const payload = await apiRequest(API_PREVIEW_URL);
    normalizePayload(payload);
    try {
      const rules = await apiRequest(API_RULES_URL);
      if (rules.indicadores?.length) state.indicadores = rules.indicadores;
      if (rules.regras?.length) state.regras = rules.regras;
    } catch {}
    renderSourceBanner('Dados carregados da API do portal com Regra 01, IPs e fluxo operacional.', 'success');
  } catch (error) {
    normalizePayload(buildFallbackPayload());
    renderSourceBanner(`${error.message} Preview exibindo seed local enriquecido.`, 'warning');
  }

  renderAll();
  wireEvents();
}

init();
