import { createElement, useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { YUANBAI_CONNECTIONS, YUANBAI_COURTYARD, YUANBAI_MASSES } from "./yuanbaiModelSpec.js";

const palette = {
  brick: new THREE.Color("#f0c1ad"),
  brickDark: new THREE.Color("#d3a097"),
  concrete: new THREE.Color("#b8b4ac"),
  concreteLight: new THREE.Color("#d2cdc3"),
  metal: new THREE.Color("#33383a"),
  glow: new THREE.Color("#ff9c55"),
  grass: new THREE.Color("#537048"),
};

function seededNoise(seed) {
  const value = Math.sin(seed * 91.917) * 43758.5453;
  return value - Math.floor(value);
}

function makeSurfaceTexture(type) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (type === "brick" || type === "brickDark") {
    const base = type === "brick" ? "#ad594a" : "#7f3d36";
    const mortar = type === "brick" ? "#754037" : "#4b2825";
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, 256, 256);
    const brickW = 44;
    const brickH = 18;
    for (let row = 0; row < 15; row += 1) {
      const offset = row % 2 ? -brickW / 2 : 0;
      for (let col = -1; col < 8; col += 1) {
        const tone = Math.round((seededNoise(row * 17 + col * 7) - .5) * 18);
        ctx.fillStyle = base;
        ctx.fillRect(offset + col * brickW + 2, row * brickH + 2, brickW - 4, brickH - 4);
        ctx.fillStyle = `rgba(${tone > 0 ? 255 : 30},${tone > 0 ? 225 : 10},${tone > 0 ? 205 : 8},${Math.abs(tone) / 90})`;
        ctx.fillRect(offset + col * brickW + 2, row * brickH + 2, brickW - 4, brickH - 4);
      }
    }
    // 很轻的雨水色差，避免每面砖墙过于均匀。
    ctx.fillStyle = "rgba(82,35,27,.045)";
    [31, 118, 203].forEach((x, index) => ctx.fillRect(x, 0, 8 + index * 3, 256));
  } else {
    ctx.fillStyle = "#a7a59f";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3400; i += 1) {
      const value = 120 + Math.floor(seededNoise(i * 3.13) * 95);
      ctx.fillStyle = `rgba(${value},${value},${value - 4},${.025 + seededNoise(i) * .08})`;
      const x = seededNoise(i * 1.71) * 256;
      const y = seededNoise(i * 2.37) * 256;
      ctx.fillRect(x, y, 1 + seededNoise(i * 4.4) * 2, 1);
    }
    ctx.strokeStyle = "rgba(73,68,63,.18)";
    ctx.lineWidth = 1;
    for (let y = 32; y < 256; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y + .5);
      ctx.lineTo(256, y + .5);
      ctx.stroke();
    }
    for (let x = 64; x < 256; x += 96) {
      ctx.beginPath();
      ctx.moveTo(x + .5, 0);
      ctx.lineTo(x + .5, 256);
      ctx.stroke();
    }
    // 混凝土模板接缝下的微弱锈水痕，透明度刻意压低。
    [46, 168, 221].forEach((x, index) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 170 + index * 22);
      gradient.addColorStop(0, "rgba(132,67,43,.11)");
      gradient.addColorStop(.42, "rgba(139,72,46,.045)");
      gradient.addColorStop(1, "rgba(139,72,46,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x, 0, 4 + index * 2, 190 + index * 22);
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(type === "concrete" ? 1.5 : 2.8, type === "concrete" ? 2 : 3.4);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeMaterials() {
  const brickTexture = makeSurfaceTexture("brick");
  const darkBrickTexture = makeSurfaceTexture("brickDark");
  const concreteTexture = makeSurfaceTexture("concrete");
  return {
    brick: new THREE.MeshStandardMaterial({ map: brickTexture, color: palette.brick, roughness: .94, metalness: .01 }),
    brickDark: new THREE.MeshStandardMaterial({ map: darkBrickTexture, color: palette.brickDark, roughness: .96, metalness: 0 }),
    concrete: new THREE.MeshStandardMaterial({ map: concreteTexture, color: palette.concrete, roughness: .98, metalness: 0 }),
    concreteLight: new THREE.MeshStandardMaterial({ map: concreteTexture, color: palette.concreteLight, roughness: .96, metalness: 0 }),
    concreteDark: new THREE.MeshStandardMaterial({ color: "#6f6a64", roughness: .98, metalness: 0 }),
    metal: new THREE.MeshStandardMaterial({ color: palette.metal, roughness: .82, metalness: .3 }),
    weatheredMetal: new THREE.MeshStandardMaterial({ color: "#594a43", roughness: .87, metalness: .14 }),
    roofPaver: new THREE.MeshStandardMaterial({ color: "#c87f69", roughness: .92, metalness: 0 }),
    roofGlass: new THREE.MeshStandardMaterial({ color: "#91a5a5", emissive: "#57706f", emissiveIntensity: .18, roughness: .28, metalness: .08 }),
    grass: new THREE.MeshStandardMaterial({ color: palette.grass, roughness: 1, metalness: 0 }),
    soil: new THREE.MeshStandardMaterial({ color: "#342822", roughness: 1, metalness: 0 }),
  };
}

function footprintGeometry(points, height) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function bodyGeometry(mass, height = mass.size[1]) {
  if (mass.footprint) return footprintGeometry(mass.footprint, height);
  return new RoundedBoxGeometry(mass.size[0], height, mass.size[2], 2, .025);
}

function addWindow(group, face, x, y, z, width, height, materials, windowMaterials) {
  const recess = new THREE.Mesh(
    new THREE.BoxGeometry(
      face === "front" ? width + .11 : .055,
      height + .11,
      face === "front" ? .055 : width + .11,
    ),
    materials.concreteDark,
  );
  recess.position.set(x, y, z);
  group.add(recess);

  const glowMaterial = new THREE.MeshStandardMaterial({
    color: "#1c1512",
    emissive: palette.glow,
    emissiveIntensity: .16,
    roughness: .42,
    metalness: .03,
  });
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(
      face === "front" ? width : .028,
      height,
      face === "front" ? .028 : width,
    ),
    glowMaterial,
  );
  glass.position.set(
    x + (face === "side" ? Math.sign(x || 1) * .033 : 0),
    y,
    z + (face === "front" ? Math.sign(z || 1) * .033 : 0),
  );
  group.add(glass);
  windowMaterials.push(glowMaterial);
}

