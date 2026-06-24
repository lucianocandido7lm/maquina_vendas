"""
Persistencia do modulo de imóveis.
"""

from __future__ import annotations


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


CAMPOS_IMOVEL_SQL = """
    identificador_imovel::text as identificador_imovel,
    titulo,
    descricao,
    tipo_imovel,
    endereco,
    cidade,
    bairro,
    estado,
    cep,
    valor,
    quartos,
    banheiros,
    vagas_garagem,
    tipo_garagem,
    area_m2,
    data_entrega,
    meses_pre_entrega,
    meses_pos_entrega,
    percentual_conclusao_obra,
    percentual_fechamento_minimo,
    valor_garantido,
    valor_garantido_pre_obra_planejado,
    percentual_captacao_ate_entrega,
    valor_parcela_minima_pre_obra,
    valor_desconto_minimo,
    valor_desconto_maximo,
    status,
    data_hora_criacao,
    data_hora_atualizado_em
"""

CAMPOS_IMOVEL_SQL_COM_ALIAS = """
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
    i.data_hora_criacao,
    i.data_hora_atualizado_em
"""

CAMPOS_RESERVA_ATIVA_SQL_COM_ALIAS = """
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


def _join_ultima_simulacao_imovel_sql(esquema: str) -> str:
    return f"""
        left join lateral (
            select s.identificador_simulacao::text as ultima_simulacao_id
            from {esquema}.simulacao s
            where s.identificador_imovel = i.identificador_imovel
            order by s.data_hora_atualizado_em desc nulls last, s.data_hora_criacao desc
            limit 1
        ) ultima_simulacao on true
    """


async def criar_imovel(conexao, esquema: str, payload: dict):
    return await conexao.fetchrow(
        f"""
        insert into {esquema}.imovel (
            titulo,
            descricao,
            tipo_imovel,
            endereco,
            cidade,
            bairro,
            estado,
            cep,
            valor,
            quartos,
            banheiros,
            vagas_garagem,
            tipo_garagem,
            area_m2,
            data_entrega,
            meses_pre_entrega,
            meses_pos_entrega,
            percentual_conclusao_obra,
            percentual_fechamento_minimo,
            valor_garantido,
            valor_garantido_pre_obra_planejado,
            percentual_captacao_ate_entrega,
            valor_parcela_minima_pre_obra,
            valor_desconto_minimo,
            valor_desconto_maximo,
            status
        )
        values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
        )
        returning {CAMPOS_IMOVEL_SQL}
        """,
        payload["titulo"],
        payload["descricao"],
        payload["tipo_imovel"],
        payload["endereco"],
        payload["cidade"],
        payload["bairro"],
        payload["estado"],
        payload["cep"],
        payload["valor"],
        payload["quartos"],
        payload["banheiros"],
        payload["vagas_garagem"],
        payload["tipo_garagem"],
        payload["area_m2"],
        payload["data_entrega"],
        payload["meses_pre_entrega"],
        payload["meses_pos_entrega"],
        payload["percentual_conclusao_obra"],
        payload["percentual_fechamento_minimo"],
        payload["valor_garantido"],
        payload["valor_garantido_pre_obra_planejado"],
        payload["percentual_captacao_ate_entrega"],
        payload["valor_parcela_minima_pre_obra"],
        payload["valor_desconto_minimo"],
        payload["valor_desconto_maximo"],
        payload["status"],
    )


async def atualizar_imovel(conexao, esquema: str, identificador_imovel: str, payload: dict):
    return await conexao.fetchrow(
        f"""
        update {esquema}.imovel i
           set titulo = $2,
               descricao = $3,
               tipo_imovel = $4,
               endereco = $5,
               cidade = $6,
               bairro = $7,
               estado = $8,
               cep = $9,
               valor = $10,
               quartos = $11,
               banheiros = $12,
               vagas_garagem = $13,
               tipo_garagem = $14,
               area_m2 = $15,
               data_entrega = $16,
               meses_pre_entrega = $17,
               meses_pos_entrega = $18,
               percentual_conclusao_obra = $19,
               percentual_fechamento_minimo = $20,
               valor_garantido = $21,
               valor_garantido_pre_obra_planejado = $22,
               percentual_captacao_ate_entrega = $23,
               valor_parcela_minima_pre_obra = $24,
               valor_desconto_minimo = $25,
               valor_desconto_maximo = $26,
               status = $27
         where i.identificador_imovel = $1::uuid
         returning {CAMPOS_IMOVEL_SQL_COM_ALIAS}
        """,
        identificador_imovel,
        payload["titulo"],
        payload["descricao"],
        payload["tipo_imovel"],
        payload["endereco"],
        payload["cidade"],
        payload["bairro"],
        payload["estado"],
        payload["cep"],
        payload["valor"],
        payload["quartos"],
        payload["banheiros"],
        payload["vagas_garagem"],
        payload["tipo_garagem"],
        payload["area_m2"],
        payload["data_entrega"],
        payload["meses_pre_entrega"],
        payload["meses_pos_entrega"],
        payload["percentual_conclusao_obra"],
        payload["percentual_fechamento_minimo"],
        payload["valor_garantido"],
        payload["valor_garantido_pre_obra_planejado"],
        payload["percentual_captacao_ate_entrega"],
        payload["valor_parcela_minima_pre_obra"],
        payload["valor_desconto_minimo"],
        payload["valor_desconto_maximo"],
        payload["status"],
    )


async def buscar_imovel_por_id(conexao, esquema: str, identificador_imovel: str):
    return await conexao.fetchrow(
        f"""
        select
            {CAMPOS_IMOVEL_SQL_COM_ALIAS},
            coalesce(midias.quantidade_midias, 0) as quantidade_midias,
            coalesce(desconto_stats.quantidade_desconto_reservas_vendas, 0) as quantidade_desconto_reservas_vendas,
            foto_principal.caminho_arquivo as foto_principal,
            foto_principal.nome_arquivo as foto_principal_nome,
            ultima_simulacao.ultima_simulacao_id,
            {CAMPOS_RESERVA_ATIVA_SQL_COM_ALIAS}
        from {esquema}.imovel i
        left join lateral (
            select count(*)::int as quantidade_midias
            from {esquema}.imovel_midia im
            where im.identificador_imovel = i.identificador_imovel
        ) midias on true
        left join lateral (
            select caminho_arquivo, nome_arquivo
            from {esquema}.imovel_midia im
            where im.identificador_imovel = i.identificador_imovel
              and im.tipo_arquivo = 'foto'
            order by im.data_hora_criacao desc, im.identificador_midia desc
            limit 1
        ) foto_principal on true
        {_join_estatisticas_desconto_sql(esquema)}
        {_join_ultima_simulacao_imovel_sql(esquema)}
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


