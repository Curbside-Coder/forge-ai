import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { useAuth } from '@/features/auth/auth-provider'
import { supabase } from '@/lib/supabase'
import type { AiDirection, FocusSession, Spec, SpecStep, WorkItem } from '@/types/workspace'

type AutopilotState = {
  plans: Spec[]
  steps: SpecStep[]
  focusSessions: FocusSession[]
  aiDirection: AiDirection | null
}
type AutopilotContextValue = AutopilotState & {
  source: 'loading' | 'local' | 'supabase'
  error: string | null
  createPlan: (item: WorkItem, minutes: number) => Promise<Spec | null>
  startFocus: (
    input: Pick<FocusSession, 'title' | 'plannedMinutes' | 'specStepId' | 'workItemId'>,
  ) => Promise<void>
  completeFocus: (id: string) => Promise<void>
  askAi: (workItems: WorkItem[]) => Promise<AiDirection | null>
}

const storageKey = 'forge.autopilot.v1'
const empty: AutopilotState = { plans: [], steps: [], focusSessions: [], aiDirection: null }
const Context = createContext<AutopilotContextValue | null>(null)
const mapPlan = (row: Record<string, unknown>): Spec => ({
  id: row.id as string,
  projectId: row.project_id as string | null,
  title: row.title as string,
  problemStatement: row.problem_statement as string,
  desiredOutcome: row.desired_outcome as string,
  inScope: row.in_scope as string,
  outOfScope: row.out_of_scope as string,
  technicalContext: row.technical_context as string,
  edgeCases: row.edge_cases as string,
  briefMarkdown: (row.brief_markdown as string) ?? '',
  retrospective: row.retrospective as string,
  status: row.status as Spec['status'],
  priority: row.priority as Spec['priority'],
  activePosition: row.active_position as number | null,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
})
const mapStep = (row: Record<string, unknown>): SpecStep => ({
  id: row.id as string,
  specId: row.spec_id as string,
  title: row.title as string,
  notes: row.notes as string,
  status: row.status as SpecStep['status'],
  estimateMinutes: row.estimate_minutes as number,
  position: row.position as number,
  workItemId: row.work_item_id as string | null,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
})
const mapFocus = (row: Record<string, unknown>): FocusSession => ({
  id: row.id as string,
  specStepId: row.spec_step_id as string | null,
  workItemId: row.work_item_id as string | null,
  title: row.title as string,
  plannedMinutes: row.planned_minutes as number,
  startedAt: row.started_at as string,
  completedAt: row.completed_at as string | null,
  interruptionNote: row.interruption_note as string | null,
})
const mapDirection = (row: Record<string, unknown>): AiDirection => ({
  workItemId: row.work_item_id as string,
  title: row.title as string,
  reason: row.reason as string,
  minutes: row.minutes as number,
  selectedAt: row.selected_at as string,
})
function local(): AutopilotState {
  try {
    return {
      ...empty,
      ...(JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as Partial<AutopilotState>),
    }
  } catch {
    return empty
  }
}

