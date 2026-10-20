# 晶体结构表面材质库（0.5.1）

当前共 31 种材质、6 个分组。原有 20 种全部保留，上轮新增的琥珀、硅胶、金缮、水彩、霓虹、点阵和冰裂共 7 种也保留；新增 4 种表面纹理。侧栏“材质预设”与 Objects 菜单使用同一份目录。

用户已确认移除 SEM、HAADF、HRTEM、AFM、ESP、Orbital、Spin、B-factor 这 8 个材质模式及相应标量 CSV 导入入口。真实差分电荷/ELF 的等值面与切片、CIF 热位移椭球继续可用。

## 本轮新增

| 材质 | 与现有模式的区别 | 当前实现与适用方式 |
|---|---|---|
| Microfacet · 微晶切面 | 区别于均匀粗糙的 Studio PBR：局部分段反光 | 程序切面法线与粗糙度变化；保留球形外轮廓，可用于晶体质感展示 |
| Sintered · 微孔烧结 | 区别于陶瓷、硅胶：细密凹坑表面 | 程序凹凸与高粗糙度；只作表面装饰，不表示实际孔隙、孔径或孔隙率 |
| Hammered Metal · 锤纹金属 | 区别于光滑金属：浅凹面形成破碎反射 | 程序凹凸与金属反光，保留原有元素色调 |
| Carbon Fiber · 碳纤维编织 | 区别于手绘排线：交错纤维与清漆反光 | 球面编织图案与细纤维；是展示风格，不推断所导入结构的成分或纤维方向 |

四种模式使用 MeshPhysicalMaterial 的表面法线与粗糙度变化，不移动顶点、原子坐标或化学键端点，不改变原子半径及拾取边界。基础颜色沿用当前元素/原子颜色；高光与纹理会改变屏幕明暗。细小化学键使用光滑材质，避免纹理掩盖连接。无需额外纹理文件或外部网络请求。

材质说明区提供“纹理强度”0～1、“纹理尺度”4～24，以及恢复默认值按钮。默认强度 0.65、尺度 12；尺度越大纹理越细。四种模式共享当前参数，随项目、撤销和自动恢复保存。强度为 0 时关闭程序纹理，保留该模式的基础 PBR 属性。小尺寸原子的纹理自动减弱，减少密集结构的视觉噪声。

## 分类与已有内容

| 分组 | 数量 | 内容 |
|---|---:|---|
| 插画与卡通 | 9 | candy、bubble、popart、clay、comic、handdrawn、toon、flat2d、watercolor |
| 写实与涂层 | 6 | ceramic、smooth、plastic、glossy、silicone、kintsugi |
| 透明与折射 | 4 | frosted、glass、amber、ice |
| 金属与表面纹理 | 5 | metallic、microfacet、sintered、hammered、carbonfiber |
| 辉光与特种光学 | 5 | glow、iridescent、xray、cyber、lidar |
| 工程与结构 | 2 | mof、flat |

侧栏与 Objects 菜单均按外观类型分组，不再使用“原有”“新增”标签。材质名称描述视觉风格，不代表实验成像模拟、物质鉴定或期刊背书。琥珀/冰裂仍为实时透射近似，霓虹/点阵仍是程序表面效果。

## 旧项目迁移

导入含被移除 8 个 ID 的旧项目，或访问对应的旧 `?material=` 链接时，自动回退到 Studio PBR，并显示可关闭的迁移提示。结构、原始 CIF、体数据以及旧项目中已存的原子标量元数据均保留；旧数据不再驱动材质。重新保存使用有效材质 ID，不保存临时提示。项目格式仍为 v2，继续兼容 v1。

历史 0.4.0 设计与模式说明见 [归档](material-library-0.4.md)，该归档不是当前功能清单。

## 验证与来源

对比与导出样张仅保留在本地 `docs/qa/surfaces/`，不随仓库分发。测试覆盖 31 个入口/6 组一致性、原 20 种保留、着色器编译、元素基础色、参数变化与保存恢复、PNG、手机布局、500 原子实例化，以及致密/层状/开放骨架参考结构的坐标与元数据不变。

实现依据本地锁定 Three.js 版本的 ShaderChunk 与 MeshPhysicalMaterial API。相关原理参考 [Three.js MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)、[Three.js Material.onBeforeCompile](https://threejs.org/docs/pages/Material.html#onBeforeCompile) 与 [Blender Bump 节点](https://docs.blender.org/manual/en/latest/render/shader_nodes/vector/bump.html)。这些来源解释实时表面法线和物理材质能力，不表示本网页已经实现离线路径追踪或真实微观结构重建。
