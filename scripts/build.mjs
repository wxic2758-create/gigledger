import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = "https://gigledger.xyz";

const locales = [
  { code: "en", folder: "en", htmlLang: "en", dir: "ltr", other: "zh-TW" },
  { code: "zh-TW", folder: "zh-TW", htmlLang: "zh-Hant-TW", dir: "ltr", other: "en" },
];

const messages = {};
for (const locale of locales) {
  messages[locale.code] = JSON.parse(
    await readFile(join(root, "i18n", `${locale.code}.json`), "utf8"),
  );
}

const esc = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const icon = (name) => {
  const paths = {
    income:
      '<path d="M5 19V9m7 10V5m7 14v-7"/><path d="M3 21h18"/>',
    calendar:
      '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4m8-4v4"/><path d="M8 14h2m3 0h2m-7 3h2m3 0h2"/>',
    tax:
      '<path d="M12 3v18M7 8h7a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h9"/>',
    report:
      '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    shield:
      '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.shield}</svg>`;
};

const logo = (locale) => `
  <a class="brand" href="${locale === "en" ? "/en/" : "/zh-TW/"}">
    <img class="brand-mark" src="/assets/logo-mark-192.png" alt="" width="42" height="42">
    <span class="brand-word"><b>Gig</b>Ledger</span>
  </a>`;

const languageSwitch = (t, current, suffix = "") => {
  const next = locales.find((l) => l.code !== current.code);
  return `
    <a class="lang-switch" href="/${next.folder}/${suffix}" hreflang="${next.htmlLang}" lang="${next.htmlLang}">
      <span class="lang-full">${esc(t.nav.switchTo)}</span>
      <span class="lang-short">${esc(t.nav.switchShort)}</span>
    </a>`;
};

const nav = (t, current) => `
  <header class="site-header">
    <div class="shell header-inner">
      ${logo(current.folder)}
      <nav class="desktop-nav" aria-label="${esc(t.nav.aria)}">
        <a href="#daily">${esc(t.nav.why)}</a>
        <a href="#how">${esc(t.nav.how)}</a>
        <a href="#faq">${esc(t.nav.faq)}</a>
      </nav>
      <div class="header-actions">
        ${languageSwitch(t, current)}
        <a class="button button-small button-orange" href="#waitlist">${esc(t.nav.cta)}</a>
        <button class="menu-button" type="button" aria-expanded="false" aria-controls="mobileNav" aria-label="${esc(t.nav.menuOpen)}">
          <span></span><span></span>
        </button>
      </div>
    </div>
    <nav class="mobile-nav" id="mobileNav" aria-label="${esc(t.nav.aria)}">
      <a href="#daily">${esc(t.nav.why)}</a>
      <a href="#how">${esc(t.nav.how)}</a>
      <a href="#faq">${esc(t.nav.faq)}</a>
      <a href="#waitlist">${esc(t.nav.cta)}</a>
      ${languageSwitch(t, current)}
    </nav>
  </header>`;

const dashboard = (t) => `
  <div class="dashboard" role="img" aria-label="${esc(t.hero.visualAria)}">
    <div class="dash-head">
      <div class="dash-brand">
        <img src="/assets/logo-mark-64.png" alt="" width="24" height="24">
        <span>gigledger</span>
      </div>
      <span class="sample-badge">${esc(t.hero.sampleLabel)}</span>
    </div>
    <div class="dash-month">${esc(t.dashboard.month)}</div>
    <div class="dash-rows">
      ${t.dashboard.rows
        .map(
          (row) => `
        <div class="dash-row tone-${row.tone}">
          <span>${esc(row.label)}</span>
          <strong>${esc(row.value)}</strong>
        </div>`,
        )
        .join("")}
    </div>
    <div class="dash-split">
      <div class="dash-metric">
        <span>${esc(t.dashboard.dailyLabel)}</span>
        <strong>${esc(t.dashboard.dailyValue)}<em>${esc(t.dashboard.dailyUnit)}</em></strong>
      </div>
      <div class="dash-metric">
        <span>${esc(t.dashboard.taxLabel)}</span>
        <strong>${esc(t.dashboard.taxValue)}</strong>
        <small>${esc(t.dashboard.taxNote)}</small>
      </div>
    </div>
    <div class="dash-chart">
      <div class="chart-top">
        <span>${esc(t.dashboard.chartLabel)}</span>
        <span class="chart-key" aria-hidden="true"></span>
      </div>
      <div class="bars">
        ${t.dashboard.chart
          .map(
            (bar) => `
          <div class="bar-wrap">
            <div class="bar" style="--h:${Number(bar.height) || 0}%"></div>
            <span>${esc(bar.month)}</span>
          </div>`,
          )
          .join("")}
      </div>
    </div>
    <div class="dash-note">${esc(t.dashboard.annotation)}</div>
  </div>`;

const hero = (t, current) => `
  <main id="main">
    <section class="hero">
      <div class="shell hero-grid">
        <div class="hero-copy">
          <p class="kicker">${esc(t.hero.kicker)}</p>
          <h1>${esc(t.hero.titleBefore)} <span class="accent-word">${esc(t.hero.titleAccent)}</span></h1>
          <p class="hero-sub">${esc(t.hero.sub)}</p>
          <div class="hero-actions">
            <a class="button button-orange" href="#waitlist">${esc(t.hero.primaryCta)} <span aria-hidden="true">→</span></a>
            <a class="text-link" href="/${current.folder}/app">${esc(t.hero.secondaryCta)} <span aria-hidden="true">→</span></a>
          </div>
          <ul class="trust-list">
            ${t.hero.trust
              .map(
                (item) => `
              <li><span class="check" aria-hidden="true">✓</span>${esc(item)}</li>`,
              )
              .join("")}
          </ul>
        </div>
        <div class="hero-visual">${dashboard(t)}</div>
      </div>
    </section>`;

const dailySection = (t) => `
    <section class="daily-section" id="daily">
      <div class="shell daily-grid">
        <div class="section-copy">
          <div class="section-index"><span>${esc(t.daily.index)}</span><div></div><p>${esc(t.daily.kicker)}</p></div>
          <h2>${esc(t.daily.title)}</h2>
          <p>${esc(t.daily.body)}</p>
          <strong class="aside-note">${esc(t.daily.note)}</strong>
        </div>
        <div class="daily-card">
          <p class="daily-kicker">${esc(t.daily.kicker)}</p>
          <div class="big-number">${esc(t.daily.value)}<span>${esc(t.daily.unit)}</span></div>
          <p class="formula">${esc(t.daily.formula)}</p>
          <div class="daily-list">
            ${t.daily.items
              .map(
                (item) => `
              <div><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`,
              )
              .join("")}
          </div>
        </div>
      </div>
    </section>`;

const featuresSection = (t) => `
    <section class="features-section" id="features">
      <div class="shell">
        <div class="section-head">
          <div>
            <div class="section-index"><span>${esc(t.features.index)}</span><div></div><p>${esc(t.features.kicker)}</p></div>
            <h2>${esc(t.features.title)}</h2>
          </div>
        </div>
        <div class="feature-grid">
          ${t.features.cards
            .map(
              (card) => `
            <article class="feature-card tone-${card.tone}">
              <div class="feature-icon">${icon(card.icon)}</div>
              <p class="feature-tag">${esc(card.tag)}</p>
              <h3>${esc(card.title)}</h3>
              <p>${esc(card.body)}</p>
            </article>`,
            )
            .join("")}
        </div>
      </div>
    </section>`;

const stepsSection = (t) => `
    <section class="steps-section" id="how">
      <div class="shell steps-grid">
        <div class="steps-intro">
          <div class="section-index light"><span>${esc(t.steps.index)}</span><div></div><p>${esc(t.steps.kicker)}</p></div>
          <h2>${esc(t.steps.title)}</h2>
        </div>
        <ol class="steps-list">
          ${t.steps.items
            .map(
              (item) => `
            <li>
              <span class="step-number">${esc(item.number)}</span>
              <div><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></div>
            </li>`,
            )
            .join("")}
        </ol>
      </div>
    </section>`;

const audienceSection = (t) => `
    <section class="audience-section">
      <div class="shell">
        <div class="audience-head">
          <h2>${esc(t.audience.title)}</h2>
          <p>${esc(t.audience.body)}</p>
        </div>
        <div class="audience-grid">
          ${t.audience.items
            .map(
              (item, index) => `
            <article>
              <span class="audience-num">0${index + 1}</span>
              <h3>${esc(item.label)}</h3>
              <p>${esc(item.body)}</p>
            </article>`,
            )
            .join("")}
        </div>
      </div>
    </section>`;

const honestySection = (t) => `
    <section class="honesty-section">
      <div class="shell honesty-grid">
        <div class="honesty-copy">
          <p class="kicker">${esc(t.honesty.kicker)}</p>
          <h2>${esc(t.honesty.title)}</h2>
          <p>${esc(t.honesty.body)}</p>
        </div>
        <div class="honesty-columns">
          <div>
            <h3><span class="check" aria-hidden="true">✓</span>${esc(t.honesty.yesTitle)}</h3>
            <ul>${t.honesty.yes.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>
          </div>
          <div>
            <h3><span class="cross" aria-hidden="true">×</span>${esc(t.honesty.noTitle)}</h3>
            <ul>${t.honesty.no.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>
          </div>
        </div>
      </div>
    </section>`;

const faqSection = (t) => `
    <section class="faq-section" id="faq">
      <div class="shell faq-grid">
        <div class="faq-intro">
          <h2>${esc(t.faq.title)}</h2>
          <p>${esc(t.faq.body)}</p>
        </div>
        <div class="faq-list">
          ${t.faq.items
            .map(
              (item) => `
            <details>
              <summary>${esc(item.q)}<span aria-hidden="true">+</span></summary>
              <p>${esc(item.a)}</p>
            </details>`,
            )
            .join("")}
        </div>
      </div>
    </section>`;

const waitlistSection = (t) => `
    <section class="waitlist-section" id="waitlist">
      <div class="shell waitlist-grid">
        <div>
          <p class="kicker">${esc(t.waitlist.kicker)}</p>
          <h2>${esc(t.waitlist.title)}</h2>
          <p>${esc(t.waitlist.body)}</p>
        </div>
        <div class="waitlist-panel">
          <form class="waitlist-form" data-waitlist
            data-invalid-message="${esc(t.waitlist.error)}"
            data-success-message="${esc(t.waitlist.success)}">
            <label for="email">${esc(t.waitlist.label)}</label>
            <div class="input-row">
              <input id="email" name="email" type="email" autocomplete="email" required placeholder="${esc(t.waitlist.placeholder)}">
              <button class="button button-dark" type="submit">${esc(t.waitlist.button)}</button>
            </div>
            <p class="form-message" role="status" aria-live="polite" data-message></p>
            <p class="form-note">${esc(t.waitlist.note)} · <a href="/${t.locale}/privacy.html">${esc(t.waitlist.privacy)}</a></p>
          </form>
          <p class="preview-note">${esc(t.waitlist.preview)}</p>
        </div>
      </div>
    </section>`;

const footer = (t) => `
  </main>
  <footer class="site-footer">
    <div class="shell footer-top">
      <div>
        ${logo(t.locale)}
        <p class="footer-tagline">${esc(t.footer.tagline)}</p>
        <p class="footer-status">${esc(t.footer.status)}</p>
      </div>
      <div class="footer-links">
        <div>
          <p class="footer-heading">${esc(t.footer.product)}</p>
          <a href="#daily">${esc(t.footer.why)}</a>
          <a href="#how">${esc(t.footer.how)}</a>
          <a href="#faq">${esc(t.footer.faq)}</a>
        </div>
        <div>
          <p class="footer-heading">${esc(t.footer.legal)}</p>
          <a href="/${t.locale}/privacy.html">${esc(t.footer.privacy)}</a>
          <a href="/${t.locale}/tax-disclaimer.html">${esc(t.footer.disclaimer)}</a>
        </div>
      </div>
    </div>
    <div class="shell footer-bottom">
      <p>${esc(t.footer.copyright.replace("{year}", String(new Date().getFullYear())))}</p>
      <a href="/${t.alternatePath}">${esc(t.nav.switchTo)}</a>
    </div>
  </footer>`;

const legalPage = ({ locale, t, type }) => {
  const isPrivacy = type === "privacy";
  const title = isPrivacy ? t.legal.privacyTitle : t.legal.disclaimerTitle;
  const body = isPrivacy ? t.legal.privacyBody : t.legal.disclaimerBody;
  const draft = isPrivacy ? `<p class="legal-draft">${esc(t.legal.privacyDraft)}</p>` : "";
  return `<!doctype html>
<html lang="${locale.htmlLang}" dir="${locale.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — GigLedger</title>
  <meta name="description" content="${esc(isPrivacy ? t.meta.description : t.legal.disclaimerBody[0])}">
  <link rel="icon" href="/assets/favicon-32.png" sizes="32x32">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="site-header">
    <div class="shell header-inner">
      ${logo(locale.folder)}
      <a class="text-link" href="/${locale.folder}/">${esc(t.legal.back)}</a>
    </div>
  </header>
  <main class="legal-main shell">
    <p class="kicker">GigLedger</p>
    <h1>${esc(title)}</h1>
    ${draft}
    ${body.map((p) => `<p>${esc(p)}</p>`).join("")}
    <a class="button button-orange" href="/${locale.folder}/">${esc(t.legal.back)}</a>
  </main>
</body>
</html>`;
};

const thanksPage = ({ locale, t }) => `<!doctype html>
<html lang="${locale.htmlLang}" dir="${locale.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(t.thanks.title)} — GigLedger</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="/assets/favicon-32.png" sizes="32x32">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="thanks-main shell">
    ${logo(locale.folder)}
    <p class="kicker">GigLedger</p>
    <h1>${esc(t.thanks.title)}</h1>
    <p>${esc(t.thanks.body)}</p>
    <a class="button button-orange" href="/${locale.folder}/">${esc(t.thanks.back)}</a>
  </main>
</body>
</html>`;

const appPage = ({ locale, t }) => {
  const option = (value) => `<option value="${value}">${esc(t.app.cycles[value])}</option>`;
  const sourceOption = (value) => `<option value="${value}">${esc(t.app.sources[value])}</option>`;
  return `<!doctype html>
<html lang="${locale.htmlLang}" dir="${locale.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(t.app.title)} — GigLedger</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="/assets/favicon-32.png" sizes="32x32">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/proto.css">
</head>
<body class="app-proto">
  <script type="application/json" id="proto-messages">${JSON.stringify(t.app).replaceAll("</", "<\\/")}</script>
  <header class="site-header">
    <div class="shell header-inner">
      ${logo(locale.folder)}
      <nav class="desktop-nav app-nav" aria-label="${esc(t.app.navAria)}">
        <a href="#dashboard">${esc(t.app.nav.dashboard)}</a>
        <a href="#fixed-costs">${esc(t.app.nav.fixed)}</a>
        <a href="#income">${esc(t.app.nav.income)}</a>
        <a href="#how-it-works">${esc(t.app.nav.how)}</a>
      </nav>
      <div class="header-actions">
        ${languageSwitch(t, locale, "app")}
        <a class="button button-small button-orange" href="/${locale.folder}/">${esc(t.app.back)}</a>
        <button class="menu-button" type="button" aria-expanded="false" aria-controls="mobileNav" aria-label="${esc(t.nav.menuOpen)}">
          <span></span><span></span>
        </button>
      </div>
    </div>
    <nav class="mobile-nav" id="mobileNav" aria-label="${esc(t.app.navAria)}">
      <a href="#dashboard">${esc(t.app.nav.dashboard)}</a>
      <a href="#fixed-costs">${esc(t.app.nav.fixed)}</a>
      <a href="#income">${esc(t.app.nav.income)}</a>
      <a href="#how-it-works">${esc(t.app.nav.how)}</a>
      ${languageSwitch(t, locale, "app")}
    </nav>
  </header>
  <main id="main">
    <section class="app-hero shell" id="dashboard">
      <div class="app-badge">${esc(t.app.badge)}</div>
      <h1>${esc(t.app.heading)}</h1>
      <p>${esc(t.app.subheading)}</p>
      <div class="app-metrics">
        <article><span>${esc(t.app.metrics.daily)}</span><strong data-proto="metric-daily">$0.00</strong><small>${esc(t.app.metrics.dailyNote)}</small></article>
        <article><span>${esc(t.app.metrics.gross)}</span><strong data-proto="metric-gross">$0.00</strong></article>
        <article><span>${esc(t.app.metrics.fees)}</span><strong data-proto="metric-fees">$0.00</strong></article>
        <article><span>${esc(t.app.metrics.net)}</span><strong data-proto="metric-net">$0.00</strong></article>
        <article><span>${esc(t.app.metrics.costs)}</span><strong data-proto="metric-costs">$0.00</strong><small>${esc(t.app.metrics.costsNote)}</small></article>
        <article class="profit-card"><span>${esc(t.app.metrics.profit)}</span><strong data-proto="metric-profit">$0.00</strong><small>${esc(t.app.metrics.profitNote)}</small></article>
        <article><span>${esc(t.app.metrics.tax)}</span><strong data-proto="metric-tax">$0.00</strong><small>${esc(t.app.taxNote)}</small></article>
      </div>
    </section>

    <section class="app-steps shell" id="how-it-works">
      <p class="app-steps-kicker">${esc(t.app.onboarding.kicker)}</p>
      <ol>
        ${t.app.onboarding.steps
          .map(
            (item, index) => `
        <li>
          <span>0${index + 1}</span>
          <div><strong>${esc(item.title)}</strong><p>${esc(item.body)}</p></div>
        </li>`,
          )
          .join("")}
      </ol>
    </section>

    <section class="app-section shell" id="fixed-costs">
      <div class="app-section-head">
        <h2>${esc(t.app.fixed.title)}</h2>
        <p>${esc(t.app.fixed.body)}</p>
      </div>
      <div class="app-grid">
        <form class="app-form" data-proto-form="fixed" novalidate>
          <label><span>${esc(t.app.fields.name)}</span><input name="name" required></label>
          <label><span>${esc(t.app.fields.amount)}</span><input name="amount" type="number" min="0" step="0.01" required></label>
          <label><span>${esc(t.app.fields.cycle)}</span><select name="cycle">${["daily","weekly","biweekly","monthly","quarterly","yearly"].map(option).join("")}</select></label>
          <label><span>${esc(t.app.fields.businessUse)}</span><input name="businessUse" type="number" min="0" max="100" value="100" required></label>
          <button class="button button-dark" type="submit">${esc(t.app.fixed.add)}</button>
        </form>
        <div class="app-table-wrap">
          <table>
            <thead><tr><th>${esc(t.app.table.name)}</th><th>${esc(t.app.table.cycle)}</th><th>${esc(t.app.table.amount)}</th><th>${esc(t.app.table.businessUse)}</th><th>${esc(t.app.table.daily)}</th></tr></thead>
            <tbody data-proto="fixed-cost-rows"></tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="app-section shell" id="income">
      <div class="app-section-head">
        <h2>${esc(t.app.income.title)}</h2>
        <p>${esc(t.app.income.body)}</p>
      </div>
      <div class="app-grid">
        <form class="app-form" data-proto-form="income" novalidate>
          <label><span>${esc(t.app.fields.date)}</span><input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required></label>
          <label><span>${esc(t.app.fields.source)}</span><select name="source">${["upwork","fiverr","stripe","direct"].map(sourceOption).join("")}</select></label>
          <label><span>${esc(t.app.fields.client)}</span><input name="client"></label>
          <label><span>${esc(t.app.fields.amount)}</span><input name="amount" type="number" min="0" step="0.01" required></label>
          <label><span>${esc(t.app.fields.platformFee)}</span><input name="platformFee" type="number" min="0" step="0.01" value="0"></label>
          <button class="button button-dark" type="submit">${esc(t.app.income.add)}</button>
        </form>
        <div class="app-table-wrap">
          <table>
            <thead><tr><th>${esc(t.app.table.date)}</th><th>${esc(t.app.table.source)}</th><th>${esc(t.app.table.amount)}</th><th>${esc(t.app.table.fee)}</th><th>${esc(t.app.table.net)}</th></tr></thead>
            <tbody data-proto="income-rows"></tbody>
          </table>
        </div>
      </div>
      <p class="app-note">${esc(t.app.disclaimer)}</p>
    </section>
  </main>
  <footer class="site-footer">
    <div class="shell footer-bottom">
      <p>${esc(t.footer.copyright.replace("{year}", String(new Date().getFullYear())))}</p>
      <a href="/${t.alternatePath}/app">${esc(t.nav.switchTo)}</a>
    </div>
  </footer>
  <script src="/app-proto.js" defer></script>
  <script src="/app.js" defer></script>
</body>
</html>`;
};

const page = ({ locale, t }) => `<!doctype html>
<html lang="${locale.htmlLang}" dir="${locale.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(t.meta.title)}</title>
  <meta name="description" content="${esc(t.meta.description)}">
  <link rel="canonical" href="${siteUrl}/${locale.folder}/">
  <link rel="alternate" hreflang="en" href="${siteUrl}/en/">
  <link rel="alternate" hreflang="zh-Hant-TW" href="${siteUrl}/zh-TW/">
  <link rel="alternate" hreflang="x-default" href="${siteUrl}/en/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="GigLedger">
  <meta property="og:title" content="${esc(t.meta.ogTitle)}">
  <meta property="og:description" content="${esc(t.meta.ogDescription)}">
  <meta property="og:url" content="${siteUrl}/${locale.folder}/">
  <meta property="og:image" content="${siteUrl}/assets/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(t.hero.visualAria)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${siteUrl}/assets/og.png">
  <meta name="theme-color" content="#f7f1e7">
  <link rel="icon" href="/assets/favicon-32.png" sizes="32x32">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Manrope:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="preload" href="/assets/logo-mark-192.png" as="image">
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "GigLedger",
    url: `${siteUrl}/`,
    inLanguage: [locale.htmlLang],
    description: t.meta.description,
  }).replaceAll("</", "<\\/")}
  </script>
</head>
<body class="locale-${locale.code.replace("-", "-").toLowerCase()}">
  <a class="skip-link" href="#main">${esc(t.skip)}</a>
  ${nav(t, locale)}
  ${hero(t, locale)}
  ${dailySection(t)}
  ${featuresSection(t)}
  ${stepsSection(t)}
  ${audienceSection(t)}
  ${honestySection(t)}
  ${faqSection(t)}
  ${waitlistSection(t)}
  ${footer(t)}
  <script src="/app.js" defer></script>
</body>
</html>`;

for (const locale of locales) {
  const t = messages[locale.code];
  const folder = join(root, locale.folder);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "index.html"), page({ locale, t }));
  await writeFile(
    join(folder, "privacy.html"),
    legalPage({ locale, t, type: "privacy" }),
  );
  await writeFile(
    join(folder, "tax-disclaimer.html"),
    legalPage({ locale, t, type: "disclaimer" }),
  );
  await writeFile(join(folder, "thanks.html"), thanksPage({ locale, t }));
  await mkdir(join(folder, "app"), { recursive: true });
  await writeFile(join(folder, "app", "index.html"), appPage({ locale, t }));
  await writeFile(join(folder, "app.html"), appPage({ locale, t }));
}

