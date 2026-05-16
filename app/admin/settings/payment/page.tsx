'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthState } from '@/lib/auth'
import { getPaymentConfig, updatePaymentConfig } from '@/services/api'
import { PaymentConfig } from '@/lib/types'
import { 
  ArrowLeft, CreditCard, Save, Upload, X, QrCode, 
  Smartphone, Banknote, AlertCircle, CheckCircle2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

export default function PaymentSettingsPage() {
  const router = useRouter()
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  
  const [config, setConfig] = useState<PaymentConfig>({
    upiId: '',
    merchantName: '',
    cashEnabled: true,
    qrImageBase64: null,
  })

  // Auth guard and initial load
  useEffect(() => {
    const auth = getAuthState()
    if (!auth.isLoggedIn || auth.role !== 'admin') {
      router.push('/login')
      return
    }

    const loadConfig = async () => {
      try {
        const data = await getPaymentConfig()
        setConfig(data)
      } catch (error) {
        toast.error('Failed to load payment settings')
      } finally {
        setIsLoading(false)
      }
    }
    loadConfig()
  }, [router])

  // Handlers
  const handleSave = async () => {
    if (!config.upiId.trim()) {
      toast.error('UPI ID is required')
      return
    }
    if (!config.merchantName.trim()) {
      toast.error('Merchant Name is required')
      return
    }

    setIsSaving(true)
    try {
      const updated = await updatePaymentConfig(config)
      setConfig(updated)
      toast.success('Payment settings saved successfully')
    } catch (error) {
      toast.error('Failed to save payment settings')
    } finally {
      setIsSaving(false)
    }
  }

  // File Upload Handlers
  const processImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      setConfig((prev: PaymentConfig) => ({ ...prev, qrImageBase64: base64 }))
    }
    reader.readAsDataURL(file)
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
      processImage(e.dataTransfer.files[0])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImage(e.target.files[0])
    }
  }

  const removeQrCode = () => {
    setConfig((prev: PaymentConfig) => ({ ...prev, qrImageBase64: null }))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Spinner className="h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    )
  }

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
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Payment Settings</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        
        {/* ── 1. UPI CONFIGURATION ──────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Smartphone className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">UPI Configuration</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Merchant Name</label>
              <Input 
                placeholder="e.g. NoQueue Print Shop" 
                value={config.merchantName}
                onChange={(e) => setConfig({ ...config, merchantName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Displayed to users during checkout</p>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium">UPI ID</label>
              <Input 
                placeholder="e.g. shopowner@upi" 
                value={config.upiId}
                onChange={(e) => setConfig({ ...config, upiId: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Used to generate dynamic QR codes & deep links</p>
            </div>
          </div>
        </div>

        {/* ── 2. QR CODE UPLOAD ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Custom QR Code (Optional)</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you prefer to show your official static shop QR code instead of generating one dynamically, upload it here.
              </p>
              
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleInputChange}
                  className="hidden"
                  id="qr-upload"
                />
                <label htmlFor="qr-upload" className="cursor-pointer block">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to upload or drag & drop</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-center border rounded-lg bg-muted/20 p-4">
              {config.qrImageBase64 ? (
                <div className="relative text-center space-y-3">
                  <div className="relative inline-block border bg-white p-2 rounded-xl shadow-sm">
                    <img 
                      src={config.qrImageBase64} 
                      alt="Uploaded QR Code" 
                      className="w-32 h-32 object-contain"
                    />
                    <button 
                      onClick={removeQrCode}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md hover:scale-105 transition-transform"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs font-medium text-emerald-600 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Custom QR active
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-2 text-muted-foreground">
                  <QrCode className="w-12 h-12 mx-auto opacity-20" />
                  <p className="text-sm">No custom QR uploaded</p>
                  <p className="text-xs">Dynamic QR will be generated using UPI ID</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 3. CASH SETTINGS ──────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Banknote className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Cash Settings</h2>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Enable "Cash on Receive"</p>
              <p className="text-xs text-muted-foreground max-w-[80%]">
                Allow users to place orders without immediate digital payment. You must manually confirm cash receipt in the dashboard to start printing.
              </p>
            </div>
            <Switch 
              checked={config.cashEnabled} 
              onCheckedChange={(c) => setConfig({ ...config, cashEnabled: c })} 
            />
          </div>
        </div>

        {/* ── 4. SAVE BUTTON ────────────────────────────────────────────── */}
        <div className="flex justify-end pt-2">
          <Button 
            size="lg" 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full sm:w-auto px-8"
          >
            {isSaving ? (
              <><Spinner className="mr-2" /> Saving...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Save Configuration</>
            )}
          </Button>
        </div>

      </div>
    </div>
  )
}
