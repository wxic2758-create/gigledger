import { daysInMonth, monthOffset } from "./billing-calendar.js?v=20261126-02";
import { add, daysCovered, exact, minorUnits, percent, roundCents, scale, usd, zero } from "./money.js?v=20261126-02";

export const annualCycles = { daily: 365, weekly: 52, biweekly: 26, monthly: 12, quarterly: 4, yearly: 1 };
const cents = (value) => BigInt(minorUnits(value) ?? 0);
export const roundedUsd = (amount) => usd(roundCents(amount));
export const netCents = (item) => cents(item.amount) - cents(item.platformFee);
export const businessCents = (item) => percent(exact(cents(item.amount)), item.businessUse);
export const expenseCents = (item) => roundCents(businessCents(item));
export const annualCost = (item) => scale(businessCents(item), BigInt(annualCycles[item.cycle] || 0));

export function effectiveVersionAt(versions, day) {
  return (versions || []).reduce((latest, version) =>
    version.effectiveFrom <= day && (!latest || latest.effectiveFrom < version.effectiveFrom) ? version : latest, null);
}

function fixedSegments(item, month) {
  const days = daysInMonth(month);
  const first = `${month}-01`;
  const last = `${month}-${days}`;
  const start = item.startDate && item.startDate > first ? item.startDate : first;
  const end = item.endDate && item.endDate < last ? item.endDate : last;
  const versions = item.versions?.length ? item.versions : [item];
  return versions.flatMap((version) => {
    const from = version.effectiveFrom && version.effectiveFrom > start ? version.effectiveFrom : start;
    const to = version.effectiveTo && version.effectiveTo < end ? version.effectiveTo : end;
    if (from > to) return [];
    const activeDays = Number(to.slice(8)) - Number(from.slice(8)) + 1;
    return [{
      cost: scale(annualCost(version), BigInt(activeDays), BigInt(days * 12)),
      allocation: version.allocation || [],
    }];
  });
}

function runRate(income, currentMonth) {
  const completed = new Map();
  for (const item of income) {
    const month = item.date?.slice(0, 7);
    if (item.recognition === "sold" || !month || month >= currentMonth) continue;
    completed.set(month, (completed.get(month) || 0n) + netCents(item));
  }
  const first = [...completed.keys()].sort()[0];
  if (!first) return null;
  const months = [-3, -2, -1].map((offset) => monthOffset(currentMonth, offset)).filter((month) => month >= first);
  if (!months.length) return null;
  const net = months.reduce((total, month) => total + (completed.get(month) || 0n), 0n);
  const days = months.reduce((total, month) => total + daysInMonth(month), 0);
  return { daily: scale(exact(net), 1n, BigInt(days)), monthCount: months.length };
}

export function buildReport(ledger, today, month = today.slice(0, 7)) {
  const current = today.slice(0, 7);
  const inMonth = (item) => item.date?.slice(0, 7) === month;
  let annual = zero;
  let annualSoftware = zero;
  let fixed = zero;
  for (const item of ledger.fixedCosts) {
    if ((!item.startDate || item.startDate <= today) && (!item.endDate || item.endDate >= today)) {
      const rate = annualCost(effectiveVersionAt(item.versions, today) || item);
      annual = add(annual, rate);
      if (item.isSubscription && item.isSoftware) annualSoftware = add(annualSoftware, rate);
    }
    for (const { cost } of fixedSegments(item, month)) fixed = add(fixed, cost);
  }

  const dailyRate = scale(annual, 1n, 365n);
  const floor = roundCents(dailyRate);
  let gross = 0n;
  let fees = 0n;
  let sold = 0n;
  for (const item of ledger.income.filter(inMonth)) {
    if (item.recognition === "sold") sold += cents(item.amount);
    else {
      gross += cents(item.amount);
      fees += cents(item.platformFee);
    }
  }
  const net = gross - fees;
  const fixedTotal = roundCents(fixed);
  const expenses = ledger.expenses.filter(inMonth).reduce((total, item) => total + expenseCents(item), 0n);
  const required = floor * BigInt(today.slice(8));
  const rawSavings = minorUnits(ledger.cashOnHand);
  const cash = rawSavings === null ? null : BigInt(rawSavings);
  const incomeAverage = runRate(ledger.income, current);
  const netBurn = incomeAverage && dailyRate.numerator > 0n
    ? add(dailyRate, scale(incomeAverage.daily, -1n)) : null;
  return {
    dailyRate,
    dailyFloor: usd(floor),
    grossIncome: usd(gross),
    platformFees: usd(fees),
    netIncome: usd(net),
    monthlyFixedCosts: usd(fixedTotal),
    monthlyExpenses: usd(expenses),
    soldIncome: usd(sold),
    trueProfit: usd(net - fixedTotal - expenses),
    taxReserve: ledger.taxReserveRate === "" ? null : roundedUsd(percent(exact(net), ledger.taxReserveRate)),
    requiredToDate: usd(required),
    comparison: usd(net - required),
    savings: cash === null ? null : usd(cash),
    noNewWorkRunway: daysCovered(cash, dailyRate),
    incomeAverage,
    averageRunway: netBurn ? daysCovered(cash, netBurn) : null,
    cashNotBurning: netBurn !== null && netBurn.numerator <= 0n,
    aiMonthlyCosts: roundedUsd(scale(annualSoftware, 1n, 12n)),
  };
}

export function projectTotals(ledger, month) {
  const totals = new Map();
  const inMonth = (item) => item.date?.slice(0, 7) === month;
  const bucket = (project) => {
    const key = project || "";
    if (!totals.has(key)) totals.set(key, { income: 0n, costs: zero });
    return totals.get(key);
  };
  for (const item of ledger.income.filter(inMonth)) {
    if (item.recognition !== "sold") bucket(item.projects?.[0]).income += netCents(item);
  }
  for (const item of ledger.expenses.filter(inMonth)) {
    const entry = bucket(item.projects?.[0]);
    entry.costs = add(entry.costs, exact(expenseCents(item)));
  }
  for (const item of ledger.fixedCosts) {
    for (const { cost, allocation } of fixedSegments(item, month)) {
      const shares = allocation.length ? allocation : [{ name: "", percent: 100 }];
      for (const share of shares) {
        const entry = bucket(share.name);
        entry.costs = add(entry.costs, percent(cost, share.percent));
      }
    }
  }
  return new Map([...totals].map(([name, { income, costs }]) => {
    const cost = roundCents(costs);
    return [name, { income: usd(income), costs: usd(cost), profit: usd(income - cost) }];
  }));
}
