import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('.', import.meta.url);
function createBrowserAI(supported){
 const ctx=vm.createContext({navigator:{gpu:supported?{}:undefined},isSecureContext:supported,localStorage:{getItem:()=>null,setItem(){}},console});
 const js=fs.readFileSync(new URL('browser-ai.js',root),'utf8');
 vm.runInContext(js,ctx);
 return {ai:vm.runInContext('BrowserAI',ctx),js};
}
test('file-open site loads browser model script before UI scripts',()=>{
 const html=fs.readFileSync(new URL('index.html',root),'utf8');
 assert(html.indexOf('src="./browser-ai.js"')<html.indexOf('src="./app.js"'));
 assert(html.includes('id="browserAiSettings"'));
 assert(html.includes('id="browserModel"'));
});
test('offline converter works without an AI provider and retired image services are absent',()=>{
 const app=fs.readFileSync(new URL('app.js',root),'utf8');
 assert(app.includes("t.id==='converter'||(FILE_MODE"));
 assert(!app.includes("{id:'background'"));
 assert(!app.includes("{id:'enhancer'"));
 assert(app.includes('if(FILE_MODE){'));
});
test('browser AI checks WebGPU and refuses to simulate results without compatible hardware',async()=>{
 const {ai}=createBrowserAI(false);assert.equal(ai.support(),false);
 await assert.rejects(ai.generate('email',{goal:'Hello'}),/WebGPU/);
});
test('browser AI only offers verified built-in model ids and validates text tool IDs',async()=>{
 const {ai}=createBrowserAI(true);assert.equal(ai.support(),true);
 assert.match(ai.currentModel(),/^Qwen2\.5-0\.5B-/);
 assert.throws(()=>ai.setModel('non-existent-model'),/Unknown/);
 await assert.rejects(ai.generate('not-a-tool',{}),/does not support/);
});
