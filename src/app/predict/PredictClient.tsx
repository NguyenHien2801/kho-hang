'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { computePrediction } from '@/lib/prediction'
import { PredictionResult } from '@/types'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell
} from 'recharts'
import { format, addDays } from 'date-fns'
import { TrendingUp, TrendingDown, Minus, Bot, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

export default function PredictClient() {
  const [predictions, setPredictions] = useState<PredictionResult[]>([])
  const [selected, setSelected]       = useState<PredictionResult | null>(null)
  const [loading, setLoading]         = useState(true)
  const [aiAdvice, setAiAdvice]       = useState('')
  const [aiLoading, setAiLoading]     = useState(false)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

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
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advice' })
      })
      const data = await res.json()
      setAiAdvice(data.advice || 'Không có dữ liệu.')
    } catch {
      setAiAdvice('Lỗi kết nối AI.')
    }
    setAiLoading(false)
  }

  function buildChartData(pred: PredictionResult) {
    const today = new Date()
    const data: { date: string; actual: number | null; forecast: number | null }[] = []

    pred.sales_30days?.forEach((s) => {
      data.push({
        date: format(new Date(s.sale_date), 'dd/MM'),
        actual: s.quantity,
        forecast: null,
      })
    })

    pred.forecast_7days?.forEach((stock, i) => {
      data.push({
        date: format(addDays(today, i + 1), 'dd/MM'),
        actual: null,
        forecast: stock,
      })
    })

    return data
  }

  function trendIcon(slope: number) {
    if (slope > 0.5)  return <TrendingUp  size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
    if (slope < -0.5) return <TrendingDown size={13} style={{ color: '#22c55e', flexShrink: 0 }} />
    return <Minus size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
  }

  const statusMeta = {
    ok:       { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'Đủ hàng'  },
    warning:  { color: '#92400e', bg: '#fffbeb', border: '#fde68a', label: 'Sắp hết'  },
    critical: { color: '#be123c', bg: '#fff1f2', border: '#fecdd3', label: 'Hết khẩn' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: 14 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes spin   { to { transform: rotate(360deg) } }

        .pred-wrap      { max-width: 1280px; margin: 0 auto; padding: 14px 14px 48px; }
        .pred-topbar    { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; gap: 10px; flex-wrap: wrap; }
        .pred-layout    { display: flex; flex-direction: column; gap: 12px; }
        .pred-sidebar   { width: 100%; }
        .pred-main      { width: 100%; }
        .pred-card-list { display: flex; flex-direction: column; gap: 8px; }
        .pred-card      { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; }
        .pred-card.sel  { border-color: #22c55e; background: #f0fdf4; }
        .pred-hdr       { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; cursor: pointer; gap: 10px; }
        .pred-body      { padding: 0 14px 14px; animation: fadeIn .18s ease; border-top: 1px solid #f1f5f9; }
        .pred-stat3     { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 12px; padding-top: 12px; }
        .pred-sbox      { background: #f8fafc; border-radius: 10px; padding: 10px 8px; text-align: center; border: 1px solid #f1f5f9; }
        .pred-sec-lbl   { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 8px; }
        .pred-btn-pri   { display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap; }
        .pred-btn-ghost { display:inline-flex;align-items:center;gap:6px;padding:9px 13px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap; }

        @media (min-width: 640px)  { .pred-wrap { padding: 20px 20px 48px; } }
        @media (min-width: 900px)  {
          .pred-wrap    { padding: 28px 28px 48px; }
          .pred-layout  { flex-direction: row; gap: 20px; align-items: flex-start; }
          .pred-sidebar { width: 268px; flex-shrink: 0; }
          .pred-main    { flex: 1; min-width: 0; }
          .pred-toggle  { display: none !important; }
          .pred-body    { display: none !important; }
          .pred-desktop { display: block !important; }
        }
        @media (max-width: 899px)  { .pred-desktop { display: none !important; } }
      `}</style>

      <div className="pred-wrap">

        {/* TOPBAR */}
        <div className="pred-topbar">
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
              AI Dự đoán bán hàng
            </h1>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0', fontWeight: 500 }}>
              Linear regression · 30 ngày gần nhất
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={load} disabled={loading} className="pred-btn-ghost">
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              Làm mới
            </button>
            <button onClick={getAiAdvice} disabled={aiLoading} className="pred-btn-pri">
              <Bot size={13} />
              {aiLoading ? 'Đang phân tích...' : 'Phân tích AI'}
            </button>
          </div>
        </div>

        {/* AI ADVICE */}
        {aiAdvice && (
          <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 12, padding: '12px 14px', marginBottom: 14, display: 'flex', gap: 10 }}>
            <Bot size={14} style={{ color: '#7c3aed', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#6b21a8', margin: '0 0 4px' }}>Phân tích AI</p>
              <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{aiAdvice}</p>
            </div>
          </div>
        )}

        <div className="pred-layout">

          {/* SIDEBAR */}
          <div className="pred-sidebar">
            <p className="pred-sec-lbl" style={{ marginBottom: 10 }}>Sản phẩm ({predictions.length})</p>

            {loading ? (
              <div className="pred-card-list">
                {[...Array(5)].map((_, i) => (
                  <div key={i} style={{ background: '#f8fafc', borderRadius: 12, height: 60, border: '1px solid #f1f5f9' }} />
                ))}
              </div>
            ) : (
              <div className="pred-card-list">
                {predictions.map(p => {
                  const st = statusMeta[p.status]
                  const isActive   = selected?.product_id === p.product_id
                  const isExpanded = expandedCard === p.product_id

                  return (
                    <div key={p.product_id} className={`pred-card${isActive ? ' sel' : ''}`}>
                      <div className="pred-hdr" onClick={() => {
                        setSelected(p)
                        setExpandedCard(isExpanded ? null : p.product_id)
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            {trendIcon(p.slope)}
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.product_name}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                              Tồn: <strong style={{ color: '#0f172a' }}>{p.current_stock}</strong>
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                              {p.predicted_days_left} ngày · {st.label}
                            </span>
                          </div>
                        </div>
                        <div className="pred-toggle" style={{ flexShrink: 0 }}>
                          {isExpanded
                            ? <ChevronUp size={14} style={{ color: '#94a3b8' }} />
                            : <ChevronDown size={14} style={{ color: '#94a3b8' }} />
                          }
                        </div>
                      </div>

                      {/* Mobile expand body */}
                      {isExpanded && (
                        <div className="pred-body">
                          <MiniDetail pred={p} buildChartData={buildChartData} statusMeta={statusMeta} predictions={predictions} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* DESKTOP main chart panel */}
          <div className="pred-main pred-desktop">
            {selected ? (
              <DetailPanel pred={selected} buildChartData={buildChartData} statusMeta={statusMeta} predictions={predictions} />
            ) : (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '48px 24px', textAlign: 'center', color: '#94a3b8' }}>
                <TrendingUp size={28} style={{ margin: '0 auto 10px', opacity: .25, display: 'block' }} />
                <p style={{ margin: 0, fontSize: 14 }}>Chọn sản phẩm để xem biểu đồ</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Desktop detail panel ── */
function DetailPanel({ pred, buildChartData, statusMeta, predictions }: {
  pred: PredictionResult
  buildChartData: (p: PredictionResult) => any[]
  statusMeta: Record<string, any>
  predictions: PredictionResult[]
}) {
  const st = statusMeta[pred.status]
  return (
    <>
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 3px' }}>{pred.product_name}</h2>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, fontFamily: 'monospace' }}>{pred.barcode}</p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, color: st.color, background: st.bg, border: `1px solid ${st.border}`, whiteSpace: 'nowrap' }}>
            Còn {pred.predicted_days_left} ngày · Hết {pred.predicted_stockout_date}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Tồn hiện tại',   value: `${pred.current_stock}` },
            { label: 'TB bán/ngày',    value: `${pred.avg_daily_sales}` },
            { label: 'Xu hướng slope', value: `${pred.slope > 0 ? '+' : ''}${pred.slope}` },
          ].map(s => (
            <div key={s.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '11px 10px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 5px', fontWeight: 600 }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px' }}>
          Lịch sử bán + dự báo tồn kho
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={buildChartData(pred)} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="actual"   name="Bán thực tế"    stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="forecast" name="Dự báo tồn kho" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>
          So sánh ngày hết hàng dự kiến
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={predictions.slice(0, 8).map(p => ({
            name: p.product_name.split(' ').slice(0, 2).join(' '),
            days: p.predicted_days_left,
          }))} margin={{ left: -10, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 10 }} label={{ value: 'Ngày', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
            <Tooltip formatter={(v: number) => [`${v} ngày`, 'Còn lại']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <ReferenceLine y={3}  stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Khẩn',     fill: '#ef4444', fontSize: 9 }} />
            <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Cảnh báo', fill: '#f59e0b', fontSize: 9 }} />
            <Bar dataKey="days" radius={[4, 4, 0, 0]}>
              {predictions.slice(0, 8).map((p, i) => (
                <Cell key={i} fill={p.status === 'critical' ? '#ef4444' : p.status === 'warning' ? '#f59e0b' : '#22c55e'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

/* ── Mobile inline mini detail ── */
function MiniDetail({ pred, buildChartData, statusMeta, predictions }: {
  pred: PredictionResult
  buildChartData: (p: PredictionResult) => any[]
  statusMeta: Record<string, any>
  predictions: PredictionResult[]
}) {
  const st = statusMeta[pred.status]
  return (
    <>
      {/* Stockout date */}
      <div style={{ paddingTop: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 11px', borderRadius: 20, color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
          Dự kiến hết: {pred.predicted_stockout_date}
        </span>
      </div>

      {/* 3 stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 12 }}>
        {[
          { label: 'Tồn',     value: `${pred.current_stock}` },
          { label: 'TB/ngày', value: `${pred.avg_daily_sales}` },
          { label: 'Slope',   value: `${pred.slope > 0 ? '+' : ''}${pred.slope}` },
        ].map(s => (
          <div key={s.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '9px 7px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: 10, color: '#94a3b8', margin: '0 0 3px', fontWeight: 600 }}>{s.label}</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Compact chart */}
      <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px' }}>
        Lịch sử + Dự báo
      </p>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={buildChartData(pred)} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
          <Line type="monotone" dataKey="actual"   name="Bán"     stroke="#3b82f6" strokeWidth={1.5} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="forecast" name="Tồn dự"  stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </>
  )
}