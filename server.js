require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { matchCitizenProfile, LIFE_EVENT_BUNDLES } = require('./matcher');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

/* =====================================================================
   SECURITY LAYER — DPDP Act 2023 volatile-RAM mandate
   - Strict security headers (CSP, HSTS, frame-deny, no-sniff)
   - Allow-list CORS
   - In-memory sliding-window rate limiter (no Redis, nothing persisted)
   - ECDH P-256 handshake -> HKDF -> AES-256-GCM envelope transport
   - Sessions live ONLY in a TTL-purged Map; process exit = total wipe
   - Zero PII logging: logs carry counts and status codes only
   ===================================================================== */
const ALLOWED_ORIGINS = (process.env.HAKKU_ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https://api.qrserver.com",
    "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://api.qrserver.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  }
  next();
});
app.use(cors({ origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) }));
app.use(express.json({ limit: '24kb' }));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html', maxAge: '1h', setHeaders: (res, filePath) => { if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));

/* ---- in-memory rate limiter: 30 POST req / 60s / IP (GETs exempt) ---- */
const RATE = { windowMs: 60000, max: 30 };
const rateBuckets = new Map();
setInterval(() => { const now = Date.now(); for (const [k, v] of rateBuckets) if (now - v.start > RATE.windowMs * 2) rateBuckets.delete(k); }, 120000).unref();
app.use('/api/', (req, res, next) => {
  if (req.method !== 'POST') return next();
  if (process.env.HAKKU_TEST_MODE === '1') return next();
  const ip = (req.ip || 'unknown').replace(/[^0-9a-fA-F:.]/g, '');
  const now = Date.now();
  let b = rateBuckets.get(ip);
  if (!b || now - b.start > RATE.windowMs) { b = { start: now, n: 0 }; rateBuckets.set(ip, b); }
  b.n++;
  res.setHeader('X-RateLimit-Limit', RATE.max);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE.max - b.n));
  if (b.n > RATE.max) return res.status(429).json({ error: 'RATE_LIMITED', retryAfterMs: RATE.windowMs - (now - b.start) });
  next();
});

/* ---- input validation / sanitization ---- */
function clampStr(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F<>]/g, '').slice(0, max); }
function clampNum(v, min, max, dflt) { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : dflt; }
function sanitizeProfile(p) {
  if (!p || typeof p !== 'object') return {};
  return {
    name: clampStr(p.name, 60) || 'Citizen',
    age: clampNum(p.age, 1, 110, 25),
    gender: ['male', 'female', 'any'].includes(p.gender) ? p.gender : 'any',
    state: clampStr(p.state, 20) || 'karnataka',
    occupation: clampStr(p.occupation, 24) || 'other',
    income: clampNum(p.income, 0, 10000000, 120000),
    category: clampStr(p.category, 12) || 'OBC',
    rationCard: clampStr(p.rationCard, 8) || 'NONE',
    bankType: clampStr(p.bankType, 10) || 'regular',
    isStudent: Boolean(p.isStudent), isWidow: Boolean(p.isWidow), isTaxPayer: Boolean(p.isTaxPayer),
    isBPL: Boolean(p.isBPL)
  };
}

/* ---- ECDH P-256 -> HKDF-SHA256 -> AES-256-GCM envelope sessions ---- */
const HKDF_SALT = Buffer.from('hakku5.0-dpdp-salt-v1');
const HKDF_INFO = Buffer.from('hakku-aes-256-gcm-envelope');
const SESSION_TTL_MS = 20 * 60 * 1000;
const sessions = new Map(); // sessionId -> { keyBuf, expiresAt }
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sessions) if (now > v.expiresAt) sessions.delete(k);
}, 60000).unref();

function b64urlToBuf(s) { return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }
function bufToB64url(b) { return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function deriveKey(sharedSecret) {
  return Buffer.from(crypto.hkdfSync('sha256', sharedSecret, HKDF_SALT, HKDF_INFO, 32));
}
function aesEncrypt(keyBuf, plainBuf) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const ct = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
  return { iv, ct, tag: cipher.getAuthTag() };
}
function aesDecrypt(keyBuf, iv, ct, tag) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

