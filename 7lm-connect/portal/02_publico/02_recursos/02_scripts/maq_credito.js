(function () {
  "use strict";

  const root = document.querySelector("[data-maq-credito-root]");
  if (!root) return;

  const API_BASE = "/api/processos";
  const TOKEN_KEY = "sevenlm_connect_token_de_acesso";
  const USER_KEY = "sevenlm_connect_usuario";

  const tabs = [
    {
      id: "corretor",
      label: "Corretor",
      path: "/maq-credito/corretor",
      kicker: "Acompanhamento",
      title: "Painel do corretor",
      subtitle: "Lista de clientes do comercial, documentos enviados e evolução da carteira.",
      destino: "",
      icon: "user",
    },
    {
      id: "gestor",
      label: "Gestor",
      path: "/maq-credito/gestor/telemetria",
      kicker: "Telemetria",
      title: "Painel do gestor",
      subtitle: "Visão executiva de processos, produtividade, SLA e pontos de atenção.",
      destino: "",
      icon: "chart",
    },
  ];

  const caixaStatuses = [
    ["reserva", "Reserva"],
    ["em_analise_credito", "Em análise de crédito"],
    ["emitindo_formularios", "Emitindo formulários"],
    ["formularios_em_assinatura", "Formulários em assinatura"],
    ["formularios_assinados", "Formulários assinados"],
    ["envio_conformidade", "Envio à conformidade"],
  ];

  const agehabStatuses = [
    ["reserva", "Reserva"],
    ["em_analise_credito", "Em análise do crédito"],
    ["ficha_emitida", "Ficha emitida"],
    ["ficha_recebida", "Ficha recebida"],
    ["em_validacao_agehab", "Em validação Agehab"],
    ["agehab_validada", "Agehab validada"],
  ];

  const docStatuses = [
    ["Aguardando", "Aguardando"],
    ["Pendente Validacao Analista", "Aguardando validação do analista"],
    ["Aprovado", "Aprovado"],
    ["Rejeitado", "Rejeitado"],
    ["Pendente", "Pendente/reenvio"],
    ["Bloqueado", "Bloqueado"],
    ["Não se Aplica", "Não se aplica"],
  ];

  const documentCatalog = [
    ["documentos-do-proponente-identidade-e-cpf", "Identidade e CPF"],
    ["documentos-do-proponente-comp-de-estado-civil", "Estado civil"],
    ["documentos-do-proponente-comprovante-de-residencia", "Comprovante de residência"],
    ["documentos-do-proponente-irpf-recibo", "IRPF e recibo"],
    ["documentos-do-proponente-extrato-fgts", "Extrato FGTS"],
    ["documentos-do-proponente-ctps-carteira", "CTPS"],
    ["documentos-caixa-autorizacao-fgts", "Autorização de consulta do FGTS"],
    ["documentos-conjuge-identidade-e-cpf", "RG, CPF ou CNH do cônjuge"],
    ["documentos-conjuge-comprovante-renda", "Comprovante de renda do cônjuge"],
    ["documentos-dependente-certidao-nascimento", "Certidão de nascimento do dependente"],
    ["documentos-dependente-identidade-e-cpf", "RG e CPF do dependente"],
    ["documentos-dependente-certidao-civil", "Certidão civil do dependente"],
    ["documentos-dependente-declaracao-parentesco", "Declaração de parentesco"],
    ["documentos-dependente-conjuge-identidade-e-cpf", "RG, CPF ou CNH do cônjuge do dependente"],
    ["renda-formal", "Renda formal"],
    ["renda-informal", "Renda informal"],
    ["aposentados", "Aposentados"],
    ["domesticos", "Domésticos"],
    ["documentos-creditu-tela-score-cliente", "Creditú - Score do cliente"],
    ["documentos-creditu-tela-sicaq", "Creditú - Tela SICAQ"],
    ["documentos-creditu-tela-aprovacao-creditu", "Creditú - Aprovação simulador"],
    ["documentos-creditu-aprovacao-simulador", "Creditú - Aprovação simulador"],
    ["documentos-creditu-declaracao-endereco", "Declaração de endereço Creditú"],
    ["documentos-creditu-segundo-proponente-identidade-e-cpf", "Creditú - 2º participante - RG e CPF"],
    ["documentos-creditu-segundo-proponente-certidao-civil", "Certidão civil do segundo proponente"],
    ["documentos-creditu-segundo-proponente-comprovante-endereco", "Comprovante do segundo proponente"],
    ["documentos-creditu-contato-segundo-proponente", "Informações do fiador / 2º participante"],
    ["documentos-caixa-mo", "MO da Caixa"],
    ["documentos-caixa-ficha-de-cadastro-caixa", "Ficha de cadastro da Caixa"],
    ["documentos-caixa-abertura-de-conta", "Ficha de abertura de conta"],
    ["documentos-caixa-damp", "DAMP"],
    ["documentos-caixa-cheque-especial", "Ficha de cheque especial"],
    ["documentos-caixa-cartao-credito", "Ficha de cartão de crédito"],
    ["documentos-agehab-beneficiario", "RG e CPF do Beneficiário"],
    ["documentos-agehab-dependente", "Documento AGEHAB do dependente"],
    ["documentos-agehab-ficha-agehab", "Ficha AGEHAB"],
    ["documentos-agehab-rg-declarante", "RG do declarante AGEHAB"],
    ["documentos-agehab-cpf-declarante", "CPF do declarante AGEHAB"],
    ["documentos-agehab-declarante-identidade-e-cpf", "RG e CPF do Declarante"],
    ["documentos-agehab-certidao-estado-civil-beneficiario", "Certidão de Estado Civil"],
    ["documentos-agehab-termo-uniao-estavel", "Termo de União Estável"],
    ["documentos-agehab-declaracao-endereco", "Declaração de endereço AGEHAB"],
    ["documentos-agehab-comprovante-de-residencia", "Comprovante de Endereço"],
    ["documentos-agehab-vinculo-3-anos", "Vínculo superior a 3 anos"],
    ["documentos-agehab-comprovante-renda-beneficiario", "Comprovante de Renda"],
    ["documentos-agehab-declaracao-nao-renda", "Declaração de não renda AGEHAB"],
    ["documentos-agehab-declaracao-nao-renda-conjuge", "Renda ou declaração de não renda do cônjuge"],
    ["documentos-agehab-renda-ou-nao-renda-dependente", "Renda ou declaração de não renda do dependente"],
    ["documentos-agehab-renda-ou-nao-renda-conjuge-dependente", "Renda ou declaração de não renda do cônjuge do dependente"],
    ["documentos-agehab-observacao", "Observação AGEHAB"],
  ];

  const legacyDocumentCompatibility = {
    "documentos-caixa": {
      label: "Documentos da Caixa",
      sectionKey: "kits-legados",
      sectionLabel: "Uploads já existentes",
      sectionOrder: 890,
      helper: "Upload legado já enviado para o kit da Caixa. O analista pode validar este item normalmente.",
      kits: ["caixa", "dossie"],
    },
    "documentos-agehab": {
      label: "Documentos da AGEHAB",
      sectionKey: "kits-legados",
      sectionLabel: "Uploads já existentes",
      sectionOrder: 891,
      helper: "Upload legado já enviado para o kit da AGEHAB. O analista pode validar este item normalmente.",
      kits: ["agehab", "dossie"],
    },
    "documentos-creditu": {
      label: "Kit Creditú do cliente",
      sectionKey: "creditu-cliente",
      sectionLabel: "Cliente 7LM / Caixa",
      sectionOrder: 340,
      helper: "Reúna em 1 único arquivo e anexe no CV como KIT CREDITÚ: RG e CPF, endereço no nome do cliente ou declaração de endereço modelo Creditú, e certidão de estado civil.",
      kits: ["creditu", "dossie"],
    },
  };

  const kitProfiles = [
    {
      id: "caixa",
      label: "Kit Caixa",
      title: "Kit Caixa completo",
      description: "Reúne automaticamente todos os documentos exigidos para o kit da Caixa.",
      defaultKeys: [
        "documentos-do-proponente-identidade-e-cpf",
        "documentos-do-proponente-comp-de-estado-civil",
        "documentos-do-proponente-comprovante-de-residencia",
        "documentos-do-proponente-irpf-recibo",
        "documentos-do-proponente-extrato-fgts",
        "documentos-do-proponente-ctps-carteira",
        "documentos-caixa-autorizacao-fgts",
        "documentos-conjuge-identidade-e-cpf",
        "documentos-conjuge-comprovante-renda",
        "documentos-dependente-certidao-nascimento",
        "documentos-dependente-identidade-e-cpf",
        "documentos-dependente-certidao-civil",
        "documentos-dependente-declaracao-parentesco",
        "documentos-dependente-conjuge-identidade-e-cpf",
        "renda-formal",
        "renda-informal",
        "aposentados",
        "domesticos",
        "documentos-caixa-mo",
        "documentos-caixa-ficha-de-cadastro-caixa",
        "documentos-caixa-abertura-de-conta",
        "documentos-caixa-damp",
        "documentos-caixa-cheque-especial",
        "documentos-caixa-cartao-credito",
        "documentos-caixa",
      ],
    },
    {
      id: "creditu",
      label: "Kit Creditú",
      title: "Kit Creditú completo",
      description: "Consolida score, aprovação e dados obrigatórios do kit Creditú.",
      defaultKeys: [
        "documentos-creditu",
        "documentos-creditu-tela-score-cliente",
        "documentos-creditu-tela-sicaq",
        "documentos-creditu-aprovacao-simulador",
        "documentos-creditu-segundo-proponente-identidade-e-cpf",
        "documentos-creditu-contato-segundo-proponente",
      ],
    },
    {
      id: "agehab",
      label: "Kit AGEHAB",
      title: "Kit AGEHAB completo",
      description: "Monta o kit AGEHAB com todos os documentos sociais e formulários aplicáveis.",
      defaultKeys: [
        "documentos-agehab-beneficiario",
        "documentos-agehab-certidao-estado-civil-beneficiario",
        "documentos-agehab-termo-uniao-estavel",
        "documentos-agehab-comprovante-renda-beneficiario",
        "documentos-agehab-comprovante-de-residencia",
        "documentos-agehab-declaracao-endereco",
        "documentos-agehab-declarante-identidade-e-cpf",
        "documentos-dependente-identidade-e-cpf",
        "documentos-dependente-certidao-civil",
        "documentos-dependente-conjuge-identidade-e-cpf",
        "documentos-agehab-renda-ou-nao-renda-dependente",
        "documentos-agehab-renda-ou-nao-renda-conjuge-dependente",
        "documentos-agehab-vinculo-3-anos",
      ],
    },
    {
      id: "dossie",
      label: "Dossiê completo",
      title: "Dossiê completo do cliente",
      description: "Leva toda a trilha documental consolidada da jornada.",
      defaultKeys: documentCatalog.map(([key]) => key),
    },
    {
      id: "personalizado",
      label: "Personalizado",
      title: "Kit personalizado",
      description: "Monte um kit livre para qualquer banco, parceiro ou conformidade.",
      defaultKeys: [],
    },
  ];

  const dependentSpouseIdentityDetail = {
    label: "RG, CPF ou CNH do cônjuge do dependente",
    sectionKey: "dependentes",
    sectionLabel: "Dependentes e composição familiar",
    sectionOrder: 240,
    ruleLabel: "Dependente casado",
    helper: "Quando o dependente for casado, anexe RG, CPF ou CNH do cônjuge do dependente.",
  };

  const agehabKitDetail = (label, ruleLabel, helper) => ({
    label,
    sectionKey: "agehab",
    sectionLabel: "Documentação AGEHAB",
    sectionOrder: 360,
    ruleLabel,
    helper,
  });

  const workflowKitDocumentDetails = {
    caixa: {
      "documentos-dependente-conjuge-identidade-e-cpf": dependentSpouseIdentityDetail,
    },
    agehab: {
      "documentos-agehab-beneficiario": agehabKitDetail(
        "RG e CPF do Beneficiário",
        "Beneficiário",
        "Anexe RG e CPF ou documento oficial equivalente do beneficiário."
      ),
      "documentos-agehab-certidao-estado-civil-beneficiario": agehabKitDetail(
        "Certidão de Estado Civil",
        "Estado civil",
        "Anexe a certidão de nascimento, casamento, casamento averbado ou documento civil correspondente."
      ),
      "documentos-agehab-termo-uniao-estavel": agehabKitDetail(
        "Termo de União Estável (se houver)",
        "Se houver",
        "Anexe o termo quando o beneficiário informar união estável. Quando não houver, use Não se aplica."
      ),
      "documentos-agehab-comprovante-renda-beneficiario": agehabKitDetail(
        "Comprovante de Renda (Contracheque ou Declaração de Renda)",
        "Renda",
        "Anexe contracheque, comprovante formal ou declaração de renda do beneficiário."
      ),
      "documentos-agehab-comprovante-de-residencia": agehabKitDetail(
        "Comprovante de Endereço",
        "Endereço",
        "Anexe o comprovante de endereço aceito para o AGEHAB."
      ),
      "documentos-agehab-declaracao-endereco": agehabKitDetail(
        "Declaração de Endereço (se houver)",
        "Se houver",
        "Anexe a declaração quando o comprovante de endereço não estiver no nome do beneficiário. Quando não houver, use Não se aplica."
      ),
      "documentos-agehab-declarante-identidade-e-cpf": agehabKitDetail(
        "RG e CPF do Declarante (se houver Declaração de Endereço)",
        "Declarante",
        "Anexe RG e CPF do declarante quando houver declaração de endereço. Quando não houver declaração, use Não se aplica."
      ),
      "documentos-dependente-identidade-e-cpf": agehabKitDetail(
        "RG e CPF do Dependente (filhos maiores e dependentes até o 4º grau)",
        "Dependente",
        "Anexe RG e CPF dos filhos maiores e dependentes até o 4º grau."
      ),
      "documentos-dependente-certidao-civil": agehabKitDetail(
        "Certidão de Estado Civil do Dependente",
        "Dependente",
        "Anexe a certidão civil do dependente conforme o estado civil informado."
      ),
      "documentos-dependente-conjuge-identidade-e-cpf": {
        ...agehabKitDetail(
          "RG e CPF do Cônjuge do Dependente (se o dependente for casado)",
          "Dependente casado",
          "Anexe RG e CPF do cônjuge do dependente quando o dependente for casado. Quando não for casado, use Não se aplica."
        ),
      },
      "documentos-agehab-renda-ou-nao-renda-dependente": agehabKitDetail(
        "Comprovante de Renda ou Declaração de Não Renda do Dependente",
        "Renda do dependente",
        "Anexe o comprovante de renda do dependente. Se não possuir renda, anexe a declaração de não renda."
      ),
      "documentos-agehab-renda-ou-nao-renda-conjuge-dependente": agehabKitDetail(
        "Comprovante de Renda ou Declaração de Não Renda do Cônjuge do Dependente (se houver)",
        "Renda do cônjuge do dependente",
        "Anexe o comprovante de renda do cônjuge do dependente. Se não possuir renda, anexe a declaração de não renda. Quando não houver cônjuge, use Não se aplica."
      ),
      "documentos-agehab-vinculo-3-anos": agehabKitDetail(
        "Documento que comprove vínculo superior a 3 anos na cidade contemplada pelo Programa Cheque Moradia",
        "Vínculo municipal",
        "Anexe documento que comprove vínculo superior a 3 anos na cidade contemplada pelo Programa Cheque Moradia."
      ),
    },
    dossie: {
      "documentos-dependente-conjuge-identidade-e-cpf": dependentSpouseIdentityDetail,
    },
    creditu: {
      "documentos-creditu": {
        label: "Kit Creditú do cliente",
        sectionKey: "creditu-cliente",
        sectionLabel: "Cliente 7LM / Caixa",
        sectionOrder: 340,
        ruleLabel: "Arquivo único",
        helper: "Reúna em 1 único arquivo e anexe no CV como KIT CREDITÚ: RG e CPF, endereço no nome do cliente ou declaração de endereço modelo Creditú, e certidão de estado civil.",
      },
      "documentos-creditu-tela-score-cliente": {
        label: "Creditú - Score do cliente",
        sectionKey: "creditu-cliente",
        sectionLabel: "Cliente 7LM / Caixa",
        sectionOrder: 340,
        ruleLabel: "Score",
        helper: "Anexe a tela de consulta SERASA, SPC ou Liquid como Creditú - Score. Regra de enquadramento: até 30 anos, mínimo 401; acima de 30 anos, mínimo 451.",
      },
      "documentos-creditu-aprovacao-simulador": {
        label: "Creditú - Aprovação simulador",
        sectionKey: "creditu-cliente",
        sectionLabel: "Cliente 7LM / Caixa",
        sectionOrder: 340,
        ruleLabel: "Simulador Creditú",
        helper: "Documento gerado pelo simulador da Creditú. Anexe no CV como Creditú - Aprovação Simulador usando exatamente a renda e a parcela/prestação da aprovação Caixa.",
      },
      "documentos-creditu-tela-aprovacao-creditu": {
        label: "Creditú - Aprovação simulador",
        sectionKey: "creditu-cliente",
        sectionLabel: "Cliente 7LM / Caixa",
        sectionOrder: 340,
        ruleLabel: "Simulador Creditú",
        helper: "Documento gerado pelo simulador da Creditú. Anexe no CV como Creditú - Aprovação Simulador usando exatamente a renda e a parcela/prestação da aprovação Caixa.",
      },
      "documentos-creditu-tela-sicaq": {
        label: "Creditú - Tela SICAQ",
        sectionKey: "creditu-cliente",
        sectionLabel: "Cliente 7LM / Caixa",
        sectionOrder: 340,
        ruleLabel: "Tela aprovação Caixa",
        helper: "Documento gerado pelo CCA no sistema da Caixa. Anexe no CV como Creditú - Tela SICAQ. Na tela devem aparecer prestação e renda.",
      },
      "documentos-creditu-segundo-proponente-identidade-e-cpf": {
        label: "Creditú - 2º participante - RG e CPF",
        sectionKey: "creditu-fiador",
        sectionLabel: "Fiador / 2º participante",
        sectionOrder: 360,
        ruleLabel: "Fora do processo Caixa",
        helper: "Fiador ou 2º participante não está no processo Caixa. 1ª opção: anexar separado como Creditú - 2º Proponente - RG e CPF. 2ª opção: anexar junto aos documentos do cliente no Kit Creditú.",
      },
      "documentos-creditu-contato-segundo-proponente": {
        label: "Informações do fiador / 2º participante",
        sectionKey: "creditu-fiador",
        sectionLabel: "Fiador / 2º participante",
        sectionOrder: 360,
        ruleLabel: "Mensagens / associado",
        inputType: "message",
        messageTitle: "Kit Creditú - Informações do fiador / 2º participante",
        messagePlaceholder: "Informe endereço completo, estado civil, e-mail, telefone e, se for casado, os dados do cônjuge.",
        messageFields: [
          { name: "nome", label: "Nome completo", type: "text", placeholder: "Nome do fiador ou 2º participante" },
          { name: "cpf", label: "CPF", type: "text", placeholder: "CPF do fiador ou 2º participante" },
          {
            name: "estado_civil",
            label: "Estado civil",
            type: "select",
            options: [
              ["", "Selecione"],
              ["Solteiro(a)", "Solteiro(a)"],
              ["Casado(a)", "Casado(a)"],
              ["União estável", "União estável"],
              ["Divorciado(a)", "Divorciado(a)"],
              ["Viúvo(a)", "Viúvo(a)"],
            ],
          },
          {
            name: "vinculo",
            label: "Vínculo",
            type: "select",
            options: [
              ["", "Selecione"],
              ["Fiador", "Fiador"],
              ["2º participante", "2º participante"],
              ["Associado", "Associado"],
            ],
          },
          { name: "endereco", label: "Endereço completo", type: "textarea", placeholder: "Rua, número, complemento, bairro, cidade e UF" },
          { name: "email", label: "E-mail", type: "email", placeholder: "email@exemplo.com" },
          { name: "telefone", label: "Telefone", type: "tel", placeholder: "(00) 00000-0000" },
          { name: "conjuge_nome", label: "Nome do cônjuge", type: "text", placeholder: "Preencher se for casado(a)" },
          { name: "conjuge_cpf", label: "CPF do cônjuge", type: "text", placeholder: "Preencher se for casado(a)" },
          { name: "observacoes", label: "Observações", type: "textarea", placeholder: "Informações complementares para cadastro como associado" },
        ],
        helper: "Inserir nas mensagens e cadastrar como associado: endereço completo, estado civil; se for casado, colocar o cônjuge junto; e-mail e telefone.",
      },
    },
  };

  function defaultColumnFilters() {
    return {
      cliente: "",
      owners: [],
      statuses: [],
    };
  }

  function defaultColumnFilterSearch() {
    return {
      owner: "",
      status: "",
    };
  }

  const state = {
    activeTab: tabFromPath(window.location.pathname),
    processos: [],
    diagnosticos: [],
    uploads: [],
    messages: [],
    selectedReserva: selectedReservaFromUrl(),
    selectedOwner: "",
    checklistOrigin: checklistOriginFromUrl(),
    clientJourneyView: clientJourneyViewFromUrl(),
    filterText: "",
    filterStatus: "",
    columnFilters: defaultColumnFilters(),
    columnFilterOpen: "",
    columnFilterSearch: defaultColumnFilterSearch(),
    kitProfile: "caixa",
    kitSelections: {},
    kitCustomName: "Kit personalizado",
    kitReserva: "",
    loading: false,
  };

  const workflowKitProfileIds = ["caixa", "agehab", "creditu"];
  const programKitProfiles = new Set(workflowKitProfileIds);
  const relationshipInterviewTitle = "Entrevista & Relacionamento";
  const relationshipYesNoOptions = [
    ["", "Selecione"],
    ["Sim", "Sim"],
    ["Não", "Não"],
    ["Não se aplica", "Não se aplica"],
  ];
  const relationshipInterviewFields = [
    {
      name: "portabilidade_conta_salario",
      label: "Ciente da portabilidade de conta salário",
      helper: "Necessário para garantir o pagamento com mais segurança e menos risco de atraso.",
      type: "select",
      options: relationshipYesNoOptions,
    },
    {
      name: "open_finance",
      label: "Ciente para fazer Open Finance",
      helper: "O cliente autoriza o compartilhamento de dados bancários para uma análise de crédito mais rápida e precisa.",
      type: "select",
      options: relationshipYesNoOptions,
    },
    {
      name: "portabilidade_pix_cpf",
      label: "Ciente da portabilidade da chave Pix para CPF",
      helper: "Melhora o relacionamento e aumenta a segurança do cliente nas transações de Pix.",
      type: "select",
      options: relationshipYesNoOptions,
    },
    {
      name: "fgts_futuro",
      label: "FGTS e FGTS Futuro",
      helper: "Validar oportunidades de utilização destes recursos.",
      type: "select",
      options: relationshipYesNoOptions,
    },
    {
      name: "melhor_data_vencimento",
      label: "Melhor data para vencimento da parcela",
      helper: "Ajuda a conseguir mais prazo para a primeira parcela e adequar o vencimento à realidade do cliente.",
      type: "number",
      placeholder: "Dia 1 a 31",
      min: "1",
      max: "31",
    },
    {
      name: "dia_recebimento_pagamento",
      label: "Dia em que o cliente costuma receber pagamento",
      helper: "Entender se o cliente recebe em uma data fixa ou no 5º dia útil de cada mês.",
      type: "text",
      placeholder: "Ex.: dia 5, 5º dia útil",
    },
    {
      name: "data_prevista_assinatura",
      label: "Data prevista para assinar",
      helper: "Previsão da melhor data para assinatura da minuta, respeitando o vencimento da TEO.",
      type: "date",
    },
    {
      name: "ciente_produto",
      label: "Ciente do produto",
      helper: "Certificar que o cliente já pagou ou terá o dinheiro disponível para relacionamento com o banco.",
      type: "select",
      options: relationshipYesNoOptions,
    },
    {
      name: "ajuda_despesas_cliente",
      label: "Alguém ajudará com as despesas do cliente",
      helper: "Em casos de renda frágil, informar a pessoa que ajudará no pagamento do financiamento.",
      type: "select",
      options: relationshipYesNoOptions,
    },
    {
      name: "apoio_comprometimento_renda",
      label: "Ciente do comprometimento de renda e apoio financeiro",
      helper: "Se o cliente está financiando com ajuda nas parcelas, pontuar que ele não está sozinho nesta caminhada.",
      type: "select",
      options: relationshipYesNoOptions,
    },
    {
      name: "deposito_minimo_primeira_parcela",
      label: "Ciente do depósito mínimo para primeira parcela da evolução de obra",
      helper: "Garantir que o cliente tenha saldo reservado na conta para o débito das parcelas.",
      type: "select",
      options: relationshipYesNoOptions,
    },
  ];

  const els = {
    tabs: root.querySelector("[data-tabs]"),
    state: root.querySelector("[data-state]"),
    activeKicker: root.querySelector("[data-active-kicker]"),
    activeTitle: root.querySelector("[data-active-title]"),
    kpis: root.querySelector("[data-kpis]"),
    content: root.querySelector("[data-tab-content]"),
    detail: root.querySelector("[data-detail-panel]"),
    filterForm: root.querySelector("[data-filter-form]"),
    search: root.querySelector("[data-filter-search]"),
    status: root.querySelector("[data-filter-status]"),
    user: document.getElementById("maqCreditoUsuario"),
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function token() {
    try {
      return window.sessionStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function storedUser() {
    try {
      return JSON.parse(window.sessionStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  }

  function headers(extra = {}) {
    const auth = token();
    return {
      Accept: "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...extra,
    };
  }

  async function apiJson(url, options = {}) {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      ...options,
      headers: {
        ...headers(options.headers || {}),
      },
    });
    if (!response.ok) {
      let message = `Falha HTTP ${response.status}`;
      try {
        const payload = await response.json();
        message = payload.detail || payload.message || message;
      } catch {}
      throw new Error(message);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function apiBlob(url, options = {}) {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      ...options,
      headers: {
        ...headers(options.headers || {}),
      },
    });
    if (!response.ok) {
      let message = `Falha HTTP ${response.status}`;
      try {
        const payload = await response.json();
        message = payload.detail || payload.message || message;
      } catch {}
      throw new Error(message);
    }
    return response;
  }

  function icon(name) {
    const icons = {
      user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>',
      file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"></path><path d="M14 2v5h5"></path><path d="M9 14h6"></path><path d="M9 18h4"></path></svg>',
      search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>',
      check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
      chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5"></path><path d="M4 19h16"></path><path d="M8 16v-5"></path><path d="M12 16V8"></path><path d="M16 16v-9"></path></svg>',
    };
    return icons[name] || icons.file;
  }

  function tabFromPath(pathname) {
    const path = String(pathname || "").toLowerCase();
    if (path.includes("/gestor")) return "gestor";
    return "corretor";
  }

  function selectedReservaFromUrl() {
    try {
      return new URLSearchParams(window.location.search).get("cliente") || "";
    } catch {
      return "";
    }
  }

  function normalizeChecklistOrigin(value) {
    const origin = String(value || "").toLowerCase();
    return ["corretor", "analista", "cca", "gestor"].includes(origin) ? origin : "";
  }

  function normalizeClientJourneyView(value) {
    const view = String(value || "").toLowerCase();
    return ["documentos", "venda", "relacionamento"].includes(view) ? view : "documentos";
  }

  function checklistOriginFromUrl() {
    try {
      return normalizeChecklistOrigin(new URLSearchParams(window.location.search).get("etapa") || "");
    } catch {
      return "";
    }
  }

  function clientJourneyViewFromUrl() {
    try {
      return normalizeClientJourneyView(new URLSearchParams(window.location.search).get("visao") || "");
    } catch {
      return "documentos";
    }
  }

  function clientJourneyViewMeta(view = state.clientJourneyView) {
    const current = normalizeClientJourneyView(view);
    if (current === "venda") {
      return {
        kicker: "Venda completa",
        title: "Simulação e venda completa",
        label: "Venda completa",
      };
    }
    if (current === "relacionamento") {
      return {
        kicker: "Relacionamento",
        title: "Entrevista e relacionamento",
        label: "Relacionamento",
      };
    }
    return {
      kicker: "Fluxo do cliente",
      title: "Envio e controle de documentos",
      label: "Documentação",
    };
  }

  function activeTab() {
    return tabs.find((tab) => tab.id === state.activeTab) || tabs[0];
  }

  function setStatus(message, type = "info") {
    if (!els.state) return;
    if (!message) {
      els.state.hidden = true;
      els.state.textContent = "";
      els.state.classList.remove("is-error");
      return;
    }
    els.state.hidden = false;
    els.state.textContent = message;
    els.state.classList.toggle("is-error", type === "error");
  }

  function labelFor(options, value) {
    const row = options.find(([key]) => key === value);
    return row ? row[1] : value || "-";
  }

  function roleLabel(value) {
    const labels = {
      todos: "Todos",
      corretor: "Corretor",
      analista: "Analista de crédito",
      cca: "Correspondente",
      gestor: "Gestor",
      relacionamento: "Relacionamento",
    };
    const key = String(value || "todos").toLowerCase();
    return labels[key] || value || "Todos";
  }

  function formatElapsed(seconds) {
    const value = Number(seconds || 0);
    if (!value) return "0h";
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
  }

  function isFinalizado(processo) {
    return processo?.caixa === "envio_conformidade" || processo?.agehab === "agehab_validada";
  }

  function pendingEntries(processo) {
    return Object.entries(processo?.pendencias || processo?.["pend\u00eancias"] || {}).filter(([, item]) => item && (item.descricao || item.prazo));
  }

  function hasPending(processo) {
    return pendingEntries(processo).length > 0;
  }

  function hasUploads(processo) {
    return Boolean(processo?.temDocumentoEnviado || Object.keys(processo?.uploadsEnviados || {}).length);
  }

  function isUrgent(item) {
    if (!item?.prazo) return false;
    const due = new Date(item.prazo).getTime();
    if (Number.isNaN(due)) return false;
    return due - Date.now() <= 24 * 60 * 60 * 1000;
  }

  function metrics(list = state.processos) {
    const total = list.length;
    const pendentes = list.filter(hasPending).length;
    const urgentes = list.reduce((acc, processo) => acc + pendingEntries(processo).filter(([, item]) => isUrgent(item)).length, 0);
    const documentos = list.filter(hasUploads).length;
    const finalizados = list.filter(isFinalizado).length;
    const slaSeconds = list.map((item) => Number(item?.sla?.elapsed_seconds || 0)).filter(Boolean);
    const avgSla = slaSeconds.length ? slaSeconds.reduce((a, b) => a + b, 0) / slaSeconds.length : 0;
    const retrabalho = state.diagnosticos.reduce((acc, item) => acc + Number(item.Qtd_Retrabalho || 0), 0);
    return { total, pendentes, urgentes, documentos, finalizados, avgSla, retrabalho };
  }

  function processOwnerFilterTokens(processo) {
    const tokens = [];
    const corretor = String(processo?.corretor || "").trim();
    const correspondente = String(processo?.cca_vinculado || "").trim();
    if (corretor) {
      tokens.push({
        value: `corretor:${normalizeStatusText(corretor)}`,
        label: `Corretor: ${corretor}`,
      });
    }
    if (correspondente) {
      tokens.push({
        value: `cca:${normalizeStatusText(correspondente)}`,
        label: `Correspondente: ${correspondente}`,
      });
    }
    return tokens;
  }

  function processStatusFilterTokens(processo, overview = checklistOverview(processo)) {
    const tokens = [
      { value: `etapa:${normalizeStatusText(overview.etapaAtual)}`, label: overview.etapaAtual, order: 0 },
    ];
    if (hasPending(processo)) {
      tokens.push({ value: "flag:pendencia", label: "Com pendência", order: 1 });
    }
    if (isFinalizado(processo)) {
      tokens.push({ value: "flag:finalizado", label: "Finalizado", order: 3 });
    }
    return tokens;
  }

  function columnFilterOptions(key) {
    const map = new Map();
    state.processos.forEach((processo) => {
      const overview = checklistOverview(processo);
      const entries = key === "owner"
        ? processOwnerFilterTokens(processo)
        : processStatusFilterTokens(processo, overview);
      entries.forEach((entry) => {
        if (!entry?.value || map.has(entry.value)) return;
        map.set(entry.value, entry);
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      const orderDiff = Number(a.order ?? 99) - Number(b.order ?? 99);
      if (orderDiff) return orderDiff;
      return String(a.label || "").localeCompare(String(b.label || ""), "pt-BR");
    });
  }

  function columnFilterButtonLabel(values, options, fallback = "Todos") {
    if (!Array.isArray(values) || !values.length) return fallback;
    if (values.length === 1) {
      return options.find((item) => item.value === values[0])?.label || "1 selecionado";
    }
    return `${values.length} selecionados`;
  }

  function visibleColumnFilterOptions(key, options) {
    const query = normalizeStatusText(state.columnFilterSearch[key] || "");
    if (!query) return options;
    return options.filter((item) => normalizeStatusText(item.label || "").includes(query));
  }

  function renderColumnTextFilter(label, key, placeholder) {
    return `
      <th>
        <div class="tl-mc-th-filter">
          <span class="tl-mc-th-filter__label">${escapeHtml(label)}</span>
          <input
            class="tl-mc-th-filter__input"
            type="search"
            value="${escapeHtml(state.columnFilters[key] || "")}"
            placeholder="${escapeHtml(placeholder)}"
            data-column-text-filter="${escapeHtml(key)}"
          />
        </div>
      </th>
    `;
  }

  function renderColumnMultiFilter(label, key, fallback) {
    const options = columnFilterOptions(key);
    const visibleOptions = visibleColumnFilterOptions(key, options);
    const values = key === "owner" ? state.columnFilters.owners : state.columnFilters.statuses;
    const searchKey = key === "owner" ? "owner" : "status";
    const isOpen = state.columnFilterOpen === key;
    const buttonLabel = columnFilterButtonLabel(values, options, fallback);
    return `
      <th>
        <div class="tl-mc-th-filter">
          <span class="tl-mc-th-filter__label">${escapeHtml(label)}</span>
          <div class="tl-mc-column-filter ${isOpen ? "is-open" : ""}" data-column-filter="${escapeHtml(key)}">
            <button class="tl-mc-column-filter__toggle" type="button" data-column-filter-toggle="${escapeHtml(key)}">
              <span>${escapeHtml(buttonLabel)}</span>
              <strong>${values.length ? escapeHtml(String(values.length)) : ""}</strong>
            </button>
            <div class="tl-mc-column-filter__menu">
              <div class="tl-mc-column-filter__search">
                <input
                  class="tl-mc-column-filter__search-input"
                  type="search"
                  value="${escapeHtml(state.columnFilterSearch[searchKey] || "")}"
                  placeholder="Buscar e marcar opções"
                  data-column-filter-search-input="${escapeHtml(searchKey)}"
                />
              </div>
              <div class="tl-mc-column-filter__actions">
                <button type="button" data-column-filter-clear="${escapeHtml(key)}">Limpar seleção</button>
              </div>
              <div class="tl-mc-column-filter__list">
                <label class="tl-mc-column-filter__option ${!values.length ? "is-selected" : ""}">
                  <input type="checkbox" data-column-filter-all="${escapeHtml(key)}" ${!values.length ? "checked" : ""} />
                  <span>Todos</span>
                </label>
                ${visibleOptions.length ? visibleOptions.map((option) => `
                  <label class="tl-mc-column-filter__option ${values.includes(option.value) ? "is-selected" : ""}">
                    <input
                      type="checkbox"
                      value="${escapeHtml(option.value)}"
                      data-column-filter-checkbox="${escapeHtml(key)}"
                      ${values.includes(option.value) ? "checked" : ""}
                    />
                    <span>${escapeHtml(option.label)}</span>
                  </label>
                `).join("") : '<div class="tl-mc-column-filter__empty">Nenhuma opção encontrada.</div>'}
              </div>
            </div>
          </div>
        </div>
      </th>
    `;
  }

  function filteredProcessos() {
    const text = normalizeStatusText(state.filterText.trim());
    const clienteText = normalizeStatusText(state.columnFilters.cliente.trim());
    return state.processos.filter((processo) => {
      const overview = checklistOverview(processo);
      const haystack = normalizeStatusText([
        processo.reserva,
        processo.cliente,
        processo.cliente_cpf,
        processo.cliente_email,
        processo.cliente_telefone,
        processo.cliente_cidade,
        processo.corretor,
        processo.empreendimento,
        processo.cca_vinculado,
        processo.produto,
        overview.etapaAtual,
        overview.proximaAcao,
        labelFor(caixaStatuses, processo.caixa),
        labelFor(agehabStatuses, processo.agehab),
      ].join(" "));
      if (text && !haystack.includes(text)) return false;
      if (state.filterStatus === "pendente" && !hasPending(processo)) return false;
      if (state.filterStatus === "finalizado" && !isFinalizado(processo)) return false;
      if (clienteText) {
        const clientHaystack = normalizeStatusText([
          processo.cliente,
          processo.cliente_cpf,
          processo.reserva,
        ].join(" "));
        if (!clientHaystack.includes(clienteText)) return false;
      }
      if (state.columnFilters.owners.length) {
        const ownerTokens = processOwnerFilterTokens(processo).map((item) => item.value);
        if (!ownerTokens.some((value) => state.columnFilters.owners.includes(value))) return false;
      }
      if (state.columnFilters.statuses.length) {
        const statusTokens = processStatusFilterTokens(processo, overview).map((item) => item.value);
        if (!statusTokens.some((value) => state.columnFilters.statuses.includes(value))) return false;
      }
      return true;
    });
  }

  function renderTabs() {
    els.tabs.innerHTML = tabs.map((tab) => `
      <a class="tl-mc-tab ${tab.id === state.activeTab ? "is-active" : ""}" href="${tab.path}" data-tab="${tab.id}">
        ${icon(tab.icon)}
        <span>${escapeHtml(tab.label)}</span>
      </a>
    `).join("");
  }

  function renderKpis() {
    const m = metrics(filteredProcessos());
    const tab = activeTab();
    const rows = tab.id === "gestor"
      ? [
          ["Processos", m.total, "reservas na carteira"],
          ["Finalizados", m.finalizados, `${percent(m.finalizados, m.total)} concluídos`],
          ["SLA médio", formatElapsed(m.avgSla), "tempo médio operacional"],
          ["Retrabalho", m.retrabalho, "eventos mapeados"],
        ]
      : [
          ["Clientes", m.total, "cadastros na carteira"],
          ["Pendências", m.pendentes, `${m.urgentes} críticas ou próximas`],
      ["Documentos", m.documentos, "com anexos recebidos"],
          ["SLA médio", formatElapsed(m.avgSla), "tempo da carteira"],
        ];

    els.kpis.innerHTML = rows.map(([label, value, sub]) => `
      <article class="tl-mc-kpi">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(sub)}</small>
      </article>
    `).join("");
  }

  function percent(value, total) {
    if (!total) return "0,0%";
    return `${((Number(value || 0) / Number(total || 1)) * 100).toFixed(1).replace(".", ",")}%`;
  }

  function gestorOwnerName(processo) {
    return processo?.corretor || "Sem corretor";
  }

  function gestorStageKey(processo, overview = checklistOverview(processo)) {
    if (overview.finalizado) return "finalizado";
    if (overview.ccaIniciado) return "cca";
    if (overview.analistaLiberado) return "analise";
    if (overview.bloqueado) return "pendencia";
    return "documentacao";
  }

  function gestorStagePriority(stageKey) {
    const priorities = {
      pendencia: 0,
      documentacao: 1,
      analise: 2,
      cca: 3,
      finalizado: 4,
    };
    return priorities[stageKey] ?? 99;
  }

  function gestorStageMeta(stageKey) {
    const stages = {
      documentacao: { label: "Documentação", chip: "warn" },
      pendencia: { label: "Pendência", chip: "danger" },
      analise: { label: "Análise 7LM", chip: "info" },
      cca: { label: "Correspondente", chip: "info" },
      finalizado: { label: "Concluído", chip: "ok" },
    };
    return stages[stageKey] || stages.documentacao;
  }

  function gestorOwnerGroups(list = filteredProcessos()) {
    const byOwner = new Map();
    list.forEach((processo) => {
      const owner = gestorOwnerName(processo);
      const overview = checklistOverview(processo);
      const stageKey = gestorStageKey(processo, overview);
      const item = byOwner.get(owner) || {
        name: owner,
        total: 0,
        finalizados: 0,
        pendentes: 0,
        stages: {
          documentacao: 0,
          pendencia: 0,
          analise: 0,
          cca: 0,
          finalizado: 0,
        },
        slaValues: [],
        processos: [],
      };
      item.total += 1;
      item.finalizados += overview.finalizado ? 1 : 0;
      item.pendentes += overview.bloqueado ? 1 : 0;
      item.stages[stageKey] += 1;
      const elapsedSeconds = Number(processo?.sla?.elapsed_seconds || 0);
      if (elapsedSeconds) item.slaValues.push(elapsedSeconds);
      item.processos.push({ processo, overview, stageKey });
      byOwner.set(owner, item);
    });

    return Array.from(byOwner.values())
      .map((item) => ({
        ...item,
        avgSlaSeconds: item.slaValues.length
          ? item.slaValues.reduce((acc, value) => acc + value, 0) / item.slaValues.length
          : 0,
        processos: item.processos.sort((a, b) => {
          const priorityDiff = gestorStagePriority(a.stageKey) - gestorStagePriority(b.stageKey);
          if (priorityDiff) return priorityDiff;
          return String(a.processo?.cliente || "").localeCompare(String(b.processo?.cliente || ""), "pt-BR");
        }),
      }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));
  }

  function normalizeStatusText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function documentState(processo, key, meta = null) {
    if (meta?.state) return meta.state;
    const status = meta?.status || processo.documentos?.[key] || "Aguardando";
    const pendencia = (processo.pendencias || processo["pend\u00eancias"] || {})[key] || {};
    const normalized = normalizeStatusText(status);
    if (
      pendencia.descricao
      || normalized.includes("pend")
      || normalized.includes("bloq")
      || normalized.includes("rejeit")
      || normalized.includes("reprov")
      || (normalized.includes("valid") && normalized.includes("analist"))
      || normalized === "enviado"
    ) return "pending";
    if (normalized.includes("aprov") || normalized.includes("nao se aplica")) return "done";
    return "missing";
  }

  function isAwaitingAnalystValidation(status) {
    const normalized = normalizeStatusText(status);
    return normalized === "enviado"
      || (normalized.includes("valid") && normalized.includes("analist"))
      || normalized.includes("aguardando validacao");
  }

  function isRejectedDocument(status) {
    const normalized = normalizeStatusText(status);
    return normalized.includes("rejeit") || normalized.includes("reprov") || normalized.includes("bloq");
  }

  function documentPendency(processo, key) {
    return (processo?.pendencias || processo?.["pendencias"] || processo?.["pend\u00eancias"] || {})[key] || {};
  }

  function isNotApplicableRequest(processo, key, status = "") {
    const pendencia = documentPendency(processo, key);
    const description = normalizeStatusText(pendencia.descricao || "");
    return isAwaitingAnalystValidation(status) && description.includes("nao se aplica");
  }

  function documentStatusLabel(stateValue, status = "") {
    if (stateValue === "done") return "OK";
    if (stateValue === "pending" && isAwaitingAnalystValidation(status)) return "Aguardando validação";
    if (stateValue === "pending" && isRejectedDocument(status)) return "Rejeitado";
    if (stateValue === "pending") return "Pendente/reenvio";
    return "Pendente envio";
  }

  function documentStatusText(status) {
    const normalized = normalizeStatusText(status);
    if (isAwaitingAnalystValidation(status)) return "Aguardando validação";
    if (normalized === "pendente") return "Pendente/reenvio";
    if (!String(status || "").trim() || normalized === "aguardando") return "Aguardando envio";
    return status || "Aguardando";
  }

  function fallbackChecklistDocuments(processo) {
    return documentCatalog.map(([key, label], index) => ({
      key,
      label,
      sectionKey: "geral",
      sectionLabel: "Checklist documental",
      sectionOrder: 100 + index,
      helper: "",
      ruleLabel: "",
      personName: "",
      kits: [],
      status: processo.documentos?.[key] || "Aguardando",
      state: documentState(processo, key),
      uploadCount: uploadCountForDocumentPrefix(processo, key),
      conditional: false,
    }));
  }

  function compatibilityChecklistDocuments(processo, knownKeys = new Set()) {
    const extraKeys = new Set();
    const appendKey = (value) => {
      const key = String(value || "").trim();
      if (!key || knownKeys.has(key)) return;
      extraKeys.add(key);
    };

    Object.keys(processo?.documentos || {}).forEach(appendKey);
    Object.keys(processo?.uploadsEnviados || {}).forEach(appendKey);
    Object.keys(processo?.uploadsCca || {}).forEach(appendKey);
    allUploadsForProcess(processo).forEach((item) => appendKey(item?.key));

    return Array.from(extraKeys).map((key, index) => {
      const compatibility = legacyDocumentCompatibility[key] || {};
      const uploadCount = uploadCountForDocumentPrefix(processo, key);
      const status = processo?.documentos?.[key] || (uploadCount > 0 ? "Pendente Validacao Analista" : "Aguardando");
      return {
        key,
        label: compatibility.label || fallbackDocumentLabel(key),
        sectionKey: compatibility.sectionKey || "uploads-adicionais",
        sectionLabel: compatibility.sectionLabel || "Uploads já existentes",
        sectionOrder: Number.isFinite(Number(compatibility.sectionOrder)) ? Number(compatibility.sectionOrder) : 900 + index,
        helper: compatibility.helper || "Upload já existente vinculado a este processo. O analista pode validar este item normalmente.",
        ruleLabel: "",
        personName: "",
        kits: Array.isArray(compatibility.kits) ? compatibility.kits.filter(Boolean) : [],
        status,
        state: documentState(processo, key, { status }),
        uploadCount,
        conditional: true,
      };
    });
  }

  function checklistDocuments(processo) {
    const dynamicSource = Array.isArray(processo?.checklist_documental)
      ? processo.checklist_documental
      : [];
    const dynamicByKey = new Map(dynamicSource
      .map((item) => [String(item?.key || "").trim(), item])
      .filter(([key]) => key));
    const baseSource = fallbackChecklistDocuments(processo).map((item) => ({
      ...item,
      ...(dynamicByKey.get(item.key) || {}),
      key: item.key,
      label: dynamicByKey.get(item.key)?.label || item.label,
      sectionKey: item.sectionKey,
      sectionLabel: item.sectionLabel,
      sectionOrder: item.sectionOrder,
      conditional: false,
    }));
    const baseKeys = new Set(baseSource.map((item) => item.key));
    const source = [
      ...baseSource,
      ...dynamicSource.filter((item) => {
        const key = String(item?.key || "").trim();
        return key && !baseKeys.has(key);
      }),
    ];

    const documents = source
      .map((item, index) => {
        const key = String(item?.key || "").trim();
        const label = String(item?.label || key || `Documento ${index + 1}`).trim();
        const uploadCount = Number.isFinite(Number(item?.uploadCount))
          ? Number(item.uploadCount)
          : uploadCountForDocumentPrefix(processo, key);
        return {
          key,
          label,
          sectionKey: item?.sectionKey || "geral",
          sectionLabel: item?.sectionLabel || "Checklist documental",
          sectionOrder: Number.isFinite(Number(item?.sectionOrder)) ? Number(item.sectionOrder) : 100 + index,
          helper: String(item?.helper || "").trim(),
          ruleLabel: String(item?.ruleLabel || "").trim(),
          personName: String(item?.personName || "").trim(),
          kits: Array.isArray(item?.kits) ? item.kits.filter(Boolean) : [],
          status: item?.status || processo.documentos?.[key] || "Aguardando",
          state: documentState(processo, key, item),
          uploadCount,
          conditional: Boolean(item?.conditional),
        };
      })
      .filter((item) => item.key);

    const knownKeys = new Set(documents.map((item) => item.key));
    return [...documents, ...compatibilityChecklistDocuments(processo, knownKeys)]
      .sort((a, b) => (a.sectionOrder - b.sectionOrder) || a.label.localeCompare(b.label, "pt-BR"));
  }

  function checklistDocMap(processo) {
    const map = new Map();
    checklistDocuments(processo).forEach((item) => {
      map.set(item.key, item);
    });
    return map;
  }

  function checklistSections(processo, overview = null) {
    const documentos = overview?.documentos || checklistDocuments(processo);
    const sections = [];
    const byKey = new Map();
    documentos.forEach((item) => {
      const sectionKey = item.sectionKey || "geral";
      if (!byKey.has(sectionKey)) {
        const section = {
          key: sectionKey,
          label: item.sectionLabel || "Checklist documental",
          order: Number.isFinite(Number(item.sectionOrder)) ? Number(item.sectionOrder) : 999,
          items: [],
        };
        byKey.set(sectionKey, section);
        sections.push(section);
      }
      byKey.get(sectionKey).items.push(item);
    });
    return sections
      .map((section) => ({
        ...section,
        total: section.items.length,
        concluidos: section.items.filter((item) => item.state === "done").length,
        pendentes: section.items.filter((item) => item.state === "pending").length,
        faltantes: section.items.filter((item) => item.state === "missing").length,
      }))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "pt-BR"));
  }

  function buildChecklistOverview(processo) {
    const documentos = checklistDocuments(processo);
    const total = documentos.length;
    const concluidos = documentos.filter((item) => item.state === "done").length;
    const pendentes = documentos.filter((item) => item.state === "pending").length;
    const faltantes = documentos.filter((item) => item.state === "missing");
    const enviados = documentos.filter((item) => Number(item.uploadCount || 0) > 0);
    const aguardandoAnalista = documentos.filter((item) => isAwaitingAnalystValidation(item.status)).length;
    const pendenciasRejeitadas = documentos.filter((item) => isRejectedDocument(item.status)).length;
    const progresso = total ? Math.round((concluidos / total) * 100) : 0;
    const bloqueado = pendenciasRejeitadas > 0;
    const documentacaoCompleta = total > 0 && faltantes.length === 0 && pendentes === 0;
    const ccaIniciado = ["emitindo_formularios", "formularios_em_assinatura", "formularios_assinados", "envio_conformidade"].includes(processo.caixa)
      || ["ficha_emitida", "ficha_recebida", "em_validacao_agehab", "agehab_validada"].includes(processo.agehab);
    const finalizado = isFinalizado(processo);
    const analistaLiberado = enviados.length > 0 || analysisStarted(processo) || ccaIniciado || finalizado;
    const etapaAtual = finalizado
      ? "Conformidade finalizada"
      : ccaIniciado
        ? "Kits do correspondente"
        : analistaLiberado
          ? "Validação do analista 7LM"
          : bloqueado
            ? "Pendência documental"
            : "Documentação do corretor";
    const proximaAcao = finalizado
      ? "Processo concluído nesta esteira."
      : ccaIniciado
        ? "Gerar kits, acompanhar Caixa e Agehab e consolidar o envio final."
        : analistaLiberado
          ? documentacaoCompleta
            ? "Concluir a validação final e liberar os kits da reserva."
            : aguardandoAnalista > 0
              ? "O analista já pode validar os documentos enviados enquanto o corretor complementa o restante."
              : "A análise pode seguir por documento conforme os anexos forem chegando."
          : bloqueado
            ? "Tratar as pendências antes de avançar para análise."
            : `Regularizar ${faltantes.length} documento(s) e enviar os primeiros anexos para iniciar a análise.`;

    return {
      documentos,
      total,
      concluidos,
      pendentes,
      faltantes,
      enviados,
      aguardandoAnalista,
      pendenciasRejeitadas,
      progresso,
      bloqueado,
      documentacaoCompleta,
      analistaLiberado,
      ccaIniciado,
      finalizado,
      etapaAtual,
      proximaAcao,
    };
  }

  function checklistOverview(processo) {
    return buildChecklistOverview(processo);
  }
  function pendingDocumentCount(processo, overview = checklistOverview(processo)) {
    return overview.documentos.filter((item) => item.state !== "done").length;
  }

  function timelineSteps(processo, overview) {
    return [
      {
        number: 1,
        title: "Cadastro",
        subtitle: "Cliente na carteira",
        state: "done",
      },
      {
        number: 2,
        title: "Documentação",
        subtitle: overview.documentacaoCompleta ? "Completa" : `${overview.faltantes.length} falta(m)`,
        state: overview.documentacaoCompleta ? "done" : overview.analistaLiberado ? "current" : "current",
      },
      {
        number: 3,
        title: "Análise 7LM",
        subtitle: overview.finalizado || overview.ccaIniciado
          ? "Crédito validado"
          : overview.analistaLiberado
            ? `${overview.enviados.length} documento(s) já enviado(s)`
            : "Aguardando primeiro envio",
        state: overview.finalizado || overview.ccaIniciado ? "done" : overview.analistaLiberado ? "current" : "pending",
      },
      {
        number: 4,
        title: "Correspondente",
        subtitle: overview.ccaIniciado ? labelFor(caixaStatuses, processo.caixa) : "Correspondente",
        state: overview.finalizado ? "done" : overview.ccaIniciado ? "current" : "pending",
      },
      {
        number: 5,
        title: "Conformidade",
        subtitle: overview.finalizado ? "Finalizado" : "Pendente",
        state: overview.finalizado ? "done" : "pending",
      },
    ];
  }

  function renderWorkflowSummary(processo, overview) {
    const missingPreview = overview.faltantes.slice(0, 5);
    return `
      <section class="tl-mc-flow-summary">
        <div class="tl-mc-stage-card">
          <span class="tl-mc-detail-kicker">Etapa atual</span>
          <strong>${escapeHtml(overview.etapaAtual)}</strong>
          <p>${escapeHtml(overview.proximaAcao)}</p>
          <div class="tl-mc-progress">
            <span style="width: ${overview.progresso}%"></span>
          </div>
          <small>${overview.concluidos}/${overview.total} documentos regularizados (${overview.progresso}%)</small>
        </div>
        <div class="tl-mc-flow-metrics">
          <article>
            <span>Faltam</span>
            <strong>${overview.faltantes.length}</strong>
            <small>documentos</small>
          </article>
          <article>
            <span>Pendências</span>
            <strong>${overview.pendentes}</strong>
            <small>em aberto</small>
          </article>
          <article>
            <span>Anexos</span>
            <strong>${state.uploads.length}</strong>
            <small>enviados</small>
          </article>
          <article>
            <span>SLA</span>
            <strong>${escapeHtml(processo.sla?.elapsed_label || formatElapsed(processo.sla?.elapsed_seconds))}</strong>
            <small>tempo</small>
          </article>
        </div>
        <div class="tl-mc-missing-strip">
          <span>${overview.faltantes.length ? "Principais faltantes" : "Documentação"}</span>
          <div>
            ${missingPreview.length
              ? missingPreview.map((item) => `<em>${escapeHtml(item.label)}</em>`).join("")
              : "<em>Tudo regularizado</em>"}
            ${overview.faltantes.length > missingPreview.length ? `<em>+${overview.faltantes.length - missingPreview.length}</em>` : ""}
          </div>
        </div>
      </section>
    `;
  }

  function renderTimeline(processo, overview, compact = false) {
    return `
      <div class="tl-mc-timeline ${compact ? "tl-mc-timeline--compact" : ""}" aria-label="Linha do tempo do cliente">
        ${timelineSteps(processo, overview).map((step) => `
          <article class="tl-mc-timeline-step is-${step.state}">
            <span>${step.state === "done" ? "✓" : step.number}</span>
            <div>
              <strong>${escapeHtml(step.title)}</strong>
              <small>${escapeHtml(step.subtitle)}</small>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderGestorMiniTimeline(processo, overview) {
    return `
      <div class="tl-mc-mini-timeline" aria-label="Linha do tempo resumida do cliente">
        ${timelineSteps(processo, overview).map((step) => `
          <article
            class="tl-mc-mini-timeline__step is-${step.state}"
            title="${escapeHtml(`${step.title}: ${step.subtitle}`)}"
          >
            <span>${step.state === "done" ? "OK" : step.number}</span>
            <small>${escapeHtml(step.title)}</small>
          </article>
        `).join("")}
      </div>
    `;
  }

  function checklistOriginMeta(origin) {
    const meta = {
      corretor: {
        label: "Corretor",
        kicker: "Visão do corretor",
        title: "Subir documentação e responder pendências",
        description: "Use os anexos de cada documento para montar o dossiê e acompanhar o envio para análise.",
        backLabel: "fila do corretor",
      },
      analista: {
        label: "Analista de crédito",
        kicker: "Visão do analista",
        title: "Validar dossiê e decidir o avanço da reserva",
        description: "Revise faltantes, registre observações e devolva pendências ou avance a reserva para o correspondente.",
        backLabel: "fila do analista",
      },
      cca: {
        label: "Correspondente",
        kicker: "Visão do correspondente",
        title: "Montar kit bancário e acompanhar Caixa e Agehab",
        description: "Acompanhar formulários, assinaturas, kit bancário e envio para conformidade.",
        backLabel: "fila do correspondente",
      },
      gestor: {
        label: "Gestor",
        kicker: "Visão de acompanhamento",
        title: "Cobrar a etapa certa e destravar a carteira",
        description: "Use a timeline, os kits e as pendências para acompanhar os gargalos da reserva.",
        backLabel: "painel do gestor",
      },
    };
    return meta[normalizeChecklistOrigin(origin)] || meta.corretor;
  }

  function inferChecklistOrigin(processo, overview = checklistOverview(processo)) {
    const explicitOrigin = normalizeChecklistOrigin(state.checklistOrigin);
    if (explicitOrigin === "gestor") return explicitOrigin;
    if (explicitOrigin === "analista" && !overview.analistaLiberado) {
      return "corretor";
    }
    if (explicitOrigin === "cca" && !overview.ccaIniciado && !overview.finalizado) {
      return overview.analistaLiberado ? "analista" : "corretor";
    }
    if ((explicitOrigin === "analista" || explicitOrigin === "cca") && !overview.analistaLiberado) {
      return "corretor";
    }
    if (explicitOrigin) return explicitOrigin;
    if (overview.finalizado) return "gestor";
    if (overview.ccaIniciado) return "cca";
    if (processo?.encaminhado_analista || overview.analistaLiberado) return "analista";
    return "corretor";
  }

  function checklistListPath(origin) {
    switch (normalizeChecklistOrigin(origin)) {
      case "analista":
        return "/maq-credito/analista";
      case "cca":
        return "/maq-credito/cca/acompanhamento";
      case "gestor":
        return "/maq-credito/gestor/telemetria";
      default:
        return "/maq-credito/corretor";
    }
  }

  function currentActorRole() {
    if (state.selectedReserva) return normalizeChecklistOrigin(state.checklistOrigin) || "corretor";
    return normalizeChecklistOrigin(state.activeTab) || state.activeTab || "corretor";
  }

  function analysisStarted(processo) {
    return Boolean(
      processo?.encaminhado_analista
      || processo?.caixa === "em_analise_credito"
      || processo?.agehab === "em_analise_credito"
      || processo?.caixa === "emitindo_formularios"
      || processo?.agehab === "ficha_emitida"
    );
  }

  function availableChecklistRoles(processo, overview) {
    const roles = ["corretor"];
    if (overview.analistaLiberado) {
      roles.push("analista");
    }
    if (overview.ccaIniciado || overview.finalizado) {
      roles.push("cca");
    }
    if (state.activeTab === "gestor" || state.checklistOrigin === "gestor" || overview.finalizado) {
      roles.push("gestor");
    }
    return Array.from(new Set(roles));
  }

  function rowStageActions(processo, overview = checklistOverview(processo)) {
    return [{ role: "detalhe", label: overview.finalizado ? "Acompanhar" : "Detalhar" }];
  }

  function analystActionState(processo, overview) {
    if (!overview.analistaLiberado) return "locked";
    if (overview.ccaIniciado || overview.finalizado) return "released";
    if (analysisStarted(processo)) return "in_progress";
    return "ready";
  }

  function renderStageActionButtons(processo, overview, origin) {
    if (origin === "corretor") {
      if (!overview.analistaLiberado) {
        return '<span class="tl-mc-muted">O analista é liberado assim que o primeiro documento for enviado.</span>';
      }
      return `
        <div class="tl-mc-stage-buttons">
          <button class="tl-mc-icon-btn" type="button" data-open-stage="${escapeHtml(processo.reserva)}" data-stage-origin="analista">Abrir analista</button>
          ${overview.ccaIniciado || overview.finalizado
            ? `<button class="tl-mc-icon-btn" type="button" data-open-stage="${escapeHtml(processo.reserva)}" data-stage-origin="cca">Abrir correspondente</button>`
            : '<span class="tl-mc-muted">O correspondente entra depois da validação final do analista.</span>'}
        </div>
      `;
    }

    if (origin === "analista") {
      const stateValue = analystActionState(processo, overview);
      if (stateValue === "locked") {
        return '<span class="tl-mc-muted">Envie o primeiro documento para liberar a análise de crédito.</span>';
      }
      if (stateValue === "released") {
        return `
          <div class="tl-mc-stage-buttons">
            <span class="tl-mc-chip tl-mc-chip--ok">Análise concluída</span>
            <button class="tl-mc-icon-btn" type="button" data-open-stage="${escapeHtml(processo.reserva)}" data-stage-origin="cca">Seguir para correspondente</button>
          </div>
        `;
      }
      if (stateValue === "ready") {
        return `
          <div class="tl-mc-stage-buttons">
            <button class="tl-mc-icon-btn" type="button" data-role-action="analista-iniciar">Iniciar análise</button>
            <span class="tl-mc-muted">Você já pode validar os documentos enviados, mesmo antes do dossiê completo.</span>
          </div>
        `;
      }
      return `
        <div class="tl-mc-stage-buttons">
          <span class="tl-mc-chip tl-mc-chip--info">${escapeHtml(overview.documentacaoCompleta ? "Análise em andamento" : "Validação parcial em andamento")}</span>
          ${overview.documentacaoCompleta
            ? '<button class="tl-mc-icon-btn" type="button" data-role-action="analista-liberar-cca">Liberar para o correspondente</button>'
            : '<span class="tl-mc-muted">Continue aprovando por documento. Os kits só liberam quando o dossiê estiver completo.</span>'}
        </div>
      `;
    }

    if (origin === "cca") {
      if (!overview.ccaIniciado && !overview.finalizado) {
        return '<span class="tl-mc-muted">O correspondente só aparece depois da validação final do analista.</span>';
      }
      return `
        <div class="tl-mc-stage-tracks">
          ${renderStageStatusTrack("Caixa", "caixa", processo.caixa, caixaStatuses.slice(2))}
          ${renderStageStatusTrack("Agehab", "agehab", processo.agehab, agehabStatuses.slice(2))}
        </div>
      `;
    }

    return `
      <div class="tl-mc-stage-buttons">
        ${overview.analistaLiberado ? `<button class="tl-mc-icon-btn" type="button" data-open-stage="${escapeHtml(processo.reserva)}" data-stage-origin="analista">Análise 7LM</button>` : ""}
        ${overview.ccaIniciado || overview.finalizado ? `<button class="tl-mc-icon-btn" type="button" data-open-stage="${escapeHtml(processo.reserva)}" data-stage-origin="cca">Correspondente</button>` : ""}
      </div>
    `;
  }

  function renderStageStatusTrack(label, field, currentValue, options) {
    return `
      <article class="tl-mc-stage-track">
        <div class="tl-mc-stage-track__head">
          <strong>${escapeHtml(label)}</strong>
          <small>${escapeHtml(labelFor(field === "caixa" ? caixaStatuses : agehabStatuses, currentValue))}</small>
        </div>
        <div class="tl-mc-stage-track__buttons">
          ${options.map(([value, text]) => `
            <button
              class="tl-mc-stage-option ${currentValue === value ? "is-active" : ""}"
              type="button"
              data-role-action="${escapeHtml(`${field}:${value}`)}"
            >${escapeHtml(text)}</button>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderChecklistRolePanel(processo, overview) {
    const origin = inferChecklistOrigin(processo, overview);
    const meta = checklistOriginMeta(origin);
    const reserva = encodeURIComponent(processo.reserva);
    const documentsReady = overview.concluidos === overview.total && overview.total > 0;
    const roles = availableChecklistRoles(processo, overview);
    const caixaKitVisible = kitProfileVisibility("caixa", processo);
    const agehabKitVisible = kitProfileVisibility("agehab", processo);
    const credituKitVisible = kitProfileVisibility("creditu", processo);
    const caixaKitReady = readyDocumentsForKitProfile("caixa", processo).length > 0;
    const agehabKitReady = readyDocumentsForKitProfile("agehab", processo).length > 0;
    const credituKitReady = readyDocumentsForKitProfile("creditu", processo).length > 0;
    const quickLinks = [
      renderKitLink("Dossiê PDF", `${API_BASE}/${reserva}/uploads?merge=1`, state.uploads.length > 0),
      (origin === "cca" || origin === "gestor") && caixaKitVisible
        ? renderKitLink("Kit Caixa", `${API_BASE}/${reserva}/kit-caixa/download`, caixaKitReady)
        : "",
      (origin === "cca" || origin === "gestor") && agehabKitVisible
        ? renderKitLink("Kit AGEHAB", `${API_BASE}/${reserva}/kit-agehab/download`, agehabKitReady)
        : "",
      (origin === "analista" || origin === "cca" || origin === "gestor") && credituKitVisible
        ? renderKitLink("Kit Creditú", `${API_BASE}/${reserva}/creditu/download`, credituKitReady)
        : "",
    ].filter(Boolean).join("");
    const roleActions = renderStageActionButtons(processo, overview, origin);

    return `
      <section class="tl-mc-role-panel">
        <div class="tl-mc-role-panel__head">
          <div>
            <span class="tl-mc-detail-kicker">${escapeHtml(meta.kicker)}</span>
            <h4>${escapeHtml(meta.title)}</h4>
            <p>${escapeHtml(meta.description)}</p>
          </div>
          <div class="tl-mc-role-switch" aria-label="Alternar visóo da jornada">
            ${roles.map((role) => `
              <button class="tl-mc-role-chip ${role === origin ? "is-active" : ""}" type="button" data-checklist-origin="${role}">
                ${escapeHtml(checklistOriginMeta(role).label)}
              </button>
            `).join("")}
          </div>
        </div>
        <div class="tl-mc-role-grid">
          <article>
            <span>Fila atual</span>
            <strong>${escapeHtml(meta.label)}</strong>
            <small>${escapeHtml(meta.backLabel)}</small>
          </article>
          <article>
            <span>Encaminhado</span>
            <strong>${processo.encaminhado_analista ? "Sim" : "Não"}</strong>
            <small>${processo.encaminhado_analista ? "Em análise interna" : "Ainda no corretor"}</small>
          </article>
          <article>
            <span>Status da Caixa</span>
            <strong>${escapeHtml(labelFor(caixaStatuses, processo.caixa))}</strong>
            <small>${escapeHtml(processo.cca_vinculado || "Correspondente não vinculado")}</small>
          </article>
          <article>
            <span>Status da Agehab</span>
            <strong>${escapeHtml(labelFor(agehabStatuses, processo.agehab))}</strong>
            <small>${documentsReady ? "Documentação base pronta" : `${overview.faltantes.length} documento(s) faltando`}</small>
          </article>
        </div>
        <div class="tl-mc-role-actions">
          <div class="tl-mc-role-actions__group">
            ${quickLinks || '<span class="tl-mc-muted">Os downloads do kit aparecem conforme os anexos da reserva forem subidos.</span>'}
          </div>
          <div class="tl-mc-role-actions__group tl-mc-role-actions__group--stage">
            ${roleActions}
          </div>
        </div>
      </section>
    `;
  }

  function processStatusChips(processo, overview = checklistOverview(processo)) {
    const stageKey = gestorStageKey(processo, overview);
    const stageMeta = gestorStageMeta(stageKey);
    const chips = [[stageMeta.chip, overview.etapaAtual]];
    if (hasPending(processo)) chips.push(["danger", `${pendingEntries(processo).length} pendência(s)`]);
    if (overview.finalizado) chips.push(["ok", "Concluído"]);
    return chips.map(([kind, label]) => `<span class="tl-mc-chip tl-mc-chip--${kind}">${escapeHtml(label)}</span>`).join("");
  }

  function documentationSummary(processo, overview = checklistOverview(processo)) {
    if (overview.finalizado) {
      return {
        state: "complete",
        title: "Documentação completa",
        detail: `${overview.concluidos}/${overview.total} documento(s) aprovados`,
      };
    }
    const uploadedCount = Number(overview.enviados?.length || 0);
    const pendingDocs = pendingDocumentCount(processo, overview);
    if (uploadedCount > 0) {
      return {
        state: "pending",
        title: "Documentação pendente",
        detail: `${pendingDocs} a regularizar · ${uploadedCount} arquivo(s) anexado(s)`,
      };
    }
    return {
      state: "pending",
      title: "Documentação pendente",
      detail: `${pendingDocs} documento(s) a regularizar`,
    };
  }

  function renderDocumentationSummary(processo, overview = checklistOverview(processo)) {
    const summary = documentationSummary(processo, overview);
    return `
      <div class="tl-mc-table-doc-summary is-${summary.state}">
        <strong>${escapeHtml(summary.title)}</strong>
        <small>${escapeHtml(summary.detail)}</small>
      </div>
    `;
  }

  function renderTableScrollGuide() {
    return `
      <div class="tl-mc-table-scroll-guide" data-table-scroll-guide>
        <div class="tl-mc-table-scroll-guide__copy">
          <strong>Use a navegação da tabela</strong>
          <span>Cadastro, pendências, SLA e detalhe ficam à direita. Use os botões ou a barra horizontal.</span>
        </div>
        <div class="tl-mc-table-scroll-guide__actions" aria-label="Navegar pelas colunas da carteira">
          <button class="tl-mc-table-scroll-button" type="button" data-table-scroll="start" aria-label="Voltar ao início da tabela">‹ Início</button>
          <button class="tl-mc-table-scroll-button is-primary" type="button" data-table-scroll="end" aria-label="Ver últimas colunas da tabela">Ver final ›</button>
        </div>
      </div>
    `;
  }

  function renderTable() {
    const list = filteredProcessos();
    if (!list.length) {
      els.content.innerHTML = `
        <div class="tl-mc-empty">
          <strong>Nenhum cliente encontrado</strong>
          <span>Ajuste os filtros ou aguarde o cadastro do cliente no aprovador de vendas.</span>
        </div>
      `;
      return;
    }

    els.content.innerHTML = `
      <section class="tl-mc-table-shell" data-table-shell>
        ${renderTableScrollGuide()}
        <div class="tl-mc-table-wrap" data-table-scroll-area tabindex="0" aria-label="Carteira de clientes com rolagem horizontal">
          <table class="tl-mc-table">
            <thead>
              <tr>
                ${renderColumnTextFilter("Cliente", "cliente", "Nome, CPF ou reserva")}
                <th><div class="tl-mc-th-filter"><span class="tl-mc-th-filter__label">Documentação</span><span class="tl-mc-th-filter__hint">Pendente ou completa</span></div></th>
                ${renderColumnMultiFilter("Corretor / Correspondente", "owner", "Todos")}
                ${renderColumnMultiFilter("Status", "status", "Todos")}
                <th><div class="tl-mc-th-filter"><span class="tl-mc-th-filter__label">Cadastro completo</span><span class="tl-mc-th-filter__hint">Progresso da documentação</span></div></th>
                <th><div class="tl-mc-th-filter"><span class="tl-mc-th-filter__label">Docs pendentes</span><span class="tl-mc-th-filter__hint">Itens ainda a regularizar</span></div></th>
                <th><div class="tl-mc-th-filter"><span class="tl-mc-th-filter__label">SLA</span><span class="tl-mc-th-filter__hint">Tempo atual da carteira</span></div></th>
                <th><div class="tl-mc-th-filter"><span class="tl-mc-th-filter__label">Detalhar</span><span class="tl-mc-th-filter__hint">Abrir jornada do cliente</span></div></th>
              </tr>
            </thead>
            <tbody>
              ${list.map((processo) => {
                const overview = checklistOverview(processo);
                const actions = rowStageActions(processo, overview);
                const pendingDocs = pendingDocumentCount(processo, overview);
                return `
                <tr class="${processo.reserva === state.selectedReserva ? "is-selected" : ""}">
                  <td>
                    <button type="button" data-open-checklist="${escapeHtml(processo.reserva)}">${escapeHtml(processo.cliente || "Cliente")}</button><br />
                    <span class="tl-mc-muted">${escapeHtml(processo.cliente_cpf || processo.reserva || "-")}</span>
                  </td>
                  <td>${renderDocumentationSummary(processo, overview)}</td>
                  <td>
                    ${escapeHtml(processo.corretor || "-")}<br />
                    <span class="tl-mc-muted">${escapeHtml(processo.cca_vinculado || "Correspondente não vinculado")}</span>
                  </td>
                  <td><div class="tl-mc-chip-row">${processStatusChips(processo, overview)}</div></td>
                  <td>
                    <div class="tl-mc-table-progress">
                      <strong>${escapeHtml(`${overview.progresso}%`)}</strong>
                      <div class="tl-mc-progress"><span style="width:${Math.max(0, Math.min(100, overview.progresso))}%"></span></div>
                      <small>${escapeHtml(`${overview.concluidos}/${overview.total} documento(s)`)}</small>
                    </div>
                  </td>
                  <td>
                    <div class="tl-mc-table-pending">
                      <strong>${escapeHtml(String(pendingDocs))}</strong>
                      <small>${escapeHtml(pendingDocs ? "a regularizar" : "sem pendência")}</small>
                    </div>
                  </td>
                  <td>${escapeHtml(processo.sla?.elapsed_label || formatElapsed(processo.sla?.elapsed_seconds))}</td>
                  <td>
                    <div class="tl-mc-action-stack">
                      ${actions.map((action) => `
                        <button
                          class="tl-mc-icon-btn tl-mc-action-btn ${action.role === "detalhe" ? "is-primary" : ""}"
                          type="button"
                          data-open-client="${escapeHtml(processo.reserva)}"
                        >${escapeHtml(action.label)}</button>
                      `).join("")}
                    </div>
                  </td>
                </tr>
              `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderChecklist() {
    const selected = selectedProcess();
    if (!selected) {
      els.content.innerHTML = `
        <div class="tl-mc-empty">
          <strong>Selecione um cliente para abrir o checklist</strong>
          <button class="tl-mc-btn tl-mc-btn--soft" type="button" data-back-clients>Voltar à carteira</button>
        </div>
      `;
      return;
    }

    const overview = checklistOverview(selected);
    const origin = inferChecklistOrigin(selected, overview);
    const meta = checklistOriginMeta(origin);
    els.content.innerHTML = `
      <div class="tl-mc-client-workflow">
        <div class="tl-mc-flow-head">
          <div>
            <span class="tl-mc-detail-kicker">Jornada do cliente</span>
            <h3>${escapeHtml(selected.cliente || "Cliente")}</h3>
            <p>${escapeHtml([selected.cliente_cpf, selected.cliente_telefone, selected.cliente_email].filter(Boolean).join(" | ") || selected.produto || "Cadastro comercial")}</p>
          </div>
          <div class="tl-mc-flow-actions">
            <span class="tl-mc-current-stage">${escapeHtml(overview.etapaAtual)}</span>
            <button class="tl-mc-btn tl-mc-btn--soft" type="button" data-back-clients>Voltar à carteira</button>
          </div>
        </div>

        ${renderWorkflowSummary(selected, overview)}
        ${renderTimeline(selected, overview)}
        ${renderChecklistRolePanel(selected, overview)}

        ${renderSelectedChecklist(selected, overview)}

        <section class="tl-mc-section">
          <span class="tl-mc-section-title">Anexos enviados no cliente</span>
          <div class="tl-mc-upload-list" data-upload-list>
            ${renderUploads()}
          </div>
        </section>

        <section class="tl-mc-section">
          <span class="tl-mc-section-title">Mensagens</span>
          <div class="tl-mc-message-list" data-message-list>
            ${renderMessages()}
          </div>
          <form class="tl-mc-inline-form" data-message-form>
            <textarea class="tl-mc-textarea" name="message" placeholder="Adicionar mensagem para a equipe"></textarea>
            <div class="tl-mc-inline-actions">
              <select class="tl-mc-select" name="targetRole">
                <option value="todos">Todos</option>
                <option value="corretor">Corretor</option>
                <option value="cca">Correspondente</option>
                <option value="analista">Analista de crédito</option>
                <option value="gestor">Gestor</option>
              </select>
              <button class="tl-mc-btn tl-mc-btn--primary" type="submit">Enviar mensagem</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  function fallbackDocumentLabel(key) {
    const normalizedKey = String(key || "").trim();
    const compatibility = legacyDocumentCompatibility[normalizedKey];
    if (compatibility?.label) return compatibility.label;
    const legacy = documentCatalog.find(([item]) => item === normalizedKey);
    if (legacy?.[1]) return legacy[1];
    return titleCaseWords(normalizedKey.replace(/^documentos-/, "").replace(/-/g, " "));
  }

  function normalizeUploadItem(item, fallbackKey = "", processo = selectedProcess()) {
    if (!item || typeof item !== "object") return null;
    const key = String(item.key || item.documento_key || fallbackKey || "").trim();
    if (!key) return null;
    return {
      key,
      name: item.name || item.file_name || item.nome || fallbackDocumentLabel(key),
      url: item.url || item.data || item.href || "",
    };
  }

  function allUploadsForProcess(processo = selectedProcess()) {
    const reserva = String(processo?.reserva || "");
    const uploads = [];
    const pushUpload = (item, fallbackKey = "") => {
      const normalized = normalizeUploadItem(item, fallbackKey, processo);
      if (normalized) uploads.push(normalized);
    };

    if (reserva && reserva === String(state.selectedReserva || "")) {
      state.uploads.forEach((item) => pushUpload(item));
    }

    Object.entries(processo?.uploadsCca || {}).forEach(([groupKey, groupUpload]) => {
      if (Array.isArray(groupUpload)) {
        groupUpload.forEach((item) => pushUpload(item, groupKey));
        return;
      }
      pushUpload(groupUpload, groupKey);
    });

    Object.keys(processo?.uploadsEnviados || {}).forEach((groupKey) => {
      if (!uploads.some((item) => item.key === groupKey)) {
        uploads.push({
          key: groupKey,
          name: fallbackDocumentLabel(groupKey),
          url: "",
        });
      }
    });

    const seen = new Set();
    return uploads.filter((item) => {
      const signature = [item.key, item.name, item.url].join("::");
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  }

  function uploadsForDocument(key, processo = selectedProcess()) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) return [];
    return allUploadsForProcess(processo).filter((item) => item && item.key === normalizedKey);
  }

  function uploadSelectionLabel(files) {
    if (!files.length) return "Nenhum arquivo selecionado";
    if (files.length === 1) return files[0]?.name || "1 arquivo pronto para envio";
    return `${files.length} arquivos prontos para envio`;
  }

  function syncUploadScope(scope) {
    if (!scope) return;
    const fileInput = scope.querySelector("[data-upload-file]");
    const summary = scope.querySelector("[data-upload-summary]");
    const submitButton = scope.querySelector("[data-upload-submit]");
    const nextStep = scope.querySelector("[data-upload-next]");
    const documentName = scope.getAttribute("data-upload-document") || "este documento";
    if (!fileInput || !summary) return;
    const files = Array.from(fileInput.files || []);
    summary.textContent = uploadSelectionLabel(files);
    summary.setAttribute("data-has-files", files.length ? "true" : "false");
    if (submitButton) {
      submitButton.disabled = files.length === 0;
      const compactUpload = Boolean(scope.closest(".tl-mc-kit-upload-card"));
      submitButton.textContent = files.length > 1
        ? compactUpload ? `Enviar ${files.length}` : `Enviar ${files.length} arquivos`
        : files.length === 1
          ? compactUpload ? "Enviar 1" : "Enviar 1 arquivo"
          : compactUpload ? "Enviar" : "Enviar anexos";
    }
    if (nextStep) {
      nextStep.textContent = files.length
        ? "Seleção pronta. Revise os arquivos e confirme o envio."
        : `Selecione os arquivos de ${documentName} para liberar este item.`;
    }
  }

  function renderDocumentUploads(processo, key, options = {}) {
    const uploads = uploadsForDocument(key, processo);
    const canDelete = currentActorRole() === "analista";
    const compact = options.compact === true;
    const rootClass = `tl-mc-doc-files${compact ? " tl-mc-doc-files--compact" : ""}`;
    if (!uploads.length) {
      return `<div class="${rootClass} is-empty">${compact ? "Sem anexos enviados." : "Nenhum arquivo enviado ainda. Depois do envio, ele aparece aqui."}</div>`;
    }
    return `
      <div class="${rootClass}">
        ${uploads.map((item) => {
          const fileName = escapeHtml(item.name || item.key || "Arquivo");
          if (!item.url) {
            return `
              <span class="tl-mc-doc-file${compact ? " tl-mc-doc-file--compact" : ""}">
                <span class="tl-mc-doc-file__name">${fileName}</span>
                <span class="tl-mc-doc-file__meta">Anexo</span>
              </span>
            `;
          }
          return `
            <div class="tl-mc-doc-file-row${compact ? " tl-mc-doc-file-row--compact" : ""}">
              <button class="tl-mc-doc-file${compact ? " tl-mc-doc-file--compact" : ""}" type="button" data-open-upload="${escapeHtml(item.url)}" data-open-upload-name="${fileName}">
                <span class="tl-mc-doc-file__name">${fileName}</span>
                <span class="tl-mc-doc-file__meta">Abrir</span>
              </button>
              ${canDelete ? `
                <button
                  class="tl-mc-doc-file-action tl-mc-doc-file-action--danger"
                  type="button"
                  data-delete-upload="${escapeHtml(item.url)}"
                  data-delete-upload-name="${fileName}"
                >Excluir</button>
              ` : ""}
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderKitAttachmentCell(processo, key, uploads) {
    const count = uploads.length;
    const countText = count === 1 ? "1 arquivo enviado" : count ? `${count} arquivos enviados` : "Nenhum arquivo enviado";
    return `
      <div class="tl-mc-kit-attachments">
        <div class="tl-mc-kit-attachments__head">
          <span>${escapeHtml(String(count))}</span>
          <small>${escapeHtml(countText)}</small>
        </div>
        ${renderDocumentUploads(processo, key, { compact: true })}
      </div>
    `;
  }

  function renderDocumentMeta(item) {
    const parts = [item?.ruleLabel, item?.personName, item?.conditional ? "Condicional" : ""].filter(Boolean);
    if (!parts.length) return "";
    return `
      <div class="tl-mc-doc-meta-row">
        ${parts.map((part) => `<span class="tl-mc-doc-meta">${escapeHtml(part)}</span>`).join("")}
      </div>
    `;
  }

  function renderDocumentItem(processo, item) {
    const key = String(item?.key || "").trim();
    const label = item?.label || documentLabel(key, processo);
    const status = item?.status || processo.documentos?.[key] || "Aguardando";
    const pendencia = (processo.pendencias || processo["pendencias"] || processo["pend\u00eancias"] || {})[key] || {};
    const stateValue = documentState(processo, key, item);
    const uploads = uploadsForDocument(key, processo);
    const helperText = pendencia.descricao || item?.helper || (uploads.length ? `${uploads.length} anexo(s) enviado(s)` : "Sem pendência registrada");
    return `
      <article class="tl-mc-doc-item is-${stateValue}" data-document-key="${escapeHtml(key)}">
        <div class="tl-mc-doc-item__top">
          <span class="tl-mc-doc-marker">${stateValue === "done" ? "OK" : stateValue === "pending" ? "!" : "..."}</span>
          <div>
            <strong>${escapeHtml(label)}</strong><br />
            <small>${escapeHtml(helperText)}</small>
            ${renderDocumentMeta(item)}
          </div>
          <span class="tl-mc-doc-badge is-${stateValue}">${escapeHtml(documentStatusLabel(stateValue, status))}</span>
        </div>
        <div class="tl-mc-doc-controls">
          <select class="tl-mc-select" data-doc-status="${escapeHtml(key)}">
            ${docStatuses.map(([value, text]) => `<option value="${escapeHtml(value)}" ${status === value ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}
          </select>
          <button class="tl-mc-icon-btn" type="button" data-save-doc="${escapeHtml(key)}">Salvar</button>
          <button class="tl-mc-icon-btn" type="button" data-open-pendency="${escapeHtml(key)}">Pendência</button>
        </div>
        <div class="tl-mc-doc-upload" data-upload-scope>
          <div class="tl-mc-doc-upload__head">
            <div>
              <strong>Anexos deste documento</strong>
              <small>Selecione um ou mais arquivos para este item.</small>
            </div>
            <span class="tl-mc-doc-upload__count">${uploads.length ? `${uploads.length} enviado(s)` : "Nenhum envio"}</span>
          </div>
          <label class="tl-mc-doc-picker">
            <input type="file" multiple data-upload-file aria-label="Anexos do documento ${escapeHtml(label)}" />
            <span class="tl-mc-doc-picker__button">Selecionar arquivos</span>
            <span class="tl-mc-doc-picker__summary" data-upload-summary data-has-files="false">Nenhum arquivo selecionado</span>
          </label>
          <button class="tl-mc-icon-btn tl-mc-doc-upload__submit" type="button" data-upload-submit="${escapeHtml(key)}" data-upload-group="corretor" disabled>Enviar anexos</button>
        </div>
        ${renderDocumentUploads(processo, key)}
      </article>
    `;
  }

  function renderSelectedChecklist(processo, overview = checklistOverview(processo)) {
    return `
      <section class="tl-mc-section tl-mc-doc-section">
        <div class="tl-mc-section-head">
          <div>
            <span class="tl-mc-section-title">Checklist de documentação</span>
            <p>${overview.faltantes.length ? `${overview.faltantes.length} documento(s) ainda faltando para liberar a próxima etapa.` : "Documentação sem faltantes."}</p>
          </div>
          <div class="tl-mc-section-counters">
            <span>${overview.concluidos} OK</span>
            <span>${overview.pendentes} pendência(s)</span>
            <span>${overview.faltantes.length} falta(m)</span>
          </div>
        </div>
        <div class="tl-mc-doc-list">
          ${overview.documentos.map((item) => renderDocumentItem(processo, item)).join("")}
        </div>
      </section>
    `;
  }
  function statusChip(status) {
    const normalized = String(status || "").toLowerCase();
    if (normalized.includes("aprov") || normalized.includes("nao se aplica")) return "tl-mc-chip--ok";
    if (normalized.includes("rejeit") || normalized.includes("reprov") || normalized.includes("bloq")) return "tl-mc-chip--danger";
    if (normalized.includes("pend") || normalized.includes("valid")) return "tl-mc-chip--warn";
    return "tl-mc-chip--warn";
  }

  function selectedProcess() {
    if (!state.selectedReserva) return null;
    return state.processos.find((item) => item.reserva === state.selectedReserva) || null;
  }

  function clientDetailUrl(reserva, view = state.clientJourneyView, origin = state.checklistOrigin) {
    const params = new URLSearchParams();
    params.set("cliente", String(reserva || ""));
    params.set("visao", normalizeClientJourneyView(view));
    const etapa = normalizeChecklistOrigin(origin);
    if (etapa && etapa !== "gestor") params.set("etapa", etapa);
    return `${activeTab().path}?${params.toString()}`;
  }

  function clientJourneySubtitle(processo) {
    return [processo?.cliente_cpf, processo?.cliente_telefone, processo?.cliente_email, processo?.imovel_titulo].filter(Boolean).join(" | ")
      || processo?.empreendimento
      || "Cadastro comercial";
  }

  function clientModal() {
    return document.querySelector("[data-mc-client-modal]");
  }

  function ensureClientModal() {
    let modal = clientModal();
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "tl-mc-modal tl-mc-modal--client";
    modal.setAttribute("data-mc-client-modal", "");
    modal.hidden = true;
    modal.innerHTML = `
      <div class="tl-mc-modal__box tl-mc-modal__box--client">
        <div class="tl-mc-modal__head tl-mc-modal__head--client">
          <div class="tl-mc-modal__meta">
            <span class="tl-mc-detail-kicker">Jornada do cliente</span>
            <h3 data-client-modal-title>Cliente</h3>
            <p data-client-modal-subtitle></p>
          </div>
          <div class="tl-mc-flow-actions">
            <span class="tl-mc-current-stage" data-client-modal-stage></span>
            <button class="tl-mc-btn tl-mc-btn--soft" type="button" data-back-clients>Voltar à carteira</button>
          </div>
        </div>
        <div class="tl-mc-modal__body tl-mc-modal__body--client" data-client-modal-body></div>
      </div>
    `;
    root.appendChild(modal);
    return modal;
  }

  function renderCorretorDocumentItem(processo, item) {
    const key = String(item?.key || "").trim();
    const label = item?.label || documentLabel(key, processo);
    const status = item?.status || processo.documentos?.[key] || "Aguardando";
    const pendencia = (processo.pendencias || processo["pendencias"] || processo["pend\u00eancias"] || {})[key] || {};
    const stateValue = documentState(processo, key, item);
    const uploads = uploadsForDocument(key, processo);
    const awaitingValidation = isAwaitingAnalystValidation(status);
    const rejectedByAnalyst = isRejectedDocument(status);
    const helperText = pendencia.descricao
      || (rejectedByAnalyst
        ? "O analista rejeitou este item. Ajuste os arquivos e envie novamente."
        : awaitingValidation
          ? "Arquivos enviados. Agora este item aguarda a validação do analista."
          : item?.helper || (uploads.length ? `${uploads.length} arquivo(s) enviado(s). Você pode complementar este item se precisar.` : "Envie aqui os arquivos deste documento para liberar a análise."));
    const stateLabel = stateValue === "done"
      ? "Documento aprovado"
      : rejectedByAnalyst
        ? "Rejeitado pelo analista"
        : awaitingValidation
          ? "Aguardando validação do analista"
          : stateValue === "pending"
            ? "Com pendência"
            : "Envio pendente";
    const introHint = rejectedByAnalyst
      ? "O analista devolveu este item. Ajuste os arquivos e reenvie neste mesmo card."
      : awaitingValidation
        ? "Envio confirmado. A aprovação acontece na Etapa 2 · Validação do analista."
        : "Escolha os arquivos corretos e confirme o envio neste mesmo card.";
    const uploadCountText = uploads.length ? `${uploads.length} arquivo(s) enviado(s)` : "Nenhum envio ainda";
    const uploadReviewText = uploads.length
      ? awaitingValidation
        ? `${uploads.length} arquivo(s) enviado(s) e aguardando validação do analista.`
        : `${uploads.length} arquivo(s) já enviado(s) para este documento.`
      : "Depois do envio, os arquivos aparecem listados aqui.";
    return `
      <article class="tl-mc-doc-item is-${stateValue}" data-document-key="${escapeHtml(key)}">
        <div class="tl-mc-doc-item__top">
          <span class="tl-mc-doc-marker">${stateValue === "done" ? "OK" : stateValue === "pending" ? "!" : "..."}</span>
          <div>
            <strong>${escapeHtml(label)}</strong><br />
            <small>${escapeHtml(helperText)}</small>
            ${renderDocumentMeta(item)}
          </div>
          <span class="tl-mc-doc-badge is-${stateValue}">${escapeHtml(documentStatusLabel(stateValue, status))}</span>
        </div>
        <div class="tl-mc-doc-intro">
          <div class="tl-mc-chip-row">
            <span class="tl-mc-chip ${statusChip(status)}">${escapeHtml(stateLabel)}</span>
            <span class="tl-mc-chip tl-mc-chip--info">Pode enviar um ou mais arquivos</span>
          </div>
          <p class="tl-mc-doc-intro__hint">${escapeHtml(introHint)}</p>
        </div>
        <div class="tl-mc-doc-upload" data-upload-scope data-upload-document="${escapeHtml(label)}">
          <div class="tl-mc-doc-upload__head">
            <div>
              <strong>Envio do corretor</strong>
              <small>${escapeHtml(helperText)}</small>
            </div>
            <span class="tl-mc-doc-upload__count">${escapeHtml(uploadCountText)}</span>
          </div>
          <div class="tl-mc-doc-upload__steps">
            <span><strong>1</strong> Escolher arquivos</span>
            <span><strong>2</strong> Confirmar envio</span>
          </div>
          <label class="tl-mc-doc-picker">
            <input type="file" multiple data-upload-file aria-label="Anexos do documento ${escapeHtml(label)}" />
            <span class="tl-mc-doc-picker__button">Selecionar arquivos</span>
            <span class="tl-mc-doc-picker__summary" data-upload-summary data-has-files="false">Nenhum arquivo selecionado</span>
            <span class="tl-mc-doc-picker__hint">PDF, imagem ou comprovante complementar deste item.</span>
          </label>
          <div class="tl-mc-doc-upload__actions">
            <span class="tl-mc-doc-upload__next" data-upload-next>Selecione os arquivos de ${escapeHtml(label)} para liberar este item.</span>
            <button class="tl-mc-icon-btn tl-mc-doc-upload__submit" type="button" data-upload-submit="${escapeHtml(key)}" data-upload-group="corretor" disabled>Enviar anexos</button>
          </div>
        </div>
        <div class="tl-mc-doc-files__panel">
          <div class="tl-mc-doc-files__head">
            <strong>Arquivos já enviados</strong>
            <small>${escapeHtml(uploadReviewText)}</small>
          </div>
          ${renderDocumentUploads(processo, key)}
        </div>
      </article>
    `;
  }

  function renderAnalystDocumentItem(processo, item) {
    const key = String(item?.key || "").trim();
    const label = item?.label || documentLabel(key, processo);
    const status = item?.status || processo.documentos?.[key] || "Aguardando";
    const pendencia = (processo.pendencias || processo["pendencias"] || processo["pend\u00eancias"] || {})[key] || {};
    const stateValue = documentState(processo, key, item);
    const uploads = uploadsForDocument(key, processo);
    const canValidate = uploads.length > 0;
    const normalizedStatus = normalizeStatusText(status);
    const approvedByAnalyst = normalizedStatus.includes("aprov");
    const rejectedByAnalyst = isRejectedDocument(status);
    const awaitingValidation = isAwaitingAnalystValidation(status);
    const stateLabel = approvedByAnalyst
      ? "Documento aprovado"
      : rejectedByAnalyst
        ? "Rejeitado pelo analista"
        : awaitingValidation
          ? "Pronto para decisão do analista"
          : canValidate
            ? "Documento disponível para validação"
            : "Aguardando envio do corretor";
    const analystHint = canValidate
      ? "O analista aprova aqui neste card. Use Aprovar documento para liberar o item ou Rejeitar para devolver ao corretor com pendência."
      : "A aprovação fica liberada assim que o corretor enviar pelo menos um arquivo neste documento.";
    const helperText = pendencia.descricao
      || item?.helper
      || (canValidate ? `${uploads.length} anexo(s) disponível(is) para decisão do analista.` : "Sem anexo enviado pelo corretor.");
    const approveDisabled = !canValidate || approvedByAnalyst;
    return `
      <article class="tl-mc-doc-item is-${stateValue}" data-document-key="${escapeHtml(key)}">
        <div class="tl-mc-doc-item__top">
          <span class="tl-mc-doc-marker">${stateValue === "done" ? "OK" : stateValue === "pending" ? "!" : "..."}</span>
          <div>
            <strong>${escapeHtml(label)}</strong><br />
            <small>${escapeHtml(helperText)}</small>
            ${renderDocumentMeta(item)}
          </div>
          <span class="tl-mc-doc-badge is-${stateValue}">${escapeHtml(documentStatusLabel(stateValue, status))}</span>
        </div>
        <div class="tl-mc-doc-intro">
          <div class="tl-mc-chip-row">
            <span class="tl-mc-chip ${statusChip(status)}">${escapeHtml(stateLabel)}</span>
            <span class="tl-mc-chip tl-mc-chip--info">O analista decide neste card</span>
          </div>
          <p class="tl-mc-doc-intro__hint">${escapeHtml(analystHint)}</p>
        </div>
        <div class="tl-mc-doc-controls">
          <button class="tl-mc-btn tl-mc-btn--primary" type="button" data-approve-doc="${escapeHtml(key)}" ${approveDisabled ? "disabled" : ""}>${approvedByAnalyst ? "Documento aprovado" : "Aprovar documento"}</button>
          <button class="tl-mc-icon-btn" type="button" data-open-pendency="${escapeHtml(key)}" ${canValidate ? "" : "disabled"}>Rejeitar</button>
        </div>
        <label class="tl-mc-analyst-observation">
          <span>Observação para o corretor</span>
          <textarea class="tl-mc-textarea" data-doc-observation="${escapeHtml(key)}" ${canValidate ? "" : "disabled"} placeholder="Informe o motivo da rejeição ou o que precisa ser corrigido.">${escapeHtml(pendencia.descricao || "")}</textarea>
        </label>
        <div class="tl-mc-doc-controls">
          <select class="tl-mc-select" data-doc-status="${escapeHtml(key)}">
            ${docStatuses.map(([value, text]) => `<option value="${escapeHtml(value)}" ${status === value ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}
          </select>
          <button class="tl-mc-icon-btn" type="button" data-save-doc="${escapeHtml(key)}" ${canValidate ? "" : "disabled"}>Salvar outro status</button>
        </div>
        ${renderDocumentUploads(processo, key)}
      </article>
    `;
  }
  function renderAnalystStageActions(processo, overview) {
    const actionState = analystActionState(processo, overview);
    if (!overview.analistaLiberado) {
      return '<span class="tl-mc-muted">A validação do analista é liberada assim que o primeiro documento for enviado.</span>';
    }
    if (actionState === "released") {
      return '<span class="tl-mc-chip tl-mc-chip--ok">Validação concluída e kits liberados.</span>';
    }
    if (actionState === "ready") {
      return `
        <div class="tl-mc-stage-buttons">
          <button class="tl-mc-btn tl-mc-btn--soft" type="button" data-role-action="analista-iniciar">Iniciar validação</button>
          <span class="tl-mc-muted">Os itens já enviados podem ser aprovados ou rejeitados agora.</span>
        </div>
      `;
    }
    if (!overview.documentacaoCompleta) {
      return `
        <div class="tl-mc-stage-buttons">
          <span class="tl-mc-chip tl-mc-chip--info">Validação parcial em andamento</span>
          <span class="tl-mc-muted">Aprove ou rejeite os documentos enviados. A liberação dos kits acontece no fechamento do dossiê.</span>
        </div>
      `;
    }
    return `
      <div class="tl-mc-stage-buttons">
        <span class="tl-mc-chip tl-mc-chip--info">Validação em andamento</span>
        <button class="tl-mc-btn tl-mc-btn--primary" type="button" data-role-action="analista-liberar-cca">Concluir validação</button>
      </div>
    `;
  }

  function renderKitLink(label, href, enabled) {
    if (!enabled || !href) {
      return `<span class="tl-mc-icon-btn is-disabled">${escapeHtml(label)}</span>`;
    }
    return `<button class="tl-mc-icon-btn" type="button" data-download-protected="${escapeHtml(href)}" data-download-name="${escapeHtml(buildProtectedFallbackName(label, href))}">${escapeHtml(label)}</button>`;
  }

  function renderKitRequiredData(processo, profileId) {
    const metadata = processo?.kits_documentais?.[profileId]?.metadata || {};
    const requiredFields = Array.isArray(metadata.campos_obrigatorios)
      ? metadata.campos_obrigatorios.filter((item) => item && (item.condicional !== false || item.preenchido))
      : [];
    if (!requiredFields.length) return "";

    return `
      <div class="tl-mc-role-grid tl-mc-role-grid--compact">
        ${requiredFields.map((item) => `
          <article>
            <span>${escapeHtml(item.label || "Campo obrigatorio")}</span>
            <strong>${escapeHtml(item.value || "Pendente")}</strong>
            <small>${escapeHtml(item.preenchido ? "Pronto para o kit" : "Preencher antes de gerar o kit")}</small>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderKitManagement(processo) {
    ensureKitState(processo);
    const visibleProfiles = activeKitProfiles(processo);
    const currentProfile = kitProfileConfig();
    const documents = availableKitDocuments(processo);
    const selectedKeys = new Set(selectedKitKeys());
    const selectedDocs = documents.filter((item) => selectedKeys.has(item.key));
    const readyDocs = selectedDocs.filter((item) => item.hasUploads);
    const totalUploads = readyDocs.reduce((acc, item) => acc + Number(item.uploadCount || 0), 0);

    return `
      <section class="tl-mc-kit-manager">
        <div class="tl-mc-stage-section__head">
          <div>
            <span class="tl-mc-section-title">Gerenciamento de kits</span>
            <p>Caixa, Creditú e AGEHAB são montados como kits completos com base no checklist documental ativo do cliente.</p>
          </div>
          <span class="tl-mc-chip tl-mc-chip--info">${escapeHtml(currentProfile.label)}</span>
        </div>

        <div class="tl-mc-kit-profiles">
          ${visibleProfiles.map((profile) => `
            <button
              class="tl-mc-kit-profile ${profile.id === currentProfile.id ? "is-active" : ""}"
              type="button"
              data-kit-profile="${escapeHtml(profile.id)}"
            >
              <strong>${escapeHtml(profile.label)}</strong>
              <small>${escapeHtml(profile.description)}</small>
            </button>
          `).join("")}
        </div>

        <div class="tl-mc-kit-name">
          <label class="tl-mc-section-title">${escapeHtml(currentProfile.title)}</label>
          <input
            class="tl-mc-input"
            type="text"
            value="${escapeHtml(currentKitName(processo))}"
            data-kit-custom-name
            ${currentProfile.id === "personalizado" ? "" : "readonly"}
          />
          <small>${currentProfile.id === "personalizado"
            ? "Defina um nome livre para o kit."
            : "Modelo pronto. O sistema traz os documentos obrigatórios deste kit e você pode complementar a seleção se precisar."}</small>
        </div>

        <div class="tl-mc-kit-summary">
          <article>
            <span>Documentos selecionados</span>
            <strong>${selectedDocs.length}</strong>
            <small>itens marcados</small>
          </article>
          <article>
            <span>Com anexos</span>
            <strong>${readyDocs.length}</strong>
            <small>prontos para gerar</small>
          </article>
          <article>
            <span>Anexos</span>
            <strong>${totalUploads}</strong>
            <small>arquivos no kit</small>
          </article>
          <article>
            <span>Sem anexos</span>
            <strong>${Math.max(selectedDocs.length - readyDocs.length, 0)}</strong>
            <small>pendentes de complemento</small>
          </article>
        </div>

        ${renderKitRequiredData(processo, currentProfile.id)}

        <div class="tl-mc-kit-toolbar">
          <button class="tl-mc-icon-btn" type="button" data-kit-select="all">Selecionar todos</button>
          <button class="tl-mc-icon-btn" type="button" data-kit-select="uploaded">Somente com anexos</button>
          <button class="tl-mc-icon-btn" type="button" data-kit-select="clear">Limpar seleção</button>
        </div>

        <div class="tl-mc-kit-grid">
          ${documents.map((item) => `
            <button
              class="tl-mc-kit-doc ${selectedKeys.has(item.key) ? "is-selected" : ""} ${item.hasUploads ? "is-ready" : "is-empty"}"
              type="button"
              data-kit-toggle="${escapeHtml(item.key)}"
              aria-pressed="${selectedKeys.has(item.key) ? "true" : "false"}"
            >
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(item.hasUploads ? `${item.uploadCount} anexo(s) disponível(is)` : "Nenhum anexo enviado")}</small>
              <span>${selectedKeys.has(item.key) ? "Selecionado" : "Adicionar"}</span>
            </button>
          `).join("")}
        </div>

        <div class="tl-mc-role-actions">
          <div class="tl-mc-role-actions__group">
            <button class="tl-mc-btn tl-mc-btn--primary" type="button" data-kit-download="pdf" ${readyDocs.length ? "" : "disabled"}>Gerar PDF do kit</button>
            <button class="tl-mc-btn tl-mc-btn--soft" type="button" data-kit-download="zip" ${readyDocs.length ? "" : "disabled"}>Baixar pacote ZIP</button>
          </div>
          <small class="tl-mc-kit-help">O PDF junta somente anexos em PDF. O ZIP leva todos os arquivos selecionados, inclusive imagem.</small>
        </div>
      </section>
    `;
  }

  function renderCcaSection(processo, overview) {
    const reserva = encodeURIComponent(processo.reserva);
    if (!overview.ccaIniciado && !overview.finalizado) {
      return `
        <section class="tl-mc-section tl-mc-stage-section is-locked">
          <div class="tl-mc-stage-section__head">
            <div>
              <span class="tl-mc-section-title">Etapa 3 · Correspondente bancário</span>
              <p>O correspondente recebe os kits somente depois que o analista concluir a validação do cliente.</p>
            </div>
            <span class="tl-mc-chip tl-mc-chip--warn">Aguardando validação</span>
          </div>
          <div class="tl-mc-empty-inline">
            <strong>Kits ainda não liberados</strong>
            <span>Finalize a validação do analista para abrir o dossiê consolidado do cliente.</span>
          </div>
        </section>
      `;
    }

    return `
      <section class="tl-mc-section tl-mc-stage-section">
        <div class="tl-mc-stage-section__head">
          <div>
            <span class="tl-mc-section-title">Etapa 3 · Correspondente bancário</span>
            <p>O correspondente acessa somente os kits prontos da documentação validada.</p>
          </div>
          <span class="tl-mc-chip ${overview.finalizado ? "tl-mc-chip--ok" : "tl-mc-chip--info"}">${escapeHtml(overview.finalizado ? "Concluído" : "Kits liberados")}</span>
        </div>
        <div class="tl-mc-role-grid tl-mc-role-grid--compact">
          <article>
            <span>Status da Caixa</span>
            <strong>${escapeHtml(labelFor(caixaStatuses, processo.caixa))}</strong>
            <small>Somente leitura nesta tela</small>
          </article>
          <article>
            <span>Status da Agehab</span>
            <strong>${escapeHtml(labelFor(agehabStatuses, processo.agehab))}</strong>
            <small>Somente leitura nesta tela</small>
          </article>
          <article>
            <span>Documentos enviados</span>
            <strong>${state.uploads.length}</strong>
            <small>Anexos disponíveis no dossiê</small>
          </article>
          <article>
            <span>SLA</span>
            <strong>${escapeHtml(processo.sla?.elapsed_label || formatElapsed(processo.sla?.elapsed_seconds))}</strong>
            <small>Tempo total do cliente</small>
          </article>
        </div>
        <div class="tl-mc-role-actions__group">
          ${renderKitLink("Dossiê PDF", `${API_BASE}/${reserva}/uploads?merge=1`, state.uploads.length > 0)}
          ${kitProfileVisibility("caixa", processo)
            ? renderKitLink("Kit Caixa", `${API_BASE}/${reserva}/kit-caixa/download`, readyDocumentsForKitProfile("caixa", processo).length > 0)
            : ""}
          ${kitProfileVisibility("agehab", processo)
            ? renderKitLink("Kit AGEHAB", `${API_BASE}/${reserva}/kit-agehab/download`, readyDocumentsForKitProfile("agehab", processo).length > 0)
            : ""}
          ${kitProfileVisibility("creditu", processo)
            ? renderKitLink("Kit Creditú", `${API_BASE}/${reserva}/creditu/download`, readyDocumentsForKitProfile("creditu", processo).length > 0)
            : ""}
        </div>
      </section>
    `;
  }

  function checklistOverview(processo) {
    return buildChecklistOverview(processo);
  }
  function timelineSteps(processo, overview) {
    return [
      {
        number: 1,
        title: "Cadastro",
        subtitle: "Cliente na carteira",
        state: "done",
      },
      {
        number: 2,
        title: "Documentação",
        subtitle: overview.documentacaoCompleta ? "Completa" : `${overview.faltantes.length} falta(m)`,
        state: overview.documentacaoCompleta ? "done" : "current",
      },
      {
        number: 3,
        title: "Análise 7LM",
        subtitle: overview.finalizado || overview.ccaIniciado
          ? "Crédito validado"
          : overview.analistaLiberado
            ? `${overview.enviados.length} documento(s) enviado(s)`
            : "Aguardando primeiro envio",
        state: overview.finalizado || overview.ccaIniciado ? "done" : overview.analistaLiberado ? "current" : "pending",
      },
      {
        number: 4,
        title: "Kits",
        subtitle: overview.ccaIniciado ? labelFor(caixaStatuses, processo.caixa) : "Correspondente",
        state: overview.finalizado ? "done" : overview.ccaIniciado ? "current" : "pending",
      },
      {
        number: 5,
        title: "Conformidade",
        subtitle: overview.finalizado ? "Finalizado" : "Pendente",
        state: overview.finalizado ? "done" : "pending",
      },
    ];
  }

  function renderAnalystStageActions(processo, overview) {
    const actionState = analystActionState(processo, overview);
    if (!overview.analistaLiberado) {
      return '<span class="tl-mc-muted">A validação do analista é liberada assim que o primeiro documento for enviado.</span>';
    }
    if (actionState === "released") {
      return '<span class="tl-mc-chip tl-mc-chip--ok">Validação concluída e kits liberados.</span>';
    }
    if (actionState === "ready") {
      return `
        <div class="tl-mc-stage-buttons">
          <button class="tl-mc-btn tl-mc-btn--soft" type="button" data-role-action="analista-iniciar">Iniciar validação</button>
          <span class="tl-mc-muted">Os itens já enviados podem ser aprovados ou rejeitados agora.</span>
        </div>
      `;
    }
    if (!overview.documentacaoCompleta) {
      return `
        <div class="tl-mc-stage-buttons">
          <span class="tl-mc-chip tl-mc-chip--info">Validação parcial em andamento</span>
          <span class="tl-mc-muted">Aprove ou rejeite os documentos enviados. A liberação dos kits acontece no fechamento do dossiê.</span>
        </div>
      `;
    }
    return `
      <div class="tl-mc-stage-buttons">
        <span class="tl-mc-chip tl-mc-chip--info">Validação em andamento</span>
        <button class="tl-mc-btn tl-mc-btn--primary" type="button" data-role-action="analista-liberar-cca">Concluir validação e liberar kits</button>
      </div>
    `;
  }

  function renderCcaSection(processo, overview) {
    const reserva = encodeURIComponent(processo.reserva);
    if (!overview.ccaIniciado && !overview.finalizado) {
      return `
        <section class="tl-mc-section tl-mc-stage-section is-locked">
          <div class="tl-mc-stage-section__head">
            <div>
              <span class="tl-mc-section-title">Etapa 3 · Correspondente e kits</span>
              <p>Os kits só aparecem depois que o analista concluir a validação do cliente.</p>
            </div>
            <span class="tl-mc-chip tl-mc-chip--warn">Aguardando validação</span>
          </div>
          <div class="tl-mc-empty-inline">
            <strong>Kits ainda não liberados</strong>
            <span>Conclua a etapa do analista para abrir a gestão de kits, Caixa e Agehab.</span>
          </div>
        </section>
      `;
    }

    return `
      <section class="tl-mc-section tl-mc-stage-section">
        <div class="tl-mc-stage-section__head">
          <div>
            <span class="tl-mc-section-title">Etapa 3 · Correspondente e kits</span>
            <p>Monte o kit certo, acompanhe Caixa e Agehab e consolide o envio final do cliente.</p>
          </div>
          <span class="tl-mc-chip ${overview.finalizado ? "tl-mc-chip--ok" : "tl-mc-chip--info"}">${escapeHtml(overview.finalizado ? "Concluído" : "Kits liberados")}</span>
        </div>

        <div class="tl-mc-role-grid tl-mc-role-grid--compact">
          <article>
            <span>Status da Caixa</span>
            <strong>${escapeHtml(labelFor(caixaStatuses, processo.caixa))}</strong>
            <small>Atualize conforme o envio</small>
          </article>
          <article>
            <span>Status da Agehab</span>
            <strong>${escapeHtml(labelFor(agehabStatuses, processo.agehab))}</strong>
            <small>Atualize conforme o envio</small>
          </article>
          <article>
            <span>Documentos enviados</span>
            <strong>${state.uploads.length}</strong>
            <small>Anexos disponíveis no dossiê</small>
          </article>
          <article>
            <span>SLA</span>
            <strong>${escapeHtml(processo.sla?.elapsed_label || formatElapsed(processo.sla?.elapsed_seconds))}</strong>
            <small>Tempo total do cliente</small>
          </article>
        </div>

        <div class="tl-mc-stage-tracks">
          ${renderStageStatusTrack("Caixa", "caixa", processo.caixa, caixaStatuses.slice(2))}
          ${renderStageStatusTrack("Agehab", "agehab", processo.agehab, agehabStatuses.slice(2))}
        </div>

        <div class="tl-mc-role-actions">
          <div class="tl-mc-role-actions__group">
            ${renderKitLink("Dossiê PDF", `${API_BASE}/${reserva}/uploads?merge=1`, state.uploads.length > 0)}
            ${kitProfileVisibility("caixa", processo)
              ? renderKitLink("Kit Caixa", `${API_BASE}/${reserva}/kit-caixa/download`, readyDocumentsForKitProfile("caixa", processo).length > 0)
              : ""}
            ${kitProfileVisibility("agehab", processo)
              ? renderKitLink("Kit AGEHAB", `${API_BASE}/${reserva}/kit-agehab/download`, readyDocumentsForKitProfile("agehab", processo).length > 0)
              : ""}
            ${kitProfileVisibility("creditu", processo)
              ? renderKitLink("Kit Creditú", `${API_BASE}/${reserva}/creditu/download`, readyDocumentsForKitProfile("creditu", processo).length > 0)
              : ""}
          </div>
          <small class="tl-mc-kit-help">Use os atalhos prontos ou monte um kit personalizado com os anexos selecionados.</small>
        </div>

        ${renderKitManagement(processo)}
      </section>
    `;
  }

  function documentWorkspaceRoles(processo, overview) {
    const roles = ["corretor", "analista"];
    if (overview.ccaIniciado || overview.finalizado || state.checklistOrigin === "cca") {
      roles.push("cca");
    }
    return Array.from(new Set(roles));
  }

  function activeDocumentWorkspaceRole(processo, overview) {
    const roles = documentWorkspaceRoles(processo, overview);
    const currentRole = normalizeChecklistOrigin(state.checklistOrigin);
    if (roles.includes(currentRole)) {
      return currentRole;
    }

    const activeTabRole = normalizeChecklistOrigin(state.activeTab);
    if (roles.includes(activeTabRole) && activeTabRole !== "gestor") {
      return activeTabRole;
    }

    if (overview.ccaIniciado || overview.finalizado) {
      return roles.includes("cca") ? "cca" : roles[0];
    }

    if (analysisStarted(processo) || overview.analistaLiberado || activeTabRole === "analista") {
      return "analista";
    }

    return "corretor";
  }

  function documentWorkspaceRoleLabel(role) {
    switch (normalizeChecklistOrigin(role)) {
      case "analista":
        return "Validação do analista";
      case "cca":
        return "Kits do correspondente";
      default:
        return "Documentação do corretor";
    }
  }

  function workflowKitProfiles() {
    return workflowKitProfileIds
      .map((profileId) => kitProfiles.find((profile) => profile.id === profileId))
      .filter(Boolean);
  }

  function activeWorkflowKitProfile() {
    const profiles = workflowKitProfiles();
    if (!profiles.some((profile) => profile.id === state.kitProfile)) {
      state.kitProfile = "caixa";
    }
    return kitProfileConfig(state.kitProfile);
  }

  function workflowKitDocumentKeys(profileId, processo = selectedProcess()) {
    const dynamicKeys = processo?.kits_documentais?.[profileId]?.documento_keys;
    if (programKitProfiles.has(profileId)) {
      return Array.from(new Set((kitProfileConfig(profileId)?.defaultKeys || []).filter(Boolean)));
    }
    if (Array.isArray(dynamicKeys)) {
      return Array.from(new Set(dynamicKeys.filter(Boolean)));
    }
    return Array.from(new Set((kitProfileConfig(profileId)?.defaultKeys || []).filter(Boolean)));
  }

  function workflowKitDocumentDetail(profileId, key) {
    return workflowKitDocumentDetails?.[profileId]?.[key] || {};
  }

  function kitDocumentSectionMeta(item, profileId, index) {
    const key = String(item?.key || "").trim();
    if (item?.sectionKey && item?.sectionLabel) {
      return {
        sectionKey: item.sectionKey,
        sectionLabel: item.sectionLabel,
        sectionOrder: Number.isFinite(Number(item.sectionOrder)) ? Number(item.sectionOrder) : 340 + index,
      };
    }
    const text = normalizeStatusText(`${key} ${item?.label || ""} ${item?.sectionLabel || ""}`);
    if (text.includes("conjuge") || text.includes("segundo-proponente") || text.includes("segundo proponente")) {
      return {
        sectionKey: "conjuge",
        sectionLabel: "Documentos do cônjuge / segundo proponente",
        sectionOrder: 220,
      };
    }
    if (text.includes("dependente")) {
      return {
        sectionKey: "dependentes",
        sectionLabel: "Dependentes e composição familiar",
        sectionOrder: 240,
      };
    }
    if (text.includes("mo da caixa") || text.includes("ficha") || text.includes("damp") || text.includes("cheque especial") || text.includes("cartao credito")) {
      return {
        sectionKey: "formularios-caixa",
        sectionLabel: "Formulários e autorizações Caixa",
        sectionOrder: 320,
      };
    }
    if (text.includes("agehab")) {
      return {
        sectionKey: "agehab",
        sectionLabel: "Documentação AGEHAB",
        sectionOrder: 360,
      };
    }
    if (text.includes("creditu") || text.includes("sicaq") || text.includes("score")) {
      return {
        sectionKey: "creditu",
        sectionLabel: "Documentação Creditú",
        sectionOrder: 340,
      };
    }
    if (
      text.includes("proponente")
      || text.includes("renda")
      || text.includes("fgts")
      || text.includes("ctps")
      || text.includes("irpf")
      || text.includes("aposentad")
      || text.includes("domestic")
      || text.includes("inss")
      || text.includes("contracheque")
      || text.includes("extrato bancario")
      || text.includes("residencia")
      || text.includes("estado civil")
      || text.includes("identidade")
      || text.includes("cpf")
      || text.includes("cnh")
    ) {
      return {
        sectionKey: "documentos-pessoais",
        sectionLabel: "Documentos pessoais e renda do cliente",
        sectionOrder: 200,
      };
    }
    return {
      sectionKey: item?.sectionKey || profileId,
      sectionLabel: item?.sectionLabel || kitProfileConfig(profileId).label,
      sectionOrder: Number.isFinite(Number(item?.sectionOrder)) ? Number(item.sectionOrder) : 400 + index,
    };
  }

  function isKitMessageInfoItem(item) {
    const type = normalizeStatusText(item?.inputType || item?.kind || item?.documentType || "");
    return type.includes("message") || type.includes("mensagem") || type.includes("informacao");
  }

  function kitInfoMessageTitle(item) {
    return String(item?.messageTitle || item?.label || "Informações do kit").trim();
  }

  function kitInfoMessagesForItem(item) {
    const title = kitInfoMessageTitle(item);
    const key = String(item?.key || "").trim();
    return (state.messages || []).filter((message) => {
      const text = String(message?.message || "");
      return (title && text.includes(title)) || (key && text.includes(key));
    });
  }

  function workflowKitDocuments(processo, profileId) {
    const mappedDocuments = checklistDocMap(processo);
    return workflowKitDocumentKeys(profileId, processo).map((key, index) => {
      const mapped = mappedDocuments.get(key);
      const detail = workflowKitDocumentDetail(profileId, key);
      const label = detail.label || mapped?.label || fallbackDocumentLabel(key);
      const status = mapped?.status || processo?.documentos?.[key] || (uploadCountForDocumentPrefix(processo, key) > 0 ? "Pendente Validacao Analista" : "Aguardando");
      const sectionMeta = kitDocumentSectionMeta({ ...mapped, ...detail, key, label }, profileId, index);
      const item = {
        key,
        label,
        sectionKey: sectionMeta.sectionKey,
        sectionLabel: sectionMeta.sectionLabel,
        sectionOrder: sectionMeta.sectionOrder,
        helper: detail.helper || mapped?.helper || "",
        ruleLabel: detail.ruleLabel || mapped?.ruleLabel || "",
        personName: detail.personName || mapped?.personName || "",
        inputType: detail.inputType || detail.kind || mapped?.inputType || mapped?.kind || "document",
        messageTitle: detail.messageTitle || mapped?.messageTitle || "",
        messagePlaceholder: detail.messagePlaceholder || mapped?.messagePlaceholder || "",
        messageFields: Array.isArray(detail.messageFields) ? detail.messageFields : (Array.isArray(mapped?.messageFields) ? mapped.messageFields : []),
        kits: Array.isArray(mapped?.kits) ? mapped.kits : [profileId],
        status,
        uploadCount: uploadCountForDocumentPrefix(processo, key),
        conditional: Boolean(detail.conditional || mapped?.conditional),
      };
      const infoItem = isKitMessageInfoItem(item);
      const hasInfoMessage = infoItem && kitInfoMessagesForItem(item).length > 0;
      return {
        ...item,
        state: infoItem ? (hasInfoMessage ? "done" : "info") : documentState(processo, key, item),
      };
    });
  }

  function groupedKitDocuments(documents) {
    const groups = [];
    const byKey = new Map();
    documents.forEach((item, index) => {
      const sectionKey = item.sectionKey || "geral";
      if (!byKey.has(sectionKey)) {
        const group = {
          key: sectionKey,
          label: item.sectionLabel || "Documentos do kit",
          order: Number.isFinite(Number(item.sectionOrder)) ? Number(item.sectionOrder) : 900 + index,
          items: [],
        };
        byKey.set(sectionKey, group);
        groups.push(group);
      }
      byKey.get(sectionKey).items.push(item);
    });
    return groups.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "pt-BR"));
  }

  function kitDocumentGroupOverview(items = []) {
    const countableItems = items.filter((item) => !isKitMessageInfoItem(item));
    const total = countableItems.length;
    const enviados = countableItems.filter((item) => Number(item.uploadCount || 0) > 0).length;
    const aprovados = countableItems.filter((item) => item.state === "done").length;
    const pendenteEnvio = countableItems.filter((item) => item.state === "missing").length;
    const rejeitados = countableItems.filter((item) => item.state === "pending" && isRejectedDocument(item.status)).length;
    const emAnalise = countableItems.filter((item) => (
      item.state === "pending"
      && !isRejectedDocument(item.status)
      && (isAwaitingAnalystValidation(item.status) || Number(item.uploadCount || 0) > 0)
    )).length;
    return {
      total,
      enviados,
      aprovados,
      pendenteEnvio,
      rejeitados,
      emAnalise,
      percentualEnviado: total ? Math.round((enviados / total) * 100) : 0,
      percentualAprovado: total ? Math.round((aprovados / total) * 100) : 0,
    };
  }

  function renderKitDocumentRow(processo, item, role) {
    const isAnalyst = role === "analista";
    const isInfoItem = isKitMessageInfoItem(item);
    const key = String(item.key || "").trim();
    const uploads = uploadsForDocument(key, processo);
    const pendencia = documentPendency(processo, key);
    const helperText = pendencia.descricao || item.helper || (uploads.length ? `${uploads.length} arquivo(s) enviado(s).` : "Aguardando envio do corretor.");
    if (isInfoItem) {
      const infoMessages = kitInfoMessagesForItem(item);
      const hasMessage = infoMessages.length > 0;
      const infoTitle = item.label || documentLabel(key, processo);
      return `
        <tr class="is-info ${hasMessage ? "is-done" : ""} tl-mc-kit-info-row">
          <td colspan="5" data-label="Informações">
            <section class="tl-mc-kit-info-panel">
              <div class="tl-mc-kit-info-panel__summary">
                <span class="tl-mc-kit-info-panel__eyebrow">Informação do kit</span>
                <strong>${escapeHtml(infoTitle)}</strong>
                <small>${escapeHtml(helperText)}</small>
                <div class="tl-mc-kit-info-panel__meta">
                  ${renderDocumentMeta(item)}
                  <span class="tl-mc-doc-badge ${hasMessage ? "is-done" : "is-info"}">${escapeHtml(hasMessage ? "Informado" : "Pendente de informação")}</span>
                </div>
                ${renderKitInfoTimeline(hasMessage)}
              </div>
              <div class="tl-mc-kit-info-panel__body">
                <div class="tl-mc-kit-info-panel__history">
                  ${renderKitInfoMessageCell(item, infoMessages)}
                </div>
                <div class="tl-mc-kit-info-panel__form">
                  ${isAnalyst ? renderKitInfoMessageReadOnly(item, infoMessages) : renderKitInfoMessageForm(item)}
                </div>
              </div>
            </section>
          </td>
        </tr>
      `;
    }
    return `
      <tr class="is-${item.state}">
        <td data-label="Documento">
          <div class="tl-mc-kit-doc-namebar">
            <span>Documento</span>
            <strong>${escapeHtml(item.label || documentLabel(key, processo))}</strong>
          </div>
          <small>${escapeHtml(helperText)}</small>
          ${renderDocumentMeta(item)}
        </td>
        <td data-label="Linha do tempo">${renderKitDocumentTimeline(item, uploads)}</td>
        <td data-label="Status">
          <span class="tl-mc-doc-badge is-${item.state}">${escapeHtml(documentStatusLabel(item.state, item.status))}</span>
          <small>${escapeHtml(documentStatusText(item.status || "Aguardando"))}</small>
        </td>
        <td data-label="Anexos">${renderKitAttachmentCell(processo, key, uploads)}</td>
        <td data-label="${isAnalyst ? "Validação do analista" : "Envio do corretor"}">${isAnalyst ? renderAnalistaKitTableAction(processo, item, uploads) : renderCorretorKitTableAction(processo, item, uploads)}</td>
      </tr>
    `;
  }

  function renderKitInfoTimeline(hasMessage) {
    return `
      <div class="tl-mc-kit-row-timeline tl-mc-kit-row-timeline--info" aria-label="Linha do tempo da informação">
        <span class="${hasMessage ? "is-done" : "is-current"}">Mensagem</span>
        <span class="${hasMessage ? "is-current" : "is-pending"}">Equipe</span>
        <span class="is-pending">Kit</span>
      </div>
    `;
  }

  function renderKitInfoMessageCell(item, messages = []) {
    if (!messages.length) {
      return `
        <div class="tl-mc-kit-info-history is-empty">
          <strong>Nenhuma informação registrada</strong>
          <small>Use o campo ao lado para incluir os dados do associado nas mensagens.</small>
        </div>
      `;
    }
    return `
      <div class="tl-mc-kit-info-history">
        <strong>${escapeHtml(`${messages.length} ${messages.length === 1 ? "mensagem registrada" : "mensagens registradas"}`)}</strong>
        ${messages.slice(0, 2).map((message) => `
          <article>
            <span>${escapeHtml(message.author_name || "Usuário")}</span>
            <small>${escapeHtml(formatDate(message.created_at))}</small>
            <p>${escapeHtml(String(message.message || "").replace(kitInfoMessageTitle(item), "").trim() || message.message || "")}</p>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderKitInfoMessageReadOnly(item, messages = []) {
    return `
      <div class="tl-mc-kit-info-card tl-mc-kit-info-card--readonly">
        <strong>Informações nas mensagens</strong>
        <small>${escapeHtml(messages.length ? "O analista consulta os dados registrados pelo corretor." : "Ainda não há mensagem registrada para este item.")}</small>
      </div>
    `;
  }

  function renderKitInfoField(field) {
    const name = `info_${field.name || ""}`;
    const label = field.label || field.name || "Campo";
    const type = field.type || "text";
    if (type === "select") {
      const options = Array.isArray(field.options) ? field.options : [];
      return `
        <label class="tl-mc-kit-info-field">
          <span>${escapeHtml(label)}</span>
          <select name="${escapeHtml(name)}">
            ${options.map(([value, text]) => `<option value="${escapeHtml(value)}">${escapeHtml(text)}</option>`).join("")}
          </select>
        </label>
      `;
    }
    if (type === "textarea") {
      return `
        <label class="tl-mc-kit-info-field tl-mc-kit-info-field--wide">
          <span>${escapeHtml(label)}</span>
          <textarea name="${escapeHtml(name)}" placeholder="${escapeHtml(field.placeholder || "")}"></textarea>
        </label>
      `;
    }
    return `
      <label class="tl-mc-kit-info-field">
        <span>${escapeHtml(label)}</span>
        <input type="${escapeHtml(type)}" name="${escapeHtml(name)}" placeholder="${escapeHtml(field.placeholder || "")}" />
      </label>
    `;
  }

  function renderKitInfoStructuredForm(item, title) {
    const fields = Array.isArray(item.messageFields) ? item.messageFields : [];
    return `
      <div class="tl-mc-kit-info-grid">
        ${fields.map(renderKitInfoField).join("")}
      </div>
      <button class="tl-mc-action-pill tl-mc-action-pill--send" type="submit">Salvar informações</button>
    `;
  }

  function renderKitInfoMessageForm(item) {
    const title = kitInfoMessageTitle(item);
    const hasStructuredFields = Array.isArray(item.messageFields) && item.messageFields.length > 0;
    return `
      <form class="tl-mc-kit-info-card" data-message-form data-kit-info-key="${escapeHtml(item.key || "")}" data-kit-info-title="${escapeHtml(title)}" ${hasStructuredFields ? "data-kit-info-structured=\"1\"" : ""}>
        <input type="hidden" name="targetRole" value="todos" />
        <div class="tl-mc-kit-info-card__head">
          <strong>${escapeHtml(hasStructuredFields ? "Dados do fiador / 2º participante" : "Registrar informações")}</strong>
          <small>${escapeHtml(hasStructuredFields ? "Preencha os campos e salve nas mensagens do cliente." : "Vai para as mensagens do cliente, sem anexo.")}</small>
        </div>
        ${hasStructuredFields
          ? renderKitInfoStructuredForm(item, title)
          : `
            <textarea class="tl-mc-textarea" name="message" placeholder="${escapeHtml(item.messagePlaceholder || "Informe os dados necessários para o kit.")}"></textarea>
            <button class="tl-mc-action-pill tl-mc-action-pill--send" type="submit">Salvar mensagem</button>
          `}
      </form>
    `;
  }

  function workflowKitOverview(processo, profileId) {
    const documentos = workflowKitDocuments(processo, profileId);
    const countableDocuments = documentos.filter((item) => !isKitMessageInfoItem(item));
    const total = countableDocuments.length;
    const concluidos = countableDocuments.filter((item) => item.state === "done").length;
    const pendentes = countableDocuments.filter((item) => item.state === "pending").length;
    const faltantes = countableDocuments.filter((item) => item.state === "missing").length;
    const enviados = countableDocuments.filter((item) => Number(item.uploadCount || 0) > 0).length;
    return {
      documentos,
      total,
      concluidos,
      pendentes,
      faltantes,
      enviados,
      progresso: total ? Math.round((concluidos / total) * 100) : 0,
    };
  }

  function renderWorkflowKitTabs(processo) {
    const activeProfile = activeWorkflowKitProfile();
    return `
      <section class="tl-mc-section tl-mc-kit-workspace">
        <div class="tl-mc-stage-section__head">
          <div>
            <span class="tl-mc-section-title">Kits documentais</span>
            <p>Escolha o kit e abra a categoria para enviar ou validar documentos.</p>
          </div>
          <span class="tl-mc-chip tl-mc-chip--info">${escapeHtml(activeProfile.label)}</span>
        </div>
        <div class="tl-mc-kit-workspace__tabs" aria-label="Selecionar kit documental">
          ${workflowKitProfiles().map((profile) => {
            const profileOverview = workflowKitOverview(processo, profile.id);
            return `
              <button
                class="tl-mc-kit-workspace__tab ${profile.id === activeProfile.id ? "is-active" : ""}"
                type="button"
                data-kit-profile="${escapeHtml(profile.id)}"
              >
                <strong>${escapeHtml(profile.label)}</strong>
                <small>${escapeHtml(`${profileOverview.concluidos}/${profileOverview.total} aprovado(s) · ${profileOverview.faltantes + profileOverview.pendentes} pendente(s)`)}</small>
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderKitDocumentTimeline(item, uploads) {
    const sent = uploads.length > 0;
    const approved = item.state === "done";
    const rejected = isRejectedDocument(item.status);
    return `
      <div class="tl-mc-kit-row-timeline" aria-label="Linha do tempo do documento">
        <span class="${sent ? "is-done" : "is-current"}">Envio</span>
        <span class="${approved ? "is-done" : sent ? "is-current" : "is-pending"}">Validação</span>
        <span class="${approved ? "is-done" : rejected ? "is-blocked" : "is-pending"}">Kit</span>
      </div>
    `;
  }

  function renderCorretorKitTableAction(processo, item, uploads) {
    const key = String(item.key || "").trim();
    const label = item.label || documentLabel(key, processo);
    const status = item?.status || processo.documentos?.[key] || "Aguardando";
    const awaitingValidation = isAwaitingAnalystValidation(status);
    const notApplicableRequested = isNotApplicableRequest(processo, key, status);
    const notApplicableDone = normalizeStatusText(status).includes("nao se aplica");
    const cannotRequestNotApplicable = awaitingValidation || notApplicableDone || item.state === "done";
    return `
      <div class="tl-mc-kit-upload-card" data-upload-scope data-upload-document="${escapeHtml(label)}">
        <div class="tl-mc-kit-upload-card__head">
          <strong>Enviar documento</strong>
          <small>${escapeHtml(uploads.length ? "Complementar este item com novos arquivos." : "Escolha um ou mais arquivos para este documento.")}</small>
        </div>
        <label class="tl-mc-doc-picker tl-mc-doc-picker--table">
          <input type="file" multiple data-upload-file aria-label="Anexos do documento ${escapeHtml(label)}" />
          <span class="tl-mc-doc-picker__button">Selecionar arquivos</span>
          <span class="tl-mc-doc-picker__summary" data-upload-summary data-has-files="false">Nenhum arquivo selecionado</span>
          <span class="tl-mc-doc-picker__hint">${escapeHtml(uploads.length ? "Os anexos atuais continuam listados na coluna ao lado." : "Depois do envio, o analista poderá validar.")}</span>
        </label>
        <div class="tl-mc-kit-upload-card__actions">
          <button class="tl-mc-action-pill tl-mc-action-pill--send tl-mc-doc-upload__submit" type="button" data-upload-submit="${escapeHtml(key)}" data-upload-group="corretor" disabled>Enviar</button>
          <button class="tl-mc-action-pill tl-mc-action-pill--na" type="button" data-request-na-doc="${escapeHtml(key)}" ${cannotRequestNotApplicable ? "disabled" : ""}>${notApplicableRequested ? "Em validação" : "Não se aplica"}</button>
        </div>
        <small class="tl-mc-kit-upload-card__note">${escapeHtml(notApplicableRequested ? "O analista vai validar se este item realmente não se aplica." : "Use quando este documento não for obrigatório para o cliente.")}</small>
      </div>
    `;
  }

  function renderAnalistaKitTableAction(processo, item, uploads) {
    const key = String(item.key || "").trim();
    const status = item?.status || processo.documentos?.[key] || "Aguardando";
    const pendencia = documentPendency(processo, key);
    const normalizedStatus = normalizeStatusText(status);
    const approvedByAnalyst = normalizedStatus.includes("aprov");
    const notApplicableRequest = isNotApplicableRequest(processo, key, status);
    const canValidate = uploads.length > 0 || notApplicableRequest;
    const approveStatus = notApplicableRequest ? "Não se Aplica" : "Aprovado";
    const approveLabel = approvedByAnalyst
      ? "Aprovado"
      : notApplicableRequest
        ? "Aprovar não se aplica"
        : "Aprovar";
    return `
      <div class="tl-mc-kit-table-action">
        <div class="tl-mc-kit-table-action__buttons">
          <button class="tl-mc-action-pill tl-mc-action-pill--approve" type="button" data-approve-doc="${escapeHtml(key)}" data-approve-status="${escapeHtml(approveStatus)}" ${!canValidate || approvedByAnalyst ? "disabled" : ""}>${escapeHtml(approveLabel)}</button>
          <button class="tl-mc-action-pill tl-mc-action-pill--reject" type="button" data-open-pendency="${escapeHtml(key)}" ${canValidate ? "" : "disabled"}>Rejeitar</button>
        </div>
        <div class="tl-mc-kit-table-action__status">
          <select class="tl-mc-select" data-doc-status="${escapeHtml(key)}">
            ${docStatuses.map(([value, text]) => `<option value="${escapeHtml(value)}" ${status === value ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}
          </select>
          <button class="tl-mc-action-pill tl-mc-action-pill--neutral" type="button" data-save-doc="${escapeHtml(key)}" ${canValidate ? "" : "disabled"}>Salvar</button>
        </div>
        <label class="tl-mc-analyst-observation tl-mc-analyst-observation--table">
          <span>Observação para o corretor</span>
          <textarea class="tl-mc-textarea" data-doc-observation="${escapeHtml(key)}" ${canValidate ? "" : "disabled"} placeholder="Descreva o motivo da rejeição ou o ajuste necessário.">${escapeHtml(pendencia.descricao || "")}</textarea>
        </label>
      </div>
    `;
  }

  function renderKitDocumentsTable(processo, documents, role) {
    const isAnalyst = role === "analista";
    const groups = groupedKitDocuments(documents);
    return `
      <div class="tl-mc-kit-doc-accordion">
        ${groups.map((group) => {
          const overview = kitDocumentGroupOverview(group.items);
          return `
            <details class="tl-mc-kit-doc-group">
              <summary class="tl-mc-kit-doc-group__summary" data-kit-doc-group-toggle>
                <span class="tl-mc-kit-doc-group__title">
                  <span class="tl-mc-kit-doc-group__toggle" aria-hidden="true"></span>
                  <span>
                    <strong>${escapeHtml(group.label)}</strong>
                    <small>${escapeHtml(`${group.items.length} ${group.items.length === 1 ? "item" : "itens"} nesta categoria`)}</small>
                  </span>
                </span>
                <span class="tl-mc-kit-doc-group__meter" aria-label="${escapeHtml(`${overview.percentualEnviado}% enviado`)}">
                  <span style="width:${Math.max(0, Math.min(100, overview.percentualEnviado))}%"></span>
                </span>
                <span class="tl-mc-kit-doc-group__stats">
                  <span><strong>${overview.percentualEnviado}%</strong> enviado</span>
                  <span><strong>${overview.emAnalise}</strong> em análise</span>
                  <span><strong>${overview.aprovados}</strong> aprovado(s)</span>
                  <span><strong>${overview.pendenteEnvio}</strong> pendente envio</span>
                  ${overview.rejeitados ? `<span class="is-alert"><strong>${overview.rejeitados}</strong> rejeitado(s)</span>` : ""}
                </span>
              </summary>
              <div class="tl-mc-kit-doc-table-wrap">
                <table class="tl-mc-kit-doc-table">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Linha do tempo</th>
                      <th>Status</th>
                      <th>Anexos</th>
                      <th>${isAnalyst ? "Validação do analista" : "Envio do corretor"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${group.items.map((item) => renderKitDocumentRow(processo, item, role)).join("")}
                  </tbody>
                </table>
              </div>
            </details>
          `;
        }).join("")}
      </div>
    `;
  }

  function profileStateRequiresSpouse(value) {
    const normalized = normalizeStatusText(value);
    return normalized.includes("casad") || (normalized.includes("uniao") && normalized.includes("estavel"));
  }

  function familyRelationKind(value) {
    const normalized = normalizeStatusText(value);
    if (normalized.includes("conjuge") || normalized.includes("companheir") || normalized.includes("espos")) return "conjuge";
    if (normalized.includes("socio")) return "socio";
    if (normalized.includes("filh") || normalized.includes("entead")) return "filho";
    return normalized || "outro";
  }

  function profileValue(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
  }

  function profileDateValue(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return text.split("T", 1)[0].split(" ", 1)[0];
  }

  function profileDocumentConfig(processo) {
    const config = processo?.perfil_documental_config || {};
    const cliente = processo?.cliente_cadastro || {};
    const perfilCliente = processo?.perfil_documental?.cliente || {};
    const members = Array.isArray(processo?.composicao_familiar) ? processo.composicao_familiar : [];
    const spouseMember = members.find((item) => familyRelationKind(item?.parentesco) === "conjuge") || {};
    const dependentMembers = members.filter((item) => !["conjuge", "socio"].includes(familyRelationKind(item?.parentesco)));
    const conjuge = config.conjuge && typeof config.conjuge === "object" ? config.conjuge : {};
    return {
      estado_civil: profileValue(config.estado_civil, cliente.estado_civil, perfilCliente.estado_civil),
      renda_conjuge: profileValue(config.renda_conjuge, cliente.renda_conjuge, perfilCliente.renda_conjuge),
      conjuge: {
        nome: profileValue(conjuge.nome, conjuge.nome_completo, spouseMember.nome_completo, spouseMember.nome),
        cpf: profileValue(conjuge.cpf, spouseMember.cpf),
        estado_civil: profileValue(conjuge.estado_civil, spouseMember.estado_civil),
        renda_total: profileValue(conjuge.renda_total, conjuge.renda_mensal, spouseMember.renda_total, spouseMember.renda_mensal),
      },
      dependentes: Array.isArray(config.dependentes) && config.dependentes.length ? config.dependentes : dependentMembers,
    };
  }

  function renderProfileStateOptions(value) {
    const options = [
      ["", "Não informado"],
      ["Solteiro", "Solteiro"],
      ["Casado", "Casado"],
      ["União Estável", "União estável"],
      ["Divorciado", "Divorciado"],
    ];
    return options.map(([optionValue, label]) => (
      `<option value="${escapeHtml(optionValue)}" ${String(value || "") === optionValue ? "selected" : ""}>${escapeHtml(label)}</option>`
    )).join("");
  }

  function renderDependentRelationOptions(value) {
    const options = [
      ["Filho", "Filho(a)"],
      ["Enteado", "Enteado(a)"],
      ["Pai", "Pai/Mãe"],
      ["Irmão", "Irmão(ã)"],
      ["Tio", "Parente até 3º grau"],
      ["Primo", "Parente até 4º grau"],
    ];
    return options.map(([optionValue, label]) => (
      `<option value="${escapeHtml(optionValue)}" ${String(value || "") === optionValue ? "selected" : ""}>${escapeHtml(label)}</option>`
    )).join("");
  }

  function renderPerfilDependenteRow(dependente = {}, index = 0) {
    const nome = profileValue(dependente.nome, dependente.nome_completo);
    const nascimento = profileDateValue(dependente.data_nascimento);
    const parentesco = profileValue(dependente.parentesco, "Filho");
    const estadoCivil = profileValue(dependente.estado_civil);
    const renda = profileValue(dependente.renda_total, dependente.renda_mensal, dependente.renda);
    return `
      <div class="tl-mc-profile-dependent" data-profile-dependent-row>
        <label>
          <span>Nome do dependente</span>
          <input class="tl-mc-input" type="text" data-profile-dependent="nome" value="${escapeHtml(nome)}" placeholder="Nome completo" />
        </label>
        <label>
          <span>Parentesco</span>
          <select class="tl-mc-select" data-profile-dependent="parentesco">
            ${renderDependentRelationOptions(parentesco)}
          </select>
        </label>
        <label>
          <span>Data de nascimento</span>
          <input class="tl-mc-input" type="date" data-profile-dependent="data_nascimento" value="${escapeHtml(nascimento)}" />
        </label>
        <label>
          <span>Estado civil</span>
          <select class="tl-mc-select" data-profile-dependent="estado_civil">
            ${renderProfileStateOptions(estadoCivil)}
          </select>
        </label>
        <label>
          <span>Renda do dependente</span>
          <input class="tl-mc-input" type="number" min="0" step="0.01" data-profile-dependent="renda_total" value="${escapeHtml(renda)}" placeholder="0,00" />
        </label>
        <button class="tl-mc-action-pill tl-mc-action-pill--neutral" type="button" data-profile-dependent-remove>Remover</button>
      </div>
    `;
  }

  function renderPerfilDocumentalEditor(processo) {
    return "";
  }

  function renderDocumentWorkspaceTabs(processo, overview) {
    const roles = documentWorkspaceRoles(processo, overview);
    const activeRole = activeDocumentWorkspaceRole(processo, overview);
    return `
      <section class="tl-mc-section tl-mc-stage-section tl-mc-stage-section--switcher">
        <div class="tl-mc-stage-section__head">
          <div>
            <span class="tl-mc-section-title">Controle da documentação</span>
            <p>Use a visão de envio do corretor ou validação do analista.</p>
          </div>
          <div class="tl-mc-role-switch" aria-label="Alternar etapa da documentação">
            ${roles.map((role) => `
              <button class="tl-mc-role-chip ${role === activeRole ? "is-active" : ""}" type="button" data-checklist-origin="${role}">
                ${escapeHtml(documentWorkspaceRoleLabel(role))}
              </button>
            `).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderCorretorStageSection(processo, overview) {
    const activeProfile = activeWorkflowKitProfile();
    const kitOverview = workflowKitOverview(processo, activeProfile.id);
    return `
      <section class="tl-mc-section tl-mc-stage-section">
        <div class="tl-mc-stage-section__head">
          <div>
            <span class="tl-mc-section-title">Etapa 1 · Envio do corretor</span>
            <p>O corretor sobe os arquivos do ${escapeHtml(activeProfile.label)} e acompanha o que ainda falta.</p>
          </div>
          <span class="tl-mc-chip ${kitOverview.faltantes + kitOverview.pendentes ? "tl-mc-chip--warn" : "tl-mc-chip--ok"}">${escapeHtml(`${kitOverview.concluidos}/${kitOverview.total} aprovado(s)`)}</span>
        </div>
        ${renderKitDocumentsTable(processo, kitOverview.documentos, "corretor")}
      </section>
    `;
  }

  function renderAnalistaStageSection(processo, overview) {
    const actionState = analystActionState(processo, overview);
    const activeProfile = activeWorkflowKitProfile();
    const kitOverview = workflowKitOverview(processo, activeProfile.id);
    return `
      <section class="tl-mc-section tl-mc-stage-section ${overview.analistaLiberado ? "" : "is-locked"}">
        <div class="tl-mc-stage-section__head">
          <div>
            <span class="tl-mc-section-title">Etapa 2 · Validação do analista</span>
            <p>O analista valida cada documento do ${escapeHtml(activeProfile.label)} ou registra pendência para o corretor reenviar.</p>
          </div>
          <span class="tl-mc-chip ${actionState === "released" ? "tl-mc-chip--ok" : actionState === "in_progress" ? "tl-mc-chip--info" : overview.analistaLiberado ? "tl-mc-chip--warn" : "tl-mc-chip--danger"}">${escapeHtml(actionState === "released" ? "Validação concluída" : actionState === "in_progress" ? `${kitOverview.concluidos}/${kitOverview.total} validado(s)` : overview.analistaLiberado ? "Pronto para validar" : "Aguardando primeiro envio")}</span>
        </div>
        <div class="tl-mc-stage-buttons">
          ${renderAnalystStageActions(processo, overview)}
        </div>
        ${overview.analistaLiberado ? `
          ${renderKitDocumentsTable(processo, kitOverview.documentos, "analista")}
        ` : `
          <div class="tl-mc-empty-inline">
            <strong>Validação bloqueada</strong>
            <span>Assim que o corretor enviar o primeiro documento, esta etapa é liberada para análise item a item.</span>
          </div>
        `}
      </section>
    `;
  }

  function renderClientModalBody(processo, overview) {
    const activeRole = activeDocumentWorkspaceRole(processo, overview);
    const activeSection = activeRole === "analista"
      ? renderAnalistaStageSection(processo, overview)
      : activeRole === "cca"
        ? renderCcaSection(processo, overview)
        : renderCorretorStageSection(processo, overview);
    return `
      <div class="tl-mc-client-workflow tl-mc-client-workflow--modal tl-mc-client-workflow--documents">
        ${renderTimeline(processo, overview, true)}
        ${renderDocumentWorkspaceTabs(processo, overview)}
        ${renderWorkflowKitTabs(processo)}
        ${activeSection}

        <section class="tl-mc-section">
          <div class="tl-mc-stage-section__head">
            <div>
              <span class="tl-mc-section-title">Comunicação interna</span>
              <p>Recados rápidos entre corretor, analista e correspondente dentro do cliente.</p>
            </div>
          </div>
          <div class="tl-mc-message-list" data-message-list>
            ${renderMessages()}
          </div>
          <form class="tl-mc-inline-form" data-message-form>
            <textarea class="tl-mc-textarea" name="message" placeholder="Adicionar mensagem para a equipe"></textarea>
            <div class="tl-mc-inline-actions">
              <select class="tl-mc-select" name="targetRole">
                <option value="todos">Todos</option>
                <option value="corretor">Corretor</option>
                <option value="analista">Analista de crédito</option>
                <option value="cca">Correspondente</option>
                <option value="gestor">Gestor</option>
              </select>
              <button class="tl-mc-btn tl-mc-btn--primary" type="submit">Enviar mensagem</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  function renderClientWorkspace(processo, overview) {
    const activeView = normalizeClientJourneyView(state.clientJourneyView);
    const isDocumentsView = activeView === "documentos";
    const isSaleView = activeView === "venda";
    const isRelationshipView = activeView === "relacionamento";
    const viewMeta = clientJourneyViewMeta();
    return `
      <div class="tl-mc-client-workflow tl-mc-client-workflow--page" data-client-workflow-page>
        <div class="tl-mc-flow-head tl-mc-flow-head--workspace">
          <div class="tl-mc-flow-head__meta">
            <span class="tl-mc-detail-kicker">Jornada do cliente</span>
            <h3>${escapeHtml(processo.cliente || "Cliente")}</h3>
            <p>${escapeHtml(clientJourneySubtitle(processo))}</p>
          </div>
          <div class="tl-mc-flow-actions">
            <div class="tl-mc-role-switch" aria-label="Alternar visão do cliente">
              <button class="tl-mc-role-chip ${isDocumentsView ? "is-active" : ""}" type="button" data-client-view-tab="documentos">
                Documentação
              </button>
              <button class="tl-mc-role-chip ${isSaleView ? "is-active" : ""}" type="button" data-client-view-tab="venda">
                Venda completa
              </button>
              <button class="tl-mc-role-chip ${isRelationshipView ? "is-active" : ""}" type="button" data-client-view-tab="relacionamento">
                Relacionamento
              </button>
            </div>
            <span class="tl-mc-current-stage">${escapeHtml(overview.etapaAtual)}</span>
            <button class="tl-mc-btn tl-mc-btn--soft" type="button" data-back-clients>Voltar à carteira</button>
          </div>
        </div>

        ${isSaleView
          ? renderClientSaleWorkspace(processo, overview)
          : isRelationshipView
            ? renderClientRelationshipWorkspace(processo, overview)
            : renderClientModalBody(processo, overview)}
      </div>
    `;
  }

  function renderClientModal() {
    const processo = selectedProcess();
    if (!processo) return;
    const overview = checklistOverview(processo);
    els.content.innerHTML = renderClientWorkspace(processo, overview);
  }

  function closeClientModal() {
    return;
  }

  function renderDetail() {
    els.detail.innerHTML = `
      <div class="tl-mc-empty-detail">
        <strong>Detalhamento do cliente</strong>
        <span>Abra um cliente na lista para acompanhar documentos, validação, kits e dados completos da venda.</span>
      </div>
    `;
  }

  function documentLabel(key, processo = selectedProcess()) {
    const dynamic = processo ? checklistDocMap(processo).get(key) : null;
    if (dynamic?.label) return dynamic.label;
    return fallbackDocumentLabel(key);
  }

  function kitProfileConfig(profileId = state.kitProfile) {
    return kitProfiles.find((item) => item.id === profileId) || kitProfiles[0];
  }

  function defaultKitDocumentKeys(profileId, processo = selectedProcess()) {
    const dynamicKeys = processo?.kits_documentais?.[profileId]?.documento_keys;
    if (programKitProfiles.has(profileId)) {
      return Array.from(new Set((kitProfileConfig(profileId)?.defaultKeys || []).filter(Boolean)));
    }
    if (Array.isArray(dynamicKeys)) {
      return Array.from(new Set(dynamicKeys.filter(Boolean)));
    }
    return Array.from(new Set((kitProfileConfig(profileId)?.defaultKeys || []).filter(Boolean)));
  }

  function kitProfileVisibility(profileId, processo = selectedProcess()) {
    if (programKitProfiles.has(profileId)) return true;
    return true;
  }

  function activeKitProfiles(processo = selectedProcess()) {
    return kitProfiles.filter((profile) => kitProfileVisibility(profile.id, processo));
  }

  function uploadCountForDocumentPrefix(processo, prefix) {
    const normalizedPrefix = String(prefix || "").trim();
    if (!normalizedPrefix) return 0;
    return allUploadsForProcess(processo).filter((item) => String(item?.key || "").startsWith(normalizedPrefix)).length;
  }

  function availableKitDocuments(processo = selectedProcess()) {
    const baseDocuments = checklistDocuments(processo || {}).map((item) => {
      const uploadCount = uploadCountForDocumentPrefix(processo, item.key);
      return {
        key: item.key,
        label: item.label,
        sectionKey: item.sectionKey || "geral",
        sectionLabel: item.sectionLabel || "Checklist documental",
        uploadCount,
        hasUploads: uploadCount > 0,
      };
    });

    const baseKeys = new Set(baseDocuments.map((item) => item.key));
    const extraKeys = Array.from(new Set(
      allUploadsForProcess(processo)
        .map((item) => String(item?.key || "").trim())
        .filter(Boolean)
        .filter((key) => !baseKeys.has(key))
    ));

    const extraDocuments = extraKeys.map((key) => ({
      key,
      label: documentLabel(key, processo),
      uploadCount: uploadCountForDocumentPrefix(processo, key),
      hasUploads: uploadCountForDocumentPrefix(processo, key) > 0,
    }));

    return [...baseDocuments, ...extraDocuments].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }

  function documentsForKitProfile(profileId, processo = selectedProcess()) {
    const selectedKeys = new Set(defaultKitDocumentKeys(profileId, processo));
    return availableKitDocuments(processo).filter((item) => selectedKeys.has(item.key));
  }

  function readyDocumentsForKitProfile(profileId, processo = selectedProcess()) {
    return documentsForKitProfile(profileId, processo).filter((item) => item.hasUploads);
  }

  function ensureKitState(processo) {
    const reserva = String(processo?.reserva || "");
    if (!reserva) return;
    const visibleProfiles = activeKitProfiles(processo);
    const fallbackProfile = visibleProfiles[0]?.id || "dossie";
    if (state.kitReserva !== reserva) {
      state.kitReserva = reserva;
      state.kitProfile = visibleProfiles.some((profile) => profile.id === "caixa") ? "caixa" : fallbackProfile;
      state.kitCustomName = processo?.cliente ? `Kit ${processo.cliente}` : "Kit personalizado";
      state.kitSelections = {
        caixa: defaultKitDocumentKeys("caixa", processo),
        creditu: defaultKitDocumentKeys("creditu", processo),
        agehab: defaultKitDocumentKeys("agehab", processo),
        dossie: defaultKitDocumentKeys("dossie", processo),
        personalizado: [],
      };
    }
    if (!visibleProfiles.some((profile) => profile.id === state.kitProfile)) {
      state.kitProfile = fallbackProfile;
    }
    for (const profile of kitProfiles) {
      if (!Array.isArray(state.kitSelections[profile.id])) {
        state.kitSelections[profile.id] = defaultKitDocumentKeys(profile.id, processo);
      }
    }
  }

  function selectedKitKeys(profileId = state.kitProfile) {
    const keys = state.kitSelections[profileId];
    return Array.isArray(keys) ? Array.from(new Set(keys.filter(Boolean))) : [];
  }

  function currentKitName(processo) {
    const currentProfile = kitProfileConfig();
    if (currentProfile.id === "personalizado") {
      return String(state.kitCustomName || "").trim() || currentProfile.title;
    }
    if (processo?.cliente) {
      return `${currentProfile.label} ${processo.cliente}`;
    }
    return currentProfile.title;
  }

  function toggleKitDocumentSelection(documentKey) {
    const profileId = state.kitProfile;
    const current = new Set(selectedKitKeys(profileId));
    if (current.has(documentKey)) {
      current.delete(documentKey);
    } else {
      current.add(documentKey);
    }
    state.kitSelections[profileId] = Array.from(current);
  }

  function applyKitSelection(mode) {
    const documents = availableKitDocuments();
    if (mode === "all") {
      state.kitSelections[state.kitProfile] = documents.map((item) => item.key);
      return;
    }
    if (mode === "uploaded") {
      state.kitSelections[state.kitProfile] = documents.filter((item) => item.hasUploads).map((item) => item.key);
      return;
    }
    state.kitSelections[state.kitProfile] = [];
  }

  function downloadFilenameFromHeader(headerValue, fallbackName) {
    const header = String(headerValue || "");
    const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {}
    }
    const simpleMatch = header.match(/filename=\"?([^\";]+)\"?/i);
    if (simpleMatch && simpleMatch[1]) {
      return simpleMatch[1];
    }
    return fallbackName;
  }

  function buildProtectedFallbackName(label, url = "") {
    const slug = normalizeStatusText(label)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "arquivo";
    const cleanUrl = String(url || "").split("?")[0].toLowerCase();
    const extension = cleanUrl.endsWith(".zip") ? "zip" : "pdf";
    return `${slug}.${extension}`;
  }

  function revokeObjectUrlLater(objectUrl, delay = 1500) {
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), delay);
  }

  async function openProtectedUpload(url, fallbackName) {
    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.document.write('<title>Carregando anexo</title><p style="font-family:Inter,system-ui,sans-serif;padding:16px;">Carregando anexo...</p>');
      previewWindow.document.close();
    }
    setStatus("Abrindo anexo...");
    try {
      const response = await apiBlob(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const resolvedName = downloadFilenameFromHeader(response.headers.get("content-disposition"), fallbackName);
      if (previewWindow) {
        previewWindow.location.href = objectUrl;
      } else {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.target = "_blank";
        link.rel = "noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setStatus(`Anexo aberto: ${resolvedName}`);
      revokeObjectUrlLater(objectUrl, 30000);
    } catch (error) {
      if (previewWindow && !previewWindow.closed) previewWindow.close();
      throw error;
    }
  }

  async function downloadProtectedAsset(url, fallbackName, successMessage = "Arquivo preparado com sucesso.") {
    const response = await apiBlob(url);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = downloadFilenameFromHeader(response.headers.get("content-disposition"), fallbackName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    revokeObjectUrlLater(downloadUrl, 1500);
    setStatus(successMessage);
  }

  async function downloadKit(format) {
    const processo = selectedProcess();
    if (!processo || !state.selectedReserva) return;
    ensureKitState(processo);
    const documentoKeys = selectedKitKeys();
    if (!documentoKeys.length) {
      setStatus("Selecione pelo menos um documento para gerar o kit.", "error");
      return;
    }

    const fallbackName = `kit-${processo.reserva || "cliente"}.${format === "zip" ? "zip" : "pdf"}`;
    setStatus(`Gerando ${format.toUpperCase()} do kit...`);

    const response = await apiBlob(`${API_BASE}/${encodeURIComponent(state.selectedReserva)}/kits/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: currentKitName(processo),
        formato: format,
        documento_keys: documentoKeys,
      }),
    });

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = downloadFilenameFromHeader(response.headers.get("content-disposition"), fallbackName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1500);
    setStatus("Kit gerado com sucesso.");
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function numericValue(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const raw = String(value).trim();
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");
    let normalized = raw;
    if (lastComma > -1 && lastDot > -1) {
      normalized = lastComma > lastDot
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "");
    } else if (lastComma > -1) {
      normalized = raw.replace(",", ".");
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatCurrency(value) {
    const parsed = numericValue(value);
    if (parsed === null) return "-";
    return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function detailText(value, fallback = "-") {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text || fallback;
  }

  function detailLine(...values) {
    return values
      .map((item) => detailText(item, ""))
      .filter((item) => item && item !== "-")
      .join(" | ") || "-";
  }

  function titleCaseWords(value) {
    return String(value || "")
      .replace(/[_\-.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function formatPercent(value) {
    const parsed = numericValue(value);
    if (parsed === null) return "-";
    const percentValue = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
    return `${percentValue.toFixed(2).replace(".", ",")}%`;
  }

  function dataFieldLabel(path) {
    return String(path || "")
      .split(".")
      .filter(Boolean)
      .map((part) => titleCaseWords(part.replace(/\[(\d+)\]/g, " $1")))
      .join(" / ");
  }

  function dataFieldValue(path, value) {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    if (typeof value === "number") {
      if (/(valor|renda|fgts|subsidio|entrada|saldo|parcela|financiamento|pro_soluto|comissao|desconto|total)/i.test(path)) {
        return formatCurrency(value);
      }
      if (/(percentual|comprometimento|juros|taxa)/i.test(path)) {
        return formatPercent(value);
      }
      return value.toLocaleString("pt-BR");
    }
    const text = String(value).trim();
    if (!text) return "-";
    if (/^(true|false)$/i.test(text)) return /^true$/i.test(text) ? "Sim" : "Não";
    if (/(valor|renda|fgts|subsidio|entrada|saldo|parcela|financiamento|pro_soluto|comissao|desconto|total)/i.test(path)) {
      const currencyText = formatCurrency(text);
      if (currencyText !== "-") return currencyText;
    }
    if (/(percentual|comprometimento|juros|taxa)/i.test(path)) {
      const percentText = formatPercent(text);
      if (percentText !== "-") return percentText;
    }
    if (/(^|\.)(data|created_at|updated_at|reservado_em|nascimento)(\.|$)/i.test(path)) {
      return formatDate(text);
    }
    return text;
  }

  function flattenDataEntries(value, prefix = "") {
    const entries = [];

    function visit(currentValue, currentPath) {
      if (currentValue === null || currentValue === undefined || currentValue === "") return;
      if (Array.isArray(currentValue)) {
        if (!currentValue.length) {
          entries.push({ path: currentPath, value: "[]" });
          return;
        }
        currentValue.forEach((item, index) => {
          visit(item, currentPath ? `${currentPath}[${index + 1}]` : `[${index + 1}]`);
        });
        return;
      }
      if (typeof currentValue === "object") {
        const objectEntries = Object.entries(currentValue);
        if (!objectEntries.length) {
          entries.push({ path: currentPath, value: "{}" });
          return;
        }
        objectEntries.forEach(([key, child]) => {
          visit(child, currentPath ? `${currentPath}.${key}` : key);
        });
        return;
      }
      entries.push({ path: currentPath || "valor", value: currentValue });
    }

    visit(value, prefix);
    return entries;
  }

  function simulationSummary(processo) {
    return processo?.simulacao_detalhes?.payload_snapshot?.resumo_operacao || {};
  }

  function upsertProcessDetail(processo) {
    if (!processo?.reserva) return;
    const index = state.processos.findIndex((item) => item.reserva === processo.reserva);
    if (index >= 0) {
      state.processos[index] = { ...state.processos[index], ...processo };
      return;
    }
    state.processos.unshift(processo);
  }

  function renderClientDataSection(processo) {
    const cadastro = processo?.cliente_cadastro || {};
    const reserva = processo?.reserva_comercial || {};
    const imovel = processo?.imovel_detalhes || {};
    const simulacao = processo?.simulacao_detalhes || {};
    const simulacaoFechada = processo?.simulacao_fechada || {};
    const resumo = simulationSummary(processo);
    const parceiro = detailText(resumo.parceiro_simulacao || imovel.parceiro_simulacao, "-");
    const statusSimulacao = detailText(
      processo?.simulacao_status || resumo.status_simulacao || simulacao.status_simulacao,
      "Sem simulação"
    );

    return `
      <section class="tl-mc-section tl-mc-stage-section">
        <div class="tl-mc-stage-section__head">
          <div>
            <span class="tl-mc-section-title">Cadastro completo da reserva</span>
            <p>Dados puxados do comercial, da reserva ativa, do imóvel e da simulação fechada.</p>
          </div>
          <span class="tl-mc-chip tl-mc-chip--info">${escapeHtml(statusSimulacao)}</span>
        </div>

        <div class="tl-mc-role-grid tl-mc-role-grid--compact">
          <article>
            <span>Cliente</span>
            <strong>${escapeHtml(detailText(processo?.cliente || cadastro.nome_completo, "Cliente sem nome"))}</strong>
            <small>${escapeHtml(detailLine(processo?.cliente_cpf || cadastro.cpf, cadastro.estado_civil, cadastro.profissao))}</small>
          </article>
          <article>
            <span>Contato</span>
            <strong>${escapeHtml(detailText(processo?.cliente_telefone || cadastro.celular || cadastro.telefone, "Telefone pendente"))}</strong>
            <small>${escapeHtml(detailLine(processo?.cliente_email || cadastro.email, cadastro.cidade, cadastro.estado))}</small>
          </article>
          <article>
            <span>Imóvel</span>
            <strong>${escapeHtml(detailText(processo?.imovel_titulo || imovel.titulo, "Imóvel não vinculado"))}</strong>
            <small>${escapeHtml(detailLine(processo?.empreendimento || simulacao.empreendimento, processo?.imovel_status || imovel.status))}</small>
          </article>
          <article>
            <span>Reserva</span>
            <strong>${escapeHtml(detailText(processo?.reserva_comercial_id || reserva.identificador_reserva || processo?.reserva, "Sem id"))}</strong>
            <small>${escapeHtml(detailLine(processo?.reserva_comercial_status || reserva.status, processo?.cliente_id, processo?.simulacao_id))}</small>
          </article>
        </div>

        <div class="tl-mc-role-grid tl-mc-role-grid--compact">
          <article>
            <span>Valor do imóvel</span>
            <strong>${escapeHtml(formatCurrency(processo?.simulacao_valor_imovel || resumo.valor_imovel || imovel.valor))}</strong>
            <small>${escapeHtml(detailLine(formatCurrency(processo?.simulacao_valor_total_operacao || resumo.valor_total_operacao), "total da operação"))}</small>
          </article>
          <article>
            <span>Financiamento</span>
            <strong>${escapeHtml(formatCurrency(processo?.simulacao_financiamento_caixa || resumo.financiamento_caixa || simulacaoFechada.financiamento_caixa))}</strong>
            <small>${escapeHtml(detailLine(formatCurrency(resumo.parcela_financiamento_banco || simulacaoFechada.parcela_financiamento_banco), "parcela banco"))}</small>
          </article>
          <article>
            <span>FGTS e subsídio</span>
            <strong>${escapeHtml(formatCurrency(processo?.simulacao_fgts || resumo.fgts || simulacaoFechada.fgts))}</strong>
            <small>${escapeHtml(`Subsídio ${detailText(formatCurrency(processo?.simulacao_subsidio || resumo.subsidio || simulacaoFechada.subsidio))}`)}</small>
          </article>
          <article>
            <span>Entrada e parceiro</span>
            <strong>${escapeHtml(formatCurrency(processo?.simulacao_entrada || resumo.entrada || resumo.entrada_solicitada || simulacao.entrada))}</strong>
            <small>${escapeHtml(detailLine(parceiro, resumo.percentual_comprometimento ? `${resumo.percentual_comprometimento} comprometimento` : ""))}</small>
          </article>
        </div>

        <div class="tl-mc-role-grid tl-mc-role-grid--compact">
          <article>
            <span>Endereço do imóvel</span>
            <strong>${escapeHtml(detailText(processo?.imovel_endereco || imovel.endereco, "Endereço pendente"))}</strong>
            <small>${escapeHtml(detailLine(processo?.imovel_bairro || imovel.bairro, processo?.imovel_cidade || imovel.cidade, processo?.imovel_estado || imovel.estado))}</small>
          </article>
          <article>
            <span>Renda fechada</span>
            <strong>${escapeHtml(formatCurrency(resumo.renda_total || cadastro.renda_total))}</strong>
            <small>${escapeHtml(detailLine(formatCurrency(cadastro.renda_principal), formatCurrency(cadastro.renda_conjuge), formatCurrency(cadastro.outras_rendas)))}</small>
          </article>
          <article>
            <span>Fechamento comercial</span>
            <strong>${escapeHtml(detailText(resumo.status_comercial || processo?.simulacao_status, "Sem fechamento"))}</strong>
            <small>${escapeHtml(detailLine(formatCurrency(resumo.pro_soluto_total), formatCurrency(resumo.saldo_pos_entrega), formatCurrency(resumo.valor_total_cliente)))}</small>
          </article>
          <article>
            <span>Origem operacional</span>
            <strong>${escapeHtml(detailText(processo?.origem, "Carteira"))}</strong>
            <small>${escapeHtml(detailLine(processo?.corretor, processo?.cca_vinculado || "Correspondente não vinculado"))}</small>
          </article>
        </div>
      </section>
    `;
  }

  function renderDataExplorerSection(title, subtitle, source, options = {}) {
    const entries = flattenDataEntries(source);
    const isOpen = options.open ? " open" : "";
    return `
      <details class="tl-mc-data-section"${isOpen}>
        <summary class="tl-mc-data-section__summary">
          <div>
            <strong>${escapeHtml(title)}</strong>
            <small>${escapeHtml(subtitle)}</small>
          </div>
          <span class="tl-mc-chip tl-mc-chip--info">${escapeHtml(`${entries.length} campo(s)`)}</span>
        </summary>
        ${entries.length ? `
          <div class="tl-mc-data-grid">
            ${entries.map((entry) => `
              <article class="tl-mc-data-row">
                <span>${escapeHtml(dataFieldLabel(entry.path))}</span>
                <strong>${escapeHtml(dataFieldValue(entry.path, entry.value))}</strong>
              </article>
            `).join("")}
          </div>
        ` : `
          <div class="tl-mc-empty-inline">Sem dados encontrados nesta fonte.</div>
        `}
      </details>
    `;
  }

  function renderClientSaleWorkspace(processo, overview) {
    const cadastro = processo?.cliente_cadastro || {};
    const reserva = processo?.reserva_comercial || {};
    const imovel = processo?.imovel_detalhes || {};
    const simulacao = processo?.simulacao_detalhes || {};
    const simulacaoFechada = processo?.simulacao_fechada || {};
    const resumo = simulationSummary(processo);
    const statusSimulacao = detailText(
      processo?.simulacao_status || resumo.status_simulacao || simulacao.status_simulacao,
      "Sem simulação"
    );

    return `
      <div class="tl-mc-sale-stack">
        <section class="tl-mc-section tl-mc-stage-section">
          <div class="tl-mc-stage-section__head">
            <div>
              <span class="tl-mc-section-title">Simulação e venda completa</span>
              <p>Visão fechada da venda com dados do cliente, reserva ativa, imóvel, simulação e parâmetros comerciais.</p>
            </div>
            <span class="tl-mc-chip tl-mc-chip--info">${escapeHtml(statusSimulacao)}</span>
          </div>

          <div class="tl-mc-role-grid tl-mc-role-grid--compact">
            <article>
              <span>Venda / produto</span>
              <strong>${escapeHtml(detailText(processo?.produto, "Cadastro comercial"))}</strong>
              <small>${escapeHtml(detailLine(processo?.corretor, processo?.cca_vinculado || "Correspondente não vinculado"))}</small>
            </article>
            <article>
              <span>Reserva comercial</span>
              <strong>${escapeHtml(detailText(processo?.reserva_comercial_id || reserva.identificador_reserva, "Sem reserva"))}</strong>
              <small>${escapeHtml(detailLine(processo?.reserva_comercial_status || reserva.status, processo?.simulacao_id, processo?.cliente_id))}</small>
            </article>
            <article>
              <span>Empreendimento</span>
              <strong>${escapeHtml(detailText(processo?.empreendimento || simulacao.empreendimento, "Não informado"))}</strong>
              <small>${escapeHtml(detailLine(processo?.imovel_titulo || imovel.titulo, processo?.imovel_status || imovel.status))}</small>
            </article>
            <article>
              <span>Atualização</span>
              <strong>${escapeHtml(formatDate(processo?.updated_at) || "-")}</strong>
              <small>${escapeHtml(detailLine(formatDate(processo?.created_at), processo?.origem))}</small>
            </article>
          </div>

          <div class="tl-mc-role-grid tl-mc-role-grid--compact">
            <article>
              <span>Valor do imóvel</span>
              <strong>${escapeHtml(formatCurrency(processo?.simulacao_valor_imovel || resumo.valor_imovel || imovel.valor))}</strong>
              <small>${escapeHtml(detailLine(formatCurrency(processo?.simulacao_valor_total_operacao || resumo.valor_total_operacao), "total da operação"))}</small>
            </article>
            <article>
              <span>Financiamento Caixa</span>
              <strong>${escapeHtml(formatCurrency(processo?.simulacao_financiamento_caixa || resumo.financiamento_caixa || simulacaoFechada.financiamento_caixa))}</strong>
              <small>${escapeHtml(detailLine(formatCurrency(resumo.parcela_financiamento_banco || simulacaoFechada.parcela_financiamento_banco), "parcela banco"))}</small>
            </article>
            <article>
              <span>Entrada</span>
              <strong>${escapeHtml(formatCurrency(processo?.simulacao_entrada || resumo.entrada || resumo.entrada_solicitada || simulacao.entrada))}</strong>
              <small>${escapeHtml(detailLine(formatCurrency(resumo.pro_soluto_total), formatCurrency(resumo.saldo_pos_entrega), formatCurrency(resumo.valor_total_cliente)))}</small>
            </article>
            <article>
              <span>FGTS / subsídio</span>
              <strong>${escapeHtml(formatCurrency(processo?.simulacao_fgts || resumo.fgts || simulacaoFechada.fgts))}</strong>
              <small>${escapeHtml(detailLine(`Subsídio ${formatCurrency(processo?.simulacao_subsidio || resumo.subsidio || simulacaoFechada.subsidio)}`, cadastro.renda_total ? `Renda ${formatCurrency(cadastro.renda_total)}` : ""))}</small>
            </article>
          </div>
        </section>

        ${renderClientDataSection(processo)}

        <section class="tl-mc-section tl-mc-stage-section">
          <div class="tl-mc-stage-section__head">
            <div>
              <span class="tl-mc-section-title">Fontes completas da base</span>
              <p>Campos detalhados trazidos diretamente do cadastro comercial e da simulação fechada do cliente.</p>
            </div>
            <span class="tl-mc-chip ${overview.documentacaoCompleta ? "tl-mc-chip--ok" : "tl-mc-chip--warn"}">${escapeHtml(overview.documentacaoCompleta ? "Documentação pronta" : `${overview.faltantes.length} documento(s) faltando`)}</span>
          </div>

          <div class="tl-mc-data-stack">
            ${renderDataExplorerSection("Cliente base", "Cadastro principal do cliente no comercial.", cadastro, { open: true })}
            ${renderDataExplorerSection("Reserva ativa", "Informações da reserva conectada ao cliente.", reserva)}
            ${renderDataExplorerSection("Imóvel detalhado", "Dados completos do imóvel selecionado.", imovel)}
            ${renderDataExplorerSection("Simulação detalhada", "Payload completo e status operacional da simulação.", simulacao)}
            ${renderDataExplorerSection("Simulação fechada", "Parâmetros finais usados no fechamento da venda.", simulacaoFechada, { open: true })}
          </div>
        </section>
      </div>
    `;
  }

  function relationshipInterviewMessages() {
    return (state.messages || []).filter((message) => {
      const text = String(message?.message || "").trim();
      return text.startsWith(relationshipInterviewTitle);
    });
  }

  function renderRelationshipControl(field) {
    const name = `relationship_${field.name || ""}`;
    if (field.type === "select") {
      const options = Array.isArray(field.options) ? field.options : relationshipYesNoOptions;
      return `
        <select name="${escapeHtml(name)}">
          ${options.map(([value, text]) => `<option value="${escapeHtml(value)}">${escapeHtml(text)}</option>`).join("")}
        </select>
      `;
    }
    return `
      <input
        type="${escapeHtml(field.type || "text")}"
        name="${escapeHtml(name)}"
        placeholder="${escapeHtml(field.placeholder || "")}"
        ${field.min ? `min="${escapeHtml(field.min)}"` : ""}
        ${field.max ? `max="${escapeHtml(field.max)}"` : ""}
      />
    `;
  }

  function renderRelationshipInterviewForm(processo) {
    return `
      <form class="tl-mc-relationship-form" data-message-form data-relationship-form="1" data-relationship-title="${escapeHtml(relationshipInterviewTitle)}">
        <input type="hidden" name="targetRole" value="todos" />
        <div class="tl-mc-relationship-list">
          ${relationshipInterviewFields.map((field, index) => `
            <article class="tl-mc-relationship-item">
              <div class="tl-mc-relationship-item__question">
                <span>${escapeHtml(String(index + 1).padStart(2, "0"))}</span>
                <div>
                  <strong>${escapeHtml(field.label)}</strong>
                  <small>${escapeHtml(field.helper)}</small>
                </div>
              </div>
              <label class="tl-mc-relationship-field">
                <span>Resposta</span>
                ${renderRelationshipControl(field)}
              </label>
            </article>
          `).join("")}
        </div>
        <label class="tl-mc-relationship-field tl-mc-relationship-field--wide">
          <span>Observação geral</span>
          <textarea name="relationship_observacao_geral" placeholder="Use este campo para complementar qualquer ponto da entrevista."></textarea>
        </label>
        <div class="tl-mc-relationship-actions">
          <span>${escapeHtml(processo?.cliente || "Cliente")}</span>
          <button class="tl-mc-btn tl-mc-btn--primary" type="submit">Salvar entrevista</button>
        </div>
      </form>
    `;
  }

  function renderRelationshipHistory(messages = relationshipInterviewMessages()) {
    if (!messages.length) {
      return `
        <div class="tl-mc-empty-inline">
          <strong>Nenhuma entrevista registrada</strong>
          <span>Depois de salvar, as respostas aparecem aqui e ficam nas mensagens do cliente.</span>
        </div>
      `;
    }
    return `
      <div class="tl-mc-relationship-history">
        ${messages.slice(0, 4).map((message) => `
          <article>
            <strong>${escapeHtml(message.author_name || "Usuário")}</strong>
            <small>${escapeHtml(formatDate(message.created_at))}</small>
            <pre>${escapeHtml(String(message.message || "").replace(relationshipInterviewTitle, "").trim() || "-")}</pre>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderClientRelationshipWorkspace(processo, overview) {
    const messages = relationshipInterviewMessages();
    return `
      <div class="tl-mc-relationship-stack">
        <section class="tl-mc-section tl-mc-stage-section">
          <div class="tl-mc-stage-section__head">
            <div>
              <span class="tl-mc-section-title">Grupo relacionamento</span>
              <p>Entrevista de relacionamento bancário, portabilidades, FGTS, datas e ciência do cliente.</p>
            </div>
            <span class="tl-mc-chip tl-mc-chip--info">${escapeHtml(`${messages.length} registro(s)`)}</span>
          </div>

          <div class="tl-mc-relationship-layout">
            <div class="tl-mc-relationship-panel">
              <div class="tl-mc-relationship-panel__head">
                <span>Entrevista & relacionamento</span>
                <strong>Preencha as respostas conforme conversa com o cliente</strong>
                <small>Os campos abaixo não são anexos. Eles geram um registro nas mensagens do cliente para consulta da equipe.</small>
              </div>
              ${renderRelationshipInterviewForm(processo)}
            </div>
            <aside class="tl-mc-relationship-side">
              <span>Histórico</span>
              ${renderRelationshipHistory(messages)}
            </aside>
          </div>
        </section>
      </div>
    `;
  }

  function renderUploads() {
    if (!state.uploads.length) return '<div class="tl-mc-muted">Nenhum anexo enviado.</div>';
    return state.uploads.map((item) => `
      <article class="tl-mc-upload-item">
        <div>
          <strong>${escapeHtml(item.name || item.key || "Arquivo")}</strong><br />
          <small>${escapeHtml(documentLabel(item.key || ""))}</small>
        </div>
        ${item.url ? `<button class="tl-mc-icon-btn" type="button" data-open-upload="${escapeHtml(item.url)}" data-open-upload-name="${escapeHtml(item.name || item.key || "Arquivo")}">Abrir</button>` : ""}
      </article>
    `).join("");
  }

  function renderMessages() {
    if (!state.messages.length) return '<div class="tl-mc-muted">Sem mensagens registradas.</div>';
    return state.messages.map((item) => `
      <article class="tl-mc-message-item">
        <strong>${escapeHtml(item.author_name || "Usuário")} <small>${escapeHtml(item.targetLabel || roleLabel(item.target_role) || "Todos")}</small></strong>
        <span>${escapeHtml(item.message || "")}</span>
        <small>${escapeHtml(formatDate(item.created_at))}</small>
      </article>
    `).join("");
  }

  function renderGestorBoard() {
    const list = filteredProcessos();
    const byCorretor = new Map();
    list.forEach((processo) => {
      const key = processo.corretor || "Sem corretor";
      const item = byCorretor.get(key) || { total: 0, finalizados: 0, pendentes: 0 };
      item.total += 1;
      item.finalizados += isFinalizado(processo) ? 1 : 0;
      item.pendentes += hasPending(processo) ? 1 : 0;
      byCorretor.set(key, item);
    });

    const rows = Array.from(byCorretor.entries()).sort((a, b) => b[1].total - a[1].total);
    if (!rows.length) {
      renderTable();
      return;
    }

    els.content.innerHTML = `
      <div class="tl-mc-table-wrap">
        <table class="tl-mc-table">
          <thead>
            <tr>
              <th>Responsável</th>
              <th>Processos</th>
              <th>Finalizados</th>
              <th>Pendências</th>
              <th>Conclusão</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(([name, item]) => `
              <tr>
                <td><strong>${escapeHtml(name)}</strong></td>
                <td>${item.total}</td>
                <td>${item.finalizados}</td>
                <td>${item.pendentes}</td>
                <td><span class="tl-mc-chip ${item.finalizados ? "tl-mc-chip--ok" : "tl-mc-chip--warn"}">${percent(item.finalizados, item.total)}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderGestorBoardDetailed() {
    const groups = gestorOwnerGroups();
    if (!groups.length) {
      renderTable();
      return;
    }

    if (state.selectedOwner && !groups.some((item) => item.name === state.selectedOwner)) {
      state.selectedOwner = "";
    }

    const selectedOwner = groups.find((item) => item.name === state.selectedOwner) || null;
    const detail = selectedOwner ? `
      <section class="tl-mc-client-workflow tl-mc-client-workflow--gestor">
        <div class="tl-mc-flow-head">
          <div>
            <span class="tl-mc-detail-kicker">Carteira do responsável</span>
            <h3>${escapeHtml(selectedOwner.name)}</h3>
            <p>${escapeHtml(`${selectedOwner.total} cliente(s) filtrado(s) | SLA médio ${formatElapsed(selectedOwner.avgSlaSeconds)}`)}</p>
          </div>
          <div class="tl-mc-flow-actions">
            <span class="tl-mc-current-stage">${escapeHtml(percent(selectedOwner.finalizados, selectedOwner.total))} concluído</span>
            <button class="tl-mc-btn tl-mc-btn--soft" type="button" data-clear-gestor-owner>Voltar ao resumo</button>
          </div>
        </div>

        <div class="tl-mc-chip-row tl-mc-chip-row--gestor">
          <span class="tl-mc-chip tl-mc-chip--warn">${selectedOwner.stages.documentacao} em documentação</span>
          <span class="tl-mc-chip tl-mc-chip--danger">${selectedOwner.stages.pendencia} com pendência</span>
          <span class="tl-mc-chip tl-mc-chip--info">${selectedOwner.stages.analise} em análise 7LM</span>
          <span class="tl-mc-chip tl-mc-chip--info">${selectedOwner.stages.cca} com correspondente</span>
          <span class="tl-mc-chip tl-mc-chip--ok">${selectedOwner.stages.finalizado} concluído(s)</span>
        </div>

        <section class="tl-mc-section">
          <div class="tl-mc-section-head">
            <div>
              <span class="tl-mc-section-title">Clientes do responsável</span>
              <p>Abra o cliente certo pela etapa atual e siga para o detalhamento completo quando precisar agir.</p>
            </div>
            <div class="tl-mc-section-counters">
              <span>${selectedOwner.processos.length} cliente(s)</span>
            </div>
          </div>

          <div class="tl-mc-gestor-client-list">
            ${selectedOwner.processos.map(({ processo, overview, stageKey }) => {
              const stage = gestorStageMeta(stageKey);
              const pendencias = pendingEntries(processo).length;
              const chips = [
                `<span class="tl-mc-chip tl-mc-chip--${stage.chip}">${escapeHtml(overview.etapaAtual)}</span>`,
                pendencias ? `<span class="tl-mc-chip tl-mc-chip--danger">${pendencias} pendência(s)</span>` : "",
                hasUploads(processo) ? '<span class="tl-mc-chip tl-mc-chip--ok">Documentos enviados</span>' : "",
              ].filter(Boolean).join("");

              return `
                <article class="tl-mc-gestor-client-card">
                  <div class="tl-mc-gestor-client-card__head">
                    <div>
                      <span class="tl-mc-detail-kicker">Cliente</span>
                      <strong>${escapeHtml(processo.cliente || "Cliente")}</strong>
                      <p>${escapeHtml([
                        processo.cliente_cpf || processo.reserva,
                        processo.cliente_telefone || "Telefone pendente",
                        processo.empreendimento || processo.produto || "Cadastro comercial",
                      ].filter(Boolean).join(" | "))}</p>
                    </div>
                    <div class="tl-mc-chip-row">${chips}</div>
                  </div>

                  <div class="tl-mc-gestor-client-card__meta">
                    <span><strong>SLA</strong><small>${escapeHtml(processo.sla?.elapsed_label || formatElapsed(processo.sla?.elapsed_seconds))}</small></span>
                    <span><strong>Corretor</strong><small>${escapeHtml(gestorOwnerName(processo))}</small></span>
                    <span><strong>Correspondente</strong><small>${escapeHtml(processo.cca_vinculado || "Não vinculado")}</small></span>
                  </div>

                  ${renderGestorMiniTimeline(processo, overview)}

                  <div class="tl-mc-gestor-client-card__actions">
                    <button class="tl-mc-btn tl-mc-btn--soft" type="button" data-open-client="${escapeHtml(processo.reserva)}">Abrir cliente</button>
                  </div>
                </article>
              `;
            }).join("")}
          </div>
        </section>
      </section>
    ` : "";

    els.content.innerHTML = `
      ${detail}
      <div class="tl-mc-table-wrap">
        <table class="tl-mc-table">
          <thead>
            <tr>
              <th>Responsável</th>
              <th>Processos</th>
              <th>Finalizados</th>
              <th>Pendências</th>
              <th>Conclusão</th>
            </tr>
          </thead>
          <tbody>
            ${groups.map((item) => `
              <tr class="${item.name === state.selectedOwner ? "is-selected" : ""}">
                <td>
                  <button type="button" data-open-gestor-owner="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button><br />
                  <span class="tl-mc-muted">${escapeHtml(item.total)} cliente(s) na carteira</span>
                </td>
                <td>${item.total}</td>
                <td>${item.finalizados}</td>
                <td>${item.pendentes}</td>
                <td><span class="tl-mc-chip ${item.finalizados ? "tl-mc-chip--ok" : "tl-mc-chip--warn"}">${percent(item.finalizados, item.total)}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderContent() {
    if (state.selectedReserva && selectedProcess()) {
      renderClientModal();
      return;
    }
    if (state.activeTab === "gestor") {
      renderGestorBoardDetailed();
      return;
    }
    renderTable();
  }

  function refreshFilteredViews(options = {}) {
    const { includeKpis = true, focusSelector = "" } = options;
    if (includeKpis) renderKpis();
    renderContent();
    if (!focusSelector) return;
    window.requestAnimationFrame(() => {
      const target = root.querySelector(focusSelector);
      if (!target) return;
      target.focus();
      if (typeof target.setSelectionRange === "function" && typeof target.value === "string") {
        const end = target.value.length;
        target.setSelectionRange(end, end);
      }
    });
  }

  function render() {
    const tab = activeTab();
    const selected = selectedProcess();
    const viewMeta = clientJourneyViewMeta();
    root.dataset.detailVisible = "false";
    root.dataset.clientView = selected ? "journey" : "list";
    renderTabs();
    els.activeKicker.textContent = selected ? viewMeta.kicker : tab.kicker;
    els.activeTitle.textContent = selected ? viewMeta.title : tab.title;
    if (els.filterForm) {
      els.filterForm.hidden = Boolean(selected);
    }
    if (els.kpis) els.kpis.hidden = Boolean(selected);
    renderKpis();
    renderContent();
    renderDetail();
  }

  async function loadData(options = {}) {
    const tab = activeTab();
    const query = tab.destino ? `?destino=${encodeURIComponent(tab.destino)}` : "";
    state.loading = true;
    setStatus("Carregando informações da Máquina de Crédito...");
    try {
      const [processos, diagnosticos] = await Promise.all([
        apiJson(`${API_BASE}${query}`),
        state.activeTab === "gestor" ? apiJson(`${API_BASE}/diagnosticos/gargalos`).catch(() => []) : Promise.resolve(state.diagnosticos),
      ]);
      state.processos = Array.isArray(processos) ? processos : [];
      state.diagnosticos = Array.isArray(diagnosticos) ? diagnosticos : [];
      if (!state.processos.some((item) => item.reserva === state.selectedReserva)) {
        state.selectedReserva = "";
      }
      if (options.forceSelectFirst && state.processos.length) {
        state.selectedReserva = state.processos[0]?.reserva || "";
      }
      await loadSelectedAuxiliary();
      setStatus("");
    } catch (error) {
      setStatus(error.message || "Não foi possível carregar o módulo.", "error");
    } finally {
      state.loading = false;
      render();
    }
  }

  async function loadSelectedAuxiliary() {
    state.uploads = [];
    state.messages = [];
    if (!state.selectedReserva) return;
    const reserva = encodeURIComponent(state.selectedReserva);
    const [detail, uploads, messages] = await Promise.all([
      apiJson(`${API_BASE}/${reserva}`).catch(() => null),
      apiJson(`${API_BASE}/${reserva}/uploads`).catch(() => ({ uploads: [] })),
      apiJson(`${API_BASE}/${reserva}/messages`).catch(() => []),
    ]);
    if (detail?.reserva) {
      upsertProcessDetail(detail);
    }
    state.uploads = Array.isArray(uploads?.uploads) ? uploads.uploads : [];
    state.messages = Array.isArray(messages) ? messages : [];
  }

  function currentUserName() {
    const user = storedUser();
    return user?.nome || user?.name || user?.email || "Usuário 7LM";
  }

  function applyUser() {
    if (els.user) {
      els.user.textContent = currentUserName();
    }
  }

  function openTab(tabId, push = true) {
    const tab = tabs.find((item) => item.id === tabId) || tabs[0];
    state.activeTab = tab.id;
    state.checklistOrigin = normalizeChecklistOrigin(tab.id);
    state.clientJourneyView = "documentos";
    state.selectedReserva = "";
    state.selectedOwner = "";
    state.columnFilters = defaultColumnFilters();
    state.columnFilterOpen = "";
    state.columnFilterSearch = defaultColumnFilterSearch();
    state.uploads = [];
    state.messages = [];
    closeClientModal();
    if (push) window.history.pushState({ maqCreditoTab: tab.id }, "", tab.path);
    void loadData();
  }

  function checklistUrl(reserva, origin = state.activeTab) {
    const etapa = normalizeChecklistOrigin(origin) || "corretor";
    return `/maq-credito/analista/checklist?cliente=${encodeURIComponent(reserva)}&etapa=${encodeURIComponent(etapa)}`;
  }

  function backToClients() {
    state.selectedReserva = "";
    state.clientJourneyView = "documentos";
    state.uploads = [];
    state.messages = [];
    closeClientModal();
    window.history.pushState({ maqCreditoTab: state.activeTab }, "", activeTab().path);
    render();
    window.requestAnimationFrame(() => root.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function openClientChecklist(reserva, originOverride, viewOverride = "documentos") {
    if (!reserva) return;
    const initialOrigin = normalizeChecklistOrigin(originOverride) || normalizeChecklistOrigin(state.activeTab) || "corretor";
    state.checklistOrigin = initialOrigin === "gestor" ? "corretor" : initialOrigin;
    state.clientJourneyView = normalizeClientJourneyView(viewOverride);
    state.selectedReserva = reserva;
    state.uploads = [];
    state.messages = [];
    window.history.pushState(
      { maqCreditoTab: state.activeTab, reserva, visao: state.clientJourneyView, etapa: state.checklistOrigin },
      "",
      clientDetailUrl(reserva, state.clientJourneyView, state.checklistOrigin)
    );
    render();
    window.requestAnimationFrame(() => root.scrollIntoView({ behavior: "smooth", block: "start" }));
    await loadSelectedAuxiliary();
    render();
  }

  async function updateProcessStage(patch, successMessage = "Etapa atualizada.") {
    if (!state.selectedReserva) return;
    setStatus("Atualizando etapa da reserva...");
    await apiJson(`${API_BASE}/${encodeURIComponent(state.selectedReserva)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await loadData();
    setStatus(successMessage);
  }

  async function handleRoleAction(action) {
    const processo = selectedProcess();
    if (!processo || !action) return;
    const overview = checklistOverview(processo);

    if (action === "analista-iniciar") {
      if (!overview.analistaLiberado) {
        setStatus("Envie pelo menos um documento para iniciar a análise.", "error");
        return;
      }
      await updateProcessStage({
        encaminhado_analista: true,
        caixa: processo.caixa === "reserva" ? "em_analise_credito" : processo.caixa,
        agehab: processo.agehab === "reserva" ? "em_analise_credito" : processo.agehab,
      }, "Análise de crédito iniciada.");
      return;
    }

    if (action === "analista-liberar-cca") {
      if (!overview.documentacaoCompleta) {
        setStatus("O correspondente só pode ser liberado depois do checklist completo.", "error");
        return;
      }
      await updateProcessStage({
        encaminhado_analista: true,
        caixa: ["reserva", "em_analise_credito"].includes(processo.caixa) ? "emitindo_formularios" : processo.caixa,
        agehab: ["reserva", "em_analise_credito"].includes(processo.agehab) ? "ficha_emitida" : processo.agehab,
      }, "Reserva liberada para o correspondente.");
      return;
    }

    if (action.startsWith("caixa:")) {
      const [, value] = action.split(":");
      if (!value) return;
      await updateProcessStage({
        encaminhado_analista: true,
        caixa: value,
      }, `Status Caixa atualizado para ${labelFor(caixaStatuses, value)}.`);
      return;
    }

    if (action.startsWith("agehab:")) {
      const [, value] = action.split(":");
      if (!value) return;
      await updateProcessStage({
        encaminhado_analista: true,
        agehab: value,
      }, `Status Agehab atualizado para ${labelFor(agehabStatuses, value)}.`);
    }
  }

  async function handleRoleAction(action) {
    const processo = selectedProcess();
    if (!processo || !action) return;
    const overview = checklistOverview(processo);

    if (action === "analista-iniciar") {
      if (!overview.analistaLiberado) {
        setStatus("Envie pelo menos um documento para iniciar a validação.", "error");
        return;
      }
      await updateProcessStage({
        encaminhado_analista: true,
        caixa: processo.caixa === "reserva" ? "em_analise_credito" : processo.caixa,
        agehab: processo.agehab === "reserva" ? "em_analise_credito" : processo.agehab,
      }, "Validação de crédito iniciada.");
      return;
    }

    if (action === "analista-liberar-cca") {
      if (!overview.documentacaoCompleta) {
        setStatus("Os kits só podem ser liberados depois do checklist completo.", "error");
        return;
      }
      await updateProcessStage({
        encaminhado_analista: true,
        caixa: ["reserva", "em_analise_credito"].includes(processo.caixa) ? "emitindo_formularios" : processo.caixa,
        agehab: ["reserva", "em_analise_credito"].includes(processo.agehab) ? "ficha_emitida" : processo.agehab,
      }, "Validação concluída e kits liberados.");
      return;
    }

    if (action.startsWith("caixa:")) {
      const [, value] = action.split(":");
      if (!value) return;
      await updateProcessStage({
        encaminhado_analista: true,
        caixa: value,
      }, `Status Caixa atualizado para ${labelFor(caixaStatuses, value)}.`);
      return;
    }

    if (action.startsWith("agehab:")) {
      const [, value] = action.split(":");
      if (!value) return;
      await updateProcessStage({
        encaminhado_analista: true,
        agehab: value,
      }, `Status Agehab atualizado para ${labelFor(agehabStatuses, value)}.`);
    }
  }

  function formPayload(form) {
    const data = new FormData(form);
    return {
      cliente: String(data.get("cliente") || "").trim(),
      produto: String(data.get("produto") || "").trim(),
      corretor: String(data.get("corretor") || "").trim(),
      cca_vinculado: String(data.get("cca_vinculado") || "").trim(),
      empreendimento: String(data.get("empreendimento") || "").trim(),
      observacao_analista: String(data.get("observacao_analista") || "").trim(),
      caixa: String(data.get("caixa") || "reserva"),
      agehab: String(data.get("agehab") || "reserva"),
      encaminhado_analista: data.get("encaminhado_analista") === "on",
    };
  }

  async function saveSelectedProcess(form) {
    if (!state.selectedReserva) return;
    setStatus("Salvando reserva...");
    await apiJson(`${API_BASE}/${encodeURIComponent(state.selectedReserva)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formPayload(form)),
    });
    await loadData();
  }

  function ensureModal() {
    let modal = document.querySelector("[data-mc-modal]");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "tl-mc-modal";
    modal.setAttribute("data-mc-modal", "");
    modal.hidden = true;
    modal.innerHTML = `
        <div class="tl-mc-modal__box">
          <div class="tl-mc-modal__head">
            <h3>Novo processo</h3>
            <button class="tl-mc-icon-btn" type="button" data-modal-close>Fechar</button>
          </div>
        <form class="tl-mc-modal__body" data-new-process-form>
          <div class="tl-mc-field">
            <label>Reserva</label>
            <input class="tl-mc-input" name="reserva" required />
          </div>
          <div class="tl-mc-field">
            <label>Cliente</label>
            <input class="tl-mc-input" name="cliente" />
          </div>
          <div class="tl-mc-field">
            <label>Produto</label>
            <input class="tl-mc-input" name="produto" value="RD" />
          </div>
          <div class="tl-mc-field">
            <label>Corretor</label>
            <input class="tl-mc-input" name="corretor" />
          </div>
          <div class="tl-mc-wide-field">
            <label>Empreendimento</label>
            <input class="tl-mc-input" name="empreendimento" />
          </div>
          <div class="tl-mc-wide-field tl-mc-inline-actions">
            <button class="tl-mc-btn tl-mc-btn--primary" type="submit">Salvar reserva</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function openNewProcessModal() {
    ensureModal().hidden = false;
  }

  async function createProcess(form) {
    const data = new FormData(form);
    const reserva = String(data.get("reserva") || "").trim();
    if (!reserva) return;
    const payload = {
      cliente: String(data.get("cliente") || "").trim(),
      produto: String(data.get("produto") || "").trim(),
      corretor: String(data.get("corretor") || "").trim(),
      empreendimento: String(data.get("empreendimento") || "").trim(),
      caixa: "reserva",
      agehab: "reserva",
    };
    setStatus("Criando reserva...");
    await apiJson(`${API_BASE}/${encodeURIComponent(reserva)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.selectedReserva = reserva;
    ensureModal().hidden = true;
    await loadData();
  }

  function dependentRowsFromProfileForm(form) {
    return Array.from(form.querySelectorAll("[data-profile-dependent-row]"))
      .map((row) => {
        const value = (field) => String(row.querySelector(`[data-profile-dependent="${field}"]`)?.value || "").trim();
        return {
          nome: value("nome"),
          parentesco: value("parentesco"),
          data_nascimento: value("data_nascimento"),
          estado_civil: value("estado_civil"),
          renda_total: value("renda_total"),
        };
      })
      .filter((item) => item.nome || item.parentesco || item.data_nascimento || item.estado_civil);
  }

  function toggleProfileSpouseFields(form) {
    const stateInput = form?.querySelector("[data-profile-state]");
    const spouseBox = form?.querySelector("[data-profile-spouse]");
    if (!stateInput || !spouseBox) return;
    spouseBox.hidden = !profileStateRequiresSpouse(stateInput.value);
  }

  function ensureProfileDependentsEmptyState(container) {
    if (!container) return;
    const rows = container.querySelectorAll("[data-profile-dependent-row]");
    const empty = container.querySelector(".tl-mc-empty-inline");
    if (rows.length && empty) empty.remove();
    if (!rows.length && !empty) {
      container.innerHTML = `
        <div class="tl-mc-empty-inline">
          <strong>Nenhum dependente informado</strong>
          <span>Adicione dependentes quando eles fizerem parte da composição familiar ou AGEHAB.</span>
        </div>
      `;
    }
  }

  async function savePerfilDocumental(form) {
    if (!state.selectedReserva || !form) return;
    const data = new FormData(form);
    const payload = {
      estado_civil: String(data.get("estado_civil") || "").trim(),
      renda_conjuge: String(data.get("renda_conjuge") || "").trim(),
      conjuge: {
        nome: String(data.get("conjuge_nome") || "").trim(),
        cpf: String(data.get("conjuge_cpf") || "").trim(),
        estado_civil: String(data.get("conjuge_estado_civil") || "").trim(),
        renda_total: String(data.get("conjuge_renda_total") || data.get("renda_conjuge") || "").trim(),
      },
      dependentes: dependentRowsFromProfileForm(form),
      updated_by: currentUserName(),
      updated_role: currentActorRole(),
    };
    setStatus("Salvando perfil documental e recalculando checklist...");
    const response = await apiJson(`${API_BASE}/${encodeURIComponent(state.selectedReserva)}/perfil-documental`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response?.processo) {
      upsertProcessDetail(response.processo);
    }
    await loadSelectedAuxiliary();
    renderClientModal();
    setStatus("Perfil documental atualizado. Checklist recalculado.");
  }

  async function updateDocument(key, explicitStatus = "") {
    const scope = clientModal() && !clientModal().hidden ? clientModal() : document;
    const select = scope.querySelector(`[data-doc-status="${CSS.escape(key)}"]`);
    if ((!select && !explicitStatus) || !state.selectedReserva) return;
    if (currentActorRole() !== "analista") {
      setStatus("A validação documental é exclusiva do analista de crédito.", "error");
      return;
    }
    const status = explicitStatus || select.value;
    if (!explicitStatus && statusRequiresAnalystObservation(status)) {
      await openPendencyPrompt(key, select, status);
      return;
    }
    await apiJson(`${API_BASE}/${encodeURIComponent(state.selectedReserva)}/documentos/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        updated_by: currentUserName(),
        updated_role: currentActorRole(),
      }),
    });
    await loadData();
  }

  function statusRequiresAnalystObservation(status = "") {
    const normalized = normalizeStatusText(status);
    return normalized === "pendente" || isRejectedDocument(status);
  }

  function analystObservationInput(key, trigger = null) {
    const localScope = trigger?.closest?.("tr, article, .tl-mc-kit-table-action");
    const selector = `[data-doc-observation="${CSS.escape(key)}"]`;
    return localScope?.querySelector(selector)
      || (clientModal() && !clientModal().hidden ? clientModal() : document).querySelector(selector);
  }

  async function saveDocumentPendency(key, descricao, status = "Rejeitado") {
    await apiJson(`${API_BASE}/${encodeURIComponent(state.selectedReserva)}/documentos/${encodeURIComponent(key)}/pendencia`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao,
        prazo: null,
        documento: key,
        origem: currentUserName(),
        actor_role: currentActorRole(),
      }),
    });
    if (status === "Pendente") {
      await apiJson(`${API_BASE}/${encodeURIComponent(state.selectedReserva)}/documentos/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          updated_by: currentUserName(),
          updated_role: currentActorRole(),
        }),
      });
    }
  }

  async function requestNotApplicable(key) {
    if (!state.selectedReserva || !key) return;
    if (currentActorRole() !== "corretor") {
      setStatus("A solicitação de não se aplica deve ser feita na etapa do corretor.", "error");
      return;
    }
    const confirmed = window.confirm("Enviar este documento como não se aplica para validação do analista?");
    if (!confirmed) return;
    await apiJson(`${API_BASE}/${encodeURIComponent(state.selectedReserva)}/documentos/${encodeURIComponent(key)}/nao-se-aplica`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "Pendente Validacao Analista",
        updated_by: currentUserName(),
        updated_role: currentActorRole(),
      }),
    });
    setStatus("Solicitação enviada para validação do analista.");
    await loadData();
  }

  async function openPendencyPrompt(key, trigger = null, status = "Rejeitado") {
    if (!state.selectedReserva) return;
    if (currentActorRole() !== "analista") {
      setStatus("A rejeição documental é exclusiva do analista de crédito.", "error");
      return;
    }
    const input = analystObservationInput(key, trigger);
    const descricao = String(input?.value || "").trim();
    if (!descricao) {
      setStatus("Informe a observação do analista antes de rejeitar o documento.", "error");
      input?.focus?.();
      return;
    }
    await saveDocumentPendency(key, descricao, status);
    await loadData();
  }

  function structuredKitInfoMessage(form, title) {
    const lines = [];
    form.querySelectorAll(".tl-mc-kit-info-field").forEach((field) => {
      const label = String(field.querySelector("span")?.textContent || "").trim();
      const control = field.querySelector("input, select, textarea");
      const value = String(control?.value || "").trim();
      if (label && value) {
        lines.push(`${label}: ${value}`);
      }
    });
    if (!lines.length) return "";
    return `${title}\n${lines.join("\n")}`;
  }

  function structuredRelationshipMessage(form, title) {
    const lines = [];
    relationshipInterviewFields.forEach((field) => {
      const control = form.querySelector(`[name="relationship_${CSS.escape(field.name || "")}"]`);
      const value = String(control?.value || "").trim();
      if (value) {
        lines.push(`${field.label}: ${value}`);
      }
    });
    const generalNote = String(form.querySelector('[name="relationship_observacao_geral"]')?.value || "").trim();
    if (generalNote) lines.push(`Observação geral: ${generalNote}`);
    if (!lines.length) return "";
    return `${title}\n${lines.join("\n")}`;
  }

  async function sendMessage(form) {
    if (!state.selectedReserva) return;
    const data = new FormData(form);
    let message = String(data.get("message") || "").trim();
    const kitInfoTitle = String(form.getAttribute("data-kit-info-title") || "").trim();
    const relationshipTitle = String(form.getAttribute("data-relationship-title") || "").trim();
    if (form.getAttribute("data-relationship-form") === "1") {
      message = structuredRelationshipMessage(form, relationshipTitle || relationshipInterviewTitle);
    }
    if (form.getAttribute("data-kit-info-structured") === "1") {
      message = structuredKitInfoMessage(form, kitInfoTitle || "Informações do kit");
    }
    if (!message) {
      setStatus("Preencha pelo menos uma informação antes de salvar.", "error");
      return;
    }
    if (kitInfoTitle && !message.includes(kitInfoTitle)) {
      message = `${kitInfoTitle}\n${message}`;
    }
    if (relationshipTitle && !message.includes(relationshipTitle)) {
      message = `${relationshipTitle}\n${message}`;
    }
    await apiJson(`${API_BASE}/${encodeURIComponent(state.selectedReserva)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author_name: currentUserName(),
        author_role: currentActorRole(),
        targetRole: String(data.get("targetRole") || "todos"),
        message,
      }),
    });
    form.reset();
    await loadSelectedAuxiliary();
    renderClientModal();
  }

  async function uploadFile(trigger) {
    if (!state.selectedReserva) return;
    const scope = trigger?.closest("[data-upload-scope]") || trigger?.closest("[data-document-key]") || document;
    const fileInput = scope.querySelector("[data-upload-file]");
    const group = scope.querySelector("[data-upload-group]")?.value || trigger?.getAttribute("data-upload-group") || "corretor";
    const key = trigger?.getAttribute("data-upload-submit") || scope.getAttribute("data-document-key") || scope.querySelector("[data-upload-key]")?.value || "arquivo";
    const files = Array.from(fileInput?.files || []);
    if (!files.length) {
      setStatus("Selecione pelo menos um arquivo para enviar.", "error");
      return;
    }
    setStatus(`Enviando ${files.length} anexo(s)...`);
    for (const file of files) {
      const payload = new FormData();
      payload.append("file", file);
      payload.append("grupo", group);
      payload.append("key", key);
      payload.append("name", file.name);
      payload.append("created_by", currentUserName());
      payload.append("actor_role", currentActorRole());
      await apiJson(`${API_BASE}/${encodeURIComponent(state.selectedReserva)}/uploads`, {
        method: "POST",
        headers: {},
        body: payload,
      });
    }
    if (fileInput) {
      fileInput.value = "";
      syncUploadScope(scope);
    }
    await loadData();
  }

  async function deleteUpload(url, name = "anexo") {
    if (!state.selectedReserva || !url) return;
    if (currentActorRole() !== "analista") {
      setStatus("A exclusão de anexos é exclusiva do analista de crédito.", "error");
      return;
    }
    const label = String(name || "anexo").trim() || "anexo";
    const confirmed = window.confirm(`Excluir o anexo "${label}" deste documento?`);
    if (!confirmed) return;
    const params = new URLSearchParams({ url });
    setStatus("Excluindo anexo...");
    await apiJson(`${API_BASE}/${encodeURIComponent(state.selectedReserva)}/uploads?${params.toString()}`, {
      method: "DELETE",
    });
    setStatus("Anexo excluído com sucesso.");
    await loadData();
  }

  async function startStopSla(action) {
    if (!state.selectedReserva) return;
    await apiJson(`${API_BASE}/${encodeURIComponent(state.selectedReserva)}/sla/${action}`, { method: "POST" });
    await loadData();
  }

  function scrollClientTable(trigger) {
    const shell = trigger?.closest("[data-table-shell]");
    const area = shell?.querySelector("[data-table-scroll-area]");
    if (!area) return;
    const rawDirection = trigger.getAttribute("data-table-scroll") || "1";
    if (rawDirection === "start" || rawDirection === "end") {
      area.scrollTo({
        left: rawDirection === "start" ? 0 : area.scrollWidth - area.clientWidth,
        behavior: "smooth",
      });
      area.focus({ preventScroll: true });
      return;
    }
    const direction = Number(rawDirection);
    const step = Math.max(280, Math.floor(area.clientWidth * 0.72));
    area.scrollBy({
      left: Number.isFinite(direction) ? direction * step : step,
      behavior: "smooth",
    });
    area.focus({ preventScroll: true });
  }

  function bindEvents() {
    root.addEventListener("click", (event) => {
      const tableScroll = event.target.closest("[data-table-scroll]");
      if (tableScroll) {
        event.preventDefault();
        scrollClientTable(tableScroll);
        return;
      }

      const filterToggle = event.target.closest("[data-column-filter-toggle]");
      if (filterToggle) {
        event.preventDefault();
        const key = filterToggle.getAttribute("data-column-filter-toggle") || "";
        state.columnFilterOpen = state.columnFilterOpen === key ? "" : key;
        refreshFilteredViews();
        return;
      }

      const filterClear = event.target.closest("[data-column-filter-clear]");
      if (filterClear) {
        event.preventDefault();
        const key = filterClear.getAttribute("data-column-filter-clear") || "";
        if (key === "owner") state.columnFilters.owners = [];
        if (key === "status") state.columnFilters.statuses = [];
        refreshFilteredViews();
        return;
      }

      const tabLink = event.target.closest("[data-tab]");
      if (tabLink) {
        event.preventDefault();
        openTab(tabLink.getAttribute("data-tab"));
        return;
      }

      const reserva = event.target.closest("[data-select-reserva]")?.getAttribute("data-select-reserva");
      if (reserva) {
        state.clientJourneyView = "documentos";
        state.selectedReserva = reserva;
        render();
        void loadSelectedAuxiliary()
          .then(render)
          .catch((error) => setStatus(error.message || "Não foi possível carregar o checklist do cliente.", "error"));
        return;
      }

      const clientViewTab = event.target.closest("[data-client-view-tab]")?.getAttribute("data-client-view-tab");
      if (clientViewTab && state.selectedReserva) {
        state.clientJourneyView = normalizeClientJourneyView(clientViewTab);
        window.history.pushState(
          { maqCreditoTab: state.activeTab, reserva: state.selectedReserva, visao: state.clientJourneyView, etapa: state.checklistOrigin },
          "",
          clientDetailUrl(state.selectedReserva, state.clientJourneyView, state.checklistOrigin)
        );
        render();
        window.requestAnimationFrame(() => root.scrollIntoView({ behavior: "smooth", block: "start" }));
        return;
      }

      const checklistOriginButton = event.target.closest("[data-checklist-origin]");
      if (checklistOriginButton && state.selectedReserva) {
        const origin = normalizeChecklistOrigin(checklistOriginButton.getAttribute("data-checklist-origin"));
        if (origin) {
          state.checklistOrigin = origin;
          window.history.pushState(
            { maqCreditoTab: state.activeTab, reserva: state.selectedReserva, visao: state.clientJourneyView, etapa: origin },
            "",
            clientDetailUrl(state.selectedReserva, state.clientJourneyView, origin)
          );
          render();
          window.requestAnimationFrame(() => root.scrollIntoView({ behavior: "smooth", block: "start" }));
        }
        return;
      }

      const checklistReserva = event.target.closest("[data-open-checklist]")?.getAttribute("data-open-checklist");
      if (checklistReserva) {
        void openClientChecklist(checklistReserva).catch((error) => setStatus(error.message || "Não foi possível abrir o checklist.", "error"));
        return;
      }

      const clientReserva = event.target.closest("[data-open-client]")?.getAttribute("data-open-client");
      if (clientReserva) {
        void openClientChecklist(clientReserva).catch((error) => setStatus(error.message || "Não foi possível abrir o cliente.", "error"));
        return;
      }

      const gestorOwner = event.target.closest("[data-open-gestor-owner]")?.getAttribute("data-open-gestor-owner");
      if (gestorOwner) {
        state.selectedOwner = gestorOwner;
        render();
        return;
      }

      if (event.target.closest("[data-clear-gestor-owner]")) {
        state.selectedOwner = "";
        render();
        return;
      }

      const stageButton = event.target.closest("[data-open-stage]");
      if (stageButton) {
        const reservaEtapa = stageButton.getAttribute("data-open-stage");
        const origin = stageButton.getAttribute("data-stage-origin");
        void openClientChecklist(reservaEtapa, origin).catch((error) => setStatus(error.message || "Não foi possível abrir a etapa do cliente.", "error"));
        return;
      }

      const roleAction = event.target.closest("[data-role-action]")?.getAttribute("data-role-action");
      if (roleAction) {
        void handleRoleAction(roleAction).catch((error) => setStatus(error.message || "Não foi possível atualizar a etapa.", "error"));
        return;
      }

      const addDependent = event.target.closest("[data-profile-dependent-add]");
      if (addDependent) {
        const form = addDependent.closest("[data-profile-form]");
        const container = form?.querySelector("[data-profile-dependents]");
        container?.querySelector(".tl-mc-empty-inline")?.remove();
        container?.insertAdjacentHTML("beforeend", renderPerfilDependenteRow({}, container.querySelectorAll("[data-profile-dependent-row]").length));
        ensureProfileDependentsEmptyState(container);
        return;
      }

      const removeDependent = event.target.closest("[data-profile-dependent-remove]");
      if (removeDependent) {
        const container = removeDependent.closest("[data-profile-dependents]");
        removeDependent.closest("[data-profile-dependent-row]")?.remove();
        ensureProfileDependentsEmptyState(container);
        return;
      }

      const kitProfile = event.target.closest("[data-kit-profile]")?.getAttribute("data-kit-profile");
      if (kitProfile) {
        state.kitProfile = kitProfile;
        renderClientModal();
        return;
      }

      const kitDocGroupToggle = event.target.closest("[data-kit-doc-group-toggle]");
      if (kitDocGroupToggle) {
        event.preventDefault();
        const group = kitDocGroupToggle.closest(".tl-mc-kit-doc-group");
        if (group) group.toggleAttribute("open");
        return;
      }

      const kitSelect = event.target.closest("[data-kit-select]")?.getAttribute("data-kit-select");
      if (kitSelect) {
        applyKitSelection(kitSelect);
        renderClientModal();
        return;
      }

      const kitToggle = event.target.closest("[data-kit-toggle]")?.getAttribute("data-kit-toggle");
      if (kitToggle) {
        toggleKitDocumentSelection(kitToggle);
        renderClientModal();
        return;
      }

      const kitDownload = event.target.closest("[data-kit-download]")?.getAttribute("data-kit-download");
      if (kitDownload) {
        void downloadKit(kitDownload).catch((error) => setStatus(error.message || "Não foi possível gerar o kit.", "error"));
        return;
      }

      if (event.target.closest("[data-back-clients]")) {
        backToClients();
        return;
      }

      if (event.target.closest("[data-action='refresh']")) {
        void loadData();
        return;
      }

      if (event.target.closest("[data-action='new-process']")) {
        openNewProcessModal();
        return;
      }

      const docKey = event.target.closest("[data-save-doc]")?.getAttribute("data-save-doc");
      if (docKey) {
        void updateDocument(docKey).catch((error) => setStatus(error.message, "error"));
        return;
      }

      const approveKey = event.target.closest("[data-approve-doc]")?.getAttribute("data-approve-doc");
      if (approveKey) {
        const approveButton = event.target.closest("[data-approve-doc]");
        const approveStatus = approveButton?.getAttribute("data-approve-status") || "Aprovado";
        void updateDocument(approveKey, approveStatus).catch((error) => setStatus(error.message, "error"));
        return;
      }

      const pendKey = event.target.closest("[data-open-pendency]")?.getAttribute("data-open-pendency");
      if (pendKey) {
        void openPendencyPrompt(pendKey, event.target.closest("[data-open-pendency]")).catch((error) => setStatus(error.message, "error"));
        return;
      }

      const notApplicableKey = event.target.closest("[data-request-na-doc]")?.getAttribute("data-request-na-doc");
      if (notApplicableKey) {
        void requestNotApplicable(notApplicableKey).catch((error) => setStatus(error.message, "error"));
        return;
      }

      const uploadButton = event.target.closest("[data-upload-submit]");
      if (uploadButton) {
        void uploadFile(uploadButton).catch((error) => setStatus(error.message, "error"));
        return;
      }

      const uploadDeleteButton = event.target.closest("[data-delete-upload]");
      if (uploadDeleteButton) {
        const url = uploadDeleteButton.getAttribute("data-delete-upload") || "";
        const name = uploadDeleteButton.getAttribute("data-delete-upload-name") || "anexo";
        void deleteUpload(url, name).catch((error) => setStatus(error.message, "error"));
        return;
      }

      const uploadOpenButton = event.target.closest("[data-open-upload]");
      if (uploadOpenButton) {
        const url = uploadOpenButton.getAttribute("data-open-upload") || "";
        const fallbackName = uploadOpenButton.getAttribute("data-open-upload-name") || "anexo.pdf";
        void openProtectedUpload(url, fallbackName).catch((error) => setStatus(error.message, "error"));
        return;
      }

      const protectedDownloadButton = event.target.closest("[data-download-protected]");
      if (protectedDownloadButton) {
        const url = protectedDownloadButton.getAttribute("data-download-protected") || "";
        const fallbackName = protectedDownloadButton.getAttribute("data-download-name") || "arquivo.pdf";
        const label = protectedDownloadButton.textContent?.trim() || "Arquivo";
        setStatus(`Preparando ${label}...`);
        void downloadProtectedAsset(url, fallbackName, `${label} preparado com sucesso.`).catch((error) => setStatus(error.message, "error"));
        return;
      }

      if (event.target.closest("[data-sla-start]")) {
        void startStopSla("start").catch((error) => setStatus(error.message, "error"));
        return;
      }

      if (event.target.closest("[data-sla-stop]")) {
        void startStopSla("stop").catch((error) => setStatus(error.message, "error"));
      }
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-column-filter]") && state.columnFilterOpen) {
        state.columnFilterOpen = "";
        refreshFilteredViews({ includeKpis: false });
        return;
      }
      if (event.target.closest("[data-modal-close]")) {
        ensureModal().hidden = true;
        return;
      }
      if (event.target.closest("[data-client-modal-close]")) {
        backToClients();
        return;
      }
      if (event.target.closest("[data-mc-client-modal] [data-back-clients]")) {
        backToClients();
      }
    });

    document.addEventListener("submit", (event) => {
      const newProcessForm = event.target.closest("[data-new-process-form]");
      if (newProcessForm) {
        event.preventDefault();
        void createProcess(newProcessForm).catch((error) => setStatus(error.message, "error"));
        return;
      }

      const processForm = event.target.closest("[data-process-form]");
      if (processForm) {
        event.preventDefault();
        void saveSelectedProcess(processForm).catch((error) => setStatus(error.message, "error"));
        return;
      }

      const messageForm = event.target.closest("[data-message-form]");
      if (messageForm) {
        event.preventDefault();
        void sendMessage(messageForm).catch((error) => setStatus(error.message, "error"));
        return;
      }

      const profileForm = event.target.closest("[data-profile-form]");
      if (profileForm) {
        event.preventDefault();
        void savePerfilDocumental(profileForm).catch((error) => setStatus(error.message, "error"));
      }
    });

    root.addEventListener("input", (event) => {
      const textFilter = event.target.closest("[data-column-text-filter]");
      if (textFilter) {
        const key = textFilter.getAttribute("data-column-text-filter");
        if (key && Object.prototype.hasOwnProperty.call(state.columnFilters, key)) {
          state.columnFilters[key] = textFilter.value || "";
          refreshFilteredViews({ focusSelector: `[data-column-text-filter="${key}"]` });
        }
        return;
      }

      const optionSearch = event.target.closest("[data-column-filter-search-input]");
      if (optionSearch) {
        const key = optionSearch.getAttribute("data-column-filter-search-input");
        if (key && Object.prototype.hasOwnProperty.call(state.columnFilterSearch, key)) {
          state.columnFilterSearch[key] = optionSearch.value || "";
          state.columnFilterOpen = key === "owner" ? "owner" : "status";
          refreshFilteredViews({
            includeKpis: false,
            focusSelector: `[data-column-filter-search-input="${key}"]`,
          });
        }
        return;
      }

      const kitNameInput = event.target.closest("[data-kit-custom-name]");
      if (!kitNameInput) return;
      state.kitCustomName = kitNameInput.value || "";
    });

    root.addEventListener("change", (event) => {
      const filterAll = event.target.closest("[data-column-filter-all]");
      if (filterAll) {
        const key = filterAll.getAttribute("data-column-filter-all") || "";
        if (key === "owner") state.columnFilters.owners = [];
        if (key === "status") state.columnFilters.statuses = [];
        refreshFilteredViews();
        return;
      }

      const filterCheckbox = event.target.closest("[data-column-filter-checkbox]");
      if (filterCheckbox) {
        const key = filterCheckbox.getAttribute("data-column-filter-checkbox") || "";
        const value = filterCheckbox.value || "";
        const values = key === "owner" ? [...state.columnFilters.owners] : [...state.columnFilters.statuses];
        const nextValues = filterCheckbox.checked
          ? Array.from(new Set([...values, value]))
          : values.filter((item) => item !== value);
        if (key === "owner") state.columnFilters.owners = nextValues;
        if (key === "status") state.columnFilters.statuses = nextValues;
        state.columnFilterOpen = key;
        refreshFilteredViews();
        return;
      }

      const profileState = event.target.closest("[data-profile-state]");
      if (profileState) {
        toggleProfileSpouseFields(profileState.closest("[data-profile-form]"));
        return;
      }

      const uploadInput = event.target.closest("[data-upload-file]");
      if (!uploadInput) return;
      syncUploadScope(uploadInput.closest("[data-upload-scope]"));
    });

    els.search?.addEventListener("input", () => {
      state.filterText = els.search.value || "";
      render();
    });

    els.status?.addEventListener("change", () => {
      state.filterStatus = els.status.value || "";
      render();
    });

    window.addEventListener("popstate", () => {
      const nextTab = tabFromPath(window.location.pathname);
      if (nextTab !== state.activeTab) {
        state.columnFilters = defaultColumnFilters();
        state.columnFilterOpen = "";
        state.columnFilterSearch = defaultColumnFilterSearch();
      }
      state.activeTab = nextTab;
      state.selectedReserva = selectedReservaFromUrl();
      if (state.activeTab !== "gestor") state.selectedOwner = "";
      state.checklistOrigin = checklistOriginFromUrl();
      state.clientJourneyView = clientJourneyViewFromUrl();
      void loadData();
    });
  }

  applyUser();
  bindEvents();
  renderTabs();
  void loadData();
})();




