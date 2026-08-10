import type { WorkItem } from '@/types/workspace'

export function ticketLabels(items: WorkItem[]) {
  return new Map(
    [...items]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((item, index) => [item.id, `T-${index + 1}`]),
  )
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function timeAgo(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
  if (minutes < 60) return `${minutes || 1}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function idleState(updatedAt: string) {
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000)
  if (days >= 14) return { label: `Idle ${days}d`, className: 'text-rose-300' }
  if (days >= 7) return { label: `Idle ${days}d`, className: 'text-amber-300' }
  return { label: `Updated ${timeAgo(updatedAt)}`, className: 'text-zinc-600' }
}
