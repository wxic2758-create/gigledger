# GigLedger Landing Page

English + Traditional Chinese (`zh-TW`) pre-launch site for `gigledger.xyz`.

## Structure

```text
assets/          Local brand assets and social share image
en/              Generated English pages
zh-TW/           Generated Traditional Chinese pages
en/app/          Generated interactive calculator prototype
zh-TW/app/       Generated Traditional Chinese calculator prototype
i18n/            Source copy for both locales
scripts/build.mjs
styles.css
proto.css        Interactive prototype styles
app-proto.js     Client-side prototype calculations
app.js
_redirects       Cloudflare Pages redirects for legacy `.html` app URLs
```

Generated HTML files should not be edited by hand. Change `i18n/*.json`, `scripts/build.mjs`, `styles.css`, or `app.js`, then rebuild.

## Build

Requires Node.js 18 or newer.

```bash
node scripts/build.mjs
```

## Preview

```bash
python3 -m http.server 4174
```

Open:

- `http://localhost:4174/en/`
- `http://localhost:4174/zh-TW/`
- `http://localhost:4174/en/app/`
- `http://localhost:4174/zh-TW/app/`

## Deploy

This is a static site. Upload the contents of this folder to Cloudflare Pages, Netlify, Vercel, or any static host.

- Build command: `node scripts/build.mjs`
- Output directory: `.` (this folder)
- Domain: `gigledger.xyz`

## Before Launch

- The `/app` pages are an interactive prototype. They calculate in memory only and do not persist data.
- Replace the preview-only waitlist form with a real endpoint. The current form does not send or store emails.
- Review the privacy notice and tax disclaimer for the operating jurisdiction.
- Replace the pre-launch legal drafts with reviewed copies.
- Keep the 36-language architecture in mind, but only publish `en` and `zh-TW` in this version.
- Add analytics only after confirming no income or tax data is collected.

## Localization

- Source language: English (`en`)
- Traditional Chinese: `zh-TW`, using Taiwan terminology and Traditional Chinese characters.
- Page language attribute: `lang="zh-Hant-TW"`.
- Generated alternates: `hreflang="en"`, `hreflang="zh-Hant-TW"`, and `x-default`.
- The language switch is manual. It does not overwrite user data, currency, or saved records.