app.post('/api/security/handshake', (req, res) => {
  try {
    const clientPubB64 = String(req.body && req.body.clientPublicKey || '');
    if (!clientPubB64 || clientPubB64.length > 400) return res.status(400).json({ error: 'BAD_KEY' });
    const clientKey = crypto.createPublicKey({ key: b64urlToBuf(clientPubB64), format: 'der', type: 'spki' });
    const server = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const shared = crypto.diffieHellman({ privateKey: server.privateKey, publicKey: clientKey });
    const sessionId = crypto.randomBytes(16).toString('hex');
    sessions.set(sessionId, { keyBuf: deriveKey(shared), expiresAt: Date.now() + SESSION_TTL_MS });
    const serverPub = server.publicKey.export({ format: 'der', type: 'spki' });
    res.json({ sessionId, serverPublicKey: bufToB64url(serverPub), cipher: 'AES-256-GCM', kdf: 'HKDF-SHA256', ttlMs: SESSION_TTL_MS });
  } catch (e) {
    res.status(400).json({ error: 'HANDSHAKE_FAILED' });
  }
});

app.post('/api/session/wipe', (req, res) => {
  const sid = clampStr(req.body && req.body.sessionId, 64);
  if (sid) sessions.delete(sid);
  res.json({ wiped: true });
});

/* ---- envelope middleware: decrypts request, encrypts response ---- */
async function envelope(req, res, payloadBuilder) {
  const sid = clampStr(req.headers['x-hakku-session'], 64);
  const sess = sid ? sessions.get(sid) : null;
  let body = req.body;
  if (sess && req.body && req.body.enc) {
    try {
      const raw = b64urlToBuf(req.body.enc);
      const iv = raw.subarray(0, 12);
      const tag = raw.subarray(raw.length - 16);
      const ct = raw.subarray(12, raw.length - 16);
      const plain = aesDecrypt(sess.keyBuf, iv, ct, tag);
      body = JSON.parse(plain.toString('utf8'));
    } catch (e) {
      sessions.delete(sid);
      return res.status(400).json({ error: 'BAD_ENVELOPE' });
    }
  }
  let payload;
  try { payload = await payloadBuilder(body); }
  catch (e) { payload = { error: 'HANDLER_FAILED', detail: String(e && e.message || e).slice(0, 120) }; }
  if (sess) {
    sess.expiresAt = Date.now() + SESSION_TTL_MS;
    const { iv, ct, tag } = aesEncrypt(sess.keyBuf, Buffer.from(JSON.stringify(payload)));
    const enc = Buffer.concat([iv, ct, tag]);
    return res.json({ env: true, d: bufToB64url(enc) });
  }
  res.json(payload);
}

/* ---- BharatCode Model API (qwen-3.8-27b) with deterministic fallback ---- */
const API_KEY = process.env.BHARATCODE_API_KEY || '';
const BASE_URL = process.env.BHARATCODE_BASE_URL || 'https://api.bharatcode.ai/v1';
const MODEL = process.env.BHARATCODE_MODEL || 'qwen-3.8-27b';

async function callBharatCodeAPI(systemPrompt, userPrompt) {
  if (!API_KEY || API_KEY === 'your_bharatcode_api_key_here') throw new Error('DEMO_FALLBACK');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.3 })
    });
    if (!response.ok) throw new Error('API ' + response.status);
    const data = await response.json();
    return data.choices[0].message.content;
  } finally { clearTimeout(timer); }
}

