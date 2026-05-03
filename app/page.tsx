'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthState } from '@/lib/auth'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const auth = getAuthState()
    if (auth.isLoggedIn && auth.role) {
      // Redirect to appropriate dashboard
      if (auth.role === 'admin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/user/dashboard')
      }
    } else {
      // Redirect to login
      router.push('/login')
    }
  }, [router])

  return null
}
