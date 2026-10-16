(() => {
  const MOBILE_QUERY = "(max-width: 899px)";
  let currentStep = 1;
  let originalPreviewParent = null;
  let previewOpen = false;

  function injectStyles() {
    if (document.getElementById("mobile-wizard-styles")) return;
    const style = document.createElement("style");
    style.id = "mobile-wizard-styles";
    style.textContent = `
      .mobile-wizard-ui{display:none}
      @media (max-width:899px){
        body.mobile-wizard-active{padding-bottom:78px!important}
        body.mobile-wizard-active .panel>.section[data-mobile-step]{display:none!important}
        body.mobile-wizard-active .panel>.section[data-mobile-step].mobile-step-active{display:block!important}
        body.mobile-wizard-active #download-story,
        body.mobile-wizard-active #post-story{display:none!important}
        .mobile-wizard-ui{display:flex}
        .mobile-wizard-progress{position:sticky;top:4px;z-index:80;flex-direction:column;gap:5px;margin:4px 0 7px;padding:8px 10px;border-radius:13px;background:rgba(21,22,13,.96);border:1px solid rgba(255,255,255,.10);box-shadow:0 12px 30px rgba(0,0,0,.28);backdrop-filter:blur(12px)}
        .mobile-wizard-progress-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .mobile-wizard-step-title{font-size:13px;font-weight:900;color:#fff}
        .mobile-wizard-step-count{font-size:10px;font-weight:800;color:#f8d78c}
        .mobile-wizard-track{height:4px;border-radius:999px;background:rgba(255,255,255,.11);overflow:hidden}
        .mobile-wizard-track>span{display:block;height:100%;border-radius:999px;background:#c88b3a;transition:width .2s ease}
        .mobile-wizard-bar{position:fixed;left:6px;right:6px;bottom:max(6px,env(safe-area-inset-bottom));z-index:120;align-items:center;gap:6px;padding:6px;border-radius:14px;background:rgba(17,18,12,.97);border:1px solid rgba(255,255,255,.11);box-shadow:0 18px 45px rgba(0,0,0,.48);backdrop-filter:blur(14px)}
        .mobile-wizard-btn{min-height:44px;border:1px solid rgba(255,255,255,.11);border-radius:11px;padding:8px 9px;color:#fff;font-size:12px;font-weight:900}
        .mobile-wizard-back{flex:.85;background:rgba(255,255,255,.06)}
        .mobile-wizard-preview{flex:1.1;background:rgba(200,139,58,.16);border-color:rgba(200,139,58,.35);color:#f8d78c}
        .mobile-wizard-next{flex:1.15;background:#4f7f3f}
        .mobile-wizard-btn:disabled{opacity:.35}
        .mobile-final-actions{display:grid;grid-template-columns:1fr;gap:7px;margin:6px 0;padding:9px;border-radius:13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
        .mobile-final-actions button{min-height:44px;border-radius:11px;font-size:12px;font-weight:900}
        #mobile-story-preview-modal{display:none;position:fixed;inset:0;z-index:300;padding:10px 8px;background:rgba(5,6,4,.94);backdrop-filter:blur(10px);align-items:center;justify-content:center;flex-direction:column;gap:12px}
        #mobile-story-preview-modal.is-open{display:flex}
        .mobile-preview-modal-head{width:min(100%,390px);display:flex;align-items:center;justify-content:space-between;gap:12px}
        .mobile-preview-modal-title{font-size:14px;font-weight:900}
        .mobile-preview-modal-close{min-width:76px;min-height:38px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.08);color:#fff;font-weight:900}
        #mobile-story-preview-host{width:min(92vw,360px);display:flex;align-items:center;justify-content:center;overflow:auto}
        #mobile-story-preview-host .story-preview-shell{width:min(92vw,360px)!important;height:auto!important;aspect-ratio:9/16!important;margin:0 auto}

        body.mobile-wizard-active .panel{padding:7px!important}
        body.mobile-wizard-active .panel-header{margin-bottom:4px!important;padding-bottom:4px!important}
        body.mobile-wizard-active .panel-title{font-size:17px!important;line-height:1.15!important}
        body.mobile-wizard-active .panel-subtitle{font-size:10px!important;line-height:1.2!important;margin-top:2px!important}

        body.mobile-wizard-active .panel>.section.mobile-step-active{
          margin-top:4px!important;
          padding:7px!important;
          border-radius:11px!important;
        }

        body.mobile-wizard-active .workflow-panel,
        body.mobile-wizard-active .property-panel{
          display:none!important;
        }
        body.mobile-wizard-active.mobile-secondary-open .workflow-panel,
        body.mobile-wizard-active.mobile-secondary-open .property-panel{
          display:block!important;
        }
        #mobile-secondary-toggle{
          display:none;
        }
        body.mobile-wizard-active #mobile-secondary-toggle{
          display:flex;
          width:100%;
          min-height:40px;
          margin:5px 0 7px;
          padding:7px 10px;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          border:1px solid rgba(255,255,255,.09);
          border-radius:11px;
          background:rgba(255,255,255,.045);
          color:#f8d78c;
          font-size:11px;
          font-weight:900;
        }
        body.mobile-wizard-active #mobile-secondary-toggle span:last-child{
          font-size:14px;
          transition:transform .18s ease;
        }
        body.mobile-wizard-active.mobile-secondary-open #mobile-secondary-toggle span:last-child{
          transform:rotate(180deg);
        }
        body.mobile-wizard-active.mobile-secondary-open .workflow-panel,
        body.mobile-wizard-active.mobile-secondary-open .property-panel{
          margin-top:6px!important;
          padding:9px!important;
          border-radius:12px!important;
        }
        body.mobile-wizard-active.mobile-secondary-open .workflow-title,
        body.mobile-wizard-active.mobile-secondary-open .property-title{
          font-size:11px!important;
        }
        body.mobile-wizard-active.mobile-secondary-open .workflow-subtitle,
        body.mobile-wizard-active.mobile-secondary-open .property-subtitle,
        body.mobile-wizard-active.mobile-secondary-open .workflow-status,
        body.mobile-wizard-active.mobile-secondary-open .property-status{
          font-size:9px!important;
          line-height:1.25!important;
        }
        body.mobile-wizard-active .section-title{
          font-size:11px!important;
          line-height:1.15!important;
          margin-bottom:7px!important;
        }
        body.mobile-wizard-active .field{
          gap:3px!important;
          margin-bottom:7px!important;
        }
        body.mobile-wizard-active .label{
          font-size:11px!important;
          line-height:1.15!important;
        }
        body.mobile-wizard-active .input,
        body.mobile-wizard-active .select,
        body.mobile-wizard-active .file{
          min-height:38px!important;
          height:38px!important;
          padding:7px 9px!important;
          font-size:13px!important;
          border-radius:10px!important;
        }
        body.mobile-wizard-active .textarea{
          min-height:56px!important;
          padding:7px 9px!important;
          font-size:13px!important;
          border-radius:10px!important;
        }
        body.mobile-wizard-active .hint,
        body.mobile-wizard-active .adjust-hint{
          font-size:9px!important;
          line-height:1.25!important;
          margin-top:4px!important;
        }
        body.mobile-wizard-active .grid-2{gap:6px!important}
        body.mobile-wizard-active .btn{
          min-height:42px!important;
          font-size:12px!important;
          border-radius:10px!important;
          padding:8px 10px!important;
        }
        body.mobile-wizard-active .check{
          min-height:38px!important;
          padding:7px 9px!important;
          font-size:11px!important;
        }

        body.mobile-wizard-active .adjustment-panel{gap:7px!important}
        body.mobile-wizard-active .adjustment-grid{gap:6px!important}
        body.mobile-wizard-active .adjust-control,
        body.mobile-wizard-active .framing-block{
          padding:8px!important;
          border-radius:11px!important;
        }
        body.mobile-wizard-active .adjust-control-head{margin-bottom:4px!important}
        body.mobile-wizard-active .adjust-control-title,
        body.mobile-wizard-active .framing-title{font-size:11px!important}
        body.mobile-wizard-active .adjust-value{
          min-width:48px!important;
          min-height:24px!important;
          padding:3px 7px!important;
          font-size:10px!important;
        }
        body.mobile-wizard-active .adjust-range{height:28px!important}
        body.mobile-wizard-active .adjust-range::-webkit-slider-thumb{
          width:22px!important;height:22px!important;margin-top:-7px!important
        }
        body.mobile-wizard-active .adjust-range-scale{font-size:9px!important}
        body.mobile-wizard-active .framing-presets{
          grid-template-columns:repeat(3,minmax(0,1fr))!important;
          gap:5px!important;
        }
        body.mobile-wizard-active .frame-preset{
          min-height:38px!important;
          padding:6px!important;
          font-size:10px!important;
          border-radius:9px!important;
        }
        body.mobile-wizard-active .frame-preset:nth-child(5){grid-column:auto!important}
        body.mobile-wizard-active .btn-reset-adjustments{
          min-height:40px!important;
          padding:7px 9px!important;
          font-size:10px!important;
          border-radius:10px!important;
        }

        body.mobile-wizard-active #mobile-preview-mount{
          margin:0 0 7px!important;
          padding:5px!important;
          border-radius:11px!important;
        }
        body.mobile-wizard-active #mobile-preview-mount .story-preview-shell{
          width:min(100%,205px)!important;
          border-radius:14px!important;
        }

        body.mobile-wizard-active #story-advanced-section .story-extra-grid{gap:6px!important}
        body.mobile-wizard-active #story-advanced-section .story-extra-control{padding:8px!important}
        body.mobile-wizard-active #story-advanced-section .story-extra-actions{gap:6px!important}
        body.mobile-wizard-active #story-advanced-section .story-extra-btn{
          min-height:40px!important;
          font-size:10px!important;
          padding:7px 8px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getStepForSection(section) {
    if (section.querySelector("#imovel-url")) return 1;

    if (section.querySelector("#badge") || section.querySelector("#title") || section.querySelector("#price") || section.querySelector("#city") || section.querySelector("#district") || section.querySelector("#area")) {
      return 2;
    }

    if (section.querySelector("#description") || section.querySelector("#contact")) {
      return 3;
    }

    if (section.id === "adjustment-section" || section.id === "mobile-image-section" || section.querySelector("#image-upload-story")) {
      return 4;
    }

    if (section.id === "story-advanced-section" || section.id === "mobile-logo-section" || section.querySelector("#logo-upload-story")) {
      return 5;
    }

    return 6;
  }

  function splitDataSectionForMobile() {
    const original = [...document.querySelectorAll(".panel>.section")].find((section) => section.querySelector("#title") && section.querySelector("#description"));
    if (!original || original.dataset.mobileSplitDone === "true") return;

    const descriptionField = document.getElementById("description")?.closest(".field");
    const contactField = document.getElementById("contact")?.closest(".field");
    if (!descriptionField && !contactField) return;

    const detailSection = document.createElement("div");
    detailSection.className = "section";
    detailSection.id = "mobile-description-section";
    detailSection.innerHTML = '<div class="section-title">Descrição e contato</div>';

    if (descriptionField) detailSection.appendChild(descriptionField);
    if (contactField) detailSection.appendChild(contactField);

    original.insertAdjacentElement("afterend", detailSection);
    original.dataset.mobileSplitDone = "true";
  }

  function splitImagesSectionForMobile() {
    const original = [...document.querySelectorAll(".panel>.section")].find((section) => section.querySelector("#image-upload-story") && section.querySelector("#logo-upload-story"));
    if (!original || original.dataset.mobileSplitDone === "true") return;

    const imageField = document.getElementById("image-upload-story")?.closest(".field");
    const logoField = document.getElementById("logo-upload-story")?.closest(".field");
    if (!imageField || !logoField) return;

    const imageSection = document.createElement("div");
    imageSection.className = "section";
    imageSection.id = "mobile-image-section";
    imageSection.innerHTML = '<div class="section-title">Imagem do imóvel</div>';
    imageSection.appendChild(imageField);

    const logoSection = document.createElement("div");
    logoSection.className = "section";
    logoSection.id = "mobile-logo-section";
    logoSection.innerHTML = '<div class="section-title">Logo</div>';
    logoSection.appendChild(logoField);

    original.insertAdjacentElement("afterend", imageSection);
    imageSection.insertAdjacentElement("afterend", logoSection);
    original.remove();
  }

  function classifySections() {
    const panel = document.querySelector(".panel");
    if (!panel) return;
    [...panel.children].forEach((section) => {
      if (!section.classList?.contains("section")) return;
      section.dataset.mobileStep = String(getStepForSection(section));
    });
  }

  function createProgress(panel) {
    if (document.getElementById("mobile-wizard-progress")) return;
    const progress = document.createElement("div");
    progress.id = "mobile-wizard-progress";
    progress.className = "mobile-wizard-progress mobile-wizard-ui";
    progress.innerHTML = `
      <div class="mobile-wizard-progress-row">
        <div id="mobile-wizard-step-title" class="mobile-wizard-step-title">Imóvel</div>
        <div id="mobile-wizard-step-count" class="mobile-wizard-step-count">Etapa 1 de 6</div>
      </div>
      <div class="mobile-wizard-track"><span id="mobile-wizard-track-fill" style="width:16.6667%"></span></div>
    `;
    const header = panel.querySelector(".panel-header");
    if (header?.nextSibling) panel.insertBefore(progress, header.nextSibling);
    else panel.prepend(progress);
  }

  function createSecondaryToggle(panel) {
    if (document.getElementById("mobile-secondary-toggle")) return;

    const button = document.createElement("button");
    button.id = "mobile-secondary-toggle";
    button.type = "button";
    button.innerHTML = `
      <span>Rascunhos e imóveis salvos</span>
      <span>⌄</span>
    `;

    const progress = document.getElementById("mobile-wizard-progress");
    if (progress?.nextSibling) panel.insertBefore(button, progress.nextSibling);
    else panel.prepend(button);

    button.addEventListener("click", () => {
      document.body.classList.toggle("mobile-secondary-open");
    });
  }

  function createFinalActions(panel) {
    if (document.getElementById("mobile-final-actions")) return;
    const host = document.createElement("div");
    host.id = "mobile-final-actions";
    host.className = "section mobile-final-actions";
    host.dataset.mobileStep = "4";
    host.innerHTML = `
      <div class="section-title">Finalizar publicação</div>
      <button id="mobile-download-story" class="btn btn-gold" type="button">Baixar PNG</button>
      <button id="mobile-post-story" class="btn btn-dark" type="button">Postar no Story</button>
    `;
    panel.appendChild(host);
    host.querySelector("#mobile-download-story")?.addEventListener("click", () => document.getElementById("download-story")?.click());
    host.querySelector("#mobile-post-story")?.addEventListener("click", () => document.getElementById("post-story")?.click());
  }

  function createPreviewModal() {
    if (document.getElementById("mobile-story-preview-modal")) return;
    const modal = document.createElement("div");
    modal.id = "mobile-story-preview-modal";
    modal.innerHTML = `
      <div class="mobile-preview-modal-head">
        <div class="mobile-preview-modal-title">Prévia do Story</div>
        <button id="mobile-preview-close" class="mobile-preview-modal-close" type="button">Fechar</button>
      </div>
      <div id="mobile-story-preview-host"></div>
    `;
    document.body.appendChild(modal);
    modal.querySelector("#mobile-preview-close")?.addEventListener("click", closePreview);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closePreview();
    });
  }

  function resizePreviewShell(shell) {
    if (!shell) return;
    const stage = shell.querySelector(".story-preview-stage");
    if (!stage) return;
    requestAnimationFrame(() => {
      const width = shell.getBoundingClientRect().width || Math.min(window.innerWidth * .92, 360);
      const scale = width / 1080;
      stage.style.transform = `scale(${scale})`;
      stage.style.transformOrigin = "top left";
      shell.style.height = `${1920 * scale}px`;
    });
  }

  function openPreview() {
    if (!window.matchMedia(MOBILE_QUERY).matches) return;
    const shell = document.querySelector(".story-preview-shell");
    const host = document.getElementById("mobile-story-preview-host");
    const modal = document.getElementById("mobile-story-preview-modal");
    if (!shell || !host || !modal) return;
    if (!originalPreviewParent) originalPreviewParent = shell.parentElement;
    host.appendChild(shell);
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    previewOpen = true;
    resizePreviewShell(shell);
  }

  function closePreview() {
    const shell = document.querySelector("#mobile-story-preview-host .story-preview-shell");
    const modal = document.getElementById("mobile-story-preview-modal");
    if (shell && originalPreviewParent) originalPreviewParent.appendChild(shell);
    modal?.classList.remove("is-open");
    document.body.style.overflow = "";
    previewOpen = false;
  }

  function createBottomBar() {
    if (document.getElementById("mobile-wizard-bar")) return;
    const bar = document.createElement("div");
    bar.id = "mobile-wizard-bar";
    bar.className = "mobile-wizard-bar mobile-wizard-ui";
    bar.innerHTML = `
      <button id="mobile-wizard-back" class="mobile-wizard-btn mobile-wizard-back" type="button">Voltar</button>
      <button id="mobile-wizard-preview" class="mobile-wizard-btn mobile-wizard-preview" type="button">Ver prévia</button>
      <button id="mobile-wizard-next" class="mobile-wizard-btn mobile-wizard-next" type="button">Próximo</button>
    `;
    document.body.appendChild(bar);
    bar.querySelector("#mobile-wizard-back")?.addEventListener("click", () => setStep(currentStep - 1));
    bar.querySelector("#mobile-wizard-preview")?.addEventListener("click", openPreview);
    bar.querySelector("#mobile-wizard-next")?.addEventListener("click", () => setStep(currentStep + 1));
  }

  function setStep(step) {
    currentStep = Math.max(1, Math.min(6, step));
    classifySections();
    document.querySelectorAll(".panel>.section[data-mobile-step]").forEach((section) => {
      section.classList.toggle("mobile-step-active", Number(section.dataset.mobileStep) === currentStep);
    });
    const titles = ["Buscar imóvel", "Dados principais", "Descrição", "Imagem", "Logo e QR", "Publicação"];
    const title = document.getElementById("mobile-wizard-step-title");
    const count = document.getElementById("mobile-wizard-step-count");
    const fill = document.getElementById("mobile-wizard-track-fill");
    const back = document.getElementById("mobile-wizard-back");
    const next = document.getElementById("mobile-wizard-next");
    if (title) title.textContent = titles[currentStep - 1];
    if (count) count.textContent = `Etapa ${currentStep} de 6`;
    if (fill) fill.style.width = `${currentStep * (100 / 6)}%`;
    if (back) back.disabled = currentStep === 1;
    if (next) {
      next.style.display = currentStep === 6 ? "none" : "";
      const labels = ["Dados", "Descrição", "Imagem", "Logo e QR", "Publicar"];
      next.textContent = labels[currentStep - 1] || "Próximo";
    }

    const secondaryToggle = document.getElementById("mobile-secondary-toggle");
    if (secondaryToggle) secondaryToggle.style.display = currentStep === 1 ? "" : "none";
    if (currentStep !== 1) document.body.classList.remove("mobile-secondary-open");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function syncMode() {
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    document.body.classList.toggle("mobile-wizard-active", mobile);
    if (!mobile && previewOpen) closePreview();
    if (mobile) setStep(currentStep);
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      const panel = document.querySelector(".panel");
      if (!panel) return;
      injectStyles();
      splitDataSectionForMobile();
      splitImagesSectionForMobile();
      classifySections();
      createProgress(panel);
      createSecondaryToggle(panel);
      createFinalActions(panel);
      createPreviewModal();
      createBottomBar();
      const observer = new MutationObserver(() => {
        classifySections();
        setStep(currentStep);
      });
      observer.observe(panel, { childList: true });
      const mq = window.matchMedia(MOBILE_QUERY);
      mq.addEventListener?.("change", syncMode);
      syncMode();
    }, 0);
  });
})();