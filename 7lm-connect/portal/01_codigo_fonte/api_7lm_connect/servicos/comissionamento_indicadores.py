"""
Indicadores oficiais para comissionamento.

Centraliza a leitura de realizado a partir das mesmas bases usadas nas abas de
Corretor Consolidado, Corretor Foguete e Corretor Diario: comercial_kpi_daily
e funcionario_acesso. O escopo atual e apenas gestores/coordenadores.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
import json
from typing import Any

from configuracoes import ESQUEMA_BANCO, ESQUEMA_COMERCIAL


INDICADORES_KPI = (
    "leads",
    "visitas",
    "propostas_aprovadas",
    "propostas_total",
    "vendas",
    "repasses",
    "cancelamentos",
    "distratos",
)

INDICADORES_RESULTADOS_METAS = (
    ("leads", "LEADS"),
    ("visitas", "VISITAS"),
    ("propostas_total", "PROPOSTAS"),
    ("vendas", "VENDAS_FINALIZADAS"),
    ("repasses", "REPASSES"),
    ("cancelamentos", "CANCELAMENTOS"),
    ("distratos", "DISTRATOS"),
    ("ipc", "IPC"),
    ("sobrepreco_medio", "SOBREPRECO"),
)

STATUS_REALIZADO_EDITAVEL = {
    "calculado",
    "calculada",
    "calculado_seed",
    "pendente_secretaria",
    "em_revisao_secretaria",
    "revisao_necessaria",
    "rejeitada",
}


@dataclass(frozen=True)
class RealizadoComissionamento:
    valores: dict[str, Decimal]
    fonte: str
    linhas_fonte: int
    corretores_fonte: int
    criterio_vinculo: str
    usuario_id: str | None = None
    funcionario_id: str | None = None

    def valor(self, indicador: str) -> Decimal:
        return self.valores.get(indicador, Decimal("0"))


def serializar_decimal(valor: Decimal) -> float:
    return float(valor)


def payload_realizado(resultado: dict[str, Any], realizado: RealizadoComissionamento) -> dict[str, Any]:
    return {
        "fonte": realizado.fonte,
        "linhas_fonte": realizado.linhas_fonte,
        "corretores_fonte": realizado.corretores_fonte,
        "criterio_vinculo": realizado.criterio_vinculo,
        "usuario_id": realizado.usuario_id,
        "identificador_funcionario": realizado.funcionario_id or str(resultado.get("identificador_funcionario") or ""),
        "email": resultado.get("email"),
        "documento": resultado.get("documento"),
        "valores": {
            indicador: serializar_decimal(realizado.valor(indicador))
            for indicador, _ in INDICADORES_RESULTADOS_METAS
        },
    }


def decimalizar(valor: Any) -> Decimal:
    return Decimal(str(valor or 0))


def normalizar_texto(valor: Any) -> str:
    return " ".join(str(valor or "").strip().lower().split())


def realizado_editavel(registro: dict[str, Any]) -> bool:
    return normalizar_texto(registro.get("status") or "calculado") in STATUS_REALIZADO_EDITAVEL


def _json_objeto(valor: Any) -> dict[str, Any]:
    if isinstance(valor, dict):
        return valor
    if isinstance(valor, str):
        try:
            carregado = json.loads(valor)
            return carregado if isinstance(carregado, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _realizado_congelado(registro: dict[str, Any]) -> RealizadoComissionamento | None:
    validacao = _json_objeto(registro.get("validacao_lideranca"))
    payload = _json_objeto(validacao.get("realizado_oficial"))
    valores_payload = _json_objeto(payload.get("valores"))
    if not valores_payload:
        return None
    valores = {indicador: decimalizar(valores_payload.get(indicador)) for indicador in INDICADORES_KPI}
    valores["ipc"] = decimalizar(valores_payload.get("ipc"))
    valores["sobrepreco_medio"] = decimalizar(valores_payload.get("sobrepreco_medio"))
    fonte = str(payload.get("fonte") or "realizado_oficial")
    if not fonte.endswith(".congelado"):
        fonte = f"{fonte}.congelado"
    return RealizadoComissionamento(
        valores=valores,
        fonte=fonte,
        linhas_fonte=int(payload.get("linhas_fonte") or 0),
        corretores_fonte=int(payload.get("corretores_fonte") or 0),
        criterio_vinculo=str(payload.get("criterio_vinculo") or "realizado_congelado"),
        usuario_id=payload.get("usuario_id"),
        funcionario_id=payload.get("identificador_funcionario"),
    )


def periodo_ciclo(ciclo_id: str) -> tuple[date, date, int, int]:
    ano_texto, mes_texto = str(ciclo_id).split("-", 1)
    ano = int(ano_texto)
    mes = int(mes_texto[:2])
    inicio = date(ano, mes, 1)
    fim = date(ano + (1 if mes == 12 else 0), 1 if mes == 12 else mes + 1, 1)
    fim = date.fromordinal(fim.toordinal() - 1)
    return inicio, fim, ano, mes


def papel_lideranca(registro: dict[str, Any]) -> str | None:
    texto = normalizar_texto(
        " ".join(
            str(registro.get(campo) or "")
            for campo in ("papel_comissionamento", "cargo", "funcao", "perfil_acesso")
        )
    )
    if "coord" in texto:
        return "coordenador"
    if "gerente" in texto or "gestor" in texto or "gerencia" in texto:
        return "gestor"
    return None


def metricas_vazias(
    fonte: str,
    criterio: str = "sem_vinculo",
    usuario_id: str | None = None,
    funcionario_id: str | None = None,
) -> RealizadoComissionamento:
    valores = {indicador: Decimal("0") for indicador in INDICADORES_KPI}
    valores["ipc"] = Decimal("0")
    valores["sobrepreco_medio"] = Decimal("0")
    return RealizadoComissionamento(valores, fonte, 0, 0, criterio, usuario_id, funcionario_id)


def _somar_linhas(
    linhas: list[dict[str, Any]],
    fonte: str,
    criterio: str,
    usuario_id: str | None,
    funcionario_id: str | None,
) -> RealizadoComissionamento:
    valores = {indicador: Decimal("0") for indicador in INDICADORES_KPI}
    corretores = {normalizar_texto(linha.get("corretor")) for linha in linhas if normalizar_texto(linha.get("corretor"))}
    for linha in linhas:
        for indicador in INDICADORES_KPI:
            valores[indicador] += decimalizar(linha.get(indicador))
    valores["ipc"] = (valores["repasses"] / Decimal(len(corretores))).quantize(Decimal("0.01")) if corretores else Decimal("0")
    valores["sobrepreco_medio"] = Decimal("0")
    return RealizadoComissionamento(valores, fonte, len(linhas), len(corretores), criterio, usuario_id, funcionario_id)


async def resolver_identidade_lideranca(conexao, registro: dict[str, Any]) -> tuple[str | None, str | None, str]:
    usuario_direto = registro.get("identificador_usuario")
    if usuario_direto:
        return str(usuario_direto), str(registro.get("identificador_funcionario") or ""), "identificador_usuario"

    linha = await conexao.fetchrow(
        f"""
        with candidatos as (
            select
                fa.identificador_usuario,
                fa.identificador_funcionario,
                1 as prioridade,
                'identificador_funcionario' as criterio,
                fa.data_hora_atualizado_em
            from {ESQUEMA_BANCO}.funcionario_acesso fa
            where fa.identificador_funcionario = $1::uuid
              and $1::uuid is not null
            union all
            select
                fa.identificador_usuario,
                fa.identificador_funcionario,
                2 as prioridade,
                'documento' as criterio,
                fa.data_hora_atualizado_em
            from {ESQUEMA_BANCO}.funcionario_acesso fa
            where regexp_replace(coalesce(fa.documento, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce($2, ''), '[^0-9]', '', 'g')
              and coalesce($2, '') <> ''
            union all
            select
                fa.identificador_usuario,
                fa.identificador_funcionario,
                3 as prioridade,
                'email' as criterio,
                fa.data_hora_atualizado_em
            from {ESQUEMA_BANCO}.funcionario_acesso fa
            where lower(fa.email::text) = lower($3)
              and coalesce($3, '') <> ''
            union all
            select
                fa.identificador_usuario,
                fa.identificador_funcionario,
                4 as prioridade,
                'nome' as criterio,
                fa.data_hora_atualizado_em
            from {ESQUEMA_BANCO}.funcionario_acesso fa
            where lower(unaccent(fa.nome)) = lower(unaccent($4))
              and coalesce($4, '') <> ''
            union all
            select
                u.identificador_usuario,
                null::uuid as identificador_funcionario,
                5 as prioridade,
                'usuario.email' as criterio,
                u.data_hora_atualizado_em
            from {ESQUEMA_BANCO}.usuario u
            where lower(u.correio_eletronico::text) = lower($3)
              and coalesce($3, '') <> ''
              and u.indicador_ativo = true
            union all
            select
                u.identificador_usuario,
                null::uuid as identificador_funcionario,
                6 as prioridade,
                'usuario.nome_unico' as criterio,
                u.data_hora_atualizado_em
            from {ESQUEMA_BANCO}.usuario u
            where lower(unaccent(u.nome_completo)) = lower(unaccent($4))
              and coalesce($4, '') <> ''
              and u.indicador_ativo = true
              and (
                  select count(*)
                  from {ESQUEMA_BANCO}.usuario ux
                  where lower(unaccent(ux.nome_completo)) = lower(unaccent($4))
                    and ux.indicador_ativo = true
              ) = 1
        )
        select
            identificador_usuario::text as usuario_id,
            identificador_funcionario::text as funcionario_id,
            case
                when identificador_usuario is null and identificador_funcionario is not null
                    then criterio || '.sem_usuario'
                else criterio
            end as criterio
        from candidatos
        order by prioridade, data_hora_atualizado_em desc nulls last
        limit 1
        """,
        registro.get("identificador_funcionario"),
        registro.get("documento"),
        registro.get("email"),
        registro.get("nome"),
    )
    if not linha:
        return None, None, "sem_vinculo"
    return linha["usuario_id"], linha["funcionario_id"], linha["criterio"]


async def resolver_usuario_lideranca(conexao, registro: dict[str, Any]) -> tuple[str | None, str]:
    usuario_id, _, criterio = await resolver_identidade_lideranca(conexao, registro)
    return usuario_id, criterio


async def buscar_realizado_lideranca(conexao, registro: dict[str, Any], ciclo_id: str) -> RealizadoComissionamento:
    papel = papel_lideranca(registro)
    if papel not in {"gestor", "coordenador"}:
        return metricas_vazias("fora_escopo_lideranca", "fora_escopo")
    if not realizado_editavel(registro):
        congelado = _realizado_congelado(registro)
        if congelado:
            return congelado

    inicio, fim, _, _ = periodo_ciclo(ciclo_id)
    usuario_id, funcionario_id, criterio = await resolver_identidade_lideranca(conexao, registro)
    nome = registro.get("nome")
    campo_lider = "coordenacao" if papel == "coordenador" else "gerencia"
    linhas = [
        dict(linha)
        for linha in await conexao.fetch(
            f"""
            select *
            from {ESQUEMA_COMERCIAL}.comercial_kpi_daily
            where data between $1 and $2
              and lower(unaccent(coalesce({campo_lider}, ''))) = lower(unaccent($3))
            """,
            inicio,
            fim,
            nome,
        )
    ]
    if not linhas:
        return metricas_vazias("comercial_kpi_daily.sem_linhas_lideranca", criterio, usuario_id, funcionario_id)
    return _somar_linhas(linhas, f"comercial_kpi_daily.{campo_lider}", criterio, usuario_id, funcionario_id)


async def buscar_meta_colaborador(conexao, usuario_id: str | None, ano: int, mes: int, codigos: tuple[str, ...]):
    if not usuario_id:
        return None
    return await conexao.fetchrow(
        f"""
        select m.id, m.meta_valor as valor_meta, i.codigo as indicador
        from {ESQUEMA_COMERCIAL}.metas_colaboradores m
        join {ESQUEMA_COMERCIAL}.indicadores_meta i on i.id = m.indicador_id
        where m.usuario_id = $1::uuid
          and m.ano_referencia = $2
          and m.mes_referencia = $3
          and m.ativo = true
          and upper(i.codigo) = any($4::text[])
        order by m.updated_at desc
        limit 1
        """,
        usuario_id,
        ano,
        mes,
        list(codigos),
    )


async def materializar_resultados_metas_lideranca(conexao, ciclo_id: str, aplicar: bool = False) -> dict[str, Any]:
    _, _, ano, mes = periodo_ciclo(ciclo_id)
    indicadores = {
        linha["codigo"].upper(): linha["id"]
        for linha in await conexao.fetch(f"select id, codigo from {ESQUEMA_COMERCIAL}.indicadores_meta where ativo = true")
    }
    resultados = [
        dict(linha)
        for linha in await conexao.fetch(
            """
            select *
            from comissionamento.resultados
            where ciclo_id = $1
              and lower(coalesce(papel_comissionamento, '') || ' ' || coalesce(cargo, '') || ' ' || coalesce(funcao, '')) ~ '(gestor|gerente|coord)'
            order by nome
            """,
            ciclo_id,
        )
    ]
    itens = []
    for resultado in resultados:
        realizado = await buscar_realizado_lideranca(conexao, resultado, ciclo_id)
        realizado_payload = payload_realizado(resultado, realizado)
        pode_atualizar_realizado = aplicar and realizado_editavel(resultado)
        if pode_atualizar_realizado:
            await conexao.execute(
                """
                update comissionamento.resultados
                set validacao_lideranca = coalesce(validacao_lideranca, '{}'::jsonb)
                        || jsonb_build_object('realizado_oficial', $1::jsonb),
                    atualizado_em = now()
                where resultado_id = $2
                  and ciclo_id = $3
                """,
                json.dumps(realizado_payload, ensure_ascii=False),
                resultado.get("resultado_id"),
                ciclo_id,
            )
        if not realizado.usuario_id:
            status_sem_usuario = "ok_funcionario" if realizado.funcionario_id else "sem_vinculo"
            itens.append(
                {
                    "resultado_id": resultado.get("resultado_id"),
                    "nome": resultado.get("nome"),
                    "status": status_sem_usuario,
                    "criterio_vinculo": realizado.criterio_vinculo,
                    "identificador_funcionario": realizado.funcionario_id or str(resultado.get("identificador_funcionario") or ""),
                    "email": resultado.get("email"),
                    "documento": resultado.get("documento"),
                    "realizado": realizado_payload,
                }
            )
            continue
        if aplicar and not resultado.get("identificador_usuario"):
            await conexao.execute(
                """
                update comissionamento.resultados
                set identificador_usuario = $1::uuid,
                    atualizado_em = now()
                where resultado_id = $2
                  and ciclo_id = $3
                  and identificador_usuario is null
                """,
                realizado.usuario_id,
                resultado.get("resultado_id"),
                ciclo_id,
            )
        for indicador, codigo in INDICADORES_RESULTADOS_METAS:
            indicador_id = indicadores.get(codigo) or indicadores.get(indicador.upper())
            if not indicador_id:
                itens.append({"resultado_id": resultado.get("resultado_id"), "nome": resultado.get("nome"), "indicador": indicador, "status": "indicador_invalido"})
                continue
            valor = realizado.valor(indicador)
            itens.append(
                {
                    "resultado_id": resultado.get("resultado_id"),
                    "nome": resultado.get("nome"),
                    "usuario_id": realizado.usuario_id,
                    "indicador": codigo,
                    "valor_realizado": float(valor),
                    "fonte": realizado.fonte,
                    "criterio_vinculo": realizado.criterio_vinculo,
                    "identificador_funcionario": str(resultado.get("identificador_funcionario") or ""),
                    "status": "ok",
                }
            )
            if aplicar:
                await conexao.execute(
                    f"""
                    insert into {ESQUEMA_COMERCIAL}.resultados_metas (
                        usuario_id, indicador_id, mes_referencia, ano_referencia,
                        valor_realizado, origem_resultado, data_resultado
                    )
                    values ($1::uuid, $2, $3, $4, $5, 'CALCULADO', current_date)
                    on conflict (usuario_id, indicador_id, mes_referencia, ano_referencia)
                    do update set
                        valor_realizado = excluded.valor_realizado,
                        origem_resultado = excluded.origem_resultado,
                        data_resultado = excluded.data_resultado,
                        updated_at = now()
                    """,
                    realizado.usuario_id,
                    indicador_id,
                    mes,
                    ano,
                    valor,
                )
    return {
        "ciclo_id": ciclo_id,
        "modo": "apply" if aplicar else "dry-run",
        "resultados_lideranca": len(resultados),
        "itens": itens,
        "ok": sum(1 for item in itens if item.get("status") == "ok"),
        "ok_funcionario": sum(1 for item in itens if item.get("status") == "ok_funcionario"),
        "sem_vinculo": sum(1 for item in itens if item.get("status") == "sem_vinculo"),
        "sem_usuario": sum(1 for item in itens if item.get("status") in {"ok_funcionario", "sem_vinculo"}),
        "indicador_invalido": sum(1 for item in itens if item.get("status") == "indicador_invalido"),
    }
