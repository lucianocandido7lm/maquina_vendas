"""
Persistencia do modulo de Metas e Resultados.
"""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal
from typing import Any


def _json(valor: Any) -> str:
    return json.dumps(valor, ensure_ascii=False, default=str)


def _to_dict(row: Any) -> dict[str, Any] | None:
    return dict(row) if row else None


def _add_eq(condicoes: list[str], args: list[Any], coluna: str, valor: Any, cast: str | None = None) -> None:
    if valor in (None, ""):
        return
    args.append(valor)
    marcador = f"${len(args)}"
    if cast:
        marcador = f"{marcador}::{cast}"
    condicoes.append(f"{coluna} = {marcador}")


def _add_text_search(condicoes: list[str], args: list[Any], colunas: list[str], valor: Any) -> None:
    texto = str(valor or "").strip()
    if not texto:
        return
    args.append(f"%{texto}%")
    marcador = f"${len(args)}"
    condicoes.append("(" + " or ".join(f"{coluna} ilike {marcador}" for coluna in colunas) + ")")


async def listar_indicadores(conexao, esquema: str, incluir_inativos: bool = False):
    linhas = await conexao.fetch(
        f"""
        select id, codigo, nome, descricao, ativo, created_at, updated_at
        from {esquema}.indicadores_meta
        where ($1::boolean = true or ativo = true)
        order by codigo
        """,
        bool(incluir_inativos),
    )
    return [dict(linha) for linha in linhas]


async def buscar_indicador_por_id(conexao, esquema: str, indicador_id: int):
    return _to_dict(
        await conexao.fetchrow(
            f"""
            select id, codigo, nome, descricao, ativo, created_at, updated_at
            from {esquema}.indicadores_meta
            where id = $1
            limit 1
            """,
            int(indicador_id),
        )
    )


async def criar_indicador(conexao, esquema: str, payload: dict[str, Any]):
    return _to_dict(
        await conexao.fetchrow(
            f"""
            insert into {esquema}.indicadores_meta (codigo, nome, descricao, ativo)
            values (upper($1), $2, $3, $4)
            returning id, codigo, nome, descricao, ativo, created_at, updated_at
            """,
            payload["codigo"],
            payload["nome"],
            payload.get("descricao"),
            bool(payload.get("ativo", True)),
        )
    )


async def atualizar_indicador(conexao, esquema: str, indicador_id: int, payload: dict[str, Any]):
    atual = await buscar_indicador_por_id(conexao, esquema, indicador_id)
    if not atual:
        return None
    dados = {
        "codigo": payload.get("codigo", atual["codigo"]),
        "nome": payload.get("nome", atual["nome"]),
        "descricao": payload.get("descricao", atual.get("descricao")),
        "ativo": payload.get("ativo", atual["ativo"]),
    }
    return _to_dict(
        await conexao.fetchrow(
            f"""
            update {esquema}.indicadores_meta
               set codigo = upper($2),
                   nome = $3,
                   descricao = $4,
                   ativo = $5
             where id = $1
             returning id, codigo, nome, descricao, ativo, created_at, updated_at
            """,
            int(indicador_id),
            dados["codigo"],
            dados["nome"],
            dados["descricao"],
            bool(dados["ativo"]),
        )
    )


async def listar_usuarios_meta(conexao, busca: str | None = None, limite: int = 500):
    condicoes = ["u.indicador_ativo = true"]
    args: list[Any] = []
    _add_text_search(condicoes, args, ["u.nome_completo", "u.correio_eletronico", "u.matricula"], busca)
    args.append(int(limite))
    linhas = await conexao.fetch(
        f"""
        select
            u.identificador_usuario::text as identificador_usuario,
            u.nome_completo,
            u.correio_eletronico,
            u.matricula,
            coalesce(array_agg(distinct p.nome_perfil) filter (where p.nome_perfil is not null), '{{}}') as perfis,
            coalesce(array_agg(distinct us.codigo_setor) filter (where us.codigo_setor is not null), '{{}}') as equipes
        from sevenlm_connect.usuario u
        left join sevenlm_connect.usuario_perfil up
          on up.identificador_usuario = u.identificador_usuario
        left join sevenlm_connect.perfil p
          on p.identificador_perfil = up.identificador_perfil
        left join sevenlm_connect.usuario_setor us
          on us.identificador_usuario = u.identificador_usuario
        where {' and '.join(condicoes)}
        group by u.identificador_usuario, u.nome_completo, u.correio_eletronico, u.matricula
        order by u.nome_completo
        limit ${len(args)}
        """,
        *args,
    )
    return [dict(linha) for linha in linhas]


