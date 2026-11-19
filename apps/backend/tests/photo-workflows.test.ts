import { z } from "zod";
import { chatInput } from "../src/lib/mobile/conversation";
import { it, expect, vi } from "vitest";
import {
  routePhotoWorkflow,
  registerPhotoWorkflow,
  runPhotoWorkflow,
} from "../src/lib/photo-workflows/registry";
import { agentConfig } from "../../../packages/config/src/public";
it("ambiguous_intent_asks_without_paid_edit", () => {
  expect(
    routePhotoWorkflow("Help with this photo", ["complementary", "similar"]),
  ).toEqual({ clarify: true });
  expect(
    routePhotoWorkflow("Find similar products", ["complementary", "similar"]),
  ).toEqual({ id: "similar" });
});
it("uploads_disabled_rejects_payload_before_provider", async () => {
  const prior = agentConfig.features.uploads;
  agentConfig.features.uploads = false;
  await expect(
    runPhotoWorkflow(
      "similar",
      {
        messages: [
          {
            role: "user",
            content: "Find similar",
            images: [
              {
                id: "00000000-0000-4000-8000-000000000001",
                ownerId: "00000000-0000-4000-8000-000000000002",
              },
            ],
          },
        ],
        preferences: "",
        seenProductIds: [],
      },
      {},
    ),
  ).rejects.toThrow();
  agentConfig.features.uploads = prior;
});
it("custom_workflow_cannot_return_unscoped_products", async () => {
  const run = vi.fn(async () => ({
    content: "Result",
    products: [{ id: "made-up" }],
    checkoutLinks: [],
  }));
  registerPhotoWorkflow({
    id: "test-custom",
    intentGuidance: "A test",
    requiredFeatures: ["uploads"],
    matches: (text) => text === "Test",
    inputSchema: chatInput,
    outputSchema: z.unknown(),
    run,
  });
  agentConfig.agent.photoWorkflows.push("test-custom");
  await expect(
    runPhotoWorkflow(
      "test-custom",
      {
        messages: [{ role: "user", content: "Test" }],
        preferences: "",
        seenProductIds: [],
      },
      {},
    ),
  ).rejects.toThrow();
  agentConfig.agent.photoWorkflows = agentConfig.agent.photoWorkflows.filter(
    (id) => id !== "test-custom",
  );
});
it("foreign_photo_is_rejected_before_custom_code_runs", async () => {
  const run = vi.fn();
  registerPhotoWorkflow({
    id: "foreign-check",
    intentGuidance: "Foreign",
    requiredFeatures: ["uploads"],
    matches: () => true,
    inputSchema: chatInput,
    outputSchema: z.unknown(),
    run,
  });
  agentConfig.agent.photoWorkflows.push("foreign-check");
  await expect(
    runPhotoWorkflow(
      "foreign-check",
      {
        messages: [
          {
            role: "user",
            content: "Use this",
            images: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                ownerId: "22222222-2222-4222-8222-222222222222",
              },
            ],
          },
        ],
        preferences: "",
        seenProductIds: [],
      },
      { photoOwnerId: "33333333-3333-4333-8333-333333333333" },
    ),
  ).rejects.toThrow();
  expect(run).not.toHaveBeenCalled();
  agentConfig.agent.photoWorkflows = agentConfig.agent.photoWorkflows.filter(
    (id) => id !== "foreign-check",
  );
});
it("text_only_clarification_selects_enabled_custom_workflow", async () => {
  const { shoppingReply } = await import("../src/lib/mobile/assistant");
  const old = [...agentConfig.agent.photoWorkflows];
  const run = vi.fn(async (input: z.infer<typeof chatInput>) => {
    void input;
    return { content: "Your custom analysis", products: [], checkoutLinks: [] };
  });
  registerPhotoWorkflow({
    id: "followup-custom",
    intentGuidance: "check the fit",
    requiredFeatures: ["uploads"],
    matches: (text) => /fit/i.test(text),
    inputSchema: chatInput,
    outputSchema: z.unknown(),
    run,
  });
  agentConfig.agent.photoWorkflows = ["similar", "followup-custom"];
  const owner = "11111111-1111-4111-8111-111111111111";
  const input = chatInput.parse({
    messages: [
      {
        role: "user",
        content: "Help with this photo",
        images: [
          { id: "22222222-2222-4222-8222-222222222222", ownerId: owner },
        ],
      },
      {
        role: "assistant",
        content: "Would you like similar products or a fit check?",
        photoClarification: true,
      },
      { role: "user", content: "Check the fit" },
    ],
  });
  try {
    const reply = await shoppingReply(input, { photoOwnerId: owner });
    expect(reply.content).toBe("Your custom analysis");
    expect(run.mock.calls[0]?.[0].messages.at(-1)?.images).toEqual(
      input.messages[0].images,
    );
  } finally {
    agentConfig.agent.photoWorkflows = old;
  }
});
it("custom_render_cannot_return_another_customers_image", async () => {
  const run = vi.fn(async () => ({
    content: "Preview",
    products: [],
    checkoutLinks: [],
    previewImage: {
      id: "11111111-1111-4111-8111-111111111111",
      ownerId: "22222222-2222-4222-8222-222222222222",
    },
  }));
  registerPhotoWorkflow({
    id: "render-custom",
    intentGuidance: "render",
    requiredFeatures: ["uploads"],
    matches: () => true,
    inputSchema: chatInput,
    outputSchema: z.unknown(),
    run,
  });
  agentConfig.agent.photoWorkflows.push("render-custom");
  try {
    await expect(
      runPhotoWorkflow(
        "render-custom",
        {
          messages: [{ role: "user", content: "Render" }],
          preferences: "",
          seenProductIds: [],
        },
        { photoOwnerId: "33333333-3333-4333-8333-333333333333" },
      ),
    ).rejects.toThrow();
  } finally {
    agentConfig.agent.photoWorkflows = agentConfig.agent.photoWorkflows.filter(
      (id) => id !== "render-custom",
    );
  }
});
