# Supabase Auth email templates

Source for the emails Supabase Auth sends itself. They are not wired into
`config.toml`; paste each file into the Supabase dashboard under
Authentication > Email Templates.

| File | Template | Variables used |
|---|---|---|
| `magic-link.html` | Magic Link | `{{ .TokenHash }}`, `{{ .SiteURL }}` |
| `recovery.html` | Reset Password | `{{ .ConfirmationURL }}`, `{{ .Email }}` |

They use the same layout as the edge function emails
(`supabase/functions/_shared/email.ts`), rendered once to static HTML. The
magic link URL is kept exactly as the live template had it.
