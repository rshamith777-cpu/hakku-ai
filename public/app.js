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
  busy: false, serving: null, fontScale: 1, netLatency: 0
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
  if (n === 1) { backToIntake(); return; }
  if (n === 2) { if (S.resultMeta) { renderSchemes(); } else { toast(T('toast_busy'), true); } return; }
  if (n === 3) { if (S.activeSchemeId && S.catalog.length) { openSchemeDetail(S.activeSchemeId); } else if (S.resultMeta) { renderSchemes(); toast(T('toast_busy'), true); } else { toast(T('toast_busy'), true); } }
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
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, SECURE.key, new TextEncoder().encode(JSON.stringify(payload))));
  const blob = new Uint8Array(iv.length + ct.length);
  blob.set(iv); blob.set(ct, iv.length);
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hakku-session': SECURE.sessionId }, body: JSON.stringify({ enc: _b64url(blob) }) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  if (!j.env) return j;
  const raw = _fromB64url(j.d);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, SECURE.key, raw.slice(12));
  return JSON.parse(new TextDecoder().decode(pt));
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
