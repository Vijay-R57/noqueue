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

              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <p>Current: <span className="font-semibold text-foreground transition-all duration-300">{STEP_LABELS[order.status]}</span></p>
              </div>

              {/* ETA Display */}
              {(order.status !== 'COMPLETED' && order.status !== 'FAILED') && (
                <OrderEtaDisplay orderId={order.id} currentStatus={order.status} />
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

import { useEffect, useState } from 'react'

function OrderEtaDisplay({ orderId, currentStatus }: { orderId: string, currentStatus: string }) {
  const [eta, setEta] = useState<any>(null)

  useEffect(() => {
    const fetchEta = async () => {
      // Handle mock local storage IDs (which are strings starting with "order_")
      if (typeof orderId === 'string' && orderId.startsWith('order_')) {
        // Generate a stable fake ETA based on the order ID string length
        const fakeMinutes = (orderId.length % 10) + 2; 
        setEta({
            queuePosition: (orderId.length % 5) + 1,
            estimatedMinutes: fakeMinutes,
            expectedCompletion: new Date(Date.now() + fakeMinutes * 60000).toISOString()
        });
        return;
      }

      try {
        const res = await fetch(`http://localhost:8080/api/v1/orders/${orderId}/eta`)
        if (res.ok) {
          const data = await res.json()
          setEta(data)
        }
      } catch (err) {
        console.error("Failed to fetch ETA for", orderId)
      }
    }
    fetchEta()
  }, [orderId, currentStatus])

  if (!eta || currentStatus === 'COMPLETED' || currentStatus === 'FAILED') return null

  if (currentStatus === 'PRINTING') {
     return <p className="text-emerald-600 font-medium text-sm mt-2 animate-pulse">Now printing... ready in ~{eta.estimatedMinutes} mins</p>
  }

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm mt-3 shadow-sm">
       <p className="font-medium text-foreground">
          Your document will likely be ready in <span className="text-emerald-600">~{eta.estimatedMinutes} mins</span>
       </p>
       <div className="flex gap-4 mt-2 text-muted-foreground text-xs font-medium">
          <span className="bg-background px-2 py-1 rounded border border-border">Queue Position: #{eta.queuePosition}</span>
          <span className="bg-background px-2 py-1 rounded border border-border">Expected by: {new Date(eta.expectedCompletion).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
       </div>
    </div>
  )
}
