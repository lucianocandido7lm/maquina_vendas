# Guia Geral Para Enviar E-mail Com Microsoft Graph

Data: 2026-06-15

Este guia explica como enviar e-mail usando Microsoft Graph SendMail com uma
App Registration do Azure Entra ID. Ele pode ser usado em qualquer sistema,
script, automacao, backend, job ou ferramenta interna. Nao depende do portal
7LM Connect nem do modulo de Comissionamento.

## Credenciais Atuais

Use estes dados quando quiser reaproveitar a configuracao atual:

| Campo | Valor |
| --- | --- |
| Tenant ID | `65d94465-e0c0-422c-bd51-6eff1e60fe3e` |
| Client ID | `d5402394-6129-4db0-b0b6-8bb07d62cdae` |
| Mailbox remetente | `inovacao@7lm.com.br` |
| From | `inovacao@7lm.com.br` |
| Reply-To sugerido | `inovacao@7lm.com.br` |
| Scope OAuth | `https://graph.microsoft.com/.default` |
| Token URL | `https://login.microsoftonline.com/65d94465-e0c0-422c-bd51-6eff1e60fe3e/oauth2/v2.0/token` |
| SendMail URL | `https://graph.microsoft.com/v1.0/users/inovacao@7lm.com.br/sendMail` |
| Permissao esperada no Azure | `Microsoft Graph > Application permissions > Mail.Send` |
| Secretsid | `Microsoft Graph > Application permissions > Mail.Send` |

O `client_secret` coloque o arquivo ms_graph_client_secret dentro do sistema:

```text
.../ms_graph_client_secret
```

Para qualquer outro sistema, copie o valor do secret somente para um cofre ou
variavel de ambiente segura do novo sistema. Nao cole o secret em codigo,
documentacao, planilhas, tickets ou mensagens.

## Como Funciona

O envio usa duas chamadas HTTP:

1. Obter um token OAuth2 temporario no Microsoft Identity Platform.
2. Chamar o Microsoft Graph `sendMail` usando o token recebido.

Fluxo:

```text
Seu sistema
  -> POST /oauth2/v2.0/token com tenant_id, client_id e client_secret
  -> recebe access_token temporario
  -> POST /users/inovacao@7lm.com.br/sendMail
  -> Microsoft Graph aceita o envio
  -> Exchange Online processa a entrega
```

O token nao e fixo. Ele deve ser gerado pelo sistema quando precisar enviar, ou
reutilizado apenas enquanto estiver valido.

## Variaveis Recomendadas

Configure o novo sistema com variaveis parecidas com estas:

```env
MS_GRAPH_TENANT_ID=65d94465-e0c0-422c-bd51-6eff1e60fe3e
MS_GRAPH_CLIENT_ID=d5402394-6129-4db0-b0b6-8bb07d62cdae
MS_GRAPH_CLIENT_SECRET=colocar_em_cofre_ou_variavel_segura
MS_GRAPH_SCOPE=https://graph.microsoft.com/.default
MS_GRAPH_SENDMAIL_USER=inovacao@7lm.com.br
MS_GRAPH_FROM=inovacao@7lm.com.br
MS_GRAPH_REPLY_TO=inovacao@7lm.com.br
MS_GRAPH_TIMEOUT_SECONDS=15
```

Se o sistema aceitar secret por arquivo:

```env
MS_GRAPH_CLIENT_SECRET_FILE=/caminho/seguro/ms_graph_client_secret
```

## Passo 1: Obter Token

Endpoint:

```text
POST https://login.microsoftonline.com/65d94465-e0c0-422c-bd51-6eff1e60fe3e/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded
```

Body:

```text
client_id=d5402394-6129-4db0-b0b6-8bb07d62cdae
client_secret={CLIENT_SECRET}
scope=https://graph.microsoft.com/.default
grant_type=client_credentials
```

Exemplo com `curl`:

```bash
ACCESS_TOKEN="$(
  curl -sS -X POST \
    "https://login.microsoftonline.com/65d94465-e0c0-422c-bd51-6eff1e60fe3e/oauth2/v2.0/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "client_id=d5402394-6129-4db0-b0b6-8bb07d62cdae" \
    --data-urlencode "client_secret=${MS_GRAPH_CLIENT_SECRET}" \
    --data-urlencode "scope=https://graph.microsoft.com/.default" \
    --data-urlencode "grant_type=client_credentials" \
  | jq -r '.access_token'
)"
```

Se retornar `null`, vazio ou erro, confira:

