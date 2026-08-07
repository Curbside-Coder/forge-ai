# Architecture

React renders the client experience. TanStack Router owns navigation and TanStack Query owns remote cache state. Supabase provides authentication and Postgres; future server-side AI calls belong in Supabase Edge Functions.

The client must never expose OpenAI keys. The initial source layout separates application wiring, reusable components, feature modules, services, hooks, and shared types.
