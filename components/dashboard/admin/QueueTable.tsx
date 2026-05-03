'use client'

import { useEffect, useState } from 'react'
import { getOrders, updateOrderStatus } from '@/services/api'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty } from '@/components/ui/empty'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface QueueTableProps {
  refreshTrigger?: number
  onOrderUpdated?: () => void
}

const statusColor = (status: string) => {
  switch (status) {
    case 'WAITING':
      return 'text-amber-600 dark:text-amber-400'
    case 'PAID':
      return 'text-blue-600 dark:text-blue-400'
    case 'READY_TO_PRINT':
      return 'text-blue-600 dark:text-blue-400'
    case 'PRINTING':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'COMPLETED':
      return 'text-emerald-600 dark:text-emerald-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}

export function QueueTable({ refreshTrigger, onOrderUpdated }: QueueTableProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    const loadOrders = async () => {
      setIsLoading(true)
      try {
        const allOrders = await getOrders()
        // Filter and sort by FIFO (token number ascending), but show non-completed first
        const active = allOrders.filter(
          (o) => o.status !== 'COMPLETED'
        )
        active.sort((a, b) => a.tokenNumber - b.tokenNumber)
        setOrders(active)
      } catch (error) {
        console.error('Failed to load orders:', error)
        toast.error('Failed to load queue')
      } finally {
        setIsLoading(false)
      }
    }

    loadOrders()

    // Poll every 3 seconds for live updates
    const interval = setInterval(loadOrders, 3000)
    return () => clearInterval(interval)
  }, [refreshTrigger])

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId)
    try {
      await updateOrderStatus(orderId, newStatus)
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: newStatus } : o
        )
      )
      toast.success(`Order updated to ${newStatus.replace(/_/g, ' ')}`)
      onOrderUpdated?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update order'
      toast.error(message)
    } finally {
      setUpdatingId(null)
    }
  }

  const getNextAction = (
    status: OrderStatus
  ): { label: string; nextStatus: OrderStatus } | null => {
    switch (status) {
      case 'WAITING':
      case 'PAID':
        return { label: 'Mark as Ready', nextStatus: 'READY_TO_PRINT' }
      case 'READY_TO_PRINT':
        return { label: 'Start Printing', nextStatus: 'PRINTING' }
      case 'PRINTING':
        return { label: 'Mark Completed', nextStatus: 'COMPLETED' }
      default:
        return null
    }
  }

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

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Print Queue</CardTitle>
          <CardDescription>FIFO order processing and management</CardDescription>
        </CardHeader>
        <CardContent>
          <Empty description="No pending orders. Queue is empty!" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Print Queue</CardTitle>
        <CardDescription>FIFO order processing and management ({orders.length} pending)</CardDescription>
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
                const nextAction = getNextAction(order.status)
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-bold">#{order.tokenNumber}</TableCell>
                    <TableCell className="text-sm">{order.userName}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{order.fileName}</TableCell>
                    <TableCell className="text-sm">{order.pages}</TableCell>
                    <TableCell className="text-sm">
                      {order.colorType} / {order.printType}
                    </TableCell>
                    <TableCell className="text-sm">{order.binding}</TableCell>
                    <TableCell>
                      <Badge className={statusColor(order.status)}>
                        {order.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {nextAction && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(order.id, nextAction.nextStatus)}
                          disabled={updatingId === order.id}
                        >
                          {updatingId === order.id && (
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
