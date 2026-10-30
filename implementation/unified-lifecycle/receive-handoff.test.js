'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assessIncomingHandoff}=require('./receive-handoff');
const e={source:'sales_daily_reflection',salesUserId:'manager',campId:'camp',contractKey:'deal',revision:3,trainingDate:'2026-11-07',trainingAttendee:'Administrator',confirmedByCustomer:true};
test('confirmed transfer may be accepted',()=>assert.equal(assessIncomingHandoff(e).action,'accept'));
test('unconfirmed training requires review',()=>assert.equal(assessIncomingHandoff({...e,confirmedByCustomer:false}).action,'review'));
test('replayed revision skips',()=>assert.equal(assessIncomingHandoff(e,{...e}).action,'skip'));
test('changed camp requires review by source',()=>assert.equal(assessIncomingHandoff(e,{...e,campId:'another',revision:2}).reason,'camp_conflict'));
test('unknown source rejected',()=>assert.equal(assessIncomingHandoff({...e,source:'unknown'}).action,'reject'));
