const fs = require('fs');
const path = require('path');

function loadSchemes() {
  const filePath = path.join(__dirname, 'data', 'schemes.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * AGENT 2 & AGENT 3 TOOL:
 * Deterministic Eligibility + Statutory Mutual-Exclusivity Conflict Resolver + Pre-Audit Rejection Shield
 */
function evaluateMember(profile, schemes) {
  const age = Number(profile.age || 25);
  const income = Number(profile.income || 100000);
  const gender = (profile.gender || 'any').toLowerCase();
  const occupation = (profile.occupation || 'other').toLowerCase();
  const category = (profile.category || 'OBC').toUpperCase();
  const isBPL = Boolean(profile.isBPL);
  const isStudent = Boolean(profile.isStudent) || occupation === 'student';
  const isWidow = Boolean(profile.isWidow);
  const isTaxPayer = Boolean(profile.isTaxPayer);

  const rawMatches = [];
  const statutoryConflictsResolved = [];

  for (const scheme of schemes) {
    const e = scheme.eligibility || {};
    const reasons = [];

    // Statutory Tax-Payer Disqualifier Check
    if (e.excludeTaxPayer && isTaxPayer) continue;

    if (e.isStudent && !isStudent) continue;
    if (e.isStudent && isStudent) reasons.push('Bonafide Student');

    if (e.isWidow && !isWidow) continue;
    if (e.isWidow && isWidow) reasons.push('Widow Status');

    if (e.bplRequired && !isBPL) continue;
    if (e.bplRequired && isBPL) reasons.push('BPL Household');

    if (e.ageMin !== undefined && age < e.ageMin) continue;
    if (e.ageMax !== undefined && age > e.ageMax) continue;
    reasons.push(`Age ${age} verified`);

    // Special NHA 70+ Senior Citizen Rule: 70+ seniors qualify for Ayushman regardless of income
    const isSenior70PlusAyushman = scheme.id === 'pmjay-ayushman' && age >= 70;
    if (!isSenior70PlusAyushman && e.maxIncome !== undefined && income > e.maxIncome) continue;
    reasons.push(isSenior70PlusAyushman ? '70+ Universal Senior Cover Rule' : `Income ≤ ₹${(e.maxIncome || 250000).toLocaleString('en-IN')}`);

    if (e.gender && !e.gender.map(g => g.toLowerCase()).includes(gender)) continue;
    if (e.occupations && !e.occupations.map(o => o.toLowerCase()).includes(occupation)) continue;
    if (e.categories && !e.categories.map(c => c.toUpperCase()).includes(category)) continue;

    rawMatches.push({
      ...scheme,
      beneficiaryName: profile.name || 'Citizen',
      matchReasons: reasons
    });
  }

  // STATUTORY CONFLICT RESOLUTION (Anti-Double-Dipping Rule Engine)
  // If multiple schemes belong to the same exclusivityGroup (e.g. CENTRAL_SCHOLARSHIP or SOCIAL_PENSION),
  // keep ONLY the highest-value scheme and log the statutory rule resolution.
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
        rule: `Statutory Anti-Double-Dipping Rule (${m.exclusivityGroup}): Citizen cannot claim both simultaneously. Auto-selected higher benefit (+₹${m.annualValueINR.toLocaleString('en-IN')}/yr).`
      });
      groupBest[m.exclusivityGroup] = m;
    } else {
      statutoryConflictsResolved.push({
        kept: existing.name,
        dropped: m.name,
        rule: `Statutory Anti-Double-Dipping Rule (${m.exclusivityGroup}): Citizen cannot claim both simultaneously. Retained higher/primary benefit (${existing.name}).`
      });
    }
  }

  Object.values(groupBest).forEach(s => finalMatches.push(s));

  return { finalMatches, statutoryConflictsResolved };
}

/**
 * Evaluates either a single citizen OR an entire Ration-Card Household
 * + Runs Agent 3 (Pre-Submission Rejection Shield)
 */
function matchCitizenProfile(profile, householdMembers = [], readinessChecks = {}) {
  const schemes = loadSchemes();
  const membersToScan = householdMembers && householdMembers.length > 0
    ? householdMembers
    : [profile];

  let allMatched = [];
  let allConflicts = [];
  const seenHouseholdLevelGroups = new Set();

  for (const member of membersToScan) {
    const { finalMatches, statutoryConflictsResolved } = evaluateMember(member, schemes);
    allConflicts.push(...statutoryConflictsResolved);

    for (const s of finalMatches) {
      // Prevent counting household-wide schemes (like PM-JAY or Gruha Lakshmi) twice across family members
      if (s.exclusivityGroup && s.exclusivityGroup.startsWith('HOUSEHOLD_')) {
        if (seenHouseholdLevelGroups.has(s.exclusivityGroup)) continue;
        seenHouseholdLevelGroups.add(s.exclusivityGroup);
      }
      allMatched.push(s);
    }
  }

  const totalDirectAnnualINR = allMatched.reduce((sum, s) => sum + (s.annualValueINR || 0), 0);
  const totalHealthCoverINR = allMatched.reduce((sum, s) => sum + (s.coverageValueINR || 0), 0);
  const consolidatedDocuments = Array.from(new Set(allMatched.flatMap(s => s.documents || [])));

  // AGENT 3: Pre-Submission Rejection Shield Audit
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
      fix: 'DBT payments will bounce even after scheme approval. Submit the generated NPCI Mandate Form at your bank branch before applying.'
    });
  }
  if (!nameMatched) {
    readinessScore -= 30;
    rejectionRisks.push({
      severity: 'HIGH',
      title: 'Name Spelling Mismatch Across Aadhaar & Ration/SSLC Card',
      fix: 'Portal e-KYC will auto-reject. Update Aadhaar demographic spelling at nearest Aadhaar Seva Kendra or CSC first.'
    });
  }
  if (!rdValid) {
    readinessScore -= 25;
    rejectionRisks.push({
      severity: 'MEDIUM',
      title: 'Income / Caste Certificate RD Number Expired or Missing',
      fix: 'Apply for fresh Nadakacheri RD Certificate (Sakala SLA: 7 working days) before submitting scholarship/pension form.'
    });
  }

  return {
    matchedSchemes: allMatched,
    statutoryConflictsResolved: allConflicts,
    totalDirectAnnualINR,
    totalHealthCoverINR,
    schemeCount: allMatched.length,
    consolidatedDocuments,
    readinessAudit: {
      readinessScore: Math.max(5, readinessScore),
      rejectionRisks
    }
  };
}

module.exports = { matchCitizenProfile, loadSchemes };
