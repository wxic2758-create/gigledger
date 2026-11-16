(() => {
  const root = document.documentElement;
  const locale = root.dataset.locale === "zh-TW" ? "zh-TW" : "en";
  const messages = JSON.parse(document.getElementById("proto-messages").textContent);
  const dashboardMode = Boolean(document.querySelector("[data-dashboard]"));
  const state = { projects: [], fixedCosts: [], income: [], expenses: [], taxReserveRate: "", appleFeeRate: "", cashOnHand: "", features: { plan: "free", subscriptionLimit: 5, csv: false, sync: false, appStoreSync: false, subscriptionReview: false } };
  let editingFixedCostId = null;

  const currency = new Intl.NumberFormat(locale === "zh-TW" ? "zh-TW" : "en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  });
  const money = (value) => currency.format(Number.isFinite(value) ? value : 0);
  const day = new Intl.NumberFormat(locale === "zh-TW" ? "zh-TW" : "en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const dayMoney = (value) => `$${day.format(Number.isFinite(value) ? value : 0)}`;
  const localDate = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const today = () => localDate();
  const previousDate = (value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return "";
    parsed.setUTCDate(parsed.getUTCDate() - 1);
    return parsed.toISOString().slice(0, 10);
  };
  const nextDate = (value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return "";
    parsed.setUTCDate(parsed.getUTCDate() + 1);
    return parsed.toISOString().slice(0, 10);
  };
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
  const monthDayCount = (date = new Date()) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  const monthDaysElapsed = (date = new Date()) => date.getDate();

  const monthKey = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  const previousMonthKey = (date = new Date()) => {
    const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    return monthKey(previous);
  };

  const consecutiveUnused = (reviews = []) => {
    const sorted = [...reviews]
      .filter((review) => review?.period && review?.answer)
      .sort((left, right) => String(right.period).localeCompare(String(left.period)));
    if (sorted.length < 2) return false;
    const [latest, previous] = sorted;
    if (latest.answer !== "not_used" || previous.answer !== "not_used") return false;
    return previousMonthKey(new Date(`${latest.period}-15T12:00:00`)) === previous.period;
  };

  const fullMonthDailyIncome = () => {
    const now = new Date();
    const currentMonth = monthKey(now);
    const buckets = new Map();
    for (const item of state.income) {
      if (item.recognition === "sold") continue;
      const key = String(item.date || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(key) || key >= currentMonth) continue;
      buckets.set(key, (buckets.get(key) || 0) + (Number(item.amount) || 0) - (Number(item.platformFee) || 0));
    }
    const months = [...buckets.keys()].sort().slice(-3);
    if (!months.length) return null;
    let total = 0;
    let days = 0;
    for (const key of months) {
      const [year, month] = key.split("-").map(Number);
      total += buckets.get(key) || 0;
      days += monthDayCount(new Date(year, month - 1, 1));
    }
    return days ? { average: total / days, monthCount: months.length } : null;
  };

  const effectiveVersionAt = (versions, value) => [...(versions || [])]
    .filter((version) => version.effectiveFrom <= value)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0] || null;

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

  const monthlyAmountForVersion = (version) => {
    const multiplier = cycles.find((cycle) => cycle.value === version?.cycle)?.multiplier || 0;
    return (Number(version?.amount) || 0) * multiplier / 12
      * (Number(version?.businessUse) || 0) / 100;
  };

  const activeDaysInPeriod = (item, date = new Date(), selectedMonth = monthKey(date)) => {
    const daysInMonth = monthDayCount(date);
    const first = `${selectedMonth}-01`;
    const last = `${selectedMonth}-${String(daysInMonth).padStart(2, "0")}`;
    const start = item.startDate && item.startDate > first ? item.startDate : first;
    const end = item.endDate && item.endDate < last ? item.endDate : last;
    if (start > end) return 0;
    return Math.floor((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1;
  };

  const monthlyCostInMonth = (item, selectedMonth) => {
    const daysInMonth = monthDayCount(new Date(`${selectedMonth}-01T12:00:00`));
    const monthStart = `${selectedMonth}-01`;
    const monthEnd = `${selectedMonth}-${String(daysInMonth).padStart(2, "0")}`;
    const versionFallback = effectiveVersionForItem(item, monthEnd);
    const baseVersion = {
      ...versionFallback,
      effectiveFrom: item.startDate || versionFallback.effectiveFrom,
      effectiveTo: item.endDate || versionFallback.effectiveTo,
    };
    const overlap = (item.versions || []).filter((version) => version.effectiveFrom <= monthEnd
      && (!version.effectiveTo || version.effectiveTo >= monthStart));
    if (!overlap.length) {
      return monthlyAmountForVersion(baseVersion)
        * activeDaysInPeriod(item, new Date(`${selectedMonth}-01T12:00:00`), selectedMonth) / daysInMonth;
    }
    return overlap.reduce((versionSum, version) => {
      const versionStart = version.effectiveFrom > monthStart ? version.effectiveFrom : monthStart;
      const versionEnd = version.effectiveTo && version.effectiveTo < monthEnd ? version.effectiveTo : monthEnd;
      if (versionStart > versionEnd) return versionSum;
      const days = Math.floor((new Date(`${versionEnd}T00:00:00`) - new Date(`${versionStart}T00:00:00`)) / 86400000) + 1;
      return versionSum + monthlyAmountForVersion(version) * days / daysInMonth;
    }, 0);
  };

  const isInCurrentMonth = (value) => String(value || "").slice(0, 7) === monthKey();

  const calculate = () => {
    const active = (item) => {
      const current = today();
      return (!item.startDate || item.startDate <= current) && (!item.endDate || item.endDate >= current);
    };
    const dailyFloor = state.fixedCosts.reduce((sum, item) => sum + (
      active(item)
        ? monthlyAmountForVersion(effectiveVersionForItem(item)) * 12 / 365
        : 0
    ), 0);
    const monthIncomeEntries = state.income.filter((item) => isInCurrentMonth(item.date) && item.recognition !== "sold");
    const soldIncome = state.income
      .filter((item) => isInCurrentMonth(item.date) && item.recognition === "sold")
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const grossIncome = monthIncomeEntries.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const platformFees = monthIncomeEntries.reduce((sum, item) => sum + (Number(item.platformFee) || 0), 0);
    const netIncome = grossIncome - platformFees;
    const monthlyFixedCosts = state.fixedCosts.reduce(
      (sum, item) => sum + monthlyCostInMonth(item, monthKey()),
      0,
    );
    const monthlyExpenses = state.expenses
      .filter((item) => isInCurrentMonth(item.date))
      .reduce((sum, item) => sum + (Number(item.amount) || 0) * (Number(item.businessUse) || 0) / 100, 0);
    const monthIncome = netIncome;
    const rate = Number(state.taxReserveRate) / 100;
    const requiredToDate = dailyFloor * monthDaysElapsed();
    const savings = state.cashOnHand === "" ? null : Number(state.cashOnHand);
    const incomeAverage = fullMonthDailyIncome();
    const netBurn = incomeAverage && dailyFloor > 0 ? dailyFloor - incomeAverage.average : null;
    return {
      dailyFloor, grossIncome, platformFees, netIncome, monthlyFixedCosts,
      monthlyExpenses,
      soldIncome,
      trueProfit: netIncome - monthlyFixedCosts - monthlyExpenses,
      taxReserve: Number.isFinite(rate) && state.taxReserveRate !== "" && rate >= 0
        ? netIncome * rate
        : null,
      requiredToDate,
      monthIncome,
      comparison: monthIncome - requiredToDate,
      savings,
      noNewWorkRunway: savings !== null && Number.isFinite(savings) && savings > 0 && dailyFloor > 0
        ? Math.floor(savings / dailyFloor)
        : null,
      incomeAverage,
      netBurn,
      averageRunway: netBurn === null || savings === null || !Number.isFinite(savings) || savings <= 0
        ? null
        : netBurn <= 0 ? null : Math.floor(savings / netBurn),
      cashNotBurning: netBurn !== null && netBurn <= 0,
      subscriptionSummary: subscriptionSummary(),
      aiMonthlyCosts: state.fixedCosts.filter((item) => item.isSubscription && item.isSoftware && active(item)).reduce(
        (sum, item) => sum + (Number(versionValue(item, "amount", item.amount)) || 0)
          * (Number(cycles.find((cycle) => cycle.value === versionValue(item, "cycle", item.cycle))?.multiplier) || 0) / 12
          * (Number(versionValue(item, "businessUse", item.businessUse)) || 0) / 100, 0,
      ),
    };
  };

  function subscriptionSummary() {
    const subscriptions = state.fixedCosts.filter((item) => item.isSubscription);
    const todayValue = today();
    const upcoming = subscriptions
      .filter((item) => item.nextBillingDate && item.nextBillingDate >= todayValue)
      .sort((left, right) => left.nextBillingDate.localeCompare(right.nextBillingDate));
    const next = upcoming[0] || null;
    const daysUntil = next
      ? Math.round((new Date(`${next.nextBillingDate}T00:00:00`) - new Date(`${todayValue}T00:00:00`)) / 86400000)
      : null;
    const suggested = subscriptions.filter((item) => consecutiveUnused(item.reviews));
    return {
      total: subscriptions.length,
      dueSoon: upcoming.filter((item) => {
        const days = Math.round((new Date(`${item.nextBillingDate}T00:00:00`) - new Date(`${todayValue}T00:00:00`)) / 86400000);
        return days >= 0 && days <= 3;
      }),
      next,
      daysUntil,
      suggestedCancel: suggested,
    };
  }

  const renderMetrics = () => {
    const result = calculate();
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
      const hasFloor = result.dailyFloor > 0;
      comparisonNode.textContent = !hasFloor
        ? messages.metrics.comparisonUnavailable
        : result.comparison < 0
          ? messages.metrics.ahead.replace("{amount}", money(Math.abs(result.comparison)))
          : messages.metrics.behind.replace("{amount}", money(result.comparison));
      comparisonNode.closest(".dashboard-comparison")?.classList.toggle("is-behind", hasFloor && result.comparison > 0);
      comparisonNode.closest(".dashboard-comparison")?.classList.toggle("is-ahead", hasFloor && result.comparison < 0);
    }
    const runwayNode = document.querySelector("[data-proto='metric-runway']");
    if (runwayNode) {
      if (result.savings === null || !Number.isFinite(result.savings) || result.savings <= 0) {
        runwayNode.textContent = messages.metrics.runwayUnset;
      } else if (result.noNewWorkRunway === null) {
        runwayNode.textContent = messages.metrics.runwayNeedFloor;
      } else if (result.incomeAverage === null) {
        runwayNode.textContent = messages.metrics.runwayZero.replace("{days}", String(result.noNewWorkRunway));
      } else if (result.cashNotBurning) {
        runwayNode.textContent = messages.metrics.runwayNotBurning;
      } else {
        runwayNode.textContent = messages.metrics.runwayAverage.replace("{days}", String(result.averageRunway));
      }
    }
    const averageNode = document.querySelector("[data-proto='metric-runway-average']");
    if (averageNode) {
      if (result.savings === null || !Number.isFinite(result.savings) || result.savings <= 0) {
        averageNode.textContent = "";
      } else if (result.incomeAverage === null) {
        averageNode.textContent = messages.metrics.runwayWaiting;
      } else if (result.cashNotBurning) {
        averageNode.textContent = messages.metrics.runwayZero.replace("{days}", String(result.noNewWorkRunway));
      } else {
        averageNode.textContent = `${messages.metrics.runwayZero.replace("{days}", String(result.noNewWorkRunway))} · ${messages.metrics.runwayBasedOn.replace("{months}", String(result.incomeAverage.monthCount))}`;
      }
    }
    const shareAiNode = document.querySelector("[data-share-ai]");
    if (shareAiNode) shareAiNode.textContent = money(result.aiMonthlyCosts);
    const shareDailyNode = document.querySelector("[data-share-daily]");
    if (shareDailyNode) shareDailyNode.textContent = dayMoney(result.dailyFloor);
    renderSubscriptionSummary(result.subscriptionSummary);
    renderWeeklySummary(result);
  };

  const renderSubscriptionSummary = (summary) => {
    const panel = document.querySelector("[data-subscription-summary]");
    if (!panel || !dashboardMode) return;
    const countNode = panel.querySelector("[data-subscription-count]");
    if (countNode) countNode.textContent = String(summary.total);
    const upcomingNode = panel.querySelector("[data-subscription-upcoming]");
    if (upcomingNode) {
      upcomingNode.textContent = summary.next
        ? messages.subscriptionReview.summaryNext
          .replace("{name}", summary.next.name)
          .replace("{date}", summary.next.nextBillingDate)
          .replace("{amount}", money(Number(summary.next.amount)))
        : messages.subscriptionReview.summaryNone;
    }
    const suggestedNode = panel.querySelector("[data-subscription-suggested]");
    if (suggestedNode) {
      suggestedNode.textContent = summary.suggestedCancel.length
        ? messages.subscriptionReview.summaryCancel
          .replace("{count}", String(summary.suggestedCancel.length))
        : messages.subscriptionReview.summaryNone;
      suggestedNode.classList.toggle("is-warning", summary.suggestedCancel.length > 0);
    }
  };

  const weekKey = () => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7) - 7);
    return localDate(date);
  };

  const renderWeeklySummary = (result) => {
    const wrapper = document.querySelector("[data-weekly-summary]");
    const textNode = document.querySelector("[data-weekly-text]");
    if (!wrapper || !textNode || !dashboardMode) return;
    if (localStorage.getItem(`gigledger_week_dismissed_${weekKey()}`) === "1") {
      wrapper.hidden = true;
      return;
    }
    const weekStart = new Date(`${weekKey()}T00:00:00`);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekIncome = state.income.filter((item) => {
      if (item.recognition === "sold") return false;
      const date = new Date(`${item.date}T00:00:00`);
      return date >= weekStart && date < weekEnd;
    }).reduce((sum, item) => sum + (Number(item.amount) - Number(item.platformFee)), 0);
    if (!state.income.length && !state.fixedCosts.length) {
      wrapper.hidden = true;
      return;
    }
    textNode.textContent = weekIncome > 0 && result.dailyFloor > 0
      ? messages.weeklySummary.body
        .replace("{income}", money(weekIncome))
        .replace("{days}", String(Math.floor(weekIncome / result.dailyFloor)))
        .replace("{share}", String(Math.round((result.aiMonthlyCosts / Math.max(result.monthlyFixedCosts, 1)) * 100)))
      : weekIncome > 0
        ? messages.weeklySummary.bodyNoFloor.replace("{income}", money(weekIncome))
        : messages.weeklySummary.bodyNoIncome.replace("{daily}", dayMoney(result.dailyFloor));
    wrapper.hidden = false;
  };

  const calculateShareCard = (card) => {
    const result = calculate();
    return card === "ai" ? result.aiMonthlyCosts : result.dailyFloor;
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

  const calculateProjectTotals = () => {
    const totals = { income: {}, costs: {}, unassigned: { income: 0, costs: 0 } };
    for (const item of state.income) {
      if (item.recognition === "sold") continue;
      const key = item.projects?.[0] || item.project;
      const net = (Number(item.amount) || 0) - (Number(item.platformFee) || 0);
      if (!key) {
        totals.unassigned.income += net;
        continue;
      }
      totals.income[key] = (totals.income[key] || 0) + net;
    }
    for (const item of state.expenses) {
      const key = item.projects?.[0] || item.project;
      const businessAmount = (Number(item.amount) || 0) * (Number(item.businessUse) || 0) / 100;
      if (!key) {
        totals.unassigned.costs += businessAmount;
        continue;
      }
      totals.costs[key] = (totals.costs[key] || 0) + businessAmount;
    }
    for (const item of state.fixedCosts) {
      const monthlyBusiness = (Number(versionValue(item, "amount", item.amount)) || 0)
        * (Number(cycles.find((cycle) => cycle.value === versionValue(item, "cycle", item.cycle))?.multiplier) || 0) / 12
        * (Number(versionValue(item, "businessUse", item.businessUse)) || 0) / 100;
      const allocation = versionAllocation(item).length
        ? versionAllocation(item)
        : (item.projects?.length ? [{ name: item.projects[0], percent: 100 }] : []);
      if (!allocation.length) {
        totals.unassigned.costs += monthlyBusiness;
        continue;
      }
      for (const entry of allocation) {
        if (!entry.name) continue;
        totals.costs[entry.name] = (totals.costs[entry.name] || 0) + monthlyBusiness * (Number(entry.percent) || 0) / 100;
      }
    }
    return totals;
  };

  const totalsHaveUnassigned = (totals) => Math.abs(totals.unassigned.income) > 0.005
    || Math.abs(totals.unassigned.costs) > 0.005;

  const renderProjects = () => {
    const tbody = document.querySelector("[data-proto='project-rows']");
    if (!tbody) return;
    const projectTotals = calculateProjectTotals();
    tbody.innerHTML = "";
    if (!state.projects.filter((project) => !project.archived).length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="5">${messages.projects.empty}</td>`;
      tbody.appendChild(row);
    }
    state.projects.filter((project) => !project.archived).forEach((project) => {
      const row = document.createElement("tr");
      const name = document.createElement("td"); name.textContent = project.name;
      const income = document.createElement("td"); income.textContent = money(projectTotals.income[project.name] || 0);
      const costs = document.createElement("td"); costs.textContent = money(projectTotals.costs[project.name] || 0);
      const projectIncome = projectTotals.income[project.name] || 0;
      const projectCosts = projectTotals.costs[project.name] || 0;
      const profit = document.createElement("td"); profit.textContent = money(projectIncome - projectCosts);
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
    if (totalsHaveUnassigned(projectTotals)) {
      const row = document.createElement("tr");
      row.className = "project-unassigned-row";
      const name = document.createElement("td"); name.textContent = messages.projects.unassigned;
      const income = document.createElement("td"); income.textContent = money(projectTotals.unassigned.income);
      const costs = document.createElement("td"); costs.textContent = money(projectTotals.unassigned.costs);
      const profit = document.createElement("td");
      profit.textContent = money(projectTotals.unassigned.income - projectTotals.unassigned.costs);
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
      const currentMultiplier = cycles.find((entry) => entry.value === currentCycle)?.multiplier || 0;
      cost.textContent = dayMoney(currentAmount * currentMultiplier * currentBusinessUse / 100 / 365);
      const project = projectCell(item);
      const actions = document.createElement("td");
      if (isSubscription) {
        const review = document.createElement("div");
        review.className = "subscription-review";
        const answers = ["often", "sometimes", "not_used"];
        const currentAnswer = item.reviews?.find((reviewItem) => reviewItem.period === monthKey())?.answer;
        const suggestedCancel = consecutiveUnused(item.reviews);
        if (suggestedCancel) {
          const badge = document.createElement("span");
          badge.className = "cancel-badge";
          badge.textContent = messages.subscriptionReview.suggestedCancel;
          review.append(badge);
        } else if (item.nextBillingDate) {
          const todayDate = new Date(`${today()}T00:00:00`);
          const billingDate = new Date(`${item.nextBillingDate}T00:00:00`);
          const daysUntil = Math.round((billingDate - todayDate) / 86400000);
          if (daysUntil >= 0 && daysUntil <= 3) {
            const reminder = document.createElement("span");
            reminder.className = "review-hint";
            reminder.textContent = messages.subscriptionReview.upcoming
              .replace("{date}", item.nextBillingDate)
              .replace("{amount}", money(currentAmount));
            review.append(reminder);
          }
        }
        const answerGroup = document.createElement("div");
        answerGroup.className = "review-actions";
        answers.forEach((value) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "review-button" + (currentAnswer === value ? " active" : "");
          const label = value === "not_used" ? messages.subscriptionReview.notUsed : messages.subscriptionReview[value];
          const labelNode = document.createElement("span");
          labelNode.textContent = label;
          button.setAttribute("data-review-answer", value);
          button.setAttribute("data-entry-id", item.id);
          button.append(labelNode);
          answerGroup.append(button);
        });
        review.append(answerGroup);
        const hint = document.createElement("small");
        hint.textContent = messages.subscriptionReview.reviewHint;
        review.append(hint);
        actions.append(review);
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
    state.income.forEach((item) => {
      const row = document.createElement("tr");
      const net = (Number(item.amount) || 0) - (Number(item.platformFee) || 0);
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
      row.append(dateCell, source, recognition, project, amount, fee, netCell, deleteButton("income", item.id));
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
    state.expenses.forEach((item) => {
      const row = document.createElement("tr");
      const businessAmount = (Number(item.amount) || 0) * (Number(item.businessUse) || 0) / 100;
      const dateCell = document.createElement("td"); dateCell.textContent = item.date;
      const category = document.createElement("td"); category.textContent = item.category;
      const merchant = document.createElement("td"); merchant.textContent = item.merchant || "";
      const amount = document.createElement("td"); amount.textContent = money(Number(item.amount));
      const use = document.createElement("td"); use.textContent = `${Number(item.businessUse)}%`;
      const business = document.createElement("td"); business.textContent = money(businessAmount);
      const project = projectCell(item);
      row.append(dateCell, category, merchant, project, amount, use, business, deleteButton("expense", item.id));
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
      projectNames().forEach((name) => {
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

  const fixedForm = document.querySelector("[data-proto-form='fixed']");
  if (fixedForm) {
    const revisionDate = fixedForm.querySelector("[data-revision-date]");
    const revisionMessage = fixedForm.querySelector("[data-fixed-edit-message]");
    const submitButton = fixedForm.querySelector("[data-fixed-submit]");
    const cancelButton = fixedForm.querySelector("[data-fixed-cancel]");
    const setRevisionMode = (item = null) => {
      editingFixedCostId = item?.id || null;
      revisionDate.hidden = !item;
      cancelButton.hidden = !item;
      submitButton.textContent = item ? messages.fixedRevision.save : messages.fixed.add;
      revisionMessage.hidden = true;
      if (item) {
        fixedForm.elements.name.value = item.name;
        fixedForm.elements.amount.value = String(versionValue(item, "amount", item.amount));
        fixedForm.elements.cycle.value = versionValue(item, "cycle", item.cycle);
        fixedForm.elements.businessUse.value = String(versionValue(item, "businessUse", item.businessUse));
        fixedForm.elements.startDate.value = item.startDate || today();
        fixedForm.elements.endDate.value = item.endDate || "";
        fixedForm.elements.nextBillingDate.value = item.nextBillingDate || "";
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
      fixedForm.scrollIntoView({ behavior: "smooth", block: "start" });
    };
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
              nextBillingDate: String(data.get("nextBillingDate") || "") || null,
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
                nextBillingDate: String(data.get("nextBillingDate") || "") || null,
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
      state.fixedCosts.push({
        name: String(data.get("name") || ""),
        cycle: selected?.value || "monthly",
        multiplier: selected?.multiplier || 12,
        amount: Number(data.get("amount")) || 0,
        businessUse: Number(data.get("businessUse")) || 0,
        startDate,
        endDate: String(data.get("endDate") || "") || null,
        isSubscription: data.get("isSubscription") === "on",
        isSoftware: data.get("isSoftware") === "on",
        productUrl: String(data.get("productUrl") || "") || null,
        manageUrl: String(data.get("manageUrl") || "") || null,
        nextBillingDate: String(data.get("nextBillingDate") || "") || null,
        projects: allocation.map((entry) => entry.name),
        allocation,
      });
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
      if (item) setRevisionMode(item);
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
      const amount = Math.max(0, Number(amountInput.value) || 0);
      const percent = Math.min(100, Math.max(0, Number(percentInput.value) || 0));
      feeInput.value = (Math.round(amount * percent) / 100).toFixed(2);
      syncingFee = false;
    };
    const percentFromFee = () => {
      if (syncingFee) return;
      syncingFee = true;
      const amount = Math.max(0, Number(amountInput.value) || 0);
      const fee = Math.min(amount, Math.max(0, Number(feeInput.value) || 0));
      feeInput.value = fee.toFixed(2);
      percentInput.value = amount > 0 ? (Math.round(fee / amount * 10000) / 100).toFixed(2) : "0.00";
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
    incomeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(incomeForm);
      const source = String(data.get("source") || "");
      const amount = Number(data.get("amount")) || 0;
      const suppliedFee = Number(data.get("platformFee")) || 0;
      const recognition = source === "app_store" && data.get("recognition") === "sold" ? "sold" : "received";
      state.income.push({
        date: String(data.get("date") || today()),
        source,
        client: String(data.get("client") || ""),
        amount,
        platformFee: suppliedFee,
        recognition,
        projects: [String(data.get("project") || "").trim()].filter(Boolean),
      });
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
  if (expenseForm) {
    expenseForm.addEventListener("submit", (event) => {
      event.preventDefault();
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
      state.expenses.push({
        date: expenseDate,
        category: String(data.get("category") || ""),
        merchant: String(data.get("merchant") || ""),
        amount,
        businessUse: Number(data.get("businessUse")) || 100,
        notes: String(data.get("notes") || ""),
        projects: [String(data.get("project") || "").trim()].filter(Boolean),
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
          projects: state.projects.filter((project) => !project.archived),
          fixedCosts: state.fixedCosts.map(({ versions, reviews, id, ...item }) => item),
          income: state.income,
          expenses: state.expenses,
          taxReserveRate: state.taxReserveRate,
          appleFeeRate: state.appleFeeRate,
          cashOnHand: state.cashOnHand,
          locale,
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
      showMessage(code === "subscription_limit"
        ? messages.plan.limitReached.replace("{limit}", limit || "5")
        : messages.saveFailed);
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

  const renderPlanLimits = () => {
    const csvNodes = [...document.querySelectorAll("[data-csv-pro]")];
    csvNodes.forEach((node) => {
      node.classList.toggle("is-pro-locked", !state.features.csv);
      node.setAttribute("aria-disabled", state.features.csv ? "false" : "true");
      node.title = state.features.csv ? "" : messages.plan.proRequiredCsv;
    });
    const reviewPanel = document.querySelector("[data-subscription-summary]");
    const reviewLocked = !state.features.subscriptionReview;
    reviewPanel?.classList.toggle("is-pro-locked", reviewLocked);
    document.querySelectorAll("[data-review-answer]").forEach((button) => {
      button.disabled = reviewLocked;
      if (reviewLocked) button.title = messages.plan.proRequiredReview;
      else button.removeAttribute("title");
    });
    if (reviewPanel && reviewLocked) {
      const upcoming = reviewPanel.querySelector("[data-subscription-upcoming]");
      const suggested = reviewPanel.querySelector("[data-subscription-suggested]");
      if (upcoming) upcoming.textContent = messages.plan.proRequiredReview;
      if (suggested) suggested.textContent = messages.plan.proRequiredReview;
    }
  };

  const csvMessage = (node, message, isError = false) => {
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    node.classList.toggle("is-error", isError);
  };
  const csvFailedCsv = (rows) => {
    const headers = ["line_number", "reason", "date", "source", "amount", "platform_fee", "client", "project", "external_ref", "notes"];
    const escape = (value) => {
      const raw = value === null || value === undefined ? "" : String(value);
      return /[",\n\r]/.test(raw) ? `"${raw.replaceAll("\"", "\"\"")}"` : raw;
    };
    const line = (row) => headers.map((header) => {
      if (header === "project") return escape(row.projects?.[0] || row.project || "");
      return escape(row[header]);
    }).join(",");
    return [headers.join(","), ...rows.map(line)].join("\n");
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
      csvMessage(status, messages.csv.result.replaceAll("{imported}", String(data.imported || 0)).replaceAll("{failed}", String(data.failed || 0)));
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
        settingsForm.elements.cashOnHand.value = state.cashOnHand;
        settingsForm.elements.appleFeeRate.value = state.appleFeeRate;
      }
      refreshTaxInputs();
      render();
    } catch {
      button.disabled = false;
      window.alert(data?.error === "pro_required" ? messages.plan.proRequiredReview : messages.deleteEntryFailed);
    }
  });
  const settingsForm = document.querySelector('[data-proto-form="settings"]');
  settingsForm?.addEventListener("input", () => {
    state.taxReserveRate = String(settingsForm.elements.taxReserveRate.value || "");
    state.appleFeeRate = String(settingsForm.elements.appleFeeRate.value || "");
    state.cashOnHand = String(settingsForm.elements.cashOnHand.value || "");
    renderMetrics();
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
        settingsForm.elements.cashOnHand.value = state.cashOnHand;
        settingsForm.elements.appleFeeRate.value = state.appleFeeRate;
      }
      refreshAppleFeeInput();
      refreshTaxInputs();
      render();
      loadIntegrations();
    } catch {
      window.location.assign(`/${locale}/app`);
    }
  };

  const integrationNodes = () => ({
    panel: document.querySelector("[data-integration-panel]"),
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
      form: document.querySelector("[data-app-store-form]"),
      message: document.querySelector("[data-app-store-message]"),
      statusLabel: document.querySelector("[data-app-store-status-label]"),
      syncLabel: document.querySelector("[data-app-store-sync-label]"),
      sync: document.querySelector("[data-app-store-sync]"),
      disconnect: document.querySelector("[data-app-store-disconnect]"),
      pending: document.querySelector("[data-app-store-pending]"),
    },
  });
  let stripeIntegration = null;
  let appStoreIntegration = null;

  const renderIntegration = () => {
    const nodes = integrationNodes();
    if (!nodes.panel) return;
    if (nodes.badge) nodes.badge.textContent = state.features.plan === "pro" ? messages.plan.pro : messages.plan.free;
    const upgradeNote = document.querySelector("[data-plan-upgrade]");
    if (upgradeNote) upgradeNote.hidden = state.features.plan === "pro";
    const stripeConnected = stripeIntegration?.status === "connected";
    const stripeNodes = nodes.stripe;
    if (stripeNodes.statusLabel) stripeNodes.statusLabel.textContent = stripeConnected ? messages.integrations.connected : messages.integrations.notConnected;
    if (stripeNodes.syncLabel) {
      stripeNodes.syncLabel.textContent = !stripeConnected
        ? messages.integrations.neverSynced
        : stripeIntegration.lastSyncAt
          ? messages.integrations.lastSync.replace("{date}", stripeIntegration.lastSyncAt.slice(0, 10))
          : messages.integrations.neverSynced;
    }
    if (stripeNodes.sync) stripeNodes.sync.disabled = !stripeConnected || !state.features.sync;
    if (stripeNodes.disconnect) stripeNodes.disconnect.disabled = !stripeConnected;
    const formInputs = stripeNodes.form ? [...stripeNodes.form.elements] : [];
    formInputs.forEach((node) => { node.disabled = !state.features.sync; });

    const appStoreConnected = ["connected", "pending"].includes(appStoreIntegration?.status);
    const appStoreNodes = nodes.appStore;
    if (appStoreNodes.statusLabel) appStoreNodes.statusLabel.textContent = appStoreConnected ? messages.integrations.appStoreStored : messages.integrations.notConnected;
    if (appStoreNodes.syncLabel) {
      appStoreNodes.syncLabel.textContent = !appStoreConnected
        ? messages.integrations.neverSynced
        : appStoreIntegration.lastSyncAt
          ? messages.integrations.lastSync.replace("{date}", appStoreIntegration.lastSyncAt.slice(0, 10))
          : messages.integrations.neverSynced;
    }
    if (appStoreNodes.pending) appStoreNodes.pending.hidden = !appStoreConnected;
    if (appStoreNodes.sync) appStoreNodes.sync.disabled = !appStoreConnected || !state.features.appStoreSync;
    if (appStoreNodes.disconnect) appStoreNodes.disconnect.disabled = !appStoreConnected;
    const appStoreFormInputs = appStoreNodes.form ? [...appStoreNodes.form.elements] : [];
    appStoreFormInputs.forEach((node) => { node.disabled = !state.features.appStoreSync; });
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
      renderIntegration();
      if (stripeIntegration?.lastError) showIntegrationMessage(messages.integrations.syncFailed.replace("{error}", stripeIntegration.lastError), true);
      if (appStoreIntegration?.lastError) showIntegrationMessage(messages.integrations.appStoreSyncUnavailable, true, "appStore");
    } catch {
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

  document.querySelector("[data-app-store-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const issuerId = String(data.get("issuerId") || "").trim();
    const keyId = String(data.get("keyId") || "").trim();
    const privateKey = String(data.get("privateKey") || "").trim();
    if (!issuerId || !keyId || !privateKey.includes("BEGIN PRIVATE KEY")) {
      showIntegrationMessage(messages.integrations.invalidAppStore, true, "appStore");
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
        body: JSON.stringify({ type: "app_store", issuerId, keyId, privateKey }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 403 && result.error === "pro_required") {
        showIntegrationMessage(messages.integrations.appStoreProRequired, true, "appStore");
        return;
      }
      if (!response.ok) {
        const invalid = ["invalid_app_store_credentials", "invalid_app_store_private_key"].includes(result.error);
        showIntegrationMessage(invalid
          ? messages.integrations.invalidAppStore
          : messages.integrations.appStoreConnectFailed, true, "appStore");
        return;
      }
      form.reset();
      appStoreIntegration = { type: "app_store", status: "pending", lastSyncAt: null, lastError: null };
      renderIntegration();
      showIntegrationMessage(result.pending
        ? messages.integrations.appStoreConnected
        : messages.integrations.appStoreSaved, false, "appStore");
    } catch {
      showIntegrationMessage(messages.integrations.appStoreConnectFailed, true, "appStore");
    } finally {
      button.disabled = false;
      button.textContent = original;
      renderIntegration();
    }
  });

  document.querySelector("[data-app-store-sync]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = messages.integrations.syncing;
    try {
      const response = await fetch("/api/workspace/integrations/sync?type=app_store", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showIntegrationMessage(
          data.error === "app_store_report_sync_not_configured"
            ? messages.integrations.appStoreSyncUnavailable
            : data.error === "pro_required"
              ? messages.integrations.appStoreProRequired
              : messages.integrations.appStoreSyncUnavailable,
          true,
          "appStore",
        );
        return;
      }
      showIntegrationMessage(messages.integrations.appStoreSyncUnavailable, false, "appStore");
    } catch {
      showIntegrationMessage(messages.integrations.appStoreSyncUnavailable, true, "appStore");
    } finally {
      button.textContent = original;
      renderIntegration();
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
      businessUse: Number(item.businessUse) || 100,
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
        isSoftware: true,
        templateKey: key,
        productUrl: template?.productUrl || null,
        manageUrl: template?.manageUrl || null,
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
      settingsForm.elements.cashOnHand.value = state.cashOnHand;
      settingsForm.elements.appleFeeRate.value = state.appleFeeRate;
    }
    refreshTaxInputs();
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
  ["[data-flow-income]", "[data-flow-cash]", "[data-flow-tax]"].forEach((selector) => {
    document.querySelector(selector)?.addEventListener("input", renderFlowResults);
  });
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
        currentSettings.elements.cashOnHand.value = state.cashOnHand;
        currentSettings.elements.appleFeeRate.value = state.appleFeeRate;
      }
      refreshTaxInputs();
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
