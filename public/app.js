/* =====================================================================
   HAKKU 5.0 — SOVEREIGN CLIENT CORE  (app.js part 1: core & services)
   Zero-persistent PII · Volatile RAM · Session auto-erase · TTS · Voice
   ===================================================================== */
"use strict";
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');

/* ---------------- volatile session state (dies on refresh) ---------------- */
const S = {
  view: 'intake', profile: null, household: [], matched: [], catalog: [],
  resultMeta: null, activeSchemeId: null, activeSchemeObj: null,
  filter: 'ALL', searchQ: '', lang: 'English',
  dossierMode: 'operator', dossierCache: {}, bagChecked: {}, sessionId: null,
  busy: false, serving: null, fontScale: 1, netLatency: 0,
  stepUnlocked: 1, formTouched: []
};

/* ---------------- toasts ---------------- */
function toast(msg, isErr) {
  const box = $('toastBox'); if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; setTimeout(() => t.remove(), 420); }, 3400);
}

/* ---------------- i18n ---------------- */
function T(key) {
  const pack = window.HAKKU_I18N[S.lang] || window.HAKKU_I18N.English;
  return pack[key] || window.HAKKU_I18N.English[key] || key;
}
function setLanguage(lang) {
  S.lang = window.HAKKU_I18N[lang] ? lang : 'English';
  document.documentElement.lang = S.lang === 'English' ? 'en' : S.lang === 'Kannada' ? 'kn' : S.lang === 'Hindi' ? 'hi' : S.lang === 'Tamil' ? 'ta' : 'te';
  document.querySelectorAll('#langSwitcher .lang-btn').forEach(b => {
    const on = (b.textContent.trim() === 'EN' && S.lang === 'English') || b.getAttribute('data-lang') === S.lang;
    b.classList.toggle('active', on);
  });
  applyI18nStatic();
  stopSpeech(true);
  if (S.view === 'schemes') renderSchemes();
  if (S.view === 'detail' && S.activeSchemeObj) openSchemeDetail(S.activeSchemeId, true);
  if (S.view === 'intake' && S.resultMeta) renderIntake(true);
}
function applyI18nStatic() {
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = T(el.getAttribute('data-i18n')); if (typeof v === 'string') el.innerHTML = v; });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = T(el.getAttribute('data-i18n-ph')); });
  const lbl = $('listenLabel'); if (lbl) lbl.textContent = SPEECH.on ? T('stop') : T('listen');
}
function rescaleFont(dir) {
  S.fontScale = Math.min(1.35, Math.max(0.8, +(S.fontScale + dir * 0.1).toFixed(2)));
  document.documentElement.style.fontSize = (S.fontScale * 100).toFixed(0) + '%';
  const tag = $('fontScaleTag'); if (tag) tag.style.fontSize = Math.round(13 * S.fontScale) + 'px';
}
/* header step pills → navigate the 3-step workflow */
function goStep(n) {
  if (n > (S.stepUnlocked || 1)) { toast(T('toast_locked'), true); return; }
  if (n === 1) { backToIntake(); return; }
  if (n === 2) { if (S.resultMeta) { renderSchemes(); } else { toast(T('toast_busy'), true); } return; }
  if (n === 3) { if (S.activeSchemeId && S.catalog.length) { openSchemeDetail(S.activeSchemeId); } else if (S.resultMeta) { renderSchemes(); toast(T('toast_busy'), true); } else { toast(T('toast_busy'), true); } }
}
function updateStepTabs() {
  [1, 2, 3].forEach(n => {
    const el = $('stepPill' + n); if (!el) return;
    el.classList.toggle('locked', n > (S.stepUnlocked || 1));
  });
}
function rebuildPresets() {
  const row = $('presetRow'); if (!row) return;
  const p = PERSONAS.ananya;
  row.innerHTML = `<button class="persona-pill" onclick="runDemo()">
    <span class="persona-av">A</span>
    <span class="min-w-0"><span class="block font-bold text-[14.5px] text-[#111111] leading-tight">${esc(T('demo_name'))}</span>
    <span class="block mono text-[11.5px] text-[#565A5B]">${esc(T('demo_sub'))}</span></span>
    <span class="mono text-[10px] font-bold text-[#FF3B30] ml-auto whitespace-nowrap">${esc(T('demo_run'))} →</span>
  </button>`;
}
function runDemo() {
  fillPreset('ananya');
  runHarness('', PERSONAS.ananya.profile);
}

