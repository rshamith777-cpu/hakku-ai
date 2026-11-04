/* =====================================================================
   HAKKU 5.0 — app.js part 5: boot, hash router, global exports
   ===================================================================== */
"use strict";

/* deep-link hash routing: #/scheme/<id> opens detail 3 directly */
window.addEventListener('hashchange', () => {
  const m = location.hash.match(/^#\/scheme\/([a-z0-9-]+)/i);
  if (m && S.catalog.length) { openSchemeDetail(m[1]); return; }
  if (location.hash === '#/schemes' && S.resultMeta) { renderSchemes(); return; }
});

function boot() {
  if (!window.HAKKU_I18N) { setTimeout(boot, 60); return; }
  resetWipeCountdown();
  sessionStamp();
  applyI18nStatic();
  renderIntake();
  bootMarquee();
  secureHandshake();
  window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); const si = $('schemeSearch'); if (si && S.view === 'schemes') si.focus(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stopSpeech(true); });
}
async function bootMarquee() {
  const track = $('marqueeTrack');
  if (!track || track.dataset.seeded) return;
  try {
    const res = await fetch('/api/harness/notices');
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.notifications && data.notifications.length) {
      track.dataset.seeded = '1';
      buildMarquee(data.notifications);
    }
  } catch (e) { /* offline-safe placeholder stays */ }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
