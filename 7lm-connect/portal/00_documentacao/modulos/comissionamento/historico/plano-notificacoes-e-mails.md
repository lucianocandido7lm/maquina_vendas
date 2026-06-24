# Plano De Notificacoes E E-mails Do Comissionamento

Data: 2026-06-11

## Objetivo

Definir o fluxo completo de notificacoes, e-mails, lembretes, auditoria,
permissoes e contratos de backend do modulo de Comissionamento da Maquina de
Vendas no 7LM Connect.

O provider inicial recomendado para envio real, quando a arquitetura for
validada, e Microsoft Graph SendMail usando a mailbox corporativa licenciada
`inovacao@7lm.com.br`. O desenho deve manter provider plugavel para permitir
troca futura para Azure Communication Services Email sem alterar as regras de
negocio do Comissionamento.

Decisao final do MVP de implementacao:

- o escopo operacional de e-mail para nesta rodada em
  `pacote_pagamento_enviado`;
- `pagamento_concluido`, baixa, conciliacao e ERP ficam fora desta etapa;
- Financeiro/RH recebem pacote consolidado por ciclo, nao e-mail individual por
  comissionado;
- Secretaria e Admin configuram templates, prazos, provider e reenvios;
- a allowlist inicial de teste e `hudson.porto@7lm.com.br`,
  `automacaoprocessos@7lm.com.br` e `inovacao@7lm.com.br`;
- nenhum valor de comissionado aparece no corpo do e-mail no MVP.

Este plano complementa:

- `fluxo-aprovacao-nf-financeiro.md`
- `esteira-auditoria-notificacoes.md`
- `frontend-historico-config-nf.md`
- `backlog-orquestrador.md`

Nao cria aplicacao separada, nao usa runtime em `/root/data-engineering` e nao
substitui a rota oficial `/comercial/comissionamento`.

## Enquadramento Do Orquestrador

Resumo da demanda:

Desenhar o plano canonico de e-mails, notificacoes internas, alertas,
lembretes, auditoria, endpoints e modelo de dados do Comissionamento.

Objetivo de negocio:

Garantir que cada pessoa receba a comunicacao correta no ciclo mensal, sem
duplicidade, com rastreabilidade e bloqueios coerentes para NF, RH, Financeiro
e pagamento.

Usuarios impactados:

- Secretaria de Vendas.
- Head Comercial.
- Comissionado CLT.
- Comissionado PJ/autonomo.
- Gestor/Coordenador autonomo.
- Financeiro.
- RH.
- Administrador/Auditoria.

Regra de negocio:

- CLT nao envia NF e segue para pacote RH/Financeiro.
- PJ/autonomo envia NF antes do Financeiro.
- Gestor/Coordenador autonomo envia NF propria e pode ver vinculados somente
  com permissao oficial.
- Secretaria e dona operacional do fluxo.
- Head aprova antes de NF ou pacote.
- Historico deve registrar eventos de negocio e eventos de notificacao.

Dados necessarios:

- ciclo, resultado, comissionado, perfil de fluxo, status atual, valores,
  prazos, documentos, destinatarios, vinculos hierarquicos, templates, logs e
  eventos de negocio.

Fonte dos dados:

- API FastAPI do 7LM Connect e banco oficial via backend.
- Excel apenas como seed/referencia de regra, nunca runtime definitivo.

Arquivos provaveis:

- `01_codigo_fonte/api_7lm_connect/rotas/rotas_de_comissionamento.py`
- `01_codigo_fonte/api_7lm_connect/servicos/`
- `01_codigo_fonte/api_7lm_connect/repositorios/`
- `01_codigo_fonte/api_7lm_connect/modelos/`
- `05_modulos/comissionamento`
- `Servidor/migracao_YYYYMMDD_descricao.sql`, quando chegar a etapa de
  implementation.

Permissoes:

- `view.own` para comissionado.
- `view.linked` para gestor/coordenador com vinculo oficial.
- `view.all.commissioning` para Secretaria/Admin.
- Permissao especifica para disparo manual, reenvio, templates e regras de
  escalonamento.

Endpoints:

Listados na secao "9. Endpoints E Backend Propostos".

Tabelas:

Listadas na secao "10. Modelo De Dados Sugerido".

Fluxo de aprovacao:

Calculo -> revisao Secretaria -> envio Head -> aprovacao/rejeicao Head ->
roteamento CLT ou PJ/autonomo -> NF quando aplicavel -> pacote -> pagamento.

Fluxo de notificacao:

Evento de negocio persistido -> regra de notificacao -> destinatarios
autorizados -> template versionado -> fila de envio -> log de entrega ->
historico/auditoria.

Criterios de aceite:

Listados na secao "Criterios De Aceite Do MVP De Notificacoes".

Agentes acionados:

- Orquestrador do Comissionamento.
- Backend/API, para contratos e futuro servico de notificacao.
- Seguranca/Permissoes, para privacidade, escopo de visibilidade e auditoria.
- QA/Auditoria, para casos de teste e idempotencia.
- DevOps/systemd, futuramente, se houver worker/timer de fila e lembretes.

Riscos:

Listados na secao "13. Riscos E Decisoes Pendentes".

Pendencias de decisao:

Listadas na secao "13. Riscos E Decisoes Pendentes".

## Resumo Executivo Para Validacao

Decisao tecnica recomendada:

- Manter todo disparo no backend FastAPI do 7LM Connect, sempre a partir de
  evento de negocio persistido ou acao manual auditavel.
- Criar camada interna de notificacoes com fila, templates versionados,
  destinatarios autorizados, logs, retentativas e providers configuraveis.
- Comecar com `fake`/`dry-run` para validar matriz, templates, auditoria e
  idempotencia antes de qualquer envio real.
- Preparar Microsoft Graph SendMail como provider inicial controlado pela
  mailbox `inovacao@7lm.com.br`, sem secrets em codigo e com ativacao por flag.
- Nao anexar NF ou documentos sensiveis no MVP; e-mails devem apontar para link
  autenticado no portal.
- Parar o fluxo de comunicacao desta rodada em pacote consolidado enviado ao
  Financeiro/RH; pagamento concluido sera tratado em fase futura com ERP.

Arquivos de documentacao impactados nesta etapa:

- `00_documentacao/modulos/comissionamento/plano-notificacoes-e-mails.md`
- `00_documentacao/modulos/comissionamento/plano-email-microsoft-graph.md`

Tabelas propostas, sem migration nesta fase:

