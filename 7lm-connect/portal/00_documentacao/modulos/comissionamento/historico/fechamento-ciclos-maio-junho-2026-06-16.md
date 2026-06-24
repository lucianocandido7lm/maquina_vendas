# Fechamento Operacional - Ciclos Maio E Junho/2026

Data: 2026-06-16

Raiz oficial:

```text
/opt/7lm-connect/portal
```

## Resumo

Este documento registra o fechamento dos ajustes aplicados no modulo de
Comissionamento para os ciclos oficiais:

- `2026-05` - Maio/2026
- `2026-06` - Junho/2026

O objetivo foi deixar Maio/2026 completo e auditavel, e Junho/2026 limpo para a
Secretaria de Vendas editar regras com realizado ja preenchido.

## Maio/2026

Estado final validado:

```text
ciclo_id: 2026-05
rotulo: Maio/2026
status: calculado
resultados: 21
valor_bruto_total: R$ 109.150,00
valor_liquido_total: R$ 109.150,00
Regra 01 ativa: 21
Regra 02 ativa: 21
regras orfas ativas: 0
```

O financeiro de Maio/2026 foi preservado. Nenhum ajuste de regra alterou
`valor_bruto`, `desconto_distrato` ou `valor_liquido` dos resultados.

### Fontes Usadas

Valores do ciclo:

```text
03_registros/comissionamento/backups/backup_comissionamento_remocao_ciclos_nao_2026_06_20260615_174304.json
```

Identidade, perfil e hierarquia:

```text
Maquina de Vendas / sevenlm_connect / snapshot de hierarquia
```

Regras oficiais de gestores/coordenadores:

```text
/root/data-engineering/apps/commercial-dashboard/Regras Gestores e Coordenadores.xlsx
```

Escadas e IPs complementares:

```text
ajuste_manual_escadas_ips_maio_2026
```

### Ajustes Feitos Em Maio

- O ciclo oficial `2026-05` foi restaurado com nomes, identidade e hierarquia
  da Maquina de Vendas.
- Marco Narciso foi removido dos ciclos e ficou sem regras ativas orfas.
- Todas as comissoes de Maio foram colocadas em `Calculada/Revisao`
  (`status = calculado`).
- Foram mantidos 21 resultados ativos.
- Para os gestores/coordenadores mapeados no Excel oficial, Regra 01 e Regra
  02 foram versionadas com fonte `Regras Gestores e Coordenadores.xlsx`.
- Para quem recebeu valor mas nao tinha escada propria, foi aplicada a escada
  padrao combinada.
- Para quem nao recebeu valor em Maio, foi aplicada escada zerada simples e IP
  base para a tela nao ficar vazia.
- A faixa unica `Valor Maio/2026` foi substituida por escadas completas.
- Toda Regra 02 ficou com pelo menos um IP.

### Escadas E IPs Especificos Aplicados

Escada especifica:

```text
Bruno Macario
Geisiane Gomes Dos Santos
Jordan Vasconcelos
Thomaz Moreira Aquino
```

IPs especificos:

```text
Geisiane Gomes Dos Santos
Thomaz Moreira Aquino
Marco Taveira
```

Escada padrao aplicada para comissionados com valor e sem regra propria:

```text
0% a 39,99%      R$ 1.000,00
40% a 59,99%     R$ 1.200,00
60% a 79,99%     R$ 1.350,00
80% a 94,99%     R$ 1.500,00
95% a 104,99%    R$ 3.500,00
105% a 109,99%   R$ 4.000,00
110% a 114,99%   R$ 4.500,00
115% a 119,99%   R$ 5.000,00
120% a 129,99%   R$ 5.500,00
130% a 139,99%   R$ 6.000,00
+ que 140%       R$ 6.500,00
```

### Scripts E Relatorios De Maio

Scripts criados:

```text
01_codigo_fonte/api_7lm_connect/scripts/ajustar_maio_2026_regras_gestores_oficial.py
01_codigo_fonte/api_7lm_connect/scripts/completar_maio_2026_escadas_ips.py
```

Relatorios:

```text
03_registros/comissionamento/execucoes/comissionamento_maio_2026_regras_gestores_oficial_dry_run.json
03_registros/comissionamento/execucoes/comissionamento_maio_2026_regras_gestores_oficial_apply.json
03_registros/comissionamento/execucoes/comissionamento_maio_2026_escadas_ips_completos_dry_run.json
03_registros/comissionamento/execucoes/comissionamento_maio_2026_escadas_ips_completos_apply.json
03_registros/comissionamento/auditorias/backend/comissionamento_backend_audit_20260616_maio_regras_gestores_oficial.json
03_registros/comissionamento/auditorias/backend/comissionamento_backend_audit_20260616_maio_escadas_ips_completos.json
```

## Junho/2026

Estado final validado:

```text
ciclo_id: 2026-06
rotulo: Junho/2026
status: calculado
resultados: 22
valor_bruto_total: R$ 0,00
valor_liquido_total: R$ 0,00
Regra 01 ativa: 22
Regra 02 ativa: 22
regras orfas ativas: 0
```

### Ajustes Feitos Em Junho

- O ciclo `2026-06` foi resetado/preparado com gestores, coordenadores e head
  ativos de Junho.
- Marco Narciso foi removido do ciclo porque e diretoria e deve aparecer apenas
  na Aprovacao Comercial.
- Douglas foi removido da base de ciclo porque nao e gestor.
- Todos os resultados ficaram em `Calculada/Revisao`.
- Todos os valores financeiros foram zerados:
  - `valor_bruto = 0`
  - `desconto_distrato = 0`
  - `valor_liquido = 0`
