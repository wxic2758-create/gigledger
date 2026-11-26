import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { onRequestPost as startGoogleSave } from "../functions/api/auth/google.js";
import { onRequestGet as googleCallback } from "../functions/api/auth/google/callback.js";
import { onRequestGet as getMe } from "../functions/api/me.js";
import { onRequestDelete as removeEntry, onRequestPost as updateWorkspace, onRequestPut as editEntry } from "../functions/api/workspace.js";
import { onRequestGet as exportCsv, onRequestPost as importCsv } from "../functions/api/workspace/csv.js";
import { loadWorkspace, normalizeDraft, saveFixedCostRevision, saveWorkspaceDraft } from "../functions/lib/ledger.js";
import { createSessionToken, sessionCookie } from "../functions/lib/session.js";
import { answerForPeriod, consecutiveUnused, dayInTimeZone, subscriptionTiming } from "../billing-calendar.js";
import { buildReport, projectTotals } from "../ledger-report.js";
import { minorUnits } from "../money.js";
import { stripeTransactions } from "../functions/lib/stripe.js";
import { onRequestGet as getIntegrations, onRequestPost as connectIntegration, onRequestDelete as disconnectIntegration } from "../functions/api/workspace/integrations.js";
import { onRequestPost as syncIntegration } from "../functions/api/workspace/integrations/sync.js";
import { onRequestPost as confirmPayout } from "../functions/api/workspace/integrations/app-store-payout.js";

const origin = "https://gigledger.xyz";

function fixture(t, { migrateMinorUnits = true } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("PRAGMA foreign_keys = ON");
  const migrations = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(migrations).sort()) {
    if (!migrateMinorUnits && name === "0011_ledger_minor_units.sql") break;
    sqlite.exec(readFileSync(new URL(name, migrations), "utf8"));
  }
  const DB = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...args) {
          return {
            first: () => statement.get(...args) ?? null,
            all: () => ({ results: statement.all(...args) }),
            run: () => ({ meta: statement.run(...args) }),
          };
        },
      };
    },
    batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const result = statements.map((statement) => statement.run());
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const env = { DB, SESSION_SECRET: "fixture-session", GOOGLE_CLIENT_ID: "fixture-client", GOOGLE_CLIENT_SECRET: "fixture-secret" };
  return { sqlite, env };
}

test("report components round in cents after proration, with pace based on the published Daily Floor", () => {
  assert.equal(minorUnits("1.005"), 101);
  assert.equal(minorUnits("2.675"), 268);
  assert.equal(minorUnits("-1.005"), -101);
  const ledger = {
    income: [{ date: "2026-11-01", amount: 200, platformFee: 0, projects: ["Studio"] }],
    fixedCosts: [{ amount: 900, cycle: "monthly", businessUse: 100, startDate: "2026-11-01",
      allocation: [{ name: "Studio", percent: 100 }] }],
    expenses: [1, 2].map(() => ({ date: "2026-11-06", amount: 0.01, businessUse: 50, projects: ["Studio"] })),
    cashOnHand: "8000",
    taxReserveRate: "28",
  };
  const report = buildReport(ledger, "2026-11-13");
  assert.equal(report.dailyFloor, 29.59);
  assert.equal(report.requiredToDate, 384.67);
  assert.equal(report.comparison, -184.67);
  assert.equal(report.monthlyExpenses, 0.02);
  assert.equal(report.trueProfit, -700.02);
  assert.equal(report.taxReserve, 56);
  assert.equal(report.noNewWorkRunway, 270);
  assert.deepEqual(projectTotals(ledger, "2026-11").get("Studio"), { income: 200, costs: 900.02, profit: -700.02 });
  assert.equal(buildReport(ledger, "2026-11-13", "2026-10").trueProfit, 0);

  ledger.fixedCosts[0] = {
    amount: 1, cycle: "monthly", businessUse: 100, startDate: "2028-02-01", endDate: "2028-02-15",
    versions: [{ effectiveFrom: "2028-02-01", effectiveTo: null, amount: 1, cycle: "monthly", businessUse: 100 }],
  };
  assert.equal(buildReport(ledger, "2028-02-15").monthlyFixedCosts, 0.52);
});