/* ---- multilingual summary (Agent 5) ---- */
function buildSummary(lang, m) {
  const rupee = `₹${m.totalDirectAnnualINR.toLocaleString('en-IN')}/year`;
  if (lang.includes('Kannada')) return `ನಮಸ್ಕಾರ! ಹಕ್ಕು ನಿಮಗಾಗಿ ${m.schemeCount} ಅರ್ಹ ಯೋಜನೆಗಳನ್ನು ಕಂಡುಹಿಡಿದಿದೆ (ಅದರಲ್ಲಿ ${m.hiddenGemsCount} ಗುಪ್ತ ರತ್ನಗಳು). ಒಟ್ಟು ವಾರ್ಷಿಕ ಲಾಭ ${rupee} + ₹5,00,000 ಉಚಿತ ಆಸ್ಪತ್ರೆ ರಕ್ಷಣೆ. ಯಾವುದೇ ಯೋಜನೆ ತೆರೆದು ಪೂರ್ಣ ಡಾಸಿಯರ್ ನೋಡಿ!`;
  if (lang.includes('Hindi')) return `नमस्ते! हक्कू ने आपके लिए ${m.schemeCount} पात्र योजनाएँ खोजीं (जिनमें ${m.hiddenGemsCount} गुप्त रत्न हैं)। कुल वार्षिक लाभ ${rupee} + ₹5,00,000 मुफ़्त अस्पताल कवर। कोई भी योजना खोलकर पूरा डोसियर देखें!`;
  if (lang.includes('Tamil')) return `வணக்கம்! ஹக்கு உங்களுக்காக ${m.schemeCount} தகுதித் திட்டங்களைக் கண்டறிந்தது (அவற்றில் ${m.hiddenGemsCount} மறைந்த இரத்தினங்கள்). மொத்த ஆண்டு பலன் ${rupee} + ₹5,00,000 இலவச மருத்துவக் காப்பு. எந்தத் திட்டத்தையும் திறந்து முழு டாசியரைப் பாருங்கள்!`;
  if (lang.includes('Telugu')) return `నమస్తే! హక్కు మీ కోసం ${m.schemeCount} అర్హత పథకాలు గుర్తించింది (వాటిలో ${m.hiddenGemsCount} దాగిన రత్నాలు). మొత్తం వార్షిక లబ్ధి ${rupee} + ₹5,00,000 ఉచిత ఆసుపత్రి కవచం. ఏదైనా పథకాన్ని తెరిచి పూర్తి డాసియర్ చూడండి!`;
  return `Namaste! Hakku unlocked ${m.schemeCount} verified schemes for you—including ${m.hiddenGemsCount} "Hidden Money Gems" most citizens never hear about—worth ${rupee} in direct cash/subsidies + ₹5,00,000 hospital cover. Click ANY scheme card or top deadline alert to open its full criteria, document guide, and printable Cyber-Café slip!`;
}

/* ---- GET notices: live marquee without intake ---- */
app.get('/api/harness/notices', (req, res) => {
  try {
    const { loadSchemes, getChannelForScheme } = require('./matcher');
    const schemes = loadSchemes();
    const notifications = schemes
      .filter(s => ['NEW', 'ENDING_2_DAYS', 'EXPIRED_TODAY'].includes(s.deadlineStatus))
      .map(s => ({ id: s.id, name: s.name, status: s.deadlineStatus, label: s.deadlineLabel, annualValueINR: s.annualValueINR, payoutTag: s.payoutTag, channel: getChannelForScheme(s) }));
    res.json({ notifications, count: notifications.length });
  } catch (e) { res.json({ notifications: [], count: 0 }); }
});

/* ---- health & deploy management ---- */
app.get('/healthz', (req, res) => {
  res.json({
    ok: true,
    service: 'hakku-5.0',
    uptimeSec: Math.floor(process.uptime()),
    sessions: sessions.size,
    memory: process.memoryUsage().rss,
    model: MODEL,
    piiStored: false
  });
});

