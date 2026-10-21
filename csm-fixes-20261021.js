(function csmHubFixes() {
  'use strict';
  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const liveCamps = () => csmScopeCamps();
  const featureState = (campId, featureId) => campFeatures.find(s => s.camp_id === campId && s.feature_id === featureId)?.status || 'Не начато';
  const inProgress = status => ['Запланировано','Обучение','В работе'].includes(status);
  const notDeployed = status => status !== 'Перешёл' && status !== 'Не требуется';

  // 1. Preserve values in all filters when loadAll/saveCamp/refreshCsmData rebuild option lists.
  const previousFillFilters = window.fillFilters;
  window.fillFilters = function() {
    const ids = ['filterActivity','filterContractStatus','filterCsm','filterFeature','filterStatus','filterProfileField','filterProfileValue','campSearch','contactCampFilter','contactCsmFilter','contactFeatureFilter','contactPeriod','launchCampFilter','launchCsmFilter','launchStatusFilter','launchPeriodFilter'];
    const saved = Object.fromEntries(ids.map(id => [id, byId(id)?.value]));
    previousFillFilters();
    const statusSelect = byId('filterStatus');
    if (statusSelect && !statusSelect.querySelector('option[value="__not_deployed__"]')) {
      const missing = document.createElement('option'); missing.value = '__not_deployed__'; missing.textContent = 'Ещё не выкатили'; statusSelect.appendChild(missing);
      const ongoing = document.createElement('option'); ongoing.value = '__in_progress__'; ongoing.textContent = 'Внедряем'; statusSelect.appendChild(ongoing);
    }
    ids.forEach(id => {
      const element = byId(id), oldValue = saved[id];
      if (element && oldValue != null && (element.tagName === 'INPUT' || Array.from(element.options || []).some(o => o.value === oldValue))) {
        element.value = oldValue;
      }
    });
    if (!isManager()) {
      for (const id of ['filterCsm','contactCsmFilter','launchCsmFilter']) {
        const select = byId(id);
        if (select) { select.value = currentProfile.id; select.disabled = true; }
      }
    }
  };

  // 2. Every active function exists for every client; missing rows mean 'Не начато'.
  // Feature selection defaults to 'Перешёл' so it actually narrows the list.
  function matchesStatus(status, wanted) {
    return !wanted || (wanted === '__not_deployed__' ? notDeployed(status) :
      wanted === '__in_progress__' ? inProgress(status) : status === wanted);
  }
  window.filteredCamps = function() {
    const activity = byId('filterActivity')?.value || 'active';
    const contract = byId('filterContractStatus')?.value || '';
    const query = (byId('campSearch')?.value || '').trim().toLocaleLowerCase('ru-RU');
    const csm = byId('filterCsm')?.value || '';
    const fid = byId('filterFeature')?.value || '';
    const st = byId('filterStatus')?.value || '';
    const pfid = byId('filterProfileField')?.value || '';
    const pv = byId('filterProfileValue')?.value || '';
    const activeFeatureIds = new Set(features.filter(f => f.is_active).map(f => f.id));
    return camps.filter(c => {
      const cpv = pfid ? campProfileValue(c.id,pfid) : null;
      const profileOk = !pfid || !pv || (pv === 'Заполнено' ? profileIsKnown(cpv) :
        pv === 'Не выяснено' ? !profileIsKnown(cpv) : cpv?.value_text === pv);
      const featureOk = fid
        ? activeFeatureIds.has(fid) && matchesStatus(featureState(c.id,fid),st)
        : !st || Array.from(activeFeatureIds).some(id => matchesStatus(featureState(c.id,id),st));
      return (activity === 'all' || (activity === 'archived' ? !c.active : !!c.active)) &&
        (!query || c.name.toLocaleLowerCase('ru-RU').includes(query)) &&
        (!contract || campContractStatus(c) === contract) &&
        (!csm || (csm === '__unassigned__' ? !c.responsible_id : c.responsible_id === csm)) &&
        featureOk && profileOk;
    });
  };
  const filterFeature = byId('filterFeature');
  if (filterFeature) filterFeature.addEventListener('change', () => {
    const status = byId('filterStatus');
    if (status) status.value = filterFeature.value ? 'Перешёл' : '';
    renderCamps();
  });

  // 3. Feature cards expose both deployed and pending client lists.
  window.openFeatureCamps = function(featureId, status = 'Перешёл') {
    setView('camps');
    byId('filterFeature').value = featureId;
    byId('filterStatus').value = status;
    renderCamps();
  };
  window.renderFeatureCards = function() {
    const box = byId('featureCards');
    if (!box) return;
    const cs = liveCamps();
    box.innerHTML = features.filter(f => f.is_active).map(f => {
      const states = cs.map(c => ({camp:c,status:featureState(c.id,f.id)})).filter(s => s.status !== 'Не требуется');
      const deployed = states.filter(s => s.status === 'Перешёл').length;
      const pending = states.filter(s => notDeployed(s.status)).length;
      const work = states.filter(s => inProgress(s.status)).length;
      const pct = states.length ? Math.round(100 * deployed / states.length) : 0;
      const fid = escapeHtml(f.id);
      return '<div class="card feature-card"><div class="feature-card-head"><div><h3>'+escapeHtml(f.name)+'</h3><p>'+escapeHtml(f.description || '')+'</p></div>'+
        '<div style="text-align:right"><div class="feature-pct">'+pct+'%</div><div class="sub">уже используют</div></div></div>'+
        '<div class="progress"><span style="width:'+pct+'%"></span></div>'+
        '<div class="feature-meta"><div class="mini"><span>Используют</span><b>'+deployed+'/'+states.length+'</b></div>'+
        '<div class="mini"><span>Внедряем</span><b>'+work+'</b></div>'+
        '<div class="mini"><span>Ещё не выкатили</span><b>'+pending+'</b></div></div>'+
        '<div class="csm-detail-actions"><button type="button" class="btn" onclick="openFeatureCamps(&quot;'+fid+'&quot;,&quot;Перешёл&quot;)">Выкатили ('+deployed+')</button>'+
        '<button type="button" class="btn" onclick="openFeatureCamps(&quot;'+fid+'&quot;,&quot;__not_deployed__&quot;)">Ещё не выкатили ('+pending+')</button>'+
        '<button type="button" class="btn" onclick="openFeatureCamps(&quot;'+fid+'&quot;,&quot;&quot;)">Все лагеря</button></div></div>';
    }).join('') || '<div class="empty">Фичи ещё не добавлены.</div>';
  };

  // 4. Questions: reveal all answered/not answered camps, not only missing values.
  window.openProfileAnswers = function(fieldId, kind) {
    const field = profileFieldById(fieldId);
    if (!field?.id) return;
    const matches = liveCamps().filter(c => {
      const v = campProfileValue(c.id,fieldId);
      return kind === 'unknown' ? !profileIsKnown(v) :
        kind === 'known' ? profileIsKnown(v) : v.value_text === kind;
    });
    const label = kind === 'unknown' ? 'Не выяснено' : kind === 'known' ? 'Заполнено' : kind;
    modal('<div class="modal" style="max-width:770px"><div class="modal-head"><div><h3>'+escapeHtml(field.name)+'</h3><div class="sub">'+escapeHtml(label)+' · '+matches.length+' лагерей</div></div>'+
      '<button class="icon-btn" onclick="closeModal()">✕</button></div><div class="modal-body"><div class="history">'+
      (matches.map(c => {
        const v = campProfileValue(c.id,fieldId);
        return '<div class="history-item csm-detail-row"><div><b>'+escapeHtml(c.name)+'</b><div class="sub">'+escapeHtml(campProfile(c.responsible_id).full_name || 'Без CSM')+
          ' · '+escapeHtml(v.value_text || 'Не выяснено')+'</div>'+(v.details ? '<div>'+escapeHtml(v.details)+'</div>' : '')+'</div>'+
          '<button type="button" class="btn" onclick="closeModal();openCampModal(&quot;'+escapeHtml(c.id)+'&quot;)">Открыть</button></div>';
      }).join('') || '<div class="empty">Лагерей с таким ответом нет.</div>')+'</div></div></div>');
  };
  window.openProfileUnknown = fieldId => openProfileAnswers(fieldId, 'unknown');
  window.renderProfileDashboard = function() {
    const box = byId('profileCards');
    if (!box) return;
    const cs = liveCamps();
    box.innerHTML = profileFields.filter(f => f.is_active).map(f => {
      const vals = cs.map(c => campProfileValue(c.id,f.id));
      const known = vals.filter(profileIsKnown).length;
      const pct = cs.length ? Math.round(100 * known / cs.length) : 0;
      const fid = escapeHtml(f.id);
      const btn = (label, kind, count) => '<button type="button" class="btn" onclick="openProfileAnswers(&quot;'+fid+'&quot;,&quot;'+kind+'&quot;)">'+label+' ('+count+')</button>';
      const stats = f.field_type === 'yes_no_unknown'
        ? btn('Да','Да',vals.filter(v => v.value_text === 'Да').length)+btn('Нет','Нет',vals.filter(v => v.value_text === 'Нет').length)+btn('Не выяснено','unknown',cs.length-known)
        : btn('Заполнено','known',known)+btn('Не выяснено','unknown',cs.length-known);
      return '<div class="profile-card"><div class="profile-card-head"><div><h3>'+escapeHtml(f.name)+'</h3><p>'+escapeHtml(f.description || '')+'</p></div>'+
        '<div class="profile-coverage">'+pct+'%</div></div><div class="csm-detail-actions">'+stats+'</div></div>';
    }).join('') || '<div class="empty">Вопросы для клиента ещё не добавлены.</div>';
  };

  // 5. Make all six report KPI cards expandable, showing the exact client set for each.
  let selectedReportMetric = null;
  const originalReport = window.renderWorkReport;
  window.renderWorkReport = function() {
    originalReport();
    const holder = byId('reportKpis');
    if (!holder) return;
    const keys = ['worked','activities','trainings','activations','risks','unknown'];
    Array.from(holder.children).forEach((card,i) => {
      const key = keys[i];
      if (!key) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = card.className + ' csm-report-kpi-btn';
      button.innerHTML = card.innerHTML;
      button.setAttribute('aria-expanded',String(selectedReportMetric === key));
      button.setAttribute('aria-label',card.textContent.trim()+'. Показать лагеря');
      button.addEventListener('click',() => {
        selectedReportMetric = selectedReportMetric === key ? null : key;
        renderWorkReport();
      });
      card.replaceWith(button);
    });
    if (!selectedReportMetric) return;
    const cs = reportScopedCamps();
    const ids = new Set(cs.map(c => c.id));
    const from = reportDateFrom();
    const acts = contacts.filter(r => ids.has(r.camp_id) && r.contact_date >= from);
    const trainingActs = acts.filter(x => x.contact_type === 'Обучение' || x.result === 'Обучили');
    const activationStates = campFeatures.filter(x => ids.has(x.camp_id) && x.activated_at && x.activated_at >= from);
    const metric = selectedReportMetric;
    const rows = cs.map(c => {
      let count = 0, detail = '';
      if (metric === 'worked' || metric === 'activities') {
        count = acts.filter(a => a.camp_id === c.id).length;
        detail = 'Активностей: '+count;
      } else if (metric === 'trainings') {
        count = trainingActs.filter(a => a.camp_id === c.id).length;
        detail = 'Обучений: '+count;
      } else if (metric === 'activations') {
        const list = activationStates.filter(a => a.camp_id === c.id);
        count = list.length;
        detail = 'Выкатили: '+list.map(a => featureById(a.feature_id).name).join(', ');
      } else if (metric === 'risks') {
        count = campHasRisk(c.id) ? 1 : 0;
        detail = 'Требует внимания';
      } else {
        const unknown = unknownProfileForCamp(c.id);
        count = unknown.length;
        detail = 'Не выяснено: '+unknown.slice(0,4).map(f => f.name).join(', ')+(unknown.length > 4 ? ' и ещё '+(unknown.length-4) : '');
      }
      return {camp:c,count,detail};
    }).filter(r => r.count > 0).sort((a,b)=> b.count-a.count || a.camp.name.localeCompare(b.camp.name,'ru'));
    const labels = {worked:'Клиенты, с которыми работали',activities:'Активности по клиентам',trainings:'Обучения по клиентам',activations:'Активации по клиентам',risks:'Лагеря с просадками',unknown:'Невыясненные вопросы по клиентам'};
    const panel = document.createElement('div');
    panel.id = 'reportKpiDrill';
    panel.className = 'card csm-report-kpi-drill';
    panel.innerHTML = '<div class="section-head"><div><h2>'+labels[metric]+'</h2><p>'+rows.length+' уникальных лагерей за выбранный срез</p></div>'+
      '<button type="button" class="btn" id="reportDrillClose">Свернуть</button></div><div class="section-body">'+
      (rows.map(r => '<div class="report-row"><div><div class="rr-main">'+escapeHtml(r.camp.name)+'</div><div class="rr-sub">'+escapeHtml(campProfile(r.camp.responsible_id).full_name || 'Без CSM')+
        '</div></div><div style="grid-column:2/4">'+escapeHtml(r.detail)+'</div><div class="rr-action"><button type="button" class="btn" onclick="openCampModal(&quot;'+escapeHtml(r.camp.id)+'&quot;)">Открыть</button></div></div>').join('') || '<div class="empty">Лагерей по этому показателю нет.</div>')+
      '</div>';
    holder.appendChild(panel);
    byId('reportDrillClose').addEventListener('click',() => { selectedReportMetric = null; renderWorkReport(); });
  };

  // Demo reflects contract number changes; production writes remain via guarded Supabase RPC.
  const originalSaveCamp = window.saveCamp;
  window.saveCamp = async function(id) {
    if (DEMO && id) {
      const c = campById(id);
      c.contract_number = byId('campContractNumberEdit')?.value.trim() || null;
      c.renewal_review_date = byId('campRenewalReviewDate')?.value || null;
    }
    return originalSaveCamp(id);
  };

  const css = document.createElement('style');
  css.textContent = '.csm-detail-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.csm-detail-row{display:flex;justify-content:space-between;gap:14px;align-items:center}.csm-report-kpi-btn{text-align:left;font:inherit;cursor:pointer;width:100%;color:inherit}.csm-report-kpi-btn[aria-expanded="true"]{outline:2px solid var(--cyan);outline-offset:0}.csm-report-kpi-btn:focus-visible,.csm-detail-actions button:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}.csm-report-kpi-drill{grid-column:1/-1;width:100%}.csm-report-kpi-drill .section-body{max-height:460px;overflow:auto}.csm-report-kpi-drill .report-row{grid-template-columns:1.1fr 1.6fr auto}@media(max-width:650px){.csm-report-kpi-drill .report-row{display:flex;flex-wrap:wrap}.csm-detail-row{align-items:flex-start;flex-direction:column}}';
  document.head.appendChild(css);
})();