test("D1 minor units retain old records and write integer cents for all new amount fields", async (t) => {
  const { env, sqlite } = fixture(t, { migrateMinorUnits: false });
  const owner = await account(sqlite, env, "owner");
  sqlite.prepare(`INSERT INTO income_entries
    (id, workspace_id, external_ref, occurred_on, source, amount, platform_fee, created_at, updated_at)
    VALUES ('old', ?, 'old', '2026-10-31', 'direct', 10.10, 1.005, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
    .run(owner.workspace);
  sqlite.exec(readFileSync(new URL("../migrations/0011_ledger_minor_units.sql", import.meta.url), "utf8"));
  const saved = sqlite.prepare("SELECT amount, amount_cents, platform_fee, platform_fee_cents FROM income_entries WHERE id = 'old'").get();
  assert.equal(saved.amount_cents, 1010);
  assert.equal(saved.platform_fee_cents, null);
  assert.equal(saved.platform_fee, 1.005);
  const [old] = (await loadWorkspace(env.DB, owner.workspace)).income;
  assert.equal(old.platformFee, 1.01);
  assert.equal(old.date, "2026-10-31");

  await saveWorkspaceDraft(env, owner.workspace, await normalizeDraft({
    timeZone: "Asia/Shanghai", cashOnHand: "2.675", monthlyIncomeEstimate: "4.005", appleFeeRate: 15,
    fixedCosts: [{ name: "Monthly gear", amount: "2.675", cycle: "monthly", startDate: "2026-11-01" }],
    income: [{ date: "2026-11-01", source: "app_store", recognition: "sold", amount: "0.10", externalRef: "new" }],
    expenses: [{ date: "2026-11-02", category: "Gear", amount: "3.005" }],
  }));
  const ledger = await loadWorkspace(env.DB, owner.workspace);
  const [cost] = ledger.fixedCosts;
  assert.equal(sqlite.prepare("SELECT amount_cents FROM fixed_costs").get().amount_cents, 268);
  assert.equal(sqlite.prepare("SELECT amount_cents FROM fixed_cost_versions").get().amount_cents, 268);
  assert.equal(sqlite.prepare("SELECT amount_cents FROM expenses").get().amount_cents, 301);
  assert.equal(sqlite.prepare("SELECT platform_fee_cents FROM income_entries WHERE external_ref = 'new'").get().platform_fee_cents, 2);
  assert.equal(sqlite.prepare("SELECT cash_on_hand_cents FROM workspaces").get().cash_on_hand_cents, 268);
  assert.equal(sqlite.prepare("SELECT monthly_income_estimate_cents FROM workspaces").get().monthly_income_estimate_cents, 401);
  for (const amount of ["1.005", "1.015"]) {
    await saveFixedCostRevision(env, owner.workspace, {
      fixedCostId: cost.id, name: cost.name, effectiveFrom: "2026-11-02",
      cycle: "monthly", businessUse: 100, amount,
    }, "Asia/Shanghai");
  }
  assert.equal(sqlite.prepare("SELECT amount_cents FROM fixed_cost_versions WHERE effective_from = '2026-11-02'").get().amount_cents, 102);

  sqlite.prepare("UPDATE income_entries SET amount = 20.2 WHERE id = 'old'").run();
  const legacyWrite = (await loadWorkspace(env.DB, owner.workspace)).income.find((item) => item.id === "old");
  assert.equal(legacyWrite.amount, 20.2);
});

test("a saved reporting zone wins over the device zone and sets Stripe date boundaries", async (t) => {
  const { env, sqlite } = fixture(t);
  const owner = await account(sqlite, env, "owner");
  const post = (payload) => updateWorkspace({
    env,
    request: new Request(`${origin}/api/workspace`, { method: "POST", headers: { cookie: owner.cookie }, body: JSON.stringify(payload) }),
  });
  assert.equal((await post({ initTimeZone: "invalid zone" })).status, 400);
  assert.equal((await post({ initTimeZone: "Asia/Shanghai" })).status, 200);
  const secondDevice = await post({ initTimeZone: "America/Los_Angeles" });
  assert.equal((await secondDevice.json()).ledger.workspace.timeZone, "Asia/Shanghai");
  const settings = { cashOnHand: "", taxReserveRate: "", monthlyIncomeEstimate: "", appleFeeRate: "" };
  const updated = await post({ settings: { ...settings, timeZone: "America/Los_Angeles" } });
  assert.equal((await updated.json()).ledger.workspace.timeZone, "America/Los_Angeles");

  const instant = new Date("2026-10-31T16:30:00Z");
  assert.equal(dayInTimeZone(instant, "Asia/Shanghai"), "2026-11-01");
  assert.equal(dayInTimeZone(instant, "America/Los_Angeles"), "2026-10-31");
  t.mock.method(globalThis, "fetch", async () => Response.json({
    data: [{ id: "txn_test", currency: "usd", created: instant.getTime() / 1000, amount: 268, fee: 23 }],
    has_more: false,
  }));
  const [stripe] = await stripeTransactions("fixture", "Asia/Shanghai");
  assert.equal(stripe.date, "2026-11-01");
  assert.equal(stripe.amount, 2.68);
  assert.equal(stripe.platformFee, 0.23);
});

async function account(sqlite, env, name) {
  const workspace = `workspace-${name}`;
  sqlite.prepare(
    "INSERT INTO users (id, google_sub, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
  ).run(name, name, `${name}@example.invalid`, name);
  sqlite.prepare(
    "INSERT INTO workspaces (id, owner_id, name, plan, created_at, updated_at) VALUES (?, ?, ?, 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
  ).run(workspace, name, name);
  const token = await createSessionToken(name, env.SESSION_SECRET);
  return { workspace, cookie: sessionCookie(token).split(";")[0] };
}

test("App Store self-service verifies a team key, syncs each report, and only counts a confirmed payment", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-26T09:00:00Z") });
  const { env, sqlite } = fixture(t);
  const owner = await account(sqlite, env, "app-store-owner");
  const other = await account(sqlite, env, "unrelated");
  const free = await account(sqlite, env, "free");
  sqlite.prepare("UPDATE workspaces SET plan = 'free' WHERE id = ?").run(free.workspace);
  sqlite.prepare("UPDATE workspaces SET apple_fee_rate = 0.15 WHERE id = ?").run(owner.workspace);
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const raw = Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64");
  const privateKey = `-----BEGIN PRIVATE KEY-----\n${raw}\n-----END PRIVATE KEY-----`;
  const key = { type: "app_store", privateKey, issuerId: "11111111-1111-4111-8111-111111111111", keyId: "TESTKEY123", vendorNumber: "80012345" };
  let appleMode = "valid";
  let appleRequests = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    appleRequests++;
    if (url.hostname === "reports-cdn.apple.com") {
      assert.equal(options.headers.Authorization, undefined);
      const [year, month, day] = url.searchParams.get("day").split("-");
      const date = `${month}/${day}/${year}`;
      return new Response(gzipSync(`Begin Date\tEnd Date\tUnits\tCustomer Price\tCustomer Currency\n${date}\t${date}\t1\t1.00\tUSD\n`));
    }
    assert.equal(url.origin, "https://api.appstoreconnect.apple.com");
    const endpoint = url.pathname;
    const [header, payload, signature] = options.headers.Authorization.slice(7).split(".");
    const token = JSON.parse(Buffer.from(payload, "base64url").toString());
    assert.deepEqual(token.scope, [`GET ${endpoint}`]);
    assert.equal(token.iss, key.issuerId);
    assert.equal(token.exp - token.iat, 300);
    assert.equal(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey,
      Buffer.from(signature, "base64url"), Buffer.from(`${header}.${payload}`)), true);
    assert.equal(url.searchParams.get("filter[vendorNumber]"), key.vendorNumber);
    if (appleMode === "denied") return Response.json({ details: "untrusted response body" }, { status: 403 });
    if (appleMode === "upstream") return endpoint === "/v1/salesReports" ? new Response(null, { status: 404 })
      : Response.json({ errors: [{ code: "PARAMETER_ERROR.INVALID", detail: "private diagnostic text" }] }, { status: 400 });
    if (appleMode === "missing") return new Response(null, { status: 404 });
    if (appleMode === "malformed") return new Response("unknown\theaders\n");
    if (endpoint === "/v1/salesReports" && (appleMode === "redirect" || appleMode === "unsafe_redirect")) {
      assert.equal(options.redirect, "manual");
      const host = appleMode === "redirect" ? "reports-cdn.apple.com" : "untrusted.example";
      return new Response(null, { status: 307, headers: {
        location: `https://${host}/sales.gz?day=${url.searchParams.get("filter[reportDate]")}`,
      } });
    }
    let report;
    if (endpoint === "/v1/salesReports") {
      assert.equal(url.searchParams.get("filter[frequency]"), "DAILY");
      const [year, month, day] = url.searchParams.get("filter[reportDate]").split("-");
      const date = `${month}/${day}/${year}`;
      report = [
        "Begin Date\tEnd Date\tUnits\tCustomer Price\tCustomer Currency",
        `${date}\t${date}\t1\t99.99\tUSD`,
        `${date}\t${date}\t-1\t-.99\tUSD`,
        `${date}\t${date}\t0\t-.11\tUSD`,
        `${date}\t${date}\t1\t12\tEUR`,
      ].join("\n");
    } else {
      assert.equal(endpoint, "/v1/financeReports");
      assert.equal(url.searchParams.get("filter[regionCode]"), "ZZ");
      assert.equal(url.searchParams.get("filter[reportType]"), "FINANCIAL");
      report = [
        "Fiscal report",
        "Start Date\tEnd Date\tExtended Partner Share\tPartner Share Currency",
        "09/27/2026\t10/31/2026\t80.51\tUSD",
        "09/27/2026\t10/31/2026\t-3.02\tUSD",
        "09/27/2026\t10/31/2026\t30\tEUR",
      ].join("\r\n");
    }
    return new Response(gzipSync(report), { headers: { "content-type": "application/a-gzip" } });
  });
  const call = (handler, actor, { url = "", method = "POST", body } = {}) => handler({
    env,
    request: new Request(`${origin}/api/workspace/integrations${url}`, {
      method, headers: { cookie: actor.cookie, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  });
  assert.equal((await call(connectIntegration, free, { body: key })).status, 403);
  assert.equal(appleRequests, 0);
  appleMode = "denied";
  const denied = await call(connectIntegration, other, { body: key });
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { error: "app_store_permission_denied" });
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM integrations").get().count, 0);
  appleMode = "upstream";
  const upstream = await call(connectIntegration, other, { body: key });
  assert.equal(upstream.status, 424);
  assert.deepEqual(await upstream.json(), {
    error: "app_store_download_failed", reportKind: "finance", appleStatus: 400, appleCode: "PARAMETER_ERROR.INVALID",
  });
  appleMode = "unsafe_redirect";
  const unsafe = await call(connectIntegration, other, { body: key });
  assert.equal(unsafe.status, 424);
  assert.deepEqual(await unsafe.json(), {
    error: "app_store_unreachable", reportKind: "sales", transport: "redirect", redirectHost: "untrusted.example",
  });
  appleMode = "redirect";
  const connected = await call(connectIntegration, owner, { body: key });
  assert.equal(connected.status, 200);
  assert.deepEqual(await connected.json(), { authenticated: true, status: "connected", vendorNumber: "80012345" });
  assert.ok(!sqlite.prepare("SELECT encrypted_credentials FROM integrations").get().encrypted_credentials.includes(raw));
  assert.equal((await loadWorkspace(env.DB, owner.workspace)).income.length, 0);
  appleMode = "valid";

  const sync = (kind, period) => call(syncIntegration, owner, { url: "/sync?type=app_store", body: { kind, period } });
  for (let attempt = 0; attempt < 2; attempt++) {
    const sales = await sync("sales", "2026-11-16");
    assert.equal(sales.status, 200);
    const saleData = await sales.json();
    assert.equal(saleData.salesRows, 3);
    assert.equal(saleData.skippedCurrencies, 1);
    assert.equal(saleData.ledger.income.length, 1);
    assert.equal(saleData.ledger.income[0].recognition, "sold");
    assert.equal(saleData.ledger.income[0].platformFee, 14.83);
    const finance = await sync("finance", "2026-10");
    assert.equal(finance.status, 200);
    const { financeReports } = await finance.json();
    assert.equal(financeReports.length, 1);
    assert.deepEqual(financeReports[0].proceeds, [{ currency: "EUR", cents: 3000 }, { currency: "USD", cents: 7749 }]);
    assert.equal(financeReports[0].receivedOn, null);
  }
  const soldOnly = buildReport({ ...(await loadWorkspace(env.DB, owner.workspace)), cashOnHand: "", taxReserveRate: "" }, "2026-11-26");
  assert.equal(soldOnly.soldIncome, 98.89);
  assert.equal(soldOnly.appStoreReceived, 0);
  assert.equal(soldOnly.trueProfit, 0);
  appleMode = "malformed";
  assert.equal((await sync("sales", "2026-11-16")).status, 422);
  appleMode = "missing";
  assert.deepEqual(await (await sync("finance", "2026-11")).json(), { available: false });

  const payout = { vendorNumber: key.vendorNumber, period: "2026-10", date: "2026-11-19", amount: "76.00" };
  assert.equal((await call(confirmPayout, other, { url: "/app-store-payout", body: payout })).status, 404);
  assert.equal((await call(confirmPayout, owner, { url: "/app-store-payout", body: { ...payout, date: "2026-12-01" } })).status, 400);
  for (let attempt = 0; attempt < 2; attempt++) {
    const confirmed = await call(confirmPayout, owner, { url: "/app-store-payout", body: payout });
    assert.equal(confirmed.status, 200);
    const { ledger, financeReports } = await confirmed.json();
    assert.equal(financeReports[0].receivedCents, 7600);
    assert.equal(ledger.income.length, 2);
    const withDeposit = buildReport({ ...ledger, cashOnHand: "", taxReserveRate: "" }, "2026-11-26");
    assert.equal(withDeposit.soldIncome, 98.89);
    assert.equal(withDeposit.appStoreReceived, 76);
    assert.equal(withDeposit.trueProfit, 76);
  }
  assert.equal((await call(disconnectIntegration, owner, { method: "DELETE", url: "?type=app_store" })).status, 200);
  assert.equal((await sync("sales", "2026-11-16")).status, 400);
  const retained = await (await call(getIntegrations, owner, { method: "GET" })).json();
  assert.equal(retained.integrations.length, 0);
  assert.equal(retained.financeReports[0].receivedCents, 7600);
  assert.equal((await loadWorkspace(env.DB, owner.workspace)).income.length, 2);
});

