import {DatabaseSync,backup} from 'node:sqlite';
import {open,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// Read-only inspection: never run application migrations on the source database.
export function inspectDatabase(filename){
  const db=new DatabaseSync(filename,{readOnly:true});
  try{
    const integrity=db.prepare('PRAGMA integrity_check').all();
    if(integrity.length!==1||integrity[0].integrity_check!=='ok')throw new Error('数据库完整性检查失败');
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('数据库外键检查失败');
    const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
    for(const required of ['runs','scores','_local_migrations'])if(!tables.includes(required))throw new Error('不是完整的排行榜数据库：缺少 '+required);
    return {tables:Object.fromEntries(tables.map(name=>[name,db.prepare('SELECT COUNT(*) AS n FROM "'+name.replaceAll('"','""')+'"').get().n])),migrations:db.prepare('SELECT name FROM _local_migrations ORDER BY name').all().map(r=>r.name)};
  }finally{db.close();}
}

export async function exportDatabase(source,destination){
  source=path.resolve(source);destination=path.resolve(destination);
  if(source.toLowerCase()===destination.toLowerCase())throw new Error('备份目标不能是源数据库');
  inspectDatabase(source);
  await mkdir(path.dirname(destination),{recursive:true});
  // Reserve a new filename exclusively; never overwrite an earlier snapshot.
  const reserved=await open(destination,'wx');await reserved.close();
  let db;
  try{
    db=new DatabaseSync(source,{readOnly:true});
    await backup(db,destination);
    const report=inspectDatabase(destination);
    const sha256=createHash('sha256').update(await readFile(destination)).digest('hex');
    const manifest={format:'yuanbai-sqlite-backup-v1',createdAt:new Date().toISOString(),sha256,...report};
    await writeFile(destination+'.manifest.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
    return manifest;
  }catch(error){await rm(destination,{force:true});throw error;}
  finally{db?.close();}
}

export async function restoreDatabase(snapshot,destination){
  snapshot=path.resolve(snapshot);destination=path.resolve(destination);
  const manifest=JSON.parse(await readFile(snapshot+'.manifest.json','utf8'));
  const bytes=await readFile(snapshot);
  if(manifest.format!=='yuanbai-sqlite-backup-v1'||createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw new Error('备份校验失败，请重新传输数据库与 manifest');
  const report=inspectDatabase(snapshot);
  if(JSON.stringify(report.tables)!==JSON.stringify(manifest.tables)||JSON.stringify(report.migrations)!==JSON.stringify(manifest.migrations))throw new Error('数据库记录数或迁移记录与清单不符');
  await mkdir(path.dirname(destination),{recursive:true});
  for(const sidecar of [destination+'-wal',destination+'-shm']){
    try{await readFile(sidecar);throw new Error('目标目录含 SQLite 活动文件，不能覆盖');}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  // Exclusive write refuses an existing database, including an empty one.
  await writeFile(destination,bytes,{flag:'wx'});
  return report;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  const [command,source,destination]=process.argv.slice(2);
  try{
    if(!source||!['inspect','export','restore'].includes(command)||(command!=='inspect'&&!destination))throw new Error('用法：node database-transfer.mjs inspect 文件 | export 源库 新备份 | restore 备份 新库');
    console.log(JSON.stringify(command==='inspect'?inspectDatabase(source):await (command==='export'?exportDatabase:restoreDatabase)(source,destination),null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
