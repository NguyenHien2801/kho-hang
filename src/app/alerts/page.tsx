import Sidebar from '@/components/ui/Sidebar'
import AlertsClient from './AlertsClient'

export default function AlertsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <AlertsClient />
      </main>
    </div>
  )
}