async def buscar_usuario_meta(conexao, identificador_usuario: str):
    return _to_dict(
        await conexao.fetchrow(
            """
            select
                identificador_usuario::text as identificador_usuario,
                nome_completo,
                correio_eletronico,
                matricula,
                indicador_ativo
            from sevenlm_connect.usuario
            where identificador_usuario = $1::uuid
            limit 1
            """,
            identificador_usuario,
        )
    )


async def listar_subordinados_gestor(conexao, esquema: str, gestor_id: str):
    linhas = await conexao.fetch(
        f"""
        select subordinado_id::text as subordinado_id
        from {esquema}.metas_hierarquia_comercial
        where gestor_id = $1::uuid
          and ativo = true
          and (data_inicio is null or data_inicio <= current_date)
          and (data_fim is null or data_fim >= current_date)
        """,
        gestor_id,
    )
    return [linha["subordinado_id"] for linha in linhas]


async def listar_metas_colaboradores(conexao, esquema: str, *, tipo_usuario: str | None = None, filtros: dict[str, Any] | None = None):
    filtros = filtros or {}
    args: list[Any] = []
    condicoes: list[str] = ["m.ativo = true"]

    _add_eq(condicoes, args, "m.tipo_usuario", tipo_usuario)
    _add_eq(condicoes, args, "m.mes_referencia", filtros.get("mes"), "int")
    _add_eq(condicoes, args, "m.ano_referencia", filtros.get("ano"), "int")
    _add_eq(condicoes, args, "m.origem_meta", filtros.get("origem_meta"))
    _add_eq(condicoes, args, "us.codigo_setor", filtros.get("equipe"))

    if filtros.get("corretor"):
        _add_eq(condicoes, args, "m.usuario_id", filtros.get("corretor"), "uuid")
    if filtros.get("gestor"):
        _add_eq(condicoes, args, "h.gestor_id", filtros.get("gestor"), "uuid")
    if filtros.get("indicador"):
        args.append(str(filtros["indicador"]).upper())
        marcador = f"${len(args)}"
        condicoes.append(f"(i.codigo = {marcador} or i.id::text = {marcador})")

    linhas = await conexao.fetch(
        f"""
        select
            m.id::text as id,
            m.usuario_id::text as usuario_id,
            m.tipo_usuario,
            m.indicador_id,
            i.codigo as indicador_codigo,
            i.nome as indicador_nome,
            m.mes_referencia,
            m.ano_referencia,
            case
              when m.tipo_usuario = 'CORRETOR' then coalesce(potencial_corretores.meta_potencial, m.meta_valor, 0)
              when m.tipo_usuario in ('GESTOR', 'COORDENADOR') then coalesce(potencial.meta_potencial, 0)
              else m.meta_potencial
            end as meta_potencial,
            m.meta_valor,
            m.origem_meta,
            m.data_inicio,
            m.data_fim,
            m.ativo,
            m.versao,
            m.criado_por::text as criado_por,
            m.alterado_por::text as alterado_por,
            m.motivo_alteracao,
            m.created_at,
            m.updated_at,
            u.nome_completo as usuario_nome,
            u.correio_eletronico as usuario_email,
            coalesce(r.valor_realizado, 0) as valor_realizado,
            r.id::text as resultado_id,
            r.data_resultado,
            (r.id is not null) as resultado_existe,
            gestor.identificador_usuario::text as gestor_id,
            gestor.nome_completo as gestor_nome,
            coalesce(historico_individual.meses, '[]'::jsonb) as historico_meta_3_meses,
            case
              when m.tipo_usuario = 'CORRETOR' then coalesce(potencial_corretores.meses, '[]'::jsonb)
              else coalesce(historico_individual.meses, '[]'::jsonb)
            end as historico_meta_potencial_3_meses
        from {esquema}.metas_colaboradores m
        join {esquema}.indicadores_meta i
          on i.id = m.indicador_id
        join sevenlm_connect.usuario u
          on u.identificador_usuario = m.usuario_id
        left join {esquema}.resultados_metas r
          on r.usuario_id = m.usuario_id
         and r.indicador_id = m.indicador_id
         and r.mes_referencia = m.mes_referencia
         and r.ano_referencia = m.ano_referencia
        left join {esquema}.metas_hierarquia_comercial h
          on h.subordinado_id = m.usuario_id
         and h.ativo = true
        left join sevenlm_connect.usuario gestor
          on gestor.identificador_usuario = h.gestor_id
        left join sevenlm_connect.usuario_setor us
          on us.identificador_usuario = m.usuario_id
        left join lateral (
            with periodo as (
                select
                    make_date(m.ano_referencia::int, m.mes_referencia::int, 1) as inicio,
                    (make_date(m.ano_referencia::int, m.mes_referencia::int, 1) + interval '1 month - 1 day')::date as fim
            )
            select coalesce(sum(meta_corretor.meta_valor), 0) as meta_potencial
            from {esquema}.metas_hierarquia_comercial hierarquia
            cross join periodo p
            join {esquema}.metas_colaboradores meta_corretor
              on meta_corretor.usuario_id = hierarquia.subordinado_id
             and meta_corretor.ativo = true
             and meta_corretor.tipo_usuario = 'CORRETOR'
             and meta_corretor.indicador_id = m.indicador_id
             and meta_corretor.mes_referencia = m.mes_referencia
             and meta_corretor.ano_referencia = m.ano_referencia
            where hierarquia.gestor_id = m.usuario_id
              and hierarquia.ativo = true
              and (hierarquia.data_inicio is null or hierarquia.data_inicio <= p.fim)
              and (hierarquia.data_fim is null or hierarquia.data_fim >= p.inicio)
        ) potencial on m.tipo_usuario in ('GESTOR', 'COORDENADOR')
        left join lateral (
            with referencia as (
                select make_date(m.ano_referencia::int, m.mes_referencia::int, 1) as inicio
            ),
            base as (
                select
                    meta_hist.usuario_id,
                    meta_hist.mes_referencia,
                    meta_hist.ano_referencia,
                    meta_hist.meta_valor
                from {esquema}.metas_colaboradores meta_hist
                cross join referencia ref
                where meta_hist.ativo = true
                  and meta_hist.tipo_usuario = 'CORRETOR'
                  and meta_hist.indicador_id = m.indicador_id
                  and make_date(meta_hist.ano_referencia::int, meta_hist.mes_referencia::int, 1) >= (ref.inicio - interval '3 months')::date
                  and make_date(meta_hist.ano_referencia::int, meta_hist.mes_referencia::int, 1) < ref.inicio
            ),
            meses as (
                select
                    mes_referencia,
                    ano_referencia,
                    sum(meta_valor) as total_meta,
                    count(distinct usuario_id) as corretores
                from base
                group by ano_referencia, mes_referencia
            ),
            corretores_periodo as (
                select count(distinct usuario_id) as total_corretores
                from base
            )
            select
                case
                  when coalesce(cp.total_corretores, 0) > 0 then coalesce((select sum(meta_valor) from base), 0) / cp.total_corretores
                  else null
                end as meta_potencial,
                coalesce(
                    jsonb_agg(
                        jsonb_build_object(
                            'mes', mes_referencia,
                            'ano', ano_referencia,
                            'meta_valor', case when cp.total_corretores > 0 then total_meta / cp.total_corretores else 0 end,
                            'total_meta', total_meta,
                            'corretores', cp.total_corretores
                        )
                        order by ano_referencia, mes_referencia
                    ),
                    '[]'::jsonb
                ) as meses
            from meses
            cross join corretores_periodo cp
            group by cp.total_corretores
        ) potencial_corretores on m.tipo_usuario = 'CORRETOR'
        left join lateral (
            with referencia as (
                select make_date(m.ano_referencia::int, m.mes_referencia::int, 1) as inicio
            ),
            meses as (
                select
                    meta_hist.mes_referencia,
                    meta_hist.ano_referencia,
                    sum(meta_hist.meta_valor) as meta_valor
                from {esquema}.metas_colaboradores meta_hist
                cross join referencia ref
                where meta_hist.ativo = true
                  and meta_hist.usuario_id = m.usuario_id
                  and meta_hist.tipo_usuario = m.tipo_usuario
                  and meta_hist.indicador_id = m.indicador_id
                  and make_date(meta_hist.ano_referencia::int, meta_hist.mes_referencia::int, 1) >= (ref.inicio - interval '3 months')::date
                  and make_date(meta_hist.ano_referencia::int, meta_hist.mes_referencia::int, 1) < ref.inicio
                group by meta_hist.ano_referencia, meta_hist.mes_referencia
            )
            select coalesce(
                jsonb_agg(
                    jsonb_build_object(
                        'mes', mes_referencia,
                        'ano', ano_referencia,
                        'meta_valor', meta_valor
                    )
                    order by ano_referencia, mes_referencia
                ),
                '[]'::jsonb
            ) as meses
            from meses
        ) historico_individual on true
        where {' and '.join(condicoes)}
        order by m.ano_referencia desc, m.mes_referencia desc, u.nome_completo, i.codigo, m.versao desc
        """,
        *args,
    )
    return [dict(linha) for linha in linhas]


