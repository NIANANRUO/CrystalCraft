import {test,expect} from '@playwright/test';

test('homepage starts empty; importing and recovery require explicit user actions',async({page})=>{
  await page.goto('./?material=microfacet');
  await expect(page.getByLabel('空白工作区')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(page.getByLabel('材质图例')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'保存项目',exact:true})).toBeDisabled();
  const chooser=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'选择结构文件',exact:true}).click();
  await (await chooser).setFiles({name:'local.xyz',mimeType:'text/plain',buffer:Buffer.from('2\nUser selected local file\nH 0 0 0\nH 0 0 .74\n')});
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.getByLabel('空白工作区')).toHaveCount(0);
  await expect(page.getByText('已自动保存到本机',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('空白工作区')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'恢复上次项目',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'清除本机恢复记录',exact:true}).click();
  await page.reload();
  await expect(page.getByLabel('空白工作区')).toBeVisible();
  await expect(page.getByRole('button',{name:'恢复上次项目',exact:true})).toHaveCount(0);
});