/* ---- MAIN DISCOVER ---- */
app.post('/api/harness/discover', (req, res) => {
  envelope(req, res, async (body) => {
    const userMessage = clampStr(body && body.userMessage, 200);
    const currentProfile = sanitizeProfile(body && body.currentProfile);
    const household = Array.isArray(body && body.householdMembers)
      ? body.householdMembers.slice(0, 8).map(m => sanitizeProfile(m && m.profile ? m.profile : m))
      : [];
    const readinessChecks = body && body.readinessChecks && typeof body.readinessChecks === 'object' ? body.readinessChecks : {};
    /* translate client forensic keys -> matcher-native keys (defensive: accept both) */
    if (readinessChecks.nameMatchAadhaar !== undefined) readinessChecks.nameMatched = readinessChecks.nameMatchAadhaar;
    if (readinessChecks.validRdCert !== undefined) readinessChecks.rdValid = readinessChecks.validRdCert;
    if (readinessChecks.mergedHousehold !== undefined) readinessChecks.hasMergedBankPassbook = readinessChecks.mergedHousehold;
    const language = clampStr(body && body.language, 16) || 'English';

    const t0 = Date.now();
    let updatedProfile = { ...currentProfile };

    if (userMessage && userMessage.trim().length > 0) {
      try {
        const raw = await callBharatCodeAPI(
          'Extract citizen profile JSON for an Indian welfare eligibility scan. Return ONLY JSON: {"profile":{"age":number,"gender":"male"|"female","occupation":"student"|"farmer"|"worker"|"artisan"|"vendor"|"unemployed"|"homemaker"|"senior","isWidow":boolean}}',
          `Citizen situation: "${userMessage}"`
        );
        const parsed = JSON.parse(String(raw).replace(/```json|```/g, '').trim());
        if (parsed && parsed.profile) updatedProfile = { ...updatedProfile, ...sanitizeProfile({ ...updatedProfile, ...parsed.profile }) };
      } catch (e) {
        /* deterministic fallback parser — zero hallucination mandate */
        const msg = userMessage.toLowerCase();
        const ageMatch = msg.match(/\b(\d{2})\b/);
        if (ageMatch) updatedProfile.age = clampNum(ageMatch[1], 1, 110, updatedProfile.age);
        if (/(farmer|acre|kisan|crop|monsoon)/.test(msg)) { updatedProfile.occupation = 'farmer'; updatedProfile.isStudent = false; }
        else if (/(student|college|b\.?tech|degree|phd|admission)/.test(msg)) { updatedProfile.occupation = 'student'; updatedProfile.isStudent = true; }
        else if (/(unemployed|jobless|graduate)/.test(msg)) { updatedProfile.occupation = 'unemployed'; updatedProfile.isStudent = false; }
        else if (/(driver|tailor|worker|vendor|shop|artisan|labour)/.test(msg)) { updatedProfile.occupation = 'worker'; updatedProfile.isStudent = false; }
        if (/(girl|woman|female|widow|mother|she)/.test(msg)) updatedProfile.gender = 'female';
        if (/(widow|vidhwa|ವಿಧವೆ)/.test(msg)) updatedProfile.isWidow = true;
        if (/(bpl|below poverty|ಬಿಪಿಎಲ್)/.test(msg)) updatedProfile.rationCard = 'BPL';
      }
    }

    const t1 = Date.now();
    const matchResult = matchCitizenProfile(updatedProfile, household, readinessChecks);
    const engineMs = Date.now() - t1;

    return {
      profile: updatedProfile,
      ...matchResult,
      aiSummary: buildSummary(language, matchResult),
      engineMs,
      totalMs: Date.now() - t0
    };
  });
});

