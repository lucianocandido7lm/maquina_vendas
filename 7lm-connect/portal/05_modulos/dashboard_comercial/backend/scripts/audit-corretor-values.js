import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

dotenv.config({ path: '/opt/7lm-connect/portal/.env', quiet: true });

const TARGET_SCHEMA = process.env.SEVENLM_CONNECT_COMERCIAL_SCHEMA || 'connect_comercial';
const CONNECT_SCHEMA = process.env.SEVENLM_CONNECT_SCHEMA || 'sevenlm_connect';

const assertIdentifier = (value, label) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Identificador invalido para ${label}`);
  }
  return value;
};

const quoteIdent = (value) => `"${assertIdentifier(value, 'schema').replaceAll('"', '""')}"`;
const qualify = (schema, table) => `${quoteIdent(schema)}.${quoteIdent(table)}`;

const pgConfig = () => ({
  user: process.env.SEVENLM_CONNECT_DBUSER,
  host: process.env.SEVENLM_CONNECT_DBHOST || '127.0.0.1',
  database: process.env.SEVENLM_CONNECT_DBNAME,
  password: process.env.SEVENLM_CONNECT_DBPASS,
  port: Number(process.env.SEVENLM_CONNECT_DBPORT || 5432),
  application_name: 'codex_audit_corretor_values',
});

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || ''];
  }),
);

const startDate = args.get('start') || '2026-06-01';
const endDate = args.get('end') || '2026-06-30';

const metrics = [
  ['leads', 'LEADS'],
  ['visitas', 'VISITA'],
  ['agendamentos', 'AGENDAMENTOS'],
  ['propostas_aprovadas', 'PASTAS APROVADAS'],
  ['propostas_condicionadas', 'PASTAS CONDICIONADAS'],
  ['propostas_reprovadas', 'PASTAS REPROVADAS'],
  ['propostas_total', 'PASTAS COM RESPOSTAS'],
  ['vendas', 'VENDA'],
  ['repasses', 'REPASSE'],
  ['cancelamentos', 'CANCELAMENTOS'],
  ['distratos', 'DISTRATOS'],
];

