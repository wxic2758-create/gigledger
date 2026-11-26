import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import subscriptionTemplates from "../config/subscription-templates.mjs";
import { locales } from "../config/locales.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = "https://gigledger.xyz";

const localePath = (locale, suffix = "") => `/${locale.folder}/${suffix}`;

const messages = {};
for (const locale of locales) {
  messages[locale.code] = JSON.parse(
    await readFile(join(root, "i18n", `${locale.code}.json`), "utf8"),
  );
  const flow = messages[locale.code].app.flow;
  flow.templates = subscriptionTemplates.map((item) => ({
    ...item, label: flow.templateLabels[item.key] || item.label,
  }));
  delete flow.templateLabels;
}

const esc = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const cleanHtml = (value) => String(value)
  .split("\n")
  .map((line) => line.replace(/[ \t]+$/g, ""))
  .join("\n");

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
  <a class="brand" href="/${locale}/">
    <img class="brand-mark" src="/assets/logo-mark-192.png" alt="" width="42" height="42">
    <span class="brand-word"><b>Gig</b>Ledger</span>
  </a>`;

const languageLinks = (current, suffix = "") => locales
  .filter(({ code }) => code !== current.code)
  .map((locale) => `<a data-language-link href="${localePath(locale, suffix)}" hreflang="${locale.htmlLang}" lang="${locale.htmlLang}">${esc(locale.label)}</a>`)
  .join("");

const languageSwitch = (t, current, suffix = "") => `
  <details class="lang-switch" data-language-switch>
    <summary aria-label="${esc(t.nav.language)} · ${esc(current.label)}">${esc(current.label)}</summary>
    <nav class="lang-options" aria-label="${esc(t.nav.language)}">${languageLinks(current, suffix)}</nav>
  </details>`;

const alternateUrls = (suffix) => [
  ...locales.map((locale) => [locale.htmlLang, siteUrl + localePath(locale, suffix)]),
  ["x-default", `${siteUrl}/en/${suffix}`],
];
const alternateLinks = (suffix) => alternateUrls(suffix).map(([lang, href]) =>
  `<link rel="alternate" hreflang="${lang}" href="${href}">`).join("\n  ");

const nav = (t, current, route) => {
  const links = [
    ["", t.nav.home],
    ["product", t.nav.features],
    ["pricing", t.nav.pricing],
    ["faq", t.nav.faq],
  ];
  const navLinks = links.map(([path, label]) => {
    const href = `/${current.folder}/${path ? path + "/" : ""}`;
    return `<a href="${href}"${route === path ? ' aria-current="page"' : ""}>${esc(label)}</a>`;
  }).join("");
  return `
  <header class="site-header public-header">
    <div class="shell header-inner">
      ${logo(current.folder)}
      <div class="header-actions">
        ${languageSwitch(t, current, route ? route + "/" : "")}
        <a class="button button-small button-orange" href="/${current.folder}/app">${esc(t.nav.cta)}</a>
      </div>
    </div>
    <nav class="public-nav shell" aria-label="${esc(t.nav.aria)}">${navLinks}</nav>
  </header>`;
};

const landingNav = (t, current) => {
  const links = [
    ["product", t.nav.features],
    ["pricing", t.nav.pricing],
    ["#faq", t.nav.faq],
  ];
  const navLinks = links.map(([path, label]) => {
    const href = path.startsWith("#") ? `/${current.folder}/${path}` : `/${current.folder}/${path}/`;
    return `<a href="${href}">${esc(label)}</a>`;
  }).join("");
  return `
  <header class="site-header">
    <div class="shell header-inner">
      ${logo(current.folder)}
      <nav class="desktop-nav" aria-label="${esc(t.nav.aria)}">${navLinks}</nav>
      <div class="header-actions">
        ${languageSwitch(t, current)}
        <a class="button button-small button-orange" href="/${current.folder}/app">${esc(t.nav.cta)}</a>
        <button class="menu-button" type="button" aria-expanded="false" aria-controls="mobileNav" aria-label="${esc(t.nav.menuOpen)}" data-menu-open="${esc(t.nav.menuOpen)}" data-menu-close="${esc(t.nav.menuClose)}">
          <span></span><span></span>
        </button>
      </div>
    </div>
    <nav class="mobile-nav" id="mobileNav" aria-label="${esc(t.nav.aria)}">
      ${navLinks}
      <a href="/${current.folder}/app">${esc(t.nav.cta)}</a>
    </nav>
  </header>`;
};

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
    <section class="hero" id="start">
      <div class="shell hero-grid">
        <div class="hero-copy">
          <p class="kicker">${esc(t.hero.kicker)}</p>
          <h1>${esc(t.hero.titleBefore)} <span class="accent-word">${esc(t.hero.titleAccent)}</span></h1>
          <p class="hero-sub">${esc(t.hero.sub)}</p>
          <div class="hero-actions">
            <a class="button button-orange" href="/${current.folder}/app">${esc(t.hero.primaryCta)} <span aria-hidden="true">→</span></a>
            <a class="button button-ghost" href="/api/auth/google?locale=${current.code}">${esc(t.hero.secondaryCta)}</a>
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

const productLinks = (t) => `
    <section class="home-product-links shell" id="decisions" aria-label="${esc(t.footer.product)}">
      <a id="features" href="/${t.locale}/product/"><strong>${esc(t.nav.features)}</strong><span aria-hidden="true">→</span></a>
      <a id="pricing" href="/${t.locale}/pricing/"><strong>${esc(t.nav.pricing)}</strong><span aria-hidden="true">→</span></a>
      <a id="how" href="/${t.locale}/product/#how"><strong>${esc(t.nav.how)}</strong><span aria-hidden="true">→</span></a>
    </section>`;

const dailySection = (t) => `
    <section class="daily-section" id="daily">
      <div class="shell daily-grid">
        <div class="section-copy">
          <div class="section-index"><span>${esc(t.daily.index)}</span><div></div><p>${esc(t.daily.kicker)}</p><span class="section-name">${esc(t.sectionIndex.daily)}</span></div>
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
            <div class="section-index"><span>${esc(t.features.index)}</span><div></div><p>${esc(t.features.kicker)}</p><span class="section-name">${esc(t.sectionIndex.features)}</span></div>
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

const productBlocksSection = (t) => {
  const p = t.productBlocks;
  const cards = [
    { key: "ai", tone: "orange", value: "AI", body: p.ai.body },
    { key: "runway", tone: "dark", value: "18", body: p.runway.body },
    { key: "sync", tone: "light", value: "API", body: p.sync.body },
    { key: "share", tone: "white", body: p.share.note },
  ];
  return `
    <section class="product-blocks" id="decisions">
      <div class="shell">
        <div class="section-head">
          <div>
            <div class="section-index"><span>${esc(p.index)}</span><div></div><p>${esc(p.kicker)}</p><span class="section-name">${esc(t.sectionIndex.decisions)}</span></div>
            <h2>${esc(p.title)}</h2>
          </div>
        </div>
        <div class="decision-grid">
          ${cards.map((card) => `
          <article class="decision-card tone-${card.tone}">
            ${card.key === "share" ? `
            <div class="sample-card" aria-label="${esc(p.share.tag)}">
              <div><span>${esc(p.share.ai)}</span><strong>${esc(p.share.aiValue)}</strong></div>
              <div><span>${esc(p.share.daily)}</span><strong>${esc(p.share.dailyValue)}</strong></div>
              <small>${esc(p.share.brand)}</small>
            </div>
            ` : `<div class="decision-visual" aria-hidden="true"><strong>${esc(card.value)}</strong><span>${esc(p[card.key].tag)}</span></div>`}
            <h3>${esc(p[card.key].title)}</h3>
            <p>${esc(card.body)}</p>
          </article>`).join("")}
        </div>
      </div>
    </section>`;
};

