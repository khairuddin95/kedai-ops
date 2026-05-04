interface Props {
  emoji: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  name?: string
}

const sizes = { sm: 'w-7 h-7 text-sm', md: 'w-9 h-9 text-base', lg: 'w-11 h-11 text-xl', xl: 'w-14 h-14 text-2xl' }

export default function Avatar({ emoji, size = 'md', name }: Props) {
  return (
    <div title={name} className={`${sizes[size]} rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 select-none`}>
      {emoji}
    </div>
  )
}