- Regra 01 foi criada para todos com indicador inicial `repasses`.
- O realizado da Regra 01 veio do Dashboard Comercial quando havia fonte.
- Regra 02 foi criada para todos:
  - 2 com IP historico copiado de Maio;
  - 20 com IP base editavel.
- Foi criada configuracao de objetivo geral de repasse por ciclo.
- A aba Regras passou a exibir e salvar o objetivo geral de repasse.
- Ao alterar o objetivo geral, a Regra 01 ativa e recalculada preservando
  valores ja digitados nas faixas.

Numeros do preparador:

```text
resultados: 22
total_repasses_realizado: 28
com_ips_historico_maio: 2
com_placeholder_ip: 20
sem_fonte_realizado: 8
objetivo_repasse_geral inicial: 0
```

### Scripts, Migration E Relatorios De Junho

Scripts criados:

```text
01_codigo_fonte/api_7lm_connect/scripts/resetar_ciclo_comissionamento_mensal.py
01_codigo_fonte/api_7lm_connect/scripts/preparar_junho_2026_regras_limpas.py
```

Migration criada/aplicada:

```text
Servidor/migracao_20260616_comissionamento_configuracoes_ciclo.sql
```

Relatorios:

```text
03_registros/comissionamento/execucoes/comissionamento_reset_mensal_2026-06_dry_run.json
03_registros/comissionamento/execucoes/comissionamento_reset_mensal_2026-06_apply.json
03_registros/comissionamento/execucoes/comissionamento_junho_2026_regras_limpas_dry_run.json
03_registros/comissionamento/execucoes/comissionamento_junho_2026_regras_limpas_apply.json
03_registros/comissionamento/auditorias/backend/comissionamento_backend_audit_20260616_junho_regras_limpas_final.json
```

## Automacao Mensal

Foi criado reset mensal para preparar o ciclo na virada do mes com os ativos do
mes corrente.

Comportamento esperado:

- roda no primeiro dia util do mes;
- cria/prepara o ciclo oficial do mes;
- busca gestores/coordenadores/head ativos;
- exclui diretoria comercial dos ciclos;
- preserva identidade e snapshot de hierarquia;
- coloca todos na etapa inicial `Calculada/Revisao`;
- zera financeiro para o novo ciclo;
- envia e-mail para Secretaria de Vendas avisando que o processo foi
  reiniciado.

Cron instalado:

```text
/etc/cron.d/7lm-comissionamento-reset-mensal
```

## Acessos E Perfis

Regras consolidadas:

- Administrador acessa tudo.
- Secretaria de Vendas acessa Secretaria, Regras, Historico e gestao do
  Comissionamento.
- Aprovacao Comercial e acessada por Administrador, Secretaria de Vendas e
  cargos autorizados de aprovacao comercial.
- Comissionado acessa somente a propria comissao quando estiver na Maquina de
  Vendas e possuir resultado no ciclo.
- O filtro de selecionar comissionado aparece apenas para Administrador e
  Secretaria de Vendas.

Fernanda Leao Uchoa De Oliveira:

```text
email: fernanda.oliveira@7lm.com.br
setor: Secretaria de Vendas
permissoes: acesso completo ao Comissionamento
```

## E-mails

Foi ativado redirecionamento temporario de todos os e-mails do Comissionamento
para teste:

```text
hudson.porto@7lm.com.br
fernanda.oliveira@7lm.com.br
```

Variavel:

```text
COMISSIONAMENTO_EMAIL_REDIRECT_TO
```

Enquanto essa variavel estiver preenchida, e-mails reais nao devem ir para
comissionados/financeiro/head; vao para Hudson e Fernanda.

Tambem foi criado template/fluxo para avisar o comissionado quando a Secretaria
publicar alteracao de regra, bonus, valor ou IP.

## Frontend E API

Frontend do modulo:

```text
05_modulos/comissionamento
```

Bundle publico atualizado:

```text
02_publico/02_recursos/05_modulos/comissionamento/assets/comissionamento_20260616_comissionamento_react_5.js
02_publico/02_recursos/05_modulos/comissionamento/assets/index_20260616_comissionamento_react_5.css
```

Pagina publica:

```text
02_publico/01_paginas/Comercial/comissionamento.html
```

API reiniciada e validada:

```text
GET /api/comissionamento/config
```

Sem credencial, retorna `401`, que e o comportamento esperado.

## Validacoes Finais

Auditorias finais com status `ok`:

```text
03_registros/comissionamento/auditorias/backend/comissionamento_backend_audit_20260616_maio_escadas_ips_completos.json
03_registros/comissionamento/auditorias/backend/comissionamento_backend_audit_20260616_junho_regras_limpas_final.json
```

Consultas finais confirmaram:

- Maio/2026 com 21 resultados, financeiro preservado, sem regras orfas e sem
  Regra 02 vazia.
- Junho/2026 com 22 resultados, financeiro zerado, Regra 01/02 para todos e
  Marco Narciso fora do ciclo.

## Pendencias Conhecidas

- Remover `COMISSIONAMENTO_EMAIL_REDIRECT_TO` quando for liberar envio real.
- Em Maio/2026, alguns realizados continuam preservados da importacao anterior
  simplificada; isso foi decisao operacional para nao inventar realizado.
- Em Junho/2026, 8 comissionados ficaram sem fonte de realizado no preparador e
  devem ser conferidos pela Secretaria quando editar as regras.
