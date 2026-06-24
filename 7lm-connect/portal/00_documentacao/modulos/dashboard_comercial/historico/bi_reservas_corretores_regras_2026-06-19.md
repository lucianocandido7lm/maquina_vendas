# BI Reservas, Metas e Corretores - Regras e Alterações

Data: 2026-06-19

## Objetivo

Registrar as alterações implementadas no Dashboard Comercial para transformar as
abas de Reservas e Corretores em telas de gestão operacional, com:

- sinalização visual por regra de negócio;
- detalhamento por drill-down até granularidade de linha;
- metas calculadas com as medidas comerciais alinhadas ao Power BI;
- campos adicionais de reserva/repasse vindos das fontes corretas do Databricks;
- tabelas ordenáveis por cabeçalho;
- aba de Corretores Foguetes com indicadores e top empreendimentos parametrizáveis.

## Arquivos principais alterados

Frontend:

```text
05_modulos/dashboard_comercial/src/pages/ReservasBI.jsx
05_modulos/dashboard_comercial/src/pages/ReservasBI.css
05_modulos/dashboard_comercial/src/pages/CorretorAnalytics.jsx
05_modulos/dashboard_comercial/src/pages/CorretorAnalytics.css
05_modulos/dashboard_comercial/src/pages/Analytics.jsx
05_modulos/dashboard_comercial/src/components/indicator/IndicatorDetailPanel.jsx
05_modulos/dashboard_comercial/src/components/indicator/IndicatorDetailPanel.css
```

Backend/API:

```text
01_codigo_fonte/api_7lm_connect/rotas/rotas_de_dashboard_comercial.py
```

Carga/backfill:

```text
05_modulos/dashboard_comercial/backend/scripts/sync-databricks-to-connect-comercial.js
05_modulos/dashboard_comercial/backend/scripts/backfill-reserva-repasse-campos-adicionais.js
```

## Fontes de dados adotadas

Fato de consumo do app:

```text
connect_comercial.comercial_base
connect_comercial.comercial_kpi_daily
connect_comercial.dashboard_goals
sevenlm_connect.funcionario_acesso
```

Fontes Databricks usadas para campos adicionais:

```text
data_platform_dev.gold_cvcrm.cvcrm_campos_adicionais_reserva_wide
data_platform_dev.gold_cvcrm.cvcrm_campos_adicionais_repasse_wide
```

Observação operacional: a view `data_platform_dev.gold_cvcrm.vw_bi_comercial_base`
foi encontrada inválida no momento da auditoria. Por isso, os campos adicionais
críticos foram preenchidos diretamente pelas tabelas wide de campos adicionais.

## BI de Reservas

### Tela Detalhada por Reserva

A tabela principal foi reduzida para leitura operacional rápida:

- ID Reserva;
- Data cadastro;
- Corretor;
- Empreendimento;
- Imobiliária;
- Região;
- Situação;
- SLA;
- Repasse no mês;
- Risco de cair.

O detalhamento técnico fica em camada expansível por linha. Campos exibidos:

- Imobiliária;
- Cadastro;
- Criado há;
- Data QR;
- SLA QR;
- Kit Caixa;
- Kit Agehab;
- Observação de finalização;
- Na situação;
- Empreendimento;
- Região;
- Origem;
- Repasse assinado;
- ID Repasse;
- Probabilidade assinatura;
- Envio CEHOP;
- Conformidade CEHOP;
- Inconformidade CEHOP;
- Reenvio CEHOP;
- SLA finalização;
- SLA repasse.

Foram removidos da tela de reserva os campos adicionais que não estavam sendo
usados ou que não tinham dados confiáveis no recorte atual, para evitar poluição
visual.

### Regras de cor

Amarelo:

```text
reserva_campos_adicionais_reserva_repasse_no_mes = 'Não'
```

Efeito:

```text
linha com fundo #FFF9C4
```

Vermelho:

```text
reserva_campos_adicionais_reserva_repasse_no_mes = 'Probabilidade de cair'
```

Efeito:

```text
linha com fundo #FFCDD2
```

Regra importante: valor vazio não é mais interpretado como `Não`. Isso evita
marcar amarelo quando o campo não veio preenchido.

### Campos adicionais de reserva/repasse

Campos de reserva usados:

```text
reserva_campos_adicionais_data_qr
reserva_campos_adicionais_reserva_repasse_no_mes
reserva_campos_adicionais_reserva_kit_cef
reserva_campos_adicionais_reserva_kit_agehab
reserva_campos_adicionais_reserva_obs_finalizacao
```

