# Handoff Do Comissionamento Para Novo Orquestrador

Data: 2026-06-11

## Objetivo Deste Documento

Consolidar o que foi implementado no modulo de Comissionamento da Maquina de
Vendas, o que ficou preparado para auditoria e quais proximos passos devem ser
assumidos pelo novo agente orquestrador.

## Raiz Oficial

```text
/opt/7lm-connect/portal
```

## Rotas E Modulos

Rota oficial:

```text
/comercial/comissionamento
```

Fonte React:

```text
05_modulos/comissionamento
```

Build publicado:

```text
02_publico/02_recursos/05_modulos/comissionamento
```

HTML shell:

```text
02_publico/01_paginas/Comercial/comissionamento.html
```

Backend:

```text
01_codigo_fonte/api_7lm_connect/rotas/rotas_de_comissionamento.py
01_codigo_fonte/api_7lm_connect/repositorios/comissionamento.py
01_codigo_fonte/api_7lm_connect/servicos/comissionamento_preview.py
01_codigo_fonte/api_7lm_connect/servicos/comissionamento_seed.py
```

## Documentos Gerados Ou Atualizados

- `frontend-historico-config-nf.md`
- `esteira-auditoria-notificacoes.md`
- `fluxo-aprovacao-nf-financeiro.md`
- `handoff-producao-hierarquia-regras-2026-06-15.md`
- `mvp-gestores-coordenadores.md`
- `seed-maio-2026-excel.md`
- `backlog-orquestrador.md`
- `00_documentacao/README.md`

## O Que Foi Implementado

### Atualizacao Funcional Dos Botoes - 2026-06-11

Foi adicionada uma camada enxuta para funcionalizar os botoes ja existentes no
frontend, sem redesenhar a interface.

Migration aplicada:

```text
Servidor/migracao_20260611_comissionamento_fluxo_auditavel.sql
```

Tabelas adicionadas:

- `comissionamento.eventos`
- `comissionamento.documentos`
- `comissionamento.idempotency_keys`

Colunas adicionadas em `comissionamento.resultados`:

- `status_financeiro`
- `status_pagamento`

Endpoints implementados:

- `POST /api/comissionamento/resultados/{resultado_id}/enviar-head`
- `POST /api/comissionamento/resultados/{resultado_id}/aprovar-secretaria`
- `POST /api/comissionamento/resultados/{resultado_id}/aprovar-head`
- `POST /api/comissionamento/resultados/{resultado_id}/rejeitar`
- `POST /api/comissionamento/resultados/{resultado_id}/solicitar-ajuste`
- `POST /api/comissionamento/resultados/{resultado_id}/solicitar-nf`
- `POST /api/comissionamento/resultados/{resultado_id}/reenviar-lembrete-nf`
- `POST /api/comissionamento/resultados/{resultado_id}/registrar-nf-recebida`
- `POST /api/comissionamento/resultados/{resultado_id}/validar-nf`
- `POST /api/comissionamento/resultados/{resultado_id}/solicitar-correcao-nf`
- `POST /api/comissionamento/resultados/{resultado_id}/nf`
- `POST /api/comissionamento/resultados/{resultado_id}/registrar-pagamento`
- `POST /api/comissionamento/ciclos/{ciclo_id}/enviar-pacote-pagamento`

Comportamento:

- cada acao valida permissao e etapa;
- cada acao usa `Idempotency-Key`;
- cada acao grava `comissionamento.eventos`;
- cada acao grava espelho em `system.auditoria_evento`;
- o frontend recarrega ciclo e historicos apos acao;
- erro real da API passa a aparecer no feedback.

### Integracao Na Maquina De Vendas

- Comissionamento foi integrado como secao da Maquina de Vendas.
- A rota oficial foi mantida em `/comercial/comissionamento`.
- O shell global do portal, sidebar, preload e permissao da pagina foram
  preservados.
- O modulo passou de HTML/JS estatico para React/Vite em
  `05_modulos/comissionamento`.

### Frontend React

Abas atuais:

- Secretaria;
- Head Comercial;
- Comissionado;
- Regras;
- Historico.

Funcionalidades principais:

