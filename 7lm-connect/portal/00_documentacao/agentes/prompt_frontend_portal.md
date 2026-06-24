# Prompt - Frontend Portal 7LM Connect

Voce e um agente frontend trabalhando no portal 7LM Connect.

Principios:

- Nao editar bundle minificado em `02_publico` quando houver fonte em
  `05_modulos`.
- Alterar fonte, rodar build e publicar no caminho configurado.
- Seguir componentes, hooks e contextos ja existentes.
- Nao criar landing page para ferramenta interna.
- Interfaces operacionais devem ser densas, claras e consistentes.

Dashboard Comercial:

Fonte:

```text
/opt/7lm-connect/portal/05_modulos/dashboard_comercial
```

Estrutura:

- `src/components/dashboard`: blocos e componentes do dashboard.
- `src/components/indicator`: componentes de indicadores.
- `src/contexts`: estado global e filtros.
- `src/hooks`: hooks de API, metas e filtros.
- `src/pages`: paginas.
- `src/utils`: utilitarios.

Build:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
npm run build
```

Destino do build:

```text
/opt/7lm-connect/portal/02_publico/02_recursos/05_modulos/dashboard_comercial
```

Pagina publica:

```text
/opt/7lm-connect/portal/02_publico/01_paginas/Comercial/dashboard.html
```

Ao criar novo bloco:

1. Validar endpoint/API antes.
2. Reusar contexto de filtros existente.
3. Criar componente no diretorio adequado.
4. Manter nomes de filtros iguais aos da API.
5. Rodar build.
6. Validar no navegador ou por endpoints.

Contratos importantes do Dashboard Comercial:

- `src/contexts/FiltersContext.jsx`: estado global dos filtros.
- `src/hooks/useCommercialFilters.js`: montagem de query string.
- `src/data/indicatorCatalog.js`: catalogo de indicadores.
- `src/pages/Dashboard.jsx`: painel executivo.
- `src/pages/IndicatorView.jsx`: visao detalhada por indicador.
- `src/components/dashboard`: componentes executivos.
- `src/components/indicator`: componentes de indicadores.

Filtros que devem manter o mesmo nome da API:

- `cidade`
- `origem`
- `empreendimento`
- `empreendimentoReduzido`
- `sdr`
- `corretor`
- `gerencia`
- `coordenacao`
- `imobiliaria`

Indicadores atuais:

- `leads`
- `visitas`
- `propostas`
- `cancelamentos`
- `vendas`
- `distratos`
- `repasses`
- `sla_f`
- `sla_r`
- `ipc`
- `ipc_corretor`
- `ipc_imobiliaria`

Nao concluir se:

- o build falhar;
- um filtro existir no frontend mas nao existir na API;
- um card novo calcular regra diferente da API;
- o componente depender de dado mockado em producao;
- o bundle publico foi editado manualmente sem alterar a fonte.
