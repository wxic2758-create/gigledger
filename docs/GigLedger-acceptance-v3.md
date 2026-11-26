# GigLedger Acceptance Matrix v3

Last updated: 2026-11-26

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
- Fixture: verified against an isolated workspace with the real request handlers and SQLite schema.
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
| AF-08 | 5.1 end date | Monthly cost ending April 15 accrues only 15 / month-days in April | Pass | With the browser clock set to April 15, a `$100/month` cost ending April 15 produced `$50.00` monthly fixed cost and `$3.29/day`; a May 1 fixture produced `$0.00`. |
| AF-09 | 5.1 duplicate warning | Same subscription recorded in fixed costs and again as an expense warns the user | Pass | Ego-browser verified the same-name, same-amount, same-month expense triggers a bilingual warning; Cancel leaves the ledger unchanged and Confirm saves the expense. |
| AF-10 | 5.2 income | Gross `$120`, fee `$12` -> net `$108` | Pass | Dashboard value verified. |
| AF-11 | 5.2 fee percentage | Editing amount or fee percentage keeps the other side in sync | Pass | Ego-browser verified `$120 × 10% = $12.00` and edited the fee back to `$15.00`, which recalculated to `12.50%`; the most recently edited side wins. |
| AF-12 | 5.2 profit | Net income minus monthly fixed costs | Pass | Verified using the `$900` fixed-cost case. |
| AF-13 | 5.2 profit | Net income minus fixed costs and one-time expenses | Pass | `$120 - $12 - $900 - $80 = -$872` checked. |
| AF-14 | 5.2 tax separation | Tax reserve is displayed separately and is not deducted from profit | Pass | Reserve and true profit are separate metrics. |
| AF-15 | 5.2 income date | Income defaults to the received date | Pass | The income form defaults to today. |
| AF-16 | 5.2 App Store | Sold, not received is visible but excluded from profit | Pass | `{$99 sold, $50 received, $5 fee}` produced gross `$50`, net `$45`, sold `$99`, profit `$45`. |
| AF-17 | 5.2 App Store fee | Apple fee 15% or 30% changes new or recalculated sold records only | Pass | The dashboard settings persist `apple_fee_rate`. `$99.99` sold entries were stored with `$15.00` at 15% and `$30.00` at 30%; a received `$50 / $5 fee` entry kept its `$5.00` fee after the rate changed. |
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
| AF-32 | 5.5 App Store links | App Store subscription entries manage subscriptions at Apple | Pass | The bilingual App Store template now carries the official `apps.apple.com/account/subscriptions` management URL; ego-browser verified both Open and Manage links in en and zh-TW. |
| AF-33 | 5.5 reminder | Three days before renewal, ask whether the subscription was used | Pass | Ego-browser verified a `2026-11-18` renewal on `2026-11-16`: the row showed “Next charge 2026-11-18: $20.00” and the dashboard summary named the same charge. |
| AF-34 | 5.5 two months unused | Two consecutive `not_used` periods produce a red suggested-cancel state | Pass | With an October `not_used` fixture and a November `not_used` UI submission, the row showed “Suggested cancel” and the dashboard showed “1 subscription(s) marked not used for two months”. |
| AF-35 | 5.5 reset | Choosing `often` clears the warning | Pass | Choosing “Often” in the UI removed the red badge immediately, marked “Often” active, and changed the dashboard summary back to “Nothing needs attention”. |
| AF-36 | 5.5 no auto-detection claim | No claim that usage is detected automatically | Pass | Copy states the user reports usage manually. |
| AF-37 | 5.5 plan gate | Reminders are Pro-only; free users can still record up to five subscriptions | Pass | On the free plan, the subscription row and links stayed visible, but all three review controls were disabled with the Pro explanation and the review API returned `403 pro_required`. |
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
| AF-55 | 5.9 share card | AI spending card equals active software/subscription costs after business use | Pass | Fixed costs now carry an explicit AI/software flag. With `$20` AI/software plus `$900` non-software subscription, the share card showed `$20.00` while fixed costs stayed `$920.00`; the form defaults new subscriptions to software and lets users opt out. |
| AF-56 | 5.9 share card | Daily Floor card equals the dashboard value | Pass | With a `$20` AI subscription and `$900` rent, the share card showed `$30.25/day`, matching the dashboard. |
| AF-57 | 5.9 share card | PNG download, X intent, and copy text work | Pass | Ego-browser produced a `image/png` blob and the copy action returned “My monthly AI spending is $20.00.” The X intent uses the same calculated amount. |
| AF-58 | 5.9 share card | No fabricated user counts or ratings | Pass | No social proof data is generated. |
| AF-59 | 5.9 weekly summary | Monday summary appears only when data exists | Pass | Empty ledgers hide the summary. With `$1,240` last-week net income, a `$30.25` Daily Floor, and `$20` AI software, the summary read “Last week net income $1,240.00; that covers 40 days at your Daily Floor. AI/software is 2% of monthly fixed costs.” |
| AF-60 | 7 hierarchy | Dashboard starts with Daily Floor and this-month comparison | Pass | Ego-browser on an isolated fixture verified three overview cards: Daily Floor, period profit, and conservative cash runway. No horizontal overflow at 320 px and 390 px. To-date comparison sits below the profit chart. |
| AF-61 | 7 hierarchy | Runway, profit breakdown, tax reserve, subscription summary, projects, details | Pass | Overview has a labeled profit chart, with tax and sharing in collapsible sections. The Ledger and Settings views have independent navigation. Cash runway and Daily Floor retain their current values when prior-month profit is selected. |
| AF-62 | 6 onboarding CTA | Primary CTA opens the calculator; secondary CTA signs in with Google | Pass | Marketing hero links to `/en/app` and Google sign-in. |
| AF-63 | 6 no waitlist | No waitlist email collection | Pass | No waitlist form or endpoint remains. |
| AF-64 | 13 legal | Privacy explains Google account data, D1 storage, integration credentials, export, and deletion | Pass | Privacy notice lists Google email/name, account identifier, optional avatar URL, short-lived OAuth draft, encrypted Stripe/App Store credentials, and the account-deletion scope. |
| AF-65 | 13 legal | Tax disclaimer says user-set rate, estimate only, no filing | Pass | Disclaimer page and in-product copy match. |
| AF-66 | 12 free tier | No paid Cloudflare plan or paid third-party inference is required | Pass | The deployment uses Cloudflare Pages, Functions, and D1 free-tier-compatible features. |
| AF-67 | 12 no bank sync | No bank password collection or account scraping | Pass | No such fields or endpoints exist. |
| AF-68 | 12 no tax filing | No tax filing flow | Pass | The product only calculates a reserve target. |
| AF-69 | 11 Pro boundary | Free: five subscriptions; Pro: unlimited, sync, CSV, reminders | Pass | On free, the dashboard showed the pricing-TBD boundary; five subscriptions saved, the sixth returned `403 subscription_limit`, and CSV/review/Stripe controls stayed locked. Switching to Pro hid the upgrade note, unlocked CSV/review/Stripe, and kept the five subscriptions. |
| AF-70 | 11 no hidden downgrade | Downgrading does not delete existing subscriptions | Pass | Downgrading from Pro to free preserved all five existing subscriptions; the limit only blocked new additions. |
| AF-71 | 5.4 secrets | Credentials are never written to application logs | Partial | Production canary requests used a randomly generated string as both a fake Stripe key and the body of a fake `.p8`; both returned `400`, no canary plaintext appeared in the `integrations` table, and no application source logs request bodies or decrypted credentials. D1 was restored to its pre-canary Time Travel bookmark and the existing test integration row was confirmed unchanged. Deployment log capture could not be completed: Wrangler `pages deployment tail` failed with `ECONNRESET` / direct `ECONNREFUSED`, while the Cloudflare REST tail session opened but its WebSocket never established. This remains Partial until the deployment log is checked from a network or Cloudflare dashboard that can hold the tail connection. |
| AF-72 | 5.4 App Store sync | App Store report sync either imports real data or states it is unavailable | Pass | The endpoint intentionally returns `501 app_store_report_sync_not_configured`; the UI tells the user no report data will be imported. |
| AF-73 | 13 marketing | Website has AI subscription review, cash runway, sync Coming soon, sample share card, and Free/Pro blocks | Pass | The public homepage retains its illustrated preview and explanatory sections. The product, pricing, and FAQ pages are also available in both locales. Pricing remains TBD. |
| AF-74 | 13 marketing | No ambiguous monthly-view reports copy; all CTAs are locale-aware | Pass | The site describes income CSV export. Pricing CTAs link to the localized calculator and Google sign-in. |
| AF-75 | 2.1 expenses | A one-time expense can be corrected in the existing form without creating another row | Fixture | Ego at 320 px verified the expense Edit action without table scrolling. An expense changed from $240 at 100% to $300 at 50%, persisted after reload, moved profit from $1,400 to $1,490, and left Daily Floor at $11.84. The API test checks ownership, validation, a retry, and clearing optional fields. Traditional Chinese guest editing was also exercised. |
| AF-76 | 5.3 CSV | Export a selected month of received income, with an all-time option | Fixture | Ego downloaded the previous month's CSV, which contained one matching payment. The API test covers month boundaries, empty months and exclusion of sold-only entries. The existing export/reimport deduplication check remains in place. |
| AF-77 | 7 compact workspace | Phone trial buttons and the profit chart are visible in the first viewport | Fixture | Ego at 390 × 844 CSS px found the trial's Next and Save buttons in the first viewport and the profit chart above the fold. The public landing pages are byte-identical to the prior release. |
| AF-78 | 5.5 templates | The calculator and fixed-cost form use the complete catalog, including generic renewals | Fixture | Both locales load 18 templates from one catalog. Ego verified the Traditional Chinese calculator initially shows three and blocks a selected template with a blank amount. An annual USD 120 domain renewal produced a $0.33 Daily Floor. The English fixed-cost form saved a Cursor template with product and billing links that open in new tabs. Public endpoints and vendor instructions were checked; access inside vendor accounts was not exercised. [Cursor billing](https://cursor.com/help/account-and-billing/billing), [Midjourney billing](https://docs.midjourney.com/hc/en-us/articles/28014179406861-Managing-Your-Subscription), [Perplexity billing](https://www.perplexity.ai/help-center/en/articles/10354283-canceling-a-subscription). |
| AF-79 | 5.5 billing dates | Active subscriptions roll over without losing their original billing day | Fixture | Tests cover Jan 31 → Feb 28/29 → Mar 31, quarterly and yearly month ends, multiple missed periods, and the end date. With Shanghai set three days before Feb 29, Ego followed the dashboard task to the correct subscription, saved an answer, saw the unused badge, corrected the answer, and confirmed that it persisted after reload. The API verifies ownership, Pro access, the requested period and local-day boundaries. |

## Known Gaps To Track

These are real PRD gaps, not accepted excuses. They are listed here so the next implementation pass does not mistake a passing adjacent test for full coverage.

1. The App Store Connect key is encrypted and validated, but the report parser/sync remains intentionally unavailable. The UI must continue to say so.
2. The weekly summary uses browser-local dismissal state. This is a UI preference, not ledger persistence; anonymous ledger data still stays in memory only.
3. Marketing copy and SEO metadata should be rechecked against `docs/GigLedger-website-optimization.md` after every deployment.
4. The legal pages still need the operating entity, contact details, retention period, processors, and final deletion workflow before general launch. Product data categories and deletion behavior are already disclosed from the implemented schema.
5. AF-71 deployment-log capture is blocked by the local network path to Cloudflare tailing. The code-level audit and production canary behavior are recorded above, but release sign-off still requires a tail session from a working network or the Cloudflare dashboard.
6. See PRD §15 for the remaining fixed-point monetary arithmetic, workspace time zone, and non-USD acceptance gaps. The two-week personal trial and closed-beta recruitment have no completion record here.

## Manual Regression Checklist

1. Reset the test workspace and confirm all ledger counts are zero.
2. Sign in with Google and verify the dashboard loads without a redirect loop.
3. Add `$900/month` at 100% business use; confirm Daily Floor `$29.59`.
4. Add income `$400` for the current month; confirm required-to-date and ahead/behind values.
5. Add cash `$8,000`; confirm the no-new-work runway.
6. Add a `$20/month` subscription; confirm Daily Floor rises to `$30.25`.
7. For a `$100/month` cost ending April 15, confirm April monthly fixed cost is `$50.00` and May is `$0.00`.
8. Enter income `$120` and fee `10%`; confirm the fee becomes `$12.00` and net becomes `$108.00`; edit the fee to `$15.00` and confirm the percent updates to `12.50%`.
9. Add a one-time `$80` expense at 100% business use; confirm true profit subtracts both fixed costs and the expense once.
10. Enter an expense matching an active subscription's name, amount, and month; confirm Cancel leaves it out and Confirm allows the save.
11. Add an App Store sold-only entry; confirm it appears in “Sold, not received” and not in true profit.
12. Set a Pro plan, import a valid CSV, export it, and re-import it; confirm no duplicates.
13. Verify App Store report sync is labeled Coming soon and that an existing key can be disconnected.
14. Disconnect App Store and Stripe; confirm imported history remains.
15. Select the App Store subscription template; confirm Open and Manage link to Apple's pages.
16. Set Apple fee to 15%, add a `$99.99` sold App Store entry, and confirm `$15.00` fee / `$84.99` net; switch to 30% and confirm a new sold entry uses `$30.00` while the old entry and received entries keep their original fees.
17. Delete the test account; confirm the user, workspace, ledger, projects, reviews, and integrations are gone.
18. Sign in again with the same Google account; confirm a new empty workspace is created.
19. Repeat the visible checks in `zh-TW`; confirm no “Prototype” copy remains in the ledger UI.

## Deployment Gate

Before treating this matrix as release evidence:

- `node --check` must pass for `app-ledger.js`, `functions/api/workspace.js`, `functions/lib/ledger.js`, and integration handlers.
- `node scripts/build.mjs` must report `Built 16 pages with 2 locales.`
- `wrangler pages functions build` must complete without syntax errors.
- `git diff --check` must be clean.
- The production deployment must be exercised with `ego-browser`, not Chrome.
- The final commit must be pushed to `wxic2758-create/gigledger` on `main`.
