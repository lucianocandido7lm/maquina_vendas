# 📊 Funil de Vendas — Especificação Funcional, Técnica e de Validação

**Produto:** Máquina de Vendas — Dashboard Comercial 7LM  
**Módulo:** Funil de Vendas  
**Versão:** 2.0 — consolidação de regras de negócio, Power BI de referência e requisitos de implementação  
**Data:** 23/06/2026  
**Status:** documento-base para implementação e validação

---

## 1. Finalidade

Este documento define, de forma completa, como o módulo **Funil de Vendas** deve ser construído dentro da Máquina de Vendas.

O objetivo é reproduzir a lógica do Power BI Comercial com rastreabilidade operacional. A implementação não pode simplificar o funil para uma contagem por situação atual, pois cada etapa possui:

- uma **chave de negócio** própria;
- uma **fonte de dados** específica;
- uma **data de movimentação** específica;
- um tipo de agregação próprio (`DISTINCTCOUNT` ou `COUNTROWS`);
- um detalhamento que precisa reconciliar com o número exibido no visual.

> **Regra central:** o Funil mede oportunidades e eventos que efetivamente se movimentaram dentro do período selecionado. Ele não representa o estoque atual de leads, reservas, propostas ou repasses.

---

## 2. Escopo do módulo

O módulo possui três abas internas:

```text
Funil de Vendas
├── Aba 1 — Funil Comercial
│   └── Visão geral, explicação das regras e conversões entre etapas
├── Aba 2 — Detalhamento Operacional
│   └── Drill-down da etapa, fato operacional e histórico da chave
└── Aba 3 — Consolidado de Metas
    ├── Parte esquerda: realizado e meta dinâmica no período trimestral
    └── Parte direita: realizado atual, projeção, gap e necessidade diária
```

### 2.1 O que está dentro do escopo

- Visual de funil com as nove etapas oficiais.
- Filtros comerciais globais.
- Detalhamento ao clicar em uma etapa do funil ou em uma linha de metas.
- Histórico de workflow e histórico de reserva/repasse para auditoria.
- Consolidado trimestral com meta em cascata.
- Consolidação mensal atual com dias úteis, tendência e necessidade diária.
- Ordenação das tabelas pelo cabeçalho.
- Persistência do contexto ao navegar entre abas.
- Validações para garantir que visual e detalhe fechem exatamente.

### 2.2 O que não deve ser feito

- Não criar uma regra alternativa baseada apenas em `lead_situacao` ou `reserva_situacao` atual.
- Não usar uma única data para todas as etapas.
- Não trocar `COUNTROWS(leads_workflow)` por contagem distinta “para evitar duplicidade”.
- Não criar colunas físicas ou tabelas paralelas sem necessidade; preferir CTEs, views lógicas, consultas do backend ou transformações na API.
- Não perder filtros, etapa, período ou meta ao abrir o detalhamento e voltar.
- Não considerar registros sem chave como se fossem registros válidos da etapa.

---

## 3. Princípios obrigatórios de implementação

### 3.1 Cada etapa mede uma movimentação diferente

Uma oportunidade pode passar por várias fases em datas diferentes. Por isso, a data usada no filtro varia por etapa.

Exemplo: uma reserva pode ter sido criada em janeiro e o contrato de repasse assinado em março. Ela deve aparecer:

- em **VENDAS** no recorte de janeiro;
- em **REPASSE** no recorte de março.

### 3.2 O número do visual deve reconciliar com o detalhe

Todo clique deve abrir exatamente as linhas que formaram o indicador clicado.

Exemplos de aceitação:

```text
Clique em VISITA = 572
→ o detalhe deve conter 572 idlead distintos após aplicar os mesmos filtros e data de visita.

Clique em PROPOSTA = 577
→ o detalhe deve conter 577 eventos de workflow em situação Proposta,
  pois a métrica usa COUNTROWS(leads_workflow), não DISTINCTCOUNT(idlead).

Clique em REPASSE = 45
→ o detalhe deve conter 45 idrepasse distintos cuja assinatura ocorreu no período.
```

### 3.3 Eventos de workflow não são oportunidades distintas

ATENDIMENTO, AGENDAMENTO e PROPOSTA são métricas de evento no histórico `leads_workflow`.

| Etapa | Unidade de medida | Agregação obrigatória |
|---|---|---|
| ATENDIMENTO | evento do workflow | `COUNTROWS(leads_workflow)` |
| AGENDAMENTO | evento do workflow | `COUNTROWS(leads_workflow)` |
| PROPOSTA | evento do workflow | `COUNTROWS(leads_workflow)` |

Para auditoria, esses eventos devem carregar `idlead` e, quando disponível, a ligação ao `idprecadastro`. Contudo, a quantidade do KPI continua sendo a quantidade de eventos, e não a quantidade distinta de pré-cadastros.

### 3.4 Filtros comerciais devem ser preservados

A limpeza de filtros dentro de medidas de meta deve remover apenas filtros de calendário necessários para evitar mistura de contextos mensal e trimestral.

Filtros comerciais permanecem válidos em todas as métricas:

```text
Cidade
Imobiliária
Empreendimento
SDR
Corretor
Agentes
Origem
Mídia
Situação
Restrição
SLA / classificação de SLA, quando aplicável ao detalhe
```

---

# 4. Estrutura de navegação e estado compartilhado

## 4.1 Navegação esperada

```text
Aba 1 — Funil Comercial
  └── clique em uma etapa
        └── Aba 2 — Detalhamento Operacional, já filtrada

Aba 3 — Consolidado de Metas
  └── clique em uma etapa/métrica
        └── Aba 2 — Detalhamento Operacional, já filtrada
```

## 4.2 Estado que deve sobreviver entre abas

Ao navegar, manter:

- filtros globais selecionados;
- etapa selecionada;
- tipo de métrica que originou o clique;
- período do clique;
- calendário de referência utilizado no clique;
- meta de REPASSE informada pelo usuário;
- seleção de trimestre da parte esquerda da Aba 3;
- seleção de mês/período atual da parte direita da Aba 3;
- ordenações e paginação da tabela, quando o usuário retornar à origem.

### 4.3 Parâmetros mínimos de drill-down

O estado de drill-down deve ser transmitido de forma explícita. Exemplo conceitual:

```json
{
  "etapa": "VISITA",
  "metricType": "qtd_funil",
  "dateContext": "historico",
  "dateStart": "2026-02-01",
  "dateEnd": "2026-02-28",
  "filters": {
    "cidade": ["AGL"],
    "empreendimento": ["AGL33"],
    "imobiliaria": [],
    "sdr": [],
    "corretor": []
  }
}
```

> O nome real da rota ou do payload pode acompanhar o padrão atual do projeto. A regra é que a API receba informação suficiente para reproduzir exatamente a mesma consulta do visual.

---

# 5. Modelo lógico de dados

## 5.1 Entidades lógicas necessárias