- secret correto e sem espacos extras;
- App Registration ativa;
- permissao `Mail.Send` concedida com admin consent;
- tenant ID correto;
- relogio do servidor sincronizado.

## Passo 2: Enviar E-mail

Endpoint:

```text
POST https://graph.microsoft.com/v1.0/users/inovacao@7lm.com.br/sendMail
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
```

Payload minimo:

```json
{
  "message": {
    "subject": "Teste Microsoft Graph",
    "body": {
      "contentType": "HTML",
      "content": "<p>Ola! Este e um teste de envio via Microsoft Graph.</p>"
    },
    "toRecipients": [
      {
        "emailAddress": {
          "address": "destinatario@exemplo.com",
          "name": "Destinatario"
        }
      }
    ],
    "replyTo": [
      {
        "emailAddress": {
          "address": "inovacao@7lm.com.br"
        }
      }
    ]
  },
  "saveToSentItems": true
}
```

Exemplo com `curl`:

```bash
curl -i -X POST \
  "https://graph.microsoft.com/v1.0/users/inovacao@7lm.com.br/sendMail" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "subject": "Teste Microsoft Graph",
      "body": {
        "contentType": "HTML",
        "content": "<p>Ola! Este e um teste de envio via Microsoft Graph.</p>"
      },
      "toRecipients": [
        {
          "emailAddress": {
            "address": "destinatario@exemplo.com",
            "name": "Destinatario"
          }
        }
      ],
      "replyTo": [
        {
          "emailAddress": {
            "address": "inovacao@7lm.com.br"
          }
        }
      ]
    },
    "saveToSentItems": true
  }'
```

Sucesso esperado:

```text
HTTP/1.1 202 Accepted
```

O status `202 Accepted` significa que o Graph aceitou a requisicao. A entrega
final ainda depende do Exchange Online, filtros, limites, throttling e validade
do destinatario.

## Exemplo Em Node.js

```js
async function obterTokenGraph() {
  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const resposta = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  const payload = await resposta.json();
  if (!resposta.ok || !payload.access_token) {
    throw new Error(`Falha ao obter token Graph: ${JSON.stringify(payload)}`);
  }
  return payload.access_token;
}

async function enviarEmail({ para, nome, assunto, html }) {
  const token = await obterTokenGraph();
  const sendmailUser = process.env.MS_GRAPH_SENDMAIL_USER || "inovacao@7lm.com.br";

  const resposta = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sendmailUser)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: assunto,
          body: { contentType: "HTML", content: html },
          toRecipients: [
            {
              emailAddress: {
                address: para,
                name: nome || para,
              },
            },
          ],
          replyTo: [
            {
              emailAddress: {
                address: process.env.MS_GRAPH_REPLY_TO || "inovacao@7lm.com.br",
              },
            },
          ],
        },
        saveToSentItems: true,
      }),
    }
  );

  if (resposta.status !== 202) {
    const erro = await resposta.text();
    throw new Error(`Falha ao enviar e-mail: HTTP ${resposta.status} ${erro}`);
  }
}

enviarEmail({
  para: "destinatario@exemplo.com",
  nome: "Destinatario",
  assunto: "Teste Microsoft Graph",
  html: "<p>Ola! Este e um teste.</p>",
});
```

## Exemplo Em Python

```python
import os
import requests


def obter_token_graph() -> str:
    tenant_id = os.environ["MS_GRAPH_TENANT_ID"]
    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    resposta = requests.post(
        url,
        data={
            "client_id": os.environ["MS_GRAPH_CLIENT_ID"],
            "client_secret": os.environ["MS_GRAPH_CLIENT_SECRET"],
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        },
        timeout=15,
    )
    payload = resposta.json()
    if resposta.status_code >= 400 or "access_token" not in payload:
        raise RuntimeError(f"Falha ao obter token Graph: {payload}")
    return payload["access_token"]


def enviar_email(para: str, assunto: str, html: str, nome: str | None = None) -> None:
    token = obter_token_graph()
    sendmail_user = os.getenv("MS_GRAPH_SENDMAIL_USER", "inovacao@7lm.com.br")
    url = f"https://graph.microsoft.com/v1.0/users/{sendmail_user}/sendMail"
    resposta = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={
            "message": {
                "subject": assunto,
                "body": {"contentType": "HTML", "content": html},
                "toRecipients": [
                    {
                        "emailAddress": {
                            "address": para,
                            "name": nome or para,
                        }
                    }
                ],
                "replyTo": [
                    {
                        "emailAddress": {
                            "address": os.getenv("MS_GRAPH_REPLY_TO", "inovacao@7lm.com.br")
                        }
                    }
                ],
            },
            "saveToSentItems": True,
        },
        timeout=15,
    )
    if resposta.status_code != 202:
        raise RuntimeError(f"Falha ao enviar e-mail: {resposta.status_code} {resposta.text}")


enviar_email(
    "destinatario@exemplo.com",
    "Teste Microsoft Graph",
    "<p>Ola! Este e um teste.</p>",
    "Destinatario",
)
```

