import React,{useState} from 'react';
import type { VisualSettings } from '../types/crystal';
export function IonicRadiusEditor({element,settings,update}:{element:string;settings:VisualSettings;update:(s:Partial<VisualSettings>)=>void}){
  const saved=settings.ionicRadii?.[element], [charge,setCharge]=useState(saved?String(saved.charge):''),[cn,setCn]=useState(saved?String(saved.coordination):''),[radius,setRadius]=useState(saved?String(saved.radius):''),[error,setError]=useState('');
  const apply=()=>{const c=Number(charge),n=Number(cn),r=Number(radius);if(!charge.trim()||!cn.trim()||!radius.trim()||!Number.isInteger(c)||c===0||c< -8||c>8||!Number.isInteger(n)||n<1||n>16||!Number.isFinite(r)||r<=0||r>5){setError('请输入非零整数价态（−8..8）、配位数（1..16）和半径（0..5 Å）。');return;}update({radiiType:'ionic',ionicRadii:{...settings.ionicRadii,[element]:{charge:c,coordination:n,radius:r}}});setError('');};
  return <div className="mt-2 space-y-2 rounded border border-blue-200 bg-blue-50 p-2 text-[11px]">
    <p>{element} 离子半径：请录入已核实的来源值；同一元素当前采用一组价态/配位参数。未指定元素使用默认显示半径，单点或元素半径覆盖优先。</p>
    <div className="flex flex-wrap items-end gap-2">{[['价态',charge,setCharge],['配位数',cn,setCn],['离子半径 Å',radius,setRadius]].map(([label,value,set])=><label key={String(label)} className="flex flex-col gap-1">{String(label)}<input aria-label={String(label)} type="number" step={label==='离子半径 Å'?'any':'1'} value={value as string} onChange={e=>(set as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} className="w-24 rounded border border-slate-300 bg-white px-2 py-1"/></label>)}
      <button type="button" onClick={apply} className="rounded border border-blue-300 bg-white px-2 py-1">应用离子半径</button>
      {saved&&<button type="button" onClick={()=>{const values={...settings.ionicRadii};delete values[element];update({ionicRadii:values});setRadius('');}} className="rounded border border-slate-300 px-2 py-1">清除该元素离子值</button>}
    </div>{error&&<p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
