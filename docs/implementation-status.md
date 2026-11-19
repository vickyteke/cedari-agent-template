# Implementation status

The configurable template is implemented in the separate local repository on branch template/configurable-agent. It remains under release verification until the external checks and publication decisions below are resolved.

## Delivered

- Expo mobile app, Next/Vercel agent backend, shared typed configuration and standalone Supabase migrations.
- Arviva premium theme defaults with configurable branding, native identity/assets, semantic theme tokens, component overrides, text, agent tone and model IDs.
- Configured category/merchant intersections enforced on search, direct product reads, comparisons and checkout.
- Configurable tabs and initial route, generic onboarding fields/defaults, guest access and optional email-code accounts.
- Optional uploads, saved items, comparison, checkout, marketing email, analytics and supported previews, including server and historical-control enforcement.
- Multiple photo workflows, clarification follow-ups, validated custom handlers, owner-bound image outputs and provider extension boundaries.
- Anonymous principal-scoped local storage and drafts, guarded identity transitions, current-profile answer merging, account cleanup and retry-stable checkout intents.
- Setup/deployment/build/contribution/security documentation, example configurations, auth-template generation, publication scans and CI definitions.

## Verification

A clean npm ci succeeded. The verified suites contain 137 backend tests, 56 mobile tests, 16 shared configuration tests and 3 native build-helper tests, for 212 passing tests. TypeScript, lint, the Next production build and the source publication scan passed. iOS, Android and web JavaScript exports succeeded. These exports are bundles rather than signed distribution binaries.

Three web preset exports succeeded. The single-store onboarding was checked in the browser with a custom style option, preferred name and free-form preferences. The minimal preset was checked for Discover-first entry, disabled cold-link redirects, absent upload controls and absent marketing consent when email is disabled. Checkout and paid provider calls use test fixtures for these checks.

An independent reviewer found gaps in the first extraction. The correction pass added regressions for disabled optional tools, identity isolation, account cleanup keys, profile hydration, routing, checkout intent identity, custom photo ownership/clarification, category-based preview eligibility, native project resolution, auth branding, scoped saved refresh and inaccessible required fields. The relevant regressions were observed failing against their earlier behavior before passing with fixes.

## External gates

- Docker Desktop reports it cannot start. The SQL migration/RLS/storage/concurrency checks are written but have not run locally.
- No new hosted Supabase/Vercel projects or credentials have been provided for an isolated end-to-end deployment.
- Real customer email delivery, live Cedari merchant checkout and signed-device behavior require operator-authorized integration testing.
- GitHub owner/repository name and asset redistribution permission are pending. ASSETS.md and the release checklist describe the publication gate.
- npm audit reports three moderate findings in the Expo/fingerprint/minimatch build-tool dependency chain, with no high or critical findings. Next and Vitest were updated to address the inherited higher-priority advisories. No forced Expo downgrade or cross-major dependency override was applied.

## Implementation decisions and tradeoffs

- A fresh local repository and feature branch provide isolation. Source application histories and private runtime artifacts were excluded. Fixes shared with Arviva will need explicit backports.
- The extraction snapshot was committed before dependency verification, and coupled configuration consumers were integrated in one implementation checkpoint. History is less granular than the original per-task plan.
- Retired MCP/Shopify-only fixtures and suites were excluded. The active Cedari HTTP contract suite was preserved and adapted. Legacy hosted MCP compatibility is outside this template.
- Category keys are canonical Cedari strings and merchant IDs are stable upstream IDs. An operator-reviewed registry supplies validation because the available tool set has no authoritative taxonomy enumeration. Operators must keep it current.
- Next 16.4.6 and Vitest 5.1.1 replace inherited vulnerable versions. Their changed dependency behavior was checked with the builds and tests above.
- Exact trusted merchant image CDN hosts are configurable. Operators must approve those hosts before enabling previews for new image sources.
- UI copy and fine-grained style overrides use generated stable keys and an inventory. This covers existing screens broadly, at the cost of less descriptive keys.
- Protocol headers, selected-workflow instructions and upstream allowlist limits were treated as functional issues and corrected, rather than deferred as translation polish.
- Chat has a dedicated /chat route, while / resolves the configured initial tab. This is a template-only route change and leaves navigation mounted during redirects.
- External database, hosted, live-commerce/email and device tests are release gates rather than inferred successes from mocked tests or bundle exports.
- Public ownership and asset permissions are reserved for the owner. The local folder name does not authorize publication.

See README.md for setup and docs/release-checklist.md for the remaining checks.
