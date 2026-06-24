# Esteira, Auditoria E Notificacoes Do Comissionamento

## Objetivo

Definir o fluxo operacional real do Comissionamento dentro da Maquina de
Vendas, com botoes por etapa, responsaveis, historico auditavel,
notificacoes e documentos de apoio.

Este documento complementa o MVP de gestores/coordenadores e deve orientar os
proximos agentes de backend, frontend, seguranca/auditoria e QA.

## Principios

- O frontend apenas exibe estado, proximas acoes e botoes permitidos pela API.
- Toda transicao de etapa precisa passar pelo backend.
- Toda acao sensivel precisa gerar evento de auditoria.
- Toda notificacao precisa ter historico de envio.
- O comissionado ve somente a propria comissao.
- A Secretaria de Vendas e dona do fluxo operacional.
- A etapa Financeiro deve ser simples: preparar e enviar pacote de pagamento
quando houver NF validada, ou pacote RH/Financeiro quando for CLT.

## Perfis

### Secretaria De Vendas

Responsavel por operar o ciclo inteiro.

Acoes:

- revisar comissao calculada;
- enviar para Head Comercial;
- solicitar ajuste;
- solicitar NF;
- reenviar lembrete de NF;
- validar NF;
- enviar pacote para pagamento;
- editar e publicar Regra 01 e Regra 02;
- consultar historico completo.

### Head Comercial

Responsavel por validar o valor e a regra aplicada antes da etapa de NF.

Acoes:

- aprovar comissao;
- rejeitar comissao;
- solicitar ajuste com comentario.

### Comissionado

Responsavel por acompanhar a propria comissao e enviar NF quando aplicavel.

Acoes futuras:

- visualizar propria comissao;
- visualizar pessoas vinculadas quando for gestor, gerente, coordenador, head,
  diretorsupervisor e o backend retornar vinculo hierarquico;
- consultar status;
- enviar NF quando for PJ/autonomo.

### Financeiro / RH

Nesta fase nao havera tela financeira complexa.

Regra simples:

- PJ/autonomo: apos NF recebida e validada, a Secretaria envia pacote por
  e-mail/documento para o Financeiro.
- CLT: nao exige NF; a Secretaria envia resumo de pagamento para RH e
  Financeiro.
- CLT nao deve exibir esteira de Nota Fiscal na visao do comissionado.
- O sistema registra que o pacote foi enviado e permite acompanhamento de
  pagamento quando houver endpoint oficial.

## Status Oficiais Propostos

- `calculada`
- `em_revisao_secretaria`
- `aguardando_head_comercial`
- `aprovada_head_comercial`
- `revisao_necessaria`
- `rejeitada`
- `aguardando_nf`
- `nf_solicitada`
- `nf_recebida`
- `nf_validada`
- `pronta_para_envio_pagamento`
- `enviada_pagamento`
- `aguardando_pagamento`
- `paga`

## Esteira Operacional

```text
Calculada
  -> Secretaria revisa
  -> Secretaria envia para Head Comercial
  -> Head Comercial aprovarejeita
  -> Se aprovado e PJ/autonomo: Aguardando NF
  -> Se aprovado e CLT: Pronta para envio RH/Financeiro
  -> Secretaria solicita NF
  -> Comissionado envia NF
  -> Secretaria valida NF
  -> Pronta para envio Financeiro
  -> Secretaria envia pacote na data planejada
  -> Aguardando pagamento
  -> Paga
```

### Esteira CLT

```text
Calculada
  -> Secretaria revisa
  -> Secretaria envia para Head Comercial
  -> Head Comercial aprovarejeita
  -> Se aprovado: Comissionado e informado
  -> Secretaria envia resumo para RH/Financeiro
  -> Aguardando pagamento
  -> Paga
```

Fonte de referencia inicial: Excel `COMISSÃO CORRETORES CLT.xlsx`, onde o
controle aparece por corretor CLT, venda repassada, valor de contrato,
percentual/bonus e total por corretor, sem etapa de Nota Fiscal.

## Botoes Por Etapa

### Secretaria

Em `calculada` ou `em_revisao_secretaria`:

- `Enviar para Head Comercial`
- `Solicitar ajuste`

Em `aguardando_nf`:

- `Solicitar NF`
- `Reenviar lembrete`
- `Marcar NF recebida`

Em `nf_recebida`:

- `Validar NF`
- `Solicitar correcao da NF`

Em `nf_validada` ou `pronta_para_envio_pagamento`:

- `Enviar pacote para pagamento`

### Head Comercial

Em `aguardando_head_comercial`:

- `Aprovar`
- `Rejeitar`
- `Solicitar ajuste`

