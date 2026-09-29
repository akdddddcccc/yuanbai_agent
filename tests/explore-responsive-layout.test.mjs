import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('explore keeps the return control in the masthead and compacts laptop HUD', async () => {
  const [html, css, game] = await Promise.all([
    readFile(new URL('../public/explore/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/explore/style.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/explore/game.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /<header class="masthead"><div class="masthead-start"><a class="back-to-portal"/);
  assert.doesNotMatch(html, /class="explore-return"/);
  assert.match(css, /min-width:901px\) and \(max-width:1500px\) and \(max-height:900px/);
  assert.match(css, /main\{grid-template-columns:minmax\(0,1fr\) clamp\(278px,22vw,326px\)\}/);
  assert.match(css, /\.tool\{height:96px/);
  assert.match(game, /\(bottom-top\)\/1\.5,280\)/);
});
