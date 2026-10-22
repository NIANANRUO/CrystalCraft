import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const transientError = /\b(?:EAI_AGAIN|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ERR_SOCKET_TIMEOUT|FETCH_ERROR|408|429|500|502|503|504)\b|network timeout|request timed out/i;

export function auditCommand(extraArgs, npmCli = process.env.npm_execpath) {
  if (!npmCli) throw new Error('Run this check with npm run audit:dependencies.');
  for (let index = 0; index < extraArgs.length; index++) {
    if (extraArgs[index] === '--omit=dev') continue;
    if (extraArgs[index] === '--prefix' && extraArgs[index + 1] && !extraArgs[index + 1].startsWith('-')) { index++; continue; }
    throw new Error('Unsupported audit option. Only --omit=dev and --prefix <directory> are accepted.');
  }
  return [process.execPath, [npmCli, 'audit', '--json', '--audit-level=moderate', '--fetch-retries=0', '--fetch-timeout=20000', ...extraArgs]];
}

function validReport(report) {
  const counts = report?.metadata?.vulnerabilities;
  return report?.auditReportVersion === 2 && !report.error && report.vulnerabilities && typeof report.vulnerabilities === 'object' && !Array.isArray(report.vulnerabilities)
    && ['info', 'low', 'moderate', 'high', 'critical', 'total'].every(key => Number.isSafeInteger(counts?.[key]) && counts[key] >= 0);
}

export async function auditDependencies({ extraArgs = [], npmCli, run = spawnSync, sleep = delay, log = console.log } = {}) {
  const [command, args] = auditCommand(extraArgs, npmCli);
  for (let attempt = 1; attempt <= 3; attempt++) {
    log(`Dependency audit attempt ${attempt}/3 (20-second request timeout; 60-second process limit).`);
    const result = run(command, args, { encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    let report;
    try { report = JSON.parse(result.stdout); } catch { /* Invalid output cannot establish a clean audit. */ }
    if (validReport(report)) {
      log(result.stdout.trim());
      const { moderate, high, critical } = report.metadata.vulnerabilities;
      if (moderate + high + critical > 0) {
        log('Dependency audit found vulnerabilities at or above moderate severity; refusing to continue.');
        return 1;
      }
      if (result.status === 0 && !result.error) return 0;
    }
    const diagnostics = [result.stdout, result.stderr, result.error?.code, result.error?.message].filter(Boolean).join('\n');
    log(diagnostics.slice(-6000) || 'Audit did not return a valid successful report.');
    if (!transientError.test(diagnostics) || attempt === 3 || validReport(report)) {
      log('Dependency audit could not be completed; refusing to continue.');
      return 1;
    }
    const waitMs = attempt === 1 ? 5000 : 15000;
    log(`Temporary audit service/network failure; retrying in ${waitMs / 1000} seconds.`);
    await sleep(waitMs);
  }
  return 1;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'audit-dependencies.mjs' && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await auditDependencies({ extraArgs: process.argv.slice(2) });
}
