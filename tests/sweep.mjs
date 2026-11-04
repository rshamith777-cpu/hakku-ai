/* HAKKU 5.0 — 100-profile verification sweep
   Oracle: independently re-implements matcher.js eligibility gates and
   verifies every API response is real, consistent and non-hallucinated. */
import fs from 'fs';

const BASE = 'http://localhost:3000';
const catalog = JSON.parse(fs.readFileSync(new URL('../data/schemes.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(catalog.map(s => [s.id, s]));
const CATALOG_NAMES = new Set(catalog.map(s => s.name));

/* ---------- ORACLE (mirrors matcher.js gate semantics exactly) ---------- */
function oracleGates(p, s) {
  const age = Number(p.age || 25);
  const incomeRaw = Number(p.income);
  const income = Number.isFinite(incomeRaw) ? incomeRaw : 100000;
  const gender = (p.gender || 'any').toLowerCase();
  const occupation = (p.occupation || 'other').toLowerCase();
  const category = (p.category || 'OBC').toUpperCase();
  const state = (p.state || 'karnataka').toLowerCase();
  const isBPL = Boolean(p.isBPL);
  const isStudent = Boolean(p.isStudent) || occupation === 'student';
  const isWidow = Boolean(p.isWidow);
  const isTaxPayer = Boolean(p.isTaxPayer);
  const e = s.eligibility || {};
  const isKA = (s.level || '').toLowerCase().includes('karnataka');
  const isCentral = (s.level || '').toLowerCase().includes('central');
  if (state !== 'karnataka' && state !== 'all' && isKA && !isCentral) return false;
  if (e.excludeTaxPayer && isTaxPayer) return false;
  if (e.isStudent && !isStudent) return false;
  if (e.isWidow && !isWidow) return false;
  if (e.bplRequired && !isBPL) return false;
  if (e.ageMin !== undefined && age < e.ageMin) return false;
  if (e.ageMax !== undefined && age > e.ageMax) return false;
  const senior70 = s.id === 'pmjay-ayushman' && age >= 70;
  if (!senior70 && e.maxIncome !== undefined && income > e.maxIncome) return false;
  if (e.gender && !e.gender.map(g => g.toLowerCase()).includes(gender)) return false;
  if (e.occupations && !e.occupations.map(o => o.toLowerCase()).includes(occupation)) return false;
  if (e.categories && !e.categories.map(c => c.toUpperCase()).includes(category)) return false;
  return true;
}

function expectedMatch(membersInput) {
  const members = [membersInput[0]];
  for (const m of membersInput.slice(1)) {
    if (!m || typeof m !== 'object') continue;
    if ((m.name || 'Citizen') === (membersInput[0].name || 'Citizen') && Number(m.age || 25) === Number(membersInput[0].age || 25)) continue;
    members.push(m);
  }
  const kept = new Map();
  const hhGroups = new Set();
  for (const m of members) {
    const passing = catalog.filter(s => oracleGates(m, s));
    const groupBest = new Map();
    const finalIds = [];
    for (const s of passing) {
      if (!s.exclusivityGroup) { finalIds.push(s.id); continue; }
      const cur = groupBest.get(s.exclusivityGroup);
      if (!cur) groupBest.set(s.exclusivityGroup, s);
      else if (s.annualValueINR > cur.annualValueINR) groupBest.set(s.exclusivityGroup, s);
    }
    groupBest.forEach(s => finalIds.push(s.id));
    for (const id of finalIds) {
      const s = byId[id];
      if (s.exclusivityGroup && s.exclusivityGroup.startsWith('HOUSEHOLD_')) {
        if (hhGroups.has(s.exclusivityGroup)) continue;
        hhGroups.add(s.exclusivityGroup);
      }
      kept.set(id, s);
    }
  }
  return [...kept.values()];
}

function expectedReadiness(matched, checks) {
  let score = 100;
  if (checks.npciSeeded === false) score -= 40;
  if (checks.nameMatched === false) score -= 25;
  if (checks.rdValid === false) score -= 20;
  if (checks.hasMergedBankPassbook) score -= 15;
  const hv = matched.filter(s => (s.annualValueINR || 0) >= 45000);
  if (hv.length > 0 && checks.bankAccountType === 'pmjdy') score -= 20;
  return Math.max(5, score);
}

/* ---------- PROFILE GENERATOR ---------- */
let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = a => a[Math.floor(rnd() * a.length)];

const AGES = [5, 12, 17, 18, 19, 22, 25, 30, 38, 45, 55, 60, 65, 70, 75, 85, 100];
const GENDERS = ['male', 'female'];
const OCC = ['student', 'farmer', 'worker', 'artisan', 'vendor', 'unemployed', 'homemaker', 'senior', 'other'];
const INCOMES = [0, 25000, 60000, 90000, 150000, 250000, 300000, 800000, 10000000];
const CATS = ['GEN', 'OBC', 'SC', 'ST'];
const RATION = ['APL', 'BPL', 'Antyodaya'];

const handpicked = [
  { label: 'child-5', p: { name: 'Baby', age: 5, gender: 'female', state: 'karnataka', occupation: 'other', income: 0, category: 'SC', rationCard: 'BPL', isBPL: true } },
  { label: 'teen-17', p: { name: 'Ravi', age: 17, gender: 'male', state: 'karnataka', occupation: 'student', income: 0, category: 'OBC', rationCard: 'APL', isStudent: true } },
  { label: 'ananya-demo', p: { name: 'Ananya Gowda', age: 19, gender: 'female', state: 'karnataka', occupation: 'student', income: 0, category: 'OBC', rationCard: 'APL', isStudent: true } },
  { label: 'farmer-bpl', p: { name: 'Ramesh', age: 45, gender: 'male', state: 'karnataka', occupation: 'farmer', income: 80000, category: 'SC', rationCard: 'BPL', isBPL: true } },
  { label: 'widow-62', p: { name: 'Lakshmi', age: 62, gender: 'female', state: 'karnataka', occupation: 'other', income: 40000, category: 'OBC', rationCard: 'BPL', isWidow: true, isBPL: true } },
  { label: 'senior-75', p: { name: 'Gowda', age: 75, gender: 'male', state: 'karnataka', occupation: 'senior', income: 90000, category: 'GEN', rationCard: 'APL' } },
  { label: 'taxpayer-rich', p: { name: 'Rich', age: 35, gender: 'male', state: 'karnataka', occupation: 'other', income: 1200000, category: 'GEN', rationCard: 'APL', isTaxPayer: true } },
  { label: 'zero-income-bpl', p: { name: 'Poorest', age: 40, gender: 'female', state: 'karnataka', occupation: 'unemployed', income: 0, category: 'ST', rationCard: 'Antyodaya', isBPL: true } },
  { label: 'other-state-student', p: { name: 'Outsider', age: 20, gender: 'male', state: 'maharashtra', occupation: 'student', income: 100000, category: 'OBC', rationCard: 'APL', isStudent: true } },
  { label: 'pmjdy-vendor', p: { name: 'Vendor', age: 40, gender: 'male', state: 'karnataka', occupation: 'vendor', income: 120000, category: 'OBC', rationCard: 'APL' } },
  { label: 'homemaker-28', p: { name: 'Kiran', age: 28, gender: 'female', state: 'karnataka', occupation: 'homemaker', income: 90000, category: 'OBC', rationCard: 'APL' } },
  { label: 'age-100', p: { name: 'Centenarian', age: 100, gender: 'female', state: 'karnataka', occupation: 'senior', income: 0, category: 'OBC', rationCard: 'BPL', isBPL: true } },
  { label: 'artisan-50', p: { name: 'Vishwakarma', age: 50, gender: 'male', state: 'karnataka', occupation: 'artisan', income: 150000, category: 'OBC', rationCard: 'APL' } },
  { label: 'family-4', p: { name: 'Family Head', age: 42, gender: 'male', state: 'karnataka', occupation: 'farmer', income: 150000, category: 'OBC', rationCard: 'APL' },
    hh: [
      { name: 'Wife', age: 38, gender: 'female', state: 'karnataka', occupation: 'homemaker', income: 0, category: 'OBC', rationCard: 'APL' },
      { name: 'Son', age: 16, gender: 'male', state: 'karnataka', occupation: 'student', income: 0, category: 'OBC', rationCard: 'APL', isStudent: true },
      { name: 'Grandma', age: 74, gender: 'female', state: 'karnataka', occupation: 'senior', income: 0, category: 'OBC', rationCard: 'BPL', isBPL: true, isWidow: true }
    ] },
  { label: 'gen-female-30', p: { name: 'Gen', age: 30, gender: 'female', state: 'karnataka', occupation: 'worker', income: 250000, category: 'GEN', rationCard: 'APL' } },
  { label: 'sc-worker-pmjdy', p: { name: 'Bhima', age: 33, gender: 'male', state: 'karnataka', occupation: 'worker', income: 60000, category: 'SC', rationCard: 'BPL', isBPL: true } }
];

const generated = [];
for (let i = 0; i < 84; i++) {
  generated.push({
    label: `gen-${String(i + 1).padStart(3, '0')}`,
    p: {
      name: 'Citizen ' + i,
      age: pick(AGES),
      gender: pick(GENDERS),
      state: rnd() < 0.85 ? 'karnataka' : 'maharashtra',
      occupation: pick(OCC),
      income: pick(INCOMES),
      category: pick(CATS),
      rationCard: pick(RATION),
      bankType: pick(['regular', 'pmjdy']),
      isStudent: rnd() < 0.25,
      isWidow: rnd() < 0.12,
      isTaxPayer: rnd() < 0.15,
      isBPL: rnd() < 0.35
    }
  });
}

const CHECK_SETS = [
  { npciSeeded: false, nameMatched: false, rdValid: false, bankAccountType: 'regular' },
  { npciSeeded: true, nameMatched: true, rdValid: true, bankAccountType: 'regular' },
  { npciSeeded: true, nameMatched: true, rdValid: true, bankAccountType: 'pmjdy' },
  { npciSeeded: false, nameMatched: true, rdValid: true, hasMergedBankPassbook: true, bankAccountType: 'pmjdy' }
];
const MSGS = ['', '', '', 'I am a 45 year old farmer with 2 acres', 'ನನಗೆ 62 ವರ್ಷ ವಿಧವೆ', 'widow with two children need pension', 'student girl btech admission'];

const profiles = handpicked.concat(generated).map((t, i) => ({
  ...t,
  checks: CHECK_SETS[i % CHECK_SETS.length],
  msg: i % 17 === 5 ? pick(MSGS.filter(Boolean)) : ''
}));

/* ---------- RUNNER ---------- */
let pass = 0, fail = 0;
const failures = [];
const stats = { schemes: [], annual: [], engineMs: [], kaOnly: 0, otherState: 0 };
let deterministic = true;

function failCase(label, why) { failures.push(`[${label}] ${why}`); }

async function discover(payload) {
  const r = await fetch(BASE + '/api/harness/discover', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

for (const t of profiles) {
  const before = failures.length;
  const members = [t.p, ...(t.hh || [])];
  const payload = { userMessage: t.msg, currentProfile: t.p, householdMembers: t.hh || [], readinessChecks: t.checks, language: 'English' };
  let res;
  try { res = await discover(payload); } catch (e) { failCase(t.label, 'NETWORK ' + e.message); continue; }

  if (res.status !== 200) { failCase(t.label, `HTTP ${res.status}`); continue; }
  const d = res.data;
  if (d.error) { failCase(t.label, 'error field: ' + d.error + ' ' + (d.detail || '')); continue; }

  /* structural */
  const m = d.matchedSchemes;
  if (!Array.isArray(m)) { failCase(t.label, 'matchedSchemes not array'); continue; }
  if (d.schemeCount !== m.length) failCase(t.label, `schemeCount ${d.schemeCount} != len ${m.length}`);
  if (d.totalCatalogCount !== 24) failCase(t.label, 'catalog count ' + d.totalCatalogCount);
  if (!Number.isFinite(d.totalDirectAnnualINR)) failCase(t.label, 'total NaN');
  const sum = m.reduce((a, s) => a + (s.annualValueINR || 0), 0);
  if (sum !== d.totalDirectAnnualINR) failCase(t.label, `sum ${sum} != total ${d.totalDirectAnnualINR}`);
  if (d.fiveYearWealthINR !== d.totalDirectAnnualINR * 5) failCase(t.label, '5yr mismatch');
  if (d.totalHealthCoverINR < 500000) failCase(t.label, 'health cover < 5L');
  if (d.hiddenGemsCount !== m.filter(s => s.isHiddenGem).length) failCase(t.label, 'hiddenGems mismatch');
  if (!Array.isArray(d.prerequisiteSequence) || d.prerequisiteSequence.length !== 3) failCase(t.label, 'sequencer broken');
  if (!Array.isArray(d.lifeEventBundles) || d.lifeEventBundles.length !== 5) failCase(t.label, 'bundles broken');
  if (!Number.isFinite(d.engineMs) || d.engineMs < 0) failCase(t.label, 'engineMs bad');

  /* anti-hallucination: every id/name must exist in the catalog */
  for (const s of m) {
    if (!byId[s.id]) { failCase(t.label, 'HALLUCINATED id ' + s.id); break; }
    if (byId[s.id].name !== s.name) { failCase(t.label, 'name mutated for ' + s.id); break; }
    if (!Array.isArray(s.matchReasons) || s.matchReasons.length === 0) { failCase(t.label, 'no matchReasons ' + s.id); break; }
    if (!s.channel || !s.channel.channelId) { failCase(t.label, 'no channel ' + s.id); break; }
  }
  for (const s of (d.allCatalogSchemes || [])) if (!byId[s.id]) { failCase(t.label, 'catalog echo hallucinated'); break; }
  for (const n of (d.notifications || [])) if (!byId[n.id]) { failCase(t.label, 'notification hallucinated'); break; }
  for (const c of (d.statutoryConflictsResolved || [])) {
    if (!CATALOG_NAMES.has(c.kept) || !CATALOG_NAMES.has(c.dropped)) failCase(t.label, 'conflict names not in catalog');
  }

  /* oracle: exact expected set (only when no AI enrichment ran) */
  if (!t.msg) {
    const expected = expectedMatch(members).map(s => s.id).sort();
    const actual = m.map(s => s.id).sort();
    const missing = expected.filter(id => !actual.includes(id));
    const extra = actual.filter(id => !expected.includes(id));
    if (missing.length || extra.length) failCase(t.label, `ORACLE mismatch missing=[${missing}] extra=[${extra}]`);
  } else {
    const bad = m.filter(s => !byId[s.id]);
    if (bad.length) failCase(t.label, 'AI path hallucinated schemes');
  }

  /* hard rule spot-checks */
  if ((t.p.state || 'karnataka') !== 'karnataka') {
    stats.otherState++;
    if (m.some(s => (s.level || '').toLowerCase().includes('karnataka'))) failCase(t.label, 'KA scheme leaked to non-KA resident');
  }
  if (t.p.isTaxPayer && m.some(s => s.eligibility && s.eligibility.excludeTaxPayer)) failCase(t.label, 'taxpayer got excludeTaxPayer scheme');

  /* readiness formula */
  const expScore = expectedReadiness(m, t.checks);
  const gotScore = d.readinessAudit && d.readinessAudit.readinessScore;
  if (gotScore !== expScore) failCase(t.label, `readiness ${gotScore} != expected ${expScore}`);
  if (t.checks.bankAccountType === 'pmjdy' && m.some(s => (s.annualValueINR || 0) >= 45000)) {
    const hasCrit = (d.readinessAudit.rejectionRisks || []).some(r => r.severity === 'CRITICAL' && /Jan Dhan/.test(r.title));
    if (!hasCrit) failCase(t.label, 'pmjdy ceiling risk missing');
  }
  if (t.checks.npciSeeded === false && !(d.readinessAudit.rejectionRisks || []).some(r => /NPCI/.test(r.title))) failCase(t.label, 'npci risk missing');
  if (t.checks.nameMatched === false && !(d.readinessAudit.rejectionRisks || []).some(r => /Name Spelling/.test(r.title))) failCase(t.label, 'name-mismatch risk missing');
  if (t.checks.rdValid === false && !(d.readinessAudit.rejectionRisks || []).some(r => /RD Number/.test(r.title))) failCase(t.label, 'rd risk missing');
  if (t.checks.hasMergedBankPassbook && !(d.readinessAudit.rejectionRisks || []).some(r => /Merged PSU Bank/.test(r.title))) failCase(t.label, 'merged-bank risk missing');

  /* docs ⊆ union of scheme docs */
  const docUnion = new Set(m.flatMap(s => byId[s.id] ? byId[s.id].documents || [] : []));
  for (const doc of (d.consolidatedDocuments || [])) if (!docUnion.has(doc)) failCase(t.label, 'foreign document: ' + doc);

  stats.schemes.push(m.length);
  stats.annual.push(d.totalDirectAnnualINR);
  stats.engineMs.push(d.engineMs);

  /* determinism probe on first 6 */
  if (before === 0 && pass < 6) {
    const d2 = (await discover(payload)).data;
    const a = m.map(s => s.id).sort().join(','), b = (d2.matchedSchemes || []).map(s => s.id).sort().join(',');
    if (a !== b || d2.totalDirectAnnualINR !== d.totalDirectAnnualINR) { deterministic = false; failCase(t.label, 'NON-DETERMINISTIC'); }
  }

  if (failures.length === before) pass++; else fail++;
}

/* bundle integrity */
const bundles = (await discover({ userMessage: '', currentProfile: handpicked[2].p, readinessChecks: { npciSeeded: true, bankAccountType: 'regular' } })).data;
for (const b of (bundles.lifeEventBundles || [])) {
  for (const id of b.schemeIds) if (!byId[id]) failCase('bundle-integrity', `bundle ${b.id} references unknown scheme ${id}`);
}

/* ---------- REPORT ---------- */
const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
console.log('==============================================');
console.log(`PROFILES RUN: ${profiles.length}`);
console.log(`PASS: ${pass}   FAIL: ${fail}`);
console.log(`DETERMINISTIC (double-run identical): ${deterministic}`);
console.log(`avg schemes: ${avg(stats.schemes)} | min: ${Math.min(...stats.schemes)} | max: ${Math.max(...stats.schemes)}`);
console.log(`avg annual: ₹${avg(stats.annual).toLocaleString('en-IN')} | max: ₹${Math.max(...stats.annual).toLocaleString('en-IN')}`);
console.log(`avg engine: ${avg(stats.engineMs)}ms | non-KA profiles: ${stats.otherState}`);
if (failures.length) {
  console.log('--- FAILURES ---');
  const uniq = [...new Set(failures)];
  uniq.slice(0, 40).forEach(f => console.log(f));
  if (uniq.length > 40) console.log(`...and ${uniq.length - 40} more`);
} else {
  console.log('ALL CHECKS GREEN — zero hallucination, arithmetic exact, oracle-matched.');
}
