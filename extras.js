(() => {
  const SETTINGS_KEY = "assessoria-story-settings-v3";
  const LOGO_KEY = "assessoria-story-saved-logo-v1";

  function byId(id) {
    return document.getElementById(id);
  }

  function readSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveSettings(partial) {
    try {
      const next = { ...readSettings(), ...partial };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn("Não foi possível salvar as preferências:", error);
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw}`;
    return raw;
  }

  function getDisplayUrl(value) {
    try {
      const url = new URL(normalizeUrl(value));
      const text = `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`;
      return text.length > 42 ? `${text.slice(0, 39)}...` : text;
    } catch {
      const text = String(value || "").replace(/^https?:\/\//i, "").trim();
      return text.length > 42 ? `${text.slice(0, 39)}...` : text;
    }
  }

  function injectStyles() {
    if (byId("story-extras-style")) return;
    const style = document.createElement("style");
    style.id = "story-extras-style";
    style.textContent = `
      .story-extra-grid{display:grid;grid-template-columns:1fr;gap:12px}
      .story-extra-control{padding:14px;border-radius:16px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08)}
      .story-extra-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
      .story-extra-title{font-size:13px;font-weight:800;color:#f8d78c}
      .story-extra-value{min-width:64px;padding:5px 9px;border-radius:999px;background:rgba(200,139,58,.16);border:1px solid rgba(200,139,58,.30);color:#f8d78c;font-size:12px;font-weight:900;text-align:center}
      .story-extra-range{width:100%;accent-color:#c88b3a}
      .story-extra-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      .story-extra-btn{min-height:44px;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:9px 10px;background:rgba(255,255,255,.06);color:white;font-size:12px;font-weight:800;cursor:pointer}
      .story-extra-btn:active{background:rgba(200,139,58,.22)}

      .story-qr-card{display:none;align-items:center;justify-content:space-between;gap:24px;width:100%;margin:0 0 24px;padding:20px 22px;border-radius:30px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);cursor:pointer;transition:transform .15s ease,background .15s ease,border-color .15s ease}
      .story-qr-card:hover{transform:translateY(-2px);background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.26)}
      .story-qr-card:focus-visible{outline:3px solid rgba(255,255,255,.72);outline-offset:4px}
      .story-qr-card.is-visible{display:flex}
      .story-qr-copy{flex:1;min-width:0}
      .story-qr-title{font-size:32px;font-weight:900;line-height:1.15;margin-bottom:6px}
      .story-qr-link{font-size:25px;line-height:1.25;opacity:.92;overflow-wrap:anywhere;word-break:break-word}
      .story-qr-box{width:150px;height:150px;flex:0 0 150px;padding:9px;border-radius:20px;background:white;box-shadow:0 8px 28px rgba(0,0,0,.24)}
      .story-qr-image{display:block;width:100%;height:100%;object-fit:contain}

      @media (min-width:900px){.story-extra-grid{grid-template-columns:1fr 1fr}}
      @media (max-width:899px){
        .story-extra-control{padding:12px}
        .story-extra-actions{grid-template-columns:1fr}
        .story-extra-btn{min-height:48px;font-size:13px}
      }
    `;
    document.head.appendChild(style);
  }

  function createControlSection() {
    if (byId("story-advanced-section")) return byId("story-advanced-section");

    const urlSection = byId("imovel-url")?.closest(".section");
    const panel = urlSection?.parentElement || document.querySelector(".panel");
    if (!panel) return null;

    const section = document.createElement("div");
    section.id = "story-advanced-section";
    section.className = "section";
    section.innerHTML = `
      <div class="section-title">Layout, logo e mais fotos</div>

      <div class="field">
        <label class="label" for="brand-name">Nome da imobiliária</label>
        <input id="brand-name" class="input" maxlength="80" placeholder="Ex: Villela Imóveis" />
        <div class="hint">Esse nome aparece na postagem e acompanha o perfil da imobiliária.</div>
      </div>

      <div class="field">
        <label class="label" for="more-photos-url">Link para mais fotos</label>
        <input id="more-photos-url" class="input" placeholder="Cole o link do anúncio ou da galeria" />
        <label class="check" style="margin-top:8px"><input id="show-qr" type="checkbox" checked> Mostrar QR Code no Story</label>
        <div id="qr-status" class="hint">O QR Code aparece no Story quando o link é válido.</div>
      </div>

      <div class="story-extra-grid" style="margin-top:12px">
        <div class="story-extra-control">
          <div class="story-extra-head"><label class="story-extra-title" for="content-y">Posição do bloco de texto</label><span id="content-y-value" class="story-extra-value">0 px</span></div>
          <input id="content-y" class="story-extra-range" type="range" min="-220" max="220" step="5" value="0" />
          <div class="hint">Negativo sobe o conteúdo; positivo desce.</div>
        </div>

        <div class="story-extra-control">
          <div class="story-extra-head"><label class="story-extra-title" for="logo-size">Tamanho do logo</label><span id="logo-size-value" class="story-extra-value">150 px</span></div>
          <input id="logo-size" class="story-extra-range" type="range" min="100" max="320" step="5" value="150" />
          <div class="hint">Encaixe automático ativo: o formato do logo é respeitado; use este controle só para o ajuste fino.</div>
        </div>
      </div>

      <div class="field" style="margin-top:12px">
        <label class="label" for="logo-position">Posição do logo</label>
        <select id="logo-position" class="select">
          <option value="top-left">Superior esquerdo</option>
          <option value="top-center">Superior central</option>
          <option value="top-right">Superior direito</option>
        </select>
      </div>

      <div class="story-extra-actions">
        <button id="save-branding-now" class="story-extra-btn" type="button">Salvar configurações</button>
        <button id="remove-saved-logo" class="story-extra-btn" type="button">Remover logo salvo</button>
      </div>
      <div class="hint" style="margin-top:8px">Nome da imobiliária, contato, link, posição do texto e configurações do logo ficam salvos neste navegador.</div>
    `;

    if (urlSection) panel.insertBefore(section, urlSection);
    else panel.appendChild(section);
    return section;
  }

  function createQrCard() {
    let card = byId("story-qr-card");
    if (card) return card;

    const content = document.querySelector("#story-preview-wrapper .story-content");
    const cta = content?.querySelector(".story-cta");
    if (!content || !cta) return null;

    card = document.createElement("div");
    card.id = "story-qr-card";
    card.className = "story-qr-card";
    card.setAttribute("role", "link");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", "Abrir link de mais fotos");
    card.innerHTML = `
      <div class="story-qr-copy">
        <div class="story-qr-title">Veja mais fotos</div>
        <div id="story-qr-link" class="story-qr-link"></div>
        <div class="story-qr-link" style="margin-top:6px;font-size:20px;opacity:.72">Clique aqui ou escaneie o QR Code</div>
      </div>
      <div class="story-qr-box"><img id="story-qr-image" class="story-qr-image" alt="QR Code para mais fotos" /></div>
    `;
    content.insertBefore(card, cta);
    return card;
  }

  let qrLibPromise = null;
  function loadQrLibrary() {
    if (window.QRious) return Promise.resolve(window.QRious);
    if (qrLibPromise) return qrLibPromise;

    qrLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js";
      script.async = true;
      script.onload = () => window.QRious ? resolve(window.QRious) : reject(new Error("QRious não carregou"));
      script.onerror = () => reject(new Error("Falha ao carregar biblioteca de QR Code"));
      document.head.appendChild(script);
      setTimeout(() => reject(new Error("Tempo esgotado ao carregar QR Code")), 8000);
    });
    return qrLibPromise;
  }

  function applyBrandName() {
    const input = byId("brand-name");
    const footer = byId("story-brand-name");
    const value = String(input?.value || "").trim();
    if (footer) footer.textContent = value || "Sua Imobiliária";
    saveSettings({ brandName: value });
    try { if (typeof window.invalidateStoryCache === "function") window.invalidateStoryCache(); } catch {}
  }

  function applyContentPosition() {
    const input = byId("content-y");
    const value = clamp(Number(input?.value || 0), -220, 220);
    const content = document.querySelector("#story-preview-wrapper .story-content");
    if (content) content.style.setProperty("transform", `translateY(${value}px)`, "important");
    const label = byId("content-y-value");
    if (label) label.textContent = `${value} px`;
    saveSettings({ contentY: value });
  }

  function inspectLogoContent(img) {
    if (!img?.naturalWidth || !img?.naturalHeight) {
      return { aspect: 1, occupancy: 1 };
    }

    const aspect = img.naturalWidth / img.naturalHeight;
    let occupancy = 1;

    try {
      const maxSide = 140;
      const scale = Math.min(maxSide / img.naturalWidth, maxSide / img.naturalHeight, 1);
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return { aspect, occupancy };

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height).data;

      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const i = (y * width + x) * 4;
          if (pixels[i + 3] < 36) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }

      if (maxX >= minX && maxY >= minY) {
        const contentW = Math.max(1, maxX - minX + 1);
        const contentH = Math.max(1, maxY - minY + 1);
        occupancy = Math.max(contentW / width, contentH / height);
      }
    } catch (error) {
      console.warn("Não foi possível medir as margens do logo:", error);
    }

    return { aspect, occupancy };
  }

  function getSmartLogoBox(img, baseSize) {
    const { aspect, occupancy } = inspectLogoContent(img);
    const safeAspect = clamp(Number(aspect) || 1, 0.35, 3.4);
    let width = baseSize;
    let height = baseSize;
    let radius = 28;

    if (safeAspect >= 1.35) {
      width = clamp(baseSize * Math.min(safeAspect, 2.1), baseSize, 380);
      height = clamp(baseSize * 0.78, 90, 220);
      radius = 28;
    } else if (safeAspect <= 0.75) {
      width = clamp(baseSize * 0.80, 90, 220);
      height = clamp(baseSize / Math.max(safeAspect, 0.62), baseSize, 300);
      radius = 28;
    } else {
      width = baseSize;
      height = baseSize;
      radius = Math.round(baseSize * 0.18);
    }

    const contentScale = occupancy < 0.86
      ? clamp(0.88 / Math.max(occupancy, 0.45), 1, 1.7)
      : 1;

    const padding = Math.round(clamp(Math.min(width, height) * 0.055, 8, 18));
    return { width, height, radius, contentScale, aspect: safeAspect };
  }

  function applyLogoSettings() {
    const wrapper = byId("story-logo-wrapper");
    const img = byId("story-logo-preview");
    const sizeInput = byId("logo-size");
    const positionInput = byId("logo-position");
    if (!wrapper) return;

    const size = clamp(Number(sizeInput?.value || 150), 90, 260);
    const position = positionInput?.value || "top-left";
    const metrics = getSmartLogoBox(img, size);

    wrapper.style.setProperty("width", `${metrics.width}px`, "important");
    wrapper.style.setProperty("height", `${metrics.height}px`, "important");
    wrapper.style.setProperty("border-radius", `${metrics.radius}px`, "important");
    wrapper.style.setProperty("padding", `${Math.round(clamp(Math.min(metrics.width, metrics.height) * 0.055, 8, 18))}px`, "important");
    wrapper.style.setProperty("top", "50px", "important");
    wrapper.style.setProperty("bottom", "auto", "important");
    wrapper.style.setProperty("right", "auto", "important");
    wrapper.style.setProperty("left", "50px", "important");
    wrapper.style.setProperty("transform", "none", "important");

    if (img) {
      img.style.setProperty("width", "100%", "important");
      img.style.setProperty("height", "100%", "important");
      img.style.setProperty("object-fit", "contain", "important");
      img.style.setProperty("object-position", "center", "important");
      img.style.setProperty("transform", `scale(${metrics.contentScale})`, "important");
      img.style.setProperty("transform-origin", "center center", "important");
    }

    if (position === "top-center") {
      wrapper.style.setProperty("left", "50%", "important");
      wrapper.style.setProperty("transform", "translateX(-50%)", "important");
    } else if (position === "top-right") {
      wrapper.style.setProperty("left", "auto", "important");
      wrapper.style.setProperty("right", "50px", "important");
    }

    const sizeLabel = byId("logo-size-value");
    if (sizeLabel) {
      const format = metrics.aspect >= 1.35 ? "horizontal" : metrics.aspect <= 0.75 ? "vertical" : "compacto";
      sizeLabel.textContent = `${size} px • ${format}`;
    }
    saveSettings({ logoSize: size, logoPosition: position });
    try { if (typeof window.invalidateStoryCache === "function") window.invalidateStoryCache(); } catch {}
  }

  async function updateQrCard() {
    const card = createQrCard();
    const input = byId("more-photos-url");
    const enabled = Boolean(byId("show-qr")?.checked);
    const status = byId("qr-status");
    const raw = input?.value?.trim() || "";

    if (!card || !enabled || !raw) {
      card?.classList.remove("is-visible");
      if (status) status.textContent = raw ? "QR Code oculto." : "Cole um link para gerar o QR Code.";
      saveSettings({ morePhotosUrl: raw, showQr: enabled });
      return;
    }

    let url;
    try {
      url = new URL(normalizeUrl(raw)).href;
    } catch {
      card.classList.remove("is-visible");
      if (status) status.textContent = "Link inválido. Use um endereço completo do imóvel ou galeria.";
      return;
    }

    try {
      const QRious = await loadQrLibrary();
      const qr = new QRious({
        value: url,
        size: 240,
        level: "M",
        padding: 12,
        background: "#ffffff",
        foreground: "#171717"
      });
      const img = byId("story-qr-image");
      const linkText = byId("story-qr-link");
      if (img) img.src = qr.toDataURL("image/png");
      if (linkText) linkText.textContent = getDisplayUrl(url);
      card.dataset.href = url;
      card.title = "Abrir " + getDisplayUrl(url);
      card.classList.add("is-visible");
      if (status) status.textContent = "QR Code pronto e incluído no PNG.";
      saveSettings({ morePhotosUrl: raw, showQr: enabled });
    } catch (error) {
      console.error(error);
      card.classList.remove("is-visible");
      if (status) status.textContent = "Não foi possível gerar o QR Code agora.";
    }
  }

  function restoreSavedLogo() {
    try {
      const savedLogo = localStorage.getItem(LOGO_KEY);
      const img = byId("story-logo-preview");
      const wrapper = byId("story-logo-wrapper");
      if (!savedLogo || !img || !wrapper || img.src) return;
      img.src = savedLogo;
      img.classList.remove("hidden");
      wrapper.classList.remove("hidden");
    } catch (error) {
      console.warn("Não foi possível restaurar o logo:", error);
    }
  }

  function setupLogoPersistence() {
    const input = byId("logo-upload-story");
    input?.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result || "");
        try {
          if (data.length <= 1800000) localStorage.setItem(LOGO_KEY, data);
          else console.warn("Logo grande demais para salvar automaticamente no navegador.");
        } catch (error) {
          console.warn("Não foi possível salvar o logo:", error);
        }
      };
      reader.readAsDataURL(file);
    });

    byId("remove-saved-logo")?.addEventListener("click", () => {
      try { localStorage.removeItem(LOGO_KEY); } catch {}
      const img = byId("story-logo-preview");
      const wrapper = byId("story-logo-wrapper");
      if (img) {
        img.src = "";
        img.classList.add("hidden");
      }
      wrapper?.classList.add("hidden");
    });
  }

  function restoreSettings() {
    const settings = readSettings();
    const contact = byId("contact");
    const brandName = byId("brand-name");
    const morePhotos = byId("more-photos-url");
    const showQr = byId("show-qr");
    const contentY = byId("content-y");
    const logoSize = byId("logo-size");
    const logoPosition = byId("logo-position");

    if (contact && settings.contact && !contact.value) contact.value = settings.contact;
    if (brandName && settings.brandName && !brandName.value) brandName.value = settings.brandName;
    if (morePhotos && settings.morePhotosUrl) morePhotos.value = settings.morePhotosUrl;
    if (showQr && typeof settings.showQr === "boolean") showQr.checked = settings.showQr;
    if (contentY && Number.isFinite(Number(settings.contentY))) contentY.value = String(settings.contentY);
    if (logoSize && Number.isFinite(Number(settings.logoSize))) logoSize.value = String(settings.logoSize);
    if (logoPosition && settings.logoPosition) logoPosition.value = settings.logoPosition;

    contact?.dispatchEvent(new Event("input", { bubbles: true }));
    applyBrandName();
    applyContentPosition();
    applyLogoSettings();
    restoreSavedLogo();
    updateQrCard();
  }

  function setupEvents() {
    byId("contact")?.addEventListener("input", (event) => saveSettings({ contact: event.target.value }));
    byId("brand-name")?.addEventListener("input", applyBrandName);
    byId("more-photos-url")?.addEventListener("input", updateQrCard);
    byId("show-qr")?.addEventListener("change", updateQrCard);

    const qrCard = byId("story-qr-card");
    const openQrLink = () => {
      const href = qrCard?.dataset.href || "";
      if (!href) return;
      window.open(href, "_blank", "noopener,noreferrer");
    };
    qrCard?.addEventListener("click", openQrLink);
    qrCard?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openQrLink();
      }
    });
    byId("content-y")?.addEventListener("input", applyContentPosition);
    byId("logo-size")?.addEventListener("input", applyLogoSettings);
    byId("logo-position")?.addEventListener("change", applyLogoSettings);
    const logoPreview = byId("story-logo-preview");
    logoPreview?.addEventListener("load", () => {
      requestAnimationFrame(applyLogoSettings);
    });

    byId("save-branding-now")?.addEventListener("click", () => {
      saveSettings({
        brandName: byId("brand-name")?.value || "",
        contact: byId("contact")?.value || "",
        morePhotosUrl: byId("more-photos-url")?.value || "",
        showQr: Boolean(byId("show-qr")?.checked),
        contentY: Number(byId("content-y")?.value || 0),
        logoSize: Number(byId("logo-size")?.value || 150),
        logoPosition: byId("logo-position")?.value || "top-left"
      });
      const btn = byId("save-branding-now");
      if (btn) {
        const old = btn.textContent;
        btn.textContent = "Salvo ✓";
        setTimeout(() => { btn.textContent = old; }, 1200);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    createControlSection();
    createQrCard();
    setupEvents();
    setupLogoPersistence();
    restoreSettings();
  });
})();