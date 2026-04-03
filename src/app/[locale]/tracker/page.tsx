'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { getEntries, deleteEntry, clearAllEntries, getWeeklyTotals, type TrackerEntry } from '@/lib/storage'
import { formatMoney } from '@/lib/calculator'
import { platforms } from '@/lib/platforms'
import Link from 'next/link'

export default function TrackerPage() {
  const t = useTranslations('tracker')
  const [entries, setEntries] = useState<TrackerEntry[]>([])
  const [totals, setTotals] = useState({ gross: 0, net: 0, hours: 0, avgHourly: 0, count: 0 })
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  function load() {
    setEntries(getEntries())
    setTotals(getWeeklyTotals())
  }

  useEffect(() => { load() }, [])

  function handleDelete(id: string) {
    deleteEntry(id)
    load()
  }

  function handleClearAll() {
    clearAllEntries()
    setShowClearConfirm(false)
    load()
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('title')}</h1>
            <p className="text-slate-500 text-sm">{t('titleDesc')}</p>
          </div>
          <Link href="/analyze" className="btn-primary !py-2 !px-4 text-sm">
            {t('addEntry')}
          </Link>
        </div>

        {/* Weekly summary */}
        <div className="card p-6 mb-6 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
          <h2 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">{t('weekSummary')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-slate-400 text-xs mb-1">{t('gross')}</p>
              <p className="font-mono font-bold text-xl">{formatMoney(totals.gross)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-1">{t('net')}</p>
              <p className="font-mono font-bold text-xl text-emerald-400">{formatMoney(totals.net)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-1">{t('hours')}</p>
              <p className="font-mono font-bold text-xl">{totals.hours.toFixed(1)}h</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-1">{t('avgHourly')}</p>
              <p className="font-mono font-bold text-xl text-yellow-400">{formatMoney(totals.avgHourly)}</p>
            </div>
          </div>
          <p className="text-slate-500 text-xs mt-4">{totals.count} {t('entriesThisWeek')}</p>
        </div>

        {entries.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-bold text-slate-700 mb-2">{t('noEntries')}</h3>
            <p className="text-slate-500 text-sm mb-4">{t('noEntriesDesc')}</p>
            <Link href="/analyze" className="btn-primary !py-2 !px-6 text-sm">{t('startCalculating')}</Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-slate-600">{entries.length} {t('totalEntries')}</p>
              <button onClick={() => setShowClearConfirm(true)} className="text-red-500 text-sm hover:underline">
                {t('clearAll')}
              </button>
            </div>

            {entries.map(entry => (
              <div key={entry.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-lg">
                      {platforms.find(p => p.id === entry.platform)?.icon || '💼'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{entry.platformName}</p>
                      <p className="text-slate-400 text-xs">{entry.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-bold ${entry.netIncome >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatMoney(entry.netIncome)}
                    </p>
                    <p className="text-slate-400 text-xs">{formatMoney(entry.hourlyRate)}/hr</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span>🕐 {entry.hoursWorked}h</span>
                  <span>🚗 {entry.milesDriven}mi</span>
                  <span>💰 Gross {formatMoney(entry.grossEarnings)}</span>
                </div>
                <button onClick={() => handleDelete(entry.id)} className="mt-2 text-red-400 text-xs hover:text-red-600">
                  {t('delete')}
                </button>
              </div>
            ))}
          </div>
        )}

        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <h3 className="font-bold text-slate-800 mb-2">{t('confirmClear')}</h3>
              <p className="text-slate-500 text-sm mb-4">{t('confirmClearDesc', { count: entries.length })}</p>
              <div className="flex gap-3">
                <button onClick={() => setShowClearConfirm(false)} className="btn-secondary flex-1">{t('cancel')}</button>
                <button onClick={handleClearAll} className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-xl flex-1">{t('deleteAll')}</button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-slate-400 text-xs">{t('privacyNote')}</p>
        </div>
      </div>
    </main>
  )
}
