'use client'

import { useEffect, useState } from 'react'
import { getOrders } from '@/services/api'
import { Order, OrderStatus } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty } from '@/components/ui/empty'
import { CheckCircle2, Clock } from 'lucide-react'

interface OrderTrackingProps {
  userEmail: string
  refreshTrigger?: number
}

const STEP_ORDER: OrderStatus[] = ['WAITING', 'PAID', 'READY_TO_PRINT', 'PRINTING', 'COMPLETED']

const STEP_LABELS: Record<OrderStatus, string> = {
  WAITING: 'Waiting',
  PAID: 'Paid',
  READY_TO_PRINT: 'Ready to Print',
  PRINTING: 'Printing',
  COMPLETED: 'Completed',
}

export function OrderTracking({ userEmail, refreshTrigger }: OrderTrackingProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadOrders = async () => {
      setIsLoading(true)
      try {
        const allOrders = await getOrders(userEmail)
        const notCompleted = allOrders.filter((o) => o.status !== 'COMPLETED')
        setOrders(notCompleted.sort((a, b) => b.tokenNumber - a.tokenNumber))
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
          <CardTitle>Order Tracking</CardTitle>
          <CardDescription>Progress of your active orders</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
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
          <CardTitle>Order Tracking</CardTitle>
          <CardDescription>Progress of your active orders</CardDescription>
        </CardHeader>
        <CardContent>
          <Empty description="No active orders to track" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Tracking</CardTitle>
        <CardDescription>Progress of your active orders</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {orders.map((order) => {
          const currentStepIndex = STEP_ORDER.indexOf(order.status)

          return (
            <div key={order.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Token #{order.tokenNumber} - {order.fileName}</p>
                <p className="text-xs text-muted-foreground">{order.pages} pages</p>
              </div>

              <div className="flex items-center gap-2">
                {STEP_ORDER.map((step, index) => (
                  <div key={step} className="flex items-center">
                    {/* Step indicator */}
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                        index <= currentStepIndex
                          ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {index <= currentStepIndex && <CheckCircle2 className="h-5 w-5" />}
                      {index > currentStepIndex && <Clock className="h-4 w-4" />}
                    </div>

                    {/* Connector line */}
                    {index < STEP_ORDER.length - 1 && (
                      <div
                        className={`h-0.5 w-6 transition-colors ${
                          index < currentStepIndex
                            ? 'bg-emerald-600 dark:bg-emerald-500'
                            : 'bg-muted'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <p>Current: <span className="font-semibold text-foreground">{STEP_LABELS[order.status]}</span></p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
