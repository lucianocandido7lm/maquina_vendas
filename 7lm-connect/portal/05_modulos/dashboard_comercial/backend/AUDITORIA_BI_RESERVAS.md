# Auditoria BI de Reservas

Data da auditoria: 2026-06-17.

## Fontes avaliadas

- `connect_comercial.imovel_reserva`: existe, mas contem apenas reserva operacional do modulo de imovel (`identificador_reserva`, `status`, `reservado_em`, etc.). Nao tem os campos do Power BI.
- `connect_comercial.comercial_kpi_daily`: agregado diario comercial. Nao tem granularidade de reserva nem campos adicionais.
- `connect_comercial.comercial_base`: fonte adotada para o BI de Reservas. Tem `idreserva`, `idrepasse`, datas de referencia/cadastro/cancelamento/contrato/assinatura, situacao, corretor, imobiliaria, regiao, origem, empreendimento, SLA de finalizacao/repasse e campos adicionais de reserva/repasse sincronizaveis do Databricks.

## Colunas do Power BI verificadas

- `dt_referencia_reserva`: existe no Databricks e foi adicionada ao Postgres como fonte equivalente de `referencia_data_reserva`.
- `reserva_campos_adicionais_data_qr`: existe no Databricks e foi adicionada ao Postgres.
- `reserva_campos_adicionais_reserva_kit_agehab`: existe no Databricks e foi adicionada ao Postgres.
- `reserva_campos_adicionais_reserva_kit_cef`: existe no Databricks e foi adicionada ao Postgres.
- `reserva_campos_adicionais_reserva_obs_finalizacao`: existe no Databricks e foi adicionada ao Postgres.
- `reserva_campos_adicionais_reserva_repasse_no_mes`: existe no Databricks e foi adicionada ao Postgres.
- `.Flag_Sec_Vendas_Credito`: nao apareceu na `gold_cvcrm.vw_bi_comercial_base`; segue como lacuna/regra aproximada.
- `reserva_data_cad` / `reserva_data_cadastro` com esse nome literal: equivalente atual `dt_cadastro_reserva`.

## Regras migradas

- Reservas cadastradas / ultima modificacao: `count(distinct idreserva)` com `coalesce(dt_referencia_reserva, dt_cadastro_reserva)` no periodo.
- Vendidas/finalizadas: `count(distinct idreserva)` com `dt_contrato_contabilizado` no periodo.
- Venda finalizada mes atual sem assinatura: `count(distinct idreserva)` com `dt_contrato_contabilizado` no periodo e `dt_assinatura_contrato is null`.
- Repasses por assinatura: `count(distinct idrepasse)` com `dt_assinatura_contrato` no periodo.
- Canceladas: `count(distinct idreserva)` com `dt_cancelamento_reserva` no periodo.
- Distratos: `count(distinct idreserva)` no periodo de cadastro cuja `reserva_situacao_nome` contenha `distrato`.
- Conversao reserva para venda: vendidas / cadastradas.
- SLA criado medio: media de dias entre `dt_cadastro_reserva` e `now()` para reservas em situacoes nao finais.
- Meta ajustada: salva em `connect_comercial.dashboard_goals` com `kpi_id = reservas_prev_repasse`, `hierarchy_level = imobiliaria` e `hierarchy_value = regiao || '|||' || imobiliaria`.

## Regras aproximadas ou pendentes

- `Contagem Reserva Ultima Modificacao Mes Atual`: migrada para `coalesce(dt_referencia_reserva, dt_cadastro_reserva)`.
- `Contagem de Reservas Situacoes`: aproximada por situacoes nao finais, pois `.Flag_Sec_Vendas_Credito` nao existe.
- `Mes Seguinte` e `Prob Cair`: migradas para `reserva_campos_adicionais_reserva_repasse_no_mes` quando a coluna estiver populada pelo sync.
- `MP Reserva`: pendente de mapeamento das medidas `[Ag Envio a Conformidade Filtrada]`, `[Ag Conformidade Filtrada]`, `[Conforme c/ Pendencias Filtrada]` e `[MP_Ativa_Filtrada]`.
- `SLA QR`, kits CEF/AGEHAB e observacao de finalizacao: colunas adicionadas; dependem de sincronizacao Databricks para preencher o Postgres.

## Comparacao principal de junho/2026 no Postgres

Consulta por `comercial_base`, periodo `2026-06-01` a `2026-06-30`:

- Reservas cadastradas: 121
- Vendidas/finalizadas: 32
- Venda finalizada sem assinatura: 23
- Repasses assinados: 11
- Canceladas por data de cancelamento: 28

Observacao: os prints do Power BI mostram numeros proximos para algumas medidas, mas nao identicos. A principal divergencia esperada restante vem de `.Flag_Sec_Vendas_Credito`, do mapeamento de `MP Reserva` e da necessidade de sincronizar novamente o Databricks apos a inclusao das colunas adicionais no Postgres.
