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
import { Skeleton } from '@/components/ui/skeleton'
import { Empty } from '@/components/ui/empty'

interface OrderHistoryProps {
  userEmail: string
  refreshTrigger?: number
}

export function OrderHistory({ userEmail, refreshTrigger }: OrderHistoryProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadOrders = async () => {
      setIsLoading(true)
      try {
        const allOrders = await getOrders(userEmail)
        const completed = allOrders.filter((o) => o.status === 'COMPLETED')
        setOrders(completed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
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
          <CardTitle>Order History</CardTitle>
          <CardDescription>Your completed orders</CardDescription>
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
          <CardTitle>Order History</CardTitle>
          <CardDescription>Your completed orders</CardDescription>
        </CardHeader>
        <CardContent>
          <Empty description="No completed orders yet" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order History</CardTitle>
        <CardDescription>Your completed orders</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead>Print Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-bold">#{order.tokenNumber}</TableCell>
                  <TableCell className="text-sm">{order.fileName}</TableCell>
                  <TableCell className="text-sm">{order.pages}</TableCell>
                  <TableCell className="text-sm">
                    {order.colorType} - {order.printType}
                  </TableCell>
                  <TableCell className="font-semibold">₹{order.price.toFixed(0)}</TableCell>
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
