/**
 * db.ts — All Supabase database operations.
 * Every function returns null (and logs) on error rather than throwing,
 * so the UI can fall back to mock data gracefully.
 */
import { supabase } from './supabase'
import type { Asset, Branch, LoanRequest, MaintenanceReport, Submission, Task, TaskGroup, TaskGroupFrequency, TaskGroupShift, TaskState, User } from '../types'

// ─── helpers ────────────────────────────────────────────────

function taskGroupFromDb(
  g: { id: string; title: string; time: string; icon: string; color: string; shift?: string | null; frequency?: string | null },
  tasks: {
    id: string; title: string; est: number; items: string[]
    requires_photo: boolean; group_id: string
  }[]
): TaskGroup {
  return {
    id: g.id, title: g.title, time: g.time, icon: g.icon, color: g.color,
    shift: (g.shift as TaskGroup['shift']) ?? 'both',
    frequency: (g.frequency as TaskGroupFrequency) ?? 'daily',
    tasks: tasks
      .filter(t => t.group_id === g.id)
      .map(t => ({
        id: t.id, title: t.title, est: t.est, items: t.items,
        requiresPhoto: t.requires_photo,
        groupId: g.id, groupTitle: g.title, groupColor: g.color, groupIcon: g.icon,
      })),
  }
}

function submissionFromDb(r: {
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

export async function setUserPin(username: string, pin: string): Promise<User | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('set_user_pin', {
    p_username: username.toLowerCase().trim(),
    p_pin: pin,
  })
  if (error || !data?.length) { console.error('[db] setUserPin:', error); return null }
  const r = data[0]
  return { id: r.id, name: r.name, role: r.role, branch: r.branch, avatar: r.avatar, username: r.username }
}

export async function verifyPin(username: string, pin: string): Promise<User | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('verify_pin', {
    p_username: username.toLowerCase().trim(),
    p_pin: pin,
  })
  if (error || !data?.length) { console.error('[db] verifyPin:', error); return null }
  const r = data[0]
  return { id: r.id, name: r.name, role: r.role, branch: r.branch, avatar: r.avatar, username: r.username }
}

export async function loginByCredentials(username: string, password: string): Promise<User | null> {
  if (!supabase) return null
  // RPC compares password against bcrypt hash server-side — hash never leaves DB
  const { data, error } = await supabase.rpc('login_by_credentials', {
    p_username: username.toLowerCase().trim(),
    p_password: password,
  })
  if (error || !data?.length) { console.error('[db] loginByCredentials:', error); return null }
  const r = data[0]
  return { id: r.id, name: r.name, role: r.role, branch: r.branch, avatar: r.avatar, username: r.username }
}

export async function fetchUsers(): Promise<User[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role, branch, avatar, username, pin_set, telegram_id')
    .order('name')
  if (error) { console.error('[db] fetchUsers:', error); return null }
  return (data ?? []).map(r => ({
    id: r.id, name: r.name, role: r.role,
    branch: r.branch, avatar: r.avatar, username: r.username ?? '',
    telegramId: r.telegram_id ?? undefined,
  }))
}

export async function registerUser(
  user: Omit<User, 'id'>
): Promise<User | null> {
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
  updates: { name: string; role: string; branch: string; avatar: string }
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
    .insert({ id: g.id, title: g.title, time: g.time, icon: g.icon, color: g.color, shift: g.shift ?? 'both', frequency: g.frequency ?? 'daily', sort_order: g.sortOrder })
    .select()
    .single()
  if (error) { console.error('[db] insertTaskGroup:', error); return null }
  return { id: data.id, title: data.title, time: data.time, icon: data.icon, color: data.color, shift: (data.shift as TaskGroupShift) ?? 'both', frequency: (data.frequency as TaskGroupFrequency) ?? 'daily', tasks: [] }
}

