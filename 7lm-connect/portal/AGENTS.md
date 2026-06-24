# Guia Para Agentes E Desenvolvedores

Este arquivo orienta agentes e desenvolvedores que forem trabalhar no portal
7LM Connect em `/opt/7lm-connect/portal`.

Antes de alterar codigo, leia:

- `00_documentacao/README.md`
- `00_documentacao/arquitetura/mapa-diretorios.md`
- `00_documentacao/seguranca/perimetro-api-banco.md`
- `00_documentacao/operacao/migracao-dev-para-producao-dashboard-comercial.md`
- `00_documentacao/modulos/dashboard_comercial/operacao.md`
- `00_documentacao/agentes/README.md`

## Estado Operacional Atual

O runtime oficial atual desta maquina usa `/opt/7lm-connect/portal`.

Nao usar `/root/data-engineering/apps/commercial-dashboard` para novos jobs,
deploys ou desenvolvimento operacional do Dashboard Comercial. Esse caminho
permanece apenas como historico/backup local e nao deve ser tratado como runtime.

Servicos ativos:

- `7lm-connect-api.service`
- `7lm-connect-portal.service`
- `7lm-dashboard-comercial-pipeline.timer`

Servicos antigos que nao devem ser reativados:

- `commercial-dashboard.service`
- `commercial-dashboard-preview.service`
- `commercial-dashboard-scheduler.service`
- `7lm-dashboard-comercial-sync.service`
- `7lm-dashboard-comercial-sync.timer`

## Regra De Ouro

Siga a organizacao existente. Nao crie uma arquitetura paralela.

- API Python fica em `01_codigo_fonte/api_7lm_connect`.
- Rotas ficam em `01_codigo_fonte/api_7lm_connect/rotas`.
- Servicos de dominio ficam em `01_codigo_fonte/api_7lm_connect/servicos`.
- Repositorios/acesso a banco ficam em `01_codigo_fonte/api_7lm_connect/repositorios`.
- Modelos/schemas ficam em `01_codigo_fonte/api_7lm_connect/modelos`.
- Utilitarios compartilhados ficam em `01_codigo_fonte/api_7lm_connect/utilitarios`.
- Scripts operacionais Python ficam em `01_codigo_fonte/api_7lm_connect/scripts`.
- Frontend publico servido pelo portal fica em `02_publico`.
- Fonte de modulos frontend fica em `05_modulos`.
- SQL, migrations e units de referencia ficam em `Servidor`.
- Documentacao e prompts ficam em `00_documentacao`.

## Seguranca Do Perimetro

O caminho correto e:

```text
Internet -> Apache HTTPS -> Portal Node -> /api proxy -> FastAPI -> Postgres
```

Frontend nao deve falar direto com banco. Novos modulos tambem nao devem
introduzir acesso direto a dados pelo navegador.

Dados e banco devem estar vinculados a API, permissoes e auditoria:

- autenticacao em `dependencias.py`;
- permissoes em `utilitarios/autorizacao.py`;
- auditoria no middleware de `aplicacao.py`;
- acesso a banco via backend, repositorios, servicos ou pipelines oficiais.

Leia `00_documentacao/seguranca/perimetro-api-banco.md` antes de criar rotas,
jobs, conexoes externas ou novos modulos com dados sensiveis.

## Agentes Especificos Do Projeto

Antes de iniciar uma tarefa, escolha o agente certo em
`00_documentacao/agentes`:

- `prompt_arquiteto.md`: quando a decisao for onde colocar a solucao.
- `prompt_novo_modulo_7lm_connect.md`: quando for criar modulo novo.
- `prompt_backend_api.md`: quando envolver FastAPI, rotas, SQL ou response.
- `prompt_frontend_portal.md`: quando envolver React/Vite, paginas ou build.
- `prompt_produto_regras_comerciais.md`: quando envolver indicador, filtro,
  regra comercial ou novo bloco do Dashboard Comercial.
