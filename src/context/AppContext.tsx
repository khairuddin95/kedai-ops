import {
  createContext, useContext, useReducer, useEffect, useCallback,
  type ReactNode,
} from 'react'
import type { User, Shift, Task, TaskState, Submission, Lang, TaskGroup } from '../types'
import { STRINGS } from '../utils/i18n'
import { SUBMISSIONS as MOCK_SUBS, TASK_GROUPS as MOCK_GROUPS, USERS as MOCK_USERS, MOCK_PASSWORDS } from '../data/mockData'
import { supabaseConfigured } from '../lib/supabase'
import * as db from '../lib/db'

// ─── State ────────────────────────────────────────────────────

interface AppState {
  user:         User | null
  shift:        Shift | null
  taskStates:   Record<string, TaskState>
  submissions:  Submission[]
  taskGroups:   TaskGroup[]
  lang:         Lang
  dark:         boolean
  dbReady:      boolean   // true once initial DB load completed (or fell back)
}

type Action =
  | { type: 'LOGIN';           user: User; shift: Shift }
  | { type: 'LOGOUT' }
  | { type: 'RESET_DAILY' }
  | { type: 'SET_TASK_STATES'; states: Record<string, TaskState> }
  | { type: 'SET_TASK_STATE';  taskId: string; state: Partial<TaskState> }
  | { type: 'SET_SUBMISSIONS'; subs: Submission[] }
  | { type: 'ADD_SUBMISSION';  sub: Submission }
  | { type: 'UPDATE_SUBMISSION'; id: string; updates: Partial<Submission> }
  | { type: 'SET_TASK_GROUPS'; groups: TaskGroup[] }
  | { type: 'ADD_TASK_GROUP';    group: TaskGroup }
  | { type: 'UPDATE_TASK_GROUP'; groupId: string; updates: Partial<Omit<TaskGroup, 'id' | 'tasks'>> }
  | { type: 'DELETE_TASK_GROUP'; groupId: string }
  | { type: 'ADD_TASK';        groupId: string; task: Task }
  | { type: 'DELETE_TASK';     groupId: string; taskId: string }
  | { type: 'SET_LANG';        lang: Lang }
  | { type: 'TOGGLE_DARK' }
  | { type: 'SET_DB_READY' }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.user, shift: action.shift }
    case 'LOGOUT':
      return { ...state, user: null, shift: null, taskStates: {}, dbReady: false }
    case 'RESET_DAILY':
      return { ...state, taskStates: {} }
    case 'SET_TASK_STATES':
      return { ...state, taskStates: action.states }
    case 'SET_TASK_STATE': {
      const prev = state.taskStates[action.taskId] ?? {
        taskId: action.taskId, status: 'pending', checkedItems: [], photos: [], notes: '', rating: 0,
      }
      return { ...state, taskStates: { ...state.taskStates, [action.taskId]: { ...prev, ...action.state } } }
    }
    case 'SET_SUBMISSIONS':
      return { ...state, submissions: action.subs }
    case 'ADD_SUBMISSION':
      return { ...state, submissions: [action.sub, ...state.submissions] }
    case 'UPDATE_SUBMISSION':
      return { ...state, submissions: state.submissions.map(s => s.id === action.id ? { ...s, ...action.updates } : s) }
    case 'SET_TASK_GROUPS':
      return { ...state, taskGroups: action.groups }
    case 'ADD_TASK_GROUP':
      return { ...state, taskGroups: [...state.taskGroups, action.group] }
    case 'UPDATE_TASK_GROUP':
      return { ...state, taskGroups: state.taskGroups.map(g => g.id === action.groupId ? { ...g, ...action.updates } : g) }
    case 'DELETE_TASK_GROUP':
      return { ...state, taskGroups: state.taskGroups.filter(g => g.id !== action.groupId) }
    case 'ADD_TASK':
      return {
        ...state,
        taskGroups: state.taskGroups.map(g =>
          g.id === action.groupId ? { ...g, tasks: [...g.tasks, action.task] } : g
        ),
      }
    case 'DELETE_TASK':
      return {
        ...state,
        taskGroups: state.taskGroups.map(g =>
          g.id === action.groupId ? { ...g, tasks: g.tasks.filter(t => t.id !== action.taskId) } : g
        ),
      }
    case 'SET_LANG':
      return { ...state, lang: action.lang }
    case 'TOGGLE_DARK':
      return { ...state, dark: !state.dark }
    case 'SET_DB_READY':
      return { ...state, dbReady: true }
    default:
      return state
  }
}

