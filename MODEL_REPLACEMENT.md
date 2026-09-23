# Replacing the procedural Yuanbai model

The visual interaction is intentionally separated from the current procedural geometry. A future GLB can replace the generated masses while keeping the same four scene roles:

- `blocks`: the movable red-brick volumes. Each block receives idle drift and a controlled speech impulse.
- `stairRoot`: stairs and connecting bridges. This root stays visually stable and only receives a very small breathing motion.
- `windowMaterials`: emissive materials inside windows, gaps, and stair undersides. Their intensity follows voice energy and retains a short afterglow during pauses.
- `particles`: the thinking-state point cloud. It dissolves and rebuilds the model while the API response is pending.

The current editable export is `public/models/yuanbai-brutalist-v1.glb`. It uses these names:

- `YB_mass_*`: the 12 animated masses, with `userData.role` set to `animated_mass`.
- `YB_stable_stairs_and_bridges`: the five stable connections, with `userData.role` set to `stable_connector`.
- `warm_recessed_window`: emissive window geometry.
- `YB_circular_courtyard_3_brick_2_grass`: the courtyard landscape.

When replacing the GLB in Blender or Rhino, preserve these node prefixes. Load the file in `YuanbaiScene.js`, collect the named nodes into the same arrays, and keep the animation loop unchanged. Run `npm run model:glb` to regenerate the current reference export from `src/yuanbaiModelSpec.js`.
