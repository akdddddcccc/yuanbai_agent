# 元白网页视觉与交互修改指南

这份指南对应元白感知实验室首页的手工 GLB 与光效设置。所有路径均相对于仓库根目录 `D:\codex\yuanbai_agent`，修改后先本地预览和检查，再决定发布。

## 0. 页面和网址分别在哪里

- `/`：元白感知实验室，源码是 `src/Portal.jsx`，样式是 `src/styles.css` 里 `.portal` 开头的首页区域。
- `/dialogue/`：对话元白，源码是 `src/App.jsx` 和 `src/YuanbaiScene.js`。
- `/explore/`：探索元白，源码是 `public/explore/index.html`，建筑纹理在 `public/explore/assets/`。

`src/main.jsx` 根据当前路径选择实验室首页或对话页。不要再创建第二套 React 工程，否则模型和主题修改会出现两份。

## 实验室首页怎么改

### 修改两张入口卡片的文字和链接

文件：`src/Portal.jsx`

找到 `EXPERIENCES`。每个项目中的字段作用如下：

- `title`：大标题，例如“探索元白”。
- `description`：卡片说明。
- `action`：卡片底部按钮文字。
- `href`：进入的子路径。
- `icon`：来自 Phosphor Icons 的图标组件。

### 修改实验室颜色、卡片和手机布局

文件：`src/styles.css`

找到 `.portal` 开头的区域：

- `--portal-bg`：实验室黑色背景。
- `--portal-panel`：混凝土卡片底色。
- `--portal-panel-ink`：卡片文字颜色。
- `--portal-red`：红砖提示色和选中描边。
- `.portal-card`：两张卡片的宽、高和内边距。
- `.portal-stage`：中央 3D 标志与光效的显示范围。
- `@media (max-width: 820px)`：手机端纵向布局。
- `@media (max-width: 440px)`：窄屏手机的进一步压缩。

实验室卡片使用完整 `<a>` 作为触摸区域，手机上无需精确点击小按钮；桌面上还可按数字键 `1`、`2` 快速进入。

### 修改首页标志、实拍材质和 Blender 工程

首页的混凝土、红砖与钢架标志使用独立 GLB；对话页的建筑模型仍在下方第 2 节所列文件中维护。

| 要修改的内容 | 文件或目录 |
| --- | --- |
| 旧概念模型归档（不是当前手工 GLB 的源工程） | `artifacts/yuanbai-perception-sculpture.blend` |
| 旧概念模型生成器，请勿用于覆盖当前手工 GLB | `scripts/build-perception-sculpture-blender.py` |
| 网页实际加载的模型，包含贴图与 UV | `public/models/yuanbai-perception-sculpture.glb` |
| 网页相机、光照、浮动及模型加载 | `src/PortalSculpture.js` |
| 768 像素颜色、法线和粗糙度贴图 | `public/models/textures/yuanbai-site/` |
| 实拍照片整理后的 `*-source.png` 样片归档 | `assets/materials/yuanbai-site/` |
| 从归档样片重新生成轻量材质贴图 | `scripts/build-site-material-maps.py` |

当前模型是用户在 2026-09-25 替换的手工 GLB，12 个网格、5 个材质，约 1.33MB。内嵌颜色贴图随 GLB 加载；当前没有导出法线/粗糙度贴图。上表中的旧 `.blend`、脚本和 `yuanbai-site` 贴图仅为前一版概念模型归档，不要运行旧脚本覆盖手工模型。更新时请从你们自己的源工程导出 GLB。

在 `src/PortalSculpture.js` 中可搜索以下参数：

- `MODEL_URL`：更换首页 GLB 的路径；保留 `import.meta.env.BASE_URL`，这样 `/yuanbai/` 子路径部署仍能找到模型。
- `camera.position.set(0, 10.6, 7.1)` 与 `camera.lookAt(0, 0, 0)`：正交相机的观察方向；`fitCamera()` 根据模型边界与屏幕比例调整取景，末尾的 `* 1.14` 控制周围留白。
- `LIGHTING`：集中控制模型照明。`exposure: .78` 是曝光，`environment: .24` 是环境反射，`hemisphere: .25` 是环境漫射；`key: 1.25`、`fill: .38`、`rim: .55` 分别控制主光、补光和轮廓光。`breath: .035` 控制主光的小幅慢呼吸。
- `MATERIAL_RESPONSE`：只适配表中列出的导出材质名，保留 GLB 原始颜色/贴图。红砖粗糙度 `.9`，混凝土 `.96`，锈蚀钢材 `.82`、金属度 `.22`。换 GLB 后材质名若变化，更新表即可；已有粗糙度/金属度贴图会优先保留。
- 当前 `Rusty iron` 使用无 alpha 的 RGB 贴图，运行时去掉导出残留的透明混合，减少钢架透明排序异常。其它透明材质不受影响。
- `group.position.y = Math.sin(time * .55) * .075 * motion`：整体上下浮动；`.075` 是幅度，`.55` 控制速度。
- `pointer.x * .08`、`-pointer.y * .035`：鼠标左右和上下移动时的转角；后面的 `.06` 控制跟随平滑度。

