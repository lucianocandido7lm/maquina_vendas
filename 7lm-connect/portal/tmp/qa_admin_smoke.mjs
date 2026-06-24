import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = "C:/Projetos Pessoais/7LM/7LM Connect/01_portal_em_node";
const qa = JSON.parse((await fs.readFile(path.join(root, "tmp", "qa_session.json"), "utf8")).replace(/^\uFEFF/, ""));
const baseUrl = (process.env.QA_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const outputDir = path.join(root, "output", "playwright", "admin-smoke");

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
  localStorage.setItem("tl.theme", "light");
}, qa);

function collectors(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.includes("/api/")) {
      requestFailures.push(`${request.method()} ${url} :: ${request.failure()?.errorText || "failed"}`);
    }
  });
  return { consoleErrors, pageErrors, requestFailures };
}

async function waitIdle(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function visible(page, selector) {
  return page.locator(selector).first().evaluate((node) => {
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
  }).catch(() => false);
}

async function auditAcessos() {
  const page = await context.newPage();
  const c = collectors(page);
  await page.goto(`${baseUrl}/administracao/acessos`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitIdle(page);

  await page.locator("body[data-admin-page-mode='acessos']").waitFor({ timeout: 30000 });
  await page.getByText("Liberação por perfil", { exact: false }).waitFor({ timeout: 30000 });

  const popupVisible = await visible(page, "#tl-approval-popup");
  const kpisVisible = await visible(page, ".tl-kpis");
  const directRulesVisible = await visible(page, ".tl-panel--permissoes");
  const linkedProfilesVisible = await visible(page, ".tl-panel--perfis");

  const cards = page.locator(".tl-user-search-card");
  await cards.first().waitFor({ timeout: 30000 });
  await cards.first().click();
  await page.locator("#selectPerfilPrincipalUsuario").waitFor({ timeout: 30000 });
  await page.getByText("Salvar liberação", { exact: false }).waitFor({ timeout: 30000 });
  await page.getByText("Resetar senha", { exact: false }).waitFor({ timeout: 30000 });

  const state = await page.evaluate(() => {
    const select = document.querySelector("#selectPerfilPrincipalUsuario");
    return {
      selectedUser: Boolean(document.querySelector(".tl-user-search-card.is-selected")),
      releaseButton: !document.querySelector("#btnAplicarLiberacaoAcesso")?.disabled,
      resetButton: !document.querySelector("#btnResetarSenha")?.disabled,
      profileOptions: Array.from(select?.options || []).map((option) => option.textContent?.trim()).filter(Boolean),
    };
  });

  await page.locator("#btnResetarSenha").click();
  await page.locator("#modalNovaSenha").waitFor({ timeout: 30000 });
  const resetModal = await page.evaluate(() => ({
    title: document.querySelector("#modalTitulo")?.textContent?.trim() || "",
    passwordField: Boolean(document.querySelector("#modalNovaSenha")),
    confirmField: Boolean(document.querySelector("#modalConfirmarNovaSenha")),
    forceToggle: Boolean(document.querySelector("#modalForcarTrocaAoResetar")),
    forceDefault: document.querySelector("#modalForcarTrocaAoResetar")?.value || "",
  }));
  await page.locator("#btnCancelarModal").click();
  await page.waitForTimeout(300);

  await page.screenshot({ path: path.join(outputDir, "acessos-liberacao.png"), fullPage: false });
  await page.close();

  return {
    popupVisible,
    kpisVisible,
    directRulesVisible,
    linkedProfilesVisible,
    ...state,
    resetModal,
    consoleErrors: c.consoleErrors,
    pageErrors: c.pageErrors,
    requestFailures: c.requestFailures,
  };
}

async function auditFuncionarios() {
  const page = await context.newPage();
  const c = collectors(page);
  await page.goto(`${baseUrl}/administracao/funcionarios`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitIdle(page);

  await page.locator("body[data-admin-page-mode='funcionarios']").waitFor({ timeout: 30000 });
  await page.locator("[data-funcionario-summary-filter]").first().waitFor({ timeout: 30000 });
  await page.locator("#selectFuncionarioImobiliaria").waitFor({ timeout: 30000 });

  await page.locator("[data-funcionario-summary-filter='status'][data-funcionario-summary-value='ATIVO']").click();
  await page.waitForTimeout(700);

  await page.locator("#btnNovoFuncionario").click();
  await page.locator("#modalFuncionarioNome").waitFor({ timeout: 30000 });

  const state = await page.evaluate(() => {
    const requiredIds = [
      "modalFuncionarioDocumento",
      "modalFuncionarioMatricula",
      "modalFuncionarioTelefone",
      "modalFuncionarioTipoVinculo",
      "modalFuncionarioImobiliaria",
      "modalFuncionarioGerente",
      "modalFuncionarioGerenteEmail",
      "modalFuncionarioGerenteDocumento",
      "modalFuncionarioDiretor",
      "modalFuncionarioDiretorEmail",
      "modalFuncionarioDiretorDocumento",
      "modalFuncionarioAtivoLogin",
      "modalFuncionarioStatusLogin",
    ];
    const missing = requiredIds.filter((id) => !document.getElementById(id));
    const dialog = document.querySelector(".tl-modal-card, .tl-dialog, [role='dialog']");
    const rect = dialog?.getBoundingClientRect();
    return {
      missing,
      statusFilter: document.querySelector("#selectFuncionarioStatus")?.value || "",
      imobiliariaFilterExists: Boolean(document.querySelector("#selectFuncionarioImobiliaria")),
      summaryChipCount: document.querySelectorAll("[data-funcionario-summary-filter]").length,
      modalTop: rect ? Math.round(rect.top) : null,
      modalCenterDelta: rect ? Math.round(Math.abs((rect.top + rect.height / 2) - window.innerHeight / 2)) : null,
    };
  });

  await page.screenshot({ path: path.join(outputDir, "funcionarios-modal.png"), fullPage: false });
  await page.close();

  return {
    ...state,
    consoleErrors: c.consoleErrors,
    pageErrors: c.pageErrors,
    requestFailures: c.requestFailures,
  };
}

async function auditAcessoSenha() {
  const page = await context.newPage();
  await page.addInitScript((session) => {
    sessionStorage.setItem("sevenlm_connect_token_de_acesso", session.token);
    sessionStorage.setItem("sevenlm_connect_token_de_renovacao", "qa-refresh");
    sessionStorage.setItem("sevenlm_connect_usuario", JSON.stringify({
      identificador_usuario: session.user_id,
      nome_completo: session.nome,
      correio_eletronico: session.email,
      indicador_precisa_trocar_senha: true,
    }));
  }, qa);
  const c = collectors(page);
  await page.goto(`${baseUrl}/acesso`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitIdle(page);
  await page.locator("#stagePassword").waitFor({ state: "visible", timeout: 30000 });
  const state = await page.evaluate(() => ({
    passwordStageVisible: Boolean(document.querySelector("#stagePassword:not([hidden])")),
    newPasswordExists: Boolean(document.querySelector("#novaSenha")),
    confirmPasswordExists: Boolean(document.querySelector("#confirmarSenha")),
    submitExists: Boolean(document.querySelector("#btnPassword")),
  }));
  await page.screenshot({ path: path.join(outputDir, "acesso-troca-senha.png"), fullPage: false });
  await page.close();
  return { ...state, consoleErrors: c.consoleErrors, pageErrors: c.pageErrors, requestFailures: c.requestFailures };
}

const report = {
  acessos: await auditAcessos(),
  funcionarios: await auditFuncionarios(),
  acessoSenha: await auditAcessoSenha(),
};

await browser.close();

const failures = [];
if (report.acessos.popupVisible) failures.push("Acessos ainda exibe popup de aprovacoes.");
if (report.acessos.kpisVisible) failures.push("Acessos ainda exibe KPI/card antigo.");
if (report.acessos.directRulesVisible) failures.push("Acessos ainda exibe painel de regras diretas.");
if (report.acessos.linkedProfilesVisible) failures.push("Acessos ainda exibe painel separado de perfis vinculados.");
if (!report.acessos.selectedUser) failures.push("Acessos nao selecionou usuario.");
if (!report.acessos.profileOptions.length) failures.push("Acessos nao carregou perfis.");
if (!report.acessos.resetModal?.passwordField || !report.acessos.resetModal?.confirmField) failures.push("Modal de reset de senha nao permite senha personalizada com confirmacao.");
if (!report.acessos.resetModal?.forceToggle) failures.push("Modal de reset de senha nao permite escolher forcar troca.");
if (report.funcionarios.missing.length) failures.push(`Funcionarios sem campos: ${report.funcionarios.missing.join(", ")}`);
if (report.funcionarios.statusFilter !== "ATIVO") failures.push("Chip de Ativos nao aplicou filtro.");
if (!report.funcionarios.imobiliariaFilterExists) failures.push("Filtro de imobiliaria ausente.");
if (!report.acessoSenha.passwordStageVisible) failures.push("Troca obrigatoria de senha nao abriu.");

for (const section of Object.values(report)) {
  if (section.consoleErrors?.length) failures.push(`Console errors: ${section.consoleErrors.join(" | ")}`);
  if (section.pageErrors?.length) failures.push(`Page errors: ${section.pageErrors.join(" | ")}`);
  if (section.requestFailures?.length) failures.push(`Request failures: ${section.requestFailures.join(" | ")}`);
}

await fs.writeFile(path.join(outputDir, "report.json"), JSON.stringify({ report, failures }, null, 2), "utf8");
console.log(JSON.stringify({ report, failures }, null, 2));
if (failures.length) {
  process.exitCode = 1;
}