async def buscar_meta_colaborador_por_id(conexao, esquema: str, meta_id: str, *, for_update: bool = False):
    sufixo = " for update" if for_update else ""
    return _to_dict(
        await conexao.fetchrow(
            f"""
            select
                m.*,
                m.id::text as id,
                m.usuario_id::text as usuario_id,
                m.criado_por::text as criado_por,
                m.alterado_por::text as alterado_por
            from {esquema}.metas_colaboradores m
            where m.id = $1::uuid
            limit 1{sufixo}
            """,
            meta_id,
        )
    )


async def buscar_meta_colaborador_ativa(conexao, esquema: str, payload: dict[str, Any], *, for_update: bool = False):
    sufixo = " for update" if for_update else ""
    return _to_dict(
        await conexao.fetchrow(
            f"""
            select *, id::text as id, usuario_id::text as usuario_id
            from {esquema}.metas_colaboradores
            where usuario_id = $1::uuid
              and tipo_usuario = $2
              and indicador_id = $3
              and mes_referencia = $4
              and ano_referencia = $5
              and origem_meta = $6
              and ativo = true
            order by versao desc
            limit 1{sufixo}
            """,
            payload["usuario_id"],
            payload["tipo_usuario"],
            int(payload["indicador_id"]),
            int(payload["mes_referencia"]),
            int(payload["ano_referencia"]),
            payload.get("origem_meta", "MANUAL"),
        )
    )


