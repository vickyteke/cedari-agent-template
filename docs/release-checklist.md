# Release checklist

- [ ] Choose public repository owner and name.
- [ ] Confirm the copyright owner and proposed MIT licensing.
- [ ] Confirm or replace every asset listed in ASSETS.md.
- [ ] Set the private security-reporting contact.
- [ ] Run clean npm ci, typecheck, lint, tests, backend build and mobile exports.
- [ ] Run check:publication after asset approval and inspect the curated Git history.
- [ ] Provision a fresh Supabase project and run SQL RLS, grants, image and concurrency tests.
- [ ] Deploy two independently configured Vercel/Supabase agents using operator-approved projects and credentials.
- [ ] Verify live Cedari schema/merchant/category compatibility and exact-variant checkout.
- [ ] Test guest shopping, optional sign-in, merge and deletion on actual mobile devices.
- [ ] Check native permissions, safe areas, keyboard, caption/scroll behavior and preview modal dismissal.
- [ ] Review optional email consent, suppression, scheduling, analytics and platform resource limits.
- [ ] Review remaining dependency advisories and record any applicable mitigations.

Current session limitations include unavailable Docker Desktop, no dedicated hosted test credentials, no newly created store signing configuration, and pending asset/publication identity approvals. Application tests/builds prove only the paths they execute. No public release should be described as ready until the outstanding checks are resolved.
