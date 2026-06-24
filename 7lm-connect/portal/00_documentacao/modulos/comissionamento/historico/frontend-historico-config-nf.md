# Frontend React: Historico, Configuracao, Filtros E NF

## Objetivo

Registrar o comportamento atual do frontend React do Comissionamento e o
contrato esperado para backend, auditoria e QA.

O modulo fica em:

```text
05_modulos/comissionamento
```

O build publicado fica em:

```text
02_publico/02_recursos/05_modulos/comissionamento
```

A rota oficial continua:

```text
/comercial/comissionamento
```

## Abas Atuais

- Secretaria: cockpit operacional com Kanban/tabela, filtros e drawer de
  detalhe.
- Head Comercial: fila de pendentes e ja aprovadas/etapa seguinte.
- Comissionado: visao propria, primeiro explicando onde esta a comissao.
- Regras: edicao publicada por comissionado para Regra 01 e Regra 02.
- Historico: timeline do ciclo com filtros por pessoa, evento, etapa, regra,
  NF, pagamento, usuario e periodo.

## Configuracao Centralizada

O frontend passou a concentrar constantes em:

```text
05_modulos/comissionamento/src/config/comissionamentoConfig.js
```

Constantes criadas:

- `COMMISSION_STATUS`
- `COMMISSION_STAGES`
- `COMMISSION_ACTIONS`
- `COMMISSION_TYPES`
- `COMMISSION_FLOW_PROFILES`
- `COMMISSION_FIELDS`
- `COMMISSION_FILTERS`
- `COMMISSION_INDICATORS`
- `COMMISSION_EVENT_TYPES`
- `COMMISSION_DOCUMENT_TYPES`
- `COMMISSION_NOTIFICATION_TYPES`

Essas constantes sao fallback local para o futuro endpoint:

```text
GET /api/comissionamento/config
```

Quando o backend entregar configuracao dinamica, o frontend deve substituir o
fallback pelo payload da API, mantendo o mesmo formato sem espalhar textos no
JSX.

## Perfis De Fluxo No Frontend

O frontend entende tres perfis operacionais iniciais:

- `corretor_autonomo`: Corretor Autonomo, exige Nota Fiscal, segue para
  Financeiro.
- `corretor_clt`: Corretor CLT, nao exige Nota Fiscal, segue para RH e
  Financeiro.
- `gestor_coordenador_autonomo`: Gestor/Coordenador Autonomo, exige Nota
  Fiscal, segue para Financeiro e pode visualizar pessoas vinculadas quando o
  backend retornar hierarquia.

Fonte esperada futura no payload:

```json
{
  "comissionado": {
    "tipo": "PJ_AUTONOMO",
    "perfil_fluxo": "gestor_coordenador_autonomo"
  },
  "fluxo": {
    "perfil_fluxo": "gestor_coordenador_autonomo"
  }
}
```

Enquanto o backend nao enviar `perfil_fluxo`, o frontend infere:

- `CLT` no tipo/funcao => `corretor_clt`;
- `GEST`, `GER`, `COORD`, `HEAD`, `DIRETOR`, `SUPERV` no tipo/funcao =>
  `gestor_coordenador_autonomo`;
- demais PJ/autonomos => `corretor_autonomo`.

Essa inferencia e apenas fallback de UX. A regra definitiva de permissao e
visibilidade deve vir do backend.

## Filtros Da Secretaria

Filtros disponiveis:

- ciclo;
- busca geral;
- cidade/regiao;
- cargo/funcao;
- fluxo do comissionado;
- etapa;
- status de NF;
- status de pagamento;
- faixa atingida da Regra 01;
- Regra 02 com algum IP atingidonao atingido;
- valor minimo;
- valor maximo;
- pendencias rapidas.

A tabela e o Kanban usam os mesmos filtros. O clique no nome da tabela abre o
mesmo detalhe lateral usado pelo Kanban.

## Historico

A aba Historico exibe eventos oficiais quando o endpoint existir:

```text
GET /api/comissionamento/ciclos/{ciclo_id}/eventos
GET /api/comissionamento/resultados/{resultado_id}/eventos
```

Enquanto o backend nao persistir todos os eventos, o frontend monta eventos
operacionais de fallback com base no preview do ciclo. Esses eventos deixam
claro que sao uma leitura do estado atual, nao substituem auditoria oficial.

Campos esperados por evento:

- `id`
- `ciclo_id`
- `resultado_id`
- `tipo_evento`
- `criado_em`
- `responsavel` ou `usuario_nome`
- `etapa_anterior`
- `etapa_nova`
- `valor_anterior`
- `valor_novo`
- `regra`
- `campo`
- `comentario`
- `documento_id`
- `payload.antes`
- `payload.depois`

Regras de visibilidade:

- Secretaria ve tudo do ciclo.
- Head ve eventos relacionados ao fluxo de aprovacao.
- Comissionado ve somente eventos da propria comissao.

## Nota Fiscal

PJ/autonomo ve a area `Enviar Nota Fiscal` somente quando a comissao estiver na
etapa `aguardando_nf`.

Campos enviados:

- `arquivo`
- `numero_nf`
- `data_emissao`
- `valor_nf`
- `observacao`

Endpoint esperado:

```text
POST /api/comissionamento/resultados/{resultado_id}/nf
```

O envio usa `multipart/form-data` e cabecalho `Idempotency-Key`.

Resposta minima esperada:

- `documento_id`
- `status_nf`
- `evento_id`

Download futuro deve ser protegido:

```text
GET /api/comissionamento/documentos/{documento_id}
```

CLT nao ve upload nem esteira de NF. A visao CLT mostra somente:

- Comissao informada;
- Enviada para RH/Financeiro;
- Aguardando pagamento;
- Paga.

## Fluxo CLT Validado Pelo Excel

Arquivo analisado:

```text
/root/data-engineering/apps/commercial-dashboard/COMISSÃO CORRETORES CLT.xlsx
```

Abas encontradas:

- ciclos mensais de `03-2025` ate `04-2026`;
- aba `DESLIGAMENTO - CLT`.

Padrao identificado:

- a planilha e organizada por corretor CLT;
- cada corretor possui vendas repassadas vinculadas;
- colunas recorrentes: corretor, venda repassada, empreendimento, bloco,
  unidade, cliente, data de venda, data de assinatura, data kit registro,
  valor de contrato, meta/bonus/conformidade e total;
- formulas somam linhas de vendas por corretor;
- nos meses mais recentes aparecem percentuais de comissao sobre valor de
  contrato, como `0,4%`, `0,6%`, `0,7%`, `0,8%`, e bonus adicionais;
- nao ha envio de Nota Fiscal para CLT.

Regra operacional assumida para o portal:

- CLT segue fluxo de ciencia da comissao;
- depois da aprovacao, a Secretaria envia resumo para RH e Financeiro;
- a etapa de NF fica oculta e com status interno `nao_aplicavel`;
- o historico deve registrar calculo, aprovacao, envio RH/Financeiro e
  pagamento;
- desligamento CLT deve ser tratado como excecao auditavel do ciclo, com
  motivo e periodo.

Ponto pendente para produto/backend:

- confirmar quais percentuais por faixa/meta serao oficiais para CLT antes de
  virar motor definitivo.

## Contratos De API Consumidos Ou Preparados

Consultas:

- `GET /api/comissionamento/config`
- `GET /api/comissionamento/ciclos`
- `GET /api/comissionamento/ciclos/{ciclo_id}/resultados`
- `GET /api/comissionamento/ciclos/{ciclo_id}/eventos`
- `GET /api/comissionamento/resultados/{resultado_id}/eventos`
- `GET /api/comissionamento/minha-comissao?ciclo_id=YYYY-MM`
- `GET /api/comissionamento/regras?vigencia=YYYY-MM`

Acoes:

- `POST /api/comissionamento/resultados/{resultado_id}/aprovar-secretaria`
- `POST /api/comissionamento/resultados/{resultado_id}/aprovar-head`
- `POST /api/comissionamento/resultados/{resultado_id}/rejeitar`
- `POST /api/comissionamento/resultados/{resultado_id}/solicitar-nf`
- `POST /api/comissionamento/resultados/{resultado_id}/nf`
- `POST /api/comissionamento/resultados/{resultado_id}/validar-nf`
- `POST /api/comissionamento/ciclos/{ciclo_id}/enviar-financeiro`
- `POST /api/comissionamento/resultados/{resultado_id}/registrar-pagamento`
- `POST /api/comissionamento/regras/{regra_id}/publicar`

Todas as acoes mutaveis devem usar `Idempotency-Key`.

## Publicacao De Regras E Historico

O botao `Publicar agora` envia payload estruturado para:

```text
POST /api/comissionamento/regras/{regra_id}/publicar
```

O backend registra evento em `system.auditoria_evento` com:

- ciclo;
- comissionado;
- regra publicada;
- antes/depois;
- comentario;
- usuario/sessao;
- `Idempotency-Key`.

A aba Historico passa a consumir:

```text
GET /api/comissionamento/ciclos/{ciclo_id}/eventos
GET /api/comissionamento/resultados/{resultado_id}/eventos
```

Enquanto o motor oficial ainda nao recalcula e persiste versoes definitivas, a
publicacao fica registrada como auditoria operacional e nao deve ser confundida
com gravacao definitiva de tabela de regras versionadas.

## Visao Hierarquica Do Comissionado

Gestores, gerentes, coordenadores, head, diretorsupervisor podem ver a
secao `Pessoas vinculadas` na propria visao.

Fonte esperada futura:

- `equipe`;
- `subordinados`;
- `pessoas_abaixo`;
- `corretores_vinculados`.

No preview administrativo, enquanto o backend nao envia vinculo oficial, a tela
usa cidade/regiao como fallback visual para validacao de UX. Esse fallback nao
deve ser usado como regra de permissao em producao.

## Pontos Para Backend E QA

- Persistir `comissionamento.eventos` com antes/depois para edicao de regras,
  transicoes de etapa, NF, pacote e pagamento.
- Validar vinculo do comissionado no upload de NF.
- Mascarar dados sensiveis conforme perfil.
- Retornar `acoes_permitidas` por resultado.
- Garantir que usuario `view.own` nunca receba dados de terceiros.
- Criar testes de responsividade para filtros, timeline e upload.