test("fixed-cost deletion is scoped to the owner and removes that owner's child rows", async (t) => {
  const { env, sqlite } = fixture(t);
  const owner = await account(sqlite, env, "owner");
  const other = await account(sqlite, env, "other");
  await saveWorkspaceDraft(env, owner.workspace, await normalizeDraft({
    fixedCosts: [{ name: "Fixture", amount: 10, cycle: "monthly", isSubscription: true }],
  }));
  const { id } = (await loadWorkspace(env.DB, owner.workspace)).fixedCosts[0];
  sqlite.prepare(
    "INSERT INTO subscription_reviews (id, fixed_cost_id, workspace_id, period, answer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
  ).run("review", id, owner.workspace, "2026-11", "often");
  const remove = (cookie) => removeEntry({
    env,
    request: new Request(`${origin}/api/workspace?type=fixed-cost&id=${id}`, { method: "DELETE", headers: { cookie } }),
  });
  assert.equal((await remove(other.cookie)).status, 404);
  const [remaining] = (await loadWorkspace(env.DB, owner.workspace)).fixedCosts;
  assert.equal(remaining.versions.length, 1);
  assert.equal(remaining.reviews.length, 1);
  assert.equal((await remove(owner.cookie)).status, 200);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM fixed_cost_versions").get().total, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM subscription_reviews").get().total, 0);
});

