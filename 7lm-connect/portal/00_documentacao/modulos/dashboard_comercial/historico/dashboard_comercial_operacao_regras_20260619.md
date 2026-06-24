# Dashboard Comercial - Operacao, Carga Direta e Regras de Negocio - 2026-06-19

Este documento registra os ajustes feitos em 2026-06-19 no Dashboard
Comercial, as regras de negocio implementadas e os pontos de validacao
operacional.

## Objetivo

- Retirar o fluxo com Postgres intermediario.
- Garantir carga direta Databricks -> Postgres final usado pelo portal.
- Validar os dados carregados em 2026-06-19.
- Corrigir a dependencia proibida de `corretores_ativos`.
- Consolidar regras novas das abas de corretores, foguetes, reservas e
  detalhamentos.

## Fluxo oficial de dados

O fluxo oficial passou a ser:

```text
Databricks data_platform_dev.gold_cvcrm
  -> Node pipeline
  -> Postgres final connect_comercial
  -> API/Frontend Dashboard Comercial
```

Pipeline oficial:

```text
/opt/7lm-connect/portal/05_modulos/dashboard_comercial/backend/scripts/sync-databricks-to-connect-comercial.js
```

Systemd oficial:

```text
/etc/systemd/system/7lm-dashboard-comercial-pipeline.service
/etc/systemd/system/7lm-dashboard-comercial-pipeline.timer
```

O timer roda de hora em hora:

```text
OnBootSec=5min
OnActiveSec=1h
OnUnitActiveSec=1h
Persistent=true
```

O servico usa:

```text
WorkingDirectory=/opt/7lm-connect/portal/05_modulos/dashboard_comercial
ExecStart=/usr/bin/npm run data:update:connect
Environment=NODE_OPTIONS=--max-old-space-size=4096
```

O `NODE_OPTIONS` e necessario porque a carga baixa volumes grandes do
Databricks. A execucao manual fora do systemd pode morrer por falta de heap.

## Origem Databricks

Catalog/schema:

```text
data_platform_dev.gold_cvcrm
```

Views/tabelas consumidas:

- `vw_bi_comercial_base`
- `vw_bi_propostas_historico`
- `vw_bi_propostas_consolidada`
- `vw_bi_cancelamentos`
- `vw_bi_distratos`
- `dim_empreendimento`
- `dim_lead`
- `dim_precadastro`
- `cvcrm_campos_adicionais_reserva_wide`
- `cvcrm_campos_adicionais_repasse_wide`

## Destino Postgres final

Schema final:

```text
connect_comercial
```

Tabelas finais carregadas:

- `connect_comercial.comercial_base`
- `connect_comercial.comercial_propostas_historico`
- `connect_comercial.comercial_propostas_consolidada`
- `connect_comercial.comercial_cancelamentos`
- `connect_comercial.comercial_distratos`
- `connect_comercial.dim_empreendimento`
- `connect_comercial.comercial_kpi_daily`

Para cada tabela principal existe uma staging com sufixo `_staging`.

Regra de promocao:

1. Trunca staging.
2. Insere dados vindos do Databricks na staging.
3. Valida que staging nao esta vazia.
4. Trunca tabela final.
5. Promove staging para tabela final.
6. Recalcula `comercial_kpi_daily`.
7. Registra resultado em `dashboard_comercial_sync_log`.

O pipeline usa `application_name`:

```text
7lm_dashboard_comercial_databricks_direct
```

## Postgres intermediario

O Postgres intermediario deixou de fazer parte da operacao oficial.

O script legado local:

```text
01_codigo_fonte/api_7lm_connect/scripts/sincronizar_dashboard_comercial.py
```

fica bloqueado por padrao. Ele so executa se:

```text
ALLOW_LEGACY_DASHBOARD_COMERCIAL_SYNC=1
```

Sem essa variavel, o script aborta e orienta usar o pipeline oficial
Databricks -> `connect_comercial`.

Tambem foram desativados no servidor remoto `7lmdev01` os jobs antigos que
ainda escreviam no Postgres final a partir de `source_schema = public`:

- `7lm-dashboard-comercial-sync.service`
- `7lm-dashboard-comercial-sync.timer`
- `commercial-dashboard-scheduler.service`

As units foram arquivadas com sufixo `.disabled-direct-databricks-*`.
Os crons remotos antigos foram comentados.

## Regra sobre `corretores_ativos`

Regra definida:

```text
Nao pode existir nem ser carregada a tabela data_platform_dev.gold_cvcrm.corretores_ativos.
```

Contexto:

- A view permanente `data_platform_dev.gold_cvcrm.vw_bi_comercial_base`
  referenciava `corretores_ativos` para preencher `coordenador_nome` e
  `coordenador_documento`.
- Essa tabela nao deve mais existir.
- A tabela de compatibilidade criada durante a investigacao foi removida.
- Validacao apos ajuste: `corretores_ativos` nao aparece em
  `system.information_schema.tables`.

Como o usuario do job no Databricks e `automacaoprocessos@7lm.com.br` e a
view permanente pertence a `hudson.porto@7lm.com.br`, o job nao tem permissao
para alterar a view oficial no Unity Catalog.

