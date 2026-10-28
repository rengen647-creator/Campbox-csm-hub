/* Pure reporting eligibility: Sales activity AND independent CSM participation. */
(function(root){
  'use strict';
  function eligible(c){return !!c && c.active===true && c.csm_reporting_active!==false;}
  function status(c){return eligible(c)?'Активный':'Неактивный';}
  function source(c){return !c?.active?'Sales':c.csm_reporting_active===false?'КСМ':'КСМ';}
  function scope(items){return (items||[]).filter(eligible);}
  const api=Object.freeze({eligible,status,source,scope});
  root.CsmReportingStatus=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
