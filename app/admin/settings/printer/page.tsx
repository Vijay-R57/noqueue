'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthState } from '@/lib/auth'
import {
  Printer, Wifi, WifiOff, Loader2, AlertTriangle,
  RefreshCw, CheckCircle2, XCircle, FlaskConical,
  ChevronDown, ArrowLeft, Server, Clock
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────
interface PrinterStatus {
  name: string
  status: 'ONLINE' | 'OFFLINE'
  isPrinting: boolean
  lastChecked: string
}

type AgentHealth = 'ONLINE' | 'OFFLINE' | 'AGENT_NOT_RUNNING'
type TestState   = 'idle' | 'loading' | 'success' | 'failed'

// ── Constants ──────────────────────────────────────────────────────────────
const AGENT_BASE    = 'http://localhost:9090'
const STATUS_URL    = `${AGENT_BASE}/printer/status`
const LIST_URL      = `${AGENT_BASE}/printer/list`
const TEST_URL      = `${AGENT_BASE}/printer/test`

// ── Badge helper ───────────────────────────────────────────────────────────
function Badge({ label, variant }: { label: string; variant: 'green' | 'red' | 'yellow' | 'blue' | 'muted' }) {
  const colors = {
    green:  'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    red:    'bg-red-500/10 text-red-500 border-red-500/30',
    yellow: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    blue:   'bg-blue-500/10 text-blue-500 border-blue-500/30',
    muted:  'bg-muted text-muted-foreground border-border',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[variant]}`}>
      {label}
    </span>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function PrinterSettingsPage() {
  const router = useRouter()

  // Auth guard
  useEffect(() => {
    const auth = getAuthState()
    if (!auth.isLoggedIn || auth.role !== 'admin') router.push('/login')
  }, [router])

  // ── State ──────────────────────────────────────────────────────────────
  const [agentHealth, setAgentHealth]     = useState<AgentHealth>('AGENT_NOT_RUNNING')
  const [status, setStatus]               = useState<PrinterStatus | null>(null)
  const [lastPing, setLastPing]           = useState<Date | null>(null)

  const [printerList, setPrinterList]     = useState<string[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>('')
  const [listLoading, setListLoading]     = useState(false)

  const [testState, setTestState]         = useState<TestState>('idle')
  const [testMessage, setTestMessage]     = useState('')

  // ── Fetch printer status ───────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(STATUS_URL, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data: PrinterStatus = await res.json()
      setStatus(data)
      setAgentHealth(data.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE')
      setLastPing(new Date())
    } catch {
      setStatus(null)
      setAgentHealth('AGENT_NOT_RUNNING')
      setLastPing(new Date())
    }
  }, [])

  // ── Fetch printer list ─────────────────────────────────────────────────
  const fetchPrinters = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await fetch(LIST_URL, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data: string[] = await res.json()
      setPrinterList(data)
      // Auto-select if only one printer, or pre-select configured one
      if (data.length === 1) setSelectedPrinter(data[0])
    } catch {
      setPrinterList([])
    } finally {
      setListLoading(false)
    }
  }, [])

  // ── Test print ─────────────────────────────────────────────────────────
  const sendTestPrint = async () => {
    setTestState('loading')
    setTestMessage('')
    try {
      const res = await fetch(TEST_URL, { method: 'POST' })
      const data = await res.json()
      if (data.status === 'success') {
        setTestState('success')
        setTestMessage(`Successfully sent to: ${data.printer}`)
      } else {
        setTestState('failed')
        setTestMessage(data.reason || 'Unknown error')
      }
    } catch {
      setTestState('failed')
      setTestMessage('Agent unreachable on port 9090.')
    }
    setTimeout(() => setTestState('idle'), 5000)
  }

  // ── Initial load + polling ─────────────────────────────────────────────
  useEffect(() => {
    fetchStatus()
    fetchPrinters()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus, fetchPrinters])

  // ── Derived state ──────────────────────────────────────────────────────
  const isAgentRunning = agentHealth !== 'AGENT_NOT_RUNNING'
  const isPrinterOnline = status?.status === 'ONLINE'
  const isPrinting = status?.isPrinting === true

  const agentBadgeVariant = agentHealth === 'AGENT_NOT_RUNNING' ? 'yellow'
    : agentHealth === 'ONLINE' ? 'green' : 'red'

  const printerBadgeVariant = !isAgentRunning ? 'muted'
    : isPrinterOnline ? 'green' : 'red'

  const lastPingStr = lastPing
    ? lastPing.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Printer className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Printer Settings</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-6">

        {/* ── 1. AGENT INFO CARD ──────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Print Agent</h2>
            </div>
            <button
              onClick={fetchStatus}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Agent URL</p>
              <p className="text-xs font-mono text-foreground">{AGENT_BASE}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Agent Status</p>
              <Badge
                label={agentHealth === 'AGENT_NOT_RUNNING' ? 'Not Running' : agentHealth}
                variant={agentBadgeVariant}
              />
            </div>
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Last Ping</p>
              <div className="flex items-center gap-1.5 text-xs text-foreground">
                <Clock className="h-3 w-3 text-muted-foreground" />
                {lastPingStr}
              </div>
            </div>
          </div>

          {!isAgentRunning && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-500">Print Agent is not running</p>
                <p className="text-xs text-muted-foreground">
                  Start the agent from the <code className="font-mono bg-muted px-1 rounded">print-agent</code> folder:
                </p>
                <code className="block text-xs font-mono bg-muted rounded px-2 py-1 text-foreground">
                  .\gradlew.bat run
                </code>
              </div>
            </div>
          )}
        </div>

        {/* ── 2. CONNECTION STATUS CARD ────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            {isPrinterOnline
              ? <Wifi className="h-4 w-4 text-emerald-500" />
              : <WifiOff className="h-4 w-4 text-muted-foreground" />}
            <h2 className="text-sm font-semibold text-foreground">Connection Status</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Printer</p>
              <p className="text-sm font-semibold text-foreground truncate" title={status?.name}>
                {status?.name || '—'}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Connection</p>
              <div className="flex items-center gap-2">
                {isPrinterOnline && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
                <Badge
                  label={!isAgentRunning ? 'AGENT OFFLINE' : isPrinterOnline ? 'ONLINE' : 'OFFLINE'}
                  variant={printerBadgeVariant}
                />
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">State</p>
              {isPrinting ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                  <Badge label="Printing" variant="blue" />
                </div>
              ) : (
                <Badge label="Idle" variant="muted" />
              )}
            </div>
          </div>

          {isAgentRunning && !isPrinterOnline && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-500 font-medium">
                Printer is offline or not found. Check that it's connected and powered on.
              </p>
            </div>
          )}
        </div>

        {/* ── 3. PRINTER SELECTION CARD ────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Printer Selection</h2>
            </div>
            <button
              onClick={fetchPrinters}
              disabled={listLoading || !isAgentRunning}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {listLoading
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <RefreshCw className="h-3 w-3" />}
              Refresh
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Available Printers
            </label>
            <div className="relative">
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                disabled={!isAgentRunning || listLoading}
                className="w-full appearance-none rounded-md border border-border bg-muted/50 px-3 py-2.5 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" disabled>
                  {!isAgentRunning ? 'Agent not running' :
                    listLoading ? 'Loading printers...' :
                    printerList.length === 0 ? 'No printers found' :
                    'Select a printer...'}
                </option>
                {printerList.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            {printerList.length > 0 && (
              <p className="text-xs text-muted-foreground">
                To make this permanent, set{' '}
                <code className="font-mono bg-muted px-1 rounded">PRINTER_NAME=&quot;{selectedPrinter}&quot;</code>{' '}
                as an environment variable or update{' '}
                <code className="font-mono bg-muted px-1 rounded">Config.java</code>.
              </p>
            )}
          </div>
        </div>

        {/* ── 4. TEST PRINT CARD ───────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Test Print</h2>
          </div>

          <p className="text-sm text-muted-foreground">
            Sends a test page to the configured printer. Use this to verify the printer is connected and working correctly before processing real jobs.
          </p>

          <button
            onClick={sendTestPrint}
            disabled={testState === 'loading' || !isAgentRunning}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              testState === 'success'
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                : testState === 'failed'
                ? 'bg-red-500/10 text-red-500 border border-red-500/30'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {testState === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
            {testState === 'success' && <CheckCircle2 className="h-4 w-4" />}
            {testState === 'failed'  && <XCircle className="h-4 w-4" />}
            {testState === 'idle'    && <FlaskConical className="h-4 w-4" />}
            {testState === 'loading' ? 'Printing Test Page...' :
             testState === 'success' ? 'Test Page Sent!' :
             testState === 'failed'  ? 'Test Failed' :
             'Print Test Page'}
          </button>

          {testMessage && (
            <div className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-sm ${
              testState === 'success' || testMessage.startsWith('Successfully')
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-red-500/10 text-red-500'
            }`}>
              {testState === 'success' || testMessage.startsWith('Successfully')
                ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                : <XCircle className="h-4 w-4 shrink-0" />}
              {testMessage}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
