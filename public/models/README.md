# 元白楼网页模型

`yuanbai-brutalist-v1.glb` 根据 `元白楼大型参考.3dm` 的体块位置重建，用于后续在 Blender、Rhino 或其他 DCC 软件中替换和深化。

节点命名约定：

- `YB_mass_*`：会随语音爆发运动的 12 个主体体块。
- `YB_stable_stairs_and_bridges`：保持稳定的楼梯和连桥。
- `YB_circular_courtyard_3_brick_2_grass`：三层红砖、两层草的圆形中庭。
- `warm_recessed_window`：可由网页音量包络驱动发光的窗。

重新导出：

```bash
npm run model:glb
```

替换工程模型时请保留上述节点前缀，网页即可继续区分爆炸体块、稳定连接构件和发光窗。
