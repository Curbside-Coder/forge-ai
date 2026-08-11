import { Link } from '@tanstack/react-router'
import { Check, ChevronRight, ClipboardList, Plus, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useWorkspace } from '@/features/workspace/workspace-store'
import { usePlaybooks } from './playbooks-store'
import type { Spec, SpecStatus } from '@/types/workspace'

const label = (value: string) => value.replaceAll('_', ' ')

export function SpecsPage() {
  const { projects } = useWorkspace()
  const { specs, specSteps, addSpec, updateSpec, addSpecStep, updateSpecStep, deleteSpec, error } =
    usePlaybooks()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const selected = specs.find((spec) => spec.id === selectedId) ?? specs[0]
  const selectedSteps = useMemo(
    () =>
      specSteps
        .filter((step) => step.specId === selected?.id)
        .sort((a, b) => a.position - b.position),
    [selected?.id, specSteps],
  )
  const create = async () => {
    if (!title.trim()) return
    await addSpec({
      title: title.trim(),
      projectId: projects[0]?.id ?? null,
      priority: 'medium',
      status: 'draft',
    })
    setTitle('')
    setCreating(false)
  }
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm text-zinc-500">Spec-driven execution</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Specs</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            Turn an outcome into a calm, reviewable plan. Keep one active spec and work the next
            smallest meaningful step.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950"
        >
          <Plus className="size-4" /> New spec
        </button>
      </div>
      {error && (
        <p className="mt-5 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200">{error}</p>
      )}
      {creating && (
        <div className="mt-7 flex gap-2 rounded-2xl bg-white/[0.04] p-4">
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void create()
            }}
            placeholder="What outcome are you planning?"
            className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-zinc-600"
          />
          <button
            onClick={() => void create()}
            className="rounded-lg bg-white px-3 py-2 text-sm text-zinc-950"
          >
            Create
          </button>
        </div>
      )}
      <div className="mt-8 grid gap-7 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-2">
          {specs.length === 0 ? (
            <EmptyState />
          ) : (
            specs.map((spec, index) => (
              <button
                key={spec.id}
                onClick={() => setSelectedId(spec.id)}
                className={`w-full rounded-xl p-4 text-left transition ${selected?.id === spec.id ? 'bg-white/[0.09]' : 'hover:bg-white/[0.04]'}`}
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-600">
                  SPEC-{specs.length - index}
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-200">{spec.title}</p>
                <p
                  className={`mt-2 text-xs ${spec.status === 'blocked' ? 'text-rose-300' : spec.status === 'active' ? 'text-emerald-300' : 'text-zinc-500'}`}
                >
                  {label(spec.status)}
                </p>
              </button>
            ))
          )}
        </div>
        {selected && (
          <SpecEditor
            key={selected.id}
            spec={selected}
            projects={projects}
            steps={selectedSteps}
            onUpdate={updateSpec}
            onAddStep={addSpecStep}
            onUpdateStep={updateSpecStep}
            onDelete={deleteSpec}
          />
        )}
      </div>
    </section>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-6 text-sm leading-6 text-zinc-500">
      <ClipboardList className="size-5 text-violet-300" />
      <p className="mt-4 text-zinc-300">Start with a desired outcome.</p>
      <p className="mt-1">Forge will help you break it into small, trackable steps.</p>
    </div>
  )
}

