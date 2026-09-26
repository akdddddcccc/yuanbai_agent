import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {handleApi} from './api.mjs';
import {createVoiceQueue} from './voice-queue.mjs';

const require=createRequire(import.meta.url);
const {localDB}=require('./sqlite.cjs');
const MAX_BODY=200000;

export function createLeaderboardServer({database=':memory:',origin='https://apps-demo.muyang23333.top'}={}){
  if(!/^https:\/\/[^/]+$/.test(origin))throw new Error('APP_ORIGIN 须为完整 HTTPS 来源（不带路径或结尾斜杠）');
  const DB=localDB(database);
  const configuredCapacity=Math.floor(Number(process.env.YUANBAI_VOICE_CONCURRENCY)||2);
  const voiceQueue=createVoiceQueue({capacity:Math.max(1,Math.min(5,configuredCapacity))});
  // nginx 覆盖 X-Real-IP，服务只监听 loopback；限制匿名创建身份/新局刷写磁盘。
  const starts=new Map();
  const server=http.createServer(async(req,res)=>{
    const requestOrigin=req.headers.origin;
    const cors={'Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    if(requestOrigin===origin)cors['Access-Control-Allow-Origin']=origin;
    const send=(status,body)=>{res.writeHead(status,{...cors,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
    if(requestOrigin&&requestOrigin!==origin)return send(403,{error:'请从游戏页面内访问。'});
    if(req.method==='OPTIONS'){
      res.writeHead(204,{...cors,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'});return res.end();
    }
    if(req.method==='GET'&&req.url==='/health')return send(200,{ok:true});
    const queueRoute=req.url?.match(/^\/api\/yuanbai\/voice-queue\/(join|status|release|claim)$/);
    if(queueRoute){
      if(req.method!=='POST')return send(405,{error:'请求方式不支持'});
      try{
        let size=0,chunks=[];
        for await(const chunk of req){size+=chunk.length;if(size>4096)return send(413,{error:'请求内容过大'});chunks.push(chunk);}
        const data=chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};
        const ticket=typeof data.ticket==='string'?data.ticket:'';
        const result=queueRoute[1]==='join'?voiceQueue.join():
          queueRoute[1]==='status'?voiceQueue.status(ticket):
          queueRoute[1]==='claim'?voiceQueue.claim(ticket):voiceQueue.release(ticket);
        if(queueRoute[1]==='claim'&&result.expired)return send(410,{ok:false,expired:true,error:'等候时间太久了，请重新排队。'});
        if(queueRoute[1]==='claim'&&result.waiting)return send(429,{ok:false,error:'还没轮到你，请稍候。'});
        if(queueRoute[1]==='claim'&&result.busy)return send(409,{ok:false,error:'这次对话已经开始，请不要重复提交。'});
        if(result.expired)return send(410,{ok:false,expired:true,error:'等候时间太久了，请重新排队。'});
        return send(result.ok===false?429:200,result);
      }catch{return send(400,{ok:false,error:'排队请求无效'});}
    }
    if(req.method==='POST'&&req.url==='/api/yuanbai/game/runs'){
      const now=Date.now(),ip=req.headers['x-real-ip']||req.socket.remoteAddress;
      for(const [key,value] of starts)if(now-value.at>60000)starts.delete(key);
      const entry=starts.get(ip)||{at:now,count:0};
      if(entry.count>=20||(!starts.has(ip)&&starts.size>=10000))return send(429,{error:'新局创建过于频繁，请一分钟后再试。'});
      entry.count++;starts.set(ip,entry);
    }
    try{
      let size=0,chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)return send(413,{error:'提交内容过大'});chunks.push(chunk);}
      const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined});
      const response=await handleApi(request,{DB,APP_ORIGIN:origin});
      res.writeHead(response.status,{...cors,...Object.fromEntries(response.headers)});
      res.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){
      console.error('Leaderboard server error:',error);
      if(!res.headersSent)send(503,{error:'排行榜暂时无法连接，请稍后重试。'});
    }
  });
  server.on('close',()=>DB.sqlite.close());
  return {server,DB};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  const {server}=createLeaderboardServer({database:process.env.DB_PATH||'./leaderboard.sqlite',origin:process.env.APP_ORIGIN||'https://apps-demo.muyang23333.top'});
  server.listen(Number(process.env.PORT)||4174,'127.0.0.1',()=>console.log('Leaderboard listening on 127.0.0.1:'+server.address().port));
}
