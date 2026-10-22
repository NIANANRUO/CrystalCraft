import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePOSCAR, exportPOSCAR } from '../src/parsers/poscar';
import { importStructure } from '../src/importStructure';
import { parseProject, encodeProject, ProjectHistory, type ProjectState } from '../src/project';
import { MAX_HISTORY_BYTES } from '../src/projectHistory';
import { freezeStructurePayloads, cloneEditableStructure } from '../src/projectSnapshot';
import { expandPeriodicAtoms, hasAutomaticBond, defaultBondRules } from '../src/utils/bonding';
import { transformUnitCell, transformSelectiveDynamics, type Matrix3x3 } from '../src/utils/unitCellTransform';
import { fractionalToCartesian, calculateLatticeFromMatrix, dist } from '../src/utils/math';
import { cellComposition } from '../src/utils/composition';
import type { CrystalStructure, VisualSettings } from '../src/types/crystal';

const settings: VisualSettings = { atomScale:1,bondRadius:.055,bondTolerance:1.15,bondStyle:'single',bondColorMode:'uniform',doubleBondGap:.14,elementColors:{},elementRadii:{},showPolyhedra:false,showHBonds:false,showOutline:false,showShadows:false,showFog:false,showLabels:'none',isOrthographic:false,autoRotate:false,autoRotateSpeed:2,ligandViewRadius:null,showBoundaryAtoms:true };
const cell = (c = 5, coords = ['.15 .5 .5','.85 .5 .5']) => parsePOSCAR(`Synthetic audit\n1\n5 0 0\n0 5 0\n0 0 ${c}\nC\n${coords.length}\nDirect\n${coords.join('\n')}\n`);
const project = (): ProjectState => ({structure:cell(),visualSettings:structuredClone(settings),materialType:'flat',renderMode:'ball-and-stick',showLattice:true,showAxes:true});
const key = (a: any) => `${a.originalId ?? a.id}:${(a.imageOffset ?? [0,0,0]).join(',')}`;

test('A1 automatic periodic neighbors agree with independent exhaustive search, including skew and long-axis bulk', () => {
  const skew = cell(); skew.lattice = calculateLatticeFromMatrix([{x:5,y:0,z:0},{x:4.6,y:1.1,z:0},{x:.5,y:0,z:5}]);
  skew.atoms.forEach(a => a.cartesian = fractionalToCartesian(a.fractional, skew.lattice!.matrix));
  const small = cell(); small.lattice = calculateLatticeFromMatrix([{x:.6,y:0,z:0},{x:0,y:.6,z:0},{x:0,y:0,z:.6}]);
  small.atoms = [small.atoms[0]]; small.atoms[0].cartesian = fractionalToCartesian(small.atoms[0].fractional, small.lattice.matrix);
  const shifted = cell(); shifted.atoms[0].fractional.x += 2; shifted.atoms[0].cartesian = fractionalToCartesian(shifted.atoms[0].fractional, shifted.lattice!.matrix);
  for (const structure of [cell(),cell(10,['.5 .5 .03','.5 .5 .97']),skew,small,shifted]) {
    const expected = new Set(structure.atoms.map(key));
    for (const source of structure.atoms) for (let x=-4;x<=4;x++) for (let y=-4;y<=4;y++) for (let z=-4;z<=4;z++) {
      if (!x && !y && !z) continue;
      const cartesian = fractionalToCartesian({x:source.fractional.x+x,y:source.fractional.y+y,z:source.fractional.z+z},structure.lattice!.matrix);
      if (structure.atoms.some(center => hasAutomaticBond(center,{...source,cartesian},settings,dist(center.cartesian,cartesian)))) expected.add(`${source.id}:${x},${y},${z}`);
    }
    assert.deepEqual(new Set(expandPeriodicAtoms(structure,settings).map(key)),expected);
  }
  assert.equal(expandPeriodicAtoms(cell(),settings).length,4);
});

test('A7 coincident source sites keep separate periodic identities, labels and occupancies', () => {
  const s = cell(5,['.15 .5 .5','.85 .5 .5','.85 .5 .5']);
  s.atoms[1].name='C_A';s.atoms[2].name='C_B';s.atoms[1].occupancy=.5;s.atoms[2].occupancy=.5;
  for (const mode of [settings,{...settings,bondSettings:{enabled:true,rules:defaultBondRules(s,1.15)}}]) {
    const images=expandPeriodicAtoms(s,mode).filter(a=>a.isBoundary&&a.fractional.x<0);
    assert.deepEqual(images.map(a=>[a.name,a.occupancy]),[['C_A',.5],['C_B',.5]]);
    assert.notEqual(images[0].id,images[1].id);
  }
});

test('A2 swapping direct axes preserves physical constraints; unrepresentable mixed constraints reject', () => {
  const s=cell();s.atoms[0].selectiveDynamics=[false,true,true];
  const result=transformUnitCell(s,{rotationMatrix:[[0,1,0],[1,0,0],[0,0,1]],translationVector:[0,0,0],normalizeRange:false});
  assert.deepEqual(result.atoms[0].selectiveDynamics,[true,false,true]);
  assert.match(exportPOSCAR(result),/T\s+F\s+T/);
  assert.deepEqual(s.atoms[0].selectiveDynamics,[false,true,true]);
  const mixed: Matrix3x3=[[1,1,0],[0,1,0],[0,0,1]];
  assert.throws(()=>transformSelectiveDynamics([false,true,true],mixed),/约束/);
  assert.deepEqual(transformSelectiveDynamics([true,true,true],mixed),[true,true,true]);
  assert.deepEqual(transformSelectiveDynamics([false,false,false],mixed),[false,false,false]);
  assert.deepEqual(transformSelectiveDynamics([true,false,true],mixed),[true,false,true]);
});