async def listar_imoveis_candidatos_mesmo_endereco(
    conexao,
    esquema: str,
    *,
    cep_normalizado: str,
    cidade: str | None,
    bairro: str | None,
    estado: str | None,
):
    return await conexao.fetch(
        f"""
        select
            {CAMPOS_IMOVEL_SQL_COM_ALIAS}
        from {esquema}.imovel i
        where (
            $1 <> ''
            and regexp_replace(coalesce(i.cep, ''), '[^0-9]', '', 'g') = $1
        )
        or (
            ($2 <> '' or $3 <> '' or $4 <> '')
            and ($4 = '' or lower(trim(coalesce(i.estado, ''))) = lower(trim($4)))
            and (
                ($2 <> '' and lower(trim(coalesce(i.cidade, ''))) = lower(trim($2)))
                or ($3 <> '' and lower(trim(coalesce(i.bairro, ''))) = lower(trim($3)))
            )
        )
        order by i.endereco nulls last, i.titulo
        """,
        cep_normalizado,
        cidade or "",
        bairro or "",
        estado or "",
    )


async def buscar_imovel_por_chave_importacao(
    conexao,
    esquema: str,
    *,
    titulo: str,
    endereco: str | None,
    cidade: str,
    bairro: str,
):
    return await conexao.fetchrow(
        f"""
        select
            identificador_imovel::text as identificador_imovel
        from {esquema}.imovel
        where lower(trim(titulo)) = lower(trim($1))
          and lower(trim(cidade)) = lower(trim($2))
          and lower(trim(bairro)) = lower(trim($3))
          and lower(trim(coalesce(endereco, ''))) = lower(trim(coalesce($4, '')))
        limit 1
        """,
        titulo,
        cidade,
        bairro,
        endereco,
    )


async def listar_imoveis(
    conexao,
    esquema: str,
    *,
    busca_titulo: str,
    cidade: str | None,
    bairro: str | None,
    status: str | None,
    limite: int,
    deslocamento: int,
):
    return await conexao.fetch(
        f"""
        select
            {CAMPOS_IMOVEL_SQL_COM_ALIAS},
            coalesce(midias.quantidade_midias, 0) as quantidade_midias,
            coalesce(desconto_stats.quantidade_desconto_reservas_vendas, 0) as quantidade_desconto_reservas_vendas,
            foto_principal.caminho_arquivo as foto_principal,
            foto_principal.nome_arquivo as foto_principal_nome,
            ultima_simulacao.ultima_simulacao_id,
            {CAMPOS_RESERVA_ATIVA_SQL_COM_ALIAS}
        from {esquema}.imovel i
        left join lateral (
            select count(*)::int as quantidade_midias
            from {esquema}.imovel_midia im
            where im.identificador_imovel = i.identificador_imovel
        ) midias on true
        left join lateral (
            select caminho_arquivo, nome_arquivo
            from {esquema}.imovel_midia im
            where im.identificador_imovel = i.identificador_imovel
              and im.tipo_arquivo = 'foto'
            order by im.data_hora_criacao desc, im.identificador_midia desc
            limit 1
        ) foto_principal on true
        {_join_estatisticas_desconto_sql(esquema)}
        {_join_ultima_simulacao_imovel_sql(esquema)}
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
        where (
                $1 = '%%'
                or i.titulo ilike $1
              )
          and ($2::text is null or i.cidade ilike $2)
          and ($3::text is null or i.bairro ilike $3)
          and ($4::text is null or i.status ilike $4)
        order by i.data_hora_criacao desc, i.titulo
        offset $5
        limit $6
        """,
        busca_titulo,
        cidade,
        bairro,
        status,
        deslocamento,
        limite,
    )


