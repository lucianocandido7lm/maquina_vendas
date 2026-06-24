# Seed Maio/2026 - Excel Gestores E Coordenadores

Este documento registra o seed inicial do ciclo maio/2026 extraido do arquivo:

```text
/root/data-engineering/apps/commercial-dashboard/Comissionamento - COORDENADORES - GERENTES.xlsx
```

O arquivo e insumo temporario de desenvolvimento. Depois da importacao, o portal
deve usar banco/API como fonte operacional.

## Aba Fonte

A aba usada para o primeiro preview e:

```text
BASE PARA DADOS
```

Mes identificado na aba:

```text
Maio
```

## Registros Do Seed

| Funcao | Cidade | Nome | Valor bruto | Desc. distrato | Valor liquido |
| --- | --- | --- | ---: | ---: | ---: |
| COORD. VENDAS | AGL | ROBSON | 3400 | 0 | 3400 |
| GER VENDAS | AGL | FRANCISCO | 1250 | 0 | 1250 |
| GER VENDAS | AGL | JOSUE | 1000 | 0 | 1000 |
| GER VENDAS | AGL | ANA CLEIA | 2850 | 0 | 2850 |
| COORD VENDAS FSA | FSA | THOMAZ | 4500 | 0 | 4500 |
| COORD VENDAS CANAL | FSA | JORDAN | 9300 | 0 | 9300 |
| GER VENDAS | FSA | RAFAEL | 4400 | 0 | 4400 |
| GER II VENDAS | FSA | ALANA | 2750 | 0 | 2750 |
| GER VENDAS | FSA | DAIANA | 4250 | 0 | 4250 |
| COORD GERAL | FSA | TAVEIRA | 7300 | 0 | 7300 |
| COORD. CANAL | AGL/FSA | GEISI | 8500 | 0 | 8500 |
| COORD. REPASSE | AGL/FSA | BRUNO | 10600 | 0 | 10600 |
| GER. IA | AGL/FSA | LUIZ | 5342 | 0 | 5342 |

## Totais

- Quantidade de comissionados: 13.
- Valor bruto total: R$ 65.442,00.
- Desconto total de distrato: R$ 0,00.
- Valor liquido total: R$ 65.442,00.

## Regras Para Importacao

- Criar ciclo `2026-05`.
- Marcar origem como `excel_seed`.
- Criar registros com status inicial `calculado_seed`.
- Marcar todos como PJ/autonomo no primeiro MVP.
- Exigir NF de todos os registros do seed antes do envio ao Financeiro.
- Preservar valores importados para auditoria.
- Nao recalcular esses valores ate o motor oficial ser ativado.

## Persistencia Dev

Migration criada:

```text
/opt/7lm-connect/portal/Servidor/migracao_20260610_comissionamento_mvp_seed.sql
```

Schema criado:

```text
comissionamento
```

Tabelas iniciais:

- `comissionamento.ciclos`
- `comissionamento.resultados`

Permissoes iniciais:

- `comissionamento.view`
- `comissionamento.manage`
- `comissionamento.secretaria`

Recurso de menu registrado:

```text
codigo_modulo: comercial
codigo_recurso: comissionamento
rota_recurso: /comercial/comissionamento
```

Estado validado na maquina de desenvolvimento:

- ciclo: `2026-05`;
- resultados: 13;
- valor liquido total: R$ 65.442,00;
- rota API sem token: `401`, comportamento esperado para rota protegida.

## Uso No Preview

A primeira tela da Secretaria deve exibir:

- total do ciclo;
- 13 comissionados;
- tabela com funcao, cidade, nome, bruto, distrato e liquido;
- status de aprovacao;
- status de NF;
- status de envio ao Financeiro.

Endpoint inicial do preview:

```text
GET /api/comissionamento/ciclos/2026-05/preview
```

Contrato:

- rota protegida por autenticacao do portal;
- permissao requerida: `comissionamento.view`;
- origem atual: seed temporario em servico backend;
- frontend deve consumir via `/api`, nunca banco direto.

A tela do comissionado deve exibir:

- valor bruto;
- desconto;
- valor liquido;
- status;
- pendencia de NF;
- detalhe de calculo disponivel.

## Observacoes Do Excel

As abas individuais contem detalhes por pessoa e meses historicos. Para maio,
ha detalhes completos apenas em algumas abas. Por isso, o primeiro preview usa
`BASE PARA DADOS` como fonte consolidada e usa as abas individuais como
referencia visual da estrutura Regra 01 + Regra 02.

Nos proximos ciclos, o valor realizado deve vir do banco estruturado e o motor
oficial deve calcular Regra 01, Regra 02, distratos e valor final.
