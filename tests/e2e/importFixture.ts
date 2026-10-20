import {expect,type Page} from '@playwright/test';
import {TEST_POSCAR} from '../fixtures/structures';

export async function importFixture(page:Page){
  await page.locator('input[type=file]').first().setInputFiles({name:'synthetic.vasp',mimeType:'text/plain',buffer:Buffer.from(TEST_POSCAR)});
  await expect(page.locator('tbody tr')).toHaveCount(4);
}
