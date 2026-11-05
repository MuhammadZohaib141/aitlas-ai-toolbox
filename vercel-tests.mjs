import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {generate, health} from './api/shared.js';

const read = f => fs.readFile(new URL(f, import.meta.url), 'utf8');

test('Vercel package pins Node 24 and exposes serverless API files', async () => {
  const pkg=JSON.parse(await read('./package.json'));
  assert.equal(pkg.engines.node,'24.x');
  await fs.access(new URL('./api/ai.js',import.meta.url));
  await fs.access(new URL('./api/health.js',import.meta.url));
});

test('removed tools stay removed and 16-tool UI remains', async () => {
  const app=await read('./app.js');
  assert.equal((app.match(/\{id:'/g)||[]).length,16);
  assert(!app.includes("id:'resume'"));
  assert(!app.includes("id:'enhance'"));
  assert(!app.includes("id:'remove'"));
});

test('AI Settings supports automatic browser fallback and personal keys', async () => {
  const html=await read('./index.html');
  const settings=await read('./settings.js');
  assert.match(html,/Automatic · server AI first, then free Browser AI/);
  assert.match(html,/Personal API key/);
  assert.match(settings,/AitlasSettings/);
  assert.match(settings,/sessionStorage/);
});

test('health reports no hosted provider when env keys are absent', () => {
  const previous={...process.env};
  for(const k of ['GEMINI_API_KEY','GROQ_API_KEY','OPENROUTER_API_KEY','OPENAI_API_KEY']) delete process.env[k];
  const h=health();assert.equal(h.ai,false);assert.equal(h.browserFallback,true);
  Object.assign(process.env,previous);
});

test('personal Gemini request is routed through serverless provider adapter', async () => {
  const original=global.fetch;
  global.fetch=async (url,opts)=>{
    assert.match(String(url),/generativelanguage\.googleapis\.com/);
    assert.equal(opts.headers['x-goog-api-key'],'test-key-12345678');
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Hello from Gemini'}]}}]}),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const out=await generate({tool:'email',fields:{recipient:'Client',goal:'Say hello',tone:'Friendly',sender:'Alex'},client:{provider:'gemini',key:'test-key-12345678',model:''}});
    assert.equal(out.text,'Hello from Gemini');
    assert.equal(out.engine,'Google Gemini');
  } finally {global.fetch=original;}
});
