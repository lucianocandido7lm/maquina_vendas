# Validacao De Indicadores - Regra 01 E Regra 02

Data de referencia: 2026-06-15

## Objetivo

Garantir que a Regra 01 e a Regra 02 do Comissionamento sejam calculadas com
indicadores oficiais do banco, vinculados ao usuario, gestor ou coordenador
correto.

Fluxo esperado:

```text
comissionamento.resultados
  -> identidade oficial
  -> indicador oficial
  -> meta oficial
  -> realizado real
  -> calculo backend
  -> /api/comissionamento/*
  -> frontend autenticado
```

O frontend deve apenas exibir o contrato retornado pela API. Ele nao deve
calcular regra, buscar banco diretamente, ler Excel, JSON local ou depender de
arquivo fora do portal.

## Estado Atual Identificado

O preview de Comissionamento ainda monta Regra 01 e Regra 02 a partir de uma
funcao sintetica em `servicos/comissionamento_preview.py`.

Pontos que precisam sair do runtime:

- `_metricas_referencia`: gera objetivo, realizado, percentual, IPC,
  sobrepreco, repasses e visitas artificiais.
- `fonte_realizado = banco_estruturado_seed_mvp`: indica que o realizado nao e
  fonte oficial.
- Lista fixa de indicadores configuraveis quando ja existe catalogo oficial em
  banco.

## Decisao De Negocio

A meta/objetivo e obrigatoria no banco.

Se nao existir meta oficial para pessoa, indicador e ciclo, o sistema deve
retornar pendencia clara:

```text
Meta nao cadastrada
```

Nao inventar meta, nao reaproveitar objetivo antigo da regra publicada como
fonte oficial e nao calcular percentual falso.

## Fontes Oficiais

### Comissionamento

- `comissionamento.resultados`: pessoa comissionada, status, valores e
  identidade operacional do ciclo.
- `comissionamento.hierarquia_snapshot`: vinculos congelados do ciclo.
- `comissionamento.regras_publicadas`: parametros publicados de Regra 01 e
  Regra 02, com versionamento e auditoria.

### Comercial

- `connect_comercial.indicadores_meta`: catalogo oficial de indicadores.
- `connect_comercial.metas_colaboradores`: metas oficiais por usuario,
  indicador, mes e ano para CORRETOR, GESTOR e COORDENADOR.
- `connect_comercial.metas_gerenciais`: metas gerenciais, regionais e globais.
- `connect_comercial.resultados_metas`: realizado mensal oficial por usuario e
  indicador.
- `connect_comercial.dashboard_gc_produtividade_kpi_daily`: fonte diaria para
  calcular/sincronizar realizados quando `resultados_metas` ainda nao tiver
  linha mensal.

### Identidade

- `sevenlm_connect.usuario`: usuario autenticado, nome, e-mail e status.
- `sevenlm_connect.funcionario_acesso`: funcionario/PJ, documento, cargo,
  vinculo, regionalidade e dados de lideranca.

## Normalizacao De Indicadores

O Comissionamento pode continuar usando codigos amigaveis no payload, mas a API
deve resolver todos para `connect_comercial.indicadores_meta`.

| Comissionamento | Indicador oficial |
| --- | --- |
| `vendas` | `VENDAS_FINALIZADAS` |
| `visitas` | `VISITAS` |
| `repasses` | `REPASSES` |
| `cancelamentos` | `CANCELAMENTOS` |
| `distratos` | `DISTRATOS` |
| `ipc` | `IPC` |
| `sobrepreco_medio` | `SOBREPRECO` |
| `propostas_total` | `PROPOSTAS` |

Indicador que nao existir ou estiver inativo em `indicadores_meta` deve retornar
`status_calculo = indicador_invalido`.

## Resolucao De Pessoa

Para cada linha de `comissionamento.resultados`, resolver a pessoa oficial nesta
ordem:

1. `identificador_usuario`.
2. `identificador_funcionario`, buscando o usuario vinculado.
3. `email`.
4. `documento`.
5. nome + `comissionamento.hierarquia_snapshot` como ultimo recurso auditavel.

O retorno da API deve informar `criterio_vinculo`:

- `usuario_direto`
- `funcionario_oficial`
- `email_oficial`
- `documento_oficial`
- `hierarquia_snapshot`
- `sem_vinculo`

Quando o vinculo for `sem_vinculo`, Regra 01 e Regra 02 devem retornar
`status_calculo = sem_vinculo`.

