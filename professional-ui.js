(() => {
  const DESKTOP_QUERY = "(min-width: 900px)";
  let desktopStep = 1;

  const STEP_META = [
    { title: "Buscar imóvel", short: "Buscar", hint: "Cole o anúncio ou abra um imóvel salvo." },
    { title: "Dados principais", short: "Dados", hint: "Escolha o perfil e revise as informações principais." },
    { title: "Descrição e contato", short: "Descrição", hint: "Refine o texto e os canais de contato." },
    { title: "Imagem e enquadramento", short: "Imagem", hint: "Ajuste foto, corte, zoom e composição." },
    { title: "Marca e QR Code", short: "Marca", hint: "Logo, identidade, link e QR Code." },
    { title: "Revisar e publicar", short: "Publicar", hint: "Confira o resultado e exporte seus Stories." }
  ];

  const $ = (id) => document.getElementById(id);

  function injectStyles() {
    if ($("professional-ui-styles")) return;
    const style = document.createElement("style");
    style.id = "professional-ui-styles";
    style.textContent = `
      :root{
        --pro-bg:#0c0f0d;
        --pro-surface:#151914;
        --pro-surface-2:#1b211a;
        --pro-border:rgba(255,255,255,.075);
        --pro-border-strong:rgba(255,255,255,.13);
        --pro-text:#f7f8f5;
        --pro-muted:#929a91;
        --pro-accent:#c6a15b;
        --pro-accent-soft:rgba(198,161,91,.14);
        --pro-success:#557b4a;
      }

      body{
        background:
          radial-gradient(circle at 12% 0%,rgba(198,161,91,.055),transparent 24%),
          radial-gradient(circle at 90% 6%,rgba(76,112,65,.055),transparent 22%),
          var(--pro-bg)!important;
      }

      .panel{
        border:1px solid var(--pro-border)!important;
        background:linear-gradient(180deg,rgba(24,28,23,.96),rgba(15,18,15,.98))!important;
        box-shadow:0 24px 80px rgba(0,0,0,.34)!important;
      }
      .panel-header{
        padding-bottom:16px!important;
        border-bottom:1px solid var(--pro-border)!important;
      }
      .panel-title{
        letter-spacing:-.035em!important;
        font-weight:850!important;
      }
      .panel-subtitle{
        color:var(--pro-muted)!important;
      }

      .section,
      .story-template-panel,
      .workflow-panel,
      .property-panel,
      .logo-library,
      .cloud-profile-box,
      .export-formats-box,
      .story-set-box{
        border-color:var(--pro-border)!important;
        background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.018))!important;
        box-shadow:none!important;
      }

      .input,.textarea,.select,.file,
      .workflow-select,.realty-profile-select{
        background:rgba(4,7,5,.42)!important;
        border-color:var(--pro-border-strong)!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important;
      }
      .input:focus,.textarea:focus,.select:focus,.workflow-select:focus,.realty-profile-select:focus{
        border-color:rgba(198,161,91,.58)!important;
        box-shadow:0 0 0 3px rgba(198,161,91,.10)!important;
        outline:none!important;
      }
      .label{color:#d8ddd6!important}
      .hint{color:var(--pro-muted)!important}

      .btn,.workflow-btn,.property-btn,.story-extra-btn,.logo-card-btn,.cloud-profile-btn,.export-format-btn,.export-package-btn{
        transition:transform .15s ease,filter .15s ease,border-color .15s ease!important;
      }
      .btn:hover,.workflow-btn:hover,.property-btn:hover,.story-extra-btn:hover,.logo-card-btn:hover,.cloud-profile-btn:hover,.export-format-btn:hover,.export-package-btn:hover{
        filter:brightness(1.06);
      }

      #desktop-preview-mount{
        position:sticky!important;
        top:24px!important;
        align-self:start!important;
        min-height:calc(100vh - 48px);
        padding:20px!important;
        border:1px solid var(--pro-border)!important;
        border-radius:28px!important;
        background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.012))!important;
      }
      #desktop-preview-mount::before{
        content:"PRÉVIA AO VIVO";
        position:absolute;top:14px;left:18px;
        font-size:10px;font-weight:900;letter-spacing:.16em;color:rgba(255,255,255,.38);
      }
      #desktop-preview-mount .story-preview-shell{
        margin-top:18px;
        box-shadow:0 32px 90px rgba(0,0,0,.48)!important;
      }

      .desktop-wizard{display:none}
      .desktop-wizard-footer{display:none}

      @media(min-width:900px){
        body.desktop-wizard-active .max-w-6xl{
          max-width:1240px!important;
          grid-template-columns:minmax(0,1.05fr) minmax(390px,.95fr)!important;
          gap:24px!important;
          align-items:start!important;
        }

        body.desktop-wizard-active .panel{
          padding:22px!important;
          min-height:calc(100vh - 48px);
        }

        .desktop-wizard{
          display:block;
          margin:16px 0 18px;
          padding:10px;
          border:1px solid var(--pro-border);
          border-radius:18px;
          background:rgba(0,0,0,.16);
        }
        .desktop-wizard-top{
          display:flex;align-items:center;justify-content:space-between;gap:14px;
          padding:3px 4px 10px;
        }
        .desktop-wizard-kicker{
          font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:var(--pro-accent)
        }
        .desktop-wizard-title{margin-top:3px;font-size:17px;font-weight:900;letter-spacing:-.025em}
        .desktop-wizard-count{
          flex:0 0 auto;padding:6px 9px;border-radius:999px;
          background:var(--pro-accent-soft);border:1px solid rgba(198,161,91,.22);
          color:#e8cb91;font-size:10px;font-weight:900
        }
        .desktop-wizard-tabs{
          display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;
        }
        .desktop-wizard-tab{
          position:relative;min-height:48px;padding:7px 5px;border-radius:11px;
          border:1px solid transparent;background:rgba(255,255,255,.025);
          color:#899188;font-size:9px;font-weight:850;cursor:pointer;
        }
        .desktop-wizard-tab span{
          display:flex;align-items:center;justify-content:center;
          width:20px;height:20px;margin:0 auto 3px;border-radius:999px;
          background:rgba(255,255,255,.06);color:#aeb5ad;font-size:9px
        }
        .desktop-wizard-tab.is-active{
          color:#fff;background:rgba(198,161,91,.10);border-color:rgba(198,161,91,.23);
        }
        .desktop-wizard-tab.is-active span{
          background:var(--pro-accent);color:#151710;
        }
        .desktop-wizard-tab.is-complete{color:#b5bdaf}
        .desktop-wizard-tab.is-complete span{background:rgba(85,123,74,.7);color:#fff}

        body.desktop-wizard-active .panel>[data-desktop-step]{
          display:none!important;
        }
        body.desktop-wizard-active .panel>[data-desktop-step].desktop-step-active{
          display:block!important;
          animation:professionalStepIn .18s ease-out;
        }

        .desktop-wizard-footer{
          position:sticky;bottom:10px;z-index:90;
          display:flex;align-items:center;justify-content:space-between;gap:10px;
          margin-top:16px;padding:9px;
          border:1px solid var(--pro-border-strong);border-radius:16px;
          background:rgba(15,18,15,.94);backdrop-filter:blur(14px);
          box-shadow:0 18px 44px rgba(0,0,0,.32);
        }
        .desktop-wizard-footer-copy{
          min-width:0;flex:1;padding-left:4px;
        }
        .desktop-wizard-footer-title{font-size:11px;font-weight:900}
        .desktop-wizard-footer-hint{margin-top:2px;font-size:9px;color:var(--pro-muted)}
        .desktop-wizard-footer-actions{display:flex;gap:7px}
        .desktop-wizard-action{
          min-height:42px;padding:8px 14px;border-radius:11px;border:1px solid var(--pro-border-strong);
          font-size:11px;font-weight:900;cursor:pointer
        }
        .desktop-wizard-back{background:rgba(255,255,255,.045);color:#fff}
        .desktop-wizard-next{background:var(--pro-success);border-color:var(--pro-success);color:#fff}
        .desktop-wizard-action:disabled{opacity:.35;cursor:default}

        body.desktop-wizard-active .workflow-panel,
        body.desktop-wizard-active .property-panel{
          margin-top:10px!important;
        }

        body.desktop-wizard-active .story-template-grid{
          grid-template-columns:repeat(5,minmax(0,1fr))!important;
        }

        body.desktop-wizard-active .realty-profile-controls{
          margin-top:2px!important;
        }
      }

      @keyframes professionalStepIn{
        from{opacity:.55;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @media(max-width:899px){
        body.mobile-wizard-active{
          background:
            radial-gradient(circle at 12% 0%,rgba(198,161,91,.06),transparent 25%),
            #0b0e0c!important;
        }
        body.mobile-wizard-active .panel{
          background:linear-gradient(180deg,rgba(24,28,23,.98),rgba(13,16,13,.99))!important;
          border:1px solid rgba(255,255,255,.065)!important;
          box-shadow:none!important;
        }
        body.mobile-wizard-active .mobile-wizard-progress{
          background:rgba(18,22,18,.97)!important;
          border-color:rgba(255,255,255,.08)!important;
          box-shadow:0 10px 28px rgba(0,0,0,.28)!important;
        }
        body.mobile-wizard-active .mobile-wizard-step-title{
          letter-spacing:-.015em;
        }
        body.mobile-wizard-active .mobile-wizard-bar{
          left:7px!important;right:7px!important;
          background:rgba(15,18,15,.96)!important;
          border-color:rgba(255,255,255,.09)!important;
          box-shadow:0 18px 46px rgba(0,0,0,.42)!important;
        }
        body.mobile-wizard-active .mobile-wizard-btn{
          min-height:46px!important;
          border-radius:12px!important;
        }
        body.mobile-wizard-active .mobile-wizard-next{
          background:#557b4a!important;
        }
        body.mobile-wizard-active .mobile-wizard-preview{
          background:rgba(198,161,91,.12)!important;
          border-color:rgba(198,161,91,.24)!important;
          color:#e8cb91!important;
        }
        body.mobile-wizard-active .panel>.section.mobile-step-active,
        body.mobile-wizard-active .story-template-panel{
          border:1px solid rgba(255,255,255,.07)!important;
          background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.018))!important;
          box-shadow:none!important;
        }
        body.mobile-wizard-active .input,
        body.mobile-wizard-active .textarea,
        body.mobile-wizard-active .select,
        body.mobile-wizard-active .file{
          background:rgba(5,8,6,.48)!important;
          border-color:rgba(255,255,255,.10)!important;
        }
        body.mobile-wizard-active #mobile-secondary-toggle{
          background:rgba(255,255,255,.028)!important;
          border-color:rgba(255,255,255,.07)!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function isDirectPanelChild(el) {
    return el && el.parentElement?.classList?.contains("panel");
  }

  function assign(el, step) {
    if (!el || !isDirectPanelChild(el)) return;
    el.dataset.desktopStep = String(step);
  }

  function classifyDesktop() {
    const panel = document.querySelector(".panel");
    if (!panel) return;

    [...panel.children].forEach((el) => {
      if (el.classList.contains("panel-header") || el.id === "desktop-wizard" || el.id === "desktop-wizard-footer") return;

      if (el.id === "workflow-panel" || el.id === "property-panel" || el.querySelector?.("#imovel-url")) {
        assign(el, 1); return;
      }

      if (el.id === "story-template-panel" || el.querySelector?.("#badge") || el.querySelector?.("#title") || el.querySelector?.("#price") || el.querySelector?.("#city") || el.querySelector?.("#district") || el.querySelector?.("#area")) {
        assign(el, 2); return;
      }

      if (el.id === "mobile-description-section" || el.querySelector?.("#description") || el.querySelector?.("#contact")) {
        assign(el, 3); return;
      }

      if (el.id === "mobile-image-section" || el.id === "adjustment-section" || el.querySelector?.("#image-upload-story")) {
        assign(el, 4); return;
      }

      if (
        el.id === "mobile-logo-section" ||
        el.id === "story-advanced-section" ||
        el.id === "logo-library" ||
        el.id === "cloud-profile-box" ||
        el.id === "auto-brand-box" ||
        el.querySelector?.("#logo-upload-story") ||
        el.querySelector?.("#more-photos-url")
      ) {
        assign(el, 5); return;
      }

      if (
        el.id === "story-set-box" ||
        el.id === "export-formats-box" ||
        el.querySelector?.("#download-story") ||
        el.querySelector?.("#post-story") ||
        el.querySelector?.("#export-package")
      ) {
        assign(el, 6); return;
      }

      if (el.classList.contains("section") || /panel|box|library/.test(el.className || "")) {
        assign(el, 6);
      }
    });
  }

  function createDesktopWizard() {
    const panel = document.querySelector(".panel");
    if (!panel || $("desktop-wizard")) return;

    const nav = document.createElement("div");
    nav.id = "desktop-wizard";
    nav.className = "desktop-wizard";
    nav.innerHTML = `
      <div class="desktop-wizard-top">
        <div>
          <div class="desktop-wizard-kicker">Fluxo de criação</div>
          <div id="desktop-wizard-title" class="desktop-wizard-title">Buscar imóvel</div>
        </div>
        <div id="desktop-wizard-count" class="desktop-wizard-count">Etapa 1 de 6</div>
      </div>
      <div class="desktop-wizard-tabs">
        ${STEP_META.map((step, index) => `
          <button type="button" class="desktop-wizard-tab" data-desktop-go="${index + 1}">
            <span>${index + 1}</span>${step.short}
          </button>
        `).join("")}
      </div>
    `;

    const header = panel.querySelector(".panel-header");
    header?.insertAdjacentElement("afterend", nav);

    nav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-desktop-go]");
      if (!button) return;
      setDesktopStep(Number(button.dataset.desktopGo));
    });

    const footer = document.createElement("div");
    footer.id = "desktop-wizard-footer";
    footer.className = "desktop-wizard-footer";
    footer.innerHTML = `
      <div class="desktop-wizard-footer-copy">
        <div id="desktop-footer-title" class="desktop-wizard-footer-title">Buscar imóvel</div>
        <div id="desktop-footer-hint" class="desktop-wizard-footer-hint"></div>
      </div>
      <div class="desktop-wizard-footer-actions">
        <button id="desktop-wizard-back" class="desktop-wizard-action desktop-wizard-back" type="button">Voltar</button>
        <button id="desktop-wizard-next" class="desktop-wizard-action desktop-wizard-next" type="button">Próximo</button>
      </div>
    `;
    panel.appendChild(footer);

    $("desktop-wizard-back")?.addEventListener("click", () => setDesktopStep(desktopStep - 1));
    $("desktop-wizard-next")?.addEventListener("click", () => setDesktopStep(desktopStep + 1));
  }

  function setDesktopStep(step) {
    desktopStep = Math.max(1, Math.min(6, step));
    classifyDesktop();

    document.querySelectorAll(".panel>[data-desktop-step]").forEach((el) => {
      el.classList.toggle("desktop-step-active", Number(el.dataset.desktopStep) === desktopStep);
    });

    const meta = STEP_META[desktopStep - 1];
    if ($("desktop-wizard-title")) $("desktop-wizard-title").textContent = meta.title;
    if ($("desktop-wizard-count")) $("desktop-wizard-count").textContent = `Etapa ${desktopStep} de 6`;
    if ($("desktop-footer-title")) $("desktop-footer-title").textContent = meta.title;
    if ($("desktop-footer-hint")) $("desktop-footer-hint").textContent = meta.hint;

    document.querySelectorAll(".desktop-wizard-tab").forEach((button) => {
      const value = Number(button.dataset.desktopGo);
      button.classList.toggle("is-active", value === desktopStep);
      button.classList.toggle("is-complete", value < desktopStep);
    });

    const back = $("desktop-wizard-back");
    const next = $("desktop-wizard-next");
    if (back) back.disabled = desktopStep === 1;
    if (next) {
      next.style.display = desktopStep === 6 ? "none" : "";
      next.textContent = desktopStep === 5 ? "Revisar" : "Próximo";
    }

    if (window.matchMedia(DESKTOP_QUERY).matches) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function syncDesktopMode() {
    const enabled = window.matchMedia(DESKTOP_QUERY).matches;
    document.body.classList.toggle("desktop-wizard-active", enabled);
    if (enabled) setDesktopStep(desktopStep);
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    setTimeout(() => {
      createDesktopWizard();
      classifyDesktop();

      const panel = document.querySelector(".panel");
      if (panel) {
        const observer = new MutationObserver(() => {
          classifyDesktop();
          if (window.matchMedia(DESKTOP_QUERY).matches) setDesktopStep(desktopStep);
        });
        observer.observe(panel, { childList: true });
      }

      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener?.("change", syncDesktopMode);
      syncDesktopMode();
    }, 80);
  });
})();