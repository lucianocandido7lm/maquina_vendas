# Modulo Imoveis

## O que foi criado

- Tela de listagem: `/imoveis`
- Tela de cadastro/edicao: `/imoveis/cadastro`
- API protegida por permissao:
  - `imoveis.view`
  - `imoveis.create`
  - `imoveis.edit`
  - `imoveis.delete`
  - `imoveis.media.manage`

## Migration

Arquivo:

- `C:\Projetos Pessoais\7LM\7LM Connect\01_portal_em_node\Servidor\migracao_20260401_modulo_imoveis.sql`
- `C:\Projetos Pessoais\7LM\7LM Connect\01_portal_em_node\Servidor\migracao_20260404_schemas_modulares.sql`

Aplicar no PostgreSQL:

```sql
\i C:/Projetos Pessoais/7LM/7LM Connect/01_portal_em_node/Servidor/migracao_20260404_schemas_modulares.sql
\i C:/Projetos Pessoais/7LM/7LM Connect/01_portal_em_node/Servidor/migracao_20260401_modulo_imoveis.sql
```

Observacao:

- `sevenlm_connect` continua como schema institucional do portal.
- `connect_comercial` passa a concentrar as tabelas do modulo comercial/imoveis.
- `connect_financeiro` fica reservado para as tabelas do modulo financeiro.

## Dependencias para upload e importacao

O backend FastAPI precisa das libs `python-multipart` e `openpyxl`.

Instalacao:

```powershell
python -m pip install python-multipart openpyxl
```

Ou, se usar o arquivo de requisitos:

```powershell
python -m pip install -r C:\Projetos Pessoais\7LM\7LM Connect\01_portal_em_node\01_codigo_fonte\api_7lm_connect\requisitos_api.txt
```

## Storage local

As midias ficam salvas em:

```text
C:\Projetos Pessoais\7LM\7LM Connect\01_portal_em_node\02_publico\uploads\imoveis\{id-do-imovel}\
```

Variaveis relacionadas:

- `SEVENLM_CONNECT_DIRETORIO_PUBLICO`
- `SEVENLM_CONNECT_IMOVEIS_UPLOADS_DIR`
- `SEVENLM_CONNECT_IMOVEIS_UPLOADS_URL_BASE`
- `SEVENLM_CONNECT_IMOVEIS_TAMANHO_MAXIMO_IMAGEM_MB`
- `SEVENLM_CONNECT_IMOVEIS_TAMANHO_MAXIMO_VIDEO_MB`
- `SEVENLM_CONNECT_IMOVEIS_TOTAL_MAXIMO_ARQUIVOS_POR_ENVIO`
- `SEVENLM_CONNECT_IMOVEIS_IMPORTACAO_TAMANHO_MAXIMO_PLANILHA_MB`

## Rodar localmente

Backend:

```powershell
cd C:\Projetos Pessoais\7LM\7LM Connect\01_portal_em_node\01_codigo_fonte\api_7lm_connect
python aplicacao.py
```

Portal Node:

```powershell
cd C:\Projetos Pessoais\7LM\7LM Connect\01_portal_em_node\01_codigo_fonte
node servidor_do_portal.js
```

## Subir no servidor

1. Publicar os arquivos atualizados do projeto.
2. Instalar/atualizar os requisitos da API com `python-multipart`.
3. Aplicar a migration `migracao_20260401_modulo_imoveis.sql`.
4. Reiniciar os servicos:

```bash
systemctl restart 7lm-connect-api.service
systemctl restart 7lm-connect-portal.service
```

## Validacoes minimas apos subir

1. Abrir `/imoveis` com usuario que tenha `imoveis.view`.
2. Confirmar que o botao `Novo imovel` aparece somente com `imoveis.create`.
3. Importar uma planilha `.xlsx` em lote preenchendo cidade e bairro padrao.
4. Criar um imovel manualmente.
5. Editar o imovel com perfil que tenha `imoveis.edit`.
6. Enviar fotos e videos com perfil que tenha `imoveis.media.manage`.
7. Excluir com perfil que tenha `imoveis.delete`.

## Importacao em lote

- A importacao fica na propria pagina `/imoveis`, sem criar nova tela.
- Permissao exigida: `imoveis.create`.
- Endpoint utilizado pelo frontend: `POST /api/imoveis/importacao`.
- Formato aceito: `.xlsx` ou `.xlsm`.
- Campos-base do lote: `cidade_padrao`, `bairro_padrao`, `estado_padrao`, `cep_padrao`, `endereco_base`, `tipo_imovel_padrao` e `status_padrao`.
- O arquivo `C:\Projetos Pessoais\7LM\Documentação\Modelo_IMB.xlsx` ja e compativel com o parser implementado.
- O processamento retorna resumo com total importado, total ignorado por duplicidade e total com erro.
