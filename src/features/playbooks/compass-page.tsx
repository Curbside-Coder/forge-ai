import { Compass, Plus } from 'lucide-react'
import { useState } from 'react'
import { usePlaybooks } from './playbooks-store'
import type { CompassGoal, LifeArea } from '@/types/workspace'
const areas: LifeArea[] = ['work', 'family', 'health', 'learning', 'faith', 'finance', 'creative']
export function CompassPage() {
  const { compassGoals, addCompassGoal, updateCompassGoal } = usePlaybooks()
  const [title, setTitle] = useState('')
  const [outcome, setOutcome] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [lifeArea, setLifeArea] = useState<LifeArea>('work')
  const [horizon, setHorizon] = useState<CompassGoal['horizon']>('quarter')
  const create = async () => {
    if (!title.trim()) return
    await addCompassGoal({ title: title.trim(), lifeArea, horizon, outcome, nextAction })
    setTitle('')
    setOutcome('')
    setNextAction('')
  }
  return (
    <section>
      <p className="text-sm text-zinc-500">Direction before urgency</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Compass</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
        Connect short-term effort to the person and life you are intentionally building. These are
        outcomes and experiments, not another backlog.
      </p>
      <div className="mt-8 rounded-2xl bg-white/[0.04] p-5">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="A meaningful outcome or long-term bet"
          className="w-full bg-transparent text-lg outline-none placeholder:text-zinc-600"
        />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <textarea
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            placeholder="Why it matters / what success means"
            rows={2}
            className="resize-none rounded-xl bg-black/20 px-3 py-3 text-sm text-zinc-300 outline-none placeholder:text-zinc-700"
          />
          <textarea
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            placeholder="Smallest next action"
            rows={2}
            className="resize-none rounded-xl bg-black/20 px-3 py-3 text-sm text-zinc-300 outline-none placeholder:text-zinc-700"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <select
              value={lifeArea}
              onChange={(event) => setLifeArea(event.target.value as LifeArea)}
              className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
            >
              {areas.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </select>
            <select
              value={horizon}
              onChange={(event) => setHorizon(event.target.value as CompassGoal['horizon'])}
              className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="week">This week</option>
              <option value="quarter">12-week / quarter</option>
              <option value="year">This year</option>
              <option value="long_term">Long-term</option>
            </select>
          </div>
          <button
            onClick={() => void create()}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-950"
          >
            <Plus className="size-4" /> Add direction
          </button>
        </div>
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {compassGoals
          .filter((goal) => goal.active)
          .map((goal) => (
            <article key={goal.id} className="rounded-2xl bg-white/[0.035] p-5">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">
                  {goal.lifeArea}
                </span>
                <span className="text-xs text-zinc-600">{goal.horizon.replace('_', ' ')}</span>
              </div>
              <h2 className="mt-4 text-base font-medium">{goal.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {goal.outcome || 'Outcome still being clarified.'}
              </p>
              <div className="mt-4 rounded-lg bg-black/20 px-3 py-2 text-sm text-zinc-300">
                <span className="text-zinc-600">Next: </span>
                {goal.nextAction || 'Choose a next action.'}
              </div>
              <button
                onClick={() => void updateCompassGoal(goal.id, { active: false })}
                className="mt-4 text-xs text-zinc-600 hover:text-zinc-300"
              >
                Archive
              </button>
            </article>
          ))}
        {compassGoals.filter((goal) => goal.active).length === 0 && (
          <div className="rounded-2xl bg-white/[0.03] p-6 text-sm text-zinc-600">
            <Compass className="size-5 text-emerald-300" />
            <p className="mt-3">
              Use Compass for the few directions that deserve deliberate time—not every aspiration.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