export async function updateTaskGroup(id: string, updates: Partial<{ shift: TaskGroupShift; frequency: TaskGroupFrequency; title: string; time: string; icon: string; color: string }>): Promise<void> {
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

export async function fetchSubmissions(): Promise<Submission[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .order('submitted_at', { ascending: false })
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

export async function deleteSubmissionsOnDate(date: Date): Promise<boolean> {
  if (!supabase) return false
  const start = new Date(date); start.setHours(0, 0, 0, 0)
  const end   = new Date(date); end.setHours(23, 59, 59, 999)
  const { error } = await supabase
    .from('submissions')
    .delete()
    .gte('submitted_at', start.toISOString())
    .lte('submitted_at', end.toISOString())
  if (error) { console.error('[db] deleteSubmissionsOnDate:', error); return false }
  return true
}

// ─── Task States ─────────────────────────────────────────────

export async function fetchTaskStates(userId: string): Promise<Record<string, TaskState> | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('task_states')
    .select('*')
    .eq('user_id', userId)
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

// ─── Assets ──────────────────────────────────────────────────

function assetFromDb(r: {
  id: string; name: string; category: string; quantity: number
  condition: string; branch: string; notes: string | null; last_checked: string | null
}): Asset {
  return {
    id: r.id, name: r.name, category: r.category,
    quantity: r.quantity, condition: r.condition as Asset['condition'],
    branch: r.branch, notes: r.notes ?? undefined,
    lastChecked: r.last_checked ?? undefined,
  }
}

export async function fetchAssets(branch?: string): Promise<Asset[] | null> {
  if (!supabase) return null
  let q = supabase.from('assets').select('*').order('category').order('name')
  if (branch) q = q.eq('branch', branch)
  const { data, error } = await q
  if (error) { console.error('[db] fetchAssets:', error); return null }
  return (data ?? []).map(assetFromDb)
}

export async function insertAsset(asset: Omit<Asset, 'id'>): Promise<Asset | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('assets')
    .insert({
      name: asset.name, category: asset.category, quantity: asset.quantity,
      condition: asset.condition, branch: asset.branch,
      notes: asset.notes ?? null,
      last_checked: asset.lastChecked ?? new Date().toISOString().slice(0, 10),
    })
    .select().single()
  if (error) { console.error('[db] insertAsset:', error); return null }
  return assetFromDb(data)
}

export async function updateAsset(id: string, updates: Partial<Omit<Asset, 'id'>>): Promise<boolean> {
  if (!supabase) return false
  const patch: Record<string, unknown> = {}
  if (updates.name      !== undefined) patch.name       = updates.name
  if (updates.category  !== undefined) patch.category   = updates.category
  if (updates.quantity  !== undefined) patch.quantity   = updates.quantity
  if (updates.condition !== undefined) patch.condition  = updates.condition
  if (updates.branch    !== undefined) patch.branch     = updates.branch
  if (updates.notes     !== undefined) patch.notes      = updates.notes ?? null
  if (updates.lastChecked !== undefined) patch.last_checked = updates.lastChecked
  const { error } = await supabase.from('assets').update(patch).eq('id', id)
  if (error) { console.error('[db] updateAsset:', error); return false }
  return true
}

export async function deleteAsset(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('assets').delete().eq('id', id)
  if (error) { console.error('[db] deleteAsset:', error); return false }
  return true
}

// ─── Branches ────────────────────────────────────────────────

function branchFromDb(r: {
  id: string; name: string; address: string | null
  phone: string | null; status: string
}): Branch {
  return {
    id: r.id, name: r.name,
    address: r.address ?? undefined,
    phone: r.phone ?? undefined,
    status: r.status as Branch['status'],
  }
}

export async function fetchBranches(): Promise<Branch[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('branches').select('*').order('name')
  if (error) { console.error('[db] fetchBranches:', error); return null }
  return (data ?? []).map(branchFromDb)
}

export async function insertBranch(b: Omit<Branch, 'id'>): Promise<Branch | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('branches')
    .insert({ name: b.name, address: b.address ?? null, phone: b.phone ?? null, status: b.status })
    .select().single()
  if (error) { console.error('[db] insertBranch:', error); return null }
  return branchFromDb(data)
}

