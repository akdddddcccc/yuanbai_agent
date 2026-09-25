import test from 'node:test';
import assert from 'node:assert/strict';
import {createLeaderboardServer} from '../server.mjs';
import {solve} from './solver.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const ORIGIN='https://apps-demo.muyang23333.top';

async function setup(t){
  const {server,DB}=createLeaderboardServer({origin:ORIGIN});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  async function request(path,data,token,origin=ORIGIN){
    const headers={Origin:origin};
    if(data!==undefined)headers['Content-Type']='application/json';
    if(token)headers.Authorization='Bearer '+token;
    const response=await fetch(base+'/api/yuanbai/game'+path,{method:data===undefined?'GET':'POST',headers,body:data===undefined?undefined:JSON.stringify(data)});
    return {status:response.status,data:await response.json(),headers:response.headers};
  }
  async function complete({fall=false,duration=100000,token,name='探索者'}={}){
    const started=await request('/runs',{},token);
    assert.equal(started.status,201);
    const playerToken=token||started.data.playerToken;
    assert.match(playerToken,/^[a-f0-9]{64}$/);
    DB.sqlite.prepare('UPDATE runs SET started_at=? WHERE id=?').run(Date.now()-duration,started.data.runId);
    const verified=await request('/finish',{runId:started.data.runId,actions:solve(fall).actions},playerToken);
    assert.equal(verified.status,200);
    const saved=await request('/scores',{runId:started.data.runId,nickname:name},playerToken);
    assert.equal(saved.status,200);
    return {started,verified,saved,token:playerToken};
  }
  return {base,DB,request,complete};
}

test('跨玩家排行榜按坠落次数、用时排序，同一玩家保留最好成绩',async t=>{
  const s=await setup(t);
  const slow=await s.complete({name:'慢而稳',duration:100000});
  await s.complete({name:'快但坠落',fall:true,duration:30000});
  const fast=await s.complete({name:'零坠落',duration:40000});
  const worse=await s.complete({name:'更慢的一局',duration:180000,token:fast.token});
  assert.equal(worse.saved.data.personalBest,false);
  const board=await s.request('/leaderboard?season=current',undefined,slow.token);
  assert.equal(board.status,200);
  assert.deepEqual(board.data.items.map(item=>item.nickname),['零坠落','慢而稳','快但坠落']);
  assert.equal(board.data.items[1].isYou,true);
  assert(!JSON.stringify(board.data).includes('player_id'));
  assert(!JSON.stringify(board.data).includes(slow.token));
});

test('服务端重放、归属和计时校验阻止伪造成绩',async t=>{
  const s=await setup(t);
  const run=await s.request('/runs',{}),token=run.data.playerToken;
  assert.equal((await s.request('/finish',{runId:run.data.runId,actions:['m0']},token)).status,400);
  assert.equal((await s.request('/scores',{runId:run.data.runId,nickname:'作弊'},token)).status,400);
  const outsider=await s.request('/runs',{});
  assert.equal((await s.request('/finish',{runId:run.data.runId,actions:solve().actions},outsider.data.playerToken)).status,404);
  assert.equal((await s.request('/finish',{runId:run.data.runId,actions:solve().actions},token)).status,400);
  assert.equal((await s.request('/scores',{runId:run.data.runId,nickname:'<script>'},token)).status,400);
  assert.equal((await s.request('/leaderboard')).data.total,0);
});

test('HTTPS 页面跨来源可用，其他来源禁止提交，预检允许授权标头',async t=>{
  const s=await setup(t);
  const preflight=await fetch(s.base+'/api/yuanbai/game/runs',{method:'OPTIONS',headers:{Origin:ORIGIN,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-origin'),ORIGIN);
  assert.match(preflight.headers.get('access-control-allow-headers'),/Authorization/);
  assert.equal((await s.request('/runs',{},null,'https://stranger.example')).status,403);
  const run=await s.request('/runs',{});
  assert.equal(run.headers.get('access-control-allow-origin'),ORIGIN);
  assert.equal(run.headers.get('set-cookie'),null);
  assert.equal((await s.request('/runs',{},'invalid')).status,401);
});

test('服务器重启后 SQLite 保留成绩',async t=>{
  const dir=mkdtempSync(path.join(tmpdir(),'yuanbai-leaderboard-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const database=path.join(dir,'scores.sqlite');
  const first=createLeaderboardServer({database});
  await new Promise(resolve=>first.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+first.server.address().port;
  const started=await fetch(base+'/api/yuanbai/game/runs',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:'{}'}).then(r=>r.json());
  first.DB.sqlite.prepare('UPDATE runs SET started_at=? WHERE id=?').run(Date.now()-100000,started.runId);
  const headers={Origin:ORIGIN,'Content-Type':'application/json',Authorization:'Bearer '+started.playerToken};
  const verified=await fetch(base+'/api/yuanbai/game/finish',{method:'POST',headers,body:JSON.stringify({runId:started.runId,actions:solve().actions})});
  assert.equal(verified.status,200);
  const saved=await fetch(base+'/api/yuanbai/game/scores',{method:'POST',headers,body:JSON.stringify({runId:started.runId,nickname:'留在云端'})});
  assert.equal(saved.status,200);
  await new Promise(resolve=>first.server.close(resolve));
  const second=createLeaderboardServer({database});
  t.after(()=>new Promise(resolve=>second.server.close(resolve)));
  await new Promise(resolve=>second.server.listen(0,'127.0.0.1',resolve));
  const board=await fetch('http://127.0.0.1:'+second.server.address().port+'/api/yuanbai/game/leaderboard',{headers:{Origin:ORIGIN,Authorization:'Bearer '+started.playerToken}}).then(r=>r.json());
  assert.equal(board.total,1);
  assert.equal(board.items[0].nickname,'留在云端');
  assert.equal(board.items[0].isYou,true);
});

test('平衡版与原 SAN 版分榜显示',async t=>{
  const s=await setup(t);
  s.DB.sqlite.prepare('INSERT INTO scores (id,player_id,run_id,rule_version,nickname,deaths,duration_ms,steps,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run('old-score','old-player','old-run','yuanbai-v5-san','旧版探索者',1,100000,80,Date.now());
  const current=await s.request('/leaderboard?season=current');
  const old=await s.request('/leaderboard?season=san');
  assert.equal(current.data.total,0);
  assert.equal(old.data.total,1);
  assert.equal(old.data.items[0].nickname,'旧版探索者');
});
