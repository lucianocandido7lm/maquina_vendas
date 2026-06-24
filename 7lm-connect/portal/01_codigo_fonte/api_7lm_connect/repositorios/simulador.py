"""
Persistencia do modulo de simulador comercial.
"""

from __future__ import annotations

import json


def _expressao_empreendimento_sql(alias: str) -> str:
    return f"""
            coalesce(
                nullif(trim(substring({alias}.descricao from '(?i)Empreendimento\\s*:\\s*([^\\.\\n\\r]+)')), ''),
                nullif(trim(substring({alias}.descricao from '(?i)Localidade\\s*:\\s*([^\\.\\n\\r]+)')), ''),
                nullif(trim({alias}.bairro), ''),
                nullif(trim({alias}.cidade), ''),
                ''
            )
    """


def _join_estatisticas_desconto_sql(esquema: str) -> str:
    empreendimento_atual = _expressao_empreendimento_sql("i")
    empreendimento_alvo = _expressao_empreendimento_sql("alvo")
    return f"""
        left join lateral (
            select count(distinct alvo.identificador_imovel)::int as quantidade_desconto_reservas_vendas
              from {esquema}.imovel alvo
              left join {esquema}.imovel_reserva reserva_desconto
                on reserva_desconto.identificador_imovel = alvo.identificador_imovel
               and reserva_desconto.status in ('ATIVA', 'PENDENTE_APROVACAO')
             where lower(trim({empreendimento_alvo})) = lower(trim({empreendimento_atual}))
               and (
                    lower(trim(coalesce(alvo.status, ''))) in ('reservado', 'vendido', 'pendente de aprovacao', 'pendente de aprovação', 'pendente_aprovacao')
                    or reserva_desconto.identificador_reserva is not null
               )
        ) desconto_stats on true
    """


CAMPOS_COMPLEMENTO_SQL = """
    cf.identificador_membro::text as identificador_complemento,
    cf.identificador_cliente_principal::text as identificador_cliente,
    cf.nome_completo as nome,
    cpf,
    cf.parentesco,
    coalesce(cf.renda_total, coalesce(cf.renda_mensal, 0) + coalesce(cf.outras_rendas, 0)) as renda,
    cf.incluir_na_analise,
    cf.compoe_renda,
    cf.incluir_na_composicao_financeira,
    cf.ativo,
    cf.data_hora_criacao,
    cf.data_hora_atualizado_em
"""

STATUS_DOCUMENTAL_APROVADO = (
    "aprovado",
    "aprovada",
    "pre-aprovado",
    "pre aprovado",
    "apto",
    "apta",
    "ok",
    "validado",
    "completa",
    "completo",
    "documentacao completa",
    "documentação completa",
)

STATUS_DOCUMENTAL_APROVADO_SQL = ", ".join(
    "'" + status.replace("'", "''") + "'" for status in STATUS_DOCUMENTAL_APROVADO
)

CAMPOS_CLIENTE_SIMULADOR_SQL = f"""
    c.identificador_cliente::text as identificador_cliente,
    c.nome_completo,
    c.cpf,
    c.email,
    c.telefone,
    c.celular,
    c.cidade,
    c.renda_principal,
    c.renda_conjuge,
    c.outras_rendas,
    c.renda_total,
    coalesce(to_jsonb(c)->'parametros_simulacao', '{{}}'::jsonb) as parametros_simulacao,
    (to_jsonb(c)->>'identificador_usuario_cadastro') as identificador_usuario_cadastro,
    nullif(trim(coalesce(to_jsonb(c)->>'usuario_cadastro_nome', '')), '') as usuario_cadastro_nome,
    nullif(trim(coalesce(to_jsonb(c)->>'usuario_cadastro_email', '')), '') as usuario_cadastro_email,
    foto_principal.caminho_arquivo as foto_principal,
    foto_principal.nome_arquivo as foto_principal_nome,
    nullif(trim(coalesce(to_jsonb(c)->>'status_documental', '')), '') as status_documental,
    case
      when lower(coalesce(to_jsonb(c)->>'status_documental', '')) in (
        {STATUS_DOCUMENTAL_APROVADO_SQL}
      ) then true
      when nullif(trim(coalesce(to_jsonb(c)->>'status_documental', '')), '') is null then true
      else false
    end as aprovado
"""


CAMPOS_SIMULACAO_SQL = """
    identificador_simulacao::text as identificador_simulacao,
    identificador_cliente::text as identificador_cliente,
    identificador_imovel::text as identificador_imovel,
    empreendimento,
    identificador_corretor::text as identificador_corretor,
    renda_principal,
    renda_complementar,
    renda_total,
    limite_comprometimento,
    percentual_comprometimento,
    valor_imovel,
    valor_total_operacao,
    financiamento_caixa,
    fgts,
    subsidio,
    cheque_moradia,
    entrada,
    pro_soluto_total,
    sobrepreco,
    percentual_fechamento_inicial,
    classificacao_fechamento_inicial,
    percentual_projetado_entrega,
    classificacao_projecao_entrega,
    saldo_pos_entrega,
    meses_pre_entrega,
    meses_pos_entrega,
    status_simulacao,
    payload_snapshot,
    data_hora_criacao,
    data_hora_atualizado_em
"""


