'use strict';
/** Read-only derivation for CSM presentation, independent from contract/accounting status. */
function evaluateActivation(camp) {
 if (!camp || !camp.contractSigned) return {stage:'not_contracted',firstBookingConfirmed:false};
 if (!camp.trainingConfirmed) return {stage:'training_pending',firstBookingConfirmed:false};
 if (!camp.launchConfirmed) return {stage:'launch_pending',firstBookingConfirmed:false};
 const bookings=Number(camp.confirmedBookings||0);
 if (!Number.isFinite(bookings)||bookings<=0) return {stage:'live_no_booking',firstBookingConfirmed:false};
 return {stage:'first_booking',firstBookingConfirmed:true};
}
function currentReportingEligible(camp){return camp?.salesActive===true && camp?.csmReportingActive===true;}
function isHandoffAccepted(handoff){return handoff?.acceptedByCsm===true && !!handoff?.acceptedAt && !!handoff?.responsibleId;}
module.exports={evaluateActivation,currentReportingEligible,isHandoffAccepted};
