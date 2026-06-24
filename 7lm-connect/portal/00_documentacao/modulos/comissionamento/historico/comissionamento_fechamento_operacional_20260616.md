# Comissionamento - Fechamento Operacional 2026-06-16

## Documentacao Atualizada

- `00_documentacao/modulos/comissionamento/README.md`
- `00_documentacao/modulos/comissionamento/fluxo-operacional-atual.md`
- `00_documentacao/banco_de_dados/comissionamento.md`
- `00_documentacao/modulos/comissionamento/historico/README.md`
- `00_documentacao/modulos/comissionamento/historico/fechamento-ciclos-maio-junho-2026-06-16.md`

## Maio/2026

- Ciclo: `2026-05`
- Resultados: `21`
- Bruto: `R$ 109.150,00`
- Liquido: `R$ 109.150,00`
- Regra 01 ativa: `21`
- Regra 02 ativa: `21`
- Regras orfas ativas: `0`
- Regra 02 sem IP: `0`
- Faixa unica `Valor Maio/2026`: `0`

Relatorios:

- `03_registros/comissionamento/execucoes/comissionamento_maio_2026_regras_gestores_oficial_apply.json`
- `03_registros/comissionamento/execucoes/comissionamento_maio_2026_escadas_ips_completos_apply.json`
- `03_registros/comissionamento/auditorias/backend/comissionamento_backend_audit_20260616_maio_escadas_ips_completos.json`

## Junho/2026

- Ciclo: `2026-06`
- Resultados: `22`
- Bruto: `R$ 0,00`
- Liquido: `R$ 0,00`
- Regra 01 ativa: `22`
- Regra 02 ativa: `22`
- Indicador inicial da Regra 01: `repasses`
- Objetivo geral de repasse inicial: `0`
- IPs historicos copiados de Maio: `2`
- IPs base editaveis criados: `20`

Relatorios:

- `03_registros/comissionamento/execucoes/comissionamento_reset_mensal_2026-06_apply.json`
- `03_registros/comissionamento/execucoes/comissionamento_junho_2026_regras_limpas_apply.json`
- `03_registros/comissionamento/auditorias/backend/comissionamento_backend_audit_20260616_junho_regras_limpas_final.json`

## Observacoes

- E-mails continuam redirecionados para Hudson e Fernanda enquanto
  `COMISSIONAMENTO_EMAIL_REDIRECT_TO` estiver preenchida.
- Marco Narciso fica fora dos ciclos de comissionamento e permanece apenas para
  contexto de Aprovacao Comercial.
- Douglas foi removido do ciclo porque nao e gestor.
- O reset mensal automatico foi instalado em
  `/etc/cron.d/7lm-comissionamento-reset-mensal`.
