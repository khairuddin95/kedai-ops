import type { ReactNode } from 'react'
import type { TaskStatus, SubmissionStatus } from '../../types'

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'

const variants: Record<Variant, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  danger:  'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  info:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  neutral: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
  purple:  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
}

export default function Badge({ variant='neutral', children, className='' }: { variant?: Variant; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { variant: Variant; label: string }> = {
    done:        { variant: 'success', label: '✅ Siap' },
    in_progress: { variant: 'warning', label: '🕐 Sedang Buat' },
    late:        { variant: 'danger',  label: '⚠️ Lewat' },
    pending:     { variant: 'neutral', label: '— Belum Siap' },
  }
  const cfg = map[status]
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

export function SubStatusBadge({ status }: { status: SubmissionStatus }) {
  const map: Record<SubmissionStatus, { variant: Variant; label: string }> = {
    pending:  { variant: 'warning', label: '⏳ Pending' },
    approved: { variant: 'success', label: '✅ Diluluskan' },
    rejected: { variant: 'danger',  label: '✗ Ditolak' },
  }
  const cfg = map[status]
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
