'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Package, ScanLine, TrendingUp,
  Bell, Settings, ChevronRight, Menu, X, LogOut, User
} from 'lucide-react'
import clsx from 'clsx'
import { supabase } from '@/lib/supabase'

const nav = [
  { href: '/dashboard', label: 'Tổng quan',   icon: LayoutDashboard },
  { href: '/inventory', label: 'Quản lý kho', icon: Package },
  { href: '/scan',      label: 'Quét mã vạch', icon: ScanLine },
  { href: '/predict',   label: 'AI Dự đoán',   icon: TrendingUp },
  { href: '/alerts',    label: 'Cảnh báo',     icon: Bell },
]

export default function Sidebar() {
  const path     = usePathname()
  const router   = useRouter()
  const [open,   setOpen]  = useState(false)
  const [user,   setUser]  = useState<{ email?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Đóng drawer khi đổi trang
  useEffect(() => { setOpen(false) }, [path])

  async function handleLogout() {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const SidebarContent = () => (
    <aside className="w-60 h-full bg-gray-900 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            KH
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Kho Hàng</p>
            <p className="text-gray-400 text-xs">Thông Minh</p>
          </div>
        </div>
        {/* Nút đóng — chỉ hiện trên mobile */}
        <button
          onClick={() => setOpen(false)}
          className="md:hidden text-gray-400 hover:text-white p-1 rounded"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(item => {
          const active = path.startsWith(item.href)
          const Icon   = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon size={18} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight size={14} />}
            </Link>
          )
        })}
      </nav>

      {/* Footer — user info + logout */}
      <div className="px-3 py-4 border-t border-gray-700 space-y-1">
        {/* User info */}
        {user && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800 mb-2">
            <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
              <User size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {user.email?.split('@')[0]}
              </p>
              <p className="text-gray-500 text-xs truncate">{user.email}</p>
            </div>
          </div>
        )}

        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
        >
          <Settings size={18} />
          Cài đặt
        </Link>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loading}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-all"
        >
          <LogOut size={18} />
          {loading ? 'Đang thoát...' : 'Đăng xuất'}
        </button>

        <p className="text-gray-600 text-xs text-center mt-2">v1.0.0</p>
      </div>
    </aside>
  )

  return (
    <>
      {/* ── MOBILE: Hamburger button ── */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white shadow-lg border border-gray-700"
      >
        <Menu size={20} />
      </button>

      {/* ── MOBILE: Overlay + Drawer ── */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* Drawer trượt từ trái */}
          <div className="relative z-50 h-full animate-slide-in">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* ── DESKTOP: Sidebar tĩnh ── */}
      <div className="hidden md:flex h-screen sticky top-0">
        <SidebarContent />
      </div>
    </>
  )
}