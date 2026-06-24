# Banco De Dados - Comissionamento

Data de referencia: 2026-06-16

## Resumo

O schema oficial do modulo e `comissionamento`. A aplicacao nao deve ler Excel,
JSON local ou arquivo de runtime para operar comissoes. O caminho oficial e:

```text
Frontend autenticado -> /api/comissionamento/* -> FastAPI -> Postgres -> API -> Frontend
```

Dependencias externas oficiais:

- `sevenlm_connect`: usuarios, funcionarios, perfis, permissoes e autoria.
- `connect_comercial`: hierarquia mensal do Dashboard G&C, indicadores, metas
  e realizados comerciais.

## Tabelas Centrais

### `comissionamento.ciclos`

Fonte dos ciclos exibidos e processados.

- PK: `ciclo_id`.
- Colunas principais: `mes`, `ano`, `rotulo`, `origem`, `status`,
  `prazo_envio_financeiro`, `prazo_nf_dias`, `criado_em`, `atualizado_em`.

### `comissionamento.resultados`

Fonte principal dos cards, valores, status e identidade operacional de cada
comissionado.

- PK: `resultado_id`.
- FK: `ciclo_id -> comissionamento.ciclos(ciclo_id)`.
- Unique atual: `(ciclo_id, nome)`.
- Colunas principais: `funcao`, `cidade`, `nome`, `tipo_comissionado`,
  `valor_bruto`, `desconto_distrato`, `valor_liquido`, `status`, `status_nf`,
  `status_financeiro`, `status_pagamento`, `exige_nf`, `origem`.
- Identidade produtiva: `identificador_usuario`, `identificador_funcionario`,
  `documento`, `email`, `cargo`, `perfil_acesso`, `papel_comissionamento`,
  `origem_identidade`, `validacao_lideranca`.

### `comissionamento.hierarquia_snapshot`

Congela os vinculos do ciclo. Deve ser a fonte para pessoas vinculadas exibidas
no portal.

- PK: `snapshot_id`.
- Chaves logicas: `ciclo_id`, `papel`, `comissionado_id`,
  `corretor_hierarquia_key`, `corretor_ativo_mes_key`.
- Lider: `comissionado_nome`, `comissionado_documento`,
  `comissionado_email`, `comissionado_usuario_id`,
  `comissionado_funcionario_id`, `comissionado_cargo`,
  `comissionado_perfil`, `comissionado_origem_identidade`.
- Pessoa vinculada: `corretor_nome`, `corretor_tipo`, `corretor_documento`,
  `corretor_email`, `corretor_usuario_id`, `corretor_funcionario_id`,
  `corretor_cargo`, `corretor_status`, `regiao_corretor`,
  `imobiliaria_corretor`.
- Origem: `vinculo_origem`, `origem_json`.

### `comissionamento.regras_publicadas`

Fonte oficial de Regra 01 e Regra 02 publicadas.

- PK: `regra_publicada_id`.
- Versionamento: `(ciclo_id, comissionado_id, regra_tipo, versao)`.
- Ativa por comissionado/regra: uma linha ativa por `(ciclo_id,
  comissionado_id, regra_tipo)`.
- Colunas principais: `regra_01`, `regra_02`, `regra_02_ips`,
  `regra_02_ips_removidos`, `payload`, `motivo`, `comentario`, `ativo`,
  `publicado_por`, `publicado_em`.

### `comissionamento.configuracoes_ciclo`

Configuracao operacional por ciclo.

- PK/FK: `ciclo_id -> comissionamento.ciclos(ciclo_id)`.
- Campos principais: `objetivo_repasse_geral`, `payload`, `atualizado_por`,
  `criado_em`, `atualizado_em`.
- Uso atual: objetivo geral de repasse da Regra 01 de Junho/2026, editavel na
  aba Regras pela Secretaria de Vendas.
- Ao salvar o objetivo geral, as Regra 01 ativas do ciclo sao recalculadas
  preservando valores ja digitados nas faixas.

### `comissionamento.eventos`

