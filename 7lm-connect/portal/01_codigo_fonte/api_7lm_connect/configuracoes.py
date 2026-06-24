"""
Configuracoes centrais da API.
Mantem compatibilidade com variaveis antigas SEVENLM_CONNECT_* e aceita aliases SEVENLM_CONNECT_*.
"""

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None


BASE = Path(__file__).resolve().parent
POSSIVEIS_ENVS = [BASE / ".env"]
POSSIVEIS_ENVS.extend(pai / ".env" for pai in BASE.parents[:4])

ENV_CARREGADO = None
if load_dotenv:
    for caminho in POSSIVEIS_ENVS:
        if caminho.exists():
            load_dotenv(dotenv_path=caminho)
            ENV_CARREGADO = str(caminho)
            break

print(f"[configurações] .env carregado: {ENV_CARREGADO if ENV_CARREGADO else 'NENHUM (vars do sistema)'}")


def _env_text(*nomes: str, padrao: str = "") -> str:
    for nome in nomes:
        valor = os.getenv(nome)
        if valor is None:
            continue
        texto = str(valor).strip()
        if texto:
            return texto
    return padrao


def _env_int(*nomes: str, padrao: int) -> int:
    valor = _env_text(*nomes, padrao=str(padrao))
    return int(valor)


def _env_float(*nomes: str, padrao: float) -> float:
    valor = _env_text(*nomes, padrao=str(padrao))
    return float(valor)


def _env_bool(*nomes: str, padrao: bool = False) -> bool:
    for nome in nomes:
        valor = os.getenv(nome)
        if valor is None:
            continue
        texto = str(valor).strip().lower()
        if not texto:
            continue
        return texto in ("1", "true", "yes", "y", "on", "sim")
    return padrao


def _env_lista(*nomes: str, padrao: str = "") -> tuple[str, ...]:
    bruto = _env_text(*nomes, padrao=padrao)
    if not bruto:
        return tuple()

    itens: list[str] = []
    vistos: set[str] = set()
    for bloco in str(bruto).replace(";", ",").split(","):
        for parte in bloco.split():
            texto = str(parte).strip()
            if not texto or texto in vistos:
                continue
            vistos.add(texto)
            itens.append(texto)
    return tuple(itens)


NOME_BANCO = _env_text("SEVENLM_CONNECT_DBNAME", "SEVENLM_CONNECT_DBNAME", padrao="db_7lm_connect")
USUARIO_BANCO = _env_text("SEVENLM_CONNECT_DBUSER", "SEVENLM_CONNECT_DBUSER", padrao="usr_7lm_connect")
SENHA_BANCO = _env_text("SEVENLM_CONNECT_DBPASS", "SEVENLM_CONNECT_DBPASS", padrao="")
SERVIDOR_BANCO = _env_text("SEVENLM_CONNECT_DBHOST", "SEVENLM_CONNECT_DBHOST", padrao="127.0.0.1")
PORTA_BANCO = _env_int("SEVENLM_CONNECT_DBPORT", "SEVENLM_CONNECT_DBPORT", padrao=5432)
ESQUEMA_BANCO = _env_text("SEVENLM_CONNECT_SCHEMA", "SEVENLM_CONNECT_SCHEMA", padrao="sevenlm_connect")
ESQUEMA_SYSTEM = _env_text(
    "SEVENLM_CONNECT_SYSTEM_SCHEMA",
    "SEVENLM_CONNECT_SCHEMA_SYSTEM",
    padrao="system",
)
ESQUEMA_RECRUTAMENTO_SELECAO = _env_text(
    "SEVENLM_CONNECT_RECRUTAMENTO_SELECAO_SCHEMA",
    "SEVENLM_CONNECT_SCHEMA_RECRUTAMENTO_SELECAO",
    padrao="recrutamento_selecao",
)
ESQUEMA_COMERCIAL = _env_text(
    "SEVENLM_CONNECT_COMERCIAL_SCHEMA",
    "SEVENLM_CONNECT_SCHEMA_COMERCIAL",
    padrao="connect_comercial",
)
ESQUEMA_FINANCEIRO = _env_text(
    "SEVENLM_CONNECT_FINANCEIRO_SCHEMA",
    "SEVENLM_CONNECT_SCHEMA_FINANCEIRO",
    padrao="connect_financeiro",
)
ESQUEMA_MAQ_CREDITO = _env_text(
    "SEVENLM_CONNECT_MAQ_CREDITO_SCHEMA",
    "SEVENLM_CONNECT_SCHEMA_MAQ_CREDITO",
    padrao="maq_credito",
)
ESQUEMA_COMISSIONAMENTO = _env_text(
    "SEVENLM_CONNECT_COMISSIONAMENTO_SCHEMA",
    "SEVENLM_CONNECT_SCHEMA_COMISSIONAMENTO",
    padrao="comissionamento",
)

