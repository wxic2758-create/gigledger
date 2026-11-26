import { stripeTransactions } from "../../../lib/stripe.js";
import { loadWorkspace, normalizeDraft, saveWorkspaceDraft } from "../../../lib/ledger.js";
import { readAuthenticatedUserId } from "../../../lib/session.js";
import { planFeatures } from "../../../lib/plan.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

const base64UrlDecode = (value) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));

const decryptCredential = async (value, secret) => {
  const [saltPart, ivPart, dataPart] = String(value).split(".");
  if (!saltPart || !ivPart || !dataPart) throw new Error("invalid_credential");
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: base64UrlDecode(saltPart), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlDecode(ivPart) },
    key,
    base64UrlDecode(dataPart),
  );
  return new TextDecoder().decode(decrypted);
};

export const onRequestPost = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const workspace = await env.DB.prepare(
    "SELECT w.id, u.timezone FROM workspaces w JOIN users u ON u.id = w.owner_id WHERE u.id = ?",
  ).bind(userId).first();
  if (!workspace) return json({ error: "workspace_not_found" }, 404);
  const record = await env.DB.prepare("SELECT plan FROM workspaces WHERE id = ?").bind(workspace.id).first();
  if (!planFeatures(record?.plan).sync) return json({ error: "pro_required" }, 403);
  const type = new URL(request.url).searchParams.get("type") || "stripe";
  if (type === "app_store") {
    return json({ error: "app_store_report_sync_not_configured" }, 501);
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
