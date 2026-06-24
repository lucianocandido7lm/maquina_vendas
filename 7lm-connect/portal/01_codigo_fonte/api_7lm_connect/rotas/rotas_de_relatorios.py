"""
Autor: Willian Elias Franca
Projeto: 7LM Connect - Plataforma Integrada
Observação: arquivos em português, com nomes descritivos.
"""


from typing import Optional
from fastapi import APIRouter, Request, Depends

from dependencias import obter_usuario_autenticado
from banco import iniciar_pool_de_conexoes
from utilitarios.identificacao_do_cliente import obter_endereco_ip, obter_agente_do_usuario
from utilitarios.auditoria import registrar_evento

rotas_de_relatorios = APIRouter()

@rotas_de_relatorios.get("/relatorios/hora-a-hora")
async def relatorio_hora_a_hora(
    request: Request,
    identificador_operacao: Optional[int] = None,
    identificador_habilidade: Optional[int] = None,
    usuario=Depends(obter_usuario_autenticado)
):
    endereco_ip = obter_endereco_ip(request)
    agente_do_usuario = obter_agente_do_usuario(request)

    pool = await iniciar_pool_de_conexoes()
    async with pool.acquire() as conexao:
        await registrar_evento(
            conexao,
            "ACESSO_RELATORIO",
            usuario["identificador_usuario"],
            usuario["identificador_sessao"],
            "Acesso ao relatório hora a hora.",
            {"identificador_operacao": identificador_operacao, "identificador_habilidade": identificador_habilidade},
            endereco_ip,
            agente_do_usuario
        )

    return {
        "mensagem": "Rota criada. Consulta será implementada quando definirmos as tabelas de fatos do relatório.",
        "parametros": {"identificador_operacao": identificador_operacao, "identificador_habilidade": identificador_habilidade}
    }