async def listar_imoveis_para_exportacao(
    conexao,
    esquema: str,
    *,
    busca_titulo: str,
    cidade: str | None,
    bairro: str | None,
    status: str | None,
):
    return await conexao.fetch(
        f"""
        select
            {CAMPOS_IMOVEL_SQL_COM_ALIAS},
            coalesce(midias.quantidade_midias, 0) as quantidade_midias,
            coalesce(desconto_stats.quantidade_desconto_reservas_vendas, 0) as quantidade_desconto_reservas_vendas,
            foto_principal.caminho_arquivo as foto_principal,
            foto_principal.nome_arquivo as foto_principal_nome,
            ultima_simulacao.ultima_simulacao_id,
            {CAMPOS_RESERVA_ATIVA_SQL_COM_ALIAS}
        from {esquema}.imovel i
        left join lateral (
            select count(*)::int as quantidade_midias
            from {esquema}.imovel_midia im
            where im.identificador_imovel = i.identificador_imovel
        ) midias on true
        left join lateral (
            select caminho_arquivo, nome_arquivo
            from {esquema}.imovel_midia im
            where im.identificador_imovel = i.identificador_imovel
              and im.tipo_arquivo = 'foto'
            order by im.data_hora_criacao desc, im.identificador_midia desc
            limit 1
        ) foto_principal on true
        {_join_estatisticas_desconto_sql(esquema)}
        {_join_ultima_simulacao_imovel_sql(esquema)}
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
        where (
                $1 = '%%'
                or i.titulo ilike $1
              )
          and ($2::text is null or i.cidade ilike $2)
          and ($3::text is null or i.bairro ilike $3)
          and ($4::text is null or i.status ilike $4)
        order by
            lower(i.cidade) asc,
            lower(i.bairro) asc,
            lower(i.titulo) asc,
            i.data_hora_criacao desc
        """,
        busca_titulo,
        cidade,
        bairro,
        status,
    )


async def contar_imoveis(
    conexao,
    esquema: str,
    *,
    busca_titulo: str,
    cidade: str | None,
    bairro: str | None,
    status: str | None,
):
    return int(
        await conexao.fetchval(
            f"""
            select count(*)::int
            from {esquema}.imovel i
            where (
                    $1 = '%%'
                    or i.titulo ilike $1
                  )
              and ($2::text is null or i.cidade ilike $2)
              and ($3::text is null or i.bairro ilike $3)
              and ($4::text is null or i.status ilike $4)
            """,
            busca_titulo,
            cidade,
            bairro,
            status,
        )
        or 0
    )


async def excluir_imovel(conexao, esquema: str, identificador_imovel: str):
    return await conexao.fetchrow(
        f"""
        delete from {esquema}.imovel
        where identificador_imovel = $1::uuid
        returning identificador_imovel::text as identificador_imovel
        """,
        identificador_imovel,
    )


async def listar_midias_imovel(conexao, esquema: str, identificador_imovel: str):
    return await conexao.fetch(
        f"""
        select
            identificador_midia::text as identificador_midia,
            identificador_imovel::text as identificador_imovel,
            tipo_arquivo,
            nome_arquivo,
            caminho_arquivo,
            mime_type,
            tamanho_bytes,
            data_hora_criacao
        from {esquema}.imovel_midia
        where identificador_imovel = $1::uuid
        order by data_hora_criacao desc, identificador_midia desc
        """,
        identificador_imovel,
    )


