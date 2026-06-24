import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown, BarChart3, LayoutDashboard, RefreshCw, Search, TrendingUp, UsersRound, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import DashboardFilters from '../components/DashboardFilters';
import { useCommercialFilters } from '../hooks/useCommercialFilters';
import './CorretorAnalytics.css';

const TABS = [
  { id: 'consolidado', label: 'Consolidado Corretor', endpoint: '/api/v1/dashboard/corretores/consolidado' },
  { id: 'foguetes', label: 'Corretores Foguetes', endpoint: '/api/v1/dashboard/corretores/foguetes' },
  { id: 'diario', label: 'Corretor Diário', endpoint: '/api/v1/dashboard/corretores/diario' },
];

const INDICATOR_COLUMNS = [
  { key: 'visitas', label: 'VISITA' },
  { key: 'agendamentos', label: 'AGENDAMENTOS' },
  { key: 'propostas_aprovadas', label: 'PASTAS APROVADAS' },
  { key: 'propostas_condicionadas', label: 'PASTAS CONDICIONADAS' },
  { key: 'propostas_reprovadas', label: 'PASTAS REPROVADAS' },
  { key: 'propostas', label: 'PASTAS COM RESPOSTAS' },
  { key: 'vendas', label: 'VENDA' },
  { key: 'vendas_finalizadas', label: 'VENDA FINALIZADA' },
  { key: 'repasses', label: 'REPASSE' },
  { key: 'distratos', label: 'DISTRATOS' },
  { key: 'cancelamentos', label: 'CANCELAMENTOS' },
];

const FOGUETE_INDICATOR_COLUMNS = [
  { key: 'agendamentos', label: 'AGENDAMENTO' },
  { key: 'visitas', label: 'VISITA' },
  { key: 'propostas', label: 'PASTAS COM RESPOSTAS' },
  { key: 'propostas_aprovadas', label: 'PASTA APROVADA' },
  { key: 'propostas_condicionadas', label: 'CONDICIONADA' },
  { key: 'propostas_reprovadas', label: 'REPROVADA' },
  { key: 'vendas', label: 'RESERVAS' },
  { key: 'repasses', label: 'REPASSE' },
];

const FOGUETE_FUNCIONARIO_COLUMNS = [
  { key: 'identificador_funcionario', label: 'ID FUNCIONÁRIO' },
  { key: 'funcionario_email', label: 'E-MAIL FUNCIONÁRIO' },
  { key: 'funcionario_tipo_vinculo', label: 'VÍNCULO' },
  { key: 'funcionario_status', label: 'STATUS FUNCIONÁRIO' },
];

const TOP_EMPREENDIMENTO_METRICS = [
  { key: 'propostas', label: 'Pastas', barName: 'Pastas com respostas' },
  { key: 'vendas', label: 'Vendas', barName: 'Vendas' },
  { key: 'vendas_finalizadas', label: 'Vendas Finalizadas', barName: 'Vendas finalizadas' },
  { key: 'repasses', label: 'Repasse', barName: 'Repasses' },
];

const DETAIL_FIELDS = [
  ['fato_jornada_comercial_key', 'Chave fato'],
  ['journey_id', 'Journey ID'],
  ['journey_key', 'Journey key'],
  ['journey_anchor_type', 'Âncora'],
  ['idlead', 'ID lead'],
  ['idprecadastro', 'ID pré-cadastro'],
  ['idreserva', 'ID reserva'],
  ['idrepasse', 'ID repasse'],
  ['idcorretor_atual', 'ID corretor'],
  ['idgestor', 'ID gestor'],
  ['idimobiliaria', 'ID imobiliária'],
  ['idempreendimento', 'ID empreendimento'],
  ['idunidade', 'ID unidade'],
  ['idcorretor_canonico', 'ID corretor canônico'],
  ['idgestor_canonico', 'ID gestor canônico'],
  ['idimobiliaria_canonico', 'ID imobiliária canônica'],
  ['idcliente_canonico', 'ID cliente canônico'],
  ['idcontrato_canonico', 'ID contrato canônico'],
];

const BROKER_IDENTITY_FIELDS = [
  ['corretor_identity_key', 'Chave canônica corretor'],
  ['corretor_dim_email_norm', 'E-mail dimensão corretor'],
  ['corretor_dim_nome', 'Nome dimensão corretor'],
  ['funcionario_corretor_identity_key', 'Chave identidade funcionário'],
  ['funcionario_identificador', 'Chave funcionário'],
  ['funcionario_usuario_id', 'ID usuário'],
  ['funcionario_equipe_vigencia_id', 'ID equipe vigente'],
  ['funcionario_nome', 'Nome funcionário'],
  ['funcionario_email', 'E-mail corretor'],
  ['funcionario_documento', 'Documento'],
  ['funcionario_matricula', 'Matrícula'],
  ['funcionario_tipo', 'Tipo funcionário'],
  ['funcionario_tipo_vinculo', 'Tipo vínculo'],
  ['funcionario_cargo', 'Cargo'],
  ['funcionario_cnpj', 'CNPJ'],
  ['funcionario_nome_empresa', 'Empresa'],
  ['funcionario_ativo', 'Ativo cadastro'],
  ['funcionario_ativo_negocio', 'Ativo negócio'],
  ['funcionario_ativo_login', 'Login ativo'],
  ['funcionario_status_validacao', 'Status validação'],
];

const COMMERCIAL_DETAIL_FIELDS = [
  ['imobiliaria_nome', 'Imobiliária operacional'],
  ['imobiliaria_nome_dim', 'Imobiliária dimensão'],
  ['imobiliaria_nome_canonica', 'Imobiliária canônica'],
  ['funcionario_imobiliaria', 'Imobiliária do funcionário'],
  ['regiao_empreendimento', 'Região operação'],
  ['nome_empreendimento_reduzido', 'Região reduzida'],
  ['funcionario_regiao', 'Região do funcionário'],
  ['funcionario_regional', 'Regional do funcionário'],
  ['lead_cidade', 'Cidade lead'],
  ['lead_estado', 'UF lead'],
  ['lead_regiao', 'Região lead'],
  ['empreendimento_nome', 'Empreendimento'],
  ['empreendimento_nome_reserva', 'Empreendimento reserva'],
  ['empreendimento_nome_repasse', 'Empreendimento repasse'],
  ['unidade_nome', 'Unidade'],
  ['corretor_nome_canonico', 'Corretor'],
  ['corretor_nome', 'Corretor operacional'],
  ['gestor_nome', 'Gestor'],
  ['funcionario_gestor', 'Gestor funcionário'],
  ['funcionario_gestor_email', 'E-mail gestor'],
  ['funcionario_coordenador', 'Coordenador funcionário'],
  ['funcionario_coordenador_email', 'E-mail coordenador'],
  ['funcionario_gerente', 'Gerente funcionário'],
  ['funcionario_gerente_email', 'E-mail gerente'],
  ['lead_origem_nome', 'Origem'],
  ['sdr_nome', 'SDR'],
];

const DATE_DETAIL_FIELDS = [
  ['dt_ultima_conversao_lead', 'Lead'],
  ['dt_visita_realizada', 'Visita'],
  ['dt_resposta_analise_precadastro', 'Resposta análise'],
  ['detalhe_proposta_data', 'Resposta análise consolidada'],
  ['dt_cadastro_reserva', 'Reserva'],
  ['dt_cancelamento_reserva', 'Cancelamento'],
  ['detalhe_distrato_data', 'Distrato'],
  ['dt_contrato_contabilizado', 'Contrato contabilizado'],
  ['data_venda', 'Venda'],
  ['dt_venda_finalizada', 'Venda finalizada'],
  ['dt_assinatura_contrato', 'Assinatura contrato'],
  ['dt_referencia_reserva', 'Referência reserva'],
  ['dt_referencia_repasse', 'Referência repasse'],
  ['dt_cadastro_canonico', 'Cadastro canônico'],
  ['dt_consulta_cpf', 'Consulta CPF'],
  ['funcionario_data_admissao', 'Admissão funcionário'],
  ['funcionario_data_inicio_vigencia', 'Início vigência funcionário'],
  ['funcionario_data_fim_vigencia', 'Fim vigência funcionário'],
  ['funcionario_data_cadastro_usuario', 'Cadastro usuário'],
];

