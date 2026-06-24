import { DBSQLClient } from '@databricks/sql';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const env = {
  catalog: process.env.DATABRICKS_CATALOG || 'data_platform_dev',
  schema: process.env.DATABRICKS_SCHEMA || 'gold_cvcrm',
  token: process.env.DATABRICKS_TOKEN,
  host: process.env.DATABRICKS_SERVER_HOSTNAME || process.env.DATABRICKS_HOST,
  path: process.env.DATABRICKS_HTTP_PATH || process.env.DATABRICKS_PATH,
  detailLimit: Number(process.env.VALIDATION_DETAIL_LIMIT || 1000),
  outDir: process.env.VALIDATION_OUTPUT_DIR || path.resolve(__dirname, '../reports'),
};

const EXPECTED_INDICATORS = [
  'VISITA',
  'AGENDAMENTOS',
  'PASTAS APROVADAS',
  'PASTAS CONDICIONADAS',
  'PASTAS REPROVADAS',
  'PASTAS COM RESPOSTAS',
  'PENDENTE COMERCIAL',
  'PENDENTE CREDITO',
  'VENDA FINALIZADA',
  'REPASSE',
  'CANCELAMENTOS',
  'DISTRATOS',
];

function assertEnv() {
  const missing = [];
  if (!env.token) missing.push('DATABRICKS_TOKEN');
  if (!env.host) missing.push('DATABRICKS_SERVER_HOSTNAME ou DATABRICKS_HOST');
  if (!env.path) missing.push('DATABRICKS_HTTP_PATH ou DATABRICKS_PATH');
  if (missing.length > 0) {
    throw new Error(`Variaveis obrigatorias ausentes no backend/.env: ${missing.join(', ')}`);
  }
}

function table(name) {
  return `${env.catalog}.${env.schema}.${name}`;
}

async function withDatabricksSession(fn) {
  assertEnv();
  const client = new DBSQLClient();
  const conn = await client.connect({
    token: env.token,
    host: env.host,
    path: env.path,
  });
  const session = await conn.openSession({
    initialCatalog: env.catalog,
    initialSchema: env.schema,
  });

  try {
    return await fn(session);
  } finally {
    await session.close().catch(() => {});
    await conn.close().catch(() => {});
  }
}

async function query(session, sql) {
  const op = await session.executeStatement(sql, { runAsync: true });
  try {
    return await op.fetchAll();
  } finally {
    await op.close().catch(() => {});
  }
}

function mdTable(rows, limit = 80) {
  if (!rows?.length) return '_Sem linhas._\n';
  const visible = rows.slice(0, limit);
  const columns = Object.keys(visible[0]);
  const header = `| ${columns.join(' | ')} |`;
  const separator = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = visible.map((row) => `| ${columns.map((column) => {
    const value = row[column] ?? '';
    return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
  }).join(' | ')} |`);
  const suffix = rows.length > limit ? `\n\n_Exibindo ${limit} de ${rows.length} linhas._\n` : '';
  return [header, separator, ...body].join('\n') + suffix + '\n';
}

function indicatorValuesSql() {
  return EXPECTED_INDICATORS.map((indicator) => `('${indicator}')`).join(',\n        ');
}

