import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { preparePreciseModel, disposeModel } from '../src/preciseModel.js';

test('chunk delivery reconstructs the exact GLB', async () => {
  const base = new URL('../public/models/yuanbai-precise-v3/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', base)));
  const parts = await Promise.all(manifest.parts.map(async part => {
    const bytes = await readFile(new URL(part.name, base));
    assert.equal(bytes.length, part.bytes);
    return bytes;
  }));
  const full = Buffer.concat(parts);
  assert.equal(full.length, manifest.bytes);
  assert.deepEqual(full, await readFile(new URL('../public/models/yuanbai-precise-v2.glb', import.meta.url)));
});

test('stair binding preserves rest positions and follows full anchor transforms', async () => {
  const bytes = await readFile(new URL('../public/models/yuanbai-precise-v2.glb', import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const rawBounds = new THREE.Box3().setFromObject(scene);
  const rawCenter = rawBounds.getCenter(new THREE.Vector3());
  const size = rawBounds.getSize(new THREE.Vector3());
  assert.ok(Math.max(size.x, size.z) < 150, '160-unit ground slab must be removed');
  const scale = 11.5 / Math.max(size.x, size.z);
  const probes = [];
  scene.traverse(object => {
    if (object.isMesh) probes.push({ object, expected: new THREE.Vector3().fromBufferAttribute(object.geometry.attributes.position, 0)
      .sub(new THREE.Vector3(rawCenter.x, rawBounds.min.y, rawCenter.z)).multiplyScalar(scale) });
  });
  const model = preparePreciseModel(scene, () => ({}));
  assert.equal(model.blocks.length, 15);
  assert.equal(model.bindings.length, 20);
  model.building.updateMatrixWorld(true);
  const inverse = model.building.matrixWorld.clone().invert();
  for (const { object, expected } of probes) {
    const actual = new THREE.Vector3().fromBufferAttribute(object.geometry.attributes.position, 0)
      .applyMatrix4(object.matrixWorld).applyMatrix4(inverse);
    assert.ok(actual.distanceTo(expected) < 1e-5, object.name + ' shifted during binding');
  }
  for (const binding of model.bindings) {
    const connector = model.building.getObjectByName(binding.connector);
    assert.equal(connector.parent.name, binding.anchor);
    const local = connector.matrix.clone();
    const before = connector.getWorldPosition(new THREE.Vector3());
    connector.parent.position.x += .2;
    connector.parent.rotation.y += .1;
    model.building.updateMatrixWorld(true);
    assert.ok(connector.getWorldPosition(new THREE.Vector3()).distanceTo(before) > .01);
    assert.ok(connector.matrix.equals(local), 'connector must retain its rigid local transform');
  }
  model.coreLight.update(1, 1, 1);
  assert.ok(model.coreLight.light.intensity > 10);
  model.coreLight.update(2, 0, 0);
  assert.equal(model.coreLight.light.intensity, 0);
  assert.equal(model.coreLight.beam.visible, false);
  disposeModel(model.building);
});