- Secretaria com Kanban e tabela.
- Clique no nome da tabela abre o mesmo drawer do Kanban.
- Filtros por ciclo, busca, cidade/regiao, cargo/funcao, fluxo do
  comissionado, etapa, NF, pagamento, Regra 01, Regra 02/IP, valor minimo,
  valor maximo e pendencias rapidas.
- Head Comercial com board de pendentes e aprovadas/etapa seguinte.
- Head visualiza Regra 01 atingida e Regra 02/IPs atingidosnao atingidos.
- Comissionado ve primeiro `Onde esta minha comissao`.
- Comissionado PJ/autonomo ve upload interno de Nota Fiscal quando esta em
  `aguardando_nf`.
- Comissionado CLT nao ve esteira de Nota Fiscal.
- Gestor/Coordenador Autonomo ve secao de pessoas vinculadas quando o backend
  enviar hierarquia.
- Regras permite escolher comissionado e editar Regra 01Regra 02.
- Regra 01 mostra escada de atingimento e permite editar bonus por faixa.
- Regra 02 permite CRUD visual de IPs: adicionar, editar e apagar.
- Historico exibe timeline do ciclo com filtros por ciclo, pessoa, evento,
  etapa, usuario, regra, NF, pagamento e periodo.

### Configuracao Dinamica Inicial

Arquivo:

```text
05_modulos/comissionamento/src/config/comissionamentoConfig.js
```

Constantes centralizadas:

- `COMMISSION_STATUS`
- `COMMISSION_STAGES`
- `COMMISSION_ACTIONS`
- `COMMISSION_TYPES`
- `COMMISSION_FLOW_PROFILES`
- `COMMISSION_FIELDS`
- `COMMISSION_FILTERS`
- `COMMISSION_INDICATORS`
- `COMMISSION_EVENT_TYPES`
- `COMMISSION_DOCUMENT_TYPES`
- `COMMISSION_NOTIFICATION_TYPES`

Essas constantes sao fallback local para:

```text
GET /api/comissionamento/config
```

### Perfis De Fluxo Suportados

Perfis iniciais:

- `corretor_autonomo`
- `corretor_clt`
- `gestor_coordenador_autonomo`

Comportamento:

- Corretor Autonomo: exige NF, segue para Financeiro.
- Corretor CLT: nao exige NF, segue para RH e Financeiro.
- Gestor/Coordenador Autonomo: exige NF, segue para Financeiro e pode ver
  pessoas vinculadas.

Fallback atual do frontend:

- `CLT` no tipo/funcao vira `corretor_clt`;
- `GEST`, `GER`, `COORD`, `HEAD`, `DIRETOR`, `SUPERV` vira
  `gestor_coordenador_autonomo`;
- demais PJ/autonomos viram `corretor_autonomo`.

Regra importante:

- essa inferencia e fallback de UX; a permissao e a classificacao oficial devem
  vir do backend.

### Fluxo CLT

Foi analisado o arquivo:

```text
/root/data-engineering/apps/commercial-dashboard/COMISSÃO CORRETORES CLT.xlsx
```

Resumo identificado:

- abas mensais de `03-2025` ate `04-2026`;
- aba `DESLIGAMENTO - CLT`;
- estrutura por corretor;
- vendas repassadas vinculadas;
- valor de contrato;
- percentuais/bonus;
- total por corretor;
- sem Nota Fiscal.

Regra operacional adotada no MVP:

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

Status interno de NF para CLT:

```text
nao_aplicavel
```

### Backend/API

Rotas existentes/preparadas:

- `GET /api/comissionamento/config`
- `GET /api/comissionamento/ciclos`
- `GET /api/comissionamento/ciclos/2026-05/preview`
- `GET /api/comissionamento/ciclos/{ciclo_id}/resultados`
- `GET /api/comissionamento/ciclos/{ciclo_id}/eventos`
- `GET /api/comissionamento/resultados/{resultado_id}`
- `GET /api/comissionamento/resultados/{resultado_id}/eventos`
- `GET /api/comissionamento/regras`
- `POST /api/comissionamento/regras`
- `POST /api/comissionamento/ciclos/{ciclo_id}/simular`
- `POST /api/comissionamento/regras/{regra_id}/publicar`

Publicacao de regra:

- o botao `Publicar agora` envia payload estruturado;
- backend registra evento em `system.auditoria_evento`;
- Historico passa a consumir eventos oficiais;
- ainda nao recalcula oficialmente o resultado, pois isso depende do motor
  versionado.

