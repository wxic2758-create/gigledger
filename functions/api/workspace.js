import { countNewSubscriptions, normalizeDraft, saveFixedCostRevision, saveWorkspaceDraft, loadWorkspace, updateExpense } from "../lib/ledger.js";
import { planFeatures } from "../lib/plan.js";
import { clearedSessionCookie, readAuthenticatedUserId } from "../lib/session.js";
import { dayInTimeZone, subscriptionTiming } from "../../billing-calendar.js";

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
  if (payload?.settings) {
    const { cashOnHand, taxReserveRate, monthlyIncomeEstimate, appleFeeRate } = payload.settings;
    const optionalAmount = (value, max = Infinity) => value === ""
      || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
        && Number(value) >= 0 && Number(value) <= max);
    if (!optionalAmount(cashOnHand) || !optionalAmount(taxReserveRate, 100)
      || !optionalAmount(monthlyIncomeEstimate) || !["", "15", "30"].includes(appleFeeRate)) {
      return json({ error: "invalid_settings" }, 400);
    }
    const draft = await normalizeDraft(payload.settings);
    const timestamp = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE workspaces SET cash_on_hand_as_of = CASE
          WHEN ? IS NULL THEN NULL WHEN cash_on_hand IS ? THEN cash_on_hand_as_of ELSE ? END,
         cash_on_hand = ?, tax_reserve_rate = ?, apple_fee_rate = ?, monthly_income_estimate = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(
      draft.cashOnHand, draft.cashOnHand, timestamp, draft.cashOnHand, draft.taxReserveRate,
      draft.appleFeeRate, draft.monthlyIncomeEstimate, timestamp, workspace.id,
    ).run();
    return json({ authenticated: true, ledger: await loadWorkspace(env.DB, workspace.id) });
  }
  const draft = await normalizeDraft(payload);
  const workspaceRecord = await env.DB.prepare("SELECT plan FROM workspaces WHERE id = ?").bind(workspace.id).first();
  const features = planFeatures(workspaceRecord?.plan);
  const subscriptionCount = await countNewSubscriptions(env.DB, workspace.id, draft);
  const existingCount = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM fixed_costs WHERE workspace_id = ? AND is_subscription = 1",
  ).bind(workspace.id).first();
  if (features.subscriptionLimit !== null && existingCount.count + subscriptionCount > features.subscriptionLimit) {
    return json({ error: "subscription_limit", limit: features.subscriptionLimit }, 403);
  }
  if (!draft.fixedCosts.length && !draft.income.length && !draft.expenses.length && !draft.monthlyIncomeEstimateProvided) {
    return json({ error: "empty_draft" }, 400);
  }
  await saveWorkspaceDraft(env, workspace.id, draft);
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
  if (payload?.expense) {
    const { error, status } = await updateExpense(env.DB, workspace.id, payload.expense);
    if (error) return json({ error }, status);
    return json({ authenticated: true, ledger: await loadWorkspace(env.DB, workspace.id) });
  }
  if (payload?.revision) {
    try {
      const ledger = await saveFixedCostRevision(env, workspace.id, {
        ...payload.revision,
        fixedCostId: payload.revision.fixedCostId || payload.fixedCostId,
      });
      return json({ authenticated: true, ledger });
    } catch (error) {
      return json(
        { error: error?.message || "fixed_cost_update_failed", limit: error?.limit },
        Number(error?.status) || 400,
      );
    }
  }
  const fixedCostId = String(payload?.fixedCostId || "");
  const answer = String(payload?.answer || "");
  if (!fixedCostId || !["often", "sometimes", "not_used"].includes(answer)) {
    return json({ error: "invalid_request" }, 400);
  }
  const workspaceRecord = await env.DB.prepare("SELECT plan FROM workspaces WHERE id = ?").bind(workspace.id).first();
  if (!planFeatures(workspaceRecord?.plan).subscriptionReview) return json({ error: "pro_required" }, 403);
  const now = new Date();
  const today = dayInTimeZone(now, payload.timeZone);
  const fixedCost = await env.DB.prepare(
    `SELECT fc.updated_at AS updatedAt, fc.next_billing_date AS nextBillingDate,
      fc.start_date AS startDate, fc.end_date AS endDate,
      COALESCE((
        SELECT cycle FROM fixed_cost_versions WHERE fixed_cost_id = fc.id
          AND effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)
        ORDER BY effective_from DESC LIMIT 1
      ), fc.cycle) AS cycle
     FROM fixed_costs AS fc WHERE fc.id = ? AND fc.workspace_id = ? AND fc.is_subscription = 1`,
  ).bind(today, today, fixedCostId, workspace.id).first();
  if (!fixedCost) return json({ error: "fixed_cost_not_found" }, 404);

  const { reviewPeriod } = subscriptionTiming(fixedCost, today);
  if (!reviewPeriod || (payload.billingPeriod && payload.billingPeriod !== reviewPeriod)) {
    return json({ error: "review_period_changed" }, 409);
  }
  const timestamp = now.toISOString();
  const saved = await env.DB.prepare(
    `INSERT INTO subscription_reviews
      (id, fixed_cost_id, workspace_id, period, answer, created_at, updated_at)
     SELECT ?, id, workspace_id, ?, ?, ?, ?
     FROM fixed_costs WHERE id = ? AND workspace_id = ? AND updated_at = ?
     ON CONFLICT(fixed_cost_id, period) DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at`,
  ).bind(crypto.randomUUID(), reviewPeriod, answer, timestamp, timestamp, fixedCostId, workspace.id, fixedCost.updatedAt).run();
  if (!saved.meta.changes) return json({ error: "review_period_changed" }, 409);
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
      env.DB.prepare("DELETE FROM fixed_cost_versions WHERE fixed_cost_id IN (SELECT id FROM fixed_costs WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ?))").bind(userId),
      env.DB.prepare("DELETE FROM fixed_costs WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ?)").bind(userId),
      env.DB.prepare("DELETE FROM projects WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ?)").bind(userId),
      env.DB.prepare("DELETE FROM integrations WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ?)").bind(userId),
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
    const results = await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM subscription_reviews WHERE fixed_cost_id IN (SELECT id FROM fixed_costs WHERE id = ? AND workspace_id = ?)",
      ).bind(id, workspace.id),
      env.DB.prepare(
        "DELETE FROM fixed_cost_versions WHERE fixed_cost_id IN (SELECT id FROM fixed_costs WHERE id = ? AND workspace_id = ?)",
      ).bind(id, workspace.id),
      env.DB.prepare("DELETE FROM fixed_costs WHERE id = ? AND workspace_id = ?").bind(id, workspace.id),
    ]);
    if (!results[2].meta.changes) return json({ error: "fixed_cost_not_found" }, 404);
  } else if (type === "income") {
    await env.DB.prepare("DELETE FROM income_entries WHERE id = ? AND workspace_id = ?").bind(id, workspace.id).run();
  } else {
    await env.DB.prepare("DELETE FROM expenses WHERE id = ? AND workspace_id = ?").bind(id, workspace.id).run();
  }
  return json({ authenticated: true, ledger: await loadWorkspace(env.DB, workspace.id) });
};
