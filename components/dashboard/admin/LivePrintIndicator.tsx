'use client'

import { useEffect, useState } from 'react'
import { getLivePrinting } from '@/services/api'
import { Order } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Printer } from 'lucide-react'

interface LivePrintIndicatorProps {
  refreshTrigger?: number
}

export function LivePrintIndicator({ refreshTrigger }: LivePrintIndicatorProps) {
  const [livePrinting, setLivePrinting] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadLivePrinting = async () => {
      setIsLoading(true)
      try {
        const data = await getLivePrinting()
        setLivePrinting(data)
      } catch (error) {
        console.error('Failed to load live printing:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadLivePrinting()

    // Poll every 2 seconds
    const interval = setInterval(loadLivePrinting, 2000)
    return () => clearInterval(interval)
  }, [refreshTrigger])

  if (isLoading) {
    return <Skeleton className="h-32" />
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Now Printing</CardTitle>
        <Printer className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      </CardHeader>
      <CardContent>
        {livePrinting ? (
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold">#{livePrinting.tokenNumber}</p>
                <p className="text-sm text-muted-foreground mt-1">{livePrinting.fileName}</p>
              </div>
              <Badge className="animate-pulse bg-emerald-600 hover:bg-emerald-700">
                PRINTING
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Pages</p>
                <p className="font-semibold">{livePrinting.pages}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-semibold">{livePrinting.colorType}</p>
              </div>
              <div>
                <p className="text-muted-foreground">User</p>
                <p className="font-semibold text-xs truncate">{livePrinting.userName}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground text-sm">No printer currently active</p>
            <p className="text-xs text-muted-foreground mt-2">Queue is idle</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