Campos de repasse usados:

```text
repasse_campos_adicionais_repasse_data_envio_cehop
repasse_campos_adicionais_repasse_data_conformidade_cehop
repasse_campos_adicionais_repasse_data_da_inconformidade_cehop
repasse_campos_adicionais_repasse_data_do_reenvio_cehop
repasse_campos_adicionais_repasse_probabilidade_de_assinatura
```

O sync Databricks foi ajustado para fazer `coalesce` entre a base comercial e
as tabelas wide, priorizando os valores das wide tables quando existirem.

### Backfill executado

Foi criado e executado o script:

```text
05_modulos/dashboard_comercial/backend/scripts/backfill-reserva-repasse-campos-adicionais.js
```

Resultado da execução:

```json
{
  "reservasFonte": 1452,
  "repassesFonte": 2822,
  "reservasAtualizadas": 1447,
  "repassesAtualizados": 2574,
  "verificacao": {
    "repasse_no_mes": 903,
    "data_qr": 1106,
    "probabilidade_assinatura": 1716,
    "envio_cehop": 2185
  }
}
```

Validação de `reserva_campos_adicionais_reserva_repasse_no_mes` desde 2024:

```text
<vazio>: 2672 reservas
Sim: 540 reservas
Probabilidade de cair: 248 reservas
Não: 111 reservas
```

Validação de junho/2026:

```text
<vazio>: 62 reservas
Sim: 47 reservas
Não: 8 reservas
Probabilidade de cair: 6 reservas
```

## Aba de Metas de Reservas

### Objetivo

Alinhar a aba de metas ao modelo informado pelo Power BI, com visão por:

```text
regiao_empreendimento
imobiliaria
```

### Colunas exibidas

```text
regiao_empreendimento
Imobiliária
Reservas Situações
Mes Seguinte
Prob Cair
Mês Atual
MP Reserva
Assinados
Prev. Repasse
Meta ajustada
Alcancado_meta
Ação
```

### Regras das medidas

#### Repasses - Data Assinatura

```text
count(distinct idrepasse)
where dt_assinatura_contrato está no período
```

Equivalente Power BI:

```DAX
CALCULATE(
    DISTINCTCOUNT(fato_comercial_geral[idrepasse]),
    USERELATIONSHIP(fato_comercial_geral[dt_assinatura_contrato], dCalendario[Data])
)
```

#### Flag Sec Vendas Crédito

```text
reserva_situacao_nome in ('Crédito', 'Secretaria de Vendas', 'Em Processo')
```

Normalização aplicada:

```text
lower + remoção de acentos
```

#### Contagem de Reservas Situações

```text
count(distinct idreserva)
where dt_cadastro_reserva está no período
and Flag Sec Vendas Crédito = true
```

#### Mes Seguinte

```text
count(distinct idreserva)
where dt_cadastro_reserva está no período
and Flag Sec Vendas Crédito = true
and reserva_campos_adicionais_reserva_repasse_no_mes = 'Não'
```

#### Prob Cair

```text
count(distinct idreserva)
where dt_cadastro_reserva está no período
and Flag Sec Vendas Crédito = true
and reserva_campos_adicionais_reserva_repasse_no_mes = 'Probabilidade de cair'
```

#### Mês Atual

```text
abs(Reservas Situações - Mes Seguinte - Prob Cair)
```

#### MP Reserva

MP Reserva é a soma das quatro medidas abaixo, sempre com `count(distinct idrepasse)`.

Ag Envio a Conformidade Filtrada:

```text
repasse_situacao_nome in ('Em Andamento- (Repasse)', 'Ínicio Repasse')
and repasse_campos_adicionais_repasse_probabilidade_de_assinatura in ('SIM', 'TALVEZ')
and (
    repasse_data_envio_cehop is null
    or (
        repasse_data_inconformidade_cehop is not null
        and repasse_data_reenvio_cehop is null
    )
)
```

Ag Conformidade Filtrada:

```text
repasse_situacao_nome in ('Em Andamento- (Repasse)', 'Ínicio Repasse')
and repasse_campos_adicionais_repasse_probabilidade_de_assinatura in ('SIM', 'TALVEZ')
and (
    (
        repasse_data_envio_cehop is not null
        and repasse_data_conformidade_cehop is null
        and repasse_data_inconformidade_cehop is null
        and repasse_data_reenvio_cehop is null
    )
    or (
        repasse_data_envio_cehop is not null
        and repasse_data_inconformidade_cehop is not null
        and repasse_data_reenvio_cehop is not null
        and repasse_data_conformidade_cehop is null
    )
)
```

