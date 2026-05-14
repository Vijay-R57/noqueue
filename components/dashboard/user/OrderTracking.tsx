'use client'

import { Order, OrderStatus } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { CheckCircle2, Clock } from 'lucide-react'

interface OrderTrackingProps {
  orders: Order[]
  isLoading: boolean
}

const STEP_ORDER: OrderStatus[] = ['WAITING', 'PAID', 'READY_TO_PRINT', 'PRINTING', 'COMPLETED']

const STEP_LABELS: Record<OrderStatus, string> = {
  WAITING: 'Waiting',
  PAID: 'Paid',
  READY_TO_PRINT: 'Ready to Print',
  PRINTING: 'Printing',
  COMPLETED: 'Completed',
}

export function OrderTracking({ orders, isLoading }: OrderTrackingProps) {
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
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No active orders</EmptyTitle>
              <EmptyDescription>No active orders to track</EmptyDescription>
            </EmptyHeader>
          </Empty>
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
            <div key={order.id} className="space-y-2 transition-all duration-300">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Token #{order.tokenNumber} - {order.fileName}</p>
                <p className="text-xs text-muted-foreground">{order.pages} pages</p>
              </div>

              <div className="flex items-center gap-2">
                {STEP_ORDER.map((step, index) => (
                  <div key={step} className="flex items-center">
                    {/* Step indicator */}
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-500 ${
                        index <= currentStepIndex
                          ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                          : 'bg-muted text-muted-foreground'
                      } ${order.status === 'PRINTING' && step === 'PRINTING' ? 'animate-pulse ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-background' : ''}`}
                    >
                      {index <= currentStepIndex && <CheckCircle2 className="h-5 w-5 animate-in zoom-in duration-300" />}
                      {index > currentStepIndex && <Clock className="h-4 w-4" />}
                    </div>

                    {/* Connector line */}
                    {index < STEP_ORDER.length - 1 && (
                      <div
                        className={`h-0.5 w-6 transition-colors duration-500 ${
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
                <p>Current: <span className="font-semibold text-foreground transition-all duration-300">{STEP_LABELS[order.status]}</span></p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
