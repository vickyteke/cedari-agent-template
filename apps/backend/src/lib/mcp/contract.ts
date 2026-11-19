import {t} from "../../../../../packages/config/src/copy";
import { z } from "zod";
import { CommerceError } from "./commerce";

export function upstreamData<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new CommerceError(t("backend.52a9d4ed6c"), 503, "upstream_invalid_response");
  return parsed.data;
}