### Auditoria E Historico

Eventos de regra sao registrados em:

```text
system.auditoria_evento
```

Endpoints de leitura:

```text
GET /api/comissionamento/ciclos/{ciclo_id}/eventos
GET /api/comissionamento/resultados/{resultado_id}/eventos
```

A tela de Historico tambem monta eventos de fallback a partir do preview quando
o backend ainda nao possui evento oficial suficiente.

### Nota Fiscal

Frontend preparado para:

```text
POST /api/comissionamento/resultados/{resultado_id}/nf
```

Payload esperado:

- `arquivo`
- `numero_nf`
- `data_emissao`
- `valor_nf`
- `observacao`

Regras:

- usa `multipart/form-data`;
- envia `Idempotency-Key`;
- endpoint deve validar permissao e vinculo do comissionado;
- download futuro deve ser protegido por API.

## Validacoes Executadas

Comandos executados com sucesso:

```text
npm run build
node --check src/api/comissionamentoApi.js
node --check 02_publico/02_recursos/05_modulos/comissionamento/assets/comissionamento_20260611_comissionamento_react_1.js
python3 -m py_compile 01_codigo_fonte/api_7lm_connect/rotas/rotas_de_comissionamento.py 01_codigo_fonte/api_7lm_connect/repositorios/comissionamento.py 01_codigo_fonte/api_7lm_connect/servicos/comissionamento_preview.py
```

Rota validada:

```text
https://dev.maquinadevendas7lm.app.br/comercial/comissionamento
```

Resultado:

```text
200 OK
```

Endpoints novos foram testados sem credencial e retornaram `401 Credencial de
acesso ausente`, confirmando que existem e estao protegidos por autenticacao.

Servico reiniciado:

```text
7lm-connect-api.service
```

Status apos restart:

```text
active
```

## O Que Ainda Nao Esta Feito Definitivamente

Esses pontos estao planejados/preparados, mas nao sao definitivos ainda:

- Motor oficial de calculo versionado.
- Persistencia definitiva das regras publicadas em tabelas proprias.
- Recalculo automatico apos publicar Regra 01/Regra 02.
- Tabelas oficiais de comissionados, resultados, regras, aprovacoes, documentos,
  notificacoes e eventos especificos do modulo.
- Endpoint real de upload de NF com armazenamento protegido.
- Endpoint de `minha-comissao` com filtro real por usuario/vinculo.
- Permissoes finas separadas por `view.own`, `view.all`, `regras.manage`,
  `aprovar.head`, `financeiro`.
- Hierarquia real de gestores/coordenadores/corretores.
- Envio real de e-mail/notificacao.
- Templates versionados de comunicacao.
- Geracao de PDF/pacote de pagamento.
- Exportacao Excel/CSV.
- Testes automatizados por perfil, permissao, status e responsividade.

## Checklist Dos Planos Conversados

### Aplicado

- Integrar Comissionamento como secao da Maquina de Vendas.
- Migrar Comissionamento para React/Vite.
- Manter rota `/comercial/comissionamento`.
- Criar UX por perfil.
- Criar Secretaria com Kanban/Tabela.
- Criar Head Comercial com pendentes/aprovadas.
- Criar Comissionado com status da propria comissao.
- Criar Regras com Regra 01 e Regra 02.
- Criar Historico.
- Criar filtros avancados da Secretaria.
- Criar upload visual de NF para PJ/autonomo.
- Esconder NF para CLT.
- Validar fluxo CLT pelo Excel.
- Criar configuracao frontend centralizada.
- Criar perfis de fluxo dinamicos no frontend.
- Preparar endpoints de config/historico.
- Corrigir publicacao de regra para registrar auditoria.
- Documentar comportamento atual.

### Parcial / Preparado

- Upload de NF: frontend e contrato prontos; backend de armazenamento ainda nao.
- Acoes da esteira: URLs e botoes preparados; endpoints reais de transicao ainda
  precisam ser implementados.
- Historico: leitura de auditoria pronta; evento especifico de cada acao depende
  dos endpoints reais.
- Regras: publicacao registra auditoria; persistencia versionada e recalculo
  ainda pendentes.
