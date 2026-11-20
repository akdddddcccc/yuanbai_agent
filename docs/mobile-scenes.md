# Mobile building textures

Touch devices, viewports up to 820 px, and Save-Data connections use fixed-view WebP images. Selection is frozen for the component lifetime, including orientation changes. Desktop scene modules remain lazy imports; no mobile GLB/precise chunk/preloader or Three.js loader is requested.

The building is rendered from the existing precise model. A depth-tested glass-only pass defines visible window holes. The body image has those pixels removed; a warm window image behind it varies with the existing speaking phase and audio level. Reduced motion keeps the light steady. Image errors keep text and voice controls available without falling back to the large model.

## Assets and reproduction

- building.webp: 41,804 bytes
- windows.webp: 5,756 bytes
- portal.webp: 45,080 bytes
- Replaced dialogue source model: 18,647,460 bytes

Run npm ci, install the CI-only playwright/sharp versions listed in .github/workflows/mobile-scenes.yml, install Chromium, then run node scripts/bake-mobile-scenes.mjs, npm run build and node scripts/test-mobile-scenes.mjs.

The bake verifies that actual React audio-level props visibly change window pixels without illuminating walls. Browser checks cover portrait/landscape navigation, no desktop model requests, rotation, image failures, and successful desktop model loading. Screenshots and a resource report are under artifacts/mobile-scenes.

The workflow only writes generated assets to the feature branch. It does not publish to the school server. Deploy using the school's existing build base path and API/queue environment settings; do not copy personal-host API defaults onto that server. CI localhost transfer totals are not real WeChat load times.