| Entidade lógica | Papel no módulo |
|---|---|
| `DimFunil` | dimensão fixa das nove etapas e sua ordem |
| `Funil_3` | camada/bridge de eventos de funil, datas e vínculo com `idlead` |
| `fato_leads_comercial` | fato comercial de lead, pré-cadastro, reserva e repasse |
| `leads_workflow` | histórico de transição de situações de leads |
| histórico de reservas | histórico operacional da reserva e seus status |
| `DCalendario` | calendário do funil histórico e do bloco trimestral |
| `DCalendario_Atual` | calendário do período atual, usado em dias úteis e tendência |
| `Filtro_Trimestre` | seletor desconectado de ano, trimestre e mês para o bloco esquerdo |

## 5.2 Fontes preferenciais na Máquina de Vendas

Na implementação dentro do módulo comercial, consumir a camada canônica já sincronizada. Não consultar Databricks diretamente no frontend.

Referências existentes no ecossistema comercial:

```text
connect_comercial.comercial_base
connect_comercial.comercial_kpi_daily
connect_comercial.dashboard_goals
sevenlm_connect.funcionario_acesso
```

Se o histórico de workflow ou de reservas ainda não estiver em uma dessas tabelas, o backend deve utilizar a fonte já sincronizada e normalizada no projeto, mantendo a mesma semântica do Power BI.

## 5.3 Mapeamento obrigatório de campos

Antes de iniciar o desenvolvimento, o agente deve mapear os nomes lógicos abaixo para os nomes reais das fontes da Máquina de Vendas.

| Campo lógico | Finalidade |
|---|---|
| `idlead` | chave do lead e do workflow |
| `idprecadastro` | chave de proposta/análise de crédito |
| `idreserva` | chave de reserva e venda |
| `idrepasse` | chave de contrato/repasse |
| `data_conversao` / `lead_data_ultima_conversao` | data de movimentação de LEAD |
| `data_visita_realizada` | data da visita efetivamente realizada |
| `data_resposta_analise` | data de conclusão da análise |
| `resultado_da_analise` | resultado da análise de crédito |
| `data_reserva` / `referencia_data_reserva` | data de início da reserva |
| `reserva_situacao` | status usado para VENDAS FINALIZADAS |
| `data_assinatura_de_contrato` | data de assinatura do contrato de repasse |
| `lead_situacao` | situação do evento de workflow |
| `data` / `referencia_data_lead` | data do evento do workflow |
| `situacao_anterior` | auditoria do workflow/histórico |
| `situacao_proxima` | auditoria do workflow/histórico |
| `tempo_horas` | tempo na situação para a auditoria |
| `cidade` | filtro e detalhe |
| `empreendimento` | filtro e detalhe |
| `imobiliaria` | filtro e detalhe |
| `sdr` | filtro e detalhe |
| `corretor` | filtro e detalhe |
| `agente` | filtro e detalhe |
| `origem` | filtro e detalhe |
| `midia` | filtro e detalhe |

### 5.4 Regra de equivalência de nomes

Há nomes diferentes entre fontes e telas para alguns campos. O agente deve mapear a origem real, sem alterar o significado de negócio.

| Conceito | Possíveis nomes |
|---|---|
| conversão de lead | `data_conversao`, `lead_data_ultima_conversao` |
| data da reserva | `data_reserva`, `referencia_data_reserva` |
| data de assinatura | `data_assinatura_de_contrato`, `dt_assinatura_contrato` |
| situação da reserva | `reserva_situacao`, `reserva_situacao_nome` |
| data do workflow | `data`, `referencia_data_lead` |

> A equivalência deve ser confirmada em consulta de validação. Nunca escolher o campo apenas pelo nome parecido.

---

# 6. Dimensão oficial do funil

A ordem abaixo é obrigatória e deve ser fixa. Não ordenar alfabeticamente.

| Ordem | Etapa | Chave de negócio | Unidade de medida | Fonte principal |
|---:|---|---|---|---|
| 1 | LEAD | `idlead` | oportunidade distinta | `fato_leads_comercial` |
| 2 | ATENDIMENTO | `idlead` | evento de workflow | `leads_workflow` |
| 3 | AGENDAMENTO | `idlead` | evento de workflow | `leads_workflow` |
| 4 | VISITA | `idlead` | oportunidade distinta | `fato_leads_comercial` |
| 5 | PROPOSTA | `idlead` no evento; `idprecadastro` como vínculo comercial quando existir | evento de workflow | `leads_workflow` |
| 6 | PROP. APROVADA / CONDICIONADA | `idprecadastro` | oportunidade distinta | `fato_leads_comercial` |
| 7 | VENDAS | `idreserva` | oportunidade distinta | `fato_leads_comercial` |
| 8 | VENDAS FINALIZADAS | `idreserva` | oportunidade distinta | `fato_leads_comercial` |
| 9 | REPASSE | `idrepasse` | oportunidade distinta | `fato_leads_comercial` |

## 6.1 Observação crítica sobre PROPOSTA

O material de negócio associa PROPOSTA ao processo de pré-cadastro. Entretanto, a medida oficial conta eventos em `leads_workflow` com `COUNTROWS`, e esse histórico é rastreado operacionalmente por `idlead`.

Logo:

- **métrica exibida:** quantidade de eventos de workflow com situação `Proposta`;
- **chave de auditoria do evento:** identificador único do workflow, ou `idlead` + data + situação quando não houver chave técnica;
- **vínculo comercial complementar:** `idprecadastro`, quando estiver disponível na base consolidada;
- **proibição:** não trocar a agregação por `DISTINCTCOUNT(idprecadastro)` sem uma nova regra formal aprovada.

---

# 7. Regras oficiais de cálculo por etapa

## 7.1 Matriz completa de cálculo

| Etapa | O que mede | Agregação | Data obrigatória | Regra de inclusão |
|---|---|---|---|---|
| LEAD | leads que voltaram/foram convertidos no sistema | `DISTINCTCOUNT(idlead)` | `data_conversao` | lead com data de conversão no período |
| ATENDIMENTO | entradas no atendimento | `COUNTROWS(leads_workflow)` | `leads_workflow[data]` | situação em `Atendimento - IA`, `Atendimento - SDR` |
| AGENDAMENTO | compromissos marcados | `COUNTROWS(leads_workflow)` | `leads_workflow[data]` | situação em `Agendado - IA`, `Agendamento`, `Agendamento - IA` |
| VISITA | visitas efetivamente realizadas | `DISTINCTCOUNT(idlead)` | `data_visita_realizada` | data de visita preenchida e dentro do período |
| PROPOSTA | entradas na situação proposta | `COUNTROWS(leads_workflow)` | `leads_workflow[data]` | situação igual a `Proposta` |
| PROP. APROVADA / CONDICIONADA | análises concluídas com resultado aprovado/condicionado | `DISTINCTCOUNT(idprecadastro)` | `data_resposta_analise` | resultado em `APROVADO`, `CONDICIONADO`, `CONDICIONADO PENDENTE` |
| VENDAS | reservas iniciadas | `DISTINCTCOUNT(idreserva)` | `data_reserva` | reserva iniciada, independente do status posterior |
| VENDAS FINALIZADAS | reservas finalizadas | `DISTINCTCOUNT(idreserva)` | `data_reserva` | `reserva_situacao = 'Venda finalizada'` |
| REPASSE | contratos assinados | `DISTINCTCOUNT(idrepasse)` | `data_assinatura_de_contrato` | assinatura dentro do período |

