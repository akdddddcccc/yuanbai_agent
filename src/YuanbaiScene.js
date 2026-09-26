import { createElement, useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_PART_COUNT = 16;
const MODEL_PART_DIR = `${import.meta.env.BASE_URL}models/yuanbai-precise-web-v2`;
const FALLBACK_MODEL_URL = `${import.meta.env.BASE_URL}models/yuanbai-brutalist-v1.glb`;
const VOICE_GLOW = new THREE.Color("#ff8b4a");

function seededNoise(seed) {
  const value = Math.sin(seed * 91.917) * 43758.5453;
  return value - Math.floor(value);
}

async function loadChunkedGlb(loader) {
  const urls = Array.from(
    { length: MODEL_PART_COUNT },
    (_, index) => `${MODEL_PART_DIR}/part-${String(index).padStart(2, "0")}.bin`,
  );
  const chunks = await Promise.all(urls.map(async (url) => {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`模型分片加载失败：${response.status} ${url}`);
    return new Uint8Array(await response.arrayBuffer());
  }));
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return new Promise((resolve, reject) => {
    loader.parse(merged.buffer, import.meta.env.BASE_URL, resolve, reject);
  });
}

async function loadYuanbaiGlb() {
  const loader = new GLTFLoader();
  try {
    return await loadChunkedGlb(loader);
  } catch (error) {
    console.warn("精细元白模型加载失败，回退到轻量参考模型。", error);
    return loader.loadAsync(FALLBACK_MODEL_URL);
  }
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
    if (material.emissive) material.emissive.copy(VOICE_GLOW);
    material.emissiveIntensity = .055;
  }
  material.needsUpdate = true;
}

function localBoxForObject(root, object) {
  root.updateMatrixWorld(true);
  object.updateMatrixWorld(true);
  const worldBox = new THREE.Box3().setFromObject(object);
  if (worldBox.isEmpty()) return null;
  const rootInverse = root.matrixWorld.clone().invert();
  const corners = [];
  for (const x of [worldBox.min.x, worldBox.max.x]) {
    for (const y of [worldBox.min.y, worldBox.max.y]) {
      for (const z of [worldBox.min.z, worldBox.max.z]) {
        corners.push(new THREE.Vector3(x, y, z).applyMatrix4(rootInverse));
      }
    }
  }
  const box = new THREE.Box3();
  corners.forEach((point) => box.expandByPoint(point));
  return box;
}

