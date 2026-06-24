"""
Gera de forma idempotente o quadro diario de funcionarios.
Uso previsto: cron/systemd timer no servidor.
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from banco import encerrar_pool_de_conexoes, iniciar_pool_de_conexoes
from servicos.funcionarios_acesso import gerar_quadro_diario


def obter_data_alvo() -> date:
    if len(sys.argv) > 1 and sys.argv[1].strip():
        return date.fromisoformat(sys.argv[1].strip())

    agora_brasilia = datetime.now(ZoneInfo("America/Sao_Paulo"))
    return agora_brasilia.date() + timedelta(days=1)


async def main() -> None:
    pool = await iniciar_pool_de_conexoes()
    try:
        data_status = obter_data_alvo()
        async with pool.acquire() as conexao:
            novas_linhas = await gerar_quadro_diario(conexao, data_status)
        print(json.dumps({"data_status": str(data_status), "novas_linhas": novas_linhas}, ensure_ascii=False))
    finally:
        await encerrar_pool_de_conexoes()


if __name__ == "__main__":
    asyncio.run(main())
