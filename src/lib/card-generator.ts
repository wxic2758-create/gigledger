import type { CalculatorResult } from './calculator'
import type { Platform } from './platforms'

export interface CardData {
  platform: Platform
  grossEarnings: number
  netIncome: number
  hourlyRate: number
  hoursWorked: number
  milesDriven: number
  comparisonPercent: number
}

export function generateShareCard(data: CardData): string {
  // Returns a data URL of the canvas image
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1080
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = '#0F172A'
  ctx.fillRect(0, 0, 1080, 1080)

  // Gradient overlay
  const grad = ctx.createLinearGradient(0, 0, 1080, 1080)
  grad.addColorStop(0, 'rgba(37,99,235,0.15)')
  grad.addColorStop(1, 'rgba(16,185,129,0.1)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 1080, 1080)

  // Subtle dot pattern
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  for (let x = 0; x < 1080; x += 30) {
    for (let y = 0; y < 1080; y += 30) {
      ctx.beginPath()
      ctx.arc(x, y, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Top badge
  ctx.fillStyle = 'rgba(37,99,235,0.2)'
  roundRect(ctx, 320, 60, 440, 56, 28)
  ctx.fill()
  ctx.fillStyle = '#60A5FA'
  ctx.font = '500 24px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('💰 GigLedger', 540, 96)

  // Platform icon + name
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '600 32px Inter, sans-serif'
  ctx.fillText(`${data.platform.icon} ${data.platform.name} Earnings`, 540, 180)

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(100, 210)
  ctx.lineTo(980, 210)
  ctx.stroke()

  // Comparison badge
  ctx.fillStyle = 'rgba(16,185,129,0.2)'
  roundRect(ctx, 340, 240, 400, 60, 30)
  ctx.fill()
  ctx.fillStyle = '#34D399'
  ctx.font = '600 26px Inter, sans-serif'
  ctx.fillText(`🎯 Better than ${data.comparisonPercent}% of gig workers`, 540, 280)

  // Gross earnings (small)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '400 28px Inter, sans-serif'
  ctx.fillText('Gross Earnings', 540, 370)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '500 32px "Courier New", monospace'
  ctx.fillText(`$${data.grossEarnings.toFixed(2)}`, 540, 410)

  // Cost deduction
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '400 24px Inter, sans-serif'
  ctx.fillText(`- $${(data.netIncome < 0 ? data.grossEarnings : (data.grossEarnings - data.netIncome)).toFixed(2)} vehicle costs`, 540, 450)

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.beginPath()
  ctx.moveTo(100, 480)
  ctx.lineTo(980, 480)
  ctx.stroke()

  // NET INCOME label
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '600 28px Inter, sans-serif'
  ctx.fillText('NET INCOME', 540, 540)

  // Net income big number
  ctx.fillStyle = '#10B981'
  ctx.font = '800 120px "Courier New", monospace'
  ctx.fillText(`$${data.netIncome.toFixed(2)}`, 540, 680)

  // Stats row
  const statsY = 760
  const statWidth = 260

  // Hourly rate
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '400 22px Inter, sans-serif'
  ctx.fillText('Hourly Rate', 540 - statWidth, statsY)
  ctx.fillStyle = '#FBBF24'
  ctx.font = '700 36px "Courier New", monospace'
  ctx.fillText(`$${data.hourlyRate.toFixed(2)}`, 540 - statWidth, statsY + 45)

  // Hours
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '400 22px Inter, sans-serif'
  ctx.fillText('Hours', 540, statsY)
  ctx.fillStyle = 'white'
  ctx.font = '700 36px "Courier New", monospace'
  ctx.fillText(`${data.hoursWorked}h`, 540, statsY + 45)

  // Miles
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '400 22px Inter, sans-serif'
  ctx.fillText('Miles', 540 + statWidth, statsY)
  ctx.fillStyle = 'white'
  ctx.font = '700 36px "Courier New", monospace'
  ctx.fillText(`${data.milesDriven}mi`, 540 + statWidth, statsY + 45)

  // Bottom brand
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = '500 24px Inter, sans-serif'
  ctx.fillText('gigledger.xyz', 540, 960)
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.font = '400 20px Inter, sans-serif'
  ctx.fillText('Know your real earnings', 540, 995)

  // Corner decorations
  ctx.strokeStyle = 'rgba(37,99,235,0.4)'
  ctx.lineWidth = 3
  // Top left
  ctx.beginPath()
  ctx.moveTo(30, 80); ctx.lineTo(30, 30); ctx.lineTo(80, 30)
  ctx.stroke()
  // Top right
  ctx.beginPath()
  ctx.moveTo(1050, 80); ctx.lineTo(1050, 30); ctx.lineTo(1000, 30)
  ctx.stroke()
  // Bottom left
  ctx.beginPath()
  ctx.moveTo(30, 1000); ctx.lineTo(30, 1050); ctx.lineTo(80, 1050)
  ctx.stroke()
  // Bottom right
  ctx.beginPath()
  ctx.moveTo(1050, 1000); ctx.lineTo(1050, 1050); ctx.lineTo(1000, 1050)
  ctx.stroke()

  return canvas.toDataURL('image/png', 1.0)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function downloadCard(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
