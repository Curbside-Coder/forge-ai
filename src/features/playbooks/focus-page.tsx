import { Coffee, Play, Square, TimerReset } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { usePlaybooks } from './playbooks-store'

export function FocusPage() {
  const { specs, specSteps, focusSessions, startFocus, completeFocus, updateSpecStep } =
    usePlaybooks()
  const [minutes, setMinutes] = useState(25)
  const activeSession = focusSessions.find((session) => !session.completedAt)
  const nextStep = useMemo(() => {
    const active = specs.find((spec) => spec.status === 'active')
    return (
      specSteps.find((step) => step.specId === active?.id && step.status !== 'done') ??
      specSteps.find((step) => step.status !== 'done')
    )
  }, [specSteps, specs])
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!activeSession) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activeSession])
  const seconds = activeSession
    ? Math.max(
        0,
        activeSession.plannedMinutes * 60 -
          Math.floor((now - new Date(activeSession.startedAt).getTime()) / 1000),
      )
    : 0
  const begin = async () => {
    if (!nextStep) return
    await startFocus({
      title: nextStep.title,
      plannedMinutes: minutes,
      specStepId: nextStep.id,
      workItemId: nextStep.workItemId,
    })
    void updateSpecStep(nextStep.id, { status: 'in_progress' })
  }
  const finish = async () => {
    if (!activeSession) return
    await completeFocus(activeSession.id)
    if (activeSession.specStepId) void updateSpecStep(activeSession.specStepId, { status: 'done' })
  }
  return (
    <section className="mx-auto max-w-2xl text-center">
      <p className="text-sm text-zinc-500">One-step focus</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
        Do the next meaningful thing.
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-500">
        Focus is a promise to one small action—not a demand to squeeze every minute out of your day.
      </p>
      <div className="mt-12 rounded-3xl bg-white/[0.04] p-7 sm:p-12">
        <TimerReset className="mx-auto size-5 text-violet-300" />
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.16em] text-zinc-600">
          {activeSession ? 'In focus' : 'Next action'}
        </p>
        <h2 className="mt-3 text-xl font-medium text-zinc-100">
          {activeSession?.title ?? nextStep?.title ?? 'No next action yet'}
        </h2>
        <p className="mt-3 text-sm text-zinc-500">
          {activeSession
            ? `${format(seconds)} remaining`
            : nextStep
              ? `Estimated ${nextStep.estimateMinutes} minutes`
              : 'Create an active spec and add a micro-action.'}
        </p>
        {!activeSession && nextStep && (
          <div className="mt-7 flex justify-center gap-2">
            {[15, 25, 45].map((value) => (
              <button
                key={value}
                onClick={() => setMinutes(value)}
                className={`rounded-lg px-3 py-2 text-sm ${minutes === value ? 'bg-white text-zinc-950' : 'bg-white/[0.06] text-zinc-400 hover:text-white'}`}
              >
                {value}m
              </button>
            ))}
          </div>
        )}
        <button
          disabled={!activeSession && !nextStep}
          onClick={() => void (activeSession ? finish() : begin())}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-5 py-3 text-sm font-medium text-zinc-950 disabled:opacity-40"
        >
          {activeSession ? (
            <>
              <Square className="size-4" /> Complete & continue
            </>
          ) : (
            <>
              <Play className="size-4" /> Start focus session
            </>
          )}
        </button>
      </div>
      <div className="mt-7 rounded-2xl bg-amber-400/[0.06] px-5 py-4 text-left text-sm leading-6 text-amber-100/80">
        <Coffee className="mr-2 inline size-4 text-amber-300" />
        If you are stuck for 15 minutes, write the uncertainty down in your spec. Reduce the next
        step until it feels startable.
      </div>
    </section>
  )
}
function format(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
