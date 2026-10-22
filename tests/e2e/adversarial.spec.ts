import { test, expect, type Page } from '@playwright/test';
import { parseXYZ } from '../../src/parsers/xyz';

const xyz = (title: string) => `1\n${title}\nC 0 0 0\n`;
async function load(page: Page, title: string) {
  await page.locator('input[type=file]').first().setInputFiles({name:'audit.xyz',mimeType:'text/plain',buffer:Buffer.from(xyz(title))});
  await expect(page.getByText('已自动保存到本机',{exact:true})).toBeVisible();
}

test('A4 Cancel, Escape and close invalidate delayed Worker results and preserve the restored workspace', async ({page}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    (window as any).delayedDeliveries = 0;
    window.Worker = class extends NativeWorker {
      postMessage(message: any, options?: any) { setTimeout(() => { (window as any).delayedDeliveries++; super.postMessage(message,options); },600); }
    } as any;
  });
  for (const close of ['cancel','escape','cross']) {
    await page.goto('./?openProperties=true&propertiesTab=isosurfaces');
    await page.getByLabel('导入体数据文件').setInputFiles({name:'CHGCAR',mimeType:'text/plain',buffer:Buffer.from('Delayed cancelled import\n1\n2 0 0\n0 2 0\n0 0 2\nH\n1\nDirect\n.5 .5 .5\n\n2 2 2\n0 8 16 24 32 40 48 56\n')});
    if(close==='cancel') await page.getByRole('button',{name:'Cancel',exact:true}).click();
    else if(close==='escape') await page.keyboard.press('Escape');
    else await page.getByRole('button',{name:'取消并关闭属性窗口',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>(window as any).delayedDeliveries)).toBe(1);
    await expect(page.getByLabel('空白工作区')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(0);
    await expect(page.getByText('取消导入',{exact:true})).toHaveCount(0);
  }
  await load(page,'Latest import after cancellation'); await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('A9 independent tabs and a duplicated tab never replace each other’s recovery', async ({context}) => {
  const a=await context.newPage(), b=await context.newPage();
  await a.goto('./'); await b.goto('./');
  await load(a,'Tab A work'); await load(b,'Tab B work');
  await a.reload(); await a.getByRole('button',{name:'恢复上次项目',exact:true}).click();
  await expect(a.getByText('Tab A work',{exact:true}).first()).toBeVisible();
  await expect(a.getByText('已自动保存到本机',{exact:true})).toBeVisible();
  await b.reload(); await b.getByRole('button',{name:'恢复上次项目',exact:true}).click();
  await expect(b.getByText('Tab B work',{exact:true}).first()).toBeVisible();
  await expect(b.getByText('已自动保存到本机',{exact:true})).toBeVisible();
  const popupEvent=a.waitForEvent('popup'); await a.evaluate(()=>window.open(location.href)); const duplicate=await popupEvent;
  await duplicate.waitForLoadState('domcontentloaded');
  await duplicate.getByRole('button',{name:'恢复上次项目',exact:true}).click();
  await expect(duplicate.getByText('已自动保存到本机',{exact:true})).toBeVisible();
  // The duplicate's identical save must not deduplicate a still-open owner's slot.
  const originalSlot=await a.evaluate(()=>sessionStorage.getItem('crystal-craft-recovery'));
  const retained=await a.evaluate(id=>new Promise<boolean>((resolve,reject)=>{const r=indexedDB.open('crystal-craft-projects',2);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('recovery'),q=tx.objectStore('recovery').get(`workspace:${id}`);tx.oncomplete=()=>{db.close();resolve(typeof q.result==='string');};};}),originalSlot);
  expect(retained).toBe(true);
  await load(duplicate,'Duplicated tab own work');
  await a.reload(); await a.getByRole('button',{name:'恢复上次项目',exact:true}).click();
  await expect(a.getByText('Tab A work',{exact:true}).first()).toBeVisible();
  await expect(a.getByText('已自动保存到本机',{exact:true})).toBeVisible();
});

