import Sidebar from '@/components/ui/Sidebar'
import DashboardClient from './DashboardClient'

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <DashboardClient />
      </main>
    </div>
  )
}
