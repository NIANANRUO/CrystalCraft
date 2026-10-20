import * as THREE from 'three';
import type {PresetMaterialType} from '../types/crystal';

export interface MaterialContext { textureStrength?:number; textureScale?:number; role?:'atom'|'bond' }
/** Object-space patterns are stable in still PNGs and need no extra animation loop. */
export function createExtendedMaterial(type:PresetMaterialType,color:THREE.Color,selected:boolean,context:MaterialContext={},light?:{value:THREE.Vector3}):THREE.Material|null{
  const highlight=selected?'#6b1638':'#000000';
  if(type==='amber'||type==='ice'){
    const mat=new THREE.MeshPhysicalMaterial({color:color.clone().lerp(new THREE.Color(type==='amber'?'#efb24e':'#b8e9fa'),.55),roughness:type==='amber'?.13:.2,metalness:0,transmission:.72,thickness:.7,ior:type==='amber'?1.55:1.31,clearcoat:1,clearcoatRoughness:.12,attenuationColor:type==='amber'?'#e3a03c':'#95cbe2',attenuationDistance:2,emissive:highlight});
    if(type==='ice'){
      mat.onBeforeCompile=shader=>{
        shader.vertexShader='varying vec3 vIcePosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvIcePosition=position;');
        shader.fragmentShader='varying vec3 vIcePosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          float seam=1.0-smoothstep(0.015,0.06,abs(sin(dot(vIcePosition,vec3(8.0,11.0,6.0))+sin(vIcePosition.y*15.0))));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.9,0.98,1.0),seam*0.55);`);
      };mat.customProgramCacheKey=()=> 'ice-seams-v1';
    }
    return mat;
  }
  if(type==='silicone')return new THREE.MeshPhysicalMaterial({color,roughness:.95,metalness:0,specularIntensity:.12,sheen:.6,sheenColor:color.clone().lerp(new THREE.Color('white'),.6),sheenRoughness:1,emissive:highlight});
  if(type==='kintsugi'){
    const mat=new THREE.MeshPhysicalMaterial({color:'#111820',roughness:.85,metalness:0,clearcoat:.15,emissive:highlight});
    mat.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 vLacquerPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLacquerPosition=position;');
      shader.fragmentShader='varying vec3 vLacquerPosition;\nfloat goldSeam(vec3 p){ vec3 q=p*4.2; float a=abs(sin(q.x+sin(q.y*1.7)+cos(q.z*1.3))); float b=abs(sin(q.z*1.5+cos(q.x*1.6)-sin(q.y)));return 1.0-smoothstep(0.025,0.085,min(a,b));}\n'+shader.fragmentShader
        .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.83,0.51,0.12),goldSeam(vLacquerPosition));')
        .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.22,goldSeam(vLacquerPosition));')
        .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=goldSeam(vLacquerPosition)*0.95;');
    };mat.customProgramCacheKey=()=> 'kintsugi-seams-v1';return mat;
  }
  if(!['watercolor','cyber','lidar'].includes(type))return null;
  const bodies:Record<string,string>={
    watercolor:`float paper=hash(floor(vLocal*170.0));float fiber=sin(dot(vLocal,vec3(270.0,35.0,18.0)))*.025;
      vec3 pigment=mix(vec3(0.99,0.98,0.94),uBaseColor,.65);col=mix(pigment,pigment*.46,pow(rim,3.0)*.7);col*=.98+(paper-.5)*.08+fiber;col*=.9+.1*diffuse;`,
    cyber:`vec3 p=normalize(vLocal);float longitude=atan(p.z,p.x)*12.0;float latitude=acos(clamp(p.y,-1.0,1.0))*10.0;
      float lonDist=abs(sin(longitude)),latDist=abs(sin(latitude));float width=max(fwidth(longitude),fwidth(latitude))*.65;
      float line=1.0-smoothstep(.045,.07+width,min(lonDist,latDist));col=mix(vec3(.005,.018,.025),mix(uBaseColor,vec3(.1,.9,1.0),.65),line);`,
    lidar:`vec3 p=normalize(vLocal);vec2 q=vec2(atan(p.z,p.x)*11.0,acos(clamp(p.y,-1.0,1.0))*11.0);vec2 tile=fract(q)-.5;
      float point=1.0-smoothstep(.09,.24,length(tile));if(point<.02)discard;col=mix(uBaseColor,vec3(.15,.95,1.0),.5)*(.55+.45*facing);alpha=point;`,
  };
  const mat=new THREE.ShaderMaterial({
    uniforms:{uBaseColor:{value:color},uLightDir:light??{value:new THREE.Vector3(-.45,.7,.55)},uSelected:{value:selected?1:0}},
    vertexShader:`varying vec3 vNormal;varying vec3 vViewPosition;varying vec3 vLocal;
      void main(){vLocal=position;vNormal=normalize(normalMatrix * normal);vec4 mv=modelViewMatrix * vec4(position, 1.0);vViewPosition=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform vec3 uBaseColor;uniform vec3 uLightDir;uniform float uSelected;
      varying vec3 vNormal;varying vec3 vViewPosition;varying vec3 vLocal;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      void main(){vec3 n=normalize(vNormal),v=normalize(vViewPosition);float facing=abs(dot(n,v)),rim=1.0-facing;
        float diffuse=max(0.0,dot(n,normalize(uLightDir)));vec3 col=uBaseColor;float alpha=1.0;
        ${bodies[type]}
        if(uSelected>.5)col=mix(col,vec3(1.0,.18,.48),.5);
        gl_FragColor=vec4(col,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent:type==='lidar',depthWrite:type!=='lidar',
  });
  return mat;
}
