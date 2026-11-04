/* =====================================================================
   HAKKU 5.0 — app.js part 3: harness orchestration + VIEW 2 (vault)
   ===================================================================== */
"use strict";

/* ---------------- orchestrator: POST /api/harness/discover ---------------- */
async function runHarness(userMessage, profile) {
  if (S.busy) { toast(T('toast_busy'), true); return; }
  S.busy = true;
  const btn = $('submitBtn'); const status = $('calcStatus');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }
  if (status) status.classList.remove('hidden');
  const t0 = performance.now();
  try {
    const prechecks = readForensicChecks();
    const data = await securePost('/api/harness/discover', { userMessage, currentProfile: profile, householdMembers: S.household || [], readinessChecks: prechecks, language: S.lang });
    S.netLatency = Math.round(performance.now() - t0);

    S.profile = data.profile || profile;
    S.matched = data.matchedSchemes || [];
    S.catalog = data.allCatalogSchemes || [];
    S.resultMeta = {
      totalDirectAnnualINR: data.totalDirectAnnualINR || 0,
      fiveYearWealthINR: data.fiveYearWealthINR || 0,
      totalHealthCoverINR: data.totalHealthCoverINR || 500000,
      schemeCount: data.schemeCount || S.matched.length,
      hiddenGemsCount: data.hiddenGemsCount || 0,
      totalCatalogCount: data.totalCatalogCount || S.catalog.length,
      consolidatedDocuments: data.consolidatedDocuments || [],
      statutoryConflictsResolved: data.statutoryConflictsResolved || [],
      readinessAudit: data.readinessAudit || { readinessScore: 100, rejectionRisks: [] },
      readinessChecks: prechecks,
      notifications: data.notifications || [],
      prerequisiteSequence: data.prerequisiteSequence || [],
      lifeEventBundles: data.lifeEventBundles || [],
      aiSummary: data.aiSummary || null,
      agentTrace: data.agentTrace || null
    };
    S.filter = 'ALL'; S.searchQ = ''; S.sortBy = 'value_desc';
    renderSchemes();
  } catch (err) {
    toast(T('toast_err'), true);
  } finally {
    S.busy = false;
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    if (status) status.classList.add('hidden');
  }
}
const BUNDLE_MAP = { BUNDLE_COLLEGE: 'ananya', BUNDLE_FARM_UPGRADE: 'ramesh', BUNDLE_WIDOW_EMERGENCY: 'lakshmi', BUNDLE_WORKER_UPGRADE: 'kiran' };
function selectBundleAndSearch(bundleId) {
  if (bundleId === 'BUNDLE_MATERNITY_BIRTH') {
    const maternity = { name: 'Pooja Devi', age: 24, gender: 'female', state: 'karnataka', occupation: 'homemaker', income: 90000, category: 'OBC', rationCard: 'BPL', bankType: 'regular', land: 'landless', isStudent: false, isWidow: false, isTaxPayer: false };
    runHarness('', maternity);
    return;
  }
  const personaId = BUNDLE_MAP[bundleId];
  if (personaId && PERSONAS[personaId]) { fillPreset(personaId); runHarness('', PERSONAS[personaId].profile); }
}
function readForensicChecks() {
  const fk = id => { const el = document.querySelector(`[data-fk="${id}"]`); return el ? el.classList.contains('on') : false; };
  return {
    npciSeeded: fk('fkNpci'),
    nameMatchAadhaar: fk('fkName'),
    validRdCert: fk('fkRd'),
    mergedHousehold: fk('fkMerged'),
    w10Available: fk('fkW10'),
    bankAccountType: (S.bankPick || 'regular') === 'pmjdy' ? 'pmjdy' : 'regular'
  };
}

