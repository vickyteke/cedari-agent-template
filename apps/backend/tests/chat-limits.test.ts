import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({ rpc: mock.rpc }),
}));
import { admitChat, reserveModelTokens } from "@/lib/mobile/admission";
beforeEach(() => {
  mock.rpc.mockReset();
  mock.rpc.mockResolvedValue({ data: true, error: null });
});
afterEach(() => vi.unstubAllEnvs());
it("uses database-configured admission, hashing user/IP identifiers and separating pools", async () => {
  const request = new Request("https://arviva.space", {
    headers: { "x-forwarded-for": "203.0.113.20" },
  });
  expect(await admitChat(request, { id: "guest-user", anonymous: true })).toBe(
    true,
  );
  expect(
    await admitChat(request, { id: "customer-user", anonymous: false }),
  ).toBe(true);
  const [guest, customer] = mock.rpc.mock.calls.map((call) => call[1]);
  expect(mock.rpc.mock.calls[0][0]).toBe("admit_chat_with_limits");
  expect(guest.pool_name).toBe("guest");
  expect(customer.pool_name).toBe("customer");
  expect(guest.bucket_keys).toHaveLength(5);
  for (const key of guest.bucket_keys) expect(key).toMatch(/^[a-f0-9]{64}$/);
  expect(guest.bucket_keys[0]).not.toBe(customer.bucket_keys[0]);
  expect(JSON.stringify(mock.rpc.mock.calls)).not.toContain("203.0.113.20");
});
it("reads database admission on every call without caching permission", async () => {
  mock.rpc
    .mockResolvedValueOnce({ data: true })
    .mockResolvedValueOnce({ data: false });
  const request = new Request("https://arviva.space");
  expect(await admitChat(request, { id: "user", anonymous: true })).toBe(true);
  expect(await admitChat(request, { id: "user", anonymous: true })).toBe(false);
});
it("fails closed on settings or budget storage errors", async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
  expect(
    await admitChat(new Request("https://arviva.space"), {
      id: "user",
      anonymous: true,
    }),
  ).toBe(false);
  await expect(reserveModelTokens("guest", 100)).rejects.toThrow(
    /model_budget_/,
  );
});
it("passes a separate environment ceiling without replacing the database budget", async () => {
  vi.stubEnv("CHAT_GUEST_TOKEN_CEILING", "900000");
  await reserveModelTokens("guest", 100);
  expect(mock.rpc).toHaveBeenCalledWith("reserve_model_tokens", {
    pool_name: "guest",
    reserved_tokens: 8292,
    token_ceiling: 900000,
  });
});
it.each(["", "-1", "garbage", "1.5", "100000001"])(
  "fails closed for invalid ceiling %j",
  async (value) => {
    vi.stubEnv("CHAT_GUEST_TOKEN_CEILING", value);
    await expect(reserveModelTokens("guest", 100)).rejects.toThrow(
      /model_budget_/,
    );
    expect(mock.rpc).not.toHaveBeenCalled();
  },
);
it("keeps customer and guest guardrails separate", async () => {
  vi.stubEnv("CHAT_CUSTOMER_TOKEN_CEILING", "2000000");
  await reserveModelTokens("customer", 100);
  expect(mock.rpc.mock.calls[0][1]).toMatchObject({
    pool_name: "customer",
    token_ceiling: 2000000,
  });
});

it("keeps real exhaustion distinct from unavailable storage", async () => {
  mock.rpc.mockResolvedValue({ data: false, error: null });
  expect(await reserveModelTokens("guest", 100)).toBe(false);
  mock.rpc.mockResolvedValue({ data: null, error: null });
  await expect(reserveModelTokens("guest", 100)).rejects.toThrow(
    "model_budget_storage_unavailable",
  );
});
