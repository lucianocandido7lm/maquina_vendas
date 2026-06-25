# Modulo Dashboard Comercial

## Localizacao

Fonte do modulo:

```text
/opt/7lm-connect/portal/05_modulos/dashboard_comercial
```

API do dashboard:

```text
/opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect/rotas/rotas_de_dashboard_comercial.py
```

Pagina publica:

```text
/opt/7lm-connect/portal/02_publico/01_paginas/Comercial/dashboard.html
```

Build publico:

```text
/opt/7lm-connect/portal/02_publico/02_recursos/05_modulos/dashboard_comercial
```

## Desenvolvimento De Frontend

Padrao atual:

- React;
- Vite;
- componentes em `src/components`;
- hooks em `src/hooks`;
- contexto/filtros em `src/contexts`;
- paginas em `src/pages`;
- utilitarios em `src/utils`.

Comandos:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
npm run build
```

## Desenvolvimento De API

Rotas do Dashboard Comercial:

```text
01_codigo_fonte/api_7lm_connect/rotas/rotas_de_dashboard_comercial.py
```

Padrao:

- receber request na rota;
- exigir usuario autenticado;
- exigir permissao com `exigir_permissao_portal`;
- montar filtros por query params;
- consultar `connect_comercial`;
- serializar resposta.

Permissoes:

- leitura: `dashboard.comercial.view`;
- gestao: `dashboard.comercial.manage`.

## Pipeline De Dados

Script:

```text
backend/scripts/sync-databricks-to-connect-comercial.js
```

Comando:

```bash
npm run data:update:connect
```

Dry-run:

```bash
npm run data:update:connect:dry-run
```

Systemd:

```text
7lm-dashboard-comercial-pipeline.service
7lm-dashboard-comercial-pipeline.timer
```

## Fluxo De Dados

```text
Databricks
  -> tabelas _staging em connect_comercial
  -> tabelas finais em connect_comercial
  -> comercial_kpi_daily
  -> API FastAPI
  -> frontend React no portal
```

Hierarquia:

```text
sevenlm_connect.funcionario_acesso
  -> gerencia/coordenacao/imobiliaria em comercial_kpi_daily
```

## Padrao De Contagem De Funcionarios

A regra canonica para HC, funcionarios ativos, denominador de IPC e preservacao
de volume operacional esta documentada em:

```text
00_documentacao/modulos/dashboard_comercial/padrao-headcount-funcionarios-operacao.md
```

Resumo operacional:

- `sevenlm_connect.funcionario_acesso` define o cadastro completo de pessoas,
  segmento `CORRETOR`/`SDR`, gestor, coordenador, regiao e imobiliaria;
- `connect_comercial.comercial_kpi_daily` define volume de fatos;
- HeadCount e IPC aplicam a regra oficial de ativo separadamente;
- volume de fato sem funcionario ativo deve ser preservado como
  `Inativos/Outros`;
- `Inativos/Outros` entra nos totais operacionais, mas nao entra no denominador
  de IPC.

## Regra Do Funil Comercial

Na etapa `RESERVA` do Funil Comercial:

- tabela: `connect_comercial.comercial_base`;
- data canonica: `dt_cadastro_reserva`;
- contagem: uma reserva por cliente no mes;
- chave do cliente: `idcliente_canonico`; se ausente, CPF/CNPJ normalizado; se
  ausente, `idreserva`;
- deduplicacao: quando o cliente tiver mais de uma reserva no periodo, usar a
  reserva com maior `dt_cadastro_reserva`; no empate, usar a referencia mais
  recente e depois a linha nao cancelada;
- regra: conta a reserva mais recente do cliente no periodo.

Nao usar `data_venda` nem `dt_contrato_contabilizado` como base do indicador
`RESERVA`.

`CANCELADO` e `DISTRATO` aparecem no painel do funil como indicadores laterais
por periodo e filtros gerais. Eles nao entram no calculo de conversao entre
etapas e nao alteram `% Conversao`, `% Anterior`, metas dinamicas ou tendencia.

O `SLA - Medio` do funil e a media de dias entre a data da etapa atual e a data
da proxima etapa do mesmo cliente/chave operacional. Exemplo: em `AGENDAMENTO`,
mede a diferenca entre a data do agendamento e a proxima data de `VISITA`.

No funil, o filtro de `cidade` e ignorado/removido da tela. Os filtros gerais de
regiao, empreendimento, imobiliaria, corretor, SDR e origem continuam ativos.

## Drill-Down Do Consolidado De Metas

Na aba `Consolidado De Metas` do Funil de Vendas, o clique em uma linha deve
abrir a aba `Detalhamento Operacional` com a mesma etapa e o mesmo escopo de
datas da linha clicada:

- tabela `Realizado e Meta Dinamica`: usa o trimestre consolidado retornado em
  `quarterPeriod`;
- tabela `Acompanhamento Atual`: usa o periodo atual retornado em `period`;
- os filtros hierarquicos ativos continuam sendo enviados ao endpoint de
  detalhe;
- o total visual exibido no cabecalho do detalhe deve partir da linha clicada
  ate a API retornar a conciliacao final.

## Como Criar Novo Bloco No Dashboard

1. Definir pergunta de negocio.
2. Identificar fonte:
   - se ja existe em `comercial_kpi_daily`, usar API atual;
   - se existe em tabela final, criar agregacao na API ou no pipeline;
   - se nao existe, adicionar no pipeline Databricks -> Postgres.
3. Criar ou alterar endpoint em `rotas_de_dashboard_comercial.py`.
4. Criar componente em `src/components/dashboard` ou `src/components/indicator`.
5. Conectar ao hook/contexto existente.
6. Rodar build.
7. Validar endpoint e filtro.

## Nao Fazer

- Nao criar backend Express novo para o dashboard.
- Nao reativar `commercial-dashboard.service`.
- Nao reativar `commercial-dashboard-scheduler.service`.
- Nao usar `/root/data-engineering` como runtime.
- Nao editar bundle minificado em `02_publico` quando houver fonte em
  `05_modulos`.
