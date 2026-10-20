import type {CrystalStructure,PresetMaterialType,VisualSettings} from '../types/crystal';
import {MATERIAL_INFO,MATERIAL_GROUPS,SURFACE_MATERIALS} from '../materialCatalog';

export function drawMaterialCaption(ctx:CanvasRenderingContext2D,width:number,height:number,type:PresetMaterialType,_structure:CrystalStructure,settings?:VisualSettings){
  if(!MATERIAL_INFO[type])return;
  const lines=[MATERIAL_GROUPS.flatMap(g=>g.items).find(m=>m.id===type)?.label??type,'表面渲染 · 结构坐标保持原样'];
  if(SURFACE_MATERIALS.includes(type))lines.push(`纹理强度 ${Math.round((settings?.textureStrength??.65)*100)}% · 尺度 ${settings?.textureScale??12}`);
  const size=Math.max(12,Math.round(width/95)),padding=size*.65,lineHeight=size*1.45;
  ctx.save();ctx.font=`${size}px "Segoe UI", "Microsoft YaHei", sans-serif`;ctx.textBaseline='top';
  const boxWidth=Math.min(width-padding*2,Math.max(...lines.map(l=>ctx.measureText(l).width))+padding*2),y=Math.max(padding,height-lines.length*lineHeight-padding*3);
  ctx.fillStyle='rgba(255,255,255,0.94)';ctx.fillRect(padding,y,boxWidth,lines.length*lineHeight+padding*2);
  ctx.fillStyle='#172338';lines.forEach((line,i)=>ctx.fillText(line,padding*2,y+padding+i*lineHeight,boxWidth-padding*2));ctx.restore();
}
