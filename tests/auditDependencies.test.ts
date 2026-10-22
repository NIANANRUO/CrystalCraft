import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCommand, auditDependencies } from '../scripts/audit-dependencies.mjs';

const report = (moderate = 0) => JSON.stringify({ auditReportVersion: 2, vulnerabilities: moderate ? { example: { severity: 'moderate' } } : {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate, high: 0, critical: 0, total: moderate } } });
const clean = { status: 0, stdout: report(), stderr: '' };

async function exercise(results: any[]) {
  let calls = 0;
  const waits: number[] = [];
  const status = await auditDependencies({ npmCli: '/npm-cli.js', run: () => { const next = results[calls++]; assert.ok(next, 'unexpected extra retry'); return next; }, sleep: async (ms: number) => { waits.push(ms); }, log: () => {} });
  return { status, calls, waits };
}

test('audit retries service 503 and request timeout, then requires a clean report', async () => {
  assert.deepEqual(await exercise([{ status: 1, stdout: JSON.stringify({ error: { code: 'E503', summary: '503 Service Unavailable' } }) }, { status: null, error: { code: 'ETIMEDOUT' } }, clean]), { status: 0, calls: 3, waits: [5000, 15000] });
});

test('audit fails immediately on real moderate vulnerabilities even if a description contains 503', async () => {
  assert.deepEqual(await exercise([{ status: 1, stdout: report(1), stderr: 'advisory 503' }]), { status: 1, calls: 1, waits: [] });
  assert.equal((await exercise([{ status: 0, stdout: report(1) }])).status, 1, 'a wrong CLI exit status cannot bypass vulnerability counts');
});

test('audit remains failed after bounded network retries', async () => {
  const failure = { status: 1, stderr: 'network timeout at audit endpoint' };
  assert.deepEqual(await exercise([failure, failure, failure]), { status: 1, calls: 3, waits: [5000, 15000] });
});

test('audit never retries lockfile errors, authentication errors or invalid clean reports', async () => {
  for (const result of [{ status: 1, stderr: 'ENOLOCK missing lockfile' }, { status: 1, stderr: '401 Unauthorized' }, { status: 0, stdout: '{}' }, { status: 0, stdout: JSON.stringify({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } }) }, { ...clean, status: 1 }]) {
    assert.deepEqual(await exercise([result]), { status: 1, calls: 1, waits: [] });
  }
});

test('audit command keeps runtime-only archive checks and never invokes a shell', () => {
  const [command, args] = auditCommand(['--prefix', 'release bundle', '--omit=dev'], '/npm-cli.js');
  assert.equal(command, process.execPath);
  assert.deepEqual(args, ['/npm-cli.js', 'audit', '--json', '--audit-level=moderate', '--fetch-retries=0', '--fetch-timeout=20000', '--prefix', 'release bundle', '--omit=dev']);
  assert.throws(() => auditCommand(['--audit-level=critical'], '/npm-cli.js'), /Unsupported/);
  assert.throws(() => auditCommand(['--prefix'], '/npm-cli.js'), /Unsupported/);
});
