# Environment variables needed in Vercel

Settings → Environment Variables → add these, then redeploy:

| Key | Where to get it |
|---|---|
| `REACT_APP_ANTHROPIC_API_KEY` | console.anthropic.com → API Keys (already set from earlier) |
| `REACT_APP_SUPABASE_URL` | Supabase project → Settings → API → Project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase project → Settings → API → "Legacy anon, service_role API keys" tab → anon public key (starts with eyJ...) |
| `ADZUNA_APP_ID` | console.adzuna.com → your app |
| `ADZUNA_APP_KEY` | console.adzuna.com → your app |

Note: ADZUNA_* vars do NOT have the REACT_APP_ prefix — they're only used
server-side inside api/adzuna.js and should never reach the browser bundle.

## Before first deploy with this version

Run db/schema.sql once in Supabase: Project → SQL Editor → New query → paste contents → Run.
This creates resume_versions and job_tracker_entries tables with row-level security
so each user only ever sees their own data.

## Google login

Supabase → Authentication → Providers → Google → enable, using a Client ID/Secret
from console.cloud.google.com. Callback URL to set in Google Cloud:
https://<your-project-ref>.supabase.co/auth/v1/callback
