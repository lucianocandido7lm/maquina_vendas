"""
Ajusta o ciclo Maio/2026 com:
- liderancas ativas em maio pela Maquina de Vendas;
- lista minima do Excel com valores obrigatorios;
- extras ativos fora da lista minima zerados para revisao da Secretaria.
"""

from __future__ import annotations

import asyncio
from decimal import Decimal
import json
from pathlib import Path
import sys
from typing import Any

BASE_API = Path(__file__).resolve().parents[1]
PORTAL_ROOT = BASE_API.parents[1]
if str(BASE_API) not in sys.path:
    sys.path.insert(0, str(BASE_API))

from banco import encerrar_pool_de_conexoes, iniciar_pool_de_conexoes  # noqa: E402
from configuracoes import ESQUEMA_COMISSIONAMENTO  # noqa: E402
from scripts.resetar_ciclo_comissionamento_mensal import (  # noqa: E402
    Lider,
    _carregar_lideres,
    _email,
    _md5_curto,
    _mes_periodo,
    _nome_equivalente,
    _normalizar,
    _recriar_snapshot,
    _tipo_vinculo_para_tipo_comissionado,
    _upsert_ciclo,
)


CICLO_ID = "2026-05"
AGENTE = "ajustar_ciclo_maio_2026_ativos_minimos.py"
ORIGEM = "maio_2026_ativos_minimos_excel"
REGISTRO_SAIDA = PORTAL_ROOT / "03_registros" / "comissionamento" / "execucoes"

MINIMOS = [
    ("GER VENDAS", "AGL", "Francisco Lucielio De Queiroz", "FRANCISCO", Decimal("4750.00")),
    ("GER VENDAS", "AGL", "Josué Gomes De Souza", "JOSUÉ", Decimal("5000.00")),
    ("GER VENDAS", "AGL", "Ana Cleia Nonato", "ANA CLEIA", Decimal("8750.00")),
    ("COORD VENDAS FSA", "FSA", "Thomaz Moreira Aquino", "THOMAZ", Decimal("10000.00")),
    ("GER VENDAS", "FSA", "Rafael De Lucena Martins", "RAFAEL", Decimal("6250.00")),
    ("GER II VENDAS", "FSA", "Alana Rabelo Da Costa", "ALANA", Decimal("8500.00")),
    ("GER VENDAS", "FSA", "Daiana Soares Da Rocha", "DAIANA", Decimal("5750.00")),
    ("COORD. CANAL", "AGL/FSA", "Geisiane Gomes Dos Santos", "GEISI", Decimal("11000.00")),
    ("GER. VENDAS CANAL", "AGL/FSA", "Alba Vieira Da Silva Lopes", "ALBA", Decimal("10750.00")),
    ("GER VENDAS - CANAL", "CAT", "Pamela Aline Ferreira Barcelos", "PAMELA", Decimal("750.00")),
    ("COORD GERAL", "FSA", "Marco Taveira", "TAVEIRA", Decimal("13800.00")),
    ("COORD. REPASSE", "AGL/FSA", "Bruno Macario", "BRUNO", Decimal("10600.00")),
    ("GER. IA", "AGL/FSA", "Luiz Aquino", "LUIZ", Decimal("3950.00")),
    ("COORD VENDAS CAT", "FSA", "Jordan Vasconcelos", "JORDAN", Decimal("9300.00")),
]


def _papel_por_funcao(funcao: str) -> str:
    return "coordenador" if "coord" in _normalizar(funcao) else "gestor"


def _resultado_id(papel: str, nome: str, email: str | None = None) -> str:
    return f"maio-2026-{papel}-{_md5_curto(_email(email) or _normalizar(nome))}"


async def _buscar_identidade(conexao, nome: str) -> dict[str, Any]:
    linha = await conexao.fetchrow(
        """
        select
            fa.identificador_funcionario::text,
            fa.identificador_usuario::text,
            fa.nome,
            fa.email::text,
            fa.documento,
            fa.cargo,
            fa.perfil_acesso_padrao,
            fa.tipo_vinculo
        from sevenlm_connect.funcionario_acesso fa
        where lower(fa.nome) = lower($1)
        order by fa.ativo desc, fa.ativo_negocio desc nulls last, fa.data_hora_atualizado_em desc
        limit 1
        """,
        nome,
    )
    if linha:
        return dict(linha)
    linha = await conexao.fetchrow(
        """
        select
            null::text as identificador_funcionario,
            u.identificador_usuario::text,
            u.nome_completo as nome,
            u.correio_eletronico::text as email,
            null::text as documento,
            null::text as cargo,
            null::text as perfil_acesso_padrao,
            null::text as tipo_vinculo
        from sevenlm_connect.usuario u
        where lower(u.nome_completo) = lower($1)
        order by u.indicador_ativo desc, u.data_hora_ultimo_login desc nulls last
        limit 1
        """,
        nome,
    )
    return dict(linha) if linha else {}


