import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/explore/game.js', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const catCode = section('  const CAT_FRAMES=', '  function drawProbeCat(');
function catHarness(fail = false) {
  const calls = [], state = { saves: 0, restores: 0 };
  const ctx = {save(){state.saves++;}, restore(){state.restores++;}, translate(){}, scale(){}, rotate(){}, drawImage(...args){if(fail)throw Error('decode failed');calls.push(args);}};
  const scope = vm.createContext({ctx, console:{warn(){}}, catAtlas:{}, catAtlasReady:true, catAtlasFailed:false, reduced:false, clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
  vm.runInContext(catCode, scope);
  return {scope,calls,state};
}
test('probe first frame handles RAF timestamps before the tap, including non-finite age', () => {
  const {scope,calls,state} = catHarness();
  for (const age of [-33,-8,-.01,0,65,66,329,330,869,870,1070,1700,NaN,Infinity]) {
    scope.drawCat(100,100,180,0,age,1,0,false,.5,200);
  }
  assert.equal(calls.length,14);
  assert.equal(calls[0][1],574); // walk0 rather than nonexistent walk-1
  assert.equal(state.saves,state.restores);
  for (const args of calls) assert.ok(args.slice(1).every(Number.isFinite));
});
test('sprite draw failure restores canvas state and falls back instead of killing RAF', () => {
  const {scope,state}=catHarness(true);
  assert.doesNotThrow(()=>scope.drawCat(100,100,180,0,100,1));
  assert.equal(scope.catAtlasFailed,true);
  assert.equal(scope.catAtlasReady,false);
  assert.equal(state.saves,state.restores);
  scope.drawCat(100,100,180,0,200,1);
  assert.equal(state.saves,1); // do not keep trying the failing texture
});
test('failed optional audio still reveals target and releases the tool lock', () => {
  let updates=0,stops=0;
  const fx={type:'probe',start:100,soundAt:470,revealAt:1630,duration:2550,sounded:false,revealed:false,r:8,c:0,result:{targets:[{r:7,c:0}]}};
  const scope=vm.createContext({toolFx:fx,playToolVoice(){throw Error('audio interrupted');},stopToolVoice(){stops++;},console:{warn(){}},say(){},sweep:null,game:{direction:0},DIRS:[{name:'东北'}],canvas:{dataset:{toolEffect:'probe'}},updateUI(){updates++;}});
  vm.runInContext(section('  function updateToolFx(', '  function toolRevealedCells('),scope);
  scope.updateToolFx(92);assert.equal(fx.sounded,false);
  scope.updateToolFx(600);assert.equal(stops,1);
  scope.updateToolFx(1800);assert.equal(fx.revealed,true);assert.equal(scope.sweep.target.r,7);
  scope.updateToolFx(2700);assert.equal(scope.toolFx,null);assert.equal(updates,1);assert.equal(scope.canvas.dataset.toolEffect,undefined);
});
