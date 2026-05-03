import { AuthState, UserRole, UserType, StudentUser, AdminUser, InstitutionalRole, PriorityLevel } from './types'

const AUTH_STORAGE_KEY = 'noqueue_auth'
const USERS_STORAGE_KEY = 'noqueue_users'

export function getAuthState(): AuthState {
  if (typeof window === 'undefined') {
    return {
      isLoggedIn: false,
      email: null,
      role: null,
      token: null,
    }
  }

  const stored = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!stored) {
    return {
      isLoggedIn: false,
      email: null,
      role: null,
      token: null,
    }
  }

  try {
    return JSON.parse(stored)
  } catch {
    return {
      isLoggedIn: false,
      email: null,
      role: null,
      token: null,
    }
  }
}

export function setAuthState(state: AuthState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state))
}

export function logout(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function isAdmin(email: string): UserRole {
  return email === 'admin@noqueue.com' ? 'admin' : 'user'
}

export function checkAuth(): boolean {
  const auth = getAuthState()
  return auth.isLoggedIn
}

export function getUserEmail(): string | null {
  const auth = getAuthState()
  return auth.email
}

export function getUserRole(): UserRole | null {
  const auth = getAuthState()
  return auth.role
}

// User Management
function getStoredUsers(): (StudentUser | AdminUser)[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(USERS_STORAGE_KEY)
  if (!stored) return []
  try {
    return JSON.parse(stored)
  } catch {
    return []
  }
}

function saveUsers(users: (StudentUser | AdminUser)[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
}

function getPriorityByRole(institutionalRole: InstitutionalRole): PriorityLevel {
  const priorityMap: Record<InstitutionalRole, PriorityLevel> = {
    principal: 1,
    dean: 1,
    vp: 2,
    hod: 2,
    professor: 3,
    student: 3,
  }
  return priorityMap[institutionalRole]
}

export function registerStudentUser(
  email: string,
  password: string,
  name: string,
  rollNumber: string,
  institutionalRole: InstitutionalRole
): StudentUser | null {
  const users = getStoredUsers()

  // Check if user already exists
  if (users.some((u) => u.email === email)) {
    return null
  }

  const newUser: StudentUser = {
    id: `user_${Date.now()}_${Math.random()}`,
    email,
    password, // In real app, would be hashed
    name,
    userType: 'student',
    rollNumber,
    institutionalRole,
    priority: getPriorityByRole(institutionalRole),
    createdAt: new Date(),
  }

  users.push(newUser)
  saveUsers(users)

  return newUser
}

export function registerAdminUser(
  email: string,
  password: string,
  ownerName: string,
  shopName: string,
  phone: string,
  upiId: string
): AdminUser | null {
  const users = getStoredUsers()

  // Check if user already exists
  if (users.some((u) => u.email === email)) {
    return null
  }

  const newUser: AdminUser = {
    id: `admin_${Date.now()}_${Math.random()}`,
    email,
    password, // In real app, would be hashed
    name: ownerName,
    userType: 'admin',
    shopName,
    ownerName,
    phone,
    upiId,
    priority: 2,
    createdAt: new Date(),
  }

  users.push(newUser)
  saveUsers(users)

  return newUser
}

export function findUserByEmail(email: string): StudentUser | AdminUser | null {
  const users = getStoredUsers()
  return users.find((u) => u.email === email) || null
}
