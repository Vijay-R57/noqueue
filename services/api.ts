import { Order, LoginResponse, StatsResponse, OrderStatus, PricingConfig, Template, ColorType, PrintType, BindingType, TemplateType } from '@/lib/types'
import { isAdmin, findUserByEmail } from '@/lib/auth'

// Storage Keys
const ORDERS_STORAGE_KEY = 'noqueue_orders'
const TEMPLATES_STORAGE_KEY = 'noqueue_templates'

// Pricing Configuration
export const PRICING: PricingConfig = {
  bwRate: 2, // ₹2 per page
  colorRate: 5, // ₹5 per page
  spiralCost: 20,
  softCost: 30,
}

// Mock users database
const USERS_DB = [
  { email: 'admin@noqueue.com', password: 'admin123' },
  { email: 'user@noqueue.com', password: 'user123' },
]

// Initialize mock data
function getStoredOrders(): Order[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(ORDERS_STORAGE_KEY)
  if (!stored) return []
  try {
    return JSON.parse(stored)
  } catch {
    return []
  }
}

function saveOrders(orders: Order[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders))
}

let tokenCounter = 100

function getNextTokenNumber(): number {
  tokenCounter++
  return tokenCounter
}

// ===== Authentication =====
export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // First check registered users (from signup)
  const registeredUser = findUserByEmail(email)
  if (registeredUser && registeredUser.password === password) {
    const role = registeredUser.userType === 'admin' ? 'admin' : 'user'
    const token = `token_${Date.now()}_${Math.random()}`

    return {
      user: { email: registeredUser.email },
      token,
      role,
    }
  }

  // Then check demo users
  const user = USERS_DB.find((u) => u.email === email)
  if (!user || user.password !== password) {
    throw new Error('Invalid email or password')
  }

  const role = isAdmin(email)
  const token = `token_${Date.now()}_${Math.random()}`

  return {
    user: { email },
    token,
    role,
  }
}

// ===== Orders =====
export async function getOrders(userEmail?: string): Promise<Order[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  const allOrders = getStoredOrders()

  if (userEmail) {
    return allOrders.filter((o) => o.userEmail === userEmail)
  }

  return allOrders
}

export async function placeOrder(
  orderData: Omit<Order, 'id' | 'tokenNumber' | 'createdAt'>
): Promise<Order> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  const newOrder: Order = {
    ...orderData,
    id: `order_${Date.now()}_${Math.random()}`,
    tokenNumber: getNextTokenNumber(),
    createdAt: new Date(),
    status: 'PAID', // Auto-mark as paid on creation
  }

  const orders = getStoredOrders()
  orders.push(newOrder)
  saveOrders(orders)

  return newOrder
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  const orders = getStoredOrders()
  const order = orders.find((o) => o.id === orderId)

  if (!order) {
    throw new Error('Order not found')
  }

  order.status = status
  saveOrders(orders)

  return order
}

export async function getStats(): Promise<StatsResponse> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  const orders = getStoredOrders()

  const ordersInQueue = orders.filter(
    (o) => o.status === 'WAITING' || o.status === 'PAID' || o.status === 'READY_TO_PRINT'
  ).length

  const ordersCompleted = orders.filter((o) => o.status === 'COMPLETED').length

  const totalRevenue = orders
    .filter((o) => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + o.price, 0)

  return {
    ordersInQueue,
    ordersCompleted,
    totalRevenue,
  }
}

export async function getLivePrinting(): Promise<Order | null> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  const orders = getStoredOrders()
  const printing = orders.find((o) => o.status === 'PRINTING')

  return printing || null
}

// ===== Templates =====
function getStoredTemplates(): Template[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY)
  if (!stored) return []
  try {
    return JSON.parse(stored)
  } catch {
    return []
  }
}

function saveTemplates(templates: Template[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates))
}

export async function getTemplates(): Promise<Template[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200))
  return getStoredTemplates()
}

export async function createTemplate(
  template: Omit<Template, 'id' | 'createdAt'>
): Promise<Template> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  const newTemplate: Template = {
    ...template,
    id: `template_${Date.now()}_${Math.random()}`,
    createdAt: new Date(),
  }

  const templates = getStoredTemplates()
  templates.push(newTemplate)
  saveTemplates(templates)

  return newTemplate
}

export async function updateTemplate(id: string, updates: Partial<Omit<Template, 'id' | 'createdAt'>>): Promise<Template> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  const templates = getStoredTemplates()
  const template = templates.find((t) => t.id === id)

  if (!template) {
    throw new Error('Template not found')
  }

  Object.assign(template, updates)
  saveTemplates(templates)

  return template
}

export async function deleteTemplate(id: string): Promise<void> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  const templates = getStoredTemplates()
  const filtered = templates.filter((t) => t.id !== id)
  saveTemplates(filtered)
}

// ===== Pricing Calculation =====
export function calculatePrice(pages: number, colorType: string, binding: string): number {
  const pageRate = colorType === 'B&W' ? PRICING.bwRate : PRICING.colorRate
  let price = pages * pageRate

  if (binding === 'Spiral') {
    price += PRICING.spiralCost
  } else if (binding === 'Soft') {
    price += PRICING.softCost
  }

  return price
}