- Hierarquia: frontend preparado; backend precisa retornar vinculos oficiais.
- Config dinamica: endpoint inicial existe; ainda precisa refletir tabelas de
  configuracao reais.

## Proximo Passo Recomendado

Iniciar agente orquestrador de backend/produto para desenhar e implementar o
modelo canonico:

1. tabelas oficiais;
2. endpoints de fluxo;
3. motor de calculo versionado;
4. auditoria propria do modulo;
5. notificacoes;
6. upload/documentos protegidos;
7. permissoes finas;
8. testes por perfil.

## Prompt Para Novo Agente Orquestrador

```text
Voce e o novo Agente Orquestrador do Modulo de Comissionamento da Maquina de
Vendas no 7LM Connect.

Raiz oficial do projeto:

/opt/7lm-connect/portal

Antes de qualquer decisao, leia obrigatoriamente:

1. /opt/7lm-connect/portal/AGENTS.md
2. /opt/7lm-connect/portal/00_documentacao/README.md
3. /opt/7lm-connect/portal/00_documentacao/arquitetura/mapa-diretorios.md
4. /opt/7lm-connect/portal/00_documentacao/seguranca/perimetro-api-banco.md
5. /opt/7lm-connect/portal/00_documentacao/agentes/README.md
6. /opt/7lm-connect/portal/00_documentacao/modulos/comissionamento/visao-inicial.md
7. /opt/7lm-connect/portal/00_documentacao/modulos/comissionamento/backlog-orquestrador.md
8. /opt/7lm-connect/portal/00_documentacao/modulos/comissionamento/mvp-gestores-coordenadores.md
9. /opt/7lm-connect/portal/00_documentacao/modulos/comissionamento/seed-maio-2026-excel.md
10. /opt/7lm-connect/portal/00_documentacao/modulos/comissionamento/fluxo-aprovacao-nf-financeiro.md
11. /opt/7lm-connect/portal/00_documentacao/modulos/comissionamento/esteira-auditoria-notificacoes.md
12. /opt/7lm-connect/portal/00_documentacao/modulos/comissionamento/frontend-historico-config-nf.md
13. /opt/7lm-connect/portal/00_documentacao/modulos/comissionamento/handoff-orquestrador-2026-06-11.md

Contexto atual:

- O Comissionamento ja esta integrado na Maquina de Vendas em
  /comercial/comissionamento.
- O frontend foi migrado para React/Vite em 05_modulos/comissionamento.
- Existem abas Secretaria, Head Comercial, Comissionado, Regras e Historico.
- O frontend suporta os perfis de fluxo corretor_autonomo, corretor_clt e
  gestor_coordenador_autonomo.
- CLT nao passa por NF; segue para RH/Financeiro.
- PJ/autonomo e gestor/coordenador autonomo exigem NF antes do Financeiro.
- O botao Publicar agora registra auditoria em system.auditoria_evento, mas
  ainda nao recalcula nem persiste versao definitiva da regra.
- O Historico consome eventos por ciclo/resultado e usa fallback visual quando
  ainda nao ha evento oficial suficiente.

Atualizacao de auditoria funcional em 2026-06-11:

- Foram criadas/aplicadas estruturas iniciais para fluxo auditavel:
  comissionamento.eventos, comissionamento.documentos,
  comissionamento.idempotency_keys e colunas de status financeiro/pagamento em
  comissionamento.resultados.
- Os endpoints dos botoes existentes foram roteados e protegidos por
  autenticacao. Sem sessao, todos retornam 401, nao 404.
- A validacao transacional com rollback confirmou as transicoes:
  NF solicitada, NF recebida, NF validada, pacote enviado e pagamento
  registrado.
- A mesma validacao confirmou que os eventos sao gravados na transacao e
  removidos no rollback, sem alterar o ciclo real.
- O ciclo 2026-05 possui, no banco, 13 comissionados:
  9 em aprovado_marcelo/pendente_nf e 4 em pronto_financeiro/nf_recebida.
  Nao existe evidencia no banco de 134 em pagamento; a leitura correta atual e
  13 comissionados, sendo 4 prontos para Financeiro.
- O frontend foi ajustado para normalizar nomenclaturas antigas:
  pendente_marcelo -> aguardando_head_comercial e
  aprovado_marcelo -> aprovada_head_comercial.
- O endpoint GET /api/comissionamento/minha-comissao?ciclo_id=2026-05 foi
  criado para a visao propria do comissionado. Ele aceita
  comissionamento.view.own ou comissionamento.view, busca o vinculo pelo nome
  ou e-mail do usuario autenticado e retorna estado sem vinculo sem quebrar a
  tela.
- Foi criado o ciclo de teste 2026-05-teste-fluxo, visivel no filtro de ciclo,
  copiando as 13 comissoes do seed real com resultado_id teste-fluxo-seed-1 a
  teste-fluxo-seed-13. Esse ciclo existe para testar botoes, historico, upload
  de NF fake e transicoes sem alterar o ciclo oficial 2026-05.
- O ciclo de teste ficou distribuido assim:
  3 em Secretaria, 3 em Head Comercial, 3 em Aguardando NF, 2 em NF recebida/
  validacao, 1 pronta para envio ao Financeiro e 1 em pagamento.
- O seed de teste criou 39 eventos oficiais no historico do ciclo
  (edicao Regra 01, edicao Regra 02 e calculo/cenario por comissionado) e 4
  documentos fake de NF para as comissoes em validacao/financeiro/pagamento.
- A regra de acoes foi ajustada para que status de pagamento nao exiba botoes
  operacionais. A API passa a retornar acoes_permitidas vazio para
  enviada_pagamento/pago, e o frontend tambem bloqueia fallback de botoes em
  stage pagamento.
- O Kanban da Secretaria foi ajustado para separar status atual de proxima
  acao. O card passa a mostrar status/etapa com tom visual conforme o fluxo
  (NF solicitada, NF recebida, pronta para envio, aguardando pagamento etc.) e
  a proxima acao aparece como texto secundario. Isso corrige o uso antigo de
  texto verde fixo como se fosse status.
- A aba Historico foi reforcada para a Secretaria:
  - resumo de eventos no filtro, eventos oficiais, edicoes de regras,
    movimentos de fluxo e documentos;
  - timeline com responsavel real, etapa anterior/nova, NF anterior/nova,
    Financeiro anterior/novo, Pagamento anterior/novo, valor, regra/campo,
    comentario e documento vinculado;
  - filtros continuam por ciclo, pessoa, evento, etapa, regra, NF, pagamento,
    usuario e periodo.
- O backend de eventos passou a retornar status_nf_anterior,
  status_financeiro_anterior/novo, status_pagamento_anterior/novo e nome do
  usuario responsavel quando disponivel.
- O repositorio de eventos foi tornado tolerante a payloads antigos gravados
  como string/lista, evitando quebra do endpoint de Historico.
- Validacao autenticada do endpoint
  /api/comissionamento/ciclos/2026-05-teste-fluxo-todas-pagamento/eventos
  retornou 200 com 104 eventos, responsavel real e status de fluxo completos.
- O seletor de ciclo foi movido para o topo do painel, no cabecalho principal,
  para permitir testar ciclos, botoes e esteira em qualquer visao.
- A classificacao de etapa do frontend foi corrigida:
  - rejeitada, revisao_necessaria e cancelada aparecem em
    Calculada/Revisao na Secretaria;
  - aguardando_head_comercial aparece em Head Comercial;
  - aguardando_nf/nf_em_validacao aparecem em Aguardando NF;
  - pronta_para_envio_pagamento aparece em Pronta para envio;
  - enviada_pagamento/aguardando_pagamento aparecem em Pagamento sem acoes.
- A visao Head Comercial foi ajustada para tres grupos:
  Faltam aprovar, Ja aprovadas ou etapa seguinte e Devolvidas/Rejeitadas.
  Rejeitar ou Solicitar ajuste tira a comissao da fila pendente do Head e deixa
  claro que ela volta para Calculada/Revisao na Secretaria.
- A aba Historico recebeu uma camada visual de auditoria para a Secretaria:
  categorias por cor e icone para Todos, Edicao de regra, Passagem de etapa,
  Nota Fiscal, Pagamento, Documento e Atencao; filtros rapidos por categoria;
  cards com marcador lateral colorido; chips de Oficial/Previa; responsavel,
  etapa, NF, Financeiro, Pagamento, valor, regra/campo, comentario, documento
  e antes/depois em blocos legiveis.
- O objetivo visual do Historico e responder rapidamente:
  o que foi editado, quem editou, quando editou, de qual status saiu, para qual
  etapa passou, se envolveu NF/documento, se virou pagamento e quais eventos
  exigem atencao da Secretaria.
- Regra de notificacao automatica implementada no fluxo:
  - passou para Head Comercial: registra notificacao automatica para o Head;
  - Head aprovou PJ/autonomo: entra em Aguardando NF com status_nf = solicitada
    e registra notificacao/e-mail automatico para comissionado e Secretaria;
  - Head aprovou CLT/sem NF: registra notificacao para Secretaria, RH e
    Financeiro;
  - NF enviada: notifica Secretaria para validacao;
  - NF validada: notifica Secretaria que esta pronta para Financeiro;
  - correcao/rejeicao de NF: notifica comissionado e Secretaria;
  - pacote enviado: notifica destino de pagamento e Secretaria;
  - pagamento registrado: notifica comissionado e Secretaria.
- O envio real de e-mail ainda fica representado como evento auditavel com
  canais email/interna/dashboard e status_envio = pendente_integracao_email,
  porque a integracao final SMTP/API de notificacao ainda precisa ser plugada.
- Matriz atual dos botoes:
  - Calculada/Revisao: Enviar para Head, Solicitar ajuste.
  - Head Comercial: Aprovar, Rejeitar, Solicitar ajuste.
  - Aguardando NF: nao existe mais botao de primeira solicitacao; a solicitacao
    nasce automatica. Botao disponivel: Reenviar aviso NF.
  - NF recebida/em validacao: Validar NF, Solicitar correcao da NF.
  - Pronta para envio: Enviar pacote.
  - Pagamento: nenhum botao operacional.
- Auditoria validada em 2026-06-11:
  aprovar-head em ciclo 2026-05-teste-notificacao-auto retornou status
  aguardando_nf, status_nf solicitada, acoes_permitidas somente
  reenviar_lembrete_nf e eventos comissao_aprovada_head +
  notificacao_automatica_disparada.
- A pagina /comercial/comissionamento retornou 200 apos build e restart da API.
- O teste sem autenticacao em /api/comissionamento/ciclos/2026-05/preview
  retornou 401 pelo dominio e direto na API local, como esperado.

Roteiro sugerido para auditoria manual no ciclo 2026-05-teste-fluxo:

1. Secretaria: teste-fluxo-seed-1 a 3 devem mostrar Enviar para Head e/ou
   Solicitar ajuste.
2. Head Comercial: teste-fluxo-seed-4 a 6 devem mostrar Aprovar, Rejeitar e
   Solicitar ajuste.
3. Aguardando NF: teste-fluxo-seed-7 a 9 devem mostrar somente Reenviar aviso
   NF para a Secretaria; use teste-fluxo-seed-9 para validar upload de NF fake
   pela visao de comissionado/preview.
4. NF recebida: teste-fluxo-seed-10 e 11 devem mostrar Validar NF e Solicitar
   correcao da NF.
5. Financeiro: teste-fluxo-seed-12 deve mostrar Enviar pacote.
6. Pagamento: teste-fluxo-seed-13 deve estar em pagamento e nao deve mostrar
   Solicitar NF, Enviar pacote ou qualquer outro botao operacional.

Auditoria automatizada executada por endpoint real:

- Foi criado o ciclo 2026-05-teste-fluxo-auditado para validar ida, volta e
  status intermediarios usando HTTP real contra a API local com Bearer token,
  Idempotency-Key e upload multipart de NF fake.
- Validado nesse ciclo:
  - Secretaria -> Head -> Aguardando NF -> NF recebida -> NF validada ->
    Pronta para Financeiro -> Pagamento.
  - Volta para Secretaria via Solicitar ajuste.
  - Rejeicao pelo Head Comercial voltando para Calculada/Revisao, com acao de
    Reabrir revisao para a Secretaria.
  - Solicitacao automatica de NF ao chegar na etapa e reenviar lembrete como
    segunda notificacao manual.
  - Upload de NF fake.
  - Solicitacao de correcao de NF, voltando para Aguardando NF com status NF
    solicitada.
  - Envio de pacote para pagamento.
  - Comissoes em pagamento com acoes_permitidas vazio.
- Resultado do ciclo 2026-05-teste-fluxo-auditado:
  44 eventos oficiais e 2 documentos de NF fake.

Auditoria completa das 13 comissoes ate pagamento:

- Foi criado o ciclo 2026-05-teste-fluxo-todas-pagamento.
- As 13 comissoes all-pay-seed-1 a all-pay-seed-13 foram executadas por
  endpoints reais na sequencia:
  Secretaria -> Head Comercial -> Solicitar NF -> Upload NF fake -> Validar NF
  -> Enviar pacote para pagamento.
- Todas as 13 terminaram com:
  status = enviada_pagamento,
  status_nf = validada,
  status_financeiro = pacote_enviado,
  status_pagamento = aguardando_pagamento,
  acoes_permitidas = [].
- Resultado do ciclo 2026-05-teste-fluxo-todas-pagamento:
  104 eventos oficiais e 13 documentos de NF fake.
- A sessao temporaria usada na auditoria HTTP foi removida ao final dos testes.

Objetivo do novo trabalho:

Transformar o MVP visual/operacional em fluxo auditavel real de backend e
produto, sem quebrar o frontend atual.

Entregaveis esperados:

1. matriz final de perfis, permissoes, status e acoes;
2. modelo canonico de tabelas;
3. consolidacao das migrations do schema de comissionamento;
4. endurecimento dos endpoints reais de fluxo;
5. motor de calculo versionado para Regra 01 e Regra 02;
6. persistencia de publicacao de regra com antes/depois;
7. upload protegido de Nota Fiscal;
8. historico oficial do modulo;
9. notificacoes/e-mails planejados com template versionado;
10. testes por perfil, permissao, status, NF, regra e responsividade.

Regras obrigatorias:

- Nao criar aplicacao separada.
- Nao criar runtime em /root/data-engineering.
- Tudo deve seguir a estrutura de /opt/7lm-connect/portal.
- Frontend nunca acessa banco diretamente.
- Dados devem passar por API, permissoes e auditoria.
- O Excel e seed/referencia inicial, nao runtime definitivo.
- Nao quebrar a rota /comercial/comissionamento.
- Nao remover o fallback React atual ate o backend real estar validado.
- Nao liberar envio real de e-mail, pagamento ou NF sem endpoint auditavel.

Primeira tarefa recomendada:

Produzir uma auditoria tecnico-funcional do fluxo ja implementado, contendo:

- tabelas provaveis;
- campos principais;
- status oficiais;
- transicoes permitidas;
- permissoes;
- endpoints;
- eventos de auditoria;
- casos de teste;
- ordem de implementacao.

Antes de ampliar regras, e-mails reais ou motor definitivo de calculo, confirme
o modelo canonico e as transicoes de status.
```

