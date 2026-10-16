(() => {
  const DESKTOP = "(min-width: 900px)";
  let desktopStep = 1;

  const STEPS = [
    ["Buscar imóvel","Buscar","Cole o link do anúncio ou abra um imóvel salvo."],
    ["Dados do imóvel","Dados","Revise perfil, modelo, preço e localização."],
    ["Descrição","Texto","Ajuste descrição e contato."],
    ["Design e imagens","Design","Enquadramento, fotos e composição."],
    ["Marca e extras","Marca","Logo, QR Code e identidade."],
    ["Gerar e baixar","Gerar","Revise e exporte os Stories."]
  ];

  const $ = (id) => document.getElementById(id);

  function injectStyles(){
    if($("professional-ui-styles")) return;
    const style=document.createElement("style");
    style.id="professional-ui-styles";
    style.textContent=`
      :root{
        --app-gold:#d8a23b;
        --app-gold-soft:#f7e6bd;
        --app-green:#4f7f43;
        --app-ink:#121820;
        --app-muted:#707782;
        --app-line:#e5e8eb;
        --app-paper:#f6f7f8;
        --app-white:#ffffff;
        --app-dark:#0d1215;
        --app-dark-2:#141a1e;
        --app-dark-line:rgba(255,255,255,.09);
      }

      #app-sidebar,#mobile-app-header,#mobile-bottom-nav{display:none}

      @media(min-width:900px){
        html,body{background:#eef1f3!important;color:var(--app-ink)!important}
        body.desktop-wizard-active{
          padding:0!important;
          min-height:100vh;
          background:#eef1f3!important;
        }

        body.desktop-wizard-active>.max-w-6xl{
          width:min(calc(100vw - 235px),1420px)!important;
          max-width:1420px!important;
          min-height:100vh!important;
          margin:0 0 0 225px!important;
          padding:24px 0 34px!important;
          grid-template-columns:minmax(0,1.35fr) minmax(330px,.65fr)!important;
          gap:22px!important;
          align-items:start!important;
        }

        #app-sidebar{
          display:flex;
          position:fixed;inset:0 auto 0 0;z-index:500;
          width:190px;padding:20px 14px 18px;
          flex-direction:column;
          background:linear-gradient(180deg,#111820,#0b1015);
          color:white;border-right:1px solid rgba(255,255,255,.06);
          box-shadow:12px 0 35px rgba(19,29,38,.08);
        }
        .app-brand{
          display:flex;align-items:center;gap:10px;
          padding:2px 7px 22px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,.07)
        }
        .app-brand img{width:42px;height:42px;border-radius:11px}
        .app-brand-copy strong{display:block;font-size:14px;letter-spacing:.02em}
        .app-brand-copy span{display:block;margin-top:2px;font-size:8px;letter-spacing:.22em;color:#d8a23b}
        .app-side-primary{
          min-height:42px;margin:4px 0 13px;border:0;border-radius:10px;
          background:linear-gradient(135deg,#9d6b1d,#c98f2d);color:white;
          font-size:11px;font-weight:900;cursor:pointer
        }
        .app-side-menu{display:grid;gap:4px}
        .app-side-item{
          display:flex;align-items:center;gap:10px;width:100%;min-height:40px;
          padding:8px 10px;border:0;border-radius:9px;background:transparent;color:#c8cdd2;
          font-size:10px;font-weight:750;text-align:left;cursor:pointer
        }
        .app-side-item:hover,.app-side-item.is-active{background:rgba(255,255,255,.07);color:#fff}
        .app-side-item b{
          display:grid;place-items:center;width:22px;height:22px;border-radius:7px;
          background:rgba(255,255,255,.06);font-size:11px
        }
        .app-side-plan{
          margin-top:auto;padding:11px;border:1px solid rgba(216,162,59,.22);border-radius:11px;
          background:rgba(216,162,59,.08)
        }
        .app-side-plan small{display:block;color:#b6bdc3;font-size:8px}
        .app-side-plan strong{display:block;margin-top:4px;color:#f5d489;font-size:11px}

        body.desktop-wizard-active .panel{
          padding:0!important;border:0!important;border-radius:18px!important;
          background:transparent!important;box-shadow:none!important;color:var(--app-ink)!important;
          min-width:0;max-width:840px!important;width:100%!important;
        }
        body.desktop-wizard-active .panel-header{
          min-height:70px;margin:0 0 10px;padding:0 4px 12px!important;
          border-bottom:1px solid #dde1e4!important;
        }
        body.desktop-wizard-active .panel-title{
          color:#111820!important;font-size:27px!important;line-height:1.05!important;font-weight:900!important;
          letter-spacing:-.04em!important
        }
        body.desktop-wizard-active .panel-subtitle{
          margin-top:6px!important;color:#727a83!important;font-size:11px!important
        }

        .desktop-wizard{
          display:block!important;margin:0 0 14px;padding:0!important;border:0!important;background:transparent!important;
        }
        .desktop-wizard-top{display:none!important}
        .desktop-wizard-tabs{
          display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;
          border:1px solid #e2e5e8;border-radius:12px;overflow:hidden;background:#fff
        }
        .desktop-wizard-tab{
          min-height:50px!important;border:0!important;border-right:1px solid #eceef0!important;
          border-radius:0!important;background:#fff!important;color:#68717a!important;
          font-size:9px!important;font-weight:800!important;cursor:pointer!important
        }
        .desktop-wizard-tab:last-child{border-right:0!important}
        .desktop-wizard-tab span{
          display:inline-grid!important;place-items:center!important;width:22px!important;height:22px!important;
          margin:0 6px 0 0!important;border-radius:999px!important;background:#e8ebee!important;
          color:#6f7780!important;font-size:9px!important
        }
        .desktop-wizard-tab.is-active{background:#fffaf1!important;color:#171b20!important}
        .desktop-wizard-tab.is-active span{background:var(--app-gold)!important;color:white!important}
        .desktop-wizard-tab.is-complete span{background:#aeb6bd!important;color:white!important}

        body.desktop-wizard-active .panel>[data-desktop-step]{display:none!important}
        body.desktop-wizard-active .panel>[data-desktop-step].desktop-step-active{
          display:block!important;animation:stepIn .18s ease-out
        }

        body.desktop-wizard-active .section,
        body.desktop-wizard-active .story-template-panel,
        body.desktop-wizard-active .workflow-panel,
        body.desktop-wizard-active .property-panel,
        body.desktop-wizard-active .logo-library,
        body.desktop-wizard-active .cloud-profile-box,
        body.desktop-wizard-active .export-formats-box,
        body.desktop-wizard-active .story-set-box,
        body.desktop-wizard-active .auto-brand-box{
          margin-top:10px!important;padding:14px 15px!important;border:1px solid #e2e5e8!important;
          border-radius:13px!important;background:#fff!important;color:#171b20!important;
          box-shadow:0 3px 12px rgba(19,28,36,.035)!important
        }
        body.desktop-wizard-active .section-title,
        body.desktop-wizard-active .story-template-title,
        body.desktop-wizard-active .workflow-title,
        body.desktop-wizard-active .property-title,
        body.desktop-wizard-active .logo-library-title,
        body.desktop-wizard-active .cloud-profile-title,
        body.desktop-wizard-active .export-formats-title,
        body.desktop-wizard-active .story-set-title,
        body.desktop-wizard-active .auto-brand-title{
          color:#171b20!important;font-size:13px!important;font-weight:900!important
        }
        body.desktop-wizard-active .label,
        body.desktop-wizard-active .adjust-control-title,
        body.desktop-wizard-active .framing-title,
        body.desktop-wizard-active .story-extra-title{
          color:#30363c!important
        }
        body.desktop-wizard-active .hint,
        body.desktop-wizard-active .story-template-subtitle,
        body.desktop-wizard-active .workflow-subtitle,
        body.desktop-wizard-active .property-subtitle,
        body.desktop-wizard-active .logo-library-subtitle,
        body.desktop-wizard-active .cloud-profile-subtitle,
        body.desktop-wizard-active .export-formats-subtitle,
        body.desktop-wizard-active .story-set-copy{
          color:#7b838b!important;opacity:1!important
        }
        body.desktop-wizard-active .input,
        body.desktop-wizard-active .textarea,
        body.desktop-wizard-active .select,
        body.desktop-wizard-active .file,
        body.desktop-wizard-active .workflow-select,
        body.desktop-wizard-active .realty-profile-select{
          min-height:41px!important;border:1px solid #dfe3e6!important;border-radius:10px!important;
          background:#fff!important;color:#1d2329!important;box-shadow:none!important
        }
        body.desktop-wizard-active .input::placeholder,
        body.desktop-wizard-active .textarea::placeholder{color:#a2a8ae!important}
        body.desktop-wizard-active .input:focus,
        body.desktop-wizard-active .textarea:focus,
        body.desktop-wizard-active .select:focus{
          border-color:#d8a23b!important;box-shadow:0 0 0 3px rgba(216,162,59,.11)!important
        }
        body.desktop-wizard-active .check{color:#30363c!important}
        body.desktop-wizard-active .adjust-control,
        body.desktop-wizard-active .framing-block,
        body.desktop-wizard-active .story-extra-control{
          background:#f7f8f9!important;border-color:#e8ebed!important
        }

        body.desktop-wizard-active .realty-profile-controls{
          border:0!important;background:#f7f8f9!important
        }
        body.desktop-wizard-active .realty-profile-label{color:#5d646b!important}
        body.desktop-wizard-active .realty-profile-select{
          background:white!important
        }
        body.desktop-wizard-active .realty-profile-summary{background:#eef1f3!important;color:#697079!important}
        body.desktop-wizard-active #realty-profile-panel{
          background:#fff!important;border-color:#e2e5e8!important;color:#171b20!important
        }
        body.desktop-wizard-active #realty-profile-panel .realty-profile-title{color:#171b20!important}
        body.desktop-wizard-active #realty-profile-panel .realty-profile-subtitle{color:#7b838b!important;opacity:1!important}
        body.desktop-wizard-active #realty-profile-panel .realty-profile-label{color:#74551e!important}
        body.desktop-wizard-active #realty-profile-panel .realty-profile-card{
          background:#f7f8f9!important;color:#22292f!important;border-color:#e1e5e8!important
        }
        body.desktop-wizard-active #realty-profile-panel .realty-profile-card.is-active{
          background:#fff8e8!important;border-color:#d8a23b!important;box-shadow:0 0 0 2px rgba(216,162,59,.07)!important
        }
        body.desktop-wizard-active #realty-profile-panel .realty-profile-card span:last-child{color:#767f87!important;opacity:1!important}
        body.desktop-wizard-active #realty-profile-panel .realty-profile-badge{
          background:#fff5dc!important;border-color:#ead09c!important;color:#7c581c!important
        }

        body.desktop-wizard-active .story-template-button{
          background:#f6f7f8!important;color:#2c3339!important;border-color:#e5e8eb!important
        }
        body.desktop-wizard-active .story-template-button.is-active{
          background:#fff8e8!important;border-color:#d8a23b!important;color:#7b5316!important
        }
        body.desktop-wizard-active .story-template-current{
          background:#fff5dc!important;border-color:#ead09c!important;color:#7c581c!important
        }

        body.desktop-wizard-active .btn-green,
        body.desktop-wizard-active .property-btn-primary,
        body.desktop-wizard-active .workflow-btn.primary{
          background:#4f7f43!important;color:white!important;border-color:#4f7f43!important
        }
        body.desktop-wizard-active .btn-gold,
        body.desktop-wizard-active .export-package-btn{
          background:linear-gradient(135deg,#c38a2b,#e0ad4a)!important;color:white!important;border-color:#c89335!important
        }
        body.desktop-wizard-active .btn-dark{background:#171d22!important;color:white!important}

        #desktop-preview-mount{
          position:sticky!important;top:24px!important;align-self:start!important;
          min-height:auto!important;height:auto!important;padding:16px!important;border:1px solid rgba(255,255,255,.065)!important;border-radius:18px!important;
          background:linear-gradient(180deg,#10171c,#0b1115)!important;
          box-shadow:0 14px 36px rgba(22,31,38,.16)!important;
          overflow:hidden!important
        }
        #desktop-preview-mount::before{
          content:"Prévia do Story";display:block;position:static!important;margin:0 0 2px 1px!important;
          color:#fff!important;font-size:12px!important;line-height:1.1!important;font-weight:900!important;letter-spacing:-.01em!important
        }
        #desktop-preview-mount::after{
          content:"Visualização ao vivo";display:block;margin:0 0 10px 1px;
          color:#7f8a92;font-size:8px!important;line-height:1.2!important
        }
        #desktop-preview-mount .story-preview-shell{
          width:min(100%,390px)!important;height:auto!important;aspect-ratio:9/16!important;
          margin:8px auto 0!important;border-radius:18px!important;
          box-shadow:0 18px 42px rgba(0,0,0,.36)!important;
          overflow:hidden!important;position:relative!important
        }
        #desktop-preview-mount #preview-format-switch{
          display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important;
          width:100%!important;margin:0 0 10px!important;padding:4px!important;
          border:1px solid rgba(255,255,255,.065)!important;border-radius:11px!important;
          background:rgba(255,255,255,.035)!important
        }
        #desktop-preview-mount #preview-format-switch button{
          min-height:34px!important;padding:6px 8px!important;border-radius:8px!important;
          border:0!important;background:transparent!important;color:#8e989f!important;
          font-size:9px!important;font-weight:900!important
        }
        #desktop-preview-mount #preview-format-switch button.is-active{
          background:#4f7f43!important;color:#fff!important;box-shadow:none!important
        }
        #desktop-preview-mount .feed-preview-shell{
          margin:8px auto 0!important;
          max-width:100%!important;
        }
        #desktop-preview-mount .story-preview-stage{
          width:1080px!important;height:1920px!important;
          transform-origin:top left!important;
        }

        .desktop-wizard-footer{
          position:sticky!important;bottom:12px!important;z-index:90!important;
          display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;
          margin-top:12px!important;padding:8px 9px!important;border:1px solid #dde1e4!important;border-radius:12px!important;
          background:rgba(255,255,255,.95)!important;box-shadow:0 12px 32px rgba(27,36,43,.09)!important;backdrop-filter:blur(12px)
        }
        .desktop-wizard-footer-title{font-size:10px!important;color:#20262c!important}
        .desktop-wizard-footer-hint{font-size:8px!important;color:#7e868d!important}
        .desktop-wizard-action{
          min-height:40px!important;padding:8px 14px!important;border-radius:9px!important;border:1px solid #dfe3e6!important;
          font-size:10px!important;font-weight:900!important
        }
        .desktop-wizard-back{background:#fff!important;color:#4b535a!important}
        .desktop-wizard-next{background:#4f7f43!important;border-color:#4f7f43!important;color:white!important}
      }

      @media(min-width:900px) and (max-width:1450px){
        body.desktop-wizard-active>.max-w-6xl{
          width:calc(100vw - 214px)!important;
          margin-left:204px!important;
          grid-template-columns:minmax(0,1.28fr) minmax(315px,.72fr)!important;
          gap:16px!important;
          padding-top:18px!important;
        }
        #app-sidebar{width:176px!important}
        body.desktop-wizard-active .panel{max-width:none!important}
        #desktop-preview-mount{padding:13px!important}
        #desktop-preview-mount .story-preview-shell{width:min(100%,350px)!important}
        .desktop-wizard-tab{font-size:8px!important}
        .desktop-wizard-tab span{width:20px!important;height:20px!important;margin-right:4px!important}
      }

      @media(min-width:1451px){
        body.desktop-wizard-active>.max-w-6xl{
          margin-left:225px!important;
        }
      }

      @media(max-width:899px){
        html,body{background:#090d10!important}
        #desktop-wizard,
        #desktop-wizard-footer{
          display:none!important;
        }
        .mobile-step-chips{
          display:flex;
          gap:6px;
          overflow-x:auto;
          margin:2px 0 8px;
          padding:2px 1px 4px;
          scrollbar-width:none;
        }
        .mobile-step-chips::-webkit-scrollbar{display:none}
        .mobile-step-chip{
          flex:0 0 auto;
          min-height:32px;
          padding:6px 10px;
          border-radius:999px;
          border:1px solid rgba(255,255,255,.08);
          background:#11171b;
          color:#98a2a9;
          font-size:9px;
          font-weight:850;
          white-space:nowrap;
        }
        .mobile-step-chip.is-active{
          background:linear-gradient(135deg,#c78d2f,#e5b455);
          border-color:#d9a445;
          color:#17120b;
        }
        .mobile-step-chip.is-complete{
          color:#d2d7da;
          border-color:rgba(255,255,255,.12);
        }
        body.mobile-wizard-active{padding-top:70px!important;padding-bottom:112px!important;background:#090d10!important}
        #mobile-app-header{
          display:flex;position:fixed;inset:0 0 auto 0;z-index:250;height:62px;
          align-items:center;justify-content:space-between;padding:8px 14px;
          background:rgba(10,14,17,.97);border-bottom:1px solid rgba(255,255,255,.07);backdrop-filter:blur(14px)
        }
        .mobile-brand{display:flex;align-items:center;gap:9px}
        .mobile-brand img{width:36px;height:36px;border-radius:10px}
        .mobile-brand strong{display:block;font-size:12px;letter-spacing:.02em}
        .mobile-brand span{display:block;margin-top:1px;color:#d8a23b;font-size:7px;letter-spacing:.18em}
        .mobile-header-actions{display:flex;gap:7px}
        .mobile-header-btn{
          display:grid;place-items:center;width:36px;height:36px;border:1px solid rgba(255,255,255,.07);border-radius:10px;
          background:rgba(255,255,255,.035);color:white;font-size:14px
        }

        body.mobile-wizard-active .panel{
          border:0!important;border-radius:0!important;padding:9px!important;background:#090d10!important;box-shadow:none!important
        }
        body.mobile-wizard-active .panel-header{padding:4px 4px 10px!important;border:0!important}
        body.mobile-wizard-active .panel-title{
          font-size:21px!important;letter-spacing:-.035em!important;color:white!important
        }
        body.mobile-wizard-active .panel-subtitle{font-size:10px!important;color:#8e989f!important}

        body.mobile-wizard-active .mobile-wizard-progress{
          position:relative!important;top:auto!important;margin:0 0 8px!important;padding:9px 10px!important;
          border-radius:12px!important;background:#10161a!important;border:1px solid rgba(255,255,255,.07)!important;
          box-shadow:none!important
        }
        body.mobile-wizard-active .mobile-wizard-step-title{font-size:12px!important}
        body.mobile-wizard-active .mobile-wizard-step-count{font-size:9px!important;color:#e3bd70!important}
        body.mobile-wizard-active .mobile-wizard-track{height:3px!important;background:rgba(255,255,255,.08)!important}
        body.mobile-wizard-active .mobile-wizard-track>span{background:#d8a23b!important}

        body.mobile-wizard-active .panel>.section.mobile-step-active,
        body.mobile-wizard-active .story-template-panel,
        body.mobile-wizard-active.mobile-secondary-open .workflow-panel,
        body.mobile-wizard-active.mobile-secondary-open .property-panel{
          margin-top:7px!important;padding:11px!important;border:1px solid rgba(255,255,255,.075)!important;
          border-radius:13px!important;background:linear-gradient(180deg,#12181c,#0f1518)!important;color:white!important;box-shadow:none!important
        }
        body.mobile-wizard-active .section-title,
        body.mobile-wizard-active .story-template-title{font-size:12px!important;color:#f0d08b!important}
        body.mobile-wizard-active .input,
        body.mobile-wizard-active .textarea,
        body.mobile-wizard-active .select,
        body.mobile-wizard-active .file,
        body.mobile-wizard-active .realty-profile-select{
          min-height:42px!important;height:auto!important;border:1px solid rgba(255,255,255,.09)!important;
          border-radius:10px!important;background:#1a2118!important;color:#fff!important;font-size:13px!important
        }
        body.mobile-wizard-active .textarea{min-height:68px!important}
        body.mobile-wizard-active .label{font-size:10px!important;color:#d8ddda!important}
        body.mobile-wizard-active .hint{font-size:9px!important;color:#859096!important}

        body.mobile-wizard-active .story-template-grid{gap:6px!important}
        body.mobile-wizard-active .story-template-button{
          min-height:44px!important;border-radius:10px!important;background:#1a2118!important;border-color:rgba(255,255,255,.09)!important;font-size:10px!important
        }
        body.mobile-wizard-active .story-template-button.is-active{
          background:linear-gradient(135deg,#6f4a17,#8d621f)!important;border-color:#d8a23b!important;color:#f5d89e!important
        }
        body.mobile-wizard-active .realty-profile-controls{
          background:#0e1417!important;border-color:rgba(255,255,255,.06)!important
        }
        body.mobile-wizard-active .realty-profile-summary{background:rgba(255,255,255,.04)!important}

        body.mobile-wizard-active #mobile-secondary-toggle{
          min-height:40px!important;border-radius:11px!important;background:#11171a!important;border-color:rgba(255,255,255,.07)!important;color:#e7c982!important
        }

        body.mobile-wizard-active .mobile-wizard-bar{
          left:8px!important;right:8px!important;bottom:61px!important;z-index:260!important;
          padding:6px!important;border-radius:14px!important;background:rgba(15,20,23,.97)!important;
          border:1px solid rgba(255,255,255,.08)!important;box-shadow:0 14px 35px rgba(0,0,0,.35)!important
        }
        body.mobile-wizard-active .mobile-wizard-btn{min-height:43px!important;border-radius:10px!important;font-size:10px!important}
        body.mobile-wizard-active .mobile-wizard-next{
          background:linear-gradient(135deg,#c58b2b,#e1ae4c)!important;color:#18130b!important;border-color:#d39a36!important
        }
        body.mobile-wizard-active .mobile-wizard-preview{
          background:#241d12!important;border-color:rgba(216,162,59,.28)!important;color:#f0cb7e!important
        }

        #mobile-bottom-nav{
          display:grid;position:fixed;left:0;right:0;bottom:0;z-index:255;
          grid-template-columns:repeat(5,1fr);height:57px;padding:5px 8px max(5px,env(safe-area-inset-bottom));
          background:rgba(8,12,15,.98);border-top:1px solid rgba(255,255,255,.07);backdrop-filter:blur(14px)
        }
        .mobile-bottom-item{
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
          border:0;background:transparent;color:#828c93;font-size:7px;font-weight:800
        }
        .mobile-bottom-item b{font-size:14px;line-height:1}
        .mobile-bottom-item.is-active{color:#e8b85b}
        .mobile-bottom-item.mobile-plus b{
          display:grid;place-items:center;width:36px;height:36px;margin-top:-16px;border-radius:50%;
          background:linear-gradient(135deg,#d4952f,#f0bd58);color:#17120a;font-size:20px;
          box-shadow:0 8px 20px rgba(216,162,59,.22)
        }
      }

      @keyframes stepIn{from{opacity:.55;transform:translateY(4px)}to{opacity:1;transform:none}}
    `;
    document.head.appendChild(style);
  }

  function createChrome(){
    if(!$("app-sidebar")){
      const side=document.createElement("aside");
      side.id="app-sidebar";
      side.innerHTML=`
        <div class="app-brand">
          <img src="/pwa-icon-pro-192.png" alt="Story Imóveis">
          <div class="app-brand-copy"><strong>STORY</strong><span>IMÓVEIS</span></div>
        </div>
        <button class="app-side-primary" type="button" data-side-step="1">＋ Novo Story</button>
        <div class="app-side-menu">
          <button class="app-side-item is-active" type="button" data-side-step="1"><b>⌕</b>Novo Story</button>
          <button class="app-side-item" type="button" data-side-step="6"><b>▣</b>Meus Stories</button>
          <button class="app-side-item" type="button" data-side-step="2"><b>◇</b>Modelos</button>
          <button class="app-side-item" type="button" data-side-step="5"><b>▦</b>Minhas imobiliárias</button>
          <button class="app-side-item" type="button" data-side-step="4"><b>?</b>Tutoriais</button>
          <button class="app-side-item" type="button" data-side-step="5"><b>⚙</b>Configurações</button>
        </div>
        <div class="app-side-plan"><small>PLANO ATUAL</small><strong>★ Profissional</strong></div>
      `;
      document.body.appendChild(side);
      side.addEventListener("click",(e)=>{
        const b=e.target.closest("[data-side-step]");
        if(!b) return;
        setDesktopStep(Number(b.dataset.sideStep));
      });
    }

    if(!$("mobile-app-header")){
      const head=document.createElement("header");
      head.id="mobile-app-header";
      head.innerHTML=`
        <div class="mobile-brand">
          <img src="/pwa-icon-pro-192.png" alt="Story Imóveis">
          <div><strong>STORY</strong><span>IMÓVEIS</span></div>
        </div>
        <div class="mobile-header-actions">
          <button class="mobile-header-btn" type="button" aria-label="Notificações">♢</button>
          <button class="mobile-header-btn" id="mobile-menu-button" type="button" aria-label="Menu">☰</button>
        </div>
      `;
      document.body.appendChild(head);
      $("mobile-menu-button")?.addEventListener("click",()=>document.getElementById("mobile-secondary-toggle")?.click());
    }

    if(!$("mobile-step-chips")){
      const panel=document.querySelector(".panel");
      const header=panel?.querySelector(".panel-header");
      if(panel && header){
        const chips=document.createElement("div");
        chips.id="mobile-step-chips";
        chips.className="mobile-step-chips";
        chips.innerHTML=STEPS.map((s,i)=>`<button type="button" class="mobile-step-chip" data-mobile-chip="${i+1}">${i+1}. ${s[1]}</button>`).join("");
        header.insertAdjacentElement("afterend",chips);
        chips.addEventListener("click",e=>{
          const b=e.target.closest("[data-mobile-chip]");
          if(!b) return;
          window.setMobileWizardStep?.(Number(b.dataset.mobileChip));
        });
      }
    }

    if(!$("mobile-bottom-nav")){
      const nav=document.createElement("nav");
      nav.id="mobile-bottom-nav";
      nav.innerHTML=`
        <button class="mobile-bottom-item is-active" type="button" data-mobile-nav="1"><b>⌂</b>Início</button>
        <button class="mobile-bottom-item" type="button" data-mobile-nav="6"><b>▯</b>Stories</button>
        <button class="mobile-bottom-item mobile-plus" type="button" data-mobile-nav="1"><b>＋</b>Novo</button>
        <button class="mobile-bottom-item" type="button" data-mobile-nav="2"><b>◇</b>Modelos</button>
        <button class="mobile-bottom-item" type="button" id="mobile-more-nav"><b>•••</b>Mais</button>
      `;
      document.body.appendChild(nav);
      nav.addEventListener("click",(e)=>{
        const b=e.target.closest("[data-mobile-nav]");
        if(!b) return;
        const step=Number(b.dataset.mobileNav);
        window.setMobileWizardStep?.(step);
      });
      $("mobile-more-nav")?.addEventListener("click",()=>document.getElementById("mobile-secondary-toggle")?.click());
    }
  }

  function directPanelChild(el){return el && el.parentElement?.classList?.contains("panel")}
  function assign(el,step){if(directPanelChild(el)) el.dataset.desktopStep=String(step)}

  function classify(){
    const panel=document.querySelector(".panel"); if(!panel) return;
    [...panel.children].forEach(el=>{
      if(el.classList.contains("panel-header")||el.id==="desktop-wizard"||el.id==="desktop-wizard-footer") return;
      if(el.id==="workflow-panel"||el.id==="property-panel"||el.id==="realty-profile-panel"||el.querySelector?.("#imovel-url")) return assign(el,1);
      if(el.id==="story-template-panel"||el.querySelector?.("#badge")||el.querySelector?.("#title")||el.querySelector?.("#price")||el.querySelector?.("#city")||el.querySelector?.("#district")||el.querySelector?.("#area")) return assign(el,2);
      if(el.id==="mobile-description-section"||el.querySelector?.("#description")||el.querySelector?.("#contact")) return assign(el,3);
      if(el.id==="mobile-image-section"||el.id==="adjustment-section"||el.querySelector?.("#image-upload-story")) return assign(el,4);
      if(el.id==="mobile-logo-section"||el.id==="story-advanced-section"||el.id==="logo-library"||el.id==="cloud-profile-box"||el.id==="auto-brand-box"||el.querySelector?.("#logo-upload-story")||el.querySelector?.("#more-photos-url")) return assign(el,5);
      if(el.id==="story-set-box"||el.id==="export-formats-box"||el.querySelector?.("#download-story")||el.querySelector?.("#post-story")||el.querySelector?.("#export-package")) return assign(el,6);
      if(el.classList.contains("section")||/panel|box|library/.test(el.className||"")) assign(el,6);
    });
  }

  function createWizard(){
    const panel=document.querySelector(".panel"); if(!panel||$("desktop-wizard")) return;
    const nav=document.createElement("div");
    nav.id="desktop-wizard"; nav.className="desktop-wizard";
    nav.innerHTML=`
      <div class="desktop-wizard-top"><div><div class="desktop-wizard-kicker">Fluxo de criação</div><div id="desktop-wizard-title" class="desktop-wizard-title"></div></div><div id="desktop-wizard-count" class="desktop-wizard-count"></div></div>
      <div class="desktop-wizard-tabs">
        ${STEPS.map((s,i)=>`<button class="desktop-wizard-tab" type="button" data-desktop-go="${i+1}"><span>${i+1}</span>${s[1]}</button>`).join("")}
      </div>`;
    panel.querySelector(".panel-header")?.insertAdjacentElement("afterend",nav);
    nav.addEventListener("click",e=>{const b=e.target.closest("[data-desktop-go]");if(b)setDesktopStep(Number(b.dataset.desktopGo))});

    const foot=document.createElement("div");
    foot.id="desktop-wizard-footer"; foot.className="desktop-wizard-footer";
    foot.innerHTML=`
      <div class="desktop-wizard-footer-copy"><div id="desktop-footer-title" class="desktop-wizard-footer-title"></div><div id="desktop-footer-hint" class="desktop-wizard-footer-hint"></div></div>
      <div class="desktop-wizard-footer-actions"><button id="desktop-wizard-back" class="desktop-wizard-action desktop-wizard-back" type="button">Voltar</button><button id="desktop-wizard-next" class="desktop-wizard-action desktop-wizard-next" type="button">Próximo →</button></div>`;
    panel.appendChild(foot);
    $("desktop-wizard-back")?.addEventListener("click",()=>setDesktopStep(desktopStep-1));
    $("desktop-wizard-next")?.addEventListener("click",()=>setDesktopStep(desktopStep+1));
  }

  function setDesktopStep(step){
    desktopStep=Math.max(1,Math.min(6,step)); classify();
    document.querySelectorAll(".panel>[data-desktop-step]").forEach(el=>el.classList.toggle("desktop-step-active",Number(el.dataset.desktopStep)===desktopStep));
    const meta=STEPS[desktopStep-1];
    if($("desktop-wizard-title")) $("desktop-wizard-title").textContent=meta[0];
    if($("desktop-wizard-count")) $("desktop-wizard-count").textContent=`Etapa ${desktopStep} de 6`;
    if($("desktop-footer-title")) $("desktop-footer-title").textContent=meta[0];
    if($("desktop-footer-hint")) $("desktop-footer-hint").textContent=meta[2];
    document.querySelectorAll(".desktop-wizard-tab").forEach(b=>{
      const n=Number(b.dataset.desktopGo);b.classList.toggle("is-active",n===desktopStep);b.classList.toggle("is-complete",n<desktopStep)
    });
    document.querySelectorAll(".app-side-item").forEach(b=>b.classList.toggle("is-active",Number(b.dataset.sideStep)===desktopStep));
    if($("desktop-wizard-back")) $("desktop-wizard-back").disabled=desktopStep===1;
    if($("desktop-wizard-next")){
      $("desktop-wizard-next").style.display=desktopStep===6?"none":"";
      $("desktop-wizard-next").textContent=desktopStep===5?"Revisar →":"Próximo →";
    }
    if(matchMedia(DESKTOP).matches) scrollTo({top:0,behavior:"smooth"});
  }

  function resizeDesktopPreview(){
    if(!matchMedia(DESKTOP).matches) return;
    const shell=document.querySelector("#desktop-preview-mount .story-preview-shell");
    const stage=document.querySelector("#desktop-preview-mount .story-preview-stage");
    if(!shell||!stage) return;

    const mount=document.getElementById("desktop-preview-mount");
    const availableWidth=Math.max(280,Math.min(390,(mount?.clientWidth||390)-30));
    const viewportHeight=Math.max(560,window.innerHeight-125);
    const maxByHeight=viewportHeight*(9/16);
    const width=Math.min(availableWidth,maxByHeight);

    shell.style.width=`${width}px`;
    shell.style.height=`${width*(16/9)}px`;

    const scale=width/1080;
    stage.style.transform=`scale(${scale})`;
    stage.style.transformOrigin="top left";
  }

  function updateMobileChips(step){
    document.querySelectorAll(".mobile-step-chip").forEach((b)=>{
      const n=Number(b.dataset.mobileChip);
      b.classList.toggle("is-active",n===step);
      b.classList.toggle("is-complete",n<step);
      if(n===step) b.scrollIntoView({behavior:"smooth",inline:"center",block:"nearest"});
    });
  }

  window.addEventListener("mobile-wizard-step-change",(e)=>updateMobileChips(Number(e.detail||1)));

  function sync(){
    const desk=matchMedia(DESKTOP).matches;
    document.body.classList.toggle("desktop-wizard-active",desk);
    if(desk){
      setDesktopStep(desktopStep);
      requestAnimationFrame(resizeDesktopPreview);
    }
  }

  document.addEventListener("DOMContentLoaded",()=>{
    injectStyles();createChrome();
    setTimeout(()=>{
      createWizard();classify();
      const panel=document.querySelector(".panel");
      if(panel)new MutationObserver(()=>{classify();if(matchMedia(DESKTOP).matches)setDesktopStep(desktopStep)}).observe(panel,{childList:true});
      matchMedia(DESKTOP).addEventListener?.("change",sync);
      window.addEventListener("resize",()=>requestAnimationFrame(resizeDesktopPreview));
      window.addEventListener("orientationchange",()=>setTimeout(resizeDesktopPreview,120));
      sync();
    },100);
  });
})();