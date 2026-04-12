import React, { useMemo, useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Car, DollarSign, Gauge, Upload, Receipt, ArrowRight, Info, Sparkles, History, Trash2 } from "lucide-react"

const COST_PRESETS = {
  low: { label: "Low", rate: 0.45 },
  medium: { label: "Medium", rate: 0.65 },
  high: { label: "High", rate: 0.85 },
}

interface SavedResult {
  id: string
  date: string
  gross: number
  hours: number
  miles: number
  extraCosts: number
  preset: string
  net: number
  hourly: number
  costRatio: number
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function formatHour(value: number) {
  return `${value.toFixed(1)}/hr`
}

function scoreShift(hourly: number) {
  if (hourly >= 22) {
    return { label: "Strong shift", tone: "good", note: "Your real hourly pay stayed in a healthy range." }
  }
  if (hourly >= 15) {
    return { label: "Average shift", tone: "mid", note: "Usable, but costs took a noticeable bite." }
  }
  return { label: "Low-margin shift", tone: "bad", note: "Costs likely made this shift less worthwhile than it looked." }
}

function MetricCard({ title, value, icon: Icon, subtext }: { title: string; value: string; icon: React.ElementType; subtext?: string }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            {subtext ? <p className="mt-1 text-sm text-slate-500">{subtext}</p> : null}
          </div>
          <div className="rounded-2xl bg-slate-100 p-3">
            <Icon className="h-5 w-5 text-slate-700" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const MAX_HISTORY = 5

export default function GigLedgerMVP() {
  const [gross, setGross] = useState("")
  const [hours, setHours] = useState("")
  const [miles, setMiles] = useState("")
  const [extraCosts, setExtraCosts] = useState("")
  const [preset, setPreset] = useState("medium")
  const [showResult, setShowResult] = useState(false)
  const [history, setHistory] = useState<SavedResult[]>([])

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("gigledger_history")
    if (saved) {
      try {
        setHistory(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to load history:", e)
      }
    }
  }, [])

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("gigledger_history", JSON.stringify(history))
  }, [history])

  const result = useMemo(() => {
    const grossNum = Number(gross || 0)
    const hoursNum = Math.max(Number(hours || 0), 0)
    const milesNum = Math.max(Number(miles || 0), 0)
    const extraNum = Math.max(Number(extraCosts || 0), 0)
    const mileageRate = COST_PRESETS[preset as keyof typeof COST_PRESETS].rate
    const vehicleCost = milesNum * mileageRate
    const totalCost = vehicleCost + extraNum
    const net = grossNum - totalCost
    const hourly = hoursNum > 0 ? net / hoursNum : 0
    const score = scoreShift(hourly)
    const costRatio = grossNum > 0 ? Math.min((totalCost / grossNum) * 100, 100) : 0

    return {
      grossNum,
      hoursNum,
      milesNum,
      extraNum,
      mileageRate,
      vehicleCost,
      totalCost,
      net,
      hourly,
      score,
      costRatio,
    }
  }, [gross, hours, miles, extraCosts, preset])

  const saveResult = () => {
    const newResult: SavedResult = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      gross: result.grossNum,
      hours: result.hoursNum,
      miles: result.milesNum,
      extraCosts: result.extraNum,
      preset,
      net: result.net,
      hourly: result.hourly,
      costRatio: result.costRatio,
    }
    setHistory(prev => [newResult, ...prev].slice(0, MAX_HISTORY))
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem("gigledger_history")
  }

  const resetCalculator = () => {
    setGross("")
    setHours("")
    setMiles("")
    setExtraCosts("")
    setPreset("medium")
    setShowResult(false)
  }

  const toneClasses = {
    good: "bg-emerald-50 text-emerald-700 border-emerald-200",
    mid: "bg-amber-50 text-amber-700 border-amber-200",
    bad: "bg-rose-50 text-rose-700 border-rose-200",
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <header className="flex flex-col gap-4 border-b border-slate-100 pb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-2xl bg-slate-900 px-3 py-1 text-sm font-medium text-white">GigLedger</div>
              <Badge variant="secondary" className="rounded-full">MVP</Badge>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">See what you actually earned today</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
              A fast net earnings calculator for gig workers. Enter gross pay, hours, miles, and get your real take-home estimate after driving costs.
            </p>
          </div>
          <div className="flex gap-3">
            <Button className="rounded-2xl" onClick={() => document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" })}>Try calculator</Button>
            <Button variant="outline" className="rounded-2xl" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>How it works</Button>
          </div>
        </header>

        <main id="calculator" className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Calculate today's real earnings</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="manual" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 rounded-2xl">
                    <TabsTrigger value="manual" className="rounded-2xl">Manual entry</TabsTrigger>
                    <TabsTrigger value="upload" className="rounded-2xl">Screenshot upload</TabsTrigger>
                  </TabsList>

                  <TabsContent value="manual" className="mt-6 space-y-5">
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="gross">Gross earnings</Label>
                        <Input id="gross" value={gross} onChange={(e) => setGross(e.target.value)} placeholder="126.40" className="rounded-2xl h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hours">Hours worked</Label>
                        <Input id="hours" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="6.0" className="rounded-2xl h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="miles">Miles driven</Label>
                        <Input id="miles" value={miles} onChange={(e) => setMiles(e.target.value)} placeholder="43" className="rounded-2xl h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="extra">Extra costs</Label>
                        <Input id="extra" value={extraCosts} onChange={(e) => setExtraCosts(e.target.value)} placeholder="0" className="rounded-2xl h-12" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Driving cost profile</Label>
                        <span className="text-sm text-slate-500">{formatMoney(result.mileageRate)}/mile</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {Object.entries(COST_PRESETS).map(([key, item]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setPreset(key)}
                            className={`rounded-2xl border px-4 py-3 text-left transition ${preset === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-800"}`}
                          >
                            <div className="font-medium">{item.label}</div>
                            <div className={`text-sm ${preset === key ? "text-slate-300" : "text-slate-500"}`}>{formatMoney(item.rate)}/mile</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Use this when you know your payout, hours, and distance. It is the fastest way to validate whether a shift was actually worth it.
                    </div>

                    <Button className="h-12 rounded-2xl px-5" onClick={() => setShowResult(true)}>
                      Calculate real earnings <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </TabsContent>

                  <TabsContent value="upload" className="mt-6">
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <Upload className="h-6 w-6 text-slate-700" />
                      </div>
                      <h3 className="mt-4 text-lg font-medium">Upload earnings screenshot</h3>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                        MVP note: this version focuses on the core experience first. OCR parsing can be added next.
                      </p>
                      <Button variant="outline" className="mt-5 rounded-2xl">Choose image</Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard title="Net earnings" value={formatMoney(result.net)} icon={DollarSign} subtext="After estimated costs" />
              <MetricCard title="Real hourly" value={formatMoney(result.hourly)} icon={Gauge} subtext={formatHour(result.hourly)} />
              <MetricCard title="Vehicle cost" value={formatMoney(result.vehicleCost)} icon={Car} subtext={`${result.milesNum.toFixed(0)} miles × ${formatMoney(result.mileageRate)}`} />
            </div>
          </section>

          <section>
            <AnimatePresence mode="wait">
              <motion.div
                key={showResult ? "result" : "preview"}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="sticky top-6 rounded-3xl shadow-sm">
                  <CardContent className="p-6 md:p-7">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-500">Today's real earnings</p>
                      <Badge className={`rounded-full border ${toneClasses[result.score.tone as keyof typeof toneClasses]}`}>{result.score.label}</Badge>
                    </div>

                    <div className="mt-5">
                      <p className="text-sm text-slate-500">Take-home estimate</p>
                      <div className="mt-1 text-5xl font-semibold tracking-tight">{formatMoney(result.net)}</div>
                      <p className="mt-2 text-sm text-slate-500">after estimated costs</p>
                    </div>

                    <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-center justify-between py-2 text-sm">
                        <span className="text-slate-500">Gross earnings</span>
                        <span className="font-medium text-slate-900">{formatMoney(result.grossNum)}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 text-sm">
                        <span className="text-slate-500">Mileage cost</span>
                        <span className="font-medium text-slate-900">-{formatMoney(result.vehicleCost)}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 text-sm">
                        <span className="text-slate-500">Extra costs</span>
                        <span className="font-medium text-slate-900">-{formatMoney(result.extraNum)}</span>
                      </div>
                      <div className="my-2 h-px bg-slate-200" />
                      <div className="flex items-center justify-between py-2 text-base">
                        <span className="font-medium text-slate-700">Net earnings</span>
                        <span className="font-semibold text-slate-900">{formatMoney(result.net)}</span>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-sm text-slate-500">Real hourly pay</p>
                        <p className="mt-2 text-2xl font-semibold">{formatMoney(result.hourly)}</p>
                        <p className="mt-1 text-sm text-slate-500">{formatHour(result.hourly)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-sm text-slate-500">Cost share</p>
                        <p className="mt-2 text-2xl font-semibold">{result.costRatio.toFixed(0)}%</p>
                        <Progress value={result.costRatio} className="mt-3 h-2" />
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start gap-3">
                        <Info className="mt-0.5 h-4 w-4 text-slate-500" />
                        <div>
                          <p className="font-medium">What this means</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{result.score.note}</p>
                          <p className="mt-2 text-sm text-slate-500">Assumption: {formatMoney(result.mileageRate)}/mile driving cost profile.</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <Button className="flex-1 rounded-2xl" onClick={saveResult}>Save result</Button>
                      <Button variant="outline" className="flex-1 rounded-2xl" onClick={resetCalculator}>Analyze another shift</Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          </section>
        </main>

        {/* History Section */}
        {history.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent calculations
              </h2>
              <Button variant="ghost" size="sm" onClick={clearHistory} className="text-slate-500">
                <Trash2 className="h-4 w-4 mr-1" /> Clear
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {history.map((item) => (
                <Card key={item.id} className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-slate-500">{item.date}</span>
                      <Badge variant="secondary" className="text-xs">{COST_PRESETS[item.preset as keyof typeof COST_PRESETS].label}</Badge>
                    </div>
                    <div className="text-lg font-semibold">{formatMoney(item.net)}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {formatMoney(item.hourly)}/hr · {item.costRatio.toFixed(0)}% cost
                    </div>
                    <div className="text-xs text-slate-400 mt-2">
                      Gross: {formatMoney(item.gross)} · {item.hours}h · {item.miles}mi
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section id="how-it-works" className="mt-10 grid gap-4 md:grid-cols-3">
          <Card className="rounded-3xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100"><Receipt className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-medium">Built for daily use</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">The MVP focuses on one question: how much did I really make today after driving costs?</p>
            </CardContent>
          </Card>
          <Card className="rounded-3xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100"><Sparkles className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-medium">Easy to trust</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Every result shows the breakdown: gross pay, mileage cost, extras, net, and real hourly rate.</p>
            </CardContent>
          </Card>
          <Card className="rounded-3xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100"><Upload className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-medium">Ready for step two</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Once this flow converts, add screenshot OCR, saved history, and app comparisons behind login.</p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
