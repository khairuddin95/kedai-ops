import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import * as db from '../lib/db'
import { supabaseConfigured } from '../lib/supabase'
import { BRANCHES as MOCK_BRANCHES } from '../data/mockData'
import type { Branch } from '../types'

const blank = { name: '', address: '', phone: '', status: 'active' as Branch['status'] }

export default function BranchPage() {
  const { state } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]
  const isOwner = state.user?.role === 'owner'

  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm]         = useState({ ...blank })
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const data = supabaseConfigured ? await db.fetchBranches() : MOCK_BRANCHES
      setBranches(data ?? MOCK_BRANCHES)
      setLoading(false)
    })()
  }, [])

  const resetForm = () => { setForm({ ...blank }); setEditId(null); setError('') }

  const openAdd = () => { resetForm(); setShowForm(true) }

  const openEdit = (b: Branch) => {
    setForm({ name: b.name, address: b.address ?? '', phone: b.phone ?? '', status: b.status })
    setEditId(b.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    setError('')
    if (!form.name.trim()) { setError(s.fill_all); return }
    setSaving(true)
    const payload = {
      name:    form.name.trim(),
      address: form.address.trim() || undefined,
      phone:   form.phone.trim()   || undefined,
      status:  form.status,
    }

    if (editId) {
      if (supabaseConfigured) await db.updateBranch(editId, payload)
      setBranches(prev => prev.map(b => b.id === editId ? { ...b, ...payload } : b))
      setSuccess(s.branch_saved)
    } else {
      let newBranch: Branch | null = null
      if (supabaseConfigured) {
        newBranch = await db.insertBranch(payload)
      } else {
        newBranch = { id: `mock_${Date.now()}`, ...payload }
      }
      if (!newBranch) { setError('Gagal menyimpan. Cuba lagi.'); setSaving(false); return }
      setBranches(prev => [...prev, newBranch!].sort((a, b) => a.name.localeCompare(b.name)))
      setSuccess(s.branch_added)
    }

    setSaving(false)
    setShowForm(false)
    resetForm()
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(s.confirm_del_branch)) return
    setDeleting(id)
    if (supabaseConfigured) await db.deleteBranch(id)
    setBranches(prev => prev.filter(b => b.id !== id))
    setDeleting(null)
  }

  const active   = branches.filter(b => b.status === 'active').length
  const inactive = branches.filter(b => b.status === 'inactive').length

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">{s.branch_mgmt}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {branches.length} {lang === 'bm' ? 'cawangan' : 'branches'}
          </p>
        </div>
        {isOwner && !showForm && (
          <Button onClick={openAdd}>+ {s.add_branch}</Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: s.total_branches,  value: branches.length, icon: '🏪', color: 'text-brand-600' },
          { label: s.active_branches, value: active,          icon: '🟢', color: 'text-emerald-600' },
          { label: lang === 'bm' ? 'Tidak Aktif' : 'Inactive', value: inactive, icon: '⚪', color: 'text-[var(--text-muted)]' },
        ].map(stat => (
          <div key={stat.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Success toast */}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg px-4 py-3">
          ✅ {success}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <Card>
          <h3 className="font-bold text-sm text-[var(--text)] mb-4">
            {editId ? `✏️ ${s.edit_branch}` : `+ ${s.add_branch}`}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.branch_name}</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={s.branch_name_placeholder}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
              />
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">
                {s.branch_address} <span className="text-[var(--text-muted)] font-normal">({s.optional})</span>
              </label>
              <input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder={lang === 'bm' ? 'No. X, Jalan …' : 'No. X, Jalan …'}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">
                {s.branch_phone} <span className="text-[var(--text-muted)] font-normal">({s.optional})</span>
              </label>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="03-XXXX XXXX"
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.branch_status}</label>
              <div className="flex gap-2">
                {(['active', 'inactive'] as Branch['status'][]).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, status: st }))}
                    className={`flex-1 py-2 rounded-md text-xs font-medium border transition-all ${
                      form.status === st
                        ? st === 'active'
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-[var(--surface-3,#e5e7eb)] border-[var(--border-2)] text-[var(--text-muted)]'
                        : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)]'
                    }`}
                  >
                    {st === 'active' ? `🟢 ${s.branch_active}` : `⚪ ${s.branch_inactive}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 mt-4">
            <Button variant="secondary" className="flex-1" onClick={() => { setShowForm(false); resetForm() }}>
              {s.cancel}
            </Button>
            <Button className="flex-1" loading={saving} onClick={handleSave}>
              {s.save}
            </Button>
          </div>
        </Card>
      )}

      {/* Branch list */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">{s.loading}</div>
      ) : branches.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">{s.no_branches}</div>
      ) : (
        <div className="space-y-3">
          {branches.map(b => (
            <div
              key={b.id}
              className={`flex items-start gap-4 p-4 bg-[var(--surface)] border rounded-xl transition-colors ${
                b.status === 'inactive'
                  ? 'border-[var(--border)] opacity-60'
                  : 'border-[var(--border)] hover:border-[var(--border-2)]'
              }`}
            >
              {/* Icon */}
              <div className="w-11 h-11 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-2xl flex-shrink-0">
                🏪
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[var(--text)]">{b.name}</span>
                  <Badge variant={b.status === 'active' ? 'success' : 'neutral'}>
                    {b.status === 'active' ? s.branch_active : s.branch_inactive}
                  </Badge>
                </div>
                {b.address && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">📍 {b.address}</p>
                )}
                {b.phone && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">📞 {b.phone}</p>
                )}
              </div>

              {/* Actions (owner only) */}
              {isOwner && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(b)}
                    className="text-[var(--text-muted)] hover:text-brand-500 transition-colors p-1.5 rounded-md hover:bg-brand-50 dark:hover:bg-brand-900/20 text-sm"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    disabled={deleting === b.id}
                    className="text-[var(--text-muted)] hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
                  >
                    {deleting === b.id ? '…' : '🗑'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
