# Handoff - Ajustes De Regras, Calculo, E-mails E Acessos

Data: 2026-06-16

Raiz oficial:

```text
/opt/7lm-connect/portal
```

## Objetivo

Registrar os ajustes aplicados no modulo de Comissionamento apos validacao
operacional em tela, principalmente:

- edicao e bloqueio da aba Regras;
- notificacao por e-mail quando a Secretaria altera regras/bonus/valores;
- recalculo dinamico de bruto, bonus IPs e liquido no Kanban;
- melhoria do resumo enviado no e-mail;
- redirecionamento temporario de todos os e-mails de teste;
- liberacao de acesso da Secretaria de Vendas para Fernanda.

## Regras E Bloqueio De Edicao

Comportamento definido:

- A Secretaria de Vendas pode editar regras somente quando a comissao estiver
  em etapa de calculo/revisao.
- Status considerados editaveis:
  - `calculado_seed`
  - `calculado`
  - `calculada`
  - `pendente_secretaria`
  - `em_revisao_secretaria`
  - `revisao_necessaria`
  - `rejeitada`
- Em qualquer outra etapa, a aba Regras fica bloqueada para edicao.
- Quando bloqueado, o botao deixa de ser `Publicar agora` e passa a ser
  `Acompanhar comissao`, levando o usuario para o Kanban/Secretaria.

Arquivos principais:

```text
05_modulos/comissionamento/src/App.jsx
01_codigo_fonte/api_7lm_connect/rotas/rotas_de_comissionamento.py
```

No backend, a publicacao tambem e bloqueada quando a comissao nao esta em
Calculada/Revisao, retornando erro `409`.

## Notificacao Ao Comissionado Quando Regra Muda

Foi criado o fluxo para enviar e-mail ao comissionado quando a Secretaria
publica alteracao de regra, bonus, valores ou IPs.

Template criado no banco:

```text
comissionado_regra_publicada
```

Migration criada/aplicada:

```text
Servidor/migracao_20260616_comissionamento_template_regra_publicada_comissionado.sql
```

Pontos importantes:

- O template informa regra alterada, campo/base, quem alterou e resumo do que
  mudou.
- A acao `publicar_regra` passou a mapear para
  `comissionado_regra_publicada`.
- A notificacao e enfileirada e processada pelo provider Microsoft Graph.
- O destinatario original fica auditavel em payload/logs.

Arquivos principais:

```text
01_codigo_fonte/api_7lm_connect/servicos/notificacoes_comissionamento.py
01_codigo_fonte/api_7lm_connect/rotas/rotas_de_comissionamento.py
```

## Calculo Dinamico No Kanban

Problema validado:

- Ao alterar Regra 01 ou bonus de IP, o Historico registrava a alteracao, mas
  o Kanban podia manter `valor_bruto`, `bonus_ips` e `valor_liquido` antigos.

Comportamento atual:

```text
Bruto = valor da faixa ativa/aplicada da Regra 01 publicada
Bonus IPs = soma dos IPs publicados que atingiram a regra
Liquido = Bruto - Distrato + Bonus IPs
```

O backend agora recalcula os valores publicados ao aplicar Regra 01/Regra 02
ativas no preview/resultado individual.

Arquivos principais:

```text
01_codigo_fonte/api_7lm_connect/repositorios/comissionamento.py
01_codigo_fonte/api_7lm_connect/rotas/rotas_de_comissionamento.py
```

Funcoes relevantes:

```text
_valor_regra_01
_bonus_ips
_recalcular_valores_publicados
_aplicar_regras_e_hierarquia_publicadas
buscar_resultado_por_id
```

Exemplo validado:

```text
Regra 01: R$ 10.602,00
Bonus IPs: R$ 900,00
Liquido esperado: R$ 11.502,00
```

Se o bonus IP mudar para `R$ 901,00`, o liquido esperado passa para
`R$ 11.503,00`.

## Correcao Do Resumo Do E-mail

Problema validado:

- O e-mail mostrava payload tecnico inteiro, por exemplo:
  `regra_01.faixas[10].id`, `comissionado_id`, todas as faixas etc.
- Alguns valores apareceram inflados por erro de formatacao de moeda, por
  exemplo `4463.0` virando `R$ 44.630,00`.

Comportamento atual do resumo:

```text
- Regra alterada: Regra 01 - escada de atingimento
- Faixa atual: 105% a 109,99%
- Atingimento atual: 107,69%
- Realizado/objetivo: 14 de 13
- Valor da faixa agora: R$ 4.463,00
- Bruto agora: R$ 4.463,00
- Bonus IPs agora: R$ 550,00
- Liquido agora: R$ 5.013,00
```

Melhorias aplicadas:

- O resumo da Regra 01 prioriza faixa aplicada.
- O resumo da Regra 02 mostra IPs e bonus alterados, nao o payload inteiro.
- Campos tecnicos sao omitidos.
- Valores financeiros usam o resultado oficial/recalculado do backend.
- Formatacao de moeda diferencia numero real (`4463.0`) de texto brasileiro
  (`4.463,00`).

Arquivo principal:

```text
01_codigo_fonte/api_7lm_connect/rotas/rotas_de_comissionamento.py
```

Funcoes relevantes:

```text
_formatar_moeda_regra
_regra_01_dados
_resumo_regra_01_email
_resumo_regra_02_email
_resumo_alteracoes_regra
```

## Redirecionamento Temporario De E-mails

Durante a validacao, foi solicitado que todos os e-mails de teste do
Comissionamento sejam enviados somente para:

