# Registros Operacionais

Esta pasta guarda evidencias de runtime, logs, auditorias, backups operacionais e
saidas de scripts. A raiz deve ficar leve: use as subpastas abaixo para manter
os arquivos encontraveis.

## Estrutura

- `logs/`: logs de API, portal e reinicios manuais.
- `runtime/`: arquivos de stdout/stderr usados durante execucao local.
- `comissionamento/`: backups, auditorias e relatorios JSON do modulo de
  Comissionamento.
- `segredos/`: arquivos sensiveis locais. Nao documentar valores aqui.

## Regras

- Logs da API ficam em `logs/api`.
- Logs do portal ficam em `logs/portal`.
- Backups de dados do Comissionamento ficam em `comissionamento/backups`.
- Auditorias de backend ficam em `comissionamento/auditorias/backend`.
- Auditorias de e-mail ficam em `comissionamento/auditorias/emails`.
- Saidas de dry-run/apply/restauracao ficam em `comissionamento/execucoes`.
- Fechamentos e handoffs em Markdown devem ir para `00_documentacao`, nao para
  esta pasta.
