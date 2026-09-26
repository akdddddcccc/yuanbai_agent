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
    if (['YB_connector_YB_ROUTE_SOUTH_03_04', 'YB_connector_YB_ROUTE_EAST_09_10'].includes(object.parent?.name)) return;
    if (object.isMesh) probes.push({ object, expected: new THREE.Vector3().fromBufferAttribute(object.geometry.attributes.position, 0)
      .sub(new THREE.Vector3(rawCenter.x, rawBounds.min.y, rawCenter.z)).multiplyScalar(scale) });
  });
  const model = preparePreciseModel(scene, () => ({}));
  assert.equal(model.blocks.length, 15);
  assert.equal(model.bindings.length, 19);
  for (const name of ['YB_connector_YB_ROUTE_SOUTH_03_04', 'YB_connector_YB_ROUTE_EAST_09_10']) {
    assert.equal(model.building.getObjectByName(name), undefined, 'intersecting stair must be removed');
  }
  const core = model.building.getObjectByName('YB_mass_A08');
  assert.deepEqual(core.userData.axis.toArray(), [0, 1, 0]);
  assert.equal(model.building.getObjectByName('YB_stable_stairs_and_bridges').parent, core);
  for (const id of ['A04', 'A10']) {
    assert.equal(model.building.getObjectByName(`YB_connector_YB_EXT_STAIR_${id}`).parent.name, `YB_mass_${id}`);
  }
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
  // Speech displacement and its return keep the entire central assembly together.
  const stable = model.building.getObjectByName('YB_stable_stairs_and_bridges');
  const rest = stable.position.clone();
  const home = core.userData.home;
  for (const amount of [0, .25, .8, .3, 0]) {
    core.position.copy(home).addScaledVector(core.userData.axis, amount);
    model.building.updateMatrixWorld(true);
    assert.equal(core.position.x, home.x);
    assert.equal(core.position.z, home.z);
    const expected = core.localToWorld(rest.clone());
    assert.ok(stable.getWorldPosition(new THREE.Vector3()).distanceTo(expected) < 1e-6);
  }
  model.coreLight.update(1, 1, 1);
  assert.ok(model.coreLight.light.intensity > 10);
  model.coreLight.update(2, 0, 0);
  assert.equal(model.coreLight.light.intensity, 0);
  assert.equal(model.coreLight.beam.visible, false);
  disposeModel(model.building);
});
