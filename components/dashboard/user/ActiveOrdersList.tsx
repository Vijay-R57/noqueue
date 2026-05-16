'use client'

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
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'

interface ActiveOrdersListProps {
  orders: Order[]
  isLoading: boolean
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
    case 'PAYMENT_PENDING':
      return 'text-orange-600 dark:text-orange-400'
    case 'CASH_PENDING':
      return 'text-violet-600 dark:text-violet-400'
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

export function ActiveOrdersList({ orders, isLoading }: ActiveOrdersListProps) {
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
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No active orders</EmptyTitle>
              <EmptyDescription>Place your first order to get started!</EmptyDescription>
            </EmptyHeader>
          </Empty>
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
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="transition-all duration-300">
                  <TableCell className="font-bold">#{order.tokenNumber}</TableCell>
                  <TableCell className="text-sm">{order.fileName}</TableCell>
                  <TableCell className="text-sm">{order.pages}</TableCell>
                  <TableCell className="text-sm">
                    {order.paymentMethod ? (
                      <span className="inline-flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">{order.paymentMethod}</Badge>
                        {order.amountPaid != null && (
                          <span className="text-xs text-muted-foreground">₹{order.amountPaid}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(order.status)} className={`transition-colors duration-300 ${statusColor(order.status)} ${order.status === 'PRINTING' ? 'animate-pulse' : ''}`}>
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
