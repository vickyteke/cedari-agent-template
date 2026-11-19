export function originAllowed(
  origin: string | null,
  configured: string | undefined,
): boolean {
  if (!origin) return true; // Native clients still require a verified customer JWT.
  if (!configured) return false;
  try {
    const parsed = new URL(origin);
    return configured
      .split(",")
      .some((v) => v.trim() === parsed.origin && origin === parsed.origin);
  } catch {
    return false;
  }
}