## 7.2 LEAD

**Regra de negócio:** contabilizar os leads que voltaram ao sistema, utilizando a data de conversão.

```text
Chave: idlead
Agregação: distinct count
Data: data_conversao / lead_data_ultima_conversao
```

**Não fazer:** contar todos os leads cadastrados no período como se fossem movimentações de LEAD do funil.

## 7.3 ATENDIMENTO

**Situações incluídas:**

```text
Atendimento - IA
Atendimento - SDR
```

```text
Fonte: leads_workflow
Agregação: count rows
Data: leads_workflow[data]
```

## 7.4 AGENDAMENTO

**Situações incluídas:**

```text
Agendado - IA
Agendamento
Agendamento - IA
```

```text
Fonte: leads_workflow
Agregação: count rows
Data: leads_workflow[data]
```

## 7.5 VISITA

**Regra de negócio:** somente visitas efetivamente realizadas.

```text
Chave: idlead
Agregação: distinct count
Data: data_visita_realizada
```

## 7.6 PROPOSTA

**Situação incluída:**

```text
Proposta
```

```text
Fonte: leads_workflow
Agregação: count rows
Data: leads_workflow[data]
```

## 7.7 PROP. APROVADA / CONDICIONADA

**Resultados incluídos:**

```text
APROVADO
CONDICIONADO
CONDICIONADO PENDENTE
```

```text
Chave: idprecadastro
Agregação: distinct count
Data: data_resposta_analise
```

## 7.8 VENDAS

**Regra de negócio:** contabilizar todas as reservas iniciadas, independentemente do status posterior.

```text
Chave: idreserva
Agregação: distinct count
Data: data_reserva / referencia_data_reserva
```

## 7.9 VENDAS FINALIZADAS

```text
Chave: idreserva
Agregação: distinct count
Data: data_reserva / referencia_data_reserva
Filtro adicional: reserva_situacao = 'Venda finalizada'
```

## 7.10 REPASSE

```text
Chave: idrepasse
Agregação: distinct count
Data: data_assinatura_de_contrato
```

A medida oficial também preserva o vínculo de `idlead` quando o contexto vem de `Funil_3`. Não remover esse vínculo sem validar a equivalência contra o Power BI.

---

# 8. Medidas de referência em DAX

> As medidas abaixo são a referência funcional do Power BI. Na Máquina de Vendas, a lógica pode ser implementada em SQL, Python, API ou frontend, desde que o resultado, filtros, granularidade e detalhe sejam equivalentes.

## 8.1 `03. Qtd Funil v2` — medida base do período selecionado

```dax
03. Qtd Funil v2 = 
VAR etapaSelecionada = SELECTEDVALUE(DimFunil[Etapa])
RETURN
SWITCH(
    etapaSelecionada,
    // LEAD
    "LEAD",
        CALCULATE(
            DISTINCTCOUNT(fato_leads_comercial[idlead]),
            TREATAS(VALUES(Funil_3[DataEtapa]), fato_leads_comercial[data_conversao])
        ),
    // ATENDIMENTO
    "ATENDIMENTO",
        CALCULATE(
            COUNTROWS(leads_workflow),
            leads_workflow[lead_situacao]
                IN { "Atendimento - IA", "Atendimento - SDR" },
            USERELATIONSHIP(
                DCalendario[Data],
                leads_workflow[data]
            )
        ),
    // AGENDAMENTO
    "AGENDAMENTO",
        CALCULATE(
            COUNTROWS(leads_workflow),
            leads_workflow[lead_situacao]
                IN {
                    "Agendado - IA",
                    "Agendamento",
                    "Agendamento - IA"
                },
            USERELATIONSHIP(
                DCalendario[Data],
                leads_workflow[data]
            )
        ),
    // VISITA
    "VISITA",
        CALCULATE(
            DISTINCTCOUNT(fato_leads_comercial[idlead]),
            TREATAS(VALUES(Funil_3[DataEtapa]), fato_leads_comercial[data_visita_realizada])
        ),
    // PROPOSTA
    "PROPOSTA",
        CALCULATE(
            COUNTROWS(leads_workflow),
            leads_workflow[lead_situacao]
                IN { "Proposta" },
            USERELATIONSHIP(
                DCalendario[Data],
                leads_workflow[data]
            )
        ),
    // PROP. APROVADA / CONDICIONADA
    "PROP. APROVADA / CONDICIONADA",
        CALCULATE(
            DISTINCTCOUNT(fato_leads_comercial[idprecadastro]),
            FILTER(
                fato_leads_comercial,
                fato_leads_comercial[resultado_da_analise]
                    IN { "APROVADO", "CONDICIONADO", "CONDICIONADO PENDENTE" }
            ),
            TREATAS(
                VALUES(Funil_3[DataEtapa]),
                fato_leads_comercial[data_resposta_analise]
            )
        ),
    // VENDAS
    "VENDAS",
        CALCULATE(
            DISTINCTCOUNT(fato_leads_comercial[idreserva]),
            TREATAS(VALUES(Funil_3[DataEtapa]), fato_leads_comercial[data_reserva])
        ),
    // VENDAS FINALIZADAS
    "VENDAS FINALIZADAS",
        CALCULATE(
            DISTINCTCOUNT(fato_leads_comercial[idreserva]),
            fato_leads_comercial[reserva_situacao] = "Venda finalizada",
            TREATAS(VALUES(Funil_3[DataEtapa]), fato_leads_comercial[data_reserva])
        ),
    // REPASSE
    "REPASSE",
        CALCULATE(
            DISTINCTCOUNT(fato_leads_comercial[idrepasse]),
            TREATAS(VALUES(Funil_3[idlead]), fato_leads_comercial[idlead]),
            TREATAS(
                VALUES(Funil_3[DataEtapa]),
                fato_leads_comercial[data_assinatura_de_contrato]
            )
        ),
    // Fallback
    CALCULATE(
        DISTINCTCOUNT(Funil_3[idlead]),
        FILTER(Funil_3, Funil_3[Etapa] = etapaSelecionada)
    )
)
```

## 8.2 `03. Qtd Funil v2 (TRI)` — realizado trimestral

```dax
03. Qtd Funil v2 (TRI) = 
VAR _ano = VALUES(Filtro_Trimestre[AnoNum])
VAR _tri = VALUES(Filtro_Trimestre[TrimestreNum])
VAR _mes = VALUES(Filtro_Trimestre[MesNomeAbrev])
RETURN
CALCULATE(
    [03. Qtd Funil v2],
    REMOVEFILTERS(DCalendario),
    TREATAS(_ano, DCalendario[AnoNum]),
    TREATAS(_tri, DCalendario[TrimestreNum]),
    TREATAS(_mes, DCalendario[MesNomeAbrev])
)
```

