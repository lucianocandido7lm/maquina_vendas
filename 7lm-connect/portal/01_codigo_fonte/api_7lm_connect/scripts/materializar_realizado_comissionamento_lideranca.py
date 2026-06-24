"""
Materializa o realizado oficial do comissionamento para gestores/coordenadores.

Uso:
  python scripts/materializar_realizado_comissionamento_lideranca.py --ciclo 2026-06
  python scripts/materializar_realizado_comissionamento_lideranca.py --ciclo 2026-06 --apply

Sem --apply, apenas gera auditoria em 03_registros/comissionamento/auditorias.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


API_DIR = Path(__file__).resolve().parents[1]
PORTAL_ROOT = API_DIR.parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from banco import encerrar_pool_de_conexoes, iniciar_pool_de_conexoes  # noqa: E402
from servicos.comissionamento_indicadores import materializar_resultados_metas_lideranca  # noqa: E402


SAIDA_DIR = PORTAL_ROOT / "03_registros" / "comissionamento" / "auditorias"


def _json_default(valor: Any) -> Any:
    if hasattr(valor, "isoformat"):
        return valor.isoformat()
    return str(valor)


async def executar(ciclo_id: str, aplicar: bool) -> dict[str, Any]:
    pool = await iniciar_pool_de_conexoes()
    try:
        async with pool.acquire() as conexao:
            async with conexao.transaction():
                relatorio = await materializar_resultados_metas_lideranca(conexao, ciclo_id, aplicar=aplicar)
                if not aplicar:
                    raise RuntimeError("__ROLLBACK_DRY_RUN__")
    except RuntimeError as exc:
        if str(exc) != "__ROLLBACK_DRY_RUN__":
            raise
        async with pool.acquire() as conexao:
            relatorio = await materializar_resultados_metas_lideranca(conexao, ciclo_id, aplicar=False)
    finally:
        await encerrar_pool_de_conexoes()

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    SAIDA_DIR.mkdir(parents=True, exist_ok=True)
    caminho = SAIDA_DIR / f"realizado_comissionamento_lideranca_{ciclo_id}_{'apply' if aplicar else 'dry_run'}_{timestamp}.json"
    payload = {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "script": Path(__file__).name,
        "relatorio": relatorio,
    }
    caminho.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=_json_default), encoding="utf-8")
    relatorio["arquivo"] = str(caminho)
    return relatorio


def main() -> None:
    parser = argparse.ArgumentParser(description="Materializa realizado oficial para comissionamento de gestores/coordenadores.")
    parser.add_argument("--ciclo", default="2026-06")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    relatorio = asyncio.run(executar(args.ciclo, args.apply))
    print(json.dumps(relatorio, ensure_ascii=False, indent=2, default=_json_default))


if __name__ == "__main__":
    main()
