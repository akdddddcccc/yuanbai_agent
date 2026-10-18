import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';
import * as THREE from 'three';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

async function loadModule(file, dependencies, extra = {}) {
  const { code } = await transform(await readFile(new URL(file, import.meta.url), 'utf8'), {
    format: 'cjs', loader: file.endsWith('.jsx') ? 'jsx' : 'js', jsx: 'automatic',
    define: { 'import.meta.env.BASE_URL': '"/yuanbai/"' },
  });
  const context = vm.createContext({ module: { exports: {} }, console, URLSearchParams,
    require: name => dependencies[name] || {}, ...extra });
  vm.runInContext(code, context);
  return context.module.exports;
}

for (const [file, exported] of [['../src/YuanbaiScene.js', 'YuanbaiScene'], ['../src/PortalSculpture.js', 'PortalSculpture']]) {
  test(`${exported}: unavailable WebGL becomes a local scene failure`, async () => {
    const failure = new Error('WebGL context unavailable');
    const states = [], effects = [];
    let stateIndex = 0, refIndex = 0;
    const mount = { dataset: {}, appendChild() { assert.fail('No canvas should be attached'); } };
    const hooks = {
      createElement: (...args) => args,
      useRef: initial => ({ current: refIndex++ === 0 ? mount : initial }),
      useState: initial => { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; },
      useEffect: effect => effects.push(effect),
    };
    const module = await loadModule(file, {
      react: hooks,
      three: { ...THREE, WebGLRenderer: class { constructor() { throw failure; } } },
    }, { window: { matchMedia: () => ({ matches: true }) } });
    const props = { phase: 'idle', level: 0, projectionRef: { current: null } };
    module[exported](props);
    assert.equal(effects.length, 1);
    assert.doesNotThrow(() => effects[0]());
    assert.ok(states.includes(failure), 'Pass the error to the local boundary on the next render');
    stateIndex = 0; refIndex = 0;
    assert.throws(() => module[exported](props), error => error === failure);
  });
}

test('simple mode never initializes the lazy scene and keeps sibling controls', async () => {
  const runtime = await import('react/jsx-runtime');
  const { SceneBoundary } = await loadModule('../src/SceneBoundary.jsx', { react: React, 'react/jsx-runtime': runtime }, { location: { search: '?view=lite' } });
  let loaded = false;
  const Scene = React.lazy(() => { loaded = true; throw new Error('Should not load 3D'); });
  const html = renderToStaticMarkup(React.createElement('main', null,
    React.createElement(SceneBoundary, null, React.createElement(Scene)),
    React.createElement('input', { name: 'question' }), React.createElement('button', null, 'Send')));
  assert.equal(loaded, false);
  assert.match(html, /scene-fallback/);
  assert.match(html, /name="question"/);
  assert.match(html, /Send/);
});
