# GigLedger

> "Know Your Real Earnings"

A free PWA for gig workers to calculate true net income from earnings screenshots. Supports Uber, DoorDash, Instacart, Lyft, and more.

🌐 **Live Site:** https://gigledger.xyz

## ✨ Features

- 📸 **Screenshot Upload** — Upload or drag a screenshot of your earnings
- 🧮 **True Income Calculator** — See net income after IRS-standard vehicle costs
- 📤 **Shareable Result Cards** — Beautiful cards to share with friends
- 📊 **Weekly Tracker** — Track earnings over time (localStorage, no account)
- 📱 **PWA** — Works as a website or app on iOS/Android
- 🔒 **Privacy First** — No account, no data stored on servers

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Local development
npm run dev

# Build for Cloudflare
npm run build:cloudflare

# Deploy
npm run deploy
```

## 🛠 Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** TailwindCSS v4
- **Deployment:** Cloudflare Workers + Workers Assets
- **Image Generation:** HTML5 Canvas API (client-side)
- **Storage:** localStorage (no backend needed)

## 📁 Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout + header + footer
│   ├── page.tsx            # Landing page
│   ├── globals.css         # Tailwind + custom styles
│   ├── analyze/page.tsx   # Upload + calculator
│   ├── result/page.tsx    # Share card + sharing
│   ├── tracker/page.tsx   # Weekly tracker
│   ├── about/page.tsx     # About
│   └── privacy/page.tsx   # Privacy policy
└── lib/
    ├── calculator.ts       # Income calculation logic
    ├── card-generator.ts    # Canvas share card
    ├── platforms.ts         # Platform definitions
    └── storage.ts          # localStorage helpers
```

## 📊 Calculator Logic

- **Net Income** = Gross Earnings − (Miles Driven × Cost/Mile)
- **True Hourly Rate** = Net Income ÷ Hours Worked
- **Cost/Mile** = IRS 2026 standard rate = $0.70/mile

## 🔒 Privacy

- No account required
- All data stored in browser localStorage
- No cookies, no tracking
- Screenshots processed locally

## 📄 License

MIT