const pricingSection = (t) => {
  const p = t.productBlocks.pricing;
  return `
    <section class="shell standalone-pricing">
        <div class="pricing-panel" id="pricing">
          <div class="pricing-copy">
            <p class="kicker">${esc(p.tag)}</p>
            <h1>${esc(p.title)}</h1>
            <div class="pricing-grid">
              <div>
                <h3>${esc(p.freeTitle)}</h3>
                <ul>${p.free.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
              </div>
              <div>
                <h3>${esc(p.proTitle)}</h3>
                <ul>${p.pro.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
              </div>
            </div>
            <strong>${esc(p.price)}</strong>
            <div class="pricing-actions">
              <a class="button button-orange" href="/${t.locale}/app">${esc(p.calculate)} <span aria-hidden="true">→</span></a>
              <a class="button button-ghost" href="/api/auth/google?locale=${t.locale}">${esc(p.signIn)}</a>
            </div>
            <small>${esc(p.note)}</small>
          </div>
        </div>
    </section>`;
};

const stepsSection = (t) => `
    <section class="steps-section" id="how">
      <div class="shell steps-grid">
        <div class="steps-intro">
          <div class="section-index light"><span>${esc(t.steps.index)}</span><div></div><p>${esc(t.steps.kicker)}</p><span class="section-name">${esc(t.sectionIndex.how)}</span></div>
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

const faqSection = (t, heading = "h1") => `
    <section class="faq-section" id="faq">
      <div class="shell faq-grid">
        <div class="faq-intro">
          <${heading}>${esc(t.faq.title)}</${heading}>
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

const footer = (t) => `
  </main>
  <footer class="site-footer public-footer">
    <div class="shell public-footer-row">
      <p>${esc(t.footer.copyright.replace("{year}", String(new Date().getFullYear())))}</p>
      <nav aria-label="${esc(t.footer.legal)}">
        <a href="/${t.locale}/privacy">${esc(t.footer.privacy)}</a>
        <a href="/${t.locale}/tax-disclaimer">${esc(t.footer.disclaimer)}</a>
      </nav>
    </div>
  </footer>`;

const landingFooter = (t, locale) => `
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
          <a href="/${t.locale}/product/">${esc(t.nav.features)}</a>
          <a href="/${t.locale}/pricing/">${esc(t.nav.pricing)}</a>
          <a href="/${t.locale}/#faq">${esc(t.footer.faq)}</a>
        </div>
        <div>
          <p class="footer-heading">${esc(t.footer.legal)}</p>
          <a href="/${t.locale}/privacy">${esc(t.footer.privacy)}</a>
          <a href="/${t.locale}/tax-disclaimer">${esc(t.footer.disclaimer)}</a>
        </div>
      </div>
    </div>
    <div class="shell footer-bottom">
      <p>${esc(t.footer.copyright.replace("{year}", String(new Date().getFullYear())))}</p>
      <nav class="footer-languages" aria-label="${esc(t.nav.language)}">${languageLinks(locale)}</nav>
    </div>
  </footer>`;

const legalPage = ({ locale, t, type }) => {
  const isPrivacy = type === "privacy";
  const suffix = isPrivacy ? "privacy" : "tax-disclaimer";
  const title = isPrivacy ? t.legal.privacyTitle : t.legal.disclaimerTitle;
  const body = isPrivacy ? t.legal.privacyBody : t.legal.disclaimerBody;
  const description = isPrivacy ? t.legal.privacyDescription : t.legal.disclaimerDescription;
  const draft = isPrivacy ? `<p class="legal-draft">${esc(t.legal.privacyDraft)}</p>` : "";
  return `<!doctype html>
<html lang="${locale.htmlLang}" dir="${locale.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — GigLedger</title>
  <meta name="description" content="${esc(description)}">
  <link rel="icon" href="/assets/favicon-32.png" sizes="32x32">
  <link rel="canonical" href="${siteUrl}${localePath(locale, suffix)}">
  ${alternateLinks(suffix)}
  <link rel="stylesheet" href="/styles.css?v=20261127-01">
</head>
<body>
  <header class="site-header">
    <div class="shell header-inner">
      ${logo(locale.folder)}
      <div class="header-actions">${languageSwitch(t, locale, suffix)}</div>
    </div>
  </header>
  <main class="legal-main shell">
    <p class="kicker">GigLedger</p>
    <h1>${esc(title)}</h1>
    ${draft}
    ${body.map((p) => `<p>${esc(p)}</p>`).join("")}
    <a class="button button-orange" href="/${locale.folder}/">${esc(t.legal.back)}</a>
  </main>
  <script src="/app.js?v=20261127-01" defer></script>
</body>
</html>`;
};

