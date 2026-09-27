import '../../../public/explore/core.js';
const {Game,SAFE_COUNT,id}=globalThis.YuanbaiCore;
function route(g,target){
  const q=[{i:g.position,path:[]}],seen=new Set([g.position]);
  while(q.length){
    const a=q.shift();if(a.i===target)return a.path;
    for(const p of g.neighbors(Math.floor(a.i/9),a.i%9)){
      const i=id(p.r,p.c);
      if(!g.cliffs.includes(i)&&!seen.has(i)){seen.add(i);q.push({i,path:[...a.path,p.direction]});}
    }
  }
  return null;
}
export function solve(fallFirst=false,seed=null){
  const g=new Game(seed),actions=[];
  function move(d){const result=g.move(d);actions.push('m'+d);if(result.kind==='fall'){g.respawn();actions.push('respawn');}}
  for(let n=0;n<(fallFirst===true?1:Number(fallFirst)||0);n++){
    const cliff=g.cliffs.find(index=>g.neighbors(Math.floor(index/9),index%9).some(p=>!g.isCliff(p.r,p.c))),adjacent=g.neighbors(Math.floor(cliff/9),cliff%9).find(p=>!g.isCliff(p.r,p.c));
    for(const d of route(g,id(adjacent.r,adjacent.c)))move(d);
    move(g.neighbors().find(p=>id(p.r,p.c)===cliff).direction);
  }
  while(g.mode!=='won'){
    const next=Array.from({length:81},(_,i)=>i).filter(i=>!g.cliffs.includes(i)&&!g.safeVisited.has(i)).map(i=>({i,path:route(g,i)})).sort((a,b)=>a.path.length-b.path.length)[0];
    if(!next)throw Error('No target');for(const d of next.path)move(d);
  }
  if(g.count!==SAFE_COUNT)throw Error('Incomplete safe exploration');
  return {game:g,actions};
}