/* ---------------- session lifecycle / DPDP volatile RAM ---------------- */
/* No visible timers: state lives only in this tab's RAM and dies when the tab closes. */
function sessionStamp(tag) {
  S.sessionId = tag || (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10).toUpperCase());
  const ses = 'SES-' + S.sessionId.toUpperCase().slice(0, 4);
  const el = $('vaultSessionTag'); if (el) el.textContent = ses;
  const f = $('footSession'); if (f) f.textContent = 'SESSION ' + ses;
  const d = $('mastDate'); if (d) d.textContent = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}
function eraseSessionNow(manual) {
  stopSpeech(true);
  S.profile = null; S.household = []; S.matched = []; S.catalog = [];
  S.resultMeta = null; S.activeSchemeId = null; S.activeSchemeObj = null;
  S.dossierCache = {}; S.serving = null;
  S.stepUnlocked = 1; S.formTouched = []; updateStepTabs();
  SECURE.key = null; SECURE.sessionId = null; SECURE.ready = false; SECURE.failed = false;
  fetch('/api/session/wipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: S.sessionId }) }).catch(() => {});
  if (manual) { toast(T('toast_wiped')); renderIntake(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }
}

/* ---------------- SECURE: ECDH P-256 → HKDF → AES-256-GCM envelope ---------------- */
const SECURE = { sessionId: null, key: null, ready: false, failed: false };
function _b64url(buf) { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function _fromB64url(str) { const b = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
async function secureHandshake() {
  if (SECURE.ready || SECURE.failed) return;
  try {
    const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const spki = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey));
    const res = await fetch('/api/security/handshake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientPublicKey: _b64url(spki) }) });
    if (!res.ok) throw new Error('handshake ' + res.status);
    const hs = await res.json();
    const serverPub = await crypto.subtle.importKey('spki', _fromB64url(hs.serverPublicKey), { name: 'ECDH', namedCurve: 'P-256' }, true, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: serverPub }, kp.privateKey, 256));
    const hk = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
    SECURE.key = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('hakku5.0-dpdp-salt-v1'), info: new TextEncoder().encode('hakku-aes-256-gcm-envelope') },
      hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    SECURE.sessionId = hs.sessionId;
    SECURE.ready = true;
    const badge = $('secCipher'); if (badge) badge.textContent = 'AES-256-GCM ✓';
  } catch (e) { SECURE.failed = true; }
}
async function securePost(path, payload) {
  await secureHandshake();
  if (!SECURE.ready) {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, SECURE.key, new TextEncoder().encode(JSON.stringify(payload))));
    const blob = new Uint8Array(iv.length + ct.length);
    blob.set(iv); blob.set(ct, iv.length);
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hakku-session': SECURE.sessionId }, body: JSON.stringify({ enc: _b64url(blob) }) });
    if (res.status === 401 || res.status === 400) {
      /* Serverless instance rotated or session ticket expired -> auto-resync with direct JSON */
      SECURE.ready = false;
      const r2 = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r2.ok) throw new Error('HTTP ' + r2.status);
      return r2.json();
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (!j.env) return j;
    const raw = _fromB64url(j.d);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, SECURE.key, raw.slice(12));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch (err) {
    /* If decryption or envelope fetch fails, gracefully fallback to plain JSON */
    SECURE.ready = false;
    const r2 = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r2.ok) throw new Error('HTTP ' + r2.status);
    return r2.json();
  }
}

