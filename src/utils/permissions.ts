import type { FeatureKey, User, UserRole } from '../types'

export const DEFAULT_FEATURES: Record<UserRole, FeatureKey[]> = {
  staff: ['home', 'tasks', 'google-review', 'history', 'settings'],
  supervisor: [
    'dashboard', 'review', 'maintenance', 'loans',
    'assets', 'google-review', 'history', 'settings',
  ],
  owner: [
    'dashboard', 'review', 'schedule', 'maintenance', 'loans',
    'tasks-admin', 'assets', 'branches', 'staff',
    'google-review', 'history', 'settings',
  ],
}

export function hasFeature(user: User | null, key: FeatureKey): boolean {
  if (!user) return false
  return (DEFAULT_FEATURES[user.role] ?? DEFAULT_FEATURES.staff).includes(key)
}
