import { useMemo, useState } from 'react'
import { Check, Columns3, List, Plus, X } from 'lucide-react'
import { useWorkspace } from '@/features/workspace/workspace-store'
import type { WorkItem, WorkItemPriority, WorkItemStatus, WorkItemType } from '@/types/workspace'
import { WorkItemDetail } from './work-item-detail'
import { formatDateTime, idleState, ticketLabels } from './work-item-utils'

const statuses: Array<{ value: WorkItemStatus; label: string }> = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'in_review', label: 'In review' },
  { value: 'done', label: 'Done' },
]
const statusFilters: Array<{ value: WorkItemStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  ...statuses,
]
const priorityStyles: Record<WorkItemPriority, string> = {
  critical: 'bg-rose-400/10 text-rose-300 ring-rose-400/20',
  high: 'bg-amber-400/10 text-amber-300 ring-amber-400/20',
  medium: 'bg-sky-400/10 text-sky-300 ring-sky-400/20',
  low: 'bg-zinc-400/10 text-zinc-400 ring-zinc-400/20',
}
const typeStyles: Record<WorkItemType, string> = {
  task: 'text-zinc-500',
  bug: 'text-rose-300',
  feature: 'text-violet-300',
  idea: 'text-amber-300',
  research: 'text-cyan-300',
  improvement: 'text-emerald-300',
}
const statusStyles: Record<WorkItemStatus, string> = {
  backlog: 'text-zinc-500',
  in_progress: 'text-sky-300',
  in_review: 'text-violet-300',
  done: 'text-emerald-300',
}
const priorities: WorkItemPriority[] = ['critical', 'high', 'medium', 'low']
const types: WorkItemType[] = ['task', 'bug', 'feature', 'idea', 'research', 'improvement']

