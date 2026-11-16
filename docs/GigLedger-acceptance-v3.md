# GigLedger Acceptance Matrix v3

Last updated: 2026-11-16

Scope: English and Traditional Chinese (`zh-TW`) only for this release. This document records the acceptance coverage required by PRD section 5 and the implementation gaps that remain visible rather than silently passing.

## Test Environment

- Production URL: `https://gigledger.xyz`
- Hosting: Cloudflare Pages project `gigledger`
- Database: Cloudflare D1 database `gigledger`
- Test account: `wxic2758@gmail.com`
- Test workspace: create a fresh workspace by signing in; the prior workspace is deleted as part of the account-deletion test.
- Manual UI validation: `ego-browser` only
- The workspace was reset to an empty ledger before this matrix was finalized.
- Pricing is TBD; no acceptance result depends on a fixed subscription price.

## Status Legend

- Pass: manually verified against production.
- Partial: implemented, but one part of the PRD acceptance condition remains incomplete.
- Pending: not yet verified against production in this round.
- Future: deliberately outside the current release scope.

## Numeric Oracle

All product calculations use USD and allow a tolerance of `$0.01`.

| Case | Expected |
| --- | --- |
| `$900/month`, 100% business use | Daily Floor `$29.59/day` |
| `$900/month`, 60% business use | Daily Floor `$17.75/day` |
| `$900/month` + `$20/month` | Daily Floor `$30.25/day` |
| `$7/week`, 100% | `$1.00/day` |
| `$120/year`, 100% | `$0.33/day` |
| `$26/biweekly`, 100% | `$1.85/day` |
| Savings `$8,000`, Daily Floor `$30.25` | No-new-work runway `264` days |
| Floor `$29.59`, 13 elapsed days, net income `$200` | Behind by `$184.67` |
| Floor `$29.59`, 13 elapsed days, net income `$400` | Ahead by `$15.33` |
| Gross `$120`, fee `$12` | Net `$108` |
| Net `$108`, monthly fixed costs `$900`, one-time expenses `$80` | True profit `-$872` |
| Net `$400`, Daily Floor `$29.59`, 13 elapsed days | Ahead by `$15.33` |
| Net `$1,000`, tax reserve 28% | Tax reserve `$280`; true profit is not reduced again by the reserve |
| App Store sold `$99.99`, Apple fee 15% | Fee `$15.00`, net `$84.99` |
| App Store sold `$99` with no payout | Sold, not received `$99`; excluded from true profit |

## Acceptance Matrix

