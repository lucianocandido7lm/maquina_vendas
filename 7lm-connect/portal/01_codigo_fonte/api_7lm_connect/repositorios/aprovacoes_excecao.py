"""
Persistencia do fluxo de aprovacao excepcional do simulador comercial.
"""

from __future__ import annotations

import json


CAMPOS_APROVACAO_EXCECAO_SQL = """
    a.identificador_aprovacao::text as identificador_aprovacao,
    a.identificador_imovel::text as identificador_imovel,
    a.identificador_cliente::text as identificador_cliente,
    a.identificador_simulacao::text as identificador_simulacao,
    a.identificador_reserva::text as identificador_reserva,
    a.status,
    a.motivo,
    a.observacoes_solicitacao,
    a.solicitado_por::text as solicitado_por,
    a.solicitado_em,
    a.avaliado_por::text as avaliado_por,
    a.avaliado_em,
    a.observacoes_avaliacao,
    a.payload_snapshot,
    a.valor_garantido_planejado,
    a.valor_garantido_real,
    a.valor_garantido_pre_obra_planejado,
    a.valor_garantido_pre_obra_real,
    a.gap_garantia,
    a.gap_pre_obra,
    a.percentual_gap_garantia,
    a.percentual_gap_pre_obra,
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
    s.status_simulacao as simulacao_status_simulacao,
    s.valor_total_operacao as simulacao_valor_total_operacao,
    s.percentual_comprometimento as simulacao_percentual_comprometimento,
    r.status as reserva_status,
    solicitante.nome_completo as solicitado_por_nome,
    solicitante.correio_eletronico as solicitado_por_email,
    avaliador.nome_completo as avaliado_por_nome,
    avaliador.correio_eletronico as avaliado_por_email
"""


async def criar_aprovacao_excecao(conexao, esquema: str, payload: dict):
    snapshot = json.dumps(
        payload.get("payload_snapshot", {}),
        ensure_ascii=False,
        default=str,
    )
    return await conexao.fetchrow(
        f"""
        insert into {esquema}.aprovacao_excecao (
            identificador_imovel,
            identificador_cliente,
            identificador_simulacao,
            identificador_reserva,
            status,
            motivo,
            observacoes_solicitacao,
            solicitado_por,
            solicitado_em,
            payload_snapshot,
            valor_garantido_planejado,
            valor_garantido_real,
            valor_garantido_pre_obra_planejado,
            valor_garantido_pre_obra_real,
            gap_garantia,
            gap_pre_obra,
            percentual_gap_garantia,
            percentual_gap_pre_obra
        )
        values (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5,
            $6,
            $7,
            $8::uuid,
            $9,
            $10::jsonb,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18
        )
        returning identificador_aprovacao::text as identificador_aprovacao
        """,
        payload["identificador_imovel"],
        payload["identificador_cliente"],
        payload["identificador_simulacao"],
        payload["identificador_reserva"],
        payload.get("status", "PENDENTE"),
        payload.get("motivo"),
        payload.get("observacoes_solicitacao"),
        payload["solicitado_por"],
        payload.get("solicitado_em"),
        snapshot,
        payload.get("valor_garantido_planejado"),
        payload.get("valor_garantido_real"),
        payload.get("valor_garantido_pre_obra_planejado"),
        payload.get("valor_garantido_pre_obra_real"),
        payload.get("gap_garantia"),
        payload.get("gap_pre_obra"),
        payload.get("percentual_gap_garantia"),
        payload.get("percentual_gap_pre_obra"),
    )


async def buscar_aprovacao_excecao_por_id(
    conexao,
    esquema: str,
    identificador_aprovacao: str,
    *,
    for_update: bool = False,
):
    sufixo_lock = "\n        for update of a" if for_update else ""
    return await conexao.fetchrow(
        f"""
        select
            {CAMPOS_APROVACAO_EXCECAO_SQL}
        from {esquema}.aprovacao_excecao a
        left join {esquema}.cliente c
          on c.identificador_cliente = a.identificador_cliente
        left join {esquema}.imovel i
          on i.identificador_imovel = a.identificador_imovel
        left join {esquema}.simulacao s
          on s.identificador_simulacao = a.identificador_simulacao
        left join {esquema}.imovel_reserva r
          on r.identificador_reserva = a.identificador_reserva
        left join sevenlm_connect.usuario solicitante
          on solicitante.identificador_usuario = a.solicitado_por
        left join sevenlm_connect.usuario avaliador
          on avaliador.identificador_usuario = a.avaliado_por
        where a.identificador_aprovacao = $1::uuid
        limit 1{sufixo_lock}
        """,
        identificador_aprovacao,
    )


async def buscar_aprovacao_excecao_pendente_por_reserva_lock(
    conexao,
    esquema: str,
    identificador_reserva: str,
):
    return await conexao.fetchrow(
        f"""
        select
            {CAMPOS_APROVACAO_EXCECAO_SQL}
        from {esquema}.aprovacao_excecao a
        left join {esquema}.cliente c
          on c.identificador_cliente = a.identificador_cliente
        left join {esquema}.imovel i
          on i.identificador_imovel = a.identificador_imovel
        left join {esquema}.simulacao s
          on s.identificador_simulacao = a.identificador_simulacao
        left join {esquema}.imovel_reserva r
          on r.identificador_reserva = a.identificador_reserva
        left join sevenlm_connect.usuario solicitante
          on solicitante.identificador_usuario = a.solicitado_por
        left join sevenlm_connect.usuario avaliador
          on avaliador.identificador_usuario = a.avaliado_por
        where a.identificador_reserva = $1::uuid
          and a.status = 'PENDENTE'
        order by a.solicitado_em desc, a.identificador_aprovacao desc
        limit 1
        for update of a
        """,
        identificador_reserva,
    )


