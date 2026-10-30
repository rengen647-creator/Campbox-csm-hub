'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {evaluateActivation,currentReportingEligible,isHandoffAccepted}=require('./activation');
test('signed alone never implies activation',()=>assert.equal(evaluateActivation({contractSigned:true}).stage,'training_pending'));
test('launch alone never implies booking',()=>assert.equal(evaluateActivation({contractSigned:true,trainingConfirmed:true,launchConfirmed:true}).stage,'live_no_booking'));
test('real bookings separate from cash',()=>assert.equal(evaluateActivation({contractSigned:true,trainingConfirmed:true,launchConfirmed:true,confirmedBookings:1}).stage,'first_booking'));
test('both active flags required for current KPIs',()=>{assert.equal(currentReportingEligible({salesActive:true,csmReportingActive:false}),false);assert.equal(currentReportingEligible({salesActive:true,csmReportingActive:true}),true);});
test('CSM acceptance requires owner and timestamp',()=>assert.equal(isHandoffAccepted({acceptedByCsm:true}),false));
