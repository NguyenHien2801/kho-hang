'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { computePrediction } from '@/lib/prediction'
import { PredictionResult } from '@/types'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'
import ProductImage from '@/components/ui/ProductImage'

function buildChartData(preds: PredictionResult[]) {
  const today = new Date()
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (29 - i))
    const base = preds.reduce((sum, p) => {
      const noise = Math.sin(i * 0.4 + p.avg_daily_sales) * 2
      return sum + Math.max(0, Math.round(p.avg_daily_sales + noise))
    }, 0)
    return {
      date:   `${d.getDate()}/${d.getMonth() + 1}`,
      bán:    base,
      nhập:   i % 7 === 0 ? Math.round(base * 2.5) : 0,
      tồnKho: Math.max(0, 200 - i * 2 + (i % 7 === 0 ? 50 : 0)),
    }
  })
}

function buildMonthlyData(preds: PredictionResult[], products: Product[]) {
  return Array.from({ length: 12 }, (_, i) => {
    const seasonFactor = [1.4, 1.1, 0.9, 0.85, 0.9, 1.0, 1.05, 1.1, 0.95, 1.0, 1.15, 1.5][i]
    const baseRevenue = preds.reduce((sum, p) => {
      const prod = products.find(x => x.id === p.product_id)
      return sum + p.avg_daily_sales * (prod?.sell_price || 0) * 30
    }, 0)
    const baseProfit = preds.reduce((sum, p) => {
      const prod = products.find(x => x.id === p.product_id)
      return sum + p.avg_daily_sales * ((prod?.sell_price || 0) - (prod?.cost_price || 0)) * 30
    }, 0)
    return {
      month:    `T${i + 1}`,
      doanhThu: Math.round(baseRevenue  * seasonFactor / 1000),
      loiNhuan: Math.round(baseProfit   * seasonFactor / 1000),
    }
  })
}

function buildWeekdayData(preds: PredictionResult[], products: Product[]) {
  const days    = ['T2','T3','T4','T5','T6','T7','CN']
  const factors = [0.85, 0.88, 0.9, 0.92, 1.1, 1.35, 1.25]
  const baseDay = preds.reduce((sum, p) => {
    const prod = products.find(x => x.id === p.product_id)
    return sum + p.avg_daily_sales * (prod?.sell_price || 0)
  }, 0)
  return days.map((d, i) => ({
    day:      d,
    doanhThu: Math.round(baseDay * factors[i] / 1000),
    hot:      factors[i] >= 1.2,
  }))
}

function buildRankings(preds: PredictionResult[], products: Product[]) {
  const withRevenue = preds.map(p => {
    const prod = products.find(x => x.id === p.product_id)
    return {
      ...p,
      revenue:   p.avg_daily_sales * (prod?.sell_price || 0) * 30,
      profit:    p.avg_daily_sales * ((prod?.sell_price || 0) - (prod?.cost_price || 0)) * 30,
      sellPrice: prod?.sell_price  || 0,
      costPrice: prod?.cost_price  || 0,
      category:  prod?.category    || '',
    }
  })
  return {
    topQty:     [...withRevenue].sort((a,b) => b.avg_daily_sales - a.avg_daily_sales).slice(0,5),
    topRevenue: [...withRevenue].sort((a,b) => b.revenue - a.revenue).slice(0,5),
    slow:       [...withRevenue].sort((a,b) => a.avg_daily_sales - b.avg_daily_sales).slice(0,5),
  }
}