async def listar_aprovacoes_excecao(
    conexao,
    esquema: str,
    *,
    status: str | None = None,
    limite: int = 200,
):
    return await conexao.fetch(
        f"""
        select
            {CAMPOS_APROVACAO_EXCECAO_SQL}
        from {esquema}.aprovacao_excecao a
        left join {esquema}.cliente c
          on c.identificador_cliente = a.identificador_cliente
        left join {esquema}.imovel i
          on i.identificador_imovel = a.identificador_imovel
        left join {esquema}.simulacao s
          on s.identificador_simulacao = a.identificador_simulacao
        left join {esquema}.imovel_reserva r
          on r.identificador_reserva = a.identificador_reserva
        left join sevenlm_connect.usuario solicitante
          on solicitante.identificador_usuario = a.solicitado_por
        left join sevenlm_connect.usuario avaliador
          on avaliador.identificador_usuario = a.avaliado_por
        where ($1::text is null or a.status = upper($1))
        order by
            case when a.status = 'PENDENTE' then 0 else 1 end,
            coalesce(a.avaliado_em, a.solicitado_em) desc,
            a.identificador_aprovacao desc
        limit $2
        """,
        status,
        limite,
    )


async def contar_aprovacoes_excecao_pendentes(conexao, esquema: str) -> int:
    return int(
        await conexao.fetchval(
            f"""
            select count(*)::int
            from {esquema}.aprovacao_excecao
            where status = 'PENDENTE'
            """
        )
        or 0
    )


async def listar_aprovacoes_excecao_pendentes_resumo(conexao, esquema: str, limite: int = 5):
    return await conexao.fetch(
        f"""
        select
            {CAMPOS_APROVACAO_EXCECAO_SQL}
        from {esquema}.aprovacao_excecao a
        left join {esquema}.cliente c
          on c.identificador_cliente = a.identificador_cliente
        left join {esquema}.imovel i
          on i.identificador_imovel = a.identificador_imovel
        left join {esquema}.simulacao s
          on s.identificador_simulacao = a.identificador_simulacao
        left join {esquema}.imovel_reserva r
          on r.identificador_reserva = a.identificador_reserva
        left join sevenlm_connect.usuario solicitante
          on solicitante.identificador_usuario = a.solicitado_por
        left join sevenlm_connect.usuario avaliador
          on avaliador.identificador_usuario = a.avaliado_por
        where a.status = 'PENDENTE'
        order by a.solicitado_em asc, a.identificador_aprovacao asc
        limit $1
        """,
        limite,
    )


async def atualizar_aprovacao_excecao_status(
    conexao,
    esquema: str,
    identificador_aprovacao: str,
    *,
    novo_status: str,
    avaliado_por: str | None = None,
    avaliado_em=None,
    observacoes_avaliacao: str | None = None,
):
    return await conexao.fetchrow(
        f"""
        update {esquema}.aprovacao_excecao
           set status = $2,
               avaliado_por = coalesce($3::uuid, avaliado_por),
               avaliado_em = coalesce($4, avaliado_em),
               observacoes_avaliacao = coalesce($5, observacoes_avaliacao)
         where identificador_aprovacao = $1::uuid
         returning identificador_aprovacao::text as identificador_aprovacao
        """,
        identificador_aprovacao,
        novo_status,
        avaliado_por,
        avaliado_em,
        observacoes_avaliacao,
    )


async def buscar_aprovacao_excecao_aprovada(
    conexao,
    esquema: str,
    *,
    identificador_imovel: str,
    identificador_cliente: str,
    identificador_simulacao: str,
):
    return await conexao.fetchrow(
        f"""
        select
            {CAMPOS_APROVACAO_EXCECAO_SQL}
        from {esquema}.aprovacao_excecao a
        left join {esquema}.cliente c
          on c.identificador_cliente = a.identificador_cliente
        left join {esquema}.imovel i
          on i.identificador_imovel = a.identificador_imovel
        left join {esquema}.simulacao s
          on s.identificador_simulacao = a.identificador_simulacao
        left join {esquema}.imovel_reserva r
          on r.identificador_reserva = a.identificador_reserva
        left join sevenlm_connect.usuario solicitante
          on solicitante.identificador_usuario = a.solicitado_por
        left join sevenlm_connect.usuario avaliador
          on avaliador.identificador_usuario = a.avaliado_por
        where a.identificador_imovel = $1::uuid
          and a.identificador_cliente = $2::uuid
          and a.identificador_simulacao = $3::uuid
          and a.status = 'APROVADA'
        order by a.avaliado_em desc nulls last, a.solicitado_em desc
        limit 1
        """,
        identificador_imovel,
        identificador_cliente,
        identificador_simulacao,
    )
