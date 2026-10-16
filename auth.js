(() => {
  const TOKEN_KEY = "story-imoveis-auth-token-v1";
  const $ = (id) => document.getElementById(id);
  let session = null;
  let accessConfig = { active: false, plans: [] };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    try {
      const rawUrl = typeof input === "string" ? input : input?.url || "";
      const url = new URL(rawUrl, window.location.origin);
      const sameOrigin = url.origin === window.location.origin;
      const protectedPath =
        url.pathname === "/analisar-imovel" ||
        url.pathname.startsWith("/api/account/") ||
        url.pathname.startsWith("/api/admin/") ||
        url.pathname === "/api/auth/me";

      if (sameOrigin && protectedPath) {
        const token = localStorage.getItem(TOKEN_KEY) || "";
        const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined) || {});
        if (token) headers.set("Authorization", "Bearer " + token);
        init = { ...init, headers };
      }
    } catch {}
    return nativeFetch(input, init);
  };

  function injectStyles() {
    if ($("access-control-styles")) return;
    const style = document.createElement("style");
    style.id = "access-control-styles";
    style.textContent = `
      #access-gate{
        position:fixed;inset:0;z-index:5000;display:grid;place-items:center;padding:18px;
        background:
          radial-gradient(circle at 15% 0%,rgba(216,162,59,.10),transparent 28%),
          radial-gradient(circle at 90% 15%,rgba(79,127,67,.10),transparent 26%),
          #0a0f12;
        color:#fff
      }
      #access-gate.is-hidden{display:none}
      .access-login-card{
        width:min(100%,410px);padding:24px;border:1px solid rgba(255,255,255,.08);
        border-radius:22px;background:linear-gradient(180deg,#141b20,#0f1519);
        box-shadow:0 26px 80px rgba(0,0,0,.45)
      }
      .access-brand{display:flex;align-items:center;gap:12px;margin-bottom:22px}
      .access-brand img{width:48px;height:48px;border-radius:13px}
      .access-brand strong{display:block;font-size:18px;letter-spacing:.01em}
      .access-brand span{display:block;margin-top:3px;color:#d8a23b;font-size:9px;letter-spacing:.18em}
      .access-login-title{font-size:22px;font-weight:900;letter-spacing:-.035em}
      .access-login-copy{margin:5px 0 18px;color:#98a2a9;font-size:11px;line-height:1.45}
      .access-field{display:grid;gap:6px;margin-top:10px}
      .access-field label{font-size:10px;font-weight:850;color:#cfd5d9}
      .access-field input,.access-field select{
        width:100%;min-height:46px;padding:10px 12px;border-radius:11px;
        border:1px solid rgba(255,255,255,.10);background:#1a2118;color:#fff;font-size:14px;outline:none
      }
      .access-field input:focus,.access-field select:focus{
        border-color:#d8a23b;box-shadow:0 0 0 3px rgba(216,162,59,.11)
      }
      .access-login-btn{
        width:100%;min-height:48px;margin-top:15px;border:0;border-radius:11px;
        background:linear-gradient(135deg,#c58b2b,#e4b253);color:#17120a;font-size:13px;font-weight:950;cursor:pointer
      }
      .access-login-status{min-height:18px;margin-top:10px;color:#e6bd6d;font-size:10px;line-height:1.4}
      #account-access-button{
        position:fixed;right:18px;top:18px;z-index:650;
        min-height:38px;padding:7px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.10);
        background:rgba(16,22,26,.94);color:#fff;font-size:10px;font-weight:850;cursor:pointer;
        box-shadow:0 8px 24px rgba(0,0,0,.18);backdrop-filter:blur(12px)
      }
      body.desktop-wizard-active #account-access-button{right:24px}
      #access-panel{
        position:fixed;inset:0;z-index:4000;display:none;align-items:center;justify-content:center;padding:18px;
        background:rgba(4,7,9,.76);backdrop-filter:blur(10px)
      }
      #access-panel.is-open{display:flex}
      .access-panel-card{
        width:min(100%,920px);max-height:min(88vh,820px);overflow:auto;padding:18px;
        border:1px solid rgba(255,255,255,.09);border-radius:20px;background:#10161a;color:#fff;
        box-shadow:0 30px 80px rgba(0,0,0,.5)
      }
      .access-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
      .access-panel-title{font-size:18px;font-weight:950;letter-spacing:-.025em}
      .access-panel-sub{margin-top:4px;color:#919ca3;font-size:10px}
      .access-close{min-width:72px;min-height:36px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-weight:850}
      .access-summary{
        display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px
      }
      .access-stat{padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.03)}
      .access-stat small{display:block;color:#879198;font-size:8px;text-transform:uppercase;letter-spacing:.08em}
      .access-stat strong{display:block;margin-top:4px;font-size:12px}
      .access-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .access-box{padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.025)}
      .access-box h3{margin:0 0 9px;font-size:12px;color:#efcf8c}
      .access-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      .access-mini{
        min-height:34px;padding:6px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.09);
        background:rgba(255,255,255,.05);color:#fff;font-size:9px;font-weight:850;cursor:pointer
      }
      .access-mini.primary{background:#4f7f43;border-color:#4f7f43}
      .access-mini.gold{background:#9d6b1d;border-color:#a97825}
      .access-mini.danger{background:#49251f;color:#ffc7bb}
      .access-list{display:grid;gap:7px;margin-top:9px}
      .access-row{
        display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;
        padding:9px;border:1px solid rgba(255,255,255,.06);border-radius:10px;background:rgba(0,0,0,.15)
      }
      .access-row strong{display:block;font-size:10px}
      .access-row span{display:block;margin-top:2px;color:#8f999f;font-size:8px}
      .access-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .access-form-grid .wide{grid-column:1/-1}
      .access-form-grid input,.access-form-grid select{
        width:100%;min-height:38px;padding:7px 9px;border-radius:9px;border:1px solid rgba(255,255,255,.09);
        background:#192017;color:#fff;font-size:10px
      }
      .access-panel-status{min-height:17px;margin-top:7px;color:#e8c575;font-size:9px}
      @media(max-width:899px){
        #account-access-button{top:12px;right:62px;min-height:34px;max-width:128px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .access-panel-card{padding:13px;border-radius:16px}
        .access-summary{grid-template-columns:1fr 1fr}
        .access-grid{grid-template-columns:1fr}
        .access-form-grid{grid-template-columns:1fr}
        .access-form-grid .wide{grid-column:auto}
      }
    `;
    document.head.appendChild(style);
  }

  function createUi() {
    if (!$("access-gate")) {
      const gate = document.createElement("div");
      gate.id = "access-gate";
      gate.innerHTML = `
        <form id="access-login-form" class="access-login-card">
          <div class="access-brand">
            <img src="/pwa-icon-pro-192.png" alt="Story Imóveis">
            <div><strong>STORY</strong><span>IMÓVEIS</span></div>
          </div>
          <div class="access-login-title">Entre na sua conta</div>
          <div class="access-login-copy">Acesse o gerador, seus Stories e as configurações da sua imobiliária.</div>
          <div class="access-field"><label>E-mail</label><input id="access-email" type="email" autocomplete="email" required></div>
          <div class="access-field"><label>Senha</label><input id="access-password" type="password" autocomplete="current-password" required minlength="8"></div>
          <button class="access-login-btn" type="submit">Entrar</button>
          <div id="access-login-status" class="access-login-status"></div>
        </form>
      `;
      document.body.appendChild(gate);
      $("access-login-form")?.addEventListener("submit", login);
    }

    if (!$("account-access-button")) {
      const button = document.createElement("button");
      button.id = "account-access-button";
      button.type = "button";
      button.textContent = "Minha conta";
      button.style.display = "none";
      document.body.appendChild(button);
      button.addEventListener("click", openPanel);
    }

    if (!$("access-panel")) {
      const panel = document.createElement("div");
      panel.id = "access-panel";
      panel.innerHTML = `
        <div class="access-panel-card">
          <div class="access-panel-head">
            <div><div id="access-panel-title" class="access-panel-title">Minha conta</div><div id="access-panel-sub" class="access-panel-sub"></div></div>
            <button id="access-close" class="access-close" type="button">Fechar</button>
          </div>
          <div id="access-panel-body"></div>
        </div>
      `;
      document.body.appendChild(panel);
      $("access-close")?.addEventListener("click", closePanel);
      panel.addEventListener("click", (event) => { if (event.target === panel) closePanel(); });
    }
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.erro || "Não foi possível concluir.");
    return data;
  }

  async function login(event) {
    event.preventDefault();
    const status = $("access-login-status");
    status.textContent = "Entrando...";
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: $("access-email")?.value || "",
          password: $("access-password")?.value || "",
        }),
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      session = data;
      status.textContent = "";
      applySession();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function restore() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return showLogin();
    try {
      const data = await api("/api/auth/me");
      session = data;
      applySession();
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY);
      showLogin(error.message);
    }
  }

  function showLogin(message = "") {
    session = null;
    $("access-gate")?.classList.remove("is-hidden");
    if ($("account-access-button")) $("account-access-button").style.display = "none";
    if ($("access-login-status")) $("access-login-status").textContent = message;
  }

  function applySession() {
    $("access-gate")?.classList.add("is-hidden");
    const button = $("account-access-button");
    if (button) {
      button.style.display = "";
      button.textContent = session?.user?.role === "superadmin"
        ? "Admin"
        : (session?.organization?.name || session?.user?.name || "Minha conta");
    }
    window.dispatchEvent(new CustomEvent("story-auth-ready", { detail: session }));
  }

  function formatDate(value) {
    if (!value) return "Sem vencimento";
    try { return new Intl.DateTimeFormat("pt-BR").format(new Date(value)); } catch { return String(value); }
  }

  function planLabel(plan) {
    const fromConfig = accessConfig.plans?.find((item) => item.id === plan);
    return fromConfig?.name || ({ individual:"Individual", imobiliaria:"Imobiliária", equipe:"Equipe" })[plan] || plan || "-";
  }

  async function openPanel() {
    $("access-panel")?.classList.add("is-open");
    await renderPanel();
  }

  function closePanel() {
    $("access-panel")?.classList.remove("is-open");
  }

  async function renderPanel() {
    const body = $("access-panel-body");
    if (!body || !session?.user) return;

    $("access-panel-title").textContent = session.user.role === "superadmin" ? "Administração da plataforma" : "Minha imobiliária";
    $("access-panel-sub").textContent = session.user.email || "";

    if (session.user.role === "superadmin") {
      body.innerHTML = `
        <div class="access-box">
          <h3>Cadastrar nova imobiliária</h3>
          <div class="access-form-grid">
            <input id="admin-org-name" placeholder="Nome da imobiliária">
            <input id="admin-owner-name" placeholder="Responsável">
            <input id="admin-owner-email" type="email" placeholder="E-mail do responsável">
            <input id="admin-owner-password" type="password" placeholder="Senha inicial (mín. 8)">
            <select id="admin-plan"><option value="individual">Individual — 1 usuário</option><option value="imobiliaria">Imobiliária — até 5</option><option value="equipe">Equipe — até 10</option></select>
            <input id="admin-days" type="number" min="1" value="30" placeholder="Dias de acesso">
            <button id="admin-create-org" class="access-mini primary wide" type="button">Criar imobiliária e liberar acesso</button>
          </div>
          <div id="admin-create-status" class="access-panel-status"></div>
        </div>
        <div class="access-box" style="margin-top:10px">
          <h3>Clientes e assinaturas</h3>
          <div id="admin-org-list" class="access-list"></div>
        </div>
        <div class="access-actions"><button id="access-logout" class="access-mini danger" type="button">Sair da conta</button></div>
      `;
      $("admin-create-org")?.addEventListener("click", createOrganization);
      $("access-logout")?.addEventListener("click", logout);
      await renderOrganizations();
      return;
    }

    const org = session.organization || {};
    body.innerHTML = `
      <div class="access-summary">
        <div class="access-stat"><small>Plano</small><strong>${planLabel(org.plan)}</strong></div>
        <div class="access-stat"><small>Status</small><strong>${org.status === "active" ? "Ativo" : org.status}</strong></div>
        <div class="access-stat"><small>Limite</small><strong>${org.userLimit || 1} usuários</strong></div>
        <div class="access-stat"><small>Vencimento</small><strong>${formatDate(org.expiresAt)}</strong></div>
      </div>
      <div class="access-grid">
        <div class="access-box">
          <h3>Usuários da imobiliária</h3>
          <div id="account-user-list" class="access-list"></div>
        </div>
        <div class="access-box">
          <h3>Adicionar usuário</h3>
          ${session.user.role === "owner" ? `
          <div class="access-form-grid">
            <input id="new-user-name" placeholder="Nome">
            <input id="new-user-email" type="email" placeholder="E-mail">
            <input id="new-user-password" class="wide" type="password" placeholder="Senha inicial (mín. 8)">
            <button id="new-user-create" class="access-mini primary wide" type="button">Adicionar acesso</button>
          </div>
          <div id="new-user-status" class="access-panel-status"></div>` : `
          <div class="access-panel-sub">Somente o administrador da imobiliária pode adicionar usuários.</div>`}
        </div>
      </div>
      <div class="access-actions"><button id="access-logout" class="access-mini danger" type="button">Sair da conta</button></div>
    `;

    $("access-logout")?.addEventListener("click", logout);
    if (session.user.role === "owner") {
      $("new-user-create")?.addEventListener("click", createUser);
      await renderUsers();
    } else {
      const list = $("account-user-list");
      if (list) list.innerHTML = `<div class="access-row"><div><strong>${session.user.name}</strong><span>${session.user.email}</span></div><div>Ativo</div></div>`;
    }
  }

  async function renderUsers() {
    const list = $("account-user-list");
    if (!list) return;
    list.innerHTML = "Carregando...";
    try {
      const data = await api("/api/account/users");
      list.innerHTML = data.users.map((user) => `
        <div class="access-row">
          <div><strong>${escapeHtml(user.name)} ${user.role === "owner" ? "• Administrador" : ""}</strong><span>${escapeHtml(user.email)} • ${user.active ? "Ativo" : "Desativado"}</span></div>
          ${user.id !== session.user.id ? `<button class="access-mini ${user.active ? "danger" : "primary"}" data-toggle-user="${user.id}" data-active="${user.active ? "1" : "0"}" type="button">${user.active ? "Desativar" : "Ativar"}</button>` : ""}
        </div>
      `).join("") || '<div class="access-panel-sub">Nenhum usuário.</div>';
      list.querySelectorAll("[data-toggle-user]").forEach((button) => button.addEventListener("click", toggleUser));
    } catch (error) {
      list.textContent = error.message;
    }
  }

  async function createUser() {
    const status = $("new-user-status");
    try {
      status.textContent = "Criando...";
      await api("/api/account/users", {
        method:"POST",
        body:JSON.stringify({
          name:$("new-user-name")?.value || "",
          email:$("new-user-email")?.value || "",
          password:$("new-user-password")?.value || "",
        }),
      });
      status.textContent = "Usuário criado ✓";
      ["new-user-name","new-user-email","new-user-password"].forEach((id)=>{ if($(id)) $(id).value=""; });
      await renderUsers();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function toggleUser(event) {
    const button = event.currentTarget;
    try {
      button.disabled = true;
      await api("/api/account/users/" + encodeURIComponent(button.dataset.toggleUser), {
        method:"PATCH",
        body:JSON.stringify({ active: button.dataset.active !== "1" }),
      });
      await renderUsers();
    } catch (error) {
      alert(error.message);
    }
  }

  async function createOrganization() {
    const status = $("admin-create-status");
    try {
      status.textContent = "Criando...";
      await api("/api/admin/organizations", {
        method:"POST",
        body:JSON.stringify({
          name:$("admin-org-name")?.value || "",
          ownerName:$("admin-owner-name")?.value || "",
          ownerEmail:$("admin-owner-email")?.value || "",
          password:$("admin-owner-password")?.value || "",
          plan:$("admin-plan")?.value || "individual",
          days:Number($("admin-days")?.value || 30),
        }),
      });
      status.textContent = "Imobiliária criada e acesso liberado ✓";
      ["admin-org-name","admin-owner-name","admin-owner-email","admin-owner-password"].forEach((id)=>{ if($(id)) $(id).value=""; });
      await renderOrganizations();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function renderOrganizations() {
    const list = $("admin-org-list");
    if (!list) return;
    list.innerHTML = "Carregando...";
    try {
      const data = await api("/api/admin/organizations");
      list.innerHTML = data.organizations.map((org) => `
        <div class="access-row">
          <div>
            <strong>${escapeHtml(org.name)} • ${planLabel(org.plan)}</strong>
            <span>${org.activeUsers || 0}/${org.userLimit} acessos • vence ${formatDate(org.expiresAt)} • ${org.status}</span>
          </div>
          <div class="access-actions">
            <button class="access-mini gold" data-admin-action="renew" data-org="${org.id}" type="button">+30 dias</button>
            <button class="access-mini ${org.status === "active" ? "danger" : "primary"}" data-admin-action="toggle" data-status="${org.status}" data-org="${org.id}" type="button">${org.status === "active" ? "Bloquear" : "Ativar"}</button>
          </div>
        </div>
      `).join("") || '<div class="access-panel-sub">Nenhuma imobiliária cadastrada.</div>';
      list.querySelectorAll("[data-admin-action]").forEach((button)=>button.addEventListener("click", adminOrganizationAction));
    } catch (error) {
      list.textContent = error.message;
    }
  }

  async function adminOrganizationAction(event) {
    const button = event.currentTarget;
    const body = button.dataset.adminAction === "renew"
      ? { addDays: 30 }
      : { status: button.dataset.status === "active" ? "blocked" : "active" };
    try {
      button.disabled = true;
      await api("/api/admin/organizations/" + encodeURIComponent(button.dataset.org), {
        method:"PATCH",
        body:JSON.stringify(body),
      });
      await renderOrganizations();
    } catch (error) {
      alert(error.message);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    closePanel();
    showLogin();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  async function loadAccessConfig() {
    try {
      const response = await nativeFetch("/api/access-config", { cache: "no-store" });
      if (!response.ok) return { active: false, plans: [] };
      const data = await response.json();
      return {
        active: data.active === true,
        enabled: data.enabled === true,
        ready: data.ready === true,
        plans: Array.isArray(data.plans) ? data.plans : [],
      };
    } catch {
      return { active: false, plans: [] };
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    accessConfig = await loadAccessConfig();

    // Segurança: enquanto a monetização não estiver 100% pronta,
    // o gerador continua aberto e este módulo não interfere no layout.
    if (!accessConfig.active) {
      document.documentElement.dataset.accessMode = "open";
      window.dispatchEvent(new CustomEvent("story-access-open"));
      return;
    }

    document.documentElement.dataset.accessMode = "paid";
    injectStyles();
    createUi();
    restore();
  });

  window.StoryAccess = {
    getSession: () => session,
    getConfig: () => accessConfig,
    openPanel,
    logout,
  };
})();