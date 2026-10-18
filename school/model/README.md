# 学校版对话模型

由仓库现有 yuanbai-precise-v2.glb 派生，没有重新设计建筑。
仅简化 MAT_METAL_WHITE 细小几何，其他材质的三角形、顶点坐标和法线保留。
15 个 YB_mass_* 分组和连接件名称保留，以继续使用原来的语音动作绑定。
本轮未做立面贴图烘焙，避免未验证的贴图替换改变洞口及悬挑。

- 原始 491,822 三角面、18,647,460 字节。
- 新版 119,608 三角面、解压后 7,421,336 字节。
- 实际下载 1,633,721 字节（gzip）。浏览器本地解压，不依赖 Nginx gzip。
- 源资源以 base64 存储，构建校验 SHA-256 后生成带内容哈希的 .glb.gz。
- 浏览器优先 DecompressionStream，旧浏览器使用本地 fflate，不连接外部 CDN。

重制：Python + numpy + fast-simplification，执行 scripts/build-school-light-model.py <output.glb>。
Windows 部署只需要 Node，直接使用已生成资源。更换资源须同步更新 manifest.json。
验收：三个俯视角静态渲染对照，另有 GLTFLoader 解析及运动分组测试。
