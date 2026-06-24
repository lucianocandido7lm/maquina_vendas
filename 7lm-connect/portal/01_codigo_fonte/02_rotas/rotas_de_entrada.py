"""
Autor: Willian Elias Franca
Projeto: 7LM Connect - Plataforma Integrada
"""

import json
import base64
import uuid
from io import BytesIO
from datetime import timedelta

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel

from banco import iniciar_pool_de_conexoes
from configuracoes import (
    ESQUEMA_BANCO, HORAS_CREDENCIAL_RENOVACAO,
    MAXIMO_FALHAS_CONSECUTIVAS, MINUTOS_BLOQUEIO,
    # >>> ADICIONE no configuracoes.py (ver seÃƒÂ§ÃƒÂ£o 7)
    MFA_OBRIGATORIO, MFA_ISSUER, MFA_DESAFIO_MINUTOS, MFA_MAX_TENTATIVAS
)

from modelos.esquemas import RequisicaoEntrada, RespostaEntrada, RequisicaoAtualizarCredencial, RequisicaoSaida
from utilitarios.identificacao_do_cliente import (
    obter_endereco_ip, obter_agente_do_usuario, obter_idioma, obter_cabecalhos
)
from utilitarios.seguranca import (
    agora_utc, validar_senha, gerar_token_de_acesso, gerar_token_de_renovacao, gerar_hash_token
)
from utilitarios.auditoria import registrar_evento, registrar_tentativa_de_entrada
from dependencias import obter_usuario_autenticado

from utilitarios.mfa_totp import (
    gerar_segredo_base32, gerar_otpauth_uri,
    verificar_codigo_totp, segredo_para_banco, segredo_do_banco
)

# Ã¢Å“â€¦ Prefixo garante /entrada/...
rotas_de_entrada = APIRouter(prefix="/entrada")


# =========================
# MODELOS (rotas MFA)
# =========================
class RequisicaoMfaIniciar(BaseModel):
    mfa_desafio: str

class RespostaMfaIniciar(BaseModel):
    mfa_desafio: str
    otpauth_uri: str
    chave_manual: str
    qr_png_base64: str

class RequisicaoMfaConfirmar(BaseModel):
    mfa_desafio: str
    codigo: str

class RequisicaoMfaVerificar(BaseModel):
    mfa_desafio: str
    codigo: str
    fuso_horario_informado: str | None = None

class RequisicaoMfaDesativar(BaseModel):
    senha_atual: str
    codigo_mfa: str


# =========================
# HELPERS
# =========================
async def encerrar_sessoes_ativas(conexao, identificador_usuario: str, motivo: str) -> None:
    await conexao.execute(
        f"""
        UPDATE {ESQUEMA_BANCO}.sessao
           SET situacao_sessao = 'ENCERRADA',
               data_hora_encerramento = NOW(),
               motivo_encerramento = $2
         WHERE identificador_usuario = $1
           AND situacao_sessao = 'ATIVA'
        """,
        identificador_usuario, motivo
    )

    await conexao.execute(
        f"""
        UPDATE {ESQUEMA_BANCO}.credencial_de_renovacao
           SET data_hora_revogacao = NOW()
         WHERE identificador_sessao IN (
            SELECT identificador_sessao
              FROM {ESQUEMA_BANCO}.sessao
             WHERE identificador_usuario = $1
               AND situacao_sessao <> 'ATIVA'
         )
           AND data_hora_revogacao IS NULL
        """,
        identificador_usuario
    )


async def obter_perfis_permissoes_operacoes(conexao, identificador_usuario: str) -> dict:
    perfis = await conexao.fetch(
        f"""
        SELECT p.nome_perfil
          FROM {ESQUEMA_BANCO}.usuario_perfil up
          JOIN {ESQUEMA_BANCO}.perfil p ON p.identificador_perfil = up.identificador_perfil
         WHERE up.identificador_usuario = $1
        """,
        identificador_usuario
    )

    permissoes = await conexao.fetch(
        f"""
        SELECT DISTINCT pe.nome_permissao
          FROM {ESQUEMA_BANCO}.usuario_perfil up
          JOIN {ESQUEMA_BANCO}.perfil_permissao pp ON pp.identificador_perfil = up.identificador_perfil
          JOIN {ESQUEMA_BANCO}.permissao pe ON pe.identificador_permissao = pp.identificador_permissao
         WHERE up.identificador_usuario = $1
        """,
        identificador_usuario
    )

    operacoes = await conexao.fetch(
        f"""
        SELECT o.identificador_operacao, o.nome_operacao
          FROM {ESQUEMA_BANCO}.usuario_operacao uo
          JOIN {ESQUEMA_BANCO}.operacao o ON o.identificador_operacao = uo.identificador_operacao
         WHERE uo.identificador_usuario = $1
           AND o.indicador_ativa = TRUE
         ORDER BY o.nome_operacao
        """,
        identificador_usuario
    )

    return {
        "perfis": [r["nome_perfil"] for r in perfis],
        "permissoes": [r["nome_permissao"] for r in permissoes],
        "operacoes_liberadas": [
            {"identificador_operacao": r["identificador_operacao"], "nome_operacao": r["nome_operacao"]}
            for r in operacoes
        ],
    }


