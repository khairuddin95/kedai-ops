/**
 * db.ts — Core Supabase database operations (users, tasks, submissions, task states,
 * custom roles). Operational functions (assets, branches, maintenance, loans, schedules)
 * live in db-ops.ts and are re-exported here so callers need only one import.
 */
import { supabase } from './supabase'
import type { Task, TaskGroup, TaskGroupDepartment, TaskGroupFrequency, TaskGroupShift, TaskState, User } from '../types'
import type { Submission } from '../types'

export * from './db-ops'

// ─── helpers ────────────────────────────────────────────────

function taskGroupFromDb(
  g: { id: string; title: string; time: string; icon: string; color: string; shift?: string | null; frequency?: string | null; department?: string | null },
  tasks: {
    id: string; title: string; est: number; items: string[]
    requires_photo: boolean; group_id: string
  }[]
): TaskGroup {
  return {
    id: g.id, title: g.title, time: g.time, icon: g.icon, color: g.color,
    shift: (g.shift as TaskGroup['shift']) ?? 'both',
    frequency: (g.frequency as TaskGroupFrequency) ?? 'daily',
    department: (g.department as TaskGroupDepartment) ?? 'all',
    tasks: tasks
      .filter(t => t.group_id === g.id)
      .map(t => ({
        id: t.id, title: t.title, est: t.est, items: t.items,
        requiresPhoto: t.requires_photo,
        groupId: g.id, groupTitle: g.title, groupColor: g.color, groupIcon: g.icon,
      })),
  }
}

export function submissionFromDb(r: {
  id: string; task_id: string; task_title: string
  staff_id: string; staff_name: string; staff_avatar: string
  branch: string; shift_id: string; submitted_at: string
  checked_items: number[]; photos: string[]; notes: string
  rating: number; status: string; supervisor_comment: string | null
  flag: boolean; group_title: string | null; group_color: string | null
}): Submission {
  return {
    id: r.id,
    taskId: r.task_id,
    taskTitle: r.task_title,
    staffName: r.staff_name,
    staffAvatar: r.staff_avatar,
    branch: r.branch,
    shift: r.shift_id as 'morning' | 'evening',
    submittedAt: new Date(r.submitted_at),
    checkedItems: r.checked_items,
    photos: r.photos,
    notes: r.notes,
    rating: r.rating,
    status: r.status as Submission['status'],
    supervisorComment: r.supervisor_comment ?? undefined,
    flag: r.flag,
    groupTitle: r.group_title ?? undefined,
    groupColor: r.group_color ?? undefined,
  }
}

// ─── Users ──────────────────────────────────────────────────

export interface UserPreview {
  id: string; name: string; avatar: string
  role: string; branch: string; username: string
  pinSet: boolean
}

export async function checkUsername(username: string): Promise<UserPreview | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('check_username', {
    p_username: username.toLowerCase().trim(),
  })
  if (error || !data?.length) { console.error('[db] checkUsername:', error); return null }
  const r = data[0]
  return { id: r.id, name: r.name, avatar: r.avatar, role: r.role, branch: r.branch, username: r.username, pinSet: r.pin_set }
}

async function getUserExtras(userId: string): Promise<{
  defaultShift?: import('../types').ShiftId
  department?: import('../types').Department
}> {
  if (!supabase) return {}
  const { data } = await supabase
    .from('users')
    .select('default_shift, department')
    .eq('id', userId)
    .single()
  return {
    defaultShift: (data?.default_shift as import('../types').ShiftId) || undefined,
    department:   (data?.department   as import('../types').Department) || undefined,
  }
}

export async function getUserPinStatus(userId: string): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.from('users').select('pin_set').eq('id', userId).single()
  return data?.pin_set ?? false
}

export async function setUserPin(username: string, pin: string): Promise<User | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('set_user_pin', {
    p_username: username.toLowerCase().trim(),
    p_pin: pin,
  })
  if (error || !data?.length) { console.error('[db] setUserPin:', error); return null }
  const r = data[0]
  const extras = await getUserExtras(r.id)
  return { id: r.id, name: r.name, role: r.role, branch: r.branch, avatar: r.avatar, username: r.username, ...extras }
}

export async function verifyPin(username: string, pin: string): Promise<User | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('verify_pin', {
    p_username: username.toLowerCase().trim(),
    p_pin: pin,
  })
  if (error || !data?.length) { console.error('[db] verifyPin:', error); return null }
  const r = data[0]
  const extras = await getUserExtras(r.id)
  return { id: r.id, name: r.name, role: r.role, branch: r.branch, avatar: r.avatar, username: r.username, ...extras }
}

