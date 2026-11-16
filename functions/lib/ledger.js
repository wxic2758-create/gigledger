import { planFeatures } from "./plan.js";

export const cycles = {
  daily: 365,
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

export const incomeSources = ["upwork", "fiverr", "stripe", "paypal", "direct", "other"];

const finite = (value) => Number.isFinite(value) && value >= 0;

const text = (value, max = 120) => {
  const result = String(value || "").trim().slice(0, max);
  return result || null;
};

const date = (value) => {
  const result = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : null;
};

const hash = async (value) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const parseAllocationJson = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.length) return [];
    if (parsed.every((entry) => typeof entry === "string")) {
      const percent = 100 / parsed.length;
      return parsed.map((name) => ({ name, percent }));
    }
    return parsed
      .map((entry) => ({ name: text(entry?.name, 80), percent: Number(entry?.percent) }))
      .filter((entry) => entry.name && Number.isFinite(entry.percent) && entry.percent > 0);
  } catch {
    return [];
  }
};

export const normalizeDraft = async (input) => {
  const data = input && typeof input === "object" ? input : {};
  const fixedCosts = Array.isArray(data.fixedCosts) ? data.fixedCosts.slice(0, 200) : [];
  const income = Array.isArray(data.income) ? data.income.slice(0, 500) : [];
  const normalizedFixed = [];
  const normalizedIncome = [];
  const normalizedProjects = [];

  for (const item of fixedCosts) {
    const amount = Number(item?.amount);
    const businessUse = Number(item?.businessUse ?? 100);
    const cycle = cycles[item?.cycle] ? item.cycle : null;
    const name = text(item?.name);
    const startDate = date(item?.startDate || item?.start_date) || new Date().toISOString().slice(0, 10);
    const endDate = date(item?.endDate || item?.end_date);
    const nextBillingDate = date(item?.nextBillingDate || item?.next_billing_date);
    const templateKey = text(item?.templateKey || item?.template_key, 80);
    const productUrl = text(item?.productUrl || item?.product_url, 500);
    const manageUrl = text(item?.manageUrl || item?.manage_url, 500);
    const rawAllocation = Array.isArray(item?.allocation)
      ? item.allocation
      : (Array.isArray(item?.projects) ? item.projects.map((projectName) => ({ name: projectName, percent: 100 })) : []);
    const allocation = rawAllocation
      .map((entry) => ({ name: text(entry?.name || entry, 80), percent: Number(entry?.percent ?? 100) }))
      .filter((entry) => entry.name && Number.isFinite(entry.percent) && entry.percent > 0 && entry.percent <= 100);
    if (!name || !cycle || !finite(amount) || !finite(businessUse) || businessUse > 100) continue;
    if (allocation.length && Math.abs(allocation.reduce((sum, entry) => sum + entry.percent, 0) - 100) > 0.01) continue;
    normalizedFixed.push({
      externalRef: await hash(`${name}|${amount}|${cycle}|${businessUse}`),
      name,
      amount,
      cycle,
      businessUse,
      startDate,
      endDate,
      isSubscription: Boolean(item?.isSubscription || item?.is_subscription || templateKey),
      templateKey,
      productUrl,
      manageUrl,
      nextBillingDate,
      projects: allocation.map((entry) => entry.name),
      allocation,
    });
  }

  for (const item of income) {
    const amount = Number(item?.amount);
    const platformFee = Number(item?.platformFee ?? 0);
    const source = incomeSources.includes(item?.source) ? item.source : null;
    const occurredOn = date(item?.date);
    const clientName = text(item?.client, 120);
    const externalRef = text(item?.externalRef, 160);
    const incomeProjects = Array.isArray(item?.projects) ? item.projects : [];
    if (!source || !occurredOn || !finite(amount) || !finite(platformFee) || platformFee > amount) continue;
    normalizedIncome.push({
      externalRef: externalRef || await hash(`${occurredOn}|${source}|${clientName || ""}|${amount}|${platformFee}`),
      occurredOn,
      source,
      clientName,
      amount,
      platformFee,
      projects: incomeProjects,
    });
  }

  const expensesData = Array.isArray(data.expenses) ? data.expenses.slice(0, 500) : [];
  const normalizedExpenses = [];
  for (const item of expensesData) {
    const amount = Number(item?.amount);
    const businessUse = Number(item?.businessUse ?? 100);
    const occurredOn = date(item?.date);
    const category = text(item?.category, 80);
    const merchant = text(item?.merchant, 120);
    const notes = text(item?.notes, 300);
    const externalRef = text(item?.externalRef, 160);
    const expenseProjects = Array.isArray(item?.projects) ? item.projects : [];
    if (!category || !occurredOn || !finite(amount) || !finite(businessUse) || businessUse > 100) continue;
    normalizedExpenses.push({
      externalRef: externalRef || await hash(`${occurredOn}|${category}|${merchant || ""}|${amount}|${businessUse}`),
      occurredOn,
      category,
      merchant,
      amount,
      businessUse,
      notes,
      projects: expenseProjects,
    });
  }

  let taxReserveRate = null;
  if (data.taxReserveRate !== null && data.taxReserveRate !== undefined && data.taxReserveRate !== "") {
    const rate = Number(data.taxReserveRate);
    if (finite(rate) && rate <= 100) taxReserveRate = rate / 100;
  }

  let cashOnHand = null;
  if (data.cashOnHand !== null && data.cashOnHand !== undefined && data.cashOnHand !== "") {
    const cash = Number(data.cashOnHand);
    if (finite(cash)) cashOnHand = cash;
  }

  const projectNames = new Set([
    ...normalizedFixed.flatMap((item) => item.projects),
    ...normalizedIncome.flatMap((item) => item.projects),
    ...normalizedExpenses.flatMap((item) => item.projects),
    ...(Array.isArray(data.projects) ? data.projects : []).map((item) => typeof item === "string" ? item : item?.name).filter(Boolean),
  ]);
  for (const projectName of projectNames) {
    const name = text(projectName);
    if (name) normalizedProjects.push({ name });
  }

  return {
    projects: normalizedProjects,
    fixedCosts: normalizedFixed,
    income: normalizedIncome,
    expenses: normalizedExpenses,
    taxReserveRate,
    cashOnHand,
  };
};

