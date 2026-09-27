import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function load(file) {
  const context={module:{exports:{}}};
  vm.runInNewContext(readFileSync(new URL(file,import.meta.url),'utf8'),context);
  return context.module.exports;
}
const {Warmup}=load('../public/explore/warmup.js');
const {Game,SIZE,SAFE_COUNT,RULE_VERSION}=load('../public/explore/core.js');
const cells=g=>[...g.visibleCells()].sort((a,b)=>a-b);

test('starting view has only the starting tile and one tile directly ahead',()=>{
  const g=new Warmup();
  assert.deepEqual(cells(g),[3,6]);
  assert.equal(g.visited.size,1);
  assert.equal(g.complete,false);
});

test('turning hides unvisited old views but keeps the entire walked trail',()=>{
  const g=new Warmup();
  g.turn(1);
  assert.deepEqual(cells(g),[6,7]);
  assert.equal(g.visited.size,1);
  g.move(1); g.move(0); g.turn(-1);
  assert.deepEqual(cells(g),[3,4,6,7]);
  g.turn(-1);
  assert.deepEqual(cells(g),[4,6,7]);
});

test('boundaries never reveal off-board tiles or increase progress',()=>{
  const g=new Warmup();
  assert.equal(g.move(2),'edge');
  assert.deepEqual(cells(g),[6]);
  assert.equal(g.move(3),'edge');
  assert.equal(g.visited.size,1);
  assert.equal(g.r,2); assert.equal(g.c,0);
  for(const direction of [-1,4,NaN,1.5]) assert.equal(g.move(direction),'invalid');
});

test('every reachable position and facing reveals exactly trail plus in-bounds forward tile',()=>{
  const dirs=[[-1,0],[0,1],[1,0],[0,-1]];
  for(let r=0;r<3;r++) for(let c=0;c<3;c++) for(let facing=0;facing<4;facing++) {
    const g=new Warmup();
    for(let i=2;i>r;i--) g.move(0);
    for(let i=0;i<c;i++) g.move(1);
    while(g.direction!==facing) g.turn(1);
    const expected=new Set(g.visited),nr=r+dirs[facing][0],nc=c+dirs[facing][1];
    if(nr>=0 && nr<3 && nc>=0 && nc<3) expected.add(nr*3+nc);
    assert.deepEqual(cells(g),[...expected].sort((a,b)=>a-b));
  }
});

test('only visiting all nine cells completes; replay starts fresh',()=>{
  const g=new Warmup();
  for(const direction of [0,2,0,2]) g.move(direction);
  assert.equal(g.visited.size,2);
  assert.equal(g.complete,false);
  g.reset();
  for(const direction of [0,0,1,1,2,3,2,1]) g.move(direction);
  assert.equal(g.complete,true);
  assert.equal(g.visited.size,9);
  const before=[g.r,g.c,g.direction];
  assert.equal(g.turn(1),false);
  assert.equal(g.move(0),'complete');
  assert.deepEqual([g.r,g.c,g.direction],before);
  g.reset();
  assert.equal(g.complete,false);
  assert.deepEqual(cells(g),[3,6]);
});

test('warmup does not alter formal rules, progress, SAN, inventory or replay state',()=>{
  const formal=new Game();
  const snapshot=()=>JSON.stringify(formal,(_,value)=>Object.prototype.toString.call(value)==='[object Set]'?[...value]:value);
  const before=snapshot();
  const g=new Warmup();
  for(const direction of [0,0,1,1,2,3,2,1]) g.move(direction);
  assert.equal(snapshot(),before);
  assert.equal(formal.count,1);
  assert.equal(formal.san,0);
  assert.equal(formal.totalSteps,0);
  assert.equal(SIZE,9); assert.equal(SAFE_COUNT,66); assert.equal(RULE_VERSION,'yuanbai-v5-san');
});
