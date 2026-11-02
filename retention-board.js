(function(){'use strict';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const status=[['new','Новый кейс'],['in_progress','В работе'],['waiting_customer','Ждём клиента'],['returned','Клиент возвращён'],['lost','Клиент потерян']];
const reasons=[['explicit_exit','Заявил об уходе'],['unreachable','Нет связи с клиентом'],['no_sales','Нет активных продаж'],['no_launch','Нет запуска'],['suspended','Приостановка'],['terminated','Договор расторгнут'],['other','Другая причина']];
const csm=document.title.toLowerCase().includes('csm');let cases=[],camps=[],filter='all',mine=false,active=false;
const api=()=>typeof sb!=='undefined'?sb:null;
const me=()=>typeof currentUser!=='undefined'?currentUser:null;
const manager=()=>typeof currentProfile!=='undefined'&&currentProfile?.role==='manager';
const css=`
#retentionView{margin:12px 0 28px;color:var(--text,#26374b);font:inherit}
#retentionView .ret-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
#retentionView h2{margin:0;font-size:23px}#retentionView h3{margin:0 0 12px;font-size:17px}
#retentionView .ret-muted{color:var(--muted,#78859a);font-size:12px}
#retentionView .ret-btn{border:1px solid var(--border,#ced9de);background:var(--card,#fff);color:var(--text,#23374b);border-radius:10px;padding:10px 13px;cursor:pointer;font:600 13px inherit}
#retentionView .ret-primary{background:#237c60!important;color:white!important;border-color:#237c60!important}
#retentionView .ret-stats{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:10px;margin:16px 0}
#retentionView .ret-stat,#retentionView .ret-card,#retentionView .ret-filter,#retentionView .ret-editor{background:var(--card,#fff);border:1px solid var(--border,#d5dee0);border-radius:14px;padding:15px;box-shadow:0 2px 10px #00000008}
#retentionView .ret-stat b{display:block;font-size:27px;margin-top:7px}
#retentionView .ret-filter{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin-bottom:15px}
#retentionView label{display:grid;gap:6px;font-size:12px;font-weight:650}#retentionView input,#retentionView select,#retentionView textarea{background:var(--input-bg,var(--card,#fff));border:1px solid var(--border,#cad8dc);color:var(--text,#26374b);border-radius:9px;padding:9px;width:100%;font:inherit;box-sizing:border-box}
#retentionView .ret-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
#retentionView .ret-card{cursor:pointer;text-align:left;min-height:105px;color:inherit;width:100%}
#retentionView .ret-card:hover{border-color:#268868}#retentionView .ret-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
#retentionView .ret-editor{margin:14px 0}#retentionView .ret-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
#mainApp.retention-mode>*:not(.topbar):not(#retentionView):not(.sales-side-menu){display:none!important}
#mainApp.retention-mode>#retentionView{display:block!important}
@media(max-width:1050px){#retentionView .ret-stats{grid-template-columns:repeat(2,minmax(0,1fr))}#retentionView .ret-columns{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:650px){#retentionView .ret-columns,#retentionView .ret-grid{grid-template-columns:1fr}#retentionView h2{font-size:20px}}
`;
function init(){
 if($('retentionView'))return;
 const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
 const root=document.createElement('section');root.id='retentionView';root.className='hidden';root.hidden=true;
 root.innerHTML='<div class="ret-head"><div><h2>Удержание клиентов</h2><div class="ret-muted">Общая работа Sales и CSM · следующая задача, история и результат</div></div><div class="ret-actions"><button class="ret-btn ret-primary" id="retNew">+ Создать кейс</button><button class="ret-btn" id="retReload">Обновить</button></div></div><div id="retStats" class="ret-stats"></div><div class="ret-filter"><label>Статус<select id="retStatus"></select></label><label>Поиск<input id="retSearch" placeholder="Название лагеря или причина"></label><label><span>Мои кейсы</span><input type="checkbox" id="retMine" style="width:20px"></label></div><div id="retEditor"></div><div id="retList" class="ret-columns"></div><div id="retMessage" class="ret-muted"></div>';
 $('mainApp').appendChild(root);
 $('retStatus').innerHTML='<option value="all">Все статусы</option>'+status.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('');
 $('retNew').onclick=()=>editor();$('retReload').onclick=load;
 $('retStatus').onchange=()=>{filter=$('retStatus').value;draw()};
 $('retSearch').oninput=draw;$('retMine').onchange=()=>{mine=$('retMine').checked;draw()};
}
window.openRetentionView=function(){
 init();active=true;
 if(csm&&typeof setView==='function')setView('retention');
 else{$('mainApp').classList.add('retention-mode');$('retentionView').hidden=false;$('retentionView').classList.remove('hidden');}
 load();
};
window.closeRetentionView=function(){
 active=false;if(csm&&typeof setView==='function')setView('dashboard');
 else{$('mainApp').classList.remove('retention-mode');$('retentionView').hidden=true;$('retentionView').classList.add('hidden');}
};
window.renderRetentionView=function(){init();$('retentionView').hidden=false;$('retentionView').classList.remove('hidden');load()};
async function load(){
 if(!api()||!me()){ $('retMessage').textContent='Необходимо войти в систему';return;}
 const [a,b]=await Promise.all([api().from('campbox_retention_cases').select('*').order('created_at',{ascending:false}).limit(500),api().from('csm_camps').select('id,name').order('name').limit(500)]);
 if(a.error){$('retMessage').textContent='Не удалось загрузить кейсы: '+a.error.message;return}
 cases=a.data||[];camps=b.data||[];$('retMessage').textContent=b.error?'Список лагерей ограничен правами доступа.':'';
 draw();
}
function draw(){
 $('retStats').innerHTML=status.map(([v,t])=>'<button type="button" class="ret-stat ret-status-tile" data-ret-status="'+v+'" aria-pressed="'+(filter===v)+'" style="text-align:left;cursor:pointer;color:inherit;'+(filter===v?'border-color:#237c60;box-shadow:0 0 0 2px #237c6022;':'')+'"><span class="ret-muted">'+t+'</span><b>'+cases.filter(c=>c.status===v).length+'</b></button>').join('');
 $('retStats').querySelectorAll('[data-ret-status]').forEach(b=>b.onclick=()=>{
   filter=filter===b.dataset.retStatus?'all':b.dataset.retStatus;
   $('retStatus').value=filter;
   draw();
 });
 const query=($('retSearch').value||'').toLowerCase();
 const shown=cases.filter(c=>(filter==='all'||c.status===filter)&&(!mine||c.assigned_to===me()?.id)&&(!query||[name(c.camp_id),c.reason_details,c.next_action].join(' ').toLowerCase().includes(query)));
 $('retList').innerHTML=shown.map(c=>{
 const r=reasons.find(x=>x[0]===c.trigger_reason)?.[1]||c.trigger_reason;
 return '<button type="button" class="ret-card" data-id="'+esc(c.id)+'"><div style="display:flex;justify-content:space-between;gap:12px"><b>'+esc(name(c.camp_id))+'</b><span class="ret-muted">'+(c.team==='csm'?'CSM':'Sales')+'</span></div><p>'+esc(r)+'</p><div class="ret-muted">Следующий шаг: '+esc(c.next_action||'не назначен')+'</div><div class="ret-muted">'+esc(c.next_contact||'Дата не указана')+'</div></button>'
 }).join('')||'<div class="ret-card ret-muted">По выбранным фильтрам кейсов нет</div>';
 $('retList').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>editor(cases.find(x=>x.id===b.dataset.id)));
}
function name(id){return camps.find(x=>x.id===id)?.name||'Лагерь '+String(id||'').slice(0,8)}
function editor(c){
 const e=$('retEditor');const sel=(key,title,options,value)=>'<label>'+title+'<select data-ret="'+key+'">'+options.map(([v,t])=>'<option value="'+esc(v)+'"'+(v===value?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>';
 const field=(key,title,value,type='text')=>'<label>'+title+'<input data-ret="'+key+'" type="'+type+'" value="'+esc(value||'')+'"></label>';
 e.innerHTML='<div class="ret-editor"><div class="ret-head"><h3>'+(c?'Карточка удержания':'Создание кейса')+'</h3><button class="ret-btn" id="retCancel">Закрыть карточку</button></div><div class="ret-grid">'+
 sel('camp','Лагерь',camps.map(x=>[x.id,x.name]),c?.camp_id||camps[0]?.id)+
 sel('reason','Причина удержания',reasons,c?.trigger_reason||'explicit_exit')+
 field('details','Что произошло',c?.reason_details)+field('summary','История действий и контактов',c?.handoff_summary)+
 field('attempts','Попыток звонка',c?.contact_attempts||0,'number')+
 field('next','Следующий шаг',c?.next_action)+field('date','Дата следующего контакта',c?.next_contact,'date')+
 sel('status','Текущий статус',status,c?.status||'new')+
 field('result','Результат работы',c?.result_notes)+'</div><div class="ret-actions"><button class="ret-btn ret-primary" id="retSave">Сохранить</button></div><div class="ret-muted" style="margin-top:12px">Передача в Sales и CSM синхронизирована. Удержание подтверждает руководитель; бонус +6 месяцев начисляется первоначальному Sales-менеджеру.</div></div>';
 $('retCancel').onclick=()=>e.innerHTML='';
 if(c?.approved_at)e.querySelector('#retSave').disabled=true;
 const v=k=>e.querySelector('[data-ret="'+k+'"]')?.value;
 $('retSave').onclick=async()=>{
 if(!v('camp')||!v('details')?.trim()||!v('summary')?.trim()){alert('Укажите лагерь, причину и историю действий');return}
 if(v('reason')==='unreachable'&&Number(v('attempts'))<3){alert('Зафиксируйте минимум 3 попытки звонка');return}
 const row={camp_id:v('camp'),trigger_reason:v('reason'),reason_details:v('details'),handoff_summary:v('summary'),contact_attempts:Math.max(0,Number(v('attempts'))||0),next_action:v('next'),next_contact:v('date')||null,status:c?v('status'):'new',result_notes:v('result')};
 let res;if(c){delete row.camp_id;res=await api().from('campbox_retention_cases').update(row).eq('id',c.id)}else res=await api().from('campbox_retention_cases').insert({...row,team:row.trigger_reason==='suspended'?'csm':'sales',opened_by:me().id});
 if(res.error){alert(res.error.message);return}e.innerHTML='';await load();
 };
 if(c?.status==='returned'&&!c.approved_at&&manager()){
 const b=document.createElement('button');b.className='ret-btn ret-primary';b.style.marginTop='10px';b.textContent='Подтвердить удержание (+6 месяцев Sales)';
 b.onclick=async()=>{if(!confirm('Подтвердить удержание с начислением исходному Sales-менеджеру?'))return;const r=await api().rpc('campbox_confirm_retention',{p_case_id:c.id});if(r.error)alert(r.error.message);else{e.innerHTML='';await load()}};
 e.querySelector('.ret-editor').appendChild(b);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();