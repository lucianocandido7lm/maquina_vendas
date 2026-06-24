/**
 * Autor: Willian Elias Franca
 * Projeto: 7LM Connect - Plataforma Integrada
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const express = require("express");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const dotenv = require("dotenv");
const fetch = global.fetch || require("node-fetch");
const pdfParse = require("pdf-parse");
const { renderizarSidebarPortal } = require("./componentes/sidebar_portal");

const fsp = fs.promises;
let ConfidentialClientApplication = null;
const agentHttpKeepAlive = new http.Agent({
  keepAlive: true,
  maxSockets: 64,
});
const agentHttpsKeepAlive = new https.Agent({
  keepAlive: true,
  maxSockets: 64,
});

try {
  ({ ConfidentialClientApplication } = require("@azure/msal-node"));
} catch (erro) {
  ConfidentialClientApplication = null;
}

function carregarEnv() {
  const basePortal = path.resolve(__dirname, "..");
  const candidatos = [
    path.join(basePortal, ".env"),
    path.resolve(basePortal, "..", ".env"),
  ];

  for (const caminho of candidatos) {
    if (fs.existsSync(caminho)) {
      dotenv.config({ path: caminho });
      return caminho;
    }
  }

  dotenv.config();
  return null;
}

function lerBooleanoEnv(nome, padrao = false) {
  const valor = process.env[nome];
  if (valor === undefined || valor === null || String(valor).trim() === "") {
    return padrao;
  }

  return ["1", "true", "yes", "y", "on", "sim"].includes(String(valor).trim().toLowerCase());
}

function lerTextoEnv(candidatos, padrao = "") {
  for (const nome of candidatos) {
    const valor = process.env[nome];
    if (valor === undefined || valor === null) continue;
    const texto = String(valor).trim();
    if (texto) return texto;
  }

  return padrao;
}

function lerBooleanoEnvComAlias(candidatos, padrao = false) {
  for (const nome of candidatos) {
    const valor = process.env[nome];
    if (valor === undefined || valor === null || String(valor).trim() === "") {
      continue;
    }

    return ["1", "true", "yes", "y", "on", "sim"].includes(String(valor).trim().toLowerCase());
  }

  return padrao;
}

function gerarTokenAleatorio() {
  return crypto.randomBytes(32).toString("hex");
}

function normalizarTexto(valor) {
  return String(valor || "").trim();
}

function base64Json(valor) {
  return Buffer.from(JSON.stringify(valor), "utf8").toString("base64");
}

function coletarValoresComoTexto(...candidatos) {
  const itens = [];

  for (const candidato of candidatos) {
    if (Array.isArray(candidato)) {
      for (const item of candidato) {
        const texto = normalizarTexto(item);
        if (texto) itens.push(texto);
      }
      continue;
    }

    const texto = normalizarTexto(candidato);
    if (texto) itens.push(texto);
  }

  return itens;
}

function coletarListaEnv(candidatos, padrao = []) {
  const bruto = lerTextoEnv(candidatos);
  if (!bruto) {
    return Array.from(new Set(coletarValoresComoTexto(padrao)));
  }

  return Array.from(new Set(String(bruto).split(/[,\s;]+/).map(normalizarTexto).filter(Boolean)));
}

function normalizarHost(valor = "") {
  const texto = normalizarTexto(valor).toLowerCase();
  if (!texto) return "";
  return texto.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split("/")[0].replace(/:\d+$/, "");
}

function normalizarOrigemUrl(valor = "", protocoloPadrao = "https") {
  let texto = normalizarTexto(valor);
  if (!texto) return "";

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(texto)) {
    texto = `${protocoloPadrao}://${texto}`;
  }

  try {
    const url = new URL(texto);
    return `${url.protocol}//${url.host}`;
  } catch (erro) {
    return "";
  }
}

function montarIdentificadoresFederados(claims) {
  const identificadores = new Set();
  const dados = claims || {};

  for (const valorOriginal of coletarValoresComoTexto(
    dados.preferred_username,
    dados.email,
    dados.upn,
    dados.unique_name,
    dados.emails
  )) {
    const valor = valorOriginal.toLowerCase();
    identificadores.add(valor);

    const arroba = valor.indexOf("@");
    if (arroba > 0) {
      identificadores.add(valor.slice(0, arroba));
    }
  }

  return Array.from(identificadores);
}

function normalizarBasePath(valor) {
  const texto = normalizarTexto(valor);
  if (!texto || texto === "/") return "";
  return `/${texto.replace(/^\/+|\/+$/g, "")}`;
}

function aplicarBasePath(basePath, caminho = "/") {
  const texto = normalizarTexto(caminho) || "/";
  const normalizado = texto.startsWith("/") ? texto : `/${texto}`;
  if (!basePath) {
    return normalizado === "//" ? "/" : normalizado;
  }
  return normalizado === "/" ? basePath : `${basePath}${normalizado}`;
}

function mimePorExtensao(extensao) {
  switch (extensao) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return null;
  }
}

function garantirBarraInicial(valor = "") {
  const texto = String(valor || "");
  return texto.startsWith("/") ? texto : `/${texto}`;
}

function normalizarRotaPublica(valor = "/") {
  const texto = garantirBarraInicial(valor);
  return texto.replace(/\/{2,}/g, "/");
}

function caminhoRelativoSeguro(caminhoUrl) {
  const normalizado = path.posix.normalize(garantirBarraInicial(caminhoUrl));
  if (normalizado.includes("..")) return null;
  return normalizado.replace(/^\/+/, "");
}

function resolverDentroDaPasta(base, relativo) {
  const absoluto = path.resolve(base, relativo);
  const relativoParaBase = path.relative(base, absoluto);
  if (!relativoParaBase || relativoParaBase === "") {
    return absoluto;
  }
  if (relativoParaBase.startsWith("..") || path.isAbsolute(relativoParaBase)) {
    return null;
  }
  return absoluto;
}

function listarArquivosRecursivos(base) {
  const itens = [];
  const pilha = [base];

  while (pilha.length > 0) {
    const atual = pilha.pop();
    if (!atual || !fs.existsSync(atual)) continue;

    for (const entrada of fs.readdirSync(atual, { withFileTypes: true })) {
      const caminho = path.join(atual, entrada.name);
      if (entrada.isDirectory()) {
        pilha.push(caminho);
        continue;
      }
      if (entrada.isFile()) itens.push(caminho);
    }
  }

  return itens;
}

function obterAgenteKeepAlive(url) {
  const texto = normalizarTexto(url);
  return texto.startsWith("https://") ? agentHttpsKeepAlive : agentHttpKeepAlive;
}

const envPath = carregarEnv();

const PORTA = Number(lerTextoEnv(["SEVENLM_CONNECT_PORTA_DO_PORTAL", "PORTA_DO_PORTAL"], "3000"));
const API_BASE = normalizarTexto(
  lerTextoEnv(["SEVENLM_CONNECT_URL_API", "SEVENLM_CONNECT_URL_API"], "http://127.0.0.1:8000")
).replace(/\/$/, "");
const AMBIENTE = normalizarTexto(process.env.AMBIENTE || "desenvolvimento");
const BASE_PATH = normalizarBasePath(
  lerTextoEnv(["SEVENLM_CONNECT_BASE_PATH", "SEVENLM_CONNECT_BASE_PATH"], "")
);
const HOME_URL = aplicarBasePath(BASE_PATH, "/");
const LOGIN_URL = aplicarBasePath(BASE_PATH, "/acesso");
const LOGIN_MODAL_URL = `${HOME_URL}?abrir_login=1`;
const ORIGEM_LOCAL_PORTAL = `http://localhost:${PORTA}`;
const ORIGEM_PUBLICA_PORTAL = normalizarOrigemUrl(
  lerTextoEnv(
    ["SEVENLM_CONNECT_URL_PUBLICA_PORTAL", "SEVENLM_CONNECT_URL_PUBLICA"],
    AMBIENTE === "producao" ? "https://maquinadevendas7lm.app.br" : ""
  ),
  AMBIENTE === "producao" ? "https" : "http"
);
const DOMINIO_PUBLICO_PRIMARIO =
  normalizarHost(lerTextoEnv(["SEVENLM_CONNECT_DOMINIO_PRIMARIO"], ORIGEM_PUBLICA_PORTAL)) ||
  (AMBIENTE === "producao" ? "maquinadevendas7lm.app.br" : "");
const DOMINIOS_PUBLICOS_REDIRECIONAR = coletarListaEnv(
  ["SEVENLM_CONNECT_DOMINIOS_REDIRECIONAR"],
  ["7lm.app.br"]
)
  .map(normalizarHost)
  .filter((item) => item && item !== DOMINIO_PUBLICO_PRIMARIO);
const ENFORCAR_DOMINIO_PUBLICO = lerBooleanoEnvComAlias(
  ["SEVENLM_CONNECT_ENFORCAR_DOMINIO_PUBLICO"],
  AMBIENTE === "producao"
);
const COOKIE_DOMAIN =
  normalizarHost(
    lerTextoEnv(
      ["SEVENLM_CONNECT_COOKIE_DOMAIN"],
      AMBIENTE === "producao" ? DOMINIO_PUBLICO_PRIMARIO : ""
    )
  ) || "";
const ORIGEM_PADRAO_PORTAL = ORIGEM_PUBLICA_PORTAL || ORIGEM_LOCAL_PORTAL;
const PROTOCOLO_PUBLICO_CANONICO = ORIGEM_PUBLICA_PORTAL
  ? String(new URL(ORIGEM_PUBLICA_PORTAL).protocol || "").replace(/:$/, "")
  : "";

function montarUrlModalDeLogin(mensagem = "") {
  const params = new URLSearchParams();
  params.set("abrir_login", "1");
  if (mensagem) {
    params.set("erro_msg", String(mensagem));
  }
  return `${HOME_URL}?${params.toString()}`;
}

function montarUrlDeAcesso(mensagem = "") {
  if (!mensagem) {
    return LOGIN_URL;
  }
  return `${LOGIN_URL}?erro_msg=${encodeURIComponent(String(mensagem))}`;
}

const ENTRA_ID_HABILITADO = lerBooleanoEnvComAlias(
  ["SEVENLM_CONNECT_ENTRA_ID_HABILITADO", "SEVENLM_CONNECT_ENTRA_ID_HABILITADO"],
  false
);
const ENTRA_TENANT_ID = normalizarTexto(
  lerTextoEnv(["SEVENLM_CONNECT_ENTRA_TENANT_ID", "SEVENLM_CONNECT_ENTRA_TENANT_ID"])
);
const ENTRA_CLIENT_ID = normalizarTexto(
  lerTextoEnv(["SEVENLM_CONNECT_ENTRA_CLIENT_ID", "SEVENLM_CONNECT_ENTRA_CLIENT_ID"])
);
const ENTRA_CLIENT_SECRET = normalizarTexto(
  lerTextoEnv(["SEVENLM_CONNECT_ENTRA_CLIENT_SECRET", "SEVENLM_CONNECT_ENTRA_CLIENT_SECRET"])
);
const ENTRA_REDIRECT_URI = normalizarTexto(
  lerTextoEnv(["SEVENLM_CONNECT_ENTRA_REDIRECT_URI", "SEVENLM_CONNECT_ENTRA_REDIRECT_URI"]) ||
    `${ORIGEM_PADRAO_PORTAL}${aplicarBasePath(BASE_PATH, "/auth/entra/redirect")}`
);
const ENTRA_POST_LOGOUT_REDIRECT_URI = normalizarTexto(
  lerTextoEnv(
    ["SEVENLM_CONNECT_ENTRA_POST_LOGOUT_REDIRECT_URI", "SEVENLM_CONNECT_ENTRA_POST_LOGOUT_REDIRECT_URI"]
  ) ||
    `${ORIGEM_PADRAO_PORTAL}${LOGIN_URL}`
);
const ENTRA_SCOPES = coletarValoresComoTexto(
  String(
    lerTextoEnv(["SEVENLM_CONNECT_ENTRA_SCOPES", "SEVENLM_CONNECT_ENTRA_SCOPES"], "openid profile email")
  ).split(/[,\s]+/)
);
const ENTRA_BRIDGE_SECRET = normalizarTexto(
  lerTextoEnv(["SEVENLM_CONNECT_ENTRA_BRIDGE_SECRET", "SEVENLM_CONNECT_ENTRA_BRIDGE_SECRET"])
);
const SESSION_SECRET =
  normalizarTexto(lerTextoEnv(["SEVENLM_CONNECT_SESSION_SECRET", "SEVENLM_CONNECT_SESSION_SECRET"])) ||
  gerarTokenAleatorio();
const SESSION_COOKIE_NAME = "sevenlm_connect_portal_session";
const ENTRA_AUTHORITY = ENTRA_TENANT_ID
  ? `https://login.microsoftOnline.com/${ENTRA_TENANT_ID}`
  : "";
const OFUSCAR_FRONT = lerBooleanoEnvComAlias(
  ["SEVENLM_CONNECT_OFUSCAR_FRONT", "SEVENLM_CONNECT_OFUSCAR_FRONT"],
  true
);

const ENTRA_CONFIGURADO = Boolean(
  ENTRA_ID_HABILITADO &&
    ENTRA_TENANT_ID &&
    ENTRA_CLIENT_ID &&
    ENTRA_CLIENT_SECRET &&
    ENTRA_REDIRECT_URI &&
    ENTRA_BRIDGE_SECRET &&
    ConfidentialClientApplication
);

const clienteEntra = ENTRA_CONFIGURADO
  ? new ConfidentialClientApplication({
      auth: {
        clientId: ENTRA_CLIENT_ID,
        authority: ENTRA_AUTHORITY,
        clientSecret: ENTRA_CLIENT_SECRET,
      },
    })
  : null;

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
const HOSTS_LOCAIS_LIBERADOS = new Set(["localhost", "127.0.0.1", "::1"]);
const HOSTS_PUBLICOS_VALIDOS = new Set(
  [DOMINIO_PUBLICO_PRIMARIO, ...DOMINIOS_PUBLICOS_REDIRECIONAR].filter(Boolean)
);

function obterHostDaRequisicao(req) {
  const forwardedHost = normalizarTexto(req.headers["x-forwarded-host"] || "").split(",")[0];
  const hostAtual = forwardedHost || req.headers.host || req.hostname || "";
  return normalizarHost(hostAtual);
}

function obterProtocoloDaRequisicao(req) {
  const forwardedProto = normalizarTexto(req.headers["x-forwarded-proto"] || "").split(",")[0].toLowerCase();
  if (forwardedProto) return forwardedProto;
  return req.secure ? "https" : "http";
}

function montarUrlCanonica(req) {
  const protocolo = PROTOCOLO_PUBLICO_CANONICO || obterProtocoloDaRequisicao(req);
  const caminho = req.originalUrl || req.url || "/";
  return `${protocolo}://${DOMINIO_PUBLICO_PRIMARIO}${caminho}`;
}

app.use((req, res, next) => {
  if (!ENFORCAR_DOMINIO_PUBLICO || !DOMINIO_PUBLICO_PRIMARIO) {
    return next();
  }

  const hostAtual = obterHostDaRequisicao(req);
  if (!hostAtual || HOSTS_LOCAIS_LIBERADOS.has(hostAtual)) {
    return next();
  }

  if (hostAtual === DOMINIO_PUBLICO_PRIMARIO) {
    return next();
  }

  if (HOSTS_PUBLICOS_VALIDOS.has(hostAtual)) {
    return res.redirect(308, montarUrlCanonica(req));
  }

  return res.status(421).send("Host não autorizado.");
});

app.use((req, res, next) => {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "SAMEORIGIN");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "permissions-policy",
    "accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  );
  res.setHeader("cross-origin-opener-policy", "same-origin");
  res.setHeader("cross-origin-resource-policy", "same-origin");
  res.setHeader("origin-agent-cluster", "?1");
  res.setHeader("x-robots-tag", "noindex, nofollow, noarchive, nosnippet");
  res.setHeader("content-security-policy", montarCabecalhoContentSecurityPolicy());
  return next();
});
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: AMBIENTE === "producao",
      domain: COOKIE_DOMAIN || undefined,
      path: BASE_PATH || "/",
      maxAge: 15 * 60 * 1000,
    },
  })
);

const pastaPublica = path.resolve(__dirname, "..", "02_publico");
const pastaUploadsCreditu = path.resolve(__dirname, "..", "uploads", "creditu");
const LIMITE_UPLOAD_PDF_CREDITU_BYTES = 8 * 1024 * 1024;
const LIMITE_UPLOAD_ANEXO_CREDITU_BYTES = 8 * 1024 * 1024;
const LIMITE_UPLOAD_CREDITU_TOTAL_BYTES = LIMITE_UPLOAD_PDF_CREDITU_BYTES + (2 * LIMITE_UPLOAD_ANEXO_CREDITU_BYTES) + 512 * 1024;
const EMBUTIR_ASSETS_HTML = lerBooleanoEnvComAlias(
  ["SEVENLM_CONNECT_EMBUTIR_ASSETS_HTML", "SEVENLM_CONNECT_EMBUTIR_ASSETS_HTML"],
  true
);
const extensoesAssetsOfuscados = new Set([
  ".css",
  ".js",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".ico",
  ".avif",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
]);
const aliasPorArquivoPublico = new Map();
const arquivoPublicoPorAlias = new Map();
const caminhosExperience = [
  path.join(pastaPublica, "02_recursos", "01_estilos", "experiencia"),
  path.join(pastaPublica, "02_recursos", "02_scripts", "experiencia"),
  path.join(pastaPublica, "02_recursos", "03_imagens", "experiencia"),
  path.join(pastaPublica, "02_recursos", "03_imagens"),
];
const caminhosSemAssetsEmbutidos = new Set([
  "/01_paginas/entrada.html",
  "/01_paginas/Comercial/dashboard.html",
  "/01_paginas/Comercial/dashboard_maquina_vendas.html",
  "/01_paginas/MaqCredito/index.html",
  "/01_paginas/MaqCredito/login.html",
  "/01_paginas/MaqCredito/corretor.html",
  "/01_paginas/MaqCredito/analista.html",
  "/01_paginas/MaqCredito/analista_checklist.html",
  "/01_paginas/MaqCredito/cca_acompanhamento.html",
  "/01_paginas/MaqCredito/cca_checklist.html",
  "/01_paginas/MaqCredito/gestor_checklist.html",
  "/01_paginas/MaqCredito/gestor_telemetria.html",
  "/01_paginas/MaqCredito/painel_checklist_documentos.html",
]);
const caminhosSemOfuscacaoDeAssets = new Set([
  "/01_paginas/Comercial/dashboard.html",
  "/01_paginas/Comercial/dashboard_maquina_vendas.html",
  "/01_paginas/MaqCredito/index.html",
  "/01_paginas/MaqCredito/login.html",
  "/01_paginas/MaqCredito/corretor.html",
  "/01_paginas/MaqCredito/analista.html",
  "/01_paginas/MaqCredito/analista_checklist.html",
  "/01_paginas/MaqCredito/cca_acompanhamento.html",
  "/01_paginas/MaqCredito/cca_checklist.html",
  "/01_paginas/MaqCredito/gestor_checklist.html",
  "/01_paginas/MaqCredito/gestor_telemetria.html",
  "/01_paginas/MaqCredito/painel_checklist_documentos.html",
]);

const rotasAmigaveis = new Map([
  ["/", "01_paginas/entrada.html"],
  ["/acesso", "01_paginas/acesso.html"],
  ["/inicio", "01_paginas/inicio.html"],
  ["/comercial", "01_paginas/Clientes/cadastro.html"],
  ["/comercial/imoveis", "01_paginas/Imoveis/listagem.html"],
  ["/comercial/imoveis/cadastro", "01_paginas/Imoveis/cadastro.html"],
  ["/comercial/clientes", "01_paginas/Clientes/cadastro.html"],
  ["/comercial/simulador", "01_paginas/Comercial/simulador.html"],
  ["/comercial/dashboard", "01_paginas/Comercial/dashboard.html"],
  ["/comercial/maquina-vendas/dashboard", "01_paginas/Comercial/dashboard_maquina_vendas.html"],
  ["/maq-credito", "01_paginas/MaqCredito/index.html"],
  ["/maq-credito/corretor", "01_paginas/MaqCredito/index.html"],
  ["/maq-credito/analista", "01_paginas/MaqCredito/index.html"],
  ["/maq-credito/analista/checklist", "01_paginas/MaqCredito/index.html"],
  ["/maq-credito/cca/acompanhamento", "01_paginas/MaqCredito/index.html"],
  ["/maq-credito/cca/checklist", "01_paginas/MaqCredito/index.html"],
  ["/maq-credito/gestor/checklist", "01_paginas/MaqCredito/index.html"],
  ["/maq-credito/gestor/telemetria", "01_paginas/MaqCredito/index.html"],
  ["/maq-credito/painel/checklist-documentos", "01_paginas/MaqCredito/index.html"],
  ["/gente-cultura/dashboard", "01_paginas/GenteCultura/dashboard.html"],
  ["/gente-cultura/equipes", "01_paginas/GenteCultura/dashboard.html"],
  ["/gente-cultura/aprovacoes", "01_paginas/GenteCultura/dashboard.html"],
  ["/gente-cultura/vagas", "01_paginas/GenteCultura/dashboard.html"],
  ["/gente-cultura/pessoas", "01_paginas/GenteCultura/dashboard.html"],
  ["/gente-cultura/produtividade", "01_paginas/GenteCultura/dashboard.html"],
  ["/gente-cultura/comercial", "01_paginas/GenteCultura/dashboard.html"],
  ["/gente-cultura/metricas", "01_paginas/GenteCultura/dashboard.html"],
  ["/gente-cultura/historico", "01_paginas/GenteCultura/dashboard.html"],
  ["/metas/corretores", "01_paginas/Metas/resultados.html"],
  ["/metas/gestores", "01_paginas/Metas/resultados.html"],
  ["/metas/regionais", "01_paginas/Metas/resultados.html"],
  ["/metas/gerenciais", "01_paginas/Metas/resultados.html"],
  ["/metas/historico", "01_paginas/Metas/resultados.html"],
  ["/metas/indicadores", "01_paginas/Metas/resultados.html"],
  ["/administracao", "01_paginas/Administracao/acessos.html"],
  ["/administracao/acessos", "01_paginas/Administracao/acessos.html"],
  ["/administracao/funcionarios", "01_paginas/Administracao/funcionarios.html"],
  ["/administracao/aprovacoes", "01_paginas/Administracao/aprovacoes.html"],
]);

const redirecionamentosAmigaveis = new Map([
  ["/apresentacao", "/"],
  ["/entrada.html", "/"],
  ["/acesso.html", "/acesso"],
  ["/inicio.html", "/inicio"],
  ["/plataforma", "/comercial/clientes"],
  ["/plataforma/", "/comercial/clientes"],
  ["/comercial", "/comercial/clientes"],
  ["/comercial/", "/comercial/clientes"],
  ["/imoveis", "/comercial/imoveis"],
  ["/imoveis/", "/comercial/imoveis"],
  ["/imoveis/cadastro", "/comercial/imoveis/cadastro"],
  ["/imoveis/cadastro/", "/comercial/imoveis/cadastro"],
  ["/comercial/imoveis/", "/comercial/imoveis"],
  ["/comercial/imoveis/cadastro/", "/comercial/imoveis/cadastro"],
  ["/comercial/clientes/", "/comercial/clientes"],
  ["/comercial/simulador/", "/comercial/simulador"],
  ["/comercial/dashboard/", "/comercial/dashboard"],
  ["/comercial/maquina-vendas/dashboard/", "/comercial/maquina-vendas/dashboard"],
  ["/maq-credito/", "/maq-credito"],
  ["/maq-credito/login", "/maq-credito"],
  ["/maq-credito/login/", "/maq-credito"],
  ["/maq-credito/corretor/", "/maq-credito/corretor"],
  ["/maq-credito/analista/", "/maq-credito/analista"],
  ["/maq-credito/analista/checklist/", "/maq-credito/analista/checklist"],
  ["/maq-credito/cca/acompanhamento/", "/maq-credito/cca/acompanhamento"],
  ["/maq-credito/cca/checklist/", "/maq-credito/cca/checklist"],
  ["/maq-credito/gestor/checklist/", "/maq-credito/gestor/checklist"],
  ["/maq-credito/gestor/telemetria/", "/maq-credito/gestor/telemetria"],
  ["/maq-credito/painel/checklist-documentos/", "/maq-credito/painel/checklist-documentos"],
  ["/corretor", "/maq-credito/corretor"],
  ["/corretor/", "/maq-credito/corretor"],
  ["/analista", "/maq-credito/analista"],
  ["/analista/", "/maq-credito/analista"],
  ["/analista/checklist", "/maq-credito/analista/checklist"],
  ["/analista/checklist/", "/maq-credito/analista/checklist"],
  ["/cca/acompanhamento", "/maq-credito/cca/acompanhamento"],
  ["/cca/acompanhamento/", "/maq-credito/cca/acompanhamento"],
  ["/cca/checklist", "/maq-credito/cca/checklist"],
  ["/cca/checklist/", "/maq-credito/cca/checklist"],
  ["/gestor/checklist", "/maq-credito/gestor/checklist"],
  ["/gestor/checklist/", "/maq-credito/gestor/checklist"],
  ["/gestor/telemetria", "/maq-credito/gestor/telemetria"],
  ["/gestor/telemetria/", "/maq-credito/gestor/telemetria"],
  ["/painel/checklist-documentos", "/maq-credito/painel/checklist-documentos"],
  ["/painel/checklist-documentos/", "/maq-credito/painel/checklist-documentos"],
  ["/dashboard-gc", "/gente-cultura/dashboard"],
  ["/dashboard-gc/", "/gente-cultura/dashboard"],
  ["/gente-cultura", "/gente-cultura/dashboard"],
  ["/gente-cultura/", "/gente-cultura/dashboard"],
  ["/gente-cultura/dashboard/", "/gente-cultura/dashboard"],
  ["/gente-cultura/equipes/", "/gente-cultura/equipes"],
  ["/gente-cultura/aprovacoes/", "/gente-cultura/aprovacoes"],
  ["/gente-cultura/vagas/", "/gente-cultura/vagas"],
  ["/gente-cultura/pessoas/", "/gente-cultura/pessoas"],
  ["/gente-cultura/produtividade/", "/gente-cultura/produtividade"],
  ["/gente-cultura/comercial/", "/gente-cultura/comercial"],
  ["/gente-cultura/metricas/", "/gente-cultura/metricas"],
  ["/gente-cultura/historico/", "/gente-cultura/historico"],
  ["/metas", "/metas/corretores"],
  ["/metas/", "/metas/corretores"],
  ["/metas/dashboard", "/metas/corretores"],
  ["/metas/dashboard/", "/metas/corretores"],
  ["/metas/corretores/", "/metas/corretores"],
  ["/metas/gestores/", "/metas/gestores"],
  ["/metas/regionais/", "/metas/regionais"],
  ["/metas/gerenciais/", "/metas/gerenciais"],
  ["/metas/indicadores/", "/metas/indicadores"],
  ["/metas/resultados", "/metas/corretores"],
  ["/metas/resultados/", "/metas/corretores"],
  ["/metas/corretor", "/metas/corretores"],
  ["/metas/corretor/", "/metas/corretores"],
  ["/metas/gestor", "/metas/corretores"],
  ["/metas/gestor/", "/metas/corretores"],
  ["/metas/historico/", "/metas/historico"],
  ["/administracao/funcionarios/", "/administracao/funcionarios"],
  ["/clientes", "/comercial/clientes"],
  ["/clientes/", "/comercial/clientes"],
  ["/simulador", "/comercial/simulador"],
  ["/simulador/", "/comercial/simulador"],
  ["/01_paginas/Imoveis/listagem.html", "/comercial/imoveis"],
  ["/01_paginas/Imoveis/cadastro.html", "/comercial/imoveis/cadastro"],
  ["/01_paginas/Clientes/cadastro.html", "/comercial/clientes"],
  ["/01_paginas/Comercial/simulador.html", "/comercial/simulador"],
  ["/01_paginas/Comercial/dashboard_maquina_vendas.html", "/comercial/maquina-vendas/dashboard"],
  ["/01_paginas/MaqCredito/login.html", "/maq-credito"],
  ["/01_paginas/MaqCredito/index.html", "/maq-credito"],
  ["/01_paginas/MaqCredito/corretor.html", "/maq-credito/corretor"],
  ["/01_paginas/MaqCredito/analista.html", "/maq-credito/analista"],
  ["/01_paginas/MaqCredito/analista_checklist.html", "/maq-credito/analista/checklist"],
  ["/01_paginas/MaqCredito/cca_acompanhamento.html", "/maq-credito/cca/acompanhamento"],
  ["/01_paginas/MaqCredito/cca_checklist.html", "/maq-credito/cca/checklist"],
  ["/01_paginas/MaqCredito/gestor_checklist.html", "/maq-credito/gestor/checklist"],
  ["/01_paginas/MaqCredito/gestor_telemetria.html", "/maq-credito/gestor/telemetria"],
  ["/01_paginas/MaqCredito/painel_checklist_documentos.html", "/maq-credito/painel/checklist-documentos"],
  ["/01_paginas/GenteCultura/dashboard.html", "/gente-cultura/dashboard"],
  ["/01_paginas/Metas/resultados.html", "/metas/corretores"],
  ["/paineis/hora-a-hora", "/comercial/imoveis"],
  ["/paineis/agente", "/comercial/imoveis"],
  ["/paineis/habilidade", "/comercial/imoveis"],
  ["/painel.html", "/comercial/imoveis"],
  ["/painel_hora_a_hora.html", "/comercial/imoveis"],
  ["/painel_por_agente.html", "/comercial/imoveis"],
  ["/painel_por_habilidade.html", "/comercial/imoveis"],
  ["/operacional", "/comercial/imoveis"],
  ["/configuracoes", "/inicio"],
  ["/configuracoes/", "/inicio"],
  ["/configuracoes_do_usuario.html", "/inicio"],
  ["/RH/index.html", "/inicio"],
  ["/pesquisa.html", "/inicio"],
  ["/RH/pesquisa.html", "/inicio"],
  ["/pesquisa-lideranca.html", "/inicio"],
  ["/RH/pesquisa-lideranca.html", "/inicio"],
  ["/pesquisa-bem-estar-seguranca.html", "/inicio"],
  ["/RH/pesquisa-bem-estar-seguranca.html", "/inicio"],
  ["/pesquisa-valores-propositos.html", "/inicio"],
  ["/RH/pesquisa-valores-propositos.html", "/inicio"],
  ["/pesquisa-reconhecimento-promocao-crescimento.html", "/inicio"],
  ["/RH/pesquisa-reconhecimento-promocao-crescimento.html", "/inicio"],
  ["/pesquisa-comunicacao.html", "/inicio"],
  ["/RH/pesquisa-comunicacao.html", "/inicio"],
  ["/pesquisa-demograficos.html", "/inicio"],
  ["/RH/pesquisa-demograficos.html", "/inicio"],
  ["/Administracao/acessos.html", "/administracao/acessos"],
  ["/Administracao/funcionarios.html", "/administracao/funcionarios"],
  ["/Administracao/aprovacoes.html", "/administracao/aprovacoes"],
  ["/01_paginas/entrada.html", "/"],
  ["/01_paginas/acesso.html", "/acesso"],
  ["/01_paginas/inicio.html", "/inicio"],
  ["/01_paginas/painel.html", "/comercial/imoveis"],
  ["/01_paginas/painel_hora_a_hora.html", "/comercial/imoveis"],
  ["/01_paginas/painel_por_agente.html", "/comercial/imoveis"],
  ["/01_paginas/painel_por_habilidade.html", "/comercial/imoveis"],
  ["/01_paginas/configuracoes_do_usuario.html", "/inicio"],
  ["/01_paginas/RH/index.html", "/inicio"],
  ["/01_paginas/Administracao/acessos.html", "/administracao/acessos"],
  ["/01_paginas/Administracao/funcionarios.html", "/administracao/funcionarios"],
  ["/01_paginas/Administracao/aprovacoes.html", "/administracao/aprovacoes"],
  ["/01_paginas/experiencia_sevenlm_connect.html", "/inicio"],
  ["/01_paginas/Operacoes/catalogo.html", "/comercial/clientes"],
]);

function construirAliasDeArquivoPublico(caminhoPublico) {
  const extensao = path.posix.extname(caminhoPublico).toLowerCase();
  const hash = crypto.createHash("sha1").update(caminhoPublico).digest("hex").slice(0, 20);
  return `/_r/${hash}${extensao}`;
}

function registrarAliasDeArquivoPublico(caminhoPublico) {
  const caminhoNormalizado = normalizarRotaPublica(caminhoPublico);
  const extensao = path.posix.extname(caminhoNormalizado).toLowerCase();
  if (!extensoesAssetsOfuscados.has(extensao)) {
    return null;
  }

  const aliasExistente = aliasPorArquivoPublico.get(caminhoNormalizado);
  if (aliasExistente) {
    return aliasExistente;
  }

  const alias = construirAliasDeArquivoPublico(caminhoNormalizado);
  aliasPorArquivoPublico.set(caminhoNormalizado, alias);
  arquivoPublicoPorAlias.set(alias, caminhoNormalizado);
  return alias;
}

function registrarAliasesIniciaisDosArquivosPublicos() {
  for (const caminhoArquivo of listarArquivosRecursivos(pastaPublica)) {
    const relativo = path.relative(pastaPublica, caminhoArquivo).split(path.sep).join("/");
    registrarAliasDeArquivoPublico(`/${relativo}`);
  }
}

registrarAliasesIniciaisDosArquivosPublicos();

function montarPaginaBridge(payload, destino) {
  const envelopeBase64 = base64Json({
    payload,
    destino,
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>7LM - autenticando</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #08121f;
      color: #f4f7fb;
      font-family: Arial, sans-serif;
    }
    .box {
      width: min(92vw, 480px);
      padding: 28px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    h1 {
      margin: 0 0 10px;
      font-size: 1.15rem;
    }
    p {
      margin: 0;
      color: rgba(244, 247, 251, 0.82);
      line-height: 1.55;
    }
  </style>
</head>
<body>
  <div class="box">
    <h1>Concluindo seu acesso</h1>
    <p>Estamos preparando sua sessão segura e redirecionando você para o ambiente 7LM.</p>
  </div>
  <script id="sevenlm-connect-entra-payload" type="application/json">${envelopeBase64}</script>
  <script>
    (function () {
      try {
        var raw = document.getElementById("sevenlm-connect-entra-payload").textContent || "";
        var envelope = JSON.parse(atob(raw));
        var payload = envelope && envelope.payload ? envelope.payload : {};
        var destino = (envelope && envelope.destino) || "${aplicarBasePath(BASE_PATH, "/inicio")}";
        var access = payload.token_de_acesso || payload.access_token || payload.token || "";
        var refresh = payload.token_de_renovacao || payload.refresh_token || "";

        if (!access) {
          window.location.replace("${LOGIN_URL}?erro_msg=" + encodeURIComponent("O login Microsoft não retornou token interno do portal."));
          return;
        }

        sessionStorage.setItem("sevenlm_connect_token_de_acesso", access);
        sessionStorage.setItem("sevenlm_connect_token_de_acesso", access);
        if (refresh) {
          sessionStorage.setItem("sevenlm_connect_token_de_renovacao", refresh);
          sessionStorage.setItem("sevenlm_connect_token_de_renovacao", refresh);
        }
        if (payload.usuario) {
          var usuarioSerializado = JSON.stringify(payload.usuario);
          sessionStorage.setItem("sevenlm_connect_usuario", usuarioSerializado);
          sessionStorage.setItem("sevenlm_connect_usuario", usuarioSerializado);
        }
        var loginAt = new Date().toISOString();
        sessionStorage.setItem("sevenlm_connect_login_at", loginAt);
        sessionStorage.setItem("sevenlm_connect_login_at", loginAt);
        sessionStorage.setItem("sevenlm_connect_provedor_login", "entra_id");
        sessionStorage.setItem("sevenlm_connect_provedor_login", "entra_id");

        window.location.replace(destino || "${aplicarBasePath(BASE_PATH, "/inicio")}");
      } catch (erro) {
        window.location.replace("${LOGIN_URL}?erro_msg=" + encodeURIComponent("Falha ao concluir o login Microsoft no navegador."));
      }
    })();
  </script>
</body>
</html>`;
}

function reescreverUrlRelativaHtml(url, caminhoPublico = "/") {
  const valor = String(url || "");
  if (
    !valor ||
    valor.startsWith("#") ||
    valor.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(valor)
  ) {
    return valor;
  }

  const matchRecursos = valor.match(/^(?:\.\.\/)+(02_recursos\/.+)$/i);
  if (matchRecursos) {
    return aplicarBasePath(BASE_PATH, `/${matchRecursos[1]}`);
  }

  return valor;
}

function quebrarUrlLocal(url) {
  const valor = String(url || "");
  if (
    !valor ||
    valor.startsWith("#") ||
    valor.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(valor)
  ) {
    return null;
  }

  const match = valor.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const pathnameOriginal = normalizarTexto(match && match[1]);
  if (!pathnameOriginal.startsWith("/")) {
    return null;
  }

  let pathnameSemBase = pathnameOriginal;
  if (BASE_PATH && pathnameSemBase === BASE_PATH) {
    pathnameSemBase = "/";
  } else if (BASE_PATH && pathnameSemBase.startsWith(`${BASE_PATH}/`)) {
    pathnameSemBase = pathnameSemBase.slice(BASE_PATH.length);
  }

  return {
    pathnameNormalizado: normalizarRotaPublica(pathnameSemBase),
    query: match && match[2] ? match[2] : "",
    hash: match && match[3] ? match[3] : "",
  };
}

function protegerUrlDeAssetPublico(url) {
  if (!OFUSCAR_FRONT) {
    return url;
  }

  const partes = quebrarUrlLocal(url);
  if (!partes) {
    return url;
  }

  const alias = aliasPorArquivoPublico.get(partes.pathnameNormalizado);
  if (!alias) {
    return url;
  }

  return `${aplicarBasePath(BASE_PATH, alias)}${partes.query}${partes.hash}`;
}

function resolverUrlLocalContraContexto(url, caminhoPublico = "/") {
  const valor = String(url || "");
  if (
    !valor ||
    valor.startsWith("#") ||
    valor.startsWith("%23") ||
    valor.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(valor) ||
    valor.startsWith("data:") ||
    valor.startsWith("blob:")
  ) {
    return null;
  }

  const match = valor.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const pathnameOriginal = normalizarTexto(match && match[1]);
  const query = match && match[2] ? match[2] : "";
  const hash = match && match[3] ? match[3] : "";

  let pathnameNormalizado = "";
  if (pathnameOriginal.startsWith("/")) {
    const partes = quebrarUrlLocal(pathnameOriginal);
    if (!partes) return null;
    pathnameNormalizado = partes.pathnameNormalizado;
  } else {
    const pastaBase = path.posix.dirname(normalizarRotaPublica(caminhoPublico));
    pathnameNormalizado = normalizarRotaPublica(path.posix.join(pastaBase, pathnameOriginal));
  }

  return {
    pathnameNormalizado,
    query,
    hash,
  };
}

function reescreverUrlCss(url, caminhoPublico = "/") {
  const partes = resolverUrlLocalContraContexto(url, caminhoPublico);
  if (!partes) {
    return url;
  }

  const alias = OFUSCAR_FRONT ? aliasPorArquivoPublico.get(partes.pathnameNormalizado) : null;
  const caminhoFinal = alias
    ? aplicarBasePath(BASE_PATH, alias)
    : aplicarBasePath(BASE_PATH, partes.pathnameNormalizado);

  return `${caminhoFinal}${partes.query}${partes.hash}`;
}

function reescreverConteudoCssPublico(conteudo, caminhoPublico = "/") {
  let resultado = String(conteudo || "");
  const placeholdersDataUrl = [];

  resultado = resultado.replace(/url\(\s*(["'])data:[\s\S]*?\1\s*\)/gi, (trecho) => {
    const token = `__SEVENLM_CONNECT_DATA_URL_${placeholdersDataUrl.length}__`;
    placeholdersDataUrl.push([token, trecho]);
    return token;
  });

  resultado = resultado.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi, (trecho, aspas, url) => {
    const urlReescrita = reescreverUrlCss(url, caminhoPublico);
    return `url("${urlReescrita}")`;
  });

  resultado = resultado.replace(/@import\s+(?:url\()?["']([^"']+)["']\)?/gi, (trecho, url) => {
    const urlReescrita = reescreverUrlCss(url, caminhoPublico);
    return `@import url("${urlReescrita}")`;
  });

  for (const [token, trecho] of placeholdersDataUrl) {
    resultado = resultado.replace(token, () => trecho);
  }

  return resultado;
}

function resolverArquivoLocalDoHtml(url, caminhoPublico = "/") {
  const partes = resolverUrlLocalContraContexto(url, caminhoPublico);
  if (!partes) {
    return null;
  }

  const caminhoArquivo = resolverArquivoPortal(partes.pathnameNormalizado);
  if (!caminhoArquivo || !fs.existsSync(caminhoArquivo) || !fs.statSync(caminhoArquivo).isFile()) {
    return null;
  }

  return {
    caminhoArquivo,
    caminhoPublico: partes.pathnameNormalizado,
  };
}

function escaparConteudoParaScriptInline(conteudo) {
  return String(conteudo || "").replace(/<\/script/gi, "<\\/script");
}

function escaparConteudoParaStyleInline(conteudo) {
  return String(conteudo || "").replace(/<\/style/gi, "<\\/style");
}

function embutirAssetsLocaisNoHtml(conteudo, caminhoPublico = "/") {
  const caminhoNormalizado = normalizarRotaPublica(caminhoPublico || "/");

  // A homepage importada da Find carrega muitos bundles e deve continuar externa
  // para evitar respostas HTML enormes e manter o carregamento previsível.
  if (!EMBUTIR_ASSETS_HTML || caminhosSemAssetsEmbutidos.has(caminhoNormalizado)) {
    return String(conteudo || "");
  }

  let resultado = String(conteudo || "");

  resultado = resultado.replace(
    /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/gi,
    (tag, href) => {
      const alvo = resolverArquivoLocalDoHtml(href, caminhoPublico);
      if (!alvo) {
        return tag;
      }

      const bruto = fs.readFileSync(alvo.caminhoArquivo, "utf8");
      const cssProcessado = reescreverConteudoPublico(bruto, {
        caminhoPublico: alvo.caminhoPublico,
        extensao: ".css",
      });

      return `<style data-inline-asset="style">${escaparConteudoParaStyleInline(cssProcessado)}</style>`;
    }
  );

  resultado = resultado.replace(
    /<script\b(?=[^>]*\bsrc=["']([^"']+)["'])([^>]*)>\s*<\/script>/gi,
    (tag, src) => {
      const alvo = resolverArquivoLocalDoHtml(src, caminhoPublico);
      if (!alvo) {
        return tag;
      }

      const bruto = fs.readFileSync(alvo.caminhoArquivo, "utf8");
      const jsProcessado = reescreverConteudoPublico(bruto, {
        caminhoPublico: alvo.caminhoPublico,
        extensao: ".js",
      });

      return `<script data-inline-asset="script">${escaparConteudoParaScriptInline(jsProcessado)}</script>`;
    }
  );

  return resultado;
}

function minificarHtmlConservador(conteudo) {
  const blocosPreservados = [];
  const tokenizarBloco = (trecho) => {
    const token = `__SEVENLM_CONNECT_HTML_BLOCO_${blocosPreservados.length}__`;
    blocosPreservados.push([token, trecho]);
    return token;
  };

  let resultado = String(conteudo || "").replace(
    /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
    tokenizarBloco
  );

  resultado = resultado
    .replace(/<!--(?!\s*\[if|\s*<!|\s*\[endif)[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\r?\n+/g, "")
    .trim();

  for (const [token, trecho] of blocosPreservados) {
    resultado = resultado.replace(token, () => trecho);
  }

  return resultado;
}

function montarCabecalhoContentSecurityPolicy() {
  const diretivas = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "frame-src 'self' blob: data: https://www.openstreetmap.org https://*.openstreetmap.org https://www.google.com https://maps.google.com",
    "form-action 'self' https://login.microsoftOnline.com",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "connect-src 'self' https:",
  ];

  return diretivas.join("; ");
}

function reescreverConteudoPublico(conteudo, opcoes = {}) {
  const caminhoPublico = normalizarRotaPublica(opcoes.caminhoPublico || "/");
  const extensao = String(opcoes.extensao || "").toLowerCase();
  let resultado = String(conteudo || "");

  if (extensao === ".html" && /\btl-sidebar\b/i.test(resultado)) {
    resultado = resultado.replace(
      /<aside\b[^>]*class=["'][^"']*\btl-sidebar\b[^"']*["'][\s\S]*?<\/aside>/i,
      renderizarSidebarPortal(caminhoPublico, { basePath: BASE_PATH })
    );
  }

  resultado = resultado.replace(
    /(<meta\s+name=["']sevenlm-connect-api-base-url["']\s+content=["'])http:\/\/127\.0\.0\.1:8000(["'][^>]*>)/gi,
    "$1$2"
  );

  resultado = resultado.replace(/http:\/\/127\.0\.0\.1:8000\/api/g, aplicarBasePath(BASE_PATH, "/api"));

  if (BASE_PATH) {
    resultado = resultado.replace(
      /(^|[\s("'=:`])\/(api|auth|01_paginas|02_recursos|experience)(?=\/)/gm,
      (_, prefixo, segmento) => `${prefixo}${BASE_PATH}/${segmento}`
    );
  }

  if (extensao === ".css") {
    resultado = reescreverConteudoCssPublico(resultado, caminhoPublico);
  }

  if (extensao === ".html") {
    resultado = resultado.replace(
      /((?:href|src|content)=["'])([^"']+)(["'])/gi,
      (_, prefixo, url, sufixo) =>
        `${prefixo}${reescreverUrlRelativaHtml(url, caminhoPublico)}${sufixo}`
    );

    resultado = embutirAssetsLocaisNoHtml(resultado, caminhoPublico);

    if (OFUSCAR_FRONT && !caminhosSemOfuscacaoDeAssets.has(caminhoPublico)) {
      resultado = resultado.replace(
        /((?:href|src)=["'])([^"']+)(["'])/gi,
        (_, prefixo, url, sufixo) => `${prefixo}${protegerUrlDeAssetPublico(url)}${sufixo}`
      );
    }
  }

  resultado = resultado
    .replace(/window\.location\.replace\((["'])\/\1\)/g, `window.location.replace("${HOME_URL}")`)
    .replace(/window\.location\.href\s*=\s*(["'])\/\1/g, `window.location.href = "${HOME_URL}"`)
    .replace(
      /(\?\s*["'][^"']*auth\/entra\/sair["']\s*:\s*)["']\/["']/g,
      `$1"${HOME_URL}"`
    );

  if (extensao === ".html" && OFUSCAR_FRONT && !caminhosSemOfuscacaoDeAssets.has(caminhoPublico)) {
    resultado = minificarHtmlConservador(resultado);
  }

  return resultado;
}

async function safeBody(resposta) {
  const tipo = (resposta.headers.get("content-type") || "").toLowerCase();
  if (tipo.includes("application/json")) {
    return resposta.json().catch(() => ({}));
  }
  return resposta.text().catch(() => "");
}

function respostaTemCorpoTextual(contentType) {
  const tipo = String(contentType || "").toLowerCase();
  if (!tipo) return true;
  return (
    tipo.includes("application/json") ||
    tipo.includes("application/problem+json") ||
    tipo.startsWith("text/") ||
    tipo.includes("application/javascript") ||
    tipo.includes("application/xml") ||
    tipo.includes("text/xml")
  );
}

async function salvarSessao(req) {
  await new Promise((resolve, reject) => {
    req.session.save((erro) => (erro ? reject(erro) : resolve()));
  });
}

function limparEstadoEntra(req) {
  if (req.session && req.session.sevenlmEntra) {
    delete req.session.sevenlmEntra;
  }
}

function limparCookieSessaoPortal(res) {
  const opcoesCookie = {
    domain: COOKIE_DOMAIN || undefined,
    path: BASE_PATH || "/",
  };
  res.clearCookie(SESSION_COOKIE_NAME, opcoesCookie);
  if ((BASE_PATH || "/") !== "/") {
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  }
}

function encerrarSessaoPortal(req, res, callback) {
  try {
    limparEstadoEntra(req);
  } catch (_) {}

  const finalizar = () => {
    limparCookieSessaoPortal(res);
    callback();
  };

  if (req.session) {
    req.session.destroy(() => finalizar());
    return;
  }

  finalizar();
}

function redirecionarParaEntradaComMensagem(res, mensagem) {
  const destino = montarUrlDeAcesso(String(mensagem || "Falha ao autenticar."));
  return res.redirect(destino);
}

async function concluirLoginFederadoNaApi(req, claims) {
  const url = `${API_BASE}/entrada/entra-id/concluir`;
  const dados = claims || {};
  const preferredUsername = normalizarTexto(
    dados.preferred_username || dados.upn || dados.unique_name
  );
  const email = normalizarTexto(dados.email || (Array.isArray(dados.emails) ? dados.emails[0] : ""));

  const resposta = await fetch(url, {
    method: "POST",
    agent: obterAgenteKeepAlive(url),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "user-agent": req.headers["user-agent"] || "",
      "x-sevenlm-connect-entra-bridge-secret": ENTRA_BRIDGE_SECRET,
      "x-sevenlm-entra-bridge-secret": ENTRA_BRIDGE_SECRET,
      "x-forwarded-for": req.headers["x-forwarded-for"] || ((req.socket && req.socket.remoteAddress) || ""),
      "accept-language": req.headers["accept-language"] || "",
    },
    body: JSON.stringify({
      oid: normalizarTexto(dados.oid),
      tenant_id: normalizarTexto(dados.tid || ENTRA_TENANT_ID),
      preferred_username: preferredUsername,
      email,
      nome_completo: normalizarTexto(dados.name),
      identificadores: montarIdentificadoresFederados(claims),
      roles: Array.isArray(dados.roles) ? dados.roles : [],
    }),
  });

  return {
    ok: resposta.ok,
    status: resposta.status,
    payload: await safeBody(resposta),
  };
}

function montarDestinoApi(caminhoApi) {
  const caminho = normalizarRotaPublica(caminhoApi);

  if (caminho === "/entrada") {
    return `${API_BASE}/entrada`;
  }

  if (caminho === "/entrada/atualizar-credencial") {
    return `${API_BASE}/atualizar-credencial`;
  }

  if (caminho === "/saude") {
    return `${API_BASE}/saude`;
  }

  if (caminho.startsWith("/mfa/")) {
    return `${API_BASE}${caminho}`;
  }

  if (caminho === "/me" || caminho.startsWith("/admin/") || caminho.startsWith("/rh/")) {
    return `${API_BASE}/api${caminho}`;
  }

  return `${API_BASE}/api${caminho}`;
}

async function lerCorpoBrutoDaRequisicao(req) {
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === "string") {
    return Buffer.from(req.body);
  }

  if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
    return null;
  }

  return await new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    req.on("end", () => {
      resolve(chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0));
    });

    req.on("error", reject);
  });
}

function extrairBoundaryMultipart(contentType) {
  const match = String(contentType || "").match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match ? String(match[1] || match[2] || "").trim() : "";
}

function parseMultipartFormData(buffer, contentType) {
  const boundary = extrairBoundaryMultipart(contentType);
  if (!boundary) {
    throw new Error("Boundary multipart não encontrado.");
  }

  const delimiter = Buffer.from(`--${boundary}`);
  const fields = {};
  const files = [];
  let cursor = buffer.indexOf(delimiter);

  while (cursor >= 0) {
    cursor += delimiter.length;

    if (buffer[cursor] === 45 && buffer[cursor + 1] === 45) break;
    if (buffer[cursor] === 13 && buffer[cursor + 1] === 10) cursor += 2;

    let next = buffer.indexOf(delimiter, cursor);
    if (next < 0) next = buffer.length;

    let end = next;
    if (end >= 2 && buffer[end - 2] === 13 && buffer[end - 1] === 10) {
      end -= 2;
    }

    const part = buffer.slice(cursor, end);
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd >= 0) {
      const headerText = part.slice(0, headerEnd).toString("utf8");
      const content = part.slice(headerEnd + 4);
      const disposition = headerText.match(/content-disposition:\s*([^\r\n]+)/i)?.[1] || "";
      const name = disposition.match(/name="([^"]+)"/i)?.[1] || "";
      const filename = disposition.match(/filename="([^"]*)"/i)?.[1] || "";
      const contentTypePart = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "";

      if (name && filename) {
        files.push({
          name,
          filename,
          contentType: contentTypePart,
          buffer: content,
          size: content.length,
        });
      } else if (name) {
        fields[name] = content.toString("utf8").trim();
      }
    }

    cursor = buffer.indexOf(delimiter, next);
  }

  return { fields, files };
}

function normalizarTextoPdfCreditu(valor) {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseNumeroPtBr(valor) {
  const texto = String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/[^\d,.-]/g, "")
    .trim();
  if (!texto) return 0;
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : 0;
}

function capturarNumeroPtBr(texto, regex) {
  const match = texto.match(regex);
  return match ? parseNumeroPtBr(match[1]) : 0;
}

function capturarTexto(texto, regex) {
  const match = texto.match(regex);
  return match ? String(match[1] || "").replace(/\s+/g, " ").trim() : "";
}

function converterDataCredituParaIso(valor) {
  const match = String(valor || "").match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function montarIntervalosSacCreditu(campos) {
  const prazo = Math.max(Math.min(Number(campos.prazo || 0), 60), 0);
  const totalFinanciado = Number(campos.total_financiado || 0);
  const taxaMensal = Number(campos.taxa_mensal || 0);
  const inicial = Number(campos.parcela_inicial || 0);
  const final = Number(campos.parcela_final || 0);
  const intervalos = [];

  if (prazo <= 0) return intervalos;

  if (String(campos.sistema || "").toUpperCase() === "SAC" && totalFinanciado > 0 && taxaMensal > 0) {
    const amortizacao = totalFinanciado / prazo;
    for (let parcela = 1; parcela <= prazo; parcela += 1) {
      const saldo = Math.max(totalFinanciado - (amortizacao * (parcela - 1)), 0);
      intervalos.push({
        parcela_inicio: parcela,
        parcela_fim: parcela,
        valor: Math.round((amortizacao + (saldo * taxaMensal)) * 100) / 100,
      });
    }
  } else if (inicial > 0 && final > 0 && prazo > 1) {
    for (let parcela = 1; parcela <= prazo; parcela += 1) {
      const fator = (parcela - 1) / (prazo - 1);
      intervalos.push({
        parcela_inicio: parcela,
        parcela_fim: parcela,
        valor: Math.round((inicial + ((final - inicial) * fator)) * 100) / 100,
      });
    }
  } else if (inicial > 0) {
    intervalos.push({ parcela_inicio: 1, parcela_fim: prazo, valor: inicial });
  }

  const parcela7lm = Number(campos.parcela_7lm_20 || campos.parcela_final || campos.parcela_inicial || 0);
  if (parcela7lm > 0) {
    intervalos.push({
      parcela_inicio: 61,
      parcela_fim: 80,
      valor: Math.round(parcela7lm * 100) / 100,
    });
  }

  return intervalos;
}

async function extrairSimulacaoCredituPdf(buffer) {
  const resultado = await pdfParse(buffer);
  const texto = normalizarTextoPdfCreditu(resultado.text || "");

  const parcelaInicial = capturarNumeroPtBr(
    texto,
    /SUA\s+PARCELA\s+INICIAL\s+ESTIMADA\s*R\$\s*([\d.]+,\d{2})/i
  );
  const valorEntrada = capturarNumeroPtBr(texto, /Valor\s+da\s+Entrada\s*R\$\s*([\d.]+,\d{2})/i);
  const totalFinanciado = capturarNumeroPtBr(texto, /Total\s+financiado\s*R\$\s*([\d.]+,\d{2})/i);
  const prazo = Number(capturarTexto(texto, /Prazo\s+escolhido\s*(\d+)\s*meses/i)) || 0;
  const vencimento = capturarTexto(texto, /Vencimento\s+da\s+1[ªa]\s+Parcela\s*(\d{2}[-/]\d{2}[-/]\d{4})/i);
  const sistema = capturarTexto(texto, /Sistema\s+de\s+Amortização\s*([A-Z]+)/i).toUpperCase() || "SAC";
  const parcelaFinal = capturarNumeroPtBr(texto, /Valor\s+da\s+Última\s+Parcela\s+Estimada\s*R\$\s*([\d.]+,\d{2})/i);
  const taxaAnualPercentual = capturarNumeroPtBr(texto, /Taxa\s+de\s+Juros\s*([\d.,]+)%\s*\(a\.a\.\)/i);
  const taxaMensalPercentual = capturarNumeroPtBr(texto, /\|\s*([\d.,]+)%\s*a\.m\./i);
  const emissao = capturarTexto(texto, /Emissão:\s*(\d{2}[-/]\d{2}[-/]\d{4})/i);
  const validoAte = capturarTexto(texto, /Válido\s+até:\s*(\d{2}[-/]\d{2}[-/]\d{4})/i);
  const idSimulacao = capturarTexto(texto, /\bID:\s*([A-Z0-9-]+)/i);
  const clienteNome = capturarTexto(texto, /Olá\s+([^,]+),\s+aqui/i);
  const empreendimento = capturarTexto(texto, /empreendimento\s+(.+?)\./i);
  const seguroPrestamistaValor = capturarNumeroPtBr(texto, /Seguro\s+Prestamista\s*R\$\s*([\d.]+,\d{2})/i);
  const custosBancarizacao = capturarNumeroPtBr(texto, /Custos\s+de\s+Bancarização\s*\([^)]*\)\s*R\$\s*([\d.]+,\d{2})/i);
  const custosAdministracao = capturarNumeroPtBr(texto, /Custos\s+de\s+Administração\s*\([^)]*\)\s*R\$\s*([\d.]+,\d{2})/i);
  const custosEstruturacao = capturarNumeroPtBr(texto, /Custos\s+de\s+Estruturação\s*\([^)]*\)\s*R\$\s*([\d.]+,\d{2})/i);
  const cobertura = capturarTexto(texto, /Cobertura\s+Opcional\s+Inclusa\s*(.+?)\s+Taxa\s+de\s+Juros/i);

  if (valorEntrada <= 0 || totalFinanciado <= 0 || parcelaInicial <= 0) {
    throw new Error("Não foi possível localizar os valores principais no PDF da Creditú.");
  }

  const campos = {
    origem: "pdf_creditu",
    id_simulacao_creditu: idSimulacao,
    cliente_nome: clienteNome,
    empreendimento,
    valor_liberado: valorEntrada,
    valor_entrada: valorEntrada,
    total_financiado: totalFinanciado,
    prazo: prazo || 60,
    sistema: sistema === "PRICE" ? "PRICE" : "SAC",
    parcela_inicial: parcelaInicial,
    parcela_final: parcelaFinal || parcelaInicial,
    parcela_7lm_20: parcelaFinal || parcelaInicial,
    taxa_anual: taxaAnualPercentual > 0 ? taxaAnualPercentual / 100 : 0,
    taxa_mensal: taxaMensalPercentual > 0 ? taxaMensalPercentual / 100 : 0,
    taxa_anual_percentual: taxaAnualPercentual,
    taxa_mensal_percentual: taxaMensalPercentual,
    vencimento_primeira_parcela: converterDataCredituParaIso(vencimento),
    emissao: converterDataCredituParaIso(emissao),
    valido_ate: converterDataCredituParaIso(validoAte),
    cobertura_opcional: cobertura,
    seguro_prestamista: seguroPrestamistaValor > 0 || Boolean(cobertura),
    seguro_prestamista_valor: seguroPrestamistaValor,
    custos_bancarizacao: custosBancarizacao,
    custos_administracao: custosAdministracao,
    custos_estruturacao: custosEstruturacao,
    aprovado: true,
  };
  campos.parcelas_creditur_intervalos = montarIntervalosSacCreditu(campos);

  return {
    campos,
    paginas: resultado.numpages || 0,
    texto_preview: texto.slice(0, 2200),
  };
}

function sanitizarNomeArquivoUpload(nome, fallback = "simulacao-creditu.pdf") {
  const base = path.basename(String(nome || fallback));
  return base.replace(/[^\w.\-()\s]+/g, "_").slice(0, 160) || fallback;
}

function obterExtensaoUploadCreditu(nomeOriginal, fallback = ".pdf") {
  const extensao = path.extname(String(nomeOriginal || "")).toLowerCase();
  if ([".pdf", ".png", ".jpg", ".jpeg", ".webp"].includes(extensao)) {
    return extensao;
  }
  return fallback;
}

function arquivoUploadEhPdf(file) {
  return /\.pdf$/i.test(file?.filename || "") || /application\/pdf/i.test(file?.contentType || "");
}

function arquivoUploadEhAnexoCredituValido(file) {
  return arquivoUploadEhPdf(file)
    || /\.(png|jpe?g|webp)$/i.test(file?.filename || "")
    || /^image\//i.test(file?.contentType || "");
}

async function salvarArquivoCredituUpload(file, { tipo = "simulacao", extensaoPadrao = ".pdf", contentTypePadrao = "application/pdf" } = {}) {
  const agora = new Date();
  const ano = String(agora.getFullYear());
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const pastaDestino = path.join(pastaUploadsCreditu, ano, mes);
  await fsp.mkdir(pastaDestino, { recursive: true });

  const id = `${ano}${mes}${String(agora.getDate()).padStart(2, "0")}-${crypto.randomBytes(8).toString("hex")}`;
  const nomeOriginal = sanitizarNomeArquivoUpload(file.filename, `${tipo}${extensaoPadrao}`);
  const extensao = obterExtensaoUploadCreditu(nomeOriginal, extensaoPadrao);
  const sufixo = String(tipo || "simulacao").replace(/[^\w-]+/g, "-").toLowerCase();
  const nomeArmazenado = sufixo === "simulacao" ? `${id}.pdf` : `${id}-${sufixo}${extensao}`;
  const caminhoArquivo = path.join(pastaDestino, nomeArmazenado);
  await fsp.writeFile(caminhoArquivo, file.buffer);

  return {
    id,
    tipo,
    nome_original: nomeOriginal,
    nome_armazenado: nomeArmazenado,
    tamanho_bytes: file.size,
    content_type: file.contentType || contentTypePadrao,
    armazenado_em: new Date().toISOString(),
    caminho_relativo: path.relative(path.resolve(__dirname, ".."), caminhoArquivo).split(path.sep).join("/"),
  };
}

async function salvarPdfCredituUpload(file) {
  return salvarArquivoCredituUpload(file, {
    tipo: "simulacao",
    extensaoPadrao: ".pdf",
    contentTypePadrao: "application/pdf",
  });
}

async function salvarAnexoCredituUpload(file, tipo) {
  const extensaoPadrao = /^image\//i.test(file?.contentType || "") ? ".png" : ".pdf";
  return salvarArquivoCredituUpload(file, {
    tipo,
    extensaoPadrao,
    contentTypePadrao: file?.contentType || "application/octet-stream",
  });
}

function resolverArquivoUploadCreditu(caminhoRelativo) {
  const relativo = caminhoRelativoSeguro(String(caminhoRelativo || "").trim());
  if (!relativo) return null;

  const raizPortal = path.resolve(__dirname, "..");
  const absoluto = resolverDentroDaPasta(raizPortal, relativo);
  if (!absoluto) return null;

  const relativoUploads = path.relative(pastaUploadsCreditu, absoluto);
  if (relativoUploads.startsWith("..") || path.isAbsolute(relativoUploads)) {
    return null;
  }

  return absoluto;
}

async function validarAutenticacaoApi(req, opcoes = {}) {
  const acao = normalizarTexto(opcoes.acao || "") || "acessar este recurso";
  const authorization = normalizarTexto(req.headers.authorization || "");
  if (!authorization) {
    return {
      ok: false,
      status: 401,
      mensagem: `Sessao expirada. Faca login novamente para ${acao}.`,
    };
  }

  try {
    const resposta = await fetch(montarDestinoApi("/me"), {
      method: "GET",
      agent: obterAgenteKeepAlive(montarDestinoApi("/me")),
      headers: {
        Accept: "application/json",
        authorization,
        "user-agent": req.headers["user-agent"] || "",
      },
    });
    if (resposta.ok) {
      return { ok: true, status: resposta.status };
    }
    return {
      ok: false,
      status: resposta.status === 403 ? 403 : 401,
      mensagem: `Nao foi possivel validar sua sessao para ${acao}.`,
    };
  } catch (erro) {
    console.error("[PORTAL] Erro ao validar sessao da API:", erro);
    return {
      ok: false,
      status: 503,
      mensagem: "Nao foi possivel validar sua sessao agora. Tente novamente em instantes.",
    };
  }
}

function exigeAutenticacaoApiPortal(caminhoApi) {
  const caminhoNormalizado = `/${String(caminhoApi || "/").replace(/^\/+/, "")}`;
  return caminhoNormalizado === "/processos" || caminhoNormalizado.startsWith("/processos/");
}

async function proxyApiPortal(req, res, caminhoApi) {
  if (exigeAutenticacaoApiPortal(caminhoApi)) {
    const autenticacao = await validarAutenticacaoApi(req, {
      acao: "acessar a Gestao da Reserva",
    });
    if (!autenticacao.ok) {
      return res.status(autenticacao.status || 401).json({ mensagem: autenticacao.mensagem });
    }
  }
  return proxyApi(req, res, caminhoApi);
}

async function proxyApi(req, res, caminhoApi) {
  const urlDestino = new URL(montarDestinoApi(caminhoApi));

  for (const [chave, valor] of Object.entries(req.query || {})) {
    if (Array.isArray(valor)) {
      for (const item of valor) urlDestino.searchParams.append(chave, String(item));
    } else if (valor !== undefined && valor !== null) {
      urlDestino.searchParams.append(chave, String(valor));
    }
  }

  const headers = {
    Accept: req.headers.accept || "application/json",
    "user-agent": req.headers["user-agent"] || "",
  };

  if (req.headers.authorization) {
    headers.authorization = req.headers.authorization;
  }

  if (req.headers["accept-language"]) {
    headers["accept-language"] = req.headers["accept-language"];
  }

  const metodo = String(req.method || "GET").toUpperCase();
  const possuiCorpo = !["GET", "HEAD"].includes(metodo);
  const tipoConteudo = String(req.headers["content-type"] || "").toLowerCase();
  const corpoMultipart = tipoConteudo.startsWith("multipart/form-data");
  const corpoJson = tipoConteudo.includes("application/json");
  let corpo = undefined;

  if (possuiCorpo) {
    headers["Content-Type"] = req.headers["content-type"] || "application/json";

    if (corpoMultipart) {
      corpo = await lerCorpoBrutoDaRequisicao(req);
    } else if (Buffer.isBuffer(req.body) || typeof req.body === "string") {
      corpo = req.body;
    } else if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
      corpo = JSON.stringify(req.body);
    } else if (!corpoJson) {
      corpo = await lerCorpoBrutoDaRequisicao(req);
    } else {
      corpo = JSON.stringify(req.body || {});
    }
  }

  try {
    const resposta = await fetch(urlDestino, {
      method: metodo,
      agent: obterAgenteKeepAlive(urlDestino.toString()),
      headers,
      body: possuiCorpo ? corpo : undefined,
    });

    const contentType = resposta.headers.get("content-type");
    const contentDisposition = resposta.headers.get("content-disposition");
    const contentLength = resposta.headers.get("content-length");
    const requestId = resposta.headers.get("x-identificador-requisicao");
    if (contentType) res.setHeader("content-type", contentType);
    if (contentDisposition) res.setHeader("content-disposition", contentDisposition);
    if (contentLength) res.setHeader("content-length", contentLength);
    if (requestId) res.setHeader("x-identificador-requisicao", requestId);
    if (resposta.headers.get("cache-control")) {
      res.setHeader("cache-control", resposta.headers.get("cache-control"));
    }

    if (metodo === "HEAD" || resposta.status === 204 || resposta.status === 304) {
      return res.status(resposta.status).end();
    }

    if (respostaTemCorpoTextual(contentType)) {
      const body = await safeBody(resposta);
      return res.status(resposta.status).send(body);
    }

    const body = Buffer.from(await resposta.arrayBuffer());
    return res.status(resposta.status).send(body);
  } catch (erro) {
    console.error("[PORTAL] Erro no proxy da API:", metodo, urlDestino.toString(), erro);
    return res.status(500).json({ mensagem: "Erro interno no proxy do portal." });
  }
}

function resolverArquivoExperience(caminhoUrl) {
  const relativoBase = caminhoRelativoSeguro(caminhoUrl.replace(/^\/experience\/assets/, ""));
  if (!relativoBase) return null;

  for (const base of caminhosExperience) {
    const candidato = resolverDentroDaPasta(base, relativoBase);
    if (candidato && fs.existsSync(candidato) && fs.statSync(candidato).isFile()) {
      return candidato;
    }
  }

  return null;
}

function removerHashDeArquivoNext(nomeArquivo) {
  return String(nomeArquivo || "").replace(/\.[a-f0-9]{6,}(?=\.[^.]+$)/i, "");
}

function resolverArquivoEspecialDaHomepage(caminhoUrl) {
  const caminhoNormalizado = normalizarRotaPublica(caminhoUrl);

  if (
    caminhoNormalizado.startsWith("/_next/static/css/") ||
    caminhoNormalizado.startsWith("/_next/static/chunks/")
  ) {
    const nomeArquivo = path.posix.basename(caminhoNormalizado);
    return resolverDentroDaPasta(path.join(pastaPublica, "assets"), nomeArquivo);
  }

  if (caminhoNormalizado.startsWith("/assets/") && caminhoNormalizado.endsWith(".download")) {
    const nomeArquivo = path.posix.basename(caminhoNormalizado, ".download");
    return resolverDentroDaPasta(path.join(pastaPublica, "assets"), nomeArquivo);
  }

  if (caminhoNormalizado.startsWith("/_next/static/media/")) {
    const relativoMedia = caminhoRelativoSeguro(caminhoNormalizado);
    const caminhoMedia = relativoMedia ? resolverDentroDaPasta(pastaPublica, relativoMedia) : null;

    if (caminhoMedia && fs.existsSync(caminhoMedia) && fs.statSync(caminhoMedia).isFile()) {
      return caminhoMedia;
    }

    const nomeArquivoOriginal = path.posix.basename(caminhoNormalizado);
    const nomeArquivoAlias = removerHashDeArquivoNext(nomeArquivoOriginal);
    return resolverDentroDaPasta(path.join(pastaPublica, "assets"), nomeArquivoAlias);
  }

  return null;
}

function resolverArquivoPortal(caminhoUrl) {
  const caminhoNormalizado = normalizarRotaPublica(caminhoUrl);
  const arquivoEspecialDaHomepage = resolverArquivoEspecialDaHomepage(caminhoNormalizado);

  if (
    arquivoEspecialDaHomepage &&
    fs.existsSync(arquivoEspecialDaHomepage) &&
    fs.statSync(arquivoEspecialDaHomepage).isFile()
  ) {
    return arquivoEspecialDaHomepage;
  }

  if (caminhoNormalizado.startsWith("/experience/assets/")) {
    return resolverArquivoExperience(caminhoNormalizado);
  }

  if (caminhoNormalizado.startsWith("/RH/")) {
    const relativo = caminhoRelativoSeguro(`/01_paginas${caminhoNormalizado}`);
    return relativo ? resolverDentroDaPasta(pastaPublica, relativo) : null;
  }

  if (caminhoNormalizado.startsWith("/Administracao/")) {
    const relativo = caminhoRelativoSeguro(`/01_paginas${caminhoNormalizado}`);
    return relativo ? resolverDentroDaPasta(pastaPublica, relativo) : null;
  }

  const relativo = caminhoRelativoSeguro(caminhoNormalizado);
  return relativo ? resolverDentroDaPasta(pastaPublica, relativo) : null;
}

async function enviarArquivoPublico(res, caminhoArquivo) {
  const extensao = path.extname(caminhoArquivo).toLowerCase();
  const mime = mimePorExtensao(extensao);

  if ([".html", ".js", ".css"].includes(extensao)) {
    const conteudo = await fsp.readFile(caminhoArquivo, "utf8");
    const caminhoPublico = `/${path.relative(pastaPublica, caminhoArquivo).split(path.sep).join("/")}`;
    if (mime) res.type(mime);
    if (extensao === ".html") {
      res.setHeader("cache-control", "no-store, no-cache, must-revalidate, private");
    }
    return res.send(reescreverConteudoPublico(conteudo, { caminhoPublico, extensao }));
  }

  return res.sendFile(caminhoArquivo);
}

const roteadorPortal = express.Router();

roteadorPortal.get("/_r/:arquivo", async (req, res) => {
  const alias = normalizarRotaPublica(`/_r/${req.params.arquivo || ""}`);
  const caminhoPublico = arquivoPublicoPorAlias.get(alias);
  if (!caminhoPublico) {
    return res.status(404).send("Recurso não encontrado.");
  }

  const caminhoArquivo = resolverArquivoPortal(caminhoPublico);
  if (!caminhoArquivo || !fs.existsSync(caminhoArquivo) || !fs.statSync(caminhoArquivo).isFile()) {
    return res.status(404).send("Recurso não encontrado.");
  }

  try {
    return await enviarArquivoPublico(res, caminhoArquivo);
  } catch (erro) {
    console.error("[PORTAL] Erro ao servir recurso ofuscado:", caminhoPublico, erro);
    return res.status(500).send("Erro interno ao servir o portal.");
  }
});

roteadorPortal.get("/_next/image", async (req, res) => {
  const urlOriginal = normalizarTexto(req.query && req.query.url);
  if (!urlOriginal) {
    return res.status(400).send("Recurso não encontrado.");
  }

  const caminhoDireto = resolverArquivoPortal(urlOriginal);
  if (!caminhoDireto || !fs.existsSync(caminhoDireto) || !fs.statSync(caminhoDireto).isFile()) {
    return res.status(404).send("Recurso não encontrado.");
  }

  try {
    return await enviarArquivoPublico(res, caminhoDireto);
  } catch (erro) {
    console.error("[PORTAL] Erro ao servir imagem otimizada da homepage:", urlOriginal, erro);
    return res.status(500).send("Erro interno ao servir o portal.");
  }
});

roteadorPortal.get("/api/autenticacao/opcoes", (req, res) => {
  return res.json({
    entra_id_habilitado: ENTRA_CONFIGURADO,
    provedores: ENTRA_CONFIGURADO
      ? [
          {
            codigo: "entra_id",
            rotulo: "Microsoft",
            url_entrada: aplicarBasePath(BASE_PATH, "/auth/entra/entrar"),
          },
        ]
      : [],
  });
});

roteadorPortal.get("/api/connect-comercial/simulador/creditu-anexos", async (req, res) => {
  try {
    const autenticacao = await validarAutenticacaoApi(req, {
      acao: "abrir o anexo da Creditu",
    });
    if (!autenticacao.ok) {
      return res.status(autenticacao.status || 401).json({ mensagem: autenticacao.mensagem });
    }

    const caminhoArquivo = resolverArquivoUploadCreditu(req.query?.caminho);
    if (!caminhoArquivo || !fs.existsSync(caminhoArquivo) || !fs.statSync(caminhoArquivo).isFile()) {
      return res.status(404).json({ mensagem: "Anexo Creditu nao encontrado." });
    }

    const nomeDownload = sanitizarNomeArquivoUpload(
      req.query?.nome || path.basename(caminhoArquivo),
      path.basename(caminhoArquivo)
    );
    const mime = mimePorExtensao(path.extname(caminhoArquivo).toLowerCase());
    if (mime) res.type(mime);
    res.setHeader("cache-control", "private, no-store");
    res.setHeader("content-disposition", `inline; filename="${nomeDownload.replace(/"/g, "")}"`);
    return res.sendFile(caminhoArquivo);
  } catch (erro) {
    console.error("[PORTAL] Erro ao servir anexo da Creditu:", erro);
    return res.status(500).json({ mensagem: "Nao foi possivel abrir o anexo da Creditu." });
  }
});

roteadorPortal.post("/api/connect-comercial/simulador/creditu-pdf", async (req, res) => {
  const tipoConteudo = String(req.headers["content-type"] || "").toLowerCase();
  if (!tipoConteudo.startsWith("multipart/form-data")) {
    return res.status(415).json({ mensagem: "Envie o PDF da Creditú como multipart/form-data." });
  }

  try {
    const autenticacao = await validarAutenticacaoApi(req, {
      acao: "enviar o PDF da Creditu",
    });
    if (!autenticacao.ok) {
      return res.status(autenticacao.status || 401).json({ mensagem: autenticacao.mensagem });
    }

    const corpo = await lerCorpoBrutoDaRequisicao(req);
    if (!corpo || corpo.length <= 0) {
      return res.status(400).json({ mensagem: "Nenhum arquivo PDF foi enviado." });
    }
    if (corpo.length > LIMITE_UPLOAD_CREDITU_TOTAL_BYTES) {
      return res.status(413).json({ mensagem: "PDF da Creditú acima do limite de 8 MB." });
    }

    const multipart = parseMultipartFormData(corpo, req.headers["content-type"]);
    const arquivo = multipart.files.find((item) => item.name === "arquivo");
    if (!arquivo) {
      return res.status(400).json({ mensagem: "Selecione o PDF da simulação Creditú." });
    }
    if (arquivo.size > LIMITE_UPLOAD_PDF_CREDITU_BYTES) {
      return res.status(413).json({ mensagem: "PDF da Creditú acima do limite de 8 MB." });
    }
    if (!arquivoUploadEhPdf(arquivo)) {
      return res.status(415).json({ mensagem: "O arquivo enviado precisa ser um PDF." });
    }
    const anexoSerasa = multipart.files.find((item) => ["score_serasa", "serasa", "scoreSerasa"].includes(item.name));
    const anexoSicaq = multipart.files.find((item) => ["sicaq", "anexo_sicaq"].includes(item.name));
    const anexosPendentes = [
      ["Score Serasa", anexoSerasa],
      ["SICAQ", anexoSicaq],
    ].filter(([, file]) => Boolean(file));
    for (const [label, file] of anexosPendentes) {
      if (file.size > LIMITE_UPLOAD_ANEXO_CREDITU_BYTES) {
        return res.status(413).json({ mensagem: `${label} acima do limite de 8 MB.` });
      }
      if (!arquivoUploadEhAnexoCredituValido(file)) {
        return res.status(415).json({ mensagem: `${label} precisa ser PDF ou imagem.` });
      }
    }

    const extraido = await extrairSimulacaoCredituPdf(arquivo.buffer);
    const arquivoSalvo = await salvarPdfCredituUpload(arquivo);
    const anexos = {};
    if (anexoSerasa) {
      anexos.serasa = await salvarAnexoCredituUpload(anexoSerasa, "score-serasa");
    }
    if (anexoSicaq) {
      anexos.sicaq = await salvarAnexoCredituUpload(anexoSicaq, "sicaq");
    }
    extraido.campos.arquivo_pdf = arquivoSalvo;
    extraido.campos.anexo_serasa = anexos.serasa || null;
    extraido.campos.anexo_sicaq = anexos.sicaq || null;
    extraido.campos.anexos_creditu = anexos;
    extraido.campos.cliente_id = multipart.fields.cliente_id || "";
    extraido.campos.imovel_id = multipart.fields.imovel_id || "";

    return res.json({
      ok: true,
      mensagem: "PDF da Creditú lido com sucesso.",
      arquivo: arquivoSalvo,
      anexos,
      campos: extraido.campos,
      paginas: extraido.paginas,
      texto_preview: extraido.texto_preview,
    });
  } catch (erro) {
    console.error("[PORTAL] Erro ao processar PDF da Creditú:", erro);
    return res.status(400).json({
      mensagem: erro?.message || "Não foi possível ler a simulação Creditú enviada.",
    });
  }
});

roteadorPortal.all("/api/*", async (req, res) => {
  const caminhoApi = req.path.replace(/^\/api/, "") || "/";
  return proxyApiPortal(req, res, caminhoApi);
});

roteadorPortal.all("/api", async (req, res) => {
  return proxyApiPortal(req, res, "/");
});

roteadorPortal.get("/auth/entra/entrar", async (req, res) => {
  if (!ENTRA_CONFIGURADO || !clienteEntra) {
    return redirecionarParaEntradaComMensagem(
      res,
      "O login com Microsoft ainda não foi configurado neste ambiente."
    );
  }

  try {
    const state = gerarTokenAleatorio();
    const nonce = gerarTokenAleatorio();

    req.session.sevenlmEntra = {
      state,
      nonce,
      criado_em: Date.now(),
    };
    await salvarSessao(req);

    const urlAutorizacao = await clienteEntra.getAuthCodeUrl({
      scopes: ENTRA_SCOPES,
      redirectUri: ENTRA_REDIRECT_URI,
      responseMode: "query",
      state,
      nonce,
      prompt: "select_account",
    });

    return res.redirect(urlAutorizacao);
  } catch (erro) {
    console.error("[PORTAL] Falha ao iniciar login Entra ID:", erro);
    return redirecionarParaEntradaComMensagem(
      res,
      "Não foi possível iniciar o login com Microsoft."
    );
  }
});

roteadorPortal.get("/auth/entra/redirect", async (req, res) => {
  if (!ENTRA_CONFIGURADO || !clienteEntra) {
    return redirecionarParaEntradaComMensagem(
      res,
      "O login com Microsoft ainda não foi configurado neste ambiente."
    );
  }

  const erroRetorno = normalizarTexto(req.query.error_description || req.query.error);
  if (erroRetorno) {
    limparEstadoEntra(req);
    return redirecionarParaEntradaComMensagem(res, erroRetorno);
  }

  const stateRecebido = normalizarTexto(req.query.state);
  const code = normalizarTexto(req.query.code);
  const contexto = (req.session && req.session.sevenlmEntra) || null;

  if (!contexto || !contexto.state || contexto.state !== stateRecebido || !code) {
    limparEstadoEntra(req);
    return redirecionarParaEntradaComMensagem(
      res,
      "O retorno do Microsoft Entra ID não passou na validação de estado."
    );
  }

  try {
    const respostaMicrosoft = await clienteEntra.acquireTokenByCode({
      code,
      scopes: ENTRA_SCOPES,
      redirectUri: ENTRA_REDIRECT_URI,
      nonce: contexto.nonce,
    });

    const claims = (respostaMicrosoft && respostaMicrosoft.idTokenClaims) || {};
    const respostaApi = await concluirLoginFederadoNaApi(req, claims);

    limparEstadoEntra(req);

    if (!respostaApi.ok) {
      const mensagem =
        (respostaApi && respostaApi.payload && respostaApi.payload.mensagem) ||
        (respostaApi && respostaApi.payload && respostaApi.payload.detail) ||
        "Não foi possível vincular a identidade Microsoft a um usuário do portal.";
      return redirecionarParaEntradaComMensagem(res, mensagem);
    }

    return res
      .status(200)
      .type("html")
      .send(montarPaginaBridge(respostaApi.payload, aplicarBasePath(BASE_PATH, "/inicio")));
  } catch (erro) {
    limparEstadoEntra(req);
    console.error("[PORTAL] Falha no callback Entra ID:", erro);
    return redirecionarParaEntradaComMensagem(
      res,
      "O portal não conseguiu concluir o login com Microsoft."
    );
  }
});

roteadorPortal.get("/auth/sair", (req, res) => {
  encerrarSessaoPortal(req, res, () => res.redirect(LOGIN_URL));
});

roteadorPortal.get("/auth/entra/sair", (req, res) => {
  if (!ENTRA_AUTHORITY) {
    return encerrarSessaoPortal(req, res, () => res.redirect(LOGIN_URL));
  }

  const logoutUrl = `${ENTRA_AUTHORITY}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(
    ENTRA_POST_LOGOUT_REDIRECT_URI
  )}`;
  return encerrarSessaoPortal(req, res, () => res.redirect(logoutUrl));
});

roteadorPortal.use(async (req, res, next) => {
  if (!["GET", "HEAD"].includes(String(req.method || "").toUpperCase())) {
    return next();
  }

  const caminho = normalizarRotaPublica(decodeURIComponent(req.path || "/"));

  if (path.posix.extname(caminho).toLowerCase() === ".map") {
    return res.status(404).send("Recurso não encontrado.");
  }

  if (
    caminho.toLowerCase().startsWith("/financeiro") ||
    caminho.toLowerCase().startsWith("/01_paginas/financeiro/")
  ) {
    return res.redirect(302, aplicarBasePath(BASE_PATH, "/inicio"));
  }

  if (redirecionamentosAmigaveis.has(caminho)) {
    return res.redirect(302, aplicarBasePath(BASE_PATH, redirecionamentosAmigaveis.get(caminho)));
  }

  if (caminho === "/RH" || caminho === "/RH/") {
    return res.redirect(302, aplicarBasePath(BASE_PATH, "/inicio"));
  }

  if (caminho === "/Administracao" || caminho === "/Administracao/") {
    return res.redirect(302, aplicarBasePath(BASE_PATH, "/administracao/acessos"));
  }

  if (/^\/operacional\/[^/]+\/[^/]+\/?$/.test(caminho)) {
    return res.redirect(302, aplicarBasePath(BASE_PATH, "/comercial/imoveis"));
  }

  if (caminho.startsWith("/comercial/dashboard/")) {
    try {
      const caminhoArquivo = resolverDentroDaPasta(pastaPublica, "01_paginas/Comercial/dashboard.html");
      if (!caminhoArquivo || !fs.existsSync(caminhoArquivo)) {
        return next();
      }
      return await enviarArquivoPublico(res, caminhoArquivo);
    } catch (erro) {
      console.error("[PORTAL] Erro ao servir rota do Dashboard Comercial:", caminho, erro);
      return res.status(500).send("Erro interno ao servir o portal.");
    }
  }

  const arquivoAmigavel = rotasAmigaveis.get(caminho);
  if (arquivoAmigavel) {
    try {
      const caminhoArquivo = resolverDentroDaPasta(pastaPublica, arquivoAmigavel);
      if (!caminhoArquivo || !fs.existsSync(caminhoArquivo)) {
        return next();
      }
      return await enviarArquivoPublico(res, caminhoArquivo);
    } catch (erro) {
      console.error("[PORTAL] Erro ao servir rota amigavel:", caminho, erro);
      return res.status(500).send("Erro interno ao servir o portal.");
    }
  }

  const caminhoArquivo = resolverArquivoPortal(caminho);
  if (!caminhoArquivo || !fs.existsSync(caminhoArquivo) || !fs.statSync(caminhoArquivo).isFile()) {
    return next();
  }

  try {
    return await enviarArquivoPublico(res, caminhoArquivo);
  } catch (erro) {
    console.error("[PORTAL] Erro ao servir arquivo público:", caminhoArquivo, erro);
    return res.status(500).send("Erro interno ao servir o portal.");
  }
});

roteadorPortal.use((req, res) => {
  return res.status(404).send("Recurso não encontrado.");
});

app.use(BASE_PATH || "/", roteadorPortal);

if (BASE_PATH) {
  app.get("/", (req, res) => res.redirect(HOME_URL));
}

app.listen(PORTA, () => {
  console.log("===============================================");
  console.log("7LM Connect - Portal Institucional (Node)");
  console.log("Autor: Willian Elias Franca");
  console.log("===============================================");
  console.log("Ambiente:", AMBIENTE);
  console.log("Porta:", PORTA);
  console.log("Base path:", BASE_PATH || "/");
  console.log("Pasta pública:", pastaPublica);
  console.log("API_BASE:", API_BASE);
  console.log("Dominio primario:", DOMINIO_PUBLICO_PRIMARIO || "(não configurado)");
  console.log(
    "Dominios redirecionados:",
    DOMINIOS_PUBLICOS_REDIRECIONAR.length ? DOMINIOS_PUBLICOS_REDIRECIONAR.join(", ") : "(nenhum)"
  );
  console.log("Microsoft Entra ID:", ENTRA_CONFIGURADO ? "habilitado" : "desabilitado");
  console.log(".env:", envPath || "(não encontrado)");
  console.log("");
});
