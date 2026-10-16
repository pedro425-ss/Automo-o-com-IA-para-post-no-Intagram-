(() => {
  const DB_NAME = "assessoria-story-branding-v1";
  const DB_VERSION = 1;
  const STORE_NAME = "logos";
  const DEFAULT_KEY = "assessoria-story-default-logo-v1";
  const LEGACY_KEY = "assessoria-story-saved-logo-v1";
  const MAX_LOGOS = 12;
  const $ = (id) => document.getElementById(id);

  function invalidate() {
    try {
      if (typeof window.invalidateStoryCache === "function") window.invalidateStoryCache();
      else if (typeof invalidateStoryCache === "function") invalidateStoryCache();
    } catch {}
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Não foi possível abrir a biblioteca de logos."));
    });
  }

  async function runStore(mode, action) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        let request;
        try { request = action(store); } catch (error) { reject(error); return; }
        if (request) {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || new Error("Erro na biblioteca de logos."));
        } else {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error || new Error("Erro na biblioteca de logos."));
        }
      });
    } finally {
      db.close();
    }
  }

  const getAllLogos = () => runStore("readonly", (store) => store.getAll());
  const getLogo = (id) => runStore("readonly", (store) => store.get(id));
  const putLogo = (record) => runStore("readwrite", (store) => store.put(record));
  const deleteLogo = (id) => runStore("readwrite", (store) => store.delete(id));

  function getDefaultId() {
    try { return localStorage.getItem(DEFAULT_KEY) || ""; } catch { return ""; }
  }

  function setDefaultId(id) {
    try {
      if (id) localStorage.setItem(DEFAULT_KEY, id);
      else localStorage.removeItem(DEFAULT_KEY);
    } catch {}
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function injectStyles() {
    if ($("logo-library-style")) return;
    const style = document.createElement("style");
    style.id = "logo-library-style";
    style.textContent = `
      .logo-library{margin-top:12px;padding:14px;border-radius:16px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035)}
      .logo-library-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
      .logo-library-title{font-size:13px;font-weight:900;color:#f8d78c}
      .logo-library-subtitle{margin-top:4px;font-size:11px;line-height:1.35;opacity:.68}
      .logo-library-count{min-width:48px;padding:5px 8px;border-radius:999px;background:rgba(200,139,58,.14);border:1px solid rgba(200,139,58,.28);color:#f8d78c;font-size:11px;font-weight:900;text-align:center}
      .logo-library-add{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-bottom:12px}
      .logo-library-save{min-height:44px;border:1px solid rgba(200,139,58,.38);border-radius:12px;padding:9px 12px;background:rgba(200,139,58,.15);color:#f8d78c;font-size:12px;font-weight:900;cursor:pointer}
      .logo-library-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .logo-library-empty{grid-column:1/-1;padding:14px;border:1px dashed rgba(255,255,255,.13);border-radius:13px;font-size:11px;line-height:1.4;text-align:center;opacity:.68}
      .logo-card{min-width:0;padding:10px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(0,0,0,.15)}
      .logo-card.is-default{border-color:rgba(200,139,58,.55);box-shadow:0 0 0 1px rgba(200,139,58,.12) inset}
      .logo-card-main{display:flex;align-items:center;gap:9px;min-width:0;margin-bottom:9px}
      .logo-card-preview{width:54px;height:54px;flex:0 0 54px;padding:5px;border-radius:12px;background:#fff;object-fit:contain}
      .logo-card-copy{min-width:0;flex:1}
      .logo-card-name{font-size:12px;font-weight:900;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .logo-card-default{margin-top:4px;color:#f8d78c;font-size:10px;font-weight:800}
      .logo-card-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      .logo-card-btn{min-height:36px;border:1px solid rgba(255,255,255,.10);border-radius:10px;padding:7px 6px;background:rgba(255,255,255,.055);color:#fff;font-size:10px;font-weight:900;cursor:pointer}
      .logo-card-btn.primary{background:rgba(200,139,58,.18);border-color:rgba(200,139,58,.34);color:#f8d78c}
      .logo-card-btn.danger{grid-column:1/-1;color:#f2b7b7}
      .logo-library-note{margin-top:9px;font-size:10px;line-height:1.4;opacity:.58}
      @media(max-width:899px){
        .logo-library{padding:12px}
        .logo-library-add{grid-template-columns:1fr}
        .logo-library-save{min-height:48px;font-size:13px}
        .logo-library-list{grid-template-columns:1fr}
        .logo-card-btn{min-height:42px;font-size:11px}
      }
    `;
    document.head.appendChild(style);
  }

  function buildUi() {
    if ($("logo-library")) return;
    const advancedSection = $("story-advanced-section");
    if (!advancedSection) return;

    const actions = advancedSection.querySelector(".story-extra-actions");
    const library = document.createElement("div");
    library.id = "logo-library";
    library.className = "logo-library";
    library.innerHTML = `
      <div class="logo-library-head">
        <div>
          <div class="logo-library-title">Logos das imobiliárias</div>
          <div class="logo-library-subtitle">Salve seus logos uma vez e troque entre as imobiliárias com um toque.</div>
        </div>
        <div id="logo-library-count" class="logo-library-count">0/${MAX_LOGOS}</div>
      </div>
      <div class="logo-library-add">
        <input id="logo-library-name" class="input" maxlength="60" placeholder="Nome da imobiliária (ex: Villela Imóveis)" />
        <button id="logo-library-save-current" class="logo-library-save" type="button">Salvar logo atual</button>
      </div>
      <div id="logo-library-list" class="logo-library-list"></div>
      <div class="logo-library-note">O logo marcado como padrão é carregado automaticamente apenas neste aparelho/navegador. Os outros logos continuam disponíveis para troca rápida.</div>
    `;

    if (actions) advancedSection.insertBefore(library, actions);
    else advancedSection.appendChild(library);

    const oldRemove = $("remove-saved-logo");
    if (oldRemove) oldRemove.textContent = "Ocultar logo deste Story";
  }

  function applyLogo(record) {
    if (!record?.dataUrl) return;
    const img = $("story-logo-preview");
    const wrapper = $("story-logo-wrapper");
    if (!img || !wrapper) return;

    img.src = record.dataUrl;
    img.classList.remove("hidden");
    wrapper.classList.remove("hidden");
    try { localStorage.setItem(LEGACY_KEY, record.dataUrl); } catch {}
    invalidate();
  }

  async function renderLibrary() {
    const list = $("logo-library-list");
    if (!list) return;

    let logos = [];
    try { logos = await getAllLogos(); } catch (error) {
      console.error(error);
      list.innerHTML = `<div class="logo-library-empty">Não foi possível abrir a biblioteca de logos neste navegador.</div>`;
      return;
    }

    logos.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    const defaultId = getDefaultId();
    const counter = $("logo-library-count");
    if (counter) counter.textContent = `${logos.length}/${MAX_LOGOS}`;

    if (!logos.length) {
      list.innerHTML = `<div class="logo-library-empty">Nenhum logo cadastrado ainda. Envie um logo na área “Imagens”, dê um nome acima e toque em “Salvar logo atual”.</div>`;
      return;
    }

    list.innerHTML = logos.map((logo) => {
      const isDefault = logo.id === defaultId;
      return `
        <div class="logo-card${isDefault ? " is-default" : ""}" data-logo-id="${escapeHtml(logo.id)}">
          <div class="logo-card-main">
            <img class="logo-card-preview" src="${escapeHtml(logo.dataUrl)}" alt="${escapeHtml(logo.name)}" />
            <div class="logo-card-copy">
              <div class="logo-card-name">${escapeHtml(logo.name)}</div>
              <div class="logo-card-default">${isDefault ? "★ Padrão deste aparelho" : "Disponível"}</div>
            </div>
          </div>
          <div class="logo-card-actions">
            <button type="button" class="logo-card-btn primary" data-logo-action="use">Usar agora</button>
            <button type="button" class="logo-card-btn" data-logo-action="default">${isDefault ? "Já é padrão" : "Definir padrão"}</button>
            <button type="button" class="logo-card-btn danger" data-logo-action="delete">Excluir da biblioteca</button>
          </div>
        </div>
      `;
    }).join("");
  }

  async function saveCurrentLogo() {
    const img = $("story-logo-preview");
    if (!img?.src || img.classList.contains("hidden")) {
      alert("Primeiro envie ou escolha um logo para salvar.");
      return;
    }

    const logos = await getAllLogos();
    if (logos.length >= MAX_LOGOS) {
      alert(`A biblioteca aceita até ${MAX_LOGOS} logos neste aparelho.`);
      return;
    }

    const nameInput = $("logo-library-name");
    const typedName = nameInput?.value?.trim() || "";
    const name = typedName || `Imobiliária ${logos.length + 1}`;
    const now = new Date().toISOString();
    const id = `logo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const record = { id, name, dataUrl: img.src, createdAt: now, updatedAt: now };

    await putLogo(record);
    if (!getDefaultId()) setDefaultId(id);
    if (nameInput) nameInput.value = "";
    await renderLibrary();

    const button = $("logo-library-save-current");
    if (button) {
      const old = button.textContent;
      button.textContent = "Logo salvo ✓";
      setTimeout(() => { button.textContent = old; }, 1200);
    }
  }

  async function migrateLegacyLogo() {
    let logos = [];
    try { logos = await getAllLogos(); } catch { return; }
    if (logos.length) return;

    let oldLogo = "";
    try { oldLogo = localStorage.getItem(LEGACY_KEY) || ""; } catch {}
    if (!oldLogo) return;

    const id = `logo-migrado-${Date.now()}`;
    const now = new Date().toISOString();
    await putLogo({ id, name: "Logo salvo", dataUrl: oldLogo, createdAt: now, updatedAt: now });
    if (!getDefaultId()) setDefaultId(id);
  }

  async function applyDefaultLogo() {
    const id = getDefaultId();
    if (!id) return;
    try {
      const record = await getLogo(id);
      if (record) applyLogo(record);
      else setDefaultId("");
    } catch (error) {
      console.warn("Não foi possível carregar o logo padrão:", error);
    }
  }

  async function handleLibraryClick(event) {
    const button = event.target.closest("[data-logo-action]");
    if (!button) return;
    const card = button.closest("[data-logo-id]");
    const id = card?.dataset.logoId;
    if (!id) return;

    const action = button.dataset.logoAction;
    if (action === "use") {
      const logo = await getLogo(id);
      if (logo) applyLogo(logo);
      return;
    }

    if (action === "default") {
      const logo = await getLogo(id);
      if (!logo) return;
      setDefaultId(id);
      applyLogo(logo);
      await renderLibrary();
      return;
    }

    if (action === "delete") {
      const logo = await getLogo(id);
      if (!logo) return;
      if (!confirm(`Excluir “${logo.name}” da biblioteca deste aparelho?`)) return;
      await deleteLogo(id);
      if (getDefaultId() === id) setDefaultId("");
      await renderLibrary();
    }
  }

  function setupEvents() {
    $("logo-library-save-current")?.addEventListener("click", () => {
      saveCurrentLogo().catch((error) => {
        console.error(error);
        alert("Não foi possível salvar o logo neste aparelho.");
      });
    });

    $("logo-library-list")?.addEventListener("click", (event) => {
      handleLibraryClick(event).catch((error) => {
        console.error(error);
        alert("Não foi possível concluir esta ação com o logo.");
      });
    });

    $("logo-upload-story")?.addEventListener("change", () => {
      const file = $("logo-upload-story")?.files?.[0];
      const nameInput = $("logo-library-name");
      if (file && nameInput && !nameInput.value) {
        nameInput.placeholder = `Nome da imobiliária • ${file.name}`;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!("indexedDB" in window)) return;
    injectStyles();
    buildUi();
    setupEvents();

    try {
      await migrateLegacyLogo();
      await renderLibrary();
      await applyDefaultLogo();
    } catch (error) {
      console.error("Erro ao iniciar biblioteca de logos:", error);
    }
  });
})();