'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assessIncomingHandoff}=require('./receive-handoff');
const {applyRevision}=require('./event-reducer');
const {isHandoffAccepted,evaluateActivation}=require('./activation');
const first={source:'sales_daily_reflection',salesUserId:'sales-1',campId:'camp-1',contractKey:'contract-1',eventKey:'event-1',revision:1,trainingDate:'2026-11-05',trainingAttendee:'Admin',confirmedByCustomer:true};
test('valid event is evaluated without claiming CSM acceptance',()=>{
 assert.equal(assessIncomingHandoff(first).action,'accept');
 assert.equal(isHandoffAccepted(first),false);
 assert.equal(evaluateActivation({contractSigned:true,trainingConfirmed:false}).stage,'training_pending');
});
test('first event applied, replay skipped, updated event applied',()=>{
 const a=applyRevision(null,first);assert.equal(a.status,'apply');
 assert.equal(applyRevision(a.record,first).status,'skip');
 const later={...first,eventKey:'event-2',revision:2};assert.equal(applyRevision(a.record,later).status,'apply');
});
test('unconfirmed training reviewed even when signed',()=>assert.equal(assessIncomingHandoff({...first,confirmedByCustomer:false}).action,'review'));
test('changed camp cannot replace existing record',()=>assert.equal(applyRevision(first,{...first,campId:'other',revision:2,eventKey:'event-2'}).status,'conflict'));
