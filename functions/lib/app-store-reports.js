import { dayInTimeZone, monthOffset, shiftDay } from "../../billing-calendar.js";
import { decimal, exact, minorUnits, percent, roundCents, scale, usd } from "../../money.js";
import { base64Url } from "./integration-credentials.js";

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const vendorPattern = /^\d{5,20}$/;
const allowedReportTypes = ["sales", "finance"];
const appleZone = "America/Los_Angeles";
const MAX_DOWNLOAD_BYTES = 4 * 1024 * 1024;
const MAX_REPORT_BYTES = 8 * 1024 * 1024;

export class AppStoreReportError extends Error {
  constructor(code, status) {
    super(code);
    this.status = status;
  }
}

const invalidReport = () => new AppStoreReportError("app_store_invalid_report", 422);

function dateOnly(value) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const day = match ? `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}` : value;
  return /^\d{4}-\d{2}-\d{2}$/.test(day || "") && shiftDay(day, 0) === day ? day : null;
}

export function appStoreDefaults(now = new Date()) {
  const day = dayInTimeZone(now, appleZone);
  return { sales: shiftDay(day, -1), finance: monthOffset(day.slice(0, 7), -1) };
}

export function validReportPeriod(kind, period) {
  return allowedReportTypes.includes(kind) && typeof period === "string"
    && (kind === "sales" ? dateOnly(period) === period : monthPattern.test(period));
}

export function readAppStoreCredential(payload) {
  const value = (key) => typeof payload?.[key] === "string" ? payload[key].trim() : "";
  const issuerId = value("issuerId");
  const keyId = value("keyId");
  const vendorNumber = value("vendorNumber");
  const privateKey = value("privateKey");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(issuerId)
    || !/^[A-Z0-9]{6,12}$/.test(keyId) || !vendorPattern.test(vendorNumber)) {
    throw new AppStoreReportError("invalid_app_store_credentials", 400);
  }
  if (privateKey.length > 4096 || !privateKey.startsWith("-----BEGIN PRIVATE KEY-----")
    || !privateKey.endsWith("-----END PRIVATE KEY-----")) {
    throw new AppStoreReportError("invalid_app_store_private_key", 400);
  }
  return { issuerId, keyId, vendorNumber, privateKey };
}

