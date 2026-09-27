import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelPreloader } from '../public/model-preload.js';

const base = 'https://example.test/yuanbai/models/yuanbai-precise-v3/';
const manifest = { bytes: 4, parts: [{ name: 'part-00.bin', bytes: 2 }, { name: 'part-01.bin', bytes: 2 }] };
function memoryCache() {
  const items = new Map();
  return { open: async () => ({
    match: async key => items.get(key)?.clone(),
    put: async (key, value) => items.set(key, value.clone()),
    delete: async key => items.delete(key),
  }) };
}
test('landing preload and dialogue share one request and reuse cache across page navigation', async () => {
  let requests = 0;
  const storage = memoryCache();
  const fetcher = async url => {
    requests++;
    assert.ok(url.startsWith(base), 'retain deployed subdirectory');
    return new Response(url.endsWith('manifest.json') ? JSON.stringify(manifest)
      : new Uint8Array(url.endsWith('00.bin') ? [1, 2] : [3, 4]));
  };
  const preload = createModelPreloader({ base, fetcher, storage });
  const [first, second] = await Promise.all([preload(), preload()]);
  assert.equal(first, second);
  assert.deepEqual([...first], [1, 2, 3, 4]);
  assert.equal(requests, 3);
  const nextPage = createModelPreloader({ base, fetcher, storage });
  assert.deepEqual([...await nextPage()], [1, 2, 3, 4]);
  assert.equal(requests, 3, 'navigation must not redownload cached chunks');
});
test('failed downloads can retry and cache denial does not prevent loading', async () => {
  let fail = true;
  const preload = createModelPreloader({ base,
    storage: { open: async () => { throw new Error('Cache unavailable'); } },
    fetcher: async url => {
      if (fail) throw new Error('Offline');
      return new Response(url.endsWith('manifest.json') ? JSON.stringify(manifest) : new Uint8Array([1, 2]));
    },
  });
  await assert.rejects(preload(), /Offline/);
  fail = false;
  assert.equal((await preload()).length, 4);
});
