'use client'

import { useEffect, useState } from 'react'
import { Printer, Wifi, WifiOff, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'

interface PrinterStatus {
  name: string
  status: 'ONLINE' | 'OFFLINE'
  isPrinting: boolean
  lastChecked: string
}

const AGENT_STATUS_URL = 'http://localhost:9090/printer/status'
const REFRESH_INTERVAL_MS = 5000

export function PrinterStatusPanel() {
  const [status, setStatus] = useState<PrinterStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch(AGENT_STATUS_URL, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: PrinterStatus = await res.json()
      setStatus(data)
      setError(null)
    } catch {
      setStatus(null)
      setError('Print Agent is not running or unreachable on port 9090.')
    } finally {
      setLastRefresh(new Date())
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const isOnline = status?.status === 'ONLINE'
  const isPrinting = status?.isPrinting === true

  const lastCheckedFormatted = lastRefresh
    ? lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Printer className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Printer Status</h2>
        </div>
        <button
          onClick={fetchStatus}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh now"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Agent unreachable */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-amber-500">Print Agent Offline</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">
              Run: <code className="font-mono bg-muted px-1 rounded">gradlew run</code> inside the{' '}
              <code className="font-mono bg-muted px-1 rounded">print-agent</code> folder.
            </p>
          </div>
        </div>
      )}

      {/* Status grid */}
      {status && (
        <div className="grid grid-cols-2 gap-3">
          {/* Printer Name */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Printer</p>
            <p className="text-sm font-semibold text-foreground truncate" title={status.name}>
              {status.name || 'Unknown'}
            </p>
          </div>

          {/* Connection Status */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Connection</p>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-500">ONLINE</span>
                </>
              ) : (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <WifiOff className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-sm font-semibold text-red-500">OFFLINE</span>
                </>
              )}
            </div>
          </div>

          {/* Current State */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Current State</p>
            <div className="flex items-center gap-2">
              {isPrinting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                  <span className="text-sm font-semibold text-blue-500">Printing...</span>
                </>
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">Idle</span>
              )}
            </div>
          </div>

          {/* Last Checked */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Last Checked</p>
            <p className="text-sm font-semibold text-foreground">{lastCheckedFormatted}</p>
          </div>
        </div>
      )}

      {/* Offline warning banner */}
      {status && !isOnline && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-500 font-medium">
            Printer is offline — jobs will fail until the printer is connected and ready.
          </p>
        </div>
      )}

      {/* Refresh indicator */}
      <p className="text-xs text-muted-foreground text-right">
        Auto-refreshes every {REFRESH_INTERVAL_MS / 1000}s
      </p>
    </div>
  )
}
