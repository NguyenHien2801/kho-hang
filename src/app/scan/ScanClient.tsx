'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { toast } from 'sonner'
import { ScanLine, CheckCircle, XCircle, Camera, CameraOff, History } from 'lucide-react'

interface TxLog {
  time: string; product: string; type: string; qty: number; unit: string
}

export default function ScanClient() {
  const [scanning, setScanning]   = useState(false)
  const [result, setResult]       = useState<Product | null>(null)
  const [notFound, setNotFound]   = useState(false)
  const [adjQty, setAdjQty]       = useState(1)
  const [adjType, setAdjType]     = useState<'in'|'out'>('out')
  const [manualCode, setManualCode] = useState('')
  const [logs, setLogs]           = useState<TxLog[]>([])
  const scannerRef                = useRef<HTMLDivElement>(null)
  const html5QrRef                = useRef<unknown>(null)

  useEffect(() => {
    return () => { stopScanner() }
  }, [])

  async function startScanner() {
    if (typeof window === 'undefined') return
    // @ts-expect-error html5-qrcode has no types
    const { Html5Qrcode } = await import('html5-qrcode')
    const scanner = new Html5Qrcode('qr-reader')
    html5QrRef.current = scanner
    setScanning(true)
    setResult(null)
    setNotFound(false)

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        async (decodedText: string) => {
          await scanner.stop()
          setScanning(false)
          await lookupBarcode(decodedText.trim())
        },
        undefined
      )
    } catch {
      setScanning(false)
      toast.error('Không thể mở camera. Hãy dùng nhập thủ công.')
    }
  }

  function stopScanner() {
    // @ts-expect-error html5-qrcode has no types
    if (html5QrRef.current?.stop) {
      // @ts-expect-error html5-qrcode has no types
      html5QrRef.current.stop().catch(() => {})
    }
    setScanning(false)
  }

  async function lookupBarcode(barcode: string) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .eq('is_active', true)
      .single()

    if (data) {
      setResult(data)
      setNotFound(false)
      setAdjQty(1)
      toast.success(`Đã tìm thấy: ${data.name}`)
    } else {
      setResult(null)
      setNotFound(true)
      toast.error(`Không tìm thấy mã vạch: ${barcode}`)
    }
  }

  async function confirmUpdate() {
    if (!result) return
    const delta = adjType === 'out' ? -adjQty : adjQty
    const newStock = Math.max(0, result.stock + delta)

    const { error: e1 } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', result.id)

    const { error: e2 } = await supabase
      .from('inventory_transactions')
      .insert([{ product_id: result.id, type: adjType, quantity: delta, note: 'Quét mã vạch' }])

    if (e1 || e2) { toast.error('Lỗi cập nhật kho'); return }

    toast.success(`✓ ${adjType === 'out' ? 'Xuất' : 'Nhập'} ${adjQty} ${result.unit} — ${result.name}`)

    setLogs(prev => [{
      time: new Date().toLocaleTimeString('vi-VN'),
      product: result.name,
      type: adjType === 'out' ? 'Xuất' : 'Nhập',
      qty: adjQty,
      unit: result.unit,
    }, ...prev.slice(0, 9)])

    setResult(null)
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quét mã vạch</h1>
        <p className="text-sm text-gray-500 mt-0.5">Dùng camera điện thoại hoặc nhập thủ công</p>
      </div>

      {/* Camera scanner box */}
      <div className="card p-4 mb-4">
        <div id="qr-reader" ref={scannerRef} className={scanning ? 'rounded-xl overflow-hidden' : 'hidden'} style={{ width: '100%' }} />

        {!scanning && !result && (
          <div className="flex flex-col items-center py-10 gap-3">
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center">
              <ScanLine size={32} className="text-green-600" />
            </div>
            <p className="text-gray-600 font-medium">Sẵn sàng quét</p>
            <p className="text-xs text-gray-400">Camera sẽ mở khi bạn nhấn nút bên dưới</p>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          {!scanning ? (
            <button onClick={startScanner} className="btn-primary flex-1">
              <Camera size={16}/> Bật camera quét
            </button>
          ) : (
            <button onClick={stopScanner} className="btn-danger flex-1">
              <CameraOff size={16}/> Dừng
            </button>
          )}
        </div>
      </div>

      {/* Manual input */}
      <div className="card p-4 mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Nhập mã vạch thủ công</p>
        <div className="flex gap-2">
          <input
            className="input flex-1 font-mono"
            placeholder="VD: 8934673000011"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && manualCode && lookupBarcode(manualCode)}
          />
          <button
            className="btn-primary"
            onClick={() => manualCode && lookupBarcode(manualCode)}
          >
            Tìm
          </button>
        </div>
      </div>

      {/* Not found */}
      {notFound && (
        <div className="card p-4 mb-4 border-red-100">
          <div className="flex items-center gap-3">
            <XCircle size={20} className="text-red-500 flex-shrink-0"/>
            <div>
              <p className="font-medium text-gray-900">Không tìm thấy sản phẩm</p>
              <p className="text-sm text-gray-500">Mã vạch chưa có trong hệ thống. Vui lòng thêm sản phẩm trước.</p>
            </div>
          </div>
        </div>
      )}

      {/* Product found */}
      {result && (
        <div className="card p-4 mb-4 border-green-100 bg-green-50/30">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5"/>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{result.name}</p>
              <p className="text-xs text-gray-500 font-mono">{result.barcode}</p>
              <p className="text-sm text-gray-600 mt-1">
                Tồn hiện tại: <strong>{result.stock} {result.unit}</strong> · {result.category}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">Loại giao dịch</p>
              <div className="flex gap-2">
                {(['out','in'] as const).map(t => (
                  <button key={t} onClick={() => setAdjType(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${adjType===t ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {t === 'out' ? '📤 Xuất kho (bán)' : '📥 Nhập kho'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">Số lượng</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setAdjQty(Math.max(1, adjQty-1))} className="w-10 h-10 rounded-lg border border-gray-200 text-lg font-bold hover:bg-gray-50">−</button>
                <input type="number" className="input text-center w-20 text-lg font-bold" min={1} value={adjQty} onChange={e => setAdjQty(Math.max(1, +e.target.value))}/>
                <button onClick={() => setAdjQty(adjQty+1)} className="w-10 h-10 rounded-lg border border-gray-200 text-lg font-bold hover:bg-gray-50">+</button>
                <span className="text-sm text-gray-500">{result.unit}</span>
              </div>
            </div>

            <p className="text-sm bg-gray-100 rounded-lg p-2.5 text-gray-600">
              Sau giao dịch: <strong className="text-gray-900">{Math.max(0, result.stock + (adjType==='out'?-adjQty:adjQty))} {result.unit}</strong>
            </p>

            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setResult(null)}>Huỷ</button>
              <button className="btn-primary flex-1" onClick={confirmUpdate}>✓ Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction log */}
      {logs.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <History size={15} className="text-gray-400"/>
            <p className="text-sm font-medium text-gray-700">Giao dịch vừa thực hiện</p>
          </div>
          <div className="space-y-1.5">
            {logs.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{l.time}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${l.type==='Xuất'?'bg-orange-100 text-orange-700':'bg-green-100 text-green-700'}`}>{l.type}</span>
                  <span className="text-gray-700">{l.product}</span>
                </div>
                <span className="font-medium text-gray-900">{l.qty} {l.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
