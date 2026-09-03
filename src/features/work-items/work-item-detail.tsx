import { useEffect, useMemo, useState, type ClipboardEvent, type FormEvent } from 'react'
import { Check, ImagePlus, MessageSquare, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-provider'
import { useWorkspace } from '@/features/workspace/workspace-store'
import { RichText } from '@/components/shared/rich-text'
import { getPastedImages, imageMarkdown, uploadForgeImage } from '@/lib/image-attachments'
import type { WorkItem, WorkItemPriority, WorkItemStatus, WorkItemType } from '@/types/workspace'
import { formatDateTime, idleState } from './work-item-utils'

const statuses: WorkItemStatus[] = ['backlog', 'in_progress', 'in_review', 'done']
const priorities: WorkItemPriority[] = ['critical', 'high', 'medium', 'low']
const types: WorkItemType[] = ['task', 'bug', 'feature', 'idea', 'research', 'improvement']

export function WorkItemDetail({
  item,
  ticket,
  onClose,
  onDelete,
}: {
  item: WorkItem
  ticket: string
  onClose: () => void
  onDelete: () => void
}) {
  const { user } = useAuth()
  const {
    comments,
    checklistItems,
    updateWorkItem,
    loadWorkItemDetails,
    addComment,
    addChecklistItem,
    updateChecklistItem,
    deleteWorkItem,
    projects,
  } = useWorkspace()
  const [comment, setComment] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageStatus, setImageStatus] = useState<string | null>(null)
  const [checklistItem, setChecklistItem] = useState('')
  useEffect(() => {
    void loadWorkItemDetails(item.id)
  }, [item.id, loadWorkItemDetails])
  const itemComments = useMemo(
    () => comments.filter((entry) => entry.workItemId === item.id),
    [comments, item.id],
  )
  const itemChecklist = useMemo(
    () => checklistItems.filter((entry) => entry.workItemId === item.id),
    [checklistItems, item.id],
  )
  const completedCount = itemChecklist.filter((entry) => entry.completed).length
  const submitComment = (event: FormEvent) => {
    event.preventDefault()
    if (uploadingImage) return
    void addComment(item.id, comment)
    setComment('')
    setImageStatus(null)
  }
  const submitChecklistItem = (event: FormEvent) => {
    event.preventDefault()
    void addChecklistItem(item.id, checklistItem)
    setChecklistItem('')
  }
  const pasteCommentImage = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const images = getPastedImages(event.nativeEvent)
    if (images.length === 0) return
    event.preventDefault()
    if (!user) {
      setImageStatus('Sign in to save pasted images.')
      return
    }
    setUploadingImage(true)
    setImageStatus('Saving image…')
    try {
      const urls = await Promise.all(images.slice(0, 3).map((image) => uploadForgeImage(image, user.id, 'work-items')))
      setComment((current) => `${current}${current ? '\n\n' : ''}${urls.map((url) => imageMarkdown(url)).join('\n\n')}`)
      setImageStatus(`${urls.length} image${urls.length === 1 ? '' : 's'} attached. Add note to save.`)
    } catch (uploadError) {
      setImageStatus(uploadError instanceof Error ? uploadError.message : 'Could not save that image.')
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white/[0.045] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-600">
            {ticket} · {item.type}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{item.title}</h2>
          {item.description && (
            <RichText content={item.description} className="mt-2 max-w-2xl text-zinc-500" />
          )}
          <div className="mt-4 space-y-1 text-xs text-zinc-500">
            <p>Created {formatDateTime(item.createdAt)}</p>
            <p className={idleState(item.updatedAt).className}>
              {idleState(item.updatedAt).label} · last change {formatDateTime(item.updatedAt)}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close work item details"
          className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.07] hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
      <button
        onClick={() => {
          if (window.confirm(`Delete ${ticket}? This cannot be undone.`)) {
            void deleteWorkItem(item.id)
            onDelete()
          }
        }}
        className="mt-5 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-rose-400/10"
      >
        <Trash2 className="size-4" /> Delete work item
      </button>
      <div className="mt-7 space-y-8">
        <div>
          <div className="grid gap-3 sm:grid-cols-3">
            <FieldSelect
              label="Status"
              value={item.status}
              options={statuses}
              onChange={(status) =>
                void updateWorkItem(item.id, { status: status as WorkItemStatus })
              }
            />
            <FieldSelect
              label="Priority"
              value={item.priority}
              options={priorities}
              onChange={(priority) =>
                void updateWorkItem(item.id, { priority: priority as WorkItemPriority })
              }
            />
            <FieldSelect
              label="Type"
              value={item.type}
              options={types}
              onChange={(type) => void updateWorkItem(item.id, { type: type as WorkItemType })}
            />
          </div>
          <label className="mt-4 block text-xs text-zinc-500">
            Project
            <select
              value={item.projectId}
              onChange={(event) => void updateWorkItem(item.id, { projectId: event.target.value })}
              className="forge-select mt-1.5 w-full px-2.5 py-2 text-sm text-zinc-300"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between">
            <h3 className="mt-7 text-sm font-medium">Checklist</h3>
            <span className="text-xs text-zinc-600">
              {completedCount}/{itemChecklist.length}
            </span>
          </div>
          <div className="mt-3 space-y-1">
            {itemChecklist.map((entry) => (
              <label
                key={entry.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-zinc-400 hover:bg-white/[0.035]"
              >
                <input
                  type="checkbox"
                  checked={entry.completed}
                  onChange={(event) => void updateChecklistItem(entry.id, event.target.checked)}
                  className="size-4 accent-zinc-100"
                />
                <span className={entry.completed ? 'text-zinc-600 line-through' : ''}>
                  <RichText content={entry.body} />
                </span>
              </label>
            ))}
          </div>
          <form onSubmit={submitChecklistItem} className="mt-3 flex gap-2">
            <input
              value={checklistItem}
              onChange={(event) => setChecklistItem(event.target.value)}
              placeholder="Add a checklist item"
              className="min-w-0 flex-1 rounded-lg bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-white/[0.08] placeholder:text-zinc-600 focus:ring-white/30"
            />
            <button
              aria-label="Add checklist item"
              className="rounded-lg bg-white/[0.09] px-3 text-zinc-200 hover:bg-white/[0.14]"
            >
              <Plus className="size-4" />
            </button>
          </form>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-zinc-500" />
            <h3 className="text-sm font-medium">Discussion</h3>
          </div>
          <div className="mt-3 space-y-3">
            {itemComments.length === 0 ? (
              <p className="py-2 text-sm text-zinc-600">No notes yet.</p>
            ) : (
              itemComments.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-xl bg-black/15 px-4 py-3 text-sm leading-6 text-zinc-400"
                >
                  <RichText content={entry.body} />
                  <p className="mt-2 text-[11px] leading-4 text-zinc-600">
                    {formatDateTime(entry.createdAt)}
                  </p>
                </article>
              ))
            )}
          </div>
          <form onSubmit={submitComment} className="mt-3">
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Leave a note — paste an image here to attach it"
              onPaste={(event) => void pasteCommentImage(event)}
              rows={3}
              className="w-full resize-none rounded-lg bg-black/20 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-1 ring-white/[0.08] placeholder:text-zinc-600 focus:ring-white/30"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="inline-flex min-w-0 items-center gap-1.5 text-xs text-zinc-600">
                <ImagePlus className="size-3.5 shrink-0" />
                {imageStatus ?? 'Paste a screenshot or image to attach it.'}
              </p>
              <button
                disabled={uploadingImage || !comment.trim()}
                className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
              <Check className="size-4" />
                {uploadingImage ? 'Saving image…' : 'Add note'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="text-xs text-zinc-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg bg-black/20 px-2.5 py-2 text-sm capitalize text-zinc-300 outline-none ring-1 ring-white/[0.08]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace('_', ' ')}
          </option>
        ))}
      </select>
    </label>
  )
}
