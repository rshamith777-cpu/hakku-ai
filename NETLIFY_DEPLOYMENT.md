# HAKKU AI — Production Netlify Deployment Guide (`NETLIFY_DEPLOYMENT.md`)

**Date:** November 2026  
**Application:** Hakku AI 5.0  
**Target Platform:** Netlify (Edge CDN + Netlify Serverless Functions)  
**Primary Live URL:** `https://hakku-ai.netlify.app`  

---

## 1. Architecture Overview on Netlify

Hakku AI is structured for low-latency, secure serverless execution on Netlify:
- **Static Assets (`public/`):** Served globally across Netlify's high-speed multi-region Edge CDN.
- **Serverless API (`netlify/functions/api.js`):** Wraps Express via `serverless-http` into AWS Lambda micro-containers orchestrated by Netlify.
- **Routing Engine (`netlify.toml`):** Automatically maps `/api/*` to `/.netlify/functions/api/:splat` with full header preservation.
- **Edge Security Headers:** Injected at the edge level before reaching client browsers, guaranteeing CSP, HSTS, X-Frame-Options, and referrer policies.

---

## 2. Netlify Dashboard Setup Instructions

### 2.1 Navigating to Environment Variables
1. Log in to your [Netlify App Console](https://app.netlify.com/).
2. Select the **Hakku AI** project (`hakku-ai`).
3. In the left navigation menu, go to **Site configuration** > **Environment variables**.
4. Click **Add a variable** > **Add a single variable** (or use Secret Manager).

### 2.2 Mandatory Environment Variables

| Variable Key | Purpose | Required in Production? | Example / Value Specification |
|---|---|---|---|
| `SESSION_SECRET` | 256-bit cryptographically secure key used for signing & AES-256-GCM envelope sealing | **YES (MANDATORY)** | Generate a random 64-character hex string (see generation script below). Never use a dictionary word! |
| `NODE_ENV` | Sets Express runtime mode | Optional (Defaults to `production`) | `production` |
| `HAKKU_ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | Optional (Default includes `https://hakku-ai.netlify.app`) | `https://hakku-ai.netlify.app,https://www.hakku.in` |
| `BHARATCODE_API_KEY` | External BharatCode AI API key for multilingual parsing | Optional (Only needed if AI features enabled) | Provided by BharatCode |
| `NODE_VERSION` | Enforces modern Node.js runtime | Recommended | `20.x` or `22.x` |

#### How to Generate a Secure `SESSION_SECRET`:
Run this command in any terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the 64-character hex output and paste it as the value for `SESSION_SECRET` in Netlify.

---

## 3. Build & Runtime Configuration (`netlify.toml`)

The repository includes a pre-configured, hardened `netlify.toml` in the project root:

```toml
[build]
  publish = "public"
  functions = "netlify/functions"
  command = "npm run build"

# API Route Rewrites
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200
  force = true

# SEO Static File Routing
[[redirects]]
  from = "/robots.txt"
  to = "/robots.txt"
  status = 200

[[redirects]]
  from = "/sitemap.xml"
  to = "/sitemap.xml"
  status = 200

# Edge Security Headers
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://api.bharatcode.in https://*.bharatcode.in; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(self), geolocation=(), payment=()"
    Cross-Origin-Opener-Policy = "same-origin"

# Dynamic API Caching Controls
[[headers]]
  for = "/api/*"
  [headers.values]
    Cache-Control = "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, private"
    Pragma = "no-cache"
```

---

## 4. Cold-Start and Multi-Instance Behavior

1. **Stateless Scalability:** Netlify automatically spins up ephemeral container instances in response to traffic spikes. Because Hakku AI's session model is stateless (profile data is encrypted into client-held `sessionTicket` envelopes using `AES-256-GCM` with `SESSION_SECRET`), any cold or warm instance can decrypt and verify any valid ticket across the entire serverless fleet.
2. **Revocation Propagation & Limitation:** In-memory ticket revocation maps (`revokedTickets`) reside solely in the local RAM of the container that processes the wipe request. In serverless multi-instance execution, cross-instance revocation is NOT guaranteed. Client-side state destruction and the 20-minute expiry (`SESSION_TTL_MS = 20 * 60 * 1000 = 1,200,000 ms`) provide the baseline protection. No external database, distributed cache, or Netlify Blobs has been added.
3. **Low Latency:** The statutory matching engine (`matcher.js`) executes in approximately 1 millisecond with zero external database dependencies, ensuring that total serverless execution time remains well under 50ms.

---

## 5. Domain Configuration & SSL/TLS

1. **Custom Domain:** Go to **Site configuration** > **Domain management** > **Add custom domain** (e.g., `hakku.in` or `www.hakku.in`).
2. **DNS Configuration:**
   - Point the `A` record for the apex domain to Netlify's load balancer IP (`75.2.60.5`).
   - Point the `CNAME` record for `www` to `<your-site-name>.netlify.app`.
3. **Automated SSL/TLS:** Netlify provisions a free Let's Encrypt SSL/TLS certificate automatically once DNS propagation is detected.
4. **HSTS Preload:** The production header `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` ensures modern browsers will refuse unencrypted HTTP connections permanently.

---

## 6. Pre-Flight Deployment Checklist

Before triggering production deployment from GitHub:
- [x] `SESSION_SECRET` configured in Netlify Environment Variables.
- [x] `tests/sweep.mjs` executed (100/100 tests passed).
- [x] `BharatCode.txt` untracked and excluded in `.gitignore`.
- [x] Netlify redirects configured for `/api/*`, `/robots.txt`, and `/sitemap.xml`.
- [x] Security headers tested and validated against CSP syntax.
- [x] Standalone legal pages (`privacy.html`, `terms.html`, `about.html`, `contact.html`) linked in footer.
- [x] `git status` clean and awaiting final user approval.

---

## 7. Rollback & Emergency Recovery

In the event of an unexpected edge issue during a deployment:
1. Open the Netlify Dashboard > **Deploys**.
2. Find the previous stable deploy.
3. Click **Options** > **Publish deploy**.
4. Netlify will instantaneously roll back the CDN edge to the selected build in under 5 seconds with zero downtime.

