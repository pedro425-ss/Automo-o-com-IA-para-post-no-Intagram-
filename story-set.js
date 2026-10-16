(() => {
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function injectStorySetStyles() {
    if ($("story-set-style")) return;

    const style = document.createElement("style");
    style.id = "story-set-style";
    style.textContent = `
      .story-set-box{
        margin-top:14px;
        padding:14px;
        border-radius:16px;
        border:1px solid rgba(255,255,255,.09);
        background:rgba(255,255,255,.035);
      }
      .story-set-title{
        margin-bottom:8px;
        color:#f8d78c;
        font-size:13px;
        font-weight:900;
      }
      .story-set-copy{
        margin-bottom:12px;
        font-size:12px;
        line-height:1.45;
        opacity:.72;
      }
      .story-set-actions{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }
      .story-set-nav{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:8px;
        margin-top:12px;
      }
      .story-set-nav.hidden{display:none !important}
      .story-set-tab{
        min-height:42px;
        border:1px solid rgba(255,255,255,.11);
        border-radius:12px;
        background:rgba(75,79,42,.48);
        color:#fff;
        font-size:12px;
        font-weight:900;
        cursor:pointer;
      }
      .story-set-tab.is-active{
        border-color:rgba(200,139,58,.65);
        background:rgba(200,139,58,.28);
        color:#f8d78c;
      }
      .story-set-status{
        min-height:18px;
        margin-top:9px;
        font-size:11px;
        line-height:1.4;
        opacity:.72;
      }
      .multi-photo-hint{
        margin-top:6px;
        font-size:11px;
        line-height:1.35;
        opacity:.65;
      }
      .story-gallery-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:14px;
        width:100%;
        margin:0 0 24px;
      }
      .story-gallery-grid.hidden{display:none !important}
      .story-gallery-grid img{
        display:block;
        width:100%;
        height:220px;
        object-fit:cover;
        border-radius:22px;
        border:2px solid rgba(255,255,255,.16);
        box-shadow:0 9px 28px rgba(0,0,0,.22);
      }
      .story-gallery-mode .story-description{
        margin-bottom:22px;
        max-height:105px;
        font-size:32px;
      }
      .story-gallery-mode .story-features{
        margin-bottom:20px;
      }
      .story-gallery-mode .story-features span{
        font-size:21px;
        padding:8px 13px;
      }
      .story-gallery-mode .story-title{
        font-size:66px;
        margin-bottom:18px;
      }
      .story-gallery-mode .story-price{
        font-size:54px;
        margin-bottom:22px;
      }
      .story-gallery-mode .story-meta{
        margin-bottom:22px;
      }
      @media(max-width:899px){
        .story-set-actions{grid-template-columns:1fr}
        .story-set-actions .btn{min-height:50px}
        .story-set-tab{min-height:46px;font-size:12px}
      }
    `;
    document.head.appendChild(style);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function waitForImages(root, timeoutMs = 8000) {
    const images = [...root.querySelectorAll("img")].filter((img) => img.src);
    await Promise.all(images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return Promise.race([
        new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        }),
        wait(timeoutMs)
      ]);
    }));
  }

  function dataUrlToBlob(dataUrl) {
    return fetch(dataUrl).then((response) => response.blob());
  }

  async function exportCurrentStoryBlob() {
    if (typeof domtoimage === "undefined") {
      throw new Error("Gerador de PNG não carregou.");
    }

    const story = $("story-preview-wrapper");
    if (!story) throw new Error("Preview do Story não encontrado.");

    if (document.fonts?.ready) {
      await Promise.race([document.fonts.ready, wait(6000)]).catch(() => undefined);
    }
    await waitForImages(story, 8000);

    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    Object.assign(host.style, {
      position: "fixed",
      left: "-12000px",
      top: "0",
      width: "1080px",
      height: "1920px",
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: "-2147483647",
      background: "#15160d"
    });

    const clone = story.cloneNode(true);
    clone.id = "story-set-export-clone";
    clone.classList.remove("shadow-2xl");
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

    clone.querySelectorAll("*").forEach((el) => {
      el.style.setProperty("transition", "none", "important");
      el.style.setProperty("animation", "none", "important");
      el.style.setProperty("backdrop-filter", "none", "important");
      el.style.setProperty("-webkit-backdrop-filter", "none", "important");
    });

    host.appendChild(clone);
    document.body.appendChild(host);

    try {
      await waitForImages(clone, 8000);
      await wait(80);

      const dataUrl = await Promise.race([
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
        new Promise((_, reject) => setTimeout(() => reject(new Error("Tempo esgotado ao gerar o PNG.")), 30000))
      ]);

      if (!dataUrl?.startsWith("data:image/png")) {
        throw new Error("PNG inválido.");
      }
      return dataUrlToBlob(dataUrl);
    } finally {
      host.remove();
    }
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectStorySetStyles();

    const uploadInput = $("image-upload-story");
    const storyImage = $("story-image-preview");
    const story = $("story-preview-wrapper");
    const storyContent = story?.querySelector(".story-content");
    const storyFeatures = $("story-features");
    const storyBadge = $("story-badge");
    const storyTitle = $("story-title");
    const storyPrice = $("story-price");
    const storyLocation = $("story-location");
    const storyArea = $("story-area");
    const storyDescription = $("story-description");
    const storyContact = $("story-contact");

    if (!uploadInput || !storyImage || !story || !storyContent) return;

    uploadInput.multiple = true;

    if (!document.querySelector(".multi-photo-hint")) {
      const hint = document.createElement("div");
      hint.className = "multi-photo-hint";
      hint.textContent = "Você pode selecionar várias fotos. A primeira será usada como capa.";
      uploadInput.insertAdjacentElement("afterend", hint);
    }

    let galleryGrid = $("story-gallery-grid");
    if (!galleryGrid) {
      galleryGrid = document.createElement("div");
      galleryGrid.id = "story-gallery-grid";
      galleryGrid.className = "story-gallery-grid hidden";
      const cta = storyContent.querySelector(".story-cta");
      if (cta) storyContent.insertBefore(galleryGrid, cta);
      else storyContent.appendChild(galleryGrid);
    }

    const downloadButton = $("download-story");
    const actionSection = downloadButton?.closest(".section");
    if (!actionSection) return;

    let storySetBox = $("story-set-box");
    if (!storySetBox) {
      storySetBox = document.createElement("div");
      storySetBox.id = "story-set-box";
      storySetBox.className = "story-set-box";
      storySetBox.innerHTML = `
        <div class="story-set-title">Pacote de Stories</div>
        <div class="story-set-copy">Selecione várias fotos e gere automaticamente uma capa, uma galeria e um Story final de contato.</div>
        <div class="story-set-actions">
          <button id="build-story-set" class="btn btn-green" type="button">Gerar 3 Stories</button>
          <button id="download-story-set" class="btn btn-gold" type="button">Baixar 3 PNGs</button>
        </div>
        <div id="story-set-nav" class="story-set-nav hidden">
          <button type="button" class="story-set-tab is-active" data-story-slide="0">Story 1</button>
          <button type="button" class="story-set-tab" data-story-slide="1">Story 2</button>
          <button type="button" class="story-set-tab" data-story-slide="2">Story 3</button>
        </div>
        <div id="story-set-status" class="story-set-status"></div>
      `;
      actionSection.appendChild(storySetBox);
    }

    const buildButton = $("build-story-set");
    const downloadSetButton = $("download-story-set");
    const nav = $("story-set-nav");
    const status = $("story-set-status");

    let uploadedImages = [];
    let slides = [];
    let activeIndex = 0;

    function getFeatures() {
      return [...document.querySelectorAll(".feature")]
        .filter((item) => item.checked)
        .map((item) => item.value)
        .slice(0, 6);
    }

    function getBaseData() {
      const district = $("district")?.value?.trim() || "";
      const city = $("city")?.value?.trim() || "";
      return {
        badge: $("badge")?.value?.trim() || "IMÓVEL À VENDA",
        title: $("title")?.value?.trim() || "Título do imóvel",
        price: $("price")?.value?.trim() || "R$ 0,00",
        location: district && city ? `${district} - ${city}` : district || city || "Região - Cidade",
        area: $("area")?.value?.trim() || "Área",
        description: $("description")?.value?.trim() || "Descrição do imóvel",
        contact: $("contact")?.value?.trim() || "@assessoriaimobiliaria",
        features: getFeatures()
      };
    }

    function buildSlides() {
      const base = getBaseData();
      const images = uploadedImages.length
        ? uploadedImages
        : (storyImage.src ? [storyImage.src] : []);

      if (!images.length) return [];

      const gallery = images.slice(0, 4);
      while (gallery.length < 4 && images[0]) gallery.push(images[gallery.length % images.length] || images[0]);

      return [
        {
          type: "cover",
          image: images[0],
          badge: base.badge,
          title: base.title,
          price: base.price,
          location: base.location,
          area: base.area,
          description: base.description,
          features: base.features.slice(0, 4)
        },
        {
          type: "gallery",
          image: images[1] || images[0],
          badge: "MAIS FOTOS",
          title: base.title,
          price: "Veja por dentro",
          location: base.location,
          area: base.area,
          description: "Confira alguns detalhes deste imóvel.",
          features: base.features.slice(0, 3),
          gallery
        },
        {
          type: "contact",
          image: images[2] || images[1] || images[0],
          badge: "FALE CONOSCO",
          title: base.title,
          price: "Agende sua visita",
          location: base.location,
          area: base.area,
          description: "Entre em contato para receber mais informações, fotos e condições deste imóvel.",
          features: base.features.slice(0, 3),
          contact: base.contact
        }
      ];
    }

    async function setStoryImage(src) {
      if (!src) return;
      if (storyImage.src === src && storyImage.complete) return;

      await new Promise((resolve) => {
        const done = () => resolve();
        storyImage.addEventListener("load", done, { once: true });
        storyImage.addEventListener("error", done, { once: true });
        storyImage.src = src;
        storyImage.classList.remove("hidden");
        setTimeout(resolve, 4000);
      });
    }

    function setActiveTab(index) {
      nav?.querySelectorAll(".story-set-tab").forEach((button, buttonIndex) => {
        button.classList.toggle("is-active", buttonIndex === index);
      });
    }

    async function renderSlide(index) {
      const slide = slides[index];
      if (!slide) return;
      activeIndex = index;

      if (storyBadge) storyBadge.textContent = slide.badge;
      if (storyTitle) storyTitle.textContent = slide.title;
      if (storyPrice) storyPrice.textContent = slide.price;
      if (storyLocation) storyLocation.textContent = slide.location;
      if (storyArea) storyArea.textContent = slide.area;
      if (storyDescription) storyDescription.textContent = slide.description;
      if (storyContact) storyContact.textContent = slide.contact || $("contact")?.value || "@assessoriaimobiliaria";

      if (storyFeatures) {
        storyFeatures.innerHTML = (slide.features || [])
          .slice(0, 4)
          .map((item) => `<span>${item}</span>`)
          .join("");
      }

      story.classList.toggle("story-gallery-mode", slide.type === "gallery");

      if (slide.type === "gallery" && slide.gallery?.length) {
        galleryGrid.innerHTML = slide.gallery
          .map((src, imageIndex) => `<img src="${src}" alt="Foto ${imageIndex + 1} do imóvel" />`)
          .join("");
        galleryGrid.classList.remove("hidden");
      } else {
        galleryGrid.innerHTML = "";
        galleryGrid.classList.add("hidden");
      }

      await setStoryImage(slide.image);

      const posX = $("pos-x");
      const posY = $("pos-y");
      if (posX) posX.dispatchEvent(new Event("input", { bubbles: true }));
      if (posY) posY.dispatchEvent(new Event("input", { bubbles: true }));

      setActiveTab(index);
      if (status) status.textContent = `Visualizando Story ${index + 1} de ${slides.length}.`;
      await wait(100);
    }

    uploadInput.addEventListener("change", async (event) => {
      const files = [...(event.target.files || [])];
      if (!files.length) return;

      try {
        uploadedImages = await Promise.all(files.map(readFileAsDataUrl));
        slides = [];
        activeIndex = 0;
        nav?.classList.add("hidden");
        if (status) status.textContent = `${uploadedImages.length} foto(s) carregada(s). Clique em “Gerar 3 Stories”.`;
      } catch (error) {
        console.error("Erro ao ler as fotos:", error);
        if (status) status.textContent = "Não foi possível carregar todas as fotos.";
      }
    });

    buildButton?.addEventListener("click", async () => {
      slides = buildSlides();
      if (!slides.length) {
        alert("Selecione pelo menos uma foto antes de gerar os Stories.");
        return;
      }

      nav?.classList.remove("hidden");
      await renderSlide(0);
      if (status) status.textContent = "3 Stories gerados. Use os botões Story 1, 2 e 3 para conferir.";
    });

    nav?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-story-slide]");
      if (!button) return;
      await renderSlide(Number(button.dataset.storySlide || 0));
    });

    downloadSetButton?.addEventListener("click", async () => {
      slides = slides.length ? slides : buildSlides();
      if (!slides.length) {
        alert("Selecione pelo menos uma foto antes de baixar o pacote.");
        return;
      }

      const originalText = downloadSetButton.textContent;
      const originalIndex = activeIndex;
      downloadSetButton.disabled = true;

      try {
        const files = [];
        for (let i = 0; i < slides.length; i += 1) {
          downloadSetButton.textContent = `Gerando ${i + 1}/3...`;
          await renderSlide(i);
          const blob = await exportCurrentStoryBlob();
          files.push(new File([blob], `story-${i + 1}-assessoria-imobiliaria.png`, { type: "image/png" }));
        }

        const canShareFiles = navigator.share && navigator.canShare?.({ files });
        if (canShareFiles) {
          try {
            await navigator.share({
              files,
              title: "3 Stories - Assessoria Imobiliária",
              text: "Pacote com 3 Stories do imóvel"
            });
          } catch (shareError) {
            if (shareError?.name !== "AbortError") throw shareError;
          }
        } else {
          files.forEach((file, index) => downloadBlob(file, `story-${index + 1}-assessoria-imobiliaria.png`));
          alert("✅ Os 3 PNGs foram gerados.");
        }
      } catch (error) {
        console.error("Erro ao gerar pacote de Stories:", error);
        alert("Não foi possível gerar os 3 Stories: " + (error?.message || error));
      } finally {
        await renderSlide(Math.min(originalIndex, slides.length - 1));
        downloadSetButton.disabled = false;
        downloadSetButton.textContent = originalText || "Baixar 3 PNGs";
      }
    });
  });
})();
