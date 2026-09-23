import { createElement, useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// 每行依次是 [x, y, z, 宽, 高, 深, z轴旋转]。
// 想改楼体轮廓时优先改这里；增加一行就是增加一个红砖体块。
const BLOCKS = [
  [-2.55, 2.9, 0.15, 2.7, 1.05, 1.5, -0.06],
  [2.35, 3.15, -0.05, 2.15, 1.1, 1.45, 0.04],
  [-3.0, 1.45, -0.22, 2.4, 1.15, 1.55, 0.08],
  [2.65, 1.65, 0.3, 2.65, 1.0, 1.35, -0.04],
  [-2.15, 0.0, 0.55, 3.1, 1.25, 1.3, -0.02],
  [2.5, 0.25, -0.4, 2.25, 1.25, 1.5, 0.05],
  [-3.05, -1.55, -0.15, 2.35, 1.05, 1.45, 0.03],
  [2.6, -1.25, 0.45, 2.75, 1.15, 1.3, -0.06],
  [-2.3, -3.0, 0.35, 2.85, 1.05, 1.5, 0.04],
  [2.25, -2.75, -0.2, 2.2, 1.15, 1.4, -0.03],
  [-3.55, 3.95, -0.6, 1.45, .9, 1.2, 0.08],
  [3.55, 3.9, .25, 1.35, .85, 1.1, -0.07],
  [-3.65, -.2, -.7, 1.25, .9, 1.25, 0.04],
  [3.75, -1.9, -.55, 1.4, .9, 1.15, -0.05],
  [3.35, -3.75, .2, 1.3, .85, 1.1, 0.08],
];

// Three.js 材质色板。页面 UI 色板在 styles.css 的 :root 中，两处可分别调整。
const palette = {
  brick: new THREE.Color("#a44735"),
  brickDark: new THREE.Color("#70271f"),
  concrete: new THREE.Color("#d2c7bc"),
  glow: new THREE.Color("#ff9d57"),
};

function noiseMaterial(color, roughness = .9) {
  const base = new THREE.Color(color);
  return new THREE.MeshStandardMaterial({
    color: base,
    emissive: base.clone().multiplyScalar(.22),
    emissiveIntensity: 1.15,
    roughness,
    metalness: 0.02,
  });
}

function addWindow(group, position, scale, windowMaterials) {
  const material = new THREE.MeshStandardMaterial({
    color: "#2a0a07",
    emissive: palette.glow,
    emissiveIntensity: .18,
    roughness: .5,
  });
  const window = new THREE.Mesh(new THREE.BoxGeometry(...scale), material);
  window.position.set(...position);
  group.add(window);
  windowMaterials.push(material);
}

function makeBuilding(scene) {
  // building 是完整实体楼；以后替换 GLB 时，可以保留返回值中的交互接口。
  const building = new THREE.Group();
  building.rotation.set(-.045, -.16, -.02);
  building.position.set(.3, -.05, 0);
  building.scale.setScalar(1.12);
  scene.add(building);

  const concrete = noiseMaterial(palette.concrete, .96);
  const brickMaterials = [noiseMaterial(palette.brick, .92), noiseMaterial(palette.brickDark, .95)];
  const metal = new THREE.MeshStandardMaterial({ color: "#4e3d36", roughness: .72, metalness: .08 });
  const windowMaterials = [];
  const blocks = [];

  // 中央浅色混凝土核心筒。
  const core = new THREE.Mesh(new RoundedBoxGeometry(2.1, 8.8, 2, 4, .12), concrete);
  core.position.set(.05, .35, 0);
  core.castShadow = true;
  core.receiveShadow = true;
  building.add(core);

  const slitPositions = [-2.95, -1.45, .05, 1.55, 3.05];
  slitPositions.forEach((y, index) => {
    addWindow(building, [1.07, y + .35, .24], [.055, .26 + (index % 2) * .12, .76], windowMaterials);
  });

  BLOCKS.forEach(([x, y, z, w, h, d, rz], index) => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.z = rz;
    group.userData.home = group.position.clone();
    group.userData.phase = index * .61;
    group.userData.axis = new THREE.Vector3(x, y * .18, (index % 3 - 1) * .42).normalize();
    group.userData.impulse = 0;

    const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, .055), brickMaterials[index % 2]);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const windowCount = index % 3 === 0 ? 3 : 2;
    for (let j = 0; j < windowCount; j += 1) {
      const side = x < 0 ? 1 : -1;
      const wx = side * (w / 2 + .012);
      const wy = (j - (windowCount - 1) / 2) * .28;
      addWindow(group, [wx, wy, .12], [.035, .13, .45], windowMaterials);
      addWindow(
        group,
        [(j - (windowCount - 1) / 2) * .38, .03, d / 2 + .016],
        [.2, .24, .035],
        windowMaterials,
      );
    }

    building.add(group);
    blocks.push(group);
  });

  // 楼梯独立成组，动画里只做极小幅度摆动，避免说话时跟着体块剧烈爆开。
  const stairRoot = new THREE.Group();
  stairRoot.position.z = 1.18;
  building.add(stairRoot);
  const stairGlow = [];

  for (let flight = 0; flight < 5; flight += 1) {
    const direction = flight % 2 === 0 ? 1 : -1;
    const y = -3.05 + flight * 1.45;
    for (let step = 0; step < 7; step += 1) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(.43, .13, .72), concrete);
      mesh.position.set(direction * (-1.33 + step * .22), y + step * .17, 0);
      mesh.castShadow = true;
      stairRoot.add(mesh);
    }
    const landing = new THREE.Mesh(new THREE.BoxGeometry(2.95, .1, .82), metal);
    landing.position.set(0, y + 1.16, 0);
    stairRoot.add(landing);

    const glowMat = new THREE.MeshStandardMaterial({ color: "#31100b", emissive: palette.glow, emissiveIntensity: .12 });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(2.35, .025, .46), glowMat);
    glow.position.set(0, y + 1.1, -.12);
    stairRoot.add(glow);
    stairGlow.push(glowMat);
  }
  windowMaterials.push(...stairGlow);

  // 等待阶段的白色 GLSL 粒子云。count 控制密度，也最影响低端设备性能。
  const particleGeometry = new THREE.BufferGeometry();
  const count = 7600;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - .5) * 9.5;
    const radius = 1.05 + Math.pow(Math.random(), 1.8) * 3.5;
    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(theta) * radius * .65;
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
        float angle = uTime * (.14 + aSeed * .18) + p.y * .08;
        float c = cos(angle); float s = sin(angle);
        p.xz = mat2(c, -s, s, c) * p.xz;
        p += vec3(sin(uTime * .7 + aSeed * 18.) * .16, sin(uTime + aSeed * 11.) * .12, 0.);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.3 + aSeed * 2.5) * (110.0 / -mv.z);
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