export async function updateBranch(id: string, updates: Partial<Omit<Branch, 'id'>>): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('branches').update({
    ...(updates.name    !== undefined && { name:    updates.name }),
    ...(updates.address !== undefined && { address: updates.address ?? null }),
    ...(updates.phone   !== undefined && { phone:   updates.phone   ?? null }),
    ...(updates.status  !== undefined && { status:  updates.status }),
  }).eq('id', id)
  if (error) { console.error('[db] updateBranch:', error); return false }
  return true
}

export async function deleteBranch(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('branches').delete().eq('id', id)
  if (error) { console.error('[db] deleteBranch:', error); return false }
  return true
}

// ─── Maintenance Reports ─────────────────────────────────────

function maintFromDb(r: {
  id: string; title: string; category: string; description: string
  priority: string; status: string
  reported_by_id: string; reported_by_name: string; reported_by_avatar: string
  branch: string; reported_at: string; resolved_at: string | null
  supervisor_notes: string | null; photos: string[] | null
}): MaintenanceReport {
  return {
    id: r.id, title: r.title,
    category: r.category as MaintenanceReport['category'],
    description: r.description,
    priority: r.priority as MaintenanceReport['priority'],
    status: r.status as MaintenanceReport['status'],
    reportedById: r.reported_by_id, reportedByName: r.reported_by_name,
    reportedByAvatar: r.reported_by_avatar, branch: r.branch,
    reportedAt: new Date(r.reported_at),
    resolvedAt: r.resolved_at ? new Date(r.resolved_at) : undefined,
    supervisorNotes: r.supervisor_notes ?? undefined,
    photos: r.photos ?? [],
  }
}