CAMPOS_RESERVA_ATIVA_JOIN_SQL = """
    reserva.identificador_reserva::text as reserva_identificador_reserva,
    reserva.identificador_imovel::text as reserva_identificador_imovel,
    reserva.identificador_cliente::text as reserva_identificador_cliente,
    reserva.identificador_simulacao::text as reserva_identificador_simulacao,
    reserva.status as reserva_status,
    reserva.reservado_por::text as reserva_reservado_por,
    reserva.reservado_por_nome as reserva_reservado_por_nome,
    reserva.reservado_por_email as reserva_reservado_por_email,
    reserva.reservado_em as reserva_reservado_em,
    reserva.expiracao_em as reserva_expiracao_em,
    reserva.observacoes as reserva_observacoes,
    reserva.data_hora_criacao as reserva_data_hora_criacao,
    reserva.data_hora_atualizado_em as reserva_data_hora_atualizado_em,
    reserva.cliente_nome as reserva_cliente_nome,
    reserva.cliente_cpf as reserva_cliente_cpf,
    reserva.cliente_cidade as reserva_cliente_cidade,
    reserva.cliente_email as reserva_cliente_email,
    reserva.cliente_telefone as reserva_cliente_telefone,
    reserva.cliente_celular as reserva_cliente_celular,
    reserva.negociacao_valor_imovel as reserva_negociacao_valor_imovel,
    reserva.negociacao_valor_total_operacao as reserva_negociacao_valor_total_operacao,
    reserva.negociacao_financiamento_caixa as reserva_negociacao_financiamento_caixa,
    reserva.negociacao_fgts as reserva_negociacao_fgts,
    reserva.negociacao_subsidio as reserva_negociacao_subsidio,
    reserva.negociacao_cheque_moradia as reserva_negociacao_cheque_moradia,
    reserva.negociacao_entrada as reserva_negociacao_entrada,
    reserva.negociacao_pro_soluto_total as reserva_negociacao_pro_soluto_total,
    reserva.negociacao_sobrepreco as reserva_negociacao_sobrepreco,
    reserva.negociacao_percentual_comprometimento as reserva_negociacao_percentual_comprometimento,
    reserva.negociacao_percentual_fechamento_inicial as reserva_negociacao_percentual_fechamento_inicial,
    reserva.negociacao_percentual_projetado_entrega as reserva_negociacao_percentual_projetado_entrega,
    reserva.negociacao_saldo_pos_entrega as reserva_negociacao_saldo_pos_entrega,
    reserva.negociacao_meses_pre_entrega as reserva_negociacao_meses_pre_entrega,
    reserva.negociacao_meses_pos_entrega as reserva_negociacao_meses_pos_entrega,
    reserva.negociacao_status_simulacao as reserva_negociacao_status_simulacao,
    reserva.negociacao_payload_snapshot as reserva_negociacao_payload_snapshot,
    reserva.negociacao_data_hora_criacao as reserva_negociacao_data_hora_criacao,
    reserva.negociacao_data_hora_atualizado_em as reserva_negociacao_data_hora_atualizado_em
"""


async def listar_clientes_aprovados_para_simulador(
    conexao,
    esquema: str,
    *,
    busca: str,
    limite: int,
    identificador_usuario_visibilidade: str | None = None,
    pode_ver_todos: bool = True,
):
    return await conexao.fetch(
        f"""
        select {CAMPOS_CLIENTE_SIMULADOR_SQL}
        from {esquema}.cliente c
        left join lateral (
            select caminho_arquivo, nome_arquivo
            from {esquema}.cliente_midia cm
            where cm.identificador_cliente = c.identificador_cliente
              and cm.tipo_arquivo = 'foto'
            order by cm.data_hora_criacao desc, cm.identificador_midia desc
            limit 1
        ) foto_principal on true
        where (
              $1 = '%%'
              or c.nome_completo ilike $1
              or coalesce(c.cpf, '') ilike $1
              or coalesce(c.email, '') ilike $1
              or coalesce(c.cidade, '') ilike $1
        )
          and ($3::boolean = true or c.identificador_usuario_cadastro = $4::uuid)
        order by aprovado desc, c.data_hora_criacao desc, c.nome_completo
        limit $2
        """,
        busca,
        limite,
        bool(pode_ver_todos),
        identificador_usuario_visibilidade,
    )


async def buscar_cliente_para_simulador_por_id(
    conexao,
    esquema: str,
    identificador_cliente: str,
    *,
    identificador_usuario_visibilidade: str | None = None,
    pode_ver_todos: bool = True,
):
    return await conexao.fetchrow(
        f"""
        select {CAMPOS_CLIENTE_SIMULADOR_SQL}
        from {esquema}.cliente c
        left join lateral (
            select caminho_arquivo, nome_arquivo
            from {esquema}.cliente_midia cm
            where cm.identificador_cliente = c.identificador_cliente
              and cm.tipo_arquivo = 'foto'
            order by cm.data_hora_criacao desc, cm.identificador_midia desc
            limit 1
        ) foto_principal on true
        where c.identificador_cliente = $1::uuid
          and ($2::boolean = true or c.identificador_usuario_cadastro = $3::uuid)
        limit 1
        """,
        identificador_cliente,
        bool(pode_ver_todos),
        identificador_usuario_visibilidade,
    )


