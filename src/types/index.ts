export type ShiftId = 'morning' | 'evening'
export type Department = 'kitchen' | 'service'

export interface Shift {
  id: ShiftId
  label: string
  startTime: string
  endTime: string
}

export type TaskGroupShift = 'morning' | 'evening' | 'both'
export type TaskGroupFrequency = 'daily' | 'weekly'
export type TaskGroupDepartment = 'kitchen' | 'service' | 'all'

export interface TaskGroup {
  id: string
  title: string
  time: string
  icon: string
  color: string
  shift: TaskGroupShift
  frequency: TaskGroupFrequency
  department: TaskGroupDepartment
  tasks: Task[]
}

export interface Task {
  id: string
  title: string
  est: number        // minutes
  items: string[]
  requiresPhoto?: boolean
  groupId?: string
  groupTitle?: string
  groupColor?: string
  groupIcon?: string
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface Submission {
  id: string
  taskId: string
  taskTitle: string
  staffName: string
  staffAvatar: string
  branch: string
  shift: ShiftId
  submittedAt: Date
  checkedItems: number[]
  photos: string[]
  notes: string
  rating: number
  status: SubmissionStatus
  supervisorComment?: string
  flag?: boolean
  groupTitle?: string
  groupColor?: string
}

export type UserRole = 'staff' | 'supervisor' | 'owner'

export const FEATURES = [
  'home', 'tasks', 'dashboard', 'review', 'schedule', 'maintenance', 'loans',
  'tasks-admin', 'assets', 'branches', 'staff',
  'google-review', 'history', 'settings',
] as const

export type FeatureKey = typeof FEATURES[number]

export interface User {
  id: string
  name: string
  role: UserRole
  branch: string
  avatar: string
  username: string
  telegramId?: string
  defaultShift?: ShiftId
  department?: Department
}

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'late'

export interface TaskState {
  taskId: string
  status: TaskStatus
  checkedItems: number[]
  photos: string[]
  notes: string
  rating: number
}

export type Lang = 'bm' | 'en'

export interface Branch {
  id: string
  name: string
  address?: string
  phone?: string
  status: 'active' | 'inactive'
}

export type MaintenanceCategory = 'equipment' | 'facility' | 'electrical' | 'plumbing' | 'other'
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical'
export type MaintenanceStatus   = 'open' | 'in_progress' | 'resolved'

export interface MaintenanceReport {
  id: string
  title: string
  category: MaintenanceCategory
  description: string
  priority: MaintenancePriority
  status: MaintenanceStatus
  reportedById: string
  reportedByName: string
  reportedByAvatar: string
  branch: string
  reportedAt: Date
  resolvedAt?: Date
  supervisorNotes?: string
  photos: string[]
}

export type LoanStatus = 'pending' | 'approved' | 'rejected' | 'returned'

export interface LoanRequest {
  id: string
  itemName: string
  quantity: number
  fromBranch: string
  toBranch: string
  reason: string
  status: LoanStatus
  requestedById: string
  requestedByName: string
  requestedByAvatar: string
  approvedByName?: string
  dueDate?: string        // ISO date string YYYY-MM-DD
  notes?: string
  requestedAt: Date
  approvedAt?: Date
  returnedAt?: Date
}

export type AssetCondition = 'good' | 'fair' | 'poor'

export interface Asset {
  id: string
  name: string
  category: string
  quantity: number
  condition: AssetCondition
  branch: string
  notes?: string
  lastChecked?: string  // ISO date string
}
