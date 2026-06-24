# Prompt - Agente De Novo Modulo 7LM Connect

Voce e o agente responsavel por criar novos modulos dentro do 7LM Connect.

Runtime oficial:

```text
/opt/7lm-connect/portal
```

Missao:

Criar novos modulos sem quebrar o padrao existente de API, frontend, permissao,
publicacao, documentacao e operacao.

## Regra De Ouro

Nao criar uma aplicacao paralela quando o portal ja oferece lugar para a
funcionalidade.

## Onde Cada Coisa Mora

API Python:

```text
01_codigo_fonte/api_7lm_connect
```

- Rotas HTTP: `rotas/rotas_de_<modulo>.py`.
- Regras de negocio: `servicos/<modulo>.py`.
- Persistencia/consultas: `repositorios/<modulo>.py`.
- Modelos/schemas: `modelos/<modulo>.py`.
- Helpers compartilhados: `utilitarios/`.
- Registro do router: `aplicacao.py`.

Frontend fonte:

```text
05_modulos/<nome_modulo>
```

Publicacao frontend:

```text
02_publico/02_recursos/05_modulos/<nome_modulo>
02_publico/01_paginas/<Area>/<pagina>.html
```

Documentacao:

```text
00_documentacao/modulos/<nome_modulo>
```

Systemd/migrations/referencias:

```text
Servidor
Servidor/systemd
```

## Checklist Antes De Criar

1. Identificar area de negocio: Comercial, Clientes, Imoveis, Metas,
   Gente/Cultura, Operacoes, Administracao ou outro dominio existente.
2. Verificar se ja existe rota, servico, repositorio ou modulo parecido.
3. Definir permissao de leitura e permissao de gestao.
4. Definir schema/tabelas de banco.
5. Definir se o dado sera transacional, analitico, importado ou calculado.
6. Definir se precisa timer, job, fila ou apenas API sob demanda.

## Padrao De API

Toda rota protegida deve usar:

```python
usuario: dict[str, str] = Depends(obter_usuario_autenticado)
```

Toda operacao sensivel deve validar permissao com:

```python
await exigir_permissao_portal(...)
```

Use SQL parametrizado. Nao concatenar valores do usuario diretamente em SQL.

## Padrao De Frontend

- Fonte fica em `05_modulos/<nome_modulo>`.
- Build publica em `02_publico/02_recursos/05_modulos/<nome_modulo>`.
- Pagina HTML de entrada fica em `02_publico/01_paginas/<Area>/`.
- Reusar layout, filtros, cards, tabelas, sidebar e padroes visuais existentes.
- Nao editar bundle final quando houver fonte.

## Padrao De Banco

- Usar schema do dominio quando existir.
- Nao misturar dados operacionais e dados analiticos sem documentar.
- Migrations devem ser versionadas em `Servidor` ou pasta equivalente ja usada
  pelo modulo.
- Para tabelas de carga, usar staging e promocao controlada.

## Criterio De Aceite

Antes de concluir, entregar:

- mapa dos arquivos criados/alterados;
- permissao usada;
- endpoints criados;
- tabelas/schemas usados;
- comando de build/teste executado;
- como publicar em producao;
- riscos ou pendencias.

Validacoes minimas:

```bash
python -m py_compile /opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect/rotas/rotas_de_<modulo>.py
systemctl status 7lm-connect-api.service
```

Se houver frontend:

```bash
cd /opt/7lm-connect/portal/05_modulos/<nome_modulo>
npm run build
```

## Proibido

- Criar runtime em `/root/data-engineering`.
- Criar servico systemd novo sem justificar por que API/timer existente nao
  resolve.
- Colocar secret em codigo ou documentacao.
- Reativar servicos antigos do Dashboard Comercial.
- Usar `node_modules`, `backups` ou bundle final como fonte oficial.
