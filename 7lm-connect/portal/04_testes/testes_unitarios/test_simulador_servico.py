import sys
import unittest
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "01_codigo_fonte" / "api_7lm_connect"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from servicos.simulador import (  # noqa: E402
    _add_months,
    _normalizar_prazos_simulacao,
    _parcela_cliente_minima,
    _reordenar_sugestoes_para_exibicao,
    analisar_aprovacao_excecao,
    calcular_simulacao_comercial,
    sugerir_imoveis_inteligentes,
    validar_operacao_final,
)
from modelos.simulador import RequisicaoCalcularSimulacao  # noqa: E402
from validacoes.imoveis import calcular_meses_ate_entrega_dinamica  # noqa: E402


class TesteSimuladorServico(unittest.TestCase):
    def setUp(self):
        self.cliente_base = {
            "identificador_cliente": "11111111-1111-1111-1111-111111111111",
            "nome_completo": "Cliente Teste",
            "cpf": "111.111.111-11",
            "cidade": "Campinas",
            "email": "cliente@teste.com",
            "telefone": "(19) 99999-9999",
            "renda_principal": Decimal("5000"),
            "renda_conjuge": Decimal("0"),
            "outras_rendas": Decimal("0"),
            "renda_total": Decimal("5000"),
        }
        self.complementos_base = [
            {
                "identificador_complemento": "22222222-2222-2222-2222-222222222222",
                "identificador_cliente": "11111111-1111-1111-1111-111111111111",
                "nome": "Complemento Ativo",
                "cpf": "22222222222",
                "parentesco": "Conjuge",
                "renda": Decimal("2000"),
                "incluir_na_analise": True,
            },
            {
                "identificador_complemento": "33333333-3333-3333-3333-333333333333",
                "identificador_cliente": "11111111-1111-1111-1111-111111111111",
                "nome": "Complemento Inativo",
                "cpf": "33333333333",
                "parentesco": "Irmao",
                "renda": Decimal("3000"),
                "incluir_na_analise": False,
            },
        ]
        self.imovel_base = {
            "identificador_imovel": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "titulo": "Unidade 101",
            "tipo_imovel": "Apartamento",
            "cidade": "Campinas",
            "bairro": "Centro",
            "valor": Decimal("300000"),
            "status": "Disponivel",
        }

    def _payload_base(self):
        return {
            "entrada": Decimal("30000"),
            "financiamento_caixa": Decimal("240000"),
            "parcela_financiamento_banco": Decimal("1440"),
            "fgts": Decimal("0"),
            "subsidio": Decimal("0"),
            "cheque_moradia": Decimal("0"),
            "sobrepreco": Decimal("0"),
            "meses_pre_entrega": 36,
            "meses_pos_entrega": 24,
            "parcela_intermediaria_valor": Decimal("0"),
            "parcelas_intermediarias_quantidade": 0,
            "parcela_anual_valor": Decimal("0"),
            "parcelas_anuais_quantidade": 0,
            "parcela_semestral_valor": Decimal("0"),
            "parcelas_semestrais_quantidade": 0,
            "parcela_reforco_valor": Decimal("0"),
            "parcelas_reforco_quantidade": 0,
        }

    def test_calculo_ideal_com_fechamento_noventa(self):
        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            self.imovel_base,
            self._payload_base(),
        )
        resumo = resultado["resumo_operacao"]
        cliente = resultado["cliente"]

        self.assertEqual(cliente["renda_total"], Decimal("7000.00"))
        self.assertEqual(resumo["classificacao_fechamento_inicial"], "ideal")
        self.assertEqual(resumo["valor_fechamento_inicial"], Decimal("270000.00"))
        self.assertGreaterEqual(resumo["percentual_fechamento_inicial"], Decimal("0.90"))
        self.assertEqual(resumo["valor_projetado_entrega"], Decimal("298500.00"))
        self.assertGreaterEqual(resumo["percentual_projetado_entrega"], Decimal("0.99"))
        self.assertEqual(resumo["classificacao_projecao_entrega"], "ideal")
        self.assertEqual(resumo["status_simulacao"], "ideal")
        self.assertEqual(resumo["parcela_7lm_pos_ideal"], Decimal("1500.00"))

    def test_trava_quarenta_cinco_invalida(self):
        payload = self._payload_base()
        payload["entrada"] = Decimal("15000")
        payload["financiamento_caixa"] = Decimal("150000")
        payload["meses_pre_entrega"] = 1
        payload["meses_pos_entrega"] = 0

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            [],
            self.imovel_base,
            payload,
        )
        resumo = resultado["resumo_operacao"]
        texto_bloqueios = " ".join(resumo["bloqueios"]).lower()

        self.assertEqual(resumo["status_simulacao"], "inválida")
        self.assertGreater(resumo["percentual_comprometimento"], Decimal("0.45"))
        self.assertIn("45%", texto_bloqueios)

    def test_garantido_planejado_mantem_status_ideal_mesmo_abaixo_de_noventa_por_cento(self):
        payload = self._payload_base()
        payload["entrada"] = Decimal("15000")
        payload["financiamento_caixa"] = Decimal("240000")

        resultado = calcular_simulacao_comercial(self.cliente_base, self.complementos_base, self.imovel_base, payload)
        resumo = resultado["resumo_operacao"]

        self.assertEqual(resumo["percentual_fechamento_inicial"], Decimal("0.8500"))
        self.assertEqual(resumo["classificacao_fechamento_inicial"], "ideal")
        self.assertEqual(resumo["status_simulacao"], "ideal")

    def test_garantido_planejado_continua_ideal_mesmo_abaixo_de_oitenta_e_cinco(self):
        payload = self._payload_base()
        payload["entrada"] = Decimal("12000")
        payload["financiamento_caixa"] = Decimal("228000")

        resultado = calcular_simulacao_comercial(self.cliente_base, self.complementos_base, self.imovel_base, payload)
        resumo = resultado["resumo_operacao"]

        self.assertEqual(resumo["percentual_fechamento_inicial"], Decimal("0.8000"))
        self.assertEqual(resumo["classificacao_fechamento_inicial"], "ideal")
        self.assertEqual(resumo["status_simulacao"], "ideal")

    def test_projecao_entrega_em_atencao(self):
        cliente = dict(self.cliente_base)
        cliente["renda_principal"] = Decimal("6000")
        cliente["renda_total"] = Decimal("6000")
        imovel = dict(self.imovel_base)
        imovel["meses_pre_entrega"] = 20

        payload = self._payload_base()
        payload["entrada"] = Decimal("15000")
        payload["financiamento_caixa"] = Decimal("240000")
        payload["meses_pre_entrega"] = 12
        payload["meses_pos_entrega"] = 24

        resultado = calcular_simulacao_comercial(cliente, [], imovel, payload)
        resumo = resultado["resumo_operacao"]

        self.assertEqual(resumo["percentual_projetado_entrega"], Decimal("0.9820"))
        self.assertEqual(resumo["classificacao_projecao_entrega"], "ideal")
        self.assertEqual(resumo["status_simulacao"], "atenção")
        self.assertGreater(
            resumo["parcela_7lm_pos_ideal"],
            resumo["capacidade_pos_obra_7lm"],
        )

    def test_complemento_inativo_nao_entra_na_renda(self):
        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            self.imovel_base,
            self._payload_base(),
        )
        cliente = resultado["cliente"]

        self.assertEqual(cliente["renda_principal"], Decimal("5000.00"))
        self.assertEqual(cliente["renda_complementar"], Decimal("2000.00"))
        self.assertEqual(cliente["renda_total"], Decimal("7000.00"))

    def test_valor_imovel_e_automatico_da_base(self):
        payload = self._payload_base()
        payload["valor_imovel"] = Decimal("999999.00")

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            self.imovel_base,
            payload,
        )
        resumo = resultado["resumo_operacao"]

        self.assertEqual(resumo["valor_imovel"], Decimal("300000.00"))

    def test_desconto_imovel_reduz_operacao_com_teto_de_cinquenta_mil(self):
        payload = self._payload_base()
        payload["desconto_imovel"] = Decimal("70000")

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            self.imovel_base,
            payload,
        )
        resumo = resultado["resumo_operacao"]

        self.assertEqual(resumo["valor_imovel"], Decimal("300000.00"))
        self.assertEqual(resumo["desconto_imovel"], Decimal("50000.00"))
        self.assertEqual(resumo["valor_total_operacao"], Decimal("250000.00"))
        self.assertEqual(resumo["pro_soluto_total"], Decimal("0.00"))
        self.assertTrue(any("teto de R$ 50.000,00" in item for item in resumo["atenções"]))

    def test_desconto_imovel_reduz_pro_soluto_e_preserva_valor_cadastrado(self):
        imovel = {**self.imovel_base, "valor": Decimal("275000")}
        payload = {
            **self._payload_base(),
            "entrada": Decimal("0"),
            "financiamento_caixa": Decimal("145954.56"),
            "parcela_financiamento_banco": Decimal("764.99"),
            "fgts": Decimal("23860"),
            "subsidio": Decimal("19010"),
            "desconto_imovel": Decimal("25000"),
            "meses_pre_entrega": 20,
            "meses_pos_entrega": 60,
        }

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            imovel,
            payload,
        )
        resumo = resultado["resumo_operacao"]

        self.assertEqual(resumo["valor_imovel"], Decimal("275000.00"))
        self.assertEqual(resumo["desconto_imovel"], Decimal("25000.00"))
        self.assertEqual(resumo["valor_total_operacao"], Decimal("250000.00"))
        self.assertEqual(resumo["pro_soluto_total"], Decimal("61175.44"))

    def test_desconto_imovel_nao_reduz_base_de_enquadramento_da_unidade(self):
        imovel = {
            **self.imovel_base,
            "valor": Decimal("200000"),
            "valor_garantido": Decimal("160000"),
            "valor_garantido_pre_obra_planejado": Decimal("184000"),
        }
        payload = {
            **self._payload_base(),
            "entrada": Decimal("100000"),
            "financiamento_caixa": Decimal("20000"),
            "parcela_financiamento_banco": Decimal("0"),
            "desconto_imovel": Decimal("50000"),
        }

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            imovel,
            payload,
        )
        resumo = resultado["resumo_operacao"]

        self.assertEqual(resultado["imovel"]["valor"], Decimal("200000.00"))
        self.assertEqual(resultado["imovel"]["valor_original"], Decimal("200000.00"))
        self.assertEqual(resultado["imovel"]["valor_negociado"], Decimal("150000.00"))
        self.assertEqual(resumo["valor_imovel"], Decimal("200000.00"))
        self.assertEqual(resumo["desconto_imovel"], Decimal("50000.00"))
        self.assertEqual(resumo["valor_total_operacao"], Decimal("150000.00"))
        self.assertEqual(resumo["valor_base_gatilhos"], Decimal("200000.00"))
        self.assertEqual(resumo["valor_garantido_planejado"], Decimal("160000.00"))
        self.assertEqual(resumo["valor_garantido_pre_obra_planejado"], Decimal("184000.00"))
        self.assertTrue(resultado["aprovacao_excecao"]["desconto_requer_aprovacao"])

    def test_sugestao_expoe_valor_negociado_com_desconto_sem_alterar_valor_cadastrado(self):
        imovel = {
            **self.imovel_base,
            "identificador_imovel": "imovel-200-desconto",
            "valor": Decimal("200000"),
        }
        payload = {
            **self._payload_base(),
            "entrada": Decimal("30000"),
            "financiamento_caixa": Decimal("100000"),
            "parcela_financiamento_banco": Decimal("700"),
            "desconto_imovel": Decimal("50000"),
        }

        sugestao = sugerir_imoveis_inteligentes(
            self.cliente_base,
            self.complementos_base,
            [imovel],
            payload,
            limite=5,
        )

        item = sugestao["melhor_match"]
        self.assertEqual(item["imovel"]["valor"], Decimal("200000.00"))
        self.assertEqual(item["imovel"]["valor_original"], Decimal("200000.00"))
        self.assertEqual(item["imovel"]["valor_negociado"], Decimal("150000.00"))
        self.assertEqual(item["resumo_operacao"]["valor_total_operacao"], Decimal("150000.00"))
        self.assertEqual(item["resumo_operacao"]["desconto_imovel"], Decimal("50000.00"))

    def test_desconto_ate_dez_mil_nao_exige_aprovacao_por_desconto(self):
        payload = self._payload_base()
        payload["desconto_imovel"] = Decimal("10000")

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            self.imovel_base,
            payload,
        )
        aprovacao = resultado["aprovacao_excecao"]

        self.assertFalse(aprovacao["desconto_requer_aprovacao"])
        self.assertNotIn("desconto_comercial", aprovacao["gatilhos_pendentes"])

    def test_desconto_acima_de_dez_mil_exige_aprovacao_do_gestor(self):
        payload = self._payload_base()
        payload["desconto_imovel"] = Decimal("10001")

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            self.imovel_base,
            payload,
        )
        aprovacao = resultado["aprovacao_excecao"]

        self.assertTrue(aprovacao["desconto_requer_aprovacao"])
        self.assertIn("desconto_comercial", aprovacao["gatilhos_pendentes"])

    def test_sem_financiamento_informado_nao_assume_setenta_por_cento(self):
        payload = self._payload_base()
        payload.pop("financiamento_caixa", None)

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            self.imovel_base,
            payload,
        )
        resumo = resultado["resumo_operacao"]

        self.assertEqual(resumo["financiamento_caixa"], Decimal("0.00"))
        self.assertEqual(resumo["parcela_financiamento_banco"], Decimal("1440.00"))
        self.assertEqual(resumo["valor_fechamento_inicial"], Decimal("30000.00"))
        self.assertEqual(resumo["status_simulacao"], "inválida")

    def test_entrada_zero_informada_nao_assume_entrada_padrao_e_gap_cai_com_entrada_maior(self):
        imovel = dict(self.imovel_base)
        imovel["valor"] = Decimal("240000")
        imovel["valor_garantido"] = Decimal("192000")

        payload = self._payload_base()
        payload.update({
            "financiamento_caixa": Decimal("87663"),
            "parcela_financiamento_banco": Decimal("507"),
            "fgts": Decimal("8102"),
            "subsidio": Decimal("55000"),
            "cheque_moradia": Decimal("45000"),
            "meses_pre_entrega": 20,
            "meses_pos_entrega": 58,
            "parcela_pre_obra_valor": Decimal("253.05"),
            "parcela_pos_obra_valor": Decimal("253.05"),
            "usar_entrada_padrao": False,
        })

        payload_zero = dict(payload)
        payload_zero["entrada"] = Decimal("0")
        resumo_zero = calcular_simulacao_comercial(
            self.cliente_base,
            [],
            imovel,
            payload_zero,
        )["resumo_operacao"]

        payload_dez_mil = dict(payload)
        payload_dez_mil["entrada"] = Decimal("10000")
        resumo_dez_mil = calcular_simulacao_comercial(
            self.cliente_base,
            [],
            imovel,
            payload_dez_mil,
        )["resumo_operacao"]

        gap_zero = resumo_zero["valor_garantido_planejado"] - resumo_zero["valor_garantido_real"]
        gap_dez_mil = resumo_dez_mil["valor_garantido_planejado"] - resumo_dez_mil["valor_garantido_real"]

        self.assertEqual(resumo_zero["entrada"], Decimal("0.00"))
        self.assertEqual(resumo_zero["valor_garantido_real"], Decimal("150765.00"))
        self.assertEqual(gap_zero, Decimal("41235.00"))
        self.assertEqual(resumo_dez_mil["valor_garantido_real"], Decimal("160765.00"))
        self.assertEqual(gap_dez_mil, Decimal("31235.00"))
        self.assertLess(gap_dez_mil, gap_zero)

    def test_data_recorrente_hoje_conta_todas_anuais_e_semestrais_no_pre_obra(self):
        imovel = dict(self.imovel_base)
        imovel["valor"] = Decimal("240000")
        imovel["valor_garantido"] = Decimal("192000")

        payload = self._payload_base()
        payload.update({
            "entrada": Decimal("3000"),
            "financiamento_caixa": Decimal("145954.56"),
            "parcela_financiamento_banco": Decimal("764.99"),
            "fgts": Decimal("23860"),
            "subsidio": Decimal("19010"),
            "cheque_moradia": Decimal("1000"),
            "meses_pre_entrega": 20,
            "meses_pos_entrega": 20,
            "parcela_pre_obra_valor": Decimal("200"),
            "parcela_pos_obra_valor": Decimal("200"),
            "parcela_anual_valor": Decimal("7500"),
            "parcelas_anuais_quantidade": 2,
            "parcela_anual_primeira_data": date.today().isoformat(),
            "parcela_semestral_valor": Decimal("5000"),
            "parcelas_semestrais_quantidade": 2,
            "parcela_semestral_primeira_data": date.today().isoformat(),
            "usar_entrada_padrao": False,
        })

        resultado = calcular_simulacao_comercial(self.cliente_base, self.complementos_base, imovel, payload)
        resumo = resultado["resumo_operacao"]
        componentes = resultado["componentes_pre_entrega"]
        demonstrativo = resultado["demonstrativo"]

        self.assertEqual(componentes["total_anuais"], Decimal("15000.00"))
        self.assertEqual(componentes["total_semestrais"], Decimal("10000.00"))
        self.assertEqual(componentes["total_extras_pre"], Decimal("25000.00"))
        self.assertEqual(len([item for item in demonstrativo if item["tipo"] == "anual"]), 2)
        self.assertEqual(len([item for item in demonstrativo if item["tipo"] == "semestral"]), 2)
        self.assertEqual(resumo["valor_garantido_real"], Decimal("191824.56"))
        self.assertEqual(resumo["valor_garantido_planejado"] - resumo["valor_garantido_real"], Decimal("175.44"))
        self.assertEqual(resumo["status_comercial"], "inválida")

    def test_recorrencias_abatam_faltante_integralmente_ate_data_de_entrega(self):
        cliente = dict(self.cliente_base)
        cliente["renda_principal"] = Decimal("2550")
        cliente["renda_total"] = Decimal("2550")

        imovel = dict(self.imovel_base)
        imovel["valor"] = Decimal("240000")
        imovel["valor_garantido"] = Decimal("192000")
        imovel["valor_garantido_pre_obra_planejado"] = Decimal("211385")
        imovel["data_entrega"] = "2027-12-15"

        payload_base = self._payload_base()
        payload_base.update({
            "entrada": Decimal("4000"),
            "financiamento_caixa": Decimal("145954.56"),
            "parcela_financiamento_banco": Decimal("764.99"),
            "fgts": Decimal("23860"),
            "subsidio": Decimal("19010"),
            "cheque_moradia": Decimal("0"),
            "meses_pos_entrega": 33,
            "parcela_pre_obra_valor": Decimal("382.51"),
            "parcela_pos_obra_valor": Decimal("382.51"),
            "usar_entrada_padrao": False,
        })

        sem_reforcos = calcular_simulacao_comercial(cliente, [], imovel, payload_base)
        payload_reforcos = dict(payload_base)
        payload_reforcos.update({
            "parcela_anual_valor": Decimal("5000"),
            "parcelas_anuais_quantidade": 2,
            "parcela_anual_primeira_data": (date.today() + timedelta(days=1)).isoformat(),
            "parcela_semestral_valor": Decimal("2000"),
            "parcelas_semestrais_quantidade": 2,
            "parcela_semestral_primeira_data": _add_months(date.today(), 6).isoformat(),
        })
        com_reforcos = calcular_simulacao_comercial(cliente, [], imovel, payload_reforcos)

        gap_sem_reforcos = (
            sem_reforcos["resumo_operacao"]["valor_garantido_pre_obra_planejado"]
            - sem_reforcos["resumo_operacao"]["valor_garantido_pre_obra_real"]
        )
        gap_com_reforcos = (
            com_reforcos["resumo_operacao"]["valor_garantido_pre_obra_planejado"]
            - com_reforcos["resumo_operacao"]["valor_garantido_pre_obra_real"]
        )
        componentes = com_reforcos["componentes_pre_entrega"]

        self.assertEqual(componentes["total_anuais"], Decimal("10000.00"))
        self.assertEqual(componentes["total_semestrais"], Decimal("4000.00"))
        self.assertEqual(componentes["total_extras_pre"], Decimal("14000.00"))
        self.assertEqual(gap_sem_reforcos - gap_com_reforcos, Decimal("14000.00"))

    def test_recorrencia_depois_da_entrega_nao_entra_no_pre_chaves(self):
        cliente = dict(self.cliente_base)
        cliente["renda_principal"] = Decimal("2550")
        cliente["renda_total"] = Decimal("2550")

        imovel = dict(self.imovel_base)
        imovel["valor"] = Decimal("240000")
        imovel["valor_garantido"] = Decimal("192000")
        imovel["data_entrega"] = "2027-12-15"

        payload = self._payload_base()
        payload.update({
            "entrada": Decimal("4000"),
            "financiamento_caixa": Decimal("145954.56"),
            "parcela_financiamento_banco": Decimal("764.99"),
            "fgts": Decimal("23860"),
            "subsidio": Decimal("19010"),
            "cheque_moradia": Decimal("0"),
            "parcela_anual_valor": Decimal("5000"),
            "parcelas_anuais_quantidade": 3,
            "parcela_anual_primeira_data": (date.today() + timedelta(days=1)).isoformat(),
            "parcela_semestral_valor": Decimal("2000"),
            "parcelas_semestrais_quantidade": 4,
            "parcela_semestral_primeira_data": _add_months(date.today(), 6).isoformat(),
            "usar_entrada_padrao": False,
        })

        resultado = calcular_simulacao_comercial(cliente, [], imovel, payload)
        demonstrativo = resultado["demonstrativo"]

        self.assertEqual(resultado["componentes_pre_entrega"]["total_anuais"], Decimal("10000.00"))
        self.assertEqual(resultado["componentes_pre_entrega"]["total_semestrais"], Decimal("6000.00"))
        self.assertEqual(len([item for item in demonstrativo if item["tipo"] == "anual"]), 2)
        self.assertEqual(len([item for item in demonstrativo if item["tipo"] == "semestral"]), 3)
        self.assertTrue(
            all(
                item["vencimento"] <= date(2027, 12, 15)
                for item in demonstrativo
                if item["tipo"] in {"anual", "semestral"}
            )
        )

    def test_sugestoes_respeitam_recorrencias_pre_chaves_do_payload(self):
        cliente = dict(self.cliente_base)
        cliente["renda_principal"] = Decimal("2550")
        cliente["renda_total"] = Decimal("2550")

        imovel = dict(self.imovel_base)
        imovel.update({
            "titulo": "Apartamento 3 - Bloco 24",
            "valor": Decimal("240000"),
            "valor_garantido": Decimal("192000"),
            "valor_garantido_planejado": Decimal("192000"),
            "valor_garantido_pre_obra_planejado": Decimal("220800"),
            "percentual_fechamento_minimo": Decimal("0.8"),
            "percentual_captacao_ate_entrega": Decimal("0.92"),
            "data_entrega": "2028-02-20",
            "meses_pre_entrega": 22,
            "meses_pos_entrega": 1,
            "meses_pos_entrega_configurado": 1,
        })

        payload = self._payload_base()
        payload.update({
            "entrada": Decimal("2900"),
            "financiamento_caixa": Decimal("145954.56"),
            "parcela_financiamento_banco": Decimal("764.99"),
            "fgts": Decimal("23860"),
            "subsidio": Decimal("19010"),
            "cheque_moradia": Decimal("0"),
            "meses_pre_entrega": 20,
            "meses_pos_entrega": 1,
            "parcela_pre_obra_valor": Decimal("382.51"),
            "parcela_pos_obra_valor": Decimal("382.51"),
            "parcela_anual_valor": Decimal("5000"),
            "parcelas_anuais_quantidade": 2,
            "parcela_anual_primeira_data": "2026-04-30",
            "parcela_semestral_valor": Decimal("5000"),
            "parcelas_semestrais_quantidade": 3,
            "parcela_semestral_primeira_data": "2026-10-25",
            "usar_entrada_padrao": False,
        })

        calculo = calcular_simulacao_comercial(cliente, [], imovel, payload)
        sugestao = sugerir_imoveis_inteligentes(cliente, [], [imovel], payload, limite=5)
        item = sugestao["items"][0]
        gap_pre_calculo = max(
            calculo["resumo_operacao"]["valor_garantido_pre_obra_planejado"]
            - calculo["resumo_operacao"]["valor_garantido_pre_obra_real"],
            Decimal("0"),
        )

        self.assertEqual(item["analise_comercial"]["gap_garantia"], Decimal("275.44"))
        self.assertEqual(item["analise_comercial"]["gap_pre_obra"], gap_pre_calculo)
        self.assertEqual(item["analise_comercial"]["gap_pre_obra"], Decimal("1042.73"))

    def test_pro_soluto_fecha_composicao(self):
        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            self.imovel_base,
            self._payload_base(),
        )
        resumo = resultado["resumo_operacao"]

        composicao = (
            resumo["financiamento_caixa"]
            + resumo["fgts"]
            + resumo["subsidio"]
            + resumo["cheque_moradia"]
            + resumo["entrada"]
            + resumo["pro_soluto_total"]
        )
        self.assertEqual(composicao, resumo["valor_total_operacao"])

    def test_cheque_moradia_nao_reduz_pro_soluto(self):
        resultado_base = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            self.imovel_base,
            self._payload_base(),
        )
        payload = self._payload_base()
        payload["cheque_moradia"] = Decimal("5000")

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            self.imovel_base,
            payload,
        )
        resumo = resultado["resumo_operacao"]
        resumo_base = resultado_base["resumo_operacao"]

        self.assertEqual(resumo["cheque_moradia"], Decimal("5000.00"))
        self.assertEqual(resumo["valor_fechamento_inicial"], Decimal("270000.00"))
        self.assertEqual(resumo["percentual_fechamento_inicial"], Decimal("0.9000"))
        self.assertEqual(resumo["pro_soluto_total"], resumo_base["pro_soluto_total"])
        self.assertEqual(resumo["valor_projetado_entrega"], resumo_base["valor_projetado_entrega"])

    def test_recalcula_fluxo_para_quitacao_rapida(self):
        cliente = dict(self.cliente_base)
        cliente["renda_principal"] = Decimal("5000")
        cliente["renda_total"] = Decimal("5000")
        imovel = dict(self.imovel_base)
        imovel["valor"] = Decimal("190000")
        imovel["meses_pre_entrega"] = 20
        imovel["meses_pos_entrega"] = 24

        payload = self._payload_base()
        payload["entrada"] = Decimal("25000")
        payload["financiamento_caixa"] = Decimal("87663")
        payload["parcela_financiamento_banco"] = Decimal("507")
        payload["fgts"] = Decimal("8102")
        payload["subsidio"] = Decimal("45000")
        payload["meses_pre_entrega"] = 20
        payload["meses_pos_entrega"] = 36

        resultado = calcular_simulacao_comercial(cliente, [], imovel, payload)
        resumo = resultado["resumo_operacao"]
        componentes = resultado["componentes_pre_entrega"]
        parcelas_pos = [item for item in resultado["demonstrativo"] if item["fase"] == "pos_entrega"]

        self.assertEqual(resumo["pro_soluto_total"], Decimal("24235.00"))
        self.assertEqual(resumo["meses_pos_entrega"], 2)
        self.assertEqual(resumo["meses_pos_entrega_configurado"], 36)
        self.assertEqual(len(parcelas_pos), 2)
        self.assertGreater(componentes["pro_soluto_pos"], Decimal("0"))
        self.assertEqual(resumo["parcela_7lm_pos"], Decimal("1101.59"))

    def test_trava_meses_pos_no_menor_prazo_seguro(self):
        cliente = dict(self.cliente_base)
        cliente["renda_principal"] = Decimal("5000")
        cliente["renda_total"] = Decimal("5000")
        imovel = dict(self.imovel_base)
        imovel["valor"] = Decimal("190000")
        imovel["meses_pre_entrega"] = 20
        imovel["meses_pos_entrega"] = 24

        payload = self._payload_base()
        payload["entrada"] = Decimal("25000")
        payload["financiamento_caixa"] = Decimal("87663")
        payload["parcela_financiamento_banco"] = Decimal("507")
        payload["fgts"] = Decimal("8102")
        payload["subsidio"] = Decimal("45000")
        payload["meses_pre_entrega"] = 20
        payload["meses_pos_entrega"] = 60

        resultado = calcular_simulacao_comercial(cliente, [], imovel, payload)
        resumo = resultado["resumo_operacao"]
        parcelas_pos = [item for item in resultado["demonstrativo"] if item["fase"] == "pos_entrega"]
        texto_atenções = " ".join(resumo["atenções"]).lower()

        self.assertEqual(resumo["meses_pos_entrega_configurado"], 60)
        self.assertEqual(resumo["meses_pos_entrega"], 2)
        self.assertEqual(len(parcelas_pos), 2)
        self.assertEqual(resumo["parcela_7lm_pos"], Decimal("1101.59"))
        self.assertIn("travados em 2", texto_atenções)

    def test_demonstrativo_tem_fase_pre_e_pos(self):
        imovel = dict(self.imovel_base)
        imovel["meses_pre_entrega"] = 12
        payload = self._payload_base()
        payload["entrada"] = Decimal("15000")
        payload["financiamento_caixa"] = Decimal("240000")
        payload["meses_pre_entrega"] = 12
        payload["meses_pos_entrega"] = 24

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            imovel,
            payload,
        )
        fases = {item["fase"] for item in resultado["demonstrativo"]}

        self.assertIn("pre_entrega", fases)
        self.assertIn("pos_entrega", fases)

    def test_limita_meses_pos_pelo_total_maximo(self):
        payload = self._payload_base()
        payload["meses_pos_entrega"] = 80

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            self.imovel_base,
            payload,
        )
        resumo = resultado["resumo_operacao"]
        limite_esperado = max(80 - calcular_meses_ate_entrega_dinamica(), 0)
        texto_atenções = " ".join(resumo["atenções"]).lower()

        self.assertEqual(resumo["meses_pos_entrega_configurado"], limite_esperado)
        self.assertIn("pre + pos não pode passar de 80", texto_atenções)

    def test_limita_meses_pos_apenas_pelo_total_maximo(self):
        meses_pre, meses_pos, limite_meses_pos, meses_pos_solicitado = _normalizar_prazos_simulacao(
            1,
            80,
        )

        self.assertEqual(meses_pre, 1)
        self.assertEqual(meses_pos_solicitado, 80)
        self.assertEqual(limite_meses_pos, 79)
        self.assertEqual(meses_pos, 79)

    def test_padrao_meses_pos_fechando_pre_e_pos_ate_80(self):
        meses_pre, meses_pos, limite_meses_pos, meses_pos_solicitado = _normalizar_prazos_simulacao(
            20,
            None,
        )

        self.assertEqual(meses_pre, 20)
        self.assertEqual(limite_meses_pos, 60)
        self.assertEqual(meses_pos_solicitado, 60)
        self.assertEqual(meses_pos, 60)

    def test_padrao_meses_pos_sobe_para_61_quando_pre_cai_para_19(self):
        meses_pre, meses_pos, limite_meses_pos, meses_pos_solicitado = _normalizar_prazos_simulacao(
            19,
            None,
        )

        self.assertEqual(meses_pre, 19)
        self.assertEqual(limite_meses_pos, 61)
        self.assertEqual(meses_pos_solicitado, 61)
        self.assertEqual(meses_pos, 61)

    def test_prazo_total_com_pre_36_reduz_pos_para_44(self):
        meses_pre, meses_pos, limite_meses_pos, meses_pos_solicitado = _normalizar_prazos_simulacao(
            36,
            60,
        )

        self.assertEqual(meses_pre, 36)
        self.assertEqual(limite_meses_pos, 44)
        self.assertEqual(meses_pos_solicitado, 60)
        self.assertEqual(meses_pos, 44)
        self.assertLessEqual(meses_pre + meses_pos, 80)

    def test_creditur_permite_pre_sessenta_e_pos_quarenta(self):
        meses_pre, meses_pos, limite_meses_pos, meses_pos_solicitado = _normalizar_prazos_simulacao(
            80,
            80,
            "creditur",
        )

        self.assertEqual(meses_pre, 60)
        self.assertEqual(limite_meses_pos, 40)
        self.assertEqual(meses_pos_solicitado, 80)
        self.assertEqual(meses_pos, 40)
        self.assertLessEqual(meses_pre + meses_pos, 100)

    def test_creditur_respeita_prazo_do_payload_e_curva_semestral(self):
        imovel = dict(self.imovel_base)
        imovel["valor"] = Decimal("220000")
        imovel["meses_pre_entrega"] = 20
        payload = self._payload_base()
        payload.update({
            "parceiro_simulacao": "creditur",
            "entrada": Decimal("20000"),
            "financiamento_caixa": Decimal("140000"),
            "parcela_financiamento_banco": Decimal("800"),
            "meses_pre_entrega": 60,
            "meses_pos_entrega": 40,
            "parcelas_creditur_semestrais": [
                {"semestre": 1, "valor": Decimal("120")},
                {"semestre": 11, "valor": Decimal("300")},
            ],
        })

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            imovel,
            payload,
        )
        resumo = resultado["resumo_operacao"]
        parcelas_creditur = [
            item for item in resultado["demonstrativo"]
            if item["tipo"] == "mensal_pos_creditur"
        ]

        self.assertTrue(resumo["creditur_ativo"])
        self.assertEqual(resumo["meses_pre_entrega"], 60)
        self.assertEqual(resumo["meses_pos_entrega_configurado"], 40)
        self.assertTrue(parcelas_creditur)
        self.assertTrue(all(item["valor_7lm"] >= Decimal("120.00") for item in parcelas_creditur[:-1]))

    def test_meses_pre_entrega_tambem_e_limitado_a_80(self):
        meses_pre, meses_pos, limite_meses_pos, meses_pos_solicitado = _normalizar_prazos_simulacao(
            90,
            10,
        )

        self.assertEqual(meses_pre, 80)
        self.assertEqual(limite_meses_pos, 0)
        self.assertEqual(meses_pos_solicitado, 10)
        self.assertEqual(meses_pos, 0)
        self.assertLessEqual(meses_pre + meses_pos, 80)

    def test_ranking_prioriza_melhor_match(self):
        imovel_alternativo = dict(self.imovel_base)
        imovel_alternativo["identificador_imovel"] = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        imovel_alternativo["titulo"] = "Unidade 202"
        imovel_alternativo["valor"] = Decimal("420000")

        sugestao = sugerir_imoveis_inteligentes(
            self.cliente_base,
            self.complementos_base,
            [self.imovel_base, imovel_alternativo],
            self._payload_base(),
            limite=5,
        )

        self.assertIsNotNone(sugestao["melhor_match"])
        self.assertEqual(
            sugestao["melhor_match"]["imovel"]["id"],
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        )
        self.assertGreaterEqual(sugestao["melhor_match"]["score"], Decimal("0"))

    def test_sugestao_prioriza_imovel_mais_proximo_do_garantido_planejado(self):
        cliente = dict(self.cliente_base)
        cliente["renda_principal"] = Decimal("5000")
        cliente["renda_total"] = Decimal("5000")

        payload = {
            "entrada": Decimal("25000"),
            "financiamento_caixa": Decimal("145000"),
            "fgts": Decimal("12000"),
            "subsidio": Decimal("10000"),
            "cheque_moradia": Decimal("0"),
            "sobrepreco": Decimal("0"),
            "parcela_financiamento_banco": Decimal("870"),
            "meses_pre_entrega": 24,
            "meses_pos_entrega": 36,
            "parcela_intermediaria_valor": Decimal("0"),
            "parcelas_intermediarias_quantidade": 0,
            "parcela_anual_valor": Decimal("0"),
            "parcelas_anuais_quantidade": 0,
            "parcela_semestral_valor": Decimal("0"),
            "parcelas_semestrais_quantidade": 0,
            "parcela_reforco_valor": Decimal("0"),
            "parcelas_reforco_quantidade": 0,
        }

        imovel_190 = dict(self.imovel_base)
        imovel_190["identificador_imovel"] = "imovel-190"
        imovel_190["titulo"] = "Unidade 190"
        imovel_190["valor"] = Decimal("190000")
        imovel_190["meses_pre_entrega"] = 24

        imovel_205 = dict(self.imovel_base)
        imovel_205["identificador_imovel"] = "imovel-205"
        imovel_205["titulo"] = "Unidade 205"
        imovel_205["valor"] = Decimal("205000")
        imovel_205["meses_pre_entrega"] = 24

        imovel_208 = dict(self.imovel_base)
        imovel_208["identificador_imovel"] = "imovel-208"
        imovel_208["titulo"] = "Unidade 208"
        imovel_208["valor"] = Decimal("208000")
        imovel_208["meses_pre_entrega"] = 24

        sugestao = sugerir_imoveis_inteligentes(
            cliente,
            [],
            [imovel_190, imovel_205, imovel_208],
            payload,
            limite=5,
        )

        self.assertEqual(sugestao["melhor_match"]["imovel"]["id"], "imovel-208")
        self.assertTrue(sugestao["melhor_match"]["faixa_natural"])

        item_190 = next(item for item in sugestao["items"] if item["imovel"]["id"] == "imovel-190")
        self.assertTrue(item_190["faixa_natural"])
        self.assertGreater(
            item_190["analise_comercial"]["desvio_garantia"],
            sugestao["melhor_match"]["analise_comercial"]["desvio_garantia"],
        )

    def test_sugestao_prioriza_melhor_encaixe_total_sem_rebaixar_unidade_natural(self):
        cliente = dict(self.cliente_base)
        cliente["renda_principal"] = Decimal("2550")
        cliente["renda_total"] = Decimal("2550")

        payload = {
            "entrada": Decimal("0"),
            "financiamento_caixa": Decimal("145954.56"),
            "fgts": Decimal("23860"),
            "subsidio": Decimal("19010"),
            "cheque_moradia": Decimal("0"),
            "sobrepreco": Decimal("0"),
            "parcela_financiamento_banco": Decimal("764.99"),
            "meses_pre_entrega": 20,
            "meses_pos_entrega": 24,
            "parcela_pre_obra_valor": Decimal("280"),
            "parcela_pos_obra_valor": Decimal("280"),
            "parcela_intermediaria_valor": Decimal("1000"),
            "parcelas_intermediarias_quantidade": 5,
            "parcelas_intermediarias_datas": [
                "2026-07-27",
                "2026-11-27",
                "2027-02-27",
                "2027-05-27",
                "2027-09-27",
            ],
            "parcela_anual_valor": Decimal("2000"),
            "parcelas_anuais_quantidade": 1,
            "parcela_anual_primeira_data": "2027-04-27",
            "parcela_semestral_valor": Decimal("500"),
            "parcelas_semestrais_quantidade": 1,
            "parcela_semestral_primeira_data": "2026-10-27",
            "parcela_reforco_valor": Decimal("0"),
            "parcelas_reforco_quantidade": 0,
        }

        imovel_190 = dict(self.imovel_base)
        imovel_190["identificador_imovel"] = "imovel-190-sub"
        imovel_190["titulo"] = "Unidade 190"
        imovel_190["valor"] = Decimal("190000")
        imovel_190["meses_pre_entrega"] = 20
        imovel_190["data_entrega"] = "2028-02-20"
        imovel_190["valor_garantido"] = Decimal("188700")
        imovel_190["valor_garantido_pre_obra_planejado"] = Decimal("190000")

        imovel_210 = dict(self.imovel_base)
        imovel_210["identificador_imovel"] = "imovel-210-fit"
        imovel_210["titulo"] = "Unidade 210"
        imovel_210["valor"] = Decimal("210000")
        imovel_210["meses_pre_entrega"] = 20
        imovel_210["data_entrega"] = "2028-02-20"
        imovel_210["valor_garantido"] = Decimal("188000")
        imovel_210["valor_garantido_pre_obra_planejado"] = Decimal("202000")

        sugestao = sugerir_imoveis_inteligentes(
            cliente,
            [],
            [imovel_190, imovel_210],
            payload,
            limite=5,
        )

        melhor = sugestao["melhor_match"]
        item_190 = next(item for item in sugestao["items"] if item["imovel"]["id"] == "imovel-190-sub")
        item_210 = next(item for item in sugestao["items"] if item["imovel"]["id"] == "imovel-210-fit")

        self.assertEqual(melhor["imovel"]["id"], "imovel-210-fit")
        self.assertTrue(item_190["faixa_natural"])
        self.assertTrue(item_210["faixa_natural"])
        self.assertEqual(item_210["classificacao_sugestao"], "ideal")
        self.assertEqual(item_190["classificacao_sugestao"], "ideal")
        self.assertGreater(item_210["imovel"]["valor"], item_190["imovel"]["valor"])
        self.assertGreater(item_190["score"], item_210["score"])

    def test_sugestao_ajusta_entrada_para_levar_garantido_real_ao_planejado(self):
        cliente = dict(self.cliente_base)
        cliente["renda_principal"] = Decimal("9000")
        cliente["renda_total"] = Decimal("9000")

        payload = {
            "entrada": Decimal("20000"),
            "financiamento_caixa": Decimal("145000"),
            "fgts": Decimal("0"),
            "subsidio": Decimal("0"),
            "cheque_moradia": Decimal("0"),
            "sobrepreco": Decimal("0"),
            "parcela_financiamento_banco": Decimal("870"),
            "meses_pre_entrega": 24,
            "meses_pos_entrega": 36,
            "parcela_intermediaria_valor": Decimal("0"),
            "parcelas_intermediarias_quantidade": 0,
            "parcela_anual_valor": Decimal("0"),
            "parcelas_anuais_quantidade": 0,
            "parcela_semestral_valor": Decimal("0"),
            "parcelas_semestrais_quantidade": 0,
            "parcela_reforco_valor": Decimal("0"),
            "parcelas_reforco_quantidade": 0,
        }

        imovel = dict(self.imovel_base)
        imovel["identificador_imovel"] = "imovel-210"
        imovel["titulo"] = "Unidade 210"
        imovel["valor"] = Decimal("210000")
        imovel["meses_pre_entrega"] = 24
        imovel["valor_garantido"] = Decimal("190000")

        sugestao = sugerir_imoveis_inteligentes(
            cliente,
            [],
            [imovel],
            payload,
            limite=5,
        )

        item = sugestao["melhor_match"]
        ajuste = item["ajuste_entrada"]

        self.assertFalse(item["faixa_natural"])
        self.assertIsNotNone(ajuste)
        self.assertEqual(ajuste["entrada_sugerida"], Decimal("45000.00"))
        self.assertEqual(ajuste["fechamento_inicial_ajustado"], Decimal("0.9048"))
        self.assertEqual(ajuste["valor_garantido_real_ajustado"], Decimal("190000.00"))
        self.assertEqual(ajuste["status_apos_ajuste"], "ideal")

    def test_reordena_ideais_do_maior_valor_para_o_menor(self):
        sugestões = [
            {
                "classificacao_sugestao": "ideal",
                "imovel": {"id": "ideal-190", "valor": Decimal("190000")},
            },
            {
                "classificacao_sugestao": "compativel",
                "imovel": {"id": "compativel-215", "valor": Decimal("215000")},
            },
            {
                "classificacao_sugestao": "ideal",
                "imovel": {"id": "ideal-210", "valor": Decimal("210000")},
            },
            {
                "classificacao_sugestao": "atenção",
                "imovel": {"id": "atencao-220", "valor": Decimal("220000")},
            },
        ]

        ordenadas = _reordenar_sugestoes_para_exibicao(sugestões)
        ids = [item["imovel"]["id"] for item in ordenadas]

        self.assertEqual(ids[:2], ["ideal-210", "ideal-190"])
        self.assertEqual(ids[2:], ["compativel-215", "atencao-220"])

    def test_parcela_cliente_maxima_fica_separada_da_parcela_do_banco(self):
        payload = self._payload_base()
        payload["parcela_cliente_maxima"] = Decimal("900")
        payload["parcela_financiamento_banco"] = Decimal("300")

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            self.imovel_base,
            payload,
        )
        resumo = resultado["resumo_operacao"]

        self.assertEqual(resumo["parcela_cliente_maxima"], Decimal("900.00"))
        self.assertEqual(resumo["limite_comprometimento"], Decimal("900.00"))
        self.assertEqual(resumo["parcela_financiamento_banco"], Decimal("300.00"))
        self.assertEqual(resumo["capacidade_pos_obra_7lm"], Decimal("600.00"))

    def test_pos_obra_respeita_parcela_manual_mesmo_sem_quitar_no_prazo(self):
        cliente = dict(self.cliente_base)
        cliente["renda_principal"] = Decimal("2550")
        cliente["renda_total"] = Decimal("2550")
        imovel = dict(self.imovel_base)
        imovel["valor"] = Decimal("240000")
        imovel["meses_pre_entrega"] = 20
        imovel["percentual_conclusao_obra"] = Decimal("0")

        payload = self._payload_base()
        payload.update({
            "entrada": Decimal("25000"),
            "financiamento_caixa": Decimal("145954.56"),
            "parcela_cliente_maxima": Decimal("1147.50"),
            "parcela_financiamento_banco": Decimal("764.99"),
            "fgts": Decimal("23860"),
            "subsidio": Decimal("19010"),
            "cheque_moradia": Decimal("0"),
            "meses_pre_entrega": 20,
            "meses_pos_entrega": 60,
            "parcela_pre_obra_valor": Decimal("1"),
            "parcela_pos_obra_valor": Decimal("382.51"),
            "usar_entrada_padrao": False,
        })

        resultado = calcular_simulacao_comercial(cliente, [], imovel, payload)
        resumo = resultado["resumo_operacao"]
        parcelas_pos = [item for item in resultado["demonstrativo"] if item["fase"] == "pos_entrega"]

        self.assertEqual(resumo["capacidade_pos_obra_7lm"], Decimal("382.51"))
        self.assertEqual(resumo["parcela_7lm_pos"], Decimal("382.51"))
        self.assertEqual(resumo["meses_pos_entrega"], 60)
        self.assertGreater(resumo["saldo_pos_nao_quitado_no_prazo"], Decimal("0"))
        self.assertTrue(parcelas_pos)
        self.assertTrue(all(item["valor_7lm"] <= Decimal("382.51") for item in parcelas_pos))
        self.assertTrue(all(item["valor_total_cliente"] <= Decimal("1147.50") for item in parcelas_pos))

    def test_schema_da_rota_preserva_parcelas_manuais_antes_do_calculo(self):
        payload = self._payload_base()
        payload.update({
            "cliente_id": "11111111-1111-1111-1111-111111111111",
            "imovel_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "parcela_pre_obra_valor": Decimal("1147.50"),
            "parcela_pos_obra_valor": Decimal("382.51"),
        })

        dados_payload = RequisicaoCalcularSimulacao(**payload).model_dump()

        self.assertEqual(dados_payload["parcela_pre_obra_valor"], Decimal("1147.50"))
        self.assertEqual(dados_payload["parcela_pos_obra_valor"], Decimal("382.51"))

    def test_parcela_minima_do_cliente_agora_e_cento_e_vinte(self):
        self.assertEqual(_parcela_cliente_minima(Decimal("1000")), Decimal("120.00"))

    def test_pre_obra_usa_parcela_banco_proporcional_a_evolucao_da_obra(self):
        imovel = dict(self.imovel_base)
        imovel["valor"] = Decimal("195")
        imovel["percentual_conclusao_obra"] = Decimal("0")
        imovel["meses_pre_entrega"] = 3

        payload = self._payload_base()
        payload.update({
            "entrada": Decimal("0"),
            "financiamento_caixa": Decimal("0"),
            "parcela_cliente_maxima": Decimal("100"),
            "parcela_financiamento_banco": Decimal("70"),
            "meses_pre_entrega": 3,
            "meses_pos_entrega": 0,
            "parcela_pre_obra_valor": Decimal("100"),
            "usar_entrada_padrao": False,
        })

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            [],
            imovel,
            payload,
        )
        resumo = resultado["resumo_operacao"]
        mensais_pre = [item for item in resultado["demonstrativo"] if item["tipo"] == "mensal_pre"]

        self.assertEqual(resumo["capacidade_pre_obra_7lm_atual"], Decimal("120.00"))
        self.assertEqual(resumo["capacidade_pos_obra_7lm"], Decimal("50.00"))
        self.assertEqual(mensais_pre[0]["parcela_banco_obra"], Decimal("0.00"))
        self.assertEqual(mensais_pre[0]["valor_7lm"], Decimal("100.00"))
        self.assertEqual(mensais_pre[0]["valor_total_cliente"], Decimal("100.00"))
        self.assertEqual(mensais_pre[-1]["parcela_banco_obra"], Decimal("70.00"))
        self.assertEqual(mensais_pre[-1]["valor_7lm"], Decimal("10.00"))
        self.assertEqual(mensais_pre[-1]["valor_total_cliente"], Decimal("80.00"))

    def test_garantido_batido_vira_encaixe_comercial_com_reforco_pre_obra(self):
        cliente = dict(self.cliente_base)
        cliente["renda_principal"] = Decimal("1689")
        cliente["renda_total"] = Decimal("1689")

        imovel = dict(self.imovel_base)
        imovel["identificador_imovel"] = "imovel-190"
        imovel["titulo"] = "Apartamento 401 - Bloco 1"
        imovel["valor"] = Decimal("190000")
        imovel["valor_garantido"] = Decimal("152000")
        imovel["valor_garantido_pre_obra_planejado"] = Decimal("174800")
        imovel["data_entrega"] = "2028-02-20"

        payload = {
            "entrada": Decimal("2000"),
            "financiamento_caixa": Decimal("87663"),
            "parcela_cliente_maxima": Decimal("760.05"),
            "parcela_financiamento_banco": Decimal("0"),
            "fgts": Decimal("8102"),
            "subsidio": Decimal("55000"),
            "cheque_moradia": Decimal("0"),
            "sobrepreco": Decimal("0"),
            "meses_pre_entrega": 22,
            "meses_pos_entrega": 24,
            "parcela_intermediaria_valor": Decimal("0"),
            "parcelas_intermediarias_quantidade": 0,
            "parcela_anual_valor": Decimal("0"),
            "parcelas_anuais_quantidade": 0,
            "parcela_semestral_valor": Decimal("0"),
            "parcelas_semestrais_quantidade": 0,
            "parcela_reforco_valor": Decimal("0"),
            "parcelas_reforco_quantidade": 0,
        }

        resultado = calcular_simulacao_comercial(cliente, [], imovel, payload)
        resumo = resultado["resumo_operacao"]
        sugestao = sugerir_imoveis_inteligentes(cliente, [], [imovel], payload, limite=5)
        item = sugestao["melhor_match"]

        self.assertEqual(resumo["valor_garantido_real"], Decimal("152765.00"))
        self.assertEqual(resumo["status_simulacao"], "inválida")
        self.assertEqual(resumo["status_comercial"], "atenção")
        self.assertIsNotNone(resumo["sugestao_reforco_pre_obra"])
        self.assertEqual(resumo["sugestao_reforco_pre_obra"]["tipo"], "anual")
        self.assertFalse(item["faixa_natural"])
        self.assertEqual(item["classificacao"], "atenção")
        self.assertIsNotNone(item["ajuste_fluxo_pre_obra"])

    def test_parcelas_manuais_e_datas_respeitam_teto_e_prazo_total(self):
        payload = self._payload_base()
        payload["parcela_cliente_maxima"] = Decimal("900")
        payload["parcela_financiamento_banco"] = Decimal("300")
        payload["parcela_pre_obra_valor"] = Decimal("800")
        payload["parcela_pos_obra_valor"] = Decimal("750")
        payload["parcelas_intermediarias_quantidade"] = 2
        payload["parcela_intermediaria_valor"] = Decimal("1000")
        payload["parcelas_intermediarias_datas"] = [
            _add_months(date.today(), 3).isoformat(),
            _add_months(date.today(), 86).isoformat(),
        ]
        payload["parcelas_semestrais_quantidade"] = 2
        payload["parcela_semestral_valor"] = Decimal("500")
        payload["parcela_semestral_primeira_data"] = _add_months(date.today(), 6).isoformat()
        payload["parcelas_anuais_quantidade"] = 1
        payload["parcela_anual_valor"] = Decimal("900")
        payload["parcela_anual_primeira_data"] = _add_months(date.today(), 12).isoformat()

        resultado = calcular_simulacao_comercial(
            self.cliente_base,
            self.complementos_base,
            self.imovel_base,
            payload,
        )
        resumo = resultado["resumo_operacao"]
        demonstrativo = resultado["demonstrativo"]

        self.assertEqual(resumo["capacidade_parcela_7lm"], Decimal("600.00"))
        self.assertEqual(resumo["parcela_pre_obra_manual"], Decimal("800.00"))
        self.assertEqual(resumo["parcela_pos_obra_manual"], Decimal("600.00"))
        self.assertLessEqual(resumo["meses_pre_entrega"] + resumo["meses_pos_entrega"], 80)
        self.assertTrue(any(item["tipo"] == "intermediaria" for item in demonstrativo))
        limite = _add_months(date.today(), 80)
        self.assertTrue(all(item["vencimento"] <= limite for item in demonstrativo if item["tipo"] != "entrada_sinal"))

    def test_validacao_final_bloqueia_venda_ruim(self):
        valido, erros = validar_operacao_final(
            {
                "status_simulacao": "inválida",
                "percentual_comprometimento": Decimal("0.62"),
                "percentual_fechamento_inicial": Decimal("0.70"),
                "percentual_projetado_entrega": Decimal("0.80"),
            },
            "vender",
        )
        self.assertFalse(valido)
        self.assertGreaterEqual(len(erros), 2)

    def test_validacao_final_libera_parcelas_pontuais_com_gatilhos_encaixados(self):
        valido, erros = validar_operacao_final(
            {
                "status_simulacao": "inválida",
                "percentual_comprometimento": Decimal("2.15"),
                "valor_garantido_planejado": Decimal("192000.00"),
                "valor_garantido_real": Decimal("192024.56"),
                "valor_garantido_pre_obra_planejado": Decimal("220800.00"),
                "valor_garantido_pre_obra_real": Decimal("225000.00"),
            },
            "vender",
        )
        self.assertTrue(valido)
        self.assertEqual(erros, [])

    def test_aprovacao_excecao_permite_gap_proximo_dos_gatilhos(self):
        analise = analisar_aprovacao_excecao(
            {
                "resumo_operacao": {
                    "valor_total_operacao": Decimal("300000"),
                    "valor_garantido_planejado": Decimal("270000"),
                    "valor_garantido_real": Decimal("260000"),
                    "valor_garantido_pre_obra_planejado": Decimal("294000"),
                    "valor_garantido_pre_obra_real": Decimal("286000"),
                    "percentual_comprometimento": Decimal("0.40"),
                }
            }
        )

        self.assertTrue(analise["necessaria"])
        self.assertTrue(analise["permitida"])
        self.assertIn("elegível", analise["mensagem"].lower())
        self.assertGreater(len(analise["gatilhos_pendentes"]), 0)
        self.assertEqual(analise["bloqueios"], [])

    def test_aprovacao_excecao_permite_gap_distante_com_aviso_para_gestor(self):
        analise = analisar_aprovacao_excecao(
            {
                "resumo_operacao": {
                    "valor_total_operacao": Decimal("300000"),
                    "valor_garantido_planejado": Decimal("270000"),
                    "valor_garantido_real": Decimal("230000"),
                    "valor_garantido_pre_obra_planejado": Decimal("294000"),
                    "valor_garantido_pre_obra_real": Decimal("250000"),
                    "percentual_comprometimento": Decimal("0.40"),
                }
            }
        )

        self.assertTrue(analise["necessaria"])
        self.assertTrue(analise["permitida"])
        self.assertIn("gestor", analise["mensagem"].lower())
        self.assertEqual(analise["bloqueios"], [])
        self.assertIn("acima da faixa", " ".join(analise["motivos_aprovacao"]).lower())

    def test_aprovacao_excecao_nao_exige_fluxo_gerencial_quando_gatilhos_ja_encaixaram(self):
        analise = analisar_aprovacao_excecao(
            {
                "resumo_operacao": {
                    "valor_total_operacao": Decimal("230000"),
                    "valor_garantido_planejado": Decimal("145954.56"),
                    "valor_garantido_real": Decimal("145954.56"),
                    "valor_garantido_pre_obra_planejado": Decimal("18175.44"),
                    "valor_garantido_pre_obra_real": Decimal("18175.44"),
                    "percentual_comprometimento": Decimal("0.44"),
                    "parcela_7lm_media_pre": Decimal("382.51"),
                    "status_simulacao": "inválida",
                    "bloqueios": [
                        "No pós-obra, a parcela 7LM excede a margem disponível depois de descontar a parcela cheia do banco."
                    ],
                }
            }
        )

        self.assertFalse(analise["necessaria"])
        self.assertFalse(analise["permitida"])
        self.assertNotIn("validacao_comercial", analise["gatilhos_pendentes"])
        self.assertEqual(analise["bloqueios"], [])
        self.assertIn("não precisa", analise["mensagem"].lower())

    def test_aprovacao_excecao_nao_abre_fluxo_gerencial_para_trava_que_nao_depende_dos_gatilhos(self):
        analise = analisar_aprovacao_excecao(
            {
                "resumo_operacao": {
                    "valor_total_operacao": Decimal("230000"),
                    "valor_garantido_planejado": Decimal("145954.56"),
                    "valor_garantido_real": Decimal("145954.56"),
                    "valor_garantido_pre_obra_planejado": Decimal("18175.44"),
                    "valor_garantido_pre_obra_real": Decimal("18175.44"),
                    "percentual_comprometimento": Decimal("0.50"),
                    "parcela_7lm_media_pre": Decimal("20"),
                    "valor_parcela_minima_pre_obra": Decimal("50"),
                    "status_simulacao": "inválida",
                    "bloqueios": ["Comprometimento de renda acima da trava de 45%."],
                }
            }
        )

        self.assertFalse(analise["necessaria"])
        self.assertFalse(analise["permitida"])
        self.assertNotIn("validacao_comercial", analise["gatilhos_pendentes"])
        self.assertEqual(analise["bloqueios"], [])
        self.assertIn("mínimo", " ".join(analise["motivos_aprovacao"]).lower())

    def test_aprovacao_excecao_mantem_bloqueio_duro_sem_valor_total(self):
        analise = analisar_aprovacao_excecao(
            {
                "resumo_operacao": {
                    "valor_total_operacao": Decimal("0"),
                    "status_simulacao": "invalida",
                    "bloqueios": ["Operação sem valor total."],
                }
            }
        )

        self.assertTrue(analise["necessaria"])
        self.assertFalse(analise["permitida"])
        self.assertGreaterEqual(len(analise["bloqueios"]), 1)

    def test_aprovacao_excecao_ignora_bloqueio_antigo_em_simulacao_salva_quando_gatilhos_encaixaram(self):
        analise = analisar_aprovacao_excecao(
            {
                "status_simulacao": "inválida",
                "payload_snapshot": {
                    "calculo": {
                        "resumo_operacao": {
                            "valor_total_operacao": Decimal("230000"),
                            "valor_garantido_planejado": Decimal("145954.56"),
                            "valor_garantido_real": Decimal("145954.56"),
                            "valor_garantido_pre_obra_planejado": Decimal("18175.44"),
                            "valor_garantido_pre_obra_real": Decimal("18175.44"),
                            "percentual_comprometimento": Decimal("0.44"),
                            "parcela_7lm_media_pre": Decimal("382.51"),
                            "status_simulacao": "inválida",
                            "bloqueios": ["No pós-obra, a parcela 7LM excede a margem disponível."],
                        }
                    }
                },
            }
        )

        self.assertFalse(analise["necessaria"])
        self.assertFalse(analise["permitida"])
        self.assertNotIn("validacao_comercial", analise["gatilhos_pendentes"])


if __name__ == "__main__":
    unittest.main()
