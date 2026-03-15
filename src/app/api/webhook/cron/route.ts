import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { computePrediction } from '@/lib/prediction'
import { sendAlerts } from '@/lib/alerts'

// POST /api/webhook/cron
// Gọi route này từ Vercel Cron hoặc cron job bên ngoài mỗi ngày
// Header: Authorization: Bearer <CRON_SECRET>
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { data: prods } = await supabase
    .from('products').select('*').eq('is_active', true)

  if (!prods || prods.length === 0) {
    return NextResponse.json({ message: 'No products', sent: 0 })
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

  if (alertItems.length === 0) {
    return NextResponse.json({ message: 'Kho hàng ổn định, không cần cảnh báo', sent: 0 })
  }

  const result = await sendAlerts(alertItems, 'both')

  return NextResponse.json({
    sent: alertItems.length,
    result,
    criticals: alertItems.filter(p => p.status === 'critical').map(p => p.product_name),
    warnings:  alertItems.filter(p => p.status === 'warning').map(p => p.product_name),
  })
}
