import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {exportDatabase} from './database-transfer.mjs';
import '../../public/explore/core.js';
const {localDB}=createRequire(import.meta.url)('./sqlite.cjs');
const digest=s=>createHash('sha256').update(s).digest('hex');

// Administrator-only offline import. Public clients cannot upload historical scores.
export async function importHistory(database,input,{apply=false}={}){
  if(!existsSync(database))throw Error('请先初始化学校数据库');
  if(input.format!=='yuanbai-history-v1'||input.ruleVersion!==globalThis.YuanbaiCore.RULE_VERSION)throw Error('导入格式或规则版本不匹配');
  if(!Array.isArray(input.records)||!input.records.length||input.records.length>100000)throw Error('records 须有 1–100000 条记录');
  const seen=new Set();
  const rows=input.records.map(r=>{
    if(!['best','deaths'].includes(r.board))throw Error('board 须为 best 或 deaths');
    if(typeof r.sourceId!=='string'||!r.sourceId.trim()||r.sourceId.length>200)throw Error('每条成绩须有稳定 sourceId');
    if(typeof r.nickname!=='string'||!r.nickname.trim()||r.nickname.length>80)throw Error('昵称缺失或过长');
    for(const field of ['deaths','durationMs','steps','completedAt'])if(!Number.isSafeInteger(r[field])||r[field]<0)throw Error(field+' 必须为非负安全整数');
    const id='history:'+digest(r.board+':'+r.sourceId);
    if(seen.has(id))throw Error('文件内有重复 sourceId/board');seen.add(id);
    return {...r,id,table:r.board==='best'?'scores':'death_scores'};
  });
  const db=localDB(database).sqlite;
  let backup;
  try{
    const pending=[];
    for(const r of rows){
      const old=db.prepare(`SELECT * FROM ${r.table} WHERE id=?`).get(r.id);
      if(old){if(old.nickname!==r.nickname||old.deaths!==r.deaths||old.duration_ms!==r.durationMs||old.steps!==r.steps||old.created_at!==r.completedAt)throw Error('同一 sourceId 数据冲突，拒绝覆盖：'+r.sourceId);}
      else pending.push(r);
    }
    if(apply&&pending.length){
      backup=database+'.before-import-'+Date.now()+'.sqlite';
      await exportDatabase(database,backup);
      db.exec('BEGIN IMMEDIATE');
      try{
        for(const r of pending)db.prepare(`INSERT INTO ${r.table} (id,player_id,run_id,rule_version,nickname,deaths,duration_ms,steps,created_at,is_newbie) VALUES (?,?,?,?,?,?,?,?,?,0)`).run(r.id,r.id,r.id,input.ruleVersion,r.nickname,r.deaths,r.durationMs,r.steps,r.completedAt);
        db.exec('COMMIT');
      }catch(e){db.exec('ROLLBACK');throw e;}
    }
    return {apply,total:rows.length,added:apply?pending.length:0,wouldAdd:pending.length,existing:rows.length-pending.length,backup};
  }finally{db.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const [database,file,flag]=process.argv.slice(2);
    if(!database||!file||(flag&&flag!=='--apply'))throw Error('用法：node services/leaderboard/import-history.mjs 数据库 文件.json [--apply]；默认仅预检。请在停止学校排行榜服务后导入。');
    console.log(JSON.stringify(await importHistory(database,JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,'')),{apply:flag==='--apply'}),null,2));
  }catch(e){console.error(e.message);process.exitCode=1;}
}
