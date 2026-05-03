'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthState, getUserEmail } from '@/lib/auth'
import { TopBar } from '@/components/dashboard/user/TopBar'
import { UploadPrintJobCard } from '@/components/dashboard/user/UploadPrintJobCard'
import { QuickPrintTemplates } from '@/components/dashboard/user/QuickPrintTemplates'
import { ReadyDocuments } from '@/components/dashboard/user/ReadyDocuments'
import { ActiveOrdersList } from '@/components/dashboard/user/ActiveOrdersList'
import { OrderTracking } from '@/components/dashboard/user/OrderTracking'
import { OrderHistory } from '@/components/dashboard/user/OrderHistory'
import { Skeleton } from '@/components/ui/skeleton'
import { Template } from '@/lib/types'

export default function UserDashboardPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
  }

  useEffect(() => {
    const auth = getAuthState()
    if (!auth.isLoggedIn || auth.role !== 'user') {
      router.push('/login')
      return
    }
    const email = getUserEmail()
    setUserEmail(email)
    setIsLoading(false)
  }, [router])

  if (isLoading || !userEmail) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-background px-6 py-4">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="p-6 space-y-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar userEmail={userEmail} />

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Ready Documents Section */}
        <ReadyDocuments onSelectDocument={handleTemplateSelect} />

        {/* Quick Templates Section */}
        <QuickPrintTemplates onSelectTemplate={handleTemplateSelect} />

        {/* Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <UploadPrintJobCard
              userEmail={userEmail}
              onOrderPlaced={() => {
                setRefreshTrigger((prev) => prev + 1)
                setSelectedTemplate(null)
              }}
              selectedTemplate={selectedTemplate}
            />
          </div>

          {/* Active Orders */}
          <div className="lg:col-span-2">
            <ActiveOrdersList userEmail={userEmail} refreshTrigger={refreshTrigger} />
          </div>
        </div>

        {/* Tracking and History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OrderTracking userEmail={userEmail} refreshTrigger={refreshTrigger} />
          <OrderHistory userEmail={userEmail} refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </div>
  )
}