function makeParticleProxy(building, blocks) {
  const proxy = new THREE.Group();
  proxy.name = "YB_particle_proxy";
  const material = new THREE.MeshBasicMaterial();
  blocks.forEach((block) => {
    const box = localBoxForObject(building, block);
    if (!box || box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (size.lengthSq() < 1e-5) return;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.copy(center);
    proxy.add(mesh);
  });
  building.add(proxy);
  building.updateMatrixWorld(true);
  return proxy;
}

function makeParticleRandom(seed = 41729) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeStructureParticleCloud(sourceRoot, targetRoot) {
  const random = makeParticleRandom();
  const triangles = [];
  const edgeSegments = [];
  const structureVertices = new Map();
  targetRoot.updateMatrixWorld(true);
  sourceRoot.updateMatrixWorld(true);
  const targetInverse = targetRoot.matrixWorld.clone().invert();

  sourceRoot.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position) return;
    const geometry = object.geometry;
    const positions = geometry.attributes.position;
    const transform = new THREE.Matrix4().multiplyMatrices(targetInverse, object.matrixWorld);
    const index = geometry.index;
    const triangleCount = index ? index.count / 3 : positions.count / 3;

    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      const aIndex = index ? index.getX(triangleIndex * 3) : triangleIndex * 3;
      const bIndex = index ? index.getX(triangleIndex * 3 + 1) : triangleIndex * 3 + 1;
      const cIndex = index ? index.getX(triangleIndex * 3 + 2) : triangleIndex * 3 + 2;
      const a = new THREE.Vector3().fromBufferAttribute(positions, aIndex).applyMatrix4(transform);
      const b = new THREE.Vector3().fromBufferAttribute(positions, bIndex).applyMatrix4(transform);
      const c = new THREE.Vector3().fromBufferAttribute(positions, cIndex).applyMatrix4(transform);
      const area = new THREE.Triangle(a, b, c).getArea();
      if (area > 1e-7) triangles.push({ a, b, c, area });
    }

    const hardEdges = new THREE.EdgesGeometry(geometry, 30);
    const edgePositions = hardEdges.attributes.position;
    for (let edgeIndex = 0; edgeIndex < edgePositions.count; edgeIndex += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(edgePositions, edgeIndex).applyMatrix4(transform);
      const b = new THREE.Vector3().fromBufferAttribute(edgePositions, edgeIndex + 1).applyMatrix4(transform);
      const length = a.distanceTo(b);
      if (length < 1e-5) continue;
      edgeSegments.push({ a, b, length });
      [a, b].forEach((point) => {
        const key = `${Math.round(point.x * 10)}/${Math.round(point.y * 10)}/${Math.round(point.z * 10)}`;
        if (!structureVertices.has(key)) structureVertices.set(key, point.clone());
      });
    }
    hardEdges.dispose();
  });

  if (!triangles.length || !edgeSegments.length) return null;
  let totalArea = 0;
  const cumulativeAreas = triangles.map((triangle) => {
    totalArea += triangle.area;
    return totalArea;
  });
  let totalEdgeLength = 0;
  const cumulativeEdges = edgeSegments.map((edge) => {
    totalEdgeLength += edge.length;
    return totalEdgeLength;
  });
  const vertices = [...structureVertices.values()];
  const compact = window.matchMedia("(max-width: 820px), (prefers-reduced-motion: reduce)").matches;
  const faceCount = compact ? 4200 : 6800;
  const edgeCount = compact ? 1800 : 3000;
  const vertexCount = compact ? 420 : 720;
  const count = faceCount + edgeCount + vertexCount;
  const pointPositions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const kinds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const lights = new Float32Array(count);
  const responses = new Float32Array(count);
  const directions = new Float32Array(count * 3);
  const center = new THREE.Vector3(0, 8, 0);

  const pickWeighted = (cumulative, total) => {
    const target = random() * total;
    let low = 0;
    let high = cumulative.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (cumulative[middle] < target) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  const put = (index, point, kind, size, light, response) => {
    pointPositions.set(point.toArray(), index * 3);
    seeds[index] = random();
    kinds[index] = kind;
    sizes[index] = size;
    lights[index] = light;
    responses[index] = response;
    const direction = point.clone().sub(center);
    direction.y += 2 + random() * 3;
    direction.x += (random() - .5) * 3;
    direction.z += (random() - .5) * 3;
    if (direction.lengthSq() < .001) direction.set(0, 1, 0);
    directions.set(direction.normalize().toArray(), index * 3);
  };

  for (let i = 0; i < faceCount; i += 1) {
    const triangle = triangles[pickWeighted(cumulativeAreas, totalArea)];
    let u = random();
    let v = random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const point = triangle.a.clone()
      .addScaledVector(triangle.b.clone().sub(triangle.a), u)
      .addScaledVector(triangle.c.clone().sub(triangle.a), v);
    put(i, point, 0, .72 + random() * .6, .17 + random() * .18, .3 + random() * .42);
  }
  for (let i = 0; i < edgeCount; i += 1) {
    const edge = edgeSegments[pickWeighted(cumulativeEdges, totalEdgeLength)];
    const t = random();
    const point = edge.a.clone().lerp(edge.b, t);
    put(faceCount + i, point, 1, 1.05 + random() * .75, .5 + random() * .24, .12 + random() * .2);
  }
  for (let i = 0; i < vertexCount; i += 1) {
    const point = vertices[Math.floor(random() * vertices.length)].clone();
    put(faceCount + edgeCount + i, point, 2, 1.7 + random() * 1.3, .72 + random() * .24, .03 + random() * .08);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pointPositions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aKind", new THREE.BufferAttribute(kinds, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aLight", new THREE.BufferAttribute(lights, 1));
  geometry.setAttribute("aResponse", new THREE.BufferAttribute(responses, 1));
  geometry.setAttribute("aDirection", new THREE.BufferAttribute(directions, 3));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uFormation: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uFormation;
      attribute float aSeed;
      attribute float aKind;
      attribute float aSize;
      attribute float aLight;
      attribute float aResponse;
      attribute vec3 aDirection;
      varying float vAlpha;
      varying float vKind;
      void main() {
        float delayedForm = smoothstep(aResponse, 1.0, uFormation);
        float scatter = 1.0 - delayedForm;
        vec3 p = position + aDirection * scatter * (8.0 + aSeed * 18.0 + aKind * 2.0);
        float angle = (aSeed - .5) * scatter * 1.0 + uTime * (.045 + aSeed * .035) * scatter;
        float c = cos(angle);
        float s = sin(angle);
        p.xz = mat2(c, -s, s, c) * p.xz;
        p += vec3(
          sin(uTime * .72 + aSeed * 31.0),
          cos(uTime * .58 + aSeed * 23.0),
          sin(uTime * .66 + aSeed * 17.0)
        ) * (.08 + scatter * 1.1);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (76.0 / max(1.0, -mv.z));
        vAlpha = aLight * (.72 + sin(uTime * 1.1 + aSeed * 19.0) * .18);
        vKind = aKind;
      }`,
    fragmentShader: `
      uniform float uOpacity;
      varying float vAlpha;
      varying float vKind;
      void main() {
        vec2 p = gl_PointCoord - .5;
        float distanceToCenter = length(p) * 2.0;
        if (distanceToCenter > 1.0) discard;
        float halo = pow(1.0 - distanceToCenter, mix(2.4, 1.15, vKind * .5));
        vec3 faceColor = vec3(1.0, .91, .84);
        vec3 edgeColor = vec3(1.0, .50, .25);
        vec3 nodeColor = vec3(1.0, .73, .45);
        vec3 color = vKind < .5 ? faceColor : (vKind < 1.5 ? edgeColor : nodeColor);
        gl_FragColor = vec4(color, halo * vAlpha * uOpacity);
      }`,
  });
  const particles = new THREE.Points(geometry, material);
  particles.name = "YB_structure_particle_memory";
  particles.frustumCulled = false;
  particles.visible = false;
  targetRoot.add(particles);
  return { particles, particleMaterial: material };
}

function prepareModel(gltf) {
  const building = gltf.scene;
  building.name = "Yuanbai_Precise_Architecture";
  building.updateMatrixWorld(true);

  const blocks = [];
  const connectors = [];
  const entityMeshes = [];
  const materials = new Set();
  const windowMaterials = new Set();

  building.traverse((object) => {
    const name = String(object.name || "");
    if (!object.isMesh && /^YB_mass_/.test(name) && !name.includes("__")) blocks.push(object);
    if (!object.isMesh && /^YB_connector_/.test(name) && !name.includes("__")) connectors.push(object);
    if (!object.isMesh) return;
    entityMeshes.push(object);
    object.castShadow = false;
    object.receiveShadow = false;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    list.filter(Boolean).forEach((material) => {
      tuneMaterial(material);
      materials.add(material);
      if (String(material.name || "").toUpperCase().includes("GLASS")) windowMaterials.add(material);
    });
  });

  blocks.sort((a, b) => a.name.localeCompare(b.name));
  const blockByKey = new Map();
  blocks.forEach((block, index) => {
    const key = block.name.replace(/^YB_mass_/, "");
    blockByKey.set(key, block);
    block.userData.home = block.position.clone();
    block.userData.baseRotation = block.rotation.clone();
    block.userData.phase = index * .73;
    const radial = new THREE.Vector3(block.position.x, 2 + (index % 3) * .55, block.position.z);
    if (radial.lengthSq() < 1) radial.set(-4, 2.2, -6);
    block.userData.axis = radial.normalize();
    block.userData.impulse = 0;
  });

  connectors.forEach((connector) => {
    connector.userData.home = connector.position.clone();
    const match = connector.name.match(/_ANCHOR_(A\d\d)$/);
    const anchorBlock = match ? blockByKey.get(match[1]) : null;
    connector.userData.anchorBlock = anchorBlock || null;
    connector.userData.anchorHome = anchorBlock?.userData.home.clone() || null;
  });

  const rawBox = new THREE.Box3().setFromObject(building);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const horizontal = Math.max(rawSize.x, rawSize.z, 1);
  const modelScale = 10.8 / horizontal;
  const proxy = makeParticleProxy(building, blocks);
  const particleSystem = makeStructureParticleCloud(proxy, building);
  building.remove(proxy);
  proxy.traverse((object) => object.geometry?.dispose?.());
  proxy.traverse((object) => object.material?.dispose?.());

  building.scale.setScalar(modelScale);
  building.rotation.y = -.12;
  building.position.set(0, .62, .1);
  building.updateMatrixWorld(true);

  return {
    building,
    blocks,
    connectors,
    entityMeshes,
    materials: [...materials],
    windowMaterials: [...windowMaterials],
    particles: particleSystem?.particles || null,
    particleMaterial: particleSystem?.particleMaterial || null,
    modelScale,
  };
}

function makeDistantProjectionTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(256, 256, 18, 256, 256, 248);
  gradient.addColorStop(0, "rgba(222,92,52,.72)");
  gradient.addColorStop(.18, "rgba(170,49,32,.34)");
  gradient.addColorStop(.5, "rgba(88,20,18,.12)");
  gradient.addColorStop(1, "rgba(24,5,6,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function YuanbaiScene({ phase, level }) {
  const mountRef = useRef(null);
  const stateRef = useRef({ phase, level });
  stateRef.current = { phase, level };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let disposed = false;
    let frame = 0;
    let model = null;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b0203, .034);
    const camera = new THREE.PerspectiveCamera(31, 1, .1, 100);
    const cameraHome = new THREE.Vector3(11.8, 8.7, 17.5);
    const lookAt = new THREE.Vector3(0, 1.35, .1);
    let cameraScale = 1;
    camera.position.copy(cameraHome);
    camera.lookAt(lookAt);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.55));
    renderer.setClearColor(0x180506, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffddc7, 0x120304, 1.55);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffd4bd, 3.1);
    key.position.set(8, 13, 10);
    scene.add(key);
    const rim = new THREE.PointLight(0xc73d2a, 20, 34, 1.5);
    rim.position.set(-6, 4, 5);
    scene.add(rim);
    const fill = new THREE.PointLight(0xffa76c, 12, 30, 1.4);
    fill.position.set(6, 5, 8);
    scene.add(fill);

    const projectionMaterial = new THREE.MeshBasicMaterial({
      map: makeDistantProjectionTexture(),
      color: 0xd95e3d,
      transparent: true,
      opacity: .07,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const projection = new THREE.Mesh(new THREE.PlaneGeometry(16, 11), projectionMaterial);
    projection.rotation.x = -Math.PI / 2;
    projection.position.set(.2, -1.7, .45);
    scene.add(projection);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      cameraScale = 1 / THREE.MathUtils.clamp(Math.min(width / 960, height / 680), .78, 1.18);
      camera.position.copy(cameraHome).multiplyScalar(cameraScale);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const pointer = new THREE.Vector2();
    const onPointerMove = (event) => {
      pointer.x = (event.clientX / window.innerWidth - .5) * 2;
      pointer.y = (event.clientY / window.innerHeight - .5) * 2;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const startedAt = performance.now();
    let afterglow = .06;
    let smoothedLevel = 0;
    let previousLevel = 0;
    let entityOpacity = 1;
    let particleOpacity = 0;
    let particleFormation = 0;
    let wasThinking = false;
    let thinkingStartedAt = 0;

    const applyEntityOpacity = (opacity) => {
      if (!model) return;
      model.entityMeshes.forEach((mesh) => { mesh.visible = opacity > .002; });
      model.materials.forEach((material) => {
        const base = material.userData.ybBaseOpacity ?? 1;
        material.opacity = base * opacity;
        const nextTransparent = Boolean(material.userData.ybBaseTransparent) || opacity < .999;
        if (material.transparent !== nextTransparent) {
          material.transparent = nextTransparent;
          material.needsUpdate = true;
        }
      });
    };

    const animate = (now) => {
      if (disposed || !model) return;
      frame = requestAnimationFrame(animate);
      const t = (now - startedAt) / 1000;
      const { phase: currentPhase, level: rawLevel } = stateRef.current;
      const voiceLevel = currentPhase === "speaking" ? rawLevel : 0;
      smoothedLevel += (voiceLevel - smoothedLevel) * (voiceLevel > smoothedLevel ? .24 : .075);
      afterglow = Math.max(smoothedLevel, afterglow * .974);

      const onset = voiceLevel - previousLevel;
      if (currentPhase === "speaking" && onset > .085 && voiceLevel > .15) {
        model.blocks.forEach((block, index) => {
          block.userData.impulse += onset * (1.02 + (index % 5) * .11);
        });
      }
      previousLevel = voiceLevel;

      const unit = 1 / model.modelScale;
      model.blocks.forEach((block, index) => {
        const data = block.userData;
        data.impulse *= .91;
        const idleVisible = Math.sin(t * .43 + data.phase) * .055
          + Math.cos(t * .21 + data.phase * 1.7) * .015;
        const outwardVisible = (smoothedLevel * .58 + data.impulse * 1.9) * (.76 + (index % 5) * .055);
        const target = data.home.clone().addScaledVector(data.axis, outwardVisible * unit);
        target.y += idleVisible * unit;
        block.position.lerp(target, .08);
        block.rotation.x += ((data.baseRotation.x + Math.sin(t * .31 + index) * .005 + smoothedLevel * data.axis.z * .014) - block.rotation.x) * .08;
        block.rotation.z += ((data.baseRotation.z + Math.cos(t * .29 + index * .7) * .004 + smoothedLevel * data.axis.x * .014) - block.rotation.z) * .08;
        block.rotation.y += ((data.baseRotation.y + smoothedLevel * data.axis.x * .018) - block.rotation.y) * .07;
      });

      model.connectors.forEach((connector) => {
        const { home, anchorBlock, anchorHome } = connector.userData;
        if (!home) return;
        connector.position.copy(home);
        if (anchorBlock && anchorHome) connector.position.add(anchorBlock.position.clone().sub(anchorHome));
      });

      const lightPulse = .055 + smoothedLevel * 6.4 + afterglow * 1.45;
      model.windowMaterials.forEach((material, index) => {
        const uneven = .76 + Math.sin(t * 3.8 + index * 1.37) * .16;
        if (material.emissive) material.emissive.copy(VOICE_GLOW);
        material.emissiveIntensity = lightPulse * uneven;
      });

      const speechGlow = Math.min(1, smoothedLevel * 1.3 + afterglow * .34);
      ambient.intensity += ((1.55 + speechGlow * .35) - ambient.intensity) * .08;
      key.intensity += ((3.1 + speechGlow * 2.1) - key.intensity) * .09;
      rim.intensity += ((20 + speechGlow * 45) - rim.intensity) * .1;
      fill.intensity += ((12 + speechGlow * 26) - fill.intensity) * .1;
      projectionMaterial.opacity += ((.055 + speechGlow * .17) - projectionMaterial.opacity) * .08;

      const thinking = currentPhase === "thinking";
      if (thinking && !wasThinking) {
        thinkingStartedAt = t;
        entityOpacity = 1;
        particleOpacity = 0;
        particleFormation = 0;
      }
      if (thinking) {
        const transitionTime = t - thinkingStartedAt;
        const dissolveProgress = THREE.MathUtils.clamp(transitionTime / .28, 0, 1);
        const eased = dissolveProgress * dissolveProgress * (3 - 2 * dissolveProgress);
        entityOpacity = 1 - eased;
        if (dissolveProgress >= 1) {
          particleOpacity += (1 - particleOpacity) * .075;
          particleFormation = 1 - Math.exp(-(transitionTime - .28) * 1.6);
        } else {
          particleOpacity = 0;
          particleFormation = 0;
        }
      } else {
        particleOpacity += (0 - particleOpacity) * .095;
        particleFormation += (0 - particleFormation) * .08;
        if (particleOpacity < .008) {
          particleOpacity = 0;
          entityOpacity += (1 - entityOpacity) * .12;
        } else {
          entityOpacity = 0;
        }
      }
      wasThinking = thinking;
      applyEntityOpacity(entityOpacity);
      if (model.particleMaterial && model.particles) {
        model.particleMaterial.uniforms.uTime.value = t;
        model.particleMaterial.uniforms.uOpacity.value = particleOpacity;
        model.particleMaterial.uniforms.uFormation.value = particleFormation;
        model.particles.visible = particleOpacity > .01;
        model.particles.rotation.y = Math.sin(t * .19) * .045 * (1 - particleFormation);
      }

      model.building.rotation.y += ((-.12 + pointer.x * .15) - model.building.rotation.y) * .032;
      model.building.rotation.x += ((pointer.y * -.048) - model.building.rotation.x) * .032;
      model.building.position.y += ((.62 + Math.sin(t * .31) * .052) - model.building.position.y) * .045;
      camera.position.x += ((cameraHome.x * cameraScale + pointer.x * .58 * cameraScale) - camera.position.x) * .024;
      camera.position.y += ((cameraHome.y * cameraScale - pointer.y * .34 * cameraScale) - camera.position.y) * .024;
      camera.lookAt(lookAt);
      renderer.render(scene, camera);
    };

    loadYuanbaiGlb().then((gltf) => {
      if (disposed) return;
      model = prepareModel(gltf);
      scene.add(model.building);
      applyEntityOpacity(1);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    }).catch((error) => {
      console.error("元白模型初始化失败", error);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.filter(Boolean).forEach((material) => materials.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose?.());
      materials.forEach((material) => {
        if (material.map) material.map.dispose?.();
        material.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return createElement("div", { ref: mountRef, className: "scene-mount scene-mount-dialogue" });
}