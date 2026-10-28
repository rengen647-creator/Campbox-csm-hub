/* CSM-only operational reporting status: do not modify Sales-owned active field. */
(function(){
'use strict';
const status=window.CsmReportingStatus;
if(!status || typeof window.csmScopeCamps!=='function')return;
const byId=id=>document.getElementById(id);
const getCamp=id=>camps.find(c=>c.id===id);
const label=c=>status.status(c);
const pill=(c)=>{
  const span=document.createElement('span');
  span.className='os-status-pill';
  span.dataset.status=status.eligible(c)?'active':'inactive';
  span.textContent=label(c);
  span.title='Учитывается в статистике функций и вопросов: '+(status.eligible(c)?'да':'нет')+
    (!c.active?' · архивирован в Sales':c.csm_reporting_active===false?' · отключён КСМ':'');
  return span;
};
// One eligibility scope for KPI, feature and discovery drilldowns, reports and exports.
const oldScope=window.csmScopeCamps;
window.csmScopeCamps=function(){return status.scope(oldScope());};
// Preserve every existing feature/profile/CSM filter and change only the active selection.
const oldFiltered=window.filteredCamps;
window.filteredCamps=function(){
  const el=byId('filterActivity');
  const choice=el?.value||'active';
  if(el)el.value='all';
  let rows;
  try{rows=oldFiltered();}finally{if(el)el.value=choice;}
  if(choice==='all')return rows;
  return rows.filter(c=>choice==='archived'?!status.eligible(c):status.eligible(c));
};
function decorateClientViews(){
  const root=byId('osClientRows');
  if(root)root.querySelectorAll('[data-camp-select]').forEach(button=>{
    const c=getCamp(button.dataset.campSelect), strong=button.querySelector('.os-client-pick-top strong');
    if(!c||!strong)return;
    button.querySelector('.os-reporting-marker')?.remove();
    const badge=pill(c);badge.classList.add('os-reporting-marker');strong.after(badge);
  });
  const inspector=byId('osClientInspector');
  if(inspector){
    const selection=root?.querySelector('[data-camp-select][aria-selected="true"]')?.dataset.campSelect;
    const c=getCamp(selection);
    const sub=inspector.querySelector('.os-inspector-sub');
    if(c&&sub){
      sub.textContent=sub.textContent.replace(/ · (Активный|Архив)$/,'');
      sub.querySelector('.os-status-pill')?.remove();
      sub.append(' · ',pill(c));
    }
  }
  // Collapsed comparison table and mobile cards display the same status.
  const campList=typeof window.filteredCamps==='function'?window.filteredCamps():[];
  byId('campTableBody')?.querySelectorAll('tr').forEach((tr,i)=>{
    const c=campList[i];if(!c)return;
    tr.querySelector('.os-reporting-marker')?.remove();
    const name=tr.querySelector('.camp-name');if(name){const b=pill(c);b.classList.add('os-reporting-marker');name.append(b);}
  });
  byId('campMobile')?.querySelectorAll('.camp-card').forEach((card,i)=>{
    const c=campList[i];if(!c)return;
    card.querySelector('.os-reporting-marker')?.remove();
    const name=card.querySelector('.camp-name');if(name){const b=pill(c);b.classList.add('os-reporting-marker');name.append(b);}
  });
}
const originalRenderCamps=window.renderCamps;
window.renderCamps=function(){const ret=originalRenderCamps();decorateClientViews();return ret;};
// OS4 client inspector is rendered independently when selecting a different client or tab.
const observer=new MutationObserver(mutations=>{
  if(!mutations.some(m=>m.target?.id==='osClientInspector'||m.target?.closest?.('#osClientInspector')))return;
  const el=byId('osClientInspector'),sub=el?.querySelector('.os-inspector-sub'),root=byId('osClientRows');
  if(!sub||sub.querySelector('.os-status-pill'))return;
  const selection=root?.querySelector('[data-camp-select][aria-selected="true"]')?.dataset.campSelect;
  const c=getCamp(selection);if(!c)return;
  sub.textContent=sub.textContent.replace(/ · (Активный|Архив)$/,'');
  sub.append(' · ',pill(c));
});
function startObserver(){const el=byId('osClientInspector');if(el)observer.observe(el,{childList:true,subtree:false});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver);else startObserver();
function injectCampStatus(id){
  const c=getCamp(id),modal=byId('modalRoot')?.querySelector('.camp-edit-modal');
  if(!c||!modal||modal.querySelector('.os-reporting-control'))return;
  const head=modal.querySelector('.modal-head');
  if(!head)return;
  const wrap=document.createElement('div');wrap.className='os-reporting-control';
  const badge=pill(c);wrap.append(badge);
  const available=Object.prototype.hasOwnProperty.call(c,'csm_reporting_active');
  const help=document.createElement('span');help.className='os-status-note';
  if(!c.active)help.textContent='Лагерь неактивен в Sales. Статус Sales управляется отдельно.';
  else if(!available)help.textContent='Переключение станет доступно после миграции статуса КСМ.';
  else help.textContent='Только активные лагеря входят в статистику функций и вопросов.';
  wrap.append(help);
  if(typeof isManager==='function'&&isManager()&&c.active&&available){
    const change=document.createElement('button');
    change.type='button';change.className='btn';change.textContent=status.eligible(c)?'Сделать неактивным':'Сделать активным';
    change.onclick=async()=>{
      if(modal.dataset.dirty==='true'){toast('Сначала сохрани изменения в карточке лагеря','bad');return;}
      const next=!Boolean(c.csm_reporting_active);
      if(!window.confirm(next?'Вернуть лагерь в активную статистику КСМ?':'Исключить лагерь из статистики функций и вопросов? Данные сохранятся.'))return;
      if(!sb||DEMO){
        if(!DEMO){toast('Нет подключения к базе','bad');return;}
        c.csm_reporting_active=next;renderDashboard();renderCamps();renderFeatureWorkspace();renderProfileDashboard();renderWorkReport();
        wrap.replaceChildren();injectCampStatusInPlace(id,wrap);toast('Демо: статус обновлён');return;
      }
      change.disabled=true;
      try{
        const {data,error}=await sb.from('csm_camps').update({csm_reporting_active:next}).eq('id',id).select('id,csm_reporting_active').single();
        if(error||!data){throw error||new Error('Изменение не подтверждено сервером');}
        await loadAll();
        // Keep the newly deactivated client visible rather than silently losing selection.
        const filter=byId('filterActivity');if(filter?.value==='active'&&!status.eligible(getCamp(id)))filter.value='all';
        fillFilters();renderDashboard();renderCamps();renderFeatureWorkspace();renderProfileDashboard();renderWorkReport();
        wrap.replaceChildren();injectCampStatusInPlace(id,wrap);toast('Статус КСМ сохранён');
      }catch(err){toast('Не удалось изменить статус: '+(err.message||err),'bad');change.disabled=false;}
    };
    wrap.append(change);
  }
  head.insertBefore(wrap,head.querySelector('.camp-modal-head-actions')||null);
}
function injectCampStatusInPlace(id,wrap){
  const c=getCamp(id);if(!c)return;
  const newBadge=pill(c);wrap.append(newBadge);
  const note=document.createElement('span');note.className='os-status-note';note.textContent='В статистике функций и вопросов: '+(status.eligible(c)?'учитывается':'не учитывается');wrap.append(note);
  if(isManager()&&c.active&&Object.prototype.hasOwnProperty.call(c,'csm_reporting_active')){
    const b=document.createElement('button');b.className='btn';b.type='button';b.textContent=status.eligible(c)?'Сделать неактивным':'Сделать активным';
    b.onclick=()=>{wrap.remove();injectCampStatus(id);};
    wrap.append(b);
  }
}
const originalOpenCamp=window.openCampModal;
window.openCampModal=function(id){const result=originalOpenCamp(id);if(id)injectCampStatus(id);return result;};
})();
