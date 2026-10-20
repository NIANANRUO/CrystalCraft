import { build } from 'esbuild';
import { readdir, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const directory = path.resolve('.test-build');
await mkdir(directory, { recursive: true });
try {
  const files = (await readdir('tests')).filter(name => name.endsWith('.test.ts'));
  if (!files.length) throw new Error('No tests found');
  await build({ entryPoints: files.map(name => `tests/${name}`), outdir: directory, outExtension: { '.js': '.mjs' }, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
  const result = spawnSync(process.execPath, ['--test', ...files.map(name => path.join(directory, name.replace(/\.ts$/, '.mjs')))], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
