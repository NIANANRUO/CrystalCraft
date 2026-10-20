import React from 'react';
import type {CrystalStructure,PresetMaterialType,VisualSettings} from '../types/crystal';
import {MATERIAL_INFO,MATERIAL_GROUPS,SURFACE_MATERIALS} from '../materialCatalog';

export function MaterialLegend({type,settings}:{type:PresetMaterialType;structure:CrystalStructure|null;settings?:VisualSettings}){
  if(!MATERIAL_INFO[type])return null;
  const name=MATERIAL_GROUPS.flatMap(g=>g.items).find(m=>m.id===type)?.label;
  return <div aria-label="材质图例" className="absolute right-3 top-3 z-20 max-w-[245px] rounded border border-slate-300 bg-white/95 p-2 text-[11px] leading-relaxed text-slate-800 shadow-sm">
    <div className="font-semibold">{name}</div>
    {SURFACE_MATERIALS.includes(type)&&<div>强度 {Math.round((settings?.textureStrength??.65)*100)}% · 尺度 {settings?.textureScale??12}</div>}
    <div>表面渲染 · 结构坐标保持原样</div>
  </div>;
}