Auditoria operacional do fluxo.

- PK: `evento_id`.
- Colunas principais: `ciclo_id`, `resultado_id`, `comissionado_id`,
  `comissionado_nome`, `tipo_evento`, status anterior/novo de etapa, NF,
  financeiro e pagamento, `regra`, `campo`, `valor_anterior`, `valor_novo`,
  `documento_id`, `comentario`, `payload_antes`, `payload_depois`,
  `idempotency_key`, `usuario_id`, `sessao_id`, `endereco_ip`,
  `agente_do_usuario`, `criado_em`.

### `comissionamento.documentos`

Metadados de Nota Fiscal. Nesta fase o PDF nao fica persistido pelo fluxo
operacional; ele e usado como anexo transiente no envio.

- PK: `documento_id`.
- Colunas principais: `resultado_id`, `ciclo_id`, `tipo_documento`,
  `nome_arquivo`, `content_type`, `tamanho_bytes`, `numero_nf`,
  `data_emissao`, `valor_nf`, `observacao`, `status_documento`,
  `usuario_id`, `criado_em`.

### Notificacoes

Tabelas oficiais:

- `notificacao_providers`
- `notificacao_templates`
- `notificacao_eventos`
- `notificacoes`
- `notificacao_destinatarios`
- `notificacao_fila_envio`
- `notificacao_logs`
- `notificacao_preferencias`
- `notificacao_regras_escalonamento`

## Fontes Oficiais Fora Do Schema

### `sevenlm_connect.usuario`

Fonte de usuario autenticado, nome, e-mail e status de login.

- PK: `identificador_usuario`.
- Campos principais: `nome_completo`, `correio_eletronico`,
  `indicador_ativo`.

### `sevenlm_connect.funcionario_acesso`

Fonte de identidade de funcionario/PJ, cargo, vinculos e dados de lideranca.

- PK: `identificador_funcionario`.
- Campos principais: `identificador_usuario`, `nome`, `documento`, `email`,
  `cargo`, `perfil_acesso_padrao`, `tipo_funcionario`, `tipo_vinculo`,
  `regional`, `regiao`, `imobiliaria`, `ativo`, `ativo_negocio`, `gestor`,
  `coordenador`, `gerente`, `diretor` e respectivos documentos/e-mails.

### Permissoes

Tabelas:

- `sevenlm_connect.perfil`
- `sevenlm_connect.permissao`
- `sevenlm_connect.usuario_perfil`
- `sevenlm_connect.usuario_permissao`
- `sevenlm_connect.perfil_permissao`

Funcao central:

```sql
sevenlm_connect.fn_usuario_tem_permissao(usuario_id, nome_permissao)
```

### `connect_comercial.dashboard_gc_produtividade_hierarquia`

Fonte mensal do Dashboard G&C para montar o snapshot de hierarquia.

- Campos principais: `mes_referencia`, `coordenador_nome`,
  `coordenador_documento`, `coordenador_email`, `gerente_nome`,
  `gerente_documento`, `gerente_email`, `corretor_ativo_nome`,
  `tipo_corretor`, `corretor_hierarquia_key`, `corretor_ativo_mes_key`,
  `regiao_corretor`, `imobiliaria_corretor`, `ativo`, `ativo_negocio`.

### `sevenlm_connect.funcionario_equipe_vigencia`

Fonte auxiliar/catalogal de equipes e lideranca. No snapshot atual de
Comissionamento ela nao e a fonte direta; fica documentada como apoio futuro ou
fonte de pipeline.

### Indicadores, Metas E Realizados

A Regra 01 e a Regra 02 devem usar as fontes oficiais abaixo quando passarem a
operar com realizado real do banco.

#### `connect_comercial.indicadores_meta`

Catalogo oficial de indicadores.

- PK: `id`.
- Unique: `codigo`.
- Campos principais: `codigo`, `nome`, `descricao`, `ativo`, `created_at`,
  `updated_at`.

Codigos relevantes para Comissionamento:

