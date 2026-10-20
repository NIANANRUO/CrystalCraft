import { readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await copyFile('LICENSE', 'dist/LICENSE.txt');
let commit = null;
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim(); } catch { /* A local directory need not be a repository. */ }
const assets = {};
for (const file of await readdir('dist/assets')) assets[`assets/${file}`] = createHash('sha256').update(await readFile(`dist/assets/${file}`)).digest('hex');
await writeFile('dist/build-info.json', JSON.stringify({ name: pkg.name, version: pkg.version, license: pkg.license, commit, builtAt: new Date().toISOString(), assets }, null, 2) + '\n');
