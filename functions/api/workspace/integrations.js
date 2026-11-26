import { AppStoreReportError, appStoreDefaults, downloadAppStoreReport, loadAppStoreFinance, readAppStoreCredential } from "../../lib/app-store-reports.js";
import { encryptCredential } from "../../lib/integration-credentials.js";
import { stripeTransactions } from "../../lib/stripe.js";
import { loadWorkspace, normalizeDraft, saveWorkspaceDraft } from "../../lib/ledger.js";
import { readAuthenticatedUserId } from "../../lib/session.js";
import { planFeatures } from "../../lib/plan.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

const plan = async (db, workspaceId) => {
  const workspace = await db.prepare("SELECT plan FROM workspaces WHERE id = ?").bind(workspaceId).first();
  return planFeatures(workspace?.plan);
};

const upsertIntegration = async (db, workspaceId, type, credential, label, secret, status = "connected", vendorNumber = null) => {
  const timestamp = new Date().toISOString();
  const encrypted = await encryptCredential(credential, secret);
  const saved = await db.prepare(
    `INSERT INTO integrations
      (id, workspace_id, type, status, account_label, encrypted_credentials, created_at, updated_at, report_vendor_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(workspace_id, type) DO UPDATE SET status = excluded.status, account_label = excluded.account_label,
       encrypted_credentials = excluded.encrypted_credentials, last_error = NULL, revoked_at = NULL,
       last_sync_at = CASE WHEN report_vendor_number IS excluded.report_vendor_number THEN last_sync_at ELSE NULL END,
       updated_at = excluded.updated_at, report_vendor_number = excluded.report_vendor_number
     RETURNING id`,
  ).bind(crypto.randomUUID(), workspaceId, type, status, label, encrypted, timestamp, timestamp, vendorNumber).first();
  return saved.id;
};

export const onRequestGet = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const workspace = await env.DB.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(userId).first();
  if (!workspace) return json({ authenticated: true, integrations: [] });
  const features = await plan(env.DB, workspace.id);
  const [integrations, financeReports] = await Promise.all([
    env.DB.prepare(
      "SELECT type, status, account_label, last_sync_at, last_error, report_vendor_number FROM integrations WHERE workspace_id = ?",
    ).bind(workspace.id).all(),
    loadAppStoreFinance(env.DB, workspace.id),
  ]);
  return json({
    authenticated: true,
    features,
    financeReports,
    appStoreDefaults: appStoreDefaults(),
    integrations: (integrations.results || []).map((item) => ({
      type: item.type,
      status: item.status,
      accountLabel: item.account_label,
      vendorNumber: item.report_vendor_number,
      lastSyncAt: item.last_sync_at,
      lastError: item.last_error,
    })),
  });
};

const saveStripeTransactions = async (env, workspaceId, integrationId, transactions) => {
  const normalized = await Promise.all(transactions.map((item) => normalizeDraft({ income: [item] })));
  const entries = normalized.map((item) => item.income[0]).filter(Boolean);
  await saveWorkspaceDraft(env, workspaceId, { fixedCosts: [], income: entries, expenses: [], taxReserveRate: null, cashOnHand: null });
  await env.DB.prepare("UPDATE integrations SET last_sync_at = ?, last_error = NULL, updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), new Date().toISOString(), integrationId).run();
  return entries.length;
};

export const onRequestPost = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const workspace = await env.DB.prepare(
    "SELECT w.id, u.timezone FROM workspaces w JOIN users u ON u.id = w.owner_id WHERE u.id = ?",
  ).bind(userId).first();
  if (!workspace) return json({ error: "workspace_not_found" }, 404);
  const features = await plan(env.DB, workspace.id);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const type = payload?.type;
  if (!["stripe", "app_store"].includes(type)) return json({ error: "unsupported_integration" }, 400);
  if (!(type === "app_store" ? features.appStoreSync : features.sync)) return json({ error: "pro_required" }, 403);
  if (type === "app_store") {
    try {
      const credential = readAppStoreCredential(payload);
      const defaults = appStoreDefaults();
      const results = await Promise.all([
        downloadAppStoreReport(credential, "sales", defaults.sales),
        downloadAppStoreReport(credential, "finance", defaults.finance),
      ]);
      const available = results.some(Boolean);
      const status = available ? "connected" : "pending";
      await upsertIntegration(
        env.DB, workspace.id, type, JSON.stringify(credential), "App Store Connect",
        env.SESSION_SECRET || env.GOOGLE_CLIENT_SECRET, status, credential.vendorNumber,
      );
      return json({ authenticated: true, status, vendorNumber: credential.vendorNumber });
    } catch (error) {
      const expected = error instanceof AppStoreReportError;
      return json({
        error: expected ? error.message : "app_store_connect_failed",
      }, expected ? error.status : 500);
    }
  }
  const secretKey = String(payload?.secretKey || "").trim();
  if (!secretKey.startsWith("rk_") && !secretKey.startsWith("sk_")) {
    return json({ error: "invalid_stripe_key" }, 400);
  }
  let integrationId;
  try {
    integrationId = await upsertIntegration(
      env.DB,
      workspace.id,
      type,
      secretKey,
      payload.accountLabel || "Stripe restricted key",
      env.SESSION_SECRET || env.GOOGLE_CLIENT_SECRET,
    );
  } catch {
    return json({ error: "credential_store_failed" }, 500);
  }

  try {
    const imported = await saveStripeTransactions(env, workspace.id, integrationId, await stripeTransactions(secretKey, workspace.timezone));
    return json({ authenticated: true, imported, ledger: await loadWorkspace(env.DB, workspace.id) });
  } catch (error) {
    const message = error?.message || "stripe_sync_failed";
    try {
      await env.DB.prepare("UPDATE integrations SET last_error = ?, updated_at = ? WHERE id = ?")
        .bind(message, new Date().toISOString(), integrationId).run();
    } catch {}
    return json({ error: message, code: "stripe_sync_failed" }, 400);
  }
};

export const onRequestDelete = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const workspace = await env.DB.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(userId).first();
  if (!workspace) return json({ error: "workspace_not_found" }, 404);
  const type = new URL(request.url).searchParams.get("type");
  if (!["stripe", "app_store"].includes(type)) return json({ error: "unsupported_integration" }, 400);
  await env.DB.prepare("DELETE FROM integrations WHERE workspace_id = ? AND type = ?").bind(workspace.id, type).run();
  return json({ authenticated: true, deleted: type });
};
