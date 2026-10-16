(() => {
  const $ = (id) => document.getElementById(id);
  const FORMAT_CONFIG = {
    story: { width: 1080, height: 1920, label: "Story", file: "story-assessoria-imobiliaria-1080x1920.png" },
    feed: { width: 1080, height: 1350, label: "Feed", file: "feed-assessoria-imobiliaria-1080x1350.png" },
    square: { width: 1080, height: 1080, label: "Quadrado", file: "post-assessoria-imobiliaria-1080x1080.png" },
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function injectStyles() {
    if ($("export-formats-style")) return;
    const style = document.createElement("style");
    style.id = "export-formats-style";
    style.textContent = `
      .export-formats-box{
        margin-top:14px;padding:14px;border-radius:16px;
        border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);
      }
      .export-formats-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
      .export-formats-title{font-size:13px;font-weight:900;color:#f8d78c}
      .export-formats-subtitle{margin-top:4px;font-size:11px;line-height:1.4;opacity:.68}
      .export-formats-badge{flex:0 0 auto;padding:5px 9px;border-radius:999px;background:rgba(200,139,58,.14);border:1px solid rgba(200,139,58,.28);color:#f8d78c;font-size:10px;font-weight:900}
      .export-formats-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .export-format-btn{
        min-height:46px;border:1px solid rgba(255,255,255,.11);border-radius:12px;
        padding:9px 8px;background:rgba(75,79,42,.52);color:white;font-size:11px;font-weight:900;cursor:pointer;
      }
      .export-format-btn:hover,.export-format-btn:focus-visible{border-color:rgba(200,139,58,.58);background:rgba(200,139,58,.20);outline:none}
      .export-format-btn:disabled{opacity:.55;cursor:wait}
      .export-package-btn{
        width:100%;min-height:48px;margin-top:9px;border:1px solid rgba(200,139,58,.38);border-radius:13px;
        padding:10px 12px;background:rgba(200,139,58,.14);color:#f8d78c;font-size:12px;font-weight:900;cursor:pointer;
      }
      .export-package-btn:disabled{opacity:.55;cursor:wait}
      .export-formats-status{min-height:17px;margin-top:8px;font-size:11px;line-height:1.35;opacity:.7}
      @media(max-width:899px){
        .export-formats-box{padding:12px}
        .export-formats-grid{grid-template-columns:1fr 1fr}
        .export-format-btn{min-height:50px;font-size:12px}
        .export-format-btn:first-child{grid-column:1/-1}
        .export-package-btn{min-height:52px;font-size:13px}
      }
    `;
    document.head.appendChild(style);
  }

  function setStatus(text) {
    const status = $("export-formats-status");
    if (status) status.textContent = text || "";
  }

  function setBusy(busy, text = "") {
    document.querySelectorAll(".export-format-btn, .export-package-btn").forEach((button) => {
      button.disabled = Boolean(busy);
    });
    if (text) setStatus(text);
  }

  function buildUi() {
    if ($("export-formats-box")) return;
    const downloadButton = $("download-story");
    const section = downloadButton?.closest(".section") || document.querySelector(".panel");
    if (!section) return;

    const box = document.createElement("div");
    box.id = "export-formats-box";
    box.className = "export-formats-box";
    box.innerHTML = `
      <div class="export-formats-head">
        <div>
          <div class="export-formats-title">Exportar para redes sociais</div>
          <div class="export-formats-subtitle">Use o mesmo anúncio em Story, Feed vertical e Post quadrado.</div>
        </div>
        <div class="export-formats-badge">3 formatos</div>
      </div>
      <div class="export-formats-grid">
        <button type="button" class="export-format-btn" data-export-format="story">Story<br>1080×1920</button>
        <button type="button" class="export-format-btn" data-export-format="feed">Feed<br>1080×1350</button>
        <button type="button" class="export-format-btn" data-export-format="square">Quadrado<br>1080×1080</button>
      </div>
      <button id="export-package" type="button" class="export-package-btn">Baixar pacote completo</button>
      <div id="export-formats-status" class="export-formats-status">Os formatos menores reorganizam o conteúdo automaticamente.</div>
    `;
    section.appendChild(box);
  }

  async function waitForImages(container, timeoutMs = 8000) {
    const images = [...container.querySelectorAll("img")].filter((img) => img.src);
    await Promise.all(images.map((img) => new Promise((resolve) => {
      if (img.complete && img.naturalWidth > 0) return resolve();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      img.addEventListener("load", finish, { once: true });
      img.addEventListener("error", finish, { once: true });
    })));
  }

  function readNumber(id, fallback) {
    const value = Number($(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function applyImageFrame(targetImage, targetHeight) {
    const sourceImage = $("story-image-preview");
    if (!targetImage || !sourceImage?.src) return;

    const fit = $("image-fit")?.value || "cover";
    const xPct = readNumber("pos-x", 50);
    const yPct = readNumber("pos-y", 50);
    const zoom = readNumber("zoom", 100) / 100;
    const naturalW = sourceImage.naturalWidth || 1080;
    const naturalH = sourceImage.naturalHeight || 1920;
    const width = 1080;

    const baseScale = fit === "contain"
      ? Math.min(width / naturalW, targetHeight / naturalH)
      : Math.max(width / naturalW, targetHeight / naturalH);

    const finalW = naturalW * baseScale * zoom;
    const finalH = naturalH * baseScale * zoom;
    const left = (width - finalW) * (xPct / 100);
    const top = (targetHeight - finalH) * (yPct / 100);

    targetImage.src = sourceImage.src;
    targetImage.classList.remove("hidden");
    targetImage.style.setProperty("position", "absolute", "important");
    targetImage.style.setProperty("left", `${left}px`, "important");
    targetImage.style.setProperty("top", `${top}px`, "important");
    targetImage.style.setProperty("width", `${finalW}px`, "important");
    targetImage.style.setProperty("height", `${finalH}px`, "important");
    targetImage.style.setProperty("max-width", "none", "important");
    targetImage.style.setProperty("max-height", "none", "important");
    targetImage.style.setProperty("object-fit", "fill", "important");
    targetImage.style.setProperty("object-position", "center", "important");
    targetImage.style.setProperty("transform", "none", "important");
    targetImage.style.setProperty("transform-origin", "center", "important");
  }

  function compactLayout(clone, format) {
    if (format === "story") return;

    const isSquare = format === "square";
    const content = clone.querySelector(".story-content");
    const badge = clone.querySelector(".story-badge");
    const title = clone.querySelector(".story-title");
    const price = clone.querySelector(".story-price");
    const meta = clone.querySelector(".story-meta");
    const description = clone.querySelector(".story-description");
    const features = clone.querySelector(".story-features");
    const cta = clone.querySelector(".story-cta");
    const ctaTitle = clone.querySelector(".story-cta-title");
    const contact = clone.querySelector(".story-contact");
    const footer = clone.querySelector(".story-footer");
    const logo = clone.querySelector(".story-logo");
    const qrCard = clone.querySelector(".story-qr-card");
    const qrTitle = clone.querySelector(".story-qr-title");
    const qrLink = clone.querySelector(".story-qr-link");
    const qrBox = clone.querySelector(".story-qr-box");
    const gallery = clone.querySelector(".story-gallery-grid");

    if (content) {
      content.style.setProperty("left", isSquare ? "44px" : "50px", "important");
      content.style.setProperty("right", isSquare ? "44px" : "50px", "important");
      content.style.setProperty("bottom", isSquare ? "86px" : "118px", "important");
    }
    if (badge) {
      badge.style.setProperty("font-size", isSquare ? "22px" : "27px", "important");
      badge.style.setProperty("padding", isSquare ? "11px 19px" : "13px 23px", "important");
      badge.style.setProperty("margin-bottom", isSquare ? "13px" : "17px", "important");
    }
    if (title) {
      title.style.setProperty("font-size", isSquare ? "50px" : "62px", "important");
      title.style.setProperty("line-height", "1.06", "important");
      title.style.setProperty("margin-bottom", isSquare ? "11px" : "15px", "important");
    }
    if (price) {
      price.style.setProperty("font-size", isSquare ? "43px" : "53px", "important");
      price.style.setProperty("margin-bottom", isSquare ? "13px" : "18px", "important");
    }
    if (meta) {
      meta.style.setProperty("font-size", isSquare ? "20px" : "25px", "important");
      meta.style.setProperty("margin-bottom", isSquare ? "13px" : "17px", "important");
      meta.style.setProperty("column-gap", "28px", "important");
    }
    if (description) {
      description.style.setProperty("font-size", isSquare ? "22px" : "28px", "important");
      description.style.setProperty("line-height", "1.25", "important");
      description.style.setProperty("max-height", isSquare ? "58px" : "105px", "important");
      description.style.setProperty("margin-bottom", isSquare ? "13px" : "17px", "important");
    }
    if (features) {
      features.style.setProperty("gap", isSquare ? "7px" : "9px", "important");
      features.style.setProperty("margin-bottom", isSquare ? "12px" : "16px", "important");
      features.querySelectorAll("span").forEach((span) => {
        span.style.setProperty("font-size", isSquare ? "16px" : "19px", "important");
        span.style.setProperty("padding", isSquare ? "6px 10px" : "7px 12px", "important");
      });
    }
    if (cta) {
      cta.style.setProperty("border-radius", isSquare ? "22px" : "28px", "important");
      cta.style.setProperty("padding", isSquare ? "18px 22px" : "24px 27px", "important");
    }
    if (ctaTitle) ctaTitle.style.setProperty("font-size", isSquare ? "22px" : "27px", "important");
    if (contact) contact.style.setProperty("font-size", isSquare ? "27px" : "34px", "important");
    if (footer) {
      footer.style.setProperty("left", isSquare ? "44px" : "50px", "important");
      footer.style.setProperty("right", isSquare ? "44px" : "50px", "important");
      footer.style.setProperty("bottom", isSquare ? "24px" : "28px", "important");
      footer.style.setProperty("font-size", isSquare ? "17px" : "20px", "important");
    }
    if (logo) {
      const size = isSquare ? "112px" : "138px";
      logo.style.setProperty("width", size, "important");
      logo.style.setProperty("height", size, "important");
      logo.style.setProperty("top", isSquare ? "30px" : "38px", "important");
      logo.style.setProperty("left", isSquare ? "36px" : "44px", "important");
    }
    if (qrCard && !qrCard.classList.contains("hidden")) {
      qrCard.style.setProperty("gap", isSquare ? "12px" : "17px", "important");
      qrCard.style.setProperty("padding", isSquare ? "11px 13px" : "14px 16px", "important");
      qrCard.style.setProperty("margin-bottom", isSquare ? "11px" : "14px", "important");
      qrCard.style.setProperty("border-radius", isSquare ? "18px" : "22px", "important");
      if (qrTitle) qrTitle.style.setProperty("font-size", isSquare ? "18px" : "23px", "important");
      if (qrLink) qrLink.style.setProperty("font-size", isSquare ? "14px" : "18px", "important");
      if (qrBox) {
        const size = isSquare ? "78px" : "96px";
        qrBox.style.setProperty("width", size, "important");
        qrBox.style.setProperty("height", size, "important");
        qrBox.style.setProperty("flex-basis", size, "important");
        qrBox.style.setProperty("padding", "6px", "important");
      }
    }
    if (gallery && !gallery.classList.contains("hidden")) {
      gallery.style.setProperty("gap", isSquare ? "7px" : "10px", "important");
      gallery.style.setProperty("margin-bottom", isSquare ? "10px" : "14px", "important");
      gallery.querySelectorAll("img").forEach((img) => {
        img.style.setProperty("height", isSquare ? "105px" : "150px", "important");
        img.style.setProperty("border-radius", isSquare ? "13px" : "17px", "important");
      });
    }
  }

  function prepareClone(formatKey) {
    const config = FORMAT_CONFIG[formatKey];
    const story = $("story-preview-wrapper");
    if (!config || !story) throw new Error("Preview do anúncio não encontrado.");

    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.position = "fixed";
    host.style.left = "-15000px";
    host.style.top = "0";
    host.style.width = `${config.width}px`;
    host.style.height = `${config.height}px`;
    host.style.overflow = "hidden";
    host.style.pointerEvents = "none";
    host.style.zIndex = "-2147483647";

    const clone = story.cloneNode(true);
    clone.id = `export-${formatKey}-${Date.now()}`;
    clone.classList.remove("shadow-2xl");
    clone.style.setProperty("position", "relative", "important");
    clone.style.setProperty("left", "0", "important");
    clone.style.setProperty("top", "0", "important");
    clone.style.setProperty("width", `${config.width}px`, "important");
    clone.style.setProperty("height", `${config.height}px`, "important");
    clone.style.setProperty("min-width", `${config.width}px`, "important");
    clone.style.setProperty("min-height", `${config.height}px`, "important");
    clone.style.setProperty("max-width", "none", "important");
    clone.style.setProperty("transform", "none", "important");
    clone.style.setProperty("transform-origin", "top left", "important");
    clone.style.setProperty("margin", "0", "important");
    clone.style.setProperty("border-radius", "0", "important");
    clone.style.setProperty("clip-path", "none", "important");
    clone.style.setProperty("overflow", "hidden", "important");
    clone.style.setProperty("box-shadow", "none", "important");

    clone.querySelectorAll("*").forEach((el) => {
      el.style.setProperty("transition", "none", "important");
      el.style.setProperty("animation", "none", "important");
      el.style.setProperty("backdrop-filter", "none", "important");
      el.style.setProperty("-webkit-backdrop-filter", "none", "important");
    });

    const image = clone.querySelector("#story-image-preview");
    applyImageFrame(image, config.height);

    const blur = clone.querySelector("#story-bg-blur");
    const sourceImage = $("story-image-preview");
    const useBlur = $("image-fit")?.value === "contain" && ($("contain-bg")?.value ?? "true") === "true";
    if (blur) {
      if (useBlur && sourceImage?.src) {
        blur.classList.remove("hidden");
        blur.style.setProperty("background-image", `url('${sourceImage.src}')`, "important");
        blur.style.setProperty("background-size", "cover", "important");
        blur.style.setProperty("background-position", `${readNumber("pos-x", 50)}% ${readNumber("pos-y", 50)}%`, "important");
        blur.style.setProperty("filter", "none", "important");
        blur.style.setProperty("transform", "none", "important");
        blur.style.setProperty("opacity", ".42", "important");
      } else {
        blur.remove();
      }
    }

    compactLayout(clone, formatKey);
    host.appendChild(clone);
    document.body.appendChild(host);
    return { host, clone, config };
  }

  async function renderFormat(formatKey) {
    if (typeof domtoimage === "undefined") throw new Error("Gerador de imagem não carregou.");
    const { host, clone, config } = prepareClone(formatKey);

    try {
      if (document.fonts?.ready) await document.fonts.ready.catch?.(() => undefined);
      await waitForImages(clone, 8000);
      await wait(80);
      const dataUrl = await domtoimage.toPng(clone, {
        width: config.width,
        height: config.height,
        cacheBust: true,
        bgcolor: "#15160d",
        style: {
          width: `${config.width}px`,
          height: `${config.height}px`,
          minWidth: `${config.width}px`,
          minHeight: `${config.height}px`,
          transform: "none",
          transformOrigin: "top left",
          margin: "0",
          borderRadius: "0",
          clipPath: "none",
          overflow: "hidden",
          boxShadow: "none",
        },
      });
      if (!dataUrl?.startsWith("data:image/png")) throw new Error("PNG inválido.");
      return dataUrl;
    } finally {
      host.remove();
    }
  }

  async function toBlob(dataUrl) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    if (!blob?.size) throw new Error("Arquivo vazio.");
    return blob.type === "image/png" ? blob : blob.slice(0, blob.size, "image/png");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function exportOne(formatKey) {
    const config = FORMAT_CONFIG[formatKey];
    if (!config) return;
    setBusy(true, `Gerando ${config.label}...`);
    try {
      const dataUrl = await renderFormat(formatKey);
      const blob = await toBlob(dataUrl);
      downloadBlob(blob, config.file);
      setStatus(`✅ ${config.label} ${config.width}×${config.height} gerado.`);
    } catch (error) {
      console.error(`Erro ao gerar ${formatKey}:`, error);
      setStatus(`Erro ao gerar ${config.label}.`);
      alert(`Falhou ao gerar ${config.label}: ${error?.message || error}`);
    } finally {
      setBusy(false);
    }
  }

  async function exportPackage() {
    setBusy(true, "Gerando Story, Feed e Quadrado...");
    try {
      const entries = [];
      for (const key of ["story", "feed", "square"]) {
        const config = FORMAT_CONFIG[key];
        setStatus(`Gerando ${config.label}...`);
        const dataUrl = await renderFormat(key);
        const blob = await toBlob(dataUrl);
        entries.push({ key, config, blob });
        await wait(80);
      }

      const files = entries.map(({ config, blob }) => new File([blob], config.file, { type: "image/png" }));
      const canShare = navigator.share && navigator.canShare && navigator.canShare({ files });

      if (canShare) {
        try {
          await navigator.share({
            files,
            title: "Materiais do imóvel",
            text: "Story, Feed e Post quadrado - Assessoria Imobiliária",
          });
          setStatus("✅ Pacote pronto para compartilhar.");
          return;
        } catch (error) {
          if (error?.name === "AbortError") {
            setStatus("Compartilhamento cancelado.");
            return;
          }
          console.warn("Compartilhamento múltiplo não disponível:", error);
        }
      }

      for (const { config, blob } of entries) {
        downloadBlob(blob, config.file);
        await wait(260);
      }
      setStatus("✅ Story, Feed e Quadrado baixados.");
    } catch (error) {
      console.error("Erro ao gerar pacote:", error);
      setStatus("Erro ao gerar o pacote completo.");
      alert(`Falhou ao gerar o pacote: ${error?.message || error}`);
    } finally {
      setBusy(false);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    buildUi();

    document.addEventListener("click", (event) => {
      const formatButton = event.target.closest("[data-export-format]");
      if (formatButton) {
        event.preventDefault();
        exportOne(formatButton.dataset.exportFormat);
        return;
      }
      if (event.target.closest("#export-package")) {
        event.preventDefault();
        exportPackage();
      }
    });
  });
})();