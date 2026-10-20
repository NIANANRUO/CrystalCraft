import type { CrystalStructure, VolumeData, VolumeSettings } from '../types/crystal';
import { calculateLatticeFromMatrix, fractionalToCartesian } from '../utils/math';

export const MAX_VOLUME_BYTES = 1024 * 1024 * 1024;
export const MAX_GRID_POINTS = 262144;
export const volumeKind = (filename: string) => filename.match(/(?:^|[.])(?:CHGCAR|CHGDIFF|LOCPOT|ELFCAR)(?=[._-]|$)/i)?.[0].replace(/^\./, '').toUpperCase() as VolumeData['kind'] | undefined;
export function assertVolumeData(data: VolumeData, structure: CrystalStructure) {
  if (!data || !['CHGCAR', 'CHGDIFF', 'LOCPOT', 'ELFCAR', 'SYNTHETIC'].includes(data.kind) || typeof data.sourceName !== 'string' || typeof data.units !== 'string' || data.sourceName.length > 1000 || data.units.length > 100) throw new Error('体数据类型或描述无效。');
  if (!Array.isArray(data.dimensions) || data.dimensions.length !== 3 || !data.dimensions.every(n => Number.isInteger(n) && n >= 2 && n <= 512)) throw new Error('体网格三个维度必须为 2–512 的整数。');
  const count = data.dimensions.reduce((a,b) => a*b, 1);
  if(data.originalDimensions!==undefined||data.samplingSteps!==undefined){
    if(!Array.isArray(data.originalDimensions)||data.originalDimensions.length!==3||!data.originalDimensions.every(n=>Number.isSafeInteger(n)&&n>=2&&n<=4096)||data.originalDimensions.reduce((a,b)=>a*b,1)>200000000||!Array.isArray(data.samplingSteps)||data.samplingSteps.length!==3||!data.samplingSteps.every((n,i)=>Number.isSafeInteger(n)&&n>=1&&n*data.dimensions[i]===data.originalDimensions![i]))throw new Error('体数据降采样记录无效。');
  }
  if(data.sourceBytes!==undefined&&(!Number.isSafeInteger(data.sourceBytes)||data.sourceBytes<0||data.sourceBytes>MAX_VOLUME_BYTES))throw new Error('体数据源文件大小无效。');
  if (count > MAX_GRID_POINTS) throw new Error('单通道体网格超过 262,144 点，请先降采样。');
  if (!structure.isPeriodic || !structure.lattice || JSON.stringify(data.latticeMatrix) !== JSON.stringify(structure.lattice.matrix)) throw new Error('体数据晶格与结构不一致；请先移除体数据，再进行晶胞变换。');
  if (!Array.isArray(data.channels) || data.channels.length < 1 || data.channels.length > 4) throw new Error('体数据需要 1–4 个通道。');
  for (const channel of data.channels) {
    if (!channel || typeof channel.label !== 'string' || channel.label.length > 100 || !Array.isArray(channel.values) || channel.values.length !== count || !channel.values.every(Number.isFinite)) throw new Error('体网格采样数量不匹配或包含无效数值。');
    let min = Infinity, max = -Infinity;
    for (const value of channel.values) { min = Math.min(min, value); max = Math.max(max, value); }
    if (min !== channel.min || max !== channel.max) throw new Error('体数据范围与采样值不一致。');
    if(channel.sourceStats){const s=channel.sourceStats;if(![s.min,s.max,s.mean].every(Number.isFinite)||s.min>s.max||s.mean<s.min-1e-9||s.mean>s.max+1e-9||s.count!==(data.originalDimensions??data.dimensions).reduce((a,b)=>a*b,1)||min<s.min-1e-9||max>s.max+1e-9)throw new Error('原始网格统计记录无效。');}
  }
  if (!Number.isSafeInteger(data.augmentationBlocks) || data.augmentationBlocks < 0) throw new Error('PAW 数据块计数无效。');
}
export function defaultVolumeSettings(data?: VolumeData): VolumeSettings {
  const channel = data?.channels[0];
  return { channel: 0, isoEnabled: !!data, isoValue: data?.kind==='CHGDIFF'?Math.min(.003,Math.max(Math.abs(channel!.min),Math.abs(channel!.max))*.15||.003):channel ? channel.min + (channel.max - channel.min) * .45 : .1,
    paired: data?.kind==='CHGDIFF', isoColor: '#ed8936', negativeColor: '#3182ce', isoOpacity: .65, stride: 0,
    sectionEnabled: false, sectionAxis: 'c', sectionPosition: .5, sectionOpacity: .9, palette: data?.kind==='CHGDIFF'?'diverging':'viridis', rangeMin: null, rangeMax: null };
}
export function assertVolumeSettings(s: VolumeSettings, data?: VolumeData) {
  const finite = (v: unknown, a: number, b: number) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
  if (!s || !Number.isInteger(s.channel) || s.channel < 0 || s.channel > 3 || (data && s.channel >= data.channels.length) ||
    !Number.isFinite(s.isoValue) || ![0,1,2,4,8].includes(s.stride) || !['a','b','c'].includes(s.sectionAxis) ||
    !finite(s.isoOpacity, .05, 1) || !finite(s.sectionOpacity, .05, 1) || !finite(s.sectionPosition, 0, 1) ||
    !['isoEnabled','paired','sectionEnabled'].every(k => typeof s[k as keyof VolumeSettings] === 'boolean') ||
    !/^#[a-f\d]{6}$/i.test(s.isoColor) || !/^#[a-f\d]{6}$/i.test(s.negativeColor) || !['viridis','diverging'].includes(s.palette) ||
    !(s.rangeMin === null || Number.isFinite(s.rangeMin)) || !(s.rangeMax === null || Number.isFinite(s.rangeMax)) ||
    (s.rangeMin !== null && s.rangeMax !== null && s.rangeMin >= s.rangeMax)) throw new Error('体绘制参数无效，请检查通道、颜色范围和透明度。');
}
export function createDemoVolume(): CrystalStructure {
  const matrix: VolumeData['latticeMatrix'] = [{x:6,y:0,z:0},{x:1.2,y:6,z:0},{x:0,y:.7,z:6}];
  const lattice = calculateLatticeFromMatrix(matrix), dimensions: [number,number,number] = [24,24,24], values: number[] = [];
  for (let k=0;k<24;k++) for(let j=0;j<24;j++) for(let i=0;i<24;i++) {
    const x=i/24,y=j/24,z=k/24;
    values.push(Math.exp(-45*((x-.36)**2+(y-.5)**2+(z-.5)**2))-.8*Math.exp(-45*((x-.67)**2+(y-.5)**2+(z-.5)**2)));
  }
  const atoms = [.36,.67].map((x,i) => { const fractional={x,y:.5,z:.5}; return { id:i+1,element:'H',fractional,cartesian:fractionalToCartesian(fractional,matrix) }; });
  return { title:'合成双高斯场（演示数据）', isPeriodic:true, lattice, atoms,
    volumeData: { kind:'SYNTHETIC', sourceName:'合成数学场，不是实验/计算结果', dimensions, latticeMatrix:matrix, units:'任意单位', augmentationBlocks:0,
      channels:[{label:'正负双高斯',values,min:Math.min(...values),max:Math.max(...values)}] } };
}
