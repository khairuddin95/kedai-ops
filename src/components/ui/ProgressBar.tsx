interface Props {
  value: number   // 0-100
  color?: string
  height?: 'sm' | 'md' | 'lg'
  animated?: boolean
}

const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' }

export default function ProgressBar({ value, color = '#3b82f6', height = 'md', animated }: Props) {
  return (
    <div className={`w-full ${heights[height]} bg-[var(--surface-2)] rounded-full overflow-hidden`}>
      <div
        className={`${heights[height]} rounded-full transition-all duration-500 ease-out ${animated ? 'animate-pulse' : ''}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  )
}
