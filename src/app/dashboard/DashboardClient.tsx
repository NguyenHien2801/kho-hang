'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { computePrediction } from '@/lib/prediction'
import {
  Package, AlertTriangle, AlertCircle,
  TrendingUp, RefreshCw, Bell
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

interface StatCard {
  label: string; value: number | string; sub: string; color: string; icon: React.ReactNode
}

export default function DashboardClient() {
  const [products, setProducts]   = useState<Product[]>([])
  const [loading, setLoading]     = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [criticals, setCriticals] = useState<typeof import('@/types').PredictionResult[]>([])
  const [warnings, setWarnings]   = useState<typeof import('@/types').PredictionResult[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: prods } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (!prods) { setLoading(false); return }
    setProducts(prods)

    // Tính dự đoán cho tất cả sản phẩm
    const preds = await Promise.all(
      prods.map(async (p) => {
        const { data: sales } = await supabase
          .from('daily_sales')
          .select('*')
          .eq('product_id', p.id)
          .order('sale_date', { ascending: false })
          .limit(30)
        return computePrediction(p, sales || [])
      })
    )

    setCriticals(preds.filter(p => p.status === 'critical'))
    setWarnings(preds.filter(p => p.status === 'warning'))
    setLastUpdate(new Date())
    setLoading(false)
  }

  const stats: StatCard[] = [
    { label: 'Tổng sản phẩm',     value: products.length, sub: 'mặt hàng đang quản lý', color: 'blue',   icon: <Package size={22} /> },
    { label: 'Cần nhập khẩn',     value: criticals.length, sub: 'sắp hết trong 3 ngày',  color: 'red',    icon: <AlertCircle size={22} /> },
    { label: 'Cần theo dõi',      value: warnings.length,  sub: 'sắp hết trong 10 ngày', color: 'yellow', icon: <AlertTriangle size={22} /> },
    { label: 'Bình thường',       value: products.length - criticals.length - warnings.length, sub: 'tồn kho đầy đủ', color: 'green', icon: <TrendingUp size={22} /> },
  ]

  const colorMap: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600',
    red:    'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    green:  'bg-green-50 text-green-600',
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tổng quan kho hàng</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cập nhật {formatDistanceToNow(lastUpdate, { locale: vi, addSuffix: true })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="btn-secondary"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <Link href="/alerts" className="btn-primary">
            <Bell size={15} />
            Gửi cảnh báo
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500 font-medium">{s.label}</p>
              <div className={`p-2 rounded-lg ${colorMap[s.color]}`}>{s.icon}</div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{loading ? '—' : s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Alert sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Critical */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-red-500" />
            <h2 className="font-semibold text-gray-900">Hết hàng khẩn cấp</h2>
            {criticals.length > 0 && (
              <span className="badge-critical ml-auto">{criticals.length} sản phẩm</span>
            )}
          </div>
          {loading ? (
            <p className="text-sm text-gray-400">Đang tải...</p>
          ) : criticals.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Không có sản phẩm nào cần nhập khẩn.</p>
          ) : (
            <div className="space-y-2">
              {criticals.map(p => (
                <div key={p.product_id} className="flex items-center justify-between p-2.5 bg-red-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.product_name}</p>
                    <p className="text-xs text-gray-500">Bán {p.avg_daily_sales}/ngày · Tồn: {p.current_stock}</p>
                  </div>
                  <span className="badge-critical">{p.predicted_days_left} ngày</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Warning */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-yellow-500" />
            <h2 className="font-semibold text-gray-900">Cần theo dõi</h2>
            {warnings.length > 0 && (
              <span className="badge-warning ml-auto">{warnings.length} sản phẩm</span>
            )}
          </div>
          {loading ? (
            <p className="text-sm text-gray-400">Đang tải...</p>
          ) : warnings.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Không có sản phẩm nào cần theo dõi.</p>
          ) : (
            <div className="space-y-2">
              {warnings.map(p => (
                <div key={p.product_id} className="flex items-center justify-between p-2.5 bg-yellow-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.product_name}</p>
                    <p className="text-xs text-gray-500">Bán {p.avg_daily_sales}/ngày · Tồn: {p.current_stock}</p>
                  </div>
                  <span className="badge-warning">{p.predicted_days_left} ngày</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { href:'/inventory', label:'Xem bảng kho đầy đủ', color:'bg-blue-600' },
          { href:'/scan',      label:'Quét mã vạch ngay',    color:'bg-green-600' },
          { href:'/predict',   label:'Xem biểu đồ dự đoán',  color:'bg-purple-600' },
        ].map(l => (
          <Link key={l.href} href={l.href}
            className={`${l.color} text-white rounded-xl p-4 text-center text-sm font-medium hover:opacity-90 transition-opacity`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