function baseCtes() {
  const realizado = table('vw_bi_realizado_diario_corretor_indicador');
  const comercial = table('vw_bi_comercial_base');
  const leads = table('vw_bi_leads_consolidada');
  const propostas = table('vw_bi_propostas_consolidada');
  const distratos = table('vw_bi_distratos');
  const dimCorretor = table('dim_corretor');
  const corretoresAtivos = table('corretores_ativos');

  return `
    WITH expected_indicators AS (
      SELECT indicador
      FROM VALUES
        ${indicatorValuesSql()}
      AS expected(indicador)
    ),
    validation_periods AS (
      WITH bounds AS (
        SELECT max(to_date(data)) AS max_data
        FROM ${realizado}
        WHERE indicador IN (SELECT indicador FROM expected_indicators)
      )
      SELECT 'DIA' AS periodo_tipo, max_data AS periodo_inicio, max_data AS periodo_fim FROM bounds WHERE max_data IS NOT NULL
      UNION ALL SELECT 'DIA_ANTERIOR', date_sub(max_data, 1), date_sub(max_data, 1) FROM bounds WHERE max_data IS NOT NULL
      UNION ALL SELECT 'SEMANA', cast(date_trunc('week', max_data) AS date), max_data FROM bounds WHERE max_data IS NOT NULL
      UNION ALL SELECT 'SEMANA_ANTERIOR', date_sub(cast(date_trunc('week', max_data) AS date), 7), date_sub(cast(date_trunc('week', max_data) AS date), 1) FROM bounds WHERE max_data IS NOT NULL
      UNION ALL SELECT 'MES_ATUAL', cast(date_trunc('month', max_data) AS date), max_data FROM bounds WHERE max_data IS NOT NULL
      UNION ALL SELECT 'MES_ANTERIOR', add_months(cast(date_trunc('month', max_data) AS date), -1), date_sub(cast(date_trunc('month', max_data) AS date), 1) FROM bounds WHERE max_data IS NOT NULL
      UNION ALL SELECT 'TRIMESTRE_ATUAL', cast(date_trunc('quarter', max_data) AS date), max_data FROM bounds WHERE max_data IS NOT NULL
      UNION ALL SELECT 'TRIMESTRE_ANTERIOR', add_months(cast(date_trunc('quarter', max_data) AS date), -3), date_sub(cast(date_trunc('quarter', max_data) AS date), 1) FROM bounds WHERE max_data IS NOT NULL
      UNION ALL SELECT 'ANO_ATUAL', cast(date_trunc('year', max_data) AS date), max_data FROM bounds WHERE max_data IS NOT NULL
      UNION ALL SELECT 'ANO_ANTERIOR', add_months(cast(date_trunc('year', max_data) AS date), -12), date_sub(cast(date_trunc('year', max_data) AS date), 1) FROM bounds WHERE max_data IS NOT NULL
    ),
    corretor_ref AS (
      SELECT *
      FROM (
        SELECT
          p.periodo_tipo,
          p.periodo_inicio,
          p.periodo_fim,
          cast(dc.idcorretor AS bigint) AS idcorretor_canonico,
          coalesce(ca.nome, dc.nome_corretor, cast(dc.idcorretor AS string)) AS corretor,
          ca.gestor,
          ca.coordenador,
          ca.regiao,
          ca.imobiliaria,
          CASE
            WHEN lower(coalesce(ca.ativo_negocio, '')) = 's'
             AND to_date(ca.mes_referencia) = cast(date_trunc('month', p.periodo_fim) AS date)
            THEN true ELSE false
          END AS fl_corretor_ativo,
          row_number() OVER (
            PARTITION BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim, dc.idcorretor
            ORDER BY
              CASE
                WHEN lower(coalesce(ca.ativo_negocio, '')) = 's'
                 AND to_date(ca.mes_referencia) = cast(date_trunc('month', p.periodo_fim) AS date)
                THEN 1 ELSE 0
              END DESC,
              to_date(ca.mes_referencia) DESC NULLS LAST,
              to_date(ca.data_inicio_vigencia) DESC NULLS LAST
          ) AS rn
        FROM validation_periods p
        JOIN ${dimCorretor} dc
          ON dc.idcorretor IS NOT NULL
        LEFT JOIN ${corretoresAtivos} ca
          ON lower(trim(ca.email)) = lower(trim(dc.email))
      )
      WHERE rn = 1
    ),
    visitas_unicas AS (
      SELECT
        idlead,
        cast(idcorretor_canonico AS bigint) AS idcorretor_canonico,
        data_visita
      FROM (
        SELECT
          b.idlead,
          b.idcorretor_canonico,
          to_date(b.dt_visita) AS data_visita,
          row_number() OVER (
            PARTITION BY b.idlead, to_date(b.dt_visita)
            ORDER BY
              greatest(
                coalesce(b.dt_referencia_lead, timestamp('1900-01-01 00:00:00')),
                coalesce(b.dt_referencia_precadastro, timestamp('1900-01-01 00:00:00')),
                coalesce(b.dt_referencia_reserva, timestamp('1900-01-01 00:00:00')),
                coalesce(b.dt_referencia_repasse, timestamp('1900-01-01 00:00:00'))
              ) DESC,
              greatest(
                coalesce(b.dt_ultima_alteracao_precadastro, timestamp('1900-01-01 00:00:00')),
                coalesce(b.dt_ultima_alteracao_lead, timestamp('1900-01-01 00:00:00')),
                coalesce(b.dt_ultima_referencia, timestamp('1900-01-01 00:00:00'))
              ) DESC,
              CASE
                WHEN b.dt_referencia_repasse = greatest(
                  coalesce(b.dt_referencia_lead, timestamp('1900-01-01 00:00:00')),
                  coalesce(b.dt_referencia_precadastro, timestamp('1900-01-01 00:00:00')),
                  coalesce(b.dt_referencia_reserva, timestamp('1900-01-01 00:00:00')),
                  coalesce(b.dt_referencia_repasse, timestamp('1900-01-01 00:00:00'))
                ) THEN 4
                WHEN b.dt_referencia_reserva = greatest(
                  coalesce(b.dt_referencia_lead, timestamp('1900-01-01 00:00:00')),
                  coalesce(b.dt_referencia_precadastro, timestamp('1900-01-01 00:00:00')),
                  coalesce(b.dt_referencia_reserva, timestamp('1900-01-01 00:00:00')),
                  coalesce(b.dt_referencia_repasse, timestamp('1900-01-01 00:00:00'))
                ) THEN 3
                WHEN b.dt_referencia_precadastro = greatest(
                  coalesce(b.dt_referencia_lead, timestamp('1900-01-01 00:00:00')),
                  coalesce(b.dt_referencia_precadastro, timestamp('1900-01-01 00:00:00')),
                  coalesce(b.dt_referencia_reserva, timestamp('1900-01-01 00:00:00')),
                  coalesce(b.dt_referencia_repasse, timestamp('1900-01-01 00:00:00'))
                ) THEN 2
                WHEN b.dt_referencia_lead = greatest(
                  coalesce(b.dt_referencia_lead, timestamp('1900-01-01 00:00:00')),
                  coalesce(b.dt_referencia_precadastro, timestamp('1900-01-01 00:00:00')),
                  coalesce(b.dt_referencia_reserva, timestamp('1900-01-01 00:00:00')),
                  coalesce(b.dt_referencia_repasse, timestamp('1900-01-01 00:00:00'))
                ) THEN 1
                ELSE 0
              END DESC,
              b.dt_ultima_referencia DESC NULLS LAST,
              b.journey_id DESC
          ) AS rn
        FROM ${comercial} b
        WHERE b.dt_visita IS NOT NULL
          AND b.idlead IS NOT NULL
      )
      WHERE rn = 1
    ),
    medida_pura AS (
      SELECT periodo_tipo, periodo_inicio, periodo_fim, 'VISITA' AS indicador, idcorretor_canonico, cast(sum(qtd_visitas) AS double) AS valor_medida_pura
      FROM (
        SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, vu.data_visita, vu.idcorretor_canonico, count(DISTINCT vu.idlead) AS qtd_visitas
        FROM validation_periods p JOIN visitas_unicas vu ON vu.data_visita BETWEEN p.periodo_inicio AND p.periodo_fim
        WHERE vu.idcorretor_canonico IS NOT NULL
        GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim, vu.data_visita, vu.idcorretor_canonico
      )
      GROUP BY periodo_tipo, periodo_inicio, periodo_fim, idcorretor_canonico
      UNION ALL
      SELECT periodo_tipo, periodo_inicio, periodo_fim, 'VISITA', cast(NULL AS bigint), cast(sum(qtd_visitas) AS double)
      FROM (
        SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, vu.data_visita, vu.idcorretor_canonico, count(DISTINCT vu.idlead) AS qtd_visitas
        FROM validation_periods p JOIN visitas_unicas vu ON vu.data_visita BETWEEN p.periodo_inicio AND p.periodo_fim
        GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim, vu.data_visita, vu.idcorretor_canonico
      )
      GROUP BY periodo_tipo, periodo_inicio, periodo_fim
      UNION ALL
      SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, 'AGENDAMENTOS', cast(l.idcorretor_canonico AS bigint), cast(count(DISTINCT l.idlead) AS double)
      FROM validation_periods p JOIN ${leads} l ON to_date(l.dt_ultimo_historico_data) BETWEEN p.periodo_inicio AND p.periodo_fim
      WHERE l.idcorretor_canonico IS NOT NULL
      GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim, l.idcorretor_canonico
      UNION ALL
      SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, 'AGENDAMENTOS', cast(NULL AS bigint), cast(count(DISTINCT l.idlead) AS double)
      FROM validation_periods p JOIN ${leads} l ON to_date(l.dt_ultimo_historico_data) BETWEEN p.periodo_inicio AND p.periodo_fim
      GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim
      UNION ALL
      SELECT periodo_tipo, periodo_inicio, periodo_fim, indicador, idcorretor_canonico, cast(count(DISTINCT idprecadastro) AS double)
      FROM (
        SELECT
          p.periodo_tipo, p.periodo_inicio, p.periodo_fim, cast(pc.idcorretor_canonico AS bigint) AS idcorretor_canonico, pc.idprecadastro,
          CASE
            WHEN pc.proposta_status_atual = 'APROVADA' THEN 'PASTAS APROVADAS'
            WHEN pc.proposta_status_atual = 'CONDICIONADA' THEN 'PASTAS CONDICIONADAS'
            WHEN pc.proposta_status_atual = 'REPROVADA' THEN 'PASTAS REPROVADAS'
            WHEN pc.proposta_status_atual = 'PENDENTE_COMERCIAL' THEN 'PENDENTE COMERCIAL'
            WHEN pc.proposta_status_atual = 'PENDENTE_CREDITO' THEN 'PENDENTE CREDITO'
          END AS indicador
        FROM validation_periods p
        JOIN ${propostas} pc ON to_date(pc.dt_ultimo_historico_data) BETWEEN p.periodo_inicio AND p.periodo_fim
        WHERE pc.proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA','PENDENTE_COMERCIAL','PENDENTE_CREDITO')
          AND pc.idcorretor_canonico IS NOT NULL
      )
      WHERE indicador IS NOT NULL
      GROUP BY periodo_tipo, periodo_inicio, periodo_fim, indicador, idcorretor_canonico
      UNION ALL
      SELECT periodo_tipo, periodo_inicio, periodo_fim, indicador, cast(NULL AS bigint), cast(count(DISTINCT idprecadastro) AS double)
      FROM (
        SELECT
          p.periodo_tipo, p.periodo_inicio, p.periodo_fim, pc.idprecadastro,
          CASE
            WHEN pc.proposta_status_atual = 'APROVADA' THEN 'PASTAS APROVADAS'
            WHEN pc.proposta_status_atual = 'CONDICIONADA' THEN 'PASTAS CONDICIONADAS'
            WHEN pc.proposta_status_atual = 'REPROVADA' THEN 'PASTAS REPROVADAS'
            WHEN pc.proposta_status_atual = 'PENDENTE_COMERCIAL' THEN 'PENDENTE COMERCIAL'
            WHEN pc.proposta_status_atual = 'PENDENTE_CREDITO' THEN 'PENDENTE CREDITO'
          END AS indicador
        FROM validation_periods p
        JOIN ${propostas} pc ON to_date(pc.dt_ultimo_historico_data) BETWEEN p.periodo_inicio AND p.periodo_fim
        WHERE pc.proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA','PENDENTE_COMERCIAL','PENDENTE_CREDITO')
      )
      WHERE indicador IS NOT NULL
      GROUP BY periodo_tipo, periodo_inicio, periodo_fim, indicador
      UNION ALL
      SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, 'PASTAS COM RESPOSTAS', cast(pc.idcorretor_canonico AS bigint), cast(count(DISTINCT pc.idprecadastro) AS double)
      FROM validation_periods p JOIN ${propostas} pc ON to_date(pc.dt_ultimo_historico_data) BETWEEN p.periodo_inicio AND p.periodo_fim
      WHERE pc.proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA')
        AND pc.idcorretor_canonico IS NOT NULL
      GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim, pc.idcorretor_canonico
      UNION ALL
      SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, 'PASTAS COM RESPOSTAS', cast(NULL AS bigint), cast(count(DISTINCT pc.idprecadastro) AS double)
      FROM validation_periods p JOIN ${propostas} pc ON to_date(pc.dt_ultimo_historico_data) BETWEEN p.periodo_inicio AND p.periodo_fim
      WHERE pc.proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA')
      GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim
      UNION ALL
      SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, 'VENDA FINALIZADA', cast(b.idcorretor_canonico AS bigint), cast(count(DISTINCT b.idreserva) AS double)
      FROM validation_periods p JOIN ${comercial} b ON to_date(b.data_venda_data) BETWEEN p.periodo_inicio AND p.periodo_fim
      WHERE b.idcorretor_canonico IS NOT NULL
      GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim, b.idcorretor_canonico
      UNION ALL
      SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, 'VENDA FINALIZADA', cast(NULL AS bigint), cast(count(DISTINCT b.idreserva) AS double)
      FROM validation_periods p JOIN ${comercial} b ON to_date(b.data_venda_data) BETWEEN p.periodo_inicio AND p.periodo_fim
      GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim
      UNION ALL
      SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, 'REPASSE', cast(b.idcorretor_canonico AS bigint), cast(count(DISTINCT b.idrepasse) AS double)
      FROM validation_periods p JOIN ${comercial} b ON to_date(b.dt_assinatura_contrato) BETWEEN p.periodo_inicio AND p.periodo_fim
      WHERE b.fl_repasse_assinado = true
        AND b.idcorretor_canonico IS NOT NULL
      GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim, b.idcorretor_canonico
      UNION ALL
      SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, 'REPASSE', cast(NULL AS bigint), cast(count(DISTINCT b.idrepasse) AS double)
      FROM validation_periods p JOIN ${comercial} b ON to_date(b.dt_assinatura_contrato) BETWEEN p.periodo_inicio AND p.periodo_fim
      WHERE b.fl_repasse_assinado = true
      GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim
      UNION ALL
      SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, 'CANCELAMENTOS', cast(b.idcorretor_canonico AS bigint), cast(count(DISTINCT b.idreserva) AS double)
      FROM validation_periods p JOIN ${comercial} b ON to_date(b.dt_cancelamento_reserva) BETWEEN p.periodo_inicio AND p.periodo_fim
      WHERE b.idcorretor_canonico IS NOT NULL
      GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim, b.idcorretor_canonico
      UNION ALL
      SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, 'CANCELAMENTOS', cast(NULL AS bigint), cast(count(DISTINCT b.idreserva) AS double)
      FROM validation_periods p JOIN ${comercial} b ON to_date(b.dt_cancelamento_reserva) BETWEEN p.periodo_inicio AND p.periodo_fim
      GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim
      UNION ALL
      SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, 'DISTRATOS', cast(d.idcorretor_canonico AS bigint), cast(count(DISTINCT d.idreserva) AS double)
      FROM validation_periods p JOIN ${distratos} d ON to_date(d.dt_referencia) BETWEEN p.periodo_inicio AND p.periodo_fim
      WHERE d.idcorretor_canonico IS NOT NULL
      GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim, d.idcorretor_canonico
      UNION ALL
      SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, 'DISTRATOS', cast(NULL AS bigint), cast(count(DISTINCT d.idreserva) AS double)
      FROM validation_periods p JOIN ${distratos} d ON to_date(d.dt_referencia) BETWEEN p.periodo_inicio AND p.periodo_fim
      GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim
    ),
    realizado_view AS (
      SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, v.indicador, cast(v.idcorretor_canonico AS bigint) AS idcorretor_canonico, cast(sum(v.realizado) AS double) AS valor_view_realizado
      FROM validation_periods p
      JOIN ${realizado} v ON to_date(v.data) BETWEEN p.periodo_inicio AND p.periodo_fim
      WHERE v.indicador IN (SELECT indicador FROM expected_indicators)
        AND v.idcorretor_canonico IS NOT NULL
      GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim, v.indicador, v.idcorretor_canonico
      UNION ALL
      SELECT p.periodo_tipo, p.periodo_inicio, p.periodo_fim, v.indicador, cast(NULL AS bigint), cast(sum(v.realizado) AS double)
      FROM validation_periods p
      JOIN ${realizado} v ON to_date(v.data) BETWEEN p.periodo_inicio AND p.periodo_fim
      WHERE v.indicador IN (SELECT indicador FROM expected_indicators)
      GROUP BY p.periodo_tipo, p.periodo_inicio, p.periodo_fim, v.indicador
    ),
    validacao_realizado AS (
      SELECT
        coalesce(mp.periodo_tipo, rv.periodo_tipo) AS periodo_tipo,
        coalesce(mp.periodo_inicio, rv.periodo_inicio) AS periodo_inicio,
        coalesce(mp.periodo_fim, rv.periodo_fim) AS periodo_fim,
        coalesce(mp.indicador, rv.indicador) AS indicador,
        coalesce(mp.idcorretor_canonico, rv.idcorretor_canonico) AS idcorretor_canonico,
        CASE WHEN coalesce(mp.idcorretor_canonico, rv.idcorretor_canonico) IS NULL THEN 'TOTAL GERAL' ELSE coalesce(cr.corretor, cast(coalesce(mp.idcorretor_canonico, rv.idcorretor_canonico) AS string)) END AS corretor,
        cr.gestor,
        cr.coordenador,
        cr.regiao,
        cr.imobiliaria,
        coalesce(cr.fl_corretor_ativo, false) AS fl_corretor_ativo,
        CASE
          WHEN coalesce(mp.idcorretor_canonico, rv.idcorretor_canonico) IS NULL THEN 'TOTAL_GERAL'
          WHEN coalesce(cr.fl_corretor_ativo, false) THEN 'CORRETORES_ATIVOS'
          ELSE 'FORA_CORRETORES_ATIVOS'
        END AS escopo_validacao,
        coalesce(mp.valor_medida_pura, 0) AS valor_medida_pura,
        coalesce(rv.valor_view_realizado, 0) AS valor_view_realizado,
        coalesce(rv.valor_view_realizado, 0) - coalesce(mp.valor_medida_pura, 0) AS delta,
        CASE WHEN coalesce(rv.valor_view_realizado, 0) - coalesce(mp.valor_medida_pura, 0) = 0 THEN 'OK' ELSE 'DIVERGENTE' END AS status_validacao
      FROM medida_pura mp
      FULL OUTER JOIN realizado_view rv
        ON rv.periodo_tipo = mp.periodo_tipo
       AND rv.periodo_inicio = mp.periodo_inicio
       AND rv.periodo_fim = mp.periodo_fim
       AND rv.indicador = mp.indicador
       AND rv.idcorretor_canonico <=> mp.idcorretor_canonico
      LEFT JOIN corretor_ref cr
        ON cr.periodo_tipo = coalesce(mp.periodo_tipo, rv.periodo_tipo)
       AND cr.periodo_inicio = coalesce(mp.periodo_inicio, rv.periodo_inicio)
       AND cr.periodo_fim = coalesce(mp.periodo_fim, rv.periodo_fim)
       AND cr.idcorretor_canonico = coalesce(mp.idcorretor_canonico, rv.idcorretor_canonico)
    )
  `;
}