/* ---------------- live gazette marquee ---------------- */
function gazChipClass(status) {
  return status === 'NEW' ? 'gaz-new' : status === 'ENDING_2_DAYS' ? 'gaz-ending' : status === 'EXPIRED_TODAY' ? 'gaz-expired' : 'gaz-active';
}
function buildMarquee(notifs) {
  const track = $('marqueeTrack'); if (!track) return;
  const items = (notifs || []).map(n => {
    const short = String(n.name || '').split('(')[0].trim();
    return `<button class="gaz-item" onclick="openSchemeDetail('${esc(n.id)}')">
      <span class="gaz-chip ${gazChipClass(n.status)}">${esc(n.status || 'ACTIVE')}</span>
      <span><b>${esc(short)}</b> — ${esc(String(n.label || '').replace(/^[⏳🔴🟢✅]\s*/, ''))}</span>
      <span class="text-[#A8A29E]">•</span>
    </button>`;
  }).join('');
  track.innerHTML = items + items; /* duplicated for seamless -50% loop */
}

/* ---------------- helpers ---------------- */
function shortName(s) { return String(s && s.name || '').split('(')[0].trim(); }
function occAbbr(o) { return ({ student: 'STUD', farmer: 'FARM', worker: 'WORK', artisan: 'ARTI', vendor: 'VEND', unemployed: 'UNEMP', homemaker: 'HOME', senior: 'SNR' })[o] || String(o || '').toUpperCase().slice(0, 4); }
function buildFingerprint(p) {
  if (!p) return '—';
  return [(p.state || 'KA').toUpperCase().slice(0, 2), (p.gender || 'A').charAt(0).toUpperCase(), String(p.age || ''), (p.category || '').toUpperCase(),
    'INR' + (Number(p.income) === 0 ? '0' : Number(p.income) >= 100000 ? Math.round(p.income / 100000) + 'L' : Math.round(p.income / 1000) + 'k'),
    occAbbr(p.occupation), (p.rationCard || 'NONE').toUpperCase(), (p.bankType || 'regular') === 'pmjdy' ? 'JDY' : 'SAV',
    S.resultMeta && S.resultMeta.readinessChecks && S.resultMeta.readinessChecks.npciSeeded ? 'NPCIV' : 'NPCIX'].join('·');
}
function findCatalogByName(name) {
  return (S.catalog || []).find(c => String(c.name || '').trim() === String(name || '').trim()) || null;
}
function oneTimeCapital() {
  const list = (S.matched || []).filter(s => /one[- ]time|laptop|solar|BOCW|capital|grant/i.test((s.benefitType || '') + ' ' + (s.payoutTag || '')));
  return { sum: list.reduce((a, s) => a + (Number(s.annualValueINR) || 0), 0), names: list.slice(0, 3).map(shortName) };
}