const appPage = ({ locale, t, mode = "app" }) => {
  const workspace = mode === "dashboard";
  const w = t.app.workspace;
  const workspaceNav = (links, attribute, label) => `
    <nav class="workspace-nav shell" aria-label="${esc(label)}">
      ${links.map(([href, text]) => `<a href="#${href}" ${attribute}="${href}"${href === "dashboard" ? ' aria-current="page"' : ""}>${esc(text)}</a>`).join("")}
    </nav>`;
  const entryDialog = (id, label) => `
    <dialog class="entry-dialog" data-entry-dialog="${id}" aria-labelledby="${id}-title">
      <div class="entry-dialog-head">
        <h3 id="${id}-title">${esc(label)}</h3>
        <button class="button button-ghost" type="button" data-close-entry>${esc(w.closeEntry)}</button>
      </div>`;
  const entryLink = (id, label) =>
    `<a class="button button-dark entry-link-button" href="#${id}" aria-haspopup="dialog">+ ${esc(label)}</a>`;
  const addMenu = `
    <details class="workspace-add" data-add-menu>
      <summary class="button button-dark">+ ${esc(w.addEntry)}</summary>
      <div class="workspace-add-options">
        <a href="#income-entry">${esc(t.app.income.add)}</a>
        <a href="#expense-entry">${esc(t.app.expenses.add)}</a>
        <a href="#fixed-cost-entry">${esc(t.app.fixed.add)}</a>
      </div>
    </details>`;
  const templateCard = (item) => `
    <label class="template-card">
      <input type="checkbox" name="template" value="${esc(item.key)}" data-template-key="${esc(item.key)}">
      <span>${esc(item.label)}${item.cycle ? ` <small>· ${esc(t.app.cycles[item.cycle])}</small>` : ""}</span>
      <span class="template-price"><b>$</b><input type="number" min="0" step="0.01" value="${item.amount ?? ""}" data-template-amount="${esc(item.key)}" aria-label="${esc(item.label)} · ${esc(t.app.fields.amount)}"></span>
    </label>`;
  const isGuest = !workspace;
  const option = (value) => `<option value="${value}"${value === "monthly" ? " selected" : ""}>${esc(t.app.cycles[value])}</option>`;
  const sourceOption = (value) => `<option value="${value}">${esc(t.app.sources[value])}</option>`;
  const title = mode === "dashboard" ? t.dashboard.title : t.app.title;
  const bodyClass = mode === "dashboard" ? "app-proto dashboard-page" : "app-proto";
  return `<!doctype html>
<html lang="${locale.htmlLang}" dir="${locale.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — GigLedger</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="/assets/favicon-32.png" sizes="32x32">
  <link rel="stylesheet" href="/styles.css?v=20261127-01">
  <link rel="stylesheet" href="/proto.css?v=20261126-03">
</head>
<body class="${bodyClass}">
  <script type="application/json" id="proto-messages">${JSON.stringify({ ...t.app, locale: locale.code, ...(workspace ? { dashboard: t.dashboard } : {}) }).replaceAll("</", "<\\/")}</script>
  <header class="site-header">
    <div class="shell header-inner">
      ${logo(locale.folder)}
      <div class="header-actions">
        ${languageSwitch(t, locale, workspace ? "dashboard" : "app")}
        ${isGuest ? `<a class="button button-small button-orange" href="/api/auth/google?locale=${locale.code}">${esc(t.app.signIn)}</a>` : ""}
      </div>
    </div>
    ${workspace
      ? workspaceNav([["dashboard", w.overview], ["ledger", w.ledger], ["settings", w.settings]], "data-workspace-nav", w.navigation)
      : workspaceNav([["onboarding", w.calculator], ["dashboard", w.ledger]], "data-guest-nav", w.navigation)}
  </header>
  <main id="main"${workspace ? ' class="workspace-pending"' : ""}>
    ${workspace ? `
    <div class="shell workspace-load" data-workspace-load>
      <p data-workspace-load-message role="status">${esc(w.loading)}</p>
      <button class="button button-ghost" type="button" data-workspace-retry hidden>${esc(w.retry)}</button>
    </div>` : ""}
    ${isGuest ? `
    <section class="app-flow shell" id="onboarding">
      <div class="flow-head">
        <p class="app-steps-kicker">${esc(t.app.flow.kicker)}</p>
        <h1>${esc(t.app.flow.title)}</h1>
        <p>${esc(t.app.flow.subtitle)}</p>
      </div>

      <div class="flow-panel" data-flow-step="1">
        <div class="flow-progress"><span data-flow-current>1</span> / 3</div>
        <h2>${esc(t.app.flow.templatesTitle)}</h2>
        <p>${esc(t.app.flow.templatesNote)}</p>
        <div class="flow-other">
          <label><span>${esc(t.app.flow.otherTitle)}</span><input type="text" data-other-name placeholder="${esc(t.app.flow.otherTitle)}"></label>
          <label><span>${esc(t.app.fields.amount)}</span><input type="number" min="0" step="0.01" data-other-amount></label>
        </div>
        <div class="flow-templates" data-template-grid>
          <div class="template-grid">
            ${t.app.flow.templates.slice(0, 3).map(templateCard).join("")}
          </div>
          ${t.app.flow.templates.length > 3 ? `
          <details class="flow-more-templates">
            <summary>${esc(w.moreTemplates)}</summary>
            <div class="template-grid">${t.app.flow.templates.slice(3).map(templateCard).join("")}</div>
          </details>` : ""}
        </div>
        <p class="app-note" data-skip-warning hidden>${esc(t.app.flow.skipWarning)}</p>
      </div>

      <div class="flow-panel" data-flow-step="2" hidden>
        <div class="flow-progress"><span data-flow-current>2</span> / 3</div>
        <h2>${esc(t.app.flow.incomeTitle)}</h2>
        <p>${esc(t.app.flow.incomeNote)}</p>
        <label><span>${esc(t.app.flow.incomeTitle)}</span><input type="number" min="0" step="0.01" data-flow-income></label>
        <label><span>${esc(t.app.flow.cashTitle)}</span><input type="number" min="0" step="0.01" data-flow-cash></label>
        <label><span>${esc(t.app.flow.taxTitle)}</span><input type="number" min="0" max="100" step="0.1" data-flow-tax placeholder="${esc(t.app.taxRatePlaceholder)}"></label>
        <p class="app-note">${esc(t.app.flow.taxReference)}</p>
      </div>

      <div class="flow-panel" data-flow-step="3" hidden>
        <div class="flow-progress"><span data-flow-current>3</span> / 3</div>
        <h2>${esc(t.app.flow.resultTitle)}</h2>
        <p>${esc(t.app.flow.resultNote)}</p>
        <div class="flow-results">
          <article class="flow-primary"><span>${esc(t.app.metrics.daily)}</span><strong data-flow-daily>$0.00</strong></article>
          <article><span>${esc(t.app.flow.comparison)}</span><strong data-flow-comparison>$0.00</strong><small data-flow-gap hidden></small></article>
          <article><span>${esc(t.app.flow.runway)}</span><strong data-flow-runway>${esc(t.app.flow.unset)}</strong></article>
          <article><span>${esc(t.app.flow.estimatedTaxReserve)}</span><strong data-flow-tax-result>${esc(t.app.flow.unset)}</strong><small>${esc(t.app.taxNote)}</small></article>
        </div>
        <div class="flow-actions">
          <button class="button button-dark" type="button" data-flow-save>${esc(t.app.flow.save)}</button>
          <a class="button button-ghost" href="#fixed-costs" data-flow-continue>${esc(t.app.flow.continueFull)}</a>
        </div>
        <p class="form-message" role="status" data-flow-save-message hidden></p>
      </div>

      <div class="flow-nav">
        <button class="button button-ghost" type="button" data-flow-back hidden>${esc(t.app.flow.back)}</button>
        <button class="button button-dark" type="button" data-flow-next>${esc(t.app.flow.next)}</button>
      </div>
    </section>

    ` : ""}

    ${isGuest ? `
    ${workspaceNav([["dashboard", w.overview], ["income", t.app.nav.income], ["expenses", t.app.expenses.title], ["fixed-costs", w.fixed], ["projects", t.app.projects.title], ["planning", w.settings]], "data-guest-ledger-nav", w.ledgerNavigation)}
      <div class="shell account-actions guest-actions" data-guest-actions hidden>
        <button class="button button-dark" type="button" data-save-google>${esc(t.app.saveGoogle)}</button>
        <span class="account-note">${esc(t.app.saveNote)}</span>
        <p class="form-message account-message" role="status" aria-live="polite" data-save-message hidden></p>
      </div>
    ` : ""}

    <section class="workspace-overview shell" id="dashboard" ${workspace ? 'data-dashboard data-workspace-view="overview" aria-busy="true"' : 'data-guest-panel hidden'}>
      <div class="workspace-heading">
        <div><h1>${esc(w.overview)}</h1><p class="workspace-currency" data-proto="report-context">USD</p></div>
        ${addMenu}
      </div>
      <div class="workspace-period" role="group" aria-label="${esc(w.period)}">
        <button type="button" data-workspace-period="current" aria-pressed="true">${esc(w.currentMonth)}</button>
        <button type="button" data-workspace-period="previous" aria-pressed="false">${esc(w.previousMonth)}</button>
      </div>
      <div class="workspace-stats">
        <article class="workspace-stat workspace-floor">
          <span>${esc(w.dailyFloor)}</span>
          <strong data-proto="metric-daily">—</strong>
          <small>${esc(w.dailyNote)}</small>
          <a href="#fixed-cost-entry" data-floor-setup hidden>${esc(w.firstFixed)}</a>
        </article>
        <article class="workspace-stat">
          <span data-profit-period>${esc(w.currentProfit)}</span>
          <strong data-proto="metric-profit">—</strong>
          <small>${esc(w.profitNote)}</small>
        </article>
        <article class="workspace-stat">
          <span>${esc(w.runway)}</span>
          <strong data-proto="metric-runway">—</strong>
          <small data-proto="metric-runway-average"></small>
          <a href="#cash-settings" data-cash-setup hidden>${esc(w.addCash)}</a>
        </article>
      </div>
      <section class="workspace-chart" aria-labelledby="workspace-chart-title">
        <div class="workspace-chart-head">
          <div>
            <h2 id="workspace-chart-title">${esc(w.chartTitle)}</h2>
            <p>${esc(t.app.metrics.net)} <strong data-proto="metric-net">—</strong></p>
          </div>
          <p class="workspace-shortfall" data-chart-shortfall hidden><span>${esc(w.shortfall)}</span> <strong data-chart-shortfall-value>—</strong></p>
        </div>
        <p class="app-note" data-chart-empty hidden>${esc(w.emptyChart)}</p>
        <div class="workspace-chart-bar" data-chart-bar hidden aria-hidden="true">
          <span data-chart-segment="fixed"></span><span data-chart-segment="expenses"></span><span data-chart-segment="profit"></span><span data-chart-segment="shortfall"></span>
        </div>
        <dl class="workspace-chart-key" data-chart-key hidden>
          <div><dt class="chart-fixed">${esc(t.app.metrics.costs)}</dt><dd data-proto="metric-costs">—</dd></div>
          <div><dt class="chart-expenses">${esc(t.app.metrics.expenses)}</dt><dd data-proto="metric-expenses">—</dd></div>
          <div><dt class="chart-profit">${esc(w.chartProfit)}</dt><dd data-chart-profit>—</dd></div>
        </dl>
        <p class="workspace-pace" data-current-pace hidden><strong data-proto="metric-comparison"></strong> <span>${esc(w.requiredSoFar)} <strong data-proto="metric-required">—</strong></span></p>
        <dl class="workspace-app-store" data-app-store-summary hidden>
          <div><dt>${esc(t.app.appStore.soldLabel)}</dt><dd data-proto="metric-sold">—</dd></div>
          <div><dt>${esc(t.app.appStore.receivedLabel)}</dt><dd data-proto="metric-app-store-received">—</dd></div>
        </dl>
        <details class="workspace-secondary">
          <summary>${esc(w.moreNumbers)}</summary>
          <dl>
            <div><dt>${esc(t.app.metrics.gross)}</dt><dd data-proto="metric-gross">—</dd></div>
            <div><dt>${esc(t.app.metrics.fees)}</dt><dd data-proto="metric-fees">—</dd></div>
            <div><dt>${esc(t.app.metrics.tax)}</dt><dd data-proto="metric-tax">—</dd></div>
          </dl>
          <p class="app-note">${esc(t.app.taxNote)}</p>
        </details>
        <p class="workspace-sr" data-period-status role="status"></p>
      </section>
      ${workspace ? `
      <details class="workspace-secondary workspace-tasks" data-attention-queue>
        <summary>${esc(t.app.attentionQueue.title)} <span class="workspace-task-count" data-attention-count hidden></span></summary>
        <ul class="attention-list" data-attention-list></ul>
        <p class="attention-empty" data-attention-empty hidden>${esc(t.app.attentionQueue.empty)}</p>
      </details>

      <details class="workspace-secondary workspace-extras">
        <summary>${esc(w.extras)}</summary>
      <div class="weekly-summary" data-weekly-summary hidden>
        <div><span>${esc(t.app.weeklySummary.title)}</span><p data-weekly-text></p></div>
        <button class="text-link" type="button" data-weekly-dismiss>${esc(t.app.weeklySummary.dismiss)}</button>
      </div>
      <div class="share-panel">
        <div class="share-cards">
          <article class="share-card" data-share-card="ai">
            <span>${esc(t.app.share.ai)}</span>
            <strong data-share-ai>$0.00</strong>
            <small>GigLedger</small>
          </article>
          <article class="share-card" data-share-card="daily">
            <span>${esc(t.app.share.daily)}</span>
            <strong data-share-daily>$0.00</strong>
            <small>GigLedger</small>
          </article>
        </div>
        <div class="share-actions">
          <button class="button button-ghost" type="button" data-share-download>${esc(t.app.share.download)}</button>
          <button class="button button-dark" type="button" data-share-x>${esc(t.app.share.shareX)}</button>
          <button class="button button-ghost" type="button" data-share-copy>${esc(t.app.share.copyText)}</button>
        </div>
      </div>

      </details>
      ` : ""}
    </section>


    ${isGuest ? `
    <section class="app-steps shell" id="how-it-works" data-guest-panel hidden>
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

    ` : ""}

    ${workspace ? `
    <div data-workspace-view="settings" id="settings" hidden>
      <div class="shell workspace-heading ledger-heading"><h1>${esc(w.settings)}</h1></div>
      ${workspaceNav([["planning", w.planning], ["csv", w.transfers], ["sources", w.connections], ["account", w.account]], "data-settings-nav", w.settings)}
      <section class="app-section shell workspace-settings" id="planning" data-settings-panel>
        <h2>${esc(w.planning)}</h2>
        <form class="app-form app-settings-form" data-proto-form="settings">
          <label><span>${esc(t.app.taxRateLabel)}</span><input name="taxReserveRate" type="number" min="0" max="100" step="0.1" placeholder="${esc(t.app.taxRatePlaceholder)}"></label>
          <label><span>${esc(t.app.appleFeeLabel)}</span><select name="appleFeeRate"><option value="">${esc(t.app.appleFeeUnset)}</option><option value="15">15%</option><option value="30">30%</option></select></label>
          <label><span>${esc(t.app.cashLabel)}</span><input id="cash-settings" name="cashOnHand" type="number" min="0" step="0.01"></label>
          <label><span>${esc(t.app.monthlyIncomeEstimateLabel)}</span><input name="monthlyIncomeEstimate" type="number" min="0" step="0.01"></label>
          <label><span>${esc(w.timeZone)}</span><select name="timeZone" aria-describedby="workspace-time-zone-note" required></select></label>
          <p class="app-note" id="workspace-time-zone-note">${esc(w.timeZoneNote)}</p>
          <p class="app-note">${esc(t.app.monthlyIncomeEstimateNote)}</p>
          <p class="app-note">${esc(t.app.taxReference)} ${esc(t.app.appleFeeNote)}</p>
          <button class="button button-dark" type="submit">${esc(w.saveSettings)}</button>
          <p class="form-message" data-workspace-message role="status" hidden></p>
        </form>
      </section>
      <section class="app-section shell" id="csv" data-settings-panel hidden>
        <article class="source-card settings-transfer">
          <h2>${esc(t.app.csv.title)}</h2>
          <p>${esc(t.app.dataSources.csvBody)}</p>
          <div class="csv-actions">
            <a class="button button-ghost" href="/api/workspace/csv?template=1" data-csv-pro>${esc(t.app.csv.template)}</a>
            <label class="button button-dark csv-import-button" data-csv-pro>
              <input type="file" accept=".csv,text/csv" data-csv-import hidden>
              <span data-csv-import-label>${esc(t.app.csv.import)}</span>
            </label>
            <div class="csv-monthly-export">
              <label><span>${esc(t.app.csv.exportPeriod)}</span><select data-csv-export-period disabled></select></label>
              <a class="button button-ghost" href="/api/workspace/csv?export=income" data-csv-export data-csv-pro>${esc(t.app.csv.export)}</a>
            </div>
            <p class="form-message" data-csv-message role="status" aria-live="polite" hidden></p>
            <p class="form-message" data-csv-failed-message role="status" aria-live="polite" hidden><a href="#" download="gigledger-unimported.csv" data-csv-failed-download>${esc(t.app.csv.failedDownload)}</a></p>
          </div>
        </article>
      </section>
      <section class="app-section shell" id="sources" data-settings-panel hidden>
        <section class="plan-panel source-sync" data-integration-panel aria-labelledby="integration-title">
          <div class="plan-panel-head">
            <div>
              <p class="app-steps-kicker">${esc(t.app.integrations.kicker)}</p>
              <h2 id="integration-title">${esc(t.app.integrations.title)}</h2>
              <p>${esc(t.app.integrations.body)}</p>
            </div>
            <div class="plan-panel-head-actions">
              <span class="plan-badge" data-plan-badge>${esc(t.app.plan.free)}</span>
              <span class="plan-upgrade-note" data-plan-upgrade>${esc(t.app.plan.upgradeNote)}</span>
            </div>
          </div>
          <div class="integration-grid">
            <form class="integration-form" id="stripe-connect" data-stripe-form>
              <h3>${esc(t.app.integrations.stripeTitle)}</h3>
              <label><span>${esc(t.app.integrations.keyLabel)}</span><input name="secretKey" type="password" autocomplete="off" placeholder="rk_live_… or sk_live_…" required></label>
              <label><span>${esc(t.app.integrations.accountLabel)}</span><input name="accountLabel" placeholder="${esc(t.app.integrations.accountPlaceholder)}"></label>
              <p class="app-note">${esc(t.app.integrations.keyNote)}</p>
              <button class="button button-dark" type="submit">${esc(t.app.integrations.connect)}</button>
              <p class="form-message" data-stripe-message role="status" aria-live="polite" hidden></p>
            </form>
            <div class="integration-status" data-stripe-status>
              <span>${esc(t.app.integrations.statusLabel)}</span>
              <strong data-stripe-status-label>${esc(t.app.integrations.notConnected)}</strong>
              <small data-stripe-sync-label></small>
              <div class="integration-actions">
                <button class="button button-ghost" type="button" data-stripe-sync disabled>${esc(t.app.integrations.sync)}</button>
                <button class="button button-danger" type="button" data-stripe-disconnect disabled>${esc(t.app.integrations.disconnect)}</button>
              </div>
            </div>
          </div>
          <div class="workspace-provider" id="app-store-connect">
            <div class="app-store-header">
              <h3>${esc(t.app.integrations.appStoreTitle)}</h3>
              <small data-app-store-state></small>
            </div>
            <p class="app-note" data-app-store-plan hidden>${esc(t.app.integrations.appStoreProRequired)}</p>
            <details data-app-store-setup hidden>
              <summary>${esc(t.app.appStore.connect)}</summary>
              <p>${esc(t.app.appStore.keyGuide)}</p>
              <div class="integration-actions">
                <a class="button button-ghost" href="https://appstoreconnect.apple.com/access/integrations/api" target="_blank" rel="noopener noreferrer">${esc(t.app.appStore.openApple)}</a>
                <a class="button button-ghost" href="https://developer.apple.com/help/app-store-connect/getting-paid/view-payments-and-proceeds/" target="_blank" rel="noopener noreferrer">${esc(t.app.appStore.findVendor)}</a>
              </div>
              <form class="integration-form" data-app-store-form method="post" action="/api/workspace/integrations">
                <label><span>${esc(t.app.appStore.upload)}</span><input type="file" accept=".p8" data-app-store-file required></label>
                <label><span>Key ID</span><input name="keyId" autocomplete="off" autocapitalize="characters" maxlength="12" pattern="[A-Z0-9]{6,12}" required></label>
                <label><span>Issuer ID</span><input name="issuerId" autocomplete="off" maxlength="36" required></label>
                <label><span>${esc(t.app.appStore.vendorNumber)}</span><input name="vendorNumber" inputmode="numeric" autocomplete="off" pattern="[0-9]{5,20}" maxlength="20" required></label>
                <p class="app-note">${esc(t.app.appStore.keyNote)}</p>
                <button class="button button-dark" type="submit">${esc(t.app.appStore.testAndSave)}</button>
              </form>
            </details>
            <p class="form-message" data-app-store-message role="status" hidden></p>
            <div class="app-store-report-forms" data-app-store-controls hidden>
              <form class="integration-form" data-app-store-sync="sales" method="post">
                <label><span>${esc(t.app.appStore.salesDate)}</span><input name="period" type="date" required></label>
                <button class="button button-dark" type="submit">${esc(t.app.appStore.syncSales)}</button>
              </form>
              <form class="integration-form" data-app-store-sync="finance" method="post">
                <label><span>${esc(t.app.appStore.financeMonth)}</span><input name="period" type="month" placeholder="YYYY-MM" pattern="[0-9]{4}-(0[1-9]|1[0-2])" required></label>
                <button class="button button-dark" type="submit">${esc(t.app.appStore.syncFinance)}</button>
              </form>
              <p class="app-note">${esc(t.app.appStore.syncNote)}</p>
            </div>
            <button class="button button-danger" type="button" data-app-store-disconnect hidden>${esc(t.app.integrations.disconnect)}</button>
            <section class="app-store-finance" data-app-store-finance hidden aria-labelledby="app-store-finance-title">
              <h4 id="app-store-finance-title">${esc(t.app.appStore.reconcileTitle)}</h4>
              <p>${esc(t.app.appStore.reconcileNote)}</p>
              <label><span>${esc(t.app.appStore.fiscalPeriod)}</span><select data-app-store-period></select></label>
              <p data-app-store-finance-totals></p>
              <form class="integration-form" data-app-store-payout method="post">
                <label><span>${esc(t.app.appStore.receivedDate)}</span><input name="date" type="date" required></label>
                <label><span>${esc(t.app.appStore.receivedAmount)}</span><input name="amount" type="number" min="0.01" step="0.01" required></label>
                <button class="button button-dark" type="submit">${esc(t.app.appStore.recordPayout)}</button>
                <p class="form-message" data-app-store-payout-message role="status" hidden></p>
              </form>
            </section>
          </div>
        </section>
      </section>
      <section class="app-section shell workspace-account" id="account" data-settings-panel hidden>
        <h2>${esc(w.account)}</h2>
        <div class="workspace-account-actions">
          <a class="button button-ghost" href="/api/workspace/export">${esc(t.app.export)}</a>
          <a class="button button-ghost" href="/api/auth/logout">${esc(w.signOut)}</a>
          <button class="button button-danger" type="button" data-delete-account>${esc(t.app.deleteAccount)}</button>
        </div>
        <p class="form-message" data-delete-account-message role="status" hidden></p>
      </section>
    </div>
    <div data-workspace-view="ledger" id="ledger" hidden>
      <div class="shell workspace-heading ledger-heading"><h1>${esc(w.ledger)}</h1></div>
      ${workspaceNav([["income", t.app.income.title], ["expenses", t.app.expenses.title], ["fixed-costs", w.fixed], ["projects", t.app.projects.title]], "data-ledger-nav", w.ledgerNavigation)}
    </div>
    ` : ""}

    <section class="app-section shell" id="projects" ${workspace ? "data-ledger-panel" : "data-guest-panel"} hidden>
      <div class="app-section-head">
        <h2>${esc(t.app.projects.title)}</h2>
        <p data-proto="project-period"></p>
        <p>${esc(t.app.projects.body)}</p>
        ${entryLink("project-entry", t.app.projects.add)}
      </div>
      <div class="app-grid ledger-list">
        ${entryDialog("project-entry", t.app.projects.add)}
        <form class="app-form" data-project-form id="project-entry" novalidate>
          <label><span>${esc(t.app.projects.name)}</span><input data-project-name required></label>
          <button class="button button-dark" type="submit">${esc(t.app.projects.add)}</button>
        </form>
        </dialog>
        <div class="app-table-wrap">
          <table>
            <thead><tr><th>${esc(t.app.projects.name)}</th><th>${esc(t.app.projects.income)}</th><th>${esc(t.app.projects.costs)}</th><th>${esc(t.app.projects.profit)}</th><th>${esc(t.app.projects.actions)}</th></tr></thead>
            <tbody data-proto="project-rows"></tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="app-section shell" id="fixed-costs" ${workspace ? "data-ledger-panel" : "data-guest-panel"} hidden>
      <div class="app-section-head">
        <h2>${esc(t.app.fixed.title)}</h2>
        <p>${esc(t.app.fixed.body)}</p>
        ${entryLink("fixed-cost-entry", t.app.fixed.add)}
      </div>
      <div class="app-grid ledger-list">
        ${entryDialog("fixed-cost-entry", t.app.fixed.add)}
        <form class="app-form" data-proto-form="fixed" id="fixed-cost-entry" novalidate>
          <label data-fixed-template-field>
            <span>${esc(t.app.fields.subscriptionTemplate)}</span>
            <select data-fixed-template>
              <option value="">${esc(t.app.fields.manualFixedCost)}</option>
              ${t.app.flow.templates.map((item) => `<option value="${esc(item.key)}">${esc(item.label)}</option>`).join("")}
            </select>
          </label>
          <label><span>${esc(t.app.fields.name)}</span><input name="name" required></label>
          <label><span>${esc(t.app.fields.amount)}</span><input name="amount" type="number" min="0" step="0.01" required></label>
          <label><span>${esc(t.app.fields.cycle)}</span><select name="cycle">${["daily","weekly","biweekly","monthly","quarterly","yearly"].map(option).join("")}</select></label>
          <label class="app-checkbox"><input name="isSubscription" type="checkbox"> <span>${esc(t.app.fields.subscription)}</span></label>
          <label data-revision-date hidden><span>${esc(t.app.fixedRevision.effectiveFrom)}</span><input name="effectiveFrom" type="date"></label>
          <details class="workspace-form-options">
            <summary>${esc(w.moreFields)}</summary>
            <label class="app-checkbox"><input name="isSoftware" type="checkbox" checked> <span>${esc(t.app.fields.software)}</span></label>
            <label><span>${esc(t.app.fields.businessUse)}</span><input name="businessUse" type="number" min="0" max="100" value="100" required></label>
            <label><span>${esc(t.app.fields.startDate)}</span><input name="startDate" type="date" required></label>
            <label><span>${esc(t.app.fields.endDate)}</span><input name="endDate" type="date"></label>
            <div class="subscription-fields" data-subscription-fields hidden>
              <label><span>${esc(t.app.fields.nextBillingDate)}</span><input name="nextBillingDate" type="date" aria-describedby="billing-date-note"></label>
              <p id="billing-date-note" class="app-note">${esc(t.app.fields.billingDateNote)}</p>
              <label><span>${esc(t.app.fields.productUrl)}</span><input name="productUrl" type="url" placeholder="https://"></label>
              <label><span>${esc(t.app.fields.manageUrl)}</span><input name="manageUrl" type="url" placeholder="https://"></label>
            </div>
            <p class="app-note">${esc(t.app.fixedVersionNote)}</p>
            <div class="allocation-field">
              <span class="allocation-label">${esc(t.app.fields.projectAllocation)}</span>
              <p class="allocation-note">${esc(t.app.fields.projectAllocationNote)}</p>
              <div class="allocation-list" data-allocation-list></div>
              <button class="button button-ghost allocation-add" type="button" data-allocation-add>${esc(t.app.fields.addProjectShare)}</button>
              <p class="allocation-total" data-allocation-total></p>
            </div>
          </details>
          <p class="form-message" data-fixed-edit-message data-workspace-message role="status" aria-live="polite" hidden></p>
          <div class="fixed-form-actions">
            <button class="button button-dark" type="submit" data-fixed-submit>${esc(t.app.fixed.add)}</button>
            <button class="button button-ghost" type="button" data-fixed-cancel hidden>${esc(t.app.fixedRevision.cancel)}</button>
          </div>
        </form>
        </dialog>
        <div class="app-table-wrap">
          <table>
            <thead><tr><th>${esc(t.app.table.name)}</th><th>${esc(t.app.table.type)}</th><th>${esc(t.app.table.cycle)}</th><th>${esc(t.app.table.amount)}</th><th>${esc(t.app.table.businessUse)}</th><th>${esc(t.app.table.project)}</th><th>${esc(t.app.table.effective)}</th><th>${esc(t.app.table.links)}</th><th>${esc(t.app.table.daily)}</th><th>${esc(t.app.table.review)}</th><th>${esc(t.app.table.actions)}</th></tr></thead>
            <tbody data-proto="fixed-cost-rows"></tbody>
          </table>
        </div>
      </div>
    </section>

    ${isGuest ? `
    <section class="app-section shell workspace-settings" id="planning" data-guest-panel hidden>
      <h2>${esc(w.planning)}</h2>
        <form class="app-form app-settings-form" data-proto-form="settings" novalidate>
          <label><span>${esc(t.app.taxRateLabel)}</span><input name="taxReserveRate" type="number" min="0" max="100" step="0.1" placeholder="${esc(t.app.taxRatePlaceholder)}"></label>
          <label><span>${esc(t.app.appleFeeLabel)}</span><select name="appleFeeRate"><option value="">${esc(t.app.appleFeeUnset)}</option><option value="15">15%</option><option value="30">30%</option></select></label>
          <label><span>${esc(t.app.cashLabel)}</span><input id="cash-settings" name="cashOnHand" type="number" min="0" step="0.01"></label>
          <label><span>${esc(t.app.monthlyIncomeEstimateLabel)}</span><input name="monthlyIncomeEstimate" type="number" min="0" step="0.01"></label>
          <p class="app-note">${esc(t.app.monthlyIncomeEstimateNote)}</p>
          <p class="app-note">${esc(t.app.taxReference)} ${esc(t.app.appleFeeNote)}</p>
        </form>
    </section>
    ` : ""}

    <section class="app-section shell" id="income" ${workspace ? "data-ledger-panel" : "data-guest-panel"} hidden>
      <div class="app-section-head">
        <h2>${esc(t.app.income.title)}</h2>
        <p>${esc(t.app.income.body)}</p>
        ${entryLink("income-entry", t.app.income.add)}
      </div>
      <div class="app-grid ledger-list">
        ${entryDialog("income-entry", t.app.income.add)}
        <form class="app-form" data-proto-form="income" id="income-entry" novalidate>
          <label><span>${esc(t.app.fields.amount)}</span><input name="amount" type="number" min="0" step="0.01" required></label>
          <label><span>${esc(t.app.fields.date)}</span><input name="date" type="date" required></label>
          <label><span>${esc(t.app.fields.source)}</span><select name="source">${["direct","upwork","fiverr","stripe","app_store","paypal","other"].map(sourceOption).join("")}</select></label>
          <label data-income-recognition-field hidden><span>${esc(t.app.fields.recognition)}</span><select name="recognition"><option value="received">${esc(t.app.income.recognitionReceived)}</option><option value="sold">${esc(t.app.income.recognitionSold)}</option></select></label>
          <label><span>${esc(t.app.fields.client)}</span><input name="client"></label>
          <details class="workspace-form-options">
            <summary>${esc(w.moreFields)}</summary>
          <label><span>${esc(t.app.fields.project)}</span><select name="project" data-project-options></select></label>
          <label><span>${esc(t.app.fields.platformFee)}</span><input name="platformFee" type="number" min="0" step="0.01" value="0"></label>
          <label><span>${esc(t.app.fields.platformFeePercent)}</span><input name="platformFeePercent" type="number" min="0" max="100" step="0.01" value="0"></label>
          </details>
          <button class="button button-dark" type="submit">${esc(t.app.income.add)}</button>
          ${workspace ? `<div class="workspace-save-feedback"><p class="form-message" data-workspace-message role="status" hidden></p><button type="button" class="text-link" data-undo-entry hidden>${esc(w.undo)}</button></div>` : ""}
        </form>
        </dialog>
        <div class="app-table-wrap">
          <table>
            <thead><tr><th>${esc(t.app.table.date)}</th><th>${esc(t.app.table.source)}</th><th>${esc(t.app.table.recognition)}</th><th>${esc(t.app.table.project)}</th><th>${esc(t.app.table.amount)}</th><th>${esc(t.app.table.fee)}</th><th>${esc(t.app.table.net)}</th><th>${esc(t.app.table.actions)}</th></tr></thead>
            <tbody data-proto="income-rows"></tbody>
          </table>
        </div>
      </div>
      <p class="app-note">${esc(t.app.disclaimer)}</p>
    </section>

    <section class="app-section shell" id="expenses" ${workspace ? "data-ledger-panel" : "data-guest-panel"} hidden>
      <div class="app-section-head">
        <h2>${esc(t.app.expenses.title)}</h2>
        <p>${esc(t.app.expenses.body)}</p>
        ${entryLink("expense-entry", t.app.expenses.add)}
      </div>
      <div class="app-grid ledger-list">
        ${entryDialog("expense-entry", t.app.expenses.add)}
        <form class="app-form" data-proto-form="expense" id="expense-entry" novalidate>
          <label><span>${esc(t.app.fields.amount)}</span><input name="amount" type="number" min="0" step="0.01" required></label>
          <label><span>${esc(t.app.fields.date)}</span><input name="date" type="date" required></label>
          <label><span>${esc(t.app.fields.category)}</span><input name="category"></label>
          <label><span>${esc(t.app.fields.notes)}</span><input name="notes"></label>
          <details class="workspace-form-options">
            <summary>${esc(w.moreFields)}</summary>
          <label><span>${esc(t.app.fields.merchant)}</span><input name="merchant"></label>
          <label><span>${esc(t.app.fields.project)}</span><select name="project" data-project-options></select></label>
          <label><span>${esc(t.app.fields.businessUse)}</span><input name="businessUse" type="number" min="0" max="100" step="any" value="100" required></label>
          </details>
          <button class="button button-dark" type="submit">${esc(t.app.expenses.add)}</button>
          ${workspace ? `<div class="workspace-save-feedback"><p class="form-message" data-workspace-message role="status" hidden></p><button type="button" class="text-link" data-undo-entry hidden>${esc(w.undo)}</button></div>` : ""}
        </form>
        </dialog>
        <div class="app-table-wrap expense-table">
          <table>
            <thead><tr><th>${esc(t.app.table.date)}</th><th>${esc(t.app.table.category)}</th><th>${esc(t.app.table.merchant)}</th><th>${esc(t.app.table.project)}</th><th>${esc(t.app.table.amount)}</th><th>${esc(t.app.table.businessUse)}</th><th>${esc(t.app.table.businessAmount)}</th><th>${esc(t.app.table.actions)}</th></tr></thead>
            <tbody data-proto="expense-rows"></tbody>
          </table>
        </div>
      </div>
      <p class="app-note">${esc(t.app.disclaimer)}</p>
    </section>
  </main>
  <footer class="site-footer">
    <div class="shell footer-bottom">
      <p>${esc(t.footer.copyright.replace("{year}", String(new Date().getFullYear())))}</p>
      <nav class="footer-languages" aria-label="${esc(t.nav.language)}">${languageLinks(locale, mode)}</nav>
    </div>
  </footer>
  <script type="module" src="/app-ledger.js?v=20261127-01"></script>
  <script src="/app.js?v=20261127-01" defer></script>
</body>
</html>`;
};

