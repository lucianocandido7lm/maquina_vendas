# Registros Do Comissionamento

Arquivos operacionais gerados por scripts, auditorias e restauracoes do modulo
de Comissionamento.

## Subpastas

- `backups/`: snapshots usados para restauracao ou desfazer operacoes.
- `auditorias/backend/`: relatorios `comissionamento_backend_audit_*.json`.
- `auditorias/emails/`: relatorios `comissionamento_email_audit_*.json`.
- `execucoes/`: saidas de scripts de dry-run, apply, reset e restauracao.

## Convencao

Mantenha o nome original do arquivo com data/hora no final. Quando houver par
`dry_run` e `apply`, os dois devem ficar juntos em `execucoes`.