/* ---------------- Web Speech (listen / stop) ---------------- */
const SPEECH = { on: false, queueEmpty: true };
function toggleGlobalSpeech() {
  if (SPEECH.on) { stopSpeech(); return; }
  let text = '';
  if (S.view === 'detail' && S.activeSchemeObj) text = buildSpeechForScheme(S.activeSchemeObj);
  else if (S.view === 'schemes') text = buildSpeechForVault();
  else text = T('speech_intake');
  speakText(text);
}
function speakText(text) {
  if (!('speechSynthesis' in window)) { toast('🔊 Not supported', true); return; }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = S.lang === 'Kannada' ? 'kn-IN' : S.lang === 'Hindi' ? 'hi-IN' : S.lang === 'Tamil' ? 'ta-IN' : S.lang === 'Telugu' ? 'te-IN' : 'en-IN';
  utter.rate = 0.95; utter.pitch = 1;
  const words = text.split(/(?<=[.!?।])\s+/).reduce((acc, w, i) => {
    const k = Math.floor(i / 45);
    (acc[k] = acc[k] || []).push(w); return acc;
  }, []).map(chunk => chunk.join(' '));
  const btn = $('listenBtn');
  SPEECH.on = true;
  if (btn) { btn.classList.add('speaking-pulse'); const lb = $('listenLabel'); if (lb) lb.textContent = T('stop'); $('listenIcon').textContent = '⏹️'; }
  utter.onend = () => { stopSpeech(true); };
  utter.onerror = () => { stopSpeech(true); };
  window.speechSynthesis.speak(utter);
}
function stopSpeech(silent) {
  SPEECH.on = false;
  try { window.speechSynthesis.cancel(); } catch (e) { /* ok */ }
  const btn = $('listenBtn');
  if (btn) { btn.classList.remove('speaking-pulse'); const lb = $('listenLabel'); if (lb) lb.textContent = T('listen'); const ic = $('listenIcon'); if (ic) ic.textContent = '🔊'; }
}
function buildSpeechForScheme(s) {
  const parts = [
    (T('slip')).replace(/[🖨️]/g, ''),
    s.name || '',
    (s.ministry ? (s.level === 'Central' ? T('jur_central') : T('jur_ka')) + ': ' + s.ministry : ''),
    T('fee_official') + ((s.channel && s.channel.statutoryFee) || '₹0–₹30'),
    (s.benefitSummary || '')
  ];
  return parts.filter(Boolean).join('. ');
}
function buildSpeechForVault() {
  if (!S.resultMeta) return T('speech_done');
  return T('v2_hi') + ' ' + (S.profile && S.profile.name ? S.profile.name : '') + '. ' + inr(S.resultMeta.totalDirectAnnualINR) + ' ' + T('dbt_year') + '. ' +
    (S.matched.length || 0) + ' ' + T('schemes_word') + '. ' + T('speech_done');
}

/* ---------------- voice dictation (mic) ---------------- */
let RECOG = null;
function toggleDictation() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $('micBtn');
  if (!SR) { toast('🎙️ Not supported', true); return; }
  if (RECOG) { try { RECOG.stop(); } catch (e) { /* ok */ } RECOG = null; if (btn) btn.textContent = '🎙️'; return; }
  RECOG = new SR();
  RECOG.lang = S.lang === 'Kannada' ? 'kn-IN' : S.lang === 'Hindi' ? 'hi-IN' : S.lang === 'Tamil' ? 'ta-IN' : S.lang === 'Telugu' ? 'te-IN' : 'en-IN';
  RECOG.interimResults = false; RECOG.continuous = false;
  RECOG.onresult = e => { const box = $('situationBox'); if (box) box.value = (box.value ? box.value + ' ' : '') + e.results[0][0].transcript.slice(0, 140); };
  RECOG.onerror = () => { toast('🎙️ Mic error', true); };
  RECOG.onend = () => { RECOG = null; if (btn) btn.textContent = '🎙️'; };
  if (btn) btn.textContent = '⏹️';
  try { RECOG.start(); } catch (e) { toast('🎙️ ' + e.message, true); }
}

