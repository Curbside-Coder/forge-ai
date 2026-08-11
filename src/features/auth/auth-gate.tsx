import { useEffect, useState, type PropsWithChildren } from 'react'
import { Boxes, Mail } from 'lucide-react'
import { useAuth } from './auth-provider'

export function AuthGate({ children }: PropsWithChildren) {
  const { mode, user, sendMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown === 0) return

    const timer = window.setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [cooldown])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (cooldown > 0) return

    const error = await sendMagicLink(email)
    if (error) {
      const isRateLimited = /rate limit|too many/i.test(error)
      setMessage(
        isRateLimited
          ? 'Email sending is temporarily limited. Please wait a minute before trying again.'
          : error,
      )
      return
    }

    setCooldown(60)
    setMessage(
      'Check your inbox for a secure sign-in link. You can request another one in 60 seconds.',
    )
  }
  if (mode === 'loading')
    return (
      <main className="grid min-h-screen place-items-center bg-[#0c0c0e] text-sm text-zinc-500">
        Starting Forge…
      </main>
    )
  if (mode === 'local' || user) return <>{children}</>
  return (
    <main className="grid min-h-screen place-items-center bg-[#0c0c0e] px-5 text-zinc-100">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white/[0.04] p-8">
        <div className="grid size-10 place-items-center rounded-xl bg-zinc-100 text-zinc-950">
          <Boxes className="size-5" />
        </div>
        <h1 className="mt-8 text-2xl font-semibold tracking-[-0.03em]">Welcome to Forge.</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Enter your email and we’ll send a secure sign-in link.
        </p>
        <label className="mt-7 block text-sm text-zinc-400">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="mt-2 w-full rounded-xl bg-black/20 px-3 py-3 text-zinc-100 outline-none ring-1 ring-white/[0.08] placeholder:text-zinc-600 focus:ring-white/30"
          />
        </label>
        <button
          disabled={cooldown > 0}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Mail className="size-4" />
          {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Send sign-in link'}
        </button>
        {message && <p className="mt-4 text-sm text-zinc-400">{message}</p>}
      </form>
    </main>
  )
}
