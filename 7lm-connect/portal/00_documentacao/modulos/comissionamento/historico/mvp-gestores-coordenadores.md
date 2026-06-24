# MVP Comissionamento - Gestores E Coordenadores

Este documento registra o escopo confirmado para o primeiro MVP do modulo de
comissionamento da Maquina de Vendas.

## Contexto

O primeiro MVP deve reproduzir, de forma familiar e auditavel, a experiencia do
Excel:

```text
/root/data-engineering/apps/commercial-dashboard/Comissionamento - COORDENADORES - GERENTES.xlsx
```

O Excel sera usado apenas como seed inicial de desenvolvimento. Ele nao deve
virar runtime nem dependencia operacional do portal.

Runtime oficial:

```text
/opt/7lm-connect/portal
```

## Objetivo Do MVP

Permitir que a Secretaria de Vendas acompanhe, revise, aprove, solicite nota
fiscal e envie comissoes de gestores/coordenadores/autonomos PJ para o
Financeiro, usando um fluxo rapido e claro.

O primeiro preview deve mostrar o ciclo de maio/2026 com base na aba
`BASE PARA DADOS` do Excel.

## Usuarios

- Secretaria de Vendas: dona do negocio e do fluxo inteiro.
- Marcelo / Head Comercial: aprovador de todos no primeiro momento.
- Comissionado PJ/autonomo: visualiza calculo e envia nota fiscal.
- Financeiro: recebe pacote para pagamento.
- RH: participa no fluxo de CLT quando esse tipo entrar em fase posterior.

## Decisoes Confirmadas

- Todos os comissionados deste MVP sao PJ/autonomos.
- CLT nao faz parte deste primeiro MVP de gestores/coordenadores.
- Quando CLT entrar, o envio sera para Financeiro e RH.
- PJ/autonomo deve enviar nota fiscal para pagamento pelo Financeiro.
- Falta de nota fiscal bloqueia o envio/pagamento.
- Prazo esperado para nota fiscal: 1 a 2 dias.
- Marcelo aprova todos os tipos no primeiro momento.
- Secretaria de Vendas e a unica area que pode editar metas, regras e fluxo.
- O campo `Realizado` sempre vem do banco de dados estruturado.
- Regra 01 e Regra 02 devem ser editaveis.
- A Secretaria define nome, alvo, janela de corte e parametros das regras, mas
  nao digita o realizado oficial.
- Indicadores usados nas regras devem vir somente da lista preconfigurada pela
  API/banco.
- Regra 02 deve ser calculada automaticamente no fechamento do ciclo.
- Distrato reduz a comissao no mesmo periodo em que ocorreu.
- O comissionado deve visualizar como o valor foi calculado.
- Toda mudanca feita pela Secretaria em regra, IP, faixa ou meta precisa gerar
  historico/auditoria.

## Indicadores Configuraveis

Regra 01 e Regra 02 devem permitir escolha de indicador. Lista inicial:

- `leads`
- `visitas`
- `propostas_aprovadas`
- `propostas_total`
- `vendas`
- `repasses`
- `cancelamentos`
- `distratos`
- `ipc`
- `sobrepreco_medio`

Os indicadores devem ser lidos do banco/API, nunca digitados como realizado
oficial.

## Regra 01 - Escada De Atingimento

Estrutura minima:

- nome da meta;
- indicador;
- objetivo;
- realizado vindo do banco;
- peso;
- percentual de atingimento;
- faixa de atingimento;
- valor da faixa;
- valor calculado.

Campos editaveis pela Secretaria:

- indicador, escolhido entre os indicadores preconfigurados;
- objetivo;
- peso;
- faixas da escada, incluindo rotulo, percentual minimo, percentual maximo e
  valor/multiplicador aplicado.

Faixas comuns observadas no Excel:

- `0% a 39,99%`
- `40% a 59,99%`
- `60% a 79,99%`
- `80% a 94,99%`
- `95% a 104,99%`
- `105% a 109,99%`
- `110% a 114,99%`
- `115% a 119,99%`
- `120% a 129,99%`
- `130% a 139,99%`
- `+ que 140%`
- `>=120%`

Algumas regras possuem condicao especial `Com Aurium`. Essa condicao deve ser
modelada como criterio editavel, nao codificada fixamente no frontend.

## Regra 02 - IPs E Bonus

Estrutura minima:

- nome do IP;
- indicador;
- tipo de comissao (`numero`, `percentual`, `decimal` ou `moeda`);
- operador;
- alvo;
- data inicial do IP;
- data fim do IP;
- realizado vindo do banco;
- resultado automatico: atingiu ou nao atingiu;
- valor do bonus;
- periodo/corte usado no calculo.

Campos editaveis pela Secretaria:

- nome do IP;
- indicador, escolhido entre os indicadores preconfigurados;
- tipo de comissao;
- operador;
- alvo;
- valor do bonus;
- data inicial e data fim do IP;
- periodo/corte.

Exemplo de janela de corte:

