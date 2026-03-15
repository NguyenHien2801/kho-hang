// ============================================
// Types cho toàn bộ dự án
// ============================================

export interface Product {
  id: string
  name: string
  barcode: string
  category: string
  unit: string
  stock: number
  min_stock: number
  cost_price: number
  sell_price: number
  image_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InventoryTransaction {
  id: string
  product_id: string
  type: 'in' | 'out' | 'adjust'
  quantity: number
  note?: string
  created_at: string
  products?: Product
}

export interface DailySale {
  id: string
  product_id: string
  sale_date: string
  quantity: number
  revenue: number
}

export interface AlertHistory {
  id: string
  product_id: string
  alert_type: 'warning' | 'critical'
  channel: 'telegram' | 'zalo' | 'both'
  message: string
  sent_at: string
  days_left: number
  products?: Product
}

// Kết quả dự đoán từ AI
export interface PredictionResult {
  product_id: string
  product_name: string
  barcode: string
  current_stock: number
  avg_daily_sales: number    // trung bình bán/ngày (30 ngày)
  slope: number              // hệ số hồi quy - xu hướng tăng/giảm
  predicted_days_left: number
  predicted_stockout_date: string
  status: 'ok' | 'warning' | 'critical'
  forecast_7days: number[]   // dự báo tồn kho 7 ngày tới
  sales_30days: DailySale[]
}

export interface DashboardStats {
  total_products: number
  warning_count: number
  critical_count: number
  total_transactions_today: number
  total_revenue_today: number
  top_selling: Array<{ product: Product; avg_daily: number }>
}

export type AlertChannel = 'telegram' | 'zalo' | 'both'