/* ---------------- Framer-style scroll reveal (video-scroll feel) ---------------- */
let REVEAL_OBS = null;
function initRevealObserver() {
  if (REVEAL_OBS) REVEAL_OBS.disconnect();
  REVEAL_OBS = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); REVEAL_OBS.unobserve(en.target); } });
  }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal:not(.is-in)').forEach(el => REVEAL_OBS.observe(el));
  initFramer();
}

/* ---------------- Framer-style interaction layer (tilt · magnetic · progress) ---------------- */
const FRAMER_BOUND = new WeakSet();
function initFramer() {
  let bar = $('framerProgress');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'framerProgress';
    bar.style.cssText = 'position:fixed;top:0;left:0;height:3px;width:0;background:#FF3B30;z-index:80;pointer-events:none';
    document.body.appendChild(bar);
  }
  if (!window.__framerScroll) {
    window.__framerScroll = true;
    window.addEventListener('scroll', () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    }, { passive: true });
  }
  if (!window.matchMedia('(hover: hover)').matches) return;
  document.querySelectorAll('.scheme-card, .bundle-card, .persona-pill, .bento-white, .seq-card').forEach(el => {
    if (FRAMER_BOUND.has(el)) return;
    FRAMER_BOUND.add(el);
    el.style.willChange = 'transform';
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = 'perspective(800px) rotateX(' + (-py * 3).toFixed(2) + 'deg) rotateY(' + (px * 3).toFixed(2) + 'deg)';
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
  document.querySelectorAll('.btn-primary').forEach(el => {
    if (FRAMER_BOUND.has(el)) return;
    FRAMER_BOUND.add(el);
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = 'translate(' + (dx * 4).toFixed(1) + 'px,' + (dy * 4).toFixed(1) + 'px)';
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
}

/* ---------------- client-side PII redaction check (DPDP) ---------------- */
const REDACT_PATTERNS = [
  { re: /\b\d{4}\s?\d{4}\s?\d{4}\b/, label: 'Aadhaar number' },
  { re: /\b\d{16}\b/, label: '16-digit card/ID' },
  { re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/, label: 'IFSC code' },
  { re: /\b(?:\d[ -]*?){13,19}\b/, label: 'Bank card/account number' },
  { re: /\b\d{10}\b(?![\/\d])/, label: 'Phone number' }
];
function redactionWarnings(text) {
  return (REDACT_PATTERNS || []).filter(p => p.re.test(text || '')).map(p => p.label);
}

/* ---------------- fetch spring (progressive doc reveal) ---------------- */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function revealCard(elSel, delay) {
  await sleep(delay);
  const el = typeof elSel === 'string' ? $(elSel) : elSel;
  if (el) { el.classList.add('is-in'); }
}

/* ---------------- compact A4 print engine (isolated iframe, 1 page) ---------------- */
const PRINT_CSS = `
@page { size: A4; margin: 10mm 11mm; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Marko One', Georgia, serif; color:#111; background:#fff; font-size:11px; line-height:1.55; -webkit-print-color-adjust:exact; print-color-adjust:exact; display:flex; flex-direction:column; min-height:275mm; }
.mono { font-family:'JetBrains Mono', monospace; }
.grow { flex:1 1 auto; }
.pb { break-inside:avoid; }

.mast-row { display:flex; justify-content:space-between; align-items:flex-end; gap:10px; padding-bottom:6px; }
.nameplate { font-size:28px; font-weight:900; letter-spacing:-0.03em; line-height:.95; }
.nameplate span { color:#FF3B30; }
.mast-tag { font-family:'JetBrains Mono',monospace; font-size:7.5px; letter-spacing:.18em; text-transform:uppercase; color:#565A5B; text-align:right; line-height:1.8; }
.rule-triple { border-top:3px double #111; border-bottom:1px solid #111; height:5px; }
.dateline { display:flex; justify-content:space-between; gap:8px; font-family:'JetBrains Mono',monospace; font-size:8px; letter-spacing:.07em; text-transform:uppercase; color:#565A5B; padding:5px 0; border-bottom:1.5px solid #111; }

.stat { border:2px solid #111; background:#FFFDF7; box-shadow:4px 4px 0 #FF3B30; padding:12px 14px; margin:12px 0; display:flex; align-items:stretch; break-inside:avoid; }
.stat .lead { padding-right:14px; }
.stat .big { font-size:27px; font-weight:900; line-height:1.05; }
.stat .cell { border-left:1.5px solid #C4C7C7; padding-left:13px; flex:1; }
.stat .k { font-family:'JetBrains Mono',monospace; font-size:7px; letter-spacing:.13em; text-transform:uppercase; color:#8A4B00; }
.stat .v { font-size:13px; font-weight:900; margin-top:3px; line-height:1.25; }

.sec { font-family:'JetBrains Mono',monospace; font-size:8px; font-weight:700; letter-spacing:.15em; text-transform:uppercase; color:#111; border-bottom:2px solid #111; display:flex; justify-content:space-between; padding-bottom:3px; margin:12px 0 7px; }
.card { border:1.5px solid #111; background:#FFFDF7; padding:10px 12px; break-inside:avoid; }
.two { display:flex; gap:12px; align-items:stretch; }
.two > div { flex:1; min-width:0; }
.two .col55 { flex:1.18; }
.two .col45 { flex:1; }

table.st { width:100%; border-collapse:collapse; }
table.st thead th { background:#F4EFE6; color:#111; font-family:'JetBrains Mono',monospace; font-size:7.5px; letter-spacing:.13em; text-transform:uppercase; text-align:left; padding:5px 7px; border-top:2px solid #111; border-bottom:2px solid #111; }
table.st thead th.num { text-align:right; }
table.st td { padding:5.5px 7px; border-bottom:1px dashed #C4C7C7; vertical-align:top; font-size:10.5px; }
table.st td.num { font-family:'JetBrains Mono',monospace; font-weight:700; white-space:nowrap; text-align:right; font-size:11px; }
table.st td.idx { font-family:'JetBrains Mono',monospace; font-size:8.5px; color:#8A8D8D; white-space:nowrap; }
table.st .sub { font-family:'JetBrains Mono',monospace; font-size:7.5px; color:#565A5B; letter-spacing:.03em; margin-top:1px; }

.tick { display:flex; gap:7px; font-size:10.5px; padding:3px 0; border-bottom:1px dotted #E4DED2; }
.tick:last-child { border-bottom:none; }
.tick .b { font-family:'JetBrains Mono',monospace; font-weight:700; flex:none; width:11px; }
.steps div { display:flex; gap:8px; font-size:10.5px; padding:3px 0; }
.steps div i { font-family:'JetBrains Mono',monospace; font-style:normal; font-weight:700; font-size:8px; color:#8A8D8D; flex:none; width:17px; padding-top:1px; }
.excl { font-size:10px; color:#565A5B; padding:2.5px 0; border-bottom:1px dotted #E4DED2; }
.excl b { color:#111; }
.excl .x { font-family:'JetBrains Mono',monospace; color:#93000A; font-weight:700; }
.docs { font-size:10px; line-height:1.9; }
.docs span { border:1px solid #111; background:#F4EFE6; padding:2px 7px; margin:0 4px 4px 0; display:inline-block; font-family:'JetBrains Mono',monospace; font-size:8px; letter-spacing:.03em; }

.pill { font-family:'JetBrains Mono',monospace; font-size:8px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; border:1.5px solid #111; background:#fff; padding:2.5px 8px; display:inline-block; margin-right:5px; }
.pill.red { border-color:#FF3B30; color:#93000A; background:#FFE3E0; }
.pill.grn { border-color:#10B981; color:#047857; background:#ECFDF5; }
.pill.amb { border-color:#D97706; color:#8A4B00; background:#FEF3C7; }
.trap { border:1.5px solid #FF3B30; background:#FFE3E0; color:#93000A; padding:7px 10px; font-size:10px; margin-top:9px; line-height:1.6; }
.zb { border:2px solid #FF3B30; background:#FFE3E0; color:#93000A; padding:8px 11px; font-size:9.5px; line-height:1.6; }

.kv { display:flex; justify-content:space-between; gap:10px; border-bottom:1px dashed #C4C7C7; padding:4px 0; font-size:10.5px; }
.kv:last-child { border-bottom:none; }
.kv .k { font-family:'JetBrains Mono',monospace; font-size:7.5px; letter-spacing:.1em; text-transform:uppercase; color:#565A5B; padding-top:2px; flex:none; }
.qrbox { border:2px solid #111; padding:6px; width:124px; flex:none; background:#fff; }
.qrbox img { display:block; width:110px; height:110px; }
.qrfb { display:none; font-family:'JetBrains Mono',monospace; font-size:7.5px; padding:12px 5px; text-align:center; word-break:break-all; letter-spacing:.04em; line-height:1.7; }
.qrrow { display:flex; gap:14px; align-items:center; margin-top:12px; break-inside:avoid; }
.slip-head { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-top:10px; }
.slip-head h2 { font-size:20px; font-weight:900; line-height:1.2; letter-spacing:-0.01em; }
.sub { font-family:'JetBrains Mono',monospace; font-size:7.5px; color:#565A5B; letter-spacing:.05em; }

.foot { border-top:3px double #111; margin-top:10px; padding-top:6px; display:flex; justify-content:space-between; font-family:'JetBrains Mono',monospace; font-size:7.5px; letter-spacing:.11em; text-transform:uppercase; color:#565A5B; }`;
function printCompact(bodyHtml, title) {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(f);
  const doc = f.contentWindow.document;
  doc.open();
  doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title || 'HAKKU Statutory Slip') + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Marko+One&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">' +
    '<style>' + PRINT_CSS + '</style></head><body>' + bodyHtml + '</body></html>');
  doc.close();
  f.contentWindow.addEventListener('afterprint', () => setTimeout(() => { if (f.parentNode) f.remove(); }, 400));
  const imgs = Array.prototype.slice.call(doc.images);
  const ready = Promise.all(imgs.map(im => (im.complete && im.naturalWidth) ? 1 : new Promise(r => { im.onload = () => r(1); im.onerror = () => { im.style.display = 'none'; const fb = im.parentNode && im.parentNode.querySelector('.qrfb'); if (fb) fb.style.display = 'block'; r(1); }; setTimeout(r, 4000); })));
  Promise.resolve(ready).then(() => setTimeout(() => {
    try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Print blocked', true); f.remove(); }
    setTimeout(() => { if (f.parentNode) f.remove(); }, 90000);
  }, 250));
}
function printMasthead(tagline) {
  return '<div class="mast-row"><div class="nameplate">HAKKU<span>.</span></div><div class="mast-tag">' + tagline + '</div></div><div class="rule-triple"></div>';
}
function printDateline(left, right) {
  return '<div class="dateline"><span>' + left + '</span><span>' + right + '</span></div>';
}
function printZeroBribe() {
  return '<div class="zb"><b>ZERO-BRIBE NOTICE:</b> All DBT transfers are 100% automated via NPCI straight to your bank account. Any bribe demand above &#8377;30 is reportable to the Toll-Free <b>1902</b> Sakala / Janaspandana Helpline. &#3282;&#3270;&#3232;&#3262; DBT &#3233;&#3239; &#3233;&#3263;&#3240;&#3263;&#3240;&#3262;&#3233;&#3262;&#3236;&#3262; &#3237;&#3263; &#3231;&#3263;&#3240;&#3262;&#3233;&#3236;&#3262;&#3237;&#3262; &#3237;&#3240;&#3263;. &#2360;&#2366;&#2352;&#2366; DBT &#2349;&#2369;&#2327;&#2340;&#2366;&#2344; &#2360;&#2368;&#2343;&#2375; NPCI &#2342;&#2381;&#2357;&#2366;&#2352;&#2366; &#2310;&#2340;&#2366; &#2361;&#2376;&#2403;</div>';
}
function printFoot(left, right) {
  return '<div class="grow"></div><div class="foot"><span>' + left + '</span><span>' + right + '</span></div>';
}
