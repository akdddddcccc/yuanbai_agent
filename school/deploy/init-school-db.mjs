import {createRequire} from 'node:module';
import {mkdir,open,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
export async function initializeSchoolDatabase(target,sqliteModule){
  const filename=path.resolve(target);
  for(const suffix of ['','-wal','-shm']){
    try{await access(filename+suffix);}catch(error){if(error.code==='ENOENT')continue;throw error;}
    throw new Error('目标已存在，拒绝覆盖学校成绩：'+filename+suffix);
  }
  await mkdir(path.dirname(filename),{recursive:true});
  const file=await open(filename,'wx');await file.close();
  const {localDB}=require(sqliteModule);
  const db=localDB(filename);db.sqlite.close();return filename;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv[2]!=='--new-school-board')throw new Error('新建独立学校榜单：node deploy/init-school-db.mjs --new-school-board');
    const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
    console.log('已创建独立学校榜单：'+await initializeSchoolDatabase(path.join(base,'data/school-leaderboard.sqlite'),path.join(base,'services/leaderboard/sqlite.cjs')));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
