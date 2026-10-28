import {chromium} from '@playwright/test';
import axe from 'axe-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});
const page=await context.newPage();
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* offline synthetic app */'}));
mkdirSync('qa/artifacts/contrast-4-1',{recursive:true});
const report=[];
try{
  await page.goto('http://127.0.0.1:8777/?demo=1',{waitUntil:'domcontentloaded'});
  await page.locator('body.csm-os4').waitFor();
  await page.addScriptTag({content:axe.source});
  for(const theme of ['light','dark']){
    await page.evaluate(v=>{document.body.dataset.theme=v;localStorage.setItem('campbox-csm-os-theme',v)},theme);
    for(const width of [375,1440]){
      await page.setViewportSize({width,height:900});
      for(const view of ['dashboard','camps','features','profile','report']){
        await page.evaluate(v=>setView(v),view);
        const result=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'rule',values:['color-contrast']}}));
        report.push({theme,width,view,incomplete:result.incomplete.length,violations:result.violations.flatMap(v=>v.nodes.map(n=>({rule:v.id,html:n.html,summary:n.failureSummary,targets:n.target})))});
      }
      await page.evaluate(()=>{setView('camps');openCampModal(camps.find(c=>c.active)?.id||camps[0].id)});
      await page.locator('.camp-edit-modal').waitFor();
      const modal=await page.evaluate(async()=>window.axe.run(document.getElementById('modalRoot'),{runOnly:{type:'rule',values:['color-contrast']}}));
      report.push({theme,width,view:'modal',incomplete:modal.incomplete.length,violations:modal.violations.flatMap(v=>v.nodes.map(n=>({rule:v.id,html:n.html,summary:n.failureSummary,targets:n.target})))});
      await page.evaluate(()=>closeModal());
    }
  }
  writeFileSync('qa/artifacts/contrast-4-1/axe-color-contrast.json',JSON.stringify(report,null,2));
  const bad=report.flatMap(r=>r.violations.map(v=>({...v,theme:r.theme,width:r.width,view:r.view})));
  console.log('axe-core WCAG AA color-contrast scans: '+report.length+', violations '+bad.length+', inconclusive '+report.reduce((n,r)=>n+r.incomplete,0));
  assert.deepEqual(bad.slice(0,30),[],'Axe detected text contrast failures in UI scenarios');
}finally{await browser.close()}
