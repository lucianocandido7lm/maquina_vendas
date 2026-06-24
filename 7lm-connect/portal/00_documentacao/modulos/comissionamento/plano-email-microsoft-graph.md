# Plano Tecnico De E-mail Com Microsoft Graph SendMail

Data: 2026-06-11

## Objetivo

Definir a arquitetura tecnica para envio transacional de e-mails do
Comissionamento usando Microsoft Graph SendMail como provider inicial, com a
mailbox corporativa licenciada:

```text
inovacao@7lm.com.br
```

Este plano nao implementa envio real, migrations, secrets ou runtime novo. Ele
complementa `plano-notificacoes-e-mails.md` e respeita a rota oficial
`/comercial/comissionamento`.

## Decisao Recomendada

Usar Microsoft Graph SendMail inicialmente, com autenticacao de aplicacao
controlada pelo backend, fila e auditoria. O envio deve ficar desligado por
padrao e evoluir por fases:

1. provider `fake`/`dry_run`;
2. Microsoft Graph configurado, mas sem envio real;
3. envio real apenas para allowlist;
4. producao por evento/template.

Allowlist inicial de teste:

- `hudson.porto@7lm.com.br`
- `automacaoprocessos@7lm.com.br`
- `inovacao@7lm.com.br`

O contrato interno deve ser independente do provider para permitir troca futura
para Azure Communication Services Email sem refazer regras de negocio.

## Arquitetura De Envio

Fluxo canonico:

```text
Acao de negocio no Comissionamento
  -> backend FastAPI valida permissao e status
  -> backend grava comissionamento.eventos
  -> servico de notificacoes resolve regra e destinatarios
  -> template versionado e renderizado com mascaramento
  -> notificacao_fila_envio
  -> worker/tarefa interna processa fila
  -> provider microsoft_graph
  -> POST /users/inovacao@7lm.com.br/sendMail
  -> destinatario
  -> notificacao_logs e historico
```

Regras:

- frontend nunca chama Microsoft Graph;
- frontend nunca acessa banco direto;
- envio nasce no backend;
- toda mensagem tem `evento_negocio_id`, `correlation_id`, destinatario,
  template, status, provider e log;
- nenhum e-mail real e enviado sem flag explicita;
- NF e documentos sensiveis ficam como links autenticados do portal, nao como
  anexos no MVP.

## Provider Interno

Interface logica recomendada:

```text
EmailProvider.enviar(mensagem)
EmailProvider.validar_configuracao()
EmailProvider.normalizar_erro(resposta)
```

Campos minimos da mensagem:

- `correlation_id`
- `evento_id`
- `template_codigo`
- `template_versao`
- `remetente`
- `reply_to`
- `destinatarios_to`
- `destinatarios_cc`
- `destinatarios_bcc`
- `assunto`
- `corpo_html`
- `corpo_texto`
- `headers`
- `metadata`

Providers previstos:

- `fake`: nao envia, grava payload mascarado.
- `microsoft_graph`: usa Graph SendMail com `inovacao@7lm.com.br`.
- `azure_communication_services`: futuro provider para e-mail transacional.

## Microsoft Graph SendMail

Endpoint alvo:

```text
POST https://graph.microsoft.com/v1.0/users/inovacao@7lm.com.br/sendMail
```

Payload recomendado no MVP:

- JSON, nao MIME, para reduzir complexidade inicial.
- `saveToSentItems`: `true` no inicio para auditoria operacional da mailbox,
  salvo decisao futura de volume.
- `message.subject`: assunto renderizado.
- `message.body.contentType`: `HTML`.
- `message.body.content`: HTML renderizado e sanitizado.
- `message.toRecipients`: destinatarios resolvidos pelo backend.
- `message.ccRecipients`/`bccRecipients`: somente quando regra permitir.
- `message.internetMessageHeaders`: incluir `X-7LM-Correlation-Id`,
  `X-7LM-Evento-Id` e `X-7LM-Template`.

Nao usar anexos no MVP para NF, pacote ou documentos sensiveis. Usar link
autenticado do portal com permissao validada no backend.

## App Registration No Azure Entra ID

Criar App Registration dedicada, por exemplo:

```text
7lm-connect-comissionamento-email
```

Configuracao recomendada:

- single tenant;
- sem redirect URI publica para o fluxo application;
- credencial de producao por certificado ou federated credential quando
  disponivel;
- client secret apenas se o mecanismo oficial de segredo do projeto exigir, com
  rotacao e nunca em codigo;
- permissao Microsoft Graph `Mail.Send` do tipo Application;
- admin consent concedido por administrador autorizado;
- restricao para a mailbox `inovacao@7lm.com.br` via mecanismo do Exchange
  Online aplicavel ao tenant.

