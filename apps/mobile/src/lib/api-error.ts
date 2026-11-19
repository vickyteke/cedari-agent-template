export class ApiError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export function apiError(raw: unknown, fallback: string) {
  const data = raw && typeof raw === "object" ? raw : {};
  return new ApiError(
    "error" in data && typeof data.error === "string" ? data.error : fallback,
    "code" in data &&
      typeof data.code === "string" &&
      /^[a-z_]{1,80}$/.test(data.code)
      ? data.code
      : undefined,
  );
}
