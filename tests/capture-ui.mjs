import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = process.argv[2] ?? 'docs/qa/hardening';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [name, viewport, query] of [
  ['desktop', { width: 1440, height: 1000 }, ''],
  ['atoms', { width: 1440, height: 1000 }, '?openProperties=true&propertiesTab=atoms'],
  ['mobile', { width: 390, height: 844 }, ''],
]) {
  const page = await browser.newPage({ viewport });
  await page.goto(`http://127.0.0.1:4174/crystal-craft-test/${query}`);
  await page.getByLabel('空白工作区').waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `${directory}/${name}.png` });
  const styles = await page.locator('button, input, select, fieldset, legend').evaluateAll(elements => elements.map(el => {
    const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
    return { tag: el.tagName, text: el.textContent?.trim().slice(0, 80), x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      border: style.border, radius: style.borderRadius, font: style.font, shadow: style.boxShadow, background: style.backgroundColor };
  }));
  await writeFile(`${directory}/${name}.json`, JSON.stringify(styles, null, 2));
  await page.close();
}
await browser.close();
