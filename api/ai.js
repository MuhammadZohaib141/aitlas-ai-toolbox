import {generate} from './shared.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
  try{
    let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body)}catch{return res.status(400).json({error:'Invalid JSON request body.'})}}
    const out=await generate(body);return res.status(200).json(out);
  }catch(e){console.error('AI request failed:',e.message);return res.status(e.status||500).json({error:e.status?e.message:'Unexpected server error.'});}
}
