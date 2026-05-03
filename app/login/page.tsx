'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthState } from '@/lib/auth'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    const auth = getAuthState()
    if (auth.isLoggedIn) {
      // Redirect if already logged in
      if (auth.role === 'admin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/user/dashboard')
      }
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <LoginForm />
    </div>
  )
}
