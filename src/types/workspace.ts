export type WorkItemStatus = 'backlog' | 'in_progress' | 'in_review' | 'done'
export type WorkItemPriority = 'critical' | 'high' | 'medium' | 'low'
export type WorkItemType = 'task' | 'bug' | 'feature' | 'idea' | 'research' | 'improvement'

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