## Envio Com CC, BCC E Headers

Exemplo de campos opcionais:

```json
{
  "message": {
    "subject": "Mensagem com copia",
    "body": {
      "contentType": "HTML",
      "content": "<p>Conteudo</p>"
    },
    "toRecipients": [
      { "emailAddress": { "address": "principal@exemplo.com" } }
    ],
    "ccRecipients": [
      { "emailAddress": { "address": "copia@exemplo.com" } }
    ],
    "bccRecipients": [
      { "emailAddress": { "address": "oculto@exemplo.com" } }
    ],
    "internetMessageHeaders": [
      { "name": "X-Sistema-Origem", "value": "meu-sistema" },
      { "name": "X-Correlation-Id", "value": "pedido-123" }
    ]
  },
  "saveToSentItems": true
}
```

## Envio Com Anexo

Anexo simples em base64:

```json
{
  "message": {
    "subject": "Mensagem com anexo",
    "body": {
      "contentType": "HTML",
      "content": "<p>Segue arquivo.</p>"
    },
    "toRecipients": [
      { "emailAddress": { "address": "destinatario@exemplo.com" } }
    ],
    "attachments": [
      {
        "@odata.type": "#microsoft.graph.fileAttachment",
        "name": "arquivo.txt",
        "contentType": "text/plain",
        "contentBytes": "Q29udGV1ZG8gZG8gYXJxdWl2bw=="
      }
    ]
  },
  "saveToSentItems": true
}
```

Para anexos grandes, prefira implementar controle especifico por tamanho e
testar limites do Exchange/Graph antes de usar em producao.

## Configuracao Necessaria No Azure

Checklist da App Registration:

- App Registration single tenant.
- Credencial ativa: client secret, certificado ou federated credential.
- Permissao Microsoft Graph `Mail.Send` do tipo Application.
- Admin consent concedido.
- Mailbox `inovacao@7lm.com.br` existente e licenciada no Microsoft 365.
- Restricao operacional para permitir envio somente pela mailbox desejada,
  quando aplicavel ao tenant.

## Erros Comuns

`401 Unauthorized`:

- token ausente, expirado ou enviado sem `Bearer`;
- token emitido para outro tenant;
- scope errado;
- secret invalido.

`403 Forbidden` ou `ErrorAccessDenied`:

- app sem permissao `Mail.Send`;
- admin consent nao concedido;
- policy do Exchange bloqueando a mailbox;
- tentativa de enviar por uma mailbox diferente da autorizada.

`404 Not Found`:

- mailbox inexistente;
- UPN/endereco digitado errado;
- usuario sem mailbox Exchange Online.

`429 Too Many Requests`:

- throttling do Graph/Exchange;
- reduza concorrencia;
- respeite `Retry-After` quando vier no header.

`202 Accepted`, mas destinatario nao recebeu:

- Graph aceitou, mas entrega final ainda depende do Exchange;
- conferir spam/quarentena;
- conferir validade do destinatario;
- conferir rastreamento de mensagem no Microsoft 365/Exchange.

## Boas Praticas Para Qualquer Sistema

- Gere token no backend, nunca no frontend publico.
- Guarde `client_secret` em cofre ou variavel segura.
- Nao logue token, secret, Authorization header ou payload sensivel.
- Use `X-Correlation-Id` para rastrear cada envio.
- Implemente retry apenas para erros transitorios como `429`, `500`, `502`,
  `503` e `504`.
- Nao faca disparo em massa pela mailbox sem validar limites e governanca.
- Use templates HTML simples e testados em Outlook.
- Mantenha uma fila local se o envio for importante para o negocio.
- Salve status `pendente`, `enviado_para_provider`, `falhou_retry` e
  `falhou_permanente`.

## Referencias Oficiais

- Microsoft Graph `user: sendMail`:
  `https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0`
- Microsoft Graph app-only access:
  `https://learn.microsoft.com/en-us/graph/auth-v2-service`
- OAuth2 client credentials no Microsoft Identity Platform:
  `https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow`
- Uso de `/.default` em client credentials:
  `https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc`
- Referencia de permissoes Microsoft Graph:
  `https://learn.microsoft.com/en-us/graph/permissions-reference`