function readSession(): { user: User | null; shift: Shift | null } {
  try {
    const u = localStorage.getItem('session_user')
    const sh = localStorage.getItem('session_shift')
    return {
      user:  u  ? (JSON.parse(u)  as User)  : null,
      shift: sh ? (JSON.parse(sh) as Shift) : null,
    }
  } catch {
    return { user: null, shift: null }
  }
}

const { user: savedUser, shift: savedShift } = readSession()

const init: AppState = {
  user:        savedUser,
  shift:       savedShift,
  taskStates:  {},
  submissions: MOCK_SUBS,
  taskGroups:  MOCK_GROUPS,
  lang:        (localStorage.getItem('lang') as Lang) ?? 'bm',
  dark:        localStorage.getItem('dark') === 'true',
  dbReady:     !supabaseConfigured,   // if no DB, mark ready immediately
}

// ─── Context ──────────────────────────────────────────────────

interface CtxValue {
  state:    AppState
  dispatch: React.Dispatch<Action>
  /** Login via username + password — checks DB first, falls back to mock */
  loginWithCredentials: (username: string, password: string, shift: Shift) => Promise<User | null>
  /** Submit a task — persists to DB when configured */
  submitTask:  (sub: Submission) => Promise<void>
  /** Approve/reject a submission */
  reviewSubmission: (id: string, status: 'approved' | 'rejected', comment?: string) => Promise<void>
  /** Persist task state draft */
  saveTaskState: (ts: TaskState) => Promise<void>
  /** Add a new task group */
  addTaskGroup: (g: Omit<TaskGroup, 'tasks'>) => Promise<TaskGroup | null>
  /** Add a new task to a group */
  addTask: (t: Omit<Task, 'id' | 'groupId' | 'groupTitle' | 'groupColor' | 'groupIcon'>, groupId: string) => Promise<Task | null>
  /** Delete a task */
  deleteTask: (taskId: string, groupId: string) => Promise<void>
  /** Delete a task group (and all its tasks) */
  deleteTaskGroup: (groupId: string) => Promise<void>
  /** Update shift / frequency of an existing task group */
  updateTaskGroup: (groupId: string, updates: Partial<Omit<TaskGroup, 'id' | 'tasks'>>) => Promise<void>
}

