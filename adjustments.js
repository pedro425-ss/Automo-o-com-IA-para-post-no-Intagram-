document.addEventListener("DOMContentLoaded", () => {
  // Carrega as melhorias visuais mobile sem depender do HTML.
  if (!document.querySelector('link[href="./mobile.css"]')) {
    const mobileCss = document.createElement("link");
    mobileCss.rel = "stylesheet";
    mobileCss.href = "./mobile.css";
    document.head.appendChild(mobileCss);
  }

  const image = document.getElementById("story-image-preview");
  const imageFit = document.getElementById("image-fit");
  const containBg = document.getElementById("contain-bg");
  const posX = document.getElementById("pos-x");
  const posY = document.getElementById("pos-y");
  const zoom = document.getElementById("zoom");
  const zoomValue = document.getElementById("zoom-value");
  const posXValue = document.getElementById("pos-x-value");
  const posYValue = document.getElementById("pos-y-value");
  const resetButton = document.getElementById("reset-adjustments");
  const presetButtons = document.querySelectorAll(".frame-preset");
  const story = document.getElementById("story-preview-wrapper");

  if (!image || !posX || !posY || !zoom || !story) return;

  const previewStage = story.parentElement;
  const previewShell = previewStage?.parentElement;
  const adjustmentPanel = document.querySelector(".adjustment-panel");
  const adjustmentSection = adjustmentPanel?.closest(".section");
  const desktopMount = previewShell?.parentElement;

  let mobileMount = document.getElementById("mobile-preview-mount");
  if (!mobileMount && adjustmentPanel && adjustmentSection) {
    mobileMount = document.createElement("div");
    mobileMount.id = "mobile-preview-mount";
    mobileMount.className = "mobile-preview-mount";
    adjustmentPanel.parentElement.insertBefore(mobileMount, adjustmentPanel);
  }

  if (previewShell) previewShell.classList.add("story-preview-shell");
  if (previewStage) previewStage.classList.add("story-preview-stage");
  if (desktopMount) desktopMount.id = desktopMount.id || "desktop-preview-mount";

  const mobileQuery = window.matchMedia("(max-width: 899px)");

  function updateLabels() {
    if (zoomValue) zoomValue.textContent = `${zoom.value}%`;
    if (posXValue) posXValue.textContent = `${posX.value}%`;
    if (posYValue) posYValue.textContent = `${posY.value}%`;
  }

  function applyProfessionalAdjustments() {
    const zoomScale = Number(zoom.value || 100) / 100;
    const x = Number(posX.value || 50);
    const y = Number(posY.value || 50);

    image.style.transformOrigin = `${x}% ${y}%`;
    image.style.transform = `scale(${zoomScale})`;
    updateLabels();
  }

  function notifyMainScript() {
    posX.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function resizePreview() {
    if (!previewShell || !previewStage) return;

    if (mobileQuery.matches) {
      // Remove os 360x640 fixos do HTML e usa a largura real do aparelho.
      previewShell.style.width = "min(100%, 330px)";
      previewShell.style.maxWidth = "100%";
      previewShell.style.overflow = "hidden";
      previewShell.style.borderRadius = "22px";

      const width = previewShell.clientWidth || Math.min(window.innerWidth - 40, 330);
      const scale = width / 1080;
      previewStage.style.transform = `scale(${scale})`;
      previewStage.style.transformOrigin = "top left";
      previewShell.style.height = `${1920 * scale}px`;
    } else {
      previewShell.style.width = "360px";
      previewShell.style.height = "640px";
      previewShell.style.maxWidth = "none";
      previewShell.style.borderRadius = "32px";
      previewStage.style.transform = "scale(0.3333333333)";
      previewStage.style.transformOrigin = "top left";
    }
  }

  function placePreview() {
    if (!previewShell || !desktopMount || !mobileMount) return;

    if (mobileQuery.matches) {
      if (previewShell.parentElement !== mobileMount) {
        mobileMount.appendChild(previewShell);
      }
    } else if (previewShell.parentElement !== desktopMount) {
      desktopMount.appendChild(previewShell);
    }

    requestAnimationFrame(resizePreview);
  }

  zoom.addEventListener("input", () => {
    applyProfessionalAdjustments();
    notifyMainScript();
  });

  zoom.addEventListener("change", () => {
    applyProfessionalAdjustments();
    notifyMainScript();
  });

  [posX, posY].forEach((control) => {
    control.addEventListener("input", applyProfessionalAdjustments);
    control.addEventListener("change", applyProfessionalAdjustments);
  });

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const x = button.dataset.x;
      const y = button.dataset.y;
      if (x != null) posX.value = x;
      if (y != null) posY.value = y;

      posX.dispatchEvent(new Event("input", { bubbles: true }));
      posY.dispatchEvent(new Event("input", { bubbles: true }));
      applyProfessionalAdjustments();
    });
  });

  resetButton?.addEventListener("click", () => {
    if (imageFit) imageFit.value = "cover";
    if (containBg) containBg.value = "true";
    zoom.value = "100";
    posX.value = "50";
    posY.value = "50";

    imageFit?.dispatchEvent(new Event("change", { bubbles: true }));
    containBg?.dispatchEvent(new Event("change", { bubbles: true }));
    posX.dispatchEvent(new Event("input", { bubbles: true }));
    posY.dispatchEvent(new Event("input", { bubbles: true }));

    applyProfessionalAdjustments();
  });

  image.addEventListener("load", applyProfessionalAdjustments);

  if (typeof ResizeObserver !== "undefined" && previewShell) {
    const observer = new ResizeObserver(() => resizePreview());
    observer.observe(previewShell);
  }

  mobileQuery.addEventListener?.("change", placePreview);
  window.addEventListener("resize", resizePreview);
  window.addEventListener("orientationchange", () => setTimeout(resizePreview, 150));

  applyProfessionalAdjustments();
  placePreview();
});