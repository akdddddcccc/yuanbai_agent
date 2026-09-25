import '../../../public/explore/core.js';
const {Game,CLIFFS,SAFE_COUNT,id}=globalThis.YuanbaiCore;
function route(g,target){
  const q=[{i:g.position,path:[]}],seen=new Set([g.position]);
  while(q.length){
    const a=q.shift();if(a.i===target)return a.path;
    for(const p of g.neighbors(Math.floor(a.i/9),a.i%9)){
      const i=id(p.r,p.c);
      if(!CLIFFS.includes(i)&&!seen.has(i)){seen.add(i);q.push({i,path:[...a.path,p.direction]});}
    }
  }
  return null;
}
export function solve(fallFirst=false){
  const g=new Game(),actions=[];
  function move(d){const result=g.move(d);actions.push('m'+d);if(result.kind==='fall'){g.respawn();actions.push('respawn');}}
  if(fallFirst)[0,0,1,1].forEach(move);
  while(g.mode!=='won'){
    const next=Array.from({length:81},(_,i)=>i).filter(i=>!CLIFFS.includes(i)&&!g.safeVisited.has(i)).map(i=>({i,path:route(g,i)})).sort((a,b)=>a.path.length-b.path.length)[0];
    if(!next)throw Error('No target');for(const d of next.path)move(d);
  }
  if(g.count!==SAFE_COUNT)throw Error('Incomplete safe exploration');
  return {game:g,actions};
}
