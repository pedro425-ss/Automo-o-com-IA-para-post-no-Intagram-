(() => {
  const DB_NAME = "assessoria-imoveis-db";
  const DB_VERSION = 1;
  const STORE_NAME = "properties";
  const $ = (id) => document.getElementById(id);

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("code", "code", { unique: true });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Não foi possível abrir o banco local."));
    });
  }

  async function withStore(mode, callback) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        let result;

        try {
          result = callback(store, resolve, reject);
        } catch (error) {
          reject(error);
          return;
        }

        if (result && typeof result.then === "function") {
          result.then(resolve).catch(reject);
        }

        tx.onerror = () => reject(tx.error || new Error("Erro no banco local."));
      });
    } finally {
      db.close();
    }
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAllProperties() {
    return withStore("readonly", (store) => requestToPromise(store.getAll()));
  }

  async function getProperty(id) {
    return withStore("readonly", (store) => requestToPromise(store.get(id)));
  }

  async function putProperty(property) {
    return withStore("readwrite", (store) => requestToPromise(store.put(property)));
  }

  async function deleteProperty(id) {
    return withStore("readwrite", (store) => requestToPromise(store.delete(id)));
  }

  function editorFieldsSnapshot() {
    const fields = {};
    const excludedIds = new Set([
      "property-code",
      "property-search",
      "draft-selector",
      "image-upload-story",
      "logo-upload-story"
    ]);

    document.querySelectorAll(".panel input[id], .panel textarea[id], .panel select[id]").forEach((el) => {
      if (excludedIds.has(el.id) || el.type === "file") return;
      if (el.classList.contains("feature")) return;

      if (el.type === "checkbox" || el.type === "radio") {
        fields[el.id] = { type: el.type, checked: Boolean(el.checked), value: el.value };
      } else {
        fields[el.id] = { type: el.tagName.toLowerCase(), value: el.value };
      }
    });

    return fields;
  }

  function snapshotCurrentProperty(code) {
    const story = $("story-preview-wrapper");
    const storyImage = $("story-image-preview");
    const features = [...document.querySelectorAll(".feature")].map((el) => ({
      value: el.value,
      checked: Boolean(el.checked),
    }));

    return {
      id: normalize(code).replace(/\s+/g, "-"),
      code: String(code || "").trim().toUpperCase(),
      title: $("title")?.value?.trim() || "Imóvel sem título",
      price: $("price")?.value?.trim() || "",
      city: $("city")?.value?.trim() || "",
      district: $("district")?.value?.trim() || "",
      area: $("area")?.value?.trim() || "",
      description: $("description")?.value?.trim() || "",
      fields: editorFieldsSnapshot(),
      features,
      imageSrc: storyImage?.src || "",
      template: story?.dataset?.storyTemplate || "venda",
      updatedAt: new Date().toISOString(),
    };
  }

  function fire(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function applyRecord(record) {
    if (!record) return;

    Object.entries(record.fields || {}).forEach(([id, saved]) => {
      const el = $(id);
      if (!el) return;

      if (saved?.type === "checkbox" || saved?.type === "radio") {
        el.checked = Boolean(saved.checked);
      } else if (saved && Object.prototype.hasOwnProperty.call(saved, "value")) {
        el.value = saved.value ?? "";
      }
      fire(el);
    });

    const featureMap = new Map((record.features || []).map((item) => [item.value, Boolean(item.checked)]));
    document.querySelectorAll(".feature").forEach((el) => {
      el.checked = Boolean(featureMap.get(el.value));
      fire(el);
    });

    const storyImage = $("story-image-preview");
    if (storyImage && record.imageSrc) {
      storyImage.crossOrigin = "anonymous";
      storyImage.src = record.imageSrc;
      storyImage.classList.remove("hidden");
    }

    const templateButton = document.querySelector(`[data-template="${CSS.escape(record.template || "venda")}"]`);
    templateButton?.click();

    const codeInput = $("property-code");
    if (codeInput) codeInput.value = record.code || "";

    const status = $("property-status");
    if (status) status.textContent = `Imóvel ${record.code || ""} carregado no editor.`;

    try {
      if (typeof invalidateStoryCache === "function") invalidateStoryCache();
    } catch {}
  }

  function injectStyles() {
    if ($("property-panel-styles")) return;
    const style = document.createElement("style");
    style.id = "property-panel-styles";
    style.textContent = `
      .property-panel{margin-top:12px;padding:14px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035)}
      .property-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
      .property-title{font-size:13px;font-weight:900;color:#f8d78c}
      .property-subtitle{margin-top:4px;font-size:11px;line-height:1.4;opacity:.68}
      .property-count{min-width:60px;padding:5px 8px;border-radius:999px;background:rgba(200,139,58,.14);border:1px solid rgba(200,139,58,.28);color:#f8d78c;font-size:11px;font-weight:900;text-align:center}
      .property-top-grid{display:grid;grid-template-columns:.65fr 1.35fr;gap:8px}
      .property-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
      .property-btn{min-height:44px;border:1px solid rgba(255,255,255,.11);border-radius:12px;padding:9px 10px;background:rgba(255,255,255,.06);color:#fff;font-size:12px;font-weight:900;cursor:pointer}
      .property-btn-primary{background:#c88b3a;border-color:#c88b3a}
      .property-status{min-height:18px;margin-top:8px;font-size:11px;line-height:1.4;opacity:.72}
      .property-list{display:grid;gap:8px;margin-top:12px;max-height:430px;overflow:auto;padding-right:2px}
      .property-card{padding:11px;border-radius:13px;border:1px solid rgba(255,255,255,.09);background:rgba(0,0,0,.16)}
      .property-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .property-code{font-size:12px;font-weight:900;color:#f8d78c}
      .property-name{margin-top:3px;font-size:13px;font-weight:800;line-height:1.25}
      .property-meta{margin-top:5px;font-size:11px;line-height:1.35;opacity:.68}
      .property-card-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:9px}
      .property-card-actions button{min-height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.055);color:#fff;font-size:11px;font-weight:800;cursor:pointer}
      .property-card-actions button[data-action="story"]{background:rgba(200,139,58,.18);border-color:rgba(200,139,58,.35);color:#f8d78c}
      .property-card-actions button[data-action="delete"]{color:#ffb4b4}
      .property-empty{padding:14px;border-radius:12px;border:1px dashed rgba(255,255,255,.1);font-size:11px;line-height:1.4;text-align:center;opacity:.65}
      @media(max-width:899px){
        .property-panel{padding:12px}
        .property-top-grid{grid-template-columns:1fr}
        .property-actions{grid-template-columns:1fr}
        .property-btn{min-height:48px;font-size:13px}
        .property-card-actions{grid-template-columns:1fr 1fr}
        .property-card-actions button[data-action="delete"]{grid-column:1/-1}
      }
    `;
    document.head.appendChild(style);
  }

  function buildUi() {
    if ($("property-panel")) return;

    const panelHost = document.querySelector(".panel");
    if (!panelHost) return;

    const panel = document.createElement("div");
    panel.id = "property-panel";
    panel.className = "property-panel";
    panel.innerHTML = `
      <div class="property-head">
        <div>
          <div class="property-title">Imóveis salvos</div>
          <div class="property-subtitle">Salve por código, procure depois e carregue o imóvel no editor com um toque.</div>
        </div>
        <div id="property-count" class="property-count">0</div>
      </div>
      <div class="property-top-grid">
        <input id="property-code" class="input" placeholder="Código. Ex: A123" autocomplete="off" />
        <input id="property-search" class="input" placeholder="Buscar código, título, bairro ou cidade" autocomplete="off" />
      </div>
      <div class="property-actions">
        <button id="property-save" type="button" class="property-btn property-btn-primary">Salvar / atualizar imóvel</button>
        <button id="property-clear-search" type="button" class="property-btn">Mostrar todos</button>
      </div>
      <div id="property-status" class="property-status"></div>
      <div id="property-list" class="property-list"></div>
    `;

    const workflowPanel = $("workflow-panel");
    const templatePanel = $("story-template-panel");
    if (workflowPanel?.parentElement) {
      workflowPanel.insertAdjacentElement("afterend", panel);
    } else if (templatePanel?.parentElement) {
      templatePanel.insertAdjacentElement("afterend", panel);
    } else {
      const firstSection = panelHost.querySelector(".section");
      panelHost.insertBefore(panel, firstSection || null);
    }
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      }).format(new Date(value));
    } catch {
      return "";
    }
  }

  async function renderList() {
    const list = $("property-list");
    const count = $("property-count");
    if (!list) return;

    let records = await getAllProperties();
    records.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

    const query = normalize($("property-search")?.value || "");
    if (query) {
      records = records.filter((record) => normalize([
        record.code,
        record.title,
        record.city,
        record.district,
        record.price
      ].join(" ")).includes(query));
    }

    if (count) count.textContent = String(records.length);

    if (!records.length) {
      list.innerHTML = `<div class="property-empty">Nenhum imóvel encontrado. Preencha o editor, informe um código e toque em “Salvar / atualizar imóvel”.</div>`;
      return;
    }

    list.innerHTML = records.map((record) => {
      const location = [record.district, record.city].filter(Boolean).join(" - ");
      return `
        <div class="property-card" data-property-id="${escapeHtml(record.id)}">
          <div class="property-card-top">
            <div>
              <div class="property-code">${escapeHtml(record.code)}</div>
              <div class="property-name">${escapeHtml(record.title)}</div>
              <div class="property-meta">${escapeHtml([location, record.price, record.area].filter(Boolean).join(" • "))}</div>
            </div>
            <div class="property-meta">${escapeHtml(formatDate(record.updatedAt))}</div>
          </div>
          <div class="property-card-actions">
            <button type="button" data-action="open">Abrir</button>
            <button type="button" data-action="story">Gerar Story</button>
            <button type="button" data-action="delete">Excluir</button>
          </div>
        </div>
      `;
    }).join("");
  }

  async function saveCurrent() {
    const code = $("property-code")?.value?.trim();
    if (!code) {
      alert("Informe um código para o imóvel antes de salvar.");
      $("property-code")?.focus();
      return;
    }

    const record = snapshotCurrentProperty(code);
    if (!record.id) return;

    const existing = await getProperty(record.id);
    if (existing?.createdAt) record.createdAt = existing.createdAt;
    else record.createdAt = record.updatedAt;

    await putProperty(record);
    const status = $("property-status");
    if (status) status.textContent = `Imóvel ${record.code} salvo com sucesso.`;
    await renderList();
  }

  async function handleListClick(event) {
    const button = event.target.closest("button[data-action]");
    const card = event.target.closest("[data-property-id]");
    if (!button || !card) return;

    const id = card.dataset.propertyId;
    const action = button.dataset.action;
    const record = await getProperty(id);
    if (!record) return;

    if (action === "open") {
      applyRecord(record);
      document.querySelector("#story-preview-wrapper")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (action === "story") {
      applyRecord(record);
      const status = $("property-status");
      if (status) status.textContent = `Preparando Story do imóvel ${record.code}...`;
      setTimeout(() => $("download-story")?.click(), 450);
      return;
    }

    if (action === "delete") {
      const confirmed = confirm(`Excluir o imóvel ${record.code} - ${record.title}?`);
      if (!confirmed) return;
      await deleteProperty(id);
      if ($("property-code")?.value?.trim().toUpperCase() === record.code) {
        $("property-code").value = "";
      }
      const status = $("property-status");
      if (status) status.textContent = `Imóvel ${record.code} excluído.`;
      await renderList();
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!("indexedDB" in window)) return;

    injectStyles();
    buildUi();

    $("property-save")?.addEventListener("click", () => {
      saveCurrent().catch((error) => {
        console.error("Erro ao salvar imóvel:", error);
        alert("Não foi possível salvar o imóvel neste aparelho.");
      });
    });

    $("property-search")?.addEventListener("input", () => {
      renderList().catch(console.error);
    });

    $("property-clear-search")?.addEventListener("click", () => {
      if ($("property-search")) $("property-search").value = "";
      renderList().catch(console.error);
    });

    $("property-list")?.addEventListener("click", (event) => {
      handleListClick(event).catch((error) => {
        console.error("Erro no painel de imóveis:", error);
        alert("Não foi possível concluir esta ação.");
      });
    });

    try {
      await renderList();
    } catch (error) {
      console.error("Erro ao carregar imóveis salvos:", error);
      const status = $("property-status");
      if (status) status.textContent = "Não foi possível abrir os imóveis salvos neste navegador.";
    }
  });
})();