const page = ({ locale, t, route = "" }) => {
  const suffix = route ? `${route}/` : "";
  const copy = route ? t.marketingPages[route] : t.meta;
  const title = route ? `${copy.title} — GigLedger` : copy.title;
  const content = route === "product" ? `
    <main id="main" data-product-view>
      <section class="shell product-intro">
        <h1>${esc(copy.title)}</h1>
        <p>${esc(copy.description)}</p>
      </section>
      <nav class="public-nav product-nav shell" aria-label="${esc(t.nav.features)}">
        ${[["features", t.nav.features], ["daily", t.nav.daily], ["decisions", t.nav.examples], ["how", t.nav.how]].map(([key, name]) =>
          `<a href="#${key}" data-product-tab="${key}"${key === "features" ? ' aria-current="location"' : ""}>${esc(name)}</a>`).join("")}
      </nav>
      <div data-product-panel="features">${featuresSection(t)}</div>
      <div data-product-panel="daily" hidden>${dailySection(t)}</div>
      <div data-product-panel="decisions" hidden>${productBlocksSection(t)}</div>
      <div data-product-panel="how" hidden>
        ${stepsSection(t)}
        <details class="shell product-notes">
          <summary>${esc(t.nav.about)}</summary>
          ${audienceSection(t)}
          ${honestySection(t)}
        </details>
      </div>
    ` : route === "pricing" ? `<main id="main">${pricingSection(t)}`
      : route === "faq" ? `<main id="main">${faqSection(t)}`
      : `
        ${hero(t, locale)}
        ${dailySection(t)}
        ${productLinks(t)}
        ${faqSection(t, "h2")}
      `;
  return `<!doctype html>
<html lang="${locale.htmlLang}" dir="${locale.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(copy.description)}">
  <link rel="canonical" href="${siteUrl}/${locale.folder}/${suffix}">
  ${alternateLinks(suffix)}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="GigLedger">
  <meta property="og:title" content="${esc(copy.ogTitle || copy.title)}">
  <meta property="og:description" content="${esc(copy.ogDescription || copy.description)}">
  <meta property="og:url" content="${siteUrl}/${locale.folder}/${suffix}">
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
  <link rel="stylesheet" href="/styles.css?v=20261127-01">
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "GigLedger",
    url: `${siteUrl}/`,
    inLanguage: [locale.htmlLang],
    description: copy.description,
  }).replaceAll("</", "<\\/")}
  </script>
</head>
<body class="locale-${locale.code.toLowerCase()} ${route ? "site-detail" : "site-short"}">
  <a class="skip-link" href="#main">${esc(t.skip)}</a>
  ${route ? nav(t, locale, route) : landingNav(t, locale)}
  ${content}
  ${route ? footer(t) : landingFooter(t, locale)}
  <script src="/app.js?v=20261127-01" defer></script>
</body>
</html>`;
};

