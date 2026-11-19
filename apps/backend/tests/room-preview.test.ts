import { agentConfig } from "../../../packages/config/src/public";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { ChatInput } from "../src/lib/mobile/conversation";
import { roomPreviewReply } from "../src/lib/mobile/room-preview";

const mock = vi.hoisted(() => ({
  tool: vi.fn(),
  budget: vi.fn(),
  photoUrl: vi.fn(),
  save: vi.fn(),
}));
vi.mock("../src/lib/mcp/client", () => ({ callArvivaTool: mock.tool }));
vi.mock("../src/lib/mcp/products", () => ({
  mobileProducts: (value: unknown) => value,
}));
vi.mock("../src/lib/mcp/admission", () => ({
  acquireLease: async () => "lease",
  releaseLease: async () => {},
}));
vi.mock("../src/lib/mobile/admission", () => ({ budget: mock.budget }));
vi.mock("../src/lib/mobile/images", async (original) => ({
  ...(await original<typeof import("../src/lib/mobile/images")>()),
  photoUrl: mock.photoUrl,
  savePhoto: mock.save,
}));

const owner = "10000000-0000-4000-8000-000000000000";
const photo = { ownerId: owner, id: "20000000-0000-4000-8000-000000000000" };
const ids = [1, 2, 3].map((n) => `30000000-0000-4000-8000-00000000000${n}`);
const piece = {
  id: ids[2],
  title: "Wildflower print",
  product_type: "Wall art",
  image_url: "https://cdn.shopify.com/variant.jpg",
};
const input: ChatInput = {
  roomPreview: true,
  preferences: "",
  seenProductIds: [],
  messages: [
    { role: "assistant", content: "Here are three pieces.", productIds: ids },
    {
      role: "user",
      content: "Show me how this 3rd product looks on this wall",
      images: [photo],
    },
  ],
};
const progress = { photoOwnerId: owner };