Permissao recomendada:

```text
Microsoft Graph -> Application permissions -> Mail.Send
```

Motivo:

- o envio e backend-to-backend;
- nao depende de usuario interativo logado;
- o remetente tecnico e a mailbox corporativa oficial.

Alternativa delegated:

- Usar `Mail.Send` delegated somente se o negocio decidir que o envio deve
  ocorrer em nome de um usuario interativo e com sessao delegada.
- Nao e a recomendacao para fila, retentativa e lembretes automaticos, porque o
  envio precisa continuar sem usuario conectado.

## Restricao A Mailbox Especifica

Risco padrao:

- `Mail.Send` application pode ser amplo demais se nao houver restricao
  operacional no Exchange Online.

Controle recomendado:

- restringir a aplicacao para enviar apenas pela mailbox
  `inovacao@7lm.com.br`, usando Application RBAC for Exchange Online ou
  Application Access Policy legado, conforme padrao suportado pelo tenant;
- validar com teste negativo: tentar enviar por outra mailbox deve falhar;
- documentar grupo/escopo aplicado, responsavel e data de revisao.

## Variaveis De Ambiente

Nomes sugeridos, sem valores reais no codigo:

```text
COMISSIONAMENTO_EMAIL_PROVIDER=fake
COMISSIONAMENTO_EMAIL_SEND_ENABLED=false
COMISSIONAMENTO_EMAIL_MODE=dry_run
COMISSIONAMENTO_EMAIL_ALLOWLIST=
COMISSIONAMENTO_EMAIL_FROM=inovacao@7lm.com.br
COMISSIONAMENTO_EMAIL_REPLY_TO=inovacao@7lm.com.br

MS_GRAPH_TENANT_ID_REF=
MS_GRAPH_CLIENT_ID_REF=
MS_GRAPH_CLIENT_SECRET_REF=
MS_GRAPH_CERT_PATH_REF=
MS_GRAPH_TENANT_ID=
MS_GRAPH_CLIENT_ID=
MS_GRAPH_CLIENT_SECRET=
MS_GRAPH_SCOPE=https://graph.microsoft.com/.default
MS_GRAPH_SENDMAIL_USER=inovacao@7lm.com.br
MS_GRAPH_TIMEOUT_SECONDS=15
MS_GRAPH_MAX_RETRIES=3
```

Regras:

- valores sensiveis ficam em variaveis de ambiente, Key Vault ou mecanismo
  oficial ja usado pelo projeto;
- `*_REF` aponta para o local do segredo, nao para o segredo em si quando houver
  cofre; no MVP tecnico, `*_REF` tambem pode apontar para outra variavel de
  ambiente carregada pelo systemd;
- `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID` e `MS_GRAPH_CLIENT_SECRET` sao
  aceitos diretamente quando o segredo for gerenciado pelo EnvironmentFile
  oficial e nunca deve ser exibido em logs;
- `.env`, secrets e certificados nao entram em documentacao nem repositorio;
- logs devem mascarar tokens, client secret, tenant sensivel e payload pessoal.

## Flags De Seguranca

Envio real exige todas as condicoes:

- provider ativo diferente de `fake`;
- `COMISSIONAMENTO_EMAIL_SEND_ENABLED=true`;
- modo `teste_allowlist` ou `producao`;
- template ativo e publicado;
- evento/template liberado para envio real;
- destinatario dentro da allowlist quando em teste;
- evento de negocio e destinatario com idempotencia valida.

Fallback imediato:

- alterar provider para `fake` ou modo `dry_run`;
- pausar processamento da fila;
- cancelar itens pendentes por provider/template/evento;
- registrar evento operacional de rollback.

## Limites Operacionais

O Graph retorna `202 Accepted` quando aceita a solicitacao, mas isso nao garante
entrega final ao destinatario. O sistema deve tratar o status como
`enviado_para_provider` ate haver confirmacao operacional disponivel.

Cuidados:

- respeitar throttling do Microsoft Graph e `Retry-After`;
- limitar concorrencia por mailbox;
- aplicar backoff exponencial com jitter;
- manter maximo de tentativas configuravel;
- nao usar Exchange Online como ferramenta de disparo em massa;
- consolidar resumos diarios quando houver muitas pendencias;
- monitorar limites de destinatarios e tamanho de mensagem do Exchange Online;
- guardar payload mascarado para retentativa sem reconsultar dados sensiveis
  desnecessariamente.

Estados da fila:

- `pendente`
- `em_processamento`
- `enviado_para_provider`
- `falhou_retry`
- `falhou_permanente`
- `cancelado`
- `ignorado_idempotencia`

## Tratamento De Erros