export async function appStoreReportToken(credential, kind) {
  const pem = credential.privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s+/g, "");
  try {
    const key = await crypto.subtle.importKey(
      "pkcs8", Uint8Array.from(atob(pem), (char) => char.charCodeAt(0)),
      { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
    );
    const encode = (value) => base64Url(new TextEncoder().encode(JSON.stringify(value)));
    const now = Math.floor(Date.now() / 1000);
    const endpoint = kind === "sales" ? "salesReports" : "financeReports";
    const header = encode({ alg: "ES256", kid: credential.keyId, typ: "JWT" });
    const payload = encode({
      iss: credential.issuerId, iat: now, exp: now + 300, aud: "appstoreconnect-v1",
      scope: [`GET /v1/${endpoint}`],
    });
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${header}.${payload}`),
    );
    return `${header}.${payload}.${base64Url(new Uint8Array(signature))}`;
  } catch {
    throw new AppStoreReportError("invalid_app_store_private_key", 400);
  }
}

async function boundedBytes(stream, limit) {
  if (!stream) throw invalidReport();
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new AppStoreReportError("app_store_report_too_large", 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function reportText(response) {
  const bytes = await boundedBytes(response.body, MAX_DOWNLOAD_BYTES);
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new TextDecoder().decode(await boundedBytes(stream, MAX_REPORT_BYTES));
}

const column = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const salesColumns = ["begindate", "enddate", "units", "customerprice", "customercurrency"];
const financeColumns = ["startdate", "enddate", "extendedpartnershare", "partnersharecurrency"];

function reportRows(text, expected) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headerIndex = lines.slice(0, 20).findIndex((line) => {
    const columns = line.split("\t").map(column);
    return expected.every((key) => columns.includes(key));
  });
  if (headerIndex < 0) throw invalidReport();
  const columns = lines[headerIndex].split("\t").map(column);
  const positions = expected.map((key) => columns.indexOf(key));
  return lines.slice(headerIndex + 1).filter((line) => line.trim()
    && !/^\s*(?:total|report total|total[_ ]rows)(?=\s*(?:\t|:|$))/i.test(line))
    .map((line) => {
      const cells = line.split("\t");
      return positions.map((position) => cells[position]?.trim() ?? "");
    });
}

function safeCents(value) {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw invalidReport();
  return result;
}

export function parseSalesReport(text, day) {
  let total = 0n;
  let skippedCurrencies = 0;
  let salesRows = 0;
  for (const [start, end, quantity, price, currency] of reportRows(text, salesColumns)) {
    if (dateOnly(start) !== day || dateOnly(end) !== day) throw invalidReport();
    const units = decimal(quantity);
    const perUnit = decimal(price);
    if (!units || !perUnit) throw invalidReport();
    if (perUnit.numerator === 0n) continue;
    if (!/^[A-Z]{3}$/.test(currency)) throw invalidReport();
    if (currency !== "USD") {
      skippedCurrencies++;
      continue;
    }
    const count = units.numerator < 0n ? -units.numerator : units.numerator;
    const magnitude = perUnit.numerator < 0n ? -perUnit.numerator : perUnit.numerator;
    const sign = units.numerator < 0n || perUnit.numerator < 0n ? -1n : 1n;
    // A zero-unit line can represent a partial refund. Its price is the adjustment.
    total += roundCents(scale(
      exact(sign * magnitude * 100n), count || 1n, perUnit.denominator * (count ? units.denominator : 1n),
    ));
    salesRows++;
  }
  return { cents: safeCents(total), salesRows, skippedCurrencies };
}

export function parseFinanceReport(text) {
  const totals = new Map();
  let startDate = "";
  let endDate = "";
  for (const [start, end, amount, currency] of reportRows(text, financeColumns)) {
    const first = dateOnly(start);
    const last = dateOnly(end);
    const cents = minorUnits(amount);
    if (!first || !last || first > last || cents === null || !/^[A-Z]{3}$/.test(currency)) throw invalidReport();
    if (!startDate || first < startDate) startDate = first;
    if (!endDate || last > endDate) endDate = last;
    totals.set(currency, (totals.get(currency) || 0n) + BigInt(cents));
  }
  if (!startDate) throw invalidReport();
  return {
    startDate, endDate,
    proceeds: [...totals].sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, amount]) => ({ currency, cents: safeCents(amount) })),
  };
}

export async function downloadAppStoreReport(credential, kind, period) {
  if (!validReportPeriod(kind, period)) throw new AppStoreReportError("invalid_app_store_period", 400);
  const url = new URL(kind === "sales"
    ? "https://api.appstoreconnect.apple.com/v1/salesReports"
    : "https://api.appstoreconnect.apple.com/v1/financeReports");
  const filters = kind === "sales"
    ? { reportType: "SALES", reportSubType: "SUMMARY", frequency: "DAILY", version: "1_0" }
    : { reportType: "FINANCIAL", regionCode: "ZZ" };
  for (const [key, value] of Object.entries({ ...filters, vendorNumber: credential.vendorNumber, reportDate: period })) {
    url.searchParams.set(`filter[${key}]`, value);
  }
  const token = await appStoreReportToken(credential, kind);
  let response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/a-gzip" },
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new AppStoreReportError("app_store_unreachable", 502);
  }
  if (response.status === 404) return null;
  if (response.status === 401) throw new AppStoreReportError("app_store_auth_failed", 400);
  if (response.status === 403) throw new AppStoreReportError("app_store_permission_denied", 403);
  if (response.status === 429) throw new AppStoreReportError("app_store_rate_limited", 429);
  if (!response.ok) throw new AppStoreReportError("app_store_download_failed", 502);
  try {
    const text = await reportText(response);
    return kind === "sales" ? parseSalesReport(text, period) : parseFinanceReport(text);
  } catch (error) {
    if (error instanceof AppStoreReportError) throw error;
    throw invalidReport();
  }
}

export const appStorePayoutRef = (vendor, period) => `asc:payout:${vendor}:${period}`;

export async function saveAppStoreReport(db, workspace, integration, kind, period, report) {
  const timestamp = new Date().toISOString();
  const connection = [integration.id, workspace.id, integration.encrypted_credentials];
  const stillConnected = "FROM integrations WHERE id = ? AND workspace_id = ? AND encrypted_credentials = ?";
  let write;
  if (kind === "finance") {
    write = db.prepare(
      `INSERT INTO app_store_financial_reports
        (workspace_id, vendor_number, period, start_date, end_date, proceeds_json, imported_at)
       SELECT ?, ?, ?, ?, ?, ?, ? ${stillConnected}
       ON CONFLICT(workspace_id, vendor_number, period) DO UPDATE SET
         start_date = excluded.start_date, end_date = excluded.end_date, proceeds_json = excluded.proceeds_json,
         imported_at = excluded.imported_at`,
    ).bind(workspace.id, integration.report_vendor_number, period, report.startDate, report.endDate,
      JSON.stringify(report.proceeds), timestamp, ...connection);
  } else {
    const cents = report.cents;
    const fee = safeCents(roundCents(percent(exact(BigInt(cents)), workspace.apple_fee_rate === 0.15 ? 15
      : workspace.apple_fee_rate === 0.30 ? 30 : 0)));
    write = db.prepare(
      `INSERT INTO income_entries
        (id, workspace_id, external_ref, occurred_on, source, amount, amount_cents, platform_fee,
         platform_fee_cents, sale_date, recognition, payout_status, created_at, updated_at)
       SELECT ?, ?, ?, ?, 'app_store', ?, ?, ?, ?, ?, 'sold', 'reported_sales', ?, ? ${stillConnected}
       ON CONFLICT(workspace_id, external_ref) DO UPDATE SET amount = excluded.amount,
         amount_cents = excluded.amount_cents, platform_fee = excluded.platform_fee,
         platform_fee_cents = excluded.platform_fee_cents, updated_at = excluded.updated_at`,
    ).bind(crypto.randomUUID(), workspace.id, `asc:sales:${integration.report_vendor_number}:${period}`, period,
      usd(cents), cents, usd(fee), fee, period, timestamp, timestamp, ...connection);
  }
  const results = await db.batch([
    write,
    db.prepare("UPDATE integrations SET status = 'connected', last_error = NULL, last_sync_at = ? WHERE id = ? AND workspace_id = ? AND encrypted_credentials = ?")
      .bind(timestamp, ...connection),
  ]);
  if (!results[0].meta.changes) throw new AppStoreReportError("app_store_connection_changed", 409);
}

export async function loadAppStoreFinance(db, workspaceId) {
  const reports = await db.prepare(
    `SELECT r.vendor_number, r.period, r.start_date, r.end_date, r.proceeds_json, r.imported_at,
      i.occurred_on AS received_on, i.amount_cents AS received_cents
     FROM app_store_financial_reports r
     LEFT JOIN income_entries i ON i.workspace_id = r.workspace_id
       AND i.external_ref = 'asc:payout:' || r.vendor_number || ':' || r.period
     WHERE r.workspace_id = ? ORDER BY r.period DESC, r.vendor_number`,
  ).bind(workspaceId).all();
  return (reports.results || []).map((row) => ({
    vendorNumber: row.vendor_number,
    period: row.period,
    startDate: row.start_date,
    endDate: row.end_date,
    proceeds: JSON.parse(row.proceeds_json),
    importedAt: row.imported_at,
    receivedOn: row.received_on,
    receivedCents: row.received_cents,
  }));
}

export async function confirmAppStorePayout(db, workspace, payload) {
  const { vendorNumber, period, date, amount } = payload || {};
  const time = new Date();
  const receivedOn = typeof date === "string" && dateOnly(date);
  const cents = typeof amount === "string" && minorUnits(amount);
  if (typeof vendorNumber !== "string" || !vendorPattern.test(vendorNumber)
    || !validReportPeriod("finance", period) || receivedOn !== date || !receivedOn
    || receivedOn > dayInTimeZone(time, workspace.timezone) || !(cents > 0)) {
    throw new AppStoreReportError("invalid_app_store_payout", 400);
  }
  const timestamp = time.toISOString();
  const result = await db.prepare(
    `INSERT INTO income_entries
      (id, workspace_id, external_ref, occurred_on, source, amount, amount_cents,
       platform_fee, platform_fee_cents, recognition, payout_status, created_at, updated_at)
     SELECT ?, workspace_id, ?, ?, 'app_store', ?, ?, 0, 0, 'received', 'confirmed_payout', ?, ?
     FROM app_store_financial_reports WHERE workspace_id = ? AND vendor_number = ? AND period = ?
     ON CONFLICT(workspace_id, external_ref) DO UPDATE SET occurred_on = excluded.occurred_on,
       amount = excluded.amount, amount_cents = excluded.amount_cents, updated_at = excluded.updated_at`,
  ).bind(crypto.randomUUID(), appStorePayoutRef(vendorNumber, period), receivedOn,
    usd(cents), cents, timestamp, timestamp, workspace.id, vendorNumber, period).run();
  if (!result.meta.changes) throw new AppStoreReportError("app_store_finance_not_found", 404);
}