test("billing dates catch up while preserving the original day across short months and leap years", () => {
  const february = subscriptionTiming({ cycle: "monthly", nextBillingDate: "2027-01-31" }, "2027-02-25");
  assert.deepEqual(february, { date: "2027-02-28", daysUntil: 3, reviewPeriod: "2027-02-28" });
  const march = subscriptionTiming({ cycle: "monthly", nextBillingDate: "2027-01-31" }, "2027-03-01");
  assert.equal(march.date, "2027-03-31");
  assert.equal(march.reviewPeriod, null);
  const leap = subscriptionTiming({ cycle: "monthly", nextBillingDate: "2027-01-31" }, "2028-02-29");
  assert.equal(leap.date, "2028-02-29");
  const quarterly = subscriptionTiming({ cycle: "quarterly", nextBillingDate: "2027-01-31" }, "2028-04-01");
  assert.equal(quarterly.date, "2028-04-30");
  const yearly = { cycle: "yearly", nextBillingDate: "2024-02-29" };
  assert.equal(subscriptionTiming(yearly, "2027-02-01").date, "2027-02-28");
  assert.equal(subscriptionTiming(yearly, "2027-03-01").date, "2028-02-29");
  assert.equal(subscriptionTiming({ cycle: "biweekly", nextBillingDate: "2026-01-01" }, "2026-01-30").date, "2026-02-12");
  assert.equal(subscriptionTiming({ cycle: "weekly", nextBillingDate: "2026-01-01", endDate: "2026-01-07" }, "2026-01-05").date, null);
  assert.equal(subscriptionTiming({ cycle: "daily", nextBillingDate: "2026-01-01", startDate: "2026-01-06" }, "2026-01-05").reviewPeriod, null);
});