## 8.3 `Qtd Atual` — realizado do período atual

```dax
Qtd Atual = 
VAR etapa = SELECTEDVALUE(DimFunil[Etapa])
RETURN
SWITCH(
    etapa,
    "ATENDIMENTO",
        CALCULATE(
            COUNTROWS(leads_workflow),
            leads_workflow[lead_situacao]
                IN { "Atendimento - IA", "Atendimento - SDR" },
            USERELATIONSHIP(
                DCalendario_Atual[Data],
                leads_workflow[data]
            )
        ),
    "AGENDAMENTO",
        CALCULATE(
            COUNTROWS(leads_workflow),
            leads_workflow[lead_situacao]
                IN {
                    "Agendado - IA",
                    "Agendamento",
                    "Agendamento - IA"
                },
            USERELATIONSHIP(
                DCalendario_Atual[Data],
                leads_workflow[data]
            )
        ),
    "PROPOSTA",
        CALCULATE(
            COUNTROWS(leads_workflow),
            leads_workflow[lead_situacao]
                IN { "Proposta" },
            USERELATIONSHIP(
                DCalendario_Atual[Data],
                leads_workflow[data]
            )
        ),
    CALCULATE(
        [03. Qtd Funil v2],
        USERELATIONSHIP(
            DCalendario_Atual[Data],
            Funil_3[DataEtapa]
        )
    )
)
```

## 8.4 `% Conversão Atual`

```dax
% Conversão Atual = 
VAR vQtd = [Qtd Atual]
VAR vAnterior =
    CALCULATE(
        [Qtd Atual],
        OFFSET(
            -1,
            ALL(DimFunil[Etapa], DimFunil[Ordem]),
            ORDERBY(DimFunil[Ordem], ASC)
        )
    )
RETURN
IF(
    SELECTEDVALUE(DimFunil[Ordem]) <> 1,
    DIVIDE(vQtd, vAnterior)
)
```

**Comportamento obrigatório:** LEAD, por ser a primeira etapa, não apresenta conversão anterior.

## 8.5 `% Atingimento Meta`

```dax
% Atingimento Meta = 
DIVIDE(
    [Qtd Atual],
    [Meta Dinâmica (Tri)]
)
```

## 8.6 `Tendência (Atual)`

```dax
Tendência (Atual) = 
VAR realizados = [Qtd Atual]
VAR diasDecorridos = [Dias Úteis Decorridos (Atual)]
VAR diasMes = [Dias Úteis Mês (Atual)]
RETURN
IF(
    diasDecorridos > 0,
    DIVIDE(realizados, diasDecorridos) * diasMes
)
```

## 8.7 `% Tendência da Meta`

```dax
% tendencia = 
DIVIDE(
    [Tendência (Atual)],
    [Meta Dinâmica (Tri)]
)
```

## 8.8 `Gap Meta (Tri vs Mês)`

```dax
Gap Meta (Tri vs Mês) = 
[Meta Dinâmica (Tri)] - [Qtd Atual]
```

**Leitura do sinal:**

```text
Gap negativo → realizado acima da meta
Gap positivo → ainda faltam unidades para atingir a meta
Gap zero     → meta atingida exatamente
```

## 8.9 `Necessidade Diária`

```dax
Necessidade Diária = 
VAR gap = [Gap Meta (Tri vs Mês)]
VAR diasRestantes =
    [Dias Úteis Mês (Atual)] - [Dias Úteis Decorridos (Atual)]
RETURN
IF(
    diasRestantes > 0,
    DIVIDE(gap, diasRestantes),
    "🎯 Mes Finalizado"
)
```

## 8.10 `Dias Úteis Decorridos (Atual)`

```dax
Dias Úteis Decorridos (Atual) = 
CALCULATE(
    COUNTROWS(DCalendario_Atual),
    DCalendario_Atual[DiaUtilNome] = "Dia Útil",
    DCalendario_Atual[DataOffset] <= 0
)
```

## 8.11 `Meta Dinâmica (Tri)`

```dax
Meta Dinâmica (Tri) = 
VAR metaFinal = [Valor Meta Repasse]

VAR _ano = VALUES(Filtro_Trimestre[AnoNum])
VAR _tri = VALUES(Filtro_Trimestre[TrimestreNum])
VAR _mes = VALUES(Filtro_Trimestre[MesNomeAbrev])

VAR convTri =
    CALCULATE(
        [Conversão Até Repasse],
        REMOVEFILTERS(DCalendario_Atual),
        REMOVEFILTERS(DCalendario),
        TREATAS(_ano, DCalendario[AnoNum]),
        TREATAS(_tri, DCalendario[TrimestreNum]),
        TREATAS(_mes, DCalendario[MesNomeAbrev])
    )

RETURN
IF(
    SELECTEDVALUE(DimFunil[Etapa]) = "REPASSE",
    metaFinal,
    DIVIDE(metaFinal, convTri)
)
```

## 8.12 `SLA - Médio`

```dax
SLA - Médio = 
VAR _Etapa = SELECTEDVALUE(DimFunil[Etapa])
RETURN
SWITCH(
    TRUE(),
    _Etapa = "LEAD", BLANK(),
    _Etapa = "ATENDIMENTO", [SLA - LEAD -> ATENDIMENTO (Média Dias) (TRI)],
    _Etapa = "AGENDAMENTO", [SLA - ATENDIMENTO -> AGENDAMENTO (Média Dias) (TRI)],
    _Etapa = "VISITA", [SLA - AGENDAMENTO -> VISITA (Média Dias) (TRI)],
    _Etapa = "PROPOSTA", [SLA - VISITA -> PROPOSTA (Média Dias) (TRI)],
    _Etapa = "PROP. APROVADA / CONDICIONADA", [SLA - PROPOSTA -> PROP. APROVADA (Média Dias) (TRI)],
    _Etapa = "VENDAS", [SLA - PROP. APROVADA -> VENDAS (Média Dias) (TRI)],
    _Etapa = "VENDAS FINALIZADAS", [SLA - VENDAS -> VENDAS FINALIZADAS (Média Dias) (TRI)],
    _Etapa = "REPASSE", [SLA - VENDAS FINALIZADAS -> REPASSE (Média Dias) (TRI)]
)
```

---

# 9. Medidas auxiliares que precisam ser preservadas ou validadas

As fórmulas detalhadas abaixo não foram fornecidas integralmente no material. O agente **não deve inventar uma fórmula simplificada**. Deve localizar a medida já validada no Power BI ou na camada existente e reproduzir seu resultado.

