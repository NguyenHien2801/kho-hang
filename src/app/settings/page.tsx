import Sidebar from '@/components/ui/Sidebar'

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Cài đặt hệ thống</h1>
        <p className="text-sm text-gray-500 mb-6">Cấu hình kết nối và ngưỡng cảnh báo</p>
        <div className="card p-5 max-w-xl">
          <h2 className="font-semibold mb-3">Biến môi trường (.env.local)</h2>
          <div className="space-y-2 text-sm font-mono bg-gray-900 text-green-400 rounded-xl p-4 overflow-x-auto">
            {[
              'NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co',
              'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...',
              'SUPABASE_SERVICE_ROLE_KEY=eyJ...',
              '',
              '# Chọn 1 trong 2:',
              'AI_PROVIDER=grok',
              'GROK_API_KEY=xai-...',
              '# hoặc:',
              'AI_PROVIDER=claude',
              'ANTHROPIC_API_KEY=sk-ant-...',
              '',
              'TELEGRAM_BOT_TOKEN=123456:ABC...',
              'TELEGRAM_CHAT_ID=987654321',
              '',
              'ZALO_ACCESS_TOKEN=...',
              'ZALO_USER_ID=...',
              '',
              'ALERT_WARNING_DAYS=10',
              'ALERT_CRITICAL_DAYS=3',
              'CRON_SECRET=random-secret-string',
            ].map((line, i) => (
              <div key={i} className={line === '' ? 'h-2' : ''}>
                {line && <span>{line}</span>}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Copy file <code>.env.local.example</code> → <code>.env.local</code> rồi điền giá trị thực.
          </p>
        </div>
      </main>
    </div>
  )
}
