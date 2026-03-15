import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/scan?barcode=8934673000011
export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get('barcode')
  if (!barcode) return NextResponse.json({ error: 'barcode required' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('barcode', barcode.trim())
    .eq('is_active', true)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 })
  return NextResponse.json({ product: data })
}

// POST /api/scan  { barcode, type, quantity, note }
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { barcode, type, quantity, note } = await req.json()

  // Lookup product
  const { data: product, error: pe } = await supabase
    .from('products').select('*').eq('barcode', barcode).single()
  if (pe || !product) return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 })

  const delta = type === 'out' ? -Math.abs(quantity) : Math.abs(quantity)
  const newStock = Math.max(0, product.stock + delta)

  // Update stock
  const { error: ue } = await supabase
    .from('products').update({ stock: newStock }).eq('id', product.id)
  if (ue) return NextResponse.json({ error: ue.message }, { status: 500 })

  // Log transaction
  await supabase.from('inventory_transactions').insert([{
    product_id: product.id, type, quantity: delta, note: note || 'Quét mã vạch'
  }])

  return NextResponse.json({
    success: true,
    product: { ...product, stock: newStock },
    delta,
  })
}
