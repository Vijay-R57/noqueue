'use client'

import React, { useState, useEffect, useRef } from 'react'
import { initiatePayment, verifyPayment, PaymentInitiateResult } from '@/services/api'
import { PaymentMethod } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import {
  Smartphone,
  QrCode,
  Banknote,
  CheckCircle2,
  X,
  ArrowLeft,
  Copy,
  Clock,
} from 'lucide-react'

// ── tiny QR renderer using Google Charts API (no extra dep needed) ───────────
function QrImage({ data, size = 180 }: { data: string; size?: number }) {
  const encoded = encodeURIComponent(data)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`}
      alt="QR code"
      width={size}
      height={size}
      className="rounded-lg border border-border mx-auto"
    />
  )
}

// ── Payment method card ────────────────────────────────────────────────────
interface MethodCardProps {
  icon: React.ReactNode
  label: string
  description: string
  recommended?: boolean
  onClick: () => void
}

function MethodCard({ icon, label, description, recommended, onClick }: MethodCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full group relative flex items-center gap-4 p-4 rounded-xl border border-border bg-card
                 hover:border-primary hover:bg-primary/5 hover:shadow-md transition-all duration-200 text-left"
    >
      {recommended && (
        <span className="absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                         bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          Recommended
        </span>
      )}
      <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center
                      text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────
interface PaymentModalProps {
  orderId: string
  tokenNumber: number
  amount: number
  onClose: () => void
  /** Called after any successful payment (UPI verify or CASH select) */
  onPaymentComplete: (result: PaymentInitiateResult) => void
}

// ── Step types ─────────────────────────────────────────────────────────────
type Step = 'select' | 'upi' | 'qr' | 'cash' | 'verify' | 'success'

export function PaymentModal({
  orderId,
  tokenNumber,
  amount,
  onClose,
  onPaymentComplete,
}: PaymentModalProps) {
  const [step, setStep] = useState<Step>('select')
  const [loading, setLoading] = useState(false)
  const [upiId, setUpiId] = useState('')
  const [txnId, setTxnId] = useState('')
  const [qrData, setQrData] = useState('')
  const [successResult, setSuccessResult] = useState<PaymentInitiateResult | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose()
  }

  // ── UPI flow ──────────────────────────────────────────────────────────────
  const handleUpiInitiate = async () => {
    if (!upiId.trim()) {
      toast.error('Please enter your UPI ID')
      return
    }
    setLoading(true)
    try {
      const result = await initiatePayment(orderId, 'UPI', upiId.trim())
      setQrData(result.qrData ?? '')
      setStep('verify') // ask for txn ID after paying
      toast.info('Complete the payment in your UPI app, then enter the transaction ID.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to initiate payment')
    } finally {
      setLoading(false)
    }
  }

  // ── QR flow ───────────────────────────────────────────────────────────────
  const handleQrInitiate = async () => {
    setLoading(true)
    try {
      const result = await initiatePayment(orderId, 'QR')
      setQrData(result.qrData ?? '')
      setStep('qr')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate QR')
    } finally {
      setLoading(false)
    }
  }

  // ── CASH flow ─────────────────────────────────────────────────────────────
  const handleCash = async () => {
    setLoading(true)
    try {
      const result = await initiatePayment(orderId, 'CASH')
      setSuccessResult(result)
      setStep('success')
      onPaymentComplete(result)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to select Cash on Receive')
    } finally {
      setLoading(false)
    }
  }

  // ── Verify txn ────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!txnId.trim()) {
      toast.error('Please enter the Transaction ID')
      return
    }
    setLoading(true)
    try {
      const result = await verifyPayment(orderId, txnId.trim())
      setSuccessResult(result)
      setStep('success')
      onPaymentComplete(result)
      toast.success('Payment verified! Your order is now in the queue.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied!')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={overlayRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div
        className="relative w-full max-w-md bg-background rounded-2xl shadow-2xl border border-border
                   overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            {step !== 'select' && step !== 'success' && (
              <button
                onClick={() => setStep(step === 'verify' ? 'upi' : 'select')}
                className="mr-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="font-bold text-lg text-foreground">
                {step === 'select' && 'Choose Payment Method'}
                {step === 'upi' && 'Pay via UPI'}
                {step === 'qr' && 'Scan QR Code'}
                {step === 'cash' && 'Cash on Receive'}
                {step === 'verify' && 'Enter Transaction ID'}
                {step === 'success' && 'Payment Successful!'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Token #{tokenNumber} &nbsp;·&nbsp; ₹{amount}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* ── Amount badge ─────────────────────────────────────── */}
          {step !== 'success' && (
            <div className="flex justify-center">
              <div className="px-6 py-3 rounded-2xl bg-primary/10 text-center">
                <p className="text-xs text-muted-foreground font-medium">Amount to Pay</p>
                <p className="text-4xl font-extrabold text-primary">₹{amount}</p>
              </div>
            </div>
          )}

          {/* ── Step: select ───────────────────────────────────────── */}
          {step === 'select' && (
            <div className="space-y-3">
              <MethodCard
                icon={<Smartphone className="w-5 h-5" />}
                label="UPI"
                description="Google Pay, PhonePe, Paytm, BHIM…"
                recommended
                onClick={() => setStep('upi')}
              />
              <MethodCard
                icon={<QrCode className="w-5 h-5" />}
                label="QR Code"
                description="Scan with any UPI app"
                onClick={handleQrInitiate}
              />
              <MethodCard
                icon={<Banknote className="w-5 h-5" />}
                label="Cash on Receive"
                description="Pay cash at the shop counter"
                onClick={handleCash}
              />
            </div>
          )}

          {/* ── Step: UPI ─────────────────────────────────────────── */}
          {step === 'upi' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Your UPI ID</label>
                <Input
                  placeholder="e.g. yourname@okaxis"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpiInitiate()}
                  disabled={loading}
                  id="upi-id-input"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  You'll be asked to confirm ₹{amount} in your UPI app.
                </p>
              </div>
              <Button className="w-full" onClick={handleUpiInitiate} disabled={loading || !upiId.trim()}>
                {loading ? <><Spinner className="mr-2" /> Processing…</> : 'Pay ₹' + amount + ' via UPI'}
              </Button>
            </div>
          )}

          {/* ── Step: QR ──────────────────────────────────────────── */}
          {step === 'qr' && (
            <div className="space-y-4 text-center">
              {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Scan this code with <span className="font-medium text-foreground">any UPI app</span> to pay ₹{amount}
                  </p>
                  <QrImage data={qrData} size={200} />
                  <button
                    onClick={() => copyToClipboard(qrData)}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Copy className="w-3 h-3" /> Copy UPI link
                  </button>
                  <Button className="w-full mt-2" onClick={() => setStep('verify')}>
                    I've Paid — Enter Transaction ID
                  </Button>
                </>
              )}
            </div>
          )}

          {/* ── Step: verify txn ID ───────────────────────────────── */}
          {step === 'verify' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex gap-3">
                <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Enter the <strong>UPI Transaction ID</strong> (UTR) from your payment confirmation
                  message to verify payment.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Transaction ID (UTR)</label>
                <Input
                  placeholder="e.g. 405612345678"
                  value={txnId}
                  onChange={(e) => setTxnId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  disabled={loading}
                  id="txn-id-input"
                />
              </div>
              <Button className="w-full" onClick={handleVerify} disabled={loading || !txnId.trim()}>
                {loading ? <><Spinner className="mr-2" /> Verifying…</> : 'Verify Payment'}
              </Button>
            </div>
          )}

          {/* ── Step: success ─────────────────────────────────────── */}
          {step === 'success' && successResult && (
            <div className="text-center space-y-4 py-2">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                </div>
              </div>

              {successResult.orderStatus === 'CASH_PENDING' ? (
                <>
                  <div>
                    <p className="font-bold text-lg">Cash on Receive Selected</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your order has been placed. Please pay <span className="font-semibold text-foreground">₹{amount}</span> at
                      the counter when collecting your prints.
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground space-y-1 text-left">
                    <p>🪙 <strong>Token:</strong> #{tokenNumber}</p>
                    <p>💵 <strong>Status:</strong> Awaiting cash payment at counter</p>
                    <p>⚠️ Your print job enters the queue after the admin confirms cash receipt.</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="font-bold text-lg">Payment Confirmed!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your order is now in the <span className="font-semibold text-foreground">print queue</span>.
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground space-y-1 text-left">
                    <p>🎟️ <strong>Token:</strong> #{tokenNumber}</p>
                    <p>💳 <strong>Method:</strong> {successResult.paymentMethod}</p>
                    {successResult.paymentMethod !== 'CASH' && (
                      <p>🔖 <strong>Txn ID:</strong> {txnId}</p>
                    )}
                    <p>✅ <strong>Status:</strong> READY TO PRINT</p>
                  </div>
                </>
              )}
              <Button className="w-full" onClick={onClose}>
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
