import { DailySale, PredictionResult, Product } from '@/types'
import { addDays, format } from 'date-fns'

// ============================================
// Simple Linear Regression Engine
// y = a + b*x   (x = ngày thứ i, y = số lượng bán)
// ============================================

interface RegressionResult {
  slope: number         // b - hệ số góc (xu hướng tăng/giảm)
  intercept: number     // a - điểm cắt trục y
  rSquared: number      // R² - độ chính xác mô hình
}

export function linearRegression(data: number[]): RegressionResult {
  const n = data.length
  if (n < 2) return { slope: 0, intercept: data[0] || 0, rSquared: 0 }

  const xValues = Array.from({ length: n }, (_, i) => i)
  const yValues = data

  const xMean = xValues.reduce((a, b) => a + b, 0) / n
  const yMean = yValues.reduce((a, b) => a + b, 0) / n

  let numerator   = 0
  let denominator = 0
  let ssTot = 0
  let ssRes = 0

  for (let i = 0; i < n; i++) {
    numerator   += (xValues[i] - xMean) * (yValues[i] - yMean)
    denominator += (xValues[i] - xMean) ** 2
  }

  const slope     = denominator !== 0 ? numerator / denominator : 0
  const intercept = yMean - slope * xMean

  // Tính R²
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * xValues[i]
    ssRes += (yValues[i] - predicted) ** 2
    ssTot += (yValues[i] - yMean) ** 2
  }
  const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0

  return { slope, intercept, rSquared }
}

// ============================================
// Dự đoán số ngày còn lại trước khi hết hàng
// ============================================
export function predictDaysLeft(
  currentStock: number,
  salesData: number[]
): { daysLeft: number; avgDaily: number; slope: number } {
  if (salesData.length === 0) return { daysLeft: 999, avgDaily: 0, slope: 0 }

  const { slope, intercept } = linearRegression(salesData)
  const n = salesData.length

  // Dự đoán mức bán tương lai (dùng giá trị hồi quy tại điểm n)
  const predictedDailySales = Math.max(0.1, intercept + slope * n)
  const avgDaily = salesData.reduce((a, b) => a + b, 0) / salesData.length

  // Nếu xu hướng tăng → dùng predicted (có thể hết nhanh hơn)
  // Nếu xu hướng giảm → dùng avg (an toàn hơn)
  const effectiveDaily = slope > 0 ? predictedDailySales : avgDaily
  const daysLeft = Math.round(currentStock / Math.max(effectiveDaily, 0.1))

  return { daysLeft, avgDaily, slope }
}

// ============================================
// Dự báo tồn kho 7 ngày tới
// ============================================
export function forecastStock(
  currentStock: number,
  salesData: number[],
  days = 7
): number[] {
  const { slope, intercept } = linearRegression(salesData)
  const n = salesData.length
  const forecast: number[] = []
  let stock = currentStock

  for (let i = 0; i < days; i++) {
    const predictedSale = Math.max(0, intercept + slope * (n + i))
    stock = Math.max(0, Math.round(stock - predictedSale))
    forecast.push(stock)
  }

  return forecast
}

// ============================================
// Xác định trạng thái cảnh báo
// ============================================
export function getAlertStatus(
  daysLeft: number
): 'ok' | 'warning' | 'critical' {
  const warningDays  = parseInt(process.env.ALERT_WARNING_DAYS  || '10')
  const criticalDays = parseInt(process.env.ALERT_CRITICAL_DAYS || '3')

  if (daysLeft <= criticalDays)  return 'critical'
  if (daysLeft <= warningDays)   return 'warning'
  return 'ok'
}

// ============================================
// Main: tính toán dự đoán cho 1 sản phẩm
// ============================================
export function computePrediction(
  product: Product,
  salesLast30Days: DailySale[]
): PredictionResult {
  // Sắp xếp theo ngày tăng dần
  const sorted = [...salesLast30Days].sort(
    (a, b) => new Date(a.sale_date).getTime() - new Date(b.sale_date).getTime()
  )

  // Điền ngày thiếu = 0
  const salesQty: number[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = format(addDays(today, -i), 'yyyy-MM-dd')
    const found = sorted.find(s => s.sale_date === d)
    salesQty.push(found?.quantity ?? 0)
  }

  const { daysLeft, avgDaily, slope } = predictDaysLeft(product.stock, salesQty)
  const forecast7 = forecastStock(product.stock, salesQty, 7)
  const status = getAlertStatus(daysLeft)

  const stockoutDate = format(
    addDays(today, Math.min(daysLeft, 365)),
    'dd/MM/yyyy'
  )

  return {
    product_id:            product.id,
    product_name:          product.name,
    barcode:               product.barcode,
    current_stock:         product.stock,
    avg_daily_sales:       Math.round(avgDaily * 10) / 10,
    slope:                 Math.round(slope * 100) / 100,
    predicted_days_left:   daysLeft,
    predicted_stockout_date: stockoutDate,
    status,
    forecast_7days:        forecast7,
    sales_30days:          sorted,
  }
}

// ============================================
// AI Enhancement: gọi Grok hoặc Claude API
// để phân tích thêm và đưa ra lời khuyên
// ============================================
export async function getAIAdvice(predictions: PredictionResult[]): Promise<string> {
  const criticals = predictions.filter(p => p.status === 'critical')
  const warnings  = predictions.filter(p => p.status === 'warning')

  if (criticals.length === 0 && warnings.length === 0) {
    return 'Kho hàng đang ở trạng thái tốt. Không có sản phẩm cần cảnh báo.'
  }

  const prompt = `Bạn là chuyên gia quản lý kho hàng. Phân tích tình trạng kho:

SẮP HẾT HÀNG KHẨN (< 3 ngày):
${criticals.map(p => `- ${p.product_name}: còn ${p.current_stock} ${''}, bán ${p.avg_daily_sales}/ngày, còn ${p.predicted_days_left} ngày`).join('\n') || 'Không có'}

CẦN THEO DÕI (< 10 ngày):
${warnings.map(p => `- ${p.product_name}: còn ${p.current_stock}, bán ${p.avg_daily_sales}/ngày, còn ${p.predicted_days_left} ngày`).join('\n') || 'Không có'}

Hãy đưa ra:
1. Ưu tiên nhập hàng ngay (theo thứ tự khẩn cấp)
2. Số lượng nên nhập cho mỗi sản phẩm (tính cho 30 ngày)
3. Lời khuyên quản lý kho ngắn gọn

Trả lời ngắn gọn bằng tiếng Việt, dưới 200 từ.`

  try {
    const provider = process.env.AI_PROVIDER || 'grok'

    if (provider === 'grok' && process.env.GROK_API_KEY) {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'grok-2-latest',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
        }),
      })
      const data = await res.json()
      return data.choices?.[0]?.message?.content || 'Không thể lấy phân tích AI.'
    }

    if (provider === 'claude' && process.env.ANTHROPIC_API_KEY) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      return data.content?.[0]?.text || 'Không thể lấy phân tích AI.'
    }

    // Fallback nếu không có API key
    return `⚠️ Cần nhập hàng khẩn: ${criticals.map(p => p.product_name).join(', ')}. Theo dõi thêm: ${warnings.map(p => p.product_name).join(', ')}.`
  } catch {
    return 'Lỗi kết nối AI. Vui lòng kiểm tra API key.'
  }
}
