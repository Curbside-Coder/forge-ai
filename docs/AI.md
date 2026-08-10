# AI Workflows

Meeting input flows through: notes, AI summary, suggested action items, user review, and saved work items. AI output is always a proposal; the user confirms before durable records are created.

The local MVP includes a review-first meeting capture screen with a simple action-line extractor. Replace that preview with a Supabase Edge Function when you configure OpenAI. Keep the OpenAI key only in the Edge Function secret store; the browser sends notes to the function and receives structured suggestions, never the key.
