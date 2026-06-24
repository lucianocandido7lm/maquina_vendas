import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = "C:/Projetos Pessoais/7LM/7LM Connect/01_portal_em_node";
const qa = JSON.parse((await fs.readFile(path.join(root, "tmp", "qa_session.json"), "utf8")).replace(/^\uFEFF/, ""));
const baseUrl = (process.env.QA_BASE_URL || "https://maquinadevendas7lm.app.br").replace(/\/+$/, "");
const outputDir = path.join(root, "output", "playwright", "colaboradores-ui");

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

await context.addInitScript((session) => {
  sessionStorage.setItem("sevenlm_connect_token_de_acesso", session.token);
  sessionStorage.setItem("sevenlm_connect_token_de_renovacao", "qa-refresh");
  sessionStorage.setItem("sevenlm_connect_usuario", JSON.stringify({
    identificador_usuario: session.user_id,
    nome_completo: session.nome,
    correio_eletronico: session.email,
    indicador_precisa_trocar_senha: false,
  }));
  sessionStorage.setItem("sevenlm_connect_login_at", new Date().toISOString());
  sessionStorage.setItem("sevenlm_connect_provedor_login", "codex_qa");
  localStorage.setItem("tl.theme", "dark");
}, qa);

const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];

page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => pageErrors.push(String(err)));
page.on("requestfailed", (request) => {
  if (request.url().includes("/api/")) {
    requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "failed"}`);
  }
});

async function isVisible(selector) {
  return page.locator(selector).first().evaluate((node) => {
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
  }).catch(() => false);
}

async function visibleText(text) {
  return page.getByText(text, { exact: false }).first().evaluate((node) => {
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
  }).catch(() => false);
}

function rgbTuple(value) {
  const match = String(value || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  return match ? match.slice(1, 4).map(Number) : null;
}

function isNearWhite(value) {
  const rgb = rgbTuple(value);
  return Boolean(rgb && rgb.every((part) => part >= 245));
}

await page.goto(`${baseUrl}/administracao/funcionarios`, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});
await page.locator("body[data-admin-page-mode='funcionarios']").waitFor({ timeout: 45000 });
await page.locator("[data-funcionario-summary-filter]").first().waitFor({ timeout: 45000 });
await page.locator(".tl-data-table--funcionarios").waitFor({ timeout: 45000 });
await page.waitForTimeout(1000);

const initialState = await page.evaluate(() => {
  const row = document.querySelector(".tl-data-table--funcionarios .tl-data-table__row");
  const rowRect = row?.getBoundingClientRect();
  const tableSurface = document.querySelector("#listaFuncionarios");
  const tableRect = tableSurface?.getBoundingClientRect();
  const select = document.querySelector("#selectFuncionarioTipo");
  const option = select?.querySelector("option");
  const selectStyle = select ? window.getComputedStyle(select) : null;
  const optionStyle = option ? window.getComputedStyle(option) : null;
  return {
    title: document.title,
    topbarTitle: document.querySelector(".tl-topbar__titles .tl-title")?.textContent?.trim() || "",
    panelTitle: document.querySelector(".tl-panel--funcionarios .tl-panel__title")?.textContent?.trim() || "",
    newButton: document.querySelector("#btnNovoFuncionario")?.textContent?.trim() || "",
    sidebarText: document.querySelector("#sidebar")?.textContent || "",
    tableVisible: Boolean(document.querySelector(".tl-data-table--funcionarios")),
    cardCount: document.querySelectorAll(".tl-employee-card").length,
    rowCount: document.querySelectorAll(".tl-data-table--funcionarios .tl-data-table__row").length,
    firstRowHeight: rowRect ? Math.round(rowRect.height) : null,
    tableHeight: tableRect ? Math.round(tableRect.height) : null,
    tableBottomDelta: tableRect ? Math.round(window.innerHeight - tableRect.bottom) : null,
    tableHeaders: Array.from(document.querySelectorAll(".tl-data-table--funcionarios .tl-data-table__head span")).map((node) => node.textContent?.trim()),
    summaryLabels: Array.from(document.querySelectorAll("[data-funcionario-summary-filter]")).map((node) => node.textContent?.trim()),
    selectColor: selectStyle?.color || "",
    selectBackground: selectStyle?.backgroundColor || "",
    optionColor: optionStyle?.color || "",
    optionBackground: optionStyle?.backgroundColor || "",
    theme: document.documentElement.getAttribute("data-theme"),
  };
});

await page.locator("[data-funcionario-summary-filter='status'][data-funcionario-summary-value='ATIVO']").click();
await page.waitForTimeout(900);
const statusFilterValue = await page.locator("#selectFuncionarioStatus").inputValue();

await page.locator("#selectFuncionarioImobiliaria").selectOption({ index: 0 });
await page.locator("#selectFuncionarioTipo").selectOption("CORRETOR");
await page.waitForTimeout(900);
const typeFilterValue = await page.locator("#selectFuncionarioTipo").inputValue();

await page.locator("#btnLimparFiltrosFuncionarios").click();
await page.waitForTimeout(900);
const clearedFilters = await page.evaluate(() => ({
  tipo: document.querySelector("#selectFuncionarioTipo")?.value || "",
  status: document.querySelector("#selectFuncionarioStatus")?.value || "",
  login: document.querySelector("#selectFuncionarioLogin")?.value || "",
  vinculo: document.querySelector("#selectFuncionarioVinculo")?.value || "",
  imobiliaria: document.querySelector("#selectFuncionarioImobiliaria")?.value || "",
}));

await page.locator("#btnNovoFuncionario").click();
await page.locator("#modalFuncionarioNome").waitFor({ timeout: 30000 });
const modalState = await page.evaluate(() => {
  const dialog = document.querySelector(".tl-modal-card, .tl-dialog, [role='dialog']");
  const rect = dialog?.getBoundingClientRect();
  const select = document.querySelector("#modalFuncionarioTipo");
  const option = select?.querySelector("option");
  const selectStyle = select ? window.getComputedStyle(select) : null;
  const optionStyle = option ? window.getComputedStyle(option) : null;
  return {
    title: document.querySelector("#modalTitulo")?.textContent?.trim() || "",
    top: rect ? Math.round(rect.top) : null,
    centerDelta: rect ? Math.round(Math.abs((rect.top + rect.height / 2) - window.innerHeight / 2)) : null,
    visibleFields: [
      "modalFuncionarioTipo",
      "modalFuncionarioTipoVinculo",
      "modalFuncionarioAtivoLogin",
      "modalFuncionarioNome",
      "modalFuncionarioEmail",
      "modalFuncionarioTelefone",
      "modalFuncionarioDocumento",
      "modalFuncionarioMatricula",
      "modalFuncionarioImobiliaria",
      "modalFuncionarioGerente",
      "modalFuncionarioDiretor",
    ].filter((id) => Boolean(document.getElementById(id))),
    selectColor: selectStyle?.color || "",
    selectBackground: selectStyle?.backgroundColor || "",
    optionColor: optionStyle?.color || "",
    optionBackground: optionStyle?.backgroundColor || "",
  };
});

const hiddenLegacyCards = {
  sessaoAtiva: await visibleText("Sessão Ativa"),
  nivelPermissao: await visibleText("Nível de Permissão"),
  ultimoAcesso: await visibleText("Último Acesso"),
};

await page.screenshot({ path: path.join(outputDir, "colaboradores-dark-lista-modal.png"), fullPage: false });
await page.close();
await browser.close();

const report = {
  baseUrl,
  initialState,
  statusFilterValue,
  typeFilterValue,
  clearedFilters,
  modalState,
  hiddenLegacyCards,
  consoleErrors,
  pageErrors,
  requestFailures,
};

const failures = [];
if (!initialState.title.includes("Colaboradores")) failures.push("Titulo do navegador nao mudou para Colaboradores.");
if (initialState.topbarTitle !== "Colaboradores") failures.push("Titulo interno nao mudou para Colaboradores.");
if (initialState.panelTitle !== "Cadastro de colaboradores") failures.push("Titulo do painel nao mudou para Cadastro de colaboradores.");
if (!initialState.sidebarText.includes("Colaboradores")) failures.push("Barra lateral nao exibe Colaboradores.");
if (initialState.newButton !== "Novo colaborador") failures.push("Botao novo cadastro nao foi renomeado.");
if (!initialState.tableVisible) failures.push("Tabela compacta de colaboradores nao apareceu.");
if (initialState.cardCount !== 0) failures.push("Cards antigos de colaboradores ainda existem na lista.");
if (initialState.rowCount < 1) failures.push("Tabela de colaboradores nao carregou linhas.");
if (!initialState.firstRowHeight || initialState.firstRowHeight > 120) failures.push("Linha da tabela continua alta demais.");
if (initialState.tableBottomDelta == null || initialState.tableBottomDelta > 90 || initialState.tableBottomDelta < -40) failures.push("Tabela de colaboradores nao esta preenchendo a altura disponivel da pagina com rolagem interna.");
if (initialState.tableHeight == null || initialState.tableHeight > 1400) failures.push("Tabela de colaboradores cresceu demais e perdeu a rolagem interna.");
if (!initialState.tableHeaders.includes("Documento / matrícula")) failures.push("Cabecalho Documento / matricula ausente.");
if (!initialState.summaryLabels.some((label) => label?.startsWith("Colaboradores"))) failures.push("Resumo clicavel nao foi renomeado para Colaboradores.");
if (initialState.theme !== "dark") failures.push("Tema escuro nao foi aplicado no teste.");
if (isNearWhite(initialState.selectBackground) && isNearWhite(initialState.selectColor)) failures.push("Filtro principal esta branco sobre branco no tema escuro.");
if (isNearWhite(initialState.optionBackground) && isNearWhite(initialState.optionColor)) failures.push("Opcoes do filtro estao branco sobre branco no tema escuro.");
if (statusFilterValue !== "ATIVO") failures.push("Clique no card Ativos nao aplicou filtro.");
if (typeFilterValue !== "CORRETOR") failures.push("Filtro de tipo nao ficou selecionavel.");
if (Object.values(clearedFilters).some(Boolean)) failures.push("Botao limpar nao zerou os filtros.");
if (modalState.title !== "Novo colaborador") failures.push("Modal de cadastro nao foi renomeado.");
if (modalState.centerDelta == null || modalState.centerDelta > 90) failures.push("Modal de colaborador nao esta centralizado no monitor.");
if (modalState.visibleFields.length < 11) failures.push("Modal nao exibiu todos os campos principais.");
if (isNearWhite(modalState.selectBackground) && isNearWhite(modalState.selectColor)) failures.push("Select do modal esta branco sobre branco no tema escuro.");
if (isNearWhite(modalState.optionBackground) && isNearWhite(modalState.optionColor)) failures.push("Opcoes do modal estao branco sobre branco no tema escuro.");
if (report.hiddenLegacyCards.sessaoAtiva || report.hiddenLegacyCards.nivelPermissao || report.hiddenLegacyCards.ultimoAcesso) failures.push("Cards antigos de sessao/permissao/acesso ainda estao visiveis.");
if (consoleErrors.length) failures.push(`Console errors: ${consoleErrors.join(" | ")}`);
if (pageErrors.length) failures.push(`Page errors: ${pageErrors.join(" | ")}`);
if (requestFailures.length) failures.push(`Request failures: ${requestFailures.join(" | ")}`);

await fs.writeFile(path.join(outputDir, "report.json"), JSON.stringify({ report, failures }, null, 2), "utf8");
console.log(JSON.stringify({ report, failures }, null, 2));
if (failures.length) {
  process.exitCode = 1;
}
