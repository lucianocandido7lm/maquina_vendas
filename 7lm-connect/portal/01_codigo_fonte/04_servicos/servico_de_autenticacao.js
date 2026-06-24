/**
 * Autor: Willian Elias Franca
 * Projeto: 7LM Connect - Plataforma Integrada
 * ObservaÃ§Ã£o: arquivo criado automaticamente para organizar o projeto.
 */

// ServiÃ§o de autenticaÃ§Ã£o (estrutura inicial).
// 04_servicos/servico_de_autenticacao.js


const configuracaoGeral = require("../01_configuracoes/configuracao_geral");

// âœ… endpoint correto da API
const CAMINHO_LOGIN_API = "/entrada";

async function realizarLogin({ matricula, senha }, { cabecalhosCliente } = {}) {
  const url = `${configuracaoGeral.urlApi}${CAMINHO_LOGIN_API}`;

  const resposta = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cabecalhosCliente || {}),
    },
    body: JSON.stringify({ matricula, senha }),
  });

  const corpo = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    return {
      ok: false,
      status: resposta.status,
      // FastAPI normalmente usa "detail"
      mensagem: corpo?.mensagem || corpo?.detail || "Falha no login.",
    };
  }

  return { ok: true, dados: corpo };
}

module.exports = { realizarLogin };

