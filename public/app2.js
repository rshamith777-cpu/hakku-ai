/* =====================================================================
   HAKKU 5.0 — app.js part 2: VIEW 1 · CITIZEN INTAKE (sovereign edition)
   ===================================================================== */
"use strict";

/* ---------------- personas (volatile demo seeds) ---------------- */
const PERSONAS = {
  ananya:  { name: 'Ananya',  sub: 'Girl Engg Student',      profile: { name: 'Ananya Gowda', age: 19, gender: 'female', state: 'karnataka', occupation: 'student',    income: 0,      category: 'OBC',     rationCard: 'APL',  bankType: 'regular', land: 'landless', isStudent: true,  isWidow: false, isTaxPayer: false } },
  ramesh:  { name: 'Ramesh',  sub: 'Small Farmer · 1.2 ac',  profile: { name: 'Ramesh Nayka', age: 46, gender: 'male',   state: 'karnataka', occupation: 'farmer',     income: 96000,  category: 'OBC',     rationCard: 'BPL',  bankType: 'regular', land: 'marginal', isStudent: false, isWidow: false, isTaxPayer: false } },
  kiran:   { name: 'Kiran',   sub: 'Construction Worker',    profile: { name: 'Kiran Kumar',  age: 34, gender: 'male',   state: 'karnataka', occupation: 'worker',     income: 180000, category: 'GENERAL', rationCard: 'APL',  bankType: 'regular', land: 'landless', isStudent: false, isWidow: false, isTaxPayer: false } },
  lakshmi: { name: 'Lakshmi', sub: 'Senior Widow',           profile: { name: 'Lakshmi Devi', age: 71, gender: 'female', state: 'karnataka', occupation: 'senior',     income: 24000,  category: 'SC',      rationCard: 'AAY',  bankType: 'pmjdy',   land: 'landless', isStudent: false, isWidow: true,  isTaxPayer: false } },
  family:  { name: 'BPL Family', sub: '4-Member Household',  profile: { name: 'Family Head',  age: 41, gender: 'any',    state: 'karnataka', occupation: 'homemaker',  income: 72000,  category: 'OBC',     rationCard: 'BPL',  bankType: 'regular', land: 'small',    isStudent: false, isWidow: false, isTaxPayer: false } }
};
const FAMILY_MEMBERS = [
  { name: 'Head of Household', profile: { age: 41, gender: 'any',    occupation: 'homemaker', income: 72000,  category: 'OBC', rationCard: 'BPL', isStudent: false, isWidow: false, isTaxPayer: false } },
  { name: 'Spouse',            profile: { age: 38, gender: 'female', occupation: 'homemaker', income: 0,      category: 'OBC', rationCard: 'BPL', isStudent: false, isWidow: false, isTaxPayer: false } },
  { name: 'Daughter',          profile: { age: 17, gender: 'female', occupation: 'student',   income: 0,      category: 'OBC', rationCard: 'BPL', isStudent: true,  isWidow: false, isTaxPayer: false } },
  { name: 'Son',               profile: { age: 14, gender: 'male',   occupation: 'student',   income: 0,      category: 'OBC', rationCard: 'BPL', isStudent: true,  isWidow: false, isTaxPayer: false } }
];

/* ---------------- section header helper ---------------- */
function secHead(num, titleKey, rightHtml) {
  return `<div class="flex items-center justify-between gap-3 flex-wrap reveal">
    <div class="flex items-center gap-2.5 min-w-0">
      <span class="num-chip">${num}</span>
      <span class="mono-label truncate">${esc(T(titleKey))}</span>
    </div>
    ${rightHtml || ''}
  </div>`;
}

