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

export const normalizeDraft = async (input) => {
  const data = input && typeof input === "object" ? input : {};
  const fixedCosts = Array.isArray(data.fixedCosts) ? data.fixedCosts.slice(0, 200) : [];
  const income = Array.isArray(data.income) ? data.income.slice(0, 500) : [];
  const normalizedFixed = [];
  const normalizedIncome = [];

  for (const item of fixedCosts) {
    const amount = Number(item?.amount);
    const businessUse = Number(item?.businessUse ?? 100);
    const cycle = cycles[item?.cycle] ? item.cycle : null;
    const name = text(item?.name);
    if (!name || !cycle || !finite(amount) || !finite(businessUse) || businessUse > 100) continue;
    normalizedFixed.push({
      externalRef: await hash(`${name}|${amount}|${cycle}|${businessUse}`),
      name,
      amount,
      cycle,
      businessUse,
    });
  }

  for (const item of income) {
    const amount = Number(item?.amount);
    const platformFee = Number(item?.platformFee ?? 0);
    const source = incomeSources.includes(item?.source) ? item.source : null;
    const occurredOn = date(item?.date);
    const clientName = text(item?.client, 120);
    const externalRef = text(item?.externalRef, 160);
    if (!source || !occurredOn || !finite(amount) || !finite(platformFee) || platformFee > amount) continue;
    normalizedIncome.push({
      externalRef: externalRef || await hash(`${occurredOn}|${source}|${clientName || ""}|${amount}|${platformFee}`),
      occurredOn,
      source,
      clientName,
      amount,
      platformFee,
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
    if (!category || !occurredOn || !finite(amount) || !finite(businessUse) || businessUse > 100) continue;
    normalizedExpenses.push({
      externalRef: externalRef || await hash(`${occurredOn}|${category}|${merchant || ""}|${amount}|${businessUse}`),
      occurredOn,
      category,
      merchant,
      amount,
      businessUse,
      notes,
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

  return {
    fixedCosts: normalizedFixed,
    income: normalizedIncome,
    expenses: normalizedExpenses,
    taxReserveRate,
    cashOnHand,
  };
};

export const saveWorkspaceDraft = async (db, workspaceId, draft) => {
  const timestamp = new Date().toISOString();
  const statements = [];

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

  for (const item of draft.fixedCosts) {
    statements.push(db.prepare(
      `INSERT INTO fixed_costs
        (id, workspace_id, external_ref, name, amount, cycle, business_use, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)
       ON CONFLICT(workspace_id, external_ref) DO NOTHING`,
    ).bind(
      crypto.randomUUID(),
      workspaceId,
      item.externalRef,
      item.name,
      item.amount,
      item.cycle,
      item.businessUse,
      timestamp,
      timestamp,
    ));
  }

  for (const item of draft.expenses) {
    statements.push(db.prepare(
      `INSERT INTO expenses
        (id, workspace_id, external_ref, occurred_on, category, merchant, amount, business_use, notes, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)
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
        (id, workspace_id, external_ref, occurred_on, source, client_name, amount, platform_fee, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
};

export const loadWorkspace = async (db, workspaceId) => {
  const workspace = await db.prepare(
    "SELECT id, name, base_currency, tax_reserve_rate, cash_on_hand, cash_on_hand_as_of FROM workspaces WHERE id = ?",
  ).bind(workspaceId).first();
  if (!workspace) return null;

  const fixedCosts = await db.prepare(
    `SELECT id, name, amount, cycle, business_use, source, created_at, updated_at
     FROM fixed_costs WHERE workspace_id = ? ORDER BY created_at DESC`,
  ).bind(workspaceId).all();
  const income = await db.prepare(
    `SELECT id, external_ref, occurred_on, source, client_name, amount, platform_fee, created_at, updated_at
     FROM income_entries WHERE workspace_id = ? ORDER BY occurred_on DESC, created_at DESC`,
  ).bind(workspaceId).all();
  const expenses = await db.prepare(
    `SELECT id, occurred_on, category, merchant, amount, business_use, notes, source, created_at, updated_at
     FROM expenses WHERE workspace_id = ? ORDER BY occurred_on DESC, created_at DESC`,
  ).bind(workspaceId).all();

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      baseCurrency: workspace.base_currency,
      taxReserveRate: workspace.tax_reserve_rate,
      cashOnHand: workspace.cash_on_hand,
      cashOnHandAsOf: workspace.cash_on_hand_as_of,
    },
    fixedCosts: (fixedCosts.results || []).map((item) => ({
      id: item.id,
      name: item.name,
      amount: item.amount,
      cycle: item.cycle,
      businessUse: item.business_use,
      source: item.source,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
    income: (income.results || []).map((item) => ({
      id: item.id,
      externalRef: item.external_ref,
      date: item.occurred_on,
      source: item.source,
      client: item.client_name,
      amount: item.amount,
      platformFee: item.platform_fee,
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
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
  };
};
