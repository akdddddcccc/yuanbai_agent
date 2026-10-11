import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,appendFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createLeaderboardServer} from '../server.mjs';
import {exportDatabase,restoreDatabase,inspectDatabase} from '../database-transfer.mjs';
import {solve} from './solver.mjs';
const oldOrigin='https://apps-demo.muyang23333.top',college='https://college.example';
async function start(t,options){
  const value=createLeaderboardServer(options);
  await new Promise(resolve=>value.server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>value.server.close(resolve)));
  return {...value,async request(route,{data,token,origin=college}={}){
    const response=await fetch('http://127.0.0.1:'+value.server.address().port+'/api/yuanbai/game/'+route,{method:data===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
    return {status:response.status,data:await response.json(),headers:response.headers};
  }};
}
test('旧域名与学院域名精确放行，其他来源及不安全配置拒绝',async t=>{
  const s=await start(t,{origins:[college,oldOrigin]});
  for(const origin of [college,oldOrigin]){
    const r=await s.request('runs',{origin,data:{}});assert.equal(r.status,201);assert.equal(r.headers.get('access-control-allow-origin'),origin);
  }
  for(const origin of ['https://evil.example','http://college.example','https://college.example.evil.example','null'])assert.equal((await s.request('runs',{origin,data:{}})).status,403);
  for(const origins of [[],['http://college.example'],['https://college.example/'],['https://user:pass@college.example'],['https://college.example?x']])assert.throws(()=>createLeaderboardServer({origins}));
});
test('只读验收和切换维护期间拒绝写入，榜单仍可读',async t=>{
  const s=await start(t,{origins:[college],readOnly:true});
  for(const route of ['runs','finish','scores']){const r=await s.request(route,{data:{}});assert.equal(r.status,503);assert.equal(r.headers.get('retry-after'),'300');}
  assert.equal((await s.request('leaderboard')).status,200);assert.equal(s.DB.sqlite.prepare('SELECT count(*) n FROM runs').get().n,0);
});
test('活动 WAL 库完整迁移，保留双榜、玩家身份、昵称与继续写入能力',async t=>{
  const dir=mkdtempSync(path.join(tmpdir(),'yuanbai-migration-'));
  // after hooks run in registration order; cleanup is registered last below.
  const source=path.join(dir,'source.sqlite'),snapshot=path.join(dir,'snapshot.sqlite'),target=path.join(dir,'target.sqlite');
  const old=await start(t,{database:source,origins:[oldOrigin]});
  const begun=await old.request('runs',{origin:oldOrigin,data:{}}),token=begun.data.playerToken;
  old.DB.sqlite.prepare('UPDATE runs SET started_at=? WHERE id=?').run(Date.now()-100000,begun.data.runId);
  assert.equal((await old.request('finish',{origin:oldOrigin,token,data:{runId:begun.data.runId,actions:solve(true).actions}})).status,200);
  assert.equal((await old.request('scores',{origin:oldOrigin,token,data:{runId:begun.data.runId,nickname:'迁移测试玩家'}})).status,200);
  assert.equal(existsSync(source+'-wal'),true);
  const before=inspectDatabase(source),manifest=await exportDatabase(source,snapshot);
  assert.deepEqual(manifest.tables,before.tables);assert.match(manifest.sha256,/^[a-f0-9]{64}$/);
  await assert.rejects(exportDatabase(source,snapshot),/EEXIST/);
  await restoreDatabase(snapshot,target);assert.deepEqual(inspectDatabase(target),before);
  await assert.rejects(restoreDatabase(snapshot,target),/EEXIST|活动文件/);
  const migrated=await start(t,{database:target,origins:[college,oldOrigin]});
  for(const board of ['normal','deaths']){
    const a=await old.request('leaderboard?board='+board,{origin:oldOrigin,token});
    const b=await migrated.request('leaderboard?board='+board,{token});
    assert.deepEqual(b.data,a.data);assert.equal(b.data.items[0].isYou,true);
  }
  const next=await migrated.request('runs',{token,data:{}});assert.equal(next.status,201);assert.equal(next.data.nickname,'迁移测试玩家');
  assert.equal(inspectDatabase(source).tables.runs,before.tables.runs);
  appendFileSync(snapshot,'tampered');await assert.rejects(restoreDatabase(snapshot,path.join(dir,'bad.sqlite')),/校验失败/);assert.equal(existsSync(path.join(dir,'bad.sqlite')),false);
  t.after(()=>{const resolved=path.resolve(dir);if(!resolved.startsWith(path.resolve(tmpdir())+path.sep+'yuanbai-migration-'))throw Error('unexpected cleanup path');rmSync(resolved,{recursive:true,force:true});});
});
