import type {PresetMaterialType} from './types/crystal';

export const NEW_MATERIALS: readonly PresetMaterialType[] = ['amber','silicone','kintsugi','watercolor','cyber','lidar','ice','microfacet','sintered','hammered','carbonfiber'];
export interface MaterialEntry {id:PresetMaterialType;label:string}
const entries=(values:[PresetMaterialType,string][]):MaterialEntry[]=>values.map(([id,label])=>({id,label}));
/** Shared by both material menus, grouped by appearance rather than release history. */
export const MATERIAL_GROUPS = [
  {label:'插画与卡通',items:entries([
    ['candy','Nature Pastel (顶刊马卡龙 / 水滴弧光)'],['bubble','BioRender 2D (机制示意 / 淡彩微立体)'],['popart','Pop Art (潮玩矢量 / 月牙微弧)'],['clay','Editorial Clay (顶刊封面 / 软陶黏土)'],['comic','Comic (经典日漫 / 赛璐珞)'],['handdrawn','Sketch (手绘石墨 / 交叉排线)'],['toon','Cel Toon (经典卡通 / 离散阶梯)'],['flat2d','Flat 2D (极简矢量 / 纯平插画)'],['watercolor','Watercolor Wash · 水彩渗透']])},
  {label:'写实与涂层',items:entries([
    ['ceramic','Studio Porcelain (C4D 影棚瓷光 / 黑曜石键)'],['smooth','Studio PBR (工业写实 / 柔和漫反射)'],['plastic','Clearcoat Plastic (高光塑料 / 清漆层)'],['glossy','Glossy Ceramic (镜面光泽 / 陶瓷车漆)'],['silicone','Matte Silicone · 哑光硅胶'],['kintsugi','Kintsugi Lacquer · 金缮黑陶']])},
  {label:'透明与折射',items:entries([
    ['frosted','Frosted Gem (磨砂果冻 / 冰晶半透宝石)'],['glass','Crystal Glass (水晶宝石 / 物理透射)'],['amber','Amber Resin · 琥珀树脂'],['ice','Glacial Ice · 冰裂透射']])},
  {label:'金属与表面纹理',items:entries([
    ['metallic','Metallic Luster (重工金属 / 各向异性)'],['microfacet','Microfacet · 微晶切面'],['sintered','Sintered · 微孔烧结'],['hammered','Hammered Metal · 锤纹金属'],['carbonfiber','Carbon Fiber · 碳纤维编织']])},
  {label:'辉光与特种光学',items:entries([
    ['glow','Cryo-EM Fluorescent (冷冻电镜 / 荧光辉光)'],['iridescent','Holographic Pearl (全息珍珠 / 虹彩干涉)'],['xray','X-Ray Ghost (X射线幽灵 / 透视蓝图)'],['cyber','Cyber Neon Grid · 霓虹经纬网'],['lidar','LiDAR · 离散点阵']])},
  {label:'工程与结构',items:entries([
    ['mof','MOF Framework (框架晶体 / 多面体线框)'],['flat','Flat Unlit (工程无光 / 纯色平面)']])},
];
export const MATERIAL_INFO: Partial<Record<PresetMaterialType,{summary:string;cost:string;background?:string;data?:boolean}>> = {
  microfacet:{summary:'细小切面形成分段反光；保留原子球轮廓、元素色和原子坐标。',cost:'中：程序表面法线'},
  sintered:{summary:'细密凹坑与微颗粒反射；纹理不表示计算得到的孔隙，也不改变原子几何。',cost:'中：程序表面法线'},
  hammered:{summary:'不规则浅凹面形成局部金属反光；元素色保留，化学键使用简化表面。',cost:'中：金属凹凸'},
  carbonfiber:{summary:'交错编织、细纤维与清漆反光；使用元素色调，化学键保留清晰的光滑连接。',cost:'中：分层表面'},
  amber:{summary:'暖金吸收、IOR 1.55 与实时透射；作用于原子和键，不生成包裹整个晶体的树脂块。',cost:'高：透射'},
  silicone:{summary:'粗糙度 0.95 与柔和织物光泽；保留元素色，适合柔性材料示意。',cost:'中：PBR'},
  kintsugi:{summary:'黑陶底与程序化金色裂纹；裂纹仅作装饰，不代表真实缺陷或晶界。',cost:'中：程序纹理'},
  watercolor:{summary:'浅色颜料、边缘积墨与固定纸纤维纹理；模型旋转时纹理随物体移动。',cost:'低：着色器'},
  cyber:{summary:'静态发光经纬线与细亮键；无持续闪烁，不额外启动动画循环。',cost:'低：程序网格',background:'#05080f'},
  lidar:{summary:'以固定程序点阵表现原子表面；保留球体拾取和边界，不生成海量独立粒子。',cost:'低：点阵着色器',background:'#05080f'},
  ice:{summary:'冷色透射与程序裂隙；不含路径追踪多次内反射或真实冰相结构。',cost:'高：透射'},
};
export function materialBackground(type:PresetMaterialType,fallback:string){return MATERIAL_INFO[type]?.background??fallback;}

export const SURFACE_MATERIALS: readonly PresetMaterialType[]=['microfacet','sintered','hammered','carbonfiber'];
/** Import compatibility only: these ids never appear in the active catalog. */
export const REMOVED_MATERIALS: Readonly<Record<string,PresetMaterialType>>={sem:'smooth',haadf:'smooth',hrtem:'smooth',afm:'smooth',esp:'smooth',orbital:'smooth',spin:'smooth',bfactor:'smooth'};
export function retiredMaterialFallback(id:string):PresetMaterialType|undefined{return Object.prototype.hasOwnProperty.call(REMOVED_MATERIALS,id)?REMOVED_MATERIALS[id]:undefined;}
export function materialMigrationNotice(id:string){return `旧材质 ${id} 已移除，已回退为 Studio PBR；结构及原始数据保留。`;}
