/**
 * db-ops.ts — Operational DB functions (assets, branches, maintenance, loans, schedules).
 * Extracted from db.ts to keep file sizes manageable.
 * All callers use `import * as db from './db'` which re-exports everything here.
 */
import { supabase } from './supabase'
import type { Asset, Branch, GoogleReviewLog, LoanRequest, MaintenanceReport } from '../types'

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

export async function uploadMaintenancePhoto(file: File, reportId: string, index = 0): Promise<string | null> {
  if (!supabase) return null
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${reportId}/${Date.now()}_${index}.${ext}`
  const { error } = await supabase.storage.from('maintenance-photos').upload(path, file, { upsert: false })
  if (error) { console.error('[db] uploadMaintenancePhoto:', error); return null }
  const { data } = supabase.storage.from('maintenance-photos').getPublicUrl(path)
  return data.publicUrl
}

const CATCH_ALL_BRANCHES = ['all', 'semua', 'semua cawangan', 'all branches']
function isCatchAll(branch?: string) {
  return !branch || CATCH_ALL_BRANCHES.includes(branch.toLowerCase().trim())
}

export async function fetchMaintenanceReports(branch?: string): Promise<MaintenanceReport[] | null> {
  if (!supabase) return null
  let q = supabase.from('maintenance_reports').select('*').order('reported_at', { ascending: false })
  if (!isCatchAll(branch)) q = q.ilike('branch', branch!)
  const { data, error } = await q
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

export async function fetchLoanRequests(branch?: string): Promise<LoanRequest[] | null> {
  if (!supabase) return null
  let q = supabase.from('loan_requests').select('*').order('requested_at', { ascending: false })
  if (!isCatchAll(branch)) q = q.ilike('branch', branch!)
  const { data, error } = await q
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

// ─── Schedules ───────────────────────────────────────────────

export interface ScheduleEntry {
  userId: string
  dayOfWeek: number   // 0=Sun, 1=Mon … 6=Sat
  shiftId: import('../types').ShiftId | null
}

export async function fetchSchedules(): Promise<ScheduleEntry[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('schedules').select('user_id, day_of_week, shift_id')
  if (error) { console.error('[db] fetchSchedules:', error); return [] }
  return (data ?? []).map(r => ({ userId: r.user_id, dayOfWeek: r.day_of_week, shiftId: r.shift_id as import('../types').ShiftId | null }))
}

export async function upsertSchedule(entry: ScheduleEntry): Promise<boolean> {
  if (!supabase) return false
  if (!entry.shiftId) {
    const { error } = await supabase.from('schedules').delete().eq('user_id', entry.userId).eq('day_of_week', entry.dayOfWeek)
    if (error) { console.error('[db] upsertSchedule delete:', error); return false }
    return true
  }
  const { error } = await supabase.from('schedules')
    .upsert({ user_id: entry.userId, day_of_week: entry.dayOfWeek, shift_id: entry.shiftId }, { onConflict: 'user_id,day_of_week' })
  if (error) { console.error('[db] upsertSchedule:', error); return false }
  return true
}

export async function getUserTodayShift(userId: string): Promise<import('../types').ShiftId | null> {
  if (!supabase) return null
  const day = new Date().getDay()
  const { data } = await supabase.from('schedules').select('shift_id').eq('user_id', userId).eq('day_of_week', day).maybeSingle()
  return (data?.shift_id as import('../types').ShiftId) ?? null
}

// ─── Google Review Logs ───────────────────────────────────────

function grLogFromDb(r: {
  id: string; staff_id: string | null; staff_name: string; staff_avatar: string
  branch: string; photo_url: string; logged_at: string; status: string
  reviewed_by_name: string | null; supervisor_note: string | null; reviewed_at: string | null
}): GoogleReviewLog {
  return {
    id: r.id,
    staffId: r.staff_id ?? '',
    staffName: r.staff_name,
    staffAvatar: r.staff_avatar,
    branch: r.branch,
    photoUrl: r.photo_url,
    loggedAt: new Date(r.logged_at),
    status: r.status as GoogleReviewLog['status'],
    reviewedByName: r.reviewed_by_name ?? undefined,
    supervisorNote: r.supervisor_note ?? undefined,
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at) : undefined,
  }
}

export async function fetchGoogleReviewLogs(days = 1, branch?: string): Promise<GoogleReviewLog[] | null> {
  if (!supabase) return null
  const since = new Date()
  since.setDate(since.getDate() - days)
  let q = supabase
    .from('google_review_logs')
    .select('*')
    .gte('logged_at', since.toISOString())
    .order('logged_at', { ascending: false })
  const catchAll = ['all', 'semua', 'semua cawangan', 'all branches']
  if (branch && !catchAll.includes(branch.toLowerCase().trim())) {
    q = q.ilike('branch', branch)
  }
  const { data, error } = await q
  if (error) { console.error('[db] fetchGoogleReviewLogs:', error); return null }
  return (data ?? []).map(grLogFromDb)
}

export async function insertGoogleReviewLog(
  log: Omit<GoogleReviewLog, 'id' | 'loggedAt' | 'status' | 'reviewedByName' | 'supervisorNote' | 'reviewedAt'>
): Promise<GoogleReviewLog | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('google_review_logs')
    .insert({
      staff_id:     log.staffId || null,
      staff_name:   log.staffName,
      staff_avatar: log.staffAvatar,
      branch:       log.branch,
      photo_url:    log.photoUrl,
    })
    .select()
    .single()
  if (error) { console.error('[db] insertGoogleReviewLog:', error); return null }
  return data ? grLogFromDb(data) : null
}

export async function reviewGoogleLog(
  id: string,
  status: 'approved' | 'rejected',
  reviewerName: string,
  note?: string
): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('review_google_log', {
    p_id:            id,
    p_status:        status,
    p_reviewer_name: reviewerName,
    p_note:          note ?? null,
  })
  if (error) { console.error('[db] reviewGoogleLog:', error); return false }
  return data === true
}