test('A3 project schema rejects wrong types, unknown fields, spoofed image IDs and excessive depth', () => {
  const mutations=[
    (s:any)=>s.structure.atoms[0].name={bad:1}, (s:any)=>s.structure.atoms[0].selectiveDynamics=['false',false,false],
    (s:any)=>s.structure.atoms[0].selectiveDynamics=[true], (s:any)=>s.structure.atoms[0].charge='2',
    (s:any)=>s.structure.atoms[0].originalId=2, (s:any)=>s.structure.atoms[0].isBoundary=true,
    (s:any)=>s.structure.atoms[0].imageOffset=[0,1,0], (s:any)=>s.structure.atoms[0].selected='yes',
    (s:any)=>s.structure.atoms[0].displacement=[1,1,1,0,0], (s:any)=>s.structure.atoms[0].name='x'.repeat(129),
    (s:any)=>s.structure.atoms[0].fractional.extra={}, (s:any)=>s.structure.format='evil',
    (s:any)=>s.structure.hasSelectiveDynamics=[], (s:any)=>s.visualSettings.atomSpecular={r:0,g:0,b:0,extra:1},
    (s:any)=>s.visualSettings.unknown={}, (s:any)=>s.structure.sourceCif=false,
    (s:any)=>s.structure.atoms[0]=null,
  ];
  for(const mutate of mutations){const s=project();mutate(s);assert.throws(()=>parseProject(JSON.stringify({kind:'CrystalCraftProject',version:2,state:s})));}
  assert.throws(()=>parseProject('['.repeat(30)+'0'+']'.repeat(30)),/嵌套/);
  assert.deepEqual(parseProject(encodeProject(project())).structure,JSON.parse(JSON.stringify(project().structure)));
});

test('A5 a saveable four-channel 20 MiB project retains style undo/redo without repeating its grid', () => {
  const s=project(),values=Array(64**3).fill(.12345678901234567);
  s.structure.volumeData={kind:'SYNTHETIC',sourceName:'Synthetic audit',dimensions:[64,64,64],latticeMatrix:s.structure.lattice!.matrix,units:'arbitrary',augmentationBlocks:0,channels:Array.from({length:4},(_,i)=>({label:String(i),values,min:values[0],max:values[0]}))};
  assert.ok(Buffer.byteLength(encodeProject(s))<24*1024*1024);
  freezeStructurePayloads(s.structure);
  const h=new ProjectHistory();h.observe(s);s.visualSettings.showOutline=true;h.observe(s);
  assert.equal(h.undo()!.visualSettings.showOutline,false);assert.equal(h.redo()!.visualSettings.showOutline,true);
  for(let i=0;i<29;i++){s.visualSettings.atomScale=1+i/100;h.observe(s);}
  assert.ok(h.past.length>=28);assert.ok(h.retainedBytes<=MAX_HISTORY_BYTES);
  const cloned=cloneEditableStructure(s.structure);assert.equal(cloned.volumeData,s.structure.volumeData);
  cloned.atoms[0].element='O';assert.equal(s.structure.atoms[0].element,'C');
});

test('history snapshots remain independent for mutable payload callers and account for redo memory', () => {
  const s=project();s.structure.sourceCif={text:'first',originalGeometry:'x'};
  const h=new ProjectHistory(12000);h.observe(s);s.structure.sourceCif.text='second';h.observe(s);
  assert.equal(h.undo()!.structure.sourceCif!.text,'first');assert.equal(h.redo()!.structure.sourceCif!.text,'second');
  for(let i=0;i<40;i++){s.structure.title='x'.repeat(1000)+i;h.observe(s);}
  assert.ok(h.wasTrimmed);assert.ok(h.retainedBytes<=12000);h.undo();assert.ok(h.retainedBytes<=12000);
});

test('A6 cell composition uses occupancies and excludes zero sites', () => {
  const s=cell();s.atoms.forEach(a=>a.occupancy=.5);assert.equal(cellComposition(s.atoms),'C');
  s.atoms[1].element='O';assert.equal(cellComposition(s.atoms),'C0.5O0.5');
  s.atoms[1].occupancy=0;assert.equal(cellComposition(s.atoms),'C0.5');
});

test('A8 Extended XYZ metadata and extra columns are refused instead of silently dropped', () => {
  for(const metadata of ['Lattice="5 0 0 0 5 0 0 0 5"','Properties=species:S:1:pos:R:3','pbc="T T T"']) {
    for(const name of ['data.xyz','data.extxyz'])assert.throws(()=>importStructure(`1\n${metadata}\nC 0 0 0\n`,name),/Extended XYZ/);
  }
  assert.throws(()=>importStructure('1\nextra\nC 0 0 0 .5\n','data.xyz'),/额外属性/);
});
