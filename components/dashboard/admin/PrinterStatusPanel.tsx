'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Printer, Wifi, WifiOff, Loader2, AlertTriangle, RefreshCw,
  CheckCircle2, XCircle, FlaskConical, ChevronDown, Link2, Link2Off,
  Unplug, PauseCircle, PlayCircle, Radio, HeartPulse,
} from 'lucide-react'
import { getAuthState } from '@/lib/auth'

// ── Types ────────────────────────────────────────────────────────────────────
interface BackendPrinterStatus {
  agentOnline:       boolean
  printerName:       string
  printerConnected:  boolean
  printerState:      'IDLE' | 'PRINTING' | 'PAUSED' | 'OFFLINE' | string
  lastPing:          string
  configuredPrinter: string
}

interface Toast {
  id:      number
  type:    'success' | 'error' | 'info'
  message: string
}

// ── Constants ────────────────────────────────────────────────────────────────
// Backend is the single source of truth (agent heartbeats into it)
const BACKEND_BASE      = 'http://localhost:8080/api/v1'
const BACKEND_STATUS    = `${BACKEND_BASE}/printer/status`
const BACKEND_CONNECT   = `${BACKEND_BASE}/printer/connect`
const BACKEND_DISCONNECT= `${BACKEND_BASE}/printer/disconnect`

// Local agent still used for printer LIST and TEST PRINT (localhost operations)
const AGENT_LIST_URL    = 'http://localhost:9090/printer/list'
const AGENT_TEST_URL    = 'http://localhost:9090/printer/test'
const AGENT_PAUSE_URL   = 'http://localhost:9090/printer/pause'
const AGENT_RESUME_URL  = 'http://localhost:9090/printer/resume'

const REFRESH_INTERVAL_MS = 4000

let toastCounter = 0

function getAuthHeader(): Record<string, string> {
  const auth = getAuthState()
  return auth.token ? { 'Authorization': `Bearer ${auth.token}` } : {}
}

