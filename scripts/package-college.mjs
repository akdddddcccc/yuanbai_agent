import {cp,mkdir,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.argv[2]||'');
if(!process.argv[2]||output===root)throw new Error('请指定一个全新的输出目录');
await mkdir(output,{recursive:false});
await mkdir(path.join(output,'public'),{recursive:true});
await cp(path.join(root,'public/explore'),path.join(output,'public/explore'),{recursive:true});
await cp(path.join(root,'public/portal-navigation.css'),path.join(output,'public/portal-navigation.css'));
// This package deploys the game only. Remove the personal homepage link and
// do not preload that homepage's large 3D model from the college domain.
const htmlPath=path.join(output,'public/explore/index.html');
let html=await readFile(htmlPath,'utf8');
html=html.replace('<script type="module" src="../model-preload.js"></script>','');
html=html.replace('<link rel="stylesheet" href="../portal-navigation.css">','');
html=html.replace('location.pathname.endsWith("/explore/index.html")','location.pathname.endsWith("/index.html")');
const portalLink=/<a\b[^>]*\bclass="back-to-portal"[^>]*>[\s\S]*?<\/a>/g;
if([...html.matchAll(portalLink)].length!==1)throw new Error('学院包预期有且仅有一个返回主页按钮');
html=html.replace(portalLink,'');
await writeFile(htmlPath,html);
const service='services/leaderboard';
await mkdir(path.join(output,service),{recursive:true});
for(const name of await readdir(path.join(root,service))){
  if(['server.mjs','api.mjs','sqlite.cjs','database-transfer.mjs'].includes(name)||/^\d+_.*\.sql$/.test(name))await cp(path.join(root,service,name),path.join(output,service,name));
}
const deploy=path.join(root,service,'deploy/windows');
await cp(deploy,path.join(output,service,'deploy/windows'),{recursive:true});
await cp(path.join(deploy,'college-config.example.json'),path.join(output,'college-config.json'));
await cp(path.join(deploy,'start.cmd'),path.join(output,'启动排行榜.cmd'));
await cp(path.join(deploy,'DEPLOYMENT.md'),path.join(output,'DEPLOYMENT.md'));
await cp(path.join(deploy,'nginx-college.conf'),path.join(output,'nginx-college.conf'));
await writeFile(path.join(output,'package.json'),JSON.stringify({name:'yuanbai-college',private:true,type:'module',engines:{node:'>=24'}},null,2));
for(const dir of ['data','backups','runtime'])await mkdir(path.join(output,dir));
// A runtime can be supplied by the build operator; do not install globally.
if(process.env.COLLEGE_NODE_EXE){
  const version=execFileSync(process.env.COLLEGE_NODE_EXE,['--version'],{encoding:'utf8'}).trim();
  if(Number(version.slice(1).split('.')[0])<24)throw new Error('打包运行时需要 Node 24+');
  if(!process.env.COLLEGE_NODE_LICENSE)throw new Error('携带运行时需要附上对应的 Node LICENSE');
  await cp(process.env.COLLEGE_NODE_EXE,path.join(output,'runtime/node.exe'));
  await cp(process.env.COLLEGE_NODE_LICENSE,path.join(output,'runtime/LICENSE'));
  await writeFile(path.join(output,'runtime/VERSION'),version+'\n');
}
const files={};
async function inventory(dir){for(const name of (await readdir(dir)).sort()){const full=path.join(dir,name);if((await stat(full)).isDirectory())await inventory(full);else files[path.relative(output,full).replaceAll('\\','/')]=createHash('sha256').update(await readFile(full)).digest('hex');}}
await inventory(output);
const baseCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
await writeFile(path.join(output,'BUILD-MANIFEST.json'),JSON.stringify({baseCommit,createdAt:new Date().toISOString(),localDeploymentChanges:true,files},null,2)+'\n');
console.log('部署包已生成：'+output);
