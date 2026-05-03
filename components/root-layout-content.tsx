'use client'

import { useEffect } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { seedMockData } from '@/services/api'

export function RootLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    // Initialize mock data on first load
    seedMockData()
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
      <Toaster />
    </ThemeProvider>
  )
}
