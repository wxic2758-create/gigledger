export interface CalculatorInput {
  grossEarnings: number
  hoursWorked: number
  milesDriven: number
  costPerMile?: number
}

export interface CalculatorResult {
  grossEarnings: number
  totalCost: number
  netIncome: number
  hourlyRate: number
  costPerMile: number
  comparisonPercent: number
  taxDeduction: number
}

// IRS Standard Mileage Rate 2026: 72.5 cents/mile (Notice 2026-10)
export const IRS_MILEAGE_RATE_2026 = 0.725

export function calculate(input: CalculatorInput): CalculatorResult {
  const costPerMile = input.costPerMile ?? IRS_MILEAGE_RATE_2026
  const totalCost = Math.round(input.milesDriven * costPerMile * 100) / 100
  const netIncome = Math.round((input.grossEarnings - totalCost) * 100) / 100
  const hourlyRate = input.hoursWorked > 0
    ? Math.round((netIncome / input.hoursWorked) * 100) / 100
    : 0

  // Simulated comparison (real implementation would use aggregated data)
  const comparisonPercent = Math.floor(Math.random() * 50) + 40 // 40-90%

  // Tax deduction based on IRS mileage rate
  const taxDeduction = totalCost

  return {
    grossEarnings: input.grossEarnings,
    totalCost,
    netIncome,
    hourlyRate,
    costPerMile,
    comparisonPercent,
    taxDeduction,
  }
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(amount: number): string {
  return `${Math.round(amount)}%`
}
