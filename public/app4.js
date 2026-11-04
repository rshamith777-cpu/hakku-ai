/* =====================================================================
   HAKKU 5.0 — app.js part 4: VIEW 3 · scheme deep-dive + A4 QR voucher
   ===================================================================== */
"use strict";

const BAG_BASE_KEYS = ['bag1', 'bag2', 'bag3', 'bag4', 'bag5'];

function schemeCode(s) {
  return String(s.id || 'SCHEME').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}
function ackNumber(s) {
  return schemeCode(s) + '/2025/' + String(S.sessionId || 'SES').toUpperCase().slice(0, 4);
}
function slaTimeline(sla) {
  const n = Number(sla) || 21;
  return [Math.max(1, Math.round(n * 0.25)), Math.max(2, Math.round(n * 0.4)), Math.max(3, Math.round(n * 0.7)), n];
}

/* ---------------- VIEW 3: scheme deep-dive ---------------- */
function openSchemeDetail(id, keepScroll) {
  const s = (S.matched || []).find(x => x.id === id) || (S.catalog || []).find(x => x.id === id);
  if (!s) { toast(T('toast_err'), true); return; }
  S.activeSchemeId = id;
  S.activeSchemeObj = s;
  S.dossierMode = 'operator';
  S.stepUnlocked = Math.max(S.stepUnlocked || 1, 3);
  updateStepTabs();
  renderSchemeDetail();
  if (!keepScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}
function backToSchemes() { S.view = 'schemes'; renderSchemes(); }

function renderSchemeDetail() {
  const main = $('mainStage');
  const s = S.activeSchemeObj;
  if (!s) { backToSchemes(); return; }
  showPills('detail');
  S.view = 'detail';
  const ch = s.channel || {};
  const isCentral = String(s.level || '').toLowerCase().includes('central');
  const expired = s.deadlineStatus === 'EXPIRED_TODAY';
  const portal = s.applyWhere || s.source || 'https://india.gov.in';
  const portalHost = String(portal).replace(/^https?:\/\//, '').split('/')[0];
  const portalPath = String(portal).replace(/^https?:\/\//, '').split('/').slice(1).join(' / ');
  const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=' + encodeURIComponent(portal);
  const isOneTime = /one[- ]time/i.test(s.payoutTag || '') || /laptop|solar|subsidy|grant/i.test(s.benefitType || '');
  const ses = 'SES-' + String(S.sessionId || '————').toUpperCase().slice(0, 4);
  const ack = ackNumber(s);
  const days = slaTimeline(s.sakalaSlaDays);
  const dlCls = s.deadlineStatus === 'ENDING_2_DAYS' ? 'stamp-ochre' : s.deadlineStatus === 'EXPIRED_TODAY' ? 'stamp-crimson' : 'stamp-emerald';
  const npciSeeded = S.resultMeta && S.resultMeta.readinessChecks && S.resultMeta.readinessChecks.npciSeeded;

  const bagRows = BAG_BASE_KEYS.map(k => ({ key: k, label: T(k), fee: '₹0' }))
    .concat((s.documents || []).slice(5).map((d, i) => ({ key: 'x' + i, label: d, fee: /certificate|RD|nadakacheri/i.test(d) ? '₹25' : '₹0' })));

  main.innerHTML = `
  <section id="view-scheme-detail" class="space-y-5 view-enter">
    <button class="btn-ghost px-4 py-2 text-[14px]" onclick="backToSchemes()">← ${esc(T('back_vault'))}</button>

    <!-- header + entitlement card -->
    <div class="grid lg:grid-cols-3 gap-4 items-stretch">
      <div class="sv-card p-5 lg:col-span-2 rise-in">
        <div class="flex flex-wrap gap-1.5 mb-2">
          <span class="lvl-chip ${isCentral ? 'lvl-central' : 'lvl-ka'}">${esc(isCentral ? 'CENTRAL' : 'KARNATAKA')}</span>
          <span class="stamp ${dlCls} !py-0 text-[11.5px]">${esc(deadlineShort(s))}${expired ? ' · 23:59' : ''}</span>
          ${s.isHiddenGem ? '<span class="stamp stamp-ochre !py-0 text-[11.5px]">💎 GEM</span>' : ''}
          <span class="stamp stamp-sky !py-0 text-[11.5px]">${esc(T('sla_word'))} ${s.sakalaSlaDays || 21} ${esc(T('days_word'))}</span>
        </div>
        <h2 class="font-display font-black text-[#111111] text-[26px] md:text-[30px] tracking-tight leading-tight">${esc(shortName(s))}</h2>
        <p class="mono text-[11px] tracking-[0.1em] text-[#565A5B] uppercase mt-1.5">${esc(s.ministry || '')} · ${esc(T('scheme_code_word'))} ${schemeCode(s)}</p>
      </div>
      <div class="env-card p-5 pop-stagger">
        <p class="mono text-[11px] tracking-[0.16em] text-[#FF9500] font-bold uppercase">${esc(T('entitlement'))}</p>
        <div class="font-display font-black text-[32px] leading-none mt-2">+${inr(s.annualValueINR)} <span class="text-[14px] font-bold text-white/60">${esc(isOneTime ? T('one_time_word') : T('per_year_word'))}</span></div>
        <p class="text-[12.5px] text-white/70 mt-1.5" style="line-height:1.5">${esc(s.payoutTag || '')}</p>
        <div class="mt-3">
          <div class="env-row"><span class="env-k">${esc(T('rule_ref'))}</span><span class="env-v text-[11.5px]">${esc(s.statutoryRule || '—')}</span></div>
          <div class="env-row"><span class="env-k">${esc(T('channel_word'))}</span><span class="env-v text-[11.5px]">${ch.channelNumber || 1} · ${esc(ch.channelName || 'GramaOne / CSC')}</span></div>
          <div class="env-row"><span class="env-k">${esc(T('counter_fee'))}</span><span class="env-v text-[11.5px]">${esc(ch.statutoryFee || '₹30 (statutory ceiling)')}</span></div>
        </div>
      </div>
    </div>

    ${expired ? `<div class="rounded-xl border-[1.5px] border-[#FF3B30] bg-[#FFE3E0] px-4 py-3 flex items-start gap-2.5 text-[14px] text-[#93000A] leading-relaxed rise-in">
      <span class="stamp stamp-crimson !py-0.5 flex-none">⏰</span>
      <span><b>${esc(T('late_cond'))}</b> — ${esc(T('late_cond_txt'))}</span>
    </div>` : ''}

    <!-- proof / trap / pathA | pathB -->
    <div class="grid lg:grid-cols-5 gap-4">
      <div class="lg:col-span-3 space-y-4">
        <div class="sv-card p-5 rise-in" style="animation-delay:.06s">
          <p class="mono-label mb-3">✔ ${esc(T('proof'))}</p>
          <ul class="space-y-2">
            ${(s.criteriaList || []).map(c => `<li class="flex gap-2.5 text-[14.5px] text-[#333637] leading-relaxed" style="line-height:1.6"><span class="w-5 h-5 rounded-full bg-[#EAE4D8] border-[1.5px] border-[#111111] text-[#111111] text-[11px] flex items-center justify-center flex-none mt-0.5">✓</span><span>${esc(c)}</span></li>`).join('') || `<li class="text-[#565A5B] text-[14.5px]">${esc(T('proof_sub'))}</li>`}
          </ul>
          <div class="mt-4 rounded-xl bg-[#FFE3E0] border border-[#FF3B30] p-3.5 text-[13.5px] text-[#93000A] leading-relaxed">
            <b>⚠ ${esc(T('trap'))}</b><br/>${esc(s.commonRejectionTrap || 'Ensure NPCI DBT seeding is active before filing.')}
          </div>
        </div>

        <div class="sv-card p-5 rise-in" style="animation-delay:.12s">
          <p class="mono-label mb-1">🖥 ${esc(T('pathA'))}</p>
          <p class="mono text-[11px] text-[#8A8D8D] mb-3">${esc(T('pathA_sub'))}</p>
          <ol class="space-y-2.5">
            ${(s.selfApplySteps || ['Open the official portal', 'Complete Aadhaar OTP e-KYC', 'Upload documents and submit']).map((st, i) => `
              <li class="flex gap-3">
                <span class="mono text-[11px] text-[#8A8D8D] font-bold pt-1 flex-none">${String(i + 1).padStart(2, '0')}</span>
                <span class="text-[14px] text-[#333637] leading-relaxed" style="line-height:1.6">${esc(st)}</span>
              </li>`).join('')}
          </ol>
          <a href="${esc(portal)}" target="_blank" rel="noopener noreferrer nofollow" class="btn-ghost w-full mt-4 py-2.5 text-[14px] flex items-center justify-center gap-2">🖥 ${esc(T('open_portal'))} · ${esc(portalHost)}</a>
        </div>
      </div>

      <div class="lg:col-span-2">
        <div class="sv-card p-5 rise-in" style="animation-delay:.18s">
          <p class="mono-label mb-1">🏛 ${esc(T('pathB'))}</p>
          <p class="mono text-[11px] text-[#8A8D8D] mb-3">~9 min · ${esc(T('pathB_sub'))}</p>
          <p class="mono text-[10.5px] tracking-[0.12em] text-[#565A5B] uppercase mb-2">${esc(T('bag_label'))}</p>
          <div class="space-y-1.5">
            ${bagRows.map(r => `
              <div class="bag-item ${S.bagChecked[s.id + r.key] ? 'checked' : ''}" onclick="toggleBag('${esc(s.id)}','${r.key}')" role="checkbox" aria-checked="${Boolean(S.bagChecked[s.id + r.key])}">
                <span class="bag-box">✓</span>
                <span class="text-[13.5px] text-[#333637] leading-snug flex-1">${esc(r.label)}</span>
                <span class="mono text-[11px] text-[#8A8D8D]">${esc(r.fee)}</span>
              </div>`).join('')}
          </div>
          <div class="mt-3.5 rounded-xl border-[1.5px] border-[#111111] bg-[#EAE4D8] p-3.5 text-[13px] text-[#111111] leading-relaxed">
            <b>🛡 ${esc(T('fee_shield_box'))}</b><br/>
            <span class="opacity-90">${esc(T('fee_shield_sub'))}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- official printable A4 voucher -->
    <div class="flex flex-wrap items-center justify-between gap-2 pt-2">
      <p class="mono-label">🖨 ${esc(T('voucher_title'))}</p>
      <div class="flex gap-1.5">
        <span class="stamp stamp-sky !py-0.5 text-[11px]">${esc(T('chip_print'))}</span>
        <span class="stamp stamp-ochre !py-0.5 text-[11px]">${esc(T('chip_watermark'))}</span>
        <span class="stamp stamp-emerald !py-0.5 text-[11px]">${esc(T('chip_qr'))}</span>
      </div>
    </div>

    <div class="slip-paper rise-in relative overflow-hidden mx-auto w-full max-w-3xl" id="printableSlip" style="animation-delay:.24s">
      <div class="slip-head px-6 py-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p class="mono text-[10px] tracking-[0.16em] text-[#FF9500] uppercase">${esc(isCentral ? 'GOVERNMENT OF INDIA' : 'GOVERNMENT OF KARNATAKA')} · ${esc((s.ministry || '').toUpperCase())}</p>
          <p class="font-display font-black text-[19px] mt-1">${esc(T('ack_title'))} — ${schemeCode(s)}</p>
        </div>
        <div class="text-right mono">
          <p class="text-[11px] font-bold text-white">ACK · ${esc(ack)}</p>
          <p class="text-[9.5px] text-white/60 mt-0.5">${esc(T('issued_by'))} HAKKU 5.0 · ${ses}</p>
        </div>
      </div>

      <div class="p-6">
        <div class="grid md:grid-cols-3 gap-5">
          <div class="md:col-span-2">
            <p class="mono-label mb-2">${esc(T('particulars'))}</p>
            <div class="slip-row"><span class="slip-n">01</span><span class="slip-k">${esc(T('p_applicant'))}</span><span class="slip-v">${esc(S.profile && S.profile.name ? S.profile.name : 'Citizen')} · ${schemeCode(s)}-KA-${esc(ack.split('/')[2] || '0000')}-2019</span></div>
            <div class="slip-row"><span class="slip-n">02</span><span class="slip-k">${esc(T('p_beneficiary'))}</span><span class="slip-v">${esc(S.profile && S.profile.name ? S.profile.name : 'Citizen')}${s.beneficiaryName ? ' — ' + esc(s.beneficiaryName) : ''}</span></div>
            <div class="slip-row"><span class="slip-n">03</span><span class="slip-k">${esc(T('p_scheme'))}</span><span class="slip-v">${esc(shortName(s))} (${esc(schemeCode(s))})</span></div>
            <div class="slip-row"><span class="slip-n">04</span><span class="slip-k">${esc(T('p_aadhaar'))}</span><span class="slip-v">XXXX XXXX #### — ${esc(T('masked_source'))}</span></div>
            <div class="slip-row"><span class="slip-n">05</span><span class="slip-k">${esc(T('p_ration'))}</span><span class="slip-v">${esc((S.profile && S.profile.rationCard) || 'APL')} · ${esc(T('p_kyc'))}</span></div>
            <div class="slip-row"><span class="slip-n">06</span><span class="slip-k">${esc(T('p_bank'))}</span><span class="slip-v">${esc((S.profile && S.profile.bankType) === 'pmjdy' ? 'PMJDY Jan Dhan' : 'Regular Savings')} · ${npciSeeded ? 'seeded ✓' : '⚠ ' + esc(T('npci_pending'))}</span></div>
            <div class="slip-row"><span class="slip-n">07</span><span class="slip-k">${esc(T('p_channel'))}</span><span class="slip-v">${esc(T('channel_word'))} ${ch.channelNumber || 1} · ${esc(ch.channelName || 'GramaOne / CSC')}</span></div>
            <div class="slip-row"><span class="slip-n">08</span><span class="slip-k">${esc(T('p_fee'))}</span><span class="slip-v">₹30 ${esc(T('statutory_ceiling'))} · ${esc(T('receipt_req'))}</span></div>
          </div>
          <div class="text-center">
            <img src="${qr}" alt="Official portal QR" width="150" height="150" class="border border-[#C4C7C7] rounded-lg bg-white p-1.5 mx-auto" style="image-rendering:pixelated" />
            <p class="mono text-[10px] font-bold text-[#565A5B] mt-1.5">${esc(T('qr_scan'))}</p>
            <p class="mono text-[9.5px] text-[#8A8D8D] mt-0.5 break-all">${esc(portal.replace(/^https?:\/\//, '').slice(0, 42))}</p>
          </div>
        </div>

        <div class="mt-5 rounded-xl border-[1.5px] border-[#FF3B30] bg-[#FFE3E0] p-3.5 text-[12.5px] text-[#93000A] leading-relaxed">
          <b>⚠ ${esc(T('zero_bribe_title'))}</b>
          <div class="grid md:grid-cols-3 gap-2.5 mt-1.5">
            <p><b>EN:</b> All DBT transfers are 100% automated via NPCI straight to your bank account. No middleman can influence approval. Any bribe demand above ₹30 is reportable to the Toll-Free <b>1902</b> Sakala / Janaspandana Helpline.</p>
            <p lang="kn"><b>KN:</b> ಎಲ್ಲಾ DBT ಹಣ ನೇರವಾಗಿ NPCI ಮೂಲಕ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಖಾತೆಗೆ ಬರುತ್ತದೆ. ಮಧ್ಯವರ್ತಿಗಳಿಗೆ ಹಣ ಕೊಡಬೇಡಿ. ₹30 ಮೀರಿದ ಲಂಚ ಕೇಳಿದರೆ <b>1902</b> ಸಕಾಲ ಸಹಾಯವಾಣಿಗೆ ದೂರು ನೀಡಿ.</p>
            <p lang="hi"><b>HI:</b> सारा DBT भुगतान 100% NPCI द्वारा सीधे आपके बैंक खाते में आता है। किसी मध्यस्थ को रिश्वत न दें। ₹30 से अधिक की माँग पर <b>1902</b> सकाल हेल्पलाइन पर रिपोर्ट करें।</p>
          </div>
          <p class="mono text-[10.5px] font-bold mt-2 tracking-[0.08em]">${esc(T('report_free'))} <b>1902</b> · ${esc(T('report_sub'))}</p>
        </div>

        <div class="mt-5 grid md:grid-cols-3 gap-4">
          <div class="md:col-span-2">
            <p class="mono-label mb-1.5">${esc(T('statutory_basis'))}</p>
            <p class="text-[12.5px] text-[#444748] leading-relaxed">${esc(s.statutoryRule || '')} — ${esc(s.benefitSummary || '')}</p>
          </div>
          <div class="mono text-[12px]">
            <div class="flex justify-between border-b border-dashed border-[#C4C7C7] py-1"><span class="text-[#8A8D8D]">${esc(T('row_benefit'))}</span><b>${inr(s.annualValueINR)}</b></div>
            <div class="flex justify-between border-b border-dashed border-[#C4C7C7] py-1"><span class="text-[#8A8D8D]">${esc(T('row_claim'))}</span><b>${esc(isOneTime ? T('one_time_word').toUpperCase() : T('per_year_word').toUpperCase())}</b></div>
            <div class="flex justify-between border-b border-dashed border-[#C4C7C7] py-1"><span class="text-[#8A8D8D]">${esc(T('row_fee'))}</span><b>₹30</b></div>
            <div class="flex justify-between py-1"><span class="text-[#8A8D8D]">${esc(T('row_sla'))}</span><b>${s.sakalaSlaDays || 21} ${esc(T('days_word'))}</b></div>
          </div>
        </div>

        <p class="mono-label mt-5 mb-2">${esc(T('escalation_title'))}</p>
        <div class="grid md:grid-cols-3 gap-2.5">
          <div class="tier-chip"><p class="mono text-[10.5px] font-bold text-[#8A4B00]">${esc(T('tier1'))}</p><p class="text-[11.5px] text-[#565A5B] mt-0.5">${esc(T('tier1_sub'))}</p></div>
          <div class="tier-chip"><p class="mono text-[10.5px] font-bold text-[#111111]">${esc(T('tier2'))}</p><p class="text-[11.5px] text-[#565A5B] mt-0.5">${esc(T('tier2_sub'))}</p></div>
          <div class="tier-chip"><p class="mono text-[10.5px] font-bold text-[#93000A]">${esc(T('tier3'))}</p><p class="text-[11.5px] text-[#565A5B] mt-0.5">${esc(T('tier3_sub'))}</p></div>
        </div>

        <p class="mono-label mt-5 mb-2">${esc(T('docs_received'))}</p>
        <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
          ${(s.documents || []).slice(0, 6).map(d => `<p class="flex items-center gap-2 text-[12px] text-[#444748]"><span class="w-4 h-4 rounded-full bg-[#EAE4D8] border border-[#111111] text-[#111111] text-[9px] flex items-center justify-center flex-none">✓</span>${esc(d)}</p>`).join('')}
        </div>

        <p class="mono-label mt-5 mb-2">${esc(T('whats_next'))} · ${esc(T('sla_word'))} ${s.sakalaSlaDays || 21} ${esc(T('days_word'))}</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          ${days.map((d, i) => `<div class="tier-chip text-center"><p class="mono text-[10px] font-bold text-[#111111]">${esc(T('day_word'))} ${d}</p><p class="text-[11px] text-[#565A5B] mt-0.5">${esc(T('sla_step' + (i + 1)))}</p></div>`).join('')}
        </div>

        <div class="grid md:grid-cols-2 gap-6 mt-6">
          <div class="border-t border-[#CBD5E1] pt-2">
            <p class="mono text-[10px] tracking-[0.1em] text-[#8A8D8D] uppercase">${esc(T('sign_applicant'))}</p>
            <p class="text-[11px] text-[#565A5B] mt-1">${esc(S.profile && S.profile.name ? S.profile.name : 'Citizen')} · ${new Date().toLocaleDateString('en-GB')}</p>
          </div>
          <div class="border-t border-[#CBD5E1] pt-2">
            <p class="mono text-[10px] tracking-[0.1em] text-[#8A8D8D] uppercase">${esc(T('sign_officer'))}</p>
            <p class="text-[11px] text-[#565A5B] mt-1">${esc(ch.channelAuthority || 'Designated Operator')} · ${esc(T('sign_note'))}</p>
          </div>
        </div>
      </div>

      <div class="counterfoil px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div class="mono text-[10.5px] text-[#444748] leading-relaxed">
          <b>${esc(T('counterfoil'))} · KEEP THIS HALF · ${esc(ack)}</b><br/>
          ${esc(S.profile && S.profile.name ? S.profile.name : 'Citizen')} · ${schemeCode(s)} · ₹30 paid · ${new Date().toLocaleString('en-GB')} · batch ${esc(ses)}
        </div>
        <div class="barcode w-40 flex-none" aria-hidden="true"></div>
      </div>
    </div>

    <!-- counter dossiers -->
    <div class="pt-2 flex flex-wrap items-center justify-between gap-2">
      <div>
        <p class="mono-label">🗂 ${esc(T('dossier_title'))}</p>
        <p class="text-[13px] text-[#565A5B] mt-0.5">${esc(T('dossier_sub'))}</p>
      </div>
      <div class="flex gap-1.5">
        <span class="stamp stamp-sky !py-0.5 text-[11px]">3 ${esc(T('modes_word'))}</span>
        <span class="stamp stamp-emerald !py-0.5 text-[11px]">${esc(T('never_stored'))}</span>
      </div>
    </div>

    <div class="grid lg:grid-cols-3 gap-4 items-start">
      <div class="lg:col-span-2">
        <div class="flex flex-wrap gap-1.5 mb-3 no-print">
          <button class="mode-btn ${S.dossierMode === 'operator' ? 'active' : ''}" onclick="switchDossierMode('operator')">📄 ${esc(T('mode1'))}</button>
          <button class="mode-btn ${S.dossierMode === 'npci' ? 'active' : ''}" onclick="switchDossierMode('npci')">🏦 ${esc(T('mode2'))}</button>
          <button class="mode-btn ${S.dossierMode === 'rti' ? 'active' : ''}" onclick="switchDossierMode('rti')">⚖️ ${esc(T('mode3'))}</button>
        </div>
        <div class="terminal">
          <div class="terminal-bar">
            <span class="tl" style="background:#FF5F57"></span><span class="tl" style="background:#FEBC2E"></span><span class="tl" style="background:#28C840"></span>
            <span class="mono text-[11.5px] text-[#FF9500] ml-1">${S.dossierMode}-handover-${ses}.txt</span>
            <span class="mono text-[10.5px] text-white/40 ml-auto" id="dossierLatency"></span>
          </div>
          <div class="terminal-body" id="dossierText">${esc((s.documents || []).map((d, i) => `[${i + 1}] ${d}`).join('\n') || 'Loading dossier…')}</div>
        </div>
        <div class="flex flex-wrap items-center gap-2 mt-3 no-print">
          <button onclick="printSlip()" class="btn-primary px-4 py-2.5 text-[14px]">🖨 ${esc(T('print_slip'))}</button>
          <button onclick="copyDossier()" class="btn-ghost px-4 py-2.5 text-[14px]">${esc(T('copy'))}</button>
          <button onclick="readSlipAloud()" class="btn-ghost px-4 py-2.5 text-[14px]">🔊 ${esc(T('read_slip'))}</button>
          <span class="mono text-[10.5px] text-[#8A8D8D] ml-auto hidden md:inline">compact A4 slip · 1 page · isolated print</span>
        </div>
      </div>

      <div class="sv-card p-5 rise-in" style="animation-delay:.1s">
        <p class="mono-label mb-3">${esc(T('howto_title'))}</p>
        <ol class="space-y-2.5">
          <li class="flex gap-2.5"><span class="mono text-[11px] text-[#8A8D8D] font-bold pt-0.5">01</span><span class="text-[13.5px] text-[#333637]" style="line-height:1.55">${esc(T('howto1'))}</span></li>
          <li class="flex gap-2.5"><span class="mono text-[11px] text-[#8A8D8D] font-bold pt-0.5">02</span><span class="text-[13.5px] text-[#333637]" style="line-height:1.55">${esc(T('howto2'))}</span></li>
          <li class="flex gap-2.5"><span class="mono text-[11px] text-[#8A8D8D] font-bold pt-0.5">03</span><span class="text-[13.5px] text-[#333637]" style="line-height:1.55">${esc(T('howto3'))}</span></li>
        </ol>
        <div class="mt-4 rounded-xl bg-[#FFE3E0] border border-[#FF3B30] p-3 text-[12.5px] text-[#93000A] leading-relaxed">
          <b>${esc(T('nexus_title'))}</b><br/>${esc(T('nexus_note'))}
        </div>
        <div class="mt-2.5 rounded-xl bg-[#F0F7FF] border border-[#93C5FD] p-3 text-[12.5px] text-[#111111] leading-relaxed">
          <b>${esc(T('dpdp_title'))}</b> ${esc(T('dpdp_note'))}
        </div>
      </div>
    </div>
  </section>`;

  S.bagCheckedVisibleKeys = BAG_BASE_KEYS;
  loadDossier();
  applyI18nStatic();
}

function toggleBag(schemeId, key) {
  const k = schemeId + key;
  S.bagChecked[k] = !S.bagChecked[k];
  renderSchemeDetail();
}
function switchDossierMode(mode) { S.dossierMode = mode; renderSchemeDetail(); }
async function loadDossier() {
  const s = S.activeSchemeObj;
  if (!s) return;
  const key = s.id + ':' + S.dossierMode;
  const cached = S.dossierCache[key];
  if (cached) { renderDossierMode(cached.text); const latEl = $('dossierLatency'); if (latEl) latEl.textContent = 'UTF-8 · ' + cached.ms + 'ms'; return; }
  const boxEl = $('dossierText');
  try {
    const data = await securePost('/api/harness/dockit', { profile: S.profile || {}, scheme: s, mode: S.dossierMode === 'operator' ? 'application' : S.dossierMode });
    const text = data.generatedText || '';
    const ms = data.ms || 0;
    S.dossierCache[key] = { text, ms };
    renderDossierMode(text);
    const latEl = $('dossierLatency'); if (latEl) latEl.textContent = 'UTF-8 · ' + ms + 'ms';
  } catch (err) {
    if (boxEl) boxEl.textContent = 'Dossier unavailable — your data was never stored. Reopen the slip to retry.';
  }
}
function renderDossierMode(text) {
  const box = $('dossierText'); if (!box) return;
  box.textContent = text || '';
}
async function copyDossier() {
  const box = $('dossierText'); if (!box) return;
  try { await navigator.clipboard.writeText(box.textContent); toast(T('copied')); } catch (e) { toast('Clipboard blocked', true); }
}
function printSlip() {
  const s = S.activeSchemeObj;
  if (!s) { toast(T('toast_err'), true); return; }
  const ch = s.channel || {};
  const isCentral = String(s.level || '').toLowerCase().includes('central');
  const isOneTime = /one[- ]time/i.test(s.payoutTag || '') || /laptop|solar|subsidy|grant/i.test(s.benefitType || '');
  const portal = s.applyWhere || s.source || 'https://india.gov.in';
  const portalHost = String(portal).replace(/^https?:\/\//, '').split('/')[0];
  const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=' + encodeURIComponent(portal);
  const ack = ackNumber(s);
  const days = slaTimeline(s.sakalaSlaDays);
  const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const citName = S.profile && S.profile.name ? S.profile.name : 'Citizen';
  const bagRows = BAG_BASE_KEYS.map(k => T(k))
    .concat((s.documents || []).slice(5));
  const html =
    printMasthead('SCHEME SLIP · ' + schemeCode(s) + ' · ACK ' + ack) +
    '<div class="citizen"><span>' + esc(citName) + ' · ' + esc(buildFingerprint(S.profile)) + '</span><span>' + esc(now) + ' IST · SES-' + esc(String(S.sessionId || '').toUpperCase().slice(0, 4)) + '</span></div>' +
    '<div class="slip-head"><div><span class="pill">' + esc(isCentral ? 'CENTRAL' : 'KARNATAKA') + '</span>' +
      '<span class="pill grn">SLA ' + (s.sakalaSlaDays || 21) + ' DAYS</span>' +
      (s.isHiddenGem ? '<span class="pill red">💎 GEM</span>' : '') +
      '<h2 style="margin-top:4px">' + esc(shortName(s)) + '</h2>' +
      '<div class="sub" style="font-family:JetBrains Mono,monospace;font-size:7.5px;color:#565A5B;letter-spacing:.06em;margin-top:2px">' + esc(s.ministry || '') + ' · ' + esc(s.statutoryRule || '') + '</div></div>' +
      '<div class="qrbox"><img src="' + esc(qr) + '" alt="QR"></div></div>' +
    '<div class="totals">' +
      '<div><div class="k">Entitlement</div><div class="v red">+' + inr(s.annualValueINR) + '</div><div class="k" style="margin-top:1px">' + esc(isOneTime ? 'ONE-TIME' : 'PER YEAR') + '</div></div>' +
      '<div><div class="k">Counter Fee</div><div class="v">' + esc(ch.statutoryFee || '₹0') + '</div></div>' +
      '<div><div class="k">Channel</div><div class="v" style="font-size:10.5px;line-height:1.3">CH ' + (ch.channelNumber || 1) + ' · ' + esc(String(ch.channelName || 'GramaOne / CSC').split('/')[0].trim()) + '</div></div>' +
      '<div><div class="k">SLA Path</div><div class="v" style="font-size:10.5px">D' + days.join(' → D') + '</div></div>' +
    '</div>' +
    '<div class="two">' +
      '<div><div class="sec">Eligibility proof checklist</div>' +
        ((s.criteriaList || []).map(c => '<div class="tick"><span class="b">✓</span><span>' + esc(c) + '</span></div>').join('') || '<div class="tick"><span class="b">✓</span><span>Aadhaar + bank NPCI seeding</span></div>') +
        '<div class="trap"><b>⚠ REJECTION TRAP:</b> ' + esc(s.commonRejectionTrap || 'Ensure NPCI DBT seeding is active before filing.') + '</div>' +
      '</div>' +
      '<div><div class="sec">Online path (Path A)</div><div class="steps">' +
        ((s.selfApplySteps || ['Open the official portal', 'Complete Aadhaar OTP e-KYC', 'Upload documents and submit']).slice(0, 6).map((st, i) => '<div><i>' + String(i + 1).padStart(2, '0') + '</i><span>' + esc(st) + '</span></div>').join('')) +
        '<div><i>→</i><span class="mono" style="font-size:8.5px">' + esc(portalHost) + '</span></div></div>' +
        '<div class="sec" style="margin-top:6px">Document bag</div>' +
        bagRows.slice(0, 9).map(d => '<div class="tick"><span class="b">□</span><span>' + esc(d) + '</span></div>').join('') +
      '</div>' +
    '</div>' +
    printZeroBribe() +
    printFoot('SCAN QR → OFFICIAL PORTAL ONLY · NEVER PAY A MIDDLEMAN', 'HELPLINE 1902 · PII NEVER STORED · RAM-ONLY');
  printCompact(html, 'HAKKU Scheme Slip — ' + shortName(s));
}
function readSlipAloud() {
  const s = S.activeSchemeObj;
  const box = $('dossierText');
  const txt = box ? (box.textContent || '').trim() : '';
  const usable = txt && !/^Loading dossier/i.test(txt) && !/Dossier unavailable/i.test(txt);
  if (usable) { speakText(txt.slice(0, 2500)); return; }
  if (!s) { toast(T('toast_err'), true); return; }
  const spoken = T('entitlement') + ' ' + inr(s.annualValueINR) + '. ' + buildSpeechForScheme(s);
  speakText(spoken.slice(0, 2500));
}
