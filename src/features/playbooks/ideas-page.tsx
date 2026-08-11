import { Lightbulb, Plus } from 'lucide-react'
import { useState } from 'react'
import { usePlaybooks } from './playbooks-store'
import type { Idea, LifeArea } from '@/types/workspace'
const areas: LifeArea[] = ['work', 'family', 'health', 'learning', 'faith', 'finance', 'creative']
export function IdeasPage() {
  const { ideas, addIdea, updateIdea } = usePlaybooks()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [area, setArea] = useState<LifeArea>('work')
  const create = async () => {
    if (!title.trim()) return
    await addIdea({ title: title.trim(), body, lifeArea: area })
    setTitle('')
    setBody('')
  }
  return (
    <section>
      <p className="text-sm text-zinc-500">Capture before you forget</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Ideas</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
        A garden for opportunities, experiments, observations, and future bets. An idea does not
        need to become a task yet.
      </p>
      <div className="mt-8 rounded-2xl bg-white/[0.04] p-5">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What caught your attention?"
          className="w-full bg-transparent text-lg outline-none placeholder:text-zinc-600"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Context, links, questions, or a first principle…"
          rows={3}
          className="mt-4 w-full resize-none bg-transparent text-sm leading-6 text-zinc-400 outline-none placeholder:text-zinc-700"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <select
            value={area}
            onChange={(event) => setArea(event.target.value as LifeArea)}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
          >
            {areas.map((entry) => (
              <option key={entry}>{entry}</option>
            ))}
          </select>
          <button
            onClick={() => void create()}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-950"
          >
            <Plus className="size-4" /> Capture idea
          </button>
        </div>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ideas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} onUpdate={updateIdea} />
        ))}
        {ideas.length === 0 && (
          <div className="rounded-2xl bg-white/[0.03] p-6 text-sm text-zinc-600">
            <Lightbulb className="size-5 text-amber-300" />
            <p className="mt-3">
              Keep your mind clear: capture ideas here, then decide later whether they deserve an
              experiment.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
function IdeaCard({
  idea,
  onUpdate,
}: {
  idea: Idea
  onUpdate: ReturnType<typeof usePlaybooks>['updateIdea']
}) {
  return (
    <article className="rounded-2xl bg-white/[0.035] p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-md bg-violet-400/10 px-2 py-1 text-xs text-violet-200">
          {idea.lifeArea}
        </span>
        <select
          value={idea.status}
          onChange={(event) =>
            void onUpdate(idea.id, { status: event.target.value as Idea['status'] })
          }
          className="bg-transparent text-xs text-zinc-500 outline-none"
        >
          <option value="seed">seed</option>
          <option value="exploring">exploring</option>
          <option value="experiment">experiment</option>
          <option value="incubating">incubating</option>
          <option value="archived">archived</option>
        </select>
      </div>
      <h2 className="mt-4 text-sm font-medium text-zinc-200">{idea.title}</h2>
      {idea.body && (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-500">{idea.body}</p>
      )}
      <p className="mt-4 text-xs text-zinc-700">
        Captured{' '}
        {new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }).format(new Date(idea.createdAt))}
      </p>
    </article>
  )
}
