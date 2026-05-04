interface Props {
  label: string
  checked: boolean
  onToggle: () => void
  index: number
}

export default function ChecklistItem({ label, checked, onToggle, index }: Props) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-150 text-left ${
        checked
          ? 'bg-brand-50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-800'
          : 'bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--border-2)]'
      }`}
    >
      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
        checked ? 'bg-brand-600 border-brand-600 text-white animate-checkPop' : 'border-[var(--border-2)]'
      }`}>
        {checked && <span className="text-xs font-bold">✓</span>}
      </div>
      <span className="text-xs text-[var(--text-muted)] w-5 flex-shrink-0 font-mono">{index + 1}</span>
      <span className={`text-sm flex-1 ${checked ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text)]'}`}>
        {label}
      </span>
    </button>
  )
}
