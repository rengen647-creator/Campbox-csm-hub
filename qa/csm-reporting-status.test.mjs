import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const context={window:{}};
vm.runInNewContext(load('src/state/csm-reporting-status.js'),context);
const R=context.window.CsmReportingStatus;
const clients=[
  {id:'a',active:true,csm_reporting_active:true},
  {id:'b',active:true,csm_reporting_active:false},
  {id:'c',active:false,csm_reporting_active:true},
  {id:'d',active:true} // Pre-migration compatibility.
];
test('Only Sales-active and CSM-reporting-active camps participate',()=>{
  assert.deepEqual(Array.from(R.scope(clients),c=>c.id),['a','d']);
  assert.equal(R.status(clients[1]),'Неактивный');
  assert.equal(R.source(clients[1]),'КСМ');
  assert.equal(R.source(clients[2]),'Sales');
});
test('Inactivation preserves all source data and counts only eligible camps',()=>{
  const before=JSON.stringify(clients);
  const features=[{id:'one'}],states=[{camp_id:'a',feature_id:'one',status:'Перешёл'},{camp_id:'b',feature_id:'one',status:'Не начато'},{camp_id:'c',feature_id:'one',status:'Не планирует'}];
  const values=[{camp_id:'a',field_id:'q',value_text:'Да'},{camp_id:'b',field_id:'q',value_text:'Не выяснено'},{camp_id:'c',field_id:'q',value_text:'Нет'}];
  const S={window:{}};vm.runInNewContext(load('src/state/csm-selectors.js'),S);
  const scoped=R.scope(clients);
  const a=S.window.CsmSelectors.adoption(scoped,features,states);
  const q=S.window.CsmSelectors.profileStats(scoped,[{id:'q'}],values)[0];
  assert.equal(a.total,2);assert.equal(a.done,1);assert.equal(a.percent,50);
  assert.equal(q.known,1);assert.equal(q.unknown,1);assert.equal(q.no,0);
  assert.equal(JSON.stringify(clients),before);
});
test('Migration does not modify Sales active or signed contract fields',()=>{
  const sql=load('migrations/20261028_csm_reporting_active.sql');
  assert.match(sql,/add column if not exists csm_reporting_active/);
  assert.doesNotMatch(sql,/(?:update|delete)\s+public\.(?:salary_clients|salary_contracts|csm_camps)/i);
  assert.doesNotMatch(sql,/alter\s+table\s+public\.salary_/i);
});
test('Status UI is linked, manager-controlled and guards unsaved edits',()=>{
  const html=load('index.html'),ui=load('src/csm-reporting-ui.js');
  assert.ok(html.includes('src/csm-reporting-ui.js'));
  assert.ok(html.includes('src/state/csm-reporting-status.js'));
  assert.ok(html.includes('src/styles/csm-reporting-status.css'));
  assert.match(ui,/typeof isManager==='function'&&isManager\(\)/);
  assert.match(ui,/modal\.dataset\.dirty==='true'/);
  assert.match(ui,/\.update\(\{csm_reporting_active:next\}\)/);
  assert.match(ui,/\.select\('id,csm_reporting_active'\)\.single\(\)/);
  assert.ok(ui.includes('const oldScope=window.csmScopeCamps'));
  assert.ok(ui.includes("const oldFiltered=window.filteredCamps"));
  new vm.Script(ui,{filename:'src/csm-reporting-ui.js'});
});
