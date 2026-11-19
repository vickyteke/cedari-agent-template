# Cedari Shopping Agent Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a separate, configurable Expo shopping-agent template with an independently deployable Vercel backend and Supabase customer storage connected to Cedari MCP.

**Architecture:** One fresh repository contains apps/mobile, apps/backend, packages/config, supabase, examples, scripts and docs. The agent operator owns identity, photos and shopping history. The backend enforces catalog policy and feature permissions before using Cedari commerce tools.

**Tech Stack:** Existing Expo SDK 58, React Native 0.88, Expo Router, TypeScript, Next.js 16, Supabase Postgres/Auth/Storage, Vercel, current AI provider and optional PostHog/Mailgun integrations. Preserve compatible dependency versions during extraction rather than upgrading frameworks.

**Spec:** `docs/superpowers/specs/2026-11-18-open-source-agent-template-design.md` in the Arviva mobile repository. Copy the approved spec and this plan into the new repository.

## Global Constraints

- Preserve Arviva Space's premium styling as the default experience.
- Support all Cedari categories or a selected collection, combined with all merchants, selected merchants, or one merchant.
- Guest shopping remains available with optional email-code sign-in.
- Current AI provider for release one. Model selection is configurable.
- English initially, with all owned interface strings centralized for future translations.
- Customer identity and customer history belong to the agent operator.
- No browser bundle may include Cedari API keys, service-role credentials, signing secrets, or AI-provider keys.
- Every visual primitive must consume theme tokens or documented component variants.
- No automatic change to Arviva's production service is part of extraction.
- Commercial closed-source derivatives permitted. Removing the By Cedari AI attribution permitted.
- Read source repository instructions and installed framework docs before modifying relevant framework integrations. Tests target cross-boundary regressions, not trivial configuration literals.

## Review Focus

- Policy changes and direct product IDs must not permit checkout of a newly disallowed saved product. Task 4 covers this.
- Disabling tabs and capabilities must not leave direct routes, nested actions or model tools usable. Tasks 4 and 6 cover this.
- Existing onboarding answers and partially completed onboarding must survive changed configuration. Task 7 covers this.
- One user's photos, state or tokens must not become visible through another deployment or user account. Tasks 2, 5 and 8 cover this.
- Retried or concurrent checkout and email operations must retain idempotency and bounded cost. Tasks 4 and 9 cover this.

## Workspace and File Map

Source roots are `/Users/vikrant/workspace/arviva-space` and `/Users/vikrant/workspace/home-shopping-plugin`. Proposed local destination is `/Users/vikrant/workspace/cedari-agent-template`, subject to an existing directory check. This local name does not choose a public GitHub owner or repository name.

- `apps/mobile/` receives reviewed Expo source, tests, assets and relevant config plugins. `app.config.ts` replaces Arviva's static app identity.
- `apps/backend/` receives required mobile routes and imported dependency closure from the current backend. Exclude admin ingestion, seller credentials and retired MCP hosting.
- `packages/config/src/{schema,public,server,theme,copy,assortment}.ts` define validated configuration and public/server entry points. `locales/en.ts` owns interface text.
- `config/agent.ts`, `config/assets.ts` and `config/server.ts` are the developer-editable instance configuration. Asset references use static imports supported by Expo bundling.
- `apps/backend/src/lib/{policy,providers,photo-workflows}/` own enforcement and extension seams. Keep extracted commerce, stream parsing, normalization and admission modules where their existing responsibilities fit.
- `supabase/{config.toml,migrations,tests,templates}/` provide fresh-project provisioning. Migration filenames and sequence are defined in Task 5.
- `examples/{arviva,single-merchant,multi-category}/` contain configuration examples and synthetic commerce fixtures.
- `scripts/{check-config,doctor,check-publication}.mjs`, root workspace scripts, `.github/workflows/ci.yml` and `docs/` provide setup, validation and publication guidance.

## Task 1 — Curated extraction and working baseline

