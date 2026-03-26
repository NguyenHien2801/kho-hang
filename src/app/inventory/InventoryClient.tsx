'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2, PackagePlus, X, Package, RefreshCw, Printer } from 'lucide-react'

/* ─── Barcode renderer dùng JsBarcode ─── */
function BarcodeRenderer({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (ref.current && value) {
      import('jsbarcode').then(({ default: JsBarcode }) => {
        JsBarcode(ref.current, value, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: false,
          margin: 0,
        })
      })
    }
  }, [value])
  return <svg ref={ref} style={{ maxWidth: '100%' }} />
}

/* ─── Helper sinh SKU nội bộ ─── */
function genSKU() {
  return 'SP-' + Date.now().toString().slice(-5)
}

export default function InventoryClient() {
  const [products, setProducts]         = useState<Product[]>([])
  const [search, setSearch]             = useState('')
  const [filterCat, setFilterCat]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading]           = useState(true)
  const [modal, setModal]               = useState<'add' | 'edit' | 'adjust' | null>(null)
  const [selected, setSelected]         = useState<Product | null>(null)
  const [form, setForm]                 = useState({ name: '', barcode: '', category: 'Thực phẩm', unit: 'cái', stock: 0, min_stock: 10, cost_price: 0, sell_price: 0 })
  const [adjQty, setAdjQty]             = useState(0)
  const [adjType, setAdjType]           = useState<'in' | 'out' | 'adjust'>('in')
  const [adjNote, setAdjNote]           = useState('')
  // ── MỚI: modal in mã vạch ──
  const [barcodeModal, setBarcodeModal] = useState<Product | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name')
    setProducts(data || [])
    setLoading(false)
  }

  function ratio(p: Product) { return p.stock / (p.min_stock || 1) }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    const matchCat    = !filterCat    || p.category === filterCat
    const matchStatus = !filterStatus || (() => {
      const r = ratio(p)
      if (filterStatus === 'ok')       return r > 1
      if (filterStatus === 'warning')  return r > 0.3 && r <= 1
      if (filterStatus === 'critical') return r <= 0.3
      return true
    })()
    return matchSearch && matchCat && matchStatus
  })

  const criticalCount   = products.filter(p => ratio(p) <= 0.3).length
  const warningCount    = products.filter(p => { const r = ratio(p); return r > 0.3 && r <= 1 }).length
  const okCount         = products.filter(p => ratio(p) > 1).length
  const totalStockValue = products.reduce((s, p) => s + p.stock * p.cost_price, 0)

  function openAdd() {
    setForm({ name: '', barcode: '', category: 'Thực phẩm', unit: 'cái', stock: 0, min_stock: 10, cost_price: 0, sell_price: 0 })
    setModal('add')
  }
  function openEdit(p: Product) {
    setSelected(p)
    setForm({ name: p.name, barcode: p.barcode, category: p.category, unit: p.unit, stock: p.stock, min_stock: p.min_stock, cost_price: p.cost_price, sell_price: p.sell_price })
    setModal('edit')
  }
  function openAdjust(p: Product) {
    setSelected(p); setAdjQty(0); setAdjType('in'); setAdjNote(''); setModal('adjust')
  }

  // ── ĐÃ SỬA: barcode không bắt buộc, tự sinh SKU nếu để trống ──
  async function saveProduct() {
    if (!form.name) { toast.error('Vui lòng nhập tên sản phẩm'); return }

    const finalForm = {
      ...form,
      barcode: form.barcode.trim() || genSKU(),
    }

    if (modal === 'add') {
      const { error } = await supabase.from('products').insert([finalForm])
      if (error) { toast.error('Lỗi: ' + error.message); return }
      toast.success('Đã thêm sản phẩm!')
    } else if (selected) {
      const { error } = await supabase.from('products').update(finalForm).eq('id', selected.id)
      if (error) { toast.error('Lỗi: ' + error.message); return }
      toast.success('Đã cập nhật!')
    }
    setModal(null); load()
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`Xoá "${p.name}"?`)) return
    await supabase.from('products').update({ is_active: false }).eq('id', p.id)
    toast.success('Đã xoá sản phẩm')
    load()
  }

  async function saveAdjust() {
    if (!selected || adjQty === 0) { toast.error('Nhập số lượng điều chỉnh'); return }
    const delta    = adjType === 'out' ? -Math.abs(adjQty) : Math.abs(adjQty)
    const newStock = Math.max(0, selected.stock + delta)
    const { error: e1 } = await supabase.from('products').update({ stock: newStock }).eq('id', selected.id)
    const { error: e2 } = await supabase.from('inventory_transactions').insert([{ product_id: selected.id, type: adjType, quantity: delta, note: adjNote }])
    if (e1 || e2) { toast.error('Lỗi cập nhật'); return }
    toast.success(`Đã ${adjType === 'in' ? 'nhập' : adjType === 'out' ? 'xuất' : 'điều chỉnh'} ${Math.abs(adjQty)} ${selected.unit}`)
    setModal(null); load()
  }

  function statusOf(p: Product) {
    const r = ratio(p)
    if (r <= 0.3) return { color: '#be123c', bg: '#fff1f2', border: '#fecdd3', barColor: '#ef4444', label: 'Hết gấp',  sqColor: '#ef4444' }
    if (r <= 1)   return { color: '#92400e', bg: '#fffbeb', border: '#fde68a', barColor: '#f59e0b', label: 'Sắp hết',  sqColor: '#f59e0b' }
    return               { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', barColor: '#22c55e', label: 'Đủ hàng',  sqColor: '#22c55e' }
  }
  function numColor(p: Product) {
    const r = ratio(p)
    if (r <= 0.3) return '#dc2626'
    if (r <= 1)   return '#d97706'
    return '#16a34a'
  }
  function barPct(p: Product) { return Math.min(100, (p.stock / Math.max(p.min_stock * 2, 1)) * 100) }

  const CATS = ['Thực phẩm', 'Đồ uống', 'Bánh kẹo', 'Gia vị', 'Hóa phẩm', 'Khác']

  const V: Record<string, React.CSSProperties> = {
    page:     { minHeight: '100vh', background: '#f8fafc', fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: 14 },
    card:     { background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,.05)' },
    th:       { textAlign: 'left', padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' },
    td:       { padding: '14px', fontSize: 14, verticalAlign: 'middle' },
    input:    { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 14, color: '#1e293b', outline: 'none', boxSizing: 'border-box', fontFamily: "'Be Vietnam Pro', sans-serif", transition: 'border-color .15s, box-shadow .15s, background .15s' },
    label:    { display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 7 },
    btnPri:   { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,.3)', fontFamily: "'Be Vietnam Pro', sans-serif", whiteSpace: 'nowrap' },
    btnGhost: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif", whiteSpace: 'nowrap' },
  }

  return (
    <div style={V.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(14px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes spin    { to { transform: rotate(360deg) } }

        .inv-tr { transition: background .12s; }
        .inv-tr:hover { background: #f8fafc !important; }
        .inv-input:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,.12) !important; background: #fff !important; }
        .inv-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 34px !important;
        }

        @media print {
          body > * { display: none !important; }
          #barcode-print-area { display: block !important; }
        }
        #barcode-print-area { display: none; }

        .inv-wrap       { max-width: 1280px; margin: 0 auto; padding: 20px 16px 48px; }
        .inv-topbar     { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; }
        .inv-topbar-btns { display: flex; gap: 8px; flex-shrink: 0; }
        .inv-kpi-grid   { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
        .inv-filter-row { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
        .inv-filter-row > * { flex: 1 1 140px; min-width: 130px; }
        .inv-card-list  { display: flex; flex-direction: column; gap: 12px; }
        .inv-table-wrap { display: none; }
        .inv-footer { padding: 14px 16px; border-top: 1px solid #f1f5f9; background: #fafafa; display: flex; flex-direction: column; gap: 10px; }
        .inv-footer-legend { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .inv-footer-summary { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
        .inv-modal-inner { padding: 22px 18px; border-radius: 20px; }
        .inv-form-grid   { display: grid; grid-template-columns: 1fr; gap: 14px; }

        @media (min-width: 640px) {
          .inv-wrap     { padding: 24px 24px 48px; }
          .inv-kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
          .inv-footer   { flex-direction: row; align-items: center; justify-content: space-between; }
          .inv-form-grid { grid-template-columns: 1fr 1fr; }
          .inv-modal-inner { padding: 28px 28px; }
        }

        @media (min-width: 900px) {
          .inv-wrap       { padding: 32px 32px 48px; }
          .inv-kpi-grid   { grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
          .inv-card-list  { display: none; }
          .inv-table-wrap { display: block; }
          .inv-modal-inner { padding: 32px 32px; }
        }
      `}</style>

      <div className="inv-wrap">

        {/* ── TOPBAR ── */}
        <div className="inv-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(99,102,241,.35)' }}>
              <Package size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>Quản lý kho hàng</h1>
              <p style={{ fontSize: 14, color: '#94a3b8', margin: '3px 0 0' }}>{products.length} mặt hàng đang theo dõi</p>
            </div>
          </div>
          <div className="inv-topbar-btns">
            <button onClick={load} disabled={loading} style={V.btnGhost}>
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              <span style={{ display: 'none' } as React.CSSProperties} className="inv-btn-label">Làm mới</span>
              <style>{`.inv-btn-label { display: inline !important; }`}</style>
            </button>
            <button onClick={openAdd} style={V.btnPri}>
              <Plus size={15} />Thêm SP
            </button>
          </div>
        </div>

        {/* ── 4 KPI CARDS ── */}
        <div className="inv-kpi-grid">
          {[
            { icon: '📦', label: 'Tổng sản phẩm', value: products.length, unit: 'mặt hàng', desc: 'Đang hoạt động',     bg: '#eff6ff', border: '#bfdbfe', num: '#1d4ed8', sub: '#93c5fd' },
            { icon: '✅', label: 'Đủ hàng',        value: okCount,         unit: 'sản phẩm', desc: 'Tồn kho ổn định',    bg: '#f0fdf4', border: '#bbf7d0', num: '#15803d', sub: '#86efac' },
            { icon: '⚠️', label: 'Cần theo dõi',   value: warningCount,    unit: 'sản phẩm', desc: 'Sắp hết hàng',       bg: '#fffbeb', border: '#fde68a', num: '#92400e', sub: '#fcd34d' },
            { icon: '🚨', label: 'Nhập ngay',       value: criticalCount,   unit: 'sản phẩm', desc: 'Hết trong ≤ 3 ngày', bg: '#fff1f2', border: '#fecdd3', num: '#be123c', sub: '#fca5a5' },
          ].map((k, i) => (
            <div key={i} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>{k.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: k.num, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {loading ? '—' : k.value.toLocaleString()}
                <span style={{ fontSize: 13, fontWeight: 600, color: k.num, opacity: .65, marginLeft: 5 }}>{k.unit}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginTop: 6 }}>{k.label}</div>
              <div style={{ fontSize: 13, color: k.sub, marginTop: 2 }}>{k.desc}</div>
            </div>
          ))}
        </div>

        {/* ── SEARCH + FILTERS ── */}
        <div className="inv-filter-row">
          <div style={{ position: 'relative', flex: '2 1 220px', minWidth: 180 }}>
            <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              className="inv-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tên, mã vạch..."
              style={{ ...V.input, paddingLeft: 42, borderRadius: 12 }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 0 }}>
                <X size={14} />
              </button>
            )}
          </div>

          <select
            className="inv-input inv-select"
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            style={{ ...V.input, minWidth: 130, borderRadius: 12, cursor: 'pointer', color: filterCat ? '#6366f1' : '#94a3b8', fontWeight: filterCat ? 700 : 400, borderColor: filterCat ? '#6366f1' : '#e2e8f0', background: filterCat ? '#eef2ff' : '#f8fafc' }}
          >
            <option value=''>Tất cả danh mục</option>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            className="inv-input inv-select"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ ...V.input, minWidth: 140, borderRadius: 12, cursor: 'pointer', color: filterStatus ? '#6366f1' : '#94a3b8', fontWeight: filterStatus ? 700 : 400, borderColor: filterStatus ? '#6366f1' : '#e2e8f0', background: filterStatus ? '#eef2ff' : '#f8fafc' }}
          >
            <option value=''>Tất cả trạng thái</option>
            <option value='ok'>✅ Đủ hàng</option>
            <option value='warning'>⚠️ Sắp hết</option>
            <option value='critical'>🚨 Hết gấp</option>
          </select>

          {(filterCat || filterStatus) && (
            <button
              onClick={() => { setFilterCat(''); setFilterStatus('') }}
              style={{ ...V.btnGhost, borderRadius: 12, color: '#ef4444', borderColor: '#fecdd3', background: '#fff1f2', flex: '0 0 auto' }}
            >
              <X size={13} />Xoá lọc
            </button>
          )}
        </div>

        {/* ── MOBILE: Card list ── */}
        <div className="inv-card-list">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} style={{ ...V.card, padding: 16, height: 100, background: '#f8fafc' }} />
            ))
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
              <Package size={36} style={{ margin: '0 auto 12px', opacity: .2, display: 'block' }} />
              <div style={{ fontSize: 15, fontWeight: 700 }}>Không tìm thấy sản phẩm</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>Thử thay đổi từ khoá hoặc bộ lọc</div>
            </div>
          ) : filtered.map(p => {
            const st = statusOf(p)
            return (
              <div key={p.id} style={{ ...V.card, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', background: '#eef2ff', padding: '3px 10px', borderRadius: 20 }}>{p.category}</span>
                      <span style={{ fontSize: 13, color: '#94a3b8' }}>{p.unit}</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#94a3b8', background: '#f8fafc', padding: '2px 7px', borderRadius: 6, border: '1px solid #f1f5f9' }}>{p.barcode}</span>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, background: st.bg, border: `1px solid ${st.border}`, color: st.color, fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                    {st.label}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>Tồn kho</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: numColor(p) }}>{p.stock} <span style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8' }}>{p.unit}</span></span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, width: `${barPct(p)}%`, background: st.barColor }} />
                  </div>
                  <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Tối thiểu: {p.min_stock}</div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '10px 12px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 3 }}>Giá nhập</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#475569', fontFamily: "'JetBrains Mono',monospace" }}>{p.cost_price.toLocaleString('vi-VN')}đ</div>
                  </div>
                  <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 10, padding: '10px 12px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 3 }}>Giá bán</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#15803d', fontFamily: "'JetBrains Mono',monospace" }}>{p.sell_price.toLocaleString('vi-VN')}đ</div>
                  </div>
                </div>

                {/* ── MỚI: thêm nút in mã vạch mobile ── */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openAdjust(p)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, border: 'none', background: '#f0fdf4', color: '#15803d', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Be Vietnam Pro',sans-serif" }}>
                    <PackagePlus size={16} />Nhập/Xuất
                  </button>
                  <button onClick={() => openEdit(p)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, border: 'none', background: '#eff6ff', color: '#1d4ed8', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Be Vietnam Pro',sans-serif" }}>
                    <Pencil size={16} />Sửa
                  </button>
                  <button onClick={() => setBarcodeModal(p)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, border: 'none', background: '#fefce8', color: '#92400e', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Be Vietnam Pro',sans-serif" }}>
                    <Printer size={16} />In mã
                  </button>
                  <button onClick={() => deleteProduct(p)} style={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', borderRadius: 10, border: 'none', background: '#fff1f2', color: '#be123c', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}

          {!loading && filtered.length > 0 && (
            <div style={{ padding: '12px 16px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 14, color: '#64748b', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span>Hiển thị <strong style={{ color: '#475569' }}>{filtered.length}</strong> / {products.length} sản phẩm</span>
              <span>Vốn tồn: <strong style={{ color: '#1d4ed8' }}>{Math.round(totalStockValue / 1000).toLocaleString()}K đ</strong></span>
            </div>
          )}
        </div>

        {/* ── DESKTOP: Table ── */}
        <div className="inv-table-wrap" style={{ ...V.card, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    { l: 'Sản phẩm',   w: '20%' },
                    { l: 'Mã vạch',    w: '11%' },
                    { l: 'Danh mục',   w: '11%' },
                    { l: 'Tồn kho',    w: '13%' },
                    { l: 'Tối thiểu',  w: '7%'  },
                    { l: 'Giá nhập',   w: '9%'  },
                    { l: 'Giá bán',    w: '9%'  },
                    { l: 'T.Thái',     w: '6%'  },
                    { l: '',           w: '14%' },
                  ].map(h => <th key={h.l} style={{ ...V.th, width: h.w } as React.CSSProperties}>{h.l}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {[...Array(9)].map((_, j) => (
                        <td key={j} style={V.td}>
                          <div style={{ height: 14, borderRadius: 6, background: '#f1f5f9', width: j === 0 ? '72%' : '52%' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '72px 0', color: '#94a3b8' }}>
                      <Package size={40} style={{ margin: '0 auto 14px', opacity: .2, display: 'block' }} />
                      <div style={{ fontSize: 15, fontWeight: 700 }}>Không tìm thấy sản phẩm</div>
                      <div style={{ fontSize: 14, marginTop: 5 }}>Thử thay đổi từ khoá tìm kiếm hoặc bộ lọc</div>
                    </td>
                  </tr>
                ) : filtered.map((p, idx) => {
                  const st = statusOf(p)
                  return (
                    <tr key={p.id} className="inv-tr" style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <td style={V.td}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{p.name}</div>
                        <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 3, fontWeight: 500 }}>{p.unit}</div>
                      </td>
                      <td style={V.td}>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#64748b', background: '#f8fafc', padding: '3px 8px', borderRadius: 6, border: '1px solid #f1f5f9', letterSpacing: '.02em' }}>
                          {p.barcode}
                        </span>
                      </td>
                      <td style={V.td}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', background: '#eef2ff', padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                          {p.category}
                        </span>
                      </td>
                      <td style={V.td}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: numColor(p) }}>{p.stock}</span>
                        <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 4, fontWeight: 500 }}>{p.unit}</span>
                        <div style={{ height: 4, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden', marginTop: 6, maxWidth: 90 }}>
                          <div style={{ height: '100%', borderRadius: 99, width: `${barPct(p)}%`, background: st.barColor }} />
                        </div>
                      </td>
                      <td style={{ ...V.td, color: '#64748b', fontWeight: 600, fontSize: 14 }}>{p.min_stock}</td>
                      <td style={{ ...V.td, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                        {p.cost_price.toLocaleString('vi-VN')}đ
                      </td>
                      <td style={{ ...V.td, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                        {p.sell_price.toLocaleString('vi-VN')}đ
                      </td>
                      <td style={V.td}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: st.bg, border: `1px solid ${st.border}` }}>
                          <span style={{ width: 18, height: 18, borderRadius: 5, background: st.sqColor, display: 'inline-block' }} />
                        </div>
                      </td>

                      {/* ── MỚI: thêm nút Printer vào action buttons desktop ── */}
                      <td style={V.td}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          {([
                            { fn: () => openAdjust(p),    icon: <PackagePlus size={17} />, title: 'Nhập/Xuất kho', bg: '#f0fdf4', hbg: '#dcfce7', c: '#15803d' },
                            { fn: () => openEdit(p),      icon: <Pencil size={17} />,      title: 'Chỉnh sửa',    bg: '#eff6ff', hbg: '#dbeafe', c: '#1d4ed8' },
                            { fn: () => setBarcodeModal(p), icon: <Printer size={17} />,   title: 'In mã vạch',   bg: '#fefce8', hbg: '#fef9c3', c: '#92400e' },
                            { fn: () => deleteProduct(p), icon: <Trash2 size={17} />,      title: 'Xoá',          bg: '#fff1f2', hbg: '#fee2e2', c: '#be123c' },
                          ] as const).map((btn, bi) => (
                            <button key={bi} onClick={btn.fn} title={btn.title}
                              style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: btn.bg, color: btn.c, transition: 'background .12s, transform .1s' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = btn.hbg; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = btn.bg;  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}>
                              {btn.icon}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="inv-footer">
            <div className="inv-footer-legend">
              {[
                { c: '#22c55e', label: 'Đủ hàng' },
                { c: '#f59e0b', label: 'Sắp hết' },
                { c: '#ef4444', label: 'Hết gấp — nhập ngay' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: l.c, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{l.label}</span>
                </div>
              ))}
            </div>
            <div className="inv-footer-summary">
              <span style={{ fontSize: 14, color: '#94a3b8' }}>
                Hiển thị <strong style={{ color: '#475569' }}>{filtered.length}</strong> / {products.length} sản phẩm
              </span>
              <span style={{ width: 1, height: 16, background: '#e2e8f0', display: 'inline-block' }} />
              <span style={{ fontSize: 14, color: '#94a3b8' }}>
                Vốn tồn kho: <strong style={{ color: '#1d4ed8' }}>{Math.round(totalStockValue / 1000).toLocaleString()}K đ</strong>
              </span>
            </div>
          </div>
        </div>

        {/* ── INSIGHT BAR ── */}
        <div style={{ padding: '12px 16px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 14, color: '#15803d', display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.6 }}>
          💡 <span><strong>Mẹo:</strong> Thanh màu dưới số tồn biểu thị tỷ lệ so với ngưỡng tối thiểu × 2. Ô đỏ = nhập ngay hôm nay, vàng = lên kế hoạch trong tuần.</span>
        </div>
      </div>

      {/* ════════════ MODAL ADD / EDIT ════════════ */}
      {(modal === 'add' || modal === 'edit') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(6px)', animation: 'fadeIn .15s ease', overflowY: 'auto' }}>
          <div className="inv-modal-inner" style={{ background: '#fff', borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,.18)', width: '100%', maxWidth: 520, animation: 'slideUp .22s cubic-bezier(.34,1.4,.64,1)', margin: 'auto' }}>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em', margin: 0 }}>
                  {modal === 'add' ? 'Thêm sản phẩm mới' : 'Chỉnh sửa sản phẩm'}
                </h2>
                <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4, marginBottom: 0 }}>Điền đầy đủ thông tin sản phẩm</p>
              </div>
              <button onClick={() => setModal(null)} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>

            <div className="inv-form-grid">
              <div style={{ gridColumn: '1/-1' }}>
                <label style={V.label}>Tên sản phẩm *</label>
                <input className="inv-input" style={V.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: Mì tôm Hảo Hảo" />
              </div>

              {/* ── ĐÃ SỬA: barcode không bắt buộc ── */}
              <div>
                <label style={V.label}>
                  Mã vạch
                  <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6, fontSize: 12 }}>(để trống → tự sinh SKU)</span>
                </label>
                <input
                  className="inv-input"
                  style={{ ...V.input, fontFamily: "'JetBrains Mono',monospace" }}
                  value={form.barcode}
                  onChange={e => setForm({ ...form, barcode: e.target.value })}
                  placeholder="Để trống → SP-XXXXX tự động"
                />
              </div>

              <div>
                <label style={V.label}>Danh mục</label>
                <select className="inv-input inv-select" style={{ ...V.input, paddingRight: 34 }} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={V.label}>Đơn vị tính</label>
                <input className="inv-input" style={V.input} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="cái, hộp, kg..." />
              </div>
              <div>
                <label style={V.label}>Tồn kho</label>
                <input className="inv-input" type="number" style={V.input} value={form.stock} onChange={e => setForm({ ...form, stock: +e.target.value })} />
              </div>
              <div>
                <label style={V.label}>Tồn tối thiểu</label>
                <input className="inv-input" type="number" style={V.input} value={form.min_stock} onChange={e => setForm({ ...form, min_stock: +e.target.value })} />
              </div>
              <div>
                <label style={V.label}>Giá nhập (đ)</label>
                <input className="inv-input" type="number" style={V.input} value={form.cost_price} onChange={e => setForm({ ...form, cost_price: +e.target.value })} />
              </div>
              <div>
                <label style={V.label}>Giá bán (đ)</label>
                <input className="inv-input" type="number" style={V.input} value={form.sell_price} onChange={e => setForm({ ...form, sell_price: +e.target.value })} />
              </div>
            </div>

            {form.cost_price > 0 && form.sell_price > 0 && (
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 14, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                💵 Lãi gộp: <strong>{(form.sell_price - form.cost_price).toLocaleString('vi-VN')}đ</strong>
                <span style={{ color: '#86efac' }}>({Math.round(((form.sell_price - form.cost_price) / form.sell_price) * 100)}% trên giá bán)</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={V.btnGhost}>Huỷ bỏ</button>
              <button onClick={saveProduct} style={V.btnPri}>
                {modal === 'add' ? <><Plus size={14} />Thêm sản phẩm</> : <><Pencil size={14} />Lưu thay đổi</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ MODAL ADJUST ════════════ */}
      {modal === 'adjust' && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(6px)', animation: 'fadeIn .15s ease', overflowY: 'auto' }}>
          <div className="inv-modal-inner" style={{ background: '#fff', borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,.18)', width: '100%', maxWidth: 420, animation: 'slideUp .22s cubic-bezier(.34,1.4,.64,1)', margin: 'auto' }}>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em', margin: 0 }}>Điều chỉnh kho</h2>
                <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4, marginBottom: 0 }}>{selected.name}</p>
              </div>
              <button onClick={() => setModal(null)} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', marginBottom: 18, border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>Tồn hiện tại</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
                {selected.stock} <span style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>{selected.unit}</span>
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={V.label}>Loại giao dịch</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {([
                    ['in',     'Nhập kho',   '#15803d', '#f0fdf4'],
                    ['out',    'Xuất kho',   '#be123c', '#fff1f2'],
                    ['adjust', 'Điều chỉnh', '#4f46e5', '#eef2ff'],
                  ] as const).map(([t, label, c, bg]) => (
                    <button key={t} onClick={() => setAdjType(t as 'in' | 'out' | 'adjust')}
                      style={{ padding: '11px 4px', borderRadius: 10, border: `1.5px solid ${adjType === t ? c : '#e2e8f0'}`, background: adjType === t ? bg : '#fff', color: adjType === t ? c : '#64748b', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Be Vietnam Pro',sans-serif", transition: 'all .15s' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={V.label}>Số lượng</label>
                <input className="inv-input" type="number" style={V.input} value={adjQty} min={1} onChange={e => setAdjQty(+e.target.value)} />
              </div>

              <div>
                <label style={V.label}>Ghi chú</label>
                <input className="inv-input" style={V.input} value={adjNote} onChange={e => setAdjNote(e.target.value)} placeholder="VD: Nhập từ nhà cung cấp A" />
              </div>

              <div style={{ borderRadius: 12, border: '1.5px dashed #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa' }}>
                <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>Tồn sau điều chỉnh</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
                  {Math.max(0, selected.stock + (adjType === 'out' ? -adjQty : adjQty))}
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginLeft: 4 }}>{selected.unit}</span>
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={V.btnGhost}>Huỷ bỏ</button>
              <button onClick={saveAdjust} style={V.btnPri}>
                <PackagePlus size={14} />Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ MODAL IN MÃ VẠCH (MỚI) ════════════ */}
      {barcodeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(6px)', animation: 'fadeIn .15s ease' }}>
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,.18)', width: '100%', maxWidth: 360, padding: 28, animation: 'slideUp .22s cubic-bezier(.34,1.4,.64,1)' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>In mã vạch</h2>
                <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4, marginBottom: 0 }}>{barcodeModal.name}</p>
              </div>
              <button onClick={() => setBarcodeModal(null)} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <X size={14} />
              </button>
            </div>

            {/* Barcode preview */}
            <div id="barcode-print-area" style={{ background: '#fff', border: '2px dashed #e2e8f0', borderRadius: 14, padding: '24px 20px', textAlign: 'center', marginBottom: 16 }}>
              <BarcodeRenderer value={barcodeModal.barcode} />
              <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '12px 0 4px' }}>{barcodeModal.name}</p>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, fontFamily: "'JetBrains Mono',monospace" }}>{barcodeModal.barcode}</p>
              {barcodeModal.sell_price > 0 && (
                <p style={{ fontSize: 14, fontWeight: 700, color: '#15803d', margin: '6px 0 0' }}>
                  {barcodeModal.sell_price.toLocaleString('vi-VN')}đ
                </p>
              )}
            </div>

            {/* Ghi chú SKU nội bộ */}
            {barcodeModal.barcode.startsWith('SP-') && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 13, color: '#92400e', marginBottom: 16, display: 'flex', gap: 8 }}>
                ⚠️ Đây là SKU nội bộ tự sinh. In ra và dán lên sản phẩm để quét sau này.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setBarcodeModal(null)} style={V.btnGhost}>Đóng</button>
              <button onClick={() => window.print()} style={{ ...V.btnPri, flex: 1, justifyContent: 'center' }}>
                <Printer size={14} />In ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}