async def maior_versao_meta_colaborador(conexao, esquema: str, payload: dict[str, Any]) -> int:
    return int(
        await conexao.fetchval(
            f"""
            select coalesce(max(versao), 0)
            from {esquema}.metas_colaboradores
            where usuario_id = $1::uuid
              and tipo_usuario = $2
              and indicador_id = $3
              and mes_referencia = $4
              and ano_referencia = $5
              and origem_meta = $6
            """,
            payload["usuario_id"],
            payload["tipo_usuario"],
            int(payload["indicador_id"]),
            int(payload["mes_referencia"]),
            int(payload["ano_referencia"]),
            payload.get("origem_meta", "MANUAL"),
        )
        or 0
    )


async def inativar_meta_colaborador(conexao, esquema: str, meta_id: str, *, data_fim: date, alterado_por: str, motivo: str | None):
    return _to_dict(
        await conexao.fetchrow(
            f"""
            update {esquema}.metas_colaboradores
               set ativo = false,
                   data_fim = least(data_fim, $2::date),
                   alterado_por = $3::uuid,
                   motivo_alteracao = coalesce($4, motivo_alteracao)
             where id = $1::uuid
             returning *, id::text as id, usuario_id::text as usuario_id
            """,
            meta_id,
            data_fim,
            alterado_por,
            motivo,
        )
    )


async def inserir_meta_colaborador(conexao, esquema: str, payload: dict[str, Any]):
    return _to_dict(
        await conexao.fetchrow(
            f"""
            insert into {esquema}.metas_colaboradores (
                usuario_id, tipo_usuario, indicador_id, mes_referencia, ano_referencia,
                meta_potencial, meta_valor, origem_meta, data_inicio, data_fim,
                ativo, versao, criado_por, alterado_por, motivo_alteracao
            )
            values (
                $1::uuid, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                true, $11, $12::uuid, $13::uuid, $14
            )
            returning *, id::text as id, usuario_id::text as usuario_id
            """,
            payload["usuario_id"],
            payload["tipo_usuario"],
            int(payload["indicador_id"]),
            int(payload["mes_referencia"]),
            int(payload["ano_referencia"]),
            payload.get("meta_potencial"),
            payload["meta_valor"],
            payload.get("origem_meta", "MANUAL"),
            payload["data_inicio"],
            payload["data_fim"],
            int(payload.get("versao", 1)),
            payload.get("criado_por"),
            payload.get("alterado_por"),
            payload.get("motivo_alteracao"),
        )
    )


async def registrar_historico(conexao, esquema: str, payload: dict[str, Any]):
    return _to_dict(
        await conexao.fetchrow(
            f"""
            insert into {esquema}.historico_metas (
                meta_id, tipo_meta, acao, valor_anterior, valor_novo,
                usuario_responsavel, motivo
            )
            values ($1::uuid, $2, $3, $4::jsonb, $5::jsonb, $6::uuid, $7)
            returning id::text as id, meta_id::text as meta_id, tipo_meta, acao, valor_anterior, valor_novo,
                      usuario_responsavel::text as usuario_responsavel, motivo, created_at
            """,
            payload["meta_id"],
            payload["tipo_meta"],
            payload["acao"],
            _json(payload.get("valor_anterior")),
            _json(payload.get("valor_novo")),
            payload.get("usuario_responsavel"),
            payload.get("motivo"),
        )
    )


async def listar_historico_meta(conexao, esquema: str, meta_id: str, tipo_meta: str | None = None):
    args = [meta_id]
    condicoes = ["h.meta_id = $1::uuid"]
    if tipo_meta:
        args.append(tipo_meta)
        condicoes.append(f"h.tipo_meta = ${len(args)}")
    linhas = await conexao.fetch(
        f"""
        select
            h.id::text as id,
            h.meta_id::text as meta_id,
            h.tipo_meta,
            h.acao,
            h.valor_anterior,
            h.valor_novo,
            h.usuario_responsavel::text as usuario_responsavel,
            h.motivo,
            h.created_at,
            u.nome_completo as usuario_responsavel_nome,
            u.correio_eletronico as usuario_responsavel_email
        from {esquema}.historico_metas h
        left join sevenlm_connect.usuario u
          on u.identificador_usuario = h.usuario_responsavel
        where {' and '.join(condicoes)}
        order by h.created_at desc
        """,
        *args,
    )
    return [dict(linha) for linha in linhas]


