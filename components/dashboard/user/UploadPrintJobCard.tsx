'use client'

import React, { useState, useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { placeOrder, calculatePrice } from '@/services/api'
import { Template } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, X } from 'lucide-react'
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
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

const uploadSchema = z.object({
  pages: z.string().transform(Number).pipe(z.number().min(1, 'Pages must be at least 1')),
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

export function UploadPrintJobCard({ userEmail, onOrderPlaced, selectedTemplate }: UploadPrintJobCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [price, setPrice] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      pages: '',
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
    form.setValue('pages', String(template.pages))
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

    setIsLoading(true)
    try {
      // Create a temporary URL for the uploaded file
      const fileUrl = URL.createObjectURL(uploadedFile)

      await placeOrder({
        userName: userEmail.split('@')[0],
        userEmail: userEmail,
        fileName: uploadedFile.name,
        fileUrl: fileUrl,
        pages: Number(values.pages),
        colorType: values.colorType,
        printType: values.printType,
        binding: values.binding,
        price: price,
        status: 'PAID',
      })

      toast.success('Order placed successfully!')
      form.reset()
      setUploadedFile(null)
      setPrice(0)
      onOrderPlaced?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to place order'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
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

            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-sm text-muted-foreground">Total Price</p>
              <p className="text-3xl font-bold text-foreground">₹{price.toFixed(0)}</p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || !uploadedFile}>
              {isLoading ? (
                <>
                  <Spinner className="mr-2" />
                  Placing Order...
                </>
              ) : !uploadedFile ? (
                'Select a PDF to continue'
              ) : (
                'Place Order'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