await writeFile(
  join(root, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>GigLedger</title><link rel="canonical" href="${siteUrl}/en/"><meta http-equiv="refresh" content="0;url=/en/"><script>location.replace("/en/"+location.search+location.hash)</script></head><body><p><a href="/en/">GigLedger</a></p></body></html>`,
);

await writeFile(
  join(root, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /en/thanks.html\nDisallow: /zh-TW/thanks.html\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
);

await writeFile(
  join(root, "_redirects"),
  `/en/app.html /en/app 308
/zh-TW/app.html /zh-TW/app 308
`,
);

const sitemapUrls = [];
for (const locale of locales) {
  for (const file of ["", "privacy.html", "tax-disclaimer.html"]) {
    sitemapUrls.push(`${siteUrl}/${locale.folder}/${file}`);
  }
}
await writeFile(
  join(root, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${locales
  .flatMap((locale) =>
    ["", "privacy.html", "tax-disclaimer.html"].map(
      (file) => `  <url>
    <loc>${siteUrl}/${locale.folder}/${file}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}/en/${file}"/>
    <xhtml:link rel="alternate" hreflang="zh-Hant-TW" href="${siteUrl}/zh-TW/${file}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/en/${file}"/>
  </url>`,
    ),
  )
  .join("\n")}
</urlset>
`,
);

console.log(
  `Built ${locales.length * 5} pages with ${Object.keys(messages).length} locales.`,
);
