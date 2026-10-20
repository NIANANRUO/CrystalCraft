import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const server = spawn(process.execPath, ['tests/serve-production.mjs'], { windowsHide: true, stdio: 'pipe' });
let browser;
const results = [];
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Performance server startup timed out')), 10000);
    server.stdout.on('data', data => { if (data.toString().includes('Production test server')) { clearTimeout(timer); resolve(); } });
    server.on('exit', code => { clearTimeout(timer); reject(new Error(`Performance server exited ${code}`)); });
  });
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://127.0.0.1:4174/crystal-craft-test/');
  await page.locator('input[type=file]').setInputFiles({name:'benchmark.xyz',mimeType:'text/plain',buffer:Buffer.from('2\nSynthetic benchmark seed\nC 0 0 0\nC 1.4 0 0\n')});
  await page.locator('tbody tr').first().waitFor();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '保存项目', exact: true }).click();
  const fixture = JSON.parse(await readFile((await (await download).path()), 'utf8'));
  await page.close();
  for (const count of [500, 1000, 2000]) for (const variant of ['comic-opaque', 'glass-shadow-labels']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await context.newPage(); const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.addInitScript(() => {
      window.drawCount = 0;
      for (const name of ['drawElements', 'drawElementsInstanced', 'drawArrays', 'drawArraysInstanced']) {
        const original = WebGL2RenderingContext.prototype[name];
        WebGL2RenderingContext.prototype[name] = function (...args) { window.drawCount++; return original.apply(this, args); };
      }
    });
    await p.goto('http://127.0.0.1:4174/crystal-craft-test/?showShadows=false');
    await p.getByLabel('空白工作区').waitFor();
    const project = structuredClone(fixture), heavy = variant.startsWith('glass');
    project.state.structure = { title: `Performance ${count}`, isPeriodic: false, format: 'xyz', atoms: Array.from({ length: count }, (_, i) => {
      const coord = { x: (i % 20) * 2, y: Math.floor(i / 20) % 10 * 2, z: Math.floor(i / 200) * 2 };
      return { id: i+1, element: 'C', cartesian: coord, fractional: coord };
    }) };
    project.state.materialType = heavy ? 'glass' : 'comic';
    Object.assign(project.state.visualSettings, { showShadows: heavy, showOutline: !heavy, showLabels: heavy ? 'element+id' : 'none' });
    const start = performance.now();
    await p.locator('input[type=file]').setInputFiles({ name: 'benchmark.crystalcraft.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
    await p.getByText(`${count} atoms, 0 bonds, 0 polyhedra`, { exact: true }).waitFor({ timeout: 90000 });
    const loadMs = performance.now() - start;
    await p.getByText('已自动保存到本机', { exact: true }).waitFor();
    const idleDraws = await p.evaluate(async () => {
      await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
      const initial = window.drawCount;
      for (let i = 0; i < 30; i++) await new Promise(requestAnimationFrame);
      return window.drawCount - initial;
    });
    project.state.visualSettings.autoRotate = true;
    await p.locator('input[type=file]').setInputFiles({ name: 'benchmark.crystalcraft.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
    await p.getByText('已自动保存到本机', { exact: true }).waitFor();
    const data = await p.evaluate(async () => {
      let previous = performance.now(), frames = [], startDraw = window.drawCount;
      const start = performance.now();
      while (frames.length < 60 && performance.now() - start < 12000) {
        await new Promise(requestAnimationFrame); const now = performance.now(); frames.push(now - previous); previous = now;
      }
      const elapsed = frames.reduce((a, b) => a+b, 0), sorted = frames.slice().sort((a,b) => a-b);
      const gl = document.querySelector('canvas').getContext('webgl2');
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return { frameCount: frames.length, fps: 1000 * frames.length / elapsed, p95FrameMs: sorted[Math.min(sorted.length-1, Math.floor(sorted.length * .95))], drawsPerFrame: (window.drawCount-startDraw)/frames.length,
        jsHeapMiB: performance.memory?.usedJSHeapSize / 1024 / 1024 || null,
        gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unavailable' };
    });
    const record = { count, variant, loadMs, idleDrawsOver30Frames: idleDraws, ...data, errors, alerts: await p.getByRole('alert').allTextContents() };
    results.push(record); console.log(JSON.stringify(record));
    await p.screenshot({ path: `docs/qa/hardening/performance-${count}-${variant}.png` });
    await context.close();
  }
} finally {
  await mkdir('docs/qa/hardening', { recursive: true });
  await writeFile('docs/qa/hardening/performance.json', JSON.stringify({ platform: process.platform, node: process.version, browser: browser?.version(), conditions: '1440x1000 Windows Edge, SwiftShader software GPU; sparse 2 Å carbon grid; idle 30-frame sample then auto-rotation 60-frame sample (12 s cap); no real mobile device or endurance certification', results }, null, 2));
  await browser?.close(); server.kill();
}
if (results.some(r => r.errors.length || r.alerts.length || r.idleDrawsOver30Frames > 0) || results.length !== 6) process.exitCode = 1;
