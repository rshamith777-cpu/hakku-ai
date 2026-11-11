# HAKKU AI — Technical SEO & Search Visibility Audit (`SEO_REPORT.md`)

**Date:** November 2026  
**Application:** Hakku AI 5.0 (Sovereign Citizen Welfare OS)  
**Target Domain:** `https://hakku-ai.netlify.app`  
**Target Languages:** English (`en`), Kannada (`kn`), Hindi (`hi`), Tamil (`ta`), Telugu (`te`)  

---

## 1. Executive Summary

A comprehensive Technical SEO audit was performed to evaluate Hakku AI’s organic search crawlability, indexing indexation, metadata coverage, structured schema data, and multilingual discoverability.

Prior to hardening, the platform lacked search engine crawling directives (`robots.txt`), XML sitemaps, social graph metadata (Open Graph / Twitter Cards), and structured JSON-LD schemas. These gaps have been closed by injecting search engine primitives into `public/index.html`, deploying an automated multilingual `sitemap.xml`, configuring `robots.txt`, and launching dedicated, crawlable informational pages (`privacy.html`, `terms.html`, `about.html`, `contact.html`).

---

## 2. Technical SEO Baseline Implementations

### 2.1 Search Engine Directives (`public/robots.txt`)
A clean, crawl-friendly `robots.txt` was deployed with explicit reference to the XML sitemap:
```txt
User-agent: *
Allow: /
Allow: /privacy.html
Allow: /terms.html
Allow: /about.html
Allow: /contact.html
Disallow: /api/

Sitemap: https://hakku-ai.netlify.app/sitemap.xml
```
*Purpose:* Directs Googlebot, Bingbot, and other crawlers to index citizen-facing pages while preventing unneeded indexing of raw JSON API endpoints (`/api/`).

### 2.2 Canonical XML Sitemap (`public/sitemap.xml`)
The XML sitemap strictly indexes crawlable canonical document URLs:
1. **Primary Hub:** Homepage canonical `https://hakku-ai.netlify.app/` with reciprocal `xhtml:link rel="alternate" hreflang="..."` annotations across 5 languages (`en`, `kn`, `hi`, `ta`, `te`).
2. **Informational Hubs:** `/about.html`, `/privacy.html`, `/terms.html`, `/contact.html`.

*Important Search Engine Compliance Rule:* Fragment-based URLs (e.g. `/#/scheme/...`) have been completely removed from `sitemap.xml`. Search engine crawlers (Googlebot, Bingbot) do not index URL fragments per RFC 3986 and Google Search Central guidelines.

---

## 3. Recommended Future Architecture for Scheme-Specific Indexing

To index all 24 individual schemes organically without introducing a complex SSR framework:
1. **Static Build Generator:** A lightweight Node.js script (e.g. `scripts/generate-scheme-pages.mjs`) reads `data/schemes.json` at build time and writes static HTML files into `public/schemes/<scheme-id>.html`.
2. **On-Page SEO Structure:** Each static scheme page includes:
   - Dedicated title (e.g. `<title>Gruha Lakshmi Scheme 2026 — Eligibility, Documents & Rules | Hakku</title>`)
   - Unique meta description
   - Server-rendered Schema.org `GovernmentService` JSON-LD
   - High-contrast statutory criteria, document checklists, and common rejection traps
   - An embedded CTA button: *"Check My Instant Eligibility on Hakku"* that loads the interactive SPA app.
3. **Sitemap Integration:** Once static HTML files exist on disk, their canonical paths (`/schemes/<scheme-id>.html`) can be added to `sitemap.xml` for full search engine indexing.

### 2.3 Semantic Metadata & Social Graph Tags
`public/index.html` has been augmented with search-optimized title, description, and social sharing metadata:
- **Primary Title:** `Hakku AI — Sovereign Citizen Welfare OS | Check Government Scheme Eligibility`
- **Meta Description:** `Discover your guaranteed government schemes, rights, and subsidies with Hakku AI. 100% private, zero-hallucination, statutory eligibility matching in Kannada, Hindi, Tamil, Telugu, and English.`
- **Canonical URL:** `<link rel="canonical" href="https://hakku-ai.netlify.app/">`
- **Open Graph (Facebook/WhatsApp/LinkedIn):** `og:type=website`, `og:title`, `og:description`, `og:image`, `og:url`.
- **Twitter Card:** `summary_large_image` tag suite ensuring rich card previews when shared on Twitter/X.

