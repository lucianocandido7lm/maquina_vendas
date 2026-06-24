import asyncio
from decimal import Decimal
from unittest.mock import AsyncMock
import sys
from pathlib import Path

# Adiciona o backend no PYTHONPATH
sys.path.append(str(Path(__file__).parent.parent))

from servicos.comissionamento_preview import _montar_regra_01
from servicos.validador_comissionamento import resolver_indicador

async def test_regra_01_atingimento_50_porcento():
    conexao_mock = AsyncMock()
    # Mock meta
    conexao_mock.fetchrow.side_effect = [
        {"valor_meta": Decimal("100")}, # meta
        {"valor_realizado": Decimal("50")} # realizado
    ]
    registro = {"id": "1", "valor_bruto": Decimal("1000")}
    identidade = {"pessoa_id": "123", "criterio_vinculo": "usuario_direto"}
    
    resultado = await _montar_regra_01(registro, conexao_mock, "esquema", identidade)
    assert resultado[0]["status_calculo"] == "ok"
    assert resultado[0]["percentual_atingimento"] == 50.0
    print("test_regra_01_atingimento_50_porcento: PASS")

async def test_regra_01_sem_meta():
    conexao_mock = AsyncMock()
    conexao_mock.fetchrow.side_effect = [None] # sem meta
    
    registro = {"id": "1", "valor_bruto": Decimal("1000")}
    identidade = {"pessoa_id": "123", "criterio_vinculo": "usuario_direto"}
    
    resultado = await _montar_regra_01(registro, conexao_mock, "esquema", identidade)
    assert resultado[0]["status_calculo"] == "sem_meta"
    print("test_regra_01_sem_meta: PASS")

if __name__ == '__main__':
    asyncio.run(test_regra_01_atingimento_50_porcento())
    asyncio.run(test_regra_01_sem_meta())
