import { createElement, useEffect, useRef } from "react";
import * as THREE from "three";
import { loadPreciseModel, disposeModel } from "./preciseModel.js";
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

// 楼体不再落在可见地面上。这个柔和的径向纹理只在楼体下方形成一块遥远投影，
// 保留空间尺度感，同时让画面边缘自然消失在深色背景中。
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
  root.userData.anchorId = connection.anchor;
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
  return root;
}

function makeParticleRandom(seed = 41729) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeStructureParticleCloud(building, bounded = false) {
  const random = makeParticleRandom();
  const triangles = [];
  const edgeSegments = [];
  const structureVertices = new Map();
  const buildingInverse = new THREE.Matrix4();

  building.updateMatrixWorld(true);
  buildingInverse.copy(building.matrixWorld).invert();

  // Cloud Form 的核心做法：面负责体量，硬边负责轮廓，端点负责节点辉光。
  // 这里直接从当前 Three.js 楼体采样，因此修改建筑体块后，粒子形态会自动同步。
  building.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position) return;
    const geometry = object.geometry;
    const positions = geometry.attributes.position;
    const transform = new THREE.Matrix4().multiplyMatrices(buildingInverse, object.matrixWorld);
    const index = geometry.index;
    const triangleCount = index ? index.count / 3 : positions.count / 3;

    const stride = bounded ? Math.max(1, Math.ceil(triangleCount / 180)) : 1;
    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += stride) {
      const aIndex = index ? index.getX(triangleIndex * 3) : triangleIndex * 3;
      const bIndex = index ? index.getX(triangleIndex * 3 + 1) : triangleIndex * 3 + 1;
      const cIndex = index ? index.getX(triangleIndex * 3 + 2) : triangleIndex * 3 + 2;
      const a = new THREE.Vector3().fromBufferAttribute(positions, aIndex).applyMatrix4(transform);
      const b = new THREE.Vector3().fromBufferAttribute(positions, bIndex).applyMatrix4(transform);
      const c = new THREE.Vector3().fromBufferAttribute(positions, cIndex).applyMatrix4(transform);
      const area = new THREE.Triangle(a, b, c).getArea();
      if (area > 1e-7) triangles.push({ a, b, c, area: area * stride });
    }

    // EdgesGeometry 只保留达到阈值的折线，避免把三角剖分的内部对角线误当成建筑结构。
    // Bound edge extraction to a low-detail silhouette proxy for the high-detail GLB.
    geometry.computeBoundingBox();
    const proxy = bounded ? new THREE.BoxGeometry(...geometry.boundingBox.getSize(new THREE.Vector3()).toArray()) : null;
    if (proxy) proxy.translate(...geometry.boundingBox.getCenter(new THREE.Vector3()).toArray());
    const hardEdges = new THREE.EdgesGeometry(proxy || geometry, 32);
    proxy?.dispose();
    const edgePositions = hardEdges.attributes.position;
    for (let edgeIndex = 0; edgeIndex < edgePositions.count; edgeIndex += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(edgePositions, edgeIndex).applyMatrix4(transform);
      const b = new THREE.Vector3().fromBufferAttribute(edgePositions, edgeIndex + 1).applyMatrix4(transform);
      const length = a.distanceTo(b);
      if (length < 1e-5) continue;
      edgeSegments.push({ a, b, length });
      [a, b].forEach((point) => {
        const key = `${Math.round(point.x * 80)}/${Math.round(point.y * 80)}/${Math.round(point.z * 80)}`;
        if (!structureVertices.has(key)) structureVertices.set(key, point.clone());
      });
    }
    hardEdges.dispose();
  });

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
  const faceCount = compact ? 7200 : 10400;
  const edgeCount = compact ? 3100 : 4600;
  const vertexCount = compact ? 720 : 1200;
  const count = faceCount + edgeCount + vertexCount;
  const pointPositions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const kinds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const lights = new Float32Array(count);
  const responses = new Float32Array(count);
  const directions = new Float32Array(count * 3);
  const center = new THREE.Vector3(0, 1.45, .1);

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
    direction.y += .25 + random() * .45;
    direction.x += (random() - .5) * .38;
    direction.z += (random() - .5) * .38;
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
    point.add(new THREE.Vector3(random() - .5, random() - .5, random() - .5).multiplyScalar(.018));
    put(i, point, 0, .72 + random() * .6, .16 + random() * .18, .34 + random() * .38);
  }

  for (let i = 0; i < edgeCount; i += 1) {
    const edge = edgeSegments[pickWeighted(cumulativeEdges, totalEdgeLength)];
    let t = random();
    if (random() < .54) t = random() < .5 ? Math.pow(random(), 2.1) : 1 - Math.pow(random(), 2.1);
    const corner = Math.max(Math.exp(-Math.pow(t / .2, 2)), Math.exp(-Math.pow((1 - t) / .2, 2)));
    const point = edge.a.clone().lerp(edge.b, t);
    point.add(new THREE.Vector3(random() - .5, random() - .5, random() - .5).multiplyScalar(.028 + corner * .035));
    put(faceCount + i, point, 1, 1.05 + corner * .8 + random() * .55, .44 + corner * .28, .14 + random() * .2);
  }

  for (let i = 0; i < vertexCount; i += 1) {
    const vertex = vertices[Math.floor(random() * vertices.length)].clone();
    vertex.add(new THREE.Vector3(random() - .5, random() - .5, random() - .5).multiplyScalar(.075 * Math.pow(random(), 2)));
    put(faceCount + edgeCount + i, vertex, 2, 1.8 + random() * 1.45, .72 + random() * .24, .035 + random() * .08);
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(pointPositions, 3));
  particleGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  particleGeometry.setAttribute("aKind", new THREE.BufferAttribute(kinds, 1));
  particleGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  particleGeometry.setAttribute("aLight", new THREE.BufferAttribute(lights, 1));
  particleGeometry.setAttribute("aResponse", new THREE.BufferAttribute(responses, 1));
  particleGeometry.setAttribute("aDirection", new THREE.BufferAttribute(directions, 3));

  const particleMaterial = new THREE.ShaderMaterial({
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
        vec3 p = position + aDirection * scatter * (1.15 + aSeed * 2.65 + aKind * .28);
        float orbit = (aSeed - .5) * scatter * 1.15;
        float angle = orbit + uTime * (.05 + aSeed * .045) * scatter;
        float c = cos(angle);
        float s = sin(angle);
        p.xz = mat2(c, -s, s, c) * p.xz;
        p += vec3(
          sin(uTime * .72 + aSeed * 31.0),
          cos(uTime * .58 + aSeed * 23.0),
          sin(uTime * .66 + aSeed * 17.0)
        ) * (.012 + scatter * .16);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (72.0 / max(1.0, -mv.z));
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
        vec3 edgeColor = vec3(1.0, .58, .34);
        vec3 nodeColor = vec3(1.0, .78, .52);
        vec3 color = vKind < .5 ? faceColor : (vKind < 1.5 ? edgeColor : nodeColor);
        gl_FragColor = vec4(color, halo * vAlpha * uOpacity);
      }`,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.name = "YB_structure_particle_memory";
  particles.frustumCulled = false;
  particles.visible = false;
  building.add(particles);
  return { particles, particleMaterial };
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
  const blocksById = new Map();

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
    blocksById.set(mass.id, group);
  });

  const stairRoot = new THREE.Group();
  stairRoot.name = "YB_stable_stairs_and_bridges";
  const stairs = YUANBAI_CONNECTIONS.map((connection) => {
    const stair = addStairConnection(stairRoot, connection, materials);
    const anchorBlock = blocksById.get(connection.anchor);
    stair.userData.anchorBlock = anchorBlock;
    stair.userData.anchorHome = anchorBlock?.userData.home.clone();
    return stair;
  });
  building.add(stairRoot);
  addCourtyard(building, materials);
  const { particles, particleMaterial } = makeStructureParticleCloud(building);

  return { building, blocks, stairRoot, stairs, windowMaterials, particles, particleMaterial };
}

export function YuanbaiScene({ phase, level, variant = "dialogue" }) {
  const mountRef = useRef(null);
  const stateRef = useRef({ phase, level });
  stateRef.current = { phase, level };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b0203, .034);
    const camera = new THREE.PerspectiveCamera(31, 1, .1, 100);
    const cameraHome = variant === "portal"
      ? new THREE.Vector3(10.8, 9.6, 16.8)
      : new THREE.Vector3(11.8, 8.7, 17.5);
    let cameraScale = 1;
    const lookAt = new THREE.Vector3(0, 1.48, .3);
    camera.position.copy(cameraHome);
    camera.lookAt(lookAt);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x180506, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .88;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffddc7, 0x120304, 1.08);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffd3b9, 2.15);
    key.position.set(8, 13, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    scene.add(key);
    const rim = new THREE.PointLight(0xc73d2a, 17, 32, 1.55);
    rim.position.set(-6, 3, 5);
    scene.add(rim);
    const fill = new THREE.PointLight(0xffa76c, 9, 28, 1.45);
    fill.position.set(6, 5, 8);
    scene.add(fill);

    const projectionMaterial = new THREE.MeshBasicMaterial({
      map: makeDistantProjectionTexture(),
      color: 0xd95e3d,
      transparent: true,
      opacity: .075,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const projection = new THREE.Mesh(new THREE.PlaneGeometry(16, 11), projectionMaterial);
    projection.name = "YB_distant_voice_projection";
    projection.rotation.x = -Math.PI / 2;
    projection.position.set(.2, -2.45, .45);
    scene.add(projection);

    let model = makeBuilding(scene);
    let disposed = false;
    mount.dataset.model = "procedural";
    const legacy = new URLSearchParams(window.location.search).get("model") === "legacy";
    if (!legacy && variant === "dialogue") {
      mount.dataset.model = "loading";
      loadPreciseModel(makeStructureParticleCloud).then(next => {
        if (disposed) { disposeModel(next.building); return; }
        scene.remove(model.building);
        disposeModel(model.building);
        model = next;
        model.building.position.y = buildingHomeY;
        scene.add(model.building);
        mount.dataset.model = "precise";
        mount.dataset.blocks = String(model.blocks.length);
      }).catch(error => {
        if (disposed) return;
        mount.dataset.model = "fallback";
        console.error("Precise model loading failed; using original architecture", error);
      });
    }
    if (variant === "portal") model.building.scale.setScalar(1.04);
    const buildingHomeY = variant === "portal" ? .48 : .72;
    model.building.position.y = buildingHomeY;

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      if (variant === "dialogue") {
        // 以常见笔记本窗口为基准，让大屏楼体更饱满，较矮窗口仍保留完整轮廓。
        cameraScale = 1 / THREE.MathUtils.clamp(Math.min(width / 960, height / 680), .78, 1.18);
        camera.position.copy(cameraHome).multiplyScalar(cameraScale);
      }
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
    let entityOpacity = 1;
    let particleOpacity = 0;
    let particleFormation = 0;
    let wasThinking = false;
    let thinkingStartedAt = 0;
    let metricsStartedAt = performance.now(), metricsFrames = 0;

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
        const idle = Math.sin(t * .43 + data.phase) * .082
          + Math.cos(t * .21 + data.phase * 1.7) * .018;
        const outward = (smoothedLevel * .62 + data.impulse * 2.0) * (.78 + (index % 5) * .055);
        const target = data.home.clone().addScaledVector(data.axis, outward);
        target.y += idle;
        block.position.lerp(target, .08);
        block.rotation.x = Math.sin(t * .31 + index) * .006 + smoothedLevel * data.axis.z * .018;
        block.rotation.z = Math.cos(t * .29 + index * .7) * .004 + smoothedLevel * data.axis.x * .016;
        block.rotation.y += (data.baseRotation + smoothedLevel * data.axis.x * .025 - block.rotation.y) * .07;
      });

      model.stairs.forEach((stair) => {
        const { anchorBlock, anchorHome } = stair.userData;
        if (!anchorBlock || !anchorHome) return;
        stair.position.copy(anchorBlock.position).sub(anchorHome);
      });
      const lightPulse = .035 + smoothedLevel * 8.4 + afterglow * 1.8;
      model.windowMaterials.forEach((material, index) => {
        const uneven = .72 + Math.sin(t * 4.0 + index * 1.47) * .18;
        material.emissiveIntensity = lightPulse * uneven;
      });

      // 常态保持克制；只有元白开口时，主光、边缘光和远处投影才一起抬升。
      const speechGlow = Math.min(1, smoothedLevel * 1.35 + afterglow * .36);
      ambient.intensity += ((1.08 + speechGlow * .42) - ambient.intensity) * .08;
      key.intensity += ((2.15 + speechGlow * 2.8) - key.intensity) * .09;
      rim.intensity += ((17 + speechGlow * 54) - rim.intensity) * .1;
      fill.intensity += ((9 + speechGlow * 31) - fill.intensity) * .1;
      projectionMaterial.opacity += ((.06 + speechGlow * .19) - projectionMaterial.opacity) * .08;
      const projectionScale = 1 + speechGlow * .1 + Math.sin(t * .82) * .008;
      projection.scale.set(projectionScale, projectionScale, 1);

      const thinking = currentPhase === "thinking";
      if (thinking && !wasThinking) {
        thinkingStartedAt = t;
        entityOpacity = 1;
        particleOpacity = 0;
        particleFormation = 0;
      }
      if (thinking) {
        const transitionTime = t - thinkingStartedAt;
        const dissolveProgress = THREE.MathUtils.clamp(transitionTime / .26, 0, 1);
        const easedDissolve = dissolveProgress * dissolveProgress * (3 - 2 * dissolveProgress);
        entityOpacity = 1 - easedDissolve;

        // 先让实体彻底隐形，再启动粒子；两种表现不会同时叠在同一空间里。
        if (dissolveProgress >= 1) {
          particleOpacity += (1 - particleOpacity) * .075;
          particleFormation = 1 - Math.exp(-(transitionTime - .26) * 1.65);
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
      model.particleMaterial.uniforms.uTime.value = t;
      model.particleMaterial.uniforms.uOpacity.value = particleOpacity;
      model.particleMaterial.uniforms.uFormation.value = particleFormation;
      model.particles.visible = particleOpacity > .01;
      model.particles.rotation.y = Math.sin(t * .19) * .055 * (1 - particleFormation);
      model.building.traverse((child) => {
        if (!child.material || child === model.particles) return;
        [].concat(child.material).forEach(material => {
          material.userData.baseOpacity ??= material.opacity;
          material.userData.baseTransparent ??= material.transparent;
          material.opacity = material.userData.baseOpacity * entityOpacity;
          const transparent = material.userData.baseTransparent || entityOpacity < .999;
          if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
        });
        child.visible = entityOpacity > .001;
      });

      model.building.rotation.y += ((-.12 + pointer.x * .17) - model.building.rotation.y) * .032;
      model.building.rotation.x += ((pointer.y * -.058) - model.building.rotation.x) * .032;
      model.building.position.y += ((buildingHomeY + Math.sin(t * .31) * .062) - model.building.position.y) * .045;
      camera.position.x += ((cameraHome.x * cameraScale + pointer.x * .62 * cameraScale) - camera.position.x) * .024;
      camera.position.y += ((cameraHome.y * cameraScale - pointer.y * .38 * cameraScale) - camera.position.y) * .024;
      camera.lookAt(lookAt);
      renderer.render(scene, camera);
      metricsFrames += 1;
      if (now - metricsStartedAt >= 500) {
        mount.dataset.drawCalls = String(renderer.info.render.calls);
        mount.dataset.triangles = String(renderer.info.render.triangles);
        mount.dataset.phase = currentPhase;
        mount.dataset.fps = String(Math.round(metricsFrames * 1000 / (now - metricsStartedAt)));
        mount.dataset.firstBlockOffset = model.blocks[0]?.position.distanceTo(model.blocks[0].userData.home).toFixed(4) || "0";
        mount.dataset.particleOpacity = particleOpacity.toFixed(3);
        metricsStartedAt = now; metricsFrames = 0;
      }
    };
    frame = requestAnimationFrame(animate);

    return () => {
      disposed = true;
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