/* ---------------- situation → detected flags (client-side, deterministic) ---------------- */
function detectSituationFlags(text) {
  const t = (text || '').toLowerCase();
  const flags = [];
  if (/(student|college|b\.?tech|degree|engineering|be\b|study)/.test(t)) flags.push(T('d_student'));
  if (/(farmer|acre|kisan|crop|agri)/.test(t)) flags.push(T('d_farmer'));
  if (/(widow|vidhwa|ವಿಧವೆ)/.test(t)) flags.push(T('d_widow'));
  if (/(worker|labour|labor|construction|driver|tailor|vendor)/.test(t)) flags.push(T('d_worker'));
  if (/(karnataka|kerala|tamil|andhra|telangana|maharashtra|up\b|bihar)/.test(t)) flags.push(T('d_state'));
  if (/(obc|sc\b|st\b|minority|general)/.test(t)) flags.push(T('d_cat'));
  if (/(bpl|apl|antyodaya|ration)/.test(t)) flags.push(T('d_ration'));
  if (/(aadhaar.*(mobile|phone)|(mobile|phone).*aadhaar|mismatch)/.test(t)) flags.push(T('d_aadhaar'));
  if (/(no income|zero income|₹0|rs 0|unemployed|jobless)/.test(t)) flags.push(T('d_income0'));
  return flags;
}
function updateDetectedFlags() {
  const el = $('detectedFlags'); if (!el) return;
  const flags = detectSituationFlags($('situationBox') ? $('situationBox').value : '');
  el.textContent = flags.length ? (T('detected') + ': ' + flags.join(' · ') + ' — ' + flags.length + ' ' + T('flags_word')) : '';
}

/* ---------------- bank account radio cards ---------------- */
function selectBank(v) {
  S.bankPick = v;
  document.querySelectorAll('[data-bank]').forEach(el => el.classList.toggle('active', el.getAttribute('data-bank') === v));
}