async def listar_complementos_renda(conexao, esquema: str, identificador_cliente: str):
    return await conexao.fetch(
        f"""
        select {CAMPOS_COMPLEMENTO_SQL}
          from {esquema}.composicao_familiar_cliente cf
         where cf.identificador_cliente_principal = $1::uuid
           and cf.ativo = true
         order by cf.data_hora_criacao asc
        """,
        identificador_cliente,
    )


async def buscar_complemento_renda_por_id(
    conexao,
    esquema: str,
    identificador_cliente: str,
    identificador_complemento: str,
):
    return await conexao.fetchrow(
        f"""
        select {CAMPOS_COMPLEMENTO_SQL}
          from {esquema}.composicao_familiar_cliente cf
         where cf.identificador_cliente_principal = $1::uuid
           and cf.identificador_membro = $2::uuid
           and cf.ativo = true
         limit 1
        """,
        identificador_cliente,
        identificador_complemento,
    )


async def criar_complemento_renda(conexao, esquema: str, payload: dict):
    return await conexao.fetchrow(
        f"""
        insert into {esquema}.composicao_familiar_cliente (
            identificador_cliente_principal,
            nome_completo,
            cpf,
            cpf_normalizado,
            parentesco,
            renda_mensal,
            renda_total,
            compoe_renda,
            incluir_na_analise,
            incluir_na_composicao_financeira,
            ativo
        )
        values (
            $1::uuid,
            $2,
            $3,
            regexp_replace($3, '\\D', '', 'g'),
            $4,
            $5,
            $5,
            $6,
            $7,
            $8,
            $9
        )
        returning {CAMPOS_COMPLEMENTO_SQL}
        """,
        payload["identificador_cliente"],
        payload["nome"],
        payload["cpf"],
        payload.get("parentesco") or "Outro",
        payload["renda"],
        payload.get("compoe_renda", True),
        payload.get("incluir_na_analise", True),
        payload.get("incluir_na_composicao_financeira", True),
        payload.get("ativo", True),
    )


async def atualizar_complemento_renda(
    conexao,
    esquema: str,
    identificador_cliente: str,
    identificador_complemento: str,
    payload: dict,
):
    return await conexao.fetchrow(
        f"""
        update {esquema}.composicao_familiar_cliente
           set nome_completo = $3,
               cpf = $4,
               cpf_normalizado = regexp_replace($4, '\\D', '', 'g'),
               parentesco = coalesce($5, 'Outro'),
               renda_mensal = $6,
               renda_total = $6,
               compoe_renda = $7,
               incluir_na_analise = $8,
               incluir_na_composicao_financeira = $9,
               ativo = $10
         where identificador_cliente_principal = $1::uuid
           and identificador_membro = $2::uuid
         returning {CAMPOS_COMPLEMENTO_SQL}
        """,
        identificador_cliente,
        identificador_complemento,
        payload["nome"],
        payload["cpf"],
        payload.get("parentesco"),
        payload["renda"],
        payload.get("compoe_renda", True),
        payload.get("incluir_na_analise", True),
        payload.get("incluir_na_composicao_financeira", True),
        payload.get("ativo", True),
    )


async def excluir_complemento_renda(
    conexao,
    esquema: str,
    identificador_cliente: str,
    identificador_complemento: str,
):
    return await conexao.fetchrow(
        f"""
        update {esquema}.composicao_familiar_cliente
           set ativo = false,
               data_hora_desativacao = now()
         where identificador_cliente_principal = $1::uuid
           and identificador_membro = $2::uuid
        returning identificador_membro::text as identificador_complemento
        """,
        identificador_cliente,
        identificador_complemento,
    )


