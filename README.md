# CrystalCraft

纯前端晶体结构查看与编辑工具，使用 React、TypeScript、Three.js、Tailwind 4 和 Vite。当前版本 0.6.0，源码采用 MIT。导入文件在浏览器内解析，不需要后端、API Key 或数据库。支持部署在 GitHub Pages 的用户主页、仓库子路径或自定义域名。

首页保持空白，点击“选择结构文件”或拖入本机文件开始。源码与发布包不内置用户计算结构；恢复记录仅保存在当前浏览器，必须主动选择恢复。在线地址：https://niananruo.github.io/CrystalCraft/ 。

所有 `docs/qa/` 验收截图和结果仅保留在本地，不随公开仓库分发。公开测试使用人工构造的合成坐标。

## 本地运行与验证

使用 Node.js 24（版本范围见 `package.json`，锁定依赖见 `package-lock.json`）。

```sh
npm ci
npm run dev
```

生产构建与测试：

```sh
npm test
npm run build
npm run test:e2e
npm run preview -- --host 127.0.0.1 --port 4173
```

Windows 端到端测试使用已安装的 Microsoft Edge；Linux/macOS 先执行 `npx playwright install chromium`，Linux CI 使用 `npx playwright install --with-deps chromium`。测试服务器把 `dist` 挂载在 `/crystal-craft-test/`，故意不提供首页兜底，检查真实仓库子路径能否加载所有资源。`npm run check` 依次执行完整依赖审计、单元测试、构建和端到端测试。

不要双击 `dist/index.html` 运行：ES module 应通过 HTTP(S) 服务器加载。

## 部署到 GitHub Pages

