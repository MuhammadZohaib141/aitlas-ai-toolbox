/** Owner-only provider settings. Secrets never leave the server after submission. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes, scrypt as scryptCallback, timingSafeEqual, createCipheriv, createDecipheriv} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
const COOKIE='aitlas_admin';
const SESSION_MS=8*60*60*1000;
const FIELDS={openai:'OPENAI_API_KEY',gemini:'GEMINI_API_KEY',groq:'GROQ_API_KEY',openrouter:'OPENROUTER_API_KEY'};
const PROVIDERS=new Set(['auto','openai','gemini','groq','openrouter','ollama']);
const MAX_BYTES=12000;
const MODEL=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/;
const SECRET=/^[\x21-\x7e]{8,300}$/;

export async function createAdmin({root,config,sendJson,readBody,error}){
 const dir=path.join(root,'.aitlas-private');
 const file=path.join(dir,'settings.json');
 const keyFile=path.join(dir,'master.key');
 let saved=null,master=null;
 const sessions=new Map(),attempts=new Map();
 let setupCode='';
 try{
  const [json,key]=await Promise.all([fs.readFile(file,'utf8'),fs.readFile(keyFile)]);
  saved=JSON.parse(json);if(key.length!==32)throw Error('Invalid encryption key.');master=key;
  const provider=decrypt(saved.secrets);
  for(const [field,value] of Object.entries(provider))if(field in FIELDS&&typeof value==='string')config[field]=value;
  if(typeof provider.model==='string'&&MODEL.test(provider.model))config.model=provider.model;
  if(typeof provider.provider==='string'&&PROVIDERS.has(provider.provider))config.provider=provider.provider;
  if(typeof provider.freeModel==='string')config.freeModel=provider.freeModel;
  if(typeof provider.ollamaModel==='string')config.ollamaModel=provider.ollamaModel;
  if(typeof provider.ollamaEnabled==='boolean')config.ollamaEnabled=provider.ollamaEnabled;
  console.log('Owner AI settings loaded from private storage.');
 }catch(e){
  if(e.code!=='ENOENT')throw e;
  const entries=await Promise.all([fs.stat(file).catch(()=>null),fs.stat(keyFile).catch(()=>null)]);
  if(entries.some(Boolean))throw Error('Owner settings are incomplete; restore the private settings and master key from a backup.');
  setupCode=randomBytes(16).toString('hex');
  console.log('\n[AITLAS OWNER SETUP] Open AI Settings in the website and use this one-time setup code: '+setupCode+'\nThis code only appears in your server terminal or hosting logs. Do not share it.\n');
 }
 function decrypt(sealed){
  const iv=Buffer.from(sealed.iv,'base64'),tag=Buffer.from(sealed.tag,'base64');
  const cipher=createDecipheriv('aes-256-gcm',master,iv);cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(sealed.data,'base64')),cipher.final()]).toString('utf8'));
 }
 function encrypt(data){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',master,iv);
  const bytes=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
  return {iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:bytes.toString('base64')};
 }
 async function persist(){
  await fs.mkdir(dir,{recursive:true,mode:0o700});
  const contents=JSON.stringify({version:1,salt:saved.salt,hash:saved.hash,secrets:encrypt({openai:config.openai,gemini:config.gemini,groq:config.groq,openrouter:config.openrouter,model:config.model,provider:config.provider,freeModel:config.freeModel,ollamaModel:config.ollamaModel,ollamaEnabled:config.ollamaEnabled})});
  const tmp=path.join(dir,`.settings-${randomBytes(8).toString('hex')}.tmp`);
  try{await fs.writeFile(tmp,contents,{mode:0o600,flag:'wx'});await fs.rename(tmp,file);await fs.chmod(file,0o600)}
  finally{await fs.rm(tmp,{force:true}).catch(()=>{})}
 }
 function requirePrivateConnection(req){
  const ip=req.socket.remoteAddress||'';
  const local=['::1','127.0.0.1','::ffff:127.0.0.1'].includes(ip)&&/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host||'');
  const secure=Boolean(req.socket.encrypted)||(process.env.TRUST_PROXY==='1'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip)&&req.headers['x-forwarded-proto']==='https');
  if(!local&&!secure)throw error(403,'Owner settings need HTTPS. For a local setup, open http://localhost:3000.');
  const origin=req.headers.origin;
  if(origin){let u;try{u=new URL(origin)}catch{throw error(403,'Invalid request origin.')}if(u.host!==req.headers.host)throw error(403,'Cross-site settings requests are not allowed.');}
  return secure;
 }
 function session(req){
  const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  const expiry=token?sessions.get(token):undefined;
  if(!expiry)return null;
  if(expiry<Date.now()){sessions.delete(token);return null}
  return token;
 }
 function setSession(res,secure){
  const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+SESSION_MS);
  if(sessions.size>1000)for(const [key,value] of sessions)if(value<Date.now())sessions.delete(key);
  res.setHeader('Set-Cookie',`${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${SESSION_MS/1000}${secure?'; Secure':''}`);
 }
 function clearSession(res,req,secure){const token=session(req);if(token)sessions.delete(token);res.setHeader('Set-Cookie',`${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0${secure?'; Secure':''}`)}
 function throttle(req){
  const ip=req.socket.remoteAddress||'unknown',now=Date.now();let item=attempts.get(ip);
  if(!item||now-item.time>15*60*1000)item={count:0,time:now};
  if(item.count>=8)throw error(429,'Too many attempts. Try again in 15 minutes.');
  item.count++;attempts.set(ip,item);
  if(attempts.size>2500)for(const [k,v] of attempts)if(now-v.time>15*60*1000)attempts.delete(k);
  return ()=>attempts.delete(ip);
 }
 async function body(req){
  let input;try{input=JSON.parse((await readBody(req,MAX_BYTES)).toString('utf8'))}catch(e){if(e.httpStatus)throw e;throw error(400,'Invalid settings request.');}
  if(!input||typeof input!=='object'||Array.isArray(input))throw error(400,'Invalid settings request.');
  return input;
 }
 function status(req){const authed=!!session(req),which=config.provider==='auto'?['gemini','groq','openrouter','ollama','openai'].find(p=>p==='ollama'?config.ollamaEnabled:!!config[p]):config.provider;const ai=!!which&&(which==='ollama'?config.ollamaEnabled:!!config[which]);return {setupRequired:!saved,authenticated:authed,ai,model:authed?config.model:undefined,provider:authed?config.provider:undefined,activeProvider:ai?which:null,openai:authed?!!config.openai:undefined,gemini:authed?!!config.gemini:undefined,groq:authed?!!config.groq:undefined,openrouter:authed?!!config.openrouter:undefined,ollama:authed?config.ollamaEnabled:undefined,freeModel:authed?config.freeModel:undefined,ollamaModel:authed?config.ollamaModel:undefined}}
 async function handle(req,res,url){
  const secure=requirePrivateConnection(req);
  if(url.pathname==='/api/admin/status'&&req.method==='GET')return sendJson(res,200,status(req));
  if(url.pathname==='/api/admin/setup'&&req.method==='POST'){
   if(saved)throw error(409,'Owner account already exists. Please sign in.');
   const removeAttempt=throttle(req),data=await body(req);
   if(typeof data.code!=='string'||data.code.length!==setupCode.length||!timingSafeEqual(Buffer.from(data.code),Buffer.from(setupCode)))throw error(403,'Incorrect one-time setup code. Find it in the server terminal.');
   if(typeof data.password!=='string'||data.password.length<12||data.password.length>200)throw error(400,'Choose an owner password of at least 12 characters.');
   const salt=randomBytes(16),hash=await scrypt(data.password,salt,64);
   master=randomBytes(32);await fs.mkdir(dir,{recursive:true,mode:0o700});
   await fs.writeFile(keyFile,master,{flag:'wx',mode:0o600});
   saved={salt:salt.toString('base64'),hash:hash.toString('base64')};
   try{await persist()}catch(e){saved=null;await fs.rm(keyFile,{force:true});throw e}
   setupCode='';removeAttempt();setSession(res,secure);return sendJson(res,200,{ok:true,...status(req),authenticated:true});
  }
  if(url.pathname==='/api/admin/login'&&req.method==='POST'){
   if(!saved)throw error(409,'Create the owner account first.');
   const removeAttempt=throttle(req),data=await body(req);
   if(typeof data.password!=='string'||data.password.length>200)throw error(401,'Invalid password.');
   const hash=await scrypt(data.password,Buffer.from(saved.salt,'base64'),64);
   if(!timingSafeEqual(hash,Buffer.from(saved.hash,'base64')))throw error(401,'Incorrect password.');
   removeAttempt();setSession(res,secure);return sendJson(res,200,{ok:true,...status(req),authenticated:true});
  }
  if(url.pathname==='/api/admin/logout'&&req.method==='POST'){clearSession(res,req,secure);return sendJson(res,200,{ok:true})}
  if(!session(req))throw error(401,'Owner sign-in required.');
  if(url.pathname==='/api/admin/config'&&req.method==='POST'){
   const data=await body(req);const next={...config};
   for(const k of Object.keys(FIELDS)){
    if(data[k]!==undefined){if(typeof data[k]!=='string'||data[k].length>300||(data[k]&&!SECRET.test(data[k])))throw error(400,`Invalid ${k} API key.`);if(data[k])next[k]=data[k].trim();}
    if(data['clear_'+k]===true)next[k]='';
   }
   if(data.model!==undefined){if(typeof data.model!=='string'||!MODEL.test(data.model))throw error(400,'Invalid AI model name.');next.model=data.model;}
   if(data.provider!==undefined){if(typeof data.provider!=='string'||!PROVIDERS.has(data.provider))throw error(400,'Invalid AI provider.');next.provider=data.provider;}
   if(data.freeModel!==undefined){if(typeof data.freeModel!=='string'||(data.freeModel&&!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,100}$/.test(data.freeModel)))throw error(400,'Invalid free-tier model name.');next.freeModel=data.freeModel;}
   if(data.ollamaModel!==undefined){if(typeof data.ollamaModel!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,100}$/.test(data.ollamaModel))throw error(400,'Invalid Ollama model name.');next.ollamaModel=data.ollamaModel;}
   if(data.ollamaEnabled!==undefined){if(typeof data.ollamaEnabled!=='boolean')throw error(400,'Invalid Ollama setting.');next.ollamaEnabled=data.ollamaEnabled;}
   // Save before applying the new settings so a disk failure cannot leave unsaved active secrets.
   const previous={...config};Object.assign(config,next);
   try{await persist()}catch(e){Object.assign(config,previous);throw e}
   return sendJson(res,200,{ok:true,...status(req)});
  }
  throw error(404,'Unknown owner settings route.');
 }
 return {handle};
}
