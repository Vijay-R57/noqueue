'use client'

import { useEffect, useState } from 'react'
import { Printer, Wifi, WifiOff, Loader2, AlertTriangle, RefreshCw, CheckCircle2, XCircle, FlaskConical, ChevronDown } from 'lucide-react'

interface PrinterStatus {
  name: string
  status: 'ONLINE' | 'OFFLINE'
  isPrinting: boolean
  lastChecked: string
}

const AGENT_STATUS_URL = 'http://localhost:9090/printer/status'
const AGENT_LIST_URL   = 'http://localhost:9090/printer/list'
const REFRESH_INTERVAL_MS = 5000

export function PrinterStatusPanel() {
  const [status, setStatus] = useState<PrinterStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [testState, setTestState] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle')
  const [testMessage, setTestMessage] = useState<string>('')
  const [printerList, setPrinterList] = useState<string[]>([])
  const [listLoading, setListLoading] = useState(false)

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

  const sendTestPrint = async () => {
    setTestState('loading')
    setTestMessage('')
    try {
      const res = await fetch('http://localhost:9090/printer/test', { method: 'POST' })
      const data = await res.json()
      if (data.status === 'success') {
        setTestState('success')
        setTestMessage(`Sent to: ${data.printer}`)
      } else {
        setTestState('failed')
        setTestMessage(data.reason || 'Unknown error')
      }
    } catch {
      setTestState('failed')
      setTestMessage('Agent unreachable on port 9090.')
    }
    // Reset button after 4 seconds
    setTimeout(() => setTestState('idle'), 4000)
  }

  const fetchPrinters = async () => {
    setListLoading(true)
    try {
      const res = await fetch(AGENT_LIST_URL, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: string[] = await res.json()
      setPrinterList(data)
    } catch {
      setPrinterList([])
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    fetchPrinters()
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
        <div className="flex items-center gap-2">
          {/* Test Print Button */}
          <button
            onClick={sendTestPrint}
            disabled={testState === 'loading' || !!error}
            title="Send a test page to the printer"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              testState === 'success'
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                : testState === 'failed'
                ? 'bg-red-500/10 text-red-500 border border-red-500/30'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {testState === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
            {testState === 'success' && <CheckCircle2 className="h-3 w-3" />}
            {testState === 'failed'  && <XCircle className="h-3 w-3" />}
            {testState === 'idle'    && <FlaskConical className="h-3 w-3" />}
            {testState === 'loading' ? 'Printing...' :
             testState === 'success' ? 'Sent!' :
             testState === 'failed'  ? 'Failed' : 'Test Print'}
          </button>
          {/* Refresh */}
          <button
            onClick={fetchStatus}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh now"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Test print result message */}
      {(testState === 'success' || testState === 'failed') && testMessage && (
        <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
          testState === 'success'
            ? 'bg-emerald-500/10 text-emerald-500'
            : 'bg-red-500/10 text-red-500'
        }`}>
          {testState === 'success'
            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            : <XCircle className="h-3.5 w-3.5 shrink-0" />}
          <span>{testMessage}</span>
        </div>
      )}

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

      {/* Printer Dropdown */}
      {!error && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Available Printers</p>
            <button
              onClick={fetchPrinters}
              disabled={listLoading}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              {listLoading
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <RefreshCw className="h-3 w-3" />}
              Refresh
            </button>
          </div>
          <div className="relative">
            <select
              className="w-full appearance-none rounded-md border border-border bg-muted/50 px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              defaultValue=""
            >
              <option value="" disabled>
                {listLoading ? 'Loading...' : printerList.length === 0 ? 'No printers found' : 'Select a printer...'}
              </option>
              {printerList.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            Set <code className="font-mono bg-muted px-1 rounded">PRINTER_NAME</code> in{' '}
            <code className="font-mono bg-muted px-1 rounded">Config.java</code> to target a specific printer.
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
