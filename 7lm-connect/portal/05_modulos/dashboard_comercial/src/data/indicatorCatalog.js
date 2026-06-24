const BASE_INDICATORS = {
  leads: { id: 'leads', title: 'Leads', description: 'Volume de leads no recorte atual.' },
  visitas: { id: 'visitas', title: 'Visitas', description: 'Visitas realizadas no recorte atual.' },
  propostas: { id: 'propostas', title: 'Prop. Aprovada / Condicionada', description: 'Analises aprovadas ou condicionadas pela data de resposta.' },
  cancelamentos: { id: 'cancelamentos', title: 'Cancelamentos', description: 'Reservas canceladas no periodo.' },
  vendas: { id: 'vendas', title: 'Vendas', description: 'Reservas iniciadas pela data de reserva.' },
  distratos: { id: 'distratos', title: 'Distratos', description: 'Eventos de distrato por data de referencia.' },
  repasses: { id: 'repasses', title: 'Repasses', description: 'Repasses por assinatura de contrato.' },
  sla_f: { id: 'sla_f', title: 'SLA Finalizacao', description: 'Dias entre cadastro da reserva e contrato contabilizado.' },
  sla_r: { id: 'sla_r', title: 'SLA Repasse', description: 'Dias entre contrato contabilizado e assinatura.' },
  ipc: { id: 'ipc', title: 'IPC', description: 'Repasses assinados por corretor ativo no periodo.' },
};

const ALIASES = {
  'vendas-finalizadas': 'vendas',
  'sla-finalizacao': 'sla_f',
  'sla-repasse': 'sla_r',
};

export const getIndicatorById = (indicatorId) => {
  const resolved = ALIASES[indicatorId] || indicatorId;
  return BASE_INDICATORS[resolved];
};
