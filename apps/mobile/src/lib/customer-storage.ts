import { storageNamespace } from "../../../../packages/config/src/schema.ts";
export function customerStateKey(appId: string, principalId: string) {
  return storageNamespace(appId) + "." + principalId;
}
export function onboardingKey(appId: string, principalId: string) {
  return customerStateKey(appId, principalId) + ".onboarding";
}
export function guestTransfer(
  previous: { id: string; anonymous: boolean } | null,
  next: { id: string; anonymous: boolean } | null,
) {
  return previous?.anonymous &&
    next &&
    !next.anonymous &&
    previous.id !== next.id
    ? previous.id
    : null;
}
export function mergeEditedAnswers(
  current: Record<string, string | string[]>,
  edits: Record<string, string | string[]>,
) {
  return { ...current, ...edits };
}
export async function removeCustomerData(
  storage: { removeItem(key: string): Promise<void> },
  appId: string,
  principalId: string,
) {
  await storage.removeItem(customerStateKey(appId, principalId));
  await storage.removeItem(onboardingKey(appId, principalId));
}