async def listar_historico_geral(conexao, esquema: str, filtros: dict[str, Any] | None = None):
    filtros = filtros or {}
    args: list[Any] = []
    condicoes: list[str] = ["1 = 1"]
    _add_eq(condicoes, args, "h.tipo_meta", filtros.get("tipo_meta"))
    _add_eq(condicoes, args, "h.acao", filtros.get("acao"))
    if filtros.get("usuario_responsavel"):
        _add_eq(condicoes, args, "h.usuario_responsavel", filtros.get("usuario_responsavel"), "uuid")
    if filtros.get("mes"):
        args.append(str(filtros["mes"]))
        marcador = f"${len(args)}"
        condicoes.append(f"coalesce(h.valor_novo->>'mes_referencia', h.valor_anterior->>'mes_referencia') = {marcador}")
    if filtros.get("ano"):
        args.append(str(filtros["ano"]))
        marcador = f"${len(args)}"
        condicoes.append(f"coalesce(h.valor_novo->>'ano_referencia', h.valor_anterior->>'ano_referencia') = {marcador}")
    if filtros.get("pessoa"):
        args.append(str(filtros["pessoa"]))
        marcador = f"${len(args)}"
        condicoes.append(
            "("
            "coalesce(h.valor_novo->>'usuario_id', h.valor_novo->>'pessoa_id', h.valor_anterior->>'usuario_id', h.valor_anterior->>'pessoa_id') = "
            f"{marcador}"
            ")"
        )
    if filtros.get("indicador"):
        args.append(str(filtros["indicador"]).upper())
        marcador = f"${len(args)}"
        condicoes.append(
            "("
            "coalesce(h.valor_novo->>'indicador_id', h.valor_anterior->>'indicador_id') = "
            f"{marcador} or ind.codigo = {marcador} or coalesce(h.valor_novo->>'indicador', h.valor_anterior->>'indicador') = {marcador}"
            ")"
        )
    linhas = await conexao.fetch(
        f"""
        select
            h.id::text as id,
            h.meta_id::text as meta_id,
            h.tipo_meta,
            h.acao,
            h.valor_anterior,
            h.valor_novo,
            h.usuario_responsavel::text as usuario_responsavel,
            h.motivo,
            h.created_at,
            u.nome_completo as usuario_responsavel_nome,
            u.correio_eletronico as usuario_responsavel_email,
            pessoa.nome_completo as pessoa_impactada_nome,
            pessoa.identificador_usuario::text as pessoa_impactada_id,
            ind.codigo as indicador_codigo,
            ind.nome as indicador_nome
        from {esquema}.historico_metas h
        left join sevenlm_connect.usuario u
          on u.identificador_usuario = h.usuario_responsavel
        left join sevenlm_connect.usuario pessoa
          on pessoa.identificador_usuario::text = coalesce(
            h.valor_novo->>'usuario_id',
            h.valor_novo->>'pessoa_id',
            h.valor_anterior->>'usuario_id',
            h.valor_anterior->>'pessoa_id'
          )
        left join {esquema}.indicadores_meta ind
          on ind.id::text = coalesce(h.valor_novo->>'indicador_id', h.valor_anterior->>'indicador_id')
        where {' and '.join(condicoes)}
        order by h.created_at desc
        limit 500
        """,
        *args,
    )
    return [dict(linha) for linha in linhas]


