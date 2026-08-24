import { useEffect, useState } from 'react'
import { ArrowLeft, BriefcaseBusiness, Clock3, ShieldCheck } from 'lucide-react'
import { Link, useParams } from '@tanstack/react-router'
import { formatDateTime } from './work-item-utils'
import { supabase } from '@/lib/supabase'

type SharedItem = {
  id: string
  ticket: string
  title: string
  description: string
  projectName: string
  status: string
  priority: string
  type: string
  createdAt: string
  updatedAt: string
  dueAt: string | null
  effortMinutes: number | null
}
type SharedView = { name: string; createdAt: string; items: SharedItem[] }

export function SharedWorkItemsPage() {
  const { token } = useParams({ from: '/shared/work-items/$token' })
  const [view, setView] = useState<SharedView | null>(null)
  const [state, setState] = useState<'loading' | 'missing' | 'ready'>('loading')
  useEffect(() => {
    if (!supabase) return
    void supabase.rpc('get_shared_work_item_view', { share_token: token }).then(({ data }) => {
      if (!data) setState('missing')
      else {
        setView(data as SharedView)
        setState('ready')
      }
    })
  }, [token])
  if (state === 'loading')
    return (
      <main className="grid min-h-screen place-items-center bg-[#09090b] text-sm text-zinc-500">
        Opening shared view…
      </main>
    )
  if (state === 'missing' || !view)
    return (
      <main className="grid min-h-screen place-items-center bg-[#09090b] p-6 text-center text-zinc-300">
        <div>
          <ShieldCheck className="mx-auto size-7 text-zinc-500" />
          <h1 className="mt-4 text-xl font-semibold">This shared view is unavailable</h1>
          <p className="mt-2 text-sm text-zinc-500">
            It may have been removed or the link may be incomplete.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 text-sm text-sky-200 hover:text-sky-100"
          >
            <ArrowLeft className="size-4" />
            Open Forge
          </Link>
        </div>
      </main>
    )
  return (
    <main className="min-h-screen bg-[#09090b] px-5 py-10 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-white/[.08] pb-6">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <BriefcaseBusiness className="size-4 text-sky-200" />
            Forge shared work view
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.03em]">{view.name}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Read-only snapshot · Shared {formatDateTime(view.createdAt)} · {view.items.length} item
            {view.items.length === 1 ? '' : 's'}
          </p>
        </header>
        <section className="mt-6 overflow-hidden rounded-xl border border-white/[.08] bg-white/[.025]">
          {view.items.length ? (
            view.items.map((item) => (
              <article
                key={item.id}
                className="border-b border-white/[.06] px-5 py-5 last:border-0 sm:px-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500">
                      {item.ticket} · {item.projectName || 'No project'}
                    </p>
                    <h2 className="mt-1 text-base font-medium text-zinc-100">{item.title}</h2>
                  </div>
                  <span className="rounded-md bg-white/[.06] px-2 py-1 text-xs text-zinc-300">
                    {item.status.replaceAll('_', ' ')}
                  </span>
                </div>
                {item.description && (
                  <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                    {item.description}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                  <span className="capitalize">{item.type}</span>
                  <span className="capitalize">{item.priority}</span>
                  {item.dueAt && <span>Due {formatDateTime(item.dueAt)}</span>}
                  {item.effortMinutes && (
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3" />
                      {item.effortMinutes} min
                    </span>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className="px-6 py-12 text-center text-sm text-zinc-500">
              No work items matched this saved view.
            </p>
          )}
        </section>
        <p className="mt-6 text-center text-xs text-zinc-600">
          This page is read-only. No comments, editing, or account access are available.
        </p>
      </div>
    </main>
  )
}
