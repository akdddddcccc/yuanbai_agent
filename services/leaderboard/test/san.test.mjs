import test from 'node:test';
import assert from 'node:assert/strict';
import '../../../public/explore/core.js';

const {Game,RULE_VERSION,SAN_PER_SECOND,SAN_PICKUP,SAN_FALL,SAN_OVERLOAD_MS,SAN_RECOVER_TO}=globalThis.YuanbaiCore;

test('SAN 增长节奏与满值后的自动恢复',()=>{
  assert.equal(RULE_VERSION,'yuanbai-v6-san-balance');
  assert.equal(SAN_PER_SECOND,.2);
  const game=new Game();
  game.advanceTime(8*60*1000);
  assert(Math.abs(game.san-96)<1e-6);
  assert.equal(game.restrictedVision,false);
  game.advanceTime(20*1000);
  assert.equal(game.san,100);
  assert.equal(game.visibleCells().length,1);
  game.advanceTime(SAN_OVERLOAD_MS-1);
  assert.equal(game.restrictedVision,true);
  game.advanceTime(1);
  assert.equal(game.san,SAN_RECOVER_TO);
  assert.equal(game.restrictedVision,false);
  assert(game.visibleCells().length>1);
  assert(game.effectLevel<1);
});

test('拾取可提前解除迷失，坠落加压不破坏倒计时',()=>{
  assert.equal(SAN_PICKUP,8);
  assert.equal(SAN_FALL,8);
  const game=new Game();
  game.changeSan(100);
  game.advanceTime(1500);
  const pickup=game.move(0);
  assert.equal(pickup.pickup.type,'companion');
  assert.equal(game.san,92);
  assert.equal(game.restrictedVision,false);
  assert.equal(game.overloadMs,0);
  game.move(0);game.move(1);
  const before=game.san,fall=game.move(1);
  assert.equal(fall.kind,'fall');
  assert.equal(game.san,before+SAN_FALL);
  game.advanceTime(1000);
  assert.equal(game.mode,'falling');
  assert.equal(game.san,before+SAN_FALL+SAN_PER_SECOND);
});

test('大段计时仍会跨越满值与恢复，通关后停止增长',()=>{
  const game=new Game();
  game.advanceTime(8*60*1000+20*1000+SAN_OVERLOAD_MS+1000);
  assert(Math.abs(game.san-(SAN_RECOVER_TO+.2))<1e-6);
  game.mode='won';game.advanceTime(1000);
  assert(Math.abs(game.san-(SAN_RECOVER_TO+.2))<1e-6);
});
