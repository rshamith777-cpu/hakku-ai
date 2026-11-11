# HAKKU AI — Google AdSense & Publisher Policy Readiness (`ADSENSE_READINESS.md`)

**Date:** November 2026  
**Application:** Hakku AI 5.0 (Sovereign Citizen Welfare OS)  
**Target Ad Platform:** Google AdSense / Google Ad Manager  
**Review Status:** **READY FOR APPLICATION** (Pending initial traffic accumulation)  

---

## 1. Executive Summary

Google AdSense enforces strict **Publisher Policies** and **Webmaster Quality Guidelines**. Websites offering thin tools or lacking transparent publisher information are routinely rejected under *"Low-value content"* or *"Site navigation issues"*.

To align with publisher policy expectations prior to submission, Hakku AI has undergone a full publisher readiness overhaul. The platform now includes dedicated compliance pages (`privacy.html`, `terms.html`, `about.html`, `contact.html`), comprehensive footer navigation, original statutory annotations, and transparent ownership disclosures. Approval is subject to Google's independent editorial review and sufficient organic traffic volume.

---

## 2. Google AdSense Policy Compliance Audit

| Policy Requirement | AdSense Criterion | Hakku AI Implementation | Compliance Status |
|---|---|---|---|
| **Original, High-Value Content** | Content must provide unique utility, structured information, and not be auto-generated spam. | Original 24-scheme statutory catalog with curated eligibility criteria, document checklists, and rejection risk rules. | **COMPLIANT** |
| **Privacy Policy Page** | Must disclose data handling, third-party services, and advertising cookies. | Dedicated, thorough `/privacy.html` detailing zero-persistence RAM model, DPDP rights, and third-party AI processing. | **COMPLIANT** |
| **Terms of Service** | Must clearly define acceptable use, disclaimer of government affiliation, and liability limitations. | Dedicated `/terms.html` clearly establishing non-government, independent civic status and statutory disclaimers. | **COMPLIANT** |
| **About Us Page** | Must identify the publisher, mission, and operational background. | Dedicated `/about.html` explaining Hakku AI's origin, sovereign civic mission, and engineering architecture. | **COMPLIANT** |
| **Contact Us & Grievance Page** | Must provide working contact methods for user support and inquiries. | Dedicated `/contact.html` featuring email support, GitHub repository links, and grievance reporting. | **COMPLIANT** |
| **Clear Site Navigation** | Users must easily find content without broken links, confusing redirects, or dead ends. | Fixed semantic footer links present across all pages (`index.html`, `about.html`, `privacy.html`, etc.). | **COMPLIANT** |
| **No Deceptive Layouts** | Content and clickable elements must not mimic advertisements or deceive clicks. | Form inputs, evaluation triggers, and printable vouchers are cleanly separated with distinct styling. | **COMPLIANT** |
| **Technical Site Health** | Must run over HTTPS, load under 3 seconds, and be responsive across mobile screens. | 100% HTTPS with HSTS preload, sub-1.2s LCP, and full responsive design on mobile, tablet, and desktop. | **COMPLIANT** |

---

## 3. Disclaimers & Civic Integrity Notice

To maintain credibility and comply with Indian regulatory guidelines regarding government impersonation, Hakku AI prominently displays a sovereign civic disclaimer across all pages and footers:

> **Official Disclaimer:**  
> *"Hakku AI is an independent, open civic-tech platform dedicated to citizen welfare education and statutory rights awareness. Hakku AI is not affiliated with, authorized by, or an official agency of the Government of India or any State Government. All scheme names, logos, and statutory provisions belong to their respective government authorities."*

This disclaimer protects the platform from trademark disputes and ensures transparency for both citizens and advertising networks.

---

## 4. Recommended Ad Placements for Civic Tech

When approved for Google AdSense, ad units must be placed thoughtfully to ensure monetization without compromising citizen trust or usability:

```
┌────────────────────────────────────────────────────────┐
│ [Top Leaderboard Ad Unit: 728x90 (Desktop) / 320x50]   │
└────────────────────────────────────────────────────────┘
                       ▼
┌────────────────────────────────────────────────────────┐
│                   Hakku AI Header                      │
│             Language Selector & Mode Toggle            │
└────────────────────────────────────────────────────────┘
                       ▼
┌────────────────────────────────────────────────────────┐
│         Citizen Profile Evaluation Form                │
│       (Keep this area 100% ad-free for trust)          │
└────────────────────────────────────────────────────────┘
                       ▼
┌────────────────────────────────────────────────────────┐
│ [In-Feed Native Ad Unit: Labeled "Sponsored Resource"] │
└────────────────────────────────────────────────────────┘
                       ▼
┌────────────────────────────────────────────────────────┐
│           Entitled Schemes Results Vault               │
│          Official Government Portal Links              │
└────────────────────────────────────────────────────────┘
                       ▼
┌────────────────────────────────────────────────────────┐
│ [Bottom Anchor / Sticky Ad: 320x50 on Mobile]          │
└────────────────────────────────────────────────────────┘
```

### Critical Rules for Ad Units:
1. **Never place ads adjacent to government portal redirect links** (prevents misleading clicks).
2. **Never place ads inside the printable PDF voucher** (keeps official documents tamper-proof and clean).
3. **Always display the "Ad" or "Sponsored" tag** above any banner unit.

---

## 5. Step-by-Step AdSense Application Guide

Follow these steps once initial traffic reaches approximately 50–100 daily unique visitors:
1. Navigate to [Google AdSense](https://www.google.com/adsense/start/).
2. Click **Get Started** and link your Google Account.
3. Enter your site URL: `https://hakku-ai.netlify.app` (or custom domain `https://hakku.in`).
4. Select your payment country (India).
5. Review and accept the AdSense Terms of Service.
6. Copy the provided AdSense verification snippet `<script async src="https://pagead2.googlesyndication.com/..."></script>` and place it in the `<head>` of `public/index.html`.
7. Click **Request Review** in the AdSense dashboard.
8. Typical review turnaround: 48 hours to 7 business days.

