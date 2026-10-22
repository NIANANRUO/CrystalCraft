import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { verifyRelease } from '../scripts/verify-release.mjs';

test('release verifier rejects wrong commits, dirty sources, tampered assets and substituted dependency locks', async () => {
  const directory=await mkdtemp(path.join(tmpdir(),'crystal-release-'));
  try {
    const dist=path.join(directory,'dist');await mkdir(path.join(dist,'assets'),{recursive:true});
    const files: Record<string,string> = {'index.html':`<meta http-equiv="Content-Security-Policy" content="script-src &#39;self&#39;; object-src &#39;none&#39;; connect-src &#39;self&#39;; worker-src &#39;self&#39;">`,'LICENSE.txt':'MIT','THIRD_PARTY_NOTICES.txt':'notices','assets/main.js':'console.log(1)'};
    const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
    for(const [file,text]of Object.entries(files)) await writeFile(path.join(dist,file),text);
    await writeFile(path.join(directory,'package.json'),'{}');await writeFile(path.join(directory,'package-lock.json'),'{}');
    const sha='a'.repeat(40),info:any={name:'crystal-craft-web',version:'0.8.0',commit:sha,sourceDirty:false,files:Object.fromEntries(Object.entries(files).map(([file,text])=>[file,hash(text)])),provenance:{'package.json':hash('{}'),'package-lock.json':hash('{}')}};
    const save=()=>writeFile(path.join(dist,'build-info.json'),JSON.stringify(info));await save();
    await verifyRelease(dist,sha,{sourceRoot:directory});
    await assert.rejects(verifyRelease(dist,'b'.repeat(40)),/identity/);
    info.sourceDirty=true;await save();await assert.rejects(verifyRelease(dist,sha),/provenance/);
    info.sourceDirty=false;await save();await writeFile(path.join(dist,'assets/main.js'),'changed');
    await assert.rejects(verifyRelease(dist,sha),/integrity/);await writeFile(path.join(dist,'assets/main.js'),files['assets/main.js']);
    await writeFile(path.join(directory,'package-lock.json'),'changed');await assert.rejects(verifyRelease(dist,sha,{sourceRoot:directory}),/dependency/);
    info.files['../escape.js']=hash('x');await save();await assert.rejects(verifyRelease(dist,sha),/Unsafe/);
  } finally {
    if (!path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep+'crystal-release-')) throw new Error('Unexpected test directory');
    await rm(directory,{recursive:true,force:true});
  }
});

test('all directly declared workflow actions use immutable full SHA references', async () => {
  for(const name of await readdir('.github/workflows')) {
    const text=await readFile(`.github/workflows/${name}`,'utf8');
    for(const match of text.matchAll(/\buses:\s*([^\s#]+)/g)) assert.match(match[1],/^[\w-]+\/[\w-]+@[a-f0-9]{40}$/);
  }
});