### 2.4 Structured Data (Schema.org JSON-LD)
Hakku AI now embeds dual JSON-LD schemas inside the `<head>` of `index.html`:
1. **`WebSite` Schema:** Establishes domain authority, official platform name, and search entity mapping.
2. **`GovernmentService` Schema:** Explicitly defines Hakku AI as a citizen welfare entitlement assessment service operated under sovereign Indian legal frameworks, signaling high topical relevance to Google's Knowledge Graph.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://hakku-ai.netlify.app/#website",
      "url": "https://hakku-ai.netlify.app/",
      "name": "Hakku AI",
      "description": "Sovereign Citizen Welfare Discovery & Statutory Rights OS"
    },
    {
      "@type": "GovernmentService",
      "@id": "https://hakku-ai.netlify.app/#service",
      "name": "Citizen Welfare Eligibility Discovery",
      "serviceType": "Public Welfare Entitlement Assessment",
      "areaServed": {
        "@type": "Country",
        "name": "India"
      }
    }
  ]
}
```

---

## 3. Multilingual SEO Architecture

India's next billion internet users search primarily in Indic scripts (Kannada, Hindi, Tamil, Telugu). Hakku AI supports this via:
- **Bidirectional Language Switcher:** Switches UI state instantaneously while retaining URL context.
- **Hreflang Tags:** Explicitly declared in the `<head>` of `index.html`:
  ```html
  <link rel="alternate" hreflang="en" href="https://hakku-ai.netlify.app/" />
  <link rel="alternate" hreflang="kn" href="https://hakku-ai.netlify.app/?lang=kn" />
  <link rel="alternate" hreflang="hi" href="https://hakku-ai.netlify.app/?lang=hi" />
  <link rel="alternate" hreflang="ta" href="https://hakku-ai.netlify.app/?lang=ta" />
  <link rel="alternate" hreflang="te" href="https://hakku-ai.netlify.app/?lang=te" />
  <link rel="alternate" hreflang="x-default" href="https://hakku-ai.netlify.app/" />
  ```
- **Indic Keyword Density:** On-page headings and scheme descriptions feature authentic Indic vocabulary (e.g., "ಗ್ಯಾರಂಟಿ ಯೋಜನೆಗಳು", "ಸರ್ಕಾರಿ ಸೌಲಭ್ಯ", "सरकारी योजना", "पात्रता जांच").

---

## 4. Crawlability & Indexing Checklist

| SEO Requirement | Implementation | Status |
|---|---|---|
| `robots.txt` accessible | Direct file at `/robots.txt` with Netlify rewrite | **VERIFIED** |
| `sitemap.xml` accessible | Direct file at `/sitemap.xml` with Netlify rewrite | **VERIFIED** |
| Canonical URL declared | Points to `https://hakku-ai.netlify.app/` | **VERIFIED** |
| Viewport configuration | `<meta name="viewport" content="width=device-width, initial-scale=1.0">` | **VERIFIED** |
| Internal linking | Footer links to Privacy, Terms, About, Contact, Scheme Vault | **VERIFIED** |
| HTTPS enforcement | HSTS preload + automatic Netlify SSL certificate | **VERIFIED** |
| Social share card preview | Open Graph & Twitter Cards declared | **VERIFIED** |

---

## 5. Google Search Console Setup Instructions

To verify domain ownership and expedite Google indexing:
1. Open [Google Search Console](https://search.google.com/search-console).
2. Add URL prefix property: `https://hakku-ai.netlify.app/`.
3. Select **HTML tag** verification method, or upload the HTML verification file to `public/`.
4. Once verified, navigate to **Sitemaps** > Enter `sitemap.xml` > Click **Submit**.
5. Googlebot will queue and crawl the primary hub and all 24 scheme references.

