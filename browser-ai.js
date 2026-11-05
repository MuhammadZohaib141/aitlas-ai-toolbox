/* Browser model: WebLLM, Apache 2.0. Model files download to the browser on first use. */
'use strict';
const BrowserAI=(()=>{
  const models=['Qwen2.5-0.5B-Instruct-q4f16_1-MLC','Qwen2.5-1.5B-Instruct-q4f16_1-MLC'];
  const prompts={
    email:'Write a ready-to-send email with a subject, greeting, body and signoff. Respect input and do not invent facts.',
    rewrite:'Rewrite the supplied paragraph as requested while preserving its meaning. Return only rewritten text.',
    grammar:'Correct spelling, grammar and punctuation of the supplied text without changing its meaning. Output corrected text only.',
    summarizer:'Summarize only the supplied text at the requested length, accurately and without adding facts.',
    translate:'Translate the supplied text into the requested language naturally without adding facts. Output only the translation.',
    tone:'Change the tone of the supplied text as requested without changing its factual meaning. Return only revised text.',
    titles:'Generate the requested number of distinct, useful titles for the content; avoid fabricated claims.',
    code:'Explain the supplied code, line by line where useful. Explain actual behavior, assumptions and potential issues; do not claim you ran it.',
    json:'Return ONLY a valid JSON value fixing the malformed input where the intended structure is clear. Do not invent missing data or wrap in markdown.',
    regex:'Produce a regex for the exact requirement and requested flavor. Explain it, and include positive/negative example strings. Avoid catastrophic backtracking.',
    sql:'Generate parameterized SQL for the stated request and dialect. State schema assumptions. Warn about unsafe UPDATE or DELETE without WHERE.',
    notes:'Summarize only supplied notes in a structured, accurate outline with key definitions.',
    flashcards:'Generate exactly the requested number of source-grounded, distinct front/back flashcards, with concise answers.',
    quiz:'Generate exactly the requested number of multiple-choice questions with 4 options each, a separate answer key, and brief explanations based only on input.',
    study:'Make a day-by-day plan using stated topics, time available, study methods, review and breaks.'
  };
  let engine=null,loaded=null,pending=null,update=()=>{};
  function support(){return !!(globalThis.isSecureContext&&navigator.gpu);}
  function currentModel(){try{return localStorage.getItem('aitlas-browser-model')||models[0]}catch{return models[0]}}
  function setModel(value){if(!models.includes(value))throw Error('Unknown local model');if(loaded&&loaded!==value)engine=null,loaded=null;try{localStorage.setItem('aitlas-browser-model',value)}catch{}}
  function onProgress(fn){update=typeof fn==='function'?fn:()=>{}}
  async function ensure(){
    if(engine&&loaded===currentModel())return engine;
    if(pending)return pending;
    if(!support())throw Error('Free browser AI needs Chrome/Edge with WebGPU enabled and a compatible graphics card. Image conversion works without it. You can also use the server version with a connected provider.');
    pending=(async()=>{
      update('Loading the free AI library from the internet…');
      let lib;try{lib=await import('https://esm.run/@mlc-ai/web-llm@0.2.85');}
      catch{throw Error('Could not download the browser AI library. Check your internet connection or local-file browser restrictions. No result has been simulated.');}
      const model=currentModel();
      const found=lib.prebuiltAppConfig.model_list.some(m=>m.model_id===model);
      if(!found)throw Error('The selected browser AI model is not supported by this version.');
      const fresh=await lib.CreateMLCEngine(model,{initProgressCallback:p=>update(p?.text||`Downloading free model… ${Math.round(100*(p?.progress||0))}%`)});
      engine=fresh;loaded=model;update('Free browser AI model is ready.');return engine;
    })();
    try{return await pending}catch(e){engine=null;loaded=null;throw e}finally{pending=null}
  }
  async function generate(tool,fields){
    const instruction=prompts[tool];if(!instruction)throw Error('This tool does not support browser text AI.');
    const instance=await ensure();update('Generating with the free on-device model…');
    const response=await instance.chat.completions.create({messages:[
      {role:'system',content:'You are Aitlas, a helpful, careful assistant. '+instruction},
      {role:'user',content:JSON.stringify(fields)}],temperature:0.45,max_tokens:tool==='quiz'||tool==='study'?1024:640});
    const content=response.choices?.[0]?.message?.content?.trim();
    if(!content)throw Error('The browser AI model returned no text. Try a shorter input or a different model.');
    if(tool==='json'){
      const cleaned=content.replace(/^```(?:json)?\s*|\s*```$/g,'').trim();
      try{return JSON.stringify(JSON.parse(cleaned),null,fields.indent==='4 spaces'?4:fields.indent==='Minified'?0:2)}
      catch{throw Error('The local AI could not reliably repair this JSON. Try a more capable model or fix the ambiguous portion manually.');}
    }
    return content;
  }
  return {support,currentModel,setModel,onProgress,ensure,generate};
})();
