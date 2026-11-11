# HAKKU AI — COMPREHENSIVE PRODUCTION SECURITY, PRIVACY & ARCHITECTURE AUDIT

**Target:** Hakku 5.0 (Sovereign Citizen Welfare Discovery & Statutory Rights OS)  
**Date:** November 2026  
**Auditor:** Principal DevSecOps & Application Security Engineer  
**Scope:** `server.js`, `netlify/functions/api.js`, `netlify.toml`, `matcher.js`, `data/schemes.json`, `public/`, `package.json`, Git repository & configuration  
**Compliance Standard:** DPDP Act 2023 Section 6 (Volatile In-Memory Processing / Safe Harbor), OWASP Top 10 Web Application Security, Netlify Serverless Hardening

---

## 1. Executive Summary

Hakku AI is an Indic-first statutory citizen rights operating system designed to match citizens with central and Karnataka state welfare schemes without bribery, touts, or persistent database storage.

This comprehensive audit evaluated the application across six key domains:
1. **Cryptographic & Session Architecture** (ECDH P-256, HKDF, AES-256-GCM sealed tickets)
2. **Serverless Infrastructure & Secrets** (Netlify Functions, environment variables, Netlify CDN)
3. **API & Injection Security** (CORS, Rate Limiting, Input Sanitization, XSS, SSRF)
4. **Citizen Privacy & Data Protection** (DPDP compliance, zero-PII storage, AI transfers)
5. **Performance & Core Web Vitals** (Asset caching, bundle footprint, rendering)
6. **Technical SEO & Growth Readiness** (Sitemaps, robots.txt, metadata, AdSense readiness)

The application possesses strong foundational privacy principles (no database, volatile RAM processing, client-side PII scrubbing). However, critical vulnerabilities exist in secret fallback management, stateless session revocation, CORS origin fallback, and complete absence of search engine indexing assets (`robots.txt`, `sitemap.xml`, Open Graph meta).

---

## 2. Findings Matrix

| ID | Title | Severity | Affected Component | Status |
|---|---|---|---|---|
| **SEC-01** | Hardcoded Fallback Production Secret in Ticket Sealing | **CRITICAL** | `server.js:175` | Remediating (Stage 3) |
| **SEC-02** | Stateless Ticket Revocation Bypass in `/api/session/wipe` | **HIGH** | `server.js:192-210, 242-246` | Remediating (Stage 3) |
| **SEC-03** | Permissive Default CORS Allows Any Origin | **HIGH** | `server.js:92-94, 114, 122` | Remediating (Stage 3) |
| **SEC-04** | Missing CSP & HSTS Headers on Netlify CDN Edge | **HIGH** | `netlify.toml` | Remediating (Stage 4) |
| **SEC-05** | In-Memory Rate Limiting Ineffective on Serverless Cold Starts | **MEDIUM** | `server.js:127-142` | Remediating (Stage 4) |
| **SEC-06** | Potential Protocol Injection on External Portal Links | **MEDIUM** | `public/app4.js:112` | Remediating (Stage 4) |
| **SEC-07** | Missing `robots.txt`, `sitemap.xml`, and Canonical/OG Meta | **MEDIUM** | `public/` & `public/index.html` | Remediating (Stage 6) |
| **SEC-08** | Inadequate Free-Text AI Disclosure & Missing Formal Privacy Policy | **MEDIUM** | `public/app2.js`, `public/index.html` | Remediating (Stage 4) |
| **SEC-09** | Extraneous Project Metadata File Tracked in Git | **LOW** | `BharatCode.txt`, `.gitignore` | Remediating (Stage 3) |
| **SEC-10** | Missing Client-Side Request Timeout & Offline Fallback | **LOW** | `public/app.js`, `public/app3.js` | Remediating (Stage 5) |
| **SEC-11** | Tailwind Runtime CDN Blocking Paint in Production | **INFORMATIONAL**| `public/index.html` | Remediating (Stage 5) |

---

## 3. Detailed Vulnerability Analyses

### SEC-01 [CRITICAL]: Hardcoded Fallback Production Secret in Ticket Sealing
- **File Affected:** `server.js:175`
- **Original Code:**
  ```javascript
  const MASTER_SECRET = crypto.createHash('sha256').update(process.env.SESSION_SECRET || 'hakku-sovereign-master-secret-2026').digest();
  ```
- **Vulnerability:** When deployed to Netlify without `SESSION_SECRET` configured in environment variables, the server falls back to `'hakku-sovereign-master-secret-2026'`. Because this repository is public, any attacker can compute the exact AES-256-GCM key used to seal tickets, allowing them to decrypt sessions, forge arbitrary valid session tickets, and bypass authentication boundaries.
- **Remediation Plan:**
  1. Enforce strict validation of `process.env.SESSION_SECRET`.
  2. If `SESSION_SECRET` is unset in production (`NODE_ENV === 'production'` or on Netlify), fail startup immediately with a clear operational error.
  3. In development/testing, generate a cryptographically strong ephemeral random secret if unset (`crypto.randomBytes(32)`), logging a warning but never using a predictable string.
  4. Provide exact Netlify dashboard configuration instructions.
