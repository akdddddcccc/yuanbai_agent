# Replacing the procedural Yuanbai model

The visual interaction is intentionally separated from the current procedural geometry. A future GLB can replace the generated masses while keeping the same four scene roles:

- `blocks`: the movable red-brick volumes. Each block receives idle drift and a controlled speech impulse.
- `stairRoot`: stairs and connecting bridges. This root stays visually stable and only receives a very small breathing motion.
- `windowMaterials`: emissive materials inside windows, gaps, and stair undersides. Their intensity follows voice energy and retains a short afterglow during pauses.
- `particles`: the thinking-state point cloud. It dissolves and rebuilds the model while the API response is pending.

For a replacement GLB, give nodes a `userData.role` value of `block`, `stair`, or `light`. Load the file in `YuanbaiScene.js`, collect those nodes into the same arrays, and keep the animation loop unchanged.
