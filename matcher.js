const fs = require('fs');
const path = require('path');

function loadSchemes() {
  const filePath = path.join(__dirname, 'data', 'schemes.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Deterministic Eligibility Rule Engine.
 * The LLM NEVER invents a scheme or guesses eligibility.
 * Every match is computed strictly against verified criteria in data/schemes.json.
 */
function matchCitizenProfile(profile) {
  const schemes = loadSchemes();
  const matched = [];

  const age = Number(profile.age || 25);
  const income = Number(profile.income || 100000);
  const gender = (profile.gender || 'any').toLowerCase();
  const occupation = (profile.occupation || 'other').toLowerCase();
  const category = (profile.category || 'General').toUpperCase();
  const state = profile.state || 'Karnataka';
  const isBPL = Boolean(profile.isBPL);
  const isStudent = Boolean(profile.isStudent) || occupation === 'student';
  const isWidow = Boolean(profile.isWidow);

  for (const scheme of schemes) {
    const e = scheme.eligibility || {};
    const reasons = [];

    if (e.isStudent && !isStudent) continue;
    if (e.isStudent && isStudent) reasons.push('Active Student');

    if (e.isWidow && !isWidow) continue;
    if (e.isWidow && isWidow) reasons.push('Widow Status Verified');

    if (e.bplRequired && !isBPL) continue;
    if (e.bplRequired && isBPL) reasons.push('BPL / Priority Household');

    if (e.ageMin !== undefined && age < e.ageMin) continue;
    if (e.ageMax !== undefined && age > e.ageMax) continue;
    if (e.ageMin !== undefined || e.ageMax !== undefined) {
      reasons.push(`Age ${age} fits requirement`);
    }

    if (e.maxIncome !== undefined && income > e.maxIncome) continue;
    if (e.maxIncome !== undefined) {
      reasons.push(`Income ₹${income.toLocaleString('en-IN')} ≤ ₹${e.maxIncome.toLocaleString('en-IN')} limit`);
    }

    if (e.gender && !e.gender.map(g => g.toLowerCase()).includes(gender)) continue;
    if (e.gender) reasons.push(`Gender (${profile.gender})`);

    if (e.occupations && !e.occupations.map(o => o.toLowerCase()).includes(occupation)) continue;
    if (e.occupations) reasons.push(`Occupation (${profile.occupation})`);

    if (e.categories && !e.categories.map(c => c.toUpperCase()).includes(category)) continue;
    if (e.categories) reasons.push(`Category (${category})`);

    if (e.states && !e.states.includes('All') && !e.states.includes(state)) continue;

    matched.push({
      ...scheme,
      matchReasons: reasons
    });
  }

  // Compute Unclaimed Benefits Meter totals
  const totalDirectAnnualINR = matched.reduce((sum, s) => sum + (s.annualValueINR || 0), 0);
  const totalHealthCoverINR = matched.reduce((sum, s) => sum + (s.coverageValueINR || 0), 0);

  // Deduplicate all required documents across matched schemes
  const consolidatedDocuments = Array.from(
    new Set(matched.flatMap(s => s.documents || []))
  );

  return {
    matchedSchemes: matched,
    totalDirectAnnualINR,
    totalHealthCoverINR,
    schemeCount: matched.length,
    consolidatedDocuments
  };
}

module.exports = { matchCitizenProfile, loadSchemes };

