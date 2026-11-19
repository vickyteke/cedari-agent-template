# Configuration reference

config/agent.ts exports defineAgentConfig(defaultConfig or your customized object). Configuration is versioned source code. There is no runtime settings dashboard. Use the examples as starting points and keep all secrets out of this file.

Brand settings control display name, agent name, company text and attribution visibility, legal URLs, support email and operator website. Attribution is optional. Native app IDs, URL scheme and build numbers live in app. Configure the wordmark/logo and onboarding images through config/assets.ts and native files through config/native-assets.ts.

Theme colors are semantic tokens. Fonts use installed system families initially. To bundle a custom font, add the Expo-supported font package/configuration and native assets, then rebuild. typeScale, spacingScale, radiusScale, borders, shadows, button/card settings, navigation geometry and motion are public settings. docs/style-tokens.json lists individual visual values. Override any one with theme.overrides using its exact key. Arbitrary layouts and new components are implemented in code.

English text lives in packages/config/src/locales/en.ts, ui-en.ts and backend-en.ts. agentConfig.copy overrides any message key. t(key, params) interpolates values and brand/agent names. Add a language dictionary and locale selection to extend the translation system. Merchant descriptions are live content rather than interface translations.

## Scope

assortment.categories and assortment.merchants independently accept either { mode: 'all' } or { mode: 'allowlist', ids: [...] }. Both rules intersect. Empty explicit allowlists are invalid. Populate registry categories and merchants with reviewed upstream keys and display labels. Cedari currently uses canonical category strings. Stable merchant IDs come from your Cedari integration. The registry validates config and supplies Discover labels. It does not grant permission to bypass Cedari authentication.

All-mode requires no exhaustive registry. To expose visible filters in all-mode, populate the reviewed categories you want in the filter row. The backend always applies restrictions to direct details and checkout, including old saved IDs. Existing historical text may remain in conversations, but stale cards must be reverified before purchase.

Discovery supports locale/currency display, budget presets, recommendation count and example prompts. Currency formatting does not convert merchant prices. Exact currency constraints are sent to Cedari for budget searches.

## Features and navigation

features uploads, saved, comparison, checkout, email, analytics and roomPreviews are independent flags subject to dependency validation. Room previews require uploads and the room-preview workflow. Native permissions depend on uploads. Disabling a tab also guards direct navigation to it. Disabling a feature removes associated actions and server/model capabilities. Account/privacy remains accessible through the header menu even if Profile is hidden.

navigation.tabs defines the enabled built-in tabs in order, with labels and icons. initialTab must be enabled. At least one tab is required. New screen types need code. Use an available icon name from ui.tsx, or extend its SVG path registry.

## Onboarding

onboarding has enabled, skippable, version, slides and fields. Each slide has a stable id, title, eyebrow, body, image key, field IDs and button label. Fields have stable IDs, type text/single/multiple, labels, options, required status, defaultValue, placeholders and length bounds. The special name and preferences IDs map to the existing basic profile. Other answers remain structured profile data and become bounded untrusted shopping context.

Unknown answers survive configuration updates. Removed slide IDs resume at the first valid slide. Completed onboarding stays completed when a new field is added. Required fields are enforced during onboarding rather than retroactively deleting or blocking a completed profile. Profile editing exposes configured fields. Guest access always remains available.

## Deployment matrix

| Change | Deployment needed |
| --- | --- |
| Logo, native identity, permissions, packaged assets | Rebuild iOS/Android and redeploy web |
| UI theme, tabs, onboarding, copy, features | Rebuild mobile and deploy corresponding backend config |
| Category/merchant policy, agent personality | Deploy backend; rebuild mobile when labels, filters or prompts also change |
| Backend credentials, quotas, optional service secrets | Redeploy/restart backend |
| Database schema | Apply reviewed migrations before dependent app/backend code |

Keep the same config revision deployed across the app and backend. Server policy is authoritative when an older mobile build differs. Image/account cleanup remains accessible when uploads are disabled to support privacy requests.

The root entry redirects to the configured initial tab. Chat has its own /chat route, so choosing Discover as the initial tab also works on later launches. Chat endpoints are disabled when the Chat tab is disabled. Privacy/account uses /account independently of the optional Profile tab.