/* ---------------- VIEW 1: intake render ---------------- */
function renderIntake(preserveAlerts) {
  const main = $('mainStage');
  showPills('intake');
  S.view = 'intake';
  const ses = 'SES-' + (S.sessionId || '————').toUpperCase().slice(0, 4);
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const bankPick = S.bankPick || (S.profile && S.profile.bankType) || 'regular';
  main.innerHTML = `
  <section id="view-intake" class="space-y-8 view-enter">

    <!-- HERO + SESSION ENVELOPE -->
    <div class="grid lg:grid-cols-3 gap-5 items-stretch rise-in">
      <div class="lg:col-span-2">
        <p class="stamp stamp-sky mono text-[12px] px-3 py-1 mb-3 inline-flex">🛡 ${esc(T('heroKick'))}</p>
        <h2 class="font-display font-black text-[#0A2540] text-[30px] md:text-[38px] tracking-tight" style="line-height:1.18">${esc(T('heroH'))}</h2>
        <p class="text-slate-600 mt-3 text-[16px] max-w-3xl" style="line-height:1.65">${esc(T('heroSub'))}</p>
        <div class="flex flex-wrap gap-2 mt-4">
          <span class="sec-chip">✓ ${esc(T('sec1'))}</span>
          <span class="sec-chip">✓ ${esc(T('sec2'))}</span>
          <span class="sec-chip">✓ ${esc(T('sec3'))}</span>
          <span class="sec-chip">✓ ${esc(T('sec4'))}</span>
          <span class="sec-chip">✓ ${esc(T('sec5'))}</span>
        </div>
      </div>
      <div class="env-card p-5 pop-stagger">
        <p class="mono text-[11px] tracking-[0.16em] text-[#93C5FD] font-bold">${esc(T('env_title'))}</p>
        <p class="mono text-[12.5px] text-white/80 mt-1.5">${ses} · ${today}</p>
        <div class="mt-3">
          <div class="env-row"><span class="env-k">${esc(T('env_cipher'))}</span><span class="env-v">AES-256-GCM</span></div>
          <div class="env-row"><span class="env-k">${esc(T('env_ttl'))}</span><span class="env-v">600 s</span></div>
          <div class="env-row"><span class="env-k">${esc(T('env_persist'))}</span><span class="env-v">NONE</span></div>
          <div class="env-row"><span class="env-k">${esc(T('env_out'))}</span><span class="env-v">0 req</span></div>
          <div class="env-row"><span class="env-k">${esc(T('env_records'))}</span><span class="env-v">0</span></div>
        </div>
        <p class="mono text-[11px] tracking-[0.12em] text-emerald-300 font-bold mt-3">● ${esc(T('env_ram'))}</p>
      </div>
    </div>

    <!-- ① LIFE-EVENT BUNDLES -->
    ${secHead('1', 'bundles_title', `<span class="mono-label dim">${esc(T('tap_vault'))}</span>`)}
    <p class="text-[14px] text-slate-500 -mt-4 reveal" style="line-height:1.65">${esc(T('bundles_hint'))}</p>
    <div class="pop-stagger grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3.5" id="bundleGrid"></div>

    <!-- ② PERSONA PRESETS -->
    ${secHead('2', 'presets_title', `<span class="mono-label dim">${esc(T('presets_hint'))}</span>`)}
    <div class="pop-stagger grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3" id="presetRow"></div>

    <!-- ③ CITIZEN PARTICULARS -->
    <div class="sv-card reveal" id="intakeFormCard">
      <div class="px-6 pt-5 pb-4 flex items-start justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2.5">
          <span class="num-chip">3</span>
          <div>
            <p class="mono-label">${esc(T('form_title'))}</p>
            <p class="text-[13.5px] text-slate-500 mt-0.5">${esc(T('form_hint'))}</p>
          </div>
        </div>
        <div class="flex gap-2">
          <span class="stamp stamp-sky !py-1 text-[12px]">${esc(T('zero_pii'))}</span>
          <span class="stamp stamp-emerald !py-1 text-[12px]">${esc(T('auto_redact'))}</span>
        </div>
      </div>

      <div class="grid md:grid-cols-3 gap-x-5 gap-y-4 px-6 pb-2">
        <div>
          <label class="field-label" for="formName">${esc(T('f_name'))}</label>
          <input id="formName" class="field-input mt-1.5" maxlength="60" autocomplete="off" data-i18n-ph="f_name_ph" placeholder="${esc(T('f_name_ph'))}" />
        </div>
        <div>
          <label class="field-label" for="formAge">${esc(T('f_age'))}</label>
          <input id="formAge" type="number" min="1" max="110" class="field-input mt-1.5" placeholder="24" />
        </div>
        <div>
          <label class="field-label" for="formGender">${esc(T('f_gender'))}</label>
          <select id="formGender" class="field-input mt-1.5">
            <option value="female">${esc(T('g_female'))}</option>
            <option value="male">${esc(T('g_male'))}</option>
            <option value="any">${esc(T('g_any'))}</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="formState">${esc(T('f_state'))}</label>
          <select id="formState" class="field-input mt-1.5">
            <option value="karnataka">${esc(T('st_ka'))}</option>
            <option value="other">${esc(T('st_in'))}</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="formOccupation">${esc(T('f_occ'))}</label>
          <select id="formOccupation" class="field-input mt-1.5">
            <option value="student">${esc(T('o_student'))}</option>
            <option value="farmer">${esc(T('o_farmer'))}</option>
            <option value="worker">${esc(T('o_worker'))}</option>
            <option value="artisan">${esc(T('o_artisan'))}</option>
            <option value="vendor">${esc(T('o_vendor'))}</option>
            <option value="unemployed">${esc(T('o_unemp'))}</option>
            <option value="homemaker">${esc(T('o_home'))}</option>
            <option value="senior">${esc(T('o_senior'))}</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="formIncome">${esc(T('f_income'))}</label>
          <input id="formIncome" type="number" min="0" max="5000000" class="field-input mt-1.5" placeholder="120000" />
        </div>
        <div>
          <label class="field-label" for="formRation">${esc(T('f_ration'))}</label>
          <select id="formRation" class="field-input mt-1.5">
            <option value="BPL">BPL</option>
            <option value="AAY">Antyodaya (AAY)</option>
            <option value="APL">APL</option>
            <option value="NONE">${esc(T('r_none'))}</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="formCategory">${esc(T('f_cat'))}</label>
          <select id="formCategory" class="field-input mt-1.5">
            <option value="OBC">OBC</option><option value="SC">SC</option><option value="ST">ST</option>
            <option value="GENERAL">General</option><option value="MINORITY">Minority</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="formLand">${esc(T('f_land'))}</label>
          <select id="formLand" class="field-input mt-1.5">
            <option value="landless">${esc(T('l_none'))}</option>
            <option value="marginal">${esc(T('l_small'))}</option>
            <option value="small">${esc(T('l_small2'))}</option>
            <option value="large">${esc(T('l_big'))}</option>
          </select>
        </div>
      </div>

      <div class="px-6 pb-5">
        <label class="field-label">${esc(T('f_bank'))} · <span class="normal-case tracking-normal text-slate-500">${esc(T('f_bank_sub'))}</span></label>
        <div class="grid md:grid-cols-2 gap-3 mt-1.5">
          <div class="bank-card ${bankPick === 'regular' ? 'active' : ''}" data-bank="regular" onclick="selectBank('regular')" role="radio" aria-checked="${bankPick === 'regular'}">
            <span class="bank-dot"></span>
            <span><span class="block font-bold text-[15px] text-[#0A2540]">${esc(T('b_regular'))}</span>
            <span class="block text-[12.5px] text-slate-500 mt-0.5">${esc(T('b_regular_sub'))}</span></span>
          </div>
          <div class="bank-card ${bankPick === 'pmjdy' ? 'active' : ''}" data-bank="pmjdy" onclick="selectBank('pmjdy')" role="radio" aria-checked="${bankPick === 'pmjdy'}">
            <span class="bank-dot"></span>
            <span><span class="block font-bold text-[15px] text-[#0A2540]">${esc(T('b_pmjdy'))}</span>
            <span class="block text-[12.5px] text-slate-500 mt-0.5">${esc(T('b_pmjdy_sub'))}</span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- ④ REJECTION-SHIELD 3.0 -->
    <div class="sv-card p-6 reveal">
      <div class="flex items-start justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2.5">
          <span class="num-chip">4</span>
          <div>
            <p class="mono-label">${esc(T('forensics'))}</p>
            <p class="text-[13.5px] text-slate-500 mt-0.5">${esc(T('forensics_hint'))}</p>
          </div>
        </div>
        <div class="flex gap-2">
          <span class="stamp stamp-ochre !py-1 text-[12px]" id="checksCount">8 ${esc(T('checks_word'))}</span>
          <span class="stamp stamp-crimson !py-1 text-[12px]" id="flaggedCount">0 ${esc(T('flagged_word'))}</span>
        </div>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4" id="forensicGrid">
        <label class="toggle-pill" data-fk="fkStudent"><span class="t-dot">✓</span><span>${esc(T('fk_student'))}</span></label>
        <label class="toggle-pill" data-fk="fkWidow"><span class="t-dot">✓</span><span>${esc(T('fk_widow'))}</span></label>
        <label class="toggle-pill" data-fk="fkTax"><span class="t-dot">✓</span><span>${esc(T('fk_tax'))}</span></label>
        <label class="toggle-pill" data-fk="fkMerged"><span class="t-dot">✓</span><span>${esc(T('fk_merged'))}</span></label>
        <label class="toggle-pill" data-fk="fkNpci"><span class="t-dot">!</span><span>${esc(T('fk_npci'))}</span><span class="fix-tag">FIX</span></label>
        <label class="toggle-pill" data-fk="fkName"><span class="t-dot">✓</span><span>${esc(T('fk_name'))}</span></label>
        <label class="toggle-pill" data-fk="fkRd"><span class="t-dot">✓</span><span>${esc(T('fk_rd'))}</span></label>
        <label class="toggle-pill" data-fk="fkW10"><span class="t-dot">✓</span><span>${esc(T('fk_w10'))}</span></label>
      </div>
    </div>

    <!-- ⑤ NATURAL-LANGUAGE SITUATION -->
    <div class="sv-card p-6 reveal">
      <div class="flex items-start justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2.5">
          <span class="num-chip">5</span>
          <div>
            <p class="mono-label">${esc(T('voice_title'))}</p>
            <p class="text-[13.5px] text-slate-500 mt-0.5">${esc(T('voice_hint'))}</p>
          </div>
        </div>
        <div class="flex gap-2">
          <span class="stamp stamp-sky !py-1 text-[12px]">🎙 ${esc(T('dictate_chip'))}</span>
          <span class="stamp stamp-emerald !py-1 text-[12px]">${esc(T('pii_on'))}</span>
        </div>
      </div>
      <textarea id="situationBox" rows="3" maxlength="400" class="field-input mt-3 resize-y" style="line-height:1.6" placeholder="${esc(T('voice_hint'))}" oninput="updateDetectedFlags()"></textarea>
      <p class="mono text-[12px] text-[#B45309] mt-1.5 min-h-[18px]" id="detectedFlags"></p>
      <div class="flex flex-wrap items-center justify-between gap-2 mt-1">
        <button id="micBtn" onclick="toggleDictation()" class="btn-ghost px-3.5 py-2 text-[13.5px] flex items-center gap-1.5 mono">🎙 ${esc(T('dictate_btn'))} <span class="text-slate-400">webkitSpeechRecognition</span></button>
        <p class="mono text-[11.5px] text-slate-400">${esc(T('pii_scan'))}</p>
      </div>
    </div>

    <!-- CTA -->
    <div class="reveal" id="submitZone">
      <button id="submitBtn" onclick="submitIntake()" class="btn-primary w-full py-4 text-[16px] tracking-wide">⚡ ${esc(T('cta'))} →</button>
      <div id="calcStatus" class="hidden mt-3 flex items-center gap-2 justify-center text-[14px] font-semibold text-[#1E3A5F]">
        <span class="live-dot" style="background:#D97706"></span><span>${esc(T('computing'))}</span>
      </div>
    </div>

    <p class="text-center text-[13.5px] text-slate-500 pb-2" style="line-height:1.65">${esc(T('intakeFoot'))}</p>
  </section>`;

  renderBundleCards();
  rebuildPresets();
  if (S.profile) syncProfileToForm(S.profile);
  selectBank(bankPick);
  updateDetectedFlags();
  initRevealObserver();
}

