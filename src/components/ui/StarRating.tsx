import { useState } from 'react'

interface Props {
  value: number
  onChange?: (v: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' }

export default function StarRating({ value, onChange, readonly, size = 'md' }: Props) {
  const [hover, setHover] = useState(0)

  return (
    <div className="flex gap-1" onMouseLeave={() => !readonly && setHover(0)}>
      {[1,2,3,4,5].map(i => (
        <button
          key={i}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(i)}
          onMouseEnter={() => !readonly && setHover(i)}
          className={`${sizes[size]} transition-transform duration-100 ${!readonly ? 'hover:scale-125 cursor-pointer' : 'cursor-default'} disabled:cursor-default`}
        >
          <span className={`transition-colors ${i <= (hover || value) ? 'text-amber-400' : 'text-[var(--border-2)]'}`}>
            ★
          </span>
        </button>
      ))}
    </div>
  )
}
