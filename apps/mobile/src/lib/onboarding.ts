import { t } from "../../../../packages/config/src/copy.ts";
export const styleNames = [
  "Warm Minimalism",
  "Modern Organic",
  "Collected & Eclectic",
  "Timeless Classic",
  "Sculptural Contemporary",
] as const;
export const roomNames = [
  "Living room",
  "Bedroom",
  "Dining",
  "Whole home",
] as const;
export type Introduction = {
  step: number;
  completed: boolean;
  edited?: boolean;
  name: string;
  preferences: string;
  styles: string[];
  rooms: string[];
};
export function introductionFromProfile(profile: {
  name: string;
  preferences: string;
}): Introduction {
  const lines = profile.preferences.split("\n");
  return {
    step: 0,
    completed: false,
    edited: false,
    name: profile.name,
    preferences: lines
      .filter(
        (line) =>
          !line.startsWith("Style inspiration: ") &&
          !line.startsWith("Spaces: "),
      )
      .join("\n"),
    styles: (
      lines
        .find((line) => line.startsWith("Style inspiration: "))
        ?.slice(19)
        .split(", ") || []
    ).filter((value) => styleNames.some((style) => style === value)),
    rooms: (
      lines
        .find((line) => line.startsWith("Spaces: "))
        ?.slice(8)
        .split(", ") || []
    ).filter((value) => roomNames.some((room) => room === value)),
  };
}
export function introductionPreferences(draft: Introduction) {
  return [
    draft.preferences.trim(),
    draft.styles.length
      ? t("dynamic.e642f820ae", { value0: String(draft.styles.join(", ")) })
      : "",
    draft.rooms.length ? `Spaces: ${draft.rooms.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1200);
}
export function introductionForStorage(draft: Introduction): Introduction {
  // Completed preferences belong in the shopper profile, not a second device-wide copy.
  return draft.completed
    ? {
        ...introductionFromProfile({ name: "", preferences: "" }),
        step: draft.step,
        completed: true,
      }
    : draft;
}
export function parseIntroduction(raw: string): Introduction | null {
  try {
    const value = JSON.parse(raw);
    if (
      !Number.isInteger(value.step) ||
      value.step < 0 ||
      value.step > 3 ||
      typeof value.completed !== "boolean" ||
      typeof value.name !== "string" ||
      typeof value.preferences !== "string" ||
      !Array.isArray(value.styles) ||
      !Array.isArray(value.rooms)
    )
      return null;
    return {
      ...value,
      edited: value.edited === true,
      name: value.name.slice(0, 80),
      preferences: value.preferences.slice(0, 900),
      styles: value.styles.filter((v: string) =>
        styleNames.some((s) => s === v),
      ),
      rooms: value.rooms.filter((v: string) => roomNames.some((r) => r === v)),
    };
  } catch {
    return null;
  }
}
