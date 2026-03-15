import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { computePrediction, getAIAdvice } from '@/lib/prediction'

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const body = await req.json()

  // Load all products
  const { data: prods } = await supabase
    .from('products').select('*').eq('is_active', true)
  if (!prods) return NextResponse.json({ error: 'No products' }, { status: 500 })

  // Compute predictions for all products
  const predictions = await Promise.all(
    prods.map(async p => {
      const { data: sales } = await supabase
        .from('daily_sales').select('*')
        .eq('product_id', p.id).order('sale_date').limit(30)
      return computePrediction(p, sales || [])
    })
  )

  if (body.action === 'advice') {
    const advice = await getAIAdvice(predictions)
    return NextResponse.json({ advice, predictions })
  }

  return NextResponse.json({ predictions })
}

export async function GET() {
  const supabase = createServerClient()
  const { data: prods } = await supabase
    .from('products').select('*').eq('is_active', true)
  if (!prods) return NextResponse.json({ predictions: [] })

  const predictions = await Promise.all(
    prods.map(async p => {
      const { data: sales } = await supabase
        .from('daily_sales').select('*')
        .eq('product_id', p.id).order('sale_date').limit(30)
      return computePrediction(p, sales || [])
    })
  )

  return NextResponse.json({ predictions })
}
