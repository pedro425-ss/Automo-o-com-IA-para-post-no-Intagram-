(() => {
  const STORAGE_KEY = "assessoria-story-drafts-v1";
  const MAX_DRAFTS = 10;
  const $ = (id) => document.getElementById(id);

  function safeJsonParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function readDrafts() {
    try {
      const value = safeJsonParse(localStorage.getItem(STORAGE_KEY), []);
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeDrafts(drafts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.slice(0, MAX_DRAFTS)));
  }

  function fire(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function snapshotEditor() {
    const fields = {};
    document.querySelectorAll(".panel input[id], .panel textarea[id], .panel select[id]").forEach((el) => {
      if (el.type === "file") return;
      if (el.type === "checkbox" || el.type === "radio") {
        fields[el.id] = { type: el.type, checked: el.checked, value: el.value };
      } else {
        fields[el.id] = { type: el.tagName.toLowerCase(), value: el.value };
      }
    });

    const features = [...document.querySelectorAll(".feature")].map((el) => ({
      value: el.value,
      checked: el.checked,
    }));

    const story = $("story-preview-wrapper");
    const template = story?.dataset?.storyTemplate || "";

    return { fields, features, template };
  }

  function makeDraftName(data) {
    const title = data.fields?.title?.value?.trim();
    const city = data.fields?.city?.value?.trim();
    if (title && city) return `${title} — ${city}`;
    if (title) return title;
    if (city) return `Imóvel em ${city}`;
    return "Rascunho sem título";
  }

  function formatWhen(iso) {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      }).format(new Date(iso));
    } catch {
      return "";
    }
  }

  function renderDraftOptions(selectedId = "") {
    const select = $("draft-selector");
    const drafts = readDrafts();
    if (!select) return;

    select.innerHTML = `<option value="">Selecione um rascunho</option>` + drafts.map((draft) => {
      const selected = draft.id === selectedId ? " selected" : "";
      const label = `${draft.name} • ${formatWhen(draft.updatedAt)}`;
      return `<option value="${draft.id}"${selected}>${label.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</option>`;
    }).join("");

    const counter = $("draft-counter");
    if (counter) counter.textContent = `${drafts.length}/${MAX_DRAFTS}`;
  }

  function saveDraft() {
    const data = snapshotEditor();
    const drafts = readDrafts();
    const selectedId = $("draft-selector")?.value || "";
    const now = new Date().toISOString();

    let id = selectedId;
    if (id) {
      const index = drafts.findIndex((item) => item.id === id);
      if (index >= 0) {
        drafts[index] = {
          ...drafts[index],
          name: makeDraftName(data),
          updatedAt: now,
          data,
        };
      } else {
        id = "";
      }
    }

    if (!id) {
      id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      drafts.unshift({
        id,
        name: makeDraftName(data),
        createdAt: now,
        updatedAt: now,
        data,
      });
    }

    drafts.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    writeDrafts(drafts);
    renderDraftOptions(id);

    const status = $("draft-status");
    if (status) status.textContent = "Rascunho salvo neste aparelho ✓";
  }

  function applyDraft(draft) {
    if (!draft?.data) return;
    const { fields = {}, features = [], template = "" } = draft.data;

    Object.entries(fields).forEach(([id, saved]) => {
      const el = $(id);
      if (!el || el.type === "file") return;
      if (saved?.type === "checkbox" || saved?.type === "radio") {
        el.checked = Boolean(saved.checked);
      } else if (saved && Object.prototype.hasOwnProperty.call(saved, "value")) {
        el.value = saved.value ?? "";
      }
      fire(el);
    });

    if (features.length) {
      const featureMap = new Map(features.map((item) => [item.value, Boolean(item.checked)]));
      document.querySelectorAll(".feature").forEach((el) => {
        if (!featureMap.has(el.value)) return;
        el.checked = featureMap.get(el.value);
        fire(el);
      });
    }

    if (template) {
      const templateButton = document.querySelector(`[data-template="${CSS.escape(template)}"]`);
      templateButton?.click();
    }

    const status = $("draft-status");
    if (status) status.textContent = "Rascunho carregado. Se usava fotos, selecione-as novamente.";
  }

  function loadSelectedDraft() {
    const id = $("draft-selector")?.value;
    if (!id) return;
    const draft = readDrafts().find((item) => item.id === id);
    if (draft) applyDraft(draft);
  }

  function deleteSelectedDraft() {
    const select = $("draft-selector");
    const id = select?.value;
    if (!id) return alert("Selecione um rascunho para excluir.");

    const draft = readDrafts().find((item) => item.id === id);
    if (!confirm(`Excluir “${draft?.name || "este rascunho"}”?`)) return;

    writeDrafts(readDrafts().filter((item) => item.id !== id));
    renderDraftOptions();
    const status = $("draft-status");
    if (status) status.textContent = "Rascunho excluído.";
  }

  function clearPropertyFields() {
    const keepIds = new Set(["contact"]);
    const defaults = {
      badge: "IMÓVEL À VENDA",
      zoom: "100",
      "pos-x": "50",
      "pos-y": "50",
      "image-fit": "cover",
      "contain-bg": "true",
      "content-offset": "0",
      "logo-size": "100",
      "logo-position": "left",
    };

    document.querySelectorAll(".panel input[id], .panel textarea[id], .panel select[id]").forEach((el) => {
      if (keepIds.has(el.id) || el.type === "file") return;
      if (el.classList.contains("feature") || el.type === "checkbox") {
        el.checked = false;
      } else if (Object.prototype.hasOwnProperty.call(defaults, el.id)) {
        el.value = defaults[el.id];
      } else if (el.id === "badge") {
        el.value = defaults.badge;
      } else {
        el.value = "";
      }
      fire(el);
    });

    document.querySelectorAll(".feature").forEach((el) => {
      el.checked = false;
      fire(el);
    });

    const imageInput = $("image-upload-story");
    if (imageInput) imageInput.value = "";
    const storyImage = $("story-image-preview");
    if (storyImage) {
      storyImage.removeAttribute("src");
      storyImage.classList.add("hidden");
      storyImage.style.cssText = "";
    }
    const blur = $("story-bg-blur");
    if (blur) {
      blur.classList.add("hidden");
      blur.style.backgroundImage = "";
    }

    const gallery = $("story-gallery-grid");
    if (gallery) {
      gallery.innerHTML = "";
      gallery.classList.add("hidden");
    }

    const select = $("draft-selector");
    if (select) select.value = "";

    document.querySelector('[data-template="venda"]')?.click();
    const status = $("draft-status");
    if (status) status.textContent = "Novo imóvel iniciado. Contato e logo foram preservados.";
  }

  function newProperty() {
    const hasData = ["title", "price", "city", "district", "area", "description"]
      .some((id) => $(id)?.value?.trim());
    if (hasData && !confirm("Começar um novo imóvel? Salve um rascunho antes se quiser manter estes dados.")) return;
    clearPropertyFields();
  }

  function injectStyles() {
    if ($("workflow-styles")) return;
    const style = document.createElement("style");
    style.id = "workflow-styles";
    style.textContent = `
      .workflow-panel{margin:0 0 12px;padding:14px;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(255,255,255,.04)}
      .workflow-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:11px}
      .workflow-title{font-size:13px;font-weight:900;color:#f8d78c}
      .workflow-subtitle{margin-top:3px;font-size:11px;line-height:1.35;opacity:.66}
      .workflow-count{min-width:48px;padding:5px 8px;border-radius:999px;border:1px solid rgba(200,139,58,.25);background:rgba(200,139,58,.12);color:#f8d78c;font-size:11px;font-weight:900;text-align:center}
      .workflow-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:stretch}
      .workflow-select{min-width:0;width:100%;min-height:44px;padding:9px 11px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#363821;color:#fff;outline:none}
      .workflow-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
      .workflow-btn{min-height:44px;border:1px solid rgba(255,255,255,.11);border-radius:12px;padding:8px 10px;background:rgba(75,79,42,.55);color:#fff;font-size:12px;font-weight:900;cursor:pointer}
      .workflow-btn.primary{background:#c88b3a;border-color:#c88b3a}
      .workflow-btn.danger{background:rgba(130,55,45,.32);border-color:rgba(210,105,90,.22)}
      .workflow-status{min-height:16px;margin-top:7px;font-size:10px;line-height:1.35;opacity:.65}
      @media(max-width:899px){.workflow-panel{padding:12px}.workflow-row{grid-template-columns:1fr}.workflow-actions{grid-template-columns:1fr 1fr}.workflow-actions .workflow-btn:first-child{grid-column:1/-1}.workflow-btn,.workflow-select{min-height:48px;font-size:13px}}
    `;
    document.head.appendChild(style);
  }

  function buildUi() {
    if ($("workflow-panel")) return;
    const panel = document.querySelector(".panel");
    const header = panel?.querySelector(".panel-header");
    if (!panel) return;

    const box = document.createElement("div");
    box.id = "workflow-panel";
    box.className = "workflow-panel";
    box.innerHTML = `
      <div class="workflow-head">
        <div><div class="workflow-title">Rascunhos e histórico</div><div class="workflow-subtitle">Salve os dados do imóvel e continue depois neste aparelho.</div></div>
        <div id="draft-counter" class="workflow-count">0/${MAX_DRAFTS}</div>
      </div>
      <div class="workflow-row">
        <select id="draft-selector" class="workflow-select"><option value="">Selecione um rascunho</option></select>
        <button id="load-draft" type="button" class="workflow-btn">Abrir</button>
      </div>
      <div class="workflow-actions">
        <button id="save-draft" type="button" class="workflow-btn primary">Salvar rascunho</button>
        <button id="new-property" type="button" class="workflow-btn">Novo imóvel</button>
        <button id="delete-draft" type="button" class="workflow-btn danger">Excluir rascunho</button>
      </div>
      <div id="draft-status" class="workflow-status">As fotos não são salvas no rascunho para não ocupar a memória do aparelho.</div>
    `;

    if (header?.nextSibling) panel.insertBefore(box, header.nextSibling);
    else panel.prepend(box);

    $("save-draft")?.addEventListener("click", saveDraft);
    $("load-draft")?.addEventListener("click", loadSelectedDraft);
    $("delete-draft")?.addEventListener("click", deleteSelectedDraft);
    $("new-property")?.addEventListener("click", newProperty);
    $("draft-selector")?.addEventListener("change", () => {
      const status = $("draft-status");
      if (status) status.textContent = $("draft-selector").value ? "Clique em Abrir para carregar este rascunho." : "As fotos não são salvas no rascunho para não ocupar a memória do aparelho.";
    });

    renderDraftOptions();
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    buildUi();
  });
})();