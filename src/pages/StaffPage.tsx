import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import * as db from '../lib/db'
import { supabaseConfigured } from '../lib/supabase'
import { USERS as MOCK_USERS, BRANCHES as MOCK_BRANCHES } from '../data/mockData'
import type { Branch, ShiftId, User } from '../types'

const AVATARS = ['🧑‍🍳','👩‍🍳','👨‍🍳','🧑‍💼','👨‍💼','👩‍💼','🧑','👩','👦','👧','🙂','😊']

const ROLE_BADGE: Record<string, 'success' | 'info' | 'warning'> = {
  staff: 'info',
  supervisor: 'warning',
  owner: 'success',
}

const SHIFT_OPTIONS: { id: ShiftId | ''; label: string }[] = [
  { id: '',        label: '— Tiada (pilih sendiri)' },
  { id: 'morning', label: '☀️ Shift Pagi' },
  { id: 'evening', label: '🌙 Shift Petang' },
]

const blank = {
  name: '', role: 'staff' as User['role'], branch: '', username: '', avatar: '🧑‍🍳', defaultShift: '' as ShiftId | '',
}

export default function StaffPage() {
  const { state } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]
  const isOwner    = state.user?.role === 'owner'
  const canManage  = isOwner || state.user?.role === 'supervisor'

  const [users, setUsers]         = useState<User[]>([])
  const [branches, setBranches]   = useState<Branch[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [form, setForm]           = useState({ ...blank })
  const [saving, setSaving]       = useState(false)
  const [resettingPin, setResettingPin] = useState<string | null>(null)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [deleting, setDeleting]   = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [userData, branchData] = await Promise.all([
        supabaseConfigured ? db.fetchUsers()    : Promise.resolve(MOCK_USERS),
        supabaseConfigured ? db.fetchBranches() : Promise.resolve(MOCK_BRANCHES),
      ])
      setUsers(userData ?? MOCK_USERS)
      setBranches(branchData ?? MOCK_BRANCHES)
      setLoading(false)
    })()
  }, [])

  const resetForm = () => {
    setForm({ ...blank }); setEditId(null); setError('')
  }

  const openAdd = () => { resetForm(); setShowForm(true) }

  const openEdit = (u: User) => {
    setForm({ name: u.name, role: u.role, branch: u.branch, username: u.username, avatar: u.avatar, defaultShift: u.defaultShift ?? '' })
    setEditId(u.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    setError('')

    const isEdit = editId !== null

    if (!form.name.trim() || !form.branch.trim()) { setError(s.fill_all); return }
    if (!/^[\p{L}\s'.,-]{2,60}$/u.test(form.name.trim())) {
      setError('Nama tidak sah. Guna huruf sahaja (2–60 aksara).'); return
    }

    if (!isEdit) {
      if (!form.username.trim()) { setError(s.fill_all); return }
      if (!/^[a-z0-9._]{3,30}$/.test(form.username.toLowerCase())) {
        setError(s.username_invalid); return
      }
      if (users.some(u => u.username === form.username.toLowerCase())) {
        setError(s.username_taken); return
      }
    }

    setSaving(true)

    if (isEdit) {
      const updates = { name: form.name.trim(), role: form.role, branch: form.branch, avatar: form.avatar, default_shift: form.defaultShift || null }
      if (supabaseConfigured) await db.updateUser(editId, updates)
      const { default_shift, ...rest } = updates
      setUsers(prev => prev.map(u => u.id === editId ? { ...u, ...rest, defaultShift: (default_shift as ShiftId) || undefined } : u))
      setSuccess(s.staff_saved)
    } else {
      let newUser: User | null = null
      if (supabaseConfigured) {
        newUser = await db.registerUser(
          { name: form.name.trim(), role: form.role, branch: form.branch, avatar: form.avatar, username: form.username.toLowerCase() }
        )
      } else {
        newUser = { id: `mock_${Date.now()}`, name: form.name.trim(), role: form.role, branch: form.branch, avatar: form.avatar, username: form.username.toLowerCase() }
      }
      if (!newUser) { setError('Gagal mendaftar. Cuba lagi.'); setSaving(false); return }
      setUsers(prev => [...prev, newUser!].sort((a, b) => a.name.localeCompare(b.name)))
      setSuccess(s.staff_added)
    }

    setSaving(false)
    setShowForm(false)
    resetForm()
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(s.confirm_delete)) return
    setDeleting(id)
    if (supabaseConfigured) await db.deleteUser(id)
    setUsers(prev => prev.filter(u => u.id !== id))
    setDeleting(null)
  }

  const handleResetPin = async (u: User) => {
    if (!confirm(`Reset PIN untuk ${u.name}? Mereka perlu tetapkan PIN baru semasa log masuk.`)) return
    setResettingPin(u.id)
    if (supabaseConfigured) await db.resetUserPin(u.id, u.branch)
    setResettingPin(null)
    setSuccess(`PIN ${u.name} telah diset semula.`)
    setTimeout(() => setSuccess(''), 3000)
  }

  const canEditUser = (u: User) => {
    if (u.id === state.user?.id) return false      // can't edit self
    if (u.role === 'owner' && !isOwner) return false  // only owner can edit owner
    return canManage
  }

  const isEdit = editId !== null

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">{s.staff_mgmt}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {users.length} {s.registered}
          </p>
        </div>
        {!showForm && (
          <Button onClick={openAdd}>+ {s.add_staff}</Button>
        )}
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
            {isEdit ? `✏️ ${s.edit_staff}` : `+ ${s.add_staff}`}
          </h3>

          {/* Avatar picker */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-[var(--text-soft)] mb-2">{s.avatar_label}</label>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, avatar: emoji }))}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                    form.avatar === emoji
                      ? 'bg-brand-100 dark:bg-brand-900/40 ring-2 ring-brand-500 scale-110'
                      : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3,#f0f0f0)]'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.full_name}</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: Ahmad bin Razali"
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.role_label}</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as User['role'] }))}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-brand-400 transition-colors"
              >
                <option value="staff">{s.role_staff}</option>
                <option value="supervisor">{s.role_supervisor}</option>
                {isOwner && <option value="owner">{s.role_owner}</option>}
              </select>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.branch_label}</label>
              <select
                value={form.branch}
                onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-brand-400 transition-colors"
              >
                <option value="">{s.select_branch}</option>
                {branches.filter(b => b.status === 'active').map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Default shift */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">
                {lang === 'bm' ? 'Shift Tetap' : 'Default Shift'}
              </label>
              <select
                value={form.defaultShift}
                onChange={e => setForm(f => ({ ...f, defaultShift: e.target.value as ShiftId | '' }))}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-brand-400 transition-colors"
              >
                {SHIFT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                {lang === 'bm' ? 'Staff akan terus masuk tanpa perlu pilih shift semasa login' : 'Staff will skip shift selection on login'}
              </p>
            </div>

            {/* Username — editable when adding, read-only when editing */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.username}</label>
              <input
                value={form.username}
                readOnly={isEdit}
                onChange={e => !isEdit && setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '') }))}
                placeholder="contoh: ahmad.razali"
                autoCapitalize="none"
                className={`w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm placeholder:text-[var(--text-muted)] outline-none transition-colors font-mono ${
                  isEdit
                    ? 'text-[var(--text-muted)] cursor-not-allowed opacity-60'
                    : 'text-[var(--text)] focus:border-brand-400'
                }`}
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                {isEdit ? s.username_readonly : s.username_invalid}
              </p>
            </div>
          </div>

          {!isEdit && (
            <p className="mt-3 text-xs text-[var(--text-muted)] bg-[var(--surface-2)] rounded px-3 py-2">
              🔐 Staff akan tetapkan PIN sendiri semasa log masuk pertama kali.
            </p>
          )}

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

      {/* Staff list */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">{s.loading}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {users.map(u => (
            <div
              key={u.id}
              className="flex items-center gap-3 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-[var(--border-2)] transition-colors"
            >
              {/* Avatar */}
              <div className="w-11 h-11 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-2xl flex-shrink-0">
                {u.avatar}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[var(--text)] truncate">{u.name}</span>
                  <Badge variant={ROLE_BADGE[u.role] ?? 'info'}>
                    {u.role === 'staff' ? s.role_staff : u.role === 'supervisor' ? s.role_supervisor : s.role_owner}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-xs text-[var(--text-muted)]">📍 {u.branch}</span>
                  <span className="text-xs text-[var(--text-muted)] font-mono">@{u.username}</span>
                  {u.defaultShift
                    ? <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{u.defaultShift === 'morning' ? '☀️ Pagi' : '🌙 Petang'}</span>
                    : <span className="text-xs text-[var(--text-muted)]">🔄 Pilih shift</span>
                  }
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {canEditUser(u) && u.telegramId && (
                  <button
                    onClick={async () => {
                      if (!confirm('Buang pautan Telegram untuk ' + u.name + '?')) return
                      if (supabaseConfigured) await db.clearTelegramId(u.id)
                      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, telegramId: undefined } : x))
                    }}
                    className="text-[var(--text-muted)] hover:text-sky-500 transition-colors p-1.5 rounded-md hover:bg-sky-50 dark:hover:bg-sky-900/20"
                    title="Buang pautan Telegram"
                  >
                    ✈️
                  </button>
                )}
                {canEditUser(u) && (
                  <button
                    onClick={() => handleResetPin(u)}
                    disabled={resettingPin === u.id}
                    className="text-[var(--text-muted)] hover:text-amber-500 transition-colors p-1.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    title="Reset PIN"
                  >
                    {resettingPin === u.id ? '…' : '🔑'}
                  </button>
                )}
                {canEditUser(u) && (
                  <button
                    onClick={() => { openEdit(u); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    className="text-[var(--text-muted)] hover:text-brand-500 transition-colors p-1.5 rounded-md hover:bg-brand-50 dark:hover:bg-brand-900/20"
                    title={s.edit_staff}
                  >
                    ✏️
                  </button>
                )}
                {isOwner && u.id !== state.user?.id && (
                  <button
                    onClick={() => handleDelete(u.id)}
                    disabled={deleting === u.id}
                    className="text-[var(--text-muted)] hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                    title={s.delete_staff}
                  >
                    {deleting === u.id ? '…' : '🗑'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
