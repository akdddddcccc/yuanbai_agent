// Choose once per mount: rotating a phone must never start a 19 MB download.
export function prefersLightweightScene(view = globalThis) {
  return Boolean(view.matchMedia?.('(pointer: coarse)').matches
    || view.matchMedia?.('(max-width: 820px)').matches
    || view.navigator?.connection?.saveData);
}