| Medida | Contrato funcional |
|---|---|
| `[Valor Meta Repasse]` | valor de entrada da meta final de REPASSE; exemplo exibido: `45` |
| `[Conversão Até Repasse]` | taxa histórica utilizada para converter a meta de REPASSE em meta da etapa selecionada no recorte trimestral |
| `[Dias Úteis Mês (Atual)]` | total de dias classificados como úteis no período atual selecionado |
| medidas de SLA por transição | média em dias entre a ocorrência da etapa anterior e da etapa atual, respeitando a regra oficial já existente |
| percentual da prospecção no funil | razão entre a etapa atual e LEAD no mesmo contexto do funil |
| card `Leads Cadastrados` | indicador próprio do cabeçalho; não substituir automaticamente pela etapa LEAD |

## 9.1 Meta em cascata — interpretação obrigatória

A meta inserida pelo usuário é a meta final de **REPASSE**. As metas de etapas anteriores são obtidas a partir da conversão histórica até REPASSE, no período trimestral selecionado.

Exemplo conceitual:

```text
Meta REPASSE = 45

Meta de uma etapa anterior = Meta REPASSE / Conversão da etapa até REPASSE

Quanto menor a conversão até REPASSE,
maior precisa ser a quantidade necessária nas etapas do topo do funil.
```

> O cálculo é visualmente apresentado de baixo para cima: REPASSE é a entrada; as metas necessárias são propagadas para cima no funil. A fórmula exata deve continuar sendo `[Meta Dinâmica (Tri)]`.

---

# 10. Regras de calendário e filtros de período

## 10.1 Dois contextos de tempo independentes

O módulo possui dois contextos temporais. Eles não devem ser misturados.

| Contexto | Utilização | Calendário/Filtro |
|---|---|---|
| Histórico / trimestre | Aba 1 e parte esquerda da Aba 3 | `DCalendario` e `Filtro_Trimestre` |
| Período atual / mês | parte direita da Aba 3 | `DCalendario_Atual` |

## 10.2 Filtro trimestral

`Filtro_Trimestre` funciona como seletor desconectado e fornece:

```text
AnoNum
TrimestreNum
MesNomeAbrev
```

Ele é aplicado via `TREATAS` dentro das medidas. Não deve criar relacionamento físico que contamine indiscriminadamente outros visuais.

## 10.3 Período atual

`DCalendario_Atual` controla:

- Qtd Atual;
- dias úteis do mês;
- dias úteis decorridos;
- tendência;
- necessidade diária.

## 10.4 Dias úteis

O campo de referência é:

```text
DCalendario_Atual[DiaUtilNome] = "Dia Útil"
```

E o período decorrente considera:

```text
DCalendario_Atual[DataOffset] <= 0
```

A implementação precisa respeitar o calendário corporativo já validado, incluindo feriados caso estejam classificados nessa dimensão.

---

# 11. Aba 1 — Funil Comercial

## 11.1 Objetivo

Mostrar, de forma executiva, quantas oportunidades se movimentaram entre as etapas no período escolhido, com conversões entre fase anterior e topo do funil.

## 11.2 Layout de referência

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Filtros globais                                                           │
├─────────────────────────────┬─────────────────────────────────────────────┤
│ Explicação do funil         │ Cabeçalho e Funil                           │
│ - o que mede                │ - Data/Período                              │
│ - chaves por etapa          │ - Leads cadastrados                         │
│ - regras por etapa          │ - Funil com 9 etapas                        │
│                             │ - conversão anterior e da prospecção        │
└─────────────────────────────┴─────────────────────────────────────────────┘
```

## 11.3 Filtros globais esperados

No topo, exibir os filtros que existirem na fonte para o contexto comercial:

```text
Cidade
Imobiliária
Empreendimento
SDR
Situação
Corretor
Agentes
Origem
Mídia
```

A tela de detalhe poderá acrescentar filtros operacionais, como SLA, classificação SLA, restrição e `idlead`.

### Comportamento dos filtros

- multi-seleção quando o componente suportar;
- opção inicial `Todos`;
- busca em listas extensas;
- filtros devem afetar funil, conversões, detalhes e metas;
- não limpar o restante dos filtros quando um filtro é alterado;
- preservar as escolhas ao trocar de aba;
- carregar opções de filtro a partir do contexto permitido ao usuário.

## 11.4 Conteúdo explicativo fixo

Exibir texto de negócio equivalente a:

```text
Este visual apresenta quantas oportunidades realmente se movimentaram.

As situações reais de cada etapa são consideradas com sua data própria.
O identificador correto muda conforme a fase:
- idlead: lead, atendimento, agendamento e visita;
- idprecadastro: análise aprovada/condicionada;
- idreserva: vendas e vendas finalizadas;
- idrepasse: repasse.
```

A explicação deve deixar claro que a etapa PROPOSTA é contabilizada por eventos de workflow, conforme a medida oficial.

## 11.5 Visual de funil

Cada etapa deve mostrar:

| Elemento | Regra |
|---|---|
| Nome da etapa | valor de `DimFunil[Etapa]` |
| Quantidade | medida base do funil no período selecionado |
| Percentual do anterior | etapa atual ÷ etapa anterior; LEAD em branco |
| Percentual da prospecção | etapa atual ÷ LEAD no mesmo contexto |
| Taxa de conversão final | em REPASSE: REPASSE ÷ LEAD |

### Formatação

- quantidades: inteiro com separador de milhar;
- percentuais: preferencialmente 2 casas decimais;
- valores vazios: `—`;
- evitar abreviações como `3,4 mil` se o padrão do BI utiliza números completos;
- ordem visual obrigatória de LEAD até REPASSE;
- clique em qualquer etapa deve abrir o detalhe contextualizado.

## 11.6 Card `Leads Cadastrados`

O cabeçalho pode apresentar o card de Leads Cadastrados, conforme o layout de referência. Essa métrica deve ser mapeada para a medida já utilizada no Power BI.

> Não assumir que o card é igual à etapa LEAD. O funil usa conversão/movimentação; o card pode usar data de cadastro ou outra definição oficial.

---

# 12. Aba 2 — Detalhamento Operacional

## 12.1 Objetivo

Permitir auditoria da etapa clicada, exibindo:

1. a fato operacional que formou a quantidade do funil;
2. o histórico de movimentações da chave selecionada.

A tela não pode ser apenas uma tabela genérica de leads. Ela deve obedecer à mesma fonte, data, filtros e agregação que originaram o número clicado.

## 12.2 Estrutura visual

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Filtros do detalhe + botão voltar                                          │
├──────────────────────────────────────┬─────────────────────────────────────┤
│ CONSOLIDADO / FATO OPERACIONAL        │ HISTÓRICO                           │
│ tabela principal da etapa             │ workflow de lead                   │
│                                      │ histórico de reserva, quando houver│
└──────────────────────────────────────┴─────────────────────────────────────┘
```

## 12.3 Cabeçalho de contexto obrigatório

Acima das tabelas, exibir:

```text
Etapa selecionada
Período aplicado
Tipo de métrica: oportunidade distinta ou evento de workflow
Quantidade do visual de origem
Quantidade de linhas/itens reconciliados
Filtros globais ativos
```