- `VENDAS_FINALIZADAS`
- `VISITAS`
- `REPASSES`
- `CANCELAMENTOS`
- `DISTRATOS`
- `IPC`
- `SOBREPRECO`
- `PROPOSTAS`

#### `connect_comercial.metas_colaboradores`

Metas oficiais por usuario, tipo de usuario, indicador, mes e ano.

- PK: `id`.
- FKs: `usuario_id -> sevenlm_connect.usuario(identificador_usuario)`,
  `indicador_id -> connect_comercial.indicadores_meta(id)`.
- Tipos permitidos: `CORRETOR`, `GESTOR`, `COORDENADOR`.
- Campos principais: `meta_potencial`, `meta_valor`, `origem_meta`,
  `mes_referencia`, `ano_referencia`, `data_inicio`, `data_fim`, `ativo`,
  `versao`.

#### `connect_comercial.metas_gerenciais`

Metas gerenciais, regionais, por empreendimento ou globais.

- PK: `id`.
- FKs: `pessoa_id -> sevenlm_connect.usuario(identificador_usuario)`,
  `indicador_id -> connect_comercial.indicadores_meta(id)`.
- Tipos permitidos: `REGIONAL`, `EMPREENDIMENTO`, `GLOBAL`.
- Campos principais: `meta_valor`, `fato_1`, `fato_2`,
  `fato_consolidado`, `peso`, `mes_referencia`, `ano_referencia`,
  `origem_meta`, `ativo`, `versao`.

#### `connect_comercial.resultados_metas`

Realizado mensal oficial por usuario e indicador.

- PK: `id`.
- FKs: `usuario_id -> sevenlm_connect.usuario(identificador_usuario)`,
  `indicador_id -> connect_comercial.indicadores_meta(id)`.
- Unique: `(usuario_id, indicador_id, mes_referencia, ano_referencia)`.
- Campos principais: `valor_realizado`, `origem_resultado`,
  `data_resultado`, `created_at`, `updated_at`.
- Origens permitidas: `MANUAL`, `SISTEMA`, `IMPORTACAO`, `CALCULADO`.

#### `connect_comercial.dashboard_gc_produtividade_kpi_daily`

Fonte diaria para validar ou calcular realizados quando
`resultados_metas` ainda nao tiver linha mensal.

- Campos de periodo e dimensoes: `data`, `cidade`, `origem`,
  `empreendimento`, `empreendimento_reduzido`, `corretor`, `gerencia`,
  `coordenacao`, `imobiliaria`.
- KPIs principais: `leads`, `visitas`, `vendas`, `repasses`,
  `propostas_aprovadas`, `propostas_total`, `cancelamentos`, `distratos`,
  `sla_finalizacao_sum`, `sla_finalizacao_count`, `sla_repasse_sum`,
  `sla_repasse_count`.

Detalhe operacional da Regra 01/02:

- A meta e obrigatoria em `metas_colaboradores` ou `metas_gerenciais`.
- O realizado mensal oficial deve vir de `resultados_metas`.
- O KPI diario pode alimentar ou conferir `resultados_metas`, mas nao substitui
  a necessidade de meta oficial.
- A documentacao funcional esta em
  `../modulos/comissionamento/validacao-indicadores-regra-01-02.md`.

## Queries De Validacao

Estado fechado em 2026-06-16:

```text
Maio/2026: 21 resultados, bruto R$ 109.150,00, liquido R$ 109.150,00.
Junho/2026: 22 resultados, bruto R$ 0,00, liquido R$ 0,00.
```

```sql
select ciclo_id, count(*) as resultados, sum(valor_bruto) as valor_bruto
from comissionamento.resultados
where ciclo_id in ('2026-05', '2026-06')
group by ciclo_id;
```

```sql
select ciclo_id,
       count(*) as resultados,
       count(*) filter (where identificador_usuario is not null) as com_usuario,
       count(*) filter (where identificador_funcionario is not null) as com_funcionario,
       count(*) filter (where coalesce(documento, '') <> '') as com_documento,
       count(*) filter (where coalesce(email, '') <> '') as com_email
from comissionamento.resultados
where ciclo_id in ('2026-05', '2026-06')
group by ciclo_id;
```

