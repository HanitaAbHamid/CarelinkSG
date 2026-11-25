# CareLink SG

An AI-assisted, offline-first **Singapore family & domestic helper eldercare coordination PWA** built around HSA non-SaMD safety boundaries, MOM rest-day respect, and Singapore PDPA compliance.

## Features Implemented (Phase 1 Core Care Loop)

1. **Role-Segmented Views (Zero Cognitive Bloat)**
   - **Helper ("Today" Flow):** Localized UI (English, Bahasa Indonesia, Malay, Mandarin, Tamil), large-print medication schedule, 3-second tray proof for high-risk medications, non-punitive *"Couldn't Give / Unwell"* exception drawer, daily routine timeline, pinned Voice Translator button, and MOM Rest-Day Protection Shield.
   - **Family Hub:** Locked 4-tab layout — Twice-Daily Calm Digest, **1-Tap Family Approval Inbox** (human-in-the-loop safety gate for OCR pharmacy bags and post-clinic changes), Tiered Alerts (Red / Amber / Green), **MOM Rest-Day Handoff Switcher** across siblings, Clinician-Set Safety Thresholds, **Opt-In Care Packs**, and 1-click **PDPA CSV/JSON Data Export**.
   - **Senior Mode (Zero-App Default):** Full care loop works without the senior ever needing a phone; optional high-contrast 2-button view (*Speak to Helper* / *Call Family or 995*).

2. **Frictionless Health & Safety Monitoring (Non-SaMD)**
   - **Snap-and-Confirm LCD OCR:** Works with any standard Omron BP cuff or Accu-Chek glucometer (zero Bluetooth pairing), displaying giant 48pt editable digits guarded by physiological sanity bounds and requiring explicit human confirmation.
   - **Passive OS Wearable Bridge:** Supports Apple Health / Google Health Connect HR and native watch fall alert relay.
   - **Deterministic Threshold Alerts & 14-Day Non-Diagnostic Trends.**

3. **Multilingual Care Bridge & Clinic Co-Pilot**
   - **Offline Verified Care Deck:** Pre-cached Singapore eldercare phrases across EN, ID, MS, ZH, TA, **Hokkien, Cantonese, and Teochew** (with romanized pronunciation & browser voice playback) — works with zero data in HDB lifts and polyclinics.
   - **Live AI Voice Bridge:** Push-to-talk speech & text translation tuned for Singapore eldercare phrasing.
   - **Clinic Co-Pilot:** Printable **1-Page Clinical Doctor Brief** + **After-Doctor Update** capture with explicit Singapore PDPA doctor consent banner and translated helper action cards.

4. **Anti-Bloat Opt-In Care Packs**
   - Disabled modules (`Wound & Skin Care Tracker`, `Care & Grocery Expense Ledger`, `Dementia Routine & Safe-Zone Check-in`) never render in Helper or Family views until toggled ON by the Family Admin.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Enable live Gemini 2.5 Flash OCR & Translation
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY (or leave blank to use built-in offline/demo mode)

# 3. Run API + Mobile-First PWA in dev mode
npm run dev
# Web app: http://localhost:5173
# API server: http://127.0.0.1:3001

# 4. Run automated safety & API tests
npm test

# 5. Production build & run
npm run build
npm start
```