function summarySql() {
  return `
    ${baseCtes()}
    SELECT
      periodo_tipo,
      periodo_inicio,
      periodo_fim,
      indicador,
      escopo_validacao,
      count(*) AS linhas_comparadas,
      sum(CASE WHEN status_validacao = 'OK' THEN 1 ELSE 0 END) AS linhas_ok,
      sum(CASE WHEN status_validacao <> 'OK' THEN 1 ELSE 0 END) AS linhas_divergentes,
      sum(abs(delta)) AS soma_abs_delta,
      sum(valor_medida_pura) AS total_medida_pura,
      sum(valor_view_realizado) AS total_view_realizado
    FROM validacao_realizado
    GROUP BY periodo_tipo, periodo_inicio, periodo_fim, indicador, escopo_validacao
    ORDER BY
      periodo_inicio,
      periodo_tipo,
      indicador,
      CASE escopo_validacao
        WHEN 'TOTAL_GERAL' THEN 1
        WHEN 'CORRETORES_ATIVOS' THEN 2
        ELSE 3
      END
  `;
}

function divergenciasSql(limit) {
  return `
    ${baseCtes()}
    SELECT *
    FROM validacao_realizado
    WHERE status_validacao <> 'OK'
    ORDER BY periodo_inicio, periodo_tipo, indicador, escopo_validacao, abs(delta) DESC, corretor
    LIMIT ${limit}
  `;
}

