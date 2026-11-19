import { describe, expect, it } from "vitest";
import { fallbackSearch, matchesInspiration, wantsMoreResults } from "@/lib/mobile/shopping-intent";

describe("home-screen shopping intents", () => {
  it("distinguishes browsing more products from asking about an existing piece", () => {
    for (const text of ["More please", "Show me more", "Any other ones?", "What else do you have?", "Show 20 more curtains"]) expect(wantsMoreResults(text)).toBe(true);
    for (const text of ["Tell me more about this curtain", "Show more details", "What material is this?"]) expect(wantsMoreResults(text)).toBe(false);
  });
  it("excludes unrelated items whose descriptions might mention soft furnishings", () => {
    expect(matchesInspiration("soft_furnishings", { title: "White Marble Peel and Stick Tiles", product_type: "Wall Tiles" })).toBe(false);
    expect(matchesInspiration("soft_furnishings", { title: "Linear Gold Chandelier", product_type: "Lighting" })).toBe(false);
    expect(matchesInspiration("soft_furnishings", { title: "Berber Wool Rug", product_type: "Rugs" })).toBe(true);
  });
  it("turns a softer living room into alternative soft-furnishing searches", () => {
    expect(fallbackSearch("A softer, cozier living room").query).toBe("rug OR cushion OR throw OR curtain");
  });
  it("turns a warm bedroom glow into lighting searches", () => {
    expect(fallbackSearch("A warm glow for my bedroom").query).toBe("lamp OR chandelier OR pendant");
  });
  it("keeps the tableware suggestion and its budget", () => {
    expect(fallbackSearch("Find tableware under $100")).toEqual({ query: "tableware", maxPrice: 100, limit: 12 });
  });
  it("preserves explicit color and budget constraints in each alternative", () => {
    expect(fallbackSearch("A softer, cozier blue living room under $150")).toEqual({ query: "blue rug OR blue cushion OR blue throw OR blue curtain", maxPrice: 150, limit: 12 });
  });
  it("does not broaden an explicit product request into unrelated categories", () => {
    expect(fallbackSearch("Find linen curtains under $100")).toEqual({ query: "linen curtains", maxPrice: 100, limit: 12 });
  });
});