// ===== Seed Mock Data (call once on app init) =====
export function seedMockData(): void {
  if (typeof window === 'undefined') return

  const existing = getStoredOrders()
  if (existing.length > 0) return // Don't reseed if data exists

  const mockOrders: Order[] = [
    {
      id: 'order_1',
      userName: 'John Doe',
      userEmail: 'user@noqueue.com',
      fileName: 'project_report.pdf',
      fileUrl: '/mock/project_report.pdf',
      pages: 10,
      colorType: 'B&W',
      printType: 'Double',
      binding: 'Spiral',
      price: 40,
      status: 'COMPLETED',
      tokenNumber: 101,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'order_2',
      userName: 'Jane Smith',
      userEmail: 'user@noqueue.com',
      fileName: 'presentation.pdf',
      fileUrl: '/mock/presentation.pdf',
      pages: 20,
      colorType: 'Color',
      printType: 'Single',
      binding: 'Soft',
      price: 130,
      status: 'PRINTING',
      tokenNumber: 102,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      id: 'order_3',
      userName: 'John Doe',
      userEmail: 'user@noqueue.com',
      fileName: 'thesis.pdf',
      fileUrl: '/mock/thesis.pdf',
      pages: 50,
      colorType: 'B&W',
      printType: 'Double',
      binding: 'Spiral',
      price: 120,
      status: 'READY_TO_PRINT',
      tokenNumber: 103,
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      id: 'order_4',
      userName: 'Alice Johnson',
      userEmail: 'user@noqueue.com',
      fileName: 'brochure.pdf',
      fileUrl: '/mock/brochure.pdf',
      pages: 8,
      colorType: 'Color',
      printType: 'Single',
      binding: 'None',
      price: 40,
      status: 'PAID',
      tokenNumber: 104,
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    },
    {
      id: 'order_5',
      userName: 'Bob Wilson',
      userEmail: 'user@noqueue.com',
      fileName: 'manual.pdf',
      fileUrl: '/mock/manual.pdf',
      pages: 15,
      colorType: 'B&W',
      printType: 'Single',
      binding: 'None',
      price: 30,
      status: 'WAITING',
      tokenNumber: 105,
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
    },
  ]

  saveOrders(mockOrders)
  tokenCounter = 105

  // Seed templates if they don't exist
  const existingTemplates = getStoredTemplates()
  if (existingTemplates.length === 0) {
    const mockTemplates: Template[] = [
      {
        id: 'template_1',
        name: 'Quick B&W Single',
        icon: 'FileText',
        description: 'Black & white, single-sided',
        type: 'config',
        pages: 5,
        colorType: 'B&W',
        printType: 'Single',
        binding: 'None',
        createdAt: new Date(),
      },
      {
        id: 'template_2',
        name: 'Report with Binding',
        icon: 'BookOpen',
        description: 'B&W double-sided with spiral binding',
        type: 'config',
        pages: 20,
        colorType: 'B&W',
        printType: 'Double',
        binding: 'Spiral',
        createdAt: new Date(),
      },
      {
        id: 'template_3',
        name: 'Colorful Brochure',
        icon: 'Palette',
        description: 'Color, single-sided presentation',
        type: 'config',
        pages: 4,
        colorType: 'Color',
        printType: 'Single',
        binding: 'Soft',
        createdAt: new Date(),
      },
      {
        id: 'template_4',
        name: 'Thesis/Book',
        icon: 'BookMarked',
        description: 'Professional B&W double-sided binding',
        type: 'config',
        pages: 100,
        colorType: 'B&W',
        printType: 'Double',
        binding: 'Spiral',
        createdAt: new Date(),
      },
      {
        id: 'template_5',
        name: 'Color Magazine',
        icon: 'Image',
        description: 'Full color, professional binding',
        type: 'config',
        pages: 15,
        colorType: 'Color',
        printType: 'Single',
        binding: 'Soft',
        createdAt: new Date(),
      },
      {
        id: 'template_file_1',
        name: 'Company Logo PDF',
        icon: 'File',
        description: 'Ready: Color, single-sided',
        type: 'file',
        pages: 1,
        colorType: 'Color',
        printType: 'Single',
        binding: 'None',
        fileName: 'company-logo.pdf',
        fileUrl: '/mock-files/template_file_1/company-logo.pdf',
        createdAt: new Date(),
      },
      {
        id: 'template_file_2',
        name: 'Employee Handbook',
        icon: 'BookOpen',
        description: 'Ready: B&W double-sided, spiral bound',
        type: 'file',
        pages: 48,
        colorType: 'B&W',
        printType: 'Double',
        binding: 'Spiral',
        fileName: 'handbook-2024.pdf',
        fileUrl: '/mock-files/template_file_2/handbook-2024.pdf',
        createdAt: new Date(),
      },
      {
        id: 'template_file_3',
        name: 'Marketing Brochure',
        icon: 'Palette',
        description: 'Ready: Full color, soft binding',
        type: 'file',
        pages: 8,
        colorType: 'Color',
        printType: 'Single',
        binding: 'Soft',
        fileName: 'brochure-spring.pdf',
        fileUrl: '/mock-files/template_file_3/brochure-spring.pdf',
        createdAt: new Date(),
      },
    ]

    saveTemplates(mockTemplates)
  }
}