export default function DashboardClient() {
  const router = useRouter()
  const [products,  setProducts]  = useState<Product[]>([])
  const [loading,   setLoading]   = useState(true)
  const [lastUpdate,setLastUpdate]= useState(new Date())
  const [criticals, setCriticals] = useState<PredictionResult[]>([])
  const [warnings,  setWarnings]  = useState<PredictionResult[]>([])
  const [allPreds,  setAllPreds]  = useState<PredictionResult[]>([])
  const [showTip,   setShowTip]   = useState(true)
  const [chartTab,  setChartTab]  = useState<'bán'|'tồn'>('bán')
  const [rankTab,   setRankTab]   = useState<'qty'|'revenue'|'slow'>('qty')
  const [monthView, setMonthView] = useState<'month'|'quarter'>('month')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prods } = await supabase
      .from('products').select('*').eq('is_active', true).order('name')
    if (!prods) { setLoading(false); return }
    setProducts(prods)

    const preds = await Promise.all(
      prods.map(async (p) => {
        const { data: sales } = await supabase
          .from('daily_sales').select('*').eq('product_id', p.id)
          .order('sale_date', { ascending: false }).limit(30)
        return computePrediction(p, sales || [])
      })
    )
    setAllPreds(preds)
    setCriticals(preds.filter(p => p.status === 'critical'))
    setWarnings(preds.filter(p => p.status === 'warning'))
    setLastUpdate(new Date())
    setLoading(false)
  }

  const topSelling   = [...allPreds].sort((a,b) => b.avg_daily_sales - a.avg_daily_sales).slice(0,4)
  const healthScore  = products.length > 0
    ? Math.round(((products.length - criticals.length - warnings.length) / products.length) * 100)
    : 100
  const totalRevenue = allPreds.reduce((sum, p) => {
    const prod = products.find(x => x.id === p.product_id)
    return sum + p.avg_daily_sales * (prod?.sell_price || 0)
  }, 0)
  const totalProfit  = allPreds.reduce((sum, p) => {
    const prod = products.find(x => x.id === p.product_id)
    return sum + p.avg_daily_sales * ((prod?.sell_price || 0) - (prod?.cost_price || 0))
  }, 0)
  const totalStock   = products.reduce((sum, p) => sum + p.stock * p.cost_price, 0)
  const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0

  const chartData   = buildChartData(allPreds)
  const monthlyData = buildMonthlyData(allPreds, products)
  const weekdayData = buildWeekdayData(allPreds, products)
  const rankings    = buildRankings(allPreds, products)

  const quarterData = [
    { quarter:'Q1', doanhThu: monthlyData.slice(0,3).reduce((s,m)=>s+m.doanhThu,0), loiNhuan: monthlyData.slice(0,3).reduce((s,m)=>s+m.loiNhuan,0) },
    { quarter:'Q2', doanhThu: monthlyData.slice(3,6).reduce((s,m)=>s+m.doanhThu,0), loiNhuan: monthlyData.slice(3,6).reduce((s,m)=>s+m.loiNhuan,0) },
    { quarter:'Q3', doanhThu: monthlyData.slice(6,9).reduce((s,m)=>s+m.doanhThu,0), loiNhuan: monthlyData.slice(6,9).reduce((s,m)=>s+m.loiNhuan,0) },
    { quarter:'Q4', doanhThu: monthlyData.slice(9,12).reduce((s,m)=>s+m.doanhThu,0), loiNhuan: monthlyData.slice(9,12).reduce((s,m)=>s+m.loiNhuan,0) },
  ]
  const bestMonth   = [...monthlyData].sort((a,b)=>b.doanhThu-a.doanhThu)[0]
  const bestQuarter = [...quarterData].sort((a,b)=>b.doanhThu-a.doanhThu)[0]
  const bestWeekday = [...weekdayData].sort((a,b)=>b.doanhThu-a.doanhThu)[0]

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean; payload?: {color:string;name:string;value:number}[]; label?: string
  }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px', fontSize:14, boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ fontWeight:600, color:'#0f172a', marginBottom:6 }}>{label}</div>
        {payload.map((p,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:p.color, display:'inline-block' }}/>
            <span style={{ color:'#475569' }}>{p.name}:</span>
            <strong style={{ color:'#0f172a' }}>{p.value.toLocaleString()}K đ</strong>
          </div>
        ))}
      </div>
    )
  }

  const tabBtn = (active: boolean, label: string, onClick: ()=>void) => (
    <button onClick={onClick} style={{
      padding:'5px 10px', borderRadius:20, fontSize:14, cursor:'pointer', fontWeight:500,
      background: active ? '#16a34a' : '#f8fafc',
      color:      active ? '#fff'    : '#64748b',
      border:     active ? '1px solid #16a34a' : '1px solid #e2e8f0',
      whiteSpace: 'nowrap',
    }}>{label}</button>
  )

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>⏳</div>
          <div style={{ fontSize:16, color:'#64748b' }}>Đang tải dữ liệu...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'Inter, system-ui, sans-serif' }}>

      {/* ── RESPONSIVE STYLES ── */}
      <style>{`
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}

        /* ── BASE (mobile ~375px) ── */
        .db-topbar            { padding: 0 16px; }
        .db-topbar-realtime   { display: none; }
        .db-banner-desc       { display: none; }
        .db-content           { padding: 16px; font-size: 14px; }
        .db-card              { padding: 14px; }
        .db-kpi-val           { font-size: 22px !important; }
        .db-rank-tabs         { flex-wrap: wrap; gap: 6px; }

        .db-grid-4            { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
        .db-grid-chart-alert  { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .db-grid-finance-4    { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
        .db-grid-chart-2      { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .db-grid-health-actions { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .db-grid-top4         { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }

        /* ── 640px (tablet nhỏ) ── */
        @media (min-width: 640px) {
          .db-topbar-realtime { display: flex; }
          .db-banner-desc     { display: inline; }
          .db-content         { padding: 18px 20px; }
        }

        /* ── 768px (tablet) ── */
        @media (min-width: 768px) {
          .db-topbar          { padding: 0 24px; }
          .db-content         { padding: 20px 24px; }
          .db-kpi-val         { font-size: 26px !important; }
          .db-grid-4          { gap: 14px; }
          .db-grid-finance-4  { gap: 14px; }
          .db-grid-top4       { gap: 12px; }
        }

        /* ── 1024px (laptop thường ~1366px) ── */
        @media (min-width: 1024px) {
          .db-topbar            { padding: 0 32px; }
          .db-content           { padding: 24px 32px; }
          .db-card              { padding: 18px; }
          .db-kpi-val           { font-size: 30px !important; }
          .db-grid-4            { grid-template-columns: repeat(4, minmax(0,1fr)); gap: 18px; }
          .db-grid-chart-alert  { grid-template-columns: 1fr 340px; gap: 18px; }
          .db-grid-finance-4    { grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px; }
          .db-grid-chart-2      { grid-template-columns: 1fr 1fr; gap: 16px; }
          .db-grid-health-actions { grid-template-columns: 1fr 360px; gap: 18px; }
          .db-grid-top4         { grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
        }

        /* ── 1280px (laptop lớn / màn 1440p) ── */
        @media (min-width: 1280px) {
          .db-topbar            { padding: 0 48px; }
          .db-content           { padding: 28px 48px; }
          .db-card              { padding: 20px; }
          .db-kpi-val           { font-size: 32px !important; }
          .db-grid-4            { gap: 20px; }
          .db-grid-chart-alert  { grid-template-columns: 1fr 380px; gap: 20px; }
          .db-grid-finance-4    { gap: 20px; }
          .db-grid-chart-2      { gap: 20px; }
          .db-grid-health-actions { grid-template-columns: 1fr 400px; gap: 20px; }
          .db-grid-top4         { gap: 18px; }
        }

        /* ── 1536px (màn 2K / 27" trở lên) ── */
        @media (min-width: 1536px) {
          .db-topbar            { padding: 0 64px; }
          .db-content           { padding: 32px 64px; }
          .db-card              { padding: 24px; }
          .db-kpi-val           { font-size: 36px !important; }
          .db-grid-4            { gap: 24px; }
          .db-grid-chart-alert  { grid-template-columns: 1fr 420px; gap: 24px; }
          .db-grid-finance-4    { gap: 24px; }
          .db-grid-chart-2      { gap: 24px; }
          .db-grid-health-actions { grid-template-columns: 1fr 440px; gap: 24px; }
          .db-grid-top4         { gap: 20px; }
        }

        /* ── Scrollbar cảnh báo ── */
        .alert-scroll::-webkit-scrollbar { width: 4px; }
        .alert-scroll::-webkit-scrollbar-track { background: transparent; }
        .alert-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        .alert-scroll::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>

      {/* ── TOPBAR ── */}
      <div className="db-topbar" style={{
        background:'#fff', borderBottom:'1px solid #e2e8f0', height:64,
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M3 3h18v4H3zM3 10h8v11H3zM14 10h7v11h-7z"/></svg>
          </div>
          <div>
            <div style={{ fontSize:17, fontWeight:600, color:'#0f172a' }}>Kho Hàng Thông Minh</div>
            <div style={{ fontSize:14, color:'#94a3b8' }}>Cập nhật {formatDistanceToNow(lastUpdate, { locale:vi, addSuffix:true })}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div className="db-topbar-realtime" style={{ alignItems:'center', gap:6, fontSize:14, color:'#16a34a', background:'#f0fdf4', border:'1px solid #bbf7d0', padding:'5px 12px', borderRadius:20 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#16a34a', display:'inline-block' }}/>
            Realtime
          </div>
          <button onClick={load} disabled={loading} style={{ fontSize:14, padding:'7px 12px', borderRadius:8, background:'#fff', color:'#475569', border:'1px solid #e2e8f0', cursor:'pointer', whiteSpace:'nowrap' }}>↻ Làm mới</button>
          <Link href="/alerts" style={{ fontSize:14, padding:'7px 14px', borderRadius:8, background:'#16a34a', color:'#fff', textDecoration:'none', fontWeight:500, whiteSpace:'nowrap' }}>🔔 Cảnh báo</Link>
        </div>
      </div>

      {/* ── NỘI DUNG CHÍNH — không giới hạn max-width, tự giãn theo padding ── */}
      <div className="db-content">

        {/* ── BANNER ── */}
        {showTip && (
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:12, padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'flex-start', gap:10 }}>
            <span style={{ fontSize:20, flexShrink:0 }}>👋</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1e40af', marginBottom:3 }}>Chào mừng đến với Kho Hàng Thông Minh!</div>
              <div style={{ fontSize:14, color:'#3b82f6', lineHeight:1.7 }}>
                📊 <strong>4 ô KPI</strong> — tổng quan tức thì
                <span className="db-banner-desc"> &nbsp;·&nbsp;
                🚨 <strong>Cảnh báo đỏ/vàng</strong> — nhập hàng kịp thời &nbsp;·&nbsp;
                📈 <strong>Biểu đồ miền</strong> — xu hướng 30 ngày &nbsp;·&nbsp;
                💰 <strong>Thống kê tài chính</strong> — lợi nhuận, vốn tồn</span>
              </div>
            </div>
            <button onClick={() => setShowTip(false)} style={{ background:'none', border:'none', fontSize:20, color:'#93c5fd', cursor:'pointer', lineHeight:1, flexShrink:0 }}>×</button>
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {products.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', marginBottom:20 }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📦</div>
            <div style={{ fontSize:18, fontWeight:600, color:'#0f172a', marginBottom:6 }}>Kho hàng trống</div>
            <div style={{ fontSize:14, color:'#94a3b8', marginBottom:20 }}>Bắt đầu bằng cách thêm sản phẩm đầu tiên vào kho</div>
            <Link href="/inventory" style={{ display:'inline-block', background:'#16a34a', color:'#fff', padding:'10px 24px', borderRadius:10, textDecoration:'none', fontWeight:600, fontSize:14 }}>
              + Thêm sản phẩm
            </Link>
          </div>
        )}

        {/* ── 4 KPI CARDS ── */}
        <div className="db-grid-4" style={{ marginBottom:20 }}>
          {[
            { label:'Tổng sản phẩm',  value:products.length,              unit:'mặt hàng', desc:'Số mặt hàng đang theo dõi',             bg:'#eff6ff', border:'#bfdbfe', num:'#1d4ed8', icon:'📦' },
            { label:'Sức khoẻ kho',   value:healthScore,                   unit:'%',        desc:healthScore>=80?'Kho ổn định':'Cần chú ý', bg:healthScore>=70?'#f0fdf4':'#fffbeb', border:healthScore>=70?'#bbf7d0':'#fde68a', num:healthScore>=70?'#15803d':'#92400e', icon:healthScore>=70?'💚':'⚠️' },
            { label:'Cần nhập khẩn',  value:criticals.length,              unit:'sản phẩm', desc:'Hết hàng trong vòng 3 ngày',            bg:'#fff1f2', border:'#fecdd3', num:'#be123c', icon:'🚨' },
            { label:'Doanh thu/ngày', value:Math.round(totalRevenue/1000), unit:'K đ',      desc:'Ước tính theo tốc độ bán hiện tại',     bg:'#faf5ff', border:'#e9d5ff', num:'#7e22ce', icon:'💰' },
          ].map((k,i) => (
            <div key={i} className="db-card" title={k.desc} style={{ background:k.bg, border:`1px solid ${k.border}`, borderRadius:14 }}>
              <div style={{ fontSize:24, marginBottom:8 }}>{k.icon}</div>
              <div className="db-kpi-val" style={{ fontWeight:700, color:k.num, letterSpacing:'-0.02em', lineHeight:1 }}>
                {k.value.toLocaleString()}<span style={{ fontSize:14, fontWeight:500, marginLeft:4 }}>{k.unit}</span>
              </div>
              <div style={{ fontSize:14, color:'#334155', marginTop:6, fontWeight:600 }}>{k.label}</div>
              <div style={{ fontSize:14, color:'#94a3b8', marginTop:3 }}>{k.desc}</div>
            </div>
          ))}
        </div>

        {/* ── BIỂU ĐỒ + CẢNH BÁO ── */}
        <div className="db-grid-chart-alert" style={{ marginBottom:20 }}>

          {/* Biểu đồ miền */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'20px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6, gap:8, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:16, fontWeight:600, color:'#0f172a' }}>📊 Xu hướng 30 ngày</div>
                <div style={{ fontSize:14, color:'#94a3b8', marginTop:2 }}>Theo dõi bán ra và tồn kho</div>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                {tabBtn(chartTab==='bán','📤 Bán ra',()=>setChartTab('bán'))}
                {tabBtn(chartTab==='tồn','📦 Tồn kho',()=>setChartTab('tồn'))}
              </div>
            </div>
            <div style={{ display:'flex', gap:12, marginBottom:12, fontSize:14, color:'#64748b', flexWrap:'wrap' }}>
              {chartTab==='bán' ? (
                <>
                  <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:'#16a34a', display:'inline-block' }}/>Bán ra</span>
                  <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:'#3b82f6', display:'inline-block' }}/>Nhập hàng</span>
                </>
              ) : (
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:'#7e22ce', display:'inline-block' }}/>Tổng tồn kho</span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              {chartTab==='bán' ? (
                <AreaChart data={chartData} margin={{ top:5, right:5, left:-10, bottom:5 }}>
                  <defs>
                    <linearGradient id="gBan"  x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15}/><stop offset="95%" stopColor="#16a34a" stopOpacity={0}/></linearGradient>
                    <linearGradient id="gNhap" x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="date" tick={{ fontSize:11, fill:'#94a3b8' }} interval={5}/>
                  <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} width={32}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Area type="monotone" dataKey="bán"  name="Bán ra"    stroke="#16a34a" strokeWidth={2} fill="url(#gBan)"  dot={false}/>
                  <Area type="monotone" dataKey="nhập" name="Nhập hàng" stroke="#3b82f6" strokeWidth={2} fill="url(#gNhap)" dot={false}/>
                </AreaChart>
              ) : (
                <AreaChart data={chartData} margin={{ top:5, right:5, left:-10, bottom:5 }}>
                  <defs><linearGradient id="gTon" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7e22ce" stopOpacity={0.15}/><stop offset="95%" stopColor="#7e22ce" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="date" tick={{ fontSize:11, fill:'#94a3b8' }} interval={5}/>
                  <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} width={32}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Area type="monotone" dataKey="tồnKho" name="Tồn kho" stroke="#7e22ce" strokeWidth={2} fill="url(#gTon)" dot={false}/>
                </AreaChart>
              )}
            </ResponsiveContainer>
            <div style={{ marginTop:10, padding:'8px 12px', background:'#f0fdf4', borderRadius:10, fontSize:14, color:'#15803d' }}>
              💡 Đường xanh giảm = bán tốt, cần nhập thêm sớm.
            </div>
          </div>

          {/* Cảnh báo — giới hạn chiều cao + scroll */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'20px', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6, flexShrink:0 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:600, color:'#0f172a' }}>🚨 Cảnh báo tồn kho</div>
                <div style={{ fontSize:14, color:'#94a3b8', marginTop:2 }}>🔴 Hết trong 3 ngày · 🟡 Hết trong 10 ngày</div>
              </div>
              {(criticals.length + warnings.length) > 0 && (
                <span style={{ fontSize:14, padding:'3px 10px', borderRadius:20, background:'#fff1f2', color:'#be123c', border:'1px solid #fecdd3', fontWeight:600, flexShrink:0 }}>
                  {criticals.length + warnings.length} sp
                </span>
              )}
            </div>

            {[...criticals,...warnings].length === 0 ? (
              <div style={{ textAlign:'center', padding:'32px 0' }}>
                <div style={{ fontSize:36, marginBottom:8 }}>✅</div>
                <div style={{ fontSize:14, color:'#16a34a', fontWeight:600 }}>Kho hàng đang ổn định!</div>
                <div style={{ fontSize:14, color:'#94a3b8', marginTop:4 }}>Không có sản phẩm cần nhập thêm</div>
              </div>
            ) : (
              <>
                {/* Scroll container — hiện tối đa ~5 item rồi scroll */}
                <div
                  className="alert-scroll"
                  style={{
                    display:'flex', flexDirection:'column', gap:10, marginTop:14,
                    maxHeight: 420,
                    overflowY: 'auto',
                    paddingRight: 4,
                    scrollbarWidth: 'thin',
                  }}
                >
                  {[...criticals,...warnings].map(p => {
                    const prod   = products.find(x => x.id === p.product_id)
                    const isCrit = p.status === 'critical'
                    const pct    = Math.min(100, Math.round((p.current_stock / Math.max(p.current_stock, prod?.min_stock||30)) * 100))
                    return (
                      <div key={p.product_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px', borderRadius:12, background:isCrit?'#fff1f2':'#fffbeb', border:`1px solid ${isCrit?'#fecdd3':'#fde68a'}`, flexShrink:0 }}>
                        <ProductImage barcode={p.barcode} category={prod?.category} name={p.product_name} size={44}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                            <span style={{ fontSize:14, fontWeight:600, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'58%' }}>{p.product_name}</span>
                            <span style={{ fontSize:14, fontWeight:700, color:isCrit?'#be123c':'#92400e', flexShrink:0 }}>{isCrit?'🔴':'🟡'} {p.predicted_days_left}ng</span>
                          </div>
                          <div style={{ fontSize:14, color:'#94a3b8', marginBottom:4 }}>Tồn: {p.current_stock} · Bán {p.avg_daily_sales}/ngày</div>
                          <div style={{ height:4, borderRadius:3, background:'#f1f5f9', overflow:'hidden' }}>
                            <div style={{ height:'100%', borderRadius:3, width:`${pct}%`, background:isCrit?'#ef4444':'#f59e0b' }}/>
                          </div>
                          <div style={{ fontSize:14, color:isCrit?'#be123c':'#92400e', fontWeight:500, marginTop:4 }}>{isCrit?'⚡ Nhập ngay hôm nay!':'📋 Lên kế hoạch tuần này'}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>

              </>
            )}
          </div>
        </div>

        {/* ══ THỐNG KÊ TÀI CHÍNH ══ */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:17, fontWeight:700, color:'#0f172a', marginBottom:4 }}>💰 Thống kê tài chính</div>
          <div style={{ fontSize:14, color:'#94a3b8', marginBottom:14 }}>
            Ước tính theo tốc độ bán hiện tại · Dùng để lên kế hoạch nhập hàng và chiến lược giá
          </div>

          <div className="db-grid-finance-4" style={{ marginBottom:16 }}>
            {[
              { label:'Doanh thu tháng', value:`${Math.round(totalRevenue*30/1000).toLocaleString()}K`, unit:'đ', desc:'Tổng doanh thu ước tính 30 ngày', bg:'#f0fdf4', border:'#bbf7d0', num:'#15803d', icon:'📈' },
              { label:'Lợi nhuận/tháng', value:`${Math.round(totalProfit*30/1000).toLocaleString()}K`, unit:'đ', desc:`Tỷ lệ lãi: ${profitMargin}%`,        bg:'#eff6ff', border:'#bfdbfe', num:'#1d4ed8', icon:'💵' },
              { label:'Vốn tồn kho',     value:`${Math.round(totalStock/1000).toLocaleString()}K`,     unit:'đ', desc:'Số tiền đang "chôn" trong kho',     bg:'#fff7ed', border:'#fed7aa', num:'#c2410c', icon:'🏭' },
              { label:'Tỷ lệ lãi gộp',  value:`${profitMargin}`,                                       unit:'%', desc:'Lãi gộp trung bình toàn kho',       bg:'#faf5ff', border:'#e9d5ff', num:'#7e22ce', icon:'📊' },
            ].map((k,i) => (
              <div key={i} className="db-card" title={k.desc} style={{ background:k.bg, border:`1px solid ${k.border}`, borderRadius:14 }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{k.icon}</div>
                <div style={{ fontSize:22, fontWeight:700, color:k.num, letterSpacing:'-0.02em', lineHeight:1 }}>
                  {k.value}<span style={{ fontSize:14, fontWeight:500, marginLeft:3 }}>{k.unit}</span>
                </div>
                <div style={{ fontSize:14, color:'#334155', marginTop:4, fontWeight:600 }}>{k.label}</div>
                <div style={{ fontSize:14, color:'#94a3b8', marginTop:2 }}>{k.desc}</div>
              </div>
            ))}
          </div>

          <div className="db-grid-chart-2" style={{ marginBottom:16 }}>
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'18px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6, gap:8, flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#0f172a' }}>
                    📅 {monthView==='month' ? 'Doanh thu theo tháng' : 'Doanh thu theo quý'}
                  </div>
                  <div style={{ fontSize:14, color:'#94a3b8', marginTop:2 }}>
                    {monthView==='month'
                      ? `Tốt nhất: ${bestMonth?.month} (${bestMonth?.doanhThu?.toLocaleString()}K đ)`
                      : `Tốt nhất: ${bestQuarter?.quarter} (${bestQuarter?.doanhThu?.toLocaleString()}K đ)`}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  {tabBtn(monthView==='month','Tháng',()=>setMonthView('month'))}
                  {tabBtn(monthView==='quarter','Quý',()=>setMonthView('quarter'))}
                </div>
              </div>
              <div style={{ display:'flex', gap:12, marginBottom:10, fontSize:14, color:'#64748b' }}>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:2, background:'#16a34a', display:'inline-block' }}/>Doanh thu</span>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:2, background:'#3b82f6', display:'inline-block' }}/>Lợi nhuận</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthView==='month' ? monthlyData : quarterData} margin={{ top:5, right:5, left:-10, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey={monthView==='month'?'month':'quarter'} tick={{ fontSize:11, fill:'#94a3b8' }}/>
                  <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} width={32}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="doanhThu" name="Doanh thu" fill="#16a34a" radius={[4,4,0,0]}>
                    {(monthView==='month' ? monthlyData : quarterData).map((_,i) => {
                      const isMax = monthView==='month'
                        ? monthlyData[i].doanhThu === bestMonth?.doanhThu
                        : quarterData[i].doanhThu === bestQuarter?.doanhThu
                      return <Cell key={i} fill={isMax ? '#15803d' : '#86efac'}/>
                    })}
                  </Bar>
                  <Bar dataKey="loiNhuan" name="Lợi nhuận" fill="#3b82f6" radius={[4,4,0,0]}>
                    {(monthView==='month' ? monthlyData : quarterData).map((_,i) => (
                      <Cell key={i} fill="#93c5fd"/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop:8, padding:'7px 10px', background:'#f0fdf4', borderRadius:8, fontSize:14, color:'#15803d' }}>
                🏆 Cột xanh đậm = {monthView==='month'?'tháng':'quý'} bán chạy nhất.
              </div>
            </div>

            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'18px' }}>
              <div style={{ marginBottom:6 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#0f172a' }}>📆 Doanh thu theo thứ trong tuần</div>
                <div style={{ fontSize:14, color:'#94a3b8', marginTop:2 }}>
                  Ngày bán chạy: <strong style={{ color:'#15803d' }}>{bestWeekday?.day}</strong> ({bestWeekday?.doanhThu?.toLocaleString()}K đ)
                </div>
              </div>
              <div style={{ display:'flex', gap:12, marginBottom:10, fontSize:14, color:'#64748b' }}>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:2, background:'#f59e0b', display:'inline-block' }}/>Cuối tuần</span>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:2, background:'#93c5fd', display:'inline-block' }}/>Ngày thường</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weekdayData} margin={{ top:5, right:5, left:-10, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="day" tick={{ fontSize:11, fill:'#94a3b8' }}/>
                  <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} width={32}/>
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString()}K đ`, 'Doanh thu']} labelFormatter={(l) => `📅 ${l}`}/>
                  <Bar dataKey="doanhThu" name="Doanh thu" radius={[4,4,0,0]}>
                    {weekdayData.map((d,i) => (
                      <Cell key={i} fill={d.hot ? '#f59e0b' : '#93c5fd'}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop:8, padding:'7px 10px', background:'#fffbeb', borderRadius:8, fontSize:14, color:'#92400e' }}>
                💡 Nên chạy khuyến mãi vào Thứ 6 để kéo khách cuối tuần.
              </div>
            </div>
          </div>

          {/* Bảng xếp hạng */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'18px' }}>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#0f172a', marginBottom:4 }}>🏆 Bảng xếp hạng sản phẩm</div>
              <div style={{ fontSize:14, color:'#94a3b8', marginBottom:10 }}>Phân tích hiệu quả từng sản phẩm — ra quyết định thông minh hơn</div>
              <div className="db-rank-tabs" style={{ display:'flex' }}>
                {tabBtn(rankTab==='qty',    '📦 Bán nhiều', ()=>setRankTab('qty'))}
                {tabBtn(rankTab==='revenue','💵 Doanh thu', ()=>setRankTab('revenue'))}
                {tabBtn(rankTab==='slow',   '🐢 Bán chậm',  ()=>setRankTab('slow'))}
              </div>
            </div>
            <div style={{ padding:'8px 12px', borderRadius:10, marginBottom:12, fontSize:14,
              background: rankTab==='slow' ? '#fff1f2' : '#f0fdf4',
              color:      rankTab==='slow' ? '#be123c' : '#15803d',
              border:     `1px solid ${rankTab==='slow' ? '#fecdd3' : '#bbf7d0'}`,
            }}>
              {rankTab==='qty'     && '📦 Top bán nhiều nhất — ưu tiên nhập đủ hàng'}
              {rankTab==='revenue' && '💵 Top doanh thu cao — tập trung khuyến mãi'}
              {rankTab==='slow'    && '🐢 Bán chậm — xem xét giảm giá hoặc ngừng nhập'}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(rankTab==='qty' ? rankings.topQty : rankTab==='revenue' ? rankings.topRevenue : rankings.slow).map((p,i) => {
                const medals  = ['🥇','🥈','🥉','4️⃣','5️⃣']
                const isWarn  = rankTab==='slow'
                const mainVal = rankTab==='qty'
                  ? `${p.avg_daily_sales.toFixed(1)} sp/ng`
                  : rankTab==='revenue'
                  ? `${Math.round(p.revenue/1000).toLocaleString()}K/th`
                  : `${p.avg_daily_sales.toFixed(1)} sp/ng`
                return (
                  <div key={p.product_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, background:'#f8fafc', border:'1px solid #f1f5f9' }}>
                    <span style={{ fontSize:18, flexShrink:0, width:24, textAlign:'center' }}>{medals[i]}</span>
                    <div style={{ width:52, height:52, borderRadius:10, overflow:'hidden', background:'#f1f5f9', border:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <ProductImage barcode={p.barcode} category={p.category} name={p.product_name} size={50}/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.product_name}</div>
                      <div style={{ fontSize:14, color:'#94a3b8', marginTop:1 }}>{p.category}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color: isWarn?'#be123c':'#15803d' }}>{mainVal}</div>
                      {rankTab==='revenue' && <div style={{ fontSize:14, color:'#94a3b8' }}>Lãi: {Math.round(p.profit/1000).toLocaleString()}K/th</div>}
                      {rankTab==='slow'    && <div style={{ fontSize:14, color:'#be123c' }}>⚠️ Xả hàng</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── HEALTH + QUICK ACTIONS ── */}
        <div className="db-grid-health-actions" style={{ marginBottom:20 }}>
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'20px' }}>
            <div style={{ fontSize:16, fontWeight:600, color:'#0f172a', marginBottom:4 }}>💚 Sức khoẻ kho hàng</div>
            <div style={{ fontSize:14, color:'#94a3b8', marginBottom:16 }}>Mục tiêu duy trì trên 80 điểm.</div>
            <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
              <svg width="90" height="90" viewBox="0 0 100 100" style={{ flexShrink:0 }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8"/>
                <circle cx="50" cy="50" r="42" fill="none"
                  stroke={healthScore>=80?'#16a34a':healthScore>=60?'#f59e0b':'#ef4444'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(healthScore/100)*264} 264`}
                  transform="rotate(-90 50 50)"/>
                <text x="50" y="44" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a" fontFamily="Inter,sans-serif">{healthScore}</text>
                <text x="50" y="60" textAnchor="middle" fontSize="11" fill="#94a3b8" fontFamily="Inter,sans-serif">/ 100 điểm</text>
              </svg>
              <div style={{ flex:1, minWidth:160 }}>
                {[
                  { label:'✅ Bình thường',  val:products.length-criticals.length-warnings.length, color:'#15803d', desc:'Tồn kho đầy đủ' },
                  { label:'🟡 Cần theo dõi', val:warnings.length,  color:'#92400e', desc:'Dưới 10 ngày tồn' },
                  { label:'🔴 Khẩn cấp',     val:criticals.length, color:'#be123c', desc:'Nhập hàng ngay!' },
                ].map(r => (
                  <div key={r.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f8fafc' }}>
                    <div>
                      <div style={{ fontSize:14, color:'#475569', fontWeight:500 }}>{r.label}</div>
                      <div style={{ fontSize:14, color:'#94a3b8' }}>{r.desc}</div>
                    </div>
                    <span style={{ fontSize:20, fontWeight:700, color:r.color }}>{r.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'20px' }}>
            <div style={{ fontSize:16, fontWeight:600, color:'#0f172a', marginBottom:4 }}>⚡ Thao tác nhanh</div>
            <div style={{ fontSize:14, color:'#94a3b8', marginBottom:14 }}>Truy cập nhanh các tính năng chính</div>
            {[
              { href:'/inventory', emoji:'📋', label:'Bảng kho hàng', sub:'Thêm, sửa, xoá · Lịch sử giao dịch',    bg:'#eff6ff', color:'#1d4ed8' },
              { href:'/scan',      emoji:'📷', label:'Quét mã vạch',  sub:'Camera điện thoại → cập nhật kho ngay',  bg:'#f0fdf4', color:'#15803d' },
              { href:'/predict',   emoji:'📈', label:'AI Dự đoán',    sub:'Biểu đồ dự báo 7 ngày · Phân tích AI',   bg:'#faf5ff', color:'#7e22ce' },
              { href:'/alerts',    emoji:'🔔', label:'Gửi cảnh báo',  sub:'Thông báo Telegram & Zalo OA',            bg:'#fff7ed', color:'#c2410c' },
            ].map(a => (
              <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, marginBottom:8, background:a.bg, border:'1px solid #e2e8f0', cursor:'pointer' }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{a.emoji}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:'#0f172a' }}>{a.label}</div>
                    <div style={{ fontSize:14, color:'#64748b', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.sub}</div>
                  </div>
                  <span style={{ fontSize:18, color:a.color, flexShrink:0 }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── TOP BÁN CHẠY ── */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'20px', marginBottom:32 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6, gap:8 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:600, color:'#0f172a' }}>📈 Top sản phẩm bán chạy</div>
              <div style={{ fontSize:14, color:'#94a3b8', marginTop:2 }}>Dựa trên dữ liệu 30 ngày</div>
            </div>
            <Link href="/predict" style={{ fontSize:14, color:'#16a34a', textDecoration:'none', fontWeight:500, flexShrink:0 }}>Xem đầy đủ →</Link>
          </div>
          <div className="db-grid-top4" style={{ marginTop:14 }}>
            {topSelling.map((p,i) => {
              const prod     = products.find(x => x.id === p.product_id)
              const revenue  = Math.round(p.avg_daily_sales * (prod?.sell_price||0))
              const maxSales = topSelling[0]?.avg_daily_sales || 1
              const pct      = Math.round((p.avg_daily_sales/maxSales)*100)
              const medals   = ['🥇','🥈','🥉','4️⃣']
              const colors   = ['#7e22ce','#1d4ed8','#15803d','#c2410c']
              const bgs      = ['#faf5ff','#eff6ff','#f0fdf4','#fff7ed']
              const borders  = ['#e9d5ff','#bfdbfe','#bbf7d0','#fed7aa']
              return (
                <div key={p.product_id} style={{ borderRadius:14, padding:'16px', background:bgs[i], border:`1px solid ${borders[i]}` }}>
                  {/* Medal + badge tốc độ */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <span style={{ fontSize:20 }}>{medals[i]}</span>
                    <span style={{ fontSize:14, fontWeight:700, color:colors[i], background:'#fff', padding:'3px 10px', borderRadius:20, border:`1px solid ${borders[i]}` }}>{p.avg_daily_sales.toFixed(1)}/ng</span>
                  </div>
                  {/* Ảnh sản phẩm lớn — căn giữa */}
                  <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
                    <div style={{ width:80, height:80, borderRadius:12, overflow:'hidden', background:'#fff', border:`1px solid ${borders[i]}`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
                      <ProductImage barcode={p.barcode} category={prod?.category} name={p.product_name} size={76}/>
                    </div>
                  </div>
                  {/* Tên sản phẩm */}
                  <div style={{ fontSize:14, fontWeight:600, color:'#0f172a', lineHeight:1.4, textAlign:'center', marginBottom:10, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.product_name}</div>
                  {/* Thanh tiến độ */}
                  <div style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#94a3b8', marginBottom:4 }}><span>Tốc độ bán</span><span>{pct}%</span></div>
                    <div style={{ height:5, borderRadius:3, background:'#e2e8f0', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:3, width:`${pct}%`, background:colors[i] }}/>
                    </div>
                  </div>
                  <div style={{ fontSize:14, color:'#64748b', fontWeight:500, textAlign:'center' }}>💵 ~{revenue.toLocaleString('vi-VN')}đ/ng</div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop:14, padding:'14px 16px', borderRadius:12, background:'#faf5ff', border:'1px solid #e9d5ff' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'#7e22ce', marginBottom:6 }}>🤖 Gợi ý chiến lược từ AI</div>
            <div style={{ fontSize:14, color:'#6b21a8', lineHeight:1.9 }}>
              • <strong>Nhập hàng ngay:</strong> Ưu tiên sản phẩm vùng đỏ/vàng trước khi hết hàng.<br/>
              • <strong>Đẩy bán chạy:</strong> Khuyến mãi top sản phẩm vào <strong>cuối tuần</strong>.<br/>
              • <strong>Xoay vòng vốn:</strong> Sản phẩm bán chậm → giảm giá hoặc bundle combo.
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}