function nomenclaturaSql() {
  const realizado = table('vw_bi_realizado_diario_corretor_indicador');
  return `
    WITH expected_indicators AS (
      SELECT indicador
      FROM VALUES
        ${indicatorValuesSql()}
      AS expected(indicador)
    ),
    view_indicators AS (
      SELECT DISTINCT indicador
      FROM ${realizado}
      WHERE indicador IS NOT NULL
    )
    SELECT
      e.indicador AS indicador_esperado,
      CASE WHEN v.indicador IS NOT NULL THEN 'OK' ELSE 'NAO_ENCONTRADO_NA_VIEW' END AS status_nomenclatura
    FROM expected_indicators e
    LEFT JOIN view_indicators v
      ON v.indicador = e.indicador
    ORDER BY e.indicador
  `;
}

function sourceAuditSql() {
  return `
    ${baseCtes()}
    SELECT
      mp.periodo_tipo,
      mp.periodo_inicio,
      mp.periodo_fim,
      mp.indicador,
      CASE
        WHEN mp.idcorretor_canonico IS NULL THEN 'TOTAL_GERAL'
        WHEN cr.idcorretor_canonico IS NULL THEN 'SEM_DIM_CORRETOR'
        WHEN coalesce(cr.fl_corretor_ativo, false) THEN 'CORRETORES_ATIVOS'
        ELSE 'FORA_CORRETORES_ATIVOS'
      END AS escopo_fonte,
      count(*) AS linhas_corretor,
      sum(mp.valor_medida_pura) AS valor_medida_pura
    FROM medida_pura mp
    LEFT JOIN corretor_ref cr
      ON cr.periodo_tipo = mp.periodo_tipo
     AND cr.periodo_inicio = mp.periodo_inicio
     AND cr.periodo_fim = mp.periodo_fim
     AND cr.idcorretor_canonico = mp.idcorretor_canonico
    GROUP BY
      mp.periodo_tipo,
      mp.periodo_inicio,
      mp.periodo_fim,
      mp.indicador,
      CASE
        WHEN mp.idcorretor_canonico IS NULL THEN 'TOTAL_GERAL'
        WHEN cr.idcorretor_canonico IS NULL THEN 'SEM_DIM_CORRETOR'
        WHEN coalesce(cr.fl_corretor_ativo, false) THEN 'CORRETORES_ATIVOS'
        ELSE 'FORA_CORRETORES_ATIVOS'
      END
    ORDER BY
      periodo_inicio,
      periodo_tipo,
      indicador,
      CASE escopo_fonte
        WHEN 'TOTAL_GERAL' THEN 1
        WHEN 'CORRETORES_ATIVOS' THEN 2
        WHEN 'FORA_CORRETORES_ATIVOS' THEN 3
        ELSE 4
      END
  `;
}

