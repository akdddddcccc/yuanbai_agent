import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function disposeModel(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [].concat(object.material || [])) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(item => item.dispose());
  materials.forEach(item => item.dispose());
  textures.forEach(item => item.dispose());
}

export async function loadPreciseModel(makeParticles) {
  const { scene: source } = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/yuanbai-precise-v2.glb`);
  const building = new THREE.Group();
  const bounds = new THREE.Box3().setFromObject(source);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 11.5 / Math.max(size.x, size.z);
  // Bake only a uniform unit conversion and translation; original geometry is retained in the source GLB.
  source.traverse(object => {
    if (!object.isMesh) return;
    object.geometry.translate(-center.x, -bounds.min.y, -center.z);
    object.geometry.scale(scale, scale, scale);
    object.castShadow = true;
    object.receiveShadow = true;
  });
  const blocks = [], windowMaterials = new Set();
  for (const child of [...source.children]) {
    building.add(child);
    if (!child.name.startsWith('YB_mass_')) continue;
    const pivot = new THREE.Box3().setFromObject(child).getCenter(new THREE.Vector3());
    child.children.forEach(mesh => mesh.position.sub(pivot));
    child.position.copy(pivot);
    child.userData = {
      home: pivot.clone(), baseRotation: 0, phase: blocks.length * .73,
      axis: new THREE.Vector3(pivot.x, .25, pivot.z).normalize(), impulse: 0,
    };
    blocks.push(child);
  }
  building.traverse(object => {
    for (const material of [].concat(object.material || [])) {
      if (/GLASS/.test(material.name)) {
        material.emissive.set('#ff9c55');
        windowMaterials.add(material);
      }
    }
  });
  building.name = 'Yuanbai_Precise_V2';
  building.rotation.y = -.12;
  building.position.z = .15;
  const particles = makeParticles(building, true);
  return { building, blocks, stairs: [], windowMaterials: [...windowMaterials], ...particles };
}
