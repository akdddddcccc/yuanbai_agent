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

test('正常榜先比坠落再比用时，同一玩家保留最好成绩',async t=>{
  const s=await setup(t);
  const slow=await s.complete({name:'慢而稳',duration:100000});
  await s.complete({name:'快但坠落',fall:true,duration:30000});
  const fast=await s.complete({name:'零坠落',duration:40000});
  const worse=await s.complete({name:'零坠落',duration:180000,token:fast.token});
  assert.equal(worse.saved.data.personalBest,false);
  const board=await s.request('/leaderboard?season=current',undefined,slow.token);
  assert.equal(board.status,200);
  assert.deepEqual(board.data.items.map(item=>item.nickname),['零坠落','慢而稳','快但坠落']);
  assert.equal(board.data.items[1].isYou,true);
  assert(!JSON.stringify(board.data).includes('player_id'));
  assert(!JSON.stringify(board.data).includes(slow.token));
});

test('死亡榜记录每位玩家已校验通关中坠落最多的一局，不覆盖正常榜',async t=>{
  const s=await setup(t);
  const steady=await s.complete({name:'稳稳',duration:40000});
  const fallen=await s.complete({name:'先掉两次',fall:2,duration:70000});
  await s.complete({name:'先掉两次',duration:90000,token:fallen.token});
  const deathBoard=await s.request('/leaderboard?board=deaths',undefined,fallen.token);
  assert.equal(deathBoard.status,200);
  assert.deepEqual(deathBoard.data.items.map(item=>item.nickname),['先掉两次','稳稳']);
  assert.deepEqual(deathBoard.data.items.map(item=>item.deaths),[2,0]);
  assert.equal(deathBoard.data.items[0].isYou,true);
  const normal=await s.request('/leaderboard?board=normal',undefined,steady.token);
  assert.deepEqual(normal.data.items.map(item=>item.nickname),['稳稳','先掉两次']);
  assert.equal((await s.request('/leaderboard?board=invalid')).status,400);
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
  let activeServer;
  t.after(async()=>{if(activeServer?.listening)await new Promise(resolve=>activeServer.close(resolve));
    assert(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'yuanbai-leaderboard-'));
    rmSync(dir,{recursive:true,force:true});});
  const database=path.join(dir,'scores.sqlite');
  const first=createLeaderboardServer({database});activeServer=first.server;
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
  activeServer=second.server;
  await new Promise(resolve=>second.server.listen(0,'127.0.0.1',resolve));
  const board=await fetch('http://127.0.0.1:'+second.server.address().port+'/api/yuanbai/game/leaderboard',{headers:{Origin:ORIGIN,Authorization:'Bearer '+started.playerToken}}).then(r=>r.json());
  assert.equal(board.total,1);
  assert.equal(board.items[0].nickname,'留在云端');
  assert.equal(board.items[0].isYou,true);
});


test('重复提交保持唯一记录和首次完成时间，修改回放被拒绝',async t=>{
  const s=await setup(t),r=await s.complete({name:'重试测试'});
  const again=await s.request('/finish',{runId:r.started.data.runId,actions:solve().actions},r.token);
  assert.equal(again.data.durationMs,r.verified.data.durationMs);
  const changed=await s.request('/finish',{runId:r.started.data.runId,actions:['left',...solve().actions]},r.token);
  assert.equal(changed.status,409);
  await s.request('/scores',{runId:r.started.data.runId,nickname:'重试测试'},r.token);
  const board=await s.request('/leaderboard',undefined,r.token);
  assert.equal(board.data.total,1);
  assert.equal(board.data.items[0].rank,r.saved.data.rank);
  assert(Number.isSafeInteger(board.data.items[0].completedAt));
  assert.equal(board.data.items[0].durationMs,r.verified.data.durationMs);
  assert.equal((await s.request('/leaderboard?page=-1')).status,400);
  assert.equal((await s.request('/leaderboard?board=unknown')).status,400);
});

test('开局限流按一屋子人给余量，只挡脚本刷库',async t=>{
  const s=await setup(t);
  let allowed=0;
  for(let i=0;i<121;i++){
    const response=await s.request('/runs',{});
    if(response.status===201){allowed++;continue;}
    assert.equal(response.status,429);
    break;
  }
  assert.equal(allowed,120,'一屋子人同时扫码开局不该被挡');
});

test('入榜按成功次数限流，失败提交不占名额，被挡住仍保留已通关成绩',async t=>{
  const s=await setup(t);
  const first=await s.request('/runs',{}),token=first.data.playerToken;
  // 昵称不合法或本局还没校验通关的提交会 4xx，不应消耗入榜名额。
  for(let i=0;i<5;i++)assert.equal((await s.request('/scores',{runId:'missing',nickname:'<bad>'},token)).status,400);
  async function verifiedRun(){
    const started=await s.request('/runs',{},token);
    assert.equal(started.status,201);
    s.DB.sqlite.prepare('UPDATE runs SET started_at=? WHERE id=?').run(Date.now()-100000,started.data.runId);
    assert.equal((await s.request('/finish',{runId:started.data.runId,actions:solve().actions},token)).status,200);
    return started.data.runId;
  }
  for(let i=0;i<20;i++)assert.equal((await s.request('/scores',{runId:await verifiedRun(),nickname:'入榜'},token)).status,200);
  const blocked=await s.request('/scores',{runId:await verifiedRun(),nickname:'第二十一'},token);
  assert.equal(blocked.status,429);
  assert.match(blocked.data.error,/入榜提交过于频繁/);
  const board=await s.request('/leaderboard?board=normal',undefined,token);
  assert.equal(board.status,200);
  assert.equal(board.data.total,1);
  assert.equal(board.data.items[0].isYou,true);
});

test('每人只能起一次名：首次上榜带新手标，成绩进步后消失',async t=>{
  const s=await setup(t);
  const first=await s.complete({name:'第一个名字',duration:100000});
  let board=await s.request('/leaderboard?board=normal',undefined,first.token);
  assert.equal(board.data.items.find(i=>i.nickname==='第一个名字').newbie,true);
  // 换名字被拒绝
  assert.equal((await s.request('/scores',{runId:first.started.data.runId,nickname:'第二个名字'},first.token)).status,400);
  // 用原名提交更好的成绩 → 新手标消失
  const better=await s.complete({name:'第一个名字',duration:50000,token:first.token});
  assert.equal(better.saved.data.personalBest,true);
  board=await s.request('/leaderboard?board=normal',undefined,first.token);
  assert.equal(board.data.items.find(i=>i.nickname==='第一个名字').newbie,false);
  assert.equal(board.data.total,1);
});
