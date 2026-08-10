import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react'
import { supabase } from '@/lib/supabase'
import type {
  ChecklistItem,
  Meeting,
  Project,
  WorkItem,
  WorkItemComment,
  WorkspaceSnapshot,
} from '@/types/workspace'
import { useAuth } from '@/features/auth/auth-provider'

const storageKey = 'forge.workspace.v1'
const now = '2026-08-07T12:00:00.000Z'
const seed: WorkspaceSnapshot = {
  projects: [
    {
      id: 'forge',
      name: 'Forge',
      description: 'AI-first developer workspace',
      color: 'zinc',
      createdAt: now,
    },
    {
      id: 'admired',
      name: 'Admired',
      description: 'Member portal and cafe operations',
      color: 'zinc',
      createdAt: now,
    },
    {
      id: 'qpaint',
      name: 'QPaint',
      description: 'Scheduling and capacity calendar',
      color: 'zinc',
      createdAt: now,
    },
  ],
  workItems: [
    {
      id: 'FOR-12',
      projectId: 'forge',
      title: 'Define meeting import flow',
      description: 'Outline the input, review, and save states for meeting capture.',
      status: 'in_progress',
      priority: 'high',
      type: 'feature',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'FOR-9',
      projectId: 'forge',
      title: 'Map the first work-item states',
      description: 'Keep the initial lifecycle compact and clear.',
      status: 'in_review',
      priority: 'medium',
      type: 'task',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'ADM-41',
      projectId: 'admired',
      title: 'Clarify member approval states',
      description: 'Confirm the states needed by the portal team.',
      status: 'backlog',
      priority: 'high',
      type: 'improvement',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'QPA-83',
      projectId: 'qpaint',
      title: 'Review capacity availability edge case',
      description: 'Validate scheduling behaviour when a crew is partially allocated.',
      status: 'in_progress',
      priority: 'critical',
      type: 'bug',
      createdAt: now,
      updatedAt: now,
    },
  ],
  comments: [],
  checklistItems: [],
  meetings: [],
}

type NewWorkItem = Pick<WorkItem, 'projectId' | 'title' | 'description' | 'priority' | 'type'> &
  Partial<Pick<WorkItem, 'status'>>