function addFacadeDetails(group, mass, index, materials, windowMaterials) {
  const [width, height, depth] = mass.size;
  const rowCount = Math.max(1, Math.min(4, Math.floor((height - .28) / .58)));
  const colCount = Math.max(1, Math.min(3, Math.floor(width / .48)));
  const frontZ = depth / 2 + .031;

  for (let row = 0; row < rowCount; row += 1) {
    const wy = .34 + row * ((height - .58) / Math.max(1, rowCount - 1));
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(width * .84, .27, .045), materials.concreteDark);
    ribbon.position.set(0, wy, frontZ - .006);
    group.add(ribbon);
    for (let col = 0; col < colCount; col += 1) {
      if ((row * 3 + col + index) % 5 === 0) continue;
      const wx = (col - (colCount - 1) / 2) * Math.min(.43, width / Math.max(2, colCount + .4));
      addWindow(group, "front", wx, wy, frontZ, .25, .18, materials, windowMaterials);
    }
    const sideX = (index % 2 ? 1 : -1) * (width / 2 + .031);
    const sideZ = ((row + index) % 2 ? -.19 : .19) * Math.min(1, depth);
    addWindow(group, "side", sideX, wy, sideZ, .23, .18, materials, windowMaterials);
  }

  const roof = new THREE.Mesh(
    new RoundedBoxGeometry(width * 1.055, .09, depth * 1.055, 2, .018),
    materials.concreteLight,
  );
  roof.position.y = height + .045;
  roof.castShadow = true;
  group.add(roof);

  // 顶视图中的陶土色铺装、绿色屋面和白色压边。
  if (height < 3.1) {
    const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(width * .82, .035, depth * .8), materials.roofPaver);
    roofDeck.position.y = height + .108;
    group.add(roofDeck);
    const gardenWidth = width * (index % 2 ? .38 : .62);
    const garden = new THREE.Mesh(new THREE.BoxGeometry(gardenWidth, .038, depth * .64), materials.grass);
    garden.position.set((width * .72 - gardenWidth) * (index % 2 ? -.25 : .2), height + .135, 0);
    group.add(garden);
  }

  const fin = new THREE.Mesh(new THREE.BoxGeometry(.12, height * .78, .16), materials.concreteLight);
  fin.position.set(width * .28 * (index % 2 ? 1 : -1), height * .48, depth / 2 + .1);
  fin.castShadow = true;
  group.add(fin);

  if (index % 3 === 0 && height > 1.4) {
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(width * .58, .09, .34), materials.concreteLight);
    balcony.position.set(0, height * .58, depth / 2 + .17);
    balcony.castShadow = true;
    group.add(balcony);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width * .56, .25, .025), materials.metal);
    rail.position.set(0, height * .58 + .17, depth / 2 + .33);
    group.add(rail);
  }

  // 少量外露钢斜撑强调粗野主义结构，不把每一面都装饰化。
  if (index % 4 === 2 && height > 1.35) {
    const braceStartA = new THREE.Vector3(-width * .38, .22, depth / 2 + .115);
    const braceEndA = new THREE.Vector3(width * .38, Math.min(height - .18, 1.65), depth / 2 + .115);
    const braceStartB = new THREE.Vector3(width * .38, .22, depth / 2 + .12);
    const braceEndB = new THREE.Vector3(-width * .38, Math.min(height - .18, 1.65), depth / 2 + .12);
    const braceA = cylinderBetween(braceStartA, braceEndA, .028, materials.metal);
    const braceB = cylinderBetween(braceStartB, braceEndB, .028, materials.metal);
    braceA.name = "exposed_steel_brace_a";
    braceB.name = "exposed_steel_brace_b";
    group.add(braceA, braceB);
  }

  if (mass.finish === "concrete") {
    for (let seam = .42; seam < height - .18; seam += .62) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(width * .88, .018, .018), materials.concreteDark);
      line.position.set(0, seam, depth / 2 + .038);
      group.add(line);
    }
    if (index % 2 === 1) {
      const rustJoint = new THREE.Mesh(new THREE.BoxGeometry(.035, height * .34, .012), materials.weatheredMetal);
      rustJoint.position.set(width * .27, height * .7, depth / 2 + .047);
      rustJoint.material = materials.weatheredMetal.clone();
      rustJoint.material.transparent = true;
      rustJoint.material.opacity = .22;
      group.add(rustJoint);
    }
  }

  if (index % 2 === 0) {
    const roofCore = new THREE.Mesh(new RoundedBoxGeometry(width * .34, .28, depth * .3, 2, .018), materials.concrete);
    roofCore.position.set(-width * .16, height + .18, 0);
    roofCore.castShadow = true;
    group.add(roofCore);
  } else {
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(.055, .07, .36, 10), materials.weatheredMetal);
    vent.position.set(width * .22, height + .22, -depth * .12);
    group.add(vent);
  }

  if (mass.id === "central-tower") {
    const lantern = new THREE.Group();
    lantern.position.y = height + .19;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(width * .58, .07, depth * .58), materials.roofGlass);
    lantern.add(glass);
    for (let i = -2; i <= 2; i += 1) {
      const barX = new THREE.Mesh(new THREE.BoxGeometry(.018, .095, depth * .61), materials.concreteLight);
      barX.position.x = i * width * .11;
      lantern.add(barX);
      const barZ = new THREE.Mesh(new THREE.BoxGeometry(width * .61, .095, .018), materials.concreteLight);
      barZ.position.z = i * depth * .11;
      lantern.add(barZ);
    }
    group.add(lantern);
  }
}