export async function uploadMaintenancePhoto(file: File, reportId: string): Promise<string | null> {
  if (!supabase) return null
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${reportId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('maintenance-photos').upload(path, file, { upsert: false })
  if (error) { console.error('[db] uploadMaintenancePhoto:', error); return null }
  const { data } = supabase.storage.from('maintenance-photos').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadTaskPhoto(file: File, submissionId: string): Promise<string | null> {
  if (!supabase) return null
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `tasks/${submissionId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('maintenance-photos').upload(path, file, { upsert: false })
  if (error) { console.error('[db] uploadTaskPhoto:', error); return null }
  const { data } = supabase.storage.from('maintenance-photos').getPublicUrl(path)
  return data.publicUrl
}

export async function fetchMaintenanceReports(): Promise<MaintenanceReport[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('maintenance_reports')
    .select('*')
    .order('reported_at', { ascending: false })
  if (error) { console.error('[db] fetchMaintenanceReports:', error); return null }
  return (data ?? []).map(maintFromDb)
}

export async function insertMaintenanceReport(
  r: Omit<MaintenanceReport, 'id' | 'reportedAt' | 'resolvedAt' | 'supervisorNotes'>
): Promise<MaintenanceReport | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('maintenance_reports')
    .insert({
      title: r.title, category: r.category, description: r.description,
      priority: r.priority, status: 'open',
      reported_by_id: r.reportedById, reported_by_name: r.reportedByName,
      reported_by_avatar: r.reportedByAvatar, branch: r.branch,
      photos: r.photos,
    })
    .select().single()
  if (error) { console.error('[db] insertMaintenanceReport:', error); return null }
  return maintFromDb(data)
}

export async function updateMaintenanceReport(
  id: string,
  updates: { status?: MaintenanceReport['status']; supervisorNotes?: string; resolvedAt?: Date | null; photos?: string[] }
): Promise<boolean> {
  if (!supabase) return false
  const patch: Record<string, unknown> = {}
  if (updates.status !== undefined)          patch.status           = updates.status
  if (updates.supervisorNotes !== undefined) patch.supervisor_notes = updates.supervisorNotes || null
  if (updates.resolvedAt !== undefined)      patch.resolved_at      = updates.resolvedAt?.toISOString() ?? null
  if (updates.photos !== undefined)          patch.photos           = updates.photos
  const { error } = await supabase.from('maintenance_reports').update(patch).eq('id', id)
  if (error) { console.error('[db] updateMaintenanceReport:', error); return false }
  return true
}

export async function deleteMaintenanceReport(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('maintenance_reports').delete().eq('id', id)
  if (error) { console.error('[db] deleteMaintenanceReport:', error); return false }
  return true
}

// ─── Loan Requests ───────────────────────────────────────────

function loanFromDb(r: {
  id: string; item_name: string; quantity: number
  from_branch: string; to_branch: string; reason: string; status: string
  requested_by_id: string; requested_by_name: string; requested_by_avatar: string
  approved_by_name: string | null; due_date: string | null; notes: string | null
  requested_at: string; approved_at: string | null; returned_at: string | null
}): LoanRequest {
  return {
    id: r.id, itemName: r.item_name, quantity: r.quantity,
    fromBranch: r.from_branch, toBranch: r.to_branch, reason: r.reason,
    status: r.status as LoanRequest['status'],
    requestedById: r.requested_by_id,
    requestedByName: r.requested_by_name,
    requestedByAvatar: r.requested_by_avatar,
    approvedByName: r.approved_by_name ?? undefined,
    dueDate: r.due_date ?? undefined,
    notes: r.notes ?? undefined,
    requestedAt: new Date(r.requested_at),
    approvedAt: r.approved_at ? new Date(r.approved_at) : undefined,
    returnedAt: r.returned_at ? new Date(r.returned_at) : undefined,
  }
}

export async function fetchLoanRequests(): Promise<LoanRequest[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('loan_requests')
    .select('*')
    .order('requested_at', { ascending: false })
  if (error) { console.error('[db] fetchLoanRequests:', error); return null }
  return (data ?? []).map(loanFromDb)
}

export async function insertLoanRequest(
  r: Omit<LoanRequest, 'id' | 'requestedAt' | 'approvedAt' | 'returnedAt' | 'approvedByName' | 'notes'>
): Promise<LoanRequest | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('loan_requests')
    .insert({
      item_name: r.itemName, quantity: r.quantity,
      from_branch: r.fromBranch, to_branch: r.toBranch,
      reason: r.reason, status: 'pending',
      requested_by_id: r.requestedById,
      requested_by_name: r.requestedByName,
      requested_by_avatar: r.requestedByAvatar,
      due_date: r.dueDate ?? null,
    })
    .select().single()
  if (error) { console.error('[db] insertLoanRequest:', error); return null }
  return loanFromDb(data)
}

export async function updateLoanRequest(
  id: string,
  updates: { status?: LoanRequest['status']; notes?: string; approvedByName?: string; approvedAt?: Date | null; returnedAt?: Date | null }
): Promise<boolean> {
  if (!supabase) return false
  const patch: Record<string, unknown> = {}
  if (updates.status !== undefined)        patch.status           = updates.status
  if (updates.notes !== undefined)         patch.notes            = updates.notes || null
  if (updates.approvedByName !== undefined) patch.approved_by_name = updates.approvedByName || null
  if (updates.approvedAt !== undefined)    patch.approved_at      = updates.approvedAt?.toISOString() ?? null
  if (updates.returnedAt !== undefined)    patch.returned_at      = updates.returnedAt?.toISOString() ?? null
  const { error } = await supabase.from('loan_requests').update(patch).eq('id', id)
  if (error) { console.error('[db] updateLoanRequest:', error); return false }
  return true
}

export async function deleteLoanRequest(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('loan_requests').delete().eq('id', id)
  if (error) { console.error('[db] deleteLoanRequest:', error); return false }
  return true
}
