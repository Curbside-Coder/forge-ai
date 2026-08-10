export type WorkItemStatus = 'Backlog' | 'In progress' | 'In review' | 'Done'
export type WorkItemPriority = 'Critical' | 'High' | 'Medium' | 'Low'

export type WorkItem = {
  id: string
  title: string
  project: string
  status: WorkItemStatus
  priority: WorkItemPriority
  type: 'Feature' | 'Task' | 'Bug' | 'Improvement'
}

export const initialWorkItems: WorkItem[] = [
  {
    id: 'FOR-12',
    title: 'Define meeting import flow',
    project: 'Forge',
    status: 'In progress',
    priority: 'High',
    type: 'Feature',
  },
  {
    id: 'FOR-9',
    title: 'Map the first work-item states',
    project: 'Forge',
    status: 'In review',
    priority: 'Medium',
    type: 'Task',
  },
  {
    id: 'ADM-41',
    title: 'Clarify member approval states',
    project: 'Admired',
    status: 'Backlog',
    priority: 'High',
    type: 'Improvement',
  },
  {
    id: 'QPA-83',
    title: 'Review capacity availability edge case',
    project: 'QPaint',
    status: 'In progress',
    priority: 'Critical',
    type: 'Bug',
  },
]