test("reviews are saved against the billing date in the browser time zone and can be corrected", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2028-02-25T16:30:00Z") });
  const { env, sqlite } = fixture(t);
  const owner = await account(sqlite, env, "owner");
  const other = await account(sqlite, env, "other");
  await saveWorkspaceDraft(env, owner.workspace, await normalizeDraft({
    fixedCosts: [
      { name: "Monthly SaaS", amount: 20, cycle: "monthly", isSubscription: true, startDate: "2027-01-01", nextBillingDate: "2027-01-31" },
      { name: "Rent", amount: 20, cycle: "monthly", startDate: "2027-01-01" },
    ],
  }));
  const { fixedCosts } = await loadWorkspace(env.DB, owner.workspace);
  const subscription = fixedCosts.find(({ name }) => name === "Monthly SaaS");
  const rent = fixedCosts.find(({ name }) => name === "Rent");
  sqlite.prepare(
    "INSERT INTO subscription_reviews (id, fixed_cost_id, workspace_id, period, answer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
  ).run("legacy-review", subscription.id, owner.workspace, "2028-01", "not_used");
  const review = (actor, changes = {}) => editEntry({
    env,
    request: new Request(`${origin}/api/workspace`, {
      method: "PUT",
      headers: { cookie: actor.cookie, "content-type": "application/json" },
      body: JSON.stringify({
        fixedCostId: subscription.id, answer: "not_used", billingPeriod: "2028-02-29", timeZone: "Asia/Shanghai", ...changes,
      }),
    }),
  });
  assert.equal((await review(owner, { timeZone: "America/Los_Angeles" })).status, 409);
  assert.equal((await review(owner, { billingPeriod: "2028-02-28" })).status, 409);
  assert.equal((await review(other)).status, 404);
  assert.equal((await review(owner, { fixedCostId: rent.id })).status, 404);
  for (let attempt = 0; attempt < 2; attempt++) assert.equal((await review(owner)).status, 200);
  const latest = async () => (await loadWorkspace(env.DB, owner.workspace)).fixedCosts.find((item) => item.id === subscription.id);
  const saved = await latest();
  assert.equal(saved.nextBillingDate, "2027-01-31");
  assert.equal(answerForPeriod(saved.reviews, "2028-01-31", "monthly"), "not_used");
  assert.deepEqual(saved.reviews.map(({ period }) => period), ["2028-02-29", "2028-01"]);
  assert.equal(consecutiveUnused(saved), true);
  assert.equal((await review(owner, { answer: "often" })).status, 200);
  assert.equal(consecutiveUnused(await latest()), false);
  sqlite.prepare("UPDATE workspaces SET plan = 'free' WHERE id = ?").run(owner.workspace);
  assert.equal((await review(owner)).status, 403);
});

