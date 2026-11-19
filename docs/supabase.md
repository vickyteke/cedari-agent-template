# Supabase provisioning

Use Supabase CLI 2.75.0, matching CI and the generated config.toml. Newer CLI versions can introduce breaking configuration changes; upgrade the CLI and config together and rerun database checks.

Use a dedicated Supabase project for each agent deployment. Do not reuse Arviva's customer database. The app and backend must point to the same project.

After changing the brand, run npm run setup:auth-templates. For local development start Docker Desktop, then run supabase start, supabase db reset and supabase test db from the root, followed by node scripts/test-db-concurrency.mjs. These reset commands are only for this local project. The migrations provision customer state, private admission budgets/leases, private image storage and customer email jobs. No seller catalog or retired MCP OAuth tables are needed.

For a fresh hosted project, authenticate with the Supabase CLI, link to your chosen project reference, inspect supabase db push --dry-run, and apply supabase db push after checking the target. Set the public URL/publishable key in mobile and URL/service-role key in the backend. Never expose the service-role key in EXPO_PUBLIC variables.

Enable anonymous sign-ins in Authentication settings. Enable email sign-in and configure the provided sign-in-code.html template. Production sign-in requires your SMTP provider. Set site URL and permitted redirects to your own application URLs and URL scheme. Use asymmetric JWT signing keys supported by the existing ES256/RS256 validator and keep the expected authenticated audience. No client embeds an agent credential.

shopper_state uses per-user RLS and optimistic save_shopper_state updates. Budget/token/lease functions are service-only. The agent-chat-images bucket is private, restricted to normalized JPEGs of at most 262144 bytes. Client direct storage access is blocked. Authenticated customer routes validate image ownership and issue short-lived access which the app refreshes on reopen/retry.

Counters require periodic cleanup. Configure a scheduled database job or an operator-managed service invocation to delete expired security leases and bounded batches of security_budgets/mobile_rate_buckets older than two days. Avoid unbounded cleanup in request admission. The source application's pg_cron extension was not automatically enabled in this template because extension availability is deployment-specific.

Before production, run the SQL tests on a fresh isolated database and manually verify guest-to-account merge, concurrent saves, account deletion and two-user image isolation. The concurrency script targets only the local Supabase Docker container; it never accepts a hosted database URL. Run it against an idle disposable development database.

Run npm run setup:auth-templates after choosing the brand. Local Supabase uses the generated template for both confirmation and magic-link OTP emails. For a hosted project, copy that template into both corresponding Authentication email-template settings.
