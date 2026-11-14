import { normalizeDraft, saveWorkspaceDraft, loadWorkspace } from "../lib/ledger.js";
import { clearedSessionCookie, readAuthenticatedUserId } from "../lib/session.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

export const onRequestGet = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const workspace = await env.DB.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(userId).first();
  if (!workspace) return json({ authenticated: true, ledger: null });
  return json({ authenticated: true, ledger: await loadWorkspace(env.DB, workspace.id) });
};

export const onRequestExportGet = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const workspace = await env.DB.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(userId).first();
  if (!workspace) return json({ authenticated: true, export: null });
  const [user, ledger] = await Promise.all([
    env.DB.prepare("SELECT id, email, name, created_at, updated_at FROM users WHERE id = ?").bind(userId).first(),
    loadWorkspace(env.DB, workspace.id),
  ]);
  const filename = `gigledger-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), user, ledger }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
};

export const onRequestPost = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const workspace = await env.DB.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(userId).first();
  if (!workspace) return json({ error: "workspace_not_found" }, 404);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const draft = await normalizeDraft(payload);
  if (!draft.fixedCosts.length && !draft.income.length && !draft.expenses.length) {
    return json({ error: "empty_draft" }, 400);
  }
  await saveWorkspaceDraft(env.DB, workspace.id, draft);
  return json({ authenticated: true, ledger: await loadWorkspace(env.DB, workspace.id) });
};

export const onRequestPut = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const workspace = await env.DB.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(userId).first();
  if (!workspace) return json({ error: "workspace_not_found" }, 404);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const fixedCostId = String(payload?.fixedCostId || "");
  const answer = String(payload?.answer || "");
  if (!fixedCostId || !["often", "sometimes", "not_used"].includes(answer)) {
    return json({ error: "invalid_request" }, 400);
  }
  const fixedCost = await env.DB.prepare(
    "SELECT id, next_billing_date, cycle FROM fixed_costs WHERE id = ? AND workspace_id = ?",
  ).bind(fixedCostId, workspace.id).first();
  if (!fixedCost) return json({ error: "fixed_cost_not_found" }, 404);

  const timestamp = new Date().toISOString();
  const today = timestamp.slice(0, 10);
  const period = today.slice(0, 7);
  await env.DB.prepare(
    `INSERT INTO subscription_reviews
      (id, fixed_cost_id, workspace_id, period, answer, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(fixed_cost_id, period) DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at`,
  ).bind(crypto.randomUUID(), fixedCostId, workspace.id, period, answer, timestamp, timestamp).run();

  const multipliers = { daily: 1, weekly: 7, biweekly: 14, monthly: 1, quarterly: 3, yearly: 12 };
  let nextBillingDate = fixedCost.next_billing_date;
  if (nextBillingDate) {
    const billingDate = new Date(`${nextBillingDate}T00:00:00Z`);
    if (!Number.isNaN(billingDate.getTime())) {
      if (fixedCost.cycle === "monthly") billingDate.setUTCMonth(billingDate.getUTCMonth() + 1);
      else if (fixedCost.cycle === "quarterly") billingDate.setUTCMonth(billingDate.getUTCMonth() + 3);
      else if (fixedCost.cycle === "yearly") billingDate.setUTCFullYear(billingDate.getUTCFullYear() + 1);
      else billingDate.setUTCDate(billingDate.getUTCDate() + (multipliers[fixedCost.cycle] || 30));
      nextBillingDate = billingDate.toISOString().slice(0, 10);
      await env.DB.prepare("UPDATE fixed_costs SET next_billing_date = ?, updated_at = ? WHERE id = ?")
        .bind(nextBillingDate, timestamp, fixedCostId).run();
    }
  }
  return json({ authenticated: true, ledger: await loadWorkspace(env.DB, workspace.id) });
};

export const onRequestDelete = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");
  if (type === "account") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM income_entries WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ?)").bind(userId),
      env.DB.prepare("DELETE FROM expenses WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ?)").bind(userId),
      env.DB.prepare("DELETE FROM subscription_reviews WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ?)").bind(userId),
      env.DB.prepare("DELETE FROM fixed_costs WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ?)").bind(userId),
      env.DB.prepare("DELETE FROM workspaces WHERE owner_id = ?").bind(userId),
      env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId),
    ]);
    return new Response(null, {
      status: 302,
      headers: { location: "/", "set-cookie": clearedSessionCookie() },
    });
  }
  if (!["fixed-cost", "income", "expense"].includes(type) || !id) {
    return json({ error: "invalid_request" }, 400);
  }
  const workspace = await env.DB.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(userId).first();
  if (!workspace) return json({ error: "workspace_not_found" }, 404);
  if (type === "fixed-cost") {
    await env.DB.prepare("DELETE FROM subscription_reviews WHERE fixed_cost_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM fixed_cost_versions WHERE fixed_cost_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM fixed_costs WHERE id = ? AND workspace_id = ?").bind(id, workspace.id).run();
  } else if (type === "income") {
    await env.DB.prepare("DELETE FROM income_entries WHERE id = ? AND workspace_id = ?").bind(id, workspace.id).run();
  } else {
    await env.DB.prepare("DELETE FROM expenses WHERE id = ? AND workspace_id = ?").bind(id, workspace.id).run();
  }
  return json({ authenticated: true, ledger: await loadWorkspace(env.DB, workspace.id) });
};
