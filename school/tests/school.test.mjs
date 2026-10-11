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
let preview,sourceGame,sourceHtml;
before(async()=>{sourceGame=await readFile(path.join(root,'public/explore/game.js'));sourceHtml=await readFile(path.join(root,'public/explore/index.html'));await buildSchool();preview=await startPreview({port:0,rebuild:false});});
after(async()=>preview?.close());
test('学校构建不修改原站源码，独立身份与入口完整',async()=>{
  assert.deepEqual(await readFile(path.join(root,'public/explore/game.js')),sourceGame);
  assert.deepEqual(await readFile(path.join(root,'public/explore/index.html')),sourceHtml);
  const home=await readFile(path.join(output,'public/index.html'),'utf8');
  assert(!home.includes('dialogue/'));assert(home.includes('id="rules"'));
  const html=await readFile(path.join(output,'public/explore/index.html'),'utf8');
  const js=await readFile(path.join(output,'public/explore/game.js'),'utf8');
  assert(!html.includes('model-preload'));assert(!html.includes('返回主页'));assert(html.includes('返回学院游戏首页'));
  assert(js.includes('yuanbai-school-player-v1'));assert(!js.includes('applyLockedName();firstRunGuide();'));
  assert(js.includes("const leaderboardBase='/api/yuanbai/game'"));
  for(const entry of ['index.html','tutorial/index.html','explore/index.html']){
    const text=await readFile(path.join(output,'public',entry),'utf8');
    for(const match of text.matchAll(/(?:src|href)="([^"?#]+\.(?:css|js|svg|png|jpg))(?:\?[^"#]*)?"/g)){
      const resource=path.resolve(path.dirname(path.join(output,'public',entry)),match[1]);
      await readFile(resource);
      if(/\.(css|js)$/.test(match[1]))assert(match[0].includes('?v='),match[0]);
    }
  }
});
test('学校页面可在子路径访问，目录跳转保留末尾斜杠',async()=>{
  for(const suffix of ['/','/yuanbai/','/yuanbai/tutorial/','/yuanbai/explore/']){
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
