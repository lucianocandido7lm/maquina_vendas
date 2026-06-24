# Prompt - Backend API 7LM Connect

Voce e um agente backend trabalhando na API FastAPI do 7LM Connect.

Raiz da API:

```text
/opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect
```

Padroes:

- `aplicacao.py`: registro de routers.
- `rotas/`: endpoints HTTP.
- `servicos/`: regra de negocio.
- `repositorios/`: consultas e persistencia.
- `modelos/`: schemas/modelos.
- `utilitarios/`: helpers compartilhados.
- `dependencias.py`: autenticacao.
- `banco.py`: pool asyncpg.

Regras:

- Toda rota protegida deve usar `Depends(obter_usuario_autenticado)`.
- Toda funcionalidade sensivel deve validar permissao com
  `exigir_permissao_portal`.
- Nao colocar secrets em codigo.
- Nao abrir endpoint sem validar permissao.
- Preferir SQL parametrizado.
- Evitar duplicar SQL grande em varias rotas; extrair para servico/repositorio
  se crescer.

Para Dashboard Comercial:

- Rotas ficam em `rotas/rotas_de_dashboard_comercial.py`.
- Schema comercial vem de `configuracoes.ESQUEMA_COMERCIAL`.
- Dados principais vem de `connect_comercial.comercial_kpi_daily`.
- Permissao de leitura: `dashboard.comercial.view`.
- Permissao de gestao: `dashboard.comercial.manage`.
- Maquina de Vendas usa `maquina.vendas.dashboard.view` e
  `maquina.vendas.dashboard.manage`.

Endpoints comerciais existentes:

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/trends`
- `GET /api/v1/dashboard/overview`
- `GET /api/v1/dashboard/breakdown`
- `GET /api/v1/dashboard/filters`
- `GET /api/v1/dashboard/filters/search`
- `GET /api/v1/leads`
- `GET /api/v1/dashboard/goals`
- `PUT /api/v1/dashboard/goals/{kpi_id}`
- `POST /api/v1/dashboard/refresh-data`
- `GET /api/v1/dashboard/ipc-insights`
- `GET /api/v1/dashboard/sla-repasse-insights`
- `GET /api/v1/dashboard/sla-finalizacao-insights`
- `GET /api/connect-comercial/dashboard-maquina-vendas`

Filtros aceitos no Dashboard Comercial:

- `startDate`
- `endDate`
- `cidade`
- `origem`
- `empreendimento`
- `empreendimentoReduzido`
- `sdr`
- `corretor`
- `gerencia`
- `coordenacao`
- `imobiliaria`

Regras tecnicas:

- Preservar `VALOR_EM_BRANCO = "__blank__"`.
- Preservar ignorados: vazio, `todos`, `todas`, `all`, `undefined`, `null`.
- Nao calcular KPI com divisao por zero.
- Se adicionar filtro, atualizar API e frontend no mesmo padrao.
- Se adicionar indicador, atualizar SQL, response e frontend/catalogo.

Validacao minima:

```bash
python -m py_compile /opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect/rotas/rotas_de_dashboard_comercial.py
systemctl restart 7lm-connect-api.service
systemctl status 7lm-connect-api.service
```

Antes de concluir, informar:

- endpoints alterados;
- permissao exigida por endpoint;
- tabelas consultadas;
- parametros/filtros aceitos;
- exemplo de validacao HTTP ou SQL.
