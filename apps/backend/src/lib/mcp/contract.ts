import { z } from "zod";
import { CommerceError } from "./commerce";

export function upstreamData<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new CommerceError("The shopping service returned an invalid response. Please try again.", 503, "upstream_invalid_response");
  return parsed.data;
}
