import test from 'node:test';
import assert from 'node:assert/strict';
import { usePersonalPortal } from '../src/personalPortalDomain.js';

test('only the confirmed personal hostname enables the production revision', () => {
  assert.equal(usePersonalPortal('apps-demo.muyang23333.top'), true);
  for (const host of ['academy.example.edu.cn', '172.31.7.63', 'muyang23333.top', 'apps-demo.muyang23333.top.example.com', 'localhost', '127.0.0.1', '']) {
    assert.equal(usePersonalPortal(host), false, host);
  }
});
test('development preview remains restricted to loopback hosts', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) assert.equal(usePersonalPortal(host, true), true);
  assert.equal(usePersonalPortal('academy.example.edu.cn', true), false);
  assert.equal(usePersonalPortal('172.31.7.63', true), false);
});
