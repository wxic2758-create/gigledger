export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Privacy Policy</h1>

        <div className="space-y-6">
          {[
            {
              title: 'No Account Required',
              icon: '🔒',
              content: 'GigLedger does not require you to create an account, sign up, or provide any personal information. You can start using it immediately.'
            },
            {
              title: 'Data Stays on Your Device',
              icon: '📱',
              content: 'All your earnings data is stored in your browser\'s localStorage. Your financial information never leaves your device. We cannot see, access, or store your data.'
            },
            {
              title: 'No Cookies',
              icon: '🍪',
              content: 'GigLedger does not use cookies or any form of tracking. We don\'t use Google Analytics, Facebook Pixel, or any other tracking technology.'
            },
            {
              title: 'No Data Sold',
              icon: '🚫',
              content: 'We do not sell, share, or transmit any user data to third parties. There is no data to sell because we don\'t collect any.'
            },
            {
              title: 'Screenshot Privacy',
              icon: '📸',
              content: 'When you upload a screenshot, it is processed in your browser and never uploaded to our servers. The image is used only to display on your screen and generate your share card.'
            },
            {
              title: 'Third-Party Services',
              icon: '🌐',
              content: 'Our website may link to external sites. We are not responsible for the privacy practices of third-party sites.'
            },
            {
              title: 'Open Source',
              icon: '💻',
              content: 'GigLedger is built with transparency in mind. Our code is available on GitHub for anyone to review.'
            },
          ].map(({ title, icon, content }) => (
            <div key={title} className="card p-6">
              <h2 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                <span>{icon}</span> {title}
              </h2>
              <p className="text-slate-600 leading-relaxed text-sm">{content}</p>
            </div>
          ))}

          <div className="card p-6 bg-slate-100">
            <p className="text-slate-500 text-sm">
              Last updated: April 2026
            </p>
            <p className="text-slate-500 text-sm mt-2">
              Questions? Contact us at <span className="text-blue-600">hello@gigledger.xyz</span>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