COMISSIONAMENTO_EMAIL_PROVIDER = _env_text(
    "COMISSIONAMENTO_EMAIL_PROVIDER",
    "SEVENLM_CONNECT_COMISSIONAMENTO_EMAIL_PROVIDER",
    padrao="fake",
)
COMISSIONAMENTO_EMAIL_SEND_ENABLED = _env_bool(
    "COMISSIONAMENTO_EMAIL_SEND_ENABLED",
    "SEVENLM_CONNECT_COMISSIONAMENTO_EMAIL_SEND_ENABLED",
    padrao=False,
)
COMISSIONAMENTO_EMAIL_MODE = _env_text(
    "COMISSIONAMENTO_EMAIL_MODE",
    "SEVENLM_CONNECT_COMISSIONAMENTO_EMAIL_MODE",
    padrao="dry_run",
)
COMISSIONAMENTO_EMAIL_ALLOWLIST = _env_lista(
    "COMISSIONAMENTO_EMAIL_ALLOWLIST",
    "SEVENLM_CONNECT_COMISSIONAMENTO_EMAIL_ALLOWLIST",
    padrao="hudson.porto@7lm.com.br,automacaoprocessos@7lm.com.br,inovacao@7lm.com.br",
)
COMISSIONAMENTO_EMAIL_REDIRECT_TO = _env_text(
    "COMISSIONAMENTO_EMAIL_REDIRECT_TO",
    "SEVENLM_CONNECT_COMISSIONAMENTO_EMAIL_REDIRECT_TO",
    padrao="hudson.porto@7lm.com.br,fernanda.oliveira@7lm.com.br",
)
COMISSIONAMENTO_EMAIL_FROM = _env_text(
    "COMISSIONAMENTO_EMAIL_FROM",
    "SEVENLM_CONNECT_COMISSIONAMENTO_EMAIL_FROM",
    padrao="inovacao@7lm.com.br",
)
COMISSIONAMENTO_EMAIL_REPLY_TO = _env_text(
    "COMISSIONAMENTO_EMAIL_REPLY_TO",
    "SEVENLM_CONNECT_COMISSIONAMENTO_EMAIL_REPLY_TO",
    padrao=COMISSIONAMENTO_EMAIL_FROM,
)
MS_GRAPH_SENDMAIL_USER = _env_text(
    "MS_GRAPH_SENDMAIL_USER",
    "SEVENLM_CONNECT_MS_GRAPH_SENDMAIL_USER",
    padrao="inovacao@7lm.com.br",
)
MS_GRAPH_TIMEOUT_SECONDS = _env_int(
    "MS_GRAPH_TIMEOUT_SECONDS",
    "SEVENLM_CONNECT_MS_GRAPH_TIMEOUT_SECONDS",
    padrao=15,
)
MS_GRAPH_MAX_RETRIES = _env_int(
    "MS_GRAPH_MAX_RETRIES",
    "SEVENLM_CONNECT_MS_GRAPH_MAX_RETRIES",
    padrao=3,
)

CHAVE_TOKEN_ACESSO = _env_text(
    "SEVENLM_CONNECT_CHAVE_TOKEN_ACESSO",
    "SEVENLM_CONNECT_CHAVE_TOKEN_ACESSO",
    padrao="trocar_esta_chave_em_producao",
)
ALGORITMO_TOKEN = _env_text("SEVENLM_CONNECT_ALGORITMO_TOKEN", "SEVENLM_CONNECT_ALGORITMO_TOKEN", padrao="HS256")
MINUTOS_TOKEN_ACESSO = _env_int(
    "SEVENLM_CONNECT_MINUTOS_TOKEN_ACESSO",
    "SEVENLM_CONNECT_MINUTOS_TOKEN_ACESSO",
    padrao=480,
)

HORAS_CREDENCIAL_RENOVACAO = _env_int(
    "SEVENLM_CONNECT_HORAS_TOKEN_RENOVACAO",
    "SEVENLM_CONNECT_HORAS_TOKEN_RENOVACAO",
    padrao=72,
)

SENHA_PADRAO_USUARIO = _env_text(
    "SEVENLM_CONNECT_SENHA_PADRAO_USUARIO",
    "SEVENLM_CONNECT_SENHA_PADRAO_ACESSO",
    padrao="7lm@2026",
)

MAXIMO_FALHAS_CONSECUTIVAS = _env_int(
    "SEVENLM_CONNECT_MAX_TENTATIVAS_FALHAS",
    "SEVENLM_CONNECT_MAX_TENTATIVAS_FALHAS",
    padrao=8,
)
MINUTOS_BLOQUEIO = _env_int(
    "SEVENLM_CONNECT_MINUTOS_BLOQUEIO",
    "SEVENLM_CONNECT_MINUTOS_BLOQUEIO",
    padrao=30,
)

