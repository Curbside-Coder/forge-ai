import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

export function RichText({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div className={`rich-text whitespace-pre-wrap text-sm leading-6 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-sky-300 underline decoration-sky-300/40 underline-offset-4 hover:text-sky-200"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-xs text-zinc-200">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-xl bg-black/25 p-3 text-xs text-zinc-300">
              {children}
            </pre>
          ),
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
