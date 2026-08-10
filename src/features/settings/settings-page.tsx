import { useState } from 'react'
import { Check, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-provider'
import { useWorkspace } from '@/features/workspace/workspace-store'

export function SettingsPage() {
  const { user, mode, signOut, updateProfile } = useAuth()
  const { source } = useWorkspace()
  const [name, setName] = useState((user?.user_metadata.display_name as string | undefined) ?? '')
  const [avatarUrl, setAvatarUrl] = useState(
    (user?.user_metadata.avatar_url as string | undefined) ?? '',
  )
  const [message, setMessage] = useState<string | null>(null)
  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    const error = await updateProfile(name, avatarUrl)
    setMessage(error ?? 'Profile saved.')
  }
  return (
    <section className="max-w-3xl">
      <p className="text-sm text-zinc-500">Account and workspace</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Settings</h1>
      <div className="mt-10 space-y-8">
        <section>
          <h2 className="text-base font-medium">Account</h2>
          <div className="mt-4 rounded-2xl bg-white/[0.035] p-6">
            <p className="text-sm text-zinc-500">Signed in as</p>
            <p className="mt-1 text-sm text-zinc-200">{user?.email ?? 'Local preview'}</p>
            <form onSubmit={saveProfile} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-zinc-400">
                Display name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  className="mt-2 w-full rounded-lg bg-black/20 px-3 py-2.5 text-zinc-100 outline-none ring-1 ring-white/[0.08]"
                />
              </label>
              <label className="text-sm text-zinc-400">
                Avatar image URL
                <input
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://…"
                  className="mt-2 w-full rounded-lg bg-black/20 px-3 py-2.5 text-zinc-100 outline-none ring-1 ring-white/[0.08]"
                />
              </label>
              <button className="inline-flex w-fit items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950">
                <Check className="size-4" /> Save profile
              </button>
              {message && <p className="self-center text-sm text-zinc-500">{message}</p>}
            </form>
            {mode === 'supabase' && (
              <button
                onClick={() => void signOut()}
                className="mt-5 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/[0.06] hover:text-white"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            )}
          </div>
        </section>
        <section>
          <h2 className="text-base font-medium">Workspace connection</h2>
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-white/[0.035] p-6">
            <ShieldCheck className="mt-0.5 size-5 text-zinc-400" />
            <div>
              <p className="text-sm text-zinc-200">
                {source === 'supabase' ? 'Supabase connected' : 'Local workspace mode'}
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                {source === 'supabase'
                  ? 'Your projects, work items, meetings, notes, and checklists are stored privately for your account.'
                  : 'Connect Supabase in your local environment to persist Forge data across devices.'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
