import type { CustomRole, FeatureKey, User, UserRole } from '../types'

export const DEFAULT_FEATURES: Record<UserRole, FeatureKey[]> = {
  staff: ['home', 'tasks', 'google-review', 'history', 'settings'],
  supervisor: [
    'dashboard', 'review', 'schedule', 'maintenance', 'loans',
    'tasks-admin', 'assets', 'google-review', 'history', 'settings',
  ],
  owner: [
    'dashboard', 'review', 'schedule', 'maintenance', 'loans',
    'tasks-admin', 'assets', 'branches', 'staff', 'roles',
    'google-review', 'history', 'settings',
  ],
}

// Features shown as checkboxes in RolesPage — excludes always-on and owner-only
export const CONFIGURABLE_FEATURES: FeatureKey[] = [
  'home', 'tasks', 'google-review', 'history',
  'dashboard', 'review', 'schedule', 'maintenance',
  'loans', 'tasks-admin', 'assets',
]

export function resolveFeatures(
  user: Pick<User, 'role' | 'customRoleId'>,
  customRole?: CustomRole
): FeatureKey[] {
  if (user.role === 'owner') return DEFAULT_FEATURES.owner
  if (customRole && customRole.id === user.customRoleId) {
    return [...new Set([...customRole.features, 'settings' as FeatureKey])]
  }
  return DEFAULT_FEATURES[user.role] ?? DEFAULT_FEATURES.staff
}

export function hasFeature(user: User | null, key: FeatureKey): boolean {
  if (!user) return false
  const features = user.features ?? DEFAULT_FEATURES[user.role] ?? DEFAULT_FEATURES.staff
  return features.includes(key)
}
