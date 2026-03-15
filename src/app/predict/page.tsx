import Sidebar from '@/components/ui/Sidebar'
import PredictClient from './PredictClient'

export default function PredictPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <PredictClient />
      </main>
    </div>
  )
}
