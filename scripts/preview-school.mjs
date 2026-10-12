import http from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSchool,root,output} from './build-school.mjs';
import {createLeaderboardServer} from '../services/leaderboard/server.mjs';

export async function startPreview({port=4321,rebuild=true}={}){
  // 预览和真正部署分开：默认 4321，只监听本机；重建只刷新 dist-school/。
  if(rebuild)await buildSchool();
  const publicDir=path.join(output,'public'), trustedOrigin='https://school-preview.invalid';
  // 内存排行榜退出即清空，不连接原站或学校的真实数据；仅用于本地接口验收。
  const {server:api,DB}=createLeaderboardServer({origin:trustedOrigin});
  await new Promise((resolve,reject)=>{api.once('error',reject);api.listen(0,'127.0.0.1',resolve);});
  const apiUrl='http://127.0.0.1:'+api.address().port;
  const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.woff2':'font/woff2'};
  const server=http.createServer(async(req,res)=>{
    try{
      const hostname='127.0.0.1:'+server.address().port;
      if(req.headers.host!==hostname){res.writeHead(403);return res.end('Invalid preview host');}
      const url=new URL(req.url,'http://'+hostname);
      if(url.pathname.startsWith('/api/yuanbai/game/')){
        // 先校验本机请求的 Host/Origin，再转给临时后端；不把预览变成任意来源代理。
        if(req.headers.origin&&req.headers.origin!=='http://'+hostname){res.writeHead(403);return res.end('Invalid preview origin');}
        if(!['GET','POST','OPTIONS'].includes(req.method)){res.writeHead(405);return res.end();}
        const chunks=[];let length=0;
        for await(const chunk of req){length+=chunk.length;if(length>200000){res.writeHead(413);return res.end();}chunks.push(chunk);}
        const headers={Origin:trustedOrigin};
        for(const name of ['content-type','authorization'])if(req.headers[name])headers[name]=req.headers[name];
        const response=await fetch(apiUrl+url.pathname+url.search,{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined,signal:AbortSignal.timeout(10000)});
        res.writeHead(response.status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(Buffer.from(await response.arrayBuffer()));
      }
      if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
      let pathname=decodeURIComponent(url.pathname);
      if(pathname.startsWith('/yuanbai/'))pathname=pathname.slice('/yuanbai'.length);
      let target=path.resolve(publicDir,'.'+pathname);
      if(target!==publicDir&&!target.startsWith(publicDir+path.sep)){res.writeHead(403);return res.end();}
      const info=await stat(target).catch(()=>null);
      if(info?.isDirectory()){
        if(!url.pathname.endsWith('/')){res.writeHead(302,{Location:url.pathname+'/'+url.search});return res.end();}
        target=path.join(target,'index.html');
      }
      const bytes=await readFile(target).catch(()=>null);
      if(!bytes){res.writeHead(404);return res.end('Not found');}
      res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:bytes);
    }catch(error){console.error(error.message);if(!res.headersSent)res.writeHead(500);res.end('Preview error');}
  });
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}catch(error){await new Promise(r=>api.close(r));throw error;}
  const url='http://127.0.0.1:'+server.address().port;
  return {server,DB,url,close:async()=>{await new Promise(r=>server.close(r));await new Promise(r=>api.close(r));}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const preview=await startPreview({port:Number(process.env.SCHOOL_PREVIEW_PORT)||4321});
  await mkdir(path.join(root,'.school-preview'),{recursive:true});
  console.log('学校版预览：'+preview.url+' （排行榜使用内存测试库，关闭后清空）');
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>preview.close().then(()=>process.exit(0)));
}
