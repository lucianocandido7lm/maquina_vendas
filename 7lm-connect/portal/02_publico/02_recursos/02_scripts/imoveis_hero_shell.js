(function () {
  "use strict";

  const STORAGE_KEY = "sevenlm_connect_imoveis_hero_collapsed";
  const heroShell = document.querySelector("[data-imoveis-hero-shell]");
  const toggles = Array.from(document.querySelectorAll("[data-imoveis-hero-toggle]"));

  if (!heroShell || !toggles.length) {
    return;
  }

  function readStoredState() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function writeStoredState(collapsed) {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch (error) {}
  }

  function applyState(collapsed) {
    heroShell.classList.toggle("is-collapsed", collapsed);
    toggles.forEach((toggle) => {
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggle.setAttribute(
        "aria-label",
        collapsed ? "Expandir cabecalho da pagina" : "Recolher cabecalho da pagina"
      );

      const label = toggle.querySelector("[data-imoveis-hero-toggle-label]");
      if (label) {
        label.textContent = collapsed ? "EXPANDIR" : "RECOLHER";
      }
    });
  }

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const collapsed = !heroShell.classList.contains("is-collapsed");
      applyState(collapsed);
      writeStoredState(collapsed);
    });
  });

  applyState(readStoredState());
})();