Esse cabeçalho facilita validar rapidamente se o detalhe fechou com o funil.

## 12.4 Tabela principal — campos mínimos

A tabela principal deve conter os campos disponíveis e relevantes da fato comercial:

| Campo | Finalidade |
|---|---|
| `idlead` | identificação do lead |
| `lead_situacao` | situação atual ou de referência |
| `empreendimento` | contexto comercial |
| `cidade` | contexto comercial |
| `sdr` | responsável SDR |
| `imobiliaria` | canal/imobiliária |
| `corretor` | responsável comercial, quando disponível |
| `data_cadastro` | auditoria do lead |
| `data_conversao` | auditoria da etapa LEAD |
| `data_visita_realizada` | auditoria da etapa VISITA |
| `idprecadastro` | vínculo com proposta/análise |
| `resultado_da_analise` | auditoria da análise |
| `idreserva` | vínculo com venda/reserva |
| `reserva_situacao` | auditoria de venda finalizada |
| `idrepasse` | vínculo com repasse |
| `data_assinatura_de_contrato` | auditoria do repasse |
| `data_evento_utilizada` | data efetiva usada para o KPI clicado |
| `etapa_origem` | etapa que originou o detalhe |

Para eventos de workflow, incluir adicionalmente:

```text
workflow_event_id ou chave técnica do evento
lead_situacao
referencia_data_lead / data
situacao_anterior
situacao_proxima
tempo_horas
```

## 12.5 Regra de granularidade do detalhe

| Etapa | Granularidade do detalhe |
|---|---|
| LEAD | uma linha por `idlead` usado no distinct count |
| ATENDIMENTO | uma linha por evento de workflow elegível |
| AGENDAMENTO | uma linha por evento de workflow elegível |
| VISITA | uma linha por `idlead` usado no distinct count |
| PROPOSTA | uma linha por evento de workflow elegível |
| PROP. APROVADA / CONDICIONADA | uma linha por `idprecadastro` usado no distinct count |
| VENDAS | uma linha por `idreserva` usado no distinct count |
| VENDAS FINALIZADAS | uma linha por `idreserva` usado no distinct count |
| REPASSE | uma linha por `idrepasse` usado no distinct count |

> Para os indicadores com `DISTINCTCOUNT`, o backend deve deduplicar pela chave da etapa antes de paginar. Para eventos de workflow, não deduplicar o evento.

## 12.6 Histórico do lead/workflow

Exibir, quando existir `idlead`, uma tabela de histórico com:

| Campo | Descrição |
|---|---|
| `idlead` | chave do lead |
| `referencia_data_lead` | data/hora de referência do evento |
| `situacao` | situação registrada no evento |
| `situacao_anterior` | situação imediatamente anterior |
| `situacao_proxima` | situação seguinte quando existir |
| `tempo_horas` | tempo em horas na situação |

Ordenação padrão:

```text
referencia_data_lead DESC
```

Permitir ordenar por cabeçalho.

## 12.7 Histórico de reserva

Quando o item possuir `idreserva`, exibir também o histórico de reserva:

| Campo | Descrição |
|---|---|
| `idreserva` | chave da reserva |
| `referencia_data` | data/hora do evento |
| `situacao` | situação da reserva |
| `situacao_anterior` | situação anterior |
| `situacao_proxima` | próxima situação |
| `tempo_horas` | tempo em horas na situação |

Ordenação padrão:

```text
referencia_data DESC
```

## 12.8 Filtros específicos do detalhe

Além dos filtros globais, disponibilizar quando houver dados:

```text
SLA
SLA Classificação
Restrição
Idlead
Situação
Agentes
Mídia
Origem
```

Classificação de SLA exibida no layout de referência:

```text
Dentro do SLA
SLA Expirado
```

## 12.9 Paginação e ordenação

- tabelas devem permitir paginação real; não exibir “várias linhas” e bloquear a navegação;
- ordenação por cabeçalho deve usar a mesma granularidade da consulta;
- ordenação e página devem ser mantidas enquanto o usuário abre/fecha um histórico ou troca entre as abas;
- a API deve retornar `totalRows`, `page`, `pageSize` e `totalPages` corretos.

---

# 13. Aba 3 — Consolidado de Metas

## 13.1 Estrutura geral

A aba é dividida em dois blocos com contextos temporais independentes.

```text
┌─────────────────────────────┬─────────────────────────────────────────────┐
│ ESQUERDA                     │ DIREITA                                     │
│ Realizado trimestral         │ Acompanhamento do período atual             │
│ Meta em cascata              │ Qtd, conversão, gap, projeção e necessidade │
└─────────────────────────────┴─────────────────────────────────────────────┘
```

## 13.2 Parte esquerda — Realizado e Meta Dinâmica

### Objetivo

Apresentar o funil realizado no trimestre selecionado e a meta necessária em cada etapa, calculada a partir da meta de REPASSE e da conversão histórica.

### Período

```text
Filtro_Trimestre
- AnoNum
- TrimestreNum
- MesNomeAbrev
```

### Campos da tabela

| Coluna | Medida/Origem | Finalidade |
|---|---|---|
| Etapa | `DimFunil[Etapa]` | etapa do funil |
| Qtd Funil | `[03. Qtd Funil v2 (TRI)]` | realizado do trimestre |
| SLA - Médio | `[SLA - Médio]` | média de tempo entre a fase anterior e a atual |
| % Anterior | conversão da etapa versus etapa anterior no mesmo contexto | eficiência da transição |
| Meta | `[Meta Dinâmica (Tri)]` | meta necessária da etapa |

### Entrada da meta

O usuário informa a meta final para REPASSE por meio de um parâmetro/controle de entrada.

Exemplo:

```text
Meta de REPASSE = 45
```

### Regras de meta em cascata

```text
Meta REPASSE = valor informado
Meta das etapas anteriores = Meta REPASSE ÷ conversão histórica da etapa até REPASSE
```

A UI pode apresentar o cálculo como propagação de baixo para cima, mas o resultado de cada linha deve ser exatamente o da medida `[Meta Dinâmica (Tri)]`.

## 13.3 Parte direita — Acompanhamento do período atual

### Objetivo

Comparar o realizado do período atual com a meta dinâmica, projetar a tendência até o final do mês e calcular a necessidade diária.

### Indicadores de cabeçalho

| Indicador | Origem |
|---|---|
| Dias Úteis Mês (Atual) | `[Dias Úteis Mês (Atual)]` |
| Dias Úteis Decorridos (Atual) | `[Dias Úteis Decorridos (Atual)]` |

### Colunas da tabela

