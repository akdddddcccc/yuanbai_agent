import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parseAst } from 'rollup/parseAst';

const assets = new URL('../../dist-school/public/assets/', import.meta.url);

test('entry page and lazy chunks use one URL for the React runtime', async () => {
  const scripts = (await readdir(assets)).filter(name => name.endsWith('.js'));
  const imports = new Map();
  for (const name of scripts) {
    const ast = parseAst(await readFile(new URL(name, assets), 'utf8'));
    imports.set(name, ast.body.filter(node => node.source).map(node => node.source.value));
  }
  for (const entry of ['index.html', 'explore/index.html', 'dialogue/index.html']) {
    const html = await readFile(new URL('../../dist-school/public/' + entry, import.meta.url), 'utf8');
    const src = html.match(/<script\b[^>]*\bsrc="([^"]+)"/)[1];
    const entryUrl = new URL(src, 'https://example.test/yuanbai/');
    const name = entryUrl.pathname.split('/').at(-1);
    // The lazy visual imports React from the entry bundle. Any HTML-only query
    // creates a second module instance, including a second createRoot call.
    const backImports = [...imports.values()].flat().filter(value => value.split('/').at(-1).split('?')[0] === name);
    assert.ok(backImports.length > 0, 'Regression fixture must exercise an entry back-import');
    for (const dependency of backImports) {
      const importedUrl = new URL(dependency, 'https://example.test/yuanbai/assets/lazy.js');
      assert.equal(entryUrl.href, importedUrl.href, entry + ' loads two identities of the React runtime');
    }
  }
});
