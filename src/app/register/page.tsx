'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowRight, Package, CheckCircle2, Shield, Zap, TrendingUp } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [showCf, setShowCf]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)

  const pwStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3
  const pwLabels   = ['', 'Yếu', 'Trung bình', 'Mạnh']
  const pwColors   = ['', '#ef4444', '#f59e0b', '#22c55e']

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Mật khẩu xác nhận không khớp.'); return }
    if (password.length < 6)  { setError('Mật khẩu phải có ít nhất 6 ký tự.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else       { setSuccess(true); setLoading(false) }
  }

  async function handleGoogle() {
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/dashboard` },
    })
    if (error) { setError('Đăng ký Google thất bại.'); setLoading(false) }
  }

  /* ── SUCCESS STATE ── */
  if (success) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Geist:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Geist', sans-serif; }
        .success-root {
          min-height: 100vh; min-height: 100dvh;
          background: var(--white);
          display: flex; align-items: center; justify-content: center;
          padding: 32px 20px;
          font-family: 'Geist', sans-serif;
        }
        :root {
          --g700: #15803d; --g600: #16a34a; --g500: #22c55e;
          --g100: #dcfce7; --g50: #f0fdf4;
          --n900: #171717; --n500: #737373; --n400: #a3a3a3; --n200: #e5e5e5;
          --white: #ffffff;
        }
        .success-card {
          text-align: center; max-width: 360px; width: 100%;
          background: var(--white);
          border: 1.5px solid var(--n200);
          border-radius: 24px; padding: 48px 36px;
          box-shadow: 0 8px 40px rgba(0,0,0,.07);
          animation: pop .6s cubic-bezier(.16,1,.3,1) forwards;
        }
        @keyframes pop { from { opacity:0; transform: scale(.95) translateY(16px); } to { opacity:1; transform: scale(1) translateY(0); } }
        .success-icon {
          width: 72px; height: 72px;
          background: var(--g50); border: 2px solid var(--g100);
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          margin: 0 auto 24px; color: var(--g600);
          animation: icon-in .5s .15s cubic-bezier(.16,1,.3,1) both;
        }
        @keyframes icon-in { from { transform: scale(0); } to { transform: scale(1); } }
        .success-title {
          font-family: 'Playfair Display', serif;
          font-size: 26px; font-weight: 800; color: var(--n900);
          letter-spacing: -.5px; margin-bottom: 10px;
        }
        .success-desc { font-size: 14px; color: var(--n500); line-height: 1.7; margin-bottom: 28px; font-weight: 300; }
        .success-desc strong { color: var(--n900); font-weight: 600; }
        .success-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(140deg, #166534, var(--g600));
          color: white; text-decoration: none;
          font-family: 'Geist', sans-serif; font-size: 14px; font-weight: 600;
          padding: 13px 28px; border-radius: 13px;
          box-shadow: 0 4px 18px rgba(22,163,74,.28);
          transition: all .2s;
        }
        .success-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(22,163,74,.36); }
      `}</style>
      <div className="success-root">
        <div className="success-card">
          <div className="success-icon"><CheckCircle2 size={34} /></div>
          <h2 className="success-title">Kiểm tra email nhé! 📬</h2>
          <p className="success-desc">
            Mình đã gửi link xác nhận đến<br />
            <strong>{email}</strong><br />
            Vui lòng xác nhận để kích hoạt tài khoản.
          </p>
          <Link href="/login" className="success-btn">
            Về trang đăng nhập <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </>
  )

  /* ── MAIN REGISTER PAGE ── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=Geist:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --g900: #14532d; --g800: #166534; --g700: #15803d; --g600: #16a34a;
          --g500: #22c55e; --g400: #4ade80; --g200: #bbf7d0; --g100: #dcfce7; --g50: #f0fdf4;
          --n900: #171717; --n800: #262626; --n700: #404040; --n600: #525252;
          --n500: #737373; --n400: #a3a3a3; --n300: #d4d4d4; --n200: #e5e5e5;
          --n100: #f5f5f5; --n50: #fafafa; --white: #ffffff;
        }

        .reg-root {
          min-height: 100vh; min-height: 100dvh;
          display: flex; font-family: 'Geist', sans-serif;
          background: var(--white); position: relative; overflow-x: hidden;
        }

        /* BG */
        .bg-wrap { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
        .bg-blob { position: absolute; border-radius: 50%; filter: blur(72px); }
        .b1 { width: 500px; height: 500px; background: radial-gradient(circle, rgba(34,197,94,.08) 0%, transparent 70%); top: -180px; left: -140px; }
        .b2 { width: 360px; height: 360px; background: radial-gradient(circle, rgba(187,247,208,.4) 0%, transparent 70%); bottom: -100px; right: 100px; }
        .bg-dots {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: radial-gradient(circle, rgba(0,0,0,.048) 1px, transparent 1px);
          background-size: 22px 22px;
          mask-image: radial-gradient(ellipse 55% 55% at 75% 40%, black 0%, transparent 100%);
        }

        /* ── LEFT PANEL ── */
        .lp {
          display: none; flex: 1; flex-direction: column;
          justify-content: space-between; padding: 52px 56px;
          position: relative; z-index: 1;
        }
        @media (min-width: 960px) { .lp { display: flex; } }

        .lp-logo {
          display: flex; align-items: center; gap: 13px;
          opacity: 0; animation: fu .7s .05s cubic-bezier(.16,1,.3,1) forwards;
        }
        .lp-mark {
          width: 44px; height: 44px;
          background: linear-gradient(140deg, var(--g800), var(--g500));
          border-radius: 13px; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 20px rgba(22,163,74,.25), 0 1px 0 rgba(255,255,255,.2) inset;
          flex-shrink: 0;
        }
        .lp-brand { font-family: 'Playfair Display', serif; font-size: 17px; font-weight: 700; color: var(--n900); }
        .lp-brand-sub { font-size: 11.5px; color: var(--n400); margin-top: 1px; font-weight: 400; }

        .lp-hero { opacity: 0; animation: fu .8s .2s cubic-bezier(.16,1,.3,1) forwards; }
        .lp-pill {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--g50); border: 1px solid var(--g200);
          border-radius: 100px; padding: 6px 14px 6px 8px;
          font-size: 12px; color: var(--g700); font-weight: 500; margin-bottom: 28px;
        }
        .pill-ring {
          width: 22px; height: 22px; background: var(--g100);
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
        }
        .pill-ring::after {
          content: ''; width: 7px; height: 7px; background: var(--g600); border-radius: 50%;
          animation: plive 2.2s infinite;
        }
        @keyframes plive { 0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,.35); } 60% { box-shadow: 0 0 0 6px rgba(22,163,74,0); } }

        .lp-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(36px, 3.8vw, 52px); font-weight: 800; color: var(--n900);
          line-height: 1.1; letter-spacing: -1px; margin-bottom: 20px;
        }
        .lp-title em { font-style: italic; color: var(--g700); }
        .lp-desc { font-size: 15px; color: var(--n500); line-height: 1.8; max-width: 360px; font-weight: 300; }

        .feat-list {
          display: flex; flex-direction: column; gap: 12px; margin-top: 34px;
          opacity: 0; animation: fu .8s .35s cubic-bezier(.16,1,.3,1) forwards;
        }
        .feat-item { display: flex; align-items: center; gap: 13px; font-size: 14px; color: var(--n600); }
        .feat-icon {
          width: 32px; height: 32px; background: var(--g50); border: 1px solid var(--g100);
          border-radius: 9px; display: flex; align-items: center; justify-content: center;
          color: var(--g600); flex-shrink: 0;
        }

        /* Testimonial card */
        .testimonial {
          background: var(--white); border: 1.5px solid var(--n200);
          border-radius: 18px; padding: 22px 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,.05);
          opacity: 0; animation: fu .8s .5s cubic-bezier(.16,1,.3,1) forwards;
        }
        .test-quote {
          font-size: 14px; color: var(--n600); line-height: 1.7;
          font-style: italic; font-weight: 300; margin-bottom: 14px;
        }
        .test-quote::before { content: '"'; color: var(--g500); font-size: 20px; font-style: normal; }
        .test-quote::after  { content: '"'; color: var(--g500); font-size: 20px; font-style: normal; }
        .test-author { display: flex; align-items: center; gap: 10px; }
        .test-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: linear-gradient(135deg, var(--g200), var(--g400));
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: var(--g900); flex-shrink: 0;
        }
        .test-name { font-size: 13px; font-weight: 600; color: var(--n900); }
        .test-role { font-size: 11.5px; color: var(--n400); margin-top: 1px; }
        .test-stars { margin-left: auto; color: #f59e0b; font-size: 12px; letter-spacing: 1px; }

        /* ── SEPARATOR ── */
        .sep {
          display: none; width: 1px; flex-shrink: 0; align-self: stretch; margin: 60px 0;
          background: linear-gradient(to bottom, transparent 0%, var(--n200) 15%, var(--g200) 50%, var(--n200) 85%, transparent 100%);
          position: relative; z-index: 1;
        }
        @media (min-width: 960px) { .sep { display: block; } }

        /* ── RIGHT PANEL ── */
        .rp {
          display: flex; align-items: center; justify-content: center;
          width: 100%; min-height: 100vh; min-height: 100dvh;
          padding: 28px 20px; position: relative; z-index: 1; background: var(--white);
        }
        @media (min-width: 960px) { .rp { width: 492px; flex-shrink: 0; min-height: unset; padding: 40px 36px; } }

        /* Mobile logo */
        .mob-logo {
          display: flex; align-items: center; gap: 10px; margin-bottom: 24px;
        }
        @media (min-width: 960px) { .mob-logo { display: none; } }
        .mob-mark {
          width: 38px; height: 38px;
          background: linear-gradient(140deg, var(--g800), var(--g500));
          border-radius: 11px; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 14px rgba(22,163,74,.22); flex-shrink: 0;
        }
        .mob-brand { font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 700; color: var(--n900); }
        .mob-sub { font-size: 10.5px; color: var(--n400); margin-top: 1px; }

        .form-wrap {
          width: 100%; max-width: 412px;
          opacity: 0; animation: fu .8s .12s cubic-bezier(.16,1,.3,1) forwards;
        }

        /* Header */
        .hdr { margin-bottom: 24px; }
        .hdr-eye { font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--g600); margin-bottom: 8px; }
        .hdr-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(22px, 5.5vw, 28px); font-weight: 800; color: var(--n900);
          letter-spacing: -.5px; line-height: 1.15; margin-bottom: 6px;
        }
        .hdr-sub { font-size: 13.5px; color: var(--n400); font-weight: 300; line-height: 1.6; }

        /* Google */
        .gbtn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 13px 18px; border-radius: 13px; border: 1.5px solid var(--n200); background: var(--white);
          color: var(--n700); font-size: 14px; font-weight: 500; cursor: pointer;
          transition: all .18s ease; font-family: 'Geist', sans-serif; margin-bottom: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,.05); -webkit-tap-highlight-color: transparent;
        }
        .gbtn:hover { border-color: var(--n300); box-shadow: 0 4px 14px rgba(0,0,0,.07); background: var(--n50); }
        .gbtn:active { background: var(--n100); }
        .gbtn:disabled { opacity: .4; cursor: not-allowed; }

        /* Divider */
        .div { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .div-line { flex: 1; height: 1px; background: var(--n100); }
        .div span { font-size: 11.5px; color: var(--n400); letter-spacing: .3px; white-space: nowrap; }

        /* Field */
        .field { margin-bottom: 13px; }
        .field label {
          display: block; font-size: 11px; font-weight: 600;
          color: var(--n700); margin-bottom: 6px; letter-spacing: .6px; text-transform: uppercase;
        }
        .fi { position: relative; }
        .fi-ico {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: var(--n400); pointer-events: none; transition: color .2s;
        }
        .fi:focus-within .fi-ico { color: var(--g600); }
        .field input {
          width: 100%; background: var(--n50); border: 1.5px solid var(--n200); border-radius: 10px;
          padding: 13px 42px; font-size: 16px; color: var(--n900);
          font-family: 'Geist', sans-serif; outline: none; transition: all .2s ease;
          caret-color: var(--g600); -webkit-tap-highlight-color: transparent;
          -webkit-appearance: none; appearance: none;
        }
        .field input::placeholder { color: var(--n400); font-weight: 300; }
        .field input:focus {
          border-color: var(--g500); background: var(--white);
          box-shadow: 0 0 0 4px rgba(34,197,94,.09);
        }
        .field input.has-error { border-color: #fca5a5; background: #fff5f5; }

        .eye {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: var(--n400);
          display: flex; align-items: center; transition: color .15s; padding: 4px;
          -webkit-tap-highlight-color: transparent;
        }
        .eye:hover { color: var(--n700); }

        /* Password strength bar */
        .pw-strength { margin-top: 7px; }
        .pw-bar-track {
          height: 3px; background: var(--n200); border-radius: 2px; overflow: hidden;
        }
        .pw-bar-fill {
          height: 100%; border-radius: 2px;
          transition: width .3s ease, background .3s ease;
        }
        .pw-label { font-size: 11px; color: var(--n400); margin-top: 4px; font-weight: 500; }

        /* Error */
        .err {
          background: #fff5f5; border: 1.5px solid #fed7d7; border-radius: 10px;
          padding: 11px 14px; font-size: 13.5px; color: #c53030; margin-bottom: 12px;
          display: flex; align-items: center; gap: 10px;
          animation: shake .35s cubic-bezier(.36,.07,.19,.97);
        }
        @keyframes shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-4px); } 40%,80% { transform: translateX(4px); } }
        .err-ico {
          width: 18px; height: 18px; background: #fed7d7; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 800; color: #c53030; flex-shrink: 0;
        }

        /* Submit */
        .sbtn {
          width: 100%; background: linear-gradient(140deg, var(--g900) 0%, var(--g600) 100%);
          color: white; border: none; border-radius: 13px; padding: 15px 20px;
          font-size: 15px; font-weight: 600; cursor: pointer; font-family: 'Geist', sans-serif;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          box-shadow: 0 4px 18px rgba(22,163,74,.28), 0 1px 0 rgba(255,255,255,.12) inset;
          transition: all .22s cubic-bezier(.16,1,.3,1); letter-spacing: .15px;
          position: relative; overflow: hidden; -webkit-tap-highlight-color: transparent;
        }
        .sbtn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,.13) 0%, transparent 55%);
        }
        .sbtn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(22,163,74,.36), 0 1px 0 rgba(255,255,255,.15) inset; }
        .sbtn:active { transform: scale(.98); }
        .sbtn:disabled { opacity: .5; cursor: not-allowed; transform: none; }
        .sbtn > * { position: relative; z-index: 1; }
        .arr { transition: transform .18s ease; }
        .sbtn:hover .arr { transform: translateX(4px); }

        /* Terms note */
        .terms {
          font-size: 11.5px; color: var(--n400); text-align: center; margin-top: 12px; line-height: 1.6;
        }
        .terms a { color: var(--g700); text-decoration: none; font-weight: 500; }
        .terms a:hover { color: var(--g600); }

        /* Login link */
        .login-link { text-align: center; margin-top: 18px; font-size: 13.5px; color: var(--n400); }
        .login-link a { color: var(--g700); font-weight: 600; text-decoration: none; transition: color .15s; }
        .login-link a:hover { color: var(--g600); }

        /* Trust */
        .trust {
          display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
          gap: 12px 18px; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--n100);
        }
        .ti { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--n400); }
        .td { width: 5px; height: 5px; background: var(--g400); border-radius: 50%; flex-shrink: 0; }

        @keyframes fu { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin .75s linear infinite; }

        @media (max-width: 359px) {
          .rp { padding: 20px 16px; }
          .hdr-title { font-size: 20px; }
          .field input { padding: 11px 38px; }
        }
      `}</style>

      {/* BG */}
      <div className="bg-wrap"><div className="bg-blob b1" /><div className="bg-blob b2" /></div>
      <div className="bg-dots" />

      <div className="reg-root">

        {/* ══ LEFT (desktop) ══ */}
        <div className="lp">
          <div className="lp-logo">
            <div className="lp-mark"><Package size={20} color="white" /></div>
            <div>
              <div className="lp-brand">KhoHàng Pro</div>
              <div className="lp-brand-sub">Warehouse Management System</div>
            </div>
          </div>

          <div className="lp-hero">
            <div className="lp-pill"><span className="pill-ring" />Miễn phí 30 ngày dùng thử</div>
            <h1 className="lp-title">Bắt đầu<br />hành trình <em>mới.</em></h1>
            <p className="lp-desc">Tham gia cùng hơn 2,400 doanh nghiệp đang tin dùng KhoHàng Pro để tối ưu vận hành kho mỗi ngày.</p>
            <div className="feat-list">
              {[
                [<TrendingUp size={14} />, 'Không cần thẻ tín dụng để bắt đầu'],
                [<Zap size={14} />,        'Cài đặt và sử dụng trong 5 phút'],
                [<Shield size={14} />,     'Dữ liệu được mã hoá & bảo vệ tuyệt đối'],
              ].map(([icon, text], i) => (
                <div key={i} className="feat-item">
                  <span className="feat-icon">{icon}</span>{text}
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial */}
          <div className="testimonial">
            <p className="test-quote">
              Từ khi dùng KhoHàng Pro, chúng tôi giảm được 40% thời gian kiểm kê và gần như không còn sai sót trong đơn hàng.
            </p>
            <div className="test-author">
              <div className="test-avatar">NM</div>
              <div>
                <div className="test-name">Nguyễn Minh Tuấn</div>
                <div className="test-role">Giám đốc vận hành, Cty TNHH Phúc Thịnh</div>
              </div>
              <div className="test-stars">★★★★★</div>
            </div>
          </div>
        </div>

        <div className="sep" />

        {/* ══ RIGHT (form) ══ */}
        <div className="rp">
          <div className="form-wrap">

            {/* Mobile logo */}
            <div className="mob-logo">
              <div className="mob-mark"><Package size={18} color="white" /></div>
              <div>
                <div className="mob-brand">KhoHàng Pro</div>
                <div className="mob-sub">Warehouse Management System</div>
              </div>
            </div>

            <div className="hdr">
              <div className="hdr-eye">Đăng ký</div>
              <h2 className="hdr-title">Tạo tài khoản miễn phí 🚀</h2>
              <p className="hdr-sub">Dùng thử 30 ngày, không cần thẻ tín dụng</p>
            </div>

            {/* Google */}
            <button className="gbtn" onClick={handleGoogle} disabled={loading}>
              <svg width="17" height="17" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3.5-11.2-8.3l-6.5 5C9.5 39.5 16.3 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41.3 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
              </svg>
              Đăng ký với Google
            </button>

            <div className="div"><div className="div-line" /><span>hoặc đăng ký bằng email</span><div className="div-line" /></div>

            <form onSubmit={handleRegister}>
              {/* Email */}
              <div className="field">
                <label>Email</label>
                <div className="fi">
                  <span className="fi-ico"><Mail size={14} /></span>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="ban@congty.com" autoComplete="email" inputMode="email" />
                </div>
              </div>

              {/* Password */}
              <div className="field">
                <label>Mật khẩu</label>
                <div className="fi">
                  <span className="fi-ico"><Lock size={14} /></span>
                  <input
                    type={showPw ? 'text' : 'password'} required value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Ít nhất 6 ký tự"
                    style={{ paddingRight: '48px' }}
                    autoComplete="new-password"
                    className={password && password.length < 6 ? 'has-error' : ''}
                  />
                  <button type="button" className="eye" onClick={() => setShowPw(v => !v)} aria-label="Hiện/ẩn mật khẩu">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="pw-strength">
                    <div className="pw-bar-track">
                      <div className="pw-bar-fill" style={{
                        width: `${(pwStrength / 3) * 100}%`,
                        background: pwColors[pwStrength],
                      }} />
                    </div>
                    <div className="pw-label" style={{ color: pwColors[pwStrength] }}>
                      {pwLabels[pwStrength]}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div className="field">
                <label>Xác nhận mật khẩu</label>
                <div className="fi">
                  <span className="fi-ico"><Lock size={14} /></span>
                  <input
                    type={showCf ? 'text' : 'password'} required value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    style={{ paddingRight: '48px' }}
                    autoComplete="new-password"
                    className={confirm && confirm !== password ? 'has-error' : ''}
                  />
                  <button type="button" className="eye" onClick={() => setShowCf(v => !v)} aria-label="Hiện/ẩn mật khẩu">
                    {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="err" role="alert">
                  <span className="err-ico">!</span>{error}
                </div>
              )}

              <button type="submit" className="sbtn" disabled={loading}>
                {loading
                  ? <Loader2 size={16} className="spin" />
                  : <><span>Tạo tài khoản</span><ArrowRight size={15} className="arr" /></>
                }
              </button>
            </form>

            <p className="terms">
              Bằng cách đăng ký, bạn đồng ý với{' '}
              <Link href="/terms">Điều khoản dịch vụ</Link> và{' '}
              <Link href="/privacy">Chính sách bảo mật</Link> của chúng tôi.
            </p>

            <p className="login-link">
              Đã có tài khoản?{' '}
              <Link href="/login">Đăng nhập →</Link>
            </p>

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