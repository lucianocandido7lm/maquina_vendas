import sys
import unittest
from decimal import Decimal
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "01_codigo_fonte" / "api_7lm_connect"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from servicos.clientes import normalizar_payload_cliente  # noqa: E402


class TesteClientesServico(unittest.TestCase):
    def payload_base(self):
        return {
            "nome_completo": "Cliente Teste",
            "cpf": "123.456.789-09",
            "renda_principal": Decimal("3500"),
            "renda_total": Decimal("3500"),
            "parametros_simulacao": {
                "financiamento_caixa": Decimal("145954.56"),
                "fgts": Decimal("0"),
            },
        }

    def test_campos_obrigatorios_do_simulador_sao_aceitos(self):
        dados = normalizar_payload_cliente(self.payload_base())
        self.assertEqual(dados["nome_completo"], "Cliente Teste")
        self.assertEqual(dados["cpf"], "12345678909")
        self.assertEqual(dados["parametros_simulacao"]["financiamento_caixa"], "145954.56")
        self.assertEqual(dados["parametros_simulacao"]["fgts"], "0")

    def test_exige_cpf_para_salvar_cliente(self):
        payload = self.payload_base()
        payload["cpf"] = ""
        with self.assertRaisesRegex(ValueError, "Informe o CPF do cliente."):
            normalizar_payload_cliente(payload)

    def test_exige_renda_principal_para_simulador(self):
        payload = self.payload_base()
        payload["renda_principal"] = Decimal("0")
        with self.assertRaisesRegex(ValueError, "Informe a renda principal do cliente."):
            normalizar_payload_cliente(payload)

    def test_exige_valor_aprovado_para_simulador(self):
        payload = self.payload_base()
        payload["parametros_simulacao"] = {"fgts": Decimal("0")}
        with self.assertRaisesRegex(ValueError, "Informe o valor aprovado / financiamento do cliente."):
            normalizar_payload_cliente(payload)

    def test_exige_fgts_mesmo_quando_zero_eh_valido(self):
        payload = self.payload_base()
        payload["parametros_simulacao"] = {"financiamento_caixa": Decimal("145954.56")}
        with self.assertRaisesRegex(ValueError, "Informe o FGTS do cliente."):
            normalizar_payload_cliente(payload)


if __name__ == "__main__":
    unittest.main()
