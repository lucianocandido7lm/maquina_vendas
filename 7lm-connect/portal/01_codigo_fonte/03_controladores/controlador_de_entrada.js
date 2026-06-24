/**
 * Autor: Willian Elias Franca
 * Projeto: 7LM Connect - Plataforma Integrada
 * ObservaÃ§Ã£o: arquivo criado automaticamente para organizar o projeto.
 */

// Controlador de entrada (estrutura inicial).
// 03_controladores/controlador_de_entrada.js

const { realizarLogin } = require("../04_servicos/servico_de_autenticacao");

function extrairCabecalhosCliente(req) {
  // repassa informaÃ§Ãµes Ãºteis pra auditoria da API
  return {
    "user-agent": req.headers["user-agent"] || "",
    "accept-language": req.headers["accept-language"] || "",
    "referer": req.headers["referer"] || "",
    "origin": req.headers["origin"] || "",
    "x-forwarded-for": req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "",
  };
}

async function entrada(req, res) {
  try {
    const matricula = String(req.body?.matricula || "").trim();
    const senha = String(req.body?.senha || "");

    if (!matricula || !senha) {
      return res.status(400).json({ mensagem: "Informe matrÃ­cula e senha." });
    }

    const resultado = await realizarLogin(
      { matricula, senha },
      { cabecalhosCliente: extrairCabecalhosCliente(req) }
    );

    if (!resultado.ok) {
      return res.status(resultado.status || 401).json({ mensagem: resultado.mensagem || "Falha no login." });
    }

    return res.status(200).json(resultado.dados);
  } catch (e) {
    console.error("Erro no login:", e);
    return res.status(500).json({ mensagem: "Erro interno no login." });
  }
}

module.exports = { entrada };

