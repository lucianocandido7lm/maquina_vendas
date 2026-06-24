"""
Processa a fila de notificacoes do Comissionamento em modo seguro.

Uso:
  python processar_fila_notificacoes_comissionamento.py --limite 25
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path


API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from banco import encerrar_pool_de_conexoes, iniciar_pool_de_conexoes  # noqa: E402
from configuracoes import ESQUEMA_COMISSIONAMENTO  # noqa: E402
from servicos.notificacoes_comissionamento import processar_fila  # noqa: E402


async def _executar(limite: int) -> dict:
    pool = await iniciar_pool_de_conexoes()
    try:
        async with pool.acquire() as conexao:
            return await processar_fila(conexao, ESQUEMA_COMISSIONAMENTO, limite)
    finally:
        await encerrar_pool_de_conexoes()


def main() -> int:
    parser = argparse.ArgumentParser(description="Processa fila de notificacoes do Comissionamento em dry-run.")
    parser.add_argument("--limite", type=int, default=25)
    args = parser.parse_args()
    resultado = asyncio.run(_executar(args.limite))
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
