# GigLedger — MVP Specification

## 1. Project Overview

**Product Name:** GigLedger
**Domain:** GigLedger.com
**Tagline:** "Know Your Real Earnings"
**Type:** PWA (Progressive Web App) — works as website + iOS/Android app

**Core Value:** Gig workers upload a screenshot of their earnings → instantly see their true net income after costs → share a result card.

**Target Users:**
- Uber / Lyft drivers in the US
- DoorDash, Instacart, Amazon Flex delivery drivers
- Any gig economy worker wanting to know their real earnings
- 59M+ Americans in gig work, 16M+ using it as primary income

**Core Insight:**
Platforms show gross income. GigLedger tells the truth: what you actually take home.

---

## 2. Core Features (MVP)

### 2.1 Screenshot Upload + OCR (Primary) ⭐

**Flow:**
1. User opens site → taps "Upload Screenshot"
2. Selects photo from gallery OR takes new photo
3. Image sent to Google Cloud Vision API
4. System extracts: total earnings, tips, bonuses, trip count
5. User enters: hours worked, miles driven
6. Results displayed instantly

**Supported in MVP:**
- Uber Driver — Earnings screen (weekly/daily)
- Manual entry — fallback for all other platforms

**Tech:** Google Cloud Vision API
- Free tier: 1,000 calls/month
- Accuracy on Uber screenshots: ~85% (acceptable for MVP)
- Fallback: manual correction if OCR misreads

### 2.2 True Income Calculator ⭐

**Inputs:**
- Gross earnings (from OCR or manual)
- Tips / bonuses (from OCR)
- Hours worked (user input)
- Miles driven (user input)
- Cost per mile (default: IRS 2026 rate = $0.70/mile)

**Outputs:**
- **Net Income** = Gross − (Miles × Cost/mile)
- **True Hourly Rate** = Net Income / Hours
- **Cost Breakdown**: fuel estimate, vehicle depreciation
- **Comparison**: "Better than X% of gig workers this week"

**IRS 2026 standard mileage rate: $0.70/mile**
(include note: users should consult tax professional)

### 2.3 Shareable Result Card ⭐

**Generated via HTML5 Canvas — no server needed.**

```
┌─────────────────────────────────┐
│  📊 GigLedger                   │
│  ─────────────────────────────── │
│  Your True Earnings             │
│                                 │
│  Gross:          $342.50       │
│  Vehicle Cost:   -$89.60        │
│  ─────────────────────────────── │
│  NET INCOME:     $252.90       │
│                                 │
│  💰 $28.10 / hour               │
│  ⏱️ 9 hours  |  🚗 128 miles     │
│                                 │
│  📊 Better than 73% of drivers  │
│                                 │
│  gigledger.com                  │
└─────────────────────────────────┘
```

**Share targets:**
- Twitter/X (deep link with auto text)
- WhatsApp (deep link)
- Instagram Story (share card image)
- Copy link
- Copy image

### 2.4 Weekly Tracker (localStorage) ⭐

- Add multiple entries (one per day/platform)
- Weekly gross, net, and hourly rate
- Best day indicator
- Data stored in browser (no account needed)

### 2.5 Multi-Platform Manual Entry

- Select platform: Uber / DoorDash / Instacart / Lyft / Amazon Flex / Other
- Enter earnings manually
- Same calculator + result card
- Platform icon shown on result card

---

## 3. PWA Specification

### What makes it a PWA:

| Feature | Implementation |
|---------|---------------|
| Installable | Service Worker + Web App Manifest |
| Offline | Service Worker caches shell |
| App-like UI | Full-screen, no browser chrome when installed |
| iOS Add to Home | manifest.json + iOS meta tags |
| Fast load | Static generation, Cloudflare CDN |
| Responsive | Mobile-first, works 375px+ |

### manifest.json:
```json
{
  "name": "GigLedger - Know Your Real Earnings",
  "short_name": "GigLedger",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0F172A",
  "theme_color": "#2563EB",
  "icons": [...]
}
```

### Service Worker:
- Cache app shell (HTML, CSS, JS)
- Work offline with cached version
- Update in background when new version available

---

## 4. Tech Stack

| Component | Choice |
|-----------|--------|
| Framework | Next.js 16 (App Router) |
| Styling | TailwindCSS v4 |
| Deployment | Cloudflare Workers + Workers Assets |
| OCR | Google Cloud Vision API |
| Image Generation | HTML5 Canvas API (client-side) |
| Storage | localStorage (no backend for MVP) |
| Domain | gigledger.com |
| PWA | next-pwa or manual Service Worker |

---

## 5. Site Structure

```
/                     → Landing page (hero + CTA)
/analyze              → Upload + OCR + Calculator
/result               → Result card + share
/tracker              → Weekly tracker (localStorage)
/about                → About + disclaimer
/privacy              → Privacy policy
```

---

## 6. Design System

### Colors
| Role | Hex | Usage |
|------|-----|-------|
| Primary | #2563EB | Buttons, links |
| Emerald | #10B981 | Positive numbers, income |
| Yellow | #FBBF24 | CTA buttons, highlights |
| Red | #EF4444 | Costs, warnings |
| Dark Navy | #0F172A | Dark mode, footer |
| Slate White | #F8FAFC | Light backgrounds |
| Slate Dark | #1E293B | Primary text |

### Typography
- **Headings / Numbers:** Inter (700, 800)
- **Money amounts:** JetBrains Mono (monospace — feels precise)
- **Body:** Inter (400, 500)

