import { useEffect, useState } from 'react'
import type { TaskGroup, TaskState } from '../types'
import { STRINGS } from '../utils/i18n'

export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported'

const ENABLED_KEY = 'notif_enabled'

// ─── Permission ─────────────────────────────────────────────

export function notifSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getPermission(): NotifPermission {
  if (!notifSupported()) return 'unsupported'
  return Notification.permission as NotifPermission
}

export async function requestPermission(): Promise<NotifPermission> {
  if (!notifSupported()) return 'unsupported'
  try {
    const result = await Notification.requestPermission()
    return result as NotifPermission
  } catch {
    return 'denied'
  }
}

export function getEnabled(): boolean {
  if (!notifSupported()) return false
  // User has to both grant browser permission AND opt in via the app toggle
  return localStorage.getItem(ENABLED_KEY) !== 'false' && getPermission() === 'granted'
}

export function setEnabled(on: boolean) {
  localStorage.setItem(ENABLED_KEY, String(on))
}

// ─── Send ───────────────────────────────────────────────────

export function sendNotification(title: string, body: string, tag?: string) {
  if (!notifSupported() || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, tag, icon: '/favicon.svg' })
  } catch (err) {
    console.error('[notif] sendNotification:', err)
  }
}

// ─── Time parsing ───────────────────────────────────────────

/**
 * Parse a free-form task group time string into hour/minute. Handles:
 *   "10:00", "10:00 am", "10:00 pm",
 *   "10:00 pagi", "10:00 petang", "10:00 malam", "12:00 tengahari"
 * Returns null if it can't be parsed (the group will simply be skipped
 * for time-based reminders, which is the safe default).
 */
export function parseTaskTime(raw: string): { hour: number; minute: number } | null {
  if (!raw) return null
  const t = raw.toLowerCase().trim()
  const match = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|pagi|petang|malam|tengahari|tgh)?/i)
  if (!match) return null
  let h = parseInt(match[1], 10)
  const m = match[2] ? parseInt(match[2], 10) : 0
  const period = match[3]?.toLowerCase()

  if (period === 'pm' || period === 'petang' || period === 'malam') {
    if (h < 12) h += 12
  } else if (period === 'am' || period === 'pagi') {
    if (h === 12) h = 0
  } else if (period === 'tengahari' || period === 'tgh') {
    h = 12
  }
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return { hour: h, minute: m }
}

export function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

// ─── Once-per-day notification dedup ────────────────────────

function notifiedKey(): string {
  return `notif_sent_${new Date().toDateString()}`
}

function getNotifiedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(notifiedKey())
    return new Set(raw ? JSON.parse(raw) as string[] : [])
  } catch {
    return new Set()
  }
}

function markNotified(groupId: string) {
  const set = getNotifiedSet()
  set.add(groupId)
  localStorage.setItem(notifiedKey(), JSON.stringify(Array.from(set)))
}

// ─── Public: overdue groups derivation (used for in-app banner too) ──

export interface OverdueGroup {
  id: string
  title: string
  time: string
  pendingCount: number
  minutesLate: number
}

const REMIND_DELAY_MIN = 15        // notify 15 min after scheduled time
const TICK_INTERVAL_MS = 60_000    // re-check overdue list every minute

export function findOverdueGroups(
  taskGroups: TaskGroup[],
  taskStates: Record<string, TaskState>,
  now: Date,
): OverdueGroup[] {
  const nowMins = minutesFromMidnight(now)
  const out: OverdueGroup[] = []
  for (const g of taskGroups) {
    const parsed = parseTaskTime(g.time)
    if (!parsed) continue
    const scheduled = parsed.hour * 60 + parsed.minute
    const minutesLate = nowMins - scheduled
    if (minutesLate < REMIND_DELAY_MIN) continue
    const pending = g.tasks.filter(t => (taskStates[t.id]?.status ?? 'pending') !== 'done')
    if (pending.length === 0) continue
    out.push({
      id: g.id,
      title: g.title,
      time: g.time,
      pendingCount: pending.length,
      minutesLate,
    })
  }
  // Most overdue first
  return out.sort((a, b) => b.minutesLate - a.minutesLate)
}

// ─── Hook: live overdue list + one-shot OS notifications ────

interface UseTaskRemindersOpts {
  taskGroups: TaskGroup[]
  taskStates: Record<string, TaskState>
  enabled: boolean
  lang: 'bm' | 'en'
}

export function useTaskReminders({ taskGroups, taskStates, enabled, lang }: UseTaskRemindersOpts) {
  const [overdue, setOverdue] = useState<OverdueGroup[]>([])

  useEffect(() => {
    let cancelled = false

    const tick = () => {
      const now = new Date()
      const list = findOverdueGroups(taskGroups, taskStates, now)
      if (!cancelled) setOverdue(list)

      if (!enabled) return
      // Send OS notifications for groups we haven't notified for yet today
      const notified = getNotifiedSet()
      for (const g of list) {
        if (notified.has(g.id)) continue
        const s = STRINGS[lang]
        const title = s.notif_overdue_title
        const body = `${g.title} (${g.time}) — ${g.pendingCount} ${s.notif_overdue_body_suffix}`
        sendNotification(title, body, `group_${g.id}_${new Date().toDateString()}`)
        markNotified(g.id)
      }
    }

    tick()
    const handle = setInterval(tick, TICK_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(handle)
    }
  // We intentionally re-run when enabled / lang / data changes
  }, [taskGroups, taskStates, enabled, lang])

  return overdue
}