test("Google save preserves the planning estimate and equal manual payments survive reload and retry", async (t) => {
  const { env } = fixture(t);
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "fixture-token" });
    assert.equal(url, "https://openidconnect.googleapis.com/v1/userinfo");
    return Response.json({ sub: "fixture-google-id", email: "user@example.invalid", name: "Fixture" });
  });
  const save = (payload, cookie = "") => startGoogleSave({
    env,
    request: new Request(`${origin}/api/auth/google?locale=zh-TW`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  });
  const start = await save({ monthlyIncomeEstimate: "400", fixedCosts: [{ name: "Rent", amount: 900, cycle: "monthly" }] });
  assert.equal(start.status, 200);
  const { authUrl } = await start.json();
  const state = new URL(authUrl).searchParams.get("state");
  const callback = await googleCallback({
    env,
    request: new Request(`${origin}/api/auth/google/callback?state=${state}&code=fixture-code`, {
      headers: { cookie: start.headers.get("set-cookie").split(";")[0] },
    }),
  });
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), `${origin}/zh-TW/dashboard`);
  const cookie = callback.headers.get("set-cookie").split(";")[0];
  const reload = async () => {
    const res = await getMe({ env, request: new Request(`${origin}/api/me`, { headers: { cookie } }) });
    assert.equal(res.status, 200);
    return (await res.json()).ledger;
  };
  const before = await reload();
  assert.equal(before.workspace.monthlyIncomeEstimate, 400);
  assert.equal(before.fixedCosts.length, 1);
  assert.equal(before.income.length, 0);
  const income = [1, 2].map((i) => ({
    source: "direct", client: "Same client", date: "2026-11-19", amount: 50, externalRef: `manual:${i}`,
  }));
  for (let attempt = 0; attempt < 2; attempt += 1) assert.equal((await save({ income }, cookie)).status, 200);
  const after = await reload();
  assert.equal(after.income.length, 2);
  assert.equal(after.income.reduce((sum, item) => sum + item.amount, 0), 100);
  assert.equal(after.workspace.monthlyIncomeEstimate, 400);
  assert.equal((await save({ monthlyIncomeEstimate: "0" }, cookie)).status, 200);
  assert.equal((await reload()).workspace.monthlyIncomeEstimate, 0);
  assert.equal((await save({ monthlyIncomeEstimate: "" }, cookie)).status, 200);
  assert.equal((await reload()).workspace.monthlyIncomeEstimate, null);
});