| Coluna | Medida | Leitura |
|---|---|---|
| Etapa | `DimFunil[Etapa]` | etapa do funil |
| Qtd Atual | `[Qtd Atual]` | realizado no período atual |
| % Conversão | `[% Conversão Atual]` | taxa vs etapa anterior |
| Gap Meta | `[Gap Meta (Tri vs Mês)]` | distância entre meta e realizado |
| % Realizado Meta | `[% Atingimento Meta]` | percentual atingido da meta |
| Tendência | `[Tendência (Atual)]` | projeção para fechamento do mês |
| % Tend. da Meta | `[% tendencia]` | tendência em relação à meta |
| Necessidade Diária | `[Necessidade Diária]` | quantidade média diária necessária |

## 13.4 Sinalização visual

A regra deve ser definida por condição explícita, nunca apenas pela cor exibida em uma captura de tela.

| Métrica | Condição positiva | Condição de atenção |
|---|---|---|
| Gap Meta | `gap <= 0` | `gap > 0` |
| % Realizado Meta | `>= 100%` | `< 100%` |
| % Tend. da Meta | `>= 100%` | `< 100%` |
| Necessidade Diária | `<= 0`, ou meta já atingida | `> 0` |

Sugestão visual:

```text
🟢 verde   → meta atendida / cenário favorável
🔴 vermelho → abaixo da meta / risco
🔶 laranja  → atenção, necessidade diária positiva ou ponto em monitoramento
```

> As capturas de referência apresentam alguns ícones cuja cor não parece refletir diretamente o valor exibido. Portanto, os limiares acima devem ser parametrizados e validados em homologação antes de congelar a formatação condicional.

---

# 14. Contrato técnico sugerido para API

Os nomes das rotas devem seguir o padrão do projeto. O contrato abaixo define o conteúdo mínimo que a API precisa sustentar.

## 14.1 Filtros

```text
GET /v1/dashboard/funil/filtros
```

Resposta conceitual:

```json
{
  "cidade": ["AGL", "FSA"],
  "imobiliaria": ["Equipe Própria", "Autônomos"],
  "empreendimento": ["AGL33", "AGL32"],
  "sdr": ["Lara IA"],
  "corretor": ["Nome do corretor"],
  "agentes": ["Nome do agente"],
  "origem": ["Canal Virtual"],
  "midia": ["Meta Ads"]
}
```

## 14.2 Funil da Aba 1

```text
GET /v1/dashboard/funil/overview
```

Parâmetros mínimos:

```text
startDate
endDate
cidade[]
imobiliaria[]
empreendimento[]
sdr[]
corretor[]
agentes[]
origem[]
midia[]
situacao[]
```

Resposta conceitual:

```json
{
  "period": { "startDate": "2026-02-01", "endDate": "2026-02-28" },
  "leadsCadastrados": 3429,
  "stages": [
    {
      "ordem": 1,
      "etapa": "LEAD",
      "quantidade": 3424,
      "percentualAnterior": null,
      "percentualProspeccao": 1.0,
      "metricNature": "distinct_opportunity"
    }
  ]
}
```

## 14.3 Detalhamento

```text
GET /v1/dashboard/funil/detalhes
```

Parâmetros mínimos:

```text
etapa
metricType
dateContext
startDate
endDate
filters
page
pageSize
sort
order
```

Resposta obrigatória:

```json
{
  "context": {
    "etapa": "PROPOSTA",
    "metricNature": "workflow_event",
    "visualValue": 577,
    "reconciledValue": 577
  },
  "rows": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalRows": 577,
    "totalPages": 29
  }
}
```

## 14.4 Históricos

```text
GET /v1/dashboard/funil/historico-lead?idlead=...
GET /v1/dashboard/funil/historico-reserva?idreserva=...
```

## 14.5 Consolidado de metas

```text
GET /v1/dashboard/funil/metas
```

Parâmetros mínimos:

```text
metaRepasse
anoTrimestre
trimestre
mesTrimestre
periodoAtual
filters
```

Resposta deve separar os blocos de contexto:

```json
{
  "trimestral": {
    "period": { "ano": 2025, "trimestre": 4, "mes": "Out" },
    "rows": []
  },
  "atual": {
    "period": { "ano": 2026, "mes": 2 },
    "diasUteisMes": 21,
    "diasUteisDecorridos": 21,
    "rows": []
  }
}
```

---

# 15. Regras de consulta e reconciliação

## 15.1 Padrão de consulta para métricas distintas

Para as etapas de oportunidade distinta, a consulta deve:

1. aplicar filtros comerciais;
2. aplicar o intervalo na data da etapa;
3. filtrar a condição específica da etapa, quando existir;
4. excluir chaves nulas;
5. deduplicar pela chave obrigatória;
6. somente depois paginar ou agregar.

Pseudológica:

```text
base filtrada
→ aplicar data da etapa
→ aplicar condição da etapa
→ where chave_da_etapa is not null
→ distinct chave_da_etapa
→ count ou retorno detalhado
```

## 15.2 Padrão de consulta para eventos de workflow

Para ATENDIMENTO, AGENDAMENTO e PROPOSTA:

1. aplicar filtros comerciais;
2. aplicar intervalo em `leads_workflow[data]`;
3. filtrar as situações elegíveis;
4. preservar cada evento elegível;
5. usar `COUNTROWS` para o indicador;
6. retornar uma linha por evento no detalhe.

Pseudológica:

```text
leads_workflow filtrado
→ aplicar data do workflow
→ filtrar situações permitidas
→ count rows
→ retornar eventos sem distinct por idlead
```

## 15.3 Evitar duplicidade por joins

Ao enriquecer a fato com dimensões ou históricos, o join não pode multiplicar a entidade usada no KPI.

Regras:

- para métricas distintas, consolidar/deduplicar antes de fazer joins um-para-muitos;
- para histórico, carregar em endpoint separado ou como expansão sob demanda;
- manter a chave da etapa no payload para auditoria;
- quando uma dimensão possuir mais de um registro possível, escolher o registro canônico antes da agregação.

---

# 16. Requisitos de interface e comportamento

## 16.1 Visual e identidade

- manter a identidade visual 7LM e logo no canto superior direito;
- barra superior de filtros;
- navegação lateral compatível com o módulo comercial;
- botão de retorno no detalhe;
- tabelas com cabeçalhos fixos quando necessário;
- rolagem horizontal para tabelas largas sem esconder colunas ou quebrar a paginação.

## 16.2 Formatação de números

| Tipo | Formato |
|---|---|
| Quantidade | inteiro com separador de milhar |
| Percentual | `0,00%` ou padrão já adotado no dashboard |
| SLA | dias, com uma casa decimal se necessário |
| Gap | inteiro com sinal preservado |
| Necessidade diária | número com até duas casas ou texto `🎯 Mes Finalizado` |
| Datas | `dd/MM/yyyy` |
| Data/hora de histórico | `dd/MM/yyyy HH:mm:ss` |

## 16.3 Tooltips

Incluir tooltip ou ícone de ajuda para:

- definição de cada etapa;
- significado do tipo de contagem;
- regra de meta dinâmica;
- cálculo de tendência;
- regra de necessidade diária;
- origem da data aplicada em cada etapa.

## 16.4 Estados de interface