async def listar_imoveis_para_simulador(
    conexao,
    esquema: str,
    *,
    empreendimento: str | None,
    cidade: str | None,
    bairro: str | None,
    tipologia: str | None,
    dormitorios: int | None,
    faixa_preco_min,
    faixa_preco_max,
    area_min_m2,
    area_max_m2,
    status: str | None,
    limite: int,
):
    return await conexao.fetch(
        f"""
        select
            i.identificador_imovel::text as identificador_imovel,
            i.titulo,
            i.descricao,
            i.tipo_imovel,
            i.endereco,
            i.cidade,
            i.bairro,
            i.estado,
            i.cep,
            i.valor,
            i.quartos,
            i.banheiros,
            i.vagas_garagem,
            i.tipo_garagem,
            i.area_m2,
            i.data_entrega,
            i.meses_pre_entrega,
            i.meses_pos_entrega,
            i.percentual_conclusao_obra,
            i.percentual_fechamento_minimo,
            i.valor_garantido,
            i.valor_garantido_pre_obra_planejado,
            i.percentual_captacao_ate_entrega,
            i.valor_parcela_minima_pre_obra,
            i.valor_desconto_minimo,
            i.valor_desconto_maximo,
            i.status,
            coalesce(desconto_stats.quantidade_desconto_reservas_vendas, 0) as quantidade_desconto_reservas_vendas,
            coalesce(
                nullif(trim(substring(i.descricao from '(?i)Empreendimento\\s*:\\s*([^\\.\\n\\r]+)')), ''),
                nullif(trim(substring(i.descricao from '(?i)Localidade\\s*:\\s*([^\\.\\n\\r]+)')), ''),
                i.bairro,
                i.cidade
            ) as empreendimento,
            i.data_hora_criacao,
            i.data_hora_atualizado_em,
            midia.caminho_arquivo as foto_principal,
            midia.nome_arquivo as foto_principal_nome,
            {CAMPOS_RESERVA_ATIVA_JOIN_SQL}
        from {esquema}.imovel i
        left join lateral (
            select caminho_arquivo, nome_arquivo
              from {esquema}.imovel_midia im
             where im.identificador_imovel = i.identificador_imovel
               and im.tipo_arquivo = 'foto'
             order by im.data_hora_criacao desc
            limit 1
        ) midia on true
        {_join_estatisticas_desconto_sql(esquema)}
        left join lateral (
            select
                r.identificador_reserva,
                r.identificador_imovel,
                r.identificador_cliente,
                r.identificador_simulacao,
                r.status,
                r.reservado_por,
                usuario_reserva.nome_completo as reservado_por_nome,
                usuario_reserva.correio_eletronico::text as reservado_por_email,
                r.reservado_em,
                r.expiracao_em,
                r.observacoes,
                r.data_hora_criacao,
                r.data_hora_atualizado_em,
                c.nome_completo as cliente_nome,
                c.cpf as cliente_cpf,
                c.cidade as cliente_cidade,
                c.email as cliente_email,
                c.telefone as cliente_telefone,
                c.celular as cliente_celular,
                s.valor_imovel as negociacao_valor_imovel,
                s.valor_total_operacao as negociacao_valor_total_operacao,
                s.financiamento_caixa as negociacao_financiamento_caixa,
                s.fgts as negociacao_fgts,
                s.subsidio as negociacao_subsidio,
                s.cheque_moradia as negociacao_cheque_moradia,
                s.entrada as negociacao_entrada,
                s.pro_soluto_total as negociacao_pro_soluto_total,
                s.sobrepreco as negociacao_sobrepreco,
                s.percentual_comprometimento as negociacao_percentual_comprometimento,
                s.percentual_fechamento_inicial as negociacao_percentual_fechamento_inicial,
                s.percentual_projetado_entrega as negociacao_percentual_projetado_entrega,
                s.saldo_pos_entrega as negociacao_saldo_pos_entrega,
                s.meses_pre_entrega as negociacao_meses_pre_entrega,
                s.meses_pos_entrega as negociacao_meses_pos_entrega,
                s.status_simulacao as negociacao_status_simulacao,
                s.payload_snapshot as negociacao_payload_snapshot,
                s.data_hora_criacao as negociacao_data_hora_criacao,
                s.data_hora_atualizado_em as negociacao_data_hora_atualizado_em
            from {esquema}.imovel_reserva r
            left join sevenlm_connect.usuario usuario_reserva
              on usuario_reserva.identificador_usuario = r.reservado_por
            left join {esquema}.cliente c
              on c.identificador_cliente = r.identificador_cliente
            left join {esquema}.simulacao s
              on s.identificador_simulacao = r.identificador_simulacao
            where r.identificador_imovel = i.identificador_imovel
              and r.status in ('ATIVA', 'PENDENTE_APROVACAO')
            order by r.reservado_em desc nulls last, r.data_hora_criacao desc
            limit 1
        ) reserva on true
        where ($1::text is null or i.titulo ilike $1 or i.descricao ilike $1)
          and ($2::text is null or i.cidade ilike $2)
          and ($3::text is null or i.bairro ilike $3)
          and ($4::text is null or i.tipo_imovel ilike $4)
          and ($5::int is null or i.quartos = $5)
          and ($6::numeric is null or i.valor >= $6)
          and ($7::numeric is null or i.valor <= $7)
          and ($8::numeric is null or i.area_m2 >= $8)
          and ($9::numeric is null or i.area_m2 <= $9)
          and ($10::text is null or lower(i.status) = lower($10))
          and lower(trim(coalesce(i.status, ''))) in ('disponivel', 'disponível')
          and reserva.identificador_reserva is null
        order by
            case when lower(i.status) = 'disponivel' then 0 else 1 end,
            i.valor asc nulls last,
            i.data_hora_criacao desc
        limit $11
        """,
        empreendimento,
        cidade,
        bairro,
        tipologia,
        dormitorios,
        faixa_preco_min,
        faixa_preco_max,
        area_min_m2,
        area_max_m2,
        status,
        limite,
    )


