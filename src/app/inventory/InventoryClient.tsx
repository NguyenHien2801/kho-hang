'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2, PackagePlus } from 'lucide-react'

export default function InventoryClient() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<'add' | 'edit' | 'adjust' | null>(null)
  const [selected, setSelected] = useState<Product | null>(null)
  const [form, setForm]         = useState({ name:'', barcode:'', category:'', unit:'cái', stock:0, min_stock:10, cost_price:0, sell_price:0 })
  const [adjQty, setAdjQty]     = useState(0)
  const [adjType, setAdjType]   = useState<'in'|'out'|'adjust'>('in')
  const [adjNote, setAdjNote]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name')
    setProducts(data || [])
    setLoading(false)
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode.includes(search) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() {
    setForm({ name:'', barcode:'', category:'Thực phẩm', unit:'cái', stock:0, min_stock:10, cost_price:0, sell_price:0 })
    setModal('add')
  }
  function openEdit(p: Product) {
    setSelected(p)
    setForm({ name:p.name, barcode:p.barcode, category:p.category, unit:p.unit, stock:p.stock, min_stock:p.min_stock, cost_price:p.cost_price, sell_price:p.sell_price })
    setModal('edit')
  }
  function openAdjust(p: Product) {
    setSelected(p); setAdjQty(0); setAdjType('in'); setAdjNote(''); setModal('adjust')
  }

  async function saveProduct() {
    if (!form.name || !form.barcode) { toast.error('Vui lòng nhập tên và mã vạch'); return }
    if (modal === 'add') {
      const { error } = await supabase.from('products').insert([form])
      if (error) { toast.error('Lỗi: ' + error.message); return }
      toast.success('Đã thêm sản phẩm!')
    } else if (selected) {
      const { error } = await supabase.from('products').update(form).eq('id', selected.id)
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
    const delta = adjType === 'out' ? -Math.abs(adjQty) : Math.abs(adjQty)
    const newStock = Math.max(0, selected.stock + delta)
    const { error: e1 } = await supabase.from('products').update({ stock: newStock }).eq('id', selected.id)
    const { error: e2 } = await supabase.from('inventory_transactions').insert([{
      product_id: selected.id, type: adjType, quantity: delta, note: adjNote
    }])
    if (e1 || e2) { toast.error('Lỗi cập nhật'); return }
    toast.success(`Đã ${adjType === 'in' ? 'nhập' : adjType === 'out' ? 'xuất' : 'điều chỉnh'} ${Math.abs(adjQty)} ${selected.unit}`)
    setModal(null); load()
  }

  function stockColor(p: Product) {
    const ratio = p.stock / (p.min_stock || 1)
    if (ratio <= 0.3) return 'text-red-600 font-bold'
    if (ratio <= 1)   return 'text-yellow-600 font-semibold'
    return 'text-gray-900'
  }

  function statusBadge(p: Product) {
    const ratio = p.stock / (p.min_stock || 1)
    if (ratio <= 0.3) return <span className="badge-critical">Hết gấp</span>
    if (ratio <= 1)   return <span className="badge-warning">Sắp hết</span>
    return <span className="badge-ok">Đủ hàng</span>
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý kho hàng</h1>
          <p className="text-sm text-gray-500">{filtered.length} sản phẩm</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16}/>Thêm sản phẩm</button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className="input pl-9" placeholder="Tìm theo tên, mã vạch, danh mục..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Sản phẩm','Mã vạch','Danh mục','Tồn kho','Tối thiểu','Giá bán','Trạng thái',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">Không có sản phẩm nào</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.barcode}</td>
                  <td className="px-4 py-3 text-gray-600">{p.category}</td>
                  <td className={`px-4 py-3 ${stockColor(p)}`}>{p.stock} {p.unit}</td>
                  <td className="px-4 py-3 text-gray-500">{p.min_stock}</td>
                  <td className="px-4 py-3 text-gray-700">{p.sell_price.toLocaleString('vi-VN')}đ</td>
                  <td className="px-4 py-3">{statusBadge(p)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openAdjust(p)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Nhập/Xuất kho"><PackagePlus size={15}/></button>
                      <button onClick={() => openEdit(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Sửa"><Pencil size={15}/></button>
                      <button onClick={() => deleteProduct(p)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Xoá"><Trash2 size={15}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add/Edit */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold mb-4">{modal === 'add' ? 'Thêm sản phẩm mới' : 'Chỉnh sửa sản phẩm'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Tên sản phẩm *</label>
                <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="VD: Mì tôm Hảo Hảo"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Mã vạch *</label>
                <input className="input font-mono" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} placeholder="8934673000011"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Danh mục</label>
                <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  {['Thực phẩm','Đồ uống','Bánh kẹo','Gia vị','Hóa phẩm','Khác'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Tồn kho</label>
                <input type="number" className="input" value={form.stock} onChange={e => setForm({...form, stock: +e.target.value})}/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Tồn tối thiểu</label>
                <input type="number" className="input" value={form.min_stock} onChange={e => setForm({...form, min_stock: +e.target.value})}/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Giá nhập (đ)</label>
                <input type="number" className="input" value={form.cost_price} onChange={e => setForm({...form, cost_price: +e.target.value})}/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Giá bán (đ)</label>
                <input type="number" className="input" value={form.sell_price} onChange={e => setForm({...form, sell_price: +e.target.value})}/>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button className="btn-secondary" onClick={() => setModal(null)}>Huỷ</button>
              <button className="btn-primary" onClick={saveProduct}>Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adjust Stock */}
      {modal === 'adjust' && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-1">Điều chỉnh kho</h2>
            <p className="text-sm text-gray-500 mb-4">{selected.name} · Tồn hiện tại: <strong>{selected.stock}</strong></p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Loại giao dịch</label>
                <div className="flex gap-2">
                  {(['in','out','adjust'] as const).map(t => (
                    <button key={t} onClick={() => setAdjType(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${adjType===t ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {t==='in'?'Nhập':t==='out'?'Xuất':'Điều chỉnh'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Số lượng</label>
                <input type="number" className="input" value={adjQty} min={1} onChange={e => setAdjQty(+e.target.value)}/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Ghi chú</label>
                <input className="input" value={adjNote} onChange={e => setAdjNote(e.target.value)} placeholder="VD: Nhập từ nhà cung cấp A"/>
              </div>
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                Sau điều chỉnh: <strong>{Math.max(0, selected.stock + (adjType==='out' ? -adjQty : adjQty))}</strong> {selected.unit}
              </p>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button className="btn-secondary" onClick={() => setModal(null)}>Huỷ</button>
              <button className="btn-primary" onClick={saveAdjust}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
