import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* offline demo */'}));
try{
 await page.goto('http://127.0.0.1:8777/?demo=1',{waitUntil:'domcontentloaded'});
 await page.locator('#osDashboard').waitFor();
 const setup=await page.evaluate(()=>{
   setView('report');
   const from=reportDateFrom();
   // Pick a camp with a real historical contact in the last selected report period.
   const candidate=csmScopeCamps().find(c=>contacts.some(x=>x.camp_id===c.id&&x.contact_date>=from));
   if(!candidate)throw Error('Missing synthetic camp with a period contact');
   const history=contacts.filter(x=>reportHistoryCamps().some(c=>c.id===x.camp_id)&&x.contact_date>=from);
   return {id:candidate.id,activeBefore:csmScopeCamps().length,historyBefore:history.length,campCount:history.filter(x=>x.camp_id===candidate.id).length};
 });
 await page.locator('#reportHistoryScope').waitFor({state:'visible'});
 assert.ok(setup.campCount>0);
 const baseline=Number(await page.locator('#reportKpis > .kpi').nth(1).locator('b').innerText());
 assert.equal(baseline,setup.historyBefore,'History KPI not equal to source activity journal');
 const result=await page.evaluate(campId=>{
   camps.find(c=>c.id===campId).csm_reporting_active=false;
   renderWorkReport();renderFeatureWorkspace();renderProfileDashboard();
   return {
      currentCamps:csmScopeCamps().length,
      historicCamps:reportHistoryCamps().length,
      historicalCount:contacts.filter(x=>reportHistoryCamps().some(c=>c.id===x.camp_id)&&x.contact_date>=reportDateFrom()).length,
      currentScopeLabel:document.getElementById('osReportCaption')?.textContent||''
   };
 },setup.id);
 assert.equal(result.currentCamps,setup.activeBefore-1,'Current active cohort failed to exclude camp');
 assert.equal(result.historicalCount,setup.historyBefore,'Historical contacts changed after current CSM deactivation');
 assert.match(result.currentScopeLabel,/история работы:/);
 assert.equal(Number(await page.locator('#reportKpis > .kpi').nth(1).locator('b').innerText()),setup.historyBefore,'Historical KPI incorrectly changed');
 await page.locator('#reportHistoryScope').selectOption('active');
 const activeHistory=Number(await page.locator('#reportKpis > .kpi').nth(1).locator('b').innerText());
 assert.equal(activeHistory,setup.historyBefore-setup.campCount,'Active-only history mode ignored excluded camp');
 await page.locator('#reportHistoryScope').selectOption('all');
 assert.equal(Number(await page.locator('#reportKpis > .kpi').nth(1).locator('b').innerText()),setup.historyBefore,'Returning to all history failed');
 const excel=await page.evaluate(()=>{
   window.__exportData=null;
   window.XLSX={
      utils:{
        book_new:()=>({SheetNames:[],Sheets:{}}),
        json_to_sheet:rows=>({__rows:rows}),
        book_append_sheet:(book,sheet,name)=>{book.SheetNames.push(name);book.Sheets[name]=sheet}
      },
      writeFile:(book,fileName)=>{window.__exportData={book,fileName}}
   };
   exportExcel();
   return window.__exportData;
 });
 assert.ok(excel,'Excel export not invoked');
 assert.deepEqual(excel.book.SheetNames,['Итоги','Клиенты','Работа','Внедрение','Запуски','Профиль']);
 const summary=excel.book.Sheets['Итоги'].__rows;
 const histCount=summary.find(x=>x.Показатель==='Контактов за период')?.Значение;
 assert.equal(histCount,setup.historyBefore,'Excel period contact count differs from screen');
 assert.equal(excel.book.Sheets['Работа'].__rows.length,setup.historyBefore,'Excel history rows differ from UI/period source');
 const currentClientRows=excel.book.Sheets['Клиенты'].__rows;
 assert.ok(!currentClientRows.some(row=>row['Лагерь']===camps.find(c=>c.id===setup.id)?.name), 'Excluded client appears as current active in Excel');
 assert.deepEqual(errors,[],'Runtime page errors');
 console.log('PASS: current active cohort vs historical contacts, report filter, six-sheet Excel parity and synthetic deactivation');
}finally{await browser.close()}
