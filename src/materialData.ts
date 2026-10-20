import type {Atom,CrystalStructure,PresetMaterialType} from './types/crystal';
import {getElement} from './constants/elements';

export type ScalarKey='esp'|'orbital'|'spin'|'bFactor';
const columns:Record<string,ScalarKey>={esp_V:'esp',orbital_amplitude:'orbital',spin_muB:'spin',b_factor_A2:'bFactor'};
export function importAtomScalars(text:string,structure:CrystalStructure,sourceName:string):CrystalStructure{
  if(new TextEncoder().encode(text).length>1024*1024)throw new Error('原子标量 CSV 超过 1 MiB。');
  const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(s=>s.trim()&&!s.trim().startsWith('#'));
  const headers=lines.shift()?.split(',').map(s=>s.trim())??[];
  if(headers[0]!=='atom_id'||headers.length<2||new Set(headers).size!==headers.length||headers.slice(1).some(h=>!Object.prototype.hasOwnProperty.call(columns,h)))throw new Error('CSV 首列须为 atom_id，其余可为 esp_V、orbital_amplitude、spin_muB、b_factor_A2。');
  const ids=new Set(structure.atoms.map(a=>a.id)),records=new Map<number,NonNullable<Atom['scalarData']>>();
  for(const line of lines){
    const values=line.split(',').map(s=>s.trim());
    if(values.length!==headers.length||!/^\d+$/.test(values[0]))throw new Error('CSV 行列数量或原子 ID 无效。');
    const id=Number(values[0]);if(!ids.has(id)||records.has(id))throw new Error(`CSV 原子 ID ${id} 不存在或重复。`);
    const data:NonNullable<Atom['scalarData']>={};
    for(let i=1;i<values.length;i++)if(values[i]!==''){
      if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(values[i]))throw new Error(`CSV ${headers[i]} 包含无效数值。`);
      const value=Number(values[i]),key=columns[headers[i]];
      if(!Number.isFinite(value)||Math.abs(value)>1e9||(key==='bFactor'&&value<0))throw new Error(`CSV ${headers[i]} 超出有效范围。`);
      data[key]=value;
    }
    if(Object.keys(data).length===0)throw new Error(`CSV 原子 ${id} 没有标量。`);
    records.set(id,data);
  }
  if(!records.size)throw new Error('CSV 没有数据行。');
  // Replace the previous dataset, so omitted atoms/columns never retain stale values.
  return {...structure,scalarSource:sourceName.slice(0,1000),atoms:structure.atoms.map(a=>({...a,scalarData:records.get(a.id)}))};
}
export function thermalB(atom:Atom){
  if(atom.scalarData?.bFactor!==undefined)return atom.scalarData.bFactor;
  return atom.displacement ? 8*Math.PI**2*(atom.displacement[0]+atom.displacement[1]+atom.displacement[2])/3 : undefined;
}
export function materialSource(type:PresetMaterialType,structure:CrystalStructure|null){
  if(type==='bfactor'&&structure){
    const csv=structure.atoms.some(a=>a.scalarData?.bFactor!==undefined);
    const cif=structure.atoms.some(a=>a.scalarData?.bFactor===undefined&&a.displacement!==undefined);
    if(cif)return csv?`${structure.scalarSource??'CSV'} + CIF U_cart`:'CIF U_cart';
  }
  return structure?.scalarSource;
}
export function scalarValue(type:PresetMaterialType,atom:Atom):number|undefined{
  if(type==='afm')return atom.cartesian.z;
  if(type==='haadf'){const z=getElement(atom.element).number;return z>0?Math.pow(z,1.7):undefined;}
  if(type==='bfactor')return thermalB(atom);
  if(type==='esp'||type==='orbital'||type==='spin')return atom.scalarData?.[type];
  return undefined;
}
export function materialRange(type:PresetMaterialType,structure:CrystalStructure|null){
  const values=(structure?.atoms??[]).map(a=>scalarValue(type,a)).filter((v):v is number=>v!==undefined&&Number.isFinite(v));
  if(!values.length)return {min:0,max:0,count:0,total:structure?.atoms.length??0,unit:type==='esp'?'V':type==='spin'?'μB':type==='bfactor'?'Å²':type==='afm'?'Å':'a.u.'};
  let min=Math.min(...values),max=Math.max(...values);
  if(['esp','orbital','spin'].includes(type)){max=Math.max(Math.abs(min),Math.abs(max));min=-max;}
  return {min,max,count:values.length,total:structure!.atoms.length,unit:type==='esp'?'V':type==='spin'?'μB':type==='bfactor'?'Å²':type==='afm'?'Å':'a.u.'};
}
const rgb=(values:number[])=>'#'+values.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
export function mappedColor(type:PresetMaterialType,value:number|undefined,min:number,max:number):string{
  if(value===undefined)return '#7f8b99';
  const t=max===min ? 0.5 : Math.max(0,Math.min(1,(value-min)/(max-min)));
  const stops=type==='afm'?[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]]:type==='bfactor'?[[12,7,38],[91,19,90],[183,38,53],[245,108,24],[255,211,86],[255,255,242]]:[[190,35,45],[247,247,247],[35,88,187]];
  if(type==='orbital')return value===0?'#7f8b99':value<0?'#2864db':'#f28c28';
  if(type==='spin')return value===0?'#7f8b99':value<0?'#22d3ee':'#f4bf45';
  const p=t*(stops.length-1),i=Math.min(stops.length-2,Math.floor(p)),f=p-i;
  return rgb(stops[i].map((v,k)=>v*(1-f)+stops[i+1][k]*f));
}
