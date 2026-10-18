import {cp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {buildTutorial} from './build-school-tutorial.mjs';
import {gunzipSync} from 'node:zlib';

/** 学校版构建总入口。只写 dist-school/，不覆盖 public/、src/ 或任何线上目录。
 * 1. 构建原首页的学校入口；2. 复制并覆盖正式游戏的学校差异；
 * 3. 派生教学页；4. 附带独立排行榜与部署模板；5. 为输出生成资源版本和哈希清单。
 * dist-school/ 是可重建产物，不应手改；设计调整请修改 school/ 后重新构建。
 */

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const output=path.join(root,'dist-school');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex').slice(0,12);
const replaceOnce=(text,from,to)=>{if(!text.includes(from)||text.indexOf(from)!==text.lastIndexOf(from))throw new Error('学校版构建找不到唯一的替换位置：'+from);return text.replace(from,to);};
export async function buildSchool(){
  // Only this dedicated generated directory may be cleaned, never a source or live directory.
  if(path.dirname(output)!==root||path.basename(output)!=='dist-school')throw new Error('构建目录不安全');
  await rm(output,{recursive:true,force:true});
  const publicDir=path.join(output,'public');
  await mkdir(publicDir,{recursive:true});
  await build({configFile:false,root:path.join(root,'school'),base:'/yuanbai/',define:{'import.meta.env.VITE_SCHOOL_LIGHT_MODEL':'true'},publicDir:false,plugins:[react()],build:{outDir:publicDir,emptyOutDir:false}});
  await cp(path.join(root,'public/brand'),path.join(publicDir,'brand'),{recursive:true});
  await mkdir(path.join(publicDir,'models'),{recursive:true});
  await cp(path.join(root,'public/models/yuanbai-perception-sculpture.glb'),path.join(publicDir,'models/yuanbai-perception-sculpture.glb'));
  await cp(path.join(root,'public/explore'),path.join(publicDir,'game'),{recursive:true,filter:p=>!path.basename(p).startsWith('.')});
  let gameHtml=await readFile(path.join(publicDir,'game/index.html'),'utf8');
  gameHtml=replaceOnce(gameHtml,'<script type="module" src="../model-preload.js"></script>','');
  gameHtml=replaceOnce(gameHtml,'<link rel="stylesheet" href="../portal-navigation.css">','<link rel="stylesheet" href="../portal-navigation.css"><link rel="stylesheet" href="school-game.css">');
  // 保留原版返回主页面箭头，与元白标志同一行；仅从首页首次进入时先跳转教学。
  gameHtml=replaceOnce(gameHtml,'<span>返回主页</span>','<span>返回主页面</span>');
  gameHtml=replaceOnce(gameHtml,'class="back-to-portal" href="../"','class="back-to-portal" href="../explore/"');
  gameHtml=gameHtml.replace('探索者排行榜','学院探索者排行榜');
  gameHtml=gameHtml.replace('/explore/index.html','/game/index.html');
  await cp(path.join(root,'public/portal-navigation.css'),path.join(publicDir,'portal-navigation.css'));
  const entryGate=await readFile(path.join(root,'school/entry-gate.js'),'utf8');
  gameHtml=gameHtml.replace('</head>','<script data-school-entry>'+entryGate+'</script></head>');
  gameHtml=gameHtml.replace('>玩法</button>','>探索规则</button>');
  gameHtml=replaceOnce(gameHtml,'<div class="guide-footer">','<div class="guide-footer"><a class="replay-tutorial" href="../tutorial/">重看互动教学 ↗</a>');
  let gameJs=await readFile(path.join(publicDir,'game/game.js'),'utf8');
  const materialStart=gameJs.indexOf('  function material(index, revealed) {');
  const materialEnd=gameJs.indexOf('  function warmFloorTextures()',materialStart);
  if(materialStart<0||materialEnd<0)throw Error('Map material anchor missing');
  gameJs=gameJs.slice(0,materialStart)+await readFile(path.join(root,'school/map-material.txt'),'utf8')+gameJs.slice(materialEnd);

  for(const [a,b] of [['yuanbai-player-v1','yuanbai-school-player-v1'],['yuanbai-player-name-v1','yuanbai-school-player-name-v1'],['yuanbai-cleared-v1','yuanbai-school-cleared-v1']])gameJs=replaceOnce(gameJs,a,b);
  // 学校首次引导由 tutorial/ 接管，移除原游戏重复的首次规则弹窗；手动“探索规则”仍保留。
  gameJs=replaceOnce(gameJs,'applyLockedName();firstRunGuide();ensureMusic();','applyLockedName();ensureMusic();');
  await writeFile(path.join(publicDir,'game/game.js'),gameJs);
  await cp(path.join(root,'school/school-game.css'),path.join(publicDir,'game/school-game.css'));
  await buildTutorial(root,publicDir,gameHtml,gameJs);
  // Version generated game assets and retained portal bundles.
  for(const [relative,provided] of [['index.html'],['tutorial/index.html'],['game/index.html',gameHtml]]){
    const filename=path.join(publicDir,relative);
    let html=provided||await readFile(filename,'utf8');
    for(const match of [...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))(?:\?[^"#]*)?"/g)]){
      // Vite filenames already contain content hashes. An HTML-only query on
      // the entry creates a second ES module when lazy chunks import it back,
      // duplicating React and createRoot (invalid hook call / React #321).
      if(match[1].startsWith('/yuanbai/assets/'))continue;
      const asset=match[1].startsWith('/yuanbai/')?path.join(publicDir,match[1].slice('/yuanbai/'.length)):path.resolve(path.dirname(filename),match[1]);
      if(!asset.startsWith(publicDir+path.sep))throw new Error('资源路径越界');
      html=html.replace(match[0],match[0].split('=')[0]+'="'+match[1]+'?v='+hash(await readFile(asset))+'"');
    }
    await writeFile(filename,html);
  }
  // The public-account URL now renders the homepage. Its base keeps every link,
  // model and bundle relative to /yuanbai/, including direct index.html visits.
  await mkdir(path.join(publicDir,'explore'),{recursive:true});
  const portalHtml=await readFile(path.join(publicDir,'index.html'),'utf8');
  await writeFile(path.join(publicDir,'explore/index.html'),replaceOnce(portalHtml,'<head>','<head><base href="../">'));
  await mkdir(path.join(publicDir,'dialogue'),{recursive:true});
  await writeFile(path.join(publicDir,'dialogue/index.html'),portalHtml);
  // Decode the reviewed model source. Never copy old model variants/temp files.
  const modelMeta=JSON.parse(await readFile(path.join(root,'school/model/manifest.json'),'utf8'));
  const packed=Buffer.from(await readFile(path.join(root,'school/model/dialogue-light.glb.gz.b64'),'utf8'),'base64');
  const decoded=gunzipSync(packed);
  if(createHash('sha256').update(packed).digest('hex')!==modelMeta.compressedSHA256 || createHash('sha256').update(decoded).digest('hex')!==modelMeta.sha256)throw Error('Light model checksum mismatch');
  await writeFile(path.join(publicDir,'models',`dialogue-light-${modelMeta.compressedSHA256.slice(0,12)}.glb.gz`),packed);
  const serviceDir=path.join(output,'services/leaderboard');await mkdir(serviceDir,{recursive:true});
  // 后端按许可列表打包，只带代码和 SQL；不会读入真实库、身份令牌或现场配置。
  for(const name of await readdir(path.join(root,'services/leaderboard'))){
    if(['server.mjs','api.mjs','sqlite.cjs','database-transfer.mjs'].includes(name)||/^\d+_.*\.sql$/.test(name))await cp(path.join(root,'services/leaderboard',name),path.join(serviceDir,name));
  }
  const apiFile=path.join(serviceDir,'api.mjs');
  await writeFile(apiFile,replaceOnce(await readFile(apiFile,'utf8'),"import '../../public/explore/core.js';","import '../../public/game/core.js';"));
  await cp(path.join(root,'services/leaderboard/deploy/windows'),path.join(serviceDir,'deploy/windows'),{recursive:true});
  await cp(path.join(root,'school/deploy'),path.join(output,'deploy'),{recursive:true});
  await cp(path.join(root,'school/deploy/college-config.example.json'),path.join(output,'college-config.example.json'));
  await cp(path.join(root,'school/deploy/start-school.cmd'),path.join(output,'启动学院排行榜.cmd'));
  await cp(path.join(root,'school/README.md'),path.join(output,'部署说明.md'));
  await writeFile(path.join(output,'package.json'),JSON.stringify({name:'yuanbai-school',private:true,type:'module',engines:{node:'>=24'}},null,2));
  for(const dir of ['data','backups','runtime'])await mkdir(path.join(output,dir),{recursive:true});
  const files={};
  async function inventory(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await inventory(p);else files[path.relative(output,p).replaceAll('\\','/')]=createHash('sha256').update(await readFile(p)).digest('hex');}}
  await inventory(output);
  await writeFile(path.join(output,'BUILD-MANIFEST.json'),JSON.stringify({edition:'school',createdAt:new Date().toISOString(),files},null,2)+'\n');
  return output;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('学校版构建完成：'+await buildSchool());
