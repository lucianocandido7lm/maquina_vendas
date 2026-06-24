# Perimetro De Seguranca: Internet, Portal, API E Banco

Este documento define a estrutura correta de seguranca para o 7LM Connect.

## Regra Principal

A internet nao deve acessar banco de dados diretamente.

A internet tambem nao deve depender de acesso direto a servicos internos da
aplicacao. O caminho correto e passar pelo perimetro HTTP, pelo portal e pela
API autenticada.

Fluxo esperado:

```text
Internet
  -> Apache HTTPS 443
  -> Portal Node 7LM Connect
  -> Proxy interno /api/*
  -> FastAPI 7LM Connect
  -> Postgres / schemas do projeto
```

Para cargas de dados:

```text
systemd timer
  -> script oficial no /opt
  -> Databricks
  -> Postgres schema connect_comercial
  -> API le dados tratados
  -> Portal/Frontend exibe dados autorizados
```

## Componentes Atuais

Apache:

- recebe HTTP/HTTPS publico;
- redireciona HTTP para HTTPS;
- encaminha `/` para o portal Node;
- serve alguns subpaths estaticos autorizados.

Portal Node:

- executa em `/opt/7lm-connect/portal`;
- serve arquivos publicos de `02_publico`;
- faz proxy de `/api/*` para a API interna;
- aplica headers de seguranca;
- controla host publico/canonico;
- usa sessao/cookies para fluxos de portal.

FastAPI:

- executa em `01_codigo_fonte/api_7lm_connect`;
- registra routers em `aplicacao.py`;
- usa autenticacao em `dependencias.py`;
- usa permissoes em `utilitarios/autorizacao.py`;
- acessa banco via pool em `banco.py`;
- registra auditoria tecnica no middleware de `aplicacao.py`.

Banco:

- deve ser acessado por API, scripts oficiais ou rotinas administrativas
  autorizadas;
- nao deve ser consumido diretamente por frontend;
- schemas de negocio ficam separados, por exemplo:
  - `sevenlm_connect`;
  - `connect_comercial`;
  - `maq_credito`;
  - `recrutamento_selecao`;
  - `system`.

## Contrato De API

Rotas protegidas devem usar:

```python
Depends(obter_usuario_autenticado)
```

Acoes sensiveis devem usar:

```python
exigir_permissao_portal
```

Permissoes ficam em:

```text
01_codigo_fonte/api_7lm_connect/utilitarios/autorizacao.py
```

O frontend deve chamar a API por `/api/...` no mesmo dominio do portal. Ele nao
deve chamar host, IP ou porta interna diretamente.

## Contrato De Dados

Novos modulos devem seguir este caminho:

1. Dados brutos ou externos entram por pipeline, importador ou API autorizada.
2. Dados persistem no schema correto.
3. Regras de negocio ficam no backend ou pipeline, nao apenas no frontend.
4. API entrega resposta ja validada e autorizada.
5. Frontend apenas consome o contrato da API.

Para Dashboard Comercial:

- pipeline oficial:
  `05_modulos/dashboard_comercial/backend/scripts/sync-databricks-to-connect-comercial.js`;
- destino: `connect_comercial`;
- hierarquia: `sevenlm_connect.funcionario_acesso`;
- API: `rotas/rotas_de_dashboard_comercial.py`;
- frontend: `05_modulos/dashboard_comercial`.

## Estado Observado Nesta Maquina

Estado desejado/funcional:

- Apache esta ativo nas portas 80/443.
- Portal Node esta ativo e usa `API_BASE` apontando para `127.0.0.1:8000`.
- Portal encaminha `/api/*` para a FastAPI.
- FastAPI usa autenticacao, permissoes e auditoria.

Pontos que exigem endurecimento antes de considerar o perimetro fechado:

- FastAPI esta ouvindo em `0.0.0.0:8000`.
- Portal Node esta ouvindo em todas as interfaces na porta `3000`.
- Postgres aparece ouvindo em todas as interfaces na porta `5432`, embora
  `pg_hba.conf` restrinja os hosts permitidos.
- Firewall local (`ufw`) esta inativo.

## Estado Informado Em Producao

Auditoria informada para a maquina de producao:

Fluxo canonico existente:

```text
Internet
  -> Apache publico em 80/443
  -> proxy para 127.0.0.1:3000
  -> Portal Node
  -> proxy interno /api para http://127.0.0.1:8000
  -> FastAPI
```

Conclusao atual:

- Existe mediador publico via Apache.
- O dominio `maquinadevendas7lm.app.br` passa pelo fluxo canonico.
- O Portal Node usa a FastAPI via `127.0.0.1:8000`.
- O perimetro ainda nao esta totalmente fechado apenas no Apache.

Bypasses diretos observados/informados:

- `3000/tcp`: Portal Node escutando em `*` e acessivel externamente.
- `8000/tcp`: FastAPI escutando em `0.0.0.0` e acessivel externamente.

Classificacao:

```text
Perimetro parcialmente fechado.
```

Isto significa que a arquitetura correta existe, mas ainda ha caminhos diretos
da internet para a aplicacao/API sem passar obrigatoriamente pelo Apache.

Esta secao e apenas documental. Nenhuma mudanca operacional foi aplicada.

## Recomendacao De Endurecimento

Para ambiente de producao, o padrao recomendado e:

- Apache publico: portas 80/443.
- Portal Node: somente `127.0.0.1:3000`.
- FastAPI: somente `127.0.0.1:8000`.
- Postgres: somente rede/local necessario, nunca aberto genericamente.
- Firewall permitindo apenas:
  - `22/tcp` para administracao controlada;
  - `80/tcp` e `443/tcp` para publico;
  - portas internas apenas para localhost ou IPs explicitamente autorizados.

Qualquer excecao precisa estar documentada com:

- motivo;
- origem permitida;
- porta;
- dono;
- data de revisao.

## Nao Fazer

- Nao expor porta de banco para a internet sem allowlist estrita.
- Nao expor FastAPI diretamente se o contrato publico e pelo portal.
- Nao colocar credenciais em frontend, bundle publico ou documentacao.
- Nao criar rota sem autenticacao quando ela acessa dados internos.
- Nao criar novo pipeline fora do `/opt/7lm-connect/portal`.
- Nao usar `/root/data-engineering` como runtime.
