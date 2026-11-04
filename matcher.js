const fs = require('fs');
const path = require('path');

function loadSchemes() {
  const filePath = path.join(__dirname, 'data', 'schemes.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// =====================================================================
// PILLAR 4: 6-CHANNEL LAST-MILE PHYSICAL COUNTER MATRIX
// =====================================================================
function getChannelForScheme(s) {
  const id = s.id || '';
  if (id.includes('pragati') || id.includes('laptop') || id.includes('nsp') || id.includes('vidyasiri') || id.includes('csis')) {
    return {
      channelNumber: 2,
      channelId: 'CHANNEL_2_COLLEGE_INO',
      channelName: 'College Nodal Officer (INO) / Principal Desk',
      channelAuthority: 'Institutional Nodal Officer',
      statutoryFee: '₹0 (Institutional Free Service)',
      specialNote: 'Mandatory: Submit printed acknowledgement to College Clerk within 48h for portal verification.'
    };
  }
  if (id.includes('kisan') || id.includes('borewell') || id.includes('kusum') || id.includes('crop') || id.includes('kcc')) {
    return {
      channelNumber: 3,
      channelId: 'CHANNEL_3_RSK_AGRI',
      channelName: 'Raitha Samparka Kendra (RSK) / Agriculture Dept',
      channelAuthority: 'Assistant Agriculture Officer (AAO)',
      statutoryFee: '₹0 (Department Counter)',
      specialNote: 'Bhoomi RTC / Pahani land record e-verification required on site.'
    };
  }
  if (id.includes('maternity') || id.includes('pmmvy') || id.includes('janani') || id.includes('bhagyalakshmi')) {
    return {
      channelNumber: 4,
      channelId: 'CHANNEL_4_ANGANWADI_ASHA',
      channelName: 'Anganwadi Worker / ASHA / CDPO Health Office',
      channelAuthority: 'Local Anganwadi Worker (AWW)',
      statutoryFee: '₹0 (Zero Fee Child Nutrition Program)',
      specialNote: 'Requires MCP (Mother & Child Protection) card and ANC registration.'
    };
  }
  if (id.includes('labour') || id.includes('bocw')) {
    return {
      channelNumber: 5,
      channelId: 'CHANNEL_5_LABOUR_BOCW',
      channelName: 'Labour Inspector / Seva Sindhu BOCW Desk',
      channelAuthority: 'Senior Labour Inspector (SLI)',
      statutoryFee: '₹25 (GramaOne Service Charge) | ₹0 Online',
      specialNote: 'Requires 12-month active BOCW identity card renewal and employer certificate.'
    };
  }
  if (id.includes('pmegp') || id.includes('svanidhi') || id.includes('vishwakarma')) {
    return {
      channelNumber: 6,
      channelId: 'CHANNEL_6_LEAD_BANK_DIC',
      channelName: 'Lead Bank Branch Manager / District Industries Centre (DIC)',
      channelAuthority: 'Branch Manager / DIC General Manager',
      statutoryFee: '₹0 (Government Sponsored Credit Portal)',
      specialNote: 'Includes EDP training stipend and credit subsidy appraisal.'
    };
  }
  return {
    channelNumber: 1,
    channelId: 'CHANNEL_1_GRAMA_ONE_CSC',
    channelName: 'GramaOne / KarnatakaOne / BangaloreOne / CSC',
    channelAuthority: 'Designated Public Service Operator',
    statutoryFee: '₹0 Self-Apply | ₹25–₹30 Authorized Counter Fee',
    specialNote: 'Official Sakala fixed counter fee. Demand a printed government receipt.'
  };
}

// =====================================================================
// PILLAR 1: LIFE-EVENT & CRISIS TRIGGER BUNDLES
// =====================================================================
const LIFE_EVENT_BUNDLES = [
  {
    id: 'BUNDLE_COLLEGE',
    name: '🎓 12th Pass / College Admission Mobility Bundle',
    tagline: 'Higher Education & Tech Upgrades',
    description: 'Combines AICTE Pragati, NSP Scholarships, Free Laptop Grant, Vidyasiri Hostel & Education Loan Interest Waiver.',
    schemeIds: ['aicte-pragati-girl', 'state-free-laptop-grant', 'nsp-postmatric', 'pm-usp-csis', 'ka-ssp-vidyasiri'],
    badge: 'Higher Education',
    annualTarget: 170000
  },
  {
    id: 'BUNDLE_FARM_UPGRADE',
    name: '🌾 Monsoon / Crop Risk & Farm Upgrade Bundle',
    tagline: 'Small Farmer Climate & Irrigation Protection',
    description: 'Combines PM-KISAN, Ganga Kalyana ₹3.5L Free Borewell, PM-KUSUM 60% Solar Pump, PMFBY Insurance & KCC 4% Credit.',
    schemeIds: ['pm-kisan', 'ganga-kalyana-borewell', 'pm-kusum-solar', 'pmfby-crop-insurance', 'kcc-interest-subvention'],
    badge: 'Farmer Security',
    annualTarget: 114000
  },
  {
    id: 'BUNDLE_WIDOW_EMERGENCY',
    name: '🕊️ Breadwinner Loss / Widowhood Emergency Bundle',
    tagline: 'Immediate Survival & Single-Parent Pension',
    description: 'Combines Destitute Widow Pension, Gruha Lakshmi Head-of-Family cash, Sandhya Suraksha & Ayushman 70+ cover.',
    schemeIds: ['widow-pension-destitute', 'gruha-lakshmi', 'nsap-old-age-sandhya', 'pmjay-ayushman'],
    badge: 'Crisis Protection',
    annualTarget: 45600
  },
  {
    id: 'BUNDLE_MATERNITY_BIRTH',
    name: '👶 Maternity & Girl Child Birth Wealth Bundle',
    tagline: 'Mother Nutrition & Family Health Protection',
    description: 'Combines PMMVY ₹6,000 cash nutrition grant, Gruha Lakshmi household support & Ayushman family health cover.',
    schemeIds: ['pmmvy-maternity', 'gruha-lakshmi', 'pmjay-ayushman'],
    badge: 'Maternity Nutrition',
    annualTarget: 30000
  },
  {
    id: 'BUNDLE_WORKER_UPGRADE',
    name: '👷 Informal Worker & Artisan Upgrade Bundle',
    tagline: 'Toolkits, Marriage Grants & Working Capital',
    description: 'Combines Construction Welfare (BOCW) ₹60k Marriage/Education Grants, PM Vishwakarma ₹15k Toolkit, PM SVANidhi & 35% PMEGP.',
    schemeIds: ['kbocwwb-labour-grants', 'pm-vishwakarma', 'pm-svanidhi-vendor', 'pmegp-business-subsidy', 'yuva-nidhi'],
    badge: 'Livelihood & Skills',
    annualTarget: 195000
  }
];

function evaluateMember(profile, schemes) {
  const age = Number(profile.age || 25);
  const incomeRaw = Number(profile.income);
  const income = Number.isFinite(incomeRaw) ? incomeRaw : 100000;
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

  for (const rawScheme of schemes) {
    const channelInfo = getChannelForScheme(rawScheme);
    const scheme = {
      ...rawScheme,
      channel: channelInfo,
      statutoryFee: channelInfo.statutoryFee,
      isHighValueGrant: (rawScheme.annualValueINR || 0) >= 45000
    };

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

  // Build Live Notification Bar Alerts
  const notifications = schemes
    .filter(s => ['NEW', 'ENDING_2_DAYS', 'EXPIRED_TODAY'].includes(s.deadlineStatus))
    .map(s => ({
      id: s.id,
      name: s.name,
      status: s.deadlineStatus,
      label: s.deadlineLabel,
      annualValueINR: s.annualValueINR,
      payoutTag: s.payoutTag,
      channel: getChannelForScheme(s)
    }));

  // ===================================================================
  // PILLAR 3: REJECTION SHIELD 3.0 (FORENSIC BANK MERGER & CEILING AUDIT)
  // ===================================================================
  const npciSeeded = readinessChecks.npciSeeded !== false;
  const nameMatched = readinessChecks.nameMatched !== false;
  const rdValid = readinessChecks.rdValid !== false;
  const bankAccountType = readinessChecks.bankAccountType || 'regular';
  const hasMergedBankPassbook = Boolean(readinessChecks.hasMergedBankPassbook);

  const rejectionRisks = [];
  let readinessScore = 100;

  if (!npciSeeded) {
    readinessScore -= 40;
    rejectionRisks.push({
      severity: 'CRITICAL',
      title: 'NPCI Aadhaar DBT Mapper Inactive',
      fix: 'DBT treasury payments will silently bounce. Submit the Annexure-I Bank NPCI Mandate inside Hakku to your branch manager.'
    });
  }

  if (!nameMatched) {
    readinessScore -= 25;
    rejectionRisks.push({
      severity: 'HIGH',
      title: 'Name Spelling Mismatch Across Aadhaar & Passbook',
      fix: 'Automated UIDAI portal e-KYC will reject during biometric validation. Update name spelling at nearest Aadhaar Seva Kendra or GramaOne.'
    });
  }

  if (!rdValid) {
    readinessScore -= 20;
    rejectionRisks.push({
      severity: 'MEDIUM',
      title: 'Income / Caste Certificate RD Number Expired',
      fix: 'Apply for fresh Nadakacheri RD Certificate (7-Day Sakala SLA Guarantee) before visiting the cyber-café.'
    });
  }

  // Merged Bank IFSC Warning (Syndicate, Vijaya, Corp, SBM)
  if (hasMergedBankPassbook) {
    readinessScore -= 15;
    rejectionRisks.push({
      severity: 'HIGH',
      title: 'Legacy Merged PSU Bank Passbook Detected',
      fix: 'Old IFSC codes (Syndicate->Canara, Vijaya->BoB, Corp->Union, SBM->SBI) cause Khajane-II state treasury failures. Obtain updated passbook with new IFSC and re-verify IIN on NPCI mapper.'
    });
  }

  // PMJDY / Basic Savings ₹50,000 Ceiling Check
  const highValueGrants = allMatched.filter(s => (s.annualValueINR || 0) >= 45000);
  if (highValueGrants.length > 0 && bankAccountType === 'pmjdy') {
    readinessScore -= 20;
    rejectionRisks.push({
      severity: 'CRITICAL',
      title: `High-Value Grant (${highValueGrants[0].name.split('(')[0]}) Exceeds Jan Dhan ₹50k Cap`,
      fix: `Grants over ₹45,000 freeze on PMJDY / Basic Savings accounts due to RBI balance caps. Visit your branch to upgrade to a Regular Savings Account before disbursement.`
    });
  }

  // Institutional Nodal Officer (INO) 48-Hour Student Rule
  const hasStudentScheme = allMatched.some(s => s.channel.channelNumber === 2);
  if (hasStudentScheme) {
    rejectionRisks.push({
      severity: 'INFO',
      title: 'Student Institutional Nodal Officer (INO) Counter-Sign Required',
      fix: 'Online submission is only 50% complete. You must hand the printed acknowledgement slip to your College Clerk/Principal within 48h for portal verification.'
    });
  }

  // ===================================================================
  // PILLAR 2: CRITICAL-PATH PREREQUISITE SEQUENCER
  // ===================================================================
  const prerequisiteSequence = [
    {
      phase: 'Phase A: Identity & Bank Foundation (Do Once)',
      timing: 'Day 0 – 2',
      action: 'Aadhaar Mobile Seeding + NPCI Bank Mapper Active',
      details: 'Ensure mobile number is linked to Aadhaar for OTP e-KYC. Confirm bank account has active NPCI Aadhaar DBT mapper (takes 48h to reflect on PFMS).'
    },
    {
      phase: 'Phase B: Statutory Certificates (Valid 1–5 Years)',
      timing: 'Day 3 – 7',
      action: 'Nadakacheri Income RD Certificate + Ration Card e-KYC',
      details: 'Obtain unexpired 15-digit RD0038... number. Verify all family members are active on Ahara Ration Card registry.'
    },
    {
      phase: 'Phase C: Single-Visit Zero-Failure Scheme Filing',
      timing: 'Day 8 – 10',
      action: 'Visit Exact Mapped Channel Counter with Hakku Master Folder',
      details: 'Carry deduplicated documents to the designated counter (GramaOne, College INO, RSK, or Labour Desk) paying only ₹0 to ₹30 statutory fee.'
    }
  ];

  return {
    matchedSchemes: allMatched,
    allCatalogSchemes: schemes.map(s => ({ ...s, channel: getChannelForScheme(s) })),
    notifications,
    statutoryConflictsResolved: allConflicts,
    totalDirectAnnualINR,
    fiveYearWealthINR,
    totalHealthCoverINR,
    schemeCount: allMatched.length,
    hiddenGemsCount,
    totalCatalogCount: schemes.length,
    consolidatedDocuments,
    lifeEventBundles: LIFE_EVENT_BUNDLES,
    prerequisiteSequence,
    readinessAudit: {
      readinessScore: Math.max(5, readinessScore),
      rejectionRisks
    }
  };
}

module.exports = { matchCitizenProfile, loadSchemes, LIFE_EVENT_BUNDLES, getChannelForScheme };