type WorkspaceContextValue = WorkspaceSnapshot & {
  source: 'loading' | 'local' | 'supabase'
  error: string | null
  addWorkItem: (item: NewWorkItem) => Promise<void>
  updateWorkItem: (id: string, changes: Partial<WorkItem>) => Promise<void>
  addProject: (project: Pick<Project, 'name' | 'description'>) => Promise<void>
  updateProject: (id: string, changes: Pick<Project, 'name' | 'description'>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  deleteWorkItem: (id: string) => Promise<void>
  loadWorkItemDetails: (workItemId: string) => Promise<void>
  addComment: (workItemId: string, body: string) => Promise<void>
  addChecklistItem: (workItemId: string, body: string) => Promise<void>
  updateChecklistItem: (id: string, completed: boolean) => Promise<void>
  addMeeting: (meeting: Pick<Meeting, 'projectId' | 'title' | 'notes' | 'summary'>) => Promise<void>
}
type DbProject = { id: string; name: string; description: string; created_at: string }
type DbWorkItem = {
  id: string
  project_id: string
  title: string
  description: string
  status: WorkItem['status']
  priority: WorkItem['priority']
  type: WorkItem['type']
  created_at: string
  updated_at: string
}
type DbComment = {
  id: string
  work_item_id: string
  body: string
  created_at: string
}
type DbChecklistItem = {
  id: string
  work_item_id: string
  body: string
  completed: boolean
  position: number
  created_at: string
}
type DbMeeting = {
  id: string
  project_id: string | null
  title: string
  notes: string
  summary: string | null
  created_at: string
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
const mapProject = (project: DbProject): Project => ({
  id: project.id,
  name: project.name,
  description: project.description,
  color: 'zinc',
  createdAt: project.created_at,
})
const mapWorkItem = (item: DbWorkItem): WorkItem => ({
  id: item.id,
  projectId: item.project_id,
  title: item.title,
  description: item.description,
  status: item.status,
  priority: item.priority,
  type: item.type,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
})
const mapComment = (comment: DbComment): WorkItemComment => ({
  id: comment.id,
  workItemId: comment.work_item_id,
  body: comment.body,
  createdAt: comment.created_at,
})
const mapChecklistItem = (item: DbChecklistItem): ChecklistItem => ({
  id: item.id,
  workItemId: item.work_item_id,
  body: item.body,
  completed: item.completed,
  position: item.position,
  createdAt: item.created_at,
})
const mapMeeting = (meeting: DbMeeting): Meeting => ({
  id: meeting.id,
  projectId: meeting.project_id,
  title: meeting.title,
  notes: meeting.notes,
  summary: meeting.summary,
  createdAt: meeting.created_at,
})

function loadLocal(): WorkspaceSnapshot {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return seed
    const parsed = JSON.parse(stored) as Partial<WorkspaceSnapshot>
    return {
      projects: parsed.projects ?? seed.projects,
      workItems: parsed.workItems ?? seed.workItems,
      comments: parsed.comments ?? [],
      checklistItems: parsed.checklistItems ?? [],
      meetings: parsed.meetings ?? [],
    }
  } catch {
    return seed
  }
}

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { user, mode } = useAuth()
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>({
    projects: [],
    workItems: [],
    comments: [],
    checklistItems: [],
    meetings: [],
  })
  const [source, setSource] = useState<WorkspaceContextValue['source']>('loading')
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const saveLocal = useCallback((next: WorkspaceSnapshot) => {
    setSnapshot(next)
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  }, [])

  useEffect(() => {
    let active = true
    const connect = async () => {
      if (!supabase) {
        if (active) {
          setSnapshot(loadLocal())
          setSource('local')
        }
        return
      }
      if (mode === 'loading' || !user) return
      const [projectsResult, itemsResult, meetingsResult] = await Promise.all([
        supabase.from('projects').select('*').order('created_at'),
        supabase.from('work_items').select('*').order('created_at', { ascending: false }),
        supabase.from('meetings').select('*').order('created_at', { ascending: false }),
      ])
      if (projectsResult.error || itemsResult.error || meetingsResult.error) {
        if (active) {
          setError(
            projectsResult.error?.message ??
              itemsResult.error?.message ??
              meetingsResult.error?.message ??
              'Could not load Forge data.',
          )
          setSnapshot(loadLocal())
          setSource('local')
        }
        return
      }
      if (active) {
        setUserId(user.id)
        setSnapshot({
          projects: (projectsResult.data as DbProject[]).map(mapProject),
          workItems: (itemsResult.data as DbWorkItem[]).map(mapWorkItem),
          comments: [],
          checklistItems: [],
          meetings: (meetingsResult.data as DbMeeting[]).map(mapMeeting),
        })
        setSource('supabase')
      }
    }
    void connect()
    return () => {
      active = false
    }
  }, [mode, user])

  const addProject = async (project: Pick<Project, 'name' | 'description'>) => {
    if (!supabase || source !== 'supabase' || !userId) {
      const next = {
        ...snapshot,
        projects: [
          ...snapshot.projects,
          {
            id: crypto.randomUUID(),
            name: project.name,
            description: project.description,
            color: 'zinc',
            createdAt: new Date().toISOString(),
          },
        ],
      }
      saveLocal(next)
      return
    }
    const { data, error: insertError } = await supabase
      .from('projects')
      .insert({ owner_id: userId, name: project.name, description: project.description })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    setSnapshot((current) => ({
      ...current,
      projects: [...current.projects, mapProject(data as DbProject)],
    }))
  }
  const addWorkItem = async (item: NewWorkItem) => {
    if (!supabase || source !== 'supabase' || !userId) {
      const timestamp = new Date().toISOString()
      const nextItem: WorkItem = {
        id: crypto.randomUUID(),
        ...item,
        status: item.status ?? 'backlog',
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      saveLocal({ ...snapshot, workItems: [nextItem, ...snapshot.workItems] })
      return
    }
    const { data, error: insertError } = await supabase
      .from('work_items')
      .insert({
        project_id: item.projectId,
        created_by: userId,
        title: item.title,
        description: item.description,
        priority: item.priority,
        type: item.type,
        status: item.status ?? 'backlog',
      })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    setSnapshot((current) => ({
      ...current,
      workItems: [mapWorkItem(data as DbWorkItem), ...current.workItems],
    }))
  }
  const updateProject = async (id: string, changes: Pick<Project, 'name' | 'description'>) => {
    if (!supabase || source !== 'supabase') {
      saveLocal({
        ...snapshot,
        projects: snapshot.projects.map((project) =>
          project.id === id ? { ...project, ...changes } : project,
        ),
      })
      return
    }
    const { data, error: updateError } = await supabase
      .from('projects')
      .update(changes)
      .eq('id', id)
      .select()
      .single()
    if (updateError) {
      setError(updateError.message)
      return
    }
    setSnapshot((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === id ? mapProject(data as DbProject) : project,
      ),
    }))
  }
  const deleteProject = async (id: string) => {
    if (!supabase || source !== 'supabase') {
      saveLocal({
        ...snapshot,
        projects: snapshot.projects.filter((project) => project.id !== id),
        workItems: snapshot.workItems.filter((item) => item.projectId !== id),
      })
      return
    }
    const { error: deleteError } = await supabase.from('projects').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setSnapshot((current) => ({
      ...current,
      projects: current.projects.filter((project) => project.id !== id),
      workItems: current.workItems.filter((item) => item.projectId !== id),
    }))
  }
  const updateWorkItem = async (id: string, changes: Partial<WorkItem>) => {
    if (!supabase || source !== 'supabase') {
      saveLocal({
        ...snapshot,
        workItems: snapshot.workItems.map((item) =>
          item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item,
        ),
      })
      return
    }
    const update = {
      ...(changes.status ? { status: changes.status } : {}),
      ...(changes.priority ? { priority: changes.priority } : {}),
      ...(changes.type ? { type: changes.type } : {}),
      ...(changes.title ? { title: changes.title } : {}),
      ...(changes.description !== undefined ? { description: changes.description } : {}),
    }
    const { data, error: updateError } = await supabase
      .from('work_items')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    if (updateError) {
      setError(updateError.message)
      return
    }
    setSnapshot((current) => ({
      ...current,
      workItems: current.workItems.map((item) =>
        item.id === id ? mapWorkItem(data as DbWorkItem) : item,
      ),
    }))
  }
  const deleteWorkItem = async (id: string) => {
    if (!supabase || source !== 'supabase') {
      saveLocal({ ...snapshot, workItems: snapshot.workItems.filter((item) => item.id !== id) })
      return
    }
    const { error: deleteError } = await supabase.from('work_items').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setSnapshot((current) => ({
      ...current,
      workItems: current.workItems.filter((item) => item.id !== id),
      comments: current.comments.filter((entry) => entry.workItemId !== id),
      checklistItems: current.checklistItems.filter((entry) => entry.workItemId !== id),
    }))
  }
  const loadWorkItemDetails = useCallback(
    async (workItemId: string) => {
      if (!supabase || source !== 'supabase') return
      const [commentsResult, checklistResult] = await Promise.all([
        supabase.from('comments').select('*').eq('work_item_id', workItemId).order('created_at'),
        supabase.from('checklists').select('*').eq('work_item_id', workItemId).order('position'),
      ])
      if (commentsResult.error || checklistResult.error) {
        setError(
          commentsResult.error?.message ??
            checklistResult.error?.message ??
            'Could not load work-item details.',
        )
        return
      }
      setSnapshot((current) => ({
        ...current,
        comments: [
          ...current.comments.filter((comment) => comment.workItemId !== workItemId),
          ...(commentsResult.data as DbComment[]).map(mapComment),
        ],
        checklistItems: [
          ...current.checklistItems.filter((item) => item.workItemId !== workItemId),
          ...(checklistResult.data as DbChecklistItem[]).map(mapChecklistItem),
        ],
      }))
    },
    [source],
  )
  const addComment = async (workItemId: string, body: string) => {
    const trimmedBody = body.trim()
    if (!trimmedBody) return
    if (!supabase || source !== 'supabase' || !userId) {
      const nextComment: WorkItemComment = {
        id: crypto.randomUUID(),
        workItemId,
        body: trimmedBody,
        createdAt: new Date().toISOString(),
      }
      saveLocal({ ...snapshot, comments: [...snapshot.comments, nextComment] })
      return
    }
    const { data, error: insertError } = await supabase
      .from('comments')
      .insert({ work_item_id: workItemId, created_by: userId, body: trimmedBody })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    setSnapshot((current) => ({
      ...current,
      comments: [...current.comments, mapComment(data as DbComment)],
    }))
  }
  const addChecklistItem = async (workItemId: string, body: string) => {
    const trimmedBody = body.trim()
    if (!trimmedBody) return
    const position = snapshot.checklistItems.filter((item) => item.workItemId === workItemId).length
    if (!supabase || source !== 'supabase') {
      const nextItem: ChecklistItem = {
        id: crypto.randomUUID(),
        workItemId,
        body: trimmedBody,
        completed: false,
        position,
        createdAt: new Date().toISOString(),
      }
      saveLocal({ ...snapshot, checklistItems: [...snapshot.checklistItems, nextItem] })
      return
    }
    const { data, error: insertError } = await supabase
      .from('checklists')
      .insert({ work_item_id: workItemId, body: trimmedBody, position })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    setSnapshot((current) => ({
      ...current,
      checklistItems: [...current.checklistItems, mapChecklistItem(data as DbChecklistItem)],
    }))
  }
  const updateChecklistItem = async (id: string, completed: boolean) => {
    if (!supabase || source !== 'supabase') {
      saveLocal({
        ...snapshot,
        checklistItems: snapshot.checklistItems.map((item) =>
          item.id === id ? { ...item, completed } : item,
        ),
      })
      return
    }
    const { data, error: updateError } = await supabase
      .from('checklists')
      .update({ completed })
      .eq('id', id)
      .select()
      .single()
    if (updateError) {
      setError(updateError.message)
      return
    }
    setSnapshot((current) => ({
      ...current,
      checklistItems: current.checklistItems.map((item) =>
        item.id === id ? mapChecklistItem(data as DbChecklistItem) : item,
      ),
    }))
  }
  const addMeeting = async (
    meeting: Pick<Meeting, 'projectId' | 'title' | 'notes' | 'summary'>,
  ) => {
    if (!supabase || source !== 'supabase' || !userId) {
      const nextMeeting: Meeting = {
        id: crypto.randomUUID(),
        ...meeting,
        createdAt: new Date().toISOString(),
      }
      saveLocal({ ...snapshot, meetings: [nextMeeting, ...snapshot.meetings] })
      return
    }
    const { data, error: insertError } = await supabase
      .from('meetings')
      .insert({
        project_id: meeting.projectId,
        created_by: userId,
        title: meeting.title,
        notes: meeting.notes,
        summary: meeting.summary,
      })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    setSnapshot((current) => ({
      ...current,
      meetings: [mapMeeting(data as DbMeeting), ...current.meetings],
    }))
  }
  const value: WorkspaceContextValue = {
    ...snapshot,
    source,
    error,
    addProject,
    updateProject,
    deleteProject,
    addWorkItem,
    updateWorkItem,
    deleteWorkItem,
    loadWorkItemDetails,
    addComment,
    addChecklistItem,
    updateChecklistItem,
    addMeeting,
  }
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return value
}