```text
hudson.porto@7lm.com.br
fernanda.oliveira@7lm.com.br
```

Variavel configurada no `.env`:

```text
COMISSIONAMENTO_EMAIL_REDIRECT_TO=hudson.porto@7lm.com.br,fernanda.oliveira@7lm.com.br
```

Comportamento atual:

- A criacao de destinatarios redireciona para Hudson e Fernanda.
- O envio final pelo Microsoft Graph tambem forca Hudson e Fernanda.
- Mesmo que uma fila antiga tenha outro destinatario, o `sendMail` envia para
  os e-mails configurados em `COMISSIONAMENTO_EMAIL_REDIRECT_TO`.
- O destinatario original fica registrado em payload/header/log para auditoria.

Arquivos principais:

```text
.env
01_codigo_fonte/api_7lm_connect/configuracoes.py
01_codigo_fonte/api_7lm_connect/servicos/notificacoes_comissionamento.py
```

Funcoes relevantes:

```text
_emails_redirecionamento
redirecionar_destinatarios_email
destinatarios_email_finais
destinatarios_graph_finais
destinatario_email_final
enviar_microsoft_graph
```

Observacao operacional:

- Para voltar aos destinatarios reais, remover ou esvaziar
  `COMISSIONAMENTO_EMAIL_REDIRECT_TO` e reiniciar a API.
- Enquanto essa variavel estiver preenchida, os e-mails reais nao devem ir para
  comissionados/financeiro/head; irao para Hudson e Fernanda.

## Acesso Da Fernanda - Secretaria De Vendas

Usuario ajustado:

```text
Nome: Fernanda Leao Uchoa De Oliveira
E-mail: fernanda.oliveira@7lm.com.br
Usuario ID: 1237e0e3-72df-41be-9a27-7c6fdd28bdd9
```

Foi criado/configurado:

```text
Setor: Secretaria de Vendas
codigo_setor: secretaria_vendas

Perfil: Secretaria de Vendas
```

Permissoes liberadas para a Fernanda:

```text
comissionamento.view
comissionamento.manage
comissionamento.secretaria
comissionamento.aprovar.head
```

As permissoes foram vinculadas:

- diretamente ao usuario em `sevenlm_connect.usuario_permissao`;
- ao perfil `Secretaria de Vendas` em `sevenlm_connect.perfil_permissao`;
- ao setor `secretaria_vendas` via `sevenlm_connect.setor_perfil`;
- ao usuario via `sevenlm_connect.usuario_setor` e
  `sevenlm_connect.usuario_perfil`.

Validacao executada:

```sql
select sevenlm_connect.fn_usuario_tem_permissao(
  usuario.identificador_usuario,
  permissao.nome_permissao
)
```

Resultado:

```text
comissionamento.aprovar.head = true
comissionamento.manage       = true
comissionamento.secretaria   = true
comissionamento.view         = true
```

## Arquivos Alterados

Backend:

```text
01_codigo_fonte/api_7lm_connect/repositorios/comissionamento.py
01_codigo_fonte/api_7lm_connect/rotas/rotas_de_comissionamento.py
01_codigo_fonte/api_7lm_connect/servicos/notificacoes_comissionamento.py
01_codigo_fonte/api_7lm_connect/configuracoes.py
```

Frontend:

```text
05_modulos/comissionamento/src/App.jsx
05_modulos/comissionamento/src/styles.css
02_publico/02_recursos/05_modulos/comissionamento/assets/comissionamento_20260611_comissionamento_react_1.js
```

Banco/migrations:

```text
Servidor/migracao_20260616_comissionamento_template_regra_publicada_comissionado.sql
```

Configuracao:

```text
.env
```

Testes:

```text
04_testes/testes_unitarios/test_comissionamento_fluxo.py
```

## Validacoes Executadas

Comandos executados em momentos diferentes da rodada:

```text
python -m py_compile \
  portal/01_codigo_fonte/api_7lm_connect/repositorios/comissionamento.py \
  portal/01_codigo_fonte/api_7lm_connect/rotas/rotas_de_comissionamento.py \
  portal/01_codigo_fonte/api_7lm_connect/servicos/notificacoes_comissionamento.py \
  portal/01_codigo_fonte/api_7lm_connect/configuracoes.py

python -m unittest portal/04_testes/testes_unitarios/test_comissionamento_fluxo.py
```

Resultado final da suite:

```text
17 tests OK
```

Tambem foram validados:

- `/saude` da API retornando `{"status":"ok"}`;
- Microsoft Graph aceitando e-mails com HTTP `202`;
- funcao de permissao do portal retornando `true` para a Fernanda;
- amostra de destinatarios Graph com Hudson e Fernanda;
- amostra do resumo da Daiana com valores corrigidos:

```text
Bruto agora: R$ 4.463,00
Bonus IPs agora: R$ 550,00
Liquido agora: R$ 5.013,00
```

## Observacoes Importantes

- E-mails antigos ja enviados com valores/destinatarios anteriores nao foram
  reescritos; a correcao vale para proximos envios.
- O redirecionamento temporario de e-mails e uma medida de teste. Antes de
  liberar producao real, revisar/remover `COMISSIONAMENTO_EMAIL_REDIRECT_TO`.
- No ambiente atual, a API roda na porta `8000` com Uvicorn/workers e foi
  reiniciada apos os ajustes.
- Este registro complementa os handoffs de 2026-06-15, principalmente:
  - `handoff-producao-hierarquia-regras-2026-06-15.md`
  - `handoff-producao-2026-06-dados-reais.md`
  - `plano-notificacoes-e-mails.md`