- `notificacoes`
- `notificacao_destinatarios`
- `notificacao_templates`
- `notificacao_eventos`
- `notificacao_fila_envio`
- `notificacao_logs`
- `notificacao_preferencias`
- `notificacao_regras_escalonamento`
- `notificacao_providers`

Endpoints propostos, sem implementacao nesta fase:

- listar notificacoes do usuario;
- marcar notificacao como lida;
- consultar historico de envios;
- reenviar e-mail;
- disparar e-mail manual pela Secretaria;
- preview de template;
- configurar templates;
- configurar prazos e lembretes;
- processar fila de envio por tarefa interna;
- testar provider Microsoft Graph em modo seguro.

Riscos principais:

- permissao `Mail.Send` application sem restricao adequada pode permitir envio
  por mailboxes indevidas;
- envio real antes de allowlist, preview e logs pode gerar comunicacao errada;
- e-mail com valor, NF ou dados de terceiros aumenta risco de vazamento;
- falta de idempotencia pode duplicar e-mails, lembretes e pacotes;
- limites do Exchange/Graph exigem fila, backoff e monitoramento.

Pendencias de negocio:

- confirmar politica de valor no corpo do e-mail;
- confirmar destinatarios oficiais de Financeiro, RH, Secretaria e Head por
  ciclo;
- confirmar SLA de Head, NF, validacao de NF e pacote;
- confirmar se pagamento concluido gera e-mail ao comissionado ou somente
  notificacao interna;
- confirmar quem pode disparar comunicacao manual alem da Secretaria.

Plano por fase:

- Fase 1: documentacao, matriz de eventos, destinatarios e templates.
- Fase 2: modelo de dados e migrations, ainda sem envio real.
- Fase 3: servico interno com provider `fake`/`dry-run`.
- Fase 4: integracao Microsoft Graph em ambiente controlado com
  `inovacao@7lm.com.br`.
- Fase 5: envio real somente para allowlist de teste.
- Fase 6: ativacao em producao por evento/template, com auditoria e rollback.

## Premissas De Arquitetura

- O backend e a fonte de verdade de status, permissoes, destinatarios,
  templates e auditoria.
- O frontend apenas exibe notificacoes, proximas acoes e botoes permitidos pela
  API.
- Todo disparo nasce de evento de negocio persistido ou de acao manual
  auditavel.
- Todo e-mail deve ter historico de envio e chave de correlacao com evento de
  negocio.
- Eventos automaticos devem ser idempotentes por ciclo, resultado, tipo de
  evento, destinatario e canal.
- Valores, documentos e dados de terceiros so devem aparecer quando a permissao
  permitir.
- Excel e seed/referencia, nao runtime definitivo.

## Ciclo Mensal Coberto

```text
Ciclo criado/importado/calculado
  -> Secretaria revisa
  -> Secretaria solicita ajuste ou envia para Head Comercial
  -> Head aprova ou solicita revisao
  -> Se CLT: pacote RH/Financeiro, sem NF
  -> Se PJ/autonomo: solicitacao de NF
  -> Comissionado envia NF
  -> Secretaria valida ou rejeita NF
  -> Comissao pronta para Financeiro
  -> Secretaria envia pacote de pagamento
  -> Financeiro processa pagamento
  -> Sistema registra pagamento/conclusao
```

## 1. Mapa De Eventos

### Eventos De Ciclo E Calculo

| Evento canonico | Quando ocorre | Canais padrao | Observacao |
| --- | --- | --- | --- |
| `ciclo_criado` | ciclo mensal criado, importado ou aberto para simulacao | interna, auditoria | visivel para Secretaria e Admin |
| `calculo_iniciado` | motor/importador inicia calculo ou preview | auditoria | silencioso, salvo para rastreio |
| `calculo_concluido` | resultados calculados ficam disponiveis | interna, dashboard | abre fila de revisao da Secretaria |
| `calculo_com_erro` | motor/importador falha ou dados obrigatorios ausentes | interna, dashboard, auditoria | alerta Secretaria/Admin |
| `revisao_secretaria_pendente` | resultados entram em revisao | interna, dashboard | pendencia operacional da Secretaria |

### Eventos De Revisao E Aprovacao

| Evento canonico | Quando ocorre | Canais padrao | Observacao |
| --- | --- | --- | --- |
| `ajuste_solicitado` | Secretaria ou Head pede revisao de valor/regra | interna, e-mail se responsavel externo ao fluxo diario | exige motivo |
| `ajuste_aplicado` | ajuste manual ou reprocessamento corrige resultado | interna, auditoria | deve registrar antes/depois |
| `enviado_para_head` | Secretaria envia resultado para Head Comercial | interna, e-mail, dashboard | cria pendencia para Head |
| `aprovado_head` | Head aprova resultado | interna, dashboard | roteia por perfil de fluxo |
| `rejeitado_head` | Head rejeita resultado | interna, e-mail opcional, dashboard | exige motivo e retorna para Secretaria |
| `aprovacao_head_pendente_sem_movimento` | pendencia de Head sem acao no prazo configurado | lembrete, dashboard | escalona para Secretaria/Admin conforme regra |

### Eventos De NF

| Evento canonico | Quando ocorre | Canais padrao | Observacao |
| --- | --- | --- | --- |
| `nf_solicitada` | PJ/autonomo aprovado entra em `aguardando_nf` ou Secretaria aciona solicitacao | e-mail, interna, dashboard | nunca dispara para CLT |
| `prazo_nf_proximo` | prazo de NF se aproxima | lembrete, dashboard | para comissionado e Secretaria |
| `prazo_nf_vencido` | prazo de NF vence sem envio | lembrete, dashboard, auditoria | bloqueia prontidao de pagamento |
| `nf_enviada` | comissionado envia arquivo de NF | interna, dashboard, auditoria | notifica Secretaria |
| `nf_validada` | Secretaria valida NF | interna, e-mail opcional | libera pacote Financeiro |
| `nf_rejeitada` | Secretaria rejeita NF | e-mail, interna, dashboard | exige `motivo_rejeicao` |
| `nf_reenviada` | comissionado envia nova versao apos rejeicao | interna, dashboard, auditoria | preserva versoes anteriores |

### Eventos De Pacote E Pagamento

| Evento canonico | Quando ocorre | Canais padrao | Observacao |
| --- | --- | --- | --- |
| `pronta_para_envio_pagamento` | CLT aprovado ou PJ/autonomo com NF validada | interna, dashboard | agrupa na fila do ciclo |
| `pacote_pagamento_preparado` | Secretaria gera pacote consolidado | interna, auditoria | pode ter destino Financeiro ou RH/Financeiro |
| `pacote_pagamento_enviado` | Secretaria envia pacote | e-mail, interna, auditoria | registra destinatarios e protocolo |
| `pagamento_processado` | Financeiro informa processamento | interna, dashboard | status intermediario |
| `pagamento_concluido` | futuro evento vindo do ERP/baixa interna | fora do MVP atual | nao acionar e-mail nesta rodada |
| `pagamento_rejeitado_ou_devolvido` | Financeiro aponta problema no pagamento | interna, e-mail, dashboard | exige motivo |

