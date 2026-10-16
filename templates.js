(() => {
  const STORAGE_KEY = "assessoria-story-template-v1";

  const TEMPLATES = {
    venda: {
      label: "Venda",
      badge: "IMÓVEL À VENDA",
      footer: "Casas, apartamentos, terrenos e áreas",
      cta: "Fale conosco",
      titlePlaceholder: "Ex: Casa ampla com excelente localização",
      descriptionPlaceholder: "Ex: Excelente oportunidade para compra. Agende sua visita.",
      theme: {
        badge: "#c88b3a",
        price: "#f8d78c",
        overlay: "linear-gradient(180deg,rgba(0,0,0,.05) 0%,rgba(0,0,0,.42) 52%,rgba(0,0,0,.88) 100%)",
        ctaBg: "rgba(255,255,255,.12)",
        ctaBorder: "rgba(255,255,255,.18)"
      }
    },
    locacao: {
      label: "Locação",
      badge: "IMÓVEL PARA LOCAÇÃO",
      footer: "Encontre o imóvel ideal para alugar",
      cta: "Consulte disponibilidade",
      titlePlaceholder: "Ex: Casa para locação em ótima região",
      descriptionPlaceholder: "Ex: Imóvel disponível para locação. Consulte condições e agende uma visita.",
      theme: {
        badge: "#315b76",
        price: "#bfe2f3",
        overlay: "linear-gradient(180deg,rgba(3,18,28,.06) 0%,rgba(6,34,50,.48) 52%,rgba(4,22,34,.92) 100%)",
        ctaBg: "rgba(49,91,118,.28)",
        ctaBorder: "rgba(191,226,243,.24)"
      }
    },
    terreno: {
      label: "Terreno",
      badge: "TERRENO À VENDA",
      footer: "Terrenos, áreas e oportunidades",
      cta: "Solicite mais informações",
      titlePlaceholder: "Ex: Terreno com excelente topografia",
      descriptionPlaceholder: "Ex: Terreno bem localizado, com ótimo potencial e fácil acesso.",
      theme: {
        badge: "#775a32",
        price: "#ead4a9",
        overlay: "linear-gradient(180deg,rgba(25,15,6,.04) 0%,rgba(61,41,20,.46) 53%,rgba(30,19,8,.90) 100%)",
        ctaBg: "rgba(119,90,50,.26)",
        ctaBorder: "rgba(234,212,169,.22)"
      }
    },
    sitio: {
      label: "Sítio",
      badge: "SÍTIO À VENDA",
      footer: "Sítios, chácaras, terrenos e áreas",
      cta: "Agende uma visita",
      titlePlaceholder: "Ex: Sítio com casa sede e área verde",
      descriptionPlaceholder: "Ex: Natureza, tranquilidade e excelente acesso em uma propriedade completa.",
      theme: {
        badge: "#4f6332",
        price: "#dce8a8",
        overlay: "linear-gradient(180deg,rgba(9,20,8,.04) 0%,rgba(31,58,28,.46) 52%,rgba(17,34,15,.92) 100%)",
        ctaBg: "rgba(79,99,50,.30)",
        ctaBorder: "rgba(220,232,168,.22)"
      }
    },
    comercial: {
      label: "Comercial",
      badge: "IMÓVEL COMERCIAL",
      footer: "Salas, galpões e imóveis comerciais",
      cta: "Fale com nossa equipe",
      titlePlaceholder: "Ex: Galpão comercial pronto para uso",
      descriptionPlaceholder: "Ex: Excelente opção para sua empresa, com localização estratégica e fácil acesso.",
      theme: {
        badge: "#4b4f58",
        price: "#e4e8ee",
        overlay: "linear-gradient(180deg,rgba(9,10,12,.05) 0%,rgba(35,38,44,.48) 52%,rgba(17,18,22,.94) 100%)",
        ctaBg: "rgba(75,79,88,.30)",
        ctaBorder: "rgba(228,232,238,.22)"
      }
    }
  };

  const $ = (id) => document.getElementById(id);

  function invalidate() {
    try {
      if (typeof invalidateStoryCache === "function") invalidateStoryCache();
    } catch {}
  }

  function fire(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function injectStyles() {
    if ($("story-template-styles")) return;
    const style = document.createElement("style");
    style.id = "story-template-styles";
    style.textContent = `
      .story-template-panel{
        margin-top:12px;
        padding:14px;
        border-radius:16px;
        border:1px solid rgba(255,255,255,.08);
        background:rgba(255,255,255,.035);
      }
      .story-template-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
      .story-template-title{font-size:13px;font-weight:900;color:#f8d78c}
      .story-template-subtitle{margin-top:4px;font-size:11px;line-height:1.35;opacity:.66}
      .story-template-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
      .story-template-button{
        min-height:48px;padding:9px 7px;border-radius:13px;
        border:1px solid rgba(255,255,255,.10);
        background:rgba(75,79,42,.42);color:#fff;
        font-size:11px;font-weight:900;cursor:pointer;transition:.15s ease;
      }
      .story-template-button:hover,.story-template-button:focus-visible{
        border-color:rgba(200,139,58,.55);background:rgba(200,139,58,.18);outline:none;
      }
      .story-template-button.is-active{
        border-color:#c88b3a;background:rgba(200,139,58,.30);color:#f8d78c;
        box-shadow:0 0 0 2px rgba(200,139,58,.10) inset;
      }
      .story-template-current{min-width:84px;padding:5px 9px;border-radius:999px;background:rgba(200,139,58,.14);border:1px solid rgba(200,139,58,.25);color:#f8d78c;font-size:11px;font-weight:900;text-align:center}
      @media(max-width:899px){
        .story-template-panel{padding:12px}
        .story-template-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .story-template-button{min-height:50px;font-size:12px}
        .story-template-button:last-child{grid-column:1/-1}
      }
    `;
    document.head.appendChild(style);
  }

  function applyTheme(templateKey, options = {}) {
    const template = TEMPLATES[templateKey] || TEMPLATES.venda;
    const { updateBadge = true } = options;

    const story = $("story-preview-wrapper");
    const badgeInput = $("badge");
    const titleInput = $("title");
    const descriptionInput = $("description");
    const storyBadge = $("story-badge");
    const storyPrice = $("story-price");
    const overlay = story?.querySelector(".story-overlay");
    const cta = story?.querySelector(".story-cta");
    const ctaTitle = story?.querySelector(".story-cta-title");
    const footerLast = story?.querySelector(".story-footer span:last-child");

    if (story) {
      story.dataset.storyTemplate = templateKey;
    }

    if (updateBadge && badgeInput) {
      badgeInput.value = template.badge;
      fire(badgeInput);
    } else if (storyBadge && !storyBadge.textContent.trim()) {
      storyBadge.textContent = template.badge;
    }

    if (titleInput) titleInput.placeholder = template.titlePlaceholder;
    if (descriptionInput) descriptionInput.placeholder = template.descriptionPlaceholder;

    if (storyBadge) {
      storyBadge.style.setProperty("background", template.theme.badge, "important");
    }
    if (storyPrice) {
      storyPrice.style.setProperty("color", template.theme.price, "important");
    }
    if (overlay) {
      overlay.style.setProperty("background", template.theme.overlay, "important");
    }
    if (cta) {
      cta.style.setProperty("background", template.theme.ctaBg, "important");
      cta.style.setProperty("border-color", template.theme.ctaBorder, "important");
    }
    if (ctaTitle) ctaTitle.textContent = template.cta;
    if (footerLast) footerLast.textContent = template.footer;

    document.querySelectorAll(".story-template-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.template === templateKey);
    });

    const current = $("story-template-current");
    if (current) current.textContent = template.label;

    try { localStorage.setItem(STORAGE_KEY, templateKey); } catch {}
    invalidate();
  }

  function buildUi() {
    if ($("story-template-panel")) return;

    const firstSection = document.querySelector(".panel .section");
    if (!firstSection) return;

    const panel = document.createElement("div");
    panel.id = "story-template-panel";
    panel.className = "story-template-panel";
    panel.innerHTML = `
      <div class="story-template-head">
        <div>
          <div class="story-template-title">Modelo do Story</div>
          <div class="story-template-subtitle">Escolha um estilo pronto sem apagar os dados do imóvel.</div>
        </div>
        <div id="story-template-current" class="story-template-current">Venda</div>
      </div>
      <div class="story-template-grid">
        ${Object.entries(TEMPLATES).map(([key, item]) => `
          <button type="button" class="story-template-button" data-template="${key}">${item.label}</button>
        `).join("")}
      </div>
    `;

    firstSection.parentElement.insertBefore(panel, firstSection);

    panel.addEventListener("click", (event) => {
      const button = event.target.closest("[data-template]");
      if (!button) return;
      applyTheme(button.dataset.template, { updateBadge: true });
    });
  }

  function observeStoryChanges() {
    const story = $("story-preview-wrapper");
    if (!story) return;

    // Os módulos de pacote de Stories trocam textos. Reaplicamos apenas a aparência.
    const observer = new MutationObserver(() => {
      let saved = "venda";
      try { saved = localStorage.getItem(STORAGE_KEY) || "venda"; } catch {}
      const template = TEMPLATES[saved] || TEMPLATES.venda;
      const storyBadge = $("story-badge");
      const storyPrice = $("story-price");
      const overlay = story.querySelector(".story-overlay");
      const cta = story.querySelector(".story-cta");
      if (storyBadge) storyBadge.style.setProperty("background", template.theme.badge, "important");
      if (storyPrice) storyPrice.style.setProperty("color", template.theme.price, "important");
      if (overlay) overlay.style.setProperty("background", template.theme.overlay, "important");
      if (cta) {
        cta.style.setProperty("background", template.theme.ctaBg, "important");
        cta.style.setProperty("border-color", template.theme.ctaBorder, "important");
      }
    });

    observer.observe(story, { childList: true, subtree: true, characterData: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    buildUi();

    let saved = "venda";
    try { saved = localStorage.getItem(STORAGE_KEY) || "venda"; } catch {}
    if (!TEMPLATES[saved]) saved = "venda";

    // Na primeira carga não sobrescreve um selo que já possa ter vindo salvo/autopreenchido.
    applyTheme(saved, { updateBadge: false });
    observeStoryChanges();
  });
})();