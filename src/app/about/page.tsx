export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">About GigLedger</h1>

        <div className="space-y-6">
          {[
            {
              title: 'Our Mission',
              icon: '🎯',
              content: 'GigLedger helps gig workers understand their true earnings. We believe every Uber driver, DoorDash delivery person, and gig worker deserves to know how much they really make — after accounting for the real costs of doing business.'
            },
            {
              title: 'How We Calculate',
              icon: '🧮',
              content: 'We use the IRS standard mileage rate for vehicle costs. For 2026, that\'s $0.70 per mile. This covers fuel, depreciation, maintenance, and insurance. Your net income = gross earnings − (miles driven × $0.70). Your true hourly rate = net income ÷ hours worked.'
            },
            {
              title: 'The Tax Deduction',
              icon: '💡',
              content: 'The miles you drive for gig work are tax-deductible. At $0.70/mile, if you drive 500 miles in a week, that\'s $350 in deductible expenses. GigLedger shows you this number so you\'re not surprised at tax time.'
            },
            {
              title: 'Not Affiliated',
              icon: '⚠️',
              content: 'GigLedger is not affiliated with, endorsed by, or connected to Uber, Lyft, DoorDash, Instacart, Amazon Flex, or any other gig platform. We\'re an independent tool built by gig workers, for gig workers.'
            },
            {
              title: 'For Informational Purposes Only',
              icon: '📋',
              content: 'GigLedger provides estimates for informational purposes. Our calculations are based on the IRS standard mileage rate and general cost assumptions. For tax advice specific to your situation, please consult a qualified tax professional.'
            },
          ].map(({ title, icon, content }) => (
            <div key={title} className="card p-6">
              <h2 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                <span>{icon}</span> {title}
              </h2>
              <p className="text-slate-600 leading-relaxed text-sm">{content}</p>
            </div>
          ))}

          <div className="card p-6 bg-blue-50 border-blue-200">
            <h2 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span>🚀</span> Start Using GigLedger
            </h2>
            <p className="text-slate-600 text-sm mb-4">
              Ready to know your real earnings? It takes less than 5 seconds.
            </p>
            <a href="/analyze" className="btn-primary inline-flex items-center gap-2">
              Calculate Now →
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