async def buscar_imovel_para_simulador_por_id(conexao, esquema: str, identificador_imovel: str):
    return await conexao.fetchrow(
        f"""
        select
            i.identificador_imovel::text as identificador_imovel,
            i.titulo,
            i.descricao,
            i.tipo_imovel,
            i.endereco,
            i.cidade,
            i.bairro,
            i.estado,
            i.cep,
            i.valor,
            i.quartos,
            i.banheiros,
            i.vagas_garagem,
            i.tipo_garagem,
            i.area_m2,
            i.data_entrega,
            i.meses_pre_entrega,
            i.meses_pos_entrega,
            i.percentual_conclusao_obra,
            i.percentual_fechamento_minimo,
            i.valor_garantido,
            i.valor_garantido_pre_obra_planejado,
            i.percentual_captacao_ate_entrega,
            i.valor_parcela_minima_pre_obra,
            i.valor_desconto_minimo,
            i.valor_desconto_maximo,
            i.status,
            coalesce(desconto_stats.quantidade_desconto_reservas_vendas, 0) as quantidade_desconto_reservas_vendas,
            coalesce(
                nullif(trim(substring(i.descricao from '(?i)Empreendimento\\s*:\\s*([^\\.\\n\\r]+)')), ''),
                nullif(trim(substring(i.descricao from '(?i)Localidade\\s*:\\s*([^\\.\\n\\r]+)')), ''),
                i.bairro,
                i.cidade
            ) as empreendimento,
            i.data_hora_criacao,
            i.data_hora_atualizado_em,
            midia.caminho_arquivo as foto_principal,
            midia.nome_arquivo as foto_principal_nome,
            {CAMPOS_RESERVA_ATIVA_JOIN_SQL}
        from {esquema}.imovel i
        left join lateral (
            select caminho_arquivo, nome_arquivo
              from {esquema}.imovel_midia im
             where im.identificador_imovel = i.identificador_imovel
               and im.tipo_arquivo = 'foto'
             order by im.data_hora_criacao desc
            limit 1
        ) midia on true
        {_join_estatisticas_desconto_sql(esquema)}
        left join lateral (
            select
                r.identificador_reserva,
                r.identificador_imovel,
                r.identificador_cliente,
                r.identificador_simulacao,
                r.status,
                r.reservado_por,
                usuario_reserva.nome_completo as reservado_por_nome,
                usuario_reserva.correio_eletronico::text as reservado_por_email,
                r.reservado_em,
                r.expiracao_em,
                r.observacoes,
                r.data_hora_criacao,
                r.data_hora_atualizado_em,
                c.nome_completo as cliente_nome,
                c.cpf as cliente_cpf,
                c.cidade as cliente_cidade,
                c.email as cliente_email,
                c.telefone as cliente_telefone,
                c.celular as cliente_celular,
                s.valor_imovel as negociacao_valor_imovel,
                s.valor_total_operacao as negociacao_valor_total_operacao,
                s.financiamento_caixa as negociacao_financiamento_caixa,
                s.fgts as negociacao_fgts,
                s.subsidio as negociacao_subsidio,
                s.cheque_moradia as negociacao_cheque_moradia,
                s.entrada as negociacao_entrada,
                s.pro_soluto_total as negociacao_pro_soluto_total,
                s.sobrepreco as negociacao_sobrepreco,
                s.percentual_comprometimento as negociacao_percentual_comprometimento,
                s.percentual_fechamento_inicial as negociacao_percentual_fechamento_inicial,
                s.percentual_projetado_entrega as negociacao_percentual_projetado_entrega,
                s.saldo_pos_entrega as negociacao_saldo_pos_entrega,
                s.meses_pre_entrega as negociacao_meses_pre_entrega,
                s.meses_pos_entrega as negociacao_meses_pos_entrega,
                s.status_simulacao as negociacao_status_simulacao,
                s.payload_snapshot as negociacao_payload_snapshot,
                s.data_hora_criacao as negociacao_data_hora_criacao,
                s.data_hora_atualizado_em as negociacao_data_hora_atualizado_em
            from {esquema}.imovel_reserva r
            left join sevenlm_connect.usuario usuario_reserva
              on usuario_reserva.identificador_usuario = r.reservado_por
            left join {esquema}.cliente c
              on c.identificador_cliente = r.identificador_cliente
            left join {esquema}.simulacao s
              on s.identificador_simulacao = r.identificador_simulacao
            where r.identificador_imovel = i.identificador_imovel
              and r.status in ('ATIVA', 'PENDENTE_APROVACAO')
            order by r.reservado_em desc nulls last, r.data_hora_criacao desc
            limit 1
        ) reserva on true
        where i.identificador_imovel = $1::uuid
        limit 1
        """,
        identificador_imovel,
    )


