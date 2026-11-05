'use strict';
(() => {
 const $=id=>document.getElementById(id);
 const STORE='aitlas-ai-runtime-v8';
 const SESSION='aitlas-ai-session-key-v8';
 const defaults={mode:'auto',provider:'gemini',model:'',remember:false,key:''};
 function read(){
   let saved={};try{saved=JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch{}
   let sessionKey='';try{sessionKey=sessionStorage.getItem(SESSION)||''}catch{}
   return {...defaults,...saved,key:saved.remember?(saved.key||''):sessionKey};
 }
 function write(cfg){
   const safe={mode:cfg.mode,provider:cfg.provider,model:cfg.model||'',remember:Boolean(cfg.remember)};
   try{
     if(cfg.remember){safe.key=cfg.key||'';localStorage.setItem(STORE,JSON.stringify(safe));sessionStorage.removeItem(SESSION);}
     else{localStorage.setItem(STORE,JSON.stringify(safe));if(cfg.key)sessionStorage.setItem(SESSION,cfg.key);else sessionStorage.removeItem(SESSION);}
   }catch{}
 }
 let current=read();let server={ai:false,provider:null};
 function message(text,kind='info'){const el=$('settingsAlert');el.textContent=text;el.dataset.kind=kind;}
 function updatePersonalVisibility(){const personal=$('personalProviderTile');if(personal)personal.hidden=$('aiMode').value!=='personal';}
 async function checkServer(){
   if(location.protocol==='file:'){server={ai:false,provider:null};$('serverAiStatus').textContent='Direct file mode · server AI is unavailable; Browser AI is used.';return server;}
   try{const r=await fetch('/api/health',{signal:AbortSignal.timeout(5000)});const j=await r.json();server=j;$('serverAiStatus').textContent=j.ai?`Vercel server AI ready · ${j.provider}`:'Vercel server AI is not configured · automatic mode will use Browser AI';return j;}
   catch{server={ai:false,provider:null};$('serverAiStatus').textContent='Could not reach the Vercel AI function · automatic mode will try Browser AI';return server;}
 }
 async function load(){
   current=read();$('aiMode').value=current.mode;$('aiProvider').value=current.provider;$('personalAiModel').value=current.model||'';$('rememberAiKey').checked=Boolean(current.remember);$('personalAiKey').value=current.key||'';$('browserModel').value=BrowserAI.currentModel();
   const supported=BrowserAI.support();$('browserAiStatus').textContent=supported?'WebGPU detected · free Browser AI is available.':'WebGPU is unavailable · hosted AI will be needed for text tools.';updatePersonalVisibility();await checkServer();
   const autoReady=server.ai||supported;message(autoReady?'AI is ready. Automatic mode will choose the best available option.':'No AI engine is ready on this device yet. Add a personal key or configure a Vercel provider. ',autoReady?'ok':'info');
 }
 function getRuntime(){current=read();return {...current,serverReady:Boolean(server.ai),serverProvider:server.provider,browserReady:BrowserAI.support()};}
 globalThis.AitlasSettings={getRuntime,refresh:checkServer};
 $('aiMode').addEventListener('change',updatePersonalVisibility);
 $('browserModel').addEventListener('change',e=>{BrowserAI.setModel(e.target.value);$('browserAiStatus').textContent='Model changed. It will download when you generate or press Load.';});
 $('browserAiPrepare').addEventListener('click',async()=>{const btn=$('browserAiPrepare');btn.disabled=true;BrowserAI.onProgress(t=>$('browserAiStatus').textContent=t);try{await BrowserAI.ensure();$('browserAiStatus').textContent='Free Browser AI model is ready!';message('Browser AI is loaded and ready.','ok');}catch(e){$('browserAiStatus').textContent=e.message;message(e.message,'error');}finally{btn.disabled=false}});
 $('settingsConfig').addEventListener('submit',async e=>{e.preventDefault();current={mode:$('aiMode').value,provider:$('aiProvider').value,model:$('personalAiModel').value.trim(),key:$('personalAiKey').value.trim(),remember:$('rememberAiKey').checked};if(current.mode==='personal'&&!current.key){message('Paste an API key for Personal API key mode.','error');return;}write(current);message('AI settings saved. Your next tool request will use these settings.','ok');if(typeof refreshProviderStatus==='function')await refreshProviderStatus();});
 $('clearPersonalAi').addEventListener('click',()=>{current={...read(),key:'',remember:false};try{sessionStorage.removeItem(SESSION);const saved=JSON.parse(localStorage.getItem(STORE)||'{}');delete saved.key;saved.remember=false;localStorage.setItem(STORE,JSON.stringify(saved));}catch{}$('personalAiKey').value='';$('rememberAiKey').checked=false;message('Saved personal API key cleared from this browser.','ok');});
 function close(){$('settingsLayer').hidden=true;document.body.classList.remove('settings-open');}
 const open=()=>{$('settingsLayer').hidden=false;document.body.classList.add('settings-open');load();};
 $('settingsBtn').addEventListener('click',open);$('workbenchSettingsBtn').addEventListener('click',open);$('settingsBackdrop').addEventListener('click',close);$('closeSettings').addEventListener('click',close);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('settingsLayer').hidden){e.stopImmediatePropagation();close();}},true);
})();
