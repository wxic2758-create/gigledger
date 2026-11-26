# GigLedger Launch Inputs

These items cannot be safely invented by Codex. They block replacing the pre-launch Privacy draft and adding final Terms, but they do not block continued product testing while the pages remain visibly marked as drafts.

## Legal Operator

- Legal entity or individual operator name:
- Business address or registered address:
- Governing jurisdiction:
- Privacy contact email:
- Support contact email:
- Effective date for Privacy and Terms:

## Data Handling

- Retention period for active accounts:
- Retention period after account deletion (if any backup window exists):
- Approved backup and disaster-recovery statement:
- Whether account deletion has a cooling-off period (current product behavior is immediate deletion):
- Whether any analytics, error monitoring, or email provider will be added before launch:

## Processors

- Hosting and database: Cloudflare Pages, Functions, and D1 (already used):
- Authentication: Google identity sign-in (already used):
- Payments provider, if Pro billing is added later:
- Email or support provider, if added later:

## Terms Decisions

- Minimum age and eligibility language:
- Acceptable-use restrictions:
- User content and data ownership language:
- Service availability and limitation-of-liability language:
- Subscription, renewal, cancellation, and refund terms, after pricing is decided:
- Governing law and dispute-resolution language:

## Current Product Behavior To Keep Consistent

- Google is the only sign-in method.
- Account deletion is immediate after confirmation; the dashboard offers JSON export before deletion.
- Unsaved calculator entries remain in page memory only and are lost on refresh or navigation.
- Stripe and App Store Connect credentials are encrypted before storage and are never returned to the browser.
- App Store Connect uses a dedicated Team API key and manual report sync. Sales and fiscal proceeds stay separate. Only a confirmed USD deposit enters received income. Real-account provider reconciliation remains a launch check.
- Pricing remains TBD during private beta.
