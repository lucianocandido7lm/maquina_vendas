import asyncio
import sys
import json
from pathlib import Path
from decimal import Decimal

# Adiciona o backend no PYTHONPATH
sys.path.append(str(Path(__file__).parent.parent / "01_codigo_fonte" / "api_7lm_connect"))

from banco import iniciar_pool_de_conexoes
from servicos.comissionamento_preview import enriquecer_preview
from repositorios.comissionamento import buscar_preview_ciclo
from configuracoes import ESQUEMA_BANCO

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

async def auditar_ciclo(ciclo_id: str):
    print(f"Iniciando auditoria para o ciclo {ciclo_id}...")
    pool = await iniciar_pool_de_conexoes()
    async with pool.acquire() as conexao:
        # Busca o preview sem os metadados enriquecidos
        # A própria função buscar_preview_ciclo chama enriquecer_preview() e já faz as validações de meta e vinculo
        preview_enriquecido = await buscar_preview_ciclo(conexao, ESQUEMA_BANCO, ciclo_id)
        
        relatorio = {
            "ciclo_id": ciclo_id,
            "pessoas_sem_vinculo": [],
            "pessoas_sem_meta": [],
            "pessoas_sem_realizado": [],
            "indicadores_invalidos": []
        }

        if not preview_enriquecido or "registros" not in preview_enriquecido:
            print("Preview não encontrado ou sem registros.")
            return

        for reg in preview_enriquecido["registros"]:
            comissionado = reg.get("comissionado", {})
            nome = comissionado.get("nome", "Desconhecido")
            identidade_criterio = comissionado.get("criterio_vinculo")

            # Verifica vinculo
            if identidade_criterio == "sem_vinculo":
                relatorio["pessoas_sem_vinculo"].append(nome)

            # Verifica Regra 01
            for r01 in reg.get("regra_01", []):
                status = r01.get("status_calculo")
                if status == "sem_meta":
                    relatorio["pessoas_sem_meta"].append(f"{nome} (Regra 01 - {r01.get('indicador')})")
                elif status == "sem_realizado":
                    relatorio["pessoas_sem_realizado"].append(f"{nome} (Regra 01 - {r01.get('indicador')})")
                elif status == "indicador_invalido":
                    relatorio["indicadores_invalidos"].append(f"{nome} (Regra 01 - {r01.get('indicador')})")

            # Verifica Regra 02 IPs
            for ip in reg.get("regra_02_ips", []):
                status = ip.get("status_calculo")
                if status == "sem_meta":
                    relatorio["pessoas_sem_meta"].append(f"{nome} (Regra 02 - {ip.get('indicador')})")
                elif status == "sem_realizado":
                    relatorio["pessoas_sem_realizado"].append(f"{nome} (Regra 02 - {ip.get('indicador')})")
                elif status == "indicador_invalido":
                    relatorio["indicadores_invalidos"].append(f"{nome} (Regra 02 - {ip.get('indicador')})")

        # Salva o relatorio
        output_file = Path(__file__).parent / f"relatorio_auditoria_{ciclo_id}.json"
        with open(output_file, "w") as f:
            json.dump(relatorio, f, indent=4, cls=DecimalEncoder)
        
        print(f"Relatório de auditoria salvo em {output_file}")
        print("Resumo:")
        print(f"- Sem Vínculo: {len(relatorio['pessoas_sem_vinculo'])}")
        print(f"- Sem Meta: {len(relatorio['pessoas_sem_meta'])}")
        print(f"- Sem Realizado: {len(relatorio['pessoas_sem_realizado'])}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        ciclo = sys.argv[1]
    else:
        ciclo = "2026-06"
    asyncio.run(auditar_ciclo(ciclo))
