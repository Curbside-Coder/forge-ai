import { useMemo, useState } from 'react'
import { Check, Columns3, Filter, Link2, List, Plus, Search, Share2, Trash2, X } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-provider'
import { useWorkspace } from '@/features/workspace/workspace-store'
import { supabase } from '@/lib/supabase'
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
type FilterField =
  | 'id'
  | 'ticket'
  | 'title'
  | 'description'
  | 'project'
  | 'projectId'
  | 'status'
  | 'priority'
  | 'type'
  | 'createdAt'
  | 'updatedAt'
  | 'dueAt'
  | 'effortMinutes'
  | 'leverage'
  | 'importance'
  | 'specId'
type FilterOperator =
  | 'contains'
  | 'equals'
  | 'not_equals'
  | 'is_empty'
  | 'before'
  | 'after'
  | 'greater_than'
  | 'less_than'
type FilterRule = {
  id: string
  kind: 'rule'
  field: FilterField
  operator: FilterOperator
  value: string
}
type FilterGroup = {
  id: string
  kind: 'group'
  combinator: 'and' | 'or'
  negated: boolean
  children: FilterNode[]
}
type FilterNode = FilterRule | FilterGroup
const filterFields: Array<{
  value: FilterField
  label: string
  kind: 'text' | 'select' | 'date' | 'number'
}> = [
  { value: 'id', label: 'Record ID', kind: 'text' },
  { value: 'ticket', label: 'Ticket', kind: 'text' },
  { value: 'title', label: 'Title', kind: 'text' },
  { value: 'description', label: 'Description', kind: 'text' },
  { value: 'project', label: 'Project', kind: 'text' },
  { value: 'projectId', label: 'Project ID', kind: 'text' },
  { value: 'status', label: 'Status', kind: 'select' },
  { value: 'priority', label: 'Priority', kind: 'select' },
  { value: 'type', label: 'Type', kind: 'select' },
  { value: 'createdAt', label: 'Created', kind: 'date' },
  { value: 'updatedAt', label: 'Last updated', kind: 'date' },
  { value: 'dueAt', label: 'Due date', kind: 'date' },
  { value: 'effortMinutes', label: 'Effort (minutes)', kind: 'number' },
  { value: 'leverage', label: 'Leverage', kind: 'number' },
  { value: 'importance', label: 'Importance', kind: 'number' },
  { value: 'specId', label: 'Plan ID', kind: 'text' },
]
const emptyFilter: FilterGroup = {
  id: 'root',
  kind: 'group',
  combinator: 'and',
  negated: false,
  children: [],
}

