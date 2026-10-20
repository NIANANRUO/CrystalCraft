import { buildVolumeGeometry } from '../volume/geometry';
import type { VolumeData, VolumeSettings } from '../types/crystal';
self.onmessage=(event:MessageEvent<{data:VolumeData;settings:VolumeSettings}>)=>{
  try{
    const result=buildVolumeGeometry(event.data.data,event.data.settings);
    const transfer=result.meshes.map(mesh=>mesh.positions.buffer);
    if(result.section)transfer.push(result.section.positions.buffer,result.section.rgba.buffer);
    self.postMessage({ok:true,result}, {transfer});
  }catch(error){self.postMessage({ok:false,message:error instanceof Error?error.message:String(error)});}
};
