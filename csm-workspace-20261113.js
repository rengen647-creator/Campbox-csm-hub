
/* CSM workspace: independent planned contacts with a month calendar and actionable triggers. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const safe=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=d=>{const x=new Date(d);return [x.getFullYear(),String(x.getMonth()+1).padStart(2,'0'),String(x.getDate()).padStart(2,'0')].join('-')};
const now=()=>iso(new Date());
const plus=(day,n)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return iso(d)};
const titleFor={agreement:'Договорённость',stale:'Нет контакта 14+',profile:'Что выяснить',blocker:'Блокер фичи',renewal:'Продление',launch:'Запуск смены',manual:'Ручная задача'};
const state={month:now().slice(0,7),day:now(),owner:'',showDone:false,rows:[],error:'',editing:''};
const camp=id=>camps.find(c=>c.id===id);
const own=id=>profiles.find(p=>p.id===id);
const active=()=>camps.filter(c=>c.active&&(isManager()||c.responsible_id===currentProfile.id));
const permitted=id=>active().some(c=>c.id===id);
function mount(){
 if($('viewPlanner'))return;
 const view=document.createElement('main');view.id='viewPlanner';view.className='hidden';
 view.innerHTML='<section class="os-panel planner-head"><div class="os-panel-head"><div><h3>Календарь контактов</h3><p>Кому, когда и почему нужно связаться с клиентом. Запланированное действие — не запись о выполненной работе.</p></div><button type="button" class="btn primary" data-p-action="new">+ Запланировать</button></div><div id="plannerKpis" class="planner-kpis"></div><div class="planner-toolbar"><div class="planner-monthnav"><button class="btn" data-p-action="prev">‹</button><strong id="plannerMonthName"></strong><button class="btn" data-p-action="next">›</button><button class="btn" data-p-action="today">Сегодня</button></div><label class="planner-owner">Ответственный<select id="plannerOwner"></select></label><label class="planner-done"><input id="plannerShowDone" type="checkbox">Показать выполненные</label></div><div id="plannerStatus" role="status"></div><div class="planner-layout"><div><div id="plannerCalendar" class="planner-calendar"></div></div><aside class="planner-aside"><h3 id="plannerAgendaTitle">Контакты на день</h3><div id="plannerAgenda"></div><h3>Триггеры для работы</h3><p>Сигнал не создаёт встречу, пока КСМ не назначит дату.</p><div id="plannerTriggers"></div></aside></div></section>';
 $('mainApp').append(view);
 const side=document.querySelector('.sidebar .side-nav');
 if(side){const b=document.createElement('button');b.type='button';b.dataset.view='planner';b.innerHTML='<span class="side-ico">▦</span>Календарь КСМ';b.onclick=()=>setView('planner');side.insertBefore(b,side.children[2]||null)}
 const mobile=$('osMobileSheet');
 if(mobile){const b=document.createElement('button');b.type='button';b.dataset.osMobileDest='planner';b.textContent='Календарь КСМ';mobile.prepend(b)}
 view.addEventListener('click',event=>{
  const b=event.target.closest('[data-p-action]');if(!b)return;
  const op=b.dataset.pAction,id=b.dataset.id||'',cid=b.dataset.camp||'';
  if(op==='prev'||op==='next'){const d=new Date(state.month+'-15T12:00:00');d.setMonth(d.getMonth()+(op==='next'?1:-1));state.month=iso(d).slice(0,7);state.day=state.month+'-01';renderPlanner()}
  if(op==='today'){state.day=now();state.month=state.day.slice(0,7);renderPlanner()}
  if(op==='day'){state.day=b.dataset.day;renderPlanner()}
  if(op==='new')openPlannerTask();
  if(op==='edit')openPlannerTask(id);
  if(op==='done')updatePlannerStatus(id,'done');
  if(op==='camp')openCampModal(cid);
  if(op==='signal')openPlannerTask('',cid,b.dataset.trigger);
  if(op==='legacy'){const r=contacts.find(x=>x.id===id);if(r)openPlannerTask('',r.camp_id,'agreement',r.next_step,r.next_step_date)}
 });
 $('plannerOwner').onchange=e=>{state.owner=isManager()?e.target.value:currentProfile.id;renderPlanner()};
 $('plannerShowDone').onchange=e=>{state.showDone=e.target.checked;renderPlanner()};
}
window.loadCsmTasks=async function(){
 if(DEMO){if(!state.rows.length&&camps.length){state.rows=[{id:'demo-1',camp_id:camps[0].id,assigned_to:camps[0].responsible_id||currentProfile.id,created_by:currentProfile.id,title:'Согласовать следующий контакт',due_date:plus(now(),1),due_time:'11:00',trigger_type:'agreement',status:'open',note:'Демо-событие'}]}return}
 const {data,error}=await sb.from('csm_tasks').select('*').order('due_date');
 state.error=error?'Не удалось загрузить календарь: '+error.message:'';
 if(!error)state.rows=data||[];
};
function legacy(){
 const latest=new Map();
 [...contacts].sort((a,b)=>String(b.contact_date).localeCompare(String(a.contact_date))||String(b.created_at||'').localeCompare(String(a.created_at||''))).forEach(r=>{if(!latest.has(r.camp_id))latest.set(r.camp_id,r)});
 return [...latest.values()].filter(r=>r.next_step&&r.next_step_date&&permitted(r.camp_id)&&(!state.owner||camp(r.camp_id)?.responsible_id===state.owner))
 .filter(r=>!state.rows.some(t=>t.camp_id===r.camp_id&&t.title===r.next_step&&t.due_date===r.next_step_date))
 .map(r=>({id:r.id,camp_id:r.camp_id,assigned_to:camp(r.camp_id)?.responsible_id,due_date:r.next_step_date,title:r.next_step,trigger_type:'agreement',status:'open',legacy:true,note:'Из истории предыдущих контактов'}));
}
function events(){return state.rows.filter(t=>permitted(t.camp_id)&&(!state.owner||t.assigned_to===state.owner)&&(state.showDone||t.status==='open')).concat(state.showDone?[]:legacy()).sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date))||String(a.due_time||'').localeCompare(String(b.due_time||'')))}
function triggers(){
 const list=[];
 active().filter(c=>!state.owner||c.responsible_id===state.owner).forEach(c=>{
  const history=contacts.filter(r=>r.camp_id===c.id).sort((a,b)=>String(b.contact_date).localeCompare(String(a.contact_date)));
  if(!history.length||history[0].contact_date<=plus(now(),-14))list.push({camp:c,type:'stale',text:history.length?'Последний контакт '+history[0].contact_date:'Контактов не было'});
  const unknown=unknownProfileForCamp(c.id);if(unknown.length)list.push({camp:c,type:'profile',text:unknown.length+' незаполненных пунктов'});
  const blockers=campFeatures.filter(f=>f.camp_id===c.id&&f.status!=='Перешёл'&&f.status!=='Не требуется'&&String(f.reason||'').trim());if(blockers.length)list.push({camp:c,type:'blocker',text:blockers.length+' блокеров внедрения'});
  if(c.renewal_review_date&&c.renewal_review_date<=plus(now(),30))list.push({camp:c,type:'renewal',text:'Дата проверки '+c.renewal_review_date});
  const cp=launches.filter(l=>l.camp_id===c.id).flatMap(l=>launchCheckpoints.filter(p=>p.launch_id===l.id&&p.due_date&&p.due_date<now()&&!['Готово','Не требуется'].includes(p.status)));
  if(cp.length)list.push({camp:c,type:'launch',text:cp.length+' просроченных контрольных точек'});
 });
 return list.slice(0,30);
}
function eventHtml(e){
 const overdue=e.status==='open'&&e.due_date<now();
 return '<article class="planner-event'+(overdue?' overdue':'')+(e.status==='done'?' completed':'')+'"><div class="planner-event-title"><strong>'+safe(e.title)+'</strong><span class="planner-trigger">'+safe(titleFor[e.trigger_type]||'Контакт')+'</span></div><div class="planner-event-meta">'+safe(e.due_date)+(e.due_time?' · '+safe(String(e.due_time).slice(0,5)):'')+' · '+safe(camp(e.camp_id)?.name||'—')+' · '+safe(own(e.assigned_to)?.full_name||'—')+'</div>'+(e.note?'<div class="planner-event-note">'+safe(e.note)+'</div>':'')+'<div class="planner-event-actions">'+(e.legacy?'<button class="btn" data-p-action="legacy" data-id="'+safe(e.id)+'">Перенести в задачи</button>':'<button class="btn" data-p-action="edit" data-id="'+safe(e.id)+'">Изменить</button>'+(e.status==='open'?'<button class="btn" data-p-action="done" data-id="'+safe(e.id)+'">✓ Выполнено</button>':''))+'<button class="btn" data-p-action="camp" data-camp="'+safe(e.camp_id)+'">Карточка</button></div></article>';
}
window.renderPlanner=function(){
 mount();if(!currentProfile)return;
 if(!isManager())state.owner=currentProfile.id;
 const sel=$('plannerOwner'),old=state.owner;
 sel.innerHTML=(isManager()?'<option value="">Вся команда</option>':'')+profiles.filter(p=>p.active&&!p.archived&&(isManager()||p.id===currentProfile.id)).map(p=>'<option value="'+safe(p.id)+'">'+safe(p.full_name||p.email)+'</option>').join('');
 sel.value=old;sel.disabled=!isManager();$('plannerShowDone').checked=state.showDone;
 const es=events(),open=es.filter(e=>e.status==='open');
 const blocks=[['Просрочено',open.filter(e=>e.due_date<now()).length,'overdue'],['Сегодня',open.filter(e=>e.due_date===now()).length,'today'],['7 дней',open.filter(e=>e.due_date>now()&&e.due_date<=plus(now(),7)).length,'soon'],['В работе',open.length,'all']];
 $('plannerKpis').innerHTML=blocks.map(x=>'<div class="planner-kpi '+x[2]+'"><span>'+x[0]+'</span><strong>'+x[1]+'</strong></div>').join('');
 $('plannerMonthName').textContent=new Intl.DateTimeFormat('ru-RU',{year:'numeric',month:'long'}).format(new Date(state.month+'-15T12:00:00'));
 $('plannerStatus').textContent=state.error;
 const first=new Date(state.month+'-01T12:00:00'),count=new Date(first.getFullYear(),first.getMonth()+1,0).getDate(),offset=(first.getDay()+6)%7;
 const grid=Array(offset).fill('<div class="planner-cell outside" aria-hidden="true"></div>');
 for(let i=1;i<=count;i++){const day=state.month+'-'+String(i).padStart(2,'0'),rows=es.filter(e=>e.due_date===day);
  grid.push('<button class="planner-cell'+(day===state.day?' selected':'')+(day===now()?' current':'')+'" data-p-action="day" data-day="'+day+'" aria-label="'+day+', событий: '+rows.length+'"><strong>'+i+'</strong><span class="planner-cell-count">'+(rows.length?rows.length+' событий':'')+'</span>'+rows.slice(0,2).map(t=>'<span class="planner-cell-event'+(t.due_date<now()&&t.status==='open'?' late':'')+'">'+safe(t.title)+'</span>').join('')+(rows.length>2?'<span class="planner-cell-more">Ещё '+(rows.length-2)+'</span>':'')+'</button>');
 }
 $('plannerCalendar').innerHTML='<div class="planner-weekdays">'+['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>'<span>'+d+'</span>').join('')+'</div><div class="planner-days">'+grid.join('')+'</div>';
 $('plannerAgendaTitle').textContent='На '+new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long'}).format(new Date(state.day+'T12:00:00'));
 const dayEvents=es.filter(e=>e.due_date===state.day);
 $('plannerAgenda').innerHTML=dayEvents.map(eventHtml).join('')||'<div class="planner-empty">На эту дату задач нет.<button class="btn" data-p-action="new">+ Запланировать</button></div>';
 $('plannerTriggers').innerHTML=triggers().map(t=>'<div class="planner-signal"><div><b>'+safe(t.camp.name)+'</b><span>'+safe(titleFor[t.type])+' · '+safe(t.text)+'</span></div><button class="btn" data-p-action="signal" data-camp="'+safe(t.camp.id)+'" data-trigger="'+safe(t.type)+'">В план</button></div>').join('')||'<div class="planner-empty">Сигналов нет</div>';
};
function openPlannerTask(id='',campId='',kind='agreement',presetTitle='',presetDate=''){
 const t=state.rows.find(x=>x.id===id),cs=active();if(t&&!permitted(t.camp_id))return toast('Нет доступа к задаче','bad');
 const selected=t?.camp_id||campId||cs[0]?.id||'',owner=t?.assigned_to||camp(selected)?.responsible_id||currentProfile.id;
 state.editing=t?.id||'';
 const campsHtml=cs.map(c=>'<option value="'+safe(c.id)+'"'+(c.id===selected?' selected':'')+'>'+safe(c.name)+'</option>').join('');
 const staff=profiles.filter(p=>p.active&&!p.archived&&(isManager()||p.id===currentProfile.id));
 const ownersHtml=staff.map(p=>'<option value="'+safe(p.id)+'"'+(p.id===owner?' selected':'')+'>'+safe(p.full_name||p.email)+'</option>').join('');
 const kinds=Object.keys(titleFor).map(k=>'<option value="'+k+'"'+(k===(t?.trigger_type||kind)?' selected':'')+'>'+safe(titleFor[k])+'</option>').join('');
 modal('<div class="modal" style="max-width:650px"><div class="modal-head"><h3>'+(t?'Изменить контакт':'Запланировать контакт')+'</h3><button class="icon-btn" onclick="closeModal()">✕</button></div><div class="modal-body"><div class="form-grid"><div class="field wide"><label>Лагерь</label><select id="ptCamp">'+campsHtml+'</select></div><div class="field wide"><label>Что нужно сделать</label><input maxlength="220" id="ptTitle" value="'+safe(t?.title||presetTitle)+'" placeholder="Например: уточнить дату запуска смены"></div><div class="field"><label>Дата</label><input id="ptDate" type="date" value="'+safe(t?.due_date||presetDate||state.day)+'"></div><div class="field"><label>Время (необязательно)</label><input id="ptTime" type="time" value="'+safe(String(t?.due_time||'').slice(0,5))+'"></div><div class="field"><label>Триггер</label><select id="ptTrigger">'+kinds+'</select></div><div class="field"><label>Ответственный</label><select id="ptOwner" '+(!isManager()?'disabled':'')+'>'+ownersHtml+'</select></div><div class="field wide"><label>Пометки</label><textarea id="ptNote" maxlength="2000" placeholder="Договорённости и контекст">'+safe(t?.note||'')+'</textarea></div></div></div><div class="modal-actions"><button class="btn" onclick="closeModal()">Отмена</button>'+(t&&t.status==='open'?'<button class="btn" onclick="plannerChangeStatus(\'cancelled\')">Отменить задачу</button>':'')+'<button id="ptSave" class="btn primary" onclick="plannerSaveTask()">Сохранить событие</button></div></div>');
}
window.plannerSaveTask=async function(){
 const button=$('ptSave');if(!button||button.disabled)return;
 const camp_id=$('ptCamp').value,title=$('ptTitle').value.trim(),due_date=$('ptDate').value,assigned_to=$('ptOwner').value;
 if(!permitted(camp_id)||!title||!due_date||!assigned_to)return toast('Укажи лагерь, действие, дату и ответственного','bad');
 if(!isManager()&&assigned_to!==currentProfile.id)return toast('Можно назначать задачи только себе','bad');
 const payload={camp_id,assigned_to,title,due_date,due_time:$('ptTime').value||null,trigger_type:$('ptTrigger').value,note:$('ptNote').value.trim()||null,updated_at:new Date().toISOString()};
 button.disabled=true;button.textContent='Сохраняем…';
 try{
  if(DEMO){if(state.editing)Object.assign(state.rows.find(x=>x.id===state.editing),payload);else state.rows.push({...payload,id:'demo-'+Date.now(),created_by:currentProfile.id,status:'open'})}
  else {const query=state.editing?sb.from('csm_tasks').update(payload).eq('id',state.editing):sb.from('csm_tasks').insert({...payload,created_by:currentProfile.id});const {error}=await query;if(error)throw error;await loadCsmTasks()}
  closeModal();state.day=due_date;state.month=due_date.slice(0,7);renderPlanner();toast('Событие сохранено');
 }catch(e){toast('Не удалось сохранить: '+(e.message||e),'bad');button.disabled=false;button.textContent='Сохранить событие'}
};
async function updatePlannerStatus(id,status){
 const t=state.rows.find(x=>x.id===id);if(!t)return;
 try{if(DEMO)t.status=status;else{const {error}=await sb.from('csm_tasks').update({status,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;await loadCsmTasks()}closeModal();renderPlanner();toast(status==='done'?'Задача выполнена':'Задача отменена')}catch(e){toast('Ошибка обновления: '+(e.message||e),'bad')}
}
window.plannerChangeStatus=status=>updatePlannerStatus(state.editing,status);
const oldLoad=window.loadAll;window.loadAll=async function(){const res=await oldLoad();await loadCsmTasks();return res};
const oldView=window.setView;window.setView=function(v){const res=oldView(v);mount();$('viewPlanner').classList.toggle('hidden',v!=='planner');if(v==='planner'){$('viewTitle').textContent='Календарь КСМ';renderPlanner()}return res};
const oldApp=window.showApp;window.showApp=function(){const x=oldApp();mount();if(DEMO)loadCsmTasks();return x};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
