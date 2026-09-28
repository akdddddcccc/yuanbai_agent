import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const publicRoot=new URL('../../../public/explore/',import.meta.url);

test('cliff proximity has a persistent status independent from transient messages',async()=>{
  const [html,game,style]=await Promise.all([
    readFile(new URL('index.html',publicRoot),'utf8'),
    readFile(new URL('game.js',publicRoot),'utf8'),
    readFile(new URL('style.css',publicRoot),'utf8')
  ]);
  assert.match(html,/id="nearby-status"[^>]*role="status"[^>]*aria-live="polite"[^>]*hidden/);
  assert.match(game,/const nearby=game\.mode==='playing'&&!!game\.environment\(\)&&!falling&&!winning&&!overview/);
  assert.match(game,/ui\['nearby-status'\]\.hidden=!nearby/);
  assert.match(game,/canvas\.dataset\.nearbyDanger=String\(nearby\)/);
  assert.match(style,/\.nearby-status\{position:absolute/);
});
