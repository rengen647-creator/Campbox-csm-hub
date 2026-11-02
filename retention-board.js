/* Shared retention Kanban for Sales and CSM; identical source in both repositories. */
(function(){
'use strict';
const source=location.pathname.toLowerCase().includes('csm')?'csm':(document.title.toLowerCase().includes('csm')?'csm':'sales');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses=[['new','Новый кейс'],['in_progress','В работе'],['waiting_customer','Ждём клиента'],['returned','Клиент возвращён'],['lost','Клиент потерян']];
const reasons=[['explicit_exit','Клиент заявил об уходе'],['unreachable','Не отвечает после контактов'],['no_sales','Подписан, нет активных продаж'],['no_launch','Не вышел в живой режим'],['suspended','Приостановка'],['terminated','Расторгнут'],['other','Другая причина']];
let all=[],camps=[],active=false;
function api(){return typeof sb!=='undefined'&&sb?sb:null}
function user(){return typeof currentUser!=='undefined'&&currentUser?currentUser:null}
function host(){return document.getElementById('mainApp')}
function notify(s){window.alert(s)}
function mount(){
 const h=host();if(!h||document.getElementById('retentionLauncher'))return;
 const btn=document.createElement('button');btn.id='retentionLauncher';btn.type='button';btn.textContent='Удержание';btn.style.cssText='position:fixed;right:18px;bottom:82px;z-index:1500;background:#236a4d;color:#fff;padding:11px 17px;border-radius:14px;border:0;font:600 14px system-ui;box-shadow:0 8px 20px #0003;cursor:pointer';
 btn.onclick=()=>{active=!active;const p=document.getElementById('retentionPanel');p.hidden=!active;if(active)load()};
 document.body.appendChild(btn);
 const panel=document.createElement('section');panel.id='retentionPanel';panel.hidden=true;panel.style.cssText='position:fixed;inset:28px;z-index:1600;background:var(--card,#f8faf9);color:var(--text,#172923);border:1px solid #819b8c66;border-radius:20px;box-shadow:0 18px 60px #0005;padding:20px;overflow:auto;font:14px system-ui';
 panel.innerHTML='<div style="display:flex;gap:12px;align-items:center;justify-content:space-between"><div><h2 style="margin:0">Удержание клиентов</h2><small>Единая доска Sales и CSM • причины, история, следующий шаг</small></div><button id="retentionClose" type="button">Закрыть</button></div><div id="retentionControls" style="display:flex;gap:9px;flex-wrap:wrap;margin:15px 0"><button id="retentionAdd" type="button">+ Создать кейс</button><button id="retentionRefresh" type="button">Обновить</button></div><div id="retentionForm" hidden></div><div id="retentionInfo"></div><div id="retentionLanes" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:15px"></div>';
 document.body.appendChild(panel);
 panel.querySelector('#retentionClose').onclick=()=>{active=false;panel.hidden=true};
 panel.querySelector('#retentionRefresh').onclick=load;
 panel.querySelector('#retentionAdd').onclick=()=>form();
}
function itemName(id){return camps.find(c=>c.id===id)?.name||id}
async function load(){
 const a=api(),u=user();if(!a||!u){document.getElementById('retentionInfo').textContent='Авторизуйтесь для работы с удержаниями';return}
 const [cr,rr]=await Promise.all([a.from('csm_camps').select('id,name').order('name').limit(300),a.from('campbox_retention_cases').select('*').order('created_at',{ascending:false}).limit(500)]);
 if(rr.error){document.getElementById('retentionInfo').textContent='Доступ к удержаниям: '+rr.error.message;return}
 camps=cr.data||[];all=rr.data||[];draw();
 if(cr.error)document.getElementById('retentionInfo').textContent='Список лагерей недоступен: '+cr.error.message;
}
function draw(){
 const lanes=document.getElementById('retentionLanes');
 lanes.innerHTML=statuses.map(([key,label])=>{
 const items=all.filter(x=>x.status===key);
 return '<div style="border:1px solid #98aa9d66;border-radius:14px;padding:10px;min-height:130px"><strong>'+esc(label)+' · '+items.length+'</strong><div style="display:grid;gap:9px;margin-top:12px">'+items.map(x=>'<button type="button" data-retention="'+esc(x.id)+'" style="text-align:left;border:1px solid #98aa9d66;background:transparent;color:inherit;border-radius:10px;padding:10px;cursor:pointer"><b>'+esc(itemName(x.camp_id))+'</b><small style="display:block;margin:7px 0">'+esc(reasons.find(r=>r[0]===x.trigger_reason)?.[1]||x.trigger_reason)+'</small><small>'+esc(x.next_action||'Следующий шаг не указан')+(x.next_contact?' · '+esc(x.next_contact):'')+'</small><small style="display:block">В очереди: '+(x.team==='csm'?'CSM':'Sales')+'</small></button>').join('')+'</div></div>'
 }).join('');
 lanes.querySelectorAll('[data-retention]').forEach(b=>b.onclick=()=>form(all.find(x=>x.id===b.dataset.retention)));
 document.getElementById('retentionInfo').textContent='Всего кейсов: '+all.length+'. Открытие кейса не начисляет премию и не меняет договор.';
}
function form(x){
 const f=document.getElementById('retentionForm');f.hidden=false;f.style.cssText='padding:15px;border:1px solid #98aa9d66;border-radius:14px;margin:12px 0';
 const select=(name,opts,value)=>'<label style="display:grid;gap:3px">'+name+'<select data-f="'+name+'" style="padding:8px">'+opts.map(([v,l])=>'<option value="'+esc(v)+'" '+(v===value?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>';
 const field=(name,val,type='text')=>'<label style="display:grid;gap:3px">'+name+'<input type="'+type+'" data-f="'+name+'" value="'+esc(val||'')+'" style="padding:8px"></label>';
 f.innerHTML='<h3>'+(x?'Редактирование удержания':'Новое удержание')+'</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px">'+
 select('camp',camps.map(c=>[c.id,c.name]),x?.camp_id||'')+
 select('reason',reasons,x?.trigger_reason||'explicit_exit')+
 field('details',x?.reason_details)+field('summary',x?.handoff_summary)+
 field('attempts',x?.contact_attempts||0,'number')+
 field('nextAction',x?.next_action)+field('nextDate',x?.next_contact,'date')+
 select('status',statuses,x?.status||'new')+
 field('result',x?.result_notes)+'</div><div style="display:flex;gap:8px;margin-top:12px"><button id="retentionSave">Сохранить</button><button id="retentionCancel">Отмена</button></div><p style="font-size:12px">Из транскрибации: прямое заявление об уходе или отсутствие ответа после зафиксированных попыток — основание для кейса. При передаче CSM добавляет краткую историю контактов. «Возвращён» — операционный статус; 6 месяцев мотивации Sales начисляются только после отдельного подтверждения руководителя.</p>';
 f.querySelector('#retentionCancel').onclick=()=>f.hidden=true;
 f.querySelector('#retentionSave').onclick=async()=>{
 const v=key=>f.querySelector('[data-f="'+key+'"]')?.value;
 if(!v('camp'))return notify('Выберите лагерь');
 if(!v('details').trim()||!v('summary').trim())return notify('Нужны причина и краткая история действий');
 if(v('reason')==='unreachable' && Number(v('attempts'))<3)return notify('Для причины «Не отвечает» зафиксируйте минимум три попытки звонка, как предусмотрено процессом.');
 const payload={camp_id:v('camp'),trigger_reason:v('reason'),reason_details:v('details'),handoff_summary:v('summary'),contact_attempts:Number(v('attempts'))||0,next_action:v('nextAction'),next_contact:v('nextDate')||null,status:x?v('status'):'new',result_notes:v('result')};
 let res;
 if(x){delete payload.camp_id;res=await api().from('campbox_retention_cases').update(payload).eq('id',x.id)}
 else res=await api().from('campbox_retention_cases').insert({...payload,team:payload.trigger_reason==='suspended'?'csm':'sales',opened_by:user().id});
 if(res.error)return notify(res.error.message);
 f.hidden=true;await load();
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();