'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthState } from '@/lib/auth'
import { SignupForm } from '@/components/auth/SignupForm'

export default function SignupPage() {
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <SignupForm />
    </div>
  )
}
