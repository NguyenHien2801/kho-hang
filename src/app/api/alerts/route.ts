import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { computePrediction } from '@/lib/prediction'
import { sendAlerts } from '@/lib/alerts'
import { AlertChannel } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { channel = 'both', product_id } = await req.json() as { 
    channel?: AlertChannel
    product_id?: string 
  }

  let query = supabase.from('products').select('*').eq('is_active', true)
  
  // Nếu có product_id thì chỉ lấy 1 sản phẩm đó
  const { data: prods, error: prodError } = product_id
    ? await supabase.from('products').select('*').eq('id', product_id)
    : await query

  if (prodError) console.error('❌ Lỗi load products:', prodError)
  if (!prods || prods.length === 0) {
    return NextResponse.json({ error: 'No products' }, { status: 500 })
  }

  const predictions = await Promise.all(
    prods.map(async p => {
      const { data: sales } = await supabase
        .from('daily_sales').select('*')
        .eq('product_id', p.id).order('sale_date').limit(30)
      return computePrediction(p, sales || [])
    })
  )

  const alertItems = predictions.filter(
    p => p.status === 'warning' || p.status === 'critical'
  )

  console.log(`📦 Tổng: ${predictions.length} | Cần cảnh báo: ${alertItems.length}`)

  if (alertItems.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Không có sản phẩm cần cảnh báo' })
  }

  const result = await sendAlerts(alertItems, channel)

  return NextResponse.json({
    sent: alertItems.length,
    result,
    items: alertItems.map(p => ({
      name: p.product_name,
      days_left: p.predicted_days_left,
      status: p.status,
    })),
  })
}

export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('alert_history')
    .select('*, products(name)')
    .order('sent_at', { ascending: false })
    .limit(50)

  if (error) console.error('❌ Lỗi load alert_history:', error)

  return NextResponse.json({ history: data || [] })
}