TAMANHO_MAXIMO_FILA_REGISTROS = _env_int(
    "SEVENLM_CONNECT_TAMANHO_MAXIMO_FILA_REGISTROS",
    "SEVENLM_CONNECT_TAMANHO_MAXIMO_FILA_REGISTROS",
    padrao=5000,
)
TAMANHO_LOTE_REGISTROS = _env_int(
    "SEVENLM_CONNECT_TAMANHO_LOTE_REGISTROS",
    "SEVENLM_CONNECT_TAMANHO_LOTE_REGISTROS",
    padrao=50,
)
SEGUNDOS_PARA_FLUSH = _env_float(
    "SEVENLM_CONNECT_SEGUNDOS_PARA_FLUSH",
    "SEVENLM_CONNECT_SEGUNDOS_PARA_FLUSH",
    padrao=2.0,
)
REGISTRAR_TODOS_CABECALHOS = _env_bool(
    "SEVENLM_CONNECT_REGISTRAR_TODOS_CABECALHOS",
    "SEVENLM_CONNECT_REGISTRAR_TODOS_CABECALHOS",
    padrao=True,
)
AUDITORIA_SALVAR_CORPO_REQUISICAO = _env_bool(
    "SEVENLM_CONNECT_AUDITORIA_SALVAR_CORPO_REQUISICAO",
    "SEVENLM_CONNECT_AUDITORIA_SALVAR_CORPO_REQUISICAO",
    padrao=True,
)
AUDITORIA_CORPO_MAX_BYTES = _env_int(
    "SEVENLM_CONNECT_AUDITORIA_CORPO_MAX_BYTES",
    "SEVENLM_CONNECT_AUDITORIA_CORPO_MAX_BYTES",
    padrao=262144,
)

POOL_MINIMO = _env_int("SEVENLM_CONNECT_POOL_MINIMO", "SEVENLM_CONNECT_POOL_MINIMO", padrao=2)
POOL_MAXIMO = _env_int("SEVENLM_CONNECT_POOL_MAXIMO", "SEVENLM_CONNECT_POOL_MAXIMO", padrao=20)

SERVIDOR_HOST = _env_text("SEVENLM_CONNECT_API_HOST", "SEVENLM_CONNECT_API_HOST", padrao="0.0.0.0")
SERVIDOR_PORTA = _env_int("SEVENLM_CONNECT_API_PORTA", "SEVENLM_CONNECT_API_PORTA", padrao=8000)


def _padrao_trabalhadores() -> int:
    return 1 if os.name == "nt" else 4


SERVIDOR_TRABALHADORES = _env_int(
    "SEVENLM_CONNECT_API_TRABALHADORES",
    "SEVENLM_CONNECT_API_TRABALHADORES",
    padrao=_padrao_trabalhadores(),
)

CORS_ORIGENS_PERMITIDAS = _env_lista(
    "SEVENLM_CONNECT_CORS_ORIGENS",
    "SEVENLM_CONNECT_API_CORS_ORIGENS",
    padrao="http://127.0.0.1:3000,http://localhost:3000,https://maquinadevendas7lm.app.br",
)

ENTRA_BRIDGE_SECRET = _env_text(
    "SEVENLM_CONNECT_ENTRA_BRIDGE_SECRET",
    "SEVENLM_CONNECT_ENTRA_BRIDGE_SECRET",
)

MFA_OBRIGATORIO = _env_bool(
    "SEVENLM_CONNECT_MFA_OBRIGATORIO",
    "SEVENLM_CONNECT_MFA_OBRIGATORIO",
    padrao=True,
)
MFA_ISSUER = _env_text("SEVENLM_CONNECT_MFA_ISSUER", "SEVENLM_CONNECT_MFA_ISSUER", padrao="7LM")
MFA_DESAFIO_MINUTOS = _env_int(
    "SEVENLM_CONNECT_MFA_DESAFIO_MINUTOS",
    "SEVENLM_CONNECT_MFA_DESAFIO_MINUTOS",
    padrao=10,
)
MFA_MAX_TENTATIVAS = _env_int(
    "SEVENLM_CONNECT_MFA_MAX_TENTATIVAS",
    "SEVENLM_CONNECT_MFA_MAX_TENTATIVAS",
    padrao=5,
)

DIRETORIO_PUBLICO = Path(
    _env_text(
        "SEVENLM_CONNECT_DIRETORIO_PUBLICO",
        "SEVENLM_CONNECT_DIRETORIO_PUBLICO",
        padrao=str(BASE.parents[1] / "02_publico"),
    )
).resolve()

