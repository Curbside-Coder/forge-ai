import { X } from 'lucide-react'
import type { Meeting, Project } from '@/types/workspace'
import { RichText } from '@/components/shared/rich-text'

export function MeetingDetail({
  meeting,
  projects,
  label,
  onClose,
}: {
  meeting: Meeting
  projects: Project[]
  label: string
  onClose: () => void
}) {
  const project = projects.find((entry) => entry.id === meeting.projectId)
  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-600">
            {label} · Meeting
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{meeting.title}</h2>
          <p className="mt-2 text-sm text-zinc-500">
            {project?.name ?? 'No project'} · {formatDateTime(meeting.createdAt)}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close meeting details"
          className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.07] hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
      {meeting.summary && (
        <section className="mt-8">
          <h3 className="text-sm font-medium">Summary</h3>
          <p className="mt-3 rounded-xl bg-white/[0.04] px-4 py-3 text-sm leading-6 text-zinc-400">
            {meeting.summary}
          </p>
        </section>
      )}
      <section className="mt-8">
        <h3 className="text-sm font-medium">Meeting notes</h3>
        <p className="mt-1 text-[11px] text-zinc-600">
          Recorded {formatDateTime(meeting.createdAt)}
        </p>
        <div className="mt-3 rounded-xl bg-black/20 px-4 py-4 text-zinc-400">
          <RichText content={meeting.notes} />
        </div>
      </section>
    </section>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
