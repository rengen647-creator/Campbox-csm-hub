'use strict';
/** CSM receiver validation. Strictly pure: a trusted service performs RLS checks and storage. */
function assessIncomingHandoff(event,existing){
 if(!event||event.source!=='sales_daily_reflection')return {action:'reject',reason:'unknown_source'};
 if(!event.salesUserId||!event.campId||!event.contractKey||!Number.isSafeInteger(event.revision)||event.revision<1)return {action:'reject',reason:'identity_missing'};
 if(existing && existing.campId!==event.campId)return {action:'reject',reason:'camp_conflict'};
 if(existing && (existing.salesUserId!==event.salesUserId||existing.contractKey!==event.contractKey))return {action:'reject',reason:'source_conflict'};
 if(existing && existing.revision>=event.revision)return {action:'skip',reason:'already_processed'};
 if(!event.trainingDate || !event.trainingAttendee || event.confirmedByCustomer!==true)return {action:'review',reason:'training_not_confirmed'};
 return {action:'accept',reason:'validated'};
}
module.exports={assessIncomingHandoff};