### Eventos Transversais

| Evento canonico | Quando ocorre | Canais padrao | Observacao |
| --- | --- | --- | --- |
| `pendencia_sem_movimento` | qualquer pendencia passa do SLA configurado | lembrete, dashboard | regra por etapa |
| `resumo_diario_pendencias` | fechamento diario de pendencias | e-mail resumo, dashboard | Secretaria/Head/Admin |
| `resumo_semanal_ciclo` | fechamento semanal do ciclo | e-mail resumo | Secretaria, Head, Admin |
| `erro_integracao_email` | provedor SMTP/API falha | interna, dashboard, auditoria | nao deve perder payload |
| `erro_integracao_financeiro` | falha em envio, retorno ou conciliacao financeira | interna, dashboard, auditoria | bloqueia conclusao automatica |
| `notificacao_manual_disparada` | Secretaria reenvia ou manda comunicacao avulsa | conforme template | exige permissao e comentario |
| `notificacao_reenviada` | reenvio operacional apos falha ou solicitacao | conforme template | mantem vinculo com evento original |

## 2. Matriz De Destinatarios

Legenda:

- `E`: recebe e-mail.
- `I`: recebe notificacao interna.
- `D`: ve alerta no dashboard.
- `A`: apenas auditoria/silencioso.
- `-`: nao deve receber.
- `Proprio`: comissionado ve apenas sua comissao.
- `Vinculados`: gestor/coordenador ve apenas pessoas vinculadas autorizadas.

