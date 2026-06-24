# Handoff - Restauracao Maio/2026 Com Maquina De Vendas

Data: 2026-06-16

## Resumo

O ciclo oficial `2026-05` foi recriado no modulo de Comissionamento como
`Maio/2026`.

Objetivo atendido:

- trazer os valores reais de maio;
- trocar apelidos do Excel por nomes/perfil/hierarquia da Maquina de Vendas;
- manter Regra 01 e IPs publicados para o Kanban quando havia detalhe na aba
  individual da planilha;
- preservar o valor liquido historico do ciclo.

## Fontes Usadas

- Backup: `03_registros/comissionamento/backups/backup_comissionamento_remocao_ciclos_nao_2026_06_20260615_174304.json`.
- Planilha: `/root/data-engineering/apps/commercial-dashboard/Comissionamento - COORDENADORES - GERENTES.xlsx`.
- Identidade/hierarquia: `comissionamento.resultados`, `comissionamento.hierarquia_snapshot`,
  `sevenlm_connect.funcionario_acesso` e `sevenlm_connect.usuario`.

## Implementacao

Foi criado o importador idempotente:

```text
01_codigo_fonte/api_7lm_connect/scripts/restaurar_ciclo_maio_2026.py
```

Ele recria apenas `2026-05` e limpa/reinsere:

- `comissionamento.ciclos`;
- `comissionamento.resultados`;
- `comissionamento.regras_publicadas`;
- `comissionamento.hierarquia_snapshot`;
- evento de auditoria `ciclo_maio_2026_restaurado`.

Relatorio gerado:

```text
03_registros/comissionamento/execucoes/comissionamento_restauracao_maio_2026.json
```

Auditoria backend gerada:

```text
03_registros/comissionamento/auditorias/backend/comissionamento_backend_audit_20260616_maio_2026.json
```

## Mapeamentos De Identidade

Mapeamentos principais aplicados:

- `ROBSON` -> `Robson Ferreira Paulo`
- `FRANCISCO` -> `Francisco Lucielio De Queiroz`
- `JOSUE` -> `Josue Gomes De Souza`
- `ANA CLEIA` -> `Ana Cleia Nonato`
- `THOMAZ` -> `Thomaz Moreira Aquino`
- `JORDAN` -> `Jordan Vasconcelos`
- `RAFAEL` -> `Rafael De Lucena Martins`
- `ALANA` -> `Alana Rabelo Da Costa`
- `DAIANA` -> `Daiana Soares Da Rocha`
- `TAVEIRA` -> `Marco Taveira`
- `GEISI` -> `Geisiane Gomes Dos Santos`
- `BRUNO` -> `Bruno Macario`
- `LUIZ` -> `Luiz Aquino`

Casos inferidos ficam registrados em `validacao_lideranca.maio_2026`.

## Valores Validados

Preview da API para `2026-05`:

- quantidade: 13 comissionados;
- bruto Regra 01 total: R$ 62.442,00;
- Bonus IPs total: R$ 3.000,00;
- distrato total: R$ 0,00;
- liquido total: R$ 65.442,00.

Detalhes com IP extraido de aba individual:

- `BRUNO`: Regra 01 R$ 8.600,00 + IPs R$ 2.000,00 = liquido R$ 10.600,00.
- `TAVEIRA`: Regra 01 R$ 6.300,00 + IPs R$ 1.000,00 = liquido R$ 7.300,00.

Para abas sem bloco `Maio/2026`, foi mantido o valor consolidado da aba
`BASE PARA DADOS` como Regra 01 e IPs zerados, com observacao auditavel.

## Ajuste Tecnico Necessario

O backend passou a respeitar `substituir_faixas` e `substituir_ips` em
`regras_publicadas`.

Motivo: quando uma regra publicada de maio tinha IPs vazios, o preview herdava
os IPs de exemplo do MVP. Agora uma Regra 02 publicada pode substituir a lista
por vazia, evitando valores artificiais no Kanban.

## Validacoes Executadas

Comandos executados:

```text
/opt/7lm-connect/portal/.venv/bin/python -m py_compile \
  repositorios/comissionamento.py \
  scripts/restaurar_ciclo_maio_2026.py

/opt/7lm-connect/portal/.venv/bin/python \
  scripts/restaurar_ciclo_maio_2026.py

/opt/7lm-connect/portal/.venv/bin/python \
  scripts/auditar_comissionamento_banco_api.py \
  --ciclo 2026-05 \
  --saida /opt/7lm-connect/portal/03_registros/comissionamento/auditorias/backend/comissionamento_backend_audit_20260616_maio_2026.json
```

Resultado da auditoria: `status_geral = ok`.

## Operacao

A API foi reiniciada em `0.0.0.0:8000` depois do ajuste de backend.

Log do restart:

```text
03_registros/logs/api/api_7lm_connect_restart_20260616_maio_2026.log
```
