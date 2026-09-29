import http from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createVoiceQueue} from './voice-queue.mjs';

// Only accept bounded numeric metrics and fixed labels. Never persist request
// bodies, tickets, audio, prompts, provider messages or arbitrary strings.
export function sanitizeDiagnostics(value){
  if(!value||typeof value!=='object')return {};
  const result={};
  if(typeof value.ok==='boolean')result.ok=value.ok;
  for(const key of ['admission_ms','asr_ms','dialogue_ms','tts_ms','total_ms']){
    if(Number.isFinite(value[key])&&value[key]>=0&&value[key]<=600000)result[key]=Math.round(value[key]);
  }
  if(Number.isInteger(value.upstream_status)&&value.upstream_status>=100&&value.upstream_status<=599)result.upstream_status=value.upstream_status;
  if(['语音识别','对话生成','语音合成','语音文件下载','请求处理'].includes(value.stage))result.stage=value.stage;
  if(['Error','TimeoutError','AbortError','TypeError'].includes(value.error_name))result.error_name=value.error_name;
  return result;
}

export function createVoiceQueueServer({capacity=4}={}){
  const queue=createVoiceQueue({capacity});
  return http.createServer(async(req,res)=>{
    const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
    if(req.method==='GET'&&req.url==='/health')return send(200,{ok:true,...queue.snapshot()});
    const action=req.url?.match(/^\/api\/yuanbai\/voice-queue\/(join|status|claim|complete|release)$/)?.[1];
    if(!action)return send(404,{ok:false,error:'接口不存在'});
    if(req.method!=='POST')return send(405,{ok:false,error:'请求方式不支持'});
    if(req.headers.origin&&req.headers.origin!=='https://apps-demo.muyang23333.top')return send(403,{ok:false,error:'请从元白页面访问。'});
    try{
      let size=0;const chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>4096)return send(413,{ok:false,error:'请求过大'});chunks.push(chunk);}
      const data=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
      const result=action==='join'?queue.join():action==='complete'?queue.complete(data.ticket,data.claimToken):queue[action](data.ticket);
      if(action==='complete'&&result.ok){
        console.info(JSON.stringify({event:'yuanbai_voice_complete',...sanitizeDiagnostics(data.diagnostics),...queue.snapshot()}));
      }
      return send(result.expired?410:result.busy?409:result.ok?200:429,{...result,...(!result.ok?{error:result.expired?'等候已过期，请重新排队。':result.busy?'这次对话正在进行。':'暂时还不能开始，请稍候。'}:{})});
    }catch{return send(400,{ok:false,error:'排队请求无效'});}
  });
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  const capacity=Math.max(1,Math.min(5,Math.floor(Number(process.env.YUANBAI_VOICE_CONCURRENCY)||4)));
  createVoiceQueueServer({capacity}).listen(Number(process.env.PORT)||4176,'127.0.0.1');
}
