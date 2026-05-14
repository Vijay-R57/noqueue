import { useEffect, useRef, useState } from 'react'

export interface OrderEvent {
  orderId: number
  tokenNumber: string
  status: string
  userName: string
  updatedAt: string
}

interface UseOrderEventsOptions {
  /** Called for every incoming order-update event */
  onEvent: (event: OrderEvent) => void
  /** Called when the SSE connection is first established (or re-established) */
  onConnect?: () => void
  /** Called when the SSE connection drops (network error / server restart) */
  onError?: () => void
  /** Set false to disable the connection without unmounting the hook */
  enabled?: boolean
}

const SSE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}/api/v1/events/orders`

/**
 * useOrderEvents
 *
 * Opens a persistent Server-Sent Events connection to the Spring Boot backend.
 * Automatically reconnects after network interruptions (browser native behaviour).
 * Returns `isConnected` so callers can show a live/offline badge.
 */
export function useOrderEvents({
  onEvent,
  onConnect,
  onError,
  enabled = true,
}: UseOrderEventsOptions): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false)

  // Keep stable callback references so the effect never re-runs due to prop identity
  const onEventRef   = useRef(onEvent)
  const onConnectRef = useRef(onConnect)
  const onErrorRef   = useRef(onError)
  useEffect(() => { onEventRef.current   = onEvent   }, [onEvent])
  useEffect(() => { onConnectRef.current = onConnect }, [onConnect])
  useEffect(() => { onErrorRef.current   = onError   }, [onError])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const es = new EventSource(SSE_URL)

    es.addEventListener('connected', () => {
      setIsConnected(true)
      onConnectRef.current?.()
      console.info('[SSE] Connected to order event stream.')
    })

    es.addEventListener('order-update', (e: MessageEvent) => {
      try {
        const event: OrderEvent = JSON.parse(e.data)
        onEventRef.current(event)
      } catch {
        console.warn('[SSE] Failed to parse order-update payload', e.data)
      }
    })

    es.onerror = () => {
      setIsConnected(false)
      onErrorRef.current?.()
      console.warn('[SSE] Connection error — browser will auto-reconnect.')
    }

    return () => {
      es.close()
      setIsConnected(false)
    }
  }, [enabled])

  return { isConnected }
}
