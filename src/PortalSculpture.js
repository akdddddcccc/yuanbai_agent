import { createElement, useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// 更换模型时改此路径即可；材质、贴图和 UV 随 GLB 一起加载。
// 同名文件替换后更新版本标记，避免浏览器继续使用旧模型缓存。
const MODEL_URL = `${import.meta.env.BASE_URL}models/yuanbai-perception-sculpture.glb?v=e45928b1b882`;
const FALLBACK_URL = `${import.meta.env.BASE_URL}brand/yuanbai-mark.svg`;
// 首页照明统一在这里调整。曝光影响整体；主光塑形，环境/补光只保留暗部细节。
// 不给实拍颜色贴图额外染色，避免红砖变浅粉、混凝土变暖白。
const LIGHTING = {
  exposure: .78,
  environment: .24,
  hemisphere: .25,
  key: 1.25,
  fill: .38,
  rim: .55,
  breath: .035,
};
// 对应 2026-09-25 用户手工 GLB 的导出材质名；换模型时只需更新此表。
// 粗糙度是表面反光宽度，不会凭空生成凹凸；已导出的法线/粗糙度贴图优先保留。
const MATERIAL_RESPONSE = {
  "Rusty iron": { roughness: .82, metalness: .22, opaque: true },
  "Material.001": { roughness: .9, metalness: 0 }, // 红砖
  "材质.005": { roughness: .9, metalness: 0 }, // 红砖副本
  "材质.001": { roughness: .96, metalness: 0 }, // 混凝土
  "材质.006": { roughness: .96, metalness: 0 }, // 混凝土副本
};

function disposeModel(root) {
  const textures = new Set();
  const materials = new Set();
  const geometries = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) {
      for (const material of [].concat(object.material)) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value?.isTexture) textures.add(value);
        }
      }
    }
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

