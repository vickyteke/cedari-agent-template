# Cedari Shopping Agent Template

Build a premium shopping companion for iOS, Android and web. Bring your own Vercel backend, Supabase project, AI credentials and Cedari MCP access. Configure one merchant, several merchants, selected categories or the whole connected catalog.

An MIT-licensed starter with approved Arviva visual assets. Use GitHub’s “Use this template” button to create your own repository. Review ASSETS.md for artwork and branding guidance, and docs/release-checklist.md before launching a customer-facing deployment. Hosted integrations and signed-device behavior require verification with your own projects.

## Start locally

Use Node 22.18 or later, npm and the Supabase CLI. Docker Desktop is required for local Supabase. Install Xcode for local iOS builds or Android SDK/JDK 17 for local Android builds.

1. Run `npm ci` at the repository root.
2. Edit `config/agent.ts`. Start with `examples/single-merchant/config.ts` or `examples/multi-category/config.ts`. Fixture merchant/category IDs must be replaced with real Cedari values.
3. Run `npm run check:config` and `npm run setup:auth-templates` to validate configuration and generate branded sign-in emails.
4. Run `supabase start`, `supabase db reset` and `supabase test db` against this local project. Follow docs/supabase.md for a hosted project.
5. Copy `apps/backend/.env.example` to `apps/backend/.env.local` and `apps/mobile/.env.example` to `apps/mobile/.env.local`. Fill in your own credentials. The backend and mobile app must use the same Supabase project.
6. Obtain a Cedari service credential and verify the available tools with your Cedari operator. Keep the credential only in the backend.
7. Run `npm run dev:backend`. For local web testing, set the mobile API URL to `http://localhost:3000` and allow `http://localhost:8081` in backend ALLOWED_ORIGINS. Production requires HTTPS.
8. Run `npm run dev:mobile` and select web, an iOS simulator or Android emulator. Device builds use the deployed HTTPS backend and embed public app configuration.

A new project has no connection to Arviva's live backend, database or analytics. Missing credentials produce setup errors. Guest shopping uses your Supabase anonymous sessions. Customers can optionally use email-code sign-in to sync their data.

## Customize

| File | Responsibility |
| --- | --- |
| config/agent.ts | Brand, theme, persona, catalog scope, features, tabs and onboarding |
| config/assets.ts | Static logo and onboarding image imports |
| config/native-assets.ts | Launcher, splash and favicon paths |
| packages/config/src/locales | Central English copy and contributor-added language dictionaries |
| docs/style-tokens.json | Inventory of component style overrides |
| apps/backend/.env.local | Server secrets, allowed origins and service connection settings |
| apps/mobile/.env.local | Public backend, Supabase and optional analytics connection settings |

Read docs/configuration.md for flags and examples, docs/extensions.md for photo/provider extensions, docs/vercel.md for deployment, and docs/builds.md for binaries. Arviva's premium visual defaults are included. Replacing its logo and product focus does not require changing screens.

## Verify

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:backend`, `npm run export:web` and `ASSET_RIGHTS_CONFIRMED=true npm run check:publication` after reviewing your assets. Database isolation tests are a separate `supabase test db` check. `npm run doctor` checks supplied environment prerequisites without displaying credentials. Load the backend environment into the process before running doctor, for example `node --env-file=apps/backend/.env.local --experimental-strip-types scripts/doctor.mjs`.

## Repository structure

- apps/mobile contains the Expo app and local signing scripts.
- apps/backend contains the customer-facing Next API and the Cedari adapter.
- packages/config contains shared validated configuration, styling and English copy.
- supabase contains standalone customer data migrations, private storage and auth templates.
- examples contains independent brand and assortment presets.

Each deployer pays their own hosting, AI, email and applicable Cedari service costs. Cedari's service availability and terms are separate from the template code license.

Run npm run setup:auth-templates after choosing the brand. Local Supabase uses the generated template for both confirmation and magic-link OTP emails. For a hosted project, copy that template into both corresponding Authentication email-template settings.
