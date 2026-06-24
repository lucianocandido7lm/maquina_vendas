# Backlog Inicial Do Orquestrador - Comissionamento

Este backlog organiza a ideia inicial em fases. Ele deve ser refinado depois da
analise dos arquivos Excel.

## Fase 0 - Descoberta E Mapeamento

Objetivo:

Entender regra atual antes de implementar.

Tarefas:

- receber Excel de gestores/coordenadores;
- receber Excel de corretores CLT;
- receber Excel de autonomos;
- listar abas, colunas e formulas;
- identificar dados de origem;
- identificar campos sensiveis;
- identificar status usados hoje;
- identificar excecoes;
- confirmar que a nomenclatura oficial e `CLT`;
- definir fluxo atual da secretaria;
- definir quem aprova o que;
- levantar modelos de e-mail atuais.

Entregaveis:

- mapa de regras;
- mapa de dados;
- glossario;
- lista de duvidas;
- criterios de aceite do MVP.

## Fase 1 - Modelo Canonico

Objetivo:

Desenhar estrutura base de banco, API e estados.

Tarefas:

- definir schema do modulo;
- definir tabelas de comissionados;
- definir tabela de comissoes;
- definir tabela de processamentos;
- definir tabela de regras versionadas;
- definir tabela de historico de alteracoes de regras, faixas e IPs;
- definir tabela de aprovacoes;
- definir tabela de e-mails;
- definir tabela de auditoria;
- definir permissoes;
- definir endpoints principais.

Entregaveis:

- desenho de tabelas;
- contrato de API;
- estados oficiais;
- permissoes;
- plano de migration.

## Fase 2 - MVP Secretaria

Objetivo:

Dar uma interface simples para operar comissoes.

Tarefas:

- dashboard com cards principais;
- semaforo geral;
- tabela de comissoes;
- filtros por periodo, status, corretor e valor;
- modal de detalhes;
- aprovar;
- rejeitar com motivo;
- enviar para RH/Financeiro;
- botao `Executar Fluxo Semanal`;
- logs automaticos de acao.

Entregaveis:

- tela operacional;
- endpoints de consulta/acao;
- logs de auditoria;
- validacao de permissoes.

## Fase 3 - Engine De Calculo

Objetivo:

Automatizar calculo com base nas regras mapeadas.

Tarefas:

- engine por tipo de comissionado;
- simulacao de processamento;
- processamento definitivo;
- aprovacao automatica quando permitido;
- escalonamento para gestor;
- deteccao de pendencias;
- reprocessamento controlado;
- historico de versao da regra usada.

Entregaveis:

- calculo auditavel;
- exemplos batendo com Excel;
- logs de processamento;
- validacao de duplicidade.

## Fase 4 - E-mails E Alertas

Objetivo:

Notificar pessoas certas com template correto e historico.

Tarefas:

- cadastro de templates;
- preview com variaveis;
- configuracao de destinatarios;
- envio para corretor/gestor/RH/Financeiro;
- historico de envio;
- falha e retentativa;
- alertas de prazo.

Entregaveis:

- fila/historico de e-mail;
- templates versionados;
- logs de entrega;
- validacao de variaveis.

## Fase 5 - Administrativo

Objetivo:

Permitir manutencao segura de regras e configuracoes.

Tarefas:

- cadastro/consulta de corretores;
- hierarquia visual;
- niveis de acesso;
- configurador de regras;
- edicao de Regra 01 por comissionado com faixas editaveis;
- edicao de Regra 02 por comissionado/IP com nome, tipo de comissao,
  indicador preconfigurado, alvo, bonus e janela de datas;
- simulador;
- versionamento;
- historico antes/depois de toda mudanca feita pela Secretaria;
- configuracao SMTP;
- teste de conexoes;
- historico de alteracoes.

Entregaveis:

- telas administrativas;
- permissoes de administracao;
- simulador validado;
- logs de alteracoes criticas.

## Fase 6 - Analytics E Relatorios

Objetivo:

Dar visao gerencial e exportacoes.

Tarefas:

- cards financeiros;
- performance operacional;
- graficos de volume;
- ranking de corretores;
- relatorio mensal PDF;
- relatorio de excecoes;
- auditoria exportavel;
- exportacao Excel/CSV;
- agenda de relatorios.

Entregaveis:

- dashboard analitico;
- exportacoes;
- relatorios;
- criterios de qualidade.

## Dependencias Criticas

- Excel com regras reais.
- Confirmacao de tipos de comissionado.
- Confirmacao de fluxo de aprovacao.
- Confirmacao de origem dos dados.
- Definicao de permissoes.
- Definicao de SMTP e politica de envio.

## Ordem Recomendada

1. Nao criar UI final antes da Fase 0.
2. Nao criar engine antes do modelo canonico.
3. Nao enviar e-mail real antes de preview/historico.
4. Nao criar botao master sem simulacao e permissao.
5. Nao levar para producao sem QA/auditoria.

## Decisao Atual - MVP Gestores/Coordenadores

O primeiro MVP confirmado deve usar o Excel
`Comissionamento - COORDENADORES - GERENTES.xlsx` como seed temporario de
desenvolvimento, com preview inicial do ciclo maio/2026 pela aba
`BASE PARA DADOS`.

Documentos de referencia:

- `mvp-gestores-coordenadores.md`
- `seed-maio-2026-excel.md`
- `fluxo-aprovacao-nf-financeiro.md`

Resumo operacional:

- Secretaria de Vendas e dona do fluxo.
- Marcelo aprova todos no primeiro momento.
- Todos os comissionados do MVP sao PJ/autonomos.
- Nota fiscal e obrigatoria antes do envio ao Financeiro.
- Falta de NF em 1 a 2 dias bloqueia pagamento.
- Regra 01 e Regra 02 serao editaveis.
- O realizado oficial vem do banco estruturado.
