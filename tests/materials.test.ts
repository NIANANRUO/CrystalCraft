import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MATERIALS,LEGACY_MATERIALS,readStartupOptions} from '../src/config';
import {MATERIAL_GROUPS,NEW_MATERIALS,SURFACE_MATERIALS,REMOVED_MATERIALS,materialBackground} from '../src/materialCatalog';
import {importAtomScalars,materialRange,materialSource,mappedColor,scalarValue,thermalB} from '../src/materialData';
import {createMaterial} from '../src/renderer/materials';
import {parseXYZ} from '../src/parsers/xyz';
import {encodeProject,parseProject,type ProjectState} from '../src/project';
import {assertStructureValid} from '../src/utils/validation';
import {batchOpaqueMeshes} from '../src/renderer/instances';

const structure=()=>parseXYZ('3\nscalar reference\nC 0 0 -2\nMo 0 0 0\nXx 0 0 2\n');
test('31 unique catalog entries preserve every legacy identifier and all new URL presets',()=>{
  assert.equal(LEGACY_MATERIALS.length,20);assert.equal(NEW_MATERIALS.length,11);
  assert.deepEqual([...MATERIAL_GROUPS.flatMap(g=>g.items.map(m=>m.id))].sort(),[...MATERIALS].sort());
  assert.equal(new Set(MATERIALS).size,31);assert.equal(MATERIAL_GROUPS.length,6);
  for(const id of NEW_MATERIALS)assert.equal(readStartupOptions(`?material=${id}`).material,id);
  assert.equal(materialBackground('cyber','#ffffff'),'#05080f');assert.equal(materialBackground('comic','#ffffff'),'#ffffff');
});
test('new physical materials have independent optical properties, caching and wireframe variants',()=>{
  const cache=new Map<string,THREE.Material>(),amber=createMaterial('amber','#abc',false,cache) as THREE.MeshPhysicalMaterial;
  assert.equal(amber.ior,1.55);assert.ok(amber.transmission>0);assert.equal(amber.opacity,1);
  assert.equal((createMaterial('silicone','#abc',false,cache) as THREE.MeshPhysicalMaterial).roughness,.95);
  assert.equal((createMaterial('ice','#abc',false,cache) as THREE.MeshPhysicalMaterial).ior,1.31);
  assert.equal(createMaterial('amber','#abc',false,cache),amber);
  assert.equal((createMaterial('amber','#abc',false,cache,true) as THREE.MeshPhysicalMaterial).wireframe,true);
  for(const type of NEW_MATERIALS){const mat=createMaterial(type,'#12abcd',false,cache);assert.ok(mat instanceof THREE.Material);}
  for(const mat of cache.values())mat.dispose();
});
test('scalar CSV binds explicit IDs, preserves zero/signs and replaces stale data without mutating geometry',()=>{
  const old=structure(),next=importAtomScalars('atom_id,esp_V,orbital_amplitude,spin_muB,b_factor_A2\n1,-.3,.2,1,0\n2,.3,-.2,-1,4\n',old,'reference.csv');
  assert.equal(old.atoms[0].scalarData,undefined);assert.deepEqual(next.atoms[0].scalarData,{esp:-.3,orbital:.2,spin:1,bFactor:0});
  assert.deepEqual(next.atoms.map(a=>a.cartesian),old.atoms.map(a=>a.cartesian));
  assert.equal(next.atoms[2].scalarData,undefined);
  const replacement=importAtomScalars('atom_id,spin_muB\n2,0\n',next,'zero.csv');
  assert.equal(replacement.atoms[0].scalarData,undefined);assert.deepEqual(replacement.atoms[1].scalarData,{spin:0});assert.equal(replacement.scalarSource,'zero.csv');
});
test('scalar CSV and project validation reject ambiguous IDs, units and malformed values',()=>{
  for(const csv of ['atom_id,esp\n1,2','atom_id,esp_V\n99,1','atom_id,esp_V\n1,1\n1,2','atom_id,esp_V\n1,NaN','atom_id,spin_muB\n1,1junk','atom_id,b_factor_A2\n1,-1','atom_id,esp_V\n1,','atom_id,esp_V,esp_V\n1,0,1'])assert.throws(()=>importAtomScalars(csv,structure(),'bad.csv'));
  for(const scalarData of [{spin:Infinity},{temperature:3},{bFactor:-1},null]){const next=structure();next.atoms[0].scalarData=scalarData as any;assert.throws(()=>assertStructureValid(next));}
});
test('Z-contrast, height, signed maps and equivalent B factors use the supplied physical quantities',()=>{
  const s=structure();assert.equal(scalarValue('haadf',s.atoms[2]),undefined);
  assert.ok(Math.abs(scalarValue('haadf',s.atoms[1])!/scalarValue('haadf',s.atoms[0])!-Math.pow(42/6,1.7))<1e-10);
  assert.deepEqual(materialRange('afm',s),{min:-2,max:2,count:3,total:3,unit:'Å'});
  s.atoms[0].displacement=[.01,.02,.03,0,0,0];assert.ok(Math.abs(thermalB(s.atoms[0])!-8*Math.PI**2*.02)<1e-12);assert.equal(materialSource('bfactor',s),'CIF U_cart');
  const mixed=importAtomScalars('atom_id,b_factor_A2\n2,1.2',s,'thermal.csv');assert.equal(materialSource('bfactor',mixed),'thermal.csv + CIF U_cart');
  const next=importAtomScalars('atom_id,esp_V\n1,-2\n2,1',s,'pot.csv');assert.deepEqual(materialRange('esp',next),{min:-2,max:2,count:2,total:3,unit:'V'});
  assert.equal(mappedColor('esp',0,-2,2),'#f7f7f7');assert.equal(mappedColor('esp',undefined,-2,2),'#7f8b99');
  assert.notEqual(mappedColor('spin',-1,-1,1),mappedColor('spin',1,-1,1));
});
test('scientific scalar sources and material selection round trip through project files',()=>{
  const s=importAtomScalars('atom_id,esp_V,orbital_amplitude,spin_muB,b_factor_A2\n1,-1,.3,2,4',structure(),'values.csv');
  const state:ProjectState={structure:s,materialType:'smooth',renderMode:'ball-and-stick',showLattice:true,showAxes:true,visualSettings:{atomScale:1,bondRadius:.055,bondTolerance:1.15,bondStyle:'single',bondColorMode:'uniform',elementColors:{},elementRadii:{},showPolyhedra:false,showHBonds:false,showOutline:false,showShadows:false,showFog:false,showLabels:'none',isOrthographic:false,autoRotate:false,autoRotateSpeed:2,ligandViewRadius:null,showBoundaryAtoms:false}};
  Object.assign(state.visualSettings,{doubleBondGap:.14});
  assert.deepEqual(parseProject(encodeProject(state)),JSON.parse(JSON.stringify(state)));
  const encoded=JSON.parse(encodeProject(state));
  for(const id of Object.keys(REMOVED_MATERIALS)){
    encoded.state.materialType=id;
    const restored=parseProject(JSON.stringify(encoded));
    assert.equal(restored.materialType,'smooth');assert.ok(restored.migrationNotice?.includes(id));assert.deepEqual(restored.structure,encoded.state.structure);
    assert.equal(JSON.parse(encodeProject(restored)).state.migrationNotice,undefined);
    assert.equal(readStartupOptions(`?material=${id}`).material,'smooth');assert.ok(!MATERIALS.includes(id as any));
  }
  for(const settings of [{textureStrength:-1},{textureStrength:Infinity},{textureScale:3},{textureScale:12.5}])assert.throws(()=>encodeProject({...state,visualSettings:{...state.visualSettings,...settings}}));
});

