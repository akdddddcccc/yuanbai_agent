import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { YUANBAI_CONNECTIONS, YUANBAI_COURTYARD, YUANBAI_MASSES } from "../src/yuanbaiModelSpec.js";

// GLTFExporter 在浏览器中使用 FileReader；这个轻量兼容层让同一导出器可在 Node 中生成二进制 GLB。
globalThis.FileReader = class FileReader {
  constructor() {
    this.result = null;
    this.onload = null;
    this.onloadend = null;
  }

  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onload?.({ target: this });
    this.onloadend?.({ target: this });
  }

  async readAsDataURL(blob) {
    const buffer = Buffer.from(await blob.arrayBuffer());
    this.result = `data:${blob.type};base64,${buffer.toString("base64")}`;
    this.onload?.({ target: this });
    this.onloadend?.({ target: this });
  }
};

const materials = {
  brick: new THREE.MeshStandardMaterial({ name: "YB_Warm_Terracotta_Brick", color: 0xad594a, roughness: .95 }),
  brickDark: new THREE.MeshStandardMaterial({ name: "YB_Dark_Terracotta_Brick", color: 0x7f3d36, roughness: .97 }),
  concrete: new THREE.MeshStandardMaterial({ name: "YB_Board_Form_Concrete", color: 0xa7a59f, roughness: .98 }),
  concreteLight: new THREE.MeshStandardMaterial({ name: "YB_Exposed_Concrete", color: 0xc7c1b8, roughness: .96 }),
  metal: new THREE.MeshStandardMaterial({ name: "YB_Rough_Steel", color: 0x33383a, roughness: .82, metalness: .3 }),
  window: new THREE.MeshStandardMaterial({
    name: "YB_Warm_Window",
    color: 0x1c1512,
    emissive: 0xff9c55,
    emissiveIntensity: .5,
    roughness: .4,
  }),
  weatheredMetal: new THREE.MeshStandardMaterial({ name: "YB_Subtle_Rust_Metal", color: 0x594a43, roughness: .87, metalness: .14 }),
  roofPaver: new THREE.MeshStandardMaterial({ name: "YB_Terracotta_Roof_Paver", color: 0xc87f69, roughness: .92 }),
  roofGlass: new THREE.MeshStandardMaterial({ name: "YB_Roof_Glass", color: 0x91a5a5, roughness: .28, metalness: .08 }),
  grass: new THREE.MeshStandardMaterial({ name: "YB_Green_Roof", color: 0x537048, roughness: 1 }),
  soil: new THREE.MeshStandardMaterial({ name: "YB_Soil", color: 0x342822, roughness: 1 }),
};

function footprintGeometry(points, height) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function addWindow(group, x, y, z, width = .25) {
  const window = new THREE.Mesh(new THREE.BoxGeometry(width, .18, .035), materials.window);
  window.name = "warm_recessed_window";
  window.position.set(x, y, z);
  group.add(window);
}

function cylinderBetween(start, end, radius, material) {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 8), material);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  return mesh;
}

const scene = new THREE.Scene();
scene.name = "Yuanbai_Brutalist_Web_Model";