- carregamento: skeleton ou indicador visual sem alterar o layout;
- sem dados: mostrar contexto de filtros e mensagem clara;
- erro de API: mensagem objetiva e ação de tentar novamente;
- dados parciais: não apresentar como valor definitivo; sinalizar que a fonte/histórico está incompleto.

---

# 17. Matriz de validação obrigatória

## 17.1 Validação de funil

Para um mesmo conjunto de filtros e período, comparar cada etapa entre:

```text
Power BI de referência
vs.
Máquina de Vendas
vs.
Detalhamento da etapa
```

| Etapa | Indicador | Teste de fechamento |
|---|---|---|
| LEAD | distinct `idlead` por conversão | visual = distinct do detalhe |
| ATENDIMENTO | eventos de workflow | visual = número de eventos do detalhe |
| AGENDAMENTO | eventos de workflow | visual = número de eventos do detalhe |
| VISITA | distinct `idlead` por visita realizada | visual = distinct do detalhe |
| PROPOSTA | eventos de workflow | visual = número de eventos do detalhe |
| PROP. APROVADA / CONDICIONADA | distinct `idprecadastro` | visual = distinct do detalhe |
| VENDAS | distinct `idreserva` | visual = distinct do detalhe |
| VENDAS FINALIZADAS | distinct `idreserva` com status finalizada | visual = distinct do detalhe |
| REPASSE | distinct `idrepasse` por assinatura | visual = distinct do detalhe |

## 17.2 Casos de teste mínimos

1. Sem filtros, em um mês completo.
2. Um empreendimento específico.
3. Uma imobiliária específica.
4. Um SDR específico.
5. Uma combinação de cidade + empreendimento + mídia.
6. Mês sem dias úteis restantes.
7. Etapa com denominador zero na conversão.
8. Etapa sem registros no período.
9. Registro com múltiplos eventos de workflow no mesmo dia.
10. Reserva criada em um período e repasse assinado em outro.
11. Registro sem `idprecadastro`, `idreserva` ou `idrepasse` para verificar que não contamina a etapa indevida.
12. Paginação acima de 20 linhas.
13. Ordenação crescente/decrescente em todas as colunas principais.
14. Drill-down a partir de uma linha da tabela de metas.
15. Retorno da Aba 2 para a Aba 1 ou Aba 3 preservando o estado.

## 17.3 Validação de metas

Para cada etapa:

```text
% Atingimento Meta = Qtd Atual / Meta Dinâmica
Gap Meta = Meta Dinâmica - Qtd Atual
Tendência = (Qtd Atual / dias úteis decorridos) × dias úteis do mês
% Tendência = Tendência / Meta Dinâmica
Necessidade Diária = Gap / dias úteis restantes
```

Verificar adicionalmente:

- a meta de REPASSE é exatamente o valor informado;
- as etapas anteriores usam a conversão histórica do trimestre selecionado;
- filtros comerciais continuam influenciando a conversão e a meta;
- `REMOVEFILTERS` não elimina cidade, empreendimento, imobiliária, SDR ou corretor;
- o calendário atual não contamina o cálculo trimestral e vice-versa.

---

# 18. Critérios de aceite

O módulo estará pronto para homologação quando todos os pontos abaixo forem verdadeiros.

- [ ] As nove etapas aparecem na ordem oficial.
- [ ] Cada etapa usa a data correta de movimentação.
- [ ] ATENDIMENTO, AGENDAMENTO e PROPOSTA usam contagem de eventos de workflow.
- [ ] As demais etapas usam a chave e o `DISTINCTCOUNT` definidos neste documento.
- [ ] O número do visual fecha com o detalhe de cada etapa.
- [ ] O detalhe apresenta a data efetivamente usada no cálculo.
- [ ] Histórico de lead e de reserva é carregado sem multiplicar o KPI.
- [ ] Os filtros globais funcionam em todas as abas.
- [ ] O filtro trimestral afeta apenas o bloco trimestral conforme regra.
- [ ] O período atual afeta a parte direita e os dias úteis.
- [ ] A meta final de REPASSE pode ser informada e persiste no contexto.
- [ ] Metas das demais etapas seguem `[Meta Dinâmica (Tri)]`.
- [ ] Gap, atingimento, tendência e necessidade diária fecham com a matemática de referência.
- [ ] Tabelas suportam ordenação, paginação e rolagem horizontal.
- [ ] A paginação apresenta o total real de registros e permite navegar entre páginas.
- [ ] Não foram criadas colunas físicas/tabelas paralelas sem necessidade.
- [ ] A implementação foi comparada com o Power BI em pelo menos três recortes representativos.

---

# 19. Pendências de confirmação antes de congelar a implementação

Estas pendências não autorizam o agente a alterar regras. Elas devem ser confirmadas na fonte existente ou no Power BI de referência.

| Tema | O que confirmar |
|---|---|
| Card Leads Cadastrados | qual medida e data oficial do card do cabeçalho |
| `data_conversao` x `lead_data_ultima_conversao` | qual campo canônico está sendo usado na fonte atual |
| `data_reserva` x `referencia_data_reserva` | equivalência e campo canônico da implementação |
| PROPOSTA | chave técnica do evento de workflow para garantir detalhe sem duplicação artificial |
| `[Conversão Até Repasse]` | DAX exato ou endpoint já existente que reproduza a taxa histórica oficial |
| medidas de SLA por transição | fórmulas e filtros já homologados no Power BI |
| regras de cor | limiares finais de formatação condicional, pois a captura pode não refletir o valor exibido |
| botão `Selecione` | função real no produto atual; não implementar comportamento sem mapear seu filtro/contexto |

---

# 20. Ordem recomendada de implementação

1. Mapear campos reais e fontes canônicas.
2. Implementar a dimensão fixa `DimFunil` e a ordem das etapas.
3. Construir e validar as consultas de cada uma das nove etapas isoladamente.
4. Implementar a Aba 1 e comparar o funil com Power BI.
5. Implementar o drill-down, garantindo reconciliação por etapa.
6. Integrar históricos de lead e reserva sem multiplicar a fato.
7. Implementar o bloco trimestral de metas.
8. Implementar o bloco atual de tendência e dias úteis.
9. Aplicar formatação, tooltips, ordenação e paginação.
10. Executar a matriz de validação e corrigir divergências antes de liberar para usuários.

---

# 21. Resumo executivo para o agente

```text
Não trate o Funil como estoque de situação atual.

Cada etapa tem sua própria chave, sua própria data e seu próprio tipo de contagem.

Workflow (Atendimento, Agendamento, Proposta) = contagem de eventos.
Demais etapas = contagem distinta da chave de negócio definida.

O detalhe precisa fechar exatamente com o número do visual.

Parte esquerda da aba de metas = realizado trimestral + meta dinâmica em cascata.
Parte direita = período atual + dias úteis + tendência + necessidade diária.

Não inventar medidas de SLA, Conversão Até Repasse ou Leads Cadastrados:
reutilizar e validar as regras oficiais já existentes no Power BI.
```
