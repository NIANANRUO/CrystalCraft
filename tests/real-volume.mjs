import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const inputs=[process.env.CHARGE_FILE,process.env.ELF_FILE];
if(inputs.some(p=>!p))throw new Error('Set CHARGE_FILE and ELF_FILE to local VASP files.');
const references=JSON.parse(await readFile('docs/qa/real-volume/reference.json','utf8'));
const port=4175,base=`http://127.0.0.1:${port}/crystal-craft-test/`;
const server=spawn(process.execPath,['tests/serve-production.mjs'],{windowsHide:true,stdio:'pipe',env:{...process.env,TEST_PORT:String(port)}});
let browser;const results=[];
const near=(a,b,tolerance=1e-11)=>assert.ok(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(b)),`${a} != ${b}`);
try{
  await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('Production test server'))resolve();});server.on('exit',c=>reject(new Error(`Server ${c}`)));});
  browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  await mkdir('docs/qa/real-volume',{recursive:true});
  for(let index=0;index<inputs.length;index++){
    const ref=references[index],name=index?'elf':'charge',errors=[];
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(180000);
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(base+'?showShadows=false');
    await page.getByRole('button',{name:'Boundary PBC: ON',exact:true}).click();
    const start=performance.now();console.log(`Importing ${ref.name} (${ref.bytes} bytes)`);
    await page.locator('input[type=file]').setInputFiles(inputs[index]);
    await expect(page.getByText(`${index?'ELFCAR · 无量纲':'CHGDIFF · Å⁻³'}`,{exact:true})).toBeVisible({timeout:300000});
    await expect(page.locator('tbody tr')).toHaveCount(75,{timeout:30000});
    await expect(page.getByText(/^等值面：[1-9]\d* 三角形/)).toBeVisible({timeout:120000});
    const importMs=performance.now()-start;
    console.log(`${name}: parsed and meshed in ${importMs.toFixed(0)} ms`);
    const saved=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();
    const project=JSON.parse(await readFile(await(await saved).path(),'utf8')),data=project.state.structure.volumeData;
    assert.deepEqual(data.originalDimensions,ref.dimensions);assert.equal(data.sourceBytes,ref.bytes);assert.equal(data.channels.length,ref.channels.length);
    const divisor=index?1:ref.volume;
    const originalCenter=ref.dimensions[0]/2+ref.dimensions[1]/2*ref.dimensions[0]+ref.dimensions[2]/2*ref.dimensions[0]*ref.dimensions[1];
    const [nx,ny,nz]=data.dimensions,center=nx/2+ny/2*nx+nz/2*nx*ny;
    data.channels.forEach((c,i)=>{const r=ref.channels[i];assert.equal(c.sourceStats.count,r.count);near(c.sourceStats.min,r.rawMin/divisor);near(c.sourceStats.max,r.rawMax/divisor);near(c.sourceStats.mean,r.rawMean/divisor);near(c.values[0],r.samples['0']/divisor);near(c.values[center],r.samples[originalCenter]/divisor);});
    console.log(`${name}: statistics, retained samples and project checked`);
    await page.goto(base+'?openProperties=true&propertiesTab=isosurfaces&showShadows=false');
    // Reload saved data with the property editor already open, then use the actual controls.
    await page.locator('input[type=file]').first().setInputFiles({name:`${name}.crystalcraft.json`,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
    const dialog=page.getByRole('dialog');
    await dialog.getByRole('spinbutton',{name:'等值面阈值'}).fill(index?'.6':'.003');
    await expect(page.getByText(/^等值面：[1-9]\d* 三角形/)).toBeVisible({timeout:120000});
    if(index){await dialog.getByRole('combobox',{name:'体数据通道'}).selectOption('1');await dialog.getByRole('spinbutton',{name:'等值面阈值'}).fill('.6');await expect(page.getByText(/^等值面：[1-9]\d* 三角形/)).toBeVisible({timeout:120000});}
    await dialog.getByRole('button',{name:'OK',exact:true}).click();
    console.log(`${name}: isosurface controls checked`);
    // Zoom buttons work even when the software renderer is slow to paint.
    await page.getByRole('button',{name:'+',exact:true}).click();
    await page.screenshot({path:`docs/qa/real-volume/${name}-isosurface.png`});
    await page.getByRole('button',{name:'Properties...',exact:false}).first().click();
    await dialog.getByRole('button',{name:'Sections',exact:true}).click();
    await dialog.getByRole('checkbox',{name:'显示二维切片',exact:true}).check();
    await dialog.getByRole('spinbutton',{name:'切片分数位置'}).fill('.5');
    await expect(page.getByText(/等值面：\d+ 三角形 · 切片已显示/)).toBeVisible({timeout:120000});
    const csvEvent=page.waitForEvent('download');await dialog.getByRole('button',{name:'导出当前切片 CSV'}).click();
    const csv=await readFile(await(await csvEvent).path(),'utf8'),rows=csv.trim().split('\n');
    // c=.5 plane starts at x=y=0, an exact retained grid node.
    near(Number(rows[2].split(',')[6]),data.channels[index?1:0].values[nz/2*nx*ny]);
    await writeFile(`docs/qa/real-volume/${name}-section.csv`,csv);
    await dialog.getByRole('button',{name:'OK',exact:true}).click();
    await page.screenshot({path:`docs/qa/real-volume/${name}.png`});
    await page.getByRole('button',{name:'渲染图像',exact:true}).click();
    await page.getByRole('button',{name:/3840px.*4K/}).click();
    await page.getByRole('button',{name:/1920px.*1080p/}).click();
    await page.getByRole('button',{name:/^Normal/}).click();
    const pngEvent=page.waitForEvent('download');await page.getByRole('button',{name:'导出 PNG 图像',exact:true}).click();
    const png=await readFile(await(await pngEvent).path());assert.equal(png.subarray(1,4).toString(),'PNG');
    await writeFile(`docs/qa/real-volume/${name}-export.png`,png);
    assert.deepEqual(errors,[]);assert.deepEqual(await page.getByRole('alert').allTextContents(),[]);
    const result={name:ref.name,sha256:ref.sha256,bytes:ref.bytes,atoms:75,originalDimensions:data.originalDimensions,displayDimensions:data.dimensions,samplingSteps:data.samplingSteps,importMs,channels:data.channels.map(c=>({label:c.label,retainedPoints:c.values.length,min:c.min,max:c.max,sourceStats:c.sourceStats})),csvRows:rows.length-2,pngBytes:png.length,errors};
    results.push(result);console.log(JSON.stringify(result));await context.close();
  }
}finally{await writeFile('docs/qa/real-volume/result.json',JSON.stringify({node:process.version,browser:browser?.version(),conditions:'Windows Edge / SwiftShader, 1440x1000; complete source scans checked against independent NumPy reference, retained origin/center samples and section CSV checked',results},null,2));await browser?.close();server.kill();}
assert.equal(results.length,2);