const Ctx = createContext<CtxValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, init)

  // Persist UI prefs + dark-mode attribute
  useEffect(() => {
    localStorage.setItem('lang', state.lang)
    localStorage.setItem('dark', String(state.dark))
    document.documentElement.setAttribute('data-theme', state.dark ? 'dark' : 'light')
  }, [state.lang, state.dark])

  // Persist session — save user+shift on login, clear on logout
  useEffect(() => {
    if (state.user) {
      localStorage.setItem('session_user',  JSON.stringify(state.user))
      localStorage.setItem('session_shift', JSON.stringify(state.shift))
    } else {
      localStorage.removeItem('session_user')
      localStorage.removeItem('session_shift')
    }
  }, [state.user, state.shift])

  // Daily reset — clear task states + yesterday's submissions when a new day begins
  useEffect(() => {
    const today = new Date().toDateString()
    const lastReset = localStorage.getItem('last_daily_reset')
    if (lastReset && lastReset !== today) {
      // Clear task states in memory and DB
      dispatch({ type: 'RESET_DAILY' })
      // Delete submissions from the previous day
      dispatch({ type: 'SET_SUBMISSIONS', subs: [] })
      if (supabaseConfigured && state.user) {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        db.clearUserTaskStates(state.user.id).catch(() => {})
        db.deleteSubmissionsOnDate(yesterday).catch(() => {})
      }
    }
    localStorage.setItem('last_daily_reset', today)
  // Run once on mount and whenever user changes (login/logout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.user?.id])

  // On login — load per-user task states from DB
  useEffect(() => {
    if (!state.user || !supabaseConfigured) return
    ;(async () => {
      const [states, subs, groups] = await Promise.all([
        db.fetchTaskStates(state.user!.id),
        db.fetchSubmissions(),
        db.fetchTaskGroups(),
      ])
      if (states)  dispatch({ type: 'SET_TASK_STATES',  states })
      if (subs)    dispatch({ type: 'SET_SUBMISSIONS',   subs })
      if (groups)  dispatch({ type: 'SET_TASK_GROUPS',   groups })
      dispatch({ type: 'SET_DB_READY' })
    })()
  }, [state.user?.id])

  // ── Actions ──────────────────────────────────────────────────

  const loginWithCredentials = useCallback(async (username: string, password: string, shift: Shift): Promise<User | null> => {
    if (supabaseConfigured) {
      const user = await db.loginByCredentials(username, password)
      if (user) { dispatch({ type: 'LOGIN', user, shift }); return user }
      return null
    }
    // Fallback: mock users (dev only)
    const u = username.toLowerCase().trim()
    const user = MOCK_USERS.find(m => m.username === u && MOCK_PASSWORDS[m.username] === password) ?? null
    if (user) dispatch({ type: 'LOGIN', user, shift })
    return user
  }, [])

  const submitTask = useCallback(async (sub: Submission) => {
    // Optimistic update
    dispatch({ type: 'ADD_SUBMISSION', sub })
    if (supabaseConfigured && state.user) {
      const saved = await db.insertSubmission(sub, state.user.id)
      if (saved && saved.id !== sub.id) {
        // Replace optimistic record with DB-assigned id
        dispatch({ type: 'UPDATE_SUBMISSION', id: sub.id, updates: { id: saved.id } })
      }
    }
  }, [state.user])

  const reviewSubmission = useCallback(async (
    id: string,
    status: 'approved' | 'rejected',
    comment?: string
  ) => {
    dispatch({ type: 'UPDATE_SUBMISSION', id, updates: { status, supervisorComment: comment } })
    if (supabaseConfigured) {
      await db.updateSubmissionStatus(id, status, comment)
    }
  }, [])

  const saveTaskState = useCallback(async (ts: TaskState) => {
    dispatch({ type: 'SET_TASK_STATE', taskId: ts.taskId, state: ts })
    if (supabaseConfigured && state.user) {
      await db.upsertTaskState(state.user.id, ts)
    }
  }, [state.user])

  const addTaskGroup = useCallback(async (g: Omit<TaskGroup, 'tasks'>): Promise<TaskGroup | null> => {
    const group: TaskGroup = { ...g, tasks: [] }
    dispatch({ type: 'ADD_TASK_GROUP', group })
    if (supabaseConfigured) {
      const saved = await db.insertTaskGroup({ ...g, sortOrder: 99 })
      return saved
    }
    return group
  }, [])

  const addTask = useCallback(async (
    t: Omit<Task, 'id' | 'groupId' | 'groupTitle' | 'groupColor' | 'groupIcon'>,
    groupId: string
  ): Promise<Task | null> => {
    const group = state.taskGroups.find(g => g.id === groupId)
    const task: Task = {
      ...t, id: `tsk_${Date.now()}`,
      groupId, groupTitle: group?.title, groupColor: group?.color, groupIcon: group?.icon,
    }
    dispatch({ type: 'ADD_TASK', groupId, task })
    if (supabaseConfigured) {
      const saved = await db.insertTask(t, groupId, group?.tasks.length ?? 0)
      return saved
    }
    return task
  }, [state.taskGroups])

  const deleteTask = useCallback(async (taskId: string, groupId: string) => {
    dispatch({ type: 'DELETE_TASK', taskId, groupId })
    if (supabaseConfigured) await db.deleteTask(taskId)
  }, [])

  const deleteTaskGroup = useCallback(async (groupId: string) => {
    dispatch({ type: 'DELETE_TASK_GROUP', groupId })
    if (supabaseConfigured) await db.deleteTaskGroup(groupId)
  }, [])

  const updateTaskGroup = useCallback(async (groupId: string, updates: Partial<Omit<TaskGroup, 'id' | 'tasks'>>) => {
    dispatch({ type: 'UPDATE_TASK_GROUP', groupId, updates })
    if (supabaseConfigured) await db.updateTaskGroup(groupId, updates)
  }, [])

  return (
    <Ctx.Provider value={{ state, dispatch, loginWithCredentials, submitTask, reviewSubmission, saveTaskState, addTaskGroup, addTask, deleteTask, deleteTaskGroup, updateTaskGroup }}>
      {children}
    </Ctx.Provider>
  )
}

// ─── Hooks ────────────────────────────────────────────────────

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}

export function useT() {
  const { state } = useApp()
  const lang = state.lang
  return (key: string) => STRINGS[lang]?.[key] ?? STRINGS['bm']?.[key] ?? key
}
