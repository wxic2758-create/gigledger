import { usd } from "./money.js?v=20261126-02";

export function setupAppStore({ copy, locale, canSync, day, onLedger, onChange }) {
  const panel = document.querySelector("#app-store-connect");
  if (!panel) return null;
  const node = (selector) => panel.querySelector(selector);
  const setup = node("[data-app-store-setup]");
  const form = node("[data-app-store-form]");
  const fileInput = node("[data-app-store-file]");
  const disconnect = node("[data-app-store-disconnect]");
  const syncForms = [...panel.querySelectorAll("[data-app-store-sync]")];
  const financeSection = node("[data-app-store-finance]");
  const periodSelect = node("[data-app-store-period]");
  const payoutForm = node("[data-app-store-payout]");
  const statusNode = node("[data-app-store-message]");
  const payoutStatus = node("[data-app-store-payout-message]");
  let connection = null;
  let reports = [];
  let busy = false;
  const periodKey = (report) => `${report.vendorNumber}:${report.period}`;

  const show = (text, error = false, target = statusNode) => {
    target.textContent = text;
    target.hidden = !text;
    target.dataset.error = String(error);
  };
  const errorText = (code) => Object.hasOwn(copy.errors, code) ? copy.errors[code] : copy.errors.app_store_sync_failed;
  const selectedReport = () => reports.find((report) => periodKey(report) === periodSelect.value);

  function renderSelectedReport() {
    const report = selectedReport();
    show("", false, payoutStatus);
    if (!report) return;
    const totals = report.proceeds.map(({ currency, cents }) => {
      const format = new Intl.NumberFormat(locale, {
        style: "currency", currency, currencyDisplay: "code",
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
      return format.format(usd(cents));
    });
    node("[data-app-store-finance-totals]").textContent = [
      `${report.startDate} – ${report.endDate}`, totals.join(" · "),
    ].join(" · ");
    payoutForm.elements.date.max = day();
    payoutForm.elements.date.value = report.receivedOn || "";
    payoutForm.elements.amount.value = report.receivedCents === null ? "" : usd(report.receivedCents).toFixed(2);
    payoutForm.querySelector("button").textContent = report.receivedOn ? copy.updatePayout : copy.recordPayout;
  }

  function updateReports(list) {
    const selected = periodSelect.value;
    reports = list || [];
    const vendors = new Set(reports.map(({ vendorNumber }) => vendorNumber));
    periodSelect.replaceChildren(...reports.map((report) => new Option(
      vendors.size > 1 ? `${report.period} · ${report.vendorNumber}` : report.period,
      periodKey(report),
    )));
    if (reports.some((report) => periodKey(report) === selected)) periodSelect.value = selected;
    financeSection.hidden = reports.length === 0;
    renderSelectedReport();
  }

  function render() {
    const allowed = canSync();
    const hasVendor = Boolean(connection?.vendorNumber);
    setup.hidden = !allowed;
    setup.querySelector("summary").textContent = connection ? copy.replaceKey : copy.connect;
    node("[data-app-store-controls]").hidden = !hasVendor || !allowed;
    node("[data-app-store-plan]").hidden = allowed;
    node("[data-app-store-state]").textContent = !connection ? copy.notConnected
      : !hasVendor ? copy.needsVendor
      : connection.status === "pending" ? copy.keySaved : copy.connected;
    disconnect.hidden = !connection;
    panel.querySelectorAll("button").forEach((button) => { button.disabled = busy; });
    onChange();
  }

  async function request(url, method, payload) {
    const response = await fetch(url, {
      method, credentials: "same-origin",
      ...(payload ? { headers: { "content-type": "application/json" }, body: JSON.stringify(payload) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "app_store_sync_failed");
    return data;
  }

  async function run(task, target = statusNode) {
    if (busy) return;
    busy = true;
    render();
    show(copy.working, false, target);
    try {
      const result = await task();
      show(result, false, target);
    } catch (error) {
      show(errorText(error.message), true, target);
    } finally {
      busy = false;
      render();
    }
  }

  fileInput.addEventListener("change", () => {
    const match = /^AuthKey_([A-Z0-9]{6,12})\.p8$/i.exec(fileInput.files?.[0]?.name || "");
    if (match) form.elements.keyId.value = match[1].toUpperCase();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canSync()) return;
    const file = fileInput.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".p8") || file.size > 4096) {
      show(errorText("invalid_app_store_private_key"), true);
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    void run(async () => {
      const result = await request("/api/workspace/integrations", "POST", {
        ...data, type: "app_store", privateKey: await file.text(),
      });
      connection = { status: result.status, vendorNumber: result.vendorNumber };
      form.reset();
      setup.open = false;
      return result.status === "pending" ? copy.savedNoReports : copy.saved;
    });
  });
  for (const syncForm of syncForms) {
    syncForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!canSync() || !connection?.vendorNumber) return;
      const kind = syncForm.dataset.appStoreSync;
      const period = syncForm.elements.period.value;
      void run(async () => {
        const result = await request("/api/workspace/integrations/sync?type=app_store", "POST", { kind, period });
        if (!result.available) return copy.noReport;
        connection = { ...connection, status: "connected", lastError: null };
        if (result.ledger) onLedger(result.ledger);
        if (kind === "finance") {
          updateReports(result.financeReports);
          const key = `${connection.vendorNumber}:${period}`;
          if (reports.some((report) => periodKey(report) === key)) {
            periodSelect.value = key;
            renderSelectedReport();
          }
          return copy.financeSynced;
        }
        return copy.salesSynced.replace("{count}", String(result.salesRows))
          + (result.skippedCurrencies ? ` ${copy.skippedCurrencies.replace("{count}", String(result.skippedCurrencies))}` : "");
      });
    });
  }
  periodSelect.addEventListener("change", renderSelectedReport);
  payoutForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const report = selectedReport();
    if (!report) return;
    const { date, amount } = Object.fromEntries(new FormData(payoutForm));
    void run(async () => {
      const result = await request("/api/workspace/integrations/app-store-payout", "POST", {
        vendorNumber: report.vendorNumber, period: report.period, date, amount,
      });
      updateReports(result.financeReports);
      onLedger(result.ledger);
      return copy.payoutSaved;
    }, payoutStatus);
  });
  disconnect.addEventListener("click", () => {
    if (!window.confirm(copy.disconnectConfirm)) return;
    void run(async () => {
      try {
        await request("/api/workspace/integrations?type=app_store", "DELETE");
      } catch {
        throw new Error("app_store_disconnect_failed");
      }
      connection = null;
      return copy.disconnected;
    });
  });

  return {
    load(data) {
      connection = (data.integrations || []).find((item) => item.type === "app_store") || null;
      for (const syncForm of syncForms) {
        const input = syncForm.elements.period;
        if (!input.value) input.value = data.appStoreDefaults?.[syncForm.dataset.appStoreSync] || "";
      }
      updateReports(data.financeReports);
      if (connection?.lastError) show(errorText(connection.lastError), true);
      render();
    },
    render,
    needsAttention: () => Boolean(connection && (!connection.vendorNumber || connection.lastError)),
  };
}
