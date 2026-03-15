-- ============================================
-- KHO HÀNG THÔNG MINH - Database Schema
-- Chạy file này trong Supabase SQL Editor
-- ============================================

-- Bảng sản phẩm
CREATE TABLE IF NOT EXISTS products (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  barcode     TEXT UNIQUE NOT NULL,
  category    TEXT DEFAULT 'Chưa phân loại',
  unit        TEXT DEFAULT 'cái',
  stock       INTEGER NOT NULL DEFAULT 0,
  min_stock   INTEGER NOT NULL DEFAULT 10,   -- ngưỡng tối thiểu
  cost_price  DECIMAL(12,0) DEFAULT 0,       -- giá nhập (VNĐ)
  sell_price  DECIMAL(12,0) DEFAULT 0,       -- giá bán (VNĐ)
  image_url   TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng lịch sử giao dịch kho (nhập/xuất)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  type        TEXT CHECK (type IN ('in','out','adjust')) NOT NULL,
  quantity    INTEGER NOT NULL,              -- dương = nhập, âm = xuất
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng dữ liệu bán hàng theo ngày (dùng cho AI dự đoán)
CREATE TABLE IF NOT EXISTS daily_sales (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  sale_date   DATE NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 0,
  revenue     DECIMAL(12,0) DEFAULT 0,
  UNIQUE(product_id, sale_date)
);

-- Bảng lịch sử cảnh báo đã gửi
CREATE TABLE IF NOT EXISTS alert_history (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  alert_type  TEXT CHECK (alert_type IN ('warning','critical')) NOT NULL,
  channel     TEXT CHECK (channel IN ('telegram','zalo','both')) NOT NULL,
  message     TEXT,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  days_left   INTEGER
);

-- ============================================
-- Indexes để tăng tốc query
-- ============================================
CREATE INDEX IF NOT EXISTS idx_transactions_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_sales_product  ON daily_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_daily_sales_date     ON daily_sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_products_barcode     ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_alert_history_product ON alert_history(product_id);

-- ============================================
-- Function: tự động cập nhật updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Dữ liệu mẫu để test
-- ============================================
INSERT INTO products (name, barcode, category, unit, stock, min_stock, cost_price, sell_price) VALUES
  ('Mì tôm Hảo Hảo tôm chua cay', '8934673000011', 'Thực phẩm', 'gói', 45, 50, 3500, 5000),
  ('Nước ngọt Pepsi 330ml', '8934868000023', 'Đồ uống', 'lon', 8, 30, 8000, 12000),
  ('Bánh Oreo gói lớn 432g', '7622201230756', 'Bánh kẹo', 'gói', 3, 15, 35000, 45000),
  ('Dầu ăn Neptune 1L', '8934869000045', 'Thực phẩm', 'chai', 22, 10, 45000, 58000),
  ('Sữa Vinamilk tươi tiệt trùng 1L', '8934563000067', 'Đồ uống', 'hộp', 60, 25, 28000, 35000),
  ('Xà phòng Dove sữa dưỡng 90g', '8901030612345', 'Hóa phẩm', 'bánh', 11, 20, 18000, 25000),
  ('Nước mắm Chin-su 500ml', '8934804000078', 'Gia vị', 'chai', 30, 15, 22000, 30000),
  ('Coca Cola 1.5L', '5449000000996', 'Đồ uống', 'chai', 5, 20, 15000, 22000)
ON CONFLICT (barcode) DO NOTHING;

-- Tạo dữ liệu bán hàng 30 ngày giả lập cho từng sản phẩm
DO $$
DECLARE
  p RECORD;
  d INTEGER;
  base_qty INTEGER;
  noise INTEGER;
BEGIN
  FOR p IN SELECT id, name FROM products LOOP
    base_qty := FLOOR(RANDOM() * 15 + 3)::INTEGER;
    FOR d IN 1..30 LOOP
      noise := FLOOR(RANDOM() * 6 - 3)::INTEGER;
      INSERT INTO daily_sales (product_id, sale_date, quantity, revenue)
      VALUES (
        p.id,
        CURRENT_DATE - (31 - d),
        GREATEST(0, base_qty + noise),
        GREATEST(0, base_qty + noise) * FLOOR(RANDOM() * 30000 + 5000)::INTEGER
      )
      ON CONFLICT (product_id, sale_date) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales            ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history          ENABLE ROW LEVEL SECURITY;

-- Policy: cho phép tất cả (demo - production nên giới hạn theo user)
CREATE POLICY "Allow all" ON products               FOR ALL USING (true);
CREATE POLICY "Allow all" ON inventory_transactions FOR ALL USING (true);
CREATE POLICY "Allow all" ON daily_sales            FOR ALL USING (true);
CREATE POLICY "Allow all" ON alert_history          FOR ALL USING (true);
