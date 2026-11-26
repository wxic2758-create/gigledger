import { answerForPeriod, consecutiveUnused, dayInTimeZone, monthOffset, shiftDay, subscriptionTiming, validTimeZone, weekStart } from "./billing-calendar.js?v=20261126-02";
import { annualCost, annualCycles, buildReport, effectiveVersionAt, expenseCents, netCents, projectTotals, roundedUsd } from "./ledger-report.js?v=20261126-02";
import { daysCovered, exact, minorUnits, percent, roundCents, scale, usd } from "./money.js?v=20261126-02";

(() => {
  const root = document.documentElement;
  const locale = root.lang === "zh-Hant-TW" ? "zh-TW" : "en";
  const messages = JSON.parse(document.getElementById("proto-messages").textContent);
  const dashboardMode = Boolean(document.querySelector("[data-dashboard]"));
  const state = { timeZone: null, projects: [], fixedCosts: [], income: [], expenses: [], taxReserveRate: "", appleFeeRate: "", cashOnHand: "", monthlyIncomeEstimate: "", features: { plan: "free", subscriptionLimit: 5, csv: false, sync: false, appStoreSync: false, subscriptionReview: false } };
  let monthlyIncomeEstimateChanged = false;
  let editingFixedCostId = null;
  let editingExpense = null;
  let subscriptionToFocus = null;
  let stripeIntegration = null;
  let appStoreIntegration = null;
  let integrationsLoaded = false;
  let reportPeriod = "current";
  let workspaceReady = false;
  let renderedDate = "";

  const currency = new Intl.NumberFormat(locale === "zh-TW" ? "zh-TW" : "en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
    currencyDisplay: "narrowSymbol",
  });
  const money = (value) => currency.format(Number.isFinite(value) ? value : 0);
  const day = new Intl.NumberFormat(locale === "zh-TW" ? "zh-TW" : "en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const dayMoney = (value) => `$${day.format(Number.isFinite(value) ? value : 0)}`;
  const browserTimeZone = validTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
  const workspaceTimeZone = () => state.timeZone || browserTimeZone;
  const today = () => dayInTimeZone(new Date(), workspaceTimeZone());
  const monthKey = () => today().slice(0, 7);
  const previousMonthKey = () => monthOffset(monthKey(), -1);
  const selectedMonth = () => reportPeriod === "previous" ? previousMonthKey() : monthKey();
  const formatMonth = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", timeZone: "UTC" });
  const monthLabel = (month) => formatMonth.format(new Date(`${month}-01T00:00:00Z`));
  const set = (key, value) => {
    const node = document.querySelector(`[data-proto="${key}"]`);
    if (node) node.textContent = value;
  };
  const cycles = Object.entries(annualCycles).map(([value, multiplier]) => ({ value, multiplier }));

  const effectiveVersionForItem = (item, value = today()) => effectiveVersionAt(item.versions, value) || {
    effectiveFrom: item.startDate || value,
    effectiveTo: item.endDate || null,
    amount: item.amount,
    cycle: item.cycle,
    businessUse: item.businessUse,
    allocation: item.allocation || [],
  };

  const currentVersion = (item) => effectiveVersionAt(item.versions, today());

  const versionValue = (item, key, fallback) => {
    const version = currentVersion(item);
    return version && version[key] !== undefined && version[key] !== null ? version[key] : fallback;
  };

  const versionAllocation = (item) => {
    const version = currentVersion(item);
    return version?.allocation?.length ? version.allocation : (item.allocation || []);
  };

  const subscriptionStatus = (item, date = today()) => {
    const cycle = effectiveVersionForItem(item, date).cycle;
    const schedule = { ...item, cycle };
    const timing = subscriptionTiming(schedule, date);
    return {
      ...timing,
      answer: answerForPeriod(item.reviews || [], timing.reviewPeriod, cycle),
      suggestedCancel: (!item.startDate || item.startDate <= date) && (!item.endDate || item.endDate >= date)
        && consecutiveUnused(schedule),
    };
  };

  const isInCurrentMonth = (value) => value?.slice(0, 7) === monthKey();
  const calculate = (month) => buildReport(state, today(), month);

  const renderWorkspaceChart = (result) => {
    const bar = document.querySelector("[data-chart-bar]");
    const fixed = result.monthlyFixedCosts;
    const expenses = result.monthlyExpenses;
    const profit = Math.max(0, result.trueProfit);
    const shortfall = Math.max(0, -result.trueProfit);
    const total = Math.max(result.netIncome, fixed + expenses);
    bar.hidden = total <= 0;
    document.querySelector("[data-chart-key]").hidden = total <= 0;
    document.querySelector("[data-chart-empty]").hidden = total > 0;
    document.querySelector("[data-chart-shortfall]").hidden = shortfall === 0;
    document.querySelector("[data-chart-shortfall-value]").textContent = money(shortfall);
    document.querySelector("[data-chart-profit]").textContent = money(profit);
    for (const [segment, value] of Object.entries({ fixed, expenses, profit })) {
      bar.querySelector(`[data-chart-segment="${segment}"]`).style.flexBasis = total ? `${value / total * 100}%` : "0%";
    }
    const boundary = bar.querySelector('[data-chart-segment="shortfall"]');
    boundary.hidden = shortfall === 0 || result.netIncome <= 0;
    boundary.style.insetInlineStart = total ? `${result.netIncome / total * 100}%` : "0%";
    const title = reportPeriod === "previous" ? messages.workspace.previousProfit : messages.workspace.currentProfit;
    document.querySelector("[data-profit-period]").textContent = title;
    document.querySelector("[data-proto='metric-profit']").classList.toggle("is-loss", result.trueProfit < 0);
    document.querySelector("[data-period-status]").textContent = `${title} ${money(result.trueProfit)}`;
  };

  const renderMetrics = () => {
    const current = calculate();
    const result = reportPeriod === "previous" ? calculate(previousMonthKey()) : current;
    set("report-context", dashboardMode ? `USD · ${workspaceTimeZone()}` : "USD");
    set("metric-daily", dayMoney(result.dailyFloor));
    set("metric-gross", money(result.grossIncome));
    set("metric-sold", money(result.soldIncome));
    const soldCard = document.querySelector("[data-sold-card]");
    if (soldCard) soldCard.hidden = result.soldIncome <= 0;
    set("metric-fees", money(result.platformFees));
    set("metric-net", money(result.netIncome));
    set("metric-profit", money(result.trueProfit));
    const taxNode = document.querySelector("[data-proto='metric-tax']");
    if (taxNode) taxNode.textContent = result.taxReserve === null ? messages.taxUnset : money(result.taxReserve);
    set("metric-costs", money(result.monthlyFixedCosts));
    set("metric-expenses", money(result.monthlyExpenses));
    set("metric-required", money(result.requiredToDate));
    const comparisonNode = document.querySelector("[data-proto='metric-comparison']");
    if (comparisonNode) {
      const hasFloor = current.dailyFloor > 0;
      const comparison = current.comparison;
      comparisonNode.textContent = !hasFloor
        ? messages.metrics.comparisonUnavailable
        : comparison > 0
          ? messages.metrics.ahead.replace("{amount}", money(comparison))
          : comparison < 0
            ? messages.metrics.behind.replace("{amount}", money(-comparison))
            : messages.workspace.onTrack;
      const pace = comparisonNode.closest("[data-current-pace]");
      if (pace) {
        pace.hidden = !hasFloor || reportPeriod !== "current";
        pace.classList.toggle("is-loss", comparison < 0);
      }
    }
    const runwayNode = document.querySelector("[data-proto='metric-runway']");
    if (runwayNode) {
      runwayNode.textContent = result.noNewWorkRunway === null
        ? "—"
        : messages.workspace.runwayDays.replace("{days}", String(result.noNewWorkRunway));
    }
    const averageNode = document.querySelector("[data-proto='metric-runway-average']");
    if (averageNode) {
      const context = result.noNewWorkRunway !== null
        ? messages.workspace.runwayNote
        : result.savings !== null ? messages.metrics.runwayNeedFloor : "";
      let average = "";
      if (result.noNewWorkRunway !== null && result.incomeAverage) {
        average = result.cashNotBurning
          ? messages.metrics.runwayNotBurning
          : messages.workspace.runwayWithHistory
            .replace("{days}", String(result.averageRunway))
            .replace("{months}", String(result.incomeAverage.monthCount));
      }
      averageNode.textContent = [context, average].filter(Boolean).join(" · ");
    }
    const shareAiNode = document.querySelector("[data-share-ai]");
    if (shareAiNode) shareAiNode.textContent = money(result.aiMonthlyCosts);
    const shareDailyNode = document.querySelector("[data-share-daily]");
    if (shareDailyNode) shareDailyNode.textContent = dayMoney(result.dailyFloor);
    document.querySelector("[data-floor-setup]").hidden = state.fixedCosts.length > 0;
    document.querySelector("[data-cash-setup]").hidden = state.cashOnHand !== "";
    renderWorkspaceChart(result);
    renderAttentionQueue();
    renderWeeklySummary(current);
  };

  const renderAttentionQueue = () => {
    const list = document.querySelector("[data-attention-list]");
    const empty = document.querySelector("[data-attention-empty]");
    if (!list || !empty || !dashboardMode) return;
    const items = [];
    if (state.features.subscriptionReview) {
      const date = today();
      const subscriptions = state.fixedCosts.filter((item) => item.isSubscription)
        .map((item) => ({ item, status: subscriptionStatus(item, date) }))
        .sort((a, b) => (a.status.daysUntil ?? Infinity) - (b.status.daysUntil ?? Infinity));
      for (const { item, status } of subscriptions) {
        if (status.suggestedCancel) {
          items.push({
            text: messages.attentionQueue.suggestedCancel.replace("{name}", item.name),
            href: "#fixed-costs",
            fixedCostId: item.id,
            warning: true,
          });
        } else if (status.date && status.reviewPeriod && !status.answer) {
          items.push({
            text: messages.attentionQueue.subscriptionReview
              .replace("{name}", item.name)
              .replace("{date}", status.date),
            href: "#fixed-costs",
            fixedCostId: item.id,
            warning: true,
          });
        }
      }
    }
    if (!state.fixedCosts.length) {
      items.push({ text: messages.attentionQueue.noFixedCosts, href: "#fixed-cost-entry" });
    }
    if (!state.income.some((item) => isInCurrentMonth(item.date) && item.recognition !== "sold")) {
      items.push({ text: messages.attentionQueue.noIncome, href: "#income-entry" });
    }
    if (state.cashOnHand === "") {
      items.push({ text: messages.attentionQueue.noCash, href: "#cash-settings" });
    }
    if (integrationsLoaded && stripeIntegration?.lastError) {
      items.push({
        text: messages.attentionQueue.stripeError,
        href: "#stripe-connect",
        warning: true,
      });
    }
    if (integrationsLoaded && ["pending", "connected"].includes(appStoreIntegration?.status)) {
      items.push({
        text: messages.attentionQueue.appStorePending,
        href: "#app-store-connect",
      });
    }
    list.replaceChildren();
    items.slice(0, 4).forEach((item) => {
      const row = document.createElement("li");
      if (item.warning) row.classList.add("is-warning");
      const copy = document.createElement("span");
      copy.className = "attention-copy";
      copy.textContent = item.text;
      const action = document.createElement("a");
      action.className = "attention-action";
      action.href = item.href;
      if (item.fixedCostId) action.dataset.subscriptionFocus = item.fixedCostId;
      action.textContent = messages.attentionQueue.review;
      row.append(copy, action);
      list.appendChild(row);
    });
    list.hidden = items.length === 0;
    empty.hidden = items.length > 0;
    const count = document.querySelector("[data-attention-count]");
    if (count) {
      count.textContent = String(items.length);
      count.hidden = items.length === 0;
    }
  };

  const weekKey = () => shiftDay(weekStart(today()), -7);

  const renderWeeklySummary = (result) => {
    const wrapper = document.querySelector("[data-weekly-summary]");
    const textNode = document.querySelector("[data-weekly-text]");
    if (!wrapper || !textNode || !dashboardMode) return;
    if (localStorage.getItem(`gigledger_week_dismissed_${weekKey()}`) === "1") {
      wrapper.hidden = true;
      return;
    }
    const first = weekKey();
    const end = shiftDay(first, 7);
    const weekIncome = state.income
      .filter((item) => item.recognition !== "sold" && item.date >= first && item.date < end)
      .reduce((sum, item) => sum + netCents(item), 0n);
    if (!state.income.length && !state.fixedCosts.length) {
      wrapper.hidden = true;
      return;
    }
    textNode.textContent = weekIncome > 0n && result.dailyRate.numerator > 0n
      ? messages.weeklySummary.body
        .replace("{income}", money(usd(weekIncome)))
        .replace("{days}", String(daysCovered(weekIncome, result.dailyRate)))
        .replace("{share}", String(Math.round((result.aiMonthlyCosts / Math.max(result.monthlyFixedCosts, 1)) * 100)))
      : weekIncome > 0n
        ? messages.weeklySummary.bodyNoFloor.replace("{income}", money(usd(weekIncome)))
        : messages.weeklySummary.bodyNoIncome.replace("{daily}", dayMoney(result.dailyFloor));
    wrapper.hidden = false;
  };

  const calculateShareCard = (card) => {
    const result = calculate();
    return card === "ai" ? result.aiMonthlyCosts : result.dailyFloor;
  };

  const deleteButton = (type, id, index = null) => {
    const cell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "entry-delete";
    button.textContent = messages.deleteEntry;
    button.setAttribute("data-delete-entry", "");
    button.setAttribute("data-entry-type", type);
    if (id) button.setAttribute("data-entry-id", id);
    if (index !== null) button.setAttribute("data-entry-index", String(index));
    cell.appendChild(button);
    return cell;
  };

  const editButton = (id) => {
    const cell = document.createElement("td");
    if (!id) return cell;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "entry-edit";
    button.textContent = messages.fixedRevision.edit;
    button.setAttribute("data-edit-fixed", "");
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

  const projectNames = () => state.projects.filter((project) => !project.archived).map((project) => project.name);
  const allocationTotal = (allocation) => (allocation || []).reduce(
    (sum, entry) => sum + (Number(entry.percent) || 0),
    0,
  );

  const projectCell = (item) => {
    const cell = document.createElement("td");
    const allocation = versionAllocation(item).length
      ? versionAllocation(item)
      : (item.projects?.length ? item.projects.map((name) => ({ name, percent: 100 })) : (item.project ? [{ name: item.project, percent: 100 }] : []));
    if (allocation.length) {
      cell.textContent = allocation.map((entry) => entry.percent === 100 ? entry.name : `${entry.name} ${entry.percent}%`).join(" · ");
    } else {
      cell.textContent = messages.projects.unassigned;
      cell.classList.add("unassigned");
    }
    return cell;
  };

  const renderProjects = () => {
    const tbody = document.querySelector("[data-proto='project-rows']");
    if (!tbody) return;
    const period = selectedMonth();
    set("project-period", monthLabel(period));
    const totals = projectTotals(state, period);
    tbody.innerHTML = "";
    if (!state.projects.filter((project) => !project.archived).length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="5">${messages.projects.empty}</td>`;
      tbody.appendChild(row);
    }
    state.projects.filter((project) => !project.archived).forEach((project) => {
      const row = document.createElement("tr");
      const name = document.createElement("td"); name.textContent = project.name;
      const entry = totals.get(project.name);
      const income = document.createElement("td"); income.textContent = money(entry?.income ?? 0);
      const costs = document.createElement("td"); costs.textContent = money(entry?.costs ?? 0);
      const profit = document.createElement("td"); profit.textContent = money(entry?.profit ?? 0);
      const actions = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "entry-delete";
      button.textContent = messages.projects.archive;
      button.setAttribute("data-archive-project", "");
      button.setAttribute("data-project-id", project.id);
      actions.append(button);
      row.append(name, income, costs, profit, actions);
      tbody.appendChild(row);
    });
    const unassigned = totals.get("");
    if (unassigned && (unassigned.income || unassigned.costs)) {
      const row = document.createElement("tr");
      row.className = "project-unassigned-row";
      const name = document.createElement("td"); name.textContent = messages.projects.unassigned;
      const income = document.createElement("td"); income.textContent = money(unassigned.income);
      const costs = document.createElement("td"); costs.textContent = money(unassigned.costs);
      const profit = document.createElement("td");
      profit.textContent = money(unassigned.profit);
      const actions = document.createElement("td");
      row.append(name, income, costs, profit, actions);
      tbody.appendChild(row);
    }
  };

  const renderFixedCosts = () => {
    const tbody = document.querySelector("[data-proto='fixed-cost-rows']");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!state.fixedCosts.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="11">${messages.empty.fixed}</td>`;
      tbody.appendChild(row);
      return;
    }
    state.fixedCosts.forEach((item) => {
      const row = document.createElement("tr");
      if (item.id) row.dataset.fixedCostRow = item.id;
      if (editingFixedCostId === item.id) row.classList.add("is-editing");
      const isSubscription = Boolean(item.isSubscription);
      const currentCycle = versionValue(item, "cycle", item.cycle);
      const cycleLabel = messages.cycles[currentCycle] || currentCycle;
      const name = document.createElement("td"); name.textContent = item.name;
      const type = document.createElement("td"); type.textContent = isSubscription ? messages.fixed.subscription : messages.fixed.other;
      const cycle = document.createElement("td"); cycle.textContent = cycleLabel;
      const currentAmount = Number(versionValue(item, "amount", item.amount));
      const currentBusinessUse = Number(versionValue(item, "businessUse", item.businessUse));
      const amount = document.createElement("td"); amount.textContent = money(currentAmount);
      const use = document.createElement("td"); use.textContent = `${currentBusinessUse}%`;
      const effective = document.createElement("td");
      const currentVersionDate = currentVersion(item)?.effectiveFrom || item.startDate;
      effective.textContent = currentVersionDate ? `${currentVersionDate}${item.endDate ? ` – ${item.endDate}` : ""}` : "";
      const cost = document.createElement("td");
      cost.textContent = dayMoney(roundedUsd(scale(annualCost(effectiveVersionForItem(item)), 1n, 365n)));
      const project = projectCell(item);
      const actions = document.createElement("td");
      if (isSubscription) {
        const status = subscriptionStatus(item);
        const review = document.createElement("div");
        review.className = "subscription-review";
        const canReview = state.features.subscriptionReview && status.reviewPeriod;
        if (state.features.subscriptionReview && status.suggestedCancel) {
          const badge = document.createElement("span");
          badge.className = "cancel-badge";
          badge.textContent = messages.subscriptionReview.suggestedCancel;
          row.classList.add("subscription-unused");
          review.append(badge);
        }
        if (status.date || canReview) {
          const prompt = document.createElement("span");
          prompt.className = "review-hint";
          const copy = canReview
            ? status.date
              ? messages.subscriptionReview[status.answer ? "reviewed" : "upcoming"]
              : messages.subscriptionReview.review
            : messages.subscriptionReview.nextDate;
          const chargeAmount = status.date ? effectiveVersionForItem(item, status.date).amount : currentAmount;
          prompt.textContent = copy.replace("{date}", status.date || "").replace("{amount}", money(Number(chargeAmount)));
          review.append(prompt);
          if (canReview) {
            const answerGroup = document.createElement("div");
            answerGroup.className = "review-actions";
            answerGroup.setAttribute("role", "group");
            answerGroup.setAttribute("aria-label", prompt.textContent);
            for (const value of ["often", "sometimes", "not_used"]) {
              const button = document.createElement("button");
              button.type = "button";
              button.className = "review-button" + (status.answer === value ? " active" : "");
              button.setAttribute("aria-pressed", String(status.answer === value));
              button.dataset.reviewAnswer = value;
              button.dataset.billingPeriod = status.reviewPeriod;
              button.dataset.entryId = item.id;
              button.textContent = messages.subscriptionReview[value === "not_used" ? "notUsed" : value];
              answerGroup.append(button);
            }
            review.append(answerGroup);
          }
        }
        if (review.childElementCount) actions.append(review);
      }
      const controls = document.createElement("td");
      controls.className = "entry-controls";
      const editCell = editButton(item.id);
      const deleteCell = deleteButton("fixed-cost", item.id);
      controls.append(...editCell.childNodes, ...deleteCell.childNodes);
      row.append(name, type, cycle, amount, use, project, effective, linkCell(item), cost, actions, controls);
      tbody.appendChild(row);
    });
  };

  const renderIncome = () => {
    const tbody = document.querySelector("[data-proto='income-rows']");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!state.income.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="8">${messages.empty.income}</td>`;
      tbody.appendChild(row);
      return;
    }
    state.income.forEach((item, index) => {
      const row = document.createElement("tr");
      const net = usd(netCents(item));
      const dateCell = document.createElement("td"); dateCell.textContent = item.date;
      const source = document.createElement("td"); source.textContent = item.client || messages.sources[item.source] || item.source;
      const recognition = document.createElement("td");
      recognition.textContent = item.recognition === "sold"
        ? messages.income.recognitionSold
        : messages.income.recognitionReceived;
      const project = projectCell(item);
      const amount = document.createElement("td"); amount.textContent = money(Number(item.amount));
      const fee = document.createElement("td"); fee.textContent = money(Number(item.platformFee));
      const netCell = document.createElement("td"); netCell.textContent = money(net);
      row.append(dateCell, source, recognition, project, amount, fee, netCell, deleteButton("income", item.id, index));
      tbody.appendChild(row);
    });
  };

  const renderExpenses = () => {
    const tbody = document.querySelector("[data-proto='expense-rows']");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!state.expenses.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="8">${messages.empty.expenses}</td>`;
      tbody.appendChild(row);
      return;
    }
    state.expenses.forEach((item, index) => {
      const row = document.createElement("tr");
      const businessAmount = usd(expenseCents(item));
      const dateCell = document.createElement("td"); dateCell.textContent = item.date;
      const category = document.createElement("td"); category.textContent = item.category;
      const compactDate = document.createElement("small");
      compactDate.className = "expense-compact-date";
      compactDate.textContent = item.date;
      category.append(compactDate);
      const merchant = document.createElement("td"); merchant.textContent = item.merchant || "";
      const amount = document.createElement("td"); amount.textContent = money(Number(item.amount));
      const use = document.createElement("td"); use.textContent = `${Number(item.businessUse)}%`;
      const business = document.createElement("td"); business.textContent = money(businessAmount);
      const project = projectCell(item);
      const actions = deleteButton("expense", item.id, index);
      const controls = document.createElement("div");
      controls.className = "entry-controls";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "entry-edit";
      edit.dataset.editExpense = String(index);
      edit.textContent = messages.expenses.edit;
      controls.append(edit, ...actions.childNodes);
      actions.append(controls);
      row.append(dateCell, category, merchant, project, amount, use, business, actions);
      tbody.appendChild(row);
    });
  };

  const renderProjectOptions = () => {
    document.querySelectorAll("[data-project-options]").forEach((node) => {
      const current = node.value;
      node.replaceChildren();
      const unassigned = document.createElement("option");
      unassigned.value = "";
      unassigned.textContent = messages.projects.unassigned;
      node.appendChild(unassigned);
      const names = projectNames();
      const assigned = node.form?.id === "expense-entry" && editingExpense?.projects?.[0];
      if (assigned && !names.includes(assigned)) names.push(assigned);
      names.forEach((name) => {
        const item = document.createElement("option");
        item.value = name;
        item.textContent = name;
        node.appendChild(item);
      });
      if ([...node.options].some((option) => option.value === current)) node.value = current;
    });
    document.querySelectorAll("[data-allocation-project]").forEach((node) => {
      const current = node.value;
      node.replaceChildren();
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = messages.projects.unassigned;
      node.appendChild(blank);
      projectNames().forEach((name) => {
        const item = document.createElement("option");
        item.value = name;
        item.textContent = name;
        node.appendChild(item);
      });
      if ([...node.options].some((option) => option.value === current)) node.value = current;
    });
  };

  const allocationList = () => document.querySelector("[data-allocation-list]");
  const allocationTotalNode = () => document.querySelector("[data-allocation-total]");

  const updateAllocationTotal = () => {
    const list = allocationList();
    const node = allocationTotalNode();
    if (!list || !node) return;
    const total = [...list.querySelectorAll("[data-allocation-percent]")]
      .reduce((sum, input) => sum + (Number(input.value) || 0), 0);
    node.textContent = messages.fields.allocationTotal.replace("{total}", String(Math.round(total * 100) / 100));
    node.classList.toggle("invalid", list.children.length > 0 && Math.abs(total - 100) > 0.01);
  };

  const addAllocationRow = (allocation = {}) => {
    const list = allocationList();
    if (!list) return;
    const row = document.createElement("div");
    row.className = "allocation-row";
    const select = document.createElement("select");
    select.setAttribute("data-allocation-project", "");
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = messages.projects.unassigned;
    select.appendChild(blank);
    projectNames().forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
    if (allocation.name && [...select.options].some((option) => option.value === allocation.name)) {
      select.value = allocation.name;
    }
    const percent = document.createElement("input");
    percent.type = "number";
    percent.min = "0";
    percent.max = "100";
    percent.step = "0.1";
    percent.value = allocation.percent === undefined ? "" : String(allocation.percent);
    percent.setAttribute("data-allocation-percent", "");
    percent.setAttribute("aria-label", messages.fields.projectAllocation);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = messages.fields.removeProjectShare;
    remove.setAttribute("aria-label", messages.fields.removeProjectShare);
    remove.setAttribute("data-allocation-remove", "");
    row.append(select, percent, remove);
    list.appendChild(row);
    updateAllocationTotal();
  };

  const readAllocation = () => {
    const list = allocationList();
    if (!list) return [];
    return [...list.querySelectorAll(".allocation-row")].map((row) => ({
      name: String(row.querySelector("[data-allocation-project]")?.value || "").trim(),
      percent: Number(row.querySelector("[data-allocation-percent]")?.value || 0),
    })).filter((entry) => entry.name && Number.isFinite(entry.percent) && entry.percent > 0);
  };

  const resetAllocation = () => {
    const list = allocationList();
    if (list) list.replaceChildren();
    updateAllocationTotal();
  };

  const render = () => {
    renderedDate = today();
    renderMetrics();
    renderProjects();
    renderFixedCosts();
    renderIncome();
    renderExpenses();
    renderProjectOptions();
    renderIntegration();
    renderPlanLimits();
  };

  const refreshTaxInputs = () => {
    const inputs = [
      document.querySelector('[data-proto-form="settings"]')?.elements.taxReserveRate,
      document.querySelector("[data-flow-tax]"),
    ].filter(Boolean);
    inputs.forEach((input) => { input.value = state.taxReserveRate; });
  };

  const refreshAppleFeeInput = () => {
    const input = document.querySelector('[data-proto-form="settings"]')?.elements.appleFeeRate;
    if (input) input.value = state.appleFeeRate;
  };

  const retryEntries = new WeakMap();
  let workspaceUpdate = Promise.resolve();
  const updateWorkspace = (url, options) => {
    const update = workspaceUpdate.then(async () => {
      const response = await fetch(url, { credentials: "same-origin", ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ledger) {
        if (data.error === "subscription_limit") {
          throw new Error(`subscription_limit:${data.limit || state.features.subscriptionLimit || 5}`);
        }
        throw new Error(data.error || "workspace_update_failed");
      }
      applyLedger(data.ledger);
      render();
      return data.ledger;
    });
    workspaceUpdate = update.catch(() => {});
    return update;
  };
  const postWorkspace = (data) => updateWorkspace("/api/workspace", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data),
  });
  const deleteWorkspaceEntry = (type, id) => updateWorkspace(
    `/api/workspace?type=${type}&id=${encodeURIComponent(id)}`, { method: "DELETE" },
  );
  const showWorkspaceMessage = (form, text, isError = false) => {
    const node = form.querySelector("[data-workspace-message]");
    if (!node) return;
    node.textContent = text;
    node.hidden = !text;
    node.classList.toggle("is-error", isError);
  };
  const submitWorkspaceForm = async (form, submit) => {
    if (!workspaceReady || form.getAttribute("aria-busy") === "true") return false;
    const controls = [...form.elements].filter((control) => !control.disabled);
    controls.forEach((control) => { control.disabled = true; });
    form.setAttribute("aria-busy", "true");
    showWorkspaceMessage(form, messages.workspace.saving);
    try {
      await submit();
      return true;
    } catch (error) {
      const [code, limit] = error.message.split(":");
      showWorkspaceMessage(form, code === "subscription_limit"
        ? messages.plan.limitReached.replace("{limit}", limit || "5")
        : messages.workspace.saveFailed, true);
      return false;
    } finally {
      controls.forEach((control) => { control.disabled = false; });
      form.removeAttribute("aria-busy");
    }
  };
  const addRecord = (form, key, record) => {
    if (!dashboardMode) {
      state[key].push(record);
      form.closest("dialog")?.querySelector("[data-close-entry]")?.click();
      return Promise.resolve(true);
    }
    return submitWorkspaceForm(form, async () => {
      const signature = JSON.stringify({ ...record, externalRef: undefined });
      const retry = retryEntries.get(form);
      const externalRef = retry?.signature === signature ? retry.externalRef : record.externalRef;
      retryEntries.set(form, { signature, externalRef });
      const ledger = await postWorkspace({ [key]: [{ ...record, externalRef }] });
      retryEntries.delete(form);
      const undo = form.querySelector("[data-undo-entry]");
      if (undo) {
        const saved = ledger[key].find((entry) => entry.externalRef === externalRef);
        undo.hidden = !saved;
        undo.dataset.undoEntry = saved?.id || "";
        undo.dataset.undoType = key === "income" ? "income" : "expense";
      }
      showWorkspaceMessage(form, messages.workspace.entrySaved);
    });
  };

  const fixedForm = document.querySelector("[data-proto-form='fixed']");
  if (fixedForm) {
    const revisionDate = fixedForm.querySelector("[data-revision-date]");
    const revisionMessage = fixedForm.querySelector("[data-fixed-edit-message]");
    const submitButton = fixedForm.querySelector("[data-fixed-submit]");
    const cancelButton = fixedForm.querySelector("[data-fixed-cancel]");
    const dialogTitle = fixedForm.closest("dialog")?.querySelector("h3");
    const templateSelect = fixedForm.querySelector("[data-fixed-template]");
    const billingInput = fixedForm.elements.nextBillingDate;
    const setRevisionMode = (item = null) => {
      editingFixedCostId = item?.id || null;
      templateSelect.closest("label").hidden = Boolean(item);
      revisionDate.hidden = !item;
      cancelButton.hidden = !item;
      submitButton.textContent = item ? messages.fixedRevision.save : messages.fixed.add;
      if (dialogTitle) dialogTitle.textContent = item ? messages.fixedRevision.title : messages.fixed.add;
      revisionMessage.hidden = true;
      if (item) {
        fixedForm.elements.name.value = item.name;
        fixedForm.elements.amount.value = String(versionValue(item, "amount", item.amount));
        fixedForm.elements.cycle.value = versionValue(item, "cycle", item.cycle);
        fixedForm.elements.businessUse.value = String(versionValue(item, "businessUse", item.businessUse));
        fixedForm.elements.startDate.value = item.startDate || today();
        fixedForm.elements.endDate.value = item.endDate || "";
        billingInput.value = subscriptionStatus(item).date || item.nextBillingDate || "";
        billingInput.dataset.initialDate = billingInput.value;
        fixedForm.elements.productUrl.value = item.productUrl || "";
        fixedForm.elements.manageUrl.value = item.manageUrl || "";
        fixedForm.elements.isSubscription.checked = Boolean(item.isSubscription);
        fixedForm.elements.isSoftware.checked = item.isSoftware !== false;
        fixedForm.elements.effectiveFrom.value = item.startDate || today();
        fixedForm.elements.effectiveFrom.min = item.startDate || today();
        resetAllocation();
        versionAllocation(item).forEach((entry) => addAllocationRow(entry));
      } else {
        fixedForm.reset();
        fixedForm.elements.startDate.value = today();
        fixedForm.elements.businessUse.value = "100";
        fixedForm.elements.cycle.value = "monthly";
        fixedForm.elements.isSoftware.checked = true;
        resetAllocation();
      }
      const subscriptionFields = fixedForm.querySelector("[data-subscription-fields]");
      if (subscriptionFields) subscriptionFields.hidden = !fixedForm.elements.isSubscription.checked;
    };
    templateSelect.addEventListener("change", () => {
      const template = messages.flow.templates.find((item) => item.key === templateSelect.value);
      if (!template) return;
      fixedForm.elements.name.value = template.label;
      fixedForm.elements.amount.value = template.amount ?? "";
      fixedForm.elements.cycle.value = template.cycle || "monthly";
      fixedForm.elements.isSoftware.checked = template.isSoftware ?? true;
      fixedForm.elements.isSubscription.checked = true;
      fixedForm.elements.isSubscription.dispatchEvent(new Event("change"));
      fixedForm.elements.productUrl.value = template.productUrl || "";
      fixedForm.elements.manageUrl.value = template.manageUrl || "";
    });
    fixedForm.elements.isSubscription?.addEventListener("change", () => {
      const subscriptionFields = fixedForm.querySelector("[data-subscription-fields]");
      if (subscriptionFields) subscriptionFields.hidden = !fixedForm.elements.isSubscription.checked;
    });
    document.querySelector("[data-allocation-add]")?.addEventListener("click", () => addAllocationRow());
    document.querySelector("[data-allocation-list]")?.addEventListener("input", updateAllocationTotal);
    document.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-allocation-remove]");
      if (!remove) return;
      remove.closest(".allocation-row")?.remove();
      updateAllocationTotal();
    });
    cancelButton?.addEventListener("click", () => setRevisionMode());
    fixedForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!fixedForm.checkValidity()) {
        const details = fixedForm.querySelector("details:has(:invalid)");
        if (details) details.open = true;
        fixedForm.reportValidity();
        return;
      }
      const data = new FormData(fixedForm);
      const selected = cycles.find((cycle) => cycle.value === data.get("cycle"));
      const startDate = String(data.get("startDate") || today());
      const allocation = readAllocation();
      if (allocation.length && Math.abs(allocationTotal(allocation) - 100) > 0.01) {
        window.alert(messages.fields.allocationInvalid);
        updateAllocationTotal();
        return;
      }
      if (editingFixedCostId) {
        const effectiveFrom = String(data.get("effectiveFrom") || "");
        const item = state.fixedCosts.find((cost) => cost.id === editingFixedCostId);
        const billingDate = data.get("isSubscription") === "on"
          ? (billingInput.value === billingInput.dataset.initialDate ? item?.nextBillingDate : billingInput.value) || null
          : null;
        if (!effectiveFrom || (item?.startDate && effectiveFrom < item.startDate)) {
          revisionMessage.textContent = messages.fixedRevision.invalidDate;
          revisionMessage.classList.add("is-error");
          revisionMessage.hidden = false;
          return;
        }
        if (!dashboardMode) {
          if (item) {
            Object.assign(item, {
              name: String(data.get("name") || ""),
              amount: Number(data.get("amount")) || 0,
              cycle: selected?.value || "monthly",
              multiplier: selected?.multiplier || 12,
              businessUse: Number(data.get("businessUse")) || 0,
              isSubscription: data.get("isSubscription") === "on",
              isSoftware: data.get("isSoftware") === "on",
              productUrl: String(data.get("productUrl") || "") || null,
              manageUrl: String(data.get("manageUrl") || "") || null,
              nextBillingDate: billingDate,
              projects: allocation.map((entry) => entry.name),
              allocation,
            });
          }
          setRevisionMode();
          render();
          return;
        }
        submitButton.disabled = true;
        const original = submitButton.textContent;
        submitButton.textContent = messages.saving;
        try {
          const response = await fetch("/api/workspace", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              fixedCostId: editingFixedCostId,
              revision: {
                fixedCostId: editingFixedCostId,
                name: String(data.get("name") || ""),
                amount: Number(data.get("amount")) || 0,
                cycle: selected?.value || "monthly",
                businessUse: Number(data.get("businessUse")) || 0,
                effectiveFrom,
                endDate: String(data.get("endDate") || "") || null,
                isSubscription: data.get("isSubscription") === "on",
                isSoftware: data.get("isSoftware") === "on",
                productUrl: String(data.get("productUrl") || "") || null,
                manageUrl: String(data.get("manageUrl") || "") || null,
                nextBillingDate: billingDate,
                allocation,
              },
            }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result.ledger) {
            if (result.error === "subscription_limit") {
              throw new Error(`subscription_limit:${result.limit || state.features.subscriptionLimit || 5}`);
            }
            throw new Error(result.error || "fixed_cost_update_failed");
          }
          applyLedger(result.ledger);
          const settingsForm = document.querySelector('[data-proto-form="settings"]');
          if (settingsForm) {
            settingsForm.elements.cashOnHand.value = state.cashOnHand;
            settingsForm.elements.appleFeeRate.value = state.appleFeeRate;
          }
          refreshTaxInputs();
          setRevisionMode();
          render();
          revisionMessage.textContent = messages.fixedRevision.saved;
          revisionMessage.classList.remove("is-error");
          revisionMessage.hidden = false;
        } catch (error) {
          const [code, limit] = String(error?.message || "").split(":");
          revisionMessage.textContent = code === "subscription_limit"
            ? messages.fixedRevision.limitReached.replace("{limit}", limit || "5")
            : messages.fixedRevision.failed;
          revisionMessage.classList.add("is-error");
          revisionMessage.hidden = false;
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = original;
        }
        return;
      }
      const entry = {
        name: String(data.get("name") || ""),
        cycle: selected?.value || "monthly",
        multiplier: selected?.multiplier || 12,
        amount: Number(data.get("amount")) || 0,
        businessUse: Number(data.get("businessUse")) || 0,
        startDate,
        endDate: String(data.get("endDate") || "") || null,
        isSubscription: data.get("isSubscription") === "on",
        isSoftware: data.get("isSoftware") === "on",
        templateKey: data.get("isSubscription") === "on" ? templateSelect.value || null : null,
        productUrl: String(data.get("productUrl") || "") || null,
        manageUrl: String(data.get("manageUrl") || "") || null,
        nextBillingDate: data.get("isSubscription") === "on" ? billingInput.value || null : null,
        projects: allocation.map((entry) => entry.name),
        allocation,
      };
      if (!await addRecord(fixedForm, "fixedCosts", entry)) return;
      fixedForm.reset();
      fixedForm.elements.startDate.value = today();
      fixedForm.elements.businessUse.value = "100";
      fixedForm.elements.cycle.value = "monthly";
      fixedForm.elements.isSoftware.checked = true;
      resetAllocation();
      const subscriptionFields = document.querySelector("[data-subscription-fields]");
      if (subscriptionFields) subscriptionFields.hidden = true;
      render();
    });
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-edit-fixed]");
      if (!button) return;
      const item = state.fixedCosts.find((cost) => cost.id === button.dataset.entryId);
      if (!item) return;
      setRevisionMode(item);
      if (dashboardMode) window.location.hash = "fixed-cost-entry";
    });
  }

  const incomeForm = document.querySelector("[data-proto-form='income']");
  if (incomeForm) {
    const amountInput = incomeForm.elements.amount;
    const feeInput = incomeForm.elements.platformFee;
    const percentInput = incomeForm.elements.platformFeePercent;
    let syncingFee = false;
    const feeFromPercent = () => {
      if (syncingFee) return;
      syncingFee = true;
      const amount = BigInt(Math.max(0, minorUnits(amountInput.value) ?? 0));
      const rate = Math.min(100, Math.max(0, Number(percentInput.value) || 0));
      feeInput.value = roundedUsd(percent(exact(amount), rate)).toFixed(2);
      syncingFee = false;
    };
    const percentFromFee = () => {
      if (syncingFee) return;
      syncingFee = true;
      const amount = Math.max(0, minorUnits(amountInput.value) ?? 0);
      const fee = Math.min(amount, Math.max(0, minorUnits(feeInput.value) ?? 0));
      feeInput.value = usd(fee).toFixed(2);
      percentInput.value = amount > 0 ? roundedUsd(scale(exact(BigInt(fee)), 10_000n, BigInt(amount))).toFixed(2) : "0.00";
      syncingFee = false;
    };
    amountInput.addEventListener("input", feeFromPercent);
    percentInput.addEventListener("input", feeFromPercent);
    feeInput.addEventListener("input", percentFromFee);
    incomeForm.addEventListener("change", (event) => {
      if (event.target !== incomeForm.elements.source) return;
      const isAppStore = incomeForm.elements.source.value === "app_store";
      const statusField = incomeForm.querySelector("[data-income-recognition-field]");
      if (statusField) statusField.hidden = !isAppStore;
      if (!isAppStore || !state.appleFeeRate) return;
      if (incomeForm.elements.recognition.value === "sold") {
        percentInput.value = Number(state.appleFeeRate).toFixed(2);
        feeFromPercent();
      }
    });
    incomeForm.elements.recognition?.addEventListener("change", () => {
      if (incomeForm.elements.source.value !== "app_store") return;
      if (incomeForm.elements.recognition.value === "sold" && state.appleFeeRate) {
        percentInput.value = Number(state.appleFeeRate).toFixed(2);
        feeFromPercent();
      }
    });
    incomeForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!incomeForm.reportValidity()) return;
      const data = new FormData(incomeForm);
      const source = String(data.get("source") || "");
      const amount = Number(data.get("amount")) || 0;
      const suppliedFee = Number(data.get("platformFee")) || 0;
      const recognition = source === "app_store" && data.get("recognition") === "sold" ? "sold" : "received";
      const entry = {
        externalRef: `manual:${crypto.randomUUID()}`,
        date: String(data.get("date") || today()),
        source,
        client: String(data.get("client") || ""),
        amount,
        platformFee: suppliedFee,
        recognition,
        projects: [String(data.get("project") || "").trim()].filter(Boolean),
      };
      if (!await addRecord(incomeForm, "income", entry)) return;
      incomeForm.reset();
      incomeForm.elements.date.value = today();
      const statusField = incomeForm.querySelector("[data-income-recognition-field]");
      if (statusField) statusField.hidden = true;
      incomeForm.elements.platformFee.value = "0.00";
      incomeForm.elements.platformFeePercent.value = "0.00";
      render();
    });
  }

  const expenseForm = document.querySelector("[data-proto-form='expense']");
  const expenseDialog = expenseForm?.closest("dialog");
  const setExpenseEdit = (item) => {
    editingExpense = item;
    const options = expenseForm.querySelector("details");
    const button = expenseForm.querySelector("button[type='submit']");
    const title = expenseDialog.querySelector("h3");
    title.textContent = item ? messages.expenses.editTitle : messages.expenses.add;
    button.textContent = item ? messages.expenses.saveChanges : messages.expenses.add;
    showWorkspaceMessage(expenseForm, "");
    const undo = expenseForm.querySelector("[data-undo-entry]");
    if (undo) {
      undo.hidden = true;
      delete undo.dataset.undoEntry;
    }
    expenseForm.reset();
    renderProjectOptions();
    expenseForm.elements.date.value = item?.date || today();
    options.open = false;
    if (!item) return;
    expenseForm.elements.amount.value = item.amount;
    expenseForm.elements.category.value = item.category;
    expenseForm.elements.merchant.value = item.merchant;
    expenseForm.elements.businessUse.value = item.businessUse;
    expenseForm.elements.notes.value = item.notes;
    expenseForm.elements.project.value = item.projects?.[0] || "";
  };
  if (expenseForm) {
    document.querySelector("[data-proto='expense-rows']").addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit-expense]");
      if (!edit) return;
      const item = state.expenses[Number(edit.dataset.editExpense)];
      if (!item) return;
      setExpenseEdit(item);
      window.location.hash = "expense-entry";
    });
    expenseForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!expenseForm.checkValidity()) {
        const invalidOptions = expenseForm.querySelector("details:has(:invalid)");
        if (invalidOptions) invalidOptions.open = true;
        expenseForm.reportValidity();
        return;
      }
      const data = new FormData(expenseForm);
      const expenseDate = String(data.get("date") || today());
      const expenseMonth = expenseDate.slice(0, 7);
      const labels = [String(data.get("category") || ""), String(data.get("merchant") || "")]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      const amount = Number(data.get("amount")) || 0;
      const duplicate = state.fixedCosts.find((item) => {
        if (!item.isSubscription) return false;
        const name = String(item.name || "").trim().toLowerCase();
        if (!name || !labels.includes(name)) return false;
        if (Math.abs((Number(versionValue(item, "amount", item.amount)) || 0) - amount) > 0.01) return false;
        const startMonth = String(item.startDate || "").slice(0, 7);
        const endMonth = String(item.endDate || "").slice(0, 7);
        return (!startMonth || startMonth <= expenseMonth) && (!endMonth || endMonth >= expenseMonth);
      });
      if (duplicate && !window.confirm(messages.expenses.duplicateWarning.replace("{name}", duplicate.name))) {
        return;
      }
      const entry = {
        date: expenseDate,
        category: String(data.get("category") || "").trim() || messages.workspace.uncategorized,
        merchant: String(data.get("merchant") || ""),
        amount,
        businessUse: Number(data.get("businessUse")),
        notes: String(data.get("notes") || ""),
        project: String(data.get("project") || "").trim(),
      };
      if (editingExpense) {
        const currentEdit = editingExpense;
        if (dashboardMode) {
          const saved = await submitWorkspaceForm(expenseForm, () => updateWorkspace("/api/workspace", {
            method: "PUT", headers: { "content-type": "application/json" },
            body: JSON.stringify({ expense: { ...entry, id: currentEdit.id } }),
          }));
          if (!saved || editingExpense !== currentEdit) return;
        } else {
          Object.assign(currentEdit, entry, { projects: [entry.project].filter(Boolean) });
          render();
        }
        expenseDialog.querySelector("[data-close-entry]").click();
        return;
      }
      if (!await addRecord(expenseForm, "expenses", {
        ...entry, externalRef: `manual:${crypto.randomUUID()}`, projects: [entry.project].filter(Boolean),
      })) return;
      expenseForm.reset();
      expenseForm.elements.date.value = today();
      expenseForm.elements.businessUse.value = "100";
      render();
    });
  }

  const saveDraft = async (event) => {
    const button = event.currentTarget;
    const status = document.querySelector(button.hasAttribute("data-flow-save") ? "[data-flow-save-message]" : "[data-save-message]");
    const monthlyEstimate = settingsForm?.elements.monthlyIncomeEstimate;
    if (monthlyEstimate && !monthlyEstimate.checkValidity()) {
      if (!dashboardMode) {
        window.location.hash = "planning";
        guestRoute(false);
      }
      monthlyEstimate.reportValidity();
      return;
    }
    const original = button.textContent;
    button.disabled = true;
    button.textContent = messages.saving;
    status.hidden = true;
    try {
      const response = await fetch(`/api/auth/google?locale=${locale}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projects: state.projects.filter((project) => !project.id && !project.archived),
          fixedCosts: state.fixedCosts.filter((item) => !item.id),
          income: state.income.filter((item) => !item.id),
          expenses: state.expenses.filter((item) => !item.id),
          timeZone: workspaceTimeZone(),
          taxReserveRate: state.taxReserveRate,
          appleFeeRate: state.appleFeeRate,
          cashOnHand: state.cashOnHand,
          ...(monthlyIncomeEstimateChanged ? { monthlyIncomeEstimate: state.monthlyIncomeEstimate } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 403 && data?.error === "subscription_limit") {
        throw new Error(`subscription_limit:${data.limit || state.features.subscriptionLimit || 5}`);
      }
      const destination = data.authUrl || data.redirectUrl;
      if (!response.ok || !destination) throw new Error("save_failed");
      window.location.assign(destination);
    } catch (error) {
      button.disabled = false;
      button.textContent = original;
      const [code, limit] = String(error?.message || "").split(":");
      status.textContent = code === "subscription_limit"
        ? messages.plan.limitReached.replace("{limit}", limit || "5")
        : messages.saveFailed;
      status.hidden = false;
    }
  };

  const refreshProjectOptions = () => {
    renderProjectOptions();
    renderProjects();
  };

  document.querySelector("[data-project-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.querySelector("[data-project-name]");
    const name = String(input.value || "").trim();
    if (!name) return;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const response = await fetch("/api/workspace/projects", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.projects)) throw new Error(data?.error || "project_save_failed");
      state.projects = data.projects;
      input.value = "";
      refreshProjectOptions();
      render();
    } catch (error) {
      window.alert(error?.message === "project_exists" ? messages.projects.exists : messages.projects.saveFailed);
    } finally {
      button.disabled = false;
    }
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-archive-project]");
    if (!button || button.disabled) return;
    if (!window.confirm(messages.projects.archiveConfirm)) return;
    button.disabled = true;
    try {
      const response = await fetch(`/api/workspace/projects?id=${encodeURIComponent(button.dataset.projectId)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.projects)) throw new Error("project_archive_failed");
      state.projects = data.projects;
      refreshProjectOptions();
      render();
    } catch {
      button.disabled = false;
      window.alert(messages.projects.archiveFailed);
    }
  });

  document.querySelector("[data-save-google]")?.addEventListener("click", saveDraft);

  const csvExportPeriod = document.querySelector("[data-csv-export-period]");
  const csvExportLink = document.querySelector("[data-csv-export]");
  let csvPeriodSelected = false;
  const updateCsvExportLink = () => {
    const month = csvExportPeriod.value;
    csvExportLink.href = `/api/workspace/csv?export=income${month ? `&month=${month}` : ""}`;
  };
  csvExportPeriod?.addEventListener("change", () => {
    csvPeriodSelected = true;
    updateCsvExportLink();
  });
  const renderCsvExportPeriods = () => {
    if (!csvExportPeriod) return;
    const previousChoice = csvPeriodSelected ? csvExportPeriod.value : monthKey();
    const months = new Set([monthKey(), previousMonthKey()]);
    state.income.forEach(({ date, recognition }) => {
      if (recognition !== "sold" && /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date)) months.add(date.slice(0, 7));
    });
    csvExportPeriod.replaceChildren(
      ...[...months].sort().reverse().map((month) => new Option(monthLabel(month), month)),
      new Option(messages.csv.allDates, ""),
    );
    csvExportPeriod.value = !previousChoice || months.has(previousChoice) ? previousChoice : monthKey();
    csvExportPeriod.disabled = !state.features.csv;
    updateCsvExportLink();
  };
  const renderPlanLimits = () => {
    renderCsvExportPeriods();
    const csvNodes = [...document.querySelectorAll("[data-csv-pro]")];
    csvNodes.forEach((node) => {
      node.classList.toggle("is-pro-locked", !state.features.csv);
      node.setAttribute("aria-disabled", state.features.csv ? "false" : "true");
      node.title = state.features.csv ? "" : messages.plan.proRequiredCsv;
    });
    document.querySelectorAll("[data-stripe-form] input, [data-stripe-form] button")
      .forEach((node) => { node.disabled = !state.features.sync; });
  };

  const csvMessage = (node, message, isError = false) => {
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    node.classList.toggle("is-error", isError);
  };
  const csvFailedCsv = (rows) => {
    const headers = ["line_number", "reason", "date", "source", "amount", "currency", "platform_fee", "client", "project", "external_ref", "notes"];
    const escape = (value) => {
      const raw = value === null || value === undefined ? "" : String(value);
      return /[",\n\r]/.test(raw) ? `"${raw.replaceAll("\"", "\"\"")}"` : raw;
    };
    const formatRow = ({ line_number, reason, row }) => {
      const values = { ...row, line_number, reason, platform_fee: row.platformFee, external_ref: row.externalRef, project: row.projects?.[0] };
      return headers.map((header) => escape(values[header])).join(",");
    };
    return [headers.join(","), ...rows.map(formatRow)].join("\n");
  };
  document.querySelector("[data-csv-import]")?.addEventListener("change", async (event) => {
    const input = event.target;
    if (!state.features.csv) {
      csvMessage(document.querySelector("[data-csv-message]"), messages.plan.proRequiredCsv);
      input.value = "";
      return;
    }
    const label = document.querySelector("[data-csv-import-label]");
    const status = document.querySelector("[data-csv-message]");
    const failedStatus = document.querySelector("[data-csv-failed-message]");
    const failedLink = document.querySelector("[data-csv-failed-download]");
    const file = input.files?.[0];
    if (!status || !failedStatus || !failedLink || !file) {
      csvMessage(status, messages.csv.invalidFile, true);
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
      const result = messages.csv.result.replaceAll("{imported}", String(data.imported || 0)).replaceAll("{failed}", String(data.failed || 0));
      const unsupportedCurrency = data.failedRows?.some(({ reason }) => reason === "unsupported_currency");
      csvMessage(status, unsupportedCurrency ? `${result} ${messages.csv.usdOnly}` : result);
      if (data.failedRows?.length) {
        const blob = new Blob([`\uFEFF${csvFailedCsv(data.failedRows)}\n`], { type: "text/csv;charset=utf-8" });
        if (failedLink.dataset.url) URL.revokeObjectURL(failedLink.dataset.url);
        const url = URL.createObjectURL(blob);
        failedLink.href = url;
        failedLink.dataset.url = url;
        failedStatus.hidden = false;
      }
      if (dashboardMode && data.imported) await loadDashboard();
    } catch (error) {
      const reason = error?.message === "pro_required" ? messages.plan.proRequiredCsv : error?.message === "empty_file" ? messages.csv.emptyFile : messages.csv.importFailed;
      csvMessage(status, reason, true);
    } finally {
      if (label) label.textContent = original;
      input.value = "";
    }
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-csv-pro]");
    if (!link || state.features.csv) return;
    event.preventDefault();
    csvMessage(document.querySelector("[data-csv-message]"), messages.plan.proRequiredCsv);
  });
  const confirmDelete = async (event) => {
    if (!window.confirm(messages.deleteConfirm)) return;
    const button = event.currentTarget;
    const status = document.querySelector("[data-delete-account-message]");
    status.hidden = true;
    button.disabled = true;
    try {
      const response = await fetch("/api/workspace?type=account", { method: "DELETE", credentials: "same-origin", redirect: "manual" });
      if (response.type !== "opaqueredirect" && response.status !== 302) throw new Error("delete_failed");
      window.location.assign(`/${locale}/`);
    } catch {
      status.textContent = messages.deleteFailed;
      status.hidden = false;
      button.disabled = false;
    }
  };
  document.querySelector("[data-delete-account]")?.addEventListener("click", confirmDelete);
  document.addEventListener("click", async (event) => {
    const undo = event.target.closest("[data-undo-entry]");
    if (undo && !undo.disabled && undo.dataset.undoEntry) {
      const form = undo.closest("form");
      undo.disabled = true;
      try {
        await deleteWorkspaceEntry(undo.dataset.undoType, undo.dataset.undoEntry);
        undo.hidden = true;
        undo.dataset.undoEntry = "";
        showWorkspaceMessage(form, messages.workspace.undone);
      } catch {
        showWorkspaceMessage(form, messages.deleteEntryFailed, true);
      } finally {
        undo.disabled = false;
      }
      return;
    }
    const button = event.target.closest("[data-delete-entry]");
    if (!button || button.disabled) return;
    if (!window.confirm(messages.deleteEntryConfirm)) return;
    if (!button.dataset.entryId) {
      const type = button.dataset.entryType;
      const key = type === "fixed-cost" ? "fixedCosts" : type === "income" ? "income" : "expenses";
      const index = Number(button.dataset.entryIndex);
      state[key] = Number.isInteger(index) && index >= 0
        ? state[key].filter((_, itemIndex) => itemIndex !== index)
        : state[key];
      render();
      return;
    }
    button.disabled = true;
    try {
      await deleteWorkspaceEntry(button.dataset.entryType, button.dataset.entryId);
    } catch {
      button.disabled = false;
      window.alert(messages.deleteEntryFailed);
    }
  });
  const settingsForm = document.querySelector('[data-proto-form="settings"]');
  const timeZoneSelect = settingsForm?.elements.timeZone;
  if (timeZoneSelect) {
    const zones = new Set(["UTC", browserTimeZone, ...(Intl.supportedValuesOf?.("timeZone") || [
      "America/Los_Angeles", "America/New_York", "Asia/Shanghai", "Asia/Taipei", "Europe/London",
    ])]);
    timeZoneSelect.replaceChildren(...[...zones].sort().map((zone) => new Option(zone, zone)));
    timeZoneSelect.value = browserTimeZone;
  }
  settingsForm?.addEventListener("input", (event) => {
    if (dashboardMode) return;
    state.taxReserveRate = String(settingsForm.elements.taxReserveRate.value || "");
    state.appleFeeRate = String(settingsForm.elements.appleFeeRate.value || "");
    state.cashOnHand = String(settingsForm.elements.cashOnHand.value || "");
    if (event.target === settingsForm.elements.monthlyIncomeEstimate) {
      state.monthlyIncomeEstimate = event.target.value;
      monthlyIncomeEstimateChanged = true;
    }
    renderMetrics();
  });
  settingsForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!dashboardMode || !settingsForm.reportValidity()) return;
    const settings = Object.fromEntries(new FormData(settingsForm));
    await submitWorkspaceForm(settingsForm, async () => {
      await postWorkspace({ settings });
      showWorkspaceMessage(settingsForm, messages.workspace.settingsSaved);
    });
  });

  document.querySelector("[data-weekly-dismiss]")?.addEventListener("click", () => {
    localStorage.setItem(`gigledger_week_dismissed_${weekKey()}`, "1");
    const wrapper = document.querySelector("[data-weekly-summary]");
    if (wrapper) wrapper.hidden = true;
  });

  const shareImage = async (card) => {
    const amount = money(calculateShareCard(card));
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 500;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff7ef";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ff6b35";
    context.fillRect(0, 0, canvas.width, 14);
    context.fillStyle = "#2b1b12";
    context.font = "700 28px system-ui, sans-serif";
    context.fillText(locale === "zh-TW" ? messages.share[card === "ai" ? "ai" : "daily"] : messages.share[card], 64, 140);
    context.font = "800 96px system-ui, sans-serif";
    context.fillText(amount, 64, 262);
    context.font = "600 26px system-ui, sans-serif";
    context.fillStyle = "#654c3f";
    context.fillText("GigLedger", 64, 354);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob;
  };

  document.querySelector("[data-share-download]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const card = document.querySelector("[data-share-card='ai']")?.offsetParent ? "ai" : "daily";
    const blob = await shareImage(card);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `gigledger-${card}-${today()}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
  });

  document.querySelector("[data-share-x]")?.addEventListener("click", () => {
    const card = document.querySelector("[data-share-card='ai']")?.offsetParent ? "ai" : "daily";
    const amount = money(calculateShareCard(card));
    const text = messages.share[card === "ai" ? "aiText" : "dailyText"].replace("{amount}", amount);
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  });

  document.querySelector("[data-share-copy]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const card = document.querySelector("[data-share-card='ai']")?.offsetParent ? "ai" : "daily";
    const amount = money(calculateShareCard(card));
    const text = messages.share[card === "ai" ? "aiText" : "dailyText"].replace("{amount}", amount);
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = locale === "zh-TW" ? "已複製" : "Copied";
    setTimeout(() => { button.textContent = original; }, 1800);
  });

  const ledgerSections = {
    ledger: "income", income: "income", "income-entry": "income",
    expenses: "expenses", "expense-entry": "expenses", projects: "projects",
    "project-entry": "projects", "fixed-costs": "fixed-costs", "fixed-cost-entry": "fixed-costs",
  };
  const syncActiveLinks = (selector, key, attribute, current = "location") => {
    for (const link of document.querySelectorAll(selector)) {
      if (link.dataset[attribute] === key) link.setAttribute("aria-current", current);
      else link.removeAttribute("aria-current");
    }
  };
  const focusHeading = (node) => {
    if (node && !node.matches("input")) node.tabIndex = -1;
    node?.focus({ preventScroll: true });
  };
  const entryDialogs = [...document.querySelectorAll("[data-entry-dialog]")];
  const showEntryDialog = (hash) => {
    let selected = null;
    for (const dialog of entryDialogs) {
      if (dialog.dataset.entryDialog === hash) selected = dialog;
      else if (dialog.open) dialog.close();
    }
    document.querySelectorAll("[data-add-menu][open]").forEach((node) => { node.open = false; });
    if (!selected) return false;
    if (!selected.open) {
      window.scrollTo({ top: 0, behavior: "instant" });
      selected.showModal();
      selected.querySelector(".app-form input")?.focus();
    }
    return true;
  };
  const workspaceRoute = (moveFocus = true) => {
    const hash = window.location.hash.slice(1);
    const ledgerSection = Object.hasOwn(ledgerSections, hash) ? ledgerSections[hash] : null;
    const settingsSections = {
      settings: "planning", planning: "planning", "cash-settings": "planning",
      csv: "csv", sources: "sources", "stripe-connect": "sources",
      "app-store-connect": "sources", account: "account",
    };
    const settingsSection = Object.hasOwn(settingsSections, hash) ? settingsSections[hash] : null;
    const view = ledgerSection ? "ledger" : settingsSection ? "settings" : "overview";
    document.querySelectorAll("[data-workspace-view]").forEach((node) => {
      node.hidden = node.dataset.workspaceView !== view;
    });
    document.querySelectorAll("[data-ledger-panel]").forEach((node) => {
      node.hidden = node.id !== ledgerSection;
    });
    document.querySelectorAll("[data-settings-panel]").forEach((node) => {
      node.hidden = node.id !== settingsSection;
    });
    syncActiveLinks("[data-workspace-nav]", view === "overview" ? "dashboard" : view, "workspaceNav", "page");
    syncActiveLinks("[data-ledger-nav]", ledgerSection, "ledgerNav");
    syncActiveLinks("[data-settings-nav]", settingsSection, "settingsNav");
    if (!workspaceReady) return;
    if (showEntryDialog(hash) || !moveFocus) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    if (hash === "fixed-costs" && subscriptionToFocus) {
      const id = subscriptionToFocus;
      subscriptionToFocus = null;
      const row = document.querySelector(`[data-fixed-cost-row="${CSS.escape(id)}"]`);
      const action = row?.querySelector(".review-button") || row?.querySelector(".entry-links a:last-child");
      if (action) {
        action.scrollIntoView({ block: "nearest", inline: "center" });
        action.focus({ preventScroll: true });
        return;
      }
    }
    const target = hash === "cash-settings"
      ? document.getElementById(hash)
      : document.getElementById(ledgerSection || settingsSection)?.querySelector("h2")
        || document.querySelector(`[data-workspace-view="${view}"] h1`);
    focusHeading(target);
  };

  const guestRoute = (moveFocus = true) => {
    const hash = window.location.hash.slice(1);
    const panel = Object.hasOwn(ledgerSections, hash) ? ledgerSections[hash]
      : hash === "cash-settings" ? "planning"
      : ["dashboard", "how-it-works", "planning"].includes(hash) ? hash : null;
    flowSection.hidden = Boolean(panel);
    document.querySelector("[data-guest-ledger-nav]").closest("nav").hidden = !panel;
    document.querySelector("[data-guest-actions]").hidden = !panel;
    document.querySelectorAll("[data-guest-panel]").forEach((node) => { node.hidden = node.id !== panel; });
    syncActiveLinks("[data-guest-nav]", panel ? "dashboard" : "onboarding", "guestNav", "page");
    syncActiveLinks("[data-guest-ledger-nav]", panel, "guestLedgerNav");
    if (!showEntryDialog(hash) && moveFocus) {
      window.scrollTo({ top: 0, behavior: "instant" });
      const target = hash === "cash-settings"
        ? document.getElementById(hash)
        : (panel ? document.getElementById(panel) : flowSection)?.querySelector("h1, h2");
      focusHeading(target);
    }
  };

  const loadDashboard = async () => {
    if (!dashboardMode) return;
    const loader = document.querySelector("[data-workspace-load]");
    const loadingText = loader.querySelector("[data-workspace-load-message]");
    const retry = loader.querySelector("[data-workspace-retry]");
    if (!workspaceReady) {
      loadingText.textContent = messages.workspace.loading;
      retry.hidden = true;
    }
    try {
      const response = await fetch("/api/me", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 || (response.ok && !data.ledger)) {
        window.location.assign(`/${locale}/app`);
        return;
      }
      if (!response.ok || !data.authenticated) throw new Error("dashboard_load_failed");
      let ledger = data.ledger;
      if (!ledger.workspace.timeZone) {
        const initialization = await fetch("/api/workspace", {
          method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
          body: JSON.stringify({ initTimeZone: browserTimeZone }),
        });
        const result = await initialization.json().catch(() => ({}));
        if (!initialization.ok || !result.ledger?.workspace?.timeZone) throw new Error("timezone_initialization_failed");
        ledger = result.ledger;
      }
      applyLedger(ledger);
      const settingsForm = document.querySelector('[data-proto-form="settings"]');
      if (settingsForm) {
        settingsForm.elements.cashOnHand.value = state.cashOnHand;
        settingsForm.elements.appleFeeRate.value = state.appleFeeRate;
      }
      refreshAppleFeeInput();
      refreshTaxInputs();
      render();
      const wasReady = workspaceReady;
      workspaceReady = true;
      document.querySelector("[data-dashboard]").setAttribute("aria-busy", "false");
      loader.hidden = true;
      loader.closest("main").classList.remove("workspace-pending");
      if (!wasReady) workspaceRoute(Boolean(window.location.hash));
      await loadIntegrations();
    } catch {
      loader.hidden = false;
      loadingText.textContent = messages.workspace.loadFailed;
      retry.hidden = false;
    }
  };

  const integrationNodes = () => ({
    panel: document.querySelector("[data-integration-panel]"),
    ready: Boolean(document.querySelector("[data-integration-panel]")),
    badge: document.querySelector("[data-plan-badge]"),
    stripe: {
      form: document.querySelector("[data-stripe-form]"),
      message: document.querySelector("[data-stripe-message]"),
      statusLabel: document.querySelector("[data-stripe-status-label]"),
      syncLabel: document.querySelector("[data-stripe-sync-label]"),
      sync: document.querySelector("[data-stripe-sync]"),
      disconnect: document.querySelector("[data-stripe-disconnect]"),
    },
    appStore: {
      message: document.querySelector("[data-app-store-message]"),
      disconnect: document.querySelector("[data-app-store-disconnect]"),
    },
  });
  const renderIntegration = () => {
    const nodes = integrationNodes();
    if (!nodes.ready) return;
    if (nodes.badge) nodes.badge.textContent = state.features.plan === "pro" ? messages.plan.pro : messages.plan.free;
    const upgradeNote = document.querySelector("[data-plan-upgrade]");
    if (upgradeNote) upgradeNote.hidden = state.features.plan === "pro";
    const stripeConnected = ["connected", "pending", "error"].includes(stripeIntegration?.status);
    const stripeReady = stripeIntegration?.status === "connected";
    const stripeNodes = nodes.stripe;
    if (stripeNodes.statusLabel) stripeNodes.statusLabel.textContent = stripeConnected ? messages.integrations.connected : messages.integrations.notConnected;
    if (stripeNodes.syncLabel) {
      stripeNodes.syncLabel.textContent = !stripeConnected
        ? messages.integrations.neverSynced
        : stripeIntegration.lastSyncAt
          ? messages.integrations.lastSync.replace("{date}", stripeIntegration.lastSyncAt.slice(0, 10))
          : messages.integrations.neverSynced;
    }
    if (stripeNodes.sync) stripeNodes.sync.disabled = !stripeReady || !state.features.sync;
    if (stripeNodes.disconnect) stripeNodes.disconnect.disabled = !stripeConnected;
    const formInputs = stripeNodes.form ? [...stripeNodes.form.elements] : [];
    formInputs.forEach((node) => { node.disabled = !state.features.sync; });

    const appStoreConnected = ["connected", "pending"].includes(appStoreIntegration?.status);
    const appStoreNodes = nodes.appStore;
    const appStoreControls = document.querySelector("[data-app-store-controls]");
    if (appStoreControls) appStoreControls.hidden = !appStoreConnected;
    if (appStoreNodes.disconnect) appStoreNodes.disconnect.disabled = !appStoreConnected;
    renderAttentionQueue(calculate());
  };

  const showIntegrationMessage = (message, isError = false, provider = "stripe") => {
    const node = integrationNodes()[provider]?.message;
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    node.dataset.error = isError ? "true" : "false";
  };

  const loadIntegrations = async () => {
    if (!dashboardMode || !integrationNodes().panel) return;
    try {
      const response = await fetch("/api/workspace/integrations", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "load_failed");
      if (data.features) state.features = data.features;
      stripeIntegration = (data.integrations || []).find((item) => item.type === "stripe") || null;
      appStoreIntegration = (data.integrations || []).find((item) => item.type === "app_store") || null;
      integrationsLoaded = true;
      renderPlanLimits();
      if (integrationNodes().ready) renderIntegration();
      else renderAttentionQueue(calculate());
      if (stripeIntegration?.lastError) showIntegrationMessage(messages.integrations.syncFailed.replace("{error}", stripeIntegration.lastError), true);
      if (appStoreIntegration?.lastError) showIntegrationMessage(messages.integrations.appStoreSyncUnavailable, true, "appStore");
    } catch {
      integrationsLoaded = true;
      renderIntegration();
      showIntegrationMessage(messages.integrations.loadFailed, true);
    }
  };

  document.querySelector("[data-stripe-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const secretKey = String(data.get("secretKey") || "").trim();
    if (!secretKey.startsWith("rk_") && !secretKey.startsWith("sk_")) {
      showIntegrationMessage(messages.integrations.invalidKey, true);
      return;
    }
    const button = form.querySelector("button[type=submit]");
    const original = button.textContent;
    button.disabled = true;
    button.textContent = messages.integrations.syncing;
    try {
      const response = await fetch("/api/workspace/integrations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "stripe", secretKey, accountLabel: String(data.get("accountLabel") || "").trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 403 && result.error === "pro_required") {
        showIntegrationMessage(messages.integrations.proRequired, true);
        return;
      }
      if (!response.ok) {
        showIntegrationMessage(result.error ? messages.integrations.syncFailed.replace("{error}", result.error) : messages.integrations.connectFailed, true);
        return;
      }
      if (result.ledger) {
        applyLedger(result.ledger);
        render();
      }
      form.reset();
      stripeIntegration = { type: "stripe", status: "connected", lastSyncAt: new Date().toISOString(), lastError: null };
      renderIntegration();
      showIntegrationMessage(messages.integrations.synced.replace("{count}", String(result.imported || 0)));
    } catch {
      showIntegrationMessage(messages.integrations.connectFailed, true);
    } finally {
      button.disabled = false;
      button.textContent = original;
      renderIntegration();
    }
  });

  document.querySelector("[data-stripe-sync]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = messages.integrations.syncing;
    try {
      const response = await fetch("/api/workspace/integrations/sync", { method: "POST", credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showIntegrationMessage(data.error ? messages.integrations.syncFailed.replace("{error}", data.error) : messages.integrations.connectFailed, true);
        return;
      }
      if (data.ledger) {
        applyLedger(data.ledger);
        render();
      }
      stripeIntegration = { ...(stripeIntegration || { type: "stripe", status: "connected" }), lastSyncAt: new Date().toISOString(), lastError: null };
      renderIntegration();
      showIntegrationMessage(messages.integrations.synced.replace("{count}", String(data.imported || 0)));
    } catch {
      showIntegrationMessage(messages.integrations.connectFailed, true);
    } finally {
      button.textContent = original;
      renderIntegration();
    }
  });

  document.querySelector("[data-stripe-disconnect]")?.addEventListener("click", async (event) => {
    if (!window.confirm(messages.integrations.disconnectConfirm)) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const response = await fetch("/api/workspace/integrations?type=stripe", { method: "DELETE", credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "disconnect_failed");
      stripeIntegration = null;
      const message = integrationNodes().stripe.message;
      if (message) message.hidden = true;
      renderIntegration();
    } catch {
      button.disabled = false;
      showIntegrationMessage(messages.integrations.disconnectFailed, true);
    }
  });

  document.querySelector("[data-app-store-disconnect]")?.addEventListener("click", async (event) => {
    if (!window.confirm(messages.integrations.appStoreDisconnectConfirm)) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const response = await fetch("/api/workspace/integrations?type=app_store", {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "disconnect_failed");
      appStoreIntegration = null;
      const message = integrationNodes().appStore.message;
      if (message) message.hidden = true;
      renderIntegration();
    } catch {
      button.disabled = false;
      showIntegrationMessage(messages.integrations.appStoreDisconnectFailed, true, "appStore");
    }
  });

  const applyLedger = (ledger) => {
    if (!ledger) return;
    const previousDate = today();
    const previousTimeZone = state.timeZone;
    state.timeZone = ledger.workspace?.timeZone || null;
    if (timeZoneSelect && previousTimeZone !== state.timeZone) {
      const zone = workspaceTimeZone();
      if (![...timeZoneSelect.options].some((option) => option.value === zone)) timeZoneSelect.add(new Option(zone, zone));
      timeZoneSelect.value = zone;
    }
    const date = today();
    for (const input of [fixedForm?.elements.startDate, incomeForm?.elements.date, expenseForm?.elements.date]) {
      if (input && !input.closest("dialog")?.open && (!input.value || input.value === previousDate)) input.value = date;
    }
    if (ledger.workspace?.features) state.features = ledger.workspace.features;
    state.projects = ledger.projects || [];
    state.taxReserveRate = ledger.workspace?.taxReserveRate === null
      || ledger.workspace?.taxReserveRate === undefined
      ? "" : String(Math.round(ledger.workspace.taxReserveRate * 1000) / 10);
    state.appleFeeRate = ledger.workspace?.appleFeeRate === null
      || ledger.workspace?.appleFeeRate === undefined
      ? "" : String(Math.round(ledger.workspace.appleFeeRate * 100));
    state.cashOnHand = ledger.workspace?.cashOnHand === null
      || ledger.workspace?.cashOnHand === undefined
      ? "" : String(ledger.workspace.cashOnHand);
    if (settingsForm && !monthlyIncomeEstimateChanged) {
      state.monthlyIncomeEstimate = String(ledger.workspace?.monthlyIncomeEstimate ?? "");
      settingsForm.elements.monthlyIncomeEstimate.value = state.monthlyIncomeEstimate;
    }
    const cycleValues = new Set(cycles.map((cycle) => cycle.value));
    state.fixedCosts = (ledger.fixedCosts || []).map((item) => ({
      name: item.name,
      amount: Number(item.amount) || 0,
      cycle: cycleValues.has(item.cycle) ? item.cycle : "monthly",
      multiplier: cycles.find((cycle) => cycle.value === (cycleValues.has(item.cycle) ? item.cycle : "monthly"))?.multiplier || 12,
      businessUse: Number(item.businessUse) || 0,
      isSubscription: Boolean(item.isSubscription),
      isSoftware: item.isSoftware !== false,
      templateKey: item.templateKey || "",
      productUrl: item.productUrl || "",
      manageUrl: item.manageUrl || "",
      nextBillingDate: item.nextBillingDate || "",
      projects: item.projects || (item.project ? [item.project] : []),
      allocation: item.allocation || (item.projects || []).map((name) => ({ name, percent: 100 })),
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      reviews: item.reviews || [],
      versions: item.versions || [],
      id: item.id,
    }));
    state.income = (ledger.income || []).map((item) => ({
      date: item.date,
      source: item.source,
      client: item.client || "",
      amount: Number(item.amount) || 0,
      platformFee: Number(item.platformFee) || 0,
      saleDate: item.saleDate || "",
      recognition: item.recognition || "received",
      payoutStatus: item.payoutStatus || "",
      integrationId: item.integrationId || null,
      projects: item.projects || (item.project ? [item.project] : []),
      id: item.id,
    }));
    state.expenses = (ledger.expenses || []).map((item) => ({
      date: item.date,
      category: item.category,
      merchant: item.merchant || "",
      amount: Number(item.amount) || 0,
      businessUse: Number(item.businessUse ?? 100),
      notes: item.notes || "",
      projects: item.projects || (item.project ? [item.project] : []),
      id: item.id,
    }));
  };

  const flowSection = document.querySelector("#onboarding");
  const flowPanels = [...document.querySelectorAll("[data-flow-step]")];
  const flowBack = document.querySelector("[data-flow-back]");
  const flowNext = document.querySelector("[data-flow-next]");
  const flowSave = document.querySelector("[data-flow-save]");
  const flowIncome = document.querySelector("[data-flow-income]");
  const flowCash = document.querySelector("[data-flow-cash]");
  const flowTax = document.querySelector("[data-flow-tax]");
  let flowStep = 1;
  let flowFixedCosts = [];

  const selectedTemplateAmounts = () => [...document.querySelectorAll("[data-template-key]:checked")]
    .map((checkbox) => document.querySelector(`[data-template-amount="${checkbox.dataset.templateKey}"]`));

  const selectedTemplates = () => selectedTemplateAmounts()
    .map((amountInput) => {
      const key = amountInput.dataset.templateAmount;
      const template = messages.flow.templates.find((item) => item.key === key);
      const cycle = cycles.find((entry) => entry.value === (template.cycle || "monthly"));
      return {
        name: template.label,
        amount: amountInput.valueAsNumber,
        cycle: cycle.value,
        multiplier: cycle.multiplier,
        businessUse: 100,
        startDate: today(),
        isSubscription: true,
        isSoftware: template.isSoftware ?? true,
        templateKey: key,
        productUrl: template.productUrl || null,
        manageUrl: template.manageUrl || null,
      };
    });

  const otherFixedCost = () => {
    const nameNode = document.querySelector("[data-other-name]");
    const amountNode = document.querySelector("[data-other-amount]");
    const name = String(nameNode?.value || "").trim();
    const amount = Number(amountNode?.value || 0);
    return name && amount > 0 ? {
      name, amount, cycle: "monthly", multiplier: 12, businessUse: 100,
      startDate: today(), isSubscription: false, isSoftware: false,
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
    const monthlyIncome = minorUnits(flowIncome.value);
    const dailyIncome = monthlyIncome === null ? null : roundCents(scale(exact(BigInt(monthlyIncome)), 12n, 365n));
    if (comparisonNode) comparisonNode.textContent = dailyIncome === null ? messages.flow.unset : dayMoney(usd(dailyIncome));
    if (gapNode) {
      const gap = dailyIncome === null ? 0n : dailyIncome - roundCents(result.dailyRate);
      if (gap < 0n) {
        gapNode.textContent = `${messages.flow.behind} ${dayMoney(usd(-gap))}`;
        gapNode.hidden = false;
      } else if (gap > 0n) {
        gapNode.textContent = `${messages.flow.ahead} ${dayMoney(usd(gap))}`;
        gapNode.hidden = false;
      } else {
        gapNode.hidden = true;
      }
    }
    const cash = minorUnits(flowCash.value);
    const runway = daysCovered(cash === null ? null : BigInt(cash), result.dailyRate);
    if (runwayNode) runwayNode.textContent = runway === null ? messages.flow.unset : `${runway} ${messages.flow.days}`;
    if (taxNode) taxNode.textContent = monthlyIncome === null || flowTax.value === ""
      ? messages.flow.unset
      : money(roundedUsd(percent(exact(BigInt(monthlyIncome)), flowTax.value)));
  };

  const applyFlowToLedger = () => {
    const templateCosts = selectedTemplates();
    const otherCost = otherFixedCost();
    const manualCosts = state.fixedCosts.filter((item) => !flowFixedCosts.includes(item));
    flowFixedCosts = [...templateCosts, ...(otherCost ? [otherCost] : [])];
    state.fixedCosts = [...flowFixedCosts, ...manualCosts];
    state.monthlyIncomeEstimate = flowIncome.value;
    monthlyIncomeEstimateChanged = flowIncome.value !== "";
    state.taxReserveRate = flowTax.value;
    state.cashOnHand = flowCash.value;
    if (settingsForm) {
      settingsForm.elements.cashOnHand.value = state.cashOnHand;
      settingsForm.elements.appleFeeRate.value = state.appleFeeRate;
      settingsForm.elements.monthlyIncomeEstimate.value = state.monthlyIncomeEstimate;
    }
    refreshTaxInputs();
    render();
    renderFlowResults();
  };

  const showFlowStep = (nextStep, moveFocus = false) => {
    flowStep = Math.min(3, Math.max(1, nextStep));
    flowPanels.forEach((panel) => {
      panel.hidden = Number(panel.dataset.flowStep) !== flowStep;
    });
    if (flowBack) flowBack.hidden = flowStep === 1;
    if (flowNext) {
      flowNext.hidden = flowStep === 3;
      flowNext.textContent = flowStep === 2 ? messages.flow.seeResults : messages.flow.next;
    }
    if (flowStep === 3) applyFlowToLedger();
    if (moveFocus) {
      window.scrollTo({ top: 0, behavior: "instant" });
      focusHeading(flowPanels.find((panel) => !panel.hidden)?.querySelector("h2"));
    }
  };

  flowBack?.addEventListener("click", () => showFlowStep(flowStep - 1, true));
  flowNext?.addEventListener("click", () => {
    if (flowStep === 2 && ![flowIncome, flowCash, flowTax].every((input) => input.reportValidity())) return;
    if (flowStep === 1) {
      for (const amount of selectedTemplateAmounts()) {
        amount.required = true;
        if (!amount.checkValidity()) {
          const more = amount.closest("details");
          if (more) more.open = true;
          amount.reportValidity();
          return;
        }
      }
      const warning = document.querySelector("[data-skip-warning]");
      if (warning) warning.hidden = Boolean(selectedTemplates().length || otherFixedCost());
    }
    showFlowStep(flowStep + 1, true);
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-review-answer]");
    if (!button || button.disabled) return;
    const group = button.closest(".review-actions");
    const buttons = [...group.querySelectorAll("button")];
    buttons.forEach((action) => { action.disabled = true; });
    try {
      await updateWorkspace("/api/workspace", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fixedCostId: button.dataset.entryId,
          answer: button.dataset.reviewAnswer,
          billingPeriod: button.dataset.billingPeriod,
          timeZone: workspaceTimeZone(),
        }),
      });
      const updated = [...document.querySelectorAll("[data-review-answer]")].find((candidate) =>
        candidate.dataset.entryId === button.dataset.entryId && candidate.dataset.reviewAnswer === button.dataset.reviewAnswer);
      updated?.focus({ preventScroll: true });
    } catch {
      buttons.forEach((action) => { action.disabled = false; });
      window.alert(messages.subscriptionReview.failed);
    }
  });
  flowSave?.addEventListener("click", saveDraft);
  document.querySelector("[data-template-grid]")?.addEventListener("input", (event) => {
    if (!event.target.matches("[type=checkbox]")) return;
    event.target.closest(".template-card").querySelector("[data-template-amount]").required = event.target.checked;
    const warning = document.querySelector("[data-skip-warning]");
    if (warning) warning.hidden = Boolean(selectedTemplates().length || otherFixedCost());
  });

  flowSection?.classList.add("ready");
  [fixedForm?.elements.startDate, incomeForm?.elements.date, expenseForm?.elements.date].forEach((input) => {
    if (input) input.value = today();
  });
  showFlowStep(1);
  const route = dashboardMode ? workspaceRoute : guestRoute;
  window.addEventListener("hashchange", () => route());
  document.addEventListener("click", (event) => {
    const subscriptionLink = event.target.closest("[data-subscription-focus]");
    if (subscriptionLink && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      subscriptionToFocus = subscriptionLink.dataset.subscriptionFocus;
    }
    const quickLink = event.target.closest("[data-add-menu] a, .entry-link-button");
    if (quickLink?.hash === window.location.hash) route();
  });
  for (const dialog of entryDialogs) {
    const id = dialog.dataset.entryDialog;
    const dismiss = () => {
      if (dialog === expenseDialog && editingExpense && expenseForm.getAttribute("aria-busy") === "true") return;
      const wasEntry = window.location.hash === `#${id}`;
      if (wasEntry) history.replaceState(history.state, "", `#${ledgerSections[id]}`);
      if (dialog.open) dialog.close();
      if (dialog === expenseDialog && editingExpense) setExpenseEdit(null);
      if (wasEntry) document.querySelector(`.entry-link-button[href="#${id}"]`)?.focus({ preventScroll: true });
    };
    dialog.querySelector("[data-close-entry]").addEventListener("click", dismiss);
    if (dialog === expenseDialog) {
      dialog.addEventListener("cancel", (event) => {
        if (editingExpense && expenseForm.getAttribute("aria-busy") === "true") event.preventDefault();
      });
    }
    dialog.addEventListener("close", () => {
      if (id === "fixed-cost-entry" && editingFixedCostId) fixedForm.querySelector("[data-fixed-cancel]").click();
      if (dialog === expenseDialog && editingExpense && !dialog.open) setExpenseEdit(null);
      if (window.location.hash === `#${id}`) dismiss();
    });
  }
  document.querySelector("[data-workspace-retry]")?.addEventListener("click", loadDashboard);
  document.querySelectorAll("[data-workspace-period]").forEach((button) => {
    button.addEventListener("click", () => {
      reportPeriod = button.dataset.workspacePeriod;
      document.querySelectorAll("[data-workspace-period]").forEach((choice) => {
        choice.setAttribute("aria-pressed", String(choice === button));
      });
      renderMetrics();
      renderProjects();
    });
  });
  if (!dashboardMode) route(Boolean(window.location.hash));
  const refreshDay = () => {
    if (!document.hidden && today() !== renderedDate) {
      for (const input of [fixedForm?.elements.startDate, incomeForm?.elements.date, expenseForm?.elements.date]) {
        if (input?.value === renderedDate && !input.closest("dialog")?.open) input.value = today();
      }
      render();
    }
  };
  document.addEventListener("visibilitychange", refreshDay);
  window.addEventListener("focus", refreshDay);

  loadDashboard().finally(() => {
    window.__gigledgerLoaded = true;
  });
  render();
})();
