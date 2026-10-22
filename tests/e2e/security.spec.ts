import { test, expect } from '@playwright/test';

test('production CSP permits the local app and workers while blocking injected scripts and external connections', async ({page}) => {
  await page.addInitScript(()=>{
    (window as any).policyViolations=[];
    document.addEventListener('securitypolicyviolation',event=>(window as any).policyViolations.push(event.violatedDirective));
  });
  await page.goto('./');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content',/script-src 'self';/);
  await page.locator('input[type=file]').first().setInputFiles({name:'local.xyz',mimeType:'text/plain',buffer:Buffer.from('1\nCSP local import\nC 0 0 0\n')});
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.evaluate(()=>{const script=document.createElement('script');script.textContent='window.injectedScriptRan=true';document.head.append(script);});
  await expect.poll(()=>page.evaluate(()=>(window as any).policyViolations.some((d:string)=>d.startsWith('script-src')))).toBe(true);
  expect(await page.evaluate(()=>(window as any).injectedScriptRan)).toBeUndefined();
  const requestBlocked=await page.evaluate(async()=>{try{await fetch('https://example.com/probe');return false;}catch{return true;}});
  expect(requestBlocked).toBe(true);
  await expect.poll(()=>page.evaluate(()=>(window as any).policyViolations.includes('connect-src'))).toBe(true);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