test('four surface materials retain input hue, leave geometry intact and simplify thin bonds',()=>{
  for(const type of SURFACE_MATERIALS){
    const cache=new Map<string,THREE.Material>(),a=createMaterial(type,'#22aa44',false,cache,false,{textureStrength:.8,textureScale:8}) as THREE.MeshPhysicalMaterial;
    assert.equal(a.color.getHexString(),'22aa44');assert.equal(a.userData.surface.strength,.8);
    assert.notEqual(createMaterial(type,'#22aa44',false,cache,false,{textureStrength:0,textureScale:8}),a);
    const bond=createMaterial(type,'#22aa44',false,cache,false,{role:'bond'}) as THREE.MeshPhysicalMaterial;
    assert.notEqual(a.onBeforeCompile,bond.onBeforeCompile);
    const shader:any={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <normal_fragment_maps>'};a.onBeforeCompile(shader,{} as any);
    assert.ok(shader.vertexShader.includes('vSurfacePosition=position'));assert.ok(!shader.vertexShader.includes('transformed ='));
    assert.equal(shader.uniforms.uSurfaceStrength.value,.8);assert.equal(shader.uniforms.uSurfaceScale.value,8);
    for(const mat of cache.values())mat.dispose();
  }
});

test('procedural shaders inject instance normals for compact and spaced main functions',()=>{
  for(const type of ['watercolor','cyber'] as const){
    const group=new THREE.Group(),geometry=new THREE.SphereGeometry(1,6,4),cache=new Map<string,THREE.Material>();
    const material=createMaterial(type,'#44aabb',false,cache) as THREE.ShaderMaterial;
    for(let i=0;i<2;i++){const mesh=new THREE.Mesh(geometry,material);mesh.position.x=i*3;group.add(mesh);}
    batchOpaqueMeshes(group,cache);const batch=group.children[0] as THREE.InstancedMesh;
    assert.equal(batch.count,2);const shader=batch.material as THREE.ShaderMaterial;
    assert.ok(shader.vertexShader.includes('vec3 instanceNormal ='));assert.ok(shader.vertexShader.includes('normalMatrix * instanceNormal'));
    assert.ok(shader.vertexShader.indexOf('vec3 instanceNormal =')<shader.vertexShader.indexOf('normalMatrix * instanceNormal'));
    geometry.dispose();batch.dispose();for(const mat of cache.values())mat.dispose();
  }
});