钢架和紧邻混凝土接口随同一个 `group` 整体移动，保留手工 GLB 的相对关系。旧 manifest 的构件间距检查只适用于旧概念模型，不代表当前手工模型通过了相交检查。

### 修改顶光、固定角标与下方投影

文件：`src/styles.css` 中“中央装置”一段。对应的层级元素位于 `src/Portal.jsx`。

- **顶光**：`.portal-top-light::before` 的 `conic-gradient` 控制锥形宽度与亮度，`mask-image` 控制下端淡出。`.portal-top-light::after` 使用 SVG 噪点形成微弱尘埃，调整其 `opacity` 可改变颗粒存在感。`portalLightBreath 8s` 是 8 秒透明度呼吸；`portalLightNoise 17s` 控制噪点缓慢漂移。调整时保留淡出边缘，避免光束变成硬边三角形。
- **固定红色角标**：`.portal-scale-marker` 的 `background` 控制红色，`width`/`height` 控制三角形尺寸，`top: 50%` 固定在刻度窗中央。左右分别用 `clip-path` 指向模型；角标是刻度条的兄弟元素，因此不会随刻度滑动。
- **刻度滑动**：`src/Portal.jsx` 的 `onPointerMove()` 将鼠标纵向位置映射成左右相反的偏移；`-52` 控制总行程，`.78` 控制右侧行程比例。触屏及减少动态效果偏好不启用指针映射；手机隐藏两侧刻度。横贯模型的红色扫描线已移除。
- **下方投影**：`PortalSculpture.js` 在主模型渲染后，把同一画面复制到宽度 256 像素的 2D 画布；更新间隔 `160` 毫秒，约每秒 6 次，不额外创建一套 3D 场景。`.portal-floor-projection canvas` 用 `scaleY(.28)` 压扁、`blur(7px)` 模糊、`opacity: .45` 控制可见度；`portalProjectionDrift 9s` 控制 9 秒轻微漂移。投影是视觉复制效果，不是物理实时阴影。
- **手机留白**：在 `@media (max-width: 820px)` 中，`.portal-stage` 的 `margin-bottom: 44px` 是中央文案与第一张卡片之间的留白；高度为 `330px`，小于 `440px` 时改为 `340px`。优先调整这处间距，不要用负外边距把文案压向卡片。

系统开启“减少动态效果”时，末尾的 `@media (prefers-reduced-motion: reduce)` 会关闭光束呼吸、投影漂移、卡片浮动和刻度过渡；`PortalSculpture.js` 同步停止模型浮动与鼠标转角。

## 1. 修改页面颜色、文字和版式

文件：`src/styles.css`

- `:root` 是全局视觉入口。修改 `--color-bg`、`--color-text`、`--color-accent` 可以整体换色。
- `--copy-left` 控制左侧标题和录音按钮的水平位置。
- `--scene-start` 控制 3D 楼体从页面多靠左的位置开始。
- `.copy-panel` 控制标题区宽度和垂直位置。
- `h1`、`.answer`、`.subline` 分别控制主标题、回答正文和识别提示。
- `.hold-button`、`.mic-disc`、`.waveform` 是长按录音按钮的外框、麦克风圆点和波形。
- 最后的 `@media (max-width: 820px)` 是手机布局，桌面样式改完后要同步检查这里。
- `.back-to-portal` 是左上角“返回元白感知实验室”，不需要时可隐藏，但建议保留网页内导航。

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

1. 运行 `npm.cmd run dev`，检查桌面和手机尺寸。
2. 检查根路径两张卡片能否分别进入 `/explore/` 和 `/dialogue/`。
3. 用浏览器手机尺寸检查卡片是否纵向排列，游戏方向键和录音按钮是否完整可见。
4. 在允许发声的环境中，长按说一句包含明显停顿和重音的话，观察灯光、体块和楼梯。
5. 检查等待时实体楼是否平滑变成白色粒子。
6. 运行 `npm.cmd run build` 和 `npm.cmd run test:sites`。
7. 提交到 `yuanbai_agent` 后，再更新 `portfolio-app-demos` 中的子模块版本。

Windows PowerShell 中在仓库根目录执行：

```powershell
Set-Location 'D:\codex\yuanbai_agent'
npm.cmd run dev
```

检查完成后按 `Ctrl+C` 停止预览，再运行构建检查：

```powershell
npm.cmd run build
npm.cmd run test:sites
```

本地预览和构建不会自动发布网页。本次视觉修改的检查可保持静音；第 4、5 步的语音验证留到允许发声的环境再做。