async def criar_desafio_mfa(
    conexao,
    identificador_usuario: str,
    tipo: str,
    endereco_ip: str,
    agente_do_usuario: str,
    idioma: str,
    fuso_horario_informado: str | None,
    cabecalhos: dict
) -> str:
    desafio_id = str(uuid.uuid4())
    expira = agora_utc() + timedelta(minutes=int(MFA_DESAFIO_MINUTOS))

    await conexao.execute(
        f"""
        INSERT INTO {ESQUEMA_BANCO}.mfa_desafio
        (identificador_desafio, identificador_usuario, tipo_desafio, situacao,
         data_hora_expiracao, endereco_ip, agente_do_usuario, idioma, fuso_horario_informado, cabecalhos_http)
        VALUES
        ($1, $2, $3, 'ABERTO', $4, $5, $6, $7, $8, $9::jsonb)
        """,
        desafio_id,
        identificador_usuario,
        tipo,
        expira,
        endereco_ip,
        agente_do_usuario,
        idioma,
        fuso_horario_informado,
        json.dumps(cabecalhos),
    )

    await registrar_evento(
        conexao,
        "MFA_DESAFIO_CRIADO",
        identificador_usuario,
        None,
        "Desafio MFA criado.",
        {"tipo": tipo, "expira_em": str(expira)},
        endereco_ip,
        agente_do_usuario
    )

    return desafio_id


async def carregar_desafio_mfa(conexao, desafio_id: str):
    row = await conexao.fetchrow(
        f"""
        SELECT identificador_desafio, identificador_usuario, tipo_desafio, situacao,
               tentativas, data_hora_expiracao, mfa_segredo_temporario_enc,
               endereco_ip, agente_do_usuario, idioma, fuso_horario_informado, cabecalhos_http
          FROM {ESQUEMA_BANCO}.mfa_desafio
         WHERE identificador_desafio = $1
        """,
        desafio_id
    )
    return row


async def validar_desafio_aberto(conexao, desafio_id: str):
    d = await carregar_desafio_mfa(conexao, desafio_id)
    if not d:
        raise HTTPException(status_code=401, detail="Desafio MFA invÃƒÂ¡lido.")
    if d["situacao"] != "ABERTO":
        raise HTTPException(status_code=401, detail="Desafio MFA nÃƒÂ£o estÃƒÂ¡ aberto.")
    if d["data_hora_expiracao"] <= agora_utc():
        await conexao.execute(
            f"UPDATE {ESQUEMA_BANCO}.mfa_desafio SET situacao='EXPIRADO' WHERE identificador_desafio=$1",
            desafio_id
        )
        raise HTTPException(status_code=401, detail="Desafio MFA expirado.")
    if int(d["tentativas"]) >= int(MFA_MAX_TENTATIVAS):
        await conexao.execute(
            f"UPDATE {ESQUEMA_BANCO}.mfa_desafio SET situacao='CANCELADO' WHERE identificador_desafio=$1",
            desafio_id
        )
        raise HTTPException(status_code=429, detail="Muitas tentativas. Inicie novamente.")
    return d


async def marcar_desafio_usado(conexao, desafio_id: str):
    await conexao.execute(
        f"""
        UPDATE {ESQUEMA_BANCO}.mfa_desafio
           SET situacao='USADO'
         WHERE identificador_desafio=$1
        """,
        desafio_id
    )


async def incrementar_tentativas(conexao, desafio_id: str):
    await conexao.execute(
        f"""
        UPDATE {ESQUEMA_BANCO}.mfa_desafio
           SET tentativas = tentativas + 1
         WHERE identificador_desafio=$1
        """,
        desafio_id
    )


