import type { AgentConfig } from "./schema.ts";
function html(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function authEmailTemplate(config: AgentConfig): string {
  const brand = html(config.brand.name);
  const attribution = config.brand.attribution
    ? " · " + html(config.brand.company)
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${brand}</title></head><body style="background:${config.theme.colors.paper};color:${config.theme.colors.ink};font-family:Arial,sans-serif"><main style="max-width:520px;margin:auto;padding:32px"><h1>${brand}</h1><p>Your sign-in code</p><p style="font-size:32px;letter-spacing:6px">{{ .Token }}</p><p>Enter this code in your app to continue. If you did not request it, you can ignore this email.</p><footer>${brand}${attribution}</footer></main></body></html>\n`;
}