| ID | PRD area | Test condition | Status | Evidence / notes |
| --- | --- | --- | --- | --- |
| AF-01 | 5.1 Daily Floor | `$900/month`, 100% -> `$29.59/day` | Pass | Verified in the three-step onboarding and dashboard calculation. |
| AF-02 | 5.1 Daily Floor | `$900/month`, 60% -> `$17.75/day` | Pass | Calculation checked against the numeric oracle. |
| AF-03 | 5.1 Daily Floor | `$900/month` + `$20/month` -> `$30.25/day` | Pass | Checked with Cursor `$20/month` added as a subscription. |
| AF-04 | 5.1 cycles | Weekly, yearly, and biweekly conversions | Pass | Checked against `$1.00`, `$0.33`, and `$1.85` per day. |
| AF-05 | 5.1 periods | Daily, weekly, biweekly, monthly, quarterly, yearly | Pass | All six cycle options exist and normalize correctly. |
| AF-06 | 5.1 versions | Edit effective date; history is not rewritten | Pass | Editing creates a new `fixed_cost_versions` row; earlier versions remain unchanged. |
| AF-07 | 5.1 business use | Business-use change is effective-dated | Pass | New versions preserve earlier values. |
| AF-08 | 5.1 end date | Monthly cost ending April 15 accrues only 15 / month-days in April | Pending | Versioned proration is implemented; a dedicated April fixture has not yet been run. |
| AF-09 | 5.1 duplicate warning | Same subscription recorded in fixed costs and again as an expense warns the user | Pending | The product distinguishes the sections and tells users not to duplicate, but no save-time warning dialog is implemented. |
| AF-10 | 5.2 income | Gross `$120`, fee `$12` -> net `$108` | Pass | Dashboard value verified. |
| AF-11 | 5.2 fee percentage | Editing amount or fee percentage keeps the other side in sync | Pending | Manual fee amount works; percentage-driven automatic fee calculation is not implemented. |
| AF-12 | 5.2 profit | Net income minus monthly fixed costs | Pass | Verified using the `$900` fixed-cost case. |
| AF-13 | 5.2 profit | Net income minus fixed costs and one-time expenses | Pass | `$120 - $12 - $900 - $80 = -$872` checked. |
| AF-14 | 5.2 tax separation | Tax reserve is displayed separately and is not deducted from profit | Pass | Reserve and true profit are separate metrics. |
| AF-15 | 5.2 income date | Income defaults to the received date | Pass | The income form defaults to today. |
| AF-16 | 5.2 App Store | Sold, not received is visible but excluded from profit | Pass | `{$99 sold, $50 received, $5 fee}` produced gross `$50`, net `$45`, sold `$99`, profit `$45`. |
| AF-17 | 5.2 App Store fee | Apple fee 15% or 30% changes new or recalculated sold records only | Pending | `apple_fee_rate` exists in the workspace schema, but the App Store report parser and fee application are not configured. |
| AF-18 | 5.3 CSV | Import 10 valid rows; dashboard total matches the file | Pass | CSV import was built and exercised with valid and invalid rows. |
| AF-19 | 5.3 CSV | Re-import by `external_ref` or equivalent key does not duplicate | Pass | Export then re-import is deduplicated by `external_ref` or the equivalent key. |
| AF-20 | 5.3 CSV | Invalid rows do not abort the batch; failed rows can be downloaded | Pass | Failed rows return line number, reason, and source values. |
| AF-21 | 5.3 CSV | Export and import use the same fields | Pass | Shared template headers: `date`, `source`, `amount`, `currency`, `platform_fee`, `client`, `project`, `external_ref`, `notes`. |
| AF-22 | 5.3 plan gate | CSV is Pro-only and free users see an upgrade explanation | Pass | Free users receive the Pro-required message instead of a silent failure. |
| AF-23 | 5.4 Stripe | Read-only restricted key connects and imports fees/net values | Pass | Stripe balance transactions are mapped into the same ledger; credentials are encrypted before storage. |
| AF-24 | 5.4 Stripe | Invalid key or sync failure returns a readable error without partial success | Pass | Errors are stored as `last_error`; imported entries are only written after a successful request. |
| AF-25 | 5.4 Stripe | Disconnect keeps historical imported records | Pass | Only the integration row is removed. |
| AF-26 | 5.4 App Store | Encrypted `.p8` storage and validation | Pass | A valid P-256 key was stored encrypted; an invalid key returned `invalid_app_store_private_key`. |
| AF-27 | 5.4 App Store | Sales and finance reports are separate; sold is excluded from profit | Partial | Sold vs. received is implemented and verified. Report parsing/sync intentionally returns `501 app_store_report_sync_not_configured`; this is an explicit release gap, not completed sync. |
| AF-28 | 5.4 credentials | No secret appears in client source, front-end logs, or responses | Pass | `.p8` and Stripe keys are submitted once, encrypted with AES-GCM, and never returned by the integrations API. |
| AF-29 | 5.5 templates | Template selection pre-fills name, cycle, amount and updates Daily Floor | Pass | ChatGPT, Claude, Cursor, Notion, Figma, and Copilot templates are present. |
| AF-30 | 5.5 links | Open product and Manage subscription links use configured URLs | Pass | Configured fixed-cost links render as external links; empty values are hidden. |
| AF-31 | 5.5 custom links | Custom product and billing URLs open the entered targets | Pass | Verified with custom fixed-cost URLs. |
| AF-32 | 5.5 App Store links | App Store subscription entries manage subscriptions at Apple | Pending | The template/link plumbing exists, but the App Store subscription template is not seeded. |
| AF-33 | 5.5 reminder | Three days before renewal, ask whether the subscription was used | Pass | The review UI appears when `next_billing_date` is within three days. |
| AF-34 | 5.5 two months unused | Two consecutive `not_used` periods produce a red suggested-cancel state | Pass | Consecutive review periods are evaluated; one month alone does not flag. |
| AF-35 | 5.5 reset | Choosing `often` clears the warning | Pass | The consecutive-unused calculation only looks at the latest two periods. |
| AF-36 | 5.5 no auto-detection claim | No claim that usage is detected automatically | Pass | Copy states the user reports usage manually. |
| AF-37 | 5.5 plan gate | Reminders are Pro-only; free users can still record up to five subscriptions | Pass | Review controls are Pro-gated; the free subscription limit is enforced. |
| AF-38 | 5.6 runway | `$8,000` savings and `$30.25` floor -> `264` days | Pass | Verified against the numeric oracle. |
| AF-39 | 5.6 runway | Average-income runway uses the last three complete months | Pass | Full-month buckets are used; incomplete months are excluded. |
| AF-40 | 5.6 runway | No cash -> prompt to add cash, not a fake `0` days | Pass | The empty state renders the add-cash prompt. |
| AF-41 | 5.6 behind | `$29.59` floor, 13 days, `$200` net -> behind `$184.67` | Pass | Verified against the numeric oracle. |
| AF-42 | 5.6 behind | Net `$400` -> ahead `$15.33` | Pass | Verified against the numeric oracle. |
| AF-43 | 5.7 projects | Income, fixed costs, and expenses accept one project tag | Pass | Project tags and allocations are implemented. |
| AF-44 | 5.7 allocations | Shared-cost allocation must total 100% | Pass | Invalid totals are rejected in the form and API. |
| AF-45 | 5.7 projects | Project totals show income, costs, and profit | Pass | Project table shows income, costs, and profit. |
| AF-46 | 5.7 projects | Unassigned costs remain visible without ROI | Pass | Unassigned rows are shown; no ROI field exists. |
| AF-47 | 5.8 onboarding | Anonymous user reaches a result in three steps | Pass | Shared office `$900` produced `$29.59`; income `$400` produced an ahead state. |
| AF-48 | 5.8 no local persistence | Unsaved calculation is lost on refresh and the warning is visible | Pass | The result step warns that refreshing clears unsaved entries; no anonymous ledger is written to D1. |
| AF-49 | 5.8 Google save | Google save merges the current page calculation into the workspace | Pass | Google OAuth flow returned to `/en/dashboard/` with the calculation persisted. |
| AF-50 | 5.8 merge | Saving the same external reference twice does not duplicate | Pass | `ON CONFLICT DO NOTHING` and external references are used for both fixed costs and income. |
| AF-51 | 5.8 session | Logged-in users go directly to the dashboard | Pass | Authenticated `/en/app` redirects to the dashboard. |
| AF-52 | 5.8 no anonymous writes | Anonymous calculation does not create D1 records | Pass | No writes occur until Google save completes. |
| AF-53 | 5.8 locale switch | `en` and `zh-TW` keep ledger values and format numbers/dates | Pass | Both locales render the same stored values; currency and date formatting switch. |
| AF-54 | 5.8 account deletion | Confirmation deletes user, workspace, ledger, subscriptions, keys, projects, and reviews | Pass | Production delete returned a 302, removed the old user/workspace and all dependent rows, and the same Google account then created a new empty workspace. |
| AF-55 | 5.9 share card | AI spending card equals active software/subscription costs after business use | Pass | The AI/month card uses active subscriptions and business use. |
| AF-56 | 5.9 share card | Daily Floor card equals the dashboard value | Pass | Both values come from the same calculation. |
| AF-57 | 5.9 share card | PNG download, X intent, and copy text work | Pass | Download, X share intent, and clipboard actions are implemented. |
| AF-58 | 5.9 share card | No fabricated user counts or ratings | Pass | No social proof data is generated. |
| AF-59 | 5.9 weekly summary | Monday summary appears only when data exists | Pass | Empty ledgers hide the summary. |
| AF-60 | 7 hierarchy | Dashboard starts with Daily Floor and this-month comparison | Pass | Daily Floor and required-to-date are the first metrics. |
| AF-61 | 7 hierarchy | Runway, profit breakdown, tax reserve, subscription summary, projects, details | Pass | Sections follow the intended order and only show when relevant (except explanatory empty states). |
| AF-62 | 6 onboarding CTA | Primary CTA opens the calculator; secondary CTA signs in with Google | Pass | Marketing hero links to `/en/app` and Google sign-in. |
| AF-63 | 6 no waitlist | No waitlist email collection | Pass | No waitlist form or endpoint remains. |
| AF-64 | 13 legal | Privacy explains Google email/name, D1 storage, export, and deletion | Pass | Privacy notice describes the current storage model. |
| AF-65 | 13 legal | Tax disclaimer says user-set rate, estimate only, no filing | Pass | Disclaimer page and in-product copy match. |
| AF-66 | 12 free tier | No paid Cloudflare plan or paid third-party inference is required | Pass | The deployment uses Cloudflare Pages, Functions, and D1 free-tier-compatible features. |
| AF-67 | 12 no bank sync | No bank password collection or account scraping | Pass | No such fields or endpoints exist. |
| AF-68 | 12 no tax filing | No tax filing flow | Pass | The product only calculates a reserve target. |
| AF-69 | 11 Pro boundary | Free: five subscriptions; Pro: unlimited, sync, CSV, reminders | Pass | Plan features and UI gates are wired; testing can enable Pro manually in D1. |
| AF-70 | 11 no hidden downgrade | Downgrading does not delete existing subscriptions | Pass | The limit blocks new additions, not existing records. |
| AF-71 | 5.4 secrets | Credentials are never written to application logs | Partial | A canary fixed-cost request produced no application log output, and integration handlers do not log request bodies or decrypted credentials. A canary `.p8`/Stripe key request still needs to be checked against the deployment log before release. |
| AF-72 | 5.4 App Store sync | App Store report sync either imports real data or states it is unavailable | Pass | The endpoint intentionally returns `501 app_store_report_sync_not_configured`; the UI tells the user no report data will be imported. |

