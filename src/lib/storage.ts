export interface TrackerEntry {
  id: string
  date: string
  platform: string
  platformName: string
  grossEarnings: number
  hoursWorked: number
  milesDriven: number
  netIncome: number
  hourlyRate: number
  costPerMile: number
  comparisonPercent: number
  createdAt: number
}

const STORAGE_KEY = 'gigledger_entries'

export function getEntries(): TrackerEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function addEntry(entry: Omit<TrackerEntry, 'id' | 'createdAt'>): TrackerEntry {
  const entries = getEntries()
  const newEntry: TrackerEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  }
  entries.unshift(newEntry)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  return newEntry
}

export function deleteEntry(id: string): void {
  const entries = getEntries().filter(e => e.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function clearAllEntries(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function getWeeklyEntries(): TrackerEntry[] {
  const entries = getEntries()
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return entries.filter(e => e.createdAt >= weekAgo)
}

export function getWeeklyTotals() {
  const weekly = getWeeklyEntries()
  const gross = weekly.reduce((sum, e) => sum + e.grossEarnings, 0)
  const net = weekly.reduce((sum, e) => sum + e.netIncome, 0)
  const hours = weekly.reduce((sum, e) => sum + e.hoursWorked, 0)
  const avgHourly = hours > 0 ? net / hours : 0
  return { gross, net, hours, avgHourly, count: weekly.length }
}