async def listar_reservas_ativas_cliente(conexao, esquema: str, identificador_cliente: str):
    return await conexao.fetch(
        f"""
        select
            r.identificador_reserva::text as identificador_reserva,
            r.identificador_imovel::text as identificador_imovel,
            r.identificador_cliente::text as identificador_cliente,
            r.identificador_simulacao::text as identificador_simulacao,
            r.status,
            r.reservado_por::text as reservado_por,
            usuario_reserva.nome_completo as reservado_por_nome,
            usuario_reserva.correio_eletronico::text as reservado_por_email,
            r.reservado_em,
            r.expiracao_em,
            r.observacoes,
            r.data_hora_criacao,
            r.data_hora_atualizado_em,
            c.nome_completo as cliente_nome,
            c.cpf as cliente_cpf,
            c.cidade as cliente_cidade,
            c.email as cliente_email,
            c.telefone as cliente_telefone,
            c.celular as cliente_celular,
            i.titulo as imovel_titulo,
            i.status as imovel_status,
            i.valor as imovel_valor,
            i.cidade as imovel_cidade,
            i.bairro as imovel_bairro,
            i.estado as imovel_estado,
            i.endereco as imovel_endereco,
            i.tipo_imovel as imovel_tipo_imovel,
            foto.caminho_arquivo as imovel_foto_principal,
            s.valor_imovel as negociacao_valor_imovel,
            s.valor_total_operacao as negociacao_valor_total_operacao,
            s.financiamento_caixa as negociacao_financiamento_caixa,
            s.fgts as negociacao_fgts,
            s.subsidio as negociacao_subsidio,
            s.cheque_moradia as negociacao_cheque_moradia,
            s.entrada as negociacao_entrada,
            s.pro_soluto_total as negociacao_pro_soluto_total,
            s.sobrepreco as negociacao_sobrepreco,
            s.percentual_comprometimento as negociacao_percentual_comprometimento,
            s.percentual_fechamento_inicial as negociacao_percentual_fechamento_inicial,
            s.percentual_projetado_entrega as negociacao_percentual_projetado_entrega,
            s.saldo_pos_entrega as negociacao_saldo_pos_entrega,
            s.meses_pre_entrega as negociacao_meses_pre_entrega,
            s.meses_pos_entrega as negociacao_meses_pos_entrega,
            s.status_simulacao as negociacao_status_simulacao,
            s.payload_snapshot as negociacao_payload_snapshot,
            s.data_hora_criacao as negociacao_data_hora_criacao,
            s.data_hora_atualizado_em as negociacao_data_hora_atualizado_em
        from {esquema}.imovel_reserva r
        left join sevenlm_connect.usuario usuario_reserva
          on usuario_reserva.identificador_usuario = r.reservado_por
        left join {esquema}.cliente c
          on c.identificador_cliente = r.identificador_cliente
        left join {esquema}.imovel i
          on i.identificador_imovel = r.identificador_imovel
        left join lateral (
            select caminho_arquivo
              from {esquema}.imovel_midia im
             where im.identificador_imovel = i.identificador_imovel
               and im.tipo_arquivo = 'foto'
             order by im.data_hora_criacao desc, im.identificador_midia desc
             limit 1
        ) foto on true
        left join {esquema}.simulacao s
          on s.identificador_simulacao = r.identificador_simulacao
        where r.identificador_cliente = $1::uuid
          and r.status in ('ATIVA', 'PENDENTE_APROVACAO')
        order by r.reservado_em desc nulls last, r.data_hora_criacao desc
        """,
        identificador_cliente,
    )


async def criar_simulacao(conexao, esquema: str, payload: dict):
    payload_snapshot = json.dumps(
        payload.get("payload_snapshot", {}),
        ensure_ascii=False,
        default=str,
    )
    return await conexao.fetchrow(
        f"""
        insert into {esquema}.simulacao (
            identificador_cliente,
            identificador_imovel,
            empreendimento,
            identificador_corretor,
            renda_principal,
            renda_complementar,
            renda_total,
            limite_comprometimento,
            percentual_comprometimento,
            valor_imovel,
            valor_total_operacao,
            financiamento_caixa,
            fgts,
            subsidio,
            cheque_moradia,
            entrada,
            pro_soluto_total,
            sobrepreco,
            percentual_fechamento_inicial,
            classificacao_fechamento_inicial,
            percentual_projetado_entrega,
            classificacao_projecao_entrega,
            saldo_pos_entrega,
            meses_pre_entrega,
            meses_pos_entrega,
            status_simulacao,
            payload_snapshot
        )
        values (
            $1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27::jsonb
        )
        returning {CAMPOS_SIMULACAO_SQL}
        """,
        payload["identificador_cliente"],
        payload["identificador_imovel"],
        payload.get("empreendimento"),
        payload.get("identificador_corretor"),
        payload["renda_principal"],
        payload["renda_complementar"],
        payload["renda_total"],
        payload["limite_comprometimento"],
        payload["percentual_comprometimento"],
        payload["valor_imovel"],
        payload["valor_total_operacao"],
        payload["financiamento_caixa"],
        payload["fgts"],
        payload["subsidio"],
        payload["cheque_moradia"],
        payload["entrada"],
        payload["pro_soluto_total"],
        payload["sobrepreco"],
        payload["percentual_fechamento_inicial"],
        payload["classificacao_fechamento_inicial"],
        payload["percentual_projetado_entrega"],
        payload["classificacao_projecao_entrega"],
        payload["saldo_pos_entrega"],
        payload["meses_pre_entrega"],
        payload["meses_pos_entrega"],
        payload["status_simulacao"],
        payload_snapshot,
    )