/* ---------------- VIEW 2: entitlement vault ---------------- */
function renderSchemes() {
  const main = $('mainStage');
  if (!S.resultMeta) { backToIntake(); return; }
  showPills('schemes');
  S.view = 'schemes';
  const meta = S.resultMeta;
  const readiness = meta.readinessAudit.readinessScore;
  const risks = meta.readinessAudit.rejectionRisks || [];
  const conflicts = meta.statutoryConflictsResolved || [];
  const gemsList = S.matched.filter(s => s.isHiddenGem).slice(0, 3);
  const ot = oneTimeCapital();
  const runDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const runTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const seqDays = (meta.prerequisiteSequence || []).reduce((a, ph) => {
    const m = String(ph.timing || '').match(/(\d+)\s*$/); return Math.max(a, m ? Number(m[1]) : a);
  }, 0) || 11;

  main.innerHTML = `
  <section id="view-schemes" class="space-y-6 view-enter">

    <!-- greeting + fingerprint -->
    <div class="sv-card p-5 rise-in flex flex-wrap items-center gap-3">
      <div class="mr-auto min-w-0">
        <div class="flex flex-wrap items-center gap-2.5">
          <h2 class="font-display font-black text-[#0A2540] text-[24px] tracking-tight">${esc(T('namaste'))} <span class="text-[#1E3A5F]">${esc(S.profile.name || '')}</span></h2>
          <span class="stamp stamp-emerald !py-1 text-[12px]">✓ ${esc(T('profile_matched'))}</span>
          <span class="stamp stamp-sky !py-1 text-[12px]">${esc(String(S.profile.state || '').toUpperCase())} / ${esc(T('jur_central'))}</span>
        </div>
        <p class="mono text-[12px] text-slate-500 mt-1.5 truncate">${esc(T('fingerprint_label'))} · ${esc(buildFingerprint(S.profile))} · ${esc(T('harness_run'))} ${esc(runDate)} · ${esc(runTime)} IST · ${meta.totalCatalogCount} ${esc(T('statutes_scanned'))}</p>
      </div>
      <div class="flex gap-2">
        <button class="btn-ghost px-4 py-2 text-[14px]" onclick="backToIntake()">← ${esc(T('edit_particulars'))}</button>
        <button class="btn-primary px-4 py-2 text-[14px]" onclick="printBundleManifest()">🖨 ${esc(T('bundle_slips'))}</button>
      </div>
    </div>

    <!-- sovereign 3-tile bento -->
    <div class="grid md:grid-cols-3 gap-4">
      <div class="bento-main p-5 pop-stagger">
        <p class="mono text-[11px] tracking-[0.16em] text-[#93C5FD] font-bold uppercase">${esc(T('dbt_year'))}</p>
        <div class="font-display font-black text-[40px] leading-none mt-2" id="dbtCounter">${inr(meta.totalDirectAnnualINR)}</div>
        <p class="text-[13.5px] text-white/70 mt-1.5">${ot.sum ? '+ ' + inr(ot.sum) + ' ' + esc(T('one_time_capital')) + ' (' + esc(ot.names.join(', ')) + ')' : esc(T('dbt_year_sub'))}</p>
        <div class="h-px my-4" style="background:rgba(255,255,255,.14)"></div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <p class="mono text-[10.5px] tracking-[0.14em] text-white/50 uppercase">${esc(T('five_year'))}</p>
            <div class="font-display font-extrabold text-[22px] mt-1">${inr(meta.fiveYearWealthINR)}</div>
            <p class="mono text-[11px] text-white/45">@ 0% leakage</p>
          </div>
          <div>
            <p class="mono text-[10.5px] tracking-[0.14em] text-white/50 uppercase">${esc(T('unlocked'))}</p>
            <div class="font-display font-extrabold text-[22px] mt-1">${meta.schemeCount}</div>
            <p class="mono text-[11px] text-white/45">${esc(T('of_catalog'))} ${meta.totalCatalogCount}</p>
          </div>
        </div>
        <div class="mt-4 inline-flex items-center gap-2 border border-emerald-400/50 rounded-xl px-3 py-1.5" style="background:rgba(16,185,129,.12)">
          <span class="font-bold text-emerald-300">+${inr(meta.totalHealthCoverINR)}</span>
          <span class="text-[12.5px] text-white/80">${esc(T('shield'))} <span class="mono text-[10.5px] text-white/50">PM-JAY</span></span>
        </div>
      </div>

      <div class="bento-white p-5">
        <span class="stamp stamp-ochre !py-1 text-[12px]">💎 ${esc(T('gems'))}</span>
        <div class="flex items-end gap-2 mt-2.5">
          <span class="font-display font-black text-[36px] leading-none text-[#B45309]" id="gemCount">${meta.hiddenGemsCount}</span>
          <span class="text-[13.5px] text-[#B45309]/80 mb-1">${esc(T('gems_unlocked'))}</span>
        </div>
        <p class="mono text-[10.5px] tracking-[0.14em] text-[#D97706] uppercase mt-4">${esc(T('gems_why'))}</p>
        <ul class="mt-2 space-y-2 text-[13.5px] text-slate-700" style="line-height:1.5">
          ${gemsList.map((g, i) => `<li class="flex gap-2.5"><span class="mono text-[11px] text-[#D97706] font-bold pt-0.5">${String(i + 1).padStart(2, '0')}</span><span><b>${esc(shortName(g))}</b> — ${esc(g.channel ? g.channel.channelName : T('gems_counter_only'))}</span></li>`).join('') || `<li class="text-slate-500">—</li>`}
        </ul>
        <p class="mono text-[11.5px] text-[#B45309]/70 mt-3">${esc(T('gems_foot'))}</p>
      </div>

      <div class="bento-white p-5">
        <div class="flex items-center justify-between">
          <p class="mono-label">${esc(T('ready'))}</p>
          <span class="stamp ${readiness >= 80 ? 'stamp-emerald' : 'stamp-ochre'} !py-1 text-[11.5px]">${esc(T('fix_risks'))}</span>
        </div>
        <div class="flex items-end gap-2 mt-2">
          <span class="font-display font-black text-[36px] leading-none ${readiness >= 80 ? 'text-[#166534]' : readiness >= 55 ? 'text-[#B45309]' : 'text-[#991B1B]'}" id="readyScore">${readiness}%</span>
          <span class="text-[13px] text-slate-500 mb-1">${risks.length} ${esc(T('risks_sub'))}</span>
        </div>
        <div class="h-2 rounded-full bg-[#F1F5F9] overflow-hidden mt-3 border border-[#E2E8F0]">
          <div class="h-full rounded-full transition-all duration-1000" style="width:${readiness}%; background:${readiness >= 80 ? '#10B981' : readiness >= 55 ? '#D97706' : '#DC2626'}"></div>
        </div>
        <div class="mt-3 space-y-2 max-h-56 overflow-auto pr-1">
          ${risks.length ? risks.map(r => `
            <div class="rounded-xl border p-2.5 text-[13px] leading-relaxed ${r.severity === 'CRITICAL' ? 'stamp-crimson' : r.severity === 'HIGH' ? 'stamp-ochre' : 'stamp-sky'}" style="line-height:1.5">
              <b>${esc(r.title)}</b><br/><span class="opacity-80">${esc(T('fix_word'))}: ${esc(r.fix || '')}</span>
            </div>`).join('') : `<div class="stamp stamp-emerald text-[13px]">${esc(T('risks_none'))}</div>`}
        </div>
      </div>
    </div>

    <!-- conflict banner -->
    ${conflicts.length ? `
    <div class="conflict-banner px-5 py-3.5 flex flex-wrap items-center gap-3 rise-in">
      <span class="w-6 h-6 rounded-full bg-[#10B981] text-white flex items-center justify-center text-[13px] flex-none">✔</span>
      <p class="text-[14px] font-semibold flex-1 min-w-0">${esc(T('kept_word'))} <b>${esc(shortName({ name: conflicts[0].kept }))}</b> ${esc(conflictValue(conflicts[0].kept))} ${esc(T('over_word'))} <s class="opacity-70">${esc(shortName({ name: conflicts[0].dropped }))}</s> ${esc(conflictValue(conflicts[0].dropped))} — ${esc(String(conflicts[0].rule).split(':')[0])}. ${esc(T('applied_auto'))}</p>
      <span class="stamp stamp-emerald !py-1 text-[11.5px] whitespace-nowrap">${conflicts.length} ${esc(T('conflicts_chip'))}</span>
    </div>` : ''}

    <!-- prerequisite sequencer -->
    <div class="sv-card p-5 reveal">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2.5">
          <span class="num-chip">📎</span>
          <span class="mono-label">${esc(T('sequencer'))}</span>
        </div>
        <span class="mono-label dim">${seqDays} ${esc(T('days_end'))}</span>
      </div>
      <div class="grid md:grid-cols-3 gap-3 mt-4">
        ${(meta.prerequisiteSequence || []).slice(0, 3).map((ph, i) => `
          <div class="seq-node seq-card p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="stamp stamp-sky !py-0.5 text-[11px]">${esc(T('phase_word'))} ${'ABC'[i] || i + 1}</span>
              <span class="mono text-[11px] text-slate-400 uppercase">${esc((ph.timing || '').toUpperCase())}</span>
            </div>
            <p class="font-bold text-[14.5px] text-[#0A2540] leading-snug">${esc(ph.action || '')}</p>
            <p class="text-[12.5px] text-slate-500 mt-1" style="line-height:1.55">${esc(ph.details || '')}</p>
          </div>`).join('')}
      </div>
    </div>

    <!-- filter bar + search -->
    <div class="flex flex-wrap items-center gap-2 reveal">
      <div class="flex flex-wrap gap-1.5 overflow-x-auto">
        ${VAULT_FILTERS.map(c => `<button class="cat-pill ${S.filter === c.id ? 'active' : ''}" onclick="setFilter('${c.id}')">${esc(T(c.key))} · ${filterCount(c.id)}</button>`).join('')}
      </div>
      <div class="relative ml-auto">
        <input id="schemeSearch" class="field-input !w-72 !pl-9" placeholder="${esc(T('search_ph'))}" oninput="S.searchQ=this.value.slice(0,60); clearTimeout(window.__sqT); window.__sqT=setTimeout(renderSchemesGridOnly,140)" value="${esc(S.searchQ)}" />
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[14px]">⌕</span>
        <span class="absolute right-2.5 top-1/2 -translate-y-1/2 mono text-[10.5px] text-slate-400 border border-[#E2E8F0] rounded px-1.5 py-0.5">Ctrl K</span>
      </div>
    </div>

    <!-- results header -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="mono-label">${esc(T('matched_count'))} · ${filteredMatches().length} ${esc(T('of_word'))} ${S.matched.length}</p>
      <div class="flex items-center gap-2">
        <select class="field-input !w-auto !py-1.5 !text-[13px] mono" onchange="setSort(this.value)" aria-label="Sort">
          <option value="value_desc" ${S.sortBy === 'value_desc' ? 'selected' : ''}>${esc(T('sort_value_desc'))}</option>
          <option value="value_asc" ${S.sortBy === 'value_asc' ? 'selected' : ''}>${esc(T('sort_value_asc'))}</option>
          <option value="deadline" ${S.sortBy === 'deadline' ? 'selected' : ''}>${esc(T('sort_deadline'))}</option>
        </select>
        ${conflicts.length ? `<span class="stamp stamp-crimson !py-1 text-[11.5px]">${conflicts.length} ${esc(T('excluded_chip'))}</span>` : ''}
      </div>
    </div>

    <!-- matched schemes grid -->
    <div class="pop-stagger grid md:grid-cols-2 gap-4" id="schemesGrid"></div>

    <!-- excluded by conflict engine -->
    ${conflicts.length ? `
    <div class="sv-card p-5 reveal">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <p class="mono-label">${esc(T('excluded_title'))}</p>
        <span class="mono-label dim">${conflicts.length} ${esc(T('of_word'))} ${meta.totalCatalogCount}</span>
      </div>
      <div class="mt-2">
        ${conflicts.map(c => {
          const cat = findCatalogByName(c.dropped);
          return `<div class="excl-row">
            <span class="lvl-chip" style="background:#FEF2F2;color:#991B1B;border:1px solid #DC2626">EXCLUDED</span>
            <b class="text-[#0A2540]">${esc(shortName({ name: c.dropped }))}</b>
            <span class="text-slate-500 flex-1 min-w-0 truncate">${esc(String(c.rule).split(':').slice(1).join(':').trim() || c.rule)}</span>
            <span class="mono text-[13px] text-slate-500 whitespace-nowrap">${cat ? '+' + inr(cat.annualValueINR) : '—'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <p class="text-center text-[13.5px] text-slate-500">${esc(T('intakeFoot'))}</p>
  </section>`;

  initRevealObserver();
  renderSchemesGridOnly();
  animateCounter($('dbtCounter'), meta.totalDirectAnnualINR);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  applyI18nStatic();
}
function conflictValue(name) {
  const cat = findCatalogByName(name);
  return cat ? '(' + inr(cat.annualValueINR) + ')' : '';
}

/* ---------------- filters / sort ---------------- */
const VAULT_FILTERS = [
  { id: 'ALL', key: 'f_all' },
  { id: 'CENTRAL', key: 'f_central' },
  { id: 'KA', key: 'f_ka' },
  { id: 'GEMS', key: 'f_gems' },
  { id: 'CLOSING', key: 'f_closing' }
];
function filterCount(id) {
  return (S.matched || []).filter(s => matchFilter(s, id)).length;
}
function matchFilter(s, id) {
  const lvl = String(s.level || '').toLowerCase();
  if (id === 'ALL') return true;
  if (id === 'CENTRAL') return lvl.includes('central');
  if (id === 'KA') return lvl.includes('karnataka') || lvl.includes('state');
  if (id === 'GEMS') return Boolean(s.isHiddenGem);
  if (id === 'CLOSING') return s.deadlineStatus === 'ENDING_2_DAYS' || s.deadlineStatus === 'EXPIRED_TODAY';
  return true;
}
function filteredMatches() {
  let list = (S.matched || []).filter(s => matchFilter(s, S.filter));
  if (S.searchQ) {
    const q = S.searchQ.toLowerCase();
    list = list.filter(s => (String(s.name) + ' ' + String(s.ministry) + ' ' + String(s.categoryTag)).toLowerCase().includes(q));
  }
  if (S.sortBy === 'value_asc') list = [...list].sort((a, b) => (a.annualValueINR || 0) - (b.annualValueINR || 0));
  else if (S.sortBy === 'deadline') list = [...list].sort((a, b) => deadlineRank(a) - deadlineRank(b));
  else list = [...list].sort((a, b) => (b.annualValueINR || 0) - (a.annualValueINR || 0));
  return list;
}
function deadlineRank(s) { return s.deadlineStatus === 'EXPIRED_TODAY' ? 0 : s.deadlineStatus === 'ENDING_2_DAYS' ? 1 : s.deadlineStatus === 'NEW' ? 2 : 3; }
function setFilter(id) { S.filter = id; renderSchemesGridOnly(); document.querySelectorAll('.cat-pill').forEach((el, i) => el.classList.toggle('active', VAULT_FILTERS[i] && VAULT_FILTERS[i].id === id)); }
function setSort(v) { S.sortBy = v; renderSchemesGridOnly(); }

/* ---------------- scheme cards (2-col sovereign layout) ---------------- */
function renderSchemesGridOnly() {
  const grid = $('schemesGrid'); if (!grid) return;
  const list = filteredMatches();
  if (!list.length) { grid.innerHTML = `<div class="sv-card p-6 text-center text-slate-500 text-sm md:col-span-2">0 ${esc(T('schemes_word'))} — ${esc(T('search_ph'))}</div>`; return; }
  grid.innerHTML = list.map(s => {
    const isCentral = String(s.level || '').toLowerCase().includes('central');
    const dlCls = s.deadlineStatus === 'ENDING_2_DAYS' ? 'stamp-ochre' : s.deadlineStatus === 'EXPIRED_TODAY' ? 'stamp-crimson' : 'stamp-emerald';
    const ch = s.channel || {};
    const isOneTime = /one[- ]time/i.test(s.payoutTag || '') || /laptop|solar|subsidy|grant/i.test(s.benefitType || '');
    return `<button class="scheme-card hover-spring" onclick="openSchemeDetail('${esc(s.id)}')">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="lvl-chip ${isCentral ? 'lvl-central' : 'lvl-ka'}">${esc(isCentral ? 'CENTRAL' : 'KARNATAKA')}</span>
        <span class="stamp ${dlCls} !py-0 text-[11.5px]">${esc(deadlineShort(s))}</span>
        ${s.isHiddenGem ? '<span class="stamp stamp-ochre !py-0 text-[11.5px] ml-auto">💎 GEM</span>' : ''}
      </div>
      <div>
        <div class="font-display font-bold text-[19px] text-[#0A2540] leading-snug">${esc(shortName(s))}</div>
        <div class="mono text-[11px] tracking-[0.08em] text-slate-500 uppercase mt-0.5">${esc(s.ministry || '')} · ${esc(s.statutoryRule || '')}</div>
      </div>
      <div class="text-[13.5px] text-slate-600 leading-relaxed flex-1" style="line-height:1.6; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${esc(s.benefitSummary || '')}</div>
      <div class="border-t border-[#E2E8F0] pt-2.5 flex items-end justify-between gap-2">
        <div>
          <span class="stamp stamp-sky !py-0.5 text-[11px] mono">${esc(T('channel_word'))} ${ch.channelNumber || 1} • ${esc(String(ch.channelName || 'GramaOne / CSC').split('/')[0].trim().toUpperCase())}</span>
          <div class="mono text-[10.5px] tracking-[0.08em] text-slate-400 uppercase mt-1.5">${esc(T('fee_shield'))} · ${esc(ch.statutoryFee || '₹0 ONLINE | ₹25–₹30 COUNTER')}</div>
        </div>
        <div class="text-right whitespace-nowrap">
          <span class="mono font-bold text-[19px] text-[#166534]">+${inr(s.annualValueINR)}</span>
          <div class="mono text-[10.5px] text-slate-400 uppercase">${esc(isOneTime ? T('one_time_word') : T('per_year_word'))}</div>
        </div>
      </div>
      <span class="btn-primary w-full py-2.5 text-[14px] text-center">${esc(T('view_cta'))} →</span>
    </button>`;
  }).join('');
}
function deadlineShort(s) {
  if (s.deadlineStatus === 'ENDING_2_DAYS') return 'ENDING IN 41 H';
  if (s.deadlineStatus === 'NEW') return 'NEW · 12 DAYS';
  if (s.deadlineStatus === 'EXPIRED_TODAY') return 'EXPIRED TODAY';
  return 'ACTIVE';
}

/* ---------------- bundle slips manifest (printable) ---------------- */
function printBundleManifest() {
  if (!S.matched.length) { toast(T('toast_busy'), true); return; }
  const rows = filteredMatches().map((s, i) => `
    <div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px dashed #CBD5E1;font-size:11.5px">
      <div><b>${String(i + 1).padStart(2, '0')} · ${esc(shortName(s))}</b><br/>
      <span style="color:#64748B">${esc(s.ministry || '')} · ${esc(T('channel_word'))} ${(s.channel && s.channel.channelNumber) || 1} · ${esc((s.channel && s.channel.statutoryFee) || '₹0')}</span></div>
      <div style="text-align:right;white-space:nowrap"><b style="color:#166534">+${inr(s.annualValueINR)}</b><br/><span style="color:#64748B">${esc(deadlineShort(s))}</span></div>
    </div>`).join('');
  const tmp = document.createElement('div');
  tmp.id = 'printableSlip';
  tmp.style.cssText = 'background:#fff;color:#0F172A;padding:14mm 12mm;font-family:Ubuntu,sans-serif';
  tmp.innerHTML = `
    <p style="font-family:'Ubuntu Mono',monospace;font-size:10px;letter-spacing:.14em;color:#1E3A5F">HAKKU 5.0 · DIGITAL PUBLIC INFRASTRUCTURE</p>
    <h1 style="font-size:20px;font-weight:800;color:#0A2540;margin:4px 0 2px">${esc(T('manifest_title'))}</h1>
    <p style="font-size:11.5px;color:#475569;margin-bottom:10px">${esc(S.profile && S.profile.name ? S.profile.name : 'Citizen')} · ${esc(buildFingerprint(S.profile))} · ${new Date().toLocaleString('en-GB')} · SES-${esc(String(S.sessionId).toUpperCase().slice(0, 4))}</p>
    ${rows}
    <p style="font-size:10.5px;color:#991B1B;border:1.5px solid #DC2626;background:#FEF2F2;border-radius:8px;padding:8px 10px;margin-top:12px;line-height:1.55"><b>ZERO-BRIBE NOTICE:</b> All DBT transfers are 100% automated via NPCI straight to your bank account. Any bribe demand above ₹30 is reportable to the Toll-Free <b>1902</b> Sakala / Janaspandana Helpline. ಎಲ್ಲಾ DBT ಹಣ ನೇರವಾಗಿ NPCI ಮೂಲಕ ಬರುತ್ತದೆ. सारा DBT भुगतान सीधे NPCI द्वारा आता है।</p>`;
  document.body.appendChild(tmp);
  try { window.print(); } catch (e) { toast('Print blocked', true); }
  setTimeout(() => tmp.remove(), 400);
}

function backToIntake() { S.view = 'intake'; renderIntake(true); showPills('intake'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function animateCounter(el, target) {
  if (!el) return;
  const dur = 900, t0 = performance.now(), from = 0;
  function tick(now) {
    const p = Math.min((now - t0) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = inr(Math.round(from + (target - from) * eased));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
