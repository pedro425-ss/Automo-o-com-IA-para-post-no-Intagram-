(() => {
  const $ = (id) => document.getElementById(id);

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function setField(id, value) {
    const field = $(id);
    if (!field || value === undefined || value === null) return false;

    const text = String(value).trim();
    if (!text) return false;

    field.value = text;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function applyFeatures(features) {
    if (!Array.isArray(features) || !features.length) return;

    const wanted = features.map(normalize);
    document.querySelectorAll(".feature").forEach((checkbox) => {
      const shouldCheck = wanted.includes(normalize(checkbox.value));
      if (shouldCheck && !checkbox.checked) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  function applyListingData(data) {
    let count = 0;
    if (setField("title", data.titulo)) count++;
    if (setField("price", data.preco)) count++;
    if (setField("city", data.cidade)) count++;
    if (setField("district", data.bairro)) count++;
    if (setField("area", data.area)) count++;
    if (setField("description", data.descricao)) count++;

    applyFeatures(data.diferenciais);

    const storyImage = $("story-image-preview");
    if (storyImage && data.imagem) {
      storyImage.crossOrigin = "anonymous";
      storyImage.src = data.imagem;
      storyImage.classList.remove("hidden");
      count++;
    }

    if (typeof window.invalidateStoryCache === "function") {
      window.invalidateStoryCache();
    } else if (typeof invalidateStoryCache === "function") {
      invalidateStoryCache();
    }

    return count;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const button = $("buscar-imagem-ia");
    if (!button) return;

    button.addEventListener(
      "click",
      async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const url = $("imovel-url")?.value?.trim();
        if (!url) {
          alert("Cole a URL do imóvel");
          return;
        }

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Buscando dados...";

        try {
          const response = await fetch(`${window.location.origin}/analisar-imovel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });

          const json = await response.json().catch(() => ({}));
          const data = json.dados
            ? {
                ...json.dados,
                imagem: json.imagem || "",
              }
            : json;

          const applied = applyListingData(data);

          if (!response.ok) {
            if (applied > 0) {
              alert("Consegui preencher alguns dados, mas não encontrei a imagem principal.");
              return;
            }
            throw new Error(json.erro || "Não foi possível analisar este anúncio.");
          }

          if (!applied) {
            alert("O anúncio abriu, mas não encontrei informações que eu pudesse preencher automaticamente.");
            return;
          }

          const found = [];
          if (data.imagem) found.push("foto");
          if (data.titulo) found.push("título");
          if (data.preco) found.push("preço");
          if (data.cidade || data.bairro) found.push("localização");
          if (data.area) found.push("área");
          if (data.descricao) found.push("descrição");

          button.textContent = "Dados preenchidos ✓";
          setTimeout(() => {
            button.textContent = originalText || "Buscar imagem e dados";
          }, 1800);

          console.log("✅ Dados automáticos encontrados:", found);
        } catch (error) {
          console.error("Erro no preenchimento automático:", error);
          alert(error?.message || "Erro ao buscar os dados do imóvel.");
        } finally {
          button.disabled = false;
          if (button.textContent === "Buscando dados...") {
            button.textContent = originalText || "Buscar imagem e dados";
          }
        }
      },
      true
    );
  });
})();
