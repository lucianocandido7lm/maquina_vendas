# Corretores Foguetes - Regra Tecnica

Data: 2026-06-18

## Objetivo

Documentar a aba "Corretores Foguetes" do Dashboard Comercial e garantir que
ela siga o padrao de contagem definido em:

```text
00_documentacao/modulos/dashboard_comercial/padrao-headcount-funcionarios-operacao.md
```

Corretores Foguetes sao corretores com aceleracao comercial recente: ativos
pela regra oficial de HeadCount e com mais de 2 repasses no mes anterior ao
periodo analisado.

## Fontes

Cadastro e vinculo de funcionario:

```text
sevenlm_connect.funcionario_acesso
```

Volume operacional:

```text
connect_comercial.comercial_kpi_daily
```

CTE de HeadCount ativo:

```text
hierarquia_ativa
```

No Dashboard Comercial, `hierarquia_ativa` e derivada da regra oficial de
funcionarios comerciais vigentes. Ela deve ser usada para HeadCount, IPC e
qualificacao de ativo. Filtros, graficos e abas de corretor usam o cadastro
completo de `funcionario_acesso`.

## Regra De Negocio

Um corretor e classificado como Foguete quando:

```text
tipo_funcionario = 'CORRETOR'
and esta no HeadCount ativo do periodo analisado
and teve sum(repasses) > 2 no mes anterior ao endDate do filtro
```

O mes anterior e dinamico:

```text
inicio_mes_anterior = date_trunc('month', :data_fim) - interval '1 month'
fim_mes_anterior    = date_trunc('month', :data_fim)
```

Exemplo: se o filtro da tela termina em `2026-06-30`, a qualificacao Foguete
usa repasses de `2026-05-01` ate `2026-05-31`.

## Separacao De Bases

### Vinculo Cadastral

Todos os corretores cadastrados em `funcionario_acesso` entram como base de
vinculo das abas de corretor, independentemente do status ativo no mes.

Isso permite que corretores inativos, desligados ou sem producao continuem
vinculados aos seus fatos historicos quando existem no cadastro.

### HeadCount Ativo

O HeadCount ativo nao controla visibilidade de filtros/graficos. Ele controla:

- denominador de IPC;
- `base_ativa`;
- `meses_ativos`;
- qualificacao para Foguete.

### Sem Vinculo

Fatos cujo corretor nao existe no cadastro de funcionarios entram em:

```text
Inativos/Outros
```

Esse grupo preserva volume operacional, mas nao entra no HeadCount nem na
qualificacao de Foguete.

## SQL De Referencia

```sql
with periodo as (
    select
        :data_inicio::date as inicio,
        :data_fim::date as fim
),
funcionarios_vinculo as (
    select distinct on (corretor_match)
        regexp_replace(
            regexp_replace(lower(trim(f.nome)), '\s*-\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'),
            '\s+',
            ' ',
            'g'
        ) as corretor_match,
        f.identificador_funcionario,
        f.nome,
        f.gestor,
        coalesce(f.coordenador, f.gerente) as coordenador,
        coalesce(f.regiao, f.regional) as regiao,
        f.imobiliaria
    from sevenlm_connect.funcionario_acesso f
    where upper(trim(coalesce(f.tipo_funcionario, ''))) = 'CORRETOR'
      and trim(coalesce(f.nome, '')) <> ''
    order by
        corretor_match,
        coalesce(f.ativo, false) desc,
        coalesce(f.ativo_negocio, false) desc,
        coalesce(f.ativo_login, false) desc
),
hierarquia_ativa as (
    -- CTE oficial de HeadCount ativo do Dashboard Comercial.
    -- Deve aplicar a regra vigente de ativo do periodo.
    select *
    from funcionarios_vinculo
    where /* regra oficial de HeadCount ativo */
          true
),
repasses_mes_anterior as (
    select
        regexp_replace(
            regexp_replace(lower(trim(coalesce(nullif(trim(k.corretor), ''), 'Sem corretor'))), '\s*-\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'),
            '\s+',
            ' ',
            'g'
        ) as corretor_match,
        sum(coalesce(k.repasses, 0)) as repasses_mes_anterior
    from connect_comercial.comercial_kpi_daily k
    where k.data >= (select (date_trunc('month', fim) - interval '1 month')::date from periodo)
      and k.data <  (select date_trunc('month', fim)::date from periodo)
    group by 1
    having sum(coalesce(k.repasses, 0)) > 2
),
fatos_periodo as (
    select
        regexp_replace(
            regexp_replace(lower(trim(coalesce(nullif(trim(k.corretor), ''), 'Sem corretor'))), '\s*-\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'),
            '\s+',
            ' ',
            'g'
        ) as corretor_match,
        sum(coalesce(k.leads, 0)) as leads,
        sum(coalesce(k.vendas, 0)) as vendas,
        sum(coalesce(k.repasses, 0)) as repasses
    from connect_comercial.comercial_kpi_daily k
    where k.data >= (select inicio from periodo)
      and k.data <= (select fim from periodo)
    group by 1
),
classificado as (
    select
        case
            when fv.corretor_match is null then 'Inativos/Outros'
            when ha.corretor_match is not null
             and rma.corretor_match is not null then 'Foguete'
            else 'Nao Foguete'
        end as categoria,
        fp.*
    from fatos_periodo fp
    left join funcionarios_vinculo fv
      on fv.corretor_match = fp.corretor_match
    left join hierarquia_ativa ha
      on ha.corretor_match = fp.corretor_match
    left join repasses_mes_anterior rma
      on rma.corretor_match = fp.corretor_match
)
select categoria, sum(leads), sum(vendas), sum(repasses)
from classificado
group by categoria;
```

## Invariantes

Para o mesmo periodo e os mesmos filtros operacionais:

```text
repasses_foguetes + repasses_nao_foguetes + repasses_inativos_outros
= repasses_total_operacional
```

O mesmo vale para leads, visitas, vendas, propostas, distratos e cancelamentos.

Corretores sem fato podem aparecer nas abas cadastrais com metricas zeradas. O
fato sem cadastro nao pode desaparecer; deve ir para `Inativos/Outros`.

## Validacao Junho/2026

Periodo validado:

```text
2026-06-01 a 2026-06-30
```

Resultado direto da fato:

```text
leads = 6.693
repasses = 12
```

Separacao auditada:

```text
Foguete:       110 leads, 2 repasses
Nao Foguete: 1.394 leads, 9 repasses
Sem vinculo: 5.189 leads, 1 repasse
Total:       6.693 leads, 12 repasses
```

Conclusao: a classificacao preserva 100% do volume operacional.
