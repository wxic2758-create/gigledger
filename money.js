// Amounts are USD cents. Keep fractional cents as reduced ratios until a report boundary.
export const zero = { numerator: 0n, denominator: 1n };

function ratio(numerator, denominator) {
  if (numerator === 0n) return zero;
  let a = numerator < 0n ? -numerator : numerator;
  let b = denominator;
  while (b) [a, b] = [b, a % b];
  return { numerator: numerator / a, denominator: denominator / a };
}

export function decimal(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const match = String(value).trim().match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match || !(match[2] || match[3])) return null;
  const fraction = match[3] || "";
  const shift = Number(match[4] || 0) - fraction.length;
  if (Math.abs(shift) > 100 || match[2].length + fraction.length > 100) return null;
  const digits = BigInt(`${match[1]}${match[2]}${fraction}`);
  return shift >= 0 ? ratio(digits * 10n ** BigInt(shift), 1n) : ratio(digits, 10n ** BigInt(-shift));
}

export const exact = (cents) => ratio(cents, 1n);

export function add(a, b) {
  return ratio(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
}

export const scale = (value, numerator, denominator = 1n) =>
  ratio(value.numerator * numerator, value.denominator * denominator);

export function percent(value, rate) {
  const parsed = decimal(rate) || zero;
  return scale(value, parsed.numerator, parsed.denominator * 100n);
}

export function roundCents({ numerator, denominator }) {
  const magnitude = numerator < 0n ? -numerator : numerator;
  const rounded = (magnitude * 2n + denominator) / (denominator * 2n);
  return numerator < 0n ? -rounded : rounded;
}

export function minorUnits(value) {
  const parsed = decimal(value);
  if (!parsed) return null;
  const cents = roundCents(scale(parsed, 100n));
  const number = Number(cents);
  return Number.isSafeInteger(number) ? number : null;
}

export function storedUnits(usd, cents) {
  // Old deployments can still write the dollar column during a rollout.
  return Number.isSafeInteger(cents) && cents / 100 === usd ? cents : minorUnits(usd);
}

export const usd = (cents) => Number(cents) / 100;

export const usdValue = (value) => {
  const units = minorUnits(value);
  return units === null ? null : usd(units);
};

export function daysCovered(cash, daily) {
  return daily.numerator > 0n && cash !== null
    ? Number(cash * daily.denominator / daily.numerator)
    : null;
}
