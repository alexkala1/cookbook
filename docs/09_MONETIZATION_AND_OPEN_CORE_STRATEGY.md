# Heirloom: Monetization & Open-Core Business Strategy

## 1. Executive Strategy: The "Open-Core Hybrid Model"

Heirloom adopts an **Open-Core & Local-First Hybrid Model** inspired by the sustainable open-source ecosystems of **Obsidian, Ghost, and Immich**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   HEIRLOOM COMMUNITY EDITION (FOSS)                    │
│   • 100% Free & Open Source (MIT / AGPLv3)                             │
│   • Local-First SQLite Database                                        │
│   • Bring-Your-Own-Key (BYOK) & Local Ollama Support                   │
│   • PWA Offline Support (Run in any browser)                           │
│   • Community-Maintained Recipe & Video Scrapers                       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
┌───────────────────────────┐             ┌───────────────────────────┐
│     HEIRLOOM CLOUD        │             │   HEIRLOOM KEEPSAKE       │
│  (Managed Subscription)   │             │ (Physical Print-on-Demand)│
├───────────────────────────┤             ├───────────────────────────┤
│ • $4 - $6 / month         │             │ • $65 - $85 per book      │
│ • Zero-setup instant sync │             │ • One-click hardcover     │
│ • Family sharing accounts │             │   linen-bound heirloom    │
│ • Pre-packaged AI credits │             │   cookbook                │
│ • Encrypted cloud backup  │             │ • Connected to Blurb/Lulu │
└───────────────────────────┘             └───────────────────────────┘
```

---

## 2. Why Pure SaaS is a Trap for Cookbooks

1. **The LLM Unit Economics Liability:**
   - Recipes ingested via video and audio (Whisper transcription) paired with deep culinary reasoning (Claude 3.5 Sonnet / Gemini Pro) are token-heavy.
   - In a fixed $8/mo subscription, power users ingesting 50 videos a month would cause negative gross margins.
   - **BYOK eliminates this risk completely:** the user pays the LLM provider directly (which costs pennies for personal use), and the host has $0 AI infrastructure liability.
2. **The "Grandma's Secrets" Trust Barrier:**
   - Family recipes are deeply personal. Users refuse to lock generational secrets into proprietary platforms that could pivot, lock data behind paywalls, or shut down.
   - Local-first open-source storage creates generational trust.

---

## 3. The Three Revenue Streams

### Stream 1: "Heirloom Cloud" (Managed Hosted Sync)
- **Target Audience:** Non-technical family members, partners, and cooks who don't want to run Docker or manage local databases.
- **Offering:**
  - Automated end-to-end encrypted backup and cross-device sync.
  - One-click family sharing: invite spouse, children, or siblings to share a synchronized family cookbook.
  - Optional bundled AI credits for users who don't want to acquire their own API keys.
- **Pricing:** $4.99/month or $49/year.

### Stream 2: Native App Store Packages ("The Paprika Playbook")
- **Target Audience:** Mobile users wanting one-tap App Store installs.
- **Offering:**
  - Packaged native binaries for iOS and Android (via Capacitor / Tauri).
  - Native system integrations: Apple Watch cooking timers, iOS Live Activities for cooking progress, lock-screen timer widgets, and native camera scanning.
- **Pricing:** One-time purchase ($9.99 – $14.99).

### Stream 3: "The Heirloom Hardcover" (Physical Print-on-Demand)
- **Target Audience:** Gift-givers, holidays, weddings, and generational archiving.
- **Offering:**
  - Users select 30, 50, or 100 recipes from their digital cookbook.
  - The app automatically generates a professional, high-resolution, print-ready PDF layout with elegant serif typography, family photos, grandma's notes, and food science tips.
  - Integrated via API with global print-on-demand book manufacturers (Blurb, Lulu, or Gelato).
  - Ships a gold-foil embossed, cloth-bound hardcover heirloom cookbook to their door.
- **Financials:**
  - Production Cost: ~$22 – $28.
  - Retail Price: $69 – $89.
  - Margin: 60%+ net profit per book.

---

## 4. Licensing & Governance

- **Core Repository:** Open source under **AGPLv3** (ensures any hosted forks must contribute improvements back to the community) or **MIT** (maximum developer adoption).
- **Trademarks & Cloud Services:** The name "Heirloom" and the managed cloud sync/print services remain commercial assets of the project creator.
