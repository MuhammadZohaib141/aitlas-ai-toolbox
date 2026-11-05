/** Strictly test-only: supply fixed model-provider responses, never deployed. */
const oldFetch=globalThis.fetch;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/PL0AAAAASUVORK5CYII=','base64');
globalThis.fetch=async(url,options={})=>{
 const address=String(url);
 if(address==='https://api.openai.com/v1/responses'){
  const request=JSON.parse(options.body);
  if(!request.store===false)throw Error('Model request should not store user inputs');
  const values=JSON.parse(request.input);
  if(!Object.keys(values).length)throw Error('No model form data');
  const isJson=request.instructions.includes('Task: json.');
  return Response.json({output_text:isJson?'{"fixed":true,"items":[1,2]}':`REAL MODEL MOCK: ${request.instructions.match(/Task: ([a-z]+)/)[1]}; input: ${JSON.stringify(values).slice(0,200)}`});
 }
 if(address.startsWith('https://generativelanguage.googleapis.com/v1beta/models/')){
  const body=JSON.parse(options.body);
  if(!options.headers['x-goog-api-key']||!body.contents?.[0]?.parts?.[0]?.text)throw Error('Invalid Gemini request');
  const fields=JSON.parse(body.contents[0].parts[0].text);
  return Response.json({candidates:[{content:{parts:[{text:body.systemInstruction.parts[0].text.includes('Task: json.')?'{"fixed":true,"items":[1,2]}':`GEMINI MOCK ${JSON.stringify(fields)}`}]}}]});
 }
 if(['https://api.groq.com/openai/v1/chat/completions','https://openrouter.ai/api/v1/chat/completions','http://127.0.0.1:11434/api/chat'].includes(address)){
  const body=JSON.parse(options.body);const name=address.includes('groq')?'Groq':address.includes('openrouter')?'OpenRouter':'Ollama';
  if(!body.messages?.[1]?.content)throw Error('Missing AI message');
  const fields=JSON.parse(body.messages[1].content);
  const output=body.messages[0].content.includes('Task: json.')?'{"fixed":true,"items":[1,2]}':`${name.toUpperCase()} MOCK ${JSON.stringify(fields)}`;
  return Response.json(name==='Ollama'?{message:{content:output}}:{choices:[{message:{content:output}}]});
 }
 if(address==='https://api.remove.bg/v1.0/removebg'){
  if(!options.body?.get('image_file'))throw Error('Missing image_file multipart field');
  return new Response(png,{headers:{'Content-Type':'image/png'}});
 }
 if(address==='https://api.replicate.com/v1/files'){
  if(!options.body?.get('content'))throw Error('Missing uploaded image');
  return Response.json({urls:{get:'https://api.replicate.com/v1/files/mock-image'}});
 }
 if(address==='https://api.replicate.com/v1/models/nightmareai/real-esrgan/predictions'){
  const input=JSON.parse(options.body).input;
  if(![2,4].includes(input.scale)||!input.image.includes('mock-image'))throw Error('Invalid upscale request');
  return Response.json({status:'succeeded',output:'https://replicate.delivery/mock-output.png'});
 }
 if(address==='https://replicate.delivery/mock-output.png')return new Response(png,{headers:{'Content-Type':'image/png'}});
 if(address.startsWith('https://'))throw Error('Unexpected provider request: '+address);
 return oldFetch(url,options);
};
