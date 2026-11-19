import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const exec = promisify(execFile);
const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');
const project = config.match(/^project_id\s*=\s*"([\w-]+)"/m)?.[1];
assert.ok(project, 'local Supabase project ID is required');
// Deliberately uses only the local Docker container, never a hosted DB URL.
const container = `supabase_db_${project}`;
async function sql(query) {
  const { stdout } = await exec('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query]);
  return stdout.trim();
}
const prefix = `template-concurrency:${randomUUID()}`;
const user = randomUUID();
try {
  assert.equal(await sql("select count(*) from public.security_leases where pool='agent' and expires_at>now()"), '0', 'run against an idle local test database');
  const admissions = await Promise.all(Array.from({length: 24}, () => sql(`select public.security_budget('${prefix}',5,3600)`)));
  assert.equal(admissions.filter(value => value === 't').length, 5, 'parallel requests must not exceed the budget');
  await sql(`insert into auth.users(id,aud,role,email) values('${user}','authenticated','authenticated','${user}@example.invalid')`);
  const saves = await Promise.allSettled(Array.from({length: 12}, () => sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${user}'; select public.save_shopper_state('{"profile":{"name":"Concurrent"}}'::jsonb,0); commit;`)));
  assert.equal(saves.filter(result => result.status === 'fulfilled').length, 1, 'only one initial save may win');
  for (const result of saves.filter(result => result.status === 'rejected')) assert.match(result.reason.stderr, /STATE_CONFLICT/);
  const leases = await Promise.all(Array.from({length: 16}, (_, i) => sql(`select public.acquire_security_lease('agent','${prefix}:${i}')`)));
  assert.equal(leases.filter(Boolean).length, 4, 'parallel leases must respect the pool ceiling');
  console.log('Concurrent database checks passed: 24 budget requests, 12 conflicting saves, 16 lease requests.');
} finally {
  await sql(`delete from public.security_budgets where key='${prefix}'; delete from public.security_leases where owner like '${prefix}:%'; delete from auth.users where id='${user}';`);
}
