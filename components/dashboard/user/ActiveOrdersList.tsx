'use client'

import { useEffect, useState } from 'react'
import { getOrders } from '@/services/api'
import { Order } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty } from '@/components/ui/empty'

interface ActiveOrdersListProps {
  userEmail: string
  refreshTrigger?: number
}

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case 'WAITING':
      return 'secondary'
    case 'PAID':
      return 'outline'
    case 'READY_TO_PRINT':
      return 'outline'
    case 'PRINTING':
      return 'default'
    case 'COMPLETED':
      return 'secondary'
    default:
      return 'secondary'
  }
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

export function ActiveOrdersList({ userEmail, refreshTrigger }: ActiveOrdersListProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadOrders = async () => {
      setIsLoading(true)
      try {
        const allOrders = await getOrders(userEmail)
        const active = allOrders.filter((o) => o.status !== 'COMPLETED')
        setOrders(active.sort((a, b) => b.tokenNumber - a.tokenNumber))
      } catch (error) {
        console.error('Failed to load orders:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadOrders()
  }, [userEmail, refreshTrigger])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Orders</CardTitle>
          <CardDescription>Your current print jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
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
          <CardTitle>Active Orders</CardTitle>
          <CardDescription>Your current print jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <Empty description="No active orders. Place your first order to get started!" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Orders</CardTitle>
        <CardDescription>Your current print jobs</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-bold">#{order.tokenNumber}</TableCell>
                  <TableCell className="text-sm">{order.fileName}</TableCell>
                  <TableCell className="text-sm">{order.pages}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(order.status)} className={statusColor(order.status)}>
                      {order.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
