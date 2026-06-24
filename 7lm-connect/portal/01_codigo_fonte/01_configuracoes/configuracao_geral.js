/**
 * Autor: Willian Elias Franca
 * Projeto: 7LM Connect - Plataforma Integrada
 */

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

function carregarEnvRobusto() {
  const base = path.resolve(__dirname, "..", ".."); // .../01_portal_em_node
  const candidatos = [
    path.join(base, ".env"),
    path.resolve(base, "..", ".env"), // .../7LM Connect_Live/.env (se você preferir centralizar)
  ];

  for (const p of candidatos) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      return p;
    }
  }
  dotenv.config();
  return null;
}

const envCarregado = carregarEnvRobusto();

module.exports = {
  autor: "Willian Elias Franca",
  nomeDoPortal: "7LM",
  ambiente: process.env.AMBIENTE || "desenvolvimento",
  porta: Number(process.env.PORTA_DO_PORTAL || 3000),
  urlApi: (process.env.SEVENLM_CONNECT_URL_API || "http://127.0.0.1:8000").replace(/\/$/, ""),
  envCarregado,
};
