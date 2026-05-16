'use client'

import React, { useState, useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { placeOrder, calculatePrice, initiatePayment, verifyPayment, getPaymentConfig } from '@/services/api'
import { Template, PaymentMethod, PaymentConfig } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, X, Smartphone, QrCode, Banknote, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

const uploadSchema = z.object({
  pages: z.coerce.number().min(1, 'Pages must be at least 1'),
  colorType: z.enum(['B&W', 'Color']),
  printType: z.enum(['Single', 'Double']),
  binding: z.enum(['None', 'Spiral', 'Soft']),
})

type UploadFormValues = z.infer<typeof uploadSchema>

interface UploadPrintJobCardProps {
  userEmail: string
  onOrderPlaced?: () => void
  selectedTemplate?: Template | null
}

function QrImage({ data, size = 150 }: { data: string; size?: number }) {
  const encoded = encodeURIComponent(data)
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`}
      alt="QR code"
      width={size}
      height={size}
      className="rounded-lg border border-border mx-auto"
    />
  )
}

export function UploadPrintJobCard({ userEmail, onOrderPlaced, selectedTemplate }: UploadPrintJobCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [price, setPrice] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [txnId, setTxnId] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [placedOrderInfo, setPlacedOrderInfo] = useState<{ token: number; method: PaymentMethod } | null>(null)
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)

  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null)

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      pages: '' as unknown as number,
      colorType: 'B&W',
      printType: 'Single',
      binding: 'None',
    },
  })

  const pages = form.watch('pages')
  const colorType = form.watch('colorType')
  const binding = form.watch('binding')

  // Apply a template to the form
  const applyTemplate = (template: Template) => {
    form.setValue('pages', template.pages)
    form.setValue('colorType', template.colorType)
    form.setValue('printType', template.printType)
    form.setValue('binding', template.binding)
    toast.success(`Applied template: ${template.name}`)
  }

  // Apply selected template when it changes
  useEffect(() => {
    if (selectedTemplate) {
      applyTemplate(selectedTemplate)
    }
  }, [selectedTemplate])

  // Fetch payment config
  useEffect(() => {
    getPaymentConfig().then(setConfig => setPaymentConfig(setConfig)).catch(console.error)
  }, [])

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported')
      return
    }
    setUploadedFile(file)
    toast.success(`File selected: ${file.name}`)
  }

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      handleFileSelect(file)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      handleFileSelect(file)
    }
  }

  // Update price dynamically
  useEffect(() => {
    if (pages && !isNaN(Number(pages))) {
      const calculated = calculatePrice(Number(pages), colorType, binding)
      setPrice(calculated)
    } else {
      setPrice(0)
    }
  }, [pages, colorType, binding])

  async function onSubmit(values: UploadFormValues) {
    if (!uploadedFile) {
      toast.error('Please upload a PDF file')
      return
    }
    if (!paymentMethod) {
      toast.error('Please select a payment method')
      return
    }
    if ((paymentMethod === 'UPI' || paymentMethod === 'QR') && !txnId.trim()) {
      toast.error('Please enter the transaction ID')
      return
    }

    setPaymentError('')
    setIsLoading(true)
    try {
      let orderId = pendingOrderId
      let token = placedOrderInfo?.token

      // Only place order if we haven't already (in case of a retry after failed payment)
      if (!orderId) {
        const fileUrl = URL.createObjectURL(uploadedFile)
        const order = await placeOrder({
          userName: userEmail.split('@')[0],
          userEmail: userEmail,
          fileName: uploadedFile.name,
          fileUrl: fileUrl,
          pages: Number(values.pages),
          colorType: values.colorType,
          printType: values.printType,
          binding: values.binding,
          price: price,
          status: 'PAYMENT_PENDING',
        })
        orderId = String(order.id)
        token = order.tokenNumber
        setPendingOrderId(orderId)
      }

      // Initiate Payment
      await initiatePayment(orderId, paymentMethod)

      // Verify Payment if needed
      if (paymentMethod !== 'CASH') {
        await verifyPayment(orderId, txnId)
      }

      setPlacedOrderInfo({ token: token!, method: paymentMethod })
      setShowSuccess(true)
      onOrderPlaced?.()

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment failed'
      setPaymentError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const isPlaceOrderEnabled = uploadedFile && paymentMethod && (paymentMethod === 'CASH' || txnId.trim().length > 0)

  if (showSuccess && placedOrderInfo) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10">
        <CardContent className="py-12 text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto animate-in zoom-in duration-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">Order Placed Successfully!</h2>
            <p className="text-muted-foreground">
              Your token number is <span className="font-bold text-foreground">#{placedOrderInfo.token}</span>
            </p>
          </div>
          
          {placedOrderInfo.method === 'CASH' && (
            <p className="text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 inline-block">
              Please pay at the counter to start printing.
            </p>
          )}
          
          <div className="pt-4">
            <Button 
              onClick={() => {
                setShowSuccess(false)
                setPlacedOrderInfo(null)
                setPendingOrderId(null)
                setPaymentMethod(null)
                setTxnId('')
                setPaymentError('')
                form.reset()
                setUploadedFile(null)
              }}
              variant="outline"
            >
              Place Another Order
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Place New Order</CardTitle>
        <CardDescription>Upload and configure your print job</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* File Upload Component */}
            <div>
              <label className="text-sm font-medium mb-2 block">Upload File (PDF)</label>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  dragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="hidden"
                  id="pdf-upload"
                />
                <label htmlFor="pdf-upload" className="cursor-pointer block">
                  {uploadedFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-emerald-600">
                        <span className="text-lg">✓</span>
                        <span className="text-sm font-medium">{uploadedFile.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          setUploadedFile(null)
                          const input = document.getElementById('pdf-upload') as HTMLInputElement
                          if (input) input.value = ''
                        }}
                        disabled={isLoading}
                      >
                        <X className="w-3 h-3 mr-1" />
                        Change File
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                      <p className="text-sm font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground">Only PDF files supported</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <FormField
              control={form.control}
              name="pages"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Pages</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter number of pages"
                      type="number"
                      min="1"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="colorType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="B&W">B&W (₹2/page)</SelectItem>
                        <SelectItem value="Color">Color (₹5/page)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="printType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Print Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Single">Single Side</SelectItem>
                        <SelectItem value="Double">Double Side</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="binding"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Binding</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="None">None</SelectItem>
                      <SelectItem value="Spiral">Spiral (₹20)</SelectItem>
                      <SelectItem value="Soft">Soft (₹30)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted p-4">
              <p className="text-sm font-medium text-muted-foreground">Total Price</p>
              <p className="text-2xl font-bold text-foreground">₹{price.toFixed(0)}</p>
            </div>

            {/* Payment Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-sm font-medium">Payment Method</h3>
              <div className={`grid gap-3 ${paymentConfig?.cashEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => { setPaymentMethod('UPI'); setPaymentError('') }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${paymentMethod === 'UPI' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                >
                  <Smartphone className="w-5 h-5 mb-2" />
                  <span className="text-xs font-semibold">UPI</span>
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => { setPaymentMethod('QR'); setPaymentError('') }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${paymentMethod === 'QR' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                >
                  <QrCode className="w-5 h-5 mb-2" />
                  <span className="text-xs font-semibold">QR Code</span>
                </button>
                {paymentConfig?.cashEnabled && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => { setPaymentMethod('CASH'); setPaymentError('') }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${paymentMethod === 'CASH' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    <Banknote className="w-5 h-5 mb-2" />
                    <span className="text-xs font-semibold">Cash</span>
                  </button>
                )}
              </div>

              {paymentMethod === 'UPI' && (
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-4 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Pay via UPI</p>
                      <p className="text-xs text-muted-foreground">UPI ID: {paymentConfig?.upiId || 'shopowner@upi'}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => window.open(`upi://pay?pa=${paymentConfig?.upiId || 'shopowner@upi'}&pn=${encodeURIComponent(paymentConfig?.merchantName || 'NoQueue')}&am=${price}`)}>
                      Pay Now
                    </Button>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block">Transaction ID (Required)</label>
                    <Input placeholder="Enter 12-digit UTR" value={txnId} onChange={e => setTxnId(e.target.value)} disabled={isLoading} />
                  </div>
                </div>
              )}

              {paymentMethod === 'QR' && (
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-4 animate-in fade-in zoom-in-95 text-center">
                  <p className="text-sm font-semibold">Scan to Pay ₹{price}</p>
                  {paymentConfig?.qrImageBase64 ? (
                     <img src={paymentConfig.qrImageBase64} alt="Shop QR Code" className="w-40 h-40 object-contain mx-auto rounded-lg border border-border bg-white p-2 shadow-sm" />
                  ) : (
                     <QrImage data={`upi://pay?pa=${paymentConfig?.upiId || 'shopowner@upi'}&pn=${encodeURIComponent(paymentConfig?.merchantName || 'NoQueue')}&am=${price}`} size={160} />
                  )}
                  <p className="text-xs text-muted-foreground">Scan with Google Pay, PhonePe, Paytm, etc.</p>
                  <div className="text-left pt-2">
                    <label className="text-xs font-medium mb-1.5 block">Transaction ID (Required)</label>
                    <Input placeholder="Enter 12-digit UTR" value={txnId} onChange={e => setTxnId(e.target.value)} disabled={isLoading} />
                  </div>
                </div>
              )}

              {paymentMethod === 'CASH' && (
                <div className="p-4 rounded-xl border border-border bg-muted/30 animate-in fade-in zoom-in-95 flex items-start gap-3">
                  <div className="p-2 rounded-full bg-primary/10 text-primary">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Pay at pickup</p>
                    <p className="text-xs text-muted-foreground">Please keep exactly ₹{price} ready at the counter.</p>
                  </div>
                </div>
              )}

              {paymentError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p className="text-xs">{paymentError}</p>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full h-12 text-base" disabled={isLoading || !isPlaceOrderEnabled}>
              {isLoading ? (
                <>
                  <Spinner className="mr-2" />
                  Processing...
                </>
              ) : !uploadedFile ? (
                'Select a PDF to continue'
              ) : !paymentMethod ? (
                'Select Payment Method'
              ) : (paymentMethod !== 'CASH' && !txnId.trim()) ? (
                'Enter Transaction ID'
              ) : (
                `Place Order • ₹${price}`
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

