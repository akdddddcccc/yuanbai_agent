import '../../public/explore/core.js';
const core=globalThis.YuanbaiCore;
const {replay,RULE_VERSION,PANORAMA_MS}=core;
const HISTORICAL_RULES={san:'yuanbai-v5-san',previous:'yuanbai-v3',reconstruction:'yuanbai-v4',legacy:'yuanbai-v2'};
const uid=()=>crypto.randomUUID();
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
function db(env){if(!env.DB)throw new Error('排行榜数据库尚未连接');return env.DB;}
async function player(request){
  const authorization=request.headers.get('authorization');
  if(!authorization)return null;
  const token=authorization.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if(!token)throw new Error('身份凭据无效');
  return hash(token);
}
async function body(request){const raw=await request.text();if(raw.length>200000)throw new Error('提交内容过大');try{return JSON.parse(raw);}catch{throw new Error('提交格式无效');}}
function publicScore(row){return {deaths:row.deaths,durationMs:row.duration_ms,steps:row.steps};}
async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function handleApi(request,env){
  const url=new URL(request.url),path=url.pathname.replace(/^\/api\/yuanbai\/game\//,'/api/'),now=Date.now();
  if(request.method==='POST'){
    const origin=request.headers.get('origin');
    if(origin&&origin!==url.origin&&origin!==env.APP_ORIGIN)return json({error:'请从游戏页面内提交。'},403);
    if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'提交格式无效'},415);
  }
  if(request.headers.has('authorization')&&!/^Bearer [a-f0-9]{64}$/.test(request.headers.get('authorization')))return json({error:'身份凭据无效'},401);
  try{
    const owner=await player(request);
    if(path==='/api/runs'&&request.method==='POST'){
      const token=owner?null:[...crypto.getRandomValues(new Uint8Array(32))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
      const pid=owner||await hash(token);
      const recent=await db(env).prepare('SELECT COUNT(*) AS n FROM runs WHERE player_id=? AND started_at>?').bind(pid,now-60000).first();
      if(recent.n>=20)return json({error:'新局创建过于频繁，请稍后再试。'},429);
      const runId=uid();await db(env).prepare('INSERT INTO runs (id,player_id,rule_version,started_at) VALUES (?,?,?,?)').bind(runId,pid,RULE_VERSION,now).run();
      return json({runId,ruleVersion:RULE_VERSION,startedAt:now,...(token?{playerToken:token}:{})},201);
    }
    if(path==='/api/finish'&&request.method==='POST'){
      if(!owner)return json({error:'本局身份已失效，请重新开始。'},401);
      const data=await body(request);
      if(typeof data.runId!=='string')return json({error:'缺少本局记录'},400);
      const run=await db(env).prepare('SELECT * FROM runs WHERE id=? AND player_id=? AND rule_version=?').bind(data.runId,owner,RULE_VERSION).first();
      if(!run)return json({error:'找不到这次探索，请重新开始。'},404);
      const signature=await hash(JSON.stringify(data.actions));
      if(run.finished_at!==null){if(run.replay_hash!==signature)return json({error:'本局已经完成，无法替换动作。'},409);return json({verified:true,...publicScore(run)});}
      let result;try{result=replay(data.actions);}catch(error){return json({error:error.message},400);}
      const duration=now-run.started_at;
      const minimum=result.totalSteps*55+result.falls*900+result.usedPanoramas*PANORAMA_MS;
      if(duration<minimum||duration>86400000)return json({error:'本局计时异常，不能加入排行榜。'},400);
      await db(env).prepare('UPDATE runs SET finished_at=?,duration_ms=?,deaths=?,steps=?,replay_hash=? WHERE id=? AND player_id=? AND finished_at IS NULL').bind(now,duration,result.falls,result.totalSteps,signature,run.id,owner).run();
      const saved=await db(env).prepare('SELECT * FROM runs WHERE id=? AND player_id=?').bind(run.id,owner).first();
      if(saved.replay_hash!==signature)return json({error:'本局已被另一份结果确认'},409);
      return json({verified:true,...publicScore(saved)});
    }
    if(path==='/api/scores'&&request.method==='POST'){
      if(!owner)return json({error:'本局身份已失效'},401);
      const data=await body(request);
      const name=typeof data.nickname==='string'?data.nickname.normalize('NFC').trim():'';
      if(!name||Array.from(name).length>16||/[\u0000-\u001f\u007f<>]/.test(name))return json({error:'昵称请输入1—16个字符，不含控制符或尖括号。'},400);
      const run=await db(env).prepare('SELECT * FROM runs WHERE id=? AND player_id=? AND rule_version=? AND finished_at IS NOT NULL').bind(String(data.runId||''),owner,RULE_VERSION).first();
      if(!run)return json({error:'请先完成本局成绩校验。'},400);
      // 原子择优，重复点击或较慢的旧请求不会覆盖更好的成绩。
      await db(env).prepare(`INSERT INTO scores (id,player_id,run_id,rule_version,nickname,deaths,duration_ms,steps,created_at)
        VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(player_id,rule_version) DO UPDATE SET
        run_id=excluded.run_id,nickname=excluded.nickname,deaths=excluded.deaths,duration_ms=excluded.duration_ms,steps=excluded.steps,created_at=excluded.created_at
        WHERE (excluded.deaths,excluded.duration_ms,excluded.steps)<(scores.deaths,scores.duration_ms,scores.steps)`)
        .bind(uid(),owner,run.id,RULE_VERSION,name,run.deaths,run.duration_ms,run.steps,now).run();
      const best=await db(env).prepare('SELECT * FROM scores WHERE player_id=? AND rule_version=?').bind(owner,RULE_VERSION).first();
      const rank=await db(env).prepare('SELECT COUNT(*)+1 AS rank FROM scores WHERE rule_version=? AND (deaths,duration_ms,steps,created_at,id)<(?,?,?,?,?)').bind(RULE_VERSION,best.deaths,best.duration_ms,best.steps,best.created_at,best.id).first();
      return json({saved:true,personalBest:best.run_id===run.id,rank:rank.rank,nickname:best.nickname,...publicScore(best)});
    }
    if(path==='/api/leaderboard'&&request.method==='GET'){
      const raw=Number(url.searchParams.get('page')||1);if(!Number.isInteger(raw)||raw<1||raw>10000)return json({error:'页码无效'},400);
      const season=url.searchParams.get('season')||'current';if(!['current',...Object.keys(HISTORICAL_RULES)].includes(season))return json({error:'榜单版本无效'},400);
      const version=season==='current'?RULE_VERSION:HISTORICAL_RULES[season];
      const total=await db(env).prepare('SELECT COUNT(*) AS n FROM scores WHERE rule_version=?').bind(version).first();
      const page=Math.min(raw,Math.max(1,Math.ceil(total.n/20))),offset=(page-1)*20;
      const rows=await db(env).prepare('SELECT id,player_id,nickname,deaths,duration_ms,steps FROM scores WHERE rule_version=? ORDER BY deaths ASC,duration_ms ASC,steps ASC,created_at ASC,id ASC LIMIT 20 OFFSET ?').bind(version,offset).all();
      return json({season,page,pageSize:20,total:total.n,items:rows.results.map((r,i)=>({rank:offset+i+1,nickname:r.nickname,isYou:!!owner&&r.player_id===owner,...publicScore(r)}))});
    }
    return json({error:'接口不存在'},404);
  }catch(error){console.error('Leaderboard request failed:',error);return json({error:'排行榜暂时无法连接，请稍后重试。'},503);}
}
