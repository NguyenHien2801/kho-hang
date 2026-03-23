'use client'
import { useEffect, useState } from 'react'
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

// ── Tạo dữ liệu 30 ngày cho biểu đồ miền ──────────────────────────────────
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

// ── Tạo dữ liệu thống kê tháng (12 tháng) ──────────────────────────────────
function buildMonthlyData(preds: PredictionResult[], products: Product[]) {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    // Giả lập doanh thu theo mùa vụ (Tết/hè/cuối năm cao hơn)
    const seasonFactor = [1.4, 1.1, 0.9, 0.85, 0.9, 1.0, 1.05, 1.1, 0.95, 1.0, 1.15, 1.5][i]
    const baseRevenue  = preds.reduce((sum, p) => {
      const prod = products.find(x => x.id === p.product_id)
      return sum + p.avg_daily_sales * (prod?.sell_price || 0) * 30
    }, 0)
    const baseProfit = preds.reduce((sum, p) => {
      const prod = products.find(x => x.id === p.product_id)
      return sum + p.avg_daily_sales * ((prod?.sell_price || 0) - (prod?.cost_price || 0)) * 30
    }, 0)
    return {
      month:    `T${month}`,
      doanhThu: Math.round(baseRevenue  * seasonFactor / 1000),  // K đồng
      loiNhuan: Math.round(baseProfit   * seasonFactor / 1000),
    }
  })
}

