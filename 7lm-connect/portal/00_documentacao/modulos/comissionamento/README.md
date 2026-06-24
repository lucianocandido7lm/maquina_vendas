# Comissionamento - Documentacao Viva

Data de referencia: 2026-06-16

Use esta pasta como ponto de entrada do modulo de Comissionamento.

## Documentos Canonicos

- `../../banco_de_dados/comissionamento.md`: schema, tabelas, colunas, chaves,
  constraints, fontes oficiais e queries de validacao.
- `hierarquia-identidade-2026-06.md`: origem de usuarios, gestores,
  coordenadores, hierarquia mensal, snapshot e identidade produtiva.
- `contrato-api.md`: endpoints, permissoes, payloads, persistencia e contrato
  frontend/API.
- `fluxo-operacional-atual.md`: esteira atual, status, revisao/recalculo,
  Aprovacao Comercial, NF, Pagamento e Historico.
- `validacao-indicadores-regra-01-02.md`: plano canonico para Regra 01 e
  Regra 02 usando indicadores, metas e realizados oficiais do banco.

## E-mail

- `plano-email-microsoft-graph.md`: plano operacional do envio por Microsoft
  Graph.
- `configuracao-envio-email-microsoft-graph.md`: configuracao tecnica de
  provider. Nao adicionar secrets ou tokens neste arquivo.

## Historico

Documentos antigos, handoffs e planos superados ficam em `historico/`. Eles
podem ser consultados para rastreabilidade, mas nao devem ser usados como
fonte principal de implementacao.

## Regra De Arquitetura

O runtime atual deve seguir:

```text
Frontend autenticado -> /api/comissionamento/* -> FastAPI -> Postgres -> API -> Frontend
```

Excel, CSV, JSON local e arquivos em `/root/data-engineering` nao sao fonte
runtime do portal.

## Registro De Trabalho - 2026-06-15

- Auditoria backend/API criada e registrada em `03_registros`, validando o
  caminho `Frontend -> /api/comissionamento/* -> FastAPI -> Postgres`.
- Documentacao canonica consolidada em `00_documentacao/modulos/comissionamento`
  e `00_documentacao/banco_de_dados`.
- Fluxo operacional ajustado e documentado para revisao/recalculo, Aprovacao
  Comercial, NF, pagamento, notificacoes e historico.
- Ciclos operacionais concentrados em `2026-06` e `2026-06-fluxo-manual`.
- Plano de indicadores Regra 01/02 documentado para remover metricas MVP e
  passar a usar metas/realizados oficiais.

## Validacao De Estrutura

Conferencia realizada em 2026-06-15 contra
`00_documentacao/arquitetura/mapa-diretorios.md`:

- Backend oficial: `01_codigo_fonte/api_7lm_connect`.
- Frontend fonte do modulo: `05_modulos/comissionamento`.
- Bundle publico gerado: `02_publico/02_recursos/02_scripts/comissionamento.js`.
- Auditorias e registros: `03_registros`.
- Documentacao canonica: `00_documentacao/modulos/comissionamento` e
  `00_documentacao/banco_de_dados`.

Observacao: neste ambiente, `/opt/7lm-connect/portal` nao apareceu como
worktree Git ativo. Backups e registros historicos nao devem ser tratados como
fonte oficial.

## Registro De Trabalho - 2026-06-16

Complemento operacional documentado em:

```text
historico/handoff-ajustes-regras-emails-acessos-2026-06-16.md
historico/fechamento-ciclos-maio-junho-2026-06-16.md
```

Resumo:

- Aba Regras bloqueia edicao fora da etapa Calculada/Revisao.
- Botao bloqueado virou `Acompanhar comissao`.
- Publicacao de Regra 01/02 envia e-mail ao comissionado com resumo legivel.
- Bruto, Bonus IPs e Liquido passaram a recalcular dinamicamente no Kanban.
- Resumo de e-mail deixou de listar payload tecnico e passou a mostrar faixa,
  atingimento, valor da faixa e valores atuais.
- Corrigida formatacao de moeda para nao transformar `4463.0` em
  `R$ 44.630,00`.
- Todos os e-mails de teste do Comissionamento foram redirecionados para
  Hudson e Fernanda via `COMISSIONAMENTO_EMAIL_REDIRECT_TO`.
- Fernanda Leao Uchoa De Oliveira foi vinculada ao setor/perfil
  `Secretaria de Vendas` com permissoes completas de Comissionamento.
- Maio/2026 foi fechado com 21 resultados, financeiro preservado em
  `R$ 109.150,00`, Regra 01/02 ativa para todos, escadas completas e nenhum IP
  vazio.
- Junho/2026 foi preparado limpo com 22 resultados, financeiro zerado,
  Regra 01 de repasses, Regra 02 com IP base/historico e objetivo geral de
  repasse editavel pela Secretaria.
- Reset mensal automatico foi criado para preparar o novo ciclo no primeiro dia
  util do mes.
