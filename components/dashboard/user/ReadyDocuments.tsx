'use client'

import { useEffect, useState } from 'react'
import { getTemplates } from '@/services/api'
import { Template } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { File, FileText, Download } from 'lucide-react'

interface ReadyDocumentsProps {
  onSelectDocument?: (template: Template) => void
}

export function ReadyDocuments({ onSelectDocument }: ReadyDocumentsProps) {
  const [documents, setDocuments] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadDocuments = async () => {
      setIsLoading(true)
      try {
        const allTemplates = await getTemplates()
        // Filter only file-based templates
        const fileTemplates = allTemplates.filter((t) => t.type === 'file')
        setDocuments(fileTemplates)
      } catch (error) {
        console.error('Failed to load documents:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDocuments()
  }, [])

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Ready Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </Card>
    )
  }

  if (documents.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Ready Documents</h3>
        <p className="text-muted-foreground">No ready documents available yet.</p>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Ready Documents</h3>
        <Badge variant="secondary">Use Anytime</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <Card key={doc.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-4 space-y-3">
              {/* Icon and Badge */}
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <File className="w-5 h-5 text-blue-600" />
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 text-xs">Ready</Badge>
              </div>

              {/* Document Info */}
              <div>
                <h4 className="font-semibold text-sm">{doc.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">{doc.fileName}</p>
              </div>

              {/* Specs */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="w-3 h-3" />
                  <span>{doc.pages} pages</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">
                    {doc.colorType}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {doc.printType}-sided
                  </Badge>
                  {doc.binding !== 'None' && (
                    <Badge variant="outline" className="text-xs">
                      {doc.binding}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <Button
                onClick={() => onSelectDocument?.(doc)}
                className="w-full mt-2"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Use This Document
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  )
}
