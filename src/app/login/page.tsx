'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowRight, Package, TrendingUp, Shield, Zap } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

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
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,700&family=Geist:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --g900: #14532d;
          --g800: #166534;
          --g700: #15803d;
          --g600: #16a34a;
          --g500: #22c55e;
          --g400: #4ade80;
          --g200: #bbf7d0;
          --g100: #dcfce7;
          --g50:  #f0fdf4;
          --n950: #0a0a0a;
          --n900: #171717;
          --n800: #262626;
          --n700: #404040;
          --n600: #525252;
          --n500: #737373;
          --n400: #a3a3a3;
          --n300: #d4d4d4;
          --n200: #e5e5e5;
          --n100: #f5f5f5;
          --n50:  #fafafa;
          --white: #ffffff;
        }

        .login-root {
          min-height: 100vh;
          display: flex;
          font-family: 'Geist', sans-serif;
          background: var(--white);
          position: relative;
          overflow: hidden;
        }

        /* ── Decorative background ── */
        .bg-wrap {
          position: fixed; inset: 0;
          pointer-events: none; z-index: 0; overflow: hidden;
        }
        .bg-blob {
          position: absolute; border-radius: 50%; filter: blur(80px);
        }
        .b1 {
          width: 640px; height: 640px;
          background: radial-gradient(circle, rgba(34,197,94,0.09) 0%, transparent 70%);
          top: -220px; left: -160px;
        }
        .b2 {
          width: 420px; height: 420px;
          background: radial-gradient(circle, rgba(187,247,208,0.45) 0%, transparent 70%);
          bottom: -140px; left: 180px;
        }
        .b3 {
          width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(74,222,128,0.07) 0%, transparent 70%);
          top: 55%; right: 6%;
        }
        .bg-dots {
          position: fixed; inset: 0;
          pointer-events: none; z-index: 0;
          background-image: radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px);
          background-size: 22px 22px;
          mask-image: radial-gradient(ellipse 65% 65% at 28% 38%, black 0%, transparent 100%);
        }

        /* ── LEFT PANEL ── */
        .lp {
          display: none; flex: 1;
          flex-direction: column;
          justify-content: space-between;
          padding: 52px 56px;
          position: relative; z-index: 1;
        }
        @media (min-width: 960px) { .lp { display: flex; } }

        .lp-logo {
          display: flex; align-items: center; gap: 13px;
          opacity: 0;
          animation: fu 0.7s 0.05s cubic-bezier(.16,1,.3,1) forwards;
        }
        .lp-mark {
          width: 44px; height: 44px;
          background: linear-gradient(140deg, var(--g800), var(--g500));
          border-radius: 13px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 20px rgba(22,163,74,.25), 0 1px 0 rgba(255,255,255,.2) inset;
          flex-shrink: 0;
        }
        .lp-brand {
          font-family: 'Playfair Display', serif;
          font-size: 17px; font-weight: 700;
          color: var(--n900); letter-spacing: -.2px;
        }
        .lp-brand-sub {
          font-size: 11.5px; color: var(--n400);
          margin-top: 1px; font-weight: 400; letter-spacing: .3px;
        }

        .lp-hero {
          opacity: 0;
          animation: fu 0.8s 0.2s cubic-bezier(.16,1,.3,1) forwards;
        }
        .lp-pill {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--g50); border: 1px solid var(--g200);
          border-radius: 100px; padding: 6px 14px 6px 8px;
          font-size: 12px; color: var(--g700);
          font-weight: 500; margin-bottom: 28px; letter-spacing: .2px;
        }
        .pill-ring {
          width: 22px; height: 22px; background: var(--g100);
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
        }
        .pill-ring::after {
          content: ''; width: 7px; height: 7px;
          background: var(--g600); border-radius: 50%;
          animation: plive 2.2s infinite;
        }
        @keyframes plive {
          0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,.35); }
          60%      { box-shadow: 0 0 0 6px rgba(22,163,74,0); }
        }

        .lp-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(38px, 4vw, 56px);
          font-weight: 800;
          color: var(--n900);
          line-height: 1.1; letter-spacing: -1px;
          margin-bottom: 20px;
        }
        .lp-title em {
          font-style: italic; color: var(--g700);
        }
        .lp-desc {
          font-size: 15px; color: var(--n500);
          line-height: 1.8; max-width: 360px; font-weight: 300;
        }

        .feat-list {
          display: flex; flex-direction: column; gap: 12px;
          margin-top: 34px; opacity: 0;
          animation: fu 0.8s 0.35s cubic-bezier(.16,1,.3,1) forwards;
        }
        .feat-item {
          display: flex; align-items: center; gap: 13px;
          font-size: 14px; color: var(--n600); font-weight: 400;
        }
        .feat-icon {
          width: 32px; height: 32px;
          background: var(--g50); border: 1px solid var(--g100);
          border-radius: 9px; display: flex; align-items: center; justify-content: center;
          color: var(--g600); flex-shrink: 0;
        }

        .lp-stats {
          display: flex; gap: 14px; opacity: 0;
          animation: fu 0.8s 0.5s cubic-bezier(.16,1,.3,1) forwards;
        }
        .sc {
          flex: 1; background: var(--white);
          border: 1.5px solid var(--n200);
          border-radius: 14px; padding: 18px 18px;
          box-shadow: 0 1px 4px rgba(0,0,0,.05);
          transition: box-shadow .2s, border-color .2s, transform .2s;
          cursor: default;
        }
        .sc:hover {
          border-color: var(--g200);
          box-shadow: 0 6px 22px rgba(22,163,74,.1);
          transform: translateY(-2px);
        }
        .sc-num {
          font-family: 'Playfair Display', serif;
          font-size: 25px; font-weight: 800;
          color: var(--n900); letter-spacing: -.5px; line-height: 1;
        }
        .sc-num span { color: var(--g600); }
        .sc-lbl {
          font-size: 11.5px; color: var(--n400);
          margin-top: 5px; font-weight: 400; line-height: 1.4;
        }

        /* ── SEPARATOR ── */
        .sep {
          display: none; width: 1px; flex-shrink: 0;
          align-self: stretch; margin: 60px 0;
          background: linear-gradient(to bottom,
            transparent 0%, var(--n200) 15%, var(--g200) 50%, var(--n200) 85%, transparent 100%
          );
          position: relative; z-index: 1;
        }
        @media (min-width: 960px) { .sep { display: block; } }

        /* ── RIGHT PANEL ── */
        .rp {
          display: flex; align-items: center; justify-content: center;
          padding: 40px 28px;
          position: relative; z-index: 1;
          width: 100%; background: var(--white);
        }
        @media (min-width: 960px) { .rp { width: 476px; flex-shrink: 0; } }

        .form-wrap {
          width: 100%; max-width: 396px;
          opacity: 0;
          animation: fu 0.8s 0.12s cubic-bezier(.16,1,.3,1) forwards;
        }

        .hdr { margin-bottom: 30px; }
        .hdr-eye {
          font-size: 11px; font-weight: 600; letter-spacing: 2px;
          text-transform: uppercase; color: var(--g600); margin-bottom: 10px;
        }
        .hdr-title {
          font-family: 'Playfair Display', serif;
          font-size: 30px; font-weight: 800;
          color: var(--n900); letter-spacing: -.5px;
          line-height: 1.15; margin-bottom: 7px;
        }
        .hdr-sub {
          font-size: 14px; color: var(--n400);
          font-weight: 300; line-height: 1.6;
        }

        /* Google button */
        .gbtn {
          width: 100%; display: flex; align-items: center;
          justify-content: center; gap: 10px;
          padding: 12px 18px; border-radius: 13px;
          border: 1.5px solid var(--n200); background: var(--white);
          color: var(--n700); font-size: 14px; font-weight: 500;
          cursor: pointer; transition: all .18s ease;
          font-family: 'Geist', sans-serif; margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,.05);
          letter-spacing: .1px;
        }
        .gbtn:hover {
          border-color: var(--n300);
          box-shadow: 0 4px 14px rgba(0,0,0,.07);
          background: var(--n50);
        }
        .gbtn:disabled { opacity: .4; cursor: not-allowed; }

        /* Divider */
        .div {
          display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
        }
        .div-line { flex: 1; height: 1px; background: var(--n100); }
        .div span {
          font-size: 11.5px; color: var(--n400); font-weight: 400;
          letter-spacing: .3px; white-space: nowrap;
        }

        /* Fields */
        .field { margin-bottom: 15px; }
        .field label {
          display: block; font-size: 11.5px; font-weight: 600;
          color: var(--n700); margin-bottom: 7px;
          letter-spacing: .6px; text-transform: uppercase;
        }
        .fi { position: relative; }
        .fi-ico {
          position: absolute; left: 14px; top: 50%;
          transform: translateY(-50%); color: var(--n400);
          pointer-events: none; transition: color .2s;
        }
        .fi:focus-within .fi-ico { color: var(--g600); }
        .field input {
          width: 100%; background: var(--n50);
          border: 1.5px solid var(--n200); border-radius: 10px;
          padding: 12px 42px; font-size: 14.5px;
          color: var(--n900); font-family: 'Geist', sans-serif;
          outline: none; transition: all .2s ease;
          caret-color: var(--g600); font-weight: 400;
        }
        .field input::placeholder { color: var(--n400); font-weight: 300; }
        .field input:focus {
          border-color: var(--g500); background: var(--white);
          box-shadow: 0 0 0 4px rgba(34,197,94,.09);
        }
        .eye {
          position: absolute; right: 14px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: var(--n400); display: flex; align-items: center;
          transition: color .15s; padding: 0;
        }
        .eye:hover { color: var(--n700); }

        /* Forgot */
        .forgot {
          display: flex; justify-content: flex-end;
          margin-top: -7px; margin-bottom: 18px;
        }
        .forgot a {
          font-size: 12.5px; color: var(--g700); font-weight: 500;
          text-decoration: none; transition: color .15s;
        }
        .forgot a:hover { color: var(--g600); }

        /* Error */
        .err {
          background: #fff5f5; border: 1.5px solid #fed7d7;
          border-radius: 10px; padding: 11px 14px;
          font-size: 13.5px; color: #c53030; margin-bottom: 13px;
          display: flex; align-items: center; gap: 10px;
          animation: shake .35s cubic-bezier(.36,.07,.19,.97);
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-4px); }
          40%,80% { transform: translateX(4px); }
        }
        .err-ico {
          width: 18px; height: 18px; background: #fed7d7;
          border-radius: 50%; display: flex; align-items: center;
          justify-content: center; font-size: 11px;
          font-weight: 800; color: #c53030; flex-shrink: 0;
        }

        /* Submit */
        .sbtn {
          width: 100%;
          background: linear-gradient(140deg, var(--g900) 0%, var(--g600) 100%);
          color: white; border: none; border-radius: 13px;
          padding: 13px 20px; font-size: 14.5px; font-weight: 600;
          cursor: pointer; font-family: 'Geist', sans-serif;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          box-shadow: 0 4px 18px rgba(22,163,74,.28), 0 1px 0 rgba(255,255,255,.12) inset;
          transition: all .22s cubic-bezier(.16,1,.3,1);
          letter-spacing: .15px; position: relative; overflow: hidden;
        }
        .sbtn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,.13) 0%, transparent 55%);
        }
        .sbtn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(22,163,74,.36), 0 1px 0 rgba(255,255,255,.15) inset;
        }
        .sbtn:active { transform: translateY(0); }
        .sbtn:disabled { opacity: .5; cursor: not-allowed; transform: none; }
        .sbtn > * { position: relative; z-index: 1; }
        .arr { transition: transform .18s ease; }
        .sbtn:hover .arr { transform: translateX(4px); }

        /* Register */
        .reg {
          text-align: center; margin-top: 20px;
          font-size: 13.5px; color: var(--n400);
        }
        .reg a {
          color: var(--g700); font-weight: 600;
          text-decoration: none; transition: color .15s;
        }
        .reg a:hover { color: var(--g600); }

        /* Trust row */
        .trust {
          display: flex; align-items: center; justify-content: center;
          gap: 20px; margin-top: 26px; padding-top: 20px;
          border-top: 1px solid var(--n100);
        }
        .ti {
          display: flex; align-items: center; gap: 5px;
          font-size: 11px; color: var(--n400); font-weight: 400;
        }
        .td { width: 5px; height: 5px; background: var(--g400); border-radius: 50%; flex-shrink: 0; }

        /* Animations */
        @keyframes fu {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin .75s linear infinite; }
      `}</style>

      {/* BG */}
      <div className="bg-wrap">
        <div className="bg-blob b1" /><div className="bg-blob b2" /><div className="bg-blob b3" />
      </div>
      <div className="bg-dots" />

      <div className="login-root">

        {/* LEFT */}
        <div className="lp">
          <div className="lp-logo">
            <div className="lp-mark"><Package size={20} color="white" /></div>
            <div>
              <div className="lp-brand">KhoHàng Pro</div>
              <div className="lp-brand-sub">Warehouse Management System</div>
            </div>
          </div>

          <div className="lp-hero">
            <div className="lp-pill"><span className="pill-ring" />Hệ thống đang hoạt động</div>
            <h1 className="lp-title">Kho thông minh.<br />Vận hành <em>hoàn hảo.</em></h1>
            <p className="lp-desc">Theo dõi tồn kho theo thời gian thực, tự động hoá đơn hàng và tối ưu chuỗi cung ứng — mọi thứ trong một nền tảng duy nhất.</p>
            <div className="feat-list">
              {[
                [<TrendingUp size={14} />, 'Báo cáo & phân tích thời gian thực'],
                [<Zap size={14} />, 'Tự động hoá quy trình nhập xuất kho'],
                [<Shield size={14} />, 'Bảo mật dữ liệu chuẩn doanh nghiệp ISO'],
              ].map(([icon, text], i) => (
                <div key={i} className="feat-item">
                  <span className="feat-icon">{icon}</span>{text}
                </div>
              ))}
            </div>
          </div>

          <div className="lp-stats">
            {[['99.9','%','Uptime đảm bảo'],['2.4k','+','Doanh nghiệp tin dùng'],['50','ms','Độ trễ trung bình']].map(([n,u,l],i) => (
              <div key={i} className="sc">
                <div className="sc-num"><span>{n}</span>{u}</div>
                <div className="sc-lbl">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="sep" />

        {/* RIGHT */}
        <div className="rp">
          <div className="form-wrap">
            <div className="hdr">
              <div className="hdr-eye">Đăng nhập</div>
              <h2 className="hdr-title">Chào mừng trở lại 👋</h2>
              <p className="hdr-sub">Quản lý kho hàng của bạn ngay hôm nay</p>
            </div>

            <button className="gbtn" onClick={handleGoogle} disabled={loading}>
              <svg width="17" height="17" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3.5-11.2-8.3l-6.5 5C9.5 39.5 16.3 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41.3 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
              </svg>
              Tiếp tục với Google
            </button>

            <div className="div">
              <div className="div-line" /><span>hoặc đăng nhập bằng email</span><div className="div-line" />
            </div>

            <form onSubmit={handleLogin}>
              <div className="field">
                <label>Email</label>
                <div className="fi">
                  <span className="fi-ico"><Mail size={14} /></span>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@congty.com" autoComplete="email" />
                </div>
              </div>
              <div className="field">
                <label>Mật khẩu</label>
                <div className="fi">
                  <span className="fi-ico"><Lock size={14} /></span>
                  <input type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••" style={{ paddingRight: '42px' }} autoComplete="current-password" />
                  <button type="button" className="eye" onClick={() => setShowPw(v => !v)}>
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="forgot"><Link href="/forgot-password">Quên mật khẩu?</Link></div>

              {error && (
                <div className="err">
                  <span className="err-ico">!</span>{error}
                </div>
              )}

              <button type="submit" className="sbtn" disabled={loading}>
                {loading
                  ? <Loader2 size={15} className="spin" />
                  : <><span>Đăng nhập</span><ArrowRight size={14} className="arr" /></>
                }
              </button>
            </form>

            <p className="reg">Chưa có tài khoản?{' '}<Link href="/register">Đăng ký miễn phí →</Link></p>

            <div className="trust">
              {['SSL bảo mật', 'GDPR compliant', 'ISO 27001'].map((t, i) => (
                <span key={i} className="ti"><span className="td" />{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}