async def atualizar_simulacao(conexao, esquema: str, identificador_simulacao: str, payload: dict):
    payload_snapshot = json.dumps(
        payload.get("payload_snapshot", {}),
        ensure_ascii=False,
        default=str,
    )
    return await conexao.fetchrow(
        f"""
        update {esquema}.simulacao
           set identificador_cliente = $2::uuid,
               identificador_imovel = $3::uuid,
               empreendimento = $4,
               identificador_corretor = $5::uuid,
               renda_principal = $6,
               renda_complementar = $7,
               renda_total = $8,
               limite_comprometimento = $9,
               percentual_comprometimento = $10,
               valor_imovel = $11,
               valor_total_operacao = $12,
               financiamento_caixa = $13,
               fgts = $14,
               subsidio = $15,
               cheque_moradia = $16,
               entrada = $17,
               pro_soluto_total = $18,
               sobrepreco = $19,
               percentual_fechamento_inicial = $20,
               classificacao_fechamento_inicial = $21,
               percentual_projetado_entrega = $22,
               classificacao_projecao_entrega = $23,
               saldo_pos_entrega = $24,
               meses_pre_entrega = $25,
               meses_pos_entrega = $26,
               status_simulacao = $27,
               payload_snapshot = $28::jsonb,
               data_hora_atualizado_em = now()
         where identificador_simulacao = $1::uuid
         returning {CAMPOS_SIMULACAO_SQL}
        """,
        identificador_simulacao,
        payload["identificador_cliente"],
        payload["identificador_imovel"],
        payload.get("empreendimento"),
        payload.get("identificador_corretor"),
        payload["renda_principal"],
        payload["renda_complementar"],
        payload["renda_total"],
        payload["limite_comprometimento"],
        payload["percentual_comprometimento"],
        payload["valor_imovel"],
        payload["valor_total_operacao"],
        payload["financiamento_caixa"],
        payload["fgts"],
        payload["subsidio"],
        payload["cheque_moradia"],
        payload["entrada"],
        payload["pro_soluto_total"],
        payload["sobrepreco"],
        payload["percentual_fechamento_inicial"],
        payload["classificacao_fechamento_inicial"],
        payload["percentual_projetado_entrega"],
        payload["classificacao_projecao_entrega"],
        payload["saldo_pos_entrega"],
        payload["meses_pre_entrega"],
        payload["meses_pos_entrega"],
        payload["status_simulacao"],
        payload_snapshot,
    )


async def inserir_parcelas_simulacao(conexao, esquema: str, identificador_simulacao: str, parcelas: list[dict]):
    if not parcelas:
        return

    await conexao.executemany(
        f"""
        insert into {esquema}.simulacao_parcela (
            identificador_simulacao,
            fase,
            tipo_parcela,
            numero_parcela,
            vencimento_previsto,
            valor_parcela,
            percentual_renda_comprometido,
            observacao
        )
        values ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
        """,
        [
            (
                identificador_simulacao,
                parcela.get("fase"),
                parcela.get("tipo"),
                int(parcela.get("parcela") or 1),
                parcela.get("vencimento"),
                parcela.get("valor") or 0,
                parcela.get("percentual_renda"),
                parcela.get("observacao"),
            )
            for parcela in parcelas
        ],
    )


async def excluir_parcelas_simulacao(conexao, esquema: str, identificador_simulacao: str):
    await conexao.execute(
        f"""
        delete from {esquema}.simulacao_parcela
         where identificador_simulacao = $1::uuid
        """,
        identificador_simulacao,
    )


async def substituir_parcelas_simulacao(conexao, esquema: str, identificador_simulacao: str, parcelas: list[dict]):
    await excluir_parcelas_simulacao(conexao, esquema, identificador_simulacao)
    await inserir_parcelas_simulacao(conexao, esquema, identificador_simulacao, parcelas)


async def listar_parcelas_simulacao(conexao, esquema: str, identificador_simulacao: str):
    return await conexao.fetch(
        f"""
        select
            identificador_parcela::text as identificador_parcela,
            identificador_simulacao::text as identificador_simulacao,
            fase,
            tipo_parcela,
            numero_parcela,
            vencimento_previsto,
            valor_parcela,
            percentual_renda_comprometido,
            observacao,
            data_hora_criacao
        from {esquema}.simulacao_parcela
        where identificador_simulacao = $1::uuid
        order by fase, numero_parcela, data_hora_criacao
        """,
        identificador_simulacao,
    )


async def buscar_simulacao_por_id(conexao, esquema: str, identificador_simulacao: str):
    return await conexao.fetchrow(
        f"""
        select {CAMPOS_SIMULACAO_SQL}
          from {esquema}.simulacao
         where identificador_simulacao = $1::uuid
         limit 1
        """,
        identificador_simulacao,
    )


async def listar_simulacoes_cliente(conexao, esquema: str, identificador_cliente: str, limite: int = 30):
    return await conexao.fetch(
        f"""
        select {CAMPOS_SIMULACAO_SQL}
          from {esquema}.simulacao
         where identificador_cliente = $1::uuid
         order by data_hora_criacao desc
         limit $2
        """,
        identificador_cliente,
        limite,
    )


async def obter_imovel_para_operacao_lock(conexao, esquema: str, identificador_imovel: str):
    return await conexao.fetchrow(
        f"""
        select
            identificador_imovel::text as identificador_imovel,
            titulo,
            status,
            valor,
            cidade,
            bairro
        from {esquema}.imovel
        where identificador_imovel = $1::uuid
        for update
        """,
        identificador_imovel,
    )


