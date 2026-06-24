# Modulo De Comissionamento - Visao Inicial

Este documento registra a ideia inicial do modulo de comissionamento da Maquina
de Vendas. Ele ainda nao e implementacao.

## Objetivo

Automatizar e simplificar o processo de comissionamento de corretores,
autonomos, gestores e coordenadores, reduzindo trabalho manual da secretaria de
vendas e criando trilha auditavel para calculo, aprovacao, envio e pagamento.

## Contexto

A aplicacao existente usa:

- Portal 7LM Connect;
- frontend React/Vite em modulos;
- API FastAPI;
- PostgreSQL;
- integracao com Databricks;
- systemd para rotinas agendadas.

O novo modulo deve ser integrado como funcao da Maquina de Vendas, nao como
aplicacao separada.

## Usuarios

- Secretaria de vendas.
- Corretores CLT a confirmar.
- Corretores autonomos.
- Gestores.
- Coordenadores.
- Financeiro.
- RH.
- Administradores.

## Proposta De Interface Principal

Layout:

- header com logo, usuario logado e logout;
- sidebar com Dashboard, Comissoes, Relatorios e Configuracoes;
- area principal com cards de resumo:
  - total de comissoes pendentes;
  - processadas;
  - em analise;
  - aprovadas/enviadas.

Tabela de comissoes:

- nome do corretor;
- valor;
- status;
- data de vencimento;
- acoes.

Acoes por linha:

- ver detalhes;
- aprovar;
- rejeitar;
- enviar para RH/Financeiro.

Modal de detalhes:

- dados do corretor;
- vendas do periodo;
- calculo detalhado;
- observacoes;
- historico de acoes.

Status visual:

- vermelho: pendente/erro/critico;
- amarelo: em analise/atencao;
- verde: aprovado/concluido;
- azul: enviado/processado externamente.

Botao master:

- `Executar Fluxo Semanal`;
- `Processar Todas Comissoes` somente com simulacao/confirmacao e permissao.

## Automacao De E-mails

Templates iniciais:

- comissao aprovada;
- pendencia detectada;
- relatorio mensal;
- lembrete de prazo.

Variaveis previstas:

- `{{nome_corretor}}`;
- `{{valor_comissao}}`;
- `{{data_pagamento}}`;
- `{{status_comissao}}`;
- `{{nome_gestor}}`;
- `{{periodo_referencia}}`.

Configuracoes:

- enviar para corretor;
- enviar para gestor;
- enviar para RH;
- enviar para Financeiro.

Historico:

- destinatario;
- template;
- status de entrega;
- data/hora;
- erro quando houver.

## Automacao De Fluxos

Rota inicial proposta:

```text
Corretor -> Gestor -> Financeiro -> RH
```

Regras automaticas propostas para validacao:

- aprovar automaticamente comissoes abaixo de `R$ 1000`;
- escalar para gestor comissoes acima de `R$ 5000`;
- envio automatico nas sextas-feiras;
- alertas 3 dias antes, 1 dia antes e no vencimento.

Estas regras precisam ser confirmadas com base no Excel e no processo atual.

## Administracao

Gestao de usuarios:

- nome;
- e-mail;
- CPF;
- hierarquia;
- status ativo;
- historico de alteracoes.

Permissoes:

- visualizar proprias comissoes;
- aprovar equipe;
- administrar sistema;
- operar fluxo da secretaria;
- consultar Financeiro/RH.

Regras:

- percentual base;
- bonus por meta;
- descontos;
- tipos de comissao;
- simulador;
- versionamento.

Integracoes:

- Databricks;
- PostgreSQL;
- SMTP;
- webhooks futuros.

## Dashboards Analiticos

Cards:

- volume financeiro;
- performance operacional;
- status atual;
- eficiencia do sistema.

Graficos:

- timeline de processamento;
- ranking de corretores;
- distribuicao por status;
- tendencias.

Relatorios:

- mensal em PDF;
- excecoes;
- auditoria;
- performance de gestores.

Exportacoes:

- Excel;
- PDF;
- CSV;
- relatorios agendados.

## Principios

- Primeiro regra, depois tela.
- Primeiro simulacao, depois processamento definitivo.
- Toda aprovacao deve ter auditoria.
- Todo envio deve ter historico.
- Frontend nunca acessa banco direto.
- Regras criticas nao ficam apenas no frontend.
- Secretaria deve operar com interface simples e visual.