async function main() {
  const pool = new Pool(pgConfig());
  const client = await pool.connect();

  try {
    const comercialBase = qualify(TARGET_SCHEMA, 'comercial_base');
    const kpiDaily = qualify(TARGET_SCHEMA, 'comercial_kpi_daily');
    const leadsHistorico = qualify(TARGET_SCHEMA, 'comercial_leads_historico');
    const propostasConsolidada = qualify(TARGET_SCHEMA, 'comercial_propostas_consolidada');
    const distratos = qualify(TARGET_SCHEMA, 'comercial_distratos');
    const dimCorretor = qualify(TARGET_SCHEMA, 'dim_corretor');
    const funcionario = qualify(CONNECT_SCHEMA, 'funcionario_acesso');

    const tableState = await client.query(
      `
      select
        to_regclass($1)::text as comercial_base,
        to_regclass($2)::text as comercial_kpi_daily,
        to_regclass($3)::text as comercial_leads_historico,
        to_regclass($4)::text as dim_corretor,
        to_regclass($5)::text as funcionario_acesso
      `,
      [
        `${TARGET_SCHEMA}.comercial_base`,
        `${TARGET_SCHEMA}.comercial_kpi_daily`,
        `${TARGET_SCHEMA}.comercial_leads_historico`,
        `${TARGET_SCHEMA}.dim_corretor`,
        `${CONNECT_SCHEMA}.funcionario_acesso`,
      ],
    );

    const kpiTotals = await client.query(
      `
      select
        coalesce(sum(leads), 0)::bigint as leads,
        coalesce(sum(agendamentos), 0)::bigint as agendamentos,
        coalesce(sum(visitas), 0)::bigint as visitas,
        coalesce(sum(propostas_aprovadas), 0)::bigint as propostas_aprovadas,
        coalesce(sum(propostas_condicionadas), 0)::bigint as propostas_condicionadas,
        coalesce(sum(propostas_reprovadas), 0)::bigint as propostas_reprovadas,
        coalesce(sum(propostas_total), 0)::bigint as propostas_total,
        coalesce(sum(vendas), 0)::bigint as vendas,
        coalesce(sum(repasses), 0)::bigint as repasses,
        coalesce(sum(cancelamentos), 0)::bigint as cancelamentos,
        coalesce(sum(distratos), 0)::bigint as distratos
      from ${kpiDaily}
      where data >= $1::date
        and data < ($2::date + interval '1 day')
      `,
      [startDate, endDate],
    );

    const detailTotals = await client.query(
      `
      with detail_metrics as (
        select 'leads' as metric, count(distinct coalesce(idlead::text, journey_id, journey_key, fato_jornada_comercial_key))::bigint as total
        from ${comercialBase}
        where dt_ultima_conversao_lead >= $1::date and dt_ultima_conversao_lead < ($2::date + interval '1 day')
        union all
        select 'visitas', count(distinct coalesce(idlead::text, journey_id, journey_key, fato_jornada_comercial_key))::bigint
        from ${comercialBase}
        where dt_visita_realizada >= $1::date and dt_visita_realizada < ($2::date + interval '1 day')
        union all
        select 'agendamentos', count(*)::bigint
        from (
          select distinct on (
            dt_referencia,
            idlead,
            coalesce(nullif(idcorretor_atual::text, ''), journey_id, 'sem-corretor')
          )
            dt_referencia,
            idlead,
            idcorretor_atual,
            journey_id
          from ${leadsHistorico}
          where dt_referencia >= $1::date
            and dt_referencia < ($2::date + interval '1 day')
            and idlead is not null
            and agendamento_status_grupo in ('AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
          order by
            dt_referencia,
            idlead,
            coalesce(nullif(idcorretor_atual::text, ''), journey_id, 'sem-corretor'),
            historico_status_key
        ) agendamentos_deduplicados
        union all
        select 'propostas_total', count(distinct coalesce(idprecadastro::text, journey_id))::bigint
        from ${propostasConsolidada}
        where dt_ultimo_historico_data >= $1::date and dt_ultimo_historico_data < ($2::date + interval '1 day')
          and proposta_status_atual in ('APROVADA','CONDICIONADA','REPROVADA')
        union all
        select 'propostas_aprovadas', count(distinct coalesce(idprecadastro::text, journey_id))::bigint
        from ${propostasConsolidada}
        where dt_ultimo_historico_data >= $1::date and dt_ultimo_historico_data < ($2::date + interval '1 day')
          and proposta_status_atual = 'APROVADA'
        union all
        select 'propostas_condicionadas', count(distinct coalesce(idprecadastro::text, journey_id))::bigint
        from ${propostasConsolidada}
        where dt_ultimo_historico_data >= $1::date and dt_ultimo_historico_data < ($2::date + interval '1 day')
          and proposta_status_atual = 'CONDICIONADA'
        union all
        select 'propostas_reprovadas', count(distinct coalesce(idprecadastro::text, journey_id))::bigint
        from ${propostasConsolidada}
        where dt_ultimo_historico_data >= $1::date and dt_ultimo_historico_data < ($2::date + interval '1 day')
          and proposta_status_atual = 'REPROVADA'
        union all
        select 'vendas', count(distinct coalesce(idreserva::text, journey_id, journey_key, fato_jornada_comercial_key))::bigint
        from ${comercialBase}
        where data_venda >= $1::date and data_venda < ($2::date + interval '1 day')
        union all
        select 'repasses', count(distinct coalesce(idrepasse::text, idreserva::text, journey_id, journey_key, fato_jornada_comercial_key))::bigint
        from ${comercialBase}
        where dt_assinatura_contrato >= $1::date and dt_assinatura_contrato < ($2::date + interval '1 day')
        union all
        select 'cancelamentos', count(distinct coalesce(idreserva::text, journey_id, journey_key, fato_jornada_comercial_key))::bigint
        from ${comercialBase}
        where dt_cancelamento_reserva >= $1::date and dt_cancelamento_reserva < ($2::date + interval '1 day')
        union all
        select 'distratos', count(distinct coalesce(idreserva::text, idrepasse::text, idprecadastro::text, idlead::text, journey_id))::bigint
        from ${distratos}
        where referencia_data >= $1::date and referencia_data < ($2::date + interval '1 day')
      )
      select metric, total
      from detail_metrics
      order by metric
      `,
      [startDate, endDate],
    );

    const linkage = await client.query(
      `
      with fato_corretor as (
        select distinct
          coalesce(idcorretor_canonico, idcorretor_atual)::text as idcorretor_text,
          regexp_replace(
            regexp_replace(
              lower(trim(coalesce(nullif(corretor_nome_canonico, ''), nullif(corretor_nome, ''), 'Sem corretor'))),
              '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$',
              '',
              'i'
            ),
            '\\s+',
            ' ',
            'g'
          ) as nome_match
        from ${comercialBase}
        where (
          dt_ultima_conversao_lead >= $1::date and dt_ultima_conversao_lead < ($2::date + interval '1 day')
          or dt_visita_realizada >= $1::date and dt_visita_realizada < ($2::date + interval '1 day')
          or dt_resposta_analise_precadastro >= $1::date and dt_resposta_analise_precadastro < ($2::date + interval '1 day')
          or dt_contrato_contabilizado >= $1::date and dt_contrato_contabilizado < ($2::date + interval '1 day')
          or data_venda >= $1::date and data_venda < ($2::date + interval '1 day')
          or dt_assinatura_contrato >= $1::date and dt_assinatura_contrato < ($2::date + interval '1 day')
          or dt_cancelamento_reserva >= $1::date and dt_cancelamento_reserva < ($2::date + interval '1 day')
        )
      ),
      funcionarios as (
        select distinct
          lower(trim(email::text)) as email_norm,
          regexp_replace(
            regexp_replace(
              lower(trim(coalesce(nome, ''))),
              '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$',
              '',
              'i'
            ),
            '\\s+',
            ' ',
            'g'
          ) as nome_match
        from ${funcionario}
        where upper(trim(coalesce(tipo_funcionario, ''))) = 'CORRETOR'
      ),
      dim as (
        select distinct
          idcorretor::text as idcorretor_text,
          lower(trim(email::text)) as email_norm
        from ${dimCorretor}
        where idcorretor is not null
      )
      select
        count(*)::bigint as corretores_distintos_fato,
        count(*) filter (where d.idcorretor_text is not null)::bigint as com_dim_corretor,
        count(*) filter (where d.email_norm is not null and f_email.email_norm is not null)::bigint as com_funcionario_por_email_dim,
        count(*) filter (where f_nome.nome_match is not null)::bigint as com_funcionario_por_nome,
        count(*) filter (where d.idcorretor_text is null and f_nome.nome_match is null)::bigint as sem_dim_e_sem_nome_funcionario
      from fato_corretor fc
      left join dim d on d.idcorretor_text = fc.idcorretor_text
      left join funcionarios f_email on f_email.email_norm = d.email_norm
      left join funcionarios f_nome on f_nome.nome_match = fc.nome_match
      `,
      [startDate, endDate],
    );

    const duplicates = await client.query(
      `
      with funcionarios as (
        select
          lower(trim(email::text)) as email_norm,
          regexp_replace(
            regexp_replace(lower(trim(coalesce(nome, ''))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'),
            '\\s+',
            ' ',
            'g'
          ) as nome_match,
          identificador_funcionario
        from ${funcionario}
        where upper(trim(coalesce(tipo_funcionario, ''))) = 'CORRETOR'
      )
      select
        count(*) filter (where email_norm is not null and email_norm <> '')::bigint as corretores_com_email,
        count(*) filter (where nome_match is not null and nome_match <> '')::bigint as corretores_com_nome,
        count(*) filter (where email_norm in (
          select email_norm from funcionarios where email_norm is not null and email_norm <> '' group by email_norm having count(*) > 1
        ))::bigint as linhas_email_duplicado,
        count(*) filter (where nome_match in (
          select nome_match from funcionarios where nome_match is not null and nome_match <> '' group by nome_match having count(*) > 1
        ))::bigint as linhas_nome_duplicado
      from funcionarios
      `,
    );

    const kpi = kpiTotals.rows[0] || {};
    const detailMap = Object.fromEntries(detailTotals.rows.map((row) => [row.metric, row.total]));
    const comparisons = metrics.map(([key, label]) => ({
      key,
      label,
      kpi_total: Number(kpi[key] || 0),
      detalhe_total: Number(detailMap[key] || 0),
      diferenca: Number(detailMap[key] || 0) - Number(kpi[key] || 0),
    }));

    console.log(JSON.stringify({
      periodo: { startDate, endDate },
      tabelas: tableState.rows[0],
      comparacoes: comparisons,
      vinculo_corretor: linkage.rows[0],
      duplicidades_funcionario: duplicates.rows[0],
    }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
