import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
const context = {window:{}};
vm.runInNewContext(read('src/state/csm-selectors.js'),context,{filename:'csm-selectors.js'});
const S=context.window.CsmSelectors;
const camps=[{id:'one'},{id:'two'}], features=[{id:'booking'},{id:'reports'}];
const states=[
  {camp_id:'one',feature_id:'booking',status:'Перешёл'},
  {camp_id:'one',feature_id:'reports',status:'Не требуется'},
  {camp_id:'two',feature_id:'booking',status:'Не планирует'}
];

test('Selectors handle missing camp×feature as Не начато',()=>{
  assert.equal(S.featureStatus('two','reports',states),'Не начато');
});
test('Adoption excludes only Не требуется and keeps Не планирует',()=>{
  const a=S.adoption(camps,features,states);
  assert.equal(a.total,3);assert.equal(a.done,1);assert.equal(a.percent,33);
  assert.equal(a.counts['Не планирует'],1);
  assert.equal(a.counts['Не начато'],1);
});
test('No applicable functions must not present 0% as a positive rate',()=>{
  const a=S.adoption([{id:'one'}],[{id:'reports'}],states);
  assert.equal(a.total,0);assert.equal(a.percent,null);
});
test('Readiness excludes Не требуется, and 0/0 is null',()=>{
  assert.equal(S.readiness([]).percent,null);
  assert.equal(S.readiness([{status:'Не требуется'}]).percent,null);
  assert.equal(S.readiness([{status:'Готово'},{status:'Не начато'},{status:'Не требуется'}]).percent,50);
});
test('Нет is a known answer, not Не выяснено',()=>{
  const r=S.profileStats(camps,[{id:'question'}],[{camp_id:'one',field_id:'question',value_text:'Нет'}]);
  assert.equal(r[0].no,1);assert.equal(r[0].known,1);assert.equal(r[0].unknown,1);
});
test('Steps bucket by real date; missing date is separate',()=>{
  const x=S.actionBuckets([{date:'2026-10-26'},{date:'2026-10-27'},{date:'2026-11-01'},{date:'2026-11-12'},{date:''}], '2026-10-27','2026-11-03');
  assert.equal(x.overdue.length,1);assert.equal(x.today.length,1);
  assert.equal(x.upcoming.length,1);assert.equal(x.later.length,1);
  assert.equal(x.unknown.length,1);
});
test('OS and original scripts are syntactically valid',()=>{
  new vm.Script(read('src/csm-os4.js'),{filename:'csm-os4.js'});
  const html=read('index.html');
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length>=1);
  for(const m of scripts)if(m[1].trim())new vm.Script(m[1],{filename:'index-inline.js'});
});
test('Legacy fixes, source of truth and OS layers load in sequence',()=>{
  const html=read('index.html');
  const indexes=['csm-fixes-20261021.js','src/state/csm-selectors.js','src/csm-os4.js'].map(p=>html.indexOf(p));
  assert.ok(indexes.every(x=>x>=0));assert.ok(indexes[0]<indexes[1]&&indexes[1]<indexes[2]);
  assert.ok(html.includes('src/styles/csm-os4.css'));
  assert.ok(!html.includes('<script id="csmSectionFocusScript">'));
});
test('Canonical backend handlers remain in source: save, Sales, RLS, export',()=>{
  const html=read('index.html');
  for(const marker of ['function saveCamp(', 'function saveContact(', 'function loadAll(', 'function renderSalesHandoffQueue(', 'function exportExcel('])
    assert.ok(html.includes(marker),marker);
  assert.ok(html.includes('csm_set_contract_number'));
  assert.ok(html.includes('csm_set_renewal_review_date'));
});
test('OS introduces all operational views without new tables or SQL calls',()=>{
  const os=read('src/csm-os4.js');
  for(const key of ['osDashboard','osCampQuick','osWork','osAdoption','osDiscovery','osLaunchCalendar','osReportDynamics','os-modal-tabset'])
    assert.ok(os.includes(key),key);
  assert.ok(os.includes('id="featureHeader"'),'Legacy renderCamps expects #featureHeader even when OS4 redraws the table header');
  assert.ok(!os.includes("sb.from("),'presentation layer must not write Supabase');
});
test('Responsive width, theme and focus styles are authored',()=>{
  const css=read('src/styles/csm-os4.css');
  for(const s of ['data-theme="dark"','max-width:719px','max-width:900px',':focus-visible','os-360','os-metrics'])
    assert.ok(css.includes(s),s);
});
