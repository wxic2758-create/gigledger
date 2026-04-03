'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { platforms, getPlatformById } from '@/lib/platforms'
import { calculate, formatMoney, IRS_MILEAGE_RATE_2026 } from '@/lib/calculator'
import { addEntry } from '@/lib/storage'

export default function AnalyzePage() {
  const t = useTranslations('analyze')
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'upload' | 'calculate' | 'result'>('upload')
  const [selectedPlatform, setSelectedPlatform] = useState('uber')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [grossEarnings, setGrossEarnings] = useState('')
  const [hoursWorked, setHoursWorked] = useState('')
  const [milesDriven, setMilesDriven] = useState('')
  const [costPerMile, setCostPerMile] = useState(IRS_MILEAGE_RATE_2026.toString())
  const [tips, setTips] = useState('')
  const [bonuses, setBonuses] = useState('')
  const [result, setResult] = useState<ReturnType<typeof calculate> | null>(null)

  function handleFileSelect(file: File) {
    setPreviewUrl(URL.createObjectURL(file))
    setStep('calculate')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleFileSelect(file)
  }

  function handleCalculate() {
    if (!grossEarnings || !hoursWorked || !milesDriven) return
    const gross = parseFloat(grossEarnings)
    const tipsVal = parseFloat(tips) || 0
    const bonusesVal = parseFloat(bonuses) || 0
    const totalGross = gross + tipsVal + bonusesVal
    const calcResult = calculate({
      grossEarnings: totalGross,
      hoursWorked: parseFloat(hoursWorked),
      milesDriven: parseFloat(milesDriven),
      costPerMile: parseFloat(costPerMile) || IRS_MILEAGE_RATE_2026,
    })
    setResult(calcResult)
    const platform = getPlatformById(selectedPlatform)
    addEntry({
      date: new Date().toISOString().split('T')[0],
      platform: selectedPlatform,
      platformName: platform.name,
      grossEarnings: totalGross,
      hoursWorked: parseFloat(hoursWorked),
      milesDriven: parseFloat(milesDriven),
      netIncome: calcResult.netIncome,
      hourlyRate: calcResult.hourlyRate,
      costPerMile: calcResult.costPerMile,
      comparisonPercent: calcResult.comparisonPercent,
    })
    setStep('result')
  }

  function handleViewCard() {
    if (!result) return
    const platform = getPlatformById(selectedPlatform)
    const params = new URLSearchParams({
      platform: selectedPlatform,
      gross: grossEarnings,
      hours: hoursWorked,
      miles: milesDriven,
      cpm: costPerMile,
      tips,
      bonuses,
      net: result.netIncome.toString(),
      hourly: result.hourlyRate.toString(),
      compare: result.comparisonPercent.toString(),
      platformName: platform.name,
      platformIcon: platform.icon,
    })
    router.push(`/result?${params.toString()}`)
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {['Upload', 'Calculate', 'Result'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                i === 0 ? 'bg-blue-600 text-white' :
                i === 1 ? (step === 'calculate' || step === 'result' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500') :
                (step === 'result' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500')
              }`}>
                {i + 1}
              </div>
              <span className={`text-xs font-medium ${i <= (step === 'upload' ? 0 : step === 'calculate' ? 1 : 2) ? 'text-slate-800' : 'text-slate-400'}`}>
                {label}
              </span>
              {i < 2 && <div className="w-8 h-px bg-slate-200" />}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-slate-800 mb-2">{t('uploadTitle')}</h1>
              <p className="text-slate-500 text-sm">{t('uploadDesc')}</p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {platforms.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id)}
                  className={`platform-btn ${selectedPlatform === p.id ? 'active' : ''}`}
                >
                  <span className="text-xl">{p.icon}</span>
                  {p.name}
                </button>
              ))}
            </div>

            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
              />
              <div className="text-4xl mb-3">📸</div>
              <p className="font-semibold text-slate-700 mb-1">Tap to upload or drag a screenshot</p>
              <p className="text-slate-400 text-sm">PNG, JPG, HEIC supported</p>
            </div>

            <div className="text-center">
              <button onClick={() => setStep('calculate')} className="text-blue-600 font-medium text-sm hover:underline">
                {t('skipManual')}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Calculate */}
        {step === 'calculate' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-slate-800 mb-2">{t('calculateTitle')}</h1>
              <p className="text-slate-500 text-sm">{t('calculateDesc')}</p>
            </div>

            {previewUrl && (
              <div className="card p-4">
                <img src={previewUrl} alt="Screenshot" className="w-full max-h-48 object-contain rounded-lg" />
                <button onClick={() => { setPreviewUrl(null); setStep('upload') }} className="mt-2 text-blue-600 text-sm hover:underline">{t('changeScreenshot')}</button>
              </div>
            )}

            <div className="card p-6 space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {platforms.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlatform(p.id)}
                    className={`platform-btn ${selectedPlatform === p.id ? 'active' : ''}`}
                  >
                    <span className="text-xl">{p.icon}</span>
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('baseEarnings')}</label>
                  <input type="number" step="0.01" min="0" value={grossEarnings}
                    onChange={e => setGrossEarnings(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 outline-none font-mono text-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('tips')}</label>
                  <input type="number" step="0.01" min="0" value={tips}
                    onChange={e => setTips(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 outline-none font-mono text-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('bonuses')}</label>
                  <input type="number" step="0.01" min="0" value={bonuses}
                    onChange={e => setBonuses(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 outline-none font-mono text-lg" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('hoursWorked')}</label>
                  <input type="number" step="0.25" min="0" value={hoursWorked}
                    onChange={e => setHoursWorked(e.target.value)} placeholder="0.0"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 outline-none font-mono text-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('milesDriven')}</label>
                  <input type="number" step="1" min="0" value={milesDriven}
                    onChange={e => setMilesDriven(e.target.value)} placeholder="0"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 outline-none font-mono text-lg" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('costPerMile')}</label>
                <input type="number" step="0.001" min="0" value={costPerMile}
                  onChange={e => setCostPerMile(e.target.value)} placeholder="0.725"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 outline-none font-mono text-lg" />
                <p className="text-slate-400 text-xs mt-1">{t('costPerMileNote')}</p>
              </div>

              <button onClick={handleCalculate}
                disabled={!grossEarnings || !hoursWorked || !milesDriven}
                className="btn-primary w-full !py-4 text-lg">
                {t('calculateBtn')}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 'result' && result && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-slate-800 mb-2">{t('resultTitle')}</h1>
              <p className="text-slate-500 text-sm">{getPlatformById(selectedPlatform).icon} {getPlatformById(selectedPlatform).name}</p>
            </div>

            <div className="card p-8 text-center">
              <p className="text-slate-500 mb-2">{t('netIncome')}</p>
              <p className={`text-5xl font-mono font-bold mb-4 ${result.netIncome >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatMoney(result.netIncome)}
              </p>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-slate-400 text-xs mb-1">{t('hourlyRate')}</p>
                  <p className="font-mono font-bold text-lg text-emerald-600">{formatMoney(result.hourlyRate)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-slate-400 text-xs mb-1">{t('hours')}</p>
                  <p className="font-mono font-bold text-lg">{parseFloat(hoursWorked)}h</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-slate-400 text-xs mb-1">{t('miles')}</p>
                  <p className="font-mono font-bold text-lg">{parseFloat(milesDriven)}mi</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('grossEarnings')}</span>
                  <span className="font-mono font-medium">{formatMoney(result.grossEarnings)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('vehicleCost')}</span>
                  <span className="font-mono font-medium text-red-500">-{formatMoney(result.totalCost)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-semibold">
                  <span>{t('netAfterCost')}</span>
                  <span className="font-mono font-bold text-emerald-600">{formatMoney(result.netIncome)}</span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
                <p className="text-emerald-700 font-semibold">
                  🎯 Better than {result.comparisonPercent}% of gig workers
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-6">
                <p className="text-blue-700 text-sm">
                  💡 <strong>Tax Deduction:</strong> {formatMoney(result.taxDeduction)} in vehicle expenses
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button onClick={handleViewCard} className="btn-primary w-full !py-4 text-lg">{t('shareCard')}</button>
                <div className="flex gap-3">
                  <button onClick={() => { setResult(null); setStep('calculate') }} className="btn-secondary flex-1">{t('calculateAgain')}</button>
                  <a href="/tracker" className="btn-secondary flex-1 text-center">{t('viewTracker')}</a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
