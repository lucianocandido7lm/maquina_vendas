"""
Autor: Willian Elias Franca
Projeto: 7LM Connect - Plataforma Integrada
Observação: arquivos em português, com nomes descritivos.
"""


import asyncio
import json
import time
import uuid
import hashlib
from urllib.parse import parse_qsl
from typing import Dict, Any, Optional, List

from configuracoes import (
    AUDITORIA_CORPO_MAX_BYTES,
    AUDITORIA_SALVAR_CORPO_REQUISICAO,
    ESQUEMA_SYSTEM,
    TAMANHO_MAXIMO_FILA_REGISTROS,
    TAMANHO_LOTE_REGISTROS,
    SEGUNDOS_PARA_FLUSH,
)

fila_registros: Optional[asyncio.Queue] = None
tarefa_consumidora: Optional[asyncio.Task] = None
VALOR_REDIGIDO = "[REDACTED]"
CHAVES_SENSIVEIS = (
    "authorization",
    "cookie",
    "senha",
    "password",
    "token",
    "secret",
    "segredo",
    "mfa",
    "otp",
    "totp",
    "codigo",
    "código",
    "client_secret",
)

def novo_identificador_requisicao() -> str:
    return str(uuid.uuid4())

def calcular_hash_corpo(corpo: bytes) -> str:
    return hashlib.sha256(corpo).hexdigest()

def _chave_sensivel(chave: Any) -> bool:
    texto = str(chave or "").strip().lower()
    return any(item in texto for item in CHAVES_SENSIVEIS)

def _redigir_valor(valor: Any) -> Any:
    if isinstance(valor, dict):
        return {
            str(chave): VALOR_REDIGIDO if _chave_sensivel(chave) else _redigir_valor(item)
            for chave, item in valor.items()
        }
    if isinstance(valor, list):
        return [_redigir_valor(item) for item in valor]
    return valor

def _redigir_texto_formulario(texto: str) -> str:
    pares = parse_qsl(texto, keep_blank_values=True)
    if not pares:
        return texto
    partes = []
    for chave, valor in pares:
        partes.append(f"{chave}={VALOR_REDIGIDO if _chave_sensivel(chave) else valor}")
    return "&".join(partes)

def preparar_corpo_requisicao_para_auditoria(
    corpo: bytes,
    content_type: str = "",
    *,
    sensivel: bool = False,
) -> Dict[str, Any]:
    tamanho = len(corpo or b"")
    retorno: Dict[str, Any] = {
        "corpo_requisicao_json": None,
        "corpo_requisicao_texto": None,
        "corpo_requisicao_redigido": False,
        "motivo_redacao_corpo": None,
    }
    if not AUDITORIA_SALVAR_CORPO_REQUISICAO or not corpo:
        return retorno

    tipo = str(content_type or "").lower()
    if sensivel:
        retorno["corpo_requisicao_redigido"] = True
        retorno["motivo_redacao_corpo"] = "rota_sensivel"
        return retorno
    if "multipart/form-data" in tipo:
        retorno["corpo_requisicao_redigido"] = True
        retorno["motivo_redacao_corpo"] = "multipart_omitido"
        return retorno
    if tamanho > AUDITORIA_CORPO_MAX_BYTES:
        corpo = corpo[:AUDITORIA_CORPO_MAX_BYTES]
        retorno["corpo_requisicao_redigido"] = True
        retorno["motivo_redacao_corpo"] = "corpo_truncado"

    texto = corpo.decode("utf-8", errors="replace")
    if "application/json" in tipo or texto.strip().startswith(("{", "[")):
        try:
            dados_json = json.loads(texto)
            retorno["corpo_requisicao_json"] = _redigir_valor(dados_json)
            if retorno["corpo_requisicao_json"] != dados_json:
                retorno["corpo_requisicao_redigido"] = True
                retorno["motivo_redacao_corpo"] = retorno["motivo_redacao_corpo"] or "campos_sensiveis"
            return retorno
        except Exception:
            pass

    if "application/x-www-form-urlencoded" in tipo:
        texto_redigido = _redigir_texto_formulario(texto)
        if texto_redigido != texto:
            retorno["corpo_requisicao_redigido"] = True
            retorno["motivo_redacao_corpo"] = retorno["motivo_redacao_corpo"] or "campos_sensiveis"
        retorno["corpo_requisicao_texto"] = texto_redigido
        return retorno

    if tipo.startswith("text/") or "xml" in tipo or "csv" in tipo:
        retorno["corpo_requisicao_texto"] = texto
    else:
        retorno["corpo_requisicao_redigido"] = True
        retorno["motivo_redacao_corpo"] = retorno["motivo_redacao_corpo"] or "tipo_nao_textual_omitido"
    return retorno

