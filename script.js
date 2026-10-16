console.log("✅ script.js carregou");

const API_BASE = window.location.origin;

function $(id) {
  return document.getElementById(id);
}

let LAST_STORY_BLOB = null;
let LAST_STORY_CREATED_AT = 0;

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function invalidateStoryCache() {
  LAST_STORY_BLOB = null;
  LAST_STORY_CREATED_AT = 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOMContentLoaded - registrando eventos");

  const badgeInput = $("badge");
  const titleInput = $("title");
  const priceInput = $("price");
  const cityInput = $("city");
  const districtInput = $("district");
  const areaInput = $("area");
  const descInput = $("description");
  const contactInput = $("contact");
  const featureInputs = document.querySelectorAll(".feature");
  const storyFeatures = $("story-features");

  const imageFitSelect = $("image-fit");
  const containBgSelect = $("contain-bg");
  const posX = $("pos-x");
  const posY = $("pos-y");
  const zoom = $("zoom");
  const zoomValue = $("zoom-value");
  const posXValue = $("pos-x-value");
  const posYValue = $("pos-y-value");

  const storyBadge = $("story-badge");
  const storyTitle = $("story-title");
  const storyPrice = $("story-price");
  const storyLocation = $("story-location");
  const storyArea = $("story-area");
  const storyDescription = $("story-description");
  const storyContact = $("story-contact");

  const story = $("story-preview-wrapper");
  const storyImage = $("story-image-preview");
  const storyBgBlur = $("story-bg-blur");
  const storyLogoWrapper = $("story-logo-wrapper");

  function updatePreviewText() {
    if (storyBadge) storyBadge.textContent = badgeInput?.value || "IMÓVEL À VENDA";
    if (storyTitle) storyTitle.textContent = titleInput?.value || "Título do imóvel";
    if (storyPrice) storyPrice.textContent = priceInput?.value || "R$ 0,00";

    if (storyLocation) {
      const district = districtInput?.value?.trim() || "";
      const city = cityInput?.value?.trim() || "";
      storyLocation.textContent = district && city
        ? `${district} - ${city}`
        : district || city || "Região - Cidade";
    }

    if (storyArea) storyArea.textContent = areaInput?.value || "Área";
    if (storyDescription) storyDescription.textContent = descInput?.value || "Descrição";
    if (storyContact) storyContact.textContent = contactInput?.value || "@assessoriaimobiliaria";

    if (storyFeatures) {
      const selected = [...featureInputs]
        .filter((item) => item.checked)
        .map((item) => item.value);

      storyFeatures.innerHTML = selected
        .slice(0, 4)
        .map((item) => `<span>${item}</span>`)
        .join("");
    }
  }

  function updateAdjustmentLabels() {
    if (zoomValue) zoomValue.textContent = `${zoom?.value || 100}%`;
    if (posXValue) posXValue.textContent = `${posX?.value || 50}%`;
    if (posYValue) posYValue.textContent = `${posY?.value || 50}%`;
  }

  function getFrameMetrics(sourceImage = storyImage) {
    const fit = imageFitSelect?.value || "cover";
    const zoomScale = Number(zoom?.value ?? 100) / 100;
    const containerW = 1080;
    const containerH = 1920;
    const naturalW = sourceImage?.naturalWidth || 1080;
    const naturalH = sourceImage?.naturalHeight || 1920;

    const baseScale = fit === "cover"
      ? Math.max(containerW / naturalW, containerH / naturalH)
      : Math.min(containerW / naturalW, containerH / naturalH);

    const finalW = naturalW * baseScale * zoomScale;
    const finalH = naturalH * baseScale * zoomScale;

    return {
      fit,
      containerW,
      containerH,
      naturalW,
      naturalH,
      finalW,
      finalH,
      freeX: containerW - finalW,
      freeY: containerH - finalH
    };
  }

  function applyFrameToElement(targetImage, targetBlur, sourceImage = storyImage) {
    if (!targetImage || !sourceImage?.src) return;

    const xPct = Number(posX?.value ?? 50);
    const yPct = Number(posY?.value ?? 50);
    const metrics = getFrameMetrics(sourceImage);

    const left = metrics.freeX * (xPct / 100);
    const top = metrics.freeY * (yPct / 100);

    targetImage.style.setProperty("position", "absolute", "important");
    targetImage.style.setProperty("left", `${left}px`, "important");
    targetImage.style.setProperty("top", `${top}px`, "important");
    targetImage.style.setProperty("width", `${metrics.finalW}px`, "important");
    targetImage.style.setProperty("height", `${metrics.finalH}px`, "important");
    targetImage.style.setProperty("max-width", "none", "important");
    targetImage.style.setProperty("max-height", "none", "important");
    targetImage.style.setProperty("object-fit", "fill", "important");
    targetImage.style.setProperty("object-position", "center center", "important");
    targetImage.style.setProperty("transform", "none", "important");
    targetImage.style.setProperty("transform-origin", "center center", "important");

    const useBg = (containBgSelect?.value ?? "true") === "true";
    const shouldShowBg = metrics.fit === "contain" && useBg;

    if (targetBlur) {
      targetBlur.style.backgroundPosition = `${xPct}% ${yPct}%`;

      if (shouldShowBg) {
        targetBlur.classList.remove("hidden");
        targetBlur.style.backgroundImage = `url('${sourceImage.src}')`;
      } else {
        targetBlur.classList.add("hidden");
        targetBlur.style.backgroundImage = "";
      }
    }

    updateAdjustmentLabels();
  }

  function applyImageSettings() {
    applyFrameToElement(storyImage, storyBgBlur, storyImage);
  }

  function applyImageSettingsAfterOtherHandlers() {
    applyImageSettings();
    requestAnimationFrame(() => applyImageSettings());
  }

  function updatePreviewAndInvalidate() {
    updatePreviewText();
    invalidateStoryCache();
  }

  function updateImageAndInvalidate() {
    applyImageSettingsAfterOtherHandlers();
    invalidateStoryCache();
  }

  [badgeInput, titleInput, priceInput, cityInput, districtInput, areaInput, descInput, contactInput]
    .forEach((el) => {
      el?.addEventListener("input", updatePreviewAndInvalidate);
      el?.addEventListener("change", updatePreviewAndInvalidate);
    });

  [...featureInputs].forEach((el) => {
    el.addEventListener("change", updatePreviewAndInvalidate);
  });

  [posX, posY, zoom, imageFitSelect, containBgSelect].forEach((el) => {
    el?.addEventListener("input", updateImageAndInvalidate);
    el?.addEventListener("change", updateImageAndInvalidate);
  });

  updatePreviewText();
  updateAdjustmentLabels();
  applyImageSettingsAfterOtherHandlers();

  $("image-upload-story")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file || !storyImage) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      storyImage.crossOrigin = "anonymous";
      storyImage.src = ev.target.result;
      storyImage.classList.remove("hidden");
      invalidateStoryCache();
    };
    reader.readAsDataURL(file);
  });

  storyImage?.addEventListener("load", () => {
    applyImageSettingsAfterOtherHandlers();
  });

  $("logo-upload-story")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = $("story-logo-preview");
      if (!img) return;
      img.crossOrigin = "anonymous";
      img.src = ev.target.result;
      img.classList.remove("hidden");
      storyLogoWrapper?.classList.remove("hidden");
      invalidateStoryCache();
    };
    reader.readAsDataURL(file);
  });

  $("buscar-imagem-ia")?.addEventListener("click", async (e) => {
    e.preventDefault();

    const url = $("imovel-url")?.value?.trim();
    if (!url) return alert("Cole a URL do imóvel");

    try {
      const res = await fetch(`${API_BASE}/analisar-imovel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Backend erro:", data);
        return alert(data?.erro || "Erro no backend");
      }
      if (!data.imagem) return alert("Não veio imagem do backend.");

      storyImage.crossOrigin = "anonymous";
      storyImage.src = data.imagem;
      storyImage.classList.remove("hidden");
      invalidateStoryCache();
    } catch (err) {
      console.error(err);
      alert("Erro ao buscar imagem no backend online.");
    }
  });

  function setupDirectManipulation() {
    if (!story || !storyImage || !posX || !posY || !zoom) return;

    storyImage.draggable = false;
    story.setAttribute("title", "Arraste a foto para reposicionar. No celular, use dois dedos para zoom.");

    const style = document.createElement("style");
    style.textContent = `
      #story-preview-wrapper.photo-edit-enabled {
        touch-action: none;
        cursor: grab;
      }
      #story-preview-wrapper.photo-edit-enabled.is-dragging {
        cursor: grabbing;
      }
      #story-preview-wrapper.photo-edit-enabled img {
        -webkit-user-drag: none;
        user-select: none;
      }
      .photo-gesture-hint {
        margin: 8px 0 2px;
        padding: 9px 11px;
        border-radius: 12px;
        border: 1px solid rgba(200,139,58,.22);
        background: rgba(200,139,58,.08);
        color: #f8d78c;
        font-size: 12px;
        line-height: 1.35;
        text-align: center;
      }
    `;
    document.head.appendChild(style);

    const adjustmentPanel = document.querySelector(".adjustment-panel");
    if (adjustmentPanel && !document.querySelector(".photo-gesture-hint")) {
      const hint = document.createElement("div");
      hint.className = "photo-gesture-hint";
      hint.textContent = isMobile()
        ? "Arraste a foto no preview. Use dois dedos para aumentar ou diminuir o zoom."
        : "Arraste a foto no preview para reposicionar. Use o slider para ajustar o zoom.";
      adjustmentPanel.insertBefore(hint, adjustmentPanel.firstChild);
    }

    story.classList.add("photo-edit-enabled");

    const pointers = new Map();
    let dragState = null;
    let pinchState = null;

    function getDisplayScale() {
      const rect = story.getBoundingClientRect();
      return rect.width > 0 ? rect.width / 1080 : 1;
    }

    function beginDrag(pointer) {
      const metrics = getFrameMetrics(storyImage);
      dragState = {
        pointerId: pointer.id,
        startClientX: pointer.x,
        startClientY: pointer.y,
        startPctX: Number(posX.value || 50),
        startPctY: Number(posY.value || 50),
        freeX: metrics.freeX,
        freeY: metrics.freeY,
        displayScale: getDisplayScale()
      };
      story.classList.add("is-dragging");
    }

    function beginPinch() {
      const values = [...pointers.values()];
      if (values.length < 2) return;
      const [a, b] = values;
      pinchState = {
        distance: Math.hypot(b.x - a.x, b.y - a.y),
        zoom: Number(zoom.value || 100)
      };
      dragState = null;
      story.classList.add("is-dragging");
    }

    function setPositionFromDrag(pointer) {
      if (!dragState || pointer.id !== dragState.pointerId) return;

      const scale = dragState.displayScale || 1;
      const dx = (pointer.x - dragState.startClientX) / scale;
      const dy = (pointer.y - dragState.startClientY) / scale;

      let nextX = dragState.startPctX;
      let nextY = dragState.startPctY;

      if (Math.abs(dragState.freeX) > 0.5) {
        nextX = dragState.startPctX + (dx / dragState.freeX) * 100;
      }
      if (Math.abs(dragState.freeY) > 0.5) {
        nextY = dragState.startPctY + (dy / dragState.freeY) * 100;
      }

      posX.value = String(Math.round(clamp(nextX, 0, 100)));
      posY.value = String(Math.round(clamp(nextY, 0, 100)));

      posX.dispatchEvent(new Event("input", { bubbles: true }));
      posY.dispatchEvent(new Event("input", { bubbles: true }));
      updateAdjustmentLabels();
    }

    function setZoomFromPinch() {
      if (!pinchState || pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      if (!pinchState.distance) return;

      const ratio = distance / pinchState.distance;
      const nextZoom = clamp(Math.round(pinchState.zoom * ratio), 100, 180);
      zoom.value = String(nextZoom);
      zoom.dispatchEvent(new Event("input", { bubbles: true }));
      updateAdjustmentLabels();
    }

    story.addEventListener("pointerdown", (event) => {
      if (!storyImage.src || storyImage.classList.contains("hidden")) return;

      event.preventDefault();
      story.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY
      });

      if (pointers.size === 1) {
        beginDrag([...pointers.values()][0]);
      } else if (pointers.size === 2) {
        beginPinch();
      }
    }, { passive: false });

    story.addEventListener("pointermove", (event) => {
      if (!pointers.has(event.pointerId)) return;
      event.preventDefault();

      pointers.set(event.pointerId, {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY
      });

      if (pointers.size >= 2) {
        setZoomFromPinch();
      } else {
        const pointer = pointers.get(event.pointerId);
        setPositionFromDrag(pointer);
      }
    }, { passive: false });

    function finishPointer(event) {
      pointers.delete(event.pointerId);
      try {
        story.releasePointerCapture?.(event.pointerId);
      } catch {}

      if (pointers.size === 0) {
        dragState = null;
        pinchState = null;
        story.classList.remove("is-dragging");
      } else if (pointers.size === 1) {
        dragState = null;
        pinchState = null;
        story.classList.remove("is-dragging");
      }
    }

    story.addEventListener("pointerup", finishPointer);
    story.addEventListener("pointercancel", finishPointer);
    story.addEventListener("lostpointercapture", (event) => {
      if (pointers.has(event.pointerId)) finishPointer(event);
    });
  }

  setupDirectManipulation();

  function withTimeout(promise, ms, label = "operação") {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout em ${label} (${ms}ms)`)), ms)
      ),
    ]);
  }

  async function waitForImages(container, timeoutMs = 8000) {
    const imgs = [...container.querySelectorAll("img")].filter((img) => img.src);
    await Promise.all(imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return withTimeout(
        new Promise((resolve) => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
        timeoutMs,
        "carregamento de imagem"
      ).catch(() => undefined);
    }));
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function prepareExportClone(storyElement) {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.position = "fixed";
    host.style.left = "-12000px";
    host.style.top = "0";
    host.style.width = "1080px";
    host.style.height = "1920px";
    host.style.overflow = "hidden";
    host.style.pointerEvents = "none";
    host.style.zIndex = "-2147483647";
    host.style.background = "#15160d";

    const clone = storyElement.cloneNode(true);
    clone.id = "story-export-clone";
    clone.classList.remove("shadow-2xl", "photo-edit-enabled", "is-dragging");
    clone.removeAttribute("title");
    clone.style.setProperty("position", "relative", "important");
    clone.style.setProperty("left", "0", "important");
    clone.style.setProperty("top", "0", "important");
    clone.style.setProperty("width", "1080px", "important");
    clone.style.setProperty("height", "1920px", "important");
    clone.style.setProperty("min-width", "1080px", "important");
    clone.style.setProperty("min-height", "1920px", "important");
    clone.style.setProperty("max-width", "none", "important");
    clone.style.setProperty("transform", "none", "important");
    clone.style.setProperty("transform-origin", "top left", "important");
    clone.style.setProperty("margin", "0", "important");
    clone.style.setProperty("border-radius", "0", "important");
    clone.style.setProperty("clip-path", "none", "important");
    clone.style.setProperty("overflow", "hidden", "important");
    clone.style.setProperty("box-shadow", "none", "important");
    clone.style.setProperty("touch-action", "auto", "important");
    clone.style.setProperty("cursor", "default", "important");

    clone.querySelectorAll("*").forEach((el) => {
      el.style.setProperty("transition", "none", "important");
      el.style.setProperty("animation", "none", "important");
      el.style.setProperty("backdrop-filter", "none", "important");
      el.style.setProperty("-webkit-backdrop-filter", "none", "important");
    });

    const cloneImage = clone.querySelector("#story-image-preview");
    const cloneBlur = clone.querySelector("#story-bg-blur");
    if (cloneImage && storyImage?.src) {
      cloneImage.src = storyImage.src;
      cloneImage.classList.remove("hidden");
      applyFrameToElement(cloneImage, cloneBlur, storyImage);
    }

    host.appendChild(clone);
    document.body.appendChild(host);
    return { host, clone };
  }

  async function gerarStoryPngDataUrl() {
    if (typeof domtoimage === "undefined") throw new Error("domtoimage não carregou.");
    if (!story) throw new Error("Não achei o Story para exportar.");

    updatePreviewText();
    applyImageSettingsAfterOtherHandlers();

    if (document.fonts?.ready) {
      await withTimeout(document.fonts.ready, 8000, "fontes").catch(() => undefined);
    }
    await waitForImages(story, 8000);

    const { host, clone } = prepareExportClone(story);

    try {
      await waitForImages(clone, 8000);
      await nextFrame();
      await nextFrame();

      const dataUrl = await withTimeout(
        domtoimage.toPng(clone, {
          width: 1080,
          height: 1920,
          cacheBust: true,
          bgcolor: "#15160d",
          style: {
            width: "1080px",
            height: "1920px",
            minWidth: "1080px",
            minHeight: "1920px",
            maxWidth: "none",
            transform: "none",
            transformOrigin: "top left",
            margin: "0",
            borderRadius: "0",
            clipPath: "none",
            overflow: "hidden",
            boxShadow: "none"
          }
        }),
        30000,
        "geração do PNG em 1080x1920"
      );

      if (!dataUrl || !dataUrl.startsWith("data:image/png")) {
        throw new Error("PNG inválido.");
      }
      return dataUrl;
    } finally {
      host.remove();
    }
  }

  async function dataUrlToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    if (!blob || blob.size === 0) throw new Error("Arquivo PNG vazio.");
    return blob.type === "image/png" ? blob : blob.slice(0, blob.size, "image/png");
  }

  async function gerarStoryBlob(forceNew = false) {
    const now = Date.now();
    if (!forceNew && LAST_STORY_BLOB && now - LAST_STORY_CREATED_AT < 120000) {
      return LAST_STORY_BLOB;
    }

    const dataUrl = await gerarStoryPngDataUrl();
    const blob = await dataUrlToBlob(dataUrl);
    LAST_STORY_BLOB = blob;
    LAST_STORY_CREATED_AT = Date.now();
    return blob;
  }

  function baixarBlobPng(blob, nomeArquivo = "story-assessoria-imobiliaria-1080x1920.png") {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  const downloadBtn = $("download-story");
  const postBtn = $("post-story");
  const fileName = "story-assessoria-imobiliaria-1080x1920.png";

  downloadBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const original = downloadBtn.textContent;
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Gerando 1080×1920...";

    try {
      const blob = await gerarStoryBlob(true);
      baixarBlobPng(blob, fileName);
      alert("✅ PNG 1080×1920 gerado.");
    } catch (err) {
      console.error(err);
      alert("Falhou ao baixar PNG: " + (err?.message || err));
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = original || "Baixar PNG";
    }
  });

  postBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const original = postBtn.textContent;
    postBtn.disabled = true;
    postBtn.textContent = "Preparando 1080×1920...";

    try {
      const blob = await gerarStoryBlob(false);
      const file = new File([blob], fileName, { type: "image/png" });

      if (isMobile() && navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Story - Assessoria Imobiliária",
            text: "Postar no Instagram Stories"
          });
          return;
        } catch (shareError) {
          if (shareError?.name === "AbortError") return;
          console.warn("Compartilhamento direto não abriu:", shareError);
        }
      }

      baixarBlobPng(blob, fileName);

      if (!isMobile()) {
        window.open("https://www.instagram.com/", "_blank");
        alert("PNG salvo. No Instagram: Criar → Story → escolher o arquivo.");
      } else {
        alert("PNG 1080×1920 salvo. Abra o Instagram e escolha o arquivo na galeria.");
      }
    } catch (err) {
      console.error(err);
      alert("Falhou ao preparar o Story: " + (err?.message || err));
    } finally {
      postBtn.disabled = false;
      postBtn.textContent = original || "Postar no Story";
    }
  });
});