- se o IP exigir `10 repasses ate o dia 20`, a regra deve guardar
  `data_inicial` e `data_fim` para que o motor calcule apenas o periodo valido.

Exemplos vindos do Excel:

- sobrepreco medio maior que R$ 3.500;
- sobrepreco medio maior que R$ 4.000;
- sobrepreco medio maior que R$ 5.000;
- IPC minimo 1,1;
- IPC minimo 1,2;
- IPC minimo 1,3;
- quantidade de repasses ate dia 20;
- quantidade de vendas por canal;
- imobiliarias com venda;
- visitas SDR;
- leads/atendimento IA.

O antigo campo manual `SIM/NÃO` vira resultado calculado do sistema no
fechamento do ciclo.

## Historico E Auditoria Das Regras

Toda alteracao feita pela Secretaria deve ser registrada. O historico minimo
deve guardar:

- comissionado afetado;
- regra alterada (`Regra 01` ou `Regra 02`);
- faixa ou IP alterado, quando aplicavel;
- valores anteriores e novos valores;
- usuario responsavel;
- data/hora;
- motivo ou acao executada;
- versao da regra;
- resultado da simulacao antes da publicacao.

No MVP visual, a tela pode mostrar um historico local de rascunhos para ajudar
a operacao. Para publicacao oficial, o historico precisa ser persistido via API
e tabela de auditoria, preservando o calculo historico de ciclos anteriores.

## Fluxo Do Ciclo

Fluxo confirmado:

```text
Calculo/simulacao
  -> Secretaria de Vendas
  -> Marcelo / Head Comercial
  -> Comissionado PJ/autonomo para envio de NF
  -> Financeiro
  -> Pagamento
```

Status propostos:

- `calculado_seed`
- `calculado`
- `pendente_secretaria`
- `aprovado_secretaria`
- `pendente_marcelo`
- `aprovado_marcelo`
- `pendente_nf`
- `nf_recebida`
- `bloqueado_nf`
- `pronto_financeiro`
- `enviado_financeiro`
- `enviado_rh`
- `aguardando_pagamento`
- `pago`
- `rejeitado`
- `erro`

## Calendario Operacional

A semana do dia 20 pertence ao fluxo interno do Financeiro.

O modulo de comissionamento deve concluir o fluxo interno uma semana antes,
passando por:

1. Secretaria de Vendas.
2. Marcelo / Head Comercial.
3. Comissionado PJ/autonomo para envio de NF.
4. Envio ao Financeiro.

Exemplo informado:

- em junho/2026, dia 20 cai em sabado;
- o pacote deve ser enviado ao Financeiro ate 15/06/2026.

## Visao Do Comissionado

O comissionado deve ver:

- periodo;
- valor bruto;
- distratos/descontos;
- valor liquido;
- metas;
- realizado;
- percentual atingido;
- faixa aplicada;
- IPs atingidos e nao atingidos;
- status de aprovacao;
- status da nota fiscal;
- status do pagamento.

## Visao Da Secretaria

A Secretaria deve ver:

- total do ciclo;
- total por cidade/regiao;
- total por funcao;
- pendentes de aprovacao;
- pendentes de NF;
- bloqueados por NF;
- prontos para Financeiro;
- enviados;
- pagos;
- editor de Regra 01;
- editor de Regra 02;
- escolha do comissionado antes de editar regras;
- historico de rascunhos e alteracoes;
- acoes de aprovar, rejeitar, solicitar NF e enviar ao Financeiro.

## Preview De Desenvolvimento

URL local/dev atual:

```text
http://167.71.83.166/01_paginas/Comercial/comissionamento.html
```

URL via localhost na maquina:

```text
http://127.0.0.1/01_paginas/Comercial/comissionamento.html
```

Endpoint usado pela pagina quando houver sessao/token do portal:

```text
GET /api/comissionamento/ciclos/2026-05/preview
```

O endpoint agora le o seed persistido no schema `comissionamento` da base de
desenvolvimento. Sem sessao, a pagina exibe fallback local apenas para facilitar
o preview em desenvolvimento. Esse fallback nao deve ser tratado como regra
operacional definitiva.

## Permissoes

- Secretaria de Vendas:
  - visualizar todos;
  - editar regras;
  - simular ciclo;
  - fechar ciclo;
  - aprovar etapa Secretaria;
  - solicitar NF;
  - validar NF;
  - enviar Financeiro/RH.
- Marcelo:
  - visualizar todos;
  - aprovar todos no primeiro MVP.
- Comissionado:
  - visualizar apenas as proprias comissoes;
  - anexar NF quando exigida.
- Financeiro/RH:
  - visualizar pacotes enviados;
  - registrar ou consultar status de pagamento, quando essa etapa for ativada.

## Nao Fazer No MVP

- Nao criar app separada.
- Nao usar `/root/data-engineering` como runtime.
- Nao fazer frontend acessar banco direto.
- Nao deixar regra critica apenas no frontend.
- Nao enviar pagamento sem aprovacao e sem NF quando NF for obrigatoria.
