export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Lattice {
  matrix: [Vec3, Vec3, Vec3]; // 3x3 lattice vectors in Angstroms
  a: number;
  b: number;
  c: number;
  alpha: number; // degrees
  beta: number;  // degrees
  gamma: number; // degrees
  volume: number; // Å³
}

export interface Atom {
  id: number;
  element: string;
  name?: string;
  fractional: Vec3;
  cartesian: Vec3;
  occupancy?: number;
  charge?: number;
  scalarData?: { esp?: number; orbital?: number; spin?: number; bFactor?: number };
  displacement?: [number, number, number, number, number, number]; // Cartesian U tensor Å²: xx, yy, zz, xy, xz, yz
  selected?: boolean;
  colorOverride?: string;          // 独立原子颜色自定义
  radiusOverride?: number;         // 独立原子半径自定义
  selectiveDynamics?: [boolean, boolean, boolean]; // VASP T/F 弛豫标记
  originalId?: number;             // 原始基胞原子 ID
  isBoundary?: boolean;            // 是否为 VESTA 周期性边界补全原子
  imageOffset?: [number, number, number]; // 周期平移矢量 [dx, dy, dz]
}

export interface Bond {
  atom1Id: number;
  atom2Id: number;
  distance: number;
  isDouble?: boolean;
}

export interface CrystalStructure {
  scalarSource?: string;
  volumeData?: VolumeData;
  title: string;
  lattice?: Lattice;
  atoms: Atom[];
  isPeriodic: boolean;
  format?: 'cif' | 'poscar' | 'xyz';
  coordType?: 'Direct' | 'Cartesian';
  hasSelectiveDynamics?: boolean;
  sourceCif?: { text: string; originalGeometry: string }; // Exact source, export separately from edited P1
}

export type PresetMaterialType = 
  | 'candy'      // 顶刊马卡龙 / 水滴高光 (Candy Pastel / Nature Schematic)
  | 'ceramic'    // C4D 影棚瓷光 / 黑曜石键 (Studio Porcelain & Obsidian)
  | 'frosted'    // 磨砂果冻 / 冰晶半透 (Frosted Gem / Jelly Glass)
  | 'glow'       // 冷冻电镜 / 荧光辉光 (Cryo-EM Fluorescent Glow)
  | 'iridescent' // 全息珍珠 / 虹彩干涉 (Holographic Pearl / Thin-film)
  | 'xray'       // X射线幽灵 / 透视蓝图 (X-Ray Ghost Blueprint)
  | 'comic'      // 漫画 / 赛璐珞 (LightCone / Anime Cel-shading with crescent glint)
  | 'popart'     // 潮玩矢量 / 双重高光 (Pop Art Dual Glint)
  | 'clay'       // 顶刊封面 / 软陶黏土 (Editorial Soft Clay / SSS)
  | 'bubble'     // 机制示意 / 气泡高光 (Schematic Bubble Vector)
  | 'mof'        // 晶态多孔 / 框架晶体 (MOF Porous Framework)
  | 'handdrawn'  // 手绘 / 素描 (Sketch & Cross-Hatching)
  | 'flat2d'     // 2D 矢量平面 (Clean Flat Vector)
  | 'toon'       // 经典卡通 (Cel-shaded with discrete gradient)
  | 'smooth'     // 物理平滑 (Studio PBR Smooth)
  | 'plastic'    // 塑料质感 (Clearcoat High-Gloss Plastic)
  | 'glossy'     // 光泽漆面 (Mirror Lacquer / Shiny Ceramic)
  | 'metallic'   // 金属质感 (Metallic Anisotropic Luster)
  | 'glass'      // 玻璃水晶 (Crystal Physical Transmission)
  | 'flat'      // 纯色扁平 (Unlit Flat)
  | 'amber' | 'silicone' | 'kintsugi' | 'watercolor'
  | 'sem' | 'haadf' | 'hrtem' | 'afm'
  | 'esp' | 'orbital' | 'spin' | 'bfactor'
  | 'cyber' | 'lidar' | 'ice'
  | 'microfacet' | 'sintered' | 'hammered' | 'carbonfiber';


