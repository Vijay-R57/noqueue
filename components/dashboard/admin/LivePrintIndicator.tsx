'use client'

import { useEffect, useState } from 'react'
import { Order } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Loader2, Printer } from 'lucide-react'

interface LivePrintIndicatorProps {
  livePrinting: Order | null
  isLoading?:   boolean
}

export function LivePrintIndicator({ livePrinting, isLoading }: LivePrintIndicatorProps) {
  // Track the previous order so we can animate the exit/enter transition
  const [displayed, setDisplayed] = useState<Order | null>(livePrinting)
  const [entering, setEntering]   = useState(false)

  useEffect(() => {
    if (livePrinting?.id !== displayed?.id) {
      // Animate: fade out old → fade in new
      setEntering(false)
      const t = setTimeout(() => {
        setDisplayed(livePrinting)
        setEntering(true)
      }, 200)
      return () => clearTimeout(t)
    } else {
      setDisplayed(livePrinting)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePrinting])

  if (isLoading) {
    return <Skeleton className="h-32" />
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Now Printing</CardTitle>
        <Printer className={`h-4 w-4 ${displayed ? 'text-emerald-500 animate-pulse' : 'text-muted-foreground'}`} />
      </CardHeader>

      <CardContent>
        {displayed ? (
          <div
            className={`space-y-3 transition-all duration-300 ${
              entering ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
            }`}
          >
            {/* Token + badge */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold tracking-tight">
                  #{displayed.tokenNumber}
                </p>
                <p className="text-sm text-muted-foreground mt-1 truncate max-w-[140px]">
                  {displayed.fileName ?? displayed.userName}
                </p>
              </div>
              <Badge className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                PRINTING
              </Badge>
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Pages</p>
                <p className="font-semibold">{displayed.pages ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-semibold">{displayed.colorType ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">User</p>
                <p className="font-semibold truncate">{displayed.userName ?? '—'}</p>
              </div>
            </div>

            {/* Progress bar — purely cosmetic, loops while printing */}
            <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full animate-[progress_2s_ease-in-out_infinite]"
                   style={{ width: '60%' }} />
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground text-sm">No job currently printing</p>
            <p className="text-xs text-muted-foreground mt-2">Queue is idle</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
