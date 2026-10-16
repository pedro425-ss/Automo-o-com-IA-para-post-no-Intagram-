(() => {
  const API = "/api/imobiliarias";
  const DB_NAME = "assessoria-story-branding-v1";
  const DB_VERSION = 1;
  const STORE_NAME = "logos";
  const DEFAULT_KEY = "assessoria-story-default-logo-v1";
  const SYNC_KEY_STORAGE = "assessoria-story-sync-key-v1";
  const $ = (id) => document.getElementById(id);

  function getSyncKey() {
    try { return localStorage.getItem(SYNC_KEY_STORAGE) || ""; } catch { return ""; }
  }

  function setSyncKey(value) {
    try {
      if (value) localStorage.setItem(SYNC_KEY_STORAGE, value);
      else localStorage.removeItem(SYNC_KEY_STORAGE);
    } catch {}
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbGetAll() {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } finally { db.close(); }
  }

  async function dbPut(record) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }

  function fire(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function currentSettings() {
    return {
      contact: $("contact")?.value || "",
      logoSize: Number($("logo-size")?.value || 200),
      logoPosition: $("logo-position")?.value || "top-left",
      contentY: Number($("content-y")?.value || 0),
      morePhotosUrl: $("more-photos-url")?.value || "",
      showQr: Boolean($("show-qr")?.checked),
    };
  }

  function applyProfile(profile, makeDefault = false) {
    const img = $("story-logo-preview");
    const wrapper = $("story-logo-wrapper");
    if (img && profile.logoData) {
      img.src = profile.logoData;
      img.classList.remove("hidden");
      wrapper?.classList.remove("hidden");
    }

    [["contact", profile.contact], ["logo-size", profile.logoSize], ["logo-position", profile.logoPosition], ["content-y", profile.contentY], ["more-photos-url", profile.morePhotosUrl]].forEach(([id, value]) => {
      const el = $(id);
      if (!el || value === undefined || value === null || value === "") return;
      el.value = String(value);
      fire(el);
    });

    const showQr = $("show-qr");
    if (showQr && typeof profile.showQr === "boolean") {
      showQr.checked = profile.showQr;
      fire(showQr);
    }

    dbPut({
      id: profile.id,
      name: profile.name,
      dataUrl: profile.logoData,
      createdAt: profile.createdAt || new Date().toISOString(),
      updatedAt: profile.updatedAt || new Date().toISOString(),
    }).catch(() => {});

    if (makeDefault) {
      try { localStorage.setItem(DEFAULT_KEY, profile.id); } catch {}
    }
    try { if (typeof window.invalidateStoryCache === "function") window.invalidateStoryCache(); } catch {}
  }

  function injectStyles() {
    if ($("cloud-profile-style")) return;
    const style = document.createElement("style");
    style.id = "cloud-profile-style";
    style.textContent = `
      .cloud-profile-box{margin-top:12px;padding:13px;border-radius:15px;border:1px solid rgba(200,139,58,.18);background:rgba(200,139,58,.045)}
      .cloud-profile-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
      .cloud-profile-title{font-size:13px;font-weight:900;color:#f8d78c}.cloud-profile-subtitle{margin-top:3px;font-size:10px;line-height:1.35;opacity:.67}
      .cloud-profile-status{padding:5px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.1);font-size:10px;font-weight:900;white-space:nowrap}
      .cloud-key-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-bottom:10px}.cloud-key-row .input{min-width:0}
      .cloud-profile-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
      .cloud-profile-btn{min-height:42px;border:1px solid rgba(255,255,255,.11);border-radius:11px;background:rgba(255,255,255,.06);color:#fff;font-size:11px;font-weight:900;cursor:pointer}
      .cloud-profile-btn.primary{background:rgba(200,139,58,.18);border-color:rgba(200,139,58,.36);color:#f8d78c}
      .cloud-profile-list{display:grid;grid-template-columns:1fr;gap:8px}.cloud-profile-card{display:grid;grid-template-columns:52px minmax(0,1fr);gap:9px;padding:9px;border-radius:12px;background:rgba(0,0,0,.14);border:1px solid rgba(255,255,255,.08)}
      .cloud-profile-logo{width:52px;height:52px;padding:4px;border-radius:10px;background:white;object-fit:contain}.cloud-profile-name{font-size:12px;font-weight:900;margin-bottom:6px}.cloud-profile-card-actions{display:flex;flex-wrap:wrap;gap:5px}
      .cloud-profile-mini{min-height:32px;padding:5px 8px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.055);color:#fff;font-size:9px;font-weight:900;cursor:pointer}.cloud-profile-mini.primary{color:#f8d78c;border-color:rgba(200,139,58,.32);background:rgba(200,139,58,.13)}.cloud-profile-mini.danger{color:#f2b7b7}
      .cloud-profile-empty{padding:11px;border:1px dashed rgba(255,255,255,.12);border-radius:11px;font-size:10px;line-height:1.4;opacity:.65;text-align:center}
      @media(max-width:899px){.cloud-key-row,.cloud-profile-actions{grid-template-columns:1fr}.cloud-profile-btn{min-height:46px;font-size:12px}.cloud-profile-card{grid-template-columns:48px minmax(0,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function buildUi() {
    if ($("cloud-profile-box")) return;
    const library = $("logo-library");
    if (!library) return;
    const box = document.createElement("div");
    box.id = "cloud-profile-box";
    box.className = "cloud-profile-box";
    box.innerHTML = `
      <div class="cloud-profile-head">
        <div><div class="cloud-profile-title">Perfis na nuvem</div><div class="cloud-profile-subtitle">Os mesmos logos e configurações em qualquer computador ou celular.</div></div>
        <div id="cloud-profile-status" class="cloud-profile-status">Aguardando</div>
      </div>
      <div class="cloud-key-row">
        <input id="cloud-sync-key" class="input" type="password" autocomplete="off" placeholder="Código de sincronização" />
        <button id="cloud-connect" type="button" class="cloud-profile-btn primary">Conectar</button>
      </div>
      <div class="cloud-profile-actions">
        <button id="cloud-save-current" type="button" class="cloud-profile-btn primary">Salvar perfil atual na nuvem</button>
        <button id="cloud-sync-local" type="button" class="cloud-profile-btn">Enviar logos deste aparelho</button>
      </div>
      <div id="cloud-profile-list" class="cloud-profile-list"><div class="cloud-profile-empty">Digite o código de sincronização para acessar seus perfis.</div></div>
    `;
    library.appendChild(box);
    const input = $("cloud-sync-key");
    if (input) input.value = getSyncKey();
  }

  async function api(path = "", options = {}) {
    const key = getSyncKey();
    if (!key) throw new Error("Digite o código de sincronização.");
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", "X-Branding-Key": key, ...(options.headers || {}) },
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.erro || json.error || `Erro ${response.status}`);
    return json;
  }

  function profilePayload(id, name, logoData) { return { id, name, logoData, ...currentSettings() }; }

  async function saveCurrent() {
    const img = $("story-logo-preview");
    if (!img?.src || img.classList.contains("hidden")) throw new Error("Escolha ou envie um logo antes de salvar o perfil.");
    const nameInput = $("logo-library-name");
    const name = nameInput?.value?.trim() || prompt("Nome da imobiliária:", "")?.trim();
    if (!name) return;
    const id = `imob-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await api("", { method: "POST", body: JSON.stringify(profilePayload(id, name, img.src)) });
    if (nameInput) nameInput.value = "";
    await loadCloud();
  }

  async function syncLocal() {
    const logos = await dbGetAll();
    if (!logos.length) throw new Error("Não há logos salvos neste aparelho para sincronizar.");
    for (const logo of logos) await api("", { method: "POST", body: JSON.stringify(profilePayload(logo.id, logo.name, logo.dataUrl)) });
    await loadCloud();
  }

  async function loadCloud() {
    const status = $("cloud-profile-status");
    const list = $("cloud-profile-list");
    if (!list) return;
    if (!getSyncKey()) {
      if (status) status.textContent = "Aguardando código";
      list.innerHTML = `<div class="cloud-profile-empty">Digite o código de sincronização para acessar seus perfis.</div>`;
      return;
    }
    try {
      const data = await api("");
      const profiles = Array.isArray(data.perfis) ? data.perfis : [];
      if (status) { status.textContent = "Nuvem conectada"; status.style.color = "#dce8a8"; }
      if (!profiles.length) {
        list.innerHTML = `<div class="cloud-profile-empty">Nenhuma imobiliária salva na nuvem ainda.</div>`;
        list._profiles = [];
        return;
      }
      list.innerHTML = profiles.map((p) => `
        <div class="cloud-profile-card" data-profile-id="${String(p.id).replace(/"/g, "&quot;")}">
          <img class="cloud-profile-logo" src="${p.logoData}" alt="Logo" />
          <div><div class="cloud-profile-name">${String(p.name || "Imobiliária").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div><div class="cloud-profile-card-actions">
            <button class="cloud-profile-mini primary" data-cloud-action="use" type="button">Usar agora</button>
            <button class="cloud-profile-mini" data-cloud-action="default" type="button">Usar e definir padrão</button>
            <button class="cloud-profile-mini danger" data-cloud-action="delete" type="button">Excluir</button>
          </div></div>
        </div>`).join("");
      list._profiles = profiles;
    } catch (error) {
      console.warn("Nuvem indisponível:", error);
      if (status) { status.textContent = error.message?.includes("código") ? "Código inválido" : "Nuvem indisponível"; status.style.color = ""; }
      list.innerHTML = `<div class="cloud-profile-empty">${String(error.message || "Não foi possível conectar.").replace(/</g, "&lt;")}</div>`;
    }
  }

  function setupEvents() {
    $("cloud-connect")?.addEventListener("click", () => {
      setSyncKey($("cloud-sync-key")?.value?.trim() || "");
      loadCloud();
    });
    $("cloud-sync-key")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { setSyncKey(e.target.value.trim()); loadCloud(); }
    });
    $("cloud-save-current")?.addEventListener("click", async () => { try { await saveCurrent(); } catch (e) { alert(e.message || "Erro ao salvar na nuvem."); } });
    $("cloud-sync-local")?.addEventListener("click", async () => { try { await syncLocal(); } catch (e) { alert(e.message || "Erro ao sincronizar logos."); } });
    $("cloud-profile-list")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-cloud-action]");
      const card = event.target.closest("[data-profile-id]");
      if (!button || !card) return;
      const profiles = $("cloud-profile-list")._profiles || [];
      const profile = profiles.find((p) => p.id === card.dataset.profileId);
      if (!profile) return;
      const action = button.dataset.cloudAction;
      if (action === "use") applyProfile(profile, false);
      if (action === "default") { applyProfile(profile, true); alert(`${profile.name} ficou como padrão deste aparelho.`); }
      if (action === "delete") {
        if (!confirm(`Excluir ${profile.name} da nuvem?`)) return;
        try { await api(`/${encodeURIComponent(profile.id)}`, { method: "DELETE" }); await loadCloud(); } catch (e) { alert(e.message || "Erro ao excluir perfil."); }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    setTimeout(() => { buildUi(); setupEvents(); if (getSyncKey()) loadCloud(); }, 0);
  });
})();