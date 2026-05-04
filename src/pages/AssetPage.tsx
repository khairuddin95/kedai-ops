import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import * as db from '../lib/db'
import { supabaseConfigured } from '../lib/supabase'
import { ASSETS as MOCK_ASSETS, BRANCHES as MOCK_BRANCHES } from '../data/mockData'
import type { Asset, AssetCondition, Branch } from '../types'

const CATEGORIES = [
  'Peralatan Dapur',
  'Perabot',
  'Elektronik',
  'Peralatan Kebersihan',
  'Keselamatan',
  'Lain-lain',
]

const CONDITION_BADGE: Record<AssetCondition, 'success' | 'warning' | 'danger'> = {
  good: 'success',
  fair: 'warning',
  poor: 'danger',
}

const CONDITION_ICON: Record<AssetCondition, string> = {
  good: '✅',
  fair: '⚠️',
  poor: '🔴',
}

const blankForm = {
  name: '', category: CATEGORIES[0], quantity: 1,
  condition: 'good' as AssetCondition, branch: '', notes: '',
}

export default function AssetPage() {
  const { state } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]
  const canEdit = state.user?.role === 'supervisor' || state.user?.role === 'owner'
  const isOwner = state.user?.role === 'owner'

  const [assets, setAssets]       = useState<Asset[]>([])
  const [branches, setBranches]   = useState<Branch[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [form, setForm]           = useState({ ...blankForm })
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterCond, setFilterCond] = useState('')
  const [search, setSearch]       = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [assetData, branchData] = await Promise.all([
        supabaseConfigured ? db.fetchAssets()    : Promise.resolve(MOCK_ASSETS),
        supabaseConfigured ? db.fetchBranches()  : Promise.resolve(MOCK_BRANCHES),
      ])
      setAssets(assetData ?? MOCK_ASSETS)
      setBranches(branchData ?? MOCK_BRANCHES)
      setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => {
    return assets.filter(a => {
      if (filterCat  && a.category  !== filterCat)  return false
      if (filterCond && a.condition !== filterCond)  return false
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [assets, filterCat, filterCond, search])

  const stats = useMemo(() => ({
    total:    assets.reduce((s, a) => s + a.quantity, 0),
    items:    assets.length,
    good:     assets.filter(a => a.condition === 'good').length,
    poor:     assets.filter(a => a.condition === 'poor').length,
  }), [assets])

  const resetForm = () => {
    setForm({ ...blankForm, branch: state.user?.branch ?? '' })
    setEditId(null); setError('')
  }

  const openAdd = () => {
    resetForm()
    setShowForm(true)
  }

  const openEdit = (a: Asset) => {
    setForm({
      name: a.name, category: a.category, quantity: a.quantity,
      condition: a.condition, branch: a.branch, notes: a.notes ?? '',
    })
    setEditId(a.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    setError('')
    if (!form.name.trim() || !form.branch.trim()) { setError(s.fill_all); return }
    if (form.quantity < 1) { setError('Bilangan mestilah sekurang-kurangnya 1.'); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(), category: form.category, quantity: form.quantity,
      condition: form.condition, branch: form.branch.trim(),
      notes: form.notes.trim() || undefined,
      lastChecked: new Date().toISOString().slice(0, 10),
    }

    if (editId) {
      if (supabaseConfigured) await db.updateAsset(editId, payload)
      setAssets(prev => prev.map(a => a.id === editId ? { ...a, ...payload } : a))
      setSuccess(s.asset_saved)
    } else {
      let newAsset: Asset | null = null
      if (supabaseConfigured) {
        newAsset = await db.insertAsset(payload)
      } else {
        newAsset = { id: `mock_${Date.now()}`, ...payload }
      }
      if (!newAsset) { setError('Gagal menyimpan. Cuba lagi.'); setSaving(false); return }
      setAssets(prev => [...prev, newAsset!].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)))
      setSuccess(s.asset_added)
    }

    setSaving(false)
    setShowForm(false)
    resetForm()
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(s.confirm_del_asset)) return
    setDeleting(id)
    if (supabaseConfigured) await db.deleteAsset(id)
    setAssets(prev => prev.filter(a => a.id !== id))
    setDeleting(null)
  }

  const handleMarkChecked = async (a: Asset) => {
    const today = new Date().toISOString().slice(0, 10)
    if (supabaseConfigured) await db.updateAsset(a.id, { lastChecked: today })
    setAssets(prev => prev.map(x => x.id === a.id ? { ...x, lastChecked: today } : x))
  }

  const conditionLabel = (c: AssetCondition) =>
    c === 'good' ? s.condition_good : c === 'fair' ? s.condition_fair : s.condition_poor

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">{s.asset_mgmt}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{stats.items} jenis · {stats.total} unit jumlah</p>
        </div>
        {canEdit && !showForm && (
          <Button onClick={openAdd}>+ {s.add_asset}</Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: s.total_assets,  value: stats.total,  icon: '📦', color: 'text-brand-600' },
          { label: lang === 'bm' ? 'Jenis Aset' : 'Asset Types', value: stats.items,  icon: '🗂️', color: 'text-indigo-600' },
          { label: s.assets_good,   value: stats.good,   icon: '✅', color: 'text-emerald-600' },
          { label: s.assets_poor,   value: stats.poor,   icon: '🔴', color: 'text-red-600' },
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
            {editId ? `✏️ ${s.edit_asset}` : `+ ${s.add_asset}`}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.asset_name}</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={s.asset_placeholder}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.asset_category}</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-brand-400 transition-colors"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.asset_branch}</label>
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

            {/* Quantity */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.asset_quantity}</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-brand-400 transition-colors"
              />
            </div>

            {/* Condition */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.asset_condition}</label>
              <div className="flex gap-2">
                {(['good', 'fair', 'poor'] as AssetCondition[]).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, condition: c }))}
                    className={`flex-1 py-2 rounded-md text-xs font-medium border transition-all ${
                      form.condition === c
                        ? c === 'good'
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : c === 'fair'
                          ? 'bg-amber-100 border-amber-400 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-red-100 border-red-400 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)]'
                    }`}
                  >
                    {CONDITION_ICON[c]} {conditionLabel(c)}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">
                {s.asset_notes} <span className="text-[var(--text-muted)] font-normal">({s.optional})</span>
              </label>
              <input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={lang === 'bm' ? 'Catatan tambahan…' : 'Additional notes…'}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
              />
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === 'bm' ? 'Cari aset…' : 'Search assets…'}
          className="flex-1 min-w-[160px] bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
        />
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-brand-400 transition-colors"
        >
          <option value="">{s.all_categories}</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterCond}
          onChange={e => setFilterCond(e.target.value)}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-brand-400 transition-colors"
        >
          <option value="">{s.all_conditions}</option>
          <option value="good">{s.condition_good}</option>
          <option value="fair">{s.condition_fair}</option>
          <option value="poor">{s.condition_poor}</option>
        </select>
      </div>

      {/* Asset list */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">{s.loading}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">{s.no_assets}</div>
      ) : (
        <div className="space-y-1">
          {/* Group by category */}
          {CATEGORIES.filter(cat => filtered.some(a => a.category === cat)).map(cat => (
            <div key={cat} className="mb-4">
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2 px-1">{cat}</h4>
              <div className="space-y-2">
                {filtered.filter(a => a.category === cat).map(a => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 p-3.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-[var(--border-2)] transition-colors"
                  >
                    {/* Condition dot */}
                    <div className="text-xl flex-shrink-0">{CONDITION_ICON[a.condition]}</div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[var(--text)]">{a.name}</span>
                        <Badge variant={CONDITION_BADGE[a.condition]}>
                          {conditionLabel(a.condition)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400">
                          {a.quantity} {s.qty_label}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">📍 {a.branch}</span>
                        {a.lastChecked && (
                          <span className="text-xs text-[var(--text-muted)]">🗓 {a.lastChecked}</span>
                        )}
                      </div>
                      {a.notes && (
                        <p className="text-xs text-[var(--text-muted)] mt-1 italic">{a.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    {canEdit && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleMarkChecked(a)}
                          title={s.check_today}
                          className="text-[var(--text-muted)] hover:text-emerald-500 transition-colors p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-sm"
                        >
                          ☑️
                        </button>
                        <button
                          onClick={() => openEdit(a)}
                          className="text-[var(--text-muted)] hover:text-brand-500 transition-colors p-1.5 rounded-md hover:bg-brand-50 dark:hover:bg-brand-900/20 text-sm"
                        >
                          ✏️
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleDelete(a.id)}
                            disabled={deleting === a.id}
                            className="text-[var(--text-muted)] hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
                          >
                            {deleting === a.id ? '…' : '🗑'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
