(() => {
  const MARKET_KEY = "story-realty-market-v1";
  const POSITION_KEY = "story-realty-position-v1";

  const MARKETS = {
    urbano: {
      label: "Urbana",
      description: "Casas, apartamentos, terrenos, galpões e áreas industriais.",
      footer: "Imóveis urbanos • Residencial • Comercial • Industrial",
      labels: {
        venda: "Residencial",
        locacao: "Locação",
        terreno: "Terreno Urbano",
        sitio: "Área Industrial",
        comercial: "Galpão"
      },
      badges: {
        venda: "IMÓVEL À VENDA",
        locacao: "IMÓVEL PARA LOCAÇÃO",
        terreno: "TERRENO URBANO",
        sitio: "ÁREA INDUSTRIAL",
        comercial: "GALPÃO INDUSTRIAL / COMERCIAL"
      }
    },
    rural: {
      label: "Rural",
      description: "Chácaras, sítios, fazendas, campo e aluguel por temporada.",
      footer: "Chácaras • Sítios • Fazendas • Temporada",
      labels: {
        venda: "Chácara",
        locacao: "Temporada",
        terreno: "Sítio",
        sitio: "Fazenda / Área Rural",
        comercial: "Espaço Rural"
      },
      badges: {
        venda: "CHÁCARA À VENDA",
        locacao: "ALUGUEL POR TEMPORADA",
        terreno: "SÍTIO À VENDA",
        sitio: "FAZENDA / ÁREA RURAL",
        comercial: "ESPAÇO RURAL"
      }
    },
    misto: {
      label: "Mista",
      description: "Imóveis urbanos e rurais no mesmo portfólio.",
      footer: "Urbano • Rural • Comercial • Temporada",
      labels: {
        venda: "Residencial / Chácara",
        locacao: "Locação / Temporada",
        terreno: "Terreno / Sítio",
        sitio: "Área Rural / Industrial",
        comercial: "Comercial / Galpão"
      },
      badges: {
        venda: "IMÓVEL À VENDA",
        locacao: "IMÓVEL PARA LOCAÇÃO",
        terreno: "TERRENO / SÍTIO",
        sitio: "ÁREA ESPECIAL",
        comercial: "IMÓVEL COMERCIAL"
      }
    }
  };

  const POSITIONS = {
    tradicional: {
      label: "Tradicional",
      description: "Equilíbrio entre imagem, informações e contato."
    },
    alto: {
      label: "Alto padrão",
      description: "Mais limpo, sofisticado e com foco em exclusividade."
    },
    popular: {
      label: "Popular / econômico",
      description: "Preço, oportunidade e chamada para contato em destaque."
    }
  };

  const $ = (id) => document.getElementById(id);

  function read(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }

  function currentTemplate() {
    return $("story-preview-wrapper")?.dataset?.storyTemplate || read("assessoria-story-template-v1", "venda");
  }

  function fire(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function injectStyles() {
    if ($("realty-profile-styles")) return;
    const style = document.createElement("style");
    style.id = "realty-profile-styles";
    style.textContent = `
      .realty-profile-panel{margin-top:10px}
      .realty-profile-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}
      .realty-profile-title{font-size:13px;font-weight:950;letter-spacing:-.02em}
      .realty-profile-subtitle{margin-top:3px;font-size:9px;line-height:1.35;opacity:.62}
      .realty-profile-badge{flex:0 0 auto;padding:5px 8px;border-radius:999px;background:rgba(216,162,59,.13);border:1px solid rgba(216,162,59,.22);color:#e8c77f;font-size:8px;font-weight:900}
      .realty-profile-group{margin-top:10px}
      .realty-profile-label{display:block;margin-bottom:7px;font-size:9px;font-weight:950;color:#e8c77f;text-transform:uppercase;letter-spacing:.07em}
      .realty-profile-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
      .realty-profile-card{
        min-height:78px;padding:9px;border-radius:12px;border:1px solid rgba(255,255,255,.08);
        background:rgba(255,255,255,.025);color:#fff;text-align:left;cursor:pointer;transition:.16s ease
      }
      .realty-profile-card:hover{border-color:rgba(216,162,59,.28);transform:translateY(-1px)}
      .realty-profile-card.is-active{
        background:linear-gradient(180deg,rgba(216,162,59,.16),rgba(216,162,59,.07));
        border-color:rgba(216,162,59,.55);box-shadow:0 0 0 2px rgba(216,162,59,.06)
      }
      .realty-profile-card-icon{display:block;font-size:16px;line-height:1;margin-bottom:7px}
      .realty-profile-card strong{display:block;font-size:10px;font-weight:950}
      .realty-profile-card span:last-child{display:block;margin-top:3px;font-size:8px;line-height:1.3;opacity:.65}
      .realty-profile-select{display:none!important}
      .realty-profile-summary{
        margin-top:9px;padding:7px 9px;border-radius:9px;background:rgba(255,255,255,.04);
        font-size:9px;line-height:1.35;opacity:.72
      }

      html[data-realty-market="rural"] .instagram-story{
        --realty-radius:38px;
      }
      html[data-realty-market="rural"] .story-overlay{
        background:linear-gradient(180deg,rgba(15,25,10,.02) 0%,rgba(37,55,24,.30) 58%,rgba(15,25,10,.82) 100%)!important;
      }
      html[data-realty-market="rural"] .story-badge{
        border-radius:999px!important;
      }
      html[data-realty-market="rural"] .story-cta{
        border-radius:30px!important;
      }

      html[data-realty-market="misto"] .story-overlay{
        background:linear-gradient(180deg,rgba(0,0,0,.02) 0%,rgba(26,34,22,.26) 57%,rgba(8,12,8,.82) 100%)!important;
      }

      html[data-realty-position="alto"] .story-content{
        padding-left:82px!important;padding-right:82px!important;
      }
      html[data-realty-position="alto"] .story-title{
        max-width:860px!important;font-weight:650!important;letter-spacing:-.025em!important;
        line-height:1.02!important;
      }
      html[data-realty-position="alto"] .story-price{
        font-weight:650!important;letter-spacing:.01em!important;
      }
      html[data-realty-position="alto"] .story-badge{
        padding:13px 24px!important;font-size:23px!important;letter-spacing:.08em!important;
        background:rgba(20,20,18,.70)!important;border:1px solid rgba(255,255,255,.28)!important;
        backdrop-filter:blur(10px)
      }
      html[data-realty-position="alto"] .story-description{
        max-width:820px!important;opacity:.88!important;
      }
      html[data-realty-position="alto"] .story-cta{
        background:rgba(15,15,14,.40)!important;border:1px solid rgba(255,255,255,.22)!important;
        backdrop-filter:blur(12px)
      }

      html[data-realty-position="popular"] .story-price{
        font-size:76px!important;font-weight:950!important;line-height:.98!important;
      }
      html[data-realty-position="popular"] .story-badge{
        font-weight:950!important;box-shadow:0 8px 24px rgba(0,0,0,.28)!important;
      }
      html[data-realty-position="popular"] .story-cta{
        transform:scale(1.025);transform-origin:left bottom;
        border-width:2px!important;
      }
      html[data-realty-position="popular"] .story-cta-title{
        font-weight:950!important;
      }

      html[data-realty-market="rural"][data-realty-position="alto"] .story-overlay{
        background:linear-gradient(180deg,rgba(20,24,13,.01) 0%,rgba(31,43,22,.22) 60%,rgba(14,20,11,.77) 100%)!important;
      }

      @media(max-width:899px){
        .realty-profile-panel{margin-top:7px}
        .realty-profile-card-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
        .realty-profile-card{min-height:72px;padding:8px}
        .realty-profile-card-icon{font-size:15px;margin-bottom:6px}
        .realty-profile-card strong{font-size:9px}
        .realty-profile-card span:last-child{font-size:7.5px}
        .realty-profile-summary{padding:6px 7px;font-size:8px}
      }
    `;
    document.head.appendChild(style);
  }

  function buildUi() {
    if ($("realty-profile-panel")) return;
    const templatePanel = $("story-template-panel");
    const editorPanel = document.querySelector(".panel");
    if (!editorPanel) return;

    const profilePanel = document.createElement("div");
    profilePanel.id = "realty-profile-panel";
    profilePanel.className = "section realty-profile-panel";
    profilePanel.innerHTML = `
      <div class="realty-profile-head">
        <div>
          <div class="realty-profile-title">Perfil da imobiliária</div>
          <div class="realty-profile-subtitle">Defina o mercado e o posicionamento. O Story se adapta automaticamente.</div>
        </div>
        <div class="realty-profile-badge">Visual inteligente</div>
      </div>

      <div class="realty-profile-group">
        <span class="realty-profile-label">Tipo da imobiliária</span>
        <div class="realty-profile-card-grid">
          <button type="button" class="realty-profile-card" data-market="urbano">
            <span class="realty-profile-card-icon">▥</span>
            <strong>Urbana</strong>
            <span>Casas, apartamentos, terrenos e galpões.</span>
          </button>
          <button type="button" class="realty-profile-card" data-market="rural">
            <span class="realty-profile-card-icon">♣</span>
            <strong>Rural</strong>
            <span>Chácaras, sítios, fazendas e temporada.</span>
          </button>
          <button type="button" class="realty-profile-card" data-market="misto">
            <span class="realty-profile-card-icon">◫</span>
            <strong>Mista</strong>
            <span>Portfólio urbano e rural no mesmo perfil.</span>
          </button>
        </div>
      </div>

      <div class="realty-profile-group">
        <span class="realty-profile-label">Posicionamento</span>
        <div class="realty-profile-card-grid">
          <button type="button" class="realty-profile-card" data-position="tradicional">
            <span class="realty-profile-card-icon">◆</span>
            <strong>Tradicional</strong>
            <span>Visual equilibrado e profissional.</span>
          </button>
          <button type="button" class="realty-profile-card" data-position="alto">
            <span class="realty-profile-card-icon">◇</span>
            <strong>Alto padrão</strong>
            <span>Mais sofisticado, limpo e exclusivo.</span>
          </button>
          <button type="button" class="realty-profile-card" data-position="popular">
            <span class="realty-profile-card-icon">⌁</span>
            <strong>Popular</strong>
            <span>Preço e oportunidade em destaque.</span>
          </button>
        </div>
      </div>

      <select id="realty-market" class="realty-profile-select" aria-hidden="true">
        <option value="urbano">Urbana</option>
        <option value="rural">Rural</option>
        <option value="misto">Mista</option>
      </select>
      <select id="realty-position" class="realty-profile-select" aria-hidden="true">
        <option value="tradicional">Tradicional</option>
        <option value="alto">Alto padrão</option>
        <option value="popular">Popular / econômico</option>
      </select>
      <div id="realty-profile-summary" class="realty-profile-summary"></div>
    `;

    const urlSection = [...editorPanel.querySelectorAll(".section")].find((section) => section.querySelector("#imovel-url"));
    if (!urlSection) return;
    urlSection.insertAdjacentElement("afterend", profilePanel);

    $("realty-market").value = read(MARKET_KEY, "urbano");
    $("realty-position").value = read(POSITION_KEY, "tradicional");

    profilePanel.addEventListener("click", (event) => {
      const marketCard = event.target.closest("[data-market]");
      if (marketCard) {
        $("realty-market").value = marketCard.dataset.market;
        write(MARKET_KEY, marketCard.dataset.market);
        applyProfile({ updateBadge: true });
        return;
      }

      const positionCard = event.target.closest("[data-position]");
      if (positionCard) {
        $("realty-position").value = positionCard.dataset.position;
        write(POSITION_KEY, positionCard.dataset.position);
        applyProfile({ updateBadge: false });
      }
    });
  }

  function updateProfileCards(marketKey, positionKey) {
    document.querySelectorAll("[data-market]").forEach((card) => {
      card.classList.toggle("is-active", card.dataset.market === marketKey);
    });
    document.querySelectorAll("[data-position]").forEach((card) => {
      card.classList.toggle("is-active", card.dataset.position === positionKey);
    });
  }

  function updateTemplateLabels(marketKey) {
    const market = MARKETS[marketKey] || MARKETS.urbano;
    document.querySelectorAll(".story-template-button[data-template]").forEach((button) => {
      const key = button.dataset.template;
      if (market.labels[key]) button.textContent = market.labels[key];
    });
    const current = $("story-template-current");
    const key = currentTemplate();
    if (current && market.labels[key]) current.textContent = market.labels[key];
  }

  function updateCopy(marketKey, positionKey, updateBadge) {
    const market = MARKETS[marketKey] || MARKETS.urbano;
    const position = POSITIONS[positionKey] || POSITIONS.tradicional;
    const templateKey = currentTemplate();

    const title = $("title");
    const description = $("description");
    const badge = $("badge");
    const footer = $("story-preview-wrapper")?.querySelector(".story-footer span:last-child");

    if (marketKey === "rural") {
      if (title) title.placeholder = positionKey === "alto"
        ? "Ex: Fazenda exclusiva com paisagem privilegiada"
        : "Ex: Chácara com lazer completo e muito verde";
      if (description) description.placeholder = positionKey === "alto"
        ? "Ex: Propriedade exclusiva, natureza preservada, privacidade e estrutura completa."
        : "Ex: Área ampla, natureza, lazer, acesso fácil e estrutura para família.";
    } else if (marketKey === "misto") {
      if (title) title.placeholder = "Ex: Imóvel especial em excelente localização";
      if (description) description.placeholder = "Ex: Destaque os principais diferenciais, acesso, estrutura e oportunidade.";
    } else {
      if (title) title.placeholder = positionKey === "alto"
        ? "Ex: Residência exclusiva em localização privilegiada"
        : "Ex: Casa moderna em ótima localização";
      if (description) description.placeholder = positionKey === "alto"
        ? "Ex: Arquitetura sofisticada, acabamentos nobres e ambientes amplos."
        : "Ex: Imóvel bem localizado, com boa estrutura e fácil acesso.";
    }

    if (updateBadge && badge && market.badges[templateKey]) {
      badge.value = market.badges[templateKey];
      fire(badge);
    }

    if (footer) footer.textContent = market.footer;

    const summary = $("realty-profile-summary");
    if (summary) summary.textContent = `${market.label} + ${position.label} — ${position.description}`;
  }

  function applyProfile({ updateBadge = false } = {}) {
    const marketKey = $("realty-market")?.value || read(MARKET_KEY, "urbano");
    const positionKey = $("realty-position")?.value || read(POSITION_KEY, "tradicional");

    document.documentElement.dataset.realtyMarket = marketKey;
    document.documentElement.dataset.realtyPosition = positionKey;

    updateProfileCards(marketKey, positionKey);
    updateTemplateLabels(marketKey);
    updateCopy(marketKey, positionKey, updateBadge);

    try { window.reapplyBrandTheme?.(); } catch {}
    try {
      if (typeof invalidateStoryCache === "function") invalidateStoryCache();
    } catch {}
  }

  function bindTemplateChanges() {
    const panel = $("story-template-panel");
    if (!panel) return;
    panel.addEventListener("click", (event) => {
      const button = event.target.closest(".story-template-button[data-template]");
      if (!button) return;
      setTimeout(() => applyProfile({ updateBadge: true }), 0);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();

    const waitForProfileHost = () => {
      const editorPanel = document.querySelector(".panel");
      const urlSection = editorPanel && [...editorPanel.querySelectorAll(".section")].find((section) => section.querySelector("#imovel-url"));
      if (!editorPanel || !urlSection) {
        setTimeout(waitForProfileHost, 40);
        return;
      }

      buildUi();
      if ($("story-template-panel")) bindTemplateChanges();
      applyProfile({ updateBadge: false });

      if (!$("story-template-panel")) {
        const waitForTemplates = () => {
          if (!$("story-template-panel")) {
            setTimeout(waitForTemplates, 80);
            return;
          }
          bindTemplateChanges();
          applyProfile({ updateBadge: false });
        };
        waitForTemplates();
      }
    };

    waitForProfileHost();
  });

  window.applyRealtyProfile = applyProfile;
})();