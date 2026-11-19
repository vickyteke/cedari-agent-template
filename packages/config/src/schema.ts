export type Selection = { mode: "all" } | { mode: "allowlist"; ids: string[] };
export type TabId = "chat" | "discover" | "saved" | "bag" | "profile";
export type FeatureId =
  | "uploads"
  | "saved"
  | "comparison"
  | "checkout"
  | "email"
  | "analytics"
  | "roomPreviews";
export type TabConfig = {
  id: TabId;
  enabled: boolean;
  label: string;
  icon: string;
};
export type PreferenceField = {
  id: string;
  label: string;
  type: "text" | "single" | "multiple";
  required: boolean;
  defaultValue?: string | string[];
  options?: { id: string; label: string }[];
  placeholder?: string;
  maxLength?: number;
};
export type AgentConfig = {
  schemaVersion: 1;
  id: string;
  locale: string;
  brand: {
    name: string;
    agentName: string;
    company: string;
    attribution: boolean;
    website: string;
    supportEmail: string;
    privacyUrl: string;
    termsUrl: string;
  };
  theme: {
    statusBar: "light" | "dark" | "auto";
    overrides?: Record<string, string | number>;
    colors: Record<string, string>;
    fonts: { heading: string; body: string };
    typeScale: number;
    spacingScale: number;
    radiusScale: number;
    borderWidth: number;
    shadowOpacity: number;
    iconStrokeWidth: number;
    motion: { enabled: boolean; duration: number; compactScale: number };
    navigation: { height: number; radius: number; maxWidth: number };
    button: { minHeight: number; radius: number };
    card: { radius: number };
  };
  navigation: { tabs: TabConfig[]; initialTab: TabId };
  onboarding: {
    enabled: boolean;
    version: number;
    skippable: boolean;
    slides: {
      id: string;
      title: string;
      eyebrow: string;
      body: string;
      image?: string;
      fields: string[];
      button: string;
    }[];
    fields: PreferenceField[];
  };
  features: Record<FeatureId, boolean>;
  assortment: {
    categories: Selection;
    merchants: Selection;
    registry: {
      categories: { id: string; label: string }[];
      merchants: { id: string; label: string }[];
    };
  };
  discovery: {
    currency: string;
    budgets: number[];
    resultLimit: number;
    prompts: string[];
  };
  agent: {
    personality: string;
    tone: string;
    guidance: string;
    greeting: string;
    model: string;
    imageModel: string;
    photoWorkflows: string[];
    previewCategories: { wall: string[]; rugs: string[] };
  };
  app: {
    slug: string;
    scheme: string;
    iosBundleId: string;
    androidPackage: string;
    version: string;
    iosBuild: string;
    androidVersionCode: number;
  };
  copy: Record<string, string>;
};
export function defineAgentConfig(input: AgentConfig): AgentConfig {
  const c = structuredClone(input);
  if (c.schemaVersion !== 1 || !/^[a-z][a-z0-9-]{1,63}$/.test(c.id))
    throw Error("Invalid configuration identity");
  for (const value of [c.brand.website, c.brand.privacyUrl, c.brand.termsUrl]) {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password)
      throw Error("Brand URL requires HTTPS");
  }
  for (const [kind, selection] of Object.entries({
    categories: c.assortment.categories,
    merchants: c.assortment.merchants,
  })) {
    if (selection.mode === "allowlist") {
      const maximum = kind === "categories" ? 100 : 50;
      if (selection.ids.length > maximum)
        throw Error(kind + " allowlist supports at most " + maximum);
      if (
        !selection.ids.length ||
        new Set(selection.ids).size !== selection.ids.length
      )
        throw Error("An allowlist must contain unique IDs");
      const known = new Set(
        c.assortment.registry[kind as "categories" | "merchants"].map(
          (v) => v.id,
        ),
      );
      if (selection.ids.some((id) => !known.has(id)))
        throw Error("Unknown " + kind + " ID in allowlist");
    } else if (selection.mode !== "all") throw Error("Unknown selection mode");
  }
  if (
    c.features.roomPreviews &&
    (!c.features.uploads || !c.agent.photoWorkflows.includes("room-preview"))
  )
    throw Error("Room previews require uploads and the room-preview workflow");
  if (!c.features.uploads && c.agent.photoWorkflows.length)
    throw Error("Photo workflows require uploads");
  const tabs = availableTabs(c);
  if (
    !tabs.length ||
    !tabs.some((t) => t.id === c.navigation.initialTab) ||
    new Set(c.navigation.tabs.map((t) => t.id)).size !==
      c.navigation.tabs.length
  )
    throw Error("Invalid tab configuration");
  const validTabs = new Set(["chat", "discover", "saved", "bag", "profile"]);
  if (c.navigation.tabs.some((t) => !validTabs.has(t.id)))
    throw Error("Unknown tab ID");
  if (
    c.discovery.resultLimit < 1 ||
    c.discovery.resultLimit > 30 ||
    !Number.isInteger(c.discovery.resultLimit)
  )
    throw Error("Result limit must be 1–30");
  if (
    !/^[A-Z]{3}$/.test(c.discovery.currency) ||
    c.discovery.budgets.some((v) => !Number.isFinite(v) || v < 0)
  )
    throw Error("Invalid discovery budget");
  if (
    !c.locale ||
    !Number.isFinite(c.theme.typeScale) ||
    c.theme.typeScale <= 0 ||
    c.theme.spacingScale <= 0 ||
    c.theme.radiusScale < 0
  )
    throw Error("Invalid theme");
  const fields = new Set(c.onboarding.fields.map((f) => f.id));
  if (fields.size !== c.onboarding.fields.length)
    throw Error("Duplicate preference field");
  if (c.onboarding.enabled && !c.onboarding.slides.length)
    throw Error("Onboarding needs slides");
  if (c.onboarding.slides.some((s) => s.fields.some((id) => !fields.has(id))))
    throw Error("Unknown onboarding field");
  for (const f of c.onboarding.fields)
    if (["single", "multiple"].includes(f.type) && !f.options?.length)
      throw Error("Choice field needs options");
  const placed = new Set(c.onboarding.slides.flatMap((slide) => slide.fields));
  if (
    c.onboarding.enabled &&
    c.onboarding.fields.some((field) => field.required && !placed.has(field.id))
  )
    throw Error("Every required field needs an onboarding slide");
  return c;
}
export function availableTabs(c: AgentConfig): TabConfig[] {
  return c.navigation.tabs.filter(
    (t) =>
      t.enabled &&
      (t.id !== "saved" || c.features.saved) &&
      (t.id !== "bag" || c.features.checkout),
  );
}
export function storageNamespace(id: string) {
  return "shopping-agent." + id + ".v1";
}
