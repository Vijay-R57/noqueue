'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthState, getUserEmail } from '@/lib/auth'
import { getOrders, getStats, getLivePrinting } from '@/services/api'
import { useOrderEvents, OrderEvent } from '@/hooks/useOrderEvents'
import { AdminTopBar } from '@/components/dashboard/admin/AdminTopBar'
import { StatsCards } from '@/components/dashboard/admin/StatsCards'
import { LivePrintIndicator } from '@/components/dashboard/admin/LivePrintIndicator'
import { QueueTable } from '@/components/dashboard/admin/QueueTable'
import { ManageTemplates } from '@/components/dashboard/admin/ManageTemplates'
import { PrinterStatusPanel } from '@/components/dashboard/admin/PrinterStatusPanel'
import { Skeleton } from '@/components/ui/skeleton'
import { Order, OrderStatus } from '@/lib/types'
import { toast } from 'sonner'
import { Radio, WifiOff } from 'lucide-react'

// ── Toast messages for key status transitions ─────────────────────────────────
function toastForTransition(event: OrderEvent) {
  const token = event.tokenNumber
  switch (event.status) {
    case 'PRINTING':
      toast.info(`🖨️ Order #${token} started printing`, { duration: 4000 })
      break
    case 'COMPLETED':
      toast.success(`✅ Order #${token} completed`, { duration: 5000 })
      break
    case 'READY_TO_PRINT':
      toast.message(`📋 Order #${token} is ready to print`, { duration: 3000 })
      break
    case 'FAILED':
      toast.error(`❌ Order #${token} failed`, { duration: 6000 })
      break
    default:
      break
  }
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [authLoading, setAuthLoading]  = useState(true)

  // ── Shared live state ─────────────────────────────────────────────────────
  const [orders, setOrders]           = useState<Order[]>([])
  const [livePrinting, setLivePrinting] = useState<Order | null>(null)
  const [stats, setStats]             = useState({ ordersInQueue: 0, ordersCompleted: 0, totalRevenue: 0 })
  const [flashedOrderId, setFlashedOrderId] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const auth = getAuthState()
    if (!auth.isLoggedIn || auth.role !== 'admin') {
      router.push('/login')
      return
    }
    setAdminEmail(getUserEmail())
    setAuthLoading(false)
  }, [router])

  // ── Initial full data load ────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setDataLoading(true)
    try {
      const [allOrders, statsData, live] = await Promise.all([
        getOrders(),
        getStats(),
        getLivePrinting(),
      ])
      const active = allOrders
        .filter((o) => o.status !== 'COMPLETED')
        .sort((a, b) => a.tokenNumber - b.tokenNumber)
      setOrders(active)
      setStats(statsData)
      setLivePrinting(live)
    } catch (err) {
      console.error('[Dashboard] Initial load failed:', err)
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading) loadAll()
  }, [authLoading, loadAll])

  // ── SSE: single connection for entire dashboard ───────────────────────────
  const { isConnected } = useOrderEvents({
    enabled: !authLoading,

    onConnect: () => {
      // Re-sync on reconnect to avoid stale state after a server restart
      loadAll()
    },

    onEvent: useCallback((event: OrderEvent) => {
      // 1. Toast notification for key transitions
      toastForTransition(event)

      // 2. Flash the changed row
      setFlashedOrderId(String(event.orderId))
      setTimeout(() => setFlashedOrderId(null), 1500)

      // 3. Update queue table in-place
      setOrders((prev) => {
        const idx = prev.findIndex((o) => String(o.id) === String(event.orderId))

        if (idx === -1) {
          // Brand-new order — full reload to get all fields
          loadAll()
          return prev
        }

        const updated = [...prev]
        updated[idx] = { ...updated[idx], status: event.status as OrderStatus }

        // Remove completed/failed orders from the active list
        return updated.filter((o) => o.status !== 'COMPLETED' && o.status !== 'FAILED')
      })

      // 4. Update "Now Printing" panel
      if (event.status === 'PRINTING') {
        setLivePrinting((prev) => {
          // We only have partial data here; merge with what we already know
          if (prev && String(prev.id) === String(event.orderId)) return prev
          // Otherwise, fall back to a minimal placeholder and let the next
          // loadAll() (triggered by onConnect on reconnect) fill in the rest.
          return {
            id: String(event.orderId),
            tokenNumber: event.tokenNumber as unknown as number,
            userName: event.userName,
            status: 'PRINTING',
          } as Order
        })
      } else if (event.status === 'COMPLETED' || event.status === 'FAILED') {
        setLivePrinting((prev) =>
          prev && String(prev.id) === String(event.orderId) ? null : prev
        )
      }

      // 5. Re-compute stats from the current order list
      setStats((prev) => {
        if (event.status === 'COMPLETED') {
          return {
            ...prev,
            ordersInQueue:  Math.max(0, prev.ordersInQueue - 1),
            ordersCompleted: prev.ordersCompleted + 1,
          }
        }
        if (event.status === 'WAITING' || event.status === 'PAID') {
          return { ...prev, ordersInQueue: prev.ordersInQueue + 1 }
        }
        return prev
      })
    }, [loadAll]),
  })

  // ── Render ────────────────────────────────────────────────────────────────
  if (authLoading || !adminEmail) {
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

        {/* ── Live connection banner ──────────────────────────────────────── */}
        <div className="flex items-center justify-end">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border transition-all
            ${isConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
            {isConnected
              ? <><Radio className="h-3 w-3 animate-pulse" /> Live updates active</>
              : <><WifiOff className="h-3 w-3" /> Reconnecting to server...</>}
          </span>
        </div>

        {/* ── Stats Cards ─────────────────────────────────────────────────── */}
        <StatsCards stats={stats} isLoading={dataLoading} />

        {/* ── Live Printing + Printer Status ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <LivePrintIndicator livePrinting={livePrinting} isLoading={dataLoading} />
          <div className="lg:col-span-2">
            <PrinterStatusPanel />
          </div>
        </div>

        {/* ── Queue Table ─────────────────────────────────────────────────── */}
        <QueueTable
          orders={orders}
          isLoading={dataLoading}
          flashedOrderId={flashedOrderId}
          onOrderUpdated={loadAll}
        />

        {/* ── Manage Templates ────────────────────────────────────────────── */}
        <ManageTemplates />
      </div>
    </div>
  )
}
