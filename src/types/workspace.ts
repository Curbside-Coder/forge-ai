export type WorkItemStatus = 'backlog' | 'in_progress' | 'in_review' | 'done'
export type WorkItemPriority = 'critical' | 'high' | 'medium' | 'low'
export type WorkItemType = 'task' | 'bug' | 'feature' | 'idea' | 'research' | 'improvement'
export type SpecStatus = 'draft' | 'active' | 'blocked' | 'completed' | 'archived'
export type SpecStepStatus = 'todo' | 'in_progress' | 'blocked' | 'done'

export type Project = {
  id: string
  name: string
  description: string
  color: string
  createdAt: string
}

export type WorkItem = {
  id: string
  projectId: string
  title: string
  description: string
  status: WorkItemStatus
  priority: WorkItemPriority
  type: WorkItemType
  createdAt: string
  updatedAt: string
  specId?: string | null
  effortMinutes?: number | null
  dueAt?: string | null
  leverage?: number
  importance?: number
}

export type Spec = {
  id: string
  projectId: string | null
  title: string
  problemStatement: string
  desiredOutcome: string
  inScope: string
  outOfScope: string
  technicalContext: string
  edgeCases: string
  retrospective: string
  status: SpecStatus
  priority: WorkItemPriority
  activePosition: number | null
  createdAt: string
  updatedAt: string
}

export type SpecStep = {
  id: string
  specId: string
  title: string
  notes: string
  status: SpecStepStatus
  estimateMinutes: number
  position: number
  workItemId: string | null
  createdAt: string
  updatedAt: string
}

export type FocusSession = {
  id: string
  specStepId: string | null
  workItemId: string | null
  title: string
  plannedMinutes: number
  startedAt: string
  completedAt: string | null
  interruptionNote: string | null
}

export type WorkItemComment = {
  id: string
  workItemId: string
  body: string
  createdAt: string
}

export type ChecklistItem = {
  id: string
  workItemId: string
  body: string
  completed: boolean
  position: number
  createdAt: string
}

export type Meeting = {
  id: string
  projectId: string | null
  title: string
  notes: string
  summary: string | null
  createdAt: string
}

export type WorkspaceSnapshot = {
  projects: Project[]
  workItems: WorkItem[]
  comments: WorkItemComment[]
  checklistItems: ChecklistItem[]
  meetings: Meeting[]
}
