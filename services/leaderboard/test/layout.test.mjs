import test from 'node:test';
import assert from 'node:assert/strict';
import '../../../public/explore/core.js';
import {solve} from './solver.mjs';
const {Game,generateLayout,validateLayout,replay,id,SAFE_COUNT,CLIFFS}=globalThis.YuanbaiCore;

test('2000 seeded maps are connected, keep a safe start and preserve pickup counts',()=>{
  const maps=new Set();
  for(let seed=0;seed<2000;seed++){
    const g=new Game(String(seed));maps.add(JSON.stringify(g.cliffs));
    assert.equal(g.cliffs.length,15);assert.equal(new Set(g.cliffs).size,15);
    assert(!g.isCliff(8,0));assert(!g.isCliff(7,0));assert(!g.isCliff(8,1));
    const queue=[g.position],seen=new Set(queue);
    for(let i=0;i<queue.length;i++)for(const p of g.neighbors(Math.floor(queue[i]/9),queue[i]%9)){
      const index=id(p.r,p.c);if(!g.cliffs.includes(index)&&!seen.has(index)){seen.add(index);queue.push(index);}
    }
    assert.equal(seen.size,SAFE_COUNT);
    assert.equal(new Set(g.pickups.map(p=>p.index)).size,12);
    assert(g.pickups.every(p=>seen.has(p.index)&&p.index!==g.position));
    assert.deepEqual(['companion','probe','panorama'].map(type=>g.pickups.filter(p=>p.type===type).length),[5,4,3]);
    assert(g.neighbors().some(p=>g.pickupAt(id(p.r,p.c))?.type==='companion'));
    const checked=validateLayout({cliffs:g.cliffs,pickups:g.pickups});
    for(const index of seen){
      g.r=Math.floor(index/9);g.c=index%9;
      const expected=g.neighbors().some(p=>g.isCliff(p.r,p.c));
      assert.equal(!!g.environment(),expected,`seed ${seed}, cell ${index} should report nearby danger`);
      assert.equal(checked.dangerSignals.includes(index),expected);
    }
  }
  assert.equal(maps.size,2000);
});

test('same seed reproduces map; respawn keeps it; a new seed changes it',()=>{
  const a=new Game('run-a'),b=new Game('run-a');
  assert.deepEqual(a.cliffs,b.cliffs);assert.deepEqual(a.pickups,b.pickups);
  const original=JSON.stringify([a.cliffs,a.pickups]);a.mode='falling';a.respawn();
  assert.equal(JSON.stringify([a.cliffs,a.pickups]),original);
  a.reset('run-b');assert.notEqual(JSON.stringify([a.cliffs,a.pickups]),original);
  assert.deepEqual(new Game().cliffs,CLIFFS);
  assert.deepEqual(generateLayout('run-a').cliffs,b.cliffs);
});

test('random maps can be completed and replayed with their original seed',()=>{
  for(let i=0;i<30;i++){
    const seed=`replay-${i}`,result=solve(i%2,seed);
    const verified=replay(result.actions,seed);
    assert.equal(verified.count,SAFE_COUNT);assert.equal(verified.falls,i%2);
  }
});
