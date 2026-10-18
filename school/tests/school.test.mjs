import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {buildSchool,output,root} from '../../scripts/build-school.mjs';
import {startPreview} from '../../scripts/preview-school.mjs';
import {initializeSchoolDatabase} from '../deploy/init-school-db.mjs';
import {solve} from '../../services/leaderboard/test/solver.mjs';
import vm from 'node:vm';
let preview,sourceGame,sourceHtml;
before(async()=>{sourceGame=await readFile(path.join(root,'public/explore/game.js'));sourceHtml=await readFile(path.join(root,'public/explore/index.html'));await buildSchool();preview=await startPreview({port:0,rebuild:false});});
after(async()=>preview?.close());
test('教学提示与道具切换不改变投影，窗口缩放仍能重新适配',async()=>{
  const js=await readFile(path.join(output,'public/tutorial/game.js'),'utf8');
  const start=js.indexOf("  let tutorialViewport='';"),end=js.indexOf('  new ResizeObserver(resize)',start);
  assert.ok(start>=0&&end>start);
  const state={w:800,h:700,top:180,bottom:620};
  const context=vm.createContext({state,window:{devicePixelRatio:1},canvas:{getBoundingClientRect:()=>({width:state.w,height:state.h,top:0})},ctx:{setTransform(){}},document:{getElementById:()=>({getBoundingClientRect:()=>({bottom:state.top})}),querySelector:()=>({getBoundingClientRect:()=>({top:state.bottom})})}});
  vm.runInContext('let width=0,height=0,tile=0,viewY=0,overviewSize=0,overviewY=0;'+js.slice(start,end)+';globalThis.measure=()=>{resize();return [tile,viewY,overviewSize,overviewY]};',context);
  const initial=Array.from(context.measure());
  state.top=260;state.bottom=580;
  assert.deepEqual(Array.from(context.measure()),initial);
  state.w=390;state.h=600;
  assert.notDeepEqual(Array.from(context.measure()),initial);
  const resized=Array.from(context.measure());
  assert.equal(resized[0],resized[2]);assert.equal(resized[1],resized[3]);
});
test('学校构建不修改原站源码，独立身份与入口完整',async()=>{
  assert.deepEqual(await readFile(path.join(root,'public/explore/game.js')),sourceGame);
  assert.deepEqual(await readFile(path.join(root,'public/explore/index.html')),sourceHtml);
  const home=await readFile(path.join(output,'public/index.html'),'utf8');
  assert(!home.includes('dialogue/'));assert(home.includes('id="root"'));assert(home.includes('感知元白'));
  const entries=await readdir(path.join(output,'public/assets'));
  const app=(await Promise.all(entries.filter(name=>name.endsWith('.js')).map(name=>readFile(path.join(output,'public/assets',name),'utf8')))).join('\n');
  assert(app.includes('对话元白'));assert(app.includes('/api/yuanbai/chat'));assert(app.includes('dialogue/'));assert(app.includes('game/?from=home'));
  assert.deepEqual(await readFile(path.join(output,'public/models/yuanbai-perception-sculpture.glb')),await readFile(path.join(root,'public/models/yuanbai-perception-sculpture.glb')));
  const html=await readFile(path.join(output,'public/game/index.html'),'utf8');
  const js=await readFile(path.join(output,'public/game/game.js'),'utf8');
  assert(!html.includes('model-preload'));assert(html.includes('返回元白主页面'));assert(html.includes('class="back-to-portal"'));assert(html.includes('<span>返回主页面</span>'));assert(!html.includes('back-to-school'));
  assert(js.includes('yuanbai-school-player-v1'));assert(!js.includes('applyLockedName();firstRunGuide();'));
  assert(js.includes("const leaderboardBase='/api/yuanbai/game'"));
  assert(html.includes('data-school-entry'));assert(html.includes("url.searchParams.get('from')"));assert(html.includes('重看互动教学'));
  for(const entry of ['index.html','tutorial/index.html','game/index.html','explore/index.html']){
    const text=await readFile(path.join(output,'public',entry),'utf8');
    for(const match of text.matchAll(/(?:src|href)="([^"?#]+\.(?:css|js|svg|png|jpg))(?:\?[^"#]*)?"/g)){
      const base=path.dirname(path.join(output,'public',entry));
      const resource=match[1].startsWith('/yuanbai/')?path.join(output,'public',match[1].slice(9)):path.resolve(base,text.includes('<base href="../">')?'..':'.',match[1]);
      await readFile(resource);
      if(/\.(css|js)$/.test(match[1]))assert(match[0].includes('?v='),match[0]);
    }
  }
});
test('4×4 教学沿用真实核心规则，三种工具可完成且探测不会移动玩家',async()=>{
  const context={};vm.createContext(context);vm.runInContext(await readFile(path.join(output,'public/tutorial/core.js'),'utf8'),context);
  const {Game,SIZE,SAFE_COUNT}=context.YuanbaiCore;assert.equal(SIZE,4);assert.equal(SAFE_COUNT,14);
  const game=new Game();assert.equal(game.position,12);
  assert.equal(game.move(0).pickup.type,'companion');assert.equal(game.useTool('companion').kind,'tool');
  assert.equal(game.move(0).pickup.type,'probe');game.turn(1);const position=game.position;
  assert.equal(game.useTool('probe').targets[0].c,1);assert.equal(game.position,position);
  assert.equal(game.move(0).pickup.type,'panorama');assert.equal(game.useTool('panorama').targets.length,16);
  const config=JSON.parse(await readFile(path.join(output,'college-config.example.json'),'utf8'));assert.equal(config.readOnly,true);
});
test('学校页面可在子路径访问，目录跳转保留末尾斜杠',async()=>{
  for(const suffix of ['/','/yuanbai/','/yuanbai/tutorial/','/yuanbai/explore/','/yuanbai/game/']){
    const response=await fetch(preview.url+suffix);assert.equal(response.status,200,suffix);assert(response.headers.get('content-type').includes('text/html'));
  }
  const response=await fetch(preview.url+'/yuanbai/tutorial',{redirect:'manual'});
  assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/yuanbai/tutorial/');
  assert.equal((await fetch(preview.url+'/data/school-leaderboard.sqlite')).status,404);
});
test('学校新局、服务器校验、入榜完整闭环，旧站来源不能写入',async()=>{
  const call=async(route,body,token,origin=preview.url)=>{
    const headers={Origin:origin};if(body!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization='Bearer '+token;
    const result=await fetch(preview.url+'/api/yuanbai/game/'+route,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
    return {status:result.status,data:result.headers.get('content-type')?.includes('application/json')?await result.json():null};
  };
  assert.equal((await call('runs',{},null,'https://apps-demo.muyang23333.top')).status,403);
  const start=await call('runs',{layoutVersion:'seeded-v1'});assert.equal(start.status,201);
  const {runId,playerToken,layoutSeed}=start.data;
  assert.equal((await call('finish',{runId,actions:['m0']},playerToken)).status,400);
  preview.DB.sqlite.prepare('UPDATE runs SET started_at=? WHERE id=?').run(Date.now()-300000,runId);
  const finish=await call('finish',{runId,actions:solve(false,layoutSeed).actions},playerToken);assert.equal(finish.status,200,JSON.stringify(finish.data));
  const result=await call('scores',{runId,nickname:'学校测试探索者'},playerToken);assert.equal(result.status,200);
  const board=await call('leaderboard');assert.equal(board.status,200);assert.equal(board.data.items[0].nickname,'学校测试探索者');
  assert(!JSON.stringify(board.data).includes(playerToken));
});
test('新建学校数据库拒绝覆盖，重开数据库保留已有表和记录',async()=>{
  const temporary=await mkdtemp(path.join(tmpdir(),'yuanbai-school-'));
  try{
    const filename=path.join(temporary,'school.sqlite');
    await initializeSchoolDatabase(filename,path.join(root,'services/leaderboard/sqlite.cjs'));
    await assert.rejects(initializeSchoolDatabase(filename,path.join(root,'services/leaderboard/sqlite.cjs')),/拒绝覆盖/);
    const db=new DatabaseSync(filename);const names=db.prepare('SELECT name FROM _local_migrations').all();db.close();assert(names.length>=5);
    const reopened=new DatabaseSync(filename);assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM _local_migrations').get().n,names.length);reopened.close();
  }finally{
    const resolved=path.resolve(temporary);assert(resolved.startsWith(path.resolve(tmpdir())+path.sep));await rm(resolved,{recursive:true,force:true});
  }
});

test('首次首页入口弹教学，旧玩家与直接游戏链接不跳转；存储受限不产生循环',async()=>{
  const gate=await readFile(path.join(root,'school/entry-gate.js'),'utf8');
  function enter({query='?from=home',local=null,session=null,blocked=false}={}){
    const redirects=[],historyPaths=[];
    vm.runInNewContext(gate,{URL,location:{href:'https://school.test/yuanbai/game/'+query,replace:value=>redirects.push(value)},history:{state:null,replaceState:(_,__,value)=>historyPaths.push(value)},localStorage:{getItem:()=>{if(blocked)throw Error('blocked');return local;}},sessionStorage:{getItem:()=>session}});
    return {redirects,historyPaths};
  }
  assert.deepEqual(enter().redirects,['../tutorial/']);
  for(const value of ['seen','complete'])assert.deepEqual(enter({local:value}),{redirects:[],historyPaths:['/yuanbai/game/']});
  assert.deepEqual(enter({blocked:true,session:'seen'}).redirects,[]);
  assert.deepEqual(enter({blocked:true}).redirects,['../tutorial/']);
  assert.deepEqual(enter({query:''}).redirects,[]);
  assert.deepEqual(enter({local:'seen',query:'?from=home&view=1#game'}).historyPaths,['/yuanbai/game/?view=1#game']);
  const tutorial=await readFile(path.join(output,'public/tutorial/index.html'),'utf8');assert(!tutorial.includes('data-school-entry'));
});

 test('公众号旧入口渲染首页，正式游戏与教学都返回该首页',async()=>{
  const portal=await (await fetch(preview.url+'/yuanbai/explore/')).text();
  assert(portal.includes('id="root"'));assert(portal.includes('<base href="../">'));assert(!portal.includes('data-school-entry'));
  const file=await (await fetch(preview.url+'/yuanbai/explore/index.html')).text();assert.equal(file,portal);
  for(const route of ['game','tutorial']){
    const html=await (await fetch(preview.url+'/yuanbai/'+route+'/')).text();
    assert(html.includes('class="back-to-portal" href="../explore/"'));
  }
  const tutorial=await readFile(path.join(output,'public/tutorial/game.js'),'utf8');
  assert(tutorial.includes("location.assign('../game/');"));assert(!tutorial.includes("location.assign('../explore/');"));
  const resp=await fetch(preview.url+'/yuanbai/game?from=home',{redirect:'manual'});
  assert.equal(resp.headers.get('location'),'/yuanbai/game/?from=home');
});
