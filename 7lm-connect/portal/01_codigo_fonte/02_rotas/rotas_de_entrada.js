/**
 * Autor: Willian Elias Franca
 * Projeto: 7LM Connect - Plataforma Integrada
 * ObservaÃ§Ã£o: arquivo criado automaticamente para organizar o projeto.
 */

// Rotas de entrada (estrutura inicial).
// 02_rotas/rotas_de_entrada.js


const express = require("express");
const controladorDeEntrada = require("../03_controladores/controlador_de_entrada");

const router = express.Router();

// Browser chama: POST /api/entrada
router.post("/entrada", controladorDeEntrada.entrada);

module.exports = router;
