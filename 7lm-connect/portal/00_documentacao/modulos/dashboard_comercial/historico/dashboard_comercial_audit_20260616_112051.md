# Auditoria Dashboard Comercial - 2026-06-16

## Escopo

- Filtros globais do Dashboard Comercial.
- Cards expandidos e breakdowns analiticos.
- API FastAPI do modulo comercial.
- Fontes de corretores, SDRs, IPC e Resumo por Equipe.

## Fontes Confirmadas

- `connect_comercial.comercial_kpi_daily`
  - Fonte principal de KPIs, filtros agregados, tendencias, IPC e breakdowns.
  - Dados atuais no banco: 106918 linhas, de 2018-05-15 a 2026-06-16.
- `connect_comercial.comercial_base`
  - Fonte granular de leads/jornada e filtro de unidade.
  - Achado: `unidade_nome` esta vazia em todo o banco atual.
- `connect_comercial.hierarquia_cvcrm`
  - Hierarquia comercial copiada pelo sincronizador do Dashboard Comercial.
- `connect_comercial.dashboard_gc_produtividade_kpi_daily`
  - Base de produtividade usada pelo modulo Pessoas e Cultura/Gente e Gestao.
  - Dados atuais no banco: 91764 linhas, de 2024-06-01 a 2026-06-15.
- `connect_comercial.dashboard_gc_produtividade_hierarquia`
  - Fonte mensal de corretores ativos/equipe para Resumo por Equipe e comissionamento.

## Problemas Encontrados

1. O frontend chamava `/api/v1/dashboard/segmented/filters`, mas a FastAPI nao tinha esta rota.
2. O frontend chamava `/api/v1/dashboard/segmented/breakdown`, mas a FastAPI nao tinha esta rota.
3. A UI enviava filtros segmentados como `regiaoOperacao`, `corretorAtivo`, `sdrAtivo`, `gestorCorretor`, etc.; a API so reconhecia filtros antigos como `cidade`, `corretor`, `sdr`, `gerencia`.
4. Os cards expandidos buscavam KPIs como `pastas_aprovadas`, `pastas_condicionadas`, `pastas_reprovadas` e `pastas_com_respostas`; estes aliases nao existiam no mapa de expressoes da API.
5. A tabela antiga `comercial_indicador_segmentacao` nao existe no destino atual. A implementacao antiga em Express dependia dela; a API atual precisa usar fallback nas tabelas reais em `connect_comercial`.

## Correcoes Aplicadas

- Arquivo alterado: `01_codigo_fonte/api_7lm_connect/rotas/rotas_de_dashboard_comercial.py`.
- Adicionados aliases de filtros segmentados no backend para que os parametros enviados pelo frontend sejam aplicados.
- Adicionados aliases de KPI para os cards de propostas.
- Criado endpoint `GET /api/v1/dashboard/segmented/filters`.
- Criado endpoint `GET /api/v1/dashboard/segmented/breakdown`.
- Endpoints implementados com fallback em:
  - `connect_comercial.comercial_kpi_daily`;
  - `connect_comercial.comercial_base` para unidade;
  - `connect_comercial.dashboard_gc_produtividade_hierarquia` para corretor ativo.
- Reiniciado `7lm-connect-api.service`.

## Validacoes

- `py_compile` executado com sucesso no arquivo da rota.
- Funcoes auxiliares testadas contra o banco real.
- Exemplos retornados em junho/2026:
  - Regiao da Operacao: Aguas Lindas, Formosa, Catalao.
  - Breakdown LEADS por regiao: Aguas Lindas 4204, Formosa 1196, Catalao 804.
  - Empreendimento: AGL033 - Vila das Rosas 3874, FSA014 - Vila das Bromelias 963, CAT001 - Residencial Vivaz 804.
- Endpoints reais respondem `401 Credencial de acesso ausente` sem token, confirmando rota existente e protegida, nao 404.

## Pendencias De Dados

- `unidade_nome` esta vazia em `connect_comercial.comercial_base`; o filtro Unidade nao tem como trazer valores ate a carga preencher essa coluna.
- `comercial_indicador_segmentacao` e `hierarquia_sdr` nao existem no destino atual. Se o objetivo for recuperar a semantica exata da Gold antiga, o pipeline precisa voltar a sincronizar essas tabelas ou criar equivalentes em `connect_comercial`.
- O fallback de SDR ativo usa as dimensoes disponiveis em `comercial_kpi_daily`; nao ha uma hierarquia mensal dedicada de SDR no destino atual.
