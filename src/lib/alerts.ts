import { PredictionResult, AlertChannel } from '@/types'
import { createServerClient } from './supabase'

export async function sendTelegramAlert(
  predictions: PredictionResult[]
): Promise<boolean> {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    console.warn('Telegram chưa cấu hình. Bỏ qua.')
    return false
  }

  const criticals = predictions.filter(p => p.status === 'critical')
  const warnings  = predictions.filter(p => p.status === 'warning')

  if (criticals.length === 0 && warnings.length === 0) return true

  const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

  let msg = `🏪 *BÁO CÁO TỒN KHO* - ${now}\n\n`

  if (criticals.length > 0) {
    msg += `🔴 *HẾT HÀNG KHẨN CẤP (< 3 ngày):*\n`
    criticals.forEach(p => {
      msg += `• ${p.product_name}\n`
      msg += `  Tồn: ${p.current_stock} | Bán ${p.avg_daily_sales}/ngày | Còn *${p.predicted_days_left} ngày*\n`
    })
    msg += '\n'
  }

  if (warnings.length > 0) {
    msg += `🟡 *SẮP HẾT HÀNG (< 10 ngày):*\n`
    warnings.forEach(p => {
      msg += `• ${p.product_name}\n`
      msg += `  Tồn: ${p.current_stock} | Còn *${p.predicted_days_left} ngày*\n`
    })
  }

  msg += `\n_Hệ thống Kho Hàng Thông Minh_`

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
        }),
      }
    )
    const data = await res.json()
    return data.ok === true
  } catch (err) {
    console.error('Telegram error:', err)
    return false
  }
}

export async function sendZaloAlert(
  predictions: PredictionResult[]
): Promise<boolean> {
  const accessToken = process.env.ZALO_ACCESS_TOKEN
  const userId      = process.env.ZALO_USER_ID

  if (!accessToken || !userId) {
    console.warn('Zalo chưa cấu hình. Bỏ qua.')
    return false
  }

  const criticals = predictions.filter(p => p.status === 'critical')
  const warnings  = predictions.filter(p => p.status === 'warning')

  if (criticals.length === 0 && warnings.length === 0) return true

  const items = [
    ...criticals.map(p => `🔴 ${p.product_name}: còn ${p.predicted_days_left} ngày`),
    ...warnings.map(p  => `🟡 ${p.product_name}: còn ${p.predicted_days_left} ngày`),
  ]

  const message = `⚠️ CẢNH BÁO KHO HÀNG\n\n${items.join('\n')}\n\nVui lòng kiểm tra và nhập hàng kịp thời.`

  try {
    const res = await fetch('https://openapi.zalo.me/v2.0/oa/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': accessToken,
      },
      body: JSON.stringify({
        recipient: { user_id: userId },
        message: { text: message },
      }),
    })
    const data = await res.json()
    return data.error === 0
  } catch (err) {
    console.error('Zalo error:', err)
    return false
  }
}

export async function sendAlerts(
  predictions: PredictionResult[],
  channel: AlertChannel = 'both'
): Promise<{ telegram: boolean; zalo: boolean }> {
  const alertItems = predictions.filter(
    p => p.status === 'warning' || p.status === 'critical'
  )
  if (alertItems.length === 0) return { telegram: false, zalo: false }

  let telegramOk = false
  let zaloOk     = false

  if (channel === 'telegram' || channel === 'both') {
    telegramOk = await sendTelegramAlert(alertItems)
  }
  if (channel === 'zalo' || channel === 'both') {
    zaloOk = await sendZaloAlert(alertItems)
  }

  const supabase = createServerClient()

  // Lấy user đang đăng nhập
  const { data: { user } } = await supabase.auth.getUser()

  const records = alertItems.map(p => ({
    product_id: p.product_id,
    alert_type: p.status as 'warning' | 'critical',
    channel,
    message: `${p.product_name} còn ${p.predicted_days_left} ngày tồn kho`,
    days_left: p.predicted_days_left,
    sent_at: new Date().toISOString(),
    user_id: user?.id ?? null,
  }))

  const { error } = await supabase.from('alert_history').insert(records)
  if (error) console.error('❌ Insert alert_history error:', error)
  else console.log(`✅ Đã lưu ${records.length} bản ghi lịch sử`)

  return { telegram: telegramOk, zalo: zaloOk }
}