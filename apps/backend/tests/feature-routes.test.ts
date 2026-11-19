import { afterEach, it, expect, vi } from "vitest";
import { agentConfig } from "../../../packages/config/src/public";
const cleanup = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/mcp/auth", async (original) => ({
  ...(await original<typeof import("../src/lib/mcp/auth")>()),
  mobilePrincipal: async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    anonymous: false,
  }),
}));
vi.mock("../src/lib/mobile/http", async (original) => ({
  ...(await original<typeof import("../src/lib/mobile/http")>()),
  rateLimit: async () => true,
}));
vi.mock("../src/lib/mobile/images", async (original) => ({
  ...(await original<typeof import("../src/lib/mobile/images")>()),
  removeAllPhotos: cleanup,
}));
import { DELETE as purgePhotos } from "../src/app/api/mobile/chat-images/route";
import { GET as getPhoto } from "../src/app/api/mobile/chat-images/[id]/route";
import { POST as postChat } from "../src/app/api/mobile/chat/route";
const originalTabs = structuredClone(agentConfig.navigation.tabs);
afterEach(() => {
  agentConfig.features.uploads = true;
  agentConfig.navigation.tabs = structuredClone(originalTabs);
  vi.clearAllMocks();
});
it("disabled_uploads_refuse_image_reads_but_allow_authenticated_purge", async () => {
  agentConfig.features.uploads = false;
  const read = await getPhoto(
    new Request(
      "https://agent.example/api/mobile/chat-images/11111111-1111-4111-8111-111111111111",
    ),
    { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) },
  );
  expect(read.status).toBe(403);
  expect(
    (
      await purgePhotos(
        new Request("https://agent.example/api/mobile/chat-images", {
          method: "DELETE",
        }),
      )
    ).status,
  ).toBe(200);
  expect(cleanup).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
});
it("disabled_chat_refuses_paid_work_before_auth_or_admission", async () => {
  agentConfig.navigation.tabs = agentConfig.navigation.tabs.filter(
    (tab) => tab.id !== "chat",
  );
  expect(
    (
      await postChat(
        new Request("https://agent.example/api/mobile/chat", {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
  ).toBe(403);
});