test("editing an expense preserves its identity, validates changes, and checks workspace ownership", async (t) => {
  const { env, sqlite } = fixture(t);
  const owner = await account(sqlite, env, "owner");
  const other = await account(sqlite, env, "other");
  await saveWorkspaceDraft(env, owner.workspace, await normalizeDraft({
    expenses: [{ date: "2026-11-19", category: "Gear", amount: 80, externalRef: "manual:expense" }],
    projects: ["Studio"],
  }));
  await saveWorkspaceDraft(env, other.workspace, await normalizeDraft({ projects: ["Other workspace"] }));
  const [original] = (await loadWorkspace(env.DB, owner.workspace)).expenses;
  const valid = {
    id: original.id, date: "2026-10-10", category: "Equipment", merchant: "Store",
    amount: 125.45, businessUse: 60, notes: "Corrected amount", project: "Studio",
  };
  const edit = (actor, changes) => editEntry({
    env,
    request: new Request(`${origin}/api/workspace`, {
      method: "PUT",
      headers: { cookie: actor.cookie, "content-type": "application/json" },
      body: JSON.stringify({ expense: { ...valid, ...changes } }),
    }),
  });
  assert.equal((await edit(other, { project: "" })).status, 404);
  assert.equal((await edit(owner, { project: "Other workspace" })).status, 400);
  assert.equal((await edit(owner, { date: "2026-02-30" })).status, 400);
  assert.equal((await edit(owner, { amount: null })).status, 400);
  assert.equal((await edit(owner, { businessUse: 101 })).status, 400);
  assert.deepEqual((await loadWorkspace(env.DB, owner.workspace)).expenses, [original]);

  for (let attempt = 0; attempt < 2; attempt++) assert.equal((await edit(owner, {})).status, 200);
  const { expenses } = await loadWorkspace(env.DB, owner.workspace);
  assert.equal(expenses.length, 1);
  assert.deepEqual(expenses[0], { ...original, ...valid, updatedAt: expenses[0].updatedAt });
  assert.equal((await edit(owner, { project: "", notes: "", businessUse: 0 })).status, 200);
  const [cleared] = (await loadWorkspace(env.DB, owner.workspace)).expenses;
  assert.equal(cleared.project, null);
  assert.equal(cleared.notes, null);
  assert.equal(cleared.businessUse, 0);
});

