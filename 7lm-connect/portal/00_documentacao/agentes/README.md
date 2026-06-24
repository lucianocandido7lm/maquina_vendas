# Prompts De Agentes Do Projeto

Esta pasta contem agentes especificos para o 7LM Connect. Eles foram escritos
para trabalhar dentro do runtime oficial em `/opt/7lm-connect/portal`, seguindo
a organizacao real do projeto e as regras de negocio ja aplicadas no Dashboard
Comercial.

Antes de usar qualquer agente, leia:

- `/opt/7lm-connect/portal/AGENTS.md`
- `/opt/7lm-connect/portal/00_documentacao/arquitetura/mapa-diretorios.md`
- `/opt/7lm-connect/portal/00_documentacao/operacao/estado-atual-runtime.md`

## Agentes Base

- `prompt_arquiteto.md`: decide onde cada nova parte deve morar, sem criar
  arquitetura paralela.
- `prompt_orquestrador_comissionamento.md`: quebra a ideia do modulo de
  comissionamento em regras, fases, tarefas e agentes especializados.
- `prompt_novo_modulo_7lm_connect.md`: cria novos modulos seguindo o padrao de
  API, frontend, pagina publica, permissao, docs e validacao.
- `prompt_backend_api.md`: cria/ajusta rotas FastAPI, permissoes, SQL e
  contratos de resposta.
- `prompt_frontend_portal.md`: cria/ajusta componentes React/Vite e publica
  build no portal.
- `prompt_seguranca_permissoes.md`: revisa autenticacao, permissoes, auditoria,
  secrets e exposicao de endpoints.

## Agentes Do Dashboard Comercial

- `prompt_produto_regras_comerciais.md`: traduz regra comercial para metrica,
  filtro, endpoint, tabela e criterio de aceite.
- `prompt_dados_dashboard_comercial.md`: cuida do pipeline Databricks ->
  `connect_comercial`, staging, KPIs e logs.
- `prompt_qa_auditoria_dashboard_comercial.md`: valida filtros, graficos,
  endpoints, dados e regressao do Dashboard Comercial.

## Agentes Do Comissionamento

- `prompt_produto_comissionamento.md`: transforma Excel e regra manual em
  formula, excecoes, casos de teste e criterios de aceite.
- `prompt_qa_auditoria_comissionamento.md`: valida calculos, aprovacoes,
  e-mails, permissoes, logs e auditoria.

## Agentes De Operacao

- `prompt_devops_systemd.md`: systemd, timers, logs e operacao.
- `prompt_migracao_dev_producao.md`: leva mudancas do dev para producao sem
  reintroduzir runtime em `/root/data-engineering`.

## Roteamento Rapido

Use um unico agente quando a tarefa for bem delimitada. Use dois agentes quando
a tarefa atravessar camadas. Exemplos:

- Novo bloco visual com dado existente: `prompt_produto_regras_comerciais.md`
  + `prompt_frontend_portal.md`.
- Novo indicador com tabela/coluna nova: `prompt_produto_regras_comerciais.md`
  + `prompt_dados_dashboard_comercial.md` + `prompt_backend_api.md`.
- Novo modulo inteiro: `prompt_novo_modulo_7lm_connect.md` +
  `prompt_seguranca_permissoes.md`.
- Novo modulo de comissionamento: `prompt_orquestrador_comissionamento.md` como
  ponto de partida, depois agentes especializados conforme a fase.
- Deploy para producao: `prompt_migracao_dev_producao.md` +
  `prompt_devops_systemd.md`.

Nenhum agente deve concluir uma tarefa sem informar:

1. Arquivos alterados.
2. Regra de negocio impactada.
3. Como validou.
4. Risco residual, se existir.
