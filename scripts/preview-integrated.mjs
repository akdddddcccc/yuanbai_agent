// Internal visual QA only: static routes; no credentials or production API proxy.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist-school/public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.writeHead(302,{Location:'/yuanbai/'});return res.end();}
  if(!u.pathname.startsWith('/yuanbai/')){res.writeHead(503,{'Content-Type':'application/json'});return res.end(JSON.stringify({ok:false,error:'预览未连接学院服务'}));}
  let file=path.resolve(root,decodeURIComponent(u.pathname).slice(9));
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  if((await stat(file)).isDirectory()){if(!u.pathname.endsWith('/')){res.writeHead(302,{Location:u.pathname+'/'+u.search});return res.end();}file=path.join(file,'index.html');}
  const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'0.0.0.0',()=>console.log('http://terminal.local:4173/'));
