import React from 'react';
import type {PresetMaterialType,VisualSettings} from '../types/crystal';
import {MATERIAL_INFO,SURFACE_MATERIALS} from '../materialCatalog';

export function MaterialDetails({type,settings,update}:{type:PresetMaterialType;settings:VisualSettings;update:(settings:Partial<VisualSettings>)=>void}){
  const info=MATERIAL_INFO[type];if(!info)return null;
  return <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-700" aria-label="材质说明">
    <p>{info.summary}</p><p className="text-slate-500">{info.cost}</p>
    {SURFACE_MATERIALS.includes(type)&&<>
      <label className="flex items-center justify-between gap-2">纹理强度<input aria-label="纹理强度" type="number" min="0" max="1" step=".05" value={settings.textureStrength??.65} className="w-20 rounded border border-slate-300 bg-white px-2 py-1" onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=0&&n<=1)update({textureStrength:n});}}/></label>
      <input aria-label="纹理强度滑块" type="range" min="0" max="1" step=".05" value={settings.textureStrength??.65} className="w-full" onChange={e=>update({textureStrength:Number(e.target.value)})}/>
      <label className="flex items-center justify-between gap-2">纹理尺度<input aria-label="纹理尺度" type="number" min="4" max="24" step="1" value={settings.textureScale??12} className="w-20 rounded border border-slate-300 bg-white px-2 py-1" onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=4&&n<=24)update({textureScale:n});}}/></label>
      <p>尺度越大，纹理越细。四种表面共享当前参数；细小原子自动减弱纹理，化学键保持简洁连接。</p>
      <button type="button" onClick={()=>update({textureStrength:.65,textureScale:12})} className="rounded border border-slate-300 bg-white px-2 py-1">恢复纹理默认值</button>
    </>}
  </div>;
}
