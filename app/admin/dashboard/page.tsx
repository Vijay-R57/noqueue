'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthState, getUserEmail } from '@/lib/auth'
import { AdminTopBar } from '@/components/dashboard/admin/AdminTopBar'
import { StatsCards } from '@/components/dashboard/admin/StatsCards'
import { LivePrintIndicator } from '@/components/dashboard/admin/LivePrintIndicator'
import { QueueTable } from '@/components/dashboard/admin/QueueTable'
import { ManageTemplates } from '@/components/dashboard/admin/ManageTemplates'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminDashboardPage() {
  const router = useRouter()
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const auth = getAuthState()
    if (!auth.isLoggedIn || auth.role !== 'admin') {
      router.push('/login')
      return
    }
    const email = getUserEmail()
    setAdminEmail(email)
    setIsLoading(false)
  }, [router])

  if (isLoading || !adminEmail) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-background px-6 py-4">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminTopBar adminEmail={adminEmail} />

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stats Cards */}
        <StatsCards refreshTrigger={refreshTrigger} />

        {/* Live Printing and Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <LivePrintIndicator refreshTrigger={refreshTrigger} />
          <div className="lg:col-span-2" />
        </div>

        {/* Queue Table */}
        <QueueTable
          refreshTrigger={refreshTrigger}
          onOrderUpdated={() => setRefreshTrigger((prev) => prev + 1)}
        />

        {/* Manage Templates */}
        <ManageTemplates />
      </div>
    </div>
  )
}