export function PrinterStatusPanel() {
  const [status, setStatus]                   = useState<BackendPrinterStatus | null>(null)
  const [error, setError]                     = useState<string | null>(null)
  const [lastRefresh, setLastRefresh]         = useState<Date | null>(null)
  const [testState, setTestState]             = useState<'idle' | 'loading' | 'success' | 'failed'>('idle')
  const [printerList, setPrinterList]         = useState<string[]>([])
  const [listLoading, setListLoading]         = useState(false)
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [connectState, setConnectState]       = useState<'idle' | 'loading' | 'success' | 'failed'>('idle')
  const [disconnectState, setDisconnectState] = useState<'idle' | 'loading'>('idle')
  const [pauseState, setPauseState]           = useState<'idle' | 'loading'>('idle')
  const [toasts, setToasts]                   = useState<Toast[]>([])

  // ── Toast helpers ─────────────────────────────────────────────────────────
  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  // ── Fetch status from BACKEND (heartbeat-driven) ──────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(BACKEND_STATUS, {
        cache: 'no-store',
        headers: getAuthHeader(),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: BackendPrinterStatus = await res.json()
      setStatus(data)
      setError(null)
    } catch {
      setStatus(null)
      setError('Cannot reach backend. Ensure the backend server is running.')
    } finally {
      setLastRefresh(new Date())
    }
  }, [])

  // ── Fetch physical printer list from LOCAL AGENT ──────────────────────────
  const fetchPrinters = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await fetch(AGENT_LIST_URL, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data: string[] = await res.json()
      setPrinterList(data)
    } catch {
      setPrinterList([])
    } finally {
      setListLoading(false)
    }
  }, [])

  // ── Connect: Admin tells BACKEND which printer to use ────────────────────
  // Backend stores it; Agent polls /printer/config and auto-binds within 5s
  const connectPrinter = async () => {
    if (!selectedPrinter) return
    setConnectState('loading')
    try {
      const res = await fetch(BACKEND_CONNECT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ printerName: selectedPrinter }),
      })
      const data = await res.json()
      if (res.ok) {
        setConnectState('success')
        showToast('success', `✅ Connect request sent. Agent will bind "${selectedPrinter}" within 5 seconds.`)
        setTimeout(fetchStatus, 6000) // refresh after agent picks it up
      } else {
        setConnectState('failed')
        showToast('error', data.error || 'Failed to send connect request')
      }
    } catch {
      setConnectState('failed')
      showToast('error', 'Cannot reach backend server.')
    }
    setTimeout(() => setConnectState('idle'), 5000)
  }

  // ── Disconnect: Clear configured printer in backend ───────────────────────
  const disconnectPrinter = async () => {
    setDisconnectState('loading')
    try {
      await fetch(BACKEND_DISCONNECT, {
        method: 'POST',
        headers: getAuthHeader(),
      })
      showToast('info', 'Disconnect requested. Agent will revert to OS default.')
      setSelectedPrinter('')
      setTimeout(fetchStatus, 2000)
    } catch {
      showToast('error', 'Cannot reach backend server.')
    }
    setDisconnectState('idle')
  }

  // ── Pause / Resume queue (still local agent operation) ────────────────────
  const togglePause = async () => {
    const currentlyPaused = status?.printerState === 'PAUSED'
    const url = currentlyPaused ? AGENT_RESUME_URL : AGENT_PAUSE_URL
    setPauseState('loading')
    try {
      await fetch(url, { method: 'POST' })
      showToast('info', currentlyPaused ? '▶ Queue resumed.' : '⏸ Queue paused.')
      setTimeout(fetchStatus, 2000)
    } catch {
      showToast('error', 'Agent unreachable on port 9090.')
    }
    setPauseState('idle')
  }

  // ── Test print (local agent operation) ───────────────────────────────────
  const sendTestPrint = async () => {
    setTestState('loading')
    try {
      const res = await fetch(AGENT_TEST_URL, { method: 'POST' })
      const data = await res.json()
      if (data.status === 'success') {
        setTestState('success')
        showToast('success', `🖨️ Test page sent to: ${data.printer}`)
      } else {
        setTestState('failed')
        showToast('error', `Printer unavailable: ${data.reason || 'Unknown error'}`)
      }
    } catch {
      setTestState('failed')
      showToast('error', 'Agent unreachable on port 9090.')
    }
    setTimeout(() => setTestState('idle'), 4000)
  }

  useEffect(() => {
    fetchStatus()
    fetchPrinters()
    const interval = setInterval(fetchStatus, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchStatus, fetchPrinters])

  // ── Derived state ─────────────────────────────────────────────────────────
  const agentOnline   = status?.agentOnline === true
  const isPrinting    = status?.printerState === 'PRINTING'
  const isPaused      = status?.printerState === 'PAUSED'
  const printerOnline = status?.printerConnected === true

  const lastPingFormatted = status?.lastPing && status.lastPing !== 'Never'
    ? new Date(status.lastPing).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Never'

  const connectLabel =
    connectState === 'loading' ? 'Sending request...' :
    connectState === 'success' ? 'Request sent ✅'    :
    connectState === 'failed'  ? 'Request failed'     :
    'Connect Printer'

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 relative">

      {/* ── Toast Stack ──────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium shadow-lg border pointer-events-auto
              animate-in slide-in-from-bottom-4 fade-in duration-300
              ${t.type === 'success'
                ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300'
                : t.type === 'error'
                ? 'bg-red-950 border-red-500/40 text-red-300'
                : 'bg-blue-950 border-blue-500/40 text-blue-300'
              }`}
          >
            {t.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
            {t.type === 'error'   && <XCircle      className="h-4 w-4 shrink-0 text-red-400"     />}
            {t.type === 'info'    && <Radio        className="h-4 w-4 shrink-0 text-blue-400"    />}
            {t.message}
          </div>
        ))}
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Printer className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Printer Status</h2>

          {/* Heartbeat agent badge */}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border
            ${agentOnline
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            <HeartPulse className={`h-2.5 w-2.5 ${agentOnline ? 'animate-pulse' : ''}`} />
            Agent {agentOnline ? 'Live' : 'Offline'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Test Print Button */}
          <button
            id="test-print-btn"
            onClick={sendTestPrint}
            disabled={testState === 'loading' || !agentOnline}
            title="Send a test page to the printer"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              testState === 'success'
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                : testState === 'failed'
                ? 'bg-red-500/10 text-red-500 border border-red-500/30'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {testState === 'loading' && <Loader2      className="h-3 w-3 animate-spin" />}
            {testState === 'success' && <CheckCircle2 className="h-3 w-3"              />}
            {testState === 'failed'  && <XCircle      className="h-3 w-3"              />}
            {testState === 'idle'    && <FlaskConical  className="h-3 w-3"              />}
            {testState === 'loading' ? 'Printing...' :
             testState === 'success' ? 'Sent!'       :
             testState === 'failed'  ? 'Failed'      : 'Test Print'}
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

      {/* ── Backend error ────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-amber-500">Backend Unreachable</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* ── Agent offline notice ─────────────────────────────────────────── */}
      {!error && !agentOnline && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-amber-500">Print Agent Not Running</p>
            <p className="text-xs text-muted-foreground">
              Run <code className="bg-muted px-1 rounded font-mono">NoQueueAgentInstaller.bat</code> once,
              then <code className="bg-muted px-1 rounded font-mono">start-agent.bat</code> to launch it.
            </p>
          </div>
        </div>
      )}

      {/* ── Connected Printer Badge ───────────────────────────────────────── */}
      {status?.configuredPrinter ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest">Configured Printer</p>
              <p className="text-sm font-bold text-emerald-300 truncate flex items-center gap-1.5" title={status.configuredPrinter}>
                {status.configuredPrinter}
                {printerOnline && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
              </p>
            </div>
          </div>
          <button
            id="disconnect-printer-btn"
            onClick={disconnectPrinter}
            disabled={disconnectState === 'loading'}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium
              bg-red-500/10 text-red-400 border border-red-500/30
              hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {disconnectState === 'loading'
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Unplug  className="h-3 w-3"              />}
            Disconnect
          </button>
        </div>
      ) : (
        !error && (
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <Link2Off className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">No printer configured — select one below to connect</p>
          </div>
        )
      )}

      {/* ── Status Grid ──────────────────────────────────────────────────── */}
      {status && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Printer</p>
            <p className="text-sm font-semibold text-foreground truncate" title={status.printerName}>
              {status.printerName || '—'}
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Connection</p>
            <div className="flex items-center gap-2">
              {printerOnline && agentOnline ? (
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

          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">State</p>
            <div className="flex items-center gap-2">
              {isPaused ? (
                <><PauseCircle className="h-3.5 w-3.5 text-amber-500" /><span className="text-sm font-semibold text-amber-500">Paused</span></>
              ) : isPrinting ? (
                <><Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" /><span className="text-sm font-semibold text-blue-500">Printing...</span></>
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">{status.printerState || 'Idle'}</span>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Last Heartbeat</p>
            <p className="text-sm font-semibold text-foreground">{lastPingFormatted}</p>
          </div>
        </div>
      )}

      {/* ── Pause / Resume ────────────────────────────────────────────────── */}
      {agentOnline && (
        <button
          id="pause-resume-queue-btn"
          onClick={togglePause}
          disabled={pauseState === 'loading'}
          className={`w-full flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all border
            ${isPaused
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {pauseState === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" />
            : isPaused ? <PlayCircle className="h-4 w-4" />
            : <PauseCircle className="h-4 w-4" />}
          {pauseState === 'loading' ? 'Please wait...' : isPaused ? '▶ Resume Queue' : '⏸ Pause Queue'}
        </button>
      )}

      {/* ── Printer Selection + Connect ───────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Select Physical Printer
          </p>
          <button
            onClick={fetchPrinters}
            disabled={listLoading}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {listLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </button>
        </div>

        <div className="relative">
          <select
            value={selectedPrinter}
            onChange={(e) => { setSelectedPrinter(e.target.value); setConnectState('idle') }}
            className="w-full appearance-none rounded-md border border-border bg-muted/50 px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <option value="" disabled>
              {listLoading
                ? 'Loading printers from agent...'
                : printerList.length === 0
                ? 'No physical printers detected (start agent first)'
                : 'Select a printer...'}
            </option>
            {printerList.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>

        {/* Connect Button */}
        <button
          id="connect-printer-btn"
          onClick={connectPrinter}
          disabled={!selectedPrinter || connectState === 'loading'}
          className={`w-full flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
            connectState === 'success'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : connectState === 'failed'
              ? 'bg-red-500/15 text-red-400 border border-red-500/30'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {connectState === 'loading' && <Loader2      className="h-4 w-4 animate-spin" />}
          {connectState === 'success' && <CheckCircle2 className="h-4 w-4"              />}
          {connectState === 'failed'  && <Link2Off     className="h-4 w-4"              />}
          {connectState === 'idle'    && <Link2        className="h-4 w-4"              />}
          {connectLabel}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          The Print Agent auto-detects this request and binds the printer within 5 seconds.
        </p>
      </div>

      {/* ── Auto-refresh indicator ────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground text-right">
        Heartbeat-driven • refreshes every {REFRESH_INTERVAL_MS / 1000}s
      </p>
    </div>
  )
}
