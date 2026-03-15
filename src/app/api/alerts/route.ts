import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { computePrediction } from '@/lib/prediction'
import { sendAlerts } from '@/lib/alerts'
import { AlertChannel } from '@/types'

// POST /api/alerts { channel: 'both' | 'telegram' | 'zalo' }
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { channel = 'both' } = await req.json() as { channel?: AlertChannel }

  // Load products + compute predictions
  const { data: prods } = await supabase
    .from('products').select('*').eq('is_active', true)
  if (!prods) return NextResponse.json({ error: 'No products' }, { status: 500 })

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

// GET /api/alerts - lịch sử
export async function GET() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('alert_history')
    .select('*, products(name)')
    .order('sent_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ history: data || [] })
}
