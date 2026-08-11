export function ForgeMark({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M5 24V8l11-5 11 5v16l-11 5L5 24Z" fill="currentColor" opacity=".18" />
      <path d="m8 10 8-3.5 8 3.5v12l-8 3.5L8 22V10Z" stroke="currentColor" strokeWidth="2" />
      <path d="M12 21V11h8M12 16h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="m21 14 3 2-3 2"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
