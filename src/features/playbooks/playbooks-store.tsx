import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { useAuth } from '@/features/auth/auth-provider'
import { supabase } from '@/lib/supabase'
import type {
  CompassGoal,
  FocusSession,
  Idea,
  Spec,
  SpecStep,
  SpecStatus,
  SpecStepStatus,
} from '@/types/workspace'

type PlaybooksState = {
  specs: Spec[]
  specSteps: SpecStep[]
  focusSessions: FocusSession[]
  ideas: Idea[]
  compassGoals: CompassGoal[]
}

type NewSpec = Pick<Spec, 'title' | 'projectId' | 'priority'> &
  Partial<Omit<Spec, 'id' | 'title' | 'projectId' | 'priority' | 'createdAt' | 'updatedAt'>>
type PlaybooksContextValue = PlaybooksState & {
  source: 'loading' | 'local' | 'supabase'
  error: string | null
  addSpec: (spec: NewSpec) => Promise<Spec | null>
  updateSpec: (id: string, changes: Partial<Spec>) => Promise<void>
  deleteSpec: (id: string) => Promise<void>
  addSpecStep: (
    step: Pick<SpecStep, 'specId' | 'title' | 'notes' | 'estimateMinutes'>,
  ) => Promise<void>
  updateSpecStep: (id: string, changes: Partial<SpecStep>) => Promise<void>
  startFocus: (
    session: Pick<FocusSession, 'title' | 'plannedMinutes' | 'specStepId' | 'workItemId'>,
  ) => Promise<void>
  completeFocus: (id: string, interruptionNote?: string) => Promise<void>
  addIdea: (idea: Pick<Idea, 'title' | 'body' | 'lifeArea'>) => Promise<void>
  updateIdea: (id: string, changes: Partial<Idea>) => Promise<void>
  addCompassGoal: (
    goal: Pick<CompassGoal, 'title' | 'lifeArea' | 'horizon' | 'outcome' | 'nextAction'>,
  ) => Promise<void>
  updateCompassGoal: (id: string, changes: Partial<CompassGoal>) => Promise<void>
}

const storageKey = 'forge.playbooks.v1'
const empty: PlaybooksState = {
  specs: [],
  specSteps: [],
  focusSessions: [],
  ideas: [],
  compassGoals: [],
}
const PlaybooksContext = createContext<PlaybooksContextValue | null>(null)
const camel = <T,>(row: Record<string, unknown>, fields: Record<string, string>): T => {
  const result: Record<string, unknown> = {}
  Object.entries(fields).forEach(([key, source]) => {
    result[key] = row[source]
  })
  return result as T
}
const mapSpec = (row: Record<string, unknown>) =>
  camel<Spec>(row, {
    id: 'id',
    projectId: 'project_id',
    title: 'title',
    problemStatement: 'problem_statement',
    desiredOutcome: 'desired_outcome',
    inScope: 'in_scope',
    outOfScope: 'out_of_scope',
    technicalContext: 'technical_context',
    edgeCases: 'edge_cases',
    retrospective: 'retrospective',
    status: 'status',
    priority: 'priority',
    activePosition: 'active_position',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  })
