const fs = require('fs');
const schemes = require('../data/schemes.json');
const { getChannelForScheme } = require('../matcher');
const out = {};
const add = (k, v) => { out[k] = out[k] || []; if (v && !out[k].includes(v)) out[k].push(v); };
for (const s of schemes) {
  ['name', 'benefitSummary', 'payoutTag', 'commonRejectionTrap', 'statutoryRule', 'deadlineLabel'].forEach(k => add(k, s[k]));
  (s.selfApplySteps || []).forEach(x => add('steps', x));
  (s.criteriaList || []).forEach(x => add('criteria', x));
  (s.documents || []).forEach(x => add('docs', x));
  const ch = getChannelForScheme(s) || {};
  add('channels', ch.channelName); add('auths', ch.channelAuthority); add('notes', ch.specialNote);
}
fs.writeFileSync('tests/_strings.json', JSON.stringify(out, null, 1));
console.log('written. counts:', Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
