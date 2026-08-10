# Database

The first data model contains `projects`, `work_items`, and `meetings`, with ownership tied to Supabase Auth users. The initial migration is at `supabase/migrations/20260807120000_initial_schema.sql`; it enables row-level security and restricts each record to its creator.

Do not create separate task, bug, and feature tables. These remain one `work_items` table distinguished by a type field.

## Local connection

1. Create a Supabase project.
2. Run the migration in the Supabase SQL editor or through the Supabase CLI.
3. Run `supabase/migrations/20260808100000_comments_and_checklists.sql` after the initial migration.
4. Copy `.env.example` to `.env.local` and add the project URL plus publishable/anon key.
5. Configure the local authentication redirect as described in `docs/AUTH.md`.
6. Restart the Vite server.

Forge uses Supabase when both Vite environment variables are present. Without them it remains a local, browser-storage prototype. Do not put a service-role key in any `VITE_` variable.
