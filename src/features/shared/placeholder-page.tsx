export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section>
      <p className="text-sm text-zinc-500">Forge foundation</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-xl text-zinc-400">
        This area is intentionally scaffolded but not implemented yet.
      </p>
    </section>
  )
}