async def criar_sessao_e_tokens(
    conexao,
    identificador_usuario: str,
    matricula: str,
    nome_completo: str,
    correio_eletronico: str | None,
    endereco_ip: str,
    agente_do_usuario: str,
    idioma: str,
    fuso_horario_informado: str | None,
    cabecalhos: dict
) -> dict:
    # reset falhas + ultimo_login
    await conexao.execute(
        f"""
        UPDATE {ESQUEMA_BANCO}.usuario
           SET quantidade_falhas_consecutivas = 0,
               data_hora_bloqueado_ate = NULL,
               data_hora_ultimo_login = NOW()
         WHERE identificador_usuario = $1
        """,
        identificador_usuario
    )

    await encerrar_sessoes_ativas(conexao, identificador_usuario, motivo="NOVA_ENTRADA_REALIZADA")

    expira_sessao = agora_utc() + timedelta(hours=HORAS_CREDENCIAL_RENOVACAO)

    identificador_sessao = await conexao.fetchval(
        f"""
        INSERT INTO {ESQUEMA_BANCO}.sessao
        (identificador_usuario, situacao_sessao, data_hora_expiracao,
         endereco_ip, agente_do_usuario, idioma, fuso_horario_informado, cabecalhos_http)
        VALUES
        ($1, 'ATIVA', $2, $3, $4, $5, $6, $7::jsonb)
        RETURNING identificador_sessao
        """,
        identificador_usuario,
        expira_sessao,
        endereco_ip,
        agente_do_usuario,
        idioma,
        fuso_horario_informado,
        json.dumps(cabecalhos)
    )
    identificador_sessao = str(identificador_sessao)

    token_acesso = gerar_token_de_acesso(identificador_usuario, identificador_sessao)

    token_renovacao_plano = gerar_token_de_renovacao()
    token_renovacao_hash = gerar_hash_token(token_renovacao_plano)
    expira_renovacao = agora_utc() + timedelta(hours=HORAS_CREDENCIAL_RENOVACAO)

    await conexao.execute(
        f"""
        INSERT INTO {ESQUEMA_BANCO}.credencial_de_renovacao
        (identificador_sessao, hash_token, data_hora_expiracao, endereco_ip, agente_do_usuario, cabecalhos_http)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        """,
        identificador_sessao,
        token_renovacao_hash,
        expira_renovacao,
        endereco_ip,
        agente_do_usuario,
        json.dumps(cabecalhos)
    )

    dados_acesso = await obter_perfis_permissoes_operacoes(conexao, identificador_usuario)

    await registrar_evento(
        conexao, "ENTRADA_SUCESSO", identificador_usuario, identificador_sessao,
        "Entrada realizada com sucesso.", {"expira_sessao": str(expira_sessao)},
        endereco_ip, agente_do_usuario
    )

    return {
        "token_de_acesso": token_acesso["token"],
        "token_de_renovacao": token_renovacao_plano,
        "expira_em_segundos": token_acesso["expira_em_segundos"],
        "usuario": {
            "identificador_usuario": identificador_usuario,
            "matricula": matricula,
            "nome_completo": nome_completo,
            "correio_eletronico": correio_eletronico,
            **dados_acesso,
        }
    }


