import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const SOURCE=path.dirname(fileURLToPath(import.meta.url));
const pause=ms=>new Promise(done=>setTimeout(done,ms));
const keys={OPENAI_API_KEY:'',GEMINI_API_KEY:'',GROQ_API_KEY:'',OPENROUTER_API_KEY:'',OLLAMA_ENABLED:'0',TEXT_AI_PROVIDER:'auto',FREE_AI_MODEL:'',REMOVE_BG_API_KEY:'',REPLICATE_API_TOKEN:''};
async function runServer(dir, vars={}){
 const port=38000+Math.floor(Math.random()*1800),url=`http://localhost:${port}`;
 const proc=spawn(process.execPath,['--import','./test-fixtures/mock-providers.mjs','server.mjs'],{cwd:dir,env:{...process.env,...keys,...vars,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 let logs='';proc.stdout.on('data',chunk=>logs+=chunk);proc.stderr.on('data',chunk=>logs+=chunk);
 for(let attempt=0;attempt<70;attempt++){
  try{const r=await fetch(url+'/api/health');if(r.ok)return{proc,url,logs:()=>logs};}catch{}
  await pause(60);
 }
 proc.kill();throw Error('Server failed to start: '+logs);
}
const req=(url,tool,fields)=>fetch(url+'/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool,fields})});
async function withServer(vars,callback){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'aitlas-v4-free-'));
 try{
  for(const name of ['server.mjs','admin-settings.mjs','index.html','app.js','settings.js','styles.css','favicon.svg'])await fs.copyFile(path.join(SOURCE,name),path.join(temp,name));
  await fs.cp(path.join(SOURCE,'test-fixtures'),path.join(temp,'test-fixtures'),{recursive:true});
  const current=await runServer(temp,vars);
  try{await callback({...current,dir:temp})}finally{current.proc.kill();await pause(120)}
 }finally{await fs.rm(temp,{recursive:true,force:true})}
}
for(const [provider,vars,expected] of [
 ['gemini',{GEMINI_API_KEY:'gemini-test-123'},'GEMINI MOCK'],
 ['groq',{GROQ_API_KEY:'groq-test-123'},'GROQ MOCK'],
 ['openrouter',{OPENROUTER_API_KEY:'openrouter-test-123'},'OPENROUTER MOCK'],
 ['ollama',{OLLAMA_ENABLED:'1'},'OLLAMA MOCK']
]){
 test(`${provider}: routes AI generation through actual provider interface`,async()=>withServer({...vars,TEXT_AI_PROVIDER:provider},async({url})=>{
  const health=await(await fetch(url+'/api/health')).json();assert.equal(health.ai,true);assert.equal(health.provider,provider);
  const resp=await req(url,'translate',{text:'How are you?',language:'Urdu'});
  assert.equal(resp.status,200,`${provider}: ${await resp.clone().text()}`);
  const answer=await resp.json();assert.match(answer.text,new RegExp(expected));assert.match(answer.text,/How are you/);
  const json=await req(url,'json',{json:'{ name: person }',indent:'2 spaces'});assert.equal(json.status,200);
  assert.deepEqual(JSON.parse((await json.json()).text),{fixed:true,items:[1,2]});
  const home=await(await fetch(url+'/')).text();
  assert.match(home,/id="geminiStatus"/);assert.match(home,/id="aiProvider"/);assert.match(home,/AI Settings/);
 }));
}
test('auto prefers connected free providers to configured paid OpenAI',async()=>withServer({OPENAI_API_KEY:'openai-test-123',GEMINI_API_KEY:'gemini-test-123',TEXT_AI_PROVIDER:'auto'},async({url})=>{
 const h=await(await fetch(url+'/api/health')).json();assert.equal(h.provider,'gemini');
 const r=await req(url,'titles',{topic:'How to code',count:'5'});assert.match((await r.json()).text,/GEMINI MOCK/);
}));
test('explicitly selected unconfigured provider cannot silently switch to a paid one',async()=>withServer({OPENAI_API_KEY:'openai-test-123',TEXT_AI_PROVIDER:'gemini'},async({url})=>{
 const h=await(await fetch(url+'/api/health')).json();assert.equal(h.ai,false);
 const response=await req(url,'email',{goal:'Test'});assert.equal(response.status,503);
 assert.match((await response.json()).error,/not connected/);
}));
test('owner saves free AI key and provider from UI, switches provider and retains encrypted keys across restart',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'aitlas-v4-save-'));
 try{
  for(const name of ['server.mjs','admin-settings.mjs','index.html','app.js','settings.js','styles.css','favicon.svg'])await fs.copyFile(path.join(SOURCE,name),path.join(temp,name));
  await fs.cp(path.join(SOURCE,'test-fixtures'),path.join(temp,'test-fixtures'),{recursive:true});
  let instance=await runServer(temp);
  try{
   const code=instance.logs().match(/setup code: ([a-f0-9]{32})/)?.[1];assert.ok(code);
   const setup=await fetch(instance.url+'/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,password:'owner v4 strong password 111111'})});
   assert.equal(setup.status,200);const cookie=setup.headers.get('set-cookie').split(';')[0];
   const update=async body=>fetch(instance.url+'/api/admin/config',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
   let response=await update({provider:'gemini',gemini:'gemini-private-12345'});assert.equal(response.status,200);
   assert.equal((await(await fetch(instance.url+'/api/health')).json()).provider,'gemini');
   assert.match((await(await req(instance.url,'tone',{text:'Hello',tone:'Friendly'})).json()).text,/GEMINI MOCK/);
   response=await update({provider:'openrouter',openrouter:'openrouter-private-12345'});assert.equal(response.status,200);
   assert.match((await(await req(instance.url,'titles',{topic:'New title'})).json()).text,/OPENROUTER MOCK/);
   response=await update({provider:'ollama',ollamaEnabled:true,ollamaModel:'llama3.2'});assert.equal(response.status,200);
   assert.match((await(await req(instance.url,'email',{goal:'Hello'})).json()).text,/OLLAMA MOCK/);
   response=await update({provider:'gemini',ollamaEnabled:false,clear_gemini:true});assert.equal(response.status,200);
   assert.equal((await(await fetch(instance.url+'/api/health')).json()).ai,false);
   response=await update({provider:'openrouter'});assert.equal(response.status,200);
   const disk=await fs.readFile(path.join(temp,'.aitlas-private/settings.json'),'utf8');
   assert.ok(!disk.includes('openrouter-private-12345'),'API key should be encrypted at rest');
   assert.ok(!disk.includes('gemini-private-12345'),'Removed key must not be in settings file');
   const leaked=await fetch(instance.url+'/.aitlas-private/settings.json');assert.equal(leaked.status,404);
  }finally{instance.proc.kill();await pause(160)}
  instance=await runServer(temp);
  try{
   assert.equal((await(await fetch(instance.url+'/api/health')).json()).provider,'openrouter');
   assert.match((await(await req(instance.url,'translate',{text:'Welcome',language:'Urdu'})).json()).text,/OPENROUTER MOCK/);
  }finally{instance.proc.kill()}
 }finally{await fs.rm(temp,{recursive:true,force:true})}
});
