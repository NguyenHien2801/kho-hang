'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { computePrediction } from '@/lib/prediction'
import { PredictionResult } from '@/types'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar
} from 'recharts'
import { format, addDays, subDays } from 'date-fns'
import { TrendingUp, TrendingDown, Minus, Bot, RefreshCw } from 'lucide-react'

export default function PredictClient() {
  const [predictions, setPredictions] = useState<PredictionResult[]>([])
  const [selected, setSelected]       = useState<PredictionResult | null>(null)
  const [loading, setLoading]         = useState(true)
  const [aiAdvice, setAiAdvice]       = useState('')
  const [aiLoading, setAiLoading]     = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: prods } = await supabase.from('products').select('*').eq('is_active', true)
    if (!prods) { setLoading(false); return }

    const preds = await Promise.all(
      prods.map(async p => {
        const { data: sales } = await supabase.from('daily_sales').select('*')
          .eq('product_id', p.id).order('sale_date').limit(30)
        return computePrediction(p, sales || [])
      })
    )

    const sorted = preds.sort((a, b) => a.predicted_days_left - b.predicted_days_left)
    setPredictions(sorted)
    if (sorted.length > 0) setSelected(sorted[0])
    setLoading(false)
  }

  async function getAiAdvice() {
    setAiLoading(true)
    try {
      const res = await fetch('/api/predict', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'advice' }) })
      const data = await res.json()
      setAiAdvice(data.advice || 'Không có dữ liệu.')
    } catch { setAiAdvice('Lỗi kết nối AI.') }
    setAiLoading(false)
  }

  // Xây dựng data cho biểu đồ
  function buildChartData(pred: PredictionResult) {
    const today = new Date()
    const data: { date: string; actual: number | null; forecast: number | null; stock?: number }[] = []

    // 30 ngày lịch sử (doanh số bán)
    pred.sales_30days.forEach((s, i) => {
      data.push({
        date: format(new Date(s.sale_date), 'dd/MM'),
        actual: s.quantity,
        forecast: null,
      })
    })

    // 7 ngày dự báo tồn kho
    pred.forecast_7days.forEach((stock, i) => {
      data.push({
        date: format(addDays(today, i + 1), 'dd/MM'),
        actual: null,
        forecast: stock,
      })
    })

    return data
  }

  function trendIcon(slope: number) {
    if (slope > 0.5) return <TrendingUp size={14} className="text-red-500"/>
    if (slope < -0.5) return <TrendingDown size={14} className="text-green-500"/>
    return <Minus size={14} className="text-gray-400"/>
  }

  const statusColor = { ok:'text-green-600', warning:'text-yellow-600', critical:'text-red-600' }
  const statusLabel = { ok:'Đủ hàng', warning:'Sắp hết', critical:'Hết khẩn' }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Dự đoán bán hàng</h1>
          <p className="text-sm text-gray-500">Linear regression dựa trên 30 ngày gần nhất</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary" disabled={loading}>
            <RefreshCw size={15} className={loading?'animate-spin':''}/>Làm mới
          </button>
          <button onClick={getAiAdvice} className="btn-primary" disabled={aiLoading}>
            <Bot size={15}/>{aiLoading ? 'Đang phân tích...' : 'Phân tích AI'}
          </button>
        </div>
      </div>

      {/* AI advice box */}
      {aiAdvice && (
        <div className="card p-4 mb-5 border-purple-100 bg-purple-50/40">
          <div className="flex items-start gap-2">
            <Bot size={16} className="text-purple-600 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="text-sm font-semibold text-purple-900 mb-1">Phân tích AI</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiAdvice}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-5">
        {/* Left: product list */}
        <div className="w-72 flex-shrink-0 space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sản phẩm ({predictions.length})</p>
          {loading ? (
            <p className="text-sm text-gray-400">Đang tính toán...</p>
          ) : predictions.map(p => (
            <button key={p.product_id}
              onClick={() => setSelected(p)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${selected?.product_id === p.product_id ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-800 truncate flex-1">{p.product_name}</p>
                {trendIcon(p.slope)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Tồn: {p.current_stock}</span>
                <span className={`text-xs font-bold ${statusColor[p.status]}`}>
                  {p.predicted_days_left} ngày · {statusLabel[p.status]}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Right: chart detail */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <>
              <div className="card p-4 mb-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg">{selected.product_name}</h2>
                    <p className="text-xs text-gray-500 font-mono">{selected.barcode}</p>
                  </div>
                  <span className={`badge-${selected.status === 'ok' ? 'ok' : selected.status === 'warning' ? 'warning' : 'critical'} text-sm px-3 py-1`}>
                    Còn {selected.predicted_days_left} ngày · Hết {selected.predicted_stockout_date}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label:'Tồn hiện tại', value:`${selected.current_stock}`, unit:'' },
                    { label:'Trung bình bán/ngày', value:`${selected.avg_daily_sales}`, unit:'' },
                    { label:'Xu hướng (slope)', value:`${selected.slope > 0 ? '+' : ''}${selected.slope}`, unit:'' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                      <p className="text-xl font-bold text-gray-900">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Sales + forecast chart */}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Lịch sử bán + dự báo tồn kho</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={buildChartData(selected)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4}/>
                    <YAxis tick={{ fontSize: 11 }}/>
                    <Tooltip contentStyle={{ fontSize: 12 }}/>
                    <Legend wrapperStyle={{ fontSize: 12 }}/>
                    <Line type="monotone" dataKey="actual" name="Bán thực tế" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls={false}/>
                    <Line type="monotone" dataKey="forecast" name="Dự báo tồn kho" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Top 5 bar chart */}
              <div className="card p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">So sánh ngày hết hàng dự kiến</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={predictions.slice(0, 8).map(p => ({
                    name: p.product_name.split(' ').slice(0,2).join(' '),
                    days: p.predicted_days_left,
                    fill: p.status === 'critical' ? '#ef4444' : p.status === 'warning' ? '#f59e0b' : '#22c55e'
                  }))} margin={{ left: 0, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }}/>
                    <YAxis tick={{ fontSize: 11 }} label={{ value: 'Ngày', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}/>
                    <Tooltip formatter={(v: number) => [`${v} ngày`, 'Còn lại']} contentStyle={{ fontSize: 12 }}/>
                    <ReferenceLine y={3}  stroke="#ef4444" strokeDasharray="4 4" label={{ value:'Khẩn', fill:'#ef4444', fontSize:10 }}/>
                    <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4" label={{ value:'Cảnh báo', fill:'#f59e0b', fontSize:10 }}/>
                    <Bar dataKey="days" radius={[4,4,0,0]}>
                      {predictions.slice(0,8).map((p, i) => (
                        // @ts-expect-error recharts Cell
                        <Cell key={i} fill={p.status==='critical'?'#ef4444':p.status==='warning'?'#f59e0b':'#22c55e'}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="card p-10 text-center text-gray-400">
              <TrendingUp size={32} className="mx-auto mb-2 opacity-30"/>
              <p>Chọn sản phẩm để xem biểu đồ</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