# =========================
# LOGIN (1Ã‚Âª etapa)
# =========================
@rotas_de_entrada.post("/login", response_model=RespostaEntrada)
async def login(dados: RequisicaoEntrada, request: Request):
    endereco_ip = obter_endereco_ip(request)
    agente_do_usuario = obter_agente_do_usuario(request)
    cabecalhos = obter_cabecalhos(request)
    idioma = obter_idioma(request)

    pool = await iniciar_pool_de_conexoes()
    async with pool.acquire() as conexao:
        usuario = await conexao.fetchrow(
            f"""
            SELECT identificador_usuario, matricula, nome_completo, correio_eletronico,
                   senha_hash, indicador_ativo, data_hora_bloqueado_ate, quantidade_falhas_consecutivas,
                   indicador_mfa_habilitado, mfa_totp_segredo_enc
              FROM {ESQUEMA_BANCO}.usuario
             WHERE matricula = $1
            """,
            dados.matricula.strip()
        )

        if not usuario:
            await registrar_tentativa_de_entrada(conexao, None, dados.matricula, False, "USUARIO_INEXISTENTE",
                                                 endereco_ip, agente_do_usuario, cabecalhos)
            await registrar_evento(conexao, "ENTRADA_FALHA", None, None, "UsuÃƒÂ¡rio inexistente.",
                                   {"matricula": dados.matricula}, endereco_ip, agente_do_usuario)
            raise HTTPException(status_code=401, detail="MatrÃƒÂ­cula ou senha invÃƒÂ¡lida.")

        identificador_usuario = str(usuario["identificador_usuario"])

        if not usuario["indicador_ativo"]:
            await registrar_tentativa_de_entrada(conexao, identificador_usuario, dados.matricula, False, "USUARIO_INATIVO",
                                                 endereco_ip, agente_do_usuario, cabecalhos)
            await registrar_evento(conexao, "ENTRADA_FALHA", identificador_usuario, None, "UsuÃƒÂ¡rio inativo.",
                                   {}, endereco_ip, agente_do_usuario)
            raise HTTPException(status_code=403, detail="UsuÃƒÂ¡rio inativo. Acesso negado.")

        bloqueado_ate = usuario["data_hora_bloqueado_ate"]
        if bloqueado_ate and bloqueado_ate > agora_utc():
            await registrar_tentativa_de_entrada(conexao, identificador_usuario, dados.matricula, False, "USUARIO_BLOQUEADO",
                                                 endereco_ip, agente_do_usuario, cabecalhos)
            await registrar_evento(conexao, "ENTRADA_FALHA", identificador_usuario, None, "UsuÃƒÂ¡rio bloqueado.",
                                   {"bloqueado_ate": str(bloqueado_ate)}, endereco_ip, agente_do_usuario)
            raise HTTPException(status_code=403, detail="UsuÃƒÂ¡rio bloqueado temporariamente.")

        if not validar_senha(dados.senha, usuario["senha_hash"]):
            falhas = int(usuario["quantidade_falhas_consecutivas"]) + 1
            bloqueio = None
            if falhas >= MAXIMO_FALHAS_CONSECUTIVAS:
                bloqueio = agora_utc() + timedelta(minutes=MINUTOS_BLOQUEIO)

            await conexao.execute(
                f"""
                UPDATE {ESQUEMA_BANCO}.usuario
                   SET quantidade_falhas_consecutivas = $2,
                       data_hora_bloqueado_ate = $3
                 WHERE identificador_usuario = $1
                """,
                identificador_usuario, falhas, bloqueio
            )

            await registrar_tentativa_de_entrada(conexao, identificador_usuario, dados.matricula, False, "SENHA_INVALIDA",
                                                 endereco_ip, agente_do_usuario, cabecalhos)
            await registrar_evento(conexao, "ENTRADA_FALHA", identificador_usuario, None, "Senha invÃƒÂ¡lida.",
                                   {"falhas": falhas}, endereco_ip, agente_do_usuario)
            raise HTTPException(status_code=401, detail="MatrÃƒÂ­cula ou senha invÃƒÂ¡lida.")

        # senha OK (ainda nÃƒÂ£o ÃƒÂ© login final se MFA obrigatÃƒÂ³rio)
        await registrar_tentativa_de_entrada(conexao, identificador_usuario, dados.matricula, True, None,
                                             endereco_ip, agente_do_usuario, cabecalhos)

        mfa_habilitado = bool(usuario["indicador_mfa_habilitado"])
        mfa_segredo_enc = usuario["mfa_totp_segredo_enc"]
        mfa_configurado = bool(mfa_segredo_enc)

        # MFA obrigatÃƒÂ³rio global
        if MFA_OBRIGATORIO and not mfa_configurado:
            desafio = await criar_desafio_mfa(
                conexao, identificador_usuario, "SETUP",
                endereco_ip, agente_do_usuario, idioma, dados.fuso_horario_informado, cabecalhos
            )
            return {
                "mfa_setup_required": True,
                "mfa_desafio": desafio,
                "mensagem": "Para continuar, ative o 2FA no Microsoft Authenticator.",
                "usuario": {
                    "identificador_usuario": identificador_usuario,
                    "matricula": usuario["matricula"],
                    "nome_completo": usuario["nome_completo"],
                    "correio_eletronico": usuario["correio_eletronico"],
                }
            }

        # Se usuÃƒÂ¡rio tem MFA configurado, exige 2Ã‚Âª etapa
        # Se usuÃƒÂ¡rio tem MFA configurado, exige 2Ã‚Âª etapa
        if mfa_configurado and (mfa_habilitado or MFA_OBRIGATORIO):
            desafio = await criar_desafio_mfa(
                conexao, identificador_usuario, "LOGIN",
                endereco_ip, agente_do_usuario, idioma, dados.fuso_horario_informado, cabecalhos
            )
            return {
                "mfa_required": True,
                "mfa_desafio": desafio,
                "mensagem": "Informe o codigo do Microsoft Authenticator para concluir o acesso.",
                "usuario": {
                    "identificador_usuario": identificador_usuario,
                    "matricula": usuario["matricula"],
                    "nome_completo": usuario["nome_completo"],
                    "correio_eletronico": usuario["correio_eletronico"],
                }
            }


        # Caso MFA nÃƒÂ£o seja obrigatÃƒÂ³rio e usuÃƒÂ¡rio nÃƒÂ£o tem MFA: login direto
        retorno = await criar_sessao_e_tokens(
            conexao,
            identificador_usuario=identificador_usuario,
            matricula=usuario["matricula"],
            nome_completo=usuario["nome_completo"],
            correio_eletronico=usuario["correio_eletronico"],
            endereco_ip=endereco_ip,
            agente_do_usuario=agente_do_usuario,
            idioma=idioma,
            fuso_horario_informado=dados.fuso_horario_informado,
            cabecalhos=cabecalhos
        )
        return retorno