export type RenderMode = 
  | 'ball-and-stick' // 球棍模型
  | 'space-filling'  // 空间填充 (CPK)
  | 'stick'          // 纯棍状
  | 'wireframe';     // 线框

export type BondStyle = 
  | 'auto'      // 智能识别 (等同于 aromatic 芳香一实一虚)
  | 'aromatic'  // 一实一虚 (芳香共轭/石墨烯双键)
  | 'tapered'   // 渐变锥形 (双端依原子尺寸平滑外扩过渡锥棒)
  | 'parallel'  // 对称双实线 (完整平行双键)
  | 'double'    // 兼容全部双键
  | 'single';   // 标准单键

export type RibbonTab = 
  | 'home'       // 首页
  | 'visual'     // 可视化 (默认/核心面板)
  | 'build'      // 构建
  | 'edit'       // 编辑
  | 'measure'    // 测量
  | 'pbc'        // PBC
  | 'animation'  // 动画
  | 'ligand';    // LigandView

export type LabelMode = 'none' | 'element' | 'id' | 'element+id';

export type MeasureMode = 'none' | 'distance' | 'angle';

export interface MeasurementItem {
  id: string;
  type: 'distance' | 'angle';
  atomIds: number[];
  value: number; // Angstroms or Degrees
  p1: Vec3;
  p2: Vec3;
  p3?: Vec3;
}

export type BondColorMode = 'uniform' | 'dark' | 'split';

export interface VisualSettings {
  textureStrength?: number;
  textureScale?: number;
  volumeSettings?: VolumeSettings;
  ionicRadii?: Record<string, { charge: number; coordination: number; radius: number }>;
  atomSpecular?: { r: number; g: number; b: number };
  atomShininess?: number;
  atomStacks?: number;
  atomSlices?: number;
  atomStyle?: 'balls' | 'ellipsoids';
  radiiType?: 'atomic' | 'covalent' | 'vdw' | 'ionic';
  hideNonbonding?: boolean;
  labelOffsetZ?: number;
  outlineWidth?: number; // Hull thickness multiplier; 2 preserves the original appearance
  showStructure?: boolean;   // 隐藏/显示结构，保留晶胞与坐标轴的独立开关
  atomScale: number;          // 全局原子缩放 0.2 ~ 2.0 (默认 1.0)
  bondRadius: number;         // 单键棍粗细 0.02 ~ 0.20 Å (默认 0.055)
  bondTolerance: number;      // 成键距离容差系数 0.8 ~ 1.6 (默认 1.15)
  bondStyle: BondStyle;       // 键显示样式
  bondColorMode: BondColorMode; // 键配色: uniform (统一灰蓝) vs dark (出版黑墨) vs split (两端分色)
  customBondColor?: string;   // 统一键颜色 (默认 '#8fa4ba')
  doubleBondGap: number;      // 双线平行间距 0.06 ~ 0.24 Å (默认 0.14)
  aromaticGapRatio?: number;  // 虚键中间缺口占比 0.10 ~ 0.40 (默认 0.20)
  taperRootRadius?: number;   // 渐变锥形键粗端半径 0.03 ~ 0.20 Å (默认 0.085)
  taperTipRadius?: number;    // 渐变锥形键细端半径 0.008 ~ 0.08 Å (默认 0.020)
  taperMode?: 'directional' | 'hourglass'; // 渐变方向模式: directional (单向由大到小) vs hourglass (双向收腰喇叭形)
  elementColors: Record<string, string>; // 按元素批量自定义颜色
  elementRadii: Record<string, number>;  // 按元素批量自定义半径
  showPolyhedra: boolean;     // 配位多面体显示
  showHBonds: boolean;        // 氢键显示
  showOutline: boolean;       // 轮廓外描边
  showShadows: boolean;       // 实时阴影
  showFog: boolean;           // 景深雾效
  showLabels: LabelMode;      // 原子标签显示模式
  isOrthographic: boolean;    // 是否为正交投影 (vs 透视投影)
  autoRotate: boolean;        // 360° 自动旋转动画
  autoRotateSpeed: number;    // 自动旋转速度
  ligandViewRadius: number | null; // LigandView 截断半径 (null 表示不限制)
  showBoundaryAtoms: boolean; // VESTA 周期性边界补全 (闭合蜂窝六元环与边界化学键)

