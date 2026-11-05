import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
const code=await fs.readFile(path.join(root,'app.js'),'utf8');
const context=vm.createContext({document:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},console,Date,Set,Map,URL,JSON,AbortSignal});
vm.runInContext(code,context,{filename:'app.js'});
const evaluate=snippet=>vm.runInContext(snippet,context);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/PL0AAAAASUVORK5CYII=','base64');
const ids=['email','rewrite','grammar','summarizer','code','json','regex','sql','notes','flashcards','quiz','study'];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function withServer(env,callback,mock=false){
 const port=34500+Math.floor(Math.random()*1000);
 const argv=mock?['--import','./test-fixtures/mock-providers.mjs','server.mjs']:['server.mjs'];
 const server=spawn(process.execPath,argv,{cwd:root,env:{...process.env,OPENAI_API_KEY:'',REMOVE_BG_API_KEY:'',REPLICATE_API_TOKEN:'',...env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 const address=`http://127.0.0.1:${port}`;let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
 try{
  let ready=false;for(let i=0;i<60;i++){try{const r=await fetch(address+'/api/health');if(r.ok){ready=true;break}}catch{}await pause(60)}
  assert.ok(ready,'server should start: '+logs);return await callback(address);
 }finally{server.kill();}
}
test('16 tools, 15 text AI tools, 1 local converter',()=>{
 assert.equal(evaluate('toolList.length'),16);
 for(const [category,count] of [['writing',7],['images',1],['developer',4],['student',4]])assert.equal(evaluate(`toolList.filter(t=>t.category===${JSON.stringify(category)}).length`),count);
 assert.ok(!code.includes('localGenerate('),'no template result fallback');
 assert.ok(!code.includes('function removeBg('),'no fake color-only background remover');
 assert.ok(!code.includes("{id:'resume'"),'retired tool is absent');
 assert.ok(!code.includes("{id:'background'"),'retired tool is absent');
 assert.ok(!code.includes("{id:'enhancer'"),'retired tool is absent');
});
test('missing API keys report SETUP NEEDED and requests fail clearly',async()=>withServer({},async address=>{
 const health=await (await fetch(address+'/api/health')).json();assert.deepEqual([health.ai,health.converter],[false,true]);
 const result=await fetch(address+'/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool:'email',fields:{goal:'Hello'}})});
 assert.equal(result.status,503);assert.match((await result.json()).error,/AI Settings/);
 for(const operation of ['background','enhancer']){
  const r=await fetch(`${address}/api/images/${operation}`,{method:'POST',headers:{'Content-Type':'image/png'},body:png});
  assert.equal(r.status,405);assert.match((await r.json()).error,/Method not allowed/);
 }
 assert.equal((await fetch(address+'/.env')).status,404);
 assert.equal((await fetch(address+'/server.mjs')).status,404);
 const home=await fetch(address+'/');assert.equal(home.status,200);assert.match(await home.text(),/AI Toolbox/i);
}));
test('all 12 original remaining AI tools send actual user input to an AI provider when configured',async()=>withServer({OPENAI_API_KEY:'test-token'},async address=>{
 assert.equal((await (await fetch(address+'/api/health')).json()).ai,true);
 for(const id of ids){
  const r=await fetch(address+'/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool:id,fields:{text:'User supplied material',indent:'2 spaces'}})});
  const result=await r.json();assert.equal(r.status,200,`${id}: ${JSON.stringify(result)}`);assert.equal(result.engine,'OpenAI');
  if(id==='json')assert.deepEqual(JSON.parse(result.text),{fixed:true,items:[1,2]});
  else {assert.match(result.text,/REAL MODEL MOCK/);assert.match(result.text,/User supplied material/)}
 }
 const bad=await fetch(address+'/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool:'execute-code',fields:{text:'abc'}})});
 assert.equal(bad.status,400);
},true));
test('removed AI image routes are unavailable',async()=>withServer({},async address=>{
 for(const operation of ['background','enhancer']){
  const r=await fetch(address+`/api/images/${operation}`,{method:'POST',headers:{'Content-Type':'image/png'},body:png});
  assert.equal(r.status,405);
 }
}));
test('owner setup inside the site protects keys, activates AI immediately and survives restart',async()=>{
 const os=await import('node:os');const {mkdtemp,cp,rm,readFile}=fs;
 const temp=await mkdtemp(path.join(os.tmpdir(),'aitlas-settings-test-'));
 try{
  for(const name of ['server.mjs','admin-settings.mjs','index.html','app.js','settings.js','styles.css','favicon.svg','package.json'])await cp(path.join(root,name),path.join(temp,name));
  await cp(path.join(root,'test-fixtures'),path.join(temp,'test-fixtures'),{recursive:true});
  const port=36000+Math.floor(Math.random()*1000),base=`http://localhost:${port}`;
  async function launch(){
   const proc=spawn(process.execPath,['--import','./test-fixtures/mock-providers.mjs','server.mjs'],{cwd:temp,env:{...process.env,OPENAI_API_KEY:'',REMOVE_BG_API_KEY:'',REPLICATE_API_TOKEN:'',PORT:String(port)},stdio:['ignore','pipe','pipe']});
   let logs='';proc.stdout.on('data',b=>logs+=b);proc.stderr.on('data',b=>logs+=b);
   for(let i=0;i<90;i++){try{const r=await fetch(base+'/api/health');if(r.ok)return {proc,logs:()=>logs};}catch{}await pause(70)}
   proc.kill();throw Error('Server did not start: '+logs);
  }
  let run=await launch();
  try{
   const code=run.logs().match(/setup code: ([a-f0-9]{32})/)?.[1];assert.ok(code,'one-time owner code should appear only in server logs');
   const home=await(await fetch(base+'/')).text();assert.match(home,/id="settingsBtn"/);assert.match(home,/id="openaiKeyInput"/);
   assert.ok(!(await(await fetch(base+'/api/admin/status')).json()).authenticated);
   const publicSettings=await fetch(base+'/api/admin/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({openai:'a-secret-token'})});assert.equal(publicSettings.status,401);
   const newOwner=await fetch(base+'/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,password:'a very long owner password 123!'})});
   assert.equal(newOwner.status,200,JSON.stringify(await newOwner.clone().json()));
   const initial=await newOwner.json();assert.equal(initial.authenticated,true);
   const cookie=newOwner.headers.get('set-cookie').split(';')[0];assert.ok(cookie.startsWith('aitlas_admin='));assert.ok(newOwner.headers.get('set-cookie').includes('HttpOnly'));
   const save=await fetch(base+'/api/admin/config',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({openai:'sk-settings-test-secret',model:'gpt-4.1'})});assert.equal(save.status,200);
   const result=await(await fetch(base+'/api/admin/status',{headers:{Cookie:cookie}})).json();assert.deepEqual([result.authenticated,result.ai,result.model],[true,true,'gpt-4.1']);
   const publicHealth=await(await fetch(base+'/api/health')).json();assert.equal(publicHealth.ai,true);assert.ok(!JSON.stringify(publicHealth).includes('sk-settings-test-secret'));
   const ai=await fetch(base+'/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool:'email',fields:{goal:'test key configured from UI'}})});assert.equal(ai.status,200,JSON.stringify(await ai.clone().json()));assert.match((await ai.json()).text,/REAL MODEL MOCK/);
   assert.equal((await fetch(base+'/.aitlas-private/settings.json')).status,404);
   const keyfile=await readFile(path.join(temp,'.aitlas-private','settings.json'),'utf8');assert.ok(!keyfile.includes('sk-settings-test-secret'));
   assert.equal((await fetch(base+'/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,password:'another password 12345'})})).status,409);
   const wrong=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'incorrect password'})});assert.equal(wrong.status,401);
   const logout=await fetch(base+'/api/admin/logout',{method:'POST',headers:{Cookie:cookie},body:'{}'});assert.equal(logout.status,200);
   assert.equal((await fetch(base+'/api/admin/config',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:'{}'})).status,401);
  }finally{run.proc.kill();await pause(180)}
  run=await launch();
  try{
   assert.ok(!run.logs().includes('setup code:'),'settings are persistent; owner setup code must not recur');
   assert.equal((await(await fetch(base+'/api/health')).json()).ai,true,'saved OpenAI service works after restart');
   const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'a very long owner password 123!'})});assert.equal(login.status,200);
   assert.equal((await login.json()).authenticated,true);
  }finally{run.proc.kill()}
 }finally{await rm(temp,{recursive:true,force:true})}
});
