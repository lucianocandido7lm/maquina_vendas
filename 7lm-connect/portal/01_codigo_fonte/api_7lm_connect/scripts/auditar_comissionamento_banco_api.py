"""
Auditoria backend 100% Banco/API do modulo de Comissionamento.

Este script e somente leitura para o banco. Ele inspeciona codigo fonte,
catalogo do Postgres e dados operacionais dos ciclos alvo, gerando um relatorio
JSON em 03_registros/comissionamento/auditorias/backend.
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import date, datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
import re
import sys
from typing import Any
import uuid


API_DIR = Path(__file__).resolve().parents[1]
PORTAL_DIR = API_DIR.parents[1]
REGISTROS_DIR = PORTAL_DIR / "03_registros" / "comissionamento" / "auditorias" / "backend"
FRONTEND_API = PORTAL_DIR / "05_modulos/comissionamento/src/api/comissionamentoApi.js"
FRONTEND_SRC = PORTAL_DIR / "05_modulos/comissionamento/src"
BACKEND_ROUTES = API_DIR / "rotas/rotas_de_comissionamento.py"
BACKEND_MODULE_DIRS = [
    API_DIR / "rotas",
    API_DIR / "repositorios",
    API_DIR / "servicos",
]

if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from banco import encerrar_pool_de_conexoes, iniciar_pool_de_conexoes  # noqa: E402


CICLOS_PADRAO = ("2026-06", "2026-06-fluxo-manual")
SCHEMA_COMISSIONAMENTO = "comissionamento"
TABELAS_OFICIAIS = {
    "sevenlm_connect": [
        "usuario",
        "funcionario_acesso",
        "perfil",
        "permissao",
        "usuario_perfil",
        "usuario_permissao",
        "perfil_permissao",
        "funcionario_equipe_vigencia",
    ],
    "connect_comercial": ["dashboard_gc_produtividade_hierarquia"],
}
PADROES_PROIBIDOS_FRONT = [
    r"postgres",
    r"5432",
    r"127\.0\.0\.1:8000",
    r"localhost:8000",
    r"/root/data-engineering",
    r"\.xlsx",
    r"\.xlsm",
    r"\.csv",
]
PADROES_ARQUIVO_BACKEND_RUNTIME = [
    r"pd\.read_excel",
    r"read_excel",
    r"\.xlsx",
    r"\.xlsm",
    r"/root/data-engineering",
]


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _serializar(valor: Any) -> Any:
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()
    if isinstance(valor, uuid.UUID):
        return str(valor)
    if isinstance(valor, dict):
        return {str(chave): _serializar(item) for chave, item in valor.items()}
    if isinstance(valor, list):
        return [_serializar(item) for item in valor]
    return valor


def _linha_dict(linha: Any) -> dict[str, Any]:
    return _serializar(dict(linha))


def _normalizar_rota(texto: str) -> str:
    texto = texto.strip().strip("`'\"")
    texto = texto.replace("/api", "", 1) if texto.startswith("/api/") else texto
    texto = texto.split("?", 1)[0]
    texto = re.sub(r"\$\{[^}]+\}", "{}", texto)
    texto = re.sub(r"\{[^}/]+\}", "{}", texto)
    return texto


def _ler_texto(caminho: Path) -> str:
    return caminho.read_text(encoding="utf-8", errors="replace")


def _extrair_rotas_backend() -> list[dict[str, str]]:
    texto = _ler_texto(BACKEND_ROUTES)
    padrao = re.compile(r"@rotas_de_comissionamento\.(get|post|put|delete|patch)\(\s*[\"']([^\"']+)[\"']")
    rotas = []
    for metodo, caminho in padrao.findall(texto):
        rotas.append(
            {
                "metodo": metodo.upper(),
                "path": caminho,
                "path_publico": f"/api{caminho}",
                "normalizado": _normalizar_rota(caminho),
            }
        )
    return rotas


def _extrair_chamadas_frontend() -> list[dict[str, str]]:
    texto = _ler_texto(FRONTEND_API)
    chamadas: list[dict[str, str]] = []
    padroes = [
        re.compile(r"apiRequest\(\s*`([^`]+)`"),
        re.compile(r"apiRequest\(\s*'([^']+)'"),
        re.compile(r"apiRequest\(\s*\"([^\"]+)\""),
        re.compile(r"=>\s*`([^`]*?/api/comissionamento[^`]*)`"),
    ]
    encontrados = set()
    for padrao in padroes:
        for item in padrao.findall(texto):
            if "/api/comissionamento" not in item and item != "/api/me":
                continue
            chave = item.strip()
            if chave in encontrados:
                continue
            encontrados.add(chave)
            chamadas.append(
                {
                    "url": chave,
                    "normalizado": _normalizar_rota(chave),
                    "fonte": str(FRONTEND_API.relative_to(PORTAL_DIR)),
                }
            )
    return chamadas


def _auditar_frontend_estatico() -> dict[str, Any]:
    arquivos = [path for path in FRONTEND_SRC.rglob("*") if path.is_file() and path.suffix in {".js", ".jsx", ".ts", ".tsx"}]
    achados = []
    for caminho in arquivos:
        texto = _ler_texto(caminho)
        for padrao in PADROES_PROIBIDOS_FRONT:
            if re.search(padrao, texto, flags=re.IGNORECASE):
                achados.append(
                    {
                        "arquivo": str(caminho.relative_to(PORTAL_DIR)),
                        "padrao": padrao,
                        "risco": "frontend_com_referencia_direta_a_infra_ou_arquivo",
                    }
                )
    return {"arquivos_verificados": len(arquivos), "achados": achados}


def _auditar_backend_runtime_estatico() -> dict[str, Any]:
    arquivos: list[Path] = []
    for base in BACKEND_MODULE_DIRS:
        arquivos.extend(path for path in base.rglob("*.py") if path.is_file())
    arquivos = [path for path in arquivos if "comissionamento" in path.name]
    achados = []
    for caminho in arquivos:
        texto = _ler_texto(caminho)
        for padrao in PADROES_ARQUIVO_BACKEND_RUNTIME:
            if re.search(padrao, texto, flags=re.IGNORECASE):
                achados.append(
                    {
                        "arquivo": str(caminho.relative_to(PORTAL_DIR)),
                        "padrao": padrao,
                        "risco": "backend_runtime_com_dependencia_de_arquivo_externo",
                    }
                )
    return {"arquivos_verificados": len(arquivos), "achados": achados}


async def _catalogo_colunas(conexao) -> list[dict[str, Any]]:
    tabelas = await conexao.fetch(
        """
        select table_schema, table_name, column_name, data_type, is_nullable, column_default
          from information_schema.columns
         where table_schema = $1
            or (table_schema = 'sevenlm_connect'
                and table_name = any($2::text[]))
            or (table_schema = 'connect_comercial'
                and table_name = any($3::text[]))
         order by table_schema, table_name, ordinal_position
        """,
        SCHEMA_COMISSIONAMENTO,
        TABELAS_OFICIAIS["sevenlm_connect"],
        TABELAS_OFICIAIS["connect_comercial"],
    )
    return [_linha_dict(linha) for linha in tabelas]


async def _catalogo_constraints(conexao) -> list[dict[str, Any]]:
    linhas = await conexao.fetch(
        """
        select tc.table_schema,
               tc.table_name,
               tc.constraint_name,
               tc.constraint_type,
               string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as colunas
          from information_schema.table_constraints tc
          left join information_schema.key_column_usage kcu
            on kcu.constraint_schema = tc.constraint_schema
           and kcu.constraint_name = tc.constraint_name
           and kcu.table_schema = tc.table_schema
           and kcu.table_name = tc.table_name
         where tc.table_schema = $1
            or (tc.table_schema = 'sevenlm_connect'
                and tc.table_name = any($2::text[]))
            or (tc.table_schema = 'connect_comercial'
                and tc.table_name = any($3::text[]))
         group by 1, 2, 3, 4
         order by 1, 2, 4, 3
        """,
        SCHEMA_COMISSIONAMENTO,
        TABELAS_OFICIAIS["sevenlm_connect"],
        TABELAS_OFICIAIS["connect_comercial"],
    )
    return [_linha_dict(linha) for linha in linhas]


async def _catalogo_indices(conexao) -> list[dict[str, Any]]:
    linhas = await conexao.fetch(
        """
        select schemaname as table_schema, tablename as table_name, indexname, indexdef
          from pg_indexes
         where schemaname = $1
            or (schemaname = 'sevenlm_connect'
                and tablename = any($2::text[]))
            or (schemaname = 'connect_comercial'
                and tablename = any($3::text[]))
         order by schemaname, tablename, indexname
        """,
        SCHEMA_COMISSIONAMENTO,
        TABELAS_OFICIAIS["sevenlm_connect"],
        TABELAS_OFICIAIS["connect_comercial"],
    )
    return [_linha_dict(linha) for linha in linhas]


async def _validar_ciclos(conexao, ciclos: tuple[str, ...]) -> list[dict[str, Any]]:
    saida = []
    for ciclo in ciclos:
        linha = await conexao.fetchrow(
            """
            select c.ciclo_id,
                   c.rotulo,
                   c.status,
                   count(r.resultado_id) as resultados,
                   coalesce(sum(r.valor_bruto), 0) as valor_bruto_total,
                   count(*) filter (where r.identificador_usuario is not null) as com_usuario,
                   count(*) filter (where r.identificador_funcionario is not null) as com_funcionario,
                   count(*) filter (where coalesce(r.documento, '') <> '') as com_documento,
                   count(*) filter (where coalesce(r.email, '') <> '') as com_email,
                   count(*) filter (where coalesce(r.origem_identidade, '') <> '') as com_origem_identidade
              from comissionamento.ciclos c
              left join comissionamento.resultados r on r.ciclo_id = c.ciclo_id
             where c.ciclo_id = $1
             group by c.ciclo_id, c.rotulo, c.status
            """,
            ciclo,
        )
        if not linha:
            saida.append({"ciclo_id": ciclo, "existe": False})
            continue
        saida.append({"existe": True, **_linha_dict(linha)})
    return saida


async def _validar_identidade_hierarquia(conexao, ciclos: tuple[str, ...]) -> list[dict[str, Any]]:
    saida = []
    for ciclo in ciclos:
        identidade = await conexao.fetchrow(
            """
            with resultados as (
                select *
                  from comissionamento.resultados
                 where ciclo_id = $1
            )
            select $1::text as ciclo_id,
                   count(distinct r.resultado_id) as resultados,
                   count(distinct r.resultado_id) filter (
                     where r.identificador_usuario is not null
                        or r.identificador_funcionario is not null
                        or coalesce(r.documento, '') <> ''
                        or coalesce(r.email, '') <> ''
                   ) as com_alguma_identidade,
                   count(distinct r.resultado_id) filter (where f.identificador_funcionario is not null) as match_funcionario,
                   count(distinct r.resultado_id) filter (where u.identificador_usuario is not null) as match_usuario,
                   count(distinct r.resultado_id) filter (
                     where lower(coalesce(r.cargo, '') || ' ' || coalesce(r.perfil_acesso, '') || ' ' || coalesce(r.papel_comissionamento, ''))
                           ~ '(gerente|gestor|coordenador|head|lider)'
                   ) as com_classificacao_lideranca,
                   count(distinct r.resultado_id) filter (where r.validacao_lideranca <> '{}'::jsonb) as com_validacao_lideranca
              from resultados r
              left join sevenlm_connect.funcionario_acesso f
                on f.identificador_funcionario = r.identificador_funcionario
                or (r.documento is not null and r.documento <> '' and f.documento = r.documento)
                or (r.email is not null and r.email <> '' and lower(f.email::text) = lower(r.email))
              left join sevenlm_connect.usuario u
                on u.identificador_usuario = r.identificador_usuario
                or (r.email is not null and r.email <> '' and lower(u.correio_eletronico::text) = lower(r.email))
            """,
            ciclo,
        )
        snapshot = await conexao.fetchrow(
            """
            select $1::text as ciclo_id,
                   count(*) as vinculos_snapshot,
                   count(distinct comissionado_id) as comissionados_snapshot,
                   count(*) filter (where vinculo_origem = 'dashboard_hierarquia') as vinculos_dashboard,
                   count(*) filter (where vinculo_origem = 'funcionario_acesso') as vinculos_funcionario,
                   count(*) filter (where origem_json <> '{}'::jsonb) as com_origem_json
              from comissionamento.hierarquia_snapshot
             where ciclo_id = $1
            """,
            ciclo,
        )
        saida.append(
            {
                "ciclo_id": ciclo,
                "identidade_resultados": _linha_dict(identidade),
                "hierarquia_snapshot": _linha_dict(snapshot),
            }
        )
    return saida


async def _validar_orfandade(conexao) -> dict[str, Any]:
    consultas = {
        "resultados_sem_ciclo": """
            select count(*) as quantidade
              from comissionamento.resultados r
              left join comissionamento.ciclos c on c.ciclo_id = r.ciclo_id
             where c.ciclo_id is null
        """,
        "eventos_sem_resultado_quando_informado": """
            select count(*) as quantidade
              from comissionamento.eventos e
              left join comissionamento.resultados r on r.resultado_id = e.resultado_id
             where e.resultado_id is not null and r.resultado_id is null
        """,
        "documentos_sem_resultado_quando_informado": """
            select count(*) as quantidade
              from comissionamento.documentos d
              left join comissionamento.resultados r on r.resultado_id = d.resultado_id
             where d.resultado_id is not null and r.resultado_id is null
        """,
        "regras_ativas_duplicadas": """
            select count(*) as quantidade
              from (
                select ciclo_id, comissionado_id, regra_tipo
                  from comissionamento.regras_publicadas
                 where ativo is true
                 group by ciclo_id, comissionado_id, regra_tipo
                having count(*) > 1
              ) duplicadas
        """,
    }
    saida = {}
    for nome, sql in consultas.items():
        saida[nome] = _serializar(await conexao.fetchval(sql))
    return saida


def _comparar_front_backend(rotas_backend: list[dict[str, str]], chamadas_front: list[dict[str, str]]) -> dict[str, Any]:
    backend_paths = {rota["normalizado"] for rota in rotas_backend}
    chamadas_comissionamento = [item for item in chamadas_front if item["normalizado"].startswith("/comissionamento")]
    sem_rota_backend = sorted(
        {
            item["normalizado"]
            for item in chamadas_comissionamento
            if item["normalizado"] not in backend_paths
        }
    )
    nao_consumidas_no_front = sorted(
        path for path in backend_paths if path not in {item["normalizado"] for item in chamadas_comissionamento}
    )
    return {
        "total_backend": len(rotas_backend),
        "total_frontend": len(chamadas_comissionamento),
        "frontend_sem_rota_backend": sem_rota_backend,
        "rotas_backend_nao_consumidas_diretamente_pelo_api_js": nao_consumidas_no_front,
    }


def _montar_achados(relatorio: dict[str, Any]) -> list[dict[str, Any]]:
    achados = []
    for path in relatorio["comparacao_front_backend"]["frontend_sem_rota_backend"]:
        achados.append(
            {
                "severidade": "alta",
                "codigo": "frontend_sem_rota_backend",
                "mensagem": f"Chamada frontend sem rota backend correspondente: {path}",
            }
        )
    for item in relatorio["chamadas_frontend"]["auditoria_estatica"]["achados"]:
        achados.append(
            {
                "severidade": "alta",
                "codigo": "frontend_referencia_infra_ou_arquivo",
                "mensagem": f"{item['arquivo']} contem padrao {item['padrao']}",
            }
        )
    for item in relatorio["rotas_backend"]["auditoria_runtime_arquivos"]["achados"]:
        achados.append(
            {
                "severidade": "media",
                "codigo": "backend_runtime_arquivo_externo",
                "mensagem": f"{item['arquivo']} contem padrao {item['padrao']}",
            }
        )
    for ciclo in relatorio["validacao_ciclos"]:
        if not ciclo.get("existe"):
            achados.append(
                {
                    "severidade": "alta",
                    "codigo": "ciclo_ausente",
                    "mensagem": f"Ciclo esperado ausente: {ciclo['ciclo_id']}",
                }
            )
    for item in relatorio["validacao_identidade_hierarquia"]:
        identidade = item.get("identidade_resultados") or {}
        snapshot = item.get("hierarquia_snapshot") or {}
        if identidade.get("resultados") and not snapshot.get("vinculos_snapshot"):
            achados.append(
                {
                    "severidade": "media",
                    "codigo": "ciclo_sem_hierarquia_snapshot",
                    "mensagem": f"Ciclo {item['ciclo_id']} possui resultados, mas nao possui vinculos em hierarquia_snapshot.",
                }
            )
        elif not ciclo.get("resultados"):
            achados.append(
                {
                    "severidade": "alta",
                    "codigo": "ciclo_sem_resultados",
                    "mensagem": f"Ciclo sem resultados: {ciclo['ciclo_id']}",
                }
            )
    for chave, quantidade in relatorio["validacao_orfandade"].items():
        if quantidade:
            achados.append(
                {
                    "severidade": "media",
                    "codigo": chave,
                    "mensagem": f"Quantidade encontrada: {quantidade}",
                }
            )
    achados.extend(
        [
            {
                "severidade": "informativa",
                "codigo": "regras_audit_only",
                "mensagem": "POST /comissionamento/regras e PUT /notificacoes/regras sao audit only; a persistencia oficial de regra e /regras/{regra_id}/publicar.",
            },
            {
                "severidade": "informativa",
                "codigo": "nf_sem_pdf_persistido",
                "mensagem": "NF grava metadados no banco; PDF e anexo transiente nesta fase.",
            },
        ]
    )
    return achados


async def auditar(ciclos: tuple[str, ...]) -> dict[str, Any]:
    rotas_backend = _extrair_rotas_backend()
    chamadas_front = _extrair_chamadas_frontend()
    relatorio: dict[str, Any] = {
        "timestamp": _agora(),
        "escopo": "comissionamento",
        "fluxo_esperado": "Frontend autenticado -> /api/comissionamento/* -> FastAPI -> Postgres -> API -> Frontend",
        "rotas_backend": {
            "arquivo": str(BACKEND_ROUTES.relative_to(PORTAL_DIR)),
            "items": rotas_backend,
            "auditoria_runtime_arquivos": _auditar_backend_runtime_estatico(),
        },
        "chamadas_frontend": {
            "arquivo": str(FRONTEND_API.relative_to(PORTAL_DIR)),
            "items": chamadas_front,
            "auditoria_estatica": _auditar_frontend_estatico(),
        },
        "comparacao_front_backend": _comparar_front_backend(rotas_backend, chamadas_front),
        "tabelas_e_chaves": {},
        "validacao_identidade_hierarquia": [],
        "validacao_ciclos": [],
        "validacao_orfandade": {},
        "achados": [],
        "recomendacoes": [
            "Manter runtime do Comissionamento sem leitura de Excel/CSV/JSON local.",
            "Usar /api/comissionamento/* como unico contrato publico do frontend.",
            "Manter connect_comercial.dashboard_gc_produtividade_hierarquia como fonte mensal de hierarquia e sevenlm_connect como fonte de identidade.",
            "Tratar funcionario_equipe_vigencia como fonte auxiliar/catalogal ate existir uso direto no snapshot.",
        ],
    }
    pool = await iniciar_pool_de_conexoes()
    try:
        async with pool.acquire() as conexao:
            relatorio["tabelas_e_chaves"] = {
                "colunas": await _catalogo_colunas(conexao),
                "constraints": await _catalogo_constraints(conexao),
                "indices": await _catalogo_indices(conexao),
            }
            relatorio["validacao_ciclos"] = await _validar_ciclos(conexao, ciclos)
            relatorio["validacao_identidade_hierarquia"] = await _validar_identidade_hierarquia(conexao, ciclos)
            relatorio["validacao_orfandade"] = await _validar_orfandade(conexao)
    finally:
        await encerrar_pool_de_conexoes()

    relatorio["achados"] = _montar_achados(relatorio)
    relatorio["status_geral"] = "ok" if not any(item["severidade"] == "alta" for item in relatorio["achados"]) else "atencao"
    return relatorio


def _caminho_saida(caminho: str | None) -> Path:
    if caminho:
        return Path(caminho).expanduser().resolve()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return REGISTROS_DIR / f"comissionamento_backend_audit_{timestamp}.json"


async def main() -> None:
    parser = argparse.ArgumentParser(description="Auditoria Banco/API do Comissionamento.")
    parser.add_argument("--ciclo", action="append", dest="ciclos", help="Ciclo a validar. Pode repetir.")
    parser.add_argument("--saida", help="Caminho opcional do relatorio JSON.")
    args = parser.parse_args()
    ciclos = tuple(args.ciclos or CICLOS_PADRAO)
    relatorio = await auditar(ciclos)
    saida = _caminho_saida(args.saida)
    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(json.dumps(_serializar(relatorio), ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status_geral": relatorio["status_geral"], "relatorio": str(saida)}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
