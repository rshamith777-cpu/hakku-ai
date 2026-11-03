const fs = require('fs');
const path = require('path');

function loadSchemes() {
  const filePath = path.join(__dirname, 'data', 'schemes.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function evaluateMember(profile, schemes) {
  const age = Number(profile.age || 25);
  const income = Number(profile.income || 100000);
  const gender = (profile.gender || 'any').toLowerCase();
  const occupation = (profile.occupation || 'other').toLowerCase();
  const category = (profile.category || 'OBC').toUpperCase();
  const state = (profile.state || 'karnataka').toLowerCase();
  const isBPL = Boolean(profile.isBPL);
  const isStudent = Boolean(profile.isStudent) || occupation === 'student';
  const isWidow = Boolean(profile.isWidow);
  const isTaxPayer = Boolean(profile.isTaxPayer);

  const rawMatches = [];
  const statutoryConflictsResolved = [];

  for (const scheme of schemes) {
    const e = scheme.eligibility || {};
    const reasons = [];

    // Jurisdiction Check: Skip state-only schemes if resident of another state
    const isKarnatakaScheme = (scheme.level || '').toLowerCase().includes('karnataka');
    const isCentralScheme = (scheme.level || '').toLowerCase().includes('central');
    if (state !== 'karnataka' && state !== 'all' && isKarnatakaScheme && !isCentralScheme) {
      continue;
    }
    if (isKarnatakaScheme) reasons.push('Karnataka State Resident');
    if (isCentralScheme) reasons.push('Central All-India Citizen');

    if (e.excludeTaxPayer && isTaxPayer) continue;
    if (e.isStudent && !isStudent) continue;
    if (e.isStudent && isStudent) reasons.push('Student Verified');

    if (e.isWidow && !isWidow) continue;
    if (e.isWidow && isWidow) reasons.push('Widow Priority');

    if (e.bplRequired && !isBPL) continue;
    if (e.bplRequired && isBPL) reasons.push('BPL Card Holder');

    if (e.ageMin !== undefined && age < e.ageMin) continue;
    if (e.ageMax !== undefined && age > e.ageMax) continue;
    reasons.push(`Age ${age}`);

    const isSenior70PlusAyushman = scheme.id === 'pmjay-ayushman' && age >= 70;
    if (!isSenior70PlusAyushman && e.maxIncome !== undefined && income > e.maxIncome) continue;
    reasons.push(isSenior70PlusAyushman ? '70+ Universal Senior Cover' : `Income ≤ ₹${(e.maxIncome || 250000).toLocaleString('en-IN')}`);

    if (e.gender && !e.gender.map(g => g.toLowerCase()).includes(gender)) continue;
    if (e.occupations && !e.occupations.map(o => o.toLowerCase()).includes(occupation)) continue;
    if (e.categories && !e.categories.map(c => c.toUpperCase()).includes(category)) continue;

    rawMatches.push({
      ...scheme,
      beneficiaryName: profile.name || 'Citizen',
      matchReasons: reasons
    });
  }

  // Statutory Anti-Double-Dipping Conflict Resolution
  const groupBest = {};
  const finalMatches = [];

  for (const m of rawMatches) {
    if (!m.exclusivityGroup) {
      finalMatches.push(m);
      continue;
    }
    const existing = groupBest[m.exclusivityGroup];
    if (!existing) {
      groupBest[m.exclusivityGroup] = m;
    } else if (m.annualValueINR > existing.annualValueINR) {
      statutoryConflictsResolved.push({
        kept: m.name,
        dropped: existing.name,
        rule: `Statutory Anti-Double-Dipping (${m.exclusivityGroup}): Auto-selected higher payout (+₹${m.annualValueINR.toLocaleString('en-IN')}/yr).`
      });
      groupBest[m.exclusivityGroup] = m;
    } else {
      statutoryConflictsResolved.push({
        kept: existing.name,
        dropped: m.name,
        rule: `Statutory Anti-Double-Dipping (${m.exclusivityGroup}): Retained higher/primary benefit (${existing.name}).`
      });
    }
  }

  Object.values(groupBest).forEach(s => finalMatches.push(s));
  return { finalMatches, statutoryConflictsResolved };
}

function matchCitizenProfile(profile, householdMembers = [], readinessChecks = {}) {
  const schemes = loadSchemes();
  const membersToScan = householdMembers && householdMembers.length > 0
    ? householdMembers
    : [profile];

  let allMatched = [];
  let allConflicts = [];
  const seenIds = new Set();
  const seenHouseholdLevelGroups = new Set();

  for (const member of membersToScan) {
    const { finalMatches, statutoryConflictsResolved } = evaluateMember(member, schemes);
    allConflicts.push(...statutoryConflictsResolved);

    for (const s of finalMatches) {
      if (s.exclusivityGroup && s.exclusivityGroup.startsWith('HOUSEHOLD_')) {
        if (seenHouseholdLevelGroups.has(s.exclusivityGroup)) continue;
        seenHouseholdLevelGroups.add(s.exclusivityGroup);
      }
      if (seenIds.has(s.id + ':' + s.beneficiaryName)) continue;
      seenIds.add(s.id + ':' + s.beneficiaryName);
      allMatched.push(s);
    }
  }

  allMatched.sort((a, b) => (b.annualValueINR || 0) - (a.annualValueINR || 0));

  const totalDirectAnnualINR = allMatched.reduce((sum, s) => sum + (s.annualValueINR || 0), 0);
  const fiveYearWealthINR = totalDirectAnnualINR * 5;
  const totalHealthCoverINR = Math.max(500000, allMatched.reduce((sum, s) => sum + (s.coverageValueINR || 0), 0));
  const consolidatedDocuments = Array.from(new Set(allMatched.flatMap(s => s.documents || [])));
  const hiddenGemsCount = allMatched.filter(s => s.isHiddenGem).length;

  // Build Live Notification Bar Alerts (NEW, ENDING IN 2 DAYS, EXPIRED TODAY)
  const notifications = schemes
    .filter(s => ['NEW', 'ENDING_2_DAYS', 'EXPIRED_TODAY'].includes(s.deadlineStatus))
    .map(s => ({
      id: s.id,
      name: s.name,
      status: s.deadlineStatus,
      label: s.deadlineLabel,
      annualValueINR: s.annualValueINR,
      payoutTag: s.payoutTag
    }));

  // Agent 3: Pre-Submission Rejection Shield
  const npciSeeded = readinessChecks.npciSeeded !== false;
  const nameMatched = readinessChecks.nameMatched !== false;
  const rdValid = readinessChecks.rdValid !== false;

  const rejectionRisks = [];
  let readinessScore = 100;

  if (!npciSeeded) {
    readinessScore -= 45;
    rejectionRisks.push({
      severity: 'CRITICAL',
      title: 'NPCI Aadhaar DBT Mapper Inactive',
      fix: 'DBT money will bounce even after scheme approval. Print the NPCI Bank Mandate Form inside any scheme drawer and submit it to your bank manager.'
    });
  }
  if (!nameMatched) {
    readinessScore -= 30;
    rejectionRisks.push({
      severity: 'HIGH',
      title: 'Name Spelling Mismatch Across Aadhaar & Ration/SSLC Card',
      fix: 'Portal e-KYC will auto-reject. Update Aadhaar spelling at the nearest Aadhaar Seva Kendra or GramaOne.'
    });
  }
  if (!rdValid) {
    readinessScore -= 25;
    rejectionRisks.push({
      severity: 'MEDIUM',
      title: 'Income / Caste Certificate RD Number Expired',
      fix: 'Apply for a fresh Nadakacheri RD Certificate (7-day Sakala SLA) before visiting the cyber-café.'
    });
  }

  return {
    matchedSchemes: allMatched,
    allCatalogSchemes: schemes,
    notifications,
    statutoryConflictsResolved: allConflicts,
    totalDirectAnnualINR,
    fiveYearWealthINR,
    totalHealthCoverINR,
    schemeCount: allMatched.length,
    hiddenGemsCount,
    totalCatalogCount: schemes.length,
    consolidatedDocuments,
    readinessAudit: {
      readinessScore: Math.max(5, readinessScore),
      rejectionRisks
    }
  };
}

module.exports = { matchCitizenProfile, loadSchemes };
