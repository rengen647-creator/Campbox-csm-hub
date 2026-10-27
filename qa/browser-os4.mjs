import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
// Demo needs no third-party scripts; use synthetic data and avoid external accounts.
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* offline demo dependency */'}));
const base='http://127.0.0.1:8777/?demo=1';
mkdirSync('qa/artifacts',{recursive:true});
try {
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#osDashboard').waitFor({state:'visible',timeout:15000});
  assert.equal(await page.locator('body.csm-os4').count(),1,'OS theme not active');
  assert.ok(Number(await page.locator('#osQueueSize').innerText().then(s=>parseInt(s)))>=0,'Queue missing');
  await page.locator('.sidebar button[data-view="camps"]').click();
  await page.locator('#osCampSearch').fill('Росинка');
  assert.match(await page.locator('#campCountLabel').innerText(),/1 лагерь|1 лагерей/);
  await page.locator('#campTableBody button').first().click();
  await page.locator('.os-modal-tabset').waitFor();
  assert.equal(await page.locator('.os-modal-tabset [data-camp-tab]').count(),6);
  await page.locator('#campContractNumberEdit').fill('DEMO-NOT-SAVED');
  page.once('dialog',d=>d.dismiss());
  await page.locator('.os-360 .camp-modal-head-actions .icon-btn').click();
  assert.equal(await page.locator('.camp-edit-modal.os-360').count(),1,'Unsaved guard failed');
  page.once('dialog',d=>d.accept());
  await page.locator('.os-360 .camp-modal-head-actions .icon-btn').click();
  assert.equal(await page.locator('.camp-edit-modal.os-360').count(),0);
  await page.evaluate(()=>setView('contacts'));
  assert.equal(await page.locator('#osWork').count(),1);
  await page.locator('#osWorkTabs [data-work="history"]').click();
  assert.equal(await page.locator('#contactsList').isVisible(),true);
  await page.evaluate(()=>setView('features'));
  assert.ok(await page.locator('.os-feature-matrix tbody tr').count()>0);
  await page.evaluate(()=>setView('profile'));
  assert.equal(await page.locator('#osDiscovery').count(),1);
  await page.evaluate(()=>setView('launches'));
  assert.equal(await page.locator('#osLaunchCalendar').count(),1);
  await page.evaluate(()=>setView('report'));
  assert.equal(await page.locator('#osReportDynamics').count(),1);
  await page.evaluate(()=>setView('dashboard'));
  for(const width of [375,430,720,820,1024,1280,1440,1593,1920]){
    await page.setViewportSize({width,height:900});
    await page.screenshot({path:'qa/artifacts/dashboard-'+width+'.png',fullPage:true});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=4,'Page horizontal overflow at '+width+'px: '+overflow);
    if(width===375){
      await page.locator('#osMobileMore').click();
      assert.equal(await page.locator('#osMobileSheet').isVisible(),true);
      await page.locator('#osMobileSheet [data-os-mobile-dest="features"]').click();
      assert.equal(await page.locator('#viewFeatures').isVisible(),true);
      await page.evaluate(()=>setView('dashboard'));
    }
  }
  assert.deepEqual(errors,[],'Uncaught browser errors');
  console.log('PASS: demo browser flows, guards, 8 screen routes, widths, mobile More');
} finally {
  await browser.close();
}
