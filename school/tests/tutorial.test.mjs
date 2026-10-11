import test from 'node:test';
import assert from 'node:assert/strict';
import {Tutorial,CLIFFS,index} from '../tutorial/model.js';

test('教学从移动和拾取开始，三种工具与转向都完成后才可毕业',()=>{
  const game=new Tutorial();assert.equal(game.complete,false);
  assert.equal(game.act('1').kind,'empty');assert.equal(game.used.size,0);
  assert.equal(game.act('w',100).pickup.type,'companion');
  game.act('1',200);assert(game.inspected.has(index(3,1)));assert(CLIFFS.has(index(3,1)));
  assert.equal(game.act('w',300).pickup.type,'probe');
  const before={r:game.r,c:game.c};game.act('e',400);assert.deepEqual({r:game.r,c:game.c},before);
  const probe=game.act('2',500);assert.deepEqual(probe.targets,[{r:2,c:2}]);
  assert.deepEqual({r:game.r,c:game.c},before,'探测不传送玩家');assert(!game.visited.has(index(2,2)));
  assert.equal(game.act('w',600).pickup.type,'panorama');
  game.act('3',700);assert.equal(game.complete,true);assert.equal(game.progress,5);
  assert.equal(game.visible(4,4,800),true);assert.equal(game.act('d',1000).kind,'busy');
  assert.equal(game.visible(4,4,2201),false);assert.equal(game.act('w',2300).kind,'move');
});
test('探测边界不扣除练习机会；坠落保留已拾取工具与教学进度',()=>{
  const g=new Tutorial();g.act('w');g.act('1');g.act('w');g.act('q');
  assert.equal(g.act('2').kind,'no-target');assert(!g.used.has('probe'));
  g.act('q');g.act('q');g.act('2');assert(g.used.has('probe'));
  assert.equal(g.act('d').kind,'fall');assert.deepEqual([g.r,g.c],[4,0]);
  assert(g.collected.has('companion'));assert(g.used.has('probe'));assert.equal(g.act('1').kind,'tool');
  g.reset();assert.equal(g.progress,0);assert.equal(g.collected.size,0);assert.equal(g.panoramaUntil,0);
});
test('教学没有只靠移动或重复同一工具就完成的捷径',()=>{
  const g=new Tutorial();for(const key of ['w','1','1','1','e','w','2'])g.act(key);
  assert.equal(g.complete,false);assert.equal(g.progress,4);
  assert.equal(g.act('3').kind,'empty');assert.equal(g.progress,4);
});
