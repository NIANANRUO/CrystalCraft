import { readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await copyFile('LICENSE', 'dist/LICENSE.txt');
let commit = null;
let sourceDirty = true;
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim(); } catch { /* A local directory need not be a repository. */ }
try { sourceDirty = !!execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim(); } catch { /* Unknown provenance must not be claimed clean. */ }
const assets = {};
for (const file of await readdir('dist/assets')) assets[`assets/${file}`] = createHash('sha256').update(await readFile(`dist/assets/${file}`)).digest('hex');
const files = { ...assets };
const provenance = {};
for (const file of ['package.json','package-lock.json']) provenance[file] = createHash('sha256').update(await readFile(file)).digest('hex');
for (const file of ['index.html', 'LICENSE.txt', 'THIRD_PARTY_NOTICES.txt']) files[file] = createHash('sha256').update(await readFile(`dist/${file}`)).digest('hex');
await writeFile('dist/build-info.json', JSON.stringify({ name: pkg.name, version: pkg.version, license: pkg.license, commit, sourceDirty, builtAt: new Date().toISOString(), assets, files, provenance }, null, 2) + '\n');
