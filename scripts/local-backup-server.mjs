import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/client');
const port = Number(process.env.YUANBAI_LOCAL_PORT || 5187);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg','.wasm':'application/wasm'};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/api/chat') {
      if(req.method !== 'POST') { res.writeHead(405).end(); return; }
      const chunks=[]; let bytes=0;
      for await (const chunk of req) { bytes+=chunk.length; if(bytes>25*1024*1024) {res.writeHead(413).end();return;} chunks.push(chunk); }
      const upstream=await fetch('https://apps-demo.muyang23333.top/api/yuanbai/chat',{
        method:'POST',headers:{'content-type':req.headers['content-type'] || 'application/json'},
        body:Buffer.concat(chunks),signal:AbortSignal.timeout(120000),
      });
      res.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type') || 'application/json'});
      res.end(Buffer.from(await upstream.arrayBuffer()));return;
    }
    if(!['GET','HEAD'].includes(req.method)) {res.writeHead(405).end();return;}
    let file=path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if(file!==root && !file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
    if(fs.existsSync(file) && fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
    if(!fs.existsSync(file)) {res.writeHead(404).end('Not found');return;}
    res.writeHead(200,{'content-type':mime[path.extname(file)] || 'application/octet-stream','content-length':fs.statSync(file).size});
    if(req.method==='HEAD') res.end();else fs.createReadStream(file).pipe(res);
  } catch(error) { console.error(error.message); if(!res.headersSent) res.writeHead(502);res.end('Local request failed'); }
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${port}/dialogue/`;
  console.log(`Yuanbai local backup: ${url}\nKeep this window open. AI voice requires an internet connection.`);
  if(process.platform==='win32' && process.env.YUANBAI_NO_BROWSER!=='1') spawn('explorer.exe',[url],{windowsHide:true});
});