## Regra 01

Formula:

```text
percentual_atingimento = realizado_real / meta_valor * 100
```

Fonte da meta:

- primaria: `connect_comercial.metas_colaboradores`;
- complementar: `connect_comercial.metas_gerenciais`, quando a pessoa estiver
  enquadrada em meta gerencial/regional/global;
- ausencia: `status_calculo = sem_meta`.

Fonte do realizado:

- primaria: `connect_comercial.resultados_metas.valor_realizado`;
- fallback operacional: calcular por
  `connect_comercial.dashboard_gc_produtividade_kpi_daily` e registrar em
  `resultados_metas` com `origem_resultado = CALCULADO`;
- ausencia: `status_calculo = sem_realizado`.

As faixas devem usar a meta oficial como base. Cada faixa deve exibir:

- percentual da faixa;
- realizado minimo necessario;
- realizado maximo quando houver;
- realizado atual;
- quanto falta para o minimo;
- valor da faixa;
- indicador se e a faixa ativa.

Somente a faixa realmente atingida deve ficar marcada como ativa.

## Regra 02

Cada IP da Regra 02 deve referenciar um indicador oficial.

Para cada IP:

- meta/alvo vem obrigatoriamente de `metas_colaboradores` ou
  `metas_gerenciais`;
- realizado vem de `resultados_metas` ou de sincronizacao por KPI diario;
- operador, periodo e bonus vem da regra publicada;
- se faltar meta, retornar `status_calculo = sem_meta`;
- se faltar realizado, retornar `status_calculo = sem_realizado`.

A regra publicada pode alterar configuracao, operador, periodo, bonus e lista de
IPs ativos. Ela nao pode substituir o realizado real nem inventar meta ausente.

## Contrato Esperado No Preview

Regra 01 e cada IP da Regra 02 devem retornar:

- `indicador_id`
- `indicador_codigo`
- `indicador_nome`
- `meta_valor`
- `realizado`
- `percentual_atingimento`
- `fonte_meta`
- `fonte_realizado`
- `criterio_vinculo`
- `status_calculo`
- `mensagens_validacao`

Valores esperados para `status_calculo`:

- `ok`
- `sem_meta`
- `sem_realizado`
- `sem_vinculo`
- `indicador_invalido`

## Auditoria Necessaria

Criar ou estender auditoria para os ciclos `2026-06` e
`2026-06-fluxo-manual`, validando:

- pessoas sem vinculo oficial;
- indicadores ausentes ou inativos;
- indicadores sem meta cadastrada;
- indicadores sem realizado;
- divergencia entre `resultados_metas` e agregacao de KPI diario;
- uso remanescente de `banco_estruturado_seed_mvp`;
- regras publicadas com realizado congelado.

O relatorio deve ficar em `03_registros` e nao deve alterar banco quando rodado
em modo somente leitura.

## Impacto Na Implementacao

- Backend: remover dependencia runtime de `_metricas_referencia` para
  Comissionamento oficial.
- Backend: criar resolvedor de indicador, meta, realizado e vinculo oficial.
- Backend: recalcular preview depois de aplicar parametros publicados de regra.
- Frontend: exibir fonte, meta, realizado, pendencias e faixas detalhadas.
- Banco: cadastrar metas oficiais antes do calculo oficial; metas nao devem ser
  criadas automaticamente pelo preview.

## Testes Minimos

- Regra 01 com meta e realizado calcula percentual correto.
- Regra 01 sem meta retorna `sem_meta`.
- Regra 01 sem vinculo retorna `sem_vinculo`.
- Regra 02 com meta e realizado calcula `atingiu` corretamente.
- Regra 02 sem meta retorna `sem_meta`.
- Regra publicada recalcula com realizado atual do banco.
- Nenhum preview oficial retorna `fonte_realizado =
  banco_estruturado_seed_mvp`.
- Build do frontend passa e a tela mostra meta, realizado, fonte e pendencias.

## Assumptions

- `connect_comercial.indicadores_meta` e o catalogo oficial de indicadores.
- `connect_comercial.resultados_metas` e a fonte mensal oficial de realizado.
- `connect_comercial.dashboard_gc_produtividade_kpi_daily` pode alimentar
  realizados calculados quando nao houver linha mensal.
- `connect_comercial.metas_colaboradores` e
  `connect_comercial.metas_gerenciais` sao obrigatorias para objetivo/meta.
- A API de Comissionamento continua sendo a unica fonte do frontend.