# =========================
# MFA - iniciar setup (gera QR)
# =========================
@rotas_de_entrada.post("/mfa/iniciar", response_model=RespostaMfaIniciar)
async def mfa_iniciar(dados: RequisicaoMfaIniciar, request: Request):
    endereco_ip = obter_endereco_ip(request)
    agente_do_usuario = obter_agente_do_usuario(request)

    pool = await iniciar_pool_de_conexoes()
    async with pool.acquire() as conexao:
        desafio = await validar_desafio_aberto(conexao, dados.mfa_desafio)

        if desafio["tipo_desafio"] != "SETUP":
            raise HTTPException(status_code=400, detail="Desafio MFA nÃƒÂ£o ÃƒÂ© de setup.")

        # idempotente: se jÃƒÂ¡ gerou segredo temporÃƒÂ¡rio, reutiliza
        segredo_temp_enc = desafio["mfa_segredo_temporario_enc"]
        if segredo_temp_enc:
            segredo = segredo_do_banco(segredo_temp_enc)
        else:
            segredo = gerar_segredo_base32()
            segredo_temp_enc = segredo_para_banco(segredo)
            await conexao.execute(
                f"""
                UPDATE {ESQUEMA_BANCO}.mfa_desafio
                   SET mfa_segredo_temporario_enc = $2
                 WHERE identificador_desafio = $1
                """,
                dados.mfa_desafio, segredo_temp_enc
            )

        # carrega usuÃƒÂ¡rio pra montar account_name
        u = await conexao.fetchrow(
            f"""
            SELECT matricula, correio_eletronico
              FROM {ESQUEMA_BANCO}.usuario
             WHERE identificador_usuario = $1
            """,
            str(desafio["identificador_usuario"])
        )

        account = (u["correio_eletronico"] or u["matricula"] or "usuario")
        otpauth_uri = gerar_otpauth_uri(MFA_ISSUER, account, segredo)

        # QR (PNG base64)
        try:
            import qrcode
            img = qrcode.make(otpauth_uri)
            buf = BytesIO()
            img.save(buf, format="PNG")
            qr_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        except Exception:
            raise HTTPException(status_code=500, detail="Falha ao gerar QR Code.")

        await registrar_evento(
            conexao, "MFA_SETUP_INICIADO", str(desafio["identificador_usuario"]), None,
            "Setup MFA iniciado.", {}, endereco_ip, agente_do_usuario
        )

        return {
            "mfa_desafio": dados.mfa_desafio,
            "otpauth_uri": otpauth_uri,
            "chave_manual": segredo,
            "qr_png_base64": qr_b64
        }


