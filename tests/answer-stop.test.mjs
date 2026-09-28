import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('stop answer aborts generation, stops playback and releases the queue slot',async()=>{
  const [app,style]=await Promise.all([
    readFile(new URL('../src/App.jsx',import.meta.url),'utf8'),
    readFile(new URL('../src/styles.css',import.meta.url),'utf8')
  ]);
  assert.match(app,/requestController = new AbortController\(\)/);
  assert.match(app,/signal: requestController\.signal/);
  assert.match(app,/const stopAnswer = useCallback\(\(\) => \{[\s\S]*requestAbortRef\.current\?\.abort\(\)[\s\S]*responseRef\.current\?\.pause\(\)[\s\S]*releaseQueueTicket\(\)/);
  assert.match(app,/phase === "thinking" \|\| phase === "speaking"/);
  assert.match(app,/停止元白回答并释放排队名额/);
  assert.match(style,/\.answer-stop/);
});