### Comissionado

Em `aguardando_nf`:

- futuro `Enviar NF`

## Notificacoes

O modulo deve suportar dois tipos de disparo:

1. Automacao por etapa: o sistema dispara notificacao quando uma comissao entra
   em uma etapa.
2. Disparo manual: a Secretaria clica em um botao para enviarreenviar uma
   comunicacao especifica.

### Eventos Que Disparam Notificacao

- Secretaria envia para Head Comercial.
- Head Comercial aprova.
- Head Comercial rejeitasolicita ajuste.
- Sistema solicita NF ao comissionado.
- Sistema reenvia lembrete de NF.
- Secretaria valida NF.
- Secretaria envia pacote para pagamento.
- Pagamento e registrado.

### Automacao Por Etapa

A automacao por etapa deve acontecer quando o backend grava uma transicao de
status.

Regras iniciais:

- Ao entrar em `aguardando_head_comercial`, notificar Head Comercial.
- Ao entrar em `aguardando_nf`, notificar comissionado PJ/autonomo para envio
  da NF e notificar Secretaria de que a solicitacao foi aberta.
- Ao entrar em `nf_recebida`, notificar Secretaria para validar a NF.
- Ao entrar em `nf_validada`, notificar Secretaria de que a comissao esta
  pronta para pacote de pagamento.
- Ao entrar em `pronta_para_envio_pagamento`, agrupar a comissao na fila de
  envio do ciclo.
- Ao entrar em `enviada_pagamento`, notificar Secretaria com data, destino e
  protocolo interno do envio.

Cada automacao deve:

- gerar registro em `comissionamento.eventos`;
- gerar registro em historico/fila de notificacao;
- respeitar destinatarios configurados;
- usar template versionado;
- ser idempotente por transicao, para nao duplicar e-mails.

### Disparo Manual Pela Secretaria

A Secretaria pode acionar notificacoes especificas pelo frontend. Esses botoes
nao substituem a automacao; eles funcionam como reforco operacionalsegunda
notificacao.

Botoes manuais previstos:

- `Solicitar NF`: envia solicitacao ao comissionado PJ/autonomo.
- `Reenviar lembrete`: envia segundo aviso de NF pendente.
- `Enviar pacote para pagamento`: envia pacote para FinanceiroRH/Financeiro.
- `Solicitar ajuste`: notifica responsavel pela correcao.
- `Solicitar correcao da NF`: notifica comissionado quando a NF recebida nao
  esta correta.

Cada disparo manual deve:

- exigir permissao da Secretaria;
- gravar evento com usuario, data/hora e comentario;
- registrar destinatarios;
- guardar preview/template utilizado;
- guardar status de envio;
- impedir clique duplicado via `Idempotency-Key`.

### Destinatarios

- Head Comercial: notificacoes de aprovacao pendente.
- Secretaria: todas as mudancas de etapa, atraso de NF e envio de pacote.
- Comissionado: solicitacao de NF, lembretes, NF validada e status de
  pagamento.
- Financeiro: pacote de PJ/autonomo com NF validada.
- RH e Financeiro: pacote de CLT.

### Lembretes

Regras iniciais:

- lembrar comissionado se NF nao chegar em 1 dia util;
- lembrar novamente em 2 dias uteis;
- alertar Secretaria quando houver NF pendente proxima ao prazo de envio;
- alertar Secretaria antes da data de envio do pacote para pagamento.

## Documentos E E-mails

### Documentos Minimos

Por comissionado:

- resumo de comissao;
- Regra 01 aplicada com escada de atingimento;
- Regra 02 com IPs atingidos e nao atingidos;
- valor bruto, distratos, bonus e liquido;
- historico de aprovacao.

Pacote para pagamento:

- lista de comissoes prontas;
- destino (`Financeiro` ou `RH e Financeiro`);
- status da NF;
- valor liquido;
- anexos/links de NF quando aplicavel.

### E-mail Para Financeiro

Usado para PJ/autonomo.

Conteudo esperado:

- ciclo;
- data planejada de pagamento/envio;
- tabela de comissionados;
- valores;
- status da NF;
- documentos anexoslinks internos.

### E-mail Para RH E Financeiro

Usado para CLT.

Conteudo esperado:

- ciclo;
- lista de colaboradores CLT;
- valores aprovados;
- memoria de calculo;
- observacao de que NF nao se aplica.

## Auditoria

Toda acao deve gravar evento oficial.

Tabela proposta:

`comissionamento.eventos`

Campos minimos:

- `id`
- `resultado_id`
- `ciclo_id`
- `tipo_evento`
- `status_anterior`
- `status_novo`
- `usuario_id`
- `usuario_nome`
- `perfil`
- `comentario`
- `payload`
- `idempotency_key`
- `criado_em`

