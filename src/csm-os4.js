(function os4Module(){
  'use strict';
  // Presentation-only upgrade; the original Supabase operations and fixes remain the source of truth.
  const $ = id => document.getElementById(id);
  const safe = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const txt = v => v == null || v === '' ? 'Не выяснено' : String(v);
  const isoToday = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-') };
  const addDays = (iso, n) => {const d=new Date((iso || isoToday())+'T12:00:00');d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const dateDiff = date => Math.round((new Date(date+'T12:00:00')-new Date(isoToday()+'T12:00:00'))/86400000);
  const activeCamps = () => typeof csmScopeCamps === 'function' ? csmScopeCamps().filter(c=>c.active) : [];
  const activeFeatures = () => features.filter(f=>f.is_active);
  const stage = (cid, fid) => window.CsmSelectors.featureStatus(cid,fid,campFeatures);
  const owner = c => campProfile(c?.responsible_id).full_name || 'Не назначен';
  const camp = id => camps.find(c=>c.id===id);
  const newest = id => contacts.filter(r=>r.camp_id===id).sort((a,b)=>String(b.contact_date).localeCompare(String(a.contact_date)))[0];
  const manager = () => typeof isManager==='function' && isManager();
  const ui = {queueTab:'overdue',workTab:'steps',adoptionTab:'matrix',profileTab:'question',campView:'all'};
  function icon(name) {
    const path={
      grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
      users:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>',
      check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
      rocket:'<path d="M4 20 9 15M15 9l5-5M11 6c4-2 7-2 10-3-1 3-1 6-3 10l-7 7-7-7zM7 17l-4 4"/>',
      layers:'<path d="m12 2 9 5-9 5-9-5 9-5zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
      question:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2.4c-1.1.9-2 1.2-2 3M12 17h.01"/>',
      chart:'<path d="M4 20V4M4 20h16M8 16v-4m5 4V8m5 8V6"/>',
      exit:'<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 16l4-4-4-4M18 12H8"/>',
      tune:'<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="17" r="2"/>',
      download:'<path d="M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3"/>'
    };
    return '<svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19">'+(path[name]||path.grid)+'</svg>';
  }
  function layout(){
    if(document.body.classList.contains('csm-os4'))return;
    document.body.classList.add('csm-os4');
    let theme='light';try{theme=localStorage.getItem('campbox-csm-os-theme') || 'light'}catch(e){}
    document.body.dataset.theme=theme;
    const names={dashboard:['Пульт','grid'],camps:['Клиенты','users'],contacts:['Работа','check'],launches:['Смены','rocket'],features:['Внедрение','layers'],profile:['Знание о клиенте','question'],report:['Аналитика','chart']};
    document.querySelectorAll('.sidebar .side-nav button[data-view]').forEach(b=>{
      const n=names[b.dataset.view];
      if(n){b.innerHTML='<span class="side-ico">'+icon(n[1])+'</span>'+safe(n[0]);}
    });
    const brand=document.querySelector('.sidebar-brand b'),subtitle=document.querySelector('.sidebar-brand small');
    if(brand)brand.textContent='Customer Success OS';
    if(subtitle)subtitle.textContent='CampBox · команда сопровождения';
    const topActions=document.querySelector('.topbar .actions');
    if(topActions && !$('osGlobalSearch')){
      const search=document.createElement('input');search.id='osGlobalSearch';search.type='search';
      search.placeholder='Найти лагерь...';search.setAttribute('aria-label','Глобальный поиск лагеря');
      search.addEventListener('keydown',event=>{
        if(event.key!=='Enter' || !search.value.trim())return;
        event.preventDefault();setView('camps');
        ['filterContractStatus','filterFeature','filterStatus','filterProfileField','filterProfileValue'].forEach(id=>{if($(id))$(id).value=''});
        $('filterActivity').value='active';if(manager())$('filterCsm').value='';
        $('campSearch').value=search.value.trim();ui.campView='all';renderCamps();
      });
      topActions.prepend(search);
    }
    const foot=document.querySelector('.sidebar-foot');
    if(foot){
      const themeBtn=document.createElement('button');themeBtn.type='button';themeBtn.className='os-theme-toggle';
      themeBtn.onclick=()=>{
        const next=document.body.dataset.theme==='light'?'dark':'light';document.body.dataset.theme=next;
        try{localStorage.setItem('campbox-csm-os-theme',next)}catch(e){}
        themeBtn.textContent=next==='light'?'Тема: светлая / тёмная':'Тема: тёмная / светлая';
      };
      themeBtn.textContent=theme==='light'?'Тема: светлая / тёмная':'Тема: тёмная / светлая';
      foot.prepend(themeBtn);
      foot.querySelectorAll('.side-tool').forEach(b=>{
        const v=b.textContent.toLowerCase(),ico=v.includes('excel')?'download':v.includes('выйти')?'exit':'tune';
        b.querySelector('.side-ico')?.replaceChildren();
        const span=b.querySelector('.side-ico');if(span)span.innerHTML=icon(ico);
      });
    }
    Object.entries({dashboard:'Пульт',camps:'Клиенты',contacts:'Работа',launches:'Смены',features:'Внедрение',profile:'Знание о клиенте',report:'Аналитика',kpi:'Расшифровка показателя'}).forEach(([k,v])=>{
      const mobile=document.querySelector('#mobileNav [data-view="'+k+'"]');
      if(mobile)mobile.textContent=v;
    });
    const mobile=$('mobileNav');
    if(mobile && !$('osMobileMore')){
      const more=document.createElement('button');
      more.id='osMobileMore';more.type='button';more.textContent='Ещё';more.setAttribute('aria-expanded','false');
      const sheet=document.createElement('div');sheet.id='osMobileSheet';sheet.className='os-mobile-sheet';sheet.hidden=true;
      sheet.innerHTML='<button type="button" data-os-mobile-dest="features">Внедрение</button><button type="button" data-os-mobile-dest="profile">Знание о клиенте</button><button type="button" data-os-mobile-dest="camps">Реестр клиентов</button>';
      mobile.after(sheet);mobile.append(more);
      more.onclick=()=>{sheet.hidden=!sheet.hidden;more.setAttribute('aria-expanded',String(!sheet.hidden));};
      sheet.onclick=e=>{const b=e.target.closest('[data-os-mobile-dest]');if(!b)return;setView(b.dataset.osMobileDest);sheet.hidden=true;more.setAttribute('aria-expanded','false');};
    }
    installDashboard();installCamps();installContacts();installFeatures();installProfile();installLaunches();installReport();
  }
  function actions(){
    const cs=activeCamps(), t=isoToday(), entries=[];
    cs.forEach(c=>{
      const last=newest(c.id), due=last?.next_step_date || '', risk=campHasRisk(c.id);
      if(last?.next_step && due && due < t) entries.push({group:'overdue',c,date:due,cause:'Просрочен следующий шаг',note:last.next_step});
      else if(last?.next_step && due===t) entries.push({group:'today',c,date:due,cause:'Следующий шаг сегодня',note:last.next_step});
      else if(last?.next_step && due>t && due<=addDays(t,7)) entries.push({group:'upcoming',c,date:due,cause:'Следующий шаг',note:last.next_step});
      else if(last?.next_step && !due)entries.push({group:'unknown',c,date:'',cause:'Следующий шаг без даты',note:last.next_step});
      if(!last || dateDiff(last.contact_date) <= -14)entries.push({group:'overdue',c,date:last?.contact_date||'',cause:'Нет работы 14+ дней',note:last?'Последняя работа '+last.contact_date:'Контактов пока нет'});
      const unknown=unknownProfileForCamp(c.id);
      if(unknown.length)entries.push({group:'unknown',c,date:'',cause:'Не выяснены сведения',note:unknown.slice(0,2).map(f=>f.name).join(', ')});
      if(risk && !entries.some(e=>e.c.id===c.id && e.group==='overdue'))entries.push({group:'implementation',c,date:'',cause:'Требует внимания',note:'Есть зарегистрированные сигналы риска'});
      campFeatures.filter(f=>f.camp_id===c.id && f.status!=='Перешёл' && f.status!=='Не требуется' && String(f.reason||'').trim()).forEach(st=>entries.push({group:'implementation',c,date:'',cause:featureById(st.feature_id).name,note:st.reason}));
      launches.filter(l=>l.camp_id===c.id && l.status!=='Отменена').forEach(l=>{
        const cp=nextCheckpoint(l.id);
        if(cp && checkpointOverdue(cp))entries.push({group:'overdue',c,date:cp.due_date||'',cause:'Контрольная точка смены',note:l.shift_name+' · '+cp.title});
        if(l.start_date && !['Не выяснено','Перенесена','Отменена'].includes(l.status) && l.start_date>=t && l.start_date<=addDays(t,14))entries.push({group:'launch',c,date:l.start_date,cause:'Ближайший запуск',note:l.shift_name+' · '+l.status});
        if(!l.start_date || l.status==='Не выяснено') entries.push({group:'unknown',c,date:'',cause:'Дата смены не выяснена',note:l.shift_name});
      });
      if(c.renewal_review_date && c.renewal_review_date<=addDays(t,30))entries.push({group:'renewal',c,date:c.renewal_review_date,cause:'Проверить продление',note:'Дата проверки, не факт продления'});
    });
    return entries.sort((a,b)=>String(a.date||'9999-99-99').localeCompare(String(b.date||'9999-99-99'))||a.c.name.localeCompare(b.c.name,'ru'));
  }
  function installDashboard(){
    const box=$('viewDashboard');if(!box || $('osDashboard'))return;
    const host=document.createElement('div');host.id='osDashboard';
    host.innerHTML='<section class="os-hero"><div><div class="os-eyebrow">Customer Success / Операционный центр</div><h2 id="osHeadline">Действия на сегодня</h2><p id="osHeroText">Основано на фактических контактах, внедрениях, датах смен и контрольных точках.</p></div><div class="os-hero-actions"><button class="btn primary" type="button" onclick="openContactModal()">+ Зафиксировать работу</button><button class="btn" type="button" onclick="setView(\'camps\')">Открыть клиентов</button></div></section><section class="os-metrics" id="osMetrics"></section><div class="os-grid"><section class="os-panel"><div class="os-panel-head"><div><h3>Очередь решений</h3><p>Основание → лагерь → конкретное действие. Без оценок ИИ.</p></div><span class="os-pill" id="osQueueSize">—</span></div><div class="os-tabs" id="osQueueTabs" role="tablist"></div><div id="osQueueRows"></div></section><section class="os-panel"><div class="os-panel-head"><div><h3>Ближайшие смены</h3><p>Подтверждённые даты на 14 дней; неизвестные отдельно</p></div><button class="os-compact-btn" onclick="setView(\'launches\')">Все смены</button></div><div id="osLaunchGlance"></div></section></div>';
    box.prepend(host);
    const queue=$('osQueueTabs');queue.addEventListener('click',e=>{const b=e.target.closest('[data-queue-tab]');if(!b)return;ui.queueTab=b.dataset.queueTab;renderDashboardOS();});
    const oldSales=$('salesHandoffQueue');
    if(oldSales){const details=document.createElement('details');details.className='os-legacy-section';details.innerHTML='<summary class="os-compact-btn">Передача Sales → CSM · распределение (руководитель)</summary>';oldSales.before(details);details.append(oldSales);}
    const team=$('csmGrid')?.closest('section.card.manager-only');
    if(team){const details=document.createElement('details');details.className='os-legacy-section';details.innerHTML='<summary class="os-compact-btn">Детальный срез команды · исходные показатели</summary>';team.before(details);details.append(team);}

  }
  function organizeLegacyDashboardOS(){
    const candidates=[
      ['csmGrowthOverview','Возможности и продления · расширенный срез'],
      ['csmHealthOverview','Здоровье портфеля · исходная детализация']
    ];
    for(const [id,label] of candidates){
      const el=$(id);
      if(!el||el.closest('details.os-legacy-section'))continue;
      const details=document.createElement('details');details.className='os-legacy-section';
      const summary=document.createElement('summary');summary.className='os-compact-btn';summary.textContent=label;
      details.append(summary);el.before(details);details.append(el);
    }
  }

  function renderDashboardOS(){
    if(!$('osDashboard'))return;
    const cs=activeCamps(), items=actions(), overdue=items.filter(x=>x.group==='overdue'), stale=cs.filter(c=>!newest(c.id)||dateDiff(newest(c.id).contact_date)<=-14);
    const states=cs.flatMap(c=>activeFeatures().map(f=>stage(c.id,f.id))).filter(x=>x!=='Не требуется');
    const pct=states.length?Math.round(states.filter(s=>s==='Перешёл').length*100/states.length):null;
    const cpIds=new Set(cs.map(c=>c.id));const overduePoints=launchCheckpoints.filter(cp=>{
      const l=launchById(cp.launch_id);return l && cpIds.has(l.camp_id) && checkpointOverdue(cp);
    });
    const affected=new Set(items.filter(x=>['overdue','today','unknown','implementation','launch','renewal'].includes(x.group)).map(x=>x.c.id));
    $('osHeadline').textContent=affected.size?affected.size+' лагерей требуют внимания':'Портфель без зарегистрированных сигналов';
    $('osHeroText').textContent='Подтверждённых сигналов: '+items.length+'. '+(manager()?'Командный портфель':'Ваш портфель')+' · '+cs.length+' активных лагерей. Неизвестные сведения выделены отдельно.';
    const metrics=[
      ['Лагеря в работе',cs.length,'Текущая зона ответственности',"setView('camps')"],
      ['Активация функций',pct===null?'—':pct+'%','«Перешёл» / применимые связки',"openKpiDetails('activation')"],
      ['Просрочено точек',overduePoints.length,'Фактические незакрытые контрольные точки',"setView('launches')"],
      ['Без работы 14+ дней',stale.length,'По записям контактов',"openKpiDetails('stale')"]
    ];
    $('osMetrics').innerHTML=metrics.map(m=>'<button class="os-metric" type="button" onclick="'+m[3]+'"><span>'+safe(m[0])+'</span><b>'+safe(m[1])+'</b><small>'+safe(m[2])+'</small></button>').join('');
    const tabs=[['overdue','Просрочено'],['today','Сегодня'],['unknown','Выяснить'],['implementation','Внедрение'],['launch','Запуски'],['renewal','Продление']];
    $('osQueueTabs').innerHTML=tabs.map(x=>'<button class="os-tab" role="tab" aria-selected="'+(ui.queueTab===x[0])+'" data-queue-tab="'+x[0]+'">'+x[1]+' · '+items.filter(a=>a.group===x[0]).length+'</button>').join('');
    const chosen=items.filter(x=>x.group===ui.queueTab);$('osQueueSize').textContent=chosen.length+' сигналов';
    $('osQueueRows').innerHTML=chosen.slice(0,5).map(e=>'<div class="os-row"><div><strong>'+safe(e.c.name)+'</strong><span>'+safe(e.cause)+' · '+safe(e.note)+' · '+safe(owner(e.c))+(e.date?' · '+safe(e.date):'')+'</span></div><button class="os-compact-btn" onclick="openCampModal(\''+safe(e.c.id)+'\')">Разобрать</button></div>').join('') || '<div class="os-empty">В этой категории нет зафиксированных сигналов.</div>';
    if(chosen.length>5)$('osQueueRows').insertAdjacentHTML('beforeend','<button class="btn" type="button" onclick="setView(\'camps\')">Перейти к клиентам · ещё '+(chosen.length-5)+'</button>');
    const shifts=launches.filter(l=>cpIds.has(l.camp_id) && l.status!=='Отменена').sort((a,b)=>String(a.start_date||'9999').localeCompare(String(b.start_date||'9999')));
    const upcoming=shifts.filter(l=>l.start_date&&!['Не выяснено','Перенесена'].includes(l.status)&&l.start_date>=isoToday()&&l.start_date<=addDays(isoToday(),14));
    const unknown=shifts.filter(l=>!l.start_date||l.status==='Не выяснено').length;
    $('osLaunchGlance').innerHTML=upcoming.slice(0,5).map(l=>'<div class="os-row"><div><strong>'+safe(camp(l.camp_id)?.name||'Лагерь')+'</strong><span>'+safe(l.shift_name)+' · '+safe(l.start_date)+' · '+safe(l.status)+'</span></div><button class="os-compact-btn" onclick="openLaunchModal(\''+safe(l.id)+'\')">Открыть</button></div>').join('')||'<div class="os-empty">Подтверждённых стартов в ближайшие 14 дней нет.</div>';
    $('osLaunchGlance').insertAdjacentHTML('beforeend','<div class="os-row"><div><strong>Дата не выяснена</strong><span>Смен без подтверждённой даты: '+unknown+'</span></div><button class="os-compact-btn" onclick="setView(\'launches\');document.getElementById(\'launchPeriodFilter\').value=\'unknown\';renderLaunches()">Выяснить</button></div>');
  }
  function renderManagerOS(){
  const root=$('osDashboard');if(!root)return;
  let section=$('osManagerPanel');
  if(!manager()){section?.remove();return;}
  if(!section){
    section=document.createElement('section');section.id='osManagerPanel';section.className='os-panel';section.style.marginBottom='16px';
    root.append(section);
  }
  const people=profiles.filter(p=>p.active&&!p.archived);
  const rows=people.map(p=>{
    const assigned=activeCamps().filter(c=>c.responsible_id===p.id);
    const overdue=assigned.filter(c=>{const r=newest(c.id);return !r||dateDiff(r.contact_date)<=-14;}).length;
    const unknown=assigned.reduce((n,c)=>n+unknownProfileForCamp(c.id).length,0);
    const worked=assigned.filter(c=>contacts.some(x=>x.camp_id===c.id&&x.contact_date>=addDays(isoToday(),-30))).length;
    return '<div class="os-row"><div><strong>'+safe(p.full_name||p.email)+'</strong><span>'+assigned.length+' лагерей · '+worked+' с работой за 30 дней · '+overdue+' без работы 14+ · '+unknown+' неизвестных ответов</span></div><button class="os-compact-btn" data-os-owner="'+safe(p.id)+'">Клиенты</button></div>';
  });
  const unassigned=camps.filter(c=>c.active&&!c.responsible_id).length;
  section.innerHTML='<div class="os-panel-head"><div><h3>Команда и распределение</h3><p>Срез по текущей зоне ответственности; активность не приравнивается к результату.</p></div><span class="os-pill">Без CSM: '+unassigned+'</span></div>'+rows.join('');
  section.onclick=e=>{
    const b=e.target.closest('[data-os-owner]');if(!b)return;
    setView('camps');$('filterActivity').value='active';$('filterCsm').value=b.dataset.osOwner;ui.campView='all';renderCamps();
  };
}
function renderLaunchCalendarOS(){
  const view=$('viewLaunches');if(!view)return;
  let section=$('osLaunchCalendar');
  if(!section){
    section=document.createElement('section');section.id='osLaunchCalendar';section.className='os-panel';
    const k=view.querySelector('.launch-kpis');if(k)k.before(section);else view.append(section);
  }
  const inScope=new Set(activeCamps().map(c=>c.id));
  const ls=filteredLaunches().filter(l=>inScope.has(l.camp_id)&&l.status!=='Отменена');
  const dated=ls.filter(l=>l.start_date&&!['Не выяснено','Перенесена'].includes(l.status)).sort((a,b)=>a.start_date.localeCompare(b.start_date));
  const unknown=ls.filter(l=>!l.start_date||['Не выяснено','Перенесена'].includes(l.status));
  section.innerHTML='<div class="os-panel-head"><div><h3>Хронология запусков</h3><p>Главный объект — конкретная смена. Даты без подтверждения не попадают в календарь.</p></div><span class="os-pill">'+dated.length+' с датой · '+unknown.length+' без даты</span></div>'+
    '<div class="os-grid"><div><h3 style="font-size:13px;margin-bottom:8px">Подтверждённые старты</h3>'+
    (dated.slice(0,12).map(l=>{
      const cp=nextCheckpoint(l.id),r=window.CsmSelectors?.readiness(checkpointsForLaunch(l.id));
      return '<div class="os-timeline-item"><div style="flex:1"><b>'+safe(l.start_date)+' · '+safe(camp(l.camp_id)?.name||'—')+'</b><p>'+safe(l.shift_name)+' · '+safe(l.status)+' · '+(r?.percent==null?'Нет контрольных точек':'Готовность '+r.percent+'%')+'</p><p>'+(cp?'Ближайший контроль: '+safe(cp.title)+' · '+safe(cp.due_date||'без срока'):'Открытых контрольных точек нет')+'</p><button class="os-compact-btn" onclick="openLaunchModal(\''+safe(l.id)+'\')">Открыть смену</button></div></div>';
    }).join('')||'<div class="os-empty">В этом фильтре нет стартов с подтверждённой датой</div>')+'</div><div><h3 style="font-size:13px;margin-bottom:8px">Дата не выяснена · '+unknown.length+'</h3>'+
    (unknown.slice(0,10).map(l=>'<div class="os-row"><div><strong>'+safe(camp(l.camp_id)?.name||'—')+'</strong><span>'+safe(l.shift_name)+' · '+safe(l.status)+'</span></div><button class="os-compact-btn" onclick="openLaunchModal(\''+safe(l.id)+'\')">Уточнить</button></div>').join('')||'<div class="os-empty">Неизвестных дат в этом срезе нет</div>')+'</div></div>';
}
function renderReportChartsOS(){
  const host=$('osReportContext');if(!host)return;
  let block=$('osReportDynamics');if(!block){block=document.createElement('section');block.id='osReportDynamics';block.className='os-panel';host.after(block);}
  const cs=reportScopedCamps(),ids=new Set(cs.map(c=>c.id)),from=reportDateFrom(),now=isoToday();
  const days=Number($('reportPeriod')?.value||30),weekly=days>30,groups=new Map();
  const dateCursor=new Date(from+'T12:00:00'),end=new Date(now+'T12:00:00');
  function key(date){
    if(!weekly)return date;
    const d=new Date(date+'T12:00:00');const day=d.getDay()||7;d.setDate(d.getDate()-day+1);
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }
  for(let d=new Date(dateCursor);d<=end;d.setDate(d.getDate()+1)){const day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');groups.set(key(day),{day:key(day),contacts:0,training:0,activation:0});}
  contacts.filter(r=>ids.has(r.camp_id)&&r.contact_date>=from&&r.contact_date<=now).forEach(r=>{
    const g=groups.get(key(r.contact_date));if(g){g.contacts++;if(r.contact_type==='Обучение'||r.result==='Обучили')g.training++;}
  });
  campFeatures.filter(s=>ids.has(s.camp_id)&&s.activated_at&&s.activated_at>=from&&s.activated_at<=now).forEach(s=>{const g=groups.get(key(s.activated_at.slice(0,10)));if(g)g.activation++;});
  const data=[...groups.values()];
  const max=Math.max(1,...data.map(x=>x.contacts));
  const bars=data.map(x=>'<div style="min-width:'+(weekly?'38px':'9px')+';flex:1;text-align:center" title="'+safe(x.day)+': '+x.contacts+' контактов, '+x.training+' обучений, '+x.activation+' активаций"><div style="height:106px;display:flex;align-items:end"><div style="width:100%;background:var(--accent);height:'+Math.max(2,x.contacts/max*100)+'px;border-radius:4px 4px 0 0"></div></div></div>').join('');
  const table='<details><summary class="os-compact-btn">Числа по датам · табличная расшифровка</summary><div class="table-wrap"><table><thead><tr><th>Начало дня / недели</th><th>Контакты</th><th>Обучения</th><th>Подтверждённые переходы</th></tr></thead><tbody>'+
    data.map(x=>'<tr><td>'+safe(x.day)+'</td><td>'+x.contacts+'</td><td>'+x.training+'</td><td>'+x.activation+'</td></tr>').join('')+'</tbody></table></div></details>';
  block.innerHTML='<div class="os-panel-head"><div><h3>Динамика за период</h3><p>Объём работы по '+(weekly?'неделям':'дням')+' — столбцы. Обучения и подтверждённые переходы показаны отдельно в таблице; одно действие не равно внедрению.</p></div><span class="os-pill">Контактов: '+data.reduce((n,x)=>n+x.contacts,0)+'</span></div>'+
    '<div role="img" aria-label="График количества контактов по '+(weekly?'неделям':'дням')+'" style="display:flex;align-items:end;gap:3px;padding:12px 0;border-bottom:1px solid var(--line);overflow-x:auto">'+bars+'</div><div class="sub" style="margin:10px 0">Шкала — абсолютное количество контактов. 0 означает отсутствие записей, не ошибку загрузки.</div>'+table;
}
function installClientWorkspaceOS(){
  const view=$('viewCamps');if(!view || $('osClientWorkspace'))return;
  const legacy=$('campTableBody')?.closest('section.card');
  if(!legacy)return;
  const workspace=document.createElement('div');workspace.id='osClientWorkspace';workspace.className='os-client-workspace';
  workspace.innerHTML='<section class="os-client-list" aria-label="Клиенты"><div class="os-panel-head"><div><h3>Клиенты</h3><p id="osClientListCount">Доступные лагеря</p></div></div><div id="osClientRows" class="os-client-rows"></div></section><section class="os-client-inspector" id="osClientInspector" aria-label="Клиент 360°"><div class="os-empty">Выберите лагерь слева, чтобы открыть его досье</div></section>';
  const legacyDetails=document.createElement('details');legacyDetails.className='os-legacy-section';legacyDetails.innerHTML='<summary class="os-compact-btn">Таблица для сравнения всех клиентов</summary>';
  legacy.before(workspace);workspace.after(legacyDetails);legacyDetails.append(legacy);
  $('osClientRows').addEventListener('click',ev=>{
    const b=ev.target.closest('[data-camp-select]');if(!b)return;
    ui.selectedCampId=b.dataset.campSelect;
    ui.clientTab='overview';
    renderClientInspectorOS();
    $('osClientRows').querySelectorAll('[data-camp-select]').forEach(node=>{const active=node===b;node.setAttribute('aria-selected',String(active));node.classList.toggle('os-is-selected',active)});
    workspace.classList.add('os-detail-open');
  });
  $('osClientInspector').addEventListener('click',ev=>{
    const b=ev.target.closest('[data-client-tab]');if(!b)return;
    ui.clientTab=b.dataset.clientTab;renderClientInspectorOS();
  });
}
function renderClientWorkspaceOS(list){
  const rows=$('osClientRows');if(!rows)return;
  if(!list.some(c=>c.id===ui.selectedCampId))ui.selectedCampId=list[0]?.id||'';
  const existingScroll=rows.scrollTop;
  $('osClientListCount').textContent=list.length+' лагерей в текущей выборке';
  rows.innerHTML=list.map(c=>{
    const l=newest(c.id),risks=campHasRisk(c.id);
    return '<button type="button" class="os-client-pick'+(c.id===ui.selectedCampId?' os-is-selected':'')+'" data-camp-select="'+safe(c.id)+'" aria-selected="'+(c.id===ui.selectedCampId)+'"><span class="os-client-pick-top"><strong>'+safe(c.name)+'</strong><span class="os-client-dot '+(risks?'os-has-risk':'')+'" title="'+(risks?'Есть сигналы':'Нет зарегистрированных сигналов')+'"></span></span>'+
      '<span class="os-client-pick-middle">'+safe(owner(c))+' · '+safe(l?.contact_date||'Нет работы')+'</span><span class="os-client-pick-bottom">'+safe(l?.next_step||'Следующий шаг не зафиксирован')+'</span></button>';
  }).join('')||'<div class="os-empty">Клиенты не найдены. Измените фильтры.</div>';
  rows.scrollTop=existingScroll;
  renderClientInspectorOS();
}
function renderClientInspectorOS(){
  const host=$('osClientInspector');if(!host)return;
  const c=camp(ui.selectedCampId);
  if(!c){host.innerHTML='<div class="os-empty">Выберите лагерь для работы с досье</div>';return;}
  const l=newest(c.id),fs=activeFeatures(),questions=profileFields.filter(f=>f.is_active);
  const states=fs.map(f=>({f,s:stage(c.id,f.id),r:campFeatures.find(x=>x.camp_id===c.id && x.feature_id===f.id)||{}}));
  const adopted=states.filter(x=>x.s==='Перешёл').length, applicable=states.filter(x=>x.s!=='Не требуется').length;
  const shifts=launches.filter(x=>x.camp_id===c.id).sort((a,b)=>String(a.start_date||'9999').localeCompare(String(b.start_date||'9999')));
  const activity=contacts.filter(x=>x.camp_id===c.id).sort((a,b)=>String(b.contact_date).localeCompare(String(a.contact_date)));
  const unknown=questions.filter(f=>!profileIsKnown(campProfileValue(c.id,f.id)));
  const tabs=[['overview','Обзор'],['work','Работа'],['adoption','Внедрение'],['launches','Смены'],['profile','Профиль'],['history','История']];
  if(!tabs.some(t=>t[0]===ui.clientTab))ui.clientTab='overview';
  const fact=(name,value)=>'<div class="os-fact">'+safe(name)+'<b>'+safe(value||'Не выяснено')+'</b></div>';
  let contents='';
  if(ui.clientTab==='overview'){
    const next=shifts.find(x=>x.start_date>=isoToday() && !['Отменена','Перенесена','Не выяснено'].includes(x.status));
    contents='<div class="os-facts">'+fact('Назначенный CSM',owner(c))+fact('Последняя работа',l?.contact_date||'Не зафиксирована')+fact('Следующий шаг',l?.next_step||'Не зафиксирован')+fact('Срок следующего шага',l?.next_step_date||'Не указан')+fact('Внедрение',adopted+' из '+applicable+' применимых функций')+fact('Ближайшая подтверждённая смена',next?.start_date||'Не выяснена')+'</div>'+
      '<div class="os-inspector-note"><strong>Что требует внимания</strong><p>'+(campHasRisk(c.id)?'Есть подтверждённые основания: '+safe([!l||dateDiff(l.contact_date)<=-14?'нет недавней работы':'',unknown.length?'не выяснено '+unknown.length+' вопросов':'',campBlockers(c.id).length?'блокеры функций':''].filter(Boolean).join(' · ')||'проверьте контрольные точки смен'):'По текущим данным риски не выявлены')+'</p></div>';
  } else if(ui.clientTab==='work'){
    contents='<div class="os-inspector-note"><strong>Текущее действие</strong><p>'+safe(l?.next_step||'Следующий шаг пока не зафиксирован')+(l?.next_step_date?' · '+safe(l.next_step_date):' · Срок не указан')+'</p><button class="btn primary" onclick="openContactModal(\''+safe(c.id)+'\')">Записать контакт</button></div>'+
      (activity.slice(0,8).map(r=>'<div class="os-timeline-item"><div><b>'+safe(r.contact_date)+' · '+safe(r.contact_type)+'</b><p>'+safe(r.result||'Результат не указан')+' · '+safe(r.comment||'Без комментария')+'</p></div></div>').join('')||'<div class="os-empty">История работы пуста</div>');
  } else if(ui.clientTab==='adoption'){
    contents='<div class="os-inspector-note"><strong>Используют '+adopted+' из '+applicable+' применимых функций</strong><p>Статус «Перешёл» подтверждается отдельно от обучения</p></div>'+
      states.map(x=>'<div class="os-row"><div><strong>'+safe(x.f.name)+'</strong><span>'+safe(x.s)+(x.r.reason?' · Блокер: '+safe(x.r.reason):'')+'</span></div><button class="os-compact-btn" onclick="os4OpenCampTab(\''+safe(c.id)+'\',\'adoption\')">Изменить</button></div>').join('');
  } else if(ui.clientTab==='launches'){
    contents=shifts.map(x=>{
      const r=window.CsmSelectors.readiness(checkpointsForLaunch(x.id));
      return '<div class="os-row"><div><strong>'+safe(x.shift_name)+' · '+safe(x.start_date||'Дата не выяснена')+'</strong><span>'+safe(x.status)+' · '+(r.percent===null?'Нет применимых контрольных точек':'Готовность '+r.percent+'%')+'</span></div><button class="os-compact-btn" onclick="openLaunchModal(\''+safe(x.id)+'\')">Открыть</button></div>';
    }).join('')||'<div class="os-empty">Смены пока не добавлены</div>';
  } else if(ui.clientTab==='profile'){
    contents='<div class="os-inspector-note"><strong>Не выяснено: '+unknown.length+' из '+questions.length+'</strong><p>Ответ «Нет» считается известным.</p></div>'+
      questions.map(f=>{
        const v=campProfileValue(c.id,f.id);
        return '<div class="os-row"><div><strong>'+safe(f.name)+'</strong><span>'+safe(v.value_text||'Не выяснено')+(v.details?' · '+safe(v.details):'')+'</span></div><button class="os-compact-btn" onclick="os4OpenCampTab(\''+safe(c.id)+'\',\'profile\')">Ответить</button></div>';
      }).join('')||'<div class="os-empty">Вопросы не настроены</div>';
  } else {
    contents='<div class="os-inspector-note"><strong>Зафиксированные события</strong><p>Отображается журнал реальных контактов. История изменений договора недоступна без отдельного аудита.</p></div>'+
      activity.map(r=>'<div class="os-timeline-item"><div><b>'+safe(r.contact_date)+' · '+safe(r.contact_type)+' · '+safe(r.result||'')+'</b><p>'+safe(r.comment||'Без комментария')+'</p></div></div>').join('')||'<div class="os-empty">Зафиксированных контактов нет</div>';
  }
  host.innerHTML='<div class="os-client-inspector-head"><button class="os-compact-btn os-mobile-only" type="button" onclick="document.getElementById(\'osClientWorkspace\').classList.remove(\'os-detail-open\')">← К списку</button><div><div class="os-eyebrow">Клиент / Досье 360°</div><h2>'+safe(c.name)+'</h2><div class="os-inspector-sub">'+safe(owner(c))+' · '+(c.sales_client_id?'Связан с Sales':'Создан в CSM')+' · '+(c.active?'Активный':'Архив')+'</div></div><div class="os-client-actions"><button class="btn" onclick="os4OpenCampTab(\''+safe(c.id)+'\',\''+ui.clientTab+'\')">Редактировать</button><button class="btn primary" onclick="openContactModal(\''+safe(c.id)+'\')">+ Работа</button></div></div>'+
  '<div class="os-client-inspector-tabs" role="tablist">'+tabs.map(t=>'<button type="button" role="tab" data-client-tab="'+t[0]+'" aria-selected="'+(ui.clientTab===t[0])+'">'+t[1]+'</button>').join('')+'</div><div class="os-client-inspector-content">'+contents+'</div>';
}
  function installCamps(){
    const view=$('viewCamps');if(!view||$('osCampQuick'))return;
    const old=view.querySelector('.csm-camp-filters');
    const filters=document.createElement('details');filters.className='os-filter-details';filters.innerHTML='<summary>Расширенные фильтры · договор / CSM / функция / ответ</summary>';
    old?.before(filters);if(old)filters.append(old);
    const quick=document.createElement('div');quick.id='osCampQuick';quick.className='os-filterbar';
    quick.innerHTML='<div class="os-search"><input id="osCampSearch" type="search" aria-label="Найти лагерь" placeholder="Поиск лагеря по названию"></div><button data-os-camp-view="mine">Мои</button><button data-os-camp-view="all">Все</button><button data-os-camp-view="unassigned">Без CSM</button><button data-os-camp-view="stale">Без работы 14+</button><button data-os-camp-view="archived">Архив</button><button data-os-camp-clear>Очистить</button>';
    filters.before(quick);
    installClientWorkspaceOS();
    $('osCampSearch').addEventListener('input',e=>{$('campSearch').value=e.target.value;renderCamps()});
    quick.addEventListener('click',e=>{
      if(e.target.matches('[data-os-camp-clear]')){
        ['filterContractStatus','filterFeature','filterStatus','filterProfileField','filterProfileValue'].forEach(id=>{if($(id))$(id).value=''});
        $('campSearch').value='';$('osCampSearch').value='';$('filterActivity').value='active';
        $('filterCsm').value=manager()?'':currentProfile.id;ui.campView='all';renderCamps();return;
      }
      const b=e.target.closest('[data-os-camp-view]');if(!b)return;
      ui.campView=b.dataset.osCampView;
      $('filterActivity').value=ui.campView==='archived'?'archived':'active';
      if(manager())$('filterCsm').value=ui.campView==='mine'?currentProfile.id:ui.campView==='unassigned'?'__unassigned__':'';
      renderCamps();
    });
  }
  function renderCampsOS(){
  if(!$('osCampQuick'))return;
  const input=$('osCampSearch'), original=$('campSearch');
  if(input && original && input.value!==original.value && document.activeElement!==input)input.value=original.value;
  $('osCampQuick').querySelectorAll('[data-os-camp-view]').forEach(b=>b.classList.toggle('os-active',b.dataset.osCampView===ui.campView));
  let list=filteredCamps();
  if(!manager())list=list.filter(c=>c.responsible_id===currentProfile.id);
  if(ui.campView==='stale')list=list.filter(c=>!newest(c.id)||dateDiff(newest(c.id).contact_date)<=-14);
  const head=$('campTableBody')?.closest('table')?.querySelector('thead');
  if(head)head.innerHTML='<tr><th>Лагерь</th><th>Договор</th><th>CSM</th><th>Последняя работа</th><th>Следующий шаг</th><th id="featureHeader">Внедрение</th><th>Ближайшая смена</th><th>Сигнал</th><th></th></tr>';
  const rows=list.map(c=>{
    const last=newest(c.id),next=last?.next_step || '',date=last?.next_step_date || '';
    const sts=activeFeatures().map(f=>stage(c.id,f.id)).filter(s=>s!=='Не требуется');
    const adopted=sts.filter(s=>s==='Перешёл').length;
    const future=launches.filter(l=>l.camp_id===c.id&&!['Отменена','Не выяснено','Перенесена'].includes(l.status)&&l.start_date>=isoToday()).sort((a,b)=>a.start_date.localeCompare(b.start_date))[0];
    const missing=launches.filter(l=>l.camp_id===c.id&&l.status!=='Отменена'&&(!l.start_date||l.status==='Не выяснено')).length;
    const warnings=[];
    if(!last||dateDiff(last.contact_date)<=-14)warnings.push('Нет работы 14+ дней');
    if(unknownProfileForCamp(c.id).length)warnings.push('Не выяснено: '+unknownProfileForCamp(c.id).length);
    if(campBlockers(c.id).length)warnings.push('Блокеры');
    const risk=campHasRisk(c.id);
    const name='<b>'+safe(c.name)+'</b>'+(c.sales_client_id?' <span class="os-pill">Sales</span>':'');
    const shift=future?safe(future.start_date)+'<div class="sub">'+safe(future.shift_name)+'</div>':missing?'Уточнить дату '+missing+' смен':'—';
    return '<tr><td><div class="camp-name">'+name+'</div></td>'+
      '<td>'+contractStatusBadge(c)+'</td><td>'+safe(owner(c))+'</td>'+
      '<td>'+safe(last?.contact_date||'Не зафиксирована')+'<div class="sub">'+safe(last?.result||last?.contact_type||'')+'</div></td>'+
      '<td>'+(next?safe(next)+'<div class="sub">'+safe(date||'Без срока')+'</div>':'<span class="sub">Не зафиксирован</span>')+'</td>'+
      '<td><strong>'+adopted+' / '+sts.length+'</strong><div class="sub">«Перешёл» / применимые</div></td>'+
      '<td>'+shift+'</td><td><span class="os-pill">'+(risk?'Требует внимания':'Нет сигналов')+'</span><div class="sub">'+safe(warnings.slice(0,2).join('; '))+'</div></td>'+
      '<td><div class="camp-actions"><button class="icon-btn" onclick="openCampModal(\''+safe(c.id)+'\')">Открыть</button><button class="icon-btn" onclick="openContactModal(\''+safe(c.id)+'\')">+ Работа</button></div></td></tr>';
  });
  $('campTableBody').innerHTML=rows.join('')||'<tr><td colspan="9" class="empty">В выбранном срезе лагерей нет. Попробуйте очистить фильтры.</td></tr>';
  const mob=list.map(c=>{
    const last=newest(c.id),next=last?.next_step;
    return '<div class="card camp-card"><div class="camp-card-head"><div><div class="camp-name">'+safe(c.name)+'</div><div class="sub">'+safe(owner(c))+' · '+safe(last?.contact_date||'Работа не зафиксирована')+'</div></div><button class="icon-btn" onclick="openCampModal(\''+safe(c.id)+'\')">Открыть</button></div>'+
      '<div class="os-fact" style="margin:11px 0">Следующий шаг<b>'+safe(next||'Не зафиксирован')+'</b><span class="sub">'+safe(last?.next_step_date||'Срок не указан')+'</span></div>'+
      '<button class="btn primary" onclick="openContactModal(\''+safe(c.id)+'\')">Зафиксировать работу</button></div>';
  });
  $('campMobile').innerHTML=mob.join('')||'<div class="os-empty">Лагерей нет</div>';
  $('campCountLabel').textContent=list.length+' лагерей';
  renderClientWorkspaceOS(list);
}
function installContacts(){
    const view=$('viewContacts');if(!view||$('osWork'))return;
    const section=document.createElement('section');section.id='osWork';section.className='os-panel';section.innerHTML='<div class="os-panel-head"><div><h3>Работа и обязательства</h3><p>Следующий шаг выводится из последней зарегистрированной работы. Выполнение отдельно не предполагается.</p></div><button class="btn primary" onclick="openContactModal()">+ Контакт</button></div><div class="os-tabs" id="osWorkTabs" role="tablist"><button class="os-tab" role="tab" data-work="steps">Следующие шаги</button><button class="os-tab" role="tab" data-work="history">История работы</button></div><div id="osWorkSteps"></div>';
    view.prepend(section);
    $('osWorkTabs').addEventListener('click',e=>{const b=e.target.closest('[data-work]');if(b){ui.workTab=b.dataset.work;renderWorkOS();}});
  }
  function renderWorkOS(){
    if(!$('osWork'))return;
    const history=ui.workTab==='history';
    $('osWorkTabs').querySelectorAll('[data-work]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.work===ui.workTab)));
    [...$('viewContacts').children].filter(x=>x.id!=='osWork').forEach(x=>x.hidden=!history);
    if(history){$('osWorkSteps').innerHTML='';return;}
    const list=activeCamps().map(c=>({c,r:newest(c.id)})).filter(x=>x.r?.next_step);
    const buckets=[['Просрочено',x=>x.r.next_step_date && x.r.next_step_date<isoToday()],
      ['Сегодня',x=>x.r.next_step_date===isoToday()],
      ['Ближайшие 7 дней',x=>x.r.next_step_date>isoToday()&&x.r.next_step_date<=addDays(isoToday(),7)],
      ['Позднее',x=>x.r.next_step_date>addDays(isoToday(),7)],
      ['Без даты',x=>!x.r.next_step_date]];
    $('osWorkSteps').innerHTML=buckets.map(([name,test])=>{
      const a=list.filter(test).sort((x,y)=>String(x.r.next_step_date||'9999').localeCompare(String(y.r.next_step_date||'9999')));
      return '<div class="os-work-group"><h3 style="font-size:13px;margin:19px 0 8px">'+name+' · '+a.length+'</h3>'+
        (a.map(x=>'<div class="os-row"><div><strong>'+safe(x.c.name)+' · '+safe(x.r.next_step_date||'дата не указана')+'</strong><span>'+safe(x.r.next_step)+' · '+safe(owner(x.c))+' · '+safe(x.r.result||x.r.contact_type||'')+'</span></div><button class="os-compact-btn" onclick="openContactModal(\''+safe(x.c.id)+'\')">Зафиксировать результат</button></div>').join('')||'<div class="os-empty">Нет шагов в этой группе</div>')+'</div>';
    }).join('');
  }
  window.os4OpenCampTab=function(id,tab){
    ui.nextModalTab=tab;
    openCampModal(id);
  };
  window.os4OpenFeatureCohort=function(fid,status,member=''){
    // Matrix totals are calculated for all *active* camps in the current RLS scope.
    // Old search / contract / profile filters must not silently shrink a clicked cohort.
    setView('camps');
    const resets=['campSearch','filterContractStatus','filterProfileField','filterProfileValue'];
    resets.forEach(id=>{if($(id))$(id).value='';});
    $('osCampSearch').value='';
    $('filterActivity').value='active';
    $('filterFeature').value=fid;
    $('filterStatus').value=status;
    if(manager())$('filterCsm').value=member;
    else $('filterCsm').value=currentProfile.id;
    ui.campView='all';
    renderCamps();
  };
  function installFeatures(){
    const view=$('viewFeatures');if(!view||$('osAdoption'))return;
    const panel=document.createElement('section');panel.id='osAdoption';panel.className='os-panel';
    panel.innerHTML='<div class="os-panel-head"><div><div class="os-eyebrow">Adoption Studio</div><h3>Внедрение — по фактическим статусам</h3><p id="osAdoptionCaption">«Перешёл» / применимые связки; «Не требуется» исключено, «Не планирует» учитывается.</p></div><button class="os-compact-btn" onclick="openFeaturesModal()">Настроить функции</button></div><div class="os-tabs" id="osAdoptionTabs"><button class="os-tab" data-adoption="matrix">По функциям</button><button class="os-tab" data-adoption="camps">По лагерям</button></div><div id="osAdoptionBody"></div>';
    view.prepend(panel);
    const rest=[...view.children].filter(x=>x!==panel);
    const details=document.createElement('details');details.className='os-legacy-section';details.innerHTML='<summary class="os-compact-btn">Дополнительные списки: использующие, внедряемые, блокеры, без работы</summary>';
    panel.after(details);rest.forEach(x=>details.append(x));
    $('osAdoptionTabs').addEventListener('click',e=>{const b=e.target.closest('[data-adoption]');if(b){ui.adoptionTab=b.dataset.adoption;renderAdoptionOS();}});
  }
  function renderAdoptionOS(){
    if(!$('osAdoptionBody'))return;
    const cs=activeCamps(),fs=activeFeatures(), denom=cs.flatMap(c=>fs.map(f=>stage(c.id,f.id))).filter(s=>s!=='Не требуется');
    const done=denom.filter(s=>s==='Перешёл').length;
    $('osAdoptionCaption').textContent=done+' из '+denom.length+' применимых связок · '+(denom.length?Math.round(done*100/denom.length)+'%':'нет применимых функций')+'. Обучение не равно фактическому переходу.';
    $('osAdoptionTabs').querySelectorAll('[data-adoption]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.adoption===ui.adoptionTab)));
    const statuses=['Не начато','Запланировано','Обучение','В работе','Перешёл','Не планирует','Не требуется'];
    if(ui.adoptionTab==='matrix'){
      $('osAdoptionBody').innerHTML='<div class="table-wrap"><table class="os-feature-matrix"><thead><tr><th>Функция</th>'+statuses.map(s=>'<th>'+s+'</th>').join('')+'</tr></thead><tbody>'+fs.map(f=>
        '<tr><td><b>'+safe(f.name)+'</b></td>'+statuses.map(st=>{
          const n=cs.filter(c=>stage(c.id,f.id)===st).length;
          return '<td><button type="button" '+(n?'':'disabled ')+'title="Показать лагеря" onclick="os4OpenFeatureCohort(\''+safe(f.id)+'\',\''+safe(st)+'\')">'+n+'</button></td>';
        }).join('')+'</tr>').join('')+'</tbody></table></div>'+(fs.length?'':'<div class="os-empty">Активных функций нет</div>');
    }else{
      $('osAdoptionBody').innerHTML=cs.map(c=>{
        const sts=fs.map(f=>({f,status:stage(c.id,f.id)})).filter(x=>x.status!=='Не требуется');
        const d=sts.filter(x=>x.status==='Перешёл').length;
        return '<div class="os-row"><div><strong>'+safe(c.name)+'</strong><span>Подтверждённых переходов: '+d+' из '+sts.length+' применимых · '+safe(owner(c))+'</span></div><button class="os-compact-btn" onclick="openCampModal(\''+safe(c.id)+'\')">Внедрение</button></div>';
      }).join('')||'<div class="os-empty">Нет доступных клиентов</div>';
    }
  }
  function installProfile(){
    const view=$('viewProfile');if(!view||$('osDiscovery'))return;
    const panel=document.createElement('section');panel.id='osDiscovery';panel.className='os-panel';
    panel.innerHTML='<div class="os-panel-head"><div><div class="os-eyebrow">Client Discovery</div><h3>Что известно о клиенте</h3><p id="osDiscoveryCaption">Активные вопросы, без искусственного health-score.</p></div><button class="os-compact-btn" onclick="openProfileFieldsModal()">Настроить вопросы</button></div><div class="os-tabs" id="osDiscoveryTabs"><button class="os-tab" data-discovery="question">По вопросу</button><button class="os-tab" data-discovery="camp">По лагерю</button></div><div id="osDiscoveryBody"></div>';
    view.prepend(panel);
    const rest=[...view.children].filter(x=>x!==panel);
    const details=document.createElement('details');details.className='os-legacy-section';details.innerHTML='<summary class="os-compact-btn">Классические карточки вопросов</summary>';panel.after(details);rest.forEach(x=>details.append(x));
    $('osDiscoveryTabs').addEventListener('click',e=>{const b=e.target.closest('[data-discovery]');if(b){ui.profileTab=b.dataset.discovery;renderDiscoveryOS();}});
  }
  function renderDiscoveryOS(){
    if(!$('osDiscoveryBody'))return;
    const cs=activeCamps(),fs=profileFields.filter(f=>f.is_active);
    const known=cs.reduce((n,c)=>n+fs.filter(f=>profileIsKnown(campProfileValue(c.id,f.id))).length,0);
    const total=cs.length*fs.length;
    $('osDiscoveryCaption').textContent='Известных ответов '+known+' из '+total+' · '+(total?Math.round(known*100/total)+'%':'нет активных вопросов или клиентов')+'. «Нет» — известный ответ.';
    $('osDiscoveryTabs').querySelectorAll('[data-discovery]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.discovery===ui.profileTab)));
    if(ui.profileTab==='camp'){$('osDiscoveryBody').innerHTML=cs.map(c=>{
      const u=fs.filter(f=>!profileIsKnown(campProfileValue(c.id,f.id)));
      return '<div class="os-row"><div><strong>'+safe(c.name)+'</strong><span>Не выяснено '+u.length+' из '+fs.length+' · '+safe(owner(c))+'</span></div><button class="os-compact-btn" onclick="openCampModal(\''+safe(c.id)+'\')">Открыть профиль</button></div>';
    }).join('')||'<div class="os-empty">Нет активных клиентов</div>';return;}
    $('osDiscoveryBody').innerHTML=fs.map(f=>{
      const yes=cs.filter(c=>campProfileValue(c.id,f.id).value_text==='Да').length;
      const no=cs.filter(c=>campProfileValue(c.id,f.id).value_text==='Нет').length;
      const unknown=cs.filter(c=>!profileIsKnown(campProfileValue(c.id,f.id))).length;
      const known=cs.length-unknown;
      const details=cs.filter(c=>!!campProfileValue(c.id,f.id).details).length;
      const button=(type,label,count)=>'<button type="button" class="os-compact-btn" onclick="os4ProfileCamps(\''+safe(f.id)+'\',\''+type+'\')" aria-label="'+safe(f.name)+' · '+label+' · '+count+' лагерей">'+label+' · '+count+'</button>';
      const tri=f.field_type==='yes_no_unknown';
      return '<div class="os-row"><div><strong>'+safe(f.name)+'</strong><span>'+safe(f.description||'')+' · С подробностями: '+details+'</span></div><div class="os-cohort-actions">'+
        (tri?button('yes','Да',yes)+button('no','Нет',no):button('known','Заполнено',known))+
        button('unknown','Не выяснено',unknown)+'</div></div>';
    }).join('')||'<div class="os-empty">Вопросы не настроены</div>';
  }
  window.os4ProfileCamps=(id,type)=>{
    const cs=activeCamps().filter(c=>{
      const v=campProfileValue(c.id,id);
      return type==='unknown'?!profileIsKnown(v):type==='known'?profileIsKnown(v):v.value_text===(type==='yes'?'Да':'Нет');
    });
    const host=$('osDiscoveryBody');if(!host)return;
    host.innerHTML='<button class="btn" id="osDiscoveryBack">← К вопросам</button><h3 style="font-size:16px">'+safe(profileFields.find(f=>f.id===id)?.name||'Вопрос')+' · '+cs.length+' лагерей</h3>'+
      cs.map(c=>'<div class="os-row"><div><strong>'+safe(c.name)+'</strong><span>'+safe(owner(c))+'</span></div><button class="os-compact-btn" onclick="openCampModal(\''+safe(c.id)+'\')">Заполнить</button></div>').join('');
    $('osDiscoveryBack').onclick=renderDiscoveryOS;
  };
  function installLaunches(){
    const view=$('viewLaunches');if(!view||$('osLaunchIntro'))return;
    const intro=document.createElement('section');intro.id='osLaunchIntro';intro.className='os-hero';
    intro.innerHTML='<div><div class="os-eyebrow">Launch Control</div><h2 style="font-size:28px">Подготовка и контроль смен</h2><p id="osLaunchNote">Готовность — только выполненные применимые контрольные точки. Без точек данных для процента нет.</p></div><div class="os-hero-actions"><button class="btn primary" onclick="openLaunchModal()">+ Запуск смены</button></div>';
    view.prepend(intro);
  }
  function renderLaunchOS(){
    const cs=new Set(activeCamps().map(c=>c.id));
    const ls=filteredLaunches().filter(l=>cs.has(l.camp_id));
    const withPoints=ls.filter(l=>checkpointsForLaunch(l.id).some(cp=>cp.status!=='Не требуется'));
    const noPoints=ls.length-withPoints.length;
    if($('osLaunchNote'))$('osLaunchNote').textContent='Смен в срезе: '+ls.length+'. С применимыми точками контроля: '+withPoints.length+'. Без точек: '+noPoints+'. Отменённые и неизвестные даты не превращаются в предстоящие старты.';
    const ready=withPoints.map(l=>window.CsmSelectors.readiness(checkpointsForLaunch(l.id)).percent).filter(x=>x!==null);
    if($('launchReadiness'))$('launchReadiness').textContent=ready.length?Math.round(ready.reduce((a,b)=>a+b,0)/ready.length)+'%':'—';
    const readyNote=$('launchReadiness')?.parentElement?.querySelector('small');
    if(readyNote)readyNote.textContent='Среднее по '+ready.length+' сменам с применимыми контрольными точками';
    const rows=$('launchList')?.querySelectorAll('.launch-row')||[];
    ls.forEach((l,i)=>{
      const row=rows[i];
      if(!row || checkpointsForLaunch(l.id).some(cp=>cp.status!=='Не требуется'))return;
      const label=row.querySelector('.readiness');if(label){label.textContent='Нет точек';label.title='Применимых контрольных точек нет';}
      const bar=row.querySelector('.launch-progress');if(bar)bar.hidden=true;
    });
  }
  function reportContextOS(){
  const cs=reportScopedCamps(),campIds=new Set(cs.map(c=>c.id));
  const from=reportDateFrom(),to=isoToday();
  const acts=contacts.filter(r=>campIds.has(r.camp_id)&&r.contact_date>=from&&r.contact_date<=to)
    .sort((a,b)=>String(b.contact_date).localeCompare(String(a.contact_date)));
  const training=acts.filter(r=>r.contact_type==='Обучение'||r.result==='Обучили').length;
  const transitions=campFeatures.filter(s=>campIds.has(s.camp_id)&&s.activated_at&&s.activated_at>=from&&s.activated_at<=to);
  const risks=cs.filter(c=>campHasRisk(c.id));
  const unknown=cs.reduce((n,c)=>n+unknownProfileForCamp(c.id).length,0);
  return {cs,campIds,from,to,acts,training,transitions,risks,unknown,worked:new Set(acts.map(r=>r.camp_id)).size,features:activeFeatures(),fields:profileFields.filter(f=>f.is_active)};
}
window.openReportFeatureCampsOS=function(fid,status){
    const selected=$('reportCsm')?.value||'';
    os4OpenFeatureCohort(fid,status,selected);
  };
  function synchronizeReportOS(){
  if(!$('viewReport'))return;
  const ctx=reportContextOS();
  const values=[ctx.worked,ctx.acts.length,ctx.training,ctx.transitions.length,ctx.risks.length,ctx.unknown];
  const elements=[...$('reportKpis').children];
  elements.slice(0,values.length).forEach((el,i)=>{
    const main=el.querySelector('b');if(main)main.textContent=values[i];
    const caption=el.querySelector('small');
    if(caption && i>=4)caption.textContent=i===4?'Текущие риски · на дату':'Неизвестные сведения · на дату';
  });
  // Include missing camp×feature links in the same exact denominator as the Adoption Studio.
  const target=$('reportFeatures');
  if(target) target.innerHTML=ctx.features.map(ft=>{
    const statuses=ctx.cs.map(c=>({c,st:stage(c.id,ft.id)}));
    const applicable=statuses.filter(x=>x.st!=='Не требуется');
    const deployed=applicable.filter(x=>x.st==='Перешёл').length;
    const inWork=applicable.filter(x=>['Запланировано','Обучение','В работе'].includes(x.st)).length;
    const pending=applicable.filter(x=>x.st!=='Перешёл').length;
    const denom=applicable.length, pct=denom?Math.round(deployed/denom*100):null;
    return '<div class="report-row"><div><div class="rr-main">'+safe(ft.name)+'</div><div class="rr-sub">'+safe(ft.description||'')+'</div></div>'+
      '<div class="report-mini"><span class="report-pill green">Перешли '+deployed+'</span><span class="report-pill yellow">Внедряем '+inWork+'</span><span class="report-pill">Ещё не перешли '+pending+'</span></div>'+
      '<div><b>'+(pct==null?'—':pct+'%')+'</b><div class="sub">'+deployed+' из '+denom+' применимых</div></div>'+
      '<div class="rr-action"><button class="btn" onclick="openReportFeatureCampsOS(\''+safe(ft.id)+'\',\'__not_deployed__\')">Лагеря</button></div></div>';
  }).join('')||'<div class="os-empty">Активных функций нет</div>';
  // The rendered list is a preview, while Excel below exports every eligible activity.
  if(ctx.acts.length>20 && $('reportWork')){
    $('reportWork').insertAdjacentHTML('beforeend','<div class="sub" style="padding:14px">На экране показаны первые 20 записей. Excel содержит все '+ctx.acts.length+' записей за период.</div>');
  }
}
function exportReportExcelOS(){
  if(typeof XLSX==='undefined')return toast('Excel-модуль не загрузился. Обновите страницу и повторите.','bad');
  const ctx=reportContextOS();
  const rows=[
    {Показатель:'Период с',Значение:ctx.from,Основание:'Фильтр аналитики'},
    {Показатель:'Период по',Значение:ctx.to,Основание:'Дата формирования'},
    {Показатель:'Лагерей в выборке',Значение:ctx.cs.length,Основание:'Текущая ответственность'},
    {Показатель:'Клиентов проработано',Значение:ctx.worked,Основание:'Уникальные лагеря с контактами за период'},
    {Показатель:'Контактов за период',Значение:ctx.acts.length,Основание:'Реальные записи работы'},
    {Показатель:'Обучений за период',Значение:ctx.training,Основание:'Тип/результат контактов'},
    {Показатель:'Активаций за период',Значение:ctx.transitions.length,Основание:'Зарегистрированные activated_at'},
    {Показатель:'Лагерей с риском',Значение:ctx.risks.length,Основание:'Текущий срез на дату'},
    {Показатель:'Не выяснено',Значение:ctx.unknown,Основание:'Текущий срез по активным вопросам'}
  ];
  const clients=ctx.cs.map(c=>{
    const last=newest(c.id);
    return {Лагерь:c.name,CSM:owner(c),'Договор':campContractStatus(c),'Номер договора':c.contract_number||'',
      'Связь Sales':c.sales_client_id?'Да':'Нет','Последняя работа':last?.contact_date||'',
      'Результат':last?.result||'','Следующий шаг':last?.next_step||'','Дата следующего шага':last?.next_step_date||'',
      'Текущий риск':campHasRisk(c.id)?'Да':'Нет','Не выяснено вопросов':unknownProfileForCamp(c.id).length};
  });
  const work=ctx.acts.map(r=>({
    Дата:r.contact_date,Лагерь:camp(r.camp_id)?.name||'',CSM:campProfile(r.csm_id).full_name||'',
    Функция:featureById(r.feature_id).name,'Тип контакта':r.contact_type,Результат:r.result||'',Комментарий:r.comment||'',
    'Следующий шаг':r.next_step||'','Дата следующего шага':r.next_step_date||''
  }));
  const adoption=ctx.cs.flatMap(c=>ctx.features.map(f=>{
    const st=campFeatures.find(x=>x.camp_id===c.id&&x.feature_id===f.id)||{};
    return {Лагерь:c.name,Функция:f.name,Статус:st.status||'Не начато','Применима':st.status==='Не требуется'?'Нет':'Да',
      'Дата обучения':st.training_date||'','Дата активации':st.activated_at||'','Причина':st.reason||'',Комментарий:st.comment||''};
  }));
  const launchesSheet=launches.filter(l=>ctx.campIds.has(l.camp_id)).map(l=>{
    const readiness=window.CsmSelectors.readiness(checkpointsForLaunch(l.id));
    return {Лагерь:camp(l.camp_id)?.name||'',Смена:l.shift_name,Старт:l.start_date||'Не выяснено',Статус:l.status,
      'Точек применимых':readiness.total,'Точек готово':readiness.done,'Готовность %':readiness.percent??'Нет точек',
      'Ближайший контроль':nextCheckpoint(l.id)?.title||''};
  });
  const discovery=ctx.cs.flatMap(c=>ctx.fields.map(f=>{
    const v=campProfileValue(c.id,f.id);
    return {Лагерь:c.name,Вопрос:f.name,Ответ:v.value_text||'Не выяснено',Подробности:v.details||''};
  }));
  const wb=XLSX.utils.book_new();
  for(const [name,data] of [['Итоги',rows],['Клиенты',clients],['Работа',work],['Внедрение',adoption],['Запуски',launchesSheet],['Профиль',discovery]]){
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.length?data:[{Состояние:'Нет данных'}]),name);
  }
  XLSX.writeFile(wb,'CampBox_CSM_Analytics_'+ctx.from+'_'+ctx.to+'.xlsx');
  closeModal();toast('Excel сформирован по контексту аналитики');
}
function installReport(){
    const view=$('viewReport');if(!view||$('osReportContext'))return;
    const head=document.createElement('section');head.id='osReportContext';head.className='os-report-context';
    head.innerHTML='<div class="os-eyebrow">Executive Briefing</div><h3>Результаты сопровождения</h3><p id="osReportCaption">Период, зона ответственности и дата актуальности.</p><div id="osReportFacts" style="margin-top:12px"></div>';
    const toolbar=view.querySelector('.report-toolbar')?.closest('section');if(toolbar)toolbar.after(head);else view.prepend(head);
  }
  function renderReportOS(){
    if(!$('osReportCaption'))return;
    const cs=reportScopedCamps(),ids=new Set(cs.map(c=>c.id)),from=reportDateFrom();
    const act=contacts.filter(r=>ids.has(r.camp_id)&&r.contact_date>=from&&r.contact_date<=isoToday());
    const unique=new Set(act.map(r=>r.camp_id)).size;
    const trainings=act.filter(r=>r.contact_type==='Обучение'||r.result==='Обучили').length;
    const activated=campFeatures.filter(s=>ids.has(s.camp_id)&&s.activated_at&&s.activated_at>=from&&s.activated_at<=isoToday()).length;
    const risk=cs.filter(c=>campHasRisk(c.id)).length;
    const mode=$('reportCsm')?.selectedOptions?.[0]?.textContent || 'Вся команда';
    $('osReportCaption').textContent=from+' — '+isoToday()+' · '+mode+' · '+cs.length+' лагерей в выборке. Дата актуальности: '+isoToday()+'. Просадки и профиль — текущий срез на дату, не события прошлого периода.';
    $('osReportFacts').innerHTML='<div class="os-grid"><div class="os-panel"><h3>Операционный результат</h3><p>За период '+act.length+' контактов с '+unique+' уникальными лагерями, '+trainings+' обучений и '+activated+' зафиксированных активаций функций.</p></div><div class="os-panel"><h3>Что требует решения</h3><p>На текущую дату '+risk+' лагерей с сигналами риска. Для проверки причины откройте расшифровку ниже. Это не исторический срез.</p></div></div>';
    // Retain existing KPI drill-down and Excel implementation; report state is passed to export UI.
  }
  function tabifyCamp(id){
    const modal=$('modalRoot')?.querySelector('.camp-edit-modal'),body=modal?.querySelector('.modal-body');
    if(!modal||!body||!id||modal.classList.contains('os-360'))return;
    modal.classList.add('os-360');modal.dataset.campId=id;
    const nodes=[...body.children], c=camp(id);if(nodes.length<14 || !c)return;
    const panes=[
      {id:'overview',label:'Обзор',nodes:[nodes[0],nodes[2]]},
      {id:'work',label:'Работа',nodes:[]},
      {id:'adoption',label:'Внедрение',nodes:[nodes[7],nodes[8]]},
      {id:'launches',label:'Смены',nodes:[nodes[10],nodes[11]]},
      {id:'profile',label:'Профиль',nodes:[nodes[4],nodes[5]]},
      {id:'history',label:'История',nodes:[nodes[13],nodes[14]]}
    ];
    const nav=document.createElement('div');nav.className='os-modal-tabset';nav.setAttribute('role','tablist');
    nav.innerHTML=panes.map(p=>'<button type="button" role="tab" aria-selected="'+(p.id==='overview')+'" data-camp-tab="'+p.id+'">'+p.label+'</button>').join('');
    modal.querySelector('.modal-head')?.after(nav);
    const nodesInPanes=new Set(panes.flatMap(p=>p.nodes));
    nodes.forEach(n=>{if(!nodesInPanes.has(n))n.remove()});
    const last=newest(id);
    panes.forEach(p=>{
      const pane=document.createElement('div');pane.className='os-tab-pane'+(p.id==='overview'?' os-selected':'');pane.dataset.pane=p.id;
      p.nodes.forEach(n=>{if(n)pane.append(n)});
      if(p.id==='overview'){
        const facts=document.createElement('div');facts.className='os-facts';facts.style.marginTop='16px';
        facts.innerHTML='<div class="os-fact">Источник клиента<b>'+(c.sales_client_id?'Связан с Sales':'Добавлен в CSM')+'</b></div><div class="os-fact">Последняя работа<b>'+safe(last?.contact_date||'Не зафиксирована')+'</b></div><div class="os-fact">Следующий шаг<b>'+safe(last?.next_step||'Не зафиксирован')+'</b></div><div class="os-fact">Ближайшая смена<b>'+safe(launches.filter(l=>l.camp_id===id&&l.start_date&&l.status!=='Отменена').sort((a,b)=>a.start_date.localeCompare(b.start_date))[0]?.start_date||'Дата не выяснена')+'</b></div>';
        pane.append(facts);
      }
      if(p.id==='work'){
        const wrap=document.createElement('div');
        wrap.innerHTML='<div class="os-panel-head"><div><h3>Следующее действие</h3><p>Фиксируем реальный контакт, не создаём фиктивные завершения задач</p></div><button class="btn primary" onclick="closeModal();openContactModal(\''+safe(id)+'\')">+ Записать работу</button></div><div class="os-fact">Согласно последней работе<b>'+safe(last?.next_step||'Не зафиксировано')+'</b><div class="sub">'+safe(last?.next_step_date||'Срок не указан')+'</div></div>';
        pane.append(wrap);
      }
      body.append(pane);
    });
    nav.addEventListener('click',e=>{
      const b=e.target.closest('[data-camp-tab]');if(!b)return;
      const current=b.dataset.campTab;
      nav.querySelectorAll('[data-camp-tab]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));
      body.querySelectorAll('.os-tab-pane').forEach(x=>x.classList.toggle('os-selected',x.dataset.pane===current));
      body.scrollTop=0;
    });
    if(ui.nextModalTab){
      const selected=nav.querySelector('[data-camp-tab="'+ui.nextModalTab+'"]');
      ui.nextModalTab='';
      if(selected)selected.click();
    }
    const mark=()=>{modal.dataset.dirty='true';const save=modal.querySelector('.camp-modal-head-actions .btn.primary');if(save)save.textContent='Сохранить изменения';};
    body.addEventListener('input',mark);body.addEventListener('change',mark);
    // Stop chained inline navigation when a dirty workspace was not confirmed.
    modal.addEventListener('click', event=>{
      const trigger=event.target.closest('button[onclick]');
      const action=trigger?.getAttribute('onclick')||'';
      if(modal.dataset.dirty!=='true'||!action.includes('closeModal();'))return;
      if(!window.confirm('Есть несохранённые изменения. Перейти без сохранения?')){
        event.preventDefault();event.stopImmediatePropagation();return;
      }
      modal.dataset.dirty='false';
    },true);

    // Existing sticky save triggers the same source-of-truth saveCamp operation.
  }
  function enhanceModal(){
    const modal=$('modalRoot')?.querySelector('.camp-edit-modal');
    if(!modal)return;
    const id=modal.querySelector('[onclick^="saveCamp"]')?.getAttribute('onclick')?.match(/saveCamp\('([^']+)'\)/)?.[1];
    if(id)tabifyCamp(id);
  }
  function interceptReportExport(){
    if(currentView!=='report')return;
    const from=$('exFrom'),to=$('exTo'),csm=$('exCsm'),src=$('reportCsm');
    if(from)from.value=reportDateFrom();if(to)to.value=isoToday();
    if(csm && src)csm.value=src.value;
    const feature=$('exFeature'),overdue=$('exOverdue');
    if(feature){feature.value='';feature.disabled=true;}
    if(overdue){overdue.checked=false;overdue.disabled=true;}

    const form=from?.closest('.modal-body');if(form)form.insertAdjacentHTML('afterbegin','<p class="sub">Значения периода и CSM перенесены из текущей аналитики. Состав Excel включает существующие отдельные листы и фильтры.</p>');
  }
  const previous={
    setView:window.setView,showApp:window.showApp,renderDashboard:window.renderDashboard,
    renderCamps:window.renderCamps,renderContacts:window.renderContacts,
    renderFeatureWorkspace:window.renderFeatureWorkspace,renderProfileDashboard:window.renderProfileDashboard,
    renderLaunches:window.renderLaunches,renderWorkReport:window.renderWorkReport,
    openCampModal:window.openCampModal,closeModal:window.closeModal,
    saveCamp:window.saveCamp,openExportModal:window.openExportModal,exportExcel:window.exportExcel
  };
  let saving=false;
  window.setView=function(v){
    const value=previous.setView(v);
    const title={dashboard:'Пульт',camps:'Клиенты',contacts:'Работа',launches:'Смены',features:'Внедрение',profile:'Знание о клиенте',report:'Аналитика'};
    if($('viewTitle') && title[v])$('viewTitle').textContent=title[v];
    return value;
  };
  window.showApp=function(){const r=previous.showApp();layout();renderDashboardOS();renderManagerOS();return r;};
  window.renderDashboard=function(){const r=previous.renderDashboard();renderDashboardOS();renderManagerOS();organizeLegacyDashboardOS();return r;};
  window.renderCamps=function(){const r=previous.renderCamps();renderCampsOS();return r;};
  window.renderContacts=function(){const r=previous.renderContacts();renderWorkOS();return r;};
  window.renderFeatureWorkspace=function(){const r=previous.renderFeatureWorkspace();renderAdoptionOS();return r;};
  window.renderProfileDashboard=function(){const r=previous.renderProfileDashboard();renderDiscoveryOS();return r;};
  window.renderLaunches=function(){const r=previous.renderLaunches();renderLaunchOS();renderLaunchCalendarOS();return r;};
  window.renderWorkReport=function(){const r=previous.renderWorkReport();renderReportOS();synchronizeReportOS();renderReportChartsOS();return r;};
  window.openCampModal=function(id){const r=previous.openCampModal(id);enhanceModal();return r;};
  window.closeModal=function(){
    const modal=$('modalRoot')?.querySelector('.camp-edit-modal.os-360');
    if(!saving && modal?.dataset.dirty==='true' && !window.confirm('Есть несохранённые изменения. Закрыть карточку без сохранения?'))return false;
    return previous.closeModal();
  };
  window.saveCamp=async function(id){saving=true;try{return await previous.saveCamp(id)}finally{saving=false;}};
  window.openExportModal=function(){const r=previous.openExportModal();interceptReportExport();return r;};
  window.exportExcel=function(){return currentView==='report'?exportReportExcelOS():previous.exportExcel();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',layout);else layout();
})();