const mapStep = (row: Record<string, unknown>) =>
  camel<SpecStep>(row, {
    id: 'id',
    specId: 'spec_id',
    title: 'title',
    notes: 'notes',
    status: 'status',
    estimateMinutes: 'estimate_minutes',
    position: 'position',
    workItemId: 'work_item_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  })
const mapFocus = (row: Record<string, unknown>) =>
  camel<FocusSession>(row, {
    id: 'id',
    specStepId: 'spec_step_id',
    workItemId: 'work_item_id',
    title: 'title',
    plannedMinutes: 'planned_minutes',
    startedAt: 'started_at',
    completedAt: 'completed_at',
    interruptionNote: 'interruption_note',
  })
const mapIdea = (row: Record<string, unknown>) =>
  camel<Idea>(row, {
    id: 'id',
    title: 'title',
    body: 'body',
    lifeArea: 'life_area',
    status: 'status',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  })
const mapGoal = (row: Record<string, unknown>) =>
  camel<CompassGoal>(row, {
    id: 'id',
    title: 'title',
    lifeArea: 'life_area',
    horizon: 'horizon',
    outcome: 'outcome',
    nextAction: 'next_action',
    active: 'active',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  })

function loadLocal(): PlaybooksState {
  try {
    return {
      ...empty,
      ...(JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as Partial<PlaybooksState>),
    }
  } catch {
    return empty
  }
}

export function PlaybooksProvider({ children }: PropsWithChildren) {
  const { user, mode } = useAuth()
  const [data, setData] = useState<PlaybooksState>(empty)
  const [source, setSource] = useState<PlaybooksContextValue['source']>('loading')
  const [error, setError] = useState<string | null>(null)
  const shouldUseLocal = () => !supabase || source !== 'supabase' || !user
  const save = (next: PlaybooksState) => {
    setData(next)
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  }

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!supabase) {
        if (alive) {
          setData(loadLocal())
          setSource('local')
        }
        return
      }
      if (mode === 'loading' || !user) return
      const [specs, steps, sessions, ideas, goals] = await Promise.all([
        supabase.from('specs').select('*').order('updated_at', { ascending: false }),
        supabase.from('spec_steps').select('*').order('position'),
        supabase.from('focus_sessions').select('*').order('started_at', { ascending: false }),
        supabase.from('ideas').select('*').order('updated_at', { ascending: false }),
        supabase.from('compass_goals').select('*').order('created_at', { ascending: false }),
      ])
      const loadError = specs.error ?? steps.error ?? sessions.error ?? ideas.error ?? goals.error
      if (loadError) {
        if (alive) {
          setData(loadLocal())
          setSource('local')
          setError(`Playbooks are using local data: ${loadError.message}`)
        }
        return
      }
      if (alive) {
        setData({
          specs: (specs.data as Record<string, unknown>[]).map(mapSpec),
          specSteps: (steps.data as Record<string, unknown>[]).map(mapStep),
          focusSessions: (sessions.data as Record<string, unknown>[]).map(mapFocus),
          ideas: (ideas.data as Record<string, unknown>[]).map(mapIdea),
          compassGoals: (goals.data as Record<string, unknown>[]).map(mapGoal),
        })
        setSource('supabase')
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [mode, user])

  const addSpec: PlaybooksContextValue['addSpec'] = async (spec) => {
    const timestamp = new Date().toISOString()
    const draft: Spec = {
      id: crypto.randomUUID(),
      projectId: spec.projectId ?? null,
      title: spec.title,
      problemStatement: spec.problemStatement ?? '',
      desiredOutcome: spec.desiredOutcome ?? '',
      inScope: spec.inScope ?? '',
      outOfScope: spec.outOfScope ?? '',
      technicalContext: spec.technicalContext ?? '',
      edgeCases: spec.edgeCases ?? '',
      retrospective: spec.retrospective ?? '',
      status: spec.status ?? 'draft',
      priority: spec.priority,
      activePosition: spec.activePosition ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    if (shouldUseLocal()) {
      save({ ...data, specs: [draft, ...data.specs] })
      return draft
    }
    const { data: inserted, error: insertError } = await supabase!
      .from('specs')
      .insert({
        owner_id: user!.id,
        project_id: draft.projectId,
        title: draft.title,
        problem_statement: draft.problemStatement,
        desired_outcome: draft.desiredOutcome,
        in_scope: draft.inScope,
        out_of_scope: draft.outOfScope,
        technical_context: draft.technicalContext,
        edge_cases: draft.edgeCases,
        retrospective: draft.retrospective,
        status: draft.status,
        priority: draft.priority,
        active_position: draft.activePosition,
      })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
      return null
    }
    const created = mapSpec(inserted as Record<string, unknown>)
    setData((current) => ({
      ...current,
      specs: [created, ...current.specs],
    }))
    return created
  }
  const updateSpec: PlaybooksContextValue['updateSpec'] = async (id, changes) => {
    if (shouldUseLocal()) {
      save({
        ...data,
        specs: data.specs.map((item) =>
          item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item,
        ),
      })
      return
    }
    const column: Record<string, unknown> = { ...changes }
    const names: Record<string, string> = {
      projectId: 'project_id',
      problemStatement: 'problem_statement',
      desiredOutcome: 'desired_outcome',
      inScope: 'in_scope',
      outOfScope: 'out_of_scope',
      technicalContext: 'technical_context',
      edgeCases: 'edge_cases',
      activePosition: 'active_position',
    }
    Object.entries(names).forEach(([from, to]) => {
      if (from in column) {
        column[to] = column[from]
        delete column[from]
      }
    })
    delete column.id
    delete column.createdAt
    delete column.updatedAt
    const { data: updated, error: updateError } = await supabase!
      .from('specs')
      .update(column)
      .eq('id', id)
      .select()
      .single()
    if (updateError) {
      setError(updateError.message)
      return
    }
    setData((current) => ({
      ...current,
      specs: current.specs.map((item) =>
        item.id === id ? mapSpec(updated as Record<string, unknown>) : item,
      ),
    }))
  }
  const deleteSpec = async (id: string) => {
    if (shouldUseLocal()) {
      save({
        ...data,
        specs: data.specs.filter((item) => item.id !== id),
        specSteps: data.specSteps.filter((step) => step.specId !== id),
      })
      return
    }
    const { error: deleteError } = await supabase!.from('specs').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setData((current) => ({
      ...current,
      specs: current.specs.filter((item) => item.id !== id),
      specSteps: current.specSteps.filter((step) => step.specId !== id),
    }))
  }
  const addSpecStep: PlaybooksContextValue['addSpecStep'] = async (step) => {
    const timestamp = new Date().toISOString()
    const next: SpecStep = {
      id: crypto.randomUUID(),
      ...step,
      status: 'todo',
      position: data.specSteps.filter((entry) => entry.specId === step.specId).length,
      workItemId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    if (shouldUseLocal()) {
      save({ ...data, specSteps: [...data.specSteps, next] })
      return
    }
    const { data: inserted, error: insertError } = await supabase!
      .from('spec_steps')
      .insert({
        spec_id: step.specId,
        title: step.title,
        notes: step.notes,
        estimate_minutes: step.estimateMinutes,
        position: next.position,
      })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    setData((current) => ({
      ...current,
      specSteps: [...current.specSteps, mapStep(inserted as Record<string, unknown>)],
    }))
  }
  const updateSpecStep: PlaybooksContextValue['updateSpecStep'] = async (id, changes) => {
    if (shouldUseLocal()) {
      save({
        ...data,
        specSteps: data.specSteps.map((step) =>
          step.id === id ? { ...step, ...changes, updatedAt: new Date().toISOString() } : step,
        ),
      })
      return
    }
    const update = { ...changes } as Record<string, unknown>
    if ('specId' in update) {
      update.spec_id = update.specId
      delete update.specId
    }
    if ('estimateMinutes' in update) {
      update.estimate_minutes = update.estimateMinutes
      delete update.estimateMinutes
    }
    if ('workItemId' in update) {
      update.work_item_id = update.workItemId
      delete update.workItemId
    }
    delete update.id
    delete update.createdAt
    delete update.updatedAt
    const { data: updated, error: updateError } = await supabase!
      .from('spec_steps')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    if (updateError) {
      setError(updateError.message)
      return
    }
    setData((current) => ({
      ...current,
      specSteps: current.specSteps.map((step) =>
        step.id === id ? mapStep(updated as Record<string, unknown>) : step,
      ),
    }))
  }
  const startFocus: PlaybooksContextValue['startFocus'] = async (session) => {
    const next: FocusSession = {
      id: crypto.randomUUID(),
      ...session,
      startedAt: new Date().toISOString(),
      completedAt: null,
      interruptionNote: null,
    }
    if (shouldUseLocal()) {
      save({ ...data, focusSessions: [next, ...data.focusSessions] })
      return
    }
    const { data: inserted, error: insertError } = await supabase!
      .from('focus_sessions')
      .insert({
        owner_id: user!.id,
        spec_step_id: session.specStepId,
        work_item_id: session.workItemId,
        title: session.title,
        planned_minutes: session.plannedMinutes,
      })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    setData((current) => ({
      ...current,
      focusSessions: [mapFocus(inserted as Record<string, unknown>), ...current.focusSessions],
    }))
  }
  const completeFocus = async (id: string, interruptionNote?: string) => {
    if (shouldUseLocal()) {
      save({
        ...data,
        focusSessions: data.focusSessions.map((session) =>
          session.id === id
            ? {
                ...session,
                completedAt: new Date().toISOString(),
                interruptionNote: interruptionNote ?? null,
              }
            : session,
        ),
      })
      return
    }
    const { data: updated, error: updateError } = await supabase!
      .from('focus_sessions')
      .update({
        completed_at: new Date().toISOString(),
        interruption_note: interruptionNote ?? null,
      })
      .eq('id', id)
      .select()
      .single()
    if (updateError) {
      setError(updateError.message)
      return
    }
    setData((current) => ({
      ...current,
      focusSessions: current.focusSessions.map((session) =>
        session.id === id ? mapFocus(updated as Record<string, unknown>) : session,
      ),
    }))
  }
  const addIdea: PlaybooksContextValue['addIdea'] = async (idea) => {
    const timestamp = new Date().toISOString()
    const next: Idea = {
      id: crypto.randomUUID(),
      ...idea,
      status: 'seed',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    if (shouldUseLocal()) {
      save({ ...data, ideas: [next, ...data.ideas] })
      return
    }
    const { data: inserted, error: insertError } = await supabase!
      .from('ideas')
      .insert({ owner_id: user!.id, title: idea.title, body: idea.body, life_area: idea.lifeArea })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    setData((current) => ({
      ...current,
      ideas: [mapIdea(inserted as Record<string, unknown>), ...current.ideas],
    }))
  }
  const updateIdea: PlaybooksContextValue['updateIdea'] = async (id, changes) => {
    if (shouldUseLocal()) {
      save({
        ...data,
        ideas: data.ideas.map((idea) =>
          idea.id === id ? { ...idea, ...changes, updatedAt: new Date().toISOString() } : idea,
        ),
      })
      return
    }
    const update = { ...changes } as Record<string, unknown>
    if ('lifeArea' in update) {
      update.life_area = update.lifeArea
      delete update.lifeArea
    }
    delete update.id
    delete update.createdAt
    delete update.updatedAt
    const { data: updated, error: updateError } = await supabase!
      .from('ideas')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    if (updateError) {
      setError(updateError.message)
      return
    }
    setData((current) => ({
      ...current,
      ideas: current.ideas.map((idea) =>
        idea.id === id ? mapIdea(updated as Record<string, unknown>) : idea,
      ),
    }))
  }
  const addCompassGoal: PlaybooksContextValue['addCompassGoal'] = async (goal) => {
    const timestamp = new Date().toISOString()
    const next: CompassGoal = {
      id: crypto.randomUUID(),
      ...goal,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    if (shouldUseLocal()) {
      save({ ...data, compassGoals: [next, ...data.compassGoals] })
      return
    }
    const { data: inserted, error: insertError } = await supabase!
      .from('compass_goals')
      .insert({
        owner_id: user!.id,
        title: goal.title,
        life_area: goal.lifeArea,
        horizon: goal.horizon,
        outcome: goal.outcome,
        next_action: goal.nextAction,
      })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    setData((current) => ({
      ...current,
      compassGoals: [mapGoal(inserted as Record<string, unknown>), ...current.compassGoals],
    }))
  }
  const updateCompassGoal: PlaybooksContextValue['updateCompassGoal'] = async (id, changes) => {
    if (shouldUseLocal()) {
      save({
        ...data,
        compassGoals: data.compassGoals.map((goal) =>
          goal.id === id ? { ...goal, ...changes, updatedAt: new Date().toISOString() } : goal,
        ),
      })
      return
    }
    const update = { ...changes } as Record<string, unknown>
    if ('lifeArea' in update) {
      update.life_area = update.lifeArea
      delete update.lifeArea
    }
    if ('nextAction' in update) {
      update.next_action = update.nextAction
      delete update.nextAction
    }
    delete update.id
    delete update.createdAt
    delete update.updatedAt
    const { data: updated, error: updateError } = await supabase!
      .from('compass_goals')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    if (updateError) {
      setError(updateError.message)
      return
    }
    setData((current) => ({
      ...current,
      compassGoals: current.compassGoals.map((goal) =>
        goal.id === id ? mapGoal(updated as Record<string, unknown>) : goal,
      ),
    }))
  }
  return (
    <PlaybooksContext.Provider
      value={{
        ...data,
        source,
        error,
        addSpec,
        updateSpec,
        deleteSpec,
        addSpecStep,
        updateSpecStep,
        startFocus,
        completeFocus,
        addIdea,
        updateIdea,
        addCompassGoal,
        updateCompassGoal,
      }}
    >
      {children}
    </PlaybooksContext.Provider>
  )
}

export function usePlaybooks() {
  const value = useContext(PlaybooksContext)
  if (!value) throw new Error('usePlaybooks must be used inside PlaybooksProvider')
  return value
}

export type { SpecStatus, SpecStepStatus }