- **Verification Method:** Test startup behavior with and without `SESSION_SECRET`. Verify that predictable tickets cannot be unsealed.

---

### SEC-02 [HIGH]: Stateless Ticket Revocation Bypass in `/api/session/wipe`
- **File Affected:** `server.js:183-210`, `server.js:242-246`
- **Original Code:**
  ```javascript
  app.post('/api/session/wipe', (req, res) => {
    const sid = clampStr(req.body && req.body.sessionId, 256);
    if (sid) sessions.delete(sid);
    res.json({ wiped: true });
  });
  ```
- **Vulnerability:** Tickets issued to clients are self-contained AES-256-GCM tokens (`Buffer.concat([iv, tag, ct])`) containing `keyBuf` and `expiresAt`. When `envelope()` receives an encrypted request, it first calls `unsealTicket(sid)`. If the ticket decrypts and has not expired, it succeeds—even if `/api/session/wipe` was called! Because serverless containers do not share memory, `sessions.delete(sid)` only clears a local Map that was never strictly required to unseal the ticket in the first place.
- **Remediation Plan:**
  1. Embed a cryptographically unique 16-byte nonce/ticket ID (`tid`) inside the sealed ticket payload.
  2. Maintain a memory revocation registry with automatic TTL pruning for revoked ticket IDs.
  3. Support an instant session epoch rotation mechanism on the server.
  4. Implement client-side key zeroization upon session erase (overwriting client-side ECDH keys and clearing ticket headers).
- **Verification Method:** Issue a session handshake, seal a ticket, call `/api/session/wipe`, and attempt to make an authenticated call using the wiped ticket. Ensure the server rejects it with `401 SESSION_EXPIRED`.

---

### SEC-03 [HIGH]: Permissive Default CORS Allows Any Origin
- **File Affected:** `server.js:92-94`, `server.js:114`, `server.js:122`
- **Original Code:**
  ```javascript
  const ALLOWED_ORIGINS = (process.env.HAKKU_ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  // ...
  if (origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  ```
- **Vulnerability:** If `HAKKU_ALLOWED_ORIGINS` is unset, `ALLOWED_ORIGINS.length === 0` evaluates to true, reflecting any incoming `Origin` header. This allows malicious third-party websites to trigger cross-origin requests to Hakku's API endpoints.
- **Remediation Plan:**
  1. Default to trusted production domains (`https://hakku-ai.netlify.app`, primary custom domain) and local development ports (`http://localhost:3000`, `http://127.0.0.1:3000`).
  2. Reject unknown origins in production.
  3. Validate Netlify preview deploy origins using a secure regex (`/^https:\/\/[a-z0-9-]+--hakku-ai\.netlify\.app$/`).
- **Verification Method:** Send simulated CORS requests from unauthorized origin `https://evil-site.com` and verify that `Access-Control-Allow-Origin` is NOT returned.

---

### SEC-04 [HIGH]: Missing CSP & HSTS Headers on Netlify CDN Edge
- **File Affected:** `netlify.toml`
- **Original Code:**
  ```toml
  [[headers]]
    for = "/*"
    [headers.values]
      X-Frame-Options = "DENY"
      X-Content-Type-Options = "nosniff"
      Referrer-Policy = "strict-origin-when-cross-origin"
      Permissions-Policy = "camera=(), microphone=(self), geolocation=()"
  ```
- **Vulnerability:** `netlify.toml` handles all static asset responses directly from Netlify's CDN. Because `Content-Security-Policy` and `Strict-Transport-Security` were only configured in `server.js` Express middleware, all visitors loading `index.html` from the CDN did not receive CSP or HSTS protection.
- **Remediation Plan:**
  1. Add strict CSP in `netlify.toml` allowing only trusted origins:
     - `script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com`
     - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
     - `font-src 'self' https://fonts.gstatic.com data:`
     - `img-src 'self' data: https://api.qrserver.com`
     - `connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://api.qrserver.com`
  2. Add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
  3. Set `Cache-Control: public, max-age=0, must-revalidate` for `index.html` to avoid stale deployments.
- **Verification Method:** Inspect HTTP response headers using `curl -I https://hakku-ai.netlify.app/`.

---

