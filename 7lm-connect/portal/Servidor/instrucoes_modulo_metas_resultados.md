# Módulo Abertura e Objetivos

## Acesso

O módulo fica em `/metas/dashboard` e exige a permissão `metas.resultados.view`.

Permissões principais:

- `metas.resultados.view`: visualiza dashboard, metas, resultados e histórico.
- `metas.resultados.manage`: cadastra e altera metas de colaboradores conforme hierarquia.
- `metas.resultados.admin`: administra todas as metas sem restrição de equipe.
- `metas.resultados.gerenciais.manage`: cadastra e altera metas gerenciais.
- `metas.resultados.resultados.manage`: lança e altera resultados.
- `metas.resultados.import`: importa planilhas.

## Fluxo Operacional

1. Acesse `Abertura e Objetivos` pela barra lateral.
2. Use os filtros de mês, ano, equipe, gestor, corretor e indicador.
3. Em `Metas dos Corretores`, cadastre ou altere metas. Toda alteração cria nova versão e registra histórico.
4. Em `Metas dos Gestores`, acompanhe a meta automática calculada pela soma dos subordinados. Uma meta manual ativa sobrescreve a automática.
5. Em `Metas Gerenciais`, cadastre metas por regional, empreendimento ou global.
6. Em `Resultados`, lance o realizado por pessoa, indicador, mês e ano.
7. Em `Histórico`, consulte auditoria das alterações e importe a planilha de metas.

## Importação

O importador aceita `.xlsx`, `.xlsm`, `.csv` e `.tsv`.

Aba de metas por colaborador:

- `id_indicado_meta`
- `funcionario`
- `indicador`
- `meta_potencial`
- `meta`
- `data_inicial`
- `data_fim`

Aba de metas gerenciais:

- `regiao`
- `meta_observacao`
- `meta`
- `fato_1`
- `fato_2`
- `fato_consolidado`
- `indicador_meta`
- `pessoa`
- `peso`
- `tipo_meta`
- `visao_meta`
- `data_inicio`
- `data_fim`

O preview valida cada linha antes da confirmação. Linhas inválidas são exibidas e não bloqueiam as linhas válidas.