# =========================
# MFA - confirmar setup (salva segredo e jÃƒÂ¡ loga)
# =========================
@rotas_de_entrada.post("/mfa/confirmar", response_model=RespostaEntrada)
async def mfa_confirmar(dados: RequisicaoMfaConfirmar, request: Request):
    endereco_ip = obter_endereco_ip(request)
    agente_do_usuario = obter_agente_do_usuario(request)

    pool = await iniciar_pool_de_conexoes()
    async with pool.acquire() as conexao:
        desafio = await validar_desafio_aberto(conexao, dados.mfa_desafio)
        if desafio["tipo_desafio"] != "SETUP":
            raise HTTPException(status_code=400, detail="Desafio MFA nÃƒÂ£o ÃƒÂ© de setup.")

        if not desafio["mfa_segredo_temporario_enc"]:
            raise HTTPException(status_code=400, detail="Setup MFA nÃƒÂ£o iniciado. Gere o QR primeiro.")

        identificador_usuario = str(desafio["identificador_usuario"])

        # pega ÃƒÂºltimo timecode do usuÃƒÂ¡rio
        u = await conexao.fetchrow(
            f"""
            SELECT matricula, nome_completo, correio_eletronico,
                   mfa_ultimo_timecode
              FROM {ESQUEMA_BANCO}.usuario
             WHERE identificador_usuario = $1
            """,
            identificador_usuario
        )
        if not u:
            raise HTTPException(status_code=401, detail="UsuÃƒÂ¡rio invÃƒÂ¡lido.")

        segredo = segredo_do_banco(desafio["mfa_segredo_temporario_enc"])
        ok, tc = verificar_codigo_totp(segredo, dados.codigo, u["mfa_ultimo_timecode"])

        if not ok:
            await incrementar_tentativas(conexao, dados.mfa_desafio)
            raise HTTPException(status_code=401, detail="CÃƒÂ³digo MFA invÃƒÂ¡lido.")

        # salva segredo definitivo no usuÃƒÂ¡rio
        segredo_def_enc = segredo_para_banco(segredo)

        await conexao.execute(
            f"""
            UPDATE {ESQUEMA_BANCO}.usuario
               SET indicador_mfa_habilitado = TRUE,
                   mfa_totp_segredo_enc = $2,
                   mfa_totp_confirmado_em = NOW(),
                   mfa_ultimo_timecode = $3
             WHERE identificador_usuario = $1
            """,
            identificador_usuario,
            segredo_def_enc,
            int(tc)
        )

        await marcar_desafio_usado(conexao, dados.mfa_desafio)

        await registrar_evento(
            conexao, "MFA_SETUP_CONFIRMADO", identificador_usuario, None,
            "MFA confirmado e habilitado.", {}, endereco_ip, agente_do_usuario
        )

        # loga de fato agora (usa dados do desafio)
        retorno = await criar_sessao_e_tokens(
            conexao,
            identificador_usuario=identificador_usuario,
            matricula=u["matricula"],
            nome_completo=u["nome_completo"],
            correio_eletronico=u["correio_eletronico"],
            endereco_ip=desafio["endereco_ip"] or endereco_ip,
            agente_do_usuario=desafio["agente_do_usuario"] or agente_do_usuario,
            idioma=desafio["idioma"] or "pt-BR",
            fuso_horario_informado=desafio["fuso_horario_informado"],
            cabecalhos=dict(desafio["cabecalhos_http"] or {})
        )
        return retorno


# =========================
# MFA - verificar (2Ã‚Âª etapa do login)
# =========================
@rotas_de_entrada.post("/mfa/verificar", response_model=RespostaEntrada)
async def mfa_verificar(dados: RequisicaoMfaVerificar, request: Request):
    endereco_ip = obter_endereco_ip(request)
    agente_do_usuario = obter_agente_do_usuario(request)

    pool = await iniciar_pool_de_conexoes()
    async with pool.acquire() as conexao:
        desafio = await validar_desafio_aberto(conexao, dados.mfa_desafio)
        if desafio["tipo_desafio"] != "LOGIN":
            raise HTTPException(status_code=400, detail="Desafio MFA nÃƒÂ£o ÃƒÂ© de login.")

        identificador_usuario = str(desafio["identificador_usuario"])

        u = await conexao.fetchrow(
            f"""
            SELECT matricula, nome_completo, correio_eletronico,
                   indicador_mfa_habilitado, mfa_totp_segredo_enc, mfa_ultimo_timecode
              FROM {ESQUEMA_BANCO}.usuario
             WHERE identificador_usuario = $1
            """,
            identificador_usuario
        )
        if not u:
            raise HTTPException(status_code=401, detail="UsuÃƒÂ¡rio invÃƒÂ¡lido.")

        if not u["indicador_mfa_habilitado"] or not u["mfa_totp_segredo_enc"]:
            raise HTTPException(status_code=403, detail="MFA nÃƒÂ£o estÃƒÂ¡ habilitado para este usuÃƒÂ¡rio.")

        segredo = segredo_do_banco(u["mfa_totp_segredo_enc"])
        ok, tc = verificar_codigo_totp(segredo, dados.codigo, u["mfa_ultimo_timecode"])

        if not ok:
            await incrementar_tentativas(conexao, dados.mfa_desafio)
            await registrar_evento(conexao, "MFA_FALHA", identificador_usuario, None,
                                   "CÃƒÂ³digo MFA invÃƒÂ¡lido.", {}, endereco_ip, agente_do_usuario)
            raise HTTPException(status_code=401, detail="CÃƒÂ³digo MFA invÃƒÂ¡lido.")

        # atualiza timecode (anti-replay) e finaliza desafio
        await conexao.execute(
            f"""
            UPDATE {ESQUEMA_BANCO}.usuario
               SET mfa_ultimo_timecode = $2
             WHERE identificador_usuario = $1
            """,
            identificador_usuario,
            int(tc)
        )

        await marcar_desafio_usado(conexao, dados.mfa_desafio)

        await registrar_evento(conexao, "MFA_OK", identificador_usuario, None,
                               "MFA validado com sucesso.", {}, endereco_ip, agente_do_usuario)

        retorno = await criar_sessao_e_tokens(
            conexao,
            identificador_usuario=identificador_usuario,
            matricula=u["matricula"],
            nome_completo=u["nome_completo"],
            correio_eletronico=u["correio_eletronico"],
            endereco_ip=desafio["endereco_ip"] or endereco_ip,
            agente_do_usuario=desafio["agente_do_usuario"] or agente_do_usuario,
            idioma=desafio["idioma"] or "pt-BR",
            fuso_horario_informado=dados.fuso_horario_informado or desafio["fuso_horario_informado"],
            cabecalhos=dict(desafio["cabecalhos_http"] or {})
        )
        return retorno


