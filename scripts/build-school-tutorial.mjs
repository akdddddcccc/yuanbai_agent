import {readFile,writeFile,cp,mkdir} from 'node:fs/promises';
import path from 'node:path';
const once=(text,from,to)=>{if(text.split(from).length!==2)throw Error('教学构建源发生变化: '+from);return text.replace(from,to);};
export async function buildTutorial(root,publicDir,gameHtml,gameJs){
  const dir=path.join(publicDir,'tutorial');await mkdir(dir,{recursive:true});
  // Reuse the production game core and renderer. Only this generated tutorial copy is resized.
  let core=await readFile(path.join(root,'public/explore/core.js'),'utf8');
  core=once(core,'const SIZE=9,','const SIZE=4,');
  core=once(core,'const START={r:8,c:0};','const START={r:3,c:0};');
  core=core.replace(/const CLIFFS=\[[^\]]+\];/,'const CLIFFS=[2,6];');
  core=core.replace(/const PICKUPS=\[[\s\S]*?\n  \];/,"const PICKUPS=[{index:8,type:'companion'},{index:4,type:'probe'},{index:0,type:'panorama'}];");
  core=core.replace(/function createSeed\(\)\{[^\n]+\}/,'function createSeed(){return null;}');
  core=core.replaceAll('id(7,0)','id(2,0)').replaceAll('id(8,1)','id(3,1)');
  core=once(core,'typeCounts.companion!==5||typeCounts.probe!==4||typeCounts.panorama!==3','typeCounts.companion!==1||typeCounts.probe!==1||typeCounts.panorama!==1');
  core=core.replaceAll('length:81','length:SIZE*SIZE').replaceAll('Math.floor(i/9)','Math.floor(i/SIZE)').replaceAll('c:i%9','c:i%SIZE');
  await writeFile(path.join(dir,'core.js'),core);
  let js=gameJs;
  // No run or score is created in the learning scene, even if a finish event is triggered.
  js=once(js,'async function api(path,data){',"async function api(path,data){throw new Error('教学不连接计分接口');");
  const beginStart=js.indexOf('  async function beginRun(){'),beginEnd=js.indexOf('  async function step(direction){',beginStart);
  js=js.slice(0,beginStart)+"  async function beginRun(){if(!started){started=true;practice=true;startTick=lastSanTick=performance.now();updateUI();}return true;}\n"+js.slice(beginEnd);
  js=once(js,'async function step(direction){','async function step(direction){if(!allowLesson(\'move\',direction))return;');
  js=once(js,"wasRestricted=game.restrictedVision;updateUI();","wasRestricted=game.restrictedVision;updateUI();if(result.kind==='move')completeLesson('move');");
  js=once(js,'function tool(type){',"function tool(type){if(!allowLesson(type))return;");
  js=once(js,"if(!['tool','win'].includes(result.kind))return;actions.push(type);","if(!['tool','win'].includes(result.kind))return;actions.push(type);setTimeout(()=>completeLesson(type),0);");
  js=once(js,'async function turn(delta){','async function turn(delta){if(!allowLesson(\'turn\',delta))return;');
  js=once(js,"updateUI();tone('turn');}","updateUI();tone('turn');completeLesson('turn');}");
  // A quiet 4x4 board keeps the original floor materials, avatar and animated tools.
  js=js.replaceAll('length: 81','length: SIZE*SIZE').replaceAll('length:81','length:SIZE*SIZE').replaceAll('next<81','next<SIZE*SIZE');
  js=js.replaceAll('Math.floor(index/9)','Math.floor(index/SIZE)').replaceAll('index%9','index%SIZE').replaceAll('Math.floor(i/9)','Math.floor(i/SIZE)').replaceAll('c:i%9','c:i%SIZE').replaceAll('Math.floor(fx.index/9)','Math.floor(fx.index/SIZE)').replaceAll('fx.index%9','fx.index%SIZE');
  js=js.replaceAll('plane(4,4,size)','plane((SIZE-1)/2,(SIZE-1)/2,size)').replaceAll('8-game.r','SIZE-1-game.r').replaceAll('8-game.c','SIZE-1-game.c');
  js=js.replaceAll('art.naturalWidth/9','art.naturalWidth/SIZE').replaceAll('art.naturalHeight/9','art.naturalHeight/SIZE');
  js=once(js,"const top=document.querySelector('.san-block').getBoundingClientRect().bottom-rect.top+18;","const top=document.getElementById('lesson-panel').getBoundingClientRect().bottom-rect.top+16;");
  js=once(js,'tile=Math.max(35,Math.min(width*.36,(bottom-top)/1.5,280));','tile=Math.max(28,Math.min(width/4.5,(bottom-top)/2.5,170));');
  js=once(js,'overviewSize=Math.max(12,Math.min(width/9.7,(bottom-overviewTop)/5.1));','overviewSize=tile;');
  js=once(js,'overviewY=(overviewTop+bottom)/2;','overviewY=viewY;');
  js=once(js,'camera.x=lerp(camera.x,player.x,follow);camera.y=lerp(camera.y,player.y,follow);','camera=plane((SIZE-1)/2,(SIZE-1)/2);');
  js=once(js,"canvas.dataset.visibleTiles=cells.filter", "if(!overview)cells=Array.from({length:SIZE*SIZE},(_,i)=>({r:Math.floor(i/SIZE),c:i%SIZE,opacity:cells.find(cell=>id(cell.r,cell.c)===i)?.opacity??.18}));\n    canvas.dataset.visibleTiles=cells.filter");
  js=once(js,"canvas.setAttribute('aria-label',", "ui['run-kind'].textContent='初次感知 · 不计分';\n    canvas.setAttribute('aria-label',");
  const init=await readFile(path.join(root,'school/tutorial/lesson.js'),'utf8');
  js=once(js,'  art.onload=',init+'\n  art.onload=');
  js=js.replaceAll('resize();camera=plane(game.r,game.c);','resize();camera=plane((SIZE-1)/2,(SIZE-1)/2);');
  js+='\n';
  await writeFile(path.join(dir,'game.js'),js);
  let html=gameHtml.replace('<title>元白 · 失重之间</title>','<title>探索元白 · 初次感知</title>');
  html=html.replace(/<body([^>]*)>/,'<body$1 class="school-tutorial">').replace('9 × 9 / 未知空间','4 × 4 / 初次感知').replace('位置 09 · 01','位置 04 · 01');
  html=html.replace(/<script data-school-entry>[\s\S]*?<\/script>/,'');
  html=html.replace('</head>','<link rel="stylesheet" href="immersive.css"></head>');
  html=html.replace('<nav aria-label="游戏菜单">','<div class="lesson-actions"><button id="restart-lesson">重新练习</button><button id="skip-lesson">跳过教学 ↗</button></div><nav aria-label="游戏菜单">');
  html=html.replace('<canvas id="world"','<section id="lesson-panel" class="lesson-panel" aria-live="polite"><div class="lesson-eyebrow"><span id="lesson-count"></span><span id="lesson-next-key"></span></div><h1 id="lesson-title"></h1><p id="lesson-copy"></p><button id="finish-lesson" hidden>进入正式探索 ↗</button></section><canvas id="world"');
  html=html.replace('aria-valuemax="66"','aria-valuemax="14"').replaceAll('/ 66','/ 14').replaceAll('/66','/14').replace('12 处道具','3 处道具').replace('>0</b> / 12','>0</b> / 3');
  await writeFile(path.join(dir,'index.html'),html);
  for(const file of ['style.css','yuanbai-art.webp','assets','school-game.css'])await cp(path.join(publicDir,'explore',file),path.join(dir,file),{recursive:true});
  await cp(path.join(root,'school/tutorial/immersive.css'),path.join(dir,'immersive.css'));
}
