import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineAgentConfig, availableTabs, storageNamespace } from '../src/schema.ts';
import { defaultConfig } from '../src/defaults.ts';
import { loadServerConfig } from '../src/server.ts';
test('missing_backend_has_no_arviva_fallback', () => {
  assert.throws(() => loadServerConfig({}), /SUPABASE|CEDARI|API/);
});
test('invalid_url_or_empty_allowlist_is_rejected', () => {
  assert.throws(() => defineAgentConfig({...defaultConfig, assortment: {...defaultConfig.assortment, merchants: {mode:'allowlist', ids:[]}}}), /allowlist/);
  assert.throws(() => defineAgentConfig({...defaultConfig, brand:{...defaultConfig.brand, website:'javascript:alert(1)'}}), /URL/);
});
test('preview_requires_uploads', () => {
  assert.throws(() => defineAgentConfig({...defaultConfig, features:{...defaultConfig.features, uploads:false, roomPreviews:true}}), /uploads/);
});
test('distinct_app_ids_have_distinct_storage_namespaces', () => {
  assert.notEqual(storageNamespace('first'), storageNamespace('second'));
});
test('all_tabs_disabled_is_invalid', () => {
  assert.throws(() => defineAgentConfig({...defaultConfig,navigation:{...defaultConfig.navigation,tabs:[]}}), /tab/);
});
test('tabs_keep_configured_order_and_labels', () => {
  const config=defineAgentConfig({...defaultConfig,navigation:{initialTab:'profile',tabs:[{id:'profile',label:'Me',icon:'user',enabled:true},{id:'chat',label:'Ask',icon:'chat',enabled:true}]}});
  assert.deepEqual(availableTabs(config).map(t=>t.label),['Me','Ask']);
});
