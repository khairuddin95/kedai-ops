import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
}

const variants: Record<Variant, string> = {
  primary:   'bg-brand-600 hover:bg-brand-700 text-white shadow-sm',
  secondary: 'bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--text)] border border-[var(--border-2)]',
  danger:    'bg-red-500 hover:bg-red-600 text-white shadow-sm',
  success:   'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm',
  ghost:     'bg-transparent hover:bg-[var(--surface-2)] text-[var(--text-soft)]',
}
const sizes: Record<Size, string> = {
  sm: 'h-8  px-3  text-xs  rounded-sm gap-1.5',
  md: 'h-10 px-4  text-sm  rounded-md gap-2',
  lg: 'h-12 px-6  text-sm  rounded-lg gap-2 font-semibold',
}

export default function Button({ variant='primary', size='md', loading, icon, children, className='', disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : icon}
      {children}
    </button>
  )
}
