# Documentacao Operacional Do 7LM Connect

Esta pasta concentra documentacao para desenvolvimento, operacao, migracao e
orientacao de agentes dentro do portal 7LM Connect.

O codigo da aplicacao continua nos diretorios atuais. Esta pasta apenas explica
como trabalhar neles.

## Indice

- `arquitetura/mapa-diretorios.md`: mapa dos diretorios e onde criar cada tipo
  de arquivo.
- `operacao/estado-atual-runtime.md`: servicos ativos, jobs, banco e status do
  runtime atual.
- `operacao/migracao-dev-para-producao-dashboard-comercial.md`: registro do que
  foi feito no desenvolvimento e checklist para levar para producao.
- `banco_de_dados/dashboard_comercial.md`: tabelas, schemas e regras de dados do
  Dashboard Comercial.
- `seguranca/perimetro-api-banco.md`: desenho de seguranca entre internet,
  portal, API e banco.
- `modulos/dashboard_comercial/operacao.md`: operacao especifica do Dashboard
  Comercial.
- `modulos/dashboard_comercial/historico/`: auditorias e consolidacoes
  historicas do Dashboard Comercial.
- `modulos/comissionamento/visao-inicial.md`: visao inicial do modulo de
  comissionamento da Maquina de Vendas.
- `modulos/comissionamento/backlog-orquestrador.md`: backlog faseado para o
  agente orquestrador.
- `modulos/comissionamento/mvp-gestores-coordenadores.md`: escopo confirmado do
  primeiro MVP de gestores/coordenadores.
- `modulos/comissionamento/seed-maio-2026-excel.md`: seed inicial de maio/2026
  extraido do Excel de gestores/coordenadores.
- `modulos/comissionamento/fluxo-aprovacao-nf-financeiro.md`: fluxo de
  aprovacao, nota fiscal, bloqueio e envio ao Financeiro.
- `modulos/comissionamento/plano-notificacoes-e-mails.md`: plano canonico de
  eventos, destinatarios, canais, templates, auditoria, endpoints e modelo de
  dados para e-mails e notificacoes do Comissionamento.
- `modulos/comissionamento/configuracao-envio-email-microsoft-graph.md`: guia
  geral para enviar e-mail via Microsoft Graph em qualquer sistema, com IDs,
  fluxo OAuth, endpoint SendMail, exemplos e boas praticas.
- `modulos/comissionamento/esteira-auditoria-notificacoes.md`: esteira
  operacional, auditoria, notificacoes, documentos e pacote simples de
  pagamento para Financeiro/RH.
- `modulos/comissionamento/frontend-historico-config-nf.md`: comportamento do
  frontend React para Historico, filtros, configuracao dinamica inicial e envio
  interno de Nota Fiscal.
- `modulos/comissionamento/handoff-orquestrador-2026-06-11.md`: fechamento do
  ciclo atual do Comissionamento, checklist aplicado, pendencias reais e prompt
  para o proximo agente orquestrador.
- `agentes/README.md`: catalogo de agentes especificos do projeto.
- `agentes/*.md`: prompts especializados por papel.
- `../03_registros/README.md`: mapa dos registros operacionais, logs,
  auditorias e backups locais.

## Agentes Do Projeto

O catalogo principal fica em:

```text
00_documentacao/agentes/README.md
```

Use esses prompts para orientar agentes por responsabilidade:

- arquitetura;
- novo modulo;
- backend API;
- frontend portal;
- produto/regras comerciais;
- dados do Dashboard Comercial;
- QA/auditoria;
- seguranca/permissoes;
- DevOps/systemd;
- migracao dev -> producao.

## Principio

Documente e desenvolva seguindo a estrutura existente:

- API em `01_codigo_fonte/api_7lm_connect`.
- Publico estatico em `02_publico`.
- Modulos fonte em `05_modulos`.
- Migrations e systemd de referencia em `Servidor`.
- Documentacao em `00_documentacao`.

Nao crie caminhos paralelos para resolver problemas que ja tem lugar definido no
projeto.
