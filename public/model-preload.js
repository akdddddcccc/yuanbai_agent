// Shared by the landing page, static exploration page, and dialogue loader.
export function createModelPreloader({ base, fetcher = fetch, storage = globalThis.caches } = {}) {
  let pending;
  const load = async () => {
    const cache = await storage?.open('yuanbai-precise-v3').catch(() => null);
    async function read(name, expectedBytes) {
      const url = new URL(name, base).href;
      let response = await cache?.match(url).catch(() => null);
      if (!response) response = await fetcher(url);
      if (!response.ok) throw new Error(`Model unavailable: ${name}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (expectedBytes !== undefined && bytes.length !== expectedBytes) {
        await cache?.delete(url).catch(() => {});
        throw new Error(`Incomplete model: ${name}`);
      }
      await cache?.put(url, new Response(bytes)).catch(() => {});
      return bytes;
    }
    const manifest = JSON.parse(new TextDecoder().decode(await read('manifest.json')));
    const chunks = new Array(manifest.parts.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(6, chunks.length) }, async () => {
      while (next < chunks.length) {
        const index = next++;
        const part = manifest.parts[index];
        chunks[index] = await read(part.name, part.bytes);
      }
    }));
    const bytes = new Uint8Array(manifest.bytes);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (offset !== manifest.bytes) throw new Error('Incomplete model');
    return bytes;
  };
  return () => pending ??= load().catch(error => { pending = null; throw error; });
}

export const preloadPreciseModel = createModelPreloader({ base: new URL('models/yuanbai-precise-v3/', import.meta.url) });
if (typeof document !== 'undefined') preloadPreciseModel().catch(() => {});
