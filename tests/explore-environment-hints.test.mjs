import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/explore/game.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('  function syncNearbyHint()'),source.indexOf('  function updateUI()'));
function harness(){
  const calls=[],ui={'nearby-status':{},'stage-note':{},'center-toast':{classList:{remove(){calls.push('clear');}}}};
  const s=vm.createContext({nearbyPosition:null,toastKind:'',toastUntil:0,game:{mode:'playing',position:63,near:false,environment(){return this.near?{near:true}:null;}},falling:null,winning:null,overview:null,ui,canvas:{dataset:{}},NEARBY_TEXT:'附近似乎不太对劲',toast(t,d,k){calls.push(t);s.toastKind=k;},tone(){},vibrate(){},performance:{now:()=>100},echoCue:null});
  vm.runInContext(fn,s);return {s,calls,ui};
}
test('every new nearby tile triggers both cues; turning and refresh do not retrigger',()=>{
  const {s,calls,ui}=harness();s.syncNearbyHint();assert.equal(ui['nearby-status'].hidden,true);
  s.game.near=true;s.syncNearbyHint();assert.equal(ui['nearby-status'].hidden,false);assert.equal(ui['stage-note'].hidden,true);assert.equal(calls.length,1);
  s.syncNearbyHint();assert.equal(calls.length,1);
  s.game.position=64;s.syncNearbyHint();assert.equal(calls.length,2);
  s.game.near=false;s.syncNearbyHint();assert.equal(ui['nearby-status'].hidden,true);assert.equal(calls.at(-1),'clear');assert.equal(s.nearbyPosition,null);
});
test('nearby pickup does not suppress warning; overlays do not replay it on exit',()=>{
  const {s,calls}=harness();s.game.near=true;s.game.stock={probe:1};s.syncNearbyHint();assert.equal(calls.length,1);
  s.overview={};s.syncNearbyHint();assert.equal(s.ui['nearby-status'].hidden,true);s.overview=null;s.syncNearbyHint();assert.equal(s.ui['nearby-status'].hidden,false);assert.equal(calls.filter(x=>x!=='clear').length,1);
});
test('leaving danger clears only its own toast; fall and win clear both proximity cues',()=>{
  const {s,calls}=harness();s.game.near=true;s.syncNearbyHint();s.toastKind='';s.game.near=false;s.syncNearbyHint();assert.equal(calls.length,1);
  s.game.near=true;s.syncNearbyHint();s.falling={};s.syncNearbyHint();assert.equal(s.ui['nearby-status'].hidden,true);assert.equal(s.nearbyPosition,null);
  s.falling=null;s.game.mode='won';s.syncNearbyHint();assert.equal(s.canvas.dataset.nearbyDanger,'false');
});