test("income CSV can export only received entries for a selected month", async (t) => {
  const { env, sqlite } = fixture(t);
  const owner = await account(sqlite, env, "owner");
  await saveWorkspaceDraft(env, owner.workspace, await normalizeDraft({ income: [
    { date: "2026-10-31", source: "direct", amount: 90, externalRef: "ref:october" },
    { date: "2026-11-01", source: "direct", amount: 120, externalRef: "ref:november", platformFee: 12 },
    { date: "2026-11-02", source: "app_store", amount: 99, externalRef: "ref:sold", recognition: "sold" },
    { date: "2026-12-01", source: "direct", amount: 200, externalRef: "ref:december" },
  ] }));
  const download = (query = "") => exportCsv({
    env,
    request: new Request(`${origin}/api/workspace/csv?export=income${query}`, { headers: { cookie: owner.cookie } }),
  });
  const selected = await download("&month=2026-11");
  assert.equal(selected.status, 200);
  assert.match(selected.headers.get("content-disposition"), /gigledger-income-2026-11\.csv/);
  assert.match(await selected.text(), /\n2026-11-01,direct,120,USD,12,,,ref:november,\n$/);
  const all = await (await download()).text();
  assert.equal(all.trimEnd().split("\n").length, 4);
  assert.doesNotMatch(all, /ref:sold/);
  assert.equal((await download("&month=2026-13")).status, 400);
  assert.equal((await (await download("&month=2026-01")).text()).trimEnd().split("\n").length, 1);
});

test("CSV imports USD, reports foreign currency and invalid amounts, and deduplicates its export", async (t) => {
  const { env, sqlite } = fixture(t);
  const owner = await account(sqlite, env, "csv");
  const upload = async (csv) => {
    const body = new FormData();
    body.set("file", new Blob([csv], { type: "text/csv" }), "test.csv");
    const res = await importCsv({
      env,
      request: new Request(`${origin}/api/workspace/csv`, { method: "POST", headers: { cookie: owner.cookie }, body }),
    });
    assert.equal(res.status, 200);
    return res.json();
  };
  const data = await upload([
    "date,source,amount,currency,platform_fee",
    "2026-11-19,direct,10000,JPY,0",
    "2026-11-19,direct,50,usd,0",
    "2026-11-19,direct,51,,",
    "2026-11-19,direct,,USD,0",
    "2026-11-19,direct,20,USD,invalid",
  ].join("\n"));
  assert.equal(data.imported, 2);
  assert.equal(data.failed, 3);
  assert.equal(data.failedRows[0].reason, "unsupported_currency");
  assert.equal(data.failedRows[0].row.currency, "JPY");
  assert.equal(data.failedRows[0].row.amount, "10000");
  const exported = await exportCsv({
    env,
    request: new Request(`${origin}/api/workspace/csv?export=income`, { headers: { cookie: owner.cookie } }),
  });
  assert.equal(exported.status, 200);
  assert.equal((await upload(await exported.text())).imported, 0);
  const { income } = await loadWorkspace(env.DB, owner.workspace);
  assert.equal(income.reduce((sum, item) => sum + item.amount, 0), 101);
});

test("workspace settings preserve explicit zero, can be cleared, and do not add income", async (t) => {
  const { env, sqlite } = fixture(t);
  const owner = await account(sqlite, env, "settings");
  const save = (changes) => updateWorkspace({
    env,
    request: new Request(`${origin}/api/workspace`, {
      method: "POST",
      headers: { cookie: owner.cookie, "content-type": "application/json" },
      body: JSON.stringify({ settings: { cashOnHand: "", taxReserveRate: "", monthlyIncomeEstimate: "", appleFeeRate: "", ...changes } }),
    }),
  });

  assert.equal((await save({ cashOnHand: "-1" })).status, 400);
  const saved = await save({ cashOnHand: "0", taxReserveRate: "25", monthlyIncomeEstimate: "2000", appleFeeRate: "15" });
  assert.equal(saved.status, 200);
  const first = await loadWorkspace(env.DB, owner.workspace);
  assert.equal(first.workspace.cashOnHand, 0);
  assert.equal(first.workspace.taxReserveRate, 0.25);
  assert.equal(first.workspace.appleFeeRate, 0.15);
  assert.equal(first.workspace.monthlyIncomeEstimate, 2000);
  assert.deepEqual(first.income, []);

  assert.equal((await save({})).status, 200);
  const { workspace } = await loadWorkspace(env.DB, owner.workspace);
  for (const key of ["cashOnHand", "cashOnHandAsOf", "taxReserveRate", "appleFeeRate", "monthlyIncomeEstimate"]) {
    assert.equal(workspace[key], null, key);
  }
});
