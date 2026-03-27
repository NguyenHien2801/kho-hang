-- ============================================
-- KHO HÀNG THÔNG MINH - Full Seed Data (FIXED)
-- 3 người dùng × 15 sản phẩm + lịch sử bán hàng
-- ============================================

-- ============================================
-- BƯỚC 1: TẠO SCHEMA ĐẦY ĐỦ
-- ============================================

CREATE TABLE IF NOT EXISTS products (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  barcode     TEXT NOT NULL,
  category    TEXT DEFAULT 'Chưa phân loại',
  unit        TEXT DEFAULT 'cái',
  stock       INTEGER NOT NULL DEFAULT 0,
  min_stock   INTEGER NOT NULL DEFAULT 10,
  cost_price  DECIMAL(12,0) DEFAULT 0,
  sell_price  DECIMAL(12,0) DEFAULT 0,
  image_url   TEXT,
  is_active   BOOLEAN DEFAULT true,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(barcode)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  type        TEXT CHECK (type IN ('in','out','adjust')) NOT NULL,
  quantity    INTEGER NOT NULL,
  note        TEXT,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_sales (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  sale_date   DATE NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 0,
  revenue     DECIMAL(12,0) DEFAULT 0,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(product_id, sale_date, user_id)
);

CREATE TABLE IF NOT EXISTS alert_history (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  alert_type  TEXT CHECK (alert_type IN ('warning','critical')) NOT NULL,
  channel     TEXT CHECK (channel IN ('telegram','zalo','both')) NOT NULL,
  message     TEXT,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  days_left   INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_user      ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode   ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_transactions_user  ON inventory_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_prod  ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_daily_sales_user   ON daily_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_sales_prod   ON daily_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_alert_user         ON alert_history(user_id);

-- Auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_products_updated_at ON products;
CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales            ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all"                  ON products;
DROP POLICY IF EXISTS "Allow all"                  ON inventory_transactions;
DROP POLICY IF EXISTS "Allow all"                  ON daily_sales;
DROP POLICY IF EXISTS "Allow all"                  ON alert_history;
DROP POLICY IF EXISTS "Users see own products"     ON products;
DROP POLICY IF EXISTS "Users see own transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Users see own daily_sales"  ON daily_sales;
DROP POLICY IF EXISTS "Users see own alerts"       ON alert_history;

CREATE POLICY "Users see own products"
  ON products FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own transactions"
  ON inventory_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own daily_sales"
  ON daily_sales FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own alerts"
  ON alert_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================
-- BƯỚC 2: SEED DATA 3 USER
-- ⚠️  Thay 3 UUID bên dưới bằng UUID thật
-- ============================================
DO $$
DECLARE
  uid1 UUID := 'f4c8a774-dbcf-43f8-a60b-40b31cc6fd40';
  uid2 UUID := '1b3d97b6-74cb-4df9-b5f3-4caf0d0321c5';
  uid3 UUID := 'de44dc21-aa16-425c-b996-2ac7b8b6e9f3';

  p         RECORD;
  d         INTEGER;
  base_qty  INTEGER;
  noise     INTEGER;
  rand_qty  INTEGER;

BEGIN

-- ============================================
-- USER 1: Cửa hàng tạp hoá Minh Tâm
-- ============================================
RAISE NOTICE '>>> Seed User 1: Cửa hàng Minh Tâm...';

INSERT INTO products (name, barcode, category, unit, stock, min_stock, cost_price, sell_price, user_id) VALUES
  ('Mì tôm Hảo Hảo tôm chua cay',    'U1-001', 'Thực phẩm', 'gói',  45, 50,  3500,   5000, uid1),
  ('Nước ngọt Pepsi 330ml',           'U1-002', 'Đồ uống',   'lon',   8, 30,  8000,  12000, uid1),
  ('Bánh Oreo gói lớn 432g',          'U1-003', 'Bánh kẹo',  'gói',   3, 15, 35000,  45000, uid1),
  ('Dầu ăn Neptune 1L',               'U1-004', 'Thực phẩm', 'chai', 22, 10, 45000,  58000, uid1),
  ('Sữa Vinamilk tươi tiệt trùng 1L', 'U1-005', 'Đồ uống',   'hộp',  60, 25, 28000,  35000, uid1),
  ('Nước mắm Chin-su 500ml',          'U1-006', 'Gia vị',    'chai', 30, 15, 22000,  30000, uid1),
  ('Coca Cola 1.5L',                  'U1-007', 'Đồ uống',   'chai',  5, 20, 15000,  22000, uid1),
  ('Đường Biên Hoà 1kg',              'U1-008', 'Gia vị',    'túi',  40, 20, 18000,  25000, uid1),
  ('Muối iốt Cầu Tre 1kg',            'U1-009', 'Gia vị',    'túi',  25, 10,  8000,  12000, uid1),
  ('Nước tương Maggi 200ml',          'U1-010', 'Gia vị',    'chai', 18, 12, 12000,  18000, uid1),
  ('Gạo ST25 thơm 5kg',               'U1-011', 'Thực phẩm', 'túi',  15,  8, 95000, 120000, uid1),
  ('Mì gói Omachi xào bò hầm',        'U1-012', 'Thực phẩm', 'gói',  55, 40,  5000,   7000, uid1),
  ('Bột ngọt Ajinomoto 400g',         'U1-013', 'Gia vị',    'túi',  20, 10, 22000,  30000, uid1),
  ('Nước suối Lavie 500ml',           'U1-014', 'Đồ uống',   'chai', 72, 50,  3500,   5000, uid1),
  ('Cà phê Nescafe 3in1 hộp 20 gói',  'U1-015', 'Đồ uống',   'hộp',  12, 10, 55000,  75000, uid1)
ON CONFLICT (barcode) DO NOTHING;


-- ============================================
-- USER 2: Cửa hàng mỹ phẩm & hoá phẩm Lan Anh
-- ============================================
RAISE NOTICE '>>> Seed User 2: Cửa hàng Lan Anh...';

INSERT INTO products (name, barcode, category, unit, stock, min_stock, cost_price, sell_price, user_id) VALUES
  ('Xa phong Dove sua duong 90g',        'U2-001', 'Hóa phẩm', 'bánh', 11, 20, 18000,  25000, uid2),
  ('Dầu gội Clear men mát lạnh 380ml',  'U2-002', 'Hóa phẩm', 'chai',  6, 15, 65000,  88000, uid2),
  ('Sữa tắm Lifebuoy bảo vệ 800ml',     'U2-003', 'Hóa phẩm', 'chai', 14, 10, 55000,  75000, uid2),
  ('Kem đánh răng Colgate 230g',         'U2-004', 'Hóa phẩm', 'tuýp', 20, 15, 28000,  38000, uid2),
  ('Bàn chải Oral-B mềm',               'U2-005', 'Hóa phẩm', 'cái',  30, 20, 22000,  32000, uid2),
  ('Nước xả Downy đam mê 800ml',        'U2-006', 'Hóa phẩm', 'chai',  9, 12, 48000,  65000, uid2),
  ('Bột giặt Omo matic 3kg',            'U2-007', 'Hóa phẩm', 'túi',   4, 10, 92000, 125000, uid2),
  ('Nước rửa bát Sunlight chanh 750ml', 'U2-008', 'Hóa phẩm', 'chai', 25, 15, 28000,  38000, uid2),
  ('Giấy vệ sinh Pulppy 10 cuộn',       'U2-009', 'Hóa phẩm', 'gói',  17, 12, 38000,  52000, uid2),
  ('Lăn khử mùi Nivea men 50ml',        'U2-010', 'Hóa phẩm', 'cái',   8, 10, 42000,  58000, uid2),
  ('Sữa rửa mặt Ponds trắng mịn 100g',  'U2-011', 'Mỹ phẩm',  'tuýp', 10, 10, 55000,  75000, uid2),
  ('Kem dưỡng da tay Vaseline 50ml',    'U2-012', 'Mỹ phẩm',  'tuýp', 15, 10, 35000,  48000, uid2),
  ('Nước hoa hồng Simple 200ml',        'U2-013', 'Mỹ phẩm',  'chai',  7,  8, 78000, 105000, uid2),
  ('Khăn giấy ướt Bobby 80 tờ',         'U2-014', 'Hóa phẩm', 'gói',  22, 15, 18000,  25000, uid2),
  ('Dầu gội Pantene bóng mượt 480ml',   'U2-015', 'Hóa phẩm', 'chai', 11, 12, 68000,  92000, uid2)
ON CONFLICT (barcode) DO NOTHING;


-- ============================================
-- USER 3: Cửa hàng văn phòng phẩm Hùng
-- ============================================
RAISE NOTICE '>>> Seed User 3: Cửa hàng Hùng VPP...';

INSERT INTO products (name, barcode, category, unit, stock, min_stock, cost_price, sell_price, user_id) VALUES
  ('Bút bi Thiên Long TL-027 xanh',    'U3-001', 'Văn phòng phẩm', 'cái',   120, 50,  2500,   4000, uid3),
  ('Tập học sinh Hồng Hà 96 trang',    'U3-002', 'Văn phòng phẩm', 'quyển',  80, 30,  6500,   9000, uid3),
  ('Thước kẻ nhựa 30cm',               'U3-003', 'Văn phòng phẩm', 'cái',    40, 20,  5000,   8000, uid3),
  ('Kéo văn phòng Deli 18cm',          'U3-004', 'Văn phòng phẩm', 'cái',    25, 10, 22000,  32000, uid3),
  ('Hộp bút chì màu 12 màu Staedtler','U3-005', 'Văn phòng phẩm', 'hộp',    15, 10, 45000,  62000, uid3),
  ('Băng dính trong 3M 18mmx33m',      'U3-006', 'Văn phòng phẩm', 'cuộn',   50, 20,  8000,  12000, uid3),
  ('Ghim bấm Deli 24/6 1000 cái',      'U3-007', 'Văn phòng phẩm', 'hộp',    35, 15, 12000,  18000, uid3),
  ('Giấy in A4 Double A 500 tờ',       'U3-008', 'Văn phòng phẩm', 'ram',     8,  5, 88000, 115000, uid3),
  ('Bảng trắng từ tính 60x90cm',       'U3-009', 'Đồ dùng',        'cái',     5,  3,195000, 260000, uid3),
  ('Hộp đựng hồ sơ A4 nắp từ',        'U3-010', 'Đồ dùng',        'cái',    18, 10, 22000,  32000, uid3),
  ('Bút dạ quang Stabilo 4 màu',       'U3-011', 'Văn phòng phẩm', 'bộ',     28, 15, 28000,  38000, uid3),
  ('Máy tính Casio FX-570VN Plus',     'U3-012', 'Đồ dùng',        'cái',     6,  3,285000, 380000, uid3),
  ('Kẹp giấy bướm 32mm hộp 12 cái',   'U3-013', 'Văn phòng phẩm', 'hộp',    40, 15,  9000,  14000, uid3),
  ('Sổ tay bìa cứng A5 200 trang',     'U3-014', 'Văn phòng phẩm', 'quyển',  22, 10, 28000,  38000, uid3),
  ('Mực in Canon PG-745 đen',          'U3-015', 'Đồ dùng',        'hộp',     3,  3,185000, 245000, uid3)
ON CONFLICT (barcode) DO NOTHING;


-- ============================================
-- BƯỚC 3: DAILY_SALES 30 NGÀY
-- ============================================
RAISE NOTICE '>>> Sinh dữ liệu bán hàng 30 ngày...';

FOR p IN
  SELECT id, user_id, sell_price FROM products
  WHERE user_id IN (uid1, uid2, uid3)
LOOP
  base_qty := FLOOR(RANDOM() * 18 + 2)::INTEGER;
  FOR d IN 1..30 LOOP
    noise    := FLOOR(RANDOM() * 8 - 4)::INTEGER;
    rand_qty := GREATEST(0, base_qty + noise);
    INSERT INTO daily_sales (product_id, sale_date, quantity, revenue, user_id)
    VALUES (
      p.id,
      CURRENT_DATE - (31 - d),
      rand_qty,
      rand_qty * p.sell_price,
      p.user_id
    )
    ON CONFLICT (product_id, sale_date, user_id) DO NOTHING;
  END LOOP;
END LOOP;


-- ============================================
-- BƯỚC 4: INVENTORY_TRANSACTIONS
-- ============================================
RAISE NOTICE '>>> Sinh lịch sử giao dịch kho...';

FOR p IN
  SELECT id, user_id, stock FROM products
  WHERE user_id IN (uid1, uid2, uid3)
LOOP
  INSERT INTO inventory_transactions (product_id, type, quantity, note, user_id)
  VALUES (p.id, 'in', p.stock + FLOOR(RANDOM()*20+10)::INTEGER, 'Nhập hàng khai trương', p.user_id);

  FOR d IN 1..5 LOOP
    INSERT INTO inventory_transactions (product_id, type, quantity, note, user_id, created_at)
    VALUES (
      p.id, 'out',
      FLOOR(RANDOM()*5+1)::INTEGER,
      'Bán hàng ngày ' || d,
      p.user_id,
      NOW() - ((30 - d * 5) || ' days')::INTERVAL
    );
  END LOOP;
END LOOP;


-- ============================================
-- BƯỚC 5: ALERT_HISTORY (hàng dưới ngưỡng)
-- ============================================
RAISE NOTICE '>>> Sinh cảnh báo tồn kho...';

FOR p IN
  SELECT id, user_id, stock, min_stock FROM products
  WHERE user_id IN (uid1, uid2, uid3)
    AND stock < min_stock
LOOP
  INSERT INTO alert_history (product_id, alert_type, channel, message, user_id, days_left)
  VALUES (
    p.id,
    CASE WHEN p.stock < p.min_stock * 0.5 THEN 'critical' ELSE 'warning' END,
    'telegram',
    'Tồn kho còn ' || p.stock || ' đơn vị - dưới ngưỡng tối thiểu (' || p.min_stock || ')',
    p.user_id,
    FLOOR(RANDOM()*5+1)::INTEGER
  );
END LOOP;

RAISE NOTICE '✅ SEED HOÀN TẤT!';
RAISE NOTICE '   User 1 (Minh Tâm) : %', uid1;
RAISE NOTICE '   User 2 (Lan Anh)  : %', uid2;
RAISE NOTICE '   User 3 (Hung VPP) : %', uid3;

END $$;


-- ============================================
-- KIỂM TRA KẾT QUẢ
-- ============================================
SELECT
  p.user_id,
  COUNT(*)                        AS so_san_pham,
  SUM(p.stock)                    AS tong_ton_kho,
  SUM(p.stock * p.sell_price)     AS tri_gia_kho
FROM products p
WHERE p.user_id IN (
  'f4c8a774-aaaa-43f8-a60b-40b31cc6fd40',
  '1b3d97b6-bbbb-4df9-b5f3-4caf0d0321c5',
  'de44dc21-cccc-425c-b996-2ac7b8b6e9f3'
)
GROUP BY p.user_id
ORDER BY p.user_id;