async def listar_metas_gerenciais(conexao, esquema: str, filtros: dict[str, Any] | None = None):
    filtros = filtros or {}
    args: list[Any] = []
    condicoes: list[str] = ["m.ativo = true"]
    _add_eq(condicoes, args, "m.mes_referencia", filtros.get("mes"), "int")
    _add_eq(condicoes, args, "m.ano_referencia", filtros.get("ano"), "int")
    _add_eq(condicoes, args, "m.tipo_meta", filtros.get("tipo_meta"))
    _add_eq(condicoes, args, "m.regiao_id", filtros.get("regional"))
    _add_eq(condicoes, args, "m.empreendimento_id", filtros.get("empreendimento"))
    _add_eq(condicoes, args, "m.origem_meta", filtros.get("origem_meta"))
    if filtros.get("pessoa"):
        _add_eq(condicoes, args, "m.pessoa_id", filtros.get("pessoa"), "uuid")
    if filtros.get("indicador"):
        args.append(str(filtros["indicador"]).upper())
        marcador = f"${len(args)}"
        condicoes.append(f"(i.codigo = {marcador} or i.id::text = {marcador})")
    linhas = await conexao.fetch(
        f"""
        select
            m.id::text as id,
            m.pessoa_id::text as pessoa_id,
            pessoa.nome_completo as pessoa_nome,
            m.visao_meta,
            m.tipo_meta,
            m.regiao_id,
            m.empreendimento_id,
            m.indicador_id,
            i.codigo as indicador_codigo,
            i.nome as indicador_nome,
            m.meta_regra,
            m.meta_valor,
            m.fato_1,
            m.fato_2,
            m.fato_consolidado,
            m.peso,
            m.observacao,
            m.mes_referencia,
            m.ano_referencia,
            m.origem_meta,
            m.data_inicio,
            m.data_fim,
            m.ativo,
            m.versao,
            m.criado_por::text as criado_por,
            m.alterado_por::text as alterado_por,
            m.created_at,
            m.updated_at,
            coalesce(historico_gerencial.meses, '[]'::jsonb) as historico_meta_3_meses
        from {esquema}.metas_gerenciais m
        join {esquema}.indicadores_meta i
          on i.id = m.indicador_id
        left join sevenlm_connect.usuario pessoa
          on pessoa.identificador_usuario = m.pessoa_id
        left join lateral (
            with referencia as (
                select make_date(m.ano_referencia::int, m.mes_referencia::int, 1) as inicio
            ),
            meses as (
                select
                    meta_hist.mes_referencia,
                    meta_hist.ano_referencia,
                    sum(coalesce(meta_hist.meta_valor, meta_hist.fato_consolidado, 0)) as meta_valor
                from {esquema}.metas_gerenciais meta_hist
                cross join referencia ref
                where meta_hist.ativo = true
                  and meta_hist.tipo_meta = m.tipo_meta
                  and meta_hist.indicador_id = m.indicador_id
                  and coalesce(meta_hist.pessoa_id::text, '') = coalesce(m.pessoa_id::text, '')
                  and coalesce(meta_hist.visao_meta, '') = coalesce(m.visao_meta, '')
                  and coalesce(meta_hist.regiao_id, '') = coalesce(m.regiao_id, '')
                  and coalesce(meta_hist.empreendimento_id, '') = coalesce(m.empreendimento_id, '')
                  and make_date(meta_hist.ano_referencia::int, meta_hist.mes_referencia::int, 1) >= (ref.inicio - interval '3 months')::date
                  and make_date(meta_hist.ano_referencia::int, meta_hist.mes_referencia::int, 1) < ref.inicio
                group by meta_hist.ano_referencia, meta_hist.mes_referencia
            )
            select coalesce(
                jsonb_agg(
                    jsonb_build_object(
                        'mes', mes_referencia,
                        'ano', ano_referencia,
                        'meta_valor', meta_valor
                    )
                    order by ano_referencia, mes_referencia
                ),
                '[]'::jsonb
            ) as meses
            from meses
        ) historico_gerencial on true
        where {' and '.join(condicoes)}
        order by m.ano_referencia desc, m.mes_referencia desc, m.tipo_meta, i.codigo, m.versao desc
        """,
        *args,
    )
    return [dict(linha) for linha in linhas]


async def buscar_meta_gerencial_por_id(conexao, esquema: str, meta_id: str, *, for_update: bool = False):
    sufixo = " for update" if for_update else ""
    return _to_dict(
        await conexao.fetchrow(
            f"""
            select *, id::text as id, pessoa_id::text as pessoa_id, criado_por::text as criado_por, alterado_por::text as alterado_por
            from {esquema}.metas_gerenciais
            where id = $1::uuid
            limit 1{sufixo}
            """,
            meta_id,
        )
    )


async def maior_versao_meta_gerencial(conexao, esquema: str, payload: dict[str, Any]) -> int:
    return int(
        await conexao.fetchval(
            f"""
            select coalesce(max(versao), 0)
            from {esquema}.metas_gerenciais
            where coalesce(pessoa_id::text, '') = coalesce($1, '')
              and coalesce(visao_meta, '') = coalesce($2, '')
              and tipo_meta = $3
              and coalesce(regiao_id, '') = coalesce($4, '')
              and coalesce(empreendimento_id, '') = coalesce($5, '')
              and indicador_id = $6
              and mes_referencia = $7
              and ano_referencia = $8
            """,
            payload.get("pessoa_id"),
            payload.get("visao_meta"),
            payload["tipo_meta"],
            payload.get("regiao_id"),
            payload.get("empreendimento_id"),
            int(payload["indicador_id"]),
            int(payload["mes_referencia"]),
            int(payload["ano_referencia"]),
        )
        or 0
    )


