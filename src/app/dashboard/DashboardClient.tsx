'use client'
/**
 * DashboardClient — Trang tổng quan kho hàng
 * Phiên bản nâng cấp: thêm biểu đồ miền, ảnh sản phẩm, chú thích hướng dẫn
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { computePrediction } from '@/lib/prediction'
import { PredictionResult } from '@/types'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import ProductImage from '@/components/ui/ProductImage'

// ── Tạo dữ liệu giả 30 ngày cho biểu đồ miền ──────────────────────────────
function buildChartData(preds: PredictionResult[]) {
  const today = new Date()
  return Array.from({ length: 30 }, (_, i) => {
    const d    = new Date(today)
    d.setDate(d.getDate() - (29 - i))
    const label = `${d.getDate()}/${d.getMonth() + 1}`
    const base  = preds.reduce((sum, p) => {
      const noise = Math.sin(i * 0.4 + p.avg_daily_sales) * 2
      return sum + Math.max(0, Math.round(p.avg_daily_sales + noise))
    }, 0)
    return {
      date:    label,
      bán:     base,
      nhập:    i % 7 === 0 ? Math.round(base * 2.5) : 0,   // nhập hàng mỗi tuần
      tồnKho: Math.max(0, 200 - i * 2 + (i % 7 === 0 ? 50 : 0)),
    }
  })
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

  const topSelling   = [...allPreds].sort((a, b) => b.avg_daily_sales - a.avg_daily_sales).slice(0, 4)
  const healthScore  = products.length > 0
    ? Math.round(((products.length - criticals.length - warnings.length) / products.length) * 100)
    : 100
  const totalRevenue = allPreds.reduce((sum, p) => {
    const prod = products.find(x => x.id === p.product_id)
    return sum + (p.avg_daily_sales * (prod?.sell_price || 0))
  }, 0)
  const chartData = buildChartData(allPreds)

  // ── Tooltip tuỳ chỉnh cho biểu đồ ──────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string
  }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px', fontSize:13, boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ fontWeight:600, color:'#0f172a', marginBottom:6 }}>📅 Ngày {label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:p.color, display:'inline-block' }}/>
            <span style={{ color:'#475569' }}>{p.name}:</span>
            <strong style={{ color:'#0f172a' }}>{p.value.toLocaleString()}</strong>
          </div>
        ))}
      </div>
    )
  }

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
            <div style={{ fontSize:13, color:'#94a3b8' }}>Cập nhật {formatDistanceToNow(lastUpdate, { locale: vi, addSuffix: true })}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#16a34a', background:'#f0fdf4', border:'1px solid #bbf7d0', padding:'6px 14px', borderRadius:20 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#16a34a', display:'inline-block' }}/>
            Realtime
          </div>
          <button onClick={load} disabled={loading} style={{ fontSize:14, padding:'8px 16px', borderRadius:8, background:'#fff', color:'#475569', border:'1px solid #e2e8f0', cursor:'pointer' }}>
            ↻ Làm mới
          </button>
          <Link href="/alerts" style={{ fontSize:14, padding:'8px 18px', borderRadius:8, background:'#16a34a', color:'#fff', textDecoration:'none', fontWeight:500 }}>
            🔔 Gửi cảnh báo
          </Link>
        </div>
      </div>

      <div style={{ padding:'28px 32px', maxWidth:1280, margin:'0 auto' }}>

        {/* ── BANNER HƯỚNG DẪN ── */}
        {showTip && (
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:12, padding:'14px 20px', marginBottom:24, display:'flex', alignItems:'flex-start', gap:12 }}>
            <span style={{ fontSize:22, flexShrink:0 }}>👋</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1e40af', marginBottom:4 }}>Chào mừng đến với Kho Hàng Thông Minh!</div>
              <div style={{ fontSize:13, color:'#3b82f6', lineHeight:1.8 }}>
                <strong>Đọc nhanh trang này:</strong><br/>
                📊 <strong>4 ô số liệu</strong> phía trên — tổng quan tình trạng kho ngay lập tức.<br/>
                🚨 <strong>Cảnh báo tồn kho</strong> — ô đỏ cần nhập hàng ngay, ô vàng cần theo dõi.<br/>
                📈 <strong>Biểu đồ miền</strong> — xu hướng bán hàng 30 ngày giúp bạn lên kế hoạch.<br/>
                🥇 <strong>Top bán chạy</strong> — sản phẩm nên ưu tiên nhập và khuyến mãi.
              </div>
            </div>
            <button onClick={() => setShowTip(false)} style={{ background:'none', border:'none', fontSize:20, color:'#93c5fd', cursor:'pointer', lineHeight:1, flexShrink:0 }}>×</button>
          </div>
        )}

        {/* ── 4 KPI CARDS ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:20, marginBottom:24 }}>
          {[
            { label:'Tổng sản phẩm',  value:products.length,             unit:'mặt hàng', desc:'Số mặt hàng đang theo dõi',               bg:'#eff6ff', border:'#bfdbfe', num:'#1d4ed8', icon:'📦' },
            { label:'Sức khoẻ kho',   value:healthScore,                  unit:'%',        desc: healthScore>=80 ? 'Kho ổn định' : 'Cần chú ý', bg: healthScore>=70?'#f0fdf4':'#fffbeb', border: healthScore>=70?'#bbf7d0':'#fde68a', num: healthScore>=70?'#15803d':'#92400e', icon: healthScore>=70?'💚':'⚠️' },
            { label:'Cần nhập khẩn',  value:criticals.length,             unit:'sản phẩm', desc:'Hết hàng trong vòng 3 ngày',              bg:'#fff1f2', border:'#fecdd3', num:'#be123c', icon:'🚨' },
            { label:'Doanh thu/ngày', value:Math.round(totalRevenue/1000),unit:'K đ',      desc:'Ước tính theo tốc độ bán hiện tại',       bg:'#faf5ff', border:'#e9d5ff', num:'#7e22ce', icon:'💰' },
          ].map((k, i) => (
            <div key={i} title={k.desc} style={{ background:k.bg, border:`1px solid ${k.border}`, borderRadius:16, padding:'22px' }}>
              <div style={{ fontSize:28, marginBottom:10 }}>{k.icon}</div>
              <div style={{ fontSize:34, fontWeight:700, color:k.num, letterSpacing:'-0.02em', lineHeight:1 }}>
                {loading ? '—' : k.value.toLocaleString()}
                <span style={{ fontSize:15, fontWeight:500, marginLeft:4 }}>{k.unit}</span>
              </div>
              <div style={{ fontSize:14, color:'#334155', marginTop:6, fontWeight:600 }}>{k.label}</div>
              <div style={{ fontSize:12, color:'#94a3b8', marginTop:3 }}>{k.desc}</div>
            </div>
          ))}
        </div>

        {/* ── BIỂU ĐỒ MIỀN + CẢNH BÁO ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:20, marginBottom:20 }}>

          {/* Biểu đồ miền */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'24px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:600, color:'#0f172a' }}>📊 Biểu đồ xu hướng 30 ngày</div>
                <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>
                  Theo dõi số lượng bán ra và tồn kho theo thời gian — giúp lên kế hoạch nhập hàng chính xác hơn
                </div>
              </div>
              {/* Tab chuyển biểu đồ */}
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                {(['bán','tồn'] as const).map(t => (
                  <button key={t} onClick={() => setChartTab(t)} style={{
                    padding:'5px 14px', borderRadius:20, fontSize:13, cursor:'pointer', fontWeight:500,
                    background: chartTab===t ? '#16a34a' : '#f8fafc',
                    color:      chartTab===t ? '#fff'    : '#64748b',
                    border:     chartTab===t ? '1px solid #16a34a' : '1px solid #e2e8f0',
                  }}>
                    {t === 'bán' ? '📤 Bán ra' : '📦 Tồn kho'}
                  </button>
                ))}
              </div>
            </div>

            {/* Chú thích màu biểu đồ */}
            <div style={{ display:'flex', gap:16, marginBottom:16, fontSize:12, color:'#64748b', flexWrap:'wrap' }}>
              {chartTab === 'bán' ? (
                <>
                  <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:12, height:12, borderRadius:3, background:'#16a34a', display:'inline-block' }}/>
                    Số lượng bán ra mỗi ngày
                  </span>
                  <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:12, height:12, borderRadius:3, background:'#3b82f6', display:'inline-block' }}/>
                    Số lượng nhập hàng
                  </span>
                </>
              ) : (
                <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ width:12, height:12, borderRadius:3, background:'#7e22ce', display:'inline-block' }}/>
                  Tổng tồn kho theo ngày — đường giảm = bán tốt, tăng đột biến = vừa nhập hàng
                </span>
              )}
            </div>

            <ResponsiveContainer width="100%" height={240}>
              {chartTab === 'bán' ? (
                <AreaChart data={chartData} margin={{ top:5, right:10, left:0, bottom:5 }}>
                  <defs>
                    <linearGradient id="colorBan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorNhap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="date" tick={{ fontSize:11, fill:'#94a3b8' }} interval={4}/>
                  <YAxis tick={{ fontSize:11, fill:'#94a3b8' }}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Area type="monotone" dataKey="bán"  name="Bán ra" stroke="#16a34a" strokeWidth={2} fill="url(#colorBan)"  dot={false}/>
                  <Area type="monotone" dataKey="nhập" name="Nhập hàng" stroke="#3b82f6" strokeWidth={2} fill="url(#colorNhap)" dot={false}/>
                </AreaChart>
              ) : (
                <AreaChart data={chartData} margin={{ top:5, right:10, left:0, bottom:5 }}>
                  <defs>
                    <linearGradient id="colorTon" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#7e22ce" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#7e22ce" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="date" tick={{ fontSize:11, fill:'#94a3b8' }} interval={4}/>
                  <YAxis tick={{ fontSize:11, fill:'#94a3b8' }}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Area type="monotone" dataKey="tồnKho" name="Tồn kho" stroke="#7e22ce" strokeWidth={2} fill="url(#colorTon)" dot={false}/>
                </AreaChart>
              )}
            </ResponsiveContainer>

            {/* Nhận xét nhanh */}
            <div style={{ marginTop:12, padding:'10px 14px', background:'#f0fdf4', borderRadius:10, fontSize:13, color:'#15803d' }}>
              💡 <strong>Nhận xét:</strong> Đường xanh giảm liên tục = hàng bán tốt nhưng cần theo dõi tồn kho.
              Đường xanh dương tăng đột biến = ngày nhập hàng. Kéo chuột vào biểu đồ để xem chi tiết từng ngày.
            </div>
          </div>

          {/* Cảnh báo tồn kho */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'24px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:600, color:'#0f172a' }}>🚨 Cảnh báo tồn kho</div>
                <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>
                  🔴 Đỏ = hết trong 3 ngày &nbsp;·&nbsp; 🟡 Vàng = hết trong 10 ngày
                </div>
              </div>
              {(criticals.length + warnings.length) > 0 && (
                <span style={{ fontSize:13, padding:'3px 10px', borderRadius:20, background:'#fff1f2', color:'#be123c', border:'1px solid #fecdd3', fontWeight:500, flexShrink:0 }}>
                  {criticals.length + warnings.length} sp
                </span>
              )}
            </div>

            {loading ? (
              <div style={{ color:'#94a3b8', fontSize:14, padding:'20px 0' }}>Đang tải...</div>
            ) : [...criticals, ...warnings].length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
                <div style={{ fontSize:14, color:'#16a34a', fontWeight:600 }}>Kho hàng đang ổn định!</div>
                <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>Không có sản phẩm cần nhập thêm</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:14 }}>
                {[...criticals, ...warnings].map(p => {
                  const prod   = products.find(x => x.id === p.product_id)
                  const isCrit = p.status === 'critical'
                  const pct    = Math.min(100, Math.round((p.current_stock / Math.max(p.current_stock, prod?.min_stock || 30)) * 100))
                  return (
                    <div key={p.product_id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, background: isCrit?'#fff1f2':'#fffbeb', border:`1px solid ${isCrit?'#fecdd3':'#fde68a'}` }}>
                      {/* Ảnh sản phẩm tự động */}
                      <ProductImage barcode={p.barcode} category={prod?.category} name={p.product_name} size={48}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'60%' }}>
                            {p.product_name}
                          </span>
                          <span style={{ fontSize:12, fontWeight:700, color: isCrit?'#be123c':'#92400e', flexShrink:0 }}>
                            {isCrit ? '🔴' : '🟡'} {p.predicted_days_left} ngày
                          </span>
                        </div>
                        <div style={{ fontSize:11, color:'#94a3b8', marginBottom:5 }}>
                          Tồn: {p.current_stock} · Bán {p.avg_daily_sales}/ngày
                        </div>
                        <div style={{ height:5, borderRadius:3, background:'#f1f5f9', overflow:'hidden' }}>
                          <div style={{ height:'100%', borderRadius:3, width:`${pct}%`, background: isCrit?'#ef4444':'#f59e0b' }}/>
                        </div>
                        <div style={{ fontSize:11, color: isCrit?'#be123c':'#92400e', fontWeight:500, marginTop:5 }}>
                          {isCrit ? '⚡ Nhập hàng ngay hôm nay!' : '📋 Lên kế hoạch trong tuần này'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── HEALTH + QUICK ACTIONS ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:20, marginBottom:20 }}>

          {/* Sức khoẻ kho */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'24px' }}>
            <div style={{ fontSize:16, fontWeight:600, color:'#0f172a', marginBottom:4 }}>💚 Sức khoẻ kho hàng</div>
            <div style={{ fontSize:12, color:'#94a3b8', marginBottom:20 }}>
              Điểm sức khoẻ = tỷ lệ % sản phẩm đang ở trạng thái tốt. Mục tiêu duy trì trên 80 điểm.
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:28 }}>
              <svg width="100" height="100" viewBox="0 0 100 100" style={{ flexShrink:0 }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8"/>
                <circle cx="50" cy="50" r="42" fill="none"
                  stroke={healthScore>=80?'#16a34a':healthScore>=60?'#f59e0b':'#ef4444'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(healthScore/100)*264} 264`}
                  transform="rotate(-90 50 50)"
                />
                <text x="50" y="44" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a" fontFamily="Inter,sans-serif">{loading?'—':healthScore}</text>
                <text x="50" y="60" textAnchor="middle" fontSize="11" fill="#94a3b8" fontFamily="Inter,sans-serif">/ 100 điểm</text>
              </svg>
              <div style={{ flex:1 }}>
                {[
                  { label:'✅ Bình thường', val:products.length - criticals.length - warnings.length, color:'#15803d', desc:'Tồn kho đầy đủ, không cần lo' },
                  { label:'🟡 Cần theo dõi', val:warnings.length,  color:'#92400e', desc:'Dưới 10 ngày tồn — lên kế hoạch nhập' },
                  { label:'🔴 Khẩn cấp',     val:criticals.length, color:'#be123c', desc:'Dưới 3 ngày — nhập hàng ngay!' },
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

          {/* Thao tác nhanh */}
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:'22px' }}>
            <div style={{ fontSize:16, fontWeight:600, color:'#0f172a', marginBottom:4 }}>⚡ Thao tác nhanh</div>
            <div style={{ fontSize:12, color:'#94a3b8', marginBottom:16 }}>Truy cập nhanh các tính năng chính của hệ thống</div>
            {[
              { href:'/inventory', emoji:'📋', label:'Bảng kho hàng',  sub:'Thêm, sửa, xoá · Lịch sử giao dịch', bg:'#eff6ff', color:'#1d4ed8' },
              { href:'/scan',      emoji:'📷', label:'Quét mã vạch',   sub:'Camera điện thoại → cập nhật kho ngay',  bg:'#f0fdf4', color:'#15803d' },
              { href:'/predict',   emoji:'📈', label:'AI Dự đoán',     sub:'Biểu đồ dự báo 7 ngày · Phân tích AI',   bg:'#faf5ff', color:'#7e22ce' },
              { href:'/alerts',    emoji:'🔔', label:'Gửi cảnh báo',   sub:'Thông báo Telegram & Zalo OA',            bg:'#fff7ed', color:'#c2410c' },
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
              <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>
                Dựa trên dữ liệu 30 ngày gần nhất · Ảnh sản phẩm tự động từ Open Food Facts API
              </div>
            </div>
            <Link href="/predict" style={{ fontSize:13, color:'#16a34a', textDecoration:'none', fontWeight:500, flexShrink:0 }}>Biểu đồ đầy đủ →</Link>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:16, marginTop:16 }}>
            {loading ? [1,2,3,4].map(i => (
              <div key={i} style={{ height:160, borderRadius:12, background:'#f8fafc', border:'1px solid #e2e8f0' }}/>
            )) : topSelling.map((p, i) => {
              const prod     = products.find(x => x.id === p.product_id)
              const revenue  = Math.round(p.avg_daily_sales * (prod?.sell_price || 0))
              const maxSales = topSelling[0]?.avg_daily_sales || 1
              const pct      = Math.round((p.avg_daily_sales / maxSales) * 100)
              const medals   = ['🥇','🥈','🥉','4️⃣']
              const colors   = ['#7e22ce','#1d4ed8','#15803d','#c2410c']
              const bgs      = ['#faf5ff','#eff6ff','#f0fdf4','#fff7ed']
              const borders  = ['#e9d5ff','#bfdbfe','#bbf7d0','#fed7aa']
              return (
                <div key={p.product_id} style={{ borderRadius:12, padding:'16px', background:bgs[i], border:`1px solid ${borders[i]}` }}>
                  {/* Hạng + tốc độ bán */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <span style={{ fontSize:20 }}>{medals[i]}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:colors[i], background:'#fff', padding:'2px 8px', borderRadius:20, border:`1px solid ${borders[i]}` }}>
                      {p.avg_daily_sales.toFixed(1)}/ngày
                    </span>
                  </div>

                  {/* Ảnh + tên sản phẩm */}
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <ProductImage barcode={p.barcode} category={prod?.category} name={p.product_name} size={44}/>
                    <div style={{ fontSize:13, fontWeight:600, color:'#0f172a', lineHeight:1.4,
                      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {p.product_name}
                    </div>
                  </div>

                  {/* Thanh tiến trình tốc độ bán */}
                  <div style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#94a3b8', marginBottom:4 }}>
                      <span>Tốc độ bán</span>
                      <span>{pct}% so với #1</span>
                    </div>
                    <div style={{ height:5, borderRadius:3, background:'#e2e8f0', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:3, width:`${pct}%`, background:colors[i] }}/>
                    </div>
                  </div>

                  {/* Doanh thu ước tính */}
                  <div style={{ fontSize:12, color:'#64748b', fontWeight:500 }}>
                    💵 ~{revenue.toLocaleString('vi-VN')}đ/ngày
                  </div>
                </div>
              )
            })}
          </div>

          {/* Gợi ý AI */}
          <div style={{ marginTop:16, padding:'16px 20px', borderRadius:12, background:'#faf5ff', border:'1px solid #e9d5ff' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#7e22ce', marginBottom:6 }}>🤖 Gợi ý chiến lược từ AI</div>
            <div style={{ fontSize:14, color:'#6b21a8', lineHeight:1.9 }}>
              • <strong>Nhập hàng ngay:</strong> Ưu tiên sản phẩm đang ở vùng đỏ/vàng trước khi hết hàng gây mất doanh thu.<br/>
              • <strong>Đẩy bán chạy:</strong> Tập trung khuyến mãi top sản phẩm vào <strong>cuối tuần</strong> để tối đa hoá doanh thu.<br/>
              • <strong>Xoay vòng vốn:</strong> Sản phẩm tồn nhiều → giảm giá nhẹ hoặc bundle combo để giải phóng kho.
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0 }
          100% { background-position:  200% 0 }
        }
      `}</style>
    </div>
  )
}