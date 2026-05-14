'use client'

import { useState } from 'react'
import { updateOrderStatus } from '@/services/api'
import { Order, OrderStatus } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button }   from '@/components/ui/button'
import { Badge }    from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription }    from '@/components/ui/empty'
import { toast }    from 'sonner'
import { Loader2, Radio } from 'lucide-react'

interface QueueTableProps {
  orders:          Order[]
  isLoading:       boolean
  flashedOrderId:  string | null   // row to highlight on status transition
  onOrderUpdated:  () => void
}

// ── Status colour mapping ─────────────────────────────────────────────────────
const STATUS_COLOUR: Record<string, string> = {
  WAITING:        'text-amber-600 dark:text-amber-400',
  PAID:           'text-blue-600 dark:text-blue-400',
  READY_TO_PRINT: 'text-indigo-600 dark:text-indigo-400',
  PRINTING:       'text-emerald-600 dark:text-emerald-400',
  COMPLETED:      'text-emerald-600 dark:text-emerald-400',
  FAILED:         'text-red-600 dark:text-red-400',
}

// ── Flash highlight colours for animated row transitions ──────────────────────
const FLASH_COLOUR: Record<string, string> = {
  PRINTING:  'bg-emerald-500/10 border-l-2 border-emerald-500',
  COMPLETED: 'bg-blue-500/10 border-l-2 border-blue-400',
  FAILED:    'bg-red-500/10 border-l-2 border-red-400',
}

function getNextAction(status: OrderStatus): { label: string; nextStatus: OrderStatus } | null {
  switch (status) {
    case 'WAITING':
    case 'PAID':
      return { label: 'Mark Ready', nextStatus: 'READY_TO_PRINT' }
    case 'READY_TO_PRINT':
      return { label: 'Start Printing', nextStatus: 'PRINTING' }
    case 'PRINTING':
      return { label: 'Mark Completed', nextStatus: 'COMPLETED' }
    default:
      return null
  }
}

export function QueueTable({ orders, isLoading, flashedOrderId, onOrderUpdated }: QueueTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId)
    try {
      await updateOrderStatus(orderId, newStatus)
      // SSE event from the backend will drive the UI update — no local setState needed
      onOrderUpdated()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update order'
      toast.error(message)
    } finally {
      setUpdatingId(null)
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Print Queue</CardTitle>
          <CardDescription>FIFO order processing and management</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Print Queue</CardTitle>
          <CardDescription>FIFO order processing and management</CardDescription>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No pending orders</EmptyTitle>
              <EmptyDescription>Queue is empty!</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Print Queue</CardTitle>
            <CardDescription>
              FIFO order processing — {orders.length} pending
            </CardDescription>
          </div>
          {/* Live indicator driven by parent's SSE connection */}
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
            text-xs font-semibold border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
            <Radio className="h-3 w-3 animate-pulse" />
            Live
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>User</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Binding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {orders.map((order) => {
                const nextAction  = getNextAction(order.status)
                const isFlashing  = flashedOrderId === String(order.id)
                const flashClass  = isFlashing ? (FLASH_COLOUR[order.status] ?? 'bg-primary/5') : ''

                return (
                  <TableRow
                    key={order.id}
                    className={`transition-all duration-500 ${flashClass}`}
                  >
                    <TableCell className="font-bold">#{order.tokenNumber}</TableCell>
                    <TableCell className="text-sm">{order.userName}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{order.fileName}</TableCell>
                    <TableCell className="text-sm">{order.pages}</TableCell>
                    <TableCell className="text-sm">
                      {order.colorType} / {order.printType}
                    </TableCell>
                    <TableCell className="text-sm">{order.binding}</TableCell>
                    <TableCell>
                      <Badge
                        className={`transition-colors duration-300 ${
                          STATUS_COLOUR[order.status] ?? 'text-muted-foreground'
                        } ${order.status === 'PRINTING' ? 'animate-pulse' : ''}`}
                      >
                        {order.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {nextAction && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(String(order.id), nextAction.nextStatus)}
                          disabled={updatingId === String(order.id)}
                        >
                          {updatingId === String(order.id) && (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          )}
                          {nextAction.label}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
