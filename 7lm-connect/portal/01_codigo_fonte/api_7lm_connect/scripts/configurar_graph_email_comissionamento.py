"""
Configura Microsoft Graph para e-mails do Comissionamento sem imprimir segredo.

Uso recomendado:
  /opt/7lm-connect/portal/.venv/bin/python \
    /opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect/scripts/configurar_graph_email_comissionamento.py \
    --enable-send --restart-api
"""

from __future__ import annotations

import argparse
import getpass
import subprocess
from pathlib import Path


PORTAL_ROOT = Path("/opt/7lm-connect/portal")
ENV_PATH = PORTAL_ROOT / ".env"

DEFAULTS = {
    "MS_GRAPH_TENANT_ID": "65d94465-e0c0-422c-bd51-6eff1e60fe3e",
    "MS_GRAPH_CLIENT_ID": "d5402394-6129-4db0-b0b6-8bb07d62cdae",
    "MS_GRAPH_SENDMAIL_USER": "inovacao@7lm.com.br",
    "COMISSIONAMENTO_EMAIL_PROVIDER": "microsoft_graph",
    "COMISSIONAMENTO_EMAIL_MODE": "teste_allowlist",
    "COMISSIONAMENTO_EMAIL_ALLOWLIST": "hudson.porto@7lm.com.br,automacaoprocessos@7lm.com.br,inovacao@7lm.com.br",
    "COMISSIONAMENTO_EMAIL_FROM": "inovacao@7lm.com.br",
    "COMISSIONAMENTO_EMAIL_REPLY_TO": "inovacao@7lm.com.br",
    "MS_GRAPH_TIMEOUT_SECONDS": "15",
    "MS_GRAPH_MAX_RETRIES": "3",
}


def atualizar_env(valores: dict[str, str]) -> None:
    linhas = ENV_PATH.read_text(encoding="utf-8").splitlines() if ENV_PATH.exists() else []
    restantes = dict(valores)
    saida: list[str] = []

    for linha in linhas:
        if "=" in linha and not linha.lstrip().startswith("#"):
            chave = linha.split("=", 1)[0].strip()
            if chave in restantes:
                saida.append(f"{chave}={restantes.pop(chave)}")
                continue
        saida.append(linha)

    if restantes:
        if saida and saida[-1].strip():
            saida.append("")
        saida.append("# Microsoft Graph - Comissionamento")
        for chave, valor in restantes.items():
            saida.append(f"{chave}={valor}")

    ENV_PATH.write_text("\n".join(saida) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Configura Graph SendMail do Comissionamento.")
    parser.add_argument("--enable-send", action="store_true", help="Liga COMISSIONAMENTO_EMAIL_SEND_ENABLED=true.")
    parser.add_argument("--restart-api", action="store_true", help="Reinicia 7lm-connect-api.service apos gravar .env.")
    parser.add_argument("--secret", default=None, help="Nao recomendado: informe o secret por argumento somente em automacao segura.")
    args = parser.parse_args()

    segredo = args.secret or getpass.getpass("MS_GRAPH_CLIENT_SECRET (nao sera exibido): ").strip()
    if not segredo:
        raise SystemExit("Secret vazio. Configuracao cancelada.")

    valores = {
        **DEFAULTS,
        "MS_GRAPH_CLIENT_SECRET": segredo,
        "COMISSIONAMENTO_EMAIL_SEND_ENABLED": "true" if args.enable_send else "false",
    }
    atualizar_env(valores)
    print("Configuracao Graph gravada no EnvironmentFile oficial.")

    if args.restart_api:
        subprocess.run(["systemctl", "restart", "7lm-connect-api.service"], check=True)
        subprocess.run(["systemctl", "is-active", "7lm-connect-api.service"], check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
