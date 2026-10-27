(function selectorsSource(){
  'use strict';
  const allStages=['Не начато','Запланировано','Обучение','В работе','Перешёл','Не планирует','Не требуется'];
  function featureStatus(campId,featureId,states){
    return states.find(s=>s.camp_id===campId && s.feature_id===featureId)?.status || 'Не начато';
  }
  function adoption(camps,features,states){
    const applicable=[];const counts=Object.fromEntries(allStages.map(s=>[s,0]));
    for(const camp of camps)for(const feature of features){
      const st=featureStatus(camp.id,feature.id,states);counts[st]=(counts[st]||0)+1;
      if(st!=='Не требуется')applicable.push(st);
    }
    const done=applicable.filter(s=>s==='Перешёл').length;
    return {done,total:applicable.length,percent:applicable.length?Math.round(100*done/applicable.length):null,counts};
  }
  function readiness(checkpoints){
    const applicable=checkpoints.filter(cp=>cp.status!=='Не требуется');
    const done=applicable.filter(cp=>cp.status==='Готово').length;
    return {done,total:applicable.length,percent:applicable.length?Math.round(100*done/applicable.length):null};
  }
  function profileStats(camps,fields,values){
    const rows=[];
    for(const field of fields) {
      const answers=camps.map(c=>values.find(v=>v.camp_id===c.id&&v.field_id===field.id)||{});
      const isKnown=v=>v.value_text!=null&&v.value_text!==''&&v.value_text!=='Не выяснено';
      rows.push({field_id:field.id,yes:answers.filter(v=>v.value_text==='Да').length,no:answers.filter(v=>v.value_text==='Нет').length,
        unknown:answers.filter(v=>!isKnown(v)).length,known:answers.filter(isKnown).length,details:answers.filter(v=>!!v.details).length});
    }
    return rows;
  }
  function actionBuckets(rows,today,nextWeek){
    return {
      overdue:rows.filter(x=>x.date&&x.date<today),
      today:rows.filter(x=>x.date===today),
      upcoming:rows.filter(x=>x.date>today && x.date<=nextWeek),
      later:rows.filter(x=>x.date>nextWeek),
      unknown:rows.filter(x=>!x.date)
    };
  }
  const API=Object.freeze({featureStatus,adoption,readiness,profileStats,actionBuckets,allStages});
  if(typeof window!=='undefined')window.CsmSelectors=API;
})();