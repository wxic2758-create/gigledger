(() => {
  const root = document.documentElement;
  const locale = root.dataset.locale === "zh-TW" ? "zh-TW" : "en";
  const messages = JSON.parse(document.getElementById("proto-messages").textContent);
  const state = {
    fixedCosts: [],
    income: [],
  };

  const currency = new Intl.NumberFormat(locale === "zh-TW" ? "zh-TW" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  const money = (value) => currency.format(Number.isFinite(value) ? value : 0);
  const day = new Intl.NumberFormat(locale === "zh-TW" ? "zh-TW" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
      (sum, item) => sum + (Number(item.amount) || 0) * (Number(item.multiplier) || 0) * (Number(item.businessUse) || 0) / 100 / 365,
      0,
    );
    const grossIncome = state.income.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const platformFees = state.income.reduce((sum, item) => sum + (Number(item.platformFee) || 0), 0);
    const netIncome = grossIncome - platformFees;
    const monthlyFixedCosts = state.fixedCosts.reduce(
      (sum, item) => sum + (Number(item.amount) || 0) * (Number(item.multiplier) || 0) / 12,
      0,
    );
    const taxReserve = netIncome * 0.15;
    return {
      dailyFloor,
      grossIncome,
      platformFees,
      netIncome,
      monthlyFixedCosts,
      trueProfit: netIncome - monthlyFixedCosts,
      taxReserve,
    };
  };

  const renderMetrics = () => {
    const result = calculate();
    set("metric-daily", dayMoney(result.dailyFloor));
    set("metric-gross", money(result.grossIncome));
    set("metric-fees", money(result.platformFees));
    set("metric-net", money(result.netIncome));
    set("metric-profit", money(result.trueProfit));
    set("metric-tax", money(result.taxReserve));
    set("metric-costs", money(result.monthlyFixedCosts));
  };

  const renderFixedCosts = () => {
    const tbody = document.querySelector("[data-proto='fixed-cost-rows']");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!state.fixedCosts.length) {
      tbody.innerHTML = `<tr><td colspan="5">${messages.empty.fixed}</td></tr>`;
      return;
    }
    state.fixedCosts.forEach((item) => {
      const row = document.createElement("tr");
      const cycleLabel = messages.cycles[item.cycle] || item.cycle;
      row.innerHTML = `
        <td>${item.name}</td>
        <td>${cycleLabel}</td>
        <td>${money(Number(item.amount))}</td>
        <td>${Number(item.businessUse)}%</td>
        <td>${dayMoney(Number(item.amount) * Number(item.multiplier) * Number(item.businessUse) / 100 / 365)}</td>`;
      tbody.appendChild(row);
    });
  };

  const renderIncome = () => {
    const tbody = document.querySelector("[data-proto='income-rows']");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!state.income.length) {
      tbody.innerHTML = `<tr><td colspan="5">${messages.empty.income}</td></tr>`;
      return;
    }
    state.income.forEach((item) => {
      const row = document.createElement("tr");
      const net = (Number(item.amount) || 0) - (Number(item.platformFee) || 0);
      row.innerHTML = `
        <td>${item.date}</td>
        <td>${item.client || item.source}</td>
        <td>${money(Number(item.amount))}</td>
        <td>${money(Number(item.platformFee))}</td>
        <td>${money(net)}</td>`;
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
      render();
    });
  }

  render();
})();
