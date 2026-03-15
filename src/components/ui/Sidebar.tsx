'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ScanLine, TrendingUp,
  Bell, Settings, ChevronRight
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { href: '/dashboard',  label: 'Tổng quan',     icon: LayoutDashboard },
  { href: '/inventory',  label: 'Quản lý kho',    icon: Package },
  { href: '/scan',       label: 'Quét mã vạch',   icon: ScanLine },
  { href: '/predict',    label: 'AI Dự đoán',      icon: TrendingUp },
  { href: '/alerts',     label: 'Cảnh báo',        icon: Bell },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside className="w-60 min-h-screen bg-gray-900 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            KH
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Kho Hàng</p>
            <p className="text-gray-400 text-xs">Thông Minh</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(item => {
          const active = path.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
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

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-700">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
        >
          <Settings size={18} />
          Cài đặt
        </Link>
        <p className="text-gray-600 text-xs text-center mt-3">v1.0.0</p>
      </div>
    </aside>
  )
}
