# 元白网页视觉与交互修改指南

这份指南对应当前线上网页源码。修改后在仓库根目录运行 `npm run dev` 可以本地预览，运行 `npm run build` 可以检查发布版本。

## 0. 页面和网址分别在哪里

- `/`：元白工作台，源码是 `src/Portal.jsx`，样式是 `src/styles.css` 里“元白工作台 / 首页”一段。
- `/dialogue/`：对话元白，源码是 `src/App.jsx` 和 `src/YuanbaiScene.js`。
- `/explore/`：探索元白，源码是 `public/explore/index.html`，建筑纹理在 `public/explore/assets/`。

`src/main.jsx` 根据当前路径选择工作台或对话页。不要再创建第二套 React 工程，否则模型和主题修改会出现两份。

## 入口工作台怎么改

### 修改两张入口卡片的文字和链接

文件：`src/Portal.jsx`

找到 `EXPERIENCES`。每个项目中的字段作用如下：

- `title`：大标题，例如“探索元白”。
- `description`：卡片说明。
- `action`：卡片底部按钮文字。
- `href`：进入的子路径。
- `icon`：来自 Phosphor Icons 的图标组件。

### 修改工作台颜色、卡片和手机布局

文件：`src/styles.css`

找到 `.portal` 开头的区域：

- `--portal-bg`：工作台黑色背景。
- `--portal-panel`：混凝土卡片底色。
- `--portal-panel-ink`：卡片文字颜色。
- `--portal-red`：红砖提示色和选中描边。
- `.portal-card`：两张卡片的宽、高和内边距。
- `.portal-stage`：中央 3D 楼体的显示范围。
- `@media (max-width: 820px)`：手机端纵向布局。
- `@media (max-width: 440px)`：窄屏手机的进一步压缩。

工作台卡片使用完整 `<a>` 作为触摸区域，手机上无需精确点击小按钮；桌面上还可按数字键 `1`、`2` 快速进入。

## 1. 修改页面颜色、文字和版式

文件：`src/styles.css`

- `:root` 是全局视觉入口。修改 `--color-bg`、`--color-text`、`--color-accent` 可以整体换色。
- `--copy-left` 控制左侧标题和录音按钮的水平位置。
- `--scene-start` 控制 3D 楼体从页面多靠左的位置开始。
- `.copy-panel` 控制标题区宽度和垂直位置。
- `h1`、`.answer`、`.subline` 分别控制主标题、回答正文和识别提示。
- `.hold-button`、`.mic-disc`、`.waveform` 是长按录音按钮的外框、麦克风圆点和波形。
- 最后的 `@media (max-width: 820px)` 是手机布局，桌面样式改完后要同步检查这里。
- `.back-to-portal` 是左上角“返回元白工作台”，不需要时可隐藏，但建议保留网页内导航。

## 2. 修改楼体造型与材质

形体参数：`src/yuanbaiModelSpec.js`

材质、细节和动画：`src/YuanbaiScene.js`

- `YUANBAI_MASSES` 是从“元白楼大型参考.3dm”读取后换算出的 12 个体块。`position` 控制平面位置，`size` 依次为宽、高、深，`rotation` 是平面旋转。
- `west-courtyard` 的 `footprint` 是左侧 L 形低层的真实六点轮廓；不要把它改回矩形包围盒。
- `YUANBAI_CONNECTIONS` 是五处楼梯和连桥的起止点，网页会自动计算踏步与栏杆。
- `YUANBAI_COURTYARD` 控制三层红砖、两层草的圆形中庭位置和半径。
- `palette` 控制红砖、深砖、混凝土、金属、草和内部灯光的颜色。
- `makeSurfaceTexture()` 生成砖缝、色差、混凝土颗粒和模板浇筑缝。
- `addFacadeDetails()` 生成深窗洞、压顶、竖向构件、阳台、屋顶机房和排气筒。
- `count = 6800` 是等待粒子数量。低端设备卡顿时可降到 3500~5000。

可替换模型位于 `public/models/yuanbai-brutalist-v1.glb`，运行 `npm run model:glb` 可按当前参数重新导出。节点规范见 `public/models/README.md` 和 `MODEL_REPLACEMENT.md`。

## 3. 修改“说话爆炸”和灯光节奏

文件：`src/YuanbaiScene.js` 的 `animate()`。

- `onset > .085`：重音触发阈值。改小更敏感，改大更克制。
- `data.impulse *= .91`：爆发后的回弹速度。数值越小，返回越快。
- `smoothedLevel * .62`：持续说话时的基础外移距离。
- `data.impulse * 2.0`：重音瞬间的爆发距离。
- `lightPulse` 中的 `8.1`：当前语调对灯光亮度的影响。
- `afterglow * 2.15`：停顿后余辉的强度。
- 粒子透明度插值中的 `.055`：等待阶段实体楼与粒子云切换速度。

楼梯目前只用 `position.y = ... * .006` 和 `rotation.z = ... * .0015` 微动，保持稳定感。

## 4. 修改对话与录音交互

文件：`src/App.jsx`

- `PHASE_COPY` 控制待机、聆听、思考、回答四个阶段的提示文字。
- `INTRO` 是还没有回答时显示的介绍。
- `* 7.5` 是声音可视化灵敏度，影响波形、灯光和体块动画。
- `preferredMimeType()` 是浏览器录音格式优先级。
- `historyRef.current.slice(-8)` 保留最近八条消息，也就是约四轮上下文。
- `getUserMedia()` 中的回声消除、降噪和单声道设置适合现场外放。

公开网页会自动请求 `/api/yuanbai/chat`。本地 Vite 页面请求 `/api/chat`，由 `vite.config.mjs` 转发到同一套云端服务，因此只运行前端也能使用完整链路。不要把 DeepSeek 或百炼密钥写进前端源码。

## 5. 修改探索小游戏

文件：`public/explore/index.html`

- `GRID_SIZE` 是网格边长，目前为 9。
- `START_VISION` 是初始视野范围。
- `CLIFFS` 是悬崖坐标集合。
- `.tile` 控制每块地面的尺寸和建筑纹理。
- `#scene`、`#grid-container` 控制倾斜透视角度。
- 两个手机断点 `700px` 和 `480px` 控制场景缩放、HUD 和按钮。

纹理已经放在 `public/explore/assets/yuanbai-floor.jpg`，上线后不依赖外部图片服务。替换时保持文件名不变即可；若修改文件名，要同步修改 HTML 中两处 `yuanbai-floor.jpg`。

## 6. 一次修改后的检查顺序

1. 运行 `npm run dev`，检查桌面和手机尺寸。
2. 检查根路径两张卡片能否分别进入 `/explore/` 和 `/dialogue/`。
3. 用浏览器手机尺寸检查卡片是否纵向排列，游戏方向键和录音按钮是否完整可见。
4. 在允许发声的环境中，长按说一句包含明显停顿和重音的话，观察灯光、体块和楼梯。
5. 检查等待时实体楼是否平滑变成白色粒子。
6. 运行 `npm run build` 和 `npm run test:sites`。
7. 提交到 `yuanbai_agent` 后，再更新 `portfolio-app-demos` 中的子模块版本。
