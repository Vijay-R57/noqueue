'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthState, getUserEmail } from '@/lib/auth'
import { getOrders } from '@/services/api'
import { useOrderEvents, OrderEvent } from '@/hooks/useOrderEvents'
import { TopBar } from '@/components/dashboard/user/TopBar'
import { UploadPrintJobCard } from '@/components/dashboard/user/UploadPrintJobCard'
import { QuickPrintTemplates } from '@/components/dashboard/user/QuickPrintTemplates'
import { ReadyDocuments } from '@/components/dashboard/user/ReadyDocuments'
import { ActiveOrdersList } from '@/components/dashboard/user/ActiveOrdersList'
import { OrderTracking } from '@/components/dashboard/user/OrderTracking'
import { OrderHistory } from '@/components/dashboard/user/OrderHistory'
import { Skeleton } from '@/components/ui/skeleton'
import { Order, OrderStatus, Template } from '@/lib/types'
import { toast } from 'sonner'
import { Radio, WifiOff } from 'lucide-react'

function toastForUserTransition(event: OrderEvent) {
  switch (event.status) {
    case 'PRINTING':
      toast.info(`🖨️ Your document (Token #${event.tokenNumber}) is now printing`, { duration: 4000 })
      break
    case 'COMPLETED':
      toast.success(`✅ Your document (Token #${event.tokenNumber}) is ready for pickup`, { duration: 5000 })
      break
    case 'FAILED':
      toast.error(`❌ Your document (Token #${event.tokenNumber}) failed to print`, { duration: 6000 })
      break
    default:
      break
  }
}

export default function UserDashboardPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  // ── Shared live state ─────────────────────────────────────────────────────
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
  }

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const auth = getAuthState()
    if (!auth.isLoggedIn || auth.role !== 'user') {
      router.push('/login')
      return
    }
    setUserEmail(getUserEmail())
    setAuthLoading(false)
  }, [router])

  // ── Initial full data load ────────────────────────────────────────────────
  const loadAll = useCallback(async (email: string) => {
    setDataLoading(true)
    try {
      const orders = await getOrders(email)
      setAllOrders(orders)
    } catch (err) {
      console.error('[Dashboard] Initial load failed:', err)
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && userEmail) loadAll(userEmail)
  }, [authLoading, userEmail, loadAll])

  // ── SSE: single connection for entire dashboard ───────────────────────────
  const { isConnected } = useOrderEvents({
    enabled: !authLoading && !!userEmail,

    onConnect: () => {
      // Re-sync on reconnect to avoid stale state
      if (userEmail) loadAll(userEmail)
    },

    onEvent: useCallback((event: OrderEvent) => {
      // Only process events meant for this user
      if (event.userName !== userEmail) return

      // 1. Toast notification
      toastForUserTransition(event)

      // 2. Update orders list in-place
      setAllOrders((prev) => {
        const idx = prev.findIndex((o) => String(o.id) === String(event.orderId))

        if (idx === -1) {
          // New order — full reload to get all fields
          if (userEmail) loadAll(userEmail)
          return prev
        }

        const updated = [...prev]
        updated[idx] = { ...updated[idx], status: event.status as OrderStatus }
        return updated
      })
    }, [userEmail, loadAll]),
  })

  // ── Derived state ─────────────────────────────────────────────────────────
  const activeOrders = allOrders
    .filter((o) => o.status !== 'COMPLETED')
    .sort((a, b) => b.tokenNumber - a.tokenNumber)

  const completedOrders = allOrders
    .filter((o) => o.status === 'COMPLETED')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // ── Render ────────────────────────────────────────────────────────────────
  if (authLoading || !userEmail) {
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
        
        {/* ── Live connection banner ──────────────────────────────────────── */}
        <div className="flex items-center justify-end">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border transition-all
            ${isConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
            {isConnected
              ? <><Radio className="h-3 w-3 animate-pulse" /> Live tracking active</>
              : <><WifiOff className="h-3 w-3" /> Reconnecting...</>}
          </span>
        </div>

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
                // Refresh is triggered by SSE when order is placed, but we can load just in case
                loadAll(userEmail)
                setSelectedTemplate(null)
              }}
              selectedTemplate={selectedTemplate}
            />
          </div>

          {/* Active Orders */}
          <div className="lg:col-span-2">
            <ActiveOrdersList orders={activeOrders} isLoading={dataLoading} />
          </div>
        </div>

        {/* Tracking and History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OrderTracking orders={activeOrders} isLoading={dataLoading} />
          <OrderHistory orders={completedOrders} isLoading={dataLoading} />
        </div>
      </div>
    </div>
  )
}