export function YuanbaiScene({ phase, level }) {
  const mountRef = useRef(null);
  // 动画循环只创建一次；React 状态通过 ref 注入，避免每次说话都重建 WebGL 场景。
  const stateRef = useRef({ phase, level });
  stateRef.current = { phase, level };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x180506, .031);
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
    camera.position.set(8.2, 3.4, 16.4);
    camera.lookAt(.25, .2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setClearColor(0x180506, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.42;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffe3ce, 0x2a0908, 2.65));
    const key = new THREE.DirectionalLight(0xffd6bd, 5.4);
    key.position.set(7, 10, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.PointLight(0xd3492e, 75, 34, 1.5);
    rim.position.set(-5, .5, 4);
    scene.add(rim);
    const fill = new THREE.PointLight(0xffb57d, 48, 28, 1.4);
    fill.position.set(5.5, 3.5, 8);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(32, 32),
      new THREE.MeshStandardMaterial({ color: 0x180506, roughness: 1, transparent: true, opacity: .7 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4.45;
    floor.receiveShadow = true;
    scene.add(floor);

    const model = makeBuilding(scene);
    let width = 0;
    let height = 0;
    const resize = () => {
      width = mount.clientWidth;
      height = mount.clientHeight;
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
      // 上升快、下降慢，让灯光对重音灵敏，同时在停顿后留下自然余辉。
      smoothedLevel += (voiceLevel - smoothedLevel) * (voiceLevel > smoothedLevel ? .24 : .075);
      afterglow = Math.max(smoothedLevel, afterglow * .974);

      const onset = voiceLevel - previousLevel;
      // onset 是相邻帧音量突增。阈值越低，楼体越容易触发“爆炸式”外推。
      if (currentPhase === "speaking" && onset > .085 && voiceLevel > .15) {
        model.blocks.forEach((block, index) => {
          block.userData.impulse += onset * (1.1 + (index % 4) * .12);
        });
      }
      previousLevel = voiceLevel;

      model.blocks.forEach((block, index) => {
        const data = block.userData;
        data.impulse *= .91;
        const idle = Math.sin(t * .58 + data.phase) * .055;
        // .52 控制持续发声位移，1.8 控制重音瞬间的爆发距离。
        const outward = (smoothedLevel * .52 + data.impulse * 1.8) * (0.72 + (index % 5) * .06);
        const target = data.home.clone().addScaledVector(data.axis, outward);
        target.y += idle;
        block.position.lerp(target, .08);
        block.rotation.x = Math.sin(t * .33 + index) * .008 + smoothedLevel * data.axis.z * .025;
        block.rotation.z += (BLOCKS[index][6] + smoothedLevel * data.axis.x * .018 - block.rotation.z) * .07;
      });

      model.stairRoot.position.y = Math.sin(t * .45) * .012;
      model.stairRoot.rotation.z = Math.sin(t * .3) * .0025;
      // 8.2 是实时语调亮度，2.1 是停顿后的余辉强度。
      const lightPulse = .12 + smoothedLevel * 8.2 + afterglow * 2.1;
      model.windowMaterials.forEach((material, index) => {
        const uneven = .72 + Math.sin(t * 4.1 + index * 1.63) * .18;
        material.emissiveIntensity = lightPulse * uneven;
      });

      // thinking 阶段让实体楼淡出、粒子云淡入；.055 控制溶解速度。
      const thinking = currentPhase === "thinking" ? 1 : 0;
      particleOpacity += (thinking - particleOpacity) * .055;
      model.particleMaterial.uniforms.uTime.value = t;
      model.particleMaterial.uniforms.uOpacity.value = particleOpacity;
      model.particles.visible = particleOpacity > .01;
      model.particles.rotation.y = t * .05;
      model.building.traverse((child) => {
        if (child.material) child.material.opacity = 1 - particleOpacity * .94;
        if (child.material) child.material.transparent = particleOpacity > .01;
      });

      model.building.rotation.y += ((-.16 + pointer.x * .055) - model.building.rotation.y) * .025;
      model.building.rotation.x += ((-.045 - pointer.y * .025) - model.building.rotation.x) * .025;
      camera.position.x += ((8.2 + pointer.x * .2) - camera.position.x) * .018;
      camera.position.y += ((3.4 - pointer.y * .12) - camera.position.y) * .018;
      camera.lookAt(.25, .2, 0);
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
  }, []);

  return createElement("div", { ref: mountRef, className: "scene-mount" });
}
