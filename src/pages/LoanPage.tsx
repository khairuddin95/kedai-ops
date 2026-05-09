import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { STRINGS, langLocale } from '../utils/i18n'
import { supabaseConfigured } from '../lib/supabase'
import * as db from '../lib/db'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import type { LoanRequest, LoanStatus } from '../types'

const STATUS_VARIANT: Record<LoanStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  pending: 'warning', approved: 'success', rejected: 'danger', returned: 'neutral',
}

const STATUS_ICON: Record<LoanStatus, string> = {
  pending: '⏳', approved: '✅', rejected: '❌', returned: '↩️',
}

const blank = { itemName: '', quantity: 1, fromBranch: '', toBranch: '', reason: '', dueDate: '' }

export default function LoanPage() {
  const { state } = useApp()
  const s = STRINGS[state.lang]
  const user = state.user!
  const canManage = user.role === 'supervisor' || user.role === 'owner'

  const [loans, setLoans]         = useState<LoanRequest[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ ...blank })
  const [saving, setSaving]       = useState(false)
  const [filterStatus, setFilter] = useState<LoanStatus | 'all'>('all')
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({})
  const [notes, setNotes]         = useState<Record<string, string>>({})
  const [updating, setUpdating]   = useState<string | null>(null)
  const [toast, setToast]         = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const branch = user.role === 'supervisor' ? user.branch : undefined
      const data = supabaseConfigured ? await db.fetchLoanRequests(branch) : []
      setLoans(data ?? [])
      const initNotes: Record<string, string> = {}
      for (const r of data ?? []) initNotes[r.id] = r.notes ?? ''
      setNotes(initNotes)
      setLoading(false)
    })()
  }, [])

  const handleSubmit = async () => {
    if (!form.itemName.trim() || !form.fromBranch.trim() || !form.toBranch.trim()) return
    setSaving(true)
    const payload = {
      itemName: form.itemName.trim(),
      quantity: Math.max(1, form.quantity),
      fromBranch: form.fromBranch.trim(),
      toBranch: form.toBranch.trim(),
      reason: form.reason.trim(),
      status: 'pending' as LoanStatus,
      requestedById: user.id,
      requestedByName: user.name,
      requestedByAvatar: user.avatar,
      dueDate: form.dueDate || undefined,
    }
    const newLoan = supabaseConfigured
      ? await db.insertLoanRequest(payload)
      : {
          ...payload, id: `loan_${Date.now()}`,
          requestedAt: new Date(),
        } as LoanRequest
    setSaving(false)
    if (!newLoan) return
    setLoans(prev => [newLoan, ...prev])
    setNotes(prev => ({ ...prev, [newLoan.id]: '' }))
    setForm({ ...blank })
    setShowForm(false)
    showToast(s.loan_submitted)
  }

  const handleUpdate = async (r: LoanRequest, status: LoanStatus) => {
    setUpdating(r.id)
    const approvedAt  = status === 'approved'  ? new Date() : status === 'pending' ? null : undefined
    const returnedAt  = status === 'returned'  ? new Date() : undefined
    const approvedBy  = (status === 'approved' || status === 'rejected') ? user.name : status === 'pending' ? '' : undefined

    const ok = supabaseConfigured
      ? await db.updateLoanRequest(r.id, {
          status,
          notes: notes[r.id] ?? '',
          approvedByName: approvedBy,
          approvedAt,
          returnedAt,
        })
      : true

    if (ok) {
      setLoans(prev => prev.map(x => x.id === r.id ? {
        ...x, status,
        notes: notes[r.id],
        approvedByName: approvedBy ?? x.approvedByName,
        approvedAt: approvedAt ?? x.approvedAt,
        returnedAt: returnedAt ?? x.returnedAt,
      } : x))
      showToast(s.loan_updated)
    } else {
      showToast(`⚠️ ${s.update_failed}`)
    }
    setUpdating(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(s.confirm_del_loan)) return
    if (supabaseConfigured) await db.deleteLoanRequest(id)
    setLoans(prev => prev.filter(r => r.id !== id))
  }

  const isOverdue = (r: LoanRequest) =>
    r.dueDate && r.status === 'approved' && new Date(r.dueDate) < new Date()

  const { filtered, counts, overdueCount } = useMemo(() => {
    const now = new Date()
    const isOD = (r: LoanRequest) => r.dueDate && r.status === 'approved' && new Date(r.dueDate) < now
    return {
      filtered:     filterStatus === 'all' ? loans : loans.filter(r => r.status === filterStatus),
      counts: {
        all:      loans.length,
        pending:  loans.filter(r => r.status === 'pending').length,
        approved: loans.filter(r => r.status === 'approved').length,
        rejected: loans.filter(r => r.status === 'rejected').length,
        returned: loans.filter(r => r.status === 'returned').length,
      },
      overdueCount: loans.filter(isOD).length,
    }
  }, [loans, filterStatus])

  const pills: { key: LoanStatus | 'all'; label: string }[] = [
    { key: 'all',      label: `${s.all} (${counts.all})` },
    { key: 'pending',  label: `${s.loan_status_pending} (${counts.pending})` },
    { key: 'approved', label: `${s.loan_status_approved} (${counts.approved})` },
    { key: 'rejected', label: `${s.loan_status_rejected} (${counts.rejected})` },
    { key: 'returned', label: `${s.loan_status_returned} (${counts.returned})` },
  ]

  const fmtDate = (d: Date) =>
    d.toLocaleDateString(langLocale(state.lang), { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">{s.loan_item}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{loans.length} rekod</p>
        </div>
        {!showForm && (
          <Button onClick={() => { setShowForm(true); setForm({ ...blank }) }}>
            + {s.loan_new}
          </Button>
        )}
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <span className="text-xl flex-shrink-0">⚠️</span>
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            {overdueCount} {s.overdue_count} — {s.overdue_alert}
          </p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg px-4 py-3">
          ✅ {toast}
        </div>
      )}

      {/* New loan form */}
      {showForm && (
        <Card>
          <h3 className="font-bold text-sm text-[var(--text)] mb-4">+ {s.loan_new}</h3>
          <div className="space-y-3">
            {/* Item name */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.loan_item_name}</label>
              <input
                value={form.itemName}
                onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))}
                placeholder={s.loan_item_name_ph}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Quantity */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.loan_quantity}</label>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                  className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-brand-400 transition-colors"
                />
              </div>
              {/* Due date */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.loan_due_date}</label>
                <input
                  type="date"
                  value={form.dueDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-brand-400 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* From branch */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.loan_from}</label>
                <input
                  value={form.fromBranch}
                  onChange={e => setForm(f => ({ ...f, fromBranch: e.target.value }))}
                  placeholder={state.user?.branch}
                  className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
                />
              </div>
              {/* To branch */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.loan_to}</label>
                <input
                  value={form.toBranch}
                  onChange={e => setForm(f => ({ ...f, toBranch: e.target.value }))}
                  placeholder="Cawangan lain…"
                  className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.loan_reason}</label>
              <textarea
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder={s.loan_reason_ph}
                rows={2}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>{s.cancel}</Button>
            <Button
              className="flex-1"
              loading={saving}
              disabled={!form.itemName.trim() || !form.fromBranch.trim() || !form.toBranch.trim()}
              onClick={handleSubmit}
            >{s.save}</Button>
          </div>
        </Card>
      )}

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {pills.map(p => (
          <button
            key={p.key}
            onClick={() => setFilter(p.key)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filterStatus === p.key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'border border-[var(--border-2)] text-[var(--text-soft)] hover:border-brand-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">{s.loading}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          <div className="text-4xl mb-2">📦</div>
          {s.no_loans}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
              {/* Card header */}
              <button
                onClick={() => setExpanded(e => ({ ...e, [r.id]: !e[r.id] }))}
                className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-[var(--surface-2)] transition-colors"
              >
                <span className="text-2xl mt-0.5 flex-shrink-0">📦</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-[var(--text)]">{r.itemName}</span>
                    <span className="text-xs text-[var(--text-muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded-full border border-[var(--border)]">×{r.quantity}</span>
                    <Badge variant={STATUS_VARIANT[r.status]}>
                      {STATUS_ICON[r.status]} {s[`loan_status_${r.status}` as keyof typeof s]}
                    </Badge>
                    {isOverdue(r) && (
                      <Badge variant="danger">⚠️ {s.loan_overdue}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-[var(--text-muted)]">
                      📍 {r.fromBranch} → {r.toBranch}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {r.requestedByAvatar} {r.requestedByName}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{fmtDate(r.requestedAt)}</span>
                  </div>
                </div>
                <span className="text-[var(--text-muted)] text-sm flex-shrink-0" style={{ transform: expanded[r.id] ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>›</span>
              </button>

              {/* Expanded */}
              {expanded[r.id] && (
                <div className="border-t border-[var(--border)] px-4 py-4 bg-[var(--surface-2)] space-y-4">
                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {r.reason && (
                      <div className="col-span-2">
                        <span className="text-xs text-[var(--text-muted)]">{s.loan_reason}</span>
                        <p className="text-[var(--text-soft)] mt-0.5">{r.reason}</p>
                      </div>
                    )}
                    {r.dueDate && (
                      <div>
                        <span className="text-xs text-[var(--text-muted)]">{s.loan_due_date}</span>
                        <p className={`mt-0.5 font-medium ${isOverdue(r) ? 'text-red-500' : 'text-[var(--text)]'}`}>
                          {new Date(r.dueDate).toLocaleDateString(langLocale(state.lang), { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                    {r.approvedByName && (
                      <div>
                        <span className="text-xs text-[var(--text-muted)]">{r.status === 'rejected' ? s.rejected_by : s.approved_by}</span>
                        <p className="text-[var(--text)] mt-0.5 font-medium">{r.approvedByName}</p>
                      </div>
                    )}
                    {r.returnedAt && (
                      <div>
                        <span className="text-xs text-[var(--text-muted)]">{s.returned_date}</span>
                        <p className="text-emerald-600 dark:text-emerald-400 mt-0.5">{fmtDate(r.returnedAt)}</p>
                      </div>
                    )}
                  </div>

                  {/* Approval notes read-only for staff */}
                  {r.notes && !canManage && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">{s.loan_notes}</p>
                      <p className="text-sm text-[var(--text)]">{r.notes}</p>
                    </div>
                  )}

                  {/* Manager controls */}
                  {canManage && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.loan_notes}</label>
                        <textarea
                          value={notes[r.id] ?? ''}
                          onChange={e => setNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder={s.loan_notes_ph}
                          rows={2}
                          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors resize-none"
                        />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {r.status === 'pending' && (
                          <>
                            <Button size="sm" loading={updating === r.id} onClick={() => handleUpdate(r, 'approved')}>
                              ✅ {s.loan_approve}
                            </Button>
                            <Button size="sm" variant="secondary" loading={updating === r.id} onClick={() => handleUpdate(r, 'rejected')}>
                              ❌ {s.loan_reject}
                            </Button>
                          </>
                        )}
                        {r.status === 'approved' && (
                          <Button size="sm" loading={updating === r.id} onClick={() => handleUpdate(r, 'returned')}>
                            ↩️ {s.loan_return}
                          </Button>
                        )}
                        {(r.status === 'approved' || r.status === 'rejected') && (
                          <Button size="sm" variant="secondary" loading={updating === r.id} onClick={() => handleUpdate(r, 'pending')}>
                            🔁 {s.loan_reopen}
                          </Button>
                        )}
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="ml-auto text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          🗑 {s.delete}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