async def buscar_meta_gerencial_ativa(conexao, esquema: str, payload: dict[str, Any], *, for_update: bool = False):
    sufixo = " for update" if for_update else ""
    return _to_dict(
        await conexao.fetchrow(
            f"""
            select *, id::text as id, pessoa_id::text as pessoa_id
            from {esquema}.metas_gerenciais
            where coalesce(pessoa_id::text, '') = coalesce($1, '')
              and coalesce(visao_meta, '') = coalesce($2, '')
              and tipo_meta = $3
              and coalesce(regiao_id, '') = coalesce($4, '')
              and coalesce(empreendimento_id, '') = coalesce($5, '')
              and indicador_id = $6
              and mes_referencia = $7
              and ano_referencia = $8
              and ativo = true
            order by versao desc
            limit 1{sufixo}
            """,
            payload.get("pessoa_id"),
            payload.get("visao_meta"),
            payload["tipo_meta"],
            payload.get("regiao_id"),
            payload.get("empreendimento_id"),
            int(payload["indicador_id"]),
            int(payload["mes_referencia"]),
            int(payload["ano_referencia"]),
        )
    )


async def inativar_meta_gerencial(conexao, esquema: str, meta_id: str, *, data_fim: date, alterado_por: str):
    return _to_dict(
        await conexao.fetchrow(
            f"""
            update {esquema}.metas_gerenciais
               set ativo = false,
                   data_fim = least(data_fim, $2::date),
                   alterado_por = $3::uuid
             where id = $1::uuid
             returning *, id::text as id, pessoa_id::text as pessoa_id
            """,
            meta_id,
            data_fim,
            alterado_por,
        )
    )


async def inserir_meta_gerencial(conexao, esquema: str, payload: dict[str, Any]):
    return _to_dict(
        await conexao.fetchrow(
            f"""
            insert into {esquema}.metas_gerenciais (
                pessoa_id, visao_meta, tipo_meta, regiao_id, empreendimento_id,
                indicador_id, meta_regra, meta_valor, fato_1, fato_2,
                fato_consolidado, peso, observacao, mes_referencia, ano_referencia,
                origem_meta, data_inicio, data_fim, ativo, versao, criado_por, alterado_por
            )
            values (
                $1::uuid, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15,
                $16, $17, $18, true, $19, $20::uuid, $21::uuid
            )
            returning *, id::text as id, pessoa_id::text as pessoa_id
            """,
            payload.get("pessoa_id"),
            payload.get("visao_meta"),
            payload["tipo_meta"],
            payload.get("regiao_id"),
            payload.get("empreendimento_id"),
            int(payload["indicador_id"]),
            payload.get("meta_regra"),
            payload.get("meta_valor"),
            payload.get("fato_1"),
            payload.get("fato_2"),
            payload.get("fato_consolidado"),
            payload.get("peso"),
            payload.get("observacao"),
            int(payload["mes_referencia"]),
            int(payload["ano_referencia"]),
            payload.get("origem_meta", "MANUAL"),
            payload["data_inicio"],
            payload["data_fim"],
            int(payload.get("versao", 1)),
            payload.get("criado_por"),
            payload.get("alterado_por"),
        )
    )


async def calcular_meta_automatica_gestor(conexao, esquema: str, gestor_id: str, indicador_id: int, mes: int, ano: int) -> Decimal:
    valor = await conexao.fetchval(
        f"""
        with periodo as (
            select
                make_date($4::int, $3::int, 1) as inicio,
                (make_date($4::int, $3::int, 1) + interval '1 month - 1 day')::date as fim
        )
        select coalesce(sum(m.meta_valor), 0)
        from {esquema}.metas_hierarquia_comercial h
        cross join periodo p
        join {esquema}.metas_colaboradores m
          on m.usuario_id = h.subordinado_id
         and m.ativo = true
         and m.tipo_usuario = 'CORRETOR'
         and m.indicador_id = $2
         and m.mes_referencia = $3
         and m.ano_referencia = $4
        where h.gestor_id = $1::uuid
          and h.ativo = true
          and (h.data_inicio is null or h.data_inicio <= p.fim)
          and (h.data_fim is null or h.data_fim >= p.inicio)
        """,
        gestor_id,
        int(indicador_id),
        int(mes),
        int(ano),
    )
    return Decimal(str(valor or 0))


