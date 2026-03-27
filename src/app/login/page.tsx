'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email hoặc mật khẩu không đúng.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  async function handleGoogle() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/dashboard` },
    })
    if (error) {
      setError('Đăng nhập Google thất bại.')
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          display: flex;
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: #f8f9fb;
        }

        /* ── Left decorative panel ── */
        .left-panel {
          display: none;
          flex: 1;
          background: linear-gradient(145deg, #0f4c2a 0%, #1a7a45 50%, #22c55e 100%);
          position: relative;
          overflow: hidden;
          align-items: center;
          justify-content: center;
          padding: 48px;
        }
        @media (min-width: 900px) { .left-panel { display: flex; } }

        .left-panel::before {
          content: '';
          position: absolute;
          width: 600px; height: 600px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
          top: -200px; right: -200px;
        }
        .left-panel::after {
          content: '';
          position: absolute;
          width: 400px; height: 400px;
          border-radius: 50%;
          background: rgba(255,255,255,0.04);
          bottom: -150px; left: -100px;
        }

        .left-dots {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px);
          background-size: 32px 32px;
        }

        .left-content {
          position: relative;
          z-index: 1;
          color: white;
          max-width: 360px;
        }
        .left-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 100px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 32px;
          backdrop-filter: blur(8px);
        }
        .left-badge-dot {
          width: 6px; height: 6px;
          background: #86efac;
          border-radius: 50%;
          animation: pulse-dot 2s infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
        .left-title {
          font-size: 36px;
          font-weight: 800;
          line-height: 1.2;
          margin-bottom: 16px;
          letter-spacing: -0.5px;
        }
        .left-title span { color: #86efac; }
        .left-desc {
          font-size: 15px;
          color: rgba(255,255,255,0.7);
          line-height: 1.7;
          margin-bottom: 40px;
        }

        .stat-row {
          display: flex;
          gap: 24px;
        }
        .stat-card {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 16px;
          padding: 16px 20px;
          backdrop-filter: blur(8px);
          flex: 1;
        }
        .stat-num {
          font-size: 24px;
          font-weight: 800;
          color: #86efac;
        }
        .stat-label {
          font-size: 12px;
          color: rgba(255,255,255,0.6);
          margin-top: 2px;
        }

        /* ── Right panel (form) ── */
        .right-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
          background: #ffffff;
          min-height: 100vh;
        }
        @media (min-width: 900px) { .right-panel { max-width: 520px; } }

        .form-wrap {
          width: 100%;
          max-width: 380px;
        }

        /* Logo */
        .logo-area {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 36px;
        }
        .logo-icon {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, #16a34a, #22c55e);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 15px;
          box-shadow: 0 8px 20px rgba(34,197,94,0.3);
          flex-shrink: 0;
        }
        .logo-text-main {
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.3px;
        }
        .logo-text-sub {
          font-size: 12px;
          color: #9ca3af;
          margin-top: 1px;
        }

        /* Heading */
        .heading { margin-bottom: 28px; }
        .heading h2 {
          font-size: 26px;
          font-weight: 800;
          color: #111827;
          letter-spacing: -0.5px;
          margin-bottom: 6px;
        }
        .heading p {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.6;
        }

        /* Google btn */
        .google-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 11px 16px;
          border-radius: 12px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          color: #374151;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s ease;
          margin-bottom: 24px;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .google-btn:hover {
          border-color: #d1d5db;
          background: #f9fafb;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .google-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Divider */
        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        .divider-line { flex: 1; height: 1px; background: #f3f4f6; }
        .divider span { font-size: 12px; color: #d1d5db; font-weight: 500; }

        /* Field */
        .field { margin-bottom: 18px; }
        .field label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
        }
        .field-inner {
          position: relative;
        }
        .field-icon {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          transition: color 0.15s;
          pointer-events: none;
        }
        .field-inner:focus-within .field-icon { color: #16a34a; }

        .field input {
          width: 100%;
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          padding: 11px 40px 11px 40px;
          font-size: 14px;
          color: #111827;
          font-family: 'Plus Jakarta Sans', sans-serif;
          outline: none;
          transition: all 0.18s ease;
        }
        .field input::placeholder { color: #d1d5db; }
        .field input:focus {
          border-color: #22c55e;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.1);
        }

        .eye-btn {
          position: absolute;
          right: 13px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #9ca3af;
          display: flex; align-items: center;
          transition: color 0.15s;
          padding: 0;
        }
        .eye-btn:hover { color: #4b5563; }

        /* Forgot link */
        .forgot-row {
          display: flex;
          justify-content: flex-end;
          margin-top: -10px;
          margin-bottom: 18px;
        }
        .forgot-row a {
          font-size: 12px;
          color: #16a34a;
          font-weight: 600;
          text-decoration: none;
          transition: color 0.15s;
        }
        .forgot-row a:hover { color: #15803d; }

        /* Error */
        .error-box {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          color: #dc2626;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .error-dot {
          width: 6px; height: 6px;
          background: #ef4444;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Submit btn */
        .submit-btn {
          width: 100%;
          background: linear-gradient(135deg, #16a34a, #22c55e);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(34,197,94,0.35);
          transition: all 0.2s ease;
          letter-spacing: 0.1px;
        }
        .submit-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(34,197,94,0.45);
          background: linear-gradient(135deg, #15803d, #16a34a);
        }
        .submit-btn:active { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        /* Arrow icon animation */
        .arrow-icon { transition: transform 0.18s ease; }
        .submit-btn:hover .arrow-icon { transform: translateX(3px); }

        /* Register link */
        .register-link {
          text-align: center;
          margin-top: 22px;
          font-size: 13px;
          color: #9ca3af;
        }
        .register-link a {
          color: #16a34a;
          font-weight: 700;
          text-decoration: none;
          transition: color 0.15s;
        }
        .register-link a:hover { color: #15803d; }

        /* Spin animation */
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.7s linear infinite; }
      `}</style>

      <div className="login-root">
        {/* ── Left decorative panel ── */}
        <div className="left-panel">
          <div className="left-dots" />
          <div className="left-content">
            <div className="left-badge">
              <span className="left-badge-dot" />
              Hệ thống quản lý kho
            </div>
            <h2 className="left-title">
              Quản lý kho hàng<br /><span>thông minh hơn</span>
            </h2>
            <p className="left-desc">
              Theo dõi hàng tồn kho, quản lý đơn hàng và tối ưu chuỗi cung ứng của bạn trong một nền tảng duy nhất.
            </p>
            <div className="stat-row">
              <div className="stat-card">
                <div className="stat-num">99.9%</div>
                <div className="stat-label">Uptime đảm bảo</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">2.4k+</div>
                <div className="stat-label">Doanh nghiệp tin dùng</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="right-panel">
          <div className="form-wrap">

            {/* Logo */}
            <div className="logo-area">
              <div className="logo-icon">KH</div>
              <div>
                <div className="logo-text-main">Kho Hàng Thông Minh</div>
                <div className="logo-text-sub">Warehouse Management System</div>
              </div>
            </div>

            {/* Heading */}
            <div className="heading">
              <h2>Chào mừng trở lại 👋</h2>
              <p>Đăng nhập để quản lý kho hàng của bạn</p>
            </div>

            {/* Google */}
            <button className="google-btn" onClick={handleGoogle} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3.5-11.2-8.3l-6.5 5C9.5 39.5 16.3 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41.3 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
              </svg>
              Tiếp tục với Google
            </button>

            {/* Divider */}
            <div className="divider">
              <div className="divider-line" />
              <span>hoặc đăng nhập bằng email</span>
              <div className="divider-line" />
            </div>

            {/* Form */}
            <form onSubmit={handleLogin}>
              <div className="field">
                <label>Email</label>
                <div className="field-inner">
                  <span className="field-icon">
                    <Mail size={15} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ban@email.com"
                  />
                </div>
              </div>

              <div className="field">
                <label>Mật khẩu</label>
                <div className="field-inner">
                  <span className="field-icon">
                    <Lock size={15} />
                  </span>
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ paddingRight: '40px' }}
                  />
                  <button type="button" className="eye-btn" onClick={() => setShowPw(v => !v)}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="forgot-row">
                <Link href="/forgot-password">Quên mật khẩu?</Link>
              </div>

              {error && (
                <div className="error-box">
                  <span className="error-dot" />
                  {error}
                </div>
              )}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading
                  ? <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} />
                  : <>Đăng nhập <ArrowRight size={15} className="arrow-icon" /></>
                }
              </button>
            </form>

            <p className="register-link">
              Chưa có tài khoản?{' '}
              <Link href="/register">Đăng ký ngay</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}