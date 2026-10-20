import { parsePOSCAR } from './poscar';
import { assertAtomCount, parseFiniteNumber } from '../utils/validation';
import type { VolumeData } from '../types/crystal';
import { MAX_VOLUME_BYTES, MAX_GRID_POINTS, assertVolumeData, volumeKind } from '../volume/data';

/** VASP ordering: x fastest, z slowest, samples at (i/nx,j/ny,k/nz). */
export function parseVaspVolume(content: string, filename: string) {
  if (content.length > 32*1024*1024 || new TextEncoder().encode(content).length > 32*1024*1024 || content.includes('\0')) throw new Error('文本模式体数据最多 32 MiB；较大文件请使用文件导入入口分块读取。');
  const kind = volumeKind(filename);
  if (!kind || kind === 'SYNTHETIC') throw new Error('请选择命名为 CHGCAR、LOCPOT 或 ELFCAR 的文件。');
  const lines = content.replace(/^\uFEFF/, '').split(/\r\n?|\n/);
  let cursor = 5;
  const next = () => { while(cursor < lines.length && !lines[cursor].trim()) cursor++; return lines[cursor++]?.trim(); };
  let counts = next()?.split(/[#!]/)[0].trim().split(/\s+/) ?? [];
  if (!counts.every(s => /^\d+$/.test(s))) counts = next()?.split(/[#!]/)[0].trim().split(/\s+/) ?? [];
  if (!counts.length || !counts.every(s => /^\d+$/.test(s))) throw new Error('体数据 POSCAR 原子计数无效。');
  const totalAtoms = counts.reduce((n,s) => n+Number(s),0); assertAtomCount(totalAtoms);
  let coordinateMode = next(); if (/^s/i.test(coordinateMode ?? '')) coordinateMode = next();
  if (!/^[dcfk]/i.test(coordinateMode ?? '')) throw new Error('体数据缺少坐标模式。');
  for(let i=0;i<totalAtoms;i++) if (!next()) throw new Error('体数据原子坐标被截断。');
  const structure = parsePOSCAR(lines.slice(0,cursor).join('\n'), filename);
  const channels: VolumeData['channels'] = []; let dimensions: VolumeData['dimensions'] | undefined; let augmentationBlocks=0;
  const readValues = (count: number) => {
    const values: number[]=[];
    while(values.length<count) {
      const line = next(); if (!line) throw new Error('体网格或 PAW 数据被截断。');
      const row=line.split(/\s+/); if(values.length+row.length>count) throw new Error('体网格数据块含多余采样值。');
      row.forEach(token => values.push(parseFiniteNumber(token,'体网格值')));
    }
    return values;
  };
  for(let line=next();line!==undefined;line=next()) {
    if (/^augmentation\s+occupancies\b/i.test(line)) {
      if(!channels.length)throw new Error('PAW 块必须位于体网格数据之后。');
      const match=line.match(/^augmentation\s+occupancies\s+(\d+)\s+(\d+)\s*$/i);
      if(!match || Number(match[1])<1 || Number(match[1])>totalAtoms || !Number.isSafeInteger(Number(match[2])) || Number(match[2])>100000) throw new Error('PAW augmentation 块头无效。');
      readValues(Number(match[2])); augmentationBlocks++; continue;
    }
    if(!/^\d+\s+\d+\s+\d+$/.test(line)) throw new Error('体数据出现未知尾部或不支持的网格格式。');
    const dims=line.split(/\s+/).map(Number) as [number,number,number];
    const count=dims.reduce((a,b)=>a*b,1);
    if(!dims.every(n=>Number.isInteger(n)&&n>=2&&n<=512)||count>MAX_GRID_POINTS) throw new Error('体网格须每维 2–512，且单通道不超过 262,144 点；请先降采样。');
    if(dimensions && dims.some((n,i)=>n!==dimensions![i])) throw new Error('各体数据通道网格尺寸必须一致。');
    dimensions=dims;
    if(channels.length>=4) throw new Error('最多支持四个体数据通道。');
    const values=readValues(count);
    // VASP's explicit n(r)=data(r)/Vcell convention; ELFCAR and LOCPOT are unscaled.
    if(kind==='CHGCAR'||kind==='CHGDIFF') for(let i=0;i<values.length;i++) values[i]/=structure.lattice!.volume;
    let min=Infinity,max=-Infinity; for(const v of values) { min=Math.min(min,v);max=Math.max(max,v); }
    channels.push({label:`${kind} 数据块 ${channels.length+1}`,values,min,max});
  }
  if(!dimensions||!channels.length) throw new Error('文件中没有完整体网格。');
  if(kind==='ELFCAR'&&channels.length===2)channels.forEach((channel,i)=>{channel.label=i===0?'ELF ↑（第一通道）':'ELF ↓（第二通道）';});
  structure.volumeData={kind,sourceName:filename,dimensions,latticeMatrix:structure.lattice!.matrix,channels,units:kind==='CHGCAR'||kind==='CHGDIFF'?'Å⁻³':kind==='LOCPOT'?'eV':'无量纲',augmentationBlocks};
  assertVolumeData(structure.volumeData,structure);
  return structure;
}