export function PortalSculpture({ projectionRef }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const compactMedia = window.matchMedia("(max-width: 820px)");
    const reducedMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 80);
    camera.position.set(0, 10.6, 7.1);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      mount.dataset.state = "fallback";
      return undefined;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = LIGHTING.exposure;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    mount.dataset.state = "loading";

    // 金属需要可反射的环境：只给材质提供柔光，不把房间画到黑色背景里。
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(room, .04);
    scene.environment = environment.texture;
    scene.environmentIntensity = LIGHTING.environment;
    room.dispose();
    pmrem.dispose();

    // 实际照明只负责模型明暗；可见光束在 CSS，避免叠出硬边三角形。
    scene.add(new THREE.HemisphereLight("#dfdfda", "#201c19", LIGHTING.hemisphere));
    const key = new THREE.DirectionalLight("#fff1e1", LIGHTING.key);
    key.position.set(-3.5, 8, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#bdc9d2", LIGHTING.fill);
    fill.position.set(5, 3, 4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight("#cfb9a6", LIGHTING.rim);
    rim.position.set(1.5, 4, -5);
    scene.add(rim);
    const group = new THREE.Group();
    scene.add(group);
    let model = null;
    let alive = true;
    let frame = 0;
    let startTime = 0;
    let lastProjection = -Infinity;
    let halfWidth = 3.8;
    let halfHeight = 2.6;
    const pointer = { x: 0, y: 0 };
    const projection = projectionRef.current;
    const context = projection?.getContext("2d");

    const fitCamera = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      const aspect = width / height;
      const vertical = Math.max(halfHeight, halfWidth / aspect) * 1.14;
      camera.left = -vertical * aspect;
      camera.right = vertical * aspect;
      camera.top = vertical;
      camera.bottom = -vertical;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, compactMedia.matches ? 1.5 : 2));
      renderer.setSize(width, height, false);
      // 投影只用 256px 低分辨率画布，维持主画面的比例，不额外创建 WebGL 上下文。
      if (projection) {
        projection.width = 256;
        projection.height = Math.max(1, Math.round(256 / aspect));
      }
      lastProjection = -Infinity;
    };
    const observer = new ResizeObserver(fitCamera);
    observer.observe(mount);
    fitCamera();

    new GLTFLoader().load(MODEL_URL, (gltf) => {
      if (!alive) { disposeModel(gltf.scene); return; }
      model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      model.position.sub(bounds.getCenter(new THREE.Vector3()));
      model.traverse((object) => {
        if (!object.isMesh) return;
        for (const material of [].concat(object.material)) {
          if (material.map) material.map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
          const response = MATERIAL_RESPONSE[material.name];
          if (response) {
            if (!material.roughnessMap) material.roughness = response.roughness;
            if (!material.metalnessMap) material.metalness = response.metalness;
            // 当前钢材贴图为无 alpha 的 RGB 图片，BLEND 是导出残留。
            // 仅修正这个已确认的不透明材质，避免钢架前后透明排序错误。
            if (response.opaque && material.opacity === 1) {
              material.transparent = false;
              material.depthWrite = true;
            }
          }
        }
      });
      group.add(model);
      group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(group);
      halfWidth = 0;
      halfHeight = 0;
      // 在相机空间测量模型，避免换 GLB 后在竖屏中被裁断。
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const p = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
            halfWidth = Math.max(halfWidth, Math.abs(p.x));
            halfHeight = Math.max(halfHeight, Math.abs(p.y));
          }
        }
      }
      fitCamera();
      mount.dataset.state = "ready";
    }, undefined, () => {
      if (alive) mount.dataset.state = "fallback";
    });

    const onPointerMove = (event) => {
      if (!finePointer.matches || reducedMedia.matches) return;
      pointer.x = (event.clientX / window.innerWidth - .5) * 2;
      pointer.y = (event.clientY / window.innerHeight - .5) * 2;
    };
    const resetPointer = () => { pointer.x = 0; pointer.y = 0; };
    const onMotionChange = () => { resetPointer(); lastProjection = -Infinity; };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", resetPointer);
    document.documentElement.addEventListener("pointerleave", resetPointer);
    reducedMedia.addEventListener("change", onMotionChange);

    const render = (timestamp) => {
      frame = requestAnimationFrame(render);
      if (document.hidden) return;
      if (!startTime) startTime = timestamp;
      const time = (timestamp - startTime) / 1000;
      const motion = reducedMedia.matches ? 0 : 1;
      // 整组浮动，构造接缝保持相对稳定，防止钢架与两个体块分别运动造成穿模。
      group.position.y = Math.sin(time * .55) * .075 * motion;
      group.rotation.y += (pointer.x * .08 * motion - group.rotation.y) * .06;
      group.rotation.x += (-pointer.y * .035 * motion - group.rotation.x) * .06;
      key.intensity = LIGHTING.key + Math.sin(time * Math.PI / 4) * LIGHTING.breath * motion;
      renderer.render(scene, camera);
      // 主渲染后立即复制同一帧；压扁、模糊与漂移交给 CSS，每秒只更新 6 次。
      if (context && model && timestamp - lastProjection > (motion ? 160 : 1000)) {
        context.clearRect(0, 0, projection.width, projection.height);
        context.drawImage(renderer.domElement, 0, 0, projection.width, projection.height);
        lastProjection = timestamp;
      }
    };
    frame = requestAnimationFrame(render);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", resetPointer);
      document.documentElement.removeEventListener("pointerleave", resetPointer);
      reducedMedia.removeEventListener("change", onMotionChange);
      if (model) disposeModel(model);
      environment.dispose();
      context?.clearRect(0, 0, projection.width, projection.height);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [projectionRef]);

  return createElement("div", { ref: mountRef, className: "portal-sculpture", "aria-hidden": "true" },
    createElement("img", { className: "portal-sculpture-fallback", src: FALLBACK_URL, alt: "" }),
  );
}
