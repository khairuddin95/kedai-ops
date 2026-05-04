import type { Asset, Branch, TaskGroup, User, Submission, Shift } from '../types'

export const SHIFTS: Shift[] = [
  { id: 'morning', label: 'Shift Pagi',   startTime: '10:00 pagi',  endTime: '3:00 petang' },
  { id: 'evening', label: 'Shift Petang', startTime: '3:00 petang', endTime: '12:00 malam' },
]

export const TASK_GROUPS: TaskGroup[] = []

export const ALL_TASKS = TASK_GROUPS.flatMap(g =>
  g.tasks.map(t => ({ ...t, groupId: g.id, groupTitle: g.title, groupColor: g.color, groupIcon: g.icon }))
)

export const USERS: User[] = []

export const MOCK_PASSWORDS: Record<string, string> = {}

export const SUBMISSIONS: Submission[] = []

export const ASSETS: Asset[] = []

export const BRANCHES: Branch[] = []