for (const locale of locales) {
  const t = messages[locale.code];
  const folder = join(root, locale.folder);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "index.html"), cleanHtml(page({ locale, t })));
  for (const route of ["product", "pricing", "faq"]) {
    await mkdir(join(folder, route), { recursive: true });
    await writeFile(join(folder, route, "index.html"), cleanHtml(page({ locale, t, route })));
  }
  await writeFile(
    join(folder, "privacy.html"),
    cleanHtml(legalPage({ locale, t, type: "privacy" })),
  );
  await writeFile(
    join(folder, "tax-disclaimer.html"),
    cleanHtml(legalPage({ locale, t, type: "disclaimer" })),
  );
  await mkdir(join(folder, "app"), { recursive: true });
  await writeFile(join(folder, "app", "index.html"), cleanHtml(appPage({ locale, t })));
  await mkdir(join(folder, "dashboard"), { recursive: true });
  await writeFile(join(folder, "dashboard", "index.html"), cleanHtml(appPage({ locale, t, mode: "dashboard" })));
}

await writeFile(
  join(root, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>GigLedger</title><link rel="canonical" href="${siteUrl}/en/"><meta http-equiv="refresh" content="0;url=/en/"><script>location.replace("/en/"+location.search+location.hash)</script></head><body><p><a href="/en/">GigLedger</a></p></body></html>`,
);

await writeFile(
  join(root, "robots.txt"),
  `User-agent: *\nAllow: /\n${["app/", "dashboard/"].flatMap((suffix) =>
    locales.map((locale) => `Disallow: ${localePath(locale, suffix)}`)).join("\n")}\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
);

await writeFile(
  join(root, "_redirects"),
  ["thanks", "app", "privacy", "tax-disclaimer"].flatMap((page) => locales.map((locale) =>
    `${localePath(locale, page + ".html")} ${localePath(locale, page === "thanks" ? "" : page)} 308\n`)).join(""),
);

const indexablePages = ["", "product/", "pricing/", "faq/", "privacy", "tax-disclaimer"];
await writeFile(
  join(root, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${locales
  .flatMap((locale) =>
    indexablePages.map(
      (file) => `  <url>
    <loc>${siteUrl}/${locale.folder}/${file}</loc>
    ${alternateUrls(file).map(([lang, href]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`).join("\n    ")}
  </url>`,
    ),
  )
  .join("\n")}
</urlset>
`,
);

const dist = join(root, "dist");
const publicFiles = [
  "_redirects", "index.html", "robots.txt", "sitemap.xml",
  "app.js", "app-ledger.js", "app-store.js", "billing-calendar.js", "ledger-report.js", "money.js", "styles.css", "proto.css",
  "assets/favicon-32.png", "assets/logo-mark-192.png", "assets/logo-mark-64.png", "assets/og.png",
  ...locales.flatMap(({ folder }) =>
    ["index.html", "privacy.html", "tax-disclaimer.html", "app/index.html", "dashboard/index.html", "product/index.html", "pricing/index.html", "faq/index.html"]
      .map((name) => join(folder, name)),
  ),
];
await rm(dist, { recursive: true, force: true });
for (const name of publicFiles) {
  const destination = join(dist, name);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(root, name), destination);
}
await writeFile(join(dist, "404.html"),
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found | GigLedger</title><link rel="stylesheet" href="/styles.css?v=20261127-01"></head><body><main class="shell"><h1>404</h1><p>Page not found. <span lang="zh-Hant-TW">找不到頁面。</span> <span lang="zh-Hans-CN">找不到页面。</span></p><p><a class="text-link" href="/en/">Home</a> · <a class="text-link" href="/zh-TW/" lang="zh-Hant-TW">回首頁</a> · <a class="text-link" href="/zh-CN/" lang="zh-Hans-CN">返回首页</a></p></main></body></html>\n',
);

console.log(
  `Built ${locales.length * 8} pages with ${Object.keys(messages).length} locales.`,
);