Conforme c/ Pendencias Filtrada:

```text
repasse_situacao_nome in ('Em Andamento- (Repasse)', 'Ínicio Repasse')
and repasse_data_conformidade_cehop is not null
and repasse_campos_adicionais_repasse_probabilidade_de_assinatura in ('SIM', 'TALVEZ')
```

MP Ativa Filtrada:

```text
repasse_situacao_nome in (
    'Assinatura Caixa',
    'Validação Assinatura Caixa',
    'Em Andamento- (Garantia)'
)
and dt_assinatura_contrato is null
and repasse_campos_adicionais_repasse_probabilidade_de_assinatura <> 'NÃO'
```

#### Prev. Repasse

```text
Mês Atual + MP Reserva + Repasses - Data Assinatura
```

#### Meta ajustada

Metas são salvas em:

```text
connect_comercial.dashboard_goals
```

Chave:

```text
kpi_id = 'reservas_prev_repasse'
hierarchy_level = 'imobiliaria'
hierarchy_value = regiao || '|||' || imobiliaria
```

#### Alcançado meta

```text
Prev. Repasse / Meta ajustada * 100
```

Se a meta for zero, o campo fica sem percentual.

## Gráficos de Reservas

### Volume por Cadastro

Foi realocado para card próprio e convertido para gráfico de barras vertical.

Regra:

```text
count(distinct idreserva)
por dt_cadastro_reserva
```

### Ranking por Imobiliária, Região e Empreendimento

Mantidos como rankings horizontais simplificados, com barra limpa e valor ao final.

## Filtros

O bloco de filtros de Corretor foi recolhido para aparecer apenas quando o
usuário expande os filtros. Objetivo: reduzir ocupação vertical da tela e
melhorar uso em mobile.

## Drill-down e Detalhamento

Todas as abas/tabelas de BI passaram a respeitar o contexto do item clicado.

Princípio adotado:

```text
cada gráfico ou tabela abre detalhe específico do indicador clicado
```

Exemplos:

- clique em etapa do pipeline de Reservas abre reservas daquela etapa;
- clique em SLA expirado abre reservas em atraso daquela etapa;
- clique em métrica do consolidado de Corretor abre detalhe daquela métrica;
- clique em dia na matriz diária abre detalhe daquele dia;
- clique em empreendimento dos Foguetes filtra o storytelling para aquele empreendimento.

### Detalhamento das abas de Corretor

Nas abas de corretor, o detalhe deve fechar com o valor clicado usando a mesma
identidade da linha agregada.

Contrato atual:

```text
Consolidado Corretor / Corretor Diario / Corretores Foguetes
  -> linha envia corretor_identity_key
  -> frontend chama /v1/dashboard/corretores/detalhes com corretorIdentity
  -> backend filtra comercial_base pela mesma chave
```

A chave preferencial vem de:

```text
comercial_base.idcorretor_canonico/idcorretor_atual
-> connect_comercial.dim_corretor.idcorretor
-> connect_comercial.dim_corretor.email
-> sevenlm_connect.funcionario_acesso.email
```

O nome normalizado fica apenas como fallback de compatibilidade. Linhas
`Inativos/Outros` filtram fatos que nao encontraram funcionario vinculado pela
camada de identidade.

O painel de detalhe deve exibir, para auditoria:

- `corretor_identity_key`;
- e-mail e nome vindos de `dim_corretor`;
- `funcionario_corretor_identity_key`;
- identificador, e-mail, documento, vinculo, status e hierarquia do funcionario;
- IDs operacionais da fato;
- data do evento usado no indicador clicado.

Mapeamento de indicadores no detalhe:

```text
leads                 -> dt_ultima_conversao_lead / idlead
visitas               -> dt_visita_realizada / idlead
agendamentos          -> dt_visita_realizada / idlead
pastas com respostas  -> dt_resposta_analise_precadastro / idprecadastro
pastas aprovadas      -> dt_resposta_analise_precadastro + situacao aprovada
pastas condicionadas  -> dt_resposta_analise_precadastro + situacao condicionada/pendente
pastas reprovadas     -> dt_resposta_analise_precadastro + situacao reprovada
vendas                -> dt_contrato_contabilizado / idreserva
vendas finalizadas    -> dt_venda_finalizada / idreserva
repasses              -> dt_assinatura_contrato / idrepasse
cancelamentos         -> dt_cancelamento_reserva / idreserva
distratos             -> situacao distrato / idreserva ou idrepasse
```

