# GigLedger

Income, cost, and true-profit ledger for one-person companies at `gigledger.xyz`, available in English, Traditional Chinese, and Simplified Chinese.

## Structure

```text
assets/          Local brand assets and social share image
en/              Generated English pages
zh-TW/           Generated Traditional Chinese pages
zh-CN/           Generated Simplified Chinese pages
config/locales.mjs
i18n/            Copy for all three locales
scripts/build.mjs
styles.css
proto.css        Ledger and dashboard styles
app-ledger.js    Authenticated and in-page ledger UI
app.js
_redirects       Cloudflare Pages redirects for legacy `.html` app URLs
```

Generated HTML files should not be edited by hand. Change `i18n/*.json`, `scripts/build.mjs`, `styles.css`, or `app.js`, then rebuild.

## Build

Requires Node.js 18 or newer.

```bash
node scripts/build.mjs
```

Run the ledger regression tests with `node --test` on Node.js 22.13 or newer.

## Preview

```bash
python3 -m http.server 4174 --directory dist
```

Open:

- `http://localhost:4174/en/`
- `http://localhost:4174/zh-TW/`
- `http://localhost:4174/zh-CN/`
- `http://localhost:4174/en/app/`
- `http://localhost:4174/zh-TW/app/`
- `http://localhost:4174/zh-CN/app/`

## Deploy

Cloudflare Pages hosts the site and Pages Functions API; Cloudflare D1 stores accounts and ledger data.

- Build command: `node scripts/build.mjs`
- Output directory: `dist/` (generated from the public-file allowlist)
- Domain: `gigledger.xyz`
- D1 binding: `DB` in `wrangler.toml`
- Required secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`

Apply pending D1 migrations before deploying a build that uses them. Run `wrangler pages deploy dist --project-name=gigledger --branch=main` from the project root so Wrangler includes Pages Functions.

## Current Scope

- Google OAuth login, D1 persistence, JSON export, and account deletion are implemented.
- Three-step onboarding, fixed costs, subscriptions, projects, one-time expenses, CSV import/export, subscription review, runway, and share cards are implemented.
- Stripe sync imports balance transactions with a restricted key.
- App Store Connect stores an encrypted API key and validates its JWT signing shape. Report parsing/sync remains intentionally unavailable and returns a clear error instead of pretending to import data.
- This version supports English, Traditional Chinese, and Simplified Chinese.

## Before Launch

- Review the privacy notice and tax disclaimer for the operating jurisdiction.
- Replace the pre-launch legal drafts with reviewed copies.
- Add analytics only after confirming no income or tax data is collected.
- Configure an App Store Connect report parser against real credentials or a sandbox before advertising App Store sync as available.

## Localization

- Source language: English (`en`)
- Locale routes are `en`, `zh-TW` (Traditional Chinese for Taiwan), and `zh-CN` (Simplified Chinese).
- The matching HTML language tags are `en`, `zh-Hant-TW`, and `zh-Hans-CN`. English is the `x-default` alternate.
- The page URL determines the language. The switch keeps the current route and section, and warns visitors before discarding unsaved calculations.