async def atualizar_status_imovel(conexao, esquema: str, identificador_imovel: str, novo_status: str):
    return await conexao.fetchrow(
        f"""
        update {esquema}.imovel
           set status = $2
         where identificador_imovel = $1::uuid
         returning
            identificador_imovel::text as identificador_imovel,
            status
        """,
        identificador_imovel,
        novo_status,
    )


async def buscar_reserva_ativa_por_imovel_lock(conexao, esquema: str, identificador_imovel: str):
    return await conexao.fetchrow(
        f"""
        select
            r.identificador_reserva::text as identificador_reserva,
            r.identificador_imovel::text as identificador_imovel,
            r.identificador_cliente::text as identificador_cliente,
            r.identificador_simulacao::text as identificador_simulacao,
            r.status,
            r.reservado_por::text as reservado_por,
            usuario_reserva.nome_completo as reservado_por_nome,
            usuario_reserva.correio_eletronico::text as reservado_por_email,
            r.reservado_em,
            r.expiracao_em,
            r.observacoes,
            r.data_hora_criacao,
            r.data_hora_atualizado_em
        from {esquema}.imovel_reserva r
        left join sevenlm_connect.usuario usuario_reserva
          on usuario_reserva.identificador_usuario = r.reservado_por
        where r.identificador_imovel = $1::uuid
          and r.status in ('ATIVA', 'PENDENTE_APROVACAO')
        order by r.reservado_em desc nulls last, r.data_hora_criacao desc
        limit 1
        for update of r
        """,
        identificador_imovel,
    )


async def criar_imovel_reserva(conexao, esquema: str, payload: dict):
    return await conexao.fetchrow(
        f"""
        insert into {esquema}.imovel_reserva (
            identificador_imovel,
            identificador_cliente,
            identificador_simulacao,
            status,
            reservado_por,
            reservado_em,
            expiracao_em,
            observacoes
        )
        values ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6, $7, $8)
        returning
            identificador_reserva::text as identificador_reserva,
            identificador_imovel::text as identificador_imovel,
            identificador_cliente::text as identificador_cliente,
            identificador_simulacao::text as identificador_simulacao,
            status,
            reservado_por::text as reservado_por,
            reservado_em,
            expiracao_em,
            observacoes,
            data_hora_criacao,
            data_hora_atualizado_em
        """,
        payload["identificador_imovel"],
        payload.get("identificador_cliente"),
        payload.get("identificador_simulacao"),
        payload["status"],
        payload.get("reservado_por"),
        payload.get("reservado_em"),
        payload.get("expiracao_em"),
        payload.get("observacoes"),
    )


async def atualizar_reserva_status(
    conexao,
    esquema: str,
    identificador_reserva: str,
    novo_status: str,
    observacoes: str | None = None,
):
    return await conexao.fetchrow(
        f"""
        update {esquema}.imovel_reserva
           set status = $2,
               observacoes = coalesce($3, observacoes)
         where identificador_reserva = $1::uuid
         returning
            identificador_reserva::text as identificador_reserva,
            identificador_imovel::text as identificador_imovel,
            identificador_cliente::text as identificador_cliente,
            identificador_simulacao::text as identificador_simulacao,
            status,
            reservado_por::text as reservado_por,
            reservado_em,
            expiracao_em,
            observacoes,
            data_hora_criacao,
            data_hora_atualizado_em
        """,
        identificador_reserva,
        novo_status,
        observacoes,
    )


async def atualizar_reserva_operacao(
    conexao,
    esquema: str,
    identificador_reserva: str,
    *,
    novo_status: str | None = None,
    identificador_simulacao: str | None = None,
    observacoes: str | None = None,
):
    return await conexao.fetchrow(
        f"""
        update {esquema}.imovel_reserva
           set status = coalesce($2, status),
               identificador_simulacao = coalesce($3::uuid, identificador_simulacao),
               observacoes = coalesce($4, observacoes)
         where identificador_reserva = $1::uuid
         returning
            identificador_reserva::text as identificador_reserva,
            identificador_imovel::text as identificador_imovel,
            identificador_cliente::text as identificador_cliente,
            identificador_simulacao::text as identificador_simulacao,
            status,
            reservado_por::text as reservado_por,
            reservado_em,
            expiracao_em,
            observacoes,
            data_hora_criacao,
            data_hora_atualizado_em
        """,
        identificador_reserva,
        novo_status,
        identificador_simulacao,
        observacoes,
    )


async def inserir_historico_status_imovel(conexao, esquema: str, payload: dict):
    return await conexao.fetchrow(
        f"""
        insert into {esquema}.historico_status_imovel (
            identificador_imovel,
            status_anterior,
            status_novo,
            identificador_simulacao,
            identificador_cliente,
            alterado_por,
            observacoes
        )
        values ($1::uuid, $2, $3, $4::uuid, $5::uuid, $6::uuid, $7)
        returning identificador_historico::text as identificador_historico
        """,
        payload["identificador_imovel"],
        payload.get("status_anterior"),
        payload["status_novo"],
        payload.get("identificador_simulacao"),
        payload.get("identificador_cliente"),
        payload.get("alterado_por"),
        payload.get("observacoes"),
    )
