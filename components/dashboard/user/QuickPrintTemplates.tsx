'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Template } from '@/lib/types'
import { getTemplates } from '@/services/api'
import {
  FileText,
  BookOpen,
  Palette,
  BookMarked,
  Image,
  Zap,
} from 'lucide-react'

// Icon map
const ICON_MAP: Record<string, React.ReactNode> = {
  FileText: <FileText className="w-6 h-6" />,
  BookOpen: <BookOpen className="w-6 h-6" />,
  Palette: <Palette className="w-6 h-6" />,
  BookMarked: <BookMarked className="w-6 h-6" />,
  Image: <Image className="w-6 h-6" />,
}

interface QuickPrintTemplatesProps {
  onSelectTemplate: (template: Template) => void
}

export function QuickPrintTemplates({ onSelectTemplate }: QuickPrintTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const data = await getTemplates()
        setTemplates(data)
      } catch (error) {
        console.error('[v0] Error loading templates:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTemplates()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Quick Print Templates
          </CardTitle>
          <CardDescription>Fast presets for common print jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Quick Print Templates
          </CardTitle>
          <CardDescription>No templates available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Create your first template to get started.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          Quick Print Templates
        </CardTitle>
        <CardDescription>Select a template to prefill your print settings</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template)}
              className="flex flex-col gap-3 p-4 border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div className="text-primary/60">{ICON_MAP[template.icon] || <FileText className="w-6 h-6" />}</div>
              </div>
              <div>
                <h3 className="font-medium text-sm leading-tight">{template.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>{template.pages} pages</div>
                <div className="flex gap-1">
                  <span className="px-2 py-1 bg-secondary rounded text-xs">{template.colorType}</span>
                  {template.binding !== 'None' && (
                    <span className="px-2 py-1 bg-secondary rounded text-xs">{template.binding}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
