import { test } from "node:test";
import assert from "node:assert/strict";
import { authEmailTemplate } from "../src/auth-email.ts";
import { defaultConfig } from "../src/defaults.ts";
test("auth_email_uses_configured_brand_and_optional_attribution", () => {
  const config = {
    ...defaultConfig,
    brand: {
      ...defaultConfig.brand,
      name: "Studio & Edit",
      attribution: false,
    },
  };
  const html = authEmailTemplate(config);
  assert.match(html, /Studio &amp; Edit/);
  assert.match(html, /\{\{ \.Token \}\}/);
  assert.doesNotMatch(html, /Arviva|By Cedari/);
});
