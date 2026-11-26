const dayMs = 86_400_000;
const daysPerCycle = { daily: 1, weekly: 7, biweekly: 14 };
const monthsPerCycle = { monthly: 1, quarterly: 3, yearly: 12 };
const isoDay = (date) => date.toISOString().slice(0, 10);
const parseDay = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || isoDay(date) !== value ? null : date;
};

export function dayInTimeZone(now, timeZone) {
  if (typeof timeZone !== "string" || !timeZone || timeZone.length > 80) return isoDay(now);
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const date = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${date.year}-${date.month}-${date.day}`;
  } catch {
    return isoDay(now);
  }
}

function shiftCharge(anchor, cycle, index) {
  const date = new Date(anchor);
  if (Object.hasOwn(daysPerCycle, cycle)) {
    date.setUTCDate(date.getUTCDate() + index * daysPerCycle[cycle]);
  } else {
    const originalDay = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + index * monthsPerCycle[cycle]);
    const monthEnd = new Date(date);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
    date.setUTCDate(Math.min(originalDay, monthEnd.getUTCDate()));
  }
  return date;
}

function chargeOnOrAfter(anchor, cycle, target) {
  if (target <= anchor) return { date: anchor, index: 0 };
  if (Object.hasOwn(daysPerCycle, cycle)) {
    const index = Math.ceil((target - anchor) / (dayMs * daysPerCycle[cycle]));
    return { date: shiftCharge(anchor, cycle, index), index };
  }
  const monthDiff = (target.getUTCFullYear() - anchor.getUTCFullYear()) * 12
    + target.getUTCMonth() - anchor.getUTCMonth();
  let index = Math.floor(monthDiff / monthsPerCycle[cycle]);
  let date = shiftCharge(anchor, cycle, index);
  if (date < target) date = shiftCharge(anchor, cycle, ++index);
  return { date, index };
}

export function subscriptionTiming(item, today) {
  const { cycle, startDate, endDate } = item;
  const anchor = parseDay(item.nextBillingDate);
  const now = parseDay(today);
  const start = parseDay(startDate);
  const end = parseDay(endDate);
  const active = now && (!start || start <= now) && (!end || now <= end);
  const empty = { date: null, daysUntil: null, reviewPeriod: null };
  if (!anchor) return { ...empty, reviewPeriod: active ? today.slice(0, 7) : null };
  if (!now || (!Object.hasOwn(daysPerCycle, cycle) && !Object.hasOwn(monthsPerCycle, cycle))) return empty;
  const target = start && start > now ? start : now;
  const { date } = chargeOnOrAfter(anchor, cycle, target);
  if (end && date > end) return empty;
  const daysUntil = (date - now) / dayMs;
  const billingDate = isoDay(date);
  return { date: billingDate, daysUntil, reviewPeriod: active && daysUntil <= 3 ? billingDate : null };
}

export function answerForPeriod(reviews, period, cycle) {
  if (!period) return null;
  return reviews.find((review) => review.period === period)?.answer
    || (cycle === "monthly" ? reviews.find((review) => review.period === period.slice(0, 7))?.answer : null)
    || null;
}

export function consecutiveUnused(item) {
  const reviews = item.reviews || [];
  const latest = reviews[0];
  if (latest?.answer !== "not_used") return false;
  const { cycle } = item;
  if (/^\d{4}-\d{2}$/.test(latest.period)) {
    const previous = parseDay(`${latest.period}-01`);
    if (!previous) return false;
    previous.setUTCMonth(previous.getUTCMonth() - 1);
    return reviews.find((review) => review.period === isoDay(previous).slice(0, 7))?.answer === "not_used";
  }
  const anchor = parseDay(item.nextBillingDate);
  const lastCharge = parseDay(latest.period);
  if (!anchor || !lastCharge || (!Object.hasOwn(daysPerCycle, cycle) && !Object.hasOwn(monthsPerCycle, cycle))) return false;
  const { date, index } = chargeOnOrAfter(anchor, cycle, lastCharge);
  if (date.getTime() !== lastCharge.getTime()) return false;
  const previous = isoDay(shiftCharge(anchor, cycle, index - 1));
  return answerForPeriod(reviews, previous, cycle) === "not_used";
}
