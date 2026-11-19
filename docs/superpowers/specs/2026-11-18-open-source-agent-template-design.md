# Cedari shopping agent template design

Status. Approved by the user on 2026-11-18. Implementation follows the companion plan.

## Intent

Publish a separate open-source template that lets a developer build a branded shopping agent using Cedari MCP. Preserve Arviva Space's premium styling as the default experience. A developer deploys their own agent backend to Vercel and their own customer database and storage to Supabase. Cedari supplies product and commerce capabilities. Customer identity and customer history belong to the agent operator.

## Confirmed requirements

- Expo mobile application for iOS and Android, retaining the existing web development entry point.
- Support all Cedari categories or a selected collection, combined with all merchants, selected merchants, or one merchant.
- Configurable branding and UI, including logo, name, colors, typography, company attribution, copy, imagery, and navigation tabs.
- Configurable onboarding slides and preference fields, including disabling onboarding. Guest shopping remains available with optional email-code sign-in.
- Independently configurable uploads, comparison, checkout, room previews, customer emails, and other optional features.
- Uploads can support several enabled behaviors. Customer intent selects a workflow, with clarification where needed. Developers can add custom workflows in code.
- Configurable agent personality and tone, independent of product accuracy and commerce safety requirements.
- Current AI provider for release one. Model selection is configurable and integrations should permit future contributor-added providers.
- English initially, with all owned interface strings centralized for future translations.
- Commercial closed-source derivatives permitted. Removing the By Cedari AI attribution permitted.

## Approaches and selected direction

1. Convert Arviva in place. Minimizes duplicate maintenance but mixes public template releases with Arviva operations.
2. Separate template repository. Creates a curated public starting point with independent history and release cadence, at the cost of explicitly sharing fixes between projects.
3. Extract publishable packages immediately. Supports shared dependencies but introduces package and compatibility release work prematurely.

The user selected the separate repository. Proposed workspace structure uses apps/mobile, apps/backend, packages/config, supabase, examples, and docs. Use workspace-local shared configuration initially. Arviva remains an independently deployed product. No automatic change to its production service is part of extraction.

## Configuration contract

Use typed, validated, versioned source configuration. Public mobile configuration and server-only settings must remain separate import boundaries. Reject unknown category or merchant identifiers and invalid feature combinations with actionable setup errors. No browser bundle may include Cedari API keys, service-role credentials, signing secrets, or AI-provider keys.

| Configuration | Scope |
| --- | --- |
| Brand | Display and agent names, wordmark, logos, favicon, app icons, splash, attribution visibility, website, operator, support, legal URLs |
| Theme | Semantic color tokens, font families, type scale, spacing scale, radii, borders, shadows, icon style, card and button variants, navigation geometry and motion, status bar appearance |
| Copy | English translation dictionary for screens, labels, placeholders, loading and error states, accessibility labels, validation, permission explanations, and transactional templates |
| Navigation | Enabled built-in tabs, order, labels, icons, initial tab, safe fallback route |
| Onboarding | Enabled flag, ordered slides and images, skippability, preference fields, labels, options, required status, defaults, persistence version |
| Assortment | Explicit all or allowlist modes for category and merchant IDs, category display labels, filters, currency and locale formatting, budget presets, result limit |
| Agent | Persona, tone, greeting, example prompts, optional conversational guidance, model IDs |
| Features | Uploads, photo workflows, saved items, comparison, checkout, email, analytics, previews, and associated entry points |
| App deployment | Package and bundle IDs, URL scheme, build numbers, backend URL, authentication redirects, permission declarations |
| Backend deployment | Supabase service settings, Cedari endpoint and credential, provider credentials, origins, quotas, storage constraints, email sender and scheduling settings |

Every visual primitive must consume theme tokens or documented component variants. Routine rebranding must not require editing screens. Arbitrary screen compositions and brand-new tabs use code extension points. Configurable does not mean shipping an admin editor, remote executable settings, or arbitrary styles received over the network.

Native identifiers, bundled assets, fonts, and permissions are build-time configuration. User interface, agent and policy changes must follow a documented deployment matrix describing when rebuilding the app, deploying the backend, or both is required. Effective assortment and feature authorization are server-owned even when reflected in mobile configuration.

## Assortment enforcement

Intersect category and merchant restrictions when both are selected. Empty explicit allowlists are invalid rather than meaning unrestricted access. Use stable upstream identifiers and the actual Cedari taxonomy contract verified during implementation. Discover, agent tools, direct product reads, comparisons, saved-product refresh, and checkout verification apply the same backend policy. Client input and model-generated filters cannot broaden it. Products saved before a policy change may remain in local history but cannot be newly purchased or represented as currently eligible without revalidation.

Arviva's home-only policy becomes an example preset. Remove assumptions about home-specific categories, USD budgets, room preferences and merchant naming from core logic. Merchants remain responsible for final price, availability, fulfillment and checkout.

## Identity and customer data

Retain Supabase anonymous sessions for guests and optional email-code sign-in. Each deployment owns its users, preferences, conversations, favorites, photos and consent records. Namespace local persistence by configured application identity. Required Supabase migrations, storage buckets, policies and service functions are provisioned from a fresh project, with grants and isolation verified. No migration or copying of Arviva customer data is needed.

