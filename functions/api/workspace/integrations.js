import { loadWorkspace, normalizeDraft, saveWorkspaceDraft } from "../../lib/ledger.js";
import { readAuthenticatedUserId } from "../../lib/session.js";
import { planFeatures } from "../../lib/plan.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

const base64Url = (bytes) => btoa(String.fromCharCode(...bytes))
  .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

const base64UrlDecode = (value) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));

const encryptCredential = async (value, secret) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value)));
  return `${base64Url(salt)}.${base64Url(iv)}.${base64Url(encrypted)}`;
};

const plan = async (db, workspaceId) => {
  const workspace = await db.prepare("SELECT plan FROM workspaces WHERE id = ?").bind(workspaceId).first();
  return planFeatures(workspace?.plan);
};

const upsertIntegration = async (db, workspaceId, type, credential, label, secret) => {
  const timestamp = new Date().toISOString();
  const encrypted = await encryptCredential(credential, secret);
  const existing = await db.prepare("SELECT id FROM integrations WHERE workspace_id = ? AND type = ?")
    .bind(workspaceId, type).first();
  if (existing) {
    await db.prepare(
      `UPDATE integrations
       SET status = 'connected', account_label = ?, encrypted_credentials = ?, last_error = NULL, updated_at = ?, revoked_at = NULL
       WHERE id = ?`,
    ).bind(label, encrypted, timestamp, existing.id).run();
    return existing.id;
  }
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO integrations
      (id, workspace_id, type, status, account_label, encrypted_credentials, created_at, updated_at)
     VALUES (?, ?, ?, 'connected', ?, ?, ?, ?)`,
  ).bind(id, workspaceId, type, label, encrypted, timestamp, timestamp).run();
  return id;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(Number.isFinite(Number(value)) ? Number(value) * 1000 : value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const stripeTransactions = async (secretKey) => {
  const transactions = [];
  let url = "https://api.stripe.com/v1/balance_transactions?limit=100&type=charge";
  while (url) {
    let response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Stripe-Version": "2024-06-20",
        },
      });
    } catch (error) {
      throw new Error(`stripe_network_error: ${error?.message || "fetch_failed"}`);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      let error = {};
      try { error = JSON.parse(body); } catch {}
      throw new Error(error.error?.message || `stripe_request_failed_${response.status}`);
    }
    const data = await response.json();
    for (const item of data.data || []) {
      transactions.push({
        date: parseDate(item.created),
        source: "stripe",
        amount: (item.amount || 0) / 100,
        platformFee: (item.fee || 0) / 100,
        client: item.description || "",
        externalRef: item.id,
      });
    }
    url = data.has_more ? `${url}&starting_after=${data.data[data.data.length - 1].id}` : null;
  }
  return transactions;
};

export const onRequestGet = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const workspace = await env.DB.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(userId).first();
  if (!workspace) return json({ authenticated: true, integrations: [] });
  const features = await plan(env.DB, workspace.id);
  const integrations = await env.DB.prepare(
    "SELECT type, status, account_label, last_sync_at, last_error FROM integrations WHERE workspace_id = ?",
  ).bind(workspace.id).all();
  return json({
    authenticated: true,
    features,
    integrations: (integrations.results || []).map((item) => ({
      type: item.type,
      status: item.status,
      accountLabel: item.account_label,
      lastSyncAt: item.last_sync_at,
      lastError: item.last_error,
    })),
  });
};

const saveStripeTransactions = async (env, workspaceId, integrationId, transactions) => {
  const normalized = await Promise.all(transactions.map((item) => normalizeDraft({ income: [item] })));
  const entries = normalized.map((item) => item.income[0]).filter(Boolean);
  await saveWorkspaceDraft(env.DB, workspaceId, { fixedCosts: [], income: entries, expenses: [], taxReserveRate: null, cashOnHand: null });
  await env.DB.prepare("UPDATE integrations SET last_sync_at = ?, last_error = NULL, updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), new Date().toISOString(), integrationId).run();
  return entries.length;
};

export const onRequestPost = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const workspace = await env.DB.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(userId).first();
  if (!workspace) return json({ error: "workspace_not_found" }, 404);
  const features = await plan(env.DB, workspace.id);
  if (!features.sync) return json({ error: "pro_required" }, 403);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const type = payload?.type;
  if (type !== "stripe") return json({ error: "unsupported_integration" }, 400);
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
    const imported = await saveStripeTransactions(env, workspace.id, integrationId, await stripeTransactions(secretKey));
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
  if (type !== "stripe") return json({ error: "unsupported_integration" }, 400);
  await env.DB.prepare("DELETE FROM integrations WHERE workspace_id = ? AND type = ?").bind(workspace.id, type).run();
  return json({ authenticated: true, deleted: type });
};
