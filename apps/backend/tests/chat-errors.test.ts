import { afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ reply: vi.fn() }));
vi.mock("@/lib/mobile/assistant", async original => ({ ...await original<typeof import("@/lib/mobile/assistant")>(), shoppingReply: mock.reply }));
vi.mock("@/lib/mcp/auth", async original => ({ ...await original<typeof import("@/lib/mcp/auth")>(), mobilePrincipal: async () => ({ id: "test-customer", anonymous: true }) }));
vi.mock("@/lib/mobile/http", async original => ({ ...await original<typeof import("@/lib/mobile/http")>(), rateLimit: async () => true }));
vi.mock("@/lib/mobile/admission", () => ({ admitChat: async () => true, reserveModelTokens: async () => true }));
import { POST } from "@/app/api/mobile/chat/route";
import { AIConnectionError } from "@/lib/mobile/conversation";
afterEach(() => vi.restoreAllMocks());
it("shows daily allowance exhaustion in streaming chat and logs only a safe error code", async () => {
  mock.reply.mockRejectedValue(new AIConnectionError("daily_budget_reached", 429));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await POST(new Request("https://www.arviva.space/api/mobile/chat", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }) }));
  expect(response.status).toBe(200);
  const stream = await response.text();
  expect(stream).toContain("daily chat allowance");
  expect(stream).not.toContain("Hello");
  expect(log).toHaveBeenCalledWith("Arviva AI conversation failed", { code: "daily_budget_reached", status: 429 });
});
it("does not expose unexpected provider details through streaming errors", async () => {
  mock.reply.mockRejectedValue(new Error("private provider credentials and payload"));
  const response = await POST(new Request("https://www.arviva.space/api/mobile/chat", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }) }));
  const stream = await response.text();
  expect(stream).toContain("couldn’t finish");
  expect(stream).not.toContain("private provider");
});
