# 元白网页视觉与交互修改指南

这份指南对应当前线上网页源码。修改后在仓库根目录运行 `npm run dev` 可以本地预览，运行 `npm run build` 可以检查发布版本。

## 1. 修改页面颜色、文字和版式

文件：`src/styles.css`

- `:root` 是全局视觉入口。修改 `--color-bg`、`--color-text`、`--color-accent` 可以整体换色。
- `--copy-left` 控制左侧标题和录音按钮的水平位置。
- `--scene-start` 控制 3D 楼体从页面多靠左的位置开始。
- `.copy-panel` 控制标题区宽度和垂直位置。
- `h1`、`.answer`、`.subline` 分别控制主标题、回答正文和识别提示。
- `.hold-button`、`.mic-disc`、`.waveform` 是长按录音按钮的外框、麦克风圆点和波形。
- 最后的 `@media (max-width: 820px)` 是手机布局，桌面样式改完后要同步检查这里。

## 2. 修改楼体造型与材质

文件：`src/YuanbaiScene.js`

- `BLOCKS` 是十五个红砖体块。每行七个数依次为 `x、y、z、宽、高、深、旋转角度`。
- `palette` 控制红砖、深砖、混凝土和内部灯光的颜色。
- `core` 是中央浅色核心筒；修改 `RoundedBoxGeometry(2.1, 8.8, 2, ...)` 的前三个数即可改宽、高、深。
- `stairRoot` 下方的两个循环生成楼梯。`flight < 5` 是五段楼梯，`step < 7` 是每段七级。
- `count = 7600` 是等待粒子数量。低端设备卡顿时可降到 3500~5000。

如果后续换成 Blender 导出的 GLB，请按照 `MODEL_REPLACEMENT.md` 保留 `building、blocks、stairRoot、windowMaterials` 这几个交互对象。这样录音和声音动画无需重写。

## 3. 修改“说话爆炸”和灯光节奏

文件：`src/YuanbaiScene.js` 的 `animate()`。

- `onset > .085`：重音触发阈值。改小更敏感，改大更克制。
- `data.impulse *= .91`：爆发后的回弹速度。数值越小，返回越快。
- `smoothedLevel * .52`：持续说话时的基础外移距离。
- `data.impulse * 1.8`：重音瞬间的爆发距离。
- `lightPulse` 中的 `8.2`：当前语调对灯光亮度的影响。
- `afterglow * 2.1`：停顿后余辉的强度。
- 粒子透明度插值中的 `.055`：等待阶段实体楼与粒子云切换速度。

楼梯目前只用 `position.y = ... * .012` 和 `rotation.z = ... * .0025` 微动，保持稳定感。

## 4. 修改对话与录音交互

文件：`src/App.jsx`

- `PHASE_COPY` 控制待机、聆听、思考、回答四个阶段的提示文字。
- `INTRO` 是还没有回答时显示的介绍。
- `* 7.5` 是声音可视化灵敏度，影响波形、灯光和体块动画。
- `preferredMimeType()` 是浏览器录音格式优先级。
- `historyRef.current.slice(-8)` 保留最近八条消息，也就是约四轮上下文。
- `getUserMedia()` 中的回声消除、降噪和单声道设置适合现场外放。

公开网页会自动请求 `/api/yuanbai/chat`；本地 Python 页面仍请求 `/api/chat`。不要把 DeepSeek 或百炼密钥写进前端源码。

## 5. 一次修改后的检查顺序

1. 运行 `npm run dev`，检查桌面和手机尺寸。
2. 长按说一句包含明显停顿和重音的话，观察灯光、体块和楼梯。
3. 检查等待时实体楼是否平滑变成白色粒子。
4. 运行 `npm run build` 和 `npm run test:sites`。
5. 提交到 `yuanbai_agent` 后，再更新 `portfolio-app-demos` 中的子模块版本。
