document.addEventListener("DOMContentLoaded", () => {
  const shell = document.getElementById("story-preview-shell");
  const stage = document.getElementById("story-preview-stage");
  const mobileMount = document.getElementById("mobile-preview-mount");
  const desktopMount = document.getElementById("desktop-preview-mount");

  if (!shell || !stage || !mobileMount || !desktopMount) return;

  const mobileQuery = window.matchMedia("(max-width: 899px)");

  function resizePreview() {
    const width = shell.clientWidth || 360;
    const scale = width / 1080;
    stage.style.transform = `scale(${scale})`;
    stage.style.transformOrigin = "top left";
    shell.style.height = `${1920 * scale}px`;
  }

  function placePreview() {
    if (mobileQuery.matches) {
      if (shell.parentElement !== mobileMount) mobileMount.appendChild(shell);
    } else {
      if (shell.parentElement !== desktopMount) desktopMount.appendChild(shell);
    }

    requestAnimationFrame(resizePreview);
  }

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => resizePreview());
    observer.observe(shell);
  }

  mobileQuery.addEventListener?.("change", placePreview);
  window.addEventListener("resize", resizePreview);
  window.addEventListener("orientationchange", () => setTimeout(resizePreview, 120));

  placePreview();
});
