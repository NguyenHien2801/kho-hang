'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { computePrediction } from '@/lib/prediction'
import { AlertHistory, PredictionResult } from '@/types'
import { toast } from 'sonner'
import { Send, Bell, CheckCircle, Clock, AlertTriangle, Trash2, Package } from 'lucide-react'

export default function AlertsClient() {
  const [history, setHistory]         = useState<AlertHistory[]>([])
  const [alertItems, setAlertItems]   = useState<PredictionResult[]>([])
  const [loading, setLoading]         = useState(true)
  const [sending, setSending]         = useState(false)
  const [sendingId, setSendingId]     = useState<string | null>(null)
  const [channel, setChannel]         = useState<'both'|'telegram'|'zalo'>('both')
  const [result, setResult]           = useState<{telegram:boolean;zalo:boolean}|null>(null)
  const [deletingAll, setDeletingAll] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadAlertItems(), loadHistory()])
    setLoading(false)
  }

  async function loadAlertItems() {
    const { data: prods } = await supabase
      .from('products').select('*').eq('is_active', true)
    if (!prods) return

    const preds = await Promise.all(
      prods.map(async p => {
        const { data: sales } = await supabase
          .from('daily_sales').select('*')
          .eq('product_id', p.id).order('sale_date').limit(30)
        return computePrediction(p, sales || [])
      })
    )

    const needAlert = preds.filter(p => p.status === 'warning' || p.status === 'critical')
    setAlertItems(needAlert.sort((a, b) => a.predicted_days_left - b.predicted_days_left))
  }

  async function loadHistory() {
    const { data } = await supabase
      .from('alert_history')
      .select('*, products(name, image_url)')
      .order('sent_at', { ascending: false })
      .limit(20)
    setHistory((data as AlertHistory[]) || [])
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

  async function sendOne(p: PredictionResult) {
    setSendingId(p.product_id)
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, product_id: p.product_id }),
      })
      const data = await res.json()
      if (data.sent > 0) {
        toast.success(`Đã gửi cảnh báo: ${p.product_name}`)
      } else {
        toast.error('Gửi thất bại')
      }
      loadHistory()
    } catch {
      toast.error('Lỗi gửi cảnh báo')
    }
    setSendingId(null)
  }

  async function deleteAllHistory() {
    if (!confirm('Xóa toàn bộ lịch sử cảnh báo?')) return
    setDeletingAll(true)
    const { error } = await supabase
      .from('alert_history')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      toast.error('Xóa thất bại')
    } else {
      toast.success('Đã xóa lịch sử cảnh báo')
      setHistory([])
    }
    setDeletingAll(false)
  }

  async function deleteOne(id: string) {
    const { error } = await supabase.from('alert_history').delete().eq('id', id)
    if (error) {
      toast.error('Xóa thất bại')
    } else {
      setHistory(h => h.filter(x => x.id !== id))
    }
  }

  const criticals = alertItems.filter(p => p.status === 'critical')
  const warnings  = alertItems.filter(p => p.status === 'warning')

  // Component ảnh sản phẩm
  function ProductImage({ imageUrl, name, size = 48 }: { imageUrl?: string; name: string; size?: number }) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 10, overflow: 'hidden',
        background: '#f8fafc', border: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {imageUrl
          ? <img src={imageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <Package size={size * 0.4} style={{ color: '#cbd5e1' }} />
        }
      </div>
    )
  }

  // Row từng sản phẩm cần cảnh báo
  function AlertRow({ p, isCritical }: { p: PredictionResult; isCritical: boolean }) {
    const imageUrl = (p as any).image_url
    const bg      = isCritical ? '#fff1f2' : '#fffbeb'
    const border  = isCritical ? '#fecdd3' : '#fde68a'
    const badgeBg = isCritical ? '#fee2e2' : '#fef9c3'
    const badgeC  = isCritical ? '#be123c' : '#92400e'
    const btnBg   = isCritical ? '#dc2626' : '#d97706'
    const btnHov  = isCritical ? '#b91c1c' : '#b45309'

    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 12,
        background: bg, border: `1px solid ${border}`,
        marginBottom: 8,
      }}>
        {/* Ảnh */}
        <ProductImage imageUrl={imageUrl} name={p.product_name} size={52} />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.product_name}
          </p>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
            Tồn: <strong style={{ color: '#0f172a' }}>{p.current_stock}</strong>
            {' · '}TB {p.avg_daily_sales}/ngày
            {' · '}Hết: <strong style={{ color: badgeC }}>{p.predicted_stockout_date}</strong>
          </p>
        </div>

        {/* Badge + nút gửi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '4px 10px',
            borderRadius: 20, background: badgeBg, color: badgeC,
            whiteSpace: 'nowrap',
          }}>
            {p.predicted_days_left} ngày
          </span>
          <button
            onClick={() => sendOne(p)}
            disabled={sendingId === p.product_id}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 12px', borderRadius: 8, border: 'none',
              background: btnBg, color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              opacity: sendingId === p.product_id ? 0.6 : 1,
              fontFamily: 'inherit', whiteSpace: 'nowrap',
              transition: 'background .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = btnHov)}
            onMouseLeave={e => (e.currentTarget.style.background = btnBg)}
          >
            <Send size={12} />
            {sendingId === p.product_id ? '...' : 'Gửi'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Cảnh báo tự động</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gửi thông báo Telegram / Zalo OA khi sắp hết hàng</p>
      </div>

      {/* ── Sản phẩm cần cảnh báo ── */}
      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-orange-500" />
          Sản phẩm cần cảnh báo
          {alertItems.length > 0 && (
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              {alertItems.length} sản phẩm
            </span>
          )}
        </h2>

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 76, borderRadius: 12, background: '#f8fafc', border: '1px solid #f1f5f9' }} />
            ))}
          </div>
        ) : alertItems.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
            <CheckCircle size={15} />
            <span>Tất cả sản phẩm đang đủ hàng!</span>
          </div>
        ) : (
          <>
            {criticals.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2">
                  🔴 Hết hàng khẩn cấp — dưới 3 ngày ({criticals.length})
                </p>
                {criticals.map(p => <AlertRow key={p.product_id} p={p} isCritical={true} />)}
              </div>
            )}
            {warnings.length > 0 && (
              <div>
                <p className="text-xs font-bold text-yellow-600 uppercase tracking-wide mb-2">
                  🟡 Sắp hết hàng — dưới 10 ngày ({warnings.length})
                </p>
                {warnings.map(p => <AlertRow key={p.product_id} p={p} isCritical={false} />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Gửi tất cả ── */}
      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Bell size={16} /> Gửi tất cả cùng lúc
        </h2>
        <div className="flex gap-2 mb-4">
          {(['both','telegram','zalo'] as const).map(c => (
            <button key={c} onClick={() => setChannel(c)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${channel===c ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {c==='both' ? '📱 Cả hai' : c==='telegram' ? '✈️ Telegram' : '💬 Zalo OA'}
            </button>
          ))}
        </div>
        <button
          onClick={sendNow}
          className="btn-primary w-full justify-center"
          disabled={sending || alertItems.length === 0}
        >
          <Send size={15} />
          {sending ? 'Đang gửi...' : alertItems.length === 0
            ? 'Không có sản phẩm cần cảnh báo'
            : `Gửi tất cả (${alertItems.length} sản phẩm)`}
        </button>

        {result && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
            <div className="flex items-center gap-2">
              {result.telegram
                ? <CheckCircle size={14} className="text-green-500" />
                : <Clock size={14} className="text-gray-400" />}
              <span>Telegram: {result.telegram ? 'Đã gửi thành công' : 'Chưa cấu hình hoặc lỗi'}</span>
            </div>
            <div className="flex items-center gap-2">
              {result.zalo
                ? <CheckCircle size={14} className="text-green-500" />
                : <Clock size={14} className="text-gray-400" />}
              <span>Zalo OA: {result.zalo ? 'Đã gửi thành công' : 'Chưa cấu hình hoặc lỗi'}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Hướng dẫn cấu hình ── */}
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

      {/* ── Lịch sử cảnh báo ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">📋 Lịch sử cảnh báo</h2>
          {history.length > 0 && (
            <button
              onClick={deleteAllHistory}
              disabled={deletingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-all"
            >
              <Trash2 size={12} />
              {deletingAll ? 'Đang xóa...' : 'Xóa tất cả'}
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Đang tải...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Chưa có cảnh báo nào được gửi.</p>
        ) : (
          <div className="space-y-2">
            {history.map(h => {
              const prod     = (h as any).products
              const imageUrl = prod?.image_url
              const name     = prod?.name || h.message
              return (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: h.alert_type === 'critical' ? '#fff1f2' : '#fffbeb',
                }}>
                  {/* Ảnh trong lịch sử */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, overflow: 'hidden',
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {imageUrl
                      ? <img src={imageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <Package size={16} style={{ color: '#cbd5e1' }} />
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(h.sent_at).toLocaleString('vi-VN')}
                      {' · '}
                      {h.channel === 'both' ? 'Telegram + Zalo' : h.channel}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span className={h.alert_type === 'critical' ? 'badge-critical' : 'badge-warning'}>
                      {h.days_left} ngày
                    </span>
                    <button
                      onClick={() => deleteOne(h.id)}
                      style={{
                        width: 30, height: 30, borderRadius: 8, border: 'none',
                        background: 'transparent', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#94a3b8', transition: 'all .15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}