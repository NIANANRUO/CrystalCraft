import {test,expect} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {NEW_MATERIALS,MATERIAL_GROUPS,SURFACE_MATERIALS,REMOVED_MATERIALS} from '../../src/materialCatalog';
import {TEST_LAYER_POSCAR} from '../fixtures/structures';

const xyz='6\nmaterial QA\nC -2 -1 -1\nO 0 -1 0\nMo 2 -1 1\nAu -2 1 2\nN 0 1 -2\nXx 2 1 0\n';
async function model(page:any){await page.goto('./?showShadows=false');await page.locator('input[type=file]').first().setInputFiles({name:'materials.xyz',mimeType:'text/plain',buffer:Buffer.from(xyz)});await expect(page.locator('tbody tr')).toHaveCount(6);}
test('31 active materials render, retain legacy choices, group consistently and survive changing back',async({page})=>{
  test.setTimeout(240000);const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await model(page);const select=page.getByRole('combobox',{name:'材质预设'});
  await expect(select.locator('option')).toHaveCount(31);await expect(select.locator('optgroup')).toHaveCount(6);
  await mkdir('docs/qa/surfaces',{recursive:true});const screenshots:string[]=[];
  for(const type of NEW_MATERIALS){
    await select.selectOption(type);await expect(page.getByLabel('材质说明')).toBeVisible();
    await expect(page.getByLabel('材质图例')).toBeVisible();
    if(['cyber','lidar'].includes(type))expect(await page.getByText('material QA',{exact:true}).evaluate(el=>{const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d')!;ctx.fillStyle=getComputedStyle(el).color;ctx.fillRect(0,0,1,1);return Math.min(...ctx.getImageData(0,0,1,1).data.slice(0,3));})).toBeGreaterThan(200);
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    expect(await page.locator('canvas').first().evaluate((c:HTMLCanvasElement)=>c.toDataURL().length)).toBeGreaterThan(5000);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.screenshot({path:`docs/qa/surfaces/${type}.png`});screenshots.push(type);
  }
  await select.selectOption('comic');await expect(page.getByLabel('材质图例')).toHaveCount(0);
  await page.getByRole('button',{name:'Objects',exact:true}).first().click();
  for(const group of MATERIAL_GROUPS)await expect(page.getByText(group.label,{exact:true}).last()).toBeVisible();
  await page.getByRole('button',{name:'Amber Resin · 琥珀树脂',exact:true}).click();await expect(select).toHaveValue('amber');
  await page.setViewportSize({width:390,height:844});
  await expect(select).toBeVisible();const bounds=await select.boundingBox();expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390);
  await expect(page.getByLabel('材质图例')).toHaveCount(0);
  await page.screenshot({path:'docs/qa/surfaces/mobile-controls.png'});
  await page.getByRole('button',{name:'收起左侧面板',exact:true}).click();
  await expect(page.getByLabel('材质图例')).toBeVisible();
  await page.screenshot({path:'docs/qa/surfaces/mobile.png'});
  expect(errors).toEqual([]);await writeFile('docs/qa/surfaces/result.json',JSON.stringify({materials:screenshots,legacyCount:20,total:31,errors,conditions:'Windows Edge / SwiftShader; fixed six-atom synthetic visual QA model, not scientific calculation'},null,2));
});

test('surface controls change the actual image, persist in projects and export PNG',async({page})=>{
  test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await model(page);const select=page.getByRole('combobox',{name:'材质预设'});await select.selectOption('sintered');
  await page.getByLabel('纹理强度',{exact:true}).fill('0');
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const before=await page.locator('canvas').first().evaluate((c:HTMLCanvasElement)=>c.toDataURL());
  await page.getByLabel('纹理强度',{exact:true}).fill('.9');await page.getByLabel('纹理尺度',{exact:true}).fill('8');
  await expect.poll(()=>page.locator('canvas').first().evaluate((c:HTMLCanvasElement)=>c.toDataURL())).not.toBe(before);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();const text=await readFile((await(await download).path())!,'utf8'),saved=JSON.parse(text);
  expect(saved.state.visualSettings).toMatchObject({textureStrength:.9,textureScale:8});
  await select.selectOption('comic');await page.locator('input[type=file]').first().setInputFiles({name:'surface.crystalcraft.json',mimeType:'application/json',buffer:Buffer.from(text)});
  await expect(select).toHaveValue('sintered');await expect(page.getByLabel('纹理强度',{exact:true})).toHaveValue('0.9');
  expect(await page.getByLabel('导入原子标量 CSV',{exact:true}).count()).toBe(0);
  await page.getByRole('button',{name:'渲染图像',exact:true}).click();await page.getByRole('button',{name:/3840px.*4K/}).click();await page.getByRole('button',{name:/1920px.*1080p/}).click();await page.getByRole('button',{name:/^Normal/}).click();
  const pngEvent=page.waitForEvent('download');await page.getByRole('button',{name:'导出 PNG 图像',exact:true}).click();const png=await readFile((await(await pngEvent).path())!);
  expect(png.readUInt32BE(16)).toBe(1920);await writeFile('docs/qa/surfaces/sintered-export.png',png);expect(errors).toEqual([]);
});

test('removed material projects preserve geometry and archived data with a visible fallback notice',async({page})=>{
  await model(page);const download=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();const saved=JSON.parse(await readFile((await(await download).path())!,'utf8'));
  const old=structuredClone(saved);old.state.materialType='haadf';old.state.structure.scalarSource='archived.csv';old.state.structure.atoms[0].scalarData={spin:1};
  await page.locator('input[type=file]').first().setInputFiles({name:'old.crystalcraft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});
  await expect(page.getByLabel('材质迁移提示')).toContainText('haadf 已移除');await expect(page.getByRole('combobox',{name:'材质预设'})).toHaveValue('smooth');await expect(page.locator('tbody tr')).toHaveCount(6);
  const exported=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();const next=JSON.parse(await readFile((await(await exported).path())!,'utf8'));
  expect(next.state.structure).toEqual(old.state.structure);expect(next.state.materialType).toBe('smooth');expect(next.state.migrationNotice).toBeUndefined();
  for(const id of Object.keys(REMOVED_MATERIALS))await expect(page.locator(`option[value="${id}"]`)).toHaveCount(0);
  await page.goto('./?material=spin');await expect(page.getByLabel('材质迁移提示')).toContainText('spin 已移除');
});

test('surface materials remain usable through 500-atom instancing',async({page})=>{
  test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('./?showShadows=false');
  const atoms=Array.from({length:500},(_,i)=>`C ${(i%20)*2} ${Math.floor(i/20)%10*2} ${Math.floor(i/200)*2}`).join('\n');
  await page.locator('input[type=file]').first().setInputFiles({name:'500.xyz',mimeType:'text/plain',buffer:Buffer.from(`500\nprocedural instancing QA\n${atoms}\n`)});
  const select=page.getByRole('combobox',{name:'材质预设'});
  for(const type of SURFACE_MATERIALS){await select.selectOption(type);await expect(page.getByText(/500 atoms, 0 bonds, 0 polyhedra/)).toBeVisible();await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await expect(page.getByRole('alert')).toHaveCount(0);}
  await page.screenshot({path:'docs/qa/surfaces/500-surface.png'});expect(errors).toEqual([]);
});

test('four surfaces preserve imported dense, layered and open-framework structures',async({page})=>{
  test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('./?showShadows=false');await page.getByRole('button',{name:'Boundary PBC: ON',exact:true}).click();
  const dense='NaCl reference\n1\n5.64 0 0\n0 5.64 0\n0 0 5.64\nNa Cl\n4 4\nDirect\n0 0 0\n0 .5 .5\n.5 0 .5\n.5 .5 0\n.5 0 0\n0 .5 0\n0 0 .5\n.5 .5 .5\n';
  const framework='Open framework geometric reference\n1\n12 0 0\n0 12 0\n0 0 12\nZn O C\n2 4 4\nDirect\n.15 .15 .15\n.85 .85 .85\n.27 .15 .15\n.15 .27 .15\n.73 .85 .85\n.85 .73 .85\n.39 .15 .15\n.15 .39 .15\n.61 .85 .85\n.85 .61 .85\n';
  for(const [name,text]of [['dense',dense],['layered',TEST_LAYER_POSCAR],['framework',framework]]){
    await page.locator('input[type=file]').first().setInputFiles({name:`${name}.vasp`,mimeType:'text/plain',buffer:Buffer.from(text)});
    const first=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();const initial=JSON.parse(await readFile((await(await first).path())!,'utf8'));
    for(const type of SURFACE_MATERIALS){await page.getByRole('combobox',{name:'材质预设'}).selectOption(type);await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await expect(page.getByRole('alert')).toHaveCount(0);await page.screenshot({path:`docs/qa/surfaces/${name}-${type}.png`});}
    const last=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();const final=JSON.parse(await readFile((await(await last).path())!,'utf8'));expect(final.state.structure).toEqual(initial.state.structure);
  }
  expect(errors).toEqual([]);
});