async def registrar_evento(
    conexao,
    tipo_evento: str,
    identificador_usuario: Optional[str],
    identificador_sessao: Optional[str],
    descricao: Optional[str],
    detalhes: Optional[Dict[str, Any]],
    endereco_ip: str,
    agente_do_usuario: str
) -> None:
    await conexao.execute(
        f"""
        INSERT INTO {ESQUEMA_SYSTEM}.auditoria_evento
        (identificador_usuario, identificador_sessao, tipo_evento, descricao_evento, detalhes_evento, endereco_ip, agente_do_usuario)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
        """,
        identificador_usuario, identificador_sessao, tipo_evento, descricao, json.dumps(detalhes or {}),
        endereco_ip, agente_do_usuario
    )

async def registrar_tentativa_de_entrada(
    conexao,
    identificador_usuario: Optional[str],
    login_informado: str,
    sucesso: bool,
    motivo_falha: Optional[str],
    endereco_ip: str,
    agente_do_usuario: str,
    cabecalhos: Dict[str, Any]
) -> None:
    await conexao.execute(
        f"""
        INSERT INTO {ESQUEMA_SYSTEM}.tentativa_de_entrada
        (identificador_usuario, login_informado, indicador_sucesso, motivo_falha, endereco_ip, agente_do_usuario, cabecalhos_http)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        """,
        identificador_usuario, login_informado, sucesso, motivo_falha, endereco_ip, agente_do_usuario, json.dumps(cabecalhos)
    )

async def iniciar_fila_e_consumidor(pool_de_conexoes) -> None:
    global fila_registros, tarefa_consumidora
    fila_registros = asyncio.Queue(maxsize=TAMANHO_MAXIMO_FILA_REGISTROS)
    tarefa_consumidora = asyncio.create_task(_consumidor(pool_de_conexoes))

async def encerrar_consumidor() -> None:
    global tarefa_consumidora
    if tarefa_consumidora:
        tarefa_consumidora.cancel()
        tarefa_consumidora = None

async def enfileirar_registro_tecnico(registro: Dict[str, Any]) -> None:
    global fila_registros
    if not fila_registros:
        return
    try:
        fila_registros.put_nowait(registro)
    except asyncio.QueueFull:
        return

async def _consumidor(pool_de_conexoes) -> None:
    buffer: List[Dict[str, Any]] = []
    ultimo_flush = time.time()

    while True:
        try:
            item = await asyncio.wait_for(fila_registros.get(), timeout=SEGUNDOS_PARA_FLUSH)
            buffer.append(item)
        except asyncio.TimeoutError:
            pass

        agora = time.time()
        precisa_flush = (len(buffer) >= TAMANHO_LOTE_REGISTROS) or (buffer and (agora - ultimo_flush) >= SEGUNDOS_PARA_FLUSH)
        if not precisa_flush:
            continue

        lote = buffer
        buffer = []
        ultimo_flush = agora

        async with pool_de_conexoes.acquire() as conexao:
            await conexao.executemany(
                f"""
                INSERT INTO {ESQUEMA_SYSTEM}.registro_requisicao_http
                (identificador_requisicao, identificador_usuario, identificador_sessao,
                 metodo_http, caminho_http, consulta_http, codigo_resposta_http,
                 duracao_milisegundos, tamanho_resposta_bytes, endereco_ip,
                 agente_do_usuario, origem, referenciador, cabecalhos_http,
                 corpo_requisicao_hash, corpo_requisicao_tamanho,
                 corpo_requisicao_json, corpo_requisicao_texto,
                 corpo_requisicao_redigido, motivo_redacao_corpo)
                VALUES
                ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17::jsonb,$18,$19,$20)
                """,
                [
                    (
                        r.get("identificador_requisicao"),
                        r.get("identificador_usuario"),
                        r.get("identificador_sessao"),
                        r.get("metodo_http"),
                        r.get("caminho_http"),
                        r.get("consulta_http"),
                        r.get("codigo_resposta_http"),
                        r.get("duracao_milisegundos"),
                        r.get("tamanho_resposta_bytes"),
                        r.get("endereco_ip"),
                        r.get("agente_do_usuario"),
                        r.get("origem"),
                        r.get("referenciador"),
                        json.dumps(r.get("cabecalhos_http") or {}),
                        r.get("corpo_requisicao_hash"),
                        r.get("corpo_requisicao_tamanho"),
                        json.dumps(r.get("corpo_requisicao_json")) if r.get("corpo_requisicao_json") is not None else None,
                        r.get("corpo_requisicao_texto"),
                        bool(r.get("corpo_requisicao_redigido")),
                        r.get("motivo_redacao_corpo"),
                    )
                    for r in lote
                ]
            )