export function AutopilotProvider({ children }: PropsWithChildren) {
  const { user, mode } = useAuth()
  const [data, setData] = useState<AutopilotState>(empty)
  const [source, setSource] = useState<AutopilotContextValue['source']>('loading')
  const [error, setError] = useState<string | null>(null)
  const save = (next: AutopilotState) => {
    setData(next)
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  }
  const offline = () => !supabase || source !== 'supabase' || !user
  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!supabase) {
        if (mounted) {
          setData(local())
          setSource('local')
        }
        return
      }
      if (mode === 'loading' || !user) return
      const [plans, steps, sessions, direction] = await Promise.all([
        supabase
          .from('specs')
          .select('*')
          .in('status', ['active', 'completed'])
          .order('updated_at', { ascending: false }),
        supabase.from('spec_steps').select('*').order('position'),
        supabase.from('focus_sessions').select('*').order('started_at', { ascending: false }),
        supabase.from('forge_ai_directions').select('*').maybeSingle(),
      ])
      const issue = plans.error ?? steps.error ?? sessions.error ?? direction.error
      if (issue) {
        if (mounted) {
          setData(local())
          setSource('local')
          setError(`Autopilot is temporarily local: ${issue.message}`)
        }
        return
      }
      if (mounted) {
        setData({
          plans: (plans.data as Record<string, unknown>[]).map(mapPlan),
          steps: (steps.data as Record<string, unknown>[]).map(mapStep),
          focusSessions: (sessions.data as Record<string, unknown>[]).map(mapFocus),
          aiDirection: direction.data
            ? mapDirection(direction.data as Record<string, unknown>)
            : null,
        })
        setSource('supabase')
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [mode, user])

  useEffect(() => {
    if (!supabase || !user) return
    void supabase
      .from('forge_rhythm_preferences')
      .upsert({ owner_id: user.id }, { onConflict: 'owner_id', ignoreDuplicates: true })
  }, [user])
  const createPlan: AutopilotContextValue['createPlan'] = async (item, minutes) => {
    const timestamp = new Date().toISOString()
    const plan: Spec = {
      id: crypto.randomUUID(),
      projectId: item.projectId,
      title: item.title,
      problemStatement: item.description || `Move ${item.title} forward.`,
      desiredOutcome: `The next concrete result for ${item.title} is complete.`,
      inScope: item.description,
      outOfScope: '',
      technicalContext: '',
      edgeCases: '',
      briefMarkdown: '## Recommended approach\n\nStart with the next concrete action below.',
      retrospective: '',
      status: 'active',
      priority: item.priority,
      activePosition: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const step: SpecStep = {
      id: crypto.randomUUID(),
      specId: plan.id,
      title: item.title,
      notes: item.description,
      status: 'todo',
      estimateMinutes: minutes,
      position: 0,
      workItemId: item.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    if (offline()) {
      save({ ...data, plans: [plan, ...data.plans], steps: [...data.steps, step] })
      return plan
    }
    const { data: aiPlan, error: aiError } = await supabase!.functions.invoke('forge-work-plan', {
      body: {
        title: item.title,
        description: item.description,
        type: item.type,
        priority: item.priority,
      },
    })
    if (aiError || aiPlan?.error) {
      setError(aiPlan?.error ?? 'Forge AI could not build a plan right now.')
      return null
    }
    const draftedSteps = (
      aiPlan.steps as Array<{ title: string; notes: string; minutes: number }>
    ).slice(0, 7)
    const { data: inserted, error: planError } = await supabase!
      .from('specs')
      .insert({
        owner_id: user!.id,
        project_id: plan.projectId,
        title: plan.title,
        problem_statement: aiPlan.problemStatement,
        desired_outcome: aiPlan.desiredOutcome,
        in_scope: item.description,
        brief_markdown: aiPlan.briefMarkdown,
        status: 'active',
        priority: plan.priority,
        active_position: 1,
      })
      .select()
      .single()
    if (planError) {
      setError(planError.message)
      return null
    }
    const savedPlan = mapPlan(inserted as Record<string, unknown>)
    const { data: savedSteps, error: stepError } = await supabase!
      .from('spec_steps')
      .insert(
        draftedSteps.map((draft, position) => ({
          spec_id: savedPlan.id,
          title: draft.title,
          notes: draft.notes,
          estimate_minutes: draft.minutes,
          position,
          work_item_id: item.id,
        })),
      )
      .select()
    if (stepError) {
      setError(stepError.message)
      return savedPlan
    }
    setData((current) => ({
      ...current,
      plans: [savedPlan, ...current.plans],
      steps: [...current.steps, ...((savedSteps ?? []) as Record<string, unknown>[]).map(mapStep)],
    }))
    return savedPlan
  }
  const startFocus: AutopilotContextValue['startFocus'] = async (input) => {
    const next: FocusSession = {
      id: crypto.randomUUID(),
      ...input,
      startedAt: new Date().toISOString(),
      completedAt: null,
      interruptionNote: null,
    }
    if (offline()) {
      save({
        ...data,
        focusSessions: [next, ...data.focusSessions],
        steps: data.steps.map((step) =>
          step.id === input.specStepId ? { ...step, status: 'in_progress' } : step,
        ),
      })
      return
    }
    const { data: inserted, error: insertError } = await supabase!
      .from('focus_sessions')
      .insert({
        owner_id: user!.id,
        spec_step_id: input.specStepId,
        work_item_id: input.workItemId,
        title: input.title,
        planned_minutes: input.plannedMinutes,
      })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    if (input.specStepId)
      await supabase!
        .from('spec_steps')
        .update({ status: 'in_progress' })
        .eq('id', input.specStepId)
    setData((current) => ({
      ...current,
      focusSessions: [mapFocus(inserted as Record<string, unknown>), ...current.focusSessions],
      steps: current.steps.map((step) =>
        step.id === input.specStepId ? { ...step, status: 'in_progress' } : step,
      ),
    }))
  }
  const completeFocus = async (id: string) => {
    const session = data.focusSessions.find((entry) => entry.id === id)
    if (!session) return
    const completedAt = new Date().toISOString()
    if (offline()) {
      save({
        ...data,
        focusSessions: data.focusSessions.map((entry) =>
          entry.id === id ? { ...entry, completedAt } : entry,
        ),
        steps: data.steps.map((step) =>
          step.id === session.specStepId ? { ...step, status: 'done' } : step,
        ),
      })
      return
    }
    // End the visible timer immediately. Restore it only if the protected database write fails.
    setData((current) => ({
      ...current,
      focusSessions: current.focusSessions.map((entry) =>
        entry.id === id ? { ...entry, completedAt } : entry,
      ),
      steps: current.steps.map((step) =>
        step.id === session.specStepId ? { ...step, status: 'done' } : step,
      ),
    }))
    const { data: updated, error: updateError } = await supabase!
      .from('focus_sessions')
      .update({ completed_at: completedAt })
      .eq('id', id)
      .select()
      .single()
    if (updateError) {
      setError(updateError.message)
      setData((current) => ({
        ...current,
        focusSessions: current.focusSessions.map((entry) =>
          entry.id === id ? { ...entry, completedAt: null } : entry,
        ),
        steps: current.steps.map((step) =>
          step.id === session.specStepId ? { ...step, status: 'in_progress' } : step,
        ),
      }))
      return
    }
    if (session.specStepId)
      await supabase!.from('spec_steps').update({ status: 'done' }).eq('id', session.specStepId)
    setData((current) => ({
      ...current,
      focusSessions: current.focusSessions.map((entry) =>
        entry.id === id ? mapFocus(updated as Record<string, unknown>) : entry,
      ),
      steps: current.steps.map((step) =>
        step.id === session.specStepId ? { ...step, status: 'done' } : step,
      ),
    }))
  }
  const askAi: AutopilotContextValue['askAi'] = async (workItems) => {
    if (!supabase || !user) {
      setError('Connect Supabase and sign in to use Forge AI.')
      return null
    }
    const { data: response, error: functionError } = await supabase.functions.invoke(
      'autopilot-plan',
      { body: { workItems } },
    )
    if (functionError || response?.error || !response?.direction) {
      let detail = response?.error ?? functionError?.message ?? 'Forge AI could not plan right now.'
      const context =
        functionError && 'context' in functionError ? (functionError.context as unknown) : null
      if (context instanceof Response) {
        const body = (await context.json().catch(() => null)) as { error?: string } | null
        detail = body?.error ?? detail
      }
      setError(detail)
      return null
    }
    const selected: AiDirection = { ...response.direction, selectedAt: new Date().toISOString() }
    if (offline()) {
      save({ ...data, aiDirection: selected })
      return selected
    }
    const { data: saved, error: saveError } = await supabase!
      .from('forge_ai_directions')
      .upsert(
        {
          owner_id: user.id,
          work_item_id: selected.workItemId,
          title: selected.title,
          reason: selected.reason,
          minutes: selected.minutes,
          selected_at: selected.selectedAt,
        },
        { onConflict: 'owner_id' },
      )
      .select()
      .single()
    if (saveError) {
      setError(`Forge selected a direction, but could not save it: ${saveError.message}`)
      setData((current) => ({ ...current, aiDirection: selected }))
      return selected
    }
    setData((current) => ({
      ...current,
      aiDirection: mapDirection(saved as Record<string, unknown>),
    }))
    return selected
  }
  return (
    <Context.Provider
      value={{ ...data, source, error, createPlan, startFocus, completeFocus, askAi }}
    >
      {children}
    </Context.Provider>
  )
}
export function useAutopilot() {
  const value = useContext(Context)
  if (!value) throw new Error('useAutopilot must be used inside AutopilotProvider')
  return value
}
