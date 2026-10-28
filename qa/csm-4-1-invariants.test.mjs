import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const status=read('src/state/csm-reporting-status.js'),app=read('src/csm-os4.js'),legacy=read('index.html'),ui=read('src/csm-reporting-ui.js');
test('Legacy discovery and funnel use the same role-scoped cohort as modern views',()=>{
 assert.match(legacy,/function renderProfileDashboard\(\)[\s\S]*?cs=csmScopeCamps\(\);/);
 assert.match(legacy,/function openProfileUnknown\(fieldId\)[\s\S]*?list=csmScopeCamps\(\)\.filter/);
 assert.match(legacy,/function renderFunnel\(\)[\s\S]*?const states=csmScopeCamps\(\)\.map/);
 assert.match(legacy,/function renderTrendChart\(\)[\s\S]*?ids=csmScopeCamps\(\)\.map/);
 assert.match(legacy,/function renderTrainingChart\(\)[\s\S]*?csmScopeCamps\(\)\.some/);
});
test('Historical work and period training survive current deactivation',()=>{
 assert.match(legacy,/function reportHistoryCamps\(\)/);
 assert.match(legacy,/const acts=contacts\.filter\(r=>historicalIds\.has\(r\.camp_id\)/);
 assert.match(app,/historyCamps=reportHistoryCamps\(\),historyIds=new Set/);
 assert.match(app,/const acts=contacts\.filter\(r=>historyIds\.has\(r\.camp_id\)/);
 assert.match(app,/const cs=reportHistoryCamps\(\),ids=new Set/);
 assert.match(app,/id="reportHistoryScope"/);
 assert.match(app,/ctx\.historyCamps\.length/);
});
test('Independent CSM reporting flag cannot mutate Sales status',()=>{
 assert.match(status,/c\.active===true&&c\.csm_reporting_active!==false/);
 assert.doesNotMatch(ui,/update\(\{active:/);
 assert.match(ui,/data\.csm_reporting_active!==next/);
 assert.match(ui,/modal\.dataset\.dirty==='true'/);
});
test('Current denominators include absent feature links and exclude not required',()=>{
 assert.match(app,/const cs=activeCamps\(\),fs=activeFeatures\(\), denom=cs\.flatMap/);
 assert.match(app,/filter\(s=>s!=='Не требуется'\)/);
 assert.match(legacy,/function renderFunnel\(\)[\s\S]*?CsmSelectors\.featureStatus/);
});
