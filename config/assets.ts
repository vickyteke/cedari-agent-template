import { nativeAssets } from "./native-assets";
// Static imports are required for Metro to bundle local assets.
export const assets = {
  logo: require("../apps/mobile/assets/icon.png"),
  ...nativeAssets,
  onboarding: {
    inspiration: require("../apps/mobile/assets/onboarding/warm-living-room.jpg"),
  },
};
