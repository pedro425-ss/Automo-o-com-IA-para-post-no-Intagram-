(() => {
  let deferredInstallPrompt = null;

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function injectStyles() {
    if (document.getElementById("pwa-install-styles")) return;
    const style = document.createElement("style");
    style.id = "pwa-install-styles";
    style.textContent = `
      #pwa-install-card{display:none}
      @media(max-width:899px){
        #pwa-install-card{
          position:fixed;left:10px;right:10px;bottom:82px;z-index:170;
          align-items:center;justify-content:space-between;gap:10px;
          padding:10px 11px;border-radius:15px;
          background:rgba(21,22,13,.97);border:1px solid rgba(248,215,140,.24);
          box-shadow:0 16px 42px rgba(0,0,0,.42);backdrop-filter:blur(12px)
        }
        #pwa-install-card.is-visible{display:flex}
        .pwa-install-copy{min-width:0;flex:1}
        .pwa-install-title{font-size:12px;font-weight:900;color:#fff}
        .pwa-install-subtitle{margin-top:2px;font-size:9px;line-height:1.25;color:rgba(255,255,255,.65)}
        .pwa-install-actions{display:flex;gap:6px;flex:0 0 auto}
        .pwa-install-btn{min-height:38px;padding:7px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.11);font-size:10px;font-weight:900}
        #pwa-install-now{background:#4f7f3f;color:#fff}
        #pwa-install-close{background:rgba(255,255,255,.06);color:#fff}
      }
    `;
    document.head.appendChild(style);
  }

  function createInstallCard() {
    if (document.getElementById("pwa-install-card")) return;
    const card = document.createElement("div");
    card.id = "pwa-install-card";
    card.innerHTML = `
      <div class="pwa-install-copy">
        <div class="pwa-install-title">Instalar Story Imóveis</div>
        <div class="pwa-install-subtitle">Abra como aplicativo direto da tela inicial.</div>
      </div>
      <div class="pwa-install-actions">
        <button id="pwa-install-close" class="pwa-install-btn" type="button">Agora não</button>
        <button id="pwa-install-now" class="pwa-install-btn" type="button">Instalar</button>
      </div>
    `;
    document.body.appendChild(card);

    document.getElementById("pwa-install-close")?.addEventListener("click", () => {
      card.classList.remove("is-visible");
      sessionStorage.setItem("pwa-install-dismissed", "1");
    });

    document.getElementById("pwa-install-now")?.addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        try { await deferredInstallPrompt.userChoice; } catch {}
        deferredInstallPrompt = null;
        card.classList.remove("is-visible");
        return;
      }

      alert("No Chrome, toque no menu ⋮ e escolha “Instalar app” ou “Adicionar à tela inicial”.");
    });
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      registration.update().catch(() => {});
    } catch (error) {
      console.warn("PWA: service worker não registrado:", error);
    }
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    const dismissed = sessionStorage.getItem("pwa-install-dismissed") === "1";
    if (!isStandalone() && !dismissed) {
      document.getElementById("pwa-install-card")?.classList.add("is-visible");
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    document.getElementById("pwa-install-card")?.classList.remove("is-visible");
  });

  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    createInstallCard();
    registerServiceWorker();
    document.documentElement.classList.toggle("pwa-standalone", isStandalone());

    if (!isStandalone() && sessionStorage.getItem("pwa-install-dismissed") !== "1") {
      setTimeout(() => {
        document.getElementById("pwa-install-card")?.classList.add("is-visible");
      }, 1400);
    }
  });
})();
