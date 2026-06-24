# Fluxo De Aprovacao, NF E Financeiro

Este documento descreve o fluxo operacional confirmado para o MVP de
comissionamento.

## Fluxo Principal

```text
Sistema calcula/simula
  -> Secretaria de Vendas revisa
  -> Marcelo / Head Comercial aprova
  -> Se PJ/autonomo: Comissionado envia NF
  -> Se CLT: segue para pacote RH/Financeiro
  -> Secretaria valida NF
  -> Secretaria envia pacote de pagamento
  -> Pagamento
```

## Dono Do Fluxo

A Secretaria de Vendas e dona do negocio e do fluxo inteiro.

Responsabilidades:

- revisar calculos;
- editar metas e regras;
- aprovar etapa da Secretaria;
- acompanhar aprovacao do Marcelo;
- solicitar NF;
- validar NF;
- acompanhar pendencias;
- enviar ao Financeiro;
- acompanhar status.

## Aprovacao

No primeiro momento, Marcelo aprova todos os tipos de comissao do MVP.

Etapas:

1. `pendente_secretaria`
2. `aprovado_secretaria`
3. `pendente_marcelo`
4. `aprovado_marcelo`

Sem aprovacao do Marcelo, o fluxo nao deve seguir para NF nem para pacote de
pagamento.

## Nota Fiscal

Regra:

- PJ/autonomo exige NF antes do envio ao Financeiro.
- CLT nao exige NF e segue para RH e Financeiro.
- Prazo esperado de NF para PJ/autonomo: 1 a 2 dias.
- Se a NF nao chegar no prazo, o pagamento nao fica pronto para envio.

Status:

- `pendente_nf`
- `nf_recebida`
- `bloqueado_nf`

## Envio Ao Financeiro / RH

O Financeiro processa pagamentos na semana do dia 20.

O sistema deve concluir o fluxo interno uma semana antes da semana do dia 20,
com tempo para:

- revisao da Secretaria;
- aprovacao do Marcelo;
- coleta de NF;
- validacao da Secretaria;
- envio do pacote.

Regra simples da etapa:

- PJ/autonomo: Secretaria envia pacote ao Financeiro com NF validada.
- CLT: Secretaria envia resumo ao RH e Financeiro, sem NF.
- A etapa financeira nao precisa de tela complexa nesta fase; precisa apenas
  registrar data de envio, destinatarios, documento/pacote e historico.

Exemplo:

```text
Dia 20/06/2026 cai em sabado.
Prazo de envio ao Financeiro: 15/06/2026.
```

## Documento Complementar

A especificacao detalhada de esteira, auditoria, notificacoes, historico e
documentos fica em:

`esteira-auditoria-notificacoes.md`

## Pendencias Impeditivas

O sistema deve bloquear envio/pagamento quando:

- falta aprovacao da Secretaria;
- falta aprovacao do Marcelo;
- falta NF obrigatoria;
- NF esta rejeitada;
- comissao esta rejeitada;
- existe erro de calculo ou dado obrigatorio ausente.