export function WorkItemsPage() {
  const { workItems, projects, addWorkItem, updateWorkItem, addProject, source, error } =
    useWorkspace()
  const [view, setView] = useState<'list' | 'board'>('board')
  const [activeStatus, setActiveStatus] = useState<WorkItemStatus | 'all'>('all')
  const [isCreating, setIsCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('item'),
  )
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [priority, setPriority] = useState<WorkItemPriority>('medium')
  const [type, setType] = useState<WorkItemType>('task')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropStatus, setDropStatus] = useState<WorkItemStatus | null>(null)
  const visible = useMemo(
    () =>
      activeStatus === 'all' ? workItems : workItems.filter((item) => item.status === activeStatus),
    [activeStatus, workItems],
  )
  const selectedItem = workItems.find((item) => item.id === selectedId) ?? null
  const labels = useMemo(() => ticketLabels(workItems), [workItems])
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !projectId) return
    addWorkItem({
      title: title.trim(),
      description: description.trim(),
      projectId,
      priority,
      type,
    })
    setTitle('')
    setDescription('')
    setPriority('medium')
    setType('task')
    setIsCreating(false)
  }
  const openForm = () => {
    setProjectId(projects[0]?.id ?? '')
    setIsCreating(true)
  }
  const openItem = (id: string) => {
    window.history.pushState({}, '', `/work-items?item=${encodeURIComponent(id)}`)
    setSelectedId(id)
  }
  const createProjectHere = async () => {
    const name = newProjectName.trim()
    if (!name) return
    const id = await addProject({ name, description: 'Created while adding a work item.' })
    if (id) {
      setProjectId(id)
      setNewProjectName('')
    }
  }
  const closeItem = () => {
    window.history.pushState({}, '', '/work-items')
    setSelectedId(null)
  }
  return (
    <section>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-zinc-500">One flexible record for execution</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Work items</h1>
          <p className="mt-2 text-zinc-500">Tasks, bugs, features, and ideas live in one place.</p>
        </div>
        <button
          onClick={openForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white"
        >
          <Plus className="size-4" />
          New work item
        </button>
      </div>
      {source === 'loading' && (
        <p className="mt-6 text-sm text-zinc-500">Connecting to your workspace…</p>
      )}
      {error && (
        <p className="mt-6 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Database connection issue: {error}.{' '}
          {source === 'local'
            ? 'Using local data instead.'
            : 'Some changes may not save until it is resolved.'}
        </p>
      )}
      {isCreating && (
        <form onSubmit={submit} className="mt-8 rounded-2xl bg-white/[0.04] p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">New work item</h2>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-zinc-500 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_12rem]">
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What needs to happen?"
              className="rounded-lg bg-black/20 px-3 py-2.5 text-zinc-100 outline-none ring-1 ring-white/[0.08] placeholder:text-zinc-600 focus:ring-white/30"
            />
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="rounded-lg bg-black/20 px-3 py-2.5 text-zinc-300 outline-none ring-1 ring-white/[0.08]"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              onKeyDown={(event) =>
                event.key === 'Enter' && (event.preventDefault(), void createProjectHere())
              }
              placeholder="New project name"
              className="min-w-0 flex-1 rounded-lg bg-black/20 px-3 py-2 text-sm text-zinc-200 outline-none ring-1 ring-white/[.08]"
            />
            <button
              type="button"
              onClick={() => void createProjectHere()}
              className="rounded-lg bg-white/[.08] px-3 text-sm text-zinc-200 hover:bg-[#29282b] hover:text-[#eee9df]"
            >
              Add project
            </button>
          </div>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add context, acceptance criteria, or a useful note."
            rows={3}
            className="mt-4 w-full resize-none rounded-lg bg-black/20 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-1 ring-white/[0.08] placeholder:text-zinc-600 focus:ring-white/30"
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-zinc-400">
              Type
              <select
                value={type}
                onChange={(event) => setType(event.target.value as WorkItemType)}
                className="mt-2 w-full rounded-lg bg-black/20 px-3 py-2.5 text-zinc-300 outline-none ring-1 ring-white/[0.08]"
              >
                {types.map((itemType) => (
                  <option key={itemType} value={itemType}>
                    {itemType}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-zinc-400">
              Priority
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as WorkItemPriority)}
                className="mt-2 w-full rounded-lg bg-black/20 px-3 py-2.5 text-zinc-300 outline-none ring-1 ring-white/[0.08]"
              >
                {priorities.map((itemPriority) => (
                  <option key={itemPriority} value={itemPriority}>
                    {itemPriority}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950">
              Create item
            </button>
          </div>
        </form>
      )}
      <div className="mt-10 flex flex-wrap items-center gap-1">
        <div className="flex rounded-lg bg-white/[0.035] p-1">
          {(
            [
              ['board', Columns3],
              ['list', List],
            ] as const
          ).map(([value, Icon]) => (
            <button
              key={value}
              onClick={() => setView(value)}
              aria-label={`${value} view`}
              className={`rounded-md p-1.5 ${view === value ? 'bg-white/[0.09] text-white' : 'text-zinc-500 hover:text-white'}`}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
        <div className="ml-2 flex flex-wrap gap-1">
          {statusFilters.map((status) => (
            <button
              key={status.value}
              onClick={() => setActiveStatus(status.value)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${activeStatus === status.value ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'}`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>
      {view === 'board' ? (
        <Kanban
          items={visible}
          projects={projects}
          updateWorkItem={updateWorkItem}
          onSelect={openItem}
          labels={labels}
          draggedId={draggedId}
          dropStatus={dropStatus}
          onDragStart={setDraggedId}
          onDragEnd={() => {
            setDraggedId(null)
            setDropStatus(null)
          }}
          onDragOver={setDropStatus}
          onDrop={(status) => {
            if (draggedId) void updateWorkItem(draggedId, { status })
            setDraggedId(null)
            setDropStatus(null)
          }}
        />
      ) : (
        <ListView
          items={visible}
          projects={projects}
          updateWorkItem={updateWorkItem}
          onSelect={openItem}
          labels={labels}
        />
      )}
      {selectedItem && (
        <>
          <button
            aria-label="Close work item details"
            onClick={closeItem}
            className="fixed inset-0 z-20 cursor-default bg-black/45"
          />
          <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-xl overflow-y-auto bg-[#121216] p-5 shadow-2xl ring-1 ring-white/[0.08] sm:p-7">
            <WorkItemDetail
              item={selectedItem}
              ticket={labels.get(selectedItem.id) ?? 'T-?'}
              onClose={closeItem}
              onDelete={closeItem}
            />
          </aside>
        </>
      )}
    </section>
  )
}

function Kanban({
  items,
  projects,
  updateWorkItem,
  onSelect,
  labels,
  draggedId,
  dropStatus,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  items: WorkItem[]
  projects: ReturnType<typeof useWorkspace>['projects']
  updateWorkItem: ReturnType<typeof useWorkspace>['updateWorkItem']
  onSelect: (id: string) => void
  labels: Map<string, string>
  draggedId: string | null
  dropStatus: WorkItemStatus | null
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDragOver: (status: WorkItemStatus) => void
  onDrop: (status: WorkItemStatus) => void
}) {
  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-4">
      {statuses.map((column) => (
        <section
          key={column.value}
          onDragOver={(event) => {
            event.preventDefault()
            onDragOver(column.value)
          }}
          onDrop={() => onDrop(column.value)}
          className={`min-h-56 rounded-2xl p-4 transition ${dropStatus === column.value ? 'bg-sky-400/[0.06] ring-2 ring-dashed ring-sky-300/70' : draggedId ? 'bg-white/[0.04] ring-1 ring-white/[0.08]' : 'bg-white/[0.025]'}`}
        >
          <header className="mb-4 flex items-center justify-between px-1 text-sm">
            <span className={statusStyles[column.value]}>{column.label}</span>
            <span className="text-zinc-600">
              {items.filter((item) => item.status === column.value).length}
            </span>
          </header>
          <div className="space-y-3">
            {items
              .filter((item) => item.status === column.value)
              .map((item) => (
                <WorkCard
                  key={item.id}
                  item={item}
                  projectName={
                    projects.find((project) => project.id === item.projectId)?.name ?? 'Unknown'
                  }
                  onAdvance={() => updateWorkItem(item.id, { status: nextStatus(item.status) })}
                  onSelect={() => onSelect(item.id)}
                  onDragStart={() => onDragStart(item.id)}
                  onDragEnd={onDragEnd}
                  ticket={labels.get(item.id) ?? 'T-?'}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
function ListView({
  items,
  projects,
  updateWorkItem,
  onSelect,
  labels,
}: {
  items: WorkItem[]
  projects: ReturnType<typeof useWorkspace>['projects']
  updateWorkItem: ReturnType<typeof useWorkspace>['updateWorkItem']
  onSelect: (id: string) => void
  labels: Map<string, string>
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl bg-white/[0.025]">
      {items.map((item) => (
        <article
          key={item.id}
          onClick={() => onSelect(item.id)}
          className="grid cursor-pointer gap-3 px-6 py-4 transition hover:bg-white/[0.035] md:grid-cols-[minmax(0,1fr)_9rem_8rem_7rem] md:items-center md:gap-4"
        >
          <div>
            <p className="text-sm font-medium text-zinc-200">{item.title}</p>
            <p className="mt-1 text-xs text-zinc-600">
              {labels.get(item.id) ?? 'T-?'} /{' '}
              <span className={typeStyles[item.type]}>{item.type}</span> /{' '}
              <span className={idleState(item.updatedAt).className}>
                {idleState(item.updatedAt).label}
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-600">Created {formatDateTime(item.createdAt)}</p>
          </div>
          <p className="text-sm text-zinc-500">
            {projects.find((project) => project.id === item.projectId)?.name}
          </p>
          <button
            onClick={(event) => {
              event.stopPropagation()
              void updateWorkItem(item.id, { status: nextStatus(item.status) })
            }}
            className={`w-fit text-left text-sm hover:text-white ${statusStyles[item.status]}`}
          >
            {labelForStatus(item.status)}
          </button>
          <span
            className={`w-fit rounded-md px-2 py-1 text-xs font-medium ring-1 ${priorityStyles[item.priority]}`}
          >
            {item.priority}
          </span>
        </article>
      ))}
    </div>
  )
}
function WorkCard({
  item,
  projectName,
  onAdvance,
  onSelect,
  onDragStart,
  onDragEnd,
  ticket,
}: {
  item: WorkItem
  projectName: string
  onAdvance: () => void
  onSelect: () => void
  onDragStart: () => void
  onDragEnd: () => void
  ticket: string
}) {
  return (
    <article
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="cursor-grab rounded-xl bg-white/[0.05] p-4 transition hover:bg-white/[0.075] active:cursor-grabbing"
    >
      <p className="text-sm font-medium leading-5 text-zinc-200">{item.title}</p>
      <p className="mt-3 text-xs text-zinc-600">
        {ticket} / {projectName} /{' '}
        <span className={idleState(item.updatedAt).className}>
          {idleState(item.updatedAt).label}
        </span>
      </p>
      <p className="mt-1 text-xs text-zinc-600">Created {formatDateTime(item.createdAt)}</p>
      <div className="mt-4 flex items-center justify-between">
        <span
          className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ${priorityStyles[item.priority]}`}
        >
          {item.priority}
        </span>
        <button
          onClick={(event) => {
            event.stopPropagation()
            onAdvance()
          }}
          aria-label={`Advance ${item.title}`}
          className="rounded-md p-1 text-zinc-500 transition hover:bg-white/[0.08] hover:text-white"
        >
          <Check className="size-3.5" />
        </button>
      </div>
    </article>
  )
}
function nextStatus(status: WorkItemStatus): WorkItemStatus {
  return statuses[(statuses.findIndex((item) => item.value === status) + 1) % statuses.length].value
}
function labelForStatus(status: WorkItemStatus) {
  return statuses.find((item) => item.value === status)?.label ?? status
}
