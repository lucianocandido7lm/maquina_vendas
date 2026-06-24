# Handoff Producao - Hierarquia, Regras, Recalculo E Secretaria

Data: 2026-06-15

## Objetivo

Registrar as mudancas feitas no modulo de Comissionamento para aproximar a
esteira de producao:

- fonte oficial inicial de hierarquia em
  `connect_comercial.dashboard_gc_produtividade_hierarquia`;
- persistencia real de Regra 01 e Regra 02;
- pedido de revisao/recalculo pelo Head e pelo Comissionado;
- melhoria da visao da Secretaria para detalhe expansivel;
- validacao dos mock dados contra gestores/coordenadores do banco.

Raiz oficial:

```text
/opt/7lm-connect/portal
```

## Banco De Dados

Migration aplicada:

```text
Servidor/migracao_20260615_comissionamento_producao_hierarquia_regras_recalculo.sql
```

Tabelas criadas:

- `comissionamento.hierarquia_snapshot`
- `comissionamento.regras_publicadas`

Uso esperado:

- `hierarquia_snapshot` congela a hierarquia por ciclo, usando somente
  `connect_comercial.dashboard_gc_produtividade_hierarquia`.
- `regras_publicadas` guarda versoes ativas e historicas de Regra 01 e Regra
  02 por ciclo/comissionado.
- O preview continua funcionando sem regra publicada, mas quando houver regra
  ativa ele passa a mostrar a versao publicada.

Snapshot validado em ciclo isolado:

```text
ciclo: 2026-06-email-audit
referencia: 2026-06
linhas: 118
gestores: 4
coordenadores: 5
```

## Backend

Arquivos principais:

```text
01_codigo_fonte/api_7lm_connect/repositorios/comissionamento.py
01_codigo_fonte/api_7lm_connect/rotas/rotas_de_comissionamento.py
01_codigo_fonte/api_7lm_connect/servicos/notificacoes_comissionamento.py
```

Mudancas:

- `buscar_preview_ciclo` agora aplica regras publicadas e equipe do snapshot.
- `POST /api/comissionamento/regras/{regra_id}/publicar` salva versao real em
  `comissionamento.regras_publicadas` antes de registrar auditoria.
- Novo endpoint:

```text
POST /api/comissionamento/ciclos/{ciclo_id}/hierarquia/snapshot
```

- `solicitar_ajuste` passou a representar pedido de revisao/recalculo.
- O pedido de revisao exige motivo.
- O pedido volta a comissao para a Secretaria com status operacional
  `calculado`.
- Status de NF/Financeiro/Pagamento da nova rodada voltam para o inicio da
  esteira daquela comissao.
- Evento registrado: `recalculo_solicitado`.
- Pagamento concluido/ERP continuam fora desta rodada.

## Frontend

Arquivos principais:

```text
05_modulos/comissionamento/src/App.jsx
05_modulos/comissionamento/src/styles.css
05_modulos/comissionamento/src/config/comissionamentoConfig.js
```

Mudancas na visao da Secretaria:

- Detalhe lateral ganhou botao de expandir/reduzir.
- Quando expandido, o workspace redistribui as colunas para dar mais largura ao
  detalhe do comissionado.
- Textos longos agora quebram dentro dos cards, badges, tabela, stepper,
  valores, Regra 01, Regra 02 e lista de pessoas vinculadas.
- A tabela da Secretaria deixa de forcar `nowrap`, reduzindo estouro visual.
- O painel lateral compacta o stepper e a escada de Regra 01 para funcionar em
  largura menor.

Mudancas na visao do Comissionado:

- Botao `Pedir revisao/recalculo`.
- Motivo obrigatorio via prompt.
- A acao usa a rota existente `solicitar-ajuste`, agora tratada como nova
  rodada pela Secretaria.

Textos atualizados:

- `Solicitar ajuste` virou `Pedir revisao/recalculo`.
- Evento `recalculo_solicitado` aparece como `Revisao/recalculo solicitado`.

## Conferencia Dos Mock Dados

Consulta feita comparando `comissionamento.resultados` do ciclo `2026-05` com
gestores/coordenadores distintos em
`connect_comercial.dashboard_gc_produtividade_hierarquia` referencia `2026-06`.

Resultado:

- nenhum seed de `2026-05` bate automaticamente por nome exato normalizado;
- ha correspondencia humana/apelido para alguns nomes;
- a hierarquia real usa nomes completos.

Seeds atuais:

```text
ROBSON
FRANCISCO
JOSUE
ANA CLEIA
THOMAZ
JORDAN
RAFAEL
ALANA
DAIANA
TAVEIRA
GEISI
BRUNO
LUIZ
```

Gestores/coordenadores encontrados na base oficial `2026-06`:

```text
Geisiane Gomes Dos Santos
Jordan Ribeiro Vasconcelos
Jordan Vasconcelos
Marco Taveira
Thomaz Moreira Aquino
Vago
```

Leitura operacional:

- `GEISI` provavelmente corresponde a `Geisiane Gomes Dos Santos`.
- `JORDAN` provavelmente corresponde a `Jordan Ribeiro Vasconcelos` ou
  `Jordan Vasconcelos`.
- `TAVEIRA` provavelmente corresponde a `Marco Taveira`.
- `THOMAZ` provavelmente corresponde a `Thomaz Moreira Aquino`.
- Os demais seeds nao aparecem na hierarquia oficial de junho usada na
  conferencia.

Recomendacao para producao:

- nao usar nome/apelido como chave final;
- gerar resultados produtivos ja com `comissionado_id` derivado do snapshot;
- idealmente carregar documento/e-mail quando a origem preencher esses campos;
- manter o seed `2026-05` apenas como base demonstrativa/auditoria historica.

## Validacoes Executadas

Comandos executados:

```text
python3 -m py_compile \
  01_codigo_fonte/api_7lm_connect/repositorios/comissionamento.py \
  01_codigo_fonte/api_7lm_connect/rotas/rotas_de_comissionamento.py \
  01_codigo_fonte/api_7lm_connect/servicos/notificacoes_comissionamento.py

npm run build
```

Resultado:

- Python compilou sem erro.
- Build Vite compilou sem erro.
- API reiniciada via `7lm-connect-api.service`.
- Servico ficou ativo apos restart.

## Proximos Passos Para Producao

Complemento aplicado em 2026-06:

- `handoff-producao-2026-06-dados-reais.md` descreve a migration de identidade,
  a geracao do ciclo `2026-06`, Pessoas vinculadas sem mock e e-mails com
  destinatarios reais auditaveis em allowlist.

1. Criar ciclo produtivo do mes correto.
2. Gerar snapshot oficial pelo endpoint de Secretaria.
3. Gerar resultados de comissionamento usando os `comissionado_id` do snapshot.
4. Publicar Regra 01 e Regra 02 pelo painel de Regras.
5. Conferir preview da Secretaria com detalhe expandido.
6. Rodar fluxo: Secretaria -> Head -> Comissionado/NF ou RH/Financeiro.
7. Manter e-mails reais em allowlist ate liberar hierarquia de destinatarios.