YUANBAI_MASSES.forEach((mass, index) => {
  const group = new THREE.Group();
  group.name = `YB_mass_${mass.id}`;
  group.position.set(...mass.position);
  group.rotation.y = mass.rotation;
  group.userData = { role: "animated_mass", source: "元白楼大型参考.3dm" };

  const [width, height, depth] = mass.size;
  const geometry = mass.footprint
    ? footprintGeometry(mass.footprint, height)
    : new THREE.BoxGeometry(width, height, depth);
  const body = new THREE.Mesh(geometry, materials[mass.finish]);
  body.name = `${group.name}_body`;
  if (!mass.footprint) body.position.y = height / 2;
  group.add(body);

  if (mass.footprint) {
    for (let col = 0; col < 5; col += 1) addWindow(group, -2.25 + col * .55, .62, 2.035, .28);
    const cap = new THREE.Mesh(footprintGeometry(mass.footprint, .08), materials.concreteLight);
    cap.name = "exposed_concrete_roof_cap";
    cap.position.y = height;
    group.add(cap);
    const westGarden = new THREE.Mesh(new THREE.BoxGeometry(1.55, .045, 2.65), materials.grass);
    westGarden.name = "green_roof_west_wing";
    westGarden.position.set(-1.86, height + .095, -.05);
    group.add(westGarden);
    const southGarden = new THREE.Mesh(new THREE.BoxGeometry(2.25, .045, 1.25), materials.grass);
    southGarden.name = "green_roof_south_wing";
    southGarden.position.set(1.48, height + .095, .82);
    group.add(southGarden);
  } else {
    const rows = Math.max(1, Math.min(4, Math.floor((height - .28) / .58)));
    for (let row = 0; row < rows; row += 1) {
      const y = .34 + row * ((height - .58) / Math.max(1, rows - 1));
      [-.34, 0, .34].forEach((x, col) => {
        if ((row + col + index) % 5 !== 0) addWindow(group, x, y, depth / 2 + .025);
      });
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 1.055, .09, depth * 1.055), materials.concreteLight);
    roof.name = "exposed_concrete_roof_cap";
    roof.position.y = height + .045;
    group.add(roof);
    if (height < 3.1) {
      const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(width * .82, .035, depth * .8), materials.roofPaver);
      roofDeck.name = "terracotta_roof_deck";
      roofDeck.position.y = height + .108;
      group.add(roofDeck);
      const gardenWidth = width * (index % 2 ? .38 : .62);
      const garden = new THREE.Mesh(new THREE.BoxGeometry(gardenWidth, .038, depth * .64), materials.grass);
      garden.name = "green_roof_strip";
      garden.position.set((width * .72 - gardenWidth) * (index % 2 ? -.25 : .2), height + .135, 0);
      group.add(garden);
    }
    const fin = new THREE.Mesh(new THREE.BoxGeometry(.12, height * .78, .16), materials.concreteLight);
    fin.name = "brutalist_vertical_fin";
    fin.position.set(width * .28 * (index % 2 ? 1 : -1), height * .48, depth / 2 + .1);
    group.add(fin);
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
    if (mass.finish === "concrete" && index % 2 === 1) {
      const rustJoint = new THREE.Mesh(new THREE.BoxGeometry(.035, height * .34, .012), materials.weatheredMetal);
      rustJoint.name = "subtle_rust_runoff";
      rustJoint.position.set(width * .27, height * .7, depth / 2 + .047);
      group.add(rustJoint);
    }
    if (mass.id === "central-tower") {
      const glass = new THREE.Mesh(new THREE.BoxGeometry(width * .58, .07, depth * .58), materials.roofGlass);
      glass.name = "central_glass_roof";
      glass.position.y = height + .19;
      group.add(glass);
    }
  }
  scene.add(group);
});

const stairs = new THREE.Group();
stairs.name = "YB_stable_stairs_and_bridges";
stairs.userData = { role: "stable_connector" };
YUANBAI_CONNECTIONS.forEach((connection) => {
  const root = new THREE.Group();
  root.name = `YB_stair_${connection.id}`;
  const start = new THREE.Vector3(...connection.from);
  const end = new THREE.Vector3(...connection.to);
  const horizontal = new THREE.Vector3(end.x - start.x, 0, end.z - start.z);
  const run = Math.max(.01, horizontal.length());
  const count = Math.max(5, Math.ceil(Math.max(run * 9, Math.abs(end.y - start.y) * 10)));
  const rotationY = Math.atan2(horizontal.x, horizontal.z);
  for (let i = 0; i < count; i += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(connection.width, .07, run / count * 1.18), materials.concreteLight);
    step.name = `step_${String(i + 1).padStart(2, "0")}`;
    step.position.copy(start.clone().lerp(end, (i + .5) / count));
    step.rotation.y = rotationY;
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
  stairs.add(root);
});
scene.add(stairs);

const courtyard = new THREE.Group();
courtyard.name = "YB_circular_courtyard_3_brick_2_grass";
courtyard.position.set(...YUANBAI_COURTYARD.position);
const soil = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, .035, 64), materials.soil);
soil.position.y = -.01;
courtyard.add(soil);
YUANBAI_COURTYARD.brickRadii.forEach((radius, index) => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .065, 6, 72), index % 2 ? materials.brickDark : materials.brick);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = .035 + index * .018;
  courtyard.add(ring);
});
YUANBAI_COURTYARD.grassRadii.forEach((radius, index) => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .085, 6, 64), materials.grass);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = .048 + index * .018;
  courtyard.add(ring);
});
scene.add(courtyard);

scene.updateMatrixWorld(true);
const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(scene, {
  binary: true,
  onlyVisible: true,
  truncateDrawRange: true,
  maxTextureSize: 2048,
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "public", "models");
await mkdir(outputDir, { recursive: true });
const output = path.join(outputDir, "yuanbai-brutalist-v1.glb");
await writeFile(output, Buffer.from(glb));
console.log(`Generated ${path.relative(root, output)} (${Buffer.byteLength(Buffer.from(glb))} bytes)`);
