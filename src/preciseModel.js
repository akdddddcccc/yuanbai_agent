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

function tuneMaterial(material) {
  if (!material || material.userData?.ybTuned) return;
  material.userData.ybTuned = true;
  material.userData.ybBaseOpacity = material.opacity ?? 1;
  material.userData.ybBaseTransparent = Boolean(material.transparent);

  const name = String(material.name || "").toUpperCase();
  if (name.includes("CONCRETE") || name.includes("GRC")) {
    material.roughness = .92;
    material.metalness = 0;
  } else if (name.includes("BRICK") || name.includes("PAVING")) {
    material.roughness = .9;
    material.metalness = 0;
  } else if (name.includes("METAL")) {
    material.roughness = .58;
    material.metalness = .36;
  } else if (name.includes("WOOD")) {
    material.roughness = .78;
    material.metalness = 0;
  } else if (name.includes("GRASS")) {
    material.roughness = 1;
    material.metalness = 0;
  }

  if (name.includes("GLASS")) {
    material.transparent = true;
    material.depthWrite = false;
    material.opacity = name.includes("DARK") ? .46 : .34;
    material.userData.ybBaseOpacity = material.opacity;
    material.userData.ybBaseTransparent = true;
    material.roughness = name.includes("U_GLASS") ? .42 : .24;
    material.metalness = 0;
    if ("transmission" in material) material.transmission = name.includes("DARK") ? .1 : .28;
    if ("ior" in material) material.ior = 1.42;
    if (material.emissive) material.emissive.copy(new THREE.Color("#ff8b4a"));
    material.emissiveIntensity = .055;
  }
  material.needsUpdate = true;
}


export async function loadPreciseModel(makeParticles) {
  const base = `${import.meta.env.BASE_URL}models/yuanbai-precise-v3/`;
  const response = await fetch(`${base}manifest.json`);
  if (!response.ok) throw new Error('Model manifest unavailable');
  const manifest = await response.json();
  const chunks = await Promise.all(manifest.parts.map(async part => {
    const response = await fetch(base + part.name);
    if (!response.ok) throw new Error(`Model chunk unavailable: ${part.name}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== part.bytes) throw new Error('Incomplete model chunk');
    return bytes;
  }));
  const bytes = new Uint8Array(manifest.bytes);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  if (offset !== manifest.bytes) throw new Error('Incomplete model');
  const { scene: source } = await new GLTFLoader().parseAsync(bytes.buffer, base);
  return preparePreciseModel(source, makeParticles);
}

export function preparePreciseModel(source, makeParticles) {
  // These two stair flights run through the solid A03/A09 facades in the source model.
  // Remove their complete tread/stringer/railing groups before particle sampling.
  for (const name of ['YB_connector_YB_ROUTE_SOUTH_03_04', 'YB_connector_YB_ROUTE_EAST_09_10']) {
    const stair = source.getObjectByName(name);
    if (!stair) continue;
    stair.removeFromParent();
    stair.traverse(object => object.geometry?.dispose());
  }
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
      // 中央白楼只沿竖直方向随声音起伏，避免向画面左侧滑出。
      axis: child.name === 'YB_mass_A08'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(pivot.x, .25, pivot.z).normalize(), impulse: 0,
    };
    blocks.push(child);
  }
  building.updateMatrixWorld(true);
  const blockBounds = blocks.map(block => new THREE.Box3().setFromObject(block));
  const core = blocks.find(block => block.name === 'YB_mass_A08');
  const bindings = [];
  const connectors = [...building.children].filter(child =>
    child.name.startsWith('YB_connector_') || child.name === 'YB_stable_stairs_and_bridges');
  for (const connector of connectors) {
    const center = new THREE.Box3().setFromObject(connector).getCenter(new THREE.Vector3());
    let nearest = 0, distance = Infinity;
    blockBounds.forEach((box, index) => {
      const score = box.distanceToPoint(center) + .001 * box.getCenter(new THREE.Vector3()).distanceTo(center);
      if (score < distance) { distance = score; nearest = index; }
    });
    // 外楼梯跟随名称指定的楼体；合并的中庭台阶、平台和顶棚跟随中央楼。
    const stairMass = connector.name.match(/^YB_connector_YB_EXT_STAIR_(A\d{2})$/)?.[1];
    const anchor = (connector.name === 'YB_stable_stairs_and_bridges' ? core
      : blocks.find(block => block.name === `YB_mass_${stairMass}`)) || blocks[nearest];
    if (!anchor) continue;
    // Parenting preserves the original world transform and follows both translation and rotation.
    anchor.attach(connector);
    bindings.push({ connector: connector.name, anchor: anchor.name });
  }
  building.traverse(object => {
    for (const material of [].concat(object.material || [])) {
      tuneMaterial(material);
      if (/GLASS/.test(material.name)) {
        material.emissive.set('#ff9c55');
        windowMaterials.add(material);
      }
    }
  });
  building.name = 'Yuanbai_Precise_V2';
  building.rotation.y = -.12;
  building.position.z = .15;
  const viewBounds = new THREE.Box3().setFromObject(building);
  const particles = makeParticles(building, true);
  const coreLight = core ? makeCoreLight(core) : null;
  if (coreLight) viewBounds.max.y += 1.6;
  return { building, viewBounds, blocks, bindings, coreLight, stairs: [], windowMaterials: [...windowMaterials], ...particles };
}

function makeCoreLight(core) {
  const bounds = new THREE.Box3();
  core.traverse(object => {
    if (!object.isMesh || !/A08_/.test(object.name)) return;
    object.geometry.computeBoundingBox();
    bounds.union(object.geometry.boundingBox.clone().translate(object.position));
  });
  const roof = bounds.max.y;
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, energy: { value: 0 }, fade: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv; uniform float time; uniform float energy; uniform float fade;
      void main(){float rise=pow(1.-vUv.y,1.7); float activity=.7+.3*sin(vUv.y*17.-time*3.4);
      float alpha=rise*(.09+energy*.4)*activity*fade;
      gl_FragColor=vec4(mix(vec3(1.,.55,.19),vec3(1.,.94,.74),energy),alpha);}`,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.52, .13, 2.1, 28, 1, true), material);
  beam.position.set(0, roof + 1.0, 0);
  beam.userData.voiceEffect = true;
  beam.name = 'YB_inner_voice_beam';
  const light = new THREE.PointLight('#ffdda6', 1.5, 5, 1.5);
  light.position.set(0, roof + .05, 0);
  core.add(beam, light);
  return { beam, light, roof, update(time, energy, fade) {
    material.uniforms.time.value = time;
    material.uniforms.energy.value = energy;
    material.uniforms.fade.value = fade;
    beam.visible = fade > .001;
    beam.rotation.z = Math.sin(time * .8) * .035 * energy;
    light.position.x = Math.sin(time * 1.2) * .18;
    light.position.z = Math.cos(time * .9) * .18;
    light.intensity = (.8 + energy * 16) * fade;
  } };
}
