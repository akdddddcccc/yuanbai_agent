import { createElement, useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// 更换模型时改此路径即可；材质、贴图和 UV 随 GLB 一起加载。
const MODEL_URL = `${import.meta.env.BASE_URL}models/yuanbai-perception-sculpture.glb`;
const FALLBACK_URL = `${import.meta.env.BASE_URL}brand/yuanbai-mark.svg`;
// 网页灯光下的轻微压色，避免灰墙泛白、红砖变成浅粉；原始贴图保留在 GLB。
const MATERIAL_TONES = {
  YB_Site_Cast_Concrete: "#bcb8b0",
  YB_Site_Red_Brick: "#d8bab0",
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
    renderer.toneMappingExposure = .98;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    mount.dataset.state = "loading";

    // 金属需要可反射的环境：只给材质提供柔光，不把房间画到黑色背景里。
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(room, .04);
    scene.environment = environment.texture;
    scene.environmentIntensity = .55;
    room.dispose();
    pmrem.dispose();

    // 实际照明只负责模型明暗；可见光束在 CSS，避免叠出硬边三角形。
    scene.add(new THREE.HemisphereLight("#dfdfda", "#201714", .85));
    const key = new THREE.DirectionalLight("#ffe7ce", 2.5);
    key.position.set(-3.5, 8, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#a8bac7", 1.1);
    fill.position.set(5, 3, 4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight("#bc5b40", 2.0);
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
          const tone = MATERIAL_TONES[material.name];
          if (tone) material.color.set(tone);
          // 暗色钢架只提高反射响应，保留实拍贴图的色彩和磨损。
          if (material.metalness > .5) material.envMapIntensity = 2.5;
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
      key.intensity = 2.5 + Math.sin(time * Math.PI / 4) * .12 * motion;
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
