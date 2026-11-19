import { it, expect } from "vitest";
import { supportedPreviewKind } from "../src/lib/photo-workflows/preview-policy";
it("does_not_render_canvas_footwear_as_wall_art_or_rugs", () => {
  expect(
    supportedPreviewKind({ title: "Canvas Runner", product_type: "Footwear" }),
  ).toBe(null);
  expect(
    supportedPreviewKind({ title: "Canvas bag", product_type: "Bags" }),
  ).toBe(null);
  expect(
    supportedPreviewKind({ title: "Print", product_type: "Wall art" }),
  ).toBe("wall");
  expect(supportedPreviewKind({ title: "Runner", product_type: "Rugs" })).toBe(
    "rug",
  );
});
