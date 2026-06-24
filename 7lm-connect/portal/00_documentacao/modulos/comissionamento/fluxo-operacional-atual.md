# Fluxo Operacional Atual - Comissionamento

Data de referencia: 2026-06-16

## Esteira

Fluxo visual atual:

```text
Calculada/Revisao -> Aprovacao Comercial -> Aguardando NF -> Pagamento
```

Para PJ/autonomo, NF e obrigatoria. Para CLT, a etapa de NF nao se aplica, mas
o escopo atual de Junho/2026 trata gestores/coordenadores como PJ/autonomos.

## Fotografia Atual Dos Ciclos

### Maio/2026

Estado operacional fechado:

- `ciclo_id = 2026-05`
- 21 resultados.
- Total bruto/liquido preservado em `R$ 109.150,00`.
- Todos em `Calculada/Revisao`.
- Regra 01 e Regra 02 ativas para todos.
- Escadas completas; nao existe mais faixa unica `Valor Maio/2026` ativa.
- Toda Regra 02 tem pelo menos um IP.
- Marco Narciso nao possui regra ativa no ciclo.

Relatorio de fechamento:

```text
03_registros/comissionamento/execucoes/comissionamento_maio_2026_escadas_ips_completos_apply.json
```

Auditoria:

```text
03_registros/comissionamento/auditorias/backend/comissionamento_backend_audit_20260616_maio_escadas_ips_completos.json
```

### Junho/2026

Estado operacional preparado:

- `ciclo_id = 2026-06`
- 22 resultados.
- Total bruto/liquido zerado.
- Todos em `Calculada/Revisao`.
- Regra 01 ativa para todos com indicador inicial `repasses`.
- Regra 02 ativa para todos com IP historico ou IP base editavel.
- Objetivo geral de repasse editavel pela Secretaria na aba Regras.
- Marco Narciso fica fora do ciclo e aparece apenas no contexto de Aprovacao
  Comercial.

Relatorio de preparacao:

```text
03_registros/comissionamento/execucoes/comissionamento_junho_2026_regras_limpas_apply.json
```

Auditoria:

```text
03_registros/comissionamento/auditorias/backend/comissionamento_backend_audit_20260616_junho_regras_limpas_final.json
```

## Calculada/Revisao

Status principais:

- `calculado`
- `calculado_seed`
- `revisao_necessaria`
- `pendente_secretaria`
- `em_revisao_secretaria`

A Secretaria ajusta regras, confere valores e envia para Aprovacao Comercial.

Regra 01 e Regra 02 publicadas devem ser salvas em
`comissionamento.regras_publicadas` e refletidas imediatamente pelo preview da
API.

## Aprovacao Comercial

Status principal:

- `aguardando_head_comercial`

Acoes:

- aprovar;
- reprovar/devolver para revisao.

Permissao oficial:

```text
comissionamento.aprovar.head
```

Secretaria nao executa botoes da Aprovacao Comercial.

## Revisao/Recalculo E Reprovacao

Toda revisao, recalculo ou reprovacao/devolucao comercial retorna para a etapa
Calculada/Revisao.

Estado esperado:

- `status = revisao_necessaria`
- `status_nf = pendente_nf`
- `status_financeiro = nao_enviado`
- `status_pagamento = nao_enviado`

Motivo e obrigatorio. O historico deve gravar antes/depois, responsavel,
perfil, status, valores e payload de regra quando existir.

## Aguardando NF

Status principais:

- `aguardando_nf`
- `nf_em_validacao`

Nesta rodada, Secretaria/Admin nao fazem uma validacao manual bloqueante de NF.
A Secretaria pode reenviar aviso de NF. O comissionado envia o PDF; o backend
valida e grava metadados em `comissionamento.documentos`.

O PDF e usado como anexo transiente para e-mail ao Financeiro e nao fica como
arquivo persistido nesta fase.

## Pagamento

Status principais:

- `pronta_para_envio_pagamento`
- `enviada_pagamento`
- `aguardando_pagamento`
- `paga`

Acao canonica de pacote:

```text
enviar_pacote_pagamento
```

Nao usar `enviar_financeiro` como endpoint; ele nao existe no backend atual.

## Historico

A aba Historico deve deixar claro:

- usuario responsavel;
- e-mail/perfil;
- etapa anterior e nova;
- NF anterior e nova;
- financeiro anterior e novo;
- pagamento anterior e novo;
- valor anterior e novo;
- regra/campo alterado;
- payload antes/depois;
- documento/NF;
- correlation/idempotency quando disponivel.

Eventos de regra devem mostrar campo alterado, valor anterior e valor novo.