function SpecEditor({
  spec,
  projects,
  steps,
  onUpdate,
  onAddStep,
  onUpdateStep,
  onDelete,
}: {
  spec: Spec
  projects: { id: string; name: string }[]
  steps: ReturnType<typeof usePlaybooks>['specSteps']
  onUpdate: ReturnType<typeof usePlaybooks>['updateSpec']
  onAddStep: ReturnType<typeof usePlaybooks>['addSpecStep']
  onUpdateStep: ReturnType<typeof usePlaybooks>['updateSpecStep']
  onDelete: ReturnType<typeof usePlaybooks>['deleteSpec']
}) {
  const [stepTitle, setStepTitle] = useState('')
  const update = (changes: Partial<Spec>) => void onUpdate(spec.id, changes)
  const addStep = async () => {
    if (!stepTitle.trim()) return
    await onAddStep({ specId: spec.id, title: stepTitle.trim(), notes: '', estimateMinutes: 15 })
    setStepTitle('')
  }
  return (
    <article className="min-w-0 rounded-2xl bg-white/[0.035] p-5 sm:p-7">
      <div className="flex flex-wrap gap-3">
        <input
          defaultValue={spec.title}
          onBlur={(event) => update({ title: event.target.value.trim() || spec.title })}
          className="min-w-[220px] flex-1 bg-transparent text-xl font-semibold tracking-[-0.02em] outline-none"
        />
        <select
          value={spec.status}
          onChange={(event) => update({ status: event.target.value as SpecStatus })}
          className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Project"
          value={spec.projectId ?? ''}
          onChange={(value) => update({ projectId: value || null })}
          options={[
            { value: '', label: 'No project' },
            ...projects.map((project) => ({ value: project.id, label: project.name })),
          ]}
        />
        <SelectField
          label="Priority"
          value={spec.priority}
          onChange={(value) => update({ priority: value as Spec['priority'] })}
          options={['critical', 'high', 'medium', 'low'].map((value) => ({ value, label: value }))}
        />
      </div>
      <div className="mt-7 grid gap-5">
        <TextField
          label="Problem statement"
          value={spec.problemStatement}
          placeholder="What is missing, broken, or unclear?"
          onSave={(value) => update({ problemStatement: value })}
        />
        <TextField
          label="Desired outcome"
          value={spec.desiredOutcome}
          placeholder="What does done look like?"
          onSave={(value) => update({ desiredOutcome: value })}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            label="In scope"
            value={spec.inScope}
            placeholder="One requirement per line"
            onSave={(value) => update({ inScope: value })}
          />
          <TextField
            label="Out of scope"
            value={spec.outOfScope}
            placeholder="What is deliberately not included?"
            onSave={(value) => update({ outOfScope: value })}
          />
        </div>
        <TextField
          label="Technical context & edge cases"
          value={`${spec.technicalContext}${spec.edgeCases ? `\n\nEdge cases:\n${spec.edgeCases}` : ''}`}
          placeholder="Affected files, decisions, error cases, migrations…"
          onSave={(value) => update({ technicalContext: value, edgeCases: '' })}
        />
      </div>
      <div className="mt-9 border-t border-white/[0.07] pt-7">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-violet-300" />
          <h2 className="font-medium">Micro-action plan</h2>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Keep each step below 20 minutes. The first unfinished step is your next action.
        </p>
        <div className="mt-4 space-y-2">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() =>
                void onUpdateStep(step.id, { status: step.status === 'done' ? 'todo' : 'done' })
              }
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/[0.05]"
            >
              <span
                className={`grid size-5 place-items-center rounded-full border ${step.status === 'done' ? 'border-emerald-400 bg-emerald-400 text-zinc-950' : 'border-zinc-600 text-zinc-600'}`}
              >
                {step.status === 'done' && <Check className="size-3" />}
              </span>
              <span
                className={`flex-1 text-sm ${step.status === 'done' ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}
              >
                {index + 1}. {step.title}
              </span>
              <span className="text-xs text-zinc-600">{step.estimateMinutes}m</span>
              <ChevronRight className="size-4 text-zinc-600" />
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={stepTitle}
            onChange={(event) => setStepTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void addStep()
            }}
            placeholder="Add a 5–15 minute action"
            className="min-w-0 flex-1 rounded-lg bg-black/20 px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600"
          />
          <button
            onClick={() => void addStep()}
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-950"
          >
            Add
          </button>
        </div>
      </div>
      <TextField
        label="Retrospective & knowledge log"
        value={spec.retrospective}
        placeholder="What did you learn? What should future-you know?"
        onSave={(value) => update({ retrospective: value })}
      />
      <div className="mt-7 flex items-center justify-between border-t border-white/[0.07] pt-5">
        <Link to="/focus" className="text-sm text-violet-300 hover:text-violet-200">
          Open focus mode
        </Link>
        <button
          onClick={() => {
            if (window.confirm('Delete this spec and its steps?')) void onDelete(spec.id)
          }}
          className="text-sm text-rose-300 hover:text-rose-200"
        >
          Delete spec
        </button>
      </div>
    </article>
  )
}

function TextField({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string
  value: string
  placeholder: string
  onSave: (value: string) => void
}) {
  return (
    <label className="block text-sm text-zinc-400">
      {label}
      <textarea
        defaultValue={value}
        onBlur={(event) => {
          if (event.target.value !== value) onSave(event.target.value)
        }}
        placeholder={placeholder}
        rows={3}
        className="mt-2 w-full resize-y rounded-xl bg-black/20 px-3 py-3 text-sm leading-6 text-zinc-200 outline-none ring-1 ring-white/[0.06] placeholder:text-zinc-700 focus:ring-white/20"
      />
    </label>
  )
}
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className="text-sm text-zinc-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
