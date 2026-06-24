# Mapa De Diretorios

Raiz operacional:

```text
/opt/7lm-connect/portal
```

## Diretorios Principais

### `01_codigo_fonte`

Codigo fonte do portal e da API.

- `servidor_do_portal.js`: servidor Node que entrega o portal.
- `componentes/`: componentes JS compartilhados do portal.
- `api_7lm_connect/`: API FastAPI.

Regra: backups manuais `*.bak*` de codigo fonte devem ir para `backups/`, nao
ficar misturados com o arquivo ativo.

### `01_codigo_fonte/api_7lm_connect`

API Python/FastAPI.

- `aplicacao.py`: cria app FastAPI e registra routers.
- `configuracoes.py`: variaveis de ambiente e configuracao central.
- `banco.py`: pool asyncpg.
- `dependencias.py`: autenticacao e dependencias FastAPI.
- `rotas/`: endpoints HTTP.
- `servicos/`: regras de negocio.
- `repositorios/`: acesso a dados quando separado das rotas/servicos.
- `modelos/`: modelos e schemas.
- `validacoes/`: validacoes de entrada.
- `utilitarios/`: funcoes compartilhadas.
- `scripts/`: rotinas operacionais Python.
- `tarefas/`: tarefas internas.
- `modulos/`: submodulos com estrutura propria.

Regra: nova API nasce em `rotas/`; se crescer, extraia regra para `servicos/` e
persistencia para `repositorios/`.

### `02_publico`

Arquivos estaticos servidos pelo portal.

- `01_paginas/`: paginas HTML publicas.
- `02_recursos/`: assets, scripts, estilos e bundles.
- `02_recursos/05_modulos/`: builds dos modulos frontend.
- `04_componentes/`: componentes publicos.

Regra: nao editar bundle gerado manualmente quando existir fonte em `05_modulos`.
Altere a fonte e rode build.

### `03_registros`

Registros e arquivos de runtime local.

- `README.md`: indice operacional da pasta.
- `logs/api`: logs historicos da API e reinicios manuais.
- `logs/portal`: logs historicos do servidor Node.
- `runtime`: stdout/stderr de runtime local.
- `comissionamento/backups`: backups JSON do modulo de Comissionamento.
- `comissionamento/auditorias/backend`: auditorias Banco/API do
  Comissionamento.
- `comissionamento/auditorias/emails`: auditorias da esteira de e-mails.
- `comissionamento/execucoes`: relatorios de dry-run, apply, reset e
  restauracao.
- `segredos`: arquivos sensiveis locais; nao versionar nem documentar valores.

Regra: Markdown de fechamento, handoff e explicacao operacional vai para
`00_documentacao`, nao para `03_registros`.

### `04_testes`

Testes unitarios e integrados do portal.

### `05_modulos`

Fontes de modulos independentes ou semi-independentes.

- `dashboard_comercial/`: fonte React/Vite e scripts Node do Dashboard Comercial.
- `maq_credito/`: modulo Maquina de Credito.

### `Servidor`

Infraestrutura e banco.

- `migracao_*.sql`: migrations SQL.
- `systemd/`: units de referencia.
- `bootstrap_*.py`: scripts de bootstrap.
- `instrucoes_*.md`: instrucoes historicas e operacionais.

Regra: migrations novas devem ficar aqui com data no nome.

### `backups`

Historico manual de arquivos e copias de seguranca operacionais.

- `codigo_fonte/servidor_do_portal`: snapshots antigos do servidor Node do
  portal.

Regra: mantenha backups identificados por origem e assunto. Codigo ativo fica
em `01_codigo_fonte`; historico fica aqui.

### `00_documentacao`

Documentacao operacional e prompts para agentes.

Nao e runtime. Serve para orientar desenvolvimento, operacao e migracao.

## Onde Colocar Novas Coisas

- Nova rota de API: `01_codigo_fonte/api_7lm_connect/rotas`.
- Nova regra de negocio Python: `01_codigo_fonte/api_7lm_connect/servicos`.
- Novo acesso estruturado a banco: `01_codigo_fonte/api_7lm_connect/repositorios`.
- Nova migration SQL: `Servidor/migracao_YYYYMMDD_descricao.sql`.
- Novo frontend de modulo: `05_modulos/<nome_do_modulo>`.
- Build publico de frontend: `02_publico/02_recursos/05_modulos/<nome_do_modulo>`.
- Nova documentacao: `00_documentacao`.
- Novo prompt de agente: `00_documentacao/agentes`.
- Novo log ou saida operacional: subpasta correspondente em `03_registros`.

## O Que Evitar

- Criar runtime em `/root/data-engineering`.
- Criar scripts soltos na raiz sem necessidade.
- Editar backups como se fossem fonte oficial.
- Duplicar regra de negocio entre frontend e backend sem documentar.
- Colocar credenciais em arquivos de documentacao.
