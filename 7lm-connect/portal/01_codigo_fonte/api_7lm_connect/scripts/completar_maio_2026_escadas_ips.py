"""
Completa escadas e IPs de Maio/2026 para todos os resultados do ciclo.

Regras:
- Mantem financeiro/status dos resultados.
- Usa escadas especificas informadas pelo negocio.
- Usa escada padrao para quem recebeu valor e nao tem regra especifica.
- Usa uma escada simples zerada para quem nao recebeu valor.
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import json
from pathlib import Path
import re
import sys
import unicodedata
from typing import Any


BASE_API = Path(__file__).resolve().parents[1]
PORTAL_ROOT = BASE_API.parents[1]
if str(BASE_API) not in sys.path:
    sys.path.insert(0, str(BASE_API))

from banco import encerrar_pool_de_conexoes, iniciar_pool_de_conexoes  # noqa: E402
from configuracoes import ESQUEMA_COMISSIONAMENTO  # noqa: E402
from repositorios.comissionamento import registrar_evento_comissionamento, salvar_publicacao_regra  # noqa: E402


CICLO_ID = "2026-05"
AGENTE = "completar_maio_2026_escadas_ips.py"
REGISTRO_SAIDA = PORTAL_ROOT / "03_registros" / "comissionamento" / "execucoes"
FONTE = "ajuste_manual_escadas_ips_maio_2026"

PADRAO = [
    ("0% a 39,99%", 1000),
    ("40% a 59,99%", 1200),
    ("60% a 79,99%", 1350),
    ("80% a 94,99%", 1500),
    ("95% a 104,99%", 3500),
    ("105% a 109,99%", 4000),
    ("110% a 114,99%", 4500),
    ("115% a 119,99%", 5000),
    ("120% a 129,99%", 5500),
    ("130% a 139,99%", 6000),
    ("+ que 140%", 6500),
]

GEISI_JORDAN_THOMAZ = [
    ("0% a 39,99%", 3000),
    ("40% a 59,99%", 4000),
    ("60% a 79,99%", 4500),
    ("80% a 94,99%", 5000),
    ("95% a 104,99%", 7000),
    ("105% a 109,99%", 7500),
    ("110% a 114,99%", 8000),
    ("115% a 119,99%", 8500),
    ("120% a 129,99%", 9000),
]

MACARIO = [
    ("0% a 39,99%", 2000),
    ("40% a 59,99%", 2800),
    ("60% a 79,99%", 3300),
    ("80% a 94,99%", 3800),
    ("95% a 104,99%", 6000),
    ("105% a 109,99%", 7000),
    ("110% a 114,99%", 7800),
    ("115% a 119,99%", 8600),
    ("120% a 129,99%", 9400),
    ("130% a 139,99%", 10200),
    ("+ que 140%", 11000),
]

ESCADAS_ESPECIFICAS = {
    "Bruno Macario": MACARIO,
    "Geisiane Gomes Dos Santos": GEISI_JORDAN_THOMAZ,
    "Jordan Vasconcelos": GEISI_JORDAN_THOMAZ,
    "Thomaz Moreira Aquino": GEISI_JORDAN_THOMAZ,
}

IPS_ESPECIFICOS = {
    "Geisiane Gomes Dos Santos": [
        {"nome": "IP 1 - 6 Repasses até o dia 20/5 - feito 06", "indicador": "repasses_ate_dia_20", "alvo": 6, "realizado": 6, "atingiu": True, "valor_bonus": 1000},
        {"nome": "IP 2 - Sobrepreço Médio >R$5.000", "indicador": "sobrepreco_medio", "alvo": 5000, "realizado": 0, "atingiu": False, "valor_bonus": 1000},
    ],
    "Thomaz Moreira Aquino": [
        {"nome": "IP 1 - 18 Repasses até o dia 20/5 - FEITO 18 REPASSES", "indicador": "repasses_ate_dia_20", "alvo": 18, "realizado": 18, "atingiu": True, "valor_bonus": 1000},
        {"nome": "IP 2 - Sobrepreço Médio >R$5.000", "indicador": "sobrepreco_medio", "alvo": 5000, "realizado": 0, "atingiu": False, "valor_bonus": 1000},
    ],
    "Marco Taveira": [
        {"nome": "Sobrepreço R$5.000", "indicador": "sobrepreco_medio", "alvo": 5000, "realizado": 0, "atingiu": False, "valor_bonus": 750},
        {"nome": "IPC 1,3", "indicador": "ipc", "alvo": 1.3, "realizado": 0, "atingiu": False, "valor_bonus": 750},
        {"nome": "03 Repasses até dia 20/5 - feito 06", "indicador": "repasses_ate_dia_20", "alvo": 3, "realizado": 6, "atingiu": True, "valor_bonus": 750},
        {"nome": "IP TT (Sobrepreço Médio >R$4.000,00)", "indicador": "sobrepreco_medio_tt", "alvo": 4000, "realizado": 0, "atingiu": False, "valor_bonus": 1000},
        {"nome": "IP 2 - 28 Repasses até o dia 20/5 - FEITO 38 REPASSES", "indicador": "repasses_ate_dia_20", "alvo": 28, "realizado": 38, "atingiu": True, "valor_bonus": 1000},
    ],
}

IPS_PADRAO = [
    {"nome": "Sobrepreço R$5.000", "indicador": "sobrepreco_medio", "alvo": 5000, "realizado": 0, "atingiu": False, "valor_bonus": 750},
    {"nome": "IPC 1,3", "indicador": "ipc", "alvo": 1.3, "realizado": 0, "atingiu": False, "valor_bonus": 750},
    {"nome": "3 Repasses até dia 20/4 - feito 2", "indicador": "repasses_ate_dia_20", "alvo": 3, "realizado": 2, "atingiu": False, "valor_bonus": 750},
]

ZERADA = [
    ("0% a 39,99%", 0),
    ("40% a 59,99%", 0),
    ("60% a 79,99%", 0),
    ("80% a 94,99%", 0),
    ("95% a 104,99%", 0),
    ("105% a 109,99%", 0),
    ("110% a 114,99%", 0),
    ("115% a 119,99%", 0),
    ("120% a 129,99%", 0),
    ("130% a 139,99%", 0),
    ("+ que 140%", 0),
]

LIMITES = {
    "0% a 39,99%": (Decimal("0"), Decimal("39.99")),
    "40% a 59,99%": (Decimal("40"), Decimal("59.99")),
    "60% a 79,99%": (Decimal("60"), Decimal("79.99")),
    "80% a 94,99%": (Decimal("80"), Decimal("94.99")),
    "95% a 104,99%": (Decimal("95"), Decimal("104.99")),
    "105% a 109,99%": (Decimal("105"), Decimal("109.99")),
    "110% a 114,99%": (Decimal("110"), Decimal("114.99")),
    "115% a 119,99%": (Decimal("115"), Decimal("119.99")),
    "120% a 129,99%": (Decimal("120"), Decimal("129.99")),
    "130% a 139,99%": (Decimal("130"), Decimal("139.99")),
    "+ que 140%": (Decimal("140"), None),
}


def _normalizar(valor: Any) -> str:
    texto = str(valor or "").strip()
    texto = "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")
    texto = re.sub(r"[^a-zA-Z0-9@.]+", " ", texto)
    return " ".join(texto.lower().split())


def _decimal(valor: Any) -> Decimal:
    if valor in (None, ""):
        return Decimal("0")
    if isinstance(valor, (int, float, Decimal)):
        return Decimal(str(valor))
    texto = str(valor).replace("R$", "").strip()
    if "," in texto:
        texto = texto.replace(".", "").replace(",", ".")
    try:
        return Decimal(texto)
    except Exception:
        return Decimal("0")


def _numero(valor: Decimal) -> float:
    return float(valor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _slug(valor: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", _normalizar(valor)).strip("_") or "item"


def _json_default(valor: Any) -> Any:
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, datetime):
        return valor.isoformat()
    return str(valor)


def _json_obj(valor: Any) -> dict[str, Any]:
    if isinstance(valor, dict):
        return valor
    if isinstance(valor, str) and valor.strip():
        try:
            parsed = json.loads(valor)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _faixa_por_percentual(percentual: Decimal) -> str:
    for rotulo, (minimo, maximo) in LIMITES.items():
        if percentual >= minimo and (maximo is None or percentual <= maximo):
            return rotulo
    return "0% a 39,99%"


def _montar_faixas(escada: list[tuple[str, int]], objetivo: Decimal, realizado: Decimal, ativa: str) -> list[dict[str, Any]]:
    faixas = []
    for posicao, (rotulo, valor) in enumerate(escada, start=1):
        minimo, maximo = LIMITES[rotulo]
        necessario_minimo = objetivo * minimo / Decimal("100") if objetivo > 0 else Decimal("0")
        necessario_maximo = objetivo * maximo / Decimal("100") if objetivo > 0 and maximo is not None else None
        faixas.append({
            "id": f"faixa_{posicao}",
            "rotulo": rotulo,
            "percentual_minimo": _numero(minimo),
            "percentual_maximo": _numero(maximo) if maximo is not None else 999,
            "valor_bonus": float(valor),
            "valor_faixa": float(valor),
            "realizado_atual": _numero(realizado),
            "objetivo_base": _numero(objetivo),
            "necessario_minimo": _numero(necessario_minimo),
            "necessario_maximo": None if necessario_maximo is None else _numero(necessario_maximo),
            "faltam_para_minimo": _numero(max(necessario_minimo - realizado, Decimal("0"))),
            "ativa": rotulo == ativa,
        })
    return faixas


def _regra_atual_por_nome(regras: dict[str, dict[str, dict[str, Any]]], resultado: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return regras.get(str(resultado["resultado_id"])) or regras.get(_normalizar(resultado.get("nome"))) or {}


async def _carregar_estado(conexao) -> tuple[list[dict[str, Any]], dict[str, dict[str, dict[str, Any]]]]:
    resultados = [dict(linha) for linha in await conexao.fetch(
        f"""
        select *
        from {ESQUEMA_COMISSIONAMENTO}.resultados
        where ciclo_id = $1
        order by nome
        """,
        CICLO_ID,
    )]
    regras: dict[str, dict[str, dict[str, Any]]] = {}
    linhas = await conexao.fetch(
        f"""
        select *
        from {ESQUEMA_COMISSIONAMENTO}.regras_publicadas
        where ciclo_id = $1 and ativo is true
        order by comissionado_nome, regra_tipo
        """,
        CICLO_ID,
    )
    for linha in linhas:
        item = dict(linha)
        regras.setdefault(str(item.get("comissionado_id") or ""), {})[str(item.get("regra_tipo"))] = item
        regras.setdefault(_normalizar(item.get("comissionado_nome")), {})[str(item.get("regra_tipo"))] = item
    return resultados, regras


def _montar_regra_01(resultado: dict[str, Any], regra_01_atual: dict[str, Any], escada: list[tuple[str, int]], fonte_escada: str) -> dict[str, Any]:
    realizado = _decimal(regra_01_atual.get("realizado"))
    objetivo = _decimal(regra_01_atual.get("objetivo")) or Decimal("1")
    percentual = (realizado / objetivo * Decimal("100")).quantize(Decimal("0.01")) if objetivo > 0 else Decimal("0")
    faixa_aplicada = _faixa_por_percentual(percentual)
    faixas = _montar_faixas(escada, objetivo, realizado, faixa_aplicada)
    faixa_ativa = next((item for item in faixas if item["ativa"]), faixas[0])
    return {
        "meta_id": f"{resultado['resultado_id']}-r01-maio-2026-escada-completa",
        "nome": "Regra 01 - Escada Maio/2026",
        "indicador": regra_01_atual.get("indicador") or "valor_minimo_excel",
        "substituir_faixas": True,
        "objetivo": _numero(objetivo),
        "realizado": _numero(realizado),
        "peso": 1,
        "percentual_atingimento": _numero(percentual),
        "faixa_aplicada": faixa_aplicada,
        "valor_faixa": faixa_ativa["valor_bonus"],
        "valor_calculado": faixa_ativa["valor_bonus"],
        "faixas": faixas,
        "fonte_realizado": regra_01_atual.get("fonte_realizado") or "regra_publicada",
        "fonte_template": fonte_escada,
        "fonte_escada": fonte_escada,
    }


def _montar_ips(nome: str, valor_bruto: Decimal) -> list[dict[str, Any]]:
    if nome in IPS_ESPECIFICOS:
        base = IPS_ESPECIFICOS[nome]
    elif valor_bruto > 0:
        base = IPS_PADRAO
    else:
        base = [{"nome": "IP base - sem valor em Maio/2026", "indicador": "placeholder", "alvo": 1, "realizado": 0, "atingiu": False, "valor_bonus": 0}]
    ips = []
    for posicao, item in enumerate(base, start=1):
        ips.append({
            "ip_id": f"maio-2026-{_slug(nome)}-ip-{posicao}",
            "nome": item["nome"],
            "indicador": item["indicador"],
            "indicador_texto": item["nome"],
            "tipo_comissao": "numero",
            "operador": ">=",
            "alvo": float(item["alvo"]),
            "realizado": float(item["realizado"]),
            "atingiu": bool(item["atingiu"]),
            "valor_bonus": float(item["valor_bonus"]),
            "data_inicial": "2026-05-01",
            "data_fim": "2026-05-31",
            "periodo_corte": "2026-05",
            "fonte_realizado": "manual_maio_2026" if item["realizado"] else "atingimento_nao_inferido",
            "fonte_template": FONTE,
        })
    return ips


def _montar_regra_02(resultado: dict[str, Any], ips: list[dict[str, Any]]) -> dict[str, Any]:
    total = sum((_decimal(ip.get("valor_bonus")) for ip in ips if ip.get("atingiu")), Decimal("0"))
    return {
        "meta_id": f"{resultado['resultado_id']}-r02-maio-2026-ips-completos",
        "nome": "Regra 02 - IPs Maio/2026",
        "indicador": "ips_maio_2026",
        "objetivo": len(ips),
        "realizado": sum(1 for ip in ips if ip.get("atingiu")),
        "valor_calculado": _numero(total),
        "ips": ips,
        "fonte_template": FONTE,
    }


async def completar(aplicar: bool) -> dict[str, Any]:
    pool = await iniciar_pool_de_conexoes()
    try:
        async with pool.acquire() as conexao:
            resultados, regras = await _carregar_estado(conexao)
            total_antes = {
                "resultados": len(resultados),
                "valor_bruto": _numero(sum(_decimal(item.get("valor_bruto")) for item in resultados)),
                "valor_liquido": _numero(sum(_decimal(item.get("valor_liquido")) for item in resultados)),
            }
            preparados = []
            novas_regras = []
            for resultado in resultados:
                nome = resultado.get("nome") or ""
                valor_bruto = _decimal(resultado.get("valor_bruto"))
                atuais = _regra_atual_por_nome(regras, resultado)
                regra_01_atual = _json_obj((atuais.get("regra_01") or {}).get("regra_01"))
                if nome in ESCADAS_ESPECIFICAS:
                    escada = ESCADAS_ESPECIFICAS[nome]
                    fonte_escada = f"{FONTE}:especifica"
                elif valor_bruto > 0:
                    escada = PADRAO
                    fonte_escada = f"{FONTE}:padrao"
                else:
                    escada = ZERADA
                    fonte_escada = f"{FONTE}:zerada"
                regra_01 = _montar_regra_01(resultado, regra_01_atual, escada, fonte_escada)
                ips = _montar_ips(nome, valor_bruto)
                regra_02 = _montar_regra_02(resultado, ips)
                novas_regras.append((resultado, regra_01, regra_02, ips, fonte_escada))
                preparados.append({
                    "resultado_id": resultado["resultado_id"],
                    "nome": nome,
                    "valor_bruto": _numero(valor_bruto),
                    "fonte_escada": fonte_escada,
                    "faixas": len(escada),
                    "faixa_aplicada": regra_01["faixa_aplicada"],
                    "valor_faixa": regra_01["valor_faixa"],
                    "ips": len(ips),
                    "ips_atingidos": sum(1 for ip in ips if ip.get("atingiu")),
                })
            relatorio = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "modo": "apply" if aplicar else "dry_run",
                "ciclo_id": CICLO_ID,
                "total_antes": total_antes,
                "total_depois": total_antes,
                "preparados": preparados,
                "resumo": {
                    "resultados": len(resultados),
                    "com_valor": sum(1 for item in resultados if _decimal(item.get("valor_bruto")) > 0),
                    "escadas_especificas": sum(1 for item in preparados if item["fonte_escada"].endswith(":especifica")),
                    "escadas_padrao": sum(1 for item in preparados if item["fonte_escada"].endswith(":padrao")),
                    "escadas_zeradas": sum(1 for item in preparados if item["fonte_escada"].endswith(":zerada")),
                    "valor_bruto_preservado": total_antes["valor_bruto"],
                    "valor_liquido_preservado": total_antes["valor_liquido"],
                },
            }
            if aplicar:
                async with conexao.transaction():
                    for resultado, regra_01, regra_02, ips, fonte_escada in novas_regras:
                        for regra_tipo in ("regra_01", "regra_02"):
                            await salvar_publicacao_regra(
                                conexao,
                                ESQUEMA_COMISSIONAMENTO,
                                ciclo_id=CICLO_ID,
                                comissionado_id=resultado["resultado_id"],
                                comissionado_nome=resultado.get("nome"),
                                regra_tipo=regra_tipo,
                                regra_01=regra_01 if regra_tipo == "regra_01" else {},
                                regra_02=regra_02 if regra_tipo == "regra_02" else {},
                                regra_02_ips=ips if regra_tipo == "regra_02" else [],
                                regra_02_ips_removidos=[],
                                payload={
                                    "fonte": AGENTE,
                                    "fonte_escada": fonte_escada,
                                    "financeiro_preservado": True,
                                    "regra_01": regra_01 if regra_tipo == "regra_01" else None,
                                    "regra_02": regra_02 if regra_tipo == "regra_02" else None,
                                },
                                motivo="Complemento das escadas e IPs de Maio/2026.",
                                comentario="Financeiro preservado; escadas e IPs preparados para visualizacao/edicao.",
                                usuario_id=None,
                            )
                    await registrar_evento_comissionamento(
                        conexao,
                        ESQUEMA_COMISSIONAMENTO,
                        tipo_evento="ciclo_maio_2026_escadas_ips_completados",
                        usuario_id=None,
                        sessao_id=None,
                        endereco_ip="127.0.0.1",
                        agente_do_usuario=AGENTE,
                        antes={"ciclo_id": CICLO_ID, **total_antes},
                        depois={"ciclo_id": CICLO_ID, **total_antes, "regras_atualizadas": len(novas_regras) * 2},
                        comentario="Escadas e IPs de Maio/2026 completados sem alterar financeiro.",
                    )
            REGISTRO_SAIDA.mkdir(parents=True, exist_ok=True)
            destino = REGISTRO_SAIDA / f"comissionamento_maio_2026_escadas_ips_completos_{'apply' if aplicar else 'dry_run'}.json"
            destino.write_text(json.dumps(relatorio, ensure_ascii=False, indent=2, default=_json_default), encoding="utf-8")
            relatorio["arquivo"] = str(destino)
            return relatorio
    finally:
        await encerrar_pool_de_conexoes()


async def main() -> None:
    parser = argparse.ArgumentParser(description="Completa escadas e IPs de Maio/2026.")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    relatorio = await completar(args.apply)
    print(json.dumps({
        "modo": relatorio["modo"],
        "ciclo_id": relatorio["ciclo_id"],
        "resumo": relatorio["resumo"],
        "arquivo": relatorio["arquivo"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
