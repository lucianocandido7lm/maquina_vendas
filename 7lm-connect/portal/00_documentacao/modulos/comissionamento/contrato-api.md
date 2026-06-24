# Contrato API - Comissionamento

Data de referencia: 2026-06-15

## Perimetro

Contrato publico do modulo:

```text
/api/comissionamento/*
```

O frontend deve chamar somente o portal/API. Nao deve acessar Postgres, porta
interna, Excel, CSV ou arquivos locais.

## Rotas De Leitura

- `GET /api/comissionamento/config`
- `GET /api/comissionamento/ciclos`
- `GET /api/comissionamento/ciclos/{ciclo_id}/resultados`
- `GET /api/comissionamento/minha-comissao`
- `GET /api/comissionamento/resultados/{resultado_id}`
- `GET /api/comissionamento/ciclos/{ciclo_id}/eventos`
- `GET /api/comissionamento/resultados/{resultado_id}/eventos`
- `GET /api/comissionamento/regras`
- `GET /api/comissionamento/notificacoes`
- `GET /api/comissionamento/notificacoes/historico`
- `GET /api/comissionamento/notificacoes/templates`
- `GET /api/comissionamento/notificacoes/regras`

## Rotas De Acao

- `POST /api/comissionamento/ciclos/{ciclo_id}/hierarquia/snapshot`
- `POST /api/comissionamento/resultados/{resultado_id}/enviar-head`
- `POST /api/comissionamento/resultados/{resultado_id}/aprovar-head`
- `POST /api/comissionamento/resultados/{resultado_id}/rejeitar`
- `POST /api/comissionamento/resultados/{resultado_id}/solicitar-ajuste`
- `POST /api/comissionamento/resultados/{resultado_id}/reenviar-lembrete-nf`
- `POST /api/comissionamento/resultados/{resultado_id}/nf`
- `POST /api/comissionamento/resultados/{resultado_id}/registrar-pagamento`
- `POST /api/comissionamento/ciclos/{ciclo_id}/enviar-pacote-pagamento`
- `POST /api/comissionamento/regras/{regra_id}/publicar`

Rotas legadas ainda existentes podem permanecer para compatibilidade, mas a UI
deve priorizar o fluxo acima.

## Regras E Persistencia

Persistencia canonica:

- Regra 01 e Regra 02 publicadas: `comissionamento.regras_publicadas`.
- Eventos: `comissionamento.eventos`.
- Status e valores: `comissionamento.resultados`.
- NF: `comissionamento.documentos`.
- Notificacoes: tabelas `comissionamento.notificacao_*`.

Observacoes:

- `POST /api/comissionamento/regras` registra auditoria/validacao de rascunho,
  mas nao substitui a publicacao oficial.
- `PUT /api/comissionamento/notificacoes/regras` registra auditoria de ajuste,
  mas a regra detalhada ativa depende da implementacao de persistencia
  especifica.

## Permissoes

Principais permissoes usadas pelo backend:

- `comissionamento.view`
- `comissionamento.view.own`
- `comissionamento.secretaria`
- `comissionamento.manage`
- `comissionamento.aprovar.head`
- `comissionamento.financeiro`
- `comissionamento.rh`

A verificacao oficial passa por:

```python
exigir_permissao_portal(...)
usuario_possui_permissao(...)
```

## Idempotencia E Auditoria

Acoes POST devem enviar `Idempotency-Key`. O backend grava:

- resposta idempotente em `comissionamento.idempotency_keys`;
- evento operacional em `comissionamento.eventos`;
- auditoria tecnica em `system.auditoria_evento`;
- notificacao e fila quando aplicavel.

## Fonte Do Frontend

Fonte oficial:

```text
05_modulos/comissionamento/src/api/comissionamentoApi.js
```

Build publico:

```text
02_publico/02_recursos/05_modulos/comissionamento
```

Nao editar bundle gerado manualmente; alterar fonte React e rodar build.