function addCourtyard(building, materials) {
  const root = new THREE.Group();
  root.name = "YB_circular_courtyard";
  root.position.set(...YUANBAI_COURTYARD.position);
  building.add(root);

  const soil = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, .035, 64), materials.soil);
  soil.position.y = -.01;
  soil.receiveShadow = true;
  root.add(soil);

  YUANBAI_COURTYARD.brickRadii.forEach((radius, index) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .065, 6, 72), index % 2 ? materials.brickDark : materials.brick);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = .035 + index * .018;
    ring.receiveShadow = true;
    root.add(ring);
  });

  YUANBAI_COURTYARD.grassRadii.forEach((radius, index) => {
    const grass = new THREE.Mesh(new THREE.TorusGeometry(radius, .085, 6, 64), materials.grass);
    grass.rotation.x = Math.PI / 2;
    grass.position.y = .048 + index * .018;
    root.add(grass);
  });
}

function cylinderBetween(start, end, radius, material) {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 8), material);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  return mesh;
}

function addStairConnection(stairRoot, connection, materials) {
  const root = new THREE.Group();
  root.name = `YB_stair_${connection.id}`;
  const start = new THREE.Vector3(...connection.from);
  const end = new THREE.Vector3(...connection.to);
  const horizontal = new THREE.Vector3(end.x - start.x, 0, end.z - start.z);
  const run = Math.max(.01, horizontal.length());
  const stepCount = Math.max(5, Math.ceil(Math.max(run * 9, Math.abs(end.y - start.y) * 10)));
  const rotationY = Math.atan2(horizontal.x, horizontal.z);

  for (let i = 0; i < stepCount; i += 1) {
    const amount = (i + .5) / stepCount;
    const point = start.clone().lerp(end, amount);
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(connection.width, .07, run / stepCount * 1.18),
      materials.concreteLight,
    );
    step.position.copy(point);
    step.rotation.y = rotationY;
    step.castShadow = true;
    root.add(step);
  }

  const side = new THREE.Vector3(horizontal.z, 0, -horizontal.x).normalize().multiplyScalar(connection.width * .48);
  [-1, 1].forEach((direction) => {
    const railStart = start.clone().addScaledVector(side, direction);
    const railEnd = end.clone().addScaledVector(side, direction);
    railStart.y += .28;
    railEnd.y += .28;
    root.add(cylinderBetween(railStart, railEnd, .018, materials.metal));
    const stringerStart = start.clone().addScaledVector(side, direction * .78);
    const stringerEnd = end.clone().addScaledVector(side, direction * .78);
    stringerStart.y -= .1;
    stringerEnd.y -= .1;
    const stringer = cylinderBetween(stringerStart, stringerEnd, .032, materials.metal);
    stringer.name = "rough_steel_stair_stringer";
    root.add(stringer);
  });
  stairRoot.add(root);
}

