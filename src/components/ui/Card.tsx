import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
  hover?: boolean
}

const paddings = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' }

export default function Card({ children, className = '', padding = 'md', onClick, hover }: Props) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-card ${paddings[padding]} ${hover ? 'cursor-pointer hover:border-brand-400 hover:shadow-md transition-all duration-150' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