IMOVEIS_UPLOADS_DIRETORIO = Path(
    _env_text(
        "SEVENLM_CONNECT_IMOVEIS_UPLOADS_DIR",
        "SEVENLM_CONNECT_IMOVEIS_UPLOADS_DIR",
        padrao=str(DIRETORIO_PUBLICO / "uploads" / "imoveis"),
    )
).resolve()

IMOVEIS_UPLOADS_URL_BASE = _env_text(
    "SEVENLM_CONNECT_IMOVEIS_UPLOADS_URL_BASE",
    "SEVENLM_CONNECT_IMOVEIS_UPLOADS_URL_BASE",
    padrao="/uploads/imoveis",
)

CLIENTES_UPLOADS_DIRETORIO = Path(
    _env_text(
        "SEVENLM_CONNECT_CLIENTES_UPLOADS_DIR",
        "SEVENLM_CONNECT_CLIENTES_UPLOADS_DIR",
        padrao=str(DIRETORIO_PUBLICO / "uploads" / "clientes"),
    )
).resolve()

CLIENTES_UPLOADS_URL_BASE = _env_text(
    "SEVENLM_CONNECT_CLIENTES_UPLOADS_URL_BASE",
    "SEVENLM_CONNECT_CLIENTES_UPLOADS_URL_BASE",
    padrao="/uploads/clientes",
)

MAQ_CREDITO_UPLOADS_DIRETORIO = Path(
    _env_text(
        "SEVENLM_CONNECT_MAQ_CREDITO_UPLOADS_DIR",
        "SEVENLM_CONNECT_MAQCREDITO_UPLOADS_DIR",
        padrao=str(DIRETORIO_PUBLICO / "uploads" / "maq_credito" / "processos"),
    )
).resolve()

MAQ_CREDITO_UPLOADS_URL_BASE = _env_text(
    "SEVENLM_CONNECT_MAQ_CREDITO_UPLOADS_URL_BASE",
    "SEVENLM_CONNECT_MAQCREDITO_UPLOADS_URL_BASE",
    padrao="/uploads/maq_credito/processos",
)

CLIENTES_TAMANHO_MAXIMO_FOTO_MB = _env_int(
    "SEVENLM_CONNECT_CLIENTES_TAMANHO_MAXIMO_FOTO_MB",
    "SEVENLM_CONNECT_CLIENTES_TAMANHO_MAXIMO_FOTO_MB",
    padrao=10,
)

CLIENTES_TAMANHO_MAXIMO_DOCUMENTO_MB = _env_int(
    "SEVENLM_CONNECT_CLIENTES_TAMANHO_MAXIMO_DOCUMENTO_MB",
    "SEVENLM_CONNECT_CLIENTES_TAMANHO_MAXIMO_DOCUMENTO_MB",
    padrao=20,
)

CLIENTES_TOTAL_MAXIMO_DOCUMENTOS_POR_ENVIO = _env_int(
    "SEVENLM_CONNECT_CLIENTES_TOTAL_MAXIMO_DOCUMENTOS_POR_ENVIO",
    "SEVENLM_CONNECT_CLIENTES_TOTAL_MAXIMO_DOCUMENTOS_POR_ENVIO",
    padrao=12,
)

IMOVEIS_TAMANHO_MAXIMO_IMAGEM_MB = _env_int(
    "SEVENLM_CONNECT_IMOVEIS_TAMANHO_MAXIMO_IMAGEM_MB",
    "SEVENLM_CONNECT_IMOVEIS_TAMANHO_MAXIMO_IMAGEM_MB",
    padrao=15,
)

IMOVEIS_TAMANHO_MAXIMO_VIDEO_MB = _env_int(
    "SEVENLM_CONNECT_IMOVEIS_TAMANHO_MAXIMO_VIDEO_MB",
    "SEVENLM_CONNECT_IMOVEIS_TAMANHO_MAXIMO_VIDEO_MB",
    padrao=120,
)

IMOVEIS_TOTAL_MAXIMO_ARQUIVOS_POR_ENVIO = _env_int(
    "SEVENLM_CONNECT_IMOVEIS_TOTAL_MAXIMO_ARQUIVOS_POR_ENVIO",
    "SEVENLM_CONNECT_IMOVEIS_TOTAL_MAXIMO_ARQUIVOS_POR_ENVIO",
    padrao=20,
)

IMOVEIS_IMPORTACAO_TAMANHO_MAXIMO_PLANILHA_MB = _env_int(
    "SEVENLM_CONNECT_IMOVEIS_IMPORTACAO_TAMANHO_MAXIMO_PLANILHA_MB",
    "SEVENLM_CONNECT_IMOVEIS_IMPORTACAO_TAMANHO_MAXIMO_PLANILHA_MB",
    padrao=15,
)
