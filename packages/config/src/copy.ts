import { dynamicEnglish } from "./locales/dynamic-en.ts";
import { agentConfig } from "../../../config/agent.ts";
import { backendEnglish } from "./locales/backend-en.ts";
import { uiEnglish } from "./locales/ui-en.ts";
import { en } from "./locales/en.ts";
export type MessageKey = string;
export const messages = {
  ...en,
  ...uiEnglish,
  ...backendEnglish,
  ...dynamicEnglish,
  ...agentConfig.copy,
};
export function t(
  key: MessageKey,
  params: Record<string, string | number> = {},
): string {
  const text = messages[key];
  if (text === undefined) throw Error("Missing English message: " + key);
  return text.replace(/\{(\w+)\}/g, (_, name) =>
    String(
      params[name] ??
        (
          {
            brandName: agentConfig.brand.name,
            agentName: agentConfig.brand.agentName,
            supportEmail: agentConfig.brand.supportEmail,
          } as Record<string, string>
        )[name] ??
        "{" + name + "}",
    ),
  );
}