/* ---------------- step pills (navy header) ---------------- */
function showPills(viewName) {
  const pills = { intake: 'stepPill1', schemes: 'stepPill2', detail: 'stepPill3' };
  Object.entries(pills).forEach(([view, id]) => {
    const el = $(id); if (!el) return;
    el.classList.toggle('active', view === viewName);
  });
}

/* ---------------- form ↔ state sync ---------------- */
function syncProfileToForm(p) {
  if (!p) return;
  const set = (id, v) => { const el = $(id); if (el && v !== undefined && v !== null) el.value = v; };
  set('formName', p.name && !String(p.name).includes('Family') ? p.name : '');
  set('formAge', p.age); set('formGender', p.gender); set('formState', p.state);
  set('formOccupation', p.occupation); set('formIncome', p.income);
  set('formCategory', p.category); set('formRation', p.rationCard); set('formLand', p.land);
  if (p.bankType) selectBank(p.bankType);
  const checks = { fkStudent: p.isStudent, fkWidow: p.isWidow, fkTax: p.isTaxPayer };
  Object.entries(checks).forEach(([id, v]) => {
    const el = document.querySelector(`[data-fk="${id}"]`); if (el) el.classList.toggle('on', Boolean(v));
  });
  updateFlagCount();
}
function readProfileFromForm() {
  const occupation = $('formOccupation').value;
  const rationCard = $('formRation').value;
  const land = $('formLand') ? $('formLand').value : 'landless';
  const income = Number($('formIncome').value) || 120000;
  const fk = id => { const el = document.querySelector(`[data-fk="${id}"]`); return el ? el.classList.contains('on') : false; };
  const p = {
    name: ($('formName').value.trim() || 'Citizen').slice(0, 60),
    age: Math.max(1, Number($('formAge').value) || 25),
    gender: $('formGender').value,
    state: $('formState').value,
    occupation, income, land,
    category: $('formCategory').value,
    rationCard, bankType: S.bankPick || 'regular',
    isStudent: occupation === 'student' || fk('fkStudent'),
    isWidow: fk('fkWidow'),
    isTaxPayer: fk('fkTax'),
    isBPL: rationCard === 'BPL' || rationCard === 'AAY'
  };
  p.worstCase = fk('fkW10');
  return p;
}
function updateFlagCount() {
  const npci = document.querySelector('[data-fk="fkNpci"]');
  const name = document.querySelector('[data-fk="fkName"]');
  const flagged = [];
  if (npci && !npci.classList.contains('on')) flagged.push(npci);
  if (name && !name.classList.contains('on')) flagged.push(name);
  if ((S.bankPick || 'regular') === 'pmjdy') { /* jan dhan cap flagged implicitly */ }
  document.querySelectorAll('.toggle-pill').forEach(el => {
    if (el.getAttribute('data-fk') === 'fkNpci') el.classList.toggle('flagged', !el.classList.contains('on'));
    if (el.getAttribute('data-fk') === 'fkName') el.classList.toggle('flagged', !el.classList.contains('on'));
  });
  const fc = $('flaggedCount'); if (fc) fc.textContent = flagged.length + ' ' + T('flagged_word');
}
document.addEventListener('click', e => {
  const pill = e.target && e.target.closest ? e.target.closest('.toggle-pill') : null;
  if (pill && e.target.tagName !== 'INPUT') { pill.classList.toggle('on'); updateFlagCount(); }
});

