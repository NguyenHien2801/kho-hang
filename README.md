# 🏪 Kho Hàng Thông Minh

Hệ thống quản lý kho tự động với AI dự đoán tồn kho và cảnh báo Telegram/Zalo.

## ✨ Tính năng

- 📋 **Bảng kho realtime** — CRUD sản phẩm, theo dõi tồn kho
- 📷 **Quét mã vạch** — Camera điện thoại (html5-qrcode), hỗ trợ EAN-13, QR, Code128
- 🤖 **AI dự đoán** — Linear Regression 30 ngày + Grok/Claude API phân tích
- 🔔 **Cảnh báo tự động** — Telegram Bot + Zalo OA
- ⏰ **Cron job** — Tự động gửi cảnh báo mỗi 8h sáng (Vercel Cron)

## 🛠 Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL) |
| AI | Grok API (x.ai) hoặc Claude API |
| Charts | Recharts |
| Scanner | html5-qrcode |
| Deploy | Vercel (miễn phí) |

---

## 🚀 Hướng dẫn chạy local

### 1. Clone & cài đặt

```bash
git clone <your-repo>
cd kho-hang-thong-minh
npm install
```

### 2. Tạo Supabase project

1. Vào [supabase.com](https://supabase.com) → New Project
2. Vào **SQL Editor** → paste toàn bộ nội dung file `supabase/migrations/001_init.sql` → Run
3. Vào **Settings → API** → copy URL và anon key

### 3. Cấu hình biến môi trường

```bash
cp .env.local.example .env.local
# Mở .env.local và điền các giá trị
```

Các biến bắt buộc:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 4. Chạy dev server

```bash
npm run dev
# Mở http://localhost:3000
```

---

## ☁️ Deploy lên Vercel

### Bước 1: Push code lên GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/kho-hang.git
git push -u origin main
```

### Bước 2: Import vào Vercel

1. Vào [vercel.com](https://vercel.com) → New Project
2. Import từ GitHub → chọn repo
3. **Framework Preset**: Next.js (tự nhận)
4. **Environment Variables**: điền tất cả từ `.env.local`
5. Click **Deploy**

### Bước 3: Gắn domain & SSL

1. Vercel tự cấp SSL miễn phí cho mọi domain
2. Vào **Settings → Domains** → Add Domain
3. Nhập domain của bạn (VD: `khohang.yourdomain.com`)
4. Vercel sẽ hiển thị DNS records cần thêm
5. Vào nhà cung cấp domain → thêm CNAME record theo hướng dẫn
6. Chờ 5-10 phút → SSL tự động kích hoạt ✅

---

## 📱 Cấu hình Telegram Bot

```
1. Nhắn tin @BotFather → /newbot
2. Đặt tên bot → copy BOT_TOKEN
3. Nhắn "hello" với bot của bạn
4. Mở: https://api.telegram.org/bot<TOKEN>/getUpdates
5. Copy "chat":{"id": ...} → đó là TELEGRAM_CHAT_ID
```

## 💬 Cấu hình Zalo OA

```
1. Vào developers.zalo.me
2. Tạo Official Account app
3. Vào API Explorer → lấy access_token
4. User nhắn tin với OA → lấy user_id
```

---

## 🤖 Cấu hình AI

**Grok API (khuyến nghị):**
```
AI_PROVIDER=grok
GROK_API_KEY=xai-... (lấy từ console.x.ai)
```

**Claude API:**
```
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-... (lấy từ console.anthropic.com)
```

---

## 📊 Thuật toán Linear Regression

```
Dữ liệu: 30 ngày bán hàng gần nhất
y = a + b*x  (x = ngày thứ i, y = số lượng bán)

b = Σ(xi - x̄)(yi - ȳ) / Σ(xi - x̄)²  ← hệ số góc (xu hướng)
a = ȳ - b*x̄                            ← điểm cắt

Dự đoán: ngày hết hàng = tồn kho / mức bán dự kiến
```

---

## 📁 Cấu trúc project

```
src/
├── app/
│   ├── dashboard/       # Trang tổng quan
│   ├── inventory/       # Quản lý kho
│   ├── scan/            # Quét mã vạch
│   ├── predict/         # Biểu đồ AI
│   ├── alerts/          # Cảnh báo
│   ├── settings/        # Cài đặt
│   └── api/
│       ├── products/    # CRUD sản phẩm
│       ├── scan/        # Lookup barcode
│       ├── predict/     # AI prediction
│       ├── alerts/      # Gửi cảnh báo
│       └── webhook/cron # Cron job tự động
├── components/ui/       # Sidebar, shared components
├── lib/
│   ├── supabase.ts      # DB client
│   ├── prediction.ts    # Linear regression engine
│   └── alerts.ts        # Telegram + Zalo
└── types/index.ts       # TypeScript types
```

---

## 📝 Nộp bài

- **Deadline**: trước 24h ngày 02/04/2026
- Upload toàn bộ code lên Google Drive (để công khai)
- Hoặc push lên GitHub public repo
- Quay video phân tích ý tưởng code

---

## 👨‍💻 Phát triển thêm

- [ ] Authentication (đăng nhập user)
- [ ] Xuất báo cáo Excel/PDF
- [ ] Nhập hàng loạt từ file Excel
- [ ] PWA — cài như app trên điện thoại
- [ ] Multi-store (nhiều cửa hàng)
