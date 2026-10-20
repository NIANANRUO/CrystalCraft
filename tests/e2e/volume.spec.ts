import {test,expect} from '@playwright/test';
import {importFixture} from './importFixture';
import {readFile} from 'node:fs/promises';

test('former isosurface and section placeholders produce meshes, export matching CSV and survive project reload',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('./?openProperties=true&propertiesTab=isosurfaces');
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'载入合成体数据演示',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.getByText(/^等值面：[1-9]\d* 三角形/)).toBeVisible();
  await dialog.getByRole('spinbutton',{name:'等值面阈值'}).fill('.3');
  await dialog.getByRole('button',{name:'Sections',exact:true}).click();
  await dialog.getByRole('checkbox',{name:'显示二维切片',exact:true}).check();
  await dialog.getByRole('combobox',{name:'切片坐标轴'}).selectOption('a');
  await dialog.getByRole('spinbutton',{name:'切片分数位置'}).fill('.25');
  await expect(page.getByText(/等值面：\d+ 三角形 · 切片已显示/)).toBeVisible();
  const csvEvent=page.waitForEvent('download');await dialog.getByRole('button',{name:'导出当前切片 CSV'}).click();
  const csv=await readFile((await(await csvEvent).path())!,'utf8');expect(csv).toContain('units=任意单位');expect(csv.split('\n')[2]).toMatch(/^0.25,0,0,1.5,0,0,/);
  await dialog.getByRole('button',{name:'OK',exact:true}).click();
  await page.screenshot({path:'docs/qa/volume/isosurface-section.png'});
  const saved=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();
  const text=await readFile((await(await saved).path())!,'utf8'),project=JSON.parse(text);
  expect(project.state.structure.volumeData.channels[0].values).toHaveLength(24**3);
  expect(project.state.visualSettings.volumeSettings).toMatchObject({isoValue:.3,sectionAxis:'a',sectionPosition:.25,sectionEnabled:true});
  await page.locator('input[type=file]').setInputFiles({name:'field.crystalcraft.json',mimeType:'application/json',buffer:Buffer.from(text)});
  await expect(page.getByText(/等值面：\d+ 三角形 · 切片已显示/)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);expect(errors).toEqual([]);
});

test('VASP grid imports are real, invalid replacement preserves old field, and Cancel rolls back demo loading',async({page})=>{
  await page.goto('./?openProperties=true&propertiesTab=sections');
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'载入合成体数据演示',exact:true}).click();
  await expect(page.getByText(/切片已显示/)).toBeVisible();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(0);
  const text='Charge test\n1\n2 0 0\n0 2 0\n0 0 2\nH\n1\nDirect\n.5 .5 .5\n\n2 2 2\n0 8 16 24 32 40 48 56\n';
  await page.locator('input[type=file]').setInputFiles({name:'CHGCAR',mimeType:'text/plain',buffer:Buffer.from(text)});
  await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.getByText('CHGCAR · Å⁻³',{exact:true})).toBeVisible();
  await expect(page.getByText(/^等值面：[1-9]\d* 三角形/)).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({name:'CHGCAR.bad',mimeType:'text/plain',buffer:Buffer.from(text.replace('48 56','NaN'))});
  await expect(page.getByRole('alert')).toContainText('解析失败');await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('manual ionic radius is applied, saved and cancellable; automatic rotation has a working menu entry',async({page})=>{
  await page.goto('./'); await importFixture(page); await page.keyboard.press('Control+p');
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('combobox',{name:'半径类型'}).selectOption('ionic');
  await dialog.getByRole('spinbutton',{name:'价态',exact:true}).fill('2');
  await dialog.getByRole('spinbutton',{name:'配位数',exact:true}).fill('6');
  await dialog.getByRole('spinbutton',{name:'离子半径 Å',exact:true}).fill('.72');
  await dialog.getByRole('button',{name:'应用离子半径',exact:true}).click();
  await expect(dialog.getByRole('spinbutton',{name:'原子显示半径'})).toHaveValue('0.72');
  await dialog.getByRole('button',{name:'OK',exact:true}).click();
  const saved=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();
  const project=JSON.parse(await readFile((await(await saved).path())!,'utf8'));
  expect(project.state.visualSettings.ionicRadii.C).toEqual({charge:2,coordination:6,radius:.72});
  await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('button',{name:'开启自动旋转',exact:true}).click();
  const before=await page.locator('canvas').first().evaluate((c:HTMLCanvasElement)=>c.toDataURL());
  await expect.poll(()=>page.locator('canvas').first().evaluate((c:HTMLCanvasElement)=>c.toDataURL())).not.toBe(before);
  await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('button',{name:'暂停自动旋转',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
