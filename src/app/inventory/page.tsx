import Sidebar from '@/components/ui/Sidebar'
import InventoryClient from './InventoryClient'

export default function InventoryPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <InventoryClient />
      </main>
    </div>
  )
}
