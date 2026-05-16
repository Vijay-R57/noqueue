// Order Status
export type OrderStatus = 'PAYMENT_PENDING' | 'CASH_PENDING' | 'WAITING' | 'PAID' | 'READY_TO_PRINT' | 'PRINTING' | 'COMPLETED' | 'FAILED'

// Payment Method
export type PaymentMethod = 'UPI' | 'QR' | 'CASH'

// Payment Status
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED'

// Color Type
export type ColorType = 'B&W' | 'Color'

// Print Type
export type PrintType = 'Single' | 'Double'

// Binding Type
export type BindingType = 'None' | 'Spiral' | 'Soft'

// Template Type
export type TemplateType = 'config' | 'file'

// User Role
export type UserRole = 'admin' | 'user'

// User Type
export type UserType = 'student' | 'admin'

// Institutional Role (for students)
export type InstitutionalRole = 'student' | 'professor' | 'hod' | 'vp' | 'principal' | 'dean'

// Priority Level (auto-assigned based on role)
export type PriorityLevel = 1 | 2 | 3

// User Profile
export interface User {
  id: string
  email: string
  password: string // hashed in real app
  name: string
  userType: UserType
  createdAt: Date
}

// Student User
export interface StudentUser extends User {
  userType: 'student'
  rollNumber: string
  institutionalRole: InstitutionalRole
  priority: PriorityLevel
}

// Admin User (Xerox Owner)
export interface AdminUser extends User {
  userType: 'admin'
  shopName: string
  ownerName: string
  phone: string
  upiId: string
  priority: PriorityLevel
}

// Auth State
export interface AuthState {
  isLoggedIn: boolean
  email: string | null
  role: UserRole | null
  userType?: UserType
  token: string | null
}

// Order
export interface Order {
  id: string
  userName: string
  userEmail: string
  fileName: string
  fileUrl: string
  pages: number
  colorType: ColorType
  printType: PrintType
  binding: BindingType
  price: number
  status: OrderStatus
  tokenNumber: number
  createdAt: Date
  // Payment fields
  paymentMethod?: PaymentMethod
  paymentStatus?: PaymentStatus
  transactionId?: string
  amountPaid?: number
}

// API Response Types
export interface LoginResponse {
  user: {
    email: string
  }
  token: string
  role: UserRole
}

export interface StatsResponse {
  ordersInQueue: number
  ordersCompleted: number
  totalRevenue: number
}

// Pricing Config
export interface PricingConfig {
  bwRate: number // per page
  colorRate: number // per page
  spiralCost: number
  softCost: number
}

// Template for quick print presets or ready documents
export interface Template {
  id: string
  name: string
  icon: string // lucide icon name
  description: string
  type: TemplateType // 'config' for print settings, 'file' for ready documents
  pages: number
  colorType: ColorType
  printType: PrintType
  binding: BindingType
  fileName?: string // for file templates only
  fileUrl?: string // for file templates only
  createdAt: Date
}

// Payment Configuration
export interface PaymentConfig {
  upiId: string
  merchantName: string
  cashEnabled: boolean
  qrImageBase64: string | null
}