```sql
select ciclo_id, papel, count(*) as vinculos, count(distinct comissionado_id) as lideres
from comissionamento.hierarquia_snapshot
where ciclo_id in ('2026-05', '2026-06')
group by ciclo_id, papel;
```

```sql
select ciclo_id, regra_tipo, count(*)
from comissionamento.regras_publicadas
where ciclo_id in ('2026-05', '2026-06')
  and ativo is true
group by ciclo_id, regra_tipo
order by ciclo_id, regra_tipo;
```

```sql
select rp.ciclo_id, count(*) as regras_orfas_ativas
from comissionamento.regras_publicadas rp
left join comissionamento.resultados r
  on r.ciclo_id = rp.ciclo_id
 and r.resultado_id = rp.comissionado_id
where rp.ciclo_id in ('2026-05', '2026-06')
  and rp.ativo is true
  and r.resultado_id is null
group by rp.ciclo_id;
```

```sql
select ciclo_id, comissionado_id, regra_tipo, count(*) as ativas
from comissionamento.regras_publicadas
where ativo is true
group by ciclo_id, comissionado_id, regra_tipo
having count(*) > 1;
```

```sql
select i.codigo,
       count(r.id) as resultados,
       coalesce(sum(r.valor_realizado), 0) as realizado_total
from connect_comercial.indicadores_meta i
left join connect_comercial.resultados_metas r
       on r.indicador_id = i.id
      and r.mes_referencia = 6
      and r.ano_referencia = 2026
where i.codigo in (
    'VENDAS_FINALIZADAS',
    'VISITAS',
    'REPASSES',
    'CANCELAMENTOS',
    'DISTRATOS',
    'IPC',
    'SOBREPRECO',
    'PROPOSTAS'
)
group by i.codigo
order by i.codigo;
```

```sql
select count(*) as linhas_kpi,
       coalesce(sum(vendas), 0) as vendas,
       coalesce(sum(visitas), 0) as visitas,
       coalesce(sum(repasses), 0) as repasses,
       coalesce(sum(propostas_total), 0) as propostas,
       coalesce(sum(cancelamentos), 0) as cancelamentos,
       coalesce(sum(distratos), 0) as distratos
from connect_comercial.dashboard_gc_produtividade_kpi_daily
where data >= date '2026-06-01'
  and data < date '2026-07-01';
```

## Achados Conhecidos

- Alguns campos de referencia ainda nao possuem FK formal, como
  `resultados.identificador_usuario`, `resultados.identificador_funcionario`,
  `eventos.usuario_id`, `documentos.usuario_id` e `regras_publicadas.publicado_por`.
- Status operacionais sao `text`; a regra de transicao vive na API.
- `resultados` ainda possui unique por `(ciclo_id, nome)`, fragil para
  homonimos.
- A persistencia oficial de regra e `regras_publicadas`; rascunhos simples
  continuam auditaveis, mas nao sao fonte canonica.

## Scripts Operacionais Criados Em 2026-06-16

Reset/preparacao mensal:

```text
01_codigo_fonte/api_7lm_connect/scripts/resetar_ciclo_comissionamento_mensal.py
```

Preparacao limpa de Junho/2026:

```text
01_codigo_fonte/api_7lm_connect/scripts/preparar_junho_2026_regras_limpas.py
```

Ajuste oficial de regras de Maio/2026 pela planilha de gestores:

```text
01_codigo_fonte/api_7lm_connect/scripts/ajustar_maio_2026_regras_gestores_oficial.py
```

Complemento de escadas/IPs de Maio/2026:

```text
01_codigo_fonte/api_7lm_connect/scripts/completar_maio_2026_escadas_ips.py
```

Migration de configuracao por ciclo:

```text
Servidor/migracao_20260616_comissionamento_configuracoes_ciclo.sql
```

Cron de reset mensal:

```text
/etc/cron.d/7lm-comissionamento-reset-mensal
```