# =========================
# MFA - desativar (logado)
# =========================
@rotas_de_entrada.post("/mfa/desativar")
async def mfa_desativar(dados: RequisicaoMfaDesativar, request: Request, usuario=Depends(obter_usuario_autenticado)):
    endereco_ip = obter_endereco_ip(request)
    agente_do_usuario = obter_agente_do_usuario(request)
    cabecalhos = obter_cabecalhos(request)

    identificador_usuario = usuario["identificador_usuario"]

    pool = await iniciar_pool_de_conexoes()
    async with pool.acquire() as conexao:
        u = await conexao.fetchrow(
            f"""
            SELECT senha_hash, indicador_mfa_habilitado, mfa_totp_segredo_enc, mfa_ultimo_timecode
              FROM {ESQUEMA_BANCO}.usuario
             WHERE identificador_usuario = $1
            """,
            identificador_usuario
        )
        if not u:
            raise HTTPException(status_code=401, detail="UsuÃƒÂ¡rio invÃƒÂ¡lido.")

        if not validar_senha(dados.senha_atual, u["senha_hash"]):
            raise HTTPException(status_code=401, detail="Senha atual invÃƒÂ¡lida.")

        if not u["indicador_mfa_habilitado"] or not u["mfa_totp_segredo_enc"]:
            return {"mensagem": "MFA jÃƒÂ¡ estÃƒÂ¡ desativado."}

        segredo = segredo_do_banco(u["mfa_totp_segredo_enc"])
        ok, tc = verificar_codigo_totp(segredo, dados.codigo_mfa, u["mfa_ultimo_timecode"])
        if not ok:
            raise HTTPException(status_code=401, detail="CÃƒÂ³digo MFA invÃƒÂ¡lido.")

        await conexao.execute(
            f"""
            UPDATE {ESQUEMA_BANCO}.usuario
               SET indicador_mfa_habilitado = FALSE,
                   mfa_totp_segredo_enc = NULL,
                   mfa_totp_confirmado_em = NULL,
                   mfa_ultimo_timecode = $2
             WHERE identificador_usuario = $1
            """,
            identificador_usuario,
            int(tc)
        )

        await registrar_evento(conexao, "MFA_DESATIVADO", identificador_usuario, usuario["identificador_sessao"],
                               "MFA desativado pelo usuÃƒÂ¡rio.", {}, endereco_ip, agente_do_usuario)

    return {"mensagem": "MFA desativado com sucesso."}


