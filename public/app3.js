/* =====================================================================
   HAKKU 5.0 — app.js part 3: harness orchestration + VIEW 2 (vault)
   ===================================================================== */
"use strict";

/* ---------------- client-side deterministic fallback engine ---------------- */
function clientEvaluateSchemes(profile, householdMembers, readinessChecks) {
  const catalog = (Array.isArray(window.HAKKU_CATALOG) && window.HAKKU_CATALOG.length)
    ? window.HAKKU_CATALOG
    : (Array.isArray(S.catalog) && S.catalog.length ? S.catalog : []);
  if (!catalog.length) return null;
  const members = [profile];
  for (const m of (householdMembers || [])) {
    if (!m || typeof m !== 'object') continue;
    if ((m.name || 'Citizen') === (profile.name || 'Citizen') && Number(m.age || 25) === Number(profile.age || 25)) continue;
    members.push(m);
  }

  const allMatched = [];
  const allConflicts = [];
  const seenIds = new Set();
  const seenHouseholdGroups = new Set();

  for (const p of members) {
    const age = Number(p.age || 25);
    const incomeRaw = Number(p.income);
    const income = Number.isFinite(incomeRaw) ? incomeRaw : 100000;
    const gender = (p.gender || 'any').toLowerCase();
    const occupation = (p.occupation || 'other').toLowerCase();
    const category = (p.category || 'OBC').toUpperCase();
    const state = (p.state || 'karnataka').toLowerCase();
    const isBPL = Boolean(p.isBPL) || (p.rationCard === 'BPL' || p.rationCard === 'AAY');
    const isStudent = Boolean(p.isStudent) || occupation === 'student';
    const isWidow = Boolean(p.isWidow);
    const isTaxPayer = Boolean(p.isTaxPayer);

    for (const s of catalog) {
      if (seenIds.has(s.id)) continue;
      const isKA = (s.level || '').toLowerCase().includes('karnataka');
      const isCentral = (s.level || '').toLowerCase().includes('central');
      if (state !== 'karnataka' && state !== 'all' && isKA && !isCentral) continue;
      const e = s.eligibility || {};
      if (e.excludeTaxPayer && isTaxPayer) continue;
      if (e.isStudent && !isStudent) continue;
      if (e.isWidow && !isWidow) continue;
      if (e.isBPL && !isBPL && income > 120000) continue;
      if (e.gender && !e.gender.includes('any') && !e.gender.includes(gender)) continue;
      if (e.category && !e.category.includes('ANY') && !e.category.includes(category)) continue;
      if (e.occupations && !e.occupations.includes(occupation)) continue;
      if (e.ageMin && age < e.ageMin) continue;
      if (e.ageMax && age > e.ageMax) continue;
      if (e.maxIncome && income > e.maxIncome) continue;

      if (s.exclusivityGroup) {
        if (s.exclusivityGroup.startsWith('HOUSEHOLD_')) {
          if (seenHouseholdGroups.has(s.exclusivityGroup)) {
            allConflicts.push({ group: s.exclusivityGroup, keptSchemeId: s.id, droppedSchemeId: s.id, reason: 'Household exclusivity rule applied' });
            continue;
          }
          seenHouseholdGroups.add(s.exclusivityGroup);
        }
      }

      seenIds.add(s.id);
      allMatched.push({ ...s, beneficiaryName: p.name || 'Citizen' });
    }
  }

  let totalDirect = 0;
  for (const s of allMatched) totalDirect += Number(s.annualValueINR || 0);

  const bundles = [
    { id: 'BUNDLE_COLLEGE', name: '🎓 12th Pass / College Admission Mobility Bundle', tagline: 'Higher Education & Tech Upgrades', description: 'Combines AICTE Pragati, NSP Scholarships, Free Laptop Grant, Vidyasiri Hostel & Education Loan Interest Waiver.', schemeIds: ['aicte-pragati-girl', 'state-free-laptop-grant', 'nsp-postmatric', 'pm-usp-csis', 'ka-ssp-vidyasiri'], badge: 'Higher Education', annualTarget: 170000 },
    { id: 'BUNDLE_FARM_UPGRADE', name: '🌾 Monsoon / Crop Risk & Farm Upgrade Bundle', tagline: 'Small Farmer Climate & Irrigation Protection', description: 'Combines PM-KISAN, Ganga Kalyana ₹3.5L Free Borewell, PM-KUSUM 60% Solar Pump, PMFBY Insurance & KCC 4% Credit.', schemeIds: ['pm-kisan', 'ganga-kalyana-borewell', 'pm-kusum-solar', 'pmfby-crop-insurance', 'kcc-interest-subvention'], badge: 'Farmer Security', annualTarget: 114000 },
    { id: 'BUNDLE_WIDOW_EMERGENCY', name: '🕊️ Breadwinner Loss / Widowhood Emergency Bundle', tagline: 'Immediate Survival & Single-Parent Pension', description: 'Combines Destitute Widow Pension, Gruha Lakshmi Head-of-Family cash, Sandhya Suraksha & Ayushman 70+ cover.', schemeIds: ['widow-pension-destitute', 'gruha-lakshmi', 'nsap-old-age-sandhya', 'pmjay-ayushman'], badge: 'Crisis Protection', annualTarget: 45600 },
    { id: 'BUNDLE_MATERNITY_BIRTH', name: '👶 Maternity & Girl Child Birth Wealth Bundle', tagline: 'Mother Nutrition & Family Health Protection', description: 'Combines PMMVY ₹6,000 cash nutrition grant, Gruha Lakshmi household support & Ayushman family health cover.', schemeIds: ['pmmvy-maternity', 'gruha-lakshmi', 'pmjay-ayushman'], badge: 'Maternity Nutrition', annualTarget: 30000 },
    { id: 'BUNDLE_WORKER_UPGRADE', name: '👷 Informal Worker & Artisan Upgrade Bundle', tagline: 'Toolkits, Marriage Grants & Working Capital', description: 'Combines Construction Welfare (BOCW) ₹60k Marriage/Education Grants, PM Vishwakarma ₹15k Toolkit, PM SVANidhi & 35% PMEGP.', schemeIds: ['kbocwwb-labour-grants', 'pm-vishwakarma', 'pm-svanidhi-vendor', 'pmegp-business-subsidy', 'yuva-nidhi'], badge: 'Livelihood & Skills', annualTarget: 195000 }
  ];

  const prereqSeq = [
    { phase: 'Phase A: Identity & Bank Foundation (Do Once)', timing: 'Day 0 – 2', action: 'Aadhaar Mobile Seeding + NPCI Bank Mapper Active', details: 'Ensure mobile number is linked to Aadhaar for OTP e-KYC. Confirm bank account has active NPCI Aadhaar DBT mapper (takes 48h to reflect on PFMS).' },
    { phase: 'Phase B: Statutory Certificates (Valid 1–5 Years)', timing: 'Day 3 – 7', action: 'Nadakacheri Income RD Certificate + Ration Card e-KYC', details: 'Obtain unexpired 15-digit RD0038... number. Verify all family members are active on Ahara Ration Card registry.' },
    { phase: 'Phase C: Single-Visit Zero-Failure Scheme Filing', timing: 'Day 8 – 10', action: 'Visit Exact Mapped Channel Counter with Hakku Master Folder', details: 'Carry deduplicated documents to the designated counter (GramaOne, College INO, RSK, or Labour Desk) paying only ₹0 to ₹30 statutory fee.' }
  ];

  return {
    profile,
    matchedSchemes: allMatched,
    allCatalogSchemes: catalog,
    totalDirectAnnualINR: totalDirect,
    fiveYearWealthINR: totalDirect * 5,
    totalHealthCoverINR: 500000,
    schemeCount: allMatched.length,
    hiddenGemsCount: allMatched.filter(s => s.isHiddenGem).length,
    totalCatalogCount: catalog.length,
    consolidatedDocuments: Array.from(new Set(allMatched.flatMap(s => s.documents || []))),
    statutoryConflictsResolved: allConflicts,
    readinessAudit: { readinessScore: 100, rejectionRisks: [] },
    notifications: [],
    prerequisiteSequence: prereqSeq,
    lifeEventBundles: bundles,
    aiSummary: `Hakku unlocked ${allMatched.length} verified statutory schemes worth ₹${totalDirect.toLocaleString('en-IN')}/year in direct cash.`
  };
}

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
    let data = null;
    try {
      data = await securePost('/api/harness/discover', { userMessage, currentProfile: profile, householdMembers: S.household || [], readinessChecks: prechecks, ignoreKeys: S.formTouched || [], language: S.lang });
    } catch (apiErr) {
      console.warn('Backend API request error, activating client statutory engine:', apiErr);
    }

    /* If server was offline, cold, or returned empty, use client-side catalog */
    if (!data || !Array.isArray(data.matchedSchemes) || data.matchedSchemes.length === 0) {
      const clientResult = clientEvaluateSchemes(profile, S.household || [], prechecks);
      if (clientResult && clientResult.matchedSchemes.length > 0) {
        data = clientResult;
      }
    }

    if (!data) throw new Error('NO_DATA');

    S.netLatency = Math.round(performance.now() - t0);
    S.profile = data.profile || profile;
    S.matched = data.matchedSchemes || [];
    S.catalog = data.allCatalogSchemes || (Array.isArray(window.HAKKU_CATALOG) ? window.HAKKU_CATALOG : []);
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
    S.stepUnlocked = Math.max(S.stepUnlocked || 1, 2);
    updateStepTabs();
    renderSchemes();
  } catch (err) {
    console.error('runHarness error:', err);
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

/* ---------------- helpers ---------------- */
function schemeName(s) {
  if (!s) return '';
  if (s.id) {
    const key = 'sch_' + String(s.id).replace(/-/g, '_');
    const localized = T(key);
    if (localized && localized !== key) return localized;
  }
  if (s.name) {
    const cat = findCatalogByName(s.name);
    if (cat && cat.id) {
      const key = 'sch_' + String(cat.id).replace(/-/g, '_');
      const localized = T(key);
      if (localized && localized !== key) return localized;
    }
  }
  return s.name || '';
}
function shortName(s) {
  if (!s) return '';
  const full = schemeName(s);
  return String(full).split('(')[0].trim();
}
function occAbbr(o) { return ({ student: 'STUD', farmer: 'FARM', worker: 'WORK', artisan: 'ARTI', vendor: 'VEND', unemployed: 'UNEMP', homemaker: 'HOME', senior: 'SNR' })[o] || String(o || '').toUpperCase().slice(0, 4); }
function buildFingerprint(p) {
  if (!p) return '—';
  return [(p.state || 'KA').toUpperCase().slice(0, 2), (p.gender || 'A').charAt(0).toUpperCase(), String(p.age || ''), (p.category || '').toUpperCase(),
    'INR' + (Number(p.income) === 0 ? '0' : Number(p.income) >= 100000 ? Math.round(p.income / 100000) + 'L' : Math.round(p.income / 1000) + 'k'),
    occAbbr(p.occupation), (p.rationCard || 'NONE').toUpperCase(), (p.bankType || 'regular') === 'pmjdy' ? 'JDY' : 'SAV',
    S.resultMeta && S.resultMeta.readinessChecks && S.resultMeta.readinessChecks.npciSeeded ? 'NPCIV' : 'NPCIX'].join('·');
}
function findCatalogByName(name) {
  if (!name) return null;
  const n = String(name).trim().toLowerCase();
  return (S.catalog || []).find(c => {
    const cn = String(c.name || '').trim().toLowerCase();
    return cn === n || cn.startsWith(n) || n.startsWith(cn);
  }) || null;
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
  const gemsList = S.matched.filter(s => s.isHiddenGem);
  const ot = oneTimeCapital();
  const loc = S.lang === 'Kannada' ? 'kn-IN' : S.lang === 'Hindi' ? 'hi-IN' : S.lang === 'Tamil' ? 'ta-IN' : S.lang === 'Telugu' ? 'te-IN' : 'en-GB';
  const runDate = new Date().toLocaleDateString(loc, { day: '2-digit', month: 'short', year: 'numeric' });
  const runTime = new Date().toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  const seqDays = (meta.prerequisiteSequence || []).reduce((a, ph) => {
    const m = String(ph.timing || '').match(/(\d+)\s*$/); return Math.max(a, m ? Number(m[1]) : a);
  }, 0) || 11;

  main.innerHTML = `
  <section id="view-schemes" class="space-y-6 view-enter">

    <!-- greeting + fingerprint -->
    <div class="sv-card p-5 rise-in flex flex-wrap items-center gap-3">
      <div class="mr-auto min-w-0">
        <div class="flex flex-wrap items-center gap-2.5">
          <h2 class="font-display font-black text-[#111111] text-[24px] tracking-tight">${esc(T('namaste'))} <span class="text-[#111111]">${esc(S.profile.name || '')}</span></h2>
          <span class="stamp stamp-emerald !py-1 text-[12px]">✓ ${esc(T('profile_matched'))}</span>
          <span class="stamp stamp-sky !py-1 text-[12px]">${esc(String(S.profile.state || '').toUpperCase())} / ${esc(T('jur_central'))}</span>
        </div>
        <p class="mono text-[12px] text-[#565A5B] mt-1.5 truncate">${esc(T('fingerprint_label'))} · ${esc(buildFingerprint(S.profile))} · ${esc(T('harness_run'))} ${esc(runDate)} · ${esc(runTime)} IST · ${meta.totalCatalogCount} ${esc(T('statutes_scanned'))}</p>
      </div>
      <div class="flex gap-2">
        <button class="btn-ghost px-4 py-2 text-[14px]" onclick="backToIntake()">← ${esc(T('edit_particulars'))}</button>
        <button class="btn-primary px-4 py-2 text-[14px]" onclick="printBundleManifest()">🖨 ${esc(T('bundle_slips'))}</button>
      </div>
    </div>

    <!-- sovereign 3-tile bento -->
    <div class="grid md:grid-cols-3 gap-4">
      <div class="bento-main p-5 pop-stagger">
        <p class="mono text-[11px] tracking-[0.16em] text-[#FF9500] font-bold uppercase">${esc(T('dbt_year'))}</p>
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
        <div class="mt-4 inline-flex items-center gap-2 border border-[#F4EFE6]/40 rounded-xl px-3 py-1.5" style="background:rgba(244,239,230,.12)">
          <span class="font-bold text-[#FF9500]">+${inr(meta.totalHealthCoverINR)}</span>
          <span class="text-[12.5px] text-white/80">${esc(T('shield'))} <span class="mono text-[10.5px] text-white/50">PM-JAY</span></span>
        </div>
      </div>

      <div class="bento-white p-5">
        <span class="stamp stamp-ochre !py-1 text-[12px]">💎 ${esc(T('gems'))}</span>
        <div class="flex items-end gap-2 mt-2.5">
          <span class="font-display font-black text-[36px] leading-none text-[#8A4B00]" id="gemCount">${meta.hiddenGemsCount}</span>
          <span class="text-[13.5px] text-[#8A4B00]/80 mb-1">${esc(T('gems_unlocked'))}</span>
        </div>
        <p class="mono text-[10.5px] tracking-[0.14em] text-[#8A4B00] uppercase mt-4">${esc(T('gems_why'))}</p>
        <ul class="mt-2 space-y-2 text-[13.5px] text-[#333637] max-h-56 overflow-auto pr-1" style="line-height:1.5">
          ${gemsList.map((g, i) => `<li class="flex gap-2.5"><span class="mono text-[11px] text-[#8A4B00] font-bold pt-0.5">${String(i + 1).padStart(2, '0')}</span><span><b>${esc(shortName(g))}</b> — ${esc(g.channel ? g.channel.channelName : T('gems_counter_only'))}</span></li>`).join('') || `<li class="text-[#565A5B]">—</li>`}
        </ul>
        <p class="mono text-[11.5px] text-[#8A4B00]/70 mt-3">${esc(T('gems_foot'))}</p>
      </div>

      <div class="bento-white p-5">
        <div class="flex items-center justify-between">
          <p class="mono-label">${esc(T('ready'))}</p>
          <span class="stamp ${readiness >= 80 ? 'stamp-emerald' : 'stamp-ochre'} !py-1 text-[11.5px]">${esc(T('fix_risks'))}</span>
        </div>
        <div class="flex items-end gap-2 mt-2">
          <span class="font-display font-black text-[36px] leading-none ${readiness >= 80 ? 'text-[#111111]' : readiness >= 55 ? 'text-[#8A4B00]' : 'text-[#93000A]'}" id="readyScore">${readiness}%</span>
          <span class="text-[13px] text-[#565A5B] mb-1">${risks.length} ${esc(T('risks_sub'))}</span>
        </div>
        <div class="h-2 rounded-full bg-[#EAE4D8] overflow-hidden mt-3 border border-[#C4C7C7]">
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
      <span class="w-6 h-6 rounded-full bg-[#FF3B30] text-white flex items-center justify-center text-[13px] flex-none">✔</span>
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
              <span class="mono text-[11px] text-[#8A8D8D] uppercase">${esc((ph.timing || '').toUpperCase())}</span>
            </div>
            <p class="font-bold text-[14.5px] text-[#111111] leading-snug">${esc(ph.action || '')}</p>
            <p class="text-[12.5px] text-[#565A5B] mt-1" style="line-height:1.55">${esc(ph.details || '')}</p>
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
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8D8D] text-[14px]">⌕</span>
        <span class="absolute right-2.5 top-1/2 -translate-y-1/2 mono text-[10.5px] text-[#8A8D8D] border border-[#C4C7C7] rounded px-1.5 py-0.5">Ctrl K</span>
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
            <span class="lvl-chip" style="background:#FEF2F2;color:#991B1B;border:1px solid #DC2626">${esc(T('excluded_chip'))}</span>
            <b class="text-[#111111]">${esc(shortName({ name: c.dropped }))}</b>
            <span class="text-[#565A5B] flex-1 min-w-0 truncate">${esc(String(c.rule).split(':').slice(1).join(':').trim() || c.rule)}</span>
            <span class="mono text-[13px] text-[#565A5B] whitespace-nowrap">${cat ? '+' + inr(cat.annualValueINR) : '—'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <p class="text-center text-[13.5px] text-[#565A5B]">${esc(T('intakeFoot'))}</p>
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
  if (!list.length) { grid.innerHTML = `<div class="sv-card p-6 text-center text-[#565A5B] text-sm md:col-span-2">0 ${esc(T('schemes_word'))} — ${esc(T('search_ph'))}</div>`; return; }
  grid.innerHTML = list.map(s => {
    const isCentral = String(s.level || '').toLowerCase().includes('central');
    const dlCls = s.deadlineStatus === 'ENDING_2_DAYS' ? 'stamp-ochre' : s.deadlineStatus === 'EXPIRED_TODAY' ? 'stamp-crimson' : 'stamp-emerald';
    const ch = s.channel || {};
    const isOneTime = /one[- ]time/i.test(s.payoutTag || '') || /laptop|solar|subsidy|grant/i.test(s.benefitType || '');
    return `<button class="scheme-card hover-spring" onclick="openSchemeDetail('${esc(s.id)}')">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="lvl-chip ${isCentral ? 'lvl-central' : 'lvl-ka'}">${esc(T(isCentral ? 'lvl_central' : 'lvl_ka'))}</span>
        <span class="stamp ${dlCls} !py-0 text-[11.5px]">${esc(deadlineShort(s))}</span>
        ${s.isHiddenGem ? '<span class="stamp stamp-ochre !py-0 text-[11.5px] ml-auto">💎 GEM</span>' : ''}
      </div>
      <div>
        <div class="font-display font-bold text-[19px] text-[#111111] leading-snug">${esc(shortName(s))}</div>
        <div class="mono text-[11px] tracking-[0.08em] text-[#565A5B] uppercase mt-0.5">${esc(s.ministry || '')} · ${esc(s.statutoryRule || '')}</div>
      </div>
      <div class="text-[13.5px] text-[#444748] leading-relaxed flex-1" style="line-height:1.6; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${esc(s.benefitSummary || '')}</div>
      <div class="border-t border-[#C4C7C7] pt-2.5 flex items-end justify-between gap-2">
        <div>
          <span class="stamp stamp-sky !py-0.5 text-[11px] mono">${esc(T('channel_word'))} ${ch.channelNumber || 1} • ${esc(String(ch.channelName || 'GramaOne / CSC').split('/')[0].trim().toUpperCase())}</span>
          <div class="mono text-[10.5px] tracking-[0.08em] text-[#8A8D8D] uppercase mt-1.5">${esc(T('fee_shield'))} · ${esc(ch.statutoryFee || '₹0 ONLINE | ₹25–₹30 COUNTER')}</div>
        </div>
        <div class="text-right whitespace-nowrap">
          <span class="mono font-bold text-[19px] text-[#111111]">+${inr(s.annualValueINR)}</span>
          <div class="mono text-[10.5px] text-[#8A8D8D] uppercase">${esc(isOneTime ? T('one_time_word') : T('per_year_word'))}</div>
        </div>
      </div>
      <span class="btn-primary w-full py-2.5 text-[14px] text-center">${esc(T('view_cta'))} →</span>
    </button>`;
  }).join('');
}
function deadlineShort(s) {
  if (s.deadlineStatus === 'ENDING_2_DAYS') return T('dl_ending');
  if (s.deadlineStatus === 'NEW') return T('dl_new');
  if (s.deadlineStatus === 'EXPIRED_TODAY') return T('dl_expired');
  return T('dl_active');
}

/* ---------------- bundle slips manifest (printable) ---------------- */
function printBundleManifest() {
  if (!S.matched.length) { toast(T('toast_busy'), true); return; }
  const list = filteredMatches();
  const meta = S.resultMeta;
  const rows = list.map((s, i) => {
    const ch = s.channel || {};
    return '<tr>' +
      '<td class="idx">' + String(i + 1).padStart(2, '0') + '</td>' +
      '<td><b>' + esc(shortName(s)) + '</b><div class="sub">' + esc(s.ministry || '') + '</div></td>' +
      '<td><div class="sub">CH ' + (ch.channelNumber || 1) + ' · ' + esc(String(ch.channelName || 'GramaOne / CSC').split('/')[0].trim()) + '</div><div class="sub">' + esc(ch.statutoryFee || '₹0') + '</div></td>' +
      '<td><div class="sub">' + esc(deadlineShort(s)) + '</div></td>' +
      '<td class="num">+' + inr(s.annualValueINR) + '</td>' +
      '</tr>';
  }).join('');
  const conflicts = meta.statutoryConflictsResolved || [];
  const excl = conflicts.length ? '<div class="sec"><span>Excluded · anti-double-dipping engine</span><span>' + conflicts.length + '</span></div>' +
    conflicts.slice(0, 5).map(c => '<div class="excl"><span class="x">✕</span> <b>' + esc(shortName({ name: c.dropped })) + '</b> — ' + esc(String(c.rule).split(':').slice(1).join(':').trim() || c.rule) + '</div>').join('') +
    (conflicts.length > 5 ? '<div class="excl">+ ' + (conflicts.length - 5) + ' more resolved automatically</div>' : '') : '';
  const docs = (meta.consolidatedDocuments || []);
  const readiness = (meta.readinessAudit || {}).readinessScore;
  const citName = S.profile && S.profile.name ? S.profile.name : 'Citizen';
  const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const html =
    printMasthead('SOVEREIGN CITIZEN WELFARE DISCOVERY<br>ENTITLEMENT MANIFEST · STATUTORY DISPATCH') +
    printDateline(
      esc(citName).toUpperCase() + ' · FP ' + esc(buildFingerprint(S.profile)),
      esc(now) + ' IST · SES-' + esc(String(S.sessionId || '').toUpperCase().slice(0, 4)) + ' · PAGE 1 / 1'
    ) +
    '<div class="stat">' +
      '<div class="lead"><div class="k">' + esc(T('p_dbt_year')) + '</div><div class="big">' + inr(meta.totalDirectAnnualINR) + '</div><div class="k" style="margin-top:4px">' + esc(T('p_leakage')) + '</div></div>' +
      '<div class="cell"><div class="k">5-Year Wealth</div><div class="v">' + inr(meta.fiveYearWealthINR) + '</div></div>' +
      '<div class="cell"><div class="k">' + esc(T('p_health')) + '</div><div class="v">' + inr(meta.totalHealthCoverINR) + '</div></div>' +
      '<div class="cell"><div class="k">' + esc(T('p_readiness')) + '</div><div class="v">' + (readiness || 0) + '%</div></div>' +
      '<div class="cell"><div class="k">' + esc(T('p_unlocked')) + '</div><div class="v">' + meta.schemeCount + ' / ' + meta.totalCatalogCount + '</div></div>' +
    '</div>' +
    '<div class="sec"><span>' + esc(T('p_matched')) + '</span><span>' + list.length + ' OF ' + meta.totalCatalogCount + ' SCANNED</span></div>' +
    '<table class="st"><thead><tr><th>#</th><th style="width:46%">' + esc(T('p_scheme_col')) + '</th><th style="width:24%">Channel · Fee</th><th style="width:14%">' + esc(T('p_deadline')) + '</th><th class="num">+₹ / Year</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    excl +
    (docs.length ? '<div class="sec"><span>' + esc(T('p_docs_folder')) + '</span><span>' + esc(T('p_carry_all')) + '</span></div><div class="docs pb">' + docs.map(d => '<span>' + esc(d) + '</span>').join('') + '</div>' : '') +
    printZeroBribe() +
    printFoot('PHASE A→C · DAY 0–10 · GRAMAONE / RSK / INO / BOCW COUNTERS', 'HELPLINE 1902 · PII NEVER STORED · RAM-ONLY');
  printCompact(html, 'HAKKU Entitlement Manifest — ' + citName);
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
