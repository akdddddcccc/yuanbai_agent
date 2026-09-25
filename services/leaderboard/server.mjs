import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {handleApi} from './api.mjs';

const require=createRequire(import.meta.url);
const {localDB}=require('./sqlite.cjs');
const MAX_BODY=200000;

export function createLeaderboardServer({database=':memory:',origin='https://apps-demo.muyang23333.top'}={}){
  if(!/^https:\/\/[^/]+$/.test(origin))throw new Error('APP_ORIGIN 须为完整 HTTPS 来源（不带路径或结尾斜杠）');
  const DB=localDB(database);
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