export async function loginByCredentials(username: string, password: string): Promise<User | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('login_by_credentials', {
    p_username: username.toLowerCase().trim(),
    p_password: password,
  })
  if (error || !data?.length) { console.error('[db] loginByCredentials:', error); return null }
  const r = data[0]
  const extras = await getUserExtras(r.id)
  return { id: r.id, name: r.name, role: r.role, branch: r.branch, avatar: r.avatar, username: r.username, ...extras }
}

export async function fetchUsers(): Promise<User[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role, branch, avatar, username, pin_set, telegram_id, default_shift, department')
    .order('name')
  if (error) { console.error('[db] fetchUsers:', error); return null }
  return (data ?? []).map(r => ({
    id: r.id, name: r.name, role: r.role,
    branch: r.branch, avatar: r.avatar, username: r.username ?? '',
    telegramId:   r.telegram_id ?? undefined,
    defaultShift: (r.default_shift as import('../types').ShiftId) || undefined,
    department:   (r.department as import('../types').Department) || undefined,
  }))
}

export async function registerUser(user: Omit<User, 'id'>): Promise<User | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('register_user', {
    p_name:     user.name,
    p_username: user.username.toLowerCase().trim(),
    p_role:     user.role,
    p_branch:   user.branch,
    p_avatar:   user.avatar,
  })
  if (error) { console.error('[db] registerUser:', error); return null }
  const r = Array.isArray(data) ? data[0] : data
  if (!r) return null
  return { id: r.id, name: r.name, role: r.role, branch: r.branch, avatar: r.avatar, username: r.username }
}

export async function updateUser(
  id: string,
  updates: { name: string; role: string; branch: string; avatar: string; default_shift?: string | null; department?: string | null }
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('users').update(updates).eq('id', id)
  if (error) { console.error('[db] updateUser:', error); return false }
  return true
}

export async function resetUserPin(id: string, branch: string): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('reset_user_pin', { p_user_id: id, p_branch: branch })
  if (error) { console.error('[db] resetUserPin:', error); return false }
  return data === true
}

export async function clearTelegramId(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('users').update({ telegram_id: null }).eq('id', id)
  if (error) { console.error('[db] clearTelegramId:', error); return false }
  return true
}

export async function deleteUser(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('users').delete().eq('id', id)
  if (error) { console.error('[db] deleteUser:', error); return false }
  return true
}

// ─── Task Group / Task mutations ─────────────────────────────

export async function insertTaskGroup(
  g: Omit<TaskGroup, 'tasks'> & { sortOrder: number }
): Promise<TaskGroup | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('task_groups')
    .insert({ id: g.id, title: g.title, time: g.time, icon: g.icon, color: g.color, shift: g.shift ?? 'both', frequency: g.frequency ?? 'daily', department: g.department ?? 'all', sort_order: g.sortOrder })
    .select()
    .single()
  if (error) { console.error('[db] insertTaskGroup:', error); return null }
  return { id: data.id, title: data.title, time: data.time, icon: data.icon, color: data.color, shift: (data.shift as TaskGroupShift) ?? 'both', frequency: (data.frequency as TaskGroupFrequency) ?? 'daily', department: (data.department as TaskGroupDepartment) ?? 'all', tasks: [] }
}

export async function updateTaskGroup(id: string, updates: Partial<{ shift: TaskGroupShift; frequency: TaskGroupFrequency; department: TaskGroupDepartment; title: string; time: string; icon: string; color: string }>): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('task_groups').update(updates).eq('id', id)
  if (error) console.error('[db] updateTaskGroup:', error)
}

export async function insertTask(
  t: Omit<Task, 'id' | 'groupId' | 'groupTitle' | 'groupColor' | 'groupIcon'>,
  groupId: string,
  sortOrder: number
): Promise<Task | null> {
  if (!supabase) return null
  const id = `tsk_${Date.now()}`
  const { data, error } = await supabase
    .from('tasks')
    .insert({ id, title: t.title, est: t.est, items: t.items, requires_photo: t.requiresPhoto ?? false, group_id: groupId, sort_order: sortOrder })
    .select()
    .single()
  if (error) { console.error('[db] insertTask:', error); return null }
  return { id: data.id, title: data.title, est: data.est, items: data.items, requiresPhoto: data.requires_photo, groupId }
}

export async function updateTask(
  taskId: string,
  updates: Pick<Task, 'title' | 'est' | 'requiresPhoto' | 'items'>
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('tasks')
    .update({ title: updates.title, est: updates.est, requires_photo: updates.requiresPhoto ?? false, items: updates.items })
    .eq('id', taskId)
  if (error) { console.error('[db] updateTask:', error); return false }
  return true
}

