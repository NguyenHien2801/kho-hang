import Sidebar from '@/components/ui/Sidebar'
import ScanClient from './ScanClient'

export default function ScanPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <ScanClient />
      </main>
    </div>
  )
}
