const API_BASE_URL = '/api/v1';

export const fetchDashboardSummary = async () => {
  const response = await fetch(`${API_BASE_URL}/dashboard/summary`);
  if (!response.ok) throw new Error('Falha ao buscar resumo');
  return response.json();
};

export const fetchDashboardTrends = async () => {
  const response = await fetch(`${API_BASE_URL}/dashboard/trends`);
  if (!response.ok) throw new Error('Falha ao buscar tendências');
  return response.json();
};

export const fetchLeads = async ({ page = 1, limit = 100, filters = {}, status = 'todos' } = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    status,
    startDate: filters.dataInicial,
    endDate: filters.dataFinal,
    cidade: filters.cidade,
    corretor: filters.corretor,
    gerencia: filters.gerencia,
    coordenacao: filters.coordenacao,
    empreendimento: filters.empreendimento,
    empreendimentoReduzido: filters.empreendimentoReduzido,
    origem: filters.origem,
  });
  const response = await fetch(`${API_BASE_URL}/leads?${params.toString()}`);
  if (!response.ok) throw new Error('Falha ao buscar leads');
  return response.json();
};