- `prompt_orquestrador_comissionamento.md`: quando envolver o novo modulo de
  comissionamento, Excel de regras, planejamento ou divisao de tarefas.
- `prompt_dados_dashboard_comercial.md`: quando envolver Databricks,
  `connect_comercial`, staging, `comercial_kpi_daily` ou timer de carga.
- `prompt_qa_auditoria_dashboard_comercial.md`: quando for validar se filtros,
  graficos, API e dados continuam corretos.
- `prompt_seguranca_permissoes.md`: quando envolver autenticacao, autorizacao,
  permissao, auditoria ou secrets.
- `prompt_devops_systemd.md`: quando envolver systemd, timers, logs ou runtime.
- `prompt_migracao_dev_producao.md`: quando for levar mudanca para producao.

Todo agente deve encerrar o trabalho informando arquivos alterados, regra de
negocio impactada, validacoes executadas e risco residual.

## Dashboard Comercial

O Dashboard Comercial tem duas partes:

1. API integrada ao portal:
   - `01_codigo_fonte/api_7lm_connect/rotas/rotas_de_dashboard_comercial.py`

2. Fonte React/Vite:
   - `05_modulos/dashboard_comercial`

Build do frontend:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
npm run build
```

O build publica em:

```text
/opt/7lm-connect/portal/02_publico/02_recursos/05_modulos/dashboard_comercial
```

## Pipeline De Dados Do Dashboard Comercial

Pipeline oficial atual:

```text
/opt/7lm-connect/portal/05_modulos/dashboard_comercial/backend/scripts/sync-databricks-to-connect-comercial.js
```

Comando:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
npm run data:update:connect
```

Fonte:

- Databricks `gold_cvcrm`.

Destino:

- `connect_comercial` no banco usado pelo `/opt`.

Hierarquia:

- `sevenlm_connect.funcionario_acesso`.

Regra aplicada:

- Nao copiar mais hierarquia para `funcionario_acesso_connect` neste fluxo.
- A hierarquia e consultada diretamente em `sevenlm_connect.funcionario_acesso`.
- O match de corretor normaliza sufixos como `- CLT`, `- PJ`, `- DESLIGADO`,
  `- DEMITIDO` e `- INATIVO`.

## Como Criar Novos Blocos

Para novo bloco visual no Dashboard Comercial:

1. Defina a regra de negocio e a metrica.
2. Verifique se os dados existem em `connect_comercial.comercial_kpi_daily` ou
   em uma tabela final do schema `connect_comercial`.
3. Se precisar API nova, adicione rota em
   `rotas_de_dashboard_comercial.py` ou extraia servico em `servicos`.
4. Se precisar transformacao de dados, altere o pipeline em
   `sync-databricks-to-connect-comercial.js` e documente a tabela/coluna.
5. Adicione o componente no padrao de `05_modulos/dashboard_comercial/src`.
6. Rode validacoes antes de concluir.

Nao coloque regra pesada de negocio somente no frontend quando ela precisa ser
consistente para API, BI e exportacao.

## Validacoes Minimas

API Python:

```bash
python -m py_compile /opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect/rotas/rotas_de_dashboard_comercial.py
```

Pipeline JS:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
node --check backend/scripts/sync-databricks-to-connect-comercial.js
npm run data:update:connect:dry-run
```

Frontend:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
npm run build
```

Systemd:

```bash
systemctl status 7lm-connect-api.service
systemctl status 7lm-connect-portal.service
systemctl status 7lm-dashboard-comercial-pipeline.timer
```

## Cuidados

- Nao commitar secrets.
- Nao expor conteudo de `.env`.
- Nao editar `node_modules`.
- Nao alterar `backups` como fonte oficial.
- Nao mudar estrutura de diretorios sem necessidade clara.
- Nao reintroduzir dependencia operacional em `/root/data-engineering`.
