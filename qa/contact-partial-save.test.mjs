import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const from=html.indexOf('async function saveContact(){');
const to=html.indexOf('\nfunction openFeaturesModal(){',from);
assert.ok(from>=0 && to>from, 'Cannot locate source mutation function');
const source=html.slice(from,to);

function harness({insertError=null,insertThrow=false,activationErrors=[],demo=false,result='Перешёл'}={}){
  const records={inserts:0,upserts:0,refreshes:0,closes:0,toasts:[],renders:0};
  const ids={ctDate:'2026-10-12',ctCamp:'c1',ctFeature:'f1',ctType:'Обучение',ctResult:result,
    ctNext:'Вернуться к лагерю',ctNextDate:'2026-10-20',ctComment:'Обучили'};
  const fields=Object.fromEntries(Object.entries(ids).map(([k,v])=>[k,{value:v,disabled:false}]));
  let warning=null;
  const form={prepend(v){warning=v}};
  const button={dataset:{},textContent:'Сохранить работу',disabled:false};
  const dialog={
    dataset:{},
    querySelector(sel){
      if(sel==='[onclick^="saveContact"]')return button;
      if(sel==='.modal-body')return form;
      if(sel==='#csmPartialSaveWarning')return warning;
      return null;
    },
    querySelectorAll(){return Object.values(fields);}
  };
  const root={querySelector(sel){return sel==='.modal'?dialog:null;}};
  const document={createElement(){return {setAttribute(){},style:{},textContent:''}}};
  const sb={from(name){
    if(name==='csm_contacts')return {async insert(){
      records.inserts++;
      if(insertThrow)throw Error('Network lost');
      return {error:insertError?{message:insertError}:null};
    }};
    if(name==='csm_camp_features')return {async upsert(){
      records.upserts++;
      return {error:activationErrors[records.upserts-1]||null};
    }};
    throw Error('Unexpected table: '+name);
  }};
  const sandbox={
    document,Date,DEMO:demo,currentProfile:{id:'u1'},contacts:[],sb,
    $:id=>id==='modalRoot'?root:fields[id],
    loadAll:async()=>{records.refreshes++},
    closeModal:()=>{records.closes++},
    renderCamps:()=>{records.renders++},renderContacts:()=>{records.renders++},renderDashboard:()=>{records.renders++},
    toast:(msg,status)=>records.toasts.push({msg,status})
  };
  vm.runInNewContext(source+';globalThis.runSaveContact=saveContact;',sandbox,{filename:'index-saveContact.js'});
  return {run:()=>sandbox.runSaveContact(),records,button,dialog,fields};
}

test('partial activation failure is reported, preserves recorded contact and retries only upsert',async()=>{
  const h=harness({activationErrors:[{message:'RLS denied'},null]});
  await h.run();
  assert.equal(h.records.inserts,1);
  assert.equal(h.records.upserts,1);
  assert.equal(h.records.closes,0);
  assert.equal(h.dialog.dataset.contactPersisted,'true');
  assert.match(h.button.textContent,/Повторить активацию/);
  assert.ok(h.records.toasts.some(x=>x.status==='bad'&&x.msg.includes('НЕ переведена')));
  await h.run();
  assert.equal(h.records.inserts,1,'Repeat click must not create second contact');
  assert.equal(h.records.upserts,2);
  assert.equal(h.records.closes,1);
  assert.ok(h.records.toasts.at(-1).msg.includes('функция переведена'));
});
test('validation rejection before insert leaves form retryable',async()=>{
  const h=harness({insertError:'Required field missing'});
  await h.run();
  assert.equal(h.records.inserts,1);
  assert.equal(h.records.upserts,0);
  assert.equal(h.button.disabled,false);
  assert.notEqual(h.dialog.dataset.contactPersisted,'true');
  assert.match(h.records.toasts[0].msg,/Контакт не сохранён/);
});
test('ambiguous transport failure blocks blind duplicate contact retry',async()=>{
  const h=harness({insertThrow:true});
  await h.run();
  assert.equal(h.records.inserts,1);
  assert.equal(h.records.upserts,0);
  assert.equal(h.button.disabled,true);
  assert.equal(h.dialog.dataset.contactUncertain,'true');
  assert.match(h.records.toasts[0].msg,/Проверьте журнал/);
});
test('non-transition result writes contact only',async()=>{
  const h=harness({result:'Обсудили'});
  await h.run();
  assert.equal(h.records.inserts,1);
  assert.equal(h.records.upserts,0);
  assert.equal(h.records.closes,1);
});