Erros transitorios:

- `429` throttling;
- `503` indisponibilidade;
- timeout de rede;
- falha temporaria do Exchange/Graph.

Acao:

- registrar log;
- respeitar `Retry-After` quando presente;
- reagendar tentativa;
- alertar Secretaria/Admin apenas depois de politica de ruido definida.

Erros permanentes:

- destinatario invalido;
- mailbox remetente nao autorizada;
- app sem permissao;
- payload invalido;
- template sem variavel obrigatoria.

Acao:

- marcar `falhou_permanente`;
- gerar `erro_integracao_email`;
- expor em historico;
- permitir reenvio manual apenas apos correcao.

## Privacidade E Conteudo

Regras para e-mail:

- comissionado recebe apenas dados proprios;
- gestor/coordenador nao recebe dados individuais de vinculados por e-mail sem
  autorizacao explicita;
- valores para comissionado devem ficar no portal por padrao;
- Financeiro/RH podem receber valores apenas em pacote autorizado e protegido;
- NF, memoria completa e documentos sensiveis devem ser link autenticado;
- links devem exigir sessao no portal e permissao backend;
- mascarar documento, dados bancarios, telefone e identificadores sensiveis
  quando nao forem necessarios ao objetivo do e-mail.

## Endpoints Relacionados

Sem implementar nesta fase:

- `POST /api/comissionamento/notificacoes/preview`
- `GET /api/comissionamento/notificacoes/historico`
- `POST /api/comissionamento/notificacoes/{notificacao_id}/reenviar`
- `POST /api/comissionamento/notificacoes/manual`
- `POST /api/comissionamento/notificacoes/processar-fila`
- `POST /api/comissionamento/notificacoes/testar-provider`
- `GET /api/comissionamento/notificacoes/templates`
- `POST /api/comissionamento/notificacoes/templates`
- `PUT /api/comissionamento/notificacoes/templates/{template_id}`
- `GET /api/comissionamento/notificacoes/regras`
- `PUT /api/comissionamento/notificacoes/regras`

## Teste Seguro Do Provider

Modo `dry_run`:

- valida se configuracao obrigatoria existe;
- monta token request sem exibir segredo;
- nao chama SendMail real;
- renderiza payload mascarado;
- grava log tecnico.

Modo `teste_allowlist`:

- exige `COMISSIONAMENTO_EMAIL_SEND_ENABLED=true`;
- exige destinatario dentro de `COMISSIONAMENTO_EMAIL_ALLOWLIST`;
- usa template de teste sem valor, NF ou dados sensiveis;
- grava evento e fila reais;
- registra resposta do Graph mascarada.

Teste negativo obrigatorio:

- envio por mailbox diferente de `inovacao@7lm.com.br` deve falhar;
- destinatario fora da allowlist deve ser bloqueado antes do provider;
- CLT nao pode acionar template de NF;
- PJ/autonomo sem NF validada nao pode gerar pacote Financeiro.

## Estrategia Futura Para Azure Communication Services Email

Motivo para manter como alternativa:

- ACS Email e mais adequado para e-mails transacionais dedicados quando o volume
  ou governanca nao devem depender de uma mailbox de usuario.

Requisitos futuros:

- recurso Azure Communication Services;
- dominio verificado;
- sender address autorizado;
- credencial gerenciada por Key Vault/identidade gerenciada quando possivel;
- provider interno implementando a mesma interface de envio;
- migracao gradual por evento/template.

Contrato que nao deve mudar:

- evento de negocio;
- destinatarios;
- template;
- fila;
- logs;
- idempotencia;
- permissoes;
- privacidade.

## Criterios De Aceite Do Provider Graph

- nenhum envio real ocorre com `COMISSIONAMENTO_EMAIL_SEND_ENABLED=false`;
- todo envio usa `inovacao@7lm.com.br` como mailbox inicial;
- app registration tem apenas permissao necessaria para envio;
- escopo da aplicacao e restrito a mailbox autorizada quando aplicavel;
- segredo/certificado nao aparece em codigo, log ou documentacao;
- falha do Graph gera log, retentativa e alerta;
- `202 Accepted` nao e tratado como entrega final garantida;
- provider pode ser trocado para ACS sem alterar regras de negocio;
- teste seguro valida configuracao sem disparar e-mail real por padrao.

## Pendencias

- confirmar responsavel administrativo do Entra ID e Exchange Online;
- confirmar se sera usado certificado, federated credential ou client secret;
- confirmar mecanismo oficial de segredo em producao;
- confirmar politica de retention da mailbox `inovacao@7lm.com.br`;
- confirmar allowlist inicial de teste;
- confirmar dominio e sender futuros caso ACS Email seja adotado.