  // Coordination Polyhedra Settings (VESTA 风格配位多面体专用配置)
  polyhedraSettings?: PolyhedraSettings;

  // Lighting & Illumination (光照与打光控制)
  lightAzimuth?: number;      // 水平方位角 0 ~ 360° (默认 45°)
  lightAltitude?: number;     // 垂直俯仰角 10 ~ 85° (默认 50°)
  lightIntensity?: number;    // 主光照强度 0.5 ~ 5.0 (默认 2.5)
  ambientIntensity?: number;  // 环境/补光强度 0.1 ~ 2.5 (默认 0.85，越低阴影越浓郁立体，越高阴影越柔和)
  headlightMode?: boolean;    // 光源跟随视点/相机联动 (默认 false 为固定世界空间，true 为视点正向照明)
}

export interface VolumeData {
  kind: 'CHGCAR' | 'CHGDIFF' | 'LOCPOT' | 'ELFCAR' | 'SYNTHETIC';
  sourceName: string;
  dimensions: [number, number, number];
  latticeMatrix: [Vec3, Vec3, Vec3];
  channels: { label: string; values: number[]; min: number; max: number; sourceStats?: {min:number;max:number;mean:number;count:number} }[];
  originalDimensions?: [number,number,number];
  samplingSteps?: [number,number,number];
  sourceBytes?: number;
  units: string;
  augmentationBlocks: number;
}
export interface VolumeSettings {
  channel: number;
  isoEnabled: boolean;
  isoValue: number;
  paired: boolean;
  isoColor: string;
  negativeColor: string;
  isoOpacity: number;
  stride: number; // 0 = automatic, otherwise 1/2/4/8 grid steps
  sectionEnabled: boolean;
  sectionAxis: 'a' | 'b' | 'c';
  sectionPosition: number; // fractional coordinate 0..1
  sectionOpacity: number;
  palette: 'viridis' | 'diverging';
  rangeMin: number | null;
  rangeMax: number | null;
}

export type PolyhedralStyle = 1 | 2 | 3 | 4 | 5 | 6;

export type PolyhedraCenterMode = 'all' | 'custom';

export interface PolyhedraMaterial {
  specular: { r: number; g: number; b: number };
  shininess: number; // 0 ~ 100%
  opacity: number;   // 0 ~ 255 (204 is ~80%)
}

export interface PolyhedraEdges {
  show: boolean;
  lineWidth: number;
  color: { r: number; g: number; b: number };
}

export interface PolyhedraSettings {
  centerMode?: PolyhedraCenterMode; // 'all' (全量按元素) vs 'custom' (指定特定原子)
  customAtomIds?: number[];         // 用户指定中心原子的 ID 列表
  style: PolyhedralStyle;
  centralElements: string[];
  material: PolyhedraMaterial;
  elementColors: Record<string, { r: number; g: number; b: number; a: number }>;
  edges: PolyhedraEdges;
}

export const DEFAULT_POLYHEDRA_SETTINGS: PolyhedraSettings = {
  centerMode: 'all',
  customAtomIds: [],
  style: 2, // VESTA default: Polyhedra + Central atom + Coordinating atoms + Bonds
  centralElements: ['Ti', 'Co', 'Fe', 'Ni', 'Cu', 'Mn', 'Cr', 'V', 'Mo', 'W', 'Zr', 'Nb', 'Ru', 'Pt', 'Au', 'Si', 'Al'],
  material: {
    specular: { r: 255, g: 255, b: 255 },
    shininess: 100,
    opacity: 204
  },
  elementColors: {},
  edges: {
    show: true,
    lineWidth: 1.0,
    color: { r: 180, g: 180, b: 180 }
  }
};