const RESERVA_REPASSE_FIELDS = [
  ['reserva_campos_adicionais_data_qr', 'Data QR reserva'],
  ['reserva_campos_adicionais_reserva_repasse_no_mes', 'Repasse no mês'],
  ['reserva_campos_adicionais_reserva_kit_cef', 'Kit CEF reserva'],
  ['reserva_campos_adicionais_reserva_kit_agehab', 'Kit Agehab reserva'],
  ['reserva_campos_adicionais_reserva_kit_registro_entregue', 'Kit registro entregue'],
  ['reserva_campos_adicionais_reserva_kit_agehab_ok', 'Kit Agehab OK reserva'],
  ['reserva_campos_adicionais_reserva_data_kit_agehab', 'Data kit Agehab'],
  ['reserva_campos_adicionais_reserva_obs_cef', 'Obs. CEF'],
  ['reserva_campos_adicionais_reserva_obs_agehab', 'Obs. Agehab'],
  ['reserva_campos_adicionais_reserva_obs_finalizacao', 'Obs. finalização'],
  ['repasse_campos_adicionais_repasse_data_envio_cehop', 'Envio CEHOP'],
  ['repasse_campos_adicionais_repasse_data_conformidade_cehop', 'Conformidade CEHOP'],
  ['repasse_campos_adicionais_repasse_data_da_inconformidade_cehop', 'Inconformidade CEHOP'],
  ['repasse_campos_adicionais_repasse_data_do_reenvio_cehop', 'Reenvio CEHOP'],
  ['repasse_campos_adicionais_repasse_probabilidade_de_assinatura', 'Probabilidade assinatura'],
  ['repasse_campos_adicionais_repasse_kit_agehab_ok', 'Kit Agehab OK repasse'],
  ['repasse_campos_adicionais_repasse_obs_sinal', 'Obs. sinal'],
  ['repasse_campos_adicionais_repasse_obs_prefeitura', 'Obs. prefeitura'],
  ['repasse_campos_adicionais_repasse_obs_cartorio', 'Obs. cartório'],
  ['repasse_campos_adicionais_repasse_obs_garantia', 'Obs. garantia'],
];

const SITUATION_DETAIL_FIELDS = [
  ['lead_situacao_nome', 'Situação lead'],
  ['dim_lead_situacao_nome', 'Situação lead dimensão'],
  ['precadastro_situacao_nome', 'Situação pasta'],
  ['detalhe_proposta_status_atual', 'Status proposta consolidada'],
  ['detalhe_proposta_situacao', 'Situação proposta consolidada'],
  ['reserva_situacao_nome', 'Situação reserva'],
  ['repasse_situacao_nome', 'Situação repasse'],
  ['detalhe_distrato_situacao', 'Situação distrato'],
  ['situacao_nome_canonica', 'Situação canônica'],
  ['idsituacao_canonica', 'ID situação atual'],
  ['fonte_idsituacao_canonica', 'Fonte situação atual'],
  ['idsituacao_anterior_canonica', 'ID situação anterior'],
  ['fonte_idsituacao_anterior_canonica', 'Fonte situação anterior'],
];

const SOURCE_DETAIL_FIELDS = [
  ['fonte_idcorretor_canonico', 'Fonte ID corretor'],
  ['fonte_idgestor_canonico', 'Fonte ID gestor'],
  ['fonte_idimobiliaria_canonico', 'Fonte ID imobiliária'],
  ['fonte_idempreendimento_canonico', 'Fonte ID empreendimento'],
  ['fonte_idunidade_canonico', 'Fonte ID unidade'],
  ['fonte_idcliente_canonico', 'Fonte ID cliente'],
  ['fonte_idcontrato_canonico', 'Fonte ID contrato'],
  ['fonte_corretor_nome_canonico', 'Fonte nome corretor'],
  ['funcionario_referencia_origem', 'Referência funcionário'],
  ['funcionario_origem_planilha', 'Origem planilha'],
];

const DETAIL_TABLE_COLUMNS = [
  { key: 'detalhe_chave', label: 'ID detalhe', className: 'is-id' },
  { key: 'idreserva', label: 'ID reserva', className: 'is-id' },
  { key: 'idrepasse', label: 'ID repasse', className: 'is-id' },
  { key: 'idprecadastro', label: 'ID pasta', className: 'is-id' },
  { key: 'data_evento', label: 'Data evento', type: 'datetime' },
  { key: 'imobiliaria_nome_canonica', label: 'Imobiliária' },
  { key: 'regiao_empreendimento', label: 'Região' },
  { key: 'nome_empreendimento_reduzido', label: 'Emp. reduzido' },
  { key: 'empreendimento_nome', label: 'Empreendimento' },
  { key: 'unidade_nome', label: 'Unidade' },
  { key: 'corretor_nome_canonico', label: 'Corretor' },
  { key: 'gestor_nome', label: 'Gestor' },
  { key: 'situacao_nome_canonica', label: 'Situação atual' },
  { key: 'idsituacao_canonica', label: 'ID sit. atual', className: 'is-id' },
  { key: 'idsituacao_anterior_canonica', label: 'ID sit. ant.', className: 'is-id' },
  { key: 'precadastro_situacao_nome', label: 'Situação pasta' },
  { key: 'reserva_situacao_nome', label: 'Situação reserva' },
  { key: 'repasse_situacao_nome', label: 'Situação repasse' },
  { key: 'reserva_campos_adicionais_data_qr', label: 'Data QR', type: 'datetime' },
  { key: 'reserva_campos_adicionais_reserva_repasse_no_mes', label: 'Repasse mês' },
  { key: 'reserva_campos_adicionais_reserva_kit_cef', label: 'Kit CEF' },
  { key: 'reserva_campos_adicionais_reserva_kit_agehab', label: 'Kit Agehab' },
  { key: 'repasse_campos_adicionais_repasse_data_envio_cehop', label: 'Envio CEHOP', type: 'datetime' },
  { key: 'repasse_campos_adicionais_repasse_probabilidade_de_assinatura', label: 'Prob. assinatura' },
];

const MONTH_NAMES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const formatDate = (value) => {
  if (!value) return '-';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const raw = String(value);
  const [date, time = ''] = raw.split('T');
  const formattedDate = formatDate(date);
  const formattedTime = time.slice(0, 5);
  return formattedTime ? `${formattedDate} ${formattedTime}` : formattedDate;
};

const formatNumber = (value, type) => {
  if (type === 'date') return formatDate(value);
  if (value == null || value === '') return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (type === 'percent') return `${number.toFixed(1)}%`;
  if (type === 'ratio') return number.toFixed(2);
  if (type === 'integer') return number.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  return String(value);
};

const funcionarioStatusLabel = (row) => {
  const ativo = String(row?.funcionario_ativo ?? '').toLowerCase() === 'true';
  const ativoNegocio = String(row?.funcionario_ativo_negocio ?? '').toLowerCase() === 'true';
  const ativoLogin = String(row?.funcionario_ativo_login ?? '').toLowerCase() === 'true';
  if (ativo && ativoNegocio && ativoLogin) return 'Ativo';
  if (ativo || ativoNegocio || ativoLogin) return 'Parcial';
  return row?.identificador_funcionario ? 'Inativo' : 'Sem vínculo';
};

const funcionarioCellValue = (row, key) => {
  if (key === 'funcionario_status') return funcionarioStatusLabel(row);
  const value = row?.[key];
  return value == null || value === '' ? '-' : String(value);
};

const compareValues = (aValue, bValue) => {
  const emptyA = aValue == null || aValue === '';
  const emptyB = bValue == null || bValue === '';
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  const numA = Number(aValue);
  const numB = Number(bValue);
  if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;

  return String(aValue).localeCompare(String(bValue), 'pt-BR', { numeric: true, sensitivity: 'base' });
};

