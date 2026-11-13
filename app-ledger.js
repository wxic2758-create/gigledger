(() => {
  const root = document.documentElement;
  const locale = root.dataset.locale === "zh-TW" ? "zh-TW" : "en";
  const messages = JSON.parse(document.getElementById("proto-messages").textContent);
  const dashboardMode = Boolean(document.querySelector("[data-dashboard]"));
  const state = { fixedCosts: [], income: [], taxReserveRate: "", cashOnHand: "" };

  const currency = new Intl.NumberFormat(locale === "zh-TW" ? "zh-TW" : "en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  });
  const money = (value) => currency.format(Number.isFinite(value) ? value : 0);
  const day = new Intl.NumberFormat(locale === "zh-TW" ? "zh-TW" : "en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const dayMoney = (value) => `$${day.format(Number.isFinite(value) ? value : 0)}`;
  const today = () => new Date().toISOString().slice(0, 10);
  const set = (key, value) => {
    const node = document.querySelector(`[data-proto="${key}"]`);
    if (node) node.textContent = value;
  };
  const cycles = [
    { value: "daily", multiplier: 365 },
    { value: "weekly", multiplier: 52 },
    { value: "biweekly", multiplier: 26 },
    { value: "monthly", multiplier: 12 },
    { value: "quarterly", multiplier: 4 },
    { value: "yearly", multiplier: 1 },
  ];

  const calculate = () => {
    const dailyFloor = state.fixedCosts.reduce(
      (sum, item) => sum + (Number(item.amount) || 0) * (Number(item.multiplier) || 0)
        * (Number(item.businessUse) || 0) / 100 / 365, 0,
    );
    const grossIncome = state.income.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const platformFees = state.income.reduce((sum, item) => sum + (Number(item.platformFee) || 0), 0);
    const netIncome = grossIncome - platformFees;
    const monthlyFixedCosts = state.fixedCosts.reduce(
      (sum, item) => sum + (Number(item.amount) || 0) * (Number(item.multiplier) || 0) / 12, 0,
    );
    const rate = Number(state.taxReserveRate) / 100;
    return {
      dailyFloor, grossIncome, platformFees, netIncome, monthlyFixedCosts,
      trueProfit: netIncome - monthlyFixedCosts,
      taxReserve: Number.isFinite(rate) && state.taxReserveRate !== "" && rate >= 0
        ? netIncome * rate
        : null,
    };
  };

  const renderMetrics = () => {
    const result = calculate();
    set("metric-daily", dayMoney(result.dailyFloor));
    set("metric-gross", money(result.grossIncome));
    set("metric-fees", money(result.platformFees));
    set("metric-net", money(result.netIncome));
    set("metric-profit", money(result.trueProfit));
    const taxNode = document.querySelector("[data-proto='metric-tax']");
    if (taxNode) taxNode.textContent = result.taxReserve === null ? messages.taxUnset : money(result.taxReserve);
    set("metric-costs", money(result.monthlyFixedCosts));
  };

  const renderFixedCosts = () => {
    const tbody = document.querySelector("[data-proto='fixed-cost-rows']");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!state.fixedCosts.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="5">${messages.empty.fixed}</td>`;
      tbody.appendChild(row);
      return;
    }
    state.fixedCosts.forEach((item) => {
      const row = document.createElement("tr");
      const cycleLabel = messages.cycles[item.cycle] || item.cycle;
      const name = document.createElement("td"); name.textContent = item.name;
      const cycle = document.createElement("td"); cycle.textContent = cycleLabel;
      const amount = document.createElement("td"); amount.textContent = money(Number(item.amount));
      const use = document.createElement("td"); use.textContent = `${Number(item.businessUse)}%`;
      const cost = document.createElement("td");
      cost.textContent = dayMoney(Number(item.amount) * Number(item.multiplier) * Number(item.businessUse) / 100 / 365);
      row.append(name, cycle, amount, use, cost);
      tbody.appendChild(row);
    });
  };

  const renderIncome = () => {
    const tbody = document.querySelector("[data-proto='income-rows']");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!state.income.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="5">${messages.empty.income}</td>`;
      tbody.appendChild(row);
      return;
    }
    state.income.forEach((item) => {
      const row = document.createElement("tr");
      const net = (Number(item.amount) || 0) - (Number(item.platformFee) || 0);
      const dateCell = document.createElement("td"); dateCell.textContent = item.date;
      const source = document.createElement("td"); source.textContent = item.client || item.source;
      const amount = document.createElement("td"); amount.textContent = money(Number(item.amount));
      const fee = document.createElement("td"); fee.textContent = money(Number(item.platformFee));
      const netCell = document.createElement("td"); netCell.textContent = money(net);
      row.append(dateCell, source, amount, fee, netCell);
      tbody.appendChild(row);
    });
  };

  const render = () => {
    renderMetrics();
    renderFixedCosts();
    renderIncome();
  };

  const fixedForm = document.querySelector("[data-proto-form='fixed']");
  if (fixedForm) {
    fixedForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(fixedForm);
      const selected = cycles.find((cycle) => cycle.value === data.get("cycle"));
      state.fixedCosts.push({
        name: String(data.get("name") || ""),
        cycle: selected?.value || "monthly",
        multiplier: selected?.multiplier || 12,
        amount: Number(data.get("amount")) || 0,
        businessUse: Number(data.get("businessUse")) || 0,
      });
      fixedForm.reset();
      fixedForm.elements.businessUse.value = "100";
      fixedForm.elements.cycle.value = "monthly";
      render();
    });
  }

  const incomeForm = document.querySelector("[data-proto-form='income']");
  if (incomeForm) {
    incomeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(incomeForm);
      state.income.push({
        date: String(data.get("date") || today()),
        source: String(data.get("source") || ""),
        client: String(data.get("client") || ""),
        amount: Number(data.get("amount")) || 0,
        platformFee: Number(data.get("platformFee")) || 0,
      });
      incomeForm.reset();
      incomeForm.elements.date.value = today();
      render();
    });
  }

  const showMessage = (message) => {
    const node = document.querySelector("[data-save-message]");
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
  };

  const saveDraft = async () => {
    const button = document.querySelector("[data-save-google]");
    if (!button) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = messages.saving;
    document.querySelector("[data-save-message]").hidden = true;
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fixedCosts: state.fixedCosts,
          income: state.income,
          taxReserveRate: state.taxReserveRate,
          cashOnHand: state.cashOnHand,
          locale,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.authUrl) throw new Error("save_failed");
      window.location.assign(data.authUrl);
    } catch {
      button.disabled = false;
      button.textContent = original;
      showMessage(messages.saveFailed);
    }
  };

  document.querySelector("[data-save-google]")?.addEventListener("click", saveDraft);
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!form?.dataset?.protoForm || form.dataset.protoForm !== "settings") return;
    event.preventDefault();
    const data = new FormData(form);
    state.taxReserveRate = String(data.get("taxReserveRate") || "");
    state.cashOnHand = String(data.get("cashOnHand") || "");
    render();
  });

  const loadDashboard = async () => {
    if (!dashboardMode) return;
    try {
      const response = await fetch("/api/me", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.authenticated || !data.ledger) {
        window.location.assign(`/${locale}/app`);
        return;
      }
      state.taxReserveRate = data.ledger.workspace?.taxReserveRate === null
        || data.ledger.workspace?.taxReserveRate === undefined
        ? "" : String(Math.round(data.ledger.workspace.taxReserveRate * 100));
      state.cashOnHand = data.ledger.workspace?.cashOnHand === null
        || data.ledger.workspace?.cashOnHand === undefined
        ? "" : String(data.ledger.workspace.cashOnHand);
      const cycleValues = new Set(cycles.map((cycle) => cycle.value));
      state.fixedCosts = (data.ledger.fixedCosts || []).map((item) => ({
        name: item.name,
        amount: Number(item.amount) || 0,
        cycle: cycleValues.has(item.cycle) ? item.cycle : "monthly",
        multiplier: cycles.find((cycle) => cycle.value === (cycleValues.has(item.cycle) ? item.cycle : "monthly"))?.multiplier || 12,
        businessUse: Number(item.businessUse) || 0,
      }));
      state.income = (data.ledger.income || []).map((item) => ({
        date: item.date,
        source: item.source,
        client: item.client || "",
        amount: Number(item.amount) || 0,
        platformFee: Number(item.platformFee) || 0,
      }));
      const settingsForm = document.querySelector("[data-proto-form='settings']");
      if (settingsForm) {
        settingsForm.elements.taxReserveRate.value = state.taxReserveRate;
        settingsForm.elements.cashOnHand.value = state.cashOnHand;
      }
      render();
    } catch {
      window.location.assign(`/${locale}/app`);
    }
  };

  loadDashboard();
  render();
})();

  const confirmDelete = () => {
    if (!window.confirm(messages.deleteConfirm)) return;
    window.location.assign("/api/workspace?type=account");
  };
  document.querySelector("[data-delete-account]")?.addEventListener("click", confirmDelete);
