'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { registerStudentUser, registerAdminUser, setAuthState } from '@/lib/auth'
import { InstitutionalRole } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'

const studentSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Z]/, 'Must contain uppercase').regex(/[0-9]/, 'Must contain number'),
  name: z.string().min(2, 'Name is required'),
  rollNumber: z.string().min(1, 'Roll number is required'),
  institutionalRole: z.enum(['student', 'professor', 'hod', 'vp', 'principal', 'dean']),
})

const adminSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Z]/, 'Must contain uppercase').regex(/[0-9]/, 'Must contain number'),
  ownerName: z.string().min(2, 'Owner name is required'),
  shopName: z.string().min(2, 'Shop name is required'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone must be 10 digits'),
  upiId: z.string().regex(/^[\w\.\-]+@[\w]+$/, 'Invalid UPI format (e.g., username@upi)'),
})

type StudentFormValues = z.infer<typeof studentSchema>
type AdminFormValues = z.infer<typeof adminSchema>

export function SignupForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [userType, setUserType] = useState<'student' | 'admin'>('student')

  const studentForm = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
      rollNumber: '',
      institutionalRole: 'student',
    },
  })

  const adminForm = useForm<AdminFormValues>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      email: '',
      password: '',
      ownerName: '',
      shopName: '',
      phone: '',
      upiId: '',
    },
  })

  async function onStudentSubmit(values: StudentFormValues) {
    setIsLoading(true)
    try {
      const user = registerStudentUser(
        values.email,
        values.password,
        values.name,
        values.rollNumber,
        values.institutionalRole as InstitutionalRole
      )

      if (!user) {
        toast.error('Email already registered')
        setIsLoading(false)
        return
      }

      setAuthState({
        isLoggedIn: true,
        email: user.email,
        role: 'user',
        userType: 'student',
        token: `token_${user.id}`,
      })

      toast.success(`Welcome, ${user.name}!`)
      router.push('/user/dashboard')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signup failed'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  async function onAdminSubmit(values: AdminFormValues) {
    setIsLoading(true)
    try {
      const user = registerAdminUser(
        values.email,
        values.password,
        values.ownerName,
        values.shopName,
        values.phone,
        values.upiId
      )

      if (!user) {
        toast.error('Email already registered')
        setIsLoading(false)
        return
      }

      setAuthState({
        isLoggedIn: true,
        email: user.email,
        role: 'admin',
        userType: 'admin',
        token: `token_${user.id}`,
      })

      toast.success(`Welcome to NoQueue, ${user.shopName}!`)
      router.push('/admin/dashboard')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signup failed'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>NoQueue - Smart Queue-based Printing System</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Role Selector */}
        <div className="mb-6 flex gap-2">
          <Button
            type="button"
            variant={userType === 'student' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => {
              setUserType('student')
              adminForm.reset()
            }}
            disabled={isLoading}
          >
            Student
          </Button>
          <Button
            type="button"
            variant={userType === 'admin' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => {
              setUserType('admin')
              studentForm.reset()
            }}
            disabled={isLoading}
          >
            Xerox Owner
          </Button>
        </div>

        {/* Student Form */}
        {userType === 'student' && (
          <Form {...studentForm}>
            <form onSubmit={studentForm.handleSubmit(onStudentSubmit)} className="space-y-4">
              <FormField
                control={studentForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="student@college.edu" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={studentForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={studentForm.control}
                name="rollNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Roll Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2024001" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={studentForm.control}
                name="institutionalRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="professor">Professor</SelectItem>
                        <SelectItem value="hod">HOD</SelectItem>
                        <SelectItem value="vp">Vice Principal</SelectItem>
                        <SelectItem value="principal">Principal</SelectItem>
                        <SelectItem value="dean">Dean</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={studentForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Spinner className="mr-2" />
                    Creating Account...
                  </>
                ) : (
                  'Sign Up'
                )}
              </Button>
            </form>
          </Form>
        )}

        {/* Admin Form */}
        {userType === 'admin' && (
          <Form {...adminForm}>
            <form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="space-y-4">
              <FormField
                control={adminForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="owner@xerox.com" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={adminForm.control}
                name="ownerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={adminForm.control}
                name="shopName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shop Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Quick Print Xerox" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={adminForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="9876543210" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={adminForm.control}
                name="upiId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UPI ID</FormLabel>
                    <FormControl>
                      <Input placeholder="username@upi" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={adminForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Spinner className="mr-2" />
                    Creating Account...
                  </>
                ) : (
                  'Sign Up'
                )}
              </Button>
            </form>
          </Form>
        )}

        <div className="mt-4 text-center text-sm">
          <p className="text-muted-foreground">
            Already have an account?{' '}
            <a href="/login" className="text-primary hover:underline">
              Login
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
