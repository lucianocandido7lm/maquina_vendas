# Modulo MaqCredito

## Objetivo

O MaqCredito foi integrado ao Maquina de Vendas como modulo nativo em `/maq-credito`.
O pacote original fica em `Integracao/Sistema-maqCredito.rar` e a copia adaptada usada para manutencao fica em `Integracao/Sistema-maqCredito_extraido_20260606`.

## Rotas do portal

- `/maq-credito`
- `/maq-credito/corretor`
- `/maq-credito/analista`
- `/maq-credito/analista/checklist`
- `/maq-credito/cca/acompanhamento`
- `/maq-credito/cca/checklist`
- `/maq-credito/gestor/checklist`
- `/maq-credito/gestor/telemetria`
- `/maq-credito/painel/checklist-documentos`

As rotas legadas do pacote original, como `/corretor`, `/analista`, `/gestor/checklist` e `/painel/checklist-documentos`, redirecionam para as rotas novas dentro de `/maq-credito`.

## Backend nativo

Arquivos principais:

- `01_codigo_fonte/api_7lm_connect/rotas/rotas_de_maq_credito.py`
- `01_codigo_fonte/api_7lm_connect/modulos/maq_credito/processos.py`
- `01_codigo_fonte/api_7lm_connect/modulos/maq_credito/contexto.py`
- `01_codigo_fonte/api_7lm_connect/modulos/maq_credito/db.py`
- `01_codigo_fonte/api_7lm_connect/modulos/maq_credito/storage.py`
- `01_codigo_fonte/api_7lm_connect/modulos/maq_credito/models.py`

Prefixo de API: `/api/processos`.

Endpoints principais:

- `GET /api/processos`
- `GET /api/processos/diagnosticos/gargalos`
- `GET /api/processos/events`
- `GET /api/processos/{reserva}`
- `PUT /api/processos/{reserva}`
- `POST /api/processos/{reserva}/sla/start`
- `POST /api/processos/{reserva}/sla/stop`
- `PUT /api/processos/{reserva}/documentos/{documento_key}`
- `PUT /api/processos/{reserva}/documentos/{documento_key}/pendencia`
- `PUT /api/processos/{reserva}/relacionamento/{relacionamento_key}`
- `GET /api/processos/{reserva}/messages`
- `POST /api/processos/{reserva}/messages`
- `GET /api/processos/{reserva}/creditu`
- `PUT /api/processos/{reserva}/creditu`
- `GET /api/processos/{reserva}/uploads`
- `POST /api/processos/{reserva}/uploads`
- `DELETE /api/processos/{reserva}/uploads`

## Banco de dados

Migracao: `Servidor/migracao_20260606_maq_credito.sql`.

Schema: `maq_credito`.

Tabelas:

- `processos`
- `documentos_status`
- `relacionamento_status`
- `creditu_dados`
- `documentos_pendencias`
- `pendencias_historico`
- `checklist_messages`
- `uploads`
- `sla_processos`
- `contextos`
- `log_eventos`

O startup da API tambem chama `init_db()` para garantir o schema minimo quando a aplicacao subir.

## Uploads

Os anexos foram removidos do Supabase e agora ficam no storage local configurado por `MAQ_CREDITO_UPLOADS_DIRETORIO`.
O default local e `02_publico/uploads/maq_credito/processos`.

As URLs retornadas seguem este formato:

`/api/processos/{reserva}/uploads/{storage_path}`

## Frontend

O frontend principal do modulo e nativo do portal, sem app Next embutido e sem iframe.
Todas as rotas de `/maq-credito/...` servem a mesma tela integrada ao shell do 7LM:

- `02_publico/01_paginas/MaqCredito/index.html`
- `02_publico/02_recursos/01_estilos/maq_credito.css`
- `02_publico/02_recursos/02_scripts/maq_credito.js`

A tela usa:

- sidebar e autenticacao do portal;
- permissao `maq.credito.view`;
- abas internas para Corretor, CCA, Analista, Checklist e Gestor;
- consumo direto da API `/api/processos`;
- cadastro/edicao de reserva, status Caixa/Agehab, pendencias, mensagens e uploads.

Os HTMLs exportados do pacote original ficam apenas como legado/referencia e nao devem ser a experiencia principal do usuario.

## Como atualizar o modulo quando chegar nova versao

1. Extraia o novo pacote em `Integracao` apenas para analise funcional.
2. Compare regras, campos e fluxos do pacote com a tela nativa do portal.
3. Replique as mudancas necessarias em `maq_credito.js`, `maq_credito.css` e/ou nos endpoints do backend.
4. Se o pacote trouxer novas entidades, criar migracao no schema `maq_credito`.
5. Nao substituir `index.html` por HTML exportado do Next.
6. Rode os testes locais e publique.

## Validacao minima antes de publicar

- `node --check 01_codigo_fonte/servidor_do_portal.js`
- `node --check 02_publico/02_recursos/02_scripts/maq_credito.js`
- `python -m py_compile` nos arquivos do modulo
- `GET /saude` na API local
- `GET /api/processos` na API local
- abrir no navegador:
  - `/maq-credito`
  - `/maq-credito/corretor`
  - `/maq-credito/analista`
  - `/maq-credito/cca/acompanhamento`
  - `/maq-credito/gestor/telemetria`
  - `/maq-credito/painel/checklist-documentos`
- verificar console sem erro JS, sem request 404/500 e sem erro de hidratacao.
- confirmar que nao aparece botao `Sair` dentro do modulo; o logout fica somente no shell do portal.

## Deploy

Na publicacao, enviar ao servidor:

- novos arquivos em `01_codigo_fonte/api_7lm_connect/modulos/maq_credito`
- `01_codigo_fonte/api_7lm_connect/rotas/rotas_de_maq_credito.py`
- alteracoes em `01_codigo_fonte/api_7lm_connect/aplicacao.py`
- alteracoes em `01_codigo_fonte/api_7lm_connect/configuracoes.py`
- alteracoes em `01_codigo_fonte/api_7lm_connect/requisitos_api.txt`
- alteracoes em `01_codigo_fonte/servidor_do_portal.js`
- `02_publico/01_paginas/MaqCredito/index.html`
- `02_publico/02_recursos/01_estilos/maq_credito.css`
- `02_publico/02_recursos/02_scripts/maq_credito.js`
- `02_publico/01_paginas/inicio.html`
- `Servidor/migracao_20260606_maq_credito.sql`

Depois do envio:

1. Instalar dependencias novas da API, se necessario (`psycopg[binary]` e `pypdf`).
2. Aplicar a migracao do schema `maq_credito`, ou reiniciar a API para o `init_db()` criar/atualizar o minimo.
3. Reiniciar API e portal.
4. Validar a URL publica `/maq-credito` e a API publica `/api/processos`.
