import { styleToken } from "../../../../packages/config/src/theme.ts";
import { t } from "../../../../packages/config/src/copy.ts";
import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { request } from "../lib/api";
import { useShopper } from "../lib/store";
import { Button, colors, s } from "./ui";
type Preferences = {
  welcome: boolean;
  weekly: boolean;
  suppressed: boolean;
  available: boolean;
  consentVersion: string;
};
export function EmailPreferences() {
  const { emailSetup } = useLocalSearchParams<{ emailSetup?: string }>();
  const { session } = useShopper();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!session) return;
    let alive = true;
    void request<Preferences>("/email-preferences")
      .then((value) => {
        if (alive) setPreferences(value);
      })
      .catch(() => {
        if (alive) setError(t("ui.7ca984ec67"));
      });
    return () => {
      alive = false;
    };
  }, [session]);
  if (!session)
    return (
      <View style={s.panel}>
        <Text style={s.sectionTitle}>{t("ui.204838a2ff")}</Text>
        <Text
          style={[
            s.body,
            {
              marginTop: styleToken(
                "EmailPreferences.marginTop.6b51d431df",
                "marginTop",
                12,
              ),
            },
          ]}
        >
          {t("ui.db6a06a882")}
        </Text>
      </View>
    );
  async function save() {
    if (!preferences) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request("/email-preferences", {
        method: "POST",
        body: JSON.stringify({
          welcome: preferences.welcome,
          weekly: preferences.weekly,
          consentVersion: preferences.consentVersion,
          source: "profile",
        }),
      });
      setMessage(t("ui.1e2fd1e5be"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ui.2f05ee1389"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.panel}>
      <Text style={s.sectionTitle}>{t("ui.204838a2ff")}</Text>
      <Text
        style={[
          s.body,
          {
            marginVertical: styleToken(
              "EmailPreferences.marginVertical.6b51d431df",
              "marginVertical",
              12,
            ),
          },
        ]}
      >
        {t("ui.1c6cbbf06f")}
      </Text>
      {emailSetup === "retry" && (
        <Text style={s.error}>{t("ui.3c8d2523c1")}</Text>
      )}
      {preferences && (
        <>
          <View
            style={[
              s.row,
              {
                justifyContent: "space-between",
                marginVertical: styleToken(
                  "EmailPreferences.marginVertical.2c624232cd",
                  "marginVertical",
                  8,
                ),
              },
            ]}
          >
            <Text style={[s.body, { flex: 1, color: colors.ink }]}>
              {t("ui.c961ce2ecb")}
            </Text>
            <Switch
              accessibilityLabel={t("ui.4f201519fe")}
              disabled={busy || preferences.suppressed}
              value={preferences.welcome}
              onValueChange={(welcome) =>
                setPreferences({ ...preferences, welcome })
              }
            />
          </View>
          <View
            style={[
              s.row,
              {
                justifyContent: "space-between",
                marginVertical: styleToken(
                  "EmailPreferences.marginVertical.2c624232cd",
                  "marginVertical",
                  8,
                ),
              },
            ]}
          >
            <Text style={[s.body, { flex: 1, color: colors.ink }]}>
              {t("ui.28ed27c320")}
            </Text>
            <Switch
              accessibilityLabel={t("ui.229a7d9e78")}
              disabled={busy || preferences.suppressed}
              value={preferences.weekly}
              onValueChange={(weekly) =>
                setPreferences({ ...preferences, weekly })
              }
            />
          </View>
          <Text style={s.small}>{t("ui.e3a50dea8f")}</Text>
          {!preferences.available && (
            <Text
              style={[
                s.small,
                {
                  marginTop: styleToken(
                    "EmailPreferences.marginTop.6b51d431df",
                    "marginTop",
                    12,
                  ),
                },
              ]}
            >
              {t("ui.2f3f134ce3")}
            </Text>
          )}
          {preferences.suppressed && (
            <Text style={s.error}>{t("ui.28fec8de6f")}</Text>
          )}
          <Button
            secondary
            disabled={busy || preferences.suppressed}
            onPress={() => void save()}
            style={{
              marginTop: styleToken(
                "EmailPreferences.marginTop.b17ef6d19c",
                "marginTop",
                16,
              ),
            }}
          >
            {busy ? "Saving…" : t("ui.57a059d2b6")}
          </Button>
        </>
      )}
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={s.error}>
          {error}
        </Text>
      )}
      {!!message && (
        <Text
          accessibilityLiveRegion="polite"
          style={[
            s.small,
            {
              marginTop: styleToken(
                "EmailPreferences.marginTop.6b51d431df",
                "marginTop",
                12,
              ),
            },
          ]}
        >
          {message}
        </Text>
      )}
    </View>
  );
}