async def listar_resultados(conexao, esquema: str, filtros: dict[str, Any] | None = None):
    filtros = filtros or {}
    args: list[Any] = []
    condicoes: list[str] = ["1 = 1"]
    _add_eq(condicoes, args, "r.mes_referencia", filtros.get("mes"), "int")
    _add_eq(condicoes, args, "r.ano_referencia", filtros.get("ano"), "int")
    _add_eq(condicoes, args, "r.origem_resultado", filtros.get("origem_resultado"))
    _add_eq(condicoes, args, "us.codigo_setor", filtros.get("equipe"))
    if filtros.get("corretor"):
        _add_eq(condicoes, args, "r.usuario_id", filtros.get("corretor"), "uuid")
    if filtros.get("gestor"):
        _add_eq(condicoes, args, "h.gestor_id", filtros.get("gestor"), "uuid")
    if filtros.get("indicador"):
        args.append(str(filtros["indicador"]).upper())
        marcador = f"${len(args)}"
        condicoes.append(f"(i.codigo = {marcador} or i.id::text = {marcador})")
    linhas = await conexao.fetch(
        f"""
        select
            r.id::text as id,
            r.usuario_id::text as usuario_id,
            u.nome_completo as usuario_nome,
            u.correio_eletronico as usuario_email,
            r.indicador_id,
            i.codigo as indicador_codigo,
            i.nome as indicador_nome,
            r.mes_referencia,
            r.ano_referencia,
            r.valor_realizado,
            r.origem_resultado,
            r.data_resultado,
            r.created_at,
            r.updated_at
        from {esquema}.resultados_metas r
        join {esquema}.indicadores_meta i
          on i.id = r.indicador_id
        join sevenlm_connect.usuario u
          on u.identificador_usuario = r.usuario_id
        left join {esquema}.metas_hierarquia_comercial h
          on h.subordinado_id = r.usuario_id
         and h.ativo = true
        left join sevenlm_connect.usuario_setor us
          on us.identificador_usuario = r.usuario_id
        where {' and '.join(condicoes)}
        order by r.ano_referencia desc, r.mes_referencia desc, u.nome_completo, i.codigo
        """,
        *args,
    )
    return [dict(linha) for linha in linhas]


async def buscar_resultado_por_id(conexao, esquema: str, resultado_id: str):
    return _to_dict(
        await conexao.fetchrow(
            f"""
            select *, id::text as id, usuario_id::text as usuario_id
            from {esquema}.resultados_metas
            where id = $1::uuid
            limit 1
            """,
            resultado_id,
        )
    )


async def inserir_resultado(conexao, esquema: str, payload: dict[str, Any]):
    return _to_dict(
        await conexao.fetchrow(
            f"""
            insert into {esquema}.resultados_metas (
                usuario_id, indicador_id, mes_referencia, ano_referencia,
                valor_realizado, origem_resultado, data_resultado
            )
            values ($1::uuid, $2, $3, $4, $5, $6, $7)
            on conflict (usuario_id, indicador_id, mes_referencia, ano_referencia)
            do update set
                valor_realizado = excluded.valor_realizado,
                origem_resultado = excluded.origem_resultado,
                data_resultado = excluded.data_resultado
            returning *, id::text as id, usuario_id::text as usuario_id
            """,
            payload["usuario_id"],
            int(payload["indicador_id"]),
            int(payload["mes_referencia"]),
            int(payload["ano_referencia"]),
            payload["valor_realizado"],
            payload.get("origem_resultado", "MANUAL"),
            payload["data_resultado"],
        )
    )


async def atualizar_resultado(conexao, esquema: str, resultado_id: str, payload: dict[str, Any]):
    return _to_dict(
        await conexao.fetchrow(
            f"""
            update {esquema}.resultados_metas
               set usuario_id = $2::uuid,
                   indicador_id = $3,
                   mes_referencia = $4,
                   ano_referencia = $5,
                   valor_realizado = $6,
                   origem_resultado = $7,
                   data_resultado = $8
             where id = $1::uuid
             returning *, id::text as id, usuario_id::text as usuario_id
            """,
            resultado_id,
            payload["usuario_id"],
            int(payload["indicador_id"]),
            int(payload["mes_referencia"]),
            int(payload["ano_referencia"]),
            payload["valor_realizado"],
            payload.get("origem_resultado", "MANUAL"),
            payload["data_resultado"],
        )
    )


async def listar_referencias(conexao, esquema: str):
    indicadores = await listar_indicadores(conexao, esquema, incluir_inativos=False)
    usuarios = await listar_usuarios_meta(conexao, limite=1000)
    regioes = await conexao.fetch(
        """
        select distinct cidade as valor
        from connect_comercial.imovel
        where cidade is not null and btrim(cidade) <> ''
        order by cidade
        limit 300
        """
    )
    empreendimentos = await conexao.fetch(
        """
        select distinct titulo as valor
        from connect_comercial.imovel
        where titulo is not null and btrim(titulo) <> ''
        order by titulo
        limit 500
        """
    )
    equipes = await conexao.fetch(
        """
        select codigo_setor as codigo, nome_setor as nome
        from sevenlm_connect.setor
        order by nome_setor
        """
    )
    return {
        "indicadores": indicadores,
        "usuarios": usuarios,
        "regioes": [dict(item) for item in regioes],
        "empreendimentos": [dict(item) for item in empreendimentos],
        "equipes": [dict(item) for item in equipes],
    }
