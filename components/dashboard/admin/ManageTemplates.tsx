'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Template, ColorType, PrintType, BindingType, TemplateType } from '@/lib/types'
import { getTemplates, createTemplate, deleteTemplate } from '@/services/api'
import { Trash2, Plus, Loader2, File, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

const ICON_OPTIONS = [
  { value: 'FileText', label: 'Document' },
  { value: 'BookOpen', label: 'Book' },
  { value: 'Palette', label: 'Palette' },
  { value: 'BookMarked', label: 'Marked Book' },
  { value: 'Image', label: 'Image' },
]

export function ManageTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    icon: 'FileText',
    description: '',
    type: 'config' as TemplateType,
    pages: '10',
    colorType: 'B&W' as ColorType,
    printType: 'Single' as PrintType,
    binding: 'None' as BindingType,
    fileName: '',
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const data = await getTemplates()
      setTemplates(data)
    } catch (error) {
      console.error('[v0] Error loading templates:', error)
      toast.error('Failed to load templates')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddTemplate = async () => {
    if (!formData.name.trim()) {
      toast.error('Template name is required')
      return
    }

    if (formData.type === 'file' && !selectedFile) {
      toast.error('Please upload a PDF file for ready documents')
      return
    }

    setIsSubmitting(true)
    try {
      const templateData: any = {
        name: formData.name,
        icon: formData.icon,
        description: formData.description,
        type: formData.type,
        pages: parseInt(formData.pages),
        colorType: formData.colorType,
        printType: formData.printType,
        binding: formData.binding,
      }

      // Add file-specific fields if this is a file template
      if (formData.type === 'file' && selectedFile) {
        templateData.fileName = selectedFile.name
        // Create a mock file URL (in real app, would upload to cloud storage)
        templateData.fileUrl = `/mock-files/${Date.now()}/${selectedFile.name}`
      }

      const newTemplate = await createTemplate(templateData)

      setTemplates([...templates, newTemplate])
      toast.success('Template created successfully')
      setIsOpen(false)
      setSelectedFile(null)
      setFormData({
        name: '',
        icon: 'FileText',
        description: '',
        type: 'config',
        pages: '10',
        colorType: 'B&W',
        printType: 'Single',
        binding: 'None',
        fileName: '',
      })
    } catch (error) {
      console.error('[v0] Error creating template:', error)
      toast.error('Failed to create template')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteTemplate(id)
      setTemplates(templates.filter((t) => t.id !== id))
      toast.success('Template deleted')
    } catch (error) {
      console.error('[v0] Error deleting template:', error)
      toast.error('Failed to delete template')
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Manage Templates</CardTitle>
          <CardDescription>Create and manage quick print templates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Manage Templates</CardTitle>
            <CardDescription>Create and manage quick print templates</CardDescription>
          </div>
          <Button onClick={() => setIsOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates yet. Create one to get started.</p>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{template.name}</h3>
                      <Badge 
                        variant={template.type === 'file' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {template.type === 'file' ? 'Ready Document' : 'Print Config'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                    {template.type === 'file' && template.fileName && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <File className="w-3 h-3" />
                        {template.fileName}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs bg-secondary px-2 py-1 rounded">{template.pages} pages</span>
                      <span className="text-xs bg-secondary px-2 py-1 rounded">{template.colorType}</span>
                      <span className="text-xs bg-secondary px-2 py-1 rounded">{template.binding}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>Add a new quick print template</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Template Type</label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as TemplateType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="config">Print Configuration</SelectItem>
                  <SelectItem value="file">Ready Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Template Name</label>
              <Input
                placeholder="e.g., Business Report"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Input
                placeholder="Brief description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {formData.type === 'file' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Upload PDF</label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (file.type !== 'application/pdf') {
                          toast.error('Only PDF files are supported')
                          return
                        }
                        setSelectedFile(file)
                      }
                    }}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label htmlFor="pdf-upload" className="cursor-pointer block">
                    {selectedFile ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-emerald-600 flex items-center justify-center gap-2">
                          ✓ {selectedFile.name}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            setSelectedFile(null)
                            const input = document.getElementById('pdf-upload') as HTMLInputElement
                            if (input) input.value = ''
                          }}
                        >
                          Change File
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground">Only PDF files supported</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Icon</label>
              <Select value={formData.icon} onValueChange={(value) => setFormData({ ...formData, icon: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((icon) => (
                    <SelectItem key={icon.value} value={icon.value}>
                      {icon.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Pages</label>
                <Input
                  type="number"
                  min="1"
                  value={formData.pages}
                  onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Color</label>
                <Select
                  value={formData.colorType}
                  onValueChange={(value) => setFormData({ ...formData, colorType: value as ColorType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B&W">B&W</SelectItem>
                    <SelectItem value="Color">Color</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Print Type</label>
                <Select
                  value={formData.printType}
                  onValueChange={(value) => setFormData({ ...formData, printType: value as PrintType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Double">Double</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Binding</label>
                <Select
                  value={formData.binding}
                  onValueChange={(value) => setFormData({ ...formData, binding: value as BindingType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Spiral">Spiral</SelectItem>
                    <SelectItem value="Soft">Soft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-6">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTemplate} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
