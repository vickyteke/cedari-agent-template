import { writeFile } from "node:fs/promises";
import { agentConfig } from "../packages/config/src/public.ts";
import { authEmailTemplate } from "../packages/config/src/auth-email.ts";
await writeFile(
  new URL("../supabase/templates/sign-in-code.html", import.meta.url),
  authEmailTemplate(agentConfig),
);
console.log(
  "Generated the Supabase sign-in code template for " +
    agentConfig.brand.name +
    ". Copy it to hosted Supabase confirmation and magic-link settings.",
);
