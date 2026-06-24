(function () {
  "use strict";

  function buildLocalHref(fileName, embedMode) {
    const safe = String(fileName || "").trim();
    if (!safe) return "#";
    return embedMode ? `${safe}?embed=1` : safe;
  }

  document.addEventListener("DOMContentLoaded", function () {
    const embedMode = window.self !== window.top || new URLSearchParams(window.location.search).get("embed") === "1";
    document.documentElement.classList.toggle("portal-embed", embedMode);

    document.querySelectorAll(".nav-center a[href]").forEach((link) => {
      const rawHref = link.getAttribute("href") || "";
      if (!rawHref || rawHref.startsWith("http") || rawHref.startsWith("#")) return;
      const fileName = rawHref.split("?")[0].split("/").pop();
      link.setAttribute("href", buildLocalHref(fileName, embedMode));
    });

    const navRight = document.querySelector(".nav-right");
    if (!navRight) return;

    const action = document.createElement("a");
    action.className = "portal-bridge-btn";

    if (embedMode) {
      action.textContent = "Abrir fora do card";
      action.href = window.location.pathname;
      action.target = "_blank";
      action.rel = "noopener noreferrer";
    } else {
      action.textContent = "Voltar \u00E0 M\u00E1quina de Vendas";
      action.href = "/financeiro";
    }

    navRight.prepend(action);
  });
})();
