import { useState, useEffect, useRef, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { STRINGS, langLocale } from '../utils/i18n'
import { supabaseConfigured } from '../lib/supabase'
import * as db from '../lib/db'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import type { MaintenanceCategory, MaintenancePriority, MaintenanceReport, MaintenanceStatus } from '../types'

const CAT_ICON: Record<MaintenanceCategory, string> = {
  equipment: '🔧', facility: '🏗️', electrical: '⚡', plumbing: '🚿', other: '📝',
}

const PRIORITY_VARIANT: Record<MaintenancePriority, 'neutral' | 'warning' | 'danger' | 'purple'> = {
  low: 'neutral', medium: 'warning', high: 'danger', critical: 'purple',
}

const STATUS_VARIANT: Record<MaintenanceStatus, 'info' | 'warning' | 'success'> = {
  open: 'info', in_progress: 'warning', resolved: 'success',
}

const blank = { title: '', category: 'equipment' as MaintenanceCategory, description: '', priority: 'medium' as MaintenancePriority }

export default function MaintenancePage() {
  const { state } = useApp()
  const s = STRINGS[state.lang]
  const user = state.user!
  const canManage = user.role === 'supervisor' || user.role === 'owner'

  const [reports, setReports]     = useState<MaintenanceReport[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ ...blank })
  const [formPhotos, setFormPhotos] = useState<{ file: File; preview: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [filterStatus, setFilter] = useState<MaintenanceStatus | 'all'>('all')
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({})
  const [notes, setNotes]         = useState<Record<string, string>>({})
  const [updating, setUpdating]   = useState<string | null>(null)
  const [lightbox, setLightbox]   = useState<string | null>(null)
  const [toast, setToast]         = useState('')
  const [errorToast, setErrorToast] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formPhotosRef = useRef(formPhotos)
  formPhotosRef.current = formPhotos

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const showError = (msg: string) => { setErrorToast(msg); setTimeout(() => setErrorToast(''), 4000) }

  // Revoke any leftover preview URLs on unmount
  useEffect(() => {
    return () => {
      formPhotosRef.current.forEach(p => URL.revokeObjectURL(p.preview))
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const branch = user.role === 'supervisor' ? user.branch : undefined
      const data = supabaseConfigured ? await db.fetchMaintenanceReports(branch) : []
      setReports(data ?? [])
      const initNotes: Record<string, string> = {}
      for (const r of data ?? []) initNotes[r.id] = r.supervisorNotes ?? ''
      setNotes(initNotes)
      setLoading(false)
    })()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const remaining = 5 - formPhotos.length
    const toAdd = files.slice(0, remaining).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setFormPhotos(prev => [...prev, ...toAdd])
    e.target.value = ''
  }

  const removeFormPhoto = (i: number) => {
    setFormPhotos(prev => {
      URL.revokeObjectURL(prev[i].preview)
      return prev.filter((_, j) => j !== i)
    })
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    setUploading(formPhotos.length > 0)

    // Insert report first to get the ID, then upload photos
    const tempId = `maint_${Date.now()}`
    let photoUrls: string[] = []

    if (supabaseConfigured) {
      // Insert with empty photos, get the real ID, then upload
      const draft = await db.insertMaintenanceReport({
        title: form.title.trim(), category: form.category,
        description: form.description.trim(), priority: form.priority,
        reportedById: user.id, reportedByName: user.name,
        reportedByAvatar: user.avatar, branch: user.branch,
        status: 'open', photos: [],
      })
      if (!draft) { setSaving(false); setUploading(false); showError(s.submit_failed); return }

      if (formPhotos.length > 0) {
        const uploads = await Promise.all(
          formPhotos.map(p => db.uploadMaintenancePhoto(p.file, draft.id))
        )
        photoUrls = uploads.filter(Boolean) as string[]
        if (photoUrls.length < formPhotos.length) {
          showError(s.photo_upload_partial)
        }
        if (photoUrls.length > 0) {
          await db.updateMaintenanceReport(draft.id, { photos: photoUrls })
        }
      }

      const finalReport = { ...draft, photos: photoUrls }
      setReports(prev => [finalReport, ...prev])
      setNotes(prev => ({ ...prev, [draft.id]: '' }))
    } else {
      const newReport: MaintenanceReport = {
        id: tempId, title: form.title.trim(), category: form.category,
        description: form.description.trim(), priority: form.priority, status: 'open',
        reportedById: user.id, reportedByName: user.name, reportedByAvatar: user.avatar,
        branch: user.branch, reportedAt: new Date(), photos: [],
      }
      setReports(prev => [newReport, ...prev])
      setNotes(prev => ({ ...prev, [tempId]: '' }))
    }

    formPhotos.forEach(p => URL.revokeObjectURL(p.preview))
    setFormPhotos([])
    setSaving(false)
    setUploading(false)
    setForm({ ...blank })
    setShowForm(false)
    showToast(s.maint_submitted)
  }

  const handleUpdateStatus = async (r: MaintenanceReport, status: MaintenanceStatus) => {
    setUpdating(r.id)
    const resolvedAt = status === 'resolved' ? new Date() : status === 'open' ? null : undefined
    const ok = supabaseConfigured
      ? await db.updateMaintenanceReport(r.id, { status, supervisorNotes: notes[r.id] ?? '', resolvedAt })
      : true
    if (ok) {
      setReports(prev => prev.map(x => x.id === r.id
        ? { ...x, status, supervisorNotes: notes[r.id], resolvedAt: resolvedAt ?? x.resolvedAt }
        : x
      ))
      showToast(s.maint_updated)
    } else {
      showError(s.update_failed)
    }
    setUpdating(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(s.confirm_del_report)) return
    if (supabaseConfigured) {
      const ok = await db.deleteMaintenanceReport(id)
      if (!ok) { showError(s.update_failed); return }
    }
    setReports(prev => prev.filter(r => r.id !== id))
  }

  const { filtered, counts } = useMemo(() => ({
    filtered: filterStatus === 'all' ? reports : reports.filter(r => r.status === filterStatus),
    counts: {
      all:         reports.length,
      open:        reports.filter(r => r.status === 'open').length,
      in_progress: reports.filter(r => r.status === 'in_progress').length,
      resolved:    reports.filter(r => r.status === 'resolved').length,
    },
  }), [reports, filterStatus])

  const filterPills: { key: MaintenanceStatus | 'all'; label: string }[] = [
    { key: 'all',         label: `${s.all} (${counts.all})` },
    { key: 'open',        label: `${s.status_open} (${counts.open})` },
    { key: 'in_progress', label: `${s.status_in_progress} (${counts.in_progress})` },
    { key: 'resolved',    label: `${s.status_resolved} (${counts.resolved})` },
  ]

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">{s.maintenance_report}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{reports.length} {s.report_count}</p>
        </div>
        {!showForm && (
          <Button onClick={() => { setShowForm(true); setForm({ ...blank }); setFormPhotos([]) }}>
            + {s.new_report}
          </Button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg px-4 py-3">
          ✅ {toast}
        </div>
      )}
      {errorToast && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
          ⚠️ {errorToast}
        </div>
      )}

      {/* New report form */}
      {showForm && (
        <Card>
          <h3 className="font-bold text-sm text-[var(--text)] mb-4">+ {s.new_report}</h3>
          <div className="space-y-3">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.maint_title}</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder={s.maint_title_ph}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.maint_category}</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value as MaintenanceCategory }))}
                  className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-brand-400 transition-colors"
                >
                  <option value="equipment">{s.cat_equipment}</option>
                  <option value="facility">{s.cat_facility}</option>
                  <option value="electrical">{s.cat_electrical}</option>
                  <option value="plumbing">{s.cat_plumbing}</option>
                  <option value="other">{s.cat_other}</option>
                </select>
              </div>
              {/* Priority */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.maint_priority}</label>
                <select
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value as MaintenancePriority }))}
                  className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-brand-400 transition-colors"
                >
                  <option value="low">{s.priority_low}</option>
                  <option value="medium">{s.priority_medium}</option>
                  <option value="high">{s.priority_high}</option>
                  <option value="critical">{s.priority_critical}</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.maint_description}</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={s.maint_description_ph}
                rows={3}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors resize-none"
              />
            </div>

            {/* Photo upload */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">
                {s.maint_photos} <span className="text-[var(--text-muted)]">({formPhotos.length}/5)</span>
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {formPhotos.map((p, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-[var(--surface-2)]">
                    <img src={p.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFormPhoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full text-white text-xs flex items-center justify-center hover:bg-black/80"
                    >×</button>
                  </div>
                ))}
                {formPhotos.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-[var(--border-2)] flex flex-col items-center justify-center gap-0.5 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors"
                  >
                    <span className="text-xl text-[var(--text-muted)]">📷</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{s.maint_add_photo}</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="secondary" className="flex-1" onClick={() => { setShowForm(false); formPhotos.forEach(p => URL.revokeObjectURL(p.preview)); setFormPhotos([]) }}>{s.cancel}</Button>
            <Button className="flex-1" loading={saving} disabled={!form.title.trim()} onClick={handleSubmit}>
              {uploading ? s.maint_uploading : s.save}
            </Button>
          </div>
        </Card>
      )}

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filterPills.map(p => (
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

      {/* Report list */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">{s.loading}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          <div className="text-4xl mb-2">🔧</div>
          {s.no_maintenance}
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
                <span className="text-2xl mt-0.5 flex-shrink-0">{CAT_ICON[r.category]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-[var(--text)]">{r.title}</span>
                    <Badge variant={PRIORITY_VARIANT[r.priority]}>
                      {s[`priority_${r.priority}` as keyof typeof s]}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[r.status]}>
                      {s[`status_${r.status}` as keyof typeof s]}
                    </Badge>
                    {r.photos.length > 0 && (
                      <span className="text-xs text-[var(--text-muted)]">📷 {r.photos.length}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-[var(--text-muted)]">{r.reportedByAvatar} {r.reportedByName}</span>
                    <span className="text-xs text-[var(--text-muted)]">📍 {r.branch}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {r.reportedAt.toLocaleDateString(langLocale(state.lang), { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <span className="text-[var(--text-muted)] text-sm flex-shrink-0" style={{ transform: expanded[r.id] ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>›</span>
              </button>

              {/* Expanded */}
              {expanded[r.id] && (
                <div className="border-t border-[var(--border)] px-4 py-4 bg-[var(--surface-2)] space-y-4">
                  {/* Description */}
                  {r.description && (
                    <p className="text-sm text-[var(--text-soft)]">{r.description}</p>
                  )}

                  {/* Photos */}
                  {r.photos.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-[var(--text-soft)] mb-2">📷 {s.maint_photos}</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {r.photos.map((url, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setLightbox(url)}
                            className="aspect-square rounded-lg overflow-hidden bg-[var(--surface)] hover:opacity-90 transition-opacity"
                          >
                            <img src={url} alt={`foto ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Supervisor notes read-only */}
                  {r.supervisorNotes && !canManage && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">{s.maint_notes}</p>
                      <p className="text-sm text-[var(--text)]">{r.supervisorNotes}</p>
                    </div>
                  )}

                  {/* Resolved timestamp */}
                  {r.resolvedAt && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      ✅ {s.resolved_on} {r.resolvedAt.toLocaleDateString(langLocale(state.lang), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}

                  {/* Supervisor controls */}
                  {canManage && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.maint_notes}</label>
                        <textarea
                          value={notes[r.id] ?? ''}
                          onChange={e => setNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder={s.maint_notes_ph}
                          rows={2}
                          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors resize-none"
                        />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {r.status !== 'in_progress' && (
                          <Button
                            size="sm" variant="secondary"
                            loading={updating === r.id}
                            onClick={() => handleUpdateStatus(r, 'in_progress')}
                          >
                            🔄 {s.status_in_progress}
                          </Button>
                        )}
                        {r.status !== 'resolved' && (
                          <Button
                            size="sm"
                            loading={updating === r.id}
                            onClick={() => handleUpdateStatus(r, 'resolved')}
                          >
                            ✅ {s.maint_resolve}
                          </Button>
                        )}
                        {r.status === 'resolved' && (
                          <Button
                            size="sm" variant="secondary"
                            loading={updating === r.id}
                            onClick={() => handleUpdateStatus(r, 'open')}
                          >
                            🔁 {s.maint_reopen}
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

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="foto besar"
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-9 h-9 bg-black/60 rounded-full text-white text-lg flex items-center justify-center hover:bg-black/80"
          >×</button>
        </div>
      )}
    </div>
  )
}
