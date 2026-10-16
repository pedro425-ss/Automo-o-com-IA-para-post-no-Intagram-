(() => {
  const $ = (id) => document.getElementById(id);

  async function getBackendBuild() {
    try {
      const response = await fetch("/api/version", { cache: "no-store" });
      const json = await response.json();
      return json.build || "desconhecido";
    } catch {
      return "sem-versao";
    }
  }

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
    const imageSource =
      data.imagem ||
      data.imageBase64 ||
      data.image ||
      data.imageUrl ||
      data.imagemUrl ||
      (Array.isArray(data.images) ? data.images[0] : "");

    if (storyImage && imageSource) {
      if (!String(imageSource).startsWith("data:")) storyImage.crossOrigin = "anonymous";
      storyImage.src = imageSource;
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
        const backendBuild = await getBackendBuild();
        console.log("🧩 Backend build:", backendBuild);

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
                imagem:
                  json.imagem ||
                  json.imageBase64 ||
                  json.image ||
                  json.dados?.imagem ||
                  "",
                imagemUrl:
                  json.imagemUrl ||
                  json.imageUrl ||
                  json.dados?.imagemUrl ||
                  "",
              }
            : json;

          const applied = applyListingData(data);

          if (!response.ok) {
            if (applied > 0) {
              alert("Consegui preencher alguns dados do imóvel, mas a imagem principal não ficou disponível.");
              return;
            }
            const candidateHint = Array.isArray(json.candidatos) && json.candidatos.length
              ? " O site respondeu com imagens candidatas, mas bloqueou o download automático."
              : "";
            throw new Error((json.erro || "Não foi possível analisar este anúncio.") + candidateHint);
          }

          if (!applied) {
            const resolved = json.urlResolvida || data.urlResolvida || "";
            alert(resolved
              ? "A página foi localizada, mas o site não entregou os dados em formato legível para o preenchimento automático.\n\nVersão do backend: " + backendBuild
              : "O anúncio abriu, mas não encontrei informações que eu pudesse preencher automaticamente.\n\nVersão do backend: " + backendBuild);
            return;
          }

          if (json.aviso && applied > 0) {
            console.warn(json.aviso);
          }

          const found = [];
          if (data.imagem || data.imagemUrl || data.imageUrl) found.push("foto");
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
