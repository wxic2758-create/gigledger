import { normalizeDraft, loadWorkspace, saveWorkspaceDraft } from "../../lib/ledger.js";
import { readAuthenticatedUserId } from "../../lib/session.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

const csvHeaders = ["date", "source", "amount", "currency", "platform_fee", "client", "project", "external_ref", "notes"];

const parseCsvLine = (line) => {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (quoted && line[index + 1] === "\"") {
        value += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values.map((item) => item.trim());
};

const csvCell = (value) => {
  const raw = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(raw) ? `"${raw.replaceAll("\"", "\"\"")}"` : raw;
};

const csvResponse = (rows, filename) => new Response(
  `\uFEFF${[csvHeaders.join(","), ...rows.map((row) => csvHeaders.map((header) => csvCell(row[header])).join(","))].join("\n")}\n`,
  {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  },
);

const mapIncome = (item) => ({
  date: item.date,
  source: item.source,
  amount: Number(item.amount) || 0,
  currency: "USD",
  platform_fee: Number(item.platformFee) || 0,
  client: item.client || "",
  project: "",
  external_ref: item.id || item.externalRef || "",
  notes: "",
});

export const onRequestGet = async ({ env, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("template")) return csvResponse([{ date: "2026-01-01", source: "upwork", amount: "120.00", currency: "USD", platform_fee: "12.00", client: "Example client", project: "Example project", external_ref: "example-001", notes: "Example note" }], "gigledger-income-template.csv");
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const workspace = await env.DB.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(userId).first();
  if (!workspace) return csvResponse([], "gigledger-income.csv");
  const ledger = await loadWorkspace(env.DB, workspace.id);
  const rows = (ledger.income || []).map(mapIncome);
  return csvResponse(rows, `gigledger-income-${new Date().toISOString().slice(0, 10)}.csv`);
};

export const onRequestPost = async ({ env, request }) => {
  const userId = await readAuthenticatedUserId(env, request.headers.get("cookie"));
  if (!userId) return json({ authenticated: false }, 401);
  const workspace = await env.DB.prepare("SELECT id FROM workspaces WHERE owner_id = ?").bind(userId).first();
  if (!workspace) return json({ error: "workspace_not_found" }, 404);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "invalid_form" }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "invalid_file" }, 400);
  const raw = await file.text();
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return json({ error: "empty_file" }, 400);

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().replaceAll(" ", "_"));
  const missing = csvHeaders.filter((header) => header !== "currency" && header !== "project" && header !== "external_ref" && header !== "notes" && header !== "client" && header !== "platform_fee" && !headers.includes(header));
  if (missing.length) return json({ error: "missing_required_columns", missing }, 400);
  const dateIndex = headers.indexOf("date");
  const sourceIndex = headers.indexOf("source");
  const amountIndex = headers.indexOf("amount");
  const feeIndex = headers.indexOf("platform_fee");
  const refIndex = headers.indexOf("external_ref");
  const clientIndex = headers.indexOf("client");
  const notesIndex = headers.indexOf("notes");
  const existingLedger = await loadWorkspace(env.DB, workspace.id);
  const existingRefs = new Set((existingLedger.income || []).map((item) => item.externalRef));
  const originalRows = lines.slice(1);
  const imported = [];
  const failed = [];
  const seen = new Set();

  for (const [rowIndex, line] of originalRows.entries()) {
    const cells = parseCsvLine(line);
    const item = {
      date: dateIndex >= 0 ? cells[dateIndex] : "",
      source: sourceIndex >= 0 ? cells[sourceIndex] : "",
      amount: Number(cells[amountIndex]),
      platformFee: feeIndex >= 0 ? Number(cells[feeIndex] || 0) || 0 : 0,
      client: clientIndex >= 0 ? cells[clientIndex] : "",
      externalRef: refIndex >= 0 ? cells[refIndex] : "",
      notes: notesIndex >= 0 ? cells[notesIndex] : "",
    };
    const valid = Number.isFinite(item.amount) && item.amount >= 0
      && Number.isFinite(item.platformFee) && item.platformFee >= 0
      && item.platformFee <= item.amount;
    if (!valid) {
      failed.push({ line_number: rowIndex + 2, row: item, reason: "invalid_amount" });
      continue;
    }
    const normalized = await normalizeDraft({ income: [item] });
    if (!normalized.income.length) {
      failed.push({ line_number: rowIndex + 2, row: item, reason: "invalid_entry" });
      continue;
    }
    const entry = normalized.income[0];
    if (seen.has(entry.externalRef)) {
      failed.push({ line_number: rowIndex + 2, row: item, reason: "duplicate_in_file" });
      continue;
    }
    seen.add(entry.externalRef);
    if (existingRefs.has(entry.externalRef)) {
      failed.push({ line_number: rowIndex + 2, row: item, reason: "duplicate_in_workspace" });
      continue;
    }
    imported.push(entry);
  }

  if (imported.length) {
    await saveWorkspaceDraft(env.DB, workspace.id, {
      fixedCosts: [],
      income: imported,
      expenses: [],
      taxReserveRate: null,
      cashOnHand: null,
    });
  }
  return json({ authenticated: true, imported: imported.length, failed: failed.length, failedRows: failed });
};
