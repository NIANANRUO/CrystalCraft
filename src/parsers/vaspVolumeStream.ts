import type { VolumeData } from '../types/crystal';
import {parsePOSCAR} from './poscar';
import {assertAtomCount,parseFiniteNumber} from '../utils/validation';
import {volumeKind,MAX_VOLUME_BYTES,MAX_GRID_POINTS,assertVolumeData} from '../volume/data';

export interface ImportProgress {loaded:number;total:number}
async function* fileLines(file:File,progress?:(p:ImportProgress)=>void){
  const reader=file.stream().getReader(),decoder=new TextDecoder();let carry='',loaded=0,last=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;loaded+=value.byteLength;carry+=decoder.decode(value,{stream:true});
      let start=0,index=carry.indexOf('\n');while(index!==-1){yield carry.slice(start,index).replace(/\r$/,'');start=index+1;index=carry.indexOf('\n',start);}carry=carry.slice(start);
      if(carry.length>1024*1024)throw new Error('体数据单行过长。');
      if(performance.now()-last>250){progress?.({loaded,total:file.size});last=performance.now();}
    }
    carry+=decoder.decode();if(carry)yield carry.replace(/\r$/,'');progress?.({loaded:file.size,total:file.size});
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
/** Retained samples have exact source fractional coordinates; every source value is scanned. */
export function samplingGrid(original:[number,number,number]){
  const dimensions=[...original] as [number,number,number],steps:[number,number,number]=[1,1,1];
  while(dimensions.reduce((a,b)=>a*b,1)>MAX_GRID_POINTS||dimensions.some(n=>n>512)){
    const candidates=[0,1,2].map(axis=>{let next=steps[axis]+1;while(next<=original[axis]/2&&original[axis]%next)next++;return {axis,next,size:original[axis]/next};}).filter(c=>Number.isInteger(c.size)&&c.size>=2).sort((a,b)=>dimensions[b.axis]-dimensions[a.axis]);
    if(!candidates.length)throw new Error('此网格无法在预算内等步长抽样，请先在专业工具中重采样。');
    const {axis,next,size}=candidates[0];steps[axis]=next;dimensions[axis]=size;
  }
  return {dimensions,steps};
}
export async function parseVaspVolumeFile(file:File,progress?:(p:ImportProgress)=>void){
  if(file.size>MAX_VOLUME_BYTES)throw new Error('体数据文件超过 1 GiB。');
  const kind=volumeKind(file.name);if(!kind||kind==='SYNTHETIC')throw new Error('未知体数据文件名。');
  const iterator=fileLines(file,progress)[Symbol.asyncIterator](),header:string[]=[];
  const raw=async()=>{const item=await iterator.next();return item.done?undefined:item.value;};
  const next=async()=>{let line;do{line=await raw();}while(line!==undefined&&!line.trim());return line?.trim();};
  for(let i=0;i<5;i++){const line=await raw();if(line===undefined)throw new Error('体数据结构头被截断。');header.push(line.replace(/^\uFEFF/,''));}
  let line=await next();if(line===undefined)throw new Error('缺少原子计数。');header.push(line);
  let counts=line.split(/[#!]/)[0].trim().split(/\s+/);
  if(!counts.every(v=>/^\d+$/.test(v))){line=await next();if(line===undefined)throw new Error('缺少原子计数。');header.push(line);counts=line.split(/[#!]/)[0].trim().split(/\s+/);}
  if(!counts.every(v=>/^\d+$/.test(v)))throw new Error('原子计数无效。');const atomCount=counts.reduce((n,v)=>n+Number(v),0);assertAtomCount(atomCount);
  line=await next();if(line===undefined)throw new Error('缺少坐标模式。');header.push(line);
  if(/^s/i.test(line)){line=await next();if(line===undefined)throw new Error('缺少坐标模式。');header.push(line);}
  for(let i=0;i<atomCount;i++){line=await next();if(line===undefined)throw new Error('原子坐标被截断。');header.push(line);}
  const structure=parsePOSCAR(header.join('\n'),file.name),channels:VolumeData['channels']=[];
  let original:[number,number,number]|undefined,sampling:ReturnType<typeof samplingGrid>|undefined,augmentationBlocks=0;
  while((line=await next())!==undefined){
    if(/^augmentation\s+occupancies\b/i.test(line)){
      const m=line.match(/^augmentation\s+occupancies\s+(\d+)\s+(\d+)\s*$/i);
      if(!m||!channels.length||Number(m[1])<1||Number(m[1])>atomCount||Number(m[2])>100000)throw new Error('PAW 块头无效。');
      let remaining=Number(m[2]);while(remaining){const row=await next();if(!row)throw new Error('PAW 块被截断。');const tokens=row.split(/\s+/);remaining-=tokens.length;if(remaining<0)throw new Error('PAW 块有多余数据。');tokens.forEach(v=>parseFiniteNumber(v,'PAW 数值'));}augmentationBlocks++;continue;
    }
    if(!/^\d+\s+\d+\s+\d+$/.test(line))throw new Error('无法识别体数据块或尾部。');
    const dims=line.split(/\s+/).map(Number) as [number,number,number],count=dims.reduce((a,b)=>a*b,1);
    if(!dims.every(n=>Number.isSafeInteger(n)&&n>=2&&n<=4096)||count>200000000)throw new Error('原始体网格超过安全读取预算。');
    if(original&&dims.some((v,i)=>v!==original![i]))throw new Error('体数据通道尺寸不一致。');
    original=dims;sampling??=samplingGrid(dims);if(channels.length>=4)throw new Error('最多支持四个通道。');
    const values=new Array<number>(sampling.dimensions.reduce((a,b)=>a*b,1));let index=0,minimum=Infinity,maximum=-Infinity,sum=0,correction=0;
    const divisor=kind==='CHGCAR'||kind==='CHGDIFF'?structure.lattice!.volume:1;
    while(index<count){const row=await next();if(row===undefined)throw new Error('体网格被截断。');const tokens=row.split(/\s+/);if(index+tokens.length>count)throw new Error('体网格块包含多余数值。');
      for(const token of tokens){const value=parseFiniteNumber(token,'体网格值')/divisor;if(!Number.isFinite(value))throw new Error('归一化体网格数值溢出。');minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);const y=value-correction,t=sum+y;correction=(t-sum)-y;sum=t;
        const x=index%dims[0],j=Math.floor(index/dims[0])%dims[1],z=Math.floor(index/(dims[0]*dims[1]));
        if(x%sampling.steps[0]===0&&j%sampling.steps[1]===0&&z%sampling.steps[2]===0){const target=x/sampling.steps[0]+j/sampling.steps[1]*sampling.dimensions[0]+z/sampling.steps[2]*sampling.dimensions[0]*sampling.dimensions[1];values[target]=value;}index++;
      }
    }
    let min=Infinity,max=-Infinity;for(const v of values){min=Math.min(min,v);max=Math.max(max,v);}
    channels.push({label:`${kind} 数据块 ${channels.length+1}`,values,min,max,sourceStats:{min:minimum,max:maximum,mean:sum/count,count}});
  }
  if(!original||!sampling||!channels.length)throw new Error('文件缺少体网格。');
  if(kind==='ELFCAR'&&channels.length===2)channels.forEach((channel,i)=>{channel.label=i===0?'ELF ↑（第一通道）':'ELF ↓（第二通道）';});
  structure.volumeData={kind,sourceName:file.name,dimensions:sampling.dimensions,latticeMatrix:structure.lattice!.matrix,originalDimensions:original,samplingSteps:sampling.steps,sourceBytes:file.size,channels,units:kind==='CHGCAR'||kind==='CHGDIFF'?'Å⁻³':kind==='LOCPOT'?'eV':'无量纲',augmentationBlocks};
  assertVolumeData(structure.volumeData,structure);return structure;
}
