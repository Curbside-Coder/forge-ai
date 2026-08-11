import { useState } from 'react'
import { Check, CheckCheck, Plus, Sparkles } from 'lucide-react'
import { useWorkspace } from '@/features/workspace/workspace-store'
import { supabase } from '@/lib/supabase'
import type { WorkItemPriority, WorkItemType } from '@/types/workspace'
import { MeetingDetail } from './meeting-detail'

type Suggestion = {
  title: string
  description: string
  projectId: string
  priority: WorkItemPriority
  type: WorkItemType
}

export function MeetingsPage() {
  const { projects, meetings, addMeeting, addWorkItem } = useWorkspace()
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [notes, setNotes] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [meetingSaved, setMeetingSaved] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('meeting'),
  )
  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3600)
  }
  const generate = async () => {
    if (!notes.trim()) return
    setIsAnalyzing(true)
    if (!supabase) {
      setSuggestions(extractActionItems(notes, projectId || projects[0]?.id || ''))
      setSummary(
        'Local suggestions were generated. Connect Forge AI for an intelligent meeting summary.',
      )
      setIsAnalyzing(false)
      return
    }
    const { data, error } = await supabase.functions.invoke('meeting-analyze', {
      body: { title, notes },
    })
    if (error || data?.error) {
      notify(data?.error ?? 'Forge AI could not analyze this meeting. Please try again.')
      setIsAnalyzing(false)
      return
    }
    const nextProjectId = projectId || projects[0]?.id || ''
    setSuggestions(
      ((data.workItems ?? []) as Omit<Suggestion, 'projectId'>[]).map((item) => ({
        ...item,
        projectId: nextProjectId,
      })),
    )
    setSummary(data.summary as string)
    setSaved([])
    setMeetingSaved(false)
    setIsAnalyzing(false)
    notify('Forge AI summarized the meeting and prepared work items for review.')
  }
  const selectedMeeting = meetings.find((meeting) => meeting.id === selectedMeetingId) ?? null
  const openMeeting = (id: string) => {
    window.history.pushState({}, '', `/meetings?meeting=${encodeURIComponent(id)}`)
    setSelectedMeetingId(id)
  }
  const closeMeeting = () => {
    window.history.pushState({}, '', '/meetings')
    setSelectedMeetingId(null)
  }
  const save = async (suggestion: Suggestion) => {
    await addWorkItem({
      ...suggestion,
    })
    setSaved((current) => [...current, suggestion.title])
  }
  const createAll = async () => {
    const nextSuggestions = suggestions.length
      ? suggestions
      : extractActionItems(notes, projectId || projects[0]?.id || '')
    if (!nextSuggestions.length || !nextSuggestions[0].projectId) return
    setSuggestions(nextSuggestions)
    setIsCreating(true)
    const unsaved = nextSuggestions.filter((suggestion) => !saved.includes(suggestion.title))
    await Promise.all(unsaved.map((suggestion) => save(suggestion)))
    if (!meetingSaved) await saveMeeting()
    setIsCreating(false)
    notify(`${unsaved.length} work item${unsaved.length === 1 ? '' : 's'} created and saved.`)
  }
  const saveMeeting = async () => {
    if (!notes.trim()) return
    await addMeeting({
      projectId: projectId || null,
      title: title.trim() || 'Untitled meeting',
      notes: notes.trim(),
      summary:
        summary ?? (suggestions.length ? `${suggestions.length} work items reviewed.` : null),
    })
    setMeetingSaved(true)
    notify('Meeting notes saved to Forge.')
  }
  return (
    <section>
      <p className="text-sm text-zinc-500">Capture, review, then save</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Meetings</h1>
      <p className="mt-2 max-w-xl text-zinc-500">
        Paste minutes, turn decisions and action items into structured work, then track every item
        in Forge.
      </p>
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Meeting title"
              className="rounded-lg bg-black/20 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-1 ring-white/[0.08] placeholder:text-zinc-600 focus:ring-white/30"
            />
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="rounded-lg bg-black/20 px-3 py-2.5 text-sm text-zinc-300 outline-none ring-1 ring-white/[0.08]"
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <label className="text-sm font-medium text-zinc-300" htmlFor="notes">
            Meeting notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={
              'Decided to improve onboarding.\n- Define approval states for new members\n- Fix the calendar overlap bug\n- Review the first dashboard flow with the team'
            }
            className="mt-3 min-h-72 w-full resize-y rounded-2xl bg-white/[0.035] p-5 text-sm leading-6 text-zinc-200 outline-none ring-1 ring-white/[0.06] placeholder:text-zinc-600 focus:ring-white/20"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => void generate()}
              disabled={!notes.trim() || isAnalyzing}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="size-4" />
              {isAnalyzing ? 'Analyzing…' : 'Ask Forge AI'}
            </button>
            <button
              onClick={() => void createAll()}
              disabled={!notes.trim() || isCreating || projects.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-4 py-2.5 text-sm font-medium text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="size-4" />
              {isCreating ? 'Creating…' : 'Create work items'}
            </button>
            <button
              onClick={() => void saveMeeting()}
              disabled={!notes.trim() || meetingSaved}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-zinc-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
            >
              <Plus className="size-4" />
              {meetingSaved ? 'Meeting saved' : 'Save meeting'}
            </button>
          </div>
        </div>
        <div className="rounded-2xl bg-white/[0.025] p-5">
          <h2 className="font-medium">Suggested work items</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Each draft includes a type, priority, and concise context. Save one item or create them
            all.
          </p>
          {summary && (
            <div className="mt-4 rounded-xl border border-violet-300/15 bg-violet-400/[0.07] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-violet-200">
                Forge AI summary
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{summary}</p>
            </div>
          )}
          <div className="mt-5 space-y-3">
            {suggestions.length === 0 && (
              <p className="py-8 text-center text-sm text-zinc-600">
                Suggestions will appear here.
              </p>
            )}
            {suggestions.map((suggestion) => (
              <article key={suggestion.title} className="rounded-xl bg-white/[0.05] p-4">
                <p className="text-sm text-zinc-200">{suggestion.title}</p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{suggestion.description}</p>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="rounded-md bg-white/[0.07] px-2 py-1 capitalize text-zinc-400">
                    {suggestion.type}
                  </span>
                  <span className={`capitalize ${priorityColor(suggestion.priority)}`}>
                    {suggestion.priority}
                  </span>
                </div>
                {saved.includes(suggestion.title) ? (
                  <p className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-300">
                    <Check className="size-3.5" />
                    Saved to work items
                  </p>
                ) : (
                  <button
                    onClick={() => void save(suggestion)}
                    className="mt-3 text-xs font-medium text-zinc-400 hover:text-white"
                  >
                    Save work item
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>
      <section className="mt-14 max-w-3xl">
        <h2 className="text-base font-medium">Recent meetings</h2>
        <div className="mt-4 space-y-2">
          {meetings.length === 0 ? (
            <p className="rounded-xl bg-white/[0.025] px-5 py-6 text-sm text-zinc-600">
              Saved meeting notes will appear here.
            </p>
          ) : (
            meetings.slice(0, 5).map((meeting) => (
              <button
                key={meeting.id}
                onClick={() => openMeeting(meeting.id)}
                className="block w-full rounded-xl bg-white/[0.025] px-5 py-4 text-left transition hover:bg-white/[0.05]"
              >
                <p className="text-sm font-medium text-zinc-200">{meeting.title}</p>
                <p className="mt-1 text-sm text-zinc-500">{meeting.summary ?? 'Notes captured'}</p>
              </button>
            ))
          )}
        </div>
      </section>
      {toast && (
        <div className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-medium text-emerald-950 shadow-2xl">
          <CheckCheck className="size-4" />
          {toast}
        </div>
      )}
      {selectedMeeting && (
        <>
          <button
            aria-label="Close meeting details"
            onClick={closeMeeting}
            className="fixed inset-0 z-20 cursor-default bg-black/45"
          />
          <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-xl overflow-y-auto bg-[#121216] p-5 shadow-2xl ring-1 ring-white/[0.08] sm:p-7">
            <MeetingDetail
              meeting={selectedMeeting}
              projects={projects}
              label={`M-${meetings.length - meetings.findIndex((meeting) => meeting.id === selectedMeeting.id)}`}
              onClose={closeMeeting}
            />
          </aside>
        </>
      )}
    </section>
  )
}

function extractActionItems(notes: string, projectId: string): Suggestion[] {
  const lines = notes
    .split('\n')
    .flatMap((line) => line.split(/[.!?](?:\s|$)/))
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, ''))
    .filter((line) => line.length > 3)
  const actionPattern =
    /\b(assign|build|check|clarify|confirm|create|decide|define|deliver|document|draft|fix|follow up|implement|investigate|prepare|review|schedule|send|share|test|update)\b/i
  const candidates = lines.filter((line) => actionPattern.test(line))
  const fallback = lines.filter((line) => !/^(discussed|meeting|notes?|attendees?)\b/i.test(line))
  return [...new Set((candidates.length ? candidates : fallback).map(toWorkItemTitle))]
    .filter(Boolean)
    .slice(0, 8)
    .map((title) => ({
      title,
      projectId,
      description: `Captured from meeting minutes: ${title}`,
      priority: inferPriority(title),
      type: inferType(title),
    }))
}

function toWorkItemTitle(line: string) {
  return line
    .replace(/^(we need to|need to|action item:?|next step:?|owner:?)/i, '')
    .trim()
    .replace(/^[a-z]/, (character) => character.toUpperCase())
}

function inferPriority(text: string): WorkItemPriority {
  if (/urgent|blocker|blocked|critical|asap|today/i.test(text)) return 'critical'
  if (/fix|deadline|approve|launch|customer/i.test(text)) return 'high'
  if (/idea|explore|consider|someday/i.test(text)) return 'low'
  return 'medium'
}

function inferType(text: string): WorkItemType {
  if (/bug|error|issue|fix|broken|fail/i.test(text)) return 'bug'
  if (/research|investigate|explore|compare/i.test(text)) return 'research'
  if (/idea|brainstorm|consider/i.test(text)) return 'idea'
  if (/build|create|implement|launch|develop/i.test(text)) return 'feature'
  if (/improve|update|refine|optimi[sz]e/i.test(text)) return 'improvement'
  return 'task'
}

function priorityColor(priority: WorkItemPriority) {
  return {
    critical: 'text-rose-300',
    high: 'text-amber-300',
    medium: 'text-sky-300',
    low: 'text-zinc-400',
  }[priority]
}