# =========================
# ATUALIZAR CREDENCIAL (igual ao seu)
# =========================
@rotas_de_entrada.post("/atualizar-credencial")
async def atualizar_credencial(dados: RequisicaoAtualizarCredencial, request: Request):
    from datetime import timedelta

    endereco_ip = obter_endereco_ip(request)
    agente_do_usuario = obter_agente_do_usuario(request)
    cabecalhos = obter_cabecalhos(request)

    token_hash = gerar_hash_token(dados.token_de_renovacao)

    pool = await iniciar_pool_de_conexoes()
    async with pool.acquire() as conexao:
        cred = await conexao.fetchrow(
            f"""
            SELECT cr.identificador_credencial, cr.identificador_sessao, cr.data_hora_expiracao, cr.data_hora_revogacao,
                   s.identificador_usuario, s.situacao_sessao
              FROM {ESQUEMA_BANCO}.credencial_de_renovacao cr
              JOIN {ESQUEMA_BANCO}.sessao s ON s.identificador_sessao = cr.identificador_sessao
             WHERE cr.hash_token = $1
            """,
            token_hash
        )
        if not cred:
            await registrar_evento(conexao, "RENOVACAO_FALHA", None, None, "Credencial invÃƒÂ¡lida.", {},
                                   endereco_ip, agente_do_usuario)
            raise HTTPException(status_code=401, detail="Token de renovaÃƒÂ§ÃƒÂ£o invÃƒÂ¡lido.")

        if cred["data_hora_revogacao"] is not None:
            await registrar_evento(conexao, "RENOVACAO_FALHA", str(cred["identificador_usuario"]),
                                   str(cred["identificador_sessao"]), "Credencial revogada.", {},
                                   endereco_ip, agente_do_usuario)
            raise HTTPException(status_code=401, detail="Token de renovaÃƒÂ§ÃƒÂ£o revogado.")

        if cred["data_hora_expiracao"] <= agora_utc():
            await registrar_evento(conexao, "RENOVACAO_FALHA", str(cred["identificador_usuario"]),
                                   str(cred["identificador_sessao"]), "Credencial expirada.", {},
                                   endereco_ip, agente_do_usuario)
            raise HTTPException(status_code=401, detail="Token de renovaÃƒÂ§ÃƒÂ£o expirado.")

        if cred["situacao_sessao"] != "ATIVA":
            await registrar_evento(conexao, "RENOVACAO_FALHA", str(cred["identificador_usuario"]),
                                   str(cred["identificador_sessao"]), "SessÃƒÂ£o nÃƒÂ£o ativa.", {},
                                   endereco_ip, agente_do_usuario)
            raise HTTPException(status_code=401, detail="SessÃƒÂ£o encerrada.")

        novo_token = gerar_token_de_renovacao()
        novo_hash = gerar_hash_token(novo_token)
        expira = agora_utc() + timedelta(hours=HORAS_CREDENCIAL_RENOVACAO)

        novo_id = await conexao.fetchval(
            f"""
            INSERT INTO {ESQUEMA_BANCO}.credencial_de_renovacao
            (identificador_sessao, hash_token, data_hora_expiracao, endereco_ip, agente_do_usuario, cabecalhos_http)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            RETURNING identificador_credencial
            """,
            str(cred["identificador_sessao"]),
            novo_hash,
            expira,
            endereco_ip,
            agente_do_usuario,
            json.dumps(cabecalhos)
        )

        await conexao.execute(
            f"""
            UPDATE {ESQUEMA_BANCO}.credencial_de_renovacao
               SET data_hora_revogacao = NOW(),
                   identificador_substituida_por = $2
             WHERE identificador_credencial = $1
            """,
            str(cred["identificador_credencial"]),
            str(novo_id)
        )

        token_acesso = gerar_token_de_acesso(str(cred["identificador_usuario"]), str(cred["identificador_sessao"]))

        await registrar_evento(
            conexao, "RENOVACAO_SUCESSO",
            str(cred["identificador_usuario"]), str(cred["identificador_sessao"]),
            "Credencial renovada com sucesso.", {"expira_renovacao": str(expira)},
            endereco_ip, agente_do_usuario
        )

    return {
        "token_de_acesso": token_acesso["token"],
        "token_de_renovacao": novo_token,
        "expira_em_segundos": token_acesso["expira_em_segundos"],
    }


@rotas_de_entrada.post("/saida")
async def saida(dados: RequisicaoSaida, request: Request, usuario=Depends(obter_usuario_autenticado)):
    endereco_ip = obter_endereco_ip(request)
    agente_do_usuario = obter_agente_do_usuario(request)

    identificador_usuario = usuario["identificador_usuario"]
    identificador_sessao = usuario["identificador_sessao"]

    pool = await iniciar_pool_de_conexoes()
    async with pool.acquire() as conexao:
        await conexao.execute(
            f"""
            UPDATE {ESQUEMA_BANCO}.sessao
               SET situacao_sessao = 'ENCERRADA',
                   data_hora_encerramento = NOW(),
                   motivo_encerramento = 'SAIDA_SOLICITADA'
             WHERE identificador_sessao = $1
            """,
            identificador_sessao
        )

        await conexao.execute(
            f"""
            UPDATE {ESQUEMA_BANCO}.credencial_de_renovacao
               SET data_hora_revogacao = NOW()
             WHERE identificador_sessao = $1
               AND data_hora_revogacao IS NULL
            """,
            identificador_sessao
        )

        await registrar_evento(
            conexao, "SAIDA",
            identificador_usuario, identificador_sessao,
            "SaÃƒÂ­da realizada.", {},
            endereco_ip, agente_do_usuario
        )

    return {"mensagem": "SaÃƒÂ­da realizada com sucesso."}

