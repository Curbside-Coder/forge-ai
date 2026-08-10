# Authentication

Forge uses Supabase email magic links. The app deliberately signs anonymous sessions out, because database ownership rules need an identifiable user.

## Local setup

In the Supabase dashboard for the Forge project:

1. Open **Authentication** > **URL Configuration**.
2. Set **Site URL** to `http://localhost:5173`.
3. Add `http://localhost:5173/**` to **Redirect URLs**.
4. Under **Authentication** > **Providers** > **Email**, make sure Email is enabled.

Then restart the local Vite server, open Forge, enter your email address, and use the link in the email you receive. You should be returned to the local app, now signed in.

## Security

Only use the project URL and publishable/anon key in `.env.local`. Never add a Supabase service-role key to a browser app or any `VITE_` variable.
