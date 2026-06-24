# Hierarquia E Identidade - Comissionamento 2026-06

Data de referencia: 2026-06-15

## Resumo

O ciclo `2026-06` usa banco como fonte final. O Excel pode ter sido usado apenas
como carga pontual de valores, mas o runtime do portal deve ler sempre da API e
do Postgres.

Modelo correto:

```text
connect_comercial.dashboard_gc_produtividade_hierarquia
  -> snapshot mensal em comissionamento.hierarquia_snapshot
  -> enriquecimento por sevenlm_connect.funcionario_acesso / usuario
  -> comissionamento.resultados
  -> API /api/comissionamento/*
  -> frontend
```

## Fontes

- Hierarquia mensal: `connect_comercial.dashboard_gc_produtividade_hierarquia`.
- Identidade principal: `sevenlm_connect.funcionario_acesso`.
- Usuario/login/perfis: `sevenlm_connect.usuario`, `usuario_perfil`, `perfil`.
- Fonte auxiliar/catalogal: `sevenlm_connect.funcionario_equipe_vigencia`.

`funcionario_equipe_vigencia` nao e fonte direta do snapshot atual; deve ser
tratada como apoio ou evolucao futura ate o codigo passar a usa-la diretamente.

## Regra De Identidade

A resolucao produtiva deve priorizar:

1. `identificador_usuario`
2. `identificador_funcionario`
3. `documento`
4. `email`
5. nome normalizado apenas como ultimo recurso de conciliacao

Nome/apelido nao e chave produtiva.

## Regra De Lideranca

Entram no fluxo de gestores/coordenadores apenas pessoas com evidencia de
lideranca em cargo, perfil ou papel:

- gerente
- gestor
- coordenador
- head
- lider

Registros `Vago` ou sem identidade operacional nao devem virar comissionado
produtivo.

## Snapshot

O snapshot grava:

- ciclo;
- papel do comissionado;
- dados do lider/comissionado;
- dados da pessoa vinculada;
- origem do vinculo;
- origem JSON para rastreabilidade;
- UUIDs de usuario/funcionario quando encontrados.

A tela deve usar o snapshot para pessoas vinculadas. Nao deve criar fallback por
cidade, regiao ou mock visual.

## Ciclos

- `2026-06`: ciclo produtivo de Junho/2026.
- `2026-06-fluxo-manual`: massa manual de demonstracao e teste, copiando dados
  reais ja gravados no banco.

Outros ciclos historicos nao devem ser usados como fonte produtiva desta rodada.

## Validacao Esperada

Para cada ciclo:

- existem resultados em `comissionamento.resultados`;
- valores exibidos batem com `valor_bruto`, `desconto_distrato` e regras
  publicadas do banco;
- pessoas vinculadas aparecem somente quando existe
  `comissionamento.hierarquia_snapshot`;
- usuario, cargo, cidade/localidade e e-mail vem de `sevenlm_connect` quando
  disponiveis;
- `validacao_lideranca` informa por que a pessoa entrou no fluxo.