function renderMarkdown(report) {
  return [
    '# Validacao BI - vw_bi_realizado_diario_corretor_indicador',
    '',
    `- Gerado em: \`${report.generatedAt}\``,
    `- Fonte: \`${report.source}\``,
    '- Escrita no Databricks: `nao`',
    '- Observacao: nomes de corretor, gestor, coordenador, regiao e imobiliaria usam `corretores_ativos` como referencia de apresentacao do BI, com apoio da `dim_corretor` para chave canonica.',
    '',
    '## Nomenclatura',
    mdTable(report.nomenclatura),
    '## Auditoria De Fonte',
    mdTable(report.sourceAudit),
    '## Resumo',
    mdTable(report.summary),
    '## Divergencias',
    mdTable(report.divergencias),
  ].join('\n');
}

async function writeReport(report) {
  await fs.mkdir(env.outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.resolve(env.outDir, `realizado-diario-validation-${stamp}.json`);
  const mdPath = path.resolve(env.outDir, `realizado-diario-validation-${stamp}.md`);
  const latestJsonPath = path.resolve(env.outDir, 'realizado-diario-validation-latest.json');
  const latestMdPath = path.resolve(env.outDir, 'realizado-diario-validation-latest.md');
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderMarkdown(report);

  await fs.writeFile(jsonPath, json, 'utf8');
  await fs.writeFile(mdPath, markdown, 'utf8');
  await fs.writeFile(latestJsonPath, json, 'utf8');
  await fs.writeFile(latestMdPath, markdown, 'utf8');

  return { jsonPath, mdPath, latestJsonPath, latestMdPath };
}

async function main() {
  const report = await withDatabricksSession(async (session) => ({
    generatedAt: new Date().toISOString(),
    mode: 'realizado-diario-bi',
    source: `${env.catalog}.${env.schema}`,
    nomenclatura: await query(session, nomenclaturaSql()),
    sourceAudit: await query(session, sourceAuditSql()),
    summary: await query(session, summarySql()),
    divergencias: await query(session, divergenciasSql(env.detailLimit)),
  }));

  const output = await writeReport(report);
  console.log(JSON.stringify({
    status: 'finished',
    mode: report.mode,
    report: output.jsonPath,
    markdown: output.mdPath,
    latestJson: output.latestJsonPath,
    latestMarkdown: output.latestMdPath,
    divergencias: report.divergencias.length,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
