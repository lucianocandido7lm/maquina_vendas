import sys
import unittest
from pathlib import Path


API_DIR = Path(__file__).resolve().parents[2] / "01_codigo_fonte" / "api_7lm_connect"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from servicos.comissionamento_preview import enriquecer_registro  # noqa: E402
from repositorios.comissionamento import _aplicar_regras_e_hierarquia_publicadas, _lider_para_resultado  # noqa: E402
from rotas.rotas_de_comissionamento import (  # noqa: E402
    _estado_retorno_revisao,
    _regra_bloqueada_para_edicao,
    _resumo_alteracoes_regra,
)
from servicos.notificacoes_comissionamento import (  # noqa: E402
    destinatario_email_final,
    destinatarios_email_finais,
    mascarar_payload,
    permite_destinatario_real,
    redirecionar_destinatarios_email,
    template_por_acao,
    variaveis_padrao,
)


def registro_base(**overrides):
    registro = {
        "id": "teste-2026-06",
        "ciclo_id": "2026-06",
        "funcao": "Gerente de Vendas",
        "cidade": "Formosa",
        "nome": "Pessoa Teste",
        "tipo_comissionado": "PJ_AUTONOMO",
        "valor_bruto": 1000,
        "desconto_distrato": 0,
        "valor_liquido": 1000,
        "status": "calculado",
        "status_nf": "pendente_nf",
        "status_financeiro": "nao_enviado",
        "status_pagamento": "nao_enviado",
        "exige_nf": True,
    }
    registro.update(overrides)
    return enriquecer_registro(registro, 1)


