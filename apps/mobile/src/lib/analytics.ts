import PostHog from 'posthog-react-native';
const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
export const analytics = key ? new PostHog(key, { host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com', defaultOptIn: false, disableGeoip: true, enableSessionReplay: false, captureAppLifecycleEvents: false }) : null;
export type EventName = 'onboarding_screen_viewed' | 'onboarding_skipped' | 'onboarding_completed' | 'screen_viewed' | 'app_error' | 'chat_sent' | 'chat_wait_long' | 'chat_wait_left' | 'chat_photo_selected' | 'chat_first_text' | 'chat_completed' | 'chat_failed' | 'product_viewed' | 'product_impression' | 'product_saved' | 'product_unsaved' | 'bag_added' | 'bag_quantity_changed' | 'bag_removed' | 'checkout_opened' | 'checkout_failed' | 'search_completed' | 'sign_in_started' | 'sign_in_completed' | 'comparison_viewed';
let enabled = false;
export function analyticsConsent(value: boolean) { enabled = value; if (value) void analytics?.optIn(); else void analytics?.optOut(); }
export function track(event: EventName, properties: Record<string, string | number | boolean> = {}) {
  if (enabled) analytics?.capture(event, { ...properties, app: 'arviva-space' });
}
