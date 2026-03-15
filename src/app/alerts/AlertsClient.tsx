'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertHistory } from '@/types'
import { toast } from 'sonner'
import { Send, Bell, CheckCircle, Clock } from 'lucide-react'

export default function AlertsClient() {
  const [history, setHistory]   = useState<AlertHistory[]>([])
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const [channel, setChannel]   = useState<'both'|'telegram'|'zalo'>('both')
  const [result, setResult]     = useState<{telegram:boolean;zalo:boolean}|null>(null)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    setLoading(true)
    const { data } = await supabase
      .from('alert_history')
      .select('*, products(name)')
      .order('sent_at', { ascending: false })
      .limit(20)
    setHistory((data as AlertHistory[]) || [])
    setLoading(false)
  }

  async function sendNow() {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      })
      const data = await res.json()
      setResult(data.result)
      if (data.sent > 0) {
        toast.success(`Đã gửi cảnh báo cho ${data.sent} sản phẩm!`)
      } else {
        toast.info('Không có sản phẩm nào cần cảnh báo.')
      }
      loadHistory()
    } catch {
      toast.error('Lỗi gửi cảnh báo')
    }
    setSending(false)
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Cảnh báo tự động</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gửi thông báo Telegram / Zalo OA khi sắp hết hàng</p>
      </div>

      {/* Send now */}
      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Bell size={16}/> Gửi cảnh báo ngay
        </h2>
        <div className="flex gap-2 mb-4">
          {(['both','telegram','zalo'] as const).map(c => (
            <button key={c} onClick={() => setChannel(c)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${channel===c ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {c==='both' ? '📱 Cả hai' : c==='telegram' ? '✈️ Telegram' : '💬 Zalo OA'}
            </button>
          ))}
        </div>
        <button onClick={sendNow} className="btn-primary w-full justify-center" disabled={sending}>
          <Send size={15}/>{sending ? 'Đang gửi...' : 'Gửi cảnh báo ngay'}
        </button>

        {result && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
            <div className="flex items-center gap-2">
              {result.telegram ? <CheckCircle size={14} className="text-green-500"/> : <Clock size={14} className="text-gray-400"/>}
              <span>Telegram: {result.telegram ? 'Đã gửi thành công' : 'Chưa cấu hình hoặc lỗi'}</span>
            </div>
            <div className="flex items-center gap-2">
              {result.zalo ? <CheckCircle size={14} className="text-green-500"/> : <Clock size={14} className="text-gray-400"/>}
              <span>Zalo OA: {result.zalo ? 'Đã gửi thành công' : 'Chưa cấu hình hoặc lỗi'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Config guide */}
      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-3">⚙️ Hướng dẫn cấu hình</h2>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="font-medium text-blue-900 mb-1">✈️ Telegram Bot</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-800 text-xs">
              <li>Nhắn tin @BotFather trên Telegram → /newbot</li>
              <li>Copy <code className="bg-blue-100 px-1 rounded">BOT_TOKEN</code> → điền vào TELEGRAM_BOT_TOKEN</li>
              <li>Nhắn tin với bot → gọi <code className="bg-blue-100 px-1 rounded">getUpdates</code> để lấy chat_id</li>
              <li>Điền <code className="bg-blue-100 px-1 rounded">chat_id</code> vào TELEGRAM_CHAT_ID</li>
            </ol>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="font-medium text-green-900 mb-1">💬 Zalo OA</p>
            <ol className="list-decimal list-inside space-y-0.5 text-green-800 text-xs">
              <li>Đăng nhập developers.zalo.me → tạo Official Account</li>
              <li>Vào API Explorer → lấy <code className="bg-green-100 px-1 rounded">access_token</code></li>
              <li>Điền vào ZALO_ACCESS_TOKEN + ZALO_USER_ID</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Alert history */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-3">📋 Lịch sử cảnh báo</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Đang tải...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Chưa có cảnh báo nào được gửi.</p>
        ) : (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className={`flex items-center justify-between p-3 rounded-lg ${h.alert_type==='critical'?'bg-red-50':'bg-yellow-50'}`}>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {(h as unknown as {products?: {name:string}}).products?.name || 'Sản phẩm'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(h.sent_at).toLocaleString('vi-VN')} · {h.channel === 'both' ? 'Telegram + Zalo' : h.channel}
                  </p>
                </div>
                <div className="text-right">
                  <span className={h.alert_type==='critical'?'badge-critical':'badge-warning'}>
                    {h.days_left} ngày
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