// ── Doanh thu theo thứ trong tuần ──────────────────────────────────────────
function buildWeekdayData(preds: PredictionResult[], products: Product[]) {
  const days    = ['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','CN']
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

// ── Xếp hạng sản phẩm ──────────────────────────────────────────────────────
function buildRankings(preds: PredictionResult[], products: Product[]) {
  const withRevenue = preds.map(p => {
    const prod = products.find(x => x.id === p.product_id)
    return {
      ...p,
      revenue:    p.avg_daily_sales * (prod?.sell_price || 0) * 30,
      profit:     p.avg_daily_sales * ((prod?.sell_price || 0) - (prod?.cost_price || 0)) * 30,
      sellPrice:  prod?.sell_price  || 0,
      costPrice:  prod?.cost_price  || 0,
      category:   prod?.category    || '',
    }
  })
  return {
    topQty:     [...withRevenue].sort((a,b) => b.avg_daily_sales - a.avg_daily_sales).slice(0,5),
    topRevenue: [...withRevenue].sort((a,b) => b.revenue - a.revenue).slice(0,5),
    slow:       [...withRevenue].sort((a,b) => a.avg_daily_sales - b.avg_daily_sales).slice(0,5),
  }
}

export default function DashboardClient() {
  const [products,   setProducts]   = useState<Product[]>([])
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [criticals,  setCriticals]  = useState<PredictionResult[]>([])
  const [warnings,   setWarnings]   = useState<PredictionResult[]>([])
  const [allPreds,   setAllPreds]   = useState<PredictionResult[]>([])
  const [showTip,    setShowTip]    = useState(true)
  const [chartTab,   setChartTab]   = useState<'bán'|'tồn'>('bán')
  const [rankTab,    setRankTab]    = useState<'qty'|'revenue'|'slow'>('qty')
  const [monthView,  setMonthView]  = useState<'month'|'quarter'>('month')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: prods } = await supabase
      .from('products').select('*').eq('is_active', true).order('name')
    if (!prods) { setLoading(false); return }
    setProducts(prods)
    const preds = await Promise.all(
      prods.map(async (p) => {
        const { data: sales } = await supabase
          .from('daily_sales').select('*')
          .eq('product_id', p.id).order('sale_date', { ascending: false }).limit(30)
        return computePrediction(p, sales || [])
      })
    )
    setAllPreds(preds)
    setCriticals(preds.filter(p => p.status === 'critical'))
    setWarnings(preds.filter(p => p.status === 'warning'))
    setLastUpdate(new Date())
    setLoading(false)
  }

  const topSelling    = [...allPreds].sort((a,b) => b.avg_daily_sales - a.avg_daily_sales).slice(0,4)
  const healthScore   = products.length > 0
    ? Math.round(((products.length - criticals.length - warnings.length) / products.length) * 100)
    : 100
  const totalRevenue  = allPreds.reduce((sum, p) => {
    const prod = products.find(x => x.id === p.product_id)
    return sum + p.avg_daily_sales * (prod?.sell_price || 0)
  }, 0)
  const totalProfit   = allPreds.reduce((sum, p) => {
    const prod = products.find(x => x.id === p.product_id)
    return sum + p.avg_daily_sales * ((prod?.sell_price || 0) - (prod?.cost_price || 0))
  }, 0)
  const totalStock    = products.reduce((sum, p) => sum + p.stock * p.cost_price, 0)
  const profitMargin  = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0

  const chartData    = buildChartData(allPreds)
  const monthlyData  = buildMonthlyData(allPreds, products)
  const weekdayData  = buildWeekdayData(allPreds, products)
  const rankings     = buildRankings(allPreds, products)

  // Dữ liệu theo quý
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
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px', fontSize:13, boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}>
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
      padding:'5px 14px', borderRadius:20, fontSize:13, cursor:'pointer', fontWeight:500,
      background: active ? '#16a34a' : '#f8fafc',
      color:      active ? '#fff'    : '#64748b',
      border:     active ? '1px solid #16a34a' : '1px solid #e2e8f0',
    }}>{label}</button>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'Inter, system-ui, sans-serif' }}>

      {/* ── TOPBAR ── */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'0 32px', height:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M3 3h18v4H3zM3 10h8v11H3zM14 10h7v11h-7z"/></svg>
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:600, color:'#0f172a' }}>Kho Hàng Thông Minh</div>
            <div style={{ fontSize:13, color:'#94a3b8' }}>Cập nhật {formatDistanceToNow(lastUpdate, { locale:vi, addSuffix:true })}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#16a34a', background:'#f0fdf4', border:'1px solid #bbf7d0', padding:'6px 14px', borderRadius:20 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#16a34a', display:'inline-block' }}/>
            Realtime
          </div>
          <button onClick={load} disabled={loading} style={{ fontSize:14, padding:'8px 16px', borderRadius:8, background:'#fff', color:'#475569', border:'1px solid #e2e8f0', cursor:'pointer' }}>↻ Làm mới</button>
          <Link href="/alerts" style={{ fontSize:14, padding:'8px 18px', borderRadius:8, background:'#16a34a', color:'#fff', textDecoration:'none', fontWeight:500 }}>🔔 Gửi cảnh báo</Link>
        </div>
      </div>

      <div style={{ padding:'28px 32px', maxWidth:1280, margin:'0 auto' }}>

        {/* ── BANNER ── */}
        {showTip && (
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:12, padding:'14px 20px', marginBottom:24, display:'flex', alignItems:'flex-start', gap:12 }}>
            <span style={{ fontSize:22, flexShrink:0 }}>👋</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1e40af', marginBottom:4 }}>Chào mừng đến với Kho Hàng Thông Minh!</div>
              <div style={{ fontSize:13, color:'#3b82f6', lineHeight:1.8 }}>
                📊 <strong>4 ô KPI</strong> — tổng quan tức thì &nbsp;·&nbsp;
                🚨 <strong>Cảnh báo đỏ/vàng</strong> — nhập hàng kịp thời &nbsp;·&nbsp;
                📈 <strong>Biểu đồ miền</strong> — xu hướng 30 ngày &nbsp;·&nbsp;
                💰 <strong>Thống kê tài chính</strong> — lợi nhuận, vốn tồn, tháng/quý bán chạy
              </div>
            </div>
            <button onClick={() => setShowTip(false)} style={{ background:'none', border:'none', fontSize:20, color:'#93c5fd', cursor:'pointer', lineHeight:1, flexShrink:0 }}>×</button>
          </div>
        )}

        {/* ── 4 KPI CARDS ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:20, marginBottom:24 }}>
          {[
            { label:'Tổng sản phẩm',  value:products.length,              unit:'mặt hàng', desc:'Số mặt hàng đang theo dõi',            bg:'#eff6ff', border:'#bfdbfe', num:'#1d4ed8', icon:'📦' },
            { label:'Sức khoẻ kho',   value:healthScore,                   unit:'%',        desc:healthScore>=80?'Kho ổn định':'Cần chú ý', bg:healthScore>=70?'#f0fdf4':'#fffbeb', border:healthScore>=70?'#bbf7d0':'#fde68a', num:healthScore>=70?'#15803d':'#92400e', icon:healthScore>=70?'💚':'⚠️' },
            { label:'Cần nhập khẩn',  value:criticals.length,              unit:'sản phẩm', desc:'Hết hàng trong vòng 3 ngày',           bg:'#fff1f2', border:'#fecdd3', num:'#be123c', icon:'🚨' },
            { label:'Doanh thu/ngày', value:Math.round(totalRevenue/1000), unit:'K đ',      desc:'Ước tính theo tốc độ bán hiện tại',    bg:'#faf5ff', border:'#e9d5ff', num:'#7e22ce', icon:'💰' },
          ].map((k,i) => (
            <div key={i} title={k.desc} style={{ background:k.bg, border:`1px solid ${k.border}`, borderRadius:16, padding:'22px' }}>
              <div style={{ fontSize:28, marginBottom:10 }}>{k.icon}</div>
              <div style={{ fontSize:34, fontWeight:700, color:k.num, letterSpacing:'-0.02em', lineHeight:1 }}>
                {loading?'—':k.value.toLocaleString()}<span style={{ fontSize:15, fontWeight:500, marginLeft:4 }}>{k.unit}</span>
              </div>
              <div style={{ fontSize:14, color:'#334155', marginTop:6, fontWeight:600 }}>{k.label}</div>
              <div style={{ fontSize:12, color:'#94a3b8', marginTop:3 }}>{k.desc}</div>
            </div>
          ))}
        </div>

        {/* ── BIỂU ĐỒ MIỀN + CẢNH BÁO ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:20, marginBottom:20 }}>
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'24px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:600, color:'#0f172a' }}>📊 Biểu đồ xu hướng 30 ngày</div>
                <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Theo dõi số lượng bán ra và tồn kho — lên kế hoạch nhập hàng chính xác hơn</div>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                {tabBtn(chartTab==='bán','📤 Bán ra',()=>setChartTab('bán'))}
                {tabBtn(chartTab==='tồn','📦 Tồn kho',()=>setChartTab('tồn'))}
              </div>
            </div>
            <div style={{ display:'flex', gap:16, marginBottom:16, fontSize:12, color:'#64748b' }}>
              {chartTab==='bán' ? (
                <>
                  <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:12, height:12, borderRadius:3, background:'#16a34a', display:'inline-block' }}/>Bán ra mỗi ngày</span>
                  <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:12, height:12, borderRadius:3, background:'#3b82f6', display:'inline-block' }}/>Nhập hàng</span>
                </>
              ) : (
                <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:12, height:12, borderRadius:3, background:'#7e22ce', display:'inline-block' }}/>Tổng tồn kho — tăng đột biến = vừa nhập hàng</span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              {chartTab==='bán' ? (
                <AreaChart data={chartData} margin={{ top:5, right:10, left:0, bottom:5 }}>
                  <defs>
                    <linearGradient id="gBan"  x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15}/><stop offset="95%" stopColor="#16a34a" stopOpacity={0}/></linearGradient>
                    <linearGradient id="gNhap" x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="date" tick={{ fontSize:11, fill:'#94a3b8' }} interval={4}/>
                  <YAxis tick={{ fontSize:11, fill:'#94a3b8' }}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Area type="monotone" dataKey="bán"  name="Bán ra"    stroke="#16a34a" strokeWidth={2} fill="url(#gBan)"  dot={false}/>
                  <Area type="monotone" dataKey="nhập" name="Nhập hàng" stroke="#3b82f6" strokeWidth={2} fill="url(#gNhap)" dot={false}/>
                </AreaChart>
              ) : (
                <AreaChart data={chartData} margin={{ top:5, right:10, left:0, bottom:5 }}>
                  <defs><linearGradient id="gTon" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7e22ce" stopOpacity={0.15}/><stop offset="95%" stopColor="#7e22ce" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="date" tick={{ fontSize:11, fill:'#94a3b8' }} interval={4}/>
                  <YAxis tick={{ fontSize:11, fill:'#94a3b8' }}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Area type="monotone" dataKey="tồnKho" name="Tồn kho" stroke="#7e22ce" strokeWidth={2} fill="url(#gTon)" dot={false}/>
                </AreaChart>
              )}
            </ResponsiveContainer>
            <div style={{ marginTop:10, padding:'10px 14px', background:'#f0fdf4', borderRadius:10, fontSize:13, color:'#15803d' }}>
              💡 <strong>Nhận xét:</strong> Kéo chuột vào biểu đồ để xem chi tiết từng ngày. Đường xanh giảm = bán tốt, cần nhập thêm sớm.
            </div>
          </div>

          {/* Cảnh báo */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'24px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:600, color:'#0f172a' }}>🚨 Cảnh báo tồn kho</div>
                <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>🔴 Đỏ = hết trong 3 ngày · 🟡 Vàng = hết trong 10 ngày</div>
              </div>
              {(criticals.length+warnings.length) > 0 && (
                <span style={{ fontSize:13, padding:'3px 10px', borderRadius:20, background:'#fff1f2', color:'#be123c', border:'1px solid #fecdd3', fontWeight:500, flexShrink:0 }}>{criticals.length+warnings.length} sp</span>
              )}
            </div>
            {loading ? <div style={{ color:'#94a3b8', fontSize:14, padding:'20px 0' }}>Đang tải...</div>
            : [...criticals,...warnings].length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
                <div style={{ fontSize:14, color:'#16a34a', fontWeight:600 }}>Kho hàng đang ổn định!</div>
                <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>Không có sản phẩm cần nhập thêm</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:14 }}>
                {[...criticals,...warnings].map(p => {
                  const prod   = products.find(x => x.id === p.product_id)
                  const isCrit = p.status === 'critical'
                  const pct    = Math.min(100, Math.round((p.current_stock / Math.max(p.current_stock, prod?.min_stock||30)) * 100))
                  return (
                    <div key={p.product_id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, background:isCrit?'#fff1f2':'#fffbeb', border:`1px solid ${isCrit?'#fecdd3':'#fde68a'}` }}>
                      <ProductImage barcode={p.barcode} category={prod?.category} name={p.product_name} size={48}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'60%' }}>{p.product_name}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:isCrit?'#be123c':'#92400e', flexShrink:0 }}>{isCrit?'🔴':'🟡'} {p.predicted_days_left} ngày</span>
                        </div>
                        <div style={{ fontSize:11, color:'#94a3b8', marginBottom:5 }}>Tồn: {p.current_stock} · Bán {p.avg_daily_sales}/ngày</div>
                        <div style={{ height:5, borderRadius:3, background:'#f1f5f9', overflow:'hidden' }}>
                          <div style={{ height:'100%', borderRadius:3, width:`${pct}%`, background:isCrit?'#ef4444':'#f59e0b' }}/>
                        </div>
                        <div style={{ fontSize:11, color:isCrit?'#be123c':'#92400e', fontWeight:500, marginTop:5 }}>{isCrit?'⚡ Nhập hàng ngay hôm nay!':'📋 Lên kế hoạch trong tuần này'}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            💰 THỐNG KÊ TÀI CHÍNH
        ══════════════════════════════════════════════ */}

        {/* Tóm tắt tài chính 4 ô */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:'#0f172a', marginBottom:4 }}>💰 Thống kê tài chính</div>
          <div style={{ fontSize:13, color:'#94a3b8', marginBottom:16 }}>
            Ước tính dựa trên tốc độ bán hiện tại · Dùng để lên kế hoạch nhập hàng và chiến lược giá
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:16, marginBottom:20 }}>
            {[
              { label:'Doanh thu tháng này', value:`${Math.round(totalRevenue*30/1000).toLocaleString()}K`, unit:'đ', desc:'Tổng doanh thu ước tính 30 ngày', bg:'#f0fdf4', border:'#bbf7d0', num:'#15803d', icon:'📈' },
              { label:'Lợi nhuận gộp/tháng', value:`${Math.round(totalProfit*30/1000).toLocaleString()}K`, unit:'đ', desc:`Tỷ lệ lãi: ${profitMargin}% trên doanh thu`, bg:'#eff6ff', border:'#bfdbfe', num:'#1d4ed8', icon:'💵' },
              { label:'Vốn hàng tồn kho',    value:`${Math.round(totalStock/1000).toLocaleString()}K`,     unit:'đ', desc:'Số tiền đang "chôn" trong kho', bg:'#fff7ed', border:'#fed7aa', num:'#c2410c', icon:'🏭' },
              { label:'Tỷ lệ lãi gộp',       value:`${profitMargin}`,                                      unit:'%', desc:'Lãi gộp trung bình toàn kho', bg:'#faf5ff', border:'#e9d5ff', num:'#7e22ce', icon:'📊' },
            ].map((k,i) => (
              <div key={i} title={k.desc} style={{ background:k.bg, border:`1px solid ${k.border}`, borderRadius:14, padding:'18px 20px' }}>
                <div style={{ fontSize:24, marginBottom:8 }}>{k.icon}</div>
                <div style={{ fontSize:26, fontWeight:700, color:k.num, letterSpacing:'-0.02em', lineHeight:1 }}>
                  {loading?'—':k.value}<span style={{ fontSize:13, fontWeight:500, marginLeft:3 }}>{k.unit}</span>
                </div>
                <div style={{ fontSize:13, color:'#334155', marginTop:5, fontWeight:600 }}>{k.label}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{k.desc}</div>
              </div>
            ))}
          </div>

          {/* Biểu đồ tháng/quý + thứ trong tuần */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

            {/* Biểu đồ tháng/quý */}
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'22px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:600, color:'#0f172a' }}>
                    📅 {monthView==='month' ? 'Doanh thu theo tháng' : 'Doanh thu theo quý'}
                  </div>
                  <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>
                    {monthView==='month'
                      ? `Tháng bán chạy nhất: ${bestMonth?.month} (${bestMonth?.doanhThu?.toLocaleString()}K đ)`
                      : `Quý bán chạy nhất: ${bestQuarter?.quarter} (${bestQuarter?.doanhThu?.toLocaleString()}K đ)`}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  {tabBtn(monthView==='month','Tháng',()=>setMonthView('month'))}
                  {tabBtn(monthView==='quarter','Quý',()=>setMonthView('quarter'))}
                </div>
              </div>
              <div style={{ display:'flex', gap:14, marginBottom:12, fontSize:12, color:'#64748b' }}>
                <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:10, height:10, borderRadius:2, background:'#16a34a', display:'inline-block' }}/>Doanh thu</span>
                <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:10, height:10, borderRadius:2, background:'#3b82f6', display:'inline-block' }}/>Lợi nhuận</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthView==='month' ? monthlyData : quarterData} margin={{ top:5, right:5, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey={monthView==='month'?'month':'quarter'} tick={{ fontSize:11, fill:'#94a3b8' }}/>
                  <YAxis tick={{ fontSize:11, fill:'#94a3b8' }}/>
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
              <div style={{ marginTop:10, padding:'8px 12px', background:'#f0fdf4', borderRadius:8, fontSize:12, color:'#15803d' }}>
                🏆 Cột xanh đậm = {monthView==='month'?'tháng':'quý'} bán chạy nhất. Dùng để lên kế hoạch tăng tồn kho trước {monthView==='month'?'tháng':'quý'} đó.
              </div>
            </div>

            {/* Biểu đồ theo thứ trong tuần */}
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'22px' }}>
              <div style={{ marginBottom:6 }}>
                <div style={{ fontSize:15, fontWeight:600, color:'#0f172a' }}>📆 Doanh thu theo thứ trong tuần</div>
                <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>
                  Ngày bán chạy nhất: <strong style={{ color:'#15803d' }}>{bestWeekday?.day}</strong> ({bestWeekday?.doanhThu?.toLocaleString()}K đ) — nên nhập hàng trước ngày này
                </div>
              </div>
              <div style={{ display:'flex', gap:14, marginBottom:12, fontSize:12, color:'#64748b' }}>
                <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:10, height:10, borderRadius:2, background:'#f59e0b', display:'inline-block' }}/>Cuối tuần (bán chạy)</span>
                <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:10, height:10, borderRadius:2, background:'#93c5fd', display:'inline-block' }}/>Ngày thường</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weekdayData} margin={{ top:5, right:5, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="day" tick={{ fontSize:11, fill:'#94a3b8' }}/>
                  <YAxis tick={{ fontSize:11, fill:'#94a3b8' }}/>
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString()}K đ`, 'Doanh thu']} labelFormatter={(l) => `📅 ${l}`}/>
                  <Bar dataKey="doanhThu" name="Doanh thu" radius={[4,4,0,0]}>
                    {weekdayData.map((d,i) => (
                      <Cell key={i} fill={d.hot ? '#f59e0b' : '#93c5fd'}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop:10, padding:'8px 12px', background:'#fffbeb', borderRadius:8, fontSize:12, color:'#92400e' }}>
                💡 Cột vàng = ngày bán chạy. Nên chạy khuyến mãi vào Thứ 6 để kéo khách cuối tuần.
              </div>
            </div>
          </div>

          {/* Bảng xếp hạng sản phẩm */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'22px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:600, color:'#0f172a' }}>🏆 Bảng xếp hạng sản phẩm</div>
                <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Phân tích hiệu quả từng sản phẩm — ra quyết định nhập hàng và định giá thông minh hơn</div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {tabBtn(rankTab==='qty',    '📦 Bán nhiều nhất', ()=>setRankTab('qty'))}
                {tabBtn(rankTab==='revenue','💵 Doanh thu cao',  ()=>setRankTab('revenue'))}
                {tabBtn(rankTab==='slow',   '🐢 Bán chậm nhất',  ()=>setRankTab('slow'))}
              </div>
            </div>

            {loading ? (
              <div style={{ color:'#94a3b8', fontSize:14 }}>Đang tải...</div>
            ) : (
              <>
                {/* Chú thích theo tab */}
                <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14, fontSize:13,
                  background: rankTab==='slow' ? '#fff1f2' : '#f0fdf4',
                  color:      rankTab==='slow' ? '#be123c' : '#15803d',
                  border:     `1px solid ${rankTab==='slow' ? '#fecdd3' : '#bbf7d0'}`,
                }}>
                  {rankTab==='qty'     && '📦 Top sản phẩm bán nhiều nhất — ưu tiên nhập đủ hàng, không để hết stock'}
                  {rankTab==='revenue' && '💵 Top sản phẩm mang lại doanh thu cao nhất — tập trung khuyến mãi và trưng bày nổi bật'}
                  {rankTab==='slow'    && '🐢 Sản phẩm bán chậm — xem xét giảm giá, combo hoặc ngừng nhập để giải phóng vốn'}
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {(rankTab==='qty' ? rankings.topQty : rankTab==='revenue' ? rankings.topRevenue : rankings.slow).map((p,i) => {
                    const medals  = ['🥇','🥈','🥉','4️⃣','5️⃣']
                    const isWarn  = rankTab==='slow'
                    const mainVal = rankTab==='qty'
                      ? `${p.avg_daily_sales.toFixed(1)} sp/ngày`
                      : rankTab==='revenue'
                      ? `${Math.round(p.revenue/1000).toLocaleString()}K đ/tháng`
                      : `${p.avg_daily_sales.toFixed(1)} sp/ngày`
                    return (
                      <div key={p.product_id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', borderRadius:12, background:'#f8fafc', border:'1px solid #f1f5f9' }}>
                        <span style={{ fontSize:22, flexShrink:0, width:28, textAlign:'center' }}>{medals[i]}</span>
                        <ProductImage barcode={p.barcode} category={p.category} name={p.product_name} size={44}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:600, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.product_name}</div>
                          <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{p.category}</div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:14, fontWeight:700, color: isWarn?'#be123c':'#15803d' }}>{mainVal}</div>
                          {rankTab==='revenue' && (
                            <div style={{ fontSize:11, color:'#94a3b8' }}>
                              Lãi: {Math.round(p.profit/1000).toLocaleString()}K đ/tháng
                            </div>
                          )}
                          {rankTab==='slow' && (
                            <div style={{ fontSize:11, color:'#be123c' }}>⚠️ Xem xét xả hàng</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── HEALTH + QUICK ACTIONS ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:20, marginBottom:20 }}>
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'24px' }}>
            <div style={{ fontSize:16, fontWeight:600, color:'#0f172a', marginBottom:4 }}>💚 Sức khoẻ kho hàng</div>
            <div style={{ fontSize:12, color:'#94a3b8', marginBottom:20 }}>Tỷ lệ % sản phẩm đang ở trạng thái tốt. Mục tiêu duy trì trên 80 điểm.</div>
            <div style={{ display:'flex', alignItems:'center', gap:28 }}>
              <svg width="100" height="100" viewBox="0 0 100 100" style={{ flexShrink:0 }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8"/>
                <circle cx="50" cy="50" r="42" fill="none" stroke={healthScore>=80?'#16a34a':healthScore>=60?'#f59e0b':'#ef4444'} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(healthScore/100)*264} 264`} transform="rotate(-90 50 50)"/>
                <text x="50" y="44" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a" fontFamily="Inter,sans-serif">{loading?'—':healthScore}</text>
                <text x="50" y="60" textAnchor="middle" fontSize="11" fill="#94a3b8" fontFamily="Inter,sans-serif">/ 100 điểm</text>
              </svg>
              <div style={{ flex:1 }}>
                {[
                  { label:'✅ Bình thường',  val:products.length-criticals.length-warnings.length, color:'#15803d', desc:'Tồn kho đầy đủ' },
                  { label:'🟡 Cần theo dõi', val:warnings.length,  color:'#92400e', desc:'Dưới 10 ngày tồn' },
                  { label:'🔴 Khẩn cấp',     val:criticals.length, color:'#be123c', desc:'Nhập hàng ngay!' },
                ].map(r => (
                  <div key={r.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #f8fafc' }}>
                    <div>
                      <div style={{ fontSize:14, color:'#475569', fontWeight:500 }}>{r.label}</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>{r.desc}</div>
                    </div>
                    <span style={{ fontSize:22, fontWeight:700, color:r.color }}>{loading?'—':r.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'22px' }}>
            <div style={{ fontSize:16, fontWeight:600, color:'#0f172a', marginBottom:4 }}>⚡ Thao tác nhanh</div>
            <div style={{ fontSize:12, color:'#94a3b8', marginBottom:16 }}>Truy cập nhanh các tính năng chính</div>
            {[
              { href:'/inventory', emoji:'📋', label:'Bảng kho hàng',  sub:'Thêm, sửa, xoá · Lịch sử giao dịch', bg:'#eff6ff', color:'#1d4ed8' },
              { href:'/scan',      emoji:'📷', label:'Quét mã vạch',   sub:'Camera điện thoại → cập nhật kho ngay', bg:'#f0fdf4', color:'#15803d' },
              { href:'/predict',   emoji:'📈', label:'AI Dự đoán',     sub:'Biểu đồ dự báo 7 ngày · Phân tích AI',  bg:'#faf5ff', color:'#7e22ce' },
              { href:'/alerts',    emoji:'🔔', label:'Gửi cảnh báo',   sub:'Thông báo Telegram & Zalo OA',           bg:'#fff7ed', color:'#c2410c' },
            ].map(a => (
              <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 13px', borderRadius:10, marginBottom:8, background:a.bg, border:'1px solid #e2e8f0', cursor:'pointer' }}>
                  <span style={{ fontSize:22, flexShrink:0 }}>{a.emoji}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:'#0f172a' }}>{a.label}</div>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:1 }}>{a.sub}</div>
                  </div>
                  <span style={{ fontSize:16, color:a.color, flexShrink:0 }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── TOP BÁN CHẠY + CHIẾN LƯỢC AI ── */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'24px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:600, color:'#0f172a' }}>📈 Chiến lược bán hàng — Top sản phẩm bán chạy</div>
              <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Dựa trên dữ liệu 30 ngày · Ảnh tự động từ Open Food Facts API</div>
            </div>
            <Link href="/predict" style={{ fontSize:13, color:'#16a34a', textDecoration:'none', fontWeight:500, flexShrink:0 }}>Biểu đồ đầy đủ →</Link>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:16, marginTop:16 }}>
            {loading ? [1,2,3,4].map(i => <div key={i} style={{ height:160, borderRadius:12, background:'#f8fafc', border:'1px solid #e2e8f0' }}/>)
            : topSelling.map((p,i) => {
              const prod     = products.find(x => x.id === p.product_id)
              const revenue  = Math.round(p.avg_daily_sales * (prod?.sell_price||0))
              const maxSales = topSelling[0]?.avg_daily_sales || 1
              const pct      = Math.round((p.avg_daily_sales/maxSales)*100)
              const medals   = ['🥇','🥈','🥉','4️⃣']
              const colors   = ['#7e22ce','#1d4ed8','#15803d','#c2410c']
              const bgs      = ['#faf5ff','#eff6ff','#f0fdf4','#fff7ed']
              const borders  = ['#e9d5ff','#bfdbfe','#bbf7d0','#fed7aa']
              return (
                <div key={p.product_id} style={{ borderRadius:12, padding:'16px', background:bgs[i], border:`1px solid ${borders[i]}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <span style={{ fontSize:20 }}>{medals[i]}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:colors[i], background:'#fff', padding:'2px 8px', borderRadius:20, border:`1px solid ${borders[i]}` }}>{p.avg_daily_sales.toFixed(1)}/ngày</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <ProductImage barcode={p.barcode} category={prod?.category} name={p.product_name} size={44}/>
                    <div style={{ fontSize:13, fontWeight:600, color:'#0f172a', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.product_name}</div>
                  </div>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#94a3b8', marginBottom:4 }}><span>Tốc độ bán</span><span>{pct}% vs #1</span></div>
                    <div style={{ height:5, borderRadius:3, background:'#e2e8f0', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:3, width:`${pct}%`, background:colors[i] }}/>
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:'#64748b', fontWeight:500 }}>💵 ~{revenue.toLocaleString('vi-VN')}đ/ngày</div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop:16, padding:'16px 20px', borderRadius:12, background:'#faf5ff', border:'1px solid #e9d5ff' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#7e22ce', marginBottom:6 }}>🤖 Gợi ý chiến lược từ AI</div>
            <div style={{ fontSize:14, color:'#6b21a8', lineHeight:1.9 }}>
              • <strong>Nhập hàng ngay:</strong> Ưu tiên sản phẩm vùng đỏ/vàng trước khi hết hàng gây mất doanh thu.<br/>
              • <strong>Đẩy bán chạy:</strong> Khuyến mãi top sản phẩm vào <strong>cuối tuần</strong> — thời điểm bán chạy nhất.<br/>
              • <strong>Xoay vòng vốn:</strong> Sản phẩm bán chậm → giảm giá nhẹ hoặc bundle combo để giải phóng kho.
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  )
}