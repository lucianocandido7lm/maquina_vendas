# Handoff Producao 2026-06 - Dados Reais Do Comissionamento

## Escopo

O ciclo produtivo inicial do Comissionamento e `2026-06`. O ciclo `2026-05` permanece como seed/mock historico e nao deve ser usado como chave produtiva.

Esta entrega prepara gestores/coordenadores reais, pessoas vinculadas reais e destinatarios reais auditaveis, mantendo o envio Microsoft Graph em modo controlado por allowlist.

## Fontes Oficiais

Ordem de precedencia para identidade:

1. `sevenlm_connect.funcionario_acesso`
2. `sevenlm_connect.usuario`
3. `sevenlm_connect.usuario_perfil` e `sevenlm_connect.perfil`
4. `sevenlm_connect.funcionario_equipe_vigencia`
5. `connect_comercial.dashboard_gc_produtividade_hierarquia`

Nome/apelido nao e chave produtiva. A resolucao usa `identificador_usuario`, depois `identificador_funcionario`, depois documento, depois e-mail, e somente por ultimo o nome normalizado.

## Banco

Migration:

- `Servidor/migracao_20260615_comissionamento_producao_2026_06_identidade.sql`

Ela adiciona campos de identidade em:

- `comissionamento.resultados`
- `comissionamento.hierarquia_snapshot`

Tambem cria indices por ciclo, usuario, funcionario, documento e e-mail.

## Geracao Do Ciclo

O endpoint existente de snapshot passa a preparar o ciclo `2026-06` quando chamado:

- `POST /api/comissionamento/ciclos/2026-06/hierarquia/snapshot`

Comportamento:

- cria `comissionamento.ciclos` para Junho/2026 se ainda nao existir;
- cria/atualiza resultados operacionais de gestores/coordenadores reais;
- nao inventa valores financeiros quando nao houver motor/base de calculo;
- congela os vinculos em `comissionamento.hierarquia_snapshot`;
- exclui `Vago` e evita misturar nomes como Robson/Bruno, Alana/Daiana/Rafael e Luiz Aquino;
- so inclui no fluxo de gestor/coordenador quando `cargo` ou `perfil_acesso`
  tiver termo de lideranca, como Gerente, Coordenador, Gestor ou Head.

Pessoas que existem apenas como usuario sem cargo/perfil de lideranca nao entram
automaticamente no ciclo produtivo. Exemplo: Luiz Aquino e Robson Ferreira Paulo
ficam fora enquanto o banco nao trouxer cargo/perfil compativel.

O motivo de entrada no fluxo fica gravado em `comissionamento.resultados.validacao_lideranca`.

## Pessoas Vinculadas

No frontend, a secao **Pessoas vinculadas** agora usa somente dados vindos do backend:

- `row.equipe`
- `row.pessoas_vinculadas`
- `row.subordinados`
- `row.pessoas_abaixo`
- `row.corretores_vinculados`

Nao existe mais fallback visual por cidade ou mock. Se nao houver vinculo real, a secao fica oculta.

Cada pessoa vinculada pode trazer:

- nome;
- cargo/funcao;
- e-mail;
- documento;
- regiao/equipe;
- status ativo;
- origem do vinculo (`dashboard_hierarquia` ou `funcionario_acesso`).

## E-mails

As notificacoes passam a resolver destinatarios reais do banco e gravar isso no payload/historico como `destinatarios_reais`.

Os e-mails de acao tambem carregam dados do resultado do banco:

- `nome_comissionado`;
- `email_comissionado`;
- `cargo_comissionado`;
- `perfil_comissionado`;
- `tipo_comissionado`;
- `papel_comissionamento`;
- `origem_identidade`;
- `validacao_lideranca`.

## Decisoes De Fluxo Ajustadas

`Pronta para envio` e `Enviada ao Financeiro/RH` nao devem mais aparecer como
etapas operacionais do usuario. Como NF de PJ/autonomo ja segue direto ao
Financeiro e CLT segue direto para RH/Financeiro, a etapa visual consolidada e:

- `Pagamento`.

O destino operacional continua sendo exibido nos detalhes, notificacoes e
historico:

- PJ/autonomo: Financeiro;
- CLT: RH e Financeiro.

O codigo interno `pronto_financeiro`/`pronta_para_envio_pagamento` pode existir
por compatibilidade historica, mas a exibicao para usuario deve usar a nova
linguagem.

`Head Comercial` tambem deixa de ser nome de etapa para o usuario. A etapa
passa a se chamar `Aprovacao Comercial`, com texto explicando que a aprovacao
operacional e feita pela `Diretoria Comercial`.

Cada comissao deve exibir um identificador amigavel, como `COM-202606-ABC123`.
Esse codigo aparece no card, detalhe, historico, notificacoes e e-mails. O
`resultado_id` tecnico continua existindo para integracao e auditoria interna.

## Nota Fiscal

Nesta fase o portal nao armazena o arquivo da Nota Fiscal.

No envio de NF:

- o arquivo aceito e somente PDF;
- o backend valida extensao `.pdf`, content-type e assinatura `%PDF`;
- o banco grava metadados operacionais, como numero, data de emissao, nome do
  arquivo informado, tamanho e observacao;
