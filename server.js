require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { matchCitizenProfile } = require('./matcher');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const API_KEY = process.env.BHARATCODE_API_KEY || '';
const BASE_URL = process.env.BHARATCODE_BASE_URL || 'https://api.bharatcode.ai/v1';
const MODEL = process.env.BHARATCODE_MODEL || 'qwen-3.8-27b';

async function callBharatCodeAPI(systemPrompt, userPrompt) {
  if (!API_KEY || API_KEY === 'your_bharatcode_api_key_here') {
    throw new Error('DEMO_FALLBACK');
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error(`BharatCode API status ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// STAGE 1 + 2 + 3 + 4 HARNESS: Conversational Intake -> Deterministic Matcher -> Multilingual Explainer
app.post('/api/harness/discover', async (req, res) => {
  const { userMessage, currentProfile, language = 'English' } = req.body;

  let updatedProfile = { ...currentProfile };

  // Stage 1: Use BharatCode AI (or deterministic parser fallback) to extract profile updates from natural speech
  if (userMessage && userMessage.trim().length > 0) {
    try {
      const intakeSystem = `You are Hakku's Citizen Intake Agent powered by BharatCode.
Extract citizen profile attributes from the user's message and merge with currentProfile.
NEVER ask for Aadhaar number, OTP, or bank account numbers.
Return ONLY valid JSON matching:
{
  "profile": {
    "name": "string",
    "age": number,
    "gender": "male" | "female",
    "occupation": "student" | "farmer" | "senior" | "homemaker" | "worker",
    "income": number,
    "category": "General" | "OBC" | "SC" | "ST" | "Minority" | "EWS",
    "state": "Karnataka" | "Other",
    "isBPL": boolean,
    "isStudent": boolean,
    "isWidow": boolean
  }
}`;
      const raw = await callBharatCodeAPI(
        intakeSystem,
        `Current Profile: ${JSON.stringify(currentProfile)}\nUser Message: "${userMessage}"`
      );
      let cleaned = raw.trim();
      if (cleaned.includes('```')) {
        const m = cleaned.match(/```(?:json)?([\s\S]*?)```/);
        if (m) cleaned = m[1].trim();
      } else {
        const f = cleaned.indexOf('{');
        const l = cleaned.lastIndexOf('}');
        if (f !== -1 && l !== -1) cleaned = cleaned.substring(f, l + 1);
      }
      const parsed = JSON.parse(cleaned);
      if (parsed.profile) {
        updatedProfile = { ...updatedProfile, ...parsed.profile };
      }
    } catch (e) {
      // Deterministic NLP extraction fallback so live demo works instantaneously even offline
      const msg = userMessage.toLowerCase();
      const ageMatch = msg.match(/\b(\d{2})\s*(yr|year|years|age|old)?\b/);
      if (ageMatch) updatedProfile.age = Number(ageMatch[1]);
      if (msg.includes('student') || msg.includes('college') || msg.includes('b.com') || msg.includes('engineering')) {
        updatedProfile.occupation = 'student';
        updatedProfile.isStudent = true;
      }
      if (msg.includes('farmer') || msg.includes('acre') || msg.includes('kisan') || msg.includes('agriculture')) {
        updatedProfile.occupation = 'farmer';
        updatedProfile.isStudent = false;
      }
      if (msg.includes('widow') || msg.includes('husband passed')) {
        updatedProfile.isWidow = true;
        updatedProfile.gender = 'female';
      }
      if (msg.includes('female') || msg.includes('woman') || msg.includes('mother') || msg.includes('widow')) {
        updatedProfile.gender = 'female';
      }
      if (msg.includes('bpl') || msg.includes('ration') || msg.includes('poor')) {
        updatedProfile.isBPL = true;
      }
    }
  }

  // Stage 2: Run Deterministic Eligibility Rule Engine (100% Hallucination-Free)
  const matchResult = matchCitizenProfile(updatedProfile);

  // Stage 3: Generate Empathetic Multilingual Summary via BharatCode Model API
  let aiSummary = '';
  let engineMode = `BharatCode API (${MODEL}) + Deterministic Rule Engine`;

  try {
    const explainSystem = `You are Hakku (ಹಕ್ಕು / हक़), an empathetic Indian citizen welfare officer powered by BharatCode.
You MUST ONLY mention the schemes listed in the verified matchResult JSON below—never invent any scheme.
Write a warm, clear 2-3 sentence summary in ${language} telling the citizen how many schemes they matched, their total annual benefit value in Rupees, and what single step they should take first.`;

    aiSummary = await callBharatCodeAPI(
      explainSystem,
      `Citizen Profile: ${JSON.stringify(updatedProfile)}\nVerified Matched Schemes: ${JSON.stringify(
        matchResult.matchedSchemes.map(s => ({ name: s.name, benefit: s.benefitSummary, value: s.annualValueINR }))
      )}`
    );
  } catch (err) {
    engineMode = 'BharatCode Harness (Deterministic Engine + Multilingual Templates)';
    const rupeeStr = `₹${matchResult.totalDirectAnnualINR.toLocaleString('en-IN')}/year`;
    const names = matchResult.matchedSchemes.slice(0, 3).map(s => s.name).join(', ');

    if (language.includes('Kannada')) {
      aiSummary = `ನಮಸ್ಕಾರ ${updatedProfile.name || 'ನಾಗರಿಕರೇ'}! ನಿಮ್ಮ ವಿವರಗಳ ಆಧಾರದ ಮೇಲೆ ನೀವು ${matchResult.schemeCount} ಸರ್ಕಾರಿ ಯೋಜನೆಗಳಿಗೆ (${names}) ಅರ್ಹರಾಗಿದ್ದೀರಿ. ನೀವು ವರ್ಷಕ್ಕೆ ಸುಮಾರು ${rupeeStr} ನೇರ ಆರ್ಥಿಕ ಸೌಲಭ್ಯ ಮತ್ತು ₹5 ಲಕ್ಷದವರೆಗೆ ಆರೋಗ್ಯ ವಿಮೆ ಪಡೆಯಬಹುದು. ಕೆಳಗಿನ "Generate Application Kit / RTI" ಬಟನ್ ಒತ್ತಿ ನಿಮ್ಮ ಅರ್ಜಿಯನ್ನು ಡೌನ್ಲೋಡ್ ಮಾಡಿ.`;
    } else if (language.includes('Hindi') || language.includes('Hinglish')) {
      aiSummary = `Namaste ${updatedProfile.name || 'Ji'}! Aapki profile ke hisaab se aap ${matchResult.schemeCount} verified sarkari yojanaon (${names}) ke liye eligible hain. Aapko har saal lagbhag ${rupeeStr} ki direct sahayata aur ₹5 Lakh ka Ayushman health cover mil sakta hai. Neeche click karke apna Application Letter aur Document Checklist print karein!`;
    } else {
      aiSummary = `Namaste ${updatedProfile.name || 'Citizen'}! Based on our deterministic eligibility check, you qualify for ${matchResult.schemeCount} verified government schemes (including ${names}) worth ~${rupeeStr} in direct annual benefits plus ₹5,00,000 health cover. Click "Generate Application Kit & RTI Draft" below to get your single-window checklist and pre-filled forms.`;
    }
  }

  res.json({
    profile: updatedProfile,
    ...matchResult,
    aiSummary,
    engineMode
  });
});

