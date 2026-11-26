import { AppStoreReportError, downloadAppStoreReport, loadAppStoreFinance, saveAppStoreReport, validReportPeriod } from "../../../lib/app-store-reports.js";
import { decryptCredential } from "../../../lib/integration-credentials.js";
import { stripeTransactions } from "../../../lib/stripe.js";
import { loadWorkspace, normalizeDraft, saveWorkspaceDraft } from "../../../lib/ledger.js";
import { readAuthenticatedUserId } from "../../../lib/session.js";
import { planFeatures } from "../../../lib/plan.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

async function syncAppStore(env, workspace, request) {
  const payload = await request.json().catch(() => null);
  if (!validReportPeriod(payload?.kind, payload?.period)) return json({ error: "invalid_app_store_period" }, 400);
  const integration = await env.DB.prepare(
    "SELECT id, report_vendor_number, encrypted_credentials FROM integrations WHERE workspace_id = ? AND type = 'app_store'",
  ).bind(workspace.id).first();
  if (!integration?.report_vendor_number) return json({ error: "app_store_not_connected" }, 400);
  try {
    const credential = JSON.parse(await decryptCredential(integration.encrypted_credentials, env.SESSION_SECRET || env.GOOGLE_CLIENT_SECRET));
    if (credential.vendorNumber !== integration.report_vendor_number) throw new Error("vendor_mismatch");
    const report = await downloadAppStoreReport(credential, payload.kind, payload.period);
    if (!report) return json({ available: false });
    await saveAppStoreReport(env.DB, workspace, integration, payload.kind, payload.period, report);
    if (payload.kind === "sales") return json({
      available: true, salesRows: report.salesRows, skippedCurrencies: report.skippedCurrencies,
      ledger: await loadWorkspace(env.DB, workspace.id),
    });
    return json({ available: true, financeReports: await loadAppStoreFinance(env.DB, workspace.id) });
  } catch (error) {
    const expected = error instanceof AppStoreReportError;
    const code = expected ? error.message : "app_store_sync_failed";
    await env.DB.prepare("UPDATE integrations SET last_error = ? WHERE id = ? AND encrypted_credentials = ?")
      .bind(code, integration.id, integration.encrypted_credentials).run();
    return json({ error: code, ...(expected ? error.context : {}) }, expected ? error.status : 500);
  }
}

export const onRequestPost = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const workspace = await env.DB.prepare(
    "SELECT w.id, w.apple_fee_rate, u.timezone FROM workspaces w JOIN users u ON u.id = w.owner_id WHERE u.id = ?",
  ).bind(userId).first();
  if (!workspace) return json({ error: "workspace_not_found" }, 404);
  const record = await env.DB.prepare("SELECT plan FROM workspaces WHERE id = ?").bind(workspace.id).first();
  const features = planFeatures(record?.plan);
  const type = new URL(request.url).searchParams.get("type") || "stripe";
  if (!(type === "app_store" ? features.appStoreSync : features.sync)) return json({ error: "pro_required" }, 403);
  if (type === "app_store") {
    return syncAppStore(env, workspace, request);
  }
  if (type !== "stripe") return json({ error: "unsupported_integration" }, 400);
  const integration = await env.DB.prepare(
    "SELECT id, encrypted_credentials FROM integrations WHERE workspace_id = ? AND type = 'stripe' AND status = 'connected'",
  ).bind(workspace.id).first();
  if (!integration) return json({ error: "stripe_not_connected" }, 400);
  let secretKey;
  try {
    secretKey = await decryptCredential(integration.encrypted_credentials, env.SESSION_SECRET || env.GOOGLE_CLIENT_SECRET);
  } catch {
    return json({ error: "credential_decrypt_failed" }, 500);
  }
  try {
    const transactions = await stripeTransactions(secretKey, workspace.timezone);
    const normalized = await Promise.all(transactions.map((item) => normalizeDraft({ income: [item] })));
    const entries = normalized.map((item) => item.income[0]).filter(Boolean);
    await saveWorkspaceDraft(env, workspace.id, {
      fixedCosts: [],
      income: entries,
      expenses: [],
      taxReserveRate: null,
      cashOnHand: null,
    });
    const timestamp = new Date().toISOString();
    await env.DB.prepare("UPDATE integrations SET last_sync_at = ?, last_error = NULL, updated_at = ? WHERE id = ?")
      .bind(timestamp, timestamp, integration.id).run();
    return json({ authenticated: true, imported: entries.length, ledger: await loadWorkspace(env.DB, workspace.id) });
  } catch (error) {
    const message = error?.message || "stripe_sync_failed";
    try {
      await env.DB.prepare("UPDATE integrations SET last_error = ?, updated_at = ? WHERE id = ?")
        .bind(message, new Date().toISOString(), integration.id).run();
    } catch {}
    return json({ error: message, code: "stripe_sync_failed" }, 400);
  }
};
