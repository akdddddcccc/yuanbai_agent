import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createVoiceQueue} from './voice-queue.mjs';
import {onRequestPost,onRequestOptions} from './edge-functions/api/yuanbai/chat.js';
export function createAgentServer(config={}){
 const origins=String(config.YUANBAI_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const queue=createVoiceQueue({capacity:Math.max(1,Math.min(4,Number(config.YUANBAI_QUEUE_CAPACITY)||4))});
 const env={...config,YUANBAI_QUEUE:queue};
 const buckets=new Map();
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
 const server=http.createServer(async(req,res)=>{
  const route=new URL(req.url,'http://localhost').pathname;
  if(route==='/health' && req.method==='GET')return send(res,200,{ok:true,edition:'school-v7',configured:Boolean(config.DASHSCOPE_API_KEY&&config.DEEPSEEK_API_KEY),voice:config.YUANBAI_PUBLIC_TTS_VOICE_ID||null});
  const origin=req.headers.origin;
  if(!origin||!origins.includes(origin))return send(res,403,{ok:false,error:'请从学院网页进入。'});
  if(req.method==='OPTIONS'){
   res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'});return res.end();
  }
  if(req.method!=='POST')return send(res,405,{ok:false,error:'请求方式不支持'});
  if(route!=='/api/yuanbai/chat'&&!/^\/api\/yuanbai\/voice-queue\/(join|status|release)$/.test(route))return send(res,404,{ok:false});
  // Nginx replaces X-Real-IP; service listens on loopback only.
  if(route.endsWith('/join')){
   const ip=String(req.headers['x-real-ip']||req.socket.remoteAddress);const now=Date.now();
   for(const [key,b]of buckets)if(now-b.start>60000)buckets.delete(key);
   const b=buckets.get(ip)||{start:now,count:0};b.count++;buckets.set(ip,b);
   if(b.count>12)return send(res,429,{ok:false,error:'操作较频繁，请一分钟后再试。'});
  }
  try{
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>1000000){send(res,413,{ok:false,error:'录音过长，请缩短后重试。'});return;}chunks.push(chunk);}
   const raw=Buffer.concat(chunks).toString('utf8');let body;
   try{body=JSON.parse(raw);}catch{return send(res,400,{ok:false,error:'请求格式错误'});}
   if(!body||Array.isArray(body)||typeof body!=='object')return send(res,400,{ok:false,error:'请求格式错误'});
   if(route.startsWith('/api/yuanbai/voice-queue/')){
    const action=route.split('/').at(-1);
    if(action!=='join'&&!/^[a-f0-9-]{36}$/i.test(body.ticket||''))return send(res,400,{ok:false,error:'无效票据'});
    const result=action==='join'?queue.join():queue[action](body.ticket);
    return send(res,result.ok?200:429,result);
   }
   const response=await onRequestPost({request:new Request(origin+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:raw}),env});
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){if(!res.headersSent)send(res,500,{ok:false,error:'服务暂时不可用，请稍后再试。'});else res.end();}
 });
 server.requestTimeout=150000;server.headersTimeout=15000;
 return {server,queue};
}
async function main(){
 const configPath=path.resolve(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'agent-config.json'));
 const config=JSON.parse(await readFile(configPath,'utf8'));
 if(!config.YUANBAI_ALLOWED_ORIGINS)throw new Error('请配置学院域名白名单');
 if(!config.DASHSCOPE_API_KEY||!config.DEEPSEEK_API_KEY)throw new Error('请在服务器 agent-config.json 填写模型密钥');
 if(config.YUANBAI_PUBLIC_TTS_MODEL!=='qwen3-tts-flash')throw new Error('当前适配器使用 qwen3-tts-flash；更换模型需核对API协议');
 const {server}=createAgentServer(config);
 const port=Number(config.PORT||4175);server.listen(port,'127.0.0.1',()=>console.log(`元白学院Agent已启动：http://127.0.0.1:${port}（仅本机代理可访问）`));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1});
