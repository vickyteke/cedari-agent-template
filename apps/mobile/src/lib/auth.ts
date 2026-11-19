import "react-native-url-polyfill/auto";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const storage = {
  getItem: (name: string) =>
    Platform.OS === "web"
      ? Promise.resolve(
          typeof sessionStorage === "undefined"
            ? null
            : sessionStorage.getItem(name),
        )
      : SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) =>
    Platform.OS === "web"
      ? Promise.resolve(sessionStorage.setItem(name, value))
      : SecureStore.setItemAsync(name, value),
  removeItem: (name: string) =>
    Platform.OS === "web"
      ? Promise.resolve(sessionStorage.removeItem(name))
      : SecureStore.deleteItemAsync(name),
};
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;
if (Platform.OS !== "web")
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase?.auth.startAutoRefresh();
    else supabase?.auth.stopAutoRefresh();
  });

let guestSession: Promise<Session> | null = null;
/** Establish a distinct anonymous principal before reading any guest data. */
export async function ensureShoppingSession(): Promise<Session> {
  if (!supabase) throw Error("Shopping is not connected yet.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;
  if (!guestSession)
    guestSession = supabase.auth
      .signInAnonymously()
      .then(({ data, error }) => {
        if (error || !data.session)
          throw error || Error("Could not start a guest session.");
        return data.session;
      })
      .finally(() => {
        guestSession = null;
      });
  return guestSession;
}
export async function shoppingAccessToken(): Promise<string> {
  return (await ensureShoppingSession()).access_token;
}