/* ---------------- life-event bundle cards (always available, pre-harness) ---------------- */
const BUNDLE_CARDS = [
  { id: 'BUNDLE_COLLEGE',         emo: '🎓', title: 'College Admission',  val: 85000,  approximate: true,  sub: 'Pragati + Laptop' },
  { id: 'BUNDLE_FARM_UPGRADE',    emo: '🌾', title: 'Farm Upgrade',       val: 195000, approximate: true,  sub: 'Solar + Ganga Kalyana' },
  { id: 'BUNDLE_WIDOW_EMERGENCY', emo: '🕊', title: 'Widow Emergency',    val: 72000,  approximate: false, sub: 'Pension + BOCW' },
  { id: 'BUNDLE_WORKER_UPGRADE',  emo: '👷', title: 'Worker Upgrade',     val: 36000,  approximate: true,  sub: 'BOCW education' },
  { id: 'BUNDLE_MATERNITY_BIRTH', emo: '🤰', title: 'Maternity & Birth',  val: 30000,  approximate: true,  sub: 'PMVY + JSY' }
];
function inrShort(n) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(n % 100000 === 0 ? 0 : 2).replace(/\.?0+$/, '') + 'L';
  if (n >= 1000) return '₹' + Math.round(n / 1000) + 'k';
  return '₹' + n;
}
function renderBundleCards() {
  const grid = $('bundleGrid'); if (!grid) return;
  grid.innerHTML = BUNDLE_CARDS.map(b => `
    <button class="bundle-card hover-spring" onclick="selectBundleAndSearch('${b.id}')">
      <span class="bundle-emo">${b.emo}</span>
      <span class="font-display font-bold text-[16.5px] text-[#0A2540] leading-tight">${esc(b.title)}</span>
      <span class="mono font-bold text-[14.5px] text-[#B45309]">~${inrShort(b.val)}/yr</span>
      <span class="text-[12.5px] text-slate-500">${esc(b.sub)}</span>
      <span class="mono text-[11px] tracking-[0.1em] text-[#1E3A5F] font-bold mt-auto pt-1">${esc(T('prefill_1click'))} →</span>
    </button>`).join('');
}

function fillPreset(key) {
  const person = PERSONAS[key]; if (!person) return;
  if (key === 'family') S.household = FAMILY_MEMBERS.map(m => ({ ...m.profile, name: m.name }));
  else S.household = [{ ...person.profile }];
  S.profile = { ...person.profile };
  S.activePresetKey = key;
  syncProfileToForm(S.profile);
}
function submitIntake() {
  if (S.busy) return;
  const p = readProfileFromForm();
  const box = $('situationBox');
  const reds = redactionWarnings((box ? box.value : '') + ' ' + p.name);
  if (reds.length) { toast('🚫 ' + reds.join(', ') + ' ' + T('redacted_toast'), true); }
  S.profile = p;
  S.household = null;
  const msg = (box ? box.value : '').slice(0, 200);
  runHarness(msg, p);
}
