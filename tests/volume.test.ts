import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVaspVolume } from '../src/parsers/vaspVolume';
import { importStructure } from '../src/importStructure';
import { defaultVolumeSettings,createDemoVolume,assertVolumeData,assertVolumeSettings } from '../src/volume/data';
import { sampleVolume,isosurfacePositions,sectionData,sectionCSV,fieldColor,buildVolumeGeometry } from '../src/volume/geometry';
import { encodeProject,parseProject,ProjectState } from '../src/project';
import { createSupercell,transformUnitCell,IDENTITY_MATRIX } from '../src/utils/unitCellTransform';
import {parseVaspVolumeFile,samplingGrid} from '../src/parsers/vaspVolumeStream';

const header='Grid test\n1\n2 0 0\n0.5 2 0\n0 0 2\nH\n1\nDirect\n.5 .5 .5\n';
const grid='\n2 2 2\n0 8 16 24 32 40 48 56\n';
test('VASP grids preserve x-fastest ordering, skew cells, channel values and physical normalization',()=>{
  const charge=importStructure(header+grid,'CHGCAR'),potential=importStructure(header+grid,'sample.LOCPOT'),elf=importStructure(header+grid,'ELFCAR');
  assert.equal(charge.lattice!.volume,8);assert.deepEqual(charge.volumeData!.channels[0].values,[0,1,2,3,4,5,6,7]);
  assert.equal(charge.volumeData!.units,'Å⁻³');assert.equal(potential.volumeData!.units,'eV');assert.equal(elf.volumeData!.units,'无量纲');
  assert.equal(potential.volumeData!.channels[0].values[1],8);
  assert.equal(sampleVolume(charge.volumeData!,0,[.5,0,0]),1);
  assert.equal(sampleVolume(charge.volumeData!,0,[0,.5,0]),2);
  assert.equal(sampleVolume(charge.volumeData!,0,[0,0,.5]),4);
});
test('VASP multi-channel and PAW blocks are consumed exactly; malformed or oversized grids fail',()=>{
  const structure=parseVaspVolume(header+grid+'augmentation occupancies 1 3\n1D0 -2 3\n'+grid,'CHGCAR');
  assert.equal(structure.volumeData!.channels.length,2);assert.equal(structure.volumeData!.augmentationBlocks,1);
  for(const text of [header,header+grid.replace('48 56','48'),header+grid+'garbage',header+grid.replace('2 2 2','1000 1000 1000'),header+grid.replace('40','NaN'),header+grid+'augmentation occupancies 1 3\n1 2\n'])assert.throws(()=>parseVaspVolume(text,'CHGCAR'));
  assert.throws(()=>parseVaspVolume(header+grid+grid.replace('2 2 2','3 2 2'),'LOCPOT'),/尺寸/);
});
test('streamed files preserve exact values, signed charge classification, statistics and uniform sampling',async()=>{
  const streamed=await parseVaspVolumeFile(new File([header+grid],'CHGDIFF.vasp'));
  assert.equal(streamed.volumeData!.kind,'CHGDIFF');assert.deepEqual(streamed.volumeData!.channels[0].values,[0,1,2,3,4,5,6,7]);
  assert.equal(streamed.volumeData!.channels[0].sourceStats!.mean,3.5);assert.equal(defaultVolumeSettings(streamed.volumeData).paired,true);
  assert.deepEqual(samplingGrid([224,224,540]),{dimensions:[56,56,60],steps:[4,4,9]});
  assert.deepEqual(samplingGrid([112,112,270]),{dimensions:[56,56,54],steps:[2,2,5]});
  await assert.rejects(()=>parseVaspVolumeFile(new File([header+grid.replace('56','Infinity')],'ELFCAR')));
});
test('periodic trilinear samples, section coordinates, colors and CSV agree',()=>{
  const structure=parseVaspVolume(header+grid,'CHGCAR'),data=structure.volumeData!,s=defaultVolumeSettings(data);
  assert.equal(sampleVolume(data,0,[.25,.25,.25]),3.5);
  assert.equal(sampleVolume(data,0,[1,.25,.25]),3);
  assert.equal(sampleVolume(data,0,[-.25,.25,.25]),3.5);
  Object.assign(s,{sectionEnabled:true,sectionAxis:'b',sectionPosition:.25});
  const section=sectionData(data,s);assert.deepEqual([...section.positions].map(v=>Math.round(v*100)/100),[.13,.5,0,2.13,.5,0,2.13,.5,2,.13,.5,2]);
  assert.deepEqual([...section.rgba.slice(0,3)],fieldColor(1,0,7,'viridis'));
  const csv=sectionCSV(data,s).trim().split('\n');assert.equal(csv.length,11);assert.equal(csv[2],'0,0.25,0,0.125,0.5,0,1');
  s.rangeMin=3;s.rangeMax=3;assert.throws(()=>assertVolumeSettings(s,data),/参数/);
});
test('marching tetrahedra reconstructs two planar periodic level sets with correct total area',()=>{
  const structure=createDemoVolume(),data=structure.volumeData!;
  data.dimensions=[4,4,4];data.latticeMatrix=[{x:2,y:0,z:0},{x:0,y:2,z:0},{x:0,y:0,z:2}];
  const values=Array.from({length:64},(_,i)=>[0,1,0,-1][i%4]);data.channels=[{label:'sin x',values,min:-1,max:1}];
  const s={...defaultVolumeSettings(data),isoValue:.5},p=isosurfacePositions(data,s,.5);
  assert.ok(p.length>0);let area=0;
  for(let i=0;i<p.length;i+=9){const a=[p[i],p[i+1],p[i+2]],b=[p[i+3],p[i+4],p[i+5]],c=[p[i+6],p[i+7],p[i+8]];assert.ok(Math.abs(a[0]-.25)<1e-6||Math.abs(a[0]-.75)<1e-6);const u=b.map((v,k)=>v-a[k]),v=c.map((n,k)=>n-a[k]);area+=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])*.5;}
  assert.ok(Math.abs(area-8)<1e-6);assert.throws(()=>isosurfacePositions(data,s,.5,1),/预算/);
  assert.equal(isosurfacePositions(data,s,2).length,0);
  const result=buildVolumeGeometry(data,{...s,paired:true,sectionEnabled:true});assert.equal(result.meshes.length,2);assert.ok(result.section);
  // Integer extraction strides still interpolate the same analytic triangular field,
  // including its periodic endpoint; direct grid lookup must preserve the positions.
  data.dimensions=[8,4,4];data.channels=[{label:'triangle x',values:Array.from({length:128},(_,i)=>[0,1,2,3,4,3,2,1][i%8]),min:0,max:4}];
  for(const stride of [1,2,4]){const surface=isosurfacePositions(data,{...s,stride},1.5);assert.ok(surface.length>0);for(let i=0;i<surface.length;i+=3)assert.ok(Math.abs(surface[i]-.375)<1e-6||Math.abs(surface[i]-1.625)<1e-6);}
});
test('volume and manual ionic radii survive project save; cell changes cannot silently misalign the field',()=>{
  const structure=createDemoVolume(),visualSettings={atomScale:1,bondRadius:.055,bondTolerance:1.15,bondStyle:'single',bondColorMode:'uniform',doubleBondGap:.14,elementColors:{},elementRadii:{},showPolyhedra:false,showHBonds:false,showOutline:true,showShadows:false,showFog:false,showLabels:'none',isOrthographic:false,autoRotate:false,autoRotateSpeed:2,ligandViewRadius:null,showBoundaryAtoms:false,volumeSettings:defaultVolumeSettings(structure.volumeData),radiiType:'ionic',ionicRadii:{H:{charge:1,coordination:6,radius:.4}}} as const;
  const state={structure,visualSettings,renderMode:'ball-and-stick',materialType:'comic',showLattice:true,showAxes:true} as ProjectState;
  assert.deepEqual(parseProject(encodeProject(state)),JSON.parse(JSON.stringify(state)));
  assert.throws(()=>createSupercell(structure,2,1,1),/晶格/);
  assert.throws(()=>transformUnitCell(structure,{rotationMatrix:IDENTITY_MATRIX,translationVector:[.1,0,0],normalizeRange:true}),/移除体数据/);
  const broken=structuredClone(structure);broken.volumeData!.channels[0].values.pop();assert.throws(()=>assertVolumeData(broken.volumeData!,broken),/数量/);
  (state.visualSettings.ionicRadii!.H as any).charge=0;assert.throws(()=>encodeProject(state),/离子半径/);
});
