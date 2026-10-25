# Supabase Auth email templates

Source for the emails Supabase Auth sends itself. They are not wired into
`config.toml`; paste each file into the Supabase dashboard under
Authentication > Email Templates.

| File | Template | Variables used |
|---|---|---|
| `magic-link.html` | Magic Link | `{{ .TokenHash }}`, `{{ .SiteURL }}` |
| `recovery.html` | Reset Password | `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .Email }}` |

They use the same layout as the edge function emails
(`supabase/functions/_shared/email.ts`), rendered once to static HTML. The
magic link URL is kept exactly as the live template had it.

The reset link goes to the app's `/reset-password?token_hash=...&type=recovery`
rather than `{{ .ConfirmationURL }}` (Supabase's `/auth/v1/verify`). The verify
URL spends the single-use token on the first GET, so an email client's link
scanner could use it up before the person clicks; the app page verifies it
with `verifyOtp` only when the page actually loads in a browser.