const formatDetailValue = (item, key) => {
  const value = item?.[key];
  if (value == null || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (key.startsWith('dt_') || key.includes('_data') || key.includes('data_')) {
    return formatDateTime(value);
  }
  return String(value);
};

const formatDetailTableValue = (item, column) => {
  const value = item?.[column.key];
  if (value == null || value === '') return '-';
  if (column.type === 'datetime') return formatDateTime(value);
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
};

const DetailGrid = ({ fields, item }) => (
  <div className="corretor-detail-grid">
    {fields.map(([key, label]) => (
      <div key={key}>
        <span>{label}</span>
        <strong>{formatDetailValue(item, key)}</strong>
      </div>
    ))}
  </div>
);

const getIndicatorLabel = (key) => (
  [...INDICATOR_COLUMNS, ...FOGUETE_INDICATOR_COLUMNS].find((column) => column.key === key)?.label
  || (key === 'total' ? 'TOTAL' : null)
  || key
);

const numericTotal = (items, key) => items.reduce((total, item) => total + (Number(item?.[key]) || 0), 0);

const safeDivide = (numerator, denominator) => {
  const num = Number(numerator) || 0;
  const den = Number(denominator) || 0;
  return den > 0 ? num / den : 0;
};

const qualificationRuleLabel = (qualification) => {
  const corte = formatNumber(qualification?.corte ?? 2, 'integer');
  return `${corte} ou mais repasses`;
};

const metricValue = (item, key) => {
  if (key === 'pendente_comercial' || key === 'pendente_credito') return 0;
  return Number(item?.[key]) || 0;
};

const DETAIL_INDICATOR_KEY = {
  venda_cadastrada: 'vendas',
  venda_gerada: 'vendas',
};

const resolveDetailIndicatorKey = (key) => DETAIL_INDICATOR_KEY[key] || key;

const isDetailSupportedIndicator = (key) => {
  const detailKey = resolveDetailIndicatorKey(key);
  return !['pendente_comercial', 'pendente_credito', 'total'].includes(detailKey);
};

const detailEntityLabel = (entity) => ({
  idlead: 'ID lead',
  idprecadastro: 'ID pasta',
  idreserva: 'ID reserva',
  idrepasse: 'ID repasse',
}[entity] || 'ID detalhe');

const aggregateRows = (items, key) => items.reduce((total, item) => total + metricValue(item, key), 0);

const groupByValue = (items, key) => items.reduce((groups, item) => {
  const value = String(item?.[key] || `Sem ${key}`);
  if (!groups.has(value)) groups.set(value, []);
  groups.get(value).push(item);
  return groups;
}, new Map());

const quarterLabel = (month) => `Qtr ${Math.floor((Number(month || 1) - 1) / 3) + 1}`;

const groupedDayHeaders = (days, resolver) => {
  const groups = [];
  days.forEach((day) => {
    const label = resolver(day);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.colSpan += 1;
      return;
    }
    groups.push({ label, colSpan: 1 });
  });
  return groups;
};

const frequencyClassLabel = (value) => ({
  recorrente: 'Recorrente',
  em_aceleracao: 'Em aceleração',
  pontual: 'Pontual',
  nao_foguete: 'Sem recorrência',
}[value] || 'Sem classificação');