Eventos minimos:

- `comissao.enviada_head`
- `comissao.aprovada_head`
- `comissao.rejeitada_head`
- `comissao.ajuste_solicitado`
- `notificacao.automatica_disparada`
- `notificacao.manual_disparada`
- `nf.solicitada`
- `nf.lembrete_enviado`
- `nf.recebida`
- `nf.validada`
- `nf.correcao_solicitada`
- `pagamento.pacote_enviado`
- `pagamento.registrado`
- `regra_01.publicada`
- `regra_02.publicada`

## Historico Visual

A Secretaria deve visualizar uma timeline por comissionado e por ciclo.

Cada item da timeline deve mostrar:

- data e hora;
- pessoa responsavel;
- perfil;
- acao executada;
- etapa anterior;
- nova etapa;
- comentario;
- diferenca antes/depois quando for regravalor;
- documento relacionado, quando houver.

Filtros desejados:

- comissionado;
- etapa;
- usuario;
- tipo de evento;
- periodo;
- Regra 01;
- Regra 02;
- NF;
- pagamento.

## Regra 02 Na Edicao

Na tela de Regras, a Secretaria deve ver todos os IPs vinculados ao
comissionado selecionado.

Cada IP deve mostrar:

- nome;
- indicador;
- operador;
- alvo;
- realizado;
- atingiunao atingiu;
- tipo de comissao;
- bonus;
- data inicial;
- data fim.

A edicao deve seguir CRUD normal:

- adicionar novo IP;
- editar IP existente;
- apagar IP vinculado;
- publicar a alteracao para impactar o fluxo daquele comissionado.

A lista completa precisa ficar visivel para contexto mesmo quando a edicao
ocorrer por IP selecionado.

Toda inclusao, edicaoremocao deve registrar antes/depois no historico.

## Endpoints Necessarios

Transicoes:

- `POST /api/comissionamento/resultados/{resultado_id}/enviar-head`
- `POST /api/comissionamento/resultados/{resultado_id}/aprovar-head`
- `POST /api/comissionamento/resultados/{resultado_id}/rejeitar`
- `POST /api/comissionamento/resultados/{resultado_id}/solicitar-ajuste`
- `POST /api/comissionamento/resultados/{resultado_id}/solicitar-nf`
- `POST /api/comissionamento/resultados/{resultado_id}/reenviar-lembrete-nf`
- `POST /api/comissionamento/resultados/{resultado_id}/registrar-nf-recebida`
- `POST /api/comissionamento/resultados/{resultado_id}/validar-nf`
- `POST /api/comissionamento/ciclos/{ciclo_id}/enviar-pacote-pagamento`
- `POST /api/comissionamento/resultados/{resultado_id}/registrar-pagamento`

Historico:

- `GET /api/comissionamento/resultados/{resultado_id}/eventos`
- `GET /api/comissionamento/ciclos/{ciclo_id}/eventos`

Notificacoes:

- `POST /api/comissionamento/notificacoes/preview`
- `POST /api/comissionamento/notificacoes/enviar`
- `POST /api/comissionamento/notificacoes/disparar-etapa`
- `GET /api/comissionamento/notificacoes/historico?ciclo_id=...`

Documentos:

- `GET /api/comissionamento/resultados/{resultado_id}/pdf`
- `GET /api/comissionamento/ciclos/{ciclo_id}/pacote-pagamento`

## Casos De Teste

- Secretaria envia comissao calculada para Head Comercial.
- Head aprova somente comissao pendente de Head.
- Head nao aprova comissao ja aprovada.
- Head rejeita com comentario obrigatorio.
- PJ/autonomo aprovado vai para `aguardando_nf`.
- CLT aprovado vai para `pronta_para_envio_pagamento`.
- Sistema nao envia PJ/autonomo para pagamento sem NF validada.
- Sistema permite pacote CLT sem NF.
- Lembrete de NF gera evento e historico.
- Envio de pacote gera evento e historico.
- Edicao de Regra 01 grava faixas antes/depois.
- Edicao de Regra 02 grava IP antes/depois.
- Comissionado nao ve dados de terceiros.

## Proximo Passo Tecnico

1. Criar migration de `comissionamento.eventos`.
2. Criar campos de status financeiro/NF/pagamento em resultados.
3. Implementar endpoints de transicao com `Idempotency-Key`.
4. Popular `acoes_permitidas` no payload por perfil e status.
5. Conectar notificacoes em modo preview antes de envio real.
6. Evoluir timeline visual usando o endpoint oficial de eventos.
