# 7LM - implantacao de login por e-mail

## 1. Aplicar a migration

No banco PostgreSQL do projeto, execute:

```sql
\i C:/Projetos Pessoais/7LM/7LM Connect/01_portal_em_node/Servidor/migracao_20260401_login_email_usuario.sql
```

Essa migration:

- remove a obrigatoriedade de `matricula` em `sevenlm_connect.usuario`
- preserva a mesma tabela de usuarios
- cria unicidade parcial para `matricula`
- cria unicidade parcial para `correio_eletronico`

## 2. Garantir o usuario inicial

Com o ambiente da API apontando para o banco correto:

```powershell
python C:\Projetos Pessoais\7LM\7LM Connect\01_portal_em_node\Servidor\bootstrap_usuario_inicial_7lm.py
```

Usuario inicial:

- e-mail: `adm@7lm.com.br`
- senha: `123456`

O script nao duplica o usuario. Se ele ja existir, atualiza o cadastro e reaplica o perfil `Administrador do Portal`.

## 3. Rodar localmente

Portal Node:

```powershell
cd C:\Projetos Pessoais\7LM\7LM Connect\01_portal_em_node
npm install
npm start
```

API Python:

```powershell
cd C:\Projetos Pessoais\7LM\7LM Connect\01_portal_em_node\01_codigo_fonte\api_7lm_connect
python -m pip install -r requisitos_api.txt
python aplicacao.py
```

## 4. Subir no servidor

- publique os arquivos atualizados do portal e da API
- mantenha o `.env` existente do servidor
- execute a migration no PostgreSQL do servidor
- execute o bootstrap do usuario inicial no servidor
- reinicie os servicos da API, do portal Node e do Apache

## 5. Fluxo esperado

- login por `correio_eletronico + senha`
- MFA mantido no mesmo fluxo atual
- gestao manual de usuarios usando `sevenlm_connect.usuario`
- sem dependencia da base antiga de funcionarios para autenticacao
