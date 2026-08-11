import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { useAuth } from '@/features/auth/auth-provider'
import { supabase } from '@/lib/supabase'
import type { FocusSession, Spec, SpecStep, WorkItem } from '@/types/workspace'

type AutopilotState = { plans: Spec[]; steps: SpecStep[]; focusSessions: FocusSession[] }
type AutopilotContextValue = AutopilotState & {
  source: 'loading' | 'local' | 'supabase'
  error: string | null
  createPlan: (item: WorkItem, minutes: number) => Promise<Spec | null>
  startFocus: (
    input: Pick<FocusSession, 'title' | 'plannedMinutes' | 'specStepId' | 'workItemId'>,
  ) => Promise<void>
  completeFocus: (id: string) => Promise<void>
  askAi: (
    workItems: WorkItem[],
  ) => Promise<{ workItemId: string; title: string; reason: string; minutes: number } | null>
}

const storageKey = 'forge.autopilot.v1'
const empty: AutopilotState = { plans: [], steps: [], focusSessions: [] }
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
      const [plans, steps, sessions] = await Promise.all([
        supabase
          .from('specs')
          .select('*')
          .in('status', ['active', 'completed'])
          .order('updated_at', { ascending: false }),
        supabase.from('spec_steps').select('*').order('position'),
        supabase.from('focus_sessions').select('*').order('started_at', { ascending: false }),
      ])
      const issue = plans.error ?? steps.error ?? sessions.error
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
        })
        setSource('supabase')
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [mode, user])
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
    const { data: inserted, error: planError } = await supabase!
      .from('specs')
      .insert({
        owner_id: user!.id,
        project_id: plan.projectId,
        title: plan.title,
        problem_statement: plan.problemStatement,
        desired_outcome: plan.desiredOutcome,
        in_scope: plan.inScope,
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
    const { data: savedStep, error: stepError } = await supabase!
      .from('spec_steps')
      .insert({
        spec_id: savedPlan.id,
        title: step.title,
        notes: step.notes,
        estimate_minutes: minutes,
        work_item_id: item.id,
      })
      .select()
      .single()
    if (stepError) {
      setError(stepError.message)
      return savedPlan
    }
    setData((current) => ({
      ...current,
      plans: [savedPlan, ...current.plans],
      steps: [...current.steps, mapStep(savedStep as Record<string, unknown>)],
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
    if (offline()) {
      save({
        ...data,
        focusSessions: data.focusSessions.map((entry) =>
          entry.id === id ? { ...entry, completedAt: new Date().toISOString() } : entry,
        ),
        steps: data.steps.map((step) =>
          step.id === session.specStepId ? { ...step, status: 'done' } : step,
        ),
      })
      return
    }
    const { data: updated, error: updateError } = await supabase!
      .from('focus_sessions')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (updateError) {
      setError(updateError.message)
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
      setError(response?.error ?? functionError?.message ?? 'Forge AI could not plan right now.')
      return null
    }
    return response.direction
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
