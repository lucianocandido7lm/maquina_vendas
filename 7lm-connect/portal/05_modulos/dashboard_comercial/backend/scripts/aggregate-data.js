import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function aggregateData() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    console.log('🧱 Atualizando tabela pre-agregada comercial_kpi_daily...');
    await client.query('BEGIN');

    await client.query('TRUNCATE TABLE comercial_kpi_daily;');

    await client.query(`
      INSERT INTO comercial_kpi_daily (
        data, cidade, origem, empreendimento, empreendimento_reduzido, sdr,
        corretor, gerencia, coordenacao, imobiliaria,
        leads, visitas, vendas, repasses,
        sla_finalizacao_sum, sla_finalizacao_count,
        sla_repasse_sum, sla_repasse_count,
        propostas_aprovadas, propostas_condicionadas, propostas_reprovadas, propostas_total,
        cancelamentos, distratos
      )
      WITH base_dim AS (
        SELECT
          b.idlead,
          b.idprecadastro,
          b.idreserva,
          b.idrepasse,
          b.dt_ultima_conversao_lead AS dt_lead,
          b.dt_visita_realizada AS dt_visita,
          b.data_venda,
          b.dt_assinatura_contrato AS dt_repasse,
          b.dt_contrato_contabilizado,
          b.sla_finalizacao_dias,
          b.sla_repasse_dias,
          b.fl_repasse_assinado,
          COALESCE(NULLIF(TRIM(d.cidade), ''), b.lead_cidade) AS cidade,
          b.lead_origem_nome AS origem,
          COALESCE(NULLIF(TRIM(d.empreendimento), ''), b.empreendimento_nome) AS empreendimento,
          COALESCE(
            NULLIF(TRIM(d.regiao), ''),
            NULLIF(b.regiao_empreendimento, ''),
            CASE
              WHEN UPPER(TRIM(COALESCE(b.empreendimento_nome, ''))) LIKE 'RETOMADOS%' THEN 'Retomados'
              ELSE NULLIF(SUBSTRING(TRIM(SPLIT_PART(COALESCE(b.empreendimento_nome, ''), '-', 1)) FROM '^[A-Za-z]+'), '')
            END
          ) AS empreendimento_reduzido,
          b.sdr_nome AS sdr,
          b.corretor_nome
        FROM comercial_base b
        LEFT JOIN LATERAL (
          SELECT cidade, empreendimento, regiao
          FROM public.dim_empreendimento d
          WHERE d.idempreendimento = COALESCE(b.idempreendimento_canonico, b.idempreendimento)
          LIMIT 1
        ) d ON TRUE
      ),
      leads_visitas_vendas_repasses AS (
        SELECT
          x.data,
          x.cidade, x.origem, x.empreendimento, x.empreendimento_reduzido, x.sdr,
          x.corretor_nome AS corretor, x.gerencia, x.coordenacao, x.imobiliaria,
          SUM(x.leads) AS leads,
          SUM(x.visitas) AS visitas,
          SUM(x.vendas) AS vendas,
          SUM(x.repasses) AS repasses,
          SUM(x.sla_f_sum) AS sla_f_sum,
          SUM(x.sla_f_count) AS sla_f_count,
          SUM(x.sla_r_sum) AS sla_r_sum,
          SUM(x.sla_r_count) AS sla_r_count
        FROM (
          SELECT bd.dt_lead::date AS data, bd.cidade, bd.origem, bd.empreendimento, bd.empreendimento_reduzido, bd.sdr, bd.corretor_nome,
                 h.gerencia, h.coordenacao, h.imobiliaria,
                 COUNT(DISTINCT idlead) FILTER (WHERE idlead IS NOT NULL) AS leads,
                 0::int AS visitas, 0::int AS vendas, 0::int AS repasses,
                 0::numeric AS sla_f_sum, 0::int AS sla_f_count,
                 0::numeric AS sla_r_sum, 0::int AS sla_r_count
          FROM base_dim bd
          LEFT JOIN LATERAL (
            SELECT
              h.gestor_corretor AS gerencia,
              h.coordenador_corretor AS coordenacao,
              h.imobiliaria_corretor AS imobiliaria
            FROM public.vw_hierarquia_cvcrm h
            WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
              AND h.mes_referencia = DATE_TRUNC('month', bd.dt_lead)::date
              AND LOWER(TRIM(COALESCE(h.corretor_ativo_nome, h.nome))) = LOWER(TRIM(COALESCE(bd.corretor_nome, '')))
            ORDER BY h.corretor_ativo_mes_key NULLS LAST
            LIMIT 1
          ) h ON TRUE
          WHERE bd.dt_lead IS NOT NULL
          GROUP BY 1,2,3,4,5,6,7,8,9,10

          UNION ALL
          SELECT data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor_nome, gerencia, coordenacao, imobiliaria,
                 0, COUNT(*), 0, 0, 0, 0, 0, 0
          FROM (
            SELECT DISTINCT ON (dt_visita::date, idlead)
              dt_visita::date AS data,
              idlead,
              bd.cidade, bd.origem, bd.empreendimento, bd.empreendimento_reduzido, bd.sdr,
              bd.corretor_nome,
              h.gerencia,
              h.coordenacao,
              h.imobiliaria
            FROM base_dim bd
            LEFT JOIN LATERAL (
              SELECT
                h.gestor_corretor AS gerencia,
                h.coordenador_corretor AS coordenacao,
                h.imobiliaria_corretor AS imobiliaria
              FROM public.vw_hierarquia_cvcrm h
              WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
                AND h.mes_referencia = DATE_TRUNC('month', bd.dt_visita)::date
                AND LOWER(TRIM(COALESCE(h.corretor_ativo_nome, h.nome))) = LOWER(TRIM(COALESCE(bd.corretor_nome, '')))
              ORDER BY h.corretor_ativo_mes_key NULLS LAST
              LIMIT 1
            ) h ON TRUE
            WHERE dt_visita IS NOT NULL
              AND idlead IS NOT NULL
            ORDER BY dt_visita::date, idlead, idprecadastro NULLS LAST, idreserva NULLS LAST
          ) visitas_dedup
          GROUP BY 1,2,3,4,5,6,7,8,9,10

          UNION ALL
           SELECT bd.data_venda::date, bd.cidade, bd.origem, bd.empreendimento, bd.empreendimento_reduzido, bd.sdr, bd.corretor_nome,
                 h.gerencia, h.coordenacao, h.imobiliaria,
                 0, 0, COUNT(DISTINCT idreserva), 0, 0, 0, 0, 0
           FROM base_dim bd
           LEFT JOIN LATERAL (
             SELECT
               h.gestor_corretor AS gerencia,
               h.coordenador_corretor AS coordenacao,
               h.imobiliaria_corretor AS imobiliaria
             FROM public.vw_hierarquia_cvcrm h
             WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
               AND h.mes_referencia = DATE_TRUNC('month', bd.data_venda)::date
               AND LOWER(TRIM(COALESCE(h.corretor_ativo_nome, h.nome))) = LOWER(TRIM(COALESCE(bd.corretor_nome, '')))
             ORDER BY h.corretor_ativo_mes_key NULLS LAST
             LIMIT 1
           ) h ON TRUE
           WHERE bd.data_venda IS NOT NULL
           GROUP BY 1,2,3,4,5,6,7,8,9,10

          UNION ALL
          SELECT bd.dt_repasse::date, bd.cidade, bd.origem, bd.empreendimento, bd.empreendimento_reduzido, bd.sdr, bd.corretor_nome,
                 h.gerencia, h.coordenacao, h.imobiliaria,
                 0, 0, 0, COUNT(DISTINCT idrepasse) FILTER (WHERE fl_repasse_assinado = true),
                 0, 0,
                 COALESCE(SUM(sla_repasse_dias), 0), COUNT(*) FILTER (WHERE sla_repasse_dias IS NOT NULL)
          FROM base_dim bd
          LEFT JOIN LATERAL (
            SELECT
              h.gestor_corretor AS gerencia,
              h.coordenador_corretor AS coordenacao,
              h.imobiliaria_corretor AS imobiliaria
            FROM public.vw_hierarquia_cvcrm h
            WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
              AND h.mes_referencia = DATE_TRUNC('month', bd.dt_repasse)::date
              AND LOWER(TRIM(COALESCE(h.corretor_ativo_nome, h.nome))) = LOWER(TRIM(COALESCE(bd.corretor_nome, '')))
            ORDER BY h.corretor_ativo_mes_key NULLS LAST
            LIMIT 1
          ) h ON TRUE
          WHERE bd.dt_repasse IS NOT NULL
          GROUP BY 1,2,3,4,5,6,7,8,9,10

          UNION ALL
          SELECT bd.dt_contrato_contabilizado::date, bd.cidade, bd.origem, bd.empreendimento, bd.empreendimento_reduzido, bd.sdr, bd.corretor_nome,
                 h.gerencia, h.coordenacao, h.imobiliaria,
                 0, 0, 0, 0,
                 COALESCE(SUM(sla_finalizacao_dias), 0), COUNT(*) FILTER (WHERE sla_finalizacao_dias IS NOT NULL),
                 0, 0
          FROM base_dim bd
          LEFT JOIN LATERAL (
            SELECT
              h.gestor_corretor AS gerencia,
              h.coordenador_corretor AS coordenacao,
              h.imobiliaria_corretor AS imobiliaria
            FROM public.vw_hierarquia_cvcrm h
            WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
              AND h.mes_referencia = DATE_TRUNC('month', bd.dt_contrato_contabilizado)::date
              AND LOWER(TRIM(COALESCE(h.corretor_ativo_nome, h.nome))) = LOWER(TRIM(COALESCE(bd.corretor_nome, '')))
            ORDER BY h.corretor_ativo_mes_key NULLS LAST
            LIMIT 1
          ) h ON TRUE
          WHERE bd.dt_contrato_contabilizado IS NOT NULL
          GROUP BY 1,2,3,4,5,6,7,8,9,10
        ) x
        GROUP BY 1,2,3,4,5,6,7,8,9,10
      ),
      propostas AS (
        SELECT
          pc.dt_ultimo_historico_data AS data,
          COALESCE(NULLIF(TRIM(d.cidade), ''), b.lead_cidade) AS cidade,
          b.lead_origem_nome AS origem,
          COALESCE(NULLIF(TRIM(d.empreendimento), ''), b.empreendimento_nome) AS empreendimento,
          COALESCE(
            NULLIF(TRIM(d.regiao), ''),
            NULLIF(b.regiao_empreendimento, ''),
            CASE
              WHEN UPPER(TRIM(COALESCE(b.empreendimento_nome, ''))) LIKE 'RETOMADOS%' THEN 'Retomados'
              ELSE NULLIF(SUBSTRING(TRIM(SPLIT_PART(COALESCE(b.empreendimento_nome, ''), '-', 1)) FROM '^[A-Za-z]+'), '')
            END
          ) AS empreendimento_reduzido,
          b.sdr_nome AS sdr,
          b.corretor_nome AS corretor,
          h.gerencia,
          h.coordenacao,
          h.imobiliaria,
          COUNT(DISTINCT pc.idprecadastro) FILTER (WHERE pc.proposta_status_atual = 'APROVADA') AS propostas_aprovadas,
          COUNT(DISTINCT pc.idprecadastro) FILTER (WHERE pc.proposta_status_atual = 'CONDICIONADA') AS propostas_condicionadas,
          COUNT(DISTINCT pc.idprecadastro) FILTER (WHERE pc.proposta_status_atual = 'REPROVADA') AS propostas_reprovadas,
          COUNT(DISTINCT pc.idprecadastro) FILTER (WHERE pc.proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA')) AS propostas_total
        FROM comercial_propostas_consolidada pc
        JOIN comercial_base b ON b.idprecadastro = pc.idprecadastro
        LEFT JOIN LATERAL (
          SELECT cidade, empreendimento, regiao
          FROM public.dim_empreendimento d
          WHERE d.idempreendimento = COALESCE(b.idempreendimento_canonico, b.idempreendimento)
          LIMIT 1
        ) d ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            h.gestor_corretor AS gerencia,
            h.coordenador_corretor AS coordenacao,
            h.imobiliaria_corretor AS imobiliaria
          FROM public.vw_hierarquia_cvcrm h
          WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
            AND h.mes_referencia = DATE_TRUNC('month', pc.dt_ultimo_historico_data)::date
            AND LOWER(TRIM(COALESCE(h.corretor_ativo_nome, h.nome))) = LOWER(TRIM(COALESCE(b.corretor_nome, '')))
          ORDER BY h.corretor_ativo_mes_key NULLS LAST
          LIMIT 1
        ) h ON TRUE
        WHERE pc.dt_ultimo_historico_data IS NOT NULL
        GROUP BY 1,2,3,4,5,6,7,8,9,10
      ),
      cancelamentos AS (
        SELECT
          cc.data_cancelamento::date AS data,
          COALESCE(NULLIF(TRIM(d.cidade), ''), b.lead_cidade) AS cidade,
          b.lead_origem_nome AS origem,
          COALESCE(NULLIF(TRIM(d.empreendimento), ''), b.empreendimento_nome) AS empreendimento,
          COALESCE(
            NULLIF(TRIM(d.regiao), ''),
            NULLIF(b.regiao_empreendimento, ''),
            CASE
              WHEN UPPER(TRIM(COALESCE(b.empreendimento_nome, ''))) LIKE 'RETOMADOS%' THEN 'Retomados'
              ELSE NULLIF(SUBSTRING(TRIM(SPLIT_PART(COALESCE(b.empreendimento_nome, ''), '-', 1)) FROM '^[A-Za-z]+'), '')
            END
          ) AS empreendimento_reduzido,
          b.sdr_nome AS sdr,
          b.corretor_nome AS corretor,
          h.gerencia,
          h.coordenacao,
          h.imobiliaria,
           COUNT(DISTINCT cc.idreserva) AS cancelamentos
        FROM comercial_cancelamentos cc
        LEFT JOIN LATERAL (
          SELECT *
          FROM comercial_base b
          WHERE (b.idreserva IS NOT NULL AND b.idreserva = cc.idreserva)
             OR (b.idlead IS NOT NULL AND b.idlead = cc.idlead)
             OR (b.idprecadastro IS NOT NULL AND b.idprecadastro = cc.idprecadastro)
          LIMIT 1
        ) b ON TRUE
        LEFT JOIN LATERAL (
          SELECT cidade, empreendimento, regiao
          FROM public.dim_empreendimento d
          WHERE d.idempreendimento = COALESCE(b.idempreendimento_canonico, b.idempreendimento)
          LIMIT 1
        ) d ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            h.gestor_corretor AS gerencia,
            h.coordenador_corretor AS coordenacao,
            h.imobiliaria_corretor AS imobiliaria
          FROM public.vw_hierarquia_cvcrm h
          WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
            AND h.mes_referencia = DATE_TRUNC('month', cc.data_cancelamento)::date
            AND LOWER(TRIM(COALESCE(h.corretor_ativo_nome, h.nome))) = LOWER(TRIM(COALESCE(b.corretor_nome, '')))
          ORDER BY h.corretor_ativo_mes_key NULLS LAST
          LIMIT 1
        ) h ON TRUE
        WHERE cc.data_cancelamento IS NOT NULL
        GROUP BY 1,2,3,4,5,6,7,8,9,10
      ),
      distratos AS (
        SELECT
          cd.referencia_data::date AS data,
          COALESCE(NULLIF(TRIM(d.cidade), ''), b.lead_cidade) AS cidade,
          b.lead_origem_nome AS origem,
          COALESCE(NULLIF(TRIM(d.empreendimento), ''), b.empreendimento_nome) AS empreendimento,
          COALESCE(
            NULLIF(TRIM(d.regiao), ''),
            NULLIF(b.regiao_empreendimento, ''),
            CASE
              WHEN UPPER(TRIM(COALESCE(b.empreendimento_nome, ''))) LIKE 'RETOMADOS%' THEN 'Retomados'
              ELSE NULLIF(SUBSTRING(TRIM(SPLIT_PART(COALESCE(b.empreendimento_nome, ''), '-', 1)) FROM '^[A-Za-z]+'), '')
            END
          ) AS empreendimento_reduzido,
          b.sdr_nome AS sdr,
          b.corretor_nome AS corretor,
          h.gerencia,
          h.coordenacao,
          h.imobiliaria,
           COUNT(DISTINCT cd.idreserva) AS distratos
        FROM comercial_distratos cd
        LEFT JOIN LATERAL (
          SELECT *
          FROM comercial_base b
          WHERE (b.idreserva IS NOT NULL AND b.idreserva = cd.idreserva)
             OR (b.idlead IS NOT NULL AND b.idlead = cd.idlead)
             OR (b.idprecadastro IS NOT NULL AND b.idprecadastro = cd.idprecadastro)
          LIMIT 1
        ) b ON TRUE
        LEFT JOIN LATERAL (
          SELECT cidade, empreendimento, regiao
          FROM public.dim_empreendimento d
          WHERE d.idempreendimento = COALESCE(b.idempreendimento_canonico, b.idempreendimento)
          LIMIT 1
        ) d ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            h.gestor_corretor AS gerencia,
            h.coordenador_corretor AS coordenacao,
            h.imobiliaria_corretor AS imobiliaria
          FROM public.vw_hierarquia_cvcrm h
          WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
            AND h.mes_referencia = DATE_TRUNC('month', cd.referencia_data)::date
            AND LOWER(TRIM(COALESCE(h.corretor_ativo_nome, h.nome))) = LOWER(TRIM(COALESCE(b.corretor_nome, '')))
          ORDER BY h.corretor_ativo_mes_key NULLS LAST
          LIMIT 1
        ) h ON TRUE
        WHERE cd.referencia_data IS NOT NULL
        GROUP BY 1,2,3,4,5,6,7,8,9,10
      ),
      all_rows AS (
        SELECT data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
               leads, visitas, vendas, repasses,
               sla_f_sum, sla_f_count, sla_r_sum, sla_r_count,
               0::int AS propostas_aprovadas, 0::int AS propostas_condicionadas, 0::int AS propostas_reprovadas, 0::int AS propostas_total,
               0::int AS cancelamentos, 0::int AS distratos
        FROM leads_visitas_vendas_repasses
        UNION ALL
        SELECT data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
               0,0,0,0,0,0,0,0,
               propostas_aprovadas, propostas_condicionadas, propostas_reprovadas, propostas_total,
               0,0
        FROM propostas
        UNION ALL
        SELECT data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
               0,0,0,0,0,0,0,0,
               0,0,0,0,
               cancelamentos,0
        FROM cancelamentos
        UNION ALL
        SELECT data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
               0,0,0,0,0,0,0,0,
               0,0,0,0,
               0,distratos
        FROM distratos
      )
      SELECT
        data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
        SUM(leads), SUM(visitas), SUM(vendas), SUM(repasses),
        SUM(sla_f_sum), SUM(sla_f_count), SUM(sla_r_sum), SUM(sla_r_count),
        SUM(propostas_aprovadas), SUM(propostas_condicionadas), SUM(propostas_reprovadas), SUM(propostas_total),
        SUM(cancelamentos), SUM(distratos)
      FROM all_rows
      GROUP BY 1,2,3,4,5,6,7,8,9,10
    `);

    await client.query('COMMIT');
    console.log('✅ comercial_kpi_daily atualizada.');
    return { skipped: false };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na agregacao diaria:', err?.message || err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

export { aggregateData };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  aggregateData().catch(() => {
    process.exitCode = 1;
  });
}