Onboarding fields use stable keys and serializable typed answers. Built-in shopping preferences map to existing profile behavior, while custom answers are available as bounded, untrusted preference context. Changes to onboarding configuration must not erase existing answers. The implementer chooses a simple migration/version strategy and documents it.

## Optional features and images

Feature flags affect routes, tabs, buttons, model tool exposure and server handlers. Hidden controls alone do not disable a capability. Validate dependent flags, such as preview workflows requiring uploads. Navigation must always retain a usable entry route and access to privacy/account controls.

Built-in photo behaviors include complementary recommendations, similar-product discovery where Cedari can support it, and the current wall-decor/rug preview pilot. Do not advertise unsupported vision or commerce capabilities. Restrict the existing rendering pilot to supported product types even if the surrounding agent sells more categories.

Custom photo handlers declare an identifier, intent guidance, required capabilities, validated inputs and outputs, and server-side execution. Ambiguous intent produces a clarifying question. Reading text from images must not confer instruction authority. Preserve upload normalization, metadata stripping, payload limits, ownership checks, quotas, private storage, renewed signed access, progress states and closeable image presentation.

## Agent backend and provider boundaries

Extract the mobile-facing backend, Cedari MCP adapter, conversation handling, checkout verification, privacy controls, admission limits and the dependencies they actually require. Audit legacy merchant/catalog imports before removing them. Cedari merchant onboarding, ingestion, credentials and its MCP server implementation remain outside this repository.

Keep existing provider implementation, expose model IDs, and isolate conversation and image-generation operations behind small interfaces driven by actual call sites. Contributors can add providers without changing commerce policy. A multi-provider router and alternate providers are outside release one. Treat configurable persona text as subordinate to enforced tool restrictions and factual verification.

English UI strings use translation keys with interpolation. Agent language guidance defaults to English. Raw third-party errors are mapped to owned messages when shown to customers. Live product text remains merchant content rather than an app translation. Localization infrastructure remains small and ready for contributor-added dictionaries.

## Deployment and onboarding for developers

Document a clean checkout workflow with dependency installation, brand configuration, Supabase provisioning, auth setup, Cedari credential acquisition, Vercel deployment and Expo builds. Never silently default a new deployment to Arviva's production API, Supabase or analytics project. Provide environment examples containing placeholders, server-side origin validation, auth redirects, and least-required configuration.

Supabase Auth SMTP is configured by the deployer for customer sign-in. Marketing email and analytics default off until configured. Image generation can be enabled separately with explicit provider credentials, storage setup and limits. Document who pays Cedari, hosting, model and email costs without assuming a particular Cedari onboarding or pricing policy.

Validate Vercel cron availability and duration/resource constraints for each optional service against the target plan. Adapt existing local build scripts to developer-supplied SDK paths and signing identities. Developers bring their own Apple/Google accounts and upload keys.

## Publication readiness

Create a fresh repository from reviewed files, preserving required copyright and attribution notices. Review included source, fixtures, generated outputs and metadata for secrets and private data. Separately review whether credentials found in original history need remediation. Never copy environment files, signing keys, customer exports, private screenshots or local build outputs.

Proposed code license is MIT, subject to owner approval. Preserve existing Expo and dependency notices and add the proper contribution ownership statement. Check bundled fonts, photos, icons and image-generation asset terms before redistribution. Preserve premium styling even if an asset must be replaced. The ability to remove company attribution is confirmed. No broad trademark permission for Arviva's logo or name is assumed. Use documented replaceable brand assets and clarify their permissions before public release.

Include README setup, configuration reference, contribution guidance, security reporting instructions, license notices and a sample environment. Add CI for schema validation, checks, build/export smoke tests, policy enforcement and dependency/secret checks appropriate to the project.

## Acceptance criteria

- A clean project can deploy against newly provisioned Supabase and Vercel projects using only the documented configuration.
- At least two distinct configurations work, including a single-merchant non-home agent and a multi-merchant multi-category agent.
- Core screens require no edits for routine rebranding, feature toggles, onboarding changes or tab configuration.
- Category and merchant restrictions hold for search, product reads and checkout, including crafted client input and old saved products.
- Disabled features have no remaining actionable UI or usable server capability.
- Guests can shop and optionally sign in with correct ownership and data isolation.
- Mobile and web exports contain no server credentials or production Arviva service defaults.
- Enabled photo workflows route correctly, clarify ambiguity and maintain image privacy and spending limits.
- Existing room preview safe-area, modal dismissal, streaming presentation and scroll-pause behavior survive extraction.
- Licensing and asset permissions are documented and public content passes a publication review.

## Proposed defaults and remaining release decisions

Implementation calls proposed here are workspace-local shared configuration, source-based settings, no hosted multi-tenant backend, no admin configuration UI, and a fresh public repository history. Repository name, GitHub owner, code license approval and Arviva asset/trademark redistribution permission must be settled before publication. These do not block a local implementation plan. New language packs, alternate providers and additional product rendering workflows remain contributor extensions.
