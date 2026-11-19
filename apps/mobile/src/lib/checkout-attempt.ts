import { ApiError } from './api-error.ts';
import { checkoutResult } from './checkout-result.ts';

type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };

// Persist before sending. A timeout/restart must reuse the same checkout attempt.
export function checkoutAttempts(storage: Storage, randomId: () => string) {
  const pending = new Map<string, Promise<unknown>>();
  function serialized<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const value = (pending.get(key) || Promise.resolve()).catch(() => {}).then(operation);
    pending.set(key, value);
    // A failed operation must not poison subsequent retries or leak the key.
    void value.finally(() => { if (pending.get(key) === value) pending.delete(key); }).catch(() => {});
    return value;
  }
  return {
    get(key: string) {
      return serialized(key, async () => {
        const saved = await storage.getItem(key);
        if (saved) return saved;
        const id = randomId();
        await storage.setItem(key, id);
        return id;
      });
    },
    complete(key: string, expectedAttempt: string) {
      return serialized(key, async () => {
        // A late response from an older request cannot clear a newer attempt.
        if (await storage.getItem(key) === expectedAttempt) await storage.removeItem(key);
      });
    },
  };
}
export async function prepareCheckoutAttempt(attempts: ReturnType<typeof checkoutAttempts>, key: string, send: (idempotencyKey: string) => Promise<unknown>) {
  const attempt = await attempts.get(key);
  try {
    const result = checkoutResult(await send(attempt));
    await attempts.complete(key, attempt).catch(() => {});
    return result;
  } catch (error) {
    // Cedari explicitly authorizes a new attempt for a missing/expired provider
    // session. Other failures may be uncertain and must retain the current key.
    if (error instanceof ApiError && error.code === 'provider_checkout_not_found') await attempts.complete(key, attempt).catch(() => {});
    throw error;
  }
}
