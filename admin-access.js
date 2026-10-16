(() => {
  const TOKEN_KEY="story-imoveis-admin-token-v1";
  const $=(id)=>document.getElementById(id);
  let token=localStorage.getItem(TOKEN_KEY)||"";
  let organizations=[];
  let plans=[];

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
    $("client-list").innerHTML=items.length?items.map(org=>`
      <div class="row">
        <div>
          <div class="row-title">${escapeHtml(org.name)}</div>
          <div class="row-meta">
            ${escapeHtml(org.plan)} • ${org.activeUsers||0}/${org.userLimit||1} acessos •
            vence ${date(org.expiresAt)} • ${org.status==="active"?"ativo":escapeHtml(org.status)}
          </div>
        </div>
        <div class="row-actions">
          <button class="mini gold" data-action="renew" data-id="${org.id}">+30 dias</button>
          <button class="mini gold" data-action="renew90" data-id="${org.id}">+90 dias</button>
          <button class="mini ${org.status==="active"?"red":"green"}" data-action="toggle" data-status="${org.status}" data-id="${org.id}">
            ${org.status==="active"?"Bloquear":"Ativar"}
          </button>
        </div>
      </div>
    `).join(""):'<div class="empty">Nenhum cliente encontrado.</div>';
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

  async function clientAction(event){
    const button=event.target.closest("[data-action]");
    if(!button) return;
    button.disabled=true;
    try{
      let body={};
      if(button.dataset.action==="renew") body={addDays:30};
      if(button.dataset.action==="renew90") body={addDays:90};
      if(button.dataset.action==="toggle") body={status:button.dataset.status==="active"?"blocked":"active"};
      await api("/api/admin/organizations/"+encodeURIComponent(button.dataset.id),{
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