test('A3 hostile projects and Extended XYZ preserve the current model and remain recoverable', async ({page}) => {
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./'); await load(page,'Kept model');
  const download=page.waitForEvent('download'); await page.getByRole('button',{name:'保存项目',exact:true}).click();
  const {readFile}=await import('node:fs/promises'); const saved=JSON.parse(await readFile((await (await download).path())!,'utf8'));
  saved.state.structure.atoms[0].name={unexpected:'object'};
  await page.locator('input[type=file]').first().setInputFiles({name:'hostile.crystalcraft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
  await expect(page.getByRole('alert')).toContainText('位点名称'); await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.locator('input[type=file]').first().setInputFiles({name:'periodic.xyz',mimeType:'text/plain',buffer:Buffer.from('1\nLattice="5 0 0 0 5 0 0 0 5"\nC 0 0 0\n')});
  await expect(page.getByRole('alert')).toContainText('Extended XYZ');
  await expect(page.getByText('Kept model',{exact:true}).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('storage quota and aborted transactions do not claim successful saves; retry preserves the model', async ({page}) => {
  await page.addInitScript(()=>{
    (window as any).storageFault='quota';
    (window as any).injectedAborts=0;
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args:any[]) {
      if(this.name==='recovery'&&(window as any).storageFault==='quota') throw new DOMException('Injected quota exhaustion','QuotaExceededError');
      const result=original.apply(this,args as any);
      if(this.name==='recovery'&&(window as any).storageFault==='abort'){(window as any).injectedAborts++;this.transaction.abort();}
      return result;
    } as any;
  });
  await page.goto('./');
  await page.locator('input[type=file]').first().setInputFiles({name:'quota.xyz',mimeType:'text/plain',buffer:Buffer.from(xyz('Quota kept model'))});
  await expect(page.getByText(/自动保存失败；/)).toBeVisible();
  await expect(page.getByText('已自动保存到本机',{exact:true})).toHaveCount(0);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.evaluate(()=>(window as any).storageFault='abort');
  await page.getByRole('button',{name:'CPK',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).injectedAborts)).toBeGreaterThan(0);
  await expect(page.getByText(/自动保存失败；/)).toBeVisible();
  await expect(page.getByText('已自动保存到本机',{exact:true})).toHaveCount(0);
  await page.evaluate(()=>(window as any).storageFault='');
  await page.getByRole('button',{name:'球棍',exact:true}).click();
  await expect(page.getByText('已自动保存到本机',{exact:true})).toBeVisible();
  await page.reload(); await page.getByRole('button',{name:'恢复上次项目',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('legacy v1 IndexedDB recovery migrates and clear remains effective across reloads', async ({page}) => {
  const state={structure:parseXYZ(xyz('Legacy recovery')),materialType:'flat',renderMode:'ball-and-stick',showLattice:true,showAxes:true,
    visualSettings:{atomScale:1,bondRadius:.055,bondTolerance:1.15,bondStyle:'single',bondColorMode:'uniform',doubleBondGap:.14,elementColors:{},elementRadii:{},showPolyhedra:false,showHBonds:false,showOutline:false,showShadows:false,showFog:false,showLabels:'none',isOrthographic:false,autoRotate:false,autoRotateSpeed:2,ligandViewRadius:null,showBoundaryAtoms:true}};
  // A same-origin text document lets us seed the old database before any app code runs.
  await page.route('**/legacy-seed',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Legacy storage seed</title>'}));
  await page.goto('./legacy-seed');
  await page.evaluate(text=>new Promise<void>((resolve,reject)=>{
    const request=indexedDB.open('crystal-craft-projects',1);request.onupgradeneeded=()=>request.result.createObjectStore('recovery');
    request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('recovery','readwrite');tx.objectStore('recovery').put(text,'latest');tx.oncomplete=()=>{db.close();resolve();};};
  }),JSON.stringify({kind:'CrystalCraftProject',version:2,state}));
  await page.goto('./'); await expect(page.getByRole('button',{name:'恢复上次项目',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'清除本机恢复记录',exact:true}).click();
  await expect(page.getByRole('button',{name:'恢复上次项目',exact:true})).toHaveCount(0);
  await page.reload(); await expect(page.getByRole('button',{name:'恢复上次项目',exact:true})).toHaveCount(0);
});
