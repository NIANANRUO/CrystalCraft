import type { VolumeData, VolumeSettings, Vec3 } from '../types/crystal';
import { assertVolumeSettings } from './data';

export const MAX_VOLUME_TRIANGLES=150000;
export function sampleVolume(data: VolumeData, channel: number, f: number[]) {
  const d=data.dimensions, base=f.map((v,i)=>Math.floor(v*d[i])), t=f.map((v,i)=>v*d[i]-base[i]);
  const at=(x:number,y:number,z:number)=>data.channels[channel].values[((z%d[2]+d[2])%d[2]*d[1]+(y%d[1]+d[1])%d[1])*d[0]+(x%d[0]+d[0])%d[0]];
  let result=0;
  for(let z=0;z<2;z++) for(let y=0;y<2;y++) for(let x=0;x<2;x++) result+=at(base[0]+x,base[1]+y,base[2]+z)*(x?t[0]:1-t[0])*(y?t[1]:1-t[1])*(z?t[2]:1-t[2]);
  return result;
}
export function fieldRange(data: VolumeData, settings: VolumeSettings): [number,number] {
  const channel=data.channels[settings.channel];
  if(settings.palette==='diverging'&&settings.rangeMin===null&&settings.rangeMax===null&&channel.min<0&&channel.max>0){const magnitude=Math.max(-channel.min,channel.max);return [-magnitude,magnitude];}
  const min=settings.rangeMin??channel.min,max=settings.rangeMax??channel.max;
  if(min>max) throw new Error('色标下限不能大于上限。');
  return [min,max];
}
export function fieldColor(value:number,min:number,max:number,palette:VolumeSettings['palette']):number[] {
  const t=Math.max(0,Math.min(1,max===min ? .5 : (value-min)/(max-min)));
  const stops=palette==='viridis'?[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]]:[[33,102,172],[247,247,247],[230,97,1]];
  const index=t*(stops.length-1),a=Math.min(stops.length-2,Math.floor(index)),f=index-a;
  return stops[a].map((v,i)=>Math.round(v*(1-f)+stops[a+1][i]*f));
}
const world=(data:VolumeData,p:number[]):number[]=>['x','y','z'].map(axis=>data.latticeMatrix.reduce((n,v,i)=>n+p[i]*v[axis as keyof Vec3],0));
const sub=(a:number[],b:number[])=>a.map((v,i)=>v-b[i]);
const dot=(a:number[],b:number[])=>a.reduce((n,v,i)=>n+v*b[i],0);
const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

