'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PrinterIcon, CheckCircle2, IndianRupee } from 'lucide-react'

interface StatsCardsProps {
  stats: {
    ordersInQueue:   number
    ordersCompleted: number
    totalRevenue:    number
  }
  isLoading?: boolean
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

      {/* Orders in Queue */}
      <Card className="transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Orders in Queue</CardTitle>
          <PrinterIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums transition-all duration-500">
            {stats.ordersInQueue}
          </div>
          <p className="text-xs text-muted-foreground">Waiting, paid, or ready to print</p>
        </CardContent>
      </Card>

      {/* Orders Completed */}
      <Card className="transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Orders Completed</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums transition-all duration-500">
            {stats.ordersCompleted}
          </div>
          <p className="text-xs text-muted-foreground">Total completed this session</p>
        </CardContent>
      </Card>

      {/* Total Revenue */}
      <Card className="transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <IndianRupee className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums transition-all duration-500">
            ₹{stats.totalRevenue.toFixed(0)}
          </div>
          <p className="text-xs text-muted-foreground">From completed orders</p>
        </CardContent>
      </Card>

    </div>
  )
}
