import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createLeaderboardServer} from '../server.mjs';
import {importHistory} from '../import-history.mjs';
import {DatabaseSync} from 'node:sqlite';
test('学校 HTTP 白名单独立接收新局，拒绝个人站来源',async t=>{
 const origin='http://oa.design.bnuzh.edu.cn';
 assert.throws(()=>createLeaderboardServer({origins:[origin]}));
 const {server}=createLeaderboardServer({origins:[origin],allowHttp:true});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>server.close(r)));
 const url=`http://127.0.0.1:${server.address().port}/api/yuanbai/game/runs`;
 for(const [value,status] of [[origin,201],['https://apps-demo.muyang23333.top',403]]){
  const r=await fetch(url,{method:'POST',headers:{Origin:value,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,status);
 }
});
test('历史双榜预检、备份、重复导入、冲突与无效数据保护',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'yuanbai-import-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'school.sqlite');const {DB}=createLeaderboardServer({database:file});DB.sqlite.close();
 const row={sourceId:'old-1',nickname:'历史玩家',deaths:2,durationMs:123456,steps:99,completedAt:1700000000000};
 const input={format:'yuanbai-history-v1',ruleVersion:globalThis.YuanbaiCore.RULE_VERSION,records:[{...row,board:'best'},{...row,board:'deaths'}]};
 assert.equal((await importHistory(file,input)).wouldAdd,2);
 let result=await importHistory(file,input,{apply:true});assert.equal(result.added,2);assert.ok(result.backup);
 const backup=new DatabaseSync(result.backup,{readOnly:true});assert.equal(backup.prepare('SELECT COUNT(*) n FROM scores').get().n,0);backup.close();
 assert.equal((await importHistory(file,input,{apply:true})).added,0);
 await assert.rejects(importHistory(file,{...input,records:[{...row,board:'best',steps:100}]},{apply:true}),/冲突/);
 await assert.rejects(importHistory(file,{...input,records:[{...row,board:'best',steps:-1}]},{apply:true}),/steps/);
 const db=new DatabaseSync(file);assert.equal(db.prepare('SELECT COUNT(*) n FROM scores').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM death_scores').get().n,1);db.close();
});
