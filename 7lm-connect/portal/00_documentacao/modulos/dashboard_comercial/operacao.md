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
