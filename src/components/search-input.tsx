import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  clearLabel: string
}

export function SearchInput({ value, onChange, placeholder, clearLabel }: SearchInputProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-13 rounded-2xl border-transparent pr-12 pl-12 text-base surface focus-visible:border-ring [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={clearLabel}
          className="absolute top-1/2 right-1.5 grid size-10 -translate-y-1/2 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
        >
          <X className="size-5" />
        </button>
      )}
    </div>
  )
}
