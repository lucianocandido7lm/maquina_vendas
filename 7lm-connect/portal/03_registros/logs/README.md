# Logs

Logs historicos e arquivos gerados por reinicios manuais.

- `api/`: logs da API FastAPI, incluindo `api_7lm_connect_restart_*.log`.
- `portal/`: logs do servidor Node do portal.

Para estado atual de servicos systemd, prefira `journalctl`; esta pasta serve
principalmente para evidencias salvas em arquivo.
