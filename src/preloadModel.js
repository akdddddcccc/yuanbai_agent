export function preloadModel() {
  return import(/* @vite-ignore */ `${import.meta.env.BASE_URL}model-preload.js`)
    .then(module => module.preloadPreciseModel());
}
