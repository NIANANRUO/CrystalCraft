import * as THREE from 'three';
import type {PresetMaterialType} from '../types/crystal';
import type {MaterialContext} from './extendedMaterials';
import {SURFACE_MATERIALS} from '../materialCatalog';

/** Surface normals only: positions, silhouette, radii and atom picking remain intact. */
export function createSurfaceMaterial(type:PresetMaterialType,color:THREE.Color,selected:boolean,context:MaterialContext){
  if(!SURFACE_MATERIALS.includes(type))return null;
  const strength=context.textureStrength??.65,scale=context.textureScale??12,bond=context.role==='bond';
  const mat=new THREE.MeshPhysicalMaterial({color,roughness:type==='sintered'?.72:type==='hammered'?.26:.34,metalness:type==='hammered'?.78:type==='carbonfiber'?.18:.02,
    clearcoat:type==='carbonfiber'?.75:.12,clearcoatRoughness:.2,emissive:selected?'#3d1027':'#000000',envMapIntensity:1.25});
  mat.userData.surface={type,strength,scale,role:context.role??'atom'};
  // Thin bonds deliberately use a smooth material, keeping connections legible.
  if(bond)return mat;
  const body=type==='microfacet'?`
    vec3 cell=floor(p);vec3 q=fract(p)-.5;
    vec3 axis=normalize(hash3(cell)-.5+vec3(.01));
    height=dot(q,axis)*.025;
    variation=.94+.06*hash3(cell).x;
    roughnessFactor=mix(roughnessFactor,.2+.16*hash3(cell).y,uSurfaceStrength*lod);
  `:type==='sintered'?`
    vec3 q=fract(p)-.5;float radius=length(q);
    height=-exp(-22.0*radius*radius)*.055;
    variation=.94+.06*smoothstep(.05,.5,radius);
    roughnessFactor=mix(roughnessFactor,.8,uSurfaceStrength*lod);
  `:type==='hammered'?`
    vec3 cell=floor(p*.55);vec3 q=fract(p*.55)-.5;
    q+=(hash3(cell)-.5)*.18;
    height=pow(smoothstep(.02,.72,length(q)),.8)*.08;
    variation=.95+.05*hash3(cell).y;
  `:`
    vec3 local=normalize(vSurfacePosition);
    vec2 uv=vec2(atan(local.z,local.x)/6.2831853,acos(clamp(local.y,-1.0,1.0))/3.14159265);
    vec2 weave=uv*uSurfaceScale*2.0;vec2 cell=floor(weave),q=fract(weave);
    float parity=mod(cell.x+cell.y,2.0);
    float strand=mix(sin(q.x*3.14159265),sin(q.y*3.14159265),parity);
    float fiber=mix(cos(q.y*37.699),cos(q.x*37.699),parity);
    height=strand*.027+fiber*.002;
    variation=.65+.28*strand+.07*fiber;
    roughnessFactor=mix(roughnessFactor,.22+.18*(1.0-strand),uSurfaceStrength*lod);
  `;
  mat.onBeforeCompile=shader=>{
    shader.uniforms.uSurfaceStrength={value:strength};shader.uniforms.uSurfaceScale={value:scale};
    shader.vertexShader='varying vec3 vSurfacePosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfacePosition=position;');
    shader.fragmentShader=`varying vec3 vSurfacePosition;uniform float uSurfaceStrength;uniform float uSurfaceScale;
      vec3 hash3(vec3 p){return fract(sin(vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))))*43758.5453);}
      vec3 surfaceNormal(vec3 n,vec3 viewPosition,float h){vec3 dp1=dFdx(-viewPosition),dp2=dFdy(-viewPosition);vec3 r1=cross(dp2,n),r2=cross(n,dp1);float determinant=dot(dp1,r1);return normalize(max(abs(determinant),1e-12)*n-sign(determinant)*(dFdx(h)*r1+dFdy(h)*r2));}
    `+shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 p=vSurfacePosition*uSurfaceScale;
      float footprint=length(fwidth(p));float lod=1.0-smoothstep(.3,1.3,footprint);
      float height=0.0,variation=1.0;
      ${body}
      normal=surfaceNormal(normal,vViewPosition,height*uSurfaceStrength*lod);
      diffuseColor.rgb*=mix(1.0,variation,uSurfaceStrength*lod);
    `);
  };
  mat.customProgramCacheKey=()=>`surface-${type}-v1`;
  return mat;
}
