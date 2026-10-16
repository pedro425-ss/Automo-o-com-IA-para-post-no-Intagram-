(() => {
  const ENABLED_KEY = "auto-brand-theme-enabled-v1";
  const $ = (id) => document.getElementById(id);

  let currentTheme = null;
  let analyzeTimer = null;
  let logoObserver = null;

  function enabled() {
    try {
      const saved = localStorage.getItem(ENABLED_KEY);
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  }

  function setEnabled(value) {
    try { localStorage.setItem(ENABLED_KEY, String(Boolean(value))); } catch {}
    updateToggle();
    if (value) analyzeCurrentLogo();
    else clearTheme();
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function rgbToHex(rgb) {
    return "#" + [rgb.r, rgb.g, rgb.b]
      .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0"))
      .join("");
  }

  function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    const d = max - min;

    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case r: h = 60 * (((g - b) / d) % 6); break;
        case g: h = 60 * (((b - r) / d) + 2); break;
        default: h = 60 * (((r - g) / d) + 4);
      }
    }
    if (h < 0) h += 360;
    return { h, s: Number.isFinite(s) ? s : 0, l };
  }

  function hslToRgb({ h, s, l }) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rp = 0, gp = 0, bp = 0;

    if (h < 60) [rp, gp, bp] = [c, x, 0];
    else if (h < 120) [rp, gp, bp] = [x, c, 0];
    else if (h < 180) [rp, gp, bp] = [0, c, x];
    else if (h < 240) [rp, gp, bp] = [0, x, c];
    else if (h < 300) [rp, gp, bp] = [x, 0, c];
    else [rp, gp, bp] = [c, 0, x];

    return {
      r: Math.round((rp + m) * 255),
      g: Math.round((gp + m) * 255),
      b: Math.round((bp + m) * 255)
    };
  }

  function mix(a, b, amount) {
    const t = clamp(amount, 0, 1);
    return {
      r: Math.round(a.r * (1 - t) + b.r * t),
      g: Math.round(a.g * (1 - t) + b.g * t),
      b: Math.round(a.b * (1 - t) + b.b * t)
    };
  }

  function rgba(rgb, alpha) {
    return `rgba(${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)},${alpha})`;
  }

  function adjustLightness(rgb, targetMin = 0.34, targetMax = 0.68) {
    const hsl = rgbToHsl(rgb);
    if (hsl.l < targetMin) hsl.l = targetMin;
    if (hsl.l > targetMax) hsl.l = targetMax;
    if (hsl.s < 0.12) hsl.s = Math.min(0.18, hsl.s + 0.08);
    return hslToRgb(hsl);
  }

  function luminance({ r, g, b }) {
    const convert = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * convert(r) + 0.7152 * convert(g) + 0.0722 * convert(b);
  }

  function distance(a, b) {
    return Math.sqrt(
      Math.pow(a.r - b.r, 2) +
      Math.pow(a.g - b.g, 2) +
      Math.pow(a.b - b.b, 2)
    );
  }

  function waitImage(src) {
    return new Promise((resolve, reject) => {
      if (!src) return reject(new Error("Logo vazio"));
      const img = new Image();
      if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Não foi possível ler o logo."));
      img.src = src;
    });
  }

  async function extractPalette(src) {
    const img = await waitImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas indisponível");

    ctx.clearRect(0, 0, 96, 96);
    ctx.drawImage(img, 0, 0, 96, 96);

    const pixels = ctx.getImageData(0, 0, 96, 96).data;
    const bins = new Map();

    for (let i = 0; i < pixels.length; i += 16) {
      const a = pixels[i + 3];
      if (a < 120) continue;

      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const entry = bins.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      entry.count += 1;
      entry.r += r;
      entry.g += g;
      entry.b += b;
      bins.set(key, entry);
    }

    let colors = [...bins.values()].map((entry) => {
      const rgb = {
        r: entry.r / entry.count,
        g: entry.g / entry.count,
        b: entry.b / entry.count
      };
      const hsl = rgbToHsl(rgb);
      const lum = luminance(rgb);
      const useful = lum > 0.025 && lum < 0.975;
      const score = entry.count * (0.65 + hsl.s * 1.7) * (useful ? 1 : 0.28);
      return { rgb, hsl, lum, count: entry.count, score };
    });

    if (!colors.length) throw new Error("O logo não possui cores legíveis.");

    colors.sort((a, b) => b.score - a.score);
    const colorful = colors.filter((item) =>
      item.lum > 0.04 &&
      item.lum < 0.94 &&
      item.hsl.s >= 0.10
    );

    const primaryEntry = colorful[0] || colors[0];
    const primary = primaryEntry.rgb;

    let secondaryEntry = colorful.find((item) =>
      item !== primaryEntry &&
      distance(item.rgb, primary) >= 88
    );

    if (!secondaryEntry) {
      secondaryEntry = colors.find((item) =>
        item !== primaryEntry &&
        distance(item.rgb, primary) >= 70
      );
    }

    let secondary;
    if (secondaryEntry) {
      secondary = secondaryEntry.rgb;
    } else {
      const hsl = rgbToHsl(primary);
      secondary = hslToRgb({
        h: hsl.h + (hsl.s < 0.16 ? 0 : 34),
        s: Math.max(0.16, hsl.s * 0.82),
        l: clamp(hsl.l + (hsl.l < 0.45 ? 0.20 : -0.16), 0.18, 0.76)
      });
    }

    return { primary, secondary };
  }

  function createTheme(primaryRaw, secondaryRaw) {
    const primaryHsl = rgbToHsl(primaryRaw);
    const primary = adjustLightness(primaryRaw, 0.30, 0.66);
    const secondary = adjustLightness(secondaryRaw, 0.30, 0.72);
    const accent = primaryHsl.l < 0.28
      ? hslToRgb({ ...rgbToHsl(primary), l: 0.58 })
      : primary;

    const highlight = (() => {
      const hsl = rgbToHsl(secondary);
      hsl.l = clamp(Math.max(hsl.l, 0.62), 0.62, 0.78);
      hsl.s = clamp(Math.max(hsl.s, 0.25), 0.25, 0.85);
      return hslToRgb(hsl);
    })();

    const neutralBg = { r: 9, g: 12, b: 17 };
    const neutralPanel = { r: 16, g: 20, b: 27 };
    const neutralSection = { r: 20, g: 25, b: 33 };
    const neutralControl = { r: 13, g: 17, b: 23 };

    let mode = "equilibrado";
    if (primaryHsl.s >= 0.58) mode = "marcante";
    else if (primaryHsl.s <= 0.16) mode = "minimalista";

    return {
      primary,
      secondary,
      accent,
      highlight,
      bg: mix(primaryRaw, neutralBg, 0.94),
      panel: mix(primaryRaw, neutralPanel, 0.96),
      section: mix(secondaryRaw, neutralSection, 0.97),
      control: mix(primaryRaw, neutralControl, 0.98),
      textOnPrimary: luminance(primary) > 0.46 ? "#101318" : "#ffffff",
      mode
    };
  }

  function injectStyles() {
    if ($("auto-brand-theme-style")) return;
    const style = document.createElement("style");
    style.id = "auto-brand-theme-style";
    style.textContent = `
      html[data-brand-theme="auto"] body{
        background:
          radial-gradient(circle at 12% -8%,var(--brand-glow),transparent 30%),
          radial-gradient(circle at 92% 8%,var(--brand-glow-2),transparent 24%),
          #090c11 !important;
        transition:background .35s ease;
      }
      html[data-brand-theme="auto"] .panel{
        background:linear-gradient(180deg,rgba(17,22,29,.97),rgba(12,16,22,.97)) !important;
        border:1px solid var(--brand-border-soft) !important;
        box-shadow:0 24px 70px rgba(0,0,0,.30) !important;
        position:relative !important;
        overflow:hidden !important;
      }
      html[data-brand-theme="auto"] .panel::before{
        content:"";
        position:absolute;
        inset:0 0 auto 0;
        height:3px;
        background:linear-gradient(90deg,var(--brand-primary),var(--brand-secondary));
        opacity:.88;
        z-index:20;
      }
      html[data-brand-theme="auto"] .section,
      html[data-brand-theme="auto"] .story-template-panel,
      html[data-brand-theme="auto"] .logo-library,
      html[data-brand-theme="auto"] .cloud-profile-box,
      html[data-brand-theme="auto"] .story-extra-control{
        background:rgba(255,255,255,.032) !important;
        border-color:var(--brand-border-soft) !important;
        box-shadow:none !important;
      }
      html[data-brand-theme="auto"] .panel-title{
        color:#f8fafc !important;
        text-shadow:none !important;
      }
      html[data-brand-theme="auto"] .panel-subtitle{
        color:#aeb8c6 !important;
        opacity:1 !important;
      }
      html[data-brand-theme="auto"] .section-title,
      html[data-brand-theme="auto"] .story-template-title,
      html[data-brand-theme="auto"] .story-extra-title,
      html[data-brand-theme="auto"] .logo-library-title,
      html[data-brand-theme="auto"] .cloud-profile-title,
      html[data-brand-theme="auto"] .framing-title,
      html[data-brand-theme="auto"] .adjust-control-title{
        color:var(--brand-highlight) !important;
      }
      html[data-brand-theme="auto"] .input,
      html[data-brand-theme="auto"] .textarea,
      html[data-brand-theme="auto"] .select,
      html[data-brand-theme="auto"] .file{
        background:#0f141b !important;
        border-color:rgba(255,255,255,.09) !important;
      }
      html[data-brand-theme="auto"] .input:focus,
      html[data-brand-theme="auto"] .textarea:focus,
      html[data-brand-theme="auto"] .select:focus{
        border-color:var(--brand-accent) !important;
        box-shadow:0 0 0 3px var(--brand-focus) !important;
      }
      html[data-brand-theme="auto"] input[type="range"],
      html[data-brand-theme="auto"] input[type="checkbox"]{
        accent-color:var(--brand-accent) !important;
      }
      html[data-brand-theme="auto"] .btn-green,
      html[data-brand-theme="auto"] .btn-gold,
      html[data-brand-theme="auto"] .btn-orange,
      html[data-brand-theme="auto"] .btn-blue,
      html[data-brand-theme="auto"] .btn-dark,
      html[data-brand-theme="auto"] .logo-library-save,
      html[data-brand-theme="auto"] .cloud-profile-btn.primary{
        background:var(--brand-primary) !important;
        color:var(--brand-on-primary) !important;
        border:1px solid rgba(255,255,255,.10) !important;
        box-shadow:0 8px 22px var(--brand-button-shadow) !important;
      }
      html[data-brand-theme="auto"] .frame-preset,
      html[data-brand-theme="auto"] .story-extra-btn,
      html[data-brand-theme="auto"] .logo-card-btn,
      html[data-brand-theme="auto"] .cloud-profile-mini{
        border-color:var(--brand-border-soft) !important;
      }
      html[data-brand-theme="auto"] .story-template-button.is-active,
      html[data-brand-theme="auto"] .logo-card.is-default{
        border-color:var(--brand-accent) !important;
        color:var(--brand-highlight) !important;
        box-shadow:0 0 0 2px var(--brand-focus) inset !important;
      }
      html[data-brand-theme="auto"] .story-logo{
        box-shadow:0 10px 42px var(--brand-story-glow) !important;
        border:2px solid var(--brand-border-strong) !important;
      }
      html[data-brand-theme="auto"] .instagram-story{
        background:#10151c !important;
        box-shadow:0 0 0 2px var(--brand-border-soft) inset,0 24px 70px rgba(0,0,0,.34) !important;
      }
      html[data-brand-theme="auto"] .panel{border-radius:22px !important}
      html[data-brand-theme="auto"] .section{border-radius:16px !important}
      html[data-brand-theme="auto"] .btn{border-radius:12px !important}

      .auto-brand-box{margin-top:12px;padding:13px;border-radius:15px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.035)}
      .auto-brand-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .auto-brand-title{font-size:13px;font-weight:900}
      .auto-brand-subtitle{margin-top:3px;font-size:10px;line-height:1.4;opacity:.68}
      .auto-brand-status{font-size:10px;font-weight:900;white-space:nowrap;opacity:.82}
      .auto-brand-swatches{display:flex;gap:7px;margin:11px 0}
      .auto-brand-swatch{width:42px;height:28px;border-radius:9px;border:1px solid rgba(255,255,255,.18);box-shadow:0 4px 12px rgba(0,0,0,.2)}
      .auto-brand-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}
      .auto-brand-btn{min-height:40px;border-radius:11px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:white;font-size:10px;font-weight:900;cursor:pointer}
      .auto-brand-mode{margin-top:8px;font-size:10px;opacity:.62}
      @media(max-width:899px){.auto-brand-actions{grid-template-columns:1fr}.auto-brand-btn{min-height:46px;font-size:12px}}
    `;
    document.head.appendChild(style);
  }

  function buildUi() {
    if ($("auto-brand-box")) return;
    const logoInput = $("logo-upload-story");
    const host = logoInput?.closest(".section") || $("logo-library") || $("story-advanced-section");
    if (!host) return;

    const box = document.createElement("div");
    box.id = "auto-brand-box";
    box.className = "auto-brand-box";
    box.innerHTML = `
      <div class="auto-brand-head">
        <div>
          <div class="auto-brand-title">Tema automático pelo logo</div>
          <div class="auto-brand-subtitle">As cores e o estilo do site acompanham a identidade da imobiliária.</div>
        </div>
        <div id="auto-brand-status" class="auto-brand-status">Aguardando logo</div>
      </div>
      <div class="auto-brand-swatches">
        <div id="auto-brand-primary" class="auto-brand-swatch" title="Cor principal"></div>
        <div id="auto-brand-secondary" class="auto-brand-swatch" title="Cor secundária"></div>
        <div id="auto-brand-highlight" class="auto-brand-swatch" title="Destaque"></div>
      </div>
      <div class="auto-brand-actions">
        <button id="auto-brand-toggle" type="button" class="auto-brand-btn"></button>
        <button id="auto-brand-refresh" type="button" class="auto-brand-btn">Analisar logo novamente</button>
      </div>
      <div id="auto-brand-mode" class="auto-brand-mode">Troque o logo e o tema muda automaticamente.</div>
    `;
    host.appendChild(box);
    updateToggle();
  }

  function updateToggle() {
    const button = $("auto-brand-toggle");
    if (button) button.textContent = enabled() ? "Tema automático: ligado" : "Tema automático: desligado";
  }

  function updateUi(theme, message = "") {
    const status = $("auto-brand-status");
    const mode = $("auto-brand-mode");
    if (status) {
      status.textContent = theme
        ? `${message || "Identidade aplicada"} • ${rgbToHex(theme.primary)} + ${rgbToHex(theme.secondary)}`
        : (message || "Aguardando logo");
    }
    if (mode && theme) {
      const names = { marcante: "Marcante", minimalista: "Minimalista", equilibrado: "Equilibrado" };
      mode.textContent = `Estilo detectado: ${names[theme.mode] || theme.mode}. Paleta ativa: ${rgbToHex(theme.primary)}, ${rgbToHex(theme.secondary)} e ${rgbToHex(theme.highlight)}.`;
    }
    const swatches = [
      ["auto-brand-primary", theme?.primary],
      ["auto-brand-secondary", theme?.secondary],
      ["auto-brand-highlight", theme?.highlight]
    ];
    swatches.forEach(([id, rgb]) => {
      const el = $(id);
      if (el) el.style.background = rgb ? rgbToHex(rgb) : "rgba(255,255,255,.08)";
    });
  }

  function setVariables(theme) {
    const root = document.documentElement;
    root.dataset.brandTheme = "auto";
    root.dataset.brandStyle = theme.mode;

    const vars = {
      "--brand-primary": rgbToHex(theme.primary),
      "--brand-secondary": rgbToHex(theme.secondary),
      "--brand-accent": rgbToHex(theme.accent),
      "--brand-highlight": rgbToHex(theme.highlight),
      "--brand-bg": rgbToHex(theme.bg),
      "--brand-panel": rgbToHex(theme.panel),
      "--brand-panel-2": rgbToHex(mix(theme.secondary, theme.bg, 0.84)),
      "--brand-section": rgba(theme.section, 0.78),
      "--brand-section-2": rgba(theme.section, 0.70),
      "--brand-control": rgba(theme.control, 0.92),
      "--brand-on-primary": theme.textOnPrimary,
      "--brand-soft-text": "#b8c0cc",
      "--brand-border": rgba(theme.accent, 0.20),
      "--brand-border-soft": rgba(theme.accent, 0.18),
      "--brand-border-strong": rgba(theme.accent, 0.46),
      "--brand-focus": rgba(theme.accent, 0.20),
      "--brand-glow": rgba(theme.primary, 0.14),
      "--brand-glow-2": rgba(theme.secondary, 0.10),
      "--brand-page-wash": rgba(theme.primary, 0.08),
      "--brand-shadow": "rgba(0,0,0,.28)",
      "--brand-button-shadow": rgba(theme.primary, 0.22),
      "--brand-story-glow": rgba(theme.accent, 0.42),
      "--brand-story-light": rgba(theme.highlight, 0.24),
      "--brand-story-dark": rgbToHex(mix(theme.primary, { r: 4, g: 7, b: 10 }, 0.68))
    };

    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  }

  function applyStoryBrand(theme = currentTheme) {
    if (!theme || !enabled()) return;

    const story = $("story-preview-wrapper");
    const badge = $("story-badge");
    const price = $("story-price");
    const overlay = story?.querySelector(".story-overlay");
    const cta = story?.querySelector(".story-cta");

    badge?.style.setProperty("background", rgba(theme.primary, 0.92), "important");
    badge?.style.setProperty("color", theme.textOnPrimary, "important");
    badge?.style.setProperty("box-shadow", `0 8px 26px ${rgba(theme.primary,.20)}`, "important");
    price?.style.setProperty("color", rgbToHex(theme.highlight), "important");
    overlay?.style.setProperty(
      "background",
      `linear-gradient(180deg,rgba(0,0,0,.00) 0%,rgba(0,0,0,.08) 48%,rgba(6,9,13,.56) 77%,rgba(5,8,12,.88) 100%)`,
      "important"
    );
    cta?.style.setProperty("background", "rgba(10,14,20,.76)", "important");
    cta?.style.setProperty("border-color", rgba(theme.accent, 0.34), "important");
    cta?.style.setProperty("box-shadow", `inset 4px 0 0 ${rgbToHex(theme.primary)}`, "important");

    try {
      if (typeof window.invalidateStoryCache === "function") window.invalidateStoryCache();
    } catch {}
  }

  function clearTheme() {
    currentTheme = null;
    const root = document.documentElement;
    delete root.dataset.brandTheme;
    delete root.dataset.brandStyle;

    [...root.style].filter((name) => name.startsWith("--brand-"))
      .forEach((name) => root.style.removeProperty(name));

    ["story-badge", "story-price"].forEach((id) => {
      const el = $(id);
      el?.style.removeProperty("background");
      el?.style.removeProperty("color");
    });

    const story = $("story-preview-wrapper");
    story?.style.removeProperty("background");
    const overlay = story?.querySelector(".story-overlay");
    const cta = story?.querySelector(".story-cta");
    overlay?.style.removeProperty("background");
    cta?.style.removeProperty("background");
    cta?.style.removeProperty("border-color");
    cta?.style.removeProperty("box-shadow");
    const badge = $("story-badge");
    badge?.style.removeProperty("box-shadow");

    const activeTemplate = document.querySelector(".story-template-button.is-active");
    if (activeTemplate) setTimeout(() => activeTemplate.click(), 0);
    updateUi(null, "Tema automático desligado");
  }

  async function analyzeCurrentLogo() {
    if (!enabled()) return;

    const logo = $("story-logo-preview");
    const src = logo?.getAttribute("src") || "";
    if (!src || logo?.classList.contains("hidden")) {
      updateUi(null, "Aguardando logo");
      return;
    }

    const status = $("auto-brand-status");
    if (status) status.textContent = "Analisando cores…";

    try {
      const palette = await extractPalette(src);
      const theme = createTheme(palette.primary, palette.secondary);
      currentTheme = theme;
      setVariables(theme);
      applyStoryBrand(theme);
      updateUi(theme, "Identidade aplicada");
    } catch (error) {
      console.warn("Tema automático:", error);
      updateUi(currentTheme, "Não foi possível analisar este logo");
    }
  }

  function scheduleAnalyze(delay = 100) {
    clearTimeout(analyzeTimer);
    analyzeTimer = setTimeout(analyzeCurrentLogo, delay);
  }

  function setupObservers() {
    const logo = $("story-logo-preview");
    if (logo) {
      logo.addEventListener("load", () => scheduleAnalyze(40));
      logoObserver = new MutationObserver((changes) => {
        if (changes.some((item) => item.attributeName === "src" || item.attributeName === "class")) {
          scheduleAnalyze(80);
        }
      });
      logoObserver.observe(logo, { attributes: true, attributeFilter: ["src", "class"] });
    }

    $("logo-upload-story")?.addEventListener("change", () => scheduleAnalyze(220));

    document.addEventListener("click", (event) => {
      if (event.target.closest(".story-template-button")) {
        setTimeout(() => applyStoryBrand(), 30);
      }
    });

    const story = $("story-preview-wrapper");
    if (story) {
      const observer = new MutationObserver((changes) => {
        if (!enabled() || !currentTheme) return;
        if (changes.some((item) => item.type === "attributes" && item.attributeName === "data-story-template")) {
          setTimeout(() => applyStoryBrand(), 20);
        }
      });
      observer.observe(story, { attributes: true, attributeFilter: ["data-story-template"] });
    }
  }

  function setupEvents() {
    $("auto-brand-toggle")?.addEventListener("click", () => setEnabled(!enabled()));
    $("auto-brand-refresh")?.addEventListener("click", () => analyzeCurrentLogo());
  }

  window.applyBrandThemeFromLogo = analyzeCurrentLogo;
  window.reapplyBrandTheme = () => applyStoryBrand(currentTheme);

  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    setTimeout(() => {
      buildUi();
      setupEvents();
      setupObservers();
      updateToggle();
      if (enabled()) scheduleAnalyze(150);
    }, 0);
  });
})();