/** Marching tetrahedra, periodic endpoint sampling, no silent triangle truncation. */
export function isosurfacePositions(data:VolumeData,s:VolumeSettings,level:number,maxTriangles=MAX_VOLUME_TRIANGLES):Float32Array {
  let stride=s.stride||1;
  const cellCount=(step:number)=>data.dimensions.reduce((n,d)=>n*Math.ceil(d/step),1);
  if(!s.stride) while(cellCount(stride)>300000) stride*=2;
  if(cellCount(stride)>300000) throw new Error('采样单元超过 300,000，请选择自动或更大步长。');
  const axes=data.dimensions.map(n=>{const a:number[]=[];for(let i=0;i<n;i+=stride)a.push(i);a.push(n);return a;});
  const [nx,ny,nz]=data.dimensions,grid=data.channels[s.channel].values;
  if(level<data.channels[s.channel].min||level>data.channels[s.channel].max)return new Float32Array();
  const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
  const tetrahedra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
  const output:number[]=[];
  const triangle=(a:number[],b:number[],c:number[],outward:number[])=>{
    const n=cross(sub(b,a),sub(c,a)); if(dot(n,n)<1e-20)return;
    if(output.length/9>=maxTriangles)throw new Error('等值面超过 150,000 三角形预算，请提高采样步长或调整等值。');
    output.push(...a,...(dot(n,outward)<0?c:b),...(dot(n,outward)<0?b:c));
  };
  for(let z=0;z<axes[2].length-1;z++)for(let y=0;y<axes[1].length-1;y++)for(let x=0;x<axes[0].length-1;x++){
    // Every extraction vertex is an exact retained grid node, including the periodic endpoint.
    // Read it directly; trilinear interpolation and world-coordinate arrays are unnecessary
    // for the many cells that do not cross this level.
    const values=corners.map(c=>grid[((axes[2][z+c[2]]%nz)*ny+axes[1][y+c[1]]%ny)*nx+axes[0][x+c[0]]%nx]);
    if(values.every(v=>v>=level)||values.every(v=>v<level))continue;
    const points=corners.map(c=>world(data,[axes[0][x+c[0]]/nx,axes[1][y+c[1]]/ny,axes[2][z+c[2]]/nz]));
    for(const tet of tetrahedra){
      const inside=tet.filter(i=>values[i]>=level),outside=tet.filter(i=>values[i]<level);
      if(!inside.length||!outside.length)continue;
      const mean=(ids:number[])=>[0,1,2].map(k=>ids.reduce((n,i)=>n+points[i][k]/ids.length,0));
      const outward=sub(mean(outside),mean(inside));
      const edge=(a:number,b:number)=>{const t=(level-values[a])/(values[b]-values[a]);return points[a].map((v,k)=>v+(points[b][k]-v)*t);};
      if(inside.length===1){const a=inside[0];triangle(edge(a,outside[0]),edge(a,outside[1]),edge(a,outside[2]),outward);}
      else if(inside.length===3){const a=outside[0];triangle(edge(a,inside[0]),edge(a,inside[1]),edge(a,inside[2]),outward);}
      else {const[a,b]=inside,[c,d]=outside,p=edge(a,c),q=edge(a,d),r=edge(b,c),t=edge(b,d);triangle(p,r,q,outward);triangle(q,r,t,outward);}
    }
  }
  return new Float32Array(output);
}
export function sectionData(data:VolumeData,s:VolumeSettings){
  const axis=['a','b','c'].indexOf(s.sectionAxis),uv=[0,1,2].filter(i=>i!==axis);
  const width=Math.min(256,data.dimensions[uv[0]]+1),height=Math.min(256,data.dimensions[uv[1]]+1);
  const rgba=new Uint8Array(width*height*4),[min,max]=fieldRange(data,s);
  const point=(u:number,v:number)=>{const f=[0,0,0];f[axis]=s.sectionPosition;f[uv[0]]=u;f[uv[1]]=v;return f;};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const rgb=fieldColor(sampleVolume(data,s.channel,point(x/(width-1),y/(height-1))),min,max,s.palette);rgba.set([...rgb,255],(y*width+x)*4);}
  const positions=new Float32Array([[0,0],[1,0],[1,1],[0,1]].flatMap(([u,v])=>world(data,point(u,v))));
  return {positions,rgba,width,height,min,max};
}
export function sectionCSV(data:VolumeData,s:VolumeSettings){
  assertVolumeSettings(s,data);
  const axis=['a','b','c'].indexOf(s.sectionAxis),uv=[0,1,2].filter(i=>i!==axis);
  const width=Math.min(256,data.dimensions[uv[0]]+1),height=Math.min(256,data.dimensions[uv[1]]+1);
  const rows=[`# ${data.kind}; channel=${s.channel+1}; units=${data.units}; periodic trilinear interpolation`,`frac_a,frac_b,frac_c,x_A,y_A,z_A,value`];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const f=[0,0,0];f[axis]=s.sectionPosition;f[uv[0]]=x/(width-1);f[uv[1]]=y/(height-1);rows.push([...f,...world(data,f),sampleVolume(data,s.channel,f)].join(','));}
  return rows.join('\n')+'\n';
}
export function buildVolumeGeometry(data:VolumeData,s:VolumeSettings){
  assertVolumeSettings(s,data);
  const meshes:{positions:Float32Array;color:string}[]=[];
  if(s.isoEnabled){meshes.push({positions:isosurfacePositions(data,s,s.isoValue),color:s.isoColor});if(s.paired&&s.isoValue!==0)meshes.push({positions:isosurfacePositions(data,s,-s.isoValue,MAX_VOLUME_TRIANGLES-meshes[0].positions.length/9),color:s.negativeColor});}
  return {meshes,section:s.sectionEnabled?sectionData(data,s):null};
}