export const countNewSubscriptions = async (db, workspaceId, draft) => {
  const refs = [...new Set(
    (draft.fixedCosts || [])
      .filter((item) => item.isSubscription)
      .map((item) => item.externalRef)
      .filter(Boolean),
  )];
  if (!refs.length) return 0;
  const existing = await db.prepare(
    "SELECT external_ref FROM fixed_costs WHERE workspace_id = ? AND is_subscription = 1",
  ).bind(workspaceId).all();
  const existingRefs = new Set((existing.results || []).map((item) => item.external_ref));
  return refs.filter((ref) => !existingRefs.has(ref)).length;
};

const previousDate = (value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
};

export const saveFixedCostRevision = async (env, workspaceId, payload) => {
  const db = env.DB;
  const fixedCostId = text(payload?.fixedCostId, 80);
  const effectiveFrom = date(payload?.effectiveFrom);
  const amount = Number(payload?.amount);
  const businessUse = Number(payload?.businessUse);
  const cycle = cycles[payload?.cycle] ? payload.cycle : null;
  const name = text(payload?.name);
  if (!fixedCostId || !effectiveFrom || !name || !cycle || !finite(amount) || !finite(businessUse) || businessUse > 100) {
    const error = new Error("invalid_request");
    error.status = 400;
    throw error;
  }

  const fixedCost = await db.prepare(
    "SELECT id, start_date, is_subscription, template_key FROM fixed_costs WHERE id = ? AND workspace_id = ?",
  ).bind(fixedCostId, workspaceId).first();
  if (!fixedCost) {
    const error = new Error("fixed_cost_not_found");
    error.status = 404;
    throw error;
  }
  if (fixedCost.start_date && effectiveFrom < fixedCost.start_date) {
    const error = new Error("effective_date_before_start");
    error.status = 400;
    throw error;
  }

  const rawAllocation = Array.isArray(payload?.allocation) ? payload.allocation : [];
  const allocation = rawAllocation
    .map((entry) => ({ name: text(entry?.name, 80), percent: Number(entry?.percent) }))
    .filter((entry) => entry.name && Number.isFinite(entry.percent) && entry.percent > 0 && entry.percent <= 100);
  if (allocation.length && Math.abs(allocation.reduce((sum, entry) => sum + entry.percent, 0) - 100) > 0.01) {
    const error = new Error("invalid_allocation");
    error.status = 400;
    throw error;
  }

  const isSubscription = Boolean(payload?.isSubscription);
  if (isSubscription && !fixedCost.is_subscription) {
    const workspace = await db.prepare("SELECT plan FROM workspaces WHERE id = ?").bind(workspaceId).first();
    const features = planFeatures(workspace?.plan);
    if (features.subscriptionLimit !== null) {
      const count = await db.prepare(
        "SELECT COUNT(*) AS count FROM fixed_costs WHERE workspace_id = ? AND is_subscription = 1",
      ).bind(workspaceId).first();
      if ((count?.count || 0) >= features.subscriptionLimit) {
        const error = new Error("subscription_limit");
        error.status = 403;
        error.limit = features.subscriptionLimit;
        throw error;
      }
    }
  }

  const timestamp = new Date().toISOString();
  const today = timestamp.slice(0, 10);
  const allocationJson = allocation.length ? JSON.stringify(allocation) : null;
  const endDate = date(payload?.endDate);
  const nextBillingDate = date(payload?.nextBillingDate);
  const productUrl = text(payload?.productUrl, 500);
  const manageUrl = text(payload?.manageUrl, 500);
  const templateKey = text(payload?.templateKey, 80) || fixedCost.template_key || null;
  const existingVersion = await db.prepare(
    "SELECT id FROM fixed_cost_versions WHERE fixed_cost_id = ? AND effective_from = ?",
  ).bind(fixedCostId, effectiveFrom).first();
  const previousVersion = await db.prepare(
    `SELECT id, effective_from FROM fixed_cost_versions
     WHERE fixed_cost_id = ? AND effective_from < ?
     ORDER BY effective_from DESC LIMIT 1`,
  ).bind(fixedCostId, effectiveFrom).first();
  const nextVersion = await db.prepare(
    `SELECT effective_from FROM fixed_cost_versions
     WHERE fixed_cost_id = ? AND effective_from > ?
     ORDER BY effective_from ASC LIMIT 1`,
  ).bind(fixedCostId, effectiveFrom).first();
  const nextVersionStart = nextVersion?.effective_from || null;
  const versionEnd = nextVersionStart ? previousDate(nextVersionStart) : null;

  const statements = [];
  if (previousVersion) {
    statements.push(db.prepare(
      "UPDATE fixed_cost_versions SET effective_to = ?, updated_at = ? WHERE id = ?",
    ).bind(previousDate(effectiveFrom), timestamp, previousVersion.id));
  }
  if (existingVersion) {
    statements.push(db.prepare(
      `UPDATE fixed_cost_versions
       SET effective_to = ?, amount = ?, cycle = ?, business_use = ?, allocation_json = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(versionEnd, amount, cycle, businessUse, allocationJson, timestamp, existingVersion.id));
  } else {
    statements.push(db.prepare(
      `INSERT INTO fixed_cost_versions
        (id, fixed_cost_id, effective_from, effective_to, amount, cycle, business_use, allocation_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      fixedCostId,
      effectiveFrom,
      versionEnd,
      amount,
      cycle,
      businessUse,
      allocationJson,
      timestamp,
      timestamp,
    ));
  }

  const appliesNow = effectiveFrom <= today;
  statements.push(db.prepare(
    `UPDATE fixed_costs
     SET name = ?,
         amount = CASE WHEN ? THEN ? ELSE amount END,
         cycle = CASE WHEN ? THEN ? ELSE cycle END,
         business_use = CASE WHEN ? THEN ? ELSE business_use END,
         allocation_json = CASE WHEN ? THEN ? ELSE allocation_json END,
         is_subscription = ?, template_key = ?, product_url = ?, manage_url = ?,
         next_billing_date = ?, end_date = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
  ).bind(
    name,
    appliesNow ? 1 : 0,
    amount,
    appliesNow ? 1 : 0,
    cycle,
    appliesNow ? 1 : 0,
    businessUse,
    appliesNow ? 1 : 0,
    allocationJson,
    isSubscription ? 1 : 0,
    templateKey,
    productUrl,
    manageUrl,
    nextBillingDate,
    endDate,
    timestamp,
    fixedCostId,
    workspaceId,
  ));
  await db.batch(statements);
  return loadWorkspace(db, workspaceId);
};

export const saveWorkspaceDraft = async (env, workspaceId, draft) => {
  const timestamp = new Date().toISOString();
  const statements = [];
  const db = env.DB;

  statements.push(db.prepare(
    `UPDATE workspaces
     SET tax_reserve_rate = COALESCE(?, tax_reserve_rate),
         cash_on_hand = COALESCE(?, cash_on_hand),
         cash_on_hand_as_of = CASE WHEN ? IS NULL THEN cash_on_hand_as_of ELSE ? END,
         updated_at = ?
     WHERE id = ?`,
  ).bind(
    draft.taxReserveRate,
    draft.cashOnHand,
    draft.cashOnHand,
    draft.cashOnHand === null ? null : timestamp,
    timestamp,
    workspaceId,
  ));

  const projectNames = new Map();
  for (const project of draft.projects || []) {
    const key = String(project.name || "").trim().toLowerCase();
    if (key) projectNames.set(key, project.name);
  }
  for (const item of [...(draft.fixedCosts || []), ...(draft.income || []), ...(draft.expenses || [])]) {
    for (const projectName of item.projects || []) {
      const key = String(projectName || "").trim().toLowerCase();
      if (key) projectNames.set(key, projectName);
    }
  }
  let existingByName = new Map();
  if (projectNames.size) {
    const existing = await db.prepare(
      "SELECT id, name, archived FROM projects WHERE workspace_id = ?",
    ).bind(workspaceId).all();
    existingByName = new Map((existing.results || []).map((row) => [row.name.toLowerCase(), { id: row.id, archived: Boolean(row.archived) }]));
    for (const [key, name] of projectNames.entries()) {
      const current = existingByName.get(key);
      if (current) {
        if (current.archived) {
          await db.prepare(
            "UPDATE projects SET archived = 0, updated_at = ? WHERE id = ? AND workspace_id = ?",
          ).bind(timestamp, current.id, workspaceId).run();
          current.archived = false;
        }
        continue;
      }
      const id = crypto.randomUUID();
      await db.prepare(
        "INSERT INTO projects (id, workspace_id, name, archived, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
      ).bind(id, workspaceId, name, timestamp, timestamp).run();
      existingByName.set(key, { id, archived: false });
    }
  }

  const projectIdByName = async (name) => {
    const key = String(name || "").toLowerCase();
    const cached = existingByName.get(key);
    if (cached?.id) return cached.id;
    const row = await db.prepare(
      "SELECT id FROM projects WHERE workspace_id = ? AND lower(name) = lower(?)",
    ).bind(workspaceId, name).first();
    if (row?.id) existingByName.set(key, { id: row.id, archived: false });
    return row?.id || null;
  };

  const existingFixed = await db.prepare(
    "SELECT id, external_ref FROM fixed_costs WHERE workspace_id = ?",
  ).bind(workspaceId).all();
  const fixedIdByRef = new Map((existingFixed.results || []).map((row) => [row.external_ref, row.id]));

  for (const item of draft.fixedCosts) {
    const fixedCostId = fixedIdByRef.get(item.externalRef) || crypto.randomUUID();
    const projectJson = item.allocation?.length
      ? JSON.stringify(item.allocation)
      : (item.projects?.length ? JSON.stringify(item.projects) : null);
    statements.push(db.prepare(
      `INSERT INTO fixed_costs
        (id, workspace_id, external_ref, name, amount, cycle, business_use, source, project_id, allocation_json,
         is_subscription, template_key, product_url, manage_url, next_billing_date, start_date, end_date,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id, external_ref) DO NOTHING`,
    ).bind(
      fixedCostId,
      workspaceId,
      item.externalRef,
      item.name,
      item.amount,
      item.cycle,
      item.businessUse,
      projectJson,
      item.isSubscription ? 1 : 0,
      item.templateKey,
      item.productUrl,
      item.manageUrl,
      item.nextBillingDate,
      item.startDate,
      item.endDate,
      timestamp,
      timestamp,
    ));
    statements.push(db.prepare(
      `INSERT INTO fixed_cost_versions
        (id, fixed_cost_id, effective_from, effective_to, amount, cycle, business_use, allocation_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(fixed_cost_id, effective_from) DO NOTHING`,
    ).bind(
      crypto.randomUUID(),
      fixedCostId,
      item.startDate,
      item.endDate,
      item.amount,
      item.cycle,
      item.businessUse,
      projectJson,
      timestamp,
      timestamp,
    ));
    fixedIdByRef.set(item.externalRef, fixedCostId);
  }

  for (const item of draft.expenses) {
    statements.push(db.prepare(
      `INSERT INTO expenses
        (id, workspace_id, external_ref, occurred_on, category, merchant, amount, business_use, notes, source, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', NULL, ?, ?)
       ON CONFLICT(workspace_id, external_ref) DO NOTHING`,
    ).bind(
      crypto.randomUUID(),
      workspaceId,
      item.externalRef,
      item.occurredOn,
      item.category,
      item.merchant,
      item.amount,
      item.businessUse,
      item.notes,
      timestamp,
      timestamp,
    ));
  }

  for (const item of draft.income) {
    statements.push(db.prepare(
      `INSERT INTO income_entries
        (id, workspace_id, external_ref, occurred_on, source, client_name, amount, platform_fee, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
       ON CONFLICT(workspace_id, external_ref) DO NOTHING`,
    ).bind(
      crypto.randomUUID(),
      workspaceId,
      item.externalRef,
      item.occurredOn,
      item.source,
      item.clientName,
      item.amount,
      item.platformFee,
      timestamp,
      timestamp,
    ));
  }

  await db.batch(statements);
  const updateProject = async (table, item, projectJson = null) => {
    const projectId = item.projects?.length ? await projectIdByName(item.projects[0]) : null;
    if (projectJson !== null) {
      await db.prepare(`UPDATE ${table} SET project_id = ?, allocation_json = ? WHERE workspace_id = ? AND external_ref = ?`)
        .bind(projectId, projectJson, workspaceId, item.externalRef).run();
      return;
    }
    if (!projectId) return;
    await db.prepare(`UPDATE ${table} SET project_id = ? WHERE workspace_id = ? AND external_ref = ?`)
      .bind(projectId, workspaceId, item.externalRef).run();
  };
  for (const item of draft.fixedCosts) {
    const projectJson = item.allocation?.length
      ? JSON.stringify(item.allocation)
      : (item.projects?.length ? JSON.stringify(item.projects) : null);
    await updateProject("fixed_costs", item, projectJson);
  }
  for (const item of draft.income) await updateProject("income_entries", item);
  for (const item of draft.expenses) await updateProject("expenses", item);
};

export const loadWorkspace = async (db, workspaceId) => {
  const projectRows = await db.prepare(
    "SELECT id, name, archived, created_at, updated_at FROM projects WHERE workspace_id = ? ORDER BY created_at DESC",
  ).bind(workspaceId).all();
  const projectsById = new Map((projectRows.results || []).map((item) => [item.id, item.name]));
  const workspace = await db.prepare(
    "SELECT id, name, base_currency, tax_reserve_rate, cash_on_hand, cash_on_hand_as_of, plan FROM workspaces WHERE id = ?",
  ).bind(workspaceId).first();
  if (!workspace) return null;

  const fixedCosts = await db.prepare(
    `SELECT id, name, amount, cycle, business_use, source, project_id, allocation_json, is_subscription, template_key,
            product_url, manage_url, next_billing_date, start_date, end_date,
            created_at, updated_at
     FROM fixed_costs WHERE workspace_id = ? ORDER BY created_at DESC`,
  ).bind(workspaceId).all();
  const subscriptionReviews = await db.prepare(
    `SELECT sr.fixed_cost_id, sr.period, sr.answer
     FROM subscription_reviews sr
     JOIN fixed_costs fc ON fc.id = sr.fixed_cost_id
     WHERE fc.workspace_id = ?
     ORDER BY sr.period DESC, sr.created_at DESC`,
  ).bind(workspaceId).all();
  const reviewsByCost = new Map();
  for (const row of subscriptionReviews.results || []) {
    const reviews = reviewsByCost.get(row.fixed_cost_id) || [];
    if (reviews.length < 2) reviews.push({ period: row.period, answer: row.answer });
    reviewsByCost.set(row.fixed_cost_id, reviews);
  }
  const fixedCostRows = fixedCosts.results || [];
  const versionRows = fixedCostRows.length ? await db.prepare(
    `SELECT fixed_cost_id, effective_from, effective_to, amount, cycle, business_use, allocation_json
     FROM fixed_cost_versions
     WHERE fixed_cost_id IN (${fixedCostRows.map(() => "?").join(",")})
     ORDER BY effective_from ASC`,
  ).bind(...fixedCostRows.map((item) => item.id)).all() : { results: [] };
  const versionsByCost = new Map();
  for (const row of versionRows.results || []) {
    const versions = versionsByCost.get(row.fixed_cost_id) || [];
    versions.push({
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      amount: row.amount,
      cycle: row.cycle,
      businessUse: row.business_use,
      allocation: row.allocation_json ? JSON.parse(row.allocation_json) : [],
    });
    versionsByCost.set(row.fixed_cost_id, versions);
  }
  const income = await db.prepare(
    `SELECT id, external_ref, occurred_on, source, client_name, amount, platform_fee, project_id, created_at, updated_at
     FROM income_entries WHERE workspace_id = ? ORDER BY occurred_on DESC, created_at DESC`,
  ).bind(workspaceId).all();
  const expenses = await db.prepare(
    `SELECT id, occurred_on, category, merchant, amount, business_use, notes, source, project_id, created_at, updated_at
     FROM expenses WHERE workspace_id = ? ORDER BY occurred_on DESC, created_at DESC`,
  ).bind(workspaceId).all();

  return {
    projects: (projectRows.results || []).map((item) => ({
      id: item.id,
      name: item.name,
      archived: Boolean(item.archived),
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
    workspace: {
      id: workspace.id,
      name: workspace.name,
      baseCurrency: workspace.base_currency,
      taxReserveRate: workspace.tax_reserve_rate,
      cashOnHand: workspace.cash_on_hand,
      cashOnHandAsOf: workspace.cash_on_hand_as_of,
      plan: planFeatures(workspace.plan).plan,
      features: planFeatures(workspace.plan),
    },
    fixedCosts: (fixedCosts.results || []).map((item) => ({
      ...(() => {
        const allocation = parseAllocationJson(item.allocation_json);
        const projects = allocation.length
          ? allocation.map((entry) => entry.name)
          : (item.project_id ? [projectsById.get(item.project_id)].filter(Boolean) : []);
        return {
          projects,
          allocation: allocation.length
            ? allocation
            : (item.project_id ? [{ name: projectsById.get(item.project_id), percent: 100 }].filter((entry) => entry.name) : []),
        };
      })(),
      id: item.id,
      name: item.name,
      amount: item.amount,
      cycle: item.cycle,
      businessUse: item.business_use,
      source: item.source,
      isSubscription: Boolean(item.is_subscription),
      templateKey: item.template_key,
      productUrl: item.product_url,
      manageUrl: item.manage_url,
      nextBillingDate: item.next_billing_date,
      startDate: item.start_date,
      endDate: item.end_date,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      versions: versionsByCost.get(item.id) || [],
      reviews: reviewsByCost.get(item.id) || [],
    })),
    income: (income.results || []).map((item) => ({
      id: item.id,
      externalRef: item.external_ref,
      date: item.occurred_on,
      source: item.source,
      client: item.client_name,
      amount: item.amount,
      platformFee: item.platform_fee,
      project: item.project_id ? projectsById.get(item.project_id) || null : null,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
    expenses: (expenses.results || []).map((item) => ({
      id: item.id,
      date: item.occurred_on,
      category: item.category,
      merchant: item.merchant,
      amount: item.amount,
      businessUse: item.business_use,
      notes: item.notes,
      source: item.source,
      project: item.project_id ? projectsById.get(item.project_id) || null : null,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
  };
};
