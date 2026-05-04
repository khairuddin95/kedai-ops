const ICONS: Record<string, string> = {
  sunrise:   '🌅',
  sparkles:  '✨',
  wrench:    '🔧',
  moon:      '🌙',
  sun:       '☀️',
  star:      '⭐',
  check:     '✅',
  clock:     '🕐',
  alert:     '⚠️',
  fire:      '🔥',
}

export default function GroupIcon({ icon, color, size = 36 }: { icon: string; color: string; size?: number }) {
  return (
    <div
      className="rounded-md flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, background: color + '22', fontSize: size * 0.5 }}
    >
      {ICONS[icon] ?? '📋'}
    </div>
  )
}

export { ICONS }
