/* =====================================================================
   HAKKU 5.0 — app.js part 5: boot, hash router, global exports
   ===================================================================== */
"use strict";

/* deep-link hash routing: #/scheme/<id> opens detail 3 directly */
window.addEventListener('hashchange', () => {
  const m = location.hash.match(/^#\/scheme\/([a-z0-9-]+)/i);
  if (m && S.resultMeta && S.catalog.length) { openSchemeDetail(m[1]); return; }
  if (location.hash === '#/schemes' && S.resultMeta) { renderSchemes(); return; }
});

/* visible error trap: any runtime exception surfaces as a red toast */
window.addEventListener('error', e => {
  try { toast('⚠ SCRIPT: ' + (e.message || 'unknown error') + (e.lineno ? ' · line ' + e.lineno : ''), true); } catch (_) { }
});
window.addEventListener('unhandledrejection', e => {
  try { toast('⚠ ' + ((e.reason && e.reason.message) || 'network failure'), true); } catch (_) { }
});

function boot() {
  if (!window.HAKKU_I18N) { setTimeout(boot, 60); return; }
  sessionStamp();
  applyI18nStatic();
  updateStepTabs();
  renderIntake();
  secureHandshake();
  if ('speechSynthesis' in window) { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices(); }
  window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); const si = $('schemeSearch'); if (si && S.view === 'schemes') si.focus(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stopSpeech(true); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