async def _resultado_existente(conexao, ciclo_id: str, nome: str, email: str | None = None) -> dict[str, Any] | None:
    linhas = await conexao.fetch(
        f"""
        select *
        from {ESQUEMA_COMISSIONAMENTO}.resultados
        where ciclo_id = $1
        """,
        ciclo_id,
    )
    for linha in linhas:
        item = dict(linha)
        if email and _email(email) and _email(item.get("email")) == _email(email):
            return item
        if _nome_equivalente(nome, item.get("nome")):
            return item
    return None


async def _salvar_regra(conexao, resultado: dict[str, Any], valor: Decimal, fonte: str) -> None:
    regra_01 = {
        "meta_id": f"{resultado['resultado_id']}-regra-01-maio-2026",
        "nome": "Regra 01 - Maio/2026",
        "indicador": "valor_minimo_excel" if fonte == "minimo_excel" else "extra_ativo_maio",
        "substituir_faixas": True,
        "objetivo": 1,
        "realizado": 1 if valor > 0 else 0,
        "peso": 1,
        "percentual_atingimento": 100 if valor > 0 else 0,
        "faixa_aplicada": "Valor Maio/2026",
        "valor_faixa": float(valor),
        "valor_calculado": float(valor),
        "faixas": [
            {
                "id": "valor_maio_2026",
                "rotulo": "Valor Maio/2026",
                "percentual_minimo": 0,
                "percentual_maximo": 999,
                "valor_bonus": float(valor),
                "valor_faixa": float(valor),
                "ativa": True,
            }
        ],
        "fonte_realizado": fonte,
    }
    regra_02 = {
        "regra_id": f"{resultado['resultado_id']}-regra-02-maio-2026",
        "nome": "Regra 02 - IPs Maio/2026",
        "substituir_ips": True,
        "ips": [],
        "valor_total_ips": 0,
        "fonte_realizado": fonte,
    }
    for regra_tipo, payload_regra, ips in (
        ("regra_01", regra_01, []),
        ("regra_02", regra_02, []),
    ):
        await conexao.execute(
            f"""
            update {ESQUEMA_COMISSIONAMENTO}.regras_publicadas
            set ativo = false
            where ciclo_id = $1 and comissionado_id = $2 and regra_tipo = $3 and ativo is true
            """,
            CICLO_ID,
            resultado["resultado_id"],
            regra_tipo,
        )
        versao = await conexao.fetchval(
            f"""
            select coalesce(max(versao), 0) + 1
            from {ESQUEMA_COMISSIONAMENTO}.regras_publicadas
            where ciclo_id = $1 and comissionado_id = $2 and regra_tipo = $3
            """,
            CICLO_ID,
            resultado["resultado_id"],
            regra_tipo,
        )
        await conexao.execute(
            f"""
            insert into {ESQUEMA_COMISSIONAMENTO}.regras_publicadas (
                ciclo_id,
                comissionado_id,
                comissionado_nome,
                regra_tipo,
                versao,
                regra_01,
                regra_02,
                regra_02_ips,
                regra_02_ips_removidos,
                payload,
                motivo,
                comentario,
                ativo
            )
            values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, '[]'::jsonb, $9::jsonb, $10, $11, true)
            """,
            CICLO_ID,
            resultado["resultado_id"],
            resultado["nome"],
            regra_tipo,
            int(versao),
            json.dumps(payload_regra if regra_tipo == "regra_01" else {}, ensure_ascii=False),
            json.dumps(payload_regra if regra_tipo == "regra_02" else {}, ensure_ascii=False),
            json.dumps(ips, ensure_ascii=False),
            json.dumps({"fonte": fonte, "ajuste": AGENTE}, ensure_ascii=False),
            "Ajuste Maio/2026 por ativos e lista minima.",
            "Valores definidos pela lista minima; extras ativos de maio ficam zerados.",
        )