async def inserir_midia_imovel(
    conexao,
    esquema: str,
    *,
    identificador_imovel: str,
    tipo_arquivo: str,
    nome_arquivo: str,
    caminho_arquivo: str,
    mime_type: str,
    tamanho_bytes: int,
):
    return await conexao.fetchrow(
        f"""
        insert into {esquema}.imovel_midia (
            identificador_imovel,
            tipo_arquivo,
            nome_arquivo,
            caminho_arquivo,
            mime_type,
            tamanho_bytes
        )
        values ($1::uuid, $2, $3, $4, $5, $6)
        returning
            identificador_midia::text as identificador_midia,
            identificador_imovel::text as identificador_imovel,
            tipo_arquivo,
            nome_arquivo,
            caminho_arquivo,
            mime_type,
            tamanho_bytes,
            data_hora_criacao
        """,
        identificador_imovel,
        tipo_arquivo,
        nome_arquivo,
        caminho_arquivo,
        mime_type,
        tamanho_bytes,
    )


async def buscar_midia_imovel(
    conexao,
    esquema: str,
    *,
    identificador_imovel: str,
    identificador_midia: str,
):
    return await conexao.fetchrow(
        f"""
        select
            identificador_midia::text as identificador_midia,
            identificador_imovel::text as identificador_imovel,
            tipo_arquivo,
            nome_arquivo,
            caminho_arquivo,
            mime_type,
            tamanho_bytes,
            data_hora_criacao
        from {esquema}.imovel_midia
        where identificador_imovel = $1::uuid
          and identificador_midia = $2::uuid
        limit 1
        """,
        identificador_imovel,
        identificador_midia,
    )


async def excluir_midia_imovel(
    conexao,
    esquema: str,
    *,
    identificador_imovel: str,
    identificador_midia: str,
):
    return await conexao.fetchrow(
        f"""
        delete from {esquema}.imovel_midia
        where identificador_imovel = $1::uuid
          and identificador_midia = $2::uuid
        returning
            identificador_midia::text as identificador_midia,
            identificador_imovel::text as identificador_imovel,
            tipo_arquivo,
            nome_arquivo,
            caminho_arquivo,
            mime_type,
            tamanho_bytes,
            data_hora_criacao
        """,
        identificador_imovel,
        identificador_midia,
    )


async def listar_evolucao_obra(conexao, esquema: str, identificador_imovel: str):
    return await conexao.fetch(
        f"""
        select
            identificador_evolucao_obra::text as identificador_evolucao_obra,
            identificador_imovel::text as identificador_imovel,
            percentual_conclusao_obra,
            data_referencia,
            observacoes,
            registrado_por::text as registrado_por,
            data_hora_criacao
        from {esquema}.imovel_evolucao_obra
        where identificador_imovel = $1::uuid
        order by data_referencia desc, data_hora_criacao desc, identificador_evolucao_obra desc
        """,
        identificador_imovel,
    )


async def obter_ultima_evolucao_obra(conexao, esquema: str, identificador_imovel: str):
    return await conexao.fetchrow(
        f"""
        select
            identificador_evolucao_obra::text as identificador_evolucao_obra,
            identificador_imovel::text as identificador_imovel,
            percentual_conclusao_obra,
            data_referencia,
            observacoes,
            registrado_por::text as registrado_por,
            data_hora_criacao
        from {esquema}.imovel_evolucao_obra
        where identificador_imovel = $1::uuid
        order by data_referencia desc, data_hora_criacao desc, identificador_evolucao_obra desc
        limit 1
        """,
        identificador_imovel,
    )


async def inserir_evolucao_obra(
    conexao,
    esquema: str,
    *,
    identificador_imovel: str,
    percentual_conclusao_obra,
    data_referencia,
    observacoes: str | None,
    registrado_por: str | None,
):
    return await conexao.fetchrow(
        f"""
        insert into {esquema}.imovel_evolucao_obra (
            identificador_imovel,
            percentual_conclusao_obra,
            data_referencia,
            observacoes,
            registrado_por
        )
        values ($1::uuid, $2, $3::date, $4, $5::uuid)
        returning
            identificador_evolucao_obra::text as identificador_evolucao_obra,
            identificador_imovel::text as identificador_imovel,
            percentual_conclusao_obra,
            data_referencia,
            observacoes,
            registrado_por::text as registrado_por,
            data_hora_criacao
        """,
        identificador_imovel,
        percentual_conclusao_obra,
        data_referencia,
        observacoes,
        registrado_por,
    )


async def sincronizar_percentual_conclusao_obra_atual(conexao, esquema: str, identificador_imovel: str):
    return await conexao.fetchrow(
        f"""
        update {esquema}.imovel i
           set percentual_conclusao_obra = atual.percentual_conclusao_obra
          from (
            select percentual_conclusao_obra
            from {esquema}.imovel_evolucao_obra
            where identificador_imovel = $1::uuid
            order by data_referencia desc, data_hora_criacao desc, identificador_evolucao_obra desc
            limit 1
          ) atual
         where i.identificador_imovel = $1::uuid
         returning {CAMPOS_IMOVEL_SQL_COM_ALIAS}
        """,
        identificador_imovel,
    )
