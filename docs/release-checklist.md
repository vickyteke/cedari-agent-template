# Release checklist

## Public template publication

- [x] Owner approved vickyteke/cedari-agent-template as the public repository.
- [x] Owner approved MIT licensing and inclusion of the current Arviva assets; see ASSETS.md.
- [x] Clean npm ci, typecheck, lint, 212 application/configuration tests, backend build and all-platform JavaScript exports completed.
- [x] Source publication scan and curated Git history credential-pattern review completed.
- [x] Fresh local migrations, 23 SQL assertions and parallel budget/save/lease checks passed.
- [ ] GitHub template published with private vulnerability reporting enabled and CI passing.

## Operator checks before a customer launch

- [ ] Provision fresh Supabase and Vercel projects; verify migrations and configuration against those exact targets.
- [ ] Deploy two independently configured agents to validate hosted portability.
- [ ] Verify live Cedari schema/merchant/category compatibility and exact-variant checkout.
- [ ] Test guest shopping, optional sign-in, merge and deletion on actual mobile devices.
- [ ] Check native permissions, safe areas, keyboard, caption/scroll behavior and preview modal dismissal.
- [ ] Review optional email consent, suppression, scheduling, analytics and platform resource limits.
- [ ] Review remaining dependency advisories and record applicable mitigations.
- [ ] Replace branding, artwork and policy/support URLs as appropriate for the derivative app.

Template publication does not certify a particular operator’s hosted deployment or store release. Hosted integration, real email/commerce and signed-device checks need the operator’s own projects and credentials. Three moderate dependency findings remain in the Expo fingerprint/minimatch build-tool chain, with no high or critical findings in the recorded audit.