1. 项目仓库为 [NIANANRUO/CrystalCraft](https://github.com/NIANANRUO/CrystalCraft)，默认分支为 `main`。提交源码、锁文件、测试和 `.github` 目录；原始科研文件及 `docs/qa/real-volume/` 本地验收产物不提交。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 推送 `main`，或在 Actions 手动运行 **Deploy GitHub Pages**。
4. 工作流先安装锁定依赖、跑单元测试、生产构建、完整依赖审计和浏览器测试；全部通过后只上传 `dist` 并部署。
5. 从部署任务的 `github-pages` 环境打开实际站点 URL。工作流随后自动验收 HTTPS 加载、刷新、构建资源哈希、文件导入、数据与 PNG 下载；仍需人工核对 Pages 来源、权限及回滚。网址一般为 `https://用户名.github.io/仓库名/`；使用工作流输出的地址为准。

`vite.config.ts` 使用 `base: './'`，无须把仓库名写死。若主分支不是 `main`，同时修改 `.github/workflows/pages.yml` 的 push 分支和 deploy 条件。若使用自定义域名，在 GitHub Pages 设置中配置并按 GitHub 指引管理 DNS。

部署流程依据 [GitHub Pages 自定义工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) 和 [Vite 静态部署文档](https://vite.dev/guide/static-deploy.html)。本地构建成功不等于已发布，也不能替代仓库端首次工作流验证。

## 保留的功能

- POSCAR/CONTCAR、CIF、XYZ 文件选择与拖放；POSCAR、CIF、XYZ 数据导出。
- CHGCAR、CHGDIFF（含 CHGDIFF.vasp）、LOCPOT、ELFCAR 的分块导入；周期等值面、正负双等值面、斜晶胞二维切片、色标与切片 CSV 导出。
- 31 种材质，原有 20 种全部保留；球棍、CPK、纯棍和线框；多面体、氢键、原子标注、轮廓、光照、阴影、雾效、投影与自动旋转。
- 晶胞及周期边界显示，a/b/c 及倒易方向视图，旋转、平移、缩放和复位。
- 单选、多选、按原子/元素调整颜色与半径、元素替换、增加/删除原子、周期表。
- 超胞、晶胞矩阵变换、原点平移、坐标归一化、真空层。
- 距离/夹角测量；Output、Summary、Comment 面板；完整原子列表分页。
- 属性窗口及全部原有标签；高清 PNG、透明背景、画幅比例和 Normal/High/Ultra 选项，保留 1080p 至 8K 入口。

快捷键：Ctrl/Cmd+S 保存项目，Ctrl/Cmd+Z 撤销，Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y 重做，Ctrl/Cmd+O 导入，Ctrl/Cmd+E 周期表替换，Ctrl/Cmd+P 原子属性，Delete 删除主选原子。在输入框和模态窗口中不会触发页面级编辑快捷键。属性窗口 OK 提交，Cancel、右上角关闭和 Escape 撤销该次窗口内的结构与视觉预览。

### Bonds 原子对规则编辑

从 Edit → Bonds...、侧栏 Bonds 编辑… 或属性窗口的 Bonds 页进入。规则列表支持 New、Delete、Clear、上下移动和按当前元素半径/容差自动生成；选中一行后编辑 A1/A2、Min./Max.（Å）、Search by label、Boundary 和 Poly.。默认继续使用全局容差自动成键；编辑规则后启用列表模式，满足任意一条规则即可成键，空列表不生成自动键，手动添加的键保留。全局键粗细、样式和配色继续有效。Apply 更新视图，OK 确认，Cancel/关闭/Escape 恢复打开窗口前的状态；规则随项目文件、本机恢复、撤销与重做保存。导入新的结构文件回到自动模式。

搜索模式与方向语义参照 [VESTA 官方手册第 8 章](https://jp-minerals.org/vesta/en/doc/VESTAch8.html)：按 A1–A2 搜索、搜索 A1 的所有邻接原子，或搜索所有原子对。Boundary 1 仅使用当前原子；2 只从当前边界内的 A1 补全 A2；3 从已显示原子递归补全。周期扩展由“周期边界补全”总开关控制，适用于斜晶胞及超出旧边界边距的配位原子。无限周期网络达到显示/搜索预算时明确报错，可调整为 Boundary 1/2 或缩小键长后恢复。单条键长范围为 0 ≤ Min. ≤ Max. ≤ 100 Å，Max. > 0，规则最多 2,000 条。

Poly. 将该规则的 A1 指定为配位中心，配体按同一规则的元素/标签、键长和边界筛选；在 Polyhedra 页开启显示并设置外观。Search molecules 不指定中心，不创建多面体。CIF 使用位点标签，未提供标签的原子使用“元素 + 原子 ID”；周期副本沿用原位点标签。单元与浏览器回归覆盖规则筛选、周期补全、多面体、项目保存/撤销和窄屏编辑。

手机宽度下左侧面板默认收起，点击左上角箭头展开；工具栏和原子表可横向滚动。横竖屏切换会调整相机画幅并保留观察方向。

## 晶体结构材质

侧栏“材质预设”和 Objects 菜单共享 31 种材质、6 个分组。本轮保留已有 27 种，新增微晶切面、微孔烧结、锤纹金属和碳纤维编织四种表面纹理。它们保留元素基础色与结构几何，化学键简化为光滑连接，提供纹理强度/尺度及恢复默认值。参数随项目保存、撤销和本机恢复。完整说明见 [材质库](docs/material-library.md)；画面对比产物仅保留在本地 `docs/qa/surfaces/`。

按用户确认移除 SEM、HAADF、HRTEM、AFM、ESP、Orbital、Spin、B-factor 材质模式及其 CSV 入口；旧项目/链接自动回退 Studio PBR 并提示，保留结构和已存元数据。真实差分电荷/ELF 的等值面、切片与 CIF 热位移椭球继续可用。新增纹理只改变渲染表面，不代表真实孔隙、纤维或微观缺陷。

## 支持边界与恢复方式

- 当前安全预算：结构文本最多 10 MiB、项目文件最多 24 MiB、基结构最多 2,000 原子。派生边界、化学键、多面体和图片输出有独立预算。超限明确报错，不截断数据；关闭复杂效果或减小结构后重试。安全上限不等于所有设备在上限处都能流畅运行。
- 需要支持 WebGL 2 的浏览器及可用图形加速。图形初始化/上下文丢失时显示恢复信息；菜单和结构数据导出仍可访问。大模型建议使用桌面设备并关闭高成本透明材质、阴影与大量标签。
- CIF 支持显式对称操作并展开；无法可靠判定的非 P1、不完整操作表及不支持的数据类型会给出错误。只提供空间群名称并不能替代完整操作表。磁性 CIF、XDATCAR、多帧轨迹和 CIF 多数据块仍明确拒绝。普通 POSCAR 仅读取坐标，不保存额外速度数据。
- POSCAR 不表示部分占据率；含部分占据率的结构请导出 CIF。XYZ 不包含普通晶胞信息，跨格式导出不会自动发明晶格。
- CIF 导入独立保留原始全文，可通过 File → 下载原始 CIF 存档取回。编辑后 Export CIF File (P1) 输出当前坐标、占据率及受支持的热位移；原始空间群、文献、无序等标签仅留在原始存档，不自动重写为编辑后的元数据。
- 化学键、氢键与多面体是基于几何阈值的可视化推断，不等同于量化计算的键级、电子密度或完整晶体学分析。
- 原子细分、隐藏孤立原子、共价/范德华半径、标签 Z 偏移和轮廓厚度已接入。Specular/Shininess 修改后使用自定义 Phong 高光材质，可恢复材质预设。轮廓宽度是外壳厚度系数，非屏幕像素。热位移按 CIF Uij/Bij 或 Uiso/Biso 的 50% 概率面显示；缺数据位点保留普通球。离子半径支持手动录入元素的价态、配位数与半径，不会自动猜测价态或声称是 Shannon 数据库查询；未指定的元素回退默认半径。
- 通过“保存项目”或 Ctrl/Cmd+S 下载 `.crystalcraft.json`，用原文件导入入口或拖放恢复。项目 v2 保存结构、显示设置、材质、原始 CIF 和展示用体网格；兼容读取 v1。不保存相机轨道、测量线或会话撤销历史。连续编辑后 700 ms 向本机 IndexedDB 自动保存，刷新后显示恢复入口；保存失败会提示。属性窗预览不会自动存档，OK 才提交。会话历史最多 30 步，并设 24 MiB 预算，分支编辑清空重做。浏览器清理存储后无法恢复；请定期下载项目文件。多面体默认参数仍独立保存，不跨结构复用原子 ID。
- 8K/Ultra 导出受 GPU 最大纹理尺寸、采样后像素预算与内存影响；失败后可降低分辨率或采样质量重试，原画布状态会恢复。

## 体数据与真实文件验收

从文件导入或 Properties → Isosurfaces / Sections 导入体数据；导入同时载入文件中的晶胞与原子。等值面支持阈值、正负配对、颜色、透明度及采样步长；切片支持固定 a/b/c 分数坐标、位置、色图、手动范围及 CSV。内置合成场始终标明为演示数据。

体文件最多 1 GiB、原网格单通道最多 2 亿点、1–4 通道。Worker 分块扫描全部数值并计算原始极值/均值，保留每通道最多 262,144 个等步长节点，界面明确显示原始尺寸、展示尺寸及抽样步长。项目与 CSV 保存的是展示网格，不能代替原始计算文件；抽样不保留所有极值，可能漏掉局部尖峰。精细定量分析应使用原始网格并做收敛检查。无法满足等步长预算的网格明确拒绝。

CHGCAR/CHGDIFF 按 VASP CHGCAR 的 `n(r)=data(r)/Vcell` 约定转换为 Å⁻³；CHGDIFF 假设差分工具保留该文件约定，若上游已转换密度不可重复归一化。LOCPOT 保留 eV；ELFCAR 保留无量纲原值，双通道按文件顺序标为 ELF ↑/↓。参考：[CHGCAR](https://vasp.at/wiki/CHGCAR)、[ELFCAR](https://vasp.at/wiki/ELFCAR)、[LOCPOT](https://vasp.at/wiki/LOCPOT)。PAW 占据矩阵校验后跳过，不用于体绘制。数据采用 x 最快的顺序、周期三线性插值和 Marching Tetrahedra；自动模式最多 300,000 个采样单元，双等值面合计最多 150,000 个三角形，超限提示调整参数。修改晶胞前必须移除体数据，原子编辑不会重新计算场。

真实 CHGDIFF 和双通道 ELF 文件已在本地交叉验收：独立 NumPy 扫描原始文件，与浏览器统计、采样点、切片 CSV、项目恢复及 PNG 对比。用户计算结构、数值统计和验收产物仅保留在本地，不作为公开示例或测试数据。

复测时先构建，再设置自己的本地路径；参考统计由 `tests/real-volume-reference.py` 重新生成（需要 NumPy），随后运行：

```powershell
$env:CHARGE_FILE = '本地路径/CHGDIFF.vasp'
$env:ELF_FILE = '本地路径/ELFCAR'
python tests/real-volume-reference.py "$env:CHARGE_FILE" "$env:ELF_FILE"
node tests/real-volume.mjs
```

## 维护与复用

- 提交源码和 `package-lock.json`；`node_modules`、`dist`、测试结果及旧本地抓图脚本不需要提交。旧脚本/图片仍保留在本地，正式回归入口是 `npm test` 和 `npm run test:e2e`。
- `ci.yml` 检查推送和 PR；`pages.yml` 只在验证通过后发布；Dependabot 每周检查 npm 和 Actions 更新。CI 与部署均以完整依赖审计作为门槛；本轮运行/开发依赖审计均为 0 告警，原始结果见 audit-runtime.json 与 audit-dependencies.json。审计结果会随公告更新而变化。
- 变更解析器必须增加畸形输入和导入/导出回归；变更渲染必须覆盖失败恢复及资源释放；变更 UI 必须检查桌面和窄屏。
- 所有者已指定 MIT，见 `LICENSE`；构建后随站点分发 `LICENSE.txt`。第三方数据许可见 `public/THIRD_PARTY_NOTICES.txt`。维护与发布约定见 `MAINTAINING.md`，变更见 `CHANGELOG.md`。

## 生产验收与性能复测

建立仓库并首次部署后，在 PowerShell 执行：

```powershell
$env:DEPLOYMENT_URL = 'https://用户名.github.io/仓库名/'
npm run test:deployment
```

`dist/build-info.json` 含版本、Git SHA（本地无仓库时为 null）及资源 SHA-256。
Pages 手动工作流的 `release_ref` 可填写已验证提交 SHA/标签，重新构建后部署，作为回滚入口；历史版本仍须通过门槛。

`npm run test:performance` 在生产子路径运行 500/1,000/2,000 原子的普通与玻璃/阴影/标签组合，保存 JSON 指标及截图到 `docs/qa/hardening/`。
至少 500 个显示原子时，对兼容的不透明原子、键和轮廓实例化；透明/透射保留逐物体排序。基结构达到 500 原子时，默认球细分降低为 16×12；显式 Stacks/Slices 设置仍优先。静止画面按需重绘，旋转、拖动、光照、测量及设置变化会重新绘制。
解析由可取消 Worker 执行，错误/超时保留旧结构。长时间移动设备 GPU 验证仍需实机；桌面软件 GPU 数据不代表移动性能。

热位移转换依据 [IUCr Uij 定义](https://www.iucr.org/__data/iucr/cifdic_html/3/CORE_DIC/Iatom_site_aniso.U_11.html)，实例选择和释放依据 [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)。当前验证使用合成参考结构，尚未覆盖任意晶体学设置。
