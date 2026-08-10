# Local MVP Guide

Forge is currently safe to explore without external services. Projects and work items persist in the browser's local storage for the current browser profile.

## What works locally

- Create projects.
- Create work items.
- Switch between Kanban and list views.
- Advance a work item through Backlog, In progress, In review, and Done.
- Paste meeting notes, review suggested action items, and save them as work items.

## Before production

1. Configure Supabase authentication and run the supplied migration.
2. Replace the local workspace store with Supabase queries and mutations.
3. Add a Supabase Edge Function for AI meeting parsing, using an OpenAI secret stored server-side.
4. Add comments, checklists, and role-aware project access.