### SEC-05 [MEDIUM]: In-Memory Rate Limiting Ineffective Across Serverless Instances
- **File Affected:** `server.js:127-142`
- **Vulnerability:** In Netlify Functions, serverless containers spin up and down dynamically. Memory in `rateBuckets` is not shared. A distributed attack or high-frequency automated scraping can hit separate cold or parallel instances without triggering the in-memory rate limiter.
- **Remediation Plan:**
  1. Harden IP extraction to check Netlify's trusted client headers (`x-nf-client-connection-ip`, `client-ip`) before falling back to `req.ip`.
  2. Add client-side request debouncing and button disablement.
  3. Document edge-level rate-limiting options (Cloudflare Free Tier WAF / Netlify Edge Rate Limiting) for DDoS resilience.
- **Verification Method:** Test rate limiting on consecutive requests within the same window; verify headers `X-RateLimit-Limit` and `X-RateLimit-Remaining`.

---

### SEC-06 [MEDIUM]: Potential Protocol Injection on External Portal Links
- **File Affected:** `public/app4.js:112`
- **Original Code:**
  ```javascript
  <a href="${esc(portal)}" target="_blank" ...>
  ```
- **Vulnerability:** While `esc` sanitizes characters like `"`, `<`, `>`, and `&`, it does not sanitize URI schemes. If scheme metadata or an API response contains a `javascript:` or `data:` URI, clicking the portal link could trigger script execution in the citizen's browser.
- **Remediation Plan:**
  1. Enforce a strict protocol whitelist: only URLs starting with `https://` are permitted.
  2. Sanitize `portal` using a secure helper: `const safePortal = /^https:\/\//i.test(portal) ? portal : 'https://www.myscheme.gov.in';`.
- **Verification Method:** Attempt to pass `javascript:alert(1)` as a portal URL and verify that it is sanitized to the default safe `.gov.in` portal.

---

### SEC-07 [MEDIUM]: Missing `robots.txt`, `sitemap.xml`, and Canonical/OG Meta
- **Files Affected:** `public/robots.txt`, `public/sitemap.xml`, `public/index.html`
- **Vulnerability:** Search engine crawlers (Google, Bing) cannot effectively index Hakku without a `sitemap.xml` and `robots.txt`. The site lacks Open Graph and Twitter Card tags, causing broken link previews when citizens or government operators share Hakku via WhatsApp, Twitter/X, or Telegram.
- **Remediation Plan:**
  1. Create `public/robots.txt` pointing to `https://hakku-ai.netlify.app/sitemap.xml`.
  2. Create `public/sitemap.xml` with all 24 scheme direct deep-links (`#/scheme/<id>`), change frequencies, and multilingual alternate tags.
  3. Add Open Graph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) and Twitter Cards to `public/index.html`.
  4. Add structured JSON-LD (`GovernmentService` and `WebSite` schema).
- **Verification Method:** Validate XML syntax and Open Graph meta tags via automated tests.

---

### SEC-08 [MEDIUM]: Inadequate Free-Text AI Disclosure & Missing Formal Privacy Policy
- **Files Affected:** `public/app2.js`, `public/index.html`
- **Vulnerability:** Natural language situations entered into the voice/text box may be processed by the BharatCode API if an API key is configured. Citizens must receive upfront, unambiguous statutory disclosure before entering text, with explicit instructions not to enter Aadhaar numbers, PAN, or bank account numbers. A complete Privacy Policy, Terms of Service, and AdSense-ready regulatory documentation are missing.
- **Remediation Plan:**
  1. Add an unambiguous warning label directly above the situation box: *"Do not enter Aadhaar, PAN, or bank account numbers. Free-text is analyzed in ephemeral RAM and never stored."*
  2. Create a comprehensive, standalone Privacy Policy page/modal (`/privacy.html` / Privacy modal) detailing zero database persistence, DPDP Act alignment, and third-party AI processing terms.
  3. Create Terms & Conditions and About pages.
- **Verification Method:** Verify user-facing visibility and policy compliance.

---

### SEC-09 [LOW]: Extraneous Project Metadata File Tracked in Git
- **File Affected:** `BharatCode.txt`, `.gitignore`
- **Vulnerability:** `BharatCode.txt` is committed to the Git repository. While it does not contain an active secret, loose text files in the root directory present a risk of accidental secret accumulation.
- **Remediation Plan:**
  1. Untrack `BharatCode.txt` from Git.
  2. Add `BharatCode.txt`, `*.pem`, `*.key`, `*.cert`, `*.log`, and credentials patterns to `.gitignore`.
- **Verification Method:** Run `git ls-files BharatCode.txt` and verify it is untracked.

---

## 4. Conclusion & Next Steps

The code audit reveals a well-conceived application architecture with zero persistent database storage. Resolving SEC-01 through SEC-09 will elevate Hakku to enterprise-grade production readiness, compliant with Indian privacy standards, protected against automated abuse, and optimized for organic search discovery.

Proceed to **STAGE 2: Presentation of Findings and Proposed Implementation Plan**.