### Design Principles
- Trust-inspiring (financial tool = must feel reliable)
- Card-based with soft shadows
- Green = positive, Red = cost, Yellow = CTA
- Numbers always in monospace
- Mobile-first (80% traffic from phone)

### Component Library
```
Primary button:  bg-blue-600 hover:bg-blue-700 text-white rounded-xl
CTA button:     bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-xl
Result card:    bg-white shadow-xl rounded-2xl p-6
Money (income): text-emerald-600 font-mono text-2xl
Money (cost):   text-red-500 font-mono
Platform icon:  w-10 h-10 rounded-lg bg-slate-100
```

---

## 7. SEO Strategy

### Target Keywords
| Keyword | Monthly Searches | Priority |
|---------|----------------|---------|
| uber earnings calculator | 8,100 | 🔥🔥🔥 |
| gig worker earnings | 1,900 | 🔥🔥 |
| doordash earnings calculator | 6,600 | 🔥🔥🔥 |
| how much do uber drivers make | 18,100 | 🔥🔥🔥🔥🔥 |
| uber driver pay calculator | 3,600 | 🔥🔥🔥 |
| gig economy earnings | 1,200 | 🔥🔥 |

### Page Meta Strategy
```
/ (Landing):
  Title: GigLedger - Uber Earnings Calculator & Gig Worker Pay Tracker
  H1: Uber Earnings Calculator — Know Your Real Pay
  Description: Upload your Uber earnings screenshot. See your true net income after gas and vehicle costs. Free, 5 seconds.

/analyze:
  Title: Calculate Your True Gig Earnings — GigLedger
  H1: Calculate Your True Earnings
  Description: Enter your gross earnings, miles driven, and hours worked. Get your real net income instantly.

SEO geo: None needed. .com = US default.
```

---

## 8. Monetization

### MVP (Free)
- Unlimited screenshot uploads
- Weekly tracker
- Share cards

### Phase 2 (One-time payment)
- **$9.99 one-time**: PDF Annual Earnings Report (for tax filing)
- No subscription — gig workers hate subscriptions

### Phase 3 (Affiliate)
- Car insurance comparison (Progressive, GEICO — $20-50 per signup)
- Credit cards for gig workers ($50 per approved application)
- Gas credit cards (3-5% cash back on gas)

---

## 9. Growth Strategy

### Content (TikTok + Instagram Reels)
**Model:** Truth-bombing content

> "You think you made $450 this week? After gas and wear-and-tear, you actually made $280."

Format:
1. Hook: "You think you made $X? Let's check"
2. Demo: Upload screenshot → real number revealed
3. Shock: "Wait, that's only $X/hour?!"
4. CTA: "Check yours at GigLedger.com"

Target accounts: Uber driver TikTok creators (collaborate), Facebook driver groups

### Referral
- "Share your result card → get friend 3 free analyses"
- Viral loop built into product (sharing is the feature)

---

## 10. Privacy & Legal

- **No account required** (MVP: localStorage only)
- No data sold or shared
- Clear disclaimer: "GigLedger is for informational purposes only"
- "Not affiliated with Uber, DoorDash, or any gig platform"
- "Cost estimates are approximations — consult a tax professional"
- Privacy policy: no cookies, no tracking, OCR data not stored

---

## 11. Out of Scope (Future)

- Bank/Platform API integrations (requires OAuth, complex)
- Automatic GPS mileage tracking
- Tax filing integration
- Native iOS/Android app (PWA sufficient for MVP)
- Multi-user accounts
- Employer payroll features

---

## 12. Success Metrics (MVP)

- [ ] Landing page loads < 2s on 4G
- [ ] OCR reads Uber earnings screenshot correctly ≥ 80%
- [ ] Result card generates and shares on iOS Safari
- [ ] Result card generates and shares on Android Chrome
- [ ] Weekly tracker persists after page refresh
- [ ] PWA installs to iOS home screen correctly
- [ ] 10 beta users share a result card
- [ ] Domain resolves correctly

---

## 13. Development Phases

### Phase 1: MVP (2 weeks)
- [ ] Landing page
- [ ] Screenshot upload + Google Vision OCR
- [ ] Income calculator
- [ ] Result card (Canvas)
- [ ] Share buttons
- [ ] Manual entry
- [ ] PWA manifest + Service Worker
- [ ] Deploy to Cloudflare Workers
- [ ] Domain binding

### Phase 2: Tracker (Month 2)
- [ ] Weekly summary page
- [ ] Multiple platform entries
- [ ] History page
- [ ] Better OCR error handling

### Phase 3: Growth (Month 3)
- [ ] DoorDash OCR support
- [ ] PDF Annual Report ($9.99)
- [ ] TikTok content launch
- [ ] Google Ads for "uber earnings calculator"

### Phase 4: Ecosystem (Month 6)
- [ ] Tax estimator (quarterly)
- [ ] Insurance comparison
- [ ] Platform comparison ("Which platform pays better this week?")

---

## 14. Competitive Landscape

| Feature | GigLedger | Everlance | Hurdlr | Stride |
|---------|-----------|-----------|--------|--------|
| No signup | ✅ | ❌ | ❌ | ✅ |
| Screenshot OCR | ✅ | ❌ | ❌ | ❌ |
| Share cards | ✅ | ❌ | ❌ | ❌ |
| Free (core) | ✅ | ❌ ($12/mo) | ❌ | ✅ |
| PWA / Mobile-first | ✅ | ❌ (App) | ❌ (App) | ✅ (Web) |
| Tax estimate | Future | ✅ | ✅ | ✅ |

**GigLedger's edge:** Speed + simplicity + shareability. Others are full financial apps, we are a "truth mirror."
