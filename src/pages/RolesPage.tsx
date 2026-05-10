import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import * as db from '../lib/db'
import { supabaseConfigured } from '../lib/supabase'
import { CONFIGURABLE_FEATURES } from '../utils/permissions'
import type { CustomRole, FeatureKey, User } from '../types'

const STAFF_FEATURES: FeatureKey[]      = ['home', 'tasks', 'google-review', 'history']
const SUPERVISOR_FEATURES: FeatureKey[] = ['dashboard', 'review', 'schedule', 'maintenance', 'loans', 'tasks-admin', 'assets']

function FeatureCheckbox({
  featureKey, checked, disabled, onChange, label,
}: { featureKey: FeatureKey; checked: boolean; disabled: boolean; onChange: (k: FeatureKey, v: boolean) => void; label: string }) {
  return (
    <label className={`flex items-center gap-2 py-1 cursor-pointer ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(featureKey, e.target.checked)}
        className="w-4 h-4 accent-brand-600"
      />
      <span className="text-sm text-[var(--text)]">{label}</span>
    </label>
  )
}

const blank = { name: '', baseRole: 'supervisor' as 'staff' | 'supervisor', features: [] as FeatureKey[] }

export default function RolesPage() {
  const { state, dispatch } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]

  const [users, setUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...blank })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState(false)

  const customRoles = state.customRoles

  useEffect(() => {
    if (supabaseConfigured) {
      db.fetchUsers().then(u => { if (u) setUsers(u) })
    }
  }, [])

  const resetForm = () => { setForm({ ...blank }); setEditId(null); setError(''); setNameError(false) }

  const openAdd = () => { resetForm(); setShowForm(true) }

  const openEdit = (r: CustomRole) => {
    setForm({ name: r.name, baseRole: r.baseRole, features: [...r.features] })
    setEditId(r.id)
    setShowForm(true)
  }

  const toggleFeature = (key: FeatureKey, checked: boolean) => {
    setForm(f => ({
      ...f,
      features: checked ? [...f.features, key] : f.features.filter(k => k !== key),
    }))
  }

  const handleSave = async () => {
    setError('')
    setNameError(false)
    if (!form.name.trim()) {
      setNameError(true)
      setError(lang === 'bm' ? 'Sila masukkan nama peranan.' : 'Please enter a role name.')
      return
    }
    setSaving(true)

    if (editId) {
      const ok = await db.updateCustomRole(editId, { name: form.name.trim(), features: form.features })
      if (ok) {
        dispatch({ type: 'UPDATE_CUSTOM_ROLE', id: editId, updates: { name: form.name.trim(), features: form.features } })
        setMsg(s.role_saved)
      }
    } else {
      const saved = await db.insertCustomRole({ name: form.name.trim(), baseRole: form.baseRole, features: form.features })
      if (saved) {
        dispatch({ type: 'ADD_CUSTOM_ROLE', role: saved })
        setMsg(s.role_added)
      } else {
        setError(s.save_failed); setSaving(false); return
      }
    }

    setSaving(false)
    setShowForm(false)
    resetForm()
    setTimeout(() => setMsg(''), 3000)
  }

  const handleDelete = async (r: CustomRole) => {
    const assignedCount = users.filter(u => u.customRoleId === r.id).length
    const confirmMsg = assignedCount > 0
      ? `${r.name} — ${s.confirm_del_role} (${assignedCount} ${s.role_users_assigned})`
      : `${r.name} — ${s.confirm_del_role}`
    if (!confirm(confirmMsg)) return
    await db.deleteCustomRole(r.id)
    dispatch({ type: 'DELETE_CUSTOM_ROLE', id: r.id })
    setMsg(s.role_deleted)
    setTimeout(() => setMsg(''), 3000)
  }

  const isEdit = editId !== null

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">🔐 {s.roles_title}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{s.roles_subtitle}</p>
        </div>
        {!showForm && (
          <Button onClick={openAdd}>+ {s.add_role}</Button>
        )}
      </div>

      {/* Toast */}
      {msg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg px-4 py-3">
          ✅ {msg}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <Card>
          <h3 className="font-bold text-sm text-[var(--text)] mb-4">
            {isEdit ? `✏️ ${s.edit_role}` : `+ ${s.add_role}`}
          </h3>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">
                {s.role_name_label} <span className="text-red-500">*</span>
              </label>
              <input
                value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setNameError(false) }}
                placeholder={s.role_name_ph}
                className={`w-full bg-[var(--surface-2)] border rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none transition-colors ${
                  nameError ? 'border-red-400 focus:border-red-500' : 'border-[var(--border)] focus:border-brand-400'
                }`}
              />
              {nameError && (
                <p className="text-xs text-red-500 mt-1">
                  {lang === 'bm' ? 'Nama peranan diperlukan.' : 'Role name is required.'}
                </p>
              )}
            </div>

            {/* Base role — read-only when editing */}
            {!isEdit && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-soft)] mb-2">{s.role_base_label}</label>
                <div className="flex gap-2">
                  {(['staff', 'supervisor'] as const).map(br => (
                    <button
                      key={br}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, baseRole: br, features: [] }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                        form.baseRole === br
                          ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-400 text-brand-700 dark:text-brand-300'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      {br === 'staff' ? `👤 ${s.role_staff}` : `🔍 ${s.role_supervisor}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Feature checkboxes */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-2">{s.role_features_label}</label>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0 bg-[var(--surface-2)] rounded-lg px-4 py-3">
                {/* Staff basics group */}
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">{s.role_feat_staff_group}</p>
                  {STAFF_FEATURES.filter(k => CONFIGURABLE_FEATURES.includes(k)).map(k => (
                    <FeatureCheckbox
                      key={k} featureKey={k} checked={form.features.includes(k)}
                      disabled={false}
                      onChange={toggleFeature}
                      label={s[`feat_${k}`] ?? k}
                    />
                  ))}
                </div>
                {/* Supervisor group */}
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">{s.role_feat_sup_group}</p>
                  {SUPERVISOR_FEATURES.map(k => (
                    <FeatureCheckbox
                      key={k} featureKey={k} checked={form.features.includes(k)}
                      disabled={form.baseRole === 'staff'}
                      onChange={toggleFeature}
                      label={s[`feat_${k}`] ?? k}
                    />
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1.5 px-1">
                Tetapan & akses asas sentiasa aktif.
              </p>
            </div>
          </div>

          {error && <p className="mt-3 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">{error}</p>}

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

      {/* Roles list */}
      {customRoles.length === 0 && !showForm ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">{s.no_roles}</div>
      ) : (
        <div className="space-y-3">
          {customRoles.map(r => {
            const assignedUsers = users.filter(u => u.customRoleId === r.id)
            return (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[var(--text)]">{r.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        r.baseRole === 'supervisor'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          : 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                      }`}>
                        {r.baseRole === 'supervisor' ? s.role_supervisor : s.role_staff}
                      </span>
                      {assignedUsers.length > 0 && (
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {assignedUsers.length} {s.role_users_assigned}
                        </span>
                      )}
                    </div>
                    {r.features.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {r.features.map(k => (
                          <span key={k} className="text-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[var(--text-muted)]">
                            {STRINGS[lang][`feat_${k}`] ?? k}
                          </span>
                        ))}
                      </div>
                    )}
                    {assignedUsers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {assignedUsers.map(u => (
                          <span key={u.id} className="text-[10px] flex items-center gap-1 bg-[var(--surface-2)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[var(--text-muted)]">
                            {u.avatar} {u.name.split(' ')[0]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { openEdit(r); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className="text-[var(--text-muted)] hover:text-brand-500 transition-colors p-1.5 rounded-md hover:bg-brand-50 dark:hover:bg-brand-900/20"
                      title={s.edit_role}
                    >✏️</button>
                    <button
                      onClick={() => handleDelete(r)}
                      className="text-[var(--text-muted)] hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                      title={s.role_deleted}
                    >🗑</button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