async def ajustar() -> dict[str, Any]:
    ano, mes, inicio, fim = _mes_periodo(CICLO_ID)
    pool = await iniciar_pool_de_conexoes()
    try:
        async with pool.acquire() as conexao:
            ativos = await _carregar_lideres(conexao, inicio, fim)
            finais: dict[str, dict[str, Any]] = {}
            for lider in ativos.values():
                finais[lider.chave_nome] = {
                    "nome": lider.nome,
                    "funcao": lider.cargo,
                    "cidade": lider.regiao or lider.regional or "-",
                    "valor": Decimal("0.00"),
                    "fonte": "ativo_maio_zerado",
                    "papel": lider.papel,
                    "identidade": {
                        "identificador_funcionario": lider.identificador_funcionario,
                        "identificador_usuario": lider.identificador_usuario,
                        "email": lider.email,
                        "documento": lider.documento,
                        "cargo": lider.cargo,
                        "perfil_acesso_padrao": lider.perfil_acesso,
                        "tipo_vinculo": lider.tipo_vinculo,
                    },
                    "origens": lider.fontes,
                }

            for funcao, cidade, nome, apelido, valor in MINIMOS:
                identidade = await _buscar_identidade(conexao, nome)
                finais[_normalizar(nome)] = {
                    "nome": identidade.get("nome") or nome,
                    "funcao": funcao,
                    "cidade": cidade,
                    "valor": valor,
                    "fonte": "minimo_excel",
                    "papel": _papel_por_funcao(funcao),
                    "identidade": identidade,
                    "origens": ["lista_minima_excel", f"apelido={apelido}"],
                }

            async with conexao.transaction():
                await _upsert_ciclo(conexao, CICLO_ID, ano, mes)
                ids_finais: list[str] = []
                importados: list[dict[str, Any]] = []
                for item in sorted(finais.values(), key=lambda valor: _normalizar(valor["nome"])):
                    identidade = item["identidade"]
                    existente = await _resultado_existente(conexao, CICLO_ID, item["nome"], identidade.get("email"))
                    resultado_id = (existente or {}).get("resultado_id") or _resultado_id(item["papel"], item["nome"], identidade.get("email"))
                    tipo_comissionado, exige_nf, status_nf = _tipo_vinculo_para_tipo_comissionado(
                        identidade.get("tipo_vinculo"),
                        item["funcao"],
                    )
                    valor = Decimal(str(item["valor"])).quantize(Decimal("0.01"))
                    validacao = {
                        "validado": bool(item["fonte"] == "minimo_excel" or item["identidade"].get("identificador_funcionario")),
                        "fonte": ORIGEM,
                        "origens": item["origens"],
                        "valor_definido": float(valor),
                        "regra": "lista_minima_com_valor" if item["fonte"] == "minimo_excel" else "ativo_maio_fora_lista_zerado",
                    }
                    await conexao.execute(
                        f"""
                        insert into {ESQUEMA_COMISSIONAMENTO}.resultados (
                            resultado_id, ciclo_id, funcao, cidade, nome, tipo_comissionado,
                            valor_bruto, desconto_distrato, status, status_nf, status_financeiro,
                            status_pagamento, exige_nf, origem, identificador_usuario,
                            identificador_funcionario, documento, email, cargo, perfil_acesso,
                            papel_comissionamento, origem_identidade, validacao_lideranca
                        )
                        values (
                            $1, $2, $3, $4, $5, $6, $7, 0, 'calculado', $8,
                            'nao_enviado', 'nao_enviado', $9, $10, $11::uuid, $12::uuid,
                            $13, $14, $15, $16, $17, $18, $19::jsonb
                        )
                        on conflict (resultado_id) do update
                        set funcao = excluded.funcao,
                            cidade = excluded.cidade,
                            nome = excluded.nome,
                            tipo_comissionado = excluded.tipo_comissionado,
                            valor_bruto = excluded.valor_bruto,
                            desconto_distrato = 0,
                            status = 'calculado',
                            status_nf = excluded.status_nf,
                            status_financeiro = 'nao_enviado',
                            status_pagamento = 'nao_enviado',
                            exige_nf = excluded.exige_nf,
                            origem = excluded.origem,
                            identificador_usuario = excluded.identificador_usuario,
                            identificador_funcionario = excluded.identificador_funcionario,
                            documento = excluded.documento,
                            email = excluded.email,
                            cargo = excluded.cargo,
                            perfil_acesso = excluded.perfil_acesso,
                            papel_comissionamento = excluded.papel_comissionamento,
                            origem_identidade = excluded.origem_identidade,
                            validacao_lideranca = excluded.validacao_lideranca,
                            atualizado_em = now()
                        """,
                        resultado_id,
                        CICLO_ID,
                        item["funcao"],
                        item["cidade"],
                        item["nome"],
                        tipo_comissionado,
                        valor,
                        status_nf,
                        exige_nf,
                        ORIGEM,
                        identidade.get("identificador_usuario"),
                        identidade.get("identificador_funcionario"),
                        identidade.get("documento"),
                        identidade.get("email"),
                        item["funcao"],
                        identidade.get("perfil_acesso_padrao"),
                        item["papel"],
                        item["fonte"],
                        json.dumps(validacao, ensure_ascii=False),
                    )
                    ids_finais.append(resultado_id)
                    resultado = {"resultado_id": resultado_id, "nome": item["nome"]}
                    await _salvar_regra(conexao, resultado, valor, item["fonte"])
                    importados.append({
                        "resultado_id": resultado_id,
                        "nome": item["nome"],
                        "funcao": item["funcao"],
                        "papel": item["papel"],
                        "valor": float(valor),
                        "fonte": item["fonte"],
                        "origens": item["origens"],
                    })

                removidos = await conexao.fetch(
                    f"""
                    delete from {ESQUEMA_COMISSIONAMENTO}.resultados
                    where ciclo_id = $1 and not (resultado_id = any($2::text[]))
                    returning resultado_id, nome, cargo, valor_bruto
                    """,
                    CICLO_ID,
                    ids_finais,
                )
                await conexao.execute(
                    f"""
                    update {ESQUEMA_COMISSIONAMENTO}.eventos e
                    set payload_depois = jsonb_set(coalesce(payload_depois, '{{}}'::jsonb), '{{resultado_id_removido_do_ciclo}}', to_jsonb(e.resultado_id), true),
                        resultado_id = null,
                        comentario = coalesce(comentario, '') || case when coalesce(comentario, '') = '' then '' else ' ' end || 'Resultado removido pelo ajuste Maio/2026 ativos/minimos.'
                    where ciclo_id = $1
                      and resultado_id is not null
                      and not exists (
                        select 1 from {ESQUEMA_COMISSIONAMENTO}.resultados r where r.resultado_id = e.resultado_id
                      )
                    """,
                    CICLO_ID,
                )
                snapshot = await _recriar_snapshot(conexao, CICLO_ID, inicio, fim, ativos)
                resumo = {
                    "ciclo_id": CICLO_ID,
                    "minimos": len(MINIMOS),
                    "ativos_maio_detectados": len(ativos),
                    "resultados_finais": len(ids_finais),
                    "importados": importados,
                    "removidos": [dict(item) for item in removidos],
                    "snapshot": snapshot,
                }
                await conexao.execute(
                    f"""
                    insert into {ESQUEMA_COMISSIONAMENTO}.eventos (
                        ciclo_id, tipo_evento, comentario, payload_depois, idempotency_key,
                        endereco_ip, agente_do_usuario
                    )
                    values ($1, 'ciclo_maio_2026_ativos_minimos_ajustado', $2, $3::jsonb, $4, '127.0.0.1', $5)
                    """,
                    CICLO_ID,
                    "Maio/2026 ajustado por ativos do mes e lista minima com valores obrigatorios.",
                    json.dumps(resumo, ensure_ascii=False, default=str),
                    f"{AGENTE}:{CICLO_ID}",
                    AGENTE,
                )
            REGISTRO_SAIDA.mkdir(parents=True, exist_ok=True)
            saida = REGISTRO_SAIDA / "comissionamento_maio_2026_ativos_minimos.json"
            saida.write_text(json.dumps(resumo, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
            resumo["arquivo"] = str(saida)
            return resumo
    finally:
        await encerrar_pool_de_conexoes()


def main() -> None:
    resumo = asyncio.run(ajustar())
    print(json.dumps({
        "ciclo_id": resumo["ciclo_id"],
        "minimos": resumo["minimos"],
        "ativos_maio_detectados": resumo["ativos_maio_detectados"],
        "resultados_finais": resumo["resultados_finais"],
        "removidos": len(resumo["removidos"]),
        "snapshot": resumo["snapshot"],
        "arquivo": resumo["arquivo"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
