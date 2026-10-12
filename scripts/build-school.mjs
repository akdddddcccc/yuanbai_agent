import {cp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {buildTutorial} from './build-school-tutorial.mjs';

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
  await build({configFile:false,root:path.join(root,'school'),base:'./',publicDir:false,plugins:[react()],build:{outDir:publicDir,emptyOutDir:false}});
  await cp(path.join(root,'public/brand'),path.join(publicDir,'brand'),{recursive:true});
  await mkdir(path.join(publicDir,'models'));
  await cp(path.join(root,'public/models/yuanbai-perception-sculpture.glb'),path.join(publicDir,'models/yuanbai-perception-sculpture.glb'));
  await cp(path.join(root,'public/explore'),path.join(publicDir,'explore'),{recursive:true});
  let gameHtml=await readFile(path.join(publicDir,'explore/index.html'),'utf8');
  gameHtml=replaceOnce(gameHtml,'<script type="module" src="../model-preload.js"></script>','');
  gameHtml=replaceOnce(gameHtml,'<link rel="stylesheet" href="../portal-navigation.css">','<link rel="stylesheet" href="school-game.css">');
  const portalLink=/<a\b[^>]*\bclass="back-to-portal"[^>]*>[\s\S]*?<\/a>/g;
  if([...gameHtml.matchAll(portalLink)].length!==1)throw new Error('返回链接结构已改变，请检查学校入口');
  gameHtml=gameHtml.replace(portalLink,'<a class="back-to-school" href="../" aria-label="返回学院游戏首页">↖ <span>学院首页</span></a>');
  gameHtml=gameHtml.replace('探索者排行榜','学院探索者排行榜');
  gameHtml=gameHtml.replace('</head>',`<script data-school-entry>try{if(!localStorage.getItem('yuanbai-school-onboarding-v2'))location.replace('../tutorial/');}catch{}</script></head>`);
  gameHtml=gameHtml.replace('>玩法</button>','>探索规则</button>');
  gameHtml=replaceOnce(gameHtml,'<div class="guide-footer">','<div class="guide-footer"><a class="replay-tutorial" href="../tutorial/">重看互动教学 ↗</a>');
  let gameJs=await readFile(path.join(publicDir,'explore/game.js'),'utf8');
  for(const [a,b] of [['yuanbai-player-v1','yuanbai-school-player-v1'],['yuanbai-player-name-v1','yuanbai-school-player-name-v1'],['yuanbai-cleared-v1','yuanbai-school-cleared-v1']])gameJs=replaceOnce(gameJs,a,b);
  // The school homepage already presents the rules; help remains available in the game menu.
  gameJs=replaceOnce(gameJs,'applyLockedName();firstRunGuide();ensureMusic();','applyLockedName();ensureMusic();');
  await writeFile(path.join(publicDir,'explore/game.js'),gameJs);
  await cp(path.join(root,'school/school-game.css'),path.join(publicDir,'explore/school-game.css'));
  await buildTutorial(root,publicDir,gameHtml,gameJs);
  // Version generated game assets and retained portal bundles.
  for(const [relative,provided] of [['index.html'],['tutorial/index.html'],['explore/index.html',gameHtml]]){
    const filename=path.join(publicDir,relative);
    let html=provided||await readFile(filename,'utf8');
    for(const match of [...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))(?:\?[^"#]*)?"/g)]){
      const asset=path.resolve(path.dirname(filename),match[1]);
      if(!asset.startsWith(publicDir+path.sep))throw new Error('资源路径越界');
      html=html.replace(match[0],match[0].split('=')[0]+'="'+match[1]+'?v='+hash(await readFile(asset))+'"');
    }
    await writeFile(filename,html);
  }
  const serviceDir=path.join(output,'services/leaderboard');await mkdir(serviceDir,{recursive:true});
  for(const name of await readdir(path.join(root,'services/leaderboard'))){
    if(['server.mjs','api.mjs','sqlite.cjs','database-transfer.mjs'].includes(name)||/^\d+_.*\.sql$/.test(name))await cp(path.join(root,'services/leaderboard',name),path.join(serviceDir,name));
  }
  await cp(path.join(root,'services/leaderboard/deploy/windows'),path.join(serviceDir,'deploy/windows'),{recursive:true});
  await cp(path.join(root,'school/deploy'),path.join(output,'deploy'),{recursive:true});
  await cp(path.join(root,'school/deploy/college-config.example.json'),path.join(output,'college-config.example.json'));
  await cp(path.join(root,'school/deploy/start-school.cmd'),path.join(output,'启动学院排行榜.cmd'));
  await cp(path.join(root,'school/README.md'),path.join(output,'部署说明.md'));
  await writeFile(path.join(output,'package.json'),JSON.stringify({name:'yuanbai-school',private:true,type:'module',engines:{node:'>=24'}},null,2));
  for(const dir of ['data','backups','runtime'])await mkdir(path.join(output,dir));
  const files={};
  async function inventory(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await inventory(p);else files[path.relative(output,p).replaceAll('\\','/')]=createHash('sha256').update(await readFile(p)).digest('hex');}}
  await inventory(output);
  await writeFile(path.join(output,'BUILD-MANIFEST.json'),JSON.stringify({edition:'school',createdAt:new Date().toISOString(),files},null,2)+'\n');
  return output;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('学校版构建完成：'+await buildSchool());