## Ajuste De Celeridade Do Fluxo - 2026-06-11

Decisao de negocio aplicada:

- `NF bloqueada` nao e status operacional do MVP.
- `NF nao solicitada` nao e status operacional do MVP.
- CLT sempre usa `status_nf = nao_aplicavel`.
- PJ/autonomo, ao chegar em `aguardando_nf`, ja recebe notificacao automatica e
  fica com `status_nf = solicitada`.
- A Secretaria usa `Reenviar aviso NF` apenas como segunda notificacao manual.
- `Solicitar correcao da NF` volta a comissao para `aguardando_nf` com
  `status_nf = solicitada`, sem criar etapa bloqueada.
- `Rejeitada` volta para a coluna `Calculada/Revisao`.
- Em `Rejeitada`, a unica acao da Secretaria e `Reabrir revisao`
  (`solicitar_ajuste`), que leva para `revisao_necessaria`.
- Depois de reaberta a revisao, a Secretaria pode enviar novamente para Head.

Compatibilidade tecnica:

- valores legados `nao_solicitada`, `bloqueada`, `bloqueado_nf` e
  `nf_correcao_solicitada` sao normalizados no frontend para `solicitada`.
- o preview da API tambem normaliza `nao_solicitada` e `bloqueada` para
  `solicitada`.
