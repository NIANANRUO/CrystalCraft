import * as THREE from 'three';
import type { VolumeData, VolumeSettings } from '../types/crystal';
import { defaultVolumeSettings } from './data';
import { createVolumeTask } from './client';
import { disposeObjectTree } from '../renderer/resources';
export interface VolumeStatus { loading:boolean; triangles:number; section:boolean; error:string|null }
export class VolumeLayer {
  group=new THREE.Group(); error:string|null=null; pending:Promise<void>|null=null;
  private data?:VolumeData; private key=''; private revision=0;
  private task:ReturnType<typeof createVolumeTask>|null=null;
  constructor(private changed:(status:VolumeStatus)=>void){}
  private clear(){disposeObjectTree(this.group);this.group.clear();}
  update(data:VolumeData|undefined,settings:VolumeSettings|undefined,visible=true){
    this.group.visible=visible;
    const s=settings??defaultVolumeSettings(data),key=JSON.stringify(s);
    if(data===this.data&&key===this.key)return;
    this.data=data;this.key=key;const revision=++this.revision;
    this.task?.cancel();this.task=null;this.clear();this.error=null;this.pending=null;
    if(!data||(!s.isoEnabled&&!s.sectionEnabled)){this.changed({loading:false,triangles:0,section:false,error:null});return;}
    this.changed({loading:true,triangles:0,section:false,error:null});
    try { this.task=createVolumeTask(data,s); }
    catch(error){this.error=error instanceof Error?error.message:String(error);this.changed({loading:false,triangles:0,section:false,error:this.error});return;}
    this.pending=this.task.promise.then(result=>{
      if(revision!==this.revision)return;
      let triangles=0;
      for(const mesh of result.meshes){
        if(!mesh.positions.length)continue;
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(mesh.positions,3));geometry.computeVertexNormals();
        const material=new THREE.MeshPhongMaterial({color:mesh.color,side:THREE.DoubleSide,opacity:s.isoOpacity,transparent:s.isoOpacity<1,depthWrite:s.isoOpacity>=1,shininess:45});
        const surface=new THREE.Mesh(geometry,material);surface.raycast=()=>{};this.group.add(surface);triangles+=mesh.positions.length/9;
      }
      if(result.section){
        const section=result.section,texture=new THREE.DataTexture(section.rgba,section.width,section.height,THREE.RGBAFormat);
        texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(section.positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geometry.setIndex([0,1,2,0,2,3]);
        const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false,transparent:s.sectionOpacity<1,opacity:s.sectionOpacity,depthWrite:s.sectionOpacity>=1,polygonOffset:true,polygonOffsetFactor:-1});
        const plane=new THREE.Mesh(geometry,material);plane.raycast=()=>{};this.group.add(plane);
      }
      this.changed({loading:false,triangles,section:!!result.section,error:null});
    }).catch(error=>{
      if(revision!==this.revision)return;
      this.clear();this.error=error instanceof Error?error.message:String(error);this.changed({loading:false,triangles:0,section:false,error:this.error});
    }).finally(()=>{if(revision===this.revision){this.pending=null;this.task=null;}});
  }
  dispose(){this.revision++;this.task?.cancel();this.task=null;this.clear();this.group.removeFromParent();}
}
