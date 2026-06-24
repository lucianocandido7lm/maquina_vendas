import sys
import unittest
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "01_codigo_fonte" / "api_7lm_connect"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from servicos.metas import (  # noqa: E402
    calcular_atingimento,
    calcular_faltante,
    calcular_meta_potencial_colaborador,
    classificar_status_meta,
    detectar_escopo_visualizacao_metas,
    filtrar_referencias_por_escopo,
    preparar_nova_versao_meta,
    resolver_meta_oficial_gestor,
    usuario_no_escopo_visualizacao,
    usuario_pode_gerenciar_subordinado,
    validar_linha_importacao_colaborador,
    validar_linha_importacao_gerencial,
    validar_prazo_alteracao,
)


class TesteMetasServico(unittest.TestCase):
    def test_cadastro_meta_inicial_cria_versao_um(self):
        resultado = preparar_nova_versao_meta(None, date(2026, 3, 1), 0)
        self.assertEqual(resultado["versao"], 1)
        self.assertIsNone(resultado["data_fim_anterior"])

    def test_alteracao_meta_dentro_do_prazo(self):
        resultado = validar_prazo_alteracao(3, 2026, datetime(2026, 3, 26, 23, 59, 59))
        self.assertTrue(resultado["permitido"])

    def test_bloqueio_meta_fora_do_prazo(self):
        resultado = validar_prazo_alteracao(3, 2026, datetime(2026, 3, 27, 0, 0, 0))
        self.assertFalse(resultado["permitido"])
        self.assertIn("encerrado", resultado["mensagem"])

    def test_inativacao_meta_anterior_calcula_fim_na_vespera(self):
        resultado = preparar_nova_versao_meta({"id": "m1"}, date(2026, 3, 25), 1)
        self.assertEqual(resultado["data_fim_anterior"], date(2026, 3, 24))

    def test_criacao_de_nova_versao_incrementa(self):
        resultado = preparar_nova_versao_meta({"id": "m1"}, date(2026, 3, 25), 3)
        self.assertEqual(resultado["versao"], 4)

    def test_historico_de_alteracao_tem_base_para_valor_anterior(self):
        resultado = preparar_nova_versao_meta({"meta_valor": Decimal("20")}, date(2026, 3, 25), 1)
        self.assertEqual(resultado["versao"], 2)
        self.assertEqual(resultado["data_fim_anterior"], date(2026, 3, 24))

    def test_calculo_meta_automatica_do_gestor(self):
        resultado = resolver_meta_oficial_gestor(None, Decimal("450"))
        self.assertEqual(resultado["meta_oficial"], Decimal("450"))
        self.assertEqual(resultado["origem_meta"], "AUTOMATICA")

    def test_meta_manual_sobrescreve_automatica(self):
        resultado = resolver_meta_oficial_gestor(Decimal("500"), Decimal("450"))
        self.assertEqual(resultado["meta_oficial"], Decimal("500"))
        self.assertEqual(resultado["meta_automatica"], Decimal("450"))
        self.assertEqual(resultado["origem_meta"], "MANUAL")

    def test_meta_potencial_gestor_usa_soma_dos_corretores(self):
        resultado = calcular_meta_potencial_colaborador("GESTOR", Decimal("999"), Decimal("450"))
        self.assertEqual(resultado, Decimal("450.00"))

    def test_meta_potencial_corretor_nao_usa_input_separado(self):
        resultado = calcular_meta_potencial_colaborador("CORRETOR", Decimal("25"), Decimal("999"))
        self.assertEqual(resultado, Decimal("25.00"))

    def test_percentual_atingimento(self):
        self.assertEqual(calcular_atingimento(Decimal("75"), Decimal("100")), Decimal("75.00"))

    def test_calculo_faltante(self):
        self.assertEqual(calcular_faltante(Decimal("75"), Decimal("100")), Decimal("25"))

    def test_exibicao_pessoa_sem_meta(self):
        self.assertEqual(classificar_status_meta(Decimal("10"), None, True), "Sem meta cadastrada")

    def test_exibicao_resultado_sem_meta(self):
        self.assertEqual(classificar_status_meta(Decimal("10"), Decimal("0"), True), "Sem meta cadastrada")

    def test_permissao_gestor_apenas_subordinados(self):
        self.assertTrue(usuario_pode_gerenciar_subordinado(
            usuario_admin=False,
            identificador_usuario="gestor-1",
            identificador_alvo="corretor-1",
            subordinados={"corretor-1"},
        ))
        self.assertFalse(usuario_pode_gerenciar_subordinado(
            usuario_admin=False,
            identificador_usuario="gestor-1",
            identificador_alvo="corretor-2",
            subordinados={"corretor-1"},
        ))

    def test_escopo_de_diretor_e_global(self):
        escopo = detectar_escopo_visualizacao_metas(
            perfis=["Diretor Comercial"],
            usuario_admin=False,
            usuario_manage=False,
            usuario_gerenciais=True,
            usuario_resultados=True,
        )
        self.assertEqual(escopo, "GLOBAL")

    def test_escopo_de_gestor_restringe_ao_time(self):
        escopo = detectar_escopo_visualizacao_metas(
            perfis=["Gestor Comercial"],
            usuario_admin=False,
            usuario_manage=True,
        )
        self.assertEqual(escopo, "GESTOR")
        self.assertTrue(usuario_no_escopo_visualizacao(
            escopo=escopo,
            identificador_usuario="gestor-1",
            identificador_alvo="corretor-1",
            subordinados={"corretor-1"},
        ))
        self.assertFalse(usuario_no_escopo_visualizacao(
            escopo=escopo,
            identificador_usuario="gestor-1",
            identificador_alvo="corretor-2",
            subordinados={"corretor-1"},
        ))

    def test_escopo_de_corretor_restringe_ao_proprio_usuario(self):
        escopo = detectar_escopo_visualizacao_metas(
            perfis=["Corretor"],
            usuario_admin=False,
            usuario_manage=False,
        )
        self.assertEqual(escopo, "PESSOAL")
        self.assertTrue(usuario_no_escopo_visualizacao(
            escopo=escopo,
            identificador_usuario="corretor-1",
            identificador_alvo="corretor-1",
        ))
        self.assertFalse(usuario_no_escopo_visualizacao(
            escopo=escopo,
            identificador_usuario="corretor-1",
            identificador_alvo="corretor-2",
        ))

    def test_filtragem_de_referencias_respeita_escopo_do_gestor(self):
        referencias = {
            "usuarios": [
                {"identificador_usuario": "gestor-1", "equipes": ["EQUIPE-A"]},
                {"identificador_usuario": "corretor-1", "equipes": ["EQUIPE-A"]},
                {"identificador_usuario": "corretor-2", "equipes": ["EQUIPE-B"]},
            ],
            "equipes": [
                {"codigo": "EQUIPE-A", "nome": "Equipe A"},
                {"codigo": "EQUIPE-B", "nome": "Equipe B"},
            ],
        }
        filtradas = filtrar_referencias_por_escopo(
            referencias,
            escopo="GESTOR",
            identificador_usuario="gestor-1",
            subordinados={"corretor-1"},
        )
        self.assertEqual(
            {item["identificador_usuario"] for item in filtradas["usuarios"]},
            {"gestor-1", "corretor-1"},
        )
        self.assertEqual(
            {item["codigo"] for item in filtradas["equipes"]},
            {"EQUIPE-A"},
        )

    def test_importacao_planilha_linha_valida_colaborador(self):
        usuarios = {"carlos": {"identificador_usuario": "u1"}}
        indicadores = {"VISITAS": {"id": 2}}
        resultado = validar_linha_importacao_colaborador(
            {
                "funcionario": "CARLOS",
                "indicador": "VISITAS",
                "meta_potencial": "30",
                "meta": "20",
                "data_inicial": "01/03/2026",
                "data_fim": "24/03/2026",
            },
            indicadores_por_codigo=indicadores,
            usuarios_por_nome=usuarios,
        )
        self.assertTrue(resultado["valida"])
        self.assertEqual(resultado["dados"]["meta_valor"], Decimal("20"))

    def test_importacao_planilha_linha_invalida_nao_quebra_lote(self):
        resultado = validar_linha_importacao_gerencial(
            {
                "regiao": "GO",
                "indicador_meta": "NAO_EXISTE",
                "tipo_meta": "REGIONAL",
                "meta": "-1",
                "data_inicio": "31/03/2026",
                "data_fim": "01/03/2026",
            },
            indicadores_por_codigo={},
            usuarios_por_nome={},
        )
        self.assertFalse(resultado["valida"])
        self.assertGreaterEqual(len(resultado["erros"]), 2)


if __name__ == "__main__":
    unittest.main()