## Ordenação de tabelas

As tabelas do módulo passaram a permitir clique no cabeçalho da coluna para ordenar.

Tabelas cobertas:

- Reservas - Detalhada por reserva;
- Reservas - Metas;
- Corretores - Consolidado;
- Corretores - Resumo por região;
- Corretores - Matriz diária;
- Analytics/SDR - Detalhamento;
- Painel genérico de detalhe de indicador.

No Consolidado de Corretores, a ordenação principal é enviada para a API via:

```text
sort
order
```

No resumo por região, matriz diária e tabelas locais, a ordenação é aplicada no
frontend sobre o payload carregado.

Observação: colunas ainda zeradas no payload, como `pendente_comercial`,
`pendente_credito` e `vendas_finalizadas` no consolidado principal, ficam
clicáveis sem quebrar a consulta. O backend usa expressão constante quando a
coluna real ainda não existe no agregado.

## Corretores Foguetes

### Regra de entrada

Um corretor entra como Foguete quando:

```text
tipo_funcionario = 'CORRETOR'
and está no HeadCount ativo conforme regra oficial
and teve 2 ou mais repasses no mês anterior ao fim do período filtrado
```

Período de entrada:

```text
inicio = date_trunc('month', endDate) - interval '1 month'
fim    = date_trunc('month', endDate)
```

### Cards

Cards atuais:

- Total de Foguetes Ativos;
- Vendas dos Foguetes;
- Repasse dos Foguetes;
- Contribuição nos Repasses;
- Repasses na Regra de Entrada.

#### Vendas dos Foguetes

Regra exibida em tooltip:

```text
Venda: count distinct de idreserva com data de venda/contrato contabilizado
no período filtrado. No consolidado usa comercial_kpi_daily.vendas; no detalhe
usa dt_contrato_contabilizado.
```

#### Repasse dos Foguetes

Regra exibida em tooltip:

```text
Repasse: count distinct de idrepasse com assinatura de contrato no período
filtrado. No consolidado usa comercial_kpi_daily.repasses; no detalhe usa
dt_assinatura_contrato.
```

### Foguetes vs total da operação

Indicadores comparados:

- Pastas com respostas;
- Pastas aprovadas;
- Pastas condicionadas;
- Pastas reprovadas;
- Vendas;
- Vendas finalizadas;
- Repasses.

### Top Empreendimentos Convertidos

O gráfico deixou de usar fallback automático e passou a ter seletor explícito de indicador.

Indicadores disponíveis:

```text
Pastas
Vendas
Vendas Finalizadas
Repasse
```

Regra de cada opção:

Pastas:

```text
sum(propostas)
```

Vendas:

```text
sum(vendas)
```

Vendas Finalizadas:

```text
count(distinct idreserva)
where dt_venda_finalizada está no período
```

Repasse:

```text
sum(repasses)
ou count(distinct idrepasse) por dt_assinatura_contrato no detalhe convertido
```

O backend passou a enviar `vendas_finalizadas` no agrupamento de empreendimentos
dos Foguetes com base em `dt_venda_finalizada`.

## Validações executadas

Backend:

```text
python3 -m py_compile 01_codigo_fonte/api_7lm_connect/rotas/rotas_de_dashboard_comercial.py
```

Frontend:

```text
npm run build
```

Serviço:

```text
systemctl restart 7lm-connect-api.service
systemctl is-active 7lm-connect-api.service
```

Resultado:

```text
active
```

## Pontos de atenção

- A view Databricks `vw_bi_comercial_base` estava inválida durante a auditoria.
  Os campos adicionais foram corrigidos por join/backfill direto das tabelas
  wide.
- `vendas_finalizadas` ainda não existe em `connect_comercial.comercial_kpi_daily`;
  no top de empreendimentos dos Foguetes ela é calculada via
  `connect_comercial.comercial_base.dt_venda_finalizada`.
- Campos `pendente_comercial` e `pendente_credito` ainda não possuem fonte real
  no agregado atual; seguem como zeros no consolidado.
- A documentação antiga `05_modulos/dashboard_comercial/backend/AUDITORIA_BI_RESERVAS.md`
  ficou parcialmente desatualizada para as regras de Metas, pois este documento
  consolida a regra final implementada em 2026-06-19.