// STAGE 5 HARNESS: Generate Printable Application Letter + Section 6(1) RTI & CPGRAMS Grievance Draft
app.post('/api/harness/dockit', async (req, res) => {
  const { profile, scheme, allMatchedSchemes, mode = 'application', language = 'English' } = req.body;
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const targetScheme = scheme || (allMatchedSchemes && allMatchedSchemes[0]) || {
    name: 'Selected Welfare Scheme',
    ministry: 'Concerned Welfare Department',
    benefitSummary: 'Direct Benefit Transfer',
    documents: ['Aadhaar Card', 'Income Certificate', 'Bank Passbook']
  };

  let generatedText = '';

  try {
    const prompt = mode === 'rti'
      ? `Draft a formal Right to Information (RTI) Application under Section 6(1) of the RTI Act, 2005 and a CPGRAMS Grievance draft in ${language} for citizen ${profile.name} (Age: ${profile.age}, State: ${profile.state}) regarding undue delay/non-disbursal of benefits under "${targetScheme.name}" (${targetScheme.ministry}). Do NOT include any real Aadhaar or bank account numbers—use safe placeholders like [LAST-4-DIGITS-ONLY].`
      : `Draft a clean, formal, ready-to-print Citizen Welfare Application Cover Letter & Self-Declaration in ${language} for ${profile.name} (Age: ${profile.age}, Occupation: ${profile.occupation}, Annual Income: ₹${profile.income}) applying for "${targetScheme.name}" under ${targetScheme.ministry}. Include placeholders for signature and attached documents.`;

    generatedText = await callBharatCodeAPI(
      'You are Hakku Stage-5 Legal & Administrative Document Harness powered by BharatCode API.',
      prompt
    );
  } catch (e) {
    if (mode === 'rti') {
      generatedText = `====================================================================
FORM OF APPLICATION FOR SEEKING INFORMATION
Under Section 6(1) of the Right to Information Act, 2005
(And Escalation Draft for CPGRAMS — pgportal.gov.in)
====================================================================

Date: ${today}

To,
The Central / State Public Information Officer (PIO),
${targetScheme.ministry},
District / Taluk Welfare Office, ${profile.state || 'Karnataka'}

1. Name of the Applicant      : ${profile.name || '[Citizen Name]'}
2. Age / Category / Status    : ${profile.age} Years / ${profile.category || 'Eligible Beneficiary'}
3. Postal Address             : [Enter Village / Ward, Taluk, District, PIN Code]
4. Scheme Concerned           : ${targetScheme.name}
5. Application Reference No.  : [Enter Portal Ack. No. / Seva Sindhu / NSP ID]

SUBJECT: Request for Information under Section 6(1) of RTI Act, 2005 regarding pending verification / non-disbursal of benefit under ${targetScheme.name}.

Respected Sir / Madam,

I submitted my complete application along with all prescribed supporting documents (${(targetScheme.documents || []).join(', ')}) for "${targetScheme.name}", which provides ${targetScheme.benefitSummary}. Despite fulfilling all eligibility conditions (Age: ${profile.age}, Annual Household Income: ₹${Number(profile.income || 0).toLocaleString('en-IN')}), the benefit has not yet been credited / approved.

Under Section 6(1) of the RTI Act, 2005, please provide the following information:

1. Certified copy of the daily progress report made on my application from the date of submission till date.
2. Names and designations of the officials with whom my application was pending during this period, and the action taken by each official.
3. Exact reason recorded on file for the delay or objection, if any, along with the specific deficiency notice issued to me.
4. As per the Citizens' Charter of ${targetScheme.ministry}, the maximum stipulated timeline for disbursal of this benefit and the current expected date of credit.

I state that the information sought does not fall within the restrictions contained in Section 8 and 9 of the RTI Act and to the best of my knowledge it pertains to your office.
Note: If the applicant belongs to a Below Poverty Line (BPL) family (${profile.isBPL ? 'YES - BPL Card Copy Attached' : 'Fee of ₹10 IPO/Court Fee Stamp attached'}), the application is exempt from RTI fee under Section 7(5) of the RTI Act, 2005.

Yours faithfully,

Signature / Thumb Impression: ___________________________
Name: ${profile.name || '[Citizen Name]'}`;
    } else {
      generatedText = `====================================================================
UNIFIED CITIZEN WELFARE APPLICATION COVER LETTER & CHECKLIST
Generated by Hakku (ಹಕ್ಕು / हक़) — Verified Eligibility Harness
====================================================================

Date: ${today}

To,
The Welfare Officer / Nodal Officer,
${targetScheme.ministry},
${profile.state || 'Karnataka'} (Via ${targetScheme.applyWhere})

SUBJECT: Application for Enrolment & Direct Benefit Transfer (DBT) under "${targetScheme.name}"

Respected Sir / Madam,

I, ${profile.name || '[Citizen Name]'}, aged ${profile.age} years, resident of ${profile.state || 'Karnataka'}, respectfully submit my application for enrolment under "${targetScheme.name}" (${targetScheme.benefitSummary}).

1. VERIFIED CITIZEN ELIGIBILITY SUMMARY:
   • Applicant Name         : ${profile.name || '[Citizen Name]'}
   • Age & Gender           : ${profile.age} Years / ${(profile.gender || '').toUpperCase()}
   • Occupation / Status    : ${(profile.occupation || '').toUpperCase()} ${profile.isWidow ? '(Widow)' : ''} ${profile.isStudent ? '(Bonafide Student)' : ''}
   • Annual Family Income   : ₹${Number(profile.income || 0).toLocaleString('en-IN')} per annum
   • Household Category     : ${profile.category} ${profile.isBPL ? '(BPL / Priority Household)' : ''}

2. SELF-ATTESTED DOCUMENTS ENCLOSED (Carry Originals for Verification):
${(targetScheme.documents || []).map((d, i) => `   [✓] ${i + 1}. ${d}`).join('\n')}

3. OFFICIAL PORTAL / COUNTER INSTRUCTIONS:
   • Portal / Counter       : ${targetScheme.applyWhere}
   • Official Source URL    : ${targetScheme.source}
   • Security Reminder      : Never share your Aadhaar OTP or ATM PIN with middlemen. Ensure your bank account has NPCI Aadhaar DBT seeding enabled at your bank branch.

I hereby declare that the particulars stated above are true and correct to the best of my knowledge and belief.

Yours faithfully,

Signature / Left Thumb Impression: ___________________________
Applicant Name: ${profile.name || '[Citizen Name]'}
Mobile Number : [Enter 10-Digit Mobile No.]`;
    }
  }

  res.json({
    documentTitle: mode === 'rti' ? `Section 6(1) RTI & CPGRAMS Draft — ${targetScheme.name}` : `Official Application Kit — ${targetScheme.name}`,
    generatedText
  });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Hakku (ಹಕ್ಕು / हक़) Welfare & RTI Harness running at http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = Number(PORT) + 1;
    console.log(`⚠️ Port ${PORT} busy, starting on port ${nextPort}...`);
    app.listen(nextPort, () => {
      console.log(`🚀 Hakku (ಹಕ್ಕು / हक़) Welfare & RTI Harness running at http://localhost:${nextPort}`);
    });
  } else {
    console.error(err);
  }
});