const CorretorAnalytics = () => {
  const { filters, buildFilterParams, filterQueryString } = useCommercialFilters();
  const [activeTab, setActiveTab] = useState('consolidado');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('repasses');
  const [order, setOrder] = useState('desc');
  const [regionSort, setRegionSort] = useState({ key: 'regiao', order: 'asc' });
  const [dailySort, setDailySort] = useState({ key: 'corretor', order: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [payload, setPayload] = useState({ items: [], pagination: { total: 0, pages: 0 } });
  const [frequencyPayload, setFrequencyPayload] = useState({ items: [], pagination: { total: 0 } });
  const [, setIsLoadingFrequency] = useState(false);
  const [selectedFoguete, setSelectedFoguete] = useState('');
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState('');
  const [topEmpreendimentoMetric, setTopEmpreendimentoMetric] = useState('repasses');
  const [detailPayload, setDetailPayload] = useState(null);
  const [detailContext, setDetailContext] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const tabConfig = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, debouncedSearch, filterQueryString, pageSize]);

  useEffect(() => {
    if (activeTab === 'diario') {
      setSort('corretor');
      setOrder('asc');
      setDailySort({ key: 'corretor', order: 'asc' });
      return;
    }
    setSort('repasses');
    setOrder('desc');
  }, [activeTab]);

  useEffect(() => {
    setDetailPayload(null);
    setDetailContext(null);
    setDetailError('');
    setSelectedFoguete('');
    setSelectedEmpreendimento('');
  }, [activeTab, filterQueryString]);

  useEffect(() => {
    const controller = new AbortController();
    const loadRows = async () => {
      setIsLoading(true);
      setError('');
      const params = buildFilterParams(filters.dataInicial, filters.dataFinal, {
        search: debouncedSearch,
        sort,
        order,
        page: String(page),
        pageSize: String(pageSize),
      });

      try {
        const response = await fetch(`${tabConfig.endpoint}?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) {
          let detail = `Erro ${response.status}`;
          try {
            const body = await response.json();
            detail = body?.detail || body?.error || detail;
          } catch {
            // noop
          }
          throw new Error(detail);
        }
        const data = await response.json();
        setPayload({
          items: Array.isArray(data?.items) ? data.items : [],
          dias: Array.isArray(data?.dias) ? data.dias : [],
          indicadores: Array.isArray(data?.indicadores) ? data.indicadores : [],
          pagination: data?.pagination ?? { total: 0, pages: 0 },
          meta: data?.meta ?? null,
          summary: data?.summary ?? null,
        });
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setPayload({ items: [], dias: [], indicadores: [], pagination: { total: 0, pages: 0 }, summary: null });
        setError(err?.message || 'Erro ao carregar análise por corretor.');
      } finally {
        setIsLoading(false);
      }
    };

    loadRows();
    return () => controller.abort();
  }, [activeTab, buildFilterParams, debouncedSearch, filters.dataFinal, filters.dataInicial, filterQueryString, order, page, pageSize, sort, tabConfig.endpoint]);

  useEffect(() => {
    if (activeTab !== 'foguetes') {
      setFrequencyPayload({ items: [], pagination: { total: 0 } });
      setIsLoadingFrequency(false);
      return undefined;
    }
    const controller = new AbortController();
    const loadFrequency = async () => {
      setIsLoadingFrequency(true);
      const params = buildFilterParams(filters.dataInicial, filters.dataFinal, {
        search: debouncedSearch,
        limit: '120',
      });
      try {
        const response = await fetch(`/api/v1/dashboard/corretores/foguetes/frequencia?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        const data = await response.json();
        setFrequencyPayload({
          items: Array.isArray(data?.items) ? data.items : [],
          pagination: data?.pagination ?? { total: 0 },
          meta: data?.meta ?? null,
        });
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setFrequencyPayload({ items: [], pagination: { total: 0 } });
        }
      } finally {
        setIsLoadingFrequency(false);
      }
    };
    loadFrequency();
    return () => controller.abort();
  }, [activeTab, buildFilterParams, debouncedSearch, filters.dataFinal, filters.dataInicial, filterQueryString]);

  const currentPage = Number(payload.pagination?.page ?? page) || page;
  const totalPages = Number(payload.pagination?.pages ?? 0) || 0;

  const tableItems = useMemo(() => {
    const items = payload.items ?? [];
    if (activeTab !== 'foguetes' || !selectedFoguete) return items;
    return items.filter((item) => item.corretor === selectedFoguete);
  }, [activeTab, payload.items, selectedFoguete]);

  const handleSort = (column) => {
    if (sort === column.key) {
      setOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSort(column.key);
    setOrder(column.key === 'corretor' ? 'asc' : 'desc');
  };

  const handleRegionSort = (column) => {
    setRegionSort((current) => (
      current.key === column.key
        ? { key: column.key, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, order: column.key === 'regiao' ? 'asc' : 'desc' }
    ));
  };

  const handleDailySort = (column) => {
    setDailySort((current) => (
      current.key === column.key
        ? { key: column.key, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, order: column.key === 'corretor' ? 'asc' : 'desc' }
    ));
  };

  const loadDetail = async ({ row, indicatorKey, indicatorLabel, value, selectedDate = null }) => {
    const corretor = row?.corretor;
    const corretorIdentity = row?.corretor_identity_key;
    const regiaoDetalhe = !corretor ? row?.regiao : '';
    if (!corretorIdentity && !corretor && !regiaoDetalhe) return;
    const detailIndicatorKey = resolveDetailIndicatorKey(indicatorKey);
    if (!isDetailSupportedIndicator(detailIndicatorKey)) return;
    setIsLoadingDetail(true);
    setDetailError('');
    setDetailContext({
      aba: activeTab,
      corretorIdentity,
      corretor,
      equipe: row?.equipe,
      gerente: row?.gerente,
      coordenador: row?.coordenador,
      regiao: row?.regiao,
      indicatorKey,
      detailIndicatorKey,
      indicatorLabel,
      value,
      data: selectedDate,
    });

    const params = buildFilterParams(filters.dataInicial, filters.dataFinal, {
      indicador: detailIndicatorKey,
      aba: activeTab,
      expectedTotal: String(Number(value) || 0),
      limit: '120',
    });
    if (Array.isArray(row?.corretor_identity_keys) && row.corretor_identity_keys.length > 0) {
      params.set('corretorIdentities', row.corretor_identity_keys.filter(Boolean).join(','));
    }
    if (Array.isArray(row?.corretor_match_keys) && row.corretor_match_keys.length > 0) {
      params.set('corretorMatches', row.corretor_match_keys.filter(Boolean).join(','));
    }
    if (corretorIdentity) params.set('corretorIdentity', corretorIdentity);
    if (corretor) params.set('corretor', corretor);
    if (regiaoDetalhe) params.set('regiaoDetalhe', regiaoDetalhe);
    if (selectedDate) params.set('data', selectedDate);

    try {
      const response = await fetch(`/api/v1/dashboard/corretores/detalhes?${params.toString()}`);
      if (!response.ok) {
        let detail = `Erro ${response.status}`;
        try {
          const body = await response.json();
          detail = body?.detail || body?.error || detail;
        } catch {
          // noop
        }
        throw new Error(detail);
      }
      const data = await response.json();
      setDetailPayload(data);
    } catch (err) {
      setDetailPayload(null);
      setDetailError(err?.message || 'Erro ao carregar detalhamento.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setDetailPayload(null);
    setDetailContext(null);
    setDetailError('');
  };

  const renderMetricCell = (row, column) => {
    const value = metricValue(row, column.key);
    if (value <= 0 || !isDetailSupportedIndicator(column.key)) {
      return <span>{formatNumber(value, 'integer')}</span>;
    }
    return (
      <button
        type="button"
        className="metric-detail-button"
        title={`Detalhar ${formatNumber(value, 'integer')} ${column.label}`}
        onClick={() => loadDetail({
          row,
          indicatorKey: column.key,
          indicatorLabel: column.label,
          value,
        })}
      >
        {formatNumber(value, 'integer')}
      </button>
    );
  };

  const renderRegionMetricCell = (regiao, items, column) => {
    const value = aggregateRows(items, column.key);
    if (value <= 0 || !isDetailSupportedIndicator(column.key)) {
      return <span>{formatNumber(value, 'integer')}</span>;
    }
    return (
      <button
        type="button"
        className="metric-detail-button"
        title={`Detalhar ${formatNumber(value, 'integer')} ${column.label} em ${regiao}`}
        onClick={() => loadDetail({
          row: { regiao },
          indicatorKey: column.key,
          indicatorLabel: column.label,
          value,
        })}
      >
        {formatNumber(value, 'integer')}
      </button>
    );
  };

  const renderDailyMetricCell = (broker, indicator, day) => {
    const value = Number(indicator.valores?.[day.data] ?? 0) || 0;
    if (value <= 0 || !isDetailSupportedIndicator(indicator.key)) {
      return <span>{formatNumber(value, 'integer')}</span>;
    }
    return (
      <button
        type="button"
        className="metric-detail-button"
        title={`Detalhar ${formatNumber(value, 'integer')} ${indicator.label} em ${formatDate(day.data)}`}
        onClick={() => loadDetail({
          row: broker,
          indicatorKey: indicator.key,
          indicatorLabel: indicator.label,
          value,
          selectedDate: day.data,
        })}
      >
        {formatNumber(value, 'integer')}
      </button>
    );
  };

  const renderDailyTotalCell = (broker, indicator) => {
    const value = Number(indicator.total ?? 0) || 0;
    if (value <= 0 || !isDetailSupportedIndicator(indicator.key)) {
      return <span>{formatNumber(value, 'integer')}</span>;
    }
    return (
      <button
        type="button"
        className="metric-detail-button"
        title={`Detalhar ${formatNumber(value, 'integer')} ${indicator.label} no período`}
        onClick={() => loadDetail({
          row: broker,
          indicatorKey: indicator.key,
          indicatorLabel: indicator.label,
          value,
        })}
      >
        {formatNumber(value, 'integer')}
      </button>
    );
  };

  const dayColumns = Array.isArray(payload.dias) ? payload.dias : [];
  const yearGroups = groupedDayHeaders(dayColumns, (day) => String(day.ano || ''));
  const quarterGroups = groupedDayHeaders(dayColumns, (day) => quarterLabel(day.mes));
  const monthGroups = groupedDayHeaders(dayColumns, (day) => MONTH_NAMES[(Number(day.mes) || 1) - 1] || String(day.mes || ''));

  const dailyItems = useMemo(() => {
    const items = Array.isArray(payload.items) ? payload.items : [];
    return items.slice().sort((a, b) => {
      let valueA = a?.corretor;
      let valueB = b?.corretor;
      if (dailySort.key === 'indicador') {
        valueA = a?.corretor;
        valueB = b?.corretor;
      } else if (dailySort.key === 'total') {
        const totalForPeriod = (broker) => (Array.isArray(broker?.indicadores) ? broker.indicadores : [])
          .filter((indicator) => indicator.key !== 'total')
          .reduce((sum, indicator) => sum + (Number(indicator.total) || 0), 0);
        valueA = totalForPeriod(a);
        valueB = totalForPeriod(b);
      } else if (dailySort.key.startsWith('day:')) {
        const date = dailySort.key.slice(4);
        const totalForDay = (broker) => (Array.isArray(broker?.indicadores) ? broker.indicadores : [])
          .filter((indicator) => indicator.key !== 'total')
          .reduce((sum, indicator) => sum + (Number(indicator.valores?.[date]) || 0), 0);
        valueA = totalForDay(a);
        valueB = totalForDay(b);
      }
      const result = compareValues(valueA, valueB);
      return dailySort.order === 'asc' ? result : -result;
    });
  }, [dailySort.key, dailySort.order, payload.items]);

  const regionSummary = useMemo(() => {
    const groups = groupByValue(tableItems, 'regiao');
    const rows = Array.from(groups.entries()).map(([regiao, items]) => ({
      regiao,
      items,
    }));
    rows.sort((a, b) => {
      const valueA = regionSort.key === 'regiao' ? a.regiao : aggregateRows(a.items, regionSort.key);
      const valueB = regionSort.key === 'regiao' ? b.regiao : aggregateRows(b.items, regionSort.key);
      const result = compareValues(valueA, valueB);
      return regionSort.order === 'asc' ? result : -result;
    });
    return rows;
  }, [regionSort.key, regionSort.order, tableItems]);

  const fogueteInsights = useMemo(() => {
    const allItems = (payload.items ?? []).filter((item) => item.corretor !== 'Inativos/Outros');
    const rawEmpreendimentosDetalhados = Array.isArray(payload.summary?.empreendimentos_foguetes)
      ? payload.summary.empreendimentos_foguetes
      : [];
    const corretoresDoEmpreendimento = selectedEmpreendimento && rawEmpreendimentosDetalhados.length
      ? new Set(rawEmpreendimentosDetalhados
        .filter((item) => item.empreendimento === selectedEmpreendimento)
        .map((item) => item.corretor))
      : null;
    const items = allItems
      .filter((item) => (selectedFoguete ? item.corretor === selectedFoguete : true))
      .filter((item) => (corretoresDoEmpreendimento ? corretoresDoEmpreendimento.has(item.corretor) : true));
    const resumoFoguetes = payload.summary?.foguetes ?? {};
    const resumoFato = payload.summary?.fato ?? {};
    const resumoQualificacao = payload.summary?.qualificacao ?? {};
    const usingDrill = Boolean(selectedFoguete || selectedEmpreendimento);
    const totalRepasses = numericTotal(items, 'repasses');
    const totalVendas = numericTotal(items, 'vendas');
    const totalVendasFinalizadas = numericTotal(items, 'vendas_finalizadas');
    const totalCorretoresResumo = usingDrill ? items.length : (Number(resumoFoguetes?.corretores) || items.length);
    const totalRepassesResumo = usingDrill ? totalRepasses : (Number(resumoFoguetes?.repasses) || totalRepasses);
    const totalVendasResumo = usingDrill ? totalVendas : (Number(resumoFoguetes?.vendas) || totalVendas);
    const totalVendasFinalizadasResumo = usingDrill ? totalVendasFinalizadas : (Number(resumoFoguetes?.vendas_finalizadas) || totalVendasFinalizadas);
    const fatoRepasses = Number(resumoFato?.repasses) || 0;
    const qualification = {
      corte: Number(resumoQualificacao?.corte_repasses_mes_anterior ?? 2) || 2,
      comparador: resumoQualificacao?.comparador || '>=',
      corretoresComRepasse: Number(resumoQualificacao?.corretores_com_repasse_mes_anterior) || 0,
      corretoresAcimaCorte: Number(resumoQualificacao?.corretores_acima_corte_fato) || 0,
      repassesFato: Number(resumoQualificacao?.repasses_mes_anterior_fato) || 0,
      repassesAcimaCorte: Number(resumoQualificacao?.repasses_mes_anterior_acima_corte) || 0,
      repassesFoguetes: Number(resumoFoguetes?.repasses_qualificacao) || 0,
    };
    const fogueteMetricValue = (key) => {
      if (usingDrill) return aggregateRows(items, key);
      if (key === 'vendas_finalizadas') return Number(resumoFoguetes?.vendas_finalizadas ?? resumoFoguetes?.vendas) || 0;
      return Number(resumoFoguetes?.[key]) || 0;
    };
    const operationMetricValue = (key) => {
      if (key === 'vendas_finalizadas') return Number(resumoFato?.vendas_finalizadas ?? resumoFato?.vendas) || 0;
      return Number(resumoFato?.[key]) || 0;
    };
    const comparativeMetrics = [
      { key: 'propostas', label: 'Pastas c/ respostas' },
      { key: 'propostas_aprovadas', label: 'Aprovadas' },
      { key: 'propostas_condicionadas', label: 'Condicionadas' },
      { key: 'propostas_reprovadas', label: 'Reprovadas' },
      { key: 'vendas', label: 'Vendas' },
      { key: 'vendas_finalizadas', label: 'Vendas finalizadas' },
      { key: 'repasses', label: 'Repasses' },
    ];
    const comparativeBars = comparativeMetrics.map((metric) => ({
      ...metric,
      foguetes: fogueteMetricValue(metric.key),
      operacao: operationMetricValue(metric.key),
    }));
    const rawTopEmpreendimentos = Array.isArray(payload.summary?.top_empreendimentos)
      ? payload.summary.top_empreendimentos
      : [];
    const rawEmpreendimentos = rawEmpreendimentosDetalhados.length ? rawEmpreendimentosDetalhados : rawTopEmpreendimentos;
    const canFilterTopByFoguete = Boolean(selectedFoguete && rawEmpreendimentosDetalhados.length);
    const empreendimentosBase = canFilterTopByFoguete
      ? rawEmpreendimentos.filter((item) => item.corretor === selectedFoguete)
      : rawEmpreendimentos;
    const empreendimentosMap = new Map();
    empreendimentosBase.forEach((item) => {
      const key = item.empreendimento || 'Sem empreendimento';
      const current = empreendimentosMap.get(key) || {
        empreendimento: key,
        leads: 0,
        visitas: 0,
        propostas: 0,
        vendas: 0,
        vendas_finalizadas: 0,
        repasses: 0,
        corretores: new Set(),
      };
      current.leads += Number(item.leads) || 0;
      current.visitas += Number(item.visitas) || 0;
      current.propostas += Number(item.propostas) || 0;
      current.vendas += Number(item.vendas) || 0;
      current.vendas_finalizadas += Number(item.vendas_finalizadas) || 0;
      current.repasses += Number(item.repasses) || 0;
      if (item.corretor) current.corretores.add(item.corretor);
      empreendimentosMap.set(key, current);
    });
    const topEmpreendimentos = Array.from(empreendimentosMap.values())
      .map((item) => ({ ...item, corretores: item.corretores.size }));
    const contributionPercent = safeDivide(totalRepassesResumo, fatoRepasses) * 100;
    const previousMonthRepassers = Array.isArray(payload.summary?.corretores_repasses_mes_anterior)
      ? payload.summary.corretores_repasses_mes_anterior.filter((item) => Number(item.repasses_mes_anterior) >= 2)
      : [];
    return {
      items,
      allItems,
      selectedFoguete,
      selectedEmpreendimento,
      totalCorretores: totalCorretoresResumo,
      totalRepasses: totalRepassesResumo,
      totalVendas: totalVendasResumo,
      totalVendasFinalizadas: totalVendasFinalizadasResumo,
      fatoRepasses,
      qualification,
      comparativeBars,
      topEmpreendimentos,
      contributionPercent,
      previousMonthRepassers,
    };
  }, [payload.items, payload.summary, selectedEmpreendimento, selectedFoguete]);

  const frequencyInsights = useMemo(() => {
    const items = Array.isArray(frequencyPayload.items) ? frequencyPayload.items : [];
    const recorrentes = items.filter((item) => item.classificacao_frequencia === 'recorrente').length;
    const aceleracao = items.filter((item) => item.classificacao_frequencia === 'em_aceleracao').length;
    const pontuais = items.filter((item) => item.classificacao_frequencia === 'pontual').length;
    const top = items.slice(0, 10).map((item) => ({
      corretor: item.corretor || 'Sem corretor',
      vezes: Number(item.vezes_foguete) || 0,
      frequencia: Number(item.frequencia_foguete) || 0,
      repasses: Number(item.repasses_qualificacao) || 0,
      classificacao: frequencyClassLabel(item.classificacao_frequencia),
    }));
    return {
      items,
      top,
      total: Number(frequencyPayload.pagination?.total ?? items.length) || 0,
      recorrentes,
      aceleracao,
      pontuais,
      mediaVezes: safeDivide(items.reduce((total, item) => total + (Number(item.vezes_foguete) || 0), 0), items.length),
    };
  }, [frequencyPayload]);

  const renderFogueteInsights = () => {
    if (activeTab !== 'foguetes') return null;
    const regraEntradaLabel = qualificationRuleLabel(fogueteInsights.qualification);
    const selectedTopMetric = TOP_EMPREENDIMENTO_METRICS.find((metric) => metric.key === topEmpreendimentoMetric) ?? TOP_EMPREENDIMENTO_METRICS[0];
    const empreendimentoChartData = fogueteInsights.topEmpreendimentos
      .map((item) => ({
        ...item,
        label: item.empreendimento.length > 30 ? `${item.empreendimento.slice(0, 29)}...` : item.empreendimento,
        total: Number(item[selectedTopMetric.key]) || 0,
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total || b.repasses - a.repasses || b.vendas - a.vendas || b.propostas - a.propostas || a.empreendimento.localeCompare(b.empreendimento, 'pt-BR'))
      .slice(0, 6);
    const hasDrill = Boolean(selectedFoguete || selectedEmpreendimento);
    return (
      <section className="foguete-story" aria-label="Data storytelling dos Corretores Foguetes">
        <div className="foguete-story-hero">
          <div>
            <span className="label-md text-primary">Corretores Foguetes</span>
            <h3 className="headline-sm">
              {selectedFoguete ? selectedFoguete : 'Atletas de alta performance comercial'}
            </h3>
            <p>
              Entrada pelo período demarcado da regra: corretores com {regraEntradaLabel} realizados entre {formatDate(payload.meta?.qualificationStartDate)} e {formatDate(payload.meta?.qualificationEndDate)}.
            </p>
          </div>
          <div className="foguete-rule-card" title="Critério de entrada: repasses realizados dentro do período demarcado abaixo.">
            <span>Regra de entrada</span>
            <strong>{formatDate(payload.meta?.qualificationStartDate)} até {formatDate(payload.meta?.qualificationEndDate)}</strong>
            <small>
              {formatNumber(fogueteInsights.qualification.corretoresAcimaCorte, 'integer')} corretores com {regraEntradaLabel} nesse período
            </small>
          </div>
        </div>

        {hasDrill && (
          <div className="foguete-selected-strip">
            <span>
              Drill-down ativo
              {selectedFoguete ? ` em ${selectedFoguete}` : ''}
              {selectedEmpreendimento ? ` · ${selectedEmpreendimento}` : ''}
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSelectedFoguete('');
                setSelectedEmpreendimento('');
              }}
            >
              Limpar
            </button>
          </div>
        )}

        <div className="foguete-kpi-grid">
          <div className="foguete-kpi-card">
            <span>Total de Foguetes Ativos</span>
            <strong>{formatNumber(fogueteInsights.totalCorretores, 'integer')}</strong>
            <small>{hasDrill ? 'visão filtrada por drill-down' : `${formatNumber(frequencyInsights.recorrentes, 'integer')} recorrentes no período`}</small>
          </div>
          <div
            className="foguete-kpi-card"
            title="Venda: count distinct de idreserva com data de venda/contrato contabilizado no período filtrado. No consolidado usa comercial_kpi_daily.vendas; no detalhe usa dt_contrato_contabilizado."
          >
            <span>Vendas dos Foguetes</span>
            <strong>{formatNumber(fogueteInsights.totalVendas, 'integer')}</strong>
            <small>{formatNumber(safeDivide(fogueteInsights.totalVendas, fogueteInsights.totalCorretores), 'ratio')} por corretor</small>
          </div>
          <div
            className="foguete-kpi-card"
            title="Repasse: count distinct de idrepasse com assinatura de contrato no período filtrado. No consolidado usa comercial_kpi_daily.repasses; no detalhe usa dt_assinatura_contrato."
          >
            <span>Repasse dos Foguetes</span>
            <strong>{formatNumber(fogueteInsights.totalRepasses, 'integer')}</strong>
            <small>{formatNumber(safeDivide(fogueteInsights.totalRepasses, fogueteInsights.totalCorretores), 'ratio')} por corretor</small>
          </div>
          <div className="foguete-kpi-card is-highlight">
            <span>Contribuição nos Repasses</span>
            <strong>{formatNumber(fogueteInsights.contributionPercent, 'ratio')}%</strong>
            <small>{formatNumber(fogueteInsights.totalRepasses, 'integer')} de {formatNumber(fogueteInsights.fatoRepasses, 'integer')} repasses da fato</small>
          </div>
          <div className="foguete-kpi-card">
            <span>Repasses na Regra de Entrada</span>
            <strong>{formatNumber(fogueteInsights.qualification.repassesAcimaCorte, 'integer')}</strong>
            <small>de {formatNumber(fogueteInsights.qualification.repassesFato, 'integer')} repasses no período de entrada</small>
          </div>
        </div>

        <div className="foguete-viz-grid">
          <article className="foguete-viz-panel">
            <div className="foguete-viz-title">
              <BarChart3 size={15} />
              <span>Foguetes vs total da operação</span>
            </div>
            <div className="foguete-viz-body">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fogueteInsights.comparativeBars} margin={{ top: 12, right: 16, bottom: 74, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.28)" />
                  <XAxis dataKey="label" interval={0} angle={-28} textAnchor="end" height={78} tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatNumber(value, 'integer')} />
                  <Bar dataKey="operacao" name="Total operação" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="foguetes" name={hasDrill ? 'Drill-down selecionado' : 'Total foguetes'} fill="#0f766e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="foguete-viz-panel">
            <div className="foguete-viz-title">
              <TrendingUp size={15} />
              <span>Top empreendimentos convertidos</span>
              <div className="foguete-metric-selector" aria-label="Indicador do top de empreendimentos">
                {TOP_EMPREENDIMENTO_METRICS.map((metric) => (
                  <button
                    key={metric.key}
                    type="button"
                    className={topEmpreendimentoMetric === metric.key ? 'is-active' : ''}
                    onClick={() => setTopEmpreendimentoMetric(metric.key)}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="foguete-enterprise-chart">
              {empreendimentoChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={empreendimentoChartData} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 8 }}>
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis dataKey="label" type="category" width={150} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value, name) => [formatNumber(value, 'integer'), name === 'total' ? selectedTopMetric.barName : name]}
                      labelFormatter={(_, payloadItems) => {
                        const row = payloadItems?.[0]?.payload;
                        return row?.empreendimento || 'Empreendimento';
                      }}
                    />
                    <Bar
                      dataKey="total"
                      name={selectedTopMetric.barName}
                      fill="#0f766e"
                      radius={[0, 4, 4, 0]}
                      cursor="pointer"
                      onClick={(row) => setSelectedEmpreendimento((current) => (current === row.empreendimento ? '' : row.empreendimento))}
                    >
                      <LabelList dataKey="total" position="right" formatter={(value) => formatNumber(value, 'integer')} className="foguete-enterprise-label" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="foguete-frequency-empty">Sem empreendimento com produção para o recorte.</div>
              )}
            </div>
            <div className="foguete-enterprise-caption">
              <span>Indicador selecionado: {selectedTopMetric.barName}.</span>
              {selectedEmpreendimento && <button type="button" onClick={() => setSelectedEmpreendimento('')}>Limpar empreendimento</button>}
            </div>
          </article>
        </div>

        <div className="foguete-repassers-panel">
          <div className="foguete-viz-title">
            <UsersRound size={15} />
            <span>Foguetes pelo mês anterior ({formatNumber(fogueteInsights.previousMonthRepassers.length, 'integer')})</span>
          </div>
          <div className="foguete-repassers-table">
            <div className="foguete-repassers-head">
              <span>Corretor</span>
              <span>Equipe</span>
              <span>Rep. mês anterior</span>
              <span>Rep. mês atual</span>
            </div>
            <div className="foguete-repassers-body">
              {fogueteInsights.previousMonthRepassers.map((item) => (
                <button
                  key={`${item.corretor_match || item.corretor}-${item.repasses_mes_anterior}`}
                  type="button"
                  className="foguete-repassers-row"
                  onClick={() => setSelectedFoguete((current) => (current === item.corretor ? '' : item.corretor))}
                >
                  <strong>{item.corretor || 'Sem corretor'}</strong>
                  <span>{item.equipe || 'Sem equipe'}</span>
                  <b>{formatNumber(item.repasses_mes_anterior, 'integer')}</b>
                  <b>{formatNumber(item.repasses_periodo, 'integer')}</b>
                </button>
              ))}
              {fogueteInsights.previousMonthRepassers.length === 0 && (
                <div className="foguete-frequency-empty">Sem lista nominal no payload atual.</div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderSortButton = (column, activeSort, onSort) => (
    <button
      type="button"
      className={activeSort.key === column.key ? 'is-active-sort' : ''}
      onClick={() => onSort(column)}
      aria-label={`Ordenar por ${column.label}`}
    >
      <span>{column.label}</span>
      <ArrowUpDown size={12} />
    </button>
  );

  const renderConsolidadoTable = () => {
    const metricColumns = activeTab === 'foguetes' ? FOGUETE_INDICATOR_COLUMNS : INDICATOR_COLUMNS;

    return (
      <>
      <table className="corretor-consolidado-table">
        <thead>
          <tr>
            <th>{renderSortButton({ key: 'equipe', label: 'Imobiliária do Corretor' }, { key: sort, order }, handleSort)}</th>
            <th>{renderSortButton({ key: 'gerente', label: 'Gestor do Corretor' }, { key: sort, order }, handleSort)}</th>
            <th>
              {renderSortButton({ key: 'corretor', label: 'Corretor Ativo' }, { key: sort, order }, handleSort)}
            </th>
            {metricColumns.map((column) => (
              <th key={column.key}>{renderSortButton(column, { key: sort, order }, handleSort)}</th>
            ))}
            {activeTab === 'foguetes' && FOGUETE_FUNCIONARIO_COLUMNS.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableItems.length > 0 ? Array.from(groupByValue(tableItems, 'equipe').entries()).flatMap(([equipe, equipeItems]) => {
            const gestores = Array.from(groupByValue(equipeItems, 'gerente').entries());
            const equipeRowSpan = gestores.reduce((total, [, items]) => total + items.length + 1, 0);
            let equipePrinted = false;
            return gestores.flatMap(([gerente, gerenteItems]) => {
              const gerenteRowSpan = gerenteItems.length + 1;
              let gerentePrinted = false;
              const brokerRows = gerenteItems.map((row, index) => {
                const cells = [];
                if (!equipePrinted) {
                  cells.push(<td key="equipe" className="consolidado-group-cell" rowSpan={equipeRowSpan}>{equipe}</td>);
                  equipePrinted = true;
                }
                if (!gerentePrinted) {
                  cells.push(<td key="gerente" className="consolidado-group-cell" rowSpan={gerenteRowSpan}>{gerente}</td>);
                  gerentePrinted = true;
                }
                return (
                  <tr key={`${equipe}-${gerente}-${row.corretor}-${index}`}>
                    {cells}
                    <td className="consolidado-broker-cell">{row.corretor || 'Sem corretor'}</td>
                    {metricColumns.map((column) => (
                      <td key={column.key} className="is-numeric">{renderMetricCell(row, column)}</td>
                    ))}
                    {activeTab === 'foguetes' && FOGUETE_FUNCIONARIO_COLUMNS.map((column) => (
                      <td key={column.key} className="consolidado-funcionario-cell">{funcionarioCellValue(row, column.key)}</td>
                    ))}
                  </tr>
                );
              });
              const totalRow = (
                <tr key={`${equipe}-${gerente}-total`} className="consolidado-total-row">
                  <td>Total</td>
                  {metricColumns.map((column) => (
                    <td key={column.key} className="is-numeric">{formatNumber(aggregateRows(gerenteItems, column.key), 'integer')}</td>
                  ))}
                  {activeTab === 'foguetes' && FOGUETE_FUNCIONARIO_COLUMNS.map((column) => (
                    <td key={column.key}></td>
                  ))}
                </tr>
              );
              return [...brokerRows, totalRow];
            });
          }) : (
            <tr>
              <td colSpan={metricColumns.length + 3 + (activeTab === 'foguetes' ? FOGUETE_FUNCIONARIO_COLUMNS.length : 0)} className="corretor-analytics-empty">
                {isLoading ? 'Carregando dados...' : 'Sem dados para o filtro selecionado.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <table className="corretor-region-summary-table">
        <thead>
          <tr>
            <th>{renderSortButton({ key: 'regiao', label: 'Região do Corretor' }, regionSort, handleRegionSort)}</th>
            {metricColumns.map((column) => (
              <th key={column.key}>{renderSortButton(column, regionSort, handleRegionSort)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {regionSummary.map(({ regiao, items }) => (
            <tr key={regiao}>
              <td>{regiao}</td>
              {metricColumns.map((column) => (
                <td key={column.key} className="is-numeric">{renderRegionMetricCell(regiao, items, column)}</td>
              ))}
            </tr>
          ))}
          {tableItems.length > 0 && (
            <tr className="consolidado-total-row">
              <td>Total</td>
              {metricColumns.map((column) => (
                <td key={column.key} className="is-numeric">{formatNumber(aggregateRows(tableItems, column.key), 'integer')}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
      </>
    );
  };

  const renderDiarioMatrix = () => (
    <table className="corretor-daily-matrix">
      <thead>
        <tr>
          <th className="matrix-corretor-col matrix-time-label"></th>
          <th className="matrix-indicador-col matrix-time-label">Ano</th>
          {yearGroups.map((group, index) => (
            <th key={`year-${group.label}-${index}`} colSpan={group.colSpan}>{group.label}</th>
          ))}
          <th className="matrix-total-col"></th>
        </tr>
        <tr>
          <th className="matrix-corretor-col matrix-time-label"></th>
          <th className="matrix-indicador-col matrix-time-label">Trimestre</th>
          {quarterGroups.map((group, index) => (
            <th key={`quarter-${group.label}-${index}`} colSpan={group.colSpan}>{group.label}</th>
          ))}
          <th className="matrix-total-col"></th>
        </tr>
        <tr>
          <th className="matrix-corretor-col matrix-time-label"></th>
          <th className="matrix-indicador-col matrix-time-label">Mês</th>
          {monthGroups.map((group, index) => (
            <th key={`month-${group.label}-${index}`} colSpan={group.colSpan}>{group.label}</th>
          ))}
          <th className="matrix-total-col"></th>
        </tr>
        <tr>
          <th className="matrix-corretor-col">{renderSortButton({ key: 'corretor', label: 'Corretor' }, dailySort, handleDailySort)}</th>
          <th className="matrix-indicador-col">{renderSortButton({ key: 'indicador', label: 'Indicador' }, dailySort, handleDailySort)}</th>
          {dayColumns.map((day) => (
            <th key={day.data} className="matrix-day-col">
              {renderSortButton({ key: `day:${day.data}`, label: String(day.dia).padStart(2, '0') }, dailySort, handleDailySort)}
            </th>
          ))}
          <th className="matrix-total-col">{renderSortButton({ key: 'total', label: 'Total' }, dailySort, handleDailySort)}</th>
        </tr>
      </thead>
      <tbody>
        {dailyItems.length > 0 ? dailyItems.flatMap((broker) => {
          const indicadores = (Array.isArray(broker.indicadores) ? broker.indicadores : [])
            .filter((indicator) => !['pendente_comercial', 'pendente_credito'].includes(indicator?.key))
            .slice()
            .sort((a, b) => {
              if (dailySort.key !== 'indicador') return 0;
              const result = compareValues(a?.label, b?.label);
              return dailySort.order === 'asc' ? result : -result;
            });
          return indicadores.map((indicator, index) => (
            <tr key={`${broker.key || broker.corretor}-${indicator.key}`}>
              {index === 0 && (
                <td className="matrix-corretor-cell" rowSpan={Math.max(indicadores.length, 1)}>
                  <strong>{broker.corretor || 'Sem corretor'}</strong>
                  <span>{broker.equipe || 'Sem equipe'}</span>
                  <span>{broker.gerente || 'Sem gerente'} · {broker.coordenador || 'Sem coordenador'}</span>
                </td>
              )}
              <td className={`matrix-indicador-cell ${indicator.key === 'total' ? 'is-total' : ''}`}>
                {indicator.label}
              </td>
              {dayColumns.map((day) => (
                <td key={day.data} className="matrix-value-cell">
                  {renderDailyMetricCell(broker, indicator, day)}
                </td>
              ))}
              <td className="matrix-value-cell matrix-total-cell">
                {renderDailyTotalCell(broker, indicator)}
              </td>
            </tr>
          ));
        }) : (
          <tr>
            <td colSpan={dayColumns.length + 3} className="corretor-analytics-empty">
              {isLoading ? 'Carregando dados...' : 'Sem dados para o filtro selecionado.'}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderDetailPanel = () => {
    if (!detailContext && !detailError) return null;

    return (
      <aside className="corretor-detail-panel">
        <div className="corretor-detail-header">
          <div>
            <span className="label-md">Detalhamento</span>
            <h3>{detailContext?.indicatorLabel || detailPayload?.indicadorLabel || 'Indicador'}</h3>
            <p>
              {tabConfig.label}
              {' · '}
              {detailContext?.corretor || detailContext?.regiao || 'Recorte'}
              {detailContext?.data ? ` · ${formatDate(detailContext.data)}` : ''}
              {detailContext?.value ? ` · ${formatNumber(detailContext.value, 'integer')} registro(s)` : ''}
              {detailContext?.detailIndicatorKey && detailContext.detailIndicatorKey !== detailContext.indicatorKey ? ` · auditado como ${getIndicatorLabel(detailContext.detailIndicatorKey)}` : ''}
            </p>
          </div>
          <button type="button" className="corretor-detail-close" onClick={closeDetail} aria-label="Fechar detalhamento">
            <X size={15} />
          </button>
        </div>

        {isLoadingDetail && (
          <div className="corretor-detail-state">
            <RefreshCw size={14} />
            Carregando jornadas...
          </div>
        )}

        {detailError && !isLoadingDetail && (
          <div className="corretor-analytics-alert">{detailError}</div>
        )}

        {detailPayload && !isLoadingDetail && (
          <>
            <div className="corretor-detail-summary">
              <div>
                <span className="label-md">Registros no detalhe</span>
                <strong>{Number(detailPayload.pagination?.total ?? 0).toLocaleString('pt-BR')}</strong>
              </div>
              <div className={Number(detailPayload.pagination?.total ?? 0) === Number(detailContext?.value ?? 0) ? 'is-audit-ok' : 'is-audit-warning'}>
                <span className="label-md">Valor clicado</span>
                <strong>{Number(detailContext?.value ?? 0).toLocaleString('pt-BR')}</strong>
              </div>
              <div>
                <span className="label-md">Escopo</span>
                <strong>{detailPayload.meta?.audit?.scope || detailContext?.aba || 'corretores'}</strong>
              </div>
              <div>
                <span className="label-md">Fonte</span>
                <strong>{detailPayload.meta?.source || 'comercial_base'}</strong>
              </div>
              <div>
                <span className="label-md">Recorte</span>
                <strong>{detailContext?.data ? formatDate(detailContext.data) : `${formatDate(filters.dataInicial)} até ${formatDate(filters.dataFinal)}`}</strong>
              </div>
            </div>

            <div className="corretor-detail-scroll">
              {(detailPayload.items ?? []).length > 0 && (
                <>
                  <div className="corretor-detail-grain">
                    <span className="label-md">Grão do detalhamento</span>
                    <strong>{detailEntityLabel(detailPayload.meta?.audit?.detailEntity)}</strong>
                  </div>
                  <div className="corretor-detail-table-wrap">
                    <table className="corretor-detail-table">
                      <thead>
                        <tr>
                          {DETAIL_TABLE_COLUMNS.map((column) => (
                            <th key={column.key}>{column.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(detailPayload.items ?? []).map((item, index) => (
                          <tr key={`${item.detalhe_chave || item.fato_jornada_comercial_key || item.journey_key || index}`}>
                            {DETAIL_TABLE_COLUMNS.map((column) => (
                              <td key={column.key} className={column.className || ''} title={formatDetailTableValue(item, column)}>
                                {formatDetailTableValue(item, column)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {(detailPayload.items ?? []).slice(0, 1).map((item, index) => (
                    <details key={`context-${item.detalhe_chave || index}`} className="corretor-detail-context">
                      <summary>
                        <span>Expandir contexto da linha selecionada</span>
                        <strong>{item.situacao_nome_canonica || item.reserva_situacao_nome || item.precadastro_situacao_nome || item.lead_situacao_nome || '-'}</strong>
                      </summary>

                      <article className="corretor-detail-card">
                        <div className="corretor-detail-section">
                          <h4>Chaves e identificadores</h4>
                          <DetailGrid fields={DETAIL_FIELDS} item={item} />
                        </div>

                        <div className="corretor-detail-section">
                          <h4>Situações</h4>
                          <DetailGrid fields={SITUATION_DETAIL_FIELDS} item={item} />
                        </div>

                        <div className="corretor-detail-section">
                          <h4>Operação e hierarquia</h4>
                          <DetailGrid fields={COMMERCIAL_DETAIL_FIELDS} item={item} />
                        </div>

                        <div className="corretor-detail-section">
                          <h4>Datas importantes</h4>
                          <DetailGrid fields={DATE_DETAIL_FIELDS} item={item} />
                        </div>

                        <div className="corretor-detail-section">
                          <h4>Reserva e repasse</h4>
                          <DetailGrid fields={RESERVA_REPASSE_FIELDS} item={item} />
                        </div>

                        <div className="corretor-detail-section">
                          <h4>Identidade e rastreabilidade</h4>
                          <DetailGrid fields={[...BROKER_IDENTITY_FIELDS, ...SOURCE_DETAIL_FIELDS]} item={item} />
                        </div>
                      </article>
                    </details>
                  ))}
                </>
              )}
              {(detailPayload.items ?? []).length === 0 && (
                <div className="corretor-detail-state">Nenhuma jornada encontrada para esse indicador.</div>
              )}
            </div>
          </>
        )}
      </aside>
    );
  };

  return (
    <div className="corretor-analytics">
      <header className="corretor-analytics-header">
        <div className="corretor-analytics-title">
          <Link to="/" className="corretor-analytics-back" aria-label="Painel inicial">
            <LayoutDashboard size={15} />
            Painel inicial
          </Link>
          <div>
            <p className="label-md text-primary">Dashboard Comercial</p>
            <h2 className="headline-sm">Análise por Corretor</h2>
          </div>
        </div>
        <div className="corretor-analytics-period body-sm text-variant">
          {formatDate(filters.dataInicial)} até {formatDate(filters.dataFinal)}
        </div>
      </header>

      <DashboardFilters />

      <section className="corretor-analytics-toolbar">
        <div className="corretor-analytics-tabs" role="tablist" aria-label="Abas da análise por corretor">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`corretor-analytics-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="corretor-analytics-search">
          <Search size={15} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar corretor, equipe ou gestor"
          />
        </div>
      </section>

      {error && (
        <div className="corretor-analytics-alert">
          {error}
        </div>
      )}

      <div className={`corretor-analytics-workspace ${detailContext || detailError ? 'has-detail' : ''}`}>
        <section className="corretor-analytics-table-shell">
          <div className="corretor-analytics-table-header">
            <div>
              <UsersRound size={16} />
              <span>{activeTab === 'foguetes' ? 'Consolidado Foguetes' : tabConfig.label}</span>
            </div>
            <span className="corretor-analytics-table-note">
              Números clicáveis abrem o detalhamento no menor ID disponível
            </span>
            {isLoading && (
              <span className="corretor-analytics-loading">
                <RefreshCw size={14} />
                Atualizando
              </span>
            )}
          </div>

          <div className="corretor-analytics-table-scroll">
            {activeTab === 'diario' ? renderDiarioMatrix() : renderConsolidadoTable()}
          </div>

          <div className="corretor-analytics-pagination">
            <div className="body-sm text-variant">
              Página {currentPage} de {Math.max(totalPages, 1)}
            </div>
            <div className="corretor-analytics-page-size">
              <span className="label-md">Linhas</span>
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>
            <div className="corretor-analytics-page-actions">
              <button type="button" className="btn-secondary" disabled={currentPage <= 1 || isLoading} onClick={() => setPage((value) => Math.max(value - 1, 1))}>
                Anterior
              </button>
              <button type="button" className="btn-secondary" disabled={currentPage >= totalPages || totalPages <= 1 || isLoading} onClick={() => setPage((value) => value + 1)}>
                Próxima
              </button>
            </div>
          </div>
        </section>
        {renderDetailPanel()}
      </div>

      {renderFogueteInsights()}
    </div>
  );
};

export default CorretorAnalytics;
