// 服务器上的 SQLite，与游戏校验接口共享 prepared API。
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),path=require('node:path');
function localDB(filename=':memory:'){
  const sqlite=new DatabaseSync(filename);
  sqlite.exec('PRAGMA journal_mode=WAL');
  sqlite.exec('PRAGMA busy_timeout=5000');
  sqlite.exec('PRAGMA foreign_keys=ON');
  sqlite.exec('CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)');
  for(const name of fs.readdirSync(__dirname).filter(n=>/^\d+_.*\.sql$/.test(n)).sort()){
    if(!sqlite.prepare('SELECT name FROM _local_migrations WHERE name=?').get(name)){
      sqlite.exec('BEGIN IMMEDIATE');
      try{
        sqlite.exec(fs.readFileSync(path.join(__dirname,name),'utf8'));
        sqlite.prepare('INSERT INTO _local_migrations VALUES (?)').run(name);
        sqlite.exec('COMMIT');
      }catch(error){sqlite.exec('ROLLBACK');throw error;}
    }
  }
  return {sqlite,prepare(sql){const statement=sqlite.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args),success:true};},async run(){return {success:true,meta:statement.run(...args)};}};}};
}
module.exports={localDB};