| Evento | Secretaria | Head Comercial | Comissionado CLT | Comissionado PJ/autonomo | Gestor/Coordenador | Financeiro | RH | Admin/Auditoria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ciclo_criado` | I,D | - | - | - | - | - | - | A |
| `calculo_concluido` | I,D | - | - | - | - | - | - | A |
| `calculo_com_erro` | I,D,E | - | - | - | - | - | - | I,A |
| `revisao_secretaria_pendente` | I,D | - | - | - | - | - | - | A |
| `ajuste_solicitado` | I,D,E | I,D se solicitante Head | - | - | I apenas vinculados se impactado | - | - | A |
| `enviado_para_head` | I,D | E,I,D | - | - | - | - | - | A |
| `aprovado_head` | I,D | I | I opcional Proprio | I opcional Proprio | I opcional Proprio/Vinculados | - | - | A |
| `rejeitado_head` | I,D,E | I | - | - | - | - | - | A |
| `nf_solicitada` | I,D | - | - | E,I,D Proprio | E,I,D Proprio/Vinculados quando responsavel por NF propria | - | - | A |
| `prazo_nf_proximo` | I,D resumo | - | - | E,I,D Proprio | E/I Proprio; D Vinculados autorizados | - | - | A |
| `prazo_nf_vencido` | E,I,D | - | - | E,I,D Proprio | E/I Proprio; D Vinculados autorizados | - | - | A |
| `nf_enviada` | E,I,D | - | - | I Proprio | I Proprio/Vinculados autorizados | - | - | A |
| `nf_validada` | I,D | - | - | I ou E Proprio | I Proprio/Vinculados autorizados | - | - | A |
| `nf_rejeitada` | I,D | - | - | E,I,D Proprio | E/I Proprio/Vinculados autorizados | - | - | A |
| `pronta_para_envio_pagamento` | I,D | - | I opcional Proprio | I opcional Proprio | I opcional Vinculados | - | - | A |
| `pacote_pagamento_preparado` | I,D | - | - | - | - | - | - | A |
| `pacote_pagamento_enviado` | I,D | I opcional resumo | - | - | - | E se destino PJ | E se destino CLT | A |
| `pagamento_processado` | I,D | - | I opcional Proprio | I opcional Proprio | I opcional Vinculados | I | I se CLT | A |
| `pagamento_concluido` | futuro ERP | - | - | - | - | - | - | A |
| `pendencia_sem_movimento` | E,I,D | E/I se pendencia dele | - | E/I se acao dele | I/D Vinculados autorizados | - | - | A |
| `erro_integracao_email` | I,D | - | - | - | - | - | - | I,A |
| `erro_integracao_financeiro` | E,I,D | - | - | - | - | E/I | E/I se CLT | I,A |

Regras negativas:

- CLT nunca recebe `nf_solicitada`, `prazo_nf_proximo`, `prazo_nf_vencido`,
  `nf_rejeitada` ou qualquer CTA de envio de NF.
- Comissionado nao recebe dados de outro comissionado.
- Gestor/coordenador so ve vinculados retornados pelo backend e autorizados por
  permissao.
- Financeiro nao recebe notificacoes de ajuste de regra, revisao da Secretaria
  ou pendencia de Head antes do pacote estar pronto.
- RH so recebe eventos de pacote CLT ou excecoes trabalhistas confirmadas.

## 3. Canais

### E-mail

Usar quando a acao depende de alguem fora da tela naquele momento ou quando ha
necessidade de protocolo:

- Head precisa aprovar.
- PJ/autonomo precisa enviar ou corrigir NF.
- Secretaria precisa ser alertada de erro ou atraso critico.
- Financeiro/RH recebe pacote consolidado.
- Pagamento concluido deve ser comunicado, se negocio permitir.

### Notificacao Interna No 7LM Connect

Usar para todas as mudancas relevantes que o perfil pode ver:

- mudanca de etapa;
- comentario de rejeicao ou ajuste;
- NF recebida, validada ou rejeitada;
- pacote enviado;
- pagamento processado ou concluido.

### Alerta No Dashboard

Usar para filas de trabalho e SLA:

- revisoes pendentes;
- aprovacoes pendentes;
- NFs pendentes, proximas do prazo ou vencidas;
- pacotes prontos para envio;
- falhas de integracao.

### Lembrete Automatico

Usar para pendencias com prazo:

- Head sem aprovacao;
- NF nao enviada;
- NF rejeitada sem reenvio;
- pacote pronto e nao enviado;
- pagamento sem retorno depois do envio.

### Resumo Diario/Semanal

Usar para reduzir excesso de e-mails:

- resumo diario de pendencias da Secretaria;
- resumo diario de aprovacoes pendentes do Head;
- resumo semanal do ciclo para Secretaria/Admin;
- resumo de NFs vencidas por ciclo.

### Notificacao Silenciosa Apenas Para Auditoria

Usar para eventos tecnicos ou internos:

- calculo iniciado;
- tentativa de envio;
- retentativa automatica;
- payload renderizado;
- webhook/retorno do provedor;
- erro tratado sem acao imediata de usuario.

## 4. Regras Por Tipo De Comissionado

### Corretor CLT

- Nao envia NF.
- `status_nf` deve ser `nao_aplicavel`.
- Depois de `aprovado_head`, entra em `pronta_para_envio_pagamento` com destino
  `RH_FINANCEIRO`.
- E-mail de pacote deve ir para RH e Financeiro com resumo consolidado.
- O comissionado CLT pode receber ciencia de aprovacao/pagamento apenas com
  dados proprios.

### Corretor PJ/Autonomo

- Exige NF antes de seguir para Financeiro.
- Depois de `aprovado_head`, entra em `aguardando_nf`.
- `nf_solicitada` deve gerar e-mail e notificacao interna.
- Pagamento fica bloqueado enquanto NF estiver ausente, rejeitada ou vencida.
- A Secretaria valida NF e libera `pronta_para_envio_pagamento`.

### Gestor/Coordenador Autonomo

- Exige NF propria antes do pagamento.
- Pode visualizar notificacoes agregadas de vinculados somente se o backend
  retornar vinculo oficial e permissao permitir.
- Nao pode receber detalhes sensiveis de vinculados por e-mail individual,
  exceto resumo agregado autorizado.
- CTA de NF propria aponta para a propria comissao, nao para comissoes de
  vinculados.

### Excecoes

| Excecao | Regra de notificacao |
| --- | --- |
| desligamento | notificar Secretaria/RH/Admin; comissionado recebe apenas se decisao de negocio permitir |
| valor zerado | notificacao interna para Secretaria; e-mail ao comissionado apenas se houver politica de ciencia |
| comissao bloqueada | alerta Secretaria/Admin; comissionado ve status proprio com motivo mascarado quando sensivel |
| ajuste manual | auditoria obrigatoria com antes/depois; notificar responsaveis do fluxo |
| documento invalido | e-mail ao PJ/autonomo com motivo claro e CTA de reenvio |
| dados obrigatorios ausentes | alerta Secretaria/Admin; nao notificar comissionado antes de correcao |
| erro de e-mail | alerta Secretaria/Admin; retentativa automatica conforme politica |
| erro financeiro | alerta Secretaria/Financeiro/Admin; bloquear conclusao automatica |

## 5. Templates Minimos

### `head_aprovacao_pendente`

- Assunto: `Comissionamento {{ciclo}}: aprovacao pendente`
- Titulo interno: `Aprovacao pendente`
- Corpo: `Ha comissoes do ciclo {{ciclo}} aguardando sua aprovacao. Status atual: {{status_atual}}. Proxima acao: {{proxima_acao}}.`
- CTA: `Revisar comissoes`
- Dados dinamicos: `{{ciclo}}`, `{{status_atual}}`, `{{proxima_acao}}`,
  `{{link_comissionamento}}`, `{{nome_responsavel}}`
- Tom: objetivo, operacional, sem expor lista completa no e-mail quando houver
  muitos nomes.

### `comissionado_nf_solicitada`

- Assunto: `Envio de Nota Fiscal para comissionamento {{ciclo}}`
- Titulo interno: `Nota Fiscal solicitada`
- Corpo: `O comissionamento do ciclo {{ciclo}} foi aprovado e agora precisa da sua Nota Fiscal para seguir ao Financeiro. Prazo: {{prazo_nf}}. Consulte valores e detalhes no portal autenticado.`
- CTA: `Enviar Nota Fiscal`
- Dados dinamicos: `{{nome_comissionado}}`, `{{ciclo}}`,
  `{{prazo_nf}}`, `{{status_atual}}`, `{{proxima_acao}}`,
  `{{link_comissionamento}}`
- Tom: claro e direto. Se valor em e-mail nao for autorizado, substituir por
  `Consulte o valor no portal`.

### `comissionado_nf_lembrete`

- Assunto: `Lembrete de Nota Fiscal - Comissionamento {{ciclo}}`
- Titulo interno: `Nota Fiscal pendente`
- Corpo: `Sua Nota Fiscal do ciclo {{ciclo}} ainda esta pendente. Prazo: {{prazo_nf}}. Acesse o portal para enviar ou corrigir as informacoes.`
- CTA: `Enviar Nota Fiscal`
- Dados dinamicos: `{{nome_comissionado}}`, `{{ciclo}}`, `{{prazo_nf}}`,
  `{{status_atual}}`, `{{link_comissionamento}}`
- Tom: lembrete operacional, sem expor dados de terceiros.

### `comissionado_nf_rejeitada`

- Assunto: `Correcao necessaria na NF do comissionamento {{ciclo}}`
- Titulo interno: `Nota Fiscal precisa de correcao`
- Corpo: `A NF {{numero_nf}} enviada para o ciclo {{ciclo}} precisa de correcao. Motivo: {{motivo_rejeicao}}. Proxima acao: {{proxima_acao}}.`
- CTA: `Enviar nova NF`
- Dados dinamicos: `{{nome_comissionado}}`, `{{ciclo}}`, `{{numero_nf}}`,
  `{{motivo_rejeicao}}`, `{{prazo_nf}}`, `{{link_comissionamento}}`
- Tom: orientativo, sem julgamento.

### `secretaria_nf_enviada`

- Assunto: `NF recebida para validacao - {{nome_comissionado}} - {{ciclo}}`
- Titulo interno: `NF aguardando validacao`
- Corpo: `{{nome_comissionado}} enviou a NF {{numero_nf}} para o ciclo {{ciclo}}. Status atual: {{status_atual}}.`
- CTA: `Validar NF`
- Dados dinamicos: `{{nome_comissionado}}`, `{{ciclo}}`, `{{numero_nf}}`,
  `{{status_atual}}`, `{{link_comissionamento}}`
- Tom: operacional.

### `comissionado_nf_validada`

- Assunto: `NF validada para comissionamento {{ciclo}}`
- Titulo interno: `Nota Fiscal validada`
- Corpo: `A Nota Fiscal do ciclo {{ciclo}} foi validada pela Secretaria. A comissao seguira para a etapa de pacote de pagamento conforme calendario interno.`
- CTA: `Ver minha comissao`
- Dados dinamicos: `{{nome_comissionado}}`, `{{ciclo}}`,
  `{{status_atual}}`, `{{link_comissionamento}}`
- Tom: informativo, sem prometer data de pagamento nao confirmada.

### `secretaria_pendencia_vencida`

- Assunto: `Pendencia vencida no comissionamento {{ciclo}}`
- Titulo interno: `Pendencia vencida`
- Corpo: `Existe pendencia sem movimento no ciclo {{ciclo}}. Responsavel atual: {{nome_responsavel}}. Proxima acao: {{proxima_acao}}.`
- CTA: `Abrir painel`
- Dados dinamicos: `{{ciclo}}`, `{{nome_responsavel}}`, `{{status_atual}}`,
  `{{proxima_acao}}`, `{{link_comissionamento}}`
- Tom: alerta objetivo.

### `financeiro_pacote_pj_enviado`

- Assunto: `Pacote de pagamento PJ/autonomos - Comissionamento {{ciclo}}`
- Titulo interno: `Pacote enviado ao Financeiro`
- Corpo: `Segue pacote de pagamento do ciclo {{ciclo}} para comissionados PJ/autonomos com NF validada. Data prevista de pagamento: {{data_pagamento_prevista}}.`
- CTA: `Acessar pacote`
- Dados dinamicos: `{{ciclo}}`, `{{data_pagamento_prevista}}`,
  `{{link_comissionamento}}`, `{{nome_responsavel}}`
- Tom: formal, com protocolo. Valores podem ir em anexo/arquivo protegido ou
  link interno, conforme decisao de privacidade.

### `rh_financeiro_pacote_clt_enviado`

- Assunto: `Pacote RH/Financeiro CLT - Comissionamento {{ciclo}}`
- Titulo interno: `Pacote CLT enviado`
- Corpo: `Segue resumo de comissionamento CLT do ciclo {{ciclo}}. Nota Fiscal nao se aplica a este perfil. Data prevista de pagamento: {{data_pagamento_prevista}}.`
- CTA: `Acessar pacote`
- Dados dinamicos: `{{ciclo}}`, `{{data_pagamento_prevista}}`,
  `{{link_comissionamento}}`, `{{nome_responsavel}}`
- Tom: formal, consolidado.

### `comissionado_pagamento_concluido`

Fora do MVP de envio real. Este template fica documentado apenas como futuro,
dependente do desenho do ERP/baixa interna de pagamento.

- Assunto: `Pagamento do comissionamento {{ciclo}} registrado`
- Titulo interno: `Pagamento concluido`
- Corpo: `O pagamento do seu comissionamento do ciclo {{ciclo}} foi registrado. Status atual: {{status_atual}}.`
- CTA: `Ver minha comissao`
- Dados dinamicos: `{{nome_comissionado}}`, `{{ciclo}}`,
  `{{data_pagamento_prevista}}`, `{{status_atual}}`,
  `{{link_comissionamento}}`
- Tom: simples e conclusivo.

### `erro_integracao_email`

- Assunto: `Falha no envio de notificacao - Comissionamento {{ciclo}}`
- Titulo interno: `Falha de envio`
- Corpo: `Uma notificacao do ciclo {{ciclo}} nao foi entregue. Evento: {{status_atual}}. Proxima acao: {{proxima_acao}}.`
- CTA: `Ver historico de envios`
- Dados dinamicos: `{{ciclo}}`, `{{status_atual}}`, `{{proxima_acao}}`,
  `{{link_comissionamento}}`
- Tom: tecnico-operacional, apenas para Secretaria/Admin.

### `resumo_diario_pendencias`

- Assunto: `Resumo diario de pendencias - Comissionamento {{ciclo}}`
- Titulo interno: `Resumo diario`
- Corpo: `Resumo das pendencias do ciclo {{ciclo}}: {{quantidade_pendencias}} itens exigem acompanhamento. Acesse o portal para ver a lista autorizada.`
- CTA: `Abrir painel`
- Dados dinamicos: `{{ciclo}}`, `{{quantidade_pendencias}}`,
  `{{pendencias_por_tipo}}`, `{{link_comissionamento}}`
- Tom: consolidado, sem listar detalhes sensiveis no corpo quando houver
  multiplos comissionados.

## 6. Frequencia E Lembretes

### Regras Gerais

- Primeiro aviso: no momento em que a etapa ou pendencia e criada.
- Lembrete antes do prazo: `prazo - 1 dia util`, quando aplicavel.
- Lembrete no vencimento: no inicio do dia util do vencimento.
- Escalonamento apos vencimento: apos 1 dia util sem acao, notificar
  Secretaria; apos 2 dias uteis, incluir Admin/Auditoria ou gestor definido.
- Parada automatica: cancelar lembretes pendentes quando o evento de negocio
  conclui a acao, por exemplo `nf_enviada`, `nf_validada`, `aprovado_head` ou
  `pacote_pagamento_enviado`.
- Agrupamento: no maximo um e-mail resumo por destinatario, ciclo, tipo de
  pendencia e janela diaria, salvo eventos criticos.

### Regras Por Pendencia

| Pendencia | Primeiro aviso | Lembretes | Escalonamento |
| --- | --- | --- | --- |
| aprovacao Head | ao entrar em `aguardando_head_comercial` | 1 dia util sem movimento | Secretaria recebe alerta; Admin se passar SLA |
| envio NF | ao entrar em `aguardando_nf` | 1 dia util e no vencimento | Secretaria recebe atraso; Admin se impactar pacote |
| correcao NF | ao rejeitar NF | 1 dia util e no vencimento | Secretaria recebe atraso |
| envio pacote | ao ficar pronto | na vespera da data limite | Admin se pacote nao enviado ate limite |
| retorno pagamento | ao enviar pacote | conforme data prevista | Secretaria/Financeiro/Admin se sem retorno |

### Politica Anti Excesso

- Consolidar itens repetidos em `resumo_diario_pendencias`.
- Nao reenviar o mesmo template automatico se ja houver envio entregue para o
  mesmo evento/destinatario/canal.
- Reenvio manual deve registrar nova ocorrencia, vinculada ao evento original.
- Eventos tecnicos repetidos devem abrir alerta unico enquanto o incidente
  estiver ativo.

## 7. Auditoria

Para cada notificacao ou e-mail, persistir:

- `evento_id`: identificador do evento de notificacao.
- `evento_negocio_id`: evento de negocio que originou o disparo.
- `correlation_id`: chave para rastrear transicao, notificacao, fila e log.
- `ciclo_id`.
- `resultado_id`, quando a notificacao for por comissao.
- `comissionado_id`, quando aplicavel.
- `destinatario_usuario_id`, quando existir usuario interno.
- `destinatario_email`.
- `destinatario_nome`.
- `perfil_destinatario`.
- `canal`: `email`, `interna`, `dashboard`, `lembrete`, `auditoria`.
- `template_id` e `template_versao`.
- `payload_enviado`, com mascaramento de campos sensiveis quando necessario.
- `assunto_renderizado`.
- `status_envio`: `pendente`, `enfileirado`, `enviado`, `entregue`, `falhou`,
  `cancelado`, `ignorado_idempotencia`.
- `tentativas`.
- `provider_message_id`, se houver.
- `erro_codigo` e `erro_mensagem`, se houver.
- `idempotency_key`.
- `disparado_por_usuario_id` ou `disparado_por_servico`.
- `criado_em`, `enfileirado_em`, `enviado_em`, `entregue_em`, `falhou_em`.
- `ip_origem` e `user_agent`, quando acao manual vier do portal.

Regras:

- Payload de auditoria pode guardar dados tecnicos, mas a renderizacao para
  cada perfil deve respeitar mascaramento.
- Documento anexado ou NF deve ser referenciado por `documento_id` ou link
  protegido, nao por caminho local publico.
- A timeline do Historico deve exibir o evento de negocio e pode apontar para
  o historico de notificacao quando o perfil tiver permissao.

## 8. Permissoes E Privacidade

### Dados Por Perfil

| Perfil | Pode receber no e-mail | Deve ficar apenas no portal |
| --- | --- | --- |
| Secretaria | pendencias, nomes, status, links internos, valores se politica permitir | documentos sensiveis e anexos protegidos |
| Head Comercial | fila de aprovacao, resumo por ciclo, links internos | detalhes completos de terceiros quando desnecessarios |
| Comissionado CLT | status proprio, data prevista, valor proprio se permitido | memoria completa, dados de outros, pacote RH |
| Comissionado PJ/autonomo | status proprio, prazo NF, numero NF, valor proprio se permitido | NF de terceiros, lista consolidada, dados bancarios |
| Gestor/Coordenador | status proprio; resumo agregado autorizado | valores/dados individuais de vinculados se politica nao liberar |
| Financeiro | pacote consolidado autorizado, valores, status NF | dados fora do pacote ou comentarios internos de aprovacao |
| RH | pacote CLT autorizado, valores CLT, observacoes trabalhistas necessarias | NFs de PJ/autonomos |
| Admin/Auditoria | logs, eventos, status tecnico | secrets, credenciais SMTP, conteudo protegido sem necessidade |

### Regras De Valor Em E-mail

Decisao recomendada para MVP:

- E-mails para comissionado nao devem expor valor liquido por padrao. Usar
  `Consulte o valor no portal`.
- E-mails para Financeiro/RH podem conter valores em pacote protegido ou anexo
  gerado pelo backend, conforme politica validada.
- Notificacao interna pode mostrar valor apenas quando a API autorizar para o
  perfil.

### Regras De Isolamento

- `view.own`: apenas notificacoes em que `destinatario_usuario_id` e o usuario
  logado ou em que `comissionado_id` pertence ao usuario.
- `view.linked`: gestor/coordenador ve vinculados apenas por relacao oficial
  persistida ou retornada pelo backend.
- `view.all.commissioning`: Secretaria/Admin podem ver todo ciclo.
- Links de e-mail devem abrir o portal autenticado. Sem sessao, redirecionar
  para login.
- Identificadores em URL nao bastam para autorizacao. Toda consulta valida
  permissao no backend.

## 9. Endpoints E Backend Propostos

Sem implementar migrations neste momento.

### Notificacoes Do Usuario

- `GET /api/comissionamento/notificacoes`
  - Lista notificacoes internas do usuario autenticado.
  - Filtros: `ciclo_id`, `status_lida`, `tipo_evento`, `canal`, `periodo`.

- `POST /api/comissionamento/notificacoes/{notificacao_id}/marcar-lida`
  - Marca uma notificacao como lida.
  - Valida que a notificacao pertence ao usuario ou que o usuario tem permissao
    administrativa.

- `POST /api/comissionamento/notificacoes/marcar-todas-lidas`
  - Marca lote como lido para o usuario autenticado.

### Historico E Reenvio

- `GET /api/comissionamento/notificacoes/historico`
  - Consulta envios por ciclo, resultado, destinatario, evento e status.
  - Acesso Secretaria/Admin.

- `POST /api/comissionamento/notificacoes/{notificacao_id}/reenviar`
  - Reenvia notificacao/e-mail.
  - Exige permissao da Secretaria/Admin e `Idempotency-Key`.

- `POST /api/comissionamento/notificacoes/manual`
  - Disparo manual pela Secretaria.
  - Campos: `template_id`, `ciclo_id`, `resultado_ids`, `destinatarios`,
    `comentario`, `canal`.

- `POST /api/comissionamento/notificacoes/preview`
  - Renderiza template com payload e destinatarios antes do envio.
  - Nao envia, mas pode registrar auditoria de preview.

### Configuracao

- `GET /api/comissionamento/notificacoes/templates`
  - Lista templates ativos e versoes.

- `POST /api/comissionamento/notificacoes/templates`
  - Cria template.
  - Exige Admin/Secretaria configuradora.

- `PUT /api/comissionamento/notificacoes/templates/{template_id}`
  - Cria nova versao do template, nao sobrescreve historico.

- `GET /api/comissionamento/notificacoes/regras`
  - Lista prazos, canais, destinatarios e escalonamentos.

- `PUT /api/comissionamento/notificacoes/regras`
  - Atualiza configuracao de prazos e lembretes.
  - Exige auditoria de antes/depois.

- `GET /api/comissionamento/notificacoes/preferencias`
  - Preferencias do usuario, dentro dos limites obrigatorios.

- `PUT /api/comissionamento/notificacoes/preferencias`
  - Atualiza preferencias permitidas.

### Fila E Processamento

- `POST /api/comissionamento/notificacoes/processar-fila`
  - Endpoint interno/operacional para worker/tarefa processar fila.
  - Deve ser protegido, nao publico para usuarios comuns.

- `POST /api/comissionamento/notificacoes/testar-provider`
  - Testa configuracao do provider em modo seguro.
  - Nao envia e-mail real por padrao.
  - Em `dry_run`, valida credenciais/configuracao disponiveis sem revelar
    segredo e gera log tecnico mascarado.
  - Em teste real, exige flag explicita, allowlist e permissao Admin.

- `POST /api/comissionamento/notificacoes/disparar-evento`
  - Recebe evento de negocio e aplica regras de notificacao.
  - Uso interno por servico de dominio.

- `POST /api/comissionamento/notificacoes/reconciliar`
  - Reprocessa falhas, callbacks ou pendencias de status do provedor.

### Integracao Com Transicoes Existentes

Os endpoints de transicao do comissionamento devem acionar o servico de
notificacao depois de persistir evento de negocio:

- `POST /api/comissionamento/resultados/{resultado_id}/enviar-head`
- `POST /api/comissionamento/resultados/{resultado_id}/aprovar-head`
- `POST /api/comissionamento/resultados/{resultado_id}/solicitar-ajuste`
- `POST /api/comissionamento/resultados/{resultado_id}/solicitar-nf`
- `POST /api/comissionamento/resultados/{resultado_id}/nf`
- `POST /api/comissionamento/resultados/{resultado_id}/validar-nf`
- `POST /api/comissionamento/ciclos/{ciclo_id}/enviar-pacote-pagamento`
- `POST /api/comissionamento/resultados/{resultado_id}/registrar-pagamento`

## 10. Modelo De Dados Sugerido

Schema sugerido: `comissionamento`.

### `notificacao_eventos`

Registra o evento de notificacao gerado a partir de um evento de negocio.

- `id`
- `evento_negocio_id`
- `correlation_id`
- `ciclo_id`
- `resultado_id`
- `comissionado_id`
- `tipo_evento`
- `origem`: `transicao`, `manual`, `scheduler`, `integracao`
- `payload`
- `idempotency_key`
- `criado_por_usuario_id`
- `criado_por_servico`
- `criado_em`

### `notificacoes`

Entidade logica exibida no portal.

- `id`
- `evento_id`
- `tipo_evento`
- `titulo`
- `resumo`
- `link_acao`
- `prioridade`: `baixa`, `normal`, `alta`, `critica`
- `ciclo_id`
- `resultado_id`
- `comissionado_id`
- `status`: `ativa`, `cancelada`, `resolvida`
- `criado_em`
- `resolvida_em`

### `notificacao_destinatarios`

Controla visibilidade, leitura e canal por destinatario.

- `id`
- `notificacao_id`
- `usuario_id`
- `email`
- `nome`
- `perfil`
- `canal`
- `visibilidade`: `propria`, `vinculados`, `ciclo`, `auditoria`
- `pode_ver_valor`
- `lida_em`
- `arquivada_em`
- `criado_em`

### `notificacao_templates`

Templates versionados.

- `id`
- `codigo`
- `versao`
- `canal`
- `assunto`
- `titulo`
- `corpo`
- `cta_label`
- `cta_url_template`
- `variaveis_obrigatorias`
- `politica_mascaramento`
- `ativo`
- `criado_por_usuario_id`
- `criado_em`
- `publicado_em`

### `notificacao_preferencias`

Preferencias por usuario e canal, sem permitir desligar avisos obrigatorios.

- `id`
- `usuario_id`
- `tipo_evento`
- `canal`
- `habilitado`
- `frequencia`: `imediata`, `diaria`, `semanal`
- `criado_em`
- `atualizado_em`

### `notificacao_fila_envio`

Fila de envio por canal.

- `id`
- `evento_id`
- `notificacao_id`
- `destinatario_id`
- `template_id`
- `canal`
- `payload_renderizado`
- `status`
- `tentativas`
- `proxima_tentativa_em`
- `provider_message_id`
- `idempotency_key`
- `criado_em`
- `processado_em`

### `notificacao_logs`

Log tecnico de envio e callbacks.

- `id`
- `fila_envio_id`
- `evento_id`
- `status_anterior`
- `status_novo`
- `provider`
- `provider_message_id`
- `request_payload_mascarado`
- `response_payload_mascarado`
- `erro_codigo`
- `erro_mensagem`
- `criado_em`

### `notificacao_regras_escalonamento`

Regras configuraveis de prazos, lembretes e escalonamento.

- `id`
- `tipo_evento_origem`
- `perfil_fluxo`
- `status_origem`
- `prazo_quantidade`
- `prazo_unidade`: `hora_util`, `dia_util`, `dia_corrido`
- `lembrete_antes_quantidade`
- `lembrete_antes_unidade`
- `escalonar_apos_quantidade`
- `escalonar_apos_unidade`
- `destinatarios_escalonamento`
- `ativo`
- `criado_em`
- `atualizado_em`

### `notificacao_providers`

Registra providers disponiveis sem armazenar secrets em claro.

- `id`
- `codigo`: `fake`, `microsoft_graph`, `azure_communication_services`
- `nome`
- `tipo`: `email`, `interna`, `webhook`
- `ativo`
- `modo`: `dry_run`, `teste_allowlist`, `producao`
- `remetente_padrao`
- `tenant_ref`
- `client_id_ref`
- `secret_ref` ou `cert_ref`
- `configuracao`
- `limites_operacionais`
- `allowlist_destinatarios`
- `criado_por_usuario_id`
- `atualizado_por_usuario_id`
- `criado_em`
- `atualizado_em`

Regras:

- `secret_ref`/`cert_ref` aponta para variavel de ambiente, Key Vault ou
  mecanismo oficial de segredo; nao guarda valor sensivel.
- provider ativo em producao precisa de flag global e liberacao por
  evento/template.
- `microsoft_graph` deve usar `inovacao@7lm.com.br` como mailbox inicial,
  salvo decisao formal futura.
- `azure_communication_services` deve usar o mesmo contrato de provider para
  nao alterar regras de negocio.

## 11. Estrategia De Implementacao Em Fases

### Fase 1 - Documentacao E Matriz

- Validar este plano com negocio, seguranca, Secretaria e responsaveis de
  Financeiro/RH.
- Fechar matriz de eventos, destinatarios, canais, templates e privacidade.
- Confirmar mailbox inicial `inovacao@7lm.com.br` e responsaveis pelo Entra ID.

### Fase 2 - Modelo De Dados

- Criar migrations das tabelas propostas.
- Criar constraints de idempotencia por evento, destinatario, canal e template.
- Popular providers iniciais `fake` e `microsoft_graph` inativo.
- Sem envio real nesta fase.

### Fase 3 - Servico Interno Dry-run

- Criar servico backend de notificacoes.
- Integrar transicoes ja existentes para gerar notificacao e fila em modo
  `fake`/`dry_run`.
- Renderizar templates, registrar payload mascarado e expor preview/historico.
- Validar permissoes e visibilidade no frontend.

### Fase 4 - Microsoft Graph Controlado

- Configurar App Registration e permissao `Mail.Send` conforme plano tecnico.
- Restringir acesso a mailbox `inovacao@7lm.com.br` quando aplicavel.
- Processar fila em ambiente controlado sem destinatarios reais externos.
- Registrar respostas, erros e retentativas.

### Fase 5 - Allowlist De Teste

- Ativar envio real somente para allowlist de teste.
- Liberar poucos templates de baixo risco.
- Validar assunto, corpo, links autenticados, logs e cancelamento de lembretes.

### Fase 6 - Producao Gradual

- Ativar envio real por evento/template.
- Manter rollback para `dry_run` ou `fake`.
- Monitorar falhas, limites do provider, duplicidade e reclamacoes de usuario.
- Revisar periodicamente templates, permissoes e politica de privacidade.

## 12. Casos De Teste

### Fluxo E Regras

- CLT aprovado pelo Head entra em `pronta_para_envio_pagamento`, gera pacote
  RH/Financeiro e nao gera `nf_solicitada`.
- PJ/autonomo aprovado pelo Head entra em `aguardando_nf` e gera e-mail de NF
  para o comissionado.
- Gestor/coordenador autonomo aprovado exige NF propria e nao recebe dados
  individuais de vinculados por e-mail.
- Valor zerado gera alerta para Secretaria e nao dispara e-mail financeiro sem
  aprovacao explicita.
- Comissao bloqueada impede `pacote_pagamento_enviado`.

### Nota Fiscal

- NF enviada por PJ/autonomo gera `nf_enviada`, notifica Secretaria e fica
  pendente de validacao.
- NF validada gera `nf_validada`, muda status para
  `pronta_para_envio_pagamento` e cancela lembretes de NF.
- NF rejeitada exige `motivo_rejeicao`, notifica comissionado e cria nova
  pendencia de reenvio.
- NF rejeitada e reenviada preserva historico da versao rejeitada e registra
  novo documento.
- CLT tentando enviar NF recebe erro de permissao/regra.

### Aprovacao E Ajuste

- Head Comercial rejeita aprovacao com comentario obrigatorio e notifica
  Secretaria.
- Secretaria solicita ajuste e o evento registra responsavel, motivo e
  antes/depois quando houver alteracao.
- Duplicidade de `enviado_para_head` com mesma `Idempotency-Key` nao gera dois
  e-mails.
- Aprovacao Head duplicada nao gera nova solicitacao de NF se a transicao ja
  foi processada.

### Pacote E Pagamento

- Secretaria envia pacote PJ apenas com NFs validadas.
- Secretaria envia pacote CLT sem NF e com destino RH/Financeiro.
- Pacote enviado gera e-mail ao destino correto e evento de auditoria com
  destinatarios.
- Pagamento processado atualiza dashboard e historico.
- Pagamento concluido notifica comissionado apenas se politica de negocio
  estiver ativa.

### Lembretes E Falhas

- Lembrete de NF proxima do prazo dispara uma vez por janela configurada.
- NF vencida gera alerta para Secretaria e mantem pagamento bloqueado.
- Pendencia sem movimento de Head gera lembrete e escalonamento.
- Falha no envio de e-mail registra `erro_integracao_email`, preserva payload e
  agenda retentativa.
- Falha permanente apos limite de tentativas aparece no dashboard da
  Secretaria/Admin.

### Permissoes

- Comissionado sem permissao tentando ver notificacao de outro recebe 403 ou
  lista vazia.
- Gestor ve somente notificacoes de vinculados oficiais.
- Gestor sem vinculo oficial nao ve dados por fallback de cidade/regiao.
- Financeiro nao acessa timeline interna de ajuste de regra.
- RH nao recebe pacote PJ/autonomo.

## 13. Riscos E Decisoes Pendentes

### Decisoes De Negocio

- Valores podem aparecer no corpo do e-mail para comissionados ou somente
  dentro do portal?
- Financeiro recebera e-mail individual por comissionado, pacote consolidado ou
  ambos?
- RH deve receber todos os eventos CLT ou apenas pacote consolidado?
- Pagamento concluido deve gerar e-mail ao comissionado ou apenas notificacao
  interna?
- Quem e o responsavel oficial do Head Comercial no produto: Marcelo fixo ou
  perfil configuravel por ciclo?
- Qual SLA oficial para aprovacao Head, envio de NF, validacao de NF e envio ao
  Financeiro?
- O prazo de NF e sempre 1 a 2 dias uteis ou muda por ciclo/data de pagamento?
- Gestor/coordenador pode ver valores individuais dos vinculados ou apenas
  status agregado?
- Quem pode disparar e-mail manual alem da Secretaria?
- Quais modelos de e-mail atuais devem ser preservados ou migrados?

### Riscos Tecnicos

- Envio real de e-mail sem preview/historico pode gerar comunicacao incorreta e
  dificil de auditar.
- Templates sem versionamento impedem reproduzir o que foi enviado em ciclos
  passados.
- Exibir valores em e-mail aumenta risco de vazamento por encaminhamento.
- Usar fallback de hierarquia do frontend como permissao pode vazar dados.
- Falta de idempotencia em transicoes pode duplicar e-mails e pacotes.
- Anexar NF diretamente em e-mail pode expor documento sensivel; preferir link
  autenticado.
- Scheduler de lembretes precisa respeitar dias uteis e data limite do ciclo.
- Integracao financeira futura pode mudar os eventos de pagamento.
- Microsoft Graph com `Mail.Send` application precisa de restricao operacional
  para nao permitir envio por mailboxes fora do escopo.
- Provider real precisa de flag explicita, allowlist inicial e rollback simples
  para `dry_run`.

## Criterios De Aceite Do MVP De Notificacoes

- Todo evento automatico tem evento de negocio correlacionado.
- Todo envio tem historico consultavel por Secretaria/Admin.
- Nenhum e-mail e enviado sem evento de negocio ou acao manual auditavel.
- Nenhum envio duplicado ocorre para o mesmo evento, destinatario, canal e
  template.
- CLT nunca recebe fluxo de NF.
- PJ/autonomo nao segue para Financeiro sem NF validada.
- Reenvio manual e auditado e idempotente.
- Comissionado ve apenas notificacoes proprias.
- Gestor/coordenador ve apenas vinculados oficiais.
- Falha de e-mail nao some: gera log, retentativa e alerta.
- Templates sao versionados antes do envio real.
- Envio real so acontece com flag/configuracao explicita e allowlist quando em
  fase de teste.
- Provider pode ser trocado sem alterar regras de negocio do Comissionamento.
- Frontend consome apenas `/api/comissionamento/...`, sem acesso direto a banco.
