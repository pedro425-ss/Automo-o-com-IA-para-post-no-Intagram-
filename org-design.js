(() => {
  const $ = (id) => document.getElementById(id);
  const TOKEN_KEY = "story-imoveis-auth-token-v1";
  const LOCAL_KEY = "story-org-design-local-v1";

  const DEFAULT_PROFILE = {
    brandName: "",
    contact: "",
    market: "urbano",
    positioning: "tradicional",
    primaryColor: "#4f7f43",
    secondaryColor: "#d8a23b",
    fontStyle: "classico",
    badgeStyle: "rounded",
    buttonStyle: "rounded",
    logoPosition: "top-left",
    logoSize: 150,
    contentY: 0,
    ctaText: "Fale conosco",
    footerText: "",
    showQr: true,
    showFooter: true,
    logoData: ""
  };

  const FONT_MAP = {
    classico: 'Georgia, "Times New Roman", serif',
    moderno: 'Arial, Helvetica, sans-serif',
    elegante: '"Trebuchet MS", Arial, sans-serif',
    forte: 'Impact, "Arial Black", sans-serif'
  };

  function readLocal(){
    try { return { ...DEFAULT_PROFILE, ...(JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}") || {}) }; }
    catch { return { ...DEFAULT_PROFILE }; }
  }

  function writeLocal(profile){
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(profile)); } catch {}
  }

  function token(){
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
  }

  async function api(path, options={}){
    const headers = new Headers(options.headers || {});
    const t = token();
    if (t) headers.set("Authorization", "Bearer " + t);
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...options, headers, cache:"no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.erro || "Não foi possível concluir.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function setValue(id, value, eventName="input"){
    const el = $(id);
    if (!el || value === undefined || value === null) return;
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = String(value);
    el.dispatchEvent(new Event(eventName, { bubbles:true }));
    if (eventName !== "change") el.dispatchEvent(new Event("change", { bubbles:true }));
  }

  function logoFromPreview(){
    const src = $("story-logo-preview")?.getAttribute("src") || "";
    return /^data:image\//i.test(src) ? src : "";
  }

  function injectStyles(){
    if ($("org-design-style")) return;
    const style = document.createElement("style");
    style.id = "org-design-style";
    style.textContent = `
      .org-design-box{margin-top:14px;padding:14px;border:1px solid rgba(255,255,255,.10);border-radius:15px;background:rgba(255,255,255,.035)}
      .org-design-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}
      .org-design-title{font-size:13px;font-weight:950}
      .org-design-subtitle{margin-top:3px;font-size:9px;line-height:1.4;opacity:.65}
      .org-design-badge{flex:0 0 auto;padding:5px 8px;border-radius:999px;background:rgba(216,162,59,.14);border:1px solid rgba(216,162,59,.25);color:#f0cd84;font-size:8px;font-weight:900}
      .org-design-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .org-design-field{min-width:0}
      .org-design-field.full{grid-column:1/-1}
      .org-design-field label{display:block;margin-bottom:5px;font-size:9px;font-weight:900;opacity:.84}
      .org-design-input,.org-design-select{width:100%;min-height:39px;padding:7px 9px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:#161d20;color:#fff;font-size:11px}
      .org-design-color{width:100%;height:39px;padding:3px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:#161d20}
      .org-design-checks{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px}
      .org-design-check{display:flex;align-items:center;gap:6px;font-size:9px;opacity:.85}
      .org-design-actions{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:12px}
      .org-design-save,.org-design-reset{min-height:42px;border-radius:11px;border:1px solid rgba(255,255,255,.11);font-size:10px;font-weight:900;cursor:pointer}
      .org-design-save{background:linear-gradient(135deg,#b77c21,#dda847);color:#17120b}
      .org-design-reset{padding:0 13px;background:rgba(255,255,255,.06);color:#fff}
      .org-design-status{margin-top:8px;font-size:9px;opacity:.65}
      html[data-org-design="1"] #story-preview-wrapper{font-family:var(--org-font)!important}
      html[data-org-design="1"] .story-badge{background:var(--org-primary)!important}
      html[data-org-design="1"] .story-price{color:var(--org-secondary)!important}
      html[data-org-design="1"] .story-cta{border-color:var(--org-secondary)!important}
      html[data-org-design="1"][data-org-badge="square"] .story-badge{border-radius:8px!important}
      html[data-org-design="1"][data-org-badge="premium"] .story-badge{border-radius:4px!important;letter-spacing:.10em!important;border:1px solid rgba(255,255,255,.42)!important;background:rgba(10,10,10,.58)!important}
      html[data-org-design="1"][data-org-button="square"] .story-cta{border-radius:10px!important}
      html[data-org-design="1"][data-org-button="minimal"] .story-cta{border-radius:0!important;background:transparent!important;border-width:0 0 0 5px!important;padding-left:22px!important;backdrop-filter:none!important}
      @media(max-width:899px){
        .org-design-box{padding:10px;margin-top:9px}
        .org-design-grid{grid-template-columns:1fr}
        .org-design-field.full{grid-column:auto}
        .org-design-actions{grid-template-columns:1fr}
        .org-design-reset{min-height:42px}
      }
    `;
    document.head.appendChild(style);
  }

  function buildUi(){
    if ($("org-design-box")) return true;
    const host = $("story-advanced-section");
    if (!host) return false;

    const box = document.createElement("div");
    box.id = "org-design-box";
    box.className = "org-design-box";
    box.innerHTML = `
      <div class="org-design-head">
        <div>
          <div class="org-design-title">Perfil visual da imobiliária</div>
          <div class="org-design-subtitle">Salve uma identidade própria para esta imobiliária e reutilize em todas as artes.</div>
        </div>
        <div class="org-design-badge">Exclusivo</div>
      </div>

      <div class="org-design-grid">
        <div class="org-design-field"><label for="org-brand-name">Nome da marca</label><input id="org-brand-name" class="org-design-input" placeholder="Nome da imobiliária"></div>
        <div class="org-design-field"><label for="org-contact">Contato padrão</label><input id="org-contact" class="org-design-input" placeholder="@instagram ou WhatsApp"></div>

        <div class="org-design-field"><label for="org-primary">Cor principal</label><input id="org-primary" class="org-design-color" type="color"></div>
        <div class="org-design-field"><label for="org-secondary">Cor de destaque</label><input id="org-secondary" class="org-design-color" type="color"></div>

        <div class="org-design-field"><label for="org-market">Segmento</label><select id="org-market" class="org-design-select"><option value="urbano">Urbana</option><option value="rural">Rural</option><option value="misto">Mista</option></select></div>
        <div class="org-design-field"><label for="org-positioning">Posicionamento</label><select id="org-positioning" class="org-design-select"><option value="tradicional">Tradicional</option><option value="alto">Alto padrão</option><option value="popular">Popular</option></select></div>

        <div class="org-design-field"><label for="org-font">Tipografia</label><select id="org-font" class="org-design-select"><option value="classico">Clássica</option><option value="moderno">Moderna</option><option value="elegante">Elegante</option><option value="forte">Forte</option></select></div>
        <div class="org-design-field"><label for="org-badge-style">Estilo do selo</label><select id="org-badge-style" class="org-design-select"><option value="rounded">Arredondado</option><option value="square">Reto</option><option value="premium">Premium</option></select></div>

        <div class="org-design-field"><label for="org-button-style">Estilo do CTA</label><select id="org-button-style" class="org-design-select"><option value="rounded">Arredondado</option><option value="square">Reto</option><option value="minimal">Minimalista</option></select></div>
        <div class="org-design-field"><label for="org-cta">Texto do CTA</label><input id="org-cta" class="org-design-input" maxlength="80" placeholder="Fale conosco"></div>

        <div class="org-design-field full"><label for="org-footer-text">Rodapé padrão</label><input id="org-footer-text" class="org-design-input" maxlength="180" placeholder="Ex: Casas • Apartamentos • Terrenos"></div>
      </div>

      <div class="org-design-checks">
        <label class="org-design-check"><input id="org-show-qr" type="checkbox"> Mostrar QR Code</label>
        <label class="org-design-check"><input id="org-show-footer" type="checkbox"> Mostrar rodapé</label>
      </div>

      <div class="org-design-actions">
        <button id="org-design-save" class="org-design-save" type="button">Salvar perfil visual</button>
        <button id="org-design-reset" class="org-design-reset" type="button">Usar padrão</button>
      </div>
      <div id="org-design-status" class="org-design-status">Carregando perfil...</div>
    `;
    host.appendChild(box);

    ["org-brand-name","org-contact","org-primary","org-secondary","org-market","org-positioning","org-font","org-badge-style","org-button-style","org-cta","org-footer-text","org-show-qr","org-show-footer"].forEach((id)=>{
      $(id)?.addEventListener("input", ()=>applyProfile(collectProfile(), { syncControls:true }));
      $(id)?.addEventListener("change", ()=>applyProfile(collectProfile(), { syncControls:true }));
    });
    $("org-design-save")?.addEventListener("click", saveProfile);
    $("org-design-reset")?.addEventListener("click", ()=>{
      populateUi(DEFAULT_PROFILE);
      applyProfile(DEFAULT_PROFILE, { syncControls:true });
      setStatus("Perfil padrão aplicado. Clique em salvar para confirmar.");
    });
    return true;
  }

  function collectProfile(){
    return {
      ...DEFAULT_PROFILE,
      brandName: $("org-brand-name")?.value?.trim() || "",
      contact: $("org-contact")?.value?.trim() || "",
      primaryColor: $("org-primary")?.value || DEFAULT_PROFILE.primaryColor,
      secondaryColor: $("org-secondary")?.value || DEFAULT_PROFILE.secondaryColor,
      market: $("org-market")?.value || "urbano",
      positioning: $("org-positioning")?.value || "tradicional",
      fontStyle: $("org-font")?.value || "classico",
      badgeStyle: $("org-badge-style")?.value || "rounded",
      buttonStyle: $("org-button-style")?.value || "rounded",
      ctaText: $("org-cta")?.value?.trim() || "Fale conosco",
      footerText: $("org-footer-text")?.value?.trim() || "",
      showQr: Boolean($("org-show-qr")?.checked),
      showFooter: Boolean($("org-show-footer")?.checked),
      logoPosition: $("logo-position")?.value || "top-left",
      logoSize: Number($("logo-size")?.value || 150),
      contentY: Number($("content-y")?.value || 0),
      logoData: logoFromPreview()
    };
  }

  function populateUi(profile){
    const p = { ...DEFAULT_PROFILE, ...(profile || {}) };
    if ($("org-brand-name")) $("org-brand-name").value = p.brandName || "";
    if ($("org-contact")) $("org-contact").value = p.contact || "";
    if ($("org-primary")) $("org-primary").value = p.primaryColor || DEFAULT_PROFILE.primaryColor;
    if ($("org-secondary")) $("org-secondary").value = p.secondaryColor || DEFAULT_PROFILE.secondaryColor;
    if ($("org-market")) $("org-market").value = p.market || "urbano";
    if ($("org-positioning")) $("org-positioning").value = p.positioning || "tradicional";
    if ($("org-font")) $("org-font").value = p.fontStyle || "classico";
    if ($("org-badge-style")) $("org-badge-style").value = p.badgeStyle || "rounded";
    if ($("org-button-style")) $("org-button-style").value = p.buttonStyle || "rounded";
    if ($("org-cta")) $("org-cta").value = p.ctaText || "Fale conosco";
    if ($("org-footer-text")) $("org-footer-text").value = p.footerText || "";
    if ($("org-show-qr")) $("org-show-qr").checked = p.showQr !== false;
    if ($("org-show-footer")) $("org-show-footer").checked = p.showFooter !== false;
  }

  function applyProfile(profile, { syncControls=true } = {}){
    const p = { ...DEFAULT_PROFILE, ...(profile || {}) };
    const root = document.documentElement;
    root.dataset.orgDesign = "1";
    root.dataset.orgBadge = p.badgeStyle;
    root.dataset.orgButton = p.buttonStyle;
    root.style.setProperty("--org-primary", p.primaryColor);
    root.style.setProperty("--org-secondary", p.secondaryColor);
    root.style.setProperty("--org-font", FONT_MAP[p.fontStyle] || FONT_MAP.classico);

    if (syncControls) {
      setValue("realty-market", p.market, "change");
      setValue("realty-position", p.positioning, "change");
      try { window.applyRealtyProfile?.({ updateBadge:false }); } catch {}

      if (p.brandName) setValue("brand-name", p.brandName);
      if (p.contact) setValue("contact", p.contact);
      setValue("logo-position", p.logoPosition, "change");
      setValue("logo-size", p.logoSize);
      setValue("content-y", p.contentY);
      setValue("show-qr", p.showQr, "change");
    }

    const ctaTitle = document.querySelector("#story-preview-wrapper .story-cta-title");
    if (ctaTitle) ctaTitle.textContent = p.ctaText || "Fale conosco";

    const footer = document.querySelector("#story-preview-wrapper .story-footer");
    if (footer) {
      footer.style.setProperty("display", p.showFooter === false ? "none" : "flex", "important");
      const footerText = footer.querySelector("span:last-child");
      if (footerText && p.footerText) footerText.textContent = p.footerText;
    }

    if (p.logoData) {
      const logo = $("story-logo-preview");
      const wrapper = $("story-logo-wrapper");
      if (logo && wrapper && logo.getAttribute("src") !== p.logoData) {
        logo.src = p.logoData;
        logo.classList.remove("hidden");
        wrapper.classList.remove("hidden");
      }
    }

    try { window.invalidateStoryCache?.(); } catch {}
  }

  function setStatus(text){
    const el = $("org-design-status");
    if (el) el.textContent = text;
  }

  async function loadProfile(){
    const local = readLocal();
    populateUi(local);
    applyProfile(local, { syncControls:true });

    if (!token()) {
      setStatus("Modo de teste local • o perfil será vinculado à imobiliária quando o login estiver ativo.");
      return;
    }

    try {
      const data = await api("/api/account/design-profile");
      if (data.profile) {
        populateUi(data.profile);
        applyProfile(data.profile, { syncControls:true });
        writeLocal(data.profile);
        setStatus("Perfil da imobiliária carregado da nuvem.");
      } else {
        setStatus("Ainda não há perfil salvo para esta imobiliária.");
      }
    } catch (error) {
      setStatus(error.status === 400 ? "Conta administrativa: use um cliente para testar o perfil visual." : "Usando perfil local neste dispositivo.");
    }
  }

  async function saveProfile(){
    const button = $("org-design-save");
    const profile = collectProfile();
    writeLocal(profile);
    applyProfile(profile, { syncControls:true });

    if (button) {
      button.disabled = true;
      button.textContent = "Salvando...";
    }

    try {
      if (!token()) {
        setStatus("Perfil salvo localmente ✓ Quando o cliente entrar, poderá salvar na própria conta.");
        return;
      }
      const data = await api("/api/account/design-profile", { method:"PUT", body:JSON.stringify(profile) });
      if (data.profile) {
        populateUi(data.profile);
        applyProfile(data.profile, { syncControls:true });
        writeLocal(data.profile);
      }
      setStatus("Perfil visual salvo para esta imobiliária ✓");
    } catch (error) {
      setStatus(error.message + " O perfil local foi mantido.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Salvar perfil visual";
      }
    }
  }

  function start(){
    injectStyles();
    let tries = 0;
    const timer = setInterval(()=>{
      tries++;
      if (buildUi()) {
        clearInterval(timer);
        setTimeout(loadProfile, 80);
      } else if (tries > 100) {
        clearInterval(timer);
      }
    }, 60);
  }

  document.addEventListener("DOMContentLoaded", start);
  window.applyOrganizationDesignProfile = applyProfile;
})();
