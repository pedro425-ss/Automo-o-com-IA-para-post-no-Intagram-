(() => {
  const TOKEN_KEY="story-imoveis-admin-token-v1";
  const $=(id)=>document.getElementById(id);
  let token=localStorage.getItem(TOKEN_KEY)||"";
  let organizations=[];
  let plans=[];
  let expandedOrgId="";
  const orgUsers={};

  async function api(path,options={}){
    const headers=new Headers(options.headers||{});
    if(options.body&&!headers.has("Content-Type")) headers.set("Content-Type","application/json");
    if(token) headers.set("Authorization","Bearer "+token);
    const response=await fetch(path,{...options,headers,cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.erro||"Não foi possível concluir.");
    return data;
  }

  function money(value){
    return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value||0));
  }
  function date(value){
    if(!value) return "sem vencimento";
    try{return new Intl.DateTimeFormat("pt-BR").format(new Date(value));}catch{return String(value)}
  }
  function escapeHtml(value){
    return String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  async function loadConfig(){
    const data=await api("/api/access-config");
    plans=Array.isArray(data.plans)?data.plans:[];
    $("access-mode").textContent=data.active?"Monetização ativa":"Modo seguro";
    $("access-status-title").textContent=data.active?"Login obrigatório ligado":"Gerador continua aberto";
    $("access-status-copy").textContent=data.active
      ?"Os clientes precisam de uma assinatura ativa para usar o gerador."
      :"Você pode cadastrar clientes e testar tudo antes de ligar o bloqueio do gerador.";
    renderPlans();
  }

  function renderPlans(){
    $("plans").innerHTML=plans.map(plan=>`
      <article class="plan">
        <small>${escapeHtml(plan.name)}</small>
        <strong>${plan.userLimit} ${plan.userLimit===1?"acesso":"acessos"}</strong>
        <b>${money(plan.price)}</b>
        <span>por mês</span>
      </article>
    `).join("");
  }

  async function login(event){
    event.preventDefault();
    const msg=$("login-msg");
    msg.textContent="Entrando...";
    try{
      const data=await api("/api/auth/login",{method:"POST",body:JSON.stringify({
        email:$("email").value,password:$("password").value
      })});
      if(data.user?.role!=="superadmin") throw new Error("Esta conta não é administradora da plataforma.");
      token=data.token;
      localStorage.setItem(TOKEN_KEY,token);
      await bootAdmin();
    }catch(error){
      msg.textContent=error.message;
    }
  }

  async function bootAdmin(){
    try{
      const me=await api("/api/auth/me");
      if(me.user?.role!=="superadmin") throw new Error("Acesso negado.");
      $("login-card").classList.add("hidden");
      $("admin-app").classList.remove("hidden");
      await Promise.all([loadConfig(),loadOrganizations()]);
    }catch(error){
      token="";
      localStorage.removeItem(TOKEN_KEY);
      $("login-card").classList.remove("hidden");
      $("admin-app").classList.add("hidden");
      $("login-msg").textContent=error.message;
    }
  }

  async function loadOrganizations(){
    const data=await api("/api/admin/organizations");
    organizations=Array.isArray(data.organizations)?data.organizations:[];
    renderOrganizations();
  }

  function renderOrganizations(){
    const q=String($("search").value||"").trim().toLowerCase();
    const items=organizations.filter(org=>!q||String(org.name||"").toLowerCase().includes(q));
    $("client-list").innerHTML=items.length?items.map(org=>{
      const users=orgUsers[org.id]||[];
      const expanded=expandedOrgId===org.id;
      const accessPanel=expanded?`
        <div style="grid-column:1/-1;margin-top:8px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07)">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
            <strong style="font-size:10px">Acessos da imobiliária</strong>
            <span style="font-size:8px;color:#8e989f">${users.filter(u=>u.active).length}/${org.userLimit||1} ativos</span>
          </div>
          <div style="display:grid;gap:6px;margin-bottom:10px">
            ${users.map(user=>`
              <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px;border:1px solid rgba(255,255,255,.06);border-radius:9px;background:rgba(255,255,255,.025)">
                <div>
                  <div style="font-size:9.5px;font-weight:900">${escapeHtml(user.name)} ${user.role==="owner"?"• responsável":""}</div>
                  <div style="font-size:8px;color:#8e989f;margin-top:2px">${escapeHtml(user.email)} • ${user.active?"ativo":"desativado"}</div>
                </div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">
                  <button class="mini" data-action="reset-password" data-id="${org.id}" data-user="${user.id}">Trocar senha</button>
                  ${user.role!=="owner"?`<button class="mini ${user.active?"red":"green"}" data-action="toggle-user" data-id="${org.id}" data-user="${user.id}" data-active="${user.active}">${user.active?"Desativar":"Reativar"}</button>`:""}
                </div>
              </div>
            `).join("") || '<div class="empty">Nenhum acesso cadastrado.</div>'}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px">
            <input id="user-name-${org.id}" placeholder="Nome" style="min-height:36px;padding:7px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:#11181c;color:#fff">
            <input id="user-email-${org.id}" type="email" placeholder="E-mail" style="min-height:36px;padding:7px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:#11181c;color:#fff">
            <input id="user-password-${org.id}" type="password" placeholder="Senha inicial" style="min-height:36px;padding:7px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:#11181c;color:#fff">
            <button class="mini gold" data-action="add-user" data-id="${org.id}">Adicionar acesso</button>
          </div>
        </div>`:"";
      return `
      <div class="row">
        <div>
          <div class="row-title">${escapeHtml(org.name)}</div>
          <div class="row-meta">
            ${escapeHtml(org.plan)} • ${org.activeUsers||0}/${org.userLimit||1} acessos •
            vence ${date(org.expiresAt)} • ${org.status==="active"?"ativo":escapeHtml(org.status)}
          </div>
        </div>
        <div class="row-actions">
          <button class="mini" data-action="users" data-id="${org.id}">${expanded?"Fechar acessos":"Acessos"}</button>
          <button class="mini gold" data-action="renew" data-id="${org.id}">+30 dias</button>
          <button class="mini gold" data-action="renew90" data-id="${org.id}">+90 dias</button>
          <button class="mini ${org.status==="active"?"red":"green"}" data-action="toggle" data-status="${org.status}" data-id="${org.id}">
            ${org.status==="active"?"Bloquear":"Ativar"}
          </button>
        </div>
        ${accessPanel}
      </div>`;
    }).join(""):'<div class="empty">Nenhum cliente encontrado.</div>';
  }

  async function createOrganization(){
    const msg=$("create-msg");
    msg.textContent="Criando cliente...";
    try{
      await api("/api/admin/organizations",{method:"POST",body:JSON.stringify({
        name:$("org-name").value,
        ownerName:$("owner-name").value,
        ownerEmail:$("owner-email").value,
        password:$("owner-password").value,
        plan:$("org-plan").value,
        days:Number($("org-days").value||30)
      })});
      msg.textContent="Cliente criado e acesso liberado ✓";
      ["org-name","owner-name","owner-email","owner-password"].forEach(id=>$(id).value="");
      await loadOrganizations();
    }catch(error){
      msg.textContent=error.message;
    }
  }

  async function loadOrgUsers(orgId){
    const data=await api("/api/admin/organizations/"+encodeURIComponent(orgId)+"/users");
    orgUsers[orgId]=Array.isArray(data.users)?data.users:[];
  }

  async function clientAction(event){
    const button=event.target.closest("[data-action]");
    if(!button) return;
    button.disabled=true;
    try{
      const action=button.dataset.action;
      const orgId=button.dataset.id;

      if(action==="users"){
        if(expandedOrgId===orgId){
          expandedOrgId="";
        }else{
          expandedOrgId=orgId;
          await loadOrgUsers(orgId);
        }
        renderOrganizations();
        return;
      }

      if(action==="add-user"){
        const name=$("user-name-"+orgId)?.value||"";
        const email=$("user-email-"+orgId)?.value||"";
        const password=$("user-password-"+orgId)?.value||"";
        await api("/api/admin/organizations/"+encodeURIComponent(orgId)+"/users",{
          method:"POST",body:JSON.stringify({name,email,password})
        });
        await Promise.all([loadOrgUsers(orgId),loadOrganizations()]);
        expandedOrgId=orgId;
        renderOrganizations();
        return;
      }

      if(action==="toggle-user"){
        const active=button.dataset.active!=="true";
        await api("/api/admin/organizations/"+encodeURIComponent(orgId)+"/users/"+encodeURIComponent(button.dataset.user),{
          method:"PATCH",body:JSON.stringify({active})
        });
        await Promise.all([loadOrgUsers(orgId),loadOrganizations()]);
        expandedOrgId=orgId;
        renderOrganizations();
        return;
      }

      if(action==="reset-password"){
        const password=prompt("Digite a nova senha (mínimo 8 caracteres):");
        if(!password) return;
        await api("/api/admin/organizations/"+encodeURIComponent(orgId)+"/users/"+encodeURIComponent(button.dataset.user),{
          method:"PATCH",body:JSON.stringify({password})
        });
        alert("Senha atualizada ✓");
        return;
      }

      let body={};
      if(action==="renew") body={addDays:30};
      if(action==="renew90") body={addDays:90};
      if(action==="toggle") body={status:button.dataset.status==="active"?"blocked":"active"};

      await api("/api/admin/organizations/"+encodeURIComponent(orgId),{
        method:"PATCH",body:JSON.stringify(body)
      });
      await loadOrganizations();
    }catch(error){
      alert(error.message);
    }finally{
      button.disabled=false;
    }
  }

  function logout(){
    token="";
    localStorage.removeItem(TOKEN_KEY);
    location.reload();
  }

  document.addEventListener("DOMContentLoaded",()=>{
    $("login-form").addEventListener("submit",login);
    $("create-org").addEventListener("click",createOrganization);
    $("client-list").addEventListener("click",clientAction);
    $("search").addEventListener("input",renderOrganizations);
    $("logout").addEventListener("click",logout);
    if(token) bootAdmin();
    else loadConfig().catch(()=>{});
  });
})();