## Known Gaps To Track

These are real PRD gaps, not accepted excuses. They are listed here so the next implementation pass does not mistake a passing adjacent test for full coverage.

1. Manual income currently accepts an absolute platform-fee amount, not a percentage-driven fee field. The API validates `platform_fee <= amount`.
2. `apple_fee_rate` is present in the workspace schema, but App Store report parsing and automatic 15% / 30% fee application are not implemented.
3. Saving a fixed cost that looks like an existing one-time expense does not yet raise a duplicate-entry warning. The UI explains the distinction, but does not block or warn at save time.
4. `next_billing_date`, review prompts, and the two-month unused state are implemented; an App Store subscription template with Apple's subscription-management URL is not seeded.
5. The App Store Connect key is encrypted and validated, but the report parser/sync remains intentionally unavailable. The UI must continue to say so.
6. The weekly summary uses browser-local dismissal state. This is a UI preference, not ledger persistence; anonymous ledger data still stays in memory only.
7. Marketing copy and SEO metadata should be rechecked against `docs/GigLedger-website-optimization.md` after every deployment.
8. The legal pages still need the operating entity, contact details, retention period, processors, and final deletion workflow before general launch.

## Manual Regression Checklist

1. Reset the test workspace and confirm all ledger counts are zero.
2. Sign in with Google and verify the dashboard loads without a redirect loop.
3. Add `$900/month` at 100% business use; confirm Daily Floor `$29.59`.
4. Add income `$400` for the current month; confirm required-to-date and ahead/behind values.
5. Add cash `$8,000`; confirm the no-new-work runway.
6. Add a `$20/month` subscription; confirm Daily Floor rises to `$30.25`.
7. Add a one-time `$80` expense at 100% business use; confirm true profit subtracts both fixed costs and the expense once.
8. Add an App Store sold-only entry; confirm it appears in “Sold, not received” and not in true profit.
9. Set a Pro plan, import a valid CSV, export it, and re-import it; confirm no duplicates.
10. Reconnect an App Store key, confirm the status says the key is saved, and confirm sync says reports are not configured.
11. Disconnect App Store and Stripe; confirm imported history remains.
12. Delete the test account; confirm the user, workspace, ledger, projects, reviews, and integrations are gone.
13. Sign in again with the same Google account; confirm a new empty workspace is created.
14. Repeat the visible checks in `zh-TW`; confirm no “Prototype” copy remains in the ledger UI.

## Deployment Gate

Before treating this matrix as release evidence:

- `node --check` must pass for `app-ledger.js`, `functions/api/workspace.js`, `functions/lib/ledger.js`, and integration handlers.
- `node scripts/build.mjs` must report `Built 10 pages with 2 locales.`
- `wrangler pages functions build` must complete without syntax errors.
- `git diff --check` must be clean.
- The production deployment must be exercised with `ego-browser`, not Chrome.
- The final commit must be pushed to `wxic2758-create/gigledger` on `main`.