class ComissionamentoFluxoTest(unittest.TestCase):
    def test_secretaria_pode_enviar_para_aprovacao_e_pedir_revisao(self):
        fluxo = registro_base(status="calculado")["fluxo"]

        self.assertEqual(fluxo["status_aprovacao"], "calculado")
        self.assertEqual(fluxo["acoes_permitidas"], ["enviar_head", "solicitar_ajuste"])

    def test_aprovador_configuravel_atua_na_etapa_comercial(self):
        fluxo = registro_base(status="aguardando_head_comercial")["fluxo"]

        self.assertEqual(fluxo["proxima_acao"], "aprovar_head")
        self.assertEqual(fluxo["acoes_permitidas"], ["aprovar_head", "rejeitar", "solicitar_ajuste"])

    def test_pj_aguardando_nf_permite_somente_reenvio_da_secretaria(self):
        fluxo = registro_base(status="aguardando_nf", status_nf="solicitada")["fluxo"]

        self.assertEqual(fluxo["status_nf"], "solicitada")
        self.assertEqual(fluxo["acoes_permitidas"], ["reenviar_lembrete_nf"])

    def test_comissao_em_pagamento_nao_permite_revisao_recalculo(self):
        fluxo = registro_base(
            status="enviada_pagamento",
            status_nf="recebida",
            status_financeiro="pacote_enviado",
            status_pagamento="aguardando_pagamento",
        )["fluxo"]

        self.assertEqual(fluxo["status_aprovacao"], "enviada_pagamento")
        self.assertEqual(fluxo["acoes_permitidas"], [])

    def test_revisao_necessaria_volta_para_primeira_etapa(self):
        fluxo = registro_base(status="revisao_necessaria", status_nf="pendente_nf")["fluxo"]

        self.assertEqual(fluxo["status_aprovacao"], "revisao_necessaria")
        self.assertEqual(fluxo["status_nf"], "pendente_nf")
        self.assertEqual(fluxo["proxima_acao"], "enviar_head")
        self.assertEqual(fluxo["acoes_permitidas"], ["enviar_head", "solicitar_ajuste"])

    def test_estado_canonico_de_retorno_revisao_para_pj(self):
        self.assertEqual(_estado_retorno_revisao(True), {
            "status": "revisao_necessaria",
            "status_nf": "pendente_nf",
            "status_financeiro": "nao_enviado",
            "status_pagamento": "nao_enviado",
        })

    def test_clt_nao_entra_em_esteira_de_nf(self):
        fluxo = registro_base(
            tipo_comissionado="CLT",
            exige_nf=False,
            status="aprovada_head_comercial",
            status_nf="nao_aplicavel",
        )["fluxo"]

        self.assertEqual(fluxo["status_nf"], "nao_aplicavel")
        self.assertEqual(fluxo["status_financeiro"], "pacote_enviado")
        self.assertEqual(fluxo["acoes_permitidas"], [])

    def test_templates_respeitam_tipo_de_comissionado_e_destino(self):
        self.assertEqual(template_por_acao("aprovar_head", exige_nf=True), "comissionado_nf_solicitada")
        self.assertEqual(template_por_acao("aprovar_head", exige_nf=False), "rh_financeiro_pacote_clt_enviado")
        self.assertEqual(
            template_por_acao("enviar_pacote_pagamento", exige_nf=False, destino_pacote="RH e Financeiro"),
            "rh_financeiro_pacote_clt_enviado",
        )
        self.assertEqual(
            template_por_acao("enviar_pacote_pagamento", exige_nf=True, destino_pacote="Financeiro"),
            "financeiro_pacote_pj_enviado",
        )
        self.assertEqual(template_por_acao("publicar_regra"), "comissionado_regra_publicada")

    def test_regra_publicada_permite_email_real_do_comissionado(self):
        self.assertTrue(permite_destinatario_real({
            "template_codigo": "comissionado_regra_publicada",
            "payload_renderizado": {"entrega_controlada": "destinatario_real"},
        }))
        self.assertTrue(permite_destinatario_real({
            "template_codigo": "comissionado_nf_solicitada",
            "payload_renderizado": {"entrega_controlada": "destinatario_real"},
        }))
        self.assertFalse(permite_destinatario_real({
            "template_codigo": "financeiro_pacote_pj_enviado",
            "payload_renderizado": {"entrega_controlada": "destinatario_real"},
        }))
        self.assertFalse(permite_destinatario_real({
            "template_codigo": "comissionado_regra_publicada",
            "payload_renderizado": {"entrega_controlada": "teste_allowlist"},
        }))

    def test_emails_do_comissionamento_sao_redirecionados_para_hudson(self):
        destinos, originais = redirecionar_destinatarios_email([
            {"email": "pessoa.teste@7lm.com.br", "nome": "Pessoa Teste", "perfil": "comissionado"},
            {"email": "inovacao@7lm.com.br", "nome": "Inovacao", "perfil": "teste"},
        ])

        self.assertEqual(destinos, [
            {
                "email": "hudson.porto@7lm.com.br",
                "nome": "Hudson Porto",
                "perfil": "redirecionamento_temporario",
                "canal": "email",
                "visibilidade": "ciclo",
                "pode_ver_valor": False,
            },
            {
                "email": "fernanda.oliveira@7lm.com.br",
                "nome": "Fernanda Leao Uchoa De Oliveira",
                "perfil": "redirecionamento_temporario",
                "canal": "email",
                "visibilidade": "ciclo",
                "pode_ver_valor": False,
            },
        ])
        self.assertEqual([destino["email"] for destino in originais], ["pessoa.teste@7lm.com.br", "inovacao@7lm.com.br"])
        self.assertEqual(destinatario_email_final("bruno.macario@7lm.com.br"), "hudson.porto@7lm.com.br")
        self.assertEqual(destinatarios_email_finais("bruno.macario@7lm.com.br"), (
            "hudson.porto@7lm.com.br",
            "fernanda.oliveira@7lm.com.br",
        ))

    def test_resumo_regra_publicada_mostra_antes_e_agora(self):
        resumo = _resumo_alteracoes_regra(
            regra_nome="Regra 01",
            antes={
                "regra_01": {
                    "faixa_aplicada": "95% a 104,99%",
                    "faixas": [{"rotulo": "95% a 104,99%", "valor_bonus": 10600}],
                },
                "valor_bruto": 10600,
                "valor_liquido": 11500,
            },
            depois={
                "regra_01": {
                    "faixa_aplicada": "95% a 104,99%",
                    "percentual_atingimento": 100,
                    "realizado": 12,
                    "objetivo": 12,
                    "faixas": [
                        {"id": f"faixa_{indice}", "rotulo": f"Faixa {indice}", "valor_bonus": indice}
                        for indice in range(1, 12)
                    ] + [{"id": "faixa_atual", "rotulo": "95% a 104,99%", "valor_bonus": 10602}],
                },
                "valor_bruto": 10602,
                "valor_liquido": 11502,
                "valores": {"bonus_ips": 900},
            },
            regra_01={
                "faixa_aplicada": "95% a 104,99%",
                "faixas": [{"rotulo": "95% a 104,99%", "valor_bonus": 10602}],
            },
            regra_02={},
            regra_02_ips=[],
            regra_02_ips_removidos=[],
        )

        self.assertIn("- Regra alterada: Regra 01 - escada de atingimento", resumo)
        self.assertIn("- Faixa atual: 95% a 104,99%", resumo)
        self.assertIn("- Valor da faixa: R$ 10.600,00 -> R$ 10.602,00", resumo)
        self.assertIn("- Bruto agora: R$ 10.602,00", resumo)
        self.assertIn("- Bônus IPs agora: R$ 900,00", resumo)
        self.assertIn("- Líquido agora: R$ 11.502,00", resumo)
        self.assertNotIn("faixas[", resumo)
        self.assertNotIn("comissionado_id", resumo)

    def test_resumo_regra_publicada_usa_valores_oficiais_e_faixa_aplicada(self):
        resumo = _resumo_alteracoes_regra(
            regra_nome="Regra 01",
            antes={
                "valor_bruto": 44625,
                "valor_liquido": 50130,
                "regra_01": {
                    "faixa_aplicada": "105% a 109,99%",
                    "faixas": [{"rotulo": "105% a 109,99%", "valor_bonus": 44625}],
                },
            },
            depois={
                "valor_bruto": 4463.0,
                "valor_liquido": 5013.0,
                "valores": {"bonus_ips": 550.0},
                "regra_01": {
                    "faixa_aplicada": "105% a 109,99%",
                    "percentual_atingimento": 107.69,
                    "realizado": 14,
                    "objetivo": 13,
                    "faixas": [
                        {"rotulo": "80% a 94,99%", "valor_bonus": 3400, "ativa": True},
                        {"rotulo": "105% a 109,99%", "valor_bonus": 4463, "ativa": False},
                    ],
                },
            },
            regra_01={},
            regra_02={},
            regra_02_ips=[],
            regra_02_ips_removidos=[],
        )

        self.assertIn("- Faixa atual: 105% a 109,99%", resumo)
        self.assertIn("- Valor da faixa: R$ 44.625,00 -> R$ 4.463,00", resumo)
        self.assertIn("- Bruto agora: R$ 4.463,00", resumo)
        self.assertIn("- Bônus IPs agora: R$ 550,00", resumo)
        self.assertIn("- Líquido agora: R$ 5.013,00", resumo)
        self.assertNotIn("R$ 44.630,00", resumo)
        self.assertNotIn("R$ 50.130,00", resumo)

    def test_regras_editaveis_somente_em_calculada_revisao(self):
        self.assertFalse(_regra_bloqueada_para_edicao(registro_base(status="calculado")))
        self.assertFalse(_regra_bloqueada_para_edicao(registro_base(status="revisao_necessaria")))
        self.assertTrue(_regra_bloqueada_para_edicao(registro_base(status="aguardando_head_comercial")))
        self.assertTrue(_regra_bloqueada_para_edicao(registro_base(status="aguardando_nf", status_nf="solicitada")))
        self.assertTrue(_regra_bloqueada_para_edicao(registro_base(status="nf_em_validacao", status_nf="recebida")))
        self.assertTrue(_regra_bloqueada_para_edicao(registro_base(status="enviada_pagamento", status_pagamento="aguardando_pagamento")))

    def test_regra_publicada_recalcula_valor_bruto_e_liquido(self):
        registro_bruno = registro_base(
            id="bruno-macario",
            nome="Bruno Macario",
            valor_bruto=10600,
            valor_liquido=10600,
            desconto_distrato=0,
        )
        registro_bruno.update({
            "regra_01": [
                {
                    "faixa_aplicada": "95% a 104,99%",
                    "valor_calculado": 10600,
                    "faixas": [
                        {"rotulo": "95% a 104,99%", "valor_bonus": 10600, "ativa": True},
                        {"rotulo": "105% a 109,99%", "valor_bonus": 11130, "ativa": False},
                    ],
                }
            ],
            "regra_02_ips": [
                {
                    "ip_id": "bruno-ip-1",
                    "nome": "IPC minimo",
                    "indicador": "ipc",
                    "operador": ">=",
                    "alvo": 1.2,
                    "realizado": 1.3,
                    "valor_bonus": 900,
                }
            ],
            "valores": {"bruto": 10600, "distratos": 0, "bonus_ips": 900, "liquido": 11500},
        })
        preview = {
            "resumo": {},
            "registros": [registro_bruno],
        }
        regras = {
            "bruno-macario": {
                "regra_01": {
                    "comissionado_id": "bruno-macario",
                    "regra_01": {
                        "faixa_aplicada": "95% a 104,99%",
                        "faixas": [
                            {"rotulo": "95% a 104,99%", "valor_bonus": 10602},
                            {"rotulo": "105% a 109,99%", "valor_bonus": 11130},
                        ],
                    },
                    "versao": 2,
                },
                "regra_02": {
                    "comissionado_id": "bruno-macario",
                    "regra_02_ips": [
                        {
                            "ip_id": "bruno-ip-1",
                            "nome": "IPC minimo",
                            "indicador": "ipc",
                            "operador": ">=",
                            "alvo": 1.2,
                            "realizado": 1.3,
                            "valor_bonus": 901,
                        }
                    ],
                    "regra_02_ips_removidos": [],
                    "versao": 3,
                }
            }
        }

        atualizado = _aplicar_regras_e_hierarquia_publicadas(preview, regras, {})
        registro = atualizado["registros"][0]

        self.assertEqual(registro["valor_bruto"], 10602.0)
        self.assertEqual(registro["valor_liquido"], 11503.0)
        self.assertEqual(registro["valores"]["bruto"], 10602.0)
        self.assertEqual(registro["valores"]["bonus_ips"], 901.0)
        self.assertEqual(registro["valores"]["liquido"], 11503.0)

    def test_valores_de_email_ficam_mascarados_para_consulta_no_portal(self):
        payload = mascarar_payload({
            "valor_bruto": 1000,
            "valor_liquido": 900,
            "valor_nf": 900,
            "documento": "12345678900",
        })

        self.assertEqual(payload["valor_bruto"], "consulte_no_portal")
        self.assertEqual(payload["valor_liquido"], "consulte_no_portal")
        self.assertEqual(payload["valor_nf"], "consulte_no_portal")
        self.assertEqual(payload["documento"], "link_protegido")

    def test_prazo_padrao_de_nf_e_dois_dias_uteis(self):
        variaveis = variaveis_padrao({"ciclo": "2026-06"})

        self.assertEqual(variaveis["prazo"], "2 dias uteis")

    def test_lider_2026_06_e_classificado_como_pj_autonomo_com_nf(self):
        resultado = _lider_para_resultado("gestor", {
            "nome": "Pessoa Lider",
            "cargo": "Head Comercial",
            "tipo_funcionario": "Funcionario",
            "tipo_vinculo": "CLT",
            "origem_identidade": "funcionario_acesso",
        })

        self.assertEqual(resultado["tipo_comissionado"], "PJ_AUTONOMO")
        self.assertTrue(resultado["exige_nf"])
        self.assertEqual(resultado["status_nf"], "pendente_nf")


if __name__ == "__main__":
    unittest.main()
