"""
Autor: Willian Elias Franca
Projeto: 7LM Connect - Plataforma Integrada
Observação: arquivos em português, com nomes descritivos.
"""


from typing import Dict
from fastapi import Request, HTTPException

from banco import iniciar_pool_de_conexoes
from configuracoes import ESQUEMA_BANCO
from utilitarios.seguranca import ler_token_de_acesso

async def obter_usuario_autenticado(request: Request) -> Dict[str, str]:
    autorizacao = request.headers.get("authorization", "")
    if not autorizacao.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Credencial de acesso ausente.")

    token = autorizacao.split(" ", 1)[1].strip()
    payload = ler_token_de_acesso(token, validar_expiracao=True)
    if not payload:
        raise HTTPException(status_code=401, detail="Credencial inválida ou expirada.")

    identificador_usuario = payload.get("sub")
    identificador_sessao = payload.get("sid")
    if not identificador_usuario or not identificador_sessao:
        raise HTTPException(status_code=401, detail="Credencial inválida.")

    pool = await iniciar_pool_de_conexoes()
    async with pool.acquire() as conexao:
        linha = await conexao.fetchrow(
            f"""
            SELECT situacao_sessao, data_hora_expiracao
              FROM {ESQUEMA_BANCO}.sessao
             WHERE identificador_sessao = $1
            """,
            identificador_sessao
        )
        if not linha:
            raise HTTPException(status_code=401, detail="Sessão não encontrada.")
        if linha["situacao_sessao"] != "ATIVA":
            raise HTTPException(status_code=401, detail="Sessão encerrada.")
        if linha["data_hora_expiracao"] <= __import__("datetime").datetime.now(__import__("datetime").timezone.utc):
            raise HTTPException(status_code=401, detail="Sessão expirada.")

        await conexao.execute(
            f"UPDATE {ESQUEMA_BANCO}.sessao SET data_hora_ultimo_uso = NOW() WHERE identificador_sessao = $1",
            identificador_sessao
        )

    return {"identificador_usuario": identificador_usuario, "identificador_sessao": identificador_sessao}

