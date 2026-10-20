import React,{useRef,useState} from 'react';
import type { CrystalStructure, VisualSettings, VolumeSettings } from '../types/crystal';
import { createDemoVolume, defaultVolumeSettings } from '../volume/data';
import { sectionCSV } from '../volume/geometry';

interface Props { tab:'isosurfaces'|'sections';structure:CrystalStructure|null;settings:VisualSettings;
  update:(value:Partial<VisualSettings>)=>void;restore?:(value:CrystalStructure)=>void;upload?:(file:File)=>void }
export function VolumePanel({tab,structure,settings,update,restore,upload}:Props){
  const input=useRef<HTMLInputElement>(null),[error,setError]=useState<string|null>(null);
  const data=structure?.volumeData,s=settings.volumeSettings??defaultVolumeSettings(data),section=tab==='sections';
  const patch=(value:Partial<VolumeSettings>)=>update({volumeSettings:{...s,...value}});
  const setRange=(key:'rangeMin'|'rangeMax',text:string)=>{
    const value=text===''?null:Number(text);if(value!==null&&!Number.isFinite(value))return;
    const next={...s,[key]:value},channel=data!.channels[s.channel];
    if((next.rangeMin??channel.min)>=(next.rangeMax??channel.max)&&(next.rangeMin!==null||next.rangeMax!==null)){setError('色标下限须小于上限，请先调整另一端或清空为自动。');return;}
    setError(null);patch({[key]:value});
  };
  const number=(label:string,value:number,change:(n:number)=>void,props:React.InputHTMLAttributes<HTMLInputElement>={})=><label className="flex items-center justify-between gap-2">{label}<input type="number" aria-label={label} value={value} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n))change(n);}} className="w-28 rounded border border-slate-300 bg-white px-2 py-1" {...props}/></label>;
  const download=()=>{try{if(!data)return;const url=URL.createObjectURL(new Blob([sectionCSV(data,s)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${data.kind}-section-${s.sectionAxis}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setError(null);}catch(e){setError(e instanceof Error?e.message:String(e));}};
  return <div className="space-y-3 text-xs text-slate-700">
    <div className="flex flex-wrap gap-2">
      <input ref={input} aria-label="导入体数据文件" className="hidden" type="file" onChange={e=>{const file=e.target.files?.[0];if(file)upload?.(file);e.target.value='';}}/>
      <button type="button" onClick={()=>input.current?.click()} className="rounded border border-slate-300 bg-white px-3 py-2">导入 CHGCAR / CHGDIFF / LOCPOT / ELFCAR</button>
      <button type="button" onClick={()=>{const demo=createDemoVolume();restore?.(demo);update({volumeSettings:{...defaultVolumeSettings(demo.volumeData),isoEnabled:!section,paired:!section,isoValue:.25,sectionEnabled:section,palette:'diverging'}});}} className="rounded border border-slate-300 bg-white px-3 py-2">载入合成体数据演示</button>
      {data&&<button type="button" onClick={()=>{if(structure)restore?.({...structure,volumeData:undefined});update({volumeSettings:undefined});}} className="rounded border border-slate-300 px-3 py-2">移除体数据</button>}
    </div>
    {!data?<p className="rounded border border-blue-200 bg-blue-50 p-3">导入计算得到的体网格，或载入明确标记的合成示例。导入将同时载入文件中的晶胞与原子坐标。</p>:<>
      <div className="space-y-1 rounded border border-slate-300 bg-slate-50 p-3">
        <p className="font-semibold">{data.sourceName}</p>
        <p>网格：{data.dimensions.join(' × ')} · {data.channels.length} 通道 · 单位：{data.units}</p>
        <p>CHGCAR/CHGDIFF 按 VASP CHGCAR 约定除以晶胞体积；LOCPOT 保留 eV，ELFCAR 保留原始函数值。PAW 占据矩阵不参与体绘制（{data.augmentationBlocks} 块）。</p>
        {data.originalDimensions&&<p>原始网格：{data.originalDimensions.join(' × ')} → 展示网格：{data.dimensions.join(' × ')}；等步长抽样 {data.samplingSteps?.join(' × ')}。原始全网格已扫描，展示和 CSV 使用抽样网格，项目文件保存展示网格。</p>}
        {data.channels[s.channel]?.sourceStats&&<p>原网格范围：{data.channels[s.channel].sourceStats!.min.toPrecision(6)} — {data.channels[s.channel].sourceStats!.max.toPrecision(6)}；均值：{data.channels[s.channel].sourceStats!.mean.toPrecision(6)} {data.units}</p>}
        <p>体数据来自导入计算，不会因原子编辑重新计算；更改晶胞前请先移除体数据。</p>
      </div>
      <label className="flex items-center justify-between gap-2">数据通道<select aria-label="体数据通道" value={s.channel} onChange={e=>{const channel=Number(e.target.value),c=data.channels[channel];patch({channel,isoValue:c.min+(c.max-c.min)*.45,rangeMin:null,rangeMax:null});}} className="rounded border border-slate-300 bg-white p-1">{data.channels.map((c,i)=><option key={i} value={i}>{c.label}</option>)}</select></label>
      <p>当前范围：{data.channels[s.channel]?.min.toPrecision(6)} — {data.channels[s.channel]?.max.toPrecision(6)} {data.units}</p>
      {!section?<fieldset className="space-y-3 rounded border border-slate-300 p-3"><legend className="px-1 font-semibold">等值面</legend>
        <label className="flex items-center gap-2"><input type="checkbox" checked={s.isoEnabled} onChange={e=>patch({isoEnabled:e.target.checked})}/>显示等值面</label>
        {number('等值面阈值',s.isoValue,isoValue=>patch({isoValue}),{step:'any'})}
        <label className="flex items-center gap-2"><input type="checkbox" checked={s.paired} onChange={e=>patch({paired:e.target.checked})}/>同时显示相反等值（±）</label>
        <label className="flex items-center justify-between">等值面颜色<input aria-label="等值面颜色" type="color" value={s.isoColor} onChange={e=>patch({isoColor:e.target.value})}/></label>
        <label className="flex items-center justify-between">相反等值颜色<input aria-label="相反等值颜色" type="color" value={s.negativeColor} onChange={e=>patch({negativeColor:e.target.value})}/></label>
        {number('等值面透明度',s.isoOpacity,n=>{if(n>=.05&&n<=1)patch({isoOpacity:n});},{min:.05,max:1,step:.05})}
        <label className="flex items-center justify-between">采样步长<select aria-label="等值面采样步长" value={s.stride} onChange={e=>patch({stride:Number(e.target.value)})} className="rounded border border-slate-300 p-1">{[0,1,2,4,8].map(n=><option key={n} value={n}>{n===0?'自动（最多 300,000 单元）':`${n} 个网格步长`}</option>)}</select></label>
        <p className="text-slate-500">使用周期网格和 Marching Tetrahedra。步长会影响几何精度；双等值面合计最多 150,000 三角形。阈值超出范围时该等值面为空。</p>
      </fieldset>:<fieldset className="space-y-3 rounded border border-slate-300 p-3"><legend className="px-1 font-semibold">二维晶胞切片</legend>
        <label className="flex items-center gap-2"><input type="checkbox" checked={s.sectionEnabled} onChange={e=>patch({sectionEnabled:e.target.checked})}/>显示二维切片</label>
        <label className="flex items-center justify-between">固定分数坐标轴<select aria-label="切片坐标轴" value={s.sectionAxis} onChange={e=>patch({sectionAxis:e.target.value as 'a'|'b'|'c'})} className="rounded border border-slate-300 p-1"><option value="a">a（bc 面）</option><option value="b">b（ac 面）</option><option value="c">c（ab 面）</option></select></label>
        {number('切片分数位置',s.sectionPosition,n=>{if(n>=0&&n<=1)patch({sectionPosition:n});},{min:0,max:1,step:.01})}
        <input aria-label="切片位置滑块" type="range" min="0" max="1" step=".01" value={s.sectionPosition} onChange={e=>patch({sectionPosition:Number(e.target.value)})} className="w-full"/>
        {number('切片透明度',s.sectionOpacity,n=>{if(n>=.05&&n<=1)patch({sectionOpacity:n});},{min:.05,max:1,step:.05})}
        <label className="flex items-center justify-between">切片色图<select aria-label="切片色图" value={s.palette} onChange={e=>patch({palette:e.target.value as VolumeSettings['palette']})} className="rounded border border-slate-300 p-1"><option value="viridis">Viridis 连续</option><option value="diverging">蓝白橙发散</option></select></label>
        <div className="grid grid-cols-2 gap-2">{(['rangeMin','rangeMax'] as const).map((key,i)=><label key={key}>{i?'色标上限':'色标下限'}<input aria-label={i?'色标上限':'色标下限'} placeholder="自动" type="number" step="any" value={s[key]??''} onChange={e=>setRange(key,e.target.value)} className="mt-1 w-full rounded border border-slate-300 p-1"/></label>)}</div>
        <button type="button" onClick={download} className="rounded border border-slate-300 bg-white px-3 py-2">导出当前切片 CSV</button>
        <p className="text-slate-500">周期三线性插值，显示与 CSV 使用同一采样；每个切片方向最多 256 点。固定分数坐标平面适用于斜晶胞。</p>
      </fieldset>}
    </>}
    {error&&<p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