beforeEach(() => {
  agentConfig.features.roomPreviews = true;
  agentConfig.agent.photoWorkflows = ["room-preview"];
  vi.clearAllMocks();
  vi.stubEnv("ROOM_PREVIEW_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  mock.tool.mockResolvedValue([piece]);
  mock.budget.mockResolvedValue(true);
  mock.photoUrl.mockResolvedValue("https://private.example/room.jpg");
  mock.save.mockResolvedValue(photo);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("uses the third displayed variant and asks before making a paid edit", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const result = await roomPreviewReply(input, progress);
  expect(mock.tool).toHaveBeenCalledWith(
    "get_products",
    { productIds: [ids[2]] },
    expect.any(AbortSignal),
    undefined,
  );
  expect(result?.content).toContain("Where should I hang it?");
  expect(result?.previewContext).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mock.budget).not.toHaveBeenCalled();
});

it("renders and saves an assistant photo using the previously attached room and exact product after placement confirmation", async () => {
  const jpeg = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#dad4c8" },
  })
    .jpeg()
    .toBuffer();
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    if (String(url) === "https://api.openai.com/v1/images/edits") {
      const form = init?.body as FormData;
      expect(form.getAll("image[]")).toHaveLength(2);
      expect(form.get("prompt")).toContain("Center it above the sofa");
      return Response.json({ data: [{ b64_json: jpeg.toString("base64") }] });
    }
    return new Response(new Uint8Array(jpeg), {
      headers: { "Content-Type": "image/jpeg" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  const question = await roomPreviewReply(input, progress);
  const result = await roomPreviewReply(
    {
      ...input,
      messages: [
        ...input.messages,
        {
          role: "assistant",
          content: question!.content,
          previewContext: question!.previewContext,
        },
        { role: "user", content: "Center it above the sofa" },
      ],
    },
    progress,
  );
  expect(result?.previewImage).toEqual(photo);
  expect(result?.products).toEqual([piece]);
  expect(mock.photoUrl).toHaveBeenCalledWith(owner, photo.id);
  expect(mock.save).toHaveBeenCalledWith(owner, expect.any(Buffer));
});

it("keeps ordinary wall decor requests in shopping chat and rejects context from another account", async () => {
  expect(
    await roomPreviewReply(
      {
        ...input,
        messages: [
          {
            role: "user",
            content: "Show me wall decor options for this wall",
            images: [photo],
          },
        ],
      },
      progress,
    ),
  ).toBeUndefined();
  const question = await roomPreviewReply(input, progress);
  expect(
    await roomPreviewReply(
      {
        ...input,
        messages: [
          ...input.messages,
          {
            role: "assistant",
            content: question!.content,
            previewContext: question!.previewContext,
          },
          { role: "user", content: "Yes" },
        ],
      },
      { photoOwnerId: "another-owner" },
    ),
  ).toBeUndefined();
  expect(mock.budget).not.toHaveBeenCalled();
});

it("routes the shopper’s exact fourth-product wording despite the typo", async () => {
  const fourthId = "30000000-0000-4000-8000-000000000004";
  mock.tool.mockResolvedValue([
    { ...piece, id: fourthId, title: "Round wall mirror" },
  ]);
  const result = await roomPreviewReply(
    {
      ...input,
      messages: [
        {
          role: "assistant",
          content: "Here are four pieces.",
          productIds: [...ids, fourthId],
        },
        {
          role: "user",
          content:
            "Please show how the 4th product would like like on my wall.",
          images: [photo],
        },
      ],
    },
    progress,
  );
  expect(result?.content).toContain("Round wall mirror");
  expect(result?.previewContext).toBeTruthy();
  expect(mock.budget).not.toHaveBeenCalled();
});

it("gives a refresh instruction when an old client reaches the pilot", async () => {
  const result = await roomPreviewReply(
    { ...input, roomPreview: undefined },
    progress,
  );
  expect(result?.content).toContain("Refresh this page");
  expect(mock.tool).not.toHaveBeenCalled();
});

it("explains when a preview-capable app reaches a backend with the pilot off", async () => {
  vi.stubEnv("ROOM_PREVIEW_ENABLED", "false");
  const result = await roomPreviewReply(input, progress);
  expect(result?.content).toContain("aren’t available in this session");
  expect(mock.tool).not.toHaveBeenCalled();
});

it("routes an attached-wall request referring to the product without a number", async () => {
  mock.tool.mockResolvedValue([
    { ...piece, title: "Round wood-framed mirror" },
  ]);
  const result = await roomPreviewReply(
    {
      ...input,
      messages: [
        {
          role: "assistant",
          content: "Here is the mirror.",
          productIds: [piece.id],
        },
        {
          role: "user",
          content:
            "Can you show me how the product would look on my wall in the attached picture?",
          images: [photo],
        },
      ],
    },
    progress,
  );
  expect(result?.content).toContain("Round wood-framed mirror");
  expect(result?.content).toContain("Where should I hang it?");
  expect(result?.previewContext).toBeTruthy();
  expect(mock.budget).not.toHaveBeenCalled();
});

it("asks which result to preview when the shopper refers to the product after several cards", async () => {
  const result = await roomPreviewReply(
    {
      ...input,
      messages: [
        input.messages[0],
        {
          role: "user",
          content: "Show me the product in the attached picture.",
          images: [photo],
        },
      ],
    },
    progress,
  );
  expect(result?.content).toContain("Which piece");
  expect(result?.previewContext).toBeTruthy();
  expect(mock.tool).not.toHaveBeenCalled();
});

it("reuses the wall photo from the recommendation turn for a first-mirror follow-up", async () => {
  mock.tool.mockResolvedValue([
    { ...piece, id: ids[0], title: "Organic Shape Solid Wood Wall Mirror" },
  ]);
  const result = await roomPreviewReply(
    {
      ...input,
      messages: [
        {
          role: "user",
          content: "Show me some wall decor for this wall",
          images: [photo],
        },
        input.messages[0],
        {
          role: "user",
          content:
            "ok cool! can you show how the first mirror would look like on my wall?",
        },
      ],
    },
    progress,
  );
  expect(result?.content).toContain("Organic Shape Solid Wood Wall Mirror");
  expect(result?.content).toContain("Where should I hang it?");
  expect(result?.previewContext).toBeTruthy();
  expect(mock.budget).not.toHaveBeenCalled();
});
