# Email

Supabase Auth SMTP handles email-code sign-in independently from optional customer engagement email. Email sign-in must be configured for the operator's domain.

Customer email is off by default. To enable it, set features.email, EMAIL_ENABLED and the Mailgun variables in the backend environment, including sender, domain, region, webhook signing key, EMAIL_TOKEN_SECRET, business postal address and CRON_SECRET. Brand copy and legal/support links come from agent configuration. Configure Mailgun's HTTP POST webhook at https://YOUR-BACKEND/api/email/webhook. Template sends agent_job_id as its provider metadata key. The webhook verifies signatures, freshness and replay/idempotency through the database functions.

Consent, suppression, one-click unsubscribe and deduplicated jobs are preserved. A claim permits one sender. Unknown delivery outcomes are not automatically resent. Signed unsubscribe links remain usable even if new marketing email is disabled. An operator must supply their own consent language and mailing details. Tests use synthetic recipients and mocked delivery; no live emails are sent during template setup.
