import { Bot, Check, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ForgeMark } from '@/components/brand/forge-mark'
import { useAuth } from '@/features/auth/auth-provider'
import { useWorkspace } from '@/features/workspace/workspace-store'
import { supabase } from '@/lib/supabase'

type Action = {
  type:
    | 'create_calendar_event'
    | 'create_project'
    | 'create_work_item'
    | 'create_meeting'
    | 'update_calendar_event'
    | 'delete_calendar_event'
    | 'update_work_item'
    | 'delete_work_item'
    | 'update_project'
    | 'delete_project'
    | 'update_meeting'
    | 'delete_meeting'
  targetId?: string
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
  status?: 'backlog' | 'in_progress' | 'in_review' | 'done'
}
type Usage = { inputTokens: number; outputTokens: number; totalTokens: number }
type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  body: string
  actions: Action[]
  usage: Usage | null
  createdAt: string
}

export function ForgeChat() {
  const { user } = useAuth()
  const { projects } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open || !supabase || !user) return
    void supabase
      .from('forge_chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setError('Chat memory will be available after the latest database migration.')
          return
        }
        setMessages(
          (data ?? []).reverse().map((row) => ({
            id: row.id,
            role: row.role,
            body: row.body,
            actions: (row.actions ?? []) as Action[],
            usage: row.usage as Usage | null,
            createdAt: row.created_at,
          })),
        )
      })
  }, [open, user])
  const remember = async (entry: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    if (!supabase || !user) return null
    const { data } = await supabase
      .from('forge_chat_messages')
      .insert({
        owner_id: user.id,
        role: entry.role,
        body: entry.body,
        actions: entry.actions,
        usage: entry.usage,
      })
      .select()
      .single()
    return data
      ? {
          id: data.id,
          role: data.role as ChatMessage['role'],
          body: data.body,
          actions: data.actions as Action[],
          usage: data.usage as Usage | null,
          createdAt: data.created_at,
        }
      : null
  }
  const ask = async () => {
    const request = message.trim()
    if (!request || !supabase) return
    setMessage('')
    setLoading(true)
    setError(null)
    setActions([])
    const optimistic: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      body: request,
      actions: [],
      usage: null,
      createdAt: new Date().toISOString(),
    }
    setMessages((current) => [...current, optimistic])
    const saved = await remember({ role: 'user', body: request, actions: [], usage: null })
    if (saved)
      setMessages((current) => current.map((entry) => (entry.id === optimistic.id ? saved : entry)))
    const { data, error: requestError } = await supabase.functions.invoke('forge-command', {
      body: {
        message: request,
        now: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        projects: projects.map(({ id, name }) => ({ id, name })),
        history: messages.slice(-12).map(({ role, body }) => ({ role, body })),
      },
    })
    setLoading(false)
    if (requestError || data?.error) {
      setError(data?.error ?? 'Forge AI is unavailable right now.')
      return
    }
    const nextActions = (data.actions ?? []) as Action[]
    const usage = data.usage as Usage | null
    setActions(nextActions)
    const assistant = await remember({
      role: 'assistant',
      body: data.message,
      actions: nextActions,
      usage,
    })
    setMessages((current) => [
      ...current,
      assistant ?? {
        id: crypto.randomUUID(),
        role: 'assistant',
        body: data.message,
        actions: nextActions,
        usage,
        createdAt: new Date().toISOString(),
      },
    ])
  }
  const apply = async () => {
    if (!supabase || !user || actions.length === 0) return
    setApplying(true)
    try {
      let defaultProjectId = projects[0]?.id
      for (const action of actions) {
        if (action.type === 'update_calendar_event' && action.targetId) {
          const changes: Record<string, string> = {}
          if (action.title) changes.title = action.title
          if (action.description !== undefined) changes.description = action.description
          if (action.startsAt) changes.starts_at = action.startsAt
          if (action.endsAt) changes.ends_at = action.endsAt
          const { error: updateError } = await supabase
            .from('calendar_events')
            .update(changes)
            .eq('id', action.targetId)
          if (updateError) throw updateError
          continue
        }
        if (action.type === 'delete_calendar_event' && action.targetId) {
          const { error: deleteError } = await supabase
            .from('calendar_events')
            .delete()
            .eq('id', action.targetId)
          if (deleteError) throw deleteError
          continue
        }
        if (action.type === 'update_work_item' && action.targetId) {
          const changes: Record<string, string> = {}
          if (action.title) changes.title = action.title
          if (action.description !== undefined) changes.description = action.description
          if (action.priority) changes.priority = action.priority
          if (action.status) changes.status = action.status
          const { error: updateError } = await supabase
            .from('work_items')
            .update(changes)
            .eq('id', action.targetId)
          if (updateError) throw updateError
          continue
        }
        if (action.type === 'delete_work_item' && action.targetId) {
          const { error: deleteError } = await supabase
            .from('work_items')
            .delete()
            .eq('id', action.targetId)
          if (deleteError) throw deleteError
          continue
        }
        if (action.type === 'update_project' && action.targetId) {
          const changes: Record<string, string> = {}
          if (action.name) changes.name = action.name
          if (action.description !== undefined) changes.description = action.description
          const { error: updateError } = await supabase
            .from('projects')
            .update(changes)
            .eq('id', action.targetId)
          if (updateError) throw updateError
          continue
        }
        if (action.type === 'delete_project' && action.targetId) {
          const { error: deleteError } = await supabase
            .from('projects')
            .delete()
            .eq('id', action.targetId)
          if (deleteError) throw deleteError
          continue
        }
        if (action.type === 'update_meeting' && action.targetId) {
          const changes: Record<string, string> = {}
          if (action.title) changes.title = action.title
          if (action.notes !== undefined) changes.notes = action.notes
          const { error: updateError } = await supabase
            .from('meetings')
            .update(changes)
            .eq('id', action.targetId)
          if (updateError) throw updateError
          continue
        }
        if (action.type === 'delete_meeting' && action.targetId) {
          const { error: deleteError } = await supabase
            .from('meetings')
            .delete()
            .eq('id', action.targetId)
          if (deleteError) throw deleteError
          continue
        }
        if (action.type === 'create_project' && action.name) {
          const { data, error: insertError } = await supabase
            .from('projects')
            .insert({ owner_id: user.id, name: action.name, description: action.description ?? '' })
            .select('id')
            .single()
          if (insertError) throw insertError
          defaultProjectId = data.id
        }
        if (
          action.type === 'create_calendar_event' &&
          action.title &&
          action.startsAt &&
          action.endsAt
        ) {
          const { error: insertError } = await supabase.from('calendar_events').insert({
            owner_id: user.id,
            title: action.title,
            description: action.description ?? '',
            starts_at: action.startsAt,
            ends_at: action.endsAt,
            source: 'forge-ai',
          })
          if (insertError) throw insertError
        }
        if (action.type === 'create_meeting' && action.title) {
          const { error: insertError } = await supabase.from('meetings').insert({
            created_by: user.id,
            project_id: action.projectId ?? defaultProjectId ?? null,
            title: action.title,
            notes: action.notes ?? action.description ?? '',
            summary: 'Created by Forge AI.',
          })
          if (insertError) throw insertError
        }
        if (action.type === 'create_work_item' && action.title) {
          let projectId =
            action.projectId ??
            projects.find(
              (project) => project.name.toLowerCase() === action.projectName?.toLowerCase(),
            )?.id ??
            defaultProjectId
          if (!projectId) {
            const { data, error: insertError } = await supabase
              .from('projects')
              .insert({ owner_id: user.id, name: 'Personal', description: 'Created by Forge AI' })
              .select('id')
              .single()
            if (insertError) throw insertError
            projectId = data.id
            defaultProjectId = data.id
          }
          const { error: insertError } = await supabase.from('work_items').insert({
            project_id: projectId,
            created_by: user.id,
            title: action.title,
            description: action.description ?? '',
            priority: action.priority ?? 'medium',
            type: action.workType ?? 'task',
            status: 'backlog',
          })
          if (insertError) throw insertError
        }
      }
      setActions([])
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          body: `${actions.length} Forge action${actions.length === 1 ? '' : 's'} saved.`,
          actions: [],
          usage: null,
          createdAt: new Date().toISOString(),
        },
      ])
      window.setTimeout(() => window.location.reload(), 700)
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Forge could not save those actions.',
      )
    } finally {
      setApplying(false)
    }
  }
  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <section className="mb-3 flex h-[min(38rem,calc(100vh-6rem))] w-[min(25rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl bg-[#19191d] shadow-2xl ring-1 ring-white/[0.1]">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
            <p className="inline-flex items-center gap-2 text-sm font-medium">
              <ForgeMark className="size-4 text-violet-200" /> Forge assistant
            </p>
            <button onClick={() => setOpen(false)} aria-label="Close Forge assistant">
              <X className="size-4 text-zinc-500" />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {messages.length === 0 && (
              <p className="text-zinc-500">
                I remember this conversation privately in Forge. Try: “Create a task to review the
                API docs” or “Add a calendar event tomorrow at 10 AM for 30 minutes.”
              </p>
            )}
            {messages.map((entry) => (
              <div
                key={entry.id}
                className={
                  entry.role === 'user'
                    ? 'ml-8 rounded-xl bg-violet-400/15 p-3 text-zinc-100'
                    : 'mr-5 rounded-xl bg-white/[0.05] p-3 text-zinc-200'
                }
              >
                <p className="leading-6">{entry.body}</p>
                {entry.usage && (
                  <p className="mt-2 text-[10px] text-zinc-500/60">
                    {entry.usage.inputTokens.toLocaleString()} in ·{' '}
                    {entry.usage.outputTokens.toLocaleString()} out ·{' '}
                    {entry.usage.totalTokens.toLocaleString()} tokens
                  </p>
                )}
              </div>
            ))}
            {loading && <p className="text-xs text-violet-200">Forge is thinking…</p>}
            {error && (
              <p className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>
            )}
            {actions.length > 0 && (
              <div className="space-y-2">
                {actions.map((action, index) => (
                  <p
                    key={`${action.type}-${index}`}
                    className="rounded-lg bg-violet-400/[0.08] px-3 py-2 text-xs text-violet-100"
                  >
                    {actionLabel(action)}
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
          </div>
          <div className="flex gap-2 border-t border-white/[0.07] p-3">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void ask()
                }
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

function actionLabel(action: Action) {
  const name = action.title ?? action.name ?? action.targetId?.slice(0, 8) ?? 'item'
  return `${action.type.replaceAll('_', ' ')}: ${name}`
}