**Files:** Create root `package.json`, lockfile, `.gitignore`, workspace scripts, copied spec/plan, `apps/mobile/`, `apps/backend/`, and `docs/extraction.md`. Sources include existing mobile `src`, tests, plugins and scripts, plus backend mobile API imports and applicable tests.

**Interfaces:** Root scripts expose `typecheck`, `lint`, `test`, `build:backend`, `export:web` and `check:config`. Use npm workspaces with a single root lockfile as an implementation choice. Apps retain isolated React dependency versions if required by Next and Expo. Do not force dependency overrides to make them match.

- [ ] Inventory tracked source and current uncommitted mobile improvements. Include the latest image normalization, preview display, private image renewal and modal safe-area fixes. Record the source commits and extraction snapshot without copying `.git` histories.
- [ ] Create the fresh local repository after checking the destination is unused. Copy only reviewed application files. Include dependency notices from the start. Leave uncertain assets on a release-blocking provenance list.
- [ ] Extract backend mobile route dependencies recursively, including auth, budgets, product normalization, images, checkout and account deletion. Separate JWT helpers from retired MCP OAuth logic. Preserve required behavior until later configuration tasks replace it.
- [ ] Install with workspace-compatible dependency resolution. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:backend` and `npm run export:web`. Expected result is a runnable baseline with passing inherited relevant tests and documented source exclusions. Missing services may produce setup guidance, not calls to Arviva production.
- [ ] Commit only the curated baseline as `chore: extract Cedari agent template baseline`.

## Task 2 — Typed configuration and environment isolation

**Files:** Create `packages/config/package.json`, `src/schema.ts`, `src/public.ts`, `src/server.ts`, `src/theme.ts`, `src/copy.ts`, `src/locales/en.ts`; create `config/{agent,assets,server}.ts`; modify `apps/mobile/src/lib/{api,auth,analytics}.ts` and backend environment loading. Test `packages/config/tests/config.test.ts`.

**Interfaces:** Export `defineAgentConfig(input: unknown): AgentConfig`, `loadServerConfig(env: Record<string, string | undefined>): ServerConfig`, `theme`, `messages`, and `t(key: MessageKey, params?: Record<string, string | number>): string`. Package subpaths `/public` and `/server` have separate import trees. `AgentConfig` includes `schemaVersion: 1`, `id`, `brand`, `theme`, `navigation`, `onboarding`, `features`, `assortment`, `agent`, `locale: 'en'`, `discovery` and `app`. `ServerConfig` contains validated service configuration without a mobile export.

- [ ] Add failing cases `missing_backend_has_no_arviva_fallback`, `private_config_cannot_enter_public_import_tree`, `invalid_url_or_empty_allowlist_is_rejected`, `preview_requires_uploads`, and `distinct_app_ids_have_distinct_storage_namespaces`. Assert invalid config fails before an upstream request, and valid config uses only supplied service URLs.
- [ ] Run `npm test --workspace packages/config`. Verify new cases fail because the config contract is absent.
- [ ] Implement schema validation and explicit public exports. Allow disabled optional services to omit credentials. Require actual credentials and supported models for enabled services. Use `config.id` for local storage and analytics app identity.
- [ ] Run the targeted tests and web export. Scan an export with seeded fake server-secret sentinels and assert none occur in client files. Expected result is passing tests and no sentinels. Document public versus private settings.
- [ ] Commit as `feat: add validated agent configuration`.

## Task 3 — Premium theme, copy and native brand settings

**Files:** Modify `apps/mobile/src/components/ui.tsx`, `AppTabBar.tsx`, `ScrollChrome.tsx`, screens, `src/lib/model.ts`, `app.config.ts`, the Android launcher plugin and build scripts. Modify backend user-visible messages and email copy consumers. Add `packages/config/tests/copy.test.ts` and `apps/mobile/tests/brand-config.test.ts`.

**Interfaces:** `theme` owns semantic colors, typography, spacing, radius, border, shadow, component and motion tokens. `t()` from Task 2 supplies user-facing strings and interpolation. `config/assets.ts` resolves static logo, icon and onboarding resources. Add `formatMoney(amount: number, currency: string, locale: string): string`; preserve merchant currency rather than converting values.

- [ ] Add failing tests `brand_identity_drives_native_config`, `attribution_can_be_removed`, `message_interpolation_preserves_values`, and `merchant_currency_survives_locale_change`. Assert two brands emit distinct names, IDs and icons, optional company text disappears, and a non-USD product retains its currency.
- [ ] Run the targeted config/mobile tests and confirm the new behavioral expectations fail.
- [ ] Centralize owned copy and style values, including accessibility text, status-bar appearance, empty/error states, chat strings and permission explanations. Preserve vendor/product text. Convert branded typography and fixed visual values to tokens or named component variants. Theme definitions retain Arviva's default look.
- [ ] Replace production defaults and machine paths in build scripts. Generate native config from the public settings. Preserve safe adaptive-icon insets. Run checks and export both sample brands. Inspect screenshots of chat, Discover, profile and onboarding at phone widths and large text settings.
- [ ] Commit as `feat: make premium branding and copy configurable`.

## Task 4 — Cedari category and merchant policy

**Files:** Create `apps/backend/src/lib/policy/assortment.ts`, `tests/assortment-policy.test.ts` and `docs/cedari-contract.md`. Modify extracted `mcp/{cedari,client,contract,products}.ts`, `mobile/{catalog,conversation,chat-checkout}.ts`, checkout/account-email consumers and public catalog filter metadata.

**Interfaces:** `Selection = { mode: 'all' } | { mode: 'allowlist'; ids: string[] }`; `AssortmentPolicy = { categories: Selection; merchants: Selection }`. Export `resolveAssortment(policy: AssortmentPolicy, metadata: CatalogMetadata): ResolvedAssortment`, `allowsProduct(policy: ResolvedAssortment, product: CatalogProduct): boolean` and `intersectSearch(policy: ResolvedAssortment, filters: SearchFilters): ScopedSearch`. Define normalized metadata/product/filter types here from the verified Cedari tool schemas. Product detail and checkout adapters use the same resolved policy.

- [ ] Inspect Cedari's available tool schemas, category representation, merchant IDs and filter capabilities using read-only discovery. Record schema fixtures and version assumptions. Where canonical category IDs do not exist, use documented stable category keys with an adapter mapping. If no authoritative listing is exposed, validate keys against an operator-supplied reviewed registry and disclose that limitation. Do not invent a new Cedari endpoint or modify Cedari to finish this task.
- [ ] Add failing tests `all_categories_keeps_non_home_products`, `category_and_merchant_rules_intersect`, `single_merchant_cannot_be_overridden`, `empty_or_unknown_selection_fails`, `direct_detail_and_saved_checkout_revalidate_policy`, and `retry_checkout_keeps_existing_idempotency`. Use synthetic mixed-category/merchant fixtures, including pre-policy saved product IDs and malicious tool arguments.
- [ ] Run `npm test --workspace apps/backend -- assortment-policy`; confirm policy cases fail against the existing home-only behavior.
- [ ] Implement one enforcement path. Remove home-only defaults and legacy merchant aliases from template core. Apply restrictions before upstream calls when supported and after results, with bounded overfetch for filtering. Revalidate every checkout item with fresh product information. Preserve accurate variants, quantities, currency and idempotency.
- [ ] Run relevant inherited catalog, security and checkout suites plus the new policy tests. Expected result is no disallowed item or checkout link through client input, model input, detail links or historical data. Update example policies and commit as `feat: enforce configurable Cedari assortment`.

## Task 5 — Fresh Supabase setup and customer isolation

**Files:** Create `supabase/config.toml`, migrations `001_customer_state.sql`, `002_security_limits.sql`, `003_private_images.sql`, `004_customer_email.sql`, `supabase/tests/{customer_isolation,security_limits,storage_isolation}.sql`, auth email templates and `docs/supabase.md`. Modify extracted auth/storage/admission references only as needed.

**Interfaces:** Preserve RPC names consumed by the extracted backend and `save_shopper_state(payload jsonb, expected_version bigint)` for mobile synchronization. Preserve optimistic state versioning, private owner-scoped object paths, transactional budgets and service-only grants. Consolidate source migrations by behavior/dependency, not by copying historical catalog/OAuth tables.

- [ ] Write SQL tests for `cross_user_state_and_image_access_denied`, `anonymous_cannot_invoke_service_budget_functions`, `state_conflicts_preserve_both_updates`, `account_deletion_removes_private_data`, and `required_limit_settings_exist_on_fresh_reset`.
- [ ] Run `supabase start`, `supabase db reset`, then `supabase test db` against the new local project. Confirm the newly defined fixtures fail before migrations are implemented. Never reset a linked hosted project.
- [ ] Extract required schema and safe defaults, respecting migration ordering and storage prerequisites. Configure anonymous auth, documented email-code templates, redirect URLs and deployer-supplied SMTP. Preserve cleanup, retention and service-only concurrency functions.
- [ ] Run reset and all SQL tests again. Verify user A/B and anonymous identities, fresh guest chat, optional sign-in and state merging against an isolated test deployment. Expected result is full functional setup without original Arviva tables or customer exports.
- [ ] Commit as `feat: provision isolated Supabase customer services`.

## Task 6 — Configurable tabs and capability enforcement

**Files:** Modify `apps/mobile/src/app/{_layout,compare,product/[id]}.tsx`, `(tabs)/` screens and `components/{AppTabBar,ProductCard,EmailEditButton}.tsx`; create `apps/backend/src/lib/policy/capabilities.ts`; modify route/tool registration. Test `apps/mobile/tests/navigation-config.test.ts` and `apps/backend/tests/capabilities.test.ts`.

**Interfaces:** `TabId = 'chat' | 'discover' | 'saved' | 'bag' | 'profile'`; `TabConfig = { id: TabId; enabled: boolean; label: string; icon: string }`. Configuration ordering defines display order. Export `requireFeature(feature: FeatureId): void` for backend checks and `availableTabs(config: AgentConfig): TabConfig[]` for route registration. Disabled server capabilities return a localized unavailable response before paid work.

- [ ] Add failing cases `hidden_tab_direct_route_is_inaccessible`, `disabled_checkout_removes_tools_and_actions`, `disabled_comparison_clears_entry_points`, `all_tabs_disabled_is_invalid`, and `privacy_remains_accessible_without_profile_tab`. Disabling a feature must prevent its nested API call, not merely hide its tab.
- [ ] Run targeted tests and verify the original always-on navigation fails them.
- [ ] Derive tab UI, initial route and guarded routes from configuration. Offer account/privacy controls from a persistent menu when Profile is absent. Disable routes, actions, tool capabilities and feature side effects consistently. Preserve tab persistence on product pages and scrolling animations.
- [ ] Run targeted tests, typecheck/lint and web export. Manually open disabled routes and verify fallback navigation on mobile. Commit as `feat: configure navigation and optional capabilities`.

## Task 7 — Configurable onboarding and durable preferences

**Files:** Modify `apps/mobile/src/lib/{onboarding,model,store}.ts*`, `components/Introduction.tsx`, profile and chat preference serialization. Create `apps/mobile/tests/onboarding-config.test.ts`; add onboarding examples and docs.

**Interfaces:** `PreferenceField = { id: string; labelKey: MessageKey; type: 'text' | 'single' | 'multiple'; required: boolean; options?: { id: string; labelKey: MessageKey }[] }`; answers are `Record<string, string | string[]>`. Define `migratePreferences(raw: unknown, config: AgentConfig): ProfilePreferences`, `validateAnswers(answers: PreferenceAnswers, fields: PreferenceField[]): ValidationResult` and `preferenceContext(profile: ProfilePreferences, config: AgentConfig): string`. Maintain bounded, untrusted preference context and preserve unrelated legacy state.

- [ ] Add failing cases `disabled_onboarding_does_not_block_guest`, `changed_slide_order_preserves_answers`, `new_required_field_does_not_erase_completed_profile`, `unknown_answers_survive_roundtrip`, and `guest_signin_merge_keeps_latest_profile`. Test partially completed onboarding with deleted field/options and named user profiles.
- [ ] Run targeted tests and confirm the fixed four-step, home-specific implementation fails them.
- [ ] Render slides and field types from config. Keep stable field IDs, onboarding completion/version metadata, length bounds and per-app persistence. Preserve existing answers where options change, displaying a localized edit affordance. Reflect developer-selected fields in Profile and bounded chat memory.
- [ ] Verify one home preset and one non-home preset, completion/skip/reopen behavior, keyboard avoidance and long option labels. Run tests and commit as `feat: configure onboarding and customer preferences`.

## Task 8 — Provider seams and multiple photo workflows

**Files:** Create `apps/backend/src/lib/providers/{types,current}.ts`, `photo-workflows/{types,registry,router}.ts`; modify `mobile/{conversation,assistant,room-preview,images}.ts` and image/chat routes; adapt mobile waiting/viewer controls. Test `apps/backend/tests/photo-workflows.test.ts` and mobile preview interaction regressions.

**Interfaces:** `ConversationProvider.respond(input: ConversationInput, progress: ChatProgress): Promise<ConversationResult>` and `ImageProvider.edit(input: ImageEditInput, signal: AbortSignal): Promise<Uint8Array>` wrap current implementation without changing validated stream contracts. `PhotoWorkflow` declares `id`, `intentGuidance`, `requiredFeatures`, `inputSchema`, `outputSchema`, and `run(context: PhotoContext): Promise<PhotoResult>`. `PhotoResult` is a bounded message result or clarification. Router returns exactly one enabled workflow or a clarification result.

- [ ] Add failing cases `uploads_disabled_rejects_payload_before_provider`, `ambiguous_intent_asks_without_paid_edit`, `non_home_preview_cannot_claim_unsupported_rendering`, `cross_user_image_is_rejected`, `image_text_cannot_expand_policy`, and `custom_workflow_cannot_return_unscoped_products`. Include retry and malformed custom output cases.
- [ ] Run targeted tests and confirm registry/disable-policy cases fail.
- [ ] Wrap the existing conversation and image call sites, configure current-provider model IDs, and register complementary recommendations and supported previews. Similar-product behavior uses existing visual conversation/search capabilities with honest limitations. Custom handlers use server-only code and schema validation, while all products/checkouts still pass Tasks 4 and 6 enforcement.
- [ ] Preserve private image renewal, error retries, full-screen safe area and dismissal, progress indication, gradual caption reveal, user scroll pause and image anchoring. Run backend tests and device/web smoke tests with synthetic photos. No real customer photo fixture is included in Git.
- [ ] Commit as `feat: add configurable photo workflows and provider seams`.

## Task 9 — Optional analytics, email and reproducible Vercel deployment

**Files:** Modify analytics/email consumers and cron/webhook routes; create `apps/backend/vercel.json`, `.env.example` files and `docs/{vercel,analytics,email,builds}.md`; modify `scripts/{build-local,build-play}.mjs`; add `scripts/doctor.mjs`. Test `apps/backend/tests/optional-services.test.ts`.

**Interfaces:** `doctor` validates enabled service prerequisites without printing credentials. Root commands `doctor`, `build:ios`, `build:android:play` read operator-provided paths/identity. Email preference, unsubscribe, webhook signature and idempotent job behavior reuse the extracted contracts.

- [ ] Add failing cases `disabled_analytics_sends_no_events`, `disabled_email_sends_no_jobs`, `duplicate_webhook_or_retry_does_not_duplicate_delivery`, and `foreign_origin_is_rejected_before_work`. Use mock senders with call-count assertions.
- [ ] Run targeted tests and confirm optional flags/origin behavior fails before integration.
- [ ] Wire consent-aware analytics to each operator's project and default it off. Configure Mailgun as the existing optional email implementation, preserving delivery suppression, signatures, bounded retries, operator footer/address and consent. Reject scheduled triggers when disabled and protect enabled jobs with server credentials.
- [ ] Document Vercel root directory and monorepo imports. Verify current Vercel cron/duration rules for the selected plan before documenting values. Include enabled-service deployment instructions, Supabase auth redirect setup and rebuild/backend deployment matrix. Make native signing explicit and prevent existing upload-key generation from overwriting restored credentials.
- [ ] Run targeted tests, backend build and doctor with minimum/full configs. Commit as `feat: make optional services and deployments portable`.

## Task 10 — Example configurations, publication audit and release verification

**Files:** Create `examples/{arviva,single-merchant,multi-category}/`, `README.md`, `LICENSE`, `NOTICE`, `ASSETS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/{configuration,extensions,release-checklist}.md`, `scripts/check-publication.mjs`, `.github/workflows/ci.yml` and end-to-end smoke fixtures.

**Interfaces:** Root `check:publication` rejects private files, production Arviva service defaults and missing asset provenance; it reports findings without printing secret values. CI runs `npm ci`, config validation, typecheck, lint, relevant tests, backend build and web export. SQL tests run in their isolated Supabase job.

- [ ] Build one single-merchant non-home example and one multi-merchant multi-category example against stable synthetic fixtures. Configure actual Cedari IDs only during operator-authorized integration testing. Assert no app screen edits are needed between them.
- [ ] Add release checks for forbidden private artifacts, stale imports of source-repository files, missing configuration keys, unknown asset provenance and fake secret sentinels in mobile bundles. Run and confirm seeded violations are rejected, then remove seeds.
- [ ] Verify asset permissions and replace any unapproved assets while retaining the premium style. Prepare MIT licensing with applicable ownership and third-party notices as proposed in the approved design. Confirm the exact copyright owner, public repository name/owner and trademark/asset rights with the user before publication.
- [ ] Document setup from zero, contributor extensions, model configuration, migrations, feature dependencies, all known deployment limits, and a minimal demo path. Credential acquisition must reflect the current Cedari onboarding contract, verified read-only or supplied by the owner.
- [ ] Deploy two isolated operator-owned test instances only once their credentials/projects are authorized. Verify new Supabase provisioning, guests, optional sign-in, scoped discovery/detail/checkout, photo workflows, state isolation and optional service toggles. Capture only synthetic data as release evidence. If external provisioning is unavailable, record the precise unverified checks and do not claim clean hosted deployment is proven.
- [ ] Run the full release checklist. Independently review the final branch against the approved design. Commit reviewed template files. Publishing to GitHub waits for the user's choice of owner/name and any remaining asset/ownership answers; no production store release is included.

## Self-review and dependency order

All approved requirements map to Tasks 2–10. Extraction precedes config, config precedes policy and consumer refactors, and policy precedes photo extensions. Supabase provisioning and actual runtime fixtures inform the final deployment proof. Preserve exact source behavior in extraction, then replace policy/branding centrally. The Review Focus conditions have explicit regression cases in the owning tasks. Test runner choices follow inherited app/backend suites, with a small shared-package runner configured in Task 2. Do not add provider SDKs, UI configuration editors, hosted tenancy or public package releases.

## Execution handoff

Recommended execution is native, task-by-task in this session, with an independent review of the complete branch. The policy, config and backend interfaces are tightly coupled, so one implementer can keep the changes consistent without repeated context transfer. Every task ends in a working checkpoint. Follow the approved design's publication gates even after local implementation finishes.