export function WorkItemsPage() {
  const { user } = useAuth()
  const { workItems, projects, addWorkItem, updateWorkItem, addProject, source, error } =
    useWorkspace()
  const [view, setView] = useState<'list' | 'board'>('board')
  const [activeStatus, setActiveStatus] = useState<WorkItemStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterGroup>(emptyFilter)
  const [showFilters, setShowFilters] = useState(false)
  const [showShare, setShowShare] = useState(false)
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
  const labels = useMemo(() => ticketLabels(workItems), [workItems])
  const visible = useMemo(
    () =>
      workItems.filter((item) => {
        const project = projects.find((entry) => entry.id === item.projectId)?.name ?? ''
        const ticket = labels.get(item.id) ?? ''
        const matchesStatus = activeStatus === 'all' || item.status === activeStatus
        return (
          matchesStatus &&
          matchesSearch(item, project, ticket, search) &&
          matchesGroup(item, project, ticket, filters)
        )
      }),
    [activeStatus, filters, labels, projects, search, workItems],
  )
  const selectedItem = workItems.find((item) => item.id === selectedId) ?? null
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
        <button
          onClick={() => setShowShare(true)}
          disabled={!user || !supabase}
          className="inline-flex items-center gap-2 rounded-lg bg-white/[.035] px-3 py-2 text-sm text-zinc-300 ring-1 ring-white/[.08] transition hover:bg-[#29282b] hover:text-[#eee9df] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Share2 className="size-4" />
          Share view
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
      <div className="mt-10 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[15rem] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search every work-item field"
            className="w-full rounded-lg bg-black/20 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none ring-1 ring-white/[.08] placeholder:text-zinc-600 focus:ring-sky-300/40"
          />
        </label>
        <button
          onClick={() => setShowFilters(true)}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 transition ${filters.children.length ? 'bg-sky-400/[.12] text-sky-100 ring-sky-300/40' : 'bg-white/[.035] text-zinc-300 ring-white/[.08] hover:bg-[#29282b] hover:text-[#eee9df]'}`}
        >
          <Filter className="size-4" />
          Filters{filters.children.length ? ` (${countFilterRules(filters)})` : ''}
        </button>
        {(search || filters.children.length > 0) && (
          <button
            onClick={() => {
              setSearch('')
              setFilters(emptyFilter)
            }}
            className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            Clear
          </button>
        )}
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
      <p className="mt-3 text-xs text-zinc-600">
        {visible.length} of {workItems.length} work items shown
      </p>
      {showFilters && (
        <FilterBuilder
          value={filters}
          projects={projects}
          onChange={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}
      {showShare && user && (
        <ShareViewDrawer
          ownerId={user.id}
          items={visible}
          projects={projects}
          labels={labels}
          filterDefinition={{ search, activeStatus, filters }}
          onClose={() => setShowShare(false)}
        />
      )}
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

function FilterBuilder({
  value,
  projects,
  onChange,
  onClose,
}: {
  value: FilterGroup
  projects: ReturnType<typeof useWorkspace>['projects']
  onChange: (value: FilterGroup) => void
  onClose: () => void
}) {
  const addRule = (groupId: string) => onChange(addFilterNode(value, groupId, newFilterRule()))
  const addGroup = (groupId: string) =>
    onChange(
      addFilterNode(value, groupId, {
        id: filterId(),
        kind: 'group',
        combinator: 'and',
        negated: false,
        children: [newFilterRule()],
      }),
    )
  return (
    <>
      <button
        aria-label="Close filters"
        onClick={onClose}
        className="fixed inset-0 z-20 cursor-default bg-black/45"
      />
      <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-2xl overflow-y-auto bg-[#121216] p-5 shadow-2xl ring-1 ring-white/[.08] sm:p-7">
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 className="text-xl font-semibold tracking-[-.02em]">Filter work items</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Combine any field with nested AND, OR, and NOT rules.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            Done
          </button>
        </div>
        <FilterGroupEditor
          group={value}
          projects={projects}
          depth={0}
          root
          onAddRule={addRule}
          onAddGroup={addGroup}
          onChange={(id, changes) => onChange(updateFilterNode(value, id, changes) as FilterGroup)}
          onRemove={(id) => onChange(removeFilterNode(value, id))}
        />
        <div className="mt-6 flex items-center justify-between border-t border-white/[.07] pt-5">
          <button
            onClick={() => onChange(emptyFilter)}
            className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            Reset all filters
          </button>
          <p className="text-xs text-zinc-600">
            {countFilterRules(value)} active rule{countFilterRules(value) === 1 ? '' : 's'}
          </p>
        </div>
      </aside>
    </>
  )
}

function ShareViewDrawer({
  ownerId,
  items,
  projects,
  labels,
  filterDefinition,
  onClose,
}: {
  ownerId: string
  items: WorkItem[]
  projects: ReturnType<typeof useWorkspace>['projects']
  labels: Map<string, string>
  filterDefinition: unknown
  onClose: () => void
}) {
  const [name, setName] = useState('Work item view')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const save = async () => {
    if (!supabase || !name.trim()) return
    setSaving(true)
    setError(null)
    const snapshot = items.map((item) => ({
      id: item.id,
      ticket: labels.get(item.id) ?? 'T-?',
      title: item.title,
      description: item.description,
      projectName: projects.find((project) => project.id === item.projectId)?.name ?? '',
      status: item.status,
      priority: item.priority,
      type: item.type,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      dueAt: item.dueAt ?? null,
      effortMinutes: item.effortMinutes ?? null,
    }))
    const { data, error: issue } = await supabase
      .from('shared_work_item_views')
      .insert({
        owner_id: ownerId,
        name: name.trim(),
        filter_definition: filterDefinition,
        items: snapshot,
      })
      .select('token')
      .single()
    setSaving(false)
    if (issue || !data) {
      setError(issue?.message ?? 'Unable to save this shared view.')
      return
    }
    setShareUrl(`${window.location.origin}/shared/work-items/${data.token}`)
  }
  const copy = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
  }
  return (
    <>
      <button
        aria-label="Close share view"
        onClick={onClose}
        className="fixed inset-0 z-20 cursor-default bg-black/45"
      />
      <aside className="fixed inset-y-0 right-0 z-30 flex w-full max-w-xl flex-col overflow-y-auto bg-[#121216] p-5 shadow-2xl ring-1 ring-white/[.08] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-[-.02em]">Share this work-item view</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              Create a read-only link containing the {items.length} items currently shown. It never
              grants Forge access.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            Close
          </button>
        </div>
        {!shareUrl ? (
          <div className="mt-7">
            <label className="block text-sm text-zinc-300">
              View name
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Open client work"
                className="mt-2 w-full rounded-lg bg-black/20 px-3 py-2.5 text-zinc-100 outline-none ring-1 ring-white/[.08] placeholder:text-zinc-600 focus:ring-sky-300/40"
              />
            </label>
            <div className="mt-5 rounded-xl bg-white/[.025] p-4 text-sm text-zinc-400">
              <p className="font-medium text-zinc-200">What visitors can see</p>
              <p className="mt-2 leading-6">
                Title, status, priority, type, project, due date, effort, and description for the
                saved items. Comments, checklists, notes, AI, and editing controls stay private.
              </p>
            </div>
            {error && <p className="mt-4 text-sm text-rose-200">{error}</p>}
            <button
              onClick={() => void save()}
              disabled={saving || !name.trim()}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 disabled:opacity-40"
            >
              <Link2 className="size-4" />
              {saving ? 'Creating secure link…' : 'Create read-only link'}
            </button>
          </div>
        ) : (
          <div className="mt-7">
            <p className="text-sm font-medium text-emerald-200">Your view is ready to share.</p>
            <input
              readOnly
              value={shareUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-3 w-full rounded-lg bg-black/30 px-3 py-3 text-sm text-zinc-300 outline-none ring-1 ring-white/[.08]"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => void copy()}
                className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950"
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-white/[.07] px-4 py-2.5 text-sm text-zinc-200 hover:bg-[#29282b]"
              >
                Preview
              </a>
            </div>
            <p className="mt-5 text-xs leading-5 text-zinc-600">
              This is a static snapshot. Create a new link whenever you want to share refreshed
              results.
            </p>
          </div>
        )}
      </aside>
    </>
  )
}

function FilterGroupEditor({
  group,
  projects,
  depth,
  root = false,
  onAddRule,
  onAddGroup,
  onChange,
  onRemove,
}: {
  group: FilterGroup
  projects: ReturnType<typeof useWorkspace>['projects']
  depth: number
  root?: boolean
  onAddRule: (id: string) => void
  onAddGroup: (id: string) => void
  onChange: (id: string, changes: Partial<FilterNode>) => void
  onRemove: (id: string) => void
}) {
  return (
    <section
      className={`mt-6 rounded-xl border border-white/[.08] bg-white/[.025] p-3 ${depth ? 'ml-3' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Match</span>
        <button
          onClick={() =>
            onChange(group.id, { combinator: group.combinator === 'and' ? 'or' : 'and' })
          }
          className="rounded-md bg-white/[.08] px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-[#29282b]"
        >
          {group.combinator === 'and' ? 'ALL (AND)' : 'ANY (OR)'}
        </button>
        <button
          onClick={() => onChange(group.id, { negated: !group.negated })}
          className={`rounded-md px-2 py-1 text-xs font-medium ${group.negated ? 'bg-rose-400/[.15] text-rose-200' : 'bg-white/[.05] text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]'}`}
        >
          NOT {group.negated ? 'on' : 'off'}
        </button>
        {!root && (
          <button
            onClick={() => onRemove(group.id)}
            className="ml-auto rounded-md p-1 text-zinc-500 hover:bg-rose-400/10 hover:text-rose-200"
            aria-label="Remove nested group"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {group.children.map((child) =>
          child.kind === 'rule' ? (
            <FilterRuleEditor
              key={child.id}
              rule={child}
              projects={projects}
              onChange={(changes) => onChange(child.id, changes)}
              onRemove={() => onRemove(child.id)}
            />
          ) : (
            <FilterGroupEditor
              key={child.id}
              group={child}
              projects={projects}
              depth={depth + 1}
              onAddRule={onAddRule}
              onAddGroup={onAddGroup}
              onChange={onChange}
              onRemove={onRemove}
            />
          ),
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onAddRule(group.id)}
          className="rounded-lg bg-white/[.06] px-3 py-2 text-xs text-zinc-300 hover:bg-[#29282b] hover:text-[#eee9df]"
        >
          + Condition
        </button>
        <button
          onClick={() => onAddGroup(group.id)}
          className="rounded-lg px-3 py-2 text-xs text-zinc-500 hover:bg-[#29282b] hover:text-[#eee9df]"
        >
          + Nested group
        </button>
      </div>
    </section>
  )
}

function FilterRuleEditor({
  rule,
  projects,
  onChange,
  onRemove,
}: {
  rule: FilterRule
  projects: ReturnType<typeof useWorkspace>['projects']
  onChange: (changes: Partial<FilterRule>) => void
  onRemove: () => void
}) {
  const field = filterFields.find((entry) => entry.value === rule.field) ?? filterFields[0]
  const operators =
    field.kind === 'number'
      ? [
          ['equals', 'is'],
          ['not_equals', 'is not'],
          ['greater_than', 'greater than'],
          ['less_than', 'less than'],
          ['is_empty', 'is empty'],
        ]
      : field.kind === 'date'
        ? [
            ['equals', 'on'],
            ['before', 'before'],
            ['after', 'after'],
            ['is_empty', 'is empty'],
          ]
        : [
            ['contains', 'contains'],
            ['equals', 'is'],
            ['not_equals', 'is not'],
            ['is_empty', 'is empty'],
          ]
  const choices =
    rule.field === 'status'
      ? statuses.map((entry) => entry.value)
      : rule.field === 'priority'
        ? priorities
        : rule.field === 'type'
          ? types
          : rule.field === 'project'
            ? projects.map((project) => project.name)
            : null
  return (
    <div className="grid gap-2 rounded-lg bg-black/20 p-2 sm:grid-cols-[minmax(8rem,1fr)_minmax(7rem,.8fr)_minmax(8rem,1fr)_auto]">
      <select
        value={rule.field}
        onChange={(event) =>
          onChange({ field: event.target.value as FilterField, operator: 'contains', value: '' })
        }
        className="forge-select px-2 py-2 text-xs"
      >
        {filterFields.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </select>
      <select
        value={rule.operator}
        onChange={(event) => onChange({ operator: event.target.value as FilterOperator })}
        className="forge-select px-2 py-2 text-xs"
      >
        {operators.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {rule.operator === 'is_empty' ? (
        <p className="px-2 py-2 text-xs text-zinc-600">No value required</p>
      ) : choices ? (
        <select
          value={rule.value}
          onChange={(event) => onChange({ value: event.target.value })}
          className="forge-select px-2 py-2 text-xs"
        >
          <option value="">Choose…</option>
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.kind === 'date' ? 'date' : field.kind === 'number' ? 'number' : 'text'}
          value={rule.value}
          onChange={(event) => onChange({ value: event.target.value })}
          placeholder="Value"
          className="rounded-md bg-white/[.04] px-2 py-2 text-xs text-zinc-200 outline-none ring-1 ring-white/[.07] focus:ring-sky-300/40"
        />
      )}
      <button
        onClick={onRemove}
        className="rounded-md p-2 text-zinc-500 hover:bg-rose-400/10 hover:text-rose-200"
        aria-label="Remove condition"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
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

function filterId() {
  return `filter-${crypto.randomUUID()}`
}
function newFilterRule(): FilterRule {
  return { id: filterId(), kind: 'rule', field: 'title', operator: 'contains', value: '' }
}
function addFilterNode(group: FilterGroup, groupId: string, node: FilterNode): FilterGroup {
  if (group.id === groupId) return { ...group, children: [...group.children, node] }
  return {
    ...group,
    children: group.children.map((child) =>
      child.kind === 'group' ? addFilterNode(child, groupId, node) : child,
    ),
  }
}
function updateFilterNode(node: FilterNode, id: string, changes: Partial<FilterNode>): FilterNode {
  if (node.id === id) return { ...node, ...changes } as FilterNode
  if (node.kind === 'group')
    return { ...node, children: node.children.map((child) => updateFilterNode(child, id, changes)) }
  return node
}
function removeFilterNode(group: FilterGroup, id: string): FilterGroup {
  return {
    ...group,
    children: group.children
      .filter((child) => child.id !== id)
      .map((child) => (child.kind === 'group' ? removeFilterNode(child, id) : child)),
  }
}
function countFilterRules(node: FilterNode): number {
  return node.kind === 'rule'
    ? 1
    : node.children.reduce((total, child) => total + countFilterRules(child), 0)
}
function matchesSearch(item: WorkItem, project: string, ticket: string, query: string) {
  if (!query.trim()) return true
  const text = [
    ticket,
    item.id,
    item.title,
    item.description,
    project,
    item.projectId,
    item.status,
    item.priority,
    item.type,
    item.createdAt,
    item.updatedAt,
    item.specId ?? '',
    item.dueAt ?? '',
    item.effortMinutes ?? '',
    item.leverage ?? '',
    item.importance ?? '',
  ]
    .join(' ')
    .toLowerCase()
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .every((term) => text.includes(term))
}
function matchesGroup(
  item: WorkItem,
  project: string,
  ticket: string,
  group: FilterGroup,
): boolean {
  if (!group.children.length) return true
  const checks = group.children.map((node) =>
    node.kind === 'group'
      ? matchesGroup(item, project, ticket, node)
      : matchesRule(item, project, ticket, node),
  )
  const result = group.combinator === 'and' ? checks.every(Boolean) : checks.some(Boolean)
  return group.negated ? !result : result
}
function matchesRule(item: WorkItem, project: string, ticket: string, rule: FilterRule) {
  const value = filterValue(item, project, ticket, rule.field)
  if (rule.operator === 'is_empty') return value === null || value === ''
  if (value === null || value === '' || !rule.value) return false
  const field = filterFields.find((entry) => entry.value === rule.field)
  if (field?.kind === 'number') {
    const left = Number(value),
      right = Number(rule.value)
    if (Number.isNaN(left) || Number.isNaN(right)) return false
    return rule.operator === 'equals'
      ? left === right
      : rule.operator === 'not_equals'
        ? left !== right
        : rule.operator === 'greater_than'
          ? left > right
          : rule.operator === 'less_than'
            ? left < right
            : false
  }
  if (field?.kind === 'date') {
    const left = new Date(String(value)).getTime(),
      right = new Date(`${rule.value}T00:00:00`).getTime()
    if (Number.isNaN(left) || Number.isNaN(right)) return false
    return rule.operator === 'equals'
      ? new Date(left).toDateString() === new Date(right).toDateString()
      : rule.operator === 'before'
        ? left < right
        : rule.operator === 'after'
          ? left > right
          : false
  }
  const left = String(value).toLowerCase(),
    right = rule.value.toLowerCase()
  return rule.operator === 'contains'
    ? left.includes(right)
    : rule.operator === 'equals'
      ? left === right
      : rule.operator === 'not_equals'
        ? left !== right
        : false
}
function filterValue(
  item: WorkItem,
  project: string,
  ticket: string,
  field: FilterField,
): string | number | null {
  const values: Record<FilterField, string | number | null> = {
    id: item.id,
    ticket,
    title: item.title,
    description: item.description,
    project,
    projectId: item.projectId,
    status: item.status,
    priority: item.priority,
    type: item.type,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    dueAt: item.dueAt ?? null,
    effortMinutes: item.effortMinutes ?? null,
    leverage: item.leverage ?? null,
    importance: item.importance ?? null,
    specId: item.specId ?? null,
  }
  return values[field]
}
