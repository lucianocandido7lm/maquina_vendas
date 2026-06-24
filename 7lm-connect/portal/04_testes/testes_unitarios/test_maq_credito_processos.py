import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "01_codigo_fonte" / "api_7lm_connect"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from modulos.maq_credito import processos as processos_mod  # noqa: E402


class TesteMaqCreditoProcessos(unittest.TestCase):
    def processo_base(self):
        return {
            "reserva": "cliente-123",
            "cliente": "Maria Cliente",
            "cliente_id": "cliente-123",
            "cliente_cpf": "12345678900",
            "cliente_email": "maria@email.com",
            "cliente_telefone": "(64) 99999-0000",
            "cliente_cidade": "Catalao",
            "cliente_estado": "GO",
            "origem": "cliente_comercial",
            "tem_processo": False,
            "caixa_status": "reserva",
            "agehab_status": "reserva",
            "produto": "Apartamento",
            "corretor": "Pamela",
            "empreendimento": "CAT",
            "reserva_comercial_id": "reserva-789",
            "reserva_comercial_status": "ATIVA",
            "imovel_id": "imovel-456",
            "imovel_titulo": "Apartamento 402 - Bloco 19",
            "imovel_endereco": "Rua Bouganville",
            "imovel_cidade": "Catalao",
            "imovel_bairro": "Parque Imperial II",
            "imovel_estado": "GO",
            "imovel_status": "Reservado",
            "simulacao_id": "sim-321",
            "simulacao_status": "invalida",
            "simulacao_valor_imovel": 250000.0,
            "simulacao_valor_total_operacao": 220000.0,
            "simulacao_financiamento_caixa": 145603.95,
            "simulacao_fgts": 5752.71,
            "simulacao_subsidio": 24094.0,
            "simulacao_entrada": 1000.03,
            "cliente_cadastro": {
                "nome_completo": "Maria Cliente",
                "cpf": "12345678900",
                "renda_total": "2390.00",
            },
            "reserva_comercial": {
                "identificador_reserva": "reserva-789",
                "status": "ATIVA",
            },
            "imovel_detalhes": {
                "titulo": "Apartamento 402 - Bloco 19",
                "valor": "250000.00",
            },
            "simulacao_detalhes": {
                "status_simulacao": "invalida",
                "payload_snapshot": {
                    "resumo_operacao": {
                        "valor_imovel": "250000.00",
                        "subsidio": "24094.00",
                    }
                },
            },
            "simulacao_fechada": {
                "fgts": "5752.71",
                "financiamento_caixa": "145603.95",
            },
        }

    def test_carteira_sql_inclui_reserva_imovel_e_simulacao(self):
        query = processos_mod.carteira_sql(include_payloads=True)

        self.assertIn(f"from {processos_mod.COMERCIAL_SCHEMA}.cliente c", query)
        self.assertIn(f"from {processos_mod.COMERCIAL_SCHEMA}.imovel_reserva r", query)
        self.assertIn(f"left join {processos_mod.COMERCIAL_SCHEMA}.imovel i", query)
        self.assertIn(f"left join {processos_mod.COMERCIAL_SCHEMA}.simulacao s", query)
        self.assertIn("coalesce(to_jsonb(s), '{}'::jsonb) as simulacao_detalhes", query)
        self.assertIn("coalesce(c.parametros_simulacao, '{}'::jsonb) as simulacao_fechada", query)

    def test_processo_to_response_serializa_payload_completo(self):
        response = processos_mod.processo_to_response(self.processo_base(), include_details=False)

        self.assertEqual(response.imovel_titulo, "Apartamento 402 - Bloco 19")
        self.assertEqual(response.reserva_comercial_id, "reserva-789")
        self.assertEqual(response.simulacao_id, "sim-321")
        self.assertEqual(response.simulacao_subsidio, 24094.0)
        self.assertEqual(response.cliente_cadastro["nome_completo"], "Maria Cliente")
        self.assertEqual(response.simulacao_fechada["fgts"], "5752.71")

    def test_obter_processo_resolve_cliente_comercial_sem_processo_manual(self):
        with patch.object(processos_mod, "fetch_one", side_effect=[self.processo_base()]):
            response = processos_mod.obter_processo("cliente-123")

        self.assertEqual(response.cliente, "Maria Cliente")
        self.assertEqual(response.imovel_titulo, "Apartamento 402 - Bloco 19")
        self.assertEqual(response.simulacao_id, "sim-321")
        self.assertFalse(response.tem_processo)

    def test_obter_processo_sem_carteira_retorna_fallback_sem_processo(self):
        with patch.object(processos_mod, "fetch_one", side_effect=[None, None]):
            response = processos_mod.obter_processo("nao-existe")

        self.assertEqual(response.reserva, "nao-existe")
        self.assertFalse(response.tem_processo)
        self.assertIsNone(response.cliente)
        self.assertEqual(response.sla.status, "nao_iniciado")


if __name__ == "__main__":
    unittest.main()