- `comissionamento.documentos.conteudo` fica `null`;
- o e-mail ao Financeiro leva os dados da NF e o PDF anexado de forma
  transitoria, no mesmo request do upload;
- se o envio falhar, como o arquivo nao fica armazenado, o usuario deve
  reenviar a NF.

Na etapa `Aguardando NF`, Secretaria/Admin devem ter somente a acao de
reenviar aviso de NF. Validacao manual de NF pela Secretaria nao e etapa
bloqueante nesta rodada.

## Revisao, Rejeicao E Historico

`Pedir revisao/recalculo` deve funcionar para Secretaria, Diretoria Comercial e
Comissionado. Ao executar:

- motivo e obrigatorio;
- status volta para `calculado`;
- NF volta para `pendente_nf` quando aplicavel;
- financeiro/pagamento voltam para `nao_enviado`;
- evento `recalculo_solicitado` entra no historico;
- Secretaria/Admin recebem notificacao detalhada.

Quando a Diretoria Comercial rejeita:

- status fica `rejeitada`;
- Secretaria/Admin recebem e-mail de revisao;
- Comissionado recebe e-mail de ciencia;
- `Reabrir revisao` usa a mesma acao `solicitar_ajuste` e volta para
  `Calculada/Revisao`, liberando o envio para `Aprovacao Comercial`.

Depois que a NF for enviada ou a comissao entrar em `Pagamento`, nenhuma
revisao/recalculo deve ficar disponivel para Secretaria, Diretoria Comercial ou
Comissionado. Se o e-mail com PDF falhar, o usuario precisa reenviar a NF,
porque o arquivo nao fica armazenado permanentemente.

Todos os e-mails de fluxo devem informar:

- ID amigavel da comissao;
- ciclo;
- comissionado;
- quem executou a acao;
- motivo/observacao quando existir;
- etapa anterior e nova em linguagem de usuario;
- proxima acao;
- correlation id.

Templates ativos apos o refino:

- `secretaria_ajuste_solicitado` v3;
- `financeiro_pacote_pj_enviado` v3.

Na visao da Secretaria, o detalhe do comissionado abre em modal central para
separar melhor kanban/tabela do detalhamento operacional. As acoes principais
ficam no topo do modal para evitar rolagem ate o final do detalhe.

A aba `Notificacoes` foi removida da interface da Secretaria. Templates,
provider e fila continuam no backend/banco para manutencao tecnica pelo
desenvolvedor. A tela principal de auditoria operacional passa a ser
`Historico`, que deve exibir responsavel, e-mail, perfil, motivo, transicao de
status, dados de NF, correlation id, template e destinatarios quando existirem.

Na etapa `Aguardando NF`, a Secretaria pode apenas reenviar o aviso de NF para
o comissionado. Essa acao usa `reenviar_lembrete_nf` e deve registrar evento,
notificacao/e-mail e historico.

Entrega real continua controlada:

- provider Microsoft Graph pode estar ativo;
- modo de teste/allowlist continua obrigatorio;
- fila de entrega usa apenas allowlist enquanto nao houver liberacao manual;
- qualquer destinatario fora da allowlist continua bloqueado pelo provider.

Perfis resolvidos:

- Head: permissao/perfil de Head ou aprovador;
- Secretaria/Admin: `comissionamento.secretaria`, `comissionamento.manage`, Admin/Gerente Comercial;
- Comissionado: e-mail do resultado, vindo de `funcionario_acesso` ou `usuario`;
- Financeiro/RH: permissao/perfil Financeiro, RH ou fallback operacional configurado.

## Validacoes Minimas

Antes de liberar envio fora da allowlist:

- aplicar a migration;
- aplicar `Servidor/migracao_20260615_comissionamento_refino_fluxo_manual.sql`;
- aplicar `Servidor/migracao_20260615_comissionamento_refino_emails_revisao_nf.sql`;
- gerar snapshot do ciclo `2026-06`;
- confirmar que `2026-05` nao mudou;
- validar contagem por lider em `comissionamento.hierarquia_snapshot`;
- abrir a tela e confirmar que Pessoas vinculadas vem do banco;
- confirmar que o historico de notificacao mostra `destinatarios_reais`;
- manter Graph restrito por allowlist ate aprovacao final.

## Ciclo Manual De Teste

Para validar botoes, eventos e e-mails sem mexer no ciclo produtivo, use:

```bash
/opt/7lm-connect/portal/.venv/bin/python \
  /opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect/scripts/criar_fluxo_manual_comissionamento.py
```

O script recria somente o ciclo `2026-06-fluxo-manual` com duas comissoes:

- `manual-2026-06-iniciado`: comissao iniciada, pronta para a Secretaria enviar ao Head;
- `manual-2026-06-recalculo-comissionado`: comissao que voltou para Secretaria por pedido de revisao/recalculo do Comissionado.

As duas comissoes usam dados reais resolvidos do banco e e-mails continuam em
entrega controlada por allowlist.

## Observacao Importante

Esta entrega resolve identidade, hierarquia, pessoas vinculadas e destinatarios. Valores financeiros produtivos dependem da base/motor definitivo de calculo do Comissionamento e nao devem ser preenchidos por mock.
