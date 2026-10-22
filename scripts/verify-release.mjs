import { readFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function verifyRelease(directory, expectedCommit, { allowDirty = false, sourceRoot } = {}) {
  if (!/^[a-f0-9]{40}$/.test(expectedCommit ?? '')) throw new Error('Expected a full 40-character commit SHA.');
  const root = path.resolve(directory), info = JSON.parse(await readFile(path.join(root,'build-info.json'),'utf8'));
  if (info.name !== 'crystal-craft-web' || info.commit !== expectedCommit || (!allowDirty && info.sourceDirty !== false)) throw new Error('Release identity or clean-source provenance does not match.');
  if (!info.files || !Object.keys(info.files).length) throw new Error('Release has no complete file manifest.');
  if (!(await lstat(path.join(root,'assets'))).isDirectory()) throw new Error('Unsafe release assets directory.');
  const allowed = /^(?:index\.html|LICENSE\.txt|THIRD_PARTY_NOTICES\.txt|assets\/[A-Za-z0-9_.-]+\.(?:js|css))$/;
  const hash = data => createHash('sha256').update(data).digest('hex');
  for (const [file, expected] of Object.entries(info.files)) {
    if (!allowed.test(file) || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Unsafe release manifest entry.');
    const target = path.resolve(root,file);
    if (!target.startsWith(root+path.sep) || !(await lstat(target)).isFile() || hash(await readFile(target)) !== expected) throw new Error(`Release file integrity failed: ${file}`);
  }
  for (const entry of await readdir(root,{withFileTypes:true})) {
    if (entry.name === 'build-info.json') continue;
    if (entry.name === 'assets' && entry.isDirectory()) {
      for (const asset of await readdir(path.join(root,'assets'))) if (!info.files[`assets/${asset}`]) throw new Error('Unlisted release asset.');
    } else if (!entry.isFile() || !info.files[entry.name]) throw new Error('Unlisted release file.');
  }
  const html = await readFile(path.join(root,'index.html'),'utf8');
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]).find(tag => /http-equiv=["']Content-Security-Policy["']/i.test(tag));
  const encoded = meta?.match(/\bcontent="([^"]*)"/i)?.[1] ?? '';
  const policy = encoded.replace(/&#39;|&#x27;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/&amp;/gi,'&');
  const directives = new Map(policy.split(';').map(value => { const [name,...tokens] = value.trim().split(/\s+/); return [name,tokens.join(' ')]; }));
  if (directives.get('script-src') !== "'self'" || directives.get('object-src') !== "'none'" || directives.get('connect-src') !== "'self'" || directives.get('worker-src') !== "'self'") throw new Error('Release security policy is missing or weakened.');
  if (sourceRoot) for (const file of ['package.json','package-lock.json']) {
    if (hash(await readFile(path.resolve(sourceRoot,file))) !== info.provenance?.[file]) throw new Error('Archived dependency provenance does not match.');
  }
  return info;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'verify-release.mjs' && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const rootIndex = process.argv.indexOf('--source-root');
  await verifyRelease(process.argv[2],process.argv[3],{allowDirty:process.argv.includes('--allow-dirty'),sourceRoot:rootIndex<0?undefined:process.argv[rootIndex+1]});
  process.stdout.write('Release identity, provenance and file integrity verified.\n');
}
