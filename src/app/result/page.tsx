'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { generateShareCard, downloadCard } from '@/lib/card-generator'
import { formatMoney } from '@/lib/calculator'
import { getPlatformById } from '@/lib/platforms'
import Link from 'next/link'

function ResultContent() {
  const params = useSearchParams()
  const router = useRouter()
  const [cardDataUrl, setCardDataUrl] = useState<string | null>(null)

  const platformName = params.get('platformName') || 'Gig'
  const platformIcon = params.get('platformIcon') || '💼'
  const platformId = params.get('platform') || 'other'
  const gross = parseFloat(params.get('gross') || '0')
  const hours = parseFloat(params.get('hours') || '0')
  const miles = parseFloat(params.get('miles') || '0')
  const net = parseFloat(params.get('net') || '0')
  const hourly = parseFloat(params.get('hourly') || '0')
  const compare = parseFloat(params.get('compare') || '50')

  useEffect(() => {
    const platform = getPlatformById(platformId)
    const url = generateShareCard({
      platform: { id: platformId, name: platformName, icon: platformIcon, color: platform.color },
      grossEarnings: gross,
      netIncome: net,
      hourlyRate: hourly,
      hoursWorked: hours,
      milesDriven: miles,
      comparisonPercent: compare,
    })
    setCardDataUrl(url)
  }, [])

  function handleDownload() {
    if (!cardDataUrl) return
    const platform = platformName.toLowerCase().replace(/\s+/g, '-')
    downloadCard(cardDataUrl, `gigledger-${platform}-${Date.now()}.png`)
  }

  function handleWhatsApp() {
    const text = encodeURIComponent(`💰 My GigLedger result: Net income $${net.toFixed(2)}, hourly rate $${hourly.toFixed(2)}! Check yours at gigledger.xyz`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  function handleTwitter() {
    const text = encodeURIComponent(`💰 Just checked my real gig earnings with @GigLedger: $${net.toFixed(2)} net, $${hourly.toFixed(2)}/hr! How do you compare? gigledger.xyz`)
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
  }

  function handleCopyImage() {
    if (!cardDataUrl) return
    fetch(cardDataUrl)
      .then(r => r.blob())
      .then(blob => {
        navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ])
      })
      .catch(() => {
        // Fallback: download
        handleDownload()
      })
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">✨ Your Share Card is Ready!</h1>
          <p className="text-slate-500 text-sm">Download or share it with your gig worker friends</p>
        </div>

        {/* Card preview */}
        <div className="card overflow-hidden mb-6">
          {cardDataUrl ? (
            <img
              src={cardDataUrl}
              alt="Share card"
              className="w-full aspect-square object-cover"
            />
          ) : (
            <div className="w-full aspect-square bg-slate-900 flex items-center justify-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-3 text-center">
            <p className="text-slate-400 text-xs">Net Income</p>
            <p className="font-mono font-bold text-emerald-600">{formatMoney(net)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-slate-400 text-xs">Hourly Rate</p>
            <p className="font-mono font-bold text-slate-800">{formatMoney(hourly)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-slate-400 text-xs">Better Than</p>
            <p className="font-mono font-bold text-blue-600">{compare}%</p>
          </div>
        </div>

        {/* Share buttons */}
        <div className="space-y-3">
          <button onClick={handleDownload} className="btn-primary w-full !py-4 text-lg">
            ⬇️ Download Image
          </button>
          <div className="grid grid-cols-3 gap-3">
            <button onClick={handleWhatsApp} className="btn-secondary !py-3 text-sm">
              📱 WhatsApp
            </button>
            <button onClick={handleTwitter} className="btn-secondary !py-3 text-sm">
              🐦 Twitter
            </button>
            <button onClick={handleCopyImage} className="btn-secondary !py-3 text-sm">
              📋 Copy Image
            </button>
          </div>
          <div className="flex gap-3">
            <Link href="/analyze" className="btn-secondary flex-1 text-center">
              🔄 Calculate Again
            </Link>
            <Link href="/tracker" className="btn-secondary flex-1 text-center">
              📊 Weekly Tracker
            </Link>
          </div>
        </div>

        {/* Tip */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <p className="text-yellow-800 text-sm">
            💡 <strong>Tip:</strong> Share this card in your Uber/DoorDash driver groups!
            More drivers should know their real earnings.
          </p>
        </div>
      </div>
    </main>
  )
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div>}>
      <ResultContent />
    </Suspense>
  )
}
