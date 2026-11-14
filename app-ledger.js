(() => {
  const root = document.documentElement;
  const locale = root.dataset.locale === "zh-TW" ? "zh-TW" : "en";
  const messages = JSON.parse(document.getElementById("proto-messages").textContent);
  const dashboardMode = Boolean(document.querySelector("[data-dashboard]"));
  const state = { fixedCosts: [], income: [], expenses: [], taxReserveRate: "", cashOnHand: "" };

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
  const monthDayCount = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  };

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
    const monthlyExpenses = state.expenses.reduce(
      (sum, item) => sum + (Number(item.amount) || 0) * (Number(item.businessUse) || 0) / 100, 0,
    );
    const rate = Number(state.taxReserveRate) / 100;
    return {
      dailyFloor, grossIncome, platformFees, netIncome, monthlyFixedCosts,
      monthlyExpenses,
      trueProfit: netIncome - monthlyFixedCosts - monthlyExpenses,
      taxReserve: Number.isFinite(rate) && state.taxReserveRate !== "" && rate >= 0
        ? netIncome * rate
        : null,
      requiredToDate: dailyFloor * monthDayCount(),
      comparison: netIncome - dailyFloor * monthDayCount(),
      savings: state.cashOnHand === "" ? null : Number(state.cashOnHand),
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
    set("metric-expenses", money(result.monthlyExpenses));
    set("metric-required", money(result.requiredToDate));
    set("metric-comparison", money(Math.abs(result.comparison)));
    const comparisonNode = document.querySelector("[data-proto='metric-comparison']");
    if (comparisonNode) {
      comparisonNode.textContent = result.comparison < 0
        ? messages.metrics.ahead.replace("{amount}", money(Math.abs(result.comparison)))
        : messages.metrics.behind.replace("{amount}", money(result.comparison));
    }
    const runwayNode = document.querySelector("[data-proto='metric-runway']");
    if (runwayNode) {
      runwayNode.textContent = result.savings === null || !Number.isFinite(result.savings) || result.savings <= 0
        ? messages.metrics.runwayUnset
        : messages.metrics.runwayZero.replace("{days}", String(Math.floor(result.savings / result.dailyFloor)));
    }
  };

  const deleteButton = (type, id) => {
    const cell = document.createElement("td");
    if (!id) return cell;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "entry-delete";
    button.textContent = messages.deleteEntry;
    button.setAttribute("data-delete-entry", "");
    button.setAttribute("data-entry-type", type);
    button.setAttribute("data-entry-id", id);
    cell.appendChild(button);
    return cell;
  };

  const linkButton = (label, url) => {
    if (!url) return document.createTextNode("");
    const anchor = document.createElement("a");
    anchor.className = "entry-link";
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = label;
    return anchor;
  };

  const linkCell = (item) => {
    const cell = document.createElement("td");
    const links = [
      linkButton(messages.fixed.openProduct, item.productUrl),
      linkButton(messages.fixed.manageSubscription, item.manageUrl),
    ].filter((node) => node.nodeType === Node.TEXT_NODE || node.tagName === "A");
    if (!links.length) return cell;
    cell.className = "entry-links";
    links.forEach((node, index) => {
      if (index) cell.append(document.createTextNode(" · "));
      cell.append(node);
    });
    return cell;
  };

  const renderFixedCosts = () => {
    const tbody = document.querySelector("[data-proto='fixed-cost-rows']");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!state.fixedCosts.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="9">${messages.empty.fixed}</td>`;
      tbody.appendChild(row);
      return;
    }
    state.fixedCosts.forEach((item) => {
      const row = document.createElement("tr");
      const isSubscription = Boolean(item.isSubscription);
      const cycleLabel = messages.cycles[item.cycle] || item.cycle;
      const name = document.createElement("td"); name.textContent = item.name;
      const type = document.createElement("td"); type.textContent = isSubscription ? messages.fixed.subscription : messages.fixed.other;
      const cycle = document.createElement("td"); cycle.textContent = cycleLabel;
      const amount = document.createElement("td"); amount.textContent = money(Number(item.amount));
      const use = document.createElement("td"); use.textContent = `${Number(item.businessUse)}%`;
      const effective = document.createElement("td");
      effective.textContent = item.startDate ? `${item.startDate}${item.endDate ? ` – ${item.endDate}` : ""}` : "";
      const cost = document.createElement("td");
      cost.textContent = dayMoney(Number(item.amount) * Number(item.multiplier) * Number(item.businessUse) / 100 / 365);
      const actions = document.createElement("td");
      if (isSubscription) {
        const review = document.createElement("div");
        review.className = "subscription-review";
        const answers = ["often", "sometimes", "not_used"];
        const currentAnswer = item.reviews?.find((reviewItem) => reviewItem.period === new Date().toISOString().slice(0, 7))?.answer;
        const suggestedCancel = (item.reviews || []).filter((reviewItem) => reviewItem.answer === "not_used").slice(0, 2).length === 2;
        if (suggestedCancel) {
          const badge = document.createElement("span");
          badge.className = "cancel-badge";
          badge.textContent = messages.subscriptionReview.suggestedCancel;
          review.append(badge);
        } else if (item.nextBillingDate) {
          const todayDate = new Date();
          const billingDate = new Date(`${item.nextBillingDate}T00:00:00Z`);
          const daysUntil = Math.ceil((billingDate - todayDate) / 86400000);
          if (daysUntil <= 3) {
            const reminder = document.createElement("span");
            reminder.className = "review-hint";
            reminder.textContent = messages.subscriptionReview.upcoming
              .replace("{date}", item.nextBillingDate)
              .replace("{amount}", money(Number(item.amount)));
            review.append(reminder);
          }
        }
        const answerGroup = document.createElement("div");
        answerGroup.className = "review-actions";
        answers.forEach((answer) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "review-button" + (currentAnswer === answer ? " active" : "");
          button.textContent = messages.subscriptionReview[answer];
          button.setAttribute("data-review-answer", answer);
          button.setAttribute("data-entry-id", item.id);
          answerGroup.append(button);
        });
        review.append(answerGroup);
        const hint = document.createElement("small");
        hint.textContent = messages.subscriptionReview.reviewHint;
        review.append(hint);
        actions.append(review);
      } else {
        actions.append(deleteButton("fixed-cost", item.id));
      }
      const rowActions = document.createElement("td");
      rowActions.append(actions);
      row.append(name, type, cycle, amount, use, effective, linkCell(item), cost, rowActions, deleteButton("fixed-cost", item.id));
      tbody.appendChild(row);
    });
  };

  const renderIncome = () => {
    const tbody = document.querySelector("[data-proto='income-rows']");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!state.income.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="6">${messages.empty.income}</td>`;
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
      row.append(dateCell, source, amount, fee, netCell, deleteButton("income", item.id));
      tbody.appendChild(row);
    });
  };

  const renderExpenses = () => {
    const tbody = document.querySelector("[data-proto='expense-rows']");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!state.expenses.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="7">${messages.empty.expenses}</td>`;
      tbody.appendChild(row);
      return;
    }
    state.expenses.forEach((item) => {
      const row = document.createElement("tr");
      const businessAmount = (Number(item.amount) || 0) * (Number(item.businessUse) || 0) / 100;
      const dateCell = document.createElement("td"); dateCell.textContent = item.date;
      const category = document.createElement("td"); category.textContent = item.category;
      const merchant = document.createElement("td"); merchant.textContent = item.merchant || "";
      const amount = document.createElement("td"); amount.textContent = money(Number(item.amount));
      const use = document.createElement("td"); use.textContent = `${Number(item.businessUse)}%`;
      const business = document.createElement("td"); business.textContent = money(businessAmount);
      row.append(dateCell, category, merchant, amount, use, business, deleteButton("expense", item.id));
      tbody.appendChild(row);
    });
  };

  const render = () => {
    renderMetrics();
    renderFixedCosts();
    renderIncome();
    renderExpenses();
  };

  const fixedForm = document.querySelector("[data-proto-form='fixed']");
  if (fixedForm) {
    fixedForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(fixedForm);
      const selected = cycles.find((cycle) => cycle.value === data.get("cycle"));
      const startDate = String(data.get("startDate") || today());
      state.fixedCosts.push({
        name: String(data.get("name") || ""),
        cycle: selected?.value || "monthly",
        multiplier: selected?.multiplier || 12,
        amount: Number(data.get("amount")) || 0,
        businessUse: Number(data.get("businessUse")) || 0,
        startDate,
        endDate: String(data.get("endDate") || "") || null,
        isSubscription: data.get("isSubscription") === "on",
        productUrl: String(data.get("productUrl") || "") || null,
        manageUrl: String(data.get("manageUrl") || "") || null,
        nextBillingDate: String(data.get("nextBillingDate") || "") || null,
      });
      fixedForm.reset();
      fixedForm.elements.startDate.value = today();
      fixedForm.elements.businessUse.value = "100";
      fixedForm.elements.cycle.value = "monthly";
      const subscriptionFields = document.querySelector("[data-subscription-fields]");
      if (subscriptionFields) subscriptionFields.hidden = true;
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

  const expenseForm = document.querySelector("[data-proto-form='expense']");
  if (expenseForm) {
    expenseForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(expenseForm);
      state.expenses.push({
        date: String(data.get("date") || today()),
        category: String(data.get("category") || ""),
        merchant: String(data.get("merchant") || ""),
        amount: Number(data.get("amount")) || 0,
        businessUse: Number(data.get("businessUse")) || 100,
        notes: String(data.get("notes") || ""),
      });
      expenseForm.reset();
      expenseForm.elements.date.value = today();
      expenseForm.elements.businessUse.value = "100";
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
          expenses: state.expenses,
          taxReserveRate: state.taxReserveRate,
          cashOnHand: state.cashOnHand,
          locale,
        }),
      });
      const data = await response.json().catch(() => ({}));
      const destination = data.authUrl || data.redirectUrl;
      if (!response.ok || !destination) throw new Error("save_failed");
      window.location.assign(destination);
    } catch {
      button.disabled = false;
      button.textContent = original;
      showMessage(messages.saveFailed);
    }
  };

  document.querySelector("[data-save-google]")?.addEventListener("click", saveDraft);
  const csvMessage = (node, message) => {
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
  };
  const csvFailedCsv = (rows) => {
    const headers = ["line_number", "reason", "date", "source", "amount", "platform_fee", "client", "external_ref", "notes"];
    const escape = (value) => {
      const raw = value === null || value === undefined ? "" : String(value);
      return /[",\n\r]/.test(raw) ? `"${raw.replaceAll("\"", "\"\"")}"` : raw;
    };
    const line = (row) => headers.map((header) => escape(row[header])).join(",");
    return [headers.join(","), ...rows.map(line)].join("\n");
  };
  document.querySelector("[data-csv-import]")?.addEventListener("change", async (event) => {
    const input = event.target;
    const label = document.querySelector("[data-csv-import-label]");
    const status = document.querySelector("[data-csv-message]");
    const failedStatus = document.querySelector("[data-csv-failed-message]");
    const failedLink = document.querySelector("[data-csv-failed-download]");
    const file = input.files?.[0];
    if (!status || !failedStatus || !failedLink || !file) {
      csvMessage(status, messages.csv.invalidFile);
      return;
    }
    const original = label?.textContent || messages.csv.import;
    if (label) label.textContent = messages.csv.importing;
    status.hidden = true;
    failedStatus.hidden = true;
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/workspace/csv", { method: "POST", body, credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "import_failed");
      csvMessage(status, messages.csv.result.replaceAll("{imported}", String(data.imported || 0)).replaceAll("{failed}", String(data.failed || 0)));
      if (data.failedRows?.length) {
        const blob = new Blob([csvFailedCsv(data.failedRows)], { type: "text/csv;charset=utf-8" });
        failedLink.href = URL.createObjectURL(blob);
        failedStatus.hidden = false;
      }
      const dashboardMode = Boolean(document.querySelector("[data-dashboard]"));
      if (dashboardMode && data.imported) await loadDashboard();
    } catch (error) {
      const reason = error?.message === "empty_file" ? messages.csv.emptyFile : messages.csv.importFailed;
      csvMessage(status, reason);
    } finally {
      if (label) label.textContent = original;
      input.value = "";
    }
  });
  const confirmDelete = () => {
    if (!window.confirm(messages.deleteConfirm)) return;
    window.location.assign("/api/workspace?type=account");
  };
  document.querySelector("[data-delete-account]")?.addEventListener("click", confirmDelete);
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-entry]");
    if (!button || button.disabled) return;
    if (!window.confirm(messages.deleteEntryConfirm)) return;
    if (!dashboardMode) {
      const type = button.dataset.entryType;
      const key = type === "fixed-cost" ? "fixedCosts" : type === "income" ? "income" : "expenses";
      state[key] = state[key].filter((item) => String(item.id) !== button.dataset.entryId);
      render();
      return;
    }
    button.disabled = true;
    try {
      const id = button.dataset.entryId;
      const response = await fetch(`/api/workspace?type=${button.dataset.entryType}&id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ledger) throw new Error("delete_entry_failed");
      applyLedger(data.ledger);
      const settingsForm = document.querySelector('[data-proto-form="settings"]');
      if (settingsForm) {
        settingsForm.elements.taxReserveRate.value = state.taxReserveRate;
        settingsForm.elements.cashOnHand.value = state.cashOnHand;
      }
      render();
    } catch {
      button.disabled = false;
      window.alert(messages.deleteEntryFailed);
    }
  });
  const settingsForm = document.querySelector('[data-proto-form="settings"]');
  settingsForm?.addEventListener("input", () => {
    state.taxReserveRate = String(settingsForm.elements.taxReserveRate.value || "");
    state.cashOnHand = String(settingsForm.elements.cashOnHand.value || "");
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
      applyLedger(data.ledger);
      const settingsForm = document.querySelector('[data-proto-form="settings"]');
      if (settingsForm) {
        settingsForm.elements.taxReserveRate.value = state.taxReserveRate;
        settingsForm.elements.cashOnHand.value = state.cashOnHand;
      }
      render();
    } catch {
      window.location.assign(`/${locale}/app`);
    }
  };

  const applyLedger = (ledger) => {
    if (!ledger) return;
    state.taxReserveRate = ledger.workspace?.taxReserveRate === null
      || ledger.workspace?.taxReserveRate === undefined
      ? "" : String(Math.round(ledger.workspace.taxReserveRate * 10000));
    state.cashOnHand = ledger.workspace?.cashOnHand === null
      || ledger.workspace?.cashOnHand === undefined
      ? "" : String(ledger.workspace.cashOnHand);
    const cycleValues = new Set(cycles.map((cycle) => cycle.value));
    state.fixedCosts = (ledger.fixedCosts || []).map((item) => ({
      name: item.name,
      amount: Number(item.amount) || 0,
      cycle: cycleValues.has(item.cycle) ? item.cycle : "monthly",
      multiplier: cycles.find((cycle) => cycle.value === (cycleValues.has(item.cycle) ? item.cycle : "monthly"))?.multiplier || 12,
      businessUse: Number(item.businessUse) || 0,
      isSubscription: Boolean(item.isSubscription),
      productUrl: item.productUrl || "",
      manageUrl: item.manageUrl || "",
      nextBillingDate: item.nextBillingDate || "",
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      reviews: item.reviews || [],
      id: item.id,
    }));
    state.income = (ledger.income || []).map((item) => ({
      date: item.date,
      source: item.source,
      client: item.client || "",
      amount: Number(item.amount) || 0,
      platformFee: Number(item.platformFee) || 0,
      id: item.id,
    }));
    state.expenses = (ledger.expenses || []).map((item) => ({
      date: item.date,
      category: item.category,
      merchant: item.merchant || "",
      amount: Number(item.amount) || 0,
      businessUse: Number(item.businessUse) || 100,
      notes: item.notes || "",
      id: item.id,
    }));
  };

  const flowSection = document.querySelector("#onboarding");
  const flowPanels = [...document.querySelectorAll("[data-flow-step]")];
  const flowBack = document.querySelector("[data-flow-back]");
  const flowNext = document.querySelector("[data-flow-next]");
  const flowSave = document.querySelector("[data-flow-save]");
  let flowStep = 1;

  const selectedTemplates = () => [...document.querySelectorAll("[data-template-key]:checked")]
    .map((checkbox) => {
      const key = checkbox.dataset.templateKey;
      const amountNode = document.querySelector(`[data-template-amount="${key}"]`);
      const template = messages.flow.templates.find((item) => item.key === key);
      return {
        name: template?.label || key,
        amount: Number(amountNode?.value || template?.amount || 0),
        cycle: "monthly",
        multiplier: 12,
        businessUse: 100,
        startDate: today(),
        isSubscription: true,
        templateKey: key,
      };
    });

  const otherFixedCost = () => {
    const nameNode = document.querySelector("[data-other-name]");
    const amountNode = document.querySelector("[data-other-amount]");
    const name = String(nameNode?.value || "").trim();
    const amount = Number(amountNode?.value || 0);
    return name && amount > 0 ? {
      name, amount, cycle: "monthly", multiplier: 12, businessUse: 100,
      startDate: today(), isSubscription: false,
    } : null;
  };

  const renderFlowResults = () => {
    const result = calculate();
    const dailyNode = document.querySelector("[data-flow-daily]");
    const comparisonNode = document.querySelector("[data-flow-comparison]");
    const gapNode = document.querySelector("[data-flow-gap]");
    const runwayNode = document.querySelector("[data-flow-runway]");
    const taxNode = document.querySelector("[data-flow-tax-result]");
    if (dailyNode) dailyNode.textContent = dayMoney(result.dailyFloor);
    const monthlyIncome = Number(document.querySelector("[data-flow-income]")?.value || 0);
    if (comparisonNode) comparisonNode.textContent = dayMoney(monthlyIncome / 12);
    if (gapNode) {
      const gap = monthlyIncome / 12 - result.dailyFloor;
      if (monthlyIncome > 0 && gap < 0) {
        gapNode.textContent = `${messages.flow.behind} ${dayMoney(Math.abs(gap))}`;
        gapNode.hidden = false;
      } else if (monthlyIncome > 0 && gap > 0) {
        gapNode.textContent = `${messages.flow.ahead} ${dayMoney(gap)}`;
        gapNode.hidden = false;
      } else {
        gapNode.hidden = true;
      }
    }
    const cash = Number(document.querySelector("[data-flow-cash]")?.value || 0);
    if (runwayNode) {
      runwayNode.textContent = cash > 0 && result.dailyFloor > 0
        ? `${Math.floor(cash / result.dailyFloor)} ${messages.flow.days}`
        : messages.flow.unset;
    }
    if (taxNode) taxNode.textContent = result.taxReserve === null
      ? messages.flow.unset
      : money(result.taxReserve);
  };

  const applyFlowToLedger = () => {
    const templateCosts = selectedTemplates();
    const otherCost = otherFixedCost();
    state.fixedCosts = [...templateCosts, ...(otherCost ? [otherCost] : [])];
    const monthlyIncome = Number(document.querySelector("[data-flow-income]")?.value || 0);
    state.income = monthlyIncome > 0 ? [{
      date: today(), source: "direct", client: "Rough monthly income", amount: monthlyIncome, platformFee: 0,
    }] : [];
    state.expenses = [];
    state.taxReserveRate = String(document.querySelector("[data-flow-tax]")?.value || "");
    state.cashOnHand = String(document.querySelector("[data-flow-cash]")?.value || "");
    const settingsForm = document.querySelector('[data-proto-form="settings"]');
    if (settingsForm) {
      settingsForm.elements.taxReserveRate.value = state.taxReserveRate;
      settingsForm.elements.cashOnHand.value = state.cashOnHand;
    }
    render();
    renderFlowResults();
  };

  const showFlowStep = (nextStep) => {
    flowStep = Math.min(3, Math.max(1, nextStep));
    flowPanels.forEach((panel) => {
      panel.hidden = Number(panel.dataset.flowStep) !== flowStep;
    });
    const current = document.querySelector("[data-flow-current]");
    if (current) current.textContent = String(flowStep);
    if (flowBack) flowBack.hidden = flowStep === 1;
    if (flowNext) {
      flowNext.hidden = flowStep === 3;
      flowNext.textContent = flowStep === 2 ? messages.flow.seeResults : messages.flow.next;
    }
    if (flowStep === 3) applyFlowToLedger();
  };

  flowBack?.addEventListener("click", () => showFlowStep(flowStep - 1));
  flowNext?.addEventListener("click", () => {
    if (flowStep === 1) {
      const warning = document.querySelector("[data-skip-warning]");
      if (warning) warning.hidden = Boolean(selectedTemplates().length || otherFixedCost());
    }
    showFlowStep(flowStep + 1);
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-review-answer]");
    if (!button || button.disabled) return;
    button.disabled = true;
    try {
      const response = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ fixedCostId: button.dataset.entryId, answer: button.dataset.reviewAnswer }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ledger) throw new Error("review_failed");
      applyLedger(data.ledger);
      const currentSettings = document.querySelector('[data-proto-form="settings"]');
      if (currentSettings) {
        currentSettings.elements.taxReserveRate.value = state.taxReserveRate;
        currentSettings.elements.cashOnHand.value = state.cashOnHand;
      }
      render();
    } catch {
      button.disabled = false;
      window.alert(messages.deleteEntryFailed);
    }
  });
  flowSave?.addEventListener("click", saveDraft);
  document.querySelector("[data-template-grid]")?.addEventListener("input", (event) => {
    if (!event.target.matches("[type=checkbox]")) return;
    const warning = document.querySelector("[data-skip-warning]");
    if (warning) warning.hidden = Boolean(selectedTemplates().length || otherFixedCost());
  });

  flowSection?.classList.add("ready");
  showFlowStep(1);

  loadDashboard().finally(() => {
    window.__gigledgerLoaded = true;
  });
  render();
})();