/* ---- DOCUMENT GENERATOR (3 dossier modes) ---- */
app.post('/api/harness/dockit', (req, res) => {
  envelope(req, res, (body) => {
    const t0 = Date.now();
    const profile = sanitizeProfile(body && body.profile);
    const rawScheme = body && body.scheme && typeof body.scheme === 'object' ? body.scheme : {};
    const mode = ['application', 'npci', 'rti'].includes(body && body.mode) ? body.mode : 'application';
    const s = {
      name: clampStr(rawScheme.name, 120) || 'Verified Welfare Scheme',
      ministry: clampStr(rawScheme.ministry, 120) || 'Concerned Welfare Department',
      benefitSummary: clampStr(rawScheme.benefitSummary, 400) || 'Direct Benefit Transfer',
      sakalaSlaDays: clampNum(rawScheme.sakalaSlaDays, 1, 365, 21),
      statutoryRule: clampStr(rawScheme.statutoryRule, 300) || 'Verified Eligible',
      commonRejectionTrap: clampStr(rawScheme.commonRejectionTrap, 300) || 'Ensure NPCI DBT seeding is active.',
      cscSteps: clampStr(rawScheme.cscSteps, 400) || 'Apply via official portal',
      documents: Array.isArray(rawScheme.documents) ? rawScheme.documents.slice(0, 12).map(d => clampStr(d, 120)) : ['Aadhaar Card', 'Ration Card', 'Bank Passbook'],
      selfApplySteps: Array.isArray(rawScheme.selfApplySteps) ? rawScheme.selfApplySteps.slice(0, 10).map(d => clampStr(d, 240)) : [],
      physicalCounter: clampStr(rawScheme.physicalCounter, 120) || 'GramaOne / CSC',
      applyWhere: clampStr(rawScheme.applyWhere, 160) || 'Official Portal',
      source: /^https:\/\/[a-z0-9.-]*(gov\.in|nic\.in|india\.gov\.in)/i.test(String(rawScheme.source || '')) ? rawScheme.source : 'https://www.myscheme.gov.in',
      channel: rawScheme.channel || {
        channelNumber: 1, channelName: 'GramaOne / KarnatakaOne / CSC',
        channelAuthority: 'Designated Public Service Operator',
        statutoryFee: '₹0 Self-Apply | ₹25–₹30 Authorized Counter Fee',
        specialNote: 'Demand printed official receipt.'
      },
      annualValueINR: clampNum(rawScheme.annualValueINR, 0, 10000000, 0),
      payoutTag: clampStr(rawScheme.payoutTag, 80) || '',
      deadlineStatus: clampStr(rawScheme.deadlineStatus, 20) || ''
    };
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const ch = s.channel;
    let documentTitle = '', generatedText = '';

    if (mode === 'npci') {
      documentTitle = `Bank NPCI Aadhaar DBT Seeding Mandate — ${s.name}`;
      generatedText = `====================================================================
ANNEXURE-I: BANK MANDATE FOR LINKING / SEEDING AADHAAR ON NPCI MAPPER
(Prevents 40% of Government DBT Payment Failures)
====================================================================

Date: ${today}

To,
The Branch Manager,
[Bank Name & Branch]

SUBJECT: Request to Enable NPCI Aadhaar DBT Mapper for Receiving "${s.name}"

Dear Sir / Madam,

I hold Savings Account No. [____________________] in your branch. I am applying for "${s.name}" (${s.ministry}) worth ₹${Number(s.annualValueINR || 0).toLocaleString('en-IN')}/year, which credits funds strictly via the NPCI Aadhaar Payment Bridge (APBS).

IMPORTANT FORENSIC AUDIT CHECKS:
1. Legacy Merged Bank IFSC: If this account belongs to a merged PSU bank (Syndicate, Vijaya, Corporation, State Bank of Mysore), please confirm the current active IFSC on Khajane-II.
2. Balance Ceiling Check: For grants exceeding ₹45,000, ensure account is upgraded from PMJDY / Basic Savings so the ₹50,000 balance ceiling does not bounce the treasury credit.

Please link my Aadhaar [XXXX-XXXX-____] to my account and mark it ACTIVE on the NPCI DBT Mapper today.

Enclosures: [✓] Aadhaar Copy   [✓] Bank Passbook Copy

Signature / Thumb Impression: ___________________________
Name: ${profile.name}`;
    } else if (mode === 'rti') {
      documentTitle = `3-Tier Legal Escalation & Section 6(1) RTI Notice — ${s.name}`;
      generatedText = `====================================================================
3-TIER LEGAL ESCALATION LADDER & STATUTORY RTI APPLICATION
(Under Section 6(1) of RTI Act 2005 & Karnataka Sakala Act 2011)
====================================================================

TIER 1 (Day +1 Past SLA) : Sakala Compensatory Appeal (Call 1902 / ₹20/day penalty)
TIER 2 (Day +15 Past SLA): Section 6(1) BPL Zero-Fee Statutory RTI Notice (Below)
TIER 3 (Day +30 Past SLA): Janaspandana (ipgrs.karnataka.gov.in) / Central CPGRAMS

Date: ${today}

To,
The Public Information Officer (PIO),
${s.ministry}

1. Applicant Name             : ${profile.name}
2. BPL Fee Exemption (Sec 7(5)): ${profile.isBPL ? 'EXEMPT FROM ₹10 FEE (BPL Card Attached)' : '₹10 Court Fee / IPO Attached'}
3. Scheme & Statutory SLA     : ${s.name} (Mandated SLA: ${s.sakalaSlaDays} Working Days)
4. Application Ack. Number    : [Enter Seva Sindhu / NSP / Portal GSC Number]

Respected Sir / Madam,

My application for "${s.name}" has exceeded the statutory ${s.sakalaSlaDays}-day Sakala / Citizens' Charter timeline. Under Section 6(1) of the RTI Act, 2005, please provide:
1. Daily progress report and file movement register for my application.
2. Name and designation of the officer with whom my application is currently pending.
3. Exact technical reason for delay (PFMS / NPCI status / field verification) and expected date of DBT credit.

Signature / Thumb Impression: ___________________________
Name: ${profile.name}`;
    } else {
      const expiredNote = s.deadlineStatus === 'EXPIRED_TODAY'
        ? `\n⚠️ SPECIAL NOTE (EXPIRED TODAY): Since Round-1 online portal closed today, submit this signed sheet as a Formal Late-Condonation / Round-2 Representation to the Nodal Officer.`
        : '';
      const highValueWarning = (s.annualValueINR || 0) >= 45000
        ? `\n⚠️ FORENSIC BANK ALERT: Payout of ₹${Number(s.annualValueINR).toLocaleString('en-IN')} exceeds Jan Dhan ₹50k balance ceiling. Ensure your bank account is upgraded to a Regular Savings Account.`
        : '';
      documentTitle = `3-in-1 Cyber-Café Operator Slip & Application — ${s.name}`;
      generatedText = `====================================================================
HAKKU 5.0 OFFICIAL CITIZEN APPLICATION DOSSIER & OPERATOR SLIP
100% In-Memory RAM • Zero Data Stored • Verified .gov.in Rules
====================================================================

Date: ${today}
Beneficiary: ${profile.name} (Age: ${profile.age} | Category: ${profile.category} | Income: ₹${Number(profile.income).toLocaleString('en-IN')})
Scheme Name: ${s.name}
Annual Benefit: ₹${Number(s.annualValueINR || 0).toLocaleString('en-IN')}/year (${s.payoutTag || s.benefitSummary.slice(0, 40)})${expiredNote}${highValueWarning}

--------------------------------------------------------------------
PART A: LAST-MILE PHYSICAL ROUTING & OPERATOR INSTRUCTIONS
--------------------------------------------------------------------
1. Physical Channel      : Channel ${ch.channelNumber || 1} • ${ch.channelName}
2. Authorized Officer    : ${ch.channelAuthority || s.physicalCounter}
3. Statutory Service Fee : ${ch.statutoryFee} (Do not pay more)
4. Official Portal URL   : ${s.source}
5. Operator Click-Path   : ${s.cscSteps}
6. #1 Rejection Trap     : ${s.commonRejectionTrap}
7. Legal Processing Time : ${s.sakalaSlaDays} Working Days (Sakala Guarantee)
8. Channel Requirement   : ${ch.specialNote || 'Demand a printed official receipt.'}

--------------------------------------------------------------------
PART B: REQUIRED DOCUMENTS TO CARRY (MASTER FOLDER CHECKLIST)
--------------------------------------------------------------------
${(s.documents || []).map((d, i) => `[✓] ${i + 1}. ${d}`).join('\n')}

--------------------------------------------------------------------
PART C: CITIZEN SELF-APPLY STEP-BY-STEP GUIDE
--------------------------------------------------------------------
${(s.selfApplySteps || []).map(step => `• ${step}`).join('\n')}

--------------------------------------------------------------------
TEAR-OFF: GSC / SAKALA RECEIPT COUNTERFOIL
--------------------------------------------------------------------
Acknowledgement No.: ____________________  Date: __________
Scheme: ${s.name.slice(0, 48)}
Statutory SLA: ${s.sakalaSlaDays} working days. If SLA breaches, file Tier-1 Sakala appeal (₹20/day compensation).

Signature / Left Thumb Impression: ___________________________
Applicant Name: ${profile.name}`;
    }
    return { documentTitle, generatedText, ms: Date.now() - t0 };
  });
});

/* ---- 404 + error hygiene (never leaks stack/PII) ---- */
app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
  if (err && (err.type === 'entity.parse.failed' || err.status === 400)) return res.status(400).json({ error: 'BAD_JSON' });
  res.status(500).json({ error: 'INTERNAL', detail: 'sanitized' });
});

/* ---- graceful shutdown: RAM sessions die with the process (by design) ---- */
const PORT = Number(process.env.PORT || 3000);
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`HAKKU 5.0 sovereign OS ready on http://localhost:${port} (RAM-only, zero PII logs)`);
  });
  server.on('error', err => {
    if (err.code === 'EADDRINUSE' && port < Number(PORT) + 10) startServer(port + 1);
    else console.error('FATAL', err.code || err.message);
  });
  const shutdown = () => { sessions.clear(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 2500).unref(); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = app;

if (require.main === module) {
  startServer(PORT);
}
