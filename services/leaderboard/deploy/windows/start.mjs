import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLeaderboardServer} from '../../server.mjs';
import {inspectDatabase} from '../../database-transfer.mjs';

// The same layout is used in the source checkout and the portable bundle.
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const configPath=path.resolve(process.argv[2]||path.join(base,'college-config.json'));
try{
  if(Number(process.versions.node.split('.')[0])<24)throw new Error('需要 Node.js 24 或更高版本');
  const config=JSON.parse(readFileSync(configPath,'utf8'));
  if(!config.siteOrigin)throw new Error('请先填写 college-config.json 中已经核实的 siteOrigin');
  const port=config.port;
  if(!Number.isInteger(port)||port<1024||port>65535||[8080,8083].includes(port))throw new Error('请选择未占用的独立端口，不能使用 8080 或 8083');
  const database=path.resolve(path.dirname(configPath),config.database||'data/leaderboard.sqlite');
  // Do not silently create an empty leaderboard when the migration was missed.
  if(!existsSync(database))throw new Error('尚未迁入数据库，拒绝创建空排行榜：'+database);
  inspectDatabase(database);
  const origins=[config.siteOrigin,...(config.additionalOrigins||[])];
  const {server}=createLeaderboardServer({database,origins,readOnly:config.readOnly!==false,allowHttp:config.allowHttp===true});
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'端口已占用；未终止任何进程，请先检查配置。':error.message);process.exit(1);});
  server.listen(port,'127.0.0.1',()=>console.log('排行榜已启动，仅监听本机 127.0.0.1:'+port+'；'+(config.readOnly!==false?'只读验收模式':'允许记录成绩')));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}catch(error){console.error(error.message);process.exitCode=1;}