function makeBuilding(scene) {
  const materials = makeMaterials();
  const building = new THREE.Group();
  building.name = "Yuanbai_Brutalist_Architecture";
  building.rotation.y = -.12;
  building.position.set(0, -.03, .15);
  scene.add(building);

  const windowMaterials = [];
  const blocks = [];

  YUANBAI_MASSES.forEach((mass, index) => {
    const group = new THREE.Group();
    group.name = `YB_mass_${mass.id}`;
    group.position.set(...mass.position);
    group.rotation.y = mass.rotation;
    group.userData.home = group.position.clone();
    group.userData.baseRotation = mass.rotation;
    group.userData.phase = index * .73;
    const radial = new THREE.Vector3(mass.position[0], .22 + (index % 3) * .04, mass.position[2]);
    if (radial.lengthSq() < .2) radial.set(-.4, .25, -.6);
    group.userData.axis = radial.normalize();
    group.userData.impulse = 0;

    const body = new THREE.Mesh(bodyGeometry(mass), materials[mass.finish]);
    body.name = `${group.name}_body`;
    if (!mass.footprint) body.position.y = mass.size[1] / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    if (mass.footprint) {
      for (let i = 0; i < 5; i += 1) {
        addWindow(group, "front", -2.25 + i * .55, .62, 2.025, .28, .2, materials, windowMaterials);
      }
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.65, .12, .58), materials.concreteLight);
      canopy.position.set(1.65, .62, 2.22);
      canopy.castShadow = true;
      group.add(canopy);
      const roof = new THREE.Mesh(footprintGeometry(mass.footprint, .08), materials.concreteLight);
      roof.position.y = mass.size[1];
      group.add(roof);
      const westGarden = new THREE.Mesh(new THREE.BoxGeometry(1.55, .045, 2.65), materials.grass);
      westGarden.position.set(-1.86, mass.size[1] + .095, -.05);
      group.add(westGarden);
      const southGarden = new THREE.Mesh(new THREE.BoxGeometry(2.25, .045, 1.25), materials.grass);
      southGarden.position.set(1.48, mass.size[1] + .095, .82);
      group.add(southGarden);
      const roofWalk = new THREE.Mesh(new THREE.BoxGeometry(2.45, .025, .48), materials.roofPaver);
      roofWalk.position.set(.55, mass.size[1] + .112, 1.55);
      group.add(roofWalk);
    } else {
      addFacadeDetails(group, mass, index, materials, windowMaterials);
    }

    building.add(group);
    blocks.push(group);
  });

  const stairRoot = new THREE.Group();
  stairRoot.name = "YB_stable_stairs_and_bridges";
  YUANBAI_CONNECTIONS.forEach((connection) => addStairConnection(stairRoot, connection, materials));
  building.add(stairRoot);
  addCourtyard(building, materials);

  const particleGeometry = new THREE.BufferGeometry();
  const count = 6800;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.3 + Math.pow(Math.random(), 1.45) * 5.2;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.random() * 4.3 - .1;
    positions[i * 3 + 2] = Math.sin(angle) * radius * .86;
    seeds[i] = Math.random();
  }
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const particleMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      attribute float aSeed;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float angle = uTime * (.12 + aSeed * .2) + p.y * .12;
        float c = cos(angle); float s = sin(angle);
        p.xz = mat2(c, -s, s, c) * p.xz;
        p += vec3(sin(uTime * .7 + aSeed * 18.) * .16, sin(uTime + aSeed * 11.) * .11, 0.);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.2 + aSeed * 2.4) * (110.0 / -mv.z);
        vAlpha = .35 + aSeed * .65;
      }`,
    fragmentShader: `
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        vec2 p = gl_PointCoord - .5;
        float d = length(p);
        if (d > .5) discard;
        float glow = smoothstep(.5, .02, d);
        gl_FragColor = vec4(vec3(1.0, .97, .92), glow * vAlpha * uOpacity);
      }`,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.position.copy(building.position);
  scene.add(particles);

  return { building, blocks, stairRoot, windowMaterials, particles, particleMaterial };
}

export function YuanbaiScene({ phase, level, variant = "dialogue" }) {
  const mountRef = useRef(null);
  const stateRef = useRef({ phase, level });
  stateRef.current = { phase, level };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x180506, .028);
    const camera = new THREE.PerspectiveCamera(31, 1, .1, 100);
    const cameraHome = variant === "portal"
      ? new THREE.Vector3(10.8, 9.6, 16.8)
      : new THREE.Vector3(11.8, 8.7, 17.5);
    const lookAt = new THREE.Vector3(0, 1.15, .3);
    camera.position.copy(cameraHome);
    camera.lookAt(lookAt);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x180506, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.38;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffe1cd, 0x250908, 2.35));
    const key = new THREE.DirectionalLight(0xffd3b9, 5.2);
    key.position.set(8, 13, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    scene.add(key);
    const rim = new THREE.PointLight(0xc73d2a, 62, 32, 1.55);
    rim.position.set(-6, 3, 5);
    scene.add(rim);
    const fill = new THREE.PointLight(0xffa76c, 42, 28, 1.45);
    fill.position.set(6, 5, 8);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 34),
      new THREE.MeshStandardMaterial({ color: 0x180506, roughness: 1, transparent: true, opacity: .76 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.065;
    floor.receiveShadow = true;
    scene.add(floor);

    if (variant === "portal") {
      const grid = new THREE.GridHelper(34, 24, 0x8e211b, 0x3d1110);
      grid.position.y = -.045;
      grid.material.transparent = true;
      grid.material.opacity = .28;
      scene.add(grid);
    }

    const model = makeBuilding(scene);
    if (variant === "portal") model.building.scale.setScalar(1.04);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
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
    let frame = 0;
    let afterglow = .06;
    let smoothedLevel = 0;
    let previousLevel = 0;
    let particleOpacity = 0;

    const animate = (now) => {
      frame = requestAnimationFrame(animate);
      const t = (now - startedAt) / 1000;
      const { phase: currentPhase, level: rawLevel } = stateRef.current;
      const voiceLevel = currentPhase === "speaking" ? rawLevel : 0;
      smoothedLevel += (voiceLevel - smoothedLevel) * (voiceLevel > smoothedLevel ? .24 : .075);
      afterglow = Math.max(smoothedLevel, afterglow * .974);

      const onset = voiceLevel - previousLevel;
      if (currentPhase === "speaking" && onset > .085 && voiceLevel > .15) {
        model.blocks.forEach((block, index) => {
          block.userData.impulse += onset * (1.05 + (index % 4) * .13);
        });
      }
      previousLevel = voiceLevel;

      model.blocks.forEach((block, index) => {
        const data = block.userData;
        data.impulse *= .91;
        const idle = Math.sin(t * .56 + data.phase) * .026;
        const outward = (smoothedLevel * .62 + data.impulse * 2.0) * (.78 + (index % 5) * .055);
        const target = data.home.clone().addScaledVector(data.axis, outward);
        target.y += idle;
        block.position.lerp(target, .08);
        block.rotation.x = Math.sin(t * .31 + index) * .006 + smoothedLevel * data.axis.z * .018;
        block.rotation.z = Math.cos(t * .29 + index * .7) * .004 + smoothedLevel * data.axis.x * .016;
        block.rotation.y += (data.baseRotation + smoothedLevel * data.axis.x * .025 - block.rotation.y) * .07;
      });

      model.stairRoot.position.y = Math.sin(t * .42) * .006;
      model.stairRoot.rotation.z = Math.sin(t * .28) * .0015;
      const lightPulse = .12 + smoothedLevel * 8.1 + afterglow * 2.15;
      model.windowMaterials.forEach((material, index) => {
        const uneven = .72 + Math.sin(t * 4.0 + index * 1.47) * .18;
        material.emissiveIntensity = lightPulse * uneven;
      });

      const thinking = currentPhase === "thinking" ? 1 : 0;
      particleOpacity += (thinking - particleOpacity) * .055;
      model.particleMaterial.uniforms.uTime.value = t;
      model.particleMaterial.uniforms.uOpacity.value = particleOpacity;
      model.particles.visible = particleOpacity > .01;
      model.particles.rotation.y = t * .045;
      model.building.traverse((child) => {
        if (!child.material) return;
        child.material.opacity = 1 - particleOpacity * .94;
        child.material.transparent = particleOpacity > .01;
      });

      model.building.rotation.y += ((-.12 + pointer.x * .07) - model.building.rotation.y) * .024;
      model.building.rotation.x += ((pointer.y * -.018) - model.building.rotation.x) * .024;
      camera.position.x += ((cameraHome.x + pointer.x * .28) - camera.position.x) * .018;
      camera.position.y += ((cameraHome.y - pointer.y * .18) - camera.position.y) * .018;
      camera.lookAt(lookAt);
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant]);

  return createElement("div", { ref: mountRef, className: `scene-mount scene-mount-${variant}` });
}