Solucao implementada no pipeline:

- O script le a definicao da view em `system.information_schema.views`.
- Remove da definicao o bloco que referencia `corretores_ativos`.
- Substitui os campos de coordenador derivados dessa dependencia por `null`.
- Cria views temporarias de sessao:
  - `pipeline_vw_bi_comercial_base`
  - `pipeline_vw_bi_propostas_historico`
  - `pipeline_vw_bi_propostas_consolidada`
  - `pipeline_vw_bi_cancelamentos`
  - `pipeline_vw_bi_distratos`
- As consultas da carga usam essas views temporarias.
- Nenhuma tabela fisica `corretores_ativos` e criada.

Para corrigir a view permanente no Databricks, o owner da view deve aplicar a
mesma remocao ou conceder `MANAGE` ao usuario de automacao.

## Validacao da carga em 2026-06-19

Execucao oficial validada:

```text
started_at:  2026-06-19 16:33:15 UTC
finished_at: 2026-06-19 16:41:44 UTC
status: success
source_schema: data_platform_dev.gold_cvcrm
target_schema: connect_comercial
```

Volumes carregados:

```text
comercial_base:                  147369
comercial_propostas_historico:   158025
comercial_propostas_consolidada: 21707
comercial_cancelamentos:         1161
comercial_distratos:             436
dim_empreendimento:              34
comercial_kpi_daily:             107582
```

Freshness no Postgres final:

```text
max_dt_cadastro_reserva:   2026-06-19 12:11:00
max_data_venda:            2026-06-18 15:50:52
reservas em 2026-06-19:    1
reservas desde 2026-06-17: 18
```

## Consultas de validacao

Ultimas cargas:

```sql
select
  id,
  started_at,
  finished_at,
  status,
  source_schema,
  duration_seconds,
  message,
  table_counts
from connect_comercial.dashboard_comercial_sync_log
order by id desc
limit 10;
```

Freshness da base final:

```sql
select
  count(*)::bigint as total,
  max(dt_cadastro_reserva) as max_dt_cadastro_reserva,
  max(data_venda) as max_data_venda,
  count(*) filter (where dt_cadastro_reserva::date = date '2026-06-19') as reservas_19,
  count(*) filter (where dt_cadastro_reserva::date >= date '2026-06-17') as reservas_desde_17
from connect_comercial.comercial_base;
```

Processo ativo no Postgres:

```sql
select
  pid,
  state,
  wait_event_type,
  wait_event,
  now() - query_start as query_age,
  left(query, 240) as query
from pg_stat_activity
where application_name = '7lm_dashboard_comercial_databricks_direct'
order by query_start nulls last;
```

Status do timer:

```bash
systemctl status 7lm-dashboard-comercial-pipeline.timer --no-pager -l
systemctl status 7lm-dashboard-comercial-pipeline.service --no-pager -l
journalctl -u 7lm-dashboard-comercial-pipeline.service -n 160 --no-pager
```

## Regras de negocio - Corretores Foguetes

Objetivo:

```text
Mostrar corretores de alta performance comercial com base em repasses recentes.
```

Regra de entrada:

```text
Corretor Foguete = corretor com quantidade de repasses no mes anterior >= 2.
```

Observacoes:

- A regra foi alterada de `> 2` para `>= 2`.
- O periodo de entrada e sempre o mes anterior ao periodo de analise.
- O bloco "Regra de Entrada" deve deixar claro que considera corretores com
  repasses no periodo demarcado do mes anterior.
- A tela nao deve depender de `corretores_ativos` do Databricks.
- O enquadramento usa a fato comercial e, quando necessario, a hierarquia ativa
  de `sevenlm_connect.funcionario_acesso`.

Tabela "Foguetes Pelo Mes Anterior":

- Deve ser compacta, com visual de informacao.
- Deve trazer somente corretores com `repasses_mes_anterior >= 2`.
- Deve mostrar:
  - corretor
  - equipe/imobiliaria quando disponivel
  - repasses no mes anterior
  - repasses no mes atual
  - status visual "Foguete"

Analises e graficos:

- A visao deve ter storytelling, nao apenas tabela densa.
- KPIs principais:
  - total de foguetes ativos
  - total de vendas dos foguetes
  - contribuicao dos foguetes nos repasses da operacao
  - totais dos indicadores principais dos foguetes
- O comparativo deve usar totais quando a leitura pedida for total, nao media.
- Indicadores usados:
  - Pastas Com Respostas
  - Pastas Condicionadas
  - Pastas Aprovadas
  - Pastas Reprovadas
  - Vendas
  - Vendas Finalizadas
  - Repasses
- Leads e visitas nao entram nos cards solicitados para foguetes.

Top Empreendimentos Convertidos:

- Deve ser grafico de barra simples.
- Deve mostrar rotulo de dados simples.
- Deve permitir drill-down/detalhamento.
- O empreendimento deve refletir vendas/repasses dos foguetes.

Frequencia de foguete:

- Classifica quantas vezes um corretor virou foguete no periodo.
- A frequencia e calculada por meses em que o corretor atingiu
  `repasses >= 2`.

## Regras de negocio - Consolidado Corretor e Corretor Diario

Filtros:

- Ambos devem ter filtro de ativo.
- O ativo vem do headcount/funcionarios do dashboard comercial, nao de
  `corretores_ativos` Databricks.
- Os corretores ativos esperados no contexto validado eram aproximadamente 59.

Cards removidos:

- Linhas
- Corretores Na Pagina
- Leads Na Pagina
- Vendas Na Pagina
- Repasses Na Pagina

Detalhamento:

- Todos os numeros clicaveis devem abrir detalhamento.
- A tabela por regiao do Consolidado Corretor tambem deve ter numeros
  clicaveis.
- O detalhamento deve abrir em painel lateral no painel inteiro.
- Cada aba/grafico/campo deve ter seu proprio detalhamento e calculo
  compativel com o numero clicado.
- Campos padrao do detalhamento devem priorizar:
  - Empreendimento
  - Imobiliaria
  - Regiao
  - Cliente, quando fizer sentido depois desses campos
  - Identidade do corretor: `corretor_identity_key`, e-mail/nome da
    `dim_corretor` e chave de funcionario vinculada
  - IDs operacionais: idcorretor, idprecadastro, idreserva, idrepasse
  - Datas do evento detalhado

Nas abas de corretor, o detalhamento deve filtrar pela mesma
`corretor_identity_key` usada no agregado. A resolucao preferencial e:

```text
fato -> dim_corretor -> funcionario_acesso
```

O e-mail normalizado de `dim_corretor` e a ponte principal com
`funcionario_acesso`. Nome normalizado e somente fallback.

## Regras de negocio - Reservas

Objetivo:

```text
Transformar Reservas em painel de alta performance para identificar situacoes,
SLA e volume por fatias estrategicas.
```

Cards de situacao:

- Devem mostrar todas as situacoes do BI, mesmo que o valor seja zero.
- Ordem visual:
  1. Em processo
  2. Secretaria de Vendas
  3. Envio SIENGE
  4. Credito
  5. Fase CreditU
  6. Assinatura 7LM
  7. Aprovado Diretoria
  8. Venda finalizada

Cada card mostra:

- nome da situacao
- quantidade de reservas
- contador de "Em Atraso"

Regra importante:

- Esses cards nao devem ser filtrados pelo filtro geral de periodo da pagina.
- A referencia temporal do SLA usa a data em que a reserva chegou na situacao,
  equivalente a `dt_ultima_alteracao_situacao`.
- No codigo/base, essa data pode aparecer como:
  - `referencia_data`
  - `data_ultima_situacao`
  - `ultima_modificacao_situacao`
  - `dt_ultima_alteracao_situacao`

Regra de SLA:

```text
SLA Tempo na Situacao = DATEDIFF(dt_ultima_alteracao_situacao, TODAY(), DAY)
```

Limites:

```text
Credito:               1 dia
Em Processo:           7 dias
Secretaria de Vendas:  1 dia
Assinatura Diretoria:  1 dia
Envio Mega/SIENGE:     1 dia
Venda finalizada:      10 dias
Fase CreditU:          2 dias
```

Classificacao:

```text
Se SLA Tempo na Situacao > limite da situacao, entao "SLA Expirado".
Caso contrario, "Dentro do SLA".
```

Tabela detalhada por reserva:

- Deve conter `data_cadastro_reserva`.
- Deve ordenar por `data_cadastro_reserva`.
- Deve exibir coluna SLA.
- Linhas com `SLA Expirado` devem ter destaque visual.
- Clique em "SLA Expirado" nos cards deve filtrar a tabela detalhada.

Graficos de reservas:

- Usar barras horizontais simples para Top 5:
  - Imobiliaria
  - Regiao
  - Empreendimento
  - Volume por data de cadastro
- Mostrar valor total na ponta da barra.
- Evitar grid visual poluido.

Grafico de volume por data:

- Deve permitir drill-down no estilo Power BI:
  - ano
  - trimestre
  - mes
  - semana
  - dia
- Ao selecionar trimestre, mostrar todos os trimestres do ano atual.
- Ao selecionar mes, mostrar todos os meses ate o mes atual.
- Ao selecionar dia, mostrar todos os dias do mes atual ate o dia atual.

## Seguranca

Credenciais nao devem ser documentadas nem exibidas em logs.

Como uma senha foi compartilhada em chat durante a investigacao, a recomendacao
operacional e rotacionar a senha do usuario afetado e qualquer token exposto
durante a sessao.

## Pendencias conhecidas

- A view permanente `data_platform_dev.gold_cvcrm.vw_bi_comercial_base` ainda
  precisa ser corrigida pelo owner no Databricks para remover definitivamente a
  referencia a `corretores_ativos`.
- Enquanto isso nao acontece, o pipeline oficial esta protegido usando views
  temporarias de sessao sem `corretores_ativos`.
- O job automatico ja esta validado e funcionando com essa protecao.
