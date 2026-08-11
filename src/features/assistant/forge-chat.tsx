import { Bot, Check, Send, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/features/auth/auth-provider'
import { useWorkspace } from '@/features/workspace/workspace-store'
import { supabase } from '@/lib/supabase'

type Action = {
  type: 'create_calendar_event' | 'create_project' | 'create_work_item' | 'create_meeting'
  title?: string
  name?: string
  description?: string
  notes?: string
  startsAt?: string
  endsAt?: string
  priority?: 'critical' | 'high' | 'medium' | 'low'
  workType?: 'task' | 'bug' | 'feature' | 'idea' | 'research' | 'improvement'
  projectId?: string
  projectName?: string
}
type Usage = { inputTokens: number; outputTokens: number; totalTokens: number }

export function ForgeChat() {
  const { user } = useAuth()
  const { projects } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState<string | null>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [usage, setUsage] = useState<Usage | null>(null)
  const ask = async () => {
    if (!message.trim() || !supabase) return
    setLoading(true)
    setReply(null)
    const { data, error } = await supabase.functions.invoke('forge-command', {
      body: {
        message,
        now: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        projects: projects.map(({ id, name }) => ({ id, name })),
      },
    })
    setLoading(false)
    if (error || data?.error) {
      setReply(data?.error ?? 'Forge AI is unavailable right now.')
      return
    }
    setReply(data.message)
    setActions((data.actions ?? []) as Action[])
    setUsage(data.usage as Usage | null)
  }
  const apply = async () => {
    if (!supabase || !user || actions.length === 0) return
    setApplying(true)
    try {
      let defaultProjectId = projects[0]?.id
      for (const action of actions) {
        if (action.type === 'create_project' && action.name) {
          const { data, error } = await supabase
            .from('projects')
            .insert({ owner_id: user.id, name: action.name, description: action.description ?? '' })
            .select('id')
            .single()
          if (error) throw error
          defaultProjectId = data.id
        }
        if (
          action.type === 'create_calendar_event' &&
          action.title &&
          action.startsAt &&
          action.endsAt
        ) {
          const { error } = await supabase.from('calendar_events').insert({
            owner_id: user.id,
            title: action.title,
            description: action.description ?? '',
            starts_at: action.startsAt,
            ends_at: action.endsAt,
            source: 'forge-ai',
          })
          if (error) throw error
        }
        if (action.type === 'create_meeting' && action.title) {
          const { error } = await supabase.from('meetings').insert({
            created_by: user.id,
            project_id: action.projectId ?? defaultProjectId ?? null,
            title: action.title,
            notes: action.notes ?? action.description ?? '',
            summary: 'Created by Forge AI.',
          })
          if (error) throw error
        }
        if (action.type === 'create_work_item' && action.title) {
          let projectId =
            action.projectId ??
            projects.find(
              (project) => project.name.toLowerCase() === action.projectName?.toLowerCase(),
            )?.id ??
            defaultProjectId
          if (!projectId) {
            const { data, error } = await supabase
              .from('projects')
              .insert({ owner_id: user.id, name: 'Personal', description: 'Created by Forge AI' })
              .select('id')
              .single()
            if (error) throw error
            projectId = data.id
            defaultProjectId = data.id
          }
          const { error } = await supabase.from('work_items').insert({
            project_id: projectId,
            created_by: user.id,
            title: action.title,
            description: action.description ?? '',
            priority: action.priority ?? 'medium',
            type: action.workType ?? 'task',
            status: 'backlog',
          })
          if (error) throw error
        }
      }
      setReply(`${actions.length} Forge action${actions.length === 1 ? '' : 's'} saved.`)
      setActions([])
      window.setTimeout(() => window.location.reload(), 700)
    } catch (error) {
      setReply(error instanceof Error ? error.message : 'Forge could not save those actions.')
    } finally {
      setApplying(false)
    }
  }
  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <section className="mb-3 w-[min(24rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl bg-[#19191d] shadow-2xl ring-1 ring-white/[0.1]">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
            <p className="inline-flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-violet-200" /> Forge assistant
            </p>
            <button onClick={() => setOpen(false)} aria-label="Close Forge assistant">
              <X className="size-4 text-zinc-500" />
            </button>
          </div>
          <div className="min-h-28 space-y-3 p-4 text-sm">
            <p className="text-zinc-500">
              Try: “Create a task to review the API docs” or “Add a calendar event tomorrow at 10 AM
              for 30 minutes.”
            </p>
            {reply && (
              <p className="rounded-xl bg-white/[0.05] p-3 leading-6 text-zinc-200">{reply}</p>
            )}
            {actions.length > 0 && (
              <div className="space-y-2">
                {actions.map((action, index) => (
                  <p
                    key={`${action.type}-${index}`}
                    className="rounded-lg bg-violet-400/[0.08] px-3 py-2 text-xs text-violet-100"
                  >
                    {action.type.replaceAll('_', ' ')}: {action.title ?? action.name}
                  </p>
                ))}
                <button
                  onClick={() => void apply()}
                  disabled={applying}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-3 py-2 text-sm font-medium text-emerald-950 disabled:opacity-50"
                >
                  <Check className="size-4" />
                  {applying
                    ? 'Saving…'
                    : `Save ${actions.length} action${actions.length === 1 ? '' : 's'}`}
                </button>
              </div>
            )}
            {usage && (
              <p className="pt-1 text-[10px] text-zinc-500/60">
                This request · {usage.inputTokens.toLocaleString()} in ·{' '}
                {usage.outputTokens.toLocaleString()} out · {usage.totalTokens.toLocaleString()}{' '}
                tokens
              </p>
            )}
          </div>
          <div className="flex gap-2 border-t border-white/[0.07] p-3">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void ask()
              }}
              placeholder="Ask Forge to do something…"
              className="min-w-0 flex-1 rounded-lg bg-black/20 px-3 py-2 text-sm outline-none ring-1 ring-white/[0.08] placeholder:text-zinc-600"
            />
            <button
              onClick={() => void ask()}
              disabled={loading || !message.trim()}
              className="rounded-lg bg-violet-200 px-3 text-violet-950 disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </div>
        </section>
      )}
      <button
        onClick={() => setOpen((value) => !value)}
        className="grid size-12 place-items-center rounded-full bg-violet-200 text-violet-950 shadow-xl transition hover:scale-105"
        aria-label="Open Forge assistant"
      >
        <Bot className="size-5" />
      </button>
    </div>
  )
}
