import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Plus, Trash2, X } from 'lucide-react'
import { useWorkspace } from '@/features/workspace/workspace-store'

export function ProjectsPage() {
  const { projects, workItems, addProject, deleteProject, source, error } = useWorkspace()
  const [isCreating, setIsCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    addProject({ name: name.trim(), description: description.trim() || 'New project' })
    setName('')
    setDescription('')
    setIsCreating(false)
  }
  return (
    <section>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-zinc-500">Your active workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Projects</h1>
          <p className="mt-2 text-zinc-500">Organize work by outcome, not by disconnected lists.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white"
        >
          <Plus className="size-4" />
          New project
        </button>
      </div>
      {isCreating && (
        <form onSubmit={submit} className="mt-8 rounded-2xl bg-white/[0.04] p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Create a project</h2>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-zinc-500 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-zinc-400">
              Name
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Project name"
                className="mt-2 w-full rounded-lg bg-black/20 px-3 py-2.5 text-zinc-100 outline-none ring-1 ring-white/[0.08] placeholder:text-zinc-600 focus:ring-white/30"
              />
            </label>
            <label className="text-sm text-zinc-400">
              Description
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What outcome does it own?"
                className="mt-2 w-full rounded-lg bg-black/20 px-3 py-2.5 text-zinc-100 outline-none ring-1 ring-white/[0.08] placeholder:text-zinc-600 focus:ring-white/30"
              />
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
              Create project
            </button>
          </div>
        </form>
      )}
      {source === 'loading' && (
        <p className="mt-8 text-sm text-zinc-500">Connecting to your workspace…</p>
      )}
      {error && (
        <p className="mt-8 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Database connection issue: {error}.{' '}
          {source === 'local'
            ? 'Using local data instead.'
            : 'Some changes may not save until it is resolved.'}
        </p>
      )}
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => {
          const active = workItems.filter(
            (item) => item.projectId === project.id && item.status !== 'done',
          ).length
          return (
            <article
              key={project.id}
              className="rounded-2xl bg-white/[0.035] p-6 transition hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-white/[0.07] text-sm font-medium text-zinc-300">
                  {project.name.charAt(0).toUpperCase()}
                </span>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete ${project.name} and its work items?`))
                      void deleteProject(project.id)
                  }}
                  aria-label={`Delete ${project.name}`}
                  className="rounded-lg p-2 text-zinc-600 hover:bg-rose-400/10 hover:text-rose-300"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <h2 className="mt-10 text-lg font-medium tracking-[-0.02em]">{project.name}</h2>
              <p className="mt-1 min-h-10 text-sm leading-5 text-zinc-500">{project.description}</p>
              <div className="mt-7 flex items-center justify-between">
                <span className="text-sm text-zinc-500">
                  <strong className="font-medium text-zinc-200">{active}</strong> active items
                </span>
                <Link
                  to="/work-items"
                  className="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
                >
                  Open <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </article>
          )
        })}
      </div>
      {projects.length === 0 && source === 'supabase' && (
        <p className="mt-10 rounded-2xl bg-white/[0.025] px-6 py-10 text-center text-sm text-zinc-500">
          Create your first project to start organizing work.
        </p>
      )}
    </section>
  )
}
