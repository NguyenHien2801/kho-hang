'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { toast } from 'sonner'
import {
  ScanLine, CheckCircle, XCircle, Camera, CameraOff,
  History, Keyboard, Package, TrendingUp, TrendingDown,
  RotateCcw, Trash2, ChevronDown, ChevronUp, Zap, Search,
} from 'lucide-react'

/* ─── Types ─────────────────────────────────────────────── */
interface TxLog {
  id: string
  time: string
  product: string
  type: 'in' | 'out' | 'adjust'
  qty: number
  unit: string
  stockBefore: number
  stockAfter: number
  barcode: string
}

type ScanTab = 'camera' | 'manual' | 'name'

/* ─── Helper ─────────────────────────────────────────────── */
function genId() { return Math.random().toString(36).slice(2, 9) }

export default function ScanClient() {
  /* state */
  const [scanTab, setScanTab]           = useState<ScanTab>('manual')
  const [scanning, setScanning]         = useState(false)
  const [result, setResult]             = useState<Product | null>(null)
  const [notFound, setNotFound]         = useState(false)
  const [notFoundCode, setNotFoundCode] = useState('')
  const [adjQty, setAdjQty]             = useState(1)
  const [adjType, setAdjType]           = useState<'in' | 'out' | 'adjust'>('out')
  const [adjNote, setAdjNote]           = useState('')
  const [manualCode, setManualCode]     = useState('')
  // ── MỚI: tìm theo tên ──
  const [nameSearch, setNameSearch]     = useState('')
  const [suggestions, setSuggestions]   = useState<Product[]>([])
  const [logs, setLogs]                 = useState<TxLog[]>([])
  const [showLogs, setShowLogs]         = useState(true)
  const [loading, setLoading]           = useState(false)
  const [confirming, setConfirming]     = useState(false)
  const [cameraError, setCameraError]   = useState('')
  const [torchOn, setTorchOn]           = useState(false)
  const [lastScanned, setLastScanned]   = useState<string | null>(null)

  /* refs */
  const html5QrRef = useRef<unknown>(null)
  const manualRef  = useRef<HTMLInputElement>(null)
  const nameRef    = useRef<HTMLInputElement>(null)

  // ── ĐÃ SỬA: cleanup khi unmount (chuyển trang) ──
  useEffect(() => {
    return () => { stopScanner() }
  }, [])

  useEffect(() => {
    if (scanTab === 'manual') setTimeout(() => manualRef.current?.focus(), 100)
    if (scanTab === 'name')   setTimeout(() => nameRef.current?.focus(), 100)
  }, [scanTab])

  /* ══════════════════════════════════════════════
     CAMERA — ĐÃ SỬA toàn bộ stop/start logic
  ══════════════════════════════════════════════ */

  // ── ĐÃ SỬA: stopScanner là async, check isScanning, gọi .clear() ──
  async function stopScanner() {
    try {
      // @ts-expect-error html5-qrcode
      if (html5QrRef.current?.isScanning) {
        // @ts-expect-error html5-qrcode
        await html5QrRef.current.stop()
        // @ts-expect-error html5-qrcode
        html5QrRef.current.clear()   // giải phóng DOM element #qr-reader
      }
    } catch {
      // silent — đã stop rồi hoặc chưa start
    } finally {
      html5QrRef.current = null    // reset ref để lần sau tạo instance mới
      setScanning(false)
    }
  }

  async function startScanner() {
    if (typeof window === 'undefined') return
    setCameraError('')

    // ── ĐÃ SỬA: luôn stop instance cũ trước khi start mới ──
    await stopScanner()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Html5Qrcode } = await import('html5-qrcode') as any

    // ── ĐÃ SỬA: tạo instance mới mỗi lần (tránh lỗi "already used") ──
    const scanner = new Html5Qrcode('qr-reader')
    html5QrRef.current = scanner
    setScanning(true)
    setResult(null)
    setNotFound(false)
    setLastScanned(null)

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 260, height: 140 } },
        async (decoded: string) => {
          const code = decoded.trim()
          if (code === lastScanned) return
          setLastScanned(code)
          await stopScanner()       // stop ngay sau khi quét được
          await lookupBarcode(code)
        },
        undefined
      )
    } catch (err) {
      await stopScanner()
      const msg = (err as Error).message || ''
      if (msg.toLowerCase().includes('permission')) {
        setCameraError('Ứng dụng chưa được cấp quyền camera. Vui lòng cho phép trong cài đặt trình duyệt.')
      } else {
        setCameraError('Không thể mở camera. Hãy dùng nhập thủ công bên dưới.')
      }
    }
  }

  async function toggleTorch() {
    // @ts-expect-error html5-qrcode
    const track = html5QrRef.current?.getRunningTrackCapabilities?.()
    if (track?.torch) {
      // @ts-expect-error html5-qrcode
      await html5QrRef.current?.applyVideoConstraints?.({ advanced: [{ torch: !torchOn }] })
      setTorchOn(t => !t)
    } else {
      toast('Đèn flash không khả dụng trên thiết bị này')
    }
  }

  /* ── Tab switching — ĐÃ SỬA: await stopScanner ── */
  async function switchTab(tab: ScanTab) {
    if (tab !== 'camera') {
      await stopScanner()     // đảm bảo camera dừng hẳn trước khi chuyển tab
    }
    setScanTab(tab)
    setResult(null)
    setNotFound(false)
    setManualCode('')
    setNameSearch('')
    setSuggestions([])
  }

  /* ══════════════════════════════════════════════
     LOOKUP
  ══════════════════════════════════════════════ */
  const lookupBarcode = useCallback(async (barcode: string) => {
    if (!barcode) return
    setLoading(true)
    setResult(null)
    setNotFound(false)

    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .eq('is_active', true)
      .single()

    setLoading(false)

    if (data) {
      setResult(data)
      setAdjQty(1)
      setAdjNote('')
      toast.success(`✓ Tìm thấy: ${data.name}`)
    } else {
      setNotFound(true)
      setNotFoundCode(barcode)
      toast.error(`Không tìm thấy mã: ${barcode}`)
    }
  }, [lastScanned])

  // ── MỚI: tìm kiếm theo tên ──
  async function searchByName(q: string) {
    setNameSearch(q)
    if (q.trim().length < 2) { setSuggestions([]); return }
    const { data } = await supabase
      .from('products')
      .select('*')
      .ilike('name', `%${q.trim()}%`)
      .eq('is_active', true)
      .limit(6)
    setSuggestions(data || [])
  }

  function selectProduct(p: Product) {
    setResult(p)
    setAdjQty(1)
    setAdjNote('')
    setSuggestions([])
    setNameSearch('')
    toast.success(`✓ Chọn: ${p.name}`)
  }

  /* ══════════════════════════════════════════════
     TRANSACTION
  ══════════════════════════════════════════════ */
  async function confirmUpdate() {
    if (!result || confirming) return
    setConfirming(true)

    const delta    = adjType === 'out' ? -Math.abs(adjQty) : Math.abs(adjQty)
    const newStock = Math.max(0, result.stock + delta)

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('products').update({ stock: newStock }).eq('id', result.id),
      supabase.from('inventory_transactions').insert([{
        product_id: result.id, type: adjType, quantity: delta,
        note: adjNote || 'Quét mã vạch',
      }]),
    ])

    if (e1 || e2) { toast.error('Lỗi cập nhật kho'); setConfirming(false); return }

    const typeLabel = adjType === 'in' ? 'Nhập' : adjType === 'out' ? 'Xuất' : 'Điều chỉnh'
    toast.success(`${typeLabel} ${Math.abs(adjQty)} ${result.unit} — ${result.name}`)

    setLogs(prev => [{
      id:          genId(),
      time:        new Date().toLocaleTimeString('vi-VN'),
      product:     result.name,
      type:        adjType,
      qty:         Math.abs(adjQty),
      unit:        result.unit,
      stockBefore: result.stock,
      stockAfter:  newStock,
      barcode:     result.barcode,
    }, ...prev.slice(0, 19)])

    setResult(null)
    setManualCode('')
    setLastScanned(null)
    setConfirming(false)

    // Nếu đang ở tab camera → tự mở lại để quét tiếp
    if (scanTab === 'camera') {
      setTimeout(() => startScanner(), 600)
    }
  }

  async function undoLast() {
    const last = logs[0]
    if (!last) return

    const { data: prod } = await supabase
      .from('products').select('stock').eq('barcode', last.barcode).single()
    if (!prod) { toast.error('Không tìm thấy sản phẩm để hoàn tác'); return }

    const restored = last.stockBefore
    await supabase.from('products').update({ stock: restored }).eq('barcode', last.barcode)
    await supabase.from('inventory_transactions').insert([{
      product_id: last.barcode,
      type: 'adjust',
      quantity: restored - prod.stock,
      note: `Hoàn tác: ${last.type === 'in' ? 'nhập' : 'xuất'} ${last.qty} ${last.unit}`,
    }])

    toast.success(`Đã hoàn tác giao dịch: ${last.product}`)
    setLogs(prev => prev.slice(1))
  }

  function clearLogs() {
    if (!confirm('Xoá toàn bộ lịch sử giao dịch trong phiên này?')) return
    setLogs([])
  }

  /* ── Computed ── */
  const previewStock = result
    ? Math.max(0, result.stock + (adjType === 'out' ? -Math.abs(adjQty) : Math.abs(adjQty)))
    : 0

  const typeLabel = (t: 'in' | 'out' | 'adjust') =>
    t === 'in' ? 'Nhập kho' : t === 'out' ? 'Xuất kho' : 'Điều chỉnh'

  /* ── Styles ── */
  const S = {
    page:  { minHeight: '100vh', background: '#f8fafc', fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: 14, color: '#0f172a' } as React.CSSProperties,
    card:  { background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.05)' } as React.CSSProperties,
    input: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 14, color: '#1e293b', outline: 'none', boxSizing: 'border-box' as const, fontFamily: "'Be Vietnam Pro', sans-serif" },
    btnPri: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif", whiteSpace: 'nowrap' as const },
    btnSec: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 20px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif", whiteSpace: 'nowrap' as const },
    btnDanger: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 20px', borderRadius: 10, border: 'none', background: '#fff1f2', color: '#be123c', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif", whiteSpace: 'nowrap' as const, borderColor: '#fecdd3' },
    label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 7 } as React.CSSProperties,
  }

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.5} }

        .scan-wrap { max-width: 680px; margin: 0 auto; padding: 20px 16px 48px; }
        .scan-input:focus { border-color: #16a34a !important; box-shadow: 0 0 0 3px rgba(22,163,74,.12) !important; background: #fff !important; }
        .scan-btn-tab { flex: 1; padding: 10px 8px; border-radius: 10px; border: 1.5px solid #e2e8f0; background: #fff; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; color: #64748b; font-family: 'Be Vietnam Pro',sans-serif; transition: all .15s; white-space: nowrap; }
        .scan-btn-tab.active { border-color: #16a34a; background: #f0fdf4; color: #15803d; }
        .scan-type-btn { flex: 1; padding: 11px 8px; border-radius: 10px; border: 1.5px solid #e2e8f0; background: #fff; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: 'Be Vietnam Pro',sans-serif; transition: all .15s; color: #64748b; }
        .scan-type-btn.out.active  { border-color: #dc2626; background: #fff1f2; color: #dc2626; }
        .scan-type-btn.in.active   { border-color: #16a34a; background: #f0fdf4; color: #16a34a; }
        .scan-type-btn.adj.active  { border-color: #6366f1; background: #eef2ff; color: #6366f1; }
        .qty-btn { width: 42px; height: 42px; border-radius: 10px; border: 1.5px solid #e2e8f0; background: #fff; font-size: 20px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #374151; transition: background .1s; }
        .qty-btn:hover { background: #f1f5f9; }
        .log-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; animation: fadeIn .25s ease; }
        .log-row:last-child { border-bottom: none; }
        .scanning-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; animation: pulse 1.2s ease infinite; display: inline-block; }
        .suggest-row:hover { background: #f8fafc !important; }

        @media (max-width: 480px) {
          .scan-wrap { padding: 14px 12px 40px; }
        }
      `}</style>

      <div className="scan-wrap">

        {/* ── HEADER ── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(22,163,74,.3)' }}>
              <ScanLine size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>Quét mã vạch</h1>
              <p style={{ fontSize: 14, color: '#94a3b8', margin: '2px 0 0' }}>Nhập / xuất kho nhanh bằng camera, bàn phím hoặc tên SP</p>
            </div>
          </div>

          {logs.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Giao dịch', value: logs.length, color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
                { label: 'Nhập kho',  value: logs.filter(l=>l.type==='in').length,  color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
                { label: 'Xuất kho',  value: logs.filter(l=>l.type==='out').length, color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '6px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</span>
                  <span style={{ fontSize: 13, color: '#64748b' }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── TAB SWITCHER — ĐÃ SỬA: 3 tab, dùng switchTab(async) ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            className={`scan-btn-tab${scanTab === 'camera' ? ' active' : ''}`}
            onClick={async () => {
              await switchTab('camera')
              startScanner()
            }}
          >
            <Camera size={15} />
            {scanning ? <><span className="scanning-dot" />&nbsp;Đang quét</> : 'Camera'}
          </button>

          <button
            className={`scan-btn-tab${scanTab === 'manual' ? ' active' : ''}`}
            onClick={() => switchTab('manual')}
          >
            <Keyboard size={15} />Nhập mã
          </button>

          {/* ── MỚI: tab tìm theo tên ── */}
          <button
            className={`scan-btn-tab${scanTab === 'name' ? ' active' : ''}`}
            onClick={() => switchTab('name')}
          >
            <Search size={15} />Tìm tên SP
          </button>
        </div>

        {/* ══════════════════════════════════════
            TAB: CAMERA
        ══════════════════════════════════════ */}
        {scanTab === 'camera' && (
          <div style={{ ...S.card, marginBottom: 16, overflow: 'hidden', animation: 'slideUp .2s ease' }}>
            <div id="qr-reader" style={{ width: '100%', display: scanning ? 'block' : 'none', minHeight: 220 }} />

            {!scanning && !cameraError && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px', gap: 12 }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={28} color="#16a34a" />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#334155', margin: 0 }}>Camera chưa bật</p>
                <p style={{ fontSize: 14, color: '#94a3b8', margin: 0, textAlign: 'center' }}>Nhấn nút bên dưới để bắt đầu quét mã vạch</p>
              </div>
            )}

            {cameraError && (
              <div style={{ padding: '18px 20px', background: '#fff1f2', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <XCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#be123c', margin: '0 0 4px' }}>Lỗi camera</p>
                  <p style={{ fontSize: 14, color: '#7f1d1d', margin: 0 }}>{cameraError}</p>
                </div>
              </div>
            )}

            <div style={{ padding: '14px 16px', borderTop: scanning || cameraError ? '1px solid #f1f5f9' : 'none', display: 'flex', gap: 8 }}>
              {!scanning ? (
                <button onClick={startScanner} style={{ ...S.btnPri, flex: 1, justifyContent: 'center' }}>
                  <Camera size={16} />Bật camera quét
                </button>
              ) : (
                <>
                  <button onClick={stopScanner} style={{ ...S.btnDanger, flex: 1, justifyContent: 'center', border: '1px solid #fecdd3' }}>
                    <CameraOff size={16} />Dừng
                  </button>
                  <button onClick={toggleTorch} title="Bật/tắt đèn flash" style={{ ...S.btnSec, padding: '11px 14px' }}>
                    ⚡
                  </button>
                </>
              )}
            </div>

            {scanning && (
              <div style={{ padding: '10px 16px', background: '#f0fdf4', borderTop: '1px solid #bbf7d0', fontSize: 13, color: '#15803d', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="scanning-dot" />
                Hướng camera vào mã vạch — tự động nhận diện
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB: NHẬP MÃ THỦ CÔNG
        ══════════════════════════════════════ */}
        {scanTab === 'manual' && (
          <div style={{ ...S.card, padding: '18px 16px', marginBottom: 16, animation: 'slideUp .2s ease' }}>
            <label style={S.label}>Mã vạch sản phẩm</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  ref={manualRef}
                  className="scan-input"
                  style={{ ...S.input, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '.05em', paddingRight: manualCode ? 36 : 14 }}
                  placeholder="VD: 8934673000011 hoặc SP-XXXXX"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && manualCode.trim() && lookupBarcode(manualCode.trim())}
                />
                {manualCode && (
                  <button onClick={() => { setManualCode(''); manualRef.current?.focus() }}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 0 }}>
                    <XCircle size={16} />
                  </button>
                )}
              </div>
              <button
                style={{ ...S.btnPri, paddingLeft: 20, paddingRight: 20 }}
                disabled={!manualCode.trim() || loading}
                onClick={() => lookupBarcode(manualCode.trim())}
              >
                {loading ? '...' : 'Tìm'}
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 8, marginBottom: 0 }}>
              💡 Nhấn <kbd style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 5, padding: '1px 6px', fontSize: 12, fontFamily: 'monospace' }}>Enter</kbd> để tìm kiếm nhanh. Hỗ trợ cả SKU nội bộ (SP-XXXXX).
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB: TÌM THEO TÊN (MỚI)
        ══════════════════════════════════════ */}
        {scanTab === 'name' && (
          <div style={{ ...S.card, padding: '18px 16px', marginBottom: 16, animation: 'slideUp .2s ease' }}>
            <label style={S.label}>Tên sản phẩm</label>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <input
                ref={nameRef}
                className="scan-input"
                style={{ ...S.input, paddingLeft: 42 }}
                placeholder="Gõ tên sản phẩm... (tối thiểu 2 ký tự)"
                value={nameSearch}
                onChange={e => searchByName(e.target.value)}
              />
              {nameSearch && (
                <button onClick={() => { setNameSearch(''); setSuggestions([]); nameRef.current?.focus() }}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 0 }}>
                  <XCircle size={16} />
                </button>
              )}

              {/* Dropdown gợi ý */}
              {suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.1)', zIndex: 20, marginTop: 6, overflow: 'hidden' }}>
                  {suggestions.map(p => (
                    <button
                      key={p.id}
                      className="suggest-row"
                      onClick={() => selectProduct(p)}
                      style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: "'Be Vietnam Pro',sans-serif", borderBottom: '1px solid #f8fafc', textAlign: 'left' }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                        <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0', fontFamily: "'JetBrains Mono',monospace" }}>{p.barcode} · {p.category}</p>
                      </div>
                      <span style={{
                        fontSize: 13, fontWeight: 700, flexShrink: 0, marginLeft: 12,
                        color: p.stock <= p.min_stock ? '#dc2626' : '#15803d',
                        background: p.stock <= p.min_stock ? '#fff1f2' : '#f0fdf4',
                        padding: '4px 10px', borderRadius: 20,
                      }}>
                        {p.stock} {p.unit}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {nameSearch.length >= 2 && suggestions.length === 0 && !loading && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.1)', zIndex: 20, marginTop: 6, padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                  Không tìm thấy sản phẩm nào khớp
                </div>
              )}
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 10, marginBottom: 0 }}>
              💡 Dùng khi sản phẩm không có mã vạch hoặc quét không được.
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════
            LOADING
        ══════════════════════════════════════ */}
        {loading && (
          <div style={{ ...S.card, padding: '22px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Package size={18} color="#16a34a" style={{ animation: 'pulse 1s ease infinite' }} />
            </div>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Đang tra cứu...</p>
          </div>
        )}

        {/* ══════════════════════════════════════
            NOT FOUND
        ══════════════════════════════════════ */}
        {notFound && !loading && (
          <div style={{ ...S.card, padding: '18px 16px', marginBottom: 16, borderColor: '#fecdd3', animation: 'slideUp .2s ease' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <XCircle size={20} color="#ef4444" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#be123c', margin: '0 0 4px' }}>Không tìm thấy sản phẩm</p>
                <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 12px' }}>
                  Mã vạch <code style={{ fontFamily: 'JetBrains Mono', background: '#f8fafc', padding: '1px 6px', borderRadius: 5, fontSize: 13 }}>{notFoundCode}</code> chưa có trong hệ thống.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href="/inventory" style={{ ...S.btnPri, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 2px 8px rgba(99,102,241,.25)', textDecoration: 'none' }}>
                    <Package size={14} />Thêm sản phẩm mới
                  </a>
                  <button onClick={() => { setNotFound(false); setManualCode(''); manualRef.current?.focus() }} style={S.btnSec}>
                    <RotateCcw size={14} />Quét lại
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            PRODUCT FOUND — TRANSACTION FORM
        ══════════════════════════════════════ */}
        {result && !loading && (
          <div style={{ ...S.card, marginBottom: 16, overflow: 'hidden', animation: 'slideUp .25s ease' }}>

            <div style={{ padding: '16px', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderBottom: '1px solid #bbf7d0', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle size={22} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#14532d', margin: '0 0 4px', lineHeight: 1.3 }}>{result.name}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <code style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#166534', background: 'rgba(255,255,255,.6)', padding: '2px 8px', borderRadius: 6 }}>{result.barcode}</code>
                  <span style={{ fontSize: 13, color: '#166534', fontWeight: 600, background: 'rgba(255,255,255,.6)', padding: '2px 8px', borderRadius: 6 }}>{result.category}</span>
                </div>
              </div>
              <button onClick={() => { setResult(null); setManualCode(''); setLastScanned(null) }}
                style={{ background: 'rgba(255,255,255,.5)', border: '1px solid rgba(0,0,0,.08)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: '#15803d', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <XCircle size={16} />
              </button>
            </div>

            <div style={{ padding: '14px 16px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 2px', fontWeight: 600 }}>Tồn kho hiện tại</p>
                <p style={{ fontSize: 26, fontWeight: 800, color: result.stock <= result.min_stock ? '#dc2626' : '#0f172a', margin: 0, lineHeight: 1 }}>
                  {result.stock} <span style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>{result.unit}</span>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 2px' }}>Giá bán</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#15803d', fontFamily: 'JetBrains Mono', margin: 0 }}>
                  {result.sell_price.toLocaleString('vi-VN')}đ
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 2px' }}>Tối thiểu</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#64748b', margin: 0 }}>
                  {result.min_stock} {result.unit}
                </p>
              </div>
            </div>

            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Loại giao dịch</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  <button className={`scan-type-btn out${adjType==='out' ? ' active' : ''}`} onClick={() => setAdjType('out')}>
                    <TrendingDown size={16} />Xuất kho
                  </button>
                  <button className={`scan-type-btn in${adjType==='in' ? ' active' : ''}`} onClick={() => setAdjType('in')}>
                    <TrendingUp size={16} />Nhập kho
                  </button>
                  <button className={`scan-type-btn adj${adjType==='adjust' ? ' active' : ''}`} onClick={() => setAdjType('adjust')}>
                    <Zap size={16} />Điều chỉnh
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Số lượng</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button className="qty-btn" onClick={() => setAdjQty(q => Math.max(1, q - 1))}>−</button>
                  <input
                    type="number" min={1}
                    className="scan-input"
                    value={adjQty}
                    onChange={e => setAdjQty(Math.max(1, +e.target.value))}
                    style={{ ...S.input, textAlign: 'center', fontSize: 20, fontWeight: 800, width: 90, padding: '9px 8px', flex: 'none' }}
                  />
                  <button className="qty-btn" onClick={() => setAdjQty(q => q + 1)}>+</button>
                  <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>{result.unit}</span>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                    {[5, 10, 24].map(n => (
                      <button key={n} onClick={() => setAdjQty(n)}
                        style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${adjQty===n ? '#16a34a' : '#e2e8f0'}`, background: adjQty===n ? '#f0fdf4' : '#fff', color: adjQty===n ? '#16a34a' : '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Be Vietnam Pro,sans-serif' }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Ghi chú <span style={{ fontWeight: 400, color: '#94a3b8' }}>(tuỳ chọn)</span></label>
                <input
                  className="scan-input"
                  style={S.input}
                  placeholder="VD: Nhập từ nhà cung cấp A, Bán lẻ..."
                  value={adjNote}
                  onChange={e => setAdjNote(e.target.value)}
                />
              </div>

              <div style={{ background: '#f8fafc', border: '1.5px dashed #e2e8f0', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 2px', fontWeight: 600 }}>Tồn sau giao dịch</p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'line-through' }}>{result.stock}</span>
                    <span style={{ fontSize: 14, color: '#94a3b8' }}>→</span>
                    <span style={{ fontSize: 26, fontWeight: 800, color: previewStock <= result.min_stock ? '#dc2626' : '#16a34a' }}>
                      {previewStock}
                    </span>
                    <span style={{ fontSize: 14, color: '#94a3b8' }}>{result.unit}</span>
                  </div>
                  {previewStock <= result.min_stock && (
                    <p style={{ fontSize: 13, color: '#dc2626', margin: '4px 0 0', fontWeight: 600 }}>⚠️ Dưới mức tối thiểu!</p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 2px' }}>{typeLabel(adjType)}</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: adjType === 'out' ? '#dc2626' : adjType === 'in' ? '#16a34a' : '#6366f1', margin: 0 }}>
                    {adjType === 'out' ? '−' : '+'}{adjQty} {result.unit}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...S.btnSec, flex: 1, justifyContent: 'center' }}
                  onClick={() => { setResult(null); setManualCode(''); setLastScanned(null) }}>
                  Huỷ
                </button>
                <button
                  style={{ ...S.btnPri, flex: 2, justifyContent: 'center', opacity: confirming ? .7 : 1 }}
                  disabled={confirming}
                  onClick={confirmUpdate}
                >
                  {confirming ? 'Đang lưu...' : `✓ Xác nhận ${typeLabel(adjType)}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            TRANSACTION LOG
        ══════════════════════════════════════ */}
        {logs.length > 0 && (
          <div style={{ ...S.card, overflow: 'hidden', animation: 'slideUp .2s ease' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button onClick={() => setShowLogs(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Be Vietnam Pro,sans-serif' }}>
                <History size={16} color="#64748b" />
                <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Lịch sử phiên</span>
                <span style={{ fontSize: 13, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{logs.length}</span>
                {showLogs ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                {logs.length > 0 && (
                  <button onClick={undoLast} title="Hoàn tác giao dịch vừa rồi"
                    style={{ ...S.btnSec, padding: '7px 12px', fontSize: 13 }}>
                    <RotateCcw size={14} />Hoàn tác
                  </button>
                )}
                <button onClick={clearLogs} title="Xoá lịch sử"
                  style={{ ...S.btnDanger, padding: '7px 10px', border: '1px solid #fecdd3' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {showLogs && (
              <div style={{ padding: '0 16px 8px' }}>
                {logs.map((log) => (
                  <div key={log.id} className="log-row">
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                      <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: log.type==='out' ? '#fff1f2' : log.type==='in' ? '#f0fdf4' : '#eef2ff' }}>
                        {log.type === 'out'
                          ? <TrendingDown size={15} color="#dc2626" />
                          : log.type === 'in'
                          ? <TrendingUp size={15} color="#16a34a" />
                          : <Zap size={15} color="#6366f1" />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{log.product}</p>
                        <p style={{ fontSize: 12, color: '#94a3b8', margin: '1px 0 0' }}>{log.time}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 800, margin: 0, color: log.type==='out' ? '#dc2626' : log.type==='in' ? '#16a34a' : '#6366f1' }}>
                        {log.type==='out' ? '−' : '+'}{log.qty} {log.unit}
                      </p>
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: '1px 0 0' }}>
                        {log.stockBefore} → {log.stockAfter}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {logs.length === 0 && !result && !notFound && !loading && !scanning && (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: '#94a3b8' }}>
            <ScanLine size={40} style={{ margin: '0 auto 12px', opacity: .2, display: 'block' }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: '#cbd5e1', margin: '0 0 4px' }}>Chưa có giao dịch nào</p>
            <p style={{ fontSize: 14, color: '#cbd5e1', margin: 0 }}>Quét mã, nhập thủ công hoặc tìm theo tên để bắt đầu</p>
          </div>
        )}

      </div>
    </div>
  )
}