- os endpoints de acao tambem normalizam escrita: se a comissao exige NF e
  ainda possui status legado de NF, a proxima acao grava `status_nf =
  solicitada`; se for CLT, grava `status_nf = nao_aplicavel`.
- o campo legado `bloqueados_nf` permanece no resumo por compatibilidade, mas
  deve retornar `0` enquanto esse conceito nao fizer parte do fluxo oficial.

Validacao executada:

- `python -m py_compile` em rotas/repositorio/preview de comissionamento.
- `npm run build` no modulo React.
- restart do `7lm-connect-api`.
- `/comercial/comissionamento` retornou `200 OK`.
- chamada HTTP autenticada temporaria em
  `POST /api/comissionamento/resultados/audit-fluxo-seed-5/solicitar-ajuste`
  retornou `200`, mudou `rejeitada -> revisao_necessaria`, gravou evento
  `comissao_ajuste_solicitado` e normalizou `status_nf` para `solicitada`.
- preview do ciclo `2026-05-teste-fluxo-auditado` confirmou:
  `bloqueados_nf = 0`, NF antiga normalizada para `solicitada`, e comissao em
  revisao com acoes `enviar_head` e `solicitar_ajuste`.

## Auditoria Do Fluxo De Ajustes - 2026-06-11

Objetivo:

- garantir que `Solicitar ajuste` funcione tanto na Secretaria quanto no Head
  Comercial;
- garantir que o ajuste sempre devolva para `revisao_necessaria`;
- garantir que a Secretaria consiga seguir depois com `Enviar para Head`;
- impedir ajuste fora das etapas Secretaria/Head;
- garantir historico, notificacao auditavel e idempotencia.

Ajustes implementados:

- `CorpoAcaoComissionamento` passou a aceitar `comentario`, alem de
  `observacao` e `motivo`.
- `_comentario()` agora prioriza `comentario`, depois `observacao`, depois
  `motivo`.
- `solicitar_ajuste` aceita permissao de Secretaria ou permissao operacional de
  visualizacao usada pelo Head, mantendo as demais acoes restritas.
- `solicitar_ajuste` passou a validar etapa: so pode sair de
  `SECRETARIA_STATUSES` ou `HEAD_STATUSES`.
- tentativa de ajuste em NF, Financeiro ou Pagamento retorna `409`.
- card principal do Head Comercial passou a mostrar tambem `Solicitar ajuste`
  quando a API liberar essa acao.
- a notificacao automatica virou best-effort: se a infraestrutura futura de
  e-mail/fila ainda nao tiver tabelas, o botao nao quebra; o sistema registra
  `notificacao_automatica_disparada` no historico com
  `status_envio = pendente_integracao_email`.
- leitura de idempotencia foi corrigida para aceitar JSON salvo como objeto ou
  string JSON, evitando erro em clique duplo.

Ciclo temporario criado para auditoria:

```text
2026-05-teste-ajustes-auditoria-codex
```

Cenarios validados por HTTP real na API local:

- `ajuste-secretaria-codex`
  - antes: `calculado_seed`;
  - acao: `POST /api/comissionamento/resultados/{id}/solicitar-ajuste`;
  - usuario: Secretaria;
  - resultado: `200`, status `revisao_necessaria`;
  - historico: `comissao_ajuste_solicitado` +
    `notificacao_automatica_disparada`;
  - comentario persistido no historico;
  - clique duplo com mesma `Idempotency-Key` retornou `200` e manteve apenas 1
    evento `comissao_ajuste_solicitado`.

- `ajuste-head-codex`
  - antes: `aguardando_head_comercial`;
  - usuario: permissao `comissionamento.view`, sem `comissionamento.secretaria`;
  - resultado: `200`, status `revisao_necessaria`;
  - historico: `comissao_ajuste_solicitado` +
    `notificacao_automatica_disparada`;
  - comentario persistido no historico.

- `ajuste-nf-bloqueio-codex`
  - antes: `aguardando_nf`;
  - acao: `solicitar-ajuste`;
  - resultado: `409`;
  - mensagem: ajuste so pode ser solicitado enquanto a comissao esta com
    Secretaria ou Head Comercial.

Preview apos auditoria:

- comissoes ajustadas aparecem em `revisao_necessaria`;
- proxima acao volta para `enviar_head`;
- acoes permitidas: `enviar_head` e `solicitar_ajuste`;
- comissao em NF permanece com apenas `reenviar_lembrete_nf`.