export async function deleteTask(taskId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) { console.error('[db] deleteTask:', error); return false }
  return true
}

export async function deleteTaskGroup(groupId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('task_groups').delete().eq('id', groupId)
  if (error) { console.error('[db] deleteTaskGroup:', error); return false }
  return true
}

// ─── Task Groups + Tasks ─────────────────────────────────────

export async function fetchTaskGroups(): Promise<TaskGroup[] | null> {
  if (!supabase) return null
  const [groupsRes, tasksRes] = await Promise.all([
    supabase.from('task_groups').select('*').order('sort_order'),
    supabase.from('tasks').select('*').order('sort_order'),
  ])
  if (groupsRes.error || tasksRes.error) {
    console.error('[db] fetchTaskGroups:', groupsRes.error ?? tasksRes.error)
    return null
  }
  return (groupsRes.data ?? []).map(g => taskGroupFromDb(g, tasksRes.data ?? []))
}

// ─── Submissions ─────────────────────────────────────────────

export async function fetchSubmissions(days = 90, branch?: string): Promise<Submission[] | null> {
  if (!supabase) return null
  const since = new Date()
  since.setDate(since.getDate() - days)
  let q = supabase
    .from('submissions')
    .select('*')
    .gte('submitted_at', since.toISOString())
    .order('submitted_at', { ascending: false })
  if (branch) q = q.eq('branch', branch)
  const { data, error } = await q
  if (error) { console.error('[db] fetchSubmissions:', error); return null }
  return (data ?? []).map(submissionFromDb)
}

export async function insertSubmission(sub: Submission, staffId: string): Promise<Submission | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      task_id: sub.taskId,
      task_title: sub.taskTitle,
      staff_id: staffId,
      staff_name: sub.staffName,
      staff_avatar: sub.staffAvatar,
      branch: sub.branch,
      shift_id: sub.shift,
      checked_items: sub.checkedItems,
      photos: sub.photos,
      notes: sub.notes,
      rating: sub.rating,
      status: sub.status,
      flag: sub.flag ?? false,
      group_title: sub.groupTitle ?? null,
      group_color: sub.groupColor ?? null,
    })
    .select()
    .single()
  if (error) { console.error('[db] insertSubmission:', error); return null }
  return data ? submissionFromDb(data) : null
}

export async function updateSubmissionStatus(
  id: string,
  status: 'approved' | 'rejected',
  supervisorComment?: string
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('submissions')
    .update({ status, supervisor_comment: supervisorComment ?? null })
    .eq('id', id)
  if (error) { console.error('[db] updateSubmission:', error); return false }
  return true
}

// ─── Task States ─────────────────────────────────────────────

export async function fetchTaskStates(userId: string): Promise<Record<string, TaskState> | null> {
  if (!supabase) return null
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const { data, error } = await supabase
    .from('task_states')
    .select('*')
    .eq('user_id', userId)
    .gte('updated_at', todayStart.toISOString())
  if (error) { console.error('[db] fetchTaskStates:', error); return null }
  const map: Record<string, TaskState> = {}
  for (const r of data ?? []) {
    map[r.task_id] = {
      taskId: r.task_id,
      status: r.status as TaskState['status'],
      checkedItems: r.checked_items,
      photos: r.photos,
      notes: r.notes,
      rating: r.rating,
    }
  }
  return map
}

export async function upsertTaskState(userId: string, state: TaskState): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('task_states')
    .upsert({
      user_id: userId,
      task_id: state.taskId,
      status: state.status,
      checked_items: state.checkedItems,
      photos: state.photos,
      notes: state.notes,
      rating: state.rating,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,task_id' })
  if (error) { console.error('[db] upsertTaskState:', error); return false }
  return true
}

export async function clearUserTaskStates(userId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('task_states').delete().eq('user_id', userId)
  if (error) { console.error('[db] clearUserTaskStates:', error); return false }
  return true
}

// ─── Photos ──────────────────────────────────────────────────

export async function uploadTaskPhoto(file: File, submissionId: string, index = 0): Promise<string | null> {
  if (!supabase) return null
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${submissionId}/${Date.now()}_${index}.${ext}`
  const { error } = await supabase.storage.from('task-photos').upload(path, file, { upsert: false })
  if (error) { console.error('[db] uploadTaskPhoto:', error); return null }
  const { data } = supabase.storage.from('task-photos').getPublicUrl(path)
  return data.publicUrl
}
