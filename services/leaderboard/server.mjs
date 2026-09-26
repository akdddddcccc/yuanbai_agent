import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {handleApi} from './api.mjs';

const require=createRequire(import.meta.url);
const {localDB}=require('./sqlite.cjs');
const MAX_BODY=200000;
// 浏览器统一经 EdgeOne 边缘节点转发，x-real-ip 实际是边缘节点地址，同一节点下的玩家共享配额，
// 因此阈值要按"一屋子人同时玩"来定，不能按单个玩家算。
// 开局只是写一行计时记录，扫码后第一次移动就会触发：给足余量，只挡住脚本刷库。
const RUN_LIMIT=120, RUN_WINDOW=60000;
// 真正值得守住的是把名字写进公开榜单这一步。失败的提交（昵称不合法、本局还没校验通关）
// 不占用名额；被挡住的人稍后重新提交仍沿用原来的通关用时，排名不会因此变差。
const PUBLISH_LIMIT=20, PUBLISH_WINDOW=60000;
const QUOTA_KEYS=10000;
const SCORE_PATH='/api/yuanbai/game/scores';

// 同一来源在 windowMs 内的固定窗口计数；来源数达到上限后不再接受新来源，避免内存无界增长。
function createQuota(limit,windowMs){
  const buckets=new Map();
  const prune=now=>{for(const [key,value] of buckets)if(now-value.at>windowMs)buckets.delete(key);};
  return {
    full(key,now){prune(now);const entry=buckets.get(key);return entry?entry.count>=limit:buckets.size>=QUOTA_KEYS;},
    count(key,now){prune(now);const entry=buckets.get(key)||{at:now,count:0};entry.count++;buckets.set(key,entry);},
  };
}

export function createLeaderboardServer({database=':memory:',origin='https://apps-demo.muyang23333.top'}={}){
  if(!/^https:\/\/[^/]+$/.test(origin))throw new Error('APP_ORIGIN 须为完整 HTTPS 来源（不带路径或结尾斜杠）');
  const DB=localDB(database);
  const starts=createQuota(RUN_LIMIT,RUN_WINDOW);
  const publishes=createQuota(PUBLISH_LIMIT,PUBLISH_WINDOW);
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
    const source=req.headers['x-real-ip']||req.socket.remoteAddress, now=Date.now(), pathname=req.url.split('?')[0];
    if(req.method==='POST'&&pathname==='/api/yuanbai/game/runs'){
      if(starts.full(source,now))return send(429,{error:'新局创建过于频繁，请一分钟后再试。'});
      starts.count(source,now);
    }
    const publishing=req.method==='POST'&&pathname===SCORE_PATH;
    if(publishing&&publishes.full(source,now))return send(429,{error:'入榜提交过于频繁，请一分钟后再试。'});
    try{
      let size=0,chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)return send(413,{error:'提交内容过大'});chunks.push(chunk);}
      const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined});
      const response=await handleApi(request,{DB,APP_ORIGIN:origin});
      if(publishing&&response.status===200)publishes.count(source,Date.now());
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
