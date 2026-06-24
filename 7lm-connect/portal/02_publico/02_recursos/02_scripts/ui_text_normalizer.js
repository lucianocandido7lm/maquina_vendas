(function () {
  "use strict";

  const PORTAL_DOCUMENT_TITLE = "7LM Connect";
  const ATTRIBUTE_NAMES = ["title", "aria-label", "placeholder", "alt", "data-tooltip"];
  const LOWERCASE_CONNECTORS = new Set();
  const ACRONYMS = new Set(["API", "BR", "CAT", "CCA", "CEP", "CLT", "CNPJ", "CPF", "CSV", "DAMP", "DF", "DP", "FGTS", "FSA", "GC", "GIP", "GO", "HC", "HTTP", "ID", "INSS", "IPC", "IPCA", "LGPD", "MCMV", "MFA", "PDF", "PIS", "PJ", "PRICE", "QLP", "RH", "RG", "SAC", "SLA", "SV", "UF", "URL", "XLS", "XLSX", "XML", "7LM"]);
  const WINDOWS_1252_EXTRA = {
    0x20AC: 0x80,
    0x201A: 0x82,
    0x0192: 0x83,
    0x201E: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02C6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8A,
    0x2039: 0x8B,
    0x0152: 0x8C,
    0x017D: 0x8E,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201C: 0x93,
    0x201D: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02DC: 0x98,
    0x2122: 0x99,
    0x0161: 0x9A,
    0x203A: 0x9B,
    0x0153: 0x9C,
    0x017E: 0x9E,
    0x0178: 0x9F,
  };
  const REPLACEMENTS = [
    [/\bHead\s+count\b/gi, "Headcount"],
    [/\bGap de headcount\b/gi, "Gap de Headcount"],
    [/\bSaldo do filtro\b/gi, "Gap HC"],
    [/\bMaior desvio\b/gi, "Maior Desvio"],
    [/\bFunil por status\b/gi, "Funil por Status"],
    [/\bReservas por status\b/gi, "Reservas por Status"],
    [/\bVagas por status\b/gi, "Status por Vaga"],
    [/\bResumo por equipe\b/gi, "Resumo por Equipe"],
    [/\bVer resumo\b/gi, "Ver Resumo"],
    [/\bVer vagas\b/gi, "Ver Vagas"],
    [/\bPendências cadastrais\b/gi, "Pendências Cadastrais"],
    [/\bPessoas sem objetivo aberto\b/gi, "Pessoas sem Objetivo Aberto"],
    [/\bAguardando SV\b/gi, "Aguardando Solicitação de Vaga"],
    [/\bPessoas no negocio\b/gi, "Pessoas no negócio"],
    [/\bSessao ativa\b/gi, "Sessão ativa"],
    [/\bForecast manual salvo para o mes selecionado\b/gi, "Forecast manual salvo para o mês selecionado"],
    [/\bAcesso seguro \| 2FA obrigatorio\b/g, "Acesso seguro | 2FA obrigatório"],
    [/\bAtualizacao continua\b/g, "Atualização contínua"],
    [/\bAtualizacao de\b/g, "Atualização de"],
    [/\bUltimas atualizacoes\b/g, "Últimas atualizações"],
    [/\bUltimas\b/g, "Últimas"],
    [/\bUltimo\b/g, "Último"],
    [/\bUltima\b/g, "Última"],
    [/\bOPERACOES\b/g, "OPERAÇÕES"],
    [/\bOPERACAO\b/g, "OPERAÇÃO"],
    [/\bADMINISTRACAO\b/g, "ADMINISTRAÇÃO"],
    [/\bGESTAO\b/g, "Gestão"],
    [/\bSESSAO\b/g, "SESSÃO"],
    [/\bMATRICULA\b/g, "MATRÍCULA"],
    [/\bCODIGO\b/g, "CÓDIGO"],
    [/\bATENCAO\b/g, "ATENÇÃO"],
    [/\bINICIO\b/g, "INÍCIO"],
    [/\bEXPLORACAO\b/g, "EXPLORAÇÃO"],
    [/\bNao\b/g, "Não"],
    [/\bnao\b/g, "não"],
    [/\bVoce\b/g, "Você"],
    [/\bvoce\b/g, "você"],
    [/\bOperacoes\b/g, "Operações"],
    [/\boperacoes\b/g, "operações"],
    [/\bOperacao\b/g, "Operação"],
    [/\boperacao\b/g, "operação"],
    [/\bAdministracao\b/g, "Administração"],
    [/\badministracao\b/g, "administração"],
    [/\bGestao\b/g, "Gestão"],
    [/\bgestao\b/g, "gestão"],
    [/\bSessao\b/g, "Sessão"],
    [/\bsessao\b/g, "sessão"],
    [/\bMatricula\b/g, "Matrícula"],
    [/\bmatricula\b/g, "matrícula"],
    [/\bCodigo\b/g, "Código"],
    [/\bcodigo\b/g, "código"],
    [/\bConexao\b/g, "Conexão"],
    [/\bconexao\b/g, "conexão"],
    [/\bConfiguracoes\b/g, "Configurações"],
    [/\bconfiguracoes\b/g, "configurações"],
    [/\bConfiguracao\b/g, "Configuração"],
    [/\bconfiguracao\b/g, "configuração"],
    [/\bAutenticacao\b/g, "Autenticação"],
    [/\bautenticacao\b/g, "autenticação"],
    [/\bAutorizacao\b/g, "Autorização"],
    [/\bautorizacao\b/g, "autorização"],
    [/\bServico\b/g, "Serviço"],
    [/\bservico\b/g, "serviço"],
    [/\bServicos\b/g, "Serviços"],
    [/\bservicos\b/g, "serviços"],
    [/\bPagina\b/g, "Página"],
    [/\bpagina\b/g, "página"],
    [/\bPaginas\b/g, "Páginas"],
    [/\bpaginas\b/g, "páginas"],
    [/\bCatalogo\b/g, "Catálogo"],
    [/\bcatalogo\b/g, "catálogo"],
    [/\bProxima\b/g, "Próxima"],
    [/\bproxima\b/g, "próxima"],
    [/\bSIMULACOES\b/g, "Simulações"],
    [/\bSIMULACAO\b/g, "SIMULAÇÃO"],
    [/\bSimulacoes\b/g, "Simulações"],
    [/\bsimulacoes\b/g, "simulações"],
    [/\bSimulacao\b/g, "Simulação"],
    [/\bsimulacao\b/g, "simulação"],
    [/\bCOMPOSICAO\b/g, "COMPOSIÇÃO"],
    [/\bComposicao\b/g, "Composição"],
    [/\bcomposicao\b/g, "composição"],
    [/\bIMOVEIS\b/g, "Imóveis"],
    [/\bIMOVEL\b/g, "IMÓVEL"],
    [/\bImoveis\b/g, "Imóveis"],
    [/\bimoveis\b/g, "imóveis"],
    [/\bImovel\b/g, "Imóvel"],
    [/\bimovel\b/g, "imóvel"],
    [/\bAPROVACOES\b/g, "APROVAÇÕES"],
    [/\bAPROVACAO\b/g, "APROVAÇÃO"],
    [/\bAprovacoes\b/g, "Aprovações"],
    [/\baprovacoes\b/g, "aprovações"],
    [/\bAprovação\b/g, "Aprovação"],
    [/\baprovacao\b/g, "aprovação"],
    [/\bAVALIACOES\b/g, "AVALIAÇÕES"],
    [/\bAVALIACAO\b/g, "AVALIAÇÃO"],
    [/\bAvaliacoes\b/g, "Avaliações"],
    [/\bavaliacoes\b/g, "avaliações"],
    [/\bAvaliacao\b/g, "Avaliação"],
    [/\bavaliacao\b/g, "avaliação"],
    [/\bNEGOCIACOES\b/g, "NEGOCIAÇÕES"],
    [/\bNEGOCIACAO\b/g, "NEGOCIAÇÃO"],
    [/\bNegociacoes\b/g, "Negociações"],
    [/\bnegociacoes\b/g, "negociações"],
    [/\bNegociacao\b/g, "Negociação"],
    [/\bnegociacao\b/g, "negociação"],
    [/\bDOCUMENTACAO\b/g, "DOCUMENTAÇÃO"],
    [/\bDocumentacao\b/g, "Documentação"],
    [/\bdocumentacao\b/g, "documentação"],
    [/\bENDERECOS\b/g, "ENDEREÇOS"],
    [/\bENDERECO\b/g, "ENDEREÇO"],
    [/\bEnderecos\b/g, "Endereços"],
    [/\bendereco\b/g, "endereço"],
    [/\bEndereco\b/g, "Endereço"],
    [/\benderecos\b/g, "endereços"],
    [/\bOBSERVACOES\b/g, "OBSERVAÇÕES"],
    [/\bOBSERVACAO\b/g, "OBSERVAÇÃO"],
    [/\bObservacoes\b/g, "Observações"],
    [/\bobservacoes\b/g, "observações"],
    [/\bNUCLEO\b/g, "NÚCLEO"],
    [/\bNucleo\b/g, "Núcleo"],
    [/\bnucleo\b/g, "núcleo"],
    [/\bBOTAO\b/g, "BOTÃO"],
    [/\bBotao\b/g, "Botão"],
    [/\bbotao\b/g, "botão"],
    [/\bDORMITORIOS\b/g, "DORMITÓRIOS"],
    [/\bDORMITORIO\b/g, "DORMITÓRIO"],
    [/\bDormitorios\b/g, "Dormitórios"],
    [/\bdormitorios\b/g, "dormitórios"],
    [/\bDormitorio\b/g, "Dormitório"],
    [/\bdormitorio\b/g, "dormitório"],
    [/\bSUGESTOES\b/g, "SUGESTÕES"],
    [/\bSugestoes\b/g, "Sugestões"],
    [/\bsugestoes\b/g, "sugestões"],
    [/\bOPCOES\b/g, "OPÇÕES"],
    [/\bOpcoes\b/g, "Opções"],
    [/\bopcoes\b/g, "opções"],
    [/\bAREAS\b/g, "ÁREAS"],
    [/\bAREA\b/g, "ÁREA"],
    [/\bAreas\b/g, "Áreas"],
    [/\bareas\b/g, "áreas"],
    [/\bArea\b/g, "Área"],
    [/\barea\b/g, "área"],
    [/\bORIENTACAO\b/g, "ORIENTAÇÃO"],
    [/\bOrientacao\b/g, "Orientação"],
    [/\borientacao\b/g, "orientação"],
    [/\bQUITACAO\b/g, "QUITAÇÃO"],
    [/\bQuitacao\b/g, "Quitação"],
    [/\bquitacao\b/g, "quitação"],
    [/\bELETRONICO\b/g, "ELETRÔNICO"],
    [/\bEletronico\b/g, "Eletrônico"],
    [/\beletronico\b/g, "eletrônico"],
    [/\bUSUARIO\b/g, "Usuário"],
    [/\bUsuario\b/g, "Usuário"],
    [/\busuario\b/g, "usuário"],
    [/\bSITUACAO\b/g, "SITUAÇÃO"],
    [/\bSituação\b/g, "Situação"],
    [/\bsituacao\b/g, "situação"],
    [/\bCREDITO\b/g, "CRÉDITO"],
    [/\bCredito\b/g, "Crédito"],
    [/\bcredito\b/g, "crédito"],
    [/\bObrigatoria\b/g, "Obrigatória"],
    [/\bobrigatoria\b/g, "obrigatória"],
    [/\bObrigatorio\b/g, "Obrigatório"],
    [/\bobrigatorio\b/g, "obrigatório"],
    [/\bPos-entrega\b/g, "Pós-entrega"],
    [/\bpos-entrega\b/g, "pós-entrega"],
    [/\bDisponiveis\b/g, "Disponíveis"],
    [/\bdisponiveis\b/g, "disponíveis"],
    [/\bDisponivel\b/g, "Disponível"],
    [/\bdisponivel\b/g, "disponível"],
    [/\bAcoes\b/g, "Ações"],
    [/\bacoes\b/g, "ações"],
    [/\bAcao\b/g, "Ação"],
    [/\bacao\b/g, "ação"],
    [/\bInformacoes\b/g, "Informações"],
    [/\binformacoes\b/g, "informações"],
    [/\bInformacao\b/g, "Informação"],
    [/\binformacao\b/g, "informação"],
    [/\bPermissoes\b/g, "Permissões"],
    [/\bpermissoes\b/g, "permissões"],
    [/\bPermissao\b/g, "Permissão"],
    [/\bpermissao\b/g, "permissão"],
    [/\bLideranca\b/g, "Liderança"],
    [/\blideranca\b/g, "liderança"],
    [/\bExperiencia\b/g, "Experiência"],
    [/\bexperiencia\b/g, "experiência"],
    [/\bAtencao\b/g, "Atenção"],
    [/\batencao\b/g, "atenção"],
    [/\bHistorico\b/g, "Histórico"],
    [/\bhistorico\b/g, "histórico"],
    [/\bPublico\b/g, "Público"],
    [/\bpublico\b/g, "público"],
    [/\bAnalises\b/g, "Análises"],
    [/\banalises\b/g, "análises"],
    [/\bAnalise\b/g, "Análise"],
    [/\banalise\b/g, "análise"],
    [/\bSintese\b/g, "Síntese"],
    [/\bsintese\b/g, "síntese"],
    [/\bRapidas\b/g, "Rápidas"],
    [/\brapidas\b/g, "rápidas"],
    [/\bRapida\b/g, "Rápida"],
    [/\brapida\b/g, "rápida"],
    [/\bRapido\b/g, "Rápido"],
    [/\brapido\b/g, "rápido"],
    [/\bUnicas\b/g, "Únicas"],
    [/\bunicas\b/g, "únicas"],
    [/\bUnica\b/g, "Única"],
    [/\bunica\b/g, "única"],
    [/\bUnico\b/g, "Único"],
    [/\bunico\b/g, "único"],
    [/\bPadroes\b/g, "Padrões"],
    [/\bpadroes\b/g, "padrões"],
    [/\bPadrao\b/g, "Padrão"],
    [/\bpadrao\b/g, "padrão"],
    [/\bSecoes\b/g, "Seções"],
    [/\bsecoes\b/g, "seções"],
    [/\bSecao\b/g, "Seção"],
    [/\bsecao\b/g, "seção"],
    [/\bPeríodos\b/g, "Períodos"],
    [/\bperiodos\b/g, "períodos"],
    [/\bPeríodo\b/g, "Período"],
    [/\bperiodo\b/g, "período"],
    [/\bNivel\b/g, "Nível"],
    [/\bnivel\b/g, "nível"],
    [/\bOscilacao\b/g, "Oscilação"],
    [/\boscilacao\b/g, "oscilação"],
    [/\bTensao\b/g, "Tensão"],
    [/\btensao\b/g, "tensão"],
    [/\bDecisoes\b/g, "Decisões"],
    [/\bdecisoes\b/g, "decisões"],
    [/\bDecisao\b/g, "Decisão"],
    [/\bdecisao\b/g, "decisão"],
    [/\bSequencia\b/g, "Sequência"],
    [/\bsequencia\b/g, "sequência"],
    [/\bLiberacao\b/g, "Liberação"],
    [/\bliberacao\b/g, "liberação"],
    [/\bComecamos\b/g, "Começamos"],
    [/\bcomecamos\b/g, "começamos"],
    [/\bComeca\b/g, "Começa"],
    [/\bcomeca\b/g, "começa"],
    [/\bComecar\b/g, "Começar"],
    [/\bcomecar\b/g, "começar"],
    [/\bJa\b/g, "Já"],
    [/\bja\b/g, "já"],
    [/\bAte\b/g, "Até"],
    [/\bate\b/g, "até"],
    [/\bPossivel\b/g, "Possível"],
    [/\bpossivel\b/g, "possível"],
    [/\bVisualizacoes\b/g, "Visualizações"],
    [/\bvisualizacoes\b/g, "visualizações"],
    [/\bVisualizacao\b/g, "Visualização"],
    [/\bvisualizacao\b/g, "visualização"],
    [/\bPoliticas\b/g, "Políticas"],
    [/\bpoliticas\b/g, "políticas"],
    [/\bPolitica\b/g, "Política"],
    [/\bpolitica\b/g, "política"],
    [/\bSolicitacoes\b/g, "Solicitações"],
    [/\bsolicitacoes\b/g, "solicitações"],
    [/\bSolicitacao\b/g, "Solicitação"],
    [/\bsolicitacao\b/g, "solicitação"],
    [/\bEstatisticas\b/g, "Estatísticas"],
    [/\bestatisticas\b/g, "estatísticas"],
    [/\bPreferências\b/g, "Preferências"],
    [/\bpreferências\b/g, "preferências"],
    [/\bNecessario\b/g, "Necessário"],
    [/\bnecessario\b/g, "necessário"],
    [/\bBasicos\b/g, "Básicos"],
    [/\bbasicos\b/g, "básicos"],
    [/\bTecnicos\b/g, "Técnicos"],
    [/\btecnicos\b/g, "técnicos"],
    [/\bAnaliticas\b/g, "Analíticas"],
    [/\banaliticas\b/g, "analíticas"],
    [/\bAnalitica\b/g, "Analítica"],
    [/\banalitica\b/g, "analítica"],
    [/\bAnalitico\b/g, "Analítico"],
    [/\banalitico\b/g, "analítico"],
    [/\bSegmentacao\b/g, "Segmentação"],
    [/\bsegmentacao\b/g, "segmentação"],
    [/\bLocalizacao\b/g, "Localização"],
    [/\blocalizacao\b/g, "localização"],
    [/\bPosicao\b/g, "Posição"],
    [/\bposicao\b/g, "posição"],
    [/\bHorario\b/g, "Horário"],
    [/\bhorario\b/g, "horário"],
    [/\bAlocacao\b/g, "Alocação"],
    [/\balocacao\b/g, "alocação"],
    [/\bUtilizaveis\b/g, "Utilizáveis"],
    [/\butilizaveis\b/g, "utilizáveis"],
    [/\bUtilizavel\b/g, "Utilizável"],
    [/\butilizavel\b/g, "utilizável"],
    [/\bComparacoes\b/g, "Comparações"],
    [/\bcomparacoes\b/g, "comparações"],
    [/\bComparacao\b/g, "Comparação"],
    [/\bcomparacao\b/g, "comparação"],
    [/\bConcentracao\b/g, "Concentração"],
    [/\bconcentracao\b/g, "concentração"],
    [/\bDistribuicoes\b/g, "Distribuições"],
    [/\bdistribuicoes\b/g, "distribuições"],
    [/\bDistribuicao\b/g, "Distribuição"],
    [/\bdistribuicao\b/g, "distribuição"],
    [/\bQuestoes\b/g, "Questões"],
    [/\bquestoes\b/g, "questões"],
    [/\bQuestao\b/g, "Questão"],
    [/\bquestao\b/g, "questão"],
    [/\bDescricao\b/g, "Descrição"],
    [/\bdescricao\b/g, "descrição"],
    [/\bExplicacao\b/g, "Explicação"],
    [/\bexplicacao\b/g, "explicação"],
    [/\bRecomendacao\b/g, "Recomendação"],
    [/\brecomendacao\b/g, "recomendação"],
    [/\bRecomendacoes\b/g, "Recomendações"],
    [/\brecomendacoes\b/g, "recomendações"],
    [/\bSustentacao\b/g, "Sustentação"],
    [/\bsustentacao\b/g, "sustentação"],
    [/\bClassificacao\b/g, "Classificação"],
    [/\bclassificacao\b/g, "classificação"],
    [/\bCalibracao\b/g, "Calibração"],
    [/\bcalibracao\b/g, "calibração"],
    [/\bHierarquia\b/g, "Hierarquia"],
    [/\bExploracao\b/g, "Exploração"],
    [/\bexploracao\b/g, "exploração"],
    [/\bDicionario\b/g, "Dicionário"],
    [/\bdicionario\b/g, "dicionário"],
    [/\bSupervisao\b/g, "Supervisão"],
    [/\bsupervisao\b/g, "supervisão"],
    [/\bCoordenacao\b/g, "Coordenação"],
    [/\bcoordenacao\b/g, "coordenação"],
    [/\bOcupacao\b/g, "Ocupação"],
    [/\bocupacao\b/g, "ocupação"],
    [/\bAvaliacoes\b/g, "Avaliações"],
    [/\bavaliacoes\b/g, "avaliações"],
    [/\bInteracoes\b/g, "Interações"],
    [/\binteracoes\b/g, "interações"],
    [/\bSeguranca\b/g, "Segurança"],
    [/\bseguranca\b/g, "segurança"],
    [/\bComunicacao\b/g, "Comunicação"],
    [/\bcomunicacao\b/g, "comunicação"],
    [/\bPromocao\b/g, "Promoção"],
    [/\bpromocao\b/g, "promoção"],
    [/\bPropositos\b/g, "Propósitos"],
    [/\bpropositos\b/g, "propósitos"],
    [/\bDemograficos\b/g, "Demográficos"],
    [/\bdemograficos\b/g, "demográficos"],
    [/\bSOLUCOES\b/g, "SOLUÇÕES"],
    [/\bSolucoes\b/g, "Soluções"],
    [/\bsolucoes\b/g, "soluções"],
    [/\bInteligencia\b/g, "Inteligência"],
    [/\binteligencia\b/g, "inteligência"],
    [/\bRelatórios\b/g, "Relatórios"],
    [/\brelatorios\b/g, "relatórios"],
    [/\bRelatório\b/g, "Relatório"],
    [/\brelatorio\b/g, "relatório"],
    [/\bNotificacoes\b/g, "Notificações"],
    [/\bnotificacoes\b/g, "notificações"],
    [/\bHistoria\b/g, "História"],
    [/\bhistoria\b/g, "história"],
    [/\bTrajetoria\b/g, "Trajetória"],
    [/\btrajetoria\b/g, "trajetória"],
    [/\bTendencias\b/g, "Tendências"],
    [/\btendencias\b/g, "tendências"],
    [/\bTendencia\b/g, "Tendência"],
    [/\btendencia\b/g, "tendência"],
    [/\bGraficos\b/g, "Gráficos"],
    [/\bgraficos\b/g, "gráficos"],
    [/\bGlossario\b/g, "Glossário"],
    [/\bglossario\b/g, "glossário"],
    [/\bArvore\b/g, "Árvore"],
    [/\barvore\b/g, "árvore"],
    [/\bPressao\b/g, "Pressão"],
    [/\bpressao\b/g, "pressão"],
    [/\bIntradiaria\b/g, "Intradiária"],
    [/\bintradiaria\b/g, "intradiária"],
    [/\bModulo\b/g, "Módulo"],
    [/\bmodulo\b/g, "módulo"],
    [/\bObservacao\b/g, "Observação"],
    [/\bobservacao\b/g, "observação"],
    [/\bMes\b/g, "Mês"],
    [/\bmes\b/g, "mês"],
    [/\bDiarios\b/g, "Diários"],
    [/\bdiarios\b/g, "diários"],
    [/\bDiario\b/g, "Diário"],
    [/\bdiario\b/g, "diário"],
    [/\bDiarias\b/g, "Diárias"],
    [/\bdiarias\b/g, "diárias"],
    [/\bDiaria\b/g, "Diária"],
    [/\bdiaria\b/g, "diária"],
    [/Ja adicionei/g, "Já adicionei"],
    [/\bPortifolio\b/g, "Portfólio"],
    [/\bportifolio\b/g, "portfólio"],
    [/\bPortfolio\b/g, "Portfólio"],
    [/\bportfolio\b/g, "portfólio"],
    [/\bRelogio\b/g, "Relógio"],
    [/\brelogio\b/g, "relógio"],
    [/\bAutomático\b/g, "Automático"],
    [/\bautomatico\b/g, "automático"],
    [/\bAtivacao\b/g, "Ativação"],
    [/\bativacao\b/g, "ativação"],
    [/\bAtualizações\b/g, "Atualizações"],
    [/\batualizacoes\b/g, "atualizações"],
    [/\bAtualizacao\b/g, "Atualização"],
    [/\batualizacao\b/g, "atualização"],
    [/\bPredominio\b/g, "Predomínio"],
    [/\bpredominio\b/g, "predomínio"],
    [/\bFavoravel\b/g, "Favorável"],
    [/\bfavoravel\b/g, "favorável"],
    [/\bInvalido\b/g, "Inválido"],
    [/\binvalido\b/g, "inválido"],
    [/\bInvalida\b/g, "Inválida"],
    [/\binvalida\b/g, "inválida"],
    [/\bDigitos\b/g, "Dígitos"],
    [/\bdigitos\b/g, "dígitos"],
    [/pos-atendimento/g, "pós-atendimento"],
    [/Im\?vel/g, "Imóvel"],
    [/im\?vel/g, "imóvel"],
    [/aprova\?\?o/g, "aprovação"],
    [/Aprova\?\?o/g, "Aprovação"],
    [/negocia\?\?o/g, "negociação"],
    [/Negocia\?\?o/g, "Negociação"],
    [/avalia\?\?o/g, "avaliação"],
    [/Avalia\?\?o/g, "Avaliação"],
    [/simula\?\?o/g, "simulação"],
    [/Simula\?\?o/g, "Simulação"],
    [/est\? aguardando/g, "está aguardando"],
    [/est\? dentro/g, "está dentro"],
    [/Ajust\? obrigaterio/g, "Ajuste obrigatório"],
  ];

  function mojibakeScore(text) {
    return (text.match(/[\u00c3\u00c2\u00e2\ufffd]/g) || []).length;
  }

  function encodeWindows1252(text) {
    const bytes = [];
    for (const char of text) {
      const code = char.codePointAt(0);
      if (code <= 0xFF) {
        bytes.push(code);
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(WINDOWS_1252_EXTRA, code)) {
        bytes.push(WINDOWS_1252_EXTRA[code]);
        continue;
      }
      return null;
    }
    return new Uint8Array(bytes);
  }

  function tryUtf8Repair(text) {
    try {
      const bytes = encodeWindows1252(text);
      if (!bytes) return text;
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return text;
    }
  }

  function repairMojibake(text) {
    let current = text;
    for (let i = 0; i < 3; i += 1) {
      const candidate = tryUtf8Repair(current);
      if (!candidate || candidate === current) break;
      if (mojibakeScore(candidate) > mojibakeScore(current)) break;
      current = candidate;
    }
    return current;
  }

  function hasLetters(text) {
    return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(text);
  }

  function isMostlyUppercase(text) {
    const letters = text.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || [];
    if (letters.length < 3) return false;
    const lowercase = letters.filter((char) => char === char.toLocaleLowerCase("pt-BR") && char !== char.toLocaleUpperCase("pt-BR")).length;
    return lowercase === 0;
  }

  function titleCaseWord(word, index) {
    if (!hasLetters(word)) return word;
    const clean = word.replace(/^[^\wÀ-ÖØ-öø-ÿ]+|[^\wÀ-ÖØ-öø-ÿ]+$/g, "");
    const prefix = word.slice(0, word.indexOf(clean));
    const suffix = word.slice(prefix.length + clean.length);
    const upper = clean.toLocaleUpperCase("pt-BR");
    const lower = clean.toLocaleLowerCase("pt-BR");
    if (ACRONYMS.has(upper)) return `${prefix}${upper}${suffix}`;
    if (index > 0 && LOWERCASE_CONNECTORS.has(lower)) return `${prefix}${lower}${suffix}`;
    return `${prefix}${lower.charAt(0).toLocaleUpperCase("pt-BR")}${lower.slice(1)}${suffix}`;
  }

  function titleCaseVisibleText(text) {
    if (!isMostlyUppercase(text)) return text;
    return text.split(/(\s+)/).map((part, index) => /\s+/.test(part) ? part : titleCaseWord(part, index)).join("");
  }

  function shouldKeepTextCasing(text) {
    return !/\p{L}/u.test(text) || /@/.test(text) || /\b(?:https?:\/\/|www\.|[A-Za-z0-9.-]+\.[A-Za-z]{2,})(?:\/|\b)/i.test(text);
  }

  function shouldKeepTokenCasing(token) {
    if (!token) return true;
    const upper = token.toLocaleUpperCase("pt-BR");
    if (ACRONYMS.has(upper)) return true;
    if (/^(?=.*\d)[A-Z0-9._/-]+$/u.test(token)) return true;
    if (/^(?:[A-Za-z]\.){2,}[A-Za-z]?\.?$/u.test(token)) return true;
    if (/^\d+(?:[.,]\d+)?[A-Za-z]+$/u.test(token)) return true;
    return false;
  }

  function titleCaseVisibleWord(word) {
    if (!/\p{L}/u.test(word)) return word;
    const clean = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!clean) return word;
    const prefix = word.slice(0, word.indexOf(clean));
    const suffix = word.slice(prefix.length + clean.length);
    const upper = clean.toLocaleUpperCase("pt-BR");
    if (shouldKeepTokenCasing(clean)) {
      return `${prefix}${ACRONYMS.has(upper) ? upper : clean}${suffix}`;
    }
    const lower = clean.toLocaleLowerCase("pt-BR");
    return `${prefix}${lower.charAt(0).toLocaleUpperCase("pt-BR")}${lower.slice(1)}${suffix}`;
  }

  function titleCaseVisibleText(text) {
    if (shouldKeepTextCasing(text)) return text;
    return text.split(/(\s+)/).map((part) => /\s+/.test(part) ? part : titleCaseVisibleWord(part)).join("");
  }

  function normalizeText(text) {
    if (typeof text !== "string" || !text) return text;
    let result = repairMojibake(text);
    for (const [pattern, replacement] of REPLACEMENTS) {
      result = result.replace(pattern, replacement);
    }
    return titleCaseVisibleText(result);
  }

  function shouldSkipElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return true;
    const tagName = element.tagName;
    if (tagName === "SCRIPT" || tagName === "STYLE" || tagName === "NOSCRIPT" || tagName === "TEXTAREA" || tagName === "CODE" || tagName === "PRE") {
      return true;
    }
    return Boolean(element.closest("[data-skip-text-normalizer]"));
  }

  function normalizeAttributes(element) {
    if (shouldSkipElement(element)) return;
    ATTRIBUTE_NAMES.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      const current = element.getAttribute(attribute);
      const normalized = normalizeText(current);
      if (normalized !== current) {
        element.setAttribute(attribute, normalized);
      }
    });
  }

  function normalizeTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const parent = node.parentElement;
    if (shouldSkipElement(parent)) return;
    const current = node.nodeValue;
    if (!current || !current.trim()) return;
    const normalized = normalizeText(current);
    if (normalized !== current) {
      node.nodeValue = normalized;
    }
  }

  function normalizeNodeTree(rootNode) {
    if (!rootNode) return;
    if (rootNode.nodeType === Node.TEXT_NODE) {
      normalizeTextNode(rootNode);
      return;
    }

    if (rootNode.nodeType !== Node.ELEMENT_NODE && rootNode.nodeType !== Node.DOCUMENT_NODE) {
      return;
    }

    const rootElement = rootNode.nodeType === Node.DOCUMENT_NODE ? rootNode.documentElement : rootNode;
    if (!rootElement) return;

    if (rootElement.nodeType === Node.ELEMENT_NODE) {
      normalizeAttributes(rootElement);
    }

    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let current = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        normalizeAttributes(current);
      } else if (current.nodeType === Node.TEXT_NODE) {
        normalizeTextNode(current);
      }
      current = walker.nextNode();
    }
  }

  function resolvePortalDocumentTitle() {
    const path = String(window.location.pathname || "").toLowerCase();
    if (path.includes("/metas")) return "7LM | Abertura e Objetivos";
    if (path.includes("/comercial/dashboard")) return "7LM | Dashboard Comercial";
    if (path.includes("/comercial") || path.includes("/clientes") || path.includes("/simulador") || path.includes("/imoveis")) {
      return "7LM Aprovador de Vendas";
    }
    return normalizeText(document.title || PORTAL_DOCUMENT_TITLE);
  }

  function setPortalDocumentTitle() {
    const nextTitle = resolvePortalDocumentTitle();
    if (document.title !== nextTitle) {
      document.title = nextTitle;
    }
  }

  function observeMutations() {
    const path = String(window.location.pathname || "").toLowerCase();
    if (path.includes("/gente-cultura") || document.body?.classList.contains("tl-dashboard-gc-page")) {
      return;
    }

    const target = document.documentElement;
    if (!target) return;

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === "characterData") {
          normalizeTextNode(record.target);
          return;
        }

        if (record.type === "attributes") {
          normalizeAttributes(record.target);
          return;
        }

        record.addedNodes.forEach((node) => {
          normalizeNodeTree(node);
        });
      });

      setPortalDocumentTitle();
    });

    observer.observe(target, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTE_NAMES,
    });
  }

  function init() {
    setPortalDocumentTitle();
    normalizeNodeTree(document);
    setPortalDocumentTitle();
    observeMutations();
  }

  window.SevenLMConnectUiTextNormalizer = {
    normalizeText,
    scan: () => normalizeNodeTree(document),
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
