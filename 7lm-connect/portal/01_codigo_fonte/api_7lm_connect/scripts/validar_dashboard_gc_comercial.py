"""
Valida a aba Comercial do Dashboard G&C contra os dados sincronizados.

O script foi feito para rodar apos a sincronizacao horaria. Ele confere se os
totais do periodo batem quando reagrupados por coordenacao, gerente, equipe,
corretor e dia, alem de validar se a carga terminou com sucesso.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import asyncpg


API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from configuracoes import (  # noqa: E402
    ESQUEMA_COMERCIAL,
    NOME_BANCO,
    PORTA_BANCO,
    SENHA_BANCO,
    SERVIDOR_BANCO,
    USUARIO_BANCO,
)


METRICAS_INTEIRAS = [
    "leads",
    "visitas",
    "vendas",
    "repasses",
    "propostas_aprovadas",
    "propostas_condicionadas",
    "propostas_reprovadas",
    "propostas_total",
    "cancelamentos",
    "distratos",
]


@dataclass
class ResultadoValidacao:
    nome: str
    ok: bool
    esperado: Any = None
    obtido: Any = None
    detalhe: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "nome": self.nome,
            "ok": self.ok,
            "esperado": self.esperado,
            "obtido": self.obtido,
            "detalhe": self.detalhe,
        }


def _quote_ident(valor: str) -> str:
    return '"' + str(valor).replace('"', '""') + '"'


def _tabela(nome: str) -> str:
    return f"{_quote_ident(ESQUEMA_COMERCIAL)}.{_quote_ident(nome)}"


def _periodo(ano: int, mes: int) -> tuple[date, date]:
    inicio = date(ano, mes, 1)
    fim = date(ano + (1 if mes == 12 else 0), 1 if mes == 12 else mes + 1, 1)
    return inicio, fim


def _row_to_ints(row: asyncpg.Record | dict[str, Any] | None) -> dict[str, int]:
    row = row or {}
    return {campo: int(row.get(campo) or 0) for campo in METRICAS_INTEIRAS}


def _ok(nome: str, detalhe: str = "", esperado: Any = None, obtido: Any = None) -> ResultadoValidacao:
    return ResultadoValidacao(nome=nome, ok=True, esperado=esperado, obtido=obtido, detalhe=detalhe)


def _falha(nome: str, esperado: Any = None, obtido: Any = None, detalhe: str = "") -> ResultadoValidacao:
    return ResultadoValidacao(nome=nome, ok=False, esperado=esperado, obtido=obtido, detalhe=detalhe)


async def _conectar() -> asyncpg.Connection:
    return await asyncpg.connect(
        user=USUARIO_BANCO,
        password=SENHA_BANCO,
        host=SERVIDOR_BANCO,
        port=PORTA_BANCO,
        database=NOME_BANCO,
        timeout=30,
        command_timeout=300,
        server_settings={"application_name": "7lm_validar_dashboard_gc_comercial"},
    )


async def _somar_periodo(conexao: asyncpg.Connection, inicio: date, fim: date, grupo: str | None = None) -> list[dict[str, Any]]:
    grupos = {
        "coordenacao": "coalesce(nullif(trim(coordenacao), ''), 'Sem gerente comercial')",
        "gerencia": "coalesce(nullif(trim(gerencia), ''), 'Sem gerente de vendas')",
        "imobiliaria": "coalesce(nullif(trim(imobiliaria), ''), 'Sem equipe')",
        "corretor": "coalesce(nullif(trim(corretor), ''), 'Sem corretor')",
        "data": "data",
    }
    select_grupo = f"{grupos[grupo]} as grupo," if grupo else ""
    group_by = "group by 1" if grupo else ""
    metricas_sql = ",\n".join(f"sum(coalesce({campo}, 0))::bigint as {campo}" for campo in METRICAS_INTEIRAS)
    rows = await conexao.fetch(
        f"""
        select
          {select_grupo}
          {metricas_sql}
        from {_tabela("dashboard_gc_produtividade_kpi_daily")}
        where data >= $1
          and data < $2
        {group_by}
        """,
        inicio,
        fim,
    )
    return [dict(row) for row in rows]


def _somar_linhas(linhas: list[dict[str, Any]]) -> dict[str, int]:
    total = {campo: 0 for campo in METRICAS_INTEIRAS}
    for linha in linhas:
        for campo in METRICAS_INTEIRAS:
            total[campo] += int(linha.get(campo) or 0)
    return total


def _comparar_totais(nome: str, total: dict[str, int], linhas: list[dict[str, Any]], campos: list[str]) -> list[ResultadoValidacao]:
    agrupado = _somar_linhas(linhas)
    resultados: list[ResultadoValidacao] = []
    for campo in campos:
        esperado = total[campo]
        obtido = agrupado[campo]
        if esperado == obtido:
            resultados.append(_ok(f"{nome}: {campo}", esperado=esperado, obtido=obtido))
        else:
            resultados.append(_falha(f"{nome}: {campo}", esperado=esperado, obtido=obtido))
    return resultados


async def validar(ano: int, mes: int) -> dict[str, Any]:
    inicio, fim = _periodo(ano, mes)
    resultados: list[ResultadoValidacao] = []
    conexao = await _conectar()
    try:
        total_rows = int(
            await conexao.fetchval(
                f"""
                select count(*)::bigint
                  from {_tabela("dashboard_gc_produtividade_kpi_daily")}
                 where data >= $1
                   and data < $2
                """,
                inicio,
                fim,
            )
            or 0
        )
        resultados.append(_ok("Base KPI do periodo possui linhas", obtido=total_rows) if total_rows > 0 else _falha("Base KPI do periodo possui linhas", esperado="> 0", obtido=total_rows))

        hierarquia_rows = int(
            await conexao.fetchval(
                f"""
                select count(*)::bigint
                  from {_tabela("dashboard_gc_produtividade_hierarquia")}
                 where mes_referencia >= $1
                   and mes_referencia < $2
                """,
                inicio,
                fim,
            )
            or 0
        )
        resultados.append(_ok("Hierarquia do periodo possui linhas", obtido=hierarquia_rows) if hierarquia_rows > 0 else _falha("Hierarquia do periodo possui linhas", esperado="> 0", obtido=hierarquia_rows))

        sync_log = await conexao.fetchrow(
            f"""
            select id, status, finished_at, table_counts
              from {_tabela("dashboard_gc_produtividade_sync_log")}
             order by started_at desc
             limit 1
            """
        )
        resultados.append(_ok("Existe log de sincronizacao", obtido=sync_log["id"] if sync_log else None) if sync_log else _falha("Existe log de sincronizacao", esperado="log", obtido=None))
        resultados.append(
            _ok("Ultima sincronizacao terminou com sucesso", obtido=sync_log["status"])
            if sync_log and sync_log["status"] == "success"
            else _falha("Ultima sincronizacao terminou com sucesso", esperado="success", obtido=sync_log["status"] if sync_log else None)
        )
        resultados.append(
            _ok("Ultima sincronizacao possui finished_at", obtido=str(sync_log["finished_at"]))
            if sync_log and sync_log["finished_at"]
            else _falha("Ultima sincronizacao possui finished_at", esperado="timestamp", obtido=None)
        )

        total = _row_to_ints((await _somar_periodo(conexao, inicio, fim))[0] if total_rows else None)
        resultados.append(_ok("Resumo mensal tem alguma atividade", obtido=sum(total.values())) if sum(total.values()) > 0 else _falha("Resumo mensal tem alguma atividade", esperado="> 0", obtido=0))

        negativos = await conexao.fetch(
            f"""
            select data, corretor, imobiliaria
              from {_tabela("dashboard_gc_produtividade_kpi_daily")}
             where data >= $1
               and data < $2
               and ({' or '.join(f'coalesce({campo}, 0) < 0' for campo in METRICAS_INTEIRAS)})
             limit 10
            """,
            inicio,
            fim,
        )
        resultados.append(_ok("Nao existem metricas negativas no periodo") if not negativos else _falha("Nao existem metricas negativas no periodo", esperado=0, obtido=len(negativos)))

        por_coordenacao = await _somar_periodo(conexao, inicio, fim, "coordenacao")
        por_gerencia = await _somar_periodo(conexao, inicio, fim, "gerencia")
        por_equipe = await _somar_periodo(conexao, inicio, fim, "imobiliaria")
        por_corretor = await _somar_periodo(conexao, inicio, fim, "corretor")
        por_dia = await _somar_periodo(conexao, inicio, fim, "data")

        resultados.extend(_comparar_totais("Agrupamento por gerente comercial", total, por_coordenacao, ["leads", "visitas", "vendas", "repasses", "propostas_total"]))
        resultados.extend(_comparar_totais("Agrupamento por gerente de vendas", total, por_gerencia, ["leads", "vendas", "repasses", "propostas_aprovadas", "propostas_total"]))
        resultados.extend(_comparar_totais("Agrupamento por equipe", total, por_equipe, ["leads", "visitas", "vendas", "repasses", "cancelamentos", "distratos"]))
        resultados.extend(_comparar_totais("Agrupamento por corretor", total, por_corretor, ["leads", "vendas", "repasses", "propostas_condicionadas", "propostas_reprovadas"]))
        resultados.extend(_comparar_totais("Agrupamento por dia", total, por_dia, ["leads", "visitas", "vendas", "repasses", "propostas_total"]))

        contagens = {
            "linhas_kpi_periodo": total_rows,
            "linhas_hierarquia_periodo": hierarquia_rows,
            "grupos_gerente_comercial": len(por_coordenacao),
            "grupos_gerente_vendas": len(por_gerencia),
            "grupos_equipes": len(por_equipe),
            "grupos_corretores": len(por_corretor),
        }
    finally:
        await conexao.close()

    falhas = [item for item in resultados if not item.ok]
    return {
        "periodo": {"ano": ano, "mes": mes, "inicio": inicio.isoformat(), "fim": fim.isoformat()},
        "status": "ok" if not falhas else "falha",
        "total_validacoes": len(resultados),
        "falhas": len(falhas),
        "contagens": contagens,
        "validacoes": [item.as_dict() for item in resultados],
    }


def main() -> None:
    hoje = date.today()
    parser = argparse.ArgumentParser(description="Valida os numeros da aba Comercial do Dashboard G&C.")
    parser.add_argument("--ano", type=int, default=hoje.year)
    parser.add_argument("--mes", type=int, default=hoje.month)
    args = parser.parse_args()

    resultado = asyncio.run(validar(args.ano, args.mes))
    print(json.dumps(resultado, ensure_ascii=False, indent=2, default=str))
    if resultado["status"] != "ok":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
