# Contributing

Use a feature branch. Run npm ci, npm run check:config, npm run typecheck, npm run lint, npm test, npm run build:backend and npm run export:web. Database changes also require a fresh local Supabase reset and supabase test db. Use synthetic products/photos and your own development services. Do not put secrets in fixtures or logs.

Centralize UI text and theme values. Preserve public/server configuration boundaries, anonymous shopping, customer ownership, scoped commerce and idempotent checkout/email operations. Add regression tests when changing those boundaries. New providers and photo workflows belong at the documented extension seams rather than in screens.

Discuss breaking config/schema changes and include a migration example. Do not assume a single category, merchant, currency or brand. Keep merchant product data intact and untrusted. Confirm licenses